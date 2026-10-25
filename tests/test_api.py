"""
Backend regression tests for CASCADE ZERO API.

Run with:
    python -m unittest discover -s tests
or:
    python -m pytest tests/ -v
"""

import asyncio
import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import server


class ApiStartupTests(unittest.TestCase):
    """Verify that the application starts correctly and basic routes respond."""

    def setUp(self) -> None:
        self.client = TestClient(server.app)

    def test_root_returns_project_info(self) -> None:
        response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['project'], 'CASCADE ZERO')
        self.assertEqual(payload['status'], 'operational')
        self.assertIn('docs', payload)

    def test_health_reports_service_without_exposing_credentials(self) -> None:
        response = self.client.get('/api/health')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['backend'], 'FastAPI')
        self.assertIsInstance(payload['nebius_configured'], bool)
        self.assertIsInstance(payload['sources'], list)
        # Must never leak the actual key value
        self.assertNotIn('NEBIUS_API_KEY', response.text)


class EventEndpointTests(unittest.TestCase):
    """Verify event listing and retrieval endpoints."""

    def setUp(self) -> None:
        self.client = TestClient(server.app)

    def test_events_endpoint_returns_list(self) -> None:
        response = self.client.get('/api/events')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('events', payload)
        self.assertIn('count', payload)
        self.assertIsInstance(payload['events'], list)

    def test_known_event_returns_record(self) -> None:
        response = self.client.get('/api/events/eq-japan-1')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['id'], 'eq-japan-1')
        self.assertEqual(payload['country'], 'Japan')

    def test_unknown_event_returns_not_found(self) -> None:
        response = self.client.get('/api/events/does-not-exist')

        self.assertEqual(response.status_code, 404)
        self.assertIn('detail', response.json())

    def test_summary_contains_event_counts_and_health(self) -> None:
        response = self.client.get('/api/summary')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['totalRecords'], len(payload['events']))
        self.assertEqual(payload['uniqueEvents'], len({event['id'] for event in payload['events']}))
        self.assertTrue(payload['sourceHealth'])
        self.assertIsInstance(payload['highSeverity'], int)
        self.assertIsInstance(payload['recentlyUpdated'], int)

    def test_sources_endpoint_returns_list(self) -> None:
        response = self.client.get('/api/sources')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('sources', payload)
        self.assertIsInstance(payload['sources'], list)
        # Should have at least 3 sources (USGS, Demo, Nebius)
        self.assertGreaterEqual(len(payload['sources']), 3)


class AiEndpointTests(unittest.TestCase):
    """Verify AI endpoint behaviour for configured and unconfigured states."""

    def setUp(self) -> None:
        self.client = TestClient(server.app)

    def test_ai_explain_reports_missing_credentials_without_provider_call(self) -> None:
        with patch.dict(os.environ, {'NEBIUS_API_KEY': ''}, clear=False):
            response = self.client.post(
                '/api/ai/explain',
                json={
                    'event_id': 'eq-japan-1',
                    'prompt': 'Explain possible transport dependencies.',
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'config_missing')
        self.assertIn('message', payload)
        self.assertIn('response', payload)

    def test_ai_explain_with_unknown_event_id_falls_back_gracefully(self) -> None:
        with patch.dict(os.environ, {'NEBIUS_API_KEY': ''}, clear=False):
            response = self.client.post(
                '/api/ai/explain',
                json={
                    'event_id': 'scenario-custom-1',
                    'prompt': 'Custom scenario analysis.',
                    'hazard_type': 'Flood',
                    'country': 'Bangladesh',
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'config_missing')

    def test_ai_explain_validation_rejects_empty_prompt(self) -> None:
        response = self.client.post(
            '/api/ai/explain',
            json={'event_id': 'eq-japan-1', 'prompt': ''},
        )

        self.assertEqual(response.status_code, 422)

    def test_ai_search_reports_missing_credentials(self) -> None:
        with patch.dict(os.environ, {'NEBIUS_API_KEY': ''}, clear=False):
            response = self.client.post(
                '/api/ai/search',
                json={'query': 'Recent floods in Southeast Asia'},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'config_missing')

    def test_nebius_request_uses_backend_token_and_returns_model_output(self) -> None:
        captured: dict[str, object] = {}

        class MockResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {'choices': [{'message': {'content': 'Evidence-based test explanation.'}}]}

        class MockClient:
            async def __aenter__(self) -> 'MockClient':
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def post(self, url: str, **kwargs: object) -> MockResponse:
                captured['url'] = url
                captured['headers'] = kwargs['headers']
                captured['payload'] = kwargs['json']
                return MockResponse()

        with (
            patch.dict(os.environ, {'NEBIUS_API_KEY': 'unit-test-token'}),
            patch('server.httpx.AsyncClient', return_value=MockClient()),
        ):
            result = asyncio.run(server.request_nebius_completion('test prompt', 'test system prompt'))

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['response']['content'], 'Evidence-based test explanation.')
        self.assertEqual(captured['headers']['Authorization'], 'Bearer unit-test-token')
        expected_model = os.getenv('NEBIUS_MODEL', 'nvidia/Llama-3.1-Nemotron-Ultra-253B-v1')
        self.assertEqual(captured['payload']['model'], expected_model)

    def test_nebius_http_error_returns_structured_error_not_exception(self) -> None:
        """HTTP error from provider must return a structured error dict, not raise."""

        class BadResponse:
            status_code = 401

        class MockClient:
            async def __aenter__(self) -> 'MockClient':
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def post(self, url: str, **kwargs: object) -> None:
                raise server.httpx.HTTPStatusError(
                    'Unauthorized', request=None, response=BadResponse()
                )

        with (
            patch.dict(os.environ, {'NEBIUS_API_KEY': 'bad-token'}),
            patch('server.httpx.AsyncClient', return_value=MockClient()),
        ):
            result = asyncio.run(server.request_nebius_completion('prompt', 'system'))

        self.assertEqual(result['status'], 'error')
        self.assertIn('message', result)
        # Must mention auth failure for 401
        self.assertIn('auth', result['message'].lower())

    def test_nebius_network_error_returns_structured_error_not_exception(self) -> None:
        """Network failure must return a structured error dict, not raise."""

        class MockClient:
            async def __aenter__(self) -> 'MockClient':
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def post(self, url: str, **kwargs: object) -> None:
                raise server.httpx.ConnectError('Connection refused')

        with (
            patch.dict(os.environ, {'NEBIUS_API_KEY': 'unit-test-token'}),
            patch('server.httpx.AsyncClient', return_value=MockClient()),
        ):
            result = asyncio.run(server.request_nebius_completion('prompt', 'system'))

        self.assertEqual(result['status'], 'error')
        self.assertIn('message', result)


class UsgsIntegrationTests(unittest.TestCase):
    """Verify USGS feed parsing, validation, and refresh endpoint behaviour."""

    def setUp(self) -> None:
        self.client = TestClient(server.app)

    def test_refresh_updates_records_from_usgs_adapter(self) -> None:
        live_event = {
            'id': 'usgs-test-event',
            'title': 'Test earthquake',
            'hazardCategory': 'Earthquake',
            'severity': 'Moderate',
            'latitude': 10.0,
            'longitude': 20.0,
            'location': 'Test location',
            'country': 'Global',
            'source': 'USGS',
            'status': 'Observed',
            'eventTime': '2026-10-25T00:00:00+00:00',
            'updatedAt': '2026-10-25T00:00:00+00:00',
            'sourceUrl': 'https://earthquake.usgs.gov/',
            'description': 'Test feed item.',
            'impact': 60,
        }
        original_events = server.EVENTS
        original_source_health = [source.copy() for source in server.SOURCE_HEALTH]
        self.addCleanup(setattr, server, 'EVENTS', original_events)
        self.addCleanup(server.SOURCE_HEALTH.__setitem__, slice(None), original_source_health)

        with patch('server.fetch_usgs_earthquakes', new=AsyncMock(return_value=[live_event])):
            response = self.client.post('/api/refresh')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['retrieved'], 1)
        self.assertEqual(payload['events'][0]['id'], 'usgs-test-event')
        self.assertEqual(server.SOURCE_HEALTH[0]['status'], 'Healthy')
        self.assertEqual(payload['sourceHealth'][0]['status'], 'Healthy')
        self.assertIn('total', payload)

    def test_failed_refresh_marks_source_unavailable(self) -> None:
        original_source_health = [source.copy() for source in server.SOURCE_HEALTH]
        self.addCleanup(server.SOURCE_HEALTH.__setitem__, slice(None), original_source_health)

        with self.assertLogs(server.logger, level='ERROR') as error_logs:
            with patch(
                'server.fetch_usgs_earthquakes',
                new=AsyncMock(side_effect=server.httpx.ConnectError('offline')),
            ):
                response = self.client.post('/api/refresh')

        self.assertEqual(response.status_code, 502)
        self.assertEqual(server.SOURCE_HEALTH[0]['status'], 'Unavailable')
        self.assertTrue(any('USGS' in line or 'usgs' in line.lower() for line in error_logs.output))

    def test_usgs_adapter_skips_invalid_coordinates(self) -> None:
        class MockResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {
                    'features': [
                        {
                            'id': 'invalid-location',
                            'properties': {'mag': 6.0},
                            'geometry': {'coordinates': [200.0, 95.0]},
                        },
                        {
                            'id': 'valid-location',
                            'properties': {
                                'code': 'valid-location',
                                'title': 'Mw 6.0 test earthquake',
                                'mag': 6.0,
                                'time': 1792886400000,
                                'url': 'https://earthquake.usgs.gov/test',
                            },
                            'geometry': {'coordinates': [142.36, 38.32]},
                        },
                    ],
                }

        class MockClient:
            async def __aenter__(self) -> 'MockClient':
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def get(self, url: str, **kwargs: object) -> MockResponse:
                return MockResponse()

        with patch('server.httpx.AsyncClient', return_value=MockClient()):
            events = asyncio.run(server.fetch_usgs_earthquakes())

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['id'], 'usgs-valid-location')
        self.assertEqual(events[0]['country'], 'Unknown')
        self.assertEqual(events[0]['hazardCategory'], 'Earthquake')
        self.assertEqual(events[0]['source'], 'USGS')

    def test_usgs_adapter_handles_missing_geometry(self) -> None:
        """Features with null geometry must be silently skipped."""

        class MockResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {
                    'features': [
                        {
                            'id': 'no-geometry',
                            'properties': {'mag': 5.8},
                            'geometry': None,
                        },
                    ],
                }

        class MockClient:
            async def __aenter__(self) -> 'MockClient':
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def get(self, url: str, **kwargs: object) -> MockResponse:
                return MockResponse()

        with patch('server.httpx.AsyncClient', return_value=MockClient()):
            events = asyncio.run(server.fetch_usgs_earthquakes())

        self.assertEqual(len(events), 0)

    def test_usgs_adapter_handles_empty_features(self) -> None:
        """An empty features list is a valid response (no earthquakes in period)."""

        class MockResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {'features': []}

        class MockClient:
            async def __aenter__(self) -> 'MockClient':
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def get(self, url: str, **kwargs: object) -> MockResponse:
                return MockResponse()

        with patch('server.httpx.AsyncClient', return_value=MockClient()):
            events = asyncio.run(server.fetch_usgs_earthquakes())

        self.assertEqual(events, [])

    def test_refresh_preserves_non_usgs_events(self) -> None:
        """After a USGS refresh the demo/non-USGS events must remain."""
        original_events = list(server.EVENTS)
        original_source_health = [source.copy() for source in server.SOURCE_HEALTH]
        self.addCleanup(setattr, server, 'EVENTS', original_events)
        self.addCleanup(server.SOURCE_HEALTH.__setitem__, slice(None), original_source_health)

        with patch('server.fetch_usgs_earthquakes', new=AsyncMock(return_value=[])):
            response = self.client.post('/api/refresh')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        # Demo events should still be present
        demo_events = [e for e in payload['events'] if e['source'] == 'Demo scenario']
        self.assertGreater(len(demo_events), 0)


class SourceHealthTests(unittest.TestCase):
    """Verify source health endpoint reflects actual configuration state."""

    def setUp(self) -> None:
        self.client = TestClient(server.app)

    def test_nebius_shows_unconfigured_without_key(self) -> None:
        with patch.dict(os.environ, {'NEBIUS_API_KEY': ''}, clear=False):
            response = self.client.get('/api/health')

        self.assertEqual(response.status_code, 200)
        nebius_source = next(
            (s for s in response.json()['sources'] if 'Nebius' in s['name']),
            None,
        )
        self.assertIsNotNone(nebius_source)
        self.assertEqual(nebius_source['status'], 'Unconfigured')

    def test_nebius_shows_configured_with_key(self) -> None:
        with patch.dict(os.environ, {'NEBIUS_API_KEY': 'test-key-abc'}, clear=False):
            response = self.client.get('/api/health')

        self.assertEqual(response.status_code, 200)
        nebius_source = next(
            (s for s in response.json()['sources'] if 'Nebius' in s['name']),
            None,
        )
        self.assertIsNotNone(nebius_source)
        self.assertEqual(nebius_source['status'], 'Configured')
        # Key value must never appear in the response body
        self.assertNotIn('test-key-abc', response.text)


class MultiHazardAndCountryTests(unittest.TestCase):
    """Verify multi-hazard categories, country resolution, and geospatial endpoints."""

    def setUp(self) -> None:
        self.client = TestClient(server.app)

    def test_countries_endpoint_returns_data(self) -> None:
        response = self.client.get('/api/countries')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('countries', data)
        self.assertIn('geoData', data)
        self.assertIn('Japan', data['geoData'])
        self.assertIn('United States', data['geoData'])
        self.assertIn('center', data['geoData']['Japan'])
        self.assertIn('zoom', data['geoData']['Japan'])

    def test_all_ten_hazard_categories_represented_in_seeds(self) -> None:
        expected_categories = {
            'Earthquake', 'Cyclone', 'Flood', 'Wildfire', 'Volcano',
            'Tsunami', 'Drought', 'Storm', 'Landslide', 'Extreme Temperature',
        }
        actual_categories = {event['hazardCategory'] for event in server.SEED_EVENTS}
        self.assertTrue(expected_categories.issubset(actual_categories), f'Missing: {expected_categories - actual_categories}')

    def test_resolve_country_functionality(self) -> None:
        import geo_utils
        self.assertEqual(geo_utils.resolve_country('74 km ESE of Sendai, Japan', 38.3, 142.3), 'Japan')
        self.assertEqual(geo_utils.resolve_country('10km NW of Malibu, CA', 34.0, -118.8), 'United States')
        self.assertEqual(geo_utils.resolve_country('', -15.3, 166.9, raw_country='Vanuatu'), 'Vanuatu')
        self.assertEqual(geo_utils.resolve_country('25km S of Christchurch, New Zealand', -43.5, 172.6), 'New Zealand')

    def test_gdacs_parser_handles_xml(self) -> None:
        import hazard_ingestion
        mock_xml = b'''<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:gdacs="http://www.gdacs.org" xmlns:georss="http://www.georss.org/georss">
          <channel>
            <item>
              <title>Red tropical cyclone Alert in Philippines</title>
              <gdacs:eventtype>TC</gdacs:eventtype>
              <gdacs:alertlevel>Red</gdacs:alertlevel>
              <gdacs:country>Philippines</gdacs:country>
              <gdacs:eventid>tc-101</gdacs:eventid>
              <georss:point>14.59 120.98</georss:point>
              <link>https://www.gdacs.org/report.aspx?eventid=tc-101</link>
            </item>
          </channel>
        </rss>'''

        class MockResp:
            status_code = 200
            content = mock_xml
            def raise_for_status(self): pass

        class MockClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def get(self, url, **kwargs): return MockResp()

        with patch('hazard_ingestion.httpx.AsyncClient', return_value=MockClient()):
            events = asyncio.run(hazard_ingestion.fetch_gdacs_disasters(use_cache=False))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['hazardCategory'], 'Cyclone')
        self.assertEqual(events[0]['severity'], 'Critical')
        self.assertEqual(events[0]['country'], 'Philippines')

    def test_nasa_eonet_parser_handles_json(self) -> None:
        import hazard_ingestion
        mock_json = {
            'events': [
                {
                    'id': 'EONET_9999',
                    'title': 'Wildfire in Los Angeles Hills',
                    'categories': [{'id': 'wildfires', 'title': 'Wildfires'}],
                    'geometry': [{'date': '2026-10-18T12:00:00Z', 'type': 'Point', 'coordinates': [-118.5, 34.2]}],
                    'link': 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_9999'
                }
            ]
        }

        class MockResp:
            status_code = 200
            def json(self): return mock_json
            def raise_for_status(self): pass

        class MockClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def get(self, url, **kwargs): return MockResp()

        with patch('hazard_ingestion.httpx.AsyncClient', return_value=MockClient()):
            events = asyncio.run(hazard_ingestion.fetch_nasa_eonet_events(use_cache=False))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['hazardCategory'], 'Wildfire')
        self.assertEqual(events[0]['country'], 'United States')


if __name__ == '__main__':
    unittest.main(verbosity=2)
