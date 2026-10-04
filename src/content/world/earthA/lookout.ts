import { registerMaps } from '../../registry';
import { registerSky } from './art';

/**
 * The Lookout region:
 *   korin_base (entry: world sign + save; flight circle at the tower foot -> korin_tower)
 *   korin_tower (Korin's room; circles down to korin_base and up to the lookout)
 *   lookout (Kami's Lookout; palace door 21-22,8 -> lookout_palace_in; Room of Spirit and Time door 31,7)
 *   lookout_palace_in
 * Story NPC spots: Dende on the palace forecourt (22,11); Mr. Popo is ambient in the east garden.
 */

const KORIN_TOP = [
  'vvvvvvvvvvvvvvvv',
  'vvvvvffffffvvvvv',
  'vvvffffffffffvvv',
  'vvffffffffffffvv',
  'vffffffffffffffv',
  'vffffffffffffffv',
  'vffffffffffffffv',
  'vffffffffffffffv',
  'vvffffffffffffvv',
  'vvvffffffffffvvv',
  'vvvvvffffffvvvvv',
  'vvvvvvvvvvvvvvvv',
];

const LOOKOUT = [
  'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  'vvvvvvvvvvvvvvvmmmmmmmmmmmmmmmvvvvvvvvvvvvvvv',
  'vvvvvvvvvvvvmmmmmmmmmmmmmmmmmmmmmvvvvvvvvvvvv',
  'vvvvvvvvvvmmmmmmmmmmmmmmmmmmmmmmmmmvvvvvvvvvv',
  'vvvvvvvvvmmmmmmmmmmmmmmmmmmmmmmmmmmmvvvvvvvvv',
  'vvvvvvvmm.mmmmmmmmmmmmmmmmmmmmmmmmm.mmvvvvvvv',
  'vvvvvvm.....mmmmmmmmmmmmmmmmmmmmm.....mvvvvvv',
  'vvvvvm.......mmmmmmmmmmmmmmmmmmm.......mvvvvv',
  'vvvvvm.......mmmmmmmmttmmmmmmmmm.......mvvvvv',
  'vvvvmm.......mmmmmmmmttmmmmmmmmm.......mmvvvv',
  'vvvmmmm.....mmmmmmmmmttmmmmmmmmmm.....mmmmvvv',
  'vvvmmmmmm.mmmmmmmmmmmttmmmmmmmmmmmm.mmmmmmvvv',
  'vvvmmmmmmm.mmmmmmmmmmttmmmmmmmmmmm.mmmmmmmvvv',
  'vvmmmmm.......mmmmmmmttmmmmmmmm.......mmmmmvv',
  'vvmmmm.........mmmmmmttmmmmmmm.........mmmmvv',
  'vvmmmm.........mmmmmmttmmmmmmm.........mmmmvv',
  'vvmmm...........mmmmmttmmmmmm...........mmmvv',
  'vvmmm...........mmmmmttmmmmmm...........mmmvv',
  'vvmmm...........mmmmmttmmmmmm...........mmmvv',
  'vvvmm...........mmmmmttmmmmmm...........mmvvv',
  'vvvmm...........mmmmmttmmmmmm...........mmvvv',
  'vvvmmm.........mmmmmmttmmmmmmm.........mmmvvv',
  'vvvvmm.........mmttttttttttmmm.........mmvvvv',
  'vvvvvmm.......mmmttttttttttmmmm.......mmvvvvv',
  'vvvvvmmmmm.mmmmmmttttttttttmmmmmmm.mmmmmvvvvv',
  'vvvvvvmmmmmmmmmmmmmmmttmmmmmmmmmmmmmmmmvvvvvv',
  'vvvvvvvmmmmmmmmmmmmmmttmmmmmmmmmmmmmmmvvvvvvv',
  'vvvvvvvvvmmmmmmmmmmmmttmmmmmmmmmmmmmvvvvvvvvv',
  'vvvvvvvvvvmmmmmmmmmmmttmmmmmmmmmmmmvvvvvvvvvv',
  'vvvvvvvvvvvvmmmmmmmmmmmmmmmmmmmmmvvvvvvvvvvvv',
  'vvvvvvvvvvvvvvvmmmmmmmmmmmmmmmvvvvvvvvvvvvvvv',
  'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
];

registerSky('ea_sky_korin', KORIN_TOP, 'v');
registerSky('ea_sky_lookout', LOOKOUT, 'v');

registerMaps([
  // ---------------------------------------------------------------- Korin Forest (hostile, T1-T2 wildlife)
  {
    id: 'korin_base', name: 'Korin Forest', music: 'field', hostile: true, region: 'The Lookout',
    legend: { ',': 'darkGrass', '.': 'grass', '=': 'path', '#': 'cliff', '~': 'water', 'r': 'rock', 'd': 'dirt', 'b': 'wood' },
    grid: [
      '###############################~~#######',
      '##############,,,,,,,,,,,,#####~~,,,,,,#',
      '##############,,,,,,,,,,,,,,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,rrrrrrrrrrrr,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,rrrrrrrrrrrr,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,rrrrrrrrrrrr,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,rrrrrrrrrrrr,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,rrrrrrrrrrrr,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,rrrrr==rrrrr,,,,,~~,,=,,,#',
      '#,,,,,,,,,,,,,,,,,,==,,,,,,,,,,~~,,=,,,#',
      '#,,ddddddddd,,,,,,,==,,,,,,,,,,~~,,=,,,#',
      '#,,ddddddddd,,,,,,,==,,,,,,,,,,~~,,=,,,#',
      '#,,ddddddddd,,,,,,,==,,,,,,,,,,~~,,=,,,#',
      '#,,ddddddddd=========,,,,,,,,,,~~,,=,,,#',
      '#,,ddddddddd,,,,,,,============bb====,,#',
      '#,,ddddddddd,,,,,,,==,,,,,,,,,,~~,,,,,,#',
      '#,,ddddddddd,,,,,,,==,,,,,,,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,==,,,,,,,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,==,,,,,,,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,==,,,,,,,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,.....==......,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,.....==......,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,.....==......,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,.....==......,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,.....==......,,,,~~,,,,,,#',
      '#,,,,,,,,,,,,,.....==......,,,,~~,,,,,,#',
      '###############################~~#######',
    ],
    props: [
      // Korin Tower rises off the top of the screen; its base sits on the stone clearing.
      ['ea_korinTower', 18, -1], ['shrine', 14.6, 7], ['grassTuft', 23, 12], ['smallRock', 25, 9], ['flowers', 15, 12.4], ['flowers', 24.4, 12.4],
      // Northern woods.
      ['pine', 14, 0.6], ['tree', 22.4, 0.4], ['pine', 26, 1.6], ['tree', 3, 2], ['pine', 6, 3.4], ['tree', 9, 2.6], ['pine', 12, 4],
      ['tree', 1.4, 5.6], ['pine', 4.6, 7], ['tree', 8, 6.4], ['pine', 11, 8.4], ['tree', 2.6, 9.8], ['pine', 6.4, 10.6], ['tree', 9.4, 11.6],
      ['pine', 15.6, 3.6], ['tree', 23.6, 4.4], ['pine', 27.4, 6], ['tree', 27, 9.6], ['pine', 29, 3.6], ['pine', 28.4, 12.6],
      ['bush', 17, 4.2], ['grassTuft', 20, 6], ['flowers', 21.6, 5],
      // East grove (chest + hidden delicacy).
      ['tree', 33, 1.4], ['pine', 37.4, 1.6], ['tree', 33.2, 9.6], ['pine', 37.6, 7.4], ['tree', 37, 12.4], ['bush', 33.4, 14.4], ['grassTuft', 38, 9],
      // Yajirobe's camp.
      ['tent', 3.4, 14.4], ['campfire', 7, 17], ['barrel', 10.2, 15.2], ['crate', 1.2, 19.6], ['smallRock', 6, 18.6], ['smallRock', 8.4, 18.4],
      // South woods.
      ['tree', 1.6, 22], ['pine', 4.6, 22.6], ['tree', 8, 21.8], ['pine', 11.6, 22.4], ['tree', 14.4, 20.4], ['pine', 16.6, 22.6],
      ['tree', 2.6, 25.6], ['pine', 6, 26.6], ['tree', 9.6, 25.4], ['pine', 12.6, 27.4], ['tree', 4, 28.6], ['pine', 9, 28.6],
      ['tree', 22.6, 20.4], ['pine', 26, 21.6], ['tree', 28.6, 22.6], ['pine', 23.6, 15.4], ['tree', 26.4, 14.6], ['pine', 29.4, 16.4],
      ['tree', 34, 21.4], ['pine', 37.4, 22.4], ['tree', 35.4, 26.6], ['pine', 38, 27.6], ['tree', 33.6, 28.6],
      ['pine', 27.6, 25.6], ['tree', 28, 28.4], ['flowers', 16, 26], ['flowers', 25, 28], ['grassTuft', 15, 29], ['grassTuft', 24, 26],
      ['pine', 13.4, 15.6], ['tree', 15.6, 17.4], ['bush', 21.6, 17.4],
    ],
    npcs: [
      { id: 'ea_kb_yajirobe', sprite: 'yajirobe', x: 8, y: 19, dir: 'up', talk: 'ea_kb_yajirobe', name: 'Yajirobe', hideIf: 'ea_yajirobeAway' },
    ],
    enemies: [
      { type: 'snake', x: 11, y: 24 }, { type: 'snake', x: 25, y: 23 }, { type: 'snake', x: 36, y: 15 },
      { type: 'hawk', x: 12, y: 6 }, { type: 'hawk', x: 27, y: 4 },
      // The river is where Korin's fish come from: swamp vipers and shore crabs work both banks (Fish drops).
      { type: 'viper', x: 30, y: 22 }, { type: 'viper', x: 33, y: 8 },
      { type: 'crab', x: 30, y: 10 }, { type: 'crab', x: 33, y: 26 },
      // Woodland: rhino beetles in the north, a hornet over the east grove, a brown bear south of Yajirobe's camp.
      { type: 'beetle', x: 6, y: 7 }, { type: 'beetle', x: 26, y: 5 },
      { type: 'hornet', x: 36, y: 10 },
      { type: 'bear', x: 5, y: 27 },
    ],
    objects: [
      { type: 'worldSign', x: 17, y: 27 },
      { type: 'save', x: 22, y: 27 },
      { type: 'flight', x: 19, y: 12, to: 'korin_tower', tx: 7, ty: 7, label: 'Korin Tower' },
      { type: 'sign', x: 21, y: 24, text: 'KORIN FOREST - Sacred ground at the foot of Korin Tower. Climbing the tower is permitted to the pure of heart and the strong of arm. (Flying is considered cheating, but nobody has complained.)' },
      { type: 'chest', x: 37, y: 5, id: 'ea_korin_end1', item: 'end1' },
      { type: 'breakable', x: 24, y: 17, size: 2 },
      { type: 'breakable', x: 12, y: 10, size: 1 },
      { type: 'breakable', x: 36, y: 25, size: 2 },
    ],
    pickups: [{ id: 'del_korin_base_1', item: 'delicacy', x: 38, y: 11, hidden: true }],
  },

  // ---------------------------------------------------------------- top of Korin Tower
  {
    id: 'korin_tower', name: 'Korin Tower', music: 'lookout', region: 'The Lookout', backdrop: '#7ab8f0',
    legend: { 'v': 'void', 'f': 'floor' },
    grid: KORIN_TOP,
    props: [
      ['ea_sky_korin', 0, 0],
      ['jar', 6, 1.6], ['jar', 7, 1.4], ['jar', 8.2, 1.7], ['plant', 10, 1.6], ['rug', 6.5, 4.6],
      ['pillar', 2, 2.6], ['pillar', 13, 2.6], ['pillar', 3, 7.6], ['pillar', 12, 7.6],
    ],
    npcs: [
      { id: 'ea_kt_korin', sprite: 'korin', x: 8, y: 3, dir: 'down', talk: 'ea_kt_korin', name: 'Korin', hideIf: 'ea_korinAway' },
    ],
    objects: [
      { type: 'flight', x: 3, y: 6, to: 'korin_base', tx: 20, ty: 12, label: 'Korin Forest' },
      { type: 'flight', x: 12, y: 6, to: 'lookout', tx: 22, ty: 28, label: 'The Lookout' },
    ],
  },

  // ---------------------------------------------------------------- Kami's Lookout
  {
    id: 'lookout', name: 'The Lookout', music: 'lookout', region: 'The Lookout', backdrop: '#7ab8f0',
    legend: { 'v': 'void', 'm': 'marble', '.': 'grass', 't': 'tile' },
    grid: LOOKOUT,
    props: [
      ['ea_sky_lookout', 0, 0],
      ['ea_palace', 18.5, 3], ['ea_htcDoor', 30, 4.5],
      ['pillar', 18.6, 9.4], ['pillar', 24.4, 9.4], ['pillar', 18.6, 13.4], ['pillar', 24.4, 13.4],
      // North-west / north-east flowerbeds.
      ['flowers', 7, 8], ['flowers', 9, 9], ['bush', 10.4, 7.4], ['flowers', 35, 8], ['flowers', 33, 9.2], ['bush', 35.6, 9.6],
      // West garden.
      ['palm', 5.4, 13.2], ['palm', 12, 14.2], ['palm', 4.6, 19.4], ['palm', 12.8, 20.4], ['palm', 8, 22.6],
      ['flowers', 8, 16], ['flowers', 9, 18], ['flowers', 6, 21], ['flowers', 11, 23.4], ['bush', 14, 18.4], ['grassTuft', 7, 19],
      // East garden.
      ['palm', 36.4, 13.2], ['palm', 30.2, 14.2], ['palm', 37.4, 19.4], ['palm', 29.6, 20.4], ['palm', 34, 22.6],
      ['flowers', 35, 16], ['flowers', 34, 18], ['flowers', 37, 21], ['flowers', 31, 23.4], ['bush', 29, 18.4], ['grassTuft', 36, 19],
      // South rim.
      ['ea_bench', 16.4, 26.6], ['ea_bench', 25.6, 26.6], ['plant', 14.6, 23.4], ['plant', 28.6, 23.4],
    ],
    npcs: [
      { id: 'ea_lk_popo', sprite: 'mrPopo', x: 33, y: 17, dir: 'left', talk: 'ea_lk_popo', name: 'Mr. Popo', wander: 1, hideIf: 'ea_popoAway' },
    ],
    warps: [{ x: 21, y: 8, w: 2, h: 1, to: 'lookout_palace_in', tx: 9, ty: 12, dir: 'up', door: true }],
    objects: [
      { type: 'flight', x: 22, y: 30, to: 'korin_tower', tx: 11, ty: 7, label: 'Korin Tower' },
      { type: 'save', x: 25, y: 29 },
      { type: 'sign', x: 27, y: 10, text: 'The Room of Spirit and Time. A year inside passes in a single day outside. Do not enter without Mr. Popo\'s permission.' },
    ],
    pickups: [{ id: 'del_lookout_1', item: 'delicacy', x: 7, y: 24 }],
  },

  // ---------------------------------------------------------------- palace interior
  {
    id: 'lookout_palace_in', name: 'Kami\'s Palace', music: 'lookout', region: 'The Lookout', indoor: true,
    legend: { 'R': 'roof', 'W': 'wall', 'm': 'marble', 'k': 'carpet' },
    grid: [
      'RRRRRRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WmmmmmmmmkkmmmmmmmmW',
      'WWWWWWWWWkkWWWWWWWWW',
    ],
    props: [
      ['shrine', 8.5, 1.8], ['bookshelf', 1, 2], ['bookshelf', 17, 2], ['plant', 3.4, 2.6], ['plant', 15.4, 2.6],
      ['pillar', 4, 3.6], ['pillar', 15, 3.6], ['pillar', 4, 7.6], ['pillar', 15, 7.6],
      ['rug', 2, 9.4], ['rug', 14, 9.4], ['jar', 1.4, 11], ['jar', 17.6, 11],
    ],
    warps: [{ x: 9, y: 13, w: 2, h: 1, to: 'lookout', tx: 21, ty: 9, dir: 'down', door: true }],
    triggers: [
      { id: 'ea_lp_altar', x: 9, y: 4, w: 2, h: 1, script: 'ea_lp_altar', onAction: true },
      { id: 'ea_lp_books', x: 1, y: 4, w: 2, h: 1, script: 'ea_lp_books', onAction: true },
    ],
  },
]);
