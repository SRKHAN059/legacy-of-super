import { Painter, type Bitmap } from '../engine/gfx';
import type { Rect } from '../engine/math';
import { PAL, shade } from './color';

/** A static world object drawn y-sorted with entities. */
export interface PropArt {
  bmp: Bitmap;
  /** Solid footprint relative to the bitmap's top-left, or null for walk-through decor. */
  solid: Rect | null;
  /** When true the prop is drawn under everything (rugs, craters, flowers). */
  flat?: boolean;
}

export type PropKind =
  | 'tree' | 'pine' | 'palm' | 'deadTree' | 'alienTree' | 'bush' | 'rock' | 'boulder' | 'flowers' | 'sign'
  | 'fenceH' | 'fenceV' | 'domeHouse' | 'capsuleCorp' | 'kameHouse' | 'hut' | 'lamp' | 'crate' | 'barrel'
  | 'pillar' | 'brokenPillar' | 'rubble' | 'crater' | 'statue' | 'tower' | 'building' | 'ruinedBuilding'
  | 'car' | 'spaceship' | 'pod' | 'timeMachine' | 'bed' | 'table' | 'chair' | 'bookshelf' | 'tv' | 'plant'
  | 'counter' | 'stairs' | 'caveEntrance' | 'pyramid' | 'throne' | 'floatingRock' | 'savePoint' | 'chest'
  | 'cactus' | 'tent' | 'campfire' | 'well' | 'mailbox' | 'grave' | 'portal' | 'lookout' | 'rug' | 'fountain'
  | 'shrine' | 'stoneArch' | 'smallRock' | 'grassTuft' | 'jar';

function outlined(p: Painter): Bitmap {
  p.outline(PAL.outline);
  return p.done();
}

function treeCanopy(p: Painter, cx: number, cy: number, r: number, base: string): void {
  const dark = shade(base, 0.72);
  const light = shade(base, 1.25);
  p.ellipse(cx - r, cy - r, r * 2, r * 2, dark);
  p.ellipse(cx - r + 1, cy - r, r * 2 - 3, r * 2 - 3, base);
  p.ellipse(cx - r + 3, cy - r + 2, r - 1, r - 2, light);
  // Leaf clusters.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * (r - 4));
    const y = Math.round(cy + Math.sin(a) * (r - 4));
    p.px(x, y, dark);
    p.px(x + 1, y, dark);
  }
}

const cache = new Map<string, PropArt>();
const custom = new Map<string, () => PropArt>();

/**
 * Register a custom prop (chapter-specific landmarks). The factory draws with `Painter` and
 * returns the bitmap plus its solid footprint. Ids must not clash with built-in kinds.
 */
export function registerProp(kind: string, factory: () => PropArt): void {
  if (custom.has(kind)) throw new Error(`Duplicate prop kind "${kind}"`);
  custom.set(kind, factory);
}

/** Get (and lazily generate) the art for a prop kind. */
export function propArt(kind: PropKind | string): PropArt {
  const hit = cache.get(kind);
  if (hit) return hit;
  const f = custom.get(kind);
  const art = f ? f() : make(kind as PropKind);
  if (!art) throw new Error(`Unknown prop kind "${kind}"`);
  cache.set(kind, art);
  return art;
}

/** Helper for custom props: outline and finish a painter. */
export function finishProp(p: Painter): Bitmap {
  return outlined(p);
}

function make(kind: PropKind): PropArt {
  switch (kind) {
    case 'tree': {
      const p = new Painter(32, 40);
      p.rect(13, 24, 6, 14, '#805030');
      p.vline(13, 24, 14, '#603820');
      p.rect(11, 36, 10, 2, '#603820');
      treeCanopy(p, 16, 14, 13, '#409838');
      return { bmp: outlined(p), solid: { x: 10, y: 32, w: 12, h: 6 } };
    }
    case 'pine': {
      const p = new Painter(24, 40);
      p.rect(10, 30, 4, 8, '#704828');
      for (let i = 0; i < 4; i++) {
        const w = 8 + i * 4;
        const y = 2 + i * 7;
        for (let j = 0; j < 9; j++) {
          const ww = Math.round((w * j) / 9);
          p.hline(12 - (ww >> 1), y + j, ww, j < 3 ? '#38884c' : '#2a7040');
        }
      }
      return { bmp: outlined(p), solid: { x: 8, y: 30, w: 8, h: 8 } };
    }
    case 'palm': {
      const p = new Painter(32, 44);
      for (let i = 0; i < 28; i++) p.rect(15 + Math.round(Math.sin(i / 8) * 2), 14 + i, 3, 1, i % 3 ? '#a07848' : '#806038');
      const fronds: Array<[number, number]> = [[-12, 2], [12, 2], [-9, -6], [9, -6], [0, -9], [-13, 8], [13, 8]];
      for (const [dx, dy] of fronds) p.line(16, 12, 16 + dx, 12 + dy, '#3c9838');
      for (const [dx, dy] of fronds) p.line(16, 13, 16 + dx, 13 + dy, '#2c7830');
      p.rect(14, 11, 5, 4, '#704820');
      return { bmp: outlined(p), solid: { x: 13, y: 38, w: 7, h: 5 } };
    }
    case 'deadTree': {
      const p = new Painter(28, 36);
      p.rect(12, 10, 4, 24, '#6c5040');
      p.line(13, 16, 5, 6, '#6c5040'); p.line(14, 14, 22, 4, '#6c5040'); p.line(13, 22, 6, 18, '#6c5040');
      p.line(14, 20, 21, 15, '#6c5040'); p.line(5, 6, 3, 2, '#6c5040'); p.line(22, 4, 25, 2, '#6c5040');
      return { bmp: outlined(p), solid: { x: 10, y: 28, w: 8, h: 6 } };
    }
    case 'alienTree': {
      const p = new Painter(32, 44);
      p.rect(14, 18, 4, 24, '#c8a8e0');
      p.vline(14, 18, 24, '#a080c0');
      p.ellipse(2, 2, 28, 18, '#e870a8');
      p.ellipse(4, 3, 24, 12, '#f898c8');
      p.ellipse(9, 4, 10, 6, '#ffd0e8');
      for (let i = 0; i < 5; i++) p.px(6 + i * 5, 17, '#c05088');
      return { bmp: outlined(p), solid: { x: 12, y: 36, w: 8, h: 6 } };
    }
    case 'bush': {
      const p = new Painter(20, 16);
      p.ellipse(1, 3, 18, 13, '#307830');
      p.ellipse(2, 2, 15, 11, '#48a040');
      p.ellipse(4, 3, 7, 5, '#68c058');
      return { bmp: outlined(p), solid: { x: 2, y: 6, w: 16, h: 9 } };
    }
    case 'rock': {
      const p = new Painter(18, 14);
      p.ellipse(1, 2, 16, 12, '#787070');
      p.ellipse(2, 1, 13, 10, '#989090');
      p.ellipse(4, 2, 6, 4, '#b8b0b0');
      return { bmp: outlined(p), solid: { x: 2, y: 5, w: 14, h: 8 } };
    }
    case 'smallRock': {
      const p = new Painter(10, 8);
      p.ellipse(1, 1, 8, 7, '#888080');
      p.ellipse(2, 1, 4, 3, '#a8a0a0');
      return { bmp: outlined(p), solid: null };
    }
    case 'boulder': {
      const p = new Painter(36, 30);
      p.ellipse(1, 4, 34, 26, '#706860');
      p.ellipse(2, 2, 30, 24, '#908880');
      p.ellipse(6, 4, 14, 10, '#b0a8a0');
      p.line(18, 10, 24, 20, '#706860');
      return { bmp: outlined(p), solid: { x: 3, y: 12, w: 30, h: 16 } };
    }
    case 'flowers': {
      const p = new Painter(16, 16);
      const cols = ['#f8f8f8', '#f8d030', '#f06080', '#a070f0'];
      for (let i = 0; i < 6; i++) {
        const x = (i * 5 + 2) % 14;
        const y = (i * 7 + 3) % 13;
        p.px(x, y + 1, '#309030');
        p.px(x, y, cols[i % cols.length]);
        p.px(x - 1, y, shade(cols[i % cols.length], 0.85));
        p.px(x + 1, y, shade(cols[i % cols.length], 0.85));
      }
      return { bmp: p.done(), solid: null, flat: true };
    }
    case 'grassTuft': {
      const p = new Painter(16, 12);
      for (let i = 0; i < 7; i++) p.vline(2 + i * 2, 4 + (i % 3), 8 - (i % 3), i % 2 ? '#3c8830' : '#58a848');
      return { bmp: p.done(), solid: null };
    }
    case 'sign': {
      const p = new Painter(16, 18);
      p.rect(7, 9, 2, 8, '#704820');
      p.rect(1, 2, 14, 8, '#c09058');
      p.hline(1, 2, 14, '#d8b078');
      p.hline(3, 5, 9, '#805830'); p.hline(3, 7, 7, '#805830');
      return { bmp: outlined(p), solid: { x: 5, y: 12, w: 6, h: 5 } };
    }
    case 'fenceH': {
      const p = new Painter(16, 14);
      p.rect(0, 4, 16, 2, '#c09058'); p.rect(0, 9, 16, 2, '#c09058');
      p.rect(1, 1, 3, 12, '#a07040'); p.rect(12, 1, 3, 12, '#a07040');
      return { bmp: outlined(p), solid: { x: 0, y: 8, w: 16, h: 6 } };
    }
    case 'fenceV': {
      const p = new Painter(8, 20);
      p.rect(2, 0, 3, 19, '#a07040');
      p.rect(1, 2, 5, 2, '#c09058'); p.rect(1, 12, 5, 2, '#c09058');
      return { bmp: outlined(p), solid: { x: 1, y: 2, w: 6, h: 17 } };
    }
    case 'domeHouse': {
      const p = new Painter(56, 48);
      p.ellipse(2, 4, 52, 42, '#e8e8e0');
      p.ellipse(6, 6, 30, 20, '#f8f8f0');
      p.rect(2, 26, 52, 18, '#e8e8e0');
      p.hline(2, 30, 52, '#c8c8c0');
      p.rect(22, 30, 12, 15, '#4870a8');
      p.rect(23, 31, 10, 13, '#5888c0');
      p.rect(8, 22, 8, 6, '#88b8e8'); p.rect(40, 22, 8, 6, '#88b8e8');
      p.rect(8, 22, 8, 1, '#c8e0f8'); p.rect(40, 22, 8, 1, '#c8e0f8');
      return { bmp: outlined(p), solid: { x: 2, y: 20, w: 52, h: 26 } };
    }
    case 'capsuleCorp': {
      const p = new Painter(112, 88);
      p.ellipse(4, 2, 104, 70, '#f0f0e8');
      p.ellipse(10, 4, 60, 30, '#fcfcf8');
      p.rect(4, 40, 104, 44, '#f0f0e8');
      p.hline(4, 50, 104, '#d0d0c8');
      p.rect(46, 58, 20, 26, '#3868b0');
      p.rect(48, 60, 16, 24, '#4878c0');
      p.rect(36, 30, 40, 12, '#f8f8f0');
      // "CC" logo panel.
      p.rect(40, 32, 32, 8, '#3868b0');
      p.rect(44, 33, 4, 6, '#f8f8f0'); p.rect(45, 34, 3, 4, '#3868b0');
      p.rect(52, 33, 4, 6, '#f8f8f0'); p.rect(53, 34, 3, 4, '#3868b0');
      p.rect(60, 34, 8, 1, '#f8f8f0'); p.rect(60, 37, 8, 1, '#f8f8f0');
      for (let i = 0; i < 4; i++) { p.rect(10 + i * 9, 54, 6, 8, '#88b8e8'); p.rect(72 + i * 9, 54, 6, 8, '#88b8e8'); }
      return { bmp: outlined(p), solid: { x: 4, y: 44, w: 104, h: 42 } };
    }
    case 'kameHouse': {
      const p = new Painter(56, 52);
      p.rect(6, 24, 44, 26, '#f088a0');
      p.rect(6, 24, 44, 2, '#f8a8b8');
      for (let i = 0; i < 12; i++) p.hline(2 + i, 4 + i * 2 - 2, 52 - i * 2, i % 2 ? '#38a848' : '#48b858');
      p.rect(0, 22, 56, 4, '#2c8838');
      p.rect(22, 34, 12, 16, '#805030');
      p.rect(10, 30, 8, 8, '#88c8f0'); p.rect(38, 30, 8, 8, '#88c8f0');
      p.rect(19, 10, 18, 6, '#f8f0e0');
      p.rect(21, 11, 2, 4, '#c03028'); p.rect(25, 11, 2, 4, '#c03028'); p.rect(29, 11, 2, 4, '#c03028'); p.rect(33, 11, 2, 4, '#c03028');
      return { bmp: outlined(p), solid: { x: 4, y: 24, w: 48, h: 26 } };
    }
    case 'hut': {
      const p = new Painter(40, 40);
      p.rect(4, 18, 32, 20, '#d8c098');
      for (let i = 0; i < 10; i++) p.hline(2 + i * 2 - 2, 2 + i * 2, 40 - i * 4 + 4, i % 2 ? '#a07040' : '#b88050');
      for (let i = 0; i < 10; i++) p.hline(Math.max(0, 18 - i * 2), 2 + i, Math.min(40, 4 + i * 4), i % 2 ? '#a07040' : '#b88050');
      p.rect(0, 16, 40, 4, '#906030');
      p.rect(16, 26, 8, 12, '#704020');
      p.rect(7, 24, 6, 6, '#88b8e8'); p.rect(27, 24, 6, 6, '#88b8e8');
      return { bmp: outlined(p), solid: { x: 2, y: 18, w: 36, h: 20 } };
    }
    case 'lamp': {
      const p = new Painter(10, 30);
      p.rect(4, 6, 2, 22, '#505868');
      p.rect(1, 1, 8, 6, '#f8e8a0');
      p.rect(1, 1, 8, 1, '#606878');
      p.rect(2, 27, 6, 2, '#404858');
      return { bmp: outlined(p), solid: { x: 2, y: 24, w: 6, h: 5 } };
    }
    case 'crate': {
      const p = new Painter(16, 16);
      p.rect(0, 0, 16, 16, '#b08048');
      p.rect(0, 0, 16, 2, '#c89860');
      p.line(1, 2, 14, 14, '#906838'); p.line(14, 2, 1, 14, '#906838');
      p.rect(0, 7, 16, 2, '#906838');
      return { bmp: outlined(p), solid: { x: 0, y: 4, w: 16, h: 12 } };
    }
    case 'barrel': {
      const p = new Painter(14, 16);
      p.ellipse(0, 0, 14, 6, '#c09058');
      p.rect(0, 3, 14, 12, '#a07040');
      p.rect(0, 5, 14, 1, '#584030'); p.rect(0, 11, 14, 1, '#584030');
      p.ellipse(1, 0, 12, 5, '#806038');
      return { bmp: outlined(p), solid: { x: 0, y: 6, w: 14, h: 10 } };
    }
    case 'jar': {
      const p = new Painter(12, 14);
      p.ellipse(0, 3, 12, 11, '#c87848');
      p.rect(3, 0, 6, 4, '#c87848');
      p.rect(3, 0, 6, 1, '#e09868');
      p.ellipse(2, 5, 4, 4, '#e09868');
      return { bmp: outlined(p), solid: { x: 0, y: 6, w: 12, h: 8 } };
    }
    case 'pillar': {
      const p = new Painter(16, 40);
      p.rect(2, 4, 12, 32, '#e8e0d8');
      p.vline(4, 6, 28, '#c8c0b8'); p.vline(8, 6, 28, '#c8c0b8'); p.vline(12, 6, 28, '#c8c0b8');
      p.rect(0, 0, 16, 5, '#f8f0e8'); p.rect(0, 35, 16, 5, '#d8d0c8');
      return { bmp: outlined(p), solid: { x: 0, y: 30, w: 16, h: 10 } };
    }
    case 'brokenPillar': {
      const p = new Painter(16, 26);
      p.rect(2, 4, 12, 18, '#d8d0c8');
      p.line(2, 6, 7, 3, '#d8d0c8'); p.line(7, 3, 10, 8, '#d8d0c8'); p.line(10, 8, 13, 4, '#d8d0c8');
      p.vline(5, 8, 13, '#b8b0a8'); p.vline(10, 9, 12, '#b8b0a8');
      p.rect(0, 21, 16, 5, '#c8c0b8');
      return { bmp: outlined(p), solid: { x: 0, y: 16, w: 16, h: 10 } };
    }
    case 'rubble': {
      const p = new Painter(24, 14);
      p.ellipse(0, 5, 10, 8, '#787068'); p.ellipse(7, 2, 10, 10, '#908880'); p.ellipse(15, 6, 9, 7, '#686058');
      p.rect(9, 3, 4, 2, '#a8a098');
      return { bmp: outlined(p), solid: { x: 1, y: 6, w: 22, h: 7 } };
    }
    case 'crater': {
      const p = new Painter(40, 24);
      p.ellipse(0, 0, 40, 24, '#806040');
      p.ellipse(4, 3, 32, 18, '#5c4430');
      p.ellipse(8, 8, 24, 12, '#4c3424');
      return { bmp: p.done(), solid: null, flat: true };
    }
    case 'statue': {
      const p = new Painter(24, 40);
      p.rect(2, 30, 20, 9, '#a8a0a0');
      p.rect(8, 18, 8, 12, '#c0b8b8');
      p.ellipse(8, 9, 8, 9, '#c0b8b8');
      p.rect(5, 19, 3, 8, '#b0a8a8'); p.rect(16, 19, 3, 8, '#b0a8a8');
      p.rect(2, 30, 20, 1, '#c8c0c0');
      return { bmp: outlined(p), solid: { x: 2, y: 30, w: 20, h: 9 } };
    }
    case 'tower': {
      const p = new Painter(32, 64);
      p.rect(6, 10, 20, 52, '#c8c0b8');
      p.vline(6, 10, 52, '#a8a098');
      for (let i = 0; i < 5; i++) p.rect(12, 16 + i * 9, 8, 5, '#384868');
      p.rect(2, 2, 28, 10, '#d8d0c8');
      p.rect(2, 2, 28, 2, '#e8e0d8');
      return { bmp: outlined(p), solid: { x: 6, y: 46, w: 20, h: 16 } };
    }
    case 'building': {
      const p = new Painter(48, 64);
      p.rect(2, 0, 44, 62, '#8898b8');
      p.rect(2, 0, 44, 4, '#a8b8d8');
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) p.rect(6 + c * 10, 8 + r * 8, 6, 5, (r + c) % 3 ? '#c8e0f8' : '#f8f0b0');
      p.rect(18, 52, 12, 10, '#404858');
      return { bmp: outlined(p), solid: { x: 2, y: 30, w: 44, h: 32 } };
    }
    case 'ruinedBuilding': {
      const p = new Painter(48, 56);
      p.rect(2, 12, 44, 42, '#787880');
      for (let i = 0; i < 44; i++) p.vline(2 + i, 6 + Math.abs(((i * 7) % 13) - 6), 8, '#787880');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) p.rect(6 + c * 10, 16 + r * 9, 6, 5, '#282830');
      p.line(10, 14, 22, 40, '#585860'); p.line(36, 10, 30, 30, '#585860');
      p.rect(0, 50, 48, 6, '#686068');
      return { bmp: outlined(p), solid: { x: 2, y: 26, w: 44, h: 28 } };
    }
    case 'car': {
      const p = new Painter(32, 18);
      p.rect(1, 6, 30, 9, '#d84838');
      p.rect(7, 1, 16, 7, '#d84838');
      p.rect(9, 2, 5, 4, '#a8d8f8'); p.rect(16, 2, 5, 4, '#a8d8f8');
      p.ellipse(3, 12, 6, 6, '#282828'); p.ellipse(23, 12, 6, 6, '#282828');
      p.rect(1, 6, 30, 1, '#f06858');
      return { bmp: outlined(p), solid: { x: 1, y: 6, w: 30, h: 11 } };
    }
    case 'spaceship': {
      const p = new Painter(80, 56);
      p.ellipse(0, 10, 80, 44, '#c8c0d8');
      p.ellipse(4, 12, 72, 30, '#e0d8f0');
      p.ellipse(20, 2, 40, 22, '#d8d0e8');
      for (let i = 0; i < 6; i++) p.rect(8 + i * 12, 30, 6, 4, '#f8d040');
      p.rect(34, 40, 12, 14, '#706888');
      return { bmp: outlined(p), solid: { x: 4, y: 22, w: 72, h: 32 } };
    }
    case 'pod': {
      const p = new Painter(24, 24);
      p.ellipse(1, 1, 22, 22, '#e8e8f0');
      p.ellipse(5, 4, 14, 10, '#b02838');
      p.ellipse(7, 5, 6, 4, '#e04858');
      p.rect(4, 18, 16, 4, '#a8a8b8');
      return { bmp: outlined(p), solid: { x: 2, y: 10, w: 20, h: 13 } };
    }
    case 'timeMachine': {
      const p = new Painter(40, 32);
      p.ellipse(2, 4, 36, 20, '#e8e8e0');
      p.ellipse(8, 2, 24, 14, '#a8d8f0');
      p.ellipse(11, 3, 10, 6, '#d8f0f8');
      p.rect(4, 22, 3, 8, '#a8a8a0'); p.rect(33, 22, 3, 8, '#a8a8a0');
      p.rect(16, 18, 8, 4, '#f8d040');
      return { bmp: outlined(p), solid: { x: 4, y: 12, w: 32, h: 18 } };
    }
    case 'bed': {
      const p = new Painter(20, 32);
      p.rect(0, 0, 20, 32, '#a07040');
      p.rect(2, 2, 16, 28, '#f0f0f0');
      p.rect(3, 3, 14, 6, '#f8f8f8');
      p.rect(2, 11, 16, 19, '#5878c8');
      p.hline(2, 11, 16, '#7898e0');
      return { bmp: outlined(p), solid: { x: 0, y: 0, w: 20, h: 32 } };
    }
    case 'table': {
      const p = new Painter(32, 20);
      p.rect(0, 2, 32, 12, '#b07840');
      p.rect(0, 2, 32, 2, '#c89058');
      p.rect(2, 14, 3, 6, '#805028'); p.rect(27, 14, 3, 6, '#805028');
      return { bmp: outlined(p), solid: { x: 0, y: 4, w: 32, h: 14 } };
    }
    case 'chair': {
      const p = new Painter(12, 16);
      p.rect(1, 0, 10, 8, '#a06838'); p.rect(0, 8, 12, 4, '#b07840'); p.rect(1, 12, 2, 4, '#805028'); p.rect(9, 12, 2, 4, '#805028');
      return { bmp: outlined(p), solid: { x: 0, y: 6, w: 12, h: 10 } };
    }
    case 'bookshelf': {
      const p = new Painter(32, 32);
      p.rect(0, 0, 32, 32, '#805028');
      const books = ['#c03030', '#3050c0', '#30a040', '#e0c040', '#9040c0'];
      for (let s = 0; s < 3; s++) {
        p.rect(2, 3 + s * 10, 28, 7, '#583818');
        for (let b = 0; b < 9; b++) p.rect(3 + b * 3, 4 + s * 10, 2, 6, books[(b + s) % books.length]);
      }
      return { bmp: outlined(p), solid: { x: 0, y: 8, w: 32, h: 24 } };
    }
    case 'tv': {
      const p = new Painter(24, 20);
      p.rect(0, 0, 24, 16, '#383840'); p.rect(2, 2, 20, 12, '#5888c8'); p.rect(3, 3, 8, 3, '#88b8f0');
      p.rect(8, 16, 8, 4, '#585860');
      return { bmp: outlined(p), solid: { x: 0, y: 8, w: 24, h: 12 } };
    }
    case 'plant': {
      const p = new Painter(14, 22);
      p.rect(3, 14, 8, 8, '#c06838'); p.rect(2, 14, 10, 2, '#d88050');
      p.ellipse(0, 0, 14, 15, '#309030'); p.ellipse(3, 2, 6, 6, '#58b848');
      return { bmp: outlined(p), solid: { x: 2, y: 14, w: 10, h: 8 } };
    }
    case 'counter': {
      const p = new Painter(48, 20);
      p.rect(0, 0, 48, 20, '#c8a070'); p.rect(0, 0, 48, 4, '#e0c090'); p.hline(0, 12, 48, '#a88050');
      return { bmp: outlined(p), solid: { x: 0, y: 2, w: 48, h: 18 } };
    }
    case 'stairs': {
      const p = new Painter(16, 16);
      for (let i = 0; i < 4; i++) { p.rect(0, i * 4, 16, 4, shade('#b0a090', 1 - i * 0.08)); p.hline(0, i * 4, 16, '#d0c0b0'); }
      return { bmp: p.done(), solid: null, flat: true };
    }
    case 'caveEntrance': {
      const p = new Painter(40, 32);
      p.ellipse(0, 0, 40, 40, '#8c7050');
      p.ellipse(8, 8, 24, 30, '#181010');
      p.ellipse(10, 10, 20, 26, '#000000');
      return { bmp: outlined(p), solid: { x: 0, y: 0, w: 8, h: 32 } };
    }
    case 'pyramid': {
      const p = new Painter(128, 96);
      for (let i = 0; i < 48; i++) {
        const w = 8 + i * 2.5;
        p.hline(Math.round(64 - w / 2), 2 + i * 2, Math.round(w), i % 2 ? '#c0a040' : '#d8b850');
        p.hline(Math.round(64 - w / 2), 3 + i * 2, Math.round(w), i % 4 === 0 ? '#a88830' : '#d0b048');
      }
      p.rect(56, 76, 16, 20, '#382818');
      p.rect(58, 78, 12, 18, '#201008');
      return { bmp: outlined(p), solid: { x: 8, y: 50, w: 112, h: 44 } };
    }
    case 'throne': {
      const p = new Painter(32, 36);
      p.rect(4, 0, 24, 30, '#c8a0e0'); p.rect(8, 4, 16, 18, '#e8c8f8');
      p.rect(0, 16, 32, 6, '#c8a0e0'); p.rect(2, 30, 28, 6, '#a080c0');
      p.rect(14, 1, 4, 4, '#f8e060');
      return { bmp: outlined(p), solid: { x: 0, y: 14, w: 32, h: 22 } };
    }
    case 'floatingRock': {
      const p = new Painter(32, 24);
      p.ellipse(0, 0, 32, 12, '#58a048');
      for (let i = 0; i < 12; i++) p.hline(2 + i, 6 + i, 28 - i * 2, i % 2 ? '#8c7050' : '#7c6044');
      return { bmp: outlined(p), solid: { x: 2, y: 2, w: 28, h: 10 } };
    }
    case 'savePoint': {
      const p = new Painter(16, 24);
      p.rect(2, 18, 12, 5, '#585868');
      p.rect(3, 18, 10, 1, '#787888');
      p.ellipse(3, 4, 10, 12, '#f8d030');
      p.ellipse(5, 6, 6, 7, '#fff0a0');
      p.px(7, 8, '#e05020'); p.px(9, 10, '#e05020'); p.px(7, 11, '#e05020');
      return { bmp: outlined(p), solid: { x: 2, y: 16, w: 12, h: 7 } };
    }
    case 'chest': {
      const p = new Painter(16, 14);
      p.ellipse(0, 0, 16, 14, '#e8e8f0');
      p.ellipse(2, 1, 8, 5, '#ffffff');
      p.rect(0, 6, 16, 2, '#b02838');
      p.rect(6, 5, 4, 4, '#f8d040');
      return { bmp: outlined(p), solid: { x: 0, y: 4, w: 16, h: 10 } };
    }
    case 'cactus': {
      const p = new Painter(16, 28);
      p.rect(6, 2, 5, 25, '#50a048'); p.vline(7, 3, 22, '#70c060');
      p.rect(1, 9, 3, 8, '#50a048'); p.rect(1, 15, 6, 3, '#50a048');
      p.rect(13, 6, 3, 8, '#50a048'); p.rect(10, 12, 5, 3, '#50a048');
      return { bmp: outlined(p), solid: { x: 5, y: 20, w: 7, h: 7 } };
    }
    case 'tent': {
      const p = new Painter(36, 28);
      for (let i = 0; i < 24; i++) p.hline(18 - Math.round(i * 0.75), 2 + i, Math.round(i * 1.5) + 1, i % 3 ? '#d8a050' : '#c08840');
      p.line(18, 2, 18, 26, '#806030');
      p.rect(14, 18, 8, 8, '#583818');
      return { bmp: outlined(p), solid: { x: 2, y: 12, w: 32, h: 14 } };
    }
    case 'campfire': {
      const p = new Painter(16, 16);
      p.rect(2, 11, 12, 3, '#805030'); p.line(2, 14, 13, 10, '#704020');
      p.ellipse(4, 3, 8, 10, '#f08020'); p.ellipse(6, 6, 4, 6, '#f8e040');
      return { bmp: outlined(p), solid: { x: 2, y: 8, w: 12, h: 7 } };
    }
    case 'well': {
      const p = new Painter(24, 28);
      p.rect(2, 14, 20, 12, '#909098'); p.ellipse(2, 10, 20, 8, '#a8a8b0'); p.ellipse(5, 11, 14, 5, '#282838');
      p.rect(3, 0, 2, 14, '#704820'); p.rect(19, 0, 2, 14, '#704820'); p.rect(1, 0, 22, 3, '#b07038');
      return { bmp: outlined(p), solid: { x: 2, y: 12, w: 20, h: 14 } };
    }
    case 'mailbox': {
      const p = new Painter(10, 18);
      p.rect(4, 8, 2, 10, '#704820'); p.rect(0, 2, 10, 7, '#3868c8'); p.rect(0, 2, 10, 2, '#5888e0');
      return { bmp: outlined(p), solid: { x: 2, y: 12, w: 6, h: 6 } };
    }
    case 'grave': {
      const p = new Painter(14, 18);
      p.ellipse(1, 0, 12, 10, '#a0a0a8'); p.rect(1, 5, 12, 11, '#a0a0a8'); p.hline(4, 6, 6, '#808088'); p.vline(7, 3, 8, '#808088');
      return { bmp: outlined(p), solid: { x: 1, y: 8, w: 12, h: 8 } };
    }
    case 'portal': {
      const p = new Painter(24, 32);
      p.ellipse(0, 0, 24, 32, '#6030c0'); p.ellipse(3, 3, 18, 26, '#9060f0'); p.ellipse(7, 7, 10, 18, '#e0c8ff');
      return { bmp: p.done(), solid: null };
    }
    case 'lookout': {
      const p = new Painter(96, 48);
      p.ellipse(0, 8, 96, 40, '#d8d0c0');
      p.ellipse(4, 8, 88, 32, '#f0e8d8');
      p.rect(36, 0, 24, 20, '#f8f0e0'); p.ellipse(36, 0, 24, 8, '#f8f0e0');
      p.rect(44, 10, 8, 10, '#404858');
      return { bmp: outlined(p), solid: { x: 34, y: 4, w: 28, h: 16 } };
    }
    case 'rug': {
      const p = new Painter(32, 24);
      p.rect(0, 0, 32, 24, '#a03040'); p.rect(2, 2, 28, 20, '#c04858'); p.rect(6, 6, 20, 12, '#e0b048'); p.rect(8, 8, 16, 8, '#c04858');
      return { bmp: p.done(), solid: null, flat: true };
    }
    case 'fountain': {
      const p = new Painter(40, 32);
      p.ellipse(0, 10, 40, 22, '#a8a8b0'); p.ellipse(3, 12, 34, 16, '#5898e0'); p.ellipse(8, 14, 10, 6, '#98c8f8');
      p.rect(17, 2, 6, 18, '#b8b8c0'); p.ellipse(13, 0, 14, 6, '#c8c8d0'); p.vline(20, 0, 4, '#c8e8ff');
      return { bmp: outlined(p), solid: { x: 2, y: 12, w: 36, h: 18 } };
    }
    case 'shrine': {
      const p = new Painter(32, 32);
      p.rect(4, 12, 24, 18, '#d8c8b0'); p.rect(0, 6, 32, 8, '#a83030'); p.rect(2, 4, 28, 3, '#c84040');
      p.rect(12, 18, 8, 12, '#382818'); p.rect(14, 8, 4, 4, '#f8d040');
      return { bmp: outlined(p), solid: { x: 2, y: 14, w: 28, h: 16 } };
    }
    case 'stoneArch': {
      const p = new Painter(48, 40);
      p.rect(0, 8, 10, 32, '#a09890'); p.rect(38, 8, 10, 32, '#a09890'); p.rect(0, 0, 48, 10, '#b0a8a0');
      p.hline(0, 0, 48, '#c8c0b8'); p.vline(9, 10, 30, '#888078'); p.vline(47, 10, 30, '#888078');
      return { bmp: outlined(p), solid: null };
    }
  }
}
