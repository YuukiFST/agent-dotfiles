# Prompting — Writing Instructions

Apply when writing a prompt for a sub-agent, tool or LLM call.
Designing an agentic task, debugging a prompt, writing its evals, or maintaining a prompt file or CLAUDE.md → also read `~/.claude/PROMPT_ENGINEERING.md`; training a project's CLAUDE.md on its transcripts → the `backpass` skill.

## Structure

```
1. TASK — What to do. Be explicit: "Fix calculateTotal() returning NaN for negative inputs."
2. CONTEXT — Dynamic data to analyze (code, logs, specs).
3. INSTRUCTIONS — Definition of done ("tests pass"), when to stop and ask, output format. No "think step by step": the model already reasons before replying.
```

Bad: "Fix this bug."
Good: "Read `calculateTotal` in `src/billing.ts`. Trace negative quantity through callers. Output the minimal diff."

## Writing rules (ordered by priority)

1. **Task first.** State what to do before providing data. Stable context (rules, schemas) before dynamic data (logs, code).
2. **Use delimiters.** XML tags or markdown headers separate instructions from content. Prevents context bleeding.
3. **Output format upfront.** "JSON only", "just the diff", "file:line references."
4. **Few-shot for complex tasks.** One correct input/output pair > paragraphs of explanation. Show an existing pattern from the codebase.
5. **Anti-hallucination guardrails.** "State if uncertain", "cite file:line", "insufficient data → say so."
6. **Prefilled output.** Start the response with the expected format token to suppress preamble: prefill with `{` for JSON, `<tag>` for XML, ` ```diff` for code.
7. **Tool over verbal.** Don't say "be careful with X." Give a specific tool/process: "Run `mypy .` after editing" not "make sure imports are correct."
8. **Balanced instructions.** Give both sides of every tradeoff. "Never install packages to fix errors. If a new dependency is genuinely needed, confirm with the user."
9. **Instructions don't add capability.** If the task needs something the model is bad at (precise calculation, factual lookup, deterministic parsing), give it an executable *tool* (function calling) — don't restate the instruction. "It's critical to calculate correctly" doesn't improve the arithmetic; a calculate tool does. Distinct from #7 (process vs verbal): here the capability is absent, not the phrasing.
10. **Positive framing.** "Use const objects, use named exports" beats "Don't use enums, don't use default exports." Ban lists force navigation around forbidden territory; positive instructions give a clear target.
    Exception, visual design: "avoid generic" has no target, so list the exact patterns to exclude ("No cream backgrounds, italic headings, monospace labels, pill buttons").
11. **Concrete over vague.** "Wrap in try/except with specific types, log the traceback" beats "Handle errors properly."

## Output contracts

Specify: exact format (JSON schema / XML tags), required vs optional fields, error format, stop conditions.
