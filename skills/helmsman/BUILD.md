# Build

Reached from `/helmsman <map> --build`, in a fresh session.
The goal is the whole spec working on one **integration branch**, every build ticket closed, and a reviewed pull request waiting for the human.
The human answered the product questions and the map holds every technical decision, so this phase runs alone: the commit identity, and what to do with the human's own uncommitted changes when there are any, are the only things it asks.

The build tickets are a **task graph**, not a list: there is always a **frontier** of tickets whose blockers are all closed.
Talk to subagents through **context pointers** (the spec, the ticket, the map, a commit) rather than pasted copies.

## Steps

1. **Load.** Read the map's **Notes** and **Technical decisions**, the spec, and the open build tickets (the spec's children labelled `helmsman:build`). Done when you can name the frontier.
2. **Confirm the commit identity** per `~/.claude/rules/git.md`. In an existing repo, when `git status --porcelain` lists changes outside helmsman's own files (`.scratch/`, `CONTEXT.md`), ask in the same message whether to commit them before the build starts or to run the build in a worktree of its own, so its commits and suite runs never take them in. These are the only questions this phase asks up front; then work without the human.
3. **Prepare the workspace.** When the directory is not a repo yet, `git init` and make an initial commit on the default branch, so branches and worktrees have a base. Create the integration branch off the default branch, named per `git-workflow`: `feat/<spec-number>-<slug>`, or `feat/<effort-slug>` on the local tracker, where the spec has no number. A session resuming the build checks out the existing integration branch instead.
4. **Build the walking skeleton** (the first build ticket) alone, before anything else: every other ticket builds on it.
5. **Work the frontier.** Claim each frontier ticket and hand it to an **implementer subagent** in its own worktree, on its own branch off the integration branch; independent tickets run in parallel in the background. A harness without subagents works the frontier one ticket at a time, inline. Each implementer:
   - builds the ticket to its acceptance criteria, with E2E tests at the interface the spec's testing decisions name, per `~/.claude/CODING_STANDARDS.md`;
   - gets the project's tests, lint and typecheck green, and round-trips each schema migration it adds (down, then up) on a database private to its worktree, or says in its report that the migration tool is forward-only;
   - commits per `~/.claude/rules/git.md`, merges the integration branch tip into its own branch, and reports what it verified.
6. **Land each ticket.** Merge the finished branch into the integration branch, rerun the suite, and close the ticket with a comment saying what now works and how it was verified. Then remove its worktree and delete its branch, in the removal order of "Leave no trace" in `~/.claude/CODING_STANDARDS.md`; a worktree that refuses stays and goes in the report. Recompute the frontier and dispatch the newly unblocked tickets.
7. **Handle gaps without stopping.**
   - A product gap goes through the ask test: assume it and add it to the map's **Assumed**, or file a `po` ticket, block the build tickets that depend on it, and keep building the rest.
   - A technical gap is a decision: settle it under the rules for resolving a `dev` ticket and append it to **Technical decisions**.
   - A dependency or service that costs money is a **Money** escalation, never a quiet purchase.
   - A ticket that stays red after two attempts on the same error, or a merge conflict you can't resolve without guessing at intent, is **stuck**: release its claim, file a `po` `task` ticket that shows the error and asks the human one question, block the stuck ticket on it, and keep building the tickets that don't depend on it. A suite that goes red after landing is fixed before the next ticket lands.
8. **Review and open the PR.** When no build ticket is left, push the integration branch and open a pull request (a merge request on GitLab) to the default branch that closes the spec and its build tickets, per `git-workflow`. Run `/interrogate` on it with the spec as the statement of intent, fix what it says to act on, rerun the suite, and record the verdict on the PR. On the local tracker, with no remote, skip the PR and report the branch.
9. **Leave no trace.** Every worktree, dev server and scratch directory this session created is removed or stopped, or named in the report with the reason it stays.

Merging into the default branch and going live are the human's calls; the phase ends at a reviewed PR, with the deploy command, the command that undoes it, and the smoke check to run right after it (a health URL, the critical flow) ready in the report.

## Stopping

Stop when one of these is true, and only then:

- **Every build ticket is closed** and the PR is open.
- **Context is running out.** Stop between tickets, with every finished branch landed and every unfinished claim released.
- **Every remaining build ticket is blocked** by a `po` ticket.

Report in the human's language: what works now, the one command that runs it, and what is waiting on them, stuck tickets included.
Then [the next command](SKILL.md#the-next-command).
