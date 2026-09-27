//! Cloudflame Edge Proxy Configuration Loader
//!

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ServerConfig {
    pub listen_addr: String,
    pub worker_threads: usize,
    pub keepalive_timeout_secs: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            listen_addr: "0.0.0.0:8443".to_string(),
            worker_threads: 16,
            keepalive_timeout_secs: 60,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BufferConfig {
    pub max_active_features: usize,
    pub stack_allocation_mode: String,
    pub degradation_policy: String,
}

impl Default for BufferConfig {
    fn default() -> Self {
        Self {
            max_active_features: 200,
            stack_allocation_mode: "fixed_contiguous".to_string(),
            degradation_policy: "priority_partial_selection".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluatorConfig {
    pub bot_block_threshold: u8,
    pub bot_challenge_threshold: u8,
    pub ja4_fingerprint_weight: f32,
    pub network_reputation_weight: f32,
    pub behavioral_entropy_weight: f32,
}

impl Default for EvaluatorConfig {
    fn default() -> Self {
        Self {
            bot_block_threshold: 80,
            bot_challenge_threshold: 50,
            ja4_fingerprint_weight: 0.35,
            network_reputation_weight: 0.40,
            behavioral_entropy_weight: 0.25,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TelemetryConfig {
    pub rfc5424_app_name: String,
    pub rfc5424_facility: u8,
    pub prometheus_metrics_enabled: bool,
    pub prometheus_endpoint: String,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            rfc5424_app_name: "cloudflame-proxy".to_string(),
            rfc5424_facility: 16,
            prometheus_metrics_enabled: true,
            prometheus_endpoint: "/metrics".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ProxyConfig {
    pub server: ServerConfig,
    pub buffer: BufferConfig,
    pub evaluator: EvaluatorConfig,
    pub telemetry: TelemetryConfig,
}

impl ProxyConfig {
    pub fn from_yaml_str(yaml_str: &str) -> Result<Self, serde_yaml::Error> {
        serde_yaml::from_str(yaml_str)
    }

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let config = Self::from_yaml_str(&content)?;
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let cfg = ProxyConfig::default();
        assert_eq!(cfg.buffer.max_active_features, 200);
        assert_eq!(cfg.evaluator.bot_block_threshold, 80);
    }

    #[test]
    fn test_yaml_deserialization() {
        let yaml = r#"
server:
  listen_addr: "127.0.0.1:8080"
  worker_threads: 4
  keepalive_timeout_secs: 30
buffer:
  max_active_features: 200
  stack_allocation_mode: "fixed_contiguous"
  degradation_policy: "priority_partial_selection"
evaluator:
  bot_block_threshold: 85
  bot_challenge_threshold: 45
  ja4_fingerprint_weight: 0.4
  network_reputation_weight: 0.4
  behavioral_entropy_weight: 0.2
telemetry:
  rfc5424_app_name: "cloudflame-test"
  rfc5424_facility: 16
  prometheus_metrics_enabled: true
  prometheus_endpoint: "/metrics"
"#;
        let cfg = ProxyConfig::from_yaml_str(yaml).unwrap();
        assert_eq!(cfg.server.listen_addr, "127.0.0.1:8080");
        assert_eq!(cfg.evaluator.bot_block_threshold, 85);
    }
}
