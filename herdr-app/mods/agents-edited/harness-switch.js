// A switch of icon tiles, one lit at a time and the others a click away, and the Claude Code /
// OpenCode one built on it.

import { div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { knownAgents } from "herdr";

const HARNESSES = ["claude", "opencode"];
const SWITCH_OFF_OPACITY = 0.45;
const SWITCH_PADDING = 2;
const ICON_SHARE = 0.65;
const ALERT_DOT_SIZE = 6;

// The agents the switch offers, in its order.
export async function loadHarnesses() {
  const known = await knownAgents();
  return HARNESSES.map((key) => known.find((a) => a.key === key)).filter(Boolean);
}

const agentIcon = (agent, size, color) => (agent.tint ? svg(agent.icon).size(size).flex_none().text_color(color) : image(agent.icon).w(size).h(size).flex_none());

// options: { key, tooltip, icon(size, color), isEnabled, hasAlert }. litKey: the one on, or null for
// none. onPick: (key, cx).
export function iconSwitch(t, id, options, litKey, tileSize, onPick) {
  const iconSize = Math.round(tileSize * ICON_SHARE);
  return h_flex().id(id).flex_none().h(tileSize + 2 * SWITCH_PADDING).p(SWITCH_PADDING).gap(2).items_center().rounded(6).bg(t.raised)
    .children(options.map((option) => {
      const isOn = option.key === litKey;
      return h_flex().id(`${id}-${option.key}`).relative().flex_none().size(tileSize).items_center().justify_center().rounded(4)
        .bg(isOn ? t.selected : t.raised)
        .tooltip(option.tooltip)
        .when(option.isEnabled, (el) => el.cursor_pointer().on_click((_e, cx) => onPick(option.key, cx)))
        .child(div().opacity(isOn ? 1 : SWITCH_OFF_OPACITY).child(option.icon(iconSize, t.foreground)))
        .when(Boolean(option.hasAlert), (el) => el.child(div().absolute().top(0).right(0).size(ALERT_DOT_SIZE).rounded(3).bg(t.blocked)));
    }));
}

export function harnessSwitch(t, id, harnesses, litKey, tileSize, onPick) {
  const options = harnesses.map((agent) => ({
    key: agent.key,
    tooltip: agent.installed ? agent.name : `${agent.name} is not installed`,
    icon: (size, color) => agentIcon(agent, size, color),
    isEnabled: agent.installed,
  }));
  return iconSwitch(t, id, options, litKey, tileSize, onPick);
}
