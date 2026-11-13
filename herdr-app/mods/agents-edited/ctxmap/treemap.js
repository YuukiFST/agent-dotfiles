// Where the context goes, averaged over the live sessions: a squarified treemap of components
// and their biggest pieces, heated by share of the context, with a ranked list beside it.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme } from "herdr";

const NUMBER_FONT = "Geist Mono";
const SIDE_WIDTH = 224;
const HEADER = 21;
const INSET = 3;
const BOX_GAP = 2;
const REST = "Other";
const TILES_PER_BOX = 14;
const TOP_CONSUMERS = 10;
const GLIDE_MS = 280;
const MOVE_PX = 1;

// Share of the context from which a tile takes each color.
const HEAT = [
  { from: 0.15, color: "ansi1", label: "15%+" },
  { from: 0.07, color: "ansi3", label: "7%" },
  { from: 0.03, color: "ansi11", label: "3%" },
  { from: 0.01, color: "ansi2", label: "1%" },
  { from: 0, color: "ansi6", label: "<1%" },
];

const heat = (t, share) => t[HEAT.find((h) => share >= h.from).color];
const kilo = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
const amount = (item) => `${item.exact === false ? "~" : ""}${kilo(item.tokens)}`;
const percent = (share) => `${Math.round(share * 100)}%`;
const byTokens = (x, y) => y.tokens - x.tokens;

const namedItems = (category) => (category.items ?? []).filter((p) => p.label !== category.label);

// The tiles: tool calls and results read best per tool; everything else per piece.
function tilesOf(category) {
  return category.byTool?.length > 1 ? category.byTool : namedItems(category);
}

// The pieces a category adds to the overall ranking: itself when it is a single piece, like Thinking.
function consumersOf(category) {
  const pieces = namedItems(category).filter((p) => !p.isRest);
  return pieces.length ? pieces : [category];
}

function addTo(pieces, list) {
  for (const p of list) {
    const sum = pieces.get(p.label) ?? { tokens: 0, exact: true };
    pieces.set(p.label, { tokens: sum.tokens + p.tokens, exact: sum.exact && p.exact !== false });
  }
}

// maps: each session's analyze.mjs result. Null until one is measured.
export function averageContextTree(maps) {
  if (!maps.length) return null;
  const sums = new Map();
  for (const map of maps) {
    for (const c of map.categories) {
      const sum = sums.get(c.key) ?? { key: c.key, label: c.label, tokens: 0, exact: true, tiles: new Map(), items: new Map(), consumers: new Map() };
      sum.tokens += c.tokens;
      sum.exact &&= c.exact !== false;
      addTo(sum.tiles, tilesOf(c));
      addTo(sum.items, namedItems(c));
      addTo(sum.consumers, consumersOf(c));
      sums.set(c.key, sum);
    }
  }
  const categories = [...sums.values()].filter((s) => s.tokens > 0).map((s) => {
    const tokens = s.tokens / maps.length;
    const perSession = (pieces) => [...pieces].map(([label, sum]) => ({ label, tokens: sum.tokens / maps.length, exact: s.exact && sum.exact })).sort(byTokens);
    const children = perSession(s.tiles).slice(0, TILES_PER_BOX);
    const rest = tokens - children.reduce((n, c) => n + c.tokens, 0);
    if (children.length && rest > tokens * 0.01) children.push({ label: REST, tokens: rest, exact: s.exact });
    return { key: s.key, label: s.label, tokens, exact: s.exact, children, items: perSession(s.items), consumers: perSession(s.consumers) };
  }).sort(byTokens);
  return {
    sessions: maps.length,
    average: categories.reduce((n, c) => n + c.tokens, 0),
    sum: maps.reduce((n, m) => n + m.total, 0),
    window: maps.find((m) => m.window)?.window ?? null,
    counted: maps.every((m) => m.counted),
    categories,
    topConsumers: categories.flatMap((c) => c.consumers.map((p) => ({ ...p, category: c.label }))).sort(byTokens).slice(0, TOP_CONSUMERS),
  };
}

const worstRatio = (row, side) => {
  const sum = row.reduce((n, r) => n + r.area, 0);
  return Math.max((side * side * row[0].area) / (sum * sum), (sum * sum) / (side * side * row[row.length - 1].area));
};

// Squarified treemap (Bruls, Huizing, van Wijk). items: biggest first, each with `tokens`.
function squarify(items, box) {
  const total = items.reduce((n, i) => n + i.tokens, 0);
  if (!total || box.w <= 0 || box.h <= 0) return [];
  const scale = (box.w * box.h) / total;
  let rest = items.map((item) => ({ item, area: item.tokens * scale }));
  let { x, y, w, h } = box;
  const placed = [];
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest[0]];
    let next = 1;
    while (next < rest.length && worstRatio([...row, rest[next]], side) <= worstRatio(row, side)) row.push(rest[next++]);
    const thickness = row.reduce((n, r) => n + r.area, 0) / side;
    let along = 0;
    for (const r of row) {
      const length = r.area / thickness;
      placed.push(w >= h
        ? { item: r.item, x, y: y + along, w: thickness, h: length }
        : { item: r.item, x: x + along, y, w: length, h: thickness });
      along += length;
    }
    if (w >= h) { x += thickness; w -= thickness; } else { y += thickness; h -= thickness; }
    rest = rest.slice(row.length);
  }
  return placed;
}

const collapsed = (p) => ({ ...p, x: p.x + p.w / 2, y: p.y + p.h / 2, w: 0, h: 0, opacity: 0 });
const easeOut = (k) => 1 - (1 - k) ** 3;
const between = (from, to, k) => from + (to - from) * k;
const moved = (a, b) => ["x", "y", "w", "h"].some((side) => Math.abs(a[side] - b[side]) >= MOVE_PX);

// Tiles glide between layouts: an arrival grows from its center, a departure shrinks into it. The
// script draws the frames because native transitions do nothing with Windows' "Show animations"
// off; frames run only while a tile moves.
export class TileMotion {
  constructor() {
    this.groups = new Map(); // parent id -> Map(tile id -> { from, to, startedAt, isLeaving })
    this.isMoving = false;
  }

  frame(entry, now) {
    const k = Math.min(1, (now - entry.startedAt) / GLIDE_MS);
    if (k < 1) this.isMoving = true;
    const eased = easeOut(k);
    const { from, to } = entry;
    return { ...to, x: between(from.x, to.x, eased), y: between(from.y, to.y, eased), w: between(from.w, to.w, eased), h: between(from.h, to.h, eased), opacity: between(from.opacity, to.opacity, eased), target: to, isLeaving: entry.isLeaving };
  }

  aim(entry, to, now, isLeaving) {
    entry.from = this.frame(entry, now);
    entry.to = to;
    entry.startedAt = now;
    entry.isLeaving = isLeaving;
  }

  settle(group, tiles, now) {
    const known = this.groups.get(group) ?? new Map();
    this.groups.set(group, known);
    const present = new Set(tiles.map((tile) => tile.id));
    for (const [id, entry] of known) {
      if (present.has(id)) continue;
      if (!entry.isLeaving) this.aim(entry, collapsed(entry.to), now, true);
    }
    for (const tile of tiles) {
      const to = { ...tile, opacity: 1 };
      const entry = known.get(tile.id);
      if (!entry) known.set(tile.id, { from: collapsed(to), to, startedAt: now, isLeaving: false });
      else if (entry.isLeaving || moved(entry.to, to)) this.aim(entry, to, now, false);
      else entry.to = { ...to, x: entry.to.x, y: entry.to.y, w: entry.to.w, h: entry.to.h };
    }
  }

  // The group's tiles at this moment; a departure that finished is dropped.
  framesOf(group, now) {
    const known = this.groups.get(group);
    const shown = [];
    for (const [id, entry] of known) {
      if (entry.isLeaving && now - entry.startedAt >= GLIDE_MS) known.delete(id);
      else shown.push(this.frame(entry, now));
    }
    return shown;
  }
}

function placedAt(el, p, gap) {
  return el.absolute().left(p.x + gap).top(p.y + gap).w(Math.max(0, p.w - 2 * gap)).h(Math.max(0, p.h - 2 * gap)).opacity(p.opacity);
}

function tileText(t, item, w, h, big) {
  return v_flex().w(w).h(h).flex_none().px(6).py(4).gap(2).overflow_hidden()
    .when(w > 46 && h > 24, (el) => el.child(div().truncate().text_size(11).text_color(t.foreground).child(item.label)))
    .when(w > 54 && h > 46, (el) => el.child(div().font_family(NUMBER_FONT).text_size(big ? 15 : 12).text_color(t.muted).child(amount(item))));
}

function tile(t, p, item, whole) {
  const share = item.tokens / whole;
  const color = heat(t, share);
  return placedAt(div().id(p.id), p, 1).rounded(3).overflow_hidden().bg(color + "1f").border(1).border_color(color + "4d")
    .hover((s) => s.bg(color + "38"))
    .tooltip(`${item.label} · ${amount(item)} tokens (${percent(share)})`)
    .child(tileText(t, item, p.target.w, p.target.h, p.target.w > 150 && p.target.h > 70));
}

// The tiles inside a box, or null when it is too small to hold them.
function tilesInBox(box) {
  const inner = { x: INSET, y: HEADER, w: box.w - 2 * (BOX_GAP + 1 + INSET), h: box.h - 2 * (BOX_GAP + 1) - HEADER - INSET };
  if (!box.item.children.length || inner.h < 30 || inner.w < 60) return null;
  return squarify(box.item.children, inner).map((c) => ({ ...c, id: `${box.id}-${c.item.label}` }));
}

function categoryBox(t, p, category, whole, motion, now) {
  const box = p.target;
  if (p.isLeaving || !box.holdsTiles) return tile(t, p, category, whole);
  const share = category.tokens / whole;
  const color = heat(t, share);
  return placedAt(div().id(p.id), p, BOX_GAP).rounded(4).overflow_hidden().bg(color + "0f").border(1).border_color(color + "40")
    .tooltip(`${category.label} · ${amount(category)} tokens (${percent(share)})`)
    .child(h_flex().w(box.w - 2 * (BOX_GAP + 1)).flex_none().h(HEADER).px(6).gap(6).items_center()
      .child(div().flex_1().min_w(0).truncate().text_size(11).font_medium().text_color(t.foreground).child(category.label))
      .child(div().flex_none().font_family(NUMBER_FONT).text_size(11).text_color(t.muted).child(percent(share))))
    .children(motion.framesOf(p.id, now).map((c) => tile(t, c, c.item, whole)));
}

function legend(t) {
  return h_flex().gap(10).items_center().text_size(11).text_color(t.dim)
    .children([...HEAT].reverse().map((h) => h_flex().gap(4).items_center()
      .child(div().size(7).rounded(2).bg(t[h.color]))
      .child(h.label)));
}

function sideItem(t, item, whole) {
  return h_flex().flex_none().gap(8).items_center().pl(10).text_size(11)
    .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(item.label))
    .child(div().flex_none().font_family(NUMBER_FONT).text_color(t.muted).child(amount(item)))
    .child(div().w(30).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(t.dim).child(percent(item.tokens / whole)));
}

function sideRow(t, category, whole, view) {
  const share = category.tokens / whole;
  const color = heat(t, share);
  const isOpen = view.open === category.key;
  return v_flex().flex_none().gap(5)
    .child(v_flex().id(`ctx-side-${category.key}`).gap(3).cursor_pointer().on_click((_e, cx) => view.onToggle(category.key, cx))
      .child(h_flex().gap(8).items_center().text_size(12)
        .child(div().flex_1().min_w(0).truncate().text_color(isOpen ? t.foreground : t.muted).child(category.label))
        .child(div().flex_none().font_family(NUMBER_FONT).text_color(t.foreground).child(amount(category)))
        .child(div().w(30).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(t.dim).child(percent(share))))
      .child(div().h(2).w_full().rounded(1).bg(t.border)
        .child(div().h_full().rounded(1).bg(color).w(`${Math.max(1, share * 100)}%`))))
    .when(isOpen, (el) => el.children(category.items.map((item) => sideItem(t, item, whole))));
}

function consumerRow(t, item, rank, whole) {
  const share = item.tokens / whole;
  return h_flex().id(`ctx-top-${rank}`).flex_none().gap(8).items_center().text_size(11)
    .tooltip(`${item.category} · ${item.label} · ${amount(item)} tokens (${percent(share)})`)
    .child(div().size(7).rounded(2).flex_none().bg(heat(t, share)))
    .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(item.label))
    .child(div().flex_none().font_family(NUMBER_FONT).text_color(t.foreground).child(amount(item)))
    .child(div().w(30).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(t.dim).child(percent(share)));
}

// The biggest single pieces of any category, which the per-category ranking below keeps apart.
function topConsumers(t, tree) {
  return v_flex().flex_none().gap(5).pb(10).border_b(1).border_color(t.border)
    .child(div().text_size(12).text_color(t.dim).child("Top consumers"))
    .children(tree.topConsumers.map((item, rank) => consumerRow(t, item, rank, tree.average)));
}

function scopeSwitch(t, view) {
  const arrow = (id, text, onPress) => div().id(id).w(24).h(20).flex().items_center().justify_center().rounded(4).cursor_pointer()
    .text_size(13).text_color(t.dim).hover((s) => s.bg(t.raised).text_color(t.foreground)).on_click((_e, cx) => onPress(cx)).child(text);
  return h_flex().flex_1().min_w(0).gap(2).items_center()
    .child(arrow("ctx-scope-back", "‹", (cx) => view.onStep(-1, cx)))
    .child(div().min_w(0).truncate().text_size(12).text_color(t.foreground).child(view.scope))
    .child(arrow("ctx-scope-next", "›", (cx) => view.onStep(1, cx)));
}

function sidePanel(t, tree, view) {
  return v_flex().w(SIDE_WIDTH).flex_none().min_h(0).border_l(1).border_color(t.border)
    .child(v_flex().flex_none().px(12).pb(14).gap(4).border_b(1).border_color(t.border)
      .child(div().h(30).flex().items_center().text_size(12).text_color(t.dim).child(tree.sessions === 1 ? "In the context window" : "Average per session"))
      .child(div().font_family(NUMBER_FONT).text_size(20).text_color(t.foreground).child(kilo(tree.average)))
      .child(div().text_size(12).text_color(t.dim).child(tree.sessions === 1 && tree.window ? `of ${kilo(tree.window)} (${percent(tree.average / tree.window)})` : `${tree.sessions} ${tree.sessions === 1 ? "session" : "sessions"} · ${kilo(tree.sum)} total`))
      .when(!tree.counted, (el) => el.child(div().text_size(11).text_color(t.dim).child("Estimated until context-meter runs"))))
    .child(v_flex().id("ctx-ranking").flex_1().min_h(0).px(12).py(14).gap(10).overflow_y_scrollbar()
      .child(topConsumers(t, tree))
      .children(tree.categories.map((c) => sideRow(t, c, tree.average, view))));
}

// The tiles alone, retained so a glide frame rebuilds them and not the board around them. The
// layout runs when the tree or the size changes; a frame only interpolates.
// props: { tree }, null until a session is measured.
export class TreemapTiles extends View {
  init(props) {
    this.update(props);
    this.motion = new TileMotion();
    this.size = null;
    this.isFrameDue = false;
  }

  update(props) {
    this.tree = props.tree;
    this.isArranged = false;
  }

  arrange(now) {
    const { tree, size, motion } = this;
    const placed = size ? squarify(tree.categories, { x: 0, y: 0, w: size.width, h: size.height }) : [];
    const boxes = placed.map((p) => ({ ...p, id: `ctx-${p.item.key}` }));
    const tilesByBox = boxes.map(tilesInBox);
    motion.settle("ctx", boxes.map((box, i) => ({ ...box, holdsTiles: Boolean(tilesByBox[i]) })), now);
    boxes.forEach((box, i) => { if (tilesByBox[i]) motion.settle(box.id, tilesByBox[i], now); });
    this.isArranged = true;
  }

  // A delay above 0 lands past the next vsync and halves the rate; the window draws at most once
  // per vsync, so this does not spin.
  requestFrame(cx) {
    this.isFrameDue = true;
    cx.timer.after(0, (cx) => { this.isFrameDue = false; cx.notify(); });
  }

  render(cx) {
    const { tree, motion } = this;
    if (!tree) return div();
    const t = theme();
    const now = Date.now();
    if (!this.isArranged) this.arrange(now);
    const tiles = div().id("ctx-treemap").relative().flex_1().min_h(0).w_full()
      .on_size_change((next, cx) => { this.size = next; this.isArranged = false; cx.notify(); })
      .children(motion.framesOf("ctx", now).map((p) => categoryBox(t, p, p.item, tree.average, motion, now)));
    if (motion.isMoving && !this.isFrameDue) this.requestFrame(cx);
    motion.isMoving = false;
    return tiles;
  }
}

// view: { scope, onStep(by, cx), open, onToggle(key, cx), leading }: the sessions shown, the opened
// row, and what opens the header (kept even with nothing to map, or the panel could not be left).
// tiles: the retained TreemapTiles.
export function contextTreemap(t, tree, view, tiles) {
  const panel = h_flex().items_stretch().flex_1().min_w(0).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden();
  // The header is as tall as the summary strip and the Notes header, so the first rows share a line.
  if (!tree) return panel.child(h_flex().h(30).px(12).items_center().child(view.leading));
  return panel
    .child(v_flex().flex_1().min_w(0).px(12).pb(12).gap(8)
      .child(h_flex().h(30).flex_none().min_w(0).overflow_hidden().gap(12).items_center()
        .child(view.leading)
        .child(scopeSwitch(t, view))
        .child(legend(t)))
      .child(tiles))
    .child(sidePanel(t, tree, view));
}
