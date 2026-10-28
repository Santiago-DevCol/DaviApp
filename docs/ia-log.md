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
