import { describe, expect, it } from 'vitest';
import '../src/content';
import { buildHumanoid, POSES } from '../src/art/humanoid';
import { hasSprite, isSheetSprite, spriteSet } from '../src/art/registry';
import {
  animIndex, base64Bytes, buildSheetSet, decodeIndices, FRAME_POOL_CAP, frameAnchor, frameIndices, framePixels, isDefaultSheetCast,
  liveFrameCount, poseRefs, registerSheetCast, resolveAnims, sheetBlock, sheetBlockIds, sheetCastIds, sheetCastOf, spriteAnims,
  type SheetLook,
} from '../src/art/sheets';
import { CAST } from '../src/content/cast';
import { DIRS, type Dir } from '../src/engine/math';
import { Actor } from '../src/game/actor';
import {
  alignToGround, bottomRow, decodeIndices as toolDecode, encodeIndices, findShadow, headAnchor, KEY_COLORS, sliceCell, stripShadow,
} from '../tools/sprites/process.mjs';

/** Node built-ins without @types/node (the project type-checks against DOM types only). */
interface NodeHost {
  execFileSync(cmd: string, args: string[], opts: { cwd: string; encoding: 'utf8' }): string;
  existsSync(path: string): boolean;
  execPath: string;
}

async function nodeHost(): Promise<NodeHost> {
  const cp = await import('node:child_process' as string);
  const fs = await import('node:fs' as string);
  const proc = (globalThis as unknown as { process: { execPath: string } }).process;
  return { execFileSync: cp.execFileSync, existsSync: fs.existsSync, execPath: proc.execPath };
}

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/\/$/, '');

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Standard base64 of bytes (what the build writes via Buffer). */
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/** Build a size×size colour grid from rows of characters mapped through `pal` ('.' = transparent). */
function grid(rows: string[], pal: Record<string, string>, size = 32): (string | null)[] {
  const out: (string | null)[] = new Array(size * size).fill(null);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] !== '.') out[y * size + x] = pal[r[x]];
  });
  return out;
}

/** RGBA image from rows of '#rrggbb' cells (tests of slicing). */
function rgbaImage(w: number, h: number, colorAt: (x: number, y: number) => string): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = parseInt(colorAt(x, y).slice(1), 16);
      data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

const hex = (d: Uint8ClampedArray, i: number) => `#${((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1)}`;

function padRows(rows: string[], at: number, size = 32): string[] {
  const out = new Array(size).fill('.'.repeat(size));
  rows.forEach((r, i) => (out[at + i] = r.padEnd(size, '.')));
  return out;
}

describe('sprite sheet tooling: keying, shadow stripping, alignment, anchors, codec', () => {
  it('keys out both checkerboard greens, the outer background and the empty-cell border', () => {
    const img = rgbaImage(4, 2, (x, y) => (y === 1 && x === 3 ? '#ff7300' : KEY_COLORS[x]));
    const cell = sliceCell(img, 0, 0, 4);
    expect(cell.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cell[7]).toBe('#ff7300');
  });

  it('strips the black ground ellipse under the feet, including fragments split by a foot', () => {
    const rows = padRows([
      '..........kk......kk..........', // legs
      '..........kk......kk..........',
      '.......###kk####..kk###.......', // shadow row with the legs over it
      '......####kk#####.kk####......',
      '.......###########.#####......',
      '.........############.........',
    ], 26);
    const cell = grid(rows, { k: '#ad4a00', '#': '#000000' });
    const shadow = findShadow(cell, 32);
    const stripped = stripShadow(cell, 32);
    expect(stripped.filter((c) => c === '#000000')).toHaveLength(0);
    expect(stripped.filter((c) => c === '#ad4a00')).toHaveLength(cell.filter((c) => c === '#ad4a00').length);
    expect(shadow.size).toBe(cell.filter((c) => c === '#000000').length);
  });

  it('keeps black hair that reaches down from above the shadow band, and enclosed black eyes', () => {
    const rows: string[] = [];
    for (let y = 0; y < 32; y++) rows.push('.'.repeat(32));
    const set = (x: number, y: number, c: string) => (rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1));
    // A body lying on the ground with its black hair spilling to the bottom rows (a KO frame).
    for (let y = 14; y < 32; y++) for (let x = 2; x < 8; x++) set(x, y, '#');
    for (let y = 26; y < 32; y++) for (let x = 8; x < 24; x++) set(x, y, 's');
    set(14, 29, '#'); // a 1-pixel eye fully enclosed by skin
    const cell = grid(rows, { '#': '#000000', s: '#ffbdad' });
    const shadow = findShadow(cell, 32);
    expect(shadow.size).toBe(0);
  });

  it("'flat' mode (lying bodies) keeps a head of hair resting inside the band but strips thin slivers", () => {
    const rows: string[] = [];
    for (let y = 0; y < 32; y++) rows.push('.'.repeat(32));
    const set = (x: number, y: number, c: string) => (rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1));
    for (let y = 23; y < 31; y++) for (let x = 2; x < 10; x++) set(x, y, '#'); // hair, 8 rows tall
    for (let y = 25; y < 31; y++) for (let x = 10; x < 26; x++) set(x, y, 's'); // body
    for (let x = 22; x < 30; x++) { set(x, 30, '#'); set(x, 31, '#'); } // shadow sliver past the feet
    const cell = grid(rows, { '#': '#000000', s: '#ad4a00' });
    const flat = findShadow(cell, 32, { flat: true });
    expect(flat.size).toBe(16); // the sliver: rows 30-31 at x 22-29
    for (let y = 23; y < 31; y++) expect(flat.has(y * 32 + 2)).toBe(false);
    // The ordinary stripper would take the hair too: that is what 'flat' exists for.
    expect(findShadow(cell, 32).has(23 * 32 + 2)).toBe(true);
  });

  it("'outline' mode strips a shadow joined to black tights and keeps the legs", () => {
    const rows = padRows([
      '..........kkkk..kkkk.........', // black tights reaching down from above the shadow band
      '..........kkkk..kkkk.........',
      '..........kkkk..kkkk.........',
      '..........kkkk..kkkk.........',
      '..........kkkk..kkkk.........',
      '..........kkkk..kkkk.........',
      '.........kkkkkkkkkkkk........', // ankles flare and touch the ellipse beside the boots
      '.........kbbbbkkbbbbk........', // boots (coloured)
      '.....####kbbbbkkbbbbk####....', // shadow rows the boots stand on
      '....#####kkkkkkkkkkkk#####...',
      '.....####################....',
    ], 18);
    const cell = grid(rows, { k: '#000000', b: '#ad4a00', '#': '#000000' });
    const at = (x: number, y: number) => y * 32 + x;
    // The tights join the ellipse into one black component reaching above the band: 'strip' keeps it all.
    expect(findShadow(cell, 32).size).toBe(0);
    const shadow = findShadow(cell, 32, { outline: true });
    for (let y = 18; y < 25; y++) for (const x of [10, 13, 16, 19]) expect(shadow.has(at(x, y)), `leg ${x},${y}`).toBe(false);
    expect(shadow.has(at(5, 26))).toBe(true); // ellipse beside the feet
    expect(shadow.has(at(14, 26))).toBe(true); // ellipse between the feet
    expect(shadow.has(at(11, 27))).toBe(true); // black under the lowest coloured pixel of a column is ground
    expect(shadow.has(at(9, 24))).toBe(true); // flare beside the boots, joined to the ellipse
    expect(shadow.size).toBe(cell.filter((c) => c === '#000000').length - 7 * 8);
    // A white swoosh trail sweeping through the shadow is not outlined by it.
    const trail = grid(padRows(['....wwwwww....', '...##########.', '..############'], 29), { w: '#ffffff', '#': '#000000' });
    expect(findShadow(trail, 32, { outline: true }).size).toBe(22);
  });

  it('leaves flying frames (no black near the bottom) untouched', () => {
    const rows = padRows(['....####....', '....####....'], 10);
    const cell = grid(rows, { '#': '#000000' });
    expect(findShadow(cell, 32).size).toBe(0);
  });

  it('moves feet onto the last row without ever cropping low frames', () => {
    const standing = grid(padRows(['....kk....'], 29), { k: '#ad4a00' });
    const a = alignToGround(standing, 32, 29);
    expect(a.shift).toBe(2);
    expect(bottomRow(a.cell, 32)).toBe(31);
    const lying = grid(padRows(['kkkkkkkk', 'kkkkkkkk'], 30), { k: '#ad4a00' });
    const b = alignToGround(lying, 32, 29);
    expect(b.shift).toBe(0);
    expect(b.cell.filter(Boolean)).toHaveLength(16);
  });

  it('anchors the head at the top of the biggest blob, ignoring detached effect trails', () => {
    const rows = padRows([
      '..w.........hhhh..........', // a 1px swoosh fleck above-left
      '............hhhh..........',
      '...........ssssss.........',
      '...........ssssss.........',
      '............tttt..........',
    ], 6);
    const cell = grid(rows, { w: '#ffffff', h: '#000000', s: '#ffbdad', t: '#ff7300' });
    expect(headAnchor(cell, 32)).toEqual([14, 6]);
  });

  it('round-trips the RLE codec, and the runtime decoder matches the tool decoder', () => {
    const idx = new Uint8Array(32 * 32);
    for (let i = 0; i < idx.length; i++) idx[i] = (i * 7) % 11 < 3 ? 0 : 1 + (Math.floor(i / 5) % 9);
    for (let i = 300; i < 600; i++) idx[i] = 4; // a long run (> 129) splits into several tokens
    const bytes = encodeIndices(idx, 32);
    expect(Array.from(toolDecode(bytes, 32))).toEqual(Array.from(idx));
    expect(Array.from(decodeIndices(bytes, 32))).toEqual(Array.from(idx));
    const b64 = toBase64(bytes);
    expect(Array.from(base64Bytes(b64))).toEqual(Array.from(bytes));
    expect(Array.from(encodeIndices(new Uint8Array(32 * 32), 32))).toEqual([0, 0, 0, 0]);
  });

  it('src/art/sheets.gen.ts is up to date with tools/sprites/specs', async () => {
    const node = await nodeHost();
    if (!node.existsSync(`${ROOT}/assets/sprites`)) return;
    const out = node.execFileSync(node.execPath, [`${ROOT}/tools/sprites/build.mjs`, '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/up to date/);
  });
});

describe('generated sheet data', () => {
  const blocks = sheetBlockIds();

  it('has at least the Goku block', () => {
    expect(blocks).toContain('goku');
  });

  it.each(blocks)('block %s decodes: frames in bounds, palette indices valid, anchors per frame, anims resolve', (id) => {
    const b = sheetBlock(id);
    if (!b) throw new Error(id);
    expect(b.anchors.length).toBe(b.frames.length * 2);
    for (let f = 0; f < b.frames.length; f++) {
      const bytes = base64Bytes(b.frames[f]);
      const [x, y, w, h] = bytes;
      expect(x + w).toBeLessThanOrEqual(b.size);
      expect(y + h).toBeLessThanOrEqual(b.size);
      const g = frameIndices(id, f);
      expect(Math.max(...g)).toBeLessThanOrEqual(b.palette.length);
      expect(g.some((v) => v > 0)).toBe(true);
    }
    for (const a of Object.values(b.anims)) {
      for (const refs of Object.values(a.dirs)) for (const r of refs ?? []) expect(r < 0 ? ~r : r).toBeLessThan(b.frames.length);
    }
    const anims = resolveAnims(id);
    for (const a of Object.values(anims)) for (const d of DIRS) expect(a.dirs[d].length).toBeGreaterThan(0);
    // No key colour survives, and the baked shadow is gone from the idle frames' bottom row.
    for (const c of KEY_COLORS) expect(b.palette).not.toContain(c);
  });

  it.each(blocks)('block %s stands its idle / walk feet on the frame bottom row (where procedural feet stood)', (id) => {
    const b = sheetBlock(id);
    const anims = resolveAnims(id);
    if (!b || !anims.idle) return; // extra pose sources (no idle) keep the sheet's own ground
    let low = -1;
    for (const name of ['idle', 'walk']) {
      for (const d of DIRS) {
        for (const ref of anims[name]?.dirs[d] ?? []) {
          const g = frameIndices(id, ref);
          for (let i = 0; i < g.length; i++) if (g[i]) low = Math.max(low, Math.floor(i / b.size));
        }
      }
    }
    if (b.pinnedGround) expect(low).toBeLessThanOrEqual(b.size - 1);
    else expect(low).toBe(b.size - 1);
  });
});

describe('spec fixes carried by the generated data', () => {
  it("android18's mis-ripped 'startled' cells are remapped to her own palette", () => {
    const b = sheetBlock('android18');
    if (!b) throw new Error('android18 block missing');
    for (const wrong of ['#7b6342', '#9c9c00', '#cebd42', '#c69452', '#dead63', '#f7c673', '#f7dead']) expect(b.palette).not.toContain(wrong);
    expect(b.anims.startled?.dirs.left?.length).toBe(4);
  });

  it("android18 keeps her black tights while the baked shadow is stripped ('outline' mode)", () => {
    const b = sheetBlock('android18');
    if (!b) throw new Error('android18 block missing');
    const black = b.palette.indexOf('#000000') + 1;
    expect(black).toBeGreaterThan(0);
    const anims = resolveAnims('android18');
    const g = frameIndices('android18', anims.idle.dirs.down[0]);
    // Tights: black pixels in the leg rows just above the boots; shadow: none left on the last row.
    let legs = 0;
    for (let y = 22; y < 29; y++) for (let x = 0; x < 32; x++) if (g[y * 32 + x] === black) legs++;
    expect(legs).toBeGreaterThan(4);
    for (let x = 0; x < 32; x++) expect(g[31 * 32 + x]).not.toBe(black);
  });
});

describe('sheet looks: recolour, overlay, scale', () => {
  const goku = sheetBlock('goku');
  if (!goku) throw new Error('goku block missing');
  const anims = resolveAnims('goku');
  const ref = anims.idle.dirs.down[0];

  it('recolours exact sheet colours and whole palette parts', () => {
    const plain = framePixels({ block: 'goku' }, ref, 'down');
    const src = goku.palette.find((c) => {
      for (let i = 0; i < plain.data.length; i += 4) if (plain.data[i + 3] && hex(plain.data, i) === c) return true;
      return false;
    });
    if (!src) throw new Error('no colour');
    const swapped = framePixels({ block: 'goku', recolor: { [src]: '#00ff00' } }, ref, 'down');
    let had = 0;
    for (let i = 0; i < plain.data.length; i += 4) {
      if (!plain.data[i + 3]) continue;
      if (hex(plain.data, i) === src) {
        had++;
        expect(hex(swapped.data, i)).toBe('#00ff00');
      } else expect(hex(swapped.data, i)).toBe(hex(plain.data, i));
    }
    expect(had).toBeGreaterThan(0);
    const part = Object.keys(goku.parts).find((p) => (goku.parts[p]?.length ?? 0) > 0);
    if (part) {
      const from = goku.parts[part] ?? [];
      const viaPart = framePixels({ block: 'goku', parts: { [part]: ['#123456'] } }, ref, 'down');
      for (let i = 0; i < plain.data.length; i += 4) {
        if (plain.data[i + 3] && from.includes(hex(plain.data, i))) expect(hex(viaPart.data, i)).toBe('#123456');
      }
    }
  });

  it('draws overlays at the head anchor, mirrors them for the other side, and erases first', () => {
    const look: SheetLook = {
      block: 'goku',
      overlay: { palette: { X: '#123456', Y: '#654321' }, rows: { down: ['XY'], left: ['XY'] }, offset: { down: [0, 0], left: [0, 0] } },
    };
    const [ax, ay] = frameAnchor('goku', ref);
    const px = framePixels(look, ref, 'down');
    expect(hex(px.data, (ay * 32 + ax) * 4)).toBe('#123456');
    expect(hex(px.data, (ay * 32 + ax + 1) * 4)).toBe('#654321');
    // Right is the mirror of left: around the mirrored anchor, X stays on the anchor and Y moves left of it.
    const rightRef = anims.idle.dirs.right[0];
    const [rx, ry] = frameAnchor('goku', rightRef);
    const pr = framePixels(look, rightRef, 'right');
    expect(hex(pr.data, (ry * 32 + rx) * 4)).toBe('#123456');
    expect(hex(pr.data, (ry * 32 + rx - 1) * 4)).toBe('#654321');
    // Mirrored refs flip the anchor.
    expect(frameAnchor('goku', ~ref)[0]).toBe(31 - frameAnchor('goku', ref)[0]);
    // Erase: every pixel of an erased colour becomes transparent when no overlay pixel covers it.
    const target = goku.palette[0];
    const erased = framePixels({ block: 'goku', overlay: { palette: {}, rows: {}, erase: [target] } }, ref, 'down');
    for (let i = 0; i < erased.data.length; i += 4) if (erased.data[i + 3]) expect(hex(erased.data, i)).not.toBe(target);
    // skipAnims leaves the frame alone.
    const skipped = framePixels({ ...look, overlay: { ...look.overlay!, skipAnims: ['idle'] } }, ref, 'down', 'idle');
    expect(Array.from(skipped.data)).toEqual(Array.from(framePixels({ block: 'goku' }, ref, 'down').data));
  });

  it('scales uniformly with nearest-neighbour pixels', () => {
    const one = framePixels({ block: 'goku' }, ref, 'down');
    const two = framePixels({ block: 'goku', scale: 2 }, ref, 'down');
    expect(two.w).toBe(64);
    for (let y = 0; y < 32; y += 3) {
      for (let x = 0; x < 32; x += 3) {
        expect(hex(two.data, ((y * 2 + 1) * 64 + x * 2 + 1) * 4)).toBe(hex(one.data, (y * 32 + x) * 4));
        expect(two.data[((y * 2) * 64 + x * 2) * 4 + 3]).toBe(one.data[(y * 32 + x) * 4 + 3]);
      }
    }
    const set = buildSheetSet({ block: 'goku', scale: 1.5 });
    expect(set.idle.down.width).toBe(48);
    expect(spriteAnims(set)?.walk?.frames.left[0].width).toBe(48);
  });

  it('still poses come from the documented animation frames', () => {
    const refs = poseRefs(anims);
    expect(refs.idle.down.ref).toBe(anims.idle.dirs.down[0]);
    const walk = anims.walk.dirs.left;
    expect(refs.walk1.left.ref).toBe(walk[Math.floor(walk.length / 4)]);
    expect(refs.walk2.left.ref).toBe(walk[Math.floor((3 * walk.length) / 4)]);
    if (anims.ko) expect(refs.ko.left.ref).toBe(anims.ko.dirs.left[anims.ko.dirs.left.length - 1]);
  });
});

describe('sheet cast registry', () => {
  const ids = sheetCastIds();

  it('every registered sheet cast id is a real cast member with a built block', () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const look = sheetCastOf(id);
      expect(CAST[id], `${id} is not in CAST`).toBeTruthy();
      expect(look && sheetBlock(look.block), `${id}: block ${look?.block} not built`).toBeTruthy();
      expect(isSheetSprite(id)).toBe(true);
      expect(hasSprite(id)).toBe(true);
    }
  });

  it.each(ids)('%s yields every Pose in every facing, plus idle and walk animations', (id) => {
    const set = spriteSet(id);
    const k = sheetCastOf(id)?.scale ?? 1;
    for (const pose of POSES) {
      for (const d of DIRS) {
        expect(set[pose][d], `${id} ${pose} ${d}`).toBeTruthy();
        expect(set[pose][d].width).toBe(Math.round(32 * k));
        expect(set[pose][d].height).toBe(Math.round(32 * k));
      }
    }
    const anims = spriteAnims(set);
    expect(anims?.idle).toBeTruthy();
    expect(anims?.walk ?? anims?.idle).toBeTruthy();
    for (const a of Object.values(anims ?? {})) for (const d of DIRS) expect(a.frames[d].length).toBeGreaterThan(0);
  });

  it('wires every direct LoG2 match to its block', () => {
    const direct: Record<string, string> = {
      goku: 'goku', gokuSSJ: 'gokuSSJ', vegeta: 'vegeta', vegetaSSJ: 'vegetaSSJ', futureTrunks: 'futureTrunks',
      futureTrunksSSJ: 'futureTrunksSSJ', piccolo: 'piccolo', piccoloUnweighted: 'piccoloNoWeights', krillinGi: 'krillin',
      tien: 'tien', yamcha: 'yamcha', mrSatan: 'hercule', android17: 'android17', android18: 'android18', frieza: 'frieza',
      chiaotzu: 'chiaotzu', bulma: 'bulma', chichi: 'chichi', roshi: 'roshi', drBrief: 'drBriefs', panchy: 'panchy',
      dende: 'dende', mrPopo: 'popo', korin: 'korin', yajirobe: 'yajirobe', c02_oolong: 'oolong',
      frizaSoldier: 'friezaSoldierA', frizaSoldierB: 'friezaSoldierB', townsman: 'npcYoungMan', townswoman: 'npcWoman',
      oldMan: 'npcOldMan', kidNpc: 'npcChildB', police: 'npcPoliceman', scientist: 'npcScientist',
    };
    for (const [id, block] of Object.entries(direct)) expect(sheetCastOf(id)?.block, id).toBe(block);
  });

  it('procedural sets stay animation-free and unmapped ids keep their procedural art', () => {
    const unmapped = Object.keys(CAST).find((id) => !sheetCastOf(id));
    if (!unmapped) return;
    expect(spriteAnims(spriteSet(unmapped))).toBeUndefined();
    expect(spriteSet(unmapped).idle.down.width).toBe(buildHumanoid(CAST[unmapped]).idle.down.width);
  });
});

describe('Actor animation playback', () => {
  const id = 'goku';
  const fakeCtx = { drawImage: () => undefined, globalAlpha: 1 } as unknown as CanvasRenderingContext2D;

  it('keeps collision and hurtboxes independent of the sprite art', () => {
    const a = new Actor(id, 100, 80);
    expect(a.box()).toEqual({ x: 95, y: 74, w: 10, h: 6 });
    expect(a.body()).toEqual({ x: 93, y: 54, w: 14, h: 26 });
  });

  it('cycles the walk animation from walkT while moving, faster when running', () => {
    const a = new Actor(id, 0, 0);
    const walk = spriteAnims(a.set)?.walk;
    if (!walk) throw new Error('no walk');
    a.dir = 'left';
    a.moving = true;
    const seen: number[] = [];
    for (let t = 0; t < 120; t++) {
      a.animate();
      const i = walk.frames.left.indexOf(a.frame());
      expect(i).toBe(Math.floor((t + 1) * walk.fps / 60) % walk.frames.left.length);
      seen.push(i);
    }
    expect(new Set(seen).size).toBe(walk.frames.left.length);
    a.moving = false;
    a.animate();
    expect(a.frame()).toBe(spriteAnims(a.set)?.idle.frames.left[0]);
  });

  it('plays attacks from the moment the pose starts and holds the last frame of one-shot animations', () => {
    const a = new Actor(id, 0, 0);
    const anims = spriteAnims(a.set);
    const p1 = anims?.punch1;
    if (!p1 || !anims) throw new Error('no punch1');
    a.dir = 'right';
    for (let i = 0; i < 37; i++) a.animate();
    a.pose = 'punch1';
    const shown: number[] = [];
    for (let t = 0; t < 60; t++) {
      shown.push(p1.frames.right.indexOf(a.frame()));
      a.animate();
    }
    expect(shown[0]).toBe(0);
    expect(shown).toEqual(shown.map((_, t) => animIndex(p1, p1.frames.right.length, t)));
    if (!p1.loop) expect(shown[59]).toBe(p1.frames.right.length - 1);
    // The combo finisher pose plays the third string.
    a.pose = 'kick';
    const finisher = anims.punch3 ?? anims.kick;
    expect(finisher?.frames.right).toContain(a.frame());
  });

  it('loops charge and advances on draw for actors nobody animates', () => {
    const a = new Actor(id, 0, 0);
    const charge = spriteAnims(a.set)?.charge;
    if (!charge) throw new Error('no charge');
    a.scriptPose = 'charge';
    a.dir = 'down';
    const frames = new Set<number>();
    for (let t = 0; t < 240; t++) {
      a.draw(fakeCtx, 0, 0);
      frames.add(charge.frames.down.indexOf(a.frame()));
    }
    expect(frames.has(-1)).toBe(false);
    if (charge.frames.down.length > 1) expect(frames.size).toBe(charge.frames.down.length);
    // animate() and draw() together advance the clock once per tick, not twice.
    const before = a.animClock;
    for (let t = 0; t < 10; t++) {
      a.animate();
      a.draw(fakeCtx, 0, 0);
    }
    expect(a.animClock - before).toBe(10);
  });

  it('blinks now and then while idle when the block has a blink', () => {
    const a = new Actor(id, 0, 0);
    const anims = spriteAnims(a.set);
    if (!anims?.blink || anims.idle.frames.down.length !== 1) return;
    let blinks = 0;
    for (let t = 0; t < 600; t++) {
      a.animate();
      if (anims.blink.frames.down.includes(a.frame()) && a.frame() !== anims.idle.frames.down[0]) blinks++;
    }
    expect(blinks).toBeGreaterThan(0);
    expect(blinks).toBeLessThan(120);
  });

  it('every still Pose keeps working for scripted poses (title, credits, cutscenes)', () => {
    const a = new Actor(id, 0, 0);
    for (const pose of POSES) {
      for (const d of DIRS as readonly Dir[]) {
        a.scriptPose = pose;
        a.dir = d;
        expect(a.frame()).toBeTruthy();
      }
    }
    a.scriptPose = 'walk1';
    expect(a.frame()).toBe(a.set.walk1[a.dir]);
  });
});

describe('sheet cast registration', () => {
  it('defaults never override, plain looks replace defaults, and plain duplicates throw', () => {
    registerSheetCast({ __testDefault: { block: 'npcBoy' } }, { defaults: true });
    expect(isDefaultSheetCast('__testDefault')).toBe(true);
    // A second default registration leaves the first alone.
    registerSheetCast({ __testDefault: { block: 'npcGirl' } }, { defaults: true });
    expect(sheetCastOf('__testDefault')?.block).toBe('npcBoy');
    const before = spriteSet('__testDefault');
    // Content re-dresses a default: the look and the cached sprite set are replaced.
    registerSheetCast({ __testDefault: { block: 'npcBoy', recolor: { '#845218': '#203080' } } });
    expect(isDefaultSheetCast('__testDefault')).toBe(false);
    expect(sheetCastOf('__testDefault')?.recolor).toBeTruthy();
    expect(spriteSet('__testDefault')).not.toBe(before);
    // Content registered first wins over a later default, and a plain duplicate throws.
    registerSheetCast({ __testContent: { block: 'npcGirl' } });
    registerSheetCast({ __testContent: { block: 'npcBoy' } }, { defaults: true });
    expect(sheetCastOf('__testContent')?.block).toBe('npcGirl');
    expect(() => registerSheetCast({ __testContent: { block: 'npcBoy' } })).toThrow(/Duplicate/);
    expect(() => registerSheetCast({ __testDefault: { block: 'npcBoy' } })).toThrow(/Duplicate/);
  });
});

describe('sheet frame pool', () => {
  it('renders frames on use and never keeps more canvases alive than the budget, whatever the cast seen', () => {
    // Browsers drop every canvas's pixels once a page holds ~8,000 image resources; the full cast
    // spans far more sheet frames than that, so touching all of them must stay within the pool.
    let touched = 0;
    for (const id of sheetCastIds()) {
      const set = spriteSet(id);
      for (const pose of POSES) for (const d of DIRS) { expect(set[pose][d].width).toBeGreaterThan(0); touched++; }
      for (const a of Object.values(spriteAnims(set) ?? {})) {
        for (const d of DIRS) for (const b of a.frames[d]) { expect(b.height).toBeGreaterThan(0); touched++; }
      }
      expect(liveFrameCount()).toBeLessThanOrEqual(FRAME_POOL_CAP);
    }
    expect(touched).toBeGreaterThan(FRAME_POOL_CAP);
  });

  it('keeps a frame in use stable and rebuilds a released frame on its next use', () => {
    const walk = spriteAnims(spriteSet('goku'))?.walk;
    if (!walk) throw new Error('goku has no walk animation');
    const first = walk.frames.left[0];
    expect(walk.frames.left[0]).toBe(first);
    // Push the frame out of the pool by using more than a budget's worth of other frames.
    let used = 0;
    for (const id of sheetCastIds()) {
      if (id === 'goku' || used > FRAME_POOL_CAP * 2) continue;
      const anims = spriteAnims(spriteSet(id)) ?? {};
      for (const a of Object.values(anims)) for (const d of DIRS) for (const b of a.frames[d]) { expect(b).toBeTruthy(); used++; }
    }
    expect(used).toBeGreaterThan(FRAME_POOL_CAP);
    const again = walk.frames.left[0];
    expect(again).not.toBe(first);
    expect([again.width, again.height]).toEqual([first.width, first.height]);
    expect(walk.frames.left[0]).toBe(again);
  });
});
