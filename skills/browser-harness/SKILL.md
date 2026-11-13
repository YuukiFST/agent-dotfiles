---
name: browser-harness
description: "Control a real browser via CDP: clicking, typing, navigation, logged-in sessions, JS-rendered or bot-protected pages. Not for plain HTTP fetches of public content - use curl for those."
---
<!-- Source: https://github.com/browser-use/browser-harness/blob/main/SKILL.md (MIT, notice in LICENSE); reduced to a pointer at `browser-harness skill`, which prints that file for the installed version, plus the local rules -->

# browser-harness

Direct control of the user's Chrome via CDP.

## When not to use

A basic fetch of public information needs no browser: if a plain HTTP request can read it (a public page, an API, docs), use `curl` or your fetch tool.
Use browser-harness when the task needs interaction (click, type, navigate), the user's logged-in session, JS rendering, or a bot-protected page, and escalate to it when a direct fetch fails or returns a shell page.
Performance traces, Lighthouse and DevTools debugging belong to the `chrome-devtools-axi` skill.

## Current guidance lives in the CLI

Run `browser-harness skill` before the first browser call of a task and follow what it prints: the full workflow, helpers, tab rules, gotchas and domain skills for the installed version, so it never goes stale.
`browser-harness --help` lists the commands.

## Local rules

These cover upstream guidance newer than the PyPI release that `browser-harness skill` prints; drop each once that text carries it.

- The first connection to the user's Chrome needs a one-time tick at `chrome://inspect/#remote-debugging` and an Allow click, both by the user. When `browser-harness --doctor` does not report `daemon alive`, ask the user for that step and keep the waiting command running instead of rerunning it.
- **One daemon:** omit `BU_NAME` and reuse the default daemon across sites, tabs and tasks; each new local daemon opens another CDP connection and another Allow prompt. Several agents share it by taking turns.
- **Stay in the background:** call `activate_tab()` only when the user asks to see that tab, since it brings Chrome to the foreground. For a page that pauses while hidden, wrap the step in `cdp("Emulation.setFocusEmulationEnabled", enabled=True)` and disable it in a `finally`.
- **Raw CDP params are keywords:** `cdp("Input.insertText", text="hello")`; the second positional argument is a session ID.
- At task end, close the tabs the task opened unless the user still needs them.
