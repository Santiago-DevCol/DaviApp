# Technical Docs Search

Upload technical documents (`.txt`, `.md`, `.pdf`), index them asynchronously and
search their full text. A NestJS API stores metadata and a PostgreSQL full-text
index (`tsvector` + GIN), processes uploads through a pg-boss queue, and streams
status changes over Server-Sent Events; a React/Vite frontend covers upload,
search and reading. Architecture notes live in [`docs/architecture.md`](docs/architecture.md)
and the AI-usage log in [`docs/ia.md`](docs/ia.md).

## Prerequisites

- Docker Engine 24+ with Compose v2 (the only requirement to run the stack).
- For development: Node.js 24 and pnpm 11 (`corepack enable` or `npm i -g pnpm@11`).

## Quick start (evaluator)

```sh
git clone <repository-url> techdocs && cd techdocs
docker compose up --build
```

The first build takes a few minutes (dependency install + TypeScript/Vite build).
When the three services report healthy:

| Service  | URL                                  |
| -------- | ------------------------------------ |
| Frontend | http://localhost:8080                |
| API      | http://localhost:3000 (`/health`)    |
| Postgres | internal; host port `POSTGRES_PORT` (default 5432) |

SQL migrations run automatically when the backend starts. The database starts
empty; load 300 synthetic documents for demos with:

```sh
docker compose run --rm seed              # append 300 documents
docker compose run --rm seed --count 1000 --reset   # custom amount, truncate first
```

If host port 5432 is already in use, pick another one for the Postgres mapping:
`POSTGRES_PORT=5433 docker compose up --build` (only host tooling is affected;
the containers talk to each other on the internal network).

Uploaded files live in the `storage` volume and the database in `pgdata`; both
survive `docker compose down`. Use `docker compose down -v` to wipe them.

## Local development

```sh
docker compose up -d postgres            # POSTGRES_PORT=5433 ... if 5432 is busy
pnpm install                             # also builds packages/shared
cp backend/.env.example backend/.env     # adjust DATABASE_URL port if needed
pnpm --filter backend start:dev          # http://localhost:3000
pnpm --filter frontend dev               # http://localhost:5173, proxies /api -> :3000
```

Seed from the host (writes files to `backend/storage`): `pnpm --filter backend db:seed -- --count 300 --reset`.

## Tests

```sh
pnpm test                                # unit tests, backend (Jest) + frontend (Vitest)
pnpm --filter backend test:integration   # Postgres via Testcontainers (needs Docker)
pnpm --filter backend bench:search       # latency percentiles against a running API
```

## API summary

Base URL: `http://localhost:3000` (direct) or `http://localhost:8080/api` (through nginx).

| Method | Path             | Purpose                                                       |
| ------ | ---------------- | ------------------------------------------------------------- |
| POST   | `/documents`     | Upload 1-20 files with metadata; returns `202 Accepted`       |
| GET    | `/documents/:id` | Metadata, status and extracted text of one document           |
| GET    | `/search`        | Full-text search with pagination and highlights               |
| GET    | `/events`        | SSE stream of document status changes                         |
| GET    | `/health`        | `200 {status:"ok"}` or `503 {status:"degraded"}` if the DB is down |

### POST /documents

Multipart form: repeated `files` parts plus one `metadata` field holding a JSON
array aligned by index with the files (`title`, `author`, `category`, `tags[]`,
`version`). Allowed formats: `txt`, `md`, `pdf`, up to 10 MB each.

```sh
curl -F files=@docs/samples/sample-manual.md \
     -F 'metadata=[{"title":"Manual","author":"QA","category":"manuals","tags":["demo"],"version":"1.0.0"}]' \
     http://localhost:8080/api/documents
# 202 {"items":[{"id":"<uuid>","status":"PROCESSING","fileName":"sample-manual.md"}]}
```

The document is stored as `PROCESSING`; a queue worker extracts the text and
moves it to `INDEXED` (or `ERROR` with `errorMessage`, e.g. a PDF without text).

### GET /documents/:id

Returns `DocumentDetail`: metadata, `format`, `fileName`, `sizeBytes`, `status`,
`errorMessage`, `content` (extracted text, `null` until indexed), timestamps.
`404` for unknown ids, `400` for a malformed UUID.

### GET /search

Query parameters: `q` (required, 1-200 chars), `page` (default 1),
`pageSize` (default 10, max 50). Response:

```json
{ "items": [{ "id", "title", "author", "category", "tags", "version", "status", "highlight", "rank" }],
  "total": 42, "page": 1, "pageSize": 10, "tookMs": 3.1 }
```

`tookMs` times the search engine call only; the `X-Response-Time` header covers
the whole handler (validation + engine + mapping). Results are never cached (`Cache-Control: no-store`).

### GET /events (SSE)

`text/event-stream` with two event types:

- `document.status`: `{ "id", "status", "errorMessage?", "occurredAt" }`, with a
  monotonic `id` field. Reconnecting with `Last-Event-ID` replays missed events.
- `heartbeat` every 15 s (`{ "ts" }`) so idle connections survive proxies.

```sh
curl -N http://localhost:8080/api/events
```

## Repository structure

```
backend/            NestJS API (hexagonal: domain / application / infrastructure per module)
  drizzle/          SQL migrations, applied at startup
  scripts/          seed, migrate, search benchmark, sample PDF generator
  Dockerfile
frontend/           React + Vite SPA; nginx.conf proxies /api and serves the bundle
  Dockerfile
packages/shared/    DTOs and constants shared by backend and frontend (@techdocs/shared)
docs/
  architecture.md   design decisions and trade-offs
  ia.md             how AI tools were used
  samples/          documents to try the upload flow
docker-compose.yml  postgres + backend + frontend (+ opt-in seed profile)
```

## Sample documents

`docs/samples/` contains `sample-manual.md`, `sample-spec.txt`, `sample-guide.pdf`
and `sample-blank.pdf`. The blank PDF has no extractable text and ends in
`ERROR` with `"No extractable text found"`, which demonstrates the failure path
in the UI and over SSE.
