# Agent Workflow Patterns

Non-obvious patterns for working with code agents (extracted from Anthropic's best-practices workshop).

## Before coding

- **Plan first for complex tasks.** "Here's a bug — search the codebase and give me a plan" not "Fix this bug."
- **Git history is an investigation tool.** Onboarding to unfamiliar code or "why is this like this" → `git log`/`blame` before theorizing; the history tells the story the current state can't.
- **Fresh session for new domains.** After 30+ turns, context accumulates and drifts. Start a new session; memory store preserves learnings.

## During coding

- **Commit after each feature chunk.** Not after hours of work. Review diffs before committing.
- **Screenshots as spec/feedback for UI.** Paste a mock/screenshot as multimodal input instead of describing UI in prose — both to build and to debug visual issues.

## Building an agentic task

- **Split the monolith.** A complex agentic task runs better as isolated specialized prompts (generate → evaluate → repair) than one prompt doing everything — fewer tokens, lower latency, each step repeatable.
- **Three levers, not one.** When prompting stops improving the result, adjust the *model* (bigger/reasoning), *thinking* (adaptive/extended), or *harness* (give a tool, split the loop) — not just the prompt text.
- **CLI over MCP for well-known tools.** Service has a mature, well-documented CLI (e.g. `gh`) → use it instead of attaching an MCP server; MCP only when no CLI covers it.

## Reviewing agent output

- **Adversarial review in a separate context.** The reviewer never shares a session/context with the implementer — same-context review inherits the implementer's bias. Instruct the reviewer to assume the code is wrong and prove otherwise. (Source: Bun Zig→Rust rewrite, bun.com/blog/bun-in-rust.)
- **Paragraph-long comment = code is wrong.** An agent writing a long comment justifying a stub or shortcut is hiding incorrect code. Cheap review heuristic: flag the comment, don't accept the explanation.

## Multiple agents

- **Shared state via `.opencode/memory/`.** Multiple sessions read/write the same memory files. No other coordination needed.
- **Independent tasks = parallel sessions.** Use `dispatching-parallel-agents` skill or separate terminals.

## CLAUDE.md maintenance

See `prompting.md` §Maintenance (hygiene, staleness test, conditional pointers).
