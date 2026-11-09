// quiet-tools: a port of Firstmate's Calm mod (MIT, see THIRD_PARTY_NOTICES.md) without
// the Firstmate-only parts (operational inputs, doorbell records, supervision notes).
//
// While Calm is on: the Spinner becomes the black-hole art, its disk shimmer repainted
// through `$.ui.blit` on its own tick; ToolUse, ToolResult and ToolGroup draw at zero
// height; an AssistantMessage recorded as a mid-turn working note draws at zero height;
// a completed background-task or Monitor notification row draws at zero height.
// `/calm` toggles and persists the choice in `$.store`. Nothing rewrites a message: the
// transcript, model context and session storage stay as the engine keeps them.
import type { EngineInterface, Register, RenderElement, RenderInput } from "claude-code";

import { BLACK_HOLE_RASTER_KEY, BLACK_HOLE_TICK_MS, packBlackHoleCells } from "../lib/black-hole";
import { rasterColumns } from "../lib/raster";
import { classifyRestoredTranscript, stepTextIsWorkingNote, workingNoteKey } from "../lib/calm-presentation";
import { isQuietNotification } from "./narration";

const CALM_COMMAND = "calm";
const CALM_STORE_KEY = "calm";
// Calm is on until the first `/calm` turns it off; Firstmate's Calm starts off.
const CALM_DEFAULT = true;

// One module environment holds one Calm state; a hot reload starts a fresh one.
let calm = CALM_DEFAULT;
let loading: Promise<void> | undefined;
let ticker: { cancel(): void } | undefined;
const workingNotes = new Set<string>();
const finalReplies = new Set<string>();
// The shimmer's step; it advances only while some Spinner site shows the art.
let tick = 0;
// Every Spinner site drawing the art, by requestId, with the Raster size a blit must repeat.
const sites = new Map<string, { columns: number; rows: number }>();

/** A stored choice reads as that choice; anything else keeps the default. */
function parseCalmChoice(stored: unknown): boolean {
  return typeof stored === "boolean" ? stored : CALM_DEFAULT;
}

async function load($: EngineInterface): Promise<void> {
  try {
    calm = parseCalmChoice(await $.store.get(CALM_STORE_KEY));
  } catch {
    calm = CALM_DEFAULT;
  }
  try {
    const restored = classifyRestoredTranscript(await $.session.messages());
    for (const note of restored.workingNotes) workingNotes.add(note);
    for (const reply of restored.finalReplies) finalReplies.add(reply);
  } catch {
    // A transcript that cannot be read leaves restored narration visible.
  }
  if (ticker === undefined) {
    ticker = $.clock.every(BLACK_HOLE_TICK_MS, () => {
      void repaintBlackHole($);
    });
  }
  $.ui.invalidate("ui.render");
}

// A resumed transcript or a hot reload can draw restored rows before `session.start`,
// so every hook awaits this load rather than trusting the default.
function ensureLoaded($: EngineInterface): Promise<void> {
  if (loading === undefined) loading = load($);
  return loading;
}

async function resetSession($: EngineInterface): Promise<void> {
  if (loading !== undefined) await loading.catch(() => undefined);
  calm = CALM_DEFAULT;
  loading = undefined;
  workingNotes.clear();
  finalReplies.clear();
  sites.clear();
  tick = 0;
  await ensureLoaded($);
}

/** One scheduler tick: advance the shimmer, then repaint every mounted art in place. */
async function repaintBlackHole($: EngineInterface): Promise<void> {
  if (!calm || sites.size === 0) return;
  tick += 1;
  for (const [requestId, site] of sites) {
    const packed = packBlackHoleCells(site.columns, tick);
    const result = await $.ui.blit({
      requestId,
      key: BLACK_HOLE_RASTER_KEY,
      cells: packed.cells,
      columns: site.columns,
      rows: site.rows,
    });
    // A denied blit means the site no longer shows this Raster; forget it until the next Spinner drawing.
    if (result.deny !== undefined && sites.get(requestId) === site) sites.delete(requestId);
  }
}

/** A zero-height drawing: the row contributes nothing to the transcript's layout. */
function hiddenRow($: EngineInterface, e: RenderInput): RenderElement {
  const { Box } = $.ui.resolve(e);
  return Box({ display: "none" });
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await resetSession($);
    await $.command.register({
      name: CALM_COMMAND,
      description: "Toggle Calm: conversation-only transcript and the black-hole working art.",
    });
    return next(e);
  });

  on("command.run", { command: CALM_COMMAND }, async ($) => {
    await ensureLoaded($);
    const active = !calm;
    // Persist before changing live presentation, so a failed write leaves the choice unchanged.
    try {
      await $.store.set(CALM_STORE_KEY, active);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      $.ui.toast(`Calm unchanged: could not save the preference (${reason})`);
      return {};
    }
    calm = active;
    if (!calm) sites.clear();
    $.ui.invalidate("ui.render");
    $.ui.toast(active ? "Calm on" : "Calm off");
    // No `text`: the toggle leaves no output row in the transcript.
    return {};
  });

  // Record mid-turn narration as it streams: the text blocks of a model step that
  // stopped to call tools. Subagent steps never draw in the main transcript.
  on("turn.step", async function* ($, e, next) {
    const stream = next(e);
    const blocks = new Map<number, string>();
    for await (const chunk of stream) {
      if (chunk.kind === "text") blocks.set(chunk.index, (blocks.get(chunk.index) ?? "") + chunk.text);
      yield chunk;
    }
    const result = await stream.result;
    if (e.agentId !== undefined) return result;
    let changed = false;
    for (const text of [...blocks.values(), result.answer]) {
      const key = workingNoteKey(text);
      if (key === "") continue;
      if (stepTextIsWorkingNote(result, text)) {
        if (finalReplies.has(key) || workingNotes.has(key)) continue;
        workingNotes.add(key);
        changed = true;
        continue;
      }
      if (!finalReplies.has(key)) {
        finalReplies.add(key);
        changed = true;
      }
      if (workingNotes.delete(key)) changed = true;
    }
    if (changed && calm) $.ui.invalidate("ui.render");
    return result;
  });

  on("ui.render", { component: "Spinner" }, async ($, e, next) => {
    await ensureLoaded($);
    if (!calm || e.surface !== "terminal") {
      sites.delete(e.requestId);
      return next(e);
    }
    const columns = rasterColumns(e.viewport?.columns);
    const packed = packBlackHoleCells(columns, tick);
    sites.set(e.requestId, { columns, rows: packed.rows });
    const { Box, Raster } = $.ui.resolve(e);
    // One blank row above the art keeps it off the highlighted prompt.
    return Box({
      flexDirection: "column",
      paddingTop: 1,
      children: Raster({ key: BLACK_HOLE_RASTER_KEY, columns, rows: packed.rows, cells: packed.cells }),
    });
  });

  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    await ensureLoaded($);
    return calm ? hiddenRow($, e) : next(e);
  });

  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    await ensureLoaded($);
    return calm ? hiddenRow($, e) : next(e);
  });

  on("ui.render", { component: "ToolGroup" }, async ($, e, next) => {
    await ensureLoaded($);
    return calm ? hiddenRow($, e) : next(e);
  });

  // "Background command ... completed" and "Monitor event: ..." rows are Claude Code's
  // operational inputs, the rows Firstmate's Calm hides for its own watcher wakes.
  on("ui.render", { component: "UserMessage" }, async ($, e, next) => {
    await ensureLoaded($);
    if (!calm || e.props.origin.kind !== "task-notification" || e.props.isExpanded || !isQuietNotification(e.props.task?.status)) {
      return next(e);
    }
    return hiddenRow($, e);
  });

  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    await ensureLoaded($);
    const key = workingNoteKey(e.props.text);
    return calm && workingNotes.has(key) && !finalReplies.has(key) ? hiddenRow($, e) : next(e);
  });
};
