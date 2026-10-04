import type { NpcDef, PropPlacement } from '../../../game/mapdef';
import { registerMaps } from '../../registry';
import { SEALED } from './util';

/**
 * Chapter 2 maps: Bulma's birthday cruise.
 * - c02_pier: the West City marina where the liner Princess Bulma is moored (chauffeur to downtown, the old fisherman).
 * - c02_deck: the party deck - guests, pool, buffet, bingo stage; Beerus and Whis hold court at the bow.
 * - c02_galley: the ship's kitchen (takoyaki chain).
 * - c02_hold: the cargo hold and prize vault (hostile; Pilaf Gang robots, the chase through the crate maze, a Vegeta
 *   L10 gate on the vault's prize store, the Pilaf Machine).
 */

const PARTY = 'chapter==2';
/** Guests are on deck from boarding until Beerus's rampage scatters them. */
const GUEST = 'chapter==2';
const GONE = 'c02_rage';

const guest = (id: string, sprite: string, x: number, y: number, dir: NpcDef['dir'], name?: string, wander = 0): NpcDef => ({
  id, sprite, x, y, dir, talk: `${id}_talk`, name, wander, showIf: GUEST, hideIf: GONE,
});

/** A crate wall for the cargo hold maze: column x, rows y0..y1. */
function crateCol(x: number, y0: number, y1: number): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (let y = y0; y <= y1; y++) out.push(['crate', x, y]);
  return out;
}

registerMaps([
  {
    id: 'c02_pier', name: 'West City Marina', music: 'town', region: 'West City',
    legend: { 'D': 'deep', '~': 'water', 'o': 'wood', '=': 'path', '.': 'grass', 'a': 'asphalt', '#': 'cliff' },
    grid: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      '~~~~~~~~~~~~~~~~~oo~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~oo~~~~~~~~~~~~~~~~~',
      'oooooooooooooooooooooooooooooooooooo',
      'oooooooooooooooooooooooooooooooooooo',
      'oooooooooooooooooooooooooooooooooooo',
      '====================================',
      '....................................',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
      '####################################',
    ],
    props: [
      ['c02_hull', 6, -0.5],
      ['crate', 1, 6], ['crate', 2, 6], ['crate', 1, 7], ['barrel', 33, 6], ['barrel', 34.2, 6.4], ['crate', 34, 7.6],
      ['lamp', 5, 8.6], ['lamp', 13, 8.6], ['lamp', 23, 8.6], ['lamp', 30, 8.6],
      ['car', 2, 11.2], ['car', 27, 11.6],
      ['tree', 1, 12.6], ['tree', 7, 13], ['tree', 29, 12.8], ['tree', 33, 13.2], ['fountain', 16, 13.4],
      ['flowers', 11, 14], ['flowers', 23, 14.5], ['flowers', 4, 15.2], ['sign', 20, 9.4],
    ],
    npcs: [
      { id: 'c02_driverPier', sprite: 'c02_driver', x: 5, y: 12, dir: 'down', talk: 'c02_driver_pier', name: 'Chauffeur' },
      { id: 'c02_fisher', sprite: 'oldMan', x: 32, y: 8, dir: 'up', talk: 'c02_fisher_talk', name: 'Old Fisherman' },
      { id: 'c02_steward', sprite: 'c02_steward', x: 20, y: 6, dir: 'down', talk: 'c02_steward_talk', name: 'Steward' },
      { id: 'c02_pierMan', sprite: 'townsman', x: 10, y: 10, talk: 'c02_pier_man', name: 'Sightseer', wander: 2 },
      { id: 'c02_pierWoman', sprite: 'townswoman', x: 25, y: 15, talk: 'c02_pier_woman', name: 'Dog Walker', wander: 2 },
    ],
    objects: [
      { type: 'save', x: 9, y: 7 },
      { type: 'worldSign', x: 3, y: 9 },
    ],
    warps: [{ x: 17, y: 4, w: 2, h: 1, to: 'c02_deck', tx: 19.5, ty: 21, dir: 'up', lockedScript: 'c02_gangway_locked', showIf: 'chapter>=2' }],
  },
  {
    id: 'c02_deck', name: 'Princess Bulma - Party Deck', music: 'town', region: 'West City',
    legend: { 'D': 'deep', 'o': 'wood', 'c': 'carpet', 't': 'tile', '~': 'water', 'W': 'wall', 'R': 'roof' },
    grid: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDooooooooooooooooooooooooooooooooooooDD',
      'DoooooooooooooooccccccccoooooooooooooooD',
      'DoooooooooooooooccccccccoooooooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooooooooottttttttttttttttoooooooooooD',
      'Dooooooooooot~~~~~~~~~~~~~~toooooooooooD',
      'Dooooooooooot~~~~~~~~~~~~~~toooooooooooD',
      'Dooooooooooot~~~~~~~~~~~~~~toooooooooooD',
      'Dooooooooooot~~~~~~~~~~~~~~toooooooooooD',
      'Dooooooooooot~~~~~~~~~~~~~~toooooooooooD',
      'DooooooooooottttttttttttttttoooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DooooRRRRRRRRooooooooooooooRRRRRRRRooooD',
      'DooooWWWWWWWWooooooooooooooWWWWWWWWooooD',
      'DooooWWWooWWWooooooooooooooWWWooWWWooooD',
      'DooooooooooooooooooooooooooooooooooooooD',
      'DDDDDDDDDDDDDDDDDDDooDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDooDDDDDDDDDDDDDDDDDDD',
    ],
    props: [
      { kind: 'c02_bingo', x: 18, y: 0 },
      ['plant', 2, 1.2], ['plant', 37, 1.2], ['plant', 2, 15.6], ['plant', 37, 15.6],
      ['lamp', 11, 4.4], ['lamp', 28, 4.4], ['lamp', 11, 12.6], ['lamp', 28, 12.6],
      ['table', 3, 7], ['chair', 2, 8.6], ['table', 3, 11], ['chair', 5, 12.6],
      ['table', 32, 7.2], ['chair', 34, 8.6], ['table', 32, 11.2], ['chair', 31, 12.8],
      ['c02_buffet', 13, 14.4], ['c02_buffet', 22, 14.4],
      ['table', 33, 3.2], ['chair', 35, 3.8],
      ['barrel', 2, 18.6], ['crate', 36, 18.6], ['barrel', 14, 18.8], ['barrel', 25, 18.8],
    ],
    npcs: [
      guest('c02_bulma', 'bulma', 20, 4, 'down', 'Bulma'),
      guest('c02_krillin', 'krillin', 5, 14, 'right', 'Krillin'),
      guest('c02_18', 'android18', 6, 15, 'up', 'Android 18'),
      guest('c02_marron', 'c02_marron', 4, 15, 'right', 'Marron'),
      guest('c02_yamcha', 'yamcha', 29, 16, 'left', 'Yamcha'),
      guest('c02_tien', 'tien', 31, 16, 'left', 'Tien'),
      guest('c02_chiaotzu', 'chiaotzu', 32, 15, 'left', 'Chiaotzu'),
      guest('c02_roshi', 'roshi', 2, 4, 'right', 'Master Roshi'),
      guest('c02_oolong', 'c02_oolong', 3, 5, 'right', 'Oolong'),
      guest('c02_gohan', 'gohan', 24, 17, 'right', 'Gohan'),
      guest('c02_videl', 'videl', 25, 17, 'left', 'Videl'),
      guest('c02_goten', 'goten', 9, 9, 'right', 'Goten', 1),
      guest('c02_trunks', 'trunksKid', 10, 10, 'left', 'Trunks', 1),
      guest('c02_buu', 'majinBuu', 11, 16, 'down', 'Buu'),
      guest('c02_satan', 'mrSatan', 12, 17, 'left', 'Mr. Satan'),
      guest('c02_piccolo', 'piccolo', 37, 3, 'left', 'Piccolo'),
      guest('c02_brief', 'drBrief', 14, 4, 'down', 'Dr. Brief'),
      guest('c02_panchy', 'panchy', 25, 4, 'down', 'Mrs. Briefs'),
      guest('c02_chichi', 'chichi', 7, 16, 'up', 'Chi-Chi'),
      { ...guest('c02_pilaf', 'pilaf', 31, 9, 'down', 'Pilaf'), hideIf: 'c02_heist' },
      { ...guest('c02_mai', 'mai', 33, 9, 'down', 'Mai'), hideIf: 'c02_heist' },
      { ...guest('c02_shu', 'shu', 32, 10, 'up', 'Shu'), hideIf: 'c02_heist' },
      { id: 'c02_beerus', sprite: 'beerus', x: 34, y: 5, dir: 'left', talk: 'c02_beerus_talk', name: 'Beerus', showIf: 'c02_beerusArrived', hideIf: GONE },
      { id: 'c02_whis', sprite: 'whis', x: 36, y: 6, dir: 'left', talk: 'c02_whis_talk', name: 'Whis', showIf: 'c02_beerusArrived', hideIf: GONE },
    ],
    warps: [
      { x: 19, y: 23, w: 2, h: 1, to: 'c02_pier', tx: 17.5, ty: 6, dir: 'down' },
      { x: 8, y: 20, w: 2, h: 1, to: 'c02_galley', tx: 7.5, ty: 8.5, dir: 'up', door: true },
      { x: 30, y: 20, w: 2, h: 1, to: 'c02_hold', tx: 3, ty: 4, dir: 'down', door: true, showIf: 'c02_heist', lockedScript: 'c02_hold_locked' },
    ],
    triggers: [
      { id: 'c02_arrive', x: 14, y: 2, w: 12, h: 3, script: 'c02_beerus_arrive', showIf: `${PARTY}&c02_scouter`, hideIf: 'c02_beerusArrived' },
    ],
    onEnter: 'c02_deck_enter',
  },
  {
    id: 'c02_galley', name: 'Ship\'s Galley', music: 'town', indoor: true, region: 'West City',
    legend: { 'W': 'wall', 't': 'tile' },
    grid: [
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WttttttttttttttW',
      'WWWWWWWttWWWWWWW',
    ],
    props: [
      ['counter', 1, 1.6], ['counter', 10, 1.6], ['table', 6, 5], ['barrel', 13.5, 7.6], ['crate', 1, 8], ['crate', 2, 8], ['jar', 14, 4], ['plant', 1, 4.4],
    ],
    npcs: [
      { id: 'c02_chef', sprite: 'c02_chef', x: 8, y: 3, dir: 'down', talk: 'c02_chef_talk', name: 'Chef', showIf: 'chapter>=2' },
      { id: 'c02_cook', sprite: 'waiter', x: 12, y: 4, dir: 'left', talk: 'c02_cook_talk', name: 'Line Cook', wander: 1, showIf: 'chapter>=2' },
    ],
    warps: [{ x: 7, y: 10, w: 2, h: 1, to: 'c02_deck', tx: 8.5, ty: 21, dir: 'down', door: true }],
  },
  {
    id: 'c02_hold', name: 'Cargo Hold', music: 'tense', hostile: true, region: 'West City', indoor: true,
    tint: 'rgba(10,10,30,0.25)',
    legend: { 'W': 'wall', 'o': 'wood', 'm': 'metal' },
    // Crate maze (x 1-26) -> doorway (27-28, rows 8-9) -> prize vault (x 29-38). The vault's prize store (x 35-38,
    // rows 12-15) sits behind a Vegeta L10 gate.
    grid: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooommmmmmmmmmmW',
      'WooooooooooooooooooooooooooommmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmWWWWWW',
      'WooooooooooooooooooooooooooWWmmmmmWmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmmmmmmW',
      'WooooooooooooooooooooooooooWWmmmmmWmmmmW',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
    props: [
      ['stairs', 2, 2], ['stairs', 3, 2],
      ...crateCol(6, 2, 11), ...crateCol(12, 6, 15), ...crateCol(18, 2, 11), ...crateCol(23, 6, 15),
      ['barrel', 8, 14], ['barrel', 15, 3], ['barrel', 20, 14.2], ['crate', 25, 3], ['crate', 9, 4],
      { kind: 'c02_vault', x: 32, y: 2.4, hideFlag: 'c02_rage' }, ['lamp', 30, 2], ['lamp', 37, 2], ['barrel', 30, 14],
      ['crate', 38, 12.2], ['barrel', 35.2, 15],
    ],
    enemies: [
      { type: 'pilafRobot', x: 9, y: 8, showIf: PARTY, hideIf: 'c02_machineBeaten' },
      { type: 'pilafRobot', x: 15, y: 10, showIf: PARTY, hideIf: 'c02_machineBeaten' },
      { type: 'pilafRobot', x: 21, y: 6, showIf: PARTY, hideIf: 'c02_machineBeaten' },
      { type: 'drone', x: 3, y: 13, showIf: PARTY, hideIf: 'c02_machineBeaten' },
      { type: 'greenDrone', x: 16, y: 4, showIf: PARTY, hideIf: 'c02_machineBeaten' },
      { type: 'drone', x: 25, y: 11, showIf: PARTY, hideIf: 'c02_machineBeaten' },
    ],
    objects: [
      { type: 'save', x: 25, y: 14 },
      { type: 'breakable', x: 3, y: 9, size: 1, look: 'crate' },
      { type: 'breakable', x: 10, y: 13, size: 1, look: 'crate' },
      { type: 'breakable', x: 20, y: 4, size: 1, look: 'crate' },
      { type: 'breakable', x: 26, y: 15, size: 1, look: 'jar' },
      // The prize store behind the gate.
      { type: 'chest', x: 37, y: 14, id: 'c02_holdChest', item: 'str1' },
      { type: 'breakable', x: 36, y: 13, size: 1, look: 'jar', item: 'pow1', id: 'c02_storeJar' },
    ],
    barriers: [{ id: 'c02_g10', x: 34, y: 13, w: 1, h: 2, level: 10, character: 'vegeta' }],
    warps: [{ x: 2, y: 2, w: 2, h: 1, to: 'c02_deck', tx: 30.5, ty: 21, dir: 'down', door: true }],
    triggers: [
      { id: 'c02_chaseB', x: 13, y: 2, w: 5, h: 4, script: 'c02_hold_chase', once: true, showIf: `c02_heist&c02_chaseA&!${SEALED}`, hideIf: 'c02_machineBeaten' },
      { id: 'c02_vault', x: 27, y: 7, w: 3, h: 4, script: 'c02_hold_vault', showIf: `c02_heist&!${SEALED}`, hideIf: 'c02_machineBeaten' },
      { id: 'c02_gateHint', x: 32, y: 12, w: 2, h: 4, script: 'c02_gate_hint', once: true, hideIf: 'gate:c02_hold:c02_g10' },
    ],
    onEnter: 'c02_hold_enter',
  },
]);
