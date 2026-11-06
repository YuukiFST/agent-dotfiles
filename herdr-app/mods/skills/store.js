// The panel's and the toggle's way to backend.mjs and the scan files it leaves in the state folder.

import { appHome, exec, home, readTextFile, watchFolder } from "herdr";

const BACKEND = `${appHome()}/mods/skills/backend.mjs`;
export const STATE_DIR = `${home()}/.claude/state/skills`;

const readJson = (path) => readTextFile(path).then((text) => (text ? JSON.parse(text) : null)).catch(() => null);

export async function backend(...args) {
  const r = await exec("node", [BACKEND, ...args]);
  const result = JSON.parse(r.stdout || "null");
  if (!result) throw new Error(r.stderr.trim() || `backend ${args[0]} printed nothing`);
  if (result.error) throw new Error(result.error);
  return result;
}

export const readScan = () => readJson(`${STATE_DIR}/scan.json`);
export const readProgress = () => readJson(`${STATE_DIR}/progress.json`);

// Calls onChange each time something under `dir` changes, until the mod's build stops.
export function followFolder(cx, dir, onChange) {
  cx.spawn(async (cx) => {
    for (;;) {
      await watchFolder(dir);
      await cx.sleep(300); // A commit or a sync changes many files at once.
      onChange(cx);
    }
  });
}
