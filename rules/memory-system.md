# Agent Memory System

How agents read, write, and maintain persistent memory across sessions.

## Store per harness

| Harness | Location | Layout |
|---|---|---|
| Claude Code | `~/.claude/projects/<project-slug>/memory/` | `MEMORY.md` = index (one line per memory, loaded every session); one file per fact with frontmatter (`name`, `description`, `metadata.type`) |

Read the index first every session; update it after every write. Multiple sessions may share the same store — no other coordination needed.

## Entry format

Every entry must have date and context tag:

```
### [Topic] — 2026-06-27 (Ollama timeout)
```

Undated entries are untrustworthy. Entries >3 months old should be re-verified during dreaming.

## When to write

Write only when it would save a future session ≥5 minutes:
- Non-obvious architecture fact (hidden dependency, implicit convention)
- Task required ≥3 attempts to get right
- Command sequence that worked and would be hard to rediscover
- Error with unobvious root cause + verified fix
- Tool/API behaved differently than documented

Never write: fixes already in docs or code comments; trivial one-liners with obvious cause; guesses or speculation ("I think the frontend uses Redux"); stale entries left unverified; memory used instead of reading code; API keys, tokens, passwords, or PII.

## Dreaming (memory consolidation)

Full procedure lives in `dreaming.md` (deployed to `~/.claude/dreaming.md`). Trigger after 5+ sessions or when the error log has 20+ entries; run as a separate session, never during active dev; output is a diff for human review, not auto-applied.

## Permission model (implicit)

- Memory store files: agent can read and write
- `CLAUDE.md`, ADRs, project docs: read only (human-curated)
- No secrets ever in memory files
