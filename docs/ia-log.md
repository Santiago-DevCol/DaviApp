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
- **Independent review of Phase 2 (reliability lens)**: CRITICAL — when pg-boss retries were
  exhausted the document stayed `PROCESSING` forever with no event. A refuter agent confirmed it
  against the pg-boss 12 source. Fixed with `FailDocumentUseCase` + last-attempt detection in the
  worker (TDD, 20 new tests); a scoped re-review verified the fix and noted two residual limits
  (check-then-write guard, hard crash on the last attempt) that went to `architecture.md`.
  WARNING fixed as well: multer decoded file names as latin1 (`Guía técnica.txt` was corrupted).

## 2026-10-28 — Phases 3-4: search + SSE, and Phase 5: frontend (three agents in parallel)

- **Orchestration change**: three writers ran at the same time on disjoint paths. Briefs gained
  explicit rules: stage only your own paths, never `git add -A`, retry on `index.lock`, never
  kill processes by port, only your own PIDs.
- **Search**: Postgres FTS engine with a CTE so `ts_headline` runs only on the page rows;
  Testcontainers suite (10 tests) including an `EXPLAIN` assertion on the GIN index; bench script.
  The writer found by booting that Drizzle raw `execute()` returns timestamps as strings.
- **SSE**: `@Sse('events')`, hub + ring replay buffer, `Last-Event-ID`; the writer discovered that
  Nest auto-assigns ids to id-less messages, so the heartbeat carries the hub's last id.
- **Frontend**: React + Vite SPA with TanStack Query, native `EventSource`, 36 Vitest tests, safe
  highlight rendering (no `dangerouslySetInnerHTML`). Its E2E smoke hit `/search` while the
  backend writer was mid-implementation (500), confirming the value of running the smoke again
  at the end rather than trusting a single pass.
- **Independent reviews (reliability lens, one per area)**:
  - Backend CRITICAL: `ORDER BY rank, created_at` with `LIMIT/OFFSET` had no unique tiebreaker,
    so pages could repeat or skip tied documents. Refuter confirmed against PostgreSQL semantics.
    Fix: `d.id` as final sort key + an integration test with 40 identical-rank rows.
  - Frontend CRITICAL: for multi-file batches the `INDEXED` event can arrive before the 202, the
    cache has no entry yet, the 202 then seeds `PROCESSING` with `staleTime: Infinity`, and the
    row never converges. Refuter confirmed the chain and quantified it (pg-boss polls every 2 s;
    realistic for 20-file batches). Fix: refetch tracked ids after the 202 + 15 s poll while
    `PROCESSING` + resync on SSE re-creation.
  - WARNINGs fixed because they were cheap and demo-visible: unbounded `page` → 500, NUL byte
    in `q` → 500, no id baseline on SSE connect, out-of-range page in the UI, files beyond 20
    dropped silently.
- **Human verification by the candidate's orchestrator session**: re-ran all suites after each
  phase; browsed the Docker stack (search with highlights and latency badge, viewer, upload page,
  live SSE indicator); reproduced the benchmark (p50 18.7 ms, p95 49.9 ms, p99 58.5 ms, 0 errors
  over 200 requests at concurrency 10) and the `EXPLAIN ANALYZE` (Bitmap Index Scan on
  `documents_search_idx`, 5.0 ms) directly against the containers.

## 2026-10-28 — Phases 6-7: documentation and delivery (two agents)

- **Docs**: `architecture.md` and `ia.md` drafted by an agent from the approved plan, the code
  and this log; the agent listed every claim it could not verify itself (latency figures, test
  counts) so the orchestrator could check them — the figures above are the reproduced ones.
- **Docker**: multi-stage images, nginx with `proxy_buffering off` for SSE, compose with
  healthchecks and a `seed` profile. Two real fixes found only by building: `**/storage` in
  `.dockerignore` excluded the `infrastructure/storage` source folder; `expires` + `add_header`
  produced a duplicate `Cache-Control`.

## 2026-10-28 — Iteration 2: content versioning (one backend writer, one frontend writer, review + refutation)

- **Trigger**: after the initial delivery the candidate reviewed the app and proposed four
  improvements: content versioning, real metadata from PDF/front matter, upload + queue atomicity
  with a stale-row sweeper, and chunking for large documents.
- **Candidate decision**: implement only versioning, minimal scope, nothing that already works
  gets touched; points 2-4 go to a justified roadmap in `architecture.md` (section 9.1) because
  of the deadline (Thursday 29 Oct, 11:30), not because they were rejected technically.
- **Conceptual correction by the AI** (accepted by the candidate): the first idea was "same
  content -> automatic patch version". The AI argued against it: a patch with no byte change is a
  meaningless number and breaks the idempotency of bulk uploads; a duplicate must be an
  informative answer (`duplicateOf`), not a version nor an error. It also separated identity from
  fingerprint (identity = normalized title + author in `document_key`; fingerprint = SHA-256 of
  the uploaded bytes in `content_hash`) and chose bytes over extracted text because the 202 is
  immediate and the text only exists later in the worker.
- **What came back**: migration `0002` (columns, SQL backfill with `unaccent` matching
  `buildDocumentKey`, partial index on `(document_key) WHERE is_latest` and composite
  `(document_key, content_hash)`), domain helpers `document-key.ts` and `semver.ts`, upload rules
  in `UploadDocumentsUseCase`, `is_latest` filter in the search CTE and in `countMatches`,
  `versions` in `DocumentDetail`, duplicate badge and assigned version in the tracked list,
  version history and outdated banner in the viewer, `documents-versioning.integration-spec.ts`.
- **Independent review (reliability lens)**: CRITICAL — the duplicate rule compared against any
  version with the same hash (`findByKeyAndHash`), so a document whose indexing ended in `ERROR`
  could not be re-uploaded with the same bytes; the retry was reported as a duplicate of the
  failed row. The refuter could not refute it. Fixed with TDD (4 new unit specs + 1 integration
  test through the real repository): the rule now consults only the current latest version and
  excludes `ERROR`; bytes of an older superseded version count as a rollback (commit `f94e5b4`).
  Scoped re-review of the fix diff.
- **Tolerant semver**: the kata's `version` is free text; the AI proposed and the candidate
  accepted a tolerant parser (leading `v`, 1-3 numeric components, prerelease) where unparsable
  input never breaks the upload, plus an effective version that never goes backwards
  (`max(sent, bumpPatch(latest))`, commit `eba548c`).
- **Verification by the orchestrator session**: `pnpm test`, `pnpm lint` and
  `pnpm --filter backend test:integration` re-run; duplicate -> new version -> previous version
  gone from `/search` and listed under "Versiones" in the viewer reproduced against the Docker
  stack. Totals after the iteration: backend 163 unit/e2e tests in 21 suites, 16 integration
  tests in 2 suites; frontend 54 tests in 12 files.
- **Known limits accepted and documented** (`architecture.md` 6b.5): `unaccent` vs NFD for
  `ø`/`ß`/`æ` in the backfill only; pre-migration rows keep an empty `content_hash`; two
  concurrent uploads of the same identity are not serialized (advisory lock in the roadmap);
  orphan file if the process dies between `storage.save` and the insert.
