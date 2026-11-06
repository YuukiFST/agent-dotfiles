// One reading of the machine, shared by every Herdr window: the first window due runs this,
// the others read the file it leaves. CPU use needs the previous reading, kept in that file.
//   node system-sample.mjs <file>
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, statfs, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname } from "node:path";

const file = process.argv[2];

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const { times } of os.cpus()) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

// The counters since boot, over all interfaces. The Formatted class holds the same rates but takes 4x as long.
const NETWORK_CLASS = "Win32_PerfRawData_Tcpip_NetworkInterface";
// A reading older than this says nothing about the network now (windows closed, a reboot).
const RATE_MAX_GAP_MS = 30000;
// Windows sampling at once would divide by almost nothing.
const RATE_MIN_GAP_MS = 1000;

function sumNetwork(text) {
  const sum = (pattern) => [...text.matchAll(pattern)].reduce((n, m) => n + Number(m[1]), 0);
  return { rx: sum(/BytesReceivedPersec=(\d+)/g), tx: sum(/BytesSentPersec=(\d+)/g) };
}

function networkRates(totals, previous, at) {
  const before = previous?.raw?.net;
  const gapMs = at - (previous?.at ?? 0);
  if (!before?.rx || gapMs > RATE_MAX_GAP_MS) return { rx: 0, tx: 0, totals };
  if (gapMs < RATE_MIN_GAP_MS) return { rx: previous.rx, tx: previous.tx, totals: before };
  const perSecond = (now, last) => Math.max(0, Math.round((now - last) / (gapMs / 1000)));
  return { rx: perSecond(totals.rx, before.rx), tx: perSecond(totals.tx, before.tx), totals };
}

const run = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { windowsHide: true }, (error, stdout) => resolve(error ? null : stdout));
  });

// wmic is an optional Windows feature, gone by default on recent builds.
async function networkTotals() {
  const text = (await run("wmic", ["path", NETWORK_CLASS, "get", "BytesReceivedPersec,BytesSentPersec", "/value"]))
    ?? (await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Get-CimInstance ${NETWORK_CLASS} | Format-List BytesReceivedPersec,BytesSentPersec | Out-String`]))?.replace(/ : /g, "=");
  return sumNetwork(text ?? "");
}

const previous = await readFile(file, "utf8").then(JSON.parse).catch(() => null);
let before = previous?.raw;
if (!before) {
  before = { cpu: cpuTimes() };
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const [totals, disk] = await Promise.all([networkTotals(), statfs("C:\\")]);
const cpu = cpuTimes();
const at = Date.now();
const net = networkRates(totals, previous, at);
const elapsed = cpu.total - before.cpu.total;
const sample = {
  at,
  cpu: elapsed > 0 ? Math.round(100 * (1 - (cpu.idle - before.cpu.idle) / elapsed)) : 0,
  freeKb: os.freemem() / 1024,
  totalKb: os.totalmem() / 1024,
  diskFree: disk.bavail * disk.bsize,
  diskSize: disk.blocks * disk.bsize,
  rx: net.rx,
  tx: net.tx,
  raw: { cpu, net: net.totals },
};
const text = JSON.stringify(sample);
await mkdir(dirname(file), { recursive: true });
const temporary = `${file}.${process.pid}`;
await writeFile(temporary, text);
await rename(temporary, file);
process.stdout.write(text);
