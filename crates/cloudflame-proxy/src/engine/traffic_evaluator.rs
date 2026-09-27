//! Cloudflame Edge Traffic Evaluator
//!
//! Multi-vector bot detection scoring engine computing unified threat scores (0..100)
//! across JA4 cryptographic fingerprints, IP/BGP reputation, and behavioral entropy.

use crate::config::EvaluatorConfig;

#[derive(Debug, Clone, PartialEq)]
pub struct RequestSignals {
    pub ja4_digest: String,
    pub asn: u32,
    pub is_datacenter_or_proxy: bool,
    pub is_tor_or_relay: bool,
    pub header_entropy_score: f32,       // 0.0 .. 1.0 (higher means higher anomaly)
    pub behavioral_anomaly_score: f32,   // 0.0 .. 1.0 (higher means higher anomaly)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MitigationAction {
    Pass,
    Challenge,
    Block,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EvaluationVerdict {
    pub threat_score: u8,
    pub action: MitigationAction,
    pub ja4_component: f32,
    pub network_component: f32,
    pub behavioral_component: f32,
}

pub struct TrafficEvaluator {
    config: EvaluatorConfig,
}

impl TrafficEvaluator {
    pub fn new(config: EvaluatorConfig) -> Self {
        Self { config }
    }

    pub fn evaluate(&self, signals: &RequestSignals) -> EvaluationVerdict {
        // 1. JA4 Fingerprint Component (0.0 .. 100.0)
        let ja4_subscore = if signals.ja4_digest.starts_with("t13d") {
            // Standard modern browser TLS fingerprint
            10.0
        } else if signals.ja4_digest.starts_with("t12d") {
            // Older browser or script client
            45.0
        } else {
            // Automated bot or headless client signature
            90.0
        };

        // 2. Network & BGP Reputation Component (0.0 .. 100.0)
        let network_subscore = if signals.is_tor_or_relay {
            95.0
        } else if signals.is_datacenter_or_proxy {
            80.0
        } else if signals.asn == 13335 || signals.asn == 15169 {
            // Trusted edge/cloud CDN autonomous systems
            5.0
        } else {
            30.0
        };

        // 3. Behavioral & Entropy Component (0.0 .. 100.0)
        let behavioral_subscore =
            (signals.header_entropy_score * 50.0) + (signals.behavioral_anomaly_score * 50.0);

        // Weighted Aggregation
        let total_score = (ja4_subscore * self.config.ja4_fingerprint_weight)
            + (network_subscore * self.config.network_reputation_weight)
            + (behavioral_subscore * self.config.behavioral_entropy_weight);

        let final_score = (total_score.clamp(0.0, 100.0).round()) as u8;

        let action = if final_score >= self.config.bot_block_threshold {
            MitigationAction::Block
        } else if final_score >= self.config.bot_challenge_threshold {
            MitigationAction::Challenge
        } else {
            MitigationAction::Pass
        };

        EvaluationVerdict {
            threat_score: final_score,
            action,
            ja4_component: ja4_subscore,
            network_component: network_subscore,
            behavioral_component: behavioral_subscore,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benign_traffic_evaluation() {
        let evaluator = TrafficEvaluator::new(EvaluatorConfig::default());
        let signals = RequestSignals {
            ja4_digest: "t13d150500_8daaf6152771_b4b5de4f58f4".to_string(),
            asn: 15169,
            is_datacenter_or_proxy: false,
            is_tor_or_relay: false,
            header_entropy_score: 0.1,
            behavioral_anomaly_score: 0.1,
        };

        let verdict = evaluator.evaluate(&signals);
        assert_eq!(verdict.action, MitigationAction::Pass);
        assert!(verdict.threat_score < 40);
    }

    #[test]
    fn test_malicious_tor_bot_evaluation() {
        let evaluator = TrafficEvaluator::new(EvaluatorConfig::default());
        let signals = RequestSignals {
            ja4_digest: "s00d000000_000000000000_000000000000".to_string(),
            asn: 9009,
            is_datacenter_or_proxy: true,
            is_tor_or_relay: true,
            header_entropy_score: 0.95,
            behavioral_anomaly_score: 0.90,
        };

        let verdict = evaluator.evaluate(&signals);
        assert_eq!(verdict.action, MitigationAction::Block);
        assert!(verdict.threat_score >= 80);
    }
}
