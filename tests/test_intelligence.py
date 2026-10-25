"""
Unit and integration tests for CASCADE ZERO Global Disaster Intelligence System.
Tests:
- Daily global intelligence synthesis and ranking
- Database persistence and update history
- Genuine change detection (escalations, status updates, impact changes)
- Notification creation, unread tracking, marking read, and clearing
- Endpoints for daily intelligence and notifications
"""

import os
import unittest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

import intelligence_agent
import intelligence_db
import server


class IntelligenceSystemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use an isolated test database
        os.environ["CASCADE_DB_PATH"] = "test_intelligence.db"
        intelligence_db.DB_PATH = "test_intelligence.db"
        intelligence_db.init_db()
        cls.client = TestClient(server.app)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists("test_intelligence.db"):
            try:
                os.remove("test_intelligence.db")
            except OSError:
                pass

    def setUp(self):
        # Clear database tables before each test
        with intelligence_db.get_connection() as conn:
            conn.execute("DELETE FROM notifications")
            conn.execute("DELETE FROM event_changes")
            conn.execute("DELETE FROM daily_briefings")
            conn.execute("DELETE FROM events")
            conn.commit()

    def test_daily_intelligence_synthesis_selects_highest_priority(self):
        sample_events = [
            {
                "id": "minor-eq",
                "title": "M 2.1 - 5 km SSW of Volcano, Hawaii",
                "hazardCategory": "Earthquake",
                "severity": "Low",
                "impact": 10,
                "latitude": 19.4,
                "longitude": -155.2,
                "location": "Hawaii",
                "country": "United States",
                "source": "USGS",
                "status": "Observed",
                "eventTime": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "dataType": "live",
            },
            {
                "id": "critical-cyclone",
                "title": "Category 5 Severe Tropical Cyclone Malia",
                "hazardCategory": "Cyclone",
                "severity": "Critical",
                "impact": 95,
                "latitude": -17.5,
                "longitude": 178.0,
                "location": "Fiji Islands",
                "country": "Fiji",
                "source": "GDACS",
                "status": "Alert",
                "eventTime": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "sourceUrl": "https://www.gdacs.org/report.aspx?eventid=123",
                "dataType": "live",
            },
        ]

        briefing = intelligence_agent.synthesize_daily_intelligence(sample_events)
        self.assertIsNotNone(briefing)
        self.assertEqual(briefing["heroEventId"], "critical-cyclone")
        self.assertIn("Cyclone", briefing["headline"])
        self.assertIn("Fiji", briefing["whatHappened"])
        self.assertGreater(len(briefing["whatIsChanging"]), 10)
        self.assertGreater(len(briefing["officialGuidance"]), 10)
        self.assertIn("Verified", briefing["verificationStatus"])

    def test_change_detection_generates_notifications_for_severity_escalation(self):
        initial_events = [
            {
                "id": "ev-storm-1",
                "title": "Tropical Storm Alert",
                "hazardCategory": "Cyclone",
                "severity": "Moderate",
                "impact": 40,
                "latitude": 15.0,
                "longitude": 120.0,
                "location": "Luzon",
                "country": "Philippines",
                "source": "GDACS",
                "status": "Observed",
                "eventTime": "2026-10-25T10:00:00Z",
                "updatedAt": "2026-10-25T10:00:00Z",
                "sourceUrl": "https://gdacs.org/storm1",
            }
        ]

        # First ingestion establishes baseline
        num_upserted, new_notifs = intelligence_db.upsert_events_and_detect_changes(initial_events)
        self.assertEqual(num_upserted, 1)
        self.assertEqual(len(new_notifs), 0, "Initial baseline ingestion should not trigger false change notifications")

        # Second ingestion has meaningful upgrade to Critical + Alert status
        updated_events = [
            {
                "id": "ev-storm-1",
                "title": "Super Typhoon Alert (Upgraded)",
                "hazardCategory": "Cyclone",
                "severity": "Critical",
                "impact": 85,
                "latitude": 15.0,
                "longitude": 120.0,
                "location": "Luzon",
                "country": "Philippines",
                "source": "GDACS",
                "status": "Alert",
                "eventTime": "2026-10-25T10:00:00Z",
                "updatedAt": "2026-10-25T12:00:00Z",
                "sourceUrl": "https://gdacs.org/storm1",
            }
        ]

        _, new_notifs = intelligence_db.upsert_events_and_detect_changes(updated_events)
        self.assertGreaterEqual(len(new_notifs), 1)
        notif = new_notifs[0]
        self.assertEqual(notif["eventId"], "ev-storm-1")
        self.assertEqual(notif["severity"], "Critical")
        self.assertIn("upgraded from Moderate to Critical", notif["changeSummary"])
        self.assertIn("Active Emergency Alert", notif["changeSummary"])

        # Check persistence in database
        persisted_notifs, unread_count = intelligence_db.get_notifications()
        self.assertEqual(len(persisted_notifs), 1)
        self.assertEqual(unread_count, 1)
        self.assertFalse(persisted_notifs[0]["isRead"])

    def test_duplicate_and_unchanged_data_generates_zero_notifications(self):
        event = [
            {
                "id": "eq-steady-1",
                "title": "M 5.5 - Northern California",
                "hazardCategory": "Earthquake",
                "severity": "Moderate",
                "impact": 50,
                "latitude": 40.0,
                "longitude": -124.0,
                "location": "California",
                "country": "United States",
                "source": "USGS",
                "status": "Observed",
                "eventTime": "2026-10-25T08:00:00Z",
                "updatedAt": "2026-10-25T08:00:00Z",
            }
        ]

        intelligence_db.upsert_events_and_detect_changes(event)
        # Re-ingest the exact same data
        _, new_notifs = intelligence_db.upsert_events_and_detect_changes(event)
        self.assertEqual(len(new_notifs), 0, "Repeated ingestion of unchanged record must produce 0 notifications")

    def test_notification_marking_read_and_clearing(self):
        # Create a test notification
        event = [
            {
                "id": "ev-flood-1",
                "title": "River Flood",
                "hazardCategory": "Flood",
                "severity": "Moderate",
                "impact": 30,
                "latitude": 51.5,
                "longitude": 0.0,
                "location": "Thames Basin",
                "country": "United Kingdom",
                "source": "Met Office",
                "status": "Observed",
                "eventTime": "2026-10-25T06:00:00Z",
                "updatedAt": "2026-10-25T06:00:00Z",
            }
        ]
        intelligence_db.upsert_events_and_detect_changes(event)

        # Upgrade severity to create notification
        event[0]["severity"] = "Severe"
        _, notifs = intelligence_db.upsert_events_and_detect_changes(event)
        self.assertEqual(len(notifs), 1)
        notif_id = notifs[0]["id"]

        # Verify unread count is 1
        res = self.client.get("/api/notifications")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["unreadCount"], 1)

        # Mark single notification read
        read_res = self.client.post(f"/api/notifications/{notif_id}/read")
        self.assertEqual(read_res.status_code, 200)

        # Verify unread count is now 0
        res2 = self.client.get("/api/notifications")
        self.assertEqual(res2.json()["unreadCount"], 0)

        # Clear notifications
        clear_res = self.client.post("/api/notifications/clear")
        self.assertEqual(clear_res.status_code, 200)

        res3 = self.client.get("/api/notifications")
        self.assertEqual(len(res3.json()["notifications"]), 0)

    def test_daily_intelligence_endpoints(self):
        # Test GET /api/intelligence/daily
        res = self.client.get("/api/intelligence/daily")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("briefing", body)
        briefing = body["briefing"]
        self.assertIn("headline", briefing)
        self.assertIn("whatHappened", briefing)
        self.assertIn("officialGuidance", briefing)

        # Test POST /api/intelligence/daily/refresh
        refresh_res = self.client.post("/api/intelligence/daily/refresh")
        self.assertEqual(refresh_res.status_code, 200)
        self.assertEqual(refresh_res.json()["status"], "ok")


if __name__ == "__main__":
    unittest.main()
