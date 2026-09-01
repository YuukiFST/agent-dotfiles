import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAssistantMessageEventStream,
  calculateCost,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type StopReason,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "opencode";
const AGENT = "build";

// Keep in sync with `opencode models` — stale IDs fail with exit code 1.
const OPENCODE_MODELS: Array<{
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
}> = [
  {
    id: "big-pickle",
    name: "Big Pickle",
    reasoning: true,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "deepseek-v4-flash-free",
    name: "DeepSeek V4 Flash Free",
    reasoning: true,
    input: ["text"],
    contextWindow: 300000,
    maxTokens: 16384,
  },
  {
    id: "minimax-m2.5-free",
    name: "MiniMax M2.5 Free",
    reasoning: true,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "nemotron-3-super-free",
    name: "Nemotron 3 Super Free",
    reasoning: true,
    input: ["text"],
    contextWindow: 1000000,
    maxTokens: 128000,
  },
  {
    id: "qwen3.6-plus-free",
    name: "Qwen 3.6 Plus Free",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 32000,
  },
];
const SESSION_FILE = path.join(
  os.homedir(),
  ".pi",
  "agent",
  "opencode-session.json",
);
const NO_TOOLS_INSTRUCTION =
  "Reply with plain text only. Do not use any tools, do not execute commands, do not read or write files.";

const VARIANT_BY_THINKING: Record<string, string | undefined> = {
  off: undefined,
  minimal: "minimal",
  low: "minimal",
  medium: "medium",
  high: "high",
  xhigh: "max",
  max: "max",
};

function loadSessionID(modelId: string): string | undefined {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const data = JSON.parse(raw) as {
      sessionID?: string;
      sessions?: Record<string, string>;
    };
    if (data.sessions && typeof data.sessions === "object") {
      return data.sessions[modelId];
    }
    // legacy single-session file: only reuse for the original deepseek model
    if (data.sessionID && modelId === "deepseek-v4-flash-free") {
      return data.sessionID;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function saveSessionID(modelId: string, sessionID: string): void {
  try {
    let existing: { sessionID?: string; sessions?: Record<string, string> } =
      {};
    try {
      existing = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    } catch {
      existing = {};
    }
    const sessions: Record<string, string> = { ...(existing.sessions ?? {}) };
    // migrate legacy
    if (existing.sessionID && !sessions["deepseek-v4-flash-free"]) {
      sessions["deepseek-v4-flash-free"] = existing.sessionID;
    }
    sessions[modelId] = sessionID;
    // keep legacy field for backwards compat (point to last written)
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessionID, sessions }));
  } catch {
    /* non-fatal */
  }
}

function clearSessionID(modelId: string): void {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const data = JSON.parse(raw) as {
      sessions?: Record<string, string>;
      sessionID?: string;
    };
    if (!data.sessions) return;
    const oldSession = data.sessions[modelId];
    delete data.sessions[modelId];
    // also clear stale field if it pointed to the cleared session
    if (data.sessionID && data.sessionID === oldSession) {
      const remaining = Object.values(data.sessions);
      if (remaining.length > 0) {
        data.sessionID = remaining[0];
      } else {
        delete (data as { sessionID?: string }).sessionID;
      }
    }
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data));
  } catch {
    /* non-fatal */
  }
}

function formatContent(
  content: string | { type: string; text?: string }[],
): string {
  if (typeof content === "string") return content;
  return content
    .map((block) =>
      block.type === "text"
        ? (block.text ?? "")
        : block.type === "image"
          ? "[image]"
          : "",
    )
    .filter(Boolean)
    .join("\n");
}

function waitForSpawn(proc: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    proc.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            "opencode CLI not found on PATH. On NixOS: nix profile install nixpkgs#opencode. Else: https://opencode.ai/docs",
          ),
        );
        return;
      }
      reject(error);
    });
    proc.once("spawn", () => resolve());
  });
}

function extractOpenCodeError(stdout: string, stderr: string): string | undefined {
  for (const line of `${stdout}\n${stderr}`.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        error?: { data?: { message?: string }; message?: string };
      };
      if (event.type !== "error") continue;
      const message =
        event.error?.data?.message ?? event.error?.message ?? undefined;
      if (message) return message;
    } catch {
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function mapStopReason(reason: string | undefined): StopReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_use":
    case "toolUse":
      return "toolUse";
    case "aborted":
      return "aborted";
    case "error":
      return "error";
    default:
      return "error";
  }
}

function streamOpenCode(
  model: Model<"opencode-cli">,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "pending",
      timestamp: Date.now(),
    };

    const textBlocks = new Map<number, { index: number; text: string }>();
    const thinkingBlocks = new Map<
      number,
      { index: number; thinking: string }
    >();
    let spawnedSessionID: string | undefined;
    let stdout = "";
    let stderr = "";

    try {
      const lastUser = [...context.messages]
        .reverse()
        .find((m) => m.role === "user");
      const prompt = [
        context.systemPrompt
          ? `System instructions:\n${context.systemPrompt}`
          : undefined,
        NO_TOOLS_INSTRUCTION,
        lastUser ? formatContent(lastUser.content) : "",
      ]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join("\n\n");

      const targetModel = `${PROVIDER_ID}/${model.id}`;
      const args = [
        "run",
        "--format",
        "json",
        "-m",
        targetModel,
        "--agent",
        AGENT,
      ];
      const sessionID = loadSessionID(model.id);
      if (sessionID) args.push("--session", sessionID);
      const variant = options?.reasoning
        ? VARIANT_BY_THINKING[options.reasoning]
        : undefined;
      if (variant) args.push("--variant", variant);

      const proc = spawn("opencode", args, {
        signal: options?.signal,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: process.platform === "win32",
      });

      await waitForSpawn(proc);

      proc.stdin.write(prompt);
      proc.stdin.end();

      let buffer = "";
      proc.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout += text;
        buffer += text;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          let event: {
            type?: string;
            sessionID?: string;
            part?: Record<string, unknown> & {
              type?: string;
              text?: string;
              reason?: string;
              tokens?: Record<string, unknown>;
            };
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (!event.part) continue;
          spawnedSessionID ??= event.sessionID;
          const part = event.part;

          if (event.type === "text" && part.type === "text") {
            if (!textBlocks.has(0)) {
              const index = output.content.length;
              textBlocks.set(0, { index, text: "" });
              output.content.push({ type: "text", text: "" });
              stream.push({
                type: "text_start",
                contentIndex: index,
                partial: output,
              });
            }
            const block = textBlocks.get(0)!;
            block.text += part.text ?? "";
            (output.content[block.index] as { text: string }).text = block.text;
            stream.push({
              type: "text_delta",
              contentIndex: block.index,
              delta: part.text ?? "",
              partial: output,
            });
          } else if (event.type === "reasoning" && part.type === "reasoning") {
            let entry = thinkingBlocks.get(0);
            if (!entry) {
              entry = { index: output.content.length, thinking: "" };
              thinkingBlocks.set(0, entry);
              output.content.push({ type: "thinking", thinking: "" });
              stream.push({
                type: "thinking_start",
                contentIndex: entry.index,
                partial: output,
              });
            }
            entry.thinking += part.text ?? "";
            (output.content[entry.index] as { thinking: string }).thinking =
              entry.thinking;
            stream.push({
              type: "thinking_delta",
              contentIndex: entry.index,
              delta: part.text ?? "",
              partial: output,
            });
          } else if (
            event.type === "step_finish" &&
            part.type === "step-finish"
          ) {
            output.stopReason = mapStopReason(part.reason);
            const tokens = part.tokens as Record<string, unknown> | undefined;
            if (tokens) {
              output.usage.input = Number(tokens.input) || 0;
              output.usage.output = Number(tokens.output) || 0;
              output.usage.cacheRead =
                Number((tokens.cache as Record<string, unknown>)?.read) || 0;
              output.usage.cacheWrite =
                Number((tokens.cache as Record<string, unknown>)?.write) || 0;
              output.usage.totalTokens = Number(tokens.total) || 0;
              calculateCost(model, output.usage);
            }
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const exitCode = await new Promise<number | null>((resolve) =>
        proc.on("close", resolve),
      );

      for (const block of textBlocks.values()) {
        stream.push({
          type: "text_end",
          contentIndex: block.index,
          content: block.text,
          partial: output,
        });
      }
      for (const block of thinkingBlocks.values()) {
        stream.push({
          type: "thinking_end",
          contentIndex: block.index,
          content: block.thinking,
          partial: output,
        });
      }

      if (options?.signal?.aborted) {
        throw new Error("Request was aborted");
      }
      if (exitCode !== 0 && output.stopReason === "pending") {
        const detail = extractOpenCodeError(stdout, stderr);
        throw new Error(
          detail ?? `opencode run exited with code ${exitCode}`,
        );
      }
      if (output.stopReason === "pending") {
        output.stopReason = "stop";
      }
      if (output.stopReason === "error" || output.stopReason === "aborted") {
        throw new Error(output.errorMessage || "An unknown error occurred");
      }

      if (spawnedSessionID && !sessionID) {
        saveSessionID(model.id, spawnedSessionID);
      }
      // if the run failed and we reused a stale session, clear it so next try starts fresh
      if (exitCode !== 0 && sessionID) {
        clearSessionID(model.id);
      }

      stream.push({ type: "done", reason: output.stopReason, message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage =
        error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(PROVIDER_ID, {
    name: "OpenCode",
    baseUrl: "cli://opencode",
    apiKey: "local",
    api: "opencode-cli",
    models: OPENCODE_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: m.input,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    })),
    streamSimple: streamOpenCode,
  });
}
