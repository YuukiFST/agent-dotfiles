// Keeps OpenCode sessions' context readings current through ./opencode-sample.mjs, which writes
// the files the rest of this mod reads for Claude Code (~/.claude/state/ctx, see insight.js).
// A reading only changes with the session, so a terminal is sampled when its status or title
// changes, and on a slower beat while it works.
import { agents, appHome, exec, panes } from "herdr";

const TICK_MS = 2000;
const WORKING_SAMPLE_MS = 15000;

export class OpenCodeContext {
  constructor(cx) {
    this.script = `${appHome()}/mods/agents-edited/opencode-sample.mjs`;
    this.lastOf = {};
    this.running = new Set();
    cx.timer.every(TICK_MS, (cx) => this.tick(cx));
  }

  tick(cx) {
    const now = Date.now();
    for (const a of agents()) {
      if (a.app !== "opencode" || a.address.includes("/") || this.running.has(a.address)) continue;
      const shown = `${a.status}\u0000${a.title}`;
      const last = this.lastOf[a.address];
      const stale = a.status === "working" && now - (last?.at ?? 0) >= WORKING_SAMPLE_MS;
      if (last?.shown === shown && !stale) continue;
      const cwd = panes().find((p) => p.terminal === a.address)?.cwd;
      if (!cwd) continue;
      this.lastOf[a.address] = { shown, at: now };
      this.sample(a.address, a.title, cwd, cx);
    }
  }

  sample(address, title, cwd, cx) {
    this.running.add(address);
    cx.spawn(async () => {
      try {
        await exec("node", [this.script, address, title, cwd]);
      } catch {
        // node missing or the database busy: the next change samples again.
      } finally {
        this.running.delete(address);
      }
    });
  }
}
