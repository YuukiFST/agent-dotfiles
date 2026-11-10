---
name: helmsman
description: Plan a whole project, or a feature too big for one session, from one prompt - decisions arrive as one page with the agent's recommendation already selected, the look is approved as a blueprint and then a prototype, and the agent writes the spec and build tickets and hands over the command that builds it.
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

A loose idea has arrived, usually a whole project, wrapped in fog.
Helmsman takes it from that first prompt to working software: it charts the way as a **shared map** of decision tickets, works them until nothing is left to decide, has the human approve how it will look, writes the **spec** and the **build tickets**, and hands over the command that builds them.

The bargain is the whole point: **the agent plans everything, and the human stays in control at the cost of one send.**
The passenger names the port and may correct any leg of the route.
Every decision on the map has a recommendation, and every question reaches the human with that recommendation already selected, so a human who agrees does nothing but send.
What the human cares about, they change; the rest was already decided.

Two defaults hold for every effort until the human's own words override them: the project costs **zero** ([Budget](#budget)), and the human's attention is spent sparingly ([The ask test](#the-ask-test)).

## The phases

| Phase | Command | Human's time |
|---|---|---|
| [Chart](#1-chart-helmsman-idea) | `/helmsman <idea>` | one to three packets |
| [Advance](#2-advance-helmsman-map) | `/helmsman <map>` | none |
| [Review](#3-review-helmsman-map---review) | `/helmsman <map> --review` | one packet per batch |
| [Design](#4-design-helmsman-map---design) | `/helmsman <map> --design` | a blueprint, then a prototype, each until approved |
| Spec | runs inside Advance once nothing is left to decide | reviewing the plan PR |
| [Build](#5-build-helmsman-map---build) | `/helmsman <map> --build` | none, unless the commit identity is unset |

Chart, Advance, Review and Design are **planning**: they produce decisions and throwaway artifacts, not product code.
The pull to just write the code is the signal you've reached the edge of the map: write the spec and build tickets, then hand over `--build`.
Build is the only phase that writes product code, and it runs in a fresh session.
A session with `FM_TASK_ID` set runs under firstmate: read [FIRSTMATE.md](FIRSTMATE.md) first, since it changes how every phase reaches the human.
Every phase follows "Leave no trace" in `~/.claude/CODING_STANDARDS.md`: a throwaway spike runs in a fresh `mktemp -d` directory and is deleted after, and the session's footprint is cleared before its report.
Every session reads [SKILLS.md](SKILLS.md) when it loads the map and applies each row whose condition holds.

## Refer by name

Every map and ticket has a **name**: its title.
In everything the human reads (narration, packets, the map's decision sections) refer to it by that name, never by a bare id, number, or slug.
The id and URL ride _inside_ the name as its link, never stand in for it.

## The four tracks

Every decision sits on one track, and the track says how it reaches the human.

| Track | Covers | How it reaches the human |
|---|---|---|
| **Product** (`P-`) | what the system does for the people using it, and what the business gets | an open question, or an assumption |
| **Visual** (`V-`) | how it looks, reads and feels: structure, style, tone | a drawing and a model, through [Design](#4-design-helmsman-map---design) |
| **Operations** (`O-`) | [the three escalations](#the-three-escalations), and anything the human must run or pay for | an open question |
| **Technical** (`T-`) | how it gets built | already decided, listed collapsed, changeable |

### The experience test

> Would the answer change what a person using the finished system experiences, or what the business gets out of it?
>
> **Yes** → Product or Visual: a `po` ticket or an assumption. **No** → Technical: a `dev` ticket you resolve alone.

Run this test on every question **before** it reaches the human.

| Question | Track | Why |
|---|---|---|
| Can someone edit a submission after sending it? | Product | changes what a user lives through |
| How long does an invite link stay valid? | Product | business rule |
| Does it have to work offline? | Product | changes what a user lives through |
| Who is allowed to see another person's records? | Product | business rule |
| What happens to the data when someone deletes their account? | Product | the human owes their users an answer |
| Sidebar or top navigation? | Visual | settled on the blueprint |
| Postgres or SQLite? | Technical | same experience either way |
| Sessions in a cookie, or JWT? | Technical | invisible from outside |
| One repo or several? | Technical | invisible from outside |
| Which test runner? | Technical | invisible from outside |
| Server-rendered or a client app? | Technical | invisible **if** the product decisions about speed and offline are already on the map; if they aren't, ticket those first |

The last row is the shape of most hard cases: a technical choice that looks like a product question is usually a technical choice **waiting on** a product decision.
Ticket the product decision it depends on, and block yourself on it.

### Givens

The first prompt is a **brief**.
Anything it pins down is a **given**: a stack, a hosting platform, a paid API, a budget, a deadline, a target device.
Record each given in the map's **Notes** and build on it; a given replaces your own choice, even the boring default, and you neither re-decide it nor ask about it.
In an existing repo the repo is part of the brief: its stack, layout, build and test commands, conventions, and the hosting and services it already uses, read from the manifest, CI and `CONTEXT.md`, are givens too.
The human can add givens at any point by saying so; they land in **Notes** the same way.
A given returns to the human only when it contradicts another given or a product decision, as a `po` ticket naming the conflict.

### What the agent decides

Languages, frameworks, libraries, data schemas, API shapes, auth mechanism, file layout, naming, algorithms, test strategy, deploy shape, tooling, and the order the work gets done in, unless a given already settles it.
You decide each one and state it, with its best rejected alternative, in the next packet's collapsed **Technical** track.
These reach the human as decisions made, never as open questions.

### Overriding a technical decision

A changed `T-` item is a new given.
Reopen its ticket, record the human's choice as the decision, then follow its `locks:` clause to every ticket built on it and re-resolve those.
A choice that breaks the budget or a product decision comes back as a `po` ticket naming the conflict.

## Budget

The project costs **zero** to build and run unless the human says otherwise.
Choose open-source dependencies, local or self-hosted services, and free tiers whose limits the product stays well inside at the scale the product decisions describe.
A paid service the human named, a budget the human stated, or a paid service an existing repo already uses, at its current plan, is a given and replaces zero; a higher tier or new spend on it is still a **Money** escalation.

Prices and free-tier limits come from the vendor's pricing page read this session, through a `research` ticket, never from memory.
When no free option meets a product decision, that is a **Money** escalation carrying two options: the cheapest paid route with its monthly cost, and the product cut that keeps the project free.
Recommend one of them.

## The three escalations

Three kinds of technical decision come back to the human anyway, because their consequence lands on the human, not on the code:

- **Money**: anything that breaks the [budget](#budget), whether recurring spend, a paid tier, a setup fee, or a free tier the project will plausibly exceed.
- **Personal data**: personal or sensitive data leaving the human's control, whether sent to a third party, stored in another jurisdiction, or retained longer than the product needs it.
- **Lock-in**: a choice that can only be undone by rewriting rather than swapping, such as a vendor, a hosting platform, or a data model everything else grows into.

Nothing else escalates.
Difficulty doesn't escalate.
Being unsure means you research.

An escalated ticket is a `helmsman:po` ticket on the Operations track, written in the human's language, with the recommendation **already made**.
Its packet item names what you are about to commit them to, the alternative and what it gains or gives up, and which of the three it is.

## The ask test

The human's attention is the scarcest resource on the map.
Every question that reaches them spends it, and the skill has failed when it spends it on something you could have assumed.

A Product or Operations question goes into a packet as an open item only when all three hold:

1. It passes the [experience test](#the-experience-test), or it is an escalation.
2. The brief, the map, and common practice for this kind of product leave no default a reasonable product owner would accept without a second thought.
3. A wrong guess is expensive to undo: it reshapes the data, who sees what, the money, or the scope.

When any one fails, **assume**: take your recommended answer and write it in the map's **Assumed** section, one line in the human's language.
An assumption is written down, never silent, and appears as a kept `A-` item in the next packet.
The human vetoes any line by unticking it or by saying so at any time.
Whatever session receives a veto files it as a `po` ticket and removes the line from **Assumed**; [the next command](#the-next-command) then routes to a review.
Vocabulary works the same way: pick the canonical term yourself, use it in what the human reads, and let them correct it.

Decisions travel in **packets**: [PACKET.md](PACKET.md) owns the format and the loop.
Charting runs **three packets at most**, and one is the target.
When the cap is hit, every question still open is assumed, except one whose wrong guess would be expensive to undo; that one becomes a `po` ticket for a later review.

## The map

The map is a single issue on this repo's issue tracker, labelled `helmsman:map`: the canonical artifact.
Its tickets are child issues of the map.

The map is an **index**, not a store.
It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place, its ticket, so the map only gists it and links.

**Packets and the map are the human's only surfaces.**
They will not open tickets.
**Product decisions**, **Assumed**, **Design** and **Waiting on you** are written in their language: no jargon, no library names, no acronyms.
**Technical decisions** is for you and may be as technical as it needs to be.

**Where the map, its tickets, the spec, blocking, and frontier queries physically live is tracker-specific.**
Read the tracker doc's **"Wayfinding operations"** section (`docs/agents/issue-tracker.md` in the repo, written by `/setup-matt-pocock-skills`) and take only the mechanics from it; the labels and sections in this skill are authoritative.
When the repo's tracker doc lacks that section, read it from the matching template in `setup-matt-pocock-skills/` (`issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`).
With no tracker doc at all: a GitHub remote with `gh` signed in uses the GitHub template, and anything else, including a brand-new project in an empty directory, uses the local one.

### The plan pack

Everything a session must not lose and the tracker cannot hold lives in `docs/plan/<effort>/` (`<plan>` in these files), on a `docs/<effort>-plan` branch in a worktree of its own: packets and their answers, research findings, the design and its ledger.
Commit there after every packet and every clean ticket boundary, under the identity `~/.claude/rules/git.md` gives.
When the directory is not a repo yet, `git init` and make an initial commit first.
[SPEC.md](SPEC.md) opens the branch as the **plan PR**, and merging it is the human's approval of the plan.

### The map body

The whole map at low resolution, loaded once per session, in the shape of [MAP.md](MAP.md).
Open tickets are **not** listed: they are open child issues, found by query.
**Spec** holds the plan's state, and its marks accumulate: empty, then the spec's link, then `complete` when SPEC.md has finished; `approved` (local tracker, once `--build` runs) and `built` (BUILD.md has finished) sit beside `complete`, never in its place.
Until the plan is approved (its PR merged, or `approved`), a decision recorded on the map removes `complete` in the same write, so SPEC.md reconciles it.
After approval, a decision that changes behavior updates the spec and files a new `helmsman:build` ticket; that ticket, or any `po` ticket filed, removes `built` in the same write, so no decision stays pending behind it.
The `locks:` clause on a technical decision is how a cascade of decisions made across sessions stays consistent with itself: the next ticket reads it instead of re-deciding.

### Tickets

Each ticket is a **child issue** of the map.
Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Every ticket carries **two** labels:

- **Audience**: `helmsman:po` or `helmsman:dev`, set by the [experience test](#the-experience-test), with no third value. An [escalation](#the-three-escalations) is always `po`, even though its question is technical.
- **Method**: `helmsman:<type>`, one of `decision`, `research`, `prototype`, `grilling`, `task` (see [Ticket methods](#ticket-methods)).

A session **claims** a ticket by assigning it to the dev driving the map, **first**, before any work, so concurrent sessions skip it.
An open, unassigned ticket is unclaimed.
A claim is a lease, because a session that dies cannot release it: it carries a comment with its UTC time and lapses six hours later, and a session opens by unclaiming every lapsed claim, build tickets included.

Blocking uses the tracker's **native** dependency relationship, because it renders the frontier visually in the tracker's own UI; only a tracker without native blocking falls back to a body convention.
A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed children.
A `dev` ticket may block a `po` ticket and vice versa.

Two more labels sit outside the map's tickets: the spec is an issue labelled `helmsman:spec`, and its build tickets are its children labelled `helmsman:build` only; [SPEC.md](SPEC.md) creates them and [BUILD.md](BUILD.md) works them.

The answer is recorded on resolution, not in the body.
Assets created while resolving a ticket go in the plan pack and are linked from the issue, not pasted in.

## Ticket methods

- **Decision** (`dev` default): a judgement call you make from what's on the map plus what you know. Most `dev` tickets are these.
- **Research** (`dev` only): reading documentation, pricing pages, third-party APIs, or local resources to surface a fact a decision waits on, resolved by a `/research` **subagent**, whichever phase created the ticket. The subagent writes its findings to `<plan>/research/<name>.md`, and the resolution comment carries every fact later tickets need, so the ticket stands on its own. Use it rather than guessing.
- **Prototype**: a cheap, rough artifact via `/prototype`. A `po` prototype of a rule or state model ([`LOGIC.md`](../prototype/LOGIC.md)) is a page the **human drives**, and it counts as one packet item; the screens go through [Design](#4-design-helmsman-map---design). A `dev` prototype is a throwaway spike **you** run to settle feasibility or performance.
- **Grilling** (`po` default): a product question, resolved in a [review](#3-review-helmsman-map---review) packet.
- **Task**: manual work that must happen before a decision can be made, such as signing up for a service so its API can be judged. Drive it alone where you can; where you can't, it becomes a `po` ticket carrying a precise checklist. The answer records what was done and any facts later tickets depend on.

## Resolving a `dev` ticket

The human is trusting you to find the smartest option, not the first one that works.
The resolution comment has a mandatory shape:

```markdown
## Decision

<the choice, stated plainly>

## Alternatives considered

- <option> - rejected because <reason>
- <option> - rejected because <reason>

## Criterion

<what decided it, anchored to a product decision, an assumption, or a given on the map, or to a cited fact: `file:line`, a doc URL, or a research ticket>

## Consequence

<what this locks in for later tickets: the `locks:` clause the map will carry>
```

Four rules govern it:

1. **Two real alternatives, minimum.** If there genuinely was only one viable choice, say so and say why the obvious rivals were never in play.
2. **The criterion traces to something outside your preference**: a product decision, a given, a cited fact, or a measured result.
3. **Boring and free wins by default**: the option with the fewest moving parts that meets the product decisions inside the budget. Novelty needs a product reason.
4. **Reversibility is the tiebreaker**: when two options score the same, take the one that is cheaper to undo.

Then record it: post the comment, **close** the issue, and append a one-line gist plus its `locks:` clause to **Technical decisions**.

## Resolving a `po` ticket

Only from the human's answer in a packet.
You never stand in for their side of it: every downstream decision built on an invented answer is wrong.
When the answer is settled, post it as the resolution comment, close the ticket, append the gist to **Product decisions**, and remove the line from **Waiting on you**.
Then graduate whatever fog the answer made specifiable, as Advance step 5 does.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see.
Beyond the live tickets lies the **fog of war**: decisions you can tell are coming but can't yet pin down, because they hang on questions still open.
Resolving a ticket clears the fog ahead of it, graduating whatever is now specifiable into fresh tickets of either audience.
The map's **Not yet specified** section is where that dim view is written down.

**Fog or ticket?** The test is whether you can state the question precisely now, _not_ whether you can answer it now.
Ticket a question that is already sharp, even if it's blocked; leave in **Not yet specified** what you can't yet phrase that sharply, without pre-slicing it.

## Out of scope

Work beyond the destination is **out of scope**: it isn't fog, and it never graduates.
When a ticket turns out to sit past the destination, **close it** and leave one line in **Out of scope**: the gist plus why, linking the closed ticket.

**Scope belongs to the human.**
Deciding _how_ is yours; deciding _how much_ is theirs.
Cutting something from the destination is a `po` ticket, or an assumption under the ask test, never a call you make while resolving a `dev` ticket.

## Invocation

### The next command

**Every session ends by handing the human the exact next command**, in a fenced block they can copy without editing a character:

```
/helmsman https://github.com/<owner>/<repo>/issues/42
```

The map goes in as its **URL** (or its `map.md` path on the local tracker), not its name: this one block is the exception to [Refer by name](#refer-by-name), because a prompt that has to be edited before it runs doesn't get run.
Name the map in the sentence above the block instead.
One line above it says what that session will do; one line below says how much of _their_ time it costs.
One command, never a menu.

While **Spec** is `complete` and the latest plan PR is closed unmerged, the human has rejected the plan: file a `po` ticket asking what should change, unless that PR already has one, then remove `complete`.
Then pick it from the tracker **as it stands after this session's writes**, taking the first row that matches:

| State | Next command | Their time |
|---|---|---|
| an unclaimed frontier `dev` ticket exists | `/helmsman <map>` | none: start it and walk away |
| an unblocked, unclaimed build ticket exists, **Spec** is marked `complete`, and the plan PR is merged or the tracker is local | `/helmsman <map> --build` | none; on the local tracker, running it is the human's approval of the plan |
| an open `po` ticket exists | `/helmsman <map> --review` | ~<n> min, one packet per twelve open questions |
| no open decision ticket, an interface exists, and **Design** is empty | `/helmsman <map> --design` | a blueprint, then a prototype, each until approved |
| no open decision ticket, and fog left or **Spec** not marked `complete` | `/helmsman <map>` | none: it graduates the fog, or writes or finishes the spec and build tickets |
| only claimed tickets are open or ready | `/helmsman <map>`, or `--build` when they are build tickets | none: it retakes them once their claims lapse |
| the plan PR is open | no command: the plan PR link, to review and merge, and `/helmsman <map> --build` to run after the merge | the review |
| every build ticket closed, and **Spec** not marked `built` | `/helmsman <map> --build` | none: it proves the whole and opens the pull request |
| **Spec** marked `built` | no command: the pull request link, or on the local tracker the branch, to review and merge | the review |

Work the human doesn't attend goes first whenever any exists: it costs them nothing, and it often shrinks the review that follows.
If you stopped on context, the next command resumes the same phase; name the ticket it will pick up.
A session that stopped because a resolution **contradicts a product decision** hands over `--review` even with `dev` tickets left, since only the human can lift that contradiction.

### 1. Chart: `/helmsman <idea>`

Read [CHART.md](CHART.md) and follow it.

### 2. Advance: `/helmsman <map>`

Read [ADVANCE.md](ADVANCE.md) and follow it.

### 3. Review: `/helmsman <map> --review`

Read [REVIEW.md](REVIEW.md) and follow it.

### 4. Design: `/helmsman <map> --design`

Read [VISUAL.md](VISUAL.md) and follow it.

### 5. Build: `/helmsman <map> --build`

Read [BUILD.md](BUILD.md) and follow it.
