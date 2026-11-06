#!/usr/bin/env node
// Runs inside isolated.mjs's throwaway copy of the mods (--patch). Makes the status board's
// context map step through the saved sessions' splits once a second and logs when each tile
// render starts, so treemap-glide.mjs can read the glide's real frame cadence.
//   node treemap-glide-patch.mjs <frames dir> <context-maps.json>
import fs from "node:fs";

const [framesDir, mapsFile] = process.argv.slice(2);
const STEP_MS = 1000;
const FLUSH_MS = 500;

function replaceOnce(file, from, to) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`${file}: no "${from}"`);
  fs.writeFileSync(file, text.replace(from, to));
}

const mapsByTerminal = JSON.parse(fs.readFileSync(mapsFile, "utf8"));

const treemap = "agents-edited/ctxmap/treemap.js";
fs.appendFileSync(treemap, `
let glideFrames = [];
let glideChunk = 0;
const renderTilesUnlogged = TreemapTiles.prototype.render;
TreemapTiles.prototype.render = function renderTilesLogged(cx) {
  const startedAt = performance.now();
  const shown = renderTilesUnlogged.call(this, cx);
  glideFrames.push([Math.round(startedAt * 10) / 10, Math.round((performance.now() - startedAt) * 10) / 10, this.isFrameDue ? 1 : 0]);
  return shown;
};
export function flushGlideFrames() {
  const frames = glideFrames;
  glideFrames = [];
  glideChunk += 1;
  return writeTextFile(${JSON.stringify(framesDir + "/")} + String(glideChunk).padStart(5, "0") + ".json", JSON.stringify(frames), null);
}
`);
replaceOnce(treemap, 'import { View, div } from "gpui-kit";', 'import { View, div } from "gpui-kit";\nimport { writeTextFile } from "herdr";');

const board = "agents-edited/status-board.js";
replaceOnce(board, "function contextScope(list, ctx, board) {", "function contextScopeLive(list, ctx, board) {");
replaceOnce(board, "import { averageContextTree, contextTreemap } from", "import { averageContextTree, contextTreemap, flushGlideFrames } from");
fs.appendFileSync(board, `
const GLIDE_MAPS = ${JSON.stringify(Object.values(mapsByTerminal))};
const GLIDE_SCOPES = [GLIDE_MAPS, ...GLIDE_MAPS.map((map) => [map])];
function contextScope(list, ctx, board) {
  const scope = contextScopeLive(list, ctx, board);
  return { maps: GLIDE_SCOPES[board.glideStep % GLIDE_SCOPES.length], view: scope.view };
}
export function startGlideSteps(board, cx) {
  board.glideStep = 0;
  cx.timer.every(${STEP_MS}, (cx) => { board.glideStep += 1; cx.notify(); });
  cx.timer.every(${FLUSH_MS}, () => { flushGlideFrames().catch(() => {}); });
}
`);

const main = "agents-edited/board.js";
replaceOnce(main, 'import { kilo, statusBoard, tilde } from "./status-board.js";', 'import { kilo, startGlideSteps, statusBoard, tilde } from "./status-board.js";');
replaceOnce(main, "this.maps.restore(cx);", "this.maps.restore(cx);\n    startGlideSteps(this, cx);");
