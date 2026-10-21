# Motion: find, build, review

Emil's three-skill chain run as one procedure: `find-animation-opportunities` decides where motion belongs, `animate` builds each survivor, `review-animations` judges the result with a fresh reviewer. Zero lines of motion is a valid outcome at every step. On an Expo or React Native stack, `animate-expo` replaces `animate` per recon step 1.

## 1. Find

Resolve the request shape first:

- **One named target** ("animate the dropdown", "add a press state to this button"): that target is the only candidate. Go to step 2.
- **A scope with no named target** ("add motion to this page", "this feels static", "make it feel alive", "what could animate here?"): read `find-animation-opportunities/SKILL.md` and run its **Workflow** over the scope, with the recon block standing in for its step 1. The user describes an effect without its name → look it up in `animation-vocabulary` **Glossary** and confirm the term before sweeping.

The sweep is read-only and ends in its **Required Output Format**: the opportunities table with exact values in the project's tokens, the rejected candidates, the verdict. Its closing handoff to `improve-animations plan` is replaced by step 2 here.

Done when: either one named target is the candidate, or every seam class in **Where to Hunt** yielded rows with `path:line` evidence or was cleared, and the three parts are written.

Then, by request:

- The request only asked where motion could go → present the three parts and stop. Offer step 2 for the rows the user picks.
- Nothing survived the gate → say so and stop. That is the correct result, not a failure.
- Otherwise → present the table and continue with every surviving row; the user is present and the rows are many → stop for selection first.

## 2. Build

Read `animate/SKILL.md` and `RECIPES.md`. Each row runs **The Build Sequence** in order; a named target from step 1 runs its gate (steps 1 and 2) here, and a row from the sweep already passed it. Start from the recipe that matches the component. Curves and durations are the project's tokens where they exist, the values in `animate` where they do not, never a third set.

**gesture** on the row (drag, swipe, sheet, carousel, slider) → read the gesture row's references before building it: drag, flick and sheet motion is springs and velocity, not duration and curve. **mobile** on → apply `mobile-native/SKILL.md` to the touched elements.

Done when: every row is built or rejected by the gate with its reason, each built row carries `animate` **Output** (gate result, ingredients, what to feel-check), and **Never Ship** reads clean against the diff.

## 3. Review

The author does not grade its own motion. Dispatch one motion reviewer per [reviewer-prompt.md](reviewer-prompt.md), motion row, with these changes:

- Scope files: the files step 2 touched.
- TASK gains: "Review only the motion this change added or altered. The diff:" followed by `git diff` of step 2's edits.
- Delete the Change, Inventory and Visualize blocks.

Close the round with `review-animations` **Part 2 — Verdict**: **Block** on any row its Block line names, **Approve** otherwise. Block → fix each row in the project's idiom with the value from `STANDARDS.md`, then re-review the new diff. Three rounds at most; a Block left after round 3 leads the report.

Then run the project gates from recon step 6, open the route, emulate `prefers-reduced-motion` once and confirm movement drops while opacity and color stay, and keyboard-walk any element whose motion changed. Feel that code cannot settle (a spring's bounce, a crossfade) is listed under **Not verified** with `animate`'s feel-check, never claimed.

Done when: the verdict is Approve, or round 3 ended on Block, and the gates and the browser checks have run or are marked Not verified.

## 4. Report

The step 1 table (or the named target), each row's status (built / rejected by gate / blocked), the reviewer's findings table per round with the verdict, the gate commands with their output, and the Not verified list.
