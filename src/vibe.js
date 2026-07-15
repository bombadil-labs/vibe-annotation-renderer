/* vibe-annotation-renderer — builds Claude's mood-banner SVG from feeling-values.
 *
 * Loaded by the vibe-annotations skill via jsDelivr; the skill emits only the
 * values, this owns all rendering. Ported faithfully from vibe.py (v0 baseline);
 * the generative/animated redesign happens on top of this.
 *
 *   Browser:  <script src="…/vibe.min.js"></script>
 *             vibe(document.getElementById('el'), { kaomoji, seems, feel, trying, … })
 *   Node:     const { buildSVG } = require('./src/vibe.js')   // pure, for tests
 */
(function (root) {
  var W = 680, PAD = 24, FACE_X = 10, TEXT_X = 158, ROW_GAP = 32;
  var GOAL_CAP = 70, GOAL_INDENT = 48, DEFAULT_MID = 68, NEUTRAL = "#a7a29b";

  var STYLE =
    ".txt{paint-order:stroke;stroke:#fff8ec;stroke-linejoin:round}" +
    ".fk{font-family:var(--font-sans);font-size:19px;fill:#5c4320;stroke-width:2.6}" +
    ".fkt{font-family:var(--font-mono);font-size:15px;fill:#5c4320;stroke-width:2.4}" +
    ".lbl{font-family:var(--font-mono);font-size:11px;fill:#8a6c33;stroke-width:2.2}" +
    ".fr{font-family:var(--font-voice);font-size:12px;font-style:italic;fill:#6b5230;stroke-width:2.2}" +
    ".fw{font-family:var(--font-voice);font-size:14px;font-style:italic;fill:#5c4320;stroke-width:2.4}" +
    ".fg{font-family:var(--font-sans);font-size:13px;fill:#5c4320;stroke-width:2.2}" +
    ".fx{font-family:var(--font-mono);font-size:12px;fill:#7a5f2c;stroke-width:2.2}" +
    "@media (prefers-color-scheme:dark){.txt{stroke:#241a06}" +
    ".fk,.fkt{fill:#f6ead0}.lbl{fill:#c9ad78}.fr{fill:#dcc79c}" +
    ".fw{fill:#f0e0bf}.fg{fill:#ecdcb8}.fx{fill:#d4bb8a}}";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function g(n) { return String(Math.round(n * 1000) / 1000); }        // ~python :g
  function hx(c) { c = c.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  function rgb(t) { return "#" + t.map(function (v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(""); }
  function darken(c, f) { f = f == null ? 0.78 : f; var a = hx(c); return rgb([a[0] * f, a[1] * f, a[2] * f]); }
  function lighten(c, f) { f = f == null ? 0.16 : f; var a = hx(c); return rgb([a[0] + (255 - a[0]) * f, a[1] + (255 - a[1]) * f, a[2] + (255 - a[2]) * f]); }
  function mix(a, b) { var x = hx(a), y = hx(b); return rgb([(x[0] + y[0]) / 2, (x[1] + y[1]) / 2, (x[2] + y[2]) / 2]); }

  function fieldFromPalette(pal, spread, turb) {
    spread = spread == null ? 0.6 : spread; turb = turb == null ? 0.35 : turb;
    var slots = [[225, 48, 0.44, 0, 0], [160, 40, 0.32, -110, -8], [150, 40, 0.28, 140, 12], [112, 30, 0.22, 66, 22], [96, 26, 0.18, -150, 16]];
    if (typeof pal === "string") pal = [pal];
    pal = pal ? pal.slice() : [];
    var cols;
    if (pal.length === 0) cols = [NEUTRAL, lighten(NEUTRAL, 0.10), darken(NEUTRAL, 0.90)];
    else if (pal.length === 1) cols = [pal[0], lighten(pal[0], 0.14), pal[0]];
    else if (pal.length === 2) cols = [pal[0], pal[1], mix(pal[0], pal[1])];
    else cols = pal.slice(0, slots.length);
    return cols.map(function (col, i) {
      var s = slots[i];
      return { cx: 300 + s[3] * spread, cy: 68 + s[4] * turb, rx: s[0], ry: s[1], fill: col, op: s[2] };
    });
  }

  function flare(cx, cy) {
    return [
      '<ellipse cx="' + cx + '" cy="' + g(cy) + '" rx="54" ry="40" fill="#f7dd94" opacity="0.11"/>',
      '<ellipse cx="' + cx + '" cy="' + g(cy) + '" rx="28" ry="21" fill="#fbe6a0" opacity="0.22"/>',
      '<ellipse cx="' + cx + '" cy="' + g(cy) + '" rx="11" ry="9" fill="#fdf0c4" opacity="0.4"/>'
    ];
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function sparkle(H, seed) {
    var rnd = mulberry32(seed), u = function (lo, hi) { return lo + rnd() * (hi - lo); };
    var zones = [[44, 636, 5, 18, 4], [44, 616, H - 18, H - 7, 4], [10, 46, 28, 106, 1], [646, 674, 28, 106, 1]];
    var out = [];
    zones.forEach(function (z) {
      for (var k = 0; k < z[4]; k++) {
        var cx = u(z[0], z[1]), cy = u(z[2], z[3]), s = u(6, 10), rot = u(0, 360), ry = s * u(0.18, 0.30), op = u(0.28, 0.42);
        for (var arm = 0; arm < 3; arm++) {
          out.push('<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + s.toFixed(1) +
            '" ry="' + ry.toFixed(2) + '" fill="#f7e3a8" opacity="' + op.toFixed(2) +
            '" transform="rotate(' + (rot + 60 * arm).toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')"/>');
        }
      }
    });
    return out;
  }

  function normalizeLangs(L) {
    if (!L) return [];
    if (typeof L === "string") return L.split("·").map(function (s) { return [s.trim(), s.trim()]; }).filter(function (x) { return x[0]; });
    return L.map(function (x) {
      if (typeof x === "string") return [x, x];
      return [x.flag || x.code || "?", x.name || x.code || "?"];
    });
  }
  function wide(lbl) {
    var astral = false;
    for (var i = 0; i < lbl.length; i++) { if (lbl.codePointAt(i) > 0x3000) { astral = true; break; } }
    return astral ? 17 : lbl.length * 7.2 + 3;
  }

  function buildSVG(p) {
    var field = (p.field && p.field.length) ? p.field
      : fieldFromPalette(p.palette, p.spread == null ? 0.6 : p.spread, p.turbulence == null ? 0.35 : p.turbulence);

    // engagement: purely deflationary. At/above 0.5 the field is untouched;
    // below 0.5 it shrinks (mult) AND scatters (disp), ramping hard at the low end.
    var eng = Math.max(0, Math.min(1, p.engagement == null ? 0.5 : p.engagement));
    var t = Math.max(0, (0.5 - eng) / 0.5);
    var mult = 1.0 - 0.8 * Math.pow(t, 2.5);
    var disp = 1.0 + 2.6 * Math.pow(t, 2.5);

    var kaoLines = String(p.kaomoji).split("\n");
    var multiline = kaoLines.length > 1;
    var kaoLh = multiline ? 20 : 0;

    // readout rows: [user] [mood] ([note]) [goal]; goal is last and may wrap.
    function line(label, value, cls, x) {
      x = x == null ? TEXT_X : x;
      var head = label ? '<tspan class="lbl">' + esc(label) + '</tspan> ' : '';
      return { x: x, inner: head + '<tspan class="' + cls + '">' + esc(value) + '</tspan>' };
    }
    var lines = [line("[user]", p.seems, "fr"), line("[mood]", p.feel, "fw")];
    if (p.noticing) lines.push(line("[note]", p.noticing, "fr"));
    var goal = String(p.trying);
    if (goal.length > GOAL_CAP) {
      var cut = goal.lastIndexOf(" ", GOAL_CAP); if (cut <= 0) cut = GOAL_CAP;
      lines.push(line("[goal]", goal.slice(0, cut), "fg"));
      lines.push(line("", goal.slice(cut).trim(), "fg", TEXT_X + GOAL_INDENT));
    } else lines.push(line("[goal]", goal, "fg"));
    var nRows = lines.length;

    // vertical layout: face centred on the core; languages hang below it.
    var kaoAscent = multiline ? 14 : 15, kaoDescent = 6;
    var kaoH = kaoAscent + (kaoLines.length - 1) * kaoLh + kaoDescent;
    var rightH = 11 + (nRows - 1) * ROW_GAP + 6;
    var langs = normalizeLangs(p.languages);
    var LANG_GAP = 24, LANG_DESC = 6;
    var topExtent = Math.max(kaoH, rightH) / 2;
    var langDepth = langs.length ? (kaoH / 2 - kaoDescent) + LANG_GAP + LANG_DESC : 0;
    var bottomExtent = Math.max(kaoH / 2, rightH / 2, langDepth);
    var H = Math.round(PAD + topExtent + bottomExtent + PAD);
    var coreCy = PAD + topExtent;
    var kaoAbs = kaoLines.map(function (_, i) { return coreCy - kaoH / 2 + kaoAscent + i * kaoLh; });
    var rightAbs = lines.map(function (_, i) { return coreCy - rightH / 2 + 11 + i * ROW_GAP; });
    var langY = kaoAbs[kaoAbs.length - 1] + LANG_GAP;
    var dyField = coreCy - DEFAULT_MID;

    var out = [];
    out.push('<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg">');
    out.push('<title>Mood annotation</title>');
    out.push('<desc>Ambient mood field with a user read and a first-person feel/intent readout</desc>');
    out.push('<style>' + STYLE + '</style>');

    out.push('<g opacity="0.5">');
    field.forEach(function (e) {
      var cx = 300 + (e.cx - 300) * disp;
      var cy = DEFAULT_MID + (e.cy - DEFAULT_MID) * disp + dyField;
      var rx = e.rx * mult, ry = e.ry * mult;
      out.push('<ellipse cx="' + g(cx) + '" cy="' + g(cy) + '" rx="' + g(rx) + '" ry="' + g(ry) +
        '" fill="' + e.fill + '" opacity="' + g(e.op == null ? 0.4 : e.op) + '"/>');
      if (e.ring) {
        var dx = Array.isArray(e.ring) ? e.ring[0] : 0, dy = Array.isArray(e.ring) ? e.ring[1] : 0;
        out.push('<ellipse cx="' + g(cx + dx) + '" cy="' + g(cy + dy) + '" rx="' + g(rx) + '" ry="' + g(ry) +
          '" fill="none" stroke="' + darken(e.fill) + '" stroke-width="1.4" opacity="0.7"/>');
      }
    });
    out.push('</g>');

    var glow = [];
    if (p.spark) glow = glow.concat(flare(W - 8, 10));
    if (p.excited) {
      var st = String(p.kaomoji) + String(p.feel) + String(p.trying), seed = 0;
      for (var i = 0; i < st.length; i++) seed += st.codePointAt(i);
      glow = glow.concat(sparkle(H, seed));
    }
    if (glow.length) { out.push('<g opacity="0.9">'); glow.forEach(function (s) { out.push(s); }); out.push('</g>'); }

    if (multiline) {
      var spans = kaoLines.map(function (l, i) { return '<tspan x="' + FACE_X + '"' + (i === 0 ? "" : ' dy="20"') + '>' + esc(l) + '</tspan>'; }).join("");
      out.push('<text x="' + FACE_X + '" y="' + g(kaoAbs[0]) + '" class="txt fkt">' + spans + '</text>');
    } else {
      out.push('<text x="' + FACE_X + '" y="' + g(kaoAbs[0]) + '" class="txt fk">' + esc(p.kaomoji) + '</text>');
    }

    if (langs.length) {
      var x = FACE_X, SEP = 11;
      langs.forEach(function (pair, i) {
        var w = wide(pair[0]);
        out.push('<g><title>' + esc(pair[1]) + '</title><text x="' + g(x + w / 2) + '" y="' + g(langY) +
          '" text-anchor="middle" class="txt fx">' + esc(pair[0]) + '</text></g>');
        x += w;
        if (i < langs.length - 1) { out.push('<text x="' + g(x + SEP / 2) + '" y="' + g(langY) + '" text-anchor="middle" class="txt fx" opacity="0.55">·</text>'); x += SEP; }
      });
    }

    lines.forEach(function (ln, i) { out.push('<text x="' + ln.x + '" y="' + g(rightAbs[i]) + '" class="txt">' + ln.inner + '</text>'); });

    out.push('</svg>');
    return out.join("");
  }

  root.vibe = function (el, payload) { el.innerHTML = buildSVG(payload); };
  root.vibe.buildSVG = buildSVG;
  if (typeof module !== "undefined" && module.exports) module.exports = { buildSVG: buildSVG };
})(typeof window !== "undefined" ? window : this);
