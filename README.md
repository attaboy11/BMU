# BMU Fault Finder

BMU Fault Finder is a mobile-first, offline-friendly MVP to help façade-access / BMU engineers diagnose faults, identify parts, and capture callout notes while on a roof or gondola.

## High-level architecture
- **Frontend:** Single-page HTML/JS (no external packages) served from `/public`. Uses progressive enhancement: fetches live API data when online and falls back to bundled offline JSON for models, subsystems, parts, and troubleshooting flows.
- **Backend:** Lightweight Node HTTP server (`server.js`) with in-memory data store (`data/store.js`). Exposes REST endpoints for models, subsystems, symptoms, fault flows, parts, and jobs; also serves the static frontend.
- **Offline behaviour:** When API calls fail, the UI transparently swaps to the locally bundled data. Job notes persist to `localStorage`, and POST `/api/jobs` is best-effort (graceful offline fallback).

## Data model / schema (in-memory)
Entities are kept as arrays of objects in `data/store.js`:
- `BmuModel { id, name, manufacturer, site, notes }`
- `Subsystem { id, modelIds[], name }`
- `Symptom { id, subsystemId, title, description }`
- `Component { id, modelId, subsystemId, name, partNumber, location, failureModes[], symptoms[], replacement }`
- `FaultFlow { id, modelIds[], subsystemId, symptomId, likelyCauses[], checks[], steps[], resolutions{}, safety[] }`
- `SafetyNote { id, text }`
- `Job { id, site, bmuId, modelId, reported, checks[], diagnosis, parts, createdAt }`

Fault flows are structured JSON with: ranked likely causes, measurable checks (with expected readings), procedural steps with branching (`nextOnPass`, `nextOnFail`), and linked safety note IDs.

## API design
Base URL defaults to `http://localhost:3000`.

| Method & Path | Description |
| --- | --- |
| `GET /api/models` | List BMU models. |
| `GET /api/subsystems?modelId=` | Subsystems (optionally filtered by model). |
| `GET /api/symptoms?subsystemId=` | Symptoms for a subsystem. |
| `GET /api/fault-flow?modelId=&subsystemId=&symptomId=` | Fault-finding flow with causes, checks, steps, safety. |
| `GET /api/components?modelId=&subsystemId=&q=` | Parts catalogue with optional filters/search. |
| `GET /api/components/:id` | Component detail. |
| `GET /api/jobs` | Saved jobs (in-memory). |
| `POST /api/jobs` | Save a job: `{ site, bmuId, modelId, reported, checks[], diagnosis, parts }`. |

### Example request/response
`GET /api/fault-flow?modelId=alimak-a1&subsystemId=travel&symptomId=trolley-stopped`
```json
{
  "id": "travel-no-move",
  "likelyCauses": [
    { "component": "Forward travel limit switch", "probability": 0.38 }
  ],
  "checks": [
    { "id": "c1", "text": "Verify e-stop chain reset; measure 24V across safety relay A1/A2", "expected": "24V present" }
  ],
  "steps": [
    { "id": "s1", "title": "Confirm power and safety chain", "detail": "Reset e-stops...", "nextOnPass": "s2", "nextOnFail": "saf-lock" }
  ],
  "resolutions": { "saf-lock": "Restore safety chain..." },
  "safety": ["Isolate and lock-off BMU main power before panel work. Verify absence of voltage.", "Use fall protection and stay within guardrails when accessing trolley or jib."]
}
```

## Frontend experience
- **Home:** Quick navigation to New Fault, Parts, and Recent Jobs.
- **New Fault flow:** Select model → subsystem → symptom, optionally enter free-text notes, then view likely causes, measurable checks, step-by-step flow, and safety notes. One-click adds checks/diagnosis to the job log.
- **Parts library:** Filter by model/subsystem or search text; shows part numbers, locations, failure modes, and replacement tips.
- **Job notes:** Capture site, BMU ID, symptom, checks performed, diagnosis, and parts. Saved jobs persist locally and can be copied as a formatted text block for reports.

## Seed data (demo-ready)
Three sample BMUs (Alimak Horizon A1, Alimak Skyline A2, GondolaTech G1) with realistic subsystems, symptoms, components, and flows for trolley travel stoppage, hoist not raising, and e-stop loop faults.

## Running the app locally
```bash
npm install   # no external dependencies are required but npm will record the lockfile
npm run dev   # starts HTTP server on http://localhost:3000
```
Open http://localhost:3000 in your browser. The UI works without external assets and falls back to bundled data if the API is unreachable.
