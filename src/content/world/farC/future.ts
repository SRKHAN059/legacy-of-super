import type { EnemySpawn, PropPlacement } from '../../../game/mapdef';
import { registerMaps } from '../../registry';

/**
 * Future Earth (region "Future Earth", world 'future').
 * Edge chain (west → east): future_hideout_out ↔ future_highway ↔ future_city; future_city north ↔ future_cc_ruins.
 * The hideout hatch warps down into future_hideout_in.
 * Enemy mixes: prologue (Trunks L6) uses `chapter<9`; Ch9+ swaps in Black's patrols (`chapter>=9`) for the Goku L33
 * who grinds the Goku 35 gate here, Ch11 adds a heavy. The prologue mix keeps to drones and Scrap Hounds for the L6
 * Trunks who walks in (LoG2's West City Highway band: a few hits to kill, about 12 to knock out); Guard Drones belong
 * to the Chapter 2-3 zones. Stats and their LoG2 band: ./enemies.ts.
 */

const EARLY = 'chapter<9';
const LATE = 'chapter>=9';
const early = (type: string, x: number, y: number): EnemySpawn => ({ type, x, y, showIf: EARLY });
const late = (type: string, x: number, y: number, showIf = LATE): EnemySpawn => ({ type, x, y, showIf });

/** Lane dashes every other tile along a road row (skipping crossroads). */
function laneRow(y: number, from: number, to: number, skip: number[] = []): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (let x = from; x <= to; x += 2) if (!skip.includes(x)) out.push(['fc_lane', x, y]);
  return out;
}

/** Lane dashes every other tile down a road column. */
function laneCol(x: number, from: number, to: number, skip: number[] = []): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (let y = from; y <= to; y += 2) if (!skip.includes(y)) out.push(['fc_laneV', x, y]);
  return out;
}

registerMaps([
  // ------------------------------------------------------------------ Ruined West City
  {
    id: 'future_city', name: 'Ruins of West City', music: 'future', hostile: true, region: 'Future Earth',
    tint: 'rgba(60,30,20,0.10)',
    legend: { '#': 'cliff', 'a': 'asphalt', 'r': 'ruins', 'k': 'rock', 'd': 'dirt', 'w': 'wasteland', '~': 'water' },
    grid: [
      '####################kaaak#####################',
      '#rr###rrrkkrrrrrrrrrkaaakrrrrrrrrrkr##########',
      '#r####rrkaakrrrrrrrrraaakrrrrrrrrraa#kkkkkkk##',
      '######rrkaakrrrrrrrrkaaarrrrrrrrrkaakkrkkkkk##',
      '######rrkaakrrrrrrrrkaaakrrrrrrrrkaakkkkkkrk##',
      '#rkkrkkkkaakkkrkkkkkraaakkrkkkkkkkaa##########',
      '#raaaaaaaaaa####aaaaaaaaaaaaaaaaaaaaaaaaaaaak#',
      '#kaaaaaaaaaaa####aaaaaaaaaaaaaaaaaaaaaaaaaaar#',
      '#rkkkkrkkaakkkkkkrrkkaaarkkkkrkkkkaakkkkrkkkr#',
      '#rrrrrrrkaakrrrrrrrrkaaakrwrrrrrrkaakrrrrrrrr#',
      '#rrrrrrrkaakrrrrrrrrkaaakwwwwwwrrraakrrrrrrrr#',
      '#rrrrrrrraakrrrrrrrrkaaakwwwwwwwrraarrrrrrrrr#',
      '#rrrrrrrkaakrrrrrrrrkaaakrrwrwwwrkaarrrrrrrrr#',
      'kkkkkkrkraakkkkkkkkkraaakrkkkrkkkkaakkkkkkkrr#',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#',
      'kkkkkrrkkaakkrddwdkrkaaakrrkrkkkkkaakrdkkdkkk#',
      '#rrrrrrrraakwdwdwdddkaaakrrrrrrrrkaakdd~~dddr#',
      '#rrrwwwrkaakdwddddwdraaakrrrrrrrrraakd~~~~~dd#',
      '#rrrwwwrraakddddddwwwaaakrrrrrrrrkaad~~~~~~~d#',
      '#rrwwwwwkaadddwddwddkaaarrrrrrrrrraadd~~~~~~d#',
      '#rwwwwwwkaakdddddddwkaaakrrrrrrrrkaakdd~~~~dd#',
      '#rkkkkkkkaarkkkkddkkkaaakkkkkrkrkkaakrddd~ddr#',
      '#raaaaaaaaaaaaaaaaaaaaaaaaa###aaaaaaaaaaaaaar#',
      '#kaaaaaaaaaaaaaaaaaaaaaaaa###aaaaaaaaaaaaaaak#',
      '#r###kkkkaakkrkrkkkkraaakkkkrrkkkkaakrrrkkrkr#',
      '#r###rrrkaakrrrrrrrrkaaakrwrwwrrrkaakrrrrr##r#',
      '#r###rrrkaakrrrrrrrrkaaakrwwwwwwrkaakrr#######',
      '#####rrrkaakrrrrrrrrkaaarrwwwwwwrkaakrr#######',
      '#rr##rrrrkkrrrrrrrrrkaaakrrrrrrrrrkkrrrr######',
      '##############################################',
    ],
    props: [
      // Faded lane paint down the two avenues.
      ...laneRow(15, 1, 43, [21, 23, 25]), ...laneCol(22, 1, 29, [7, 15, 25]),
      // North blocks.
      ['ruinedBuilding', 12, 1], ['fc_ruinTower', 16.5, 0], ['rubble', 6, 2], ['smallRock', 19.5, 2.4],
      ['ruinedBuilding', 25, 1], ['fc_ruinDome', 29, 2], ['fc_smoke', 27.5, 0],
      // Shelter (NE): a gutted lobby where survivors stash supplies.
      ['crate', 37, 2], ['barrel', 43, 4], ['fc_sandbags', 37.2, 3.9],
      // Middle blocks.
      ['ruinedBuilding', 2, 8], ['rubble', 6, 11],
      ['ruinedBuilding', 12, 8], ['crater', 16, 10], ['rubble', 18, 12], ['grassTuft', 15, 12.2],
      ['crater', 25.5, 9.5], ['fc_smoke', 27, 7.5], ['fc_wreck', 29, 11], ['smallRock', 31.5, 9],
      ['fc_ruinTower', 37, 7.5], ['ruinedBuilding', 41, 8],
      // Avenue A: stalled traffic and a bomb crater at the crossroads.
      ['fc_wreck', 4, 14], ['fc_wreck', 14, 15.5], ['fc_wreck', 30, 14.2], ['fc_wreck', 40, 15.4], ['crater', 24.5, 14.6],
      ['lamp', 7, 12], ['lamp', 31, 16.5], ['smallRock', 18, 14.3], ['smallRock', 35.5, 16.2],
      // Street C / D wrecks.
      ['fc_wreck', 30, 6], ['fc_wreck', 13, 24], ['fc_wreck', 38, 24.6], ['smallRock', 5, 7], ['smallRock', 32, 25],
      // Burnt park with the memorial statue.
      ['deadTree', 12, 16.5], ['deadTree', 18, 16.5], ['deadTree', 11.5, 20.5], ['deadTree', 18.5, 20.5], ['statue', 15, 18.5],
      ['grassTuft', 13, 22], ['grassTuft', 17, 19.5], ['flowers', 16, 21.2],
      // South-west lot.
      ['deadTree', 2, 17.5], ['fc_smoke', 4, 18], ['smallRock', 6, 22],
      // South-east blocks and the flooded crater.
      ['ruinedBuilding', 25, 17], ['fc_ruinDome', 29, 18.5],
      ['deadTree', 42.5, 16.6], ['rubble', 37, 22.4], ['grassTuft', 43, 22.3],
      ['ruinedBuilding', 12, 26], ['fc_ruinTower', 16.5, 24.6],
      ['crater', 26, 27], ['fc_smoke', 29, 25.5], ['ruinedBuilding', 36, 26],
      ['rubble', 6, 29],
    ],
    enemies: [
      // Prologue: T1 near the shelter, T2 deeper in.
      early('fc_scavDrone', 38, 7), early('fc_scavDrone', 31, 10), early('drone', 28, 3), early('drone', 40, 11),
      early('fc_scrapHound', 12, 15), early('fc_scrapHound', 6, 20), early('fc_scrapHound', 22, 21),
      early('fc_scrapHound', 27, 21), early('fc_scrapHound', 8, 27),
      // Ch9+: Black's purge patrols (the Goku 35 gate's grind zone with the Capsule Corp ruins). Two Hunter Drones, not
      // three: their lasers deal most of a clear's damage, and three cost the Goku L33 who grinds here a Senzu Bean on
      // every clear.
      late('fc_hunterDrone', 38, 7), late('fc_hunterDrone', 16, 10), late('fc_ravager', 6, 20),
      late('mechTrooper', 26, 15), late('fc_ravager', 18, 15), late('goldDrone', 28, 26), late('fc_ravager', 14, 25),
      late('redMech', 31, 21, 'chapter>=11'),
    ],
    objects: [
      { type: 'save', x: 42, y: 2 },
      { type: 'worldSign', x: 39, y: 2 },
      { type: 'sign', x: 2, y: 13, text: 'Route 9 on-ramp. WARNING: the overpass collapsed. Use the service road below.' },
      { type: 'sign', x: 25, y: 1, text: 'Capsule Corporation, 2 blocks north. (Someone has scrawled underneath: "Bulma, we kept the lights on.")' },
      { type: 'chest', x: 2, y: 22, id: 'fc_cap_city_1', item: 'pow1' },
      { type: 'breakable', x: 7, y: 10, size: 2 },
      { type: 'breakable', x: 19, y: 4, size: 1 },
      { type: 'breakable', x: 32, y: 22, size: 2, item: 'str1', id: 'fc_brk_city_1' },
      { type: 'breakable', x: 43, y: 11, size: 1, look: 'crate' },
      { type: 'breakable', x: 7, y: 27, size: 1, look: 'jar' },
    ],
    pickups: [{ id: 'del_future_city_1', item: 'delicacy', x: 14, y: 21, hidden: true }],
    exits: {
      west: { to: 'future_highway', offset: -9 },
      north: { to: 'future_cc_ruins', offset: -3 },
    },
  },

  // ------------------------------------------------------------------ Collapsed highway
  {
    id: 'future_highway', name: 'Route 9 Overpass', music: 'future', hostile: true, region: 'Future Earth',
    tint: 'rgba(60,30,20,0.10)',
    legend: { '#': 'cliff', 'a': 'asphalt', 'r': 'ruins', 'k': 'rock', 'd': 'dirt', 'w': 'wasteland', '~': 'water' },
    grid: [
      '################################################',
      '################################################',
      '################################################',
      '#kkkkkkkkkkkkkkkkkkkk#######kkkkkkkkkkkkkkkkkkk#',
      'aaaaaaaaaaaaaaaaaaaa#######aaaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaaa######aaaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaaa######aaaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaaa#######aaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaa#######aaaaaaaaaaaaaaaaaaaaa',
      '#kkkkkkkkkkkkkkkrrrkk#######krrrkkkkkkkkkkkkkkk#',
      '###############rrrr##########rrrr###############',
      '################rrrr########rrrr################',
      '#wwwwwwwwwwwwwwwrrrwwwwwwwwwwrrrwwwwwwwwwwwwwww#',
      '#ww#####wwwwwwwwwwwwwwwwwrwwwwwwwwwwwrwwrrrwwww#',
      '#ww####wwwwwwwwwwwwwwwrrrrrwwwwwwwwwwwrrrrrrrww#',
      '#www##w#wwwwwwwwwwwwrrrrrrrwwwwwwwwwwrrrrrrrrww#',
      '#wwwwwwwwwwwwwwwwrrrwrrrrrrrwwwwwwwwwwrrrwwwwww#',
      '#ddddwddwddddwddddwdddwwdwddddddddddddwdddwdddd#',
      '#ddddwddddddddddddwdddwddwdwwdddddddddddddddwdd#',
      '#wwwwwwwwwwwwwwwwwwrrrrrrrrrwwwwwwwwwwwwwwww##w#',
      '#wwwwrrrrwwwwwwwwwwwrrrrrrrrrwwwwwwwwwwwkw####w#',
      '#wwwwrrrrrrrr~~wwwwwwrrrrrrrrwwwwwwwwwkkkkk###w#',
      '#wwwwrrrrrrr~~~~~wwwrrrrrrwwrwwwwwwwwkkkkkk###w#',
      '#wwwwwrrrrwwd~~~wwwwwrwwrwwwwwwwwwwwwwwkkkkw##w#',
      '#wwwwwwrrwwwwddwwwwwwwwwwwwwwwwwwwwwwwwkkwwwwww#',
      '################################################',
    ],
    props: [
      // Deck: lane paint and stalled traffic from the day the androids hit, never cleared.
      ...laneRow(6, 0, 16), ...laneRow(6, 31, 47),
      ['fc_wreck', 5, 4.4], ['fc_wreck', 11, 6.6], ['rubble', 15, 4.5], ['fc_wreck', 34, 4.2], ['fc_wreck', 40, 6.8], ['rubble', 44, 4.6],
      ['fc_smoke', 22, 1.5], ['fc_smoke', 24.5, 3.5],
      // Ground level: the old suburb under the overpass.
      ['ruinedBuilding', 9, 12], ['fc_ruinDome', 38, 12], ['fc_ruinDome', 30, 13], ['fc_ruinDome', 3, 20.4], ['ruinedBuilding', 27, 20.5],
      ['deadTree', 2, 19], ['deadTree', 17, 20.5], ['deadTree', 32, 19.5], ['deadTree', 44, 15.5],
      ['fc_wreck', 8, 16.8], ['fc_wreck', 25, 17.6], ['fc_wreck', 41, 17],
      ['crater', 19.5, 19], ['crater', 33, 22.5], ['rubble', 22, 13.4], ['smallRock', 5, 17],
    ],
    enemies: [
      // The prologue's Scavenger Drone waits on the service road: from the west end of the deck it backed away from a
      // hero coming in from the east, over the rocks by the exit, and peppered an L6 Trunks it could not be reached by.
      early('fc_scavDrone', 14, 17), early('drone', 38, 6), early('fc_scrapHound', 33, 7),
      early('fc_scrapHound', 8, 19), early('fc_scrapHound', 33, 22), early('fc_scrapHound', 22, 15),
      // Ch9+: the Hunter Drones patrol the middle of the open ground under the overpass. A shooter backs away from the
      // hero: on the deck it backs out over the cliffs, out of reach, and near an edge it backs into a corner.
      late('fc_hunterDrone', 12, 16), late('fc_hunterDrone', 34, 19), late('fc_ravager', 23, 18),
      late('mechTrooper', 38, 6), late('goldDrone', 13, 15),
    ],
    objects: [
      { type: 'sign', x: 2, y: 3, text: 'ROUTE 9 - West City 3 km. Overpass damaged: use the ramp to the service road.' },
      { type: 'flight', x: 18, y: 6, to: 'future_highway', tx: 30, ty: 6, label: 'Hop the gap' },
      { type: 'flight', x: 29, y: 6, to: 'future_highway', tx: 17, ty: 6, label: 'Hop the gap' },
      { type: 'chest', x: 41, y: 22, id: 'fc_cap_hwy_1', item: 'end1' },
      { type: 'breakable', x: 12, y: 20, size: 2 },
      { type: 'breakable', x: 30, y: 23, size: 1 },
      { type: 'breakable', x: 9, y: 21, size: 3, item: 'pow1', id: 'fc_brk_hwy_1' },
      { type: 'breakable', x: 35, y: 15, size: 1, look: 'jar' },
    ],
    exits: {
      west: { to: 'future_hideout_out', offset: 5 },
      east: { to: 'future_city', offset: 9 },
    },
  },

  // ------------------------------------------------------------------ Hideout entrance
  {
    id: 'future_hideout_out', name: 'Resistance Hideout', music: 'futureWorld', region: 'Future Earth',
    tint: 'rgba(60,30,20,0.10)',
    legend: { '#': 'cliff', 'r': 'ruins', 'k': 'rock', 'd': 'dirt', 'w': 'wasteland' },
    grid: [
      '####################################',
      '#wwww#wwwwwwwwwwwwwwwwwwwwwwwwwwwww#',
      '#wwww##wwwwwwwwwwwwwwwww##w##w#wwww#',
      '#wwww####wwwwww###wwwwww#######wwww#',
      '#www######wwwww###wwwwww########www#',
      '#ww#########www###rwwrwwr####wwwwww#',
      '#w#########wrwwrrrrwrwrr#####wwwwww#',
      '#ww######wwrrrrrwrrwwrrrr#rwrwrwwww#',
      '#www###rrrrrrrrrrwrrrrrwrrrrrwrrrrr#',
      '#rwrrrrrrrrwrrrwrrrrwrrwrrrwrrrrrddd',
      '#wwwwrrrrrrrrrrrwwrrwrrrwwrddddddddd',
      '#wwwwwwrrrrrrrkkkkkkrddddddddddddddd',
      '#wwwwrwwrrrrrrkkkkkkdddddddddddddddd',
      '#wwrrrrrrrwrrrkkkkkkddddddddddrrrddd',
      '#wwrrrrrwrrrrrkkkkkkdrwrrrrwrwwrwrr#',
      '#wwwwrrwrrrrrrkkkkkkrrrrwrrrrrwwrww#',
      '#wwwwrrrrwrrrrrrddrrrrrrrrrrrrwwwww#',
      '#wwr#rwrrrwrrrrrddrrrwrrrrrr##rwwww#',
      '#wwr###rrrrrrrrdddddrrrrwrr####w#ww#',
      '#ww#####rrwrrdddddddrrrrrrr#######w#',
      '#w######rrrrrrddddddddrrrww#######w#',
      '#ww#####rrrrwrrddddddrrrwww#######w#',
      '#ww#####rwrrrrddddddrwwrww########w#',
      '#wwwwwwwrwwwwwrwwrrrrwwwww####w#www#',
      '#wwwwwwwwwwwwrwwwwwwwwwwwwwwwwwwwww#',
      '####################################',
    ],
    props: [
      // The hatch, ringed by crates and rubble barricades.
      { kind: 'fc_hatch', x: 16, y: 11.75 },
      ['crate', 14, 11], ['crate', 14, 12], ['barrel', 19, 11.2], ['fc_sandbags', 12.4, 14.3], ['fc_sandbags', 18.4, 14.3],
      ['tent', 8.5, 11.4], ['tent', 4.5, 13.6], ['campfire', 11, 13.5], ['well', 10, 16], ['fc_ruinDome', 22, 15.4],
      ['deadTree', 3, 8], ['deadTree', 26.6, 15], ['deadTree', 30.5, 14.6], ['deadTree', 9, 21],
      ['fc_smoke', 6, 2.5], ['fc_smoke', 28, 1.5], ['ruinedBuilding', 21.5, 4.5],
      ['fc_wreck', 26, 9.6], ['smallRock', 23, 19], ['smallRock', 11, 17],
    ],
    npcs: [
      { id: 'fc_lookout', sprite: 'resistance', x: 21, y: 9, dir: 'right', talk: 'fc_talk_lookout', name: 'Lookout Dane', hideIf: 'chapter>=12' },
    ],
    objects: [
      { type: 'save', x: 19, y: 19 },
      { type: 'worldSign', x: 14, y: 19 },
      { type: 'sign', x: 31, y: 14, text: 'NOTHING HERE BUT RUBBLE. KEEP MOVING. (The letters are freshly painted.)' },
    ],
    warps: [{ x: 16, y: 12, w: 2, h: 1, to: 'future_hideout_in', tx: 9.5, ty: 11, dir: 'up', door: true }],
    exits: { east: { to: 'future_highway', offset: -5 } },
  },

  // ------------------------------------------------------------------ Hideout interior
  {
    id: 'future_hideout_in', name: 'Resistance Hideout', music: 'futureWorld', indoor: true, region: 'Future Earth',
    legend: { 'W': 'wall', 'm': 'metal', 'o': 'wood', 't': 'tile' },
    grid: [
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WooooooommmWtttttttW',
      'WooooooommmWtttttttW',
      'WooooooommmWtttttttW',
      'WooooooommmttttttttW',
      'WooooooommmttttttttW',
      'WWWWooWWmmmWtttttttW',
      'WmmmmmmmmmmWWWWttWWW',
      'WmmmmmmmmmmmmmmmmmmW',
      'WmmmmmmmmmmmmmmmmmmW',
      'WmmmmmmmmmmmmmmmmmmW',
      'WWWWWWWWWmmWWWWWWWWW',
    ],
    props: [
      // Bunk room (west).
      ['fc_bunk', 1, 2], ['fc_bunk', 2.6, 2], ['fc_bunk', 4.2, 2], ['crate', 6, 3], ['rug', 2, 5], ['jar', 6.2, 6.4],
      // Future Bulma's lab (east): time machine bay, consoles, parts shelf, workbench.
      ['fc_console', 12, 2], ['bookshelf', 17, 2], ['timeMachine', 14, 5], ['table', 17, 6], ['barrel', 12.2, 7.4],
      // Common room: mess table and supplies.
      ['table', 3, 10], ['chair', 2, 10], ['chair', 5, 10],
      ['crate', 17, 10], ['crate', 18, 10], ['crate', 18, 11], ['barrel', 17.1, 12], ['jar', 12.2, 12], ['plant', 8.1, 9],
      { kind: 'stairs', x: 9, y: 12 }, { kind: 'stairs', x: 10, y: 12 },
    ],
    npcs: [
      { id: 'fc_medic', sprite: 'townswoman', x: 6, y: 11, dir: 'down', talk: 'fc_talk_medic', name: 'Medic Sora', hideIf: 'chapter>=12' },
      { id: 'fc_tamo', sprite: 'oldMan', x: 14, y: 11, dir: 'left', talk: 'fc_talk_tamo', name: 'Old Tamo', hideIf: 'chapter>=12' },
      { id: 'fc_kiko', sprite: 'kidNpc', x: 4, y: 6, dir: 'down', talk: 'fc_talk_kiko', name: 'Kiko', wander: 1, hideIf: 'chapter>=12' },
    ],
    objects: [{ type: 'save', x: 1, y: 12 }],
    warps: [{ x: 9, y: 13, w: 2, h: 1, to: 'future_hideout_out', tx: 16.5, ty: 14, dir: 'down', door: true }],
  },

  // ------------------------------------------------------------------ Capsule Corp ruins
  {
    id: 'future_cc_ruins', name: 'Capsule Corp Ruins', music: 'future', hostile: true, region: 'Future Earth',
    tint: 'rgba(60,30,20,0.10)',
    legend: { '#': 'cliff', 'a': 'asphalt', 'r': 'ruins', 'k': 'rock', 'd': 'dirt', 'w': 'wasteland', '~': 'water', 't': 'tile', 'W': 'wall', 'm': 'metal' },
    grid: [
      '########################################',
      '#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#',
      '#w#w##wwwwwwwwwwwdwwwwwwwwwwwwwwwwwwwww#',
      '########wwwwwwwwddwwdddwwwwwwWWWWWWWWWw#',
      '########wwwwwwwwdwddddwdwddwwWmmmmmmmWw#',
      '#######wwwwwwwwwdddddwwddddwwWmmmmmmmWw#',
      '#w###w#wwwwwwddwddwddwddwdddwmmmmmmmmWw#',
      '#ww#ww#wwwrddwdwdddddddddddwdmmmmmmmmWw#',
      '#wwwwwwrrrrdwdwwdwdddkdkwddwwWmmmmmmmWw#',
      '#wwwwwwwrrrrdkkkkkkdddkkkkkwdWmmmmmmmWw#',
      '#wwwwwwwrrrdddkkkkkkkkkkkkkwwWWWWWWWWWw#',
      '#wwwwwdwrrddwkkkkkkkkkkkkkkkwwddddwdwww#',
      '#ddwddwdddddkkkkkkkkkkkkkkddddddddwdwww#',
      '#wdddddwdddwkdkkkkkkkkkkkkkddddddddwwww#',
      '#wdwddwdddddwdkkdaaaaakkkkkdwdwdddddddd#',
      '#wwdtttttttddkdwdaaaaawwkkkddddwwddddww#',
      '#wddt~~~~ttdddwddaaaaawdddwddddwwwddddw#',
      '#wddt~~~~~tdddddwaaaaawdwwwdddwwddddddd#',
      '#wwwtr~~~~tddwdddaaaaadddddrrwddddddddw#',
      '#wwwtttttttddwdddaaaaadwwrrrrrrddddd#wd#',
      '#wwwwwdwddddddddwaaaaawwdrrrrrrddd####w#',
      '#wwwdddddddwwwddwaaaaadddrrrrdr#########',
      '#www#wwwwwdwddddwaaaaadwdrrrrddd########',
      '#######ddddwwddddaaaaawdddddddwwww######',
      '#w######ddwddddwdaaaaawdddddwwwww#####w#',
      '#w#####wwdddwddddaaaaawwdwwwwwwww###w#w#',
      '#w#wwwwwwwwdddddwaaaaawwwwwwwwwwwwwwwww#',
      '#################aaaaa##################',
    ],
    props: [
      ['fc_smoke', 20.5, 1.5], ['fc_ccRuins', 16, 4], ['fc_smoke', 25, 3],
      ['ruinedBuilding', 2, 8], ['rubble', 8, 7.6], ['fc_ruinDome', 9, 3.5], ['fc_ruinDome', 30, 10.8], ['smallRock', 14, 16.5], ['smallRock', 24, 21],
      ['bookshelf', 32, 3], ['crate', 34, 8.5], ['crate', 35, 8.5],
      ['deadTree', 9, 11.5], ['deadTree', 27, 13], ['deadTree', 12.5, 22], ['deadTree', 26, 23], ['deadTree', 35, 12.6],
      ['crater', 24.5, 17.5], ['fc_wreck', 13, 19.6], ['fc_wreck', 23, 25], ['brokenPillar', 11, 14.5], ['brokenPillar', 27, 9.6],
      ['rubble', 29, 21.2], ['smallRock', 6, 13],
    ],
    enemies: [
      early('fc_scrapHound', 20, 20), early('fc_scrapHound', 9, 22), early('fc_scavDrone', 14, 11), early('fc_scavDrone', 26, 11), early('fc_scrapHound', 32, 16),
      late('fc_hunterDrone', 14, 11), late('fc_hunterDrone', 26, 11), late('fc_ravager', 20, 18), late('goldDrone', 32, 16),
      late('redMech', 26, 7, 'chapter>=11'),
    ],
    barriers: [{ id: 'fc_vault', x: 29, y: 6, w: 1, h: 2, level: 34, character: 'trunks' }],
    objects: [
      { type: 'sign', x: 16, y: 15, text: 'CAPSULE CORPORATION - Research & Development. Authorised personnel only.' },
      { type: 'chest', x: 35, y: 5, id: 'fc_cap_ccr_1', item: 'pow3' },
      { type: 'chest', x: 31, y: 8, id: 'del_future_cc_ruins_1', item: 'delicacy' },
      { type: 'breakable', x: 11, y: 12, size: 2 },
      { type: 'breakable', x: 28, y: 18, size: 1, item: 'end1', id: 'fc_brk_ccr_1' },
      { type: 'breakable', x: 34, y: 15, size: 2 },
      { type: 'breakable', x: 7, y: 20, size: 1, look: 'jar' },
    ],
    exits: { south: { to: 'future_city', offset: 3 } },
  },
]);
