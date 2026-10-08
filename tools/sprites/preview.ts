// Contact-sheet preview of sheet-backed sprites, rendered without a browser.
//
//   npm run sprites:preview -- <castId|block:blockId ...> [--all] [--out <dir>] [--zoom <n>] [--anchors]
//
// For each id it writes <out>/<id>.png: the still Pose frames in every facing, then every animation
// with its frames per facing (down / left / right / up), labelled, zoomed (default 3x). The bottom
// row of each cell is the engine's ground row (the feet land there); --anchors marks the head anchor
// overlays are positioned from. Runs through vite-node with the headless DOM shim the tests use.
import '../../tests/setup';
import '../../src/content';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { POSES } from '../../src/art/humanoid';
import {
  frameAnchor, framePixels, lookAnims, poseRefs, sheetBlock, sheetBlockIds, sheetCastIds, sheetCastOf,
  type FramePixels, type SheetLook,
} from '../../src/art/sheets';
import { GLYPHS, GLYPH_SPACING } from '../../src/engine/fontdata';
import type { Dir } from '../../src/engine/math';
import { encodePng } from './png.mjs';

const FACINGS: readonly Dir[] = ['down', 'left', 'right', 'up'];
const LABEL_W = 64;
const HEAD_H = 11;

class Canvas {
  readonly data: Uint8Array;
  constructor(readonly w: number, readonly h: number, bg: [number, number, number]) {
    this.data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) this.data.set([bg[0], bg[1], bg[2], 255], i * 4);
  }

  px(x: number, y: number, c: readonly [number, number, number]): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data.set([c[0], c[1], c[2], 255], (y * this.w + x) * 4);
  }

  rect(x: number, y: number, w: number, h: number, c: readonly [number, number, number]): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  text(s: string, x: number, y: number, c: readonly [number, number, number]): void {
    let cx = x;
    for (const ch of s) {
      const g = GLYPHS[ch] ?? GLYPHS['?'];
      g.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') this.px(cx + gx, y + gy, c);
      });
      cx += g[0].length + GLYPH_SPACING;
    }
  }

  /** Draw a frame on a light checkerboard with the ground row tinted. */
  frame(f: FramePixels, x: number, y: number): void {
    for (let j = 0; j < f.h; j++) {
      for (let i = 0; i < f.w; i++) {
        const k = (j * f.w + i) * 4;
        if (f.data[k + 3]) this.px(x + i, y + j, [f.data[k], f.data[k + 1], f.data[k + 2]]);
        else this.px(x + i, y + j, j === f.h - 1 ? [236, 196, 196] : ((i >> 2) + (j >> 2)) % 2 ? [214, 214, 222] : [232, 232, 238]);
      }
    }
  }

  scaled(z: number): { w: number; h: number; data: Uint8Array } {
    const w = this.w * z;
    const h = this.h * z;
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (Math.floor(y / z) * this.w + Math.floor(x / z)) * 4;
        out.set(this.data.subarray(s, s + 4), (y * w + x) * 4);
      }
    }
    return { w, h, data: out };
  }
}

function render(id: string, look: SheetLook, anchors: boolean): Canvas {
  const block = sheetBlock(look.block);
  if (!block) throw new Error(`block "${look.block}" is not built (add its spec and run npm run sprites)`);
  const anims = lookAnims(look);
  const poses = poseRefs(anims);
  const size = Math.round(block.size * (look.scale ?? 1));
  const cell = size + 2;
  const names = Object.keys(anims);
  const longest = Math.max(...names.map((n) => Math.max(...FACINGS.map((d) => anims[n].dirs[d].length))));
  const groupW = longest * cell + 6;
  const W = LABEL_W + Math.max(POSES.length * cell, FACINGS.length * groupW) + 4;
  const H = HEAD_H * 2 + FACINGS.length * cell + 8 + HEAD_H + names.length * (cell + 2) + 4;
  const cv = new Canvas(W, H, [40, 44, 56]);
  const white = [255, 255, 255] as const;
  const dim = [170, 176, 196] as const;
  const marker = [255, 0, 200] as const;
  const put = (ref: number, dir: Dir, anim: string, x: number, y: number) => {
    const from = anims[anim].block;
    cv.frame(framePixels(look, ref, dir, anim, from), x, y);
    if (anchors) {
      const [ax, ay] = frameAnchor(from, ref);
      const k = look.scale ?? 1;
      cv.px(x + Math.floor(ax * k), y + Math.floor(ay * k), marker);
    }
  };

  cv.text(`${id}  (block ${look.block}: ${block.name.slice(0, 60)})`, 2, 1, white);
  let y = HEAD_H;
  POSES.forEach((p, i) => cv.text(p.slice(0, 6), LABEL_W + i * cell, y, dim));
  y += HEAD_H;
  for (const d of FACINGS) {
    cv.text(d, 2, y + (size >> 1) - 4, dim);
    POSES.forEach((p, i) => put(poses[p][d].ref, d, poses[p][d].anim, LABEL_W + i * cell, y));
    y += cell;
  }
  y += 8;
  FACINGS.forEach((d, i) => cv.text(d, LABEL_W + i * groupW, y, dim));
  y += HEAD_H;
  for (const name of names) {
    const a = anims[name];
    cv.text(name.slice(0, 10), 2, y + 2, white);
    if (a.block !== look.block) cv.text(a.block.slice(0, 10), 2, y + 22, dim);
    cv.text(`${a.fps}fps${a.loop ? ' loop' : ''}`, 2, y + 12, dim);
    FACINGS.forEach((d, gi) => a.dirs[d].forEach((ref, fi) => put(ref, d, name, LABEL_W + gi * groupW + fi * cell, y)));
    y += cell + 2;
  }
  return cv;
}

function main(): void {
  const args = process.argv.slice(2);
  let out = join(tmpdir(), 'legacy-of-super-sprites');
  let zoom = 3;
  let anchors = false;
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') out = resolve(args[++i] ?? '');
    else if (a === '--zoom') zoom = Math.max(1, Math.min(8, Number(args[++i]) || 3));
    else if (a === '--anchors') anchors = true;
    else if (a === '--all') ids.push(...sheetCastIds());
    else if (a === '--blocks') ids.push(...sheetBlockIds().map((b) => `block:${b}`));
    else if (a !== '--') ids.push(a);
  }
  if (!ids.length) {
    console.error('usage: npm run sprites:preview -- <castId|block:blockId ...> [--all] [--blocks] [--out <dir>] [--zoom <n>] [--anchors]');
    console.error(`sheet cast ids: ${sheetCastIds().join(', ') || '(none)'}`);
    console.error(`built blocks: ${sheetBlockIds().join(', ') || '(none)'}`);
    process.exit(1);
  }
  mkdirSync(out, { recursive: true });
  let failed = 0;
  for (const id of ids) {
    const look: SheetLook | undefined = id.startsWith('block:') ? { block: id.slice(6) } : sheetCastOf(id);
    if (!look) {
      console.error(`${id}: not a sheet-backed cast id (register it with registerSheetCast, or pass block:<blockId>)`);
      failed++;
      continue;
    }
    try {
      const img = render(id, look, anchors).scaled(zoom);
      const file = join(out, `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.png`);
      writeFileSync(file, encodePng(img.w, img.h, img.data));
      console.log(file);
    } catch (e) {
      console.error(`${id}: ${(e as Error).message}`);
      failed++;
    }
  }
  if (failed) process.exit(1);
}

main();
