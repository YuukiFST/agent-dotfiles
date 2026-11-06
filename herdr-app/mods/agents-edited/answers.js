// Answer buttons for agents that need you, on the agent board (the second monitor's
// Agents panel): the numbered options of the menu on the agent's screen (a permission prompt or a
// question), as Allow / Always / Deny or the option's own words. A click presses its digit.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { hc } from "herdr";

const RELOAD_MS = 1500;
const SCREEN_TAIL = 30;
// "❯ 1. Yes" / "  2. Yes, and don't ask again for git commands" / "  3. No (esc)"
const OPTION = /^\s*(?:[❯>›]\s*)?(\d{1,2})\.\s+(.+?)\s*$/;

// The numbered options of the menu at the bottom of the screen (the last run that starts at 1).
export function menuOptions(lines) {
  let options = [];
  for (const line of lines) {
    const m = OPTION.exec(line);
    if (!m) continue;
    const n = Number(m[1]);
    if (n === 1) options = [];
    if (n === options.length + 1) options.push({ n, label: m[2] });
  }
  return options;
}

// What a button says: a permission's yes/always/no in one word, else the option's start.
function buttonOf(option, t, maxLabel) {
  const label = option.label;
  if (/^yes,? (and|allow|don'?t ask)/i.test(label)) return { text: "Always allow", color: t.muted };
  if (/^yes\b/i.test(label)) return { text: "Allow", color: t.ansi2 };
  if (/^no\b/i.test(label)) return { text: "Deny", color: t.blocked };
  return { text: label.length > maxLabel ? `${[...label].slice(0, maxLabel - 1).join("")}…` : label, color: t.foreground };
}

// Reads the menus of the local agents that are waiting, while they wait.
export class BlockedMenus {
  constructor(cx) {
    this.menus = {}; // address -> options
    this.waiting = [];
    this.reading = false;
    this.sent = new Set(); // answered; hidden until the agent moves on
    cx.timer.every(RELOAD_MS, (cx) => this.read(cx));
  }

  watch(list, cx) {
    const waiting = list.filter((a) => a.status === "blocked" && !a.address.includes("/")).map((a) => a.address);
    const fresh = waiting.some((a) => !this.waiting.includes(a));
    for (const address of Object.keys(this.menus)) if (!waiting.includes(address)) delete this.menus[address];
    for (const address of this.sent) if (!waiting.includes(address)) this.sent.delete(address);
    this.waiting = waiting;
    if (fresh) this.read(cx);
  }

  read(cx) {
    if (!this.waiting.length || this.reading) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      for (const address of this.waiting) {
        const r = await hc(["read", address, "--json"]).catch(() => null);
        if (r?.code !== 0) continue;
        this.menus[address] = menuOptions((JSON.parse(r.stdout).text ?? "").split(/\r?\n/).slice(-SCREEN_TAIL));
      }
      this.reading = false;
      cx.notify();
    });
  }

  press(address, key, cx) {
    this.sent.add(address);
    cx.notify();
    cx.spawn(async (cx) => {
      const r = await hc(["keys", address, key]).catch(() => null);
      if (r?.code !== 0) this.sent.delete(address); // didn't land: show the buttons again
      cx.notify();
    });
  }

  // The row's buttons, or null while there is no menu to answer.
  buttons(t, address, indent = 25, maxLabel = 60) {
    const options = this.menus[address];
    if (!options?.length || this.sent.has(address)) return null;
    const hasNo = options.some((o) => /^no\b/i.test(o.label));
    const button = (id, text, color, tip, key) => div().id(`ans-${address}-${id}`).flex_none().h(20).px(7).flex().items_center()
      .rounded(5).border(1).border_color(color + "55").bg(color + "1a").text_size(11).text_color(color)
      .cursor_pointer().hover((s) => s.bg(color + "33"))
      .tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        this.press(address, key, cx);
      })
      .child(text);
    return h_flex().pl(indent).pb(6).gap(4).flex_wrap()
      .children(options.map((o) => {
        const b = buttonOf(o, t, maxLabel);
        return button(o.n, b.text, b.color, `${o.n}. ${o.label}`, String(o.n));
      }))
      .when(!hasNo, (el) => el.child(button("esc", "Skip", t.dim, "Esc: dismiss without answering", "esc")));
  }
}
