// Goes back to the agent you looked at before this one (alt-tab for agents), from the
// agents list's history (shared "agents.mru"). Opened by a key as an overlay
// (`mod.open:agent-back`), it focuses that agent and closes itself at once.

import { View, div } from "gpui-kit";
import { agents, focused, shared, run, props, closeOverlay, notify } from "herdr";

export default class AgentBack extends View {
  init(_props, cx) {
    const current = focused()?.terminal;
    const live = new Set(agents().map((a) => a.address));
    const previous = (shared("agents.mru") ?? []).find((address) => address !== current && live.has(address));
    if (previous) run("agent.focus", { terminal: previous });
    else notify({ title: "No previous agent", level: "info", timeout: 2000 });
    cx.timer.after(0, () => closeOverlay(props().overlay));
  }

  render() {
    return div();
  }
}
