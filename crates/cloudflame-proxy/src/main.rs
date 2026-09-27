//! Cloudflame Edge Security Service Executable
//!

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process;

use cloudflame_proxy::{
    ingest_features_baseline, ingest_features_gracefully, Feature, MAX_ACTIVE_FEATURES,
};

fn resolve_payload_path(custom_path: Option<&str>) -> PathBuf {
    if let Some(p) = custom_path {
        return PathBuf::from(p);
    }

    // Default paths to check: current dir or relative workspace root
    let candidates = [
        PathBuf::from("payloads/features.json"),
        PathBuf::from("../../payloads/features.json"),
        PathBuf::from("../payloads/features.json"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return candidate.clone();
        }
    }

    PathBuf::from("payloads/features.json")
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let use_hardened = args.iter().any(|arg| arg == "--hardened");
    let mut custom_payload = None;

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--payload" && i + 1 < args.len() {
            custom_payload = Some(args[i + 1].as_str());
            i += 1;
        }
        i += 1;
    }

    let payload_path = resolve_payload_path(custom_payload);
    let payload_bytes = match fs::read(&payload_path) {
        Ok(bytes) => bytes,
        Err(err) => {
            eprintln!(
                "[cloudflame-proxy] Failed reading payload at {}: {}",
                payload_path.display(),
                err
            );
            process::exit(1);
        }
    };

    let mut features: Vec<Feature> = match serde_json::from_slice(&payload_bytes) {
        Ok(feats) => feats,
        Err(err) => {
            eprintln!("[cloudflame-proxy] Failed parsing features.json: {}", err);
            process::exit(1);
        }
    };

    println!(
        "[cloudflame-proxy] Ingesting dynamic feature configuration (received {} features)",
        features.len()
    );

    let show_metrics = args.iter().any(|arg| arg == "--metrics");

    if use_hardened {
        println!("[cloudflame-proxy] Mode: HARDENED (in-place partial selection)");
        let report = ingest_features_gracefully(&mut features);

        if let Some(log_msg) = &report.rfc5424_log {
            eprintln!("{}", log_msg);
        }

        println!(
            "[cloudflame-proxy] Ingestion completed: active_count={} dropped_count={} degraded={}",
            report.active_count, report.dropped_count, report.degraded
        );

        if show_metrics {
            let metrics = cloudflame_proxy::PrometheusMetrics::from_ingestion(&report);
            println!("\n# --- Prometheus Exposition Output ---");
            print!("{}", metrics.render_prometheus_text());
        }
    } else {
        println!("[cloudflame-proxy] Mode: BASELINE (fixed array conversion)");
        let active_array = ingest_features_baseline(&features);
        let populated_count = active_array.iter().filter(|f| !f.name.is_empty()).count();
        println!(
            "[cloudflame-proxy] Ingestion completed: array_capacity={} populated={}",
            MAX_ACTIVE_FEATURES, populated_count
        );

        if show_metrics {
            let metrics = cloudflame_proxy::PrometheusMetrics {
                features_total: features.len(),
                features_active: populated_count,
                features_degraded_total: 0,
            };
            println!("\n# --- Prometheus Exposition Output ---");
            print!("{}", metrics.render_prometheus_text());
        }
    }

    if args.iter().any(|arg| arg == "--eval" || arg == "--evaluate") {
        let evaluator = cloudflame_proxy::TrafficEvaluator::new(cloudflame_proxy::config::EvaluatorConfig::default());
        let sample_signals = cloudflame_proxy::RequestSignals {
            ja4_digest: "t13d150500_8daaf6152771_b4b5de4f58f4".to_string(),
            asn: 13335,
            is_datacenter_or_proxy: false,
            is_tor_or_relay: false,
            header_entropy_score: 0.12,
            behavioral_anomaly_score: 0.08,
        };
        let verdict = evaluator.evaluate(&sample_signals);
        println!(
            "[cloudflame-proxy] Sample Request Evaluator Verdict: threat_score={} action={:?}",
            verdict.threat_score, verdict.action
        );
    }
}
