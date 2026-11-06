// Linha do tempo do dia: quando cada agente trabalhou e quando ficou esperando você
// (blocked). Duas cópias no layout dash: props { record: true } num bloco de 0 px sempre
// montado amostra agents() a cada 5 s e grava <appHome>/timeline/AAAA-MM-DD.json; a aba do
// stack `info` só lê esse arquivo (aba escondida não roda, então não pode gravar).
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, appHome, exec, readTextFile, writeTextFile, run, theme, props } from "herdr";

const SAMPLE_MS = 5_000;
const SAVE_MS = 30_000;
const READ_MS = 10_000;
// Sem amostra por mais que isto (app fechado): o próximo estado abre um trecho novo.
const GAP_MS = 30_000;
const HOUR_MS = 3_600_000;
const DIR = `${appHome()}/timeline`;

const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const clock = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

function duration(ms) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${pad2(m % 60)}`;
}

// Soma do tempo em um estado; trechos = [status, início, fim] em ms.
const total = (segs, status) => segs.reduce((n, [s, a, b]) => n + (s === status ? b - a : 0), 0);

export default class Timeline extends View {
  init(_props, cx) {
    this.day = null;       // { date, agents: { [address]: { label, segs } } }
    this.snapshot = null;  // texto que está no disco, para o writeTextFile
    this.dirty = false;
    this.recorder = Boolean(props()?.record);
    if (!this.recorder) {
      const read = (cx) => cx.spawn(async (cx) => { await this.load(dayKey(new Date())); cx.notify(); });
      read(cx);
      cx.timer.every(READ_MS, read);
      return;
    }
    cx.spawn(async (cx) => {
      await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `New-Item -ItemType Directory -Force '${DIR}' | Out-Null`]);
      await this.load(dayKey(new Date()));
      this.sample(cx);
      cx.timer.every(SAMPLE_MS, (cx) => this.sample(cx));
      cx.timer.every(SAVE_MS, (cx) => this.save(cx));
    });
  }

  async close() {
    if (this.recorder) await this.saveNow();
  }

  path(date) {
    return `${DIR}/${date}.json`;
  }

  async load(date) {
    const text = await readTextFile(this.path(date));
    this.snapshot = text;
    try {
      this.day = text ? JSON.parse(text) : null;
    } catch {
      this.day = null;
    }
    if (!this.day || this.day.date !== date) this.day = { date, agents: {} };
  }

  sample(cx) {
    if (!this.day) return;
    const now = Date.now();
    const today = dayKey(new Date(now));
    if (today !== this.day.date) {
      // Virou o dia: fecha o arquivo de ontem e começa outro.
      cx.spawn(async (cx) => { await this.saveNow(); await this.load(today); cx.notify(); });
      return;
    }
    for (const a of agents()) {
      const rec = (this.day.agents[a.address] ??= { label: "", segs: [] });
      rec.label = `${a.space_name} · ${a.tab_name || a.title || a.address}`;
      const last = rec.segs[rec.segs.length - 1];
      if (last && last[0] === a.status && now - last[2] <= GAP_MS) last[2] = now;
      else rec.segs.push([a.status, now, now]);
      this.dirty = true;
    }
  }

  save(cx) {
    cx.spawn(async () => this.saveNow());
  }

  async saveNow() {
    if (!this.dirty || !this.day) return;
    const text = JSON.stringify(this.day);
    const path = this.path(this.day.date);
    try {
      await writeTextFile(path, text, this.snapshot);
      this.snapshot = text;
      this.dirty = false;
    } catch {
      // Arquivo mudou por fora: adota o que está no disco como base e grava na próxima rodada.
      this.snapshot = await readTextFile(path);
    }
  }

  track(t, address, segs, start, span) {
    const colors = { working: t.working, blocked: t.blocked };
    return div().relative().flex_1().h(14).rounded(4).bg(t.raised)
      .children(segs.filter(([s]) => colors[s]).map(([s, a, b], i) => {
        const left = (100 * (a - start)) / span;
        const width = Math.max((100 * (b - a)) / span, 0.15);
        const what = s === "blocked" ? "esperando você" : "trabalhando";
        return div().id(`seg-${address}-${i}`).absolute().top(0).bottom(0).left(`${left}%`).w(`${width}%`).min_w(2)
          .rounded(2).bg(colors[s]).tooltip(`${what} ${duration(b - a)} · ${clock(a)}–${clock(b)}`);
      }));
  }

  axis(t, start, span) {
    const ticks = [];
    for (let h = Math.ceil(start / HOUR_MS) * HOUR_MS; h <= start + span; h += HOUR_MS) ticks.push(h);
    return h_flex().gap(10).px(14)
      .child(div().w(220))
      .child(div().relative().flex_1().h(14).text_size(10.5).text_color(t.dim)
        .children(ticks.map((h) => div().absolute().top(0).left(`${(100 * (h - start)) / span}%`).child(clock(h)))))
      .child(div().w(150));
  }

  render() {
    if (this.recorder) return div();
    const t = theme();
    const now = Date.now();
    const recs = Object.entries(this.day?.agents ?? {})
      .filter(([, r]) => r.segs.some(([s]) => s === "working" || s === "blocked"))
      .sort(([, a], [, b]) => a.segs[0][1] - b.segs[0][1]);
    const live = new Set(agents().map((a) => a.address));
    const first = recs.length ? Math.min(...recs.map(([, r]) => r.segs[0][1])) : now - HOUR_MS;
    const start = Math.floor(Math.min(first, now - HOUR_MS) / HOUR_MS) * HOUR_MS;
    const span = Math.max(now - start, HOUR_MS);
    const all = recs.flatMap(([, r]) => r.segs);
    const waits = all.filter(([s]) => s === "blocked").map(([, a, b]) => b - a);
    const summary = `trabalho ${duration(total(all, "working"))} · esperando você ${duration(total(all, "blocked"))}` +
      (waits.length ? ` · maior espera ${duration(Math.max(...waits))}` : "");
    return v_flex().id("timeline-root").size_full().text_size(12.5).text_color(t.muted)
      .child(h_flex().px(14).py(8).gap(10).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(13).text_color(t.foreground).child("Linha do tempo de hoje"))
        .child(div().text_size(11).text_color(t.dim).child(summary))
        .child(div().flex_1())
        .child(h_flex().gap(10).text_size(11)
          .child(h_flex().gap(4).items_center().child(div().w(8).h(8).rounded(2).bg(t.working)).child("trabalhando"))
          .child(h_flex().gap(4).items_center().child(div().w(8).h(8).rounded(2).bg(t.blocked)).child("esperando você"))))
      .when(!recs.length, (el) => el.child(div().px(14).py(12).text_color(t.dim)
        .child(this.day ? "Nenhum agente trabalhou hoje desde que esta aba começou a registrar." : "carregando…")))
      .when(recs.length > 0, (el) => el.child(v_flex().pt(8).child(this.axis(t, start, span))))
      .child(v_flex().id("timeline-list").flex_1().min_h(0).overflow_y_scroll().pb(10)
        .children(recs.map(([address, r]) => h_flex().id(`tl-${address}`).gap(10).px(14).py(5).items_center().rounded(6)
          .when(live.has(address), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover))
            .on_click(() => run("agent.focus", { terminal: address })))
          .child(div().w(220).truncate().text_color(live.has(address) ? t.foreground : t.dim).child(r.label))
          .child(this.track(t, address, r.segs, start, span))
          .child(div().w(150).text_size(11).text_color(t.dim)
            .child(`${duration(total(r.segs, "working"))} · espera ${duration(total(r.segs, "blocked"))}`)))));
  }
}
