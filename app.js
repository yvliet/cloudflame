/**
 * Cloudflame Edge Security Service: System Status Controller (formerly Dirichlet)
 */

// Application State
let currentSystemState = "nominal"; // 'nominal' | 'break' | 'recover'
let activeTab = "overview";
let activeTheme = "dark";
let useUtc = false;

// Restore saved preferences from localStorage
try {
  const savedTheme = localStorage.getItem("dirichlet_theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    activeTheme = savedTheme;
  }
  const savedTz = localStorage.getItem("dirichlet_timezone");
  if (savedTz === "utc") {
    useUtc = true;
  } else if (savedTz === "local") {
    useUtc = false;
  }
} catch (e) {}

// Telemetry & Metrics Data (Turso backend snapshot)
const DEFAULT_METRICS = Array.from({ length: 60 }, (_, i) => {
  const date = new Date(Date.now() - (60 - i) * 5 * 60 * 1000);
  return {
    id: i + 1,
    timestamp: date.toISOString(),
    p99_latency_ms: Number((1.18 + Math.sin(i / 5) * 0.08).toFixed(2)),
    traffic_rps: Math.round(52400 + Math.cos(i / 6) * 1200),
    active_signals: 200,
    dropped_signals: 0,
    system_status: "operational"
  };
});

let metricsData = [...DEFAULT_METRICS];
const DEFAULT_INCIDENTS = [
  {
    "id": "inc-2026-09-24-drift",
    "title": "L7 Edge Proxy Ingestion Panic (TryFromSliceError)",
    "service": "svc-fl2",
    "service_group": "group-proxy",
    "severity": "critical",
    "status": "resolved",
    "impact": "100% 502 Bad Gateway across edge PoPs during dynamic configuration reload",
    "root_cause": "system.columns multi-shard reflection expanded dynamic catalog to 280 features, breaching stack buffer [Feature; 200]",
    "started_at": "2026-09-24T11:28:06.041Z",
    "resolved_at": "2026-09-24T11:42:08.960Z",
    "updates": [
      {
        "time": "2026-09-24T11:42:08.960Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "In-place partial selection (select_nth_unstable_by) shed 80 shadow columns. All 200 core signals restored with 0 B heap reallocations. 100% edge traffic restored."
      },
      {
        "time": "2026-09-24T11:35:12.000Z",
        "status": "monitoring",
        "title": "Monitoring",
        "message": "Kernel memory and edge proxy daemon processes stabilized across canary PoPs. Edge latency returned to sub-1.2ms baseline."
      },
      {
        "time": "2026-09-24T11:31:40.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Identified cross-boundary schema drift: ClickHouse system.columns multi-shard reflection expanded dynamic catalog to 280 features, overflowing fixed stack buffer [Feature; 200]."
      },
      {
        "time": "2026-09-24T11:28:06.041Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Critical panic detected: L7 Edge Proxy Ingestion Panic (TryFromSliceError). Edge proxy non-responsive across all ingress points."
      }
    ]
  },
  {
    "id": "inc-2026-09-24-bgp",
    "title": "BGP Route Reflection Latency on Bring Your Own IP (BYOIP) Prefix Updates",
    "service": "svc-ip",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "15-minute propagation delay for customer IP prefix advertisements and withdrawals",
    "root_cause": "BGP route reflector peer group synchronization queue lag across core transit edge routers",
    "started_at": "2026-09-24T10:22:34.763Z",
    "resolved_at": "2026-09-24T10:38:52.106Z",
    "updates": [
      {
        "time": "2026-09-24T10:38:52.106Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Route reflector inbound queues cleared across Tier 1 transit peers. Prefix update convergence latency returned to normal parameters (< 30s)."
      },
      {
        "time": "2026-09-24T10:30:15.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Identified lock contention on internal ExaBGP rib-in worker threads during concurrent prefix map reloads."
      },
      {
        "time": "2026-09-24T10:22:34.763Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated propagation delay for customers modifying BYOIP prefix announcements and withdrawal policies."
      }
    ]
  },
  {
    "id": "inc-2026-09-24-auth",
    "title": "Intermittent authentication errors for API and R2",
    "service": "svc-api",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Minor error rate for scoped credential validation",
    "root_cause": "Key validation cache rebalancing latency on edge auth tier",
    "started_at": "2026-09-23T20:59:35.579Z",
    "resolved_at": "2026-09-23T22:44:32.859Z",
    "updates": [
      {
        "time": "2026-09-23T22:44:32.859Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Cache configuration redeployed and distributed to all regional edge auth caches. Error rates returned to baseline."
      },
      {
        "time": "2026-09-23T21:59:10.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Root cause identified in regional edge auth cache tier lease invalidation loop."
      },
      {
        "time": "2026-09-23T20:59:35.579Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated authentication failures and scoped token validation timeouts on API and R2 gateway."
      }
    ]
  },
  {
    "id": "inc-2026-09-23-auth",
    "title": "Intermittent Ed25519 Token Verification Latency on Edge Authentication Tier",
    "service": "svc-api",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "Sub-0.4% transient 401/403 validation timeouts on scoped API credentials",
    "root_cause": "Key validation cache rebalancing lease contention across regional edge auth workers",
    "started_at": "2026-09-23T20:59:35.579Z",
    "resolved_at": "2026-09-23T22:44:32.859Z",
    "updates": [
      {
        "time": "2026-09-23T22:44:32.859Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Cache lease refresh timeout adjusted and cryptographic public key store distributed to all regional edge nodes. Validation error rate returned to 0.00%."
      },
      {
        "time": "2026-09-23T21:59:10.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Isolated lease invalidation lock storm in regional edge auth cache tier during automated key rotation."
      },
      {
        "time": "2026-09-23T20:59:35.579Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated validation latency and token timeouts on edge API and R2 authorization gateway."
      }
    ]
  },
  {
    "id": "inc-2026-09-24-cache",
    "title": "Elevated Errors with any / all in http_response_cache_settings",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Edge rule evaluation syntax errors on combined predicate",
    "root_cause": "Parser regex boundary condition on nested array expressions",
    "started_at": "2026-09-23T17:14:32.859183+00:00",
    "resolved_at": "2026-09-23T18:04:32.859183+00:00",
    "updates": [
      {
        "time": "17:14 UTC",
        "status": "investigating",
        "message": "Monitoring increased customer rule evaluation exceptions."
      },
      {
        "time": "18:04 UTC",
        "status": "resolved",
        "message": "Rule compiler syntax patch distributed to all colo PoPs."
      }
    ]
  },
  {
    "id": "inc-2026-09-23-cache",
    "title": "Elevated Errors with any / all in http_response_cache_settings",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Edge rule evaluation syntax errors on combined predicate",
    "root_cause": "Parser regex boundary condition on nested array expressions in cache rule compiler",
    "started_at": "2026-09-23T15:54:28.000Z",
    "resolved_at": "2026-09-23T18:08:18.013Z",
    "updates": [
      {
        "time": "2026-09-23T18:08:18.013Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Rule compiler syntax patch distributed to all colo PoPs. Cache evaluation syntax errors resolved."
      },
      {
        "time": "2026-09-23T16:45:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Isolated syntax tokenizer edge case triggered by combined any/all predicates in http_response_cache_settings."
      },
      {
        "time": "2026-09-23T15:54:28.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Monitoring increased customer rule evaluation exceptions when modifying complex cache settings."
      }
    ]
  },
  {
    "id": "inc-2026-09-23-cache-stampede",
    "title": "Request Coalescing Mutex Contention under High-Velocity Cache Purge",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Transient 504 Gateway Timeouts and 3.2x origin request amplification on un-coalesced hot assets",
    "root_cause": "Singleflight request collapsing hash table lock contention during global wildcard purge, causing temporary origin pass-through",
    "started_at": "2026-09-23T15:54:28.000Z",
    "resolved_at": "2026-09-23T17:18:18.013Z",
    "updates": [
      {
        "time": "2026-09-23T17:18:18.013Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Fine-grained striped lock partitioning applied to request collapsing hash table. Singleflight coalescing restored across all edge ingress clusters."
      },
      {
        "time": "2026-09-23T16:45:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Customer wildcard purge API burst triggered lock convoy on global in-flight request deduplication mutex, allowing 2,400 concurrent misses to bypass shield."
      },
      {
        "time": "2026-09-23T15:54:28.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Observing transient origin connection spikes and 504 timeouts following sudden cache invalidation on dynamic news domains."
      }
    ]
  },
  {
    "id": "inc-2026-09-22-do",
    "title": "Distributed Lock Lease Expiry Contention for Durable Objects in US-EAST",
    "service": "svc-kv",
    "service_group": "group-storage",
    "severity": "major",
    "status": "resolved",
    "impact": "Object replication stalls and transient 503 retry storms on cross-region synchronized KV writes",
    "root_cause": "Raft consensus heartbeat jitter over transatlantic interconnect causing lock lease flapping",
    "started_at": "2026-09-22T11:14:32.859Z",
    "resolved_at": "2026-09-22T13:14:32.859Z",
    "updates": [
      {
        "time": "2026-09-22T13:14:32.859Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Consensus heartbeat timeout window broadened from 150ms to 450ms across inter-region WAN links. Durable Object replication queues drained to zero."
      },
      {
        "time": "2026-09-22T12:05:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "WAN packet loss burst between Ashburn (IAD) and London (LHR) induced repeated Raft leader re-elections for partitioned storage shards."
      },
      {
        "time": "2026-09-22T11:14:32.859Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating replication delays and distributed lock acquisition failures for multi-region stateful edge worker instances."
      }
    ]
  },
  {
    "id": "inc-2026-09-21-r2-au",
    "title": "Elevated Edge Gateway 503 Errors in Australian Eastern Coast Region",
    "service": "svc-fl2",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "Transient 503 errors on object storage fetches in Sydney and Melbourne POPs",
    "root_cause": "Subsea fiber cable maintenance caused upstream gateway congestion and route flapping on Sydney (SYD) interconnects",
    "started_at": "2026-09-21T09:12:00.000Z",
    "resolved_at": "2026-09-21T11:25:00.000Z",
    "updates": [
      {
        "time": "2026-09-21T11:25:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Anycast BGP weightings re-balanced to route traffic over redundant trans-Tasman routes. Gateway 503 error rates dropped back to zero."
      },
      {
        "time": "2026-09-21T10:02:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Transit carrier maintenance on Southern Cross Cable triggered packet drop bursts and TCP connection resets on Sydney upstream interfaces."
      },
      {
        "time": "2026-09-21T09:12:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating transient 503 service unavailable errors affecting R2 object downloads in Australia and New Zealand."
      }
    ]
  },
  {
    "id": "inc-2026-09-20-dns",
    "title": "BGP Prefix Synchronization Lag on 1.1.1.1 Resolver Policy Blocklists",
    "service": "svc-hints",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "Intermittent policy evaluation bypass for malware and threat category filtering",
    "root_cause": "Blocklist distribution daemon socket timeout on secondary Anycast distribution rings",
    "started_at": "2026-09-20T07:15:00.000Z",
    "resolved_at": "2026-09-20T08:26:00.000Z",
    "updates": [
      {
        "time": "2026-09-20T08:26:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Resolver policy tables synchronized across all edge nodes. Policy enforcement restored."
      },
      {
        "time": "2026-09-20T07:40:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Blocklist propagation daemon stalled due to socket timeout on secondary distribution nodes."
      },
      {
        "time": "2026-09-20T07:15:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating intermittent policy evaluation bypass reports for 1.1.1.1 for Families."
      }
    ]
  },
  {
    "id": "inc-2026-09-18-shards",
    "title": "ClickHouse Replica Desynchronization on Analytical Shard 2 (events_r1)",
    "service": "svc-shards",
    "service_group": "group-storage",
    "severity": "minor",
    "status": "resolved",
    "impact": "Delayed real-time feature extraction aggregation queries and mutation log queue lag",
    "root_cause": "Keeper metadata lease timeout during scheduled cluster node rotation in Frankfurt",
    "started_at": "2026-09-18T14:20:00.000Z",
    "resolved_at": "2026-09-18T15:45:00.000Z",
    "updates": [
      {
        "time": "2026-09-18T15:45:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Shard 2 replica part log caught up with primary. Mutation queues drained."
      },
      {
        "time": "2026-09-18T14:50:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Replica queue lag detected following scheduled cluster node maintenance in Frankfurt."
      },
      {
        "time": "2026-09-18T14:20:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated replication delays on ClickHouse events_r1 shard table."
      }
    ]
  },
  {
    "id": "inc-2026-09-16-img",
    "title": "WASM Image Transcoding Worker Memory Throttling on 8K AVIF Conversions",
    "service": "svc-image-resizing",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Transient HTTP 413 Payload Too Large and image transformation fallbacks to unoptimized origin assets",
    "root_cause": "Linear memory growth in libvips WebAssembly sandbox under concurrent ultra-high-resolution transcoding",
    "started_at": "2026-09-16T12:04:00.000Z",
    "resolved_at": "2026-09-16T13:22:00.000Z",
    "updates": [
      {
        "time": "2026-09-16T13:22:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Sandbox memory limits expanded to 256MB per isolate with cooperative yielding on resolutions exceeding 4K. Transcoding latency normalized."
      },
      {
        "time": "2026-09-16T12:40:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Concurrent generation of animated AVIF thumbnails exhausted the default 64MB WASM heap limit on regional edge workers."
      },
      {
        "time": "2026-09-16T12:04:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating sporadic 413 errors and unresized image pass-through for high-resolution e-commerce catalog media."
      }
    ]
  },
  {
    "id": "inc-2026-09-15-ja4",
    "title": "Cryptographic Fingerprint Evaluator Rate Limit Throttling on TLS GREASE",
    "service": "svc-ja4",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "Brief fallback to heuristic fingerprinting for TLS client handshakes in Tokyo PoP",
    "root_cause": "Novel botnet TLS ClientHello cipher extension stuffing exceeding in-memory evaluation cache buffer",
    "started_at": "2026-09-15T18:10:00.000Z",
    "resolved_at": "2026-09-15T19:05:00.000Z",
    "updates": [
      {
        "time": "2026-09-15T19:05:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Buffer capacity doubled across L7 TLS termination daemons. Handshake latency normalized."
      },
      {
        "time": "2026-09-15T18:35:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Novel botnet TLS grease configuration triggered LRU eviction cascades in JA4 evaluator."
      },
      {
        "time": "2026-09-15T18:10:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating latency spikes during TLS handshake fingerprint generation in Tokyo PoP."
      }
    ]
  },
  {
    "id": "inc-2026-09-12-entropy",
    "title": "Header Entropy Scorer Parser Edge Cases on Non-ASCII RFC 9110 Headers",
    "service": "svc-entropy",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "False-positive bot scoring on legitimate international localized user-agent headers",
    "root_cause": "Unicode normalization edge case in Shannon entropy character distribution window",
    "started_at": "2026-09-12T10:00:00.000Z",
    "resolved_at": "2026-09-12T11:18:00.000Z",
    "updates": [
      {
        "time": "2026-09-12T11:18:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Entropy calculation tokenizer updated with standard UTF-8 NFC normalization. False positive rate returned to 0%."
      },
      {
        "time": "2026-09-12T10:30:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Non-ASCII request header values caused skew in logarithmic entropy scoring distribution."
      },
      {
        "time": "2026-09-12T10:00:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated challenge rates on international non-ASCII user agent headers."
      }
    ]
  },
  {
    "id": "inc-2026-09-09-connector",
    "title": "Cloud Connector IPsec Tunnel MTU Fragmentation on Direct Connect Interconnects",
    "service": "svc-connector",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Sub-packet fragmentation overhead causing 12ms egress latency inflation for enterprise origin tunnels",
    "root_cause": "Path MTU Discovery (PMTUD) blackholing due to upstream carrier ICMP Fragmentation Needed packet drops",
    "started_at": "2026-09-09T08:30:00.000Z",
    "resolved_at": "2026-09-09T10:14:00.000Z",
    "updates": [
      {
        "time": "2026-09-09T10:14:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "TCP MSS clamping enforced at 1380 bytes across Cloud Connector tunnel endpoints. Fragmentation eliminated and round-trip latency restored to 2.4ms baseline."
      },
      {
        "time": "2026-09-09T09:15:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Transit firewall drop of ICMP Type 3 Code 4 messages prevented clients from adjusting packet sizes below the 1500 byte interface MTU."
      },
      {
        "time": "2026-09-09T08:30:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating egress throughput drops and packet retransmissions on hybrid cloud interconnect tunnels in Ashburn."
      }
    ]
  },
  {
    "id": "inc-2026-09-04-reserve",
    "title": "Cache Reserve Cold Tier S3 Read Timeout Spikes in EU-Central",
    "service": "svc-reserve",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Cold asset retrieval latency jumped from 60ms to 420ms for non-L1 cache misses",
    "root_cause": "Elevated read latency on persistent object storage tier during Ceph OSD storage pool scrub and rebalance",
    "started_at": "2026-09-04T15:20:00.000Z",
    "resolved_at": "2026-09-04T17:05:00.000Z",
    "updates": [
      {
        "time": "2026-09-04T17:05:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Storage pool scrubbing rate limits lowered during peak EU traffic hours. Cold cache retrieval latency returned to 55ms baseline."
      },
      {
        "time": "2026-09-04T16:10:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Automated disk repair scrub cycle saturated SAS drive controller queue depths on persistent storage nodes in Frankfurt."
      },
      {
        "time": "2026-09-04T15:20:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Monitoring elevated origin fallback rates caused by slow reads from persistent Cache Reserve storage in Frankfurt."
      }
    ]
  },
  {
    "id": "inc-2026-09-02-cache-range",
    "title": "Byte-Range Splicing Desynchronization on Multipart Video Segments (RFC 7233)",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Corrupted video playback chunks and checksum mismatches on partial content downloads in London and Paris POPs",
    "root_cause": "Edge cache slice filter stripped Content-Range headers on 206 responses, caching partial byte buffers under general URI keys",
    "started_at": "2026-09-02T13:10:00.000Z",
    "resolved_at": "2026-09-02T15:28:00.000Z",
    "updates": [
      {
        "time": "2026-09-02T15:28:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Range filter patched to validate RFC 7233 byte boundaries before buffer ingestion. Poisoned fragments purged globally and video playback validated."
      },
      {
        "time": "2026-09-02T14:15:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "A regression in the HTTP/2 chunk stitcher treated partial 206 responses as complete 200 OK responses whenever Range was requested with bytes=0-1024."
      },
      {
        "time": "2026-09-02T13:10:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating reports of video streams freezing after first segment and hash check failures on multi-megabyte binary downloads."
      }
    ]
  },
  {
    "id": "inc-2026-08-31-purge",
    "title": "Cache-Tag Invalidation Pipeline Backpressure on Secondary Anycast POPs",
    "service": "svc-purge",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Regional 8 to 14 minute stale cache lifetime on explicit customer tag invalidation calls",
    "root_cause": "Kafka pub/sub consumer group partition rebalance delayed cache-tag purge message propagation across APAC edge nodes",
    "started_at": "2026-08-31T09:40:00.000Z",
    "resolved_at": "2026-08-31T11:15:00.000Z",
    "updates": [
      {
        "time": "2026-08-31T11:15:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Consumer group coordinator failover completed and backlog of 180,000 tag invalidations processed. Purge propagation time back to < 150ms."
      },
      {
        "time": "2026-08-31T10:20:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Network partition between Singapore message broker cluster and regional edge POPs triggered repeated consumer group rebalance loops."
      },
      {
        "time": "2026-08-31T09:40:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating delays in cache purge propagation for API calls using Cache-Tag and Purge-All endpoints in Asia-Pacific."
      }
    ]
  },
  {
    "id": "inc-2026-08-25-ch",
    "title": "ClickHouse Part Mutation Queue Congestion on Sharded Analytical Cluster",
    "service": "svc-ch-cluster",
    "service_group": "group-storage",
    "severity": "minor",
    "status": "resolved",
    "impact": "Analytical query execution time elevated from 120ms to 1,450ms for security feature aggregation",
    "root_cause": "High disk I/O wait during background merge operations of high-cardinality telemetry partitions",
    "started_at": "2026-08-25T16:15:00.000Z",
    "resolved_at": "2026-08-25T18:02:00.000Z",
    "updates": [
      {
        "time": "2026-08-25T18:02:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "MergeTree max_bytes_to_merge_at_max_space_in_pools parameter tuned and mutation tasks drained. Query latency returned to 110ms baseline."
      },
      {
        "time": "2026-08-25T17:10:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Continuous ingestion of 120k RPS security telemetry triggered concurrent mutations across 48 shards simultaneously, saturating NVMe IOPS."
      },
      {
        "time": "2026-08-25T16:15:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating slow analytical queries on ClickHouse bot_signals dataset and delayed dashboard metric refreshes."
      }
    ]
  },
  {
    "id": "inc-2026-08-20-cache-vary",
    "title": "LRU Slab Allocator Eviction Thrashing via Unbounded Vary Header Permutations",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Cache hit ratio dropped from 96.4% to 28.1% on affected customer domains, shifting heavy load to origin",
    "root_cause": "Origin returned Vary: User-Agent, Cookie, X-Device-Id causing cache key cardinality explosion and rapid slab eviction",
    "started_at": "2026-08-20T11:05:00.000Z",
    "resolved_at": "2026-08-20T13:40:00.000Z",
    "updates": [
      {
        "time": "2026-08-20T13:40:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Edge cache key normalizer rule deployed to sanitize unbounded Vary dimensions. Cache hit ratio recovered to 96.8%."
      },
      {
        "time": "2026-08-20T12:15:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Origin application began emitting Vary on randomized session cookie values, allocating 450,000 distinct cache items per hour for a single URL."
      },
      {
        "time": "2026-08-20T11:05:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating sudden drop in edge cache hit ratio and elevated upstream origin bandwidth on tier-1 e-commerce accounts."
      }
    ]
  },
  {
    "id": "inc-2026-08-10-payload",
    "title": "Atomic Configuration File Replacement Stalls on Read-Only Staging Mount",
    "service": "svc-payload",
    "service_group": "group-pipeline",
    "severity": "minor",
    "status": "resolved",
    "impact": "Delayed catalog synchronization; pipeline fell back to in-memory cached payload descriptors",
    "root_cause": "Rename operation (renameat2) failed with EROFS during automated features.json atomic swap on staging nodes",
    "started_at": "2026-08-10T14:12:00.000Z",
    "resolved_at": "2026-08-10T15:20:00.000Z",
    "updates": [
      {
        "time": "2026-08-10T15:20:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Staging filesystem remounted read-write and atomic swap fallback logic validated. Catalog updates propagating within nominal 5s SLA."
      },
      {
        "time": "2026-08-10T14:45:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Underlying EBS volume IO error forced Linux kernel to remount staging disk as read-only, preventing temporary file replacement."
      },
      {
        "time": "2026-08-10T14:12:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating catalog synchronization daemon warnings during dynamic features.json export on staging test nodes."
      }
    ]
  },
  {
    "id": "inc-2026-08-07-fl2-io",
    "title": "TCP Worker epoll Event Loop Stalls during NVMe Storage Page Faults",
    "service": "svc-fl2",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "Transient p99 latency spikes (up to 320ms) across multiplexed client connections on affected proxy threads",
    "root_cause": "Synchronous kernel pread(2) on uncached NVMe disk blocks blocked the non-blocking worker thread reactor",
    "started_at": "2026-08-07T08:15:00.000Z",
    "resolved_at": "2026-08-07T10:05:00.000Z",
    "updates": [
      {
        "time": "2026-08-07T10:05:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Disk I/O delegated to dedicated asynchronous io_uring thread pool. Reactor event loops unblocked; p99 latency restored to 1.18ms."
      },
      {
        "time": "2026-08-07T09:05:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Heavy concurrent cold cache reads forced Linux page cache stalls on NVMe flash devices with deep command queues."
      },
      {
        "time": "2026-08-07T08:15:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating periodic 200ms latency jitters affecting proxy worker threads in London and Amsterdam POPs."
      }
    ]
  },
  {
    "id": "inc-2026-08-05-tiered",
    "title": "Origin Shield Socket Descriptor Limit Saturation in Frankfurt POP",
    "service": "svc-tiered-cache",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Automated shield bypass failover engaged; edge POPs fetched directly from customer origins with elevated egress latency",
    "root_cause": "Tiered cache upper-tier shield node exceeded Linux RLIMIT_NOFILE (65,536 fds) under origin keep-alive surge",
    "started_at": "2026-08-05T13:20:00.000Z",
    "resolved_at": "2026-08-05T15:10:00.000Z",
    "updates": [
      {
        "time": "2026-08-05T15:10:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "RLIMIT_NOFILE raised to 1,048,576 and origin idle connection keep-alive timeout lowered to 30s. Shield cluster resumed full routing."
      },
      {
        "time": "2026-08-05T14:05:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "A burst of 80,000 idle keep-alive connections from tier-1 edge POPs exhausted available socket handles on Frankfurt shield proxies."
      },
      {
        "time": "2026-08-05T13:20:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating connection refusals and automatic origin shield bypass alerts on European tiered cache clusters."
      }
    ]
  },
  {
    "id": "inc-2026-07-26-ip",
    "title": "BGP Community Tag Stripping on Latin America Peering Exchange",
    "service": "svc-ip",
    "service_group": "group-proxy",
    "severity": "minor",
    "status": "resolved",
    "impact": "Localized latency increase of 45ms for South American traffic due to sub-optimal transit routing",
    "root_cause": "Upstream tier-1 transit provider stripped NO_EXPORT BGP community tags, causing route oscillation in Sao Paulo",
    "started_at": "2026-07-26T17:40:00.000Z",
    "resolved_at": "2026-07-26T19:15:00.000Z",
    "updates": [
      {
        "time": "2026-07-26T19:15:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Upstream transit provider re-applied community filter rules. BGP path metrics converged on lowest-latency local paths."
      },
      {
        "time": "2026-07-26T18:25:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Carrier router reconfiguration dropped RFC 1997 standard community tags during session reset at IX.br."
      },
      {
        "time": "2026-07-26T17:40:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating suboptimal routing and latency inflation for traffic entering the network via Sao Paulo and Buenos Aires."
      }
    ]
  },
  {
    "id": "inc-2026-07-24-cache-h2",
    "title": "HTTP/2 Connection Reuse Stream Multiplexing Race on Upstream Origins",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Transient connection resets (RST_STREAM) affecting 0.08% of origin revalidation fetches",
    "root_cause": "Race condition in proxy origin pool when handling concurrent GOAWAY frames with active in-flight cache subrequests",
    "started_at": "2026-07-24T10:30:00.000Z",
    "resolved_at": "2026-07-24T12:12:00.000Z",
    "updates": [
      {
        "time": "2026-07-24T12:12:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Origin connection pool state machine patched to handle GOAWAY graceful stream migration without dropping queued subrequests."
      },
      {
        "time": "2026-07-24T11:15:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "When an origin dispatched a GOAWAY frame during high connection reuse, newly initiated cache revalidation streams were aborted prematurely."
      },
      {
        "time": "2026-07-24T10:30:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating transient 502/504 errors on long-lived HTTP/2 upstream connections to customer origins."
      }
    ]
  },
  {
    "id": "inc-2026-07-14-reserve",
    "title": "Cache Reserve Deduplication Index Rebuild Delay on Western US Cluster",
    "service": "svc-reserve",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "180ms p95 latency elevation for cold cache reserve object fetches in US-West",
    "root_cause": "High write queue depth during RocksDB block-level SSTable compaction in San Jose datacenter",
    "started_at": "2026-07-14T06:15:00.000Z",
    "resolved_at": "2026-07-14T08:30:00.000Z",
    "updates": [
      {
        "time": "2026-07-14T08:30:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Compaction concurrency throttled and memory cache buffers increased. Cache Reserve response latency returned to normal 45ms SLA."
      },
      {
        "time": "2026-07-14T07:15:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "Heavy write-back batch from weekend cold storage sync triggered level-6 LSM-tree background compaction, competing for NVMe bandwidth."
      },
      {
        "time": "2026-07-14T06:15:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated read latency for Cache Reserve requests routed through San Jose (SJC) and Los Angeles (LAX)."
      }
    ]
  },
  {
    "id": "inc-2026-07-11-cache-swr",
    "title": "Async Worker Task Accumulation on Stale-While-Revalidate Storms",
    "service": "svc-cdn",
    "service_group": "group-cdn",
    "severity": "minor",
    "status": "resolved",
    "impact": "Tokio task pool memory pressure and elevated edge CPU usage during degraded origin recovery",
    "root_cause": "Missing deduplication lock on background revalidation tasks when origin latency exceeded 5 seconds",
    "started_at": "2026-07-11T14:00:00.000Z",
    "resolved_at": "2026-07-11T16:15:00.000Z",
    "updates": [
      {
        "time": "2026-07-11T16:15:00.000Z",
        "status": "resolved",
        "title": "Resolved",
        "message": "Per-URI atomic in-flight guard added for stale-while-revalidate spawns. Max background task concurrency capped at 1 per cache key."
      },
      {
        "time": "2026-07-11T15:05:00.000Z",
        "status": "identified",
        "title": "Identified",
        "message": "When a major origin slowed to 8s response times, 12,000 identical background revalidation tasks were launched for the same stale resource."
      },
      {
        "time": "2026-07-11T14:00:00.000Z",
        "status": "investigating",
        "title": "Investigating",
        "message": "Investigating elevated memory consumption and CPU thread usage across proxy worker processes during slow origin recovery."
      }
    ]
  }
];

let incidentsData = [...DEFAULT_INCIDENTS];

// Accordion Collapsed States
const collapsedGroups = new Set();
const collapsedRegions = new Set(["Africa", "Europe", "North America", "Latin America", "Oceania"]);

// User Subscriptions State
const userSubscriptions = new Set();
let toastTimeout = null;

// Leaflet Map State
let leafletMap = null;
let tileLayer = null;
let mapMarkers = [];

// ============================================================================
// 1. DATA DEFINITIONS
// ============================================================================

// 1.1 Service Groups & Components
const SERVICE_GROUPS = [
  {
    id: "group-cdn",
    name: "CDN & Performance",
    services: [
      { id: "svc-cdn", name: "CDN/Cache", status: "operational", degradedDays: [15, 28, 55, 68, 89] },
      { id: "svc-online", name: "Always Online", status: "operational", degradedDays: [] },
      { id: "svc-reserve", name: "Cache Reserve", status: "operational", degradedDays: [18, 70] },
      { id: "svc-purge", name: "CDN Cache Purge", status: "operational", degradedDays: [66] },
      { id: "svc-connector", name: "Cloud Connector", status: "operational", degradedDays: [75] },
      { id: "svc-custom-pages", name: "Custom Pages", status: "operational", degradedDays: [] },
      { id: "svc-tiered-cache", name: "Tiered Cache", status: "operational", degradedDays: [40] },
      { id: "svc-early-hints", name: "Early Hints 103", status: "operational", degradedDays: [] },
      { id: "svc-image-resizing", name: "Image Resizing", status: "operational", degradedDays: [82] },
      { id: "svc-stream-delivery", name: "Stream Delivery", status: "operational", degradedDays: [] }
    ]
  },
  {
    id: "group-proxy",
    name: "Core FL2 Proxy & Security Engine",
    services: [
      { id: "svc-fl2", name: "Core FL2 Proxy Engine (Rust [Feature; 200])", status: "operational", degradedDays: [42, 87] },
      { id: "svc-api", name: "Edge API & Authentication Gateway", status: "operational", degradedDays: [89] },
      { id: "svc-ja4", name: "JA4 / JA3 Cryptographic Fingerprint Evaluator", status: "operational", degradedDays: [81] },
      { id: "svc-tcp", name: "TCP Transport & SYN-ACK Latency Evaluator", status: "operational", degradedDays: [] },
      { id: "svc-h2", name: "HTTP/2 & HTTP/3 Frame Protocol Analyzer", status: "operational", degradedDays: [] },
      { id: "svc-entropy", name: "Shannon Header & Request Entropy Scorer", status: "operational", degradedDays: [78] },
      { id: "svc-ip", name: "IP & BGP Network Reputation Classifier", status: "operational", degradedDays: [30, 90] },
      { id: "svc-hints", name: "Client Hints & Behavioral Biometrics Engine", status: "operational", degradedDays: [86] }
    ]
  },
  {
    id: "group-pipeline",
    name: "Analytical Feature Extraction Pipeline",
    services: [
      { id: "svc-catalog", name: "ClickHouse Catalog Introspection (system.columns)", status: "operational", degradedDays: [] },
      { id: "svc-registry", name: "Dynamic Feature Registry (KNOWN_FEATURES)", status: "operational", degradedDays: [] },
      { id: "svc-payload", name: "Dynamic JSON Payload Distributor (features.json)", status: "operational", degradedDays: [45] }
    ]
  },
  {
    id: "group-storage",
    name: "Distributed Storage & Analytical Shards",
    services: [
      { id: "svc-ch-cluster", name: "ClickHouse Sharded Analytics Cluster", status: "operational", degradedDays: [60] },
      { id: "svc-shards", name: "Shard Replica Tables (events_r0 / events_r1)", status: "operational", degradedDays: [84] },
      { id: "svc-kv", name: "Distributed Edge KV Cache", status: "operational", degradedDays: [88] }
    ]
  }
];

// 1.2 Recent Incidents Data
const RECENT_INCIDENTS = [
  {
    "id": "inc-2026-09-24-drift",
    "title": "L7 Edge Proxy Ingestion Panic (TryFromSliceError)",
    "impact": "Critical",
    "status": "Resolved",
    "date": "2026-09-24T11:28:06.041Z",
    "type": "incident",
    "service": "fl2"
  },
  {
    "id": "inc-2026-09-24-bgp",
    "title": "BGP Route Reflection Latency on Bring Your Own IP (BYOIP) Prefix Updates",
    "impact": "Minor",
    "status": "Resolved",
    "date": "2026-09-24T10:22:34.763Z",
    "type": "incident",
    "service": "ip"
  },
  {
    "id": "inc-2026-09-24-auth",
    "title": "Intermittent authentication errors for API and R2",
    "impact": "Minor",
    "status": "Resolved",
    "date": "2026-09-23T20:59:35.579Z",
    "type": "incident",
    "service": "api"
  },
  {
    "id": "inc-2026-09-23-auth",
    "title": "Intermittent Ed25519 Token Verification Latency on Edge Authentication Tier",
    "impact": "Minor",
    "status": "Resolved",
    "date": "2026-09-23T20:59:35.579Z",
    "type": "incident",
    "service": "api"
  },
  {
    "id": "inc-2026-09-24-cache",
    "title": "Elevated Errors with any / all in http_response_cache_settings",
    "impact": "Minor",
    "status": "Resolved",
    "date": "2026-09-23T17:14:32.859183+00:00",
    "type": "incident",
    "service": "cdn"
  },
  {
    "id": "inc-2026-09-23-cache",
    "title": "Elevated Errors with any / all in http_response_cache_settings",
    "impact": "Minor",
    "status": "Resolved",
    "date": "2026-09-23T15:54:28.000Z",
    "type": "incident",
    "service": "cdn"
  }
];

// 1.3 Active Maintenance Data
const ACTIVE_MAINTENANCE = [
  {
    id: "maint-zrh-2026-09-24",
    title: "ZRH (Zurich) on 2026-09-24",
    status: "In Progress",
    date: "24 Sept 2026, 7.00",
    type: "maintenance",
    location: "ZRH"
  },
  {
    id: "maint-waw-2026-09-23",
    title: "WAW (Warsaw) on 2026-09-23",
    status: "In Progress",
    date: "24 Sept 2026, 6.00",
    type: "maintenance",
    location: "WAW"
  }
];

// 1.4 Global Location Fleet
const REGIONAL_LOCATIONS = [
  {
    region: "Asia",
    center: [22.0, 95.0],
    totalCount: 99,
    pops: [
      { city: "Tokyo", country: "Japan", code: "NRT", lat: 35.6762, lng: 139.6503, status: "operational", tag: "Operational +" },
      { city: "Osaka", country: "Japan", code: "KIX", lat: 34.4320, lng: 135.2304, status: "operational", tag: "Operational +" },
      { city: "Seoul", country: "South Korea", code: "ICN", lat: 37.5665, lng: 126.9780, status: "operational", tag: "Operational +" },
      { city: "Singapore", country: "Singapore", code: "SIN", lat: 1.3521, lng: 103.8198, status: "operational", tag: "Operational +" },
      { city: "Hong Kong", country: "Hong Kong", code: "HKG", lat: 22.3193, lng: 114.1694, status: "operational", tag: "Operational +" },
      { city: "Taipei", country: "Taiwan", code: "TPE", lat: 25.0330, lng: 121.5654, status: "operational", tag: "Operational +" },
      { city: "Bangkok", country: "Thailand", code: "BKK", lat: 13.7563, lng: 100.5018, status: "operational", tag: "Operational +" },
      { city: "Ho Chi Minh City", country: "Vietnam", code: "SGN", lat: 10.8231, lng: 106.6297, status: "operational", tag: "Operational +" },
      { city: "Manila", country: "Philippines", code: "MNL", lat: 14.5995, lng: 120.9842, status: "operational", tag: "Operational +" },
      { city: "Cebu", country: "Philippines", code: "CEB", lat: 10.3157, lng: 123.8854, status: "operational", tag: "Operational +" },
      { city: "Jakarta", country: "Indonesia", code: "CGK", lat: -6.2088, lng: 106.8456, status: "operational", tag: "Operational +" },
      { city: "Kuala Lumpur", country: "Malaysia", code: "KUL", lat: 3.1390, lng: 101.6869, status: "operational", tag: "Operational +" },
      { city: "Mumbai", country: "India", code: "BOM", lat: 19.0760, lng: 72.8777, status: "operational", tag: "Operational +" },
      { city: "Delhi", country: "India", code: "DEL", lat: 28.6139, lng: 77.2090, status: "operational", tag: "Operational +" },
      { city: "Bangalore", country: "India", code: "BLR", lat: 12.9716, lng: 77.5946, status: "rerouted", tag: "Re-routed +" },
      { city: "Hyderabad", country: "India", code: "HYD", lat: 17.3850, lng: 78.4867, status: "operational", tag: "Operational +" },
      { city: "Chennai", country: "India", code: "MAA", lat: 13.0827, lng: 80.2707, status: "operational", tag: "Operational +" },
      { city: "Kolkata", country: "India", code: "CCU", lat: 22.5726, lng: 88.3639, status: "operational", tag: "Operational +" },
      { city: "Dhaka", country: "Bangladesh", code: "DAC", lat: 23.8103, lng: 90.4125, status: "partial", tag: "Partially Re-routed +" },
      { city: "Colombo", country: "Sri Lanka", code: "CMB", lat: 6.9271, lng: 79.8612, status: "operational", tag: "Operational +" },
      { city: "Almaty", country: "Kazakhstan", code: "ALA", lat: 43.2220, lng: 76.8512, status: "operational", tag: "Operational +" },
      { city: "Dubai", country: "United Arab Emirates", code: "DXB", lat: 25.2048, lng: 55.2708, status: "operational", tag: "Operational +" }
    ]
  },
  {
    region: "Africa",
    center: [2.0, 22.0],
    totalCount: 34,
    pops: [
      { city: "Johannesburg", country: "South Africa", code: "JNB", lat: -26.2041, lng: 28.0473, status: "operational", tag: "Operational +" },
      { city: "Cape Town", country: "South Africa", code: "CPT", lat: -33.9249, lng: 18.4241, status: "operational", tag: "Operational +" },
      { city: "Durban", country: "South Africa", code: "DUR", lat: -29.8587, lng: 31.0218, status: "operational", tag: "Operational +" },
      { city: "Nairobi", country: "Kenya", code: "NBO", lat: -1.2921, lng: 36.8219, status: "operational", tag: "Operational +" },
      { city: "Lagos", country: "Nigeria", code: "LOS", lat: 6.5244, lng: 3.3792, status: "operational", tag: "Operational +" },
      { city: "Cairo", country: "Egypt", code: "CAI", lat: 30.0444, lng: 31.2357, status: "operational", tag: "Operational +" },
      { city: "Casablanca", country: "Morocco", code: "CMN", lat: 33.5731, lng: -7.5898, status: "operational", tag: "Operational +" }
    ]
  },
  {
    region: "Europe",
    center: [50.0, 10.0],
    totalCount: 85,
    pops: [
      { city: "London", country: "United Kingdom", code: "LHR", lat: 51.5074, lng: -0.1278, status: "operational", tag: "Operational +" },
      { city: "Manchester", country: "United Kingdom", code: "MAN", lat: 53.4808, lng: -2.2426, status: "operational", tag: "Operational +" },
      { city: "Frankfurt", country: "Germany", code: "FRA", lat: 50.1109, lng: 8.6821, status: "operational", tag: "Operational +" },
      { city: "Munich", country: "Germany", code: "MUC", lat: 48.1351, lng: 11.5820, status: "operational", tag: "Operational +" },
      { city: "Amsterdam", country: "Netherlands", code: "AMS", lat: 52.3676, lng: 4.9041, status: "operational", tag: "Operational +" },
      { city: "Paris", country: "France", code: "CDG", lat: 48.8566, lng: 2.3522, status: "operational", tag: "Operational +" },
      { city: "Madrid", country: "Spain", code: "MAD", lat: 40.4168, lng: -3.7038, status: "operational", tag: "Operational +" },
      { city: "Milan", country: "Italy", code: "MXP", lat: 45.4642, lng: 9.1900, status: "operational", tag: "Operational +" },
      { city: "Rome", country: "Italy", code: "FCO", lat: 41.9028, lng: 12.4964, status: "operational", tag: "Operational +" },
      { city: "Zurich", country: "Switzerland", code: "ZRH", lat: 47.3769, lng: 8.5417, status: "operational", tag: "Operational +" },
      { city: "Vienna", country: "Austria", code: "VIE", lat: 48.2082, lng: 16.3738, status: "operational", tag: "Operational +" },
      { city: "Warsaw", country: "Poland", code: "WAW", lat: 52.2297, lng: 21.0122, status: "operational", tag: "Operational +" },
      { city: "Stockholm", country: "Sweden", code: "ARN", lat: 59.3293, lng: 18.0686, status: "operational", tag: "Operational +" },
      { city: "Dublin", country: "Ireland", code: "DUB", lat: 53.3498, lng: -6.2603, status: "operational", tag: "Operational +" }
    ]
  },
  {
    region: "North America",
    center: [39.0, -96.0],
    totalCount: 110,
    pops: [
      { city: "San Francisco", country: "United States", code: "SFO", lat: 37.7749, lng: -122.4194, status: "operational", tag: "Operational +" },
      { city: "San Jose", country: "United States", code: "SJC", lat: 37.3382, lng: -121.8863, status: "operational", tag: "Operational +" },
      { city: "Los Angeles", country: "United States", code: "LAX", lat: 34.0522, lng: -118.2437, status: "operational", tag: "Operational +" },
      { city: "Seattle", country: "United States", code: "SEA", lat: 47.6062, lng: -122.3321, status: "operational", tag: "Operational +" },
      { city: "Denver", country: "United States", code: "DEN", lat: 39.7392, lng: -104.9903, status: "operational", tag: "Operational +" },
      { city: "Dallas", country: "United States", code: "DFW", lat: 32.7767, lng: -96.7970, status: "operational", tag: "Operational +" },
      { city: "Chicago", country: "United States", code: "ORD", lat: 41.8781, lng: -87.6298, status: "operational", tag: "Operational +" },
      { city: "Atlanta", country: "United States", code: "ATL", lat: 33.7490, lng: -84.3880, status: "operational", tag: "Operational +" },
      { city: "Miami", country: "United States", code: "MIA", lat: 25.7617, lng: -80.1918, status: "operational", tag: "Operational +" },
      { city: "Ashburn", country: "United States", code: "IAD", lat: 39.0438, lng: -77.4874, status: "operational", tag: "Operational +" },
      { city: "New York", country: "United States", code: "JFK", lat: 40.7128, lng: -74.0060, status: "operational", tag: "Operational +" },
      { city: "Boston", country: "United States", code: "BOS", lat: 42.3601, lng: -71.0589, status: "operational", tag: "Operational +" },
      { city: "Toronto", country: "Canada", code: "YYZ", lat: 43.6532, lng: -79.3832, status: "operational", tag: "Operational +" },
      { city: "Vancouver", country: "Canada", code: "YVR", lat: 49.2827, lng: -123.1207, status: "operational", tag: "Operational +" },
      { city: "Mexico City", country: "Mexico", code: "MEX", lat: 19.4326, lng: -99.1332, status: "operational", tag: "Operational +" }
    ]
  },
  {
    region: "Latin America",
    center: [-20.0, -60.0],
    totalCount: 42,
    pops: [
      { city: "Sao Paulo", country: "Brazil", code: "GRU", lat: -23.5505, lng: -46.6333, status: "operational", tag: "Operational +" },
      { city: "Rio de Janeiro", country: "Brazil", code: "GIG", lat: -22.9068, lng: -43.1729, status: "operational", tag: "Operational +" },
      { city: "Buenos Aires", country: "Argentina", code: "EZE", lat: -34.6037, lng: -58.3816, status: "operational", tag: "Operational +" },
      { city: "Santiago", country: "Chile", code: "SCL", lat: -33.4489, lng: -70.6693, status: "operational", tag: "Operational +" },
      { city: "Bogota", country: "Colombia", code: "BOG", lat: 4.7110, lng: -74.0721, status: "operational", tag: "Operational +" },
      { city: "Lima", country: "Peru", code: "LIM", lat: -12.0464, lng: -77.0428, status: "operational", tag: "Operational +" }
    ]
  },
  {
    region: "Oceania",
    center: [-28.0, 140.0],
    totalCount: 28,
    pops: [
      { city: "Sydney", country: "Australia", code: "SYD", lat: -33.8688, lng: 151.2093, status: "operational", tag: "Operational +" },
      { city: "Melbourne", country: "Australia", code: "MEL", lat: -37.8136, lng: 144.9631, status: "operational", tag: "Operational +" },
      { city: "Brisbane", country: "Australia", code: "BNE", lat: -27.4698, lng: 153.0251, status: "operational", tag: "Operational +" },
      { city: "Perth", country: "Australia", code: "PER", lat: -31.9505, lng: 115.8605, status: "operational", tag: "Operational +" },
      { city: "Auckland", country: "New Zealand", code: "AKL", lat: -36.8485, lng: 174.7633, status: "operational", tag: "Operational +" }
    ]
  }
];

// 1.5 Unified Chronological History Records
const HISTORY_RECORDS = [
  {
    id: "hist-1",
    title: "ZRH (Zurich) on 2026-09-24",
    type: "maintenance",
    status: "In Progress",
    date: "24 Sept 2026, 7.00",
    service: "fl2",
    location: "ZRH",
    dotClass: "blue",
    statusClass: "status-text-progress"
  },
  {
    id: "hist-2",
    title: "DAC (Dhaka) on 2026-09-23",
    type: "maintenance",
    status: "Completed",
    date: "24 Sept 2026, 6.01",
    service: "fl2",
    location: "DAC",
    dotClass: "blue",
    statusClass: "status-text-completed"
  },
  {
    id: "hist-3",
    title: "WAW (Warsaw) on 2026-09-23",
    type: "maintenance",
    status: "In Progress",
    date: "24 Sept 2026, 6.00",
    service: "fl2",
    location: "WAW",
    dotClass: "blue",
    statusClass: "status-text-progress"
  },
  {
    id: "hist-4",
    title: "HNL (Honolulu) on 2026-09-23",
    type: "maintenance",
    status: "Completed",
    date: "24 Sept 2026, 5.00",
    service: "fl2",
    location: "HNL",
    dotClass: "blue",
    statusClass: "status-text-completed"
  },
  {
    id: "hist-5",
    title: "Intermittent authentication errors for API and R2",
    type: "incident",
    impact: "Minor",
    status: "Resolved",
    date: "24 Sept 2026, 3.59",
    service: "api",
    location: "all",
    dotClass: "amber",
    statusClass: "status-text-resolved"
  },
  {
    id: "hist-6",
    title: "PER (Perth) on 2026-09-23",
    type: "maintenance",
    status: "Completed",
    date: "24 Sept 2026, 3.00",
    service: "fl2",
    location: "PER",
    dotClass: "blue",
    statusClass: "status-text-completed"
  },
  {
    id: "hist-7",
    title: "BNE (Brisbane) on 2026-09-23",
    type: "maintenance",
    status: "Completed",
    date: "24 Sept 2026, 2.00",
    service: "fl2",
    location: "BNE",
    dotClass: "blue",
    statusClass: "status-text-completed"
  },
  {
    id: "hist-8",
    title: "Network Performance Degradation - Asia-Pacific",
    type: "incident",
    impact: "Minor",
    status: "Identified",
    date: "24 Sept 2026, 1.44",
    service: "fl2",
    location: "all",
    dotClass: "amber",
    statusClass: "status-text-identified"
  }
];

// ============================================================================
// 2. TAB ROUTING & CONTROLS
// ============================================================================

const TAB_TITLES = {
  overview: "Overview",
  services: "Services & Sites",
  metrics: "Metrics",
  locations: "Locations",
  history: "History"
};

function updateDocumentTitle(pageName) {
  document.title = pageName ? `${pageName} | Cloudflame` : "Cloudflame";
}

let previousTabBeforeIncident = "overview";
let currentOpenIncidentId = null;

function switchTab(tabId, updateUrl = true) {
  if (tabId !== "incident-detail") {
    currentOpenIncidentId = null;
    try {
      localStorage.setItem("dirichlet-active-tab", tabId);
      localStorage.removeItem("dirichlet-open-incident");
    } catch (_) {}
    if (updateUrl) {
      if (window.location.hash !== "#" + tabId) {
        window.location.hash = tabId;
      }
    }
    const titleName = TAB_TITLES[tabId] || (tabId.charAt(0).toUpperCase() + tabId.slice(1));
    updateDocumentTitle(titleName);
  }
  activeTab = tabId;
  const tabs = ["overview", "services", "metrics", "locations", "history", "incident-detail"];

  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const view = document.getElementById(`view-${t}`);
    if (view) {
      if (t === tabId) {
        if (btn) {
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
        }
        view.style.display = "block";
      } else {
        if (btn) {
          btn.classList.remove("active");
          btn.setAttribute("aria-selected", "false");
        }
        view.style.display = "none";
      }
    }
  });

  if (tabId === "locations") {
    setTimeout(() => {
      if (!leafletMap) {
        initLocationsMap();
      } else {
        leafletMap.invalidateSize();
        updateMapMarkers();
      }
    }, 100);
  } else if (tabId === "metrics") {
    setTimeout(renderAllCharts, 50);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleTimezone() {
  useUtc = !useUtc;
  try {
    localStorage.setItem("dirichlet_timezone", useUtc ? "utc" : "local");
  } catch (e) {}

  const label = document.getElementById("tz-label");
  if (label) {
    label.textContent = useUtc ? "UTC time" : "Local time";
  }
  if (currentOpenIncidentId && document.getElementById("view-incident-detail")?.style.display !== "none") {
    openIncidentDetail(currentOpenIncidentId, false);
  }
  renderOverview();
  renderHistory();
}

function cycleTheme() {
  const html = document.documentElement;
  const icon = document.getElementById("theme-icon");

  if (activeTheme === "dark") {
    activeTheme = "light";
    html.setAttribute("data-theme", "light");
    if (icon) icon.className = "ph ph-sun";
  } else {
    activeTheme = "dark";
    html.setAttribute("data-theme", "dark");
    if (icon) icon.className = "ph ph-moon";
  }

  try {
    localStorage.setItem("dirichlet_theme", activeTheme);
  } catch (e) {}

  updateMapTileLayer();
}

// ============================================================================
// 3. RENDERERS
// ============================================================================

// 3.1 Overview Tab
function formatIncidentDate(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}.${mins}`;
  } catch (_) {
    return isoString;
  }
}

function getEffectiveIncidents() {
  if (incidentsData && incidentsData.length > 0) {
    return incidentsData.map(inc => ({
      id: inc.id,
      title: inc.title,
      impact: inc.severity === "critical" ? "Critical" : inc.severity === "major" ? "Major" : "Minor",
      status: inc.status === "resolved" ? "Resolved" : inc.status === "investigating" ? "Investigating" : "Identified",
      date: formatIncidentDate(inc.started_at),
      type: "incident",
      service: inc.service || "fl2",
      dotClass: inc.status === "resolved" ? "amber" : "rose",
      statusClass: inc.status === "resolved" ? "status-text-resolved" : inc.status === "investigating" ? "status-text-identified" : "status-text-progress"
    }));
  }
  return RECENT_INCIDENTS;
}

function renderOverview() {
  // Recent Incidents
  const recentContainer = document.getElementById("recent-incidents-list");
  if (recentContainer) {
    const incidents = getEffectiveIncidents();
    recentContainer.innerHTML = incidents.slice(0, 6).map(inc => `
      <div class="incident-row" onclick="openIncidentDetail('${inc.id}')" data-incident-id="${inc.id}" role="button" tabindex="0">
        <div class="row-left">
          <span class="status-dot-circle ${inc.dotClass}"></span>
          <span class="row-title">${inc.title}</span>
        </div>
        <div class="row-right">
          ${inc.impact ? `<span class="impact-badge-minor">${inc.impact}</span>` : ""}
          <span class="${inc.statusClass}">${inc.status}</span>
          <span class="row-date">${inc.date}</span>
        </div>
      </div>
    `).join("");
  }

  // Active Maintenance
  const maintContainer = document.getElementById("active-maintenance-list");
  if (maintContainer) {
    maintContainer.innerHTML = ACTIVE_MAINTENANCE.map(maint => `
      <div class="maintenance-row" onclick="openIncidentDetail('${maint.id}')" data-incident-id="${maint.id}" role="button" tabindex="0">
        <div class="row-left">
          <span class="status-dot-circle blue"></span>
          <span class="row-title">${maint.title}</span>
        </div>
        <div class="row-right">
          <span class="status-text-progress">${maint.status}</span>
          <span class="row-date">${maint.date}</span>
        </div>
      </div>
    `).join("");
  }
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findServiceById(svcId) {
  for (const group of SERVICE_GROUPS) {
    const found = group.services.find(s => s.id === svcId || s.id.replace("svc-", "") === svcId);
    if (found) return found;
  }
  return null;
}

function getIncidentsForService(svcId, svcName) {
  const list = [];
  const all = (incidentsData && incidentsData.length > 0) ? incidentsData : DEFAULT_INCIDENTS;
  
  const cleanId = (svcId || "").toLowerCase().replace("svc-", "");
  const cleanName = (svcName || "").toLowerCase();

  all.forEach(inc => {
    const incSvc = (inc.service || "").toLowerCase();
    const incTitle = (inc.title || "").toLowerCase();

    if (incSvc === svcId.toLowerCase() || incSvc === cleanId) {
      if (!list.some(x => x.id === inc.id)) list.push(inc);
      return;
    }

    if (cleanName.includes("fl2") || cleanName.includes("proxy")) {
      if (incSvc === "fl2" || incSvc === "svc-fl2" || incTitle.includes("proxy") || incTitle.includes("fl2") || inc.id.includes("drift")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("bgp") || cleanName.includes("ip")) {
      if (incSvc === "ip" || incSvc === "svc-ip" || incTitle.includes("bgp") || incTitle.includes("byoip")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("cdn") || cleanName.includes("cache")) {
      if (incSvc === "cdn" || incSvc === "svc-cdn" || incTitle.includes("cache")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("shard")) {
      if (incSvc === "shards" || incSvc === "svc-shards" || incTitle.includes("replica") || incTitle.includes("shard")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("ja4") || cleanName.includes("fingerprint")) {
      if (incSvc === "ja4" || incSvc === "svc-ja4" || incTitle.includes("ja4") || incTitle.includes("fingerprint")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("entropy")) {
      if (incSvc === "entropy" || incSvc === "svc-entropy" || incTitle.includes("entropy")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("kv") || cleanName.includes("storage")) {
      if (incSvc === "kv" || incSvc === "svc-kv" || incTitle.includes("durable objects") || incTitle.includes("r2")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
    if (cleanName.includes("api") || cleanName.includes("auth")) {
      if (incSvc === "api" || incSvc === "svc-api" || incTitle.includes("authentication") || incTitle.includes("api")) {
        if (!list.some(x => x.id === inc.id)) list.push(inc);
        return;
      }
    }
  });

  list.sort((a, b) => {
    const aActive = a.status !== "resolved";
    const bActive = b.status !== "resolved";
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return new Date(b.started_at || 0) - new Date(a.started_at || 0);
  });

  return list;
}

function getIncidentForDay(svc, day, incidentList) {
  if (day === 90) {
    if (svc.status === "outage" || svc.status === "degraded") {
      const activeInc = incidentList.find(inc => inc.status !== "resolved");
      if (activeInc) return activeInc.id;
      if (svc.id === "svc-fl2") return "inc-2026-09-24-drift";
      if (svc.id === "svc-ip") return "inc-2026-09-24-bgp";
      return incidentList[0] ? incidentList[0].id : `inc-degraded-${svc.id}-90`;
    }
    return null;
  }

  // Exact Day-to-Incident Mapping for 90-Day Timeline
  const key = `${svc.id}-${day}`;
  const dayIncidentMap = {
    // CDN & Performance
    "svc-cdn-89": "inc-2026-09-23-cache-stampede",
    "svc-cdn-68": "inc-2026-09-02-cache-range",
    "svc-cdn-55": "inc-2026-08-20-cache-vary",
    "svc-cdn-28": "inc-2026-07-24-cache-h2",
    "svc-cdn-15": "inc-2026-07-11-cache-swr",
    "svc-reserve-70": "inc-2026-09-04-reserve",
    "svc-reserve-18": "inc-2026-07-14-reserve",
    "svc-purge-66": "inc-2026-08-31-purge",
    "svc-connector-75": "inc-2026-09-09-connector",
    "svc-tiered-cache-40": "inc-2026-08-05-tiered",
    "svc-image-resizing-82": "inc-2026-09-16-img",
    // Core FL2 Proxy & Security Engine
    "svc-fl2-90": "inc-2026-09-24-drift",
    "svc-fl2-87": "inc-2026-09-21-r2-au",
    "svc-fl2-42": "inc-2026-08-07-fl2-io",
    "svc-api-89": "inc-2026-09-23-auth",
    "svc-ja4-81": "inc-2026-09-15-ja4",
    "svc-entropy-78": "inc-2026-09-12-entropy",
    "svc-ip-90": "inc-2026-09-24-bgp",
    "svc-ip-30": "inc-2026-07-26-ip",
    "svc-hints-86": "inc-2026-09-20-dns",
    // Distributed Storage & Shards
    "svc-kv-88": "inc-2026-09-22-do",
    "svc-shards-84": "inc-2026-09-18-shards",
    "svc-ch-cluster-60": "inc-2026-08-25-ch",
    // Pipeline
    "svc-payload-45": "inc-2026-08-10-payload"
  };

  if (dayIncidentMap[key]) {
    return dayIncidentMap[key];
  }

  if (incidentList && incidentList.length > 0) {
    return incidentList[0].id;
  }

  return `inc-degraded-${svc.id}-${day}`;
}

// 3.2 Services & Sites Tab
function renderServices() {
  const container = document.getElementById("service-groups-container");
  if (!container) return;

  const searchQuery = (document.getElementById("service-search")?.value || "").toLowerCase().trim();

  let html = "";

  SERVICE_GROUPS.forEach(group => {
    const filteredServices = group.services.filter(s =>
      s.name.toLowerCase().includes(searchQuery)
    );

    if (filteredServices.length === 0) return;

    const isCollapsed = collapsedGroups.has(group.id);

    html += `
      <div class="service-accordion-card" id="${group.id}">
        <div class="service-accordion-header" onclick="toggleServiceGroup('${group.id}')">
          <div class="accordion-title-left">
            <i class="ph-bold ph-caret-down accordion-chevron ${isCollapsed ? 'collapsed' : ''}"></i>
            <span>${group.name}</span>
          </div>
          <div class="accordion-count-right">
            <span>${filteredServices.length} services</span>
            <button type="button" class="btn-subscribe-plus ${isGroupFullySubscribed(group) ? 'subscribed' : ''}" onclick="toggleGroupSubscription(event, '${group.id}')" data-tooltip-name="${group.name}" aria-label="Subscribe to ${group.name}">
              <i class="${isGroupFullySubscribed(group) ? 'ph-bold ph-check' : 'ph ph-plus'}"></i>
            </button>
          </div>
        </div>
        <div class="service-accordion-body ${isCollapsed ? 'collapsed' : ''}">
    `;

    filteredServices.forEach(svc => {
      const isOutage = svc.status === "outage";
      const isDegraded = svc.status === "degraded";
      const rawStatus = svc.overrideLabel ? svc.overrideLabel.replace(" +", "") : (isOutage ? "Major Outage" : isDegraded ? "Degraded" : "Operational");
      const statusClass = isOutage ? "outage" : isDegraded ? "degraded" : "operational";
      const isSubscribed = userSubscriptions.has(svc.name);

      const incidentList = getIncidentsForService(svc.id, svc.name);
      const primaryIncident = incidentList[0] || null;

      html += `
        <div class="service-item-row">
          <div class="service-item-header">
            <div class="service-name-left">
              <i class="ph-bold ph-check-circle service-check-icon ${isOutage ? 'outage' : isDegraded ? 'degraded' : ''}"></i>
              <span>${svc.name}</span>
            </div>
            <div class="service-status-right ${statusClass}">
              ${(isOutage || isDegraded) && primaryIncident ? `
                <span class="service-status-text ${statusClass} clickable" onclick="openIncidentDetail('${primaryIncident.id}')" role="button" tabindex="0" title="Click to view incident details">${rawStatus}</span>
              ` : `
                <span class="service-status-text ${statusClass}">${rawStatus}</span>
              `}
              <button type="button" class="btn-subscribe-plus ${isSubscribed ? 'subscribed' : ''}" onclick="toggleServiceSubscription(event, '${group.id}', '${svc.name}')" data-tooltip-name="${svc.name}" aria-label="Subscribe to ${svc.name}">
                <i class="${isSubscribed ? 'ph-bold ph-check' : 'ph ph-plus'}"></i>
              </button>
            </div>
          </div>

          <!-- 90-Day Uptime Grid (SVG Vector Rendering for 100% Uniform Spacing) -->
          <svg class="uptime-grid" viewBox="0 0 898 22" preserveAspectRatio="none" data-svc-name="${svc.name}">
            ${generateUptimeBars(svc, incidentList)}
          </svg>
          <!-- Uptime Legend -->
          <div class="uptime-legend-row">
            <span class="uptime-legend-label">90 days ago</span>
            <div class="uptime-legend-line"></div>
            <span class="uptime-legend-metric">${calculateUptimeMetric(svc)}</span>
            <div class="uptime-legend-line"></div>
            <span class="uptime-legend-label">Today</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  attachTooltipListeners();
}

function toggleServiceGroup(groupId) {
  if (collapsedGroups.has(groupId)) {
    collapsedGroups.delete(groupId);
  } else {
    collapsedGroups.add(groupId);
  }
  renderServices();
}

function filterServices() {
  renderServices();
}

// Generates exactly 90 uniform grid bars with clickable incident navigation
function generateUptimeBars(svc, incidentList = []) {
  let barsHtml = "";
  const degradedDays = new Set(svc.degradedDays || []);

  for (let day = 1; day <= 90; day++) {
    const x = (day - 1) * 10;
    let tickClass = "";
    let note = "100% operational · Zero incidents";
    let incId = null;

    // Day 90 is current live runtime state
    if (day === 90) {
      if (svc.status === "outage") {
        tickClass = "outage";
        note = "Major Outage · 502 Bad Gateway (TryFromSliceError panic)";
        incId = getIncidentForDay(svc, 90, incidentList);
      } else if (svc.status === "degraded") {
        tickClass = "degraded";
        note = "Degraded feature intake · 80 shadow columns shed at edge";
        incId = getIncidentForDay(svc, 90, incidentList);
      }
    } else if (degradedDays.has(day)) {
      tickClass = "degraded";
      incId = getIncidentForDay(svc, day, incidentList);
      const incObj = incId ? findIncidentById(incId) : null;
      note = incObj ? incObj.title : "Upstream catalog synchronization jitter · Minor latency";
    }

    if (incId) {
      barsHtml += `<rect class="uptime-bar-tick ${tickClass} has-incident" x="${x}" y="0" width="8" height="22" rx="1" data-day="${day}" data-incident-id="${incId}" data-note="${escapeAttr(note)}" onclick="openIncidentDetail('${incId}')" role="button" tabindex="0"></rect>`;
    } else {
      barsHtml += `<rect class="uptime-bar-tick ${tickClass}" x="${x}" y="0" width="8" height="22" rx="1" data-day="${day}" data-note="${escapeAttr(note)}"></rect>`;
    }
  }
  return barsHtml;
}

function calculateUptimeMetric(svc) {
  if (currentSystemState === "break" && svc.status === "outage") {
    return "98.89 % uptime";
  }
  if (currentSystemState === "recover" && svc.id === "svc-fl2") {
    return "99.89 % uptime";
  }
  if (svc.status === "outage") {
    return "98.91 % uptime";
  }
  if (svc.status === "degraded") {
    return "99.78 % uptime";
  }
  if (svc.degradedDays && svc.degradedDays.length > 0) {
    return "99.89 % uptime";
  }
  return "100 % uptime";
}

// 3.3 Locations Tab
function renderLocations() {
  const container = document.getElementById("locations-accordion-container");
  if (!container) return;

  const searchQuery = (document.getElementById("location-search")?.value || "").toLowerCase().trim();
  const selectedRegion = document.getElementById("region-filter")?.value || "all";

  let html = "";

  REGIONAL_LOCATIONS.forEach(reg => {
    if (selectedRegion !== "all" && reg.region !== selectedRegion) {
      return;
    }

    const filteredPops = reg.pops.filter(pop =>
      pop.city.toLowerCase().includes(searchQuery) ||
      pop.country.toLowerCase().includes(searchQuery) ||
      pop.code.toLowerCase().includes(searchQuery)
    );

    if (filteredPops.length === 0) return;

    const isCollapsed = collapsedRegions.has(reg.region);

    html += `
      <div class="service-accordion-card" id="region-${reg.region}">
        <div class="service-accordion-header" onclick="toggleRegion('${reg.region}')">
          <div class="accordion-title-left">
            <i class="ph-bold ph-caret-down accordion-chevron ${isCollapsed ? 'collapsed' : ''}"></i>
            <span>${reg.region}</span>
          </div>
          <div class="accordion-count-right">
            <span>${reg.totalCount} locations</span>
            <button type="button" class="btn-subscribe-plus ${isRegionFullySubscribed(reg) ? 'subscribed' : ''}" onclick="toggleRegionSubscription(event, '${reg.region}')" data-tooltip-name="${reg.region}" aria-label="Subscribe to ${reg.region}">
              <i class="${isRegionFullySubscribed(reg) ? 'ph-bold ph-check' : 'ph ph-plus'}"></i>
            </button>
          </div>
        </div>
        <div class="service-accordion-body ${isCollapsed ? 'collapsed' : ''}">
    `;

    filteredPops.forEach(pop => {
      let statusDotClass = pop.status === "rerouted" ? "rerouted" : "operational";
      let statusTagClass = pop.status === "rerouted" ? "rerouted" : "";
      let statusTagText = pop.tag;

      if (currentSystemState === "break") {
        statusDotClass = "outage";
        statusTagClass = "outage";
        statusTagText = "502 CRASH";
      } else if (currentSystemState === "recover" && pop.status === "rerouted") {
        statusDotClass = "operational";
        statusTagClass = "";
        statusTagText = "Operational";
      }

      const cleanTag = (statusTagText || "").replace(" +", "");
      const isSubscribed = userSubscriptions.has(pop.city);

      html += `
        <div class="location-row" onclick="focusPopCode('${pop.code}')">
          <div class="location-left">
            <span class="location-dot ${statusDotClass}"></span>
            <span class="location-name">${pop.city}, ${pop.country}</span>
            <span class="location-code">${pop.code}</span>
          </div>
          <div class="location-status-right">
            <div class="location-status-tag ${statusTagClass}">
              ${cleanTag}
            </div>
            <button type="button" class="btn-subscribe-plus ${isSubscribed ? 'subscribed' : ''}" onclick="toggleLocationSubscription(event, '${reg.region}', '${pop.city}')" data-tooltip-name="${pop.city} (${pop.code})" aria-label="Subscribe to ${pop.city}">
              <i class="${isSubscribed ? 'ph-bold ph-check' : 'ph ph-plus'}"></i>
            </button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  attachTooltipListeners();
}

function toggleRegion(regionName) {
  if (collapsedRegions.has(regionName)) {
    collapsedRegions.delete(regionName);
  } else {
    collapsedRegions.add(regionName);
  }
  renderLocations();
}

function filterLocations(shouldPanMap = false) {
  renderLocations();
  if (leafletMap) {
    updateMapMarkers();
    if (shouldPanMap) {
      const selectedRegion = document.getElementById("region-filter")?.value || "all";
      if (selectedRegion === "all") {
        leafletMap.flyTo([20, 15], 2, { duration: 0.8 });
      } else {
        const regObj = REGIONAL_LOCATIONS.find(r => r.region === selectedRegion);
        if (regObj && regObj.pops.length > 0) {
          const latLngs = regObj.pops.map(p => [p.lat, p.lng]);
          leafletMap.fitBounds(latLngs, { padding: [40, 40], maxZoom: 5 });
        }
      }
    }
  }
}

// 3.4 History Tab
function getEffectiveHistoryRecords() {
  if (incidentsData && incidentsData.length > 0) {
    const dynamicItems = incidentsData.map((inc, i) => ({
      id: inc.id || `inc-dyn-${i}`,
      title: inc.title,
      type: "incident",
      impact: inc.severity === "critical" ? "Critical" : inc.severity === "major" ? "Major" : "Minor",
      status: inc.status === "resolved" ? "Resolved" : inc.status === "investigating" ? "Investigating" : "Identified",
      date: formatIncidentDate(inc.started_at),
      service: inc.service || "fl2",
      location: "all",
      dotClass: inc.status === "resolved" ? "amber" : "rose",
      statusClass: inc.status === "resolved" ? "status-text-resolved" : inc.status === "investigating" ? "status-text-identified" : "status-text-progress"
    }));
    return [...dynamicItems, ...HISTORY_RECORDS];
  }
  return HISTORY_RECORDS;
}

function renderHistory() {
  const container = document.getElementById("history-list-container");
  if (!container) return;

  const typeFilter = document.getElementById("history-filter-type")?.value || "all";
  const serviceFilter = document.getElementById("history-filter-service")?.value || "all";
  const locationFilter = document.getElementById("history-filter-location")?.value || "all";

  const allRecords = getEffectiveHistoryRecords();

  const filtered = allRecords.filter(item => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (serviceFilter !== "all" && item.service !== serviceFilter) return false;
    if (locationFilter !== "all" && item.location !== locationFilter && item.location !== "all") return false;
    return true;
  });

  container.innerHTML = filtered.map(item => `
    <div class="incident-row" onclick="openIncidentDetail('${item.id}')" data-incident-id="${item.id}" role="button" tabindex="0">
      <div class="row-left">
        <span class="status-dot-circle ${item.dotClass}"></span>
        <span class="row-title">${item.title}</span>
      </div>
      <div class="row-right">
        ${item.impact ? `<span class="impact-badge-minor">${item.impact}</span>` : ""}
        <span class="${item.statusClass}">${item.status}</span>
        <span class="row-date">${item.date}</span>
      </div>
    </div>
  `).join("");
}

function filterHistory() {
  renderHistory();
}

// ============================================================================
// 3.4.1 INCIDENT DETAIL CONTROLLER & FORMATTERS
// ============================================================================

const SERVICE_NAME_LOOKUP = {
  "svc-fl2": "Core FL2 Proxy Engine (Rust [Feature; 200])",
  "svc-ja4": "JA4 / JA3 Cryptographic Fingerprint Evaluator",
  "svc-tcp": "TCP Transport & SYN-ACK Latency Evaluator",
  "svc-h2": "HTTP/2 & HTTP/3 Frame Protocol Analyzer",
  "svc-entropy": "Shannon Header & Request Entropy Scorer",
  "svc-ip": "Bring Your Own IP (BYOIP)",
  "svc-hints": "Client Hints & Behavioral Biometrics Engine",
  "svc-cdn": "CDN/Cache Rules Engine",
  "svc-online": "Always Online",
  "svc-reserve": "Cache Reserve",
  "svc-purge": "CDN Cache Purge",
  "svc-connector": "Cloud Connector",
  "svc-custom-pages": "Custom Pages",
  "svc-tiered-cache": "Tiered Cache & Origin Shield",
  "svc-early-hints": "Early Hints 103",
  "svc-image-resizing": "Image Resizing Engine",
  "svc-stream-delivery": "Stream Delivery",
  "svc-catalog": "ClickHouse Catalog Introspection (system.columns)",
  "svc-registry": "Dynamic Feature Registry (KNOWN_FEATURES)",
  "svc-payload": "Dynamic JSON Payload Distributor (features.json)",
  "svc-ch-cluster": "ClickHouse Sharded Analytics Cluster",
  "svc-shards": "Shard Replica Tables (events_r0 / events_r1)",
  "svc-kv": "Distributed Edge KV & Durable Objects",
  "svc-api": "API & Scoped Edge Tokens",
  "svc-dns": "1.1.1.1 DNS Resolver"
};

function formatTimestampForTimezone(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (useUtc) {
      const day = d.getUTCDate();
      const month = months[d.getUTCMonth()];
      const year = d.getUTCFullYear();
      const hours = String(d.getUTCHours()).padStart(2, "0");
      const mins = String(d.getUTCMinutes()).padStart(2, "0");
      return `${day} ${month} ${year}, ${hours}.${mins} UTC`;
    } else {
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hours = d.getHours();
      const mins = String(d.getMinutes()).padStart(2, "0");

      let tzSuffix = "";
      try {
        const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(d);
        const tz = parts.find(p => p.type === "timeZoneName");
        if (tz && tz.value) tzSuffix = " " + tz.value;
      } catch (_) {}

      return `${day} ${month} ${year}, ${hours}.${mins}${tzSuffix}`;
    }
  } catch (_) {
    return isoString;
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return "Upcoming";
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return "Just now";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } catch (_) {
    return "";
  }
}

function findIncidentById(id) {
  if (!id) return null;

  // 1. Search dynamic incidents loaded from Turso / data/incidents.json
  if (incidentsData && incidentsData.length > 0) {
    const found = incidentsData.find(inc => inc.id === id);
    if (found) return found;
  }

  // 2. Search RECENT_INCIDENTS fallback
  const recFound = RECENT_INCIDENTS.find(inc => inc.id === id);
  if (recFound) {
    return {
      id: recFound.id,
      title: recFound.title,
      service: recFound.service || "fl2",
      service_group: "group-proxy",
      severity: (recFound.impact || "minor").toLowerCase(),
      status: (recFound.status || "resolved").toLowerCase(),
      impact: `${recFound.impact || "Minor"} Impact`,
      root_cause: "Subsystem transient telemetry deviation",
      started_at: "2026-09-24T10:22:34.763Z",
      resolved_at: "2026-09-24T10:25:52.106Z",
      updates: [
        {
          time: "2026-09-24T10:25:52.106Z",
          status: "resolved",
          title: "Resolved",
          message: `This incident has been resolved. Error rates and latency across ${recFound.title} returned to normal operating parameters.`
        },
        {
          time: "2026-09-24T10:22:34.862Z",
          status: "investigating",
          title: "Investigating",
          message: `We are currently investigating elevated errors and transient performance degradation regarding ${recFound.title}.`
        }
      ]
    };
  }

  // 3. Search maintenance records
  const maintFound = ACTIVE_MAINTENANCE.find(m => m.id === id || `maint-${m.location}` === id || m.location === id);
  if (maintFound) {
    return {
      id: maintFound.id || id,
      title: maintFound.title,
      service: maintFound.location || "fl2",
      service_group: "group-proxy",
      severity: "maintenance",
      status: "in_progress",
      impact: "Scheduled Maintenance",
      root_cause: `Planned core edge network and routing maintenance in ${maintFound.location || "regional PoP"}.`,
      started_at: "2026-09-24T06:00:00.000Z",
      resolved_at: null,
      updates: [
        {
          time: "2026-09-24T06:30:00.000Z",
          status: "in_progress",
          title: "In Progress",
          message: `Maintenance is actively in progress. Edge traffic is successfully re-routed to adjacent PoPs with zero service interruption.`
        },
        {
          time: "2026-09-24T06:00:00.000Z",
          status: "scheduled",
          title: "Scheduled",
          message: `Scheduled window begins for router firmware upgrades and fiber circuit verification at ${maintFound.location}.`
        }
      ]
    };
  }

  // 4. Search history records
  const histFound = HISTORY_RECORDS.find(h => h.id === id);
  if (histFound) {
    const isMaint = histFound.type === "maintenance";
    return {
      id: histFound.id,
      title: histFound.title,
      service: histFound.service || "fl2",
      service_group: "group-proxy",
      severity: isMaint ? "maintenance" : (histFound.impact || "minor").toLowerCase(),
      status: (histFound.status || "resolved").toLowerCase().replace(" ", "_"),
      impact: isMaint ? "Scheduled Maintenance" : `${histFound.impact || "Minor"} Impact`,
      root_cause: `Routine infrastructure lifecycle operation for ${histFound.title}.`,
      started_at: "2026-09-23T18:00:00.000Z",
      resolved_at: histFound.status === "Completed" ? "2026-09-23T20:00:00.000Z" : null,
      updates: [
        {
          time: "2026-09-23T20:00:00.000Z",
          status: histFound.status === "Completed" ? "resolved" : "in_progress",
          title: histFound.status,
          message: `${histFound.title} has completed all standard operational verification gates.`
        }
      ]
    };
  }

  // 5. Synthesized incident fallback for degraded ticks
  if (id.startsWith("inc-degraded-")) {
    const parts = id.split("-");
    const day = parts[parts.length - 1];
    const svcCode = parts.slice(2, -1).join("-") || "edge";
    const serviceObj = findServiceById(svcCode);
    const serviceName = serviceObj ? serviceObj.name : svcCode;
    const pastMs = (90 - parseInt(day, 10)) * 86400000;
    const startIso = new Date(Date.now() - pastMs).toISOString();
    const resolvedIso = new Date(Date.now() - pastMs + 2880000).toISOString();

    return {
      id: id,
      title: `Transient latency jitter on ${serviceName}`,
      service: svcCode,
      service_group: "group-proxy",
      severity: "minor",
      status: "resolved",
      impact: "Minor Performance Deviation",
      root_cause: `Upstream transit convergence jitter and regional edge route rebalancing for ${serviceName}.`,
      started_at: startIso,
      resolved_at: resolvedIso,
      updates: [
        {
          time: "Resolved",
          status: "resolved",
          title: "Resolved",
          message: "Transit route rebalancing completed and regional edge caches synchronized. Service operational baseline verified."
        },
        {
          time: "Monitoring",
          status: "monitoring",
          title: "Monitoring",
          message: "Route updates applied. Monitoring telemetry latency distributions and cache hit ratios."
        },
        {
          time: "Investigating",
          status: "investigating",
          title: "Investigating",
          message: `Investigating transient jitter and latency deviation across upstream ingress points for ${serviceName}.`
        }
      ]
    };
  }

  return null;
}

function openIncidentDetail(incidentId, pushState = true) {
  if (!incidentId) return;

  if (activeTab !== "incident-detail") {
    previousTabBeforeIncident = activeTab;
    try {
      localStorage.setItem("dirichlet-prev-tab", activeTab);
    } catch (_) {}
  }
  currentOpenIncidentId = incidentId;
  try {
    localStorage.setItem("dirichlet-active-tab", "incident-detail");
    localStorage.setItem("dirichlet-open-incident", incidentId);
  } catch (_) {}

  if (pushState) {
    if (window.location.hash !== "#incident/" + encodeURIComponent(incidentId)) {
      if (typeof window !== "undefined" && window.history && window.history.pushState) {
        window.history.pushState(null, "", "#incident/" + encodeURIComponent(incidentId));
      } else {
        window.location.hash = "#incident/" + encodeURIComponent(incidentId);
      }
    }
  }

  const incident = findIncidentById(incidentId);
  if (!incident) {
    console.warn("[app] Incident not found for id:", incidentId);
    showIncidentDetail({
      id: incidentId,
      title: "Loading Incident Details...",
      severity: "minor",
      status: "investigating",
      impact: "Incident Details",
      started_at: new Date().toISOString(),
      updates: []
    });
    return;
  }

  showIncidentDetail(incident);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showIncidentDetail(incident) {
  // 1. Hide all main tabs
  const tabs = ["overview", "services", "metrics", "locations", "history"];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const view = document.getElementById(`view-${t}`);
    if (btn) {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    }
    if (view) view.style.display = "none";
  });

  // 2. Show Incident Detail View
  const detailView = document.getElementById("view-incident-detail");
  if (!detailView) return;
  detailView.style.display = "block";
  activeTab = "incident-detail";

  const incidentTitle = incident.title || "Incident Details";
  updateDocumentTitle(incidentTitle);

  // 3. Populate Header Pill & Meta
  const impactElem = document.getElementById("incident-detail-impact");
  const lastUpdatedElem = document.getElementById("incident-detail-last-updated");
  const titleElem = document.getElementById("incident-detail-title");
  const startedElem = document.getElementById("incident-detail-started");
  const resolvedElem = document.getElementById("incident-detail-resolved");
  const resolvedCol = document.getElementById("incident-resolved-col");

  const severity = (incident.severity || "minor").toLowerCase();
  let impactLabel = "Minor Impact";
  let pillClass = "impact-minor";

  if (severity === "critical") {
    impactLabel = "Critical Outage";
    pillClass = "impact-critical";
  } else if (severity === "major") {
    impactLabel = "Major Impact";
    pillClass = "impact-major";
  } else if (severity === "maintenance") {
    impactLabel = "Maintenance";
    pillClass = "impact-maintenance";
  } else if (incident.status === "resolved") {
    impactLabel = incident.impact ? incident.impact : "Minor Impact";
    pillClass = "impact-minor";
  }

  if (impactElem) {
    impactElem.className = `incident-impact-pill ${pillClass}`;
    impactElem.textContent = impactLabel;
  }

  // Latest update relative time
  const updates = incident.updates || [];
  const latestUpdate = updates.length > 0 ? updates[0] : null;
  const latestTime = latestUpdate?.time || incident.resolved_at || incident.started_at;
  const relTimeStr = formatRelativeTime(latestTime);

  if (lastUpdatedElem) {
    lastUpdatedElem.textContent = relTimeStr ? `Last updated: ${relTimeStr}` : "Last updated: Just now";
  }

  const refreshedElem = document.getElementById("incident-detail-refreshed");
  if (refreshedElem) {
    refreshedElem.textContent = "Refreshed just now";
  }

  // 4. Title
  if (titleElem) {
    titleElem.textContent = incident.title;
  }

  // 5. Timestamps
  if (startedElem) {
    startedElem.textContent = formatTimestampForTimezone(incident.started_at);
  }

  if (resolvedElem && resolvedCol) {
    if (incident.resolved_at) {
      resolvedCol.style.display = "flex";
      resolvedElem.textContent = formatTimestampForTimezone(incident.resolved_at);
    } else {
      resolvedCol.style.display = "flex";
      resolvedElem.textContent = "In Progress";
    }
  }

  // 6. Timeline stream
  const timelineContainer = document.getElementById("incident-detail-timeline");
  if (timelineContainer) {
    if (updates.length === 0) {
      timelineContainer.innerHTML = `
        <li class="timeline-node">
          <span class="timeline-dot resolved"></span>
          <div class="timeline-node-header">
            <span class="timeline-status-name">Resolved</span>
            <span class="timeline-rel-time">Recorded</span>
          </div>
          <div class="timeline-node-timestamp">${formatTimestampForTimezone(incident.started_at)}</div>
          <p class="timeline-node-body">Incident resolved. Normal telemetry verified.</p>
        </li>
      `;
    } else {
      timelineContainer.innerHTML = updates.map(u => {
        const statusKey = (u.status || "investigating").toLowerCase();
        let dotClass = "investigating";
        if (statusKey === "resolved" || statusKey === "completed") {
          dotClass = "resolved";
        } else if (statusKey === "monitoring") {
          dotClass = "monitoring";
        } else if (statusKey === "identified") {
          dotClass = "identified";
        }

        const titleText = u.title || (statusKey.charAt(0).toUpperCase() + statusKey.slice(1));
        const relTime = formatRelativeTime(u.time);
        const absTime = formatTimestampForTimezone(u.time);

        return `
          <li class="timeline-node">
            <span class="timeline-dot ${dotClass}"></span>
            <div class="timeline-node-header">
              <span class="timeline-status-name">${titleText}</span>
              ${relTime ? `<span class="timeline-rel-time">${relTime}</span>` : ""}
            </div>
            <div class="timeline-node-timestamp">${absTime}</div>
            <p class="timeline-node-body">${u.message}</p>
          </li>
        `;
      }).join("");
    }
  }

  // 7. Affected Services Sidebar
  const servicesContainer = document.getElementById("incident-detail-services");
  const countElem = document.getElementById("incident-detail-service-count");

  const serviceCode = incident.service || "fl2";
  const serviceDisplayName = SERVICE_NAME_LOOKUP[serviceCode] || incident.service_name || serviceCode;

  if (countElem) {
    countElem.textContent = "1 Total";
  }

  if (servicesContainer) {
    servicesContainer.innerHTML = `
      <a href="#services" class="affected-service-pill" onclick="switchTab('services'); return false;" title="View in Services & Sites">
        <span class="service-pill-name">${serviceDisplayName}</span>
        <i class="ph-bold ph-caret-right" style="color: var(--text-dim); font-size: 0.75rem;"></i>
      </a>
    `;
  }

  // 8. Root Cause Card
  const rootCauseCard = document.getElementById("incident-root-cause-card");
  const rootCauseBody = document.getElementById("incident-detail-root-cause");
  if (rootCauseCard && rootCauseBody) {
    if (incident.root_cause) {
      rootCauseCard.style.display = "block";
      rootCauseBody.textContent = incident.root_cause;
    } else {
      rootCauseCard.style.display = "none";
    }
  }
}

function goBackFromIncident() {
  let targetTab = previousTabBeforeIncident;
  if (!targetTab || targetTab === "incident-detail") {
    try {
      targetTab = localStorage.getItem("dirichlet-prev-tab") || "overview";
    } catch (_) {
      targetTab = "overview";
    }
  }
  if (targetTab === "incident-detail") targetTab = "overview";
  switchTab(targetTab, true);
}

function refreshIncidentDetail() {
  const icon = document.getElementById("incident-refresh-icon");
  if (icon) {
    icon.classList.remove("spin");
    void icon.offsetWidth;
    icon.classList.add("spin");
    setTimeout(() => icon.classList.remove("spin"), 600);
  }

  const refreshedElem = document.getElementById("incident-detail-refreshed");
  if (refreshedElem) {
    refreshedElem.textContent = "Refreshed just now";
  }

  loadTelemetryData();
  if (currentOpenIncidentId) {
    const inc = findIncidentById(currentOpenIncidentId);
    if (inc) showIncidentDetail(inc);
  }
  showToast("Incident status refreshed");
}

// ============================================================================
// 3.5 EDGE TELEMETRY & PERFORMANCE CHARTS (Native SVG)
// ============================================================================

function formatChartTime(ts, full = false) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (full) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + (useUtc ? " UTC" : "");
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (_) {
    return "";
  }
}

function renderSvgChart(containerId, options) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const data = options.data || [];
  if (data.length === 0) return;

  const width = 800;
  const height = 200;
  const padding = { top: 22, right: 30, bottom: 25, left: 55 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const series = options.series || [{ key: "val", color: "#10b981", name: "Value" }];
  let yMin = options.yMin !== undefined ? options.yMin : Infinity;
  let yMax = options.yMax !== undefined ? options.yMax : -Infinity;

  series.forEach(s => {
    data.forEach(d => {
      const val = d[s.key];
      if (typeof val === "number" && !isNaN(val)) {
        if (options.yMin === undefined && val < yMin) yMin = val;
        if (options.yMax === undefined && val > yMax) yMax = val;
      }
    });
  });

  if (options.targetThreshold !== undefined) {
    if (options.targetThreshold > yMax) yMax = options.targetThreshold * 1.15;
  }

  if (yMin === Infinity) yMin = 0;
  if (yMax === -Infinity || yMax === yMin) yMax = yMin + 10;
  if (options.forceZeroMin) yMin = 0;

  yMax = yMax * 1.05;
  const yRange = yMax - yMin || 1;

  const getX = i => padding.left + (i / Math.max(1, data.length - 1)) * plotWidth;
  const getY = val => padding.top + plotHeight - ((val - yMin) / yRange) * plotHeight;

  // 4 Horizontal Grid lines & labels
  const ticks = 4;
  let gridSvg = "";
  for (let t = 0; t <= ticks; t++) {
    const tickVal = yMin + (t / ticks) * yRange;
    const yPos = getY(tickVal);
    const formattedVal = options.formatY ? options.formatY(tickVal) : tickVal.toFixed(options.decimals || 0);

    gridSvg += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" class="chart-grid-line" />
      <text x="${padding.left - 8}" y="${yPos + 3}" text-anchor="end" class="chart-axis-label">${formattedVal}</text>
    `;
  }

  // Optional target threshold line
  let thresholdSvg = "";
  if (options.targetThreshold !== undefined) {
    const threshY = getY(options.targetThreshold);
    thresholdSvg = `
      <line x1="${padding.left}" y1="${threshY}" x2="${width - padding.right}" y2="${threshY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.85" />
      <text x="${width - padding.right - 4}" y="${threshY - 5}" text-anchor="end" fill="#ef4444" font-size="9" font-family="var(--font-mono)">${options.thresholdLabel || "Threshold"}</text>
    `;
  }

  // Series paths & gradient fills
  let seriesSvg = "";
  let defsSvg = "";

  series.forEach((s, idx) => {
    const gradId = `grad-${containerId}-${idx}`;
    defsSvg += `
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.color}" stop-opacity="0.25" />
        <stop offset="100%" stop-color="${s.color}" stop-opacity="0.0" />
      </linearGradient>
    `;

    const points = data.map((d, i) => {
      const v = typeof d[s.key] === "number" ? d[s.key] : yMin;
      return `${getX(i).toFixed(1)},${getY(v).toFixed(1)}`;
    });

    const linePointsStr = points.join(" ");
    const areaPointsStr = `${getX(0).toFixed(1)},${getY(yMin).toFixed(1)} ${linePointsStr} ${getX(data.length - 1).toFixed(1)},${getY(yMin).toFixed(1)}`;

    seriesSvg += `
      <polygon points="${areaPointsStr}" fill="url(#${gradId})" />
      <polyline points="${linePointsStr}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    `;
  });

  // Time Axis Labels (start, mid, end)
  let timeAxisSvg = "";
  if (data.length > 0) {
    const tStart = formatChartTime(data[0]?.timestamp);
    const tMid = formatChartTime(data[Math.floor(data.length / 2)]?.timestamp);
    const tEnd = formatChartTime(data[data.length - 1]?.timestamp);

    timeAxisSvg = `
      <text x="${padding.left}" y="${height - 6}" class="chart-axis-label">${tStart}</text>
      <text x="${padding.left + plotWidth / 2}" y="${height - 6}" text-anchor="middle" class="chart-axis-label">${tMid}</text>
      <text x="${width - padding.right}" y="${height - 6}" text-anchor="end" class="chart-axis-label">${tEnd}</text>
    `;
  }

  const dotsHtml = series.map(s => `<circle class="chart-scrubber-dot chart-dot-${s.key}" cx="0" cy="0" r="4" style="display:none; fill:${s.color}; stroke:#ffffff; stroke-width:1.5;" />`).join("");

  const svgHtml = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>${defsSvg}</defs>
      ${gridSvg}
      ${thresholdSvg}
      ${seriesSvg}
      ${timeAxisSvg}
      <line class="chart-scrubber-line" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}" style="display:none; stroke:var(--border-subtle); stroke-dasharray:2 3; stroke-width:1;" />
      ${dotsHtml}
    </svg>
  `;

  container.innerHTML = svgHtml;

  // Interactive scrubber on hover
  const svgElem = container.querySelector("svg");

  if (svgElem) {
    svgElem.addEventListener("mousemove", e => {
      const rect = svgElem.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const svgX = relX * width;

      if (svgX < padding.left || svgX > width - padding.right) {
        hideArrowTooltip();
        const scrubberLine = svgElem.querySelector(".chart-scrubber-line");
        if (scrubberLine) scrubberLine.style.display = "none";
        svgElem.querySelectorAll(".chart-scrubber-dot").forEach(d => d.style.display = "none");
        return;
      }

      const ratio = (svgX - padding.left) / plotWidth;
      const idx = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
      const pt = data[idx];
      if (!pt) return;

      const ptSvgX = getX(idx);
      const scrubberLine = svgElem.querySelector(".chart-scrubber-line");
      if (scrubberLine) {
        scrubberLine.setAttribute("x1", ptSvgX);
        scrubberLine.setAttribute("x2", ptSvgX);
        scrubberLine.style.display = "block";
      }

      let primarySvgY = height / 2;
      series.forEach((s, sIdx) => {
        const val = typeof pt[s.key] === "number" ? pt[s.key] : yMin;
        const ptSvgY = getY(val);
        if (sIdx === 0) primarySvgY = ptSvgY;
        const dot = svgElem.querySelector(`.chart-dot-${s.key}`);
        if (dot) {
          dot.setAttribute("cx", ptSvgX);
          dot.setAttribute("cy", ptSvgY);
          dot.style.display = "block";
        }
      });

      let tooltipHtml = `<div style="color:var(--text-dim);font-size:0.6875rem;margin-bottom:4px;font-family:var(--font-mono);">${formatChartTime(pt.timestamp, true)}</div>`;
      series.forEach(s => {
        const val = pt[s.key];
        const formattedVal = options.formatTooltip ? options.formatTooltip(val, s.key) : val;
        tooltipHtml += `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;margin-top:2px;font-family:var(--font-mono);"><span style="color:${s.color};font-size:10px;">●</span><span style="color:var(--text-muted);">${s.name}:</span><span style="font-weight:600;color:var(--text-default);">${formattedVal}</span></div>`;
      });

      const screenX = rect.left + (ptSvgX / width) * rect.width;
      const screenY = rect.top + (primarySvgY / height) * rect.height - 6;

      positionArrowTooltipAtPoint(screenX, screenY, tooltipHtml);
    });

    svgElem.addEventListener("mouseleave", () => {
      hideArrowTooltip();
      const scrubberLine = svgElem.querySelector(".chart-scrubber-line");
      if (scrubberLine) scrubberLine.style.display = "none";
      svgElem.querySelectorAll(".chart-scrubber-dot").forEach(d => d.style.display = "none");
    });
  }
}

function renderAllCharts() {
  const rawDataset = (metricsData && metricsData.length > 0) ? metricsData : DEFAULT_METRICS;
  const dataset = rawDataset.map(d => ({
    ...d,
    p99_latency_ms: d.p99_latency_ms !== undefined ? d.p99_latency_ms : +(1.15 + ((d.p99_latency_ns || 7.6) - 7.6) * 0.05).toFixed(2)
  }));

  renderSvgChart("overview-chart-container", {
    data: dataset,
    series: [{ key: "p99_latency_ms", color: "#10b981", name: "Latency" }],
    targetThreshold: 15,
    thresholdLabel: "15 ms Target",
    formatY: v => v.toFixed(1) + " ms",
    formatTooltip: v => (typeof v === "number" ? v.toFixed(2) + " ms" : v),
    forceZeroMin: true
  });

  renderSvgChart("metrics-latency-chart", {
    data: dataset,
    series: [{ key: "p99_latency_ms", color: "#10b981", name: "p99 Latency" }],
    targetThreshold: 15,
    thresholdLabel: "15 ms Threshold",
    formatY: v => v.toFixed(1) + " ms",
    formatTooltip: v => (typeof v === "number" ? v.toFixed(2) + " ms" : v),
    forceZeroMin: true
  });

  renderSvgChart("metrics-throughput-chart", {
    data: dataset,
    series: [{ key: "traffic_rps", color: "#3b82f6", name: "Throughput" }],
    formatY: v => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v),
    formatTooltip: v => (typeof v === "number" ? v.toLocaleString() + " req/s" : v)
  });

  renderSvgChart("metrics-cardinality-chart", {
    data: dataset,
    series: [
      { key: "active_signals", color: "#10b981", name: "Active Rules" },
      { key: "dropped_signals", color: "#f59e0b", name: "Fallback Rules" }
    ],
    yMax: 240,
    forceZeroMin: true,
    formatY: v => Math.round(v) + " rules",
    formatTooltip: v => v + " rules"
  });
}

// ============================================================================
// 4. TELEMETRY STATE CONTROLLER (Nominal / Break / Recover)
// ============================================================================

function setSystemState(state, telemetry) {
  currentSystemState = state;

  // Telemetry Banner Stats
  const statLat = document.getElementById("stat-latency");
  const statLatTarget = document.getElementById("stat-latency-target");
  const statRps = document.getElementById("stat-rps");
  const statRpsMeta = document.getElementById("stat-rps-meta");
  const statSignals = document.getElementById("stat-signals");
  const statSignalsMeta = document.getElementById("stat-signals-meta");
  const statDropped = document.getElementById("stat-dropped");
  const statDroppedMeta = document.getElementById("stat-dropped-meta");

  // Active Incidents in Overview Tab
  const activeSection = document.getElementById("active-incidents-section");
  const activeList = document.getElementById("active-incidents-list");

  // Services & Sites Counters
  const mOper = document.getElementById("metric-operational");
  const mDegr = document.getElementById("metric-degraded");
  const mOffl = document.getElementById("metric-offline");
  const mMain = document.getElementById("metric-maintenance");

  // Locations Status Summary Counters
  const locOper = document.getElementById("loc-summary-operational");
  const locReroute = document.getElementById("loc-summary-rerouted");
  const locPartial = document.getElementById("loc-summary-partial");

  if (state === "nominal") {
    if (statLat) statLat.textContent = (telemetry && telemetry.latency_ms) ? Number(telemetry.latency_ms).toFixed(2) : "1.18";
    if (statLatTarget) {
      statLatTarget.className = "stat-meta text-emerald";
      statLatTarget.textContent = "Optimal < 15.0 ms target";
    }
    if (statRps) statRps.textContent = (telemetry && telemetry.traffic_rps) ? Number(telemetry.traffic_rps).toLocaleString() : "52,400";
    if (statRpsMeta) {
      statRpsMeta.className = "stat-meta";
      statRpsMeta.textContent = "Global PoPs Nominal";
    }
    if (statSignals) statSignals.textContent = (telemetry && telemetry.active_features) ? `${Math.round((telemetry.active_features / 200) * 100)}%` : "100%";
    if (statSignalsMeta) {
      statSignalsMeta.className = "stat-meta text-emerald";
      statSignalsMeta.textContent = "All 200 Security Rules Active";
    }
    if (statDropped) statDropped.textContent = "< 0.001%";
    if (statDroppedMeta) {
      statDroppedMeta.className = "stat-meta";
      statDroppedMeta.textContent = "Zero degraded routes";
    }

    if (activeSection) activeSection.style.display = "none";
    if (activeList) activeList.innerHTML = "";

    if (mOper) mOper.textContent = "125";
    if (mDegr) mDegr.textContent = "3";
    if (mOffl) mOffl.textContent = "0";
    if (mMain) mMain.textContent = "0";

    if (locOper) locOper.textContent = "299";
    if (locReroute) locReroute.textContent = "18";
    if (locPartial) locPartial.textContent = "25";

    setServiceStatus("svc-fl2", "operational", "Operational");
    setServiceStatus("svc-catalog", "operational", "Operational");

  } else if (state === "break") {
    if (statLat) statLat.textContent = "248.50";
    if (statLatTarget) {
      statLatTarget.className = "stat-meta text-rose";
      statLatTarget.textContent = "CRITICAL LATENCY SPIKE (502s)";
    }
    if (statRps) statRps.textContent = (telemetry && telemetry.traffic_rps) ? Number(telemetry.traffic_rps).toLocaleString() : "1,820";
    if (statRpsMeta) {
      statRpsMeta.className = "stat-meta text-rose";
      statRpsMeta.textContent = "96.5% Ingestion Failure (502s)";
    }
    if (statSignals) statSignals.textContent = "14.2%";
    if (statSignalsMeta) {
      statSignalsMeta.className = "stat-meta text-rose";
      statSignalsMeta.textContent = "Cardinality Drift Panic";
    }
    if (statDropped) statDropped.textContent = "96.5%";
    if (statDroppedMeta) {
      statDroppedMeta.className = "stat-meta text-rose";
      statDroppedMeta.textContent = "High Error Budget Burn";
    }

    if (activeSection) activeSection.style.display = "block";
    if (activeList) {
      activeList.innerHTML = `
        <div class="active-incident-card" onclick="openIncidentDetail('inc-2026-09-24-drift')" data-incident-id="inc-2026-09-24-drift" role="button" tabindex="0">
          <div class="active-incident-main">
            <div class="active-incident-title">
              CRITICAL: L7 Edge Proxy Ingestion Panic (TryFromSliceError)
            </div>
            <span class="active-incident-tag">Core FL2 Proxy Engine</span>
          </div>
          <span class="active-incident-badge outage">Investigating</span>
        </div>
        <div class="active-incident-card" onclick="openIncidentDetail('inc-2026-09-18-shards')" data-incident-id="inc-2026-09-18-shards" role="button" tabindex="0">
          <div class="active-incident-main">
            <div class="active-incident-title">
              Cross-Boundary Schema Reflection Cardinality Drift (280 Features)
            </div>
            <span class="active-incident-tag">ClickHouse system.columns</span>
          </div>
          <span class="active-incident-badge">Identified</span>
        </div>
      `;
    }

    if (mOper) mOper.textContent = "122";
    if (mDegr) mDegr.textContent = "3";
    if (mOffl) mOffl.textContent = "3";
    if (mMain) mMain.textContent = "0";

    if (locOper) locOper.textContent = "180";
    if (locReroute) locReroute.textContent = "85";
    if (locPartial) locPartial.textContent = "77";

    setServiceStatus("svc-fl2", "outage", "Major Outage");
    setServiceStatus("svc-catalog", "degraded", "Degraded");

  } else if (state === "recover") {
    if (statLat) statLat.textContent = "1.22";
    if (statLatTarget) {
      statLatTarget.className = "stat-meta text-emerald";
      statLatTarget.textContent = "Optimal (1.22 ms < 15.0 ms target)";
    }
    if (statRps) statRps.textContent = (telemetry && telemetry.traffic_rps) ? Number(telemetry.traffic_rps).toLocaleString() : "52,800";
    if (statRpsMeta) {
      statRpsMeta.className = "stat-meta text-emerald";
      statRpsMeta.textContent = "Global PoPs Recovered (100% Traffic)";
    }
    if (statSignals) statSignals.textContent = "100%";
    if (statSignalsMeta) {
      statSignalsMeta.className = "stat-meta text-emerald";
      statSignalsMeta.textContent = "All 200 Security Rules Active";
    }
    if (statDropped) statDropped.textContent = "< 0.001%";
    if (statDroppedMeta) {
      statDroppedMeta.className = "stat-meta text-emerald";
      statDroppedMeta.textContent = "Zero degraded routes (80 Shed)";
    }

    if (activeSection) activeSection.style.display = "block";
    if (activeList) {
      activeList.innerHTML = `
        <div class="active-incident-card" onclick="openIncidentDetail('inc-2026-09-24-drift')" data-incident-id="inc-2026-09-24-drift" role="button" tabindex="0">
          <div class="active-incident-main">
            <div class="active-incident-title">
              RESOLVED: In-Place Partial Selection Shed 80 Shadow Columns (100% Uptime)
            </div>
            <span class="active-incident-tag">Zero-Alloc Ingestion Engine</span>
          </div>
          <span class="active-incident-badge resolved">Resolved</span>
        </div>
      `;
    }

    if (mOper) mOper.textContent = "124";
    if (mDegr) mDegr.textContent = "4";
    if (mOffl) mOffl.textContent = "0";
    if (mMain) mMain.textContent = "0";

    if (locOper) locOper.textContent = "342";
    if (locReroute) locReroute.textContent = "0";
    if (locPartial) locPartial.textContent = "0";

    setServiceStatus("svc-fl2", "degraded", "Operational (80 Shed)");
    setServiceStatus("svc-catalog", "operational", "Operational");
  }

  renderServices();
  renderLocations();
  if (leafletMap) {
    updateMapMarkers();
  }
}

function setServiceStatus(svcId, status, label) {
  for (const group of SERVICE_GROUPS) {
    for (const svc of group.services) {
      if (svc.id === svcId) {
        svc.status = status;
        svc.overrideLabel = label;
      }
    }
  }
}

// ============================================================================
// 5. TOOLTIPS, SUBSCRIPTIONS & LEAFLET MAP
// ============================================================================

function positionArrowTooltip(target, htmlContent) {
  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (!tooltip || !target) return;

  tooltip.innerHTML = htmlContent;
  tooltip.style.display = "block";

  const rect = target.getBoundingClientRect();
  const targetCenterX = rect.left + (rect.width / 2);
  const targetTop = rect.top;

  const tooltipWidth = tooltip.offsetWidth;
  let tooltipLeft = targetCenterX;

  const halfWidth = tooltipWidth / 2;
  const padding = 12;

  if (tooltipLeft + halfWidth > window.innerWidth - padding) {
    tooltipLeft = window.innerWidth - padding - halfWidth;
  }
  if (tooltipLeft - halfWidth < padding) {
    tooltipLeft = padding + halfWidth;
  }

  const tooltipBoxLeft = tooltipLeft - halfWidth;
  const arrowOffset = Math.max(12, Math.min(tooltipWidth - 12, targetCenterX - tooltipBoxLeft));

  tooltip.style.setProperty("--arrow-left", `${arrowOffset}px`);
  tooltip.style.left = `${tooltipLeft}px`;
  tooltip.style.top = `${targetTop}px`;
}

function positionArrowTooltipAtPoint(targetX, targetY, htmlContent) {
  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (!tooltip) return;

  tooltip.innerHTML = htmlContent;
  tooltip.style.display = "block";

  const tooltipWidth = tooltip.offsetWidth;
  let tooltipLeft = targetX;

  const halfWidth = tooltipWidth / 2;
  const padding = 12;

  if (tooltipLeft + halfWidth > window.innerWidth - padding) {
    tooltipLeft = window.innerWidth - padding - halfWidth;
  }
  if (tooltipLeft - halfWidth < padding) {
    tooltipLeft = padding + halfWidth;
  }

  const tooltipBoxLeft = tooltipLeft - halfWidth;
  const arrowOffset = Math.max(12, Math.min(tooltipWidth - 12, targetX - tooltipBoxLeft));

  tooltip.style.setProperty("--arrow-left", `${arrowOffset}px`);
  tooltip.style.left = `${tooltipLeft}px`;
  tooltip.style.top = `${targetY}px`;
}

function hideArrowTooltip() {
  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (tooltip) {
    tooltip.style.display = "none";
  }
}

function attachTooltipListeners() {
  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (!tooltip) return;

  // 1. Tooltips for Circular Subscribe Plus Buttons
  const subscribeButtons = document.querySelectorAll(".btn-subscribe-plus");
  subscribeButtons.forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      const name = btn.getAttribute("data-tooltip-name") || "selection";
      const isSubscribed = userSubscriptions.has(name) || btn.classList.contains("subscribed");
      const action = isSubscribed ? "Remove" : "Add";
      positionArrowTooltip(btn, `${action} ${name} to selection`);
    });

    btn.addEventListener("mouseleave", () => {
      hideArrowTooltip();
    });
  });

  // 2. Tooltips for 90-Day Uptime Bar Ticks
  const ticks = document.querySelectorAll(".uptime-bar-tick");
  ticks.forEach(tick => {
    tick.addEventListener("mouseenter", () => {
      const day = tick.getAttribute("data-day");
      const note = tick.getAttribute("data-note");
      const incId = tick.getAttribute("data-incident-id");
      const svcName = tick.closest(".uptime-grid")?.getAttribute("data-svc-name") || "Service";

      let content = `<div style="font-weight: 600;">Day ${day}/90 · ${svcName}</div><div style="color: var(--text-dim); font-size: 0.75rem; margin-top: 2px;">${note}</div>`;
      if (incId) {
        content += `<div style="color: #60a5fa; font-size: 0.75rem; font-weight: 600; margin-top: 5px; display: flex; align-items: center; gap: 4px;">Click to view incident →</div>`;
      }
      positionArrowTooltip(tick, content);
    });

    tick.addEventListener("mouseleave", () => {
      hideArrowTooltip();
    });
  });
}

function isGroupFullySubscribed(group) {
  if (!group || !group.services || group.services.length === 0) return false;
  return group.services.every(s => userSubscriptions.has(s.name));
}

function isRegionFullySubscribed(reg) {
  if (!reg || !reg.pops || reg.pops.length === 0) return false;
  return reg.pops.every(p => userSubscriptions.has(p.city));
}

function toggleGroupSubscription(event, groupId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const group = SERVICE_GROUPS.find(g => g.id === groupId || g.name === groupId);
  if (!group) return;

  const fullySubscribed = isGroupFullySubscribed(group);

  if (fullySubscribed) {
    group.services.forEach(s => userSubscriptions.delete(s.name));
    userSubscriptions.delete(group.name);
    showToast(`Removed ${group.name} and all services from selection`);
  } else {
    group.services.forEach(s => userSubscriptions.add(s.name));
    userSubscriptions.add(group.name);
    showToast(`Added ${group.name} and all services to selection`);
  }

  renderServices();

  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (tooltip && tooltip.style.display === "block") {
    const isNowSubscribed = isGroupFullySubscribed(group);
    tooltip.innerHTML = `${isNowSubscribed ? "Remove" : "Add"} ${group.name} to selection`;
  }
}

function toggleServiceSubscription(event, groupId, svcName) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const group = SERVICE_GROUPS.find(g => g.id === groupId || g.name === groupId);
  const wasSubscribed = userSubscriptions.has(svcName);

  if (wasSubscribed) {
    userSubscriptions.delete(svcName);
    if (group) userSubscriptions.delete(group.name);
    showToast(`Removed ${svcName} from selection`);
  } else {
    userSubscriptions.add(svcName);
    if (group && isGroupFullySubscribed(group)) {
      userSubscriptions.add(group.name);
    }
    showToast(`Added ${svcName} to selection`);
  }

  renderServices();

  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (tooltip && tooltip.style.display === "block") {
    const isNowSubscribed = userSubscriptions.has(svcName);
    tooltip.innerHTML = `${isNowSubscribed ? "Remove" : "Add"} ${svcName} to selection`;
  }
}

function toggleRegionSubscription(event, regionName) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const reg = REGIONAL_LOCATIONS.find(r => r.region === regionName);
  if (!reg) return;

  const fullySubscribed = isRegionFullySubscribed(reg);

  if (fullySubscribed) {
    reg.pops.forEach(p => userSubscriptions.delete(p.city));
    userSubscriptions.delete(reg.region);
    showToast(`Removed ${reg.region} and all locations from selection`);
  } else {
    reg.pops.forEach(p => userSubscriptions.add(p.city));
    userSubscriptions.add(reg.region);
    showToast(`Added ${reg.region} and all locations to selection`);
  }

  renderLocations();

  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (tooltip && tooltip.style.display === "block") {
    const isNowSubscribed = isRegionFullySubscribed(reg);
    tooltip.innerHTML = `${isNowSubscribed ? "Remove" : "Add"} ${reg.region} to selection`;
  }
}

function toggleLocationSubscription(event, regionName, popCity) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const reg = REGIONAL_LOCATIONS.find(r => r.region === regionName);
  const wasSubscribed = userSubscriptions.has(popCity);

  if (wasSubscribed) {
    userSubscriptions.delete(popCity);
    if (reg) userSubscriptions.delete(reg.region);
    showToast(`Removed ${popCity} from selection`);
  } else {
    userSubscriptions.add(popCity);
    if (reg && isRegionFullySubscribed(reg)) {
      userSubscriptions.add(reg.region);
    }
    showToast(`Added ${popCity} to selection`);
  }

  renderLocations();

  const tooltip = document.getElementById("kumo-arrow-tooltip");
  if (tooltip && tooltip.style.display === "block") {
    const isNowSubscribed = userSubscriptions.has(popCity);
    tooltip.innerHTML = `${isNowSubscribed ? "Remove" : "Add"} ${popCity} to selection`;
  }
}

function toggleSubscription(event, name) {
  const group = SERVICE_GROUPS.find(g => g.name === name || g.id === name);
  if (group) return toggleGroupSubscription(event, group.id);

  for (const g of SERVICE_GROUPS) {
    const svc = g.services.find(s => s.name === name || s.id === name);
    if (svc) return toggleServiceSubscription(event, g.id, svc.name);
  }

  const reg = REGIONAL_LOCATIONS.find(r => r.region === name);
  if (reg) return toggleRegionSubscription(event, reg.region);

  for (const r of REGIONAL_LOCATIONS) {
    const pop = r.pops.find(p => p.city === name || `${p.city} (${p.code})` === name);
    if (pop) return toggleLocationSubscription(event, r.region, pop.city);
  }

  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (userSubscriptions.has(name)) {
    userSubscriptions.delete(name);
    showToast(`Removed ${name} from selection`);
  } else {
    userSubscriptions.add(name);
    showToast(`Added ${name} to selection`);
  }
  renderServices();
  renderLocations();
}

function showToast(message) {
  const toast = document.getElementById("kumo-toast");
  const msgElem = document.getElementById("toast-message");
  if (!toast || !msgElem) return;

  msgElem.textContent = message;
  toast.classList.add("visible");

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2500);
}

function subscribeToUpdates() {
  showToast("Subscribed to all incident updates");
}

Object.assign(window, {
  switchTab,
  toggleTimezone,
  cycleTheme,
  renderAllCharts,
  toggleServiceGroup,
  toggleRegion,
  filterServices,
  filterLocations,
  filterHistory,
  focusPopCode,
  resetMapView,
  setSystemState,
  isGroupFullySubscribed,
  isRegionFullySubscribed,
  toggleGroupSubscription,
  toggleServiceSubscription,
  toggleRegionSubscription,
  toggleLocationSubscription,
  toggleSubscription,
  showToast,
  subscribeToUpdates,
  openIncidentDetail,
  showIncidentDetail,
  goBackFromIncident,
  refreshIncidentDetail,
  applyInitialStateFromUrl,
  getIncidentsForService
});
window.addEventListener("scroll", hideArrowTooltip, { passive: true });

function initLocationsMap() {
  const mapElem = document.getElementById("locations-map");
  if (!mapElem || leafletMap) return;
  if (typeof L === "undefined") return;

  leafletMap = L.map("locations-map", {
    center: [20, 15],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    scrollWheelZoom: false,
    touchZoom: true,
    zoomControl: false,
    attributionControl: false
  });

  // Zoom control positioned in top right
  L.control.zoom({ position: "topright" }).addTo(leafletMap);

  // Enable pinch-to-zoom (trackpad) and Ctrl + Mouse Wheel zooming on the map without zooming the page
  let zoomAccumulator = 0;
  let zoomTimeout = null;

  mapElem.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();

      const mousePoint = leafletMap.mouseEventToLatLng(e);
      const factor = Math.abs(e.deltaY) > 50 ? 0.01 : 0.02;
      zoomAccumulator -= e.deltaY * factor;

      if (Math.abs(zoomAccumulator) >= 0.35) {
        const step = zoomAccumulator > 0 ? 1 : -1;
        zoomAccumulator = 0;
        const targetZoom = Math.max(
          leafletMap.getMinZoom(),
          Math.min(leafletMap.getMaxZoom(), leafletMap.getZoom() + step)
        );
        leafletMap.setZoomAround(mousePoint, targetZoom, { animate: true });
      }

      clearTimeout(zoomTimeout);
      zoomTimeout = setTimeout(() => {
        zoomAccumulator = 0;
      }, 150);
    }
  }, { passive: false });

  // Prevent browser viewport zoom on pinch gestures inside map
  mapElem.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  mapElem.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  mapElem.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

  updateMapTileLayer();
  updateMapMarkers();

  leafletMap.on("zoomstart", hideArrowTooltip);
  leafletMap.on("movestart", hideArrowTooltip);
  leafletMap.on("zoomend", updateMapMarkers);
  leafletMap.on("moveend", updateMapMarkers);
}

function updateMapTileLayer() {
  if (!leafletMap || typeof L === "undefined") return;

  if (tileLayer) {
    leafletMap.removeLayer(tileLayer);
    tileLayer = null;
  }

  // Standard OpenStreetMap tiles - zero API keys required, zero watermarks
  tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(leafletMap);
}

function updateMapMarkers() {
  if (!leafletMap || typeof L === "undefined") return;

  // Clear existing markers
  mapMarkers.forEach(m => {
    try {
      leafletMap.removeLayer(m);
    } catch (_) {}
  });
  mapMarkers = [];

  const currentZoom = leafletMap.getZoom();
  const isBreak = currentSystemState === "break";
  const isRecover = currentSystemState === "recover";

  const selectedRegion = document.getElementById("region-filter")?.value || "all";
  const searchQuery = (document.getElementById("location-search")?.value || "").toLowerCase().trim();

  // Flatten all PoPs with region metadata matching active filters
  const allPops = [];
  REGIONAL_LOCATIONS.forEach(reg => {
    if (selectedRegion !== "all" && reg.region !== selectedRegion) {
      return;
    }
    reg.pops.forEach(pop => {
      if (searchQuery) {
        const matches = pop.city.toLowerCase().includes(searchQuery) ||
                        pop.country.toLowerCase().includes(searchQuery) ||
                        pop.code.toLowerCase().includes(searchQuery);
        if (!matches) return;
      }
      let status = pop.status;
      if (isBreak) status = "outage";
      else if (isRecover && (status === "rerouted" || status === "partial")) status = "operational";
      allPops.push({ ...pop, region: reg.region, effectiveStatus: status });
    });
  });

  // Spatial screen-pixel clustering
  const clusterRadius = 42;
  const clusters = [];

  allPops.forEach(pop => {
    if (pop.lat === undefined || pop.lng === undefined) return;
    const latLng = L.latLng(pop.lat, pop.lng);
    const point = leafletMap.project(latLng, currentZoom);

    let foundCluster = null;
    for (const c of clusters) {
      const dist = Math.hypot(c.point.x - point.x, c.point.y - point.y);
      if (dist < clusterRadius) {
        foundCluster = c;
        break;
      }
    }

    if (foundCluster) {
      foundCluster.pops.push(pop);
      foundCluster.lat = (foundCluster.lat * (foundCluster.pops.length - 1) + pop.lat) / foundCluster.pops.length;
      foundCluster.lng = (foundCluster.lng * (foundCluster.pops.length - 1) + pop.lng) / foundCluster.pops.length;
      foundCluster.point = leafletMap.project(L.latLng(foundCluster.lat, foundCluster.lng), currentZoom);
    } else {
      clusters.push({
        lat: pop.lat,
        lng: pop.lng,
        point: point,
        pops: [pop]
      });
    }
  });

  clusters.forEach(cluster => {
    if (cluster.pops.length > 1) {
      // Grouped Cluster Marker
      const count = cluster.pops.length;
      const opCount = cluster.pops.filter(p => p.effectiveStatus === "operational").length;
      const reroutedCount = cluster.pops.filter(p => p.effectiveStatus === "rerouted").length;
      const partialCount = cluster.pops.filter(p => p.effectiveStatus === "partial").length;
      const outageCount = cluster.pops.filter(p => p.effectiveStatus === "outage").length;

      let bubbleModifier = "";
      if (outageCount > 0) bubbleModifier = "has-outage";
      else if (reroutedCount > 0) bubbleModifier = "has-rerouted";
      else if (partialCount > 0) bubbleModifier = "has-partial";

      const clusterIcon = L.divIcon({
        className: "kumo-cluster-marker",
        html: `
          ${outageCount > 0 ? '<div class="kumo-cluster-pulse-incident"></div>' : ''}
          <div class="kumo-cluster-bubble ${bubbleModifier}">
            <span>${count}</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon }).addTo(leafletMap);

      const clusterTooltipHtml = `
        <div style="font-weight: 600; font-size: 0.8125rem;">${count} locations in cluster</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 3px; margin-top: 4px;">
          <div><span style="color: #94a3b8; font-size: 0.6875rem;">●</span> ${opCount} Operational</div>
          ${reroutedCount > 0 ? `<div><span style="color: #f97316; font-size: 0.6875rem;">●</span> ${reroutedCount} Re-routed</div>` : ''}
          ${partialCount > 0 ? `<div><span style="color: #eab308; font-size: 0.6875rem;">●</span> ${partialCount} Partially Re-routed</div>` : ''}
          ${outageCount > 0 ? `<div><span style="color: #ef4444; font-size: 0.6875rem;">●</span> ${outageCount} Outage</div>` : ''}
        </div>
        <div style="margin-top: 5px; font-size: 0.6875rem; color: var(--text-dim); border-top: 1px solid var(--border-line); padding-top: 3px;">Click to zoom in</div>
      `;

      marker.on("mouseover", () => {
        const mapContainer = document.getElementById("locations-map");
        if (!mapContainer || !leafletMap) return;
        const mapRect = mapContainer.getBoundingClientRect();
        const containerPoint = leafletMap.latLngToContainerPoint([cluster.lat, cluster.lng]);
        const targetX = mapRect.left + containerPoint.x;
        const targetY = mapRect.top + containerPoint.y - 14;
        positionArrowTooltipAtPoint(targetX, targetY, clusterTooltipHtml);
      });

      marker.on("mouseout", () => {
        hideArrowTooltip();
      });

      marker.on("click", () => {
        hideArrowTooltip();
        leafletMap.flyTo([cluster.lat, cluster.lng], Math.min(10, currentZoom + 2), { duration: 0.7 });
      });

      mapMarkers.push(marker);
    } else {
      // Individual PoP Marker (Sleek solid dot)
      const pop = cluster.pops[0];
      const statusClass = pop.effectiveStatus;
      const statusLabel = statusClass === "outage" ? "Major Outage (502)" : statusClass === "rerouted" ? "Re-routed" : statusClass === "partial" ? "Partially Re-routed" : "Operational";

      const popIcon = L.divIcon({
        className: "pop-map-marker",
        html: `
          ${statusClass === 'outage' ? '<div class="pop-pulse-ring-incident"></div>' : ''}
          <div class="pop-dot-core ${statusClass}"></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([pop.lat, pop.lng], { icon: popIcon }).addTo(leafletMap);
      marker.popCode = pop.code;

      let dotColor = "#94a3b8";
      if (statusClass === "outage") dotColor = "#ef4444";
      else if (statusClass === "rerouted") dotColor = "#f97316";
      else if (statusClass === "partial") dotColor = "#eab308";

      const popTooltipHtml = `
        <div style="font-weight: 600; font-size: 0.8125rem;">${pop.city}, ${pop.country}</div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">PoP: ${pop.code} · ${pop.region}</div>
        <div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; font-weight: 500;">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${dotColor};"></span>
          <span>${statusLabel}</span>
        </div>
      `;

      marker.on("mouseover", () => {
        const mapContainer = document.getElementById("locations-map");
        if (!mapContainer || !leafletMap) return;
        const mapRect = mapContainer.getBoundingClientRect();
        const containerPoint = leafletMap.latLngToContainerPoint([pop.lat, pop.lng]);
        const targetX = mapRect.left + containerPoint.x;
        const targetY = mapRect.top + containerPoint.y - 8;
        positionArrowTooltipAtPoint(targetX, targetY, popTooltipHtml);
      });

      marker.on("mouseout", () => {
        hideArrowTooltip();
      });

      marker.on("click", () => {
        hideArrowTooltip();
        focusPopCode(pop.code);
      });

      mapMarkers.push(marker);
    }
  });
}

function resetMapView() {
  if (leafletMap) {
    leafletMap.flyTo([20, 15], 2, { duration: 1 });
  }
}

function focusPopCode(code) {
  if (!code) return;

  if (activeTab !== "locations") {
    switchTab("locations");
  }

  let targetPop = null;
  for (const reg of REGIONAL_LOCATIONS) {
    const found = reg.pops.find(p => p.code === code);
    if (found) {
      targetPop = found;
      break;
    }
  }

  if (!targetPop || targetPop.lat === undefined || targetPop.lng === undefined) return;

  setTimeout(() => {
    if (!leafletMap) initLocationsMap();
    if (!leafletMap) return;

    leafletMap.flyTo([targetPop.lat, targetPop.lng], 6, { duration: 1 });

    setTimeout(() => {
      const marker = mapMarkers.find(m => m.popCode === code);
      if (marker) {
        marker.openPopup();
      }
    }, 1100);

    const mapCard = document.querySelector(".locations-map-card");
    if (mapCard) {
      mapCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 120);
}

function applyInitialStateFromUrl() {
  const rawHash = (window.location.hash || "").replace("#", "").trim();

  // 1. Check if hash points to an incident
  if (rawHash.startsWith("incident/")) {
    const incId = decodeURIComponent(rawHash.replace("incident/", ""));
    openIncidentDetail(incId, false);
    return;
  }

  // 2. Check if hash matches one of our primary tabs
  const validTabs = ["overview", "services", "metrics", "locations", "history"];
  if (validTabs.includes(rawHash)) {
    switchTab(rawHash, false);
    return;
  }

  // 3. Check system state parameters (nominal / break / recover)
  const params = new URLSearchParams(window.location.search);
  const stateParam = params.get("state") || rawHash;
  if (["nominal", "break", "recover"].includes(stateParam)) {
    setSystemState(stateParam);
    return;
  }

  // 4. If no hash in URL, restore from localStorage persistence
  try {
    const savedTab = localStorage.getItem("dirichlet-active-tab");
    const savedIncident = localStorage.getItem("dirichlet-open-incident");

    if (savedTab === "incident-detail" && savedIncident) {
      openIncidentDetail(savedIncident, true);
      return;
    }

    if (savedTab && validTabs.includes(savedTab) && savedTab !== "overview") {
      switchTab(savedTab, true);
      return;
    }
  } catch (_) {}

  // 5. Default fallback
  switchTab("overview", false);
}

let lastMetricsHash = "";
let lastIncidentsHash = "";

async function loadTelemetryData() {
  try {
    const [statusRes, metricsRes, incRes] = await Promise.allSettled([
      fetch("status.json?_=" + Date.now(), { cache: "no-store" }),
      fetch("data/metrics_timeseries.json?_=" + Date.now(), { cache: "no-store" }),
      fetch("data/incidents.json?_=" + Date.now(), { cache: "no-store" })
    ]);

    if (statusRes.status === "fulfilled" && statusRes.value.ok) {
      const statusData = await statusRes.value.json();
      if (statusData && statusData.state && ["nominal", "break", "recover"].includes(statusData.state)) {
        if (statusData.state !== currentSystemState || !window.__initialTelemetryLoaded) {
          window.__initialTelemetryLoaded = true;
          setSystemState(statusData.state, statusData);
        }
      }
    }

    if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
      const remoteMetrics = await metricsRes.value.json();
      if (Array.isArray(remoteMetrics) && remoteMetrics.length > 0) {
        const hash = JSON.stringify(remoteMetrics);
        if (hash !== lastMetricsHash) {
          lastMetricsHash = hash;
          metricsData = remoteMetrics;
          renderAllCharts();
        }
      }
    }

    if (incRes.status === "fulfilled" && incRes.value.ok) {
      const remoteIncidents = await incRes.value.json();
      if (Array.isArray(remoteIncidents) && remoteIncidents.length > 0) {
        const hash = JSON.stringify(remoteIncidents);
        if (hash !== lastIncidentsHash) {
          lastIncidentsHash = hash;
          incidentsData = remoteIncidents;
          renderOverview();
          renderHistory();
          if (currentOpenIncidentId && document.getElementById("view-incident-detail")?.style.display !== "none") {
            const currentInc = findIncidentById(currentOpenIncidentId);
            if (currentInc) showIncidentDetail(currentInc);
          }
        }
      }
    }
  } catch (_) {
    // Silent failover when running static on GitHub Pages
  }
}

window.addEventListener("hashchange", applyInitialStateFromUrl);
window.addEventListener("popstate", applyInitialStateFromUrl);
window.addEventListener("resize", () => {
  if (activeTab === "metrics" || activeTab === "overview") {
    renderAllCharts();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Sync UI elements with restored localStorage preferences
  document.documentElement.setAttribute("data-theme", activeTheme);
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.className = activeTheme === "light" ? "ph ph-sun" : "ph ph-moon";
  }
  const tzLabel = document.getElementById("tz-label");
  if (tzLabel) {
    tzLabel.textContent = useUtc ? "UTC time" : "Local time";
  }

  renderOverview();
  renderServices();
  renderLocations();
  renderHistory();
  renderAllCharts();
  applyInitialStateFromUrl();
  loadTelemetryData();
  setInterval(loadTelemetryData, 5000);
});
