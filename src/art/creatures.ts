import { flipX, Painter, type Bitmap } from '../engine/gfx';
import { PAL, shade } from './color';
import type { SpriteSet } from './humanoid';

/** Body plans for non-humanoid enemies. */
export type CreatureKind = 'quadruped' | 'dino' | 'flyer' | 'snake' | 'robot' | 'drone' | 'blob' | 'bug' | 'crab' | 'bat';

export interface CreatureSpec {
  kind: CreatureKind;
  body: string;
  /** Belly / secondary colour. */
  belly?: string;
  /** Stripes, spots or panel lights. */
  accent?: string;
  eye?: string;
  /** Pixel size of the frame (square). */
  size: 24 | 32 | 40 | 48;
  /** Horns / spikes / mane flag. */
  horns?: boolean;
  stripes?: boolean;
}

type CPose = 'idle' | 'walk1' | 'walk2' | 'attack' | 'hurt';

function frame(spec: CreatureSpec, pose: CPose, dir: 'down' | 'up' | 'left'): Bitmap {
  const S = spec.size;
  const p = new Painter(S, S);
  const b = spec.body;
  const bs = shade(b, 0.75);
  const bl = spec.belly ?? shade(b, 1.3);
  const ac = spec.accent ?? shade(b, 0.6);
  const eye = spec.eye ?? '#f8f040';
  const k = S / 32;
  const R = (x: number, y: number, w: number, h: number, c: string) => p.rect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
  const E = (x: number, y: number, w: number, h: number, c: string) => p.ellipse(Math.round(x * k), Math.round(y * k), Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)), c);
  const step = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
  const lunge = pose === 'attack' ? 3 : 0;
  const hurt = pose === 'hurt' ? 2 : 0;

  switch (spec.kind) {
    case 'quadruped': {
      if (dir === 'left') {
        R(22, 14 - hurt, 6, 3, bs); // tail
        R(26, 10 - hurt, 3, 5, bs);
        E(9 - lunge, 13, 18, 11, b); // body
        E(11 - lunge, 18, 14, 5, bl);
        if (spec.stripes) for (let i = 0; i < 4; i++) R(13 + i * 3 - lunge, 13, 1, 5, ac);
        // Legs.
        R(10 - lunge + step, 21, 3, 7, bs); R(20 - lunge - step, 21, 3, 7, bs);
        R(12 - lunge - step, 21, 3, 7, b); R(22 - lunge + step, 21, 3, 7, b);
        // Head.
        E(1 - lunge, 7 - hurt, 12, 10, b);
        R(-1 - lunge, 12 - hurt, 5, 4, bl); // snout
        R(6 - lunge, 4 - hurt, 3, 4, b); // ear
        if (spec.horns) R(4 - lunge, 3 - hurt, 2, 4, '#f0e8d0');
        p.px(Math.round((4 - lunge) * k), Math.round((10 - hurt) * k), eye);
        if (pose === 'attack') R(-1 - lunge, 15, 5, 2, '#f8f8f8');
      } else if (dir === 'down') {
        E(7, 12, 18, 14, b);
        R(9 + step, 22, 4, 7, bs); R(19 - step, 22, 4, 7, bs);
        E(8, 5 - hurt + lunge, 16, 13, b);
        E(11, 12 - hurt + lunge, 10, 6, bl);
        R(8, 3 - hurt + lunge, 4, 5, b); R(20, 3 - hurt + lunge, 4, 5, b);
        if (spec.horns) { R(9, 1 + lunge, 2, 4, '#f0e8d0'); R(21, 1 + lunge, 2, 4, '#f0e8d0'); }
        if (spec.stripes) { R(14, 5 + lunge, 1, 4, ac); R(17, 5 + lunge, 1, 4, ac); }
        p.px(Math.round(12 * k), Math.round((10 - hurt + lunge) * k), eye);
        p.px(Math.round(19 * k), Math.round((10 - hurt + lunge) * k), eye);
        p.px(Math.round(15 * k), Math.round((14 - hurt + lunge) * k), '#202020');
        if (pose === 'attack') R(13, 16 + lunge, 6, 2, '#f8f8f8');
      } else {
        E(7, 8, 18, 18, b);
        if (spec.stripes) for (let i = 0; i < 3; i++) R(10, 11 + i * 4, 12, 1, ac);
        R(9 - step, 22, 4, 7, bs); R(19 + step, 22, 4, 7, bs);
        R(15, 22 - hurt, 2, 6, bs);
        R(8, 3, 4, 5, b); R(20, 3, 4, 5, b);
        E(9, 4, 14, 8, b);
      }
      break;
    }
    case 'dino': {
      if (dir === 'left') {
        R(18, 14, 12, 4, bs); R(26, 12, 5, 3, bs); // tail
        E(10, 9, 14, 15, b);
        E(12, 14, 9, 9, bl);
        R(12 + step, 22, 4, 8, bs); R(16 - step, 22, 4, 8, b);
        R(10 + step, 28, 6, 2, bs); R(14 - step, 28, 6, 2, b);
        E(1 - lunge, 3 - hurt, 13, 9, b); // head
        R(-1 - lunge, 7 - hurt, 8, 4, b);
        if (pose === 'attack') { R(-1 - lunge, 10, 8, 2, '#f8f8f8'); R(-1 - lunge, 11, 8, 2, '#a02020'); }
        else R(0 - lunge, 10 - hurt, 7, 1, '#f8f8f8');
        R(9, 14, 3, 2, bs); // tiny arm
        p.px(Math.round((5 - lunge) * k), Math.round((5 - hurt) * k), eye);
        if (spec.horns) for (let i = 0; i < 4; i++) R(13 + i * 3, 7 + i, 2, 2, ac);
      } else if (dir === 'down') {
        E(8, 10, 16, 16, b); E(11, 14, 10, 10, bl);
        R(9 + step, 23, 4, 7, bs); R(19 - step, 23, 4, 7, bs);
        E(9, 1 - hurt + lunge, 14, 12, b);
        R(10, 8 + lunge, 12, 3, pose === 'attack' ? '#a02020' : bs);
        if (pose === 'attack') R(10, 8 + lunge, 12, 1, '#f8f8f8');
        R(7, 15, 3, 2, bs); R(22, 15, 3, 2, bs);
        p.px(Math.round(12 * k), Math.round((5 - hurt + lunge) * k), eye);
        p.px(Math.round(19 * k), Math.round((5 - hurt + lunge) * k), eye);
      } else {
        E(8, 8, 16, 18, b);
        R(14, 24, 4, 7, bs);
        R(9 - step, 23, 4, 7, bs); R(19 + step, 23, 4, 7, bs);
        E(10, 1, 12, 10, b);
        if (spec.horns) for (let i = 0; i < 4; i++) R(15, 4 + i * 5, 2, 3, ac);
      }
      break;
    }
    case 'flyer': {
      const flap = pose === 'walk1' ? -4 : pose === 'walk2' ? 2 : 0;
      if (dir === 'left') {
        E(8, 12, 16, 8, b);
        p.line(Math.round(14 * k), Math.round(13 * k), Math.round(22 * k), Math.round((2 + flap) * k), bs);
        p.line(Math.round(16 * k), Math.round(13 * k), Math.round(28 * k), Math.round((4 + flap) * k), bs);
        R(14, 8 + flap / 2, 10, 5, b);
        E(1 - lunge, 9 - hurt, 10, 7, b); R(-3 - lunge, 11 - hurt, 6, 2, spec.accent ?? '#e8c040');
        if (spec.horns) R(7 - lunge, 6, 5, 2, b);
        R(22, 14, 6, 2, bs);
        p.px(Math.round((4 - lunge) * k), Math.round((11 - hurt) * k), eye);
        R(12, 19, 2, 4, '#e8c040'); R(17, 19, 2, 4, '#e8c040');
      } else {
        E(11, 10 + lunge, 10, 12, b);
        R(1, 10 + flap, 10, 4, b); R(21, 10 + flap, 10, 4, b);
        R(1, 13 + flap, 10, 2, bs); R(21, 13 + flap, 10, 2, bs);
        E(11, 4 - hurt + lunge, 10, 9, b);
        if (dir === 'down') {
          R(14, 10 + lunge, 4, 4, spec.accent ?? '#e8c040');
          p.px(Math.round(13 * k), Math.round((7 + lunge) * k), eye);
          p.px(Math.round(18 * k), Math.round((7 + lunge) * k), eye);
        }
        R(13, 21, 2, 4, '#e8c040'); R(17, 21, 2, 4, '#e8c040');
      }
      break;
    }
    case 'bat': {
      const flap = pose === 'walk1' ? -3 : pose === 'walk2' ? 3 : 0;
      E(12, 12 - hurt, 8, 8, b);
      for (let i = 0; i < 9; i++) {
        R(3 + i, 12 + flap * (1 - i / 9) + (i % 3 === 0 ? 2 : 0), 1, 5 - (i % 3), bs);
        R(28 - i, 12 + flap * (1 - i / 9) + (i % 3 === 0 ? 2 : 0), 1, 5 - (i % 3), bs);
      }
      R(12, 9 - hurt, 2, 3, b); R(18, 9 - hurt, 2, 3, b);
      if (dir !== 'up') { p.px(Math.round(14 * k), Math.round((14 - hurt) * k), eye); p.px(Math.round(17 * k), Math.round((14 - hurt) * k), eye); }
      break;
    }
    case 'snake': {
      const wig = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
      if (dir === 'left') {
        for (let i = 0; i < 18; i++) R(8 + i, 20 + Math.round(Math.sin(i / 2.5 + wig) * 2), 4, 5, i % 4 === 0 ? ac : b);
        E(1 - lunge, 13 - hurt, 10, 8, b);
        R(4 - lunge, 18, 5, 5, b);
        p.px(Math.round((4 - lunge) * k), Math.round((16 - hurt) * k), eye);
        if (pose === 'attack') R(-2 - lunge, 18, 3, 1, '#e02040');
      } else {
        for (let i = 0; i < 4; i++) E(8 + i * 2 + wig * (i % 2), 14 + i * 3, 16 - i * 4, 6, i % 2 ? b : bs);
        E(10, 4 + lunge - hurt, 12, 11, b);
        if (dir === 'down') {
          E(12, 8 + lunge, 8, 5, bl);
          p.px(Math.round(13 * k), Math.round((8 + lunge) * k), eye);
          p.px(Math.round(18 * k), Math.round((8 + lunge) * k), eye);
          if (pose === 'attack') R(15, 14 + lunge, 2, 3, '#e02040');
        }
      }
      break;
    }
    case 'robot': {
      const metal = b;
      if (dir === 'left') {
        R(9, 22, 5, 8, bs); R(15, 22, 5, 8, bs);
        R(10 + step, 22, 4, 8, metal); R(15 - step, 22, 4, 8, shade(metal, 0.85));
        R(7, 9, 16, 14, metal); R(7, 9, 16, 2, shade(metal, 1.2));
        R(8, 2 - hurt, 12, 8, metal); R(8, 5 - hurt, 5, 2, spec.accent ?? '#e03030');
        R(4 - lunge * 2, 13, 8, 4, bs); R(1 - lunge * 2, 12, 4, 6, metal);
        R(12, 15, 4, 4, spec.accent ?? '#e03030');
      } else {
        R(9 + step, 22, 5, 8, bs); R(18 - step, 22, 5, 8, bs);
        R(6, 9, 20, 14, metal); R(6, 9, 20, 2, shade(metal, 1.2));
        R(2, 10, 4, 10 + lunge, bs); R(26, 10, 4, 10 + lunge, bs);
        R(10, 2 - hurt, 12, 8, metal);
        if (dir === 'down') { R(11, 5 - hurt, 10, 2, spec.accent ?? '#e03030'); R(13, 13, 6, 6, spec.accent ?? '#e03030'); }
        else R(11, 12, 10, 6, bs);
      }
      break;
    }
    case 'drone': {
      const bob = pose === 'walk1' ? -1 : pose === 'walk2' ? 1 : 0;
      E(6, 8 + bob, 20, 16, b);
      E(8, 9 + bob, 14, 8, shade(b, 1.25));
      R(2, 14 + bob, 4, 3, bs); R(26, 14 + bob, 4, 3, bs);
      if (dir !== 'up') E(12, 13 + bob - hurt, 8, 7, pose === 'attack' ? '#f8f8a0' : spec.accent ?? '#e03030');
      R(14, 26, 4, 2, shade('#58c8f8', pose === 'walk1' ? 1.2 : 1));
      break;
    }
    case 'blob': {
      const squish = pose === 'walk1' ? 2 : pose === 'walk2' ? -1 : 0;
      E(4 - squish, 10 + squish - lunge, 24 + squish * 2, 20 - squish + lunge, b);
      E(8, 12 + squish, 10, 6, shade(b, 1.3));
      if (dir !== 'up') {
        R(11, 18 + squish, 3, 4, '#101010'); R(18, 18 + squish, 3, 4, '#101010');
        p.px(Math.round(11 * k), Math.round((18 + squish) * k), '#f8f8f8');
        p.px(Math.round(18 * k), Math.round((18 + squish) * k), '#f8f8f8');
      }
      break;
    }
    case 'bug': {
      E(8, 10, 16, 16, b);
      R(15, 10, 2, 16, bs);
      if (spec.stripes) for (let i = 0; i < 3; i++) R(9, 14 + i * 4, 14, 1, ac);
      for (let i = 0; i < 3; i++) { R(3 + step * (i % 2), 13 + i * 4, 6, 1, bs); R(23 - step * (i % 2), 13 + i * 4, 6, 1, bs); }
      if (dir !== 'up') {
        E(11, 4 + lunge - hurt, 10, 8, shade(b, 0.8));
        p.px(Math.round(13 * k), Math.round((7 + lunge) * k), eye); p.px(Math.round(18 * k), Math.round((7 + lunge) * k), eye);
        if (spec.horns) { R(11, 0 + lunge, 2, 5, ac); R(19, 0 + lunge, 2, 5, ac); }
      }
      break;
    }
    case 'crab': {
      E(6, 12, 20, 12, b);
      E(9, 13, 8, 4, shade(b, 1.3));
      for (let i = 0; i < 3; i++) { R(2 + step, 18 + i * 3, 5, 1, bs); R(25 - step, 18 + i * 3, 5, 1, bs); }
      const cl = pose === 'attack' ? -3 : 0;
      E(0, 6 + cl, 8, 7, b); E(24, 6 + cl, 8, 7, b);
      R(12, 9, 2, 4, bs); R(18, 9, 2, 4, bs);
      if (dir !== 'up') { p.px(Math.round(12 * k), Math.round(8 * k), eye); p.px(Math.round(19 * k), Math.round(8 * k), eye); }
      break;
    }
  }
  p.outline(PAL.outline);
  return p.done();
}

const POSE_MAP: Record<string, CPose> = {
  idle: 'idle', walk1: 'walk1', walk2: 'walk2', punch1: 'attack', punch2: 'attack', kick: 'attack', blast: 'attack',
  charge: 'idle', hurt: 'hurt', raise: 'idle', fly: 'walk1', guard: 'idle',
};

/** Build a full SpriteSet for a creature so it plugs into the same actor renderer as humanoids. */
export function buildCreature(spec: CreatureSpec): SpriteSet {
  const cache = new Map<string, Bitmap>();
  const get = (pose: CPose, dir: 'down' | 'up' | 'left'): Bitmap => {
    const key = `${pose}:${dir}`;
    let b = cache.get(key);
    if (!b) { b = frame(spec, pose, dir); cache.set(key, b); }
    return b;
  };
  const out = {} as SpriteSet;
  for (const [pose, cp] of Object.entries(POSE_MAP)) {
    const left = get(cp, 'left');
    out[pose as keyof SpriteSet] = { down: get(cp, 'down'), up: get(cp, 'up'), left, right: flipX(left) };
  }
  // KO: hurt frame faded.
  const ko = get('hurt', 'left');
  out.ko = { down: ko, up: ko, left: ko, right: flipX(ko) };
  return out;
}
