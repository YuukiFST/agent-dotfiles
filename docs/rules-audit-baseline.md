# Rules adherence baseline

`scripts/rules-audit.py` measures whether the instructions in `CLAUDE.md` and `rules/` are actually followed, by counting observable signatures across Claude Code session transcripts.

```bash
python scripts/rules-audit.py --since 2026-08-01
```

This file records a baseline so a later run means something. Re-run with the **same `--since`** to compare, or with a newer date to measure a period on its own.

## Baseline — 2026-08-27, window since 2026-08-01

Corpus: 202 subagent prompts, 137 sessions with Bash activity, 8470 Bash calls.

### `rules/prompting.md`

Measured on the prompt each subagent was launched with, which is where that file applies.

| Signature | Section | Hits | % |
|---|---|---|---|
| Task stated first, or sections delimited | §Structure, §2 | 136/202 | 67% |
| Output format stated up front | §3 | 111/202 | 55% |
| Anti-hallucination guardrail | §5 | 143/202 | 71% |
| Few-shot or worked example | §4 | 64/202 | 32% |
| **Neither §3 nor §5** | — | **25/202** | **12%** |

### `CLAUDE.md` and `rules/git.md`, from Bash commands

| Signature | Count |
|---|---|
| `git log`/`blame`/`show` — history as an investigation tool | 308 |
| `gh-axi` / `gh` — CLI for GitHub operations | 615 |
| `issue create` | 51 |
| Branch named `<type>/<slug>` | 25 |
| `git commit` / `git-safe-commit` | 85 |
| `pr create` | 31 |
| **MCP tool calls, any server** | **0** |

## What these numbers cannot tell you

**Presence is not causation.** A hit means the behaviour happened, not that the rule caused it. Separating the two needs an ablation: same task, two fresh sessions, one with the rule file and one without.

**Zero is ambiguous.** Zero MCP calls is equally consistent with "the CLI-over-MCP rule worked" and "no MCP server was ever attached, so the rule had nothing to act on". This is why that rule was dropped rather than moved in #38 — removing it makes the question answerable.

**The regexes count mention, not quality.** A prompt saying "report your findings" scores a hit on output format whether or not the format is actually specified. The 55% is an upper bound on stated format and says nothing about how good those statements are. **This is why a `PreToolUse` gate on `Task` was rejected in #42**: a hard gate needs a binary criterion, and this one needs judgement.

**Bash counts inflate.** They count calls, so a retried command counts twice.

**The corpus is live and includes the sessions that read this file.** The first run of this audit reported 193 subagent prompts; an hour later the same window reported 202, because the session doing the measuring kept dispatching subagents. Compare runs, never a run against a remembered number.

## Decisions this baseline has already carried

- **#36** folded `code-quality.md` into `CLAUDE.md` — the conditional pointer at it saved nothing, since everything in `rules/` loads at launch.
- **#38** distributed `agent-best-practices.md`; *CLI over MCP* was dropped on the zero-MCP finding above.
- **#40** moved the git workflow into the `git-workflow` skill, keeping the safety half always-loaded.
- **#42** left `rules/prompting.md` alone. Converting it to a skill would trade a measured 67% structural adherence for an unknown invocation rate — a regression risk with no evidence behind it. Revisit when there is a second data point, not before.
