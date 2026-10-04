import { finishProp, registerProp } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';

/**
 * Act 4 art: chapter landmarks (Cell's time machine, the wrecked HOPE!!, crystal veins, Babari's sacred tree,
 * the Time Ring pedestal, the sky-rift tear), extra cast (Dabura, Babidi, Babarians, mutating Fused Zamasu)
 * and creature sprites. Sizes are in px; solid footprints are relative to the bitmap's top-left.
 */

/** Deterministic 0..1 noise for pixel details. */
function n01(i: number, s: number): number {
  let h = (i * 374761393 + s * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Cell's egg-shaped time machine, 40x36 (2.5x2.25 tiles). Solid 32x16 at (4,18). */
registerProp('c09_cellMachine', () => {
  const p = new Painter(40, 36);
  p.ellipse(4, 26, 32, 10, '#3a3428');
  for (let i = 0; i < 3; i++) { p.line(8 + i * 12, 24, 4 + i * 14, 34, '#504838'); }
  p.ellipse(4, 2, 32, 28, '#b8a070');
  p.ellipse(6, 3, 26, 22, '#d0b880');
  p.ellipse(8, 4, 12, 9, '#e8d8a8');
  p.ellipse(16, 10, 12, 10, '#283830');
  p.ellipse(18, 11, 6, 5, '#60a888');
  p.hline(5, 18, 30, '#8a7450');
  p.rect(14, 20, 12, 4, '#6a5a3c');
  p.px(17, 21, '#f04040'); p.px(20, 21, '#40f040'); p.px(23, 21, '#f0d040');
  // Moss and age stains: it sat in a cave for years.
  for (let i = 0; i < 18; i++) p.px(6 + Math.round(n01(i, 5) * 28), 14 + Math.round(n01(i, 6) * 10), '#7a8a50');
  return { bmp: finishProp(p), solid: { x: 4, y: 18, w: 32, h: 16 } };
});

/** Cell's time machine after Black's ambush in the future: cracked shell, smoking hatch. 40x36. Solid 32x14 at (4,20). */
registerProp('c11_cellWreck', () => {
  const p = new Painter(40, 36);
  p.ellipse(2, 24, 36, 12, '#2c2824');
  for (let i = 0; i < 3; i++) p.line(8 + i * 12, 26, 4 + i * 14, 35, '#504838');
  p.line(30, 24, 38, 30, '#504838');
  // The lower half of the egg still stands; the cap lies split beside it.
  p.ellipse(4, 10, 32, 22, '#a08c60');
  p.ellipse(6, 12, 26, 14, '#b8a070');
  p.ellipse(10, 9, 20, 8, '#1c1814');
  p.ellipse(13, 10, 14, 5, '#3a2c20');
  p.ellipse(26, 2, 12, 9, '#9a8458');
  p.ellipse(28, 3, 7, 5, '#b8a070');
  // Jagged crack and scorch marks.
  p.line(12, 14, 16, 22, '#2a2018'); p.line(16, 22, 13, 28, '#2a2018'); p.line(24, 15, 22, 25, '#2a2018');
  for (let i = 0; i < 24; i++) p.px(6 + Math.round(n01(i, 41) * 28), 12 + Math.round(n01(i, 42) * 16), '#4a3e30');
  p.rect(14, 22, 12, 4, '#5a4a34');
  p.px(17, 23, '#602020'); p.px(20, 23, '#206020'); p.px(23, 23, '#605020');
  // Wisps of smoke from the open hatch.
  for (let i = 0; i < 10; i++) p.px(14 + Math.round(n01(i, 43) * 12), Math.round(n01(i, 44) * 8), '#8a8a8a');
  return { bmp: finishProp(p), solid: { x: 4, y: 20, w: 32, h: 14 } };
});

/** The wrecked HOPE!! time machine, 40x32 (2.5x2 tiles). Solid 32x16 at (4,14). */
registerProp('c09_hopeWreck', () => {
  const p = new Painter(40, 32);
  p.ellipse(2, 20, 36, 12, '#3c3836');
  p.rect(6, 10, 28, 14, '#d8d8d0');
  p.rect(6, 10, 28, 3, '#f0f0e8');
  p.ellipse(10, 2, 18, 14, '#a8c8e0');
  p.line(12, 4, 24, 12, '#ffffff'); p.line(18, 3, 14, 13, '#ffffff');
  p.rect(9, 15, 22, 6, '#c8c8c0');
  // "HOPE!!" scrawled on the hull.
  p.rect(10, 16, 1, 4, '#d03030'); p.rect(12, 16, 1, 4, '#d03030'); p.px(11, 18, '#d03030');
  p.rect(14, 16, 3, 4, '#d03030'); p.rect(15, 17, 1, 2, '#c8c8c0');
  p.rect(18, 16, 1, 4, '#d03030'); p.rect(19, 16, 2, 2, '#d03030');
  p.rect(22, 16, 1, 4, '#d03030'); p.rect(23, 16, 2, 1, '#d03030'); p.rect(23, 18, 1, 1, '#d03030'); p.rect(23, 19, 2, 1, '#d03030');
  p.rect(26, 16, 1, 3, '#d03030'); p.px(26, 20, '#d03030'); p.rect(28, 16, 1, 3, '#d03030'); p.px(28, 20, '#d03030');
  // Scorch marks and a snapped landing leg.
  p.ellipse(20, 8, 14, 10, '#4a4440');
  p.line(8, 24, 4, 30, '#808078'); p.line(32, 24, 37, 27, '#808078');
  for (let i = 0; i < 20; i++) p.px(6 + Math.round(n01(i, 11) * 28), 10 + Math.round(n01(i, 12) * 12), '#5a5450');
  return { bmp: finishProp(p), solid: { x: 4, y: 14, w: 32, h: 16 } };
});

/** A glowing Hyper-Crystal vein, 20x24. Solid 16x8 at (2,15). */
registerProp('c09_crystalVein', () => {
  const p = new Painter(20, 24);
  p.ellipse(1, 16, 18, 8, '#3a4048');
  const shard = (x: number, y: number, h: number, c: string): void => {
    for (let j = 0; j < h; j++) {
      const w = Math.max(1, Math.round(((h - j) / h) * 3));
      p.hline(x - Math.floor(w / 2), y + h - j, w, c);
    }
  };
  shard(6, 4, 15, '#58c8f0'); shard(11, 1, 18, '#80e8f8'); shard(15, 7, 12, '#40a8e0'); shard(4, 10, 9, '#90f0ff');
  p.vline(11, 4, 10, '#e0ffff'); p.vline(6, 8, 6, '#e0ffff');
  return { bmp: finishProp(p), solid: { x: 2, y: 15, w: 16, h: 8 } };
});

/** Rusted mine cart on a short rail, 24x16. Solid 22x9 at (1,6). */
registerProp('c09_minecart', () => {
  const p = new Painter(24, 16);
  p.hline(0, 14, 24, '#5a4a3a'); p.hline(0, 15, 24, '#3a3028');
  p.rect(2, 4, 20, 8, '#7a5038');
  p.rect(3, 5, 18, 2, '#98684a');
  p.ellipse(4, 2, 16, 5, '#80e0f0');
  p.ellipse(4, 10, 5, 5, '#202020'); p.ellipse(15, 10, 5, 5, '#202020');
  return { bmp: finishProp(p), solid: { x: 1, y: 6, w: 22, h: 9 } };
});

/** Babari's sacred fruit tree, 48x56 (3x3.5 tiles). Solid 14x8 at (17,46). */
registerProp('c10_fruitTree', () => {
  const p = new Painter(48, 56);
  p.rect(19, 30, 10, 22, '#6a4830');
  p.vline(19, 30, 22, '#4a3020');
  p.rect(14, 50, 20, 4, '#4a3020');
  p.ellipse(2, 2, 44, 34, '#2e7a48');
  p.ellipse(4, 2, 38, 28, '#3c9858');
  p.ellipse(10, 4, 18, 12, '#58b870');
  for (let i = 0; i < 14; i++) {
    const x = 6 + Math.round(n01(i, 21) * 34);
    const y = 6 + Math.round(n01(i, 22) * 22);
    p.ellipse(x, y, 4, 4, '#e85890');
    p.px(x + 1, y + 1, '#ffb0d0');
  }
  return { bmp: finishProp(p), solid: { x: 17, y: 46, w: 14, h: 8 } };
});

/** Babarian totem pole, 16x36. Solid 12x8 at (2,28). */
registerProp('c10_totem', () => {
  const p = new Painter(16, 36);
  p.rect(3, 2, 10, 32, '#8a6040');
  const faces = ['#c04030', '#3080c0', '#e0c040'];
  for (let i = 0; i < 3; i++) {
    const y = 3 + i * 10;
    p.rect(3, y, 10, 9, faces[i]);
    p.rect(5, y + 2, 2, 2, '#f0f0f0'); p.rect(9, y + 2, 2, 2, '#f0f0f0');
    p.rect(6, y + 6, 4, 1, '#202020');
  }
  p.rect(0, 4, 3, 3, '#e0c040'); p.rect(13, 4, 3, 3, '#e0c040');
  return { bmp: finishProp(p), solid: { x: 2, y: 28, w: 12, h: 8 } };
});

/** Time Ring pedestal with a floating green ring, 24x32. Solid 16x10 at (4,22). */
registerProp('c10_ringPedestal', () => {
  const p = new Painter(24, 32);
  p.rect(6, 16, 12, 14, '#e0dce8');
  p.rect(4, 26, 16, 5, '#c8c0d8');
  p.rect(4, 14, 16, 3, '#f0ecf8');
  p.ellipse(4, 0, 16, 12, '#30a050');
  for (let y = 2; y < 10; y++) for (let x = 7; x < 17; x++) {
    const dx = (x - 11.5) / 5;
    const dy = (y - 5.5) / 4;
    if (dx * dx + dy * dy < 1) p.px(x, y, null);
  }
  p.px(6, 3, '#a0f0b0'); p.px(16, 8, '#a0f0b0');
  return { bmp: finishProp(p), solid: { x: 4, y: 22, w: 16, h: 10 } };
});

/** The tear in the sky over the ruined city: a jagged violet rift, 64x40. Walk-through. */
registerProp('c11_riftTear', () => {
  const p = new Painter(64, 40);
  for (let x = 2; x < 62; x++) {
    const mid = 18 + Math.round(Math.sin(x / 5) * 4 + (n01(x, 31) - 0.5) * 6);
    const half = Math.max(1, Math.round((1 - Math.abs(x - 32) / 32) * 9));
    for (let y = mid - half; y <= mid + half; y++) {
      const edge = y === mid - half || y === mid + half;
      p.px(x, y, edge ? '#f070b0' : (x + y) % 3 ? '#401040' : '#8030a0');
    }
  }
  for (let i = 0; i < 16; i++) p.px(4 + Math.round(n01(i, 33) * 56), 8 + Math.round(n01(i, 34) * 22), '#ffd0f0');
  return { bmp: p.done(), solid: null };
});

/** A ruined Resistance barricade of sandbags and scrap, 32x20. Solid 30x10 at (1,9). */
registerProp('c11_barricade', () => {
  const p = new Painter(32, 20);
  for (let i = 0; i < 5; i++) p.ellipse(1 + i * 6, 10, 8, 6, i % 2 ? '#a89060' : '#988050');
  for (let i = 0; i < 4; i++) p.ellipse(4 + i * 6, 6, 8, 6, i % 2 ? '#988050' : '#b0a070');
  p.line(2, 4, 12, 1, '#707070'); p.line(20, 2, 30, 6, '#707070');
  return { bmp: finishProp(p), solid: { x: 1, y: 9, w: 30, h: 10 } };
});

// ------------------------------------------------------------------ creatures

registerCreatures({
  c09_crystalBat: { kind: 'bat', body: '#3878a0', eye: '#c0f8ff', size: 24 },
  c09_mineDrone: { kind: 'drone', body: '#c08830', accent: '#40f0f0', size: 24 },
  c09_rockCrawler: { kind: 'bug', body: '#5a6a7a', accent: '#80e0f0', horns: true, stripes: true, size: 32 },
  c09_haywireMech: { kind: 'robot', body: '#a07040', accent: '#f0f040', size: 32 },
  c09_excavator: { kind: 'robot', body: '#e0a020', accent: '#f04040', size: 48 },
  c10_babariBeast: { kind: 'dino', body: '#5a8040', belly: '#c0d890', accent: '#c04030', horns: true, size: 40 },
  c10_mutantHound: { kind: 'quadruped', body: '#5a3048', belly: '#8a6070', eye: '#f0f040', horns: true, size: 32 },
  c10_scrapMech: { kind: 'robot', body: '#585050', accent: '#f070b0', size: 32 },
  c11_ward: { kind: 'drone', body: '#f0e8c8', accent: '#d02828', size: 24 },
});

// ------------------------------------------------------------------ cast

registerCast({
  c09_dabura: { body: 'big', skin: '#d84848', hair: 'spiky', hairColor: '#282028', eye: '#f0d040', top: '#d8d0c0', topStyle: 'armor', under: '#383040', sleeves: 'none', belt: '#c0a040', pants: '#d8d0c0', boots: '#383040', cape: '#282028', ears: 'pointed', face: 'stern' },
  c09_babidi: { body: 'child', skin: '#e0c860', hair: 'bald', hairColor: '#e0c860', top: '#e8e0d0', topStyle: 'robe', under: '#a03030', sleeves: 'long', belt: '#a03030', pants: '#e8e0d0', boots: '#806040', cape: '#a03030', ears: 'pointed', face: 'stern' },
  c10_babarianSlinger: { body: 'male', skin: '#98b068', hair: 'braids', hairColor: '#e0d0a0', top: '#a07848', topStyle: 'vest', under: '#806040', sleeves: 'none', belt: '#402010', pants: '#806040', boots: '#402010', face: 'stern' },
  c10_babarianChief: { body: 'big', skin: '#7a9048', hair: 'mohawk', hairColor: '#c03020', accent: '#e0c040', top: '#5a4030', topStyle: 'vest', under: '#e0c040', sleeves: 'none', belt: '#e0c040', pants: '#5a4030', boots: '#402010', scarf: '#e0c040', face: 'stern' },
  c11_fusedHalf: { body: 'male', skin: '#9068b0', hair: 'long', hairColor: '#f0f0f0', eye: '#f04060', top: '#d0c8e0', topStyle: 'robe', under: '#305830', sleeves: 'none', belt: '#d0a030', pants: '#305830', boots: '#d0a030', earring: '#58e080', ears: 'pointed', face: 'stern' },
}, {
  c09_dabura: 'Dabura', c09_babidi: 'Babidi', c10_babarianSlinger: 'Babarian', c10_babarianChief: 'Babarian Chief', c11_fusedHalf: 'Zamasu',
});
