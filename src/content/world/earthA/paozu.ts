import { registerMaps } from '../../registry';

/**
 * Mt. Paozu region.
 *
 *   [paozu_peaks]
 *   [paozu_forest][paozu_home][paozu_valley]
 *
 * valley (entry: world sign + save) -west-> home -west-> forest -north-> peaks.
 * Story NPC spots (chapters overlay them): Gohan/Videl in their yard at valley (7,7)/(8,7);
 * Chi-Chi in the Son yard at home (21,9); Goten by the training stump at home (35,8).
 */

const OUT = { '.': 'grass', ',': 'darkGrass', '=': 'path', 'd': 'dirt', '~': 'water', 'D': 'deep', '#': 'cliff', 'r': 'rock', 'b': 'wood', 's': 'sand' } as const;
const IN = { 'R': 'roof', 'W': 'wall', 'f': 'floor', 'w': 'wood', 'k': 'carpet', 't': 'tile' } as const;

/** Radish rows: tufts on every other tile of each dirt row. */
function radishes(x0: number, x1: number, rows: number[]): Array<[string, number, number]> {
  const out: Array<[string, number, number]> = [];
  for (const y of rows) for (let x = x0; x <= x1; x += 2) out.push(['grassTuft', x, y]);
  return out;
}

registerMaps([
  // ---------------------------------------------------------------- valley (region entry)
  {
    id: 'paozu_valley', name: 'Paozu Valley', music: 'peaceful', region: 'Mt. Paozu',
    legend: { ...OUT },
    grid: [
      '######################~~################',
      '##,,,,,,,,,,,##,,,,,,,~~,,,,,,,,########',
      '#,,..........##.......~~..........######',
      '#,...........##.......~~...........#####',
      '#,...........##.......~~............####',
      '#,...........##......~~....dddddddd..###',
      '#,...=.......##......~~...dddddddddd.###',
      '#,...=...............~~...dddddddddd.###',
      '#,,..=..............~~....dddddddddd..##',
      '#,,..=..............~~....dddddddddd..##',
      '#,...=..............~~.....dddddddd...##',
      '#....=..............~~......dd==dd....##',
      '#....=..............~~........==......##',
      ',....=.............~~.........==..##..##',
      '===================bb===========..##..##',
      '===================bb===========..##,,##',
      ',..................~~.............##,,##',
      '#..................~~...............,,##',
      '#,##...............~~...............,,##',
      '#,##...............~~...............,,##',
      '#,##..............~~~~........###...,,##',
      '#,##............~~~~~~~~......###,,,,###',
      '#..............~~~DDDDD~~~....###,,,,###',
      '#.............~~~DDDDDDD~~~...###,,,,###',
      '#.............~~~DDDDDDD~~~..........###',
      '#,,,,,,,,,,,,,,~~~DDDDD~~~,,,,,,,,,,,###',
      '#,,,,,,,,,,,,,,,~~~~~~~~~,,,,,,,,,,,,###',
      '#,,,,,,,,,,,,,,,,,~~~~~,,,,,,,,,,,,,,###',
      '##,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,####',
      '########################################',
    ],
    props: [
      // Gohan & Videl's house: door (5,5).
      ['domeHouse', 4, 3],
      ['fenceH', 2, 8], ['fenceH', 3, 8], ['fenceH', 4, 8], ['fenceH', 6, 8], ['fenceH', 7, 8], ['fenceH', 8, 8], ['fenceH', 9, 8], ['fenceH', 10, 8],
      ['fenceV', 11, 3.2], ['fenceV', 11, 4.4], ['fenceV', 11, 5.6], ['fenceV', 11, 6.8],
      ['flowers', 8, 4], ['flowers', 9, 4], ['flowers', 8, 6], ['flowers', 9, 6], ['flowers', 10, 5], ['flowers', 2, 5], ['flowers', 3, 7],
      ['mailbox', 6, 9], ['car', 7, 10], ['bush', 1.5, 6],
      // North treeline and the rock spire.
      ['pine', 9, 0], ['tree', 16, 1], ['pine', 18.5, 2], ['tree', 24, 1], ['pine', 27, 1], ['pine', 29.5, 2.5], ['pine', 31.5, 1.5],
      ['bush', 15, 5], ['grassTuft', 16, 7], ['grassTuft', 12, 3],
      // Middle meadow.
      ['tree', 10, 10], ['tree', 13, 8.5], ['pine', 16, 9], ['pine', 15, 11], ['grassTuft', 8, 12], ['flowers', 11, 13], ['flowers', 17, 7],
      ['pine', 24, 7], ['bush', 23, 11], ['grassTuft', 26, 12], ['flowers', 34, 12],
      // Landing clearing.
      ['boulder', 34, 9], ['rock', 25.5, 5], ['smallRock', 27, 9], ['pine', 36, 3.5], ['grassTuft', 33, 4], ['smallRock', 35, 7],
      // East side.
      ['pine', 36, 13], ['tree', 33, 16.5], ['bush', 30, 17], ['grassTuft', 27, 18], ['pine', 36, 18.5],
      ['tree', 24.5, 16.6], ['flowers', 27, 20], ['pine', 29, 18.6], ['bush', 22.4, 18.4], ['flowers', 31, 21.2], ['grassTuft', 28, 22.2],
      ['tree', 26, 2.4], ['flowers', 28.6, 3.4], ['bush', 33.4, 2.2], ['grassTuft', 20, 4], ['flowers', 18, 6.4],
      // Pond.
      ['rock', 26.5, 21], ['grassTuft', 15, 20], ['grassTuft', 24, 20], ['flowers', 13, 23], ['smallRock', 28, 24], ['bush', 11, 21],
      // Southern woods.
      ['tree', 1.5, 22], ['pine', 5, 22.5], ['tree', 8, 23.5], ['pine', 11, 23], ['pine', 3, 25], ['tree', 6, 25.5], ['pine', 13, 25.5],
      ['tree', 28, 23.5], ['pine', 31, 24], ['tree', 33.5, 25], ['pine', 35.5, 22.5], ['pine', 26, 25.5], ['tree', 29.5, 26.2],
      ['grassTuft', 20, 28], ['bush', 18, 28.1],
      // West road edge.
      ['pine', 1, 10], ['bush', 2, 12], ['tree', 3, 16.5], ['pine', 6, 17], ['bush', 9, 17.5], ['grassTuft', 12, 17],
      ['tree', 7, 18.5], ['pine', 12, 19], ['flowers', 9, 21], ['bush', 16, 18], ['flowers', 5, 20], ['grassTuft', 12, 22],
    ],
    npcs: [
      { id: 'ea_pv_farmer', sprite: 'farmer', x: 12, y: 15, talk: 'ea_pv_farmer', name: 'Mr. Takeda', wander: 3 },
      { id: 'ea_pv_fisher', sprite: 'oldMan', x: 14, y: 22, dir: 'right', talk: 'ea_pv_fisher', name: 'Old Angler' },
    ],
    warps: [{ x: 5, y: 5, w: 1, h: 1, to: 'gohan_house', tx: 8, ty: 10, dir: 'up', door: true }],
    exits: { west: { to: 'paozu_home' } },
    objects: [
      { type: 'worldSign', x: 29, y: 7 },
      { type: 'save', x: 32, y: 7 },
      { type: 'sign', x: 28, y: 13, text: 'PAOZU VALLEY. West: the Son family home. North-west: Gohan & Videl\'s house. The road east of here ends at the landing clearing.' },
      { type: 'sign', x: 6, y: 12, text: 'THE SON RESIDENCE (Gohan, Videl) - Deliveries: please do NOT ring after 9 pm. Gohan is studying!' },
    ],
    pickups: [{ id: 'del_paozu_valley_1', item: 'delicacy', x: 10, y: 3, hidden: true }],
  },

  // ---------------------------------------------------------------- Son family home
  {
    id: 'paozu_home', name: 'Son Family Home', music: 'peaceful', region: 'Mt. Paozu',
    legend: { ...OUT },
    grid: [
      '###~~#######################################',
      '###~~########,,,,,,,,,,,,,,,################',
      '##,~~,,,,,##,,,,,,,,,,,,,,,,,##,,,,,,,,,####',
      '#,,~~.....##..................,,,,,,,,,,,,##',
      '#,,~~........................,,,,,,,,,,,,,##',
      '#,,~~........................,,,ddddddd,,,##',
      '#..~~........................,,ddddddddd,,##',
      '#..~~...........dddddddddddd..,ddddddddd,,##',
      '#..~~...........dddddddddddd...ddddddddd,,##',
      '#..~~...........dddddddddddd....ddddddd,,,##',
      '#..~~............dddddddddd...............##',
      '#..~~..............==.....................##',
      '#..~~..............==.....................##',
      ',..~~..............==.......................',
      '===bb=======================================',
      '===bb=======================================',
      ',..~~.......................................',
      '#..~~..ddddddddddd........................##',
      '#,,~~.....................................##',
      '#,,~~..ddddddddddd..........,,,,,,,,,,,,,,##',
      '#,,~~.......................,,,,,,,,,,,,,,##',
      '#,,~~..ddddddddddd..........,,,,,,,,,,,,,,##',
      '#,,~~.......................,,,,,,,,,,,,,,##',
      '#,,~~..ddddddddddd..........,,,,,,,,,,,,,,##',
      '#,,~~.......................,,,,,,,,,,,,,,##',
      '#,,~~..ddddddddddd..........,,,,,,,,,,,,,,##',
      '#,,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,##',
      '##,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,######',
      '###~~#######################################',
      '###~~#######################################',
    ],
    props: [
      // The Son house: dome (door 19,6) + annex.
      ['domeHouse', 18, 4], ['hut', 21.5, 4],
      ['well', 14, 7.5], ['ea_bath', 26, 7], ['flowers', 16, 6], ['flowers', 24.5, 7], ['barrel', 24, 9.2], ['crate', 16.5, 9],
      ['mailbox', 21, 12],
      // Training ground (Goten's stump).
      ['ea_stump', 34, 6], ['boulder', 31, 2.2], ['rock', 39, 8], ['smallRock', 36, 9.2], ['smallRock', 32, 8.5], ['grassTuft', 38, 4],
      // Back woods.
      ['tree', 13, 1], ['pine', 16, 1], ['tree', 24.5, 0.8], ['pine', 27, 1.5], ['pine', 6, 2], ['tree', 8, 3.5], ['pine', 29.5, 3],
      ['pine', 40, 3], ['tree', 37.5, 1.2], ['grassTuft', 11, 5], ['bush', 12, 9], ['flowers', 30, 11], ['grassTuft', 25, 12],
      // Riverside.
      ['pine', 5, 8.5], ['bush', 6, 11.5], ['tree', 5.5, 15.6], ['grassTuft', 5, 20], ['flowers', 5, 24], ['bush', 1, 9],
      // Radish field + the red tractor.
      ...radishes(7, 17, [17, 19, 21, 23, 25]),
      ['fenceV', 18.2, 16.8], ['fenceV', 18.2, 18], ['fenceV', 18.2, 23.2], ['fenceV', 18.2, 24.4],
      ['car', 19.5, 21],
      // South-east grove.
      ['tree', 28, 17.6], ['pine', 31, 18.6], ['tree', 33, 17], ['pine', 36, 18], ['tree', 38.5, 18.5], ['pine', 41, 17.2],
      ['tree', 29, 21.5], ['pine', 32.5, 22.4], ['pine', 38, 22.6], ['tree', 40, 21], ['pine', 29.5, 24.6], ['tree', 37, 24.6], ['pine', 41, 24.5],
      ['flowers', 34, 23], ['flowers', 35, 24], ['grassTuft', 34.5, 25],
      // Along the road.
      ['pine', 23, 16.6], ['bush', 26, 18], ['grassTuft', 22, 20], ['flowers', 25, 23], ['grassTuft', 21, 25],
      ['pine', 33, 10.4], ['tree', 39.5, 9.6], ['bush', 36, 12.3], ['flowers', 27, 17], ['flowers', 31, 16.5], ['pine', 26.5, 10.6], ['grassTuft', 12, 11],
    ],
    npcs: [
      { id: 'ea_ph_neighbor', sprite: 'townswoman', x: 21, y: 18, talk: 'ea_ph_neighbor', name: 'Neighbour Ume', wander: 1 },
    ],
    warps: [{ x: 19, y: 6, w: 1, h: 1, to: 'paozu_house', tx: 6, ty: 10, dir: 'up', door: true }],
    exits: { east: { to: 'paozu_valley' }, west: { to: 'paozu_forest' } },
    objects: [
      { type: 'bag', x: 37, y: 6 },
      { type: 'sign', x: 38, y: 12, text: 'SON FAMILY - East: Paozu Valley. West: Paozu Forest (wild animals!). Please close the gate on the radish field.' },
      { type: 'sign', x: 6, y: 13, text: 'Beyond the bridge: PAOZU FOREST. Wolves, snakes and worse. Goten, that means YOU. - Mom' },
    ],
  },

  // ---------------------------------------------------------------- Son house interior
  {
    id: 'paozu_house', name: 'Son House', music: 'peaceful', region: 'Mt. Paozu', indoor: true,
    legend: { ...IN },
    grid: [
      'RRRRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWW',
      'WffffffffffWwwwwwW',
      'WffffffffffWwwwwwW',
      'WffffffffffWwwwwwW',
      'WffffffffffwwwwwwW',
      'WffffffffffwwwwwwW',
      'WffffffffffWwwwwwW',
      'WffffffffffWwwwwwW',
      'WffffffffffWwwwwwW',
      'WWWWWffWWWWWWWWWWW',
    ],
    props: [
      // Kitchen.
      ['counter', 1, 2.6], ['barrel', 4.2, 2.8], ['jar', 5.3, 3.2], ['plant', 9.6, 2.6],
      ['table', 2.5, 5.6], ['chair', 1.4, 5.8], ['chair', 4.8, 5.8], ['chair', 3.1, 4.6],
      // Goten's corner.
      ['rug', 6.5, 7.5], ['bed', 9.6, 7.6], ['crate', 1, 8.8],
      // Goku & Chi-Chi's room.
      ['bed', 12.2, 2.8], ['bed', 15.4, 2.8], ['bookshelf', 13, 8.2], ['plant', 16, 9], ['rug', 13, 5.6],
    ],
    warps: [{ x: 5, y: 11, w: 2, h: 1, to: 'paozu_home', tx: 19, ty: 7, dir: 'down', door: true }],
  },

  // ---------------------------------------------------------------- Gohan & Videl's house interior
  {
    id: 'gohan_house', name: 'Gohan & Videl\'s House', music: 'peaceful', region: 'Mt. Paozu', indoor: true,
    legend: { ...IN },
    grid: [
      'RRRRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWW',
      'WkkkkkkWtttttttttW',
      'WkkkkkkWtttttttttW',
      'WkkkkkkWtttttttttW',
      'WkkkkkkttttttttttW',
      'WkkkkkkttttttttttW',
      'WkkkkkkWtttttttttW',
      'WkkkkkkWtttttttttW',
      'WkkkkkkWtttttttttW',
      'WWWWWWWWttWWWWWWWW',
    ],
    props: [
      // Gohan's study (carpet): bookshelves, desk.
      ['bookshelf', 1, 2], ['bookshelf', 3, 2], ['bookshelf', 5, 2],
      ['table', 1, 6], ['chair', 1.6, 5], ['rug', 2.5, 8.3], ['plant', 5.6, 9.2], ['plant', 1, 9.2],
      // Living room: TV, sofa table, Pan's crib.
      ['tv', 9.5, 2.4], ['plant', 12, 2.5], ['table', 9.5, 5.2], ['chair', 8.4, 5.4], ['chair', 12.2, 5.4],
      ['rug', 13.5, 6.5], ['bed', 15.4, 2.6], ['plant', 16, 8.8], ['crate', 13.6, 9.2],
    ],
    warps: [{ x: 8, y: 11, w: 2, h: 1, to: 'paozu_valley', tx: 5, ty: 6, dir: 'down', door: true }],
  },

  // ---------------------------------------------------------------- Paozu Forest (hostile)
  {
    id: 'paozu_forest', name: 'Paozu Forest', music: 'field', hostile: true, region: 'Mt. Paozu',
    legend: { ...OUT },
    grid: [
      '##############~~####,==,######################',
      '##############~~###,,==,,#######,,,,,,,,,,,,##',
      '##############~~##,,,==,,,,###..............##',
      '##############~~,,,,,==,,,,,,...............##',
      '#..==........,~~,,,,,==,,,,,,...............##',
      '#..==........,~~,,,,,==,,,,,,,..............##',
      '#..==........,~~,,,,,==,,,,,,,,.............##',
      '#..==.......,,~~,,,,,==,,,,,,,,,...........###',
      '#..==......,,,~~,,,,,==,,,,,,,,,,,........####',
      '#,,==,,,,,,,,~~,,,,,,==,,,,,,,,,,,,,,,,,,,####',
      '#,,==,,,,,,,,~~,,,,,,=========,,,,,,,,,,,,####',
      '#,,==,,,,,,,,~~,,,,,,=========,,,,,,,,,,,,,###',
      '#,,==,,,,,,,,~~,,,,,,,,,,,,,==,,,,,,,,,,,,,,##',
      '#,,==,,,,,,,,~~,,,,,,,,,,,,,==,,,,,,,,,,,,,,,,',
      '#,,==========bb===============================',
      '#,,==========bb===============================',
      '#,,,,,,,,,,,,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
      '#,,,,,,,,,,,,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,###',
      '#,,,,,,,,,,,,~~,,,,,,,,,,,,,,,,,..........####',
      '#,,,,,,,,,,,~~,,,,,,,,,,,,,,,,,............###',
      '#,,,,,,,,,,,~~,,,,,,,,,,,,,,,,,............###',
      '#,,,,,,,,,,~~,,,,,,,,,,,,,,,,,,............###',
      '#,,,,,,,,ss~~,,,,,,,,,,,,,,,,,,............###',
      '#,,,,,,,,ss~~,,,,,,,,,,,,,,,,,,............###',
      '#,,,,,,,,,,~~,,,,,,,,,,,,,,,,,,,..........####',
      '#,,,,,,,,,,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,###',
      '#,,,,,,,,,,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,####',
      '##,,,,,,,,,~~,,,,,,,,,,,,,,,,,,,,,,,,,,,######',
      '###########~~#################################',
      '###########~~#################################',
    ],
    props: [
      // Cave mouth in the north-west cliff.
      ['caveEntrance', 5, 2], ['smallRock', 9, 5], ['rock', 1, 7], ['grassTuft', 7, 6], ['deadTree', 10.5, 5.2],
      // Woods between the cave clearing and the river.
      ['tree', 6, 9], ['pine', 9, 10], ['pine', 1, 10.5], ['tree', 10, 11.2], ['bush', 6, 12.4],
      // North path woods.
      ['pine', 19, 0.8], ['tree', 17.6, 3.6], ['pine', 16, 6.5], ['tree', 18.5, 8.8], ['pine', 24, 0.4], ['tree', 25, 3.3], ['pine', 27, 5.6],
      ['tree', 24, 6.6], ['pine', 23, 10.6], ['tree', 26, 10.6], ['bush', 16, 11.6],
      // Hawk meadow edge.
      ['tree', 30.5, 7.6], ['pine', 33.5, 6.8], ['tree', 36.5, 7.6], ['pine', 40, 6.6], ['pine', 42, 2.4], ['rock', 37, 3.5], ['grassTuft', 33, 4], ['flowers', 39, 5],
      ['tree', 31, 10.6], ['pine', 35, 10.5], ['tree', 38.5, 10.4], ['pine', 41.5, 9.6],
      // South woods (dense).
      ['tree', 15.6, 15.8], ['pine', 19, 16.8], ['tree', 21.6, 17.6], ['pine', 25, 16.4], ['tree', 27.4, 18.6], ['pine', 29.6, 16.8],
      ['tree', 16.8, 20.6], ['pine', 20, 21.8], ['tree', 23.6, 21.4], ['pine', 27.6, 22.6], ['tree', 14.8, 24.6], ['pine', 18, 24.8],
      ['tree', 22, 25.2], ['pine', 26, 25.4], ['pine', 30, 25.6], ['grassTuft', 21, 20], ['flowers', 25, 20],
      // Wolf den.
      ['deadTree', 36, 18.6], ['rock', 33, 24], ['smallRock', 38, 20], ['grassTuft', 34, 19], ['boulder', 39, 23.3], ['pine', 42, 18.4],
      // South-west riverside.
      ['tree', 2, 15.8], ['pine', 5, 16.8], ['tree', 7, 18.6], ['pine', 1.6, 19.8], ['tree', 4, 21.4], ['pine', 7.6, 22.8], ['tree', 5, 24.6],
      ['grassTuft', 9, 21], ['rock', 9.4, 24.6], ['pine', 11, 16.6], ['tree', 9, 18.2], ['pine', 12.5, 19.6], ['tree', 15, 22.4],
      ['pine', 19.5, 23.6], ['tree', 24.5, 23.8], ['pine', 28.5, 20.4], ['tree', 30, 22.6], ['pine', 16, 25.2], ['pine', 8.5, 25.2],
      ['tree', 20.5, 19.4], ['pine', 3, 18.4], ['bush', 12, 25.4], ['flowers', 2, 24], ['grassTuft', 17, 18],
      // East entrance.
      ['pine', 43, 11], ['bush', 41, 16.6], ['pine', 37, 15.8], ['tree', 33, 15.6],
    ],
    enemies: [
      { type: 'wolf', x: 35, y: 21 }, { type: 'wolf', x: 38, y: 22 }, { type: 'wolf', x: 36, y: 24 },
      { type: 'snake', x: 17, y: 13 }, { type: 'snake', x: 24, y: 19 }, { type: 'snake', x: 8, y: 16 },
      { type: 'hawk', x: 36, y: 4 }, { type: 'hawk', x: 41, y: 7 },
      { type: 'caveBat', x: 5, y: 5 }, { type: 'caveBat', x: 7, y: 6 }, { type: 'caveBat', x: 9, y: 4 },
      // River wildlife: shore crabs carry the odd Fish (Korin's Senzu trade); bog slimes ooze along the south bank.
      { type: 'crab', x: 12, y: 11 }, { type: 'crab', x: 15, y: 9 },
      { type: 'slime', x: 14, y: 23 }, { type: 'slime', x: 14, y: 26 },
    ],
    exits: { east: { to: 'paozu_home' }, north: { to: 'paozu_peaks', offset: -2 } },
    triggers: [{ id: 'ea_pf_cave', x: 5, y: 4, w: 3, h: 1, script: 'ea_pf_cave', onAction: true }],
    objects: [
      { type: 'sign', x: 43, y: 12, text: 'PAOZU FOREST. North: the Paozu Peaks. West, over the bridge: the old bat cave. Wolves den to the south-east.' },
      { type: 'chest', x: 11, y: 4, id: 'ea_forest_str1', item: 'str1' },
      { type: 'breakable', x: 18, y: 12, size: 2 },
      { type: 'breakable', x: 11, y: 7, size: 1, look: 'rock' },
      { type: 'breakable', x: 33, y: 13, size: 2 },
      { type: 'breakable', x: 41, y: 20, size: 3, item: 'end1', id: 'ea_forest_b1' },
    ],
    pickups: [{ id: 'del_paozu_forest_1', item: 'delicacy', x: 9, y: 23 }],
  },

  // ---------------------------------------------------------------- Paozu Peaks (hostile)
  {
    id: 'paozu_peaks', name: 'Paozu Peaks', music: 'snow', hostile: true, region: 'Mt. Paozu',
    legend: { ...OUT },
    grid: [
      '########~~################################',
      '########~~################################',
      '###rrrrr~~......................#,,,,,,###',
      '###rrrrr~~......................#,,,,,,###',
      '##rrrrrr~~......................#,,,,,,###',
      '##rrrrrrbb......................#,,,,,,###',
      '##rrrrrr~~.......................#..######',
      '##rrrrrr~~............................####',
      '###rrrrr~~...........................#####',
      '####rrrr~~rrrrrrrrrrrrrrrrrrrrrrrrrr######',
      '########~~################################',
      '########~~################################',
      '########~~################################',
      '########~~################################',
      '########~~################################',
      '########~~#####rrrrr#######rrrrr##########',
      '##rrrr~~~~~~rr.....==.........############',
      '#rrrr~~DDDD~~......==.........############',
      '#rrrr~~DDDD~~......==.........##rrrrrrrr##',
      '#rrrr~~~~~~~~......==.........##rrrrrrrr##',
      '#rrrrrr~~~~~~~.....==.........##rrrrrrrr##',
      '#rrrrrrrrrrr~~.....==.........##rrrrrrrr##',
      '#rrrrr.....r~~.....==.........##rrrrrrrr##',
      '#rrr.......r~~.....==.........##rrrrrrrr##',
      '#rr........r~~.....==.........rrrrrrrrrr##',
      '#rr........r~~.....===========rrrrrrrrrr##',
      '#rr........r~~.....==.........rrrrrrrrrr##',
      '#rr........rbb.....==.........##rrrrrrrr##',
      '#rrr.......rbb.....==.........##rrrrrrrr##',
      '#rrrr......r~~.....==.........##rrrrrrrr##',
      '##rrrr.....r~~.....==.........##rrrrrrrr##',
      '##rrrrr....r~~.....==........#############',
      '###rrrr....r~~.....==.......##############',
      '############~~####.==.####################',
    ],
    props: [
      // Plateau.
      ['pine', 12, 0.8], ['pine', 14.5, 2.6], ['tree', 26, 0.8], ['pine', 29, 2.8], ['boulder', 16, 5.6], ['rock', 30, 7], ['smallRock', 11, 8],
      ['rock', 10.2, 2.2], ['grassTuft', 22, 3], ['flowers', 24, 5], ['grassTuft', 35, 7], ['pine', 31, 0.4], ['bush', 21, 2],
      // Gohan's trophy nook.
      ['flowers', 34, 2.5], ['grassTuft', 37, 4],
      // West shelf (over the plank bridge).
      ['smallRock', 3, 7], ['rock', 3.5, 2.6],
      // Lower basin.
      ['pine', 15, 20.6], ['tree', 25, 19.6], ['pine', 28, 17.6], ['tree', 15, 26.6], ['pine', 23, 27.8], ['tree', 26, 25.6], ['pine', 17, 29.6],
      ['boulder', 24, 21.4], ['rock', 28.5, 28.5], ['grassTuft', 17, 18], ['smallRock', 21.5, 16.4], ['flowers', 22, 31],
      ['pine', 4, 21.6], ['boulder', 6, 27], ['pine', 8, 23.8], ['deadTree', 2.6, 27.4], ['grassTuft', 9, 29],
      // Hollow behind the Goku gate.
      ['shrine', 35, 17.6], ['boulder', 33, 27.6], ['rock', 38, 23], ['grassTuft', 34, 22],
    ],
    enemies: [
      // The lower basin is Chapter 1 ground: Goku crosses it at about L4 to fly up for Scarface, so its residents are
      // the forest's tier (LoG2's East District band: about 4 hits to kill, 12 to knock him out). Hawks, hornets and
      // crabs still pay half a level a kill at L4-5, so a clear is worth more per minute than the old big-game basin.
      // A pair of wolves and a hawk hold the west ledge over the plank bridge, giant hornets and two more hawks the
      // woods, and shore crabs work the waterfall pool and the stream (Fish drops). Everything stays out of a flyer's
      // sight of the forest trail's arrival and the flight circle's landing.
      { type: 'wolf', x: 6, y: 25 }, { type: 'wolf', x: 9, y: 28 },
      { type: 'hawk', x: 5, y: 30 }, { type: 'hawk', x: 28, y: 26 }, { type: 'hawk', x: 17, y: 24 },
      { type: 'hornet', x: 24, y: 26 }, { type: 'hornet', x: 16, y: 19 },
      { type: 'crab', x: 3, y: 22 }, { type: 'crab', x: 14, y: 23 }, { type: 'crab', x: 10, y: 26 },
      // From Chapter 3 (Goku back at L11+), swamp vipers hunt fish around the pool as well.
      { type: 'viper', x: 4, y: 19, showIf: 'chapter>=3' }, { type: 'viper', x: 14, y: 20, showIf: 'chapter>=3' },
      // Hawks circle the falls plateau, where Goten's dino hunt fights Scarface.
      { type: 'hawk', x: 13, y: 5 }, { type: 'hawk', x: 31, y: 5 },
      // The hollow behind the Goku L15 gate keeps the mountain's bigger game: a timber wolf and a brown bear.
      { type: 'timberWolf', x: 35, y: 25 }, { type: 'bear', x: 34, y: 21 },
    ],
    exits: { south: { to: 'paozu_forest', offset: 2 } },
    barriers: [
      { id: 'g15', x: 30, y: 24, w: 2, h: 3, level: 15, character: 'goku' },
      { id: 'g50_gohan', x: 34, y: 6, w: 2, h: 1, level: 50, character: 'gohan' },
    ],
    objects: [
      { type: 'flight', x: 23, y: 17, to: 'paozu_peaks', tx: 21, ty: 7, label: 'Plateau' },
      { type: 'flight', x: 20, y: 7, to: 'paozu_peaks', tx: 23, ty: 18, label: 'Basin' },
      { type: 'sign', x: 22, y: 31, text: 'PAOZU PEAKS. The falls plateau can only be reached by air - use the flight circle up ahead.' },
      { type: 'chest', x: 37, y: 20, id: 'ea_peaks_pow3', item: 'pow3' },
      { type: 'chest', x: 38, y: 29, id: 'del_paozu_peaks_1', item: 'delicacy' },
      { type: 'chest', x: 36, y: 3, id: 'trophy_gohan', item: 'trophyGohan' },
      { type: 'breakable', x: 5, y: 4, size: 2, item: 'pow1', id: 'ea_peaks_shelf' },
      { type: 'breakable', x: 14, y: 18, size: 2 },
      { type: 'breakable', x: 27, y: 23, size: 1 },
      { type: 'breakable', x: 9, y: 31, size: 3 },
      { type: 'breakable', x: 25, y: 5, size: 2 },
    ],
  },
]);
