// The median cost per task, for the Cost panel, from the reading cost-sample.mjs leaves.

import { appHome, exec, home, readTextFile } from "herdr";
import { ALL_REPOS, costAnalysis } from "./cost-analysis.js";

const COST_FILE = () => `${home()}/.config/herdr-app/data/claude-cost/cost.json`;
const CHECK_MS = 60000;
const REFRESH_MS = 10 * 60000;
// The first reading walks every transcript, about half a minute; exec stops at 30 s by default.
const SAMPLE_TIMEOUT_MS = 10 * 60000;
const REPO_KEY = "cost.repo";

const parseReading = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next check reads it.
  }
};

export class CostWatch {
  constructor() {
    this.reading = null;
    this.shown = null;
    this.hasFailed = false;
    this.isChecking = false;
    this.checkedAt = 0;
    this.repo = localStorage.getItem(REPO_KEY) ?? ALL_REPOS;
  }

  // Called from render, so nothing runs while the panel is hidden.
  wanted(cx) {
    if (this.isChecking || Date.now() - this.checkedAt < CHECK_MS) return;
    this.isChecking = true;
    cx.timer.after(0, (cx) => this.check(cx));
  }

  check(cx) {
    cx.spawn(async (cx) => {
      this.show(await readTextFile(COST_FILE()).catch(() => null), cx);
      if (Date.now() - (this.reading?.checkedAt ?? 0) >= REFRESH_MS) await this.sample(cx);
      this.checkedAt = Date.now();
      this.isChecking = false;
    });
  }

  // The reading comes from the file: the script's stdout is only a copy of it.
  async sample(cx) {
    const r = await exec("node", [`${appHome()}/mods/agents-edited/cost-sample.mjs`, COST_FILE()], { timeout: SAMPLE_TIMEOUT_MS }).catch(() => null);
    this.hasFailed = r?.code !== 0;
    if (!this.hasFailed) this.show(await readTextFile(COST_FILE()).catch(() => null), cx);
    cx.notify();
  }

  show(text, cx) {
    const reading = parseReading(text);
    if (!reading || reading.checkedAt === this.reading?.checkedAt) return;
    this.reading = reading;
    this.shown = null;
    cx.notify();
  }

  pick(repo, cx) {
    this.repo = repo;
    localStorage.setItem(REPO_KEY, repo);
    this.shown = null;
    cx.notify();
  }

  // Kept until the reading or the repository changes: the board renders far more often than that.
  analysis() {
    if (!this.reading) return null;
    this.shown ??= costAnalysis(this.reading, this.repo);
    return this.shown;
  }
}
