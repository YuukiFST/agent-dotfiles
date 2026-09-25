# Effects reviewer

Fill the template in `../ui-polish/reviewer-prompt.md` with `{domain}` = `effects` and the values below. Resolve every path to an absolute one before pasting.

## Reference files (read in full)

- `REFS/libraries-dev/skills/libraries-dev/SKILL.md`
- `REFS/libraries-dev/skills/libraries-dev/references/0N-<library>.md` for every library installed in scope or hit by a recon signal
- `REFS/emilkowalski-skills/skills/animate/SKILL.md`
- `REFS/jakubkrehel-skills/skills/better-interface/review-format.md` (severity scale; the Libraries.dev references have no Reporting section)
- This skill's `SKILL.md` (lives in the skills directory, not under `REFS`)

## Ownership, pasted into this prompt and into the polish+motion prompt

**effects** owns combined-gate steps 1 to 3 and 8 (whether an effect belongs, which one, what it replaces, its cost), wait indicators on AI flows (spinners, typing dots, "Thinking…" copy), and conformance of every Libraries.dev use to its reference: documented props only, Common mistakes, the reduced-motion and accessibility wiring its Accessibility & performance section leaves to the app.
**polish+motion** owns all other motion, including an effect's entrance and exit. Label copy, radius and alignment, and status text around an effect stay with writing, polish+motion and accessibility, reviewed like any other element.

## Output addition

After the Not verified line, one more line: `Rejected: {candidate at path:line, gate step}; ...`, or `Rejected: none`. With no findings, the output is exactly `No actionable effects findings.`, then the Not verified line, then the Rejected line.
