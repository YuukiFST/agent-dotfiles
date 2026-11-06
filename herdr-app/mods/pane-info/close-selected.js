// Closes a pane and only that pane. The core ends a terminal's children with it and has no way
// to detach one, so a terminal whose child still shows in a pane can't end yet: it leaves the
// screen, stops working, and agents-edited/end-closed.js ends it with the last such child.
import { hc, panes, run, terminals } from "herdr";

function hasShownDescendant(address, live, shown) {
  return live.some((t) => t.parent === address && (shown.has(t.address) || hasShownDescendant(t.address, live, shown)));
}

export async function closeOnlyPane(pane) {
  const terminal = panes().find((p) => p.pane === pane)?.terminal;
  const live = terminals().filter((t) => t.state === "live");
  const shown = new Set(panes().map((p) => p.terminal));
  if (!terminal || !hasShownDescendant(terminal, live, shown)) return run("pane.close", { pane });
  await hc(["label", terminal, "herdr.closing=1"]);
  const paneless = live.filter((t) => t.parent === terminal && !shown.has(t.address) && !hasShownDescendant(t.address, live, shown));
  await Promise.all(paneless.map((t) => hc(["kill", t.address])));
  // Last: this header goes with the pane, and whatever it still awaits goes with it.
  hc(["interrupt", terminal]);
  run("terminal.park", { terminal });
}
