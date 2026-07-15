# vibe-annotation-renderer

Renders Claude's **vibe-annotation** mood banner — a kaomoji face, three (or four)
first-person readout lines, and an ambient field of colour — from a small object
of *feeling-values*. It's the render half of the [`vibe-annotations`] skill: the
skill supplies only the values, this owns all the geometry, colour, and layout.

It ships to a CDN so the skill can load it instead of emitting a full SVG every
turn — the skill's `show_widget` call shrinks from ~1.8 KB of SVG to a one-line
`vibe(el, { … })`, and Claude never has to generate (or see) the geometry.

## Use (browser, via jsDelivr)

```html
<div id="v"></div>
<script src="https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@v0.0.1/dist/vibe.min.js"></script>
<script>
  vibe(document.getElementById('v'), {
    kaomoji: "( ˶ˆ ꒳ ˆ˵ )",
    seems:   "…",          // [user]  — snap read of the user
    feel:    "…",          // [mood]  — activated emotions
    trying:  "…",          // [goal]  — immediate next goal (last; wraps if long)
    noticing:"…",          // [note]  — the subtext (optional)
    palette: ["#7d8fb8"],  // 0+ mood colours, strongest first; [] = neutral
    spread: 0.6, turbulence: 0.35, engagement: 0.5,
    spark: false, excited: false
  });
});
</script>
```

`buildSVG(payload)` (the pure function) is also exported for Node — see `test/parity.js`.

## Develop

```bash
npm install        # esbuild (dev only)
npm run build      # src/vibe.js -> dist/vibe.min.js
npm run parity     # structural self-checks
```

To release: bump, `npm run build`, commit `dist/vibe.min.js`, `git tag vX.Y.Z && git push --tags`.
jsDelivr serves the tag immediately at the URL above.

## Status

**v0** is a faithful port of the settled `vibe.py`. The generative / animated
redesign (living field, gentle motion) builds on top of this baseline.

[`vibe-annotations`]: Claude's inline mood-banner skill.
