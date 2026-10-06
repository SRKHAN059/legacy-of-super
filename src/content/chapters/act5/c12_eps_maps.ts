import { registerMaps, registerOverlay } from '../../registry';
import { GridPainter, propsOn } from './grid';

/**
 * Locations of the two late Days of Peace episodes. "Whose Wish?" (ep 68): Bulma's secret project and drill pod on
 * the Capsule Corp pad, the seven Dragon Balls scattered over Earth, and the Earth's core (two hostile maps with a
 * heat hazard). The baseball game (ep 70): West City Ballpark, and Champa and Vados at the Capsule Corp garden table.
 */

/** Staging coordinates (tiles) shared by the maps and the episode scripts. */
export const EP = {
  /** Capsule Corp pad: the covered project, the drill pod, where Goku comes back up, the summoning lawn. */
  pad: { project: [31.75, 3.4] as [number, number], pod: [34.6, 5.2] as [number, number], podFront: [35, 8] as [number, number], lawn: [22, 20] as [number, number] },
  /** Mantle tunnels: where the pod lands, the exit to the heart. */
  mantle: { arrive: [7, 6] as [number, number], pod: [5.6, 1.2] as [number, number] },
  /** Heart of the Earth: the entrance, the arena centre where the wyrm rises, the crystal island. */
  heart: { arrive: [15, 2] as [number, number], wyrm: [16, 9] as [number, number], crystal: [14.75, 16.6] as [number, number], island: [16, 20] as [number, number] },
  /** West City Ballpark (all in tiles). */
  park: {
    home: [20, 33] as [number, number], mound: [20, 27] as [number, number], first: [26, 27] as [number, number], second: [20, 21] as [number, number], third: [14, 27] as [number, number],
    batter: [19, 33] as [number, number], catcher: [20, 34] as [number, number], umpire: [21, 35] as [number, number], field: [20, 11] as [number, number],
    arrive: [20, 35] as [number, number],
  },
};

/** Set when Bulma wheels her drill pod out onto the pad ("Whose Wish?"); it stays there from then on. */
export const POD_OUT = 'c12_podOut';

/** The seven Dragon Balls of "Whose Wish?": [pickup id, item, map, x, y, hidden, where Bulma says it is]. */
export const WISH_BALLS: Array<[string, string, string, number, number, boolean, string]> = [
  ['c12_db1', 'db1', 'paozu_peaks', 16, 21, false, 'Paozu Peaks, on Mt. Paozu'],
  ['c12_db2', 'db2', 'desert_oasis', 8, 25, true, 'the sand south of Ten-Palm Oasis, in Diablo Desert'],
  ['c12_db3', 'db3', 'kame_reef', 6, 20, false, 'Turtle Reef, past Kame House'],
  ['c12_db4', 'db4', 'korin_base', 5, 20, false, 'Korin Forest, under the Lookout'],
  ['c12_db5', 'db5', 'waste_mesa', 24, 20, false, 'the Great Mesa, in the Rocky Wasteland'],
  ['c12_db6', 'db6', 'snow_entry', 20, 14, true, 'a snowdrift in the Snowy Highlands'],
  ['c12_db7', 'db7', 'satan_mansion', 4, 27, true, 'Mr. Satan\'s flower beds, in Satan City'],
];

// ================================================================ the Earth's core: mantle tunnels
const mantle = new GridPainter(44, 36, 'h');
mantle.border('#');
mantle.rect('#', 0, 0, 44, 2);
// The drill pod's landing pad, cut into the north-west rock.
mantle.rect('m', 3, 2, 8, 4);
// Rock walls that turn the cave into corridors.
mantle.rect('#', 13, 2, 3, 6).rect('#', 22, 6, 3, 4).rect('#', 1, 8, 5, 3).rect('#', 28, 9, 3, 2).rect('#', 17, 2, 2, 2);
// North-east: a lava lake, and beyond a lava channel the ledge only a flight circle reaches.
mantle.ellipse('L', 30, 4, 3, 2);
mantle.rect('L', 36, 2, 2, 9).rect('#', 38, 10, 5, 1);
// Lava river one, with a stone bridge at each end of the cave.
mantle.line('L', [[1, 13], [10, 12], [20, 14], [30, 12], [42, 13]], 3);
mantle.replace('L', 'k', 7, 10, 3, 6).replace('L', 'k', 33, 10, 3, 6);
// The middle cavern.
mantle.rect('#', 12, 17, 4, 3).rect('#', 25, 16, 3, 4).rect('#', 37, 18, 6, 3).rect('#', 1, 18, 4, 2);
// Lava river two, one bridge in the middle.
mantle.line('L', [[1, 24], [14, 25], [26, 23], [42, 24]], 3);
mantle.replace('L', 'k', 20, 21, 3, 6);
// The way down: lava pools either side of the last stretch, and the shaft to the heart.
mantle.ellipse('L', 8, 30, 3, 2).ellipse('L', 34, 30, 3, 2);
mantle.rect('#', 1, 33, 18, 2).rect('#', 25, 33, 18, 2).rect('#', 14, 28, 3, 3).rect('#', 27, 28, 3, 3);
mantle.rect('h', 19, 33, 6, 3);
const mantleRocks = propsOn(mantle, 'hk', [
  ['boulder', 18, 9], ['rock', 5, 15], ['smallRock', 26, 7], ['rock', 39, 15], ['boulder', 8, 20], ['smallRock', 18, 19],
  ['rock', 35, 27], ['smallRock', 11, 27], ['rock', 4, 32], ['smallRock', 30, 31], ['rock', 21, 4], ['smallRock', 41, 28],
]);

// ================================================================ the Earth's core: the heart
const heart = new GridPainter(32, 26, 'h');
heart.border('#');
heart.rect('h', 13, 0, 6, 1);
heart.rect('#', 1, 1, 9, 2).rect('#', 22, 1, 9, 2);
// The crystal island in its lava moat, one bridge from the arena.
heart.ellipse('L', 16, 19, 7, 4).ellipse('h', 16, 19, 4, 2);
heart.replace('L', 'k', 15, 13, 2, 5);
heart.ellipse('L', 3, 20, 2, 3).ellipse('L', 28, 20, 2, 3);
heart.rect('#', 1, 23, 30, 2);
// Magma seeping up at the arena's edges, and rock spurs where the walls close in; the middle stays open to fight in.
heart.ellipse('L', 4, 8, 2, 1).ellipse('L', 27, 8, 2, 1);
heart.rect('#', 1, 3, 2, 3).rect('#', 29, 3, 2, 3).rect('#', 1, 13, 1, 3).rect('#', 30, 13, 1, 3);
const heartRocks = propsOn(heart, 'h', [
  ['smallRock', 4, 5], ['rock', 25, 6], ['smallRock', 9, 14], ['smallRock', 23, 14], ['rock', 2, 16], ['rock', 28, 16],
  ['smallRock', 14, 6], ['smallRock', 19, 12], ['smallRock', 7, 11],
]);

// ================================================================ West City Ballpark
const park = new GridPainter(40, 38, 'g');
// Mowing stripes across the whole field.
for (let x = 0; x < 40; x += 4) park.rect('G', x, 0, 2, 38);
// Stands: the outfield wall and bleachers along the top, the side stands, the backstop behind home.
park.rect('#', 0, 0, 40, 4).rect('#', 0, 0, 3, 38).rect('#', 37, 0, 3, 38).rect('#', 0, 36, 40, 2);
// Warning track inside the wall.
park.rect('s', 3, 4, 34, 1).rect('s', 3, 4, 1, 26).rect('s', 36, 4, 1, 26);
// The infield: a dirt diamond with a grass square inside, the mound and the home-plate circle.
for (let y = 0; y < 38; y++) {
  for (let x = 0; x < 40; x++) {
    const d = Math.abs(x - 20) + Math.abs(y - 27);
    if (d <= 7 && d >= 5) park.set('d', x, y);
    else if (d < 5) park.set(d <= 1 ? 'd' : 'g', x, y);
  }
}
park.ellipse('d', 20, 33, 2, 1);
// Dugouts down the lines: U7 on the third-base side (west), U6 on the first-base side (east).
park.rect('#', 3, 30, 8, 1).rect('w', 3, 31, 8, 4).rect('#', 29, 30, 8, 1).rect('w', 29, 31, 8, 4);
// Gate to the concourse behind home plate.
park.rect('a', 19, 36, 2, 2);
const chalk: Array<[string, number, number]> = [];
for (let i = 1; i <= 15; i++) {
  if (20 - i >= 3) chalk.push(['c12_chalkL', 20 - i, 33 - i]);
  if (20 + i <= 36) chalk.push(['c12_chalkR', 20 + i - 1, 33 - i]);
}

registerMaps([
  {
    // Underground (`indoor`): Whis's Charm cannot reach the core, so the way out is the drill pod, which takes the heat
    // suit off and hands the controls back (`c12_pod_up`).
    id: 'c12_core_mantle', name: 'Mantle Tunnels', music: 'cave', hostile: true, indoor: true, region: 'Earth\'s Core', backdrop: '#200800', tint: 'rgba(150,40,0,0.16)',
    legend: { '#': 'cliff', h: 'hellRock', k: 'rock', L: 'lava', m: 'metal' },
    grid: mantle.rows(),
    props: [
      ...mantleRocks,
      { kind: 'c12_drillPod', x: EP.mantle.pod[0], y: EP.mantle.pod[1] },
      ['c12_basalt', 11, 8], ['c12_basalt', 26, 3], ['c12_basalt', 3, 15], ['c12_basalt', 40, 15], ['c12_basalt', 9, 21], ['c12_basalt', 30, 25],
      ['c12_basalt', 17, 29], ['c12_basalt', 39, 31],
      ['c12_emberCrack', 17, 6], ['c12_emberCrack', 4, 23], ['c12_emberCrack', 28, 17], ['c12_emberCrack', 12, 31], ['c12_emberCrack', 36, 22],
      ['c12_emberCrack', 22, 16], ['c12_emberCrack', 31, 7], ['crater', 15, 21],
      ['c12_coolVent', 12, 6], ['c12_coolVent', 31, 18], ['c12_coolVent', 5, 27], ['c12_coolVent', 23, 31],
    ],
    npcs: [],
    enemies: [
      { type: 'c12_magmaSlime', x: 19, y: 8 }, { type: 'c12_cinderBat', x: 27, y: 7 }, { type: 'c12_crustCrab', x: 9, y: 17 },
      { type: 'c12_lavaSerpent', x: 22, y: 18 }, { type: 'c12_cinderBat', x: 34, y: 16 }, { type: 'c12_magmaSlime', x: 31, y: 19 },
      { type: 'c12_crustCrab', x: 11, y: 27 }, { type: 'c12_lavaSerpent', x: 30, y: 28 }, { type: 'c12_magmaSlime', x: 38, y: 27 },
    ],
    objects: [
      { type: 'save', x: 10, y: 4 },
      { type: 'sign', x: 3, y: 6, text: 'Bulma\'s note, taped to the pod: "Suit coolant lasts about a minute and a half. Blue vents refill it. DON\'T touch the orange stuff."' },
      { type: 'breakable', x: 20, y: 11, size: 2 }, { type: 'breakable', x: 3, y: 21, size: 3, item: 'end1', id: 'c12_mantleRock' },
      { type: 'breakable', x: 28, y: 15, size: 2 }, { type: 'breakable', x: 39, y: 22, size: 1 }, { type: 'breakable', x: 13, y: 31, size: 2 },
      // The north-east ledge across the lava channel: a flight circle over, another back.
      { type: 'flight', x: 34, y: 7, to: 'c12_core_mantle', tx: 40, ty: 6, label: 'Over the lava' },
      { type: 'flight', x: 39, y: 8, to: 'c12_core_mantle', tx: 33, ty: 8, label: 'Back across' },
      { type: 'chest', x: 41, y: 3, id: 'c12_mantleCache', item: 'pow3' },
    ],
    exits: { south: { to: 'c12_core_heart', offset: -6, showIf: '!act5_busy' } },
    onEnter: ['act5_map_enter', 'c12_core_enter'],
    triggers: [
      { id: 'c12_vent1', x: 12, y: 6, w: 1, h: 1, script: 'c12_core_vent' },
      { id: 'c12_vent2', x: 31, y: 18, w: 1, h: 1, script: 'c12_core_vent' },
      { id: 'c12_vent3', x: 5, y: 27, w: 1, h: 1, script: 'c12_core_vent' },
      { id: 'c12_vent4', x: 23, y: 31, w: 1, h: 1, script: 'c12_core_vent' },
      // The pod: back up to Capsule Corp (A in front of it).
      { id: 'c12_mantlePod', x: 5, y: 3, w: 3, h: 3, script: 'c12_pod_up', onAction: true, showIf: '!act5_busy' },
    ],
  },
  {
    id: 'c12_core_heart', name: 'Heart of the Earth', music: 'tense', hostile: true, indoor: true, region: 'Earth\'s Core', backdrop: '#280a00', tint: 'rgba(170,70,0,0.14)',
    legend: { '#': 'cliff', h: 'hellRock', k: 'rock', L: 'lava' },
    grid: heart.rows(),
    props: [
      ...heartRocks,
      { kind: 'c12_coreCrystal', x: EP.heart.crystal[0], y: EP.heart.crystal[1], id: 'c12_crystal', hideFlag: 'c12_alloyCut' },
      { kind: 'c12_coreStump', x: EP.heart.crystal[0], y: EP.heart.crystal[1] + 2.4, flag: 'c12_alloyCut' },
      ['c12_basalt', 6, 3], ['c12_basalt', 24, 3], ['c12_basalt', 1, 10], ['c12_basalt', 29, 10],
      ['c12_emberCrack', 8, 8], ['c12_emberCrack', 21, 10], ['c12_emberCrack', 12, 4], ['c12_emberCrack', 19, 6],
      ['c12_emberCrack', 5, 13], ['c12_emberCrack', 25, 13], ['c12_emberCrack', 15, 9],
      ['c12_basalt', 8, 2], ['c12_basalt', 22, 2], ['c12_basalt', 6, 15], ['c12_basalt', 24, 15],
      ['c12_coolVent', 3, 12], ['c12_coolVent', 28, 12], ['c12_coolVent', 15, 1],
    ],
    objects: [{ type: 'save', x: 11, y: 3 }],
    exits: { north: { to: 'c12_core_mantle', offset: 6, showIf: '!act5_busy' } },
    onEnter: ['act5_map_enter', 'c12_core_enter'],
    triggers: [
      { id: 'c12_vent5', x: 3, y: 12, w: 1, h: 1, script: 'c12_core_vent' },
      { id: 'c12_vent6', x: 28, y: 12, w: 1, h: 1, script: 'c12_core_vent' },
      { id: 'c12_vent7', x: 15, y: 1, w: 1, h: 1, script: 'c12_core_vent' },
      // The guardian rises when Goku heads for the bridge (a band across the arena, re-armed until it is beaten).
      { id: 'c12_wyrmT', x: 1, y: 10, w: 30, h: 2, script: 'c12_wyrm_fight', showIf: 'quest:c12_wish&!act5_busy', hideIf: 'c12_wyrmDown' },
      // The core alloy (A at the crystal once the guardian is down).
      { id: 'c12_crystalT', x: 13, y: 17, w: 6, h: 4, script: 'c12_cut_alloy', onAction: true, showIf: 'c12_wyrmDown', hideIf: 'c12_alloyCut' },
    ],
  },
  {
    id: 'c12_ballpark', name: 'West City Ballpark', music: 'tournament', region: 'West City',
    legend: { '#': 'wall', g: 'grass', G: 'darkGrass', d: 'dirt', s: 'sand', w: 'wood', a: 'asphalt' },
    grid: park.rows(),
    props: [
      { kind: 'c12_board_3_3_0', x: 14.5, y: 0, id: 'c12_board' },
      ['c12_bleachers', 3, 1], ['c12_bleachers', 26, 1], ['c12_foulPole', 3.2, 0.6], ['c12_foulPole', 36.4, 0.6],
      // The backstop net behind home plate, either side of the concourse gate.
      ['c12_backstop', 12.5, 36], ['c12_backstop', 21.5, 36],
      ...chalk,
      ['c12_base', 26, 27], ['c12_base', 20, 21], ['c12_base', 14, 27], ['c12_rubber', 20, 27.4], ['c12_homePlate', 18.5, 32.6],
      ['c12_bench', 3.5, 32], ['c12_bench', 29.5, 32], ['barrel', 9.6, 31], ['crate', 30, 31], ['crate', 31, 31],
      ['flowers', 4, 5], ['flowers', 35, 5], ['grassTuft', 8, 9], ['grassTuft', 31, 9], ['grassTuft', 12, 16], ['grassTuft', 27, 15],
    ],
    objects: [{ type: 'sign', x: 18, y: 36, text: 'WEST CITY BALLPARK. Today: Universe 6 vs. Universe 7. No ki. No flying. No destroying the stadium. - The Umpires' }],
    onEnter: 'act5_map_enter',
    // The concourse gate back to West City (shut while the game is on).
    triggers: [{ id: 'c12_parkGate', x: 19, y: 37, w: 2, h: 1, script: 'c12_park_leave', showIf: '!act5_busy' }],
  },
]);

// ================================================================ Capsule Corp: the pad, the summoning, Champa's challenge
registerOverlay('cc_yard', {
  props: [
    // Bulma's secret project stands on the old time machine pad from Chapter 12 until Beerus finds out about it.
    { kind: 'c12_secretProject', x: EP.pad.project[0], y: EP.pad.project[1], id: 'c12_project', flag: 'chapter>=12', hideFlag: 'c12_labGone' },
    { kind: 'c12_labCrater', x: EP.pad.project[0] - 1, y: EP.pad.project[1] - 0.4, id: 'c12_crater', flag: 'c12_labGone', hideFlag: 'c12_labRebuilt' },
    // The drill pod, from the moment Bulma wheels it out: the way down to the Earth's core, for good.
    { kind: 'c12_drillPod', x: EP.pad.pod[0], y: EP.pad.pod[1], id: 'c12_pod', flag: POD_OUT },
  ],
  npcs: [
    // Champa and Vados drop in for Earth food (and a challenge) in Chapter 12, and again after the tournament.
    { id: 'c12_champaY', sprite: 'champa', x: 28, y: 17, dir: 'left', talk: 'c12_champa_talk', name: 'Champa', showIf: 'chapter==12', hideIf: 'done:c12_ball' },
    { id: 'c12_vadosY', sprite: 'vados', x: 29, y: 16, dir: 'left', talk: 'c12_vados_talk', name: 'Vados', showIf: 'chapter==12', hideIf: 'done:c12_ball' },
    { id: 'c12_champaP', sprite: 'champa', x: 28, y: 17, dir: 'left', talk: 'c12_champa_talk', name: 'Champa', showIf: 'post_game', hideIf: 'done:c12_ball' },
    { id: 'c12_vadosP', sprite: 'vados', x: 29, y: 16, dir: 'left', talk: 'c12_vados_talk', name: 'Vados', showIf: 'post_game', hideIf: 'done:c12_ball' },
  ],
  triggers: [
    // The covered project: start "Whose Wish?" (Chapter 12 or the post-game), or report back to Bulma about it.
    { id: 'c12_projectT', x: 32, y: 6, w: 3, h: 1, script: 'c12_project_look', onAction: true, showIf: 'chapter>=12', hideIf: 'c12_labGone' },
    // The drill pod down to the Earth's core (during the episode and any time after it).
    { id: 'c12_podT', x: 34, y: 7, w: 3, h: 2, script: 'c12_pod_down', onAction: true, showIf: POD_OUT },
  ],
  onEnter: 'c12_wish_yard',
});

// King Kai, Bubbles and Gregory wait at home for a wish that never comes (after "Whose Wish?").
registerOverlay('kingkai_planet', {
  npcs: [
    { id: 'c12_kingKaiK', sprite: 'kingKai', x: 16, y: 13, dir: 'down', talk: 'c12_kingkai_talk', name: 'King Kai', showIf: 'done:c12_wish' },
    { id: 'c12_bubblesK', sprite: 'c01_bubbles', x: 12, y: 16, talk: 'c12_bubbles_talk', name: 'Bubbles', wander: 2, showIf: 'done:c12_wish' },
  ],
});

// The seven Dragon Balls, out in the world while "Whose Wish?" is open.
for (const [id, item, map, x, y, hidden] of WISH_BALLS) {
  registerOverlay(map, { pickups: [{ id, item, x, y, hidden, showIf: 'quest:c12_wish' }] });
}
