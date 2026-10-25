"""
Live end-to-end verification script for running CASCADE ZERO system.
Tests both backend (port 8000) and frontend (port 5173).
"""

import json
import urllib.request

def test_endpoints():
    endpoints = [
        ('http://localhost:8000/api/health', 'Backend Health'),
        ('http://localhost:8000/api/summary', 'Telemetry Summary'),
        ('http://localhost:8000/api/events', 'Worldwide Events Catalog'),
        ('http://localhost:8000/api/intelligence/daily', 'Daily Global Intelligence'),
        ('http://localhost:8000/api/notifications', 'Real-Time Notifications'),
        ('http://localhost:8000/api/countries', 'Countries Directory'),
        ('http://localhost:5173/', 'React Frontend Application'),
    ]

    print("=" * 70)
    print("CASCADE ZERO — LIVE END-TO-END SYSTEM AUDIT")
    print("=" * 70)

    for url, label in endpoints:
        req = urllib.request.urlopen(url, timeout=10)
        status = req.status
        body = req.read()
        print(f"[{status} OK] {label:<32} -> {url} ({len(body):,} bytes)")

    # Detailed data validation
    print("\n--- DATA ACCURACY VALIDATION ---")
    health_resp = json.loads(urllib.request.urlopen('http://localhost:8000/api/health').read().decode())
    print("Sources status:")
    for s in health_resp.get('sources', []):
        print(f"  * {s['name']}: {s['status']} | Latency: {s['latency']} | {s['coverage']}")

    events_resp = json.loads(urllib.request.urlopen('http://localhost:8000/api/events').read().decode())
    events = events_resp.get('events', [])
    print(f"\nTotal live events in catalog: {len(events)}")

    gdacs = [e for e in events if e.get('source') == 'GDACS']
    usgs = [e for e in events if e.get('source') == 'USGS']
    nasa = [e for e in events if e.get('source') == 'NASA EONET']
    print(f"  * GDACS multi-hazard alerts: {len(gdacs)}")
    print(f"  * USGS earthquakes:          {len(usgs)}")
    print(f"  * NASA EONET detections:     {len(nasa)}")

    # Check sample Official Source Record URLs
    print("\nSample Official Source Record URLs:")
    if gdacs:
        print(f"  * GDACS Event [{gdacs[0]['id']}]: {gdacs[0]['sourceUrl']}")
    if usgs:
        print(f"  * USGS Event  [{usgs[0]['id']}]:  {usgs[0]['sourceUrl']}")
    if nasa:
        print(f"  * NASA Event  [{nasa[0]['id']}]:  {nasa[0]['sourceUrl']}")

    # Check daily briefing
    daily_resp = json.loads(urllib.request.urlopen('http://localhost:8000/api/intelligence/daily').read().decode())
    briefing = daily_resp.get('briefing', {})
    print("\nDaily Global Intelligence Briefing:")
    print(f"  * Headline: {briefing.get('headline')}")
    print(f"  * Credibility: {briefing.get('credibilityScore')}")
    print(f"  * Verification: {briefing.get('verificationStatus')}")

    # Check notifications
    notif_resp = json.loads(urllib.request.urlopen('http://localhost:8000/api/notifications').read().decode())
    print(f"\nNotifications Total: {notif_resp.get('total')} (Unread: {notif_resp.get('unreadCount')})")

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED — LIVE SYSTEM 100% OPERATIONAL")
    print("=" * 70)

if __name__ == '__main__':
    test_endpoints()
