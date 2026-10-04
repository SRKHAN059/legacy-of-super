import { Painter, type Bitmap } from '../engine/gfx';
import { PAL, shade } from './color';
import { HAIR } from './hair';
import type { HumanoidSpec } from './humanoid';

/** Facial expressions for dialogue portraits. */
export type Expression = 'neutral' | 'happy' | 'angry' | 'shock' | 'sad' | 'smirk' | 'shout' | 'hurt';

export const PORTRAIT_W = 32;
export const PORTRAIT_H = 36;

/**
 * Draw a 32x36 bust portrait from a humanoid spec: the sprite head mask doubled in scale,
 * with larger eyes, brows and mouth shapes for expressions.
 */
export function buildPortrait(spec: HumanoidSpec, expr: Expression = 'neutral'): Bitmap {
  const p = new Painter(PORTRAIT_W, PORTRAIT_H);
  const skin = spec.skin;
  const skinS = shade(skin, 0.78);
  const hair = spec.hairColor;
  const pal = { h: hair, H: shade(hair, 0.72), j: shade(hair, 1.35), k: spec.accent ?? shade(hair, 0.55), s: skin };
  const top = spec.top;
  const under = spec.under ?? shade(top, 0.7);

  // Shoulders.
  p.rect(2, 31, 28, 5, top);
  p.rect(2, 31, 28, 1, shade(top, 1.15));
  if (spec.topStyle === 'gi' || spec.topStyle === 'vest' || spec.topStyle === 'robe') {
    for (let i = 0; i < 4; i++) p.hline(13 - i, 27 + i + 4, 6 + i * 2, under);
  } else if (spec.topStyle === 'armor') {
    p.rect(0, 30, 9, 6, top); p.rect(23, 30, 9, 6, top);
    p.rect(11, 31, 10, 2, under);
  }
  if (spec.scarf) p.rect(6, 29, 20, 3, spec.scarf);
  if (spec.halo) p.hline(8, 29, 16, spec.halo);
  if (spec.cape) { p.rect(0, 30, 6, 6, spec.cape); p.rect(26, 30, 6, 6, spec.cape); }

  // Neck and face.
  p.rect(13, 27, 6, 4, skinS);
  p.rect(8, 10, 16, 15, skin);
  p.rect(9, 25, 14, 1, skin);
  p.rect(11, 26, 10, 1, skin);
  // Ears.
  if (spec.ears === 'pointed') {
    p.rect(5, 17, 3, 3, skin); p.rect(3, 15, 2, 3, skin); p.px(2, 14, skin);
    p.rect(24, 17, 3, 3, skin); p.rect(27, 15, 2, 3, skin); p.px(29, 14, skin);
  } else {
    p.rect(6, 18, 2, 4, skin); p.px(6, 19, skinS);
    p.rect(24, 18, 2, 4, skin); p.px(25, 19, skinS);
  }
  // Jaw shading.
  p.hline(10, 25, 12, skinS);

  // Eyes.
  const eye = spec.eye ?? '#181018';
  const ey = 14;
  const drawEye = (x: number, mirror: boolean) => {
    if (expr === 'hurt' || (expr === 'happy' && spec.face !== 'stern')) {
      // Closed / smiling arcs.
      p.hline(x, ey + 1 + 4, 4, PAL.outline);
      p.px(mirror ? x + 3 : x, ey + 4, PAL.outline);
      return;
    }
    if (spec.face === 'shades') {
      p.rect(x - 1, ey - 1 + 4, 6, 4, '#101010');
      p.px(x, ey - 1 + 4, '#606070');
      return;
    }
    const h = expr === 'shock' ? 4 : 3;
    p.rect(x, ey + 4, 4, h, '#f8f8f8');
    p.rect(mirror ? x : x + 2, ey + 4, 2, h, eye);
    p.px(mirror ? x : x + 2, ey + 4, '#f8f8f8');
    p.hline(x, ey - 1 + 4, 4, PAL.outline);
  };
  drawEye(10, false);
  drawEye(18, true);
  if (spec.face === 'thirdEye') { p.rect(15, 13, 2, 3, '#f8f8f8'); p.px(15, 14, eye); }

  // Brows.
  const browCol = spec.hair === 'bald' || spec.hair === 'turban' || spec.hair === 'dome' ? skinS : pal.H;
  if (expr === 'angry' || expr === 'shout' || spec.face === 'stern') {
    p.line(9, 14, 13, 16, browCol); p.line(22, 14, 18, 16, browCol);
    p.line(9, 15, 13, 17, PAL.outline); p.line(22, 15, 18, 17, PAL.outline);
  } else if (expr === 'sad') {
    p.line(9, 16, 13, 14, PAL.outline); p.line(22, 16, 18, 14, PAL.outline);
  } else {
    p.hline(10, 15, 4, PAL.outline); p.hline(18, 15, 4, PAL.outline);
  }

  // Nose.
  p.px(16, 22, skinS); p.px(16, 21, skinS);

  // Mouth.
  const mc = '#702828';
  switch (expr) {
    case 'happy': p.hline(13, 24, 6, PAL.outline); p.rect(14, 25, 4, 1, mc); break;
    case 'smirk': p.hline(14, 25, 4, PAL.outline); p.px(18, 24, PAL.outline); break;
    case 'angry': p.hline(13, 25, 6, PAL.outline); p.px(13, 24, PAL.outline); p.px(18, 24, PAL.outline); break;
    case 'shout': p.rect(13, 24, 6, 3, mc); p.hline(13, 24, 6, '#f8f8f8'); break;
    case 'shock': p.rect(14, 24, 4, 3, mc); break;
    case 'sad': p.hline(14, 25, 4, PAL.outline); p.px(13, 26, PAL.outline); p.px(18, 26, PAL.outline); break;
    case 'hurt': p.hline(13, 25, 6, PAL.outline); p.px(14, 24, PAL.outline); p.px(16, 26, PAL.outline); break;
    default: p.hline(14, 25, 4, PAL.outline);
  }
  if (spec.face === 'mustache') { p.rect(11, 23, 10, 2, pal.h); p.px(10, 25, pal.h); p.px(21, 25, pal.h); }
  if (spec.face === 'beard') { p.rect(9, 23, 14, 5, '#f0f0f0'); p.rect(11, 28, 10, 4, '#f0f0f0'); p.rect(13, 32, 6, 3, '#f0f0f0'); }
  if (spec.earring) { p.rect(6, 23, 2, 2, spec.earring); p.rect(24, 23, 2, 2, spec.earring); }
  if (spec.scouter) { p.rect(20, 16, 7, 5, spec.scouter); p.rect(24, 21, 2, 4, '#606060'); }

  // Hair mask scaled 2x. Mask col 4 = head left edge (x8 in sprite) → portrait x8 means offset -8+... :
  // sprite x = 4 + col, portrait x = (sprite x - 8) * 2 + 8 = col * 2; sprite y = headY - 4 + row,
  // portrait y = (row - 4) * 2 + 6.
  const mask = HAIR[spec.hair].down;
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      const ch = mask[r][c];
      if (ch === '.' || ch === ' ') continue;
      const col = (pal as Record<string, string>)[ch];
      if (!col) continue;
      const x = c * 2;
      const y = (r - 4) * 2 + 10;
      p.rect(x, y, 2, 2, col);
    }
  }

  p.outline(PAL.outline);
  return p.done();
}
