import { PAL, shade } from '../art/color';
import type { Pose } from '../art/humanoid';
import type { Expression } from '../art/portrait';
import { propArt } from '../art/props';
import { portrait, spriteSet } from '../art/registry';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { wrap } from '../engine/fontdata';
import { font, makeBitmap, Painter, tint, type Bitmap } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Dir } from '../engine/math';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import { drawWindow } from './window';

/**
 * Boot sequence and attract loop (LoG2 §8.1: an animated opening plays before the title and again when the title
 * is left idle). Order: a fan-project splash and notice (boot only), then a short in-engine story opening that sets
 * up Dragon Ball Super (peace after Majin Buu, Beerus waking to look for the Super Saiyan God), then LoG2's hero
 * panels, then the title. A or Start skips straight to the title at any point. All art is drawn procedurally from
 * the game's own sprites and portraits; nothing here imitates a real company logo.
 */

/** A timed caption: narration, or a line with the speaker's NAME: header and portrait (the LoG2 dialogue box). */
interface Caption {
  /** Frame of the shot it appears on; it stays until the next caption or the end of the shot. */
  at: number;
  text: string;
  /** Speaker shown as "NAME:"; omitted for narration. */
  name?: string;
  /** Cast id whose portrait sits in the frame on the right. */
  who?: string;
  expr?: Expression;
}

/** One shot of the opening. */
interface Shot {
  id: string;
  frames: number;
  /** Track started when the shot begins (it keeps playing across shots until another one asks for a change). */
  music?: string;
  /** Colour the shot fades in from and out to; null cuts. */
  fadeIn?: string | null;
  fadeOut?: string | null;
  /** Story shots show the small "START: SKIP" hint; the splash keeps a clean screen. */
  hint?: boolean;
  captions?: Caption[];
  draw(ctx: CanvasRenderingContext2D, t: number): void;
}

/** Options for one run of the sequence. */
export interface IntroOptions {
  /** Show the fan-project splash and notice first (cold boot); the idle-title replay starts with the story. */
  splash: boolean;
}

const FADE = 16;
const TYPE_SPEED = 1.5;
/** Rows a caption box holds (the LoG2 dialogue box); every caption must fit in one box. */
export const CAPTION_ROWS = 3;
const BOX_H = 52;
const PANEL_W_PORTRAIT = 182;
const PORTRAIT_FRAME_W = 50;
const BLACK = '#000000';
const SKIP_HINT = 'START: SKIP';
const WHITE = '#ffffff';

// ------------------------------------------------------------------------------------------------ drawing helpers

/** Draw a bitmap at an integer scale (the main context has smoothing off, so pixels stay square). */
function blit(ctx: CanvasRenderingContext2D, bmp: Bitmap, x: number, y: number, scale = 1): void {
  ctx.drawImage(bmp, Math.round(x), Math.round(y), bmp.width * scale, bmp.height * scale);
}

/** One frame of a cast sprite. */
function frame(id: string, pose: Pose, dir: Dir): Bitmap {
  return spriteSet(id)[pose][dir];
}

/** Deterministic pseudo-random sequence so the opening looks the same every time it plays. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

const ease = (f: number): number => 1 - (1 - Math.max(0, Math.min(1, f))) ** 3;

/** Vertical gradient as dithered bands, the way GBA skies were drawn with a handful of palette entries. */
function bandedSky(p: Painter, y0: number, y1: number, cols: readonly string[]): void {
  const h = y1 - y0;
  for (let y = 0; y < h; y++) {
    const f = (y / h) * (cols.length - 1);
    const i = Math.floor(f);
    const frac = f - i;
    for (let x = 0; x < p.w; x++) {
      const th = [0.125, 0.625, 0.875, 0.375][(x & 1) + ((y & 1) << 1)];
      p.px(x, y0 + y, frac > th && i + 1 < cols.length ? cols[i + 1] : cols[i]);
    }
  }
}

/** Paozu-style rock spire: a tall pillar with lit / shaded edges, ledges and a crown of trees. */
function spire(p: Painter, x: number, top: number, w: number, bottom: number, rock: string, cap: string): void {
  for (let y = top; y < bottom; y++) {
    const inset = y - top < 3 ? 3 - (y - top) : 0;
    for (let i = inset; i < w - inset; i++) p.px(x + i, y, i < 2 ? shade(rock, 1.18) : i >= w - 3 ? shade(rock, 0.78) : rock);
  }
  for (let y = top + 9; y < bottom - 4; y += 9) p.hline(x + 2, y, w - 5, shade(rock, 0.84));
  p.ellipse(x - 2, top - 3, w + 4, 9, shade(cap, 0.8));
  p.ellipse(x, top - 4, w - 2, 6, cap);
  p.ellipse(x + 2, top - 4, Math.max(2, w - 8), 3, shade(cap, 1.25));
}

/** A soft cumulus cloud. */
function cloud(w: number, h: number): Bitmap {
  const p = new Painter(w, h);
  p.ellipse(0, h / 3, w * 0.45, (h * 2) / 3, '#d8e8f8');
  p.ellipse(w * 0.25, 0, w * 0.5, h, '#e8f0f8');
  p.ellipse(w * 0.55, h / 4, w * 0.45, (h * 3) / 4, '#d8e8f8');
  p.ellipse(w * 0.3, 1, w * 0.3, h * 0.5, '#ffffff');
  return p.done();
}

/** Text rendered at 2x with a dark outline (title-logo style), cached per string and colour. */
const bigTextCache = new Map<string, Bitmap>();
function bigText(text: string, color: string, edge = '#100818'): Bitmap {
  const key = `${text}|${color}|${edge}`;
  const hit = bigTextCache.get(key);
  if (hit) return hit;
  const w = font.drawWidth(text) + 2;
  const { bmp: ink, ctx: ictx } = makeBitmap(w, 10);
  font.draw(ictx, text, 1, 0, color);
  const { bmp: dark, ctx: dctx } = makeBitmap(w, 10);
  font.draw(dctx, text, 1, 0, edge);
  const { bmp, ctx } = makeBitmap(w * 2 + 4, 24);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2]]) ctx.drawImage(dark, 0, 0, w, 10, 2 + dx, 2 + dy, w * 2, 20);
  ctx.drawImage(ink, 0, 0, w, 10, 2, 2, w * 2, 20);
  bigTextCache.set(key, bmp);
  return bmp;
}

/** Lazily built bitmap, so nothing is painted until the opening actually plays. */
function lazy(build: () => Bitmap): () => Bitmap {
  let b: Bitmap | null = null;
  return () => (b ??= build());
}

// ------------------------------------------------------------------------------------------------ backdrops

const splashEmblem = lazy(() => {
  // An original mark: a ki orb with a four-point star, ringed by a broken halo.
  const p = new Painter(48, 48);
  p.ellipse(4, 4, 40, 40, '#f8f0c0');
  p.ellipse(6, 6, 36, 36, '#202838');
  p.ellipse(10, 10, 28, 28, '#c85818');
  p.ellipse(11, 11, 25, 25, '#f08820');
  p.ellipse(13, 12, 18, 18, '#f8b030');
  p.ellipse(15, 14, 9, 7, '#fff0b0');
  for (let i = -8; i <= 8; i++) {
    const r = 8 - Math.abs(i);
    p.px(24 + i, 24, '#fffff0');
    p.px(24, 24 + i, '#fffff0');
    if (r > 5) { p.px(24 + i, 23, '#fff8d0'); p.px(23, 24 + i, '#fff8d0'); }
  }
  for (let a = 0; a < 360; a += 3) {
    if (a % 90 < 12) continue;
    const r = (a * Math.PI) / 180;
    p.px(24 + Math.round(Math.cos(r) * 21), 24 + Math.round(Math.sin(r) * 21), '#f8d030');
  }
  return p.done();
});

const earthBackdrop = lazy(() => {
  const p = new Painter(SCREEN_W, SCREEN_H);
  bandedSky(p, 0, 100, ['#4890e8', '#58a0f0', '#70b4f8', '#90c8f8', '#b0dcf8', '#d0ecf8']);
  p.ellipse(182, 10, 22, 22, '#fff4c0');
  p.ellipse(186, 14, 14, 14, '#ffffff');
  for (const [x, w, h] of [[2, 14, 44], [24, 10, 56], [62, 16, 38], [146, 12, 50], [168, 18, 60], [212, 14, 42]]) {
    spire(p, x, 96 - h, w, 98, '#8ca8c0', '#a8c8d0');
  }
  bandedSky(p, 84, 100, ['#78a888', '#689870']);
  for (const [x, w, h] of [[-6, 22, 72], [40, 16, 58], [196, 24, 80]]) spire(p, x, 100 - h, w, 102, '#5c7464', '#4c9c44');
  // Rolling hills.
  for (let x = 0; x < SCREEN_W; x++) {
    const top = 96 + Math.round(Math.sin(x / 23) * 3 + Math.sin(x / 9) * 1);
    for (let y = top; y < 106; y++) p.px(x, y, y === top ? '#70c858' : y < top + 3 ? '#58b048' : '#4c9c44');
  }
  // The radish field: furrows of dark soil and rows of leafy tops.
  p.rect(0, 106, SCREEN_W, SCREEN_H - 106, '#a07444');
  p.speckle(0, 106, SCREEN_W, SCREEN_H - 106, ['#8c6038', '#b48450'], 0.2, 7);
  for (let y = 112; y < SCREEN_H; y += 9) {
    p.hline(0, y + 4, SCREEN_W, '#7c5430');
    for (let x = 4 + ((y / 9) % 2) * 4; x < SCREEN_W; x += 9) {
      p.px(x, y, '#58b048'); p.px(x + 2, y, '#58b048'); p.px(x + 1, y + 1, '#409030');
      p.px(x, y - 1, '#70c858'); p.px(x + 2, y - 1, '#70c858'); p.px(x + 1, y + 2, '#f0f0e8');
    }
  }
  const house = propArt('domeHouse').bmp;
  const { bmp, ctx } = makeBitmap(SCREEN_W, SCREEN_H);
  ctx.drawImage(p.done(), 0, 0);
  ctx.drawImage(house, 178, 108 - house.height);
  return bmp;
});

const clouds = lazy(() => cloud(34, 12));
const smallCloud = lazy(() => cloud(22, 8));

/** Panel backdrops for the "where everyone is now" shot: 36x46 pixel scenes drawn at 2x. */
const studyRoom = lazy(() => {
  const p = new Painter(36, 46);
  p.rect(0, 0, 36, 46, '#c8b48c');
  p.rect(0, 36, 36, 10, '#7c5c40');
  p.hline(0, 36, 36, '#5c4430');
  p.rect(3, 5, 10, 9, '#3c5c88');
  p.rect(4, 6, 8, 7, '#90c0f0');
  p.vline(8, 6, 7, '#3c5c88');
  p.rect(25, 3, 10, 30, '#6c4828');
  for (let s = 0; s < 4; s++) {
    p.hline(25, 3 + s * 7 + 6, 10, '#4c3018');
    for (let b = 0; b < 4; b++) p.rect(26 + b * 2, 4 + s * 7, 1, 5, ['#c03030', '#3070c0', '#e0c040', '#40a050'][(b + s) % 4]);
  }
  return p.done();
});

const studyDesk = lazy(() => {
  const p = new Painter(36, 46);
  p.rect(14, 30, 20, 3, '#8c6038');
  p.hline(14, 30, 20, '#b08050');
  p.rect(15, 33, 2, 9, '#6c4828');
  p.rect(31, 33, 2, 9, '#6c4828');
  p.rect(20, 27, 7, 3, '#f0f0e8');
  p.rect(21, 26, 6, 1, '#d8d8d0');
  p.rect(29, 27, 3, 3, '#e0e0e8');
  return p.done();
});

const gravityRoom = lazy(() => {
  const p = new Painter(36, 46);
  bandedSky(p, 0, 34, ['#401018', '#601820', '#802830', '#a03838']);
  p.rect(14, 4, 8, 22, '#686878');
  p.rect(15, 5, 6, 3, '#f04040');
  p.rect(16, 12, 4, 10, '#484858');
  p.rect(0, 34, 36, 12, '#585868');
  for (let x = 0; x < 36; x += 6) p.vline(x, 34, 12, '#484858');
  p.hline(0, 40, 36, '#484858');
  return p.done();
});

const stageNight = lazy(() => {
  const p = new Painter(36, 46);
  bandedSky(p, 0, 34, ['#101038', '#202050', '#303068']);
  for (let y = 0; y < 34; y++) {
    for (let x = 0; x < 36; x++) {
      const inBeam = Math.abs(x - (4 + y * 0.45)) < y * 0.18 + 1 || Math.abs(x - (32 - y * 0.45)) < y * 0.18 + 1;
      if (inBeam && (x + y) % 2 === 0) p.px(x, y, '#f8e8a0');
    }
  }
  p.rect(0, 34, 36, 12, '#c03838');
  p.hline(0, 34, 36, '#f05050');
  p.rect(0, 38, 36, 1, '#e0c040');
  return p.done();
});

/**
 * The far side of the universe: Beerus's world (a lit sphere) and, floating over it, the upside-down pyramid of rock
 * that carries his stepped palace and the great tree.
 */
const beerusWorld = lazy(() => {
  const p = new Painter(100, 96);
  const cx = 50;
  const cy = 65;
  const r = 28;
  const rnd = seeded(23);
  const land = Array.from({ length: 8 }, () => ({ x: cx + (rnd() - 0.5) * 48, y: cy + (rnd() - 0.5) * 48, r: 5 + rnd() * 9 }));
  const LAND = ['#1c3428', '#2c5440', '#3c7450', '#5c9868', '#88c088'];
  const SEA = ['#1c1834', '#2c2858', '#40407c', '#5c60a4', '#8488c8'];
  for (let y = cy - r - 3; y <= cy + r + 3; y++) {
    for (let x = cx - r - 3; x <= cx + r + 3; x++) {
      const dx = (x - cx) / r;
      const dy = (y - cy) / r;
      const d2 = dx * dx + dy * dy;
      const th = [0.125, 0.625, 0.875, 0.375][(x & 1) + ((y & 1) << 1)];
      if (d2 > 1) {
        // Thin violet atmosphere, brighter on the lit side.
        if (d2 < 1.1 && (dx + dy < 0.2 || th > 0.5)) p.px(x, y, dx + dy < 0 ? '#b090f0' : '#6048a0');
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      const light = Math.max(0, -0.5 * dx - 0.55 * dy + 0.67 * nz);
      const ramp = land.some((b) => Math.hypot(x - b.x, y - b.y) < b.r) ? LAND : SEA;
      p.px(x, y, ramp[Math.max(0, Math.min(4, Math.floor(light * 4.2 + th - 0.3)))]);
    }
  }
  // The floating island: an upside-down pyramid of rock, lit on the left face, with strata lines.
  for (let i = 0; i < 11; i++) {
    const half = 28 - i * 2.5;
    for (let x = Math.round(50 - half); x < Math.round(50 + half); x++) {
      const lit = x < 50;
      p.px(x, 22 + i, i % 4 === 3 ? (lit ? '#6c5040' : '#4c3428') : lit ? '#907054' : '#644838');
    }
  }
  p.ellipse(22, 18, 56, 6, '#58a050');
  p.hline(30, 19, 40, '#78c068');
  // Stepped palace.
  [[34, 30], [38, 24], [42, 18], [46, 12]].forEach(([x, w], i) => {
    const y = 20 - (i + 1) * 4;
    p.rect(x, y, w, 4, '#d8c088');
    p.rect(x + w - 3, y, 3, 4, '#a89060');
    p.hline(x, y, w, '#f0e0b0');
  });
  p.rect(50, 0, 4, 4, '#e0c040');
  p.px(51, 0, '#fff8c0');
  // The great tree beside it: a thick trunk with flared roots under a broad crown.
  p.rect(22, 5, 6, 16, '#6a4a30');
  p.vline(22, 5, 16, '#86603c');
  p.vline(27, 5, 16, '#4c3420');
  p.rect(20, 19, 10, 2, '#5a3c24');
  p.ellipse(6, 0, 36, 10, '#2e6e40');
  p.ellipse(9, 0, 30, 7, '#3a8a50');
  p.ellipse(12, 1, 18, 3, '#58b070');
  return p.done();
});

/** Nebula smear behind the stars. */
const nebula = lazy(() => {
  const p = new Painter(SCREEN_W, SCREEN_H);
  const rnd = seeded(91);
  for (let i = 0; i < 1400; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() ** 0.6 * 70;
    const x = 80 + Math.cos(a) * r * 1.6;
    const y = 70 + Math.sin(a) * r * 0.6 + (x - 80) * 0.25;
    p.px(x, y, rnd() < 0.5 ? '#281850' : '#3a2068');
  }
  return p.done();
});

/**
 * Beerus's chamber: dark stone, two pillars, a starry arch and the god's sleeping cushion (120x80, drawn at 2x).
 * The floor line sits high so the cushion and both figures stay above the caption box.
 */
const chamber = lazy(() => {
  const p = new Painter(120, 80);
  p.rect(0, 0, 120, 44, '#342c4c');
  for (let y = 4; y < 44; y += 6) {
    p.hline(0, y, 120, '#28203c');
    for (let x = (y / 6) % 2 ? 0 : 6; x < 120; x += 12) p.vline(x, y, 6, '#28203c');
  }
  p.ellipse(46, 2, 28, 30, '#1c1838');
  p.rect(46, 17, 28, 27, '#1c1838');
  const rnd = seeded(5);
  for (let i = 0; i < 20; i++) p.px(48 + rnd() * 24, 4 + rnd() * 38, rnd() < 0.3 ? '#ffffff' : '#9090c0');
  p.rect(0, 44, 120, 36, '#4a4060');
  p.hline(0, 44, 120, '#5c5274');
  p.speckle(0, 45, 120, 35, ['#40385a', '#544a6c'], 0.15, 3);
  p.rect(30, 50, 60, 20, '#802838');
  p.hline(30, 50, 60, '#e0c040');
  for (const x of [6, 102]) {
    p.rect(x, 0, 12, 48, '#5a5070');
    p.vline(x, 0, 48, '#7a7090');
    p.vline(x + 11, 0, 48, '#3c3450');
    p.rect(x - 2, 44, 16, 4, '#6a6080');
  }
  p.ellipse(24, 40, 46, 13, '#a07838');
  p.ellipse(26, 40, 42, 10, '#c8a050');
  p.ellipse(32, 41, 24, 4, '#e0c070');
  return p.done();
});

/** Purple destruction glow behind Beerus's close-up. */
const hakaiGlow = lazy(() => {
  const p = new Painter(SCREEN_W, SCREEN_H);
  for (let y = 0; y < SCREEN_H; y++) {
    for (let x = 0; x < SCREEN_W; x++) {
      const d = Math.hypot((x - 70) / 1.3, y - 56);
      const th = [0.125, 0.625, 0.875, 0.375][(x & 1) + ((y & 1) << 1)];
      const f = 1 - d / 120;
      if (f > 0.66 + th * 0.2) p.px(x, y, '#5a2c90');
      else if (f > 0.4 + th * 0.2) p.px(x, y, '#341a5c');
      else if (f > 0.15 + th * 0.2) p.px(x, y, '#1c0e34');
    }
  }
  return p.done();
});

// ------------------------------------------------------------------------------------------------ the shots

/** The five heroes of the LoG2-style character panels. */
const HERO_PANELS: ReadonlyArray<{ sprite: string; face: string; name: string; color: string }> = [
  { sprite: 'gokuSSB', face: 'gokuSSB', name: 'SON GOKU', color: '#40a8f8' },
  { sprite: 'vegetaSSB', face: 'vegetaSSB', name: 'VEGETA', color: '#3878e8' },
  { sprite: 'gohan', face: 'gohan', name: 'SON GOHAN', color: '#f0a030' },
  { sprite: 'futureTrunks', face: 'futureTrunks', name: 'TRUNKS', color: '#9868e0' },
  { sprite: 'piccolo', face: 'piccolo', name: 'PICCOLO', color: '#48c048' },
];
const HERO_FRAMES = 72;

function splashShot(): Shot {
  return {
    id: 'splash', frames: 150, fadeIn: BLACK, fadeOut: BLACK,
    draw(ctx, t) {
      ctx.fillStyle = '#080810';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      const em = splashEmblem();
      blit(ctx, em, (SCREEN_W - em.width) / 2, 30);
      // Sparks orbiting the mark.
      for (let i = 0; i < 6; i++) {
        const a = t / 24 + (i * Math.PI) / 3;
        ctx.fillStyle = i % 2 ? '#f8d030' : '#fff8d0';
        ctx.fillRect(Math.round(SCREEN_W / 2 + Math.cos(a) * 30), Math.round(54 + Math.sin(a) * 30), 2, 2);
      }
      const reveal = Math.max(0, Math.floor((t - 12) / 2));
      const head = 'A FAN PROJECT';
      font.drawCentered(ctx, head.slice(0, reveal), SCREEN_W / 2, 92, PAL.gold, '#000');
      if (t > 40) font.drawCentered(ctx, 'Legacy of Super', SCREEN_W / 2, 106, PAL.white, '#000');
      if (t > 60) font.drawCentered(ctx, 'made with love for the Legacy games', SCREEN_W / 2, 124, '#8890b0', '#000');
    },
  };
}

function noticeShot(): Shot {
  const lines = [
    ...wrap('Legacy of Super is a free, non-commercial fan tribute. It is not affiliated with or endorsed by the owners of Dragon Ball.', 220),
    '',
    ...wrap('Dragon Ball Super (c) Bird Studio / Shueisha, Toei Animation.', 220),
    '',
    ...wrap('All art, music and code in this game are original.', 220),
  ];
  return {
    id: 'notice', frames: 170, fadeIn: BLACK, fadeOut: BLACK,
    draw(ctx) {
      ctx.fillStyle = '#080810';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      const y0 = Math.round((SCREEN_H - lines.length * 11) / 2);
      lines.forEach((l, i) => font.drawCentered(ctx, l, SCREEN_W / 2, y0 + i * 11, i === 0 ? PAL.white : '#c8d0f0', '#000'));
    },
  };
}

function peaceShot(): Shot {
  return {
    id: 'peace', frames: 380, music: 'peaceful', fadeIn: BLACK, fadeOut: BLACK, hint: true,
    captions: [
      { at: 24, text: 'The battle with Majin Buu was over. For the first time in years, the Earth was at peace.' },
      { at: 200, text: 'Even Goku, the hero who had saved it again and again, had settled down... as a radish farmer.' },
    ],
    draw(ctx, t) {
      blit(ctx, earthBackdrop(), 0, 0);
      const c = clouds();
      const sc = smallCloud();
      blit(ctx, c, ((t * 0.15 + 30) % (SCREEN_W + 40)) - 40, 18);
      blit(ctx, sc, ((t * 0.1 + 150) % (SCREEN_W + 30)) - 30, 34);
      // Two birds crossing.
      for (let i = 0; i < 2; i++) {
        const bx = Math.round(SCREEN_W - ((t * 0.6 + i * 26) % (SCREEN_W + 30)));
        const by = 40 + i * 6 + Math.round(Math.sin((t + i * 20) / 8));
        ctx.fillStyle = '#304060';
        const flap = Math.floor((t + i * 7) / 6) % 2;
        ctx.fillRect(bx - 2, by - flap, 2, 1);
        ctx.fillRect(bx + 1, by - flap, 2, 1);
        ctx.fillRect(bx, by, 1, 1);
      }
      // Goku walks along the rows, stops and pulls up a radish; Goten bounds after him.
      const gx = Math.min(96, -24 + t * 0.5);
      const walking = gx < 96;
      const step = Math.floor(t / 8) % 4;
      const walkPose: Pose = (['walk1', 'idle', 'walk2', 'idle'] as const)[step];
      const pulling = !walking && Math.floor((t - 240) / 20) % 3 === 1;
      blit(ctx, frame('goku', walking ? walkPose : pulling ? 'raise' : 'idle', walking ? 'right' : 'down'), gx, 76);
      const tx = Math.min(70, -60 + t * 0.55);
      const hop = tx < 70 ? Math.abs(Math.round(Math.sin(t / 5) * 3)) : 0;
      blit(ctx, frame('goten', tx < 70 ? walkPose : 'idle', 'right'), tx, 80 - hop);
      if (pulling) {
        ctx.fillStyle = '#f0f0e8';
        ctx.fillRect(Math.round(gx) + 18, 78, 3, 4);
        ctx.fillStyle = '#58b048';
        ctx.fillRect(Math.round(gx) + 17, 75, 5, 3);
      }
    },
  };
}

/** One framed 2x panel of the "where everyone is now" shot. */
function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, art: Bitmap): void {
  drawWindow(ctx, x - 3, y - 3, 78, 98, { fill: '#000000', alpha: 1 });
  blit(ctx, art, x, y, 2);
}

function friendsShot(): Shot {
  const { bmp, ctx: pctx } = makeBitmap(36, 46);
  const confetti = Array.from({ length: 16 }, (_, i) => {
    const r = seeded(200 + i);
    return { x: r() * 36, speed: 0.12 + r() * 0.2, phase: r() * 46, col: ['#f8d030', '#f05050', '#50a0f0', '#60e060'][i % 4] };
  });
  const compose = (bg: Bitmap, draw: () => void): void => {
    pctx.clearRect(0, 0, 36, 46);
    pctx.drawImage(bg, 0, 0);
    draw();
  };
  return {
    id: 'friends', frames: 380, fadeIn: BLACK, fadeOut: BLACK, hint: true,
    captions: [
      { at: 30, text: 'Gohan settled into life as a scholar. Vegeta trained harder than ever, sworn to surpass his rival...' },
      { at: 220, text: '...and Mr. Satan went on taking the credit for saving the world, just as he always had.' },
    ],
    draw(ctx, t) {
      ctx.fillStyle = '#181830';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      for (let y = 0; y < SCREEN_H; y += 4) {
        ctx.fillStyle = y % 8 ? '#1c1c38' : '#202040';
        ctx.fillRect(0, y, SCREEN_W, 2);
      }
      const slide = (delay: number) => Math.round((1 - ease((t - delay) / 24)) * 140);
      // Gohan at his desk.
      compose(studyRoom(), () => {
        const stretch = Math.floor(t / 70) % 4 === 3;
        pctx.drawImage(frame('gohanSuit', stretch ? 'raise' : 'idle', 'right'), 0, 9);
        pctx.drawImage(studyDesk(), 0, 0);
        if (t % 40 < 20) { pctx.fillStyle = '#ffffff'; pctx.fillRect(30, 24 - ((t / 6) % 3), 1, 1); }
      });
      drawPanel(ctx, 9, 10 + slide(0), bmp);
      // Vegeta in the gravity room.
      compose(gravityRoom(), () => {
        const pose: Pose = (['punch1', 'punch2', 'kick', 'idle'] as const)[Math.floor(t / 7) % 4];
        pctx.drawImage(frame('vegeta', pose, 'right'), 2, 10);
        if (t % 30 < 10) { pctx.fillStyle = '#a8d8f8'; pctx.fillRect(10, 12 + ((t % 30) >> 2), 1, 2); }
      });
      drawPanel(ctx, 87, 10 + slide(26), bmp);
      // Mr. Satan on stage.
      compose(stageNight(), () => {
        pctx.drawImage(frame('mrSatan', Math.floor(t / 24) % 2 ? 'raise' : 'idle', 'down'), 6, 6);
        for (const c of confetti) {
          pctx.fillStyle = c.col;
          pctx.fillRect(Math.round(c.x + Math.sin((t + c.phase) / 9) * 2), Math.round((c.phase + t * c.speed) % 40), 1, 1);
        }
        for (let i = 0; i < 6; i++) {
          const hx = 2 + i * 6;
          const hy = 41 - (Math.floor((t + i * 9) / 12) % 2);
          pctx.fillStyle = i % 2 ? '#e8b888' : '#c89060';
          pctx.fillRect(hx, hy, 4, 4);
          pctx.fillStyle = '#302020';
          pctx.fillRect(hx, hy, 4, 1);
        }
      });
      drawPanel(ctx, 165, 10 + slide(52), bmp);
    },
  };
}

function spaceShot(): Shot {
  const rnd = seeded(77);
  const stars = Array.from({ length: 90 }, () => ({ x: rnd() * SCREEN_W, y: rnd() * SCREEN_H, layer: Math.floor(rnd() * 3) }));
  return {
    id: 'space', frames: 320, music: 'beerusPlanet', fadeIn: BLACK, fadeOut: BLACK, hint: true,
    captions: [
      { at: 30, text: 'But far beyond the Earth, on a quiet world at the edge of Universe 7...' },
      { at: 170, text: '...a god who had slept for thirty-nine years was beginning to stir.' },
    ],
    draw(ctx, t) {
      ctx.fillStyle = '#04040c';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      blit(ctx, nebula(), -t * 0.05, 0);
      for (const s of stars) {
        const speed = [0.08, 0.2, 0.45][s.layer];
        const x = (((s.x - t * speed) % SCREEN_W) + SCREEN_W) % SCREEN_W;
        ctx.fillStyle = ['#505078', '#9090c0', '#ffffff'][s.layer];
        ctx.fillRect(Math.round(x), Math.round(s.y), 1, 1);
      }
      const w = beerusWorld();
      const px = SCREEN_W - ease(t / 220) * 180;
      blit(ctx, w, px, 6 + Math.round(Math.sin(t / 40) * 2));
      if (t > 200 && Math.floor(t / 6) % 2 === 0) {
        ctx.fillStyle = '#fff8c0';
        ctx.fillRect(Math.round(px) + 51, 6 + Math.round(Math.sin(t / 40) * 2), 2, 1);
      }
    },
  };
}

function wakeShot(): Shot {
  const WAKE = 170;
  const RISE = 330;
  const { bmp, ctx: sctx } = makeBitmap(120, 80);
  return {
    id: 'wake', frames: 560, fadeIn: BLACK, fadeOut: WHITE, hint: true,
    captions: [
      { at: 30, name: 'Whis', who: 'whis', expr: 'happy', text: 'Good morning, Lord Beerus. That was quite a nap: thirty-nine years, by my count.' },
      { at: WAKE + 10, name: 'Beerus', who: 'beerus', text: 'Whis... I had a dream. I fought a Super Saiyan God, and it was actually fun.' },
      { at: RISE, name: 'Beerus', who: 'beerus', expr: 'angry', text: 'Find him for me. And if this "god" turns out to be a bore...' },
      { at: RISE + 110, name: 'Beerus', who: 'beerus', expr: 'smirk', text: '...then I\'ll destroy his planet.' },
    ],
    draw(ctx, t) {
      sctx.clearRect(0, 0, 120, 80);
      sctx.drawImage(chamber(), 0, 0);
      const awake = t >= WAKE;
      const risen = t >= RISE;
      if (!awake) {
        sctx.drawImage(frame('beerus', 'ko', 'down'), 34, 26);
        for (let i = 0; i < 3; i++) {
          const k = (t + i * 26) % 78;
          font.draw(sctx, 'Z', 54 + Math.round(k / 10) + i, 28 - Math.round(k / 3), k < 60 ? '#c8c8f8' : '#6868a0');
        }
      } else {
        const pose: Pose = risen ? (Math.floor(t / 4) % 2 ? 'charge' : 'idle') : 'idle';
        sctx.drawImage(frame('beerus', pose, 'right'), 40, 13);
        if (risen) {
          const r = seeded(t);
          for (let i = 0; i < 8; i++) {
            sctx.fillStyle = i % 2 ? '#b070f0' : '#e0b0ff';
            sctx.fillRect(Math.round(42 + r() * 20), Math.round(16 + r() * 28), 1, 2);
          }
        }
      }
      sctx.drawImage(frame('whis', 'idle', 'left'), 76, 13);
      if (t >= WAKE && t < WAKE + 50) font.draw(sctx, '!', 87, 4 - Math.min(3, (t - WAKE) >> 1), '#f8d030', '#000');
      blit(ctx, bmp, 0, 0, 2);
      if (t >= WAKE && t < WAKE + 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      }
    },
  };
}

function destroyerShot(): Shot {
  const rnd = seeded(13);
  const sparks = Array.from({ length: 24 }, () => ({ a: rnd() * Math.PI * 2, r: 30 + rnd() * 40, v: 0.6 + rnd() }));
  return {
    id: 'destroyer', frames: 230, fadeIn: WHITE, fadeOut: WHITE, hint: true,
    captions: [{ at: 30, text: 'The God of Destruction was awake. And very soon, the Earth would learn what that meant.' }],
    draw(ctx, t) {
      ctx.fillStyle = '#06020e';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      blit(ctx, hakaiGlow(), 0, 0);
      for (const s of sparks) {
        const k = (s.r + t * s.v) % 70;
        ctx.fillStyle = k < 40 ? '#e0b0ff' : '#8050c0';
        ctx.fillRect(Math.round(70 + Math.cos(s.a) * (90 - k)), Math.round(56 + Math.sin(s.a) * (90 - k) * 0.7), 2, 2);
      }
      const face = portrait('beerus', t > 110 ? 'smirk' : 'neutral');
      if (face) blit(ctx, face, 22 + Math.round((1 - ease(t / 40)) * -60), -6, 3);
    },
  };
}

/** A flat-colour silhouette of a sprite frame, cached (the glow of a powered-up aura). */
const silhouettes = new Map<string, Bitmap>();
function silhouette(id: string, pose: Pose, dir: Dir, color: string): Bitmap {
  const key = `${id}|${pose}|${dir}|${color}`;
  let b = silhouettes.get(key);
  if (!b) {
    b = tint(frame(id, pose, dir), color);
    silhouettes.set(key, b);
  }
  return b;
}

function heroesShot(): Shot {
  const rnd = seeded(41);
  const lines = Array.from({ length: 26 }, () => ({ y: rnd() * 220 - 30, len: 20 + rnd() * 50, v: 5 + rnd() * 6, phase: rnd() * 400 }));
  const motes = Array.from({ length: 14 }, () => ({ x: rnd() * 44, phase: rnd() * 40, v: 0.8 + rnd() * 1.2 }));
  return {
    id: 'heroes', frames: HERO_FRAMES * HERO_PANELS.length, music: 'title', fadeIn: WHITE, fadeOut: WHITE,
    draw(ctx, t) {
      const i = Math.min(HERO_PANELS.length - 1, Math.floor(t / HERO_FRAMES));
      const h = HERO_PANELS[i];
      const k = t - i * HERO_FRAMES;
      ctx.fillStyle = shade(h.color, 0.22);
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      // Slanted art panel behind the hero, like LoG2's opening cards.
      ctx.fillStyle = shade(h.color, 0.32);
      ctx.beginPath();
      ctx.moveTo(0, 30); ctx.lineTo(SCREEN_W, 18); ctx.lineTo(SCREEN_W, 120); ctx.lineTo(0, 132);
      ctx.fill();
      // Diagonal speed lines in the hero's colour.
      ctx.fillStyle = shade(h.color, 0.55);
      for (const l of lines) {
        const x = SCREEN_W + 40 - ((l.phase + t * l.v) % (SCREEN_W + 120));
        for (let j = 0; j < l.len; j += 1) ctx.fillRect(Math.round(x + j), Math.round(l.y + j * 0.5), 1, 1);
      }
      const face = portrait(h.face, 'smirk');
      if (face) blit(ctx, face, -70 + ease(k / 12) * 92, 32, 2);
      // The hero powering up: a flickering silhouette glow, rising ki motes, then the sprite itself.
      const pose: Pose = k % 8 < 4 ? 'charge' : 'idle';
      const sx = Math.round(SCREEN_W + 10 - ease((k - 4) / 12) * 116);
      const sy = 38;
      const glow = silhouette(h.sprite, pose, 'down', shade(h.color, 1.35));
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(k / 2);
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [-2, -4], [2, -4], [0, -6]]) blit(ctx, glow, sx + dx, sy + dy, 2);
      ctx.restore();
      for (const m of motes) {
        const y = sy + 60 - ((m.phase + k * m.v) % 64);
        ctx.fillStyle = shade(h.color, 1.5);
        ctx.fillRect(sx + 2 + Math.round(m.x), Math.round(y), 1, 2);
      }
      blit(ctx, frame(h.sprite, pose, 'down'), sx, sy, 2);
      const name = bigText(h.name.slice(0, Math.max(0, Math.floor((k - 10) / 2))), PAL.white);
      blit(ctx, name, (SCREEN_W - bigText(h.name, PAL.white).width) / 2, 134);
      if (k < 5) {
        ctx.fillStyle = `rgba(255,255,255,${(1 - k / 5).toFixed(2)})`;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------ the scene

/** Width of a caption's text panel: narrower when a portrait frame sits beside it (as in DialogueScene). */
function captionPanelW(cap: Caption): number {
  return cap.who ? PANEL_W_PORTRAIT : SCREEN_W - 6;
}

/** The opening as a scene. It ends itself (or on A / Start) and hands over to the title screen. */
export class IntroScene implements Scene {
  private readonly shots: Shot[];
  private index = 0;
  private t = 0;
  private finished = false;

  constructor(private readonly game: Game, opts: IntroOptions) {
    this.shots = [
      ...(opts.splash ? [splashShot(), noticeShot()] : []),
      peaceShot(), friendsShot(), spaceShot(), wakeShot(), destroyerShot(), heroesShot(),
    ];
    this.startShot();
  }

  /** Id of the shot on screen ('splash', 'notice', 'peace', 'friends', 'space', 'wake', 'destroyer', 'heroes'). */
  get shotId(): string {
    return this.shots[this.index].id;
  }

  /** Total length in frames when nothing is skipped. */
  get length(): number {
    return this.shots.reduce((a, s) => a + s.frames, 0);
  }

  /** Every caption of this run and the number of rows it wraps to (each must fit in CAPTION_ROWS). */
  captionLayout(): Array<{ shot: string; text: string; rows: number }> {
    return this.shots.flatMap((s) => (s.captions ?? []).map((c) => ({ shot: s.id, text: c.text, rows: wrap(c.text, captionPanelW(c) - 16).length })));
  }

  /** True once the sequence has handed over. */
  get done(): boolean {
    return this.finished;
  }

  private startShot(): void {
    const m = this.shots[this.index].music;
    if (m) this.game.playMusic(m);
  }

  update(input: Input): void {
    if (this.finished) return;
    if (input.pressed('A') || input.pressed('start')) {
      this.finish(true);
      return;
    }
    this.t++;
    if (this.t < this.shots[this.index].frames) return;
    if (this.index === this.shots.length - 1) {
      this.finish(false);
      return;
    }
    this.index++;
    this.t = 0;
    this.startShot();
  }

  private finish(skipped: boolean): void {
    this.finished = true;
    this.game.input.swallow();
    // Hand over to the title, which flashes in from white. title.ts imports this module, so the title is reached
    // structurally rather than by importing it back.
    this.game.toTitle();
    const title = this.game.scenes.top as { flashIn?: (frames: number) => void } | undefined;
    title?.flashIn?.(skipped ? 8 : 30);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const shot = this.shots[this.index];
    const t = this.t;
    shot.draw(ctx, t);
    const cap = shot.captions?.filter((c) => c.at <= t).pop();
    if (cap) this.drawCaption(ctx, cap, t - cap.at);
    if (shot.hint && Math.floor(t / 40) % 2 === 0) this.drawHint(ctx);
    const fadeIn = shot.fadeIn === undefined ? BLACK : shot.fadeIn;
    const fadeOut = shot.fadeOut === undefined ? BLACK : shot.fadeOut;
    let a = 0;
    let col = BLACK;
    if (fadeIn && t < FADE) { a = 1 - t / FADE; col = fadeIn; }
    if (fadeOut && t > shot.frames - FADE) { a = Math.max(a, (t - (shot.frames - FADE)) / FADE); col = fadeOut; }
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.restore();
    }
  }

  /** The blinking skip hint, on a dark plate so it stays readable over panel frames and bright skies. */
  private drawHint(ctx: CanvasRenderingContext2D): void {
    const w = font.drawWidth(SKIP_HINT) + 6;
    ctx.fillStyle = 'rgba(0,0,16,0.7)';
    ctx.fillRect(SCREEN_W - w - 1, 1, w, 11);
    font.drawRight(ctx, SKIP_HINT, SCREEN_W - 4, 3, '#a0a8c8', '#000');
  }

  /** The LoG2 text box: scan-lined dark-blue panel, "NAME:" header, portrait frame on the right, typewriter text. */
  private drawCaption(ctx: CanvasRenderingContext2D, cap: Caption, age: number): void {
    const face = cap.who ? portrait(cap.who, cap.expr ?? 'neutral') : null;
    const panelW = captionPanelW(cap);
    const y = SCREEN_H - BOX_H - 3;
    drawWindow(ctx, 3, y, panelW, BOX_H, { fill: '#101c40', alpha: 0.95 });
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let yy = y + 3; yy < y + BOX_H - 2; yy += 2) ctx.fillRect(6, yy, panelW - 6, 1);
    if (face) {
      const fx = 3 + panelW + 3;
      drawWindow(ctx, fx, y, PORTRAIT_FRAME_W, BOX_H, { fill: '#283c78', alpha: 1 });
      ctx.drawImage(face, fx + Math.floor((PORTRAIT_FRAME_W - face.width) / 2), y + Math.floor((BOX_H - face.height) / 2));
    }
    let ty = y + 5;
    if (cap.name) {
      font.draw(ctx, `${cap.name.toUpperCase()}:`, 10, ty, PAL.gold, '#000');
      ty += 11;
    } else {
      ty += 5;
    }
    const rows = wrap(cap.text, panelW - 16).slice(0, CAPTION_ROWS);
    let left = age * TYPE_SPEED;
    rows.forEach((r, i) => {
      if (left <= 0) return;
      font.draw(ctx, r.slice(0, Math.floor(left)), 10, ty + i * 11, PAL.white, '#000');
      left -= r.length;
    });
  }
}
