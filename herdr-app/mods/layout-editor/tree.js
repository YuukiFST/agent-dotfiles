// Pure edits on a layout tree (layouts/*.json): every function returns a new tree.

export const clone = (tree) => JSON.parse(JSON.stringify(tree));

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return null;
}

export function parentOf(node, id) {
  for (const child of node?.children ?? []) {
    if (child.id === id) return node;
    const hit = parentOf(child, id);
    if (hit) return hit;
  }
  return null;
}

export const newId = () => "b" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const isContainer = (n) => n.type === "row" || n.type === "column";

/** True for the block that shows the sessions: removing it leaves no terminal on screen. */
export const isSessions = (n) => n?.type === "block" && n.content?.tab === "active";

export function containsSessions(node) {
  return isSessions(node) || (node?.children ?? []).some(containsSessions);
}

export function label(n) {
  if (!n) return "";
  if (n.type === "block") {
    if (n.content?.mod) return n.content.mod;
    if (n.content?.tab) return "sessions";
    if (n.content?.terminal) return `terminal ${n.content.terminal}`;
    if (n.content?.agent) return "focused agent";
    return "empty";
  }
  return { row: "row", column: "column", stack: "stack" }[n.type] ?? n.type;
}

/** Puts a new block beside `id`, wrapping it in a row (right) or column (down) unless its parent already runs that way. */
export function split(tree, id, dir, content) {
  const t = clone(tree);
  const node = find(t, id), parent = parentOf(t, id);
  const type = dir === "right" ? "row" : "column";
  const block = { id: newId(), type: "block", content, size: { weight: 1 } };
  if (parent && parent.type === type) {
    parent.children.splice(parent.children.indexOf(node) + 1, 0, block);
    return { tree: t, created: block.id };
  }
  if (!parent) {
    // The root keeps its id and root-only fields; its old children move into a new inner node.
    const inner = { ...clone(node), id: newId(), size: { weight: 1 } };
    for (const k of ["titlebar", "traffic_lights", "terminal_padding", "terminal_menu", "cloned_from"]) delete inner[k];
    node.type = type; node.children = [inner, block];
    delete node.content;
    return { tree: t, created: block.id };
  }
  const wrap = { id: newId(), type, size: node.size ?? { weight: 1 }, children: [{ ...node, size: { weight: 1 } }, block] };
  parent.children[parent.children.indexOf(node)] = wrap;
  return { tree: t, created: block.id };
}

/** Removes a node; a container left with one child is replaced by that child. */
export function remove(tree, id) {
  const t = clone(tree);
  const parent = parentOf(t, id);
  if (!parent) return t;
  parent.children = parent.children.filter((c) => c.id !== id);
  if (parent.children.length === 1 && parent.type !== "stack") {
    const only = parent.children[0], grand = parentOf(t, parent.id);
    if (grand) grand.children[grand.children.indexOf(parent)] = { ...only, size: parent.size ?? only.size };
  }
  return t;
}

export function move(tree, id, step) {
  const t = clone(tree);
  const parent = parentOf(t, id);
  if (!parent) return t;
  const i = parent.children.findIndex((c) => c.id === id), j = i + step;
  if (j < 0 || j >= parent.children.length) return t;
  [parent.children[i], parent.children[j]] = [parent.children[j], parent.children[i]];
  return t;
}

export function update(tree, id, patch) {
  const t = clone(tree);
  const node = find(t, id);
  if (!node) return t;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete node[k];
    else node[k] = v;
  }
  return t;
}

export function flip(tree, id) {
  const node = find(tree, id);
  if (!node || !isContainer(node)) return tree;
  return update(tree, id, { type: node.type === "row" ? "column" : "row" });
}

/** Every visible weighted child of a container gets the same weight. */
export function equalize(tree, id) {
  const t = clone(tree);
  for (const c of find(t, id)?.children ?? []) if (!c.size?.px) c.size = { weight: 1 };
  return t;
}

/** The block that shows the sessions, or null. */
export function findSessions(node) {
  if (isSessions(node)) return node;
  for (const child of node?.children ?? []) {
    const hit = findSessions(child);
    if (hit) return hit;
  }
  return null;
}

/** Sessions content with framed panes and the pane-info header, as the dev layout draws them. */
export function sessionsContent() {
  return {
    tab: "active",
    pane: {
      header: { content: { mod: "pane-info" }, reveal: "always", height: 30, position: "top" },
      background: "background",
      border: { width: 1, color: "border" },
      focus: { width: 1, color: "accent" },
      radius: 10,
      gap: 8,
      lone: true,
    },
  };
}

/** Two blocks trade what they show; sizes and places stay. */
export function swapContent(tree, a, b) {
  const t = clone(tree);
  const x = find(t, a), y = find(t, b);
  if (!x || !y) return t;
  [x.content, y.content] = [y.content, x.content];
  return t;
}

const EDGE = { left: { type: "row", after: false }, right: { type: "row", after: true }, up: { type: "column", after: false }, down: { type: "column", after: true } };

/** Puts `block` on one side of `targetId`, taking half of the target's room (tiling: i3, Hyprland). */
export function insertBeside(tree, targetId, zone, block) {
  const t = clone(tree);
  const target = find(t, targetId), parent = parentOf(t, targetId);
  const { type, after } = EDGE[zone];
  const weight = target?.size?.weight;
  if (parent && parent.type === type && weight !== undefined) {
    // Same direction: split the target's weight in two, so the rest of the row keeps its room.
    target.size = { weight: weight / 2 };
    parent.children.splice(parent.children.indexOf(target) + (after ? 1 : 0), 0, { ...block, size: { weight: weight / 2 } });
    return t;
  }
  const kids = [{ ...target, size: { weight: 1 } }, { ...block, size: { weight: 1 } }];
  const wrap = { id: newId(), type, size: target.size ?? { weight: 1 }, children: after ? kids : kids.reverse() };
  if (!parent) {
    // The root keeps its id and root-only fields; its old content moves into the wrap.
    const inner = { ...clone(target), id: newId(), size: { weight: 1 } };
    for (const k of ["titlebar", "traffic_lights", "terminal_padding", "terminal_menu", "cloned_from", "background", "divider"]) delete inner[k];
    const children = after ? [inner, { ...block, size: { weight: 1 } }] : [{ ...block, size: { weight: 1 } }, inner];
    for (const k of ["content", "children", "active"]) delete target[k];
    target.type = type; target.children = children;
    return t;
  }
  parent.children[parent.children.indexOf(target)] = wrap;
  return t;
}

/** Moves block `fromId` onto `targetId`: an edge zone splits the target there, "center" swaps them. */
export function dock(tree, fromId, targetId, zone) {
  if (fromId === targetId) return tree;
  if (zone === "center") return swapContent(tree, fromId, targetId);
  const block = clone(find(tree, fromId));
  if (!block || !find(tree, targetId)) return tree;
  delete block.min; delete block.max;
  return insertBeside(remove(tree, fromId), targetId, zone, block);
}

/** A new block with `content` on one side of `targetId`, or in its place ("center"). */
export function dropContent(tree, targetId, zone, content) {
  if (zone === "center") return update(tree, targetId, { content });
  return insertBeside(tree, targetId, zone, { id: newId(), type: "block", content });
}

/** Which part of a block the pointer is over: the middle third swaps, else the nearest edge. */
export function zoneAt(x, y, width, height) {
  const rx = x / width, ry = y / height;
  if (rx > 1 / 3 && rx < 2 / 3 && ry > 1 / 3 && ry < 2 / 3) return "center";
  const d = { left: rx, right: 1 - rx, up: ry, down: 1 - ry };
  return Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
}
