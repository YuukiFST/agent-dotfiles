// The task an agent is shipping, read from its checkout and its pull request: the
// branch's own commits, what moved on the base meanwhile, conflicts, CI and merge.
// No herdr imports, so node can run it against a real repository.

// Reads write nothing under .git, so the folder watch never wakes for our own reads.
export const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
// A background fetch that never stops to ask for a login (Git Credential Manager and askpass both off).
export const FETCH = ["-c", "credential.interactive=false", "-c", "core.askPass=", "fetch", "--quiet", "--no-tags", "origin"];
export const PR_FIELDS = "number,title,state,isDraft,mergeable,mergeStateStatus,url,mergedAt,headRefOid,baseRefName,statusCheckRollup";
export const FORMAT = "%H%x00%P%x00%an%x00%at%x00%D%x00%s%x1e";
export const MAX_COMMITS = 14;
export const MERGED_SHOWN_MS = 20 * 60 * 1000;
export const OP = "op";

const UNMERGED = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export function parseLog(text) {
  const out = [];
  for (const rec of text.split("\x1e")) {
    const f = rec.replace(/^\s+/, "").split("\x00");
    if (f.length < 6 || !/^[0-9a-f]{40,64}$/.test(f[0])) continue;
    out.push({ hash: f[0], parents: f[1] ? f[1].split(" ") : [], author: f[2], at: Number(f[3]) * 1000, refs: f[4], subject: f[5] });
  }
  return out;
}

// `git status --porcelain=v1 -z`: changed paths, and those still in conflict.
export function parseStatus(text) {
  const entries = text.split("\x00").filter(Boolean);
  let changed = 0;
  const unmerged = [];
  for (let i = 0; i < entries.length; i++) {
    const xy = entries[i].slice(0, 2);
    if (xy[0] === "R" || xy[0] === "C") i++; // the rename's source path follows
    changed++;
    if (UNMERGED.has(xy)) unmerged.push(entries[i].slice(3));
  }
  return { changed, unmerged };
}

// `git merge-tree --write-tree --name-only --no-messages`: exit 1 lists the conflicted files after the tree id.
export function parseMergeTree(code, stdout) {
  if (code !== 1) return [];
  return stdout.split(/\r?\n/).slice(1).map((s) => s.trim()).filter(Boolean);
}

// MERGE_MSG during a conflicted merge: "# Conflicts:" then one "#\t<path>" line per file.
export function parseMergeConflicts(text) {
  const at = text.indexOf("# Conflicts:");
  if (at < 0) return [];
  const files = [];
  for (const line of text.slice(at).split(/\r?\n/).slice(1)) {
    const m = /^#\t(.+)$/.exec(line);
    if (m) files.push(m[1].trim());
    else if (line.trim() !== "#") break;
  }
  return files;
}

// `git log --format=%x01%H --name-only`: hash -> files it touched.
export function parseTouched(text) {
  const map = new Map();
  for (const block of text.split("\x01").filter(Boolean)) {
    const [hash, ...files] = block.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (hash) map.set(hash, files);
  }
  return map;
}

// The first branch name a commit decorates, without its remote.
export function tipName(refs) {
  for (let r of (refs ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (r.startsWith("tag: ")) continue;
    if (r.startsWith("HEAD -> ")) r = r.slice(8);
    if (r === "HEAD" || r.endsWith("/HEAD")) continue;
    return r.replace(/^origin\//, "");
  }
  return null;
}

const ZERO_TIME = (s) => !s || s.startsWith("0001-");
const STATE_OF_RUN = { SUCCESS: "passed", NEUTRAL: "passed", SKIPPED: "skipped", FAILURE: "failed", TIMED_OUT: "failed",
  CANCELLED: "failed", ACTION_REQUIRED: "failed", STARTUP_FAILURE: "failed", STALE: "skipped" };
const STATE_OF_CONTEXT = { SUCCESS: "passed", FAILURE: "failed", ERROR: "failed", PENDING: "running", EXPECTED: "queued" };

// statusCheckRollup -> jobs, one per name (a workflow's status context repeats its check run).
export function parseChecks(rollup) {
  const byName = new Map();
  for (const c of rollup ?? []) {
    const name = c.name ?? c.context;
    if (!name) continue;
    let state;
    if (c.__typename === "StatusContext") state = STATE_OF_CONTEXT[c.state] ?? "queued";
    else if (c.status === "COMPLETED") state = STATE_OF_RUN[c.conclusion] ?? "passed";
    else state = c.status === "IN_PROGRESS" ? "running" : "queued";
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (byName.has(key) && c.__typename === "StatusContext") continue;
    byName.set(key, {
      name,
      state,
      start: ZERO_TIME(c.startedAt) ? null : Date.parse(c.startedAt),
      end: ZERO_TIME(c.completedAt) ? null : Date.parse(c.completedAt),
      url: c.detailsUrl ?? c.targetUrl ?? null,
    });
  }
  return [...byName.values()].filter((j) => j.state !== "skipped");
}

export function checksSummary(jobs) {
  const done = jobs.filter((j) => j.state === "passed" || j.state === "failed").length;
  const failed = jobs.filter((j) => j.state === "failed");
  return { total: jobs.length, done, failed, pending: jobs.length - done };
}

// What the task is doing now. One word drives the node, the top row, the footer and the button.
export function phaseOf(flow, now = Date.now()) {
  const pr = flow.pr;
  if (pr?.state === "MERGED") return now - Date.parse(pr.mergedAt) < MERGED_SHOWN_MS ? "merged" : "gone";
  if (pr?.state === "CLOSED") return "gone";
  if (flow.merging) return "resolving";
  if (flow.conflictFiles.length > 0 || pr?.mergeable === "CONFLICTING") return "conflicts";
  if (!pr) return flow.uncommitted > 0 ? "changes" : flow.own > 0 ? "unpublished" : "gone";
  if (flow.uncommitted > 0 && pr.headRefOid !== flow.head) return "changes";
  const c = checksSummary(flow.jobs);
  if (c.failed.length) return "failed";
  if (c.pending > 0 || pr.mergeable === "UNKNOWN") return "checking";
  return "ready";
}

// Rows for the graph, newest first: the task's own node, then the commits since the
// base and the merge base, parents limited to what is shown.
export function rowsOf(flow, phase) {
  const shown = new Set(flow.commits.map((c) => c.hash));
  const commits = flow.commits.map((c) => ({ ...c, parents: c.parents.filter((p) => shown.has(p)) }));
  const head = flow.head && shown.has(flow.head) ? [flow.head] : commits.length ? [commits[0].hash] : [];
  return [{ hash: OP, parents: head, op: true, dashed: phase === "changes" || phase === "unpublished" }, ...commits];
}
