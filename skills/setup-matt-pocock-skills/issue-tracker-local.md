# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/helmsman`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Destination / Notes / decision sections / fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. An `Audience:` line records `po`/`dev` and a `Type:` line the method (`decision`/`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's matching decision section in `map.md`.
- **Spec and build tickets**: the spec is `.scratch/<effort>/spec.md`, linked from the map's Spec section; build tickets are `.scratch/<effort>/build/NN-<slug>.md`, numbered from `01` blockers-first, with the same `Blocked by:` and `Status:` lines as decision tickets. Close one by appending what works and how it was verified under `## Answer` and setting `Status: resolved`.
- **Children of a parent**: scan `.scratch/<effort>/issues/` for decision tickets and `.scratch/<effort>/build/` for build tickets. Listing every open `po` ticket for a review scans `issues/` for `Audience: po` files not yet `resolved`, blocked or claimed ones included.
- **Unclaim**: set `Status: open` and save.
