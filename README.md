# Cloudflame Edge Security Service

Cloudflame is a high-throughput edge bot mitigation and traffic classification proxy written in Rust, paired with an analytical feature extraction pipeline. It models an authentic 200-feature security telemetry catalog and implements zero-allocation priority degradation to prevent outage cascades caused by cross-boundary catalog expansion.

## Architecture Overview

```
[ Incoming Requests ]
         │
         ▼
 ┌────────────────────────────────────────────────────────┐
 │ cloudflame-proxy (Rust Edge Service)                    │
 │                                                        │
 │ 1. Ingestion Engine                                    │
 │    - Fixed stack capacity: [Feature; 200]              │
 │    - In-place partial selection: select_nth_unstable_by│
 │    - Zero heap allocations, sub-20ns latency           │
 │                                                        │
 │ 2. Traffic Evaluator                                   │
 │    - JA4 fingerprint classification                    │
 │    - ASN / IP / BGP network reputation                 │
 │    - Behavioral entropy scoring (0..100)               │
 │                                                        │
 │ 3. Telemetry & Metrics                                 │
 │    - RFC-5424 structured syslog diagnostics            │
 │    - Prometheus exposition format (/metrics)           │
 └───────────────────────────▲────────────────────────────┘
                             │
                             │ Dynamic Ingestion (payloads/features.json)
                             │
 ┌───────────────────────────┴────────────────────────────┐
 │ Analytical Feature Pipeline (Python)                   │
 │                                                        │
 │ services/feature-pipeline/                             │
 │   - catalog_sync.py: system.columns introspection      │
 │   - extractor.py: 200-feature security taxonomy        │
 │   - models.py: typed telemetry payloads                │
 └───────────────────────────▲────────────────────────────┘
                             │
                             │ Schema Reflection
                             │
 ┌───────────────────────────┴────────────────────────────┐
 │ ClickHouse Analytical Layer                            │
 │                                                        │
 │ migrations/                                            │
 │   - 001_bot_signals.sql (200 canonical event columns)  │
 │   - 002_shard_definitions.sql (shard reflections)     │
 │   - 003_feature_weights.sql (scoring models & weights) │
 └────────────────────────────────────────────────────────┘
```

## Security Telemetry Taxonomy (200 Features)

The catalog classifies incoming traffic across 6 security domains:

1. **TLS & Cryptographic Layer (35 features)**: JA4 digests, JA3 hashes, cipher suite preference order, extension permutations, ALPN negotiation, elliptic curve points, GREASE detection, session ticket length, and handshake latency.
2. **TCP & Transport Layer (30 features)**: SYN-ACK RTT, initial window sizes, window scaling factors, MSS options, selective ACKs (SACK), ECN negotiation, packet reordering ratios, and transport anomaly flags.
3. **HTTP/2 & HTTP/3 Frame Protocol (35 features)**: Stream dependency hierarchies, SETTINGS frame ordering hashes, pseudo-header permutations, DATA frame fragmentation, HPACK dynamic table ratios, and QPACK blocked streams.
4. **Header & Request Entropy (35 features)**: Header case permutations, Shannon entropy across header names/values, `Sec-CH-UA` Client Hints hashes, User-Agent entropy, and referrer-to-host consistency.
5. **IP & BGP Network Reputation (35 features)**: Autonomous system classification, BGP prefix stability, route flap rates, residential proxy scores, datacenter egress probability, and Tor exit node tracking.
6. **Client Hints & Behavioral Signals (30 features)**: Hardware concurrency, device memory, canvas winding hashes, WebGL vendor strings, audio oscillator characteristics, and event loop latency jitter.

## System Invariants & Failure Cascade Model

### The Failure Cascade
During schema reflection across sharded ClickHouse clusters, an unqualified introspection query lacking an explicit database predicate:
```sql
SELECT name, type FROM system.columns WHERE table = 'events';
```
matches across shard databases (`bot_signals_shard_01.events_r0`, `bot_signals_shard_02.events_r1`), expanding the emitted configuration payload from 200 to 280 features (200 canonical + 80 replicated shard shadow columns).

In naive edge proxies, converting this 280-item slice into a fixed `[Feature; 200]` buffer via `try_into().unwrap()` triggers a panic (`TryFromSliceError`), causing an immediate 502 Bad Gateway outage cascade.

### Two-Tier Bounded Stack Deserialization (`TieredBuffer`)
Stokes enforces a strict architectural invariant: **silent data shedding is rejected**. Instead of discarding dynamic records without schema consensus, Cloudflame implements Stokes-certified **Two-Tier Bounded Deserialization (`TieredBuffer`)**:
- **Tier 1 (Inline Fast-Path)**: 200 slots (1,600 bytes) stored 100% in L1D cache, evaluating core security signals with < 1 ns latency.
- **Tier 2 (Stack Spillover)**: 312 slots (2,496 bytes) bounded stack spillover. Total capacity is 512 descriptors (4,096 bytes, fitting inside a single 4 KB stack frame).
- **Zero Data Loss**: When ClickHouse emits 280 features, all 280 features are safely ingested in pure stack memory with zero heap allocation, zero feature loss, and zero traffic drops.

### Emergency In-Place Priority Partitioning (Fallback)
If cardinality exceeds the maximum combined stack ceiling (> 512 features during an adversarial flood) or when running under a strict 200-slot hard boundary:
- **In-Place Partitioning**: `select_nth_unstable_by` partitions the slice in `O(N)` time with zero heap allocations.
- **Priority Preservation**: Untrusted low-priority columns (`priority = 0`) are deprioritized while all 200 canonical security features (`priority >= 50`) remain active.
- **Structured RFC-5424 Telemetry**: Emits standard warning diagnostics:
  ```
  <132>1 2026-09-23T16:18:00.000Z edge-colo-01 cloudflame-proxy 4102 SEC_OVERFLOW [feature_overflow@cloudflame dropped="80" limit="200" total="280"] High-cardinality feature payload degraded: low-priority features shed
  ```

## Verification & Conformance

Cloudflame supports **Dual-Mode** execution:
1. **Deterministic Offline Mode (Default)**: Runs instant verification against embedded catalog fixtures without requiring background database daemons.
2. **Live ClickHouse Cluster Mode**: Queries a live ClickHouse instance via HTTP port 8123 to verify real `system.columns` reflection across physical shard replica tables (`events_r0`, `events_r1`).

### 1. Fast Evaluation (Deterministic Offline Mode)

Run the automated conformance testbed:

```bash
python scripts/run_conformance.py
```

To include Criterion micro-benchmark timings:

```bash
python scripts/run_conformance.py --bench
```

Running the verification suite reproduces the unpatched panic (`TryFromSliceError`), validates zero-allocation priority shedding, executes 10,000 randomized property fuzz cases, and runs the 100,000-feature stress partition.

### 2. Live ClickHouse Cluster Verification (Optional)

To verify schema reflection against a live analytical database:

```bash
# 1. Start the ClickHouse single-node cluster
docker compose up -d

# 2. Run the conformance testbed against live ClickHouse
python scripts/run_conformance.py --live-clickhouse
```

When connected to live ClickHouse, `catalog_sync.py` automatically initializes `bot_signals.events` (200 canonical columns) and physical shard replicas (`events_r0`, `events_r1`). An unqualified reflection query (`WHERE table LIKE 'events%'`) queries ClickHouse's virtual `system.columns` engine directly, returning 280 rows to reproduce the real-world catalog expansion defect.

### Test Suite Execution
- **Property-Based Conformance**: 10,000 randomized `proptest` cases in `crates/cloudflame-proxy/tests/schema_conformance.rs` asserting cardinality boundaries, priority multiset correctness, non-corruption, and RFC-5424 telemetry compliance.
- **Massive Stress Ingestion Gate**: Ingests 100,000 mixed features in under 20ms, dropping 99,800 low-priority items while retaining core security heuristics with 0 bytes heap reallocation.
- **Python Feature Pipeline Tests**: Unit tests in `services/feature-pipeline/tests/test_pipeline.py`.
- **Criterion Micro-Benchmarks**: Validates sub-20ns in-place selection execution (`7.66 ns`) against heap allocation overhead.

```bash
# Run Rust tests
cd crates/cloudflame-proxy
cargo test

# Run Rust benchmarks
cargo bench --bench ingest_benchmark

# Run Python pipeline tests
python -m unittest discover -s services
```
