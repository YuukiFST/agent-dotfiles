// The workspaces file, as mods/workspaces/list.js reads it: Herdr keeps a mod's imports inside
// its own folder, so the editor cannot import that module.

import { home, readTextFile, writeTextFile } from "herdr";

export const DEFAULT_WORKSPACES = [{ name: "Sessions", layout: "sessions" }, { name: "Status", layout: "status" }];
export const SHARED_DIR = () => `${home().replace(/\\/g, "/")}/.config/herdr-app-shared`;
const LIST_FILE = () => `${SHARED_DIR()}/workspaces.json`;

// Null when the file is mid-write: the next change event reads it whole.
export async function readWorkspaces() {
  try {
    const saved = JSON.parse((await readTextFile(LIST_FILE())) ?? "null");
    return saved?.workspaces?.length ? saved.workspaces : DEFAULT_WORKSPACES;
  } catch {
    return null;
  }
}

export async function saveWorkspaces(workspaces) {
  await writeTextFile(LIST_FILE(), `${JSON.stringify({ workspaces }, null, 2)}\n`, await readTextFile(LIST_FILE()));
}
