#!/usr/bin/env node
// Wall time of one machine reading, as a window pays for it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const file = path.join(os.tmpdir(), `herdr-sample-${process.pid}.json`);
const start = performance.now();
execFileSync("node", ["mods/claude-usage/system-sample.mjs", file]);
const elapsed = performance.now() - start;
fs.rmSync(file, { force: true });
console.log(Math.round(elapsed));
