// Lays a task's commits out on lanes, newest first (git log --date-order). A lane is
// a column waiting for one commit and keeps its column until that commit arrives,
// so lines bend only where branches fork or merge. Adapted from mods/git-graph/lanes.js,
// with each segment naming the commit it leads to so it takes that commit's color.
//
// Segments: [fromLane, fromY, toLane, toY, towardHash, dashed]; y 0 = row top, 0.5 = dot, 1 = bottom.
export function layoutFlowLanes(commits) {
  const lanes = [];
  const dashed = [];
  const free = () => {
    const i = lanes.indexOf(null);
    return i < 0 ? lanes.length : i;
  };
  let width = 1;
  const rows = commits.map((commit) => {
    const before = lanes.slice();
    const wasDashed = dashed.slice();
    const segments = [];
    let lane = before.indexOf(commit.hash);
    if (lane < 0) {
      lane = free();
      lanes[lane] = commit.hash;
      dashed[lane] = false;
    }
    before.forEach((hash, j) => {
      if (hash === null || hash === undefined) return;
      if (hash === commit.hash) {
        segments.push([j, 0, lane, 0.5, commit.hash, Boolean(wasDashed[j])]);
        if (j !== lane) {
          lanes[j] = null;
          dashed[j] = false;
        }
      } else segments.push([j, 0, j, 1, hash, Boolean(wasDashed[j])]);
    });
    const [first, ...rest] = commit.parents;
    lanes[lane] = first ?? null;
    dashed[lane] = Boolean(first && commit.dashed);
    if (first) segments.push([lane, 0.5, lane, 1, first, dashed[lane]]);
    for (const parent of rest) {
      let k = lanes.indexOf(parent);
      if (k < 0) {
        k = free();
        lanes[k] = parent;
        dashed[k] = Boolean(commit.dashed);
      }
      segments.push([lane, 0.5, k, 1, parent, dashed[k]]);
    }
    width = Math.max(width, before.length, lanes.length);
    while (lanes.length && lanes[lanes.length - 1] === null) {
      lanes.pop();
      dashed.length = lanes.length;
    }
    return { lane, segments };
  });
  return { rows, width };
}
