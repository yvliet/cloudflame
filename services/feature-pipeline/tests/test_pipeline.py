"""
Cloudflame Feature Pipeline: Unit Test Suite.

Validates catalog synchronization, schema reflection invariants, and feature extraction.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

pipeline_dir = Path(__file__).resolve().parent.parent
if str(pipeline_dir) not in sys.path:
    sys.path.insert(0, str(pipeline_dir))

from config import PipelineConfig
from catalog_sync import CANONICAL_FEATURES_200, sync_catalog
from extractor import KNOWN_FEATURES, extract_and_emit, resolve_feature_cardinality
from models import FeatureDefinition, ExtractionBatch, TelemetryPayload


class TestPipelineConfig(unittest.TestCase):
    def test_default_config_invariants(self) -> None:
        cfg = PipelineConfig()
        self.assertEqual(cfg.max_active_features, 200)
        self.assertEqual(cfg.shard_overflow_count, 80)
        self.assertEqual(cfg.canonical_database, "bot_signals")
        self.assertEqual(cfg.canonical_table, "events")


class TestCatalogSync(unittest.TestCase):
    def test_canonical_catalog_counts(self) -> None:
        self.assertEqual(len(CANONICAL_FEATURES_200), 200)

        # Validate domain partitioning
        domains: dict[str, int] = {}
        for col in CANONICAL_FEATURES_200:
            domain = col["domain"]
            domains[domain] = domains.get(domain, 0) + 1

        self.assertEqual(domains.get("tls_cryptographic"), 35)
        self.assertEqual(domains.get("tcp_transport"), 30)
        self.assertEqual(domains.get("http_frame_protocol"), 35)
        self.assertEqual(domains.get("header_entropy"), 35)
        self.assertEqual(domains.get("network_reputation"), 35)
        self.assertEqual(domains.get("client_behavioral"), 30)

    def test_clean_sync_returns_200_features(self) -> None:
        features = sync_catalog(simulate_duplication=False)
        self.assertEqual(len(features), 200)

    def test_simulated_duplication_returns_280_features(self) -> None:
        features = sync_catalog(simulate_duplication=True)
        self.assertEqual(len(features), 280)


class TestExtractor(unittest.TestCase):
    def test_known_features_exhaustive_count(self) -> None:
        self.assertEqual(len(KNOWN_FEATURES), 200)

    def test_resolve_cardinality_clean(self) -> None:
        raw_cols = sync_catalog(simulate_duplication=False)
        resolved = resolve_feature_cardinality(raw_cols)
        self.assertEqual(len(resolved), 200)
        for feat in resolved:
            self.assertFalse(feat["is_shadow"])
            self.assertGreaterEqual(feat["priority"], 50)

    def test_resolve_cardinality_with_shard_duplicates(self) -> None:
        raw_cols = sync_catalog(simulate_duplication=True)
        resolved = resolve_feature_cardinality(raw_cols)
        self.assertEqual(len(resolved), 280)

        shadow_count = sum(1 for f in resolved if f["is_shadow"])
        canonical_count = sum(1 for f in resolved if not f["is_shadow"])

        self.assertEqual(canonical_count, 200)
        self.assertEqual(shadow_count, 80)

        for feat in resolved:
            if feat["is_shadow"]:
                self.assertEqual(feat["priority"], 0)
            else:
                self.assertGreaterEqual(feat["priority"], 50)

    def test_extract_and_emit_to_temp_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_path = Path(tmp_dir) / "features.json"
            features = extract_and_emit(simulate_duplication=False, output_path=out_path)
            self.assertEqual(len(features), 200)
            self.assertTrue(out_path.exists())

            with open(out_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(len(data), 200)
            self.assertEqual(data[0]["name"], "tls_ja4_digest")


class TestDataModels(unittest.TestCase):
    def test_feature_definition_model(self) -> None:
        feat = FeatureDefinition(
            id=1,
            name="ja4_digest",
            data_type="String",
            domain="tls_crypto",
            priority=255,
            is_shadow=False,
            weight=1.0,
        )
        d = feat.to_dict()
        self.assertEqual(d["id"], 1)
        self.assertEqual(d["name"], "ja4_digest")
        self.assertEqual(d["priority"], 255)
        self.assertFalse(d["is_shadow"])


if __name__ == "__main__":
    unittest.main()
