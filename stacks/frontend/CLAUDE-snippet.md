# CLAUDE.md conditional rules — frontend stack (archived)

Paste these lines back into `CLAUDE.md` under `## Conditional rules` when re-enabling the frontend stack.
Also run `bash scripts/stack.sh enable frontend` (or copy `stacks/frontend/skills/*` into `skills/` and `rules/frontend.md` into `rules/`).

- **Frontend/UI work — ON EXPLICIT REQUEST ONLY** → `~/.claude/rules/frontend.md` (skill pipeline, phases, minimum bar). Read it only when the user names it ("siga o frontend.md", "use o pipeline de frontend", "/goal com o fluxo de front"). Otherwise SKIP — do UI work with normal judgement and the project's own Design System.
- **Choosing a frontend library** (toasts, dialogs/menus/popovers, ⌘K palette, OTP input, charts, drag and drop, virtualization, animated numbers, state, className helpers, dark mode) — or about to hand-roll one of those → read `~/.claude/skills/pick-ui-library/SKILL.md` first (user-invoked skill, not in the catalog), even outside the frontend pipeline. Reuse what `package.json` already has before adding a dependency.
