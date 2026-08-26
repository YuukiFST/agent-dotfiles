# Prompting — Writing and Maintaining Instructions

Apply when writing prompts for sub-agents, tools, or LLM calls, and when maintaining prompt files (including CLAUDE.md).

## Structure

```
1. TASK — What to do. Be explicit: "Fix calculateTotal() returning NaN for negative inputs."
2. CONTEXT — Dynamic data to analyze (code, logs, specs).
3. INSTRUCTIONS — Reasoning steps + output format.
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
11. **Concrete over vague.** "Wrap in try/except with specific types, log the traceback" beats "Handle errors properly."

## Output contracts

Specify: exact format (JSON schema / XML tags), required vs optional fields, error format, stop conditions.

## Debugging prompts

- **Extended thinking transcript:** read the model's reasoning to find where it went wrong. Bake the correct path into the prompt.
- **Iterate empirically:** identify the misunderstanding → add clarification → re-run → repeat.
- **Cite evidence:** every factual claim must reference its source (`file:line`, log line, session ID).
- **Information withholding** is the flip side of hallucination: a defensive instruction ("never give wrong info") can beat the accuracy instruction and make the model go silent. Fix: "Give accurate information. If uncertain, state what you checked and why you're uncertain."

## Evaluations

Every prompt change needs test cases:
1. Control case (happy path — must always pass)
2. Edge cases (previously seen failures)
3. Refusal case (model should say no)
4. Escalation case (model should defer to human/tool)
5. Calculation case (numeric precision)

## Maintenance (CLAUDE.md and long-lived prompts)

Remove on sight:
- Instructions patching old model limitations that no longer apply
- Content copy-pasted from websites (hero images, cookie references)
- Model described as a human ("you are a helpful assistant")
- Policy, data, and guidelines all in one blob — "Can I distinguish policy from data from guidelines at a glance?" If not, the model can't either.

Rules:
- Separate concerns: `## Output` = format policies, `## Working method` = decision rules, `## Architecture` = project data, `## Code rules` = hard constraints.
- **Version control for defensive rules.** Every "never X" or "always Y" needs a git commit explaining WHY. Re-check on every backward pass — model improvements may make the rule counterproductive.
- Staleness test: has every rule been relevant in the last 10 sessions? No → remove or move to a conditional sub-file. If an instruction is ignored 3 times in a row, it's either unclear or out of date.
- Use conditional pointers (`Read X before doing Y, otherwise skip`) for domain-specific rules.

### Two levels, opposite treatment

- **User level** (`~/.claude/CLAUDE.md` + `rules/`, the payload of this repo) is **handwritten**. It holds preferences you own; it changes rarely and no tool optimises it.
- **Project level** (a repo's own `CLAUDE.md` / `AGENTS.md`) is **trained**: give it a token budget, treat each list item or paragraph as one addressable unit, and update it from what the sessions actually did — not from the last time an agent annoyed you.

The backward pass on a project file: evidence comes from session transcripts with a verbatim quote per edit, never from recollection; batch before updating (a new rule needs ≥2 independent sessions); ~5 edits per pass, not a rewrite; at budget every addition names the removal or extraction that pays for it. Broad or safety-critical instructions stay in the file, narrow ones with a detectable trigger become a skill, narrow ones with no trigger are deletion candidates.

Run it with the `backpass` skill.
