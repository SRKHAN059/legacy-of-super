import { ITEMS, registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerMaps } from '../../registry';
import { registerScripts } from '../../../game/script';
import { GRIDS } from './grids';
import { byChapter, heroTalk, type HeroReactions, type TalkLines } from './talk';

/*
 * WEST CITY (region 'West City', safe): wc_streets ⇄ cc_yard (edge exit, avenue rows 10-16),
 * wc_streets → wc_shops (two doors), cc_yard → cc_inside (Capsule Corp door) → cc_gravity.
 *
 * Coordinates chapters need (tiles):
 *  - wc_streets: world sign (1,18), save (4,18), landing (2,20). Ramen door (8,20), restaurant door (13,20).
 *    Gate to Capsule Corp = east edge rows 10-16. Open plaza for overlays: avenue x 6-40 rows 10-16.
 *  - cc_yard: Capsule Corp prop at (18,2), front door warp (21,7), arrival outside (21,8).
 *    Party lawn x 6-39 rows 15-25: no solid props, only walk-through garden (stone terrace x 18-27 rows 15-16,
 *    round stone patio x 18-27 rows 19-23, walkways, flowerbeds), lawn centre (23,21). Bottom margin rows 25.5-27 holds solid
 *    dressing: fountain x 8-10, parked aircar x 27-29, dinosaur pen x 32-38.4 (baby dino NPC eb_cc_dino inside).
 *    Front plaza x 13-28 rows 8-11.
 *    Hangar pad x 29-42 rows 2-11; free space for a time machine at (31-35, 3-7).
 *  - cc_inside: entrance (9-10,13) → arrival (9,12). Computer room x 1-5 rows 8-12; the computer terminal
 *    (table+monitor) is at (1-2, 8); stand at (2,9) facing up; trigger rect {x:1,y:8,w:2,h:1} runs
 *    eb_cc_terminal: without a scouter it explains the link, with one it opens s.scouterDatabase().
 *    A chapter that wants its own terminal scene sets flag 'eb_terminal_custom' (hides the base trigger) and
 *    overlays its trigger on the same rect. Lab x 1-9 rows 2-6 (stairs to the gravity room at (4,1)), kitchen x 11-18 rows 2-6,
 *    lobby x 7-12 rows 8-12, lounge x 14-18 rows 8-12. Mrs. Briefs (eb_cc_panchy, endless cookies) stands at (18,3) in
 *    the kitchen, hidden in chapter 3 and during c07's lawn recruitment (both have her on cc_yard).
 *  - cc_gravity: chamber x 2-13 rows 2-9, centre (7.5,6); console at (7,4); arrival (7,9).
 */

registerItems([
  {
    id: 'eb_brothCapsule', name: 'Broth Capsule', kind: 'key', max: 1, use: null,
    desc: 'A Hoipoi capsule stamped "RAMEN ICHIBAN - 40L TONKOTSU". Still warm somehow.',
    icon: { shape: 'capsule', color: '#f0a040', color2: '#f8f0d8' },
  },
]);

registerQuests([
  {
    id: 'eb_delivery', title: 'Find the ramen shop\'s lost broth capsule', star: 'bronze', region: 'spot_wasteland',
    desc: 'The chef at Ramen Ichiban says his delivery boy crashed in the Rocky Wasteland and dropped a capsule full of broth near the landing site.',
  },
]);

const CITY = { t: 'tile', a: 'asphalt', m: 'marble', '.': 'grass', ',': 'darkGrass', '=': 'path', '~': 'water', f: 'floor', '#': 'wall' } as const;

/** Mrs. Briefs is home in the kitchen except while a chapter has her out on the cc_yard lawn (c03 party, c07 recruiting). */
const PANCHY_HOME = '!chapter==3';
const PANCHY_ON_LAWN = 'chapter==7&c07_champaDone&!c07_departed';

registerMaps([
  {
    id: 'wc_streets', name: 'West City', music: 'westCity', region: 'West City',
    legend: CITY,
    grid: GRIDS.wc_streets,
    props: [
      // Downtown block: back-street row and avenue row.
      ['building', 1, 0], ['building', 4, 0], ['building', 7, 0], ['building', 10, 0], ['building', 13, 0],
      ['building', 1, 6], ['building', 4, 6], ['building', 7, 6], ['building', 11, 6], ['building', 14, 6],
      // Road closed for construction (north end of the cross street).
      ['fenceH', 19, 1], ['fenceH', 20, 1], ['fenceH', 21, 1], ['crate', 19, 0], ['barrel', 21.1, 0.2],
      // Street lamps along both curbs.
      ['lamp', 3.5, 10], ['lamp', 9.8, 10], ['lamp', 16.5, 10], ['lamp', 24, 10], ['lamp', 29.5, 10], ['lamp', 36.5, 10],
      ['lamp', 7.5, 14], ['lamp', 15.5, 14], ['lamp', 22.5, 14], ['lamp', 28.5, 14], ['lamp', 36, 14],
      // Traffic.
      ['car', 6, 12.2], ['car', 24, 13.1], ['car', 37, 12.2],
      // West City Park.
      ['fountain', 30.5, 3],
      ['tree', 23, 0], ['tree', 25.5, 0.5], ['tree', 23, 7], ['tree', 25.5, 7], ['tree', 36.5, 6.5], ['tree', 39.5, 6], ['tree', 41, 7],
      ['bush', 29.6, 9], ['bush', 33.2, 9], ['bush', 27.6, 9],
      ['lamp', 28, 1], ['lamp', 35, 1],
      ['flowers', 24, 3], ['flowers', 26, 4], ['flowers', 27, 2], ['flowers', 36, 3], ['flowers', 34, 8], ['flowers', 28, 7.5],
      // Gate plaza.
      ['plant', 5.2, 15.2], ['plant', 0.1, 22.4], ['flowers', 3, 22.5], ['flowers', 4.5, 21],
      // Food street: Ramen Ichiban (left) and West Wind Grill (right).
      ['domeHouse', 7, 18], ['domeHouse', 12, 18],
      ['lamp', 9, 22], ['lamp', 16.2, 22], ['lamp', 22.4, 22], ['lamp', 30.2, 22],
      // Police box + electronics store with a TV display.
      ['hut', 19, 18], ['building', 23, 17], ['tv', 27, 20.2], ['tv', 28.6, 20.2],
      // Visitor parking.
      ['car', 32, 17.2], ['car', 38, 17.2], ['car', 35, 21.2],
      // Residential lane.
      ['domeHouse', 1.5, 25], ['domeHouse', 8, 25], ['domeHouse', 12, 25], ['domeHouse', 26, 25], ['domeHouse', 33, 25], ['domeHouse', 37.5, 25],
      ['mailbox', 7.2, 26.4], ['mailbox', 31.9, 26.4],
      // Pocket garden with a wishing well.
      ['well', 20.5, 24.6], ['tree', 17, 24], ['tree', 23.5, 24], ['flowers', 18.5, 27], ['flowers', 22.5, 26.5], ['bush', 24.2, 27.1],
    ],
    npcs: [
      { id: 'eb_wc_tourist', sprite: 'townsman', x: 3, y: 21, talk: 'eb_wc_tourist', name: 'Tourist', wander: 1 },
      { id: 'eb_wc_salaryman', sprite: 'eb_suit', x: 8, y: 10, talk: 'eb_wc_salaryman', name: 'Salaryman', wander: 3 },
      { id: 'eb_wc_worker', sprite: 'eb_worker', x: 20, y: 3, talk: 'eb_wc_worker', name: 'Road Worker', wander: 1 },
      { id: 'eb_wc_kidA', sprite: 'kidNpc', x: 25, y: 5, talk: 'eb_wc_kidA', name: 'Taro', wander: 2 },
      { id: 'eb_wc_kidB', sprite: 'eb_kidGirl', x: 27, y: 7, talk: 'eb_wc_kidB', name: 'Mimi', wander: 2 },
      { id: 'eb_wc_granny', sprite: 'eb_granny', x: 35, y: 6, talk: 'eb_wc_granny', name: 'Granny Ume', wander: 1 },
      { id: 'eb_wc_jogger', sprite: 'townswoman', x: 38, y: 11, talk: 'eb_wc_jogger', name: 'Jogger', wander: 4 },
      { id: 'eb_wc_officer', sprite: 'police', x: 22, y: 22, talk: 'eb_wc_officer', name: 'Officer Hondo' },
      { id: 'eb_wc_clerk', sprite: 'eb_clerk', x: 27, y: 22, talk: 'eb_wc_clerk', name: 'Clerk' },
      { id: 'eb_wc_shopper', sprite: 'townswoman', x: 12, y: 22, talk: 'eb_wc_shopper', name: 'Shopper', wander: 2 },
      { id: 'eb_wc_reporter', sprite: 'reporter', x: 40, y: 11, talk: 'eb_wc_reporter', name: 'Reporter', wander: 1 },
      { id: 'eb_wc_dad', sprite: 'townsman', x: 28, y: 28, talk: 'eb_wc_dad', name: 'Neighbour', wander: 3 },
      { id: 'eb_wc_oldman', sprite: 'oldMan', x: 19, y: 26, talk: 'eb_wc_oldman', name: 'Old Man' },
    ],
    warps: [
      { x: 8, y: 20, w: 1, h: 1, to: 'wc_shops', tx: 5, ty: 10, dir: 'up', door: true },
      { x: 13, y: 20, w: 1, h: 1, to: 'wc_shops', tx: 15, ty: 10, dir: 'up', door: true },
    ],
    exits: { east: { to: 'cc_yard' } },
    pickups: [{ id: 'del_wc_streets_1', item: 'delicacy', x: 42, y: 8 }],
    objects: [
      { type: 'worldSign', x: 1, y: 18 },
      { type: 'save', x: 4, y: 18 },
      { type: 'sign', x: 0, y: 15, text: 'WEST HIGHWAY. Vehicles only beyond this point. North City 340 km. (Flying is faster.)' },
      { type: 'sign', x: 2, y: 22, text: 'WEST CITY - Pop. 2.1 million. Capsule Corporation HQ: follow the avenue east. Park: north-east. Food Street: south.' },
      { type: 'sign', x: 18, y: 2, text: 'ROAD CLOSED. Hover-lane construction. Sorry for the inconvenience! - West City Public Works' },
      { type: 'sign', x: 3, y: 10, text: 'HOTEL WEST. Capsule rooms by the night. Breakfast included, Saiyan appetites extra.' },
      { type: 'sign', x: 9, y: 10, text: 'WEST CITY BANK. Today: Capsule Corp. stock up 4%.' },
      { type: 'sign', x: 13, y: 10, text: 'BOOKWORM BOOKS. New this week: "Hoipoi Capsules for Dummies" by Dr. Brief.' },
      { type: 'sign', x: 10, y: 21, text: 'RAMEN ICHIBAN. Tonkotsu, shoyu, miso... and the 20-bowl Saiyan Challenge.' },
      { type: 'sign', x: 15, y: 21, text: 'WEST WIND GRILL. Tempura, steaks and a dessert menu worth flying in for.' },
      { type: 'sign', x: 22, y: 20, text: 'WEST CITY POLICE - Box No. 8. Lost? Robbed? Alien invasion? Knock any time.' },
      { type: 'sign', x: 26, y: 20, text: 'KAMESEN ELECTRONICS. TVs, phones, capsule houses and the latest radar watches.' },
      { type: 'sign', x: 42, y: 16, text: 'CAPSULE CORPORATION - Main Gate. Visitors welcome during office hours.' },
    ],
  },
  {
    id: 'wc_shops', name: 'Food Street Eateries', music: 'westCity', region: 'West City', indoor: true,
    legend: { '#': 'wall', t: 'tile', w: 'wood', f: 'floor' },
    grid: GRIDS.wc_shops,
    props: [
      // Ramen Ichiban: kitchen (rows 2-4) behind the counter, stools in front.
      ['counter', 1, 1.6], ['barrel', 4.4, 1.8], ['crate', 6, 1.6], ['crate', 7.1, 1.6], ['barrel', 8.4, 2.2],
      ['counter', 1, 5], ['counter', 4, 5], ['barrel', 8, 5], ['plant', 9.05, 5],
      ['chair', 1.4, 6.3], ['chair', 5.2, 6.3],
      ['table', 2, 8.4], ['table', 6, 8.4], ['plant', 9.05, 9.6],
      // West Wind Grill: four tables, a rug at the door.
      ['table', 12, 3], ['chair', 11.2, 3], ['table', 15.5, 3], ['chair', 17.6, 3],
      ['table', 12, 7], ['chair', 11.2, 7], ['table', 15.5, 7], ['chair', 17.6, 7],
      ['plant', 18.1, 9.4], ['rug', 14, 9.5], ['tv', 16.5, 1.3],
    ],
    npcs: [
      { id: 'eb_shop_chef', sprite: 'eb_chef', x: 3, y: 4, talk: 'eb_shop_chef', name: 'Chef Gondo' },
      { id: 'eb_shop_cook', sprite: 'waiter', x: 6, y: 3, talk: 'eb_shop_cook', name: 'Line Cook', wander: 1 },
      { id: 'eb_shop_diner', sprite: 'farmer', x: 4, y: 10, talk: 'eb_shop_diner', name: 'Hungry Trucker' },
      { id: 'eb_shop_waiter', sprite: 'waiter', x: 14, y: 5, talk: 'eb_shop_waiter', name: 'Waiter', wander: 2 },
      { id: 'eb_shop_couple', sprite: 'townswoman', x: 13, y: 9, talk: 'eb_shop_couple', name: 'Regular' },
    ],
    warps: [
      { x: 5, y: 11, w: 1, h: 1, to: 'wc_streets', tx: 8, ty: 21, dir: 'down', door: true },
      { x: 15, y: 11, w: 1, h: 1, to: 'wc_streets', tx: 13, ty: 21, dir: 'down', door: true },
    ],
    objects: [{ type: 'chest', x: 1, y: 3, id: 'del_wc_shops_1', item: 'delicacy' }],
  },
  {
    id: 'cc_yard', name: 'Capsule Corporation', music: 'westCity', region: 'West City',
    legend: { ...CITY, x: 'metal', p: 'arena', d: 'dirt' },
    grid: GRIDS.cc_yard,
    props: [
      ['capsuleCorp', 18, 2], ['domeHouse', 13, 4], ['domeHouse', 26, 4],
      ['tree', 11.6, 0], ['tree', 16, 0], ['tree', 25.2, 0], ['tree', 28, 0],
      // Pool deck.
      ['plant', 1.2, 2], ['plant', 10.6, 2], ['chair', 3.5, 7.3], ['chair', 5.5, 7.3], ['chair', 7.5, 7.3],
      // Front plaza.
      ['lamp', 13, 8], ['lamp', 28, 8], ['plant', 19.6, 7.1], ['plant', 22.5, 7.1],
      ['flowers', 15, 8], ['flowers', 17, 8.2], ['flowers', 24.5, 8.2], ['flowers', 26.5, 8],
      // Hangar pad.
      ['spaceship', 36, 2.2], ['car', 36.5, 8.4], ['car', 39.2, 8.4], ['crate', 30.2, 2.2], ['crate', 31.2, 2.2], ['barrel', 30.4, 3.4],
      // West garden.
      ['tree', 3.5, 14.5], ['bush', 3.4, 19], ['bush', 3.4, 21], ['bush', 3.4, 23], ['bush', 3.4, 25],
      ['flowers', 4, 18], ['flowers', 1, 20], ['flowers', 4.2, 26.6], ['flowers', 1, 24],
      // East garden.
      ['tree', 42, 15], ['tree', 42, 19], ['tree', 42, 23], ['flowers', 40, 17], ['flowers', 40, 25],
      // Lawn corner lamps, edge flower beds (walk-through) and the southern tree line.
      ['lamp', 6.2, 14.6], ['lamp', 38.6, 14.6], ['lamp', 6.2, 25.4], ['lamp', 38.6, 25.4],
      ['flowers', 8, 27], ['flowers', 14, 27], ['flowers', 20, 27], ['flowers', 26, 27], ['flowers', 32, 27], ['flowers', 38, 27],
      ['tree', 1, 29.4], ['tree', 5, 29.4], ['tree', 9, 29.4], ['tree', 13, 29.4], ['tree', 17, 29.4], ['tree', 21, 29.4],
      ['tree', 25, 29.4], ['tree', 29, 29.4], ['tree', 33, 29.4], ['tree', 37, 29.4], ['tree', 41, 29.4],
      // Party lawn garden (rows 15-25 stay walk-through for chapter scenes): flowerbeds on the dark-grass patches,
      // planters at the corners of the round patio.
      ['flowers', 8.2, 15.1], ['flowers', 9.8, 15.6], ['flowers', 11.4, 15.0], ['flowers', 8.9, 16.3], ['flowers', 10.7, 16.4], ['flowers', 12.1, 16.1],
      ['flowers', 33.2, 15.4], ['flowers', 34.8, 15.0], ['flowers', 36.4, 15.5], ['flowers', 33.9, 16.4], ['flowers', 35.6, 16.3], ['flowers', 37.1, 16.2],
      ['flowers', 10.2, 23.2], ['flowers', 11.9, 23.6], ['flowers', 13.5, 23.1], ['flowers', 10.8, 24.5], ['flowers', 12.6, 24.8], ['flowers', 14.1, 24.3], ['flowers', 11.4, 25.4],
      ['flowers', 31.2, 23.3], ['flowers', 32.8, 23.7], ['flowers', 34.5, 23.2], ['flowers', 31.9, 24.4], ['flowers', 33.6, 24.6], ['flowers', 35.1, 24.2],
      ['flowers', 15.2, 18.1], ['flowers', 16.1, 18.9], ['flowers', 32.1, 19.2], ['flowers', 33.1, 20.0],
      ['flowers', 19, 19], ['flowers', 26, 19], ['flowers', 19, 23], ['flowers', 26, 23], ['flowers', 18, 20], ['flowers', 27, 20], ['flowers', 18, 22], ['flowers', 27, 22],
      // Bottom margin (rows 25.5-27, solid props allowed): the garden fountain, Bulma's parked aircar and the dinosaur pen.
      ['fountain', 7.9, 25.3], ['car', 27.2, 26.3],
      ['fenceH', 32, 25], ['fenceH', 33, 25], ['fenceH', 34, 25], ['fenceH', 35, 25], ['fenceH', 36, 25], ['fenceH', 37, 25],
      ['fenceH', 32, 27], ['fenceH', 33, 27], ['fenceH', 34, 27], ['fenceH', 35, 27], ['fenceH', 36, 27], ['fenceH', 37, 27],
      ['fenceV', 32, 25.4], ['fenceV', 32, 26.2], ['fenceV', 32, 26.8], ['fenceV', 38, 25.4], ['fenceV', 38, 26.2], ['fenceV', 38, 26.8],
      ['grassTuft', 33.4, 26.1], ['grassTuft', 36.6, 25.8],
      ['grassTuft', 30.4, 19.3], ['grassTuft', 35.2, 20.1], ['grassTuft', 15.3, 18.4], ['grassTuft', 9.6, 22.6], ['grassTuft', 16.8, 25.6], ['grassTuft', 29.5, 24.9],
    ],
    npcs: [
      { id: 'eb_cc_dino', sprite: 'eb_ccDino', x: 34.5, y: 26, dir: 'left', talk: 'eb_cc_dino', name: 'Baby Dinosaur', wander: 1 },
      { id: 'eb_cc_guard', sprite: 'eb_ccGuard', x: 3, y: 11, dir: 'right', talk: 'eb_cc_guard', name: 'Security Guard' },
      { id: 'eb_cc_gardener', sprite: 'eb_gardener', x: 2, y: 22, talk: 'eb_cc_gardener', name: 'Gardener', wander: 1 },
      { id: 'eb_cc_mechanic', sprite: 'eb_mechanic', x: 34, y: 9, talk: 'eb_cc_mechanic', name: 'Mechanic', wander: 1 },
      { id: 'eb_cc_poolbot', sprite: 'rescueDrone', x: 6, y: 8, talk: 'eb_cc_poolbot', name: 'Pool Robot', wander: 2 },
      { id: 'eb_cc_tech', sprite: 'eb_ccTech', x: 25, y: 10, talk: 'eb_cc_tech', name: 'Technician', wander: 2 },
    ],
    warps: [{ x: 21, y: 7, w: 1, h: 1, to: 'cc_inside', tx: 9, ty: 12, dir: 'up', door: true }],
    exits: { west: { to: 'wc_streets' } },
    triggers: [
      { id: 'eb_cc_annexW', x: 14, y: 6, w: 1, h: 1, script: 'eb_cc_annexW', onAction: true },
      { id: 'eb_cc_annexE', x: 27, y: 6, w: 1, h: 1, script: 'eb_cc_annexE', onAction: true },
    ],
    pickups: [{ id: 'del_cc_yard_1', item: 'delicacy', x: 1, y: 26, hidden: true }],
    objects: [
      { type: 'sign', x: 1, y: 9, text: 'CAPSULE CORPORATION. Visitors please check in at reception. Do not feed the dinosaurs.' },
      { type: 'sign', x: 29, y: 8, text: 'HANGAR 3. Authorized pilots only. Spaceship fuel cells are NOT snacks.' },
      { type: 'sign', x: 30, y: 26, text: 'DINOSAUR PEN. Please do not feed the dinosaurs. Especially not cookies. He gets ideas. - Mrs. Briefs' },
    ],
  },
  {
    id: 'cc_inside', name: 'Capsule Corp. HQ', music: 'westCity', region: 'West City', indoor: true,
    legend: { '#': 'wall', x: 'metal', t: 'tile', c: 'carpet', f: 'floor', w: 'wood' },
    grid: GRIDS.cc_inside,
    props: [
      // Lab.
      ['stairs', 4, 1], ['table', 1, 2.2], ['tv', 1.3, 1.6], ['bookshelf', 7, 1], ['pod', 5, 4.2], ['crate', 8.6, 4.6], ['crate', 8.6, 5.7],
      // Kitchen.
      ['counter', 11, 1.6], ['counter', 14.5, 1.6], ['plant', 18, 1.4], ['table', 13.5, 4], ['chair', 12.7, 4], ['chair', 15.6, 4], ['bookshelf', 17, 4],
      // Computer room: the Scouter database terminal (table + monitor) at (1-2, 8).
      ['table', 1, 8], ['tv', 1.25, 7.45], ['bookshelf', 3.2, 7.8], ['plant', 1, 11.5],
      // Lobby.
      ['counter', 9, 8.4], ['plant', 7.1, 11.6], ['plant', 12.1, 11.6], ['rug', 9, 11],
      // Lounge.
      ['tv', 15.5, 8], ['rug', 14.5, 10], ['chair', 14.6, 11], ['chair', 17.4, 11], ['plant', 18.1, 8],
    ],
    npcs: [
      { id: 'eb_cc_receptionist', sprite: 'eb_ccStaff', x: 10, y: 8, talk: 'eb_cc_receptionist', name: 'Receptionist' },
      { id: 'eb_cc_labtech', sprite: 'scientist', x: 8, y: 4, talk: 'eb_cc_labtech', name: 'Lab Scientist', wander: 1 },
      { id: 'eb_cc_cleanbot', sprite: 'rescueDrone', x: 16, y: 12, talk: 'eb_cc_cleanbot', name: 'Cleaning Robot', wander: 1 },
      // Mrs. Briefs bakes in the kitchen. She steps out while chapters 3 and 7 have her on the party lawn.
      { id: 'eb_cc_panchy', sprite: 'panchy', x: 18, y: 3, dir: 'left', talk: 'eb_cc_panchy', name: 'Mrs. Briefs', showIf: PANCHY_HOME, hideIf: PANCHY_ON_LAWN },
    ],
    warps: [
      { x: 9, y: 13, w: 2, h: 1, to: 'cc_yard', tx: 21, ty: 8, dir: 'down', door: true },
      { x: 4, y: 1, w: 1, h: 1, to: 'cc_gravity', tx: 7, ty: 9, dir: 'up', door: true },
    ],
    triggers: [{ id: 'eb_cc_terminal', x: 1, y: 8, w: 2, h: 1, script: 'eb_cc_terminal', onAction: true, hideIf: 'eb_terminal_custom' }],
    objects: [{ type: 'chest', x: 1, y: 6, id: 'eb_cap_cclab', item: 'end1' }],
  },
  {
    id: 'cc_gravity', name: 'Gravity Room', music: 'training', region: 'West City', indoor: true, hostile: true,
    legend: { '#': 'wall', x: 'metal' },
    grid: GRIDS.cc_gravity,
    props: [['eb_gravityConsole', 7.25, 3.6], ['tv', 4, 1.2], ['tv', 10.5, 1.2]],
    triggers: [{ id: 'eb_cc_gravity', x: 7, y: 4, w: 2, h: 2, script: 'eb_cc_gravity', onAction: true }],
    warps: [{ x: 7, y: 11, w: 2, h: 1, to: 'cc_inside', tx: 4, ty: 2, dir: 'down', door: true }],
    objects: [{ type: 'bag', x: 4, y: 6 }, { type: 'bag', x: 11, y: 6 }],
  },
]);

/** Mrs. Briefs greets each playable character in her own way (LoG2's MRS. BRIEFS lines insert CurCharName). */
const PANCHY_TO_HERO: HeroReactions = {
  goku: 'Goku, dear! I made a triple batch the moment I heard you were coming. Chi-Chi says no more than forty. I didn\'t count.',
  vegeta: 'Vegeta, sweetie, you\'re training too hard again. Have a cookie. No, have two. You need your strength to frown like that!',
  gohan: 'Gohan! Such a scholar now. Brain food! These have walnuts in them. Walnuts look just like little brains, you know.',
  piccolo: 'Mr. Piccolo! I know you only drink water, so I baked you a cookie made mostly of water. ...It fell apart. Take a regular one, just in case!',
  trunks: 'Oh my, Trunks? You\'ve grown so tall! And so handsome. I always knew you would be. Have a cookie, sweetheart. Have the whole plate.',
  satan: 'Mr. Satan! I\'ve seen all your movies! The one where you punch the volcano is my favourite. Do champions eat cookies? Of course they do!',
  android17: 'A park ranger! How wonderful. Do your animals like cookies? Take a few for the deer, dear. Hee hee! Deer, dear.',
  frieza: 'Oh, a new friend of Bulma\'s! What lovely purple... spots. Do take a cookie. Everyone is nicer after a cookie.',
};

/** Mrs. Briefs's kitchen news, by story point. */
const PANCHY_NEWS: Array<[number, string]> = [
  [0, 'Bulma\'s birthday is coming up, so I\'m testing cake recipes. This is batch number forty. The first thirty-nine were delicious too!'],
  [2, 'The birthday cruise is going to be wonderful! I\'ve baked for three hundred guests. Well, two hundred guests and one Goku.'],
  [4, 'That tall gentleman, Mr. Whis, adores my cookies. He asked for the recipe! I told him the secret is love. And butter. Mostly butter.'],
  [5, 'Bulma says someone called Frieza is coming back to Earth. How exciting! I do hope he wipes his feet.'],
  [6, 'I had the strangest feeling this morning, as if the whole house went "poof" and then came right back. Have a cookie, dear. You look pale.'],
  [7, 'A tournament against another universe! I\'ve packed forty bento boxes. Saiyan-sized. Mr. Buu\'s is the biggest, of course.'],
  [8, 'That shy delivery man, Monaka, hasn\'t come out of his truck all day. I left a plate of cookies by the door. Gone in a second! Such an appetite.'],
  [9, 'A handsome young man with lavender hair came out of that yellow time machine. He looks just like little Trunks! I\'ve baked extra, in case there are more of him.'],
  [12, 'Bulma\'s expecting a little girl! I\'ve knitted eleven pairs of booties already. And baked a cookie for every bootie.'],
  [13, 'They say the whole universe might be erased if this tournament goes badly. Well! I\'ve decided not to worry. Worrying makes the dough sad.'],
  [15, 'You won the whole tournament! I baked a cake shaped like the universe. Well, our universe. It has sprinkles.'],
];

registerScripts({
  // ------------------------------------------------------------------ wc_streets
  eb_wc_tourist: async (s) => {
    const n = s.inc('eb_wc_tourist_n');
    if (n === 1) {
      await s.talk([
        ['eb_wc_tourist', 'Excuse me, is this the way to Capsule Corporation? I came all the way from South City to see the dome!', 'happy'],
        ['eb_wc_tourist', 'They say the Briefs family keeps dinosaurs in their backyard. Dinosaurs! In the middle of a city!', 'shock'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_wc_tourist', {
      goku: 'Hey, you look like one of the "trick" fighters from the Cell Games broadcast! The spiky one! Can I get a photo? My cousin in South City will flip.',
      vegeta: [
        ['eb_wc_tourist', 'Excuse me, sir, could you take a picture of me in front of the-', 'happy'],
        ['hero', 'No.', 'angry'],
        ['eb_wc_tourist', '...Right. I\'ll ask the pigeons.', 'sad'],
      ],
      gohan: 'Are you a professor? You have a very professor-ish face. Is the university this way, or is that Capsule Corp too?',
      piccolo: 'A g-green man in a cape! Is that a Capsule Corp mascot suit? Can I get a- no? No photos. Got it. Sorry, sir.',
      trunks: 'Ooh, a real sword! Is there a cosplay convention in town? You look just like the Capsule Corp president\'s son. Only, you know, all grown up.',
      satan: 'MR. SATAN?! In WEST CITY?! I came all this way to see a dome and I get THE CHAMPION! Sign my hat! Sign my map! Sign my face!',
    }, 'happy')) return;
    await s.say('eb_wc_tourist', byChapter(s, [
      [0, 'The map board says the avenue runs straight east to the Capsule Corp gate. Wish me luck getting an autograph.'],
      [5, 'I was supposed to fly home last week, but the news said an alien army landed in the Rocky Wasteland. I\'m staying put!'],
      [9, 'Did you see that weird yellow machine with a "HOPE!!" sticker parked at Capsule Corp? Is it a new car model?'],
    ]));
  },
  eb_wc_salaryman: async (s) => {
    await s.talk(byChapter<TalkLines>(s, [
      [0, [
        ['eb_wc_salaryman', 'Late, late, late! My boss wants the quarterly capsule-sales report by noon.', 'shock'],
        ['eb_wc_salaryman', 'Everyone in West City carries at least three Hoipoi capsules. House, car, emergency rice cooker. Business is booming.'],
      ]],
      [4, [
        ['eb_wc_salaryman', 'Some guy in a blue robe ate twelve bowls at Ramen Ichiban yesterday and called each one "magnificent".'],
        ['eb_wc_salaryman', 'He paid with a Capsule Corp card. I\'m not asking questions.', 'smirk'],
      ]],
      [7, [
        ['eb_wc_salaryman', 'Capsule Corp stock jumped again. Rumour says Bulma is building a radar that finds things on OTHER PLANETS.'],
      ]],
    ]));
  },
  eb_wc_worker: async (s) => {
    const lines = byChapter(s, [
      [0, 'Hover-lane construction. Six months behind schedule because somebody keeps flying through the scaffolding at top speed.'],
      [5, 'Six months behind schedule, and now an army shows up. My foreman says "aliens are not an excuse". Tell that to the aliens.'],
      [12, 'Good news: the hover lane is almost done! Bad news: three of my crew quit to try out for some tournament of martial arts.'],
    ]);
    await s.say('eb_wc_worker', lines);
    if (!s.flag('eb_wc_worker_tip')) {
      s.set('eb_wc_worker_tip');
      await s.say('eb_wc_worker', 'Tip from a working man: crates and rocks out in the wilds sometimes hide food or capsules. Smash first, ask later.', 'smirk');
    }
  },
  eb_wc_kidA: async (s) => {
    if (await heroTalk(s, 'eb_wc_kidA', {
      goku: [
        ['eb_wc_kidA', 'Mister, you look super strong! Can you do a Kamehameha? A REAL one?', 'happy'],
        ['hero', 'Sure! Just a little one, though. Ka... me... ha... me... HA!', 'smirk'],
        ['eb_wc_kidA', 'WHOAAAA! MIMI! MIMI, IT\'S REAL! I TOLD YOU IT WAS REAL!', 'shock'],
      ],
      vegeta: 'Mister, how does your hair stand up like that? Is it from frowning? My mom says if I frown too much my face will stay that way.',
      gohan: [
        ['eb_wc_kidA', 'Hey! You stand EXACTLY like the Great Saiyaman! Are you him? You are, aren\'t you?!', 'shock'],
        ['hero', 'Ha... haha... Me? No, no. I\'m just a researcher.', 'happy'],
        ['eb_wc_kidA', 'That\'s EXACTLY what the Great Saiyaman would say!', 'happy'],
      ],
      piccolo: 'Are you a real Namekian? Can you really grow your arm back? Do it! Do it! ...Please?',
      trunks: 'Your sword is SO COOL. Can I hold it? I\'ll give it back. Probably. Maybe.',
      satan: [
        ['eb_wc_kidA', 'Mr. Satan! My dad says the Kamehameha at the Cell Games was a light trick. You\'d know, right? Was it a trick?', 'happy'],
        ['hero', 'Ah- ha- HAHAHA! Of course it was a trick, kid! A cheap trick! Totally not real! ...Right?', 'shock'],
        ['eb_wc_kidA', 'Then how come you looked so scared on TV?'],
      ],
    })) return;
    const n = s.inc('eb_wc_kidA_n');
    if (s.check('chapter>=5') && n % 2 === 0) {
      await s.talk([
        ['eb_wc_kidA', 'My dad says a guy in a green cape and a kid in a purple gi held off a thousand soldiers by themselves!', 'shock'],
        ['eb_wc_kidA', 'When I grow up I\'m gonna be a cape guy. Capes are SO cool.', 'happy'],
      ]);
      return;
    }
    await s.talk([
      ['eb_wc_kidA', 'Hi-yaaa! I\'m practicing the Kamehameha! Mimi says it\'s fake but my uncle saw it on the Cell Games!', 'shout'],
      ['eb_wc_kidA', 'Nothing comes out yet. Maybe you need to eat more vegetables first?'],
    ]);
  },
  eb_wc_kidB: async (s) => {
    await s.say('eb_wc_kidB', byChapter(s, [
      [0, 'Taro keeps yelling "Kamehameha" at the fountain. The pigeons are getting annoyed.'],
      [2, 'My big sister went to Bulma\'s birthday party! She says a grumpy purple cat-man got mad because someone ate his pudding.'],
      [7, 'Our teacher says there are twelve universes. TWELVE! I can\'t even remember all my times tables.'],
      [13, 'Did you know there\'s a ranger on Monster Island who protects animals? He\'s super strong AND he likes animals. He\'s my hero now.'],
    ]), 'happy');
  },
  eb_wc_granny: async (s) => {
    const n = s.inc('eb_wc_granny_n');
    if (n === 1) {
      await s.talk([
        ['eb_wc_granny', 'Oh, hello, dear. I come here every morning to feed the pigeons by the fountain.', 'happy'],
        ['eb_wc_granny', 'This park has seen everything. Cell, Buu, that Saiyan fellow in armor... It\'s still standing, and so am I.'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_wc_granny', {
      goku: 'My, you remind me of a little boy who came through here forty-odd years ago. Had a tail. Ate all my pigeon bread. Very polite, though.',
      vegeta: 'You ought to smile more, dear. Here, feed the pigeons with me. ...Oh. They\'ve all flown off. They\'re very sensitive birds.',
      piccolo: 'A green gentleman! Are you one of those Namekians from the news? Such lovely posture. My late husband slouched terribly.',
      satan: 'Oh, the Champion. My grandson has your poster. I have the Cell Games on tape, you know. I watch the part where you fall off the stage every Sunday.',
    }, 'happy')) return;
    await s.say('eb_wc_granny', byChapter(s, [
      [0, 'Young people are always flying somewhere in a hurry. Sit down once in a while. Smell the flowers.'],
      [5, 'Everyone ran for the shelters when the soldiers came. I stayed with my pigeons. They were very brave.'],
      [6, 'Strangest thing: last week I dreamed the whole sky went white and the planet simply... popped. Then I woke up on this bench.'],
    ]));
  },
  eb_wc_jogger: async (s) => {
    await s.say('eb_wc_jogger', byChapter(s, [
      [0, 'Ten laps of the avenue every morning! If Capsule Corp ever builds a gravity treadmill, I\'m first in line.'],
      [5, 'I ran past the Capsule Corp gate yesterday and saw a tiny alien in a purple suit arguing with Bulma about parking.'],
      [9, 'There was a flash of light over Capsule Corp at dawn. My fitness watch says my heart rate hit 180. Just from the shock!'],
    ]));
  },
  eb_wc_officer: async (s) => {
    const n = s.inc('eb_wc_officer_n');
    if (n === 1) {
      await s.talk([
        ['eb_wc_officer', 'Officer Hondo, West City Police, Box No. 8. Everything\'s under control here.'],
        ['eb_wc_officer', 'Mostly parking tickets. And the occasional giant monster. And the occasional parking ticket FOR a giant monster.', 'smirk'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_wc_officer', {
      goku: 'Hm. Spiky hair, orange gi... We had a wanted poster that looked like you once. No, wait. That one had a monkey tail. Carry on.',
      vegeta: 'Sir, this is a no-fly zone... Sir? ...Have a pleasant day, sir. Please don\'t blow up the police box.',
      gohan: 'You know, you sound a lot like the Great Saiyaman. Same voice. Different... helmet. Eh, can\'t be. He\'s much cooler.',
      piccolo: [
        ['eb_wc_officer', 'Hold on. Turban, cape... You\'re the fella who took the West City driving test with that Goku guy!'],
        ['hero', '...We do not speak of the driving test.', 'angry'],
        ['eb_wc_officer', 'Fair enough. The instructor doesn\'t either. Mostly he just stares at walls.', 'smirk'],
      ],
      trunks: 'Is that sword licensed, son? ...From the future, you say. I\'ll write "future" on the form. Move along.',
      satan: 'Mr. Satan. Our precinct softball team would love to have you. As the mascot. The guys say you\'d only fall over in the outfield.',
    })) return;
    await s.say('eb_wc_officer', byChapter(s, [
      [0, 'Heading into the wilds? The Rocky Wasteland is west, Diablo Desert is way down south. Both crawling with wild beasts and bandits.'],
      [3, 'We got a report of a flying robot with a little blue man in it buzzing around the desert. Probably that Pilaf character again.'],
      [5, 'Our whole precinct got deployed to the shelters during the invasion. A colleague in Satan City swears a short bald cop fought the aliens bare-handed.'],
      [13, 'Satan City\'s police force has an officer who used to be a world-class martial artist. We\'re trying to recruit him for our softball team.'],
    ]));
  },
  eb_wc_clerk: async (s) => {
    const n = s.inc('eb_wc_clerk_n');
    if (n === 1) {
      await s.talk([
        ['eb_wc_clerk', 'Welcome to Kamesen Electronics! Today only: the new Capsule Corp phone, now with a 40-hour battery!', 'happy'],
        ['eb_wc_clerk', 'Psst. The rumour is Bulma designed it in a single afternoon while yelling at someone. That\'s genius for you.'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_wc_clerk', {
      vegeta: 'Ah! The "Hmph" customer! The scouter-style headsets are back in stock, sir. Exact change, as always?',
      gohan: 'Something for the scholar? This new e-reader holds ten thousand books. Or ten thousand photos of beetles. Your call.',
      trunks: 'Can I interest you in a phone that gets signal in... the future? Ha! Just kidding. Unless... do you need one?',
      satan: 'Mr. Satan! Remember the "Champion Edition" radio that plays your victory speech when you switch it on? Nobody bought it. Want one? Free?',
    }, 'happy')) return;
    await s.say('eb_wc_clerk', byChapter(s, [
      [0, 'Everything on the TV wall is a Capsule Corp model. Competing with them in West City is like competing with the sun.'],
      [2, 'Somebody bought every scouter-style headset we had. He just said "Hmph" and paid in exact change.'],
      [5, 'We sold out of emergency capsule shelters in one hour when the alien ships showed up. Best and worst day of my career.'],
      [9, 'A young guy with a sword asked if we sell "time machine fuel". I told him to try Capsule Corp. He looked very sad.'],
    ]));
  },
  eb_wc_shopper: async (s) => {
    await s.say('eb_wc_shopper', byChapter(s, [
      [0, 'The West Wind Grill does a tempura platter that\'s to die for. Ramen Ichiban across the way is better for a quick lunch though.'],
      [4, 'Ramen Ichiban put up a photo of a pale man with white hair and a staff on their "Champion Eaters" wall. He beat the 20-bowl challenge. Twice.'],
      [7, 'I heard Capsule Corp is throwing a huge party again. They always have the BEST bingo prizes.'],
    ]));
  },
  eb_wc_reporter: async (s) => {
    const n = s.inc('eb_wc_reporter_n');
    if (n === 1) {
      await s.talk([
        ['eb_wc_reporter', 'Shh! I\'m staking out Capsule Corp. Every big story in the last twenty years started at that dome.', 'smirk'],
        ['eb_wc_reporter', 'Spaceships, androids, a kid with purple hair flying out of a window... I just need ONE photo.'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_wc_reporter', {
      goku: 'Hey! You look like that golden-haired fighter from the Cell Games footage, minus the gold. Brother? Cousin? No comment? Okay!',
      vegeta: [
        ['eb_wc_reporter', 'Prince Vegeta! One quote for the West City Times? Anything at all!', 'shock'],
        ['hero', 'Hmph.', 'angry'],
        ['eb_wc_reporter', 'PERFECT. Tomorrow\'s front page: "PRINCE SAYS HMPH." My editor is going to cry.', 'happy'],
      ],
      gohan: 'Wait. You look like the little blond boy from the Cell Games, all grown up... But that\'s crazy. Mr. Satan won the Cell Games. Right? ...Right?',
      piccolo: 'Sir, is it true you entered the 23rd World Tournament as "Junior"? I\'ll take that glare as a yes!',
      trunks: 'You! I\'ve got a blurry photo of a purple-haired kid flying out of a Capsule Corp window... Are you his big brother?',
      satan: [
        ['eb_wc_reporter', 'Champ! Any comment on the rumour that a little blond kid really beat Cell?', 'smirk'],
        ['hero', 'N-no comment! The Champion has a... a training appointment! Bye!', 'shock'],
        ['eb_wc_reporter', 'He\'s running! The Champion is running away! Somebody get the camera!', 'happy'],
      ],
    })) return;
    await s.say('eb_wc_reporter', byChapter(s, [
      [0, 'My editor says no more "mystery golden-haired fighter" stories. Nobody believes them anymore.'],
      [5, 'I got a photo of the invasion! It\'s... mostly smoke. And a thumb. My thumb.'],
      [9, 'Something just landed in the Capsule Corp yard. Pod? Car? Washing machine? I need a bigger zoom lens!'],
    ]));
  },
  eb_wc_dad: async (s) => {
    await s.say('eb_wc_dad', byChapter(s, [
      [0, 'Living two blocks from Capsule Corp is great. The power never goes out, and the explosions are almost always on purpose.'],
      [5, 'During the invasion my whole family hid in our house capsule. Turns out a capsule house is very cozy for four people and a dog.'],
      [8, 'My kids keep asking for a "Super Dragon Ball". I told them Santa doesn\'t deliver to other universes.'],
    ]));
  },
  eb_wc_oldman: async (s) => {
    if (await heroTalk(s, 'eb_wc_oldman', {
      goku: 'Hm? I saw you fight at the World Tournament when you were knee-high to a grasshopper. You\'ve grown. I\'ve shrunk. Seems fair.',
      satan: 'Hmph. I watched the Cell Games too, young man. Champion or not, it was the little boy who did all the real shouting.',
    })) return;
    const n = s.inc('eb_wc_oldman_n');
    await s.say('eb_wc_oldman', n % 2 === 1
      ? 'I remember when the Red Ribbon Army marched through here. Then the Saiyans. Then Cell. This city is tougher than it looks, young one.'
      : 'Toss a coin in the well and make a wish. Won\'t come true, mind you. For real wishes you need seven special balls and a big green dragon.');
  },

  // ------------------------------------------------------------------ wc_shops
  eb_shop_chef: async (s) => {
    if (s.check('done:eb_delivery')) {
      const c = await s.ask('eb_shop_chef', 'My hero! One bowl of tonkotsu on the house, as promised?', ['Yes, please!', 'Maybe later']);
      if (c === 0) {
        s.heal();
        await s.say('eb_shop_chef', 'Slurp it while it\'s hot! ...There, you look ten years younger already.', 'happy');
      } else await s.say('eb_shop_chef', 'The offer stands forever. Ramen Ichiban never forgets a friend.');
      return;
    }
    if (s.check('quest:eb_delivery')) {
      if (s.has('eb_brothCapsule')) {
        await s.talk([
          ['eb_shop_chef', 'My broth capsule! Still sealed! Forty liters of twelve-hour tonkotsu, saved!', 'happy'],
          ['eb_shop_chef', 'Take this. A customer left it as a tip once. Says it makes you stronger. Me, I just make soup.'],
        ]);
        s.take('eb_brothCapsule');
        await s.done('eb_delivery', false);
        await s.give('pow3');
        return;
      }
      await s.say('eb_shop_chef', 'The capsule should be near where you land in the Rocky Wasteland. Look for scooter tracks. And watch out for wolves!');
      return;
    }
    await s.talk(byChapter<TalkLines>(s, [
      [0, [
        ['eb_shop_chef', 'Welcome to Ramen Ichiban! Ugh, sorry. Bad day. My delivery boy crashed his scooter in the Rocky Wasteland.', 'sad'],
        ['eb_shop_chef', 'He\'s fine, but he dropped my broth capsule out there. No broth, no ramen. No ramen, no Ramen Ichiban.'],
        ['eb_shop_chef', 'You look like you can handle a few wolves. If you find it, I\'ll make it worth your while!'],
      ]],
      [4, [
        ['eb_shop_chef', 'A gentleman with a halo-ring around his neck ate twenty bowls and asked for the recipe. I said no. He just smiled. I said yes.', 'shock'],
        ['eb_shop_chef', 'Anyway. My delivery boy dropped my broth capsule in the Rocky Wasteland. Can you find it?'],
      ]],
    ]));
    await s.quest('eb_delivery');
  },
  eb_shop_cook: async (s) => {
    await s.say('eb_shop_cook', byChapter(s, [
      [0, 'Twelve hours to make a proper tonkotsu broth. Twelve! And a Saiyan drinks it in twelve seconds.'],
      [4, 'Chef hid his secret dessert in the cold chest by the stove. Says it\'s for "a very special customer". Don\'t tell him I told you.', ],
    ]));
  },
  eb_shop_diner: async (s) => {
    await s.say('eb_shop_diner', byChapter(s, [
      [0, 'I drive capsule trucks across Diablo Desert. Best ramen between here and the end of the world, this place.'],
      [3, 'Saw a big castle out in Diablo Desert on my last run. Three idiots on the roof waving a flag. Didn\'t stop to ask.'],
      [5, 'I nearly drove into a crater the size of a stadium out by the Rocky Wasteland mesas. Wasn\'t there last month!', ],
    ]), 'happy');
  },
  eb_shop_waiter: async (s) => {
    const n = s.inc('eb_shop_waiter_n');
    if (n === 1) {
      await s.say('eb_shop_waiter', 'Welcome to the West Wind Grill. Table for one? I\'m afraid the dinosaur steak is sold out. It\'s always sold out.');
      return;
    }
    if (await heroTalk(s, 'eb_shop_waiter', {
      goku: 'Ah... sir. Management asks me to inform you that the all-you-can-eat buffet has been discontinued. For you. Specifically.',
      vegeta: 'The gentleman who sent back the steak as "unworthy of a prince". Your usual table, sir. The chef is hiding in the walk-in fridge.',
      piccolo: 'A glass of water for the gentleman? Just water. Yes, sir. ...Would you like it in a bigger glass? No? Very good, sir.',
      satan: 'Mr. Satan! Your usual table by the window, where the photographers can see you. ...None came today. Shall I telephone them?',
    })) return;
    await s.say('eb_shop_waiter', byChapter(s, [
      [0, 'Our tempura is made with oil imported from the Southern Continent. The chef calls it "liquid gold".'],
      [4, 'A tall gentleman with white hair complimented our tempura so sincerely that the chef cried. Then he asked for nine more plates.'],
      [8, 'Capsule Corp ordered catering for two hundred guests. Two hundred! Half of them apparently eat like fifty people each.'],
    ]));
  },
  eb_shop_couple: async (s) => {
    await s.say('eb_shop_couple', byChapter(s, [
      [0, 'We have our anniversary dinner here every year. He always orders the same thing. I always steal half of it.'],
      [6, 'Last month, for a second, everything went dark and quiet. Then the soup was hot again. My husband says I need a vacation.'],
    ]));
  },

  // ------------------------------------------------------------------ cc_yard
  eb_cc_guard: async (s) => {
    const n = s.inc('eb_cc_guard_n');
    if (n === 1) {
      await s.talk([
        ['eb_cc_guard', 'Capsule Corporation grounds. Reception is through the main door of the dome, straight ahead.'],
        ['eb_cc_guard', 'And please don\'t fly over the fence. The anti-aircraft lasers are set to "stun", but Dr. Brief keeps forgetting to check.', 'smirk'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_cc_guard', {
      goku: 'Goku! Bulma\'s orders: you are not allowed in the kitchen unsupervised. Her exact words were "not even a little bit".',
      vegeta: [
        ['eb_cc_guard', 'Welcome home, Prince Vegeta, sir! The gravity room is warmed up, sir! No, I did not touch the settings, sir!', 'shock'],
        ['hero', 'Hmph. At ease.', 'smirk'],
      ],
      gohan: 'Gohan! Long time no see. Bulma says the library wing is yours whenever you need some quiet for your research.',
      piccolo: 'Mr. Piccolo, sir. I\'d ask you not to fly over the fence, but the lasers already tried to stop you once. The lasers lost.',
      trunks: 'Master Trunks? You\'ve grown about two feet since breakfast. ...Capsule Corp. Never a dull day. Go on in, sir.',
      satan: 'Mr. Satan. Do you have an appointment? Bulma said, and I quote: "If he\'s here about sponsorship money again, I\'m not home."',
    })) return;
    await s.say('eb_cc_guard', byChapter(s, [
      [0, 'The gravity room\'s been running at 300 G since dawn. You can feel the floor hum from here.'],
      [5, 'Some alien called Jaco crash-landed his ship in the parking lot and asked me for directions to "the Earth girl Bulma". I let him in. Was that wrong?'],
      [9, 'If anyone asks: no, there is no time machine in the yard. That\'s a... decorative sculpture.'],
    ]));
  },
  eb_cc_gardener: async (s) => {
    await s.say('eb_cc_gardener', byChapter(s, [
      [0, 'The trick with a Capsule Corp garden is hardy plants. Between the dinosaurs, the sparring and the party fireworks, nothing delicate survives.'],
      [2, 'The party lawn took a beating after the birthday bash. Scorch marks shaped like a cat. A CAT.', ],
      [7, 'I planted a whole row of tulips and somebody landed a spaceship on them. Again.', ],
    ]));
    if (!s.flag('eb_cc_gardener_hint')) {
      s.set('eb_cc_gardener_hint');
      await s.say('eb_cc_gardener', 'Oh, and if you\'re poking around the west hedge: some guest left a lunch box down there at the last party. Smells expensive.');
    }
  },
  eb_cc_mechanic: async (s) => {
    if (await heroTalk(s, 'eb_cc_mechanic', {
      vegeta: 'Prince Vegeta. The ship\'s fuelled whenever you want to go punch something on another planet. Please bring it back with fewer dents.',
      trunks: 'That yellow time machine of yours... Capsule tech, but twenty years ahead of anything we\'ve got. Whoever built it is a genius. ...Oh. OH.',
      satan: 'Mr. Satan! Your Champion Jet is in for repairs again? What did you... You flew it into your own statue. Right. Okay.',
    })) return;
    await s.say('eb_cc_mechanic', byChapter(s, [
      [0, 'This ship? Dr. Brief\'s design. It flew to Namek once. Well, its grandfather did. This one mostly flies to the beach.'],
      [7, 'We\'re retrofitting the hangar for "interuniversal travel". I don\'t know what that means but the paycheck is great.'],
      [9, 'Whoever parked that time machine left no fuel in it. None. I\'m a mechanic, not a miracle worker.'],
    ]));
  },
  eb_cc_poolbot: async (s) => {
    if (await heroTalk(s, 'eb_cc_poolbot', {
      goku: 'BZZT. SON GOKU DETECTED. KITCHEN LOCKDOWN: ENGAGED. KITCHEN LOCKDOWN: ENGAGED. KITCHEN LOCKDOWN: ENGAGED.',
      vegeta: 'BZZT. PRINCE VEGETA DETECTED. THIS UNIT IS NOT A SPARRING PARTNER. REPEAT: THIS UNIT IS NOT A SPARRING PARTNER.',
      gohan: 'BZZT. HALF-SAIYAN DETECTED. INITIATING HALF OF THE KITCHEN LOCKDOWN.',
      piccolo: 'BZZT. NAMEKIAN DETECTED. DIET: WATER ONLY. THIS UNIT APPROVES. THIS UNIT WILL TELL THE POOL.',
      trunks: 'BZZT. TWO "TRUNKS" DETECTED ON THE PREMISES. ERROR. ERROR. REBOOTING... HELLO, TALLER TRUNKS.',
      satan: 'BZZT. FACE MATCH: MR. SATAN. THREAT LEVEL: ZERO. AUTOGRAPH VALUE: HIGH. THIS UNIT HAS NO PEN.',
    })) return;
    const n = s.inc('eb_cc_poolbot_n');
    await s.say('eb_cc_poolbot', [
      'BZZT. POOL CHLORINE: OPTIMAL. WATER TEMPERATURE: 28 DEGREES. SWIMMING PERMITTED.',
      'BZZT. WARNING: DO NOT PERFORM KI BLASTS IN THE POOL. LAST INCIDENT: 3 DAYS AGO. SUSPECT: SMALL, PURPLE HAIR.',
      'BZZT. HELLO, GUEST. HAVE A NICE DAY. THIS UNIT LIKES YOU. THIS UNIT IS NOT PROGRAMMED TO LIKE.',
    ][(n - 1) % 3]);
  },
  eb_cc_tech: async (s) => {
    if (await heroTalk(s, 'eb_cc_tech', {
      gohan: 'Gohan! Settle a bet for us? Lab says Saiyan genes skip a generation. Accounting says "please stop asking us about Saiyans".',
      trunks: 'Are you the one from the time machine? Could I scan your sword? For science. Very polite, very respectful science.',
    })) return;
    await s.say('eb_cc_tech', byChapter(s, [
      [0, 'I work in capsule compression. Fitting a house into something the size of a vitamin is easy. Fitting Bulma\'s shoe collection is not.'],
      [2, 'Bulma wants a scouter that doesn\'t explode when it reads a Saiyan. We\'ve gone through eleven prototypes this week.'],
      [7, 'My department is building a Dragon Radar that works on a PLANETARY scale. My department is also very, very tired.'],
      [9, 'We\'re running an all-nighter on time-machine fuel synthesis. Everyone is on their fourth coffee.'],
    ]));
  },
  eb_cc_annexW: async (s) => {
    await s.narrate('A sign on the door: "RESEARCH WING - Staff only. Experiments in progress. If you hear a scream, it is probably fine."');
  },
  eb_cc_annexE: async (s) => {
    await s.narrate('The hangar office is locked. Through the window you can see a desk buried under blueprints and empty pizza boxes.');
  },

  // ------------------------------------------------------------------ cc_inside
  eb_cc_receptionist: async (s) => {
    const n = s.inc('eb_cc_receptionist_n');
    if (n === 1) {
      await s.talk([
        ['eb_cc_receptionist', 'Welcome to Capsule Corporation! Do you have an appointment?', 'happy'],
        ['eb_cc_receptionist', '...You\'re a friend of the family? Of course you are. Everyone who glows a little is a friend of the family.', 'smirk'],
        ['eb_cc_receptionist', 'The lab is up and to the left, the kitchen up and to the right. The gravity room is up the stairs in the lab. Enter at your own risk.'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_cc_receptionist', {
      goku: 'Mr. Son! Bulma left a note for you: "DON\'T EAT THE CAKE." ...Oh. You already did. I\'ll update the note.',
      vegeta: 'Prince Vegeta. Your three o\'clock is the gravity room. So are your four and five o\'clock. Shall I keep the schedule as it is?',
      gohan: 'Gohan! Dr. Brief asked me to remind you that his offer stands: a lab of your own, any time you want it.',
      piccolo: 'Mr. Piccolo! You usually wait on the roof. You came in through the front door this time! Bulma owes me a coffee.',
      trunks: 'Welcome back, Trunks- oh! The OTHER Trunks. Bulma told us not to ask questions. I am not asking. I am smiling.',
      satan: 'The World Champion! Yes, Capsule Corp still sponsors your tournaments. No, we will not be sponsoring "Champion Jet 2".',
    }, 'happy')) return;
    await s.say('eb_cc_receptionist', byChapter(s, [
      [0, 'Bulma\'s computer room is through the door on the left. Please don\'t touch the big monitor; it\'s full of very expensive secrets.'],
      [2, 'A visitor in a purple robe and his tall friend in blue came by asking for "the most delicious food on Earth". I sent them to the kitchen.'],
      [5, 'The phones haven\'t stopped ringing since the invasion. Everyone wants to know if Capsule Corp is behind the "fighting space aliens". Well...'],
      [9, 'Please excuse the noise from the yard. We are definitely not building a time machine. Definitely.'],
    ]));
  },
  eb_cc_labtech: async (s) => {
    if (await heroTalk(s, 'eb_cc_labtech', {
      vegeta: 'Prince Vegeta, sir. The gravity machine upstairs is rated for 300 G. Please, PLEASE do not "improve" it again.',
      piccolo: 'Mr. Piccolo! For our records: could we measure your antennae? It\'s for the Namekian section of the field database. Purely scientific.',
      trunks: 'The fuel cells in your time machine are twenty years ahead of our designs. Could I take one tiny look? Purely professional curiosity.',
    })) return;
    await s.say('eb_cc_labtech', byChapter(s, [
      [0, 'That round pod is a Saiyan space pod. We use it to test landing systems. The dent in the floor is from Tuesday.'],
      [2, 'The gravity machine upstairs has been rebuilt nine times this year. Prince Vegeta keeps "improving" it with his fists.'],
      [7, 'Dr. Brief says the radar for the Super Dragon Balls will need a map of an entire universe. We bought a very large printer.'],
      [11, 'We\'re studying the energy signature from the last time-machine jump. It shouldn\'t exist. That\'s what makes it fun.'],
    ]));
  },
  eb_cc_cleanbot: async (s) => {
    if (await heroTalk(s, 'eb_cc_cleanbot', {
      goku: 'BEEP. SAIYAN DETECTED. PRE-EMPTIVELY CLEANING THE KITCHEN. ESTIMATED CRUMBS: 40,000.',
      vegeta: 'BEEP. PRINCE DETECTED. GRAVITY ROOM REPAIR TICKETS THIS MONTH: 9. THIS UNIT IS NOT JUDGING. THIS UNIT IS COUNTING.',
      satan: 'BEEP. GUEST HAS SIGNED 14 PHOTOS OF HIMSELF AND LEFT THEM ON THE SOFA. FILING UNDER: RECYCLING.',
    })) return;
    const n = s.inc('eb_cc_cleanbot_n');
    await s.say('eb_cc_cleanbot', n % 2 === 1
      ? 'BEEP. CLEANING LOUNGE. DETECTED: 47 VIDEO GAME CARTRIDGES, 12 CANDY WRAPPERS, 1 SMALL BOY HIDING UNDER CUSHION. IGNORING.'
      : 'BEEP. THE KITCHEN WAS CLEANED 4 MINUTES AGO. IT IS NO LONGER CLEAN. A SAIYAN HAS EATEN THERE.');
  },
  // LoG2: Mrs. Briefs hands out one Cookie per talk, forever, until you carry the 99 maximum.
  eb_cc_panchy: async (s) => {
    const me = 'eb_cc_panchy';
    const max = ITEMS.cookie?.max ?? 99;
    if (s.count('cookie') >= max) {
      await s.say(me, `Goodness, {hero}, you're carrying ${max} of my cookies already! If you get crumbs all over my carpet, I'll be quite cross.`, 'shock');
      return;
    }
    const n = s.inc('eb_cc_panchy_n');
    if (n === 1) {
      await s.say(me, 'Oh, hello, {hero}! Make yourself at home. I just took a batch of cookies out of the oven. Have one, dear!', 'happy');
    } else if (!(await heroTalk(s, me, PANCHY_TO_HERO, 'happy'))) {
      await s.say(me, n % 3 === 0
        ? 'You really can\'t get enough of my cookies, can you, {hero}? Good! That\'s why I bake them. I do love having company.'
        : byChapter(s, PANCHY_NEWS), 'happy');
    }
    await s.give('cookie', 1);
  },
  eb_cc_dino: async (s) => {
    if (await heroTalk(s, 'eb_cc_dino', {
      goku: [
        ['narrator', 'The baby dinosaur sniffs Goku\'s hand through the fence, then tries to eat his sleeve.'],
        ['hero', 'Hey! Heh heh, you\'re hungry too, huh? Me too, buddy.', 'happy'],
      ],
      vegeta: [['narrator', 'The baby dinosaur takes one look at Vegeta and hides behind the fence post. Most of it, anyway.']],
      gohan: [['narrator', 'The baby dinosaur rolls over for a belly rub. Gohan obliges. He has clearly done this before.']],
      piccolo: [['narrator', 'The baby dinosaur stares at Piccolo. Piccolo stares back. Neither of them blinks for a very long time.']],
      trunks: [['narrator', 'The baby dinosaur sniffs at Trunks\'s sword, sneezes, and wags its tail. In Trunks\'s time, there are no pets left at Capsule Corp.']],
      satan: [
        ['narrator', 'The baby dinosaur roars at Mr. Satan. It is a very small roar.'],
        ['hero', 'EEK! ...I mean, HA HA HA! Good boy! Sit! Stay! The Champion commands you!', 'shock'],
      ],
    })) return;
    const n = s.inc('eb_cc_dino_n');
    if (n % 2 === 1) await s.narrate('The Briefs family\'s baby dinosaur presses its nose against the fence and sniffs you hopefully. It smells cookies.');
    else await s.say('eb_cc_dino', 'Gao! Gao! (It wags its tail so hard it nearly falls over.)', 'happy');
  },
  eb_cc_terminal: async (s) => {
    if (!s.has('scouter')) {
      await s.narrate('Bulma\'s computer. The screen reads: "SCOUTER LINK: NO DEVICE DETECTED. Connect a scouter to browse the Capsule Corp field database."');
      return;
    }
    await s.narrate('Bulma\'s computer links to your scouter. "CAPSULE CORP FIELD DATABASE - every reading you have scanned is on file."');
    await s.scouterDatabase();
  },
  eb_cc_gravity: async (s) => {
    const c = await s.ask('narrator', 'GRAVITY CONTROL. Current setting: 1 G. Select gravity:', ['1 G', '10 G', '100 G', '300 G']);
    s.set('eb_gravity', [1, 10, 100, 300][c]);
    if (c === 0) { await s.narrate('The machine hums softly. Normal Earth gravity.'); return; }
    s.sfx('powerUp');
    s.shake(20, c);
    s.flash('#f05050', 8);
    if (c === 3 && !s.check('chapter>=6')) {
      await s.say('hero', 'Ngh... my legs... feel like... they\'re made of lead...!', 'hurt');
      await s.narrate('The emergency override kicks in and resets the room to 1 G. A recorded voice says: "Please consult a Saiyan before using this setting."');
      s.set('eb_gravity', 1);
      return;
    }
    await s.say('hero', [
      '',
      'Heh. Ten times gravity. Just like King Kai\'s planet.',
      'A hundred times! Every punch feels like lifting a mountain. Perfect.',
      'Three hundred times gravity... This is the kind of training I like!',
    ][c], 'smirk');
  },
});
