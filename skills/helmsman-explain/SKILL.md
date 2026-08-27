---
name: helmsman-explain
description: Build a visual, self-contained HTML explainer of how the /helmsman skill works — the division of labour, the map, the three modes — drawn from the current SKILL.md and rendered against the user's live map when one exists. Use when the user asks how helmsman works, what it does, whether to use it, or invokes /helmsman-explain.
---

The user wants to understand `/helmsman` — a skill whose whole value is a division of labour, which is exactly the kind of thing prose explains badly and a picture explains at a glance. Produce one self-contained HTML page and open it for them.

Two rules give the page its quality, and both matter more than anything you might add:

1. **Never explain helmsman from memory.** Read `helmsman/SKILL.md` at generation time. The page is a rendering of the skill as it exists today, so it cannot drift from it.
2. **Use their real map if they have one.** An abstract example teaches the mechanics; their own destination, their own open questions, their own decisions teach them what to do next. The template ships a worked example for the no-map case — that is the fallback, not the target.

## The artifact

`template.html`, next to this file, is the page: layout, styles, and every diagram, already authored. You **fill slots**, you do not rewrite it. Improvising the HTML each run trades consistent, carefully-drawn diagrams for whatever fits in the turn.

Slots are HTML comment pairs wrapping default content:

```html
<!--SLOT:NAME-->
  <p>default content, valid and viewable as shipped</p>
<!--/SLOT:NAME-->
```

Replace what's **between** the markers; leave the markers in place so the next run can find them. The template is valid and complete as shipped — if there is no live map, the only slot you touch is `GENERATED_AT`.

The page is **self-contained**: inline CSS, inline SVG, inline JS, no CDN, no web font, no network call. It has to open from `file://` on a plane. Keep it that way.

The static copy is Brazilian Portuguese. If the user works in another language, translate the copy as you fill — including the static sections you'd otherwise leave alone.

## Process

1. **Read the source.** Locate `helmsman/SKILL.md` — check `~/.claude/skills/helmsman/`, then the harness-config repo, then a project-local `skills/`. Read it whole. If it isn't installed anywhere, say so and stop; a page explaining a skill the user doesn't have is worse than no page.
2. **Look for a live map.** Consult the tracker doc for the repo (see the "Wayfinding operations" section) and query for open issues labelled `helmsman:map`. No tracker configured, not a repo, or no map found → skip to step 4 and use the shipped example. Exactly one map → use it. More than one → ask which, listing them by title.
3. **Load the map.** Fetch the map body and its child tickets: title, audience label, method label, state, blockers. Bodies of closed tickets are not needed — the map's gists carry them.
4. **Fill the slots** (see below).
5. **Write** to `helmsman-explicado.html` in the current working directory, or `helmsman-<map-slug>.html` when rendering a live map.
6. **Verify before claiming it works** — all three, showing the output:
   - `grep -c 'SLOT:' <file>` returns an even count and no slot name appears with unreplaced placeholder text like `{{`
   - `grep -ciE 'https?://(cdn|fonts|unpkg|cdnjs)' <file>` returns `0` — no external asset crept in
   - the file is over 20KB — a truncated write is the failure mode to catch here
7. **Send it** with `SendUserFile`, `display: "render"`, one line of caption naming what it rendered against ("seu mapa X" or "exemplo ilustrativo").

## The slots

| Slot | Live map | No map |
|---|---|---|
| `GENERATED_AT` | date, and the path of the `SKILL.md` you read | same |
| `BANNER` | "Renderizado a partir do seu mapa: **&lt;title&gt;**" + link | leave default ("exemplo ilustrativo") |
| `STATS` | four counts: product decisions made, technical decisions made, questions waiting on the user, technical tickets on the frontier | leave default |
| `MAP_ANATOMY` | their map body, HTML-escaped inside the annotated block, callout numbers kept aligned to the sections that exist | leave default |
| `TRACE` | their real history: which questions they answered, which the agent decided and on what criterion, what's open | leave default worked example |

Filling `MAP_ANATOMY` and `TRACE`:

- **Escape** `<`, `>`, `&` in anything copied from the tracker. A map body with a `<script>` in it should render as text, not run.
- Keep the callout markup pattern from the default content — the numbered badges are positioned by CSS class, not by hand.
- In `TRACE`, keep the three-session shape (chart → advance → review) even when the user's map hasn't reached the third yet; render the sessions that haven't happened as dimmed with `class="pendente"` so the arc stays visible.
- Preserve the audience colour classes (`.raia-po`, `.raia-dev`) on everything you inject. The colour *is* the explanation on this page.

## What the page has to land

If the reader takes only one thing from it, make it this, and check the filled page still says it plainly:

> Perguntas sobre **o que o sistema faz** são suas. Perguntas sobre **como ele é construído** são do agente. Três exceções — dinheiro, dado pessoal, lock-in — voltam pra você, já com uma recomendação pronta.

Everything else on the page — the map anatomy, the ticket lifecycle, the three modes — is support for that sentence.
