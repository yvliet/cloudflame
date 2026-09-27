#!/usr/bin/env python3
"""
Cloudflame Turso Telemetry Client & Snapshot Exporter.
Safely connects to Turso libSQL HTTP API using local environment credentials,
records state/metrics/incidents, and exports static JSON snapshots for GitHub Pages.
"""

from __future__ import annotations

import datetime
import json
import os
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
STATUS_FILE = REPO_ROOT / "status.json"


def load_env() -> tuple[Optional[str], Optional[str]]:
    """Load TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env or os.environ."""
    env_file = REPO_ROOT / ".env"
    db_url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")

    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip("'\"")
            if k == "TURSO_DATABASE_URL" and not db_url:
                db_url = v
            elif k == "TURSO_AUTH_TOKEN" and not token:
                token = v

    if db_url and db_url.startswith("libsql://"):
        db_url = db_url.replace("libsql://", "https://")
    if db_url and not db_url.endswith("/v2/pipeline"):
        db_url = f"{db_url.rstrip('/')}/v2/pipeline"

    return db_url, token


def execute_turso_queries(statements: List[str]) -> Optional[List[Dict[str, Any]]]:
    """Execute raw SQL statements against Turso /v2/pipeline."""
    db_url, token = load_env()
    if not db_url or not token:
        return None

    requests = [{"type": "execute", "stmt": {"sql": sql}} for sql in statements]
    requests.append({"type": "close"})

    payload = json.dumps({"requests": requests}).encode("utf-8")
    req = urllib.request.Request(
        db_url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = []
            for r in data.get("results", []):
                if r.get("type") == "ok" and "response" in r:
                    resp_obj = r["response"]
                    if resp_obj.get("type") == "execute" and "result" in resp_obj:
                        res = resp_obj["result"]
                        cols = [c["name"] for c in res.get("cols", [])]
                        parsed_rows = []
                        for row in res.get("rows", []):
                            row_dict = {}
                            for col_name, cell in zip(cols, row):
                                row_dict[col_name] = cell.get("value")
                            parsed_rows.append(row_dict)
                        results.append({"cols": cols, "rows": parsed_rows})
            return results
    except Exception as exc:
        print(f"[turso-client] Warning: Failed communicating with Turso: {exc}")
        return None


def export_snapshots_to_disk() -> bool:
    """Fetch current state from Turso and export static JSON files for GitHub Pages."""
    queries = [
        "SELECT * FROM system_state WHERE id = 1",
        "SELECT * FROM incidents ORDER BY started_at DESC",
        "SELECT * FROM metrics_timeseries ORDER BY id DESC LIMIT 60",
    ]
    results = execute_turso_queries(queries)
    if not results or len(results) < 3:
        return False

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. system_state -> status.json
    state_rows = results[0]["rows"]
    if state_rows:
        s = state_rows[0]
        status_payload = {
            "state": s.get("current_state", "nominal"),
            "active_features": int(s.get("active_features", 200)),
            "dropped_features": int(s.get("dropped_features", 0)),
            "latency_ns": float(s.get("latency_ns", 7.66)),
            "traffic_rps": int(s.get("traffic_rps", 52400)),
            "last_updated": s.get("last_updated"),
        }
    else:
        status_payload = {
            "state": "nominal",
            "active_features": 200,
            "dropped_features": 0,
            "latency_ns": 7.66,
            "traffic_rps": 52400,
            "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    status_json = json.dumps(status_payload, indent=2)
    STATUS_FILE.write_text(status_json, encoding="utf-8")

    # 2. incidents -> data/incidents.json
    raw_incidents = results[1]["rows"]
    incidents_list = []
    for inc in raw_incidents:
        updates = []
        if inc.get("updates_json"):
            try:
                updates = json.loads(inc["updates_json"])
            except Exception:
                updates = []
        incidents_list.append({
            "id": inc.get("id"),
            "title": inc.get("title"),
            "service": inc.get("service"),
            "service_group": inc.get("service_group"),
            "severity": inc.get("severity"),
            "status": inc.get("status"),
            "impact": inc.get("impact"),
            "root_cause": inc.get("root_cause"),
            "started_at": inc.get("started_at"),
            "resolved_at": inc.get("resolved_at"),
            "updates": updates,
        })

    (DATA_DIR / "incidents.json").write_text(json.dumps(incidents_list, indent=2), encoding="utf-8")

    # 3. metrics_timeseries -> data/metrics_timeseries.json
    raw_metrics = results[2]["rows"]
    # Reverse so chronological order (oldest to newest)
    raw_metrics.reverse()
    metrics_list = []
    for m in raw_metrics:
        metrics_list.append({
            "id": int(m.get("id", 0)),
            "timestamp": m.get("timestamp"),
            "p99_latency_ns": float(m.get("p99_latency_ns", 0.0)),
            "traffic_rps": int(m.get("traffic_rps", 0)),
            "active_signals": int(m.get("active_signals", 200)),
            "dropped_signals": int(m.get("dropped_signals", 0)),
            "system_status": m.get("system_status", "operational"),
        })

    metrics_json = json.dumps(metrics_list, indent=2)
    (DATA_DIR / "metrics_timeseries.json").write_text(metrics_json, encoding="utf-8")

    print(f"[turso-client] Exported {len(incidents_list)} incidents and {len(metrics_list)} metric points to data/")
    return True


def record_system_telemetry(
    state: str,
    active_features: int,
    dropped_features: int,
    latency_ns: float,
    traffic_rps: int,
) -> None:
    """Record a telemetry reading in Turso system_state and metrics_timeseries."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    system_status = "operational" if state in ("nominal", "recover") else "major_outage" if state == "break" else "degraded"

    queries = [
        f"""
        INSERT INTO system_state (id, current_state, active_features, dropped_features, latency_ns, traffic_rps, last_updated)
        VALUES (1, '{state}', {active_features}, {dropped_features}, {latency_ns}, {traffic_rps}, '{now_iso}')
        ON CONFLICT(id) DO UPDATE SET
            current_state = '{state}',
            active_features = {active_features},
            dropped_features = {dropped_features},
            latency_ns = {latency_ns},
            traffic_rps = {traffic_rps},
            last_updated = '{now_iso}';
        """,
        f"""
        INSERT INTO metrics_timeseries (timestamp, p99_latency_ns, traffic_rps, active_signals, dropped_signals, system_status)
        VALUES ('{now_iso}', {latency_ns}, {traffic_rps}, {active_features}, {dropped_features}, '{system_status}');
        """,
    ]

    execute_turso_queries(queries)
    export_snapshots_to_disk()


def record_outage_incident(
    incident_id: str,
    title: str,
    service: str,
    service_group: str,
    impact: str,
    root_cause: str,
) -> None:
    """Record an active outage incident in Turso."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    updates = [
        {"time": "Just now", "status": "investigating", "message": f"Critical panic detected: {title}. Edge proxy non-responsive."},
        {"time": "Just now", "status": "identified", "message": f"Identified cross-boundary schema drift: {root_cause}."}
    ]
    updates_json = json.dumps(updates).replace("'", "''")

    sql = f"""
    INSERT OR REPLACE INTO incidents (id, title, service, service_group, severity, status, impact, root_cause, started_at, resolved_at, updates_json)
    VALUES ('{incident_id}', '{title.replace("'", "''")}', '{service}', '{service_group}', 'critical', 'investigating', '{impact.replace("'", "''")}', '{root_cause.replace("'", "''")}', '{now_iso}', NULL, '{updates_json}');
    """
    execute_turso_queries([sql])
    export_snapshots_to_disk()


def resolve_outage_incident(
    incident_id: str,
    resolution_message: str,
) -> None:
    """Resolve an incident in Turso."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    # Fetch existing updates
    results = execute_turso_queries([f"SELECT updates_json FROM incidents WHERE id = '{incident_id}'"])
    updates = []
    if results and results[0]["rows"] and results[0]["rows"][0].get("updates_json"):
        try:
            updates = json.loads(results[0]["rows"][0]["updates_json"])
        except Exception:
            pass

    updates.append({"time": "Just now", "status": "resolved", "message": resolution_message})
    updates_json = json.dumps(updates).replace("'", "''")

    sql = f"""
    UPDATE incidents
    SET status = 'resolved',
        resolved_at = '{now_iso}',
        updates_json = '{updates_json}'
    WHERE id = '{incident_id}';
    """
    execute_turso_queries([sql])
    export_snapshots_to_disk()


def reset_to_pristine_nominal() -> None:
    """Reset Turso database and local files back to 100% clean pristine operational baseline."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    queries = [
        "DELETE FROM incidents WHERE id = 'inc-2026-09-24-drift';",
        f"""
        INSERT INTO system_state (id, current_state, active_features, dropped_features, latency_ns, traffic_rps, last_updated)
        VALUES (1, 'nominal', 200, 0, 1.18, 52400, '{now_iso}')
        ON CONFLICT(id) DO UPDATE SET
            current_state = 'nominal',
            active_features = 200,
            dropped_features = 0,
            latency_ns = 1.18,
            traffic_rps = 52400,
            last_updated = '{now_iso}';
        """,
        f"""
        INSERT INTO metrics_timeseries (timestamp, p99_latency_ns, traffic_rps, active_signals, dropped_signals, system_status)
        VALUES ('{now_iso}', 1.18, 52400, 200, 0, 'operational');
        """
    ]
    execute_turso_queries(queries)
    export_snapshots_to_disk()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] in ("nominal", "reset", "clean"):
        reset_to_pristine_nominal()
    elif len(sys.argv) > 1 and sys.argv[1] == "break":
        record_system_telemetry("break", 280, 280, 1420.0, 1820)
    elif len(sys.argv) > 1 and sys.argv[1] == "recover":
        record_system_telemetry("recover", 200, 80, 7.84, 52800)
    else:
        export_snapshots_to_disk()
