---
name: browser-use
description: "Control a real browser via CDP: clicking, typing, navigation, logged-in sessions, JS-rendered or bot-protected pages. Not for plain HTTP fetches of public content - use curl for those."
---
<!-- Source: https://github.com/browser-use/browser-use/blob/main/browser_use/skills/browser-use/SKILL.md (MIT, notice in LICENSE); reduced to a pointer at `browser-use skill`, which prints that file for the installed version, plus the local rules -->

# browser-use

Direct control of the user's Chrome via CDP, through the `browser-use` CLI (the browser-harness engine).

## When not to use

A basic fetch of public information needs no browser: if a plain HTTP request can read it (a public page, an API, docs), use `curl` or your fetch tool.
Use browser-use when the task needs interaction (click, type, navigate), the user's logged-in session, JS rendering, or a bot-protected page, and escalate to it when a direct fetch fails or returns a shell page.
Performance traces, Lighthouse and DevTools debugging belong to the `chrome-devtools-axi` skill.

## Current guidance lives in the CLI

Run `browser-use skill` before the first browser call of a task and follow what it prints: the full workflow, helpers, tab rules, gotchas and domain skills for the installed version, so it never goes stale.
`browser-use --help` lists the commands and `browser-use --doctor` checks the install, daemon and browser.
Never run `browser-use skill install`: it writes its own copy into every agent's skills dir, which this repo's sync owns.
Cloud browsers, `browser-use login` and the Python library's own agent need a Browser Use account; use them only when the user asks.

## Local rules

These cover gaps in the text `browser-use skill` prints; drop each once that text carries it.

- The first connection to the user's Chrome needs a one-time tick at `chrome://inspect/#remote-debugging` and an Allow click, both by the user, on every OS. When the call reports the connection pending or `permission-blocked`, ask the user for that step and keep one waiting command running instead of rerunning it.
- **Raw CDP params are keywords:** `cdp("Input.insertText", text="hello")`; the second positional argument is a session ID.
- At task end, close the tabs the task opened unless the user still needs them.
