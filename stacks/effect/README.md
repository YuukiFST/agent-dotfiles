# Effect stack (archived)

The `effect` skill: an opinionated guide for building production TypeScript with Effect v4 — workflows, services and layers, schemas, `Config`, `Schedule`, `Cache`, `Stream`, `HttpClient`, and Effect tests.
Not loaded into the harness by default.

## Contents

- `skills/effect/SKILL.md` — the router; the branch references under `references/` are read one at a time, only the branch the task matches
- `CLAUDE-snippet.md` — the conditional rule to paste back into `CLAUDE.md`

## Why archived

No project on this machine depends on `effect`. Until one does, the skill frontmatter is loaded every session for a library that is never imported.

## Re-enable

```bash
bash scripts/stack.sh enable effect
# paste stacks/effect/CLAUDE-snippet.md into CLAUDE.md under ## Conditional rules
bash scripts/sync-config.sh claude
```

Requires Effect v4 — on v3 or older the skill does not apply, follow the project's own conventions instead.

## Disable again

```bash
bash scripts/stack.sh disable effect   # then delete the snippet lines from CLAUDE.md and sync
```

## Refresh from upstream

Vendored from [kitlangton/skills](https://github.com/kitlangton/skills/tree/main/skills/effect).
A refresh replaces `stacks/effect/skills/effect/` while the stack is archived, or `skills/effect/` while it is enabled — see [`docs/vendored-skills.md`](../../docs/vendored-skills.md).
