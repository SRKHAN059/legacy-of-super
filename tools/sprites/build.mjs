#!/usr/bin/env node
// Sprite-sheet build: reads tools/sprites/specs/*.json, slices the referenced LoG2 sheet cells from
// assets/sprites/*.png, keys out the background, strips the baked ground shadow, aligns feet to the
// engine's ground row and writes src/art/sheets.gen.ts (palette-indexed, run-length-encoded frames).
//
//   node tools/sprites/build.mjs                 rebuild src/art/sheets.gen.ts
//   node tools/sprites/build.mjs --check         exit 1 when the generated file is stale
//   node tools/sprites/build.mjs --debug <dir>   also write <sheet>.shadow.png per sheet: removed
//                                                shadow pixels red, background grey (for review)
//   node tools/sprites/build.mjs --debug <dir> --all-sheets
//                                                only write those review images, for every cell of
//                                                every sheet (no specs needed, nothing generated)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';
import { alignToGround, bottomRow, embedCell, encodeIndices, findShadow, headAnchor, KEY_COLORS, sliceCell } from './process.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_DIR = join(ROOT, 'tools/sprites/specs');
const SHEET_DIR = join(ROOT, 'assets/sprites');
const OUT_FILE = join(ROOT, 'src/art/sheets.gen.ts');

const DIRS = ['down', 'left', 'right', 'up'];
const MIRROR = { left: 'right', right: 'left' };
/** Animations every fighter block should define (the engine's Pose set maps onto these). */
const FIGHTER_ANIMS = ['idle', 'walk', 'punch1', 'punch2', 'punch3', 'kick', 'blast', 'charge', 'hurt', 'ko', 'raise', 'fly', 'guard'];
const NPC_ANIMS = ['idle', 'walk'];
/**
 * Shadow handling per animation: strip (default: whole black fragments in the shadow band),
 * outline (for characters whose black trousers, tights or shoes touch the shadow: the black clothing
 * is separated from the ellipse where it meets the coloured body, see process.mjs findShadow),
 * flat (thin slivers only: lying bodies), keep (none).
 */
const SHADOW_MODES = ['strip', 'flat', 'keep', 'outline'];
/** Animations of bodies on the ground default to the 'flat' shadow mode so hair on the floor survives. */
const LYING = /^(ko|lie|lying|sleep|dead|faint|down|sick)/i;

const args = process.argv.slice(2);
const check = args.includes('--check');
const debugAt = args.indexOf('--debug');
const debugDir = debugAt >= 0 ? resolve(args[debugAt + 1] ?? '') : null;
if (debugAt >= 0 && !args[debugAt + 1]) fail('--debug needs an output directory');

const errors = [];
const warnings = [];

function fail(msg) {
  console.error(`sprites: ${msg}`);
  process.exit(1);
}

const sheetCache = new Map();
function loadSheet(name) {
  let img = sheetCache.get(name);
  if (!img) {
    const path = join(SHEET_DIR, name);
    if (!existsSync(path)) throw new Error(`sheet ${name} not found in assets/sprites`);
    img = decodePng(readFileSync(path));
    sheetCache.set(name, img);
  }
  return img;
}

const isInt = (v) => Number.isInteger(v);

/** Validate a block's shape; returns the per-direction column lists of each animation. */
function animsOf(block, where) {
  const rows = block.rows ?? {};
  const dirs = DIRS.filter((d) => rows[d] !== undefined);
  for (const d of Object.keys(rows)) {
    if (!DIRS.includes(d)) throw new Error(`${where}: unknown facing "${d}" in rows`);
    if (!isInt(rows[d]) || rows[d] < 0) throw new Error(`${where}: rows.${d} must be a non-negative integer`);
  }
  if (!dirs.length) throw new Error(`${where}: rows has no facings`);
  // A block-level "shadow" is the default mode of its standing animations (lying ones stay 'flat').
  if (block.shadow !== undefined && !['strip', 'outline', 'keep'].includes(block.shadow)) throw new Error(`${where}: shadow must be one of strip, outline, keep`);
  const blockShadow = block.shadow ?? 'strip';
  const out = {};
  for (const [name, anim] of Object.entries(block.anims ?? {})) {
    const at = `${where} anim "${name}"`;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`${at}: animation names must be identifiers`);
    if (!anim || typeof anim !== 'object') throw new Error(`${at}: must be an object`);
    const fps = anim.fps ?? 8;
    if (typeof fps !== 'number' || !(fps > 0) || fps > 60) throw new Error(`${at}: fps must be in (0, 60]`);
    const per = {};
    if (Array.isArray(anim.frames)) {
      for (const d of dirs) per[d] = anim.frames;
    } else if (anim.frames && typeof anim.frames === 'object') {
      for (const [d, cols] of Object.entries(anim.frames)) {
        if (!DIRS.includes(d)) throw new Error(`${at}: unknown facing "${d}"`);
        if (rows[d] === undefined) throw new Error(`${at}: facing "${d}" has no row in rows`);
        per[d] = cols;
      }
    } else throw new Error(`${at}: frames must be a list or a per-facing object`);
    for (const [d, cols] of Object.entries(per)) {
      if (!Array.isArray(cols) || !cols.length) throw new Error(`${at}: facing ${d} has no frames`);
      for (const c of cols) if (!isInt(c) || c < 0) throw new Error(`${at}: column ${JSON.stringify(c)} is not a non-negative integer`);
    }
    if (anim.shadow !== undefined && !SHADOW_MODES.includes(anim.shadow)) throw new Error(`${at}: shadow must be one of ${SHADOW_MODES.join(', ')}`);
    const shadow = anim.shadow ?? (LYING.test(name) ? 'flat' : blockShadow);
    // "remap": exact sheet colour -> colour for this animation's cells (cells ripped under a wrong palette).
    const remap = {};
    if (anim.remap !== undefined) {
      if (!anim.remap || typeof anim.remap !== 'object' || Array.isArray(anim.remap)) throw new Error(`${at}: remap must be an object of "#rrggbb": "#rrggbb"`);
      for (const [from, to] of Object.entries(anim.remap)) {
        const f = from.toLowerCase();
        const t = String(to).toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(f) || !/^#[0-9a-f]{6}$/.test(t)) throw new Error(`${at}: remap ${from} -> ${to} must map #rrggbb to #rrggbb`);
        remap[f] = t;
      }
    }
    out[name] = { fps, loop: anim.loop !== false, per, shadow, remap, key: `${shadow}|${JSON.stringify(Object.entries(remap).sort())}` };
  }
  if (!Object.keys(out).length) throw new Error(`${where}: no animations`);
  if (!out.idle) {
    warnings.push(`${where}: no "idle" animation - usable only as an extra animation source (SheetLook.extra), not as a cast block`);
    return out;
  }
  const fighter = ['punch1', 'blast', 'charge'].some((n) => out[n]);
  const missing = (fighter ? FIGHTER_ANIMS : NPC_ANIMS).filter((n) => !out[n]);
  if (missing.length) warnings.push(`${where}: missing ${fighter ? 'fighter' : 'NPC'} animations ${missing.join(', ')} (the runtime falls back to idle)`);
  return out;
}

/** Build one block into its generated record. */
function buildBlock(block, sheetName, img, where, debug) {
  const cell = block.cell ?? 32;
  const [cw, ch] = Array.isArray(cell) ? cell : [cell, cell];
  if (!isInt(cw) || !isInt(ch) || cw < 8 || ch < 8 || cw > 64 || ch > 64) throw new Error(`${where}: cell must be a size or [width, height] in [8, 64]`);
  // Frames are square and at least 32px so they drop into the engine where procedural 24x32 frames stood.
  const size = Math.max(32, cw, ch);
  const [ox, oy] = block.origin ?? [];
  if (!isInt(ox) || !isInt(oy)) throw new Error(`${where}: origin must be [x, y]`);
  const anims = animsOf(block, where);

  // Slice + strip every referenced cell once.
  const cells = new Map();
  // `a` is the animation the cell is used in: its shadow mode and colour remap shape the result.
  const cellOf = (dir, col, a) => {
    const mode = a.shadow;
    const key = `${block.rows[dir]}:${col}:${a.key}`;
    let c = cells.get(key);
    if (c) return c;
    const x0 = ox + col * cw;
    const y0 = oy + block.rows[dir] * ch;
    if (x0 + cw > img.width || y0 + ch > img.height) throw new Error(`cell col ${col} row ${block.rows[dir]} (${dir}) lies outside ${sheetName}`);
    const raw = embedCell(sliceCell(img, x0, y0, cw, ch), cw, ch, size).map((v) => (v && a.remap[v]) || v);
    const shadow = block.keepShadow || mode === 'keep' ? new Set() : findShadow(raw, size, { flat: mode === 'flat', outline: mode === 'outline' });
    const ex = Math.floor((size - cw) / 2);
    const ey = size - ch;
    if (debug) for (const p of shadow) debug.add((y0 + Math.floor(p / size) - ey) * img.width + x0 + (p % size) - ex);
    c = { raw: raw.map((v, i) => (shadow.has(i) ? null : v)), col, dir };
    cells.set(key, c);
    return c;
  };
  for (const a of Object.values(anims)) for (const [d, cols] of Object.entries(a.per)) for (const col of cols) cellOf(d, col, a);

  // Ground row: the lowest foot pixel of the standing and walking frames in any facing (LoG2 draws
  // front-facing strides a pixel lower than the stance, so the stance alone would be too high).
  // A spec may pin it with "baseline" (a row of the sheet cell); blocks without idle / walk (extra
  // pose sources) keep the sheet's own ground, the cell's bottom row.
  let ground = block.baseline === undefined ? undefined : block.baseline + (size - ch);
  if (ground === undefined && !anims.idle && !anims.walk) ground = size - 1;
  if (ground === undefined) {
    const lows = [];
    for (const name of ['idle', 'walk']) {
      for (const [d, cols] of Object.entries(anims[name]?.per ?? {})) {
        for (const c of cols) lows.push(bottomRow(cellOf(d, c, anims[name]).raw, size));
      }
    }
    const valid = lows.filter((v) => v >= 0);
    if (!valid.length) throw new Error('idle frames are empty');
    ground = Math.max(...valid);
  }
  if (!isInt(ground) || ground < 0 || ground >= size) throw new Error('baseline must be a row inside the cell');

  // Palette (index 0 = transparent), frames, anchors.
  const colors = new Set();
  for (const c of cells.values()) for (const v of c.raw) if (v) colors.add(v);
  const palette = [...colors].sort();
  if (palette.length > 127) throw new Error(`${where}: ${palette.length} colours; split the block (max 127)`);
  const indexOf = new Map(palette.map((c, i) => [c, i + 1]));

  const frames = [];
  const anchors = [];
  const frameIds = new Map();
  const encodedOf = new Map();
  let lifted = 0;
  const frameOf = (dir, col, a) => {
    const key = `${block.rows[dir]}:${col}:${a.key}`;
    if (frameIds.has(key)) return frameIds.get(key);
    const c = cellOf(dir, col, a);
    if (bottomRow(c.raw, size) < 0) {
      warnings.push(`${where}: ${dir} col ${col} is an empty cell; dropped from its animations`);
      frameIds.set(key, null);
      return null;
    }
    const { cell, shift } = alignToGround(c.raw, size, ground);
    if (shift < size - 1 - ground) lifted++;
    const idx = cell.map((v) => (v ? indexOf.get(v) : 0));
    const b64 = Buffer.from(encodeIndices(idx, size)).toString('base64');
    const mirrored = idx.map((_, i) => idx[i - (i % size) + (size - 1 - (i % size))]);
    const mirrorOf = encodedOf.get(Buffer.from(encodeIndices(mirrored, size)).toString('base64'));
    // Exact duplicates share a frame; exact mirrors (LoG2's right rows) reference it flipped (~id).
    let id = encodedOf.get(b64) ?? (mirrorOf === undefined ? undefined : ~mirrorOf);
    if (id === undefined) {
      id = frames.length;
      frames.push(b64);
      anchors.push(...headAnchor(cell, size));
      encodedOf.set(b64, id);
    }
    frameIds.set(key, id);
    return id;
  };

  const outAnims = {};
  for (const [name, a] of Object.entries(anims)) {
    const dirs = {};
    for (const [d, cols] of Object.entries(a.per)) {
      const ids = cols.map((col) => frameOf(d, col, a)).filter((v) => v !== null);
      if (ids.length) dirs[d] = ids;
    }
    // A missing side facing is the mirror of the other side (encoded as ~id).
    for (const [d, m] of Object.entries(MIRROR)) if (!dirs[d] && dirs[m]) dirs[d] = dirs[m].map((id) => ~id);
    if (!Object.keys(dirs).length) {
      warnings.push(`${where}: animation "${name}" has only empty cells; dropped`);
      continue;
    }
    outAnims[name] = { fps: a.fps, loop: a.loop, dirs };
  }
  if (anims.idle && !outAnims.idle) throw new Error('idle animation has no usable frames');
  if (lifted) warnings.push(`${where}: ${lifted} frame(s) reach below the ground row (lying/low poses) and sit up to ${size - 1 - ground}px higher to avoid cropping`);

  const parts = {};
  for (const [part, list] of Object.entries(block.palette ?? {})) {
    if (!Array.isArray(list)) throw new Error(`${where}: palette.${part} must be a list`);
    parts[part] = list.map((h) => {
      const hex = String(h).toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error(`${where}: palette.${part} colour ${h} is not #rrggbb`);
      if (!colors.has(hex)) warnings.push(`${where}: palette.${part} colour ${hex} does not occur in the block's frames`);
      return hex;
    });
  }

  return {
    name: String(block.name ?? block.id),
    sheet: sheetName,
    size,
    ground,
    pinnedGround: block.baseline !== undefined,
    palette,
    parts,
    frames,
    anchors,
    anims: outAnims,
  };
}

function writeDebug(sheetName, img, removed) {
  const out = new Uint8Array(img.data);
  const keys = new Set(KEY_COLORS.map((h) => parseInt(h.slice(1), 16)));
  for (let p = 0; p < img.width * img.height; p++) {
    const i = p * 4;
    const rgb = (out[i] << 16) | (out[i + 1] << 8) | out[i + 2];
    if (removed.has(p)) { out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; }
    else if (keys.has(rgb)) { out[i] = 200; out[i + 1] = 200; out[i + 2] = 216; }
  }
  mkdirSync(debugDir, { recursive: true });
  writeFileSync(join(debugDir, sheetName.replace(/\.png$/, '.shadow.png')), encodePng(img.width, img.height, out));
}

/** Review mode: strip the shadow (default 'strip' mode) from every 32px cell of every sheet (grid from y = 32) and write the debug PNGs. */
function debugAllSheets() {
  const sheets = readdirSync(SHEET_DIR).filter((f) => f.endsWith('.png')).sort();
  for (const name of sheets) {
    const img = loadSheet(name);
    const removed = new Set();
    for (let y0 = 32; y0 + 32 <= img.height; y0 += 32) {
      for (let x0 = 0; x0 + 32 <= img.width; x0 += 32) {
        for (const p of findShadow(sliceCell(img, x0, y0, 32), 32)) removed.add((y0 + Math.floor(p / 32)) * img.width + x0 + (p % 32));
      }
    }
    writeDebug(name, img, removed);
  }
  console.log(`sprites: shadow review images for ${sheets.length} sheets -> ${debugDir}`);
}

function main() {
  if (args.includes('--all-sheets')) {
    if (!debugDir) fail('--all-sheets needs --debug <dir>');
    debugAllSheets();
    return;
  }
  const files = existsSync(SPEC_DIR) ? readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const blocks = {};
  const origin = {};
  let bytes = 0;
  let frameCount = 0;
  for (const file of files) {
    let spec;
    try {
      spec = JSON.parse(readFileSync(join(SPEC_DIR, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${e.message})`);
      continue;
    }
    const sheetName = spec.sheet;
    let img;
    try {
      if (typeof sheetName !== 'string') throw new Error('missing "sheet"');
      img = loadSheet(sheetName);
    } catch (e) {
      errors.push(`${file}: ${e.message}`);
      continue;
    }
    const debug = debugDir ? new Set() : null;
    for (const block of spec.blocks ?? []) {
      const where = `${file} block "${block?.id}"`;
      try {
        if (!block || typeof block.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(block.id)) throw new Error('block id must be an identifier');
        if (blocks[block.id]) throw new Error(`duplicate block id (already defined in ${origin[block.id]})`);
        const built = buildBlock(block, sheetName, img, where, debug);
        blocks[block.id] = built;
        origin[block.id] = file;
        frameCount += built.frames.length;
        bytes += built.frames.reduce((n, f) => n + f.length, 0);
      } catch (e) {
        errors.push(e.message.startsWith(where) ? e.message : `${where}: ${e.message}`);
      }
    }
    if (debug) writeDebug(sheetName, img, debug);
  }

  for (const w of warnings) console.warn(`warn  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error ${e}`);
    fail(`${errors.length} error(s); ${OUT_FILE} not written`);
  }

  const ids = Object.keys(blocks).sort();
  // One line per frame keeps diffs of the generated file readable when a spec changes.
  const body = ids.map((id) => {
    const { frames, ...rest } = blocks[id];
    const head = Object.entries(rest).map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join('\n');
    return `  ${id}: {\n${head}\n    frames: [\n${frames.map((f) => `      '${f}',`).join('\n')}\n    ],\n  },`;
  }).join('\n');
  const src = [
    '// AUTO-GENERATED by tools/sprites/build.mjs from tools/sprites/specs/*.json and assets/sprites/*.png.',
    '// Do not edit by hand: change a spec and run `npm run sprites`.',
    "import type { SheetBlockData } from './sheets';",
    '',
    '/** Every sprite-sheet block, keyed by block id. */',
    `export const SHEET_BLOCKS: Readonly<Record<string, SheetBlockData>> = {${ids.length ? `\n${body}\n` : ''}};`,
    '',
  ].join('\n');

  if (check) {
    const cur = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
    if (cur !== src) fail('src/art/sheets.gen.ts is out of date; run `npm run sprites`');
    console.log(`sprites: up to date (${ids.length} blocks)`);
    return;
  }
  writeFileSync(OUT_FILE, src);
  console.log(`sprites: ${ids.length} block(s) from ${files.length} spec(s), ${frameCount} unique frames, ${(bytes / 1024).toFixed(1)} KiB frame data -> src/art/sheets.gen.ts`);
  if (ids.length) console.log(`sprites: blocks ${ids.join(', ')}`);
}

main();
