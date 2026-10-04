import { finishProp, registerProp, type PropArt } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';
import { registerScans } from '../../scans';

/**
 * Act 3 art: extra cast (Universe 6, Galactic Patrol, Potaufeu), creatures for the Nameless Planet rim and
 * Potaufeu, and custom landmark props (Whis's cube, the arena portraits, Super Shenron, giant mushrooms...).
 */

const GOO_SKIN = '#b868d8';
const GOO_DARK = '#7a3098';

registerCast(
  {
    c07_magetta: {
      body: 'big', skin: '#6c7078', hair: 'helmet', hairColor: '#4c5058', accent: '#f08030', eye: '#f8a020',
      top: '#5c6068', topStyle: 'armor', under: '#3c4048', sleeves: 'none', belt: '#f08030', pants: '#4c5058',
      boots: '#3c4048', face: 'stern',
    },
    c07_announcer: {
      body: 'male', skin: '#e0a8c8', hair: 'mohawk', hairColor: '#f0d040', top: '#d03040', topStyle: 'suit',
      under: '#f0f0f0', sleeves: 'long', pants: '#202030', boots: '#202020', face: 'gentle',
    },
    c07_vendor: {
      body: 'big', skin: '#b0d080', hair: 'antennae', hairColor: '#80a060', top: '#f0f0f0', topStyle: 'vest',
      under: '#e05030', sleeves: 'none', belt: '#e05030', pants: '#604030', boots: '#402010', face: 'gentle',
    },
    c07_galacticKing: {
      body: 'big', skin: '#d8a8e0', hair: 'hat', hairColor: '#e0c040', accent: '#c03030', top: '#c03030',
      topStyle: 'robe', under: '#e0c040', sleeves: 'long', belt: '#e0c040', pants: '#283060', boots: '#e0c040', face: 'beard',
    },
    c07_attendant: {
      body: 'male', skin: '#90c0b0', hair: 'bald', hairColor: '#90c0b0', top: '#384878', topStyle: 'robe',
      under: '#e0c040', sleeves: 'long', pants: '#384878', boots: '#202030', ears: 'pointed', face: 'gentle',
    },
    c08_potage: {
      body: 'male', skin: '#a8b8d8', hair: 'bald', hairColor: '#a8b8d8', top: '#806850', topStyle: 'robe',
      under: '#584838', sleeves: 'long', pants: '#584838', boots: '#382818', ears: 'pointed', face: 'beard',
    },
    c08_gryll: {
      body: 'big', skin: '#70a060', hair: 'mohawk', hairColor: '#304020', top: '#504050', topStyle: 'armor',
      under: '#302830', sleeves: 'none', pants: '#302830', boots: '#202020', face: 'stern',
    },
    c08_gooGryll: {
      body: 'big', skin: GOO_SKIN, hair: 'mohawk', hairColor: GOO_DARK, top: '#8a48b0', topStyle: 'armor',
      under: GOO_DARK, sleeves: 'none', pants: GOO_DARK, boots: '#40205a', eye: '#f8f070', face: 'stern',
    },
    c08_gooHench: {
      body: 'male', skin: GOO_SKIN, hair: 'helmet', hairColor: GOO_DARK, accent: '#f8f070', top: '#8a48b0',
      topStyle: 'armor', under: GOO_DARK, sleeves: 'long', pants: GOO_DARK, boots: '#40205a', eye: '#f8f070',
    },
    c08_gooGoten: {
      body: 'child', skin: GOO_SKIN, hair: 'goku', hairColor: GOO_DARK, top: '#9a50c0', topStyle: 'gi',
      under: GOO_DARK, sleeves: 'short', belt: GOO_DARK, pants: '#9a50c0', boots: GOO_DARK, eye: '#f8f070',
    },
    c08_gooTrunks: {
      body: 'child', skin: GOO_SKIN, hair: 'trunksKid', hairColor: '#d8a0f0', top: GOO_DARK, topStyle: 'vest',
      under: '#9a50c0', sleeves: 'long', belt: '#f8f070', pants: GOO_DARK, boots: '#d8a0f0', eye: '#f8f070',
    },
    c08_monakaCostume: {
      body: 'big', skin: '#5870c8', hair: 'bald', hairColor: '#5870c8', top: '#e8e8e8', topStyle: 'suit',
      under: '#e8e8e8', sleeves: 'long', pants: '#e8e8e8', boots: '#d03030', tail: '#9070c0', eye: '#e8e040',
    },
    c08_patrolman: {
      body: 'male', skin: '#80c0a0', hair: 'helmet', hairColor: '#f0f0f0', accent: '#3070e0', top: '#f0f0f0',
      topStyle: 'suit', under: '#303030', sleeves: 'long', pants: '#303030', boots: '#f0f0f0', eye: '#101010',
    },
  },
  {
    c07_magetta: 'Magetta', c07_announcer: 'Announcer', c07_vendor: 'Snack Vendor', c07_galacticKing: 'Galactic King',
    c07_attendant: 'Attendant', c08_potage: 'Potage', c08_gryll: 'Gryll', c08_gooGryll: 'Copy Gryll',
    c08_gooHench: 'Copy Henchman', c08_gooGoten: 'Copy Goten', c08_gooTrunks: 'Copy Trunks',
    c08_monakaCostume: 'Monaka', c08_patrolman: 'Patrolman',
  },
);

registerCreatures({
  c07_debrisCrawler: { kind: 'crab', body: '#8a8478', accent: '#e09040', size: 32 },
  c07_rockWisp: { kind: 'drone', body: '#c87838', accent: '#f8e070', size: 24 },
  c07_debrisGolem: { kind: 'robot', body: '#7a6c5c', accent: '#f0a030', size: 40 },
  c08_core: { kind: 'blob', body: '#d050d0', accent: '#f8f070', eye: '#f8f8f8', size: 24 },
  c08_gooBlob: { kind: 'blob', body: '#9040c0', eye: '#f8f070', size: 32 },
  c08_sporeBeetle: { kind: 'bug', body: '#a06838', accent: '#f0d0a0', horns: true, stripes: true, size: 32 },
});

registerScans({
  c07_magetta: { name: 'Auta Magetta', kind: 'U6 metal-man / Team U6', hp: 4800, str: 36, pow: 38, end: 44, desc: 'A metal giant from Universe 6. Spits magma and runs hot. Surprisingly sensitive.' },
  c07_announcer: { name: 'Announcer', kind: 'Nameless Planet / staff', hp: 30, str: 1, pow: 1, end: 2, desc: 'The tournament\'s announcer. Brave enough to referee two Gods of Destruction.' },
  c07_vendor: { name: 'Snack Vendor', kind: 'Nameless Planet / vendor', hp: 45, str: 3, pow: 1, end: 3, desc: 'Runs the only concession stand in the neutral zone. Prices are cosmic.' },
  c07_galacticKing: { name: 'Galactic King', kind: 'U7 / Galactic Patrol', hp: 900, str: 12, pow: 30, end: 20, desc: 'Ruler of the Galactic Patrol and Jaco\'s boss. Knows a great deal about Hit.' },
  c08_potage: { name: 'Potage', kind: 'U7 / Potaufeu', hp: 60, str: 4, pow: 2, end: 6, desc: 'The last guardian of Potaufeu. Has kept the Commeson sealed for over a century.' },
  c08_monakaCostume: { name: 'Monaka', kind: 'U7 / costume', hp: '???', str: '???', pow: '???', end: '???', desc: 'The strongest fighter in Universe 7. The scouter insists this is a costume.' },
  c08_patrolman: { name: 'Patrolman', kind: 'U7 / Galactic Patrol', hp: 700, str: 14, pow: 16, end: 12, desc: 'A Galactic Patrol officer. Considerably more competent than Jaco, according to Jaco\'s file.' },
});

// ------------------------------------------------------------------ props

/** Whis's travel cube (Universe 7) or Vados's cube (Universe 6). */
function cube(face: string, edge: string, glyph: string): () => PropArt {
  return () => {
    const p = new Painter(48, 44);
    p.rect(4, 10, 40, 32, face);
    p.rect(10, 2, 34, 8, edge);
    p.rect(44, 4, 2, 36, edge);
    for (let i = 0; i < 8; i++) { p.px(4 + i, 9 - i, edge); p.px(44 + Math.min(1, i), 9 - i, edge); }
    p.rect(4, 10, 40, 1, '#f8f8ff'); p.rect(4, 41, 40, 1, '#f8f8ff');
    p.vline(4, 10, 32, '#f8f8ff'); p.vline(43, 10, 32, '#f8f8ff');
    p.ellipse(16, 18, 16, 16, glyph);
    p.ellipse(19, 21, 10, 10, face);
    p.rect(23, 14, 2, 24, glyph);
    p.speckle(6, 12, 36, 28, ['#f8f8ff'], 0.03, 17);
    return { bmp: finishProp(p), solid: { x: 4, y: 30, w: 40, h: 12 } };
  };
}
registerProp('c07_cubeU7', cube('#a8d8f0', '#78a8d0', '#4890e0'));
registerProp('c07_cubeU6', cube('#c8b0e8', '#9878c8', '#7050b0'));

/** A giant framed portrait of a God of Destruction, standing beside the ring. */
function godPortrait(fur: string, belly: string, robe: string): () => PropArt {
  return () => {
    const p = new Painter(32, 40);
    p.rect(0, 0, 32, 34, '#c89830'); p.rect(2, 2, 28, 30, '#302838');
    p.ellipse(8, 8, 16, 16, fur);
    p.rect(7, 4, 4, 7, fur); p.rect(21, 4, 4, 7, fur);
    p.rect(8, 6, 2, 3, belly); p.rect(22, 6, 2, 3, belly);
    p.rect(11, 13, 3, 2, '#f8f040'); p.rect(18, 13, 3, 2, '#f8f040');
    p.rect(12, 13, 1, 2, '#101010'); p.rect(19, 13, 1, 2, '#101010');
    p.rect(14, 19, 4, 1, '#402030');
    p.rect(6, 24, 20, 8, robe); p.rect(14, 24, 4, 8, '#e0c040');
    p.rect(13, 34, 6, 6, '#a07828');
    return { bmp: finishProp(p), solid: null };
  };
}
registerProp('c07_portraitBeerus', godPortrait('#9070c0', '#e8a0b0', '#202028'));
registerProp('c07_portraitChampa', godPortrait('#8078c0', '#e8a0b0', '#3858a8'));

registerProp('c07_banner', () => {
  const p = new Painter(16, 34);
  p.rect(7, 0, 2, 34, '#706858');
  p.rect(1, 2, 14, 18, '#c03838'); p.rect(1, 2, 14, 2, '#e0c040');
  p.ellipse(4, 7, 8, 8, '#e0c040'); p.rect(7, 9, 2, 4, '#c03838');
  for (let i = 0; i < 7; i++) p.px(1 + i * 2, 20, '#c03838');
  return { bmp: finishProp(p), solid: { x: 5, y: 28, w: 6, h: 5 } };
});

registerProp('c07_bench', () => {
  const p = new Painter(32, 14);
  p.rect(0, 2, 32, 5, '#a07040'); p.rect(0, 2, 32, 1, '#c89060');
  p.rect(2, 7, 3, 6, '#704828'); p.rect(27, 7, 3, 6, '#704828');
  return { bmp: finishProp(p), solid: { x: 0, y: 4, w: 32, h: 9 } };
});

registerProp('c07_scoreboard', () => {
  const p = new Painter(48, 30);
  p.rect(0, 0, 48, 24, '#282838'); p.rect(2, 2, 44, 20, '#101018');
  p.rect(6, 6, 14, 12, '#2848b8'); p.rect(28, 6, 14, 12, '#7050b0');
  p.rect(10, 9, 6, 6, '#f8f8f8'); p.rect(32, 9, 6, 6, '#f8f8f8');
  p.rect(22, 10, 4, 3, '#f8d040');
  p.rect(8, 24, 4, 6, '#504858'); p.rect(36, 24, 4, 6, '#504858');
  return { bmp: finishProp(p), solid: { x: 0, y: 18, w: 48, h: 8 } };
});

registerProp('c07_superShenron', () => {
  const p = new Painter(144, 96);
  const body = '#f0a020';
  const dark = '#c87010';
  // Coiling body behind the head.
  for (let i = 0; i < 140; i++) {
    const y = 60 + Math.round(Math.sin(i / 14) * 18);
    p.rect(i, y, 4, 14, i % 9 < 2 ? dark : body);
    if (i % 12 === 0) p.rect(i, y - 3, 3, 3, '#f8e070');
  }
  // Head.
  p.ellipse(42, 8, 60, 48, body);
  p.ellipse(50, 30, 44, 26, '#f8c040');
  p.rect(40, 4, 6, 18, '#f8e070'); p.rect(96, 4, 6, 18, '#f8e070');
  p.line(44, 4, 30, -2, '#f8e070'); p.line(98, 4, 112, -2, '#f8e070');
  p.ellipse(56, 20, 10, 8, '#f8f8f8'); p.ellipse(78, 20, 10, 8, '#f8f8f8');
  p.rect(60, 22, 3, 4, '#e02020'); p.rect(82, 22, 3, 4, '#e02020');
  p.rect(56, 42, 30, 3, dark);
  p.line(48, 40, 20, 50, '#f8e070'); p.line(94, 40, 124, 50, '#f8e070');
  // Wings of the Super Dragon.
  p.line(10, 30, 40, 20, '#f8d060'); p.line(132, 30, 102, 20, '#f8d060');
  return { bmp: finishProp(p), solid: null };
});

/** Mrs. Briefs's seven-layer strawberry cake tower, waiting on the party table. */
registerProp('c07_cakeTower', () => {
  const p = new Painter(18, 22);
  p.rect(1, 16, 16, 5, '#f8f0e8'); p.rect(1, 16, 16, 1, '#f8a0b0');
  p.rect(3, 10, 12, 6, '#f8e8e0'); p.rect(3, 10, 12, 1, '#f8a0b0');
  p.rect(5, 5, 8, 5, '#f8f0e8'); p.rect(5, 5, 8, 1, '#f8a0b0');
  for (const [x, y] of [[3, 15], [8, 15], [13, 15], [5, 9], [11, 9], [8, 4]]) p.rect(x, y, 2, 2, '#e02838');
  p.rect(8, 1, 2, 3, '#f8d060');
  p.hline(0, 21, 18, '#c8c0b8');
  return { bmp: finishProp(p), solid: null };
});

registerProp('c06_barrier', () => {
  const p = new Painter(160, 112);
  const ring = (inset: number, color: string) => {
    const w = 160 - inset * 2;
    const h = 112 - inset * 2;
    for (let a = 0; a < 720; a++) {
      const t = (a / 720) * Math.PI * 2;
      p.px(80 + Math.cos(t) * (w / 2 - 1), 56 + Math.sin(t) * (h / 2 - 1), color);
    }
  };
  ring(0, '#a8e0ff'); ring(2, '#68b8f0'); ring(5, '#3888d0');
  for (let i = 0; i < 24; i++) p.px(20 + ((i * 37) % 120), 12 + ((i * 53) % 88), '#d8f0ff');
  return { bmp: p.done(), solid: null, flat: true };
});

registerProp('c06_earthChunk', () => {
  const p = new Painter(32, 24);
  p.ellipse(0, 6, 32, 18, '#806048');
  p.ellipse(2, 2, 26, 12, '#48a040');
  p.ellipse(6, 3, 10, 5, '#68c058');
  p.rect(18, 12, 6, 4, '#3870c8');
  return { bmp: finishProp(p), solid: null };
});

registerProp('c08_mushroom', () => {
  const p = new Painter(40, 48);
  p.rect(16, 22, 8, 24, '#e8dcc0'); p.vline(16, 22, 24, '#c8bca0');
  p.ellipse(10, 40, 20, 8, '#c8b890');
  p.ellipse(0, 2, 40, 26, '#d86848');
  p.ellipse(2, 3, 34, 18, '#f08860');
  p.ellipse(8, 6, 6, 5, '#f8e0c8'); p.ellipse(22, 4, 7, 5, '#f8e0c8'); p.ellipse(28, 12, 5, 4, '#f8e0c8');
  p.rect(4, 22, 32, 2, '#a84830');
  return { bmp: finishProp(p), solid: { x: 14, y: 38, w: 12, h: 8 } };
});

registerProp('c08_mushroomBlue', () => {
  const p = new Painter(28, 34);
  p.rect(11, 14, 6, 18, '#e0e0f0');
  p.ellipse(0, 1, 28, 18, '#5868c8');
  p.ellipse(2, 2, 22, 11, '#7890e8');
  p.ellipse(6, 4, 5, 4, '#e0f0ff'); p.ellipse(17, 6, 4, 3, '#e0f0ff');
  return { bmp: finishProp(p), solid: { x: 9, y: 26, w: 10, h: 6 } };
});

registerProp('c08_truck', () => {
  const p = new Painter(56, 34);
  p.rect(2, 6, 36, 22, '#f0f0f0'); p.rect(38, 12, 16, 16, '#e8e8e8');
  p.rect(40, 14, 10, 7, '#80b8e0');
  p.rect(2, 16, 52, 3, '#d03030');
  p.ellipse(8, 24, 10, 10, '#303030'); p.ellipse(40, 24, 10, 10, '#303030');
  p.ellipse(11, 27, 4, 4, '#a0a0a0'); p.ellipse(43, 27, 4, 4, '#a0a0a0');
  p.rect(10, 9, 18, 5, '#5870c8');
  return { bmp: finishProp(p), solid: { x: 2, y: 14, w: 52, h: 18 } };
});

registerProp('c08_seal', () => {
  const p = new Painter(48, 40);
  p.ellipse(0, 4, 48, 34, '#585068');
  p.ellipse(4, 6, 40, 28, '#787088');
  p.ellipse(12, 12, 24, 16, '#383048');
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    p.rect(22 + Math.round(Math.cos(t) * 16), 18 + Math.round(Math.sin(t) * 11), 3, 3, '#f8d060');
  }
  p.ellipse(18, 15, 12, 10, '#a050c0');
  return { bmp: finishProp(p), solid: { x: 2, y: 14, w: 44, h: 22 } };
});

registerProp('c08_sealBroken', () => {
  const p = new Painter(48, 40);
  p.ellipse(0, 4, 48, 34, '#585068');
  p.ellipse(4, 6, 40, 28, '#686078');
  p.ellipse(12, 12, 24, 16, '#181020');
  p.line(8, 10, 22, 22, '#282030'); p.line(40, 8, 28, 22, '#282030'); p.line(24, 34, 25, 24, '#282030');
  return { bmp: finishProp(p), solid: { x: 2, y: 14, w: 44, h: 22 } };
});

registerProp('c08_vaultDoor', () => {
  const p = new Painter(64, 40);
  p.rect(0, 0, 64, 40, '#686070');
  p.rect(4, 4, 56, 36, '#484050');
  p.rect(16, 10, 32, 30, '#181020');
  p.ellipse(22, 2, 20, 14, '#a050c0');
  p.ellipse(27, 5, 10, 8, '#f8d060');
  for (let i = 0; i < 6; i++) p.rect(6 + i * 10, 36, 6, 4, '#787088');
  return { bmp: finishProp(p), solid: null };
});

/** Pedestal glyph pillars that pin the Commeson core once lit. */
registerProp('c08_glyphPillar', () => {
  const p = new Painter(16, 32);
  p.rect(2, 4, 12, 26, '#686078'); p.rect(0, 26, 16, 6, '#484058');
  p.rect(5, 8, 6, 6, '#f8d060'); p.rect(7, 16, 2, 6, '#f8d060');
  return { bmp: finishProp(p), solid: { x: 0, y: 24, w: 16, h: 8 } };
});
