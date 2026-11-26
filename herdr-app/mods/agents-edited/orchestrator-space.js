// The orchestrator's space, for { "hideOrchestrator": true }. A mod cannot import from another
// mod's folder, so this is a copy: its twins are mods/crew/orchestrator.js (the source of the
// rule) and the orchestrator-space.js of spaces-edited and agents-edited. Change all three together.

import { home, panes, spaces } from "herdr";

const normalized = (path) => (path ?? "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

// The space made in the orchestrator folder, else the one whose first terminal is there now.
export function orchestratorSpace(sp = spaces(), ps = panes()) {
  const folder = normalized(`${home()}/Desktop/orchestrator`);
  const firstCwd = (space) => space.tabs.map((tab) => ps.find((p) => p.tab === tab.id && p.terminal)).find(Boolean)?.cwd;
  return sp.find((s) => !s.machine && normalized(s.folder) === folder)
    ?? sp.find((s) => !s.machine && normalized(firstCwd(s)) === folder)
    ?? null;
}
