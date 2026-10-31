#!/usr/bin/env node
// Make the 7 seamless ground tiles (32×32, 3 variants each) from the locked palette.
//   node tools/tile-gen.mjs [outDir] [--preview docs/art/previews/tiles.png]
// Every mark wraps at the tile edge (mod 32), so tiles repeat with no seam.
// Rules: docs/art/style-guide.md section 2; record: docs/decisions/2026-10-31-ground-tiles.md.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const pi = args.indexOf("--preview");
const PREVIEW = pi >= 0 ? args[pi + 1] : null;
const OUT = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--preview") ?? "packages/client/public/tiles";
const C = JSON.parse(readFileSync(new URL("../docs/art/palette.json", import.meta.url))).colors;
const S = 32, VARIANTS = 3;
const RESERVED = ["ink", "white", "sea100", "red", "gold"];

// Small seeded PRNG (mulberry32).
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// mark kinds: "blob" (1-2 px clusters), "dash" (short horizontal line), "crack" (wandering line)
const TILES = {
  deepwater: { base: "sea900", marks: [{ c: "sea700", kind: "dash", n: 7, len: [3, 5] }] },
  shallows: { base: "sea700", marks: [{ c: "sea500", kind: "dash", n: 8, len: [3, 6] }, { c: "sea300", kind: "dash", n: 3, len: [2, 3] }] },
  sand: { base: "sand300", marks: [{ c: "sand500", kind: "blob", n: 14 }, { c: "sand100", kind: "blob", n: 8, small: true }] },
  meadow: { base: "leaf300", marks: [{ c: "leaf500", kind: "tuft", n: 10 }, { c: "leaf100", kind: "blob", n: 6, small: true }] },
  woods: { base: "leaf500", marks: [{ c: "leaf700", kind: "blob", n: 16 }, { c: "leaf900", kind: "blob", n: 5, small: true }] },
  highland: { base: "stone500", marks: [{ c: "stone700", kind: "blob", n: 12 }, { c: "stone300", kind: "blob", n: 8, small: true }] },
  ashland: { base: "ash700", marks: [{ c: "ash900", kind: "blob", n: 14 }, { c: "ember700", kind: "crack", n: 1, len: [4, 6] }] },
};

const hex = (n) => [1, 3, 5].map((i) => parseInt(C[n].slice(i, i + 2), 16));

function makeTile(def, seed) {
  const r = rng(seed), g = new Array(S * S).fill(def.base);
  const put = (x, y, c) => { g[((y % S + S) % S) * S + ((x % S + S) % S)] = c; };
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  for (const m of def.marks) for (let k = 0; k < m.n; k++) {
    const x = ri(0, S - 1), y = ri(0, S - 1);
    if (m.kind === "blob") { put(x, y, m.c); if (!m.small) { put(x + 1, y, m.c); if (r() < 0.5) put(x, y + 1, m.c); } }
    else if (m.kind === "tuft") { put(x, y, m.c); put(x - 1, y - 1, m.c); put(x + 1, y - 1, m.c); }
    else if (m.kind === "dash") { const L = ri(m.len[0], m.len[1]); for (let i = 0; i < L; i++) put(x + i, y, m.c); }
    else if (m.kind === "crack") { const L = ri(m.len[0], m.len[1]); let cx = x, cy = y; for (let i = 0; i < L; i++) { put(cx, cy, m.c); cx += 1; if (r() < 0.5) cy += r() < 0.5 ? 1 : -1; } }
  }
  return g;
}

function writePng(path, w, h, px) {
  const o = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { const [R, G, B] = hex(px(i % w, Math.floor(i / w))); o.data.set([R, G, B, 255], i * 4); }
  writeFileSync(path, PNG.sync.write(o));
}

mkdirSync(OUT, { recursive: true });
const all = [];
let seed = 1;
for (const [name, def] of Object.entries(TILES)) {
  for (const n of [def.base, ...def.marks.map((m) => m.c)]) {
    if (!C[n]) throw new Error(`${name}: ${n} is not in the palette`);
    if (RESERVED.includes(n)) throw new Error(`${name}: ${n} is reserved`);
  }
  for (let v = 0; v < VARIANTS; v++) {
    const g = makeTile(def, 1000 + seed++ * 7919);
    writePng(`${OUT}/${name}-${v}.png`, S, S, (x, y) => g[y * S + x]);
    all.push({ name, v, g });
  }
}
console.log(`${all.length} tiles written to ${OUT}`);

// Preview: one row per tile, each variant tiled 4×4 (shows seams), scale 2.
if (PREVIEW) {
  const rep = 4, sc = 2, cellW = S * rep, gap = 8;
  const names = Object.keys(TILES);
  const W = VARIANTS * (cellW + gap) * sc, H = names.length * (cellW + gap) * sc;
  writePng(PREVIEW, W, H, (x, y) => {
    const X = Math.floor(x / sc), Y = Math.floor(y / sc);
    const col = Math.floor(X / (cellW + gap)), row = Math.floor(Y / (cellW + gap));
    const lx = X % (cellW + gap), ly = Y % (cellW + gap);
    if (lx >= cellW || ly >= cellW || row >= names.length) return "ink";
    const t = all.find((a) => a.name === names[row] && a.v === col);
    return t.g[(ly % S) * S + (lx % S)];
  });
  console.log(`preview: ${PREVIEW}`);
}
