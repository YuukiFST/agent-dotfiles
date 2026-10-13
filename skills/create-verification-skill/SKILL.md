---
name: create-verification-skill
description: "Generate a project-local verify-<app> skill that drives the real app the way a user does (web, CLI/TUI, desktop, service) and proves behavior with evidence. Run as /create-verification-skill."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

# Create a verification skill

Generate a project-local skill that launches the real app, drives a feature the way a user does, and captures evidence.
It lands in `.claude/skills/verify-<app>/`, the one project path both Claude Code and OpenCode load.
Write for the next agent, not for a human: it reads the skill cold, mid-task, with no memory of the app.

## 1. Interview the repo, not the user

Answer these from the codebase, and ask the user only what you cannot observe:

- **Surface:** what does a user touch? A web UI, a CLI/TUI, a desktop app, an API, a library? A repo can have several; pick the primary one and note the rest.
- **Run:** how does the app start locally? Prefer the repo's own dev command (package scripts, Makefile, README quickstart). Note ports, env vars, seed data, auth.
- **Drive:** how can an agent interact with it programmatically? Existing harnesses first: Playwright/Cypress specs, expect scripts, PTY helpers, curl-able endpoints, a debug port. Then the machine's tools:
  - Web UI and Electron: `chrome-devtools-axi`, the only browser automation on these machines; load its skill for command syntax.
  - Web dev server: when `portless doctor` passes, launch through portless for a stable named URL and per-worktree isolation (`portless --help`).
  - CLI: plain process runs, capturing stdout, stderr and exit code. TUI: tmux on NixOS; on Windows, a TUI with no repo harness is a gap to report.
  - Service: plain HTTP with `curl`.
- **Observe:** what evidence can be captured? Screenshots, ARIA snapshots, terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate:** can two instances run side by side (ports, data dirs, profiles)? If not, say so in the generated skill: it refuses to double-drive a shared instance rather than corrupt the user's session.

If the checkout does not build or start as-is, fix that first or report it precisely; a skill written against a broken base teaches wrong steps.
When an irrelevant missing asset blocks startup (a static dir the API never serves, a sample config), the generated skill may create it, marked as verification scaffolding, and remove it in cleanup.

Done when every bullet above has an answer cited to a file, a command output, or the user.

## 2. Generate the skill

Write `.claude/skills/verify-<app>/SKILL.md` with YAML frontmatter: `name: verify-<app>` and a `description` that names the app, the surface, and when to reach for it.
Without frontmatter the skill never registers.
Leave it model-invoked (no `disable-model-invocation`), so an agent finishing a change reaches it on its own.
Write these sections, each grounded in what the interview found, with no placeholders left:

- **Launch:** the exact command that starts the app for verification, how to tell it is ready (a log line, a prompt), and teardown. Launch reaches a usable state from an empty data dir, including migrations and seed data. Ready means usable, not just that a process answers: a database health check can pass while its init scripts still run. For a short-lived CLI or TUI there is no server to keep alive: launch means build the binary (or install deps) once, then start each drive in its own isolated session.
- **Doctor:** one read-only check that answers "is this instance worth driving?": process up, right version or build, port owned by this run, auth valid. An agent runs it first whenever anything looks off.
- **Drive:** the harness recipe with real selectors and commands from this repo, not examples. Prefer stable handles (ARIA roles and names, data attributes, prompt strings, route paths) over coordinates and tab order.
- **Evidence:** what to capture for a proof and where it goes, a gitignored path the skill names. Proof standards: exercise the real user path, not internal setters or test-only endpoints; capture the action and the resulting state, not just the final screen; verify side effects (files written, rows inserted, messages sent) alongside what is visible; mock only where a production boundary already isolates the external system. When the safe path is a dry-run or test mode, observe what it actually skips (files, network, git refs) rather than trust its name: some dry-runs still touch the network or open a browser.
- **Cleanup:** tear down exactly the instances this run started, by the PID, container or session it recorded; killing by process name hits the user's own instances. Cleanup removes instances and scratch state and keeps the evidence at its named path.
- **Helpers:** every script the skill ships is executable, and the skill body shows its invocation. A helper the reader has to reverse-engineer is not a helper.
- **Upkeep:** when a drive fails because the app changed, the agent fixes the feature file in the same change; when the app itself is broken, it reports a product bug and leaves the map as is.

Write the commands so an agent in either harness can run them: shell commands and file paths, no tool names from one harness.

## 3. Seed the feature map

Create `.claude/skills/verify-<app>/features/README.md` plus one file per user-facing feature you can identify: the top 3-5 to start, from routes, commands, menus, or docs.
Follow the shape in [`references/feature-map-example/`](references/feature-map-example/): a README index and one file per feature.
Each file answers, from the user's point of view: what the feature is, how to reach it, how to drive it with the harness, and what observable end state proves it works.
The four H2s are `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`.
If the seed data lacks a precondition a journey needs, the journey reports a failure and the reason goes in that feature's `Gotchas`; keep the journey at full strength rather than weaken it to pass.
The map is the repo's maintained verification source: a proof that drives one convenient entry point is incomplete when the map lists others.

## 4. Prove the generated skill

Run its own instructions end to end once: launch, doctor, drive ONE mapped feature, capture evidence, clean up.
After cleanup, confirm the evidence still exists at the named path; a cleanup that eats the proof fails this step.
Fix what fails, and run the generated cleanup after every failed iteration too, so broken attempts leave no processes or ports behind.
A generated skill that was never executed is a draft, not a deliverable.
If you proved it in a stand-in for the real target (a container in place of a fresh VM, a local stack in place of a remote one), list every setup step the stand-in did that the target will not; those steps stay unverified until a run on the real target covers them.

Done when the run went green once, the evidence survived cleanup, and you report its path, the feature driven, and any stand-in gaps.

Adapted from pstack's [`create-verification-skill`](https://github.com/cursor/plugins/tree/main/pstack/skills/create-verification-skill), MIT, see `LICENSE`.
