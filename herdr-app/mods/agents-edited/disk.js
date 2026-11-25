// What fills the system drive, for the Disk panel, and its two jobs: a scan, and clearing the
// caches. disk-watch.ps1 does both detached and leaves its results in data/disk.

import { appHome, exec, home, readTextFile } from "herdr";

const FOLDER = () => `${home()}/.config/herdr-app/data/disk`;
const SCAN_STALE_MS = 6 * 3600000;
// While a job runs, its progress drives the animation, so it is read a few times a second.
const JOB_POLL_MS = 150;
const IDLE_POLL_MS = 60000;
// A job that has not written for this long died: its progress no longer counts.
const JOB_SILENT_MS = 5000;
const JOB_START_MS = 15000;
const CONFIRM_MS = 4000;
const FREED_SHOWN_MS = 20000;

const parseJson = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next read gets it.
  }
};

const readJson = async (file) => parseJson(await readTextFile(`${FOLDER()}/${file}`).catch(() => null));

export class DiskWatch {
  constructor(cx) {
    this.scan = null;
    this.job = null;
    // The job this copy asked for, until disk-watch.ps1 reports it.
    this.requested = null;
    this.confirmUntil = 0;
    this.freed = null;
    this.frame = 0;
    this.isPolling = false;
    this.read(cx);
    cx.timer.every(IDLE_POLL_MS, (cx) => this.read(cx));
  }

  get isBusy() {
    return Boolean(this.requested || this.job);
  }

  get isConfirming() {
    return Date.now() < this.confirmUntil;
  }

  // Shown with no scan, or an old one: a scan starts by itself.
  // Called from render, so the scan starts after it.
  wanted(cx) {
    if (this.isBusy || !this.hasRead || this.isStartQueued) return;
    if (this.scan && Date.now() - this.scan.at < SCAN_STALE_MS) return;
    this.isStartQueued = true;
    cx.timer.after(0, (cx) => {
      this.isStartQueued = false;
      if (!this.isBusy) this.start("scan", cx);
    });
  }

  rescan(cx) {
    if (!this.isBusy) this.start("scan", cx);
  }

  // The first press asks, the second within CONFIRM_MS clears.
  clearCaches(cx) {
    if (this.isBusy || !this.scan) return;
    if (!this.isConfirming) {
      this.confirmUntil = Date.now() + CONFIRM_MS;
      cx.timer.after(CONFIRM_MS, (cx) => cx.notify());
      cx.notify();
      return;
    }
    this.confirmUntil = 0;
    this.start("clean", cx);
  }

  // Detached with start: as a child of exec it dies with the mod copy's task. Its mutex turns
  // away a second job.
  start(kind, cx) {
    this.requested = { kind, at: Date.now() };
    this.freed = null;
    cx.spawn(async () => {
      await exec("cmd.exe", ["/c", "start", "", "/b", "pwsh.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", `${appHome()}/mods/agents-edited/disk-watch.ps1`, FOLDER(), kind]).catch(() => null);
    });
    this.poll(cx);
    cx.notify();
  }

  poll(cx) {
    if (this.isPolling) return;
    this.isPolling = true;
    cx.timer.after(JOB_POLL_MS, (cx) => {
      this.isPolling = false;
      this.read(cx);
    });
  }

  read(cx) {
    cx.spawn(async (cx) => {
      const [scan, job] = await Promise.all([readJson("scan.json"), readJson("job.json")]);
      this.hasRead = true;
      const now = Date.now();
      const isOurs = job && (!this.requested || job.startedAt >= this.requested.at - 1000);
      const isRunning = isOurs && !job.isDone && now - job.at < JOB_SILENT_MS;
      const hasFinished = isOurs && job.isDone && (this.job || this.requested) && job.finishedAt !== this.finishedAt;
      // What the caches held when this clean began, for the bar to shrink them from.
      if (isRunning && job.kind === "clean" && this.job?.startedAt !== job.startedAt) this.cachesAtStart = (scan ?? this.scan)?.bytes.caches ?? 0;
      this.job = isRunning ? job : null;
      if (isRunning || hasFinished) this.requested = null;
      if (this.requested && now - this.requested.at > JOB_START_MS) this.requested = null;
      if (job?.isDone) this.finishedAt = job.finishedAt;
      if (hasFinished && job.kind === "clean") {
        this.freed = { bytes: job.bytes, at: now };
        cx.timer.after(FREED_SHOWN_MS, (cx) => cx.notify());
      }
      if (scan) this.scan = scan;
      this.frame += 1;
      if (this.isBusy) this.poll(cx);
      cx.notify();
    });
  }

  // The figures the panel draws: during a clean, the caches shrink by what is already freed.
  view() {
    if (!this.scan) return null;
    const freeing = this.job?.kind === "clean" ? this.job.bytes : 0;
    const { totalBytes, freeBytes } = this.scan.drive;
    const bytes = { ...this.scan.bytes, caches: Math.max(0, this.scan.bytes.caches - freeing) };
    const used = totalBytes - freeBytes - freeing;
    const named = Object.values(bytes).reduce((sum, n) => sum + n, 0);
    return {
      drive: this.scan.drive.name,
      at: this.scan.at,
      totalBytes,
      usedBytes: used,
      bytes: { ...bytes, system: Math.max(0, used - named) },
      job: this.job ?? (this.requested ? { kind: this.requested.kind, path: "", bytes: 0 } : null),
      freed: this.freed && Date.now() - this.freed.at < FREED_SHOWN_MS ? this.freed.bytes : null,
      isConfirming: this.isConfirming,
      frame: this.frame,
    };
  }
}
