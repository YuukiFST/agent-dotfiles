# Vendored skills — provenance and refresh

Most of `skills/` is copied from upstream repos rather than written here.
This file records where each set came from and what a refresh has to re-apply.

## Upstream sets

| Upstream | Skills |
|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) (at `v1.2.0`, which renamed `writing-great-skills` → `writing-for-agents`) | `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grilling`, `handoff`, `improve-codebase-architecture`, `loop-me`, `prototype`, `research`, `setup-matt-pocock-skills`, `teach`, `wayfinder`, `writing-for-agents` |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | `animate`, `animation-vocabulary`, `apple-design`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `pick-ui-library`, `review-animations` |
| [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | `interface-review` (live); `better-interface`, `better-accessibility`, `better-layout`, `better-writing`, `better-typography`, `better-colors`, `better-ui` (archived in `stacks/frontend/`) |
| [kitlangton/skills](https://github.com/kitlangton/skills/tree/main/skills/effect) | `effect` (archived in `stacks/effect/`) |
| [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) | `no-ai-slop` |
| [obra/superpowers](https://github.com/obra/superpowers) | `brainstorming`, `systematic-debugging`, `writing-plans`, `executing-plans`, `verification-before-completion` (five skills only; plugin/package removed) |
| vercel-labs | `find-skills` |
| secondsky | `tailwind-v4-shadcn` |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `impeccable` (archived in `stacks/frontend/`; live pi install uses `.pi/skills/impeccable`) |

This repo is the only source of Matt's skills on this machine: anything of his that is not
vendored here is uninstalled from the harnesses, not left floating in `~/.claude/skills`.
`wayfinder` sets the floor for which of his skills stay — it dispatches to `research`,
`prototype`, `grilling` and `domain-modeling`, and points at `setup-matt-pocock-skills` for the
per-repo issue-tracker config.

## Refreshing

Refresh the ones the skills CLI still tracks with `npx skills update -g -y` (writes
`~/.agents/skills`), then copy the updated folders back into `skills/`. `grilling`,
`setup-matt-pocock-skills` and `wayfinder` are no longer in `~/.agents/.skill-lock.json`, so they
refresh by hand from a clone of the upstream repo.

Either way, drop each upstream `agents/` dir and `openai.yaml` — this repo does not vendor them.

`impeccable` refreshes from upstream `.pi/skills/impeccable` (not `.agents/skills/impeccable`).
After cloning the repo at the tag or commit you want:

```bash
rm -rf stacks/frontend/skills/impeccable
cp -r /path/to/impeccable/.pi/skills/impeccable stacks/frontend/skills/impeccable
```

Live pi harness: from `~/.pi/agent`, run
`npx impeccable skills install -y --providers=pi --scope=project`.

## Local tweaks a refresh must re-apply

- `disable-model-invocation: true` on `find-skills`, on every Emil skill in the frontend pipeline
  (`animate`, `apple-design`, `emil-design-eng`, `find-animation-opportunities`,
  `improve-animations`) and on the whole Jakub set — that pipeline is opt-in per
  `rules/frontend.md`, so the model must not self-trigger it.
- `pick-ui-library` carries a local Decorative-effects section (`border-beam`, `thinking-orbs`).
- `emil-design-eng` keeps the Radix `transform-origin` variants upstream dropped.
