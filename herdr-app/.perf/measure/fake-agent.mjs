#!/usr/bin/env node
// A terminal that reports one agent status and stays open, so a window has a known agent to draw.
//   node .perf/measure/fake-agent.mjs [working]
const state = process.argv[2] ?? "working";
process.stdout.write(`\x1b]7501;state=${state}\x1b\`);
setInterval(() => {}, 60000);
