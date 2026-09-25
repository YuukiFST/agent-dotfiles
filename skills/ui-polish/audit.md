# Audit: improve an existing screen

Improve what exists without changing what it does. The output is a ranked findings table, then the fixes applied in the project's idiom, then before/after evidence.

## 1. Resolve the scope

Name the exact route, component tree and states in scope: default, loading, empty, error, narrow width, dark mode if the project has it. Too big to inspect credibly (a whole app) → narrow to one complete flow, say which, and say what was excluded.

List the source files the scope renders: the route, its components, the shared primitives it uses, the stylesheet lines it depends on. That list is the `scope files` of every reviewer prompt.

## 2. Capture the baseline

Open the route in the browser. Save a desktop and a 320px screenshot to a scratch folder the project ignores (`.scratch/ui-polish/<route>/before-*.png`, or the project's own evidence folder when one exists). Take a `snapshot` for names and roles. Note console errors.

Done when: two screenshots exist and the accessibility snapshot is saved as text.

## 3. Fan out the domain reviewers

Dispatch the reviewers per `SKILL.md` **Domain reviewers**, in a single message so they run in parallel. Each prompt carries the recon block, the scope files, the preview URL, the before screenshots' paths and its own reference paths.

Done when: every reviewer returned a findings table or an explicit "No actionable findings".

## 4. Consolidate

Read `better-interface/SKILL.md` sections 6 to 9 and `review-format.md`. Merge the reviewer tables:

- Verify each finding at its cited line. Drop what does not reproduce or is a documented project decision.
- One root cause per row, all locations listed. Escalation triggers first. Cap 15; say how many the cap excluded.
- Propose the cheapest fix that works (delete, platform, reuse, correct value, add).

Present the table. If the user is present and the fixes are many or invasive, stop for selection. Autonomous run: apply HIGH and MEDIUM, list LOW as follow-up.

## 5. Apply

Fix in the project's idiom, reusing recon's shared components and tokens. Motion fixes take their exact values from `review-animations/STANDARDS.md`; polish values from `better-ui` siblings. Keep each fix minimal and local; a systemic finding is fixed at its source (token, shared primitive), not per leaf.

Done when: every applied row is checked off in the table with the file touched.

## 6. Review gate

1. Run the project gates from recon step 6 (typecheck, lint, tests). Fix what your change broke.
2. Reopen the route. After-screenshots at both widths, next to the before ones. Keyboard walk of the primary flow. Reduced-motion emulated once if motion changed.
3. Motion changed → re-read the ten standards in `review-animations/SKILL.md` against the diff. Any escalation trigger left = not done.

Done when: gates pass, both after-screenshots exist, and no HIGH finding remains open.

## 7. Report

The `review-format.md` structure: scope and coverage, the findings table with a status per row (applied / follow-up / rejected with reason), verification with exact commands, verdict. Point at the before/after screenshot paths.
