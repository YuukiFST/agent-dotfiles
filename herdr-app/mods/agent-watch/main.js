import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, theme, run, notify, playSound } from "herdr";

// Herdr alerts once when an agent blocks; this repeats the alert while it stays blocked.
const REMIND_MS = 120000;
const CHECK_MS = 15000;

export default class AgentWatch extends View {
  init(_props, cx) {
    this.blockedSince = new Map(); // address -> { since, reminded }
    cx.timer.every(CHECK_MS, () => this.remind());
  }

  remind() {
    const now = Date.now();
    const blocked = agents().filter((a) => a.status === "blocked");
    const live = new Set(blocked.map((a) => a.address));
    for (const address of this.blockedSince.keys()) if (!live.has(address)) this.blockedSince.delete(address);
    for (const a of blocked) {
      const entry = this.blockedSince.get(a.address);
      if (!entry) {
        this.blockedSince.set(a.address, { since: now, reminded: now });
        continue;
      }
      if (now - entry.reminded < REMIND_MS) continue;
      entry.reminded = now;
      const mins = Math.round((now - entry.since) / 60000);
      notify({
        title: `${a.program?.name ?? a.app ?? "Agent"} needs you (${mins}m)`,
        body: `${a.space_name} · ${a.tab_name || a.title}`,
        level: "warning",
        action: { name: "agent.focus", args: { terminal: a.address } },
      });
      playSound("blocked");
    }
  }

  render() {
    const t = theme();
    const blocked = agents().filter((a) => a.status === "blocked");
    if (blocked.length === 0) return div().size_full().bg(t.chrome).border_t(1).border_color(t.border);
    return h_flex().id("agent-watch").size_full().px(10).items_center().justify_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(12)
      .cursor_pointer().hover((s) => s.bg(t.hover)).tooltip("Go to the agent that needs you")
      .on_click(() => run("agent.focus", { terminal: blocked[0].address }))
      .child(div().whitespace_nowrap().text_color(t.blocked).child(`${blocked.length} ${blocked.length > 1 ? "need you" : "needs you"}`));
  }
}
