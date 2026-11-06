#!/usr/bin/env node
// Cost of the open Herdr windows, added up: CPU (1 core = 100), private memory and programs started.
//   node .perf/measure/live.mjs [seconds]
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const seconds = process.argv[2] ?? "45";
const ps = (args) => execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], { encoding: "utf8" }).trim();
const ids = ps(["-Command", "(Get-Process herdr-app | Where-Object MainWindowHandle -ne 0).Id -join ','"]);
const out = ps(["-File", path.join(here, "app-stats.ps1"), "-IdList", ids, "-Seconds", seconds]);
console.log(out.split(/\r?\n/).pop());
