// Pure rules of the PR loop: one state per PR, at most one next action per PR.
// No I/O here, so a recorded snapshot replays to the same plan.

export const NUDGE_AFTER_MS = 4 * 3600e3;
export const NUDGE_SPACING_MS = 3 * 86400e3;
export const MAX_FIX_ROUNDS = 3;
export const LEVELS = ["L0", "L1", "L2", "L3"];

const RED = new Set(["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"]);
const PENDING_STATUS = new Set(["PENDING", "EXPECTED"]);

function checkVerdict(check) {
  if (check.__typename === "StatusContext") {
    if (PENDING_STATUS.has(check.state)) return "pending";
    return RED.has(check.state) ? "red" : "green";
  }
  if (check.status !== "COMPLETED") return "pending";
  return RED.has(check.conclusion) ? "red" : "green";
}

function checkName(check) {
  return check.name ?? check.context ?? "unnamed check";
}

// gh returns bots as plain logins (github-actions, copilot-pull-request-reviewer as CONTRIBUTOR),
// so feedback counts only from accounts with write access to the repo.
const TEAM = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

function headCommitAt(pr) {
  const head = pr.commits?.find((c) => c.oid === pr.headRefOid) ?? pr.commits?.at(-1);
  return Date.parse(head?.committedDate ?? pr.createdAt);
}

// Team reviews and comments, other than the PR author's, newer than both the head commit and
// the last fix:review sent for this head (handledAt): feedback nobody has acted on yet.
function unansweredFeedback(pr, handledAt) {
  const since = Math.max(headCommitAt(pr), handledAt);
  const fromTeam = (item) => TEAM.has(item.authorAssociation) && item.author?.login !== pr.author?.login;
  const reviews = (pr.reviews ?? [])
    .filter((r) => r.state === "CHANGES_REQUESTED" || r.state === "COMMENTED")
    .filter((r) => fromTeam(r) && Date.parse(r.submittedAt) > since)
    .map((r) => ({ author: r.author.login, kind: `review ${r.state}`, body: r.body ?? "", at: r.submittedAt }));
  const comments = (pr.comments ?? [])
    .filter((c) => fromTeam(c) && Date.parse(c.createdAt) > since)
    .map((c) => ({ author: c.author.login, kind: "comment", body: c.body ?? "", at: c.createdAt }));
  return [...reviews, ...comments];
}

export function readRisk(body) {
  const match = /^[\s>#*_-]*risk[*_]*\s*:[*_\s]*(low|medium|high)\b/im.exec(body ?? "");
  return match ? match[1].toLowerCase() : "unknown";
}

// Rules run top to bottom; the first that matches is the PR's only state.
export function classify(pr, handledAt = 0) {
  if (pr.isDraft) return { state: "draft" };
  if (pr.mergeable === "CONFLICTING") return { state: "conflict", detail: [`conflicts with ${pr.baseRefName ?? "base"}`] };
  const checks = pr.statusCheckRollup ?? [];
  const red = checks.filter((c) => checkVerdict(c) === "red");
  if (red.length) return { state: "ci-red", detail: red.map(checkName), checks: red };
  if (checks.some((c) => checkVerdict(c) === "pending")) return { state: "ci-pending" };
  const feedback = unansweredFeedback(pr, handledAt);
  if (feedback.length) {
    const newest = feedback.map((f) => f.at).sort().at(-1);
    return { state: "review-feedback", detail: feedback.map((f) => `${f.kind} by ${f.author}`), feedback, newest };
  }
  // GitHub computes mergeability lazily: the first read of a PR often says UNKNOWN.
  if (pr.mergeable !== "MERGEABLE") return { state: "merge-unknown" };
  const approved = pr.reviewDecision === "APPROVED";
  const noReviewNeeded = !pr.reviewDecision && !(pr.reviewRequests ?? []).length;
  if (approved || noReviewNeeded) return { state: "ready" };
  return { state: "awaiting-review", since: Math.max(Date.parse(pr.createdAt), headCommitAt(pr), handledAt) };
}

export function inWorkingHours(now) {
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

const FIX_KIND = { conflict: "conflict", "ci-red": "ci", "review-feedback": "review" };

// The same fix already sent for MAX_FIX_ROUNDS earlier commits of this PR, in this mode:
// the agent is not converging, so the loop stops and hands the PR to a person.
function earlierFixRounds(ledger, id, head, action, mode) {
  const heads = ledger
    .filter((e) => e.pr === id && e.action === action && e.head !== head && e.key.endsWith(`:${mode}`))
    .map((e) => e.head);
  return new Set(heads).size;
}

// ledger: entries already recorded, each { key, pr, head, action, at }; mode: "dry" or "live".
export function nextAction(pr, verdict, { now, ledger, mode = "dry" }) {
  const id = prId(pr);
  const head = pr.headRefOid;
  const wait = (reason) => ({ action: "wait", reason });
  const fixKind = FIX_KIND[verdict.state];
  if (fixKind) {
    const rounds = earlierFixRounds(ledger, id, head, `fix:${fixKind}`, mode);
    if (rounds >= MAX_FIX_ROUNDS) {
      return { action: "ask:help", key: `${id}@${head}:ask:help:${fixKind}`, reason: `fix:${fixKind} already sent for ${rounds} earlier commits: ${verdict.detail.join("; ")}` };
    }
    const key = `${id}@${head}:fix:${fixKind}${verdict.newest ? `:${verdict.newest}` : ""}`;
    return { action: `fix:${fixKind}`, key, reason: verdict.detail.join("; ") };
  }
  if (verdict.state === "draft") return wait("draft");
  if (verdict.state === "ci-pending") return wait("checks running");
  if (verdict.state === "merge-unknown") return wait("GitHub has not computed mergeability yet");
  if (verdict.state === "ready") return { action: "ask:merge", key: `${id}@${head}:ask:merge`, reason: "green and mergeable" };

  const waited = now.getTime() - verdict.since;
  if (waited < NUDGE_AFTER_MS) return wait(`review requested ${Math.floor(waited / 3600e3)}h ago`);
  if (!inWorkingHours(now)) return wait("nudge waits for working hours");
  const lastNudge = ledger.filter((e) => e.pr === id && e.action === "ask:nudge").at(-1);
  if (lastNudge && now.getTime() - Date.parse(lastNudge.at) < NUDGE_SPACING_MS) return wait("nudge asked less than 3 days ago");
  const day = now.toISOString().slice(0, 10);
  return { action: "ask:nudge", key: `${id}@${head}:ask:nudge:${day}`, reason: `no review for ${Math.floor(waited / 3600e3)}h` };
}

export function prId(pr) {
  return `${pr.repository}#${pr.number}`;
}
