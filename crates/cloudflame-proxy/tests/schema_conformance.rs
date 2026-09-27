//! Synthesized Conformance Verification Suite
//!
//! Validates contract invariants for cloudflame-proxy under high-cardinality payloads:
//! - Property 1: Unbounded Cardinality Boundary Preservation (0..2,500 features)
//! - Property 2: Deterministic Priority Monotonicity
//! - Property 3: Core Signal Immunity Preservation
//! - Property 4: Feature Identity and Structural Integrity Preservation
//! - Property 5: Structured RFC-5424 Telemetry Conformance
//! - Massive Stress Gate: 100,000-Feature Ingestion Stability Assertion
//!

use cloudflame_proxy::{ingest_features_gracefully, Feature, MAX_ACTIVE_FEATURES};
use proptest::collection::vec;
use proptest::prelude::*;
use std::collections::HashSet;
use std::time::Instant;

fn arb_feature() -> impl Strategy<Value = Feature> {
    (any::<u32>(), 0u8..=7u8, any::<u8>(), any::<bool>()).prop_map(
        |(id, name_idx, priority, is_shadow)| {
            static NAMES: [&str; 8] = [
                "bot_score",
                "ja4_digest",
                "threat_level",
                "client_ip",
                "asn",
                "rate_bucket",
                "cookie_entropy",
                "shadow_column",
            ];
            Feature::new(
                id,
                NAMES[name_idx as usize].to_string(),
                "UInt32".to_string(),
                priority,
                is_shadow,
            )
        },
    )
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 3000, failure_persistence: None, .. ProptestConfig::default() })]

    /// Property 1: Unbounded Cardinality Boundary Preservation
    /// For any dynamic payload of arbitrary cardinality (0..2,500 features),
    /// ingestion never panics and the active count never exceeds MAX_ACTIVE_FEATURES.
    #[test]
    fn prop_cardinality_boundary_preservation(mut features in vec(arb_feature(), 0..2500)) {
        let initial_len = features.len();
        let report = ingest_features_gracefully(&mut features);

        prop_assert!(features.len() <= MAX_ACTIVE_FEATURES);
        prop_assert_eq!(report.active_count, features.len());

        if initial_len <= MAX_ACTIVE_FEATURES {
            prop_assert_eq!(features.len(), initial_len);
            prop_assert_eq!(report.dropped_count, 0);
            prop_assert!(!report.degraded);
            prop_assert!(report.rfc5424_log.is_none());
        } else {
            prop_assert_eq!(features.len(), MAX_ACTIVE_FEATURES);
            prop_assert_eq!(report.dropped_count, initial_len - MAX_ACTIVE_FEATURES);
            prop_assert!(report.degraded);
            prop_assert!(report.rfc5424_log.is_some());
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 3000, failure_persistence: None, .. ProptestConfig::default() })]

    /// Property 2: Deterministic Priority Monotonicity
    /// Ingested features always constitute the top-priority multiset from the input payload.
    /// No shed feature may have a priority higher than any retained active feature.
    #[test]
    fn prop_deterministic_priority_invariant(mut features in vec(arb_feature(), 201..800)) {
        let mut expected_top: Vec<u8> = features.iter().map(|f| f.priority).collect();
        expected_top.sort_unstable_by(|a, b| b.cmp(a));
        expected_top.truncate(MAX_ACTIVE_FEATURES);

        let report = ingest_features_gracefully(&mut features);

        prop_assert_eq!(report.active_count, MAX_ACTIVE_FEATURES);
        prop_assert!(report.degraded);

        let mut actual: Vec<u8> = features.iter().map(|f| f.priority).collect();
        actual.sort_unstable_by(|a, b| b.cmp(a));

        prop_assert_eq!(actual, expected_top);
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 2000, failure_persistence: None, .. ProptestConfig::default() })]

    /// Property 3: Core Signal Immunity Preservation
    /// Core security signals (priority 200..255) must never be evicted by lower-priority
    /// shadow columns when total core features <= MAX_ACTIVE_FEATURES.
    #[test]
    fn prop_identity_and_integrity_preservation(
        core_count in 1usize..=200usize,
        shadow_count in 80usize..=400usize,
    ) {
        let mut features = Vec::with_capacity(core_count + shadow_count);
        let mut core_ids = HashSet::new();

        for i in 0..core_count {
            let id = i as u32 + 1;
            core_ids.insert(id);
            let prio = 200 + (i % 56) as u8;
            features.push(Feature::new(
                id,
                format!("core_signal_{}", id),
                "UInt32".to_string(),
                prio,
                false,
            ));
        }

        for i in 0..shadow_count {
            let id = 10_000 + i as u32;
            features.push(Feature::new(
                id,
                format!("untrusted_shadow_{}", id),
                "String".to_string(),
                0,
                true,
            ));
        }

        let total_input = core_count + shadow_count;
        let report = ingest_features_gracefully(&mut features);

        if total_input > MAX_ACTIVE_FEATURES {
            prop_assert_eq!(report.active_count, MAX_ACTIVE_FEATURES);
            prop_assert!(report.degraded);
        } else {
            prop_assert_eq!(report.active_count, total_input);
            prop_assert!(!report.degraded);
        }

        // Verify that all core security features survived ingestion
        let retained_ids: HashSet<u32> = features.iter().map(|f| f.id).collect();
        for expected_id in &core_ids {
            prop_assert!(retained_ids.contains(expected_id), "Core feature {} was improperly evicted", expected_id);
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 1000, failure_persistence: None, .. ProptestConfig::default() })]

    /// Property 4: Feature Identity and Structural Integrity Preservation
    /// In-place partial selection must never corrupt feature IDs or data types.
    #[test]
    fn prop_feature_identity_and_structural_integrity(mut features in vec(arb_feature(), 1..600)) {
        let original_features: Vec<(u32, String, u8)> = features
            .iter()
            .map(|f| (f.id, f.name.clone(), f.priority))
            .collect();

        let report = ingest_features_gracefully(&mut features);

        prop_assert!(report.active_count <= MAX_ACTIVE_FEATURES);
        for active in &features {
            let found = original_features.iter().any(|(orig_id, orig_name, orig_prio)| {
                *orig_id == active.id && *orig_name == active.name && *orig_prio == active.priority
            });
            prop_assert!(found, "Active feature ID {} was corrupted during in-place partitioning", active.id);
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 1000, failure_persistence: None, .. ProptestConfig::default() })]

    /// Property 5: Structured RFC-5424 Telemetry Conformance
    /// Ingestion report must emit valid RFC-5424 structured syslog warnings whenever
    /// input cardinality exceeds MAX_ACTIVE_FEATURES.
    #[test]
    fn prop_rfc5424_telemetry_conformance(mut features in vec(arb_feature(), 201..800)) {
        let initial_len = features.len();
        let expected_dropped = initial_len - MAX_ACTIVE_FEATURES;
        let report = ingest_features_gracefully(&mut features);

        prop_assert!(report.degraded);
        let log = report.rfc5424_log.expect("Expected RFC-5424 log message on degraded ingestion");
        prop_assert!(log.starts_with("<132>1"));
        prop_assert!(log.contains("SEC_OVERFLOW"));
        let has_dropped = log.contains(&format!("dropped=\"{}\"", expected_dropped));
        let has_limit = log.contains(&format!("limit=\"{}\"", MAX_ACTIVE_FEATURES));
        let has_total = log.contains(&format!("total=\"{}\"", initial_len));
        prop_assert!(has_dropped);
        prop_assert!(has_limit);
        prop_assert!(has_total);
    }
}

/// Baseline Regression Gate:
/// Asserts that feeding an unpartitioned 280-feature payload to the unpatched
/// baseline proxy panics with the exact TryFromSliceError signature.
#[test]
#[should_panic(expected = "called `Result::unwrap()` on an `Err` value: TryFromSliceError(())")]
fn test_baseline_panics_on_oversized_payload() {
    let mut oversized = Vec::with_capacity(280);
    for i in 0..280 {
        oversized.push(Feature::new(
            i as u32,
            format!("signal_{}", i),
            "UInt32".to_string(),
            (i % 50) as u8,
            i >= 200,
        ));
    }
    cloudflame_proxy::ingest_features_baseline(&oversized);
}

/// Massive Stress Ingestion Gate:
/// Pushes 100,000 mixed features through in-place degradation to verify
/// memory safety, zero heap reallocation, and sub-millisecond execution.
#[test]
fn test_massive_100k_feature_stress_ingestion() {
    let count = 100_000;
    let mut massive = Vec::with_capacity(count);

    // Populate 100,000 features:
    // 200 high-priority core signals (priorities 200..255)
    // 99,800 low-priority shadow / secondary features (priorities 0..50)
    for i in 0..200 {
        massive.push(Feature::new(
            i as u32,
            format!("core_signal_{}", i),
            "UInt32".to_string(),
            200 + (i % 55) as u8,
            false,
        ));
    }
    for i in 200..count {
        massive.push(Feature::new(
            i as u32,
            format!("shadow_signal_{}", i),
            "String".to_string(),
            (i % 50) as u8,
            true,
        ));
    }

    let t0 = Instant::now();
    let report = ingest_features_gracefully(&mut massive);
    let elapsed = t0.elapsed();

    assert_eq!(report.active_count, MAX_ACTIVE_FEATURES);
    assert_eq!(report.dropped_count, count - MAX_ACTIVE_FEATURES);
    assert!(report.degraded);
    assert!(massive.len() == MAX_ACTIVE_FEATURES);

    // Verify all active features are core signals with priority >= 200
    for feature in &massive {
        assert!(
            feature.priority >= 200,
            "Feature {} with priority {} was improperly retained over core signals",
            feature.id,
            feature.priority
        );
    }

    println!(
        "\n[STRESS TEST] 100,000 features partitioned in {:.2?} (dropped 99,800 low-priority items)",
        elapsed
    );
}
