// The Claude plan usage, read with Claude Code's own sign-in from the endpoint behind
// claude.ai/settings/usage. Only Claude Code refreshes the token: its refresh tokens rotate, so
// a refresh here would sign it out. An expired token keeps the last reading until it renews it.
//   node usage-sample.mjs <file>
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA = "oauth-2025-04-20";
// The endpoint serves Claude Code's OAuth clients.
const USER_AGENT = "claude-code/2.1.0";
const TIMEOUT_MS = 10000;
// The sign-in still names this plan by its tier.
const PLAN_NAMES = { "Max 20x": "Ultra" };

const file = process.argv[2];
const credentialsFile = join(process.env.CLAUDE_CONFIG_DIR ?? join(os.homedir(), ".claude"), ".credentials.json");

const toEpoch = (iso) => (iso ? Math.round(Date.parse(iso) / 1000) : null);

function limitWindow(limit) {
  const label = { session: "Session", weekly_all: "Week", weekly_scoped: limit.scope?.model?.display_name }[limit.kind];
  if (!label?.trim() || limit.percent == null) return [];
  const kind = limit.kind === "weekly_all" ? "week" : limit.kind === "session" ? "session" : "model";
  return [{ kind, label, percent: limit.percent, resetsAt: toEpoch(limit.resets_at) }];
}

function fixedWindow(kind, label, window) {
  return window?.utilization == null ? [] : [{ kind, label, percent: window.utilization, resetsAt: toEpoch(window.resets_at) }];
}

function windowsOf(usage) {
  const windows = (usage.limits ?? []).flatMap(limitWindow);
  return windows.length ? windows : [...fixedWindow("session", "Session", usage.five_hour), ...fixedWindow("week", "Week", usage.seven_day)];
}

function planOf(sign_in) {
  if (!sign_in.subscriptionType) return null;
  const name = sign_in.subscriptionType[0].toUpperCase() + sign_in.subscriptionType.slice(1);
  const plan = [name, sign_in.rateLimitTier?.match(/\d+x$/)?.[0]].filter(Boolean).join(" ");
  return PLAN_NAMES[plan] ?? plan;
}

async function readUsage() {
  const sign_in = await readFile(credentialsFile, "utf8").then((text) => JSON.parse(text).claudeAiOauth).catch(() => null);
  if (!sign_in?.accessToken) return { error: "not signed in" };
  const response = await fetch(USAGE_URL, {
    headers: { Authorization: `Bearer ${sign_in.accessToken}`, "anthropic-beta": OAUTH_BETA, "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((e) => ({ ok: false, status: e.name }));
  if (!response.ok) return { error: `HTTP ${response.status}` };
  return { at: Date.now(), plan: planOf(sign_in), windows: windowsOf(await response.json()), error: null };
}

const previous = await readFile(file, "utf8").then(JSON.parse).catch(() => null);
const text = JSON.stringify({ ...previous, ...(await readUsage()), checkedAt: Date.now() });
await mkdir(dirname(file), { recursive: true });
const temporary = `${file}.${process.pid}`;
await writeFile(temporary, text);
await rename(temporary, file);
process.stdout.write(text);
