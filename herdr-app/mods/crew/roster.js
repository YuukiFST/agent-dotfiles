// The orchestrator's crewmates as state/crew.json lists them: bin/crew rewrites it (temp file
// plus rename) on every status change, so this file is the panel's only source of crewmates.

const LIVE = new Set(["running", "blocked"]);
// A report this recent still wants the person; older, it is history.
const REPORT_FRESH_MS = 60 * 60000;

const text = (v) => (typeof v === "string" && v ? v : null);
const time = (v) => {
  const ms = Date.parse(text(v) ?? "");
  return Number.isFinite(ms) ? ms : null;
};

function crewmateOf(raw) {
  if (!raw || typeof raw !== "object" || !text(raw.name)) return null;
  return {
    name: raw.name,
    model: text(raw.model),
    effort: text(raw.effort),
    repo: text(raw.repo),
    spawnedMs: time(raw.spawned),
    status: text(raw.status) ?? "unknown",
    atMs: time(raw.at),
    hasReport: raw.report === true,
    progress: text(raw.progress),
  };
}

// { max, crew } newest spawn first; null when the text is not a roster (a write caught midway).
export function parseRoster(json) {
  if (json === null) return { max: null, crew: [] };
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.crew)) return null;
  const crew = raw.crew.map(crewmateOf).filter(Boolean)
    .sort((a, b) => (b.spawnedMs ?? 0) - (a.spawnedMs ?? 0) || a.name.localeCompare(b.name));
  return { max: Number.isInteger(raw.max) ? raw.max : null, crew };
}

export const liveCount = (roster) => roster.crew.filter((c) => LIVE.has(c.status)).length;
export const countText = (roster) => `${liveCount(roster)}/${roster.max ?? "–"}`;

// "blocked" and "error" want the person; an idle or exited crewmate and a fresh report want them
// too, more calmly.
export function attentionOf(c, now) {
  if (c.status === "blocked" || c.status === "error") return "blocked";
  if (c.status === "idle" || c.status === "exited") return "done";
  if (c.status === "report" && c.atMs !== null && now - c.atMs < REPORT_FRESH_MS) return "done";
  return null;
}

export function age(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export const folderName = (path) => path.replaceAll("\\", "/").replace(/\/+$/, "").split("/").pop() || path;

export function detailOf(c) {
  const run = [c.model, c.effort].filter(Boolean).join("·");
  return [run, c.repo && folderName(c.repo)].filter(Boolean).join(" · ");
}

// The sidebar's three groups, in the order shown: what wants the person, what runs, what is history.
export const GROUPS = [
  { id: "needs", name: "Needs you", isOpenByDefault: true },
  { id: "running", name: "Running", isOpenByDefault: true },
  { id: "finished", name: "Finished", isOpenByDefault: false },
];

// A status this list does not know yet goes to history, not to the person.
export function groupOf(c, now) {
  if (c.status === "running") return "running";
  return attentionOf(c, now) ? "needs" : "finished";
}

// progress.md's last line, "<time> | [n/m] <done> | <next>": the [n/m] Done-when items become
// a bar, the rest stays text. Lines written before the count carry no [n/m].
const STEP = /\[(\d+)\/(\d+)\]\s*/;
export function progressOf(line) {
  if (!line) return { text: null, done: null, total: null };
  const match = STEP.exec(line);
  const total = match ? Number(match[2]) : 0;
  if (!match || total < 1) return { text: line, done: null, total: null };
  return { text: line.replace(STEP, ""), done: Math.min(Number(match[1]), total), total };
}

// state/decisions.json, written by the orchestrator's bin/decisions.js: the open ones are the
// questions waiting for the person. Absent means none; null means a write caught midway.
function optionOf(raw) {
  if (!raw || typeof raw !== "object" || !text(raw.label)) return null;
  return { label: raw.label, effect: text(raw.effect), isRecommended: raw.recommended === true };
}

function decisionOf(raw) {
  if (!raw || typeof raw !== "object" || !text(raw.id) || !text(raw.question)) return null;
  const options = Array.isArray(raw.options) ? raw.options.map(optionOf).filter(Boolean) : [];
  return { id: raw.id, question: raw.question, crewmate: text(raw.crewmate), options };
}

export function parseDecisions(json) {
  if (json === null) return [];
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.open)) return null;
  return raw.open.map(decisionOf).filter(Boolean);
}
