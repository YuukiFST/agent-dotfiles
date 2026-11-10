# Chart

Reached from `/helmsman <idea>`.

The one session that starts from nothing, and the only open questions are ones that passed the ask test.

1. **Read the brief.** Pull out the problem it solves, the people it serves, the destination, and every given. In an existing repo, read the subsystem the brief touches, per step 1 of `../yuu-mode/playbooks/investigation.md`. Done when each given is written down for **Notes**.
2. **Create the plan pack** per [The plan pack](SKILL.md#the-plan-pack). A plan branch or map already holding this effort means an earlier Chart died: resume from its banked answers and duplicate nothing. Done when the plan branch exists.
3. **Draft the product yourself.** Write the destination, the users, the core flows and their rules as you would build them. Sweep for the gaps a first draft forgets: who can do what, the data's life (creation, export, deletion), failure and empty paths, abuse, notifications, payments, languages and accessibility, expected scale, existing data to migrate, backups, and what shows the operator it broke. Answer every gap yourself, then run the ask test on each answer; most become assumptions. Done when every gap is an assumption, a question that passed the ask test, a `dev` ticket to file, or a **Coverage** line saying why it does not apply.
4. **Send the first packet** per [PACKET.md](PACKET.md). Its `intro` is your restatement, in two to four lines of their language: the problem and who has it, the goals that will show it is solved, and the destination you would build, so the human can correct the whole picture at once, the why as well as the what.
5. **Send further packets** only for questions the last answers unlocked that pass the ask test, within the cap. Done when no open question passes the ask test, or the cap is hit.
6. **Create the map** (label `helmsman:map`) per [MAP.md](MAP.md) with Problem and goals, Destination, Notes, Product decisions, and Assumed filled in, and the fog sketched into **Not yet specified**. Record the vocabulary in `CONTEXT.md` on the plan branch through `/domain-modeling`, and again whenever a later resolution adds a term.
7. **Create the tickets you can specify now** as child issues, sorted by the experience test, including every technical question you already know you owe yourself. Wire blocking edges in a **second pass**, once every issue has an id.
8. **Fire the research subagents**: one `/research` subagent per `research` ticket, in parallel (see [Ticket methods](SKILL.md#ticket-methods) for where findings go).
9. **Tell the human** in their language what the map says, opening with the problem and goals as the answers left them, and that the rest is yours until the look needs their eye, so they can step away; a correction to that restatement rewrites **Problem and goals** and is handled like a veto, as a `po` ticket that routes to a review (see [The ask test](SKILL.md#the-ask-test)). Then **continue straight into [Advance](ADVANCE.md)** in this same session.

If drafting shows the whole project fits one session with nothing left to decide, skip the cascade after step 6: go to Design when it has an interface, then write the spec.
