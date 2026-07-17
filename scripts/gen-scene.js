#!/usr/bin/env node
/* First-party scene: a tidepool for Sepia. 680x132 (170x33 logical @4px), gentle bands
 * of shallow water over sand, rocks low, light glints high — drawn to sit at ~30%
 * opacity BEHIND a banner, so it stays atmosphere, never competition.
 * Regenerate: node scripts/gen-scene.js → assets/scene-tidepool.png */
const fs = require("fs");
const zlib = require("zlib");

const LW = 170, LH = 33, SCALE = 4;
const W = LW * SCALE, H = LH * SCALE;
const px = Buffer.alloc(W * H * 4);
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function put(x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const [r, g, b] = hex(c), i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
}
function lput(gx, gy, c) {
  for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) put(gx * SCALE + dx, gy * SCALE + dy, c);
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const r = rng(20260717);

// water: light shallows to deeper teal, wavy band edges
const WATER = ["#cfe8e2", "#b2ddd4", "#93cec4", "#79bfb4", "#66b0a6"];
for (let y = 0; y < 26; y++) {
  for (let x = 0; x < LW; x++) {
    const wob = Math.sin(x / 9 + y * 0.7) * 1.4;
    const band = Math.max(0, Math.min(WATER.length - 1, Math.floor((y + wob) / 5.4)));
    lput(x, y, WATER[band]);
  }
}
// sand
for (let y = 26; y < LH; y++) for (let x = 0; x < LW; x++)
  lput(x, y, y === 26 ? "#dbc9a4" : ((x * 7 + y * 13) % 17 === 0 ? "#cbb894" : "#d6c49e"));
// rocks: low dark blobs
const ROCK = "#7a7268", ROCK_D = "#645c53";
for (let k = 0; k < 9; k++) {
  const bx = 6 + r() * (LW - 12), by = 24 + r() * 7, rad = 1.6 + r() * 2.6;
  for (let y = Math.floor(by - rad - 1); y <= by + rad + 1; y++)
    for (let x = Math.floor(bx - rad - 1); x <= bx + rad + 1; x++) {
      const e = rad + (r() - 0.5) * 1.2;
      if ((x - bx) ** 2 + (y - by) ** 2 * 2.2 <= e * e && y < LH && y > 20) lput(x, y, r() < 0.25 ? ROCK_D : ROCK);
    }
}
// seagrass wisps
for (let k = 0; k < 7; k++) {
  const gx = 4 + Math.floor(r() * (LW - 8)); const h = 3 + Math.floor(r() * 4);
  for (let d = 0; d < h; d++) lput(gx + Math.round(Math.sin(d * 1.3 + k) * 0.8), 26 - d, "#5f9a7a");
}
// glints on the water
for (let k = 0; k < 26; k++) {
  const gx = Math.floor(r() * LW), gy = Math.floor(r() * 14);
  lput(gx, gy, "#eef8f4");
  if (r() < 0.5) lput(gx + 1, gy, "#def0ea");
}
// a few drifting bubbles
for (let k = 0; k < 6; k++) lput(Math.floor(r() * LW), 6 + Math.floor(r() * 16), "#e6f4f0");

// PNG encode (same minimal encoder as gen-sepia)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
]);
fs.writeFileSync("assets/scene-tidepool.png", png);
console.log("scene-tidepool.png: " + W + "x" + H + ", " + png.length + " bytes");
