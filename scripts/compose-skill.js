#!/usr/bin/env node
/* Compose a skill the same way the Builder does, and print it.
 *
 * There are no checked-in skill files (v0.49.0): the Builder is where the skill exists, and a
 * second copy on disk was only ever a thing to drift. This is the same composer, reachable
 * from a terminal so a release can install the canonical build without a round trip through
 * the UI.
 *
 *   node scripts/compose-skill.js                     → sepia in her tidepool, to stdout
 *   node scripts/compose-skill.js motes night         → any face + home
 *   node scripts/compose-skill.js sepia tidepool -o ~/.claude/skills/vibe-banner/SKILL.md
 *
 * The pin is stamped by `npm run pin`, so compose AFTER pinning or the snippet will carry the
 * placeholder sha and load nothing.
 */
const fs = require("fs");
const { assemble, PIECES, HOMES } = require("./gen-skills.js");

const argv = process.argv.slice(2);
const oi = argv.indexOf("-o");
// --install resolves the user's own skills folder, so no absolute path has to live in
// package.json where it would be wrong for everyone but its author
const install = argv.indexOf("--install") >= 0;
const out = install ? require("path").join(require("os").homedir(), ".claude", "skills", "vibe-banner", "SKILL.md")
  : (oi >= 0 ? argv[oi + 1] : null);
const pos = (oi >= 0 ? argv.slice(0, oi) : argv).filter(function (a) { return a && a !== "--install"; });
const face = pos[0] || "sepia";
const scene = pos[1] || HOMES[face] || "study";

if (!PIECES.PREVIEW[face] && face !== "kaomoji") {
  console.error(`unknown face "${face}" — try: ${Object.keys(HOMES).join(", ")}`);
  process.exit(1);
}
if (!PIECES.SCENES[scene]) {
  console.error(`unknown scene "${scene}" — try: ${Object.keys(PIECES.SCENES).join(", ")}`);
  process.exit(1);
}

// The composer stamps its own pin. gen-skills.js carries a placeholder that `npm run pin`
// used to rewrite in the emitted FILES — with no files left, the substitution has to happen
// here. Same rule as pin.js: the last commit that touched dist/, which is the release commit
// by construction, never HEAD (a docs commit after a release still "contains" dist, but
// pinning it makes the URL and the prose disagree).
let md = assemble(face, { scene: scene });
let sha = null;
try {
  sha = require("child_process").execSync("git rev-list -1 HEAD -- dist/vibe.min.js",
    { cwd: __dirname + "/..", stdio: ["ignore", "pipe", "ignore"] }).toString().trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) sha = null;
  else require("child_process").execSync("git cat-file -e " + sha + ":dist/vibe.min.js",
    { cwd: __dirname + "/..", stdio: "ignore" });
} catch { sha = null; }
if (sha) md = md.replace(/vibe-banner@0{40}/g, "vibe-banner@" + sha);
const placeholder = /vibe-banner@0{40}/.test(md);

if (out) {
  const dir = require("path").dirname(out);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, md);
  console.error(`wrote ${out} — ${face} in the ${scene} (${md.length} bytes)`);
} else {
  process.stdout.write(md);
}
if (placeholder) {
  console.error("WARNING: the renderer pin is still the placeholder sha. Run `npm run pin` first,");
  console.error("otherwise this skill loads nothing.");
  process.exit(2);
}
