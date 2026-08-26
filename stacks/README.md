# Archived stacks

Config that is kept but not loaded.
Everything under `stacks/<name>/` is inert: the sync scripts never install it, and they prune it from the live harness dirs so an old copy cannot survive on a machine that synced before the archive.

Archive a stack when it is worth keeping for later but costs tokens every session while unused.

## Layout

A stack mirrors the repo, one directory per destination. All are optional.

| In the stack | Goes to | Destination on the machine |
|---|---|---|
| `skills/<name>/` | `skills/` | `~/.claude/skills`, `~/.agents/skills` |
| `rules/<file>.md` | `rules/` | `~/.claude/rules` |
| `root/<file>` | repo root | whatever the sync scripts do with that file |
| `CLAUDE-snippet.md` | — | pasted into `CLAUDE.md` by hand |
| `README.md` | — | what the stack is and what re-enabling costs |

## Enable / disable

```bash
bash scripts/stack.sh enable <name>    # copies the stack into skills/, rules/, repo root
bash scripts/stack.sh disable <name>   # moves the live copies back into stacks/<name>/
bash scripts/sync-config.sh claude     # or cursor / pi — propagates either direction
```

`enable` copies, so the archive stays the inventory of what belongs to the stack; `disable` moves, so edits made while the stack was live come back with it.
`CLAUDE-snippet.md` is the one manual step in both directions: paste it under `## Conditional rules` when enabling, delete those lines when disabling.

## Current stacks

| Stack | What | Why archived |
|---|---|---|
| `frontend/` | 30-skill premium UI pipeline + `rules/frontend.md` | Only pays off on design-heavy work; ~3k tokens of frontmatter per turn otherwise |
| `memory/` | `rules/memory-system.md` + `dreaming.md` | Cross-session memory store is not in use; the harness memory dir handles what is needed |
| `effect/` | `effect` skill (Effect v4 guide, 8 branch references) | No project on this machine depends on `effect` |
