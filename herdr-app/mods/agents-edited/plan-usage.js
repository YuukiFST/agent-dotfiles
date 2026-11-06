// The Claude plan usage and token spend every view shows, from the files usage-sample.mjs and
// tokens-sample.mjs leave. Whichever view is due runs the script, so several windows share one
// reading and stay within the endpoint's rate limit.
// The same file lives in claude-usage and agents-edited: a mod cannot import outside its folder.

import { exec, readTextFile, appHome, home } from "herdr";

const CHECK_MS = 30000;
const REFRESH_MS = 5 * 60000;
const TOKENS_REFRESH_MS = 2 * 60000;
const USAGE_FILE = () => `${home()}/.config/herdr-app/data/claude-usage/plan-usage.json`;
const TOKENS_FILE = () => `${home()}/.config/herdr-app/data/claude-usage/tokens.json`;
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

export function tokenCount(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${(n / 1e3).toFixed(1)}k`;
}

function dateTimeText(at) {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// period: one of the tokens.json periods. Cache reads are most of the total, so it stays visible.
export const tokenBreakdown = (period) => [
  `since ${dateTimeText(period.since)}`,
  `input ${tokenCount(period.input)}`,
  `output ${tokenCount(period.output)}`,
  `cache write ${tokenCount(period.cacheWrite)}`,
  `cache read ${tokenCount(period.cacheRead)}`,
].join(" · ");

const parseReading = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next check reads it.
  }
};

class SharedReading {
  constructor(cx, file, script, refreshMs) {
    this.file = file;
    this.script = script;
    this.refreshMs = refreshMs;
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
      this.show(await readTextFile(this.file).catch(() => null), cx);
      if (this.isFetching || Date.now() - (this.reading?.checkedAt ?? 0) < this.refreshMs) return;
      this.isFetching = true;
      const r = await exec("node", [`${appHome()}/mods/claude-usage/${this.script}`, this.file]).catch(() => null);
      this.isFetching = false;
      if (r?.code === 0) this.show(r.stdout, cx);
    });
  }
}

export class TokenUsage extends SharedReading {
  constructor(cx) {
    super(cx, TOKENS_FILE(), "tokens-sample.mjs", TOKENS_REFRESH_MS);
  }
}

export class PlanUsage extends SharedReading {
  constructor(cx) {
    super(cx, USAGE_FILE(), "usage-sample.mjs", REFRESH_MS);
  }

  windowOf(kind) {
    return this.reading?.windows?.find((w) => w.kind === kind) ?? null;
  }
}
