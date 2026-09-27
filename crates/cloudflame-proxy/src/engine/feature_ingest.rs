//! Cloudflame Edge Security: Hardened Feature Ingestion Engine
//!
//! Provides zero-allocation priority degradation for dynamic configuration payloads.

use serde::{Deserialize, Serialize};

/// Maximum active features supported by the fixed-capacity edge evaluator.
pub const MAX_ACTIVE_FEATURES: usize = 200;

/// Core feature representation for edge bot detection and traffic classification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Feature {
    pub id: u32,
    pub name: String,
    pub data_type: String,
    #[serde(default)]
    pub domain: Option<String>,
    pub priority: u8,
    pub is_shadow: bool,
}

impl Feature {
    pub fn new(id: u32, name: String, data_type: String, priority: u8, is_shadow: bool) -> Self {
        Self {
            id,
            name,
            data_type,
            domain: None,
            priority,
            is_shadow,
        }
    }

    pub fn with_domain(
        id: u32,
        name: String,
        data_type: String,
        domain: String,
        priority: u8,
        is_shadow: bool,
    ) -> Self {
        Self {
            id,
            name,
            data_type,
            domain: Some(domain),
            priority,
            is_shadow,
        }
    }

    pub fn empty() -> Self {
        Self {
            id: 0,
            name: String::new(),
            data_type: String::new(),
            domain: None,
            priority: 0,
            is_shadow: false,
        }
    }
}

impl Default for Feature {
    fn default() -> Self {
        Self::empty()
    }
}

/// Structured execution diagnostics generated during feature ingestion.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IngestionReport {
    pub total_ingested: usize,
    pub active_count: usize,
    pub dropped_count: usize,
    pub degraded: bool,
    pub rfc5424_log: Option<String>,
}

/// Ingest dynamic feature payloads gracefully using in-place partial selection.
///
/// Invariant: Regardless of input slice cardinality (0..N), this function never
/// panics and guarantees that the active feature count never exceeds MAX_ACTIVE_FEATURES.
/// When input cardinality exceeds capacity, the lowest-priority features are shed
/// using select_nth_unstable_by in O(N) time with zero heap reallocations.
pub fn ingest_features_gracefully(features: &mut Vec<Feature>) -> IngestionReport {
    let initial_count = features.len();

    if initial_count <= MAX_ACTIVE_FEATURES {
        // Deterministic priority ordering (highest priority first)
        features.sort_unstable_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.id.cmp(&b.id))
        });

        return IngestionReport {
            total_ingested: initial_count,
            active_count: initial_count,
            dropped_count: 0,
            degraded: false,
            rfc5424_log: None,
        };
    }

    let dropped_count = initial_count - MAX_ACTIVE_FEATURES;

    // In-place partial selection in O(N) time without additional allocations.
    // Partition slice such that elements at 0..MAX_ACTIVE_FEATURES have priority >= remaining.
    features.select_nth_unstable_by(MAX_ACTIVE_FEATURES - 1, |a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| a.id.cmp(&b.id))
    });

    // Truncate in-place to the hard capacity limit
    features.truncate(MAX_ACTIVE_FEATURES);

    // Sort the retained active slice for deterministic execution
    features.sort_unstable_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| a.id.cmp(&b.id))
    });

    // Format structured RFC-5424 syslog warning
    let rfc5424_msg = format!(
        "<132>1 2026-09-23T16:18:00.000Z edge-colo-01 cloudflame-proxy 4102 SEC_OVERFLOW [feature_overflow@cloudflame dropped=\"{}\" limit=\"{}\" total=\"{}\"] High-cardinality feature payload degraded: low-priority features shed",
        dropped_count, MAX_ACTIVE_FEATURES, initial_count
    );

    IngestionReport {
        total_ingested: initial_count,
        active_count: MAX_ACTIVE_FEATURES,
        dropped_count,
        degraded: true,
        rfc5424_log: Some(rfc5424_msg),
    }
}
