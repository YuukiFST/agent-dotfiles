// Claude Code sessions whose status never reaches the core (a terminal still held by a core
// from before an update reports nothing), so agents() leaves them out. They are found by
// the statusline's context file (~/.claude/state/ctx/<terminal>.json, see insight.js) and
// listed with the status "unknown", so moving one beside another session never hides it.

import * as fs from "fs/promises";
import { home, panes, spaces } from "herdr";

const SCAN_MS = 30000;
// A context file this old belongs to a session that has ended.
const FRESH_MS = 12 * 3600000;

export class SilentAgents {
  constructor(cx) {
    this.dir = `${home()}/.claude/state/ctx`;
    this.claude = new Set();
    this.scan(cx);
    cx.timer.every(SCAN_MS, (cx) => this.scan(cx));
  }

  scan(cx) {
    cx.spawn(async (cx) => {
      const found = new Set();
      try {
        const now = Date.now();
        for (const name of await fs.readdir(this.dir)) {
          const m = /^(t\w+)\.json$/.exec(name);
          if (!m) continue;
          const text = await fs.readFile(`${this.dir}/${name}`, "utf8").catch(() => null);
          let at = 0;
          try {
            const reading = JSON.parse(text?.replace(/^﻿/, "") ?? "{}");
            at = reading.agent ? 0 : reading.at ?? 0; // Another agent's reading says nothing of Claude Code.
          } catch {
            // Mid-write: the next scan reads it.
          }
          if (now - at < FRESH_MS) found.add(m[1]);
        }
      } catch {
        return; // No folder yet: no statusline has written one.
      }
      if ([...found].join() === [...this.claude].join()) return;
      this.claude = found;
      cx.notify();
    });
  }

  // `list` (agents()) plus the silent sessions shown in a pane, each in its tab's place.
  with(list) {
    const listed = new Set(list.map((a) => a.address));
    const silent = panes().filter((p) => p.terminal && this.claude.has(p.terminal) && !listed.has(p.terminal));
    if (!silent.length) return list;
    const claudeProgram = list.find((a) => a.app === "claude-code")?.program;
    const tabOf = new Map(spaces().flatMap((s) => (s.tabs ?? []).map((t, i) => [t.id, { s, t, i }])));
    const order = new Map(panes().map((p, i) => [p.terminal, i]));
    const extra = silent.map((p) => {
      const where = tabOf.get(p.tab);
      return {
        address: p.terminal,
        pane: p.pane,
        space: where?.s.id ?? "",
        space_name: where?.s.name ?? "",
        tab: p.tab,
        tab_index: where?.i ?? 0,
        tab_name: where?.t.name ?? "",
        status: "unknown",
        app: "claude-code",
        program: claudeProgram ?? p.program,
        title: p.title,
        seq: 0,
        pinned: false,
        focused: p.focused,
        silent: true,
      };
    });
    // Keep the model's space, tab, pane order so a space's agents stay together.
    return [...list, ...extra].sort((x, y) => (order.get(x.address) ?? 1e9) - (order.get(y.address) ?? 1e9));
  }
}
