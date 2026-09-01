# Frontend stack (archived)

Ordered skill pipeline for premium UI work.
Not loaded into harness by default — saves ~3k+ tokens of skill frontmatter per turn plus the `frontend.md` rule pointer in global instructions.

## Contents

- `rules/frontend.md` — pipeline router (steps 1–8, minimum bar, autonomous `/goal` mode)
- `skills/` — 31 skills referenced by the pipeline (design direction, tokens, build, motion, review), including the whole jakubkrehel set (`interface-review` + `better-*`)
- `CLAUDE-snippet.md` — conditional rules to paste back into `CLAUDE.md` when re-enabling

## Still active without this stack

`agent-browser` stays in top-level `skills/` for E2E and browser testing outside the full design pipeline (`webapp-testing` is archived in `stacks/webapp-testing/`).

Interface review is not one of them: `interface-review` and `better-interface` are both in this stack, so a design review of a diff needs the stack enabled. Code review without it is `autoreview` (correctness) and `security-review`.

## Re-enable

1. Copy skills: `cp -r stacks/frontend/skills/* skills/`
2. Copy rule: `cp stacks/frontend/rules/frontend.md rules/`
3. Paste `CLAUDE-snippet.md` lines into `CLAUDE.md` under `## Rule files`
4. Sync: `bash scripts/sync-config.sh pi` (or `claude` / `cursor`)

Or run: `bash scripts/stack.sh enable frontend`

## Disable again

`bash scripts/stack.sh disable frontend` then sync.
