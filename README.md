# CASCADE ZERO

**Global Multi-Hazard Intelligence and Decision Support Platform**

> See the Threat. Predict the Impact. Plan the Response.

CASCADE ZERO is an open-source decision-support dashboard for monitoring, visualising, analysing, and simulating worldwide natural hazards and their cascading effects on critical infrastructure and communities.

---

## ⚠️ Important Disclaimer

CASCADE ZERO is a **planning aid and decision-support tool only**. It is **not** an official warning system, a substitute for local emergency authorities, or a source of certified risk assessments. All scenario outputs, impact indices, and AI-generated analyses are clearly labelled as estimates and must be verified against official sources before operational decisions are made.

---

## Features

| Feature | Description | Live Data |
|---|---|---|
| **Global Monitor** | Interactive Carto/Leaflet world map with hazard-specific SVG symbols, color-blind accessible severity tiers, radar pulse animations, and country/severity/time/hazard filters | ✅ Multi-source: USGS, GDACS, NASA EONET |
| **Incident Explorer** | Searchable, sortable directory of all disaster events with direct map-dossier links | ✅ Unified normalized stream |
| **Scenario Builder** | Formulate user-defined hazard hypotheses across 10 categories; triggers AI decision support | ⚡ AI optional (Nebius Token Factory) |
| **Cascade Simulator** | Visual cascade pathways from hazard trigger → infrastructure failure → essential services | 🔵 Scenario-derived |
| **Impact Assessment** | Synthesized severity index and critical infrastructure dependency analysis | 🔵 Scenario-derived |
| **Recommendations** | Tactical priority recommendations (Local Commander, Infrastructure, Public Info) | 🔵 Scenario-derived |
| **Compare Scenarios** | Side-by-side severity index and resource allocation comparison | 🔵 Scenario-derived |
| **Reports** | Downloadable comprehensive JSON intelligence dossier | 🔵 Local export |
| **Data Sources & Health** | Real-time telemetry for USGS, GDACS, NASA EONET, Demo, and Nebius AI | ✅ Real-time per-source health |
| **Settings & About** | Dark & Light theme toggling with persistent CartoDB cartography | ✅ Persisted in localStorage |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│         Browser (Vite + React 18 + TypeScript)         │
│         Port 5173 (dev) / 4173 (preview)               │
│                                                        │
│  ┌──────────────────────────────┐ ┌─────────────────┐  │
│  │ Leaflet Map (CartoDB Tiles)  │ │ Recharts Panels │  │
│  │ Custom DivIcon SVG Markers   │ │ Real-Time Stats │  │
│  └──────────────────────────────┘ └─────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │  /api/*  (proxy in dev)
                            ▼
┌────────────────────────────────────────────────────────┐
│             FastAPI Backend (Python 3.11+)             │
│             Port 8000 (Uvicorn)                        │
│                                                        │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────┐  │
│  │ USGS FDSN      │ │ GDACS (UN/EC)  │ │ NASA EONET │  │
│  │ (Earthquakes)  │ │ (Multi-Hazard) │ │ (Fires/etc)│  │
│  └────────────────┘ └────────────────┘ └────────────┘  │
│  ┌────────────────┐ ┌────────────────┐                 │
│  │ Geo Country    │ │ Nebius AI      │                 │
│  │ Resolver Engine│ │ (Token Factory)│                 │
│  └────────────────┘ └────────────────┘                 │
└────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Description |
|---|---|---|
| Frontend framework | React 18 | Declarative component UI |
| Language | TypeScript 5.7+ | Strict type checking and compile-time validation |
| Build tool | Vite 6.0+ | Fast HMR dev server and optimized production bundles |
| Cartography | Leaflet + react-leaflet | Interactive GIS mapping with custom DivIcon SVG markers |
| Basemaps | CartoDB (Dark Matter & Voyager) + OpenStreetMap | High-contrast dark & light threat-intelligence tiles |
| Visualizations | Recharts 2.15+ | Hazard distribution and scenario comparison charts |
| Icons | Lucide React | Clean, modern iconography |
| Backend API | FastAPI 0.115+ | High-performance asynchronous REST endpoints |
| ASGI Server | Uvicorn 0.34+ | Asynchronous event loop runner |
| HTTP Client | HTTPX 0.28+ | Asynchronous HTTP client with connection pooling and timeouts |
| Data Validation | Pydantic 2.10+ | Request/response schema validation |
| Live Feeds | USGS, GDACS, NASA EONET | Free authoritative open feeds (no API key required) |
| AI Inference | Nebius Token Factory | OpenAI-compatible LLM endpoint (Llama-3.1-Nemotron) |

---

## Repository Structure

```
cascade-zero/
├── App.tsx                  # Primary React frontend application & view router
├── main.tsx                 # React DOM mount point
├── index.html               # Web application HTML shell
├── styles.css               # Threat-intelligence design system (Dark & Light themes)
├── geo_utils.py             # Geospatial country resolver and coordinate bounding boxes
├── hazard_ingestion.py      # Modular multi-hazard ingestion (USGS, GDACS, NASA EONET)
├── server.py                # FastAPI backend endpoints and API routes
├── vite.config.ts           # Vite configuration with /api proxy & chunk splitting
├── tsconfig*.json           # TypeScript configuration
├── eslint.config.js         # ESLint configuration
├── package.json             # Node dependencies and npm scripts
├── requirements.txt         # Python backend dependencies
├── powershell.cmd           # Cross-environment Windows PowerShell shim
├── tests/
│   └── test_api.py          # 27 comprehensive backend unit and integration tests
├── .env.example             # Clean environment variable template
├── README.md                # System documentation, runbook, and guide
├── Dockerfile.backend       # Backend container
├── Dockerfile.frontend      # Frontend container (Nginx)
├── docker-compose.yml       # Multi-service compose
└── nginx.conf               # Nginx config for frontend container
```

---

## Prerequisites

| Software | Minimum Version | Check |
|---|---|---|
| Python | 3.11 | `python --version` |
| Node.js | 18 LTS | `node --version` |
| npm | 9 | `npm --version` |

---

## Installation

### 1. Clone / unzip the project

```bash
cd cascade-zero
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
# Or inside a virtual environment (recommended):
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
npm install
```

---

## Environment Configuration

Copy the template and fill in your values:

```bash
cp .env.example .env
```

The **only required** variables for basic operation (without AI) are the defaults — the application works out of the box with demo data and live USGS earthquakes.

### Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `NEBIUS_API_KEY` | *(empty)* | No | Nebius Token Factory key. AI analysis is disabled without this. |
| `NEBIUS_BASE_URL` | `https://api.studio.nebius.ai/v1` | No | Override the Nebius endpoint. |
| `NEBIUS_MODEL` | `nvidia/Llama-3.1-Nemotron-Ultra-253B-v1` | No | Model identifier available in your account. |
| `NEBIUS_TIMEOUT` | `60` | No | Request timeout in seconds. |
| `BACKEND_PORT` | `8000` | No | Port the FastAPI backend listens on. |
| `FRONTEND_ORIGIN` | `http://localhost:5173,http://localhost:4173` | No | Comma-separated allowed CORS origins. |
| `VITE_API_BASE_URL` | *(empty)* | Production only | Backend URL used by the built frontend. Empty = use Vite proxy (dev only). |

---

## AI Provider and Model Configuration

CASCADE ZERO uses the **Nebius Token Factory** — an OpenAI-compatible inference endpoint that hosts a range of models including NVIDIA and other open models.

1. Create an account at [studio.nebius.ai](https://studio.nebius.ai/).
2. Generate an API key in the Token Factory section.
3. Set `NEBIUS_API_KEY=<your-key>` in your `.env`.
4. Confirm the model identifier (`NEBIUS_MODEL`) is listed in your account.

**Without a key**, the application operates fully in non-AI mode:
- All map, monitoring, and scenario-builder features work normally.
- The "Run AI analysis" button shows a clear "AI is not configured" message.
- No inference is attempted and no error is thrown.

---

## Hazard Data Sources

| Category | Provider | Endpoint | Credentials | Coverage | Update Frequency |
|---|---|---|---|---|---|
| **Earthquake** | USGS FDSN | `earthquake.usgs.gov/fdsnws/event/1/query` | None (public) | Global, M5.5+ | ~1 min delay |
| **Flood** | Demo scenario | Built-in | None | Illustrative only | — |
| **Cyclone** | Demo scenario | Built-in | None | Illustrative only | — |
| **Wildfire** | Demo scenario | Built-in | None | Illustrative only | — |
| **Volcano** | Demo scenario | Built-in | None | Illustrative only | — |
| **Storm** | Demo scenario | Built-in | None | Illustrative only | — |
| **Drought** | Demo scenario | Built-in | None | Illustrative only | — |
| **Tsunami** | Demo scenario | Built-in | None | Illustrative only | — |

> Only the **Earthquake** category retrieves live data. Click **"Refresh USGS"** in the top bar to fetch current M5.5+ earthquakes from the past 7 days. All other categories show clearly-labelled illustrative demo scenarios.

---

## Startup

### Backend

```bash
# Activate your virtual environment first if applicable
python server.py
```

The backend starts on `http://localhost:8000`. API docs are at `http://localhost:8000/docs`.

Health check: `curl http://localhost:8000/api/health`

### Frontend (development)

```bash
npm run dev
```

Opens at `http://localhost:5173`. The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:8000`.

> **Both services must be running simultaneously** for the full application to function.

### Frontend (production preview)

```bash
npm run build
VITE_API_BASE_URL=http://localhost:8000 npm run preview
```

Or set `VITE_API_BASE_URL` in `.env` before building, then run `npm run preview`.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service info and status |
| `GET` | `/api/health` | Health check with source statuses |
| `GET` | `/api/events` | List all events |
| `GET` | `/api/events/{id}` | Get event by ID |
| `GET` | `/api/summary` | Summary statistics + event list |
| `GET` | `/api/sources` | Data source health list |
| `POST` | `/api/refresh` | Fetch fresh USGS earthquake data |
| `POST` | `/api/ai/explain` | AI hazard analysis for an event/scenario |
| `POST` | `/api/ai/search` | Natural-language query to structured filters |

Interactive docs: `http://localhost:8000/docs`

### POST /api/ai/explain — request body

```json
{
  "event_id": "eq-japan-1",
  "prompt": "Scenario: M7.4 offshore Honshu. Secondary effect: road outage.",
  "hazard_type": "Earthquake",
  "country": "Japan"
}
```

### POST /api/ai/search — request body

```json
{
  "query": "Recent floods in Southeast Asia"
}
```

---

## Testing

### Backend unit tests

```bash
python -m unittest discover -s tests -v
```

The test suite covers:

- Application startup and root endpoint
- Event listing, retrieval, and 404 handling
- Summary and sources endpoints
- AI endpoint with missing/present credentials
- AI HTTP errors and network errors (mocked)
- USGS adapter: coordinate validation, empty results, null geometry
- USGS refresh: success, failure (502), demo event preservation
- Source health configuration detection

### Frontend (no test runner configured)

Frontend tests are not configured in the current project. See [Remaining Limitations](#remaining-limitations).

### Linting

```bash
npm run lint
```

---

## Production Build

```bash
# Set the backend URL before building
export VITE_API_BASE_URL=https://your-backend.example.com   # Linux/Mac
$env:VITE_API_BASE_URL = "https://your-backend.example.com"  # PowerShell

npm run build
```

Output goes to `dist/`. Serve with any static file server or the included Nginx config.

---

## Docker

```bash
# Copy and configure env first
cp .env.example .env
# Edit .env

docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

---

## Troubleshooting

### "Cannot reach the backend" or "Demo mode" in the UI

1. Check the backend is running: `curl http://localhost:8000/api/health`
2. Check there are no port conflicts: `netstat -ano | findstr :8000`
3. Verify `.env` has correct `FRONTEND_ORIGIN` if the frontend runs on a non-default port.

### "Request failed (500)" on AI analysis

This should now return a structured JSON response, not a 500. If you still see 500:
1. Check the backend console for the stack trace.
2. Verify `NEBIUS_API_KEY` is set correctly.
3. Verify the model in `NEBIUS_MODEL` is available in your account.

### Map shows no events / blank map

1. The map requires internet access to load OpenStreetMap tiles.
2. Events show on load from demo data; click "Refresh USGS" for live events.
3. Check browser console for Leaflet CSS warnings.

### USGS refresh returns 502

The USGS service is temporarily unavailable or your network blocks the request. Wait and retry. The demo events remain visible while the USGS source is down.

### AI analysis says "AI is not configured"

Set `NEBIUS_API_KEY` in your `.env` and restart the backend.

### Light mode text unreadable

Ensure `styles.css` is loaded. If you self-host the build, confirm the CSS bundle is served correctly.

---

## Known Limitations

1. **Non-earthquake hazard data is demo-only.** Floods, cyclones, wildfires, volcanoes, storms, droughts, and tsunamis show illustrative seed scenarios, not live feeds. Integrating live sources for these categories would require additional provider accounts and may have licensing restrictions.

2. **Country attribution for USGS events is "Unknown".** The USGS feed does not include ISO country codes. Reverse-geocoding would require an additional API call per event and has not been implemented.

3. **No frontend tests.** The project does not include a frontend test runner (Vitest, Jest, or Playwright). Manual browser testing is required for frontend interactions.

4. **AI inference not verified end-to-end without credentials.** The integration code has been unit-tested with mocks. Live inference requires a valid `NEBIUS_API_KEY`.

5. **Population and infrastructure exposure are not calculated.** The Impact Assessment page displays an illustrative severity index only. Real exposure assessment requires verified geospatial datasets.

6. **Report download is JSON only.** PDF or formatted report generation is not implemented.

7. **No authentication.** The API is open. In a production deployment, restrict the backend to trusted origins and implement appropriate access controls.

---

## Security Considerations

- **API keys are server-side only.** `NEBIUS_API_KEY` is never sent to the browser, included in API responses, or logged.
- **`.env` is excluded from version control** by `.gitignore`.
- **CORS** is configured to the specific origins listed in `FRONTEND_ORIGIN`. Wildcard (`*`) is not used.
- **Input validation** uses Pydantic models with `max_length` constraints to prevent excessively large payloads.
- **No database.** Event state is in-process memory. A server restart clears any live USGS events fetched during the session.
- **Dependency vulnerabilities.** Run `pip audit` and `npm audit` regularly to check for known CVEs in dependencies.

---

## Demo Mode Explanation

When the backend is unreachable, the frontend falls back to a set of **clearly-labelled illustrative demo records** stored in the frontend bundle. These records are:

- Fictional scenarios created to demonstrate the application workflow.
- Clearly marked as "Demo scenario" in the Source column.
- Accompanied by a yellow banner: "Showing illustrative demo records. These are not live alerts."

When the backend is running but no USGS refresh has been performed, the backend serves its own equivalent seed data and the status indicator shows "API connected."

---

## Live Data Verification

To confirm you are seeing live USGS earthquake data:

1. Start both the backend and frontend.
2. Verify the status indicator shows **"API connected"** (green dot).
3. Click **"Refresh USGS"** in the top bar.
4. Observe the notice banner: "Live USGS earthquake feed refreshed."
5. Navigate to **Data Sources and System Health** — USGS should show **"Healthy"** with a recent timestamp.
6. Navigate to **Global Monitor** — filter by Hazard = "Earthquake" and Source = "USGS" to see live events.
7. Click any USGS event marker and follow the "Open source record" link to verify against `earthquake.usgs.gov`.

---

## License

See [LICENSE](LICENSE).
