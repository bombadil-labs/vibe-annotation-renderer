#!/usr/bin/env node
/* Kip — the project's mascot, promoted to a full crew member 2026-07-18. CC0.
 *
 * THE 8-BIT STORY. Sepia lives on a 32-grid; Kip lives on a SIXTEEN-grid, scaled 4×.
 * That halving is the whole character and it is structural, not stylistic: he cannot
 * hold a smooth curve, so he doesn't try. Where Sepia eases, Kip SNAPS — the renderer
 * quantises his clock to a handful of frames a second and rounds every offset to a whole
 * art-pixel, so he arrives at each pose rather than travelling to it. A man out of phase
 * with reality: the world runs at 60fps and Kip is emphatically not.
 *
 * 33 moods × 2 FRAMES, 8×10 grid, 64px cells → assets/kip-sheet.png (512×640).
 *   frame 0 (rows 0-4): the pose
 *   frame 1 (rows 5-9): the OFF-BEAT — never a tween, always a different discrete state
 * The renderer cuts between them on a stepped clock; there is no interpolation anywhere.
 *
 * THE FEET (the maintainer's note): the old feet were body-coloured and simply vanished
 * against him. They are amber now — the one warm note on a cool creature — and separated
 * from the hem by an outline row, so they read at 56px. They earn their keep: discrete
 * feet are what make a stepped hop legible as a HOP rather than as the whole sprite
 * jittering.
 *
 * Pure Node (zlib only), deterministic: npm run kip
 */
const fs = require("fs");
const zlib = require("zlib");

// A tight retro palette — cool body, one warm accent, no gradients anywhere. Kip is
// deliberately NOT Sepia's cream-and-ink; at a glance across a gallery they must not
// be mistakable for each other.
const C = {
  o: "#241f33",   // outline — near-black, faintly violet
  b: "#5f74d8",   // body
  B: "#7f92ea",   // body highlight (upper-left lift)
  d: "#3f4da3",   // body shade (lower-right)
  W: "#f4f6ff",   // eye white
  p: "#241f33",   // pupil
  f: "#e8a33d",   // FEET + beak — the warm accent that makes them legible
  F: "#c47f25",   // feet shade
  s: "#ffe680",   // antenna star, lit
  S: "#a08a3a",   // antenna star, dim
  w: "#4a5cbd",   // wing
  r: "#ff8fa8",   // blush
  g: "#8fe6b0"    // sickly green (queasy states)
};

const G = 16;                                   // logical grid — the 8-bit constraint
const SCALE = 4;                                // → 64px cells, whole pixels only
const CELL = G * SCALE;
const COLS = 8, FRAMES = 2;

const MOODS = ["neutral", "content", "delighted", "focused", "sheepish", "booped", "thinking",
  "spark", "excited", "surprised", "tender", "melancholy", "anxious", "mirth", "laugh",
  "groan", "oops", "frustrated", "angry", "dramatic", "at_peace", "solemn", "rhyme",
  "awe", "vertigo", "resolute", "puzzled", "asking", "weary", "wink", "love", "working"];
const ROWS_PER_FRAME = Math.ceil(MOODS.length / COLS);          // 5
const W = COLS * CELL, H = ROWS_PER_FRAME * FRAMES * CELL;

// ── the body ────────────────────────────────────────────────────────────────────────
// Per-row [left, right] inclusive. A round little guy: narrow crown, widest through the
// eye band, tucked hem. Row 12-13 is where the feet go, drawn separately.
const BODY = {
  4: [5, 10], 5: [4, 11], 6: [3, 12], 7: [3, 12], 8: [3, 12],
  9: [3, 12], 10: [4, 11], 11: [4, 11], 12: [5, 10]
};
// Row 0 is deliberately empty: it is the HEADROOM a hop needs. Without it the antenna
// clipped off the top of the cell the moment he left the ground.
const EYE_ROW = 7, MOUTH_ROW = 10;

function blank() { return Array.from({ length: G }, () => Array(G).fill(null)); }
function px(gr, x, y, c) { if (x >= 0 && x < G && y >= 0 && y < G && c) gr[y][x] = c; }
function rect(gr, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(gr, x, y, c);
}

// ── expression parts ────────────────────────────────────────────────────────────────
// Eyes live at cols 5-6 and 9-10. At this resolution an eye is one or two pixels, so the
// vocabulary is deliberately small and each entry has to read INSTANTLY.
const EYES = {
  // An eye is ONE column and TWO rows: white above, pupil below. At 16 wide there is no
  // room for a white surround, and a 1px pupil alone reads as a bug rather than a face —
  // the white above it is what makes it an eye. (v1 wrote white and pupil to the SAME
  // pixel, so the whites never survived and he stared out of two dark dots.)
  open:   (g, y) => { px(g, 5, y - 1, C.W); px(g, 5, y, C.p); px(g, 10, y - 1, C.W); px(g, 10, y, C.p); },
  wide:   (g, y) => { rect(g, 4, y - 1, 5, y, C.W); px(g, 5, y, C.p); rect(g, 10, y - 1, 11, y, C.W); px(g, 10, y, C.p); },
  happy:  (g, y) => { px(g, 4, y, C.p); px(g, 5, y - 1, C.p); px(g, 6, y, C.p); px(g, 9, y, C.p); px(g, 10, y - 1, C.p); px(g, 11, y, C.p); },
  shut:   (g, y) => { rect(g, 4, y, 6, y, C.p); rect(g, 9, y, 11, y, C.p); },
  droop:  (g, y) => { px(g, 5, y - 1, C.W); px(g, 5, y, C.p); px(g, 10, y - 1, C.W); px(g, 10, y, C.p);
                      rect(g, 4, y - 1, 5, y - 1, C.p); rect(g, 10, y - 1, 11, y - 1, C.p); },
  narrow: (g, y) => { rect(g, 5, y, 6, y, C.p); rect(g, 9, y, 10, y, C.p); },
  cross:  (g, y) => { px(g, 5, y - 1, C.p); px(g, 5, y, C.p); px(g, 10, y - 1, C.p); px(g, 10, y, C.p); },
  spiral: (g, y) => { rect(g, 4, y - 1, 6, y - 1, C.W); px(g, 5, y, C.W); px(g, 4, y - 1, C.p); px(g, 5, y, C.p);
                      rect(g, 9, y - 1, 11, y - 1, C.W); px(g, 10, y, C.W); px(g, 11, y - 1, C.p); px(g, 10, y, C.p); },
  angry:  (g, y) => { px(g, 4, y - 1, C.p); px(g, 5, y - 1, C.p); px(g, 5, y, C.W); px(g, 5, y, C.p);
                      px(g, 11, y - 1, C.p); px(g, 10, y - 1, C.p); px(g, 10, y, C.p); },
  wink:   (g, y) => { rect(g, 4, y, 6, y, C.p); px(g, 10, y - 1, C.W); px(g, 10, y, C.p); },
  heart:  (g, y) => { px(g, 4, y - 1, C.r); px(g, 6, y - 1, C.r); rect(g, 4, y, 6, y, C.r); px(g, 5, y + 1, C.r);
                      px(g, 9, y - 1, C.r); px(g, 11, y - 1, C.r); rect(g, 9, y, 11, y, C.r); px(g, 10, y + 1, C.r); },
  up:     (g, y) => { px(g, 5, y, C.W); px(g, 5, y - 1, C.p); px(g, 10, y, C.W); px(g, 10, y - 1, C.p); },
  side:   (g, y) => { px(g, 5, y - 1, C.W); px(g, 6, y, C.p); px(g, 10, y - 1, C.W); px(g, 11, y, C.p); },
  dot:    (g, y) => { px(g, 5, y, C.p); px(g, 10, y, C.p); }
};
const MOUTH = {
  none:  () => {},
  line:  (g, y) => { rect(g, 7, y, 8, y, C.o); },
  smile: (g, y) => { px(g, 6, y - 1, C.o); rect(g, 7, y, 8, y, C.o); px(g, 9, y - 1, C.o); },
  grin:  (g, y) => { px(g, 6, y - 1, C.o); rect(g, 6, y, 9, y, C.o); px(g, 9, y - 1, C.o); rect(g, 7, y + 1, 8, y + 1, C.W); },
  frown: (g, y) => { px(g, 6, y, C.o); rect(g, 7, y - 1, 8, y - 1, C.o); px(g, 9, y, C.o); },
  open:  (g, y) => { rect(g, 7, y - 1, 8, y, C.o); },
  wide:  (g, y) => { rect(g, 6, y - 1, 9, y + 1, C.o); rect(g, 7, y, 8, y, C.r); },
  small: (g, y) => { px(g, 7, y, C.o); },
  wave:  (g, y) => { px(g, 6, y, C.o); px(g, 7, y - 1, C.o); px(g, 8, y, C.o); px(g, 9, y - 1, C.o); },
  flat:  (g, y) => { rect(g, 6, y, 9, y, C.o); },
  beak:  (g, y) => { rect(g, 7, y, 8, y, C.f); px(g, 7, y + 1, C.F); }
};

// ── the mood table ──────────────────────────────────────────────────────────────────
// [eyes, mouth, antenna tilt (-1 left, 0 up, 1 right), wings (u=up d=down t=tucked
//  f=flap), feet (s=stand p=step h=hop), eyeShift, blush, prop]
// Frame 1 varies at least ONE discrete thing — never a halfway position.
const M = {
  neutral:    ["open", "line", 0, "d", "s"],
  content:    ["happy", "smile", 0, "d", "s"],
  delighted:  ["happy", "grin", 1, "u", "h"],
  focused:    ["narrow", "line", 0, "t", "s"],
  sheepish:   ["side", "small", -1, "t", "p", 0, true],
  booped:     ["wide", "open", 1, "u", "h", 0, true],
  thinking:   ["up", "line", 1, "t", "s", 0, false, "qmark"],
  spark:      ["wide", "grin", 0, "u", "h", 0, false, "bulb"],
  excited:    ["wide", "grin", 1, "f", "h"],
  surprised:  ["wide", "open", 0, "u", "s", 0, false, "excl"],
  tender:     ["happy", "smile", 0, "d", "s", 0, true],
  melancholy: ["droop", "frown", -1, "d", "s"],
  anxious:    ["wide", "wave", -1, "t", "p", 0, false, "sweat"],
  mirth:      ["happy", "grin", 1, "d", "s"],
  laugh:      ["shut", "wide", 1, "f", "h", 0, false, "laughs"],
  groan:      ["shut", "wave", -1, "d", "s", 0, false, "sweat"],
  oops:       ["wide", "open", 1, "u", "h", 0, false, "sweat"],
  frustrated: ["angry", "flat", -1, "t", "s", 0, false, "vein"],
  angry:      ["angry", "frown", 0, "u", "s", 0, false, "grawlix"],
  dramatic:   ["side", "open", 1, "f", "p"],
  at_peace:   ["shut", "smile", 0, "d", "s"],
  solemn:     ["narrow", "flat", 0, "t", "s"],
  rhyme:      ["side", "smile", 1, "d", "p", 0, false, "note"],
  awe:        ["wide", "open", 0, "u", "s"],
  vertigo:    ["spiral", "wave", -1, "d", "p"],
  resolute:   ["narrow", "flat", 0, "u", "s"],
  puzzled:    ["side", "wave", -1, "t", "s", 0, false, "qmark"],
  asking:     ["up", "small", 1, "d", "s", 0, false, "qmark"],
  weary:      ["droop", "flat", -1, "d", "s"],
  wink:       ["wink", "grin", 1, "u", "p"],
  love:       ["heart", "smile", 0, "u", "h", 0, true],
  working:    ["narrow", "line", 1, "f", "p", 0, false, "gear"]
};

// ── drawing ─────────────────────────────────────────────────────────────────────────
function drawKip(mood, frame) {
  const g = blank();
  const [eyes, mouth, tilt, wing, feet, , blush, prop] = M[mood];
  // THE OFF-BEAT. Frame 1 has to differ STRUCTURALLY for every mood, not just the hoppy
  // ones — v1 varied only the antenna star and he read as a static sprite with a blinking
  // light. Standing Kip SQUATS a pixel while his feet stay planted (the classic 8-bit
  // idle); hopping Kip leaves the ground entirely, feet and all. Whole pixels only.
  const off = frame === 1 ? (feet === "h" ? -1 : 1) : 0;
  const feetOff = feet === "h" ? off : 0;                       // feet follow only on a hop

  // antenna: stalk + star. The star dims on the off-beat for every mood — Kip's one
  // constant tell that he is running on his own clock.
  const ax = 8 + (frame === 1 ? tilt : 0);
  px(g, 8, 3 + off, C.o);
  px(g, ax, 2 + off, C.o);
  const starC = frame === 1 ? C.S : C.s;
  px(g, ax, 1 + off, starC); px(g, ax - 1, 2 + off, starC); px(g, ax + 1, 2 + off, starC);

  // body
  for (const r of Object.keys(BODY)) {
    const [l, rr] = BODY[r], y = (+r) + off;
    rect(g, l, y, rr, y, C.b);
    px(g, l, y, C.o); px(g, rr, y, C.o);
    if (+r <= 6) px(g, l + 1, y, C.B);                          // upper-left lift
    if (+r >= 10) px(g, rr - 1, y, C.d);                         // lower-right shade
  }
  rect(g, 5, 3 + off, 10, 3 + off, C.o);                        // crown outline
  rect(g, 5, 13 + off, 10, 13 + off, C.o);                      // hem outline — separates body from feet

  // wings: stubby, discrete positions only
  const wy = { u: 6, d: 9, t: 8, f: frame === 1 ? 6 : 9 }[wing] + off;
  rect(g, 1, wy, 2, wy + 1, C.w); px(g, 1, wy, C.o);
  rect(g, 13, wy, 14, wy + 1, C.w); px(g, 14, wy, C.o);

  // FEET — amber, always outside the hem outline, so they never merge with the body
  drawFeet(g, feet, frame, feetOff);

  // face
  const ey = EYE_ROW + off;
  EYES[eyes](g, ey);
  MOUTH[mouth](g, MOUTH_ROW + off);
  if (blush) { px(g, 3, ey + 1, C.r); px(g, 12, ey + 1, C.r); }
  if (mood === "vertigo" || mood === "groan") { px(g, 3, ey, C.g); px(g, 12, ey, C.g); }
  if (prop) drawProp(g, prop, frame, off);
  return g;
}

function drawFeet(g, mode, frame, off) {
  const y = 14 + off;
  let L = 0, R = 0;                                             // per-foot vertical offset, whole pixels
  if (mode === "p") { if (frame === 1) L = -1; else R = -1; }    // step: alternate, never both
  rect(g, 4, y + L, 6, y + L, C.f); px(g, 4, y + L, C.F);
  rect(g, 9, y + R, 11, y + R, C.f); px(g, 11, y + R, C.F);
}

// Props are Kip's own marks, drawn INTO the sprite at his resolution so they read as
// part of him rather than as an overlay. The renderer draws the real emoji over the top
// at full alpha; these are the pixel shadow that keeps him coherent if it doesn't.
function drawProp(g, prop, frame, off) {
  const on = frame === 0;
  if (prop === "bulb") { px(g, 12, 2 + off, on ? C.s : C.S); px(g, 12, 3 + off, C.o); }
  else if (prop === "excl") { rect(g, 13, 3 + off, 13, 4 + off, C.s); px(g, 13, 6 + off, C.s); }
  else if (prop === "qmark") { rect(g, 12, 2 + off, 13, 2 + off, C.s); px(g, 13, 3 + off, C.s); px(g, 12, 4 + off, C.s); px(g, 12, 6 + off, C.s); }
  else if (prop === "sweat") { px(g, 12, 4 + off, on ? C.W : null); px(g, 12, 5 + off, on ? C.d : null); }
  else if (prop === "vein") { px(g, 12, 3 + off, C.r); px(g, 13, 3 + off, C.r); px(g, 12, 4 + off, C.r); }
  else if (prop === "grawlix") { px(g, 12, 2 + off, C.s); px(g, 13, 3 + off, C.r); px(g, 12, 4 + off, C.s); }
  else if (prop === "laughs") { if (on) { px(g, 1, 4 + off, C.s); px(g, 14, 4 + off, C.s); } else { px(g, 0, 3 + off, C.s); px(g, 15, 3 + off, C.s); } }
  else if (prop === "note") { px(g, 13, 3 + off, C.s); px(g, 13, 4 + off, C.s); px(g, 12, 5 + off, C.s); }
  else if (prop === "gear") { px(g, 12, 3 + off, on ? C.W : C.S); px(g, 13, 4 + off, on ? C.S : C.W); }
}

// ── raster ──────────────────────────────────────────────────────────────────────────
const pxbuf = Buffer.alloc(W * H * 4);
function put(X, Y, hex) {
  if (!hex) return;
  const i = (Y * W + X) * 4;
  pxbuf[i] = parseInt(hex.slice(1, 3), 16);
  pxbuf[i + 1] = parseInt(hex.slice(3, 5), 16);
  pxbuf[i + 2] = parseInt(hex.slice(5, 7), 16);
  pxbuf[i + 3] = 255;
}
MOODS.forEach((mood, idx) => {
  for (let f = 0; f < FRAMES; f++) {
    const g = drawKip(mood, f);
    const cx = (idx % COLS) * CELL;
    const cy = (Math.floor(idx / COLS) + f * ROWS_PER_FRAME) * CELL;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const c = g[y][x];
      if (!c) continue;
      for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) {
        put(cx + x * SCALE + sx, cy + y * SCALE + sy, c);       // nearest-neighbour by construction
      }
    }
  }
});

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  pxbuf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0))
]);
fs.writeFileSync("assets/kip-sheet.png", png);
console.log("kip-sheet.png: " + W + "x" + H + " (" + COLS + "x" + (ROWS_PER_FRAME * FRAMES) + " cells of " + CELL + "), "
  + png.length + " bytes, " + MOODS.length + " moods x " + FRAMES + " frames");
