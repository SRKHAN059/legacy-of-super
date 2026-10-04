import { registerMaps } from '../../registry';
import { GridPainter, propsOn } from './grid';

/** Chapter 12 locations: Satan City rooftops, Paozu highland meadow, the ZTV film lot, the Forest of Terror. */

// ---------------------------------------------------------------- Satan City rooftops (Hit's contract)
const roof = new GridPainter(36, 22, 'v');
roof.rect('#', 1, 1, 16, 20).rect('m', 2, 2, 14, 18);
roof.rect('#', 21, 1, 14, 20).rect('a', 22, 2, 12, 18);
roof.rect('t', 25, 5, 6, 4).rect('t', 5, 12, 6, 1);
roof.rect('w', 16, 10, 6, 2);

// ---------------------------------------------------------------- Paozu highlands (Pan's first flight)
const mead = new GridPainter(38, 28, '.');
mead.border('#');
mead.rect('#', 1, 1, 6, 2).rect('#', 1, 3, 3, 2).rect('#', 30, 1, 7, 2).rect('#', 34, 3, 3, 3).rect('#', 1, 24, 4, 3).rect('#', 32, 25, 5, 2);
mead.ellipse(',', 7, 8, 5, 3).ellipse(',', 30, 22, 5, 3).ellipse(',', 8, 20, 4, 3).ellipse(',', 20, 3, 4, 1);
mead.ellipse('r', 28, 5, 5, 2).rect('#', 25, 3, 2, 1);
mead.line('=', [[19, 27], [19, 18], [9, 12], [8, 8]], 2);
mead.line('=', [[19, 18], [24, 15], [28, 7]], 2);
mead.line('=', [[19, 18], [27, 19]], 2);
mead.line('=', [[13, 15], [7, 20]], 2);
mead.line('~', [[13, 1], [14, 6], [18, 11], [26, 13], [36, 15]], 2);
mead.ellipse('s', 29, 19, 4, 2).ellipse('~', 29, 19, 2, 1);
mead.rect('w', 24, 11, 3, 4);
mead.rect('#', 36, 14, 1, 3);
const meadTrees = propsOn(mead, '.,', [
  ['tree', 2, 6], ['tree', 4, 10], ['pine', 2, 13], ['tree', 10, 2], ['pine', 8, 1], ['tree', 16, 2], ['tree', 22, 6],
  ['pine', 20, 8], ['tree', 33, 7], ['tree', 34, 10], ['pine', 31, 11], ['tree', 3, 17], ['tree', 11, 20], ['pine', 14, 22],
  ['tree', 24, 21], ['tree', 26, 23], ['pine', 35, 18], ['tree', 6, 23], ['bush', 16, 14], ['bush', 22, 23], ['bush', 11, 9],
  ['tree', 29, 24], ['pine', 23, 2], ['bush', 33, 14], ['rock', 27, 15], ['tree', 15, 7],
]);

// ---------------------------------------------------------------- ZTV film lot (Great Saiyaman: the movie)
const film = new GridPainter(40, 26, 'a');
film.rect('#', 0, 0, 40, 2).rect('#', 0, 0, 1, 26).rect('#', 39, 0, 1, 26).rect('#', 0, 25, 40, 1);
film.rect('a', 17, 25, 6, 1);
film.rect('t', 11, 9, 18, 10);
film.rect('.', 2, 20, 7, 4).rect('.', 31, 20, 7, 4);
film.line('=', [[19, 25], [19, 19]], 2);
film.rect('=', 2, 5, 36, 2);

// ---------------------------------------------------------------- Forest of Terror (Krillin's comeback)
const forest = new GridPainter(40, 36, ',');
forest.border('#');
forest.rect('#', 4, 20, 6, 4).rect('#', 26, 18, 8, 3).rect('#', 6, 8, 5, 5).rect('#', 31, 5, 6, 4).rect('#', 16, 22, 3, 3).rect('#', 1, 1, 5, 4).rect('#', 34, 1, 5, 3);
forest.ellipse('~', 31, 25, 3, 2);
forest.rect('s', 1, 29, 38, 4);
forest.rect('~', 0, 33, 40, 2).rect('D', 0, 35, 40, 1);
forest.line('d', [[20, 30], [20, 27], [13, 25], [12, 19], [15, 16], [24, 15], [28, 11], [26, 7], [20, 5]], 2);
forest.ellipse('.', 14, 16, 3, 2).ellipse('.', 20, 4, 6, 3);
forest.rect('w', 19, 31, 3, 4);
forest.rect('#', 0, 0, 40, 1).rect('#', 0, 0, 1, 33).rect('#', 39, 0, 1, 33);
// A Goku-gated hollow behind the north-east cliffs (LoG2 level gate with a capsule cache).
forest.rect('#', 37, 4, 2, 1);
const forestTrees = propsOn(forest, ',', [
  ['deadTree', 2, 6], ['tree', 4, 12], ['deadTree', 12, 6], ['tree', 14, 9], ['deadTree', 17, 10], ['tree', 22, 9],
  ['deadTree', 24, 2], ['tree', 28, 2], ['deadTree', 30, 10], ['tree', 34, 10], ['deadTree', 36, 13], ['tree', 33, 14],
  ['deadTree', 2, 15], ['tree', 6, 15], ['deadTree', 9, 17], ['tree', 17, 18], ['deadTree', 21, 18], ['tree', 23, 20],
  ['deadTree', 2, 24], ['tree', 10, 22], ['deadTree', 6, 25], ['tree', 24, 23], ['deadTree', 27, 22], ['tree', 35, 19],
  ['deadTree', 36, 24], ['tree', 14, 26], ['deadTree', 27, 26], ['tree', 9, 2], ['deadTree', 15, 2], ['bush', 18, 13],
  ['bush', 29, 16], ['bush', 8, 27], ['deadTree', 11, 13], ['tree', 30, 29],
]);

registerMaps([
  {
    id: 'c12_rooftop', name: 'Satan City Rooftops', music: 'tense', region: 'Satan City', backdrop: '#0a0a20', tint: 'rgba(20,20,70,0.4)',
    legend: { v: 'void', '#': 'wall', m: 'metal', a: 'asphalt', t: 'tile', w: 'wood' },
    grid: roof.rows(),
    props: [
      ['c12_waterTower', 3, 2], ['crate', 12, 3], ['crate', 13, 3], ['crate', 12, 4], ['barrel', 14, 15], ['barrel', 2, 9],
      ['lamp', 15, 2], ['c12_waterTower', 30, 13], ['crate', 23, 15], ['crate', 24, 15], ['lamp', 33, 2], ['lamp', 22, 2],
      ['pillar', 28, 14], ['stairs', 9, 18], ['plant', 2, 17],
    ],
    objects: [
      { type: 'save', x: 4, y: 18 },
      { type: 'sign', x: 11, y: 2, text: 'HOTEL SATAN - ROOF. Access for maintenance staff and world champions only.' },
    ],
    npcs: [{ id: 'post_hitN', sprite: 'hit', x: 27, y: 8, dir: 'left', talk: 'post_hit_talk', name: 'Hit', showIf: 'post_game&done:c12_hit', hideIf: 'defeated:post_hit1' }],
    onEnter: ['act5_map_enter', 'c12_roof_enter'],
    // The stairs close while Hit fights (a walk-off mid-fight would strand the scene).
    triggers: [
      { id: 'c12_roofStairs', x: 9, y: 18, w: 1, h: 1, script: 'c12_roof_leave', onAction: true, showIf: '!act5_busy' },
      { id: 'c12_roofStairs2', x: 9, y: 19, w: 1, h: 1, script: 'c12_roof_leave', showIf: '!act5_busy' },
    ],
  },
  {
    id: 'c12_pan_meadow', name: 'Paozu Highlands', music: 'field', hostile: true, region: 'Mt. Paozu',
    legend: { '#': 'cliff', '.': 'grass', ',': 'darkGrass', '=': 'path', '~': 'water', w: 'wood', r: 'rock', s: 'sand' },
    grid: mead.rows(),
    props: [...meadTrees, ['flowers', 5, 21], ['flowers', 7, 22], ['flowers', 9, 6], ['flowers', 27, 4], ['grassTuft', 17, 21], ['grassTuft', 23, 17], ['flowers', 32, 21]],
    npcs: [
      { id: 'c12_pan', sprite: 'pan', x: 8, y: 7, talk: 'c12_pan_talk', name: 'Pan', showIf: 'quest:c12_pan', hideIf: 'c12_panCaught' },
      { id: 'c12_videlM', sprite: 'videl', x: 21, y: 25, talk: 'c12_videl_meadow', name: 'Videl', showIf: 'quest:c12_pan' },
    ],
    enemies: [
      { type: 'direWolf', x: 12, y: 22 }, { type: 'direWolf', x: 26, y: 25 }, { type: 'c12_ironBoar', x: 31, y: 10 },
      { type: 'c12_ironBoar', x: 5, y: 15 }, { type: 'stormPtero', x: 17, y: 5 }, { type: 'stormPtero', x: 33, y: 21 },
    ],
    objects: [
      { type: 'save', x: 17, y: 25 }, { type: 'worldSign', x: 23, y: 26 },
      { type: 'breakable', x: 3, y: 9, size: 2 }, { type: 'breakable', x: 34, y: 8, size: 3, item: 'end1', id: 'c12_meadowRock' },
      { type: 'breakable', x: 14, y: 24, size: 1 }, { type: 'chest', x: 35, y: 23, id: 'c12_meadowChest', item: 'pow1' },
      { type: 'sign', x: 20, y: 22, text: 'Paozu Highlands. Watch for falling toddlers.' },
    ],
    onEnter: 'c12_meadow_enter',
  },
  {
    id: 'c12_film_set', name: 'ZTV Film Lot', music: 'town', region: 'Satan City',
    legend: { '#': 'wall', a: 'asphalt', t: 'tile', '.': 'grass', '=': 'path' },
    grid: film.rows(),
    props: [
      ['building', 2, 0], ['building', 8, 0], ['ruinedBuilding', 15, 0], ['building', 26, 0], ['building', 32, 0],
      ['car', 4, 7], ['car', 31, 7], ['lamp', 10, 7], ['lamp', 29, 7],
      ['c12_filmCamera', 12, 20], ['c12_filmCamera', 26, 20], ['c12_filmCamera', 8, 11], ['chair', 21, 21],
      ['tent', 32, 11], ['table', 33, 15], ['crate', 3, 12], ['crate', 4, 12], ['crate', 3, 13], ['tv', 6, 15],
      ['barrel', 36, 18], ['plant', 2, 19], ['plant', 37, 19], ['bush', 4, 21], ['bush', 33, 21], ['flowers', 6, 22], ['flowers', 35, 22],
    ],
    npcs: [
      { id: 'c12_director', sprite: 'c12_director', x: 20, y: 22, talk: 'c12_director_talk', name: 'Director', showIf: 'c12_filmDone' },
      { id: 'c12_barry', sprite: 'c12_barry', x: 24, y: 15, talk: 'c12_barry_talk', name: 'Barry Kahn', showIf: 'c12_filmDone', wander: 1 },
      { id: 'c12_cocoa', sprite: 'c12_cocoa', x: 16, y: 12, talk: 'c12_cocoa_talk', name: 'Cocoa', showIf: 'c12_filmDone' },
      { id: 'c12_grip', sprite: 'townsman', x: 34, y: 17, talk: 'c12_grip_talk', name: 'Grip', wander: 2 },
    ],
    objects: [
      { type: 'save', x: 3, y: 23 },
      { type: 'sign', x: 23, y: 23, text: 'ZTV Studios, Lot B. QUIET ON SET. Stunt doubles report to the director.' },
    ],
    onEnter: 'act5_map_enter',
    // The lot gate closes while the shoot's fights run.
    triggers: [{ id: 'c12_filmGate', x: 17, y: 24, w: 6, h: 1, script: 'c12_film_leave', showIf: '!act5_busy' }],
  },
  {
    id: 'c12_forest', name: 'Forest of Terror', music: 'tense', hostile: true, region: 'Kame House', tint: 'rgba(30,10,50,0.32)',
    legend: { '#': 'cliff', ',': 'darkGrass', '.': 'grass', d: 'dirt', s: 'sand', '~': 'water', D: 'deep', w: 'wood' },
    grid: forest.rows(),
    props: [...forestTrees, ['shrine', 13, 13], ['c12_herb', 19, 2], ['flowers', 18, 3], ['flowers', 22, 3], ['grave', 16, 14], ['rock', 30, 30], ['palm', 4, 28], ['palm', 34, 27]],
    npcs: [
      // Krillin as he is when he comes along: the moping cop in Chapter 12, the Mighty Ten's Krillin later on.
      { id: 'c12_krillinF', sprite: 'krillin', x: 22, y: 29, talk: 'c12_krillin_forest', name: 'Krillin', showIf: 'quest:c12_krillin&!done:c13_krillin', hideIf: 'c12_herbGot' },
      { id: 'c12_krillinF2', sprite: 'krillinGi', x: 22, y: 29, talk: 'c12_krillin_forest', name: 'Krillin', showIf: 'quest:c12_krillin&done:c13_krillin', hideIf: 'c12_herbGot' },
    ],
    enemies: [
      { type: 'c12_shadeWolf', x: 9, y: 25 }, { type: 'c12_shadeWolf', x: 30, y: 14 }, { type: 'c12_shadeWolf', x: 22, y: 10 },
      { type: 'giantSnake', x: 34, y: 30 }, { type: 'c12_shadeWolf', x: 5, y: 18 },
      { type: 'c12_illRaditz', x: 12, y: 22, id: 'c12_ill1', hideIf: 'c12_calm' },
      { type: 'c12_illGinyu', x: 20, y: 15, id: 'c12_ill2', hideIf: 'c12_calm' },
      { type: 'c12_illRaditz', x: 27, y: 9, id: 'c12_ill3', hideIf: 'c12_calm' },
    ],
    objects: [
      { type: 'save', x: 17, y: 30 }, { type: 'save', x: 28, y: 6 },
      { type: 'sign', x: 16, y: 16, text: 'Carved in the shrine stone: "The frightened see monsters. The calm see only trees."' },
      { type: 'breakable', x: 6, y: 28, size: 2 }, { type: 'breakable', x: 34, y: 12, size: 3, item: 'str1', id: 'c12_forestRock' },
      { type: 'breakable', x: 10, y: 4, size: 2, look: 'jar' },
      { type: 'chest', x: 38, y: 5, id: 'c12_forestCache', item: 'pow3' },
    ],
    barriers: [{ id: 'c12_g_goku', x: 37, y: 9, w: 2, h: 1, level: 42, character: 'goku' }],
    onEnter: 'act5_map_enter',
    // Not `once`: an interrupted clearing fight re-arms when the player comes back (hidden after the herb).
    triggers: [
      { id: 'c12_forestBoss', x: 14, y: 4, w: 13, h: 3, script: 'c12_forest_boss', showIf: 'quest:c12_krillin&!act5_busy', hideIf: 'c12_herbGot' },
      { id: 'c12_forestPier', x: 19, y: 34, w: 3, h: 1, script: 'c12_forest_leave', showIf: '!act5_busy' },
    ],
  },
]);
