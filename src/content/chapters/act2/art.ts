import { finishProp, registerProp, type PropArt } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';

/**
 * Act 2 (chapters 3-5) custom art: the Eternal Dragon, the vault puzzle pieces, Jaco's ship and
 * a handful of creatures. Sizes and solid footprints are noted so map scripts can place them on the grid.
 */

/** Deterministic 0..1 noise for small pixel details. */
function n01(i: number, s: number): number {
  let h = (i * 374761393 + s * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Shenron, the Eternal Dragon, coiling up into the sky: 112x128 (7x8 tiles). Walk-through apparition. */
registerProp('c03_shenron', () => {
  const p = new Painter(112, 128);
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = 56 + Math.sin(t * Math.PI * 3.2) * 34 * (1 - t * 0.35);
    const y = 122 - t * 92;
    const r = 4 + t * 5;
    pts.push([x, y, r]);
  }
  // Outline pass, body, belly highlight.
  for (const [x, y, r] of pts) p.ellipse(Math.round(x - r - 1), Math.round(y - r - 1), Math.round(r * 2 + 2), Math.round(r * 2 + 2), '#183818');
  for (const [x, y, r] of pts) p.ellipse(Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2), '#3c9a3c');
  for (const [x, y, r] of pts) p.ellipse(Math.round(x - r / 2), Math.round(y - r / 2 + 1), Math.max(2, Math.round(r)), Math.max(2, Math.round(r * 0.8)), '#a8d860');
  // Scale glints and back spines.
  pts.forEach(([x, y, r], i) => {
    if (i % 6 === 0) p.px(Math.round(x + r * 0.4), Math.round(y - r * 0.5), '#78c870');
    if (i % 8 === 0) { p.px(Math.round(x), Math.round(y - r - 2), '#e8d040'); p.px(Math.round(x), Math.round(y - r - 1), '#e8d040'); }
  });
  // Claws at three points along the body.
  for (const k of [30, 62, 92]) {
    const [x, y, r] = pts[k];
    p.line(Math.round(x + r), Math.round(y), Math.round(x + r + 6), Math.round(y + 4), '#2c7a2c');
    for (let c = 0; c < 3; c++) p.line(Math.round(x + r + 6), Math.round(y + 4), Math.round(x + r + 8 + c), Math.round(y + 7), '#f0f0e0');
  }
  // Head (top of the coil).
  const [hx, hy] = pts[pts.length - 1];
  const X = Math.round(hx);
  const Y = Math.round(hy);
  p.ellipse(X - 12, Y - 12, 26, 20, '#183818');
  p.ellipse(X - 11, Y - 11, 24, 18, '#3c9a3c');
  p.ellipse(X + 4, Y - 6, 18, 12, '#3c9a3c');
  p.ellipse(X + 6, Y - 3, 14, 7, '#a8d860');
  // Horns and mane.
  p.line(X - 6, Y - 10, X - 14, Y - 26, '#d8c890'); p.line(X - 5, Y - 10, X - 12, Y - 26, '#d8c890');
  p.line(X + 2, Y - 11, X + 0, Y - 27, '#d8c890'); p.line(X + 3, Y - 11, X + 2, Y - 27, '#d8c890');
  for (let i = 0; i < 6; i++) p.line(X - 10 + i * 2, Y + 4, X - 16 + i * 2, Y + 10 + (i % 2) * 3, '#2c6a2c');
  // Eyes (glowing red) and brow.
  p.rect(X - 2, Y - 6, 4, 3, '#f02020'); p.px(X - 1, Y - 6, '#ffd0d0');
  p.rect(X + 6, Y - 6, 4, 3, '#f02020'); p.px(X + 7, Y - 6, '#ffd0d0');
  p.hline(X - 3, Y - 8, 14, '#1c4c1c');
  // Fangs and whiskers.
  p.px(X + 12, Y + 2, '#ffffff'); p.px(X + 16, Y + 2, '#ffffff'); p.px(X + 12, Y + 3, '#ffffff');
  p.line(X + 18, Y - 2, X + 30, Y - 12, '#e8e0a0');
  p.line(X + 18, Y + 0, X + 32, Y + 4, '#e8e0a0');
  // Faint golden glow speckle around the dragon.
  for (let i = 0; i < 70; i++) {
    const x = Math.round(n01(i, 3) * 111);
    const y = Math.round(n01(i, 7) * 127);
    if (!p.has(x, y)) p.px(x, y, i % 3 ? '#f8f0a0' : '#ffffff');
  }
  return { bmp: p.done(), solid: null };
});

/** The seven Dragon Balls laid in a ring on the lawn, 40x24 flat decor. */
registerProp('c03_dbRing', () => {
  const p = new Painter(40, 24);
  const ring: Array<[number, number]> = [[17, 1], [28, 4], [33, 12], [25, 18], [9, 18], [1, 12], [6, 4]];
  for (const [x, y] of ring) {
    p.ellipse(x, y, 6, 6, '#b05010');
    p.ellipse(x, y, 5, 5, '#f89820');
    p.px(x + 1, y + 1, '#fff0c0');
    p.px(x + 3, y + 3, '#d02020');
  }
  return { bmp: p.done(), solid: null, flat: true };
});

/** Earth seen from orbit, 72x72 flat decor for the space clash. */
registerProp('c03_earth', () => {
  const p = new Painter(72, 72);
  p.ellipse(0, 0, 72, 72, '#a8d0ff');
  p.ellipse(2, 2, 68, 68, '#2868c0');
  p.ellipse(8, 6, 40, 34, '#3880d8');
  const land: Array<[number, number, number, number]> = [[12, 16, 22, 14], [30, 30, 18, 22], [44, 12, 16, 12], [20, 44, 14, 10], [50, 40, 10, 14]];
  for (const [x, y, w, h] of land) { p.ellipse(x, y, w, h, '#48a048'); p.ellipse(x + 2, y + 1, w - 6, h - 5, '#68b850'); }
  for (let i = 0; i < 40; i++) {
    const x = 4 + Math.round(n01(i, 11) * 64);
    const y = 4 + Math.round(n01(i, 12) * 64);
    if (p.has(x, y)) p.hline(x, y, 3 + (i % 4), '#f0f8ff');
  }
  p.ellipse(40, 40, 30, 30, '#1c4c98');
  return { bmp: p.done(), solid: null, flat: true };
});

/** Pilaf's vault statue with an engraved emblem, 24x40. Solid 20x9 at (2,30). */
function vaultStatue(kind: 'moon' | 'sun' | 'dragon' | 'pilaf'): () => PropArt {
  return () => {
    const p = new Painter(24, 40);
    p.rect(2, 30, 20, 9, '#6a6478');
    p.rect(2, 30, 20, 2, '#8a8498');
    p.rect(5, 6, 14, 25, '#8c88a0');
    p.vline(5, 6, 25, '#6c6880'); p.vline(18, 6, 25, '#aca8c0');
    p.ellipse(4, 0, 16, 10, '#8c88a0');
    // Emblem plate.
    p.ellipse(6, 10, 12, 12, '#3c3850');
    switch (kind) {
      case 'moon':
        p.ellipse(8, 12, 8, 8, '#f0e8a0'); p.ellipse(10, 11, 7, 7, '#3c3850');
        break;
      case 'sun':
        p.ellipse(9, 13, 6, 6, '#f8b030');
        for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, 3], [3, -3], [-3, 3]]) p.px(12 + dx, 16 + dy, '#f8d060');
        break;
      case 'dragon':
        p.line(8, 19, 11, 12, '#58c058'); p.line(11, 12, 15, 17, '#58c058'); p.line(15, 17, 16, 13, '#58c058');
        p.px(16, 12, '#f02020');
        break;
      case 'pilaf':
        // A tiny crowned face: Pilaf's ego, carved in stone.
        p.ellipse(9, 13, 7, 7, '#6880c0');
        p.px(10, 15, '#101010'); p.px(13, 15, '#101010');
        p.hline(9, 12, 7, '#f0c030'); p.px(9, 11, '#f0c030'); p.px(12, 10, '#f0c030'); p.px(15, 11, '#f0c030');
        break;
    }
    return { bmp: finishProp(p), solid: { x: 2, y: 30, w: 20, h: 9 } };
  };
}
registerProp('c03_statueMoon', vaultStatue('moon'));
registerProp('c03_statueSun', vaultStatue('sun'));
registerProp('c03_statueDragon', vaultStatue('dragon'));
registerProp('c03_statuePilaf', vaultStatue('pilaf'));

/** Wall lever, raised (12x16). Solid 10x6 at (1,10). */
registerProp('c03_leverUp', () => {
  const p = new Painter(12, 16);
  p.rect(1, 10, 10, 6, '#505868'); p.rect(1, 10, 10, 1, '#788090');
  p.line(6, 10, 3, 2, '#a0a0a8'); p.ellipse(1, 0, 5, 5, '#e03030');
  return { bmp: finishProp(p), solid: { x: 1, y: 10, w: 10, h: 6 } };
});

/** Wall lever, pulled (12x16). */
registerProp('c03_leverDown', () => {
  const p = new Painter(12, 16);
  p.rect(1, 10, 10, 6, '#505868'); p.rect(1, 10, 10, 1, '#788090');
  p.line(6, 11, 10, 6, '#a0a0a8'); p.ellipse(7, 3, 5, 5, '#40d040');
  return { bmp: finishProp(p), solid: { x: 1, y: 10, w: 10, h: 6 } };
});

/** Crowned vault pedestal holding a glowing ball, 20x22. Solid 16x8 at (2,14). */
registerProp('c03_pedestal', () => {
  const p = new Painter(20, 22);
  p.rect(2, 12, 16, 10, '#c8a040'); p.rect(2, 12, 16, 2, '#e8c860');
  p.rect(5, 8, 10, 5, '#a88030');
  p.hline(4, 7, 12, '#e8c860');
  return { bmp: finishProp(p), solid: { x: 2, y: 14, w: 16, h: 8 } };
});

/** Galactic Patrol cruiser (Jaco's ship), 48x32. Solid 40x14 at (4,16). */
registerProp('c05_jacoShip', () => {
  const p = new Painter(48, 32);
  p.ellipse(2, 10, 44, 18, '#e8e8f0');
  p.ellipse(4, 12, 40, 12, '#f8f8ff');
  p.rect(6, 20, 36, 4, '#c03030');
  p.ellipse(14, 2, 20, 14, '#80c8f0');
  p.ellipse(17, 4, 8, 5, '#d0f0ff');
  p.line(6, 26, 2, 31, '#808898'); p.line(41, 26, 45, 31, '#808898');
  p.rect(21, 22, 6, 3, '#f0d040');
  // Scorch from the crash landing.
  p.px(8, 16, '#404040'); p.px(9, 17, '#404040'); p.px(38, 15, '#404040'); p.px(37, 17, '#505050');
  return { bmp: finishProp(p), solid: { x: 4, y: 16, w: 40, h: 14 } };
});

/** A regeneration tank (Frieza's rebuild), 24x40. Solid 20x10 at (2,30). */
registerProp('c04_regenTank', () => {
  const p = new Painter(24, 40);
  p.rect(2, 30, 20, 10, '#606878'); p.rect(2, 30, 20, 2, '#808898');
  p.ellipse(3, 2, 18, 32, '#a0e0d0');
  p.ellipse(5, 4, 14, 28, '#70c8b8');
  for (let i = 0; i < 8; i++) p.px(7 + (i * 5) % 11, 26 - i * 3, '#e0fff8');
  p.rect(8, 0, 8, 3, '#606878');
  return { bmp: finishProp(p), solid: { x: 2, y: 30, w: 20, h: 10 } };
});

registerCreatures({
  /** Pilaf Machine Mk-II: the gang's upgraded battle suit. */
  c03_pilafMk2: { kind: 'robot', body: '#e8b830', accent: '#e03030', eye: '#40f0f0', size: 48 },
  /** A spoon-thieving puffbird from Beerus's planet. */
  c04_critter: { kind: 'flyer', body: '#f8a0c8', belly: '#fff0f8', accent: '#60d8f0', size: 24 },
  /** A puffbird chick from the training field: paler and fluffier than Beerus's grounds' grown-ups. */
  c04_puffChick: { kind: 'flyer', body: '#f8c8e0', belly: '#fffaf8', accent: '#f0d040', size: 24 },
  /** A hornless Moss Grazer calf, a size down from the herd on Beerus's grounds. */
  c04_mossCalf: { kind: 'quadruped', body: '#70c0a8', belly: '#c8f0dc', size: 24 },
  /** An invulnerable rolling beetle that patrols the training field. */
  c04_roller: { kind: 'bug', body: '#8058c0', accent: '#f0d850', horns: true, size: 32 },
  /** A stuffed toy bear from Hell's cheerful parade. */
  c04_teddy: { kind: 'quadruped', body: '#c89060', belly: '#f8e0c0', eye: '#202020', size: 24 },
  /** The Namekian frog that Captain Ginyu has been stuck in for years. */
  c05_frog: { kind: 'quadruped', body: '#58b040', belly: '#c8e890', eye: '#f8e040', size: 24 },
});

registerCast(
  {
    /** One of the cheerful angels assigned to Frieza's "punishment" in Hell. */
    c04_angel: {
      body: 'child', skin: '#f8d8b8', hair: 'short', hairColor: '#f8e090', top: '#f8f8f8', topStyle: 'robe', under: '#f0f0ff',
      sleeves: 'short', pants: '#f8f8f8', boots: '#f0e0a0', halo: '#f8e060', face: 'gentle',
    },
  },
  { c04_angel: 'Angel' },
);
