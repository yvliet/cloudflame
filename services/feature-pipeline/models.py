"""
Cloudflame Feature Pipeline: Data Models & Payload Types.

"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List


@dataclass(frozen=True)
class FeatureDefinition:
    id: int
    name: str
    data_type: str
    domain: str
    priority: int
    is_shadow: bool = False
    weight: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "data_type": self.data_type,
            "priority": self.priority,
            "is_shadow": self.is_shadow,
            "domain": self.domain,
            "weight": self.weight,
        }


@dataclass
class ExtractionBatch:
    batch_id: str
    source_query: str
    is_qualified: bool
    features: List[FeatureDefinition] = field(default_factory=list)
    extracted_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @property
    def total_count(self) -> int:
        return len(self.features)


@dataclass
class TelemetryPayload:
    version: str
    feature_count: int
    active_limit: int
    features: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
