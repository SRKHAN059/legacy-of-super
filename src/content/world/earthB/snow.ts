import { registerMaps } from '../../registry';
import { registerScripts } from '../../../game/script';
import { GRIDS } from './grids';
import { heroTalk } from './talk';

/*
 * SNOWY HIGHLANDS (region 'Snowy Highlands', hostile, late game T5-T7):
 * snow_entry --north--> snow_peak.
 *
 * Coordinates chapters need (tiles):
 *  - snow_entry: world sign (17,23), save (24,23), landing (20,25). North opening x 18-24.
 *    Flight circle (30,11) → NE shelf (36,5); shelf circle (34,6) → (30,12).
 *  - snow_peak: plateau x 15-30 rows 12-30. Flight circle (23,13) → summit (23,5); summit circle (17,6) → (24,14).
 *    Summit "Shrine of Warriors" x 14-32 rows 3-7 with three trophy alcoves:
 *      g50_goku    {x:15,y:3,w:3,h:1} → chest trophy_goku    (16,1)
 *      g50_trunks  {x:21,y:3,w:3,h:1} → chest trophy_trunks  (22,1)
 *      g50_piccolo {x:27,y:3,w:3,h:1} → chest trophy_piccolo (28,1)
 *    Dino park (warm hot-spring valley) x 1-13 rows 12-30 behind g40_goku {x:14,y:18,w:1,h:3}: LoG2's Goku-40
 *    "dino park" grinding ground (Trihorns at 35,000 EXP and Blue T-Rexes at 36,900, LoG2's own values).
 *    Ice cave x 34-43 rows 19-30 behind eb_g45_vegeta {x:33,y:23,w:1,h:3} (corridor x 30-33 rows 23-25): the L45-50
 *    grinding pocket (Gold/Red Destroyers + Void Oozes, 43,000-59,000 EXP) and the STR+5 chest.
 */

const SNOW = { n: 'snow', i: 'ice', r: 'rock', '#': 'cliff', D: 'deep', '.': 'grass', ',': 'darkGrass', '~': 'water' } as const;

registerMaps([
  {
    id: 'snow_entry', name: 'Snowy Highlands', music: 'snow', hostile: true, region: 'Snowy Highlands',
    legend: SNOW,
    grid: GRIDS.snow_entry,
    props: [
      // Pine forest (east) and lake shore.
      ['eb_snowPine', 28, 4.4], ['eb_snowPine', 26, 7], ['eb_snowPine', 33.4, 10.2], ['eb_snowPine', 37, 11.6], ['eb_snowPine', 35, 15.4],
      ['eb_snowPine', 37, 16.4], ['eb_snowPine', 31.6, 19.4], ['eb_snowPine', 36.6, 20.6], ['eb_snowPine', 29, 23.4], ['eb_snowPine', 34, 24.4],
      ['eb_snowPine', 13, 3.6], ['eb_snowPine', 16.4, 5.4], ['eb_snowPine', 3, 3.6], ['eb_snowPine', 2.4, 17.6], ['eb_snowPine', 4.6, 23.4],
      ['eb_snowPine', 14.6, 18.6], ['eb_snowPine', 7, 24.6],
      ['eb_iceSpire', 16, 9.6], ['eb_iceSpire', 2.6, 11.4], ['eb_iceSpire', 13.4, 16.2], ['eb_iceSpire', 25.4, 13.6],
      ['rock', 24.4, 2.6], ['boulder', 9.6, 25.6], ['smallRock', 22, 18.4], ['smallRock', 27, 21.4], ['smallRock', 18, 9.4], ['smallRock', 39, 8.6],
      ['deadTree', 10.4, 17.6],
      // NE shelf.
      ['eb_snowPine', 33, 2.6], ['eb_iceSpire', 39, 5.2],
    ],
    npcs: [{ id: 'eb_snow_climber', sprite: 'eb_climber', x: 22, y: 22, talk: 'eb_snow_climber', name: 'Climber Daichi', wander: 1 }],
    enemies: [
      { type: 'snowWolf', x: 6, y: 5 }, { type: 'snowWolf', x: 8, y: 6 }, { type: 'snowWolf', x: 5, y: 7 },
      { type: 'iceSabertooth', x: 30, y: 21 }, { type: 'iceSabertooth', x: 26, y: 10 },
      { type: 'stormPtero', x: 11, y: 12 }, { type: 'stormPtero', x: 36, y: 13 },
      { type: 'direWolf', x: 35, y: 26 },
    ],
    exits: { north: { to: 'snow_peak' } },
    pickups: [{ id: 'del_snow_entry_1', item: 'delicacy', x: 15, y: 7, hidden: true }],
    objects: [
      { type: 'worldSign', x: 17, y: 23 },
      { type: 'save', x: 24, y: 23 },
      { type: 'sign', x: 26, y: 24, text: 'SNOWY HIGHLANDS. Avalanche risk: high. Wolf risk: higher. Saiyan training risk: highest.' },
      { type: 'flight', x: 30, y: 11, to: 'snow_entry', tx: 36, ty: 5, label: 'Shelf' },
      { type: 'flight', x: 34, y: 6, to: 'snow_entry', tx: 30, ty: 12, label: 'Forest' },
      { type: 'chest', x: 38, y: 4, id: 'eb_cap_snow_shelf', item: 'pow3' },
      { type: 'breakable', x: 36, y: 3, size: 2 },
      { type: 'breakable', x: 8, y: 19, size: 2 },
      { type: 'breakable', x: 33, y: 22, size: 3 },
      { type: 'breakable', x: 12, y: 4, size: 1 },
    ],
  },
  {
    id: 'snow_peak', name: 'Highland Peak', music: 'snow', hostile: true, region: 'Snowy Highlands',
    legend: SNOW,
    grid: GRIDS.snow_peak,
    props: [
      // Summit shrine: arches over the trophy alcoves.
      ['stoneArch', 14.5, 0], ['stoneArch', 20.5, 0], ['stoneArch', 26.5, 0],
      ['eb_iceSpire', 19, 1.4], ['eb_iceSpire', 25, 1.4], ['eb_snowPine', 31, 4.6], ['shrine', 29, 4.8],
      // Plateau.
      ['eb_snowPine', 16, 24.4], ['eb_snowPine', 28, 13.4], ['eb_snowPine', 27.6, 26.6], ['eb_snowPine', 15.6, 14.6],
      ['eb_iceSpire', 29, 18.6], ['eb_iceSpire', 16, 28.4], ['smallRock', 20, 22.4], ['smallRock', 26, 20.4], ['rock', 18.6, 29.6],
      // Dino park: a warm hot-spring valley.
      ['tree', 2, 13.4], ['tree', 9.6, 12.6], ['tree', 1.6, 24.6], ['tree', 10.6, 25.6], ['bush', 4, 21.4], ['bush', 9, 20.4],
      ['flowers', 3, 17], ['flowers', 10, 16], ['flowers', 6, 25], ['palm', 9.4, 15.4], ['rock', 6, 28.2],
      // Ice cave (behind the Vegeta L45 gate).
      ['eb_iceSpire', 35, 20.2], ['eb_iceSpire', 42, 21.4], ['eb_iceSpire', 36.4, 28.2], ['rubble', 40, 20.6], ['crate', 42.4, 26.2],
    ],
    npcs: [{ id: 'eb_snow_hermit', sprite: 'oldMan', x: 25, y: 6, talk: 'eb_snow_hermit', name: 'Shrine Keeper' }],
    enemies: [
      { type: 'direWolf', x: 19, y: 25 }, { type: 'direWolf', x: 27, y: 16 },
      { type: 'iceSabertooth', x: 17, y: 19 }, { type: 'iceSabertooth', x: 25, y: 28 },
      { type: 'stormPtero', x: 21, y: 15 }, { type: 'stormPtero', x: 28, y: 22 },
      { type: 'snowWolf', x: 22, y: 29 },
      // Dino park (Goku L40).
      { type: 'blueTRex', x: 7, y: 22 }, { type: 'blueTRex', x: 8, y: 27 },
      { type: 'eb_trihorn', x: 7, y: 13 }, { type: 'eb_trihorn', x: 3, y: 24 }, { type: 'eb_trihorn', x: 7, y: 29 },
      { type: 'redRaptor', x: 4, y: 15 }, { type: 'redRaptor', x: 10, y: 18 }, { type: 'redRaptor', x: 10, y: 23 },
      // Ice cave (Vegeta L45).
      { type: 'redMech', x: 37, y: 23 }, { type: 'goldMech', x: 40, y: 26 },
      { type: 'voidSlime', x: 38, y: 20 }, { type: 'voidSlime', x: 37, y: 28 },
    ],
    exits: { south: { to: 'snow_entry' } },
    barriers: [
      { id: 'g40_goku', x: 14, y: 18, w: 1, h: 3, level: 40, character: 'goku' },
      { id: 'eb_g45_vegeta', x: 33, y: 23, w: 1, h: 3, level: 45, character: 'vegeta' },
      { id: 'g50_goku', x: 15, y: 3, w: 3, h: 1, level: 50, character: 'goku' },
      { id: 'g50_trunks', x: 21, y: 3, w: 3, h: 1, level: 50, character: 'trunks' },
      { id: 'g50_piccolo', x: 27, y: 3, w: 3, h: 1, level: 50, character: 'piccolo' },
    ],
    pickups: [{ id: 'del_snow_peak_1', item: 'delicacy', x: 2, y: 20 }],
    objects: [
      { type: 'sign', x: 23, y: 31, text: 'HIGHLAND PEAK. The summit shrine is said to hold relics for only the mightiest warriors.' },
      { type: 'flight', x: 23, y: 13, to: 'snow_peak', tx: 23, ty: 5, label: 'Summit' },
      { type: 'flight', x: 17, y: 6, to: 'snow_peak', tx: 24, ty: 14, label: 'Plateau' },
      { type: 'chest', x: 16, y: 1, id: 'trophy_goku', item: 'trophyGoku' },
      { type: 'chest', x: 22, y: 1, id: 'trophy_trunks', item: 'trophyTrunks' },
      { type: 'chest', x: 28, y: 1, id: 'trophy_piccolo', item: 'trophyPiccolo' },
      { type: 'sign', x: 15, y: 17, text: 'Steam drifts through the gap: a warm valley full of dinosaurs. The orange barrier hums with Goku\'s colour.' },
      { type: 'sign', x: 30, y: 22, text: 'An ice cave behind a dark-blue barrier. Something metal clanks in the dark, and something else gurgles. The barrier knows a prince\'s pride.' },
      { type: 'chest', x: 4, y: 28, id: 'eb_cap_snow_dino', item: 'str3' },
      { type: 'chest', x: 41, y: 27, id: 'eb_cap_snow_mech', item: 'str5' },
      { type: 'breakable', x: 16, y: 16, size: 2 },
      { type: 'breakable', x: 28, y: 27, size: 3 },
      { type: 'breakable', x: 31, y: 5, size: 2 },
      { type: 'breakable', x: 11, y: 28, size: 2 },
      { type: 'breakable', x: 42, y: 23, size: 1 },
    ],
  },
]);

registerScripts({
  eb_snow_climber: async (s) => {
    const n = s.inc('eb_snow_climber_n');
    if (n === 1) {
      await s.talk([
        ['eb_snow_climber', 'Whoa! You came up here without a coat? You must be one of those martial artist types.', 'shock'],
        ['eb_snow_climber', 'Name\'s Daichi. Twelve summits climbed, zero frostbitten toes. I\'d like to keep it that way, so I stay near the save beacon.', 'happy'],
        ['eb_snow_climber', 'The wolves up here are monsters. Snow wolves, dire wolves, sabertooths. And pterodactyls that ride the storm clouds.'],
      ]);
      return;
    }
    if (n % 3 === 2) {
      await s.say('eb_snow_climber', 'See that ledge above the pines to the north-east? There\'s a glowing circle in the forest that\'ll fly you up there. Something shiny on top.');
      return;
    }
    if (n % 3 === 0) {
      await s.say('eb_snow_climber', 'Up on the peak there\'s an ice cave behind a dark-blue barrier. Machines in there, and one of them is solid gold, apparently. My cousin also says he saw a yeti.', 'smirk');
      return;
    }
    await s.say('eb_snow_climber', s.check('chapter>=13')
      ? 'I heard some park ranger from Monster Island came up here to train. Didn\'t even break a sweat. In the snow. Show-off.'
      : 'Past the peak there\'s a warm valley full of dinosaurs. Hot springs keep it green all year. Some strange orange barrier blocks the way, though.');
  },
  eb_snow_hermit: async (s) => {
    const n = s.inc('eb_snow_hermit_n');
    if (n === 1) {
      await s.talk([
        ['eb_snow_hermit', 'You reached the Shrine of Warriors. Few do. Fewer still on their own legs.', 'smirk'],
        ['eb_snow_hermit', 'Behind those barriers rest relics for the greatest fighters of this age. Each barrier answers to one warrior alone, at the very peak of their power.'],
        ['eb_snow_hermit', 'Orange for the Saiyan who smiles. Purple for the swordsman from another time. Green for the Namekian who watches over the boy.'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_snow_hermit', {
      goku: 'The orange barrier stirs when you draw near. It knows its warrior, but it waits for the whole of your strength.',
      vegeta: 'Prince of Saiyans. Your relic does not rest on this peak. It waits on the Great Mesa, in the Rocky Wasteland.',
      gohan: 'Your relic is not among these, scholar. It waits in the high peaks above the valley where you were raised.',
      piccolo: 'The green barrier hums at your approach, Namekian. It remembers the one who watches over the boy.',
      trunks: 'The purple barrier waits for a sword from another time. Yours, I think. Return when your blade has reached its peak.',
      satan: 'So. The relics chose YOU. ...The ancients always did love a good joke.',
    }, 'smirk')) return;
    const trophies = ['trophyGoku', 'trophyVegeta', 'trophyGohan', 'trophyTrunks', 'trophyPiccolo'].filter((t) => s.has(t)).length;
    if (trophies >= 5) {
      await s.say('eb_snow_hermit', 'All five relics... Then the legends are true. Somewhere, a very loud man with a moustache is about to have the best day of his life.', 'happy');
      return;
    }
    await s.say('eb_snow_hermit', trophies > 0
      ? `You carry ${trophies} of the five relics. There are others hidden across the world: on the Great Mesa, and wherever the strongest have stood.`
      : 'Train until your body can go no further, then train more. Level fifty, the old scrolls say. Then strike the barrier that bears your colour.');
  },
});
