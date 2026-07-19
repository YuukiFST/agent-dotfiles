---
name: claude-md-auditor
description: >-
  Use when the user wants to review, audit, improve, slim down, restructure, or
  sanity-check an agent context file: CLAUDE.md, AGENTS.md, or GEMINI.md, global
  (~/.claude/CLAUDE.md) or repo-level, including nested or @imported ones. Triggers
  like "review my CLAUDE.md", "is my AGENTS.md any good", "my context file is too
  long", "clean up my CLAUDE.md", "audit the project instructions", "is this well
  structured".
disable-model-invocation: true
---

# CLAUDE.md / AGENTS.md Auditor

Audit an agent context file against evidence on what actually helps coding
agents, then hand back concrete fixes.

## Why this skill exists

Research (Gloaguen, Mündler, Müller, Raychev, Vechev: "Evaluating AGENTS.md:
Are Repository-Level Context Files Helpful for Coding Agents?") benchmarked
context files on real GitHub-issue tasks (SWE-bench Lite plus their AGENTBENCH).
What it actually found:

- Context files do **not** reliably raise success. LLM-generated ones slightly
  *lower* it (-3% avg, worse in 5 of 8 settings); developer-written ones help
  only marginally (+4% avg, and not at all for Claude Code).
- Every context file costs more: over 20% more inference cost (20% on SWE-bench
  Lite, 23% on AGENTBENCH for LLM-generated), more reasoning tokens (up to ~22%),
  and more steps. Agents obey the file, so they run more tests and
  grep/read/write/explore more. The result is more *thorough*, not more
  *successful*. **Unnecessary requirements actively make tasks harder.**
- Codebase overviews don't work: files enumerating directories did not help
  agents reach relevant files faster. The paper concludes context files are
  "not effective at providing a repository overview."
- The one measured upside is as a **documentation substitute**. When a repo has
  little or no docs, a context file helps most; in well-documented repos it's
  largely redundant.

The paper's recommendation: keep human-written files and include **only minimal
requirements** (e.g. the specific tooling this repo needs); omit LLM-generated
bloat. So a good context file is **minimal and specific**: the few non-obvious,
this-repo-only facts a competent engineer couldn't guess and the model can't
read from the code, and nothing else.

Hierarchy (split rarely-needed rules into sub-files loaded only when the task
touches them) is a structural tactic this skill adds to keep the always-loaded
surface minimal and task-relevant. The paper evaluates content, not file
structure, so treat hierarchy as a means to its "concise, task-relevant" end,
not as a paper finding.

Scope caveat: the study is Python-heavy. For popular stacks the model already
knows the tooling, so generic tooling notes are low-value; for niche languages
or toolchains underrepresented in training data, this-repo tooling facts may
matter more. Weigh "the model already knows this" against the repo's stack.

The skill's own output should model what it preaches: terse, concrete, no
ceremony.

## Step 1 — Ask scope (always, before reading anything)

Ask the user which file(s) to audit. Do not assume.

- **Global** — `~/.claude/CLAUDE.md` (applies to every project)
- **Local** — the repo's `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`, including nested
  ones in subdirectories
- **Both**

If the repo has both `CLAUDE.md` and `AGENTS.md` (or nested files), list what you
found and confirm which to include. `@import`ed sub-files count as part of the
file's effective size — follow imports and audit the whole tree, not just the
root.

## Step 2 — Read and measure

**First run the mechanical validator** (it does the deterministic walk for you —
don't hand-resolve the import tree):

```
node scripts/claudelint.js <path-to-context-file>
```

It prints the Validity block directly: `[Error]`/`[Warning]` lines or "All
mechanical checks pass." It walks the full `@import` tree (missing / unreadable /
circular / depth / case-clash, fenced imports ignored), checks `npm run` scripts
against the nearest `package.json`, validates `paths:` frontmatter in
`.claude/rules/*`, suffix-matches prose file refs across the repo, and flags
size ≥ 40 KB / > 40 headings. Add `--json` for machine-readable output; exit
code is 1 if any Error. Paste its findings into the report's Validity block
verbatim — do not re-derive them by hand.

Then read each target file (and its imports) for the judgment scores. Capture:

- Total line count and effective size (root + all imported/referenced files)
- Heading count (top-level file only) and total size in KB
- Whether content is monolithic (everything always loaded) or hierarchical
  (conditional pointers to sub-files)

## Step 3 — Audit against the rubric

Read `references/rubric.md` and score the file on each dimension. The rubric has
the full criteria, examples of good vs bad lines, and how to tell
genuinely-valuable content from filler. Do not summarize the rubric back to the
user — apply it.

The **Mechanical validity checks (claudelint family)** are already done by
`scripts/claudelint.js` from Step 2 — its output is the Validity block. Read the
rubric's claudelint section only to *interpret* a finding (what a warning means,
when it's a false positive). Don't re-run those checks by hand.

## Step 4 — Report

Use this exact structure:

```
# Audit: <file path> (<N> lines, <effective size>)

## Verdict
<1-2 sentences: is it healthy, bloated, or thin? The single biggest problem.>

## Scores
- Conciseness:  <good | bloated>     — <why, 1 line>
- Specificity:  <good | generic>     — <why>
- Overviews:    <none | present>     — <codebase maps / dir trees / enumerations: paper shows they don't help>
- Hierarchy:    <good | monolithic>  — <always-loaded surface vs conditional sub-files>
- Signal:       <high | diluted>     — <ratio of non-derivable domain knowledge to filler>

## Validity (objective — claudelint family; omit clean lines)
- [Error]   <broken/missing/circular/unreadable import, file ref, or npm script> — <offending path>
- [Warning] <bad glob, malformed paths, case clash, import-in-code-block>        — <offending path>
- [Warning] <size ≥40KB or >40 headings> — split into .claude/rules/*.md via @import (hierarchy), do not delete
<If everything passes: "All mechanical checks pass.">

## Cut these (no payoff / model already knows / derivable from repo)
- <quote line or section> — <why it adds overhead without value>

## Keep these (genuine domain expertise — the reason the file exists)
- <quote line or section> — <why it survives between sessions>

## Restructure
- <specific hierarchy move, e.g. "move the 200-line DB rules into
  references/database.md and replace with: 'Changing schema.prisma? Read
  references/database.md first, else skip.'">
```

## Step 5 — Propose edits

After the report, offer the rewrite. Show it as a diff (changed sections with
`...` for untouched parts), not a full reprint. Then ask before writing:

> Apply this rewrite to `<path>`? (yes / adjust / report-only)

Only edit the file on explicit yes. Preserve any content the user has flagged as
load-bearing even if it looks generic — when unsure whether a rule encodes a
real past failure, ask rather than cut.

## Hard rules

- Never delete domain knowledge to hit a line target. Conciseness serves signal,
  not the reverse. A precise 400-line file beats a vague 80-line one.
- Suggest hierarchy (split + conditional pointer) before suggesting deletion for
  any large, genuinely-useful section.
- Don't invent project facts. If a rule's purpose is unclear, ask the user why
  it's there before judging it filler.
