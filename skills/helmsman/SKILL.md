---
name: helmsman
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map where the human answers only what the system should do, and the agent decides how it gets built, resolving the technical tickets alone and in cascade.
disable-model-invocation: true
---

A loose idea has arrived — too big for one agent session, and wrapped in fog. Helmsman charts the way as a **shared map** of tickets on the repo's issue tracker, then works them until nothing is left to decide.

The split is the whole point: **the human is the product owner, the agent is the developer.** The passenger names the port; the helmsman picks the route. The human answers what the system should do for the people who use it. Every question about how that gets built belongs to the agent — it is written down as a ticket, and the agent resolves it in a later session, alone, choosing the smartest option available rather than handing the human a menu.

This is the sibling of `/wayfinder`, which asks the human everything. Reach for wayfinder when the human wants to make the technical calls; reach for helmsman when they are acting purely as a product owner.

## Plan, don't do

Helmsman is **planning**. Each ticket resolves a decision. The map is done when the way is clear — nothing left to decide before someone goes and builds the thing. The pull to just do the work is the signal you've reached the edge of the map: stop and hand off to `/writing-plans`. An effort can override this in its **Notes**, but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket is an issue, so it has a **name** — its title. In everything the human reads — narration, the map's decision sections — refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` is illegible; names read at a glance. The id and URL don't vanish; they ride _inside_ the name as its link, never stand in for it.

## The division of labour

Every open question on the map belongs to exactly one of two audiences, and the label says which.

### The product-owner test

> Would the answer change what a person using the finished system experiences, or what the business gets out of it?
>
> **Yes** → the human's question. **No** → yours.

Run this test on every question **before** it reaches the human. If a question fails the test, you do not ask it — you owe yourself a ticket.

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
| Server-rendered or a client app? | agent | invisible **if** the product decisions about speed and offline are already on the map — if they aren't, ticket those first |

The last row is the shape of most hard cases: a technical choice that looks like a product question is usually a technical choice **waiting on** a product decision. Don't escalate it; ticket the product decision it depends on, and block yourself on it.

### What the agent decides, full stop

Languages, frameworks, libraries, data schemas, API shapes, auth mechanism, file layout, naming, algorithms, test strategy, deploy shape, tooling, and the order the work gets done in. Never put any of these to the human. If you catch yourself writing "which would you prefer" about one of them, you have broken the skill.

## The three escalations

Three kinds of technical decision come back to the human anyway, because their consequence lands on the human, not on the code:

- **Money** — recurring spend, a paid tier, or a setup fee. A free tier the project will plausibly exceed counts.
- **Personal data** — personal or sensitive data leaving the human's control: sent to a third party, stored in another jurisdiction, or retained longer than the product needs it.
- **Lock-in** — a choice that can only be undone by rewriting rather than swapping. Vendor, hosting platform, or a data model everything else grows into.

Nothing else escalates. Difficulty doesn't escalate. Being unsure doesn't escalate — being unsure means you research.

An escalated ticket is a `helmsman:po` ticket written in the human's language, with the recommendation **already made**:

```markdown
## What I need from you

<one line, plain language, no jargon — what you're about to commit them to>

## My recommendation

<the option, and what it means for them in one sentence>

## The alternative

<the other option: what they'd gain and what they'd give up>

## Why this one is yours

<Money | Personal data | Lock-in> — <one line>
```

The answer you need is "go" or "no, because —". Never present five options and ask them to pick.

## The Map

The map is a single issue on this repo's issue tracker, labelled `helmsman:map` — the canonical artifact. Its tickets are child issues of the map.

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

**The map is the human's only surface.** They will not open tickets. Everything in **Product decisions** and **Waiting on you** is written in their language — no jargon, no library names, no acronyms. **Technical decisions** is for you and may be as technical as it needs to be.

**Where the map, its child tickets, blocking, and frontier queries physically live is tracker-specific.** Consult the tracker doc's **"Wayfinding operations"** section for how _this_ repo expresses them, substituting the `helmsman:` label prefix for `wayfinder:` throughout — the mechanics are identical. If no tracker has been provided, run `/setup-matt-pocock-skills`, or default to the local-markdown tracker.

Take the **mechanics** from that section and nothing else. The labels are this skill's: the tracker doc predates helmsman, so it knows neither the audience label nor `decision`, and [Ticket methods](#ticket-methods) below is the authoritative set.

### The map body

The whole map at low resolution, loaded once per session. Open `dev` tickets are **not** listed — they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like — the spec or decision this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Product decisions

<!-- what the human decided — one line per closed `po` ticket, in their language -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Technical decisions

<!-- what you decided — one line per closed `dev` ticket, gist plus the constraint it imposes -->

- [<closed ticket title>](link) — <the choice> — locks: <what later tickets must now assume>

## Waiting on you

<!-- every open `po` ticket, refreshed from the frontier query at the start and end of every session -->

- [<ticket title>](link) — <the question in one line>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

The `locks:` clause on a technical decision is not decoration. It is how a cascade of decisions made across sessions stays consistent with itself — the next ticket reads it instead of re-deciding.

### Tickets

Each ticket is a **child issue** of the map. Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Every ticket carries **two** labels:

- **Audience** — `helmsman:po` or `helmsman:dev`. Set by the product-owner test. There is no third value and no "either".
- **Method** — `helmsman:<type>`, one of `decision`, `research`, `prototype`, `grilling`, `task` (see [Ticket methods](#ticket-methods)).

A session **claims** a ticket by assigning it to the dev driving the map, **first**, before any work, so concurrent sessions skip it. That assignee _is_ the claim: an open, unassigned ticket is unclaimed.

Blocking uses the tracker's **native** dependency relationship — essential because it renders the frontier _visually_ in the tracker's own UI. Only a tracker that lacks native blocking falls back to a body convention. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed children — the edge of the known.

A `dev` ticket may block a `po` ticket and vice versa. The common case is a `dev` ticket blocked on a product decision: block it, don't escalate it.

The answer isn't part of the body — it's recorded on resolution. Assets created while resolving a ticket are linked from the issue, not pasted in.

## Ticket methods

- **Decision** (`dev` default): a judgement call you can make from what's already on the map plus what you know. No research, no artifact. Most `dev` tickets are these.
- **Research** (`dev` only): reading documentation, third-party APIs, or local resources to surface a fact a decision waits on. Resolved by a `/research` **subagent**. Use when knowledge outside the current working directory is required — and use it rather than guessing, because "I wasn't sure" is not grounds to escalate.
- **Prototype**: a cheap, rough, concrete artifact to raise the fidelity of the question, via `/prototype`. Two flavours, and the audience label says which: a `po` prototype is a mock the **human reacts to** ("is this what you meant?"); a `dev` prototype is a throwaway spike **you** run to settle feasibility or performance without involving them. Link the artifact from the issue.
- **Grilling** (`po` only): conversation. The default for the human's tickets. Always invoke `/grilling` and `/domain-modeling`.
- **Task**: manual work that must happen before a decision can be made — signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. Nothing to decide; the discussion is blocked until it's done. Drive it alone where you can; where you can't, it becomes a `po` ticket carrying a precise checklist. The answer records what was done and any facts later tickets depend on (where credentials live, new URLs, row counts).

## Resolving a `dev` ticket

The human is trusting you to find the smartest option, not the first one that works. The resolution comment has a mandatory shape, and the shape is what enforces it:

```markdown
## Decision

<the choice, stated plainly>

## Alternatives considered

- <option> — rejected because <reason>
- <option> — rejected because <reason>

## Criterion

<what actually decided it, anchored to a product decision on the map or a cited fact — `file:line`, a doc URL, or a research ticket>

## Consequence

<what this locks in for later tickets — the `locks:` clause the map will carry>
```

Four rules govern it:

1. **Two real alternatives, minimum.** A strawman you never considered is worse than one honest option — if there genuinely was only one viable choice, say so and say why the obvious rivals were never in play.
2. **The criterion traces to something outside your preference.** A product decision on the map, a cited fact, or a measured result. "I like it better" is not a criterion; neither is "it's the standard choice" without saying standard for what.
3. **Boring wins by default.** The option with the fewest moving parts that meets the product decisions on the map. Novelty needs a product reason, not an engineering one.
4. **Reversibility is a tiebreaker.** When two options score the same, take the one that is cheaper to undo.

Then record it: post the comment, **close** the issue, and append a one-line gist plus its `locks:` clause to the map's **Technical decisions**.

## Resolving a `po` ticket

Only in a `--review` session, and only with the human live. You never stand in for their side of it — an agent that answers its own `po` ticket has broken the skill, and every downstream decision built on that invented answer is now wrong.

Invoke `/grilling` and `/domain-modeling`. Ask in their language. When the answer is settled, post it as the resolution comment, close the ticket, append the gist to **Product decisions**, and remove the line from **Waiting on you**.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war** — the decisions you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now.

- **Ticket when** the question is already sharp, even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog: one patch may graduate into several tickets, or none.

Fog graduates into tickets of both audiences, and you assign the audience with the product-owner test like any other question. Graduating product fog is not escalation — it's charting.

## Out of scope

Fog only ever gathers _toward_ the destination. Work beyond the destination is **out of scope**: it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own section — work consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates, so it returns only if the destination is redrawn, and then as a fresh effort.

Ruling something out of scope is a scoping act, not a step on the route. When an existing ticket turns out to sit past the destination, **close it** and leave one line in **Out of scope**: the gist plus why, linking the closed ticket. It stays out of both decision sections, which record the route actually walked.

**Scope belongs to the human.** Deciding *how* is yours; deciding *how much* is theirs. Cutting something from the destination is a `po` ticket, not a call you make while resolving a `dev` ticket.

## Invocation

Three modes.

### The next command

**Every session ends by handing the human the exact next command**, in a fenced block they can copy without editing a character:

```
/helmsman https://github.com/<owner>/<repo>/issues/42
```

The map goes in as its **URL**, not its name — this one block is the exception to [Refer by name](#refer-by-name), because a prompt that has to be edited before it runs is a prompt that doesn't get run. Name the map in the sentence above the block instead.

One line above it says what that session will do; one line below says how much of _their_ time it costs. One command, never a menu — choosing it is your job, not theirs.

Pick it from the frontier **as it stands after this session's writes**, not as you found it:

| Frontier | Next command | Their time |
|---|---|---|
| an unclaimed `dev` ticket exists | `/helmsman <map url>` | none — start it and walk away |
| only `po` tickets left | `/helmsman <map url> --review` | ~<n> min, one answer per open question |
| both empty, fog clear | `/writing-plans` against the map | see [Handing off](#handing-off) |

`dev` work goes first whenever any exists: it costs the human nothing, and it usually shrinks the review that follows by graduating fog into questions worth batching. If you stopped on context rather than on an empty frontier, the next command is still `/helmsman <map url>` — say that it resumes the cascade, and name the ticket it will pick up.

### 1. Chart the map — `/helmsman <loose idea>`

The one session where the human talks a lot. **Ask them no technical question here** — not one, not as a warm-up, not "just so I know". Every technical question this session raises becomes a ticket you will answer yourself.

1. **Name the destination.** Run `/grilling` and `/domain-modeling` to pin down what this map is finding its way to. The destination fixes the scope, so it's settled first, and it's the human's to settle.
2. **Map the frontier.** Grill again, **breadth-first**: fan out across the product space rather than deep on any one thread — what the system does, for whom, under what rules, and what "done" looks like. **If this surfaces no fog** — the way is already clear and the journey fits one session — you don't need a map. Stop and say so.
3. **Create the map** (label `helmsman:map`): Destination and Notes filled in, both decision sections empty, the fog sketched into **Not yet specified**.
4. **Create the tickets you can specify now** as child issues — every question the grilling raised, sorted by the product-owner test, plus the technical questions you already know you owe yourself. Then wire blocking edges in a **second pass** (issues need ids before they can reference each other).
5. **Fire the research subagents.** For each `research` ticket, spin up a `/research` subagent to resolve it in parallel, capturing findings on a throwaway `research/<name>` branch with a context pointer from the ticket.
6. **Refresh "Waiting on you"** and tell the human, in their language: what the map says, how many questions are theirs, how many are yours. Close with [the next command](#the-next-command) — after charting that is almost always `/helmsman <map url>`, since the technical tickets you just wrote yourself are the frontier.

Charting hand-resolves nothing.

### 2. Advance the map — `/helmsman <map>`

The default mode, and the one that runs without the human. **Cascade** until you can't:

1. Load the **map** — the low-res view, not every ticket body. Read **Technical decisions** in full: the `locks:` clauses are the constraints this session must respect.
2. Take the first frontier `dev` ticket in map order. **Claim it** before any work.
3. Resolve it under [Resolving a `dev` ticket](#resolving-a-dev-ticket). **Zoom as needed**: fetch the full body of any related or closed ticket on demand; invoke the skills the **Notes** block names.
4. Record it, close it, append to **Technical decisions**.
5. Graduate whatever fog the answer made specifiable into fresh tickets, clearing each graduated patch from **Not yet specified**. If the answer reveals a ticket sits beyond the destination, rule it out of scope. If it invalidates other tickets, update or delete them.
6. **Loop back to step 2.**

Hitting an escalation does **not** stop the cascade: file the `helmsman:po` ticket, block whatever depends on it, and take the next `dev` ticket. A single money question must not idle the session.

Stop when one of these is true, and only then:

- **The frontier has no unclaimed `dev` ticket left.** The remaining work is the human's.
- **Context is running out.** Stop at a clean ticket boundary, never mid-resolution — a half-recorded decision is worse than an unstarted one.
- **A resolution contradicts a product decision already on the map.** You cannot overturn the human's answer to unblock your own. File a `po` ticket that names the contradiction and stop.

Then refresh **Waiting on you** and report — in the human's language, not the tracker's:

> Decided <n> things this session: <one line each, plain>. <n> questions are waiting on you: <names>.

Then [the next command](#the-next-command). A cascade that stopped on context resumes with the same command, so the human's part is to paste it again — that is what keeps a multi-session map moving without them steering it.

### 3. Review with the human — `/helmsman <map> --review`

Drains **every** open `po` ticket in one conversation, so the human answers a batch instead of opening a session per question.

1. Load the map and query all open `po` tickets. Order them: blockers first, then whatever unblocks the most `dev` tickets.
2. Work them one at a time in conversation, resolving each per [Resolving a `po` ticket](#resolving-a-po-ticket) before moving to the next. Recording as you go means an interrupted session still banks its answers.
3. If an answer graduates product fog, ticket it and add it to this session's queue rather than deferring it.
4. When the queue is empty, refresh **Waiting on you** to empty and tell them what just unblocked — "that unblocks <n> technical questions, and I'll work through them alone" — then [the next command](#the-next-command). This is the hand-back the whole split exists for: they answered what the system should do, and the block they copy sends the how to a session that doesn't need them.

The human may run modes 2 and 3 in any order, and other sessions may be editing the tracker concurrently.

## Handing off

When the frontier is empty in both audiences and **Not yet specified** is clear, the way to the destination is visible: every decision is made and recorded. Say so, and close with [the next command](#the-next-command) one last time — the map is the input to the plan, and both decision sections are the constraints the plan must satisfy:

```
/writing-plans https://github.com/<owner>/<repo>/issues/42
```
