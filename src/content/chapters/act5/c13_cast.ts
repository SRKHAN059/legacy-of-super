import { finishProp, registerProp } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';
import { registerScans, SCANS, type ScanEntry } from '../../scans';

/**
 * Chapter 13 side episodes, art: Universe 6's Saiyans on Sadala (Caulifla's first Super Saiyan, Kale's first
 * berserk Legendary form, Renso, Caulifla's gang and the people of the old quarter), Sadala's wildlife and set
 * dressing, Champa's feast, and the scouter readings for all of them.
 */

const SKIN = '#f8c890';
const SKIN_TAN = '#e8b078';

registerCast({
  // Caulifla minutes after Cabba's lesson: the same gang-boss outfit as her base sprite, hair gone gold.
  c13_cauliflaSSJ: { body: 'female', skin: SKIN, hair: 'spikyTail', hairColor: '#f8e048', accent: '#d04870', eye: '#208868', top: '#d04870', topStyle: 'vest', under: '#202020', sleeves: 'none', belt: '#e0c040', pants: '#683058', boots: '#202020', face: 'stern' },
  // Kale's first Legendary transformation (ep 93): bulked up, hair a sickly yellow-green, eyes blank white.
  c13_kaleBerserk: { body: 'big', skin: SKIN, hair: 'ssj', hairColor: '#b8f060', eye: '#f0fff0', top: '#d04870', topStyle: 'vest', under: '#d04870', sleeves: 'none', belt: '#e0c040', pants: '#d04870', boots: '#202020', face: 'stern' },
  c13_renso: { body: 'male', skin: SKIN_TAN, hair: 'spiky', hairColor: '#202030', top: '#c89848', topStyle: 'shirt', sleeves: 'short', belt: '#604020', pants: '#4a5468', boots: '#382818', face: 'gentle' },
  c13_gangPunk: { body: 'male', skin: SKIN, hair: 'spiky', hairColor: '#181820', top: '#683058', topStyle: 'vest', under: SKIN, sleeves: 'none', belt: '#e0c040', pants: '#303038', boots: '#202020', wrist: '#d04870', face: 'stern' },
  c13_gangBrute: { body: 'big', skin: SKIN_TAN, hair: 'mohawk', hairColor: '#181820', top: '#504048', topStyle: 'vest', under: SKIN_TAN, sleeves: 'none', belt: '#a07030', pants: '#683058', boots: '#202020', wrist: '#e0c040', face: 'stern' },
  c13_gangSlinger: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#202028', accent: '#d04870', top: '#303038', topStyle: 'vest', under: '#d04870', sleeves: 'none', belt: '#e0c040', pants: '#683058', boots: '#202020', face: 'shades' },
  c13_sadalan: { body: 'male', skin: SKIN_TAN, hair: 'spiky', hairColor: '#282830', top: '#6a7a50', topStyle: 'shirt', sleeves: 'short', belt: '#504030', pants: '#504838', boots: '#382818' },
  c13_sadalanF: { body: 'female', skin: SKIN, hair: 'ponytail', hairColor: '#202028', top: '#c08850', topStyle: 'dress', sleeves: 'short', pants: '#c08850', boots: '#5a3a20', face: 'gentle' },
  // The Sadala Defense Force wears Cabba's armour.
  c13_sadalaGuard: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#202028', top: '#405890', topStyle: 'armor', under: '#d0c0a0', sleeves: 'short', pants: '#405890', boots: '#d0c0a0', face: 'stern' },
}, {
  c13_cauliflaSSJ: 'Caulifla', c13_kaleBerserk: 'Kale', c13_renso: 'Renso', c13_gangPunk: 'Gang Punk', c13_gangBrute: 'Gang Bruiser',
  c13_gangSlinger: 'Gang Slinger', c13_sadalan: 'Sadalan', c13_sadalanF: 'Sadalan', c13_sadalaGuard: 'Defense Force',
});

registerCreatures({
  // Pterodactyls are native to Sadala (the anime shows them over the crags).
  c13_sadalaPtero: { kind: 'flyer', body: '#8a5a48', belly: '#e8c098', accent: '#d04870', horns: true, size: 40 },
  c13_cragHound: { kind: 'quadruped', body: '#8a6a50', belly: '#c8a880', accent: '#4a3628', horns: true, size: 32 },
});

// ---------------------------------------------------------------- Sadala set dressing

/** A flat-roofed sandstone house of the old quarter (Renso's home). */
registerProp('c13_sadalaHouse', () => {
  const p = new Painter(48, 44);
  p.rect(3, 14, 42, 28, '#c8a070');
  p.rect(3, 14, 42, 3, '#e0bc88');
  for (let i = 0; i < 6; i++) p.hline(4, 20 + i * 4, 40, '#b88c5c');
  // Flat roof with a parapet and a water tank.
  p.rect(0, 8, 48, 7, '#9a7450');
  p.rect(0, 8, 48, 2, '#b88c5c');
  p.rect(32, 0, 10, 9, '#707880');
  p.rect(32, 0, 10, 2, '#9098a0');
  // Round Saiyan window and the door.
  p.ellipse(8, 20, 10, 10, '#503828');
  p.ellipse(10, 22, 6, 6, '#88b8d8');
  p.rect(26, 26, 10, 16, '#5a3a24');
  p.rect(27, 27, 8, 15, '#3a2414');
  p.px(33, 34, '#e0c040');
  return { bmp: finishProp(p), solid: { x: 3, y: 18, w: 42, h: 24 } };
});

/** A sandstone tower of the Saiyan city: round, banded, with a dark slit window. */
registerProp('c13_sadalaTower', () => {
  const p = new Painter(32, 60);
  p.rect(4, 8, 24, 50, '#b89068');
  p.vline(4, 8, 50, '#9a7450');
  p.vline(27, 8, 50, '#d0aa80');
  for (let i = 0; i < 4; i++) p.hline(4, 16 + i * 11, 24, '#9a7450');
  p.ellipse(2, 0, 28, 12, '#a07850');
  p.ellipse(6, 2, 20, 6, '#c8a070');
  p.rect(14, 22, 4, 10, '#2a2018');
  p.rect(13, 46, 6, 12, '#4a3020');
  return { bmp: finishProp(p), solid: { x: 4, y: 40, w: 24, h: 18 } };
});

/** Caulifla's throne: a car seat bolted onto stacked tyres and scrap. */
registerProp('c13_scrapThrone', () => {
  const p = new Painter(32, 34);
  p.ellipse(1, 22, 30, 12, '#202020');
  p.ellipse(7, 25, 18, 6, '#404040');
  p.ellipse(3, 16, 26, 10, '#282828');
  p.ellipse(9, 18, 14, 5, '#484848');
  p.rect(6, 0, 20, 18, '#a03050');
  p.rect(8, 2, 16, 14, '#c84868');
  p.rect(3, 10, 4, 10, '#806870');
  p.rect(25, 10, 4, 10, '#806870');
  p.line(5, 3, 1, 0, '#b0a8a0');
  p.line(27, 3, 31, 0, '#b0a8a0');
  return { bmp: finishProp(p), solid: { x: 2, y: 18, w: 28, h: 15 } };
});

/** An oil drum with a fire burning in it. */
registerProp('c13_oilDrum', () => {
  const p = new Painter(16, 24);
  p.rect(2, 10, 12, 13, '#506070');
  p.hline(2, 13, 12, '#384858');
  p.hline(2, 19, 12, '#384858');
  p.ellipse(2, 8, 12, 5, '#283038');
  p.ellipse(4, 0, 8, 10, '#f08020');
  p.ellipse(6, 3, 4, 6, '#f8e040');
  return { bmp: finishProp(p), solid: { x: 2, y: 12, w: 12, h: 11 } };
});

/** A sagging couch from the hideout's "living room". */
registerProp('c13_couch', () => {
  const p = new Painter(36, 20);
  p.rect(1, 2, 34, 9, '#6a4a7a');
  p.rect(1, 10, 34, 8, '#7a5a8a');
  p.rect(0, 6, 5, 12, '#5a3a6a');
  p.rect(31, 6, 5, 12, '#5a3a6a');
  p.line(12, 12, 18, 15, '#e0d0b0');
  p.rect(20, 4, 6, 5, '#5a3a6a');
  return { bmp: finishProp(p), solid: { x: 0, y: 6, w: 36, h: 13 } };
});

/** A market stall with a striped awning and a crate of vegetables. */
registerProp('c13_stall', () => {
  const p = new Painter(34, 30);
  p.vline(3, 8, 20, '#604030');
  p.vline(30, 8, 20, '#604030');
  for (let i = 0; i < 6; i++) p.rect(1 + i * 5, 2, 5, 7, i % 2 ? '#f0e0c0' : '#c84040');
  p.rect(1, 9, 32, 2, '#a03030');
  p.rect(2, 18, 30, 10, '#8a6a40');
  p.rect(2, 18, 30, 2, '#a88050');
  for (let i = 0; i < 7; i++) p.ellipse(4 + i * 4, 14 + (i % 2), 4, 4, ['#68b048', '#e08030', '#d04040', '#e8d050'][i % 4]);
  return { bmp: finishProp(p), solid: { x: 2, y: 18, w: 30, h: 11 } };
});

/** Floor decal: the gang's spray-painted crown mark on the street (walk-through). */
registerProp('c13_tag', () => {
  const p = new Painter(32, 18);
  p.rows(4, 2, [
    'x...x...x...x...x...x',
    'xx..xx.xxx.xx..xx..xx',
    'xxx.xxxxxxxxx.xxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxx',
    '.xxxxxxxxxxxxxxxxxxx.',
    '..xxxxxxxxxxxxxxxxx..',
  ], { x: '#d04870' });
  p.rows(8, 10, ['yyyyyyyyyyyyy', '.y.........y.', '..yyyyyyyyy..'], { y: '#e0c040' });
  return { bmp: p.done(), solid: null, flat: true };
});

/** A tall red sandstone spire of the Sadala badlands. */
registerProp('c13_rockSpire', () => {
  const p = new Painter(26, 50);
  p.rect(9, 2, 8, 46, '#a05a40');
  p.rect(6, 14, 14, 34, '#a05a40');
  p.rect(3, 30, 20, 18, '#a05a40');
  p.vline(9, 2, 46, '#c07858');
  p.vline(6, 14, 34, '#c07858');
  p.vline(3, 30, 18, '#c07858');
  for (let i = 0; i < 5; i++) p.hline(4 + i, 18 + i * 7, 16 - i * 2, '#804030');
  p.rect(1, 46, 24, 4, '#704030');
  return { bmp: finishProp(p), solid: { x: 3, y: 38, w: 20, h: 11 } };
});

/** Champa's feast: a long table heaped with dishes from every planet he has eaten his way across. */
registerProp('c13_feast', () => {
  const p = new Painter(64, 30);
  p.rect(2, 10, 60, 12, '#f0f0f8');
  p.rect(2, 20, 60, 4, '#c8c8d8');
  p.rect(4, 24, 3, 6, '#806040');
  p.rect(57, 24, 3, 6, '#806040');
  const dishes: Array<[number, string, string]> = [[5, '#e08030', '#f8d070'], [16, '#68b048', '#e04040'], [27, '#c06040', '#f0e0b0'], [38, '#f0d040', '#e08080'], [49, '#a050c0', '#f8f0f8']];
  for (const [x, a, b] of dishes) {
    p.ellipse(x, 9, 11, 6, '#d8d8e0');
    p.ellipse(x + 1, 4, 9, 8, a);
    p.ellipse(x + 3, 4, 4, 3, b);
  }
  p.rect(30, 0, 4, 8, '#f8f0c0');
  return { bmp: finishProp(p), solid: { x: 2, y: 12, w: 60, h: 14 } };
});

// ---------------------------------------------------------------- scouter

/** Readings for the new sprites (and the Chapter 13 creatures and extras that never had one). */
const READINGS: Record<string, ScanEntry> = {
  c13_cauliflaSSJ: { name: 'Caulifla', kind: 'U6 Saiyan / Sadala', hp: 6800, str: 56, pow: 58, end: 60, desc: 'Caulifla of Universe 6, Super Saiyan on her very first try. Leads a street gang on Sadala and answers to nobody.' },
  c13_kaleBerserk: { name: 'Kale', kind: 'U6 Saiyan / Sadala', hp: '???', str: '???', pow: '???', end: '???', desc: 'Kale\'s Legendary Super Saiyan form, out of control. The readings keep climbing until the scouter gives up.' },
  c13_renso: { name: 'Renso', kind: 'U6 Saiyan / Sadala', hp: 2600, str: 30, pow: 30, end: 32, desc: 'Retired captain of the Sadala Defense Force. Cabba\'s old commander and Caulifla\'s big brother. Bad leg, good heart.' },
  c13_gangPunk: { name: 'Gang Punk', kind: 'U6 Saiyan / street gang', hp: 1800, str: 44, pow: 1, end: 40, desc: 'One of Caulifla\'s street toughs. A Saiyan with a lot of energy and nothing to spend it on.' },
  c13_gangBrute: { name: 'Gang Bruiser', kind: 'U6 Saiyan / street gang', hp: 2200, str: 48, pow: 1, end: 44, desc: 'The biggest member of Caulifla\'s gang. Charges first, thinks never.' },
  c13_gangSlinger: { name: 'Gang Slinger', kind: 'U6 Saiyan / street gang', hp: 1600, str: 42, pow: 48, end: 40, desc: 'Throws ki blasts from behind the rubble of the old quarter. Wears sunglasses at night.' },
  c13_sadalan: { name: 'Sadalan', kind: 'U6 Saiyan / Sadala', hp: 800, str: 14, pow: 10, end: 12, desc: 'A Saiyan of Universe 6. On Sadala even the shopkeepers could bench-press a car.' },
  c13_sadalanF: { name: 'Sadalan', kind: 'U6 Saiyan / Sadala', hp: 760, str: 12, pow: 12, end: 11, desc: 'A Saiyan of Universe 6, haggling at the market like it is a martial art.' },
  c13_sadalaGuard: { name: 'Defense Force', kind: 'U6 Saiyan / Sadala army', hp: 1900, str: 26, pow: 24, end: 25, desc: 'A soldier of the Sadala Defense Force. Saiyans who protect people instead of conquering them.' },
  c13_sadalaPtero: { name: 'Crag Pterodactyl', kind: 'U6 animal / Sadala', hp: 1800, str: 50, pow: 1, end: 42, desc: 'Sadala\'s native pterodactyl. Nests on the red spires east of the old quarter.' },
  c13_cragHound: { name: 'Crag Hound', kind: 'U6 animal / Sadala', hp: 1850, str: 50, pow: 1, end: 46, desc: 'A rock-skinned hound of the Sadala badlands. Saiyan kids race them for fun.' },
  c13_student: { name: 'Student', kind: 'Earthling / Tien-Shin', hp: 1100, str: 18, pow: 14, end: 15, desc: 'A student of the Tien-Shin school. Disciplined, polite, and a little scared of Yurin.' },
  c13_minotaurus: { name: 'Minotaurus', kind: 'Animal / Monster Island', hp: 4200, str: 40, pow: 1, end: 44, desc: 'Monster Island\'s rarest animal, protected by Android 17. Poachers prize its horns.' },
  c13_puffball: { name: 'Puffball', kind: 'Animal / Monster Island', hp: 60, str: 1, pow: 1, end: 2, desc: 'A Monster Island fluffball. Rolls away when scared, which is always.' },
  c13_babyDino: { name: 'Baby Dino', kind: 'Dinosaur / Monster Island', hp: 420, str: 9, pow: 1, end: 8, desc: 'A young Monster Island dinosaur. Loves warm places and anything that looks like its mother.' },
  c13_glowMoth: { name: 'Glow Moth', kind: 'Insect / Monster Island', hp: 40, str: 1, pow: 3, end: 1, desc: 'A Monster Island moth that glows at dusk. Collectors pay fortunes for its wings.' },
  c13_emeraldKite: { name: 'Emerald Kite', kind: 'Bird / Monster Island', hp: 180, str: 6, pow: 1, end: 4, desc: 'A green bird of prey from Monster Island. Frightened, it flies far out to sea and roosts on lonely islands.' },
  c13_cliffBat: { name: 'Cliff Bat', kind: 'Bat / Monster Island', hp: 90, str: 3, pow: 1, end: 3, desc: 'A Monster Island bat that roosts in sealed caves. Hates bright light and loud Saiyans.' },
  c13_rainbowSnake: { name: 'Rainbow Snake', kind: 'Snake / Monster Island', hp: 260, str: 7, pow: 1, end: 6, desc: 'A harmless Monster Island snake with every colour on its scales.' },
  // The Universe 6 Saiyans in their everyday forms. The shared scouter table owns these characters: fill only gaps.
  caulifla: { name: 'Caulifla', kind: 'U6 Saiyan / Sadala', hp: 5600, str: 48, pow: 50, end: 50, desc: 'Leader of a street gang on Sadala and Renso\'s little sister. Fights for the thrill of getting stronger.' },
  kale: { name: 'Kale', kind: 'U6 Saiyan / Sadala', hp: 4800, str: 42, pow: 40, end: 46, desc: 'Caulifla\'s shy protegee. Hides a power she cannot control.' },
  kaleLSSJ: { name: 'Kale', kind: 'U6 Saiyan / Sadala', hp: '???', str: '???', pow: '???', end: '???', desc: 'Kale as a Legendary Super Saiyan. After the tournament, she can mostly control it.' },
};

/** Entries other content already registered stay as they are (only the gaps are filled). */
registerScans(Object.fromEntries(Object.entries(READINGS).filter(([id]) => !SCANS[id])));
