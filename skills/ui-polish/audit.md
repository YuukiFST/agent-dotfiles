# Audit: improve an existing screen

Improve what exists without changing what it does. The output is a ranked findings table, then the fixes applied in the project's idiom, then before/after evidence. At `exhaustive` depth, the **Exhaustive** section at the end adds to steps 1, 4, 6 and 7; read it before step 1.

## 1. Resolve the scope

Name the exact route, component tree and states in scope: default, loading, empty, error, narrow width, dark mode if the project has it. Too big to inspect credibly (a whole app) → narrow to one complete flow, say which, and say what was excluded.

List the source files the scope renders: the route, its components, the shared primitives it uses, the stylesheet lines it depends on. That list is the `scope files` of every reviewer prompt.

Done when: the scope files are listed.

## 2. Capture the baseline

Open the route in the browser. Save a desktop and a 320px screenshot to a scratch folder the project ignores (`.scratch/ui-polish/<route>/before-*.png`, or the project's own evidence folder when one exists). Take a `snapshot` for names and roles. Note console errors.

Done when: two screenshots exist (Design mode: one per frame width instead) and the accessibility snapshot is saved as text.

## 3. Fan out the domain reviewers

Dispatch the reviewers per `SKILL.md` **Domain reviewers**, in a single message so they run in parallel. Each prompt carries the recon block, the scope files, the preview URL, the before screenshots' paths and its own reference paths.

Done when: every reviewer returned a findings table or an explicit "No actionable findings".

## 4. Consolidate

Read `better-interface/SKILL.md` (**Rank by user impact** through **Verify what can be verified**) and `review-format.md`. Merge the reviewer tables:

- Verify each finding at its cited line. Drop what does not reproduce or is a documented project decision.
- One root cause per row, all locations listed. Escalation triggers first. Cap 15; say how many the cap excluded.
- Propose the cheapest fix that works (delete, platform, reuse, correct value, add).

Present the table. If the user is present and the fixes are many or invasive, stop for selection. Autonomous run: apply HIGH and MEDIUM, list LOW as follow-up.

## 5. Apply

Fix in the project's idiom, reusing recon's shared components and tokens. Motion fixes, a polish finding on motion included, take their exact values from `review-animations/STANDARDS.md`; gesture fixes from `apple-design` **Quick Reference**; overflow fixes from `break-ui` **Failure signatures**; polish values from `better-ui` siblings; a craft-only concept (scroll fade, grain, root canvas, press per surface) from the craft section its finding cites. Keep each fix minimal and local; a systemic finding is fixed at its source (token, shared primitive), not per leaf.

Done when: every applied row is checked off in the table with the file touched.

## 6. Review gate

1. Run the project gates from recon step 6 (typecheck, lint, tests). Fix what your change broke.
2. Reopen the route. After-screenshots at both widths, next to the before ones. Keyboard walk of the primary flow. Reduced-motion emulated once if motion changed.
3. Motion changed → re-read the ten standards in `review-animations/SKILL.md` against the diff. Any escalation trigger left = not done.

Done when: gates pass, both after-screenshots exist, and no HIGH finding remains open.

## 7. Report

The `review-format.md` structure: scope and coverage, the findings table with a status per row (applied / follow-up / rejected with reason), verification with exact commands, verdict. Point at the before/after screenshot paths.

## Exhaustive

The request asked for everything ("ao máximo", "every component"), so the work runs in rounds over a fixed inventory instead of one capped pass. Everything else in steps 1 to 7 holds.

- **Inventory (step 1).** One line per distinct component file the route renders, with the states it reaches and whether it renders data it does not author. A shared primitive (button, icon, input) gets one line however often it appears. The inventory and its count go into every reviewer prompt, and every reviewer returns a verdict line per component.
- **Apply policy (step 4).** No stop for selection: the request already chose. Apply HIGH and MEDIUM, plus every LOW whose fix sits on the first four rungs of the ladder (delete, platform, reuse, correct value). A LOW that needs **Add** is `follow-up`.
- **Carry-over (step 4).** The cap of 15 bounds a round's table, not the work. Rows past the cap are `carried` and lead the next round's table.
- **Rounds (after step 6).** The after-screenshots become the next round's before, and steps 3 to 6 run again over the whole inventory. Each reviewer prompt carries the earlier rounds' rows with their status. An `applied` row that still reproduces comes back as `Fix incomplete`; `rejected` and `follow-up` rows are not proposed again.
- **Stop.** A round ends the loop when its consolidated table has no HIGH or MEDIUM and nothing is carried. Round 3 ends it regardless; every row still open is listed as follow-up, except an open HIGH, which leads the report and keeps step 6 not done. Say which condition ended it.
- **Report (step 7).** One table per round, the inventory with a verdict per component (improved, clean, not reviewed), and an offer, not a run, of **Break** for each inventory component that renders data it does not author and **Variant** for the piece the reviews flagged weakest.

Done when: the stop condition is met and named, and every inventory line has a verdict.
