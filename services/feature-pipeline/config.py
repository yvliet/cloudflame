"""
Cloudflame Feature Pipeline: Configuration Management.

"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PipelineConfig:
    clickhouse_host: str = os.getenv("CLICKHOUSE_HOST", "127.0.0.1")
    clickhouse_port: int = int(os.getenv("CLICKHOUSE_PORT", "9000"))
    canonical_database: str = os.getenv("CLICKHOUSE_DATABASE", "bot_signals")
    canonical_table: str = "events"
    max_active_features: int = 200
    shard_overflow_count: int = 80
    payload_output_path: Path = (
        Path(__file__).resolve().parent.parent.parent / "payloads" / "features.json"
    )


default_config = PipelineConfig()
