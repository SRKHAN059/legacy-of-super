import { finishProp, registerProp, type PropArt } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';

/**
 * Custom art for the Earth A hubs (Mt. Paozu, Satan City, Kame House, The Lookout).
 * Prop ids are prefixed `ea_`. Door positions (in tiles from the prop's top-left) are noted per prop
 * because the maps place door warps on them.
 */

const SKIN = '#f8c890';

// ------------------------------------------------------------------ creatures

registerCreatures({
  /** Bee, Mr. Satan's puppy (white with brown patches). */
  ea_dog: { kind: 'quadruped', body: '#f4f0e6', belly: '#fffaf2', accent: '#a8703c', eye: '#202020', size: 24, stripes: true },
  /** The Turtle (Umigame) of Kame House. */
  ea_turtle: { kind: 'bug', body: '#5a9a4a', accent: '#386a30', eye: '#202020', size: 32, stripes: true },
});

// ------------------------------------------------------------------ townsfolk variants

registerCast({
  ea_suit: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#282830', top: '#404858', topStyle: 'suit', under: '#e8e8f0', sleeves: 'long', pants: '#404858', boots: '#181818' },
  ea_girl: { body: 'female', skin: SKIN, hair: 'long', hairColor: '#e070a0', top: '#f0a8c8', topStyle: 'dress', sleeves: 'short', pants: '#f0a8c8', boots: '#f0f0f0' },
  ea_granny: { body: 'female', skin: SKIN, hair: 'bun', hairColor: '#d8d8e0', top: '#8060a8', topStyle: 'robe', under: '#604880', sleeves: 'long', pants: '#604880', boots: '#382818', face: 'gentle' },
  ea_jogger: { body: 'male', skin: '#e8b078', hair: 'spiky', hairColor: '#402818', top: '#40b060', topStyle: 'shirt', sleeves: 'none', pants: '#f0f0f0', boots: '#e04040' },
  ea_tourist: { body: 'big', skin: SKIN, hair: 'cap', hairColor: '#f0f0f0', accent: '#e04040', top: '#f08838', topStyle: 'shirt', sleeves: 'short', pants: '#c8b080', boots: '#704020', face: 'shades' },
  ea_clerk: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#402820', top: '#f8f0e0', topStyle: 'vest', under: '#d84848', sleeves: 'short', pants: '#383848', boots: '#202020' },
  ea_butler: { body: 'male', skin: SKIN, hair: 'bald', hairColor: '#c0c0c0', top: '#202028', topStyle: 'suit', under: '#f0f0f0', sleeves: 'long', pants: '#202028', boots: '#101010', face: 'mustache' },
  ea_student: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#202020', top: '#f0f0f0', topStyle: 'gi', under: '#f0f0f0', sleeves: 'short', belt: '#202020', pants: '#f0f0f0', boots: SKIN, emblem: '#d83030' },
  ea_student2: { body: 'female', skin: '#e8b078', hair: 'ponytail', hairColor: '#301810', accent: '#d83030', top: '#f0f0f0', topStyle: 'gi', under: '#f0f0f0', sleeves: 'short', belt: '#c03030', pants: '#f0f0f0', boots: '#e8b078', emblem: '#d83030' },
  ea_sailor: { body: 'male', skin: '#c88858', hair: 'cap', hairColor: '#f0f0f0', accent: '#2848a0', top: '#f0f0f0', topStyle: 'shirt', sleeves: 'short', pants: '#2848a0', boots: '#202020', face: 'beard' },
}, {
  ea_suit: 'Businessman', ea_girl: 'Shopper', ea_granny: 'Granny', ea_jogger: 'Jogger', ea_tourist: 'Tourist', ea_clerk: 'Clerk',
  ea_butler: 'Butler', ea_student: 'Student', ea_student2: 'Student', ea_sailor: 'Sailor',
});

// ------------------------------------------------------------------ props

/** Goten's training stump (24x20). */
registerProp('ea_stump', () => {
  const p = new Painter(24, 20);
  p.ellipse(0, 11, 24, 8, '#6c4828');
  p.rect(1, 13, 5, 4, '#8a5a30'); p.rect(18, 13, 5, 4, '#8a5a30');
  p.rect(4, 6, 16, 10, '#8a5a30');
  p.vline(8, 8, 8, '#6c4828'); p.vline(14, 9, 7, '#6c4828'); p.vline(18, 8, 6, '#6c4828');
  p.ellipse(3, 2, 18, 9, '#d8a868');
  p.ellipse(6, 3, 12, 6, '#b88848');
  p.ellipse(8, 4, 8, 4, '#d8a868');
  p.px(11, 5, '#8a5a30'); p.px(12, 5, '#8a5a30');
  p.line(5, 4, 9, 3, '#f0c888');
  return { bmp: finishProp(p), solid: { x: 3, y: 8, w: 18, h: 10 } };
});

/** ZTV studio (96x72 = 6x4.5 tiles). Glass doors at px 36..60 (tile +2..+3), solid bottom at +4.4 tiles. */
registerProp('ea_ztv', () => {
  const p = new Painter(96, 72);
  // Roof gear: satellite dish + antenna mast with a red beacon.
  p.rect(70, 0, 2, 16, '#606878');
  p.hline(66, 4, 10, '#606878'); p.hline(67, 8, 8, '#606878');
  p.rect(70, 0, 2, 2, '#f04040');
  p.ellipse(10, 2, 18, 13, '#d8d8e0'); p.ellipse(13, 4, 11, 7, '#a8a8b8');
  p.line(19, 9, 23, 16, '#606878');
  // Body.
  p.rect(2, 14, 92, 56, '#7484a4');
  p.rect(2, 14, 92, 3, '#a0b0cc');
  p.rect(2, 66, 92, 4, '#5c6884');
  // Sign band with "ZTV".
  p.rect(8, 20, 80, 19, '#f4f4f8');
  p.rect(8, 37, 80, 2, '#c8c8d8');
  const red = '#d83030';
  p.rect(22, 23, 14, 3, red); p.rect(22, 33, 14, 3, red);
  for (let i = 0; i < 3; i++) p.line(35 - i, 26, 22, 33 - i + 1, red);
  p.line(36, 26, 23, 33, red);
  p.rect(41, 23, 14, 3, red); p.rect(46, 23, 4, 13, red);
  for (let i = 0; i < 3; i++) { p.line(60 + i, 23, 65 + i, 35, red); p.line(73 - i, 23, 68 - i, 35, red); }
  // Windows.
  for (let i = 0; i < 8; i++) { p.rect(7 + i * 11, 43, 7, 6, '#c8e0f8'); p.hline(7 + i * 11, 43, 7, '#e8f4ff'); }
  // Canopy + glass doors.
  p.rect(30, 49, 36, 3, red); p.rect(30, 52, 36, 1, '#901818');
  p.rect(34, 53, 28, 17, '#384858');
  p.rect(36, 55, 11, 15, '#88c0e8'); p.rect(49, 55, 11, 15, '#88c0e8');
  p.vline(38, 56, 12, '#c8e8ff'); p.vline(51, 56, 12, '#c8e8ff');
  // Posters.
  p.rect(8, 53, 12, 13, '#f8d040'); p.rect(10, 55, 8, 6, '#e07030');
  p.rect(76, 53, 12, 13, '#f8d040'); p.rect(78, 55, 8, 6, '#3070d0');
  return { bmp: finishProp(p), solid: { x: 2, y: 30, w: 92, h: 40 } };
});

/** Storefront factory (64x48 = 4x3 tiles). Door at px 34..46 -> tile +2, row +2. */
function store(awning: string, sign: string, goods: string[]): () => PropArt {
  return () => {
    const p = new Painter(64, 48);
    p.rect(2, 8, 60, 38, '#ece0c4');
    p.rect(2, 44, 60, 2, '#b8a888');
    p.rect(0, 2, 64, 9, sign);
    p.rect(4, 3, 56, 6, '#f8f0d0');
    for (let i = 0; i < 6; i++) p.hline(9 + i * 8, 5, 5, sign);
    p.hline(12, 7, 36, sign);
    for (let i = 0; i < 8; i++) p.rect(i * 8, 13, 8, 6, i % 2 ? '#f4f4f4' : awning);
    for (let i = 0; i < 8; i++) p.ellipse(i * 8, 16, 8, 6, i % 2 ? '#f4f4f4' : awning);
    p.rect(5, 24, 24, 15, '#88c0e8'); p.rect(6, 25, 9, 4, '#c8e8ff');
    p.rect(8, 32, 5, 7, goods[0]); p.rect(15, 30, 6, 9, goods[1]); p.rect(23, 33, 4, 6, goods[2]);
    p.rect(33, 25, 14, 21, '#6c4426');
    p.rect(35, 27, 10, 10, '#88c0e8'); p.px(44, 38, '#f8d040');
    p.rect(50, 24, 10, 11, '#88c0e8'); p.rect(51, 25, 4, 3, '#c8e8ff');
    return { bmp: finishProp(p), solid: { x: 2, y: 16, w: 60, h: 30 } };
  };
}
registerProp('ea_store', store('#d84848', '#a83838', ['#f8d040', '#e06060', '#60a0e0']));
registerProp('ea_cafe', store('#3c9858', '#2c7040', ['#f8f0e0', '#a06038', '#f0a0b0']));
registerProp('ea_boutique', store('#b860c8', '#8840a0', ['#f0c0e0', '#f8f8f8', '#e8c048']));

/** Gold Mr. Satan statue, fist raised (32x56 = 2x3.5 tiles). */
registerProp('ea_satanStatue', () => {
  const G = '#e8c048'; const GD = '#b89028'; const GL = '#f8e898';
  const p = new Painter(32, 56);
  p.rect(1, 42, 30, 13, '#a8a0a0'); p.rect(1, 42, 30, 2, '#d0c8c8'); p.rect(1, 53, 30, 2, '#888080');
  p.rect(9, 46, 14, 5, G); p.hline(11, 48, 10, GD);
  p.rect(11, 32, 4, 10, GD); p.rect(17, 32, 4, 10, G);
  p.rect(10, 20, 12, 13, G); p.rect(10, 29, 12, 2, GD); p.vline(16, 20, 9, GD);
  p.rect(6, 8, 4, 14, G); p.rect(5, 3, 6, 6, GL);
  p.rect(22, 21, 4, 8, GD); p.rect(23, 28, 3, 3, G);
  p.ellipse(9, 4, 15, 13, GD);
  p.ellipse(11, 9, 11, 11, G);
  p.rect(13, 15, 6, 1, GD); p.px(14, 12, '#806010'); p.px(18, 12, '#806010');
  p.rect(9, 21, 3, 3, GL);
  return { bmp: finishProp(p), solid: { x: 1, y: 44, w: 30, h: 11 } };
});

/** Mr. Satan's mansion (128x96 = 8x6 tiles). Double door px 50..78 -> warp tiles +3..+4 at row +5. */
registerProp('ea_mansion', () => {
  const p = new Painter(128, 96);
  // Central dome with a gold finial.
  p.ellipse(44, 2, 40, 30, '#f4ecdc'); p.ellipse(50, 5, 16, 11, '#fffaf0');
  p.rect(62, 0, 4, 5, '#e8c048');
  // Red tiled roof (trapezoid).
  for (let i = 0; i < 16; i++) p.hline(14 - i, 20 + i, 100 + i * 2, i % 3 === 2 ? '#a83028' : '#c84838');
  // Walls.
  p.rect(4, 36, 120, 58, '#f6eee0');
  p.hline(4, 36, 120, '#ddd0bc'); p.rect(4, 90, 120, 4, '#c8bca8');
  p.rect(4, 56, 120, 2, '#e0d4c0');
  // Windows, two floors, both wings.
  for (const x of [12, 26, 92, 106]) for (const y of [42, 64]) {
    p.rect(x, y, 10, 12, '#5888c0'); p.rect(x + 1, y + 1, 4, 5, '#a8d0f0'); p.rect(x - 1, y + 12, 12, 2, '#e0d4c0');
  }
  // Portico: pediment + columns.
  p.rect(40, 36, 48, 6, '#fffaf0'); p.hline(40, 41, 48, '#ddd0bc');
  for (let i = 0; i < 8; i++) p.hline(44 + i * 2, 35 - i, 40 - i * 4, '#fffaf0');
  p.rect(60, 30, 8, 5, '#e8c048');
  for (const x of [42, 50, 74, 82]) { p.rect(x, 42, 5, 48, '#fffaf0'); p.vline(x + 4, 42, 48, '#ddd0bc'); }
  // Double door + gold "S" crest.
  p.rect(50, 60, 28, 34, '#7a4a28');
  p.rect(52, 62, 11, 32, '#985c30'); p.rect(65, 62, 11, 32, '#985c30');
  p.px(62, 78, '#e8c048'); p.px(65, 78, '#e8c048');
  p.rect(58, 46, 12, 10, '#e8c048');
  p.rect(60, 47, 8, 2, '#b89028'); p.rect(60, 50, 8, 2, '#b89028'); p.rect(60, 53, 8, 2, '#b89028');
  p.rect(60, 47, 2, 4, '#b89028'); p.rect(66, 50, 2, 4, '#b89028');
  // Steps.
  p.rect(46, 92, 36, 4, '#d8d0c8');
  return { bmp: finishProp(p), solid: { x: 4, y: 40, w: 120, h: 54 } };
});

/** Satan Dojo (80x64 = 5x4 tiles). Sliding door px 31..49 -> warp tile +2 at row +3. */
registerProp('ea_dojo', () => {
  const p = new Painter(80, 64);
  for (let i = 0; i < 22; i++) p.hline(12 - Math.round(i * 0.5), 5 + i, 56 + Math.round(i * 1.0), i % 3 === 0 ? '#3a3e50' : '#4a4e62');
  p.rect(14, 2, 52, 4, '#2a2e40');
  p.rect(6, 0, 8, 3, '#2a2e40'); p.rect(66, 0, 8, 3, '#2a2e40');
  p.rect(2, 26, 76, 36, '#f2ecda');
  p.rect(2, 26, 76, 3, '#6c4828'); p.rect(2, 58, 76, 4, '#6c4828');
  for (const x of [2, 18, 61, 76]) p.rect(x, 26, 2, 36, '#6c4828');
  // Shoji windows.
  for (const x of [6, 64]) { p.rect(x, 34, 10, 14, '#f8f6ee'); p.vline(x + 5, 34, 14, '#a08060'); p.hline(x, 41, 10, '#a08060'); }
  // Sliding door.
  p.rect(31, 38, 18, 21, '#8a6038');
  p.rect(33, 40, 6, 18, '#f8f4e8'); p.rect(41, 40, 6, 18, '#f8f4e8');
  for (let y = 44; y < 58; y += 5) { p.hline(33, y, 6, '#c0a888'); p.hline(41, y, 6, '#c0a888'); }
  // Red banner sign.
  p.rect(26, 30, 28, 7, '#c83030'); for (let i = 0; i < 5; i++) p.rect(29 + i * 5, 32, 3, 3, '#f8e080');
  return { bmp: finishProp(p), solid: { x: 2, y: 26, w: 76, h: 36 } };
});

/** Kami's palace on the Lookout (112x88 = 7x5.5 tiles). Arched doorway px 48..64 -> warp tile +3 at row +5. */
registerProp('ea_palace', () => {
  const p = new Painter(112, 88);
  const W = '#f6f2e6'; const S = '#ddd6c4';
  // Side domes.
  for (const x of [6, 84]) { p.ellipse(x, 18, 22, 22, W); p.ellipse(x + 4, 20, 7, 7, '#fffcf4'); p.rect(x + 10, 15, 2, 4, '#e8c048'); }
  // Central onion dome.
  p.ellipse(30, 8, 52, 40, W); p.ellipse(38, 12, 18, 13, '#fffcf4');
  p.rect(53, 2, 6, 8, W); p.rect(55, 0, 2, 3, '#e8c048');
  p.hline(30, 40, 52, S);
  // Main body.
  p.rect(4, 36, 104, 50, '#f2eee2');
  p.hline(4, 36, 104, S);
  p.rect(4, 44, 104, 3, '#d8c890');
  p.rect(4, 82, 104, 4, S);
  // Arched windows.
  for (const x of [12, 28, 76, 92]) { p.rect(x, 54, 8, 14, '#384868'); p.ellipse(x, 50, 8, 8, '#384868'); p.rect(x + 1, 56, 2, 6, '#5878a8'); }
  // Doorway arch.
  p.rect(44, 60, 24, 26, '#e8e0cc'); p.ellipse(44, 50, 24, 22, '#e8e0cc');
  p.rect(48, 64, 16, 22, '#2c2438'); p.ellipse(48, 56, 16, 16, '#2c2438');
  p.ellipse(50, 58, 12, 12, '#3c3448');
  return { bmp: finishProp(p), solid: { x: 4, y: 40, w: 104, h: 46 } };
});

/** Entrance to the Room of Spirit and Time (48x56 = 3x3.5 tiles). Door px 15..33 -> tile +1 at row +3. */
registerProp('ea_htcDoor', () => {
  const p = new Painter(48, 56);
  p.ellipse(8, 2, 32, 24, '#f6f2e6'); p.ellipse(13, 5, 9, 8, '#fffcf4');
  p.rect(22, 0, 4, 4, '#e8c048');
  p.rect(4, 16, 40, 38, '#f0ece0');
  p.rect(2, 14, 44, 4, '#d8d0c0'); p.rect(2, 52, 44, 2, '#c8c0b0');
  // Hourglass emblem.
  for (let i = 0; i < 5; i++) { p.hline(19 + i, 19 + i, 10 - i * 2, '#38c070'); p.hline(19 + i, 28 - i, 10 - i * 2, '#38c070'); }
  p.hline(18, 18, 12, '#e8c048'); p.hline(18, 29, 12, '#e8c048');
  // Double door.
  p.rect(15, 31, 18, 23, '#5a4838');
  p.rect(17, 33, 6, 21, '#7a6048'); p.rect(25, 33, 6, 21, '#7a6048');
  p.px(23, 44, '#e8c048'); p.px(24, 44, '#e8c048');
  return { bmp: finishProp(p), solid: { x: 2, y: 24, w: 44, h: 30 } };
});

/** Korin Tower's base: a white pillar that rises off the top of the screen (48x192). */
registerProp('ea_korinTower', () => {
  const p = new Painter(48, 192);
  p.rect(10, 0, 28, 172, '#f2eee2');
  p.rect(12, 0, 5, 172, '#fffcf4');
  p.rect(32, 0, 6, 172, '#d8d0c0');
  for (let y = 10; y < 160; y += 34) {
    p.rect(8, y, 32, 4, '#c84838'); p.rect(8, y + 4, 32, 1, '#e8c048');
    for (let x = 12; x < 36; x += 6) p.rect(x, y + 8, 3, 3, '#e0d8c8');
  }
  p.rect(4, 160, 40, 10, '#e8e2d4'); p.hline(4, 160, 40, '#fffcf4');
  p.rect(2, 170, 44, 20, '#d8d0c0'); p.hline(2, 170, 44, '#f0e8d8');
  for (let x = 6; x < 44; x += 8) p.rect(x, 176, 4, 10, '#c0b8a8');
  return { bmp: finishProp(p), solid: { x: 2, y: 164, w: 44, h: 26 } };
});

/** A wooden notice board (32x24) for town squares. */
registerProp('ea_board', () => {
  const p = new Painter(32, 24);
  p.rect(3, 12, 3, 12, '#704820'); p.rect(26, 12, 3, 12, '#704820');
  p.rect(0, 0, 32, 16, '#a07040'); p.rect(2, 2, 28, 12, '#e8d8b0');
  p.rect(4, 3, 8, 9, '#f8f8f8'); p.rect(14, 4, 6, 7, '#f8d040'); p.rect(22, 3, 6, 8, '#a0c8f0');
  p.hline(5, 5, 6, '#808080'); p.hline(5, 7, 5, '#808080'); p.rect(15, 5, 4, 3, '#e04040');
  return { bmp: finishProp(p), solid: { x: 2, y: 16, w: 28, h: 7 } };
});

/** A bench (32x16). */
registerProp('ea_bench', () => {
  const p = new Painter(32, 16);
  p.rect(1, 0, 30, 4, '#a07040'); p.rect(1, 6, 30, 4, '#b88050');
  p.rect(3, 10, 3, 6, '#505868'); p.rect(26, 10, 3, 6, '#505868');
  return { bmp: finishProp(p), solid: { x: 1, y: 6, w: 30, h: 8 } };
});

/** Outdoor oil-drum bath with a fire underneath (20x24) - the Son family's goemon-buro. */
registerProp('ea_bath', () => {
  const p = new Painter(20, 24);
  p.rect(3, 18, 14, 4, '#585050'); p.ellipse(5, 15, 10, 7, '#f08020'); p.ellipse(7, 17, 5, 4, '#f8e040');
  p.rect(1, 4, 18, 13, '#8c8c98'); p.rect(1, 8, 18, 1, '#686874'); p.rect(1, 13, 18, 1, '#686874');
  p.ellipse(1, 0, 18, 8, '#a8a8b4'); p.ellipse(3, 2, 14, 5, '#78b8e8'); p.px(7, 3, '#e8f8ff');
  return { bmp: finishProp(p), solid: { x: 1, y: 6, w: 18, h: 16 } };
});

/**
 * Sky backdrop for maps that float in the air: paints sky + clouds over every tile whose grid char is in
 * `skyChars`, with a stone lip under the platform edge. Flat (drawn beneath actors).
 */
export function registerSky(id: string, grid: readonly string[], skyChars: string, lip = '#b8b0c8', lipDark = '#8a8098'): void {
  registerProp(id, () => {
    const H = grid.length; const W = grid[0].length;
    const p = new Painter(W * 16, H * 16);
    const sky = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || skyChars.includes(grid[y][x]);
    const blues = ['#6aa8e8', '#74b0ec', '#7ab8f0', '#86c0f2', '#92c8f4'];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (!sky(tx, ty)) continue;
      for (let y = 0; y < 16; y++) {
        const band = blues[Math.min(blues.length - 1, Math.floor(((ty * 16 + y) / (H * 16)) * blues.length))];
        p.hline(tx * 16, ty * 16 + y, 16, band);
      }
    }
    // Soft cloud puffs (only over sky tiles).
    let seed = id.length * 977 + W * 31 + H;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const puff = (cx: number, cy: number, rx: number, ry: number, col: string) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
        const px = cx + x; const py = cy + y;
        if (sky(Math.floor(px / 16), Math.floor(py / 16))) p.px(px, py, col);
      }
    };
    const n = Math.round((W * H) / 18);
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(rnd() * W * 16); const cy = Math.floor(rnd() * H * 16);
      const r = 6 + Math.floor(rnd() * 10);
      puff(cx, cy + 2, r + 2, Math.ceil(r * 0.5), '#d8e8f8');
      puff(cx - r, cy + 1, Math.ceil(r * 0.7), Math.ceil(r * 0.45), '#f0f6ff');
      puff(cx, cy, r, Math.ceil(r * 0.55), '#ffffff');
      puff(cx + r, cy + 2, Math.ceil(r * 0.6), Math.ceil(r * 0.4), '#f0f6ff');
    }
    // Platform lip: underside below solid ground, thin rim on the sides.
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (!sky(tx, ty)) continue;
      const x = tx * 16; const y = ty * 16;
      if (!sky(tx, ty - 1)) { p.rect(x, y, 16, 6, lip); p.rect(x, y + 6, 16, 2, lipDark); }
      if (!sky(tx - 1, ty)) p.rect(x, y, 2, 16, lip);
      if (!sky(tx + 1, ty)) p.rect(x + 14, y, 2, 16, lip);
      if (!sky(tx, ty + 1)) p.rect(x, y + 14, 16, 2, '#f4f0fa');
    }
    return { bmp: p.done(), solid: null, flat: true };
  });
}
