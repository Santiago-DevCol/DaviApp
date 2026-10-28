# Technical Docs Search

Monorepo for the technical documentation search kata (NestJS + Drizzle + PostgreSQL FTS).

## Prerequisites

- Node.js 24+
- pnpm 11+ (`corepack enable` or `npm i -g pnpm`)
- Docker with Compose v2+

## Boot

```sh
docker compose up -d postgres
pnpm install
cp backend/.env.example backend/.env
pnpm --filter backend start:dev
```

Host port 5432 already in use? Start Postgres with `POSTGRES_PORT=5433 docker compose up -d postgres`
and change the port in `backend/.env` accordingly.

The API listens on `http://localhost:3000`; `GET /health` reports the database status.
SQL migrations under `backend/drizzle/` are applied automatically at startup.
