# AI usage log (working notes, consolidated later into docs/ia.md)

Format per entry: stage, tool, what was asked, what came back, human validation / correction.

## 2026-10-28 — Planning session

- **Tool**: Claude Code (Claude Fable 5.1) in plan mode.
- **Prompt (summary)**: "Read every page of the kata PDF, do not invent anything, ask me one
  question at a time so that I make every decision; each option must come with technical
  advantages and disadvantages, never 'because it is the stack I know'."
- **What the AI did**: extracted the requirements page by page (the PDF had no text layer, so it
  was rendered to images and read visually), then presented one decision at a time with
  trade-offs framed against the evaluation checklist (400 ms - 1 s, no LIKE, no polling,
  30-minute defense).
- **Decisions taken by the candidate** (AI proposed, human chose): PostgreSQL 16 FTS, NestJS,
  SSE, pg-boss, React + Vite, hexagonal by business capability, Drizzle ORM, pnpm workspaces
  with `packages/shared`, TDD on the core + Testcontainers for search, custom
  `spanish_unaccent` text search configuration.
- **Human validation**: the candidate reviewed and approved the written plan, including the
  execution assumptions (10 MB limit, local disk storage, latency SLO interpretation of the
  400 ms - 1 s range, status enum names).
- **AI correction worth noting**: the AI flagged that `unaccent()` is not IMMUTABLE and cannot be
  used directly inside a generated column; the fix is a custom text search configuration that
  chains `unaccent` + `spanish_stem`.

## 2026-10-28 — Phase 1: monorepo base (delegated writer agent)

- **Prompt (summary)**: a detailed brief with the settled decisions, the exact file list, the
  generated-column expression, and a mandatory verification list ("report actual output, do not
  claim"). The agent had to write the failing spec for the HTTP exception filter and the env
  schema before the implementation.
- **What came back**: pnpm workspace, `@techdocs/shared`, NestJS 11 API with zod-validated env,
  global exception filter, Drizzle schema + hand-prepended migration, `/health`, compose with
  Postgres 16.
- **Human-relevant corrections found during execution**:
  - Postgres rejected the generated column because `array_to_string(text[], text)` is STABLE,
    not IMMUTABLE. Fix: an `IMMUTABLE` SQL wrapper `immutable_array_to_string` in the migration.
  - NestJS 12 (ESM-only, Vitest, TypeScript 6) is now `latest`; it conflicts with the Jest +
    ts-jest decision, so Nest 11.x and TypeScript 5.9 were pinned on purpose.
  - Host port 5432 was taken by a local Postgres 18 container; compose exposes
    `${POSTGRES_PORT:-5432}` so the evaluator default is untouched.
- **Independent review (reliability lens, separate agent)** found a CRITICAL defect the writer
  missed: `@techdocs/shared` pointed at a git-ignored `dist/` and nothing built it after
  `pnpm install`, so a fresh clone would fail to compile. A second agent tried to refute it and
  could not. Fixed by a root `prepare` script; verified by deleting `dist/` and reinstalling.
- **Incident**: the writer agent killed a process on port 3000 by PID that was not its own.
  Logged here for transparency; later briefs forbid killing by port.

## 2026-10-28 — Phase 2: documents module (delegated writer agent, TDD)

- **Prompt (summary)**: hexagonal layout by business capability, ports as interfaces with Symbol
  tokens, in-memory fakes, TDD order enforced ("write the failing spec first"), pg-boss as the
  durable queue, pdf-parse for PDFs, seed script, and a verification list with real curl calls.
- **What came back**: domain model with explicit state transitions, upload/index/get use cases,
  multipart controller with class-validator DTOs, Drizzle repository, local storage, pg-boss
  queue + worker, EventEmitter2 publisher, 48 unit/e2e tests, seed of 300 synthetic documents.
- **Deviations the agent proposed and the candidate accepted**: `fileName` column added
  (migration 0001) because the shared contract exposed it but no column backed it; Jest runs
  with `--experimental-vm-modules` because pdf.js needs dynamic `import()`; `pageJoiner: ''` in
  pdf-parse so image-only PDFs do not get indexed with junk page markers.
- **Open risks disclosed by the agent (to discuss in the defense)**: no transaction between the
  `documents` insert and the job enqueue (crash window leaves a `PROCESSING` row; fix path is a
  unit-of-work using pg-boss `send` with the same transaction, or a stale-row sweeper).
