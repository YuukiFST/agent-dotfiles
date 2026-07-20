import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_MODE = "full";
export const RUNTIME_MODES = [
  "off",
  "lite",
  "full",
  "ultra",
  "wenyan-lite",
  "wenyan",
  "wenyan-full",
  "wenyan-ultra",
];

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "caveman");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "caveman",
    );
  }
  return path.join(os.homedir(), ".config", "caveman");
}

export function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

export function normalizeMode(mode) {
  if (typeof mode !== "string") return null;
  const normalized = mode.trim().toLowerCase();
  return RUNTIME_MODES.includes(normalized) ? normalized : null;
}

export function getDefaultMode() {
  const envMode = process.env.CAVEMAN_DEFAULT_MODE;
  if (envMode && RUNTIME_MODES.includes(envMode.toLowerCase())) {
    return envMode.toLowerCase();
  }

  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), "utf8").replace(/^\uFEFF/, ""));
    if (config.defaultMode && RUNTIME_MODES.includes(String(config.defaultMode).toLowerCase())) {
      return String(config.defaultMode).toLowerCase();
    }
  } catch {
    // missing or invalid config
  }

  return DEFAULT_MODE;
}

export function writeDefaultMode(mode) {
  const normalized = normalizeMode(mode);
  if (!normalized) return null;

  const configDir = getConfigDir();
  fs.mkdirSync(configDir, { recursive: true });

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(getConfigPath(), "utf8").replace(/^\uFEFF/, ""));
  } catch {
    // start fresh
  }

  config.defaultMode = normalized;
  fs.writeFileSync(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return normalized;
}

export function isDeactivationCommand(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[.!?\s]+$/, "");
  return t === "stop caveman" || t === "normal mode";
}
