# 🔥 Airbrake Monitoring Portal

A full-stack error and log monitoring portal. Ingest logs and errors from your services via REST API, view them in real-time, and manage alert rules — all in one place.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Real-time | WebSocket (ws) |
| Search | Elasticsearch (indexer interface) |
| Database | PostgreSQL (repository interface) |
| Cache / Pub-Sub | Redis |
| Monorepo | npm workspaces |

---

## Project Structure

```
.
├── backend/        Express API server
│   └── src/
│       ├── api/            REST routers + Swagger spec
│       ├── aggregator/     Error fingerprinting & grouping
│       ├── airbrake/       Airbrake polling client
│       ├── alerts/         Alert rule engine
│       ├── auth/           OAuth + RBAC middleware
│       ├── parsers/        Log & break payload parsers
│       ├── pipeline/       Log ingest pipeline
│       ├── retention/      Data purge job
│       └── websocket/      WebSocket server
├── frontend/       React SPA
│   └── src/
│       ├── alerts/         Alert management UI
│       ├── auth/           Login page + protected routes
│       ├── breaks/         Breaks list & detail
│       ├── dashboard/      Dashboard widgets
│       ├── layout/         Sidebar layout
│       ├── logs/           Live log stream
│       ├── settings/       User & retention settings
│       └── theme/          Dark/light theme context
└── shared/         Shared TypeScript interfaces
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run (development)

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — backend (port 3001)
cd backend && npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm run dev
```

Then open http://localhost:3000.

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `INGEST_API_KEY` | _(unset)_ | API key for ingest endpoints. If unset, endpoints are open (dev mode). |
| `AIRBRAKE_API_KEY` | `placeholder` | Airbrake project API key |
| `AIRBRAKE_PROJECT_ID` | `placeholder` | Airbrake project ID |
| `AIRBRAKE_POLL_INTERVAL` | `30000` | Airbrake polling interval in ms |

---

## Database

The backend uses **PostgreSQL**. Migrations live in `backend/src/db/migrations/` and are numbered sequentially. Run them in order against your database before starting the server.

```bash
psql -U <user> -d <database> -f backend/src/db/migrations/001_create_users.sql
psql -U <user> -d <database> -f backend/src/db/migrations/002_create_break_groups.sql
# ... and so on through 008
```

### Schema

#### `users`
Stores authenticated users with their OAuth identity and RBAC role.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `email` | `TEXT` | Unique |
| `role` | `TEXT` | `admin`, `developer`, `viewer` |
| `oauth_provider` | `TEXT` | e.g. `google`, `github` |
| `oauth_subject` | `TEXT` | Provider's user ID |
| `created_at` | `TIMESTAMPTZ` | |

#### `break_groups`
One row per unique error fingerprint. Tracks occurrence counts and lifecycle status.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `fingerprint` | `TEXT` | SHA-256 of `applicationId + errorMessage + stackTrace` — unique |
| `application_id` | `TEXT` | |
| `first_occurrence` | `TIMESTAMPTZ` | |
| `last_occurrence` | `TIMESTAMPTZ` | Indexed DESC |
| `occurrence_count` | `INTEGER` | |
| `status` | `TEXT` | `open`, `resolved`, `regression` |
| `severity` | `TEXT` | `info`, `warning`, `error`, `critical` |
| `error_message` | `TEXT` | |

#### `breaks`
Individual error occurrences, linked to a `break_group`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `application_id` | `TEXT` | |
| `environment` | `TEXT` | |
| `severity` | `TEXT` | |
| `error_message` | `TEXT` | |
| `stack_trace` | `TEXT` | |
| `endpoint` | `TEXT` | Nullable |
| `request_payload` | `JSONB` | Nullable |
| `user_session` | `JSONB` | Nullable |
| `timestamp` | `TIMESTAMPTZ` | Indexed DESC |
| `fingerprint` | `TEXT` | |
| `group_id` | `UUID` | FK → `break_groups.id` |

#### `alert_rules`
Configurable threshold-based alert rules with notification channel definitions.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `TEXT` | |
| `threshold` | `INTEGER` | Min error count to trigger |
| `window_seconds` | `INTEGER` | Rolling time window |
| `trigger_on_new_error` | `BOOLEAN` | Fire on first occurrence |
| `channels` | `JSONB` | Array of `email`, `slack`, `teams`, or `webhook` channel objects |
| `created_by` | `UUID` | FK → `users.id` |
| `enabled` | `BOOLEAN` | |

#### `saved_filters`
Per-user saved search filter presets.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` |
| `name` | `TEXT` | |
| `criteria` | `JSONB` | `{ keyword, tags, severity[], applications[], timeRange, errorCode }` |

#### `retention_policies`
Data retention configuration per application.

| Column | Type | Notes |
|---|---|---|
| `application_id` | `TEXT` | PK |
| `retention_days` | `INTEGER` | `30`, `60`, or `90` |

#### `parse_errors`
Malformed ingest payloads that failed validation, stored for debugging.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `raw_payload` | `JSONB` | The original bad payload |
| `error_message` | `TEXT` | Validation failure reason |
| `occurred_at` | `TIMESTAMPTZ` | Indexed DESC |

#### `audit_log`
Immutable record of all RBAC-gated actions for compliance.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` (nullable if user deleted) |
| `action` | `TEXT` | e.g. `GET /api/breaks` |
| `resource` | `TEXT` | |
| `outcome` | `TEXT` | `allowed` or `denied` |
| `ip_address` | `TEXT` | |
| `occurred_at` | `TIMESTAMPTZ` | Indexed DESC |

---



Interactive docs are available at **http://localhost:3001/api/docs** (Swagger UI).

Raw OpenAPI spec: `GET http://localhost:3001/api/docs.json`

### Swagger UI

The Swagger UI at `/api/docs` lets you explore and test every endpoint directly from the browser — no Postman or curl needed.

![Swagger UI](https://img.shields.io/badge/Swagger-UI-85EA2D?logo=swagger&logoColor=black)

Things you can do from the Swagger UI:

- Browse all endpoints grouped by tag (Ingest, Breaks, Logs, Dashboard, Alerts, Admin, System)
- See full request/response schemas with field descriptions and example values
- Execute requests live against the running server using the "Try it out" button
- Authenticate ingest requests by clicking "Authorize" and entering your `X-API-Key`
- Download the raw OpenAPI 3.0 spec from `GET /api/docs.json` to import into Postman or other tooling

### Ingest API

Use these endpoints to push logs and errors from your services into the portal.

#### POST /api/ingest/logs

Report a log entry.

```http
POST http://localhost:3001/api/ingest/logs
Content-Type: application/json
X-API-Key: <your-key>        # omit in dev

{
  "applicationId": "my-service",
  "environment":   "production",
  "severity":      "error",
  "message":       "Database connection timed out",
  "timestamp":     "2026-03-18T09:00:00Z",
  "tags":          ["db", "timeout"]
}
```

Response `202`:
```json
{ "id": "<uuid>", "status": "accepted" }
```

#### POST /api/ingest/errors

Report an error / break. The server computes the fingerprint and runs aggregation automatically.

```http
POST http://localhost:3001/api/ingest/errors
Content-Type: application/json
X-API-Key: <your-key>

{
  "applicationId": "my-service",
  "environment":   "production",
  "severity":      "critical",
  "errorMessage":  "TypeError: Cannot read property 'id' of undefined",
  "stackTrace":    "at UserController.get (user.ts:42)\n  at Router.handle...",
  "endpoint":      "/api/users/123",
  "requestPayload": { "userId": "123" }
}
```

Response `202`:
```json
{ "id": "<uuid>", "groupId": "<uuid>", "status": "new" }
```

`status` is `new`, `existing`, or `regression` depending on the error's history.

### Query API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/breaks` | Paginated breaks list (`page`, `limit`, `status`, `severity`, `applicationId`, `from`, `to`) |
| `GET` | `/api/breaks/:id` | Break detail with correlated logs |
| `GET` | `/api/breaks/export` | Export breaks as JSON or CSV (`?format=csv`) |
| `GET` | `/api/logs` | Paginated log search (`keyword`, `tags`, `severity`, `environment`, `applicationId`, `from`, `to`) |
| `GET` | `/api/logs/export` | Export logs as JSON or CSV |
| `GET` | `/api/dashboard` | Dashboard aggregation metrics |
| `GET` | `/api/alerts` | List alert rules |
| `GET` | `/api/health` | Health check |

---

## Authentication

The frontend uses a dev bypass login — pick a role (admin / developer / viewer) and a fake session token is stored in `localStorage`. RBAC is enforced on all query endpoints via session middleware.

Ingest endpoints use a separate `X-API-Key` header so external services can report without an OAuth session.

---

## Features

- Live log stream via WebSocket
- Error aggregation with fingerprinting (new / existing / regression detection)
- Dashboard with break counts, error rate trend, top services, and severity breakdown
- Paginated breaks list with status badges and correlated log view
- Alert rule management (admin / developer roles)
- User management and data retention settings (admin only)
- CSV and JSON export for logs and breaks
- Dark / light theme
- Swagger UI for API testing
