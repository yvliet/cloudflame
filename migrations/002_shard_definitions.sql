-- ============================================================================
-- Migration: 002_shard_definitions.sql
-- Service: Cloudflame Edge Security Analytics & Shard Replication
-- Description: Declares cluster shard replica tables (events_r0, events_r1)
--              illustrating cross-boundary schema duplication during metadata
--              reflection when database predicates are omitted.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bot_signals_shard_01;
CREATE DATABASE IF NOT EXISTS bot_signals_shard_02;

-- Shard 01 Replica Table (r0)
-- Configured with MergeTree for single-node cluster simulation
CREATE TABLE IF NOT EXISTS bot_signals_shard_01.events_r0 AS bot_signals.events
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (zone_id, toDate(timestamp), net_asn, event_id);

-- Shard 02 Replica Table (r1)
-- Configured with MergeTree for single-node cluster simulation
CREATE TABLE IF NOT EXISTS bot_signals_shard_02.events_r1 AS bot_signals.events
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (zone_id, toDate(timestamp), net_asn, event_id);

-- ----------------------------------------------------------------------------
-- Catalog Reflection Contract:
-- Upstream schema reflection MUST be scoped to the canonical source table only.
-- Qualified query (enforced):
--   SELECT name, type FROM system.columns
--   WHERE table = 'events' AND database = 'bot_signals';
-- This ensures exactly 200 canonical feature columns are projected downstream,
-- preventing shard replica columns (events_r0, events_r1) from leaking across
-- database boundaries and inflating the feature payload beyond MAX_ACTIVE_FEATURES.
-- ----------------------------------------------------------------------------
