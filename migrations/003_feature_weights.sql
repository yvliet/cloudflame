-- ============================================================================
-- Migration: 003_feature_weights.sql
-- Service: Cloudflame Edge Security Machine Learning Evaluation
-- Description: Machine learning feature weight table defining model scoring
--              multipliers, anomaly thresholds, and priority classifications.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bot_signals.feature_weights
(
    feature_id          UInt16,
    feature_name        LowCardinality(String),
    security_domain     LowCardinality(String),
    priority_tier       UInt8,
    model_weight        Float32,
    anomaly_threshold   Float32,
    is_critical_signal  UInt8,
    updated_at          DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (security_domain, priority_tier, feature_id);

-- Representative scoring weights across the 6 security domains
INSERT INTO bot_signals.feature_weights (feature_id, feature_name, security_domain, priority_tier, model_weight, anomaly_threshold, is_critical_signal)
VALUES
    (1,   'tls_ja4_digest',                     'tls_cryptographic',   255, 0.95, 0.80, 1),
    (2,   'tls_ja3_hash',                       'tls_cryptographic',   254, 0.90, 0.85, 1),
    (36,  'tcp_syn_ack_rtt_us',                 'tcp_transport',       244, 0.75, 0.70, 1),
    (66,  'http_protocol_version',              'http_frame_protocol', 251, 0.80, 0.60, 1),
    (102, 'header_order_hash',                  'header_entropy',      249, 0.88, 0.75, 1),
    (106, 'header_user_agent_hash',             'header_entropy',      252, 0.85, 0.70, 1),
    (136, 'net_asn',                            'network_reputation',  253, 0.92, 0.65, 1),
    (142, 'net_residential_proxy_score',        'network_reputation',  249, 0.89, 0.75, 1),
    (145, 'net_tor_exit_node',                  'network_reputation',  251, 0.98, 0.90, 1),
    (193, 'client_navigator_webdriver_flag',    'client_behavioral',   254, 0.99, 0.95, 1),
    (194, 'client_headless_chrome_score',       'client_behavioral',   252, 0.96, 0.90, 1),
    (195, 'client_automation_prototype_tampered','client_behavioral',   250, 0.97, 0.90, 1);
