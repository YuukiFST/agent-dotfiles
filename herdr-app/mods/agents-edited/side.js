// Lado a lado: agentes marcados na lista viram colunas na área principal, sem sair das
// suas abas. Os marcados ficam em shared("side.terminals"). O layout precisa de um stack
// `work-view` com os filhos `main` (a aba ativa) e `side` (uma row que applySide preenche
// com um cabeçalho e um bloco de terminal por agente; com 3 ou 4, vira grade 2x2). Sem esses nós (ex.: dash), não faz nada.
import { layout, shared, setShared, run, terminals } from "herdr";

export const SIDE_KEY = "side.terminals";
const SIDE_MAX = 4;
const STACK = "work-view";
const ROW = "side";

export function sideList() {
  const v = shared(SIDE_KEY);
  return Array.isArray(v) ? v : [];
}

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

export function sideShown() {
  return findNode(layout(), STACK)?.active === ROW;
}

function column(address) {
  const key = address.replace(/[^\w-]/g, "_");
  return {
    id: `side-${key}`,
    type: "column",
    size: { weight: 1 },
    min: 240,
    radius: 10,
    border: { width: 1, color: "border" },
    children: [
      { id: `side-head-${key}`, type: "block", size: { px: 28 }, content: { mod: "agents-edited", props: { sideHeader: address } } },
      { id: `side-term-${key}`, type: "block", size: { weight: 1 }, background: "background", content: { terminal: address } },
    ],
  };
}

// Reescreve a row `side` e mostra ela (ou a aba de novo, quando nada está marcado).
function applySide(list) {
  const tree = JSON.parse(JSON.stringify(layout()));
  const stack = findNode(tree, STACK);
  const row = findNode(tree, ROW);
  if (!stack || !row) return;
  const grid = list.length > 2;
  row.type = grid ? "column" : "row";
  row.children = grid
    ? [list.slice(0, 2), list.slice(2)].map((cols, i) => ({ id: `side-row-${i}`, type: "row", size: { weight: 1 }, gap: 8, children: cols.map(column) }))
    : list.map(column);
  stack.active = list.length ? ROW : "main";
  run("layout.set", { layout: tree });
  run("layout.select", { stack: STACK, child: stack.active });
}

export function toggleSide(address) {
  const list = sideList();
  const next = list.includes(address) ? list.filter((a) => a !== address) : [...list, address].slice(-SIDE_MAX);
  setShared(SIDE_KEY, next);
  applySide(next);
}

// Mostra a visão lado a lado (`side`) ou a aba ativa (`main`), sem mudar quem está marcado.
export function showView(child) {
  if (!findNode(layout(), STACK)) return;
  run("layout.select", { stack: STACK, child });
}

// Tira da visão os terminais que terminaram.
export function pruneSide() {
  const list = sideList();
  if (!list.length) return;
  const live = new Set(terminals().filter((k) => k.state === "live").map((k) => k.address));
  const next = list.filter((a) => live.has(a));
  if (next.length === list.length) return;
  setShared(SIDE_KEY, next);
  applySide(next);
}
