import { finishProp, registerProp } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';
import { registerScanAliases } from '../../scans';

/**
 * Art for the two late Days of Peace episodes (anime eps 68 and 70): "Whose Wish?" (Goku's heat suit, Bulma's secret
 * project on the Capsule Corp pad, the drill pod, the Earth's core and its wildlife) and the Universe 6 vs.
 * Universe 7 baseball game (Yamcha's uniform, the ballpark's bases, chalk, dugouts and a scoreboard that keeps the
 * real score).
 */

const SKIN = '#f8c890';

registerCast({
  // Bulma's heat suit: a silver insulated suit with a domed visor (the anime's special suit for the core).
  c12_heatSuit: { body: 'male', skin: SKIN, hair: 'helmet', hairColor: '#c8d0d8', accent: '#80d8f8', top: '#d8dce4', topStyle: 'suit', under: '#a8b0bc', sleeves: 'long', belt: '#f08020', pants: '#d8dce4', boots: '#f08020', wrist: '#f08020', emblem: '#3060c0' },
  // Yamcha in his old pro uniform: the only player on Universe 7 who knows the rules.
  c12_yamchaBall: { body: 'male', skin: SKIN, hair: 'cap', hairColor: '#202030', accent: '#283878', top: '#f4f4f0', topStyle: 'shirt', under: '#283878', sleeves: 'short', belt: '#202020', pants: '#f4f4f0', boots: '#283878', bootTrim: '#f4f4f0', emblem: '#d03030' },
}, {
  c12_heatSuit: 'Goku', c12_yamchaBall: 'Yamcha',
});

// Outfits file under the character wearing them.
registerScanAliases({ c12_heatSuit: 'goku', c12_yamchaBall: 'yamcha' });

registerCreatures({
  // The Earth's core: things that live in molten rock.
  c12_magmaSlime: { kind: 'blob', body: '#e86020', accent: '#f8d048', size: 24 },
  c12_cinderBat: { kind: 'bat', body: '#5a2a24', eye: '#f8c840', size: 24 },
  c12_crustCrab: { kind: 'crab', body: '#7a4a38', accent: '#f08028', size: 32 },
  c12_lavaSerpent: { kind: 'snake', body: '#c84a18', belly: '#f8c048', accent: '#5a1a08', size: 32 },
  c12_mantleWyrm: { kind: 'snake', body: '#9a2810', belly: '#f8d050', accent: '#3a0c04', eye: '#f8f8a0', size: 48 },
});

// ---------------------------------------------------------------- Capsule Corp pad: Bulma's secret project

/** Bulma's secret project under a tarp on the old time machine pad, with a hand-painted KEEP OUT board. */
registerProp('c12_secretProject', () => {
  const p = new Painter(48, 40);
  // Landing struts poking out under the tarp.
  p.rect(7, 30, 3, 8, '#707880'); p.rect(38, 30, 3, 8, '#707880');
  p.rect(5, 36, 7, 2, '#505860'); p.rect(36, 36, 7, 2, '#505860');
  // The tarp: a lumpy dome with folds and rope ties.
  p.ellipse(4, 6, 40, 30, '#4a6878');
  p.ellipse(6, 7, 34, 22, '#5a7c8c');
  p.ellipse(12, 9, 12, 8, '#6c90a0');
  for (let i = 0; i < 5; i++) p.line(10 + i * 7, 12, 8 + i * 8, 32, '#3e5a68');
  p.hline(6, 24, 36, '#c8a060'); p.hline(8, 18, 32, '#c8a060');
  // The time machine's dome still shows through a gap in the tarp (the anime's tell).
  p.ellipse(28, 10, 10, 6, '#c8d8e0'); p.ellipse(30, 11, 5, 3, '#f0f8ff');
  // KEEP OUT board on a stake.
  p.vline(3, 20, 18, '#806040');
  p.rect(0, 16, 14, 8, '#f0e0b0'); p.rect(0, 16, 14, 1, '#c0a070');
  p.hline(2, 18, 9, '#d03030'); p.hline(2, 21, 7, '#d03030');
  // Toolbox.
  p.rect(36, 32, 10, 6, '#d03030'); p.rect(38, 30, 6, 2, '#a02020');
  return { bmp: finishProp(p), solid: { x: 4, y: 20, w: 42, h: 18 } };
});

/** Bulma's drill pod: a capsule on legs with a diamond drill bit for a nose. */
registerProp('c12_drillPod', () => {
  const p = new Painter(26, 38);
  // Legs.
  p.line(4, 26, 1, 36, '#606870'); p.line(21, 26, 24, 36, '#606870');
  p.rect(0, 35, 4, 2, '#404850'); p.rect(22, 35, 4, 2, '#404850');
  // Body.
  p.ellipse(3, 2, 20, 26, '#e8ecf0');
  p.ellipse(5, 3, 12, 20, '#f8fcff');
  p.rect(3, 14, 20, 3, '#3060c0');
  // Porthole and the Capsule Corp mark.
  p.ellipse(8, 5, 9, 8, '#405060'); p.ellipse(9, 6, 7, 6, '#80d0f0'); p.px(10, 7, '#ffffff');
  p.rect(10, 19, 6, 4, '#3060c0'); p.px(12, 20, '#f8fcff'); p.px(13, 21, '#f8fcff');
  // Drill bit pointing into the ground.
  p.line(9, 28, 13, 36, '#b8b0a0'); p.line(17, 28, 13, 36, '#b8b0a0');
  p.rect(10, 28, 7, 3, '#d8d0c0'); p.rect(11, 31, 5, 3, '#c8c0b0'); p.rect(12, 34, 3, 2, '#a8a090');
  p.line(10, 29, 16, 33, '#787060');
  return { bmp: finishProp(p), solid: { x: 2, y: 24, w: 22, h: 12 } };
});

/** What Beerus leaves of the secret project: a scorched crater with a few bent struts (walk-through). */
registerProp('c12_labCrater', () => {
  const p = new Painter(64, 44);
  p.ellipse(0, 4, 64, 38, '#3a3430');
  p.ellipse(5, 8, 54, 30, '#2a2420');
  p.ellipse(14, 14, 36, 18, '#1c1814');
  for (let i = 0; i < 14; i++) p.px(6 + ((i * 37) % 52), 8 + ((i * 23) % 28), i % 3 ? '#605850' : '#a09080');
  p.line(18, 20, 26, 14, '#707880'); p.line(40, 26, 47, 19, '#707880'); p.line(30, 30, 31, 22, '#606870');
  p.rect(24, 24, 6, 3, '#4a6878'); p.rect(38, 13, 5, 2, '#4a6878');
  return { bmp: p.done(), solid: null, flat: true };
});

// ---------------------------------------------------------------- the Earth's core

/** A cooling vent: Bulma's coolant line surfaces here and refills the heat suit (walk-through). */
registerProp('c12_coolVent', () => {
  const p = new Painter(16, 16);
  p.ellipse(0, 1, 16, 14, '#384858');
  p.ellipse(2, 3, 12, 10, '#80d8f8');
  for (let i = 0; i < 4; i++) p.hline(3, 5 + i * 2, 10, '#2a3a48');
  p.px(5, 4, '#f0ffff'); p.px(11, 12, '#f0ffff');
  return { bmp: p.done(), solid: null, flat: true };
});

/** Glowing cracks in the volcanic floor (walk-through). */
registerProp('c12_emberCrack', () => {
  const p = new Painter(32, 16);
  p.line(0, 9, 8, 6, '#f88020'); p.line(8, 6, 15, 10, '#f88020'); p.line(15, 10, 24, 4, '#f88020'); p.line(24, 4, 31, 7, '#f88020');
  p.line(12, 8, 13, 15, '#f8c040'); p.line(20, 7, 26, 13, '#f8c040');
  p.px(8, 6, '#fff0a0'); p.px(24, 4, '#fff0a0');
  return { bmp: p.done(), solid: null, flat: true };
});

/** A cluster of hexagonal basalt columns. */
registerProp('c12_basalt', () => {
  const p = new Painter(22, 34);
  const cols: Array<[number, number, number]> = [[1, 10, 22], [7, 2, 30], [13, 6, 26], [17, 14, 18]];
  for (const [x, y, h] of cols) {
    p.rect(x, y, 5, h, '#3c3434');
    p.rect(x, y, 5, 2, '#5c5050');
    p.vline(x + 4, y + 2, h - 2, '#2a2424');
  }
  p.hline(0, 32, 22, '#2a2424');
  return { bmp: finishProp(p), solid: { x: 1, y: 24, w: 20, h: 9 } };
});

/** The core alloy: a crystal of metal grown in the planet's heart, pulsing gold and violet. */
registerProp('c12_coreCrystal', () => {
  const p = new Painter(40, 50);
  p.ellipse(2, 36, 36, 13, '#3c3434'); p.ellipse(4, 37, 32, 9, '#5c5050');
  const shards: Array<[number, number, number, number]> = [[16, 2, 8, 40], [8, 14, 7, 28], [25, 10, 7, 32], [3, 26, 6, 16], [31, 24, 6, 18]];
  for (const [x, y, w, h] of shards) {
    p.rect(x, y + 4, w, h - 4, '#b878e0');
    p.line(x, y + 4, x + Math.floor(w / 2), y, '#d8a8f8'); p.line(x + w - 1, y + 4, x + Math.floor(w / 2), y, '#d8a8f8');
    p.vline(x + 1, y + 5, h - 8, '#f0d8ff');
    p.vline(x + w - 2, y + 6, h - 8, '#8048b0');
  }
  p.rect(18, 20, 4, 10, '#f8e070'); p.px(19, 22, '#ffffff');
  return { bmp: finishProp(p), solid: { x: 4, y: 38, w: 32, h: 10 } };
});

/** The crystal's broken base once the alloy has been cut out (walk-through). */
registerProp('c12_coreStump', () => {
  const p = new Painter(40, 16);
  p.ellipse(2, 2, 36, 13, '#3c3434'); p.ellipse(4, 3, 32, 9, '#5c5050');
  p.rect(12, 4, 4, 4, '#8048b0'); p.rect(22, 5, 5, 3, '#8048b0'); p.px(14, 5, '#d8a8f8');
  return { bmp: p.done(), solid: null, flat: true };
});

// ---------------------------------------------------------------- the ballpark

/** 3x5 pixel digits for the scoreboard. */
const DIGITS: Record<string, string[]> = {
  0: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], 1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'], 2: ['xxx', '..x', 'xxx', 'x..', 'xxx'],
  3: ['xxx', '..x', '.xx', '..x', 'xxx'], 4: ['x.x', 'x.x', 'xxx', '..x', '..x'], 5: ['xxx', 'x..', 'xxx', '..x', 'xxx'],
  6: ['xxx', 'x..', 'xxx', 'x.x', 'xxx'], 7: ['xxx', '..x', '.x.', '.x.', '.x.'], 8: ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
  9: ['xxx', 'x.x', 'xxx', '..x', 'xxx'], U: ['x.x', 'x.x', 'x.x', 'x.x', 'xxx'],
};

/** Draw a short label in the 3x5 scoreboard font, `scale` px per dot. */
function sbText(p: Painter, text: string, x: number, y: number, color: string, scale = 2): void {
  [...text].forEach((ch, i) => {
    const g = DIGITS[ch];
    if (!g) return;
    g.forEach((row, ry) => [...row].forEach((c, rx) => {
      if (c === 'x') p.rect(x + i * 4 * scale + rx * scale, y + ry * scale, scale, scale, color);
    }));
  });
}

/**
 * The centre-field scoreboard, one prop kind per state (`c12_board_<U6 runs>_<U7 runs>_<outs>`), so the game swaps
 * it as the score changes. Each bitmap is only drawn the first time that state is shown.
 */
for (let u6 = 0; u6 <= 9; u6++) {
  for (let u7 = 0; u7 <= 9; u7++) {
    for (let outs = 0; outs <= 3; outs++) {
      registerProp(`c12_board_${u6}_${u7}_${outs}`, () => {
        const p = new Painter(112, 56);
        p.rect(50, 40, 4, 16, '#505860'); p.rect(58, 40, 4, 16, '#505860');
        p.rect(0, 0, 112, 42, '#1c3a2c'); p.rect(0, 0, 112, 3, '#2c5a44'); p.rect(2, 4, 108, 36, '#102018');
        // Team rows: U6 (Champa's purple) over U7 (Beerus's red), runs on the right.
        p.rect(4, 7, 4, 10, '#8078c0'); sbText(p, 'U6', 12, 8, '#f0f0f0');
        p.rect(4, 22, 4, 10, '#c83838'); sbText(p, 'U7', 12, 23, '#f0f0f0');
        for (let inn = 0; inn < 8; inn++) {
          p.rect(36 + inn * 6, 9, 4, 6, '#2a4a3a'); p.rect(36 + inn * 6, 24, 4, 6, '#2a4a3a');
        }
        sbText(p, String(u6), 90, 8, '#f8e060');
        sbText(p, String(u7), 90, 23, '#f8e060');
        // Inning 9 and the outs lights.
        sbText(p, '9', 36, 34, '#f0f0f0', 1);
        for (let i = 0; i < 3; i++) p.rect(46 + i * 6, 35, 4, 4, i < outs ? '#f84040' : '#402020');
        return { bmp: finishProp(p), solid: null };
      });
    }
  }
}

/** A stretch of packed bleachers (drawn over the stand's wall tiles). */
registerProp('c12_bleachers', () => {
  const p = new Painter(80, 30);
  for (let r = 0; r < 3; r++) {
    p.rect(0, 6 + r * 8, 80, 2, '#a8a8b0');
    p.rect(0, 8 + r * 8, 80, 6, '#6a6a78');
  }
  const shirts = ['#d03030', '#3060c0', '#f0c030', '#40a048', '#f0f0f0', '#c060c0', '#f08030', '#8078c0'];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 13; i++) {
      const x = 2 + i * 6 + (r % 2) * 3;
      const y = 2 + r * 8;
      p.rect(x, y + 3, 4, 4, shirts[(i * 3 + r * 5) % shirts.length]);
      p.rect(x + 1, y, 2, 3, (i + r) % 4 === 0 ? '#e8b078' : '#f8c890');
      p.px(x + 1, y, (i + r) % 3 ? '#302018' : '#c8a040');
    }
  }
  return { bmp: p.done(), solid: null };
});

/** Base bag (walk-through). */
registerProp('c12_base', () => {
  const p = new Painter(16, 16);
  p.rect(3, 4, 10, 9, '#a8a8a0'); p.rect(3, 3, 10, 9, '#f8f8f0'); p.hline(4, 4, 8, '#ffffff');
  return { bmp: p.done(), solid: null, flat: true };
});

/** Home plate and the chalk batter's boxes either side (walk-through). */
registerProp('c12_homePlate', () => {
  const p = new Painter(48, 24);
  p.rect(2, 2, 12, 20, '#f0f0e8'); p.rect(3, 3, 10, 18, '#c8a070');
  p.rect(34, 2, 12, 20, '#f0f0e8'); p.rect(35, 3, 10, 18, '#c8a070');
  p.rows(19, 7, ['xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', '.xxxxxxxx.', '..xxxxxx..', '...xxxx...'], { x: '#f8f8f0' });
  return { bmp: p.done(), solid: null, flat: true };
});

/** The pitcher's rubber on the mound (walk-through). */
registerProp('c12_rubber', () => {
  const p = new Painter(16, 8);
  p.rect(2, 2, 12, 4, '#f8f8f0'); p.hline(2, 5, 12, '#c0c0b8');
  return { bmp: p.done(), solid: null, flat: true };
});

/** Chalk foul lines, one 16px step each: towards the top-left (`L`) and the top-right (`R`) (walk-through). */
registerProp('c12_chalkL', () => {
  const p = new Painter(16, 16);
  for (let i = 0; i < 16; i++) { p.px(15 - i, 15 - i, '#f8f8f0'); if (i < 15) p.px(14 - i, 15 - i, '#e8e8e0'); }
  return { bmp: p.done(), solid: null, flat: true };
});
registerProp('c12_chalkR', () => {
  const p = new Painter(16, 16);
  for (let i = 0; i < 16; i++) { p.px(i, 15 - i, '#f8f8f0'); if (i < 15) p.px(i + 1, 15 - i, '#e8e8e0'); }
  return { bmp: p.done(), solid: null, flat: true };
});

/** A dugout bench with a bat rack and a ball bucket. */
registerProp('c12_bench', () => {
  const p = new Painter(56, 20);
  p.rect(0, 6, 56, 5, '#a07040'); p.rect(0, 6, 56, 1, '#c09060');
  p.rect(2, 11, 3, 7, '#704820'); p.rect(51, 11, 3, 7, '#704820'); p.rect(27, 11, 3, 7, '#704820');
  for (let i = 0; i < 4; i++) p.line(8 + i * 3, 0, 9 + i * 3, 6, '#c89858');
  p.rect(40, 1, 9, 6, '#606870'); p.px(42, 2, '#f8f8f0'); p.px(45, 3, '#f8f8f0'); p.px(43, 4, '#f8f8f0');
  return { bmp: finishProp(p), solid: { x: 0, y: 8, w: 56, h: 10 } };
});

/** The yellow foul pole at the end of each line. */
registerProp('c12_foulPole', () => {
  const p = new Painter(8, 56);
  p.rect(3, 0, 3, 52, '#f0d030'); p.vline(3, 0, 52, '#f8f080'); p.rect(0, 50, 8, 6, '#707070');
  return { bmp: finishProp(p), solid: { x: 0, y: 50, w: 8, h: 6 } };
});

/** The chain-link backstop behind home plate (drawn over the stand's wall tiles). */
registerProp('c12_backstop', () => {
  const p = new Painter(96, 40);
  p.rect(0, 0, 3, 40, '#606870'); p.rect(46, 0, 3, 40, '#606870'); p.rect(93, 0, 3, 40, '#606870');
  p.hline(0, 0, 96, '#808890');
  for (let x = 3; x < 93; x += 4) for (let y = 2; y < 38; y += 4) { p.px(x, y, '#9098a0'); p.px(x + 2, y + 2, '#9098a0'); }
  return { bmp: p.done(), solid: null };
});

/** Where a fly ball is coming down: a dashed yellow-and-white ring the fielder runs to (walk-through, placed at runtime). */
registerProp('c12_ballMark', () => {
  const p = new Painter(20, 12);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    p.px(Math.round(10 + Math.cos(a) * 9), Math.round(6 + Math.sin(a) * 5), i % 6 < 4 ? '#f8e060' : '#f8f8f0');
  }
  p.rect(9, 5, 2, 2, '#f8f8f0');
  return { bmp: p.done(), solid: null, flat: true };
});
