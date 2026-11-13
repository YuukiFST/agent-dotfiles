#!/usr/bin/env node
// The ink box of each named region of a screenshot: where its drawn pixels start, end and center.
// Comparing boxes across panels proves two edges or two rows share one line.
//   node tests/ink.mjs <shot.png> <name>=<x0>,<y0>,<x1>,<y1> ... [--threshold 70]
// A pixel counts as ink when its brightest channel is above the threshold (the dark themes' text
// and borders); lower it to catch dim borders. Reads the 8-bit, non-interlaced PNGs `herdr-app shot` writes.
import fs from "node:fs";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const thresholdAt = args.indexOf("--threshold");
const threshold = thresholdAt >= 0 ? Number(args.splice(thresholdAt, 2)[1]) : 70;
const [file, ...regions] = args;
if (!file || !regions.length) {
  console.error("usage: node tests/ink.mjs <shot.png> <name>=<x0>,<y0>,<x1>,<y1> ... [--threshold 70]");
  process.exit(2);
}

function decodePng(bytes) {
  const chunks = [];
  let header;
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("latin1", at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    if (type === "IDAT") chunks.push(data);
    at += 12 + length;
  }
  const channels = { 2: 3, 6: 4 }[header.color];
  if (header.depth !== 8 || !channels || header.interlace) throw new Error(`unsupported PNG: depth ${header.depth}, color type ${header.color}, interlace ${header.interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const paeth = () => {
        const p = left + up - upLeft;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        return a <= b && a <= c ? left : b <= c ? up : upLeft;
      };
      const predictor = [0, left, up, (left + up) >> 1, filter === 4 ? paeth() : 0][filter];
      pixels[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { ...header, channels, stride, pixels };
}

const png = decodePng(fs.readFileSync(file));
for (const region of regions) {
  const [name, coords] = region.split("=");
  const [x0, y0, x1, y1] = coords.split(",").map(Number);
  let box = null;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = y * png.stride + x * png.channels;
      if (Math.max(png.pixels[at], png.pixels[at + 1], png.pixels[at + 2]) <= threshold) continue;
      box = box ?? { left: x, right: x, top: y, bottom: y };
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  console.log(`${name}: ${box ? JSON.stringify({ ...box, middle: (box.top + box.bottom) / 2 }) : "no ink"}`);
}
