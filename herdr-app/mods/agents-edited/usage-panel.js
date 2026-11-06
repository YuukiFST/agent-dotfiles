// The middle of the status dashboard: the Claude plan's limits and the machine's load.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { home, readTextFile } from "herdr";
import { PlanUsage, resetsText, timeLeft } from "./plan-usage.js";

const NUMBER_FONT = "Geist Mono";
const SAMPLE_MS = 5000;
// The footer of every layout keeps this file current (mods/claude-usage/system-sample.mjs).
const SAMPLE_FILE = () => `${home()}/.config/herdr-app/data/claude-usage/system-sample.json`;
const SAMPLE_STALE_MS = 30000;
const READING_STALE_MS = 15 * 60000;
const GIB = 1073741824;
const METER_BLOCKS = 10;
const LABEL_WIDTH = 42;
const PERCENT_WIDTH = 34;
const DETAIL_WIDTH = 78;

const parseSample = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next read gets it.
  }
};

export class UsagePanel {
  constructor(cx) {
    this.plan = new PlanUsage(cx);
    this.sample = null;
    this.shownSample = null;
    this.readSample(cx);
    cx.timer.every(SAMPLE_MS, (cx) => this.readSample(cx));
  }

  readSample(cx) {
    cx.spawn(async (cx) => {
      const sample = parseSample(await readTextFile(SAMPLE_FILE()).catch(() => null));
      const fresh = sample?.totalKb && Date.now() - sample.at < SAMPLE_STALE_MS ? sample : null;
      const shown = fresh && [fresh.cpu, Math.round(fresh.freeKb / 10486), Math.round(fresh.diskFree / GIB)].join();
      if (shown === this.shownSample) return;
      this.shownSample = shown;
      this.sample = fresh;
      cx.notify();
    });
  }
}

function gauge(t, label, pct, detail, tooltip) {
  const warning = pct >= 90 ? t.blocked : pct >= 70 ? t.ansi3 : null;
  // Anything above zero lights a block: 3% of the week must not read as unused.
  const lit = pct > 0 ? Math.max(1, Math.round(METER_BLOCKS * Math.min(pct, 100) / 100)) : 0;
  const blocks = Array.from({ length: METER_BLOCKS }, (_, i) =>
    div().flex_1().h(10).rounded(1).bg(i < lit ? warning ?? t.accent : t.border));
  return h_flex().id(`usage-${label}`).flex_1().min_h(24).px(12).gap(8).items_center().text_size(11)
    .when(Boolean(tooltip), (el) => el.tooltip(tooltip))
    .child(div().w(LABEL_WIDTH).flex_none().truncate().text_size(12).text_color(t.muted).child(label))
    .child(h_flex().flex_1().min_w(0).gap(2).items_center().children(blocks))
    .child(div().w(PERCENT_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(warning ?? t.foreground).child(`${Math.round(pct)}%`))
    .child(div().w(DETAIL_WIDTH).flex_none().flex().justify_end().text_color(t.dim).child(div().truncate().child(detail)));
}

function sectionTitle(t, title, note) {
  return h_flex().h(26).flex_none().px(12).gap(6).items_center().text_size(11).text_color(t.dim)
    .child(div().flex_none().font_medium().child(title))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().child(note)));
}

function planGauge(t, win) {
  const isRenewed = win.resetsAt <= Date.now() / 1000;
  if (isRenewed) return gauge(t, win.label, 0, "renewed");
  return gauge(t, win.label, win.percent, win.resetsAt ? timeLeft(win.resetsAt) : "", win.resetsAt ? resetsText(win.resetsAt) : "");
}

function planNote({ plan, at, error }) {
  const age = Date.now() - (at ?? 0);
  return [plan, error, at && age > READING_STALE_MS && `as of ${Math.round(age / 60000)}m ago`].filter(Boolean).join(" · ");
}

function machineGauges(t, sample) {
  const usedKb = sample.totalKb - sample.freeKb;
  const toGb = (kb) => kb / 1048576;
  return [
    gauge(t, "CPU", sample.cpu, ""),
    gauge(t, "RAM", 100 * usedKb / sample.totalKb, `${toGb(usedKb).toFixed(1)}/${toGb(sample.totalKb).toFixed(0)} GB`),
    gauge(t, "Disk", sample.diskSize ? 100 * (sample.diskSize - sample.diskFree) / sample.diskSize : 0, `${(sample.diskFree / GIB).toFixed(0)} GB free`),
  ];
}

export function usagePanel(t, panel) {
  const reading = panel.plan.reading;
  const windows = reading?.windows ?? [];
  const waiting = (text) => div().px(12).pb(6).text_size(11).text_color(t.dim).child(text);
  const section = () => v_flex().flex_grow_1().pb(4);
  return v_flex().flex_1().rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
    .child(section()
      .child(sectionTitle(t, "Claude", reading ? planNote(reading) : ""))
      .children(windows.length ? windows.map((w) => planGauge(t, w)) : [waiting(reading?.error ?? "Reading the plan…")]))
    .child(div().h(1).flex_none().bg(t.border))
    .child(section()
      .child(sectionTitle(t, "Machine", ""))
      .children(panel.sample ? machineGauges(t, panel.sample) : [waiting("No reading yet")]));
}
