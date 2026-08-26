# Dreaming — Memory Consolidation Prompt

Use this as the opening prompt for a **separate, dedicated consolidation session** (Claude Code). Do NOT run this during active development — dreaming is out-of-band, just like Anthropic's async dreaming jobs.

## Store

| | **Claude Code** |
|---|---|
| Store path | `~/.claude/projects/<project-slug>/memory/` (the harness tells you the exact dir) |
| Index file | `MEMORY.md` (one line per memory: `- [Title](file.md) — hook`) |
| Memory unit | one file per fact, frontmatter `name` / `description` / `metadata.type` = `user`/`feedback`/`project`/`reference` |
| Start command | `claude "You are running a memory consolidation..."` |

## Prompt

```
You are running a memory consolidation ("dreaming") session. Your job is to review, clean, and improve the agent memory system. Store: ~/.claude/projects/<slug>/memory/ with MEMORY.md as the index.

## Phase 1 — Audit

Read MEMORY.md first to understand what exists and when each entry was last touched.

Then read every memory file in the project memory dir, grouped by metadata.type (user / feedback / project / reference).

Also read ~/.claude/rules/memory-system.md for the memory philosophy.

## Phase 2 — Deduplicate

Within each file and across files:
- Find duplicate entries (same error documented twice, same fact in two files)
- Merge them, keeping the most complete version
- Remove entries that are now obvious from the code itself

## Phase 3 — Extract patterns

Look across ALL memory entries for recurring themes:
- Same root cause appearing in multiple error entries → promote the fix to a reusable `project`/`reference` memory
- Same tool/command used successfully 3+ times → record it as a pattern
- Architecture facts scattered across error entries → consolidate into the codebase/architecture memory

## Phase 4 — Check staleness

For every entry in every memory file:
- Entries older than 3 months: grep/glob to verify they still apply
- File paths that no longer exist → mark [STALE], suggest removal
- Patterns that reference removed APIs/functions → update or remove
- Commands that have changed (e.g. renamed scripts) → update

Staleness check prevents "rot" — memory that was accurate in June but lies in October.

## Phase 5 — Verify accuracy

- Architecture/codebase facts: grep/glob to verify file paths and module names still exist
- Patterns: are the described workflows still valid?
- Errors: have any been fixed at the root level and are now obsolete?

## Phase 6 — Produce changes

Output the changes as a clear list for HUMAN REVIEW before applying:
- [MERGE] entry A + entry B → combined entry
- [PROMOTE] "Ollama timeout pattern" → reusable pattern
- [REMOVE] "Widget import path" — now obvious from file structure
- [REMOVE/STALE] "Docker setup steps" — paths changed, no longer accurate
- [ADD] new pattern discovered across sessions

## Phase 7 — Rebuild the index

Update MEMORY.md to reflect all changes: new entries, removed entries, updated one-line summaries/hooks, last-modified dates.

## Phase 8 — Apply

After user approval of the proposed diff, apply all changes to the memory files. Do NOT auto-apply — dreaming is non-destructive and human-in-the-loop, exactly like Anthropic's output memory store clone workflow.

**After applying, add a verification note** to each modified entry: `[Verified 2026-06-27 — matches current codebase]`. This is the same pattern Anthropic uses: "At this time, based on this transcript I just looked at, this memory is actually accurate." Future agents can trust verified entries more than unverified ones.

## Rules

- Non-destructive: never delete without explicit user approval
- Human-in-the-loop: output is a proposed diff, user applies it
- Evidence-based: cite which sessions/entries support each change
- Conservative: when uncertain, flag for human review instead of auto-modifying
- After applying, rebuild the index as the last step
```

## When to run dreaming

- After 5+ significant sessions on the same project
- When you notice the agent re-discovering things that should be in memory
- When the store has 20+ entries (time to consolidate)
- Before starting a major new feature (verify memory is current)
- **Triggered by events:** after completing a major task, before a deployment, after a bug that took multiple sessions to fix
- Monthly as maintenance

Anthropic's design supports ad hoc, nightly, hourly, or event-triggered (end of session) dreaming. The manual equivalent here: run dreaming when you notice inefficiency or after completing significant work.

## Real-world impact

Harvey (legal AI) saw a **6x increase in completion rates** for their legal benchmark after adopting dreaming. The pattern is consistent: dreaming finds cross-session patterns that individual agents miss, producing a step-change in performance.

## Token efficiency

Anthropic's dreaming achieves ~95% cache hit rate because most processing is agentic and repetitive. The initial investment in curation pays dividends: downstream agents spend fewer tokens re-discovering information. Same principle here — the session uses significant tokens once, but all subsequent sessions benefit from cleaner, faster memory access.

## Architecture note: dream harness

Anthropic's dreaming harness spawns one sub-agent per input session for exhaustive parallel analysis, coordinated by an orchestrator. For a single-project store, the dreaming session itself acts as the orchestrator reviewing all memory files — sufficient at this scale. Scale up to sub-agents-per-session only if a project's transcript volume is large.

## How to start

Open a new terminal, navigate to the project, then:

```
claude "You are running a memory consolidation..."
```

Or paste the full prompt above. The agent reads the memory files, analyzes them, and proposes changes.
