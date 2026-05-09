# Whoami API

A minimal Python backend for `whoami` that turns a ThumbmarkJS fingerprint into a stable server-side visitor ID.

## How it works

- The browser generates a ThumbmarkJS `thumbmark`.
- The frontend sends that `thumbmark` to `POST /v1/whoami`.
- The API stores a visitor record in SQLite, assigns a retro codename, and tracks first/last seen timestamps plus total visit count.

This keeps the service simple to host on `u.shamilkm.tech` while still remembering returning visitors.

The backend also exposes a first-party cached proxy for ThumbmarkJS at `GET /assets/thumbmark.umd.js`. The frontend can load the library from that endpoint instead of a third-party CDN.

## Endpoints

- `GET /health` - basic health check.
- `GET /assets/thumbmark.umd.js` - cached proxy for the ThumbmarkJS UMD build.
- `POST /v1/whoami` - resolve a stable visitor ID from a Thumbmark hash.
- `GET /v1/visitors` - list all recorded visitors and their visit stats.
- `GET /v1/visitors/{visitor_id}/visits` - list the timestamped visits for one visitor.

## Request body

```json
{
  "thumbmark": "abc123...",
  "user_agent": "optional",
  "path": "/optional"
}
```

## Response body

```json
{
  "visitor_id": "GUEST-2D2A-86C1-6B43-4BB0",
  "display_name": "NEON FOX",
  "thumbmark": "abc123...",
  "created": false,
  "first_seen_at": "2026-05-10T10:11:12+00:00",
  "last_seen_at": "2026-05-10T10:11:12+00:00",
  "visit_count": 1
}
```

The `visitor_id` is intentionally formatted like a retro terminal handle so it feels at home in the UI.

The `display_name` is a stable codename generated from the visitor's fingerprint and stored with the record.

Every request is also written to the `visits` table with its timestamp, path, and user agent when available.

## Run locally

```bash
cd backend
VISITOR_SECRET="replace-with-a-long-random-secret" uv run main.py
```

If you want to run it with Uvicorn directly, use `uv run --with fastapi --with 'uvicorn[standard]' uvicorn main:app --host 0.0.0.0 --port 8000`.

## Environment variables

- `VISITOR_SECRET` - required for stable visitor IDs. Change this once and keep it fixed.
- `ALLOWED_ORIGINS` - comma-separated list of allowed browser origins. Defaults to the site and local Hugo dev server.
- `APP_NAME` - optional service name shown in the API responses.
- `VISITOR_DB_PATH` - optional path to the SQLite database file. Defaults to `backend/visitors.sqlite3`.
- `THUMMARK_SCRIPT_URL` - upstream ThumbmarkJS script URL to proxy. Defaults to the jsDelivr UMD bundle.
- `THUMMARK_PROXY_TTL_SECONDS` - cache lifetime for the proxied script in memory.
