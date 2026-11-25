// The Disk panel, in the place of the Context Window Map: what fills the system drive, as a
// halftone bar of its folders, and a button that clears the caches while the bar burns them off.

import { Background, PathBuilder, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec } from "herdr";
import { tilde } from "./status-board.js";

const NUMBER_FONT = "Geist Mono";
const SECTION_GAP = 12;
const HERO_SIZE = 28;
// Taller, the halftone costs more to build than a render may take.
const BAR_CARD_HEIGHT = 188;
const BAR_PAD = 8;
// One halftone cell: a DOT square every PITCH pixels.
const PITCH = 6;
const DOT = 3;
const SEGMENT_GAP = 2;
const DENSITY_LEVELS = 5;
// Prime, so a dash's repeat never lines up with a box's edge.
const DENSITY_SLOTS = 61;
// A folder this small would vanish from the bar; it keeps this many columns so it can be found.
const MIN_COLUMNS = 3;
const LEGEND_COLUMNS = 3;
const LEGEND_ROW_HEIGHT = 26;
const LEGEND_GAP = 14;
const ROW_GAP = 8;
const ICON_SIZE = 13;
const BAR_HEIGHT = 3;
// "100 GB", "52.6 GB", "820 MB": seven glyphs of Geist Mono 11.5px.
const FIGURE_WIDTH = 50;
// The 12.5px UI font averages ~6.3px a glyph; rounded up so a label fits.
const GLYPH_PX = 7;
// Its middle on the last rows of the usage panel and the Notes composer beside it.
const FOOTER_HEIGHT = 48;
const SHOWN_MIN_BYTES = 10 * 1048576;
const LIT_ALPHA = "ff";
const UNLIT_ALPHA = "30";
const BOX_TOP_ALPHA = "26";
const BOX_BOTTOM_ALPHA = "06";
const BOX_BORDER_ALPHA = "90";
const SHIMMER_WIDTH = 90;
const SHIMMER_PERIOD_MS = 2600;
// Sparks: each read of a clean's progress adds a generation at the caches' edge; a generation
// rises and fades one step per read after it, and is gone after SPARK_GENERATIONS. The transition
// glides each step, a read apart (disk.js JOB_POLL_MS plus the read itself).
const SPARK_STEP_MS = 180;
const SPARK_GENERATIONS = 8;
const SPARKS_PER_GENERATION = 10;
const SPARK_RISE = [20, 90];
const SPARK_DRIFT = [6, 56];
const HEAT_WIDTH = 24;
const FOLDER_ROW_HEIGHT = 30;
const FOLDER_COLUMN_MAX = 300;
const GIB = 1073741824;
const MIB = 1048576;
const PATH_CACHE_LIMIT = 96;

const CATEGORIES = [
  { key: "apps", label: "Apps", color: (t) => t.ansi4, about: "Program Files and per-user programs" },
  { key: "developer", label: "Developer", color: (t) => t.ansi2, about: "Toolchains and stores: .cargo, .rustup, .nuget, .gradle, go, Docker, pnpm" },
  { key: "desktop", label: "Desktop", color: (t) => t.ansi6, about: "The Desktop folder, with the projects on it" },
  { key: "documents", label: "Documents", color: (t) => t.ansi12, about: "The Documents folder" },
  { key: "downloads", label: "Downloads", color: (t) => t.ansi14, about: "The Downloads folder" },
  { key: "photos", label: "Photos", color: (t) => t.ansi5, about: "The Pictures folder" },
  { key: "videos", label: "Videos", color: (t) => t.ansi13, about: "The Videos folder" },
  { key: "music", label: "Music", color: (t) => t.ansi11, about: "The Music folder" },
  { key: "trash", label: "Trash", color: (t) => t.ansi1, about: "Your Recycle Bin" },
  { key: "system", label: "System data", color: (t) => t.muted, about: "Windows, the page file and everything no other row names" },
  { key: "caches", label: "Caches", color: (t) => t.ansi3, about: "Temp, browser, npm, pip, Yarn and app caches" },
];

const icon = (key, size, color) => svg(`mods/agents-edited/icons/disk/${key}.svg`).size(size).flex_none().text_color(color);

export function sizeText(bytes) {
  if (bytes >= 100 * GIB) return `${Math.round(bytes / GIB)} GB`;
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GB`;
  return `${Math.round(bytes / MIB)} MB`;
}

function ago(at) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// A stable noise in [0, 1) per cell, so the halftone keeps its grain from one render to the next.
function noise(a, b, c) {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const pathCache = new Map();

function cachedPath(key, build) {
  const cached = pathCache.get(key);
  if (cached) return cached;
  const built = build();
  if (pathCache.size >= PATH_CACHE_LIMIT) pathCache.clear();
  pathCache.set(key, built);
  return built;
}

// A row of dots is one dashed stroke DOT thick: building a square per dot costs more than a
// render may take.
const rowY = (top, row) => top + row * PITCH + DOT / 2;

// Every dot of the grid, as wide as the whole bar: a segment's box clips it to its columns.
function gridPath(columns, rows, top) {
  return cachedPath(`grid/${columns}/${rows}/${top}`, () => {
    let path = PathBuilder.stroke(DOT).dash_array([DOT, PITCH - DOT]);
    for (let r = 0; r < rows; r++) path = path.move_to(1, rowY(top, r)).line_to(columns * PITCH, rowY(top, r));
    return path.build();
  });
}

// The dash of one density level: DENSITY_SLOTS dots, each lit or not, as on/off runs that start
// on a lit dot.
function litDash(level, seed) {
  const density = (level + 0.5) / DENSITY_LEVELS;
  const slots = Array.from({ length: DENSITY_SLOTS }, (_, i) => noise(i, level, seed) < density);
  const first = Math.max(0, slots.indexOf(true));
  const dash = [];
  for (let i = 0; i < DENSITY_SLOTS; i++) {
    if (slots[(first + i) % DENSITY_SLOTS]) dash.push(DOT, PITCH - DOT);
    else dash[dash.length - 1] += PITCH;
  }
  return dash;
}

// The bright dots: dense at the top and thinning out below, the way a halftone shades. Each row
// takes the dash of its density level, shifted by a whole number of dots so rows don't repeat.
function litPaths(columns, rows, top, seed) {
  return cachedPath(`lit/${columns}/${rows}/${top}/${seed}`, () => {
    const levels = Array.from({ length: DENSITY_LEVELS }, (_, level) => PathBuilder.stroke(DOT).dash_array(litDash(level, seed)));
    for (let r = 0; r < rows; r++) {
      const fall = 1 - r / Math.max(1, rows - 1);
      const level = Math.min(DENSITY_LEVELS - 1, Math.floor((0.08 + 0.9 * fall ** 1.5) * DENSITY_LEVELS));
      const shift = Math.floor(noise(r, -1, seed) * DENSITY_SLOTS) * PITCH;
      levels[level] = levels[level].move_to(1 - shift, rowY(top, r)).line_to(columns * PITCH, rowY(top, r));
    }
    return levels.map((path) => path.build());
  });
}

const RECT = PathBuilder.fill().add_polygon([["0%", "0%"], ["100%", "0%"], ["100%", "100%"], ["0%", "100%"]], true).build();

const pathLayer = (path, fill) => window.paint_path(path, fill).absolute().top(0).left(0).size_full();

// Columns per shown folder, in bar order: proportional to its bytes, at least MIN_COLUMNS, and
// the caches scaled down with what a clean has freed so far.
function layoutSegments(view, columns, cachesShare) {
  const shown = CATEGORIES.filter((c) => view.bytes[c.key] >= SHOWN_MIN_BYTES || c.key === "caches");
  const widths = shown.map((c) => {
    const raw = (view.bytes[c.key] / view.totalBytes) * columns;
    const width = view.bytes[c.key] >= SHOWN_MIN_BYTES ? Math.max(MIN_COLUMNS, raw) : 0;
    return c.key === "caches" ? width * cachesShare : width;
  });
  let start = 0;
  let sum = 0;
  return shown.map((category, i) => {
    sum += widths[i];
    const end = Math.min(columns, Math.round(sum));
    const segment = { category, start, end, seed: i + 1 };
    start = end;
    return segment;
  });
}

// The box sits on whole columns, so the bar's grid paths line up inside it; it clips them.
function segmentBox(t, segment, cells, isClearing) {
  const color = segment.category.color(t);
  const width = (segment.end - segment.start) * PITCH - SEGMENT_GAP;
  const lit = litPaths(cells.columns, cells.rows, cells.top - 1, segment.seed);
  return div().id(`disk-segment-${segment.category.key}`).absolute().top(0).left(segment.start * PITCH).w(Math.max(0, width)).h(cells.height)
    .rounded(3).border(1).border_color(color + BOX_BORDER_ALPHA).overflow_hidden()
    .child(pathLayer(RECT, Background.linear_gradient(180, color + BOX_TOP_ALPHA, color + BOX_BOTTOM_ALPHA)))
    .child(pathLayer(gridPath(cells.columns, cells.rows, cells.top - 1), color + UNLIT_ALPHA))
    .children(lit.map((path) => pathLayer(path, color + LIT_ALPHA)
      .when(isClearing, (el) => el.loop("opacity", { from: 0.45, to: 1, period: 320 }))));
}

// A burning edge: a white-hot line where the caches end, flickering.
function burnLine(t, x, height) {
  return div().absolute().top(-2).left(x - 1).w(2).h(height + 4).rounded(1).bg(t.foreground)
    .loop("opacity", { from: 0.35, to: 1, period: 260 });
}

// The caches glowing hot just behind the burning edge.
function heat(t, x, height) {
  return div().absolute().top(BAR_PAD).left(x - HEAT_WIDTH).w(HEAT_WIDTH).h(height)
    .child(pathLayer(RECT, Background.linear_gradient(90, `${t.ansi3}00`, `${t.ansi3}66`)))
    .loop("opacity", { from: 0.45, to: 1, period: 420 });
}

const between = ([low, high], share) => low + share * (high - low);

function sparks(t, x, height, frame) {
  const colors = [t.foreground, t.ansi3, t.ansi3, t.ansi11, t.ansi1];
  const list = [];
  for (let g = frame - SPARK_GENERATIONS + 1; g <= frame; g++) {
    const age = (frame - g) / (SPARK_GENERATIONS - 1);
    const rise = 1 - (1 - age) ** 2;
    for (let i = 0; i < SPARKS_PER_GENERATION; i++) {
      const n = (k) => noise(g, i, k);
      const size = 2 + Math.floor(n(1) * 3);
      const fromX = x - 2 - n(2) * 18;
      const fromY = BAR_PAD + n(3) * height;
      list.push(div().id(`disk-spark-${g}-${i}`).absolute().size(size).rounded(1)
        .bg(colors[Math.floor(n(5) * colors.length)])
        .left(fromX + rise * (x + between(SPARK_DRIFT, n(6)) - fromX)).top(fromY - rise * between(SPARK_RISE, n(4))).opacity(1 - age)
        .transition("left", { duration: SPARK_STEP_MS, easing: "linear" })
        .transition("top", { duration: SPARK_STEP_MS, easing: "linear" })
        .transition("opacity", { duration: SPARK_STEP_MS, easing: "linear" }));
    }
  }
  return list;
}

function shimmer(t, width) {
  return div().absolute().top(0).bottom(0).w(SHIMMER_WIDTH)
    .child(pathLayer(RECT, Background.linear_gradient(90, `${t.accent}00`, `${t.accent}38`)))
    .loop("left", { from: -SHIMMER_WIDTH, to: width, period: SHIMMER_PERIOD_MS, easing: "ease-in-out" });
}

function bar(t, disk, view) {
  const size = disk.barSize;
  const inner = size ? { width: size.width, height: size.height } : null;
  const card = div().id("disk-bar").relative().size_full().rounded(8).border(1).border_color(t.border).bg(t.background).overflow_hidden().p(BAR_PAD);
  const grid = div().id("disk-grid").relative().size_full()
    .on_size_change((next, cx) => {
      if (next.width === size?.width && next.height === size?.height) return;
      disk.barSize = next;
      cx.notify();
    });
  if (!inner) return div().relative().flex_none().h(BAR_CARD_HEIGHT).child(card.child(grid));
  const columns = Math.floor((inner.width + SEGMENT_GAP) / PITCH);
  const rows = Math.max(1, Math.floor((inner.height - 2) / PITCH));
  const top = Math.floor((inner.height - rows * PITCH + (PITCH - DOT)) / 2);
  const isClearing = view?.job?.kind === "clean";
  const isScanning = !view || view.job?.kind === "scan";
  const cachesShare = isClearing && disk.cachesAtStart > 0 ? view.bytes.caches / disk.cachesAtStart : 1;
  const segments = view ? layoutSegments(view, columns, cachesShare) : [];
  const usedEnd = segments.at(-1)?.end ?? 0;
  const cells = { columns, rows, top, height: inner.height };
  const free = div().absolute().top(0).left(usedEnd * PITCH).w((columns - usedEnd) * PITCH).h(inner.height).overflow_hidden()
    .child(pathLayer(gridPath(columns, rows, top), t.border));
  const edgeX = BAR_PAD + 1 + usedEnd * PITCH - SEGMENT_GAP;
  return div().relative().flex_none().h(BAR_CARD_HEIGHT)
    .child(card.child(grid
      .child(free)
      .children(segments.filter((s) => s.end > s.start).map((s) => segmentBox(t, s, cells, isClearing && s.category.key === "caches")))
      .when(isScanning, (el) => el.child(shimmer(t, inner.width)))))
    .when(isClearing, (el) => el
      .child(heat(t, edgeX, inner.height))
      .child(burnLine(t, edgeX, inner.height + 2 * BAR_PAD - 2))
      .children(sparks(t, edgeX, inner.height, view.frame)));
}

function title(t, disk, view, leading) {
  const isScanning = view?.job?.kind === "scan" || (!view && disk.isBusy);
  const rescan = h_flex().id("disk-rescan").flex_none().px(6).mr_neg_1p5().h(22).gap(5).items_center().rounded(4)
    .text_size(12).text_color(t.dim)
    .when(!disk.isBusy, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => disk.rescan(cx)))
    .child(icon("rescan", 12, t.dim).when(isScanning, (el) => el.spin(900)))
    .child(isScanning ? "Scanning" : "Rescan");
  // As tall as the summary strip and the Notes header, so the first rows share a line.
  return h_flex().h(30).flex_none().gap(10).items_center()
    .child(leading)
    .child(div().flex_none().text_size(12).font_medium().text_color(t.foreground).child("Disk"))
    .child(div().flex_1())
    .child(rescan);
}

function hero(t, view) {
  if (!view) {
    return v_flex().flex_none().gap(2)
      .child(div().h(34).flex().items_center().text_size(14).text_color(t.muted).child("Measuring the drive…"))
      .child(div().h(18).text_size(11.5).text_color(t.dim).child("The first scan walks every folder once, about half a minute."));
  }
  const job = view.job;
  const status = job
    ? h_flex().gap(8).items_center().min_w(0)
      .child(div().flex_none().text_size(12).text_color(t.foreground).child(job.kind === "clean" ? "Clearing caches" : "Scanning"))
      .child(div().id("disk-job-path").min_w(0).truncate().text_ellipsis_start().font_family(NUMBER_FONT).text_size(11).text_color(t.dim).child(job.path ? tilde(job.path) : "starting…"))
    : view.freed != null
      ? h_flex().gap(6).items_center().text_size(12)
        .child(div().flex_none().text_color(t.ansi2).child(`Freed ${sizeText(view.freed)}`))
        .child(div().min_w(0).truncate().text_color(t.dim).child(`· ${sizeText(view.bytes.caches)} stayed, in use by running apps`))
      : div().truncate().text_size(12).text_color(t.dim).child(`${view.drive} · ${sizeText(view.totalBytes - view.usedBytes)} free · scanned ${ago(view.at)}`);
  return v_flex().flex_none().gap(2)
    .child(h_flex().items_baseline().gap(6)
      .child(div().flex_none().font_family(NUMBER_FONT).text_size(HERO_SIZE).text_color(t.foreground).child(`${(view.usedBytes / GIB).toFixed(1)} GB`))
      .child(div().flex_none().text_size(13).text_color(t.muted).child(`of ${sizeText(view.totalBytes)} used`)))
    .child(h_flex().h(18).items_center().min_w(0).child(status));
}

function legendCell(t, category, bytes, total, labelWidth) {
  const color = category.color(t);
  const share = (100 * bytes) / total;
  const tooltip = category.key === "caches" && category.paths ? category.paths : category.about;
  return h_flex().id(`disk-legend-${category.key}`).flex_1().min_w(0).h(LEGEND_ROW_HEIGHT).gap(ROW_GAP).items_center().tooltip(tooltip)
    .child(icon(category.key, ICON_SIZE, color))
    .child(div().w(labelWidth).flex_none().truncate().text_size(12.5).text_color(t.foreground).child(category.label))
    .child(div().flex_1().min_w(0).h(BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(BAR_HEIGHT).rounded(1).bg(color).w(`${Math.min(100, Math.max(share >= 0.2 ? 3 : 0, share))}%`)))
    .child(div().w(FIGURE_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_size(11.5).text_color(t.muted).child(sizeText(bytes)));
}

function legend(t, view, cachePaths) {
  const shown = CATEGORIES.filter((c) => view.bytes[c.key] >= SHOWN_MIN_BYTES || c.key === "caches")
    .map((c) => (c.key === "caches" ? { ...c, paths: cachePaths } : c));
  const labelWidth = Math.max(...shown.map((c) => c.label.length * GLYPH_PX));
  const rows = [];
  for (let i = 0; i < shown.length; i += LEGEND_COLUMNS) rows.push(shown.slice(i, i + LEGEND_COLUMNS));
  return v_flex().flex_none()
    .children(rows.map((row, r) => h_flex().id(`disk-legend-row-${r}`).gap(LEGEND_GAP)
      .children(row.map((c) => legendCell(t, c, view.bytes[c.key], view.usedBytes, labelWidth)))
      .children(Array.from({ length: LEGEND_COLUMNS - row.length }, () => div().flex_1().min_w(0)))));
}

function sectionTitle(t, text, note) {
  return h_flex().flex_none().h(18).items_center().gap(8).text_size(11).text_color(t.dim)
    .child(div().flex_none().font_medium().child(text))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().font_family(NUMBER_FONT).text_size(10.5).child(note)));
}

function folderRow(t, folder, usedBytes, column, isFirst) {
  const category = CATEGORIES.find((c) => c.key === folder.category) ?? CATEGORIES.find((c) => c.key === "system");
  const color = category.color(t);
  const share = (100 * folder.bytes) / usedBytes;
  return h_flex().id(`disk-folder-${folder.path}`).flex_none().h(FOLDER_ROW_HEIGHT).px(12).gap(ROW_GAP).items_center().cursor_pointer()
    .hover((s) => s.bg(t.raised))
    .when(!isFirst, (el) => el.border_t(1).border_color(t.border))
    .tooltip(`${category.label}: ${folder.path}
Click to open it in Explorer`)
    .on_click(() => exec("explorer.exe", [folder.path]).catch(() => null))
    .child(icon(category.key, ICON_SIZE, color))
    .child(div().w(column).flex_none().min_w(0).truncate().text_ellipsis_start().text_size(12.5).text_color(t.foreground).child(tilde(folder.path)))
    .child(div().flex_1().min_w(0).h(BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(BAR_HEIGHT).rounded(1).bg(color).w(`${Math.min(100, Math.max(share >= 0.2 ? 3 : 0, share))}%`)))
    .child(div().w(FIGURE_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_size(11.5).text_color(t.muted).child(sizeText(folder.bytes)));
}

// The heaviest folders right under each measured one: where the space actually went.
function largestFolders(t, view, folders) {
  if (!folders.length) return div();
  const column = Math.min(FOLDER_COLUMN_MAX, Math.max(...folders.map((f) => tilde(f.path).length * GLYPH_PX)));
  return v_flex().flex_1().min_h(0).gap(6)
    .child(sectionTitle(t, "Largest folders", "click to open"))
    .child(v_flex().id("disk-folders").flex_shrink(1).min_h(0).rounded(8).border(1).border_color(t.border).bg(t.background).overflow_y_scrollbar()
      .children(folders.map((f, i) => folderRow(t, f, view.usedBytes, column, i === 0))));
}

function clearButton(t, disk, view) {
  const caches = view?.bytes.caches ?? 0;
  const isClearing = view?.job?.kind === "clean";
  const isEnabled = Boolean(view) && !disk.isBusy && caches > 0;
  const isConfirming = view?.isConfirming && isEnabled;
  const text = isClearing ? "Clearing…" : isConfirming ? `Clear ${sizeText(caches)}?` : "Clear caches";
  return h_flex().id("disk-clear").flex_none().h(28).px(12).items_center().rounded(6).border(1)
    .text_size(12).font_medium()
    .border_color(isConfirming ? t.blocked : t.border)
    .bg(isConfirming ? `${t.blocked}24` : t.raised)
    .text_color(isConfirming ? t.blocked : isEnabled ? t.foreground : t.dim)
    .when(isEnabled, (el) => el.cursor_pointer().hover((s) => s.bg(isConfirming ? `${t.blocked}3a` : t.hover)).on_click((_e, cx) => disk.clearCaches(cx)))
    .when(isClearing, (el) => el.opacity(0.6))
    .child(text);
}

function footer(t, disk, view) {
  const caches = view?.bytes.caches ?? 0;
  const text = !view
    ? "Caches show once the scan is done."
    : view.isConfirming
      ? "Deletes the cache folders' files; files in use and Temp files under a day old stay."
      : `Caches are using ${sizeText(caches)}. Apps rebuild them when they need them.`;
  return h_flex().flex_none().h(FOOTER_HEIGHT).px(12).gap(8).items_center().border_t(1).border_color(t.border)
    .child(icon("caches", ICON_SIZE, t.ansi3))
    .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(text))
    .child(clearButton(t, disk, view));
}

export function diskPanel(t, disk, leading, cx) {
  disk.wanted(cx);
  const view = disk.view();
  const cachePaths = (disk.scan?.cachePaths ?? []).map(tilde).join("\n");
  return v_flex().flex_1().min_w(0).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
    .child(v_flex().flex_1().min_h(0).px(12).pb(12).gap(SECTION_GAP)
      .child(title(t, disk, view, leading))
      .child(hero(t, view))
      .child(bar(t, disk, view))
      .when(Boolean(view), (el) => el.child(legend(t, view, cachePaths)).child(largestFolders(t, view, disk.scan?.largest ?? []))))
    .child(footer(t, disk, view));
}
