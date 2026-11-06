// Keeps each agent checkout's task fresh: local git often while its agent works,
// the pull request and its checks while they move, and the step the agent says it is on.

import { exec, readTextFile, watchFolder, home } from "herdr";
import { READ, FETCH, PR_FIELDS, FORMAT, MAX_COMMITS, parseLog, parseStatus, parseMergeTree, parseTouched, tipName,
  parseChecks, checksSummary, phaseOf, parseMergeConflicts } from "./model.js";

const LOCAL_BUSY_MS = 4000;
const LOCAL_IDLE_MS = 20000;
const PR_MOVING_MS = 8000;
const PR_STILL_MS = 30000;
const FETCH_MS = 90000;
const STEP_FRESH_MS = 10 * 60 * 1000;

// `herdr-step` writes ~/.config/herdr-app-shared/flow/<terminal>.json: { step, at }.
export const stepDir = () => `${home()}/.config/herdr-app-shared/flow`;

const lines = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

class RepoTask {
  constructor(top) {
    this.top = top;
    this.flow = null;
    this.pr = null;
    this.jobs = [];
    this.localAt = 0;
    this.prAt = 0;
    this.fetchAt = 0;
    this.base = null;
    this.me = null;
    this.culprits = new Map(); // incoming hash -> conflicted files it touched, kept until the PR merges
    this.watching = false;
    this.prDue = true;
    this.localDue = true;
    this.gitDir = null;
    this.shipped = null; // what readShipped found, with the head and base it holds for
  }

  git(args) {
    return exec("git", [...READ, ...args], { cwd: this.top });
  }

  async readBase() {
    if (this.base) return this.base;
    const head = await this.git(["rev-parse", "--abbrev-ref", "origin/HEAD"]);
    if (head.code === 0 && head.stdout.trim() !== "origin/HEAD") return (this.base = head.stdout.trim());
    for (const name of ["origin/main", "origin/master", "main", "master"]) {
      if ((await this.git(["rev-parse", "--verify", "--quiet", name])).code === 0) return (this.base = name);
    }
    return null;
  }

  // HEAD's own file answers without starting git once the checkout's git folder is known.
  async currentBranch() {
    const head = this.gitDir ? await readTextFile(`${this.gitDir}/HEAD`).catch(() => null) : null;
    if (head === null) return (await this.git(["branch", "--show-current"])).stdout.trim();
    return /^ref: refs\/heads\/(.+)/.exec(head.trim())?.[1] ?? "";
  }

  async readLocal() {
    const [base, branch] = await Promise.all([this.readBase(), this.currentBranch()]);
    if (!base) return null;
    const baseShort = base.replace(/^origin\//, "");
    const onBase = !branch || branch === baseShort;
    if (onBase && this.gitDir) return this.keepMerged();
    const [rev, status] = await Promise.all([
      this.git(["rev-parse", "--absolute-git-dir", "HEAD", base]),
      onBase ? null : this.git(["status", "--porcelain=v1", "-z", "--untracked-files=normal"]),
    ]);
    if (rev.code !== 0) return null;
    const [gitDir, head, baseHash] = lines(rev.stdout);
    this.gitDir = gitDir;
    if (onBase) return this.keepMerged();
    this.me ??= (await this.git(["config", "user.name"])).stdout.trim();

    const mergeMsg = await readTextFile(`${gitDir}/MERGE_HEAD`).catch(() => null) === null
      ? null : (await readTextFile(`${gitDir}/MERGE_MSG`).catch(() => null)) ?? "";
    const merging = mergeMsg !== null;
    const { changed, unmerged } = parseStatus(status.stdout);
    const shipped = await this.readShipped({ base, baseShort, branch, head, baseHash, mergeMsg, unmerged });
    return {
      top: this.top, branch, base: baseShort, head, commits: shipped.commits,
      uncommitted: changed - unmerged.length,
      own: shipped.commits.filter((c) => c.kind === "own").length,
      conflictFiles: shipped.conflictFiles,
      merging: merging ? { remaining: unmerged.length, total: shipped.total } : null,
      pr: this.pr, jobs: this.jobs,
    };
  }

  // The commits and conflicts of the branch against its base. They move only with the head or
  // the base, except mid-merge, where each resolved file counts.
  async readShipped({ base, baseShort, branch, head, baseHash, mergeMsg, unmerged }) {
    const merging = mergeMsg !== null;
    const key = `${branch} ${head} ${baseHash}`;
    if (!merging && this.shipped?.key === key) return this.shipped;
    const fork = await this.forkPoint(base);
    const [log, forkLog, incomingList] = await Promise.all([
      this.git(["log", "--date-order", `--format=${FORMAT}`, `--max-count=${MAX_COMMITS}`, "HEAD", base, ...(fork ? [`^${fork}`] : [])]),
      fork ? this.git(["log", "-1", `--format=${FORMAT}`, fork]) : { stdout: "" },
      fork ? this.git(["rev-list", `${fork}..${base}`]) : { stdout: "" },
    ]);
    const incoming = new Set(lines(incomingList.stdout));
    const pending = (await this.git(["rev-list", "--count", `HEAD..${base}`])).stdout.trim() !== "0";
    const conflictFiles = merging || !pending ? [] : await this.predictConflicts(base);
    // Git lists the merge's conflicted files in MERGE_MSG; the ones still unmerged are what is left.
    const listed = merging ? parseMergeConflicts(mergeMsg) : [];
    const total = merging ? Math.max(listed.length, unmerged.length) : 0;
    await this.markCulprits(fork, base, merging ? (listed.length ? listed : unmerged) : conflictFiles);

    const still = new Set(merging ? unmerged : conflictFiles);
    if (!merging && !conflictFiles.length && !pending) this.culprits.clear();
    const commits = [...parseLog(log.stdout), ...parseLog(forkLog.stdout).map((c) => ({ ...c, forkPoint: true }))].map((c) => {
      const kind = c.forkPoint ? "base" : incoming.has(c.hash) ? "incoming" : "own";
      const touched = this.culprits.get(c.hash) ?? [];
      return {
        hash: c.hash, parents: c.parents, subject: c.subject, at: c.at,
        author: c.author === this.me ? "You" : c.author.split(" ")[0],
        kind,
        tip: c.hash === head ? branch : c.hash === baseHash ? baseShort : kind === "own" ? null : tipName(c.refs),
        conflicts: touched.length,
        resolved: touched.length > 0 && touched.every((f) => !still.has(f)),
      };
    });
    this.shipped = { key: merging ? null : key, commits, conflictFiles, total };
    return this.shipped;
  }

  // A checkout back on the base after its PR merged keeps the merged card a while.
  keepMerged() {
    return this.flow?.pr?.state === "MERGED" && phaseOf(this.flow) === "merged" ? this.flow : null;
  }

  // Where the branch left the base: the parent of its oldest first-parent commit, so
  // base commits merged in later still show as what moved on the base meanwhile.
  async forkPoint(base) {
    const own = lines((await this.git(["rev-list", "--first-parent", "HEAD", `^${base}`])).stdout);
    if (!own.length) return (await this.git(["merge-base", "HEAD", base])).stdout.trim() || null;
    const parent = await this.git(["rev-parse", "--verify", "--quiet", `${own[own.length - 1]}^1`]);
    return parent.code === 0 ? parent.stdout.trim() : null;
  }

  async predictConflicts(base) {
    const r = await this.git(["merge-tree", "--write-tree", "--name-only", "--no-messages", "HEAD", base]);
    return parseMergeTree(r.code, r.stdout);
  }

  async markCulprits(fork, base, files) {
    if (!files.length || !fork) return;
    const r = await this.git(["log", "--format=%x01%H", "--name-only", `${fork}..${base}`, "--", ...files]);
    for (const [hash, touched] of parseTouched(r.stdout)) {
      const known = new Set([...(this.culprits.get(hash) ?? []), ...touched.filter((f) => files.includes(f))]);
      if (known.size) this.culprits.set(hash, [...known]);
    }
  }

  async readPr() {
    const r = await exec("gh", ["pr", "view", "--json", PR_FIELDS], { cwd: this.top }).catch(() => null);
    if (!r || r.code !== 0) {
      this.pr = null;
      this.jobs = [];
      return;
    }
    try {
      const pr = JSON.parse(r.stdout);
      this.jobs = parseChecks(pr.statusCheckRollup);
      delete pr.statusCheckRollup;
      this.pr = pr;
      if (pr.state === "MERGED") {
        this.culprits.clear();
        this.shipped = null;
      }
    } catch {
      // A cut-off answer: keep the last reading.
    }
  }

  prMoving() {
    const p = this.flow ? phaseOf(this.flow) : null;
    return p === "checking" || p === "resolving" || p === "conflicts" || this.pr?.mergeable === "UNKNOWN" || checksSummary(this.jobs).pending > 0;
  }

  // Returns true when the flow changed.
  async refresh(busy, now) {
    const before = JSON.stringify(this.flow);
    if (this.pr?.state === "OPEN" && now - this.fetchAt > FETCH_MS && this.base?.startsWith("origin/")) {
      this.fetchAt = now;
      await exec("git", [...FETCH, this.base.slice(7)], { cwd: this.top }).catch(() => null);
      this.shipped = null;
      this.localDue = true;
      this.prDue = true;
    }
    if (this.localDue || now - this.localAt > (busy ? LOCAL_BUSY_MS : LOCAL_IDLE_MS)) {
      this.localDue = false;
      this.localAt = now;
      this.flow = await this.readLocal().catch(() => null);
    }
    if (!this.flow) return before !== "null";
    const prEvery = this.prMoving() ? PR_MOVING_MS : PR_STILL_MS;
    if (this.prDue || now - this.prAt > prEvery) {
      this.prDue = false;
      this.prAt = now;
      await this.readPr();
      if (this.flow) this.flow = { ...this.flow, pr: this.pr, jobs: this.jobs };
    }
    return JSON.stringify(this.flow) !== before;
  }

  // Commits, merges, pushes and fetches land under .git: read at once instead of waiting for the timer.
  watch(cx) {
    if (this.watching || !this.gitDir) return;
    this.watching = true;
    cx.spawn(async (cx) => {
      for (;;) {
        let paths;
        try {
          paths = await watchFolder(this.gitDir);
        } catch {
          this.watching = false;
          return;
        }
        this.localDue = true;
        this.shipped = null;
        if (paths.some((p) => /refs[\\/]remotes|packed-refs|FETCH_HEAD/.test(p))) this.prDue = true;
        cx.notify();
      }
    });
  }
}

export class FlowByFolder {
  constructor() {
    this.topOf = {}; // pane folder -> checkout top, or null when not a repository
    this.repos = {};
    this.steps = {};
    this.running = false;
  }

  // Runs every second; each repository decides what is due. entries: [{ address, cwd, busy }] for this window's local agents.
  tick(entries, cx) {
    if (this.running) return;
    this.running = true;
    cx.spawn(async (cx) => {
      const now = Date.now();
      let changed = false;
      const busyTop = new Map();
      for (const e of entries) {
        if (!e.cwd) continue;
        if (!(e.cwd in this.topOf)) {
          const r = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd: e.cwd }).catch(() => null);
          this.topOf[e.cwd] = r?.code === 0 ? r.stdout.trim() : null;
        }
        const top = this.topOf[e.cwd];
        const step = await readTextFile(`${stepDir()}/${e.address}.json`).catch(() => null);
        const parsed = parseStep(step, now);
        if (top) busyTop.set(top, Boolean(busyTop.get(top) || e.busy || parsed));
        if (JSON.stringify(parsed) !== JSON.stringify(this.steps[e.address] ?? null)) changed = true;
        this.steps[e.address] = parsed;
      }
      for (const [top, busy] of busyTop) {
        const repo = (this.repos[top] ??= new RepoTask(top));
        if (await repo.refresh(busy, now).catch(() => false)) changed = true;
        repo.watch(cx);
      }
      this.running = false;
      if (changed) cx.notify();
    });
  }

  of(cwd) {
    const top = cwd ? this.topOf[cwd] : null;
    return top ? this.repos[top]?.flow ?? null : null;
  }

  stepOf(address) {
    return this.steps[address] ?? null;
  }
}

function parseStep(text, now) {
  if (!text) return null;
  try {
    const s = JSON.parse(text);
    return typeof s.step === "string" && s.step && now - Number(s.at) < STEP_FRESH_MS ? s.step : null;
  } catch {
    return null;
  }
}
