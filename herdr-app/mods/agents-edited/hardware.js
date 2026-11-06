// Keeps hardware-watch.ps1 running while the status board shows, and turns its readings into what
// the Hardware Monitor draws: which jobs fit, and what could be closed to make room.

import { agents, appHome, exec, hc, home, panes, readTextFile, writeTextFile } from "herdr";
import { advice, consumers, cpuTrend, headline, isDockerRunning, isWorthShowing, lowestFreeGb, readiness, recentSignal, stuckProcesses } from "./hardware-analysis.js";
import { spaceListName } from "./session-name.js";

const FOLDER = () => `${home()}/.config/herdr-app/data/hardware`;
const READ_MS = 15000;
const WANTED_MS = 30000;
const WATCHER_STALE_MS = 45000;
const HISTORY_MS = 10 * 60000;
const WORST_RAM_WINDOW_MS = 5 * 60000;
const SHOWN_CONSUMERS = 8;
const GIB = 1073741824;

const parseReading = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next read gets it.
  }
};

export class HardwareWatch {
  constructor(cx) {
    this.history = [];
    this.reading = null;
    this.previous = null;
    this.pidOfTerminal = new Map();
    this.sessionOfProcess = new Map();
    this.busySince = new Map();
    this.isStartingWatcher = false;
    this.read(cx);
    cx.timer.every(READ_MS, (cx) => this.read(cx));
    this.markWanted(cx);
    cx.timer.every(WANTED_MS, (cx) => this.markWanted(cx));
  }

  // Fails before the watcher's first run makes the folder, and when the other window just wrote.
  markWanted(cx) {
    cx.spawn(async () => {
      const file = `${FOLDER()}/wanted`;
      const current = await readTextFile(file).catch(() => null);
      await writeTextFile(file, String(Date.now()), current).catch(() => null);
    });
  }

  // Detached with start: as a child of exec it dies with the mod copy's task. It ends by itself
  // once wanted goes quiet, and its mutex turns away a second one.
  startWatcher(cx) {
    if (this.isStartingWatcher) return;
    this.isStartingWatcher = true;
    cx.spawn(async () => {
      await exec("cmd.exe", ["/c", "start", "", "/b", "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", `${appHome()}/mods/agents-edited/hardware-watch.ps1`, FOLDER()]).catch(() => null);
      this.isStartingWatcher = false;
    });
  }

  read(cx) {
    cx.spawn(async (cx) => {
      const reading = parseReading(await readTextFile(`${FOLDER()}/raw.json`).catch(() => null));
      if (!reading || Date.now() - reading.at > WATCHER_STALE_MS) this.startWatcher(cx);
      if (!reading || reading.at === this.reading?.at) return;
      this.previous = this.reading;
      this.reading = reading;
      await this.learnSessionPids();
      cx.notify();
    });
  }

  // A terminal's pid never changes, so each is asked for once.
  async learnSessionPids() {
    for (const a of agents()) {
      if (a.address.includes("/") || this.pidOfTerminal.has(a.address)) continue;
      const r = await hc(["get", "--json", a.address]).catch(() => null);
      const pid = r?.code === 0 ? parseReading(r.stdout)?.pid : null;
      if (pid) this.pidOfTerminal.set(a.address, pid);
    }
  }

  // sample: the footer's reading.
  addSample(sample) {
    if (sample.at === this.history.at(-1)?.at) return;
    this.history.push({ at: sample.at, cpu: sample.cpu, freeGb: (sample.freeKb * 1024) / GIB });
    while (this.history[0].at < sample.at - HISTORY_MS) this.history.shift();
  }

  sessionOfPid() {
    const terminalPanes = Map.groupBy(panes().filter((p) => p.terminal), (p) => p.tab);
    const names = new Map();
    for (const a of agents()) {
      const pid = this.pidOfTerminal.get(a.address);
      if (pid) names.set(pid, spaceListName(a, (terminalPanes.get(a.tab)?.length ?? 0) > 1, null) ?? a.address);
    }
    return names;
  }

  // Null until there is enough to judge.
  analysis(sample) {
    if (!this.reading || !this.previous || !sample) return null;
    const key = `${this.reading.at}/${sample.at}`;
    if (key !== this.analyzedKey) {
      this.analyzedKey = key;
      this.analyzed = this.analyze(sample);
    }
    return this.analyzed;
  }

  analyze(sample) {
    const now = Date.now();
    const trend = cpuTrend(this.history, now);
    const totalRamGb = (sample.totalKb * 1024) / GIB;
    const freeGb = (sample.freeKb * 1024) / GIB;
    const lowestGb = lowestFreeGb(this.history, freeGb, now - HISTORY_MS);
    const cores = this.reading.cores;
    const signals = this.reading.lowMemory ?? [];
    const signal = recentSignal(signals, now);
    const reading = { ...this.reading, totalRamGb };
    const list = consumers(reading, this.previous, this.sessionOfPid(), this.sessionOfProcess);
    const room = { cores: Math.max(0, cores * (1 - trend.average / 100)), ramGb: lowestFreeGb(this.history, freeGb, now - WORST_RAM_WINDOW_MS) };
    const rows = readiness({
      ...room,
      totalCores: cores,
      diskGb: sample.diskFree / GIB,
      diskBusyPct: 100 - (this.reading.diskIdle ?? 100),
      dockerRunning: isDockerRunning(this.reading.processes),
      recentSignalAt: signal?.at ?? null,
    });
    return {
      headline: headline(trend, this.reading.queue ?? 0, cores, 100 * (1 - freeGb / totalRamGb), signal),
      rows,
      room,
      advice: advice(rows, list),
      stuck: stuckProcesses(reading, this.previous, this.busySince, this.sessionOfProcess),
      consumers: list.filter(isWorthShowing).slice(0, SHOWN_CONSUMERS),
      cpu: { now: sample.cpu, average: trend.average },
      ram: { freeGb, lowestGb, totalGb: totalRamGb },
      signals,
      signal,
      history: this.history,
    };
  }
}
