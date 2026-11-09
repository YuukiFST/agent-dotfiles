// quiet-tools under `claude plugin test`: the Calm toggle, its persisted choice, and the
// transcript rows Calm hides and restores. Ported from Firstmate's firstmate-calm tests
// (MIT, see THIRD_PARTY_NOTICES.md); the working-note cases are upstream's verbatim.
import { describe, expect, test, type Engine } from "claude-code/testing";
import {
  assistantMessage,
  CALM_STORE_KEY,
  calmCommand,
  isHidden,
  isStock,
  spinner,
  taskNotification,
  toolGroup,
  toolResult,
  toolUse,
  userMessage,
  world,
} from "./support";

const sessionStart = { cwd: "/work", surface: "terminal" as const, isInteractive: true };

describe("activation", () => {
  test("registers /calm at session start", async ($, on) => {
    const { journal } = world(on);
    await $.session.start(sessionStart);
    expect(journal.commands).toEqual(["calm"]);
  });

  test("is on before the first toggle, so a fresh install hides tool rows", async ($, on) => {
    world(on);
    expect(isHidden(await $.ui.render(toolUse()))).toBe(true);
    expect(isHidden(await $.ui.render(toolGroup()))).toBe(true);
  });

  test("stays a pass-through while stored off", async ($, on) => {
    const { clock, journal } = world(on, { calm: false });
    await $.session.start(sessionStart);
    expect(isStock(await $.ui.render(spinner()))).toBe(true);
    expect(isStock(await $.ui.render(toolUse()))).toBe(true);
    expect(isStock(await $.ui.render(toolResult()))).toBe(true);
    expect(isStock(await $.ui.render(toolGroup()))).toBe(true);
    expect(isStock(await $.ui.render(taskNotification("completed")))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("hello")))).toBe(true);
    await clock.advance(220 * 8);
    expect(journal.blits).toHaveLength(0);
    expect(journal.toasts).toHaveLength(0);
  });

  test("reads a stored off before session start, so restored rows never draw with a stale on", async ($, on) => {
    world(on, { calm: false });
    expect(isStock(await $.ui.render(toolUse()))).toBe(true);
  });

  test("reads an unrecognized stored value as the default", async ($, on) => {
    const { store } = world(on);
    store.set(CALM_STORE_KEY, "maybe");
    expect(isHidden(await $.ui.render(toolResult()))).toBe(true);
  });
});

describe("/calm", () => {
  test("toggles off: persists off, toasts, redraws every hooked drawing, and leaves no output row", async ($, on) => {
    const { store, journal } = world(on);
    await $.session.start(sessionStart);
    expect(isHidden(await $.ui.render(toolUse()))).toBe(true);
    const answer = await $.command.run(calmCommand());
    expect(answer.text).toBeUndefined();
    expect(store.get(CALM_STORE_KEY)).toBe(false);
    expect(journal.toasts).toEqual(["Calm off"]);
    expect(journal.invalidations).toContain("ui.render");
    expect(isStock(await $.ui.render(toolUse()))).toBe(true);
    expect(isStock(await $.ui.render(spinner()))).toBe(true);
  });

  test("toggles on: persists on and hides tool rows, results and expanded groups", async ($, on) => {
    const { store, journal } = world(on, { calm: false });
    await $.session.start(sessionStart);
    await $.command.run(calmCommand());
    expect(store.get(CALM_STORE_KEY)).toBe(true);
    expect(journal.toasts).toEqual(["Calm on"]);
    expect(isHidden(await $.ui.render(toolUse()))).toBe(true);
    expect(isHidden(await $.ui.render(toolResult()))).toBe(true);
    expect(isHidden(await $.ui.render(toolGroup("g", true)))).toBe(true);
  });

  test("keeps the current choice when the preference cannot be written", async ($, on) => {
    const { store, journal, failWrites } = world(on, { calm: true });
    await $.session.start(sessionStart);
    const redrawsBefore = journal.invalidations.length;
    failWrites("store unavailable");
    await $.command.run(calmCommand());
    expect(store.get(CALM_STORE_KEY)).toBe(true);
    expect(isHidden(await $.ui.render(toolUse()))).toBe(true);
    expect(journal.toasts).toHaveLength(1);
    expect(journal.toasts[0]).toContain("Calm unchanged");
    expect(journal.invalidations).toHaveLength(redrawsBefore);
  });
});

describe("task notification rows", () => {
  test("hides completed background tasks and Monitor events while on", async ($, on) => {
    world(on, { calm: true });
    expect(isHidden(await $.ui.render(taskNotification("completed")))).toBe(true);
    expect(isHidden(await $.ui.render(taskNotification()))).toBe(true);
  });

  test("keeps failed or killed tasks and genuine prompts visible while on", async ($, on) => {
    world(on, { calm: true });
    expect(isStock(await $.ui.render(taskNotification("failed")))).toBe(true);
    expect(isStock(await $.ui.render(taskNotification("killed")))).toBe(true);
    expect(isStock(await $.ui.render(taskNotification("completed", true))), "ctrl+o expanded").toBe(true);
    expect(isStock(await $.ui.render(userMessage("hello there")))).toBe(true);
  });
});

describe("mid-turn working notes", () => {
  type Chunk =
    | { kind: "text"; index: number; text: string }
    | { kind: "tool"; index: number; id: string; name: string }
    | { kind: "stop"; stopReason: string | null; usage: null };

  type Scenario = {
    chunks: Chunk[];
    result: { answer: string; toolUses: { name: string; input: unknown }[]; stopReason: string | null };
  };

  // The hooks beneath the plugin must exist before the test first calls `$`, so one
  // bottom step serves every scenario a test sets before each run.
  function stepper(on: Parameters<typeof world>[0]) {
    const scenario: Scenario = { chunks: [], result: { answer: "", toolUses: [], stopReason: null } };
    on("turn.step", async function* (_$, e) {
      for (const chunk of scenario.chunks) yield chunk as never;
      return { turnId: e.turnId, index: e.index, usage: null, ...scenario.result } as never;
    });
    return (next: Scenario) => {
      scenario.chunks = next.chunks;
      scenario.result = next.result;
    };
  }

  async function runStep($: Engine, agentId?: string) {
    const stream = $.turn.step({ turnId: "turn-1", index: 0, model: "haiku", messageCount: 1, ...(agentId === undefined ? {} : { agentId }) });
    const seen: unknown[] = [];
    let step = await stream.next();
    while (!step.done) {
      seen.push(step.value);
      step = await stream.next();
    }
    return { seen, result: step.value as { answer: string; stopReason: string | null } };
  }

  test("hides brief narration but preserves substantive text before tool calls, and forwards the stream untouched", async ($, on) => {
    const { journal } = world(on, { calm: true });
    const set = stepper(on);
    set({
      chunks: [
        { kind: "text", index: 0, text: "Let me " },
        { kind: "text", index: 0, text: "look first." },
        { kind: "tool", index: 1, id: "t1", name: "Bash" },
        { kind: "text", index: 2, text: "Then I read it.\n" },
        { kind: "stop", stopReason: "tool_use", usage: null },
      ],
      result: { answer: "Let me look first.\nThen I read it.", toolUses: [{ name: "Bash", input: {} }], stopReason: "tool_use" },
    });
    expect(isStock(await $.ui.render(assistantMessage("Let me look first.")))).toBe(true);
    const { seen, result } = await runStep($);
    expect(seen).toHaveLength(5);
    expect(result.answer).toBe("Let me look first.\nThen I read it.");
    expect(journal.invalidations).toContain("ui.render");
    expect(isHidden(await $.ui.render(assistantMessage("Let me look first."))), "brief narration").toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Then I read it.\n"))), "multi-line block").toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Let me look first.\nThen I read it."))), "complete answer").toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Something else"))), "unrelated text").toBe(true);
  });

  test("keeps a final reply visible when its text matches an earlier working note", async ($, on) => {
    const { journal } = world(on, { calm: true });
    const set = stepper(on);
    set({
      chunks: [
        { kind: "text", index: 0, text: "Done." },
        { kind: "tool", index: 1, id: "t1", name: "Bash" },
        { kind: "stop", stopReason: "tool_use", usage: null },
      ],
      result: { answer: "Done.", toolUses: [{ name: "Bash", input: {} }], stopReason: "tool_use" },
    });
    await runStep($);
    expect(isHidden(await $.ui.render(assistantMessage("Done.", "working-note")))).toBe(true);

    set({
      chunks: [{ kind: "text", index: 0, text: "Done." }, { kind: "stop", stopReason: "end_turn", usage: null }],
      result: { answer: "Done.", toolUses: [], stopReason: "end_turn" },
    });
    const redrawsBeforeFinal = journal.invalidations.length;
    const { result } = await runStep($);
    expect(result.stopReason).toBe("end_turn");
    expect(journal.invalidations.length).toBeGreaterThan(redrawsBeforeFinal);
    expect(isStock(await $.ui.render(assistantMessage("Done.", "final-reply")))).toBe(true);
  });

  test("keeps an earlier final reply visible when a later working note reuses its text", async ($, on) => {
    world(on, { calm: true });
    const set = stepper(on);
    set({
      chunks: [{ kind: "text", index: 0, text: "Done." }, { kind: "stop", stopReason: "end_turn", usage: null }],
      result: { answer: "Done.", toolUses: [], stopReason: "end_turn" },
    });
    await runStep($);
    expect(isStock(await $.ui.render(assistantMessage("Done.", "final-reply")))).toBe(true);

    set({
      chunks: [
        { kind: "text", index: 0, text: "Done." },
        { kind: "tool", index: 1, id: "t1", name: "Bash" },
        { kind: "stop", stopReason: "tool_use", usage: null },
      ],
      result: { answer: "Done.", toolUses: [{ name: "Bash", input: {} }], stopReason: "tool_use" },
    });
    await runStep($);
    expect(isStock(await $.ui.render(assistantMessage("Done.", "earlier-final")))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Done.", "later-note")))).toBe(true);
  });

  test("resets final-reply classifications when a new session starts", async ($, on) => {
    const { journal } = world(on, { calm: true });
    const set = stepper(on);
    await $.session.start(sessionStart);
    set({
      chunks: [{ kind: "text", index: 0, text: "Done." }, { kind: "stop", stopReason: "end_turn", usage: null }],
      result: { answer: "Done.", toolUses: [], stopReason: "end_turn" },
    });
    await runStep($);
    expect(isStock(await $.ui.render(assistantMessage("Done.", "session-one-final")))).toBe(true);

    await $.session.start(sessionStart);
    set({
      chunks: [
        { kind: "text", index: 0, text: "Done." },
        { kind: "tool", index: 1, id: "t2", name: "Bash" },
        { kind: "stop", stopReason: "tool_use", usage: null },
      ],
      result: { answer: "Done.", toolUses: [{ name: "Bash", input: {} }], stopReason: "tool_use" },
    });
    await runStep($);
    expect(journal.storeReads).toBe(2);
    expect(journal.sessionMessageReads).toBe(2);
    expect(isHidden(await $.ui.render(assistantMessage("Done.", "session-two-note")))).toBe(true);
  });

  test("treats a response cut off while calling tools as a working note, but not a plain cut-off", async ($, on) => {
    world(on, { calm: true });
    const set = stepper(on);
    set({
      chunks: [{ kind: "text", index: 0, text: "Partial" }, { kind: "stop", stopReason: "max_tokens", usage: null }],
      result: { answer: "Partial", toolUses: [{ name: "Read", input: {} }], stopReason: "max_tokens" },
    });
    await runStep($);
    expect(isHidden(await $.ui.render(assistantMessage("Partial")))).toBe(true);
    set({
      chunks: [{ kind: "text", index: 0, text: "Truncated final" }, { kind: "stop", stopReason: "max_tokens", usage: null }],
      result: { answer: "Truncated final", toolUses: [], stopReason: "max_tokens" },
    });
    await runStep($);
    expect(isStock(await $.ui.render(assistantMessage("Truncated final")))).toBe(true);
  });

  test("ignores subagent steps, which never draw in the main transcript", async ($, on) => {
    world(on, { calm: true });
    const set = stepper(on);
    set({
      chunks: [{ kind: "text", index: 0, text: "Sub note" }, { kind: "stop", stopReason: "tool_use", usage: null }],
      result: { answer: "Sub note", toolUses: [{ name: "Bash", input: {} }], stopReason: "tool_use" },
    });
    await runStep($, "agent-2");
    expect(isStock(await $.ui.render(assistantMessage("Sub note")))).toBe(true);
  });

  test("records notes while off and hides them retroactively when toggled on", async ($, on) => {
    world(on, { calm: false });
    const set = stepper(on);
    set({
      chunks: [{ kind: "text", index: 0, text: "Checking." }, { kind: "stop", stopReason: "tool_use", usage: null }],
      result: { answer: "Checking.", toolUses: [{ name: "Bash", input: {} }], stopReason: "tool_use" },
    });
    await runStep($);
    expect(isStock(await $.ui.render(assistantMessage("Checking.")))).toBe(true);
    await $.command.run(calmCommand());
    expect(isHidden(await $.ui.render(assistantMessage("Checking.")))).toBe(true);
  });

  test("preserves substantive mid-turn text restored from the transcript", async ($, on) => {
    const multiLine = "The result is substantive.\nHere is the context needed to continue.";
    const atThreshold = "x".repeat(240);
    const belowThreshold = "x".repeat(239);
    world(on, {
      calm: true,
      messages: [
        { role: "user", text: "multi-line", toolUses: [] },
        { role: "assistant", text: multiLine, toolUses: [] },
        { role: "assistant", text: "", toolUses: [{}] },
        { role: "user", text: "at threshold", toolUses: [] },
        { role: "assistant", text: atThreshold, toolUses: [] },
        { role: "assistant", text: "", toolUses: [{}] },
        { role: "user", text: "below threshold", toolUses: [] },
        { role: "assistant", text: belowThreshold, toolUses: [] },
        { role: "assistant", text: "", toolUses: [{}] },
        { role: "user", text: "newline collision", toolUses: [] },
        { role: "assistant", text: "Checking.\n", toolUses: [] },
        { role: "assistant", text: "", toolUses: [{}] },
        { role: "user", text: "single-line collision", toolUses: [] },
        { role: "assistant", text: "Checking.", toolUses: [] },
        { role: "assistant", text: "", toolUses: [{}] },
      ],
    });
    expect(isStock(await $.ui.render(assistantMessage(multiLine)))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage(atThreshold)))).toBe(true);
    expect(isHidden(await $.ui.render(assistantMessage(belowThreshold)))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Checking.\n")))).toBe(true);
    expect(isHidden(await $.ui.render(assistantMessage("Checking.")))).toBe(true);
  });

  test("seeds notes from a restored transcript without hiding a colliding final reply", async ($, on) => {
    world(on, {
      calm: true,
      messages: [
        { role: "user", text: "do it", toolUses: [] },
        { role: "assistant", text: "Narration with its own call", toolUses: [{ name: "Bash" }] },
        { role: "assistant", text: "Narration before a tool row", toolUses: [] },
        { role: "assistant", text: "", toolUses: [{ name: "Read" }] },
        { role: "assistant", text: "The final answer", toolUses: [] },
        { role: "user", text: "again", toolUses: [] },
        { role: "assistant", text: "Done.", toolUses: [{ name: "Bash" }] },
        { role: "assistant", text: "Done.", toolUses: [] },
        { role: "user", text: "thanks", toolUses: [] },
        { role: "assistant", text: "Welcome", toolUses: [] },
      ],
    });
    expect(isHidden(await $.ui.render(assistantMessage("Narration with its own call")))).toBe(true);
    expect(isHidden(await $.ui.render(assistantMessage("Narration before a tool row")))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("The final answer")))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Done.")))).toBe(true);
    expect(isStock(await $.ui.render(assistantMessage("Welcome")))).toBe(true);
  });
});
