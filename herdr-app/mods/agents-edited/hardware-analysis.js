// What the machine's readings mean: how busy it is, what is stuck, and what uses the most.
// No Herdr imports, so every rule here runs on plain data.

const GIB = 1073741824;
const SATURATED_CPU = 85;
const AVERAGE_WINDOW_MS = 2 * 60000;
const QUEUE_PER_CORE_BUSY = 2;
const STUCK_CORE_SHARE = 0.8;
const STUCK_AFTER_MS = 3 * 60000;
const WORTH_SHOWING_CPU = 2;
const WORTH_SHOWING_RAM_GB = 0.25;
// Claude Code stops a background shell on Windows's low-memory signal once its session has been
// idle this long, whatever free RAM reads a moment later (Claude Code 2.1.317, L6n and P6n).
const REAPER_IDLE_MS = 30 * 60000;
const RECENT_SIGNAL_MS = REAPER_IDLE_MS;

// Windows's own processes are left out: nothing here can be done about them. These run from
// Windows's folders or hide their path, but are the user's to stop.
const APP_NAMES = { chrome: "Chrome", brave: "Brave", msedge: "Edge", firefox: "Firefox", node: "Node", python: "Python", Code: "VS Code", Zed: "Zed", vmmemWSL: "Docker / WSL", vmmem: "Docker / WSL", "com.docker.backend": "Docker", "Docker Desktop": "Docker", claude: "Claude", opencode: "OpenCode", pwsh: "PowerShell", FPilot: "File Pilot", "ai-memory": "ai-memory", "herdr-app": "Herdr App", "herdr-core": "Herdr App", hc: "Herdr App" };
const THE_APP_ITSELF = new Set(["herdr-app", "herdr-core", "hc"]);
const isWindowsOwn = (p) => p.system && !APP_NAMES[p.name];
const isOutOfReach = (p) => isWindowsOwn(p) || THE_APP_ITSELF.has(p.name);

export function clock(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// The session a process works for: the nearest ancestor that is a session's terminal. known keeps
// the answer across readings, because agents' helpers outlive the shells that started them; a live
// terminal's name comes first, because a session can be renamed.
function sessionFinder(byId, sessionOfPid, known) {
  // Windows reuses a dead parent's id: a parent that started after its child is another process.
  const parentOf = (id) => {
    const p = byId.get(id);
    const startedAfter = byId.get(p?.parent)?.started > p?.started;
    return startedAfter ? null : p?.parent;
  };
  const find = (id, seen = new Set()) => {
    if (!id || seen.has(id)) return null;
    seen.add(id);
    const session = sessionOfPid.get(id) ?? find(parentOf(id), seen) ?? known.get(id) ?? null;
    if (session) known.set(id, session);
    return session;
  };
  return find;
}

// node.exe says nothing about what it runs: the tool is in its command line.
const INTERPRETERS = new Set(["node", "bun", "deno", "python", "pythonw"]);
const PACKAGE_IN_PROJECT = /([^\\/]+)[\\/]+node_modules[\\/]+(?:\.bin[\\/]+\.\.[\\/]+)?((?:@[\w.-]+[\\/]+)?[\w.-]+)/i;
const GLOBAL_INSTALL_FOLDERS = new Set(["nodejs", "npm"]);
const SCRIPT_FILE = /([\w.-]+)\.(?:mjs|cjs|js|ts|py)\b/i;
const SHORT_LIVED = "Short-lived processes";

// "vitest (integracao)" for a package run from a project's node_modules, else the script's name.
// A helper whose command line names neither (a worker, a transform pool) does its parent's work.
function toolNamer(processOf) {
  const named = new Map();
  const toolOf = (id, seen = new Set()) => {
    const p = processOf(id);
    if (!p || !INTERPRETERS.has(p.name) || seen.has(id)) return null;
    if (named.has(id)) return named.get(id);
    seen.add(id);
    const pkg = PACKAGE_IN_PROJECT.exec(p.cmd ?? "");
    const fromPackage = pkg && (GLOBAL_INSTALL_FOLDERS.has(pkg[1]) ? pkg[2] : `${pkg[2]} (${pkg[1]})`);
    const tool = fromPackage || toolOf(p.parent, seen) || (SCRIPT_FILE.exec(p.cmd ?? "")?.[1] ?? null);
    named.set(id, tool);
    return tool;
  };
  return toolOf;
}

// What weighs on the machine, biggest first. sessionOfPid: terminal pid to session name. CPU is
// the share of the whole machine since the previous reading. A process with no previous reading
// started since, so all its time counts. known: process id to session, carried between calls.
// mostly: the tool behind most of a row's CPU, when the row's name does not already say it.
export function consumers(reading, previous, sessionOfPid, known) {
  const hasCounterClock = reading.cpuAt != null && previous.cpuAt != null;
  const gapMs = hasCounterClock ? reading.cpuAt - previous.cpuAt : reading.at - previous.at;
  if (gapMs <= 0) return [];
  const before = new Map(previous.processes.map((p) => [p.id, p]));
  const byId = new Map(reading.processes.map((p) => [p.id, p]));
  for (const id of known.keys()) if (!byId.has(id)) known.delete(id);
  const sessionOf = sessionFinder(byId, sessionOfPid, known);
  const toolOf = toolNamer((id) => byId.get(id) ?? before.get(id));
  const share = (ms) => (100 * ms) / (gapMs * reading.cores);
  const totals = new Map();
  const rowOf = (p) => {
    const session = sessionOf(byId.has(p.id) ? p.id : liveAncestor(p.parent, byId, before));
    if (!session && isWindowsOwn(p)) return null;
    const tool = toolOf(p.id);
    const name = session ?? tool ?? APP_NAMES[p.name] ?? p.name;
    if (!totals.has(name)) totals.set(name, newConsumer(name, Boolean(session), session != null || !THE_APP_ITSELF.has(p.name)));
    return { row: totals.get(name), tool };
  };
  let liveMs = 0;
  for (const p of reading.processes) {
    const ms = Math.max(0, p.cpuMs - (before.get(p.id)?.cpuMs ?? 0));
    liveMs += ms;
    const found = rowOf(p);
    if (!found) continue;
    addCpu(found.row, found.tool, share(ms));
    found.row.ramGb += p.ws / GIB;
    found.row.count += 1;
  }
  // Idle's time is in liveMs, so what the cores spent beyond it went to processes gone by now.
  if (hasCounterClock) shareShortLivedCpu(share(gapMs * reading.cores - liveMs), reading, previous, byId, rowOf, totals);
  for (const row of totals.values()) row.mostly = heaviestTool(row);
  const pressure = (row) => row.cpu + (100 * row.ramGb) / reading.totalRamGb;
  return [...totals.values()].sort((a, b) => pressure(b) - pressure(a));
}

const newConsumer = (name, isSession, isClosable) => ({ name, isSession, isClosable, cpu: 0, ramGb: 0, count: 0, shortLivedCpu: 0, cpuByTool: new Map(), mostly: null });

function addCpu(row, tool, cpu) {
  row.cpu += cpu;
  if (tool && tool !== row.name) row.cpuByTool.set(tool, (row.cpuByTool.get(tool) ?? 0) + cpu);
}

function heaviestTool(row) {
  const [tool, cpu] = [...row.cpuByTool].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return cpu >= WORTH_SHOWING_CPU ? tool : null;
}

function liveAncestor(id, byId, before) {
  const seen = new Set();
  while (id && !byId.has(id) && !seen.has(id)) {
    seen.add(id);
    id = before.get(id)?.parent;
  }
  return byId.has(id) ? id : null;
}

// A test runner's workers live for seconds: most start and end between two readings, and their
// CPU shows in no process. It goes to the processes seen starting or ending over the gap, in
// proportion to how hard each worked while seen: a busy worker, not the shells that came and went.
// Windows's own share of that churn is left out, as everywhere here.
function shareShortLivedCpu(cpu, reading, previous, byId, rowOf, totals) {
  if (cpu < WORTH_SHOWING_CPU) return;
  const earlier = new Set(previous.processes.map((p) => p.id));
  const coresWhileSeen = (p, seenAt) => (p.started && seenAt > p.started ? p.cpuMs / (seenAt - p.started) : 0);
  const churn = [
    ...reading.processes.filter((p) => !earlier.has(p.id)).map((p) => ({ p, weight: coresWhileSeen(p, reading.at) })),
    ...previous.processes.filter((p) => !byId.has(p.id)).map((p) => ({ p, weight: coresWhileSeen(p, previous.at) })),
  ];
  const totalWeight = churn.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) {
    const row = totals.get(SHORT_LIVED) ?? newConsumer(SHORT_LIVED, false, false);
    row.cpu += cpu;
    row.shortLivedCpu += cpu;
    totals.set(SHORT_LIVED, row);
    return;
  }
  for (const { p, weight } of churn) {
    const found = weight > 0 ? rowOf(p) : null;
    if (!found) continue;
    addCpu(found.row, found.tool, (cpu * weight) / totalWeight);
    found.row.shortLivedCpu += (cpu * weight) / totalWeight;
  }
}

// Anything smaller would change no answer on the panel.
export const isWorthShowing = (row) => row.cpu >= WORTH_SHOWING_CPU || row.ramGb >= WORTH_SHOWING_RAM_GB;

// A process holding most of a core for minutes on end is usually a loop nobody is watching, and
// worth naming on its own: grouped by app it looks like ordinary load.
// busySince: process id to when it began, carried from one call to the next.
export function stuckProcesses(reading, previous, busySince, known) {
  const gapMs = reading.at - previous.at;
  if (gapMs <= 0) return [];
  const before = new Map(previous.processes.map((p) => [p.id, p.cpuMs]));
  const alive = new Set(reading.processes.map((p) => p.id));
  for (const id of busySince.keys()) if (!alive.has(id)) busySince.delete(id);
  const stuck = [];
  for (const p of reading.processes) {
    if (p.name === "Idle" || isOutOfReach(p)) continue;
    const coreShare = (p.cpuMs - (before.get(p.id) ?? p.cpuMs)) / gapMs;
    if (coreShare < STUCK_CORE_SHARE) {
      busySince.delete(p.id);
      continue;
    }
    if (!busySince.has(p.id)) busySince.set(p.id, reading.at);
    if (reading.at - busySince.get(p.id) >= STUCK_AFTER_MS) stuck.push({ id: p.id, name: p.name, started: p.started, session: known.get(p.id) ?? null, cores: coreShare });
  }
  return stuck.sort((a, b) => b.cores - a.cores);
}

export function cpuTrend(history, now) {
  const recent = history.filter((h) => now - h.at <= AVERAGE_WINDOW_MS);
  const average = recent.length ? recent.reduce((sum, h) => sum + h.cpu, 0) / recent.length : 0;
  let saturatedSince = now;
  for (let i = history.length - 1; i >= 0 && history[i].cpu >= SATURATED_CPU; i--) saturatedSince = history[i].at;
  return { average, saturatedMs: now - saturatedSince };
}

// A job needs the RAM that is free when the machine is at its busiest, not what reads free now.
export const lowestFreeGb = (history, nowGb, sinceAt) => history.filter((h) => h.at >= sinceAt).reduce((lowest, h) => Math.min(lowest, h.freeGb), nowGb);

function minutes(ms) {
  const m = Math.round(ms / 60000);
  return m < 1 ? "under 1m" : `${m}m`;
}

export const recentSignal = (signals, now) => signals.findLast((s) => now - s.at < RECENT_SIGNAL_MS) ?? null;

// One line on the machine right now.
export function headline(trend, queue, cores, ramPct, signal) {
  if (signal) return { isBad: true, text: `Low memory signal at ${clock(signal.at)}` };
  if (trend.saturatedMs >= 60000) {
    const backlog = queue >= cores * QUEUE_PER_CORE_BUSY ? `, ${queue} threads waiting` : "";
    return { isBad: true, text: `CPU saturated ${minutes(trend.saturatedMs)}${backlog}` };
  }
  if (ramPct >= 90) return { isBad: true, text: `RAM ${Math.round(ramPct)}% used` };
  return { isBad: false, text: trend.average >= SATURATED_CPU ? "Busy" : "Has room" };
}
