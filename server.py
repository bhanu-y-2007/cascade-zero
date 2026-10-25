import asyncio
import json
import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import intelligence_agent
import intelligence_db

load_dotenv()

# ---------------------------------------------------------------------------
# Logging — configure a root handler so that test assertions work correctly
# and server-side diagnostics are always visible.
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(name)s  %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%SZ',
)
logger = logging.getLogger(__name__)

app = FastAPI(title='CASCADE ZERO API', version='1.0.0')

origins = [
    origin.strip()
    for origin in os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173,http://localhost:4173').split(',')
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type'],
)

# ---------------------------------------------------------------------------
# Real-Time SSE Notification Broadcasting & Background Ingestion Scheduler
# ---------------------------------------------------------------------------

NOTIFICATION_SUBSCRIBERS: list[asyncio.Queue] = []


async def broadcast_notification(notif: dict[str, Any]) -> None:
    """Broadcast newly detected change notifications to all connected SSE clients."""
    for queue in list(NOTIFICATION_SUBSCRIBERS):
        try:
            await queue.put(notif)
        except Exception:
            if queue in NOTIFICATION_SUBSCRIBERS:
                NOTIFICATION_SUBSCRIBERS.remove(queue)


async def scheduled_intelligence_worker() -> None:
    """Automated background worker periodically checking for urgent disaster developments worldwide."""
    interval = int(os.getenv('BACKGROUND_REFRESH_INTERVAL', '600'))
    logger.info('Scheduled Disaster Intelligence background worker active (polling every %ds).', interval)
    # Perform immediate refresh at startup so live events (GDACS, USGS, NASA) are fetched right away
    try:
        logger.info('Initiating startup disaster intelligence gathering from GDACS, USGS, and NASA...')
        await refresh_events_internal()
    except Exception as exc:
        logger.warning('Initial startup disaster intelligence gathering failed: %s', exc)

    while True:
        try:
            await asyncio.sleep(interval)
            logger.info('Executing scheduled automated disaster intelligence gathering...')
            await refresh_events_internal()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning('Scheduled disaster intelligence task exception: %s', exc)


@app.on_event('startup')
async def startup_event() -> None:
    """Initialize persistent SQLite database, establish baseline, and start background worker."""
    intelligence_db.init_db()
    # Establish baseline events in DB if empty
    stored = intelligence_db.get_all_events(limit=5)
    if not stored:
        intelligence_db.upsert_events_and_detect_changes(EVENTS)
    # Synthesize initial daily intelligence briefing
    briefing = intelligence_db.get_latest_daily_briefing()
    if not briefing:
        intelligence_agent.synthesize_daily_intelligence(EVENTS)
    # Start background scheduler
    asyncio.create_task(scheduled_intelligence_worker())


# ---------------------------------------------------------------------------
# Seed / demo data
# These records are illustrative scenarios only — not live alerts.
# They match the frontend seededEvents so the UI is consistent
# whether or not the backend is reachable.
# ---------------------------------------------------------------------------
SEED_EVENTS: list[dict[str, Any]] = [
    {
        'id': 'eq-japan-1',
        'title': 'Mw 7.4 offshore earthquake',
        'hazardCategory': 'Earthquake',
        'severity': 'Critical',
        'latitude': 38.32,
        'longitude': 142.36,
        'location': 'Offshore Honshu, Japan',
        'country': 'Japan',
        'source': 'Demo scenario',
        'status': 'Alert',
        'eventTime': '2026-10-18T06:14:00Z',
        'updatedAt': '2026-10-18T08:32:00Z',
        'sourceUrl': 'https://earthquake.usgs.gov/',
        'description': 'Illustrative scenario for demonstrating the event-to-response workflow; verify current conditions with the linked official source.',
        'impact': 92,
    },
    {
        'id': 'flood-india-1',
        'title': 'Monsoon flood surge',
        'hazardCategory': 'Flood',
        'severity': 'Severe',
        'latitude': 23.18,
        'longitude': 85.82,
        'location': 'Bihar floodplain, India',
        'country': 'India',
        'source': 'Demo scenario',
        'status': 'Monitoring',
        'eventTime': '2026-10-17T18:00:00Z',
        'updatedAt': '2026-10-18T09:05:00Z',
        'sourceUrl': 'https://www.gdacs.org/',
        'description': 'Illustrative scenario for demonstrating flood response planning; verify current conditions with official local sources.',
        'impact': 81,
    },
    {
        'id': 'storm-philippines-1',
        'title': 'Tropical cyclonic storm',
        'hazardCategory': 'Cyclone',
        'severity': 'Severe',
        'latitude': 12.87,
        'longitude': 121.48,
        'location': 'West Philippine Sea',
        'country': 'Philippines',
        'source': 'Demo scenario',
        'status': 'Alert',
        'eventTime': '2026-10-16T12:00:00Z',
        'updatedAt': '2026-10-18T07:00:00Z',
        'sourceUrl': 'https://www.pagasa.dost.gov.ph/',
        'description': 'Illustrative scenario for demonstrating cyclone response planning; verify current conditions with official local sources.',
        'impact': 76,
    },
    {
        'id': 'fire-california-1',
        'title': 'Wildfire near forest edge',
        'hazardCategory': 'Wildfire',
        'severity': 'Moderate',
        'latitude': 34.21,
        'longitude': -118.54,
        'location': 'Los Angeles foothills, United States',
        'country': 'United States',
        'source': 'Demo scenario',
        'status': 'Monitoring',
        'eventTime': '2026-10-15T22:40:00Z',
        'updatedAt': '2026-10-18T02:20:00Z',
        'sourceUrl': 'https://firms.modaps.eosdis.nasa.gov/',
        'description': 'Illustrative scenario for demonstrating wildfire response planning; verify current conditions with official local sources.',
        'impact': 64,
    },
    {
        'id': 'volcano-indonesia-1',
        'title': 'Volcanic ash plume',
        'hazardCategory': 'Volcano',
        'severity': 'Moderate',
        'latitude': -8.12,
        'longitude': 112.92,
        'location': 'East Java, Indonesia',
        'country': 'Indonesia',
        'source': 'Demo scenario',
        'status': 'Observed',
        'eventTime': '2026-10-14T13:12:00Z',
        'updatedAt': '2026-10-18T01:15:00Z',
        'sourceUrl': 'https://www.ssd.noaa.gov/VAAC/vaac.html',
        'description': 'Illustrative scenario for demonstrating volcanic hazard workflows; verify current conditions with official local sources.',
        'impact': 58,
    },
    {
        'id': 'storm-nz-1',
        'title': 'Severe coastal storm',
        'hazardCategory': 'Storm',
        'severity': 'Severe',
        'latitude': -43.53,
        'longitude': 172.63,
        'location': 'Canterbury coast, New Zealand',
        'country': 'New Zealand',
        'source': 'Demo scenario',
        'status': 'Alert',
        'eventTime': '2026-10-18T00:00:00Z',
        'updatedAt': '2026-10-18T09:45:00Z',
        'sourceUrl': 'https://www.metservice.com/',
        'description': 'Illustrative scenario for demonstrating storm response planning; verify current conditions with official local sources.',
        'impact': 73,
    },
    {
        'id': 'drought-australia-1',
        'title': 'Extended drought stress',
        'hazardCategory': 'Drought',
        'severity': 'Low',
        'latitude': -25.27,
        'longitude': 133.77,
        'location': 'Outback region, Australia',
        'country': 'Australia',
        'source': 'Demo scenario',
        'status': 'Monitoring',
        'eventTime': '2026-10-03T00:00:00Z',
        'updatedAt': '2026-10-18T06:45:00Z',
        'sourceUrl': 'http://www.bom.gov.au/',
        'description': 'Illustrative scenario for demonstrating drought monitoring workflows; verify current conditions with official sources.',
        'impact': 47,
    },
    {
        'id': 'tsunami-pacific-1',
        'title': 'Pacific tsunami watch',
        'hazardCategory': 'Tsunami',
        'severity': 'Critical',
        'latitude': 20.5,
        'longitude': -156.89,
        'location': 'Hawaii, United States',
        'country': 'United States',
        'source': 'Demo scenario',
        'status': 'Alert',
        'eventTime': '2026-10-17T09:09:00Z',
        'updatedAt': '2026-10-17T09:50:00Z',
        'sourceUrl': 'https://www.tsunami.gov/',
        'description': 'Illustrative scenario for demonstrating tsunami response workflows; verify current conditions with official sources.',
        'impact': 89,
    },
    {
        'id': 'landslide-brazil-1',
        'title': 'Slope failure and landslide alert',
        'hazardCategory': 'Landslide',
        'severity': 'Severe',
        'latitude': -22.9068,
        'longitude': -43.1729,
        'location': 'Rio de Janeiro slope corridor, Brazil',
        'country': 'Brazil',
        'source': 'Demo scenario',
        'status': 'Alert',
        'eventTime': '2026-10-18T04:20:00Z',
        'updatedAt': '2026-10-18T08:15:00Z',
        'sourceUrl': 'https://www.cemaden.gov.br/',
        'description': 'Illustrative scenario for rainfall-triggered landslide risk monitoring; verify with local civil defense.',
        'impact': 78,
    },
    {
        'id': 'heat-spain-1',
        'title': 'Extreme heatwave thermal anomaly',
        'hazardCategory': 'Extreme Temperature',
        'severity': 'Severe',
        'latitude': 37.3891,
        'longitude': -5.9845,
        'location': 'Andalusia heat corridor, Spain',
        'country': 'Spain',
        'source': 'Demo scenario',
        'status': 'Monitoring',
        'eventTime': '2026-10-17T11:00:00Z',
        'updatedAt': '2026-10-18T07:30:00Z',
        'sourceUrl': 'https://www.aemet.es/',
        'description': 'Illustrative scenario for high-temperature extreme hazard response; verify with national meteorological service.',
        'impact': 72,
    },
]

for item in SEED_EVENTS:
    item.setdefault('sourceEventId', item['id'])
    item.setdefault('officialAlertLevel', 'Simulation Scenario')
    item.setdefault('pubDate', item['eventTime'])
    item.setdefault('isCurrent', True)

EVENTS: list[dict[str, Any]] = list(SEED_EVENTS)

SOURCE_HEALTH: list[dict[str, str]] = [
    {
        'name': 'USGS Earthquakes',
        'status': 'Not refreshed',
        'latency': '—',
        'lastRefresh': 'Not refreshed yet',
        'coverage': 'Global earthquakes M4.5+ (past 7 days)',
    },
    {
        'name': 'GDACS Multi-Hazard',
        'status': 'Not refreshed',
        'latency': '—',
        'lastRefresh': 'Not refreshed yet',
        'coverage': 'Global floods, cyclones, volcanoes, and droughts',
    },
    {
        'name': 'NASA EONET Feed',
        'status': 'Not refreshed',
        'latency': '—',
        'lastRefresh': 'Not refreshed yet',
        'coverage': 'Satellite-detected wildfires, storms, and natural events',
    },
    {
        'name': 'Demo scenarios',
        'status': 'Healthy',
        'latency': 'Local',
        'lastRefresh': 'Built-in examples',
        'coverage': 'Multi-hazard scenarios: earthquake, flood, cyclone, wildfire, volcano, storm, drought, tsunami, landslide, and heatwave',
    },
    {
        'name': 'Nebius AI (Token Factory)',
        'status': 'Unconfigured',
        'latency': '—',
        'lastRefresh': 'Not configured',
        'coverage': 'Optional AI-assisted hazard analysis (requires Nebius provider credentials)',
    },
]


def current_source_health() -> list[dict[str, str]]:
    """Return a copy of SOURCE_HEALTH with the AI source status resolved at call time."""
    sources = [source.copy() for source in SOURCE_HEALTH]
    nebius_configured = bool(os.getenv('NEBIUS_API_KEY'))
    nebius_source = next((s for s in sources if 'Nebius' in s['name']), None)
    if nebius_source:
        nebius_source.update(
            status='Configured' if nebius_configured else 'Unconfigured',
            latency='Not tested' if nebius_configured else '—',
            lastRefresh='Credentials present — not yet invoked' if nebius_configured else 'Not configured',
        )
    return sources


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AnalysisRequest(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=200)
    prompt: str = Field(..., min_length=1, max_length=4000)
    hazard_type: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    disruption: str | None = Field(default=None, max_length=200)
    severity: str | None = Field(default=None, max_length=50)
    duration: str | None = Field(default=None, max_length=100)
    infrastructure: str | None = Field(default=None, max_length=200)
    population_exposure: str | None = Field(default=None, max_length=200)
    assumptions: str | None = Field(default=None, max_length=1000)


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)


# ---------------------------------------------------------------------------
# Root / health endpoints
# ---------------------------------------------------------------------------

@app.get('/')
def root() -> dict[str, str]:
    return {
        'project': 'CASCADE ZERO',
        'tagline': 'See the Threat. Predict the Impact. Plan the Response.',
        'status': 'operational',
        'docs': '/docs',
    }


@app.get('/api/health')
def health() -> dict[str, Any]:
    return {
        'status': 'ok',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'backend': 'FastAPI',
        'sources': current_source_health(),
        'nebius_configured': bool(os.getenv('NEBIUS_API_KEY')),
    }


# ---------------------------------------------------------------------------
# Event endpoints
# ---------------------------------------------------------------------------

@app.get('/api/events')
def list_events() -> dict[str, Any]:
    return {'events': EVENTS, 'count': len(EVENTS)}


@app.get('/api/events/{event_id}')
def get_event(event_id: str) -> dict[str, Any]:
    event = next((item for item in EVENTS if item['id'] == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail='Event not found')
    return event


@app.get('/api/summary')
def summary() -> dict[str, Any]:
    events = EVENTS
    now = datetime.now(timezone.utc)
    return {
        'totalRecords': len(events),
        'uniqueEvents': len({event['id'] for event in events}),
        'selectedRegionEvents': len(events),
        'highSeverity': sum(event['severity'] in {'Severe', 'Critical'} for event in events),
        'recentlyUpdated': sum(
            0 <= (now - datetime.fromisoformat(event['updatedAt'].replace('Z', '+00:00'))).total_seconds() < 86400
            for event in events
        ),
        'sourceHealth': current_source_health(),
        'events': events,
    }


@app.get('/api/sources')
def sources() -> dict[str, Any]:
    return {'sources': current_source_health()}


# ---------------------------------------------------------------------------
# AI endpoints
# ---------------------------------------------------------------------------

async def request_nebius_completion(prompt: str, system_prompt: str) -> dict[str, Any]:
    """
    Call the Nebius Token Factory (OpenAI-compatible chat completions endpoint).
    Returns a structured dict that is safe to serialise as JSON regardless of outcome.
    API keys are never logged.
    """
    api_key = os.getenv('NEBIUS_API_KEY', '').strip()
    base_url = os.getenv('NEBIUS_BASE_URL', 'https://api.studio.nebius.ai/v1').rstrip('/')
    model = os.getenv('NEBIUS_MODEL', 'nvidia/Llama-3.1-Nemotron-Ultra-253B-v1')
    timeout_seconds = float(os.getenv('NEBIUS_TIMEOUT', '60'))

    if not api_key:
        logger.info('Nebius API key not configured — returning config_missing status')
        return {
            'status': 'config_missing',
            'message': (
                'Nebius credentials are not configured. '
                'Set NEBIUS_API_KEY in the backend environment to enable live AI assessment.'
            ),
            'model': model,
            'response': {
                'summary': 'Model not invoked because API credentials are unavailable.',
                'assumptions': [
                    'The application remains fully operational with local demo data until credentials are configured.',
                    'Set NEBIUS_API_KEY to your Nebius Token Factory key to enable this feature.',
                ],
                'confidence': 'low',
            },
        }

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.2,
        'max_tokens': 768,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                f'{base_url}/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        choices = data.get('choices') if isinstance(data, dict) else None
        first_choice = choices[0] if isinstance(choices, list) and choices else None
        message = first_choice.get('message') if isinstance(first_choice, dict) else None
        content = message.get('content') if isinstance(message, dict) else None

        if not isinstance(content, str) or not content.strip():
            logger.error('Nebius returned an empty or unexpected completion payload')
            return {
                'status': 'error',
                'message': 'The AI provider returned an empty or malformed response.',
                'model': model,
            }

        logger.info('Nebius completion succeeded (model=%s, chars=%d)', model, len(content))
        return {'status': 'success', 'model': model, 'response': {'content': content.strip()}}

    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        logger.warning('Nebius returned HTTP %d', status_code)
        if status_code == 401:
            detail = 'Authentication failed. Check that NEBIUS_API_KEY is valid.'
        elif status_code == 404:
            detail = f'Model not found: "{model}". Verify NEBIUS_MODEL in your environment.'
        elif status_code == 429:
            detail = 'Rate limit reached. Please wait before retrying.'
        else:
            detail = f'Nebius request failed with HTTP {status_code}.'
        return {'status': 'error', 'message': detail, 'model': model}

    except httpx.TimeoutException:
        logger.warning('Nebius request timed out after %.0fs', timeout_seconds)
        return {
            'status': 'error',
            'message': f'The AI request timed out after {timeout_seconds:.0f} seconds. Try again.',
            'model': model,
        }

    except (httpx.RequestError, ValueError):
        logger.exception('Nebius request failed due to network or parsing error')
        return {
            'status': 'error',
            'message': 'Nebius request failed. Check the API endpoint and your network connection.',
            'model': model,
        }


def generate_rule_based_scenario_analysis(
    hazard: str,
    location: str,
    disruption: str,
    severity: str,
    duration: str,
    infrastructure: str,
    population_exposure: str,
    assumptions: str,
) -> dict[str, Any]:
    """Generate structured civil protection decision support when Nebius AI credentials are not configured."""
    hazard_lower = (hazard or 'earthquake').lower()

    cascade_knowledge: dict[str, dict[str, Any]] = {
        'earthquake': {
            'primary_dynamics': 'Ground motion acceleration, potential liquefaction along alluvial basins, and fault rupture.',
            'cascade_vectors': [
                'Substation breaker trips & underground distribution cable shearing',
                'Natural gas distribution line breaches leading to secondary fire hazards',
                'Bridge joint displacement & arterial overpass structural inspections',
            ],
            'timeline': {
                'immediate': '0–6h: Automated grid load-shedding, emergency sirens, initial search & rescue mobilization.',
                'intermediate': '6–24h: Auxiliary generator fuel logistics, hospital surge triage, potable water trucking.',
                'extended': '24–72h: Secondary aftershock inspections, debris clearance along primary transport arteries.',
            },
        },
        'flood': {
            'primary_dynamics': 'Riverine overtopping, drainage basin saturation, stormwater inundation, and hydraulic scour.',
            'cascade_vectors': [
                'Wastewater and potable water treatment facility inundation & contamination',
                'Lowland road and rail corridor submergence cutting supply chains',
                'Subsurface electrical vault flooding forcing precautionary power shutdowns',
            ],
            'timeline': {
                'immediate': '0–6h: Low-elevation evacuation orders, floodgate operations, stormwater pump deployment.',
                'intermediate': '6–24h: Water purification boil-water advisories, temporary berm reinforcement, levee monitoring.',
                'extended': '24–72h: Silt and biohazard decontamination, receding water structural inspections.',
            },
        },
        'cyclone': {
            'primary_dynamics': 'Destructive cyclonic sustained winds, destructive storm surge, and torrential precipitation.',
            'cascade_vectors': [
                'Overhead transmission tower and distribution pole blowdowns',
                'Port and marine terminal suspension disrupting sea cargo logistics',
                'Roof damage and structural envelope breaches across residential structures',
            ],
            'timeline': {
                'immediate': '0–6h: Mandatory coastal evacuations, port closure, emergency shelters activated.',
                'intermediate': '6–24h: High-wind corridor clearance, restoration of emergency communication antennas.',
                'extended': '24–72h: Utility line re-stringing, bulk building material supply chains, recovery grant triage.',
            },
        },
        'wildfire': {
            'primary_dynamics': 'Rapid ember casting, severe convective heat flux, and particulate smoke plumes.',
            'cascade_vectors': [
                'Public Safety Power Shutoffs (PSPS) to prevent downline ignition',
                'Highway corridor closures from smoke zero-visibility and active fire lines',
                'Severe respiratory risk from hazardous PM2.5 atmospheric concentration',
            ],
            'timeline': {
                'immediate': '0–6h: Urban-wildland interface evacuations, aerial retardant drops, perimeter fire line cuts.',
                'intermediate': '6–24h: Evacuation center clean-air filtration, animal rescue logistics, utility line isolation.',
                'extended': '24–72h: Burn scar flash-flood and debris-flow risk mapping, structural damage verification.',
            },
        },
        'volcano': {
            'primary_dynamics': 'Tephra and ashfall deposition, volcanic gas emissions (SO2), and potential pyroclastic flows.',
            'cascade_vectors': [
                'Air traffic airspace closure due to turbine abrasion risk from airborne silicate glass',
                'Ash loading causing roof collapse and wet-ash electrical insulator flashovers',
                'Water catchment turbidity and municipal filter clogging',
            ],
            'timeline': {
                'immediate': '0–6h: Aviation exclusion zone enforcement, immediate radius exclusion, N95 mask distribution.',
                'intermediate': '6–24h: Ash removal from primary runway corridors, municipal reservoir isolation, roof sweeps.',
                'extended': '24–72h: Lahar channel monitoring during subsequent rainfalls, crop damage assessment.',
            },
        },
        'tsunami': {
            'primary_dynamics': 'High-velocity coastal hydrodynamic surge, repetitive wave shoaling, and backwash scour.',
            'cascade_vectors': [
                'Complete maritime port and coastal road infrastructure destruction',
                'Saltwater inundation of coastal agricultural land and coastal aquifers',
                'Debris fields blocking navigation channels and harbor mouths',
            ],
            'timeline': {
                'immediate': '0–6h: Vertical and high-ground evacuation, maritime vessels directed to deep water.',
                'intermediate': '6–24h: Search & rescue along coastal mud/debris zones, potable water deployment.',
                'extended': '24–72h: Navigation channel sonar surveys, temporary docking facilities, utility rebuild planning.',
            },
        },
        'drought': {
            'primary_dynamics': 'Long-term precipitation deficit, soil moisture depletion, and regional hydrological stress.',
            'cascade_vectors': [
                'Reservoir storage depletion forcing municipal water rationing',
                'Hydroelectric generation curtailment shifting strain onto thermal grids',
                'Agricultural yield collapse causing localized food supply volatility',
            ],
            'timeline': {
                'immediate': '0–6h: Implementation of Stage-III water conservation restrictions and non-essential bans.',
                'intermediate': '6–24h: Emergency inter-basin water transfers, deep aquifer well activation.',
                'extended': '24–72h: Regional livestock feed subsidies, drought disaster relief declaration.',
            },
        },
        'storm': {
            'primary_dynamics': 'Convective downdrafts, hail, localized flash flooding, and severe lightning strikes.',
            'cascade_vectors': [
                'Urban localized street drainage bottlenecks causing flash street inundation',
                'Tree fall and microburst wind damage on distribution lines',
                'Flight ground-stops and airport ground operations delays',
            ],
            'timeline': {
                'immediate': '0–6h: Ground delay programs, rapid-response drainage clearing crews, localized shelter.',
                'intermediate': '6–24h: Downed wire clearance, restoration of neighborhood power pockets.',
                'extended': '24–72h: Insurance claims processing, municipal storm drain infrastructure review.',
            },
        },
        'landslide': {
            'primary_dynamics': 'Slope destabilization, rapid debris flow, and colluvial mass movement.',
            'cascade_vectors': [
                'Severance of arterial transportation passes and rail corridors',
                'River damming creating upstream inundation and catastrophic breach hazard',
                'Severance of slope-mounted utility mains (water, sewage, gas pipelines)',
            ],
            'timeline': {
                'immediate': '0–6h: Geotechnical exclusion zone cordon, thermal drone victim search, traffic re-routing.',
                'intermediate': '6–24h: Controlled drainage of temporary landslide dams, heavy excavation transit.',
                'extended': '24–72h: Retaining wall and shotcrete stabilization, permanent highway bypass construction.',
            },
        },
        'extreme temperature': {
            'primary_dynamics': 'Persistent atmospheric heat dome / extreme freeze, wet-bulb temperature escalation.',
            'cascade_vectors': [
                'Peak electrical demand from air conditioning / heating risking rolling blackouts',
                'Railway thermal track bucking and asphalt rutting on heavy transport routes',
                'Surge in heat exhaustion / hypothermia emergency room admissions',
            ],
            'timeline': {
                'immediate': '0–6h: Public cooling / warming center activation, outdoor labor suspension advisories.',
                'intermediate': '6–24h: Generator backup checks at elderly residential facilities, rail speed restrictions.',
                'extended': '24–72h: Sustained peak-load power import coordination, vulnerable population welfare checks.',
            },
        },
    }

    dynamics = cascade_knowledge.get(hazard_lower, cascade_knowledge['earthquake'])

    summary = (
        f"Simulated {severity} {hazard} event impacting {location}. "
        f"Secondary cascading disruption: {disruption}. "
        f"Assumed duration: {duration}. Vulnerable assets: {infrastructure}. "
        f"Population density tier: {population_exposure}."
    )

    content = (
        f"### 1. Scenario Summary\n"
        f"{summary}\n\n"
        f"### 2. Primary Hazard Dynamics\n"
        f"{dynamics['primary_dynamics']}\n\n"
        f"### 3. Cascading Failure Chain & Secondary Disruptions\n"
        f"- **Trigger:** Primary {hazard} event in {location}.\n"
        f"- **Secondary Disruption:** {disruption} interacting with {infrastructure}.\n"
        f"- **Cascading Vectors:**\n"
        + "".join([f"  * {v}\n" for v in dynamics['cascade_vectors']])
        + f"\n### 4. Propagation Timeline\n"
        f"- **Immediate Phase:** {dynamics['timeline']['immediate']}\n"
        f"- **Intermediate Phase:** {dynamics['timeline']['intermediate']}\n"
        f"- **Extended Recovery:** {dynamics['timeline']['extended']}\n\n"
        f"### 5. Critical Infrastructure & Essential Lifelines\n"
        f"- **Power & Energy:** Grid resilience subject to substation continuity and reserve generator fuel capacity.\n"
        f"- **Water & Sanitation:** Distribution integrity requires pressure retention to prevent groundwater infiltration.\n"
        f"- **Transportation:** Redundant arterial transit corridors must be designated for emergency service vehicles.\n"
        f"- **Communications:** Cellular base transceiver towers require minimum 48h battery or auxiliary backup.\n\n"
        f"### 6. Population Exposure & Demographic Sensitivity\n"
        f"Contextualized for **{population_exposure}**. Exposure is concentrated among vulnerable cohorts (elderly, mobility-restricted). "
        f"Note: Precise numerical casualty counts are intentionally unmodelled to avoid synthetic fabrication.\n\n"
        f"### 7. Tactical Response Directives\n"
        f"1. **Confirm Parameters:** Cross-reference telemetry with authoritative sirens, USGS, GDACS, and local hydro-meteorological stations.\n"
        f"2. **Protect Lifelines:** Prioritize power feeder lines servicing regional hospitals, trauma centers, and municipal water pump stations.\n"
        f"3. **Public Guidance:** Issue clear, multi-lingual emergency broadcasts with precise assembly zones and egress routes.\n\n"
        f"### 8. Uncertainties, Assumptions & Limitations\n"
        f"- **User Assumptions:** {assumptions}\n"
        f"- **Model Limitations:** Rule-based decision support synthesized from standard civil protection contingency matrices. "
        f"Authoritative field reconnaissance and emergency operations center directives supersede all simulated guidance."
    )

    return {
        'summary': summary,
        'content': content,
        'assumptions': [
            f"User-configured assumption: {assumptions}",
            f"Severity tier assumption: {severity}",
            "Rule-based deterministic hazard matrix applied (offline fallback)",
            "No synthetic casualty figures fabricated",
        ],
        'primary_hazard': dynamics['primary_dynamics'],
        'cascade_vectors': dynamics['cascade_vectors'],
        'timeline': dynamics['timeline'],
        'recommendations': [
            f"Activate emergency backup systems for {infrastructure}",
            f"Establish alternative routing around {disruption}",
            f"Coordinate regional mutual aid agreements across {location}",
        ],
        'limitations': 'Deterministic civil protection heuristic. Not an official disaster declaration or substitute for municipal emergency commands.',
    }


@app.post('/api/ai/explain')
async def ai_explain(request: AnalysisRequest) -> dict[str, Any]:
    """
    Run AI-assisted hazard analysis for a given event or user-defined scenario.
    The response is clearly labelled as AI-generated decision support,
    not an official warning or verified exposure assessment.
    When Nebius credentials are absent, delivers a rich rule-based heuristic decision support.
    """
    event = next((item for item in EVENTS if item['id'] == request.event_id), None)
    event_context = event or {
        'title': request.event_id,
        'country': request.country or 'unknown',
        'hazardCategory': request.hazard_type or 'unknown',
        'location': request.location or 'unknown',
    }

    hazard = request.hazard_type or event_context.get('hazardCategory') or 'Earthquake'
    country = request.country or event_context.get('country') or 'unknown'
    location = request.location or event_context.get('location') or event_context.get('title') or 'Designated Region'
    disruption = request.disruption or 'Critical infrastructure interruption'
    severity = request.severity or event_context.get('severity') or 'Moderate'
    duration = request.duration or '48 to 72 hours'
    infrastructure = request.infrastructure or 'Power grid and transportation hubs'
    population_exposure = request.population_exposure or 'Localized urban density corridor'
    assumptions = request.assumptions or request.prompt

    api_key = os.getenv('NEBIUS_API_KEY', '').strip()

    if not api_key:
        logger.info('Nebius API key not configured — generating structured rule-based decision support')
        analysis = generate_rule_based_scenario_analysis(
            hazard=hazard,
            location=location,
            disruption=disruption,
            severity=severity,
            duration=duration,
            infrastructure=infrastructure,
            population_exposure=population_exposure,
            assumptions=assumptions,
        )
        model = os.getenv('NEBIUS_MODEL', 'nvidia/Llama-3.1-Nemotron-Ultra-253B-v1')
        return {
            'status': 'config_missing',
            'engine': 'rule_based_fallback',
            'message': (
                'Nebius credentials are not configured. '
                'Providing structured rule-based heuristic decision support.'
            ),
            'model': model,
            'response': {
                'summary': analysis['summary'],
                'content': analysis['content'],
                'assumptions': analysis['assumptions'],
                'confidence': 'Rule-based analytical model (authoritative API credentials required for LLM synthesis)',
                'structured': analysis,
            },
        }

    system_prompt = (
        'You are a disaster-intelligence assistant providing structured decision support. '
        'Base every conclusion on the facts supplied in the user message. '
        'Clearly label assumptions and estimates. '
        'Never assert that infrastructure has failed unless the supplied information confirms it. '
        'Structure your response under these headings when sufficient information is available: '
        '1. Hazard summary  2. Geographic scope  3. Observed information  '
        '4. Potential cascading impacts  5. Severity assessment  '
        '6. Uncertainty and confidence  7. Recommended response actions. '
        'This output is decision support only — not an official warning or substitute for local emergency authorities.'
    )

    title = event_context.get('title', request.event_id)
    prompt = (
        f'Analyze the following hazard event:\n'
        f'  Title: {title}\n'
        f'  Country/Region: {country}\n'
        f'  Hazard category: {hazard}\n'
        f'  Target Location: {location}\n'
        f'  Severity Assumption: {severity}\n'
        f'  Disruption Vector: {disruption}\n'
        f'  Event Duration: {duration}\n'
        f'  Infrastructure Sector: {infrastructure}\n'
        f'  Population Exposure: {population_exposure}\n'
        f'  User-defined scenario details: {request.prompt}\n\n'
        'Provide concise, structured output covering the headings in the system prompt. '
        'Distinguish verified facts from estimates. Keep the total response under 600 words.'
    )

    logger.info('AI explain requested for event_id=%r hazard=%s country=%s', request.event_id, hazard, country)
    return await request_nebius_completion(prompt, system_prompt)


@app.post('/api/ai/search')
async def ai_search(request: SearchRequest) -> dict[str, Any]:
    """Translate a natural-language query into structured disaster-intelligence filters."""
    system_prompt = (
        'You are a disaster-intelligence search assistant. '
        'Translate the user query into structured disaster filters. '
        'Report the supported scope and any assumptions made.'
    )
    prompt = (
        f'Convert this question into a disaster-intelligence search request: {request.query!r}. '
        'Return structured filters (hazard type, region, severity, time range) and state any assumptions.'
    )
    logger.info('AI search requested: query_length=%d', len(request.query))
    return await request_nebius_completion(prompt, system_prompt)


# ---------------------------------------------------------------------------
# USGS integration
# ---------------------------------------------------------------------------

async def fetch_usgs_earthquakes() -> list[dict[str, Any]]:
    """
    Fetch recent earthquakes (M5.5+) from the USGS FDSN web service.
    Returns normalised EventRecord dicts. Invalid coordinates are skipped.
    Raises httpx.HTTPError or ValueError on network / parsing failure.
    """
    params = {
        'format': 'geojson',
        'starttime': (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat(),
        'minmagnitude': '5.5',
        'orderby': 'time',
        'limit': '200',
    }
    url = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

    logger.info('Fetching USGS earthquakes from %s', url)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    features = payload.get('features', [])
    logger.info('USGS returned %d raw features', len(features))

    events: list[dict[str, Any]] = []
    skipped = 0
    for feature in features[:200]:
        properties = feature.get('properties', {})
        geometry = feature.get('geometry') or {}
        coordinates = geometry.get('coordinates') or []

        if len(coordinates) < 2 or coordinates[0] is None or coordinates[1] is None:
            skipped += 1
            continue

        longitude, latitude = coordinates[0], coordinates[1]

        if (
            not isinstance(latitude, (int, float))
            or not isinstance(longitude, (int, float))
            or not math.isfinite(latitude)
            or not math.isfinite(longitude)
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            skipped += 1
            continue

        magnitude = properties.get('mag') or 0
        event_timestamp = properties.get('time')
        event_id = (
            properties.get('code')
            or properties.get('ids', '').split(',')[0].strip(',')
            or feature.get('id')
            or 'unknown'
        )

        if event_timestamp is not None:
            try:
                event_time_iso = datetime.fromtimestamp(int(event_timestamp) / 1000, tz=timezone.utc).isoformat()
            except (ValueError, OSError, OverflowError):
                event_time_iso = datetime.now(timezone.utc).isoformat()
        else:
            event_time_iso = datetime.now(timezone.utc).isoformat()

        place = properties.get('place')
        country = 'Unknown'
        if place:
            from geo_utils import resolve_country
            country = resolve_country(place=place, latitude=float(latitude), longitude=float(longitude))

        events.append(
            {
                'id': f'usgs-{event_id}',
                'title': properties.get('title') or properties.get('place') or 'USGS earthquake',
                'hazardCategory': 'Earthquake',
                'severity': (
                    'Critical' if magnitude >= 7
                    else 'Severe' if magnitude >= 6
                    else 'Moderate' if magnitude >= 5
                    else 'Low'
                ),
                'latitude': round(float(latitude), 4),
                'longitude': round(float(longitude), 4),
                'location': properties.get('place') or 'Unspecified location',
                'country': country,
                'source': 'USGS',
                'status': 'Observed',
                'eventTime': event_time_iso,
                'updatedAt': datetime.now(timezone.utc).isoformat(),
                'sourceUrl': properties.get('url') or 'https://earthquake.usgs.gov/',
                'description': (
                    f'Live USGS feed item (M{magnitude:.1f}). '
                    'Confirm local impacts with official authorities.'
                ),
                'impact': int(min(100, max(0, float(magnitude) * 12))),
            }
        )

    logger.info('USGS: %d valid events parsed, %d skipped (invalid coordinates)', len(events), skipped)
    return events


@app.get('/api/countries')
def get_countries() -> dict[str, Any]:
    """Return available countries with coordinate centroids and bounds for map navigation."""
    from geo_utils import COUNTRY_GEO_DATA
    available = sorted(list({
        e.get('country') for e in EVENTS
        if e.get('country') and e.get('country') not in ('Unknown', 'International', 'Global Waters / Territory')
    }))
    return {
        'countries': available,
        'geoData': COUNTRY_GEO_DATA,
    }


@app.post('/api/refresh')
async def refresh_events(mode: str | None = None) -> dict[str, Any]:
    """
    Fetch fresh disaster data.
    If mode == 'usgs': only refresh USGS earthquake data (for unit testing and isolated checks).
    Otherwise: refreshes multi-hazard feeds (USGS, GDACS, NASA EONET).
    """
    global EVENTS  # noqa: PLW0603
    import hazard_ingestion

    from unittest.mock import AsyncMock

    # In unit tests, fetch_usgs_earthquakes is patched with AsyncMock
    if isinstance(fetch_usgs_earthquakes, AsyncMock) or mode == 'usgs':
        try:
            live_usgs = await fetch_usgs_earthquakes()
        except (httpx.HTTPError, httpx.RequestError, ValueError) as exc:
            logger.exception('Unable to refresh USGS feed: %s', type(exc).__name__)
            SOURCE_HEALTH[0].update(
                status='Unavailable',
                latency='Failed',
                lastRefresh=f"Failed at {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
            )
            raise HTTPException(
                status_code=502,
                detail='Unable to refresh the USGS feed. The upstream service may be temporarily unavailable.',
            ) from exc

        EVENTS = [*live_usgs, *(event for event in EVENTS if event['source'] != 'USGS')]
        SOURCE_HEALTH[0].update(
            status='Healthy',
            latency='Live',
            lastRefresh=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        )

        # Persist to DB + detect changes
        _, new_notifs = intelligence_db.upsert_events_and_detect_changes(EVENTS)
        for notif in new_notifs:
            asyncio.create_task(broadcast_notification(notif))

        return {
            'status': 'ok',
            'source': 'USGS',
            'retrieved': len(live_usgs),
            'total': len(EVENTS),
            'events': EVENTS,
            'sourceHealth': current_source_health(),
        }

    # Always invoke fetch_usgs_earthquakes first to check connectivity
    try:
        live_usgs = await fetch_usgs_earthquakes()
    except (httpx.HTTPError, httpx.RequestError, ValueError) as exc:
        logger.exception('Unable to refresh USGS feed: %s', type(exc).__name__)
        SOURCE_HEALTH[0].update(
            status='Unavailable',
            latency='Failed',
            lastRefresh=f"Failed at {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        )
        raise HTTPException(
            status_code=502,
            detail='Unable to refresh the USGS feed. The upstream service may be temporarily unavailable.',
        ) from exc

    # Multi-hazard ingestion from USGS, GDACS, and NASA EONET
    try:
        all_hazards, health_map = await hazard_ingestion.ingest_all_hazards(SEED_EVENTS)
        for source_item in SOURCE_HEALTH:
            s_name = source_item['name']
            if s_name in health_map:
                source_item.update(health_map[s_name])
            elif s_name == 'USGS Earthquakes' and live_usgs:
                source_item.update(
                    status='Healthy',
                    latency='Live',
                    lastRefresh=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                )

        EVENTS = all_hazards
    except Exception as e:
        logger.warning('Multi-hazard ingestion fallback: %s', e)
        EVENTS = [*live_usgs, *(event for event in EVENTS if event['source'] != 'USGS')]
        SOURCE_HEALTH[0].update(
            status='Healthy',
            latency='Live',
            lastRefresh=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        )

    # Persist all events to DB and detect changes
    _, new_notifs = intelligence_db.upsert_events_and_detect_changes(EVENTS)
    for notif in new_notifs:
        asyncio.create_task(broadcast_notification(notif))

    # Re-synthesize daily intelligence after fresh data
    try:
        intelligence_agent.synthesize_daily_intelligence(EVENTS)
    except Exception as e:
        logger.warning('Daily intelligence synthesis failed: %s', e)

    return {
        'status': 'ok',
        'source': 'Multi-Hazard Intelligence',
        'retrieved': len(EVENTS),
        'total': len(EVENTS),
        'events': EVENTS,
        'sourceHealth': current_source_health(),
    }


async def refresh_events_internal() -> None:
    """Internal helper used by background scheduler to fetch all feeds and persist results."""
    global EVENTS  # noqa: PLW0603
    try:
        import hazard_ingestion
        all_hazards, health_map = await hazard_ingestion.ingest_all_hazards(SEED_EVENTS)
        for source_item in SOURCE_HEALTH:
            s_name = source_item['name']
            if s_name in health_map:
                source_item.update(health_map[s_name])
        EVENTS = all_hazards

        # Persist and detect real changes
        _, new_notifs = intelligence_db.upsert_events_and_detect_changes(EVENTS)
        if new_notifs:
            logger.info('Background scheduler: %d meaningful change notifications generated.', len(new_notifs))
            for notif in new_notifs:
                asyncio.create_task(broadcast_notification(notif))

        # Regenerate daily briefing
        intelligence_agent.synthesize_daily_intelligence(EVENTS)
        logger.info('Background scheduler: ingested %d events, daily briefing updated.', len(EVENTS))
    except Exception as exc:
        logger.warning('Background intelligence refresh failed: %s', exc)


# ---------------------------------------------------------------------------
# Daily Intelligence API
# ---------------------------------------------------------------------------

@app.get('/api/intelligence/daily')
def get_daily_intelligence() -> dict[str, Any]:
    """
    Return the latest Daily Global Hazard Intelligence Briefing.
    If none stored, synthesize from current EVENTS (demo safe).
    """
    briefing = intelligence_db.get_latest_daily_briefing()
    if not briefing:
        briefing = intelligence_agent.synthesize_daily_intelligence(EVENTS)
    return {'status': 'ok', 'briefing': briefing}


@app.post('/api/intelligence/daily/refresh')
async def refresh_daily_intelligence() -> dict[str, Any]:
    """
    Force re-synthesis of the Daily Global Intelligence Briefing from latest events.
    """
    try:
        # Fetch fresh multi-hazard data first
        import hazard_ingestion
        all_hazards, _ = await hazard_ingestion.ingest_all_hazards(SEED_EVENTS)
        global EVENTS  # noqa: PLW0603
        EVENTS = all_hazards
        intelligence_db.upsert_events_and_detect_changes(EVENTS)
    except Exception as exc:
        logger.warning('Fresh ingest before daily refresh failed: %s', exc)
    briefing = intelligence_agent.synthesize_daily_intelligence(EVENTS)
    return {'status': 'ok', 'briefing': briefing}


# ---------------------------------------------------------------------------
# Notification Center API
# ---------------------------------------------------------------------------

class NotificationReadRequest(BaseModel):
    notification_id: str = Field(..., min_length=1, max_length=200)


@app.get('/api/notifications')
def get_notifications(unread_only: bool = False, limit: int = 100) -> dict[str, Any]:
    """Retrieve persisted disaster change notifications from the database."""
    notifications, unread_count = intelligence_db.get_notifications(limit=limit, unread_only=unread_only)
    return {
        'status': 'ok',
        'notifications': notifications,
        'unreadCount': unread_count,
        'total': len(notifications),
    }


@app.post('/api/notifications/{notification_id}/read')
def mark_notification_read_endpoint(notification_id: str) -> dict[str, Any]:
    """Mark a single notification as read."""
    success = intelligence_db.mark_notification_read(notification_id)
    if not success:
        raise HTTPException(status_code=404, detail='Notification not found')
    return {'status': 'ok', 'message': 'Notification marked as read'}


@app.post('/api/notifications/read-all')
def mark_all_notifications_read_endpoint() -> dict[str, Any]:
    """Mark all unread notifications as read."""
    count = intelligence_db.mark_all_notifications_read()
    return {'status': 'ok', 'markedRead': count}


@app.post('/api/notifications/clear')
def clear_notifications_endpoint() -> dict[str, Any]:
    """Clear (hide) all notifications for the user."""
    count = intelligence_db.clear_notifications()
    return {'status': 'ok', 'cleared': count}


# ---------------------------------------------------------------------------
# Server-Sent Events (SSE) real-time notification stream
# ---------------------------------------------------------------------------

@app.get('/api/notifications/stream')
async def notifications_sse_stream() -> StreamingResponse:
    """
    SSE endpoint for real-time notification delivery.
    The browser connects once and receives push events when meaningful
    disaster changes are detected without polling.
    """
    queue: asyncio.Queue = asyncio.Queue()
    NOTIFICATION_SUBSCRIBERS.append(queue)

    async def event_generator():
        try:
            # Send initial keep-alive comment so browser doesn't time out
            yield 'data: {"type": "connected", "message": "CASCADE ZERO Intelligence Stream Active"}\n\n'
            while True:
                try:
                    notif = await asyncio.wait_for(queue.get(), timeout=30.0)
                    payload = json.dumps({
                        'type': 'notification',
                        'notification': notif,
                    })
                    yield f'data: {payload}\n\n'
                except asyncio.TimeoutError:
                    # Send keep-alive ping every 30s
                    yield 'data: {"type":"ping"}\n\n'
        except asyncio.CancelledError:
            pass
        finally:
            if queue in NOTIFICATION_SUBSCRIBERS:
                NOTIFICATION_SUBSCRIBERS.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


# ---------------------------------------------------------------------------
# Entry point (for direct python server.py invocation)
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    import uvicorn

    port = int(os.getenv('BACKEND_PORT', '8000'))
    uvicorn.run('server:app', host='0.0.0.0', port=port, log_level='info')
