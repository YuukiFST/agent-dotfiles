# Motion: find, build, review

Emil's three-skill chain run as one procedure: `find-animation-opportunities` decides where motion belongs, `animate` builds each survivor, `review-animations` judges the result with a fresh reviewer. Zero lines of motion is a valid outcome at every step. On an Expo or React Native stack, `animate-expo` replaces `animate` per recon step 1.

## 1. Find

The user describes an effect without its name ("the bouncy popover thing") → look it up in `animation-vocabulary` **Glossary** and confirm the term first. Then resolve the request shape:

- **One named target** ("animate the dropdown", "add a press state to this button"): that target is the only candidate. Go to step 2.
- **A scope with no named target** ("add motion to this page", "this feels static", "make it feel alive", "what could animate here?"): read `find-animation-opportunities/SKILL.md` and run its **Workflow** over the scope. The recon block stands in for its step 1, plus the frequency map that step asks for.

The sweep is read-only and ends in `find-animation-opportunities` **Required Output Format**: the opportunities table with exact values in the project's tokens, the rejected candidates, the verdict. Its closing handoff to `improve-animations plan` is replaced by step 2 here.

Done when: either one named target is the candidate, or every seam class in `find-animation-opportunities` **Where to Hunt** yielded rows with `path:line` evidence or was cleared, and the three parts are written.

Then, by request:

- The request only asked where motion could go → present the three parts and stop. Offer step 2 for the rows the user picks.
- Nothing survived the gate → say so and stop. That is the correct result, not a failure.
- Otherwise → present the table and continue with every surviving row; the user is present and the rows are many → stop for selection first.

## 2. Build

Read `animate/SKILL.md` and `RECIPES.md`. Each row runs `animate` **The Build Sequence** in order; a named target from step 1 runs its gate (steps 1 and 2) here, and a row from the sweep already passed it. Start from the recipe that matches the component. Curves and durations are the project's tokens where they exist, the values in `animate` where they do not, never a third set. Content stays visible in a complete static first frame, without JavaScript, and reduced motion shows a stable final state, per `no-ai-design-slop` `ARTICLE.md` **Motion and Scroll**.

**gesture** on the row (drag, swipe, sheet, carousel, slider) → read the gesture row's references before building it: drag, flick and sheet motion is springs and velocity, not duration and curve, with the spring values from `apple-design` **Quick Reference** in place of the generic spring in `RECIPES.md`. On Expo, the gesture build is `animate-expo` **5. Timing or spring**, **7. Press, not hover** and its `RECIPES.md` **Bottom sheet you can drag to dismiss**. **mobile** on → apply `mobile-native/SKILL.md` to the touched elements.

Done when: every row is built or rejected by the gate with its reason, each built row carries `animate` **Output** (gate result, ingredients, what to feel-check), and **Never Ship** reads clean against the diff.

## 3. Review

The author does not grade its own motion.

1. **Evidence.** Run the project gates from recon step 6, open the route, emulate `prefers-reduced-motion` once and confirm movement drops while opacity and color stay, and keyboard-walk every element whose motion changed. A failed check is a blocking row of this round.
2. **Dispatch.** One motion reviewer per [reviewer-prompt.md](reviewer-prompt.md), plus the gesture reviewer when **gesture** is on and the mobile reviewer when **mobile** is on, in one message. Fill the Template with these changes:
   - Scope files: the files this mode touched since the recon step 6 baseline.
   - TASK gains: "Review only the motion this change added or altered. The diff:" followed by `git diff <baseline SHA>`, with every file untracked since the baseline pasted in full.
   - Rendered evidence: the results of **Evidence** above, the preview URL, and "none" for anything not captured.
   - Inventory block: keep only its earlier-rounds line, with each earlier row and its status (`fixed`, `follow-up`). Round 1 says "round 1".
   - Delete the Change and Visualize brief blocks.
   - OUTPUT gains a last line for the motion reviewer: `Verdict: Approve | Block (<rows that block>)`, decided by `review-animations` **Part 2 — Verdict**. Approve only when its Approve criteria all hold.
3. **Close the round** on the motion reviewer's Verdict line, never on the author's reading of the table. Approve with no HIGH row open → done; the other rows are follow-ups. Otherwise fix every row the Verdict names and every HIGH row, with the project's token where one exists and the `STANDARDS.md` value where none does; gesture rows take `apple-design` **Quick Reference**. Then run the round again from 1.

Three rounds at most; a Block left after round 3 leads the report. Feel that code cannot settle (a spring's bounce, a crossfade) is listed under **Not verified** with `animate`'s feel-check, never claimed.

Done when: a round closed on Approve with no HIGH open, or round 3 ended, and every evidence check ran or is marked Not verified.

## 4. Report

The step 1 table (or the named target), each row's status (built / rejected by gate / blocked), every reviewer's findings table per round with the motion verdict, the gate commands with their output, and the Not verified list.
