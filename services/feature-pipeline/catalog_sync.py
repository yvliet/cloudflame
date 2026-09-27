#!/usr/bin/env python3
"""
Cloudflame Feature Pipeline: Catalog Metadata Synchronization Service.
Simulates ClickHouse system.columns metadata extraction across cluster shards.

"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

# Canonical 200 columns across 6 security domains
CANONICAL_FEATURES_200: List[Dict[str, Any]] = [
    # Domain 1: TLS & Cryptographic Layer (35 features)
    {"name": "tls_ja4_digest", "type": "FixedString(36)", "domain": "tls_cryptographic", "priority": 255},
    {"name": "tls_ja3_hash", "type": "FixedString(32)", "domain": "tls_cryptographic", "priority": 254},
    {"name": "tls_version", "type": "LowCardinality(String)", "domain": "tls_cryptographic", "priority": 250},
    {"name": "tls_cipher_suite", "type": "LowCardinality(String)", "domain": "tls_cryptographic", "priority": 248},
    {"name": "tls_extension_count", "type": "UInt16", "domain": "tls_cryptographic", "priority": 235},
    {"name": "tls_extension_order_hash", "type": "UInt64", "domain": "tls_cryptographic", "priority": 245},
    {"name": "tls_elliptic_curves", "type": "Array(UInt16)", "domain": "tls_cryptographic", "priority": 220},
    {"name": "tls_ec_point_formats", "type": "Array(UInt8)", "domain": "tls_cryptographic", "priority": 215},
    {"name": "tls_signature_algorithms", "type": "Array(UInt16)", "domain": "tls_cryptographic", "priority": 225},
    {"name": "tls_alpn_negotiated", "type": "LowCardinality(String)", "domain": "tls_cryptographic", "priority": 242},
    {"name": "tls_alpn_advertised_count", "type": "UInt8", "domain": "tls_cryptographic", "priority": 210},
    {"name": "tls_session_resumption_type", "type": "LowCardinality(String)", "domain": "tls_cryptographic", "priority": 212},
    {"name": "tls_session_ticket_length", "type": "UInt16", "domain": "tls_cryptographic", "priority": 205},
    {"name": "tls_early_data_accepted", "type": "UInt8", "domain": "tls_cryptographic", "priority": 202},
    {"name": "tls_sni_matches_host", "type": "UInt8", "domain": "tls_cryptographic", "priority": 240},
    {"name": "tls_sni_entropy", "type": "Float32", "domain": "tls_cryptographic", "priority": 208},
    {"name": "tls_client_random_entropy", "type": "Float32", "domain": "tls_cryptographic", "priority": 204},
    {"name": "tls_cert_compression_algo", "type": "LowCardinality(String)", "domain": "tls_cryptographic", "priority": 195},
    {"name": "tls_key_share_group", "type": "UInt16", "domain": "tls_cryptographic", "priority": 190},
    {"name": "tls_psk_key_exchange_modes", "type": "UInt8", "domain": "tls_cryptographic", "priority": 188},
    {"name": "tls_supported_versions_count", "type": "UInt8", "domain": "tls_cryptographic", "priority": 185},
    {"name": "tls_grease_present", "type": "UInt8", "domain": "tls_cryptographic", "priority": 230},
    {"name": "tls_grease_cipher_id", "type": "UInt16", "domain": "tls_cryptographic", "priority": 180},
    {"name": "tls_grease_group_id", "type": "UInt16", "domain": "tls_cryptographic", "priority": 178},
    {"name": "tls_renegotiation_info_present", "type": "UInt8", "domain": "tls_cryptographic", "priority": 175},
    {"name": "tls_extended_master_secret", "type": "UInt8", "domain": "tls_cryptographic", "priority": 172},
    {"name": "tls_record_size_limit", "type": "UInt32", "domain": "tls_cryptographic", "priority": 170},
    {"name": "tls_certificate_status_req", "type": "UInt8", "domain": "tls_cryptographic", "priority": 168},
    {"name": "tls_heartbeat_enabled", "type": "UInt8", "domain": "tls_cryptographic", "priority": 165},
    {"name": "tls_signed_cert_timestamp", "type": "UInt8", "domain": "tls_cryptographic", "priority": 162},
    {"name": "tls_post_handshake_auth", "type": "UInt8", "domain": "tls_cryptographic", "priority": 160},
    {"name": "tls_delegated_credentials", "type": "UInt8", "domain": "tls_cryptographic", "priority": 158},
    {"name": "tls_handshake_latency_us", "type": "UInt32", "domain": "tls_cryptographic", "priority": 198},
    {"name": "tls_connection_reuse_depth", "type": "UInt16", "domain": "tls_cryptographic", "priority": 192},
    {"name": "tls_ocsp_stapling_requested", "type": "UInt8", "domain": "tls_cryptographic", "priority": 155},

    # Domain 2: TCP & Transport Layer (30 features)
    {"name": "tcp_syn_ack_rtt_us", "type": "UInt32", "domain": "tcp_transport", "priority": 244},
    {"name": "tcp_initial_window_size", "type": "UInt16", "domain": "tcp_transport", "priority": 238},
    {"name": "tcp_window_scaling_factor", "type": "UInt8", "domain": "tcp_transport", "priority": 232},
    {"name": "tcp_mss_declared", "type": "UInt16", "domain": "tcp_transport", "priority": 228},
    {"name": "tcp_mss_mtu_alignment", "type": "UInt8", "domain": "tcp_transport", "priority": 218},
    {"name": "tcp_ttl_observed", "type": "UInt8", "domain": "tcp_transport", "priority": 236},
    {"name": "tcp_ttl_hop_variance", "type": "UInt8", "domain": "tcp_transport", "priority": 222},
    {"name": "tcp_selective_ack_permitted", "type": "UInt8", "domain": "tcp_transport", "priority": 216},
    {"name": "tcp_sack_blocks_count", "type": "UInt8", "domain": "tcp_transport", "priority": 184},
    {"name": "tcp_timestamp_enabled", "type": "UInt8", "domain": "tcp_transport", "priority": 182},
    {"name": "tcp_timestamp_echo_rtt_us", "type": "UInt32", "domain": "tcp_transport", "priority": 186},
    {"name": "tcp_ecn_echo_flag", "type": "UInt8", "domain": "tcp_transport", "priority": 176},
    {"name": "tcp_congestion_notification", "type": "UInt8", "domain": "tcp_transport", "priority": 174},
    {"name": "tcp_fast_open_cookie_present", "type": "UInt8", "domain": "tcp_transport", "priority": 196},
    {"name": "tcp_retransmission_count", "type": "UInt16", "domain": "tcp_transport", "priority": 194},
    {"name": "tcp_duplicate_ack_ratio", "type": "Float32", "domain": "tcp_transport", "priority": 189},
    {"name": "tcp_out_of_order_packets", "type": "UInt16", "domain": "tcp_transport", "priority": 181},
    {"name": "tcp_zero_window_probes", "type": "UInt8", "domain": "tcp_transport", "priority": 179},
    {"name": "tcp_window_update_frequency", "type": "Float32", "domain": "tcp_transport", "priority": 169},
    {"name": "tcp_urg_pointer_zero", "type": "UInt8", "domain": "tcp_transport", "priority": 164},
    {"name": "tcp_rst_flag_seen", "type": "UInt8", "domain": "tcp_transport", "priority": 171},
    {"name": "tcp_fin_latency_ms", "type": "UInt32", "domain": "tcp_transport", "priority": 159},
    {"name": "tcp_paws_rejection_count", "type": "UInt8", "domain": "tcp_transport", "priority": 154},
    {"name": "tcp_flow_control_choke_events", "type": "UInt8", "domain": "tcp_transport", "priority": 152},
    {"name": "tcp_nagle_algorithm_active", "type": "UInt8", "domain": "tcp_transport", "priority": 150},
    {"name": "tcp_smoothed_rtt_us", "type": "UInt32", "domain": "tcp_transport", "priority": 206},
    {"name": "tcp_rtt_variance_us", "type": "UInt32", "domain": "tcp_transport", "priority": 201},
    {"name": "tcp_min_rtt_us", "type": "UInt32", "domain": "tcp_transport", "priority": 199},
    {"name": "tcp_buffer_bloat_factor", "type": "Float32", "domain": "tcp_transport", "priority": 148},
    {"name": "tcp_transport_anomaly_flags", "type": "UInt32", "domain": "tcp_transport", "priority": 214},

    # Domain 3: HTTP/2 & HTTP/3 Frame Protocol (35 features)
    {"name": "http_protocol_version", "type": "LowCardinality(String)", "domain": "http_frame_protocol", "priority": 251},
    {"name": "h2_settings_header_table_size", "type": "UInt32", "domain": "http_frame_protocol", "priority": 226},
    {"name": "h2_settings_enable_push", "type": "UInt8", "domain": "http_frame_protocol", "priority": 224},
    {"name": "h2_settings_max_concurrent_streams", "type": "UInt32", "domain": "http_frame_protocol", "priority": 219},
    {"name": "h2_settings_initial_window_size", "type": "UInt32", "domain": "http_frame_protocol", "priority": 221},
    {"name": "h2_settings_max_frame_size", "type": "UInt32", "domain": "http_frame_protocol", "priority": 217},
    {"name": "h2_settings_max_header_list_size", "type": "UInt32", "domain": "http_frame_protocol", "priority": 211},
    {"name": "h2_settings_order_hash", "type": "UInt64", "domain": "http_frame_protocol", "priority": 246},
    {"name": "h2_settings_pseudo_header_order_hash", "type": "UInt64", "domain": "http_frame_protocol", "priority": 247},
    {"name": "h2_window_update_interval_ms", "type": "Float32", "domain": "http_frame_protocol", "priority": 191},
    {"name": "h2_window_update_increment", "type": "UInt32", "domain": "http_frame_protocol", "priority": 187},
    {"name": "h2_stream_priority_weight", "type": "UInt16", "domain": "http_frame_protocol", "priority": 193},
    {"name": "h2_stream_exclusive_flag", "type": "UInt8", "domain": "http_frame_protocol", "priority": 183},
    {"name": "h2_stream_dependency_id", "type": "UInt32", "domain": "http_frame_protocol", "priority": 177},
    {"name": "h2_rst_stream_error_code", "type": "UInt32", "domain": "http_frame_protocol", "priority": 173},
    {"name": "h2_rst_stream_count", "type": "UInt16", "domain": "http_frame_protocol", "priority": 186},
    {"name": "h2_ping_rtt_us", "type": "UInt32", "domain": "http_frame_protocol", "priority": 167},
    {"name": "h2_ping_payload_randomness", "type": "Float32", "domain": "http_frame_protocol", "priority": 163},
    {"name": "h2_data_frame_fragmentation_ratio", "type": "Float32", "domain": "http_frame_protocol", "priority": 166},
    {"name": "h2_continuation_frame_count", "type": "UInt8", "domain": "http_frame_protocol", "priority": 161},
    {"name": "h2_hpack_compression_ratio", "type": "Float32", "domain": "http_frame_protocol", "priority": 197},
    {"name": "h2_hpack_dynamic_table_entries", "type": "UInt16", "domain": "http_frame_protocol", "priority": 157},
    {"name": "h2_multiplexed_streams_active", "type": "UInt16", "domain": "http_frame_protocol", "priority": 203},
    {"name": "h2_idle_stream_eviction_count", "type": "UInt16", "domain": "http_frame_protocol", "priority": 149},
    {"name": "h3_max_idle_timeout_ms", "type": "UInt32", "domain": "http_frame_protocol", "priority": 156},
    {"name": "h3_max_field_section_size", "type": "UInt32", "domain": "http_frame_protocol", "priority": 153},
    {"name": "h3_qpack_max_table_capacity", "type": "UInt32", "domain": "http_frame_protocol", "priority": 151},
    {"name": "h3_qpack_blocked_streams", "type": "UInt16", "domain": "http_frame_protocol", "priority": 147},
    {"name": "h3_ack_delay_exponent", "type": "UInt8", "domain": "http_frame_protocol", "priority": 145},
    {"name": "h3_active_connection_id_limit", "type": "UInt8", "domain": "http_frame_protocol", "priority": 144},
    {"name": "h3_quic_packet_number_variance", "type": "Float32", "domain": "http_frame_protocol", "priority": 142},
    {"name": "h3_datagram_frame_accepted", "type": "UInt8", "domain": "http_frame_protocol", "priority": 140},
    {"name": "h3_grease_frame_seen", "type": "UInt8", "domain": "http_frame_protocol", "priority": 209},
    {"name": "h3_stream_reset_ratio", "type": "Float32", "domain": "http_frame_protocol", "priority": 146},
    {"name": "h2_frame_anomaly_score", "type": "Float32", "domain": "http_frame_protocol", "priority": 227},

    # Domain 4: Header & Request Entropy (35 features)
    {"name": "header_count", "type": "UInt16", "domain": "header_entropy", "priority": 229},
    {"name": "header_order_hash", "type": "UInt64", "domain": "header_entropy", "priority": 249},
    {"name": "header_case_permutation_hash", "type": "UInt64", "domain": "header_entropy", "priority": 243},
    {"name": "header_name_entropy", "type": "Float32", "domain": "header_entropy", "priority": 213},
    {"name": "header_value_entropy", "type": "Float32", "domain": "header_entropy", "priority": 207},
    {"name": "header_user_agent_hash", "type": "UInt64", "domain": "header_entropy", "priority": 252},
    {"name": "header_user_agent_entropy", "type": "Float32", "domain": "header_entropy", "priority": 195},
    {"name": "header_accept_encoding_hash", "type": "UInt64", "domain": "header_entropy", "priority": 231},
    {"name": "header_accept_language_order_hash", "type": "UInt64", "domain": "header_entropy", "priority": 233},
    {"name": "header_accept_language_qvalue_variance", "type": "Float32", "domain": "header_entropy", "priority": 185},
    {"name": "header_accept_mime_order_hash", "type": "UInt64", "domain": "header_entropy", "priority": 223},
    {"name": "header_authorization_type", "type": "LowCardinality(String)", "domain": "header_entropy", "priority": 200},
    {"name": "header_cookie_count", "type": "UInt16", "domain": "header_entropy", "priority": 193},
    {"name": "header_cookie_name_order_hash", "type": "UInt64", "domain": "header_entropy", "priority": 215},
    {"name": "header_cookie_entropy", "type": "Float32", "domain": "header_entropy", "priority": 191},
    {"name": "header_sec_ch_ua_hash", "type": "UInt64", "domain": "header_entropy", "priority": 239},
    {"name": "header_sec_fetch_dest", "type": "LowCardinality(String)", "domain": "header_entropy", "priority": 237},
    {"name": "header_sec_fetch_mode", "type": "LowCardinality(String)", "domain": "header_entropy", "priority": 234},
    {"name": "header_sec_fetch_site", "type": "LowCardinality(String)", "domain": "header_entropy", "priority": 241},
    {"name": "header_sec_fetch_user", "type": "UInt8", "domain": "header_entropy", "priority": 205},
    {"name": "header_referrer_entropy", "type": "Float32", "domain": "header_entropy", "priority": 175},
    {"name": "header_origin_matches_host", "type": "UInt8", "domain": "header_entropy", "priority": 225},
    {"name": "header_cors_preflight_present", "type": "UInt8", "domain": "header_entropy", "priority": 171},
    {"name": "header_x_forwarded_for_count", "type": "UInt8", "domain": "header_entropy", "priority": 217},
    {"name": "header_range_request_declared", "type": "UInt8", "domain": "header_entropy", "priority": 167},
    {"name": "header_te_trailers_declared", "type": "UInt8", "domain": "header_entropy", "priority": 163},
    {"name": "header_upgrade_insecure_requests", "type": "UInt8", "domain": "header_entropy", "priority": 179},
    {"name": "header_dnt_signal", "type": "UInt8", "domain": "header_entropy", "priority": 143},
    {"name": "header_unknown_custom_count", "type": "UInt8", "domain": "header_entropy", "priority": 187},
    {"name": "header_pseudo_path_entropy", "type": "Float32", "domain": "header_entropy", "priority": 199},
    {"name": "header_query_param_entropy", "type": "Float32", "domain": "header_entropy", "priority": 189},
    {"name": "header_query_param_count", "type": "UInt16", "domain": "header_entropy", "priority": 183},
    {"name": "header_body_content_length", "type": "UInt64", "domain": "header_entropy", "priority": 177},
    {"name": "header_content_type_hash", "type": "UInt64", "domain": "header_entropy", "priority": 197},
    {"name": "header_entropy_heuristic_score", "type": "Float32", "domain": "header_entropy", "priority": 220},

    # Domain 5: IP & BGP Network Reputation (35 features)
    {"name": "net_asn", "type": "UInt32", "domain": "network_reputation", "priority": 253},
    {"name": "net_as_organization_tier", "type": "UInt8", "domain": "network_reputation", "priority": 245},
    {"name": "net_bgp_prefix_length", "type": "UInt8", "domain": "network_reputation", "priority": 201},
    {"name": "net_bgp_route_flap_rate", "type": "Float32", "domain": "network_reputation", "priority": 197},
    {"name": "net_bgp_as_path_length", "type": "UInt8", "domain": "network_reputation", "priority": 187},
    {"name": "net_bgp_origin_stability", "type": "Float32", "domain": "network_reputation", "priority": 185},
    {"name": "net_residential_proxy_score", "type": "Float32", "domain": "network_reputation", "priority": 249},
    {"name": "net_datacenter_egress_probability", "type": "Float32", "domain": "network_reputation", "priority": 248},
    {"name": "net_vpn_provider_token", "type": "LowCardinality(String)", "domain": "network_reputation", "priority": 242},
    {"name": "net_tor_exit_node", "type": "UInt8", "domain": "network_reputation", "priority": 251},
    {"name": "net_i2p_relay_flag", "type": "UInt8", "domain": "network_reputation", "priority": 239},
    {"name": "net_cidr_subnet_anomaly_score", "type": "Float32", "domain": "network_reputation", "priority": 229},
    {"name": "net_geo_country_code", "type": "FixedString(2)", "domain": "network_reputation", "priority": 221},
    {"name": "net_geo_region_asn_alignment", "type": "UInt8", "domain": "network_reputation", "priority": 207},
    {"name": "net_ip_reputation_tier", "type": "UInt8", "domain": "network_reputation", "priority": 247},
    {"name": "net_ip_history_abuse_reports", "type": "UInt32", "domain": "network_reputation", "priority": 227},
    {"name": "net_reverse_dns_match_domain", "type": "UInt8", "domain": "network_reputation", "priority": 219},
    {"name": "net_reverse_dns_entropy", "type": "Float32", "domain": "network_reputation", "priority": 179},
    {"name": "net_port_scan_history_score", "type": "Float32", "domain": "network_reputation", "priority": 203},
    {"name": "net_client_subnet_slash24_density", "type": "UInt32", "domain": "network_reputation", "priority": 211},
    {"name": "net_request_velocity_1s", "type": "UInt32", "domain": "network_reputation", "priority": 237},
    {"name": "net_request_velocity_10s", "type": "UInt32", "domain": "network_reputation", "priority": 235},
    {"name": "net_request_velocity_60s", "type": "UInt32", "domain": "network_reputation", "priority": 233},
    {"name": "net_burst_concurrency_ratio", "type": "Float32", "domain": "network_reputation", "priority": 223},
    {"name": "net_tcp_anycast_colo_hop_count", "type": "UInt8", "domain": "network_reputation", "priority": 173},
    {"name": "net_colo_distance_km", "type": "Float32", "domain": "network_reputation", "priority": 169},
    {"name": "net_egress_mtu_probe_result", "type": "UInt16", "domain": "network_reputation", "priority": 161},
    {"name": "net_dns_resolution_rtt_us", "type": "UInt32", "domain": "network_reputation", "priority": 175},
    {"name": "net_dns_resolver_asn_matches_client", "type": "UInt8", "domain": "network_reputation", "priority": 205},
    {"name": "net_edns_client_subnet_present", "type": "UInt8", "domain": "network_reputation", "priority": 191},
    {"name": "net_icmp_reachability_flags", "type": "UInt8", "domain": "network_reputation", "priority": 155},
    {"name": "net_hop_latency_jitter_us", "type": "UInt32", "domain": "network_reputation", "priority": 181},
    {"name": "net_bogons_filter_passed", "type": "UInt8", "domain": "network_reputation", "priority": 243},
    {"name": "net_autonomous_system_cone_size", "type": "UInt32", "domain": "network_reputation", "priority": 165},
    {"name": "net_ip_threat_vector_score", "type": "Float32", "domain": "network_reputation", "priority": 250},

    # Domain 6: Client Hints & Behavioral Signals (30 features)
    {"name": "client_device_memory_gb", "type": "UInt8", "domain": "client_behavioral", "priority": 204},
    {"name": "client_hardware_concurrency", "type": "UInt8", "domain": "client_behavioral", "priority": 208},
    {"name": "client_screen_pixel_ratio", "type": "Float32", "domain": "client_behavioral", "priority": 192},
    {"name": "client_screen_aspect_ratio", "type": "Float32", "domain": "client_behavioral", "priority": 188},
    {"name": "client_screen_color_depth", "type": "UInt8", "domain": "client_behavioral", "priority": 178},
    {"name": "client_touch_event_support", "type": "UInt8", "domain": "client_behavioral", "priority": 216},
    {"name": "client_touch_points_max", "type": "UInt8", "domain": "client_behavioral", "priority": 184},
    {"name": "client_canvas_winding_hash", "type": "UInt64", "domain": "client_behavioral", "priority": 224},
    {"name": "client_webgl_vendor_hash", "type": "UInt64", "domain": "client_behavioral", "priority": 226},
    {"name": "client_webgl_renderer_hash", "type": "UInt64", "domain": "client_behavioral", "priority": 228},
    {"name": "client_audio_latency_variance", "type": "Float32", "domain": "client_behavioral", "priority": 212},
    {"name": "client_audio_oscillator_hash", "type": "UInt64", "domain": "client_behavioral", "priority": 214},
    {"name": "client_speech_voices_count", "type": "UInt16", "domain": "client_behavioral", "priority": 174},
    {"name": "client_plugins_length", "type": "UInt16", "domain": "client_behavioral", "priority": 172},
    {"name": "client_battery_charging_flag", "type": "UInt8", "domain": "client_behavioral", "priority": 146},
    {"name": "client_battery_level", "type": "Float32", "domain": "client_behavioral", "priority": 144},
    {"name": "client_connection_effective_type", "type": "LowCardinality(String)", "domain": "client_behavioral", "priority": 196},
    {"name": "client_connection_downlink_mbps", "type": "Float32", "domain": "client_behavioral", "priority": 182},
    {"name": "client_connection_rtt_ms", "type": "UInt32", "domain": "client_behavioral", "priority": 190},
    {"name": "client_save_data_header", "type": "UInt8", "domain": "client_behavioral", "priority": 148},
    {"name": "client_math_precision_hash", "type": "UInt64", "domain": "client_behavioral", "priority": 180},
    {"name": "client_error_stack_trace_entropy", "type": "Float32", "domain": "client_behavioral", "priority": 186},
    {"name": "client_navigator_webdriver_flag", "type": "UInt8", "domain": "client_behavioral", "priority": 254},
    {"name": "client_headless_chrome_score", "type": "Float32", "domain": "client_behavioral", "priority": 252},
    {"name": "client_automation_prototype_tampered", "type": "UInt8", "domain": "client_behavioral", "priority": 250},
    {"name": "client_js_execution_quantum_jitter_us", "type": "UInt32", "domain": "client_behavioral", "priority": 210},
    {"name": "client_event_loop_latency_ms", "type": "Float32", "domain": "client_behavioral", "priority": 198},
    {"name": "client_mouse_trajectory_curvature", "type": "Float32", "domain": "client_behavioral", "priority": 218},
    {"name": "client_keystroke_interarrival_variance", "type": "Float32", "domain": "client_behavioral", "priority": 202},
    {"name": "client_behavioral_ml_anomaly_score", "type": "Float32", "domain": "client_behavioral", "priority": 246},
]


def is_clickhouse_alive(base_url: str = "http://localhost:8123") -> bool:
    """
    Check if a ClickHouse HTTP server is responding to health pings.
    Returns False immediately if the endpoint is unreachable or times out.
    """
    try:
        req = urllib.request.Request(f"{base_url.rstrip('/')}/ping", method="GET")
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            return resp.status == 200
    except Exception:
        return False


def bootstrap_clickhouse(base_url: str = "http://localhost:8123") -> bool:
    """
    Initialize ClickHouse schemas if they do not yet exist on the target server.
    Applies migrations/001_bot_signals.sql and migrations/002_shard_definitions.sql over HTTP.
    """
    migrations_dir = Path(__file__).resolve().parent.parent.parent / "migrations"
    migration_files = [
        migrations_dir / "001_bot_signals.sql",
        migrations_dir / "002_shard_definitions.sql",
    ]
    for sql_file in migration_files:
        if not sql_file.exists():
            continue
        sql_content = sql_file.read_text(encoding="utf-8")
        statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]
        for stmt in statements:
            if not stmt:
                continue
            req = urllib.request.Request(
                f"{base_url.rstrip('/')}/",
                data=stmt.encode("utf-8"),
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=5.0):
                    pass
            except Exception:
                # Statements may fail if databases or tables are already initialized
                pass
    return True


def query_clickhouse_catalog(
    simulate_duplication: bool = False,
    base_url: str = "http://localhost:8123",
) -> List[Dict[str, Any]]:
    """
    Execute schema reflection directly against ClickHouse virtual system.columns catalog.

    When simulate_duplication is False (canonical invariant satisfied):
        Query: SELECT database, table, name, type FROM system.columns
               WHERE table = 'events' AND database = 'bot_signals';
        Returns: 200 canonical features.

    When simulate_duplication is True (unqualified query defect):
        Query: SELECT database, table, name, type FROM system.columns
               WHERE table LIKE 'events%';
        Returns: 280 features (200 canonical + 80 replicated shard shadow columns).
    """
    meta_lookup = {col["name"]: col for col in CANONICAL_FEATURES_200}

    if not simulate_duplication:
        sql = """
        SELECT database, table, name, type
        FROM system.columns
        WHERE table = 'events'
          AND database = 'bot_signals'
          AND name NOT IN ('event_id', 'timestamp', 'zone_id', 'request_id')
        ORDER BY name
        FORMAT JSON
        """
    else:
        sql = """
        SELECT database, table, name, type
        FROM system.columns
        WHERE table LIKE 'events%'
          AND name NOT IN ('event_id', 'timestamp', 'zone_id', 'request_id')
        ORDER BY database, table, name
        FORMAT JSON
        """

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/",
        data=sql.strip().encode("utf-8"),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        rows = data.get("data", [])

    records: List[Dict[str, Any]] = []
    shard_count = 0

    for r in rows:
        name = r["name"]
        db = r["database"]
        tbl = r["table"]
        col_type = r["type"]

        if db == "bot_signals" and tbl == "events":
            meta = meta_lookup.get(name, {})
            records.append({
                "database": db,
                "table": tbl,
                "name": name,
                "type": col_type,
                "domain": meta.get("domain", "unclassified"),
                "priority": meta.get("priority", 50),
                "is_shadow": False,
            })
        elif simulate_duplication and shard_count < 80:
            meta = meta_lookup.get(name, {})
            records.append({
                "database": db,
                "table": tbl,
                "name": f"shard_{tbl}_{name}",
                "type": col_type,
                "domain": meta.get("domain", "unclassified"),
                "priority": 0,
                "is_shadow": True,
            })
            shard_count += 1

    return records


def sync_catalog(
    simulate_duplication: bool = False,
    live_db: bool = False,
    clickhouse_url: str = "http://localhost:8123",
) -> List[Dict[str, Any]]:
    """
    Synchronize catalog metadata from ClickHouse system.columns.

    Architecture Note: Dual-Mode Execution
    --------------------------------------
    1. Live ClickHouse Mode (live_db=True):
       Connects to a running ClickHouse daemon over HTTP port 8123.
       Applies migrations if needed and executes real system.columns queries.
       Used in environments with Docker or local ClickHouse installed.

    2. Deterministic Offline Mode (Default / Fallback):
       Uses the embedded canonical 200-feature catalog fixture.
       Ensures that unit tests, CI testbeds, and local evaluation execute
       reliably without requiring background database daemons.
    """
    if live_db:
        if is_clickhouse_alive(clickhouse_url):
            try:
                bootstrap_clickhouse(clickhouse_url)
                records = query_clickhouse_catalog(
                    simulate_duplication=simulate_duplication,
                    base_url=clickhouse_url,
                )
                sys.stderr.write(
                    f"[catalog_sync] Live mode: queried ClickHouse system.columns at {clickhouse_url} "
                    f"(returned {len(records)} columns)\n"
                )
                return records
            except Exception as err:
                sys.stderr.write(
                    f"[catalog_sync] Live ClickHouse query failed: {err}; "
                    f"falling back to offline schema catalog\n"
                )
        else:
            sys.stderr.write(
                f"[catalog_sync] ClickHouse endpoint not reachable at {clickhouse_url}; "
                f"falling back to offline schema catalog\n"
            )

    # Deterministic offline mode
    records = []
    for col in CANONICAL_FEATURES_200:
        records.append({
            "database": "bot_signals",
            "table": "events",
            "name": col["name"],
            "type": col["type"],
            "domain": col["domain"],
            "priority": col["priority"],
            "is_shadow": False,
        })

    if simulate_duplication:
        for idx in range(80):
            base_col = CANONICAL_FEATURES_200[idx]
            shard_name = "events_r0" if idx < 40 else "events_r1"
            db_name = "bot_signals_shard_01" if idx < 40 else "bot_signals_shard_02"
            records.append({
                "database": db_name,
                "table": shard_name,
                "name": f"shard_{shard_name}_{base_col['name']}",
                "type": base_col["type"],
                "domain": base_col["domain"],
                "priority": 0,
                "is_shadow": True,
            })

    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Cloudflame ClickHouse Catalog Metadata Sync")
    parser.add_argument(
        "--simulate-duplication",
        action="store_true",
        help="Simulate unqualified query returning 280 entries (200 canonical + 80 shard duplicates)",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Simulate qualified query returning exactly 200 canonical entries",
    )
    parser.add_argument(
        "--live-clickhouse",
        action="store_true",
        help="Query live ClickHouse instance via HTTP instead of using offline catalog",
    )
    parser.add_argument(
        "--clickhouse-url",
        default="http://localhost:8123",
        help="ClickHouse HTTP endpoint URL (default: http://localhost:8123)",
    )
    args = parser.parse_args()

    simulate = args.simulate_duplication and not args.clean
    results = sync_catalog(
        simulate_duplication=simulate,
        live_db=args.live_clickhouse,
        clickhouse_url=args.clickhouse_url,
    )

    sys.stdout.write(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
