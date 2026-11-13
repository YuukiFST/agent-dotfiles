#!/usr/bin/env node
// Reported bug: "Em Sessions aparece os botões para clicar quando o Claude faz alguma pergunta
// para mim, mas quando estou usando OpenCode isso não acontece". Reads the OpenCode question
// screen captured beside this file (OpenCode 2.2.7, `hc read` of a blocked question) through the
// board's menuOptions, and diffs the buttons it finds against the golden beside this file.
//   node tests/regression-opencode-question-buttons.mjs [--update]
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = path.join(here, "regression-opencode-question-buttons.golden.txt");
const screen = path.join(here, "regression-opencode-question-buttons.screen.txt");
const answers = path.resolve(here, "..", "mods", "agents-edited", "answers.js");

// The app provides these modules to mods; menuOptions uses none of them.
const appModules = new Set(["gpui-kit", "gpui-base", "herdr"]);
registerHooks({
  resolve: (specifier, context, next) =>
    appModules.has(specifier) ? { url: `data:text/javascript,export const div=0,h_flex=0,hc=0;`, shortCircuit: true } : next(specifier, context),
});

const { menuOptions } = await import(pathToFileURL(answers).href);
const options = menuOptions(fs.readFileSync(screen, "utf8").split(/\r?\n/));
const seen = (options.length ? options.map((o) => `${o.n}: ${o.label}`).join("\n") : "(no buttons)") + "\n";

if (process.argv.includes("--update")) {
  fs.writeFileSync(golden, seen);
  process.stdout.write(seen);
  process.exit(0);
}
const expected = fs.readFileSync(golden, "utf8").replace(/\r\n/g, "\n");
if (seen === expected) {
  process.stdout.write("ok\n");
  process.exit(0);
}
process.stdout.write(`--- golden\n${expected}+++ seen\n${seen}`);
process.exit(1);
