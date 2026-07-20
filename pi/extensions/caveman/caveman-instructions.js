import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FALLBACK =
  "Respond terse like smart caveman. All technical substance stay. Only fluff die.\n\n" +
  "ACTIVE EVERY RESPONSE. Off only: \"stop caveman\" / \"normal mode\".\n\n" +
  "Drop filler, hedging, pleasantries. Fragments OK. Code blocks unchanged. Errors quoted exact.\n" +
  "Preserve the user's language. Code/commits/PRs: write normal.";

function resolveSkillPath() {
  const candidates = [
    path.join(os.homedir(), ".agents", "skills", "caveman", "SKILL.md"),
    path.join(__dirname, "skills", "caveman", "SKILL.md"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function filterSkillBodyForMode(body, mode) {
  const modeLabel = mode === "wenyan" ? "wenyan-full" : mode;
  const withoutFrontmatter = String(body || "").replace(/^---[\s\S]*?---\s*/, "");

  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
      if (tableLabel) {
        const labelMode = tableLabel[1].trim();
        if (labelMode === "Level" || labelMode === "What change") return true;
        if (line.includes("---")) return true;
        return labelMode === modeLabel;
      }

      const exampleLabel = line.match(/^-\s*([^:]+):\s/);
      if (exampleLabel) {
        return exampleLabel[1].trim() === modeLabel;
      }

      return true;
    })
    .join("\n");
}

export function getCavemanInstructions(mode) {
  const modeLabel = mode === "wenyan" ? "wenyan-full" : mode;
  const skillPath = resolveSkillPath();

  if (!skillPath) {
    return `CAVEMAN MODE ACTIVE — level: ${modeLabel}\n\n${FALLBACK}`;
  }

  const body = fs.readFileSync(skillPath, "utf8");
  const filtered = filterSkillBodyForMode(body, mode);
  return `CAVEMAN MODE ACTIVE — level: ${modeLabel}\n\n${filtered}`;
}
