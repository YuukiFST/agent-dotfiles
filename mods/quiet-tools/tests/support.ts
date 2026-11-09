// Shared fixtures for the quiet-tools suites under `claude plugin test`, ported from
// Firstmate's firstmate-calm tests (MIT, see THIRD_PARTY_NOTICES.md).
//
// Each test mocks the world beneath the plugin noun by noun: the plugin store holding
// the Calm choice, the engine's own draw for every component the mod passes through,
// and a journal of every call the mod makes on `$`.
import type { On, SessionMessage } from "claude-code";
import { mock, type MockClock } from "claude-code/testing";

export const CALM_STORE_KEY = "calm";

export type Journal = {
  commands: string[];
  toasts: string[];
  invalidations: string[];
  blits: { requestId: string; key: string; columns?: number; rows?: number; cells: string }[];
  stock: string[];
  storeReads: number;
  sessionMessageReads: number;
};

export type World = {
  clock: MockClock;
  store: Map<string, unknown>;
  journal: Journal;
  /** Set to deny every `$.ui.blit` from now on, as an unmounted site does. */
  denyBlits: (reason: string | undefined) => void;
  /** Set to reject every `$.store.set` from now on. */
  failWrites: (reason: string | undefined) => void;
};

export type WorldOptions = {
  /** The stored Calm choice; absent means never toggled. */
  calm?: boolean;
  /** What `$.session.messages()` answers. */
  messages?: readonly { role: "user" | "assistant"; text: string; toolUses: readonly unknown[] }[];
};

/** The engine's own drawing, as the bottom of every `ui.render` chain. */
export const STOCK_TEXT = "STOCK-DRAWING";

export function world(on: On, options: WorldOptions = {}): World {
  const clock = mock.clock(on);
  const store = new Map<string, unknown>();
  if (options.calm !== undefined) store.set(CALM_STORE_KEY, options.calm);
  const journal: Journal = {
    commands: [],
    toasts: [],
    invalidations: [],
    blits: [],
    stock: [],
    storeReads: 0,
    sessionMessageReads: 0,
  };
  let blitDenial: string | undefined;
  let writeFailure: string | undefined;

  on("store.get", async (_$, e) => {
    journal.storeReads += 1;
    return { value: store.get(e.key) };
  });
  on("store.set", async (_$, e) => {
    if (writeFailure !== undefined) return { deny: writeFailure };
    store.set(e.key, e.value);
    return { value: undefined };
  });
  on("command.register", async (_$, e) => {
    journal.commands.push(e.name);
    return { value: { command: e.name } };
  });
  on("ui.toast", async (_$, e) => {
    journal.toasts.push(e.text);
    return { value: undefined };
  });
  on("ui.invalidate", async (_$, e) => {
    journal.invalidations.push(e.event);
    return { value: undefined };
  });
  on("ui.blit", async (_$, e) => {
    journal.blits.push({ requestId: e.requestId, key: e.key, columns: e.columns, rows: e.rows, cells: "cells" in e ? e.cells : "" });
    return { value: blitDenial === undefined ? {} : { deny: blitDenial } };
  });
  on("session.messages", async () => {
    journal.sessionMessageReads += 1;
    return { value: [...(options.messages ?? [])] as SessionMessage[] };
  });
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("ui.render", async (_$, e) => {
    journal.stock.push(e.component);
    return { type: "Text", props: {}, children: [STOCK_TEXT] };
  });

  return {
    clock,
    store,
    journal,
    denyBlits: (reason) => {
      blitDenial = reason;
    },
    failWrites: (reason) => {
      writeFailure = reason;
    },
  };
}

export const VIEWPORT = { columns: 40, rows: 24 } as const;

export function spinner(requestId = "agent-main", viewport: { columns: number; rows: number } = VIEWPORT) {
  return {
    surface: "terminal" as const,
    component: "Spinner" as const,
    requestId,
    viewport,
    props: { word: "Sauteing", message: null, suffix: "", mode: "requesting" as const },
  };
}

/** A Spinner drawing before any surface has measured: no viewport at all. */
export function unmeasuredSpinner(requestId = "agent-main") {
  return {
    surface: "terminal" as const,
    component: "Spinner" as const,
    requestId,
    props: { word: "Sauteing", message: null, suffix: "", mode: "requesting" as const },
  };
}

export function toolUse(requestId = "tool-1") {
  return {
    surface: "terminal" as const,
    component: "ToolUse" as const,
    requestId,
    viewport: VIEWPORT,
    props: { tool_use_id: requestId, tool: "Bash", input: { command: "ls" }, isRunning: false, isErrored: false, isInterrupted: false },
  };
}

export function toolResult(requestId = "tool-1") {
  return {
    surface: "terminal" as const,
    component: "ToolResult" as const,
    requestId,
    viewport: VIEWPORT,
    props: { tool_use_id: requestId, tool: "Bash", output: { stdout: "x", stderr: "" }, isErrored: false },
  };
}

export function toolGroup(requestId = "group-1", isExpanded = false) {
  return {
    surface: "terminal" as const,
    component: "ToolGroup" as const,
    requestId,
    viewport: VIEWPORT,
    props: { calls: [], isActive: false, isExpanded },
  };
}

export function userMessage(text: string, requestId = "user-1") {
  return {
    surface: "terminal" as const,
    component: "UserMessage" as const,
    requestId,
    viewport: VIEWPORT,
    props: { text, origin: { kind: "composer" as const }, isExpanded: false },
  };
}

/** A background-task or Monitor notification row; `status` absent is a Monitor event. */
export function taskNotification(status?: "completed" | "failed" | "killed", isExpanded = false, requestId = "note-1") {
  return {
    surface: "terminal" as const,
    component: "UserMessage" as const,
    requestId,
    viewport: VIEWPORT,
    props: {
      text: "Background command completed",
      origin: { kind: "task-notification" as const },
      isExpanded,
      ...(status === undefined ? {} : { task: { status } }),
    },
  };
}

export function assistantMessage(text: string, requestId = "assistant-1") {
  return {
    surface: "terminal" as const,
    component: "AssistantMessage" as const,
    requestId,
    viewport: VIEWPORT,
    props: { text, isFirstOfReply: true },
  };
}

export function calmCommand() {
  return {
    command: "calm",
    args: "",
    origin: { kind: "composer" as const },
    presentation: { layout: "main" as const, isFullscreen: false, columns: 80 },
  };
}

/** Whether a drawing is the mod's zero-height box. */
export function isHidden(tree: unknown): boolean {
  return JSON.stringify(tree).includes('"display":"none"');
}

/** Whether a drawing is the engine's own. */
export function isStock(tree: unknown): boolean {
  return JSON.stringify(tree).includes(STOCK_TEXT);
}

function drawingNodes(tree: unknown): unknown[] {
  const seen: unknown[] = [tree];
  const nodes: unknown[] = [];
  while (seen.length > 0) {
    const node = seen.pop();
    if (node === null || typeof node !== "object") continue;
    nodes.push(node);
    const element = node as { props?: Record<string, unknown>; children?: unknown };
    if (Array.isArray(element.children)) seen.push(...element.children);
    else if (element.children !== undefined) seen.push(element.children);
    if (element.props !== undefined && "children" in element.props) seen.push(element.props.children);
  }
  return nodes;
}

/** The Box wrapping a Spinner Raster, or undefined when the drawing has none. */
export function boxOf(tree: unknown): { props?: Record<string, unknown> } | undefined {
  for (const node of drawingNodes(tree)) {
    const element = node as { type?: unknown; props?: Record<string, unknown> };
    if (element.type === "Box" && element.props !== undefined && rasterOf(element) !== undefined) {
      return element;
    }
  }
  return undefined;
}

/** The Raster element inside a Spinner drawing, or undefined when the drawing has none. */
export function rasterOf(tree: unknown): { columns: number; rows: number; cells: string; key: string } | undefined {
  for (const node of drawingNodes(tree)) {
    const element = node as { type?: unknown; props?: Record<string, unknown> };
    if (element.type === "Raster" && element.props !== undefined) {
      return element.props as { columns: number; rows: number; cells: string; key: string };
    }
  }
  return undefined;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decode packed cells back into rows of glyphs and foregrounds, the way the surface reads them. */
export function decodeCells(cells: string, columns: number, rows: number): { glyphs: string[]; foregrounds: number[][]; backgrounds: number[][] } {
  const clean = cells.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  const words = new Uint32Array(new Uint8Array(bytes).buffer);
  if (words.length !== columns * rows * 3) {
    throw new Error(`cells decode to ${words.length} words, not ${columns * rows * 3}`);
  }
  const glyphs: string[] = [];
  const foregrounds: number[][] = [];
  const backgrounds: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    let text = "";
    const fg: number[] = [];
    const bg: number[] = [];
    for (let column = 0; column < columns; column += 1) {
      const offset = (row * columns + column) * 3;
      text += String.fromCodePoint(words[offset]!);
      fg.push(words[offset + 1]!);
      bg.push(words[offset + 2]!);
    }
    glyphs.push(text);
    foregrounds.push(fg);
    backgrounds.push(bg);
  }
  return { glyphs, foregrounds, backgrounds };
}
