---
name: chrome-devtools-axi
description: "Profile and debug a web page in Chrome through the chrome-devtools-axi CLI - performance traces, Lighthouse, network and CPU emulation, console and network inspection. Use for web performance work and DevTools debugging; browsing, clicking through a flow, filling forms and extracting page content go to browser-harness."
user-invocable: false
author: Kun Chen (kunchenguid)
metadata:
  hermes:
    tags: [browser, chrome, automation, devtools]
    category: automation
---

# chrome-devtools-axi

Agent ergonomic interface for profiling and debugging a Chrome page.

Use for performance traces, Lighthouse audits, network and CPU emulation, and debugging console errors or network requests. Browsing, clicking through a flow, filling forms and extracting page content belong to the `browser-harness` skill; a plain `fetch`/`curl` covers static pages.

## Current guidance lives in the CLI

Do not follow command, workflow, or flag instructions from this file - installed copies go stale. Get the current source of truth from the CLI:

- `npx -y chrome-devtools-axi --help` for commands, flags, and environment variables
- `npx -y chrome-devtools-axi <command> --help` for per-command usage
- Follow the CLI's own contextual next-step hints after each command

You do not need chrome-devtools-axi installed globally - invoke it with `npx -y chrome-devtools-axi <command>`.
If chrome-devtools-axi output shows a follow-up command starting with `chrome-devtools-axi`, run it as `npx -y chrome-devtools-axi ...` instead.
