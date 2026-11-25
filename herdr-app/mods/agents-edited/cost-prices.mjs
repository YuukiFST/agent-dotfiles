// What one Claude message costs at API list prices.
// https://platform.claude.com/docs/en/about-claude/pricing, read 2026-11-25. USD per million tokens.

const MILLION = 1e6;
const CACHE_WRITE_5M = 1.25;
const CACHE_WRITE_1H = 2;
const FAST_MODE = 2;
const HAIKU_LONG_PROMPT = 100000;

const price = (input, output, cacheRead) => ({ input, output, cacheRead });
const PRICES = {
  "claude-fable-5-2": price(8, 40, 0.2),
  "claude-fable-5-1": price(10, 50, 0.25),
  "claude-fable-5": price(10, 50, 1),
  "claude-opus-5-5": price(4, 20, 0.2),
  "claude-opus-5": price(5, 25, 0.5),
  "claude-opus-4-8": price(5, 25, 0.5),
  "claude-opus-4-7": price(5, 25, 0.5),
  "claude-opus-4-6": price(5, 25, 0.5),
  "claude-opus-4-5": price(5, 25, 0.5),
  "claude-sonnet-5-5": price(2, 10, 0.1),
  "claude-sonnet-5": price(2, 10, 0.2),
  "claude-sonnet-4-6": price(3, 15, 0.3),
  "claude-sonnet-4-5": price(3, 15, 0.3),
  "claude-haiku-5-5": price(0.1, 0.5, 0.01),
  "claude-haiku-4-5": price(1, 5, 0.1),
};
const HAIKU_5_5_LONG = price(0.5, 2.5, 0.05);

const modelKey = (model) => model.replace(/\[.*$/, "").replace(/-\d{8}$/, "");

function priceOf(model, promptTokens) {
  const key = modelKey(model);
  if (key === "claude-haiku-5-5" && promptTokens > HAIKU_LONG_PROMPT) return HAIKU_5_5_LONG;
  return PRICES[key] ?? null;
}

// USD, or null for a model with no price here.
export function messageCost(model, usage) {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheWrite1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const p = priceOf(model, input + cacheRead + cacheWrite);
  if (!p) return null;
  const writes = (cacheWrite - cacheWrite1h) * CACHE_WRITE_5M + cacheWrite1h * CACHE_WRITE_1H;
  const total = ((input + writes) * p.input + cacheRead * p.cacheRead + output * p.output) / MILLION;
  return usage.speed === "fast" ? total * FAST_MODE : total;
}
