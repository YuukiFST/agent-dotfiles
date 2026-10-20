# PROMPT_ENGINEERING.md — Global

Prompt-engineering work, reached from the pointer in `~/.claude/rules/prompting.md`: designing an agentic task, debugging a prompt, writing its evals, maintaining a prompt file or CLAUDE.md.
The rules in `rules/prompting.md` still apply; training a project's CLAUDE.md on its transcripts is the `backpass` skill.

## Building an agentic task

- **Split the monolith.** A complex agentic task runs better as isolated specialized prompts (generate → evaluate → repair) than one prompt doing everything — fewer tokens, lower latency, each step repeatable.
- **Three levers, not one.** When prompting stops improving the result, adjust the *model* (bigger/reasoning), *thinking* (adaptive/extended), or *harness* (give a tool, split the loop) — not just the prompt text.

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
