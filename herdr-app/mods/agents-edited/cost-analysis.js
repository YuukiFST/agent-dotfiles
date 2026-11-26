// The sliding 7-day median cost per task, for all repositories or one.

export const ALL_REPOS = "";

const DAY_MS = 24 * 3600000;
const WINDOW_MS = 7 * DAY_MS;
const DAYS_SHOWN = 30;
// Fewer tasks than this in a window say more about those tasks than about the repository.
const MIN_TASKS = 3;
const MIN_LISTED_TASKS = 10;
// A session quiet for less may still be going: its cost is not final.
const FINISHED_AFTER_MS = 3600000;

function quantile(sorted, share) {
  const at = (sorted.length - 1) * share;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
}

const sortedCosts = (tasks) => tasks.map((task) => task.cost).sort((a, b) => a - b);

function windowAt(tasks, at) {
  const costs = sortedCosts(tasks.filter((task) => task.endAt > at - WINDOW_MS && task.endAt <= at));
  if (costs.length < MIN_TASKS) return null;
  return { at, count: costs.length, low: quantile(costs, 0.25), median: quantile(costs, 0.5), high: quantile(costs, 0.75) };
}

function pointsOf(tasks, now) {
  const points = [];
  for (let day = DAYS_SHOWN; day >= 0; day--) {
    const point = windowAt(tasks, now - day * DAY_MS);
    if (point) points.push({ ...point, share: 1 - day / DAYS_SHOWN });
  }
  return points;
}

function reposOf(tasks, now) {
  const recent = tasks.filter((task) => task.endAt > now - DAYS_SHOWN * DAY_MS);
  const summary = (repo, members) => ({ repo, count: members.length, median: quantile(sortedCosts(members), 0.5) });
  const repos = [...Map.groupBy(recent, (task) => task.repo)]
    .filter(([, members]) => members.length >= MIN_LISTED_TASKS)
    .map(([repo, members]) => summary(repo, members))
    .sort((a, b) => b.count - a.count);
  return recent.length ? [summary(ALL_REPOS, recent), ...repos] : [];
}

// points: one per day with enough tasks, share 0 (30 days ago) to 1 (now). repos: the last 30 days,
// without the hidden ones, which leave the totals too. choices: every repository, hidden or not.
export function costAnalysis(reading, wantedRepo, hidden) {
  const now = reading.checkedAt;
  const finished = reading.tasks.filter((task) => task.endAt <= now - FINISHED_AFTER_MS);
  const allPriced = finished.filter((task) => task.cost !== null);
  const priced = allPriced.filter((task) => !hidden.has(task.repo));
  const repos = reposOf(priced, now);
  const repo = repos.some((r) => r.repo === wantedRepo) ? wantedRepo : ALL_REPOS;
  const isInScope = (task) => !hidden.has(task.repo) && (repo === ALL_REPOS || task.repo === repo);
  const points = pointsOf(priced.filter(isInScope), now);
  const first = points[0] ?? null;
  const last = points.at(-1)?.at === now ? points.at(-1) : null;
  return {
    repo,
    repos,
    choices: reposOf(allPriced, now).filter((r) => r.repo !== ALL_REPOS).map((r) => ({ ...r, isHidden: hidden.has(r.repo) })),
    points,
    first,
    last,
    changePct: first && last && first !== last && first.median > 0 ? Math.round(100 * (last.median / first.median - 1)) : null,
    unpriced: finished.filter((task) => task.cost === null && isInScope(task)).length,
  };
}
