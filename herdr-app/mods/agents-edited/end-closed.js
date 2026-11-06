// Ends a terminal closed while a child still showed in a pane (pane-info/close-selected.js) once
// no such child is left.
import { hc, panes, terminals } from "herdr";

function hasShownDescendant(address, live, shown) {
  return live.some((t) => t.parent === address && (shown.has(t.address) || hasShownDescendant(t.address, live, shown)));
}

export function endClosedTerminals() {
  const live = terminals().filter((t) => t.state === "live");
  const shown = new Set(panes().map((p) => p.terminal));
  for (const t of live) {
    if (t.labels?.["herdr.closing"] && !hasShownDescendant(t.address, live, shown)) hc(["kill", t.address]);
  }
}
