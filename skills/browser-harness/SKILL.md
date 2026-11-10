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

- The first connection to the user's Chrome needs a one-time tick at `chrome://inspect/#remote-debugging` and an Allow click, both by the user. When `browser-harness --doctor` does not report `daemon alive`, ask the user for that step instead of retrying.
