# Design: blueprint, prototype, lock

Reached from `/helmsman <map> --design`.
The human sees the drawing first and the model second: **blueprint, then prototype, then evaluation**.
Structure is settled on the blueprint, look and feel on the prototype, and each stage is approved before the next one starts, because a screen rebuilt after its structure moved costs more than a redrawn line.

**Resume, don't redraw.** A rerun reads `FEEDBACK.md`, the newest page and its banked answers; `blueprint approved` in **Notes** means it continues from step 3.

A project with no interface skips this phase: write `Design: no interface` in the map's **Notes** and stop.

## 1. Ground

List the screens the map's flows reach and pick the **core screens**: the ones the main flows pass through, five at most in one round; the rest follow their pattern and are named in **Assumed**.
Read what the design stands on: in an existing repo its tokens, components and neighbouring screens, which are [givens](SKILL.md#givens); in a new project, the references the human gave.
A new project with no reference gets a `V-` item asking for one (a site, a product or an image), recommending your own direction.
Done when the core screens are named on the map and every open `V-` question is drafted.

## 2. Blueprint

Draw the structure as one HTML page at `<plan>/design/blueprint-<n>.html`, reading `better-layout` through `ui-polish` for grouping, reading order and what collapses at narrow width.

- **Black line on white paper, one system font, greys only.** Colour and imagery wait for the prototype, so the human judges structure alone.
- **Real labels and real example data**, because the reader is not a designer. Numbered callouts tie the drawing to the `V-` items.
- **The flow is drawn:** every core screen on the sheet, with arrows for how one leads to the next, plus the empty and error states that change the structure.
- **Alternatives only where the structure is open:** two or three layouts side by side for that screen, as one `V-` item, the recommended one first. A screen with one sensible structure is drawn once.

Embed a [packet](PACKET.md) under the drawing and send it.
Revise until a round returns no change and no open ledger row on structure.
Done when the human has approved the blueprint: write `blueprint approved` on the **Design** line of **Notes** and move to step 3 only then.

## 3. Prototype

Build the approved blueprint as a clickable model at `<plan>/design/prototype-<n>.html`, following [`prototype/UI.md`](../prototype/UI.md) for the throwaway shape and `ui-polish` for the craft: its **Variant** route for the picker and the variant floor, and the direction spec in its `build.md`.

- **Every core screen, linked as the blueprint's arrows say,** with mock data and the states the blueprint named.
- **Three variants on one visual axis** from `variant`'s table: emphasis, type, density or voice. Structure is settled, so this replaces `UI.md`'s rule that variants disagree about structure. The recommended variant opens first.
- **One self-contained page with local assets beside it,** which is what Lavish reviews. In an existing project, mount the variants on the real route per `UI.md` sub-shape A, and send the packet as its own page linking there.

Embed a packet whose `V-` item picks the variant, recommended one selected, and send it.
A pinned element is the sharpest answer ("the header from B on C"): build that combination in the next revision.

## 4. Evaluate

Each round runs in this order:

1. Bank the round in the [ledger](#the-feedback-ledger).
2. Revise, reading the whole ledger first. Every open row is either resolved in the page or asked about in the next packet.
3. Send the next packet, listing the rows resolved.

Done when the human approves a single variant and no ledger row is open.
Past three rounds on one screen, recommend stopping there and carrying the remaining rows as `A-` items.

## 5. Lock

Write `<plan>/design/DESIGN.md`: the visual thesis, tokens (colour, type, spacing, radius, motion), the components with their states, and one line per core screen pointing at its approved page.
Move the approved pages to `<plan>/design/approved/` and delete the losing revisions; git keeps them.
A component whose proportions matter gets a sheet from `dimensional-drawing`.
Link `DESIGN.md` from the map's **Design** section.
Done when every core screen has an approved page and every `Liked` row is reflected in `DESIGN.md`.
Then [the next command](SKILL.md#the-next-command).

On request only: `stageshow` for an animated walkthrough, `anatomy` for a figure of how the system works.

## The feedback ledger

`prototype` records only the winning verdict, so the likes and dislikes that led there live here, in `<plan>/design/FEEDBACK.md`, one table for the whole effort:

```markdown
| ID | Round | Screen | Kind | The human's words | Status |
|---|---|---|---|---|---|
| F-01 | R3 | Dashboard | Disliked | "too much empty space at the top" | resolved R4 |
| F-02 | R3 | Dashboard, variant B | Liked | "this header" | open |
```

- **Kind** is `Liked`, `Disliked` or `Asked`.
- **The words are verbatim**, in the language they came in. Your reading of them goes in the revision.
- **A row closes** by being resolved in a page the human then saw, or by the human's word. A `Liked` row stays in force after it closes.

The ledger is binding after the lock too: [BUILD.md](BUILD.md) treats it as a constraint, and the next effort on this project reads it before drawing.
