# Memory stack (archived)

Cross-session agent memory: the file taxonomy, the write threshold, and the "dreaming" consolidation procedure.
Not loaded into the harness by default.

## Contents

- `rules/memory-system.md` — store layout per harness, entry format, when to write, permission model
- `root/dreaming.md` — the opening prompt for a dedicated memory-consolidation session, deployed to `~/.claude/dreaming.md` while the stack is enabled
- `CLAUDE-snippet.md` — the conditional rule to paste back into `CLAUDE.md`

## Still active without this stack

Claude Code's own memory directory (`~/.claude/projects/<slug>/memory/` with `MEMORY.md` as the index) keeps working — it is a harness feature, not something this stack installs.
What is archived is the curation discipline layered on top of it.

## Re-enable

```bash
bash scripts/stack.sh enable memory
# paste stacks/memory/CLAUDE-snippet.md into CLAUDE.md under ## Conditional rules
bash scripts/sync-config.sh claude
```

## Disable again

```bash
bash scripts/stack.sh disable memory   # then delete the snippet lines from CLAUDE.md and sync
```
