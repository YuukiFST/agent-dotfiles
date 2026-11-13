import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, readTextFile, home, appHome, theme, props } from "herdr";
import { PlanUsage, TokenUsage, resetsText, tokenBreakdown, tokenCount } from "./plan-usage.js";

// Both windows show the same machine: a reading this recent came from the other one.
const SAMPLE_FRESH_MS = 4000;
const SAMPLE_FILE = () => `${home()}/.config/herdr-app/data/claude-usage/system-sample.json`;
const isNetworkOnly = () => props()?.only === "network";
const METER_BLOCKS = 10;

function rate(bytesPerSec) {
  if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)}M`;
  return `${Math.round(bytesPerSec / 1024)}K`;
}

export default class ClaudeUsage extends View {
  init(_props, cx) {
    this.system = null;
    this.loadSystem(cx);
    cx.timer.every(5000, (cx) => this.loadSystem(cx));
    if (props()?.only === "system" || isNetworkOnly()) return;
    this.planUsage = new PlanUsage(cx);
    this.tokenUsage = new TokenUsage(cx);
    // Countdowns move once a minute; 30 s keeps them within half a minute.
    cx.timer.every(30000, (cx) => cx.notify());
  }

  async readSample() {
    try {
      const sample = JSON.parse((await readTextFile(SAMPLE_FILE())) ?? "null");
      if (sample && Date.now() - sample.at < SAMPLE_FRESH_MS) return sample;
    } catch {
      // Being replaced: take a reading instead.
    }
    const r = await exec("node", [`${appHome()}/mods/claude-usage/system-sample.mjs`, SAMPLE_FILE()]).catch(() => null);
    return r?.code === 0 ? JSON.parse(r.stdout) : null;
  }

  loadSystem(cx) {
    cx.spawn(async (cx) => {
      const sample = await this.readSample();
      if (!sample?.totalKb) return;
      const { cpu, freeKb, totalKb, diskFree, diskSize, rx, tx } = sample;
      const system = {
        cpu,
        usedGb: (totalKb - freeKb) / 1048576,
        totalGb: totalKb / 1048576,
        diskFreeGb: diskFree / 1073741824,
        diskPct: diskSize ? 100 * (diskSize - diskFree) / diskSize : 0,
        rx,
        tx,
      };
      // A redraw repaints the whole window: only for a change the footer would show.
      const shown = (isNetworkOnly() ? [rate(rx), rate(tx)] : [Math.round(cpu), Math.round(100 * system.usedGb / system.totalGb), system.usedGb.toFixed(1),
        system.totalGb.toFixed(0), Math.round(system.diskPct), system.diskFreeGb.toFixed(0), rate(rx), rate(tx)]).join();
      if (shown === this.shownSystem) return;
      this.shownSystem = shown;
      this.system = system;
      cx.notify();
    });
  }

  meter(t, label, pct) {
    const warning = pct >= 90 ? t.blocked : pct >= 70 ? t.ansi3 : null;
    // Anything above zero lights a block: 3% of the week must not read as unused.
    const lit = pct > 0 ? Math.max(1, Math.round(METER_BLOCKS * Math.min(pct, 100) / 100)) : 0;
    const blocks = Array.from({ length: METER_BLOCKS }, (_, i) =>
      div().w(6).h(10).rounded(1).bg(i < lit ? warning ?? t.accent : t.border));
    return h_flex().gap(6).items_center()
      .child(div().text_color(t.dim).child(label))
      .child(div().text_color(warning ?? t.foreground).child(`${Math.round(pct)}%`))
      .child(h_flex().gap(2).items_center().children(blocks));
  }

  window(t, label, win) {
    if (!win) return div().text_color(t.dim).child(`${label} —`);
    // The file keeps a window past its reset until the next reading.
    if (win.resetsAt <= Date.now() / 1000) return h_flex().gap(6).child(this.meter(t, label, 0)).child(div().text_color(t.dim).child("renewed"));
    return h_flex().gap(6).items_center()
      .child(this.meter(t, label, win.percent))
      .child(div().text_color(t.dim).child(resetsText(win.resetsAt)));
  }

  tokenPeriod(t, label, period) {
    return h_flex().id(`tokens-${label}`).gap(6).items_center().tooltip(tokenBreakdown(period))
      .child(div().text_color(t.dim).child(label))
      .child(div().text_color(t.foreground).child(tokenCount(period.tokens)));
  }

  cpuAndRam(t, s, sep) {
    return [
      this.meter(t, "CPU", s.cpu),
      sep(),
      h_flex().gap(6).items_center()
        .child(this.meter(t, "RAM", 100 * s.usedGb / s.totalGb))
        .child(div().text_color(t.dim).child(`${s.usedGb.toFixed(1)}/${s.totalGb.toFixed(0)} GB`)),
    ];
  }

  // A footer block in a window that draws the rest of its footer itself: { "only": "system" }.
  systemOnly(t, s, sep) {
    return h_flex().size_full().px(14).gap(14).items_center().justify_end().bg(t.chrome).border_t(1).border_color(t.border).text_size(12).text_color(t.muted)
      .when(Boolean(s), (el) => el.children(this.cpuAndRam(t, s, sep)));
  }

  // A footer with room for the network alone: { "only": "network" }.
  networkOnly(t, s) {
    return h_flex().size_full().px(14).gap(14).items_center().justify_end().bg(t.chrome).border_t(1).border_color(t.border).text_size(12).text_color(t.muted)
      .when(Boolean(s), (el) => el.child(div().text_color(t.dim).child(`↓${rate(s.rx)} ↑${rate(s.tx)}`)));
  }

  render() {
    const t = theme();
    const hasReading = Boolean(this.planUsage?.reading?.windows);
    const tokens = this.tokenUsage?.reading;
    const s = this.system;
    const sep = () => div().w(1).h(12).bg(t.border);
    if (props()?.only === "system") return this.systemOnly(t, s, sep);
    if (isNetworkOnly()) return this.networkOnly(t, s);
    return h_flex().size_full().px(14).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(12).text_color(t.muted)
      .child(div().text_color(t.accent).child("Claude"))
      .when(!hasReading, (el) => el.child(div().text_color(t.dim).child(this.planUsage?.reading?.error ?? "no reading yet: sign in to Claude Code")))
      .when(hasReading, (el) => el.child(this.window(t, "week", this.planUsage.windowOf("week"))))
      .when(Boolean(tokens), (el) => el
        .child(sep())
        .child(this.tokenPeriod(t, "today", tokens.today))
        .child(this.tokenPeriod(t, "week", tokens.week))
        .child(this.tokenPeriod(t, "month", tokens.month))
        .child(this.tokenPeriod(t, "all", tokens.allTime)))
      .child(div().flex_1())
      .when(Boolean(s), (el) => el
        .children(this.cpuAndRam(t, s, sep))
        .child(sep())
        .child(h_flex().gap(6).items_center()
          .child(this.meter(t, "C:", s.diskPct))
          .child(div().text_color(t.dim).child(`${s.diskFreeGb.toFixed(0)} GB`)))
        .child(sep())
        .child(div().text_color(t.dim).child(`↓${rate(s.rx)} ↑${rate(s.tx)}`)));
  }
}
