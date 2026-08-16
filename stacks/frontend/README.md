# Frontend stack (archived)

Ordered skill pipeline for premium UI work.
Not loaded into harness by default — saves ~3k+ tokens of skill frontmatter per turn plus the `frontend.md` rule pointer in global instructions.

## Contents

- `rules/frontend.md` — pipeline router (steps 1–8, minimum bar, autonomous `/goal` mode)
- `skills/` — 26 skills referenced by the pipeline (design direction, tokens, build, motion, review)
- `CLAUDE-snippet.md` — conditional rules to paste back into `CLAUDE.md` when re-enabling

## Still active without this stack

`agent-browser` and `webapp-testing` stay in top-level `skills/` for E2E and Playwright testing outside the full design pipeline.

## Re-enable

1. Copy skills: `cp -r stacks/frontend/skills/* skills/`
2. Copy rule: `cp stacks/frontend/rules/frontend.md rules/`
3. Paste `CLAUDE-snippet.md` lines into `CLAUDE.md` under `## Conditional rules`
4. Sync: `bash scripts/sync-config.sh pi` (or `claude` / `cursor`)

Or run: `bash scripts/enable-frontend-stack.sh`

## Disable again

`bash scripts/disable-frontend-stack.sh` then sync.
