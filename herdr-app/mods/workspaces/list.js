// The workspaces every window shares: an ordered list of named layouts. Each window keeps its
// own copy of a layout file, so a workspace's layout is copied to the other window's home.

import { appHome, exec, home, readTextFile, writeTextFile } from "herdr";

export const DEFAULT_WORKSPACES = [{ name: "Sessions", layout: "sessions" }, { name: "Status", layout: "status" }];

const slash = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const MAIN_HOME = () => `${slash(home())}/.config/herdr-app`;
const SECOND_HOME = () => `${slash(home())}/.config/herdr-app-2`;
export const SHARED_DIR = () => `${slash(home())}/.config/herdr-app-shared`;
const LIST_FILE = () => `${SHARED_DIR()}/workspaces.json`;
export const LAYOUTS_DIR = () => `${slash(appHome())}/layouts`;
const isSecondWindow = () => slash(appHome()) === SECOND_HOME();
const otherHome = () => (isSecondWindow() ? MAIN_HOME() : SECOND_HOME());
const layoutFile = (homeDir, name) => `${homeDir}/layouts/${name}.json`;

// Null when the file is mid-write: the next change event reads it whole.
export async function readWorkspaces() {
  try {
    const saved = JSON.parse((await readTextFile(LIST_FILE())) ?? "null");
    return saved?.workspaces?.length ? saved.workspaces : DEFAULT_WORKSPACES;
  } catch {
    return null;
  }
}

// Each window shows what it likes, even the workspace the other one shows, except terminals: one
// drawn in two windows of different widths gets redrawn for the wrong one. True when the other
// window shows `layout` with terminals in it and took the focus, so this window stays as it is.
export async function focusWindowShowing(layout) {
  const saved = JSON.parse((await readTextFile(`${otherHome()}/shared.json`)) ?? "{}");
  if (saved.layout !== layout) return false;
  const tree = await readTextFile(layoutFile(slash(appHome()), layout));
  if (!tree?.includes('"tab": "active"')) return false;
  // A launch raises the window that owns its home; with no window there it would open one, hence status first.
  const r = await exec("cmd.exe", ["/c", `set HERDR_APP_HOME=${otherHome()}&& herdr-app status >nul 2>&1 && herdr-app && echo focused`]);
  return r.stdout.trim() === "focused";
}

async function copyLayout(name, fromHome, toHome) {
  const text = await readTextFile(layoutFile(fromHome, name));
  const old = await readTextFile(layoutFile(toHome, name));
  if (text && text !== old) await writeTextFile(layoutFile(toHome, name), text, old);
}

// The main window's copy wins at start: the second window may have been closed through edits.
export async function pullLayouts(workspaces) {
  if (!isSecondWindow()) return;
  for (const w of workspaces) await copyLayout(w.layout, MAIN_HOME(), SECOND_HOME());
}

// changedPaths: what watchFolder(LAYOUTS_DIR()) reported.
export async function pushLayouts(workspaces, changedPaths) {
  const changed = changedPaths.map(slash);
  for (const w of workspaces) {
    if (changed.includes(layoutFile(slash(appHome()), w.layout))) await copyLayout(w.layout, slash(appHome()), otherHome());
  }
}
