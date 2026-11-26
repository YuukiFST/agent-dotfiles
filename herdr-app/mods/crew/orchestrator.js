// The orchestrator's own Claude Code session: the space it runs in, for the crew tabs and the
// Orchestration panel. A mod cannot import from another mod's folder, so the Sessions lists that
// leave it out keep a copy of orchestratorSpace(): spaces-edited/orchestrator-space.js and
// agents-edited/orchestrator-space.js. Change all three together.

import { home, panes, run, spaces } from "herdr";

export const orchestratorFolder = () => `${home()}/Desktop/orchestrator`;
const ORCHESTRATOR_ARGV = ["claude", "--model", "opus", "--effort", "medium"];

const normalized = (path) => (path ?? "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

// A space's folder is where it was made: one started by startOrchestrator() has the orchestrator
// folder, but one started elsewhere and cd'd there keeps its old folder. Its first terminal's
// live folder is where it is now, as Herdr names an unnamed space.
export function orchestratorSpace(sp = spaces(), ps = panes()) {
  const folder = normalized(orchestratorFolder());
  const firstCwd = (space) => space.tabs.map((tab) => ps.find((p) => p.tab === tab.id && p.terminal)).find(Boolean)?.cwd;
  return sp.find((s) => !s.machine && normalized(s.folder) === folder)
    ?? sp.find((s) => !s.machine && normalized(firstCwd(s)) === folder)
    ?? null;
}

export function startOrchestrator() {
  run("space.new", { name: "Orchestrator", folder: orchestratorFolder(), argv: ORCHESTRATOR_ARGV });
}
