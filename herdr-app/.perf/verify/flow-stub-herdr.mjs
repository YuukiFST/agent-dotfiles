// Stands in for Herdr's "herdr" module so flow/watch.js runs under plain node against real git.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";

export const spawned = { count: 0 };

export function exec(command, args, { cwd } = {}) {
  spawned.count++;
  if (command === "gh") return Promise.resolve({ code: 1, stdout: "", stderr: "no pull request" });
  return new Promise((resolve) => {
    execFile(command, args, { cwd, maxBuffer: 1e8 }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code ?? 1 : 0, stdout, stderr });
    });
  });
}

export const readTextFile = (path) => readFile(path, "utf8").catch(() => null);
export const watchFolder = () => new Promise(() => {});
export const home = () => "C:/nowhere";
