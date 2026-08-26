# CLAUDE.md conditional rules — effect stack (archived)

Paste this line back into `CLAUDE.md` under `## Conditional rules` when re-enabling the effect stack, and run `bash scripts/stack.sh enable effect`.

- **Effect-TS code** (project depends on `effect`; writing/refactoring workflows, services, layers, schemas, `Config`, `Schedule`, `Cache`, `Stream`, `HttpClient`, or Effect tests) → load the `effect` skill BEFORE writing code, and read only the branch references the task matches. Requires Effect v4 — on v3 or older, skip it and follow the project's own conventions.
