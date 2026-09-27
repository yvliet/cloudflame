//! Cloudflame Prometheus Metric Formatter
//!
//! Emits edge telemetry conforming to the Prometheus exposition text format.

use crate::engine::feature_ingest::IngestionReport;

/// Metrics collector and formatter for Cloudflame edge proxy configuration state.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PrometheusMetrics {
    pub features_total: usize,
    pub features_active: usize,
    pub features_degraded_total: usize,
}

impl PrometheusMetrics {
    /// Construct metrics state from an ingestion execution report.
    pub fn from_ingestion(report: &IngestionReport) -> Self {
        Self {
            features_total: report.total_ingested,
            features_active: report.active_count,
            features_degraded_total: report.dropped_count,
        }
    }

    /// Render exposition payload conforming to Prometheus text format 0.0.4.
    pub fn render_prometheus_text(&self) -> String {
        let mut buffer = String::with_capacity(512);

        // Metric 1: cloudflame_features_total (Gauge)
        buffer.push_str("# HELP cloudflame_features_total Total features ingested from external dynamic configuration.\n");
        buffer.push_str("# TYPE cloudflame_features_total gauge\n");
        buffer.push_str(&format!(
            "cloudflame_features_total{{environment=\"edge\",service=\"cloudflame-proxy\"}} {}\n",
            self.features_total
        ));

        // Metric 2: cloudflame_features_active (Gauge)
        buffer.push_str("# HELP cloudflame_features_active Current count of active evaluated features.\n");
        buffer.push_str("# TYPE cloudflame_features_active gauge\n");
        buffer.push_str(&format!(
            "cloudflame_features_active{{environment=\"edge\",service=\"cloudflame-proxy\"}} {}\n",
            self.features_active
        ));

        // Metric 3: cloudflame_features_degraded_total (Counter)
        buffer.push_str("# HELP cloudflame_features_degraded_total Cumulative count of features dropped by priority degradation.\n");
        buffer.push_str("# TYPE cloudflame_features_degraded_total counter\n");
        buffer.push_str(&format!(
            "cloudflame_features_degraded_total{{environment=\"edge\",service=\"cloudflame-proxy\",reason=\"overflow\"}} {}\n",
            self.features_degraded_total
        ));

        buffer
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prometheus_formatting() {
        let metrics = PrometheusMetrics {
            features_total: 240,
            features_active: 200,
            features_degraded_total: 40,
        };

        let output = metrics.render_prometheus_text();
        assert!(output.contains("# TYPE cloudflame_features_total gauge"));
        assert!(output.contains("cloudflame_features_total{environment=\"edge\",service=\"cloudflame-proxy\"} 240"));
        assert!(output.contains("# TYPE cloudflame_features_active gauge"));
        assert!(output.contains("cloudflame_features_active{environment=\"edge\",service=\"cloudflame-proxy\"} 200"));
        assert!(output.contains("# TYPE cloudflame_features_degraded_total counter"));
        assert!(output.contains("cloudflame_features_degraded_total{environment=\"edge\",service=\"cloudflame-proxy\",reason=\"overflow\"} 40"));
    }
}
