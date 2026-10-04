import { finishProp, registerProp } from '../../../art/props';
import { shade } from '../../../art/color';
import { Painter } from '../../../engine/gfx';

/**
 * Custom landmarks for world/earthB.
 * - eb_pilafCastle 144x112 (9x7 tiles): door at prop (x+4, y+6); solid = bottom 50 px.
 * - eb_gravityConsole 24x36: Capsule Corp gravity machine, solid base.
 * - eb_snowPine 24x40: snow-capped pine (same footprint as `pine`).
 * - eb_iceSpire 20x30: jagged ice crystal (decor, solid base).
 */

registerProp('eb_pilafCastle', () => {
  const p = new Painter(144, 112);
  const wall = '#dcc090';
  const wallDark = shade(wall, 0.8);
  const dome = '#38a088';
  const domeLight = '#60c8a8';
  const gold = '#f0d040';
  // Side towers.
  for (const tx of [4, 112]) {
    p.rect(tx, 30, 28, 70, wallDark);
    p.rect(tx + 2, 30, 24, 70, wall);
    p.vline(tx + 2, 30, 70, wallDark);
    p.ellipse(tx - 2, 10, 32, 26, dome);
    p.ellipse(tx + 4, 13, 12, 9, domeLight);
    p.vline(tx + 14, 0, 12, gold);
    p.rect(tx + 15, 1, 8, 5, '#e04040');
    for (let i = 0; i < 3; i++) {
      p.rect(tx + 10, 40 + i * 18, 8, 10, '#382818');
      p.ellipse(tx + 10, 37 + i * 18, 8, 6, '#382818');
    }
  }
  // Keep.
  p.rect(28, 46, 88, 54, wall);
  p.hline(28, 46, 88, shade(wall, 1.1));
  for (let i = 0; i < 11; i++) p.rect(28 + i * 8, 40, 5, 6, wall);
  for (let i = 0; i < 4; i++) {
    const wx = 36 + i * 20 + (i >= 2 ? 8 : 0);
    p.rect(wx, 54, 8, 12, '#382818');
    p.ellipse(wx, 50, 8, 8, '#382818');
  }
  // Central onion dome on a drum.
  p.rect(46, 34, 52, 12, '#e8d4a8');
  p.hline(46, 34, 52, shade('#e8d4a8', 0.85));
  p.ellipse(44, 4, 56, 40, dome);
  p.ellipse(52, 9, 20, 15, domeLight);
  p.rect(70, 0, 4, 8, gold);
  p.px(71, 0, '#fff8c0');
  // "P" crest above the gate.
  p.rect(66, 58, 12, 12, '#c03838');
  p.rect(69, 60, 2, 8, gold); p.rect(71, 60, 4, 2, gold); p.rect(73, 62, 2, 2, gold); p.rect(71, 64, 4, 2, gold);
  // Gate.
  p.ellipse(60, 70, 24, 16, '#6a4424');
  p.rect(60, 78, 24, 22, '#6a4424');
  p.rect(63, 80, 18, 20, '#3a2410');
  p.ellipse(63, 74, 18, 12, '#3a2410');
  for (let i = 0; i < 3; i++) p.px(66 + i * 6, 88, gold);
  // Plinth.
  p.rect(0, 100, 144, 12, '#b89060');
  p.hline(0, 100, 144, '#d0a878');
  p.rect(56, 100, 32, 12, '#a88050');
  return { bmp: finishProp(p), solid: { x: 4, y: 60, w: 136, h: 50 } };
});

registerProp('eb_gravityConsole', () => {
  const p = new Painter(24, 36);
  p.ellipse(0, 26, 24, 10, '#505868');
  p.ellipse(1, 26, 22, 8, '#687080');
  p.rect(6, 10, 12, 20, '#a0a8b8');
  p.vline(6, 10, 20, '#c0c8d8');
  p.vline(17, 10, 20, '#707890');
  p.rect(2, 2, 20, 11, '#384050');
  p.rect(4, 4, 16, 7, '#30c060');
  p.hline(5, 6, 6, '#a0ffb0');
  p.hline(5, 8, 9, '#80f0a0');
  p.px(8, 17, '#f04040'); p.px(12, 17, '#f0d040'); p.px(15, 17, '#40a0f0');
  p.rect(8, 21, 8, 3, '#e8e8f0');
  p.px(11, 22, '#f04040');
  return { bmp: finishProp(p), solid: { x: 2, y: 25, w: 20, h: 10 } };
});

registerProp('eb_snowPine', () => {
  const p = new Painter(24, 40);
  p.rect(10, 30, 4, 8, '#5c3c20');
  for (let i = 0; i < 4; i++) {
    const w = 8 + i * 4;
    const y = 2 + i * 7;
    for (let j = 0; j < 9; j++) {
      const ww = Math.round((w * j) / 9);
      p.hline(12 - (ww >> 1), y + j, ww, j < 3 ? '#f0f4f8' : j < 5 ? '#c8dce8' : '#2c6448');
    }
  }
  p.px(12, 1, '#ffffff');
  return { bmp: finishProp(p), solid: { x: 8, y: 30, w: 8, h: 8 } };
});

registerProp('eb_iceSpire', () => {
  const p = new Painter(20, 30);
  const tri = (x: number, w: number, top: number, col: string) => {
    for (let y = top; y < 28; y++) {
      const ww = Math.max(1, Math.round(((y - top) / (28 - top)) * w));
      p.hline(x + ((w - ww) >> 1), y, ww, col);
    }
  };
  tri(0, 10, 10, '#98c8e8');
  tri(8, 12, 0, '#b8dcf4');
  tri(4, 8, 14, '#d8f0ff');
  p.vline(14, 4, 20, '#f0faff');
  p.rect(1, 26, 18, 3, '#88b0d0');
  return { bmp: finishProp(p), solid: { x: 2, y: 22, w: 16, h: 7 } };
});
