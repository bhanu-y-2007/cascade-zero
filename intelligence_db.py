"""
Persistent SQLite database layer for CASCADE ZERO Disaster Intelligence System.
Stores:
- All normalized disaster events with update history
- Genuine change detection records
- Persistent user notifications
- Daily global intelligence briefings
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("CASCADE_DB_PATH", "disaster_intelligence.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database tables with indexes."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                hazard_category TEXT NOT NULL,
                severity TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                location TEXT,
                country TEXT,
                source TEXT NOT NULL,
                status TEXT NOT NULL,
                event_time TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                retrieved_at TEXT NOT NULL,
                source_url TEXT,
                description TEXT,
                impact INTEGER,
                data_type TEXT,
                raw_json TEXT,
                last_hash TEXT,
                pub_date TEXT,
                source_event_id TEXT,
                is_current INTEGER DEFAULT 1,
                official_alert_level TEXT
            )
        """)
        
        # Change history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS event_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                change_type TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                change_summary TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )
        """)
        
        # Notifications table (persisted across restarts and page reloads)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                event_id TEXT,
                headline TEXT NOT NULL,
                change_type TEXT NOT NULL,
                hazard_category TEXT NOT NULL,
                country TEXT,
                location TEXT,
                severity TEXT NOT NULL,
                change_summary TEXT NOT NULL,
                source TEXT NOT NULL,
                source_url TEXT,
                created_at TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                is_cleared INTEGER DEFAULT 0
            )
        """)
        
        # Daily Intelligence Briefings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_briefings (
                id TEXT PRIMARY KEY,
                date_str TEXT NOT NULL,
                hero_event_id TEXT,
                headline TEXT NOT NULL,
                summary TEXT NOT NULL,
                what_happened TEXT NOT NULL,
                what_is_changing TEXT NOT NULL,
                areas_affected TEXT NOT NULL,
                official_guidance TEXT NOT NULL,
                credibility_score TEXT NOT NULL,
                verification_status TEXT NOT NULL,
                secondary_items_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        
        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_hazard ON events(hazard_category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_country ON events(country)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(is_read, is_cleared)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_briefing_date ON daily_briefings(date_str)")

        # Migration columns for verified data accuracy
        for col_name, col_type in [
            ("pub_date", "TEXT"),
            ("source_event_id", "TEXT"),
            ("is_current", "INTEGER DEFAULT 1"),
            ("official_alert_level", "TEXT"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError:
                pass  # Column already exists
        
        # Prune demo scenario notifications & events if real data is stored
        cursor.execute("""
            DELETE FROM notifications WHERE event_id IN (
                'eq-japan-1', 'flood-india-1', 'storm-philippines-1', 'wildfire-california-1',
                'volcano-indonesia-1', 'storm-nz-1', 'drought-australia-1', 'tsunami-pacific-1',
                'landslide-brazil-1', 'heat-spain-1'
            )
        """)
        cursor.execute("""
            DELETE FROM events WHERE id IN (
                'eq-japan-1', 'flood-india-1', 'storm-philippines-1', 'wildfire-california-1',
                'volcano-indonesia-1', 'storm-nz-1', 'drought-australia-1', 'tsunami-pacific-1',
                'landslide-brazil-1', 'heat-spain-1'
            )
        """)
        # Mark historical notifications older than 24h as read so bell badge reflects current unread alerts
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND datetime(created_at) < datetime('now', '-24 hours')")

        conn.commit()
    logger.info("Disaster Intelligence SQLite database initialized at %s", DB_PATH)


def upsert_events_and_detect_changes(
    events: list[dict[str, Any]]
) -> tuple[int, list[dict[str, Any]]]:
    """
    Upsert incoming event records into SQLite database.
    Detects meaningful changes (severity escalation, status updates, magnitude/area modifications).
    Generates structured notifications for real changes.
    Returns (num_upserted, list_of_new_notifications).
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    new_notifications: list[dict[str, Any]] = []
    upserted_count = 0

    with get_connection() as conn:
        cursor = conn.cursor()

        for ev in events:
            ev_id = str(ev.get("id"))
            if not ev_id:
                continue

            # Fetch existing record if present
            cursor.execute(
                "SELECT id, severity, status, location, impact, title, description, source, source_url FROM events WHERE id = ?",
                (ev_id,),
            )
            existing = cursor.fetchone()

            severity = str(ev.get("severity") or "Moderate")
            status = str(ev.get("status") or "Observed")
            location = str(ev.get("location") or ev.get("country") or "Global")
            country = str(ev.get("country") or "International")
            hazard = str(ev.get("hazardCategory") or "Natural Hazard")
            title = str(ev.get("title") or f"{hazard} in {location}")
            source = str(ev.get("source") or "Official Agency")
            source_url = str(ev.get("sourceUrl") or "")
            impact = int(ev.get("impact") or 50)
            desc = str(ev.get("description") or "")
            event_time = str(ev.get("eventTime") or now_iso)
            updated_at = str(ev.get("updatedAt") or now_iso)
            retrieved_at = str(ev.get("retrievedAt") or now_iso)
            lat = float(ev.get("latitude") or 0.0)
            lon = float(ev.get("longitude") or 0.0)
            data_type = str(ev.get("dataType") or "live")
            pub_date = str(ev.get("pubDate") or ev.get("pub_date") or event_time)
            source_event_id = str(ev.get("sourceEventId") or ev.get("source_event_id") or ev_id)
            is_current = 1 if ev.get("isCurrent", True) else 0
            official_alert_level = str(ev.get("officialAlertLevel") or ev.get("official_alert_level") or severity)

            if existing:
                # Compare for meaningful changes
                old_severity = existing["severity"]
                old_status = existing["status"]
                old_impact = existing["impact"] or 50

                changes: list[str] = []

                # Severity escalation or change
                if old_severity != severity:
                    if (old_severity, severity) in [
                        ("Moderate", "Severe"),
                        ("Severe", "Critical"),
                        ("Moderate", "Critical"),
                        ("Low", "Severe"),
                    ]:
                        changes.append(f"Severity upgraded from {old_severity} to {severity}")
                    elif (old_severity, severity) in [
                        ("Critical", "Severe"),
                        ("Severe", "Moderate"),
                        ("Critical", "Moderate"),
                    ]:
                        changes.append(f"Severity downgraded from {old_severity} to {severity}")
                    else:
                        changes.append(f"Severity changed to {severity}")

                # Status update
                if old_status != status:
                    if status == "Alert" and old_status != "Alert":
                        changes.append("Warning status elevated to Active Emergency Alert")
                    elif status == "Resolved":
                        changes.append("Official advisory declared Resolved / Downgraded")
                    else:
                        changes.append(f"Status updated to {status}")

                # Significant impact change
                if abs(impact - old_impact) >= 20:
                    changes.append(f"Impact rating revised from {old_impact} to {impact}")

                if changes:
                    change_summary = "; ".join(changes)
                    # Log event change in event_changes table
                    cursor.execute(
                        """
                        INSERT INTO event_changes (event_id, detected_at, change_type, old_value, new_value, change_summary)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (ev_id, now_iso, "UPDATE", old_severity, severity, change_summary),
                    )

                    # Create notification
                    notif_id = f"notif-{ev_id}-{int(datetime.now(timezone.utc).timestamp())}"
                    headline = f"{hazard} Update: {change_summary} ({location})"
                    
                    cursor.execute(
                        """
                        INSERT INTO notifications (
                            id, event_id, headline, change_type, hazard_category,
                            country, location, severity, change_summary, source, source_url, created_at, is_read, is_cleared
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
                        """,
                        (
                            notif_id,
                            ev_id,
                            headline,
                            "UPDATE",
                            hazard,
                            country,
                            location,
                            severity,
                            change_summary,
                            source,
                            source_url,
                            now_iso,
                        ),
                    )

                    new_notifications.append({
                        "id": notif_id,
                        "eventId": ev_id,
                        "headline": headline,
                        "changeType": "UPDATE",
                        "hazardCategory": hazard,
                        "country": country,
                        "location": location,
                        "severity": severity,
                        "changeSummary": change_summary,
                        "source": source,
                        "sourceUrl": source_url,
                        "createdAt": now_iso,
                        "isRead": False,
                    })

                # Update existing record
                cursor.execute(
                    """
                    UPDATE events SET
                        title = ?, hazard_category = ?, severity = ?, latitude = ?, longitude = ?,
                        location = ?, country = ?, source = ?, status = ?, event_time = ?,
                        updated_at = ?, retrieved_at = ?, source_url = ?, description = ?,
                        impact = ?, data_type = ?, raw_json = ?, pub_date = ?, source_event_id = ?,
                        is_current = ?, official_alert_level = ?
                    WHERE id = ?
                    """,
                    (
                        title, hazard, severity, lat, lon, location, country, source, status,
                        event_time, updated_at, retrieved_at, source_url, desc, impact,
                        data_type, json.dumps(ev), pub_date, source_event_id, is_current,
                        official_alert_level, ev_id,
                    ),
                )
            else:
                # Brand new record insert
                cursor.execute(
                    """
                    INSERT INTO events (
                        id, title, hazard_category, severity, latitude, longitude,
                        location, country, source, status, event_time, updated_at,
                        retrieved_at, source_url, description, impact, data_type, raw_json,
                        pub_date, source_event_id, is_current, official_alert_level
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ev_id, title, hazard, severity, lat, lon, location, country, source,
                        status, event_time, updated_at, retrieved_at, source_url, desc,
                        impact, data_type, json.dumps(ev), pub_date, source_event_id, is_current,
                        official_alert_level,
                    ),
                )

                # For brand new Critical or Severe events, generate a genuine initial alert notification ONLY if recent (< 24 hours)
                is_recent = False
                try:
                    ev_dt = datetime.fromisoformat(event_time.replace("Z", "+00:00"))
                    if (datetime.now(timezone.utc) - ev_dt).total_seconds() <= 86400:
                        is_recent = True
                except Exception:
                    is_recent = False

                if severity in ("Critical", "Severe") and data_type == "live" and is_recent:
                    notif_id = f"notif-new-{ev_id}"
                    # Check if already notified
                    cursor.execute("SELECT id FROM notifications WHERE id = ?", (notif_id,))
                    if not cursor.fetchone():
                        headline = f"New {severity} {hazard} Alert: {title}"
                        change_summary = f"Newly verified {severity.lower()} {hazard.lower()} recorded near {location} ({country})."
                        cursor.execute(
                            """
                            INSERT INTO notifications (
                                id, event_id, headline, change_type, hazard_category,
                                country, location, severity, change_summary, source, source_url, created_at, is_read, is_cleared
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
                            """,
                            (
                                notif_id,
                                ev_id,
                                headline,
                                "NEW_ALERT",
                                hazard,
                                country,
                                location,
                                severity,
                                change_summary,
                                source,
                                source_url,
                                now_iso,
                            ),
                        )
                        new_notifications.append({
                            "id": notif_id,
                            "eventId": ev_id,
                            "headline": headline,
                            "changeType": "NEW_ALERT",
                            "hazardCategory": hazard,
                            "country": country,
                            "location": location,
                            "severity": severity,
                            "changeSummary": change_summary,
                            "source": source,
                            "sourceUrl": source_url,
                            "createdAt": now_iso,
                            "isRead": False,
                        })

            upserted_count += 1

        conn.commit()

    return upserted_count, new_notifications


def get_all_events(limit: int = 500) -> list[dict[str, Any]]:
    """Retrieve all stored disaster events ordered by event time descending."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, title, hazard_category, severity, latitude, longitude,
                   location, country, source, status, event_time, updated_at,
                   retrieved_at, source_url, description, impact, data_type,
                   pub_date, source_event_id, is_current, official_alert_level
            FROM events
            ORDER BY event_time DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()

    return [
        {
            "id": r["id"],
            "title": r["title"],
            "hazardCategory": r["hazard_category"],
            "severity": r["severity"],
            "officialAlertLevel": r["official_alert_level"] if r["official_alert_level"] else r["severity"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "location": r["location"],
            "country": r["country"],
            "source": r["source"],
            "status": r["status"],
            "eventTime": r["event_time"],
            "updatedAt": r["updated_at"],
            "retrievedAt": r["retrieved_at"],
            "pubDate": r["pub_date"] if r["pub_date"] else r["event_time"],
            "sourceEventId": r["source_event_id"] if r["source_event_id"] else r["id"],
            "isCurrent": bool(r["is_current"]) if r["is_current"] is not None else True,
            "sourceUrl": r["source_url"],
            "description": r["description"],
            "impact": r["impact"],
            "dataType": r["data_type"],
        }
        for r in rows
    ]


def get_notifications(limit: int = 100, unread_only: bool = False) -> tuple[list[dict[str, Any]], int]:
    """Retrieve notifications, filtering cleared ones. Returns (notifications, unread_count)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Get unread count
        cursor.execute("SELECT COUNT(*) FROM notifications WHERE is_read = 0 AND is_cleared = 0")
        unread_count = cursor.fetchone()[0]

        query = """
            SELECT id, event_id, headline, change_type, hazard_category,
                   country, location, severity, change_summary, source, source_url,
                   created_at, is_read
            FROM notifications
            WHERE is_cleared = 0
        """
        params: list[Any] = []
        if unread_only:
            query += " AND is_read = 0"
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()

    items = [
        {
            "id": r["id"],
            "eventId": r["event_id"],
            "headline": r["headline"],
            "changeType": r["change_type"],
            "hazardCategory": r["hazard_category"],
            "country": r["country"],
            "location": r["location"],
            "severity": r["severity"],
            "changeSummary": r["change_summary"],
            "source": r["source"],
            "sourceUrl": r["source_url"],
            "createdAt": r["created_at"],
            "isRead": bool(r["is_read"]),
        }
        for r in rows
    ]
    return items, unread_count


def mark_notification_read(notif_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        conn.commit()
        return cursor.rowcount > 0


def mark_all_notifications_read() -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE is_read = 0")
        conn.commit()
        return cursor.rowcount


def clear_notifications() -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_cleared = 1 WHERE is_cleared = 0")
        conn.commit()
        return cursor.rowcount


def save_daily_briefing(briefing: dict[str, Any]) -> None:
    """Save or update today's curated daily global intelligence briefing."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO daily_briefings (
                id, date_str, hero_event_id, headline, summary, what_happened,
                what_is_changing, areas_affected, official_guidance, credibility_score,
                verification_status, secondary_items_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                briefing["id"],
                briefing["dateStr"],
                briefing.get("heroEventId"),
                briefing["headline"],
                briefing["summary"],
                briefing["whatHappened"],
                briefing["whatIsChanging"],
                briefing["areasAffected"],
                briefing["officialGuidance"],
                briefing["credibilityScore"],
                briefing["verificationStatus"],
                json.dumps(briefing.get("secondaryItems", [])),
                briefing["createdAt"],
            ),
        )
        conn.commit()


def get_latest_daily_briefing() -> dict[str, Any] | None:
    """Retrieve the most recent daily intelligence briefing from the database."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, date_str, hero_event_id, headline, summary, what_happened,
                   what_is_changing, areas_affected, official_guidance, credibility_score,
                   verification_status, secondary_items_json, created_at
            FROM daily_briefings
            ORDER BY created_at DESC
            LIMIT 1
            """
        )
        r = cursor.fetchone()

    if not r:
        return None

    return {
        "id": r["id"],
        "dateStr": r["date_str"],
        "heroEventId": r["hero_event_id"],
        "headline": r["headline"],
        "summary": r["summary"],
        "whatHappened": r["what_happened"],
        "whatIsChanging": r["what_is_changing"],
        "areasAffected": r["areas_affected"],
        "officialGuidance": r["official_guidance"],
        "credibilityScore": r["credibility_score"],
        "verificationStatus": r["verification_status"],
        "secondaryItems": json.loads(r["secondary_items_json"]),
        "createdAt": r["created_at"],
    }


# Auto-initialize database schema on module load
try:
    init_db()
except Exception as e:
    logger.debug("Automatic init_db notice: %s", e)

