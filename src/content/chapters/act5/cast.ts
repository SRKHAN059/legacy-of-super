import { finishProp, registerProp } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';
import { registerScans } from '../../scans';

/** Act 5 cast: Days of Peace guests, Universe Survival recruits/foes, Tournament of Power fighters. */

const SKIN = '#f8c890';
const SKIN_TAN = '#e8b078';

registerCast({
  // ---------------------------------------------------------------- Chapter 12: Days of Peace
  c12_saiyaman: { body: 'male', skin: SKIN, hair: 'helmet', hairColor: '#202028', accent: '#f0f0f0', top: '#2a8a3a', topStyle: 'suit', under: '#202020', sleeves: 'long', belt: '#e8e8e8', pants: '#2a8a3a', boots: '#e8e8e8', wrist: '#e8e8e8', cape: '#d03030', scarf: '#f08020', face: 'shades' },
  c12_barry: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#e8c860', top: '#f0f0f0', topStyle: 'coat', under: '#c03040', sleeves: 'long', pants: '#f0f0f0', boots: '#806040', face: 'gentle' },
  c12_director: { body: 'male', skin: SKIN_TAN, hair: 'cap', hairColor: '#402818', accent: '#d03030', top: '#f0c040', topStyle: 'shirt', sleeves: 'short', pants: '#506078', boots: '#382818', face: 'shades' },
  c12_cocoa: { body: 'female', skin: SKIN, hair: 'long', hairColor: '#704020', top: '#f070a0', topStyle: 'dress', sleeves: 'none', pants: '#f070a0', boots: '#f0f0f0' },
  c12_watagash: { body: 'big', skin: '#9850b8', hair: 'antennae', hairColor: '#6a2a90', accent: '#f0d040', top: '#f0f0f0', topStyle: 'coat', under: '#7a3098', sleeves: 'none', pants: '#f0f0f0', boots: '#806040', eye: '#f0e040', face: 'stern' },
  c12_stuntman: { body: 'big', skin: '#60a060', hair: 'mohawk', hairColor: '#386838', top: '#60a060', topStyle: 'suit', under: '#60a060', sleeves: 'none', belt: '#f0d040', pants: '#60a060', boots: '#386838', eye: '#f0f040', face: 'stern' },
  c12_robber: { body: 'male', skin: SKIN, hair: 'helmet', hairColor: '#282830', accent: '#f0f0f0', top: '#383840', topStyle: 'shirt', sleeves: 'long', belt: '#806040', pants: '#283048', boots: '#202020' },
  c12_raditz: { body: 'male', skin: SKIN_TAN, hair: 'long', hairColor: '#181820', top: '#5a4030', topStyle: 'armor', under: '#383048', sleeves: 'none', pants: '#383048', boots: '#e8e8d0', tail: '#5a3020', scouter: '#38e070', face: 'stern' },
  c12_nappa: { body: 'big', skin: SKIN_TAN, hair: 'bald', hairColor: '#202020', top: '#5a4030', topStyle: 'armor', under: '#383048', sleeves: 'none', pants: '#383048', boots: '#e8e8d0', scouter: '#38e070', face: 'mustache' },
  c12_cell: { body: 'big', skin: '#78c058', hair: 'dome', hairColor: '#283028', accent: '#f0a0c0', top: '#78c058', topStyle: 'suit', under: '#283028', sleeves: 'none', pants: '#78c058', boots: '#f0f0f0', eye: '#d03060', face: 'stern' },

  // ---------------------------------------------------------------- Chapter 13: Universe Survival
  c13_poacherBoss: { body: 'big', skin: '#8098a8', hair: 'helmet', hairColor: '#605848', accent: '#f0a020', top: '#585040', topStyle: 'armor', under: '#383028', sleeves: 'long', belt: '#e0a030', pants: '#383028', boots: '#202018', scouter: '#f05030', face: 'stern' },
  c13_yurin: { body: 'female', skin: SKIN, hair: 'bun', hairColor: '#8050a0', top: '#e0d0f0', topStyle: 'robe', under: '#6040a0', sleeves: 'long', pants: '#6040a0', boots: '#302040', face: 'stern' },
  c13_roshiMax: { body: 'big', skin: SKIN_TAN, hair: 'bald', hairColor: '#f0f0f0', top: SKIN_TAN, topStyle: 'vest', under: SKIN_TAN, sleeves: 'none', belt: '#e88838', pants: '#f0e8c0', boots: '#806040', eye: '#d04040', face: 'beard' },
  c13_student: { body: 'male', skin: SKIN, hair: 'bald', hairColor: '#202020', top: '#48a058', topStyle: 'gi', under: '#f0f0f0', sleeves: 'short', belt: '#d03030', pants: '#f0f0f0', boots: '#202020', eye: '#d040d0' },
  c13_assassin: { body: 'male', skin: '#80a0c0', hair: 'helmet', hairColor: '#304060', accent: '#f04040', top: '#283048', topStyle: 'suit', under: '#182030', sleeves: 'long', pants: '#182030', boots: '#101018', face: 'stern' },
  c13_baba: { body: 'child', skin: SKIN, hair: 'hat', hairColor: '#503080', accent: '#7040a0', top: '#202020', topStyle: 'robe', under: '#503080', sleeves: 'long', pants: '#202020', boots: '#503080', face: 'gentle' },
  c13_marron: { body: 'child', skin: SKIN, hair: 'braids', hairColor: '#f0d878', top: '#f8a8c8', topStyle: 'dress', sleeves: 'short', pants: '#f8a8c8', boots: '#f0f0f0' },

  // ---------------------------------------------------------------- Chapter 14: Tournament of Power
  c14_u2Fighter: { body: 'female', skin: SKIN, hair: 'braids', hairColor: '#f0a0d0', accent: '#f8f0a0', top: '#f8a0c8', topStyle: 'dress', sleeves: 'short', pants: '#f8a0c8', boots: '#f0f0f0', face: 'gentle' },
  c14_u4Fighter: { body: 'male', skin: '#90b070', hair: 'mohawk', hairColor: '#486028', top: '#405880', topStyle: 'armor', under: '#283850', sleeves: 'long', pants: '#283850', boots: '#d0c080', face: 'stern' },
  c14_u10Fighter: { body: 'male', skin: '#6098c8', hair: 'antennae', hairColor: '#4070a0', top: '#d0a040', topStyle: 'vest', under: '#806020', sleeves: 'none', pants: '#504030', boots: '#302010', face: 'stern' },
  c14_u9Wolf: { body: 'male', skin: '#8a6a50', hair: 'catEars', hairColor: '#8a6a50', accent: '#f0d0b0', top: '#3060a0', topStyle: 'vest', under: '#3060a0', sleeves: 'none', pants: '#202030', boots: '#202030', face: 'stern' },
  c14_superShenron: { body: 'big', skin: '#e8b040', hair: 'catEars', hairColor: '#e8b040', accent: '#f8f0a0', top: '#e8b040', topStyle: 'suit', under: '#e8b040', sleeves: 'none', pants: '#e8b040', boots: '#e8b040', eye: '#f04040', face: 'stern', tail: '#e8b040' },
}, {
  c12_saiyaman: 'Great Saiyaman', c12_barry: 'Barry Kahn', c12_director: 'Director', c12_cocoa: 'Cocoa', c12_watagash: 'Watagash',
  c12_stuntman: 'Stuntman', c12_robber: 'Robber', c12_raditz: 'Raditz', c12_nappa: 'Nappa', c12_cell: 'Cell',
  c13_poacherBoss: 'Poacher Boss', c13_yurin: 'Yurin', c13_roshiMax: 'Master Roshi', c13_student: 'Student', c13_assassin: 'Assassin',
  c13_baba: 'Fortuneteller Baba', c13_marron: 'Marron',
  c14_u2Fighter: 'U2 Warrior', c14_u4Fighter: 'U4 Fighter', c14_u10Fighter: 'U10 Fighter', c14_u9Wolf: 'U9 Fighter', c14_superShenron: 'Super Shenron',
});

registerCreatures({
  // Monster Island's escaped animals (LoG2's Missing Namekians).
  c13_minotaurus: { kind: 'quadruped', body: '#8a5a3a', belly: '#e0c098', accent: '#5a3018', horns: true, size: 32 },
  c13_glowMoth: { kind: 'bug', body: '#f0e070', accent: '#60a0f0', stripes: true, size: 24 },
  c13_rainbowSnake: { kind: 'snake', body: '#e05090', belly: '#f0e070', accent: '#40a0e0', size: 32 },
  c13_babyDino: { kind: 'dino', body: '#f090b0', belly: '#f8e0e8', accent: '#c06080', size: 32 },
  c13_puffball: { kind: 'blob', body: '#f8c8e0', size: 24 },
  c13_cliffBat: { kind: 'bat', body: '#70a0d0', eye: '#f8f8f8', size: 24 },
  c13_emeraldKite: { kind: 'flyer', body: '#40a080', belly: '#c8f0d8', accent: '#f8d040', size: 24 },
  // Monster Island hostiles.
  c13_jungleRaptor: { kind: 'dino', body: '#4a8040', belly: '#c0d890', accent: '#2a5020', size: 32 },
  c13_mossBoar: { kind: 'quadruped', body: '#6a7040', belly: '#a8a878', accent: '#404820', horns: true, size: 32 },
  c13_poacherDrone: { kind: 'drone', body: '#606050', accent: '#e0a030', size: 24 },
  // Pan's meadow.
  c12_ironBoar: { kind: 'quadruped', body: '#5a4a40', belly: '#8a7a68', accent: '#302820', horns: true, size: 40 },
  c12_watagashSpawn: { kind: 'blob', body: '#8040a0', size: 24 },
  // Tournament of Power.
  c14_u3Robot: { kind: 'robot', body: '#a0a8c8', accent: '#f0d040', size: 32 },
  c14_anilaza: { kind: 'robot', body: '#7880a8', accent: '#f05050', size: 48 },
  c14_reactor: { kind: 'drone', body: '#d8e0f0', accent: '#40f0f0', size: 32 },
});

// ---------------------------------------------------------------- custom props

registerProp('c12_filmCamera', () => {
  const p = new Painter(20, 28);
  p.rect(9, 14, 2, 12, '#404048');
  p.line(10, 16, 3, 27, '#404048');
  p.line(10, 16, 17, 27, '#404048');
  p.rect(3, 4, 12, 9, '#282830');
  p.ellipse(1, 1, 7, 7, '#383840');
  p.ellipse(8, 1, 7, 7, '#383840');
  p.rect(15, 6, 4, 5, '#585868');
  p.px(17, 8, '#a0d8f8');
  return { bmp: finishProp(p), solid: { x: 3, y: 20, w: 14, h: 7 } };
});

registerProp('c12_herb', () => {
  const p = new Painter(16, 16);
  p.ellipse(3, 9, 10, 6, '#3a9038');
  p.vline(8, 3, 9, '#58b048');
  p.ellipse(2, 3, 6, 4, '#68d058');
  p.ellipse(8, 2, 6, 4, '#68d058');
  p.ellipse(6, 0, 4, 4, '#f8f080');
  p.px(7, 1, '#ffffff');
  return { bmp: finishProp(p), solid: null };
});

registerProp('c12_waterTower', () => {
  const p = new Painter(32, 44);
  p.rect(4, 26, 2, 16, '#585860'); p.rect(26, 26, 2, 16, '#585860');
  p.rect(14, 28, 2, 14, '#585860');
  p.line(5, 30, 27, 40, '#484850');
  p.ellipse(2, 4, 28, 24, '#8a6a48');
  p.rect(2, 10, 28, 12, '#8a6a48');
  for (let i = 0; i < 4; i++) p.hline(3, 9 + i * 4, 26, '#6a4a30');
  p.ellipse(4, 0, 24, 10, '#a07c58');
  return { bmp: finishProp(p), solid: { x: 2, y: 30, w: 28, h: 12 } };
});

registerProp('c13_cage', () => {
  const p = new Painter(32, 26);
  p.rect(0, 22, 32, 4, '#504838');
  p.rect(0, 2, 32, 3, '#706858');
  for (let i = 0; i < 9; i++) p.vline(1 + i * 4, 4, 18, '#888070');
  p.rect(12, 10, 8, 6, '#e0a030');
  return { bmp: finishProp(p), solid: { x: 0, y: 12, w: 32, h: 14 } };
});

registerProp('c13_dojoHall', () => {
  const p = new Painter(80, 60);
  p.rect(6, 26, 68, 32, '#c8a878');
  p.rect(6, 26, 68, 3, '#a88858');
  for (let i = 0; i < 5; i++) p.rect(10 + i * 14, 30, 3, 28, '#8a2a20');
  p.rect(32, 38, 16, 20, '#503020');
  p.rect(34, 40, 12, 18, '#382010');
  // Sweeping roof.
  p.rect(0, 16, 80, 10, '#3a5a78');
  p.rect(4, 8, 72, 9, '#3a5a78');
  p.rect(12, 2, 56, 7, '#4a6a88');
  p.hline(0, 25, 80, '#2a4058');
  p.rect(30, 0, 20, 3, '#d0a030');
  p.rect(34, 30, 12, 6, '#f0e0b0');
  p.hline(36, 33, 8, '#202020');
  return { bmp: finishProp(p), solid: { x: 4, y: 30, w: 72, h: 28 } };
});

registerProp('post_podium', () => {
  const p = new Painter(28, 26);
  p.rect(2, 10, 24, 15, '#d03030');
  p.rect(2, 10, 24, 2, '#f05050');
  p.rect(8, 15, 12, 6, '#f0d040');
  p.vline(10, 2, 9, '#303030'); p.vline(14, 0, 11, '#303030'); p.vline(18, 2, 9, '#303030');
  p.ellipse(9, 1, 3, 3, '#606060'); p.ellipse(13, 0, 3, 3, '#606060'); p.ellipse(17, 1, 3, 3, '#606060');
  return { bmp: finishProp(p), solid: { x: 2, y: 14, w: 24, h: 11 } };
});

registerProp('c14_clock', () => {
  const p = new Painter(32, 56);
  p.rect(4, 8, 24, 46, '#b0a8c8');
  p.vline(4, 8, 46, '#908aa8');
  p.ellipse(6, 12, 20, 20, '#f0f0f8');
  p.ellipse(8, 14, 16, 16, '#283048');
  p.line(16, 22, 16, 15, '#f0d040');
  p.line(16, 22, 21, 24, '#f0d040');
  p.rect(0, 2, 32, 7, '#c8c0e0');
  p.rect(2, 50, 28, 5, '#908aa8');
  return { bmp: finishProp(p), solid: { x: 4, y: 40, w: 24, h: 15 } };
});

// ---------------------------------------------------------------- set dressing: ZTV film lot
/** The cardboard bank front the robbers mistook for the real bank across the street. */
registerProp('c12_bankSet', () => {
  const p = new Painter(64, 44);
  // Wooden braces behind the flat, then the painted facade.
  p.line(6, 43, 14, 20, '#8a6a40'); p.line(57, 43, 49, 20, '#8a6a40');
  p.rect(2, 8, 60, 30, '#d8d0b8');
  p.rect(2, 8, 60, 3, '#f0e8d0');
  for (let i = 0; i < 4; i++) p.rect(6 + i * 15, 14, 5, 22, '#c0b8a0');
  p.rect(0, 0, 64, 9, '#b8b098');
  p.rect(18, 1, 28, 7, '#e0b040');
  p.rows(21, 2, [
    'xxx..xx..x..x.x..x',
    'x.x.x..x.xx.x.x.x.',
    'xxx.xxxx.x.xx.xx..',
    'x.x.x..x.x..x.x.x.',
    'xxx.x..x.x..x.x..x',
  ], { x: '#503010' });
  p.rect(27, 22, 10, 16, '#504838');
  p.rect(28, 23, 8, 15, '#383028');
  // Torn corner: it is only cardboard.
  p.line(52, 30, 61, 38, '#a89878'); p.rect(56, 34, 6, 4, '#a89878');
  p.rect(0, 38, 64, 6, '#787068');
  return { bmp: finishProp(p), solid: { x: 2, y: 36, w: 60, h: 8 } };
});

/** A studio light on a tripod. */
registerProp('c12_spotlight', () => {
  const p = new Painter(18, 34);
  p.line(9, 14, 2, 33, '#383840'); p.line(9, 14, 16, 33, '#383840'); p.vline(9, 12, 21, '#484850');
  p.rect(3, 2, 12, 10, '#303038');
  p.rect(4, 3, 10, 8, '#f8f0c0');
  p.rect(5, 4, 4, 3, '#ffffff');
  p.rect(1, 1, 16, 2, '#505060');
  return { bmp: finishProp(p), solid: { x: 4, y: 28, w: 10, h: 6 } };
});

/** A painted cardboard boulder for the "Space Monsters" scene. */
registerProp('c12_propRock', () => {
  const p = new Painter(30, 26);
  p.ellipse(1, 3, 28, 22, '#8a7a98');
  p.ellipse(3, 2, 22, 17, '#a898b8');
  p.ellipse(7, 4, 9, 6, '#c8b8d8');
  p.line(22, 6, 27, 12, '#6a5a78');
  p.rect(12, 22, 6, 4, '#8a6a40');
  return { bmp: finishProp(p), solid: { x: 2, y: 16, w: 26, h: 9 } };
});

/** An actor's trailer with a gold star on the door. */
registerProp('c12_trailer', () => {
  const p = new Painter(56, 34);
  p.rect(1, 4, 54, 24, '#e8e8f0');
  p.rect(1, 4, 54, 3, '#c8c8d8');
  p.rect(1, 20, 54, 2, '#3868c8');
  p.rect(6, 9, 10, 7, '#80b0e0'); p.rect(38, 9, 12, 7, '#80b0e0');
  p.rect(22, 8, 10, 18, '#b0b0c0');
  p.rows(24, 10, ['..x..', '.xxx.', 'xxxxx', '.x.x.'], { x: '#f0c030' });
  p.ellipse(6, 25, 8, 8, '#282828'); p.ellipse(42, 25, 8, 8, '#282828');
  return { bmp: finishProp(p), solid: { x: 1, y: 14, w: 54, h: 18 } };
});

/** Floor decals: a dolly track, an "X" tape mark and loose cables (walk-through). */
registerProp('c12_dollyTrack', () => {
  const p = new Painter(64, 12);
  for (let i = 0; i < 8; i++) p.rect(2 + i * 8, 1, 3, 10, '#7a5a38');
  p.hline(0, 3, 64, '#585e68'); p.hline(0, 8, 64, '#585e68');
  return { bmp: p.done(), solid: null, flat: true };
});
registerProp('c12_tapeMark', () => {
  const p = new Painter(16, 16);
  p.line(3, 3, 12, 12, '#f0d030'); p.line(4, 3, 13, 12, '#f0d030');
  p.line(12, 3, 3, 12, '#f0d030'); p.line(13, 3, 4, 12, '#f0d030');
  return { bmp: p.done(), solid: null, flat: true };
});
registerProp('c12_cables', () => {
  const p = new Painter(40, 14);
  p.line(0, 3, 10, 6, '#181818'); p.line(10, 6, 20, 4, '#181818'); p.line(20, 4, 31, 9, '#181818'); p.line(31, 9, 39, 8, '#181818');
  p.line(0, 9, 12, 11, '#202830'); p.line(12, 11, 24, 8, '#202830'); p.line(24, 8, 39, 12, '#202830');
  return { bmp: p.done(), solid: null, flat: true };
});

// ---------------------------------------------------------------- set dressing: poacher camp
/** The poachers' off-road truck. */
registerProp('c13_jeep', () => {
  const p = new Painter(40, 26);
  p.rect(1, 9, 38, 11, '#5a6038');
  p.rect(1, 9, 38, 2, '#7a8050');
  p.rect(6, 3, 14, 7, '#9ab0b8'); p.rect(6, 3, 14, 1, '#404830');
  p.vline(24, 1, 9, '#303428'); p.vline(36, 1, 9, '#303428'); p.hline(24, 1, 13, '#303428');
  p.rect(26, 6, 9, 3, '#806040');
  p.ellipse(3, 16, 9, 9, '#202020'); p.ellipse(28, 16, 9, 9, '#202020');
  p.px(7, 20, '#606060'); p.px(32, 20, '#606060');
  return { bmp: finishProp(p), solid: { x: 1, y: 10, w: 38, h: 14 } };
});

/** A radio mast with a warning light. */
registerProp('c13_antenna', () => {
  const p = new Painter(14, 42);
  p.vline(7, 4, 36, '#606870');
  for (let i = 0; i < 6; i++) p.line(3, 8 + i * 6, 11, 12 + i * 6, '#505860');
  p.rect(5, 0, 5, 4, '#e03030');
  p.rect(2, 38, 10, 4, '#484030');
  return { bmp: finishProp(p), solid: { x: 2, y: 36, w: 10, h: 6 } };
});

/** A log to sit on around the campfire. */
registerProp('c13_log', () => {
  const p = new Painter(28, 12);
  p.rect(2, 2, 24, 8, '#7a5030');
  p.hline(2, 2, 24, '#9a6a40');
  p.ellipse(0, 1, 6, 10, '#a07848'); p.ellipse(1, 3, 3, 5, '#704828');
  return { bmp: finishProp(p), solid: { x: 1, y: 3, w: 26, h: 8 } };
});

/** Floor decals: tyre ruts in the dirt, and a tarp of netting and rope (walk-through). */
/** Two pressed-in ruts with a tread pattern, `len` px long (vertical, or horizontal when `across`). */
function tyreRuts(len: number, across: boolean): Painter {
  const p = across ? new Painter(len, 16) : new Painter(16, len);
  const band = (o: number): void => {
    if (across) p.rect(0, o, len, 4, '#a07c54'); else p.rect(o, 0, 4, len, '#a07c54');
    for (let i = (o % 2); i < len; i += 3) {
      if (across) p.vline(i, o, 4, '#7c5c3c'); else p.hline(o, i, 4, '#7c5c3c');
    }
  };
  band(2);
  band(10);
  return p;
}
registerProp('c13_tracks', () => ({ bmp: tyreRuts(64, false).done(), solid: null, flat: true }));
registerProp('c13_tracksH', () => ({ bmp: tyreRuts(64, true).done(), solid: null, flat: true }));
registerProp('c13_tarp', () => {
  const p = new Painter(34, 24);
  p.rect(1, 2, 32, 20, '#3a6a58');
  p.rect(1, 2, 32, 2, '#4a8068');
  for (let i = 0; i < 6; i++) p.line(4 + i * 5, 5, 8 + i * 4, 19, '#2a4a40');
  p.ellipse(20, 8, 10, 8, '#c8a868'); p.ellipse(22, 10, 6, 4, '#a88848');
  return { bmp: p.done(), solid: null, flat: true };
});

registerScans({
  android17: { name: 'Android 17', hp: 8200, str: 60, pow: 60, end: 65, desc: 'A former android, now a park ranger on Monster Island. His energy never runs out.' },
  android18: { name: 'Android 18', hp: 7600, str: 58, pow: 58, end: 60, desc: 'Krillin\'s wife and Marron\'s mother. Will fight for a good price.' },
  tien: { name: 'Tien', hp: 6400, str: 52, pow: 54, end: 56, desc: 'A stoic martial artist who runs a mountain dojo with Chiaotzu.' },
  jiren: { name: 'Jiren', hp: '???', str: '???', pow: '???', end: '???', desc: 'Universe 11\'s Pride Trooper. Said to surpass even his God of Destruction.' },
  toppo: { name: 'Toppo', hp: 11500, str: 76, pow: 82, end: 82, desc: 'Leader of the Pride Troopers and a candidate God of Destruction.' },
  dyspo: { name: 'Dyspo', hp: 9800, str: 72, pow: 68, end: 70, desc: 'The fastest of the Pride Troopers. Reads movement before it happens.' },
  kefla: { name: 'Kefla', hp: 10000, str: 70, pow: 72, end: 72, desc: 'Caulifla and Kale fused by Potara earrings. Wild, proud and terrifying.' },
  c13_baba: { name: 'Fortuneteller Baba', hp: 40, str: 2, pow: 30, end: 3, desc: 'Master Roshi\'s older sister. Can bring the dead back for a single day.' },
  c13_yurin: { name: 'Yurin', hp: 900, str: 10, pow: 30, end: 8, desc: 'A former classmate of Tien with a long grudge and a talent for mind control.' },
  c12_barry: { name: 'Barry Kahn', hp: 30, str: 2, pow: 1, end: 2, desc: 'A famous actor. His ego is the strongest thing about him.' },
  c12_director: { name: 'Director', hp: 32, str: 2, pow: 1, end: 2, desc: 'Shouts "Cut!" at everything, including explosions.' },
  c12_cocoa: { name: 'Cocoa Amaguri', hp: 28, str: 1, pow: 1, end: 2, desc: 'A rising starlet with very sharp eyes.' },
  c13_marron: { name: 'Marron', hp: 12, str: 1, pow: 1, end: 1, desc: 'Krillin and 18\'s daughter. Loves animals and ice cream.' },
});
