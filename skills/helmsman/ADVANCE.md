# Advance

Reached from `/helmsman <map>`, or straight from Chart in the same session.

The default mode, and the one that runs without the human.
**Cascade** until you can't:

0. **Spec check.** When no decision ticket is open in either audience, claimed or not, graduate whatever is left in **Not yet specified** (into tickets, assumptions, or **Out of scope**). If that leaves no open decision ticket and **Spec** is not marked `complete`: with an interface and an empty **Design**, stop and hand over `--design`; otherwise read [SPEC.md](SPEC.md) and follow it, then stop. Otherwise go on.
1. Load the **map**, the low-res view, not every ticket body. Read **Notes** and **Technical decisions** in full: the givens and `locks:` clauses are the constraints this session respects.
2. Take the first frontier `dev` ticket in map order. **Claim it** before any work.
3. Resolve it under [Resolving a `dev` ticket](SKILL.md#resolving-a-dev-ticket); a `research` ticket goes to a `/research` subagent, and you take the next ticket while it runs. Fetch the full body of any related or closed ticket on demand; apply the matching [SKILLS.md](SKILLS.md) rows and the skills **Notes** names.
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

Then [the next command](SKILL.md#the-next-command).
