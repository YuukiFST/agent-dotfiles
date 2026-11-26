// Herdr marks a session done when its turn ends, even with background shells or agents still
// running. The statusline (~/.claude/hooks/statusline.ps1) counts those in
// ~/.claude/state/ctx/<terminal>.json as `background`; the agents list (agents-edited
// withBackground) already shows such a session as working. Same rule here, so a space's
// session row does not say done while its agents run.

import { home, readTextFile, terminals, watchFolder } from "herdr";

const RELOAD_MS = 30000;
// A count this old lost its end notice: stop believing it (as in agents-edited/insight.js).
const TRUST_MS = 3 * 3600000;

export class BackgroundWork {
  constructor(cx) {
    this.dir = `${home()}/.claude/state/ctx`;
    this.byTerminal = {}; // terminal -> { background, at }
    this.reload(cx);
    cx.timer.every(RELOAD_MS, (cx) => this.reload(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        try {
          await watchFolder(this.dir);
        } catch {
          return; // No folder yet: the timer reads it once the statusline makes it.
        }
        this.reload(cx);
      }
    });
  }

  reload(cx) {
    cx.spawn(async (cx) => {
      const next = {};
      for (const { address } of terminals()) {
        if (!address || address.includes("/")) continue; // Remote terminals have no file here.
        const text = await readTextFile(`${this.dir}/${address}.json`).catch(() => null);
        if (!text) continue;
        try {
          const { background = 0, at = 0 } = JSON.parse(text.replace(/^﻿/, ""));
          if (background > 0) next[address] = { background, at };
        } catch {
          if (this.byTerminal[address]) next[address] = this.byTerminal[address]; // Mid-write: keep the last reading.
        }
      }
      if (JSON.stringify(next) === JSON.stringify(this.byTerminal)) return;
      this.byTerminal = next;
      cx.notify();
    });
  }

  // `status` as the core reports it, raised to "working" while background work runs.
  status(terminal, status) {
    const r = this.byTerminal[terminal];
    const running = r && Date.now() - r.at < TRUST_MS;
    return running && (status === "done" || status === "idle") ? "working" : status;
  }
}
