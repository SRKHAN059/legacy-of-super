import { registerMaps } from '../../registry';
import { HUB } from './hubs';
import { SEALED } from './util';

/**
 * Prologue maps (Future Earth, Age 796).
 * - c00_skyline: opening panorama of ruined West City (cutscene only).
 * - c00_tunnel: the collapsed service tunnel under the hideout (LoG2-style tutorial run):
 *   maintenance bay (save point) -> rubble choke (melee tutorial) -> caved-in tunnel (first hostile zone) ->
 *   the flooded road: the far flight circle is buried under rubble, out of punching range (ki-blast tutorial),
 *   then the hop across (flight-circle tutorial) -> east bank (L / Burning Attack tutorial) -> the depot.
 * - c00_depot: Capsule Corp Depot No. 4, where the fuel cells are stored and Black ambushes Trunks.
 */

/** Flag set by the engine when the rubble on the far flight circle is destroyed. */
export const C00_RUBBLE = 'broke:c00_tunnel:c00_rubble';

/** Tunnel landmarks (tiles). */
export const TUNNEL = {
  arrive: [3.5, 11.6],
  nearPad: [31, 8],
  farPad: [37, 8],
  returnPad: [37, 10],
  depotDoor: [43.5, 7.5],
} as const;

registerMaps([
  {
    id: 'c00_skyline', name: 'West City, Age 796', music: 'sad', region: 'Future Earth',
    tint: 'rgba(80,20,10,0.22)',
    legend: { '#': 'cliff', 'r': 'ruins', 'a': 'asphalt', 'k': 'rock', 'w': 'wasteland', 'd': 'dirt' },
    grid: [
      '########################################',
      '#rrrrrkkrrrrrrrrrrkkrrrrrrrrrrrrkkrrrrr#',
      '#rrrrrrrrrrwwwrrrrrrrrrrwwrrrrrrrrrrrrr#',
      '#rrwwrrrrrrrrrrrrrrkkrrrrrrrrrrrwwrrrrr#',
      '#rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#',
      '#kkrrkkrrrkkrrrrkkrrrrkkrrrrrkkrrrrkkrr#',
      '#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#',
      '#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#',
      '#rrkkrrrrwwrrrrrkkrrrrrwwrrrrrkkrrrkkkr#',
      '#rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkkkkr#',
      '#rrrrrwwrrrrrrrrrrrrrrrrrrrkkrrrrrrrrrr#',
      '########################################',
    ],
    props: [
      ['ruinedBuilding', 2, 0], ['ruinedBuilding', 9, 0], ['building', 15, 0], ['ruinedBuilding', 22, 0], ['ruinedBuilding', 29, 0],
      ['rubble', 6, 4], ['rubble', 20, 4.5], ['crater', 12, 6], ['crater', 26, 6.4], ['campfire', 14, 4], ['campfire', 30, 8.6],
      ['statue', 5, 7.5], ['deadTree', 9, 8], ['deadTree', 24, 8.4], ['rubble', 17, 9.4], ['brokenPillar', 31, 3.5],
      ['boulder', 33, 7.6], ['rubble', 36, 9.2], ['smallRock', 11, 10], ['smallRock', 28, 10],
    ],
  },
  {
    id: 'c00_tunnel', name: 'Collapsed Service Tunnel', music: 'tense', hostile: true, region: 'Future Earth',
    tint: 'rgba(10,10,30,0.30)',
    legend: { '#': 'cliff', 'm': 'metal', 'r': 'ruins', 'k': 'rock', 'a': 'asphalt', '~': 'water', 'D': 'deep' },
    grid: [
      '##############################################',
      '##############################################',
      '###mmmmmm##############rrr######~DD~##########',
      '##mmmmmmmmm#######rrrrrrrrrr####~DD~rrrrrr####',
      '##mmmmmmmmm####rrrrrrkkrrrrrrr##~DD~rrrrrrrr##',
      '##mmmmmmmmm###rrrrrrkkkrrrrrrrr#~DD~rrrrrrrrr#',
      '##mmmmmmmmm##rrrrrrrrkrrrrrrrrrr~DD~rraaaaaaaa',
      '##mmmmmmmmm#rrrrrrrrrrrrrrrrrrrr~DD~rraaaaaaaa',
      '##mmmmmmmmmmrrrrrrrrrrrrrrrrrrrr~DD~rraaaaaaaa',
      '##mmmmmmmmm#rrrrrrrrrrrrrr##rrrr~DD~rrrrrrrrr#',
      '##mmmmmmmmm##rrrrkkrrrrrr####rrr~DD~rrrrrrrrr#',
      '##mmmmmmmmm###rrrkkkrrrrrr##rrrr~DD~rrrrrrrr##',
      '##mmmmmmmmm####rrrrrrrrrrrrrrrrr~DD~rrrrrr####',
      '###mmmmmmm########rrrrr#########~DD~##########',
      '################################~DD~##########',
      '##############################################',
    ],
    props: [
      // Maintenance bay: the stairs up to the hideout, supply crates, a work lamp.
      { kind: 'stairs', x: 3, y: 13 }, { kind: 'stairs', x: 4, y: 13 },
      ['crate', 3, 3], ['crate', 4, 3], ['crate', 3, 4.2], ['barrel', 9, 3], ['barrel', 9.6, 4.2], ['lamp', 7, 2.2],
      ['crate', 9, 11], ['jar', 2.2, 7], ['rug', 5, 8],
      // The caved-in tunnel.
      ['rubble', 14, 5.4], ['brokenPillar', 16, 9], ['smallRock', 13, 11], ['rubble', 19, 12.2], ['smallRock', 18, 3.6],
      ['brokenPillar', 25, 3.2], ['rubble', 27, 4.4], ['smallRock', 23, 11], ['rubble', 29, 12.2], ['lamp', 21, 6.4],
      ['crater', 22, 8.2],
      // The flooded road: dead flight pads (the live circle is drawn on top once it works).
      { kind: 'c00_deadPad', x: TUNNEL.nearPad[0], y: TUNNEL.nearPad[1] }, { kind: 'c00_deadPad', x: TUNNEL.farPad[0], y: TUNNEL.farPad[1] },
      ['brokenPillar', 30, 3.6], ['brokenPillar', 30, 11.2],
      // East bank: the road to the depot.
      ['crate', 40, 3.2], ['barrel', 41.2, 3.6], ['rubble', 40, 11.2], ['lamp', 43, 4.4], ['brokenPillar', 44, 9.6], ['smallRock', 39, 5],
    ],
    enemies: [
      { type: 'c00_rat', x: 15, y: 8 }, { type: 'c00_rat', x: 20, y: 10 },
      { type: 'c00_scavDrone', x: 24, y: 5 }, { type: 'c00_rat', x: 29, y: 11 },
      { type: 'c00_scavDrone', x: 40, y: 4 }, { type: 'c00_rat', x: 42, y: 7 },
      { type: 'c00_scavDrone', x: 42, y: 10 },
    ],
    objects: [
      { type: 'save', x: 7, y: 5 },
      { type: 'sign', x: 6, y: 2, text: 'SERVICE TUNNEL 4-E - Depot No. 4 ahead. (Scratched beneath: "road fell in. fly or swim. DON\'T swim.")' },
      // Melee tutorial: rubble chokes the only way out of the bay.
      { type: 'breakable', x: 11, y: 8, size: 2, id: 'c00_rockA' },
      { type: 'breakable', x: 13, y: 7, size: 1 },
      { type: 'breakable', x: 2, y: 11, size: 1, look: 'jar' },
      { type: 'breakable', x: 17, y: 12, size: 1, look: 'crate' },
      { type: 'breakable', x: 26, y: 6, size: 1 },
      // First fuel cell, in the nook above the cave-in.
      { type: 'chest', x: 24, y: 2, id: 'c00_cell1', item: 'c00_fuelCell', showIf: 'chapter==0' },
      // Ki tutorial: rubble buries the landing circle across the water.
      { type: 'breakable', x: TUNNEL.farPad[0] - 0.6, y: TUNNEL.farPad[1] - 1, size: 3, id: 'c00_rubble' },
      { type: 'sign', x: 29, y: 6, text: 'EMERGENCY FLIGHT CIRCLE - Capsule Corp hop to the east bank. The landing circle must be kept clear.' },
      { type: 'flight', x: TUNNEL.nearPad[0], y: TUNNEL.nearPad[1], to: 'c00_tunnel', tx: TUNNEL.farPad[0], ty: TUNNEL.farPad[1], showIf: C00_RUBBLE, label: 'East bank' },
      { type: 'flight', x: TUNNEL.returnPad[0], y: TUNNEL.returnPad[1], to: 'c00_tunnel', tx: TUNNEL.nearPad[0], ty: TUNNEL.nearPad[1] + 2, label: 'West bank' },
      { type: 'chest', x: 44, y: 5, id: 'c00_eastCache', item: 'cookie', qty: 2 },
      { type: 'breakable', x: 43, y: 11, size: 1, look: 'crate' },
    ],
    warps: [
      { x: 3, y: 13, w: 2, h: 1, to: 'future_hideout_out', tx: HUB.hideoutOut.tunnelArrive[0], ty: HUB.hideoutOut.tunnelArrive[1], dir: 'down', door: true },
      { x: 45, y: 6, w: 1, h: 3, to: 'c00_depot', tx: 2, ty: 7.5, dir: 'right' },
    ],
    triggers: [
      { id: 'c00_hintA', x: 7, y: 7, w: 3, h: 3, script: 'c00_hint_melee', once: true, showIf: 'chapter==0', hideIf: 'broke:c00_tunnel:c00_rockA' },
      { id: 'c00_hintB', x: 26, y: 5, w: 6, h: 7, script: 'c00_hint_ki', once: true, showIf: 'chapter==0', hideIf: C00_RUBBLE },
      { id: 'c00_pad', x: TUNNEL.nearPad[0], y: TUNNEL.nearPad[1], w: 1, h: 1, script: 'c00_pad', onAction: true },
      { id: 'c00_hintL', x: 36, y: 5, w: 3, h: 6, script: 'c00_hint_tech', once: true, showIf: 'chapter==0' },
    ],
    onEnter: 'c00_tunnel_enter',
  },
  {
    id: 'c00_depot', name: 'Capsule Corp Depot No. 4', music: 'tense', hostile: true, region: 'Future Earth',
    tint: 'rgba(10,10,30,0.22)',
    legend: { '#': 'cliff', 'W': 'wall', 'm': 'metal', 't': 'tile' },
    grid: [
      '##############################',
      '#WWWWWWWWWWWWWWWWWWWWWWWWWWWW#',
      '#WWWWWWWWWWWWWWWWWWWWWWWWWWWW#',
      '#mmmmmmmmmmmmmmmmmmmmtttttttt#',
      '#mmmmmmmmmmmmmmmmmmmmtttttttt#',
      '#mmmmmmmmmmmmmmmmmmmmtttttttt#',
      '#mmmmmmmmmmmmmmmmmmmmtttttttt#',
      'mmmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      'mmmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      '#mmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      '#mmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      '#mmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      '#mmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      '#mmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
      '##############################',
      '##############################',
    ],
    props: [
      // Storage aisles.
      ['crate', 6, 3], ['crate', 6, 4], ['crate', 7, 4], ['crate', 6, 5],
      ['crate', 6, 10], ['crate', 7, 10], ['crate', 6, 11], ['crate', 6, 12],
      ['crate', 12, 3], ['crate', 13, 3], ['crate', 12, 4], ['barrel', 13, 5],
      ['crate', 12, 11], ['crate', 12, 12], ['crate', 13, 12], ['barrel', 14, 11],
      ['crate', 18, 4], ['crate', 18, 5], ['barrel', 17, 12], ['crate', 18, 12],
      // Fuel locker bay.
      ['bookshelf', 23, 1.5], ['bookshelf', 25, 1.5], ['counter', 21, 9.6], ['lamp', 28, 2.4], ['pod', 25, 10],
      ['rubble', 9, 7.4], ['smallRock', 16, 9], ['rug', 22, 6],
    ],
    enemies: [
      { type: 'c00_scavDrone', x: 9, y: 4, showIf: 'chapter==0' }, { type: 'c00_rat', x: 10, y: 11, showIf: 'chapter==0' },
      { type: 'c00_rat', x: 16, y: 8, showIf: 'chapter==0' }, { type: 'greenDrone', x: 20, y: 6, showIf: 'chapter==0' },
      { type: 'c00_scavDrone', x: 22, y: 12, showIf: 'chapter==0' },
    ],
    objects: [
      { type: 'save', x: 3, y: 4 },
      { type: 'chest', x: 27, y: 12, id: 'c00_cell2', item: 'c00_fuelCell', showIf: 'chapter==0' },
      { type: 'breakable', x: 9, y: 12, size: 1, look: 'crate' },
      { type: 'breakable', x: 15, y: 4, size: 1, look: 'crate' },
      { type: 'breakable', x: 20, y: 11, size: 1, look: 'jar' },
      { type: 'sign', x: 21, y: 3, text: 'FUEL LOCKER - Capsule Corp authorised staff only. In an emergency: kick it. Hard.' },
    ],
    warps: [{ x: 0, y: 7, w: 1, h: 2, to: 'c00_tunnel', tx: TUNNEL.depotDoor[0], ty: TUNNEL.depotDoor[1], dir: 'left' }],
    triggers: [
      // Stays live until the departure so an interrupted ambush can be restarted (c00_locker resumes it).
      { id: 'c00_locker', x: 23, y: 3, w: 4, h: 2, script: 'c00_locker', onAction: true, showIf: 'chapter==0', hideIf: 'c00_departed' },
      { id: 'c00_depotIn', x: 1, y: 6, w: 3, h: 4, script: 'c00_depot_enter', once: true, showIf: `chapter==0&!${SEALED}` },
    ],
  },
]);
