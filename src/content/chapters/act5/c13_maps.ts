import { registerMaps, registerOverlay } from '../../registry';
import { GridPainter, propsOn } from './grid';

/**
 * Chapter 13 side episodes, places: Champa's planet, Sadala's old quarter (Renso's house, Caulifla's hideout) and
 * the crags outside the city (Universe 6, eps 88-93); the escaped animals that fled into old Earth regions behind
 * coloured gates; Cabba's post-game visit to Capsule Corp.
 */

/** Staging tiles shared by the scripts (all on open ground; scripts still snap through `freeNear`). */
export const SADALA = {
  terrace: { arrive: [12, 11] as [number, number], champa: [12, 6] as [number, number], vados: [15, 6] as [number, number] },
  quarter: {
    arrive: [4, 16] as [number, number],
    renso: [5, 13] as [number, number],
    gate: [38, 15] as [number, number],
    throne: [38, 7] as [number, number],
    kale: [41, 7] as [number, number],
    henchman: [36, 8] as [number, number],
    /** Where the gang lurks when Cabba walks in: the street, the back lane, the square, the market and the collapsed block. */
    gang: [[16, 12], [21, 3], [27, 11], [7, 21], [20, 25]] as Array<[number, number]>,
  },
  crags: {
    arrive: [4, 14] as [number, number],
    centre: [19, 14] as [number, number],
    caulifla: [31, 13] as [number, number],
    kaleHide: [27, 4] as [number, number],
  },
};

// ---------------------------------------------------------------- Champa's planet: the feasting terrace
const terrace = new GridPainter(26, 16, 'v');
terrace.ellipse('g', 12.5, 8, 11.5, 6.5);
terrace.rect('m', 6, 3, 14, 10);
terrace.rect('m', 11, 13, 4, 2);

// ---------------------------------------------------------------- Sadala: the old quarter
const quarter = new GridPainter(46, 32, 'a');
quarter.border('#');
// The main street runs west to east (the east end opens onto the crags road).
quarter.rect('a', 45, 14, 1, 4);
// North side: the old city wall, a back lane under it, three alleys and the blocks between them.
quarter.rect('#', 1, 1, 32, 1).rect('r', 1, 2, 32, 2);
quarter.rect('d', 1, 9, 8, 5).rect('R', 1, 4, 8, 4).rect('W', 1, 8, 8, 1);
quarter.rect('R', 11, 4, 9, 6).rect('W', 11, 10, 9, 1).rect('a', 11, 11, 9, 3);
quarter.rect('R', 22, 4, 9, 4).rect('W', 22, 8, 9, 1).rect('q', 22, 9, 9, 5);
quarter.rect('r', 9, 4, 2, 10).rect('r', 20, 4, 2, 10).rect('r', 31, 4, 2, 10);
// Caulifla's hideout: a walled yard with one gate onto the street.
quarter.rect('R', 33, 1, 12, 3).rect('W', 33, 4, 12, 1);
quarter.rect('W', 33, 5, 1, 9).rect('W', 44, 5, 1, 9).rect('W', 33, 13, 12, 1);
quarter.rect('d', 34, 5, 10, 8);
quarter.rect('d', 37, 13, 3, 1);
// South side: the market, the collapsed block, the canal and the old park.
quarter.rect('s', 1, 18, 13, 7);
quarter.rect('R', 1, 26, 13, 3).rect('W', 1, 29, 13, 1).rect('a', 1, 30, 13, 1);
quarter.rect('r', 14, 18, 14, 13);
quarter.rect('a', 28, 18, 17, 4);
quarter.rect('~', 28, 22, 17, 2).rect('a', 35, 22, 3, 2);
quarter.rect(',', 28, 24, 17, 7);
quarter.ellipse('q', 40, 27, 3, 2);

// ---------------------------------------------------------------- Sadala: the crags outside the city
const crags = new GridPainter(40, 28, 'x');
crags.border('#');
crags.rect('x', 0, 13, 1, 4);
crags.ellipse('d', 19, 14, 10, 6);
crags.ellipse('k', 6, 7, 4, 3).ellipse('k', 33, 21, 5, 3).ellipse('k', 30, 6, 6, 3).ellipse('k', 9, 22, 5, 2);
crags.rect('#', 1, 1, 10, 3).rect('#', 14, 1, 6, 2).rect('#', 32, 1, 7, 2);
crags.rect('#', 1, 23, 5, 4).rect('#', 34, 25, 5, 2).rect('#', 37, 9, 2, 6);
crags.line('d', [[0, 14], [9, 14]], 2);

const cragProps = propsOn(crags, 'xkd', [
  ['deadTree', 3, 5], ['deadTree', 12, 4], ['deadTree', 24, 2], ['deadTree', 35, 3], ['deadTree', 5, 18], ['deadTree', 28, 23],
  ['rock', 8, 9], ['rock', 30, 8], ['rock', 14, 22], ['rock', 25, 22], ['smallRock', 4, 11], ['smallRock', 33, 11],
  ['smallRock', 22, 5], ['smallRock', 11, 19], ['smallRock', 36, 19], ['grassTuft', 7, 16], ['grassTuft', 27, 9], ['grassTuft', 17, 23],
]);

registerMaps([
  {
    id: 'c13_champa_terrace', name: 'Champa\'s Planet', music: 'godly', region: 'Champa\'s Planet', backdrop: '#1c2848',
    legend: { v: 'void', g: 'alienGrass', m: 'marble' },
    grid: terrace.rows(),
    props: [
      ['c13_feast', 9, 3], ['pillar', 6, 1.6], ['pillar', 18, 1.6], ['brokenPillar', 6, 10.6], ['pillar', 18, 10.4],
      ['alienTree', 1.5, 3.2], ['alienTree', 20.5, 3.6], ['alienTree', 2, 10], ['alienTree', 20.4, 9.6], ['fountain', 1.6, 6.4],
      ['chair', 10.5, 5.2], ['chair', 13.5, 5.2], ['rug', 11, 8.5], ['flowers', 4, 5], ['flowers', 21, 8], ['grassTuft', 5, 12], ['grassTuft', 19, 13],
    ],
  },
  {
    id: 'c13_sadala_quarter', name: 'Sadala Old Quarter', music: 'alien', region: 'Sadala (U6)', tint: 'rgba(120,60,20,0.08)',
    legend: { '#': 'cliff', a: 'asphalt', r: 'ruins', d: 'dirt', R: 'roof', W: 'wall', q: 'arena', s: 'sand', ',': 'darkGrass', '~': 'water' },
    grid: quarter.rows(),
    props: [
      // Renso's house and yard.
      ['c13_sadalaHouse', 2, 9.4], ['barrel', 7, 12], ['flowers', 6.6, 9.6], ['lamp', 8.2, 11.4],
      // Rooftop towers of the northern blocks.
      ['c13_sadalaTower', 2, 2.4], ['c13_sadalaTower', 12.6, 3], ['c13_sadalaTower', 16.8, 4], ['c13_sadalaTower', 23.6, 2.4], ['c13_sadalaTower', 27.4, 2.6],
      // Alleys and the back lane: rubble, crates, a burning drum. Clutter in the two-tile alleys sits against one wall
      // and leaves a full lane (set off-centre it left two gaps narrower than a fighter: a dead end that looks open).
      ['rubble', 10.4, 6.2], ['crate', 20, 9.4], ['c13_oilDrum', 31, 10.2], ['smallRock', 15, 2.4], ['rubble', 26, 2.2], ['barrel', 29.6, 2.2],
      // The square with King Sadala's statue, and the sidewalk.
      ['statue', 25.6, 8.6], ['lamp', 22.4, 11.6], ['lamp', 29.6, 11.6], ['lamp', 12, 11], ['lamp', 18.4, 11],
      // Caulifla's hideout.
      ['c13_scrapThrone', 37, 4.6], ['c13_couch', 34.2, 9.6], ['c13_oilDrum', 35, 6], ['c13_oilDrum', 42, 9.4], ['crate', 42.4, 5.4],
      ['barrel', 43, 6.6], ['c13_tag', 38.4, 10.6], ['rubble', 34.2, 11.8], ['car', 40.4, 11.2],
      // The main street.
      ['c13_tag', 15, 15.4], ['c13_tag', 30, 16], ['lamp', 6, 13.2], ['lamp', 34.6, 16.8], ['crate', 26, 14.2], ['rubble', 19, 16.6],
      // Market.
      ['c13_stall', 2, 18.4], ['c13_stall', 6.6, 18.4], ['c13_stall', 2, 22.2], ['c13_stall', 9.6, 22.2], ['well', 8, 19.6], ['barrel', 12.6, 18.6],
      // The collapsed block.
      ['ruinedBuilding', 16, 18.4], ['rubble', 22, 19.2], ['rubble', 15, 28.4], ['brokenPillar', 25.8, 19.6], ['crater', 17, 25.6],
      ['rubble', 21, 27.6], ['smallRock', 26, 24], ['ruinedBuilding', 22.6, 24.6],
      // The canal and the old park.
      ['c13_sadalaTower', 30, 25.2], ['tree', 33.6, 25.4], ['tree', 42.4, 24.6], ['bush', 37, 29], ['flowers', 31, 29.4], ['fountain', 38, 25.6],
      ['lamp', 29, 17.6], ['lamp', 43, 17.6], ['grassTuft', 35, 28.4], ['grassTuft', 43.2, 29.4],
      ['c13_tag', 36.6, 18.6], ['barrel', 41.4, 19.8], ['crate', 42.4, 19.6], ['smallRock', 39.4, 17.2], ['rubble', 31, 20.4],
    ],
    npcs: [
      // Post-game: Universe 6 restored, and Universe 7 is welcome.
      { id: 'c13_caulifla', sprite: 'caulifla', x: 38, y: 7, dir: 'down', talk: 'c13_sadala_caulifla', name: 'Caulifla', showIf: 'post_game' },
      { id: 'c13_kale', sprite: 'kale', x: 41, y: 7, dir: 'down', talk: 'c13_sadala_kale', name: 'Kale', showIf: 'post_game' },
      { id: 'c13_renso', sprite: 'c13_renso', x: 5, y: 13, dir: 'down', talk: 'c13_sadala_renso', name: 'Renso', showIf: 'post_game' },
      { id: 'c13_gangA', sprite: 'c13_gangPunk', x: 36, y: 8, talk: 'c13_sadala_gang', name: 'Gang Punk', showIf: 'post_game', wander: 1 },
      { id: 'c13_gangB', sprite: 'c13_gangBrute', x: 39, y: 15, dir: 'down', talk: 'c13_sadala_gang', name: 'Gang Bruiser', showIf: 'post_game' },
      { id: 'c13_gangC', sprite: 'c13_gangSlinger', x: 31, y: 9, talk: 'c13_sadala_gang', name: 'Gang Slinger', showIf: 'post_game', wander: 1 },
      { id: 'c13_folkA', sprite: 'c13_sadalanF', x: 5, y: 20, talk: 'c13_sadala_folk', name: 'Stall Keeper', showIf: 'post_game' },
      { id: 'c13_folkB', sprite: 'c13_sadalan', x: 25, y: 11, talk: 'c13_sadala_folk', name: 'Sadalan', showIf: 'post_game', wander: 2 },
      { id: 'c13_folkC', sprite: 'c13_sadalan', x: 36, y: 28, talk: 'c13_sadala_folk', name: 'Old Saiyan', showIf: 'post_game', wander: 1 },
      { id: 'c13_guard', sprite: 'c13_sadalaGuard', x: 8, y: 16, dir: 'right', talk: 'c13_sadala_guard', name: 'Defense Force', showIf: 'post_game' },
    ],
    objects: [
      { type: 'save', x: 2, y: 15 }, { type: 'worldSign', x: 2, y: 17 },
      { type: 'sign', x: 12, y: 13, text: 'SADALA DEFENSE FORCE NOTICE: patrols do not enter this quarter. Residents are advised to settle disputes "with dignity".' },
      { type: 'sign', x: 37, y: 14, text: 'Scratched into the gate: CAULIFLA\'S TURF. Knock first. Then run.' },
      { type: 'breakable', x: 10, y: 3, size: 2, look: 'crate' }, { type: 'breakable', x: 28, y: 3, size: 1, look: 'jar' },
      { type: 'breakable', x: 12, y: 24, size: 1, look: 'crate' }, { type: 'breakable', x: 25, y: 22, size: 2 },
      { type: 'breakable', x: 43, y: 29, size: 2 }, { type: 'breakable', x: 42, y: 11, size: 1, look: 'jar' },
      // A stash behind the collapsed block (open it during the gang brawl or any later visit).
      { type: 'chest', x: 26, y: 30, id: 'c13_sadalaStash', item: 'pow3' },
    ],
    // The quarter's east gap (rows 14-17) opens onto the crags' west pass (rows 13-16).
    exits: { east: { to: 'c13_sadala_crags', offset: -1, showIf: 'post_game&!act5_busy' } },
    onEnter: 'act5_map_enter',
  },
  {
    id: 'c13_sadala_crags', name: 'Sadala Crags', music: 'alien', hostile: true, region: 'Sadala (U6)', tint: 'rgba(140,50,20,0.10)',
    legend: { '#': 'cliff', x: 'wasteland', k: 'rock', d: 'dirt' },
    grid: crags.rows(),
    props: [
      ...cragProps,
      ['c13_rockSpire', 11, 9.4], ['c13_rockSpire', 26, 8.6], ['c13_rockSpire', 7, 24], ['c13_rockSpire', 23, 22.4], ['c13_rockSpire', 34.6, 12],
      ['boulder', 26, 4.2], ['boulder', 15, 19.6], ['crater', 17, 12.6], ['crater', 22, 15.6], ['crater', 31, 18], ['crater', 12, 16.4],
      // Scuffs and pebbles on the sparring ground (walk-through).
      ['smallRock', 15, 10], ['smallRock', 24, 12.4], ['grassTuft', 13, 13.2], ['smallRock', 20, 18.2], ['grassTuft', 26, 16.6], ['smallRock', 10, 15.4],
    ],
    // The wildlife keeps away while Universe 6 is training here in Chapter 13.
    enemies: [
      { type: 'c13_sadalaPtero', x: 30, y: 5, showIf: 'post_game' }, { type: 'c13_sadalaPtero', x: 8, y: 20, showIf: 'post_game' },
      { type: 'c13_cragHound', x: 33, y: 21, showIf: 'post_game' }, { type: 'c13_cragHound', x: 18, y: 6, showIf: 'post_game' },
      { type: 'c13_cragHound', x: 24, y: 19, showIf: 'post_game' },
      { type: 'c13_cragHound', x: 22, y: 12, showIf: 'post_game' }, { type: 'c13_cragHound', x: 14, y: 15, showIf: 'post_game' },
      { type: 'c13_cragHound', x: 17, y: 23, showIf: 'post_game' }, { type: 'c13_cragHound', x: 34, y: 11, showIf: 'post_game' },
      { type: 'c13_cragHound', x: 11, y: 8, showIf: 'post_game' },
    ],
    objects: [
      { type: 'breakable', x: 6, y: 6, size: 3, item: 'end3', id: 'c13_cragRock' }, { type: 'breakable', x: 33, y: 22, size: 2 },
      { type: 'breakable', x: 13, y: 22, size: 2 }, { type: 'breakable', x: 29, y: 10, size: 1 },
      { type: 'sign', x: 3, y: 12, text: 'Carved into the rock: "Cabba was here. So was Caulifla. She broke the last sign."' },
    ],
    // Kale's set piece: press A beside Caulifla to make her step in (the rest of the fight is the survive timer).
    triggers: [{ id: 'c13_u6ShoutT', x: 30, y: 12, w: 3, h: 3, script: 'c13_u6_shout', onAction: true, showIf: 'c13_u6Rampage' }],
    exits: { west: { to: 'c13_sadala_quarter', offset: 1, showIf: 'post_game&!act5_busy' } },
    onEnter: 'act5_map_enter',
  },
]);

// ---------------------------------------------------------------- the escaped animals in old regions (LoG2's gated Nameks)
// The Cliff Bat squeezed into the sealed cave behind the canyon's Vegeta gate.
registerOverlay('waste_canyon', {
  npcs: [{ id: 'c13_ani5', sprite: 'c13_cliffBat', x: 4, y: 5, talk: 'c13_animal_talk', name: 'Cliff Bat', showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani5' }],
});
// The Baby Dino followed the warmth to the hot-spring dino park behind Highland Peak's Goku gate.
registerOverlay('snow_peak', {
  npcs: [{ id: 'c13_ani2', sprite: 'c13_babyDino', x: 6, y: 24, talk: 'c13_animal_talk', name: 'Baby Dino', showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani2' }],
});
// The Emerald Kite flew out to sea and roosts on Turtle Reef's outer atoll, past the sandbar's Gohan gate.
registerOverlay('kame_reef', {
  npcs: [{ id: 'c13_ani4', sprite: 'c13_emeraldKite', x: 32, y: 8, talk: 'c13_animal_talk', name: 'Emerald Kite', showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani4' }],
});

// ---------------------------------------------------------------- Cabba visits Master Vegeta (post-game)
registerOverlay('cc_yard', {
  npcs: [{ id: 'c13_cabbaCC', sprite: 'cabba', x: 30, y: 18, dir: 'left', talk: 'c13_cabba_cc', name: 'Cabba', showIf: 'post_game' }],
});
