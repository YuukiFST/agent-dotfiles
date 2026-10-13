---
name: helmsman
description: Start a project from one prompt - the human answers a few product questions, the agent decides everything technical at zero cost, charts the decisions as a shared map, writes the spec and build tickets, and hands over the command that builds it.
disable-model-invocation: true
---

A loose idea has arrived, usually a whole project, wrapped in fog.
Helmsman takes it from that first prompt to working software: it charts the way as a **shared map** of decision tickets, works them until nothing is left to decide, writes the **spec** and the **build tickets**, and hands over the command that builds them.

The split is the whole point: **the human is the product owner, the agent is the developer.**
The passenger names the port; the helmsman picks the route.
The human answers what the system should do for the people who use it.
Every question about how it gets built belongs to the agent: it becomes a ticket the agent resolves alone, choosing the smartest option rather than handing the human a menu.

Two defaults hold for every effort until the human's own words override them: the project costs **zero** ([Budget](#budget)), and the human's attention is spent sparingly ([Question budget](#question-budget)).

## The phases

| Phase | Command | Human's time |
|---|---|---|
| [Chart](#1-chart-helmsman-idea) | `/helmsman <idea>` | one to three short rounds of product questions |
| [Advance](#2-advance-helmsman-map) | `/helmsman <map>` | none |
| [Review](#3-review-helmsman-map---review) | `/helmsman <map> --review` | one batch of answers |
| Spec | runs inside Advance once nothing is left to decide | none |
| [Build](#4-build-helmsman-map---build) | `/helmsman <map> --build` | confirming the commit identity once |

Chart, Advance and Review are **planning**: each ticket resolves a decision, and they produce decisions, not code.
The pull to just write the code is the signal you've reached the edge of the map: write the spec and build tickets, then hand over `--build`.
Build is the only phase that writes product code, and it runs in a fresh session.
Every phase follows "Leave no trace" in `~/.claude/CODING_STANDARDS.md`: a throwaway spike runs in a fresh `mktemp -d` directory and is deleted after, and the session's footprint is cleared before its report.

## Refer by name

Every map and ticket has a **name**: its title.
In everything the human reads (narration, the map's decision sections) refer to it by that name, never by a bare id, number, or slug.
A wall of `#42, #43, #44` is illegible; names read at a glance.
The id and URL ride _inside_ the name as its link, never stand in for it.

## The division of labour

Every open question belongs to exactly one of two audiences, and the label says which.

### The product-owner test

> Would the answer change what a person using the finished system experiences, or what the business gets out of it?
>
> **Yes** → the human's question. **No** → yours.

Run this test on every question **before** it reaches the human.
A question that fails it is a ticket you owe yourself.

| Question | Whose | Why |
|---|---|---|
| Can someone edit a submission after sending it? | human | changes what a user lives through |
| How long does an invite link stay valid? | human | business rule |
| Does it have to work offline? | human | changes what a user lives through |
| Who is allowed to see another person's records? | human | business rule |
| What happens to the data when someone deletes their account? | human | the human owes their users an answer |
| Postgres or SQLite? | agent | same experience either way |
| Sessions in a cookie, or JWT? | agent | invisible from outside |
| One repo or several? | agent | invisible from outside |
| Which test runner? | agent | invisible from outside |
| Server-rendered or a client app? | agent | invisible **if** the product decisions about speed and offline are already on the map; if they aren't, ticket those first |

The last row is the shape of most hard cases: a technical choice that looks like a product question is usually a technical choice **waiting on** a product decision.
Ticket the product decision it depends on, and block yourself on it.

### Givens

The first prompt is a **brief**.
Anything it pins down is a **given**: a stack, a hosting platform, a paid API, a budget, a deadline, a target device.
Record each given in the map's **Notes** and build on it; a given replaces your own choice, even the boring default, and you neither re-decide it nor ask about it.
The human can add givens at any point by saying so; they land in **Notes** the same way.
A given returns to the human only when it contradicts another given or a product decision, as a `po` ticket naming the conflict.

### What the agent decides, full stop

Languages, frameworks, libraries, data schemas, API shapes, auth mechanism, file layout, naming, algorithms, test strategy, deploy shape, tooling, and the order the work gets done in, unless a given already settles it.
Never put any of these to the human.
If you catch yourself writing "which would you prefer" about one of them, you have broken the skill.

## Budget

The project costs **zero** to build and run unless the human says otherwise.
Choose open-source dependencies, local or self-hosted services, and free tiers whose limits the product stays well inside at the scale the product decisions describe.
A paid service the human named, or a budget the human stated, is a given and replaces zero.

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

An escalated ticket is a `helmsman:po` ticket written in the human's language, with the recommendation **already made**:

```markdown
## What I need from you

<one line, plain language, no jargon: what you're about to commit them to>

## My recommendation

<the option, and what it means for them in one sentence>

## The alternative

<the other option: what they'd gain and what they'd give up>

## Why this one is yours

<Money | Personal data | Lock-in>: <one line>
```

The answer you need is "go" or "no, because...".

## Question budget

The human's attention is the scarcest resource on the map.
Every question that reaches them spends it, and the skill has failed when it spends it on something you could have assumed.

### The ask test

A product question reaches the human only when all three hold:

1. It passes the [product-owner test](#the-product-owner-test).
2. The brief, the map, and common practice for this kind of product leave no default a reasonable product owner would accept without a second thought.
3. A wrong guess is expensive to undo: it reshapes the data, who sees what, the money, or the scope.

When any one fails, **assume**: take your recommended answer and write it in the map's **Assumed** section, one line in the human's language.
An assumption is written down, never silent, and the human vetoes any line by saying so at any time.
Whatever session receives a veto files it as a `po` ticket and removes the line from **Assumed**; [the next command](#the-next-command) then routes to a review.
Vocabulary works the same way: pick the canonical term yourself, use it in what the human reads, and let them correct it.

### Rounds

Questions travel in **rounds**: one message, **at most five** questions, each with your recommended answer, worded so "yes" accepts it.
Ask the questions whose answers unblock the most other decisions first; a question that hangs on another one still open waits for a later round.
Write the round in the human's language:

```markdown
**1. <the question in one line>**
<one line of context, only when the question would be misread without it>
→ <your recommended answer>

**2. ...**

**Assumed** (the defaults I took without asking; veto any by number)
- A1. <assumption in one line>
- A2. ...

Reply "ok" to accept every recommendation and assumption, or answer only the numbers you want different.
```

Charting runs **three rounds at most**, and one or two is the target.
When the cap is hit, every question still open is assumed, except one whose wrong guess would be expensive to undo; that one becomes a `po` ticket for a later review.
`/grilling` supplies the round format, not its stopping rule: helmsman stops at the ask test and the cap, not when every branch has been visited.

## The map

The map is a single issue on this repo's issue tracker, labelled `helmsman:map`: the canonical artifact.
Its tickets are child issues of the map.

The map is an **index**, not a store.
It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place, its ticket, so the map only gists it and links.

**The map is the human's only surface.**
They will not open tickets.
**Product decisions**, **Assumed** and **Waiting on you** are written in their language: no jargon, no library names, no acronyms.
**Technical decisions** is for you and may be as technical as it needs to be.

**Where the map, its tickets, the spec, blocking, and frontier queries physically live is tracker-specific.**
Read the tracker doc's **"Wayfinding operations"** section (`docs/agents/issue-tracker.md` in the repo, written by `/setup-matt-pocock-skills`) and take only the mechanics from it; the labels and sections in this skill are authoritative.
When the repo's tracker doc lacks that section, read it from the matching template in `setup-matt-pocock-skills/` (`issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`).
With no tracker doc at all: a GitHub remote with `gh` signed in uses the GitHub template, and anything else, including a brand-new project in an empty directory, uses the local one.

### The map body

The whole map at low resolution, loaded once per session.
Open tickets are **not** listed: they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like, in one or two lines; every session orients to it before choosing a ticket>

## Notes

- Givens: <each given from the brief or added later, or "none">
- Budget: <zero | the stated budget>
- Skills: <skills every session should consult>

## Product decisions

<!-- what the human decided, in their language: one line per closed `po` ticket, or per answer from a charting round, which has no ticket -->

- [<closed ticket title>](link) - <one-line gist of the answer>
- <charting answer in one line>

## Assumed

<!-- product defaults taken without asking, in their language; the human vetoes any line by saying so -->

- <the assumption>

## Technical decisions

<!-- what you decided: one line per closed `dev` ticket, gist plus the constraint it imposes -->

- [<closed ticket title>](link) - <the choice> - locks: <what later tickets must now assume>

## Waiting on you

<!-- every open `po` ticket, refreshed from the frontier query at the start and end of every session -->

- [<ticket title>](link) - <the question in one line>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination -->

## Spec

<!-- a link to the spec once SPEC.md has written it; empty until then -->
```

The `locks:` clause on a technical decision is how a cascade of decisions made across sessions stays consistent with itself: the next ticket reads it instead of re-deciding.

### Tickets

Each ticket is a **child issue** of the map.
Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Every ticket carries **two** labels:

- **Audience**: `helmsman:po` or `helmsman:dev`, set by the product-owner test, with no third value. An [escalation](#the-three-escalations) is always `po`, even though its question is technical.
- **Method**: `helmsman:<type>`, one of `decision`, `research`, `prototype`, `grilling`, `task` (see [Ticket methods](#ticket-methods)).

A session **claims** a ticket by assigning it to the dev driving the map, **first**, before any work, so concurrent sessions skip it.
An open, unassigned ticket is unclaimed.

Blocking uses the tracker's **native** dependency relationship, because it renders the frontier visually in the tracker's own UI; only a tracker without native blocking falls back to a body convention.
A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed children.
A `dev` ticket may block a `po` ticket and vice versa.

Two more labels sit outside the map's tickets: the spec is an issue labelled `helmsman:spec`, and its build tickets are its children labelled `helmsman:build` only; [SPEC.md](SPEC.md) creates them and [BUILD.md](BUILD.md) works them.

The answer is recorded on resolution, not in the body.
Assets created while resolving a ticket are linked from the issue, not pasted in.

## Ticket methods

- **Decision** (`dev` default): a judgement call you make from what's on the map plus what you know. Most `dev` tickets are these.
- **Research** (`dev` only): reading documentation, pricing pages, third-party APIs, or local resources to surface a fact a decision waits on, resolved by a `/research` **subagent**, whichever phase created the ticket. The subagent writes its findings to `.scratch/<effort>/research/<name>.md`, and the resolution comment carries every fact later tickets need, so the ticket stands on its own. Use it rather than guessing.
- **Prototype**: a cheap, rough artifact via `/prototype`. A `po` prototype is a mock the **human reacts to**, and it counts as one question in a round; a `dev` prototype is a throwaway spike **you** run to settle feasibility or performance.
- **Grilling** (`po` default): a product question, resolved in a [review](#3-review-helmsman-map---review) round.
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

Only in a review, with the human live.
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

Pick it from the tracker **as it stands after this session's writes**, taking the first row that matches:

| State | Next command | Their time |
|---|---|---|
| an unclaimed frontier `dev` ticket exists | `/helmsman <map>` | none: start it and walk away |
| an unblocked, unclaimed build ticket exists | `/helmsman <map> --build` | ~1 min to confirm the commit identity, then none |
| an open `po` ticket exists | `/helmsman <map> --review` | ~<n> min, one round per five open questions |
| no open decision ticket, and fog left or no spec yet | `/helmsman <map>` | none: it graduates the fog, or writes the spec and build tickets |
| every build ticket closed | no command: the pull request link, to review and merge | the review |

Work the human doesn't attend goes first whenever any exists: it costs them nothing, and it often shrinks the review that follows.
If you stopped on context, the next command resumes the same phase; name the ticket it will pick up.
A session that stopped because a resolution **contradicts a product decision** hands over `--review` even with `dev` tickets left, since only the human can lift that contradiction.

### 1. Chart: `/helmsman <idea>`

The one session where the human talks, and the only questions they get are product questions that passed the ask test.

1. **Read the brief.** Pull out the destination, the people it serves, and every given. Done when each given is written down for **Notes**.
2. **Draft the product yourself.** Write the destination, the users, the core flows and their rules as you would build them. Answer every gap yourself, then run the ask test on each answer; most become assumptions. Done when every gap is either an assumption or a question that passed the ask test.
3. **Ask the first round.** Open with the destination in two to four lines of their language, so the human can correct the whole picture at once; then the questions; then the **Assumed** list. Wait for the answer.
4. **Ask further rounds** only for questions the last answers unlocked that pass the ask test, within the cap. Done when no open question passes the ask test, or the cap is hit.
5. **Create the map** (label `helmsman:map`) with Destination, Notes, Product decisions, and Assumed filled in, and the fog sketched into **Not yet specified**. Record the vocabulary in `CONTEXT.md` through `/domain-modeling`.
6. **Create the tickets you can specify now** as child issues, sorted by the product-owner test, including every technical question you already know you owe yourself. Wire blocking edges in a **second pass**, once every issue has an id.
7. **Fire the research subagents**: one `/research` subagent per `research` ticket, in parallel (see [Ticket methods](#ticket-methods) for where findings go).
8. **Tell the human** in their language what the map says and that the rest is technical and yours, so they can step away. Then **continue straight into [Advance](#2-advance-helmsman-map)** in this same session.

If drafting shows the whole project fits one session with nothing left to decide, skip the cascade: write the spec straight away (step 0 of Advance).

### 2. Advance: `/helmsman <map>`

The default mode, and the one that runs without the human.
**Cascade** until you can't:

0. **Spec check.** When no decision ticket is open in either audience, claimed or not, graduate whatever is left in **Not yet specified** (into tickets, assumptions, or **Out of scope**). If that leaves no open decision ticket and **Spec** is empty, read [SPEC.md](SPEC.md) and follow it, then stop. Otherwise go on.
1. Load the **map**, the low-res view, not every ticket body. Read **Notes** and **Technical decisions** in full: the givens and `locks:` clauses are the constraints this session respects.
2. Take the first frontier `dev` ticket in map order. **Claim it** before any work.
3. Resolve it under [Resolving a `dev` ticket](#resolving-a-dev-ticket); a `research` ticket goes to a `/research` subagent, and you take the next ticket while it runs. Fetch the full body of any related or closed ticket on demand; invoke the skills **Notes** names.
4. Record it, close it, append to **Technical decisions**.
5. Graduate whatever fog the answer made specifiable into fresh tickets, clearing each graduated patch from **Not yet specified**. A product question it raises goes through the ask test first: assume it, or ticket it. Rule out of scope any ticket the answer shows to sit past the destination; update or delete tickets it invalidates.
6. **Loop back to step 0.**

An escalation does **not** stop the cascade: file the `po` ticket, block whatever depends on it, and take the next `dev` ticket.

Stop when one of these is true, and only then:

- **The frontier has no unclaimed `dev` ticket left**, and step 0 doesn't apply (another session may still hold a claimed one).
- **Context is running out.** Stop at a clean ticket boundary, never mid-resolution.
- **A resolution contradicts a product decision.** File a `po` ticket that names the contradiction and stop.

Then refresh **Waiting on you** and report in the human's language:

> Decided <n> things this session: <one line each, plain>. <n> questions are waiting on you: <names>. I also assumed: <new Assumed lines, if any>.

Then [the next command](#the-next-command).

### 3. Review: `/helmsman <map> --review`

Drains **every** open `po` ticket in [rounds](#rounds) of five.
The three-round cap is charting's; a review runs as many rounds as its queue needs, because every ticket in it already passed the ask test.

1. Load the map and query all open `po` tickets. Order them: blockers first, then whatever unblocks the most `dev` tickets.
2. Put them to the human as [rounds](#rounds), with the escalation recommendation as each question's recommended answer. Close the round with the **Assumed** lines added since the last review, so the human can veto them in the same reply.
3. Resolve each answered ticket under [Resolving a `po` ticket](#resolving-a-po-ticket) as the answers land, so an interrupted session still banks them. A vetoed assumption becomes a `po` ticket in the next round.
4. When the queue is empty, refresh **Waiting on you** to empty, tell them what just unblocked ("that unblocks <n> technical questions, and I'll work through them alone"), and hand over [the next command](#the-next-command).

### 4. Build: `/helmsman <map> --build`

Read [BUILD.md](BUILD.md) and follow it.
