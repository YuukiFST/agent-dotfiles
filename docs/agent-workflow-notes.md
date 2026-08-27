# Agent workflow notes

Habits for the person driving the agent, extracted from Anthropic's best-practices workshop.

These lived in `rules/agent-best-practices.md` until issue #38.
They are addressed to you, not to the agent — an agent cannot choose how you phrase a request or when you open a new session — so they no longer ship as an instruction payload injected into every session.
The bullets that were genuinely agent-facing moved into `CLAUDE.md` and `rules/prompting.md`.

## Before you start

- **Ask for a plan on complex tasks.** "Here's a bug — search the codebase and give me a plan" beats "Fix this bug." The plan is cheap to correct; the implementation is not.
- **Start a fresh session for a new domain.** After 30+ turns, context accumulates and drifts. The memory store under `~/.claude/projects/<slug>/memory/` preserves what was learned, so a new session does not start from zero.

## While it works

- **Paste screenshots instead of describing UI.** A mock or a screenshot as multimodal input carries more than prose, both for building a screen and for debugging a visual bug.

## Running several at once

- **Shared state is already there.** Multiple sessions read and write the same store under `~/.claude/projects/<slug>/memory/`. No other coordination mechanism is needed for agents to hand facts to each other.
- **Independent tasks run in parallel.** Separate terminals, or the `superpowers:dispatching-parallel-agents` skill — it ships with the `superpowers` plugin, not with this repo's `skills/`, so the bare name does not resolve.

## One dropped on purpose

*CLI over MCP for well-known tools* also lived here: prefer a mature CLI (`gh`) over attaching an MCP server, and reach for MCP only when no CLI covers the service.
It was removed rather than moved because an audit of 429 transcripts found zero MCP tool calls, which is equally consistent with "the rule worked" and "the rule was never load-bearing" — the data cannot separate the two.
If MCP usage starts appearing now that nothing discourages it, the rule was doing work and belongs back in `CLAUDE.md`.
