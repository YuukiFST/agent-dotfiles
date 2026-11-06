// The Claude plan usage every view shows, from the file usage-sample.mjs leaves. Whichever view is
// due runs the script, so several windows stay within the endpoint's rate limit.
// The same file lives in claude-usage and agents-edited: a mod cannot import outside its folder.

import { exec, readTextFile, appHome, home } from "herdr";

const CHECK_MS = 30000;
const REFRESH_MS = 5 * 60000;
const USAGE_FILE = () => `${home()}/.config/herdr-app/data/claude-usage/plan-usage.json`;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad2 = (n) => String(n).padStart(2, "0");

function remaining(seconds) {
  const m = Math.max(0, Math.round(seconds / 60));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${pad2(m % 60)}`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}

// resetsAt: epoch seconds. "3d5h".
export const timeLeft = (resetsAt) => remaining(resetsAt - Date.now() / 1000);

// resetsAt: epoch seconds. "resets Sun 15:59 · in 3d5h".
export function resetsText(resetsAt) {
  const d = new Date(resetsAt * 1000);
  return `resets ${WEEKDAYS[d.getDay()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())} · in ${remaining(resetsAt - Date.now() / 1000)}`;
}

const parseReading = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next check reads it.
  }
};

export class PlanUsage {
  constructor(cx) {
    this.reading = null;
    this.readingText = null;
    this.isFetching = false;
    this.check(cx);
    cx.timer.every(CHECK_MS, (cx) => this.check(cx));
  }

  show(text, cx) {
    const reading = parseReading(text);
    if (!reading || text === this.readingText) return;
    this.reading = reading;
    this.readingText = text;
    cx.notify();
  }

  check(cx) {
    cx.spawn(async (cx) => {
      this.show(await readTextFile(USAGE_FILE()).catch(() => null), cx);
      if (this.isFetching || Date.now() - (this.reading?.checkedAt ?? 0) < REFRESH_MS) return;
      this.isFetching = true;
      const r = await exec("node", [`${appHome()}/mods/claude-usage/usage-sample.mjs`, USAGE_FILE()]).catch(() => null);
      this.isFetching = false;
      if (r?.code === 0) this.show(r.stdout, cx);
    });
  }

  windowOf(kind) {
    return this.reading?.windows?.find((w) => w.kind === kind) ?? null;
  }
}
