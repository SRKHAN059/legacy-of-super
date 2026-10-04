import { registerMaps } from '../../registry';
import { GridPainter, propsOn } from './grid';

/**
 * Chapter 13 locations: the Zeno Expo arena, Monster Island (shore, jungle, ranger station + hut, poacher camp),
 * Tien's mountain dojo, the wilderness where Gohan trains, and Fortuneteller Baba's lakeside palace. Three of the
 * seven escaped animals hide on these maps; three more fled into old Earth regions, behind coloured gates
 * (`c13_maps.ts` overlays), and the Minotaurus calf wandered to Mt. Paozu (`overlays.ts`).
 */

const BRIDGE = { '~': 'w', w: 'w' };

// ---------------------------------------------------------------- Zeno Expo
const expo = new GridPainter(34, 24, 'v');
expo.rect('m', 3, 1, 28, 4);
expo.rect('a', 6, 8, 22, 13);
expo.set('v', 6, 8).set('v', 27, 8).set('v', 6, 20).set('v', 27, 20).set('v', 7, 8).set('v', 26, 20);

// ---------------------------------------------------------------- Monster Island: shore
const beach = new GridPainter(34, 24, 's');
beach.rect(',', 0, 0, 34, 7);
beach.rect('#', 0, 0, 2, 12).rect('#', 32, 0, 2, 12).rect('#', 0, 0, 13, 2).rect('#', 21, 0, 13, 2);
beach.ellipse('.', 8, 5, 4, 2).ellipse('.', 26, 4, 4, 2);
beach.rect('~', 0, 19, 34, 3).rect('D', 0, 22, 34, 2);
beach.ellipse('~', 29, 15, 3, 2);
beach.line('d', [[16, 17], [16, 0]], 3);
beach.rect('w', 9, 17, 2, 5);
const beachProps = propsOn(beach, '.,s', [
  ['palm', 3, 10], ['palm', 6, 13], ['palm', 24, 11], ['palm', 31, 10], ['tree', 3, 3], ['tree', 9, 2], ['tree', 22, 2],
  ['tree', 27, 2], ['bush', 12, 5], ['bush', 20, 6], ['tree', 6, 6], ['palm', 13, 12], ['palm', 1, 15],
]);

// ---------------------------------------------------------------- Monster Island: jungle
const jungle = new GridPainter(44, 34, ',');
jungle.border('#');
jungle.ellipse('.', 12, 10, 6, 4).ellipse('.', 32, 25, 6, 4).ellipse('.', 34, 6, 5, 3).ellipse('.', 8, 29, 4, 2);
jungle.rect('#', 3, 3, 7, 4).rect('#', 25, 14, 6, 3).rect('#', 36, 18, 6, 4).rect('#', 4, 21, 5, 5).rect('#', 14, 2, 4, 3).rect('#', 38, 28, 5, 5);
jungle.line('~', [[1, 15], [10, 17], [20, 21], [28, 30], [30, 33]], 2);
jungle.line('d', [[16, 33], [16, 26], [21, 18], [21, 0]], 2, BRIDGE);
jungle.line('d', [[21, 18], [30, 12], [43, 11]], 2, BRIDGE);
jungle.line('d', [[16, 27], [9, 30]], 2, BRIDGE);
jungle.rect(',', 13, 33, 8, 1).rect('d', 15, 33, 3, 1);
jungle.rect('d', 20, 0, 4, 1);
jungle.rect('d', 43, 10, 1, 4);
// Gohan-gated alcove between the eastern cliffs and the island wall.
jungle.set('#', 42, 17);
const jungleProps = propsOn(jungle, ',.', [
  ['tree', 2, 8], ['palm', 6, 12], ['tree', 10, 3], ['tree', 18, 6], ['palm', 24, 3], ['tree', 27, 7], ['tree', 31, 2],
  ['palm', 38, 3], ['tree', 40, 7], ['tree', 34, 13], ['palm', 38, 14], ['tree', 26, 19], ['tree', 30, 18], ['palm', 33, 21],
  ['tree', 2, 18], ['tree', 10, 20], ['palm', 13, 22], ['tree', 22, 24], ['tree', 24, 27], ['palm', 34, 29], ['tree', 2, 26],
  ['tree', 11, 25], ['bush', 14, 14], ['bush', 25, 10], ['bush', 36, 24], ['bush', 6, 16], ['tree', 17, 12], ['palm', 28, 23],
  ['tree', 40, 24], ['bush', 19, 29], ['tree', 4, 28], ['palm', 12, 29],
]);

// ---------------------------------------------------------------- Monster Island: ranger station
const station = new GridPainter(34, 24, '.');
station.border('#');
station.rect('d', 0, 10, 1, 4);
station.ellipse(',', 26, 18, 6, 4).ellipse(',', 6, 4, 4, 2).ellipse(',', 29, 3, 3, 1);
station.ellipse('~', 27, 8, 3, 2);
station.rect('d', 6, 15, 10, 6);
station.line('d', [[0, 11], [12, 11], [19, 9], [19, 8]], 2);
station.line('d', [[12, 11], [16, 17]], 1);
const stationProps = propsOn(station, '.,', [
  ['tree', 2, 1], ['tree', 10, 1], ['pine', 14, 1], ['tree', 24, 1], ['tree', 31, 5], ['tree', 2, 15], ['tree', 2, 19],
  ['pine', 21, 15], ['tree', 28, 13], ['tree', 31, 18], ['bush', 22, 20], ['bush', 9, 6], ['flowers', 13, 7], ['flowers', 25, 12],
]);

// ---------------------------------------------------------------- 17's hut (interior)
const hutIn = new GridPainter(14, 10, 'w');
hutIn.rect('#', 0, 0, 14, 2).rect('#', 0, 0, 1, 10).rect('#', 13, 0, 1, 10).rect('#', 0, 9, 14, 1).rect('w', 6, 9, 2, 1);

// ---------------------------------------------------------------- Monster Island: poacher camp
const camp = new GridPainter(40, 28, 'd');
camp.border('#');
camp.ellipse(',', 5, 5, 4, 3).ellipse(',', 34, 22, 5, 4).ellipse('.', 6, 22, 4, 3).ellipse(',', 35, 5, 4, 2);
camp.rect('m', 14, 2, 12, 6);
camp.rect('#', 1, 10, 3, 6).rect('#', 37, 9, 2, 6);
camp.rect('d', 20, 27, 4, 1);

// ---------------------------------------------------------------- Tien's dojo
const dojo = new GridPainter(36, 26, '.');
dojo.border('#');
dojo.rect('#', 1, 1, 34, 2).rect('#', 1, 18, 4, 7).rect('#', 32, 3, 3, 6);
dojo.rect('d', 8, 9, 20, 10);
dojo.line('=', [[18, 25], [18, 19]], 2);
dojo.line('=', [[15, 8], [15, 5]], 2);
dojo.ellipse('~', 30, 21, 3, 2);
dojo.ellipse(',', 5, 13, 3, 2).ellipse(',', 30, 13, 3, 2);
// Vegeta-gated nook behind the pond.
dojo.rect('#', 33, 23, 2, 1);
const dojoProps = propsOn(dojo, '.,', [
  ['pine', 3, 4], ['pine', 6, 3], ['pine', 28, 2], ['tree', 24, 3], ['tree', 8, 19], ['pine', 24, 20], ['tree', 33, 15],
  ['tree', 1, 14], ['bush', 11, 21], ['bush', 21, 22], ['flowers', 27, 18], ['flowers', 9, 7],
]);

// ---------------------------------------------------------------- Wilderness plateau (Gohan's training)
const wild = new GridPainter(36, 24, 'x');
wild.border('#');
wild.ellipse('r', 10, 8, 6, 4).ellipse('r', 26, 16, 7, 4).ellipse('d', 18, 12, 7, 5);
wild.rect('#', 1, 1, 5, 3).rect('#', 30, 1, 5, 4).rect('#', 1, 19, 6, 4).rect('#', 14, 1, 3, 2).rect('#', 31, 19, 4, 4);
wild.ellipse('~', 30, 9, 2, 1);
// Piccolo-gated hollow in the south-east rocks.
wild.rect('#', 26, 19, 5, 1).rect('#', 26, 20, 1, 2);
const wildProps = propsOn(wild, 'xr', [
  ['boulder', 7, 15], ['deadTree', 4, 6], ['deadTree', 28, 5], ['cactus', 22, 4], ['cactus', 33, 13], ['boulder', 23, 20],
  ['rock', 12, 19], ['rock', 32, 16], ['cactus', 8, 4], ['deadTree', 20, 19],
]);

// ---------------------------------------------------------------- Fortuneteller Baba's palace
const baba = new GridPainter(36, 26, 's');
baba.border('#');
baba.ellipse('~', 18, 14, 13, 7);
baba.rect('a', 13, 11, 10, 7);
baba.rect('w', 17, 18, 2, 4);
baba.rect('m', 12, 1, 12, 4);
baba.ellipse('.', 5, 20, 3, 2).ellipse('.', 31, 21, 3, 2);
baba.rect('#', 1, 1, 4, 3).rect('#', 31, 1, 4, 3);

registerMaps([
  {
    id: 'c13_expo', name: 'Zeno Expo Arena', music: 'tournament', region: 'Zeno\'s Palace', backdrop: '#180c30', ringOut: true,
    legend: { v: 'void', m: 'marble', a: 'arena' },
    grid: expo.rows(),
    props: [['throne', 15, 1], ['pillar', 4, 0.5], ['pillar', 29, 0.5], ['pillar', 10, 0.5], ['pillar', 23, 0.5], ['brokenPillar', 8, 9], ['brokenPillar', 25, 18]],
    // Recovery jars in two corners of the ring (LoG2 arenas: breakable recovery pots).
    objects: [{ type: 'breakable', x: 9, y: 19, size: 1, look: 'jar' }, { type: 'breakable', x: 24, y: 9, size: 1, look: 'jar' }],
  },
  {
    id: 'c13_monster_beach', name: 'Monster Island Shore', music: 'islands', region: 'Monster Island',
    legend: { s: 'sand', ',': 'darkGrass', '.': 'grass', '#': 'cliff', '~': 'water', D: 'deep', d: 'dirt', w: 'wood' },
    grid: beach.rows(),
    props: [...beachProps, ['rubble', 21, 17], ['crate', 23, 16], ['barrel', 25, 17], ['rock', 30, 12], ['smallRock', 4, 17]],
    npcs: [
      // The kids "watch the island" while 17 is away at the tournament; they go home once he is back.
      { id: 'c13_goten', sprite: 'goten', x: 12, y: 16, talk: 'c13_babysit_talk', name: 'Goten', showIf: 'c13_17Joined', hideIf: 'post_game', wander: 2 },
      { id: 'c13_trunksK', sprite: 'trunksKid', x: 19, y: 16, talk: 'c13_babysit_talk', name: 'Trunks', showIf: 'c13_17Joined', hideIf: 'post_game', wander: 2 },
      { id: 'c13_marron', sprite: 'c13_marron', x: 15, y: 14, talk: 'c13_marron_talk', name: 'Marron', showIf: 'c13_17Joined', hideIf: 'post_game' },
      { id: 'c13_ani1', sprite: 'c13_puffball', x: 30, y: 11, talk: 'c13_animal_talk', name: 'Puffball', showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani1' },
    ],
    objects: [
      { type: 'save', x: 12, y: 14 }, { type: 'worldSign', x: 21, y: 14 },
      { type: 'sign', x: 18, y: 12, text: 'MONSTER ISLAND NATURE RESERVE. Poachers will be handed to the dinosaurs. - The Ranger' },
      { type: 'breakable', x: 4, y: 14, size: 2, look: 'crate' }, { type: 'breakable', x: 27, y: 17, size: 1 },
    ],
    exits: { north: { to: 'c13_monster_jungle' } },
    onEnter: 'c13_beach_enter',
  },
  {
    id: 'c13_monster_jungle', name: 'Monster Island Jungle', music: 'islands', hostile: true, region: 'Monster Island',
    legend: { ',': 'darkGrass', '.': 'grass', '#': 'cliff', '~': 'water', d: 'dirt', w: 'wood' },
    grid: jungle.rows(),
    props: [...jungleProps, ['caveEntrance', 9, 20.5], ['flowers', 7, 29], ['flowers', 10, 28]],
    enemies: [
      { type: 'c13_poacher', x: 24, y: 8, hideIf: 'c13_poachersGone' }, { type: 'c13_poacher', x: 30, y: 26, hideIf: 'c13_poachersGone' },
      { type: 'c13_poacherBrute', x: 12, y: 10, hideIf: 'c13_poachersGone' }, { type: 'c13_poacherDrone', x: 34, y: 7, hideIf: 'c13_poachersGone' },
      { type: 'c13_jungleRaptor', x: 8, y: 13 }, { type: 'c13_mossBoar', x: 33, y: 24 }, { type: 'c13_jungleRaptor', x: 36, y: 27 },
      { type: 'c13_mossBoar', x: 11, y: 27 }, { type: 'c13_jungleRaptor', x: 28, y: 4 },
    ],
    objects: [
      { type: 'save', x: 13, y: 30 },
      { type: 'chest', x: 6, y: 31, id: 'c13_jungleChest', item: 'end3' },
      { type: 'breakable', x: 18, y: 15, size: 2 }, { type: 'breakable', x: 36, y: 10, size: 3, item: 'str1', id: 'c13_jungleRock' },
      { type: 'chest', x: 42, y: 18, id: 'c13_jungleCache', item: 'end3' },
      { type: 'breakable', x: 25, y: 30, size: 1 }, { type: 'breakable', x: 6, y: 19, size: 2 },
      { type: 'sign', x: 23, y: 18, text: 'North: restricted zone (something crashed there). East: Ranger Station.' },
    ],
    barriers: [{ id: 'c13_g_gohan', x: 42, y: 21, w: 1, h: 1, level: 44, character: 'gohan' }],
    exits: { south: { to: 'c13_monster_beach' }, north: { to: 'c13_monster_camp' }, east: { to: 'c13_monster_hut' } },
  },
  {
    id: 'c13_monster_hut', name: 'Ranger Station', music: 'islands', region: 'Monster Island',
    legend: { '.': 'grass', ',': 'darkGrass', '#': 'cliff', '~': 'water', d: 'dirt' },
    grid: station.rows(),
    props: [
      ...stationProps, ['hut', 18, 5], ['well', 24, 10], ['crate', 22, 7], ['barrel', 23, 7], ['campfire', 14, 12],
      ['fenceH', 6, 14], ['fenceH', 7, 14], ['fenceH', 8, 14], ['fenceH', 9, 14], ['fenceH', 10, 14], ['fenceH', 11, 14], ['fenceH', 12, 14], ['fenceH', 13, 14], ['fenceH', 14, 14], ['fenceH', 15, 14],
      ['fenceH', 6, 20.6], ['fenceH', 7, 20.6], ['fenceH', 8, 20.6], ['fenceH', 9, 20.6], ['fenceH', 10, 20.6], ['fenceH', 11, 20.6], ['fenceH', 12, 20.6], ['fenceH', 13, 20.6], ['fenceH', 14, 20.6], ['fenceH', 15, 20.6],
      ['fenceV', 5.5, 14.5], ['fenceV', 5.5, 15.7], ['fenceV', 5.5, 16.9], ['fenceV', 5.5, 18.1], ['fenceV', 5.5, 19.3],
      ['fenceV', 16, 14.5], ['fenceV', 16, 15.7], ['fenceV', 16, 19.3],
    ],
    npcs: [
      // 17 is in the World of Void while the tournament runs.
      { id: 'c13_17', sprite: 'android17', x: 16, y: 10, talk: 'c13_17_talk', name: 'Android 17', showIf: 'chapter>=13', hideIf: 'c14_departed&!c14_won' },
      { id: 'c13_mino', sprite: 'c13_minotaurus', x: 10, y: 17, talk: 'c13_minotaurus_talk', name: 'Minotaurus', wander: 2 },
    ],
    warps: [{ x: 19, y: 7, w: 1, h: 1, to: 'c13_monster_hut_in', tx: 6, ty: 7, dir: 'up', door: true }],
    objects: [
      { type: 'save', x: 13, y: 8 },
      { type: 'sign', x: 11, y: 9, text: 'RANGER STATION. Visitors must sign in. Poachers must sign out (permanently).' },
      { type: 'breakable', x: 30, y: 21, size: 2 }, { type: 'breakable', x: 3, y: 4, size: 1 },
    ],
    exits: { west: { to: 'c13_monster_jungle' } },
  },
  {
    id: 'c13_monster_hut_in', name: '17\'s Cabin', music: 'peaceful', region: 'Monster Island', indoor: true,
    legend: { '#': 'wall', w: 'wood' },
    grid: hutIn.rows(),
    props: [['bed', 1, 2], ['table', 5, 4], ['chair', 4, 4.4], ['chair', 7, 4.4], ['bookshelf', 9, 1], ['plant', 12, 2], ['rug', 5, 6], ['crate', 1, 7], ['barrel', 12, 7]],
    warps: [{ x: 6, y: 9, w: 2, h: 1, to: 'c13_monster_hut', tx: 19, ty: 9, dir: 'down', door: true }],
    objects: [
      { type: 'sign', x: 7, y: 2, text: 'A framed photo: Krillin, 18 and Marron at the beach... and 17, scowling, in a ranger hat.' },
      { type: 'chest', x: 2, y: 6, id: 'c13_hutChest', item: 'pow3' },
    ],
  },
  {
    id: 'c13_monster_camp', name: 'Poacher Camp', music: 'tense', hostile: true, region: 'Monster Island',
    legend: { d: 'dirt', ',': 'darkGrass', '.': 'grass', '#': 'cliff', m: 'metal' },
    grid: camp.rows(),
    props: [
      ['spaceship', 16, 1], ['c13_cage', 6, 7], ['c13_cage', 28, 8], ['c13_cage', 9, 15], ['c13_cage', 26, 16],
      ['tent', 3, 18], ['tent', 31, 15], ['campfire', 20, 13], ['crate', 12, 4], ['crate', 13, 4], ['barrel', 27, 4], ['barrel', 28, 4],
      ['crate', 33, 11], ['lamp', 14, 9], ['lamp', 25, 9], ['tree', 2, 2], ['tree', 34, 2], ['tree', 35, 20], ['pine', 1, 22],
      // The camp proper: tyre ruts from the gate, the poachers' truck, a campfire circle, gear, cages and a radio mast.
      ['c13_tracks', 22, 11], ['c13_tracks', 22, 15], ['c13_tracks', 22, 19], ['c13_tracks', 22, 23], ['c13_tracksH', 17, 23.4],
      ['c13_jeep', 15.5, 21], ['c13_log', 17.9, 13.2], ['c13_log', 19.4, 14.6], ['c13_tarp', 12.5, 16.5], ['crate', 11, 16], ['barrel', 14.6, 15.8],
      ['c13_antenna', 26.5, 19.5], ['c13_cage', 12, 22.5], ['barrel', 25.2, 23.4], ['barrel', 26.2, 23.7], ['crate', 17, 18],
      ['smallRock', 15, 24.5], ['smallRock', 24, 25.3], ['smallRock', 13, 12], ['grassTuft', 27, 14.5], ['grassTuft', 9, 25.6],
      ['grassTuft', 23.6, 16.5], ['smallRock', 18.5, 26], ['grassTuft', 16, 11.2], ['c13_tarp', 7, 9.2],
    ],
    npcs: [
      { id: 'c13_ani3', sprite: 'c13_glowMoth', x: 30, y: 23, talk: 'c13_animal_talk', name: 'Glow Moth', showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani3' },
    ],
    enemies: [
      { type: 'c13_poacher', x: 12, y: 9, hideIf: 'c13_poachersGone' }, { type: 'c13_poacher', x: 27, y: 12, hideIf: 'c13_poachersGone' },
      { type: 'c13_poacher', x: 14, y: 19, hideIf: 'c13_poachersGone' }, { type: 'c13_poacherBrute', x: 24, y: 20, hideIf: 'c13_poachersGone' },
      { type: 'c13_poacherBrute', x: 8, y: 11, hideIf: 'c13_poachersGone' }, { type: 'c13_poacherDrone', x: 31, y: 6, hideIf: 'c13_poachersGone' },
      { type: 'c13_poacherDrone', x: 8, y: 21, hideIf: 'c13_poachersGone' },
      { type: 'c13_jungleRaptor', x: 30, y: 21, showIf: 'c13_poachersGone' }, { type: 'c13_mossBoar', x: 10, y: 21, showIf: 'c13_poachersGone' },
    ],
    objects: [
      { type: 'save', x: 21, y: 24 },
      { type: 'breakable', x: 11, y: 5, size: 1, look: 'crate' }, { type: 'breakable', x: 30, y: 11, size: 2, look: 'crate', item: 'pow3', id: 'c13_campCrate' },
      { type: 'breakable', x: 5, y: 13, size: 1, look: 'jar' }, { type: 'breakable', x: 34, y: 18, size: 2 },
    ],
    onEnter: 'act5_map_enter',
    // Not `once`: the camp event resumes where it stopped (poachers, then 17's spar) until 17 joins.
    triggers: [{ id: 'c13_campBoss', x: 15, y: 9, w: 10, h: 2, script: 'c13_camp_boss', showIf: 'quest:c13_17&!act5_busy', hideIf: 'c13_17Joined' }],
    exits: { south: { to: 'c13_monster_jungle', showIf: '!act5_busy' } },
  },
  {
    id: 'c13_tien_dojo', name: 'Tien-Shin Dojo', music: 'peaceful', region: 'Tien-Shin Dojo',
    legend: { '#': 'cliff', '.': 'grass', ',': 'darkGrass', d: 'dirt', '=': 'path', '~': 'water' },
    grid: dojo.rows(),
    props: [
      ...dojoProps, ['c13_dojoHall', 13, 1], ['hut', 3, 7], ['hut', 29, 9], ['well', 6, 15], ['lamp', 12, 8], ['lamp', 21, 8],
      ['pillar', 9, 9], ['pillar', 26, 9], ['statue', 23, 4], ['rock', 31, 17], ['flowers', 29, 18],
    ],
    npcs: [
      { id: 'c13_tienD', sprite: 'tien', x: 15, y: 7, talk: 'c13_tien_talk', name: 'Tien', showIf: 'done:c13_tien' },
      { id: 'c13_chiaotzuD', sprite: 'chiaotzu', x: 20, y: 7, talk: 'c13_chiaotzu_dojo', name: 'Chiaotzu', showIf: 'done:c13_tien' },
      { id: 'c13_yurinD', sprite: 'c13_yurin', x: 24, y: 12, talk: 'c13_yurin_talk', name: 'Yurin', showIf: 'done:c13_tien' },
      { id: 'c13_stuA', sprite: 'c13_student', x: 11, y: 12, talk: 'c13_student_talk', name: 'Student', showIf: 'done:c13_tien', wander: 2 },
      { id: 'c13_stuB', sprite: 'c13_student', x: 19, y: 15, talk: 'c13_student_talk', name: 'Student', showIf: 'done:c13_tien', wander: 2 },
    ],
    objects: [
      { type: 'save', x: 7, y: 22 }, { type: 'worldSign', x: 26, y: 23 },
      { type: 'bag', x: 10, y: 16 }, { type: 'bag', x: 25, y: 16 },
      { type: 'sign', x: 20, y: 24, text: 'TIEN-SHIN STYLE DOJO. Discipline. Humility. Free lunch on Sundays.' },
      { type: 'breakable', x: 33, y: 20, size: 2 }, { type: 'breakable', x: 6, y: 10, size: 1, look: 'jar' },
      { type: 'chest', x: 34, y: 22, id: 'c13_dojoCache', item: 'pow3' },
    ],
    barriers: [{ id: 'c13_g_vegeta', x: 33, y: 19, w: 2, h: 1, level: 46, character: 'vegeta' }],
    onEnter: ['act5_map_enter', 'c13_spot_enter'],
    // Not `once`: an interrupted dojo fight re-arms when the player comes back.
    triggers: [{ id: 'c13_dojoEvent', x: 14, y: 19, w: 8, h: 2, script: 'c13_dojo_event', showIf: 'quest:c13_tien&!act5_busy', hideIf: 'done:c13_tien' }],
  },
  {
    id: 'c13_training_wilds', name: 'Wilderness Plateau', music: 'wasteland', hostile: true, region: 'Wilderness Plateau',
    legend: { '#': 'cliff', x: 'wasteland', r: 'rock', d: 'dirt', '~': 'water' },
    grid: wild.rows(),
    props: [...wildProps, ['crater', 16, 10], ['crater', 22, 14]],
    onEnter: 'c13_spot_enter',
    enemies: [{ type: 'direWolf', x: 26, y: 5 }, { type: 'direWolf', x: 9, y: 19 }, { type: 'redRaptor', x: 30, y: 15 }, { type: 'redRaptor', x: 6, y: 9 }],
    objects: [
      { type: 'save', x: 4, y: 12 }, { type: 'worldSign', x: 4, y: 14 },
      { type: 'breakable', x: 12, y: 4, size: 3, item: 'end1', id: 'c13_wildRock' }, { type: 'breakable', x: 25, y: 9, size: 2 },
      { type: 'breakable', x: 11, y: 15, size: 1 },
      { type: 'chest', x: 30, y: 21, id: 'c13_wildCache', item: 'str3' },
    ],
    barriers: [{ id: 'c13_g_piccolo', x: 26, y: 22, w: 1, h: 1, level: 45, character: 'piccolo' }],
  },
  {
    id: 'c13_baba_lake', name: 'Baba\'s Palace', music: 'otherworld', hostile: true, region: 'Baba\'s Palace',
    legend: { s: 'sand', '~': 'water', a: 'arena', w: 'wood', m: 'marble', '.': 'grass', '#': 'cliff' },
    grid: baba.rows(),
    props: [
      ['domeHouse', 16, 0], ['pillar', 12, 1], ['pillar', 22, 1], ['palm', 2, 6], ['palm', 32, 6], ['palm', 3, 17],
      ['palm', 31, 16], ['cactus', 7, 23], ['cactus', 28, 23], ['brokenPillar', 13, 11], ['brokenPillar', 21, 11],
    ],
    npcs: [
      { id: 'c13_babaN', sprite: 'c13_baba', x: 15, y: 6, talk: 'c13_baba_talk', name: 'Fortuneteller Baba', showIf: 'chapter>=13' },
      { id: 'c13_ani6', sprite: 'c13_rainbowSnake', x: 4, y: 20, talk: 'c13_animal_talk', name: 'Rainbow Snake', showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani6' },
    ],
    onEnter: 'c13_spot_enter',
    enemies: [{ type: 'giantSnake', x: 30, y: 20 }, { type: 'giantSnake', x: 6, y: 8 }],
    objects: [
      { type: 'save', x: 9, y: 23 }, { type: 'worldSign', x: 26, y: 23 },
      { type: 'breakable', x: 33, y: 13, size: 2 }, { type: 'breakable', x: 2, y: 12, size: 1, look: 'jar' },
    ],
  },
]);
