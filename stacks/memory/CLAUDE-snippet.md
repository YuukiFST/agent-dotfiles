# CLAUDE.md conditional rules — memory stack (archived)

Paste this line back into `CLAUDE.md` under `## Conditional rules` when re-enabling the memory stack, and run `bash scripts/stack.sh enable memory`.

- **Cross-session memory, or 5+ sessions deep** → `~/.claude/rules/memory-system.md` (file taxonomy, write threshold, dreaming). Store: harness memory dir (`MEMORY.md` index) on Claude Code. Never dream during active dev; >30 complex turns → suggest fresh session.
