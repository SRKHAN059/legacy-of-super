import { flipX, Painter, type Bitmap } from '../engine/gfx';
import type { Dir } from '../engine/math';
import { PAL, shade } from './color';
import { HAIR, type HairStyle } from './hair';

/** Animation poses every humanoid sprite set provides. */
export type Pose =
  | 'idle' | 'walk1' | 'walk2' | 'punch1' | 'punch2' | 'kick' | 'blast' | 'charge'
  | 'hurt' | 'ko' | 'raise' | 'fly' | 'guard';

export const POSES: readonly Pose[] = ['idle', 'walk1', 'walk2', 'punch1', 'punch2', 'kick', 'blast', 'charge', 'hurt', 'ko', 'raise', 'fly', 'guard'];

export type BodyType = 'male' | 'female' | 'child' | 'big';
export type TopStyle = 'gi' | 'shirt' | 'armor' | 'coat' | 'dress' | 'suit' | 'robe' | 'vest';

/** Full description of a humanoid's look. Shades are derived automatically. */
export interface HumanoidSpec {
  body: BodyType;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  /** Accent colour used by masks ('k'): turban band, inner ear, hair tie. */
  accent?: string;
  eye?: string;
  top: string;
  topStyle: TopStyle;
  /** Undershirt / bodysuit colour shown at the collar, sleeves and (for armor) limbs. */
  under?: string;
  sleeves: 'none' | 'short' | 'long';
  belt?: string;
  pants: string;
  boots: string;
  bootTrim?: string;
  wrist?: string;
  cape?: string;
  scarf?: string;
  tail?: string;
  ears?: 'normal' | 'pointed';
  earring?: string;
  scouter?: string;
  /** Third eye (Tien), beard (Roshi), mustache (Satan / Toppo), sunglasses. */
  face?: 'thirdEye' | 'beard' | 'mustache' | 'shades' | 'stern' | 'gentle';
  /** Ring/halo colour (angels wear a neck ring). */
  halo?: string;
  /** Emblem on chest (gi kanji / logo). */
  emblem?: string;
}

interface Layout {
  headY: number; torsoX: number; torsoW: number; torsoY: number; torsoH: number;
  armLX: number; armRX: number; beltY: number; hipY: number; hipH: number;
  legLX: number; legRX: number; legW: number; legY: number; legH: number; bootY: number; bootH: number; handY: number;
}

const LAYOUTS: Record<BodyType, Layout> = {
  male: { headY: 4, torsoX: 7, torsoW: 10, torsoY: 13, torsoH: 7, armLX: 5, armRX: 17, beltY: 20, hipY: 21, hipH: 2, legLX: 8, legRX: 13, legW: 3, legY: 23, legH: 4, bootY: 27, bootH: 4, handY: 21 },
  female: { headY: 4, torsoX: 8, torsoW: 8, torsoY: 13, torsoH: 7, armLX: 6, armRX: 16, beltY: 20, hipY: 21, hipH: 2, legLX: 9, legRX: 13, legW: 2, legY: 23, legH: 4, bootY: 27, bootH: 4, handY: 21 },
  child: { headY: 9, torsoX: 8, torsoW: 8, torsoY: 18, torsoH: 5, armLX: 6, armRX: 16, beltY: 23, hipY: 24, hipH: 1, legLX: 9, legRX: 13, legW: 2, legY: 25, legH: 2, bootY: 27, bootH: 4, handY: 23 },
  big: { headY: 4, torsoX: 6, torsoW: 12, torsoY: 13, torsoH: 7, armLX: 4, armRX: 18, beltY: 20, hipY: 21, hipH: 2, legLX: 7, legRX: 13, legW: 4, legY: 23, legH: 4, bootY: 27, bootH: 4, handY: 21 },
};

/** Frame dimensions for humanoid sprites. */
export const HUMANOID_W = 24;
export const HUMANOID_H = 32;

interface Colors {
  o: string; s: string; S: string; e: string; h: string; H: string; j: string; k: string;
  t: string; T: string; u: string; U: string; l: string; p: string; P: string; b: string; B: string; r: string; w: string;
}

function colors(spec: HumanoidSpec): Colors {
  const under = spec.under ?? shade(spec.top, 0.7);
  return {
    o: PAL.outline,
    s: spec.skin,
    S: shade(spec.skin, 0.78),
    e: spec.eye ?? '#181018',
    h: spec.hairColor,
    H: shade(spec.hairColor, 0.72),
    j: shade(spec.hairColor, 1.35),
    k: spec.accent ?? shade(spec.hairColor, 0.55),
    t: spec.top,
    T: shade(spec.top, 0.75),
    u: under,
    U: shade(under, 0.75),
    l: spec.belt ?? shade(spec.pants, 0.6),
    p: spec.pants,
    P: shade(spec.pants, 0.75),
    b: spec.boots,
    B: shade(spec.boots, 0.72),
    r: spec.bootTrim ?? shade(spec.boots, 0.72),
    w: spec.wrist ?? under,
  };
}

/** Per-pose limb configuration for front/back views. */
interface FrontPose {
  /** Vertical offset of the whole body (crouch / hop). */
  dy: number;
  /** Left/right leg lift in pixels (walking). */
  liftL: number; liftR: number;
  /** Extra spread of legs. */
  spread: number;
  armL: 'side' | 'down' | 'up' | 'bent' | 'cross' | 'forward' | 'swingF' | 'swingB';
  armR: 'side' | 'down' | 'up' | 'bent' | 'cross' | 'forward' | 'swingF' | 'swingB';
  kick: boolean;
  closedEyes: boolean;
}

const FRONT_POSES: Record<Exclude<Pose, 'ko'>, FrontPose> = {
  idle: { dy: 0, liftL: 0, liftR: 0, spread: 0, armL: 'side', armR: 'side', kick: false, closedEyes: false },
  walk1: { dy: 0, liftL: 1, liftR: 0, spread: 0, armL: 'swingB', armR: 'swingF', kick: false, closedEyes: false },
  walk2: { dy: 0, liftL: 0, liftR: 1, spread: 0, armL: 'swingF', armR: 'swingB', kick: false, closedEyes: false },
  punch1: { dy: 0, liftL: 0, liftR: 0, spread: 1, armL: 'bent', armR: 'forward', kick: false, closedEyes: false },
  punch2: { dy: 0, liftL: 0, liftR: 0, spread: 1, armL: 'forward', armR: 'bent', kick: false, closedEyes: false },
  kick: { dy: -1, liftL: 0, liftR: 0, spread: 0, armL: 'bent', armR: 'bent', kick: true, closedEyes: false },
  blast: { dy: 0, liftL: 0, liftR: 0, spread: 1, armL: 'forward', armR: 'forward', kick: false, closedEyes: false },
  charge: { dy: 1, liftL: 0, liftR: 0, spread: 1, armL: 'bent', armR: 'bent', kick: false, closedEyes: false },
  hurt: { dy: -1, liftL: 1, liftR: 1, spread: 0, armL: 'up', armR: 'up', kick: false, closedEyes: true },
  raise: { dy: 0, liftL: 0, liftR: 0, spread: 0, armL: 'side', armR: 'up', kick: false, closedEyes: false },
  fly: { dy: -2, liftL: 2, liftR: 2, spread: 0, armL: 'down', armR: 'down', kick: false, closedEyes: false },
  guard: { dy: 0, liftL: 0, liftR: 0, spread: 1, armL: 'cross', armR: 'cross', kick: false, closedEyes: false },
};

function stampMask(p: Painter, mask: readonly string[], ox: number, oy: number, c: Colors): void {
  p.rows(ox, oy, mask, { h: c.h, H: c.H, j: c.j, k: c.k, s: c.s });
}

/** Draw one arm in front/back view. `side` -1 = screen-left arm, +1 = screen-right. */
function frontArm(p: Painter, spec: HumanoidSpec, c: Colors, L: Layout, side: -1 | 1, mode: FrontPose['armL'], dy: number, back: boolean): void {
  const ax = side < 0 ? L.armLX : L.armRX;
  const top = L.torsoY + 1 + dy;
  const sleeveCol = spec.topStyle === 'armor' || spec.topStyle === 'suit' ? c.u : spec.sleeves === 'none' ? c.s : spec.topStyle === 'gi' || spec.topStyle === 'vest' ? c.u : c.t;
  const sleeveLen = spec.sleeves === 'long' ? 99 : spec.sleeves === 'short' ? 3 : 0;
  const armCol = (i: number) => (i < sleeveLen ? sleeveCol : c.s);
  const len = L.handY - (L.torsoY + 1);
  const wristAt = len - 2;
  const paint = (x: number, y: number, i: number) => {
    const col = spec.wrist && i >= wristAt && i < len ? c.w : armCol(i);
    p.px(x, y, col);
  };
  switch (mode) {
    case 'side':
    case 'swingF':
    case 'swingB': {
      const shift = mode === 'swingF' ? 1 : mode === 'swingB' ? -1 : 0;
      for (let i = 0; i < len + shift; i++) { paint(ax, top + i, i); paint(ax + 1, top + i, i); }
      p.rect(ax, top + len + shift, 2, 2, c.s);
      p.px(side < 0 ? ax : ax + 1, top + len + shift + 1, c.S);
      break;
    }
    case 'down': {
      for (let i = 0; i < len; i++) { paint(ax - side, top + i, i); paint(ax + 1 - side, top + i, i); }
      p.rect(ax - side, top + len, 2, 2, c.s);
      break;
    }
    case 'up': {
      // Upper arm out to the side, forearm raised beside the head.
      const ux = side < 0 ? ax - 1 : ax + 1;
      for (let i = 0; i < 3; i++) { p.px(ux, top + i - 1, armCol(i)); p.px(ux + 1, top + i - 1, armCol(i)); }
      for (let i = 0; i < 5; i++) { p.px(ux, top - 2 - i, armCol(3 + i)); p.px(ux + 1, top - 2 - i, armCol(3 + i)); }
      if (spec.wrist) { p.px(ux, top - 6, c.w); p.px(ux + 1, top - 6, c.w); }
      p.rect(ux, top - 9, 2, 2, c.s);
      break;
    }
    case 'bent': {
      // Elbow out, fist at the hip.
      const ex = side < 0 ? ax - 1 : ax + 1;
      for (let i = 0; i < 3; i++) { p.px(ex, top + i, armCol(i)); p.px(ex + 1, top + i, armCol(i)); }
      for (let i = 0; i < 2; i++) { p.px(ex, top + 3 + i, armCol(3 + i)); p.px(ex + 1, top + 3 + i, armCol(3 + i)); }
      const fx = side < 0 ? ax + 1 : ax - 1;
      if (spec.wrist) p.rect(fx, top + 4, 2, 1, c.w);
      p.rect(fx, top + 5, 2, 2, c.s);
      break;
    }
    case 'cross': {
      for (let i = 0; i < 3; i++) { p.px(ax, top + i, armCol(i)); p.px(ax + 1, top + i, armCol(i)); }
      const y = top + 3 + (side < 0 ? 0 : 1);
      const x0 = L.torsoX + 1;
      const x1 = L.torsoX + L.torsoW - 2;
      for (let x = x0; x <= x1; x++) p.px(x, y, armCol(4));
      for (let x = x0; x <= x1; x++) p.px(x, y + 1, shade(armCol(4), 0.85));
      if (side < 0) p.rect(x1, y, 2, 2, c.s); else p.rect(x0 - 1, y, 2, 2, c.s);
      break;
    }
    case 'forward': {
      // Arm reaching toward the viewer (front) or away (back): foreshortened with a big fist.
      for (let i = 0; i < 3; i++) { p.px(ax, top + i, armCol(i)); p.px(ax + 1, top + i, armCol(i)); }
      const fx = side < 0 ? ax + 1 : ax - 2;
      const fy = top + 3;
      p.rect(fx, fy, 3, 2, armCol(3));
      if (spec.wrist) p.rect(fx, fy + 2, 3, 1, c.w);
      if (!back) {
        p.rect(fx, fy + 3, 3, 3, c.s);
        p.px(fx + 1, fy + 5, c.S);
      } else {
        p.rect(fx, fy + 2, 3, 2, c.s);
      }
      break;
    }
  }
}

function drawFront(spec: HumanoidSpec, pose: Exclude<Pose, 'ko'>, back: boolean): Bitmap {
  const p = new Painter(HUMANOID_W, HUMANOID_H);
  const L = LAYOUTS[spec.body];
  const c = colors(spec);
  const P = FRONT_POSES[pose];
  const dy = P.dy;
  const hair = HAIR[spec.hair];

  // Cape behind the body (front view) or covering it (back view is drawn later).
  if (spec.cape && !back) {
    p.rect(L.torsoX - 2, L.torsoY + dy, 1, L.bootY - L.torsoY + 1, shade(spec.cape, 0.75));
    p.rect(L.torsoX + L.torsoW + 1, L.torsoY + dy, 1, L.bootY - L.torsoY + 1, shade(spec.cape, 0.75));
  }
  if (spec.tail && !back) {
    p.rect(L.torsoX + L.torsoW, L.hipY + dy, 3, 2, spec.tail);
    p.rect(L.torsoX + L.torsoW + 2, L.hipY + dy - 3, 2, 3, spec.tail);
  }
  if (hair.behind?.down && !back) stampMask(p, hair.behind.down, 4, L.headY - 4 + dy, c);

  // Legs and boots.
  const legs: Array<[number, number]> = [[L.legLX - P.spread, P.liftL], [L.legRX + P.spread, P.liftR]];
  legs.forEach(([lx, lift], idx) => {
    const kicking = P.kick && idx === 1;
    const top = L.legY + dy;
    const legH = L.legH - lift - (kicking ? 2 : 0);
    const pantsCol = spec.topStyle === 'armor' || spec.topStyle === 'suit' ? c.u : c.p;
    p.rect(lx, top, L.legW, Math.max(1, legH), pantsCol);
    p.px(lx + (idx === 0 ? L.legW - 1 : 0), top, shade(pantsCol, 0.8));
    const by = L.bootY + dy - lift - (kicking ? 4 : 0);
    const bw = L.legW + 1;
    const bx = idx === 0 ? lx - 1 : lx;
    p.rect(bx, by, bw, L.bootH + (kicking ? 1 : 0), c.b);
    p.rect(bx, by, bw, 1, c.r);
    p.px(idx === 0 ? bx : bx + bw - 1, by + L.bootH - 1, c.B);
  });

  // Hips / skirt.
  if (spec.topStyle === 'dress' || spec.topStyle === 'robe' || spec.topStyle === 'coat') {
    const skirtH = spec.topStyle === 'coat' ? L.legH + 1 : spec.topStyle === 'robe' ? L.legH + 2 : L.legH - 1;
    p.rect(L.torsoX, L.hipY + dy, L.torsoW, L.hipH + skirtH, c.t);
    p.rect(L.torsoX, L.hipY + dy + L.hipH + skirtH - 1, L.torsoW, 1, c.T);
    if (spec.topStyle === 'coat') p.vline(L.torsoX + (L.torsoW >> 1), L.hipY + dy, L.hipH + skirtH, c.T);
  } else {
    const hipCol = spec.topStyle === 'armor' || spec.topStyle === 'suit' ? c.u : c.p;
    p.rect(L.legLX - P.spread, L.hipY + dy, L.legRX + L.legW - L.legLX + P.spread * 2, L.hipH, hipCol);
  }

  // Torso.
  const tx = L.torsoX;
  const ty = L.torsoY + dy;
  p.rect(tx, ty, L.torsoW, L.torsoH, c.t);
  p.vline(tx, ty + 1, L.torsoH - 1, c.T);
  p.vline(tx + L.torsoW - 1, ty + 1, L.torsoH - 1, c.T);
  const mid = tx + (L.torsoW >> 1) - 1;
  if (!back) {
    if (spec.topStyle === 'gi' || spec.topStyle === 'vest' || spec.topStyle === 'robe') {
      // V collar showing undershirt.
      p.rect(mid, ty, 2, 3, c.u);
      p.px(mid, ty + 3, c.u);
      p.px(mid + 1, ty + 3, c.T);
    } else if (spec.topStyle === 'armor') {
      p.rect(tx - 1, ty, 3, 2, c.t);
      p.rect(tx + L.torsoW - 2, ty, 3, 2, c.t);
      p.rect(tx - 1, ty + 2, 1, 1, c.T);
      p.rect(tx + L.torsoW, ty + 2, 1, 1, c.T);
      p.rect(mid, ty, 2, 1, c.u);
      p.hline(tx + 1, ty + 4, L.torsoW - 2, c.T);
    } else if (spec.topStyle === 'suit') {
      p.rect(mid, ty, 2, 1, c.s);
    } else if (spec.topStyle === 'coat') {
      p.vline(mid + 1, ty + 1, L.torsoH - 1, c.T);
      p.rect(mid, ty, 2, 2, c.u);
    }
    if (spec.emblem) p.rect(mid - 2, ty + 2, 2, 2, spec.emblem);
  } else if (spec.emblem && spec.topStyle === 'gi') {
    p.rect(mid, ty + 1, 2, 3, spec.emblem);
  }
  if (spec.belt) p.rect(tx, L.beltY + dy, L.torsoW, 1, c.l);
  if (spec.belt && spec.topStyle === 'gi') {
    // Sash tails hang off one hip.
    p.rect(tx + 1, L.beltY + dy + 1, 1, 2, c.l);
  }
  if (spec.scarf) {
    p.rect(tx + 1, ty - 1, L.torsoW - 2, 2, spec.scarf);
    p.rect(tx + 1, ty + 1, 2, 2, spec.scarf);
  }

  // Arms (screen-left arm is the character's right arm when facing down).
  frontArm(p, spec, c, L, -1, P.armL, dy, back);
  frontArm(p, spec, c, L, 1, P.armR, dy, back);

  // Neck and head.
  const hy = L.headY + dy;
  p.rect(11, hy + 8, 2, 1, c.S);
  p.rect(8, hy, 8, 6, c.s);
  p.rect(9, hy + 6, 6, 1, c.s);
  p.rect(10, hy + 7, 4, 1, c.s);
  if (spec.ears === 'pointed') {
    p.px(7, hy + 3, c.s); p.px(6, hy + 2, c.s); p.px(7, hy + 4, c.S);
    p.px(16, hy + 3, c.s); p.px(17, hy + 2, c.s); p.px(16, hy + 4, c.S);
  } else {
    p.px(7, hy + 4, c.S);
    p.px(16, hy + 4, c.S);
  }
  if (!back) {
    if (P.closedEyes) {
      p.px(10, hy + 5, c.e); p.px(13, hy + 5, c.e);
    } else if (spec.face === 'shades') {
      p.rect(9, hy + 4, 6, 2, '#101010');
    } else {
      p.rect(10, hy + 4, 1, 2, c.e);
      p.rect(13, hy + 4, 1, 2, c.e);
      if (spec.face === 'stern') { p.px(9, hy + 3, c.H); p.px(14, hy + 3, c.H); }
    }
    p.px(11, hy + 6, c.S);
    p.px(12, hy + 6, c.S);
    if (spec.face === 'thirdEye') p.px(11, hy + 2, c.e);
    if (spec.face === 'mustache') { p.rect(10, hy + 6, 4, 1, c.h); p.px(9, hy + 7, c.h); p.px(14, hy + 7, c.h); }
    if (spec.face === 'beard') { p.rect(9, hy + 6, 6, 2, '#f0f0f0'); p.rect(10, hy + 8, 4, 2, '#f0f0f0'); p.px(11, hy + 10, '#f0f0f0'); }
    if (spec.earring) { p.px(7, hy + 6, spec.earring); p.px(16, hy + 6, spec.earring); }
    if (spec.scouter) { p.rect(14, hy + 3, 3, 2, spec.scouter); p.px(16, hy + 5, '#606060'); }
  }
  if (spec.halo) {
    p.hline(8, hy + 9, 8, spec.halo);
  }
  stampMask(p, back ? hair.up : hair.down, 4, hy - 4, c);

  // Cape over the back view.
  if (spec.cape && back) {
    p.rect(L.torsoX - 2, L.torsoY + dy - 1, L.torsoW + 4, L.bootY - L.torsoY + 1, spec.cape);
    p.vline(L.torsoX + 2, L.torsoY + dy + 1, L.bootY - L.torsoY - 1, shade(spec.cape, 0.8));
    p.vline(L.torsoX + L.torsoW - 3, L.torsoY + dy + 1, L.bootY - L.torsoY - 1, shade(spec.cape, 0.8));
  }
  if (spec.tail && back) {
    p.rect(11, L.hipY + dy, 2, 3, spec.tail);
    p.rect(12, L.hipY + dy + 2, 3, 2, spec.tail);
  }

  p.outline(c.o);
  return p.done();
}

/** Side-view (facing left) pose parameters. */
interface SidePose {
  dy: number; dx: number;
  legs: 'together' | 'stepA' | 'stepB' | 'wide' | 'kick' | 'trail' | 'air';
  arm: 'side' | 'fwd' | 'back' | 'punch' | 'punchLow' | 'palm' | 'up' | 'bent' | 'guard' | 'flail';
  lean: number;
  closedEyes: boolean;
}

const SIDE_POSES: Record<Exclude<Pose, 'ko'>, SidePose> = {
  idle: { dy: 0, dx: 0, legs: 'together', arm: 'side', lean: 0, closedEyes: false },
  walk1: { dy: 0, dx: 0, legs: 'stepA', arm: 'fwd', lean: 0, closedEyes: false },
  walk2: { dy: 0, dx: 0, legs: 'stepB', arm: 'back', lean: 0, closedEyes: false },
  punch1: { dy: 0, dx: -1, legs: 'wide', arm: 'punch', lean: -1, closedEyes: false },
  punch2: { dy: 0, dx: -1, legs: 'wide', arm: 'punchLow', lean: -1, closedEyes: false },
  kick: { dy: -1, dx: 0, legs: 'kick', arm: 'bent', lean: 1, closedEyes: false },
  blast: { dy: 0, dx: 0, legs: 'wide', arm: 'palm', lean: 0, closedEyes: false },
  charge: { dy: 1, dx: 0, legs: 'wide', arm: 'bent', lean: 0, closedEyes: false },
  hurt: { dy: -1, dx: 2, legs: 'air', arm: 'flail', lean: 1, closedEyes: true },
  raise: { dy: 0, dx: 0, legs: 'together', arm: 'up', lean: 0, closedEyes: false },
  fly: { dy: -2, dx: 0, legs: 'trail', arm: 'back', lean: -1, closedEyes: false },
  guard: { dy: 0, dx: 1, legs: 'wide', arm: 'guard', lean: 0, closedEyes: false },
};

function drawSide(spec: HumanoidSpec, pose: Exclude<Pose, 'ko'>): Bitmap {
  const p = new Painter(HUMANOID_W, HUMANOID_H);
  const L = LAYOUTS[spec.body];
  const c = colors(spec);
  const P = SIDE_POSES[pose];
  const hair = HAIR[spec.hair];
  const dy = P.dy;
  const dx = P.dx;
  const sideW = Math.max(5, L.torsoW - 4);
  const tx = 9 + dx + (spec.body === 'big' ? -1 : 0);
  const ty = L.torsoY + dy;
  const limbCol = spec.topStyle === 'armor' || spec.topStyle === 'suit' ? c.u : c.p;
  const sleeveCol = spec.topStyle === 'armor' || spec.topStyle === 'suit' ? c.u : spec.sleeves === 'none' ? c.s : spec.topStyle === 'gi' || spec.topStyle === 'vest' ? c.u : c.t;
  const sleeveLen = spec.sleeves === 'long' ? 99 : spec.sleeves === 'short' ? 3 : 0;
  const armCol = (i: number) => (i < sleeveLen ? sleeveCol : c.s);

  if (spec.cape) {
    const capeLen = L.bootY - L.torsoY + 2;
    const flare = pose === 'fly' || pose === 'walk1' || pose === 'walk2' ? 2 : 1;
    for (let i = 0; i < capeLen; i++) {
      const w = 2 + Math.floor((i * flare) / capeLen) * 2;
      p.rect(tx + sideW - 1, ty + i, w, 1, i % 4 === 3 ? shade(spec.cape, 0.85) : spec.cape);
    }
  }
  if (spec.tail) {
    p.rect(tx + sideW, L.hipY + dy, 3, 2, spec.tail);
    p.rect(tx + sideW + 2, L.hipY + dy - 3, 2, 3, spec.tail);
  }
  if (hair.behind?.left) stampMask(p, hair.behind.left, 4 + dx, L.headY - 4 + dy, c);

  // Back arm (darker), drawn first so the body covers it.
  const backArmX = tx + sideW - 2;
  if (P.arm !== 'punch' && P.arm !== 'palm' && P.arm !== 'guard') {
    for (let i = 0; i < L.handY - L.torsoY; i++) p.px(backArmX, ty + 1 + i, shade(armCol(i), 0.7));
  }

  // Legs.
  const legY = L.legY + dy;
  const lh = L.legH;
  const bh = L.bootH;
  const leg = (x: number, front: boolean, lift = 0) => {
    const col = front ? limbCol : shade(limbCol, 0.75);
    p.rect(x, legY, 3, lh - lift, col);
    const by = L.bootY + dy - lift;
    p.rect(x - 1, by, 4, bh, front ? c.b : c.B);
    p.rect(x - 1, by, 4, 1, c.r);
  };
  switch (P.legs) {
    case 'together': leg(tx + 1, false); leg(tx + 1 + (sideW > 5 ? 1 : 0), true); break;
    case 'stepA': leg(tx + 3, false); leg(tx - 1, true); break;
    case 'stepB': leg(tx - 1, false); leg(tx + 3, true); break;
    case 'wide': leg(tx + 4, false); leg(tx - 2, true); break;
    case 'air': leg(tx + 3, false, 2); leg(tx, true, 1); break;
    case 'kick': {
      leg(tx + 3, false);
      // Front leg extended horizontally toward the facing direction.
      p.rect(tx - 6, L.hipY + dy, 8, 3, limbCol);
      p.rect(tx - 10, L.hipY + dy - 1, 4, 4, c.b);
      p.rect(tx - 7, L.hipY + dy - 1, 1, 4, c.r);
      break;
    }
    case 'trail': {
      p.rect(tx + 2, L.hipY + dy + 1, 7, 3, shade(limbCol, 0.85));
      p.rect(tx + 9, L.hipY + dy + 1, 4, 3, c.b);
      p.rect(tx + 1, L.hipY + dy + 2, 7, 3, limbCol);
      p.rect(tx + 8, L.hipY + dy + 2, 4, 3, c.b);
      break;
    }
  }

  // Hips / skirt.
  if (spec.topStyle === 'dress' || spec.topStyle === 'robe' || spec.topStyle === 'coat') {
    const skirtH = spec.topStyle === 'coat' ? L.legH + 1 : spec.topStyle === 'robe' ? L.legH + 2 : L.legH - 1;
    p.rect(tx, L.hipY + dy, sideW + 1, L.hipH + skirtH, c.t);
    p.rect(tx, L.hipY + dy + L.hipH + skirtH - 1, sideW + 1, 1, c.T);
  } else {
    p.rect(tx, L.hipY + dy, sideW, L.hipH, limbCol);
  }

  // Torso, leaning by shifting the top rows.
  for (let y = 0; y < L.torsoH; y++) {
    const off = y < 3 ? P.lean : 0;
    p.hline(tx + off, ty + y, sideW, c.t);
    p.px(tx + off + sideW - 1, ty + y, c.T);
  }
  if (spec.topStyle === 'armor') {
    p.rect(tx + P.lean + 1, ty - 1, sideW - 1, 3, c.t);
    p.hline(tx + P.lean + 1, ty + 2, sideW - 1, c.T);
  }
  if (spec.topStyle === 'gi' || spec.topStyle === 'vest' || spec.topStyle === 'robe') {
    p.rect(tx + P.lean, ty, 2, 2, c.u);
  }
  if (spec.belt) p.hline(tx, L.beltY + dy, sideW, c.l);
  if (spec.belt && spec.topStyle === 'gi') p.rect(tx + sideW - 1, L.beltY + dy + 1, 1, 2, c.l);
  if (spec.scarf) {
    p.rect(tx + P.lean, ty - 1, sideW, 2, spec.scarf);
    p.rect(tx + P.lean + sideW, ty, 3, 1, spec.scarf);
    p.rect(tx + P.lean + sideW + 2, ty + 1, 2, 1, spec.scarf);
  }

  // Front arm.
  const ax = tx + 2 + P.lean;
  const ay = ty + 1;
  const len = L.handY - L.torsoY - 1;
  const wristCol = (i: number) => (spec.wrist && i >= len - 2 ? c.w : armCol(i));
  switch (P.arm) {
    case 'side':
      for (let i = 0; i < len; i++) p.hline(ax, ay + i, 2, wristCol(i));
      p.rect(ax, ay + len, 2, 2, c.s);
      break;
    case 'fwd':
      for (let i = 0; i < len; i++) p.hline(ax - Math.floor(i / 3), ay + i, 2, wristCol(i));
      p.rect(ax - Math.floor(len / 3), ay + len, 2, 2, c.s);
      break;
    case 'back':
      for (let i = 0; i < len; i++) p.hline(ax + Math.floor(i / 3), ay + i, 2, wristCol(i));
      p.rect(ax + Math.floor(len / 3), ay + len, 2, 2, c.s);
      break;
    case 'punch':
    case 'punchLow': {
      const py = ay + (P.arm === 'punchLow' ? 2 : 1);
      for (let i = 0; i < 8; i++) {
        const col = i < 2 ? c.s : spec.wrist && i < 4 ? c.w : armCol(7 - i);
        p.px(ax - 6 + i, py, col);
        p.px(ax - 6 + i, py + 1, shade(col, 0.85));
      }
      p.rect(ax - 9, py - 1, 3, 4, c.s);
      p.px(ax - 9, py + 2, c.S);
      break;
    }
    case 'palm': {
      const py = ay + 1;
      for (let i = 0; i < 7; i++) {
        const col = spec.wrist && i < 2 ? c.w : armCol(7 - i);
        p.px(ax - 5 + i, py, col);
        p.px(ax - 5 + i, py + 1, shade(col, 0.85));
      }
      p.rect(ax - 7, py - 2, 2, 6, c.s);
      p.vline(ax - 8, py - 1, 4, c.S);
      break;
    }
    case 'up':
      for (let i = 0; i < len; i++) p.hline(ax, ay - i, 2, wristCol(i));
      p.rect(ax, ay - len - 2, 2, 2, c.s);
      break;
    case 'bent':
      for (let i = 0; i < 3; i++) p.hline(ax + 1, ay + i, 2, armCol(i));
      for (let i = 0; i < 3; i++) p.hline(ax + 2 - i, ay + 3 + i, 2, wristCol(i + 3));
      p.rect(ax - 1, ay + 5, 2, 2, c.s);
      break;
    case 'guard':
      for (let i = 0; i < 3; i++) p.hline(ax, ay + i, 2, armCol(i));
      for (let i = 0; i < 6; i++) p.hline(ax - 2, ay - 2 + i, 2, wristCol(i + 3));
      p.rect(ax - 2, ay - 4, 2, 2, c.s);
      break;
    case 'flail':
      for (let i = 0; i < len; i++) p.hline(ax + 2 + Math.floor(i / 2), ay - Math.floor(i / 2), 2, wristCol(i));
      p.rect(ax + 2 + Math.floor(len / 2), ay - Math.floor(len / 2) - 2, 2, 2, c.s);
      break;
  }

  // Head (profile, facing left).
  const hx = 8 + dx + P.lean;
  const hy = L.headY + dy;
  p.rect(hx + 2, hy + 8, 2, 1, c.S);
  p.rect(hx, hy, 7, 6, c.s);
  p.rect(hx, hy + 6, 6, 1, c.s);
  p.rect(hx + 1, hy + 7, 4, 1, c.s);
  p.px(hx - 1, hy + 5, c.s); // nose
  p.px(hx + 4, hy + 4, c.S); // ear
  if (spec.ears === 'pointed') { p.px(hx + 5, hy + 3, c.s); p.px(hx + 6, hy + 2, c.s); p.px(hx + 7, hy + 1, c.s); }
  if (P.closedEyes) {
    p.px(hx + 1, hy + 5, c.e);
  } else if (spec.face === 'shades') {
    p.rect(hx, hy + 4, 3, 2, '#101010');
  } else {
    p.rect(hx + 1, hy + 4, 1, 2, c.e);
  }
  p.px(hx + 1, hy + 7, c.S);
  if (spec.face === 'thirdEye') p.px(hx + 1, hy + 2, c.e);
  if (spec.face === 'mustache') { p.rect(hx - 1, hy + 6, 3, 1, c.h); }
  if (spec.face === 'beard') { p.rect(hx, hy + 6, 4, 3, '#f0f0f0'); p.rect(hx + 1, hy + 9, 2, 2, '#f0f0f0'); }
  if (spec.earring) p.px(hx + 4, hy + 6, spec.earring);
  if (spec.scouter) { p.rect(hx, hy + 3, 3, 2, spec.scouter); p.rect(hx + 3, hy + 4, 2, 1, '#606060'); }
  if (spec.halo) p.hline(hx, hy + 9, 7, spec.halo);
  stampMask(p, hair.left, 4 + dx + P.lean, hy - 4, c);

  p.outline(c.o);
  return p.done();
}

/** Rotate a bitmap 90° clockwise (used for the knocked-out pose). */
function rotate90(src: Bitmap): Bitmap {
  const p = new Painter(src.height, src.width);
  const bmp = p.done();
  const ctx = bmp.getContext('2d');
  if (!ctx) return src;
  ctx.translate(src.height, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return bmp;
}

/** A complete sprite set: pose → direction → bitmap. */
export type SpriteSet = Record<Pose, Record<Dir, Bitmap>>;

/** Generate every pose in every direction for a humanoid spec. */
export function buildHumanoid(spec: HumanoidSpec): SpriteSet {
  const out = {} as SpriteSet;
  for (const pose of POSES) {
    if (pose === 'ko') continue;
    const left = drawSide(spec, pose);
    out[pose] = {
      down: drawFront(spec, pose, false),
      up: drawFront(spec, pose, true),
      left,
      right: flipX(left),
    };
  }
  const ko = rotate90(out.idle.down);
  out.ko = { down: ko, up: ko, left: ko, right: flipX(ko) };
  return out;
}
