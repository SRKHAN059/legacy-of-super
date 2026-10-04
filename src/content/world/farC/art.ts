import { finishProp, registerProp } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCreatures } from '../../creatures';

/**
 * Custom landmark props and creature sprites for the far regions (Future Earth, space, Hell, Tournament of Power).
 * Sizes (px) and solid footprints are listed so map authors can place them on the tile grid.
 */

/** Erase an elliptical area (transparent pixels) — used to bite chunks out of ruined shapes. */
function carve(p: Painter, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2 - 0.5;
  const cy = y + h / 2 - 0.5;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = (x + i - cx) / (w / 2);
      const dy = (y + j - cy) / (h / 2);
      if (dx * dx + dy * dy <= 1) p.px(x + i, y + j, null);
    }
  }
}

/** Deterministic 0..1 noise for pixel art details. */
function n01(i: number, s: number): number {
  let h = (i * 374761393 + s * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruined Capsule Corporation dome, 112x80 (7x5 tiles). Solid base 104x38 at (4,40). */
registerProp('fc_ccRuins', () => {
  const p = new Painter(112, 80);
  p.ellipse(4, 2, 104, 66, '#b8b4a8');
  p.ellipse(10, 5, 58, 26, '#c8c4b8');
  p.rect(4, 38, 104, 40, '#b0aca0');
  p.hline(4, 48, 104, '#94908a');
  // Exposed, burnt interior where the top-right of the dome caved in.
  p.ellipse(56, 2, 50, 38, '#3c3630');
  p.ellipse(62, 10, 36, 24, '#2a2622');
  carve(p, 62, -10, 48, 30);
  for (let i = 0; i < 24; i++) carve(p, 58 + Math.round(n01(i, 3) * 46), 10 + Math.round(n01(i, 4) * 10) - 6, 4, 4);
  // Twisted girders sticking out of the hole.
  p.line(70, 22, 64, 6, '#6c6458'); p.line(84, 20, 88, 4, '#6c6458'); p.line(96, 26, 104, 12, '#6c6458');
  // Faded "CC" panel.
  p.rect(30, 26, 32, 9, '#5a6a88');
  p.rect(34, 27, 4, 7, '#c8c4b8'); p.rect(35, 28, 3, 5, '#5a6a88');
  p.rect(42, 27, 4, 7, '#c8c4b8'); p.rect(43, 28, 3, 5, '#5a6a88');
  // Boarded-up main door.
  p.rect(46, 56, 20, 22, '#2c3440');
  p.line(46, 60, 65, 66, '#806040'); p.line(46, 70, 65, 64, '#806040');
  // Broken windows.
  for (let i = 0; i < 4; i++) {
    p.rect(10 + i * 9, 54, 6, 8, '#282830');
    p.rect(72 + i * 9, 54, 6, 8, i % 2 ? '#282830' : '#6890a8');
  }
  // Cracks and scorch.
  p.line(20, 40, 28, 62, '#7c786c'); p.line(28, 62, 24, 74, '#7c786c'); p.line(92, 44, 86, 70, '#7c786c');
  p.speckle(4, 30, 104, 48, ['#5c5650', '#8c8678'], 0.08, 77);
  // Rubble spilling from the base.
  p.ellipse(0, 70, 16, 10, '#787068'); p.ellipse(94, 68, 18, 12, '#686058'); p.ellipse(104, 66, 8, 8, '#908880');
  return { bmp: finishProp(p), solid: { x: 4, y: 40, w: 104, h: 38 } };
});

/** Frieza's golden cocoon in Hell, 40x52 (2.5x3.25 tiles). Solid 28x14 at (6,36). */
registerProp('fc_cocoon', () => {
  const p = new Painter(40, 52);
  p.ellipse(2, 40, 36, 12, '#6a3018');
  p.rect(8, 40, 24, 6, '#804020');
  p.ellipse(4, 2, 32, 44, '#c89818');
  p.ellipse(6, 3, 28, 40, '#e0b028');
  p.ellipse(9, 5, 18, 30, '#f0c838');
  p.ellipse(11, 8, 7, 12, '#fff0a0');
  for (let i = 0; i < 6; i++) {
    const y = 10 + i * 6;
    for (let x = 6; x < 34; x++) if (p.has(x, y) && (x + i) % 3) p.px(x, y + Math.round(Math.sin(x / 4 + i) * 1), '#b08010');
  }
  p.px(14, 4, '#ffffff'); p.px(30, 14, '#ffffff'); p.px(8, 26, '#ffffff'); p.px(26, 34, '#ffffff');
  return { bmp: finishProp(p), solid: { x: 6, y: 36, w: 28, h: 14 } };
});

/** Dithered smoke plume rising from wreckage, 24x44. Walk-through. */
registerProp('fc_smoke', () => {
  const p = new Painter(24, 44);
  for (let y = 0; y < 44; y++) {
    const w = 4 + Math.round((44 - y) / 6) + Math.round(Math.sin(y / 5) * 2);
    const cx = 12 + Math.round(Math.sin(y / 7) * 3);
    for (let x = cx - w; x <= cx + w; x++) {
      if ((x + y) % 2) continue;
      if (n01(x * 64 + y, 9) < 0.2) continue;
      p.px(x, y, y > 30 ? '#2c282c' : y > 16 ? '#48444a' : '#686470');
    }
  }
  return { bmp: p.done(), solid: null };
});

/** Burnt-out car wreck, 32x18 (2x1 tiles). Solid like the car prop. */
registerProp('fc_wreck', () => {
  const p = new Painter(32, 18);
  p.rect(1, 6, 30, 9, '#5a4a40');
  p.rect(7, 2, 16, 6, '#4a3c34');
  p.rect(9, 3, 5, 3, '#202020'); p.rect(16, 3, 5, 3, '#202020'); p.px(17, 4, '#6890a8');
  p.ellipse(3, 12, 6, 6, '#1a1a1a'); p.ellipse(23, 12, 6, 6, '#1a1a1a');
  p.rect(1, 6, 30, 1, '#6c5a4c');
  p.px(5, 9, '#8a5030'); p.px(6, 10, '#8a5030'); p.px(19, 8, '#8a5030'); p.px(27, 11, '#8a5030'); p.px(12, 12, '#8a5030');
  return { bmp: finishProp(p), solid: { x: 1, y: 6, w: 30, h: 11 } };
});

/** Two-tier bunk bed, 22x36. Solid 22x28 at (0,8). */
registerProp('fc_bunk', () => {
  const p = new Painter(22, 36);
  p.rect(0, 0, 22, 36, '#6a5a48');
  p.rect(2, 2, 18, 12, '#d8d0c0'); p.rect(2, 6, 18, 8, '#607050'); p.rect(3, 3, 7, 3, '#f0ece0');
  p.rect(2, 20, 18, 12, '#d8d0c0'); p.rect(2, 24, 18, 8, '#806048'); p.rect(3, 21, 7, 3, '#f0ece0');
  p.rect(0, 15, 22, 3, '#58483a');
  return { bmp: finishProp(p), solid: { x: 0, y: 8, w: 22, h: 28 } };
});

/** Lab console with two monitors, 32x28 (2 tiles wide). Solid 32x16 at (0,12). */
registerProp('fc_console', () => {
  const p = new Painter(32, 28);
  p.rect(0, 13, 32, 15, '#606878'); p.rect(0, 13, 32, 2, '#7a8290');
  p.rect(1, 0, 13, 12, '#303840'); p.rect(2, 1, 11, 9, '#184028');
  for (let i = 0; i < 4; i++) p.hline(3, 2 + i * 2, 4 + ((i * 3) % 6), '#40c080');
  p.rect(18, 0, 13, 12, '#303840'); p.rect(19, 1, 11, 9, '#183050');
  p.line(20, 8, 23, 4, '#4080d0'); p.line(23, 4, 26, 7, '#4080d0'); p.line(26, 7, 29, 2, '#4080d0');
  p.rect(6, 16, 20, 3, '#404850');
  p.px(3, 22, '#f04040'); p.px(6, 22, '#40f040'); p.px(9, 22, '#f0d040');
  return { bmp: finishProp(p), solid: { x: 0, y: 12, w: 32, h: 16 } };
});

/** The Kais' Potara fruit tree, 36x48. Solid 12x8 at (12,38). */
registerProp('fc_potaraTree', () => {
  const p = new Painter(36, 48);
  p.rect(15, 24, 6, 22, '#8a6a48'); p.vline(15, 24, 22, '#6a4c30');
  p.rect(11, 44, 14, 2, '#6a4c30');
  p.ellipse(1, 1, 34, 28, '#2c8048');
  p.ellipse(3, 1, 30, 24, '#3c9c58');
  p.ellipse(7, 3, 14, 10, '#60c078');
  const ear = (x: number, y: number) => {
    p.px(x, y, '#f0d830'); p.px(x + 1, y, '#f0d830'); p.px(x - 1, y + 1, '#f0d830'); p.px(x + 2, y + 1, '#f0d830');
    p.px(x, y + 2, '#f0d830'); p.px(x + 1, y + 2, '#f0d830'); p.px(x, y + 3, '#50c050'); p.px(x + 1, y + 3, '#50c050');
  };
  ear(7, 18); ear(26, 16); ear(15, 22); ear(21, 8); ear(9, 9);
  return { bmp: finishProp(p), solid: { x: 12, y: 38, w: 12, h: 8 } };
});

/** Lord Beerus's enormous bed, 48x36 (3 tiles wide). Solid 48x30 at (0,4). */
registerProp('fc_godBed', () => {
  const p = new Painter(48, 36);
  p.rect(0, 0, 48, 36, '#5a3a78');
  p.rect(0, 0, 48, 8, '#4a2c66'); p.hline(0, 1, 48, '#e0b840'); p.hline(0, 7, 48, '#e0b840');
  p.rect(3, 9, 18, 7, '#f0e8f8'); p.rect(27, 9, 18, 7, '#f0e8f8');
  p.rect(3, 16, 42, 18, '#8050b8'); p.rect(3, 16, 42, 2, '#a070d8');
  for (let i = 0; i < 5; i++) p.px(8 + i * 8, 24, '#e0b840');
  return { bmp: finishProp(p), solid: { x: 0, y: 4, w: 48, h: 30 } };
});

/** The Tournament of Power's central spire, 32x80. Solid 24x16 at (4,62). */
registerProp('fc_topSpire', () => {
  const p = new Painter(32, 80);
  p.rect(6, 12, 20, 66, '#9098a8');
  p.vline(6, 12, 66, '#7880a0'); p.vline(25, 12, 66, '#b0b8c8');
  for (let i = 0; i < 6; i++) p.rect(10, 18 + i * 10, 12, 6, '#687088');
  p.rect(2, 62, 28, 16, '#8088a0'); p.rect(2, 62, 28, 2, '#a8b0c0');
  p.rect(4, 6, 24, 8, '#a0a8b8');
  p.line(4, 6, 10, 0, '#a0a8b8'); p.line(27, 6, 22, 1, '#a0a8b8');
  p.hline(6, 40, 20, '#60d0f0'); p.hline(6, 41, 20, '#a0f0ff');
  return { bmp: finishProp(p), solid: { x: 4, y: 62, w: 24, h: 16 } };
});

/** Resistance hideout hatch: a camouflaged stairwell, 32x24 flat decor (walk onto it). */
registerProp('fc_hatch', () => {
  const p = new Painter(32, 24);
  p.rect(0, 0, 32, 24, '#585e66');
  p.rect(3, 3, 26, 18, '#141414');
  for (let i = 0; i < 4; i++) p.hline(4, 6 + i * 4, 24, i % 2 ? '#3a3e44' : '#2c3036');
  for (let i = 0; i < 32; i += 4) { p.rect(i, 0, 2, 2, '#e0c030'); p.rect(i + 2, 22, 2, 2, '#e0c030'); }
  return { bmp: finishProp(p), solid: null, flat: true };
});

/** Faded yellow lane dash across a road tile (flat decor). `fc_laneV` is the vertical version. */
registerProp('fc_lane', () => {
  const p = new Painter(16, 16);
  p.rect(2, 7, 11, 2, '#c8b048');
  p.px(5, 7, '#8c8058'); p.px(10, 8, '#8c8058');
  return { bmp: p.done(), solid: null, flat: true };
});
registerProp('fc_laneV', () => {
  const p = new Painter(16, 16);
  p.rect(7, 2, 2, 11, '#c8b048');
  p.px(7, 5, '#8c8058'); p.px(8, 10, '#8c8058');
  return { bmp: p.done(), solid: null, flat: true };
});

/** A caved-in dome house (ruined suburb), 56x48. Solid like domeHouse: 52x26 at (2,20). */
registerProp('fc_ruinDome', () => {
  const p = new Painter(56, 48);
  p.ellipse(2, 4, 52, 42, '#a8a49c');
  p.ellipse(6, 6, 26, 16, '#b8b4ac');
  p.rect(2, 26, 52, 18, '#a09c94');
  p.hline(2, 30, 52, '#86827a');
  p.ellipse(26, 2, 26, 22, '#3a3430');
  carve(p, 30, -6, 24, 18);
  p.line(34, 12, 30, 2, '#6c6458'); p.line(44, 14, 48, 4, '#6c6458');
  p.rect(22, 30, 12, 15, '#3a3028');
  p.line(22, 34, 33, 40, '#7a5a38'); p.line(22, 41, 33, 36, '#7a5a38');
  p.rect(8, 22, 8, 6, '#2a2a30'); p.rect(40, 22, 8, 6, '#2a2a30');
  p.line(10, 24, 18, 44, '#7c786c');
  p.speckle(2, 20, 52, 26, ['#6c6860', '#8c887e'], 0.06, 31);
  return { bmp: finishProp(p), solid: { x: 2, y: 20, w: 52, h: 26 } };
});

/** A gutted skyscraper with a shattered crown, 40x80 (2.5x5 tiles). Solid 36x26 at (2,52). */
registerProp('fc_ruinTower', () => {
  const p = new Painter(40, 80);
  for (let x = 2; x < 38; x++) {
    const top = 6 + Math.round(Math.abs(Math.sin(x * 0.7)) * 10 + n01(x, 5) * 8);
    p.vline(x, top, 78 - top, x < 6 ? '#5c5c66' : '#70707a');
  }
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      const y = 24 + r * 8;
      const x = 7 + c * 8;
      if (!p.has(x, y - 2)) continue;
      const lit = n01(r * 4 + c, 12) < 0.12;
      p.rect(x, y, 5, 4, lit ? '#d08838' : '#202028');
    }
  }
  p.line(12, 18, 20, 52, '#55555e'); p.line(30, 14, 26, 40, '#55555e');
  p.rect(0, 72, 40, 8, '#686068');
  return { bmp: finishProp(p), solid: { x: 2, y: 52, w: 36, h: 26 } };
});

/** A low wall of sandbags (Resistance barricade), 32x16. Solid 32x9 at (0,6). */
registerProp('fc_sandbags', () => {
  const p = new Painter(32, 16);
  for (let i = 0; i < 4; i++) p.ellipse(i * 8, 8, 9, 7, i % 2 ? '#a89060' : '#b8a070');
  for (let i = 0; i < 3; i++) p.ellipse(4 + i * 8, 3, 9, 7, i % 2 ? '#b8a070' : '#c8b080');
  return { bmp: finishProp(p), solid: { x: 0, y: 6, w: 32, h: 9 } };
});

/** Gowasu's temple on the Sacred World of Universe 10, 80x64 (5x4 tiles). Solid 64x30 at (8,32); door at (32..48, 44..62). */
registerProp('fc_kaiTemple', () => {
  const p = new Painter(80, 64);
  p.rect(2, 56, 76, 8, '#d8d0e0'); p.hline(2, 56, 76, '#f0e8f8');
  p.rect(10, 30, 60, 27, '#f0e8d8'); p.hline(10, 30, 60, '#fff8e8');
  p.ellipse(12, 4, 56, 40, '#48a890');
  p.ellipse(16, 6, 30, 18, '#68c8a8');
  p.rect(38, 0, 4, 8, '#e8c040'); p.px(39, 0, '#fff0a0');
  p.rect(10, 28, 60, 4, '#c8a848');
  for (const x of [14, 24, 52, 62]) { p.rect(x, 32, 4, 24, '#ffffff'); p.vline(x + 3, 32, 24, '#d8d0c8'); }
  p.rect(33, 40, 14, 17, '#584878'); p.rect(34, 41, 12, 16, '#6a5a90');
  p.ellipse(34, 36, 12, 8, '#584878');
  p.px(44, 49, '#e8c040');
  return { bmp: finishProp(p), solid: { x: 8, y: 32, w: 64, h: 30 } };
});

/** A faint golden glyph set into the floor of Zeno's palace (flat decor), 32x32. */
registerProp('fc_glowTile', () => {
  const p = new Painter(32, 32);
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    p.px(16 + Math.round(Math.cos(t) * 12), 16 + Math.round(Math.sin(t) * 12), a % 2 ? '#f0d890' : '#e8c870');
  }
  p.rect(15, 6, 2, 20, '#f0e0a8'); p.rect(6, 15, 20, 2, '#f0e0a8');
  p.px(16, 16, '#fff8d0');
  return { bmp: p.done(), solid: null, flat: true };
});

/** One of the dancing stuffed animals that "torment" Frieza in Hell, 16x18. Tiny solid at the feet. */
registerProp('fc_teddy', () => {
  const p = new Painter(16, 18);
  p.ellipse(2, 0, 5, 5, '#a86838'); p.ellipse(9, 0, 5, 5, '#a86838');
  p.ellipse(3, 1, 10, 9, '#c07c44');
  p.ellipse(4, 9, 8, 8, '#c07c44'); p.ellipse(6, 11, 4, 4, '#f0c890');
  p.rect(3, 15, 3, 3, '#a86838'); p.rect(10, 15, 3, 3, '#a86838');
  p.px(6, 4, '#201010'); p.px(9, 4, '#201010'); p.px(7, 6, '#402010'); p.px(8, 6, '#402010');
  p.rect(5, 8, 6, 1, '#e04060');
  return { bmp: finishProp(p), solid: { x: 3, y: 13, w: 10, h: 5 } };
});

registerCreatures({
  fc_scavDrone: { kind: 'drone', body: '#8c7a60', accent: '#f0a020', size: 24 },
  fc_scrapHound: { kind: 'quadruped', body: '#707880', belly: '#a0a8b0', eye: '#f04040', size: 32 },
  fc_hunterDrone: { kind: 'drone', body: '#403850', accent: '#c040f0', size: 24 },
  fc_ravager: { kind: 'robot', body: '#585048', accent: '#f06020', size: 40 },
  fc_puffbird: { kind: 'flyer', body: '#f0a0d0', belly: '#fff0f8', accent: '#f0d040', size: 24 },
  fc_mossBeast: { kind: 'quadruped', body: '#48a090', belly: '#a0e0c8', horns: true, size: 32 },
  fc_lakeCrab: { kind: 'crab', body: '#8050c0', size: 32 },
  fc_hornBeast: { kind: 'quadruped', body: '#7040a0', belly: '#c090e0', horns: true, size: 40 },
  fc_starWasp: { kind: 'bug', body: '#40c0e0', accent: '#202040', stripes: true, size: 24 },
  fc_hellBat: { kind: 'bat', body: '#601818', eye: '#f8f8f8', size: 32 },
  fc_lavaOoze: { kind: 'blob', body: '#e06020', size: 32 },
});
