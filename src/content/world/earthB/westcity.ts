import { registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerMaps } from '../../registry';
import type { Expression } from '../../../art/portrait';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { GRIDS } from './grids';

/*
 * WEST CITY (region 'West City', safe): wc_streets ⇄ cc_yard (edge exit, avenue rows 10-16),
 * wc_streets → wc_shops (two doors), cc_yard → cc_inside (Capsule Corp door) → cc_gravity.
 *
 * Coordinates chapters need (tiles):
 *  - wc_streets: world sign (1,18), save (4,18), landing (2,20). Ramen door (8,20), restaurant door (13,20).
 *    Gate to Capsule Corp = east edge rows 10-16. Open plaza for overlays: avenue x 6-40 rows 10-16.
 *  - cc_yard: Capsule Corp prop at (18,2), front door warp (21,7), arrival outside (21,8).
 *    Party lawn x 6-39 rows 15-27 (kept clear), lawn centre (23,21). Front plaza x 13-28 rows 8-11.
 *    Hangar pad x 29-42 rows 2-11; free space for a time machine at (31-35, 3-7).
 *  - cc_inside: entrance (9-10,13) → arrival (9,12). Computer room x 1-5 rows 8-12; the computer terminal
 *    (table+monitor) is at (1-2, 8); stand at (2,9) facing up; trigger rect {x:1,y:8,w:2,h:1} runs
 *    eb_cc_terminal: without a scouter it explains the link, with one it opens s.scouterDatabase().
 *    A chapter that wants its own terminal scene sets flag 'eb_terminal_custom' (hides the base trigger) and
 *    overlays its trigger on the same rect. Lab x 1-9 rows 2-6 (stairs to the gravity room at (4,1)), kitchen x 11-18 rows 2-6,
 *    lobby x 7-12 rows 8-12, lounge x 14-18 rows 8-12.
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

registerMaps([
  {
    id: 'wc_streets', name: 'West City', music: 'town', region: 'West City',
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
    id: 'wc_shops', name: 'Food Street Eateries', music: 'town', region: 'West City', indoor: true,
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
    id: 'cc_yard', name: 'Capsule Corporation', music: 'town', region: 'West City',
    legend: { ...CITY, x: 'metal' },
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
    ],
    npcs: [
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
    ],
  },
  {
    id: 'cc_inside', name: 'Capsule Corp. HQ', music: 'town', region: 'West City', indoor: true,
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
    ],
    warps: [
      { x: 9, y: 13, w: 2, h: 1, to: 'cc_yard', tx: 21, ty: 8, dir: 'down', door: true },
      { x: 4, y: 1, w: 1, h: 1, to: 'cc_gravity', tx: 7, ty: 9, dir: 'up', door: true },
    ],
    triggers: [{ id: 'eb_cc_terminal', x: 1, y: 8, w: 2, h: 1, script: 'eb_cc_terminal', onAction: true, hideIf: 'eb_terminal_custom' }],
    objects: [{ type: 'chest', x: 1, y: 6, id: 'eb_cap_cclab', item: 'end1' }],
  },
  {
    id: 'cc_gravity', name: 'Gravity Room', music: 'battle', region: 'West City', indoor: true, hostile: true,
    legend: { '#': 'wall', x: 'metal' },
    grid: GRIDS.cc_gravity,
    props: [['eb_gravityConsole', 7.25, 3.6], ['tv', 4, 1.2], ['tv', 10.5, 1.2]],
    triggers: [{ id: 'eb_cc_gravity', x: 7, y: 4, w: 2, h: 2, script: 'eb_cc_gravity', onAction: true }],
    warps: [{ x: 7, y: 11, w: 2, h: 1, to: 'cc_inside', tx: 4, ty: 2, dir: 'down', door: true }],
    objects: [{ type: 'bag', x: 4, y: 6 }, { type: 'bag', x: 11, y: 6 }],
  },
]);

/** Dialogue lines for `s.talk`. */
type TalkLines = Array<[string, string, Expression?]>;

/** Pick the line for the current story point: the last entry whose chapter threshold is reached. */
function byChapter<T>(s: ScriptApi, table: Array<[number, T]>): T {
  let pick = table[0][1];
  for (const [ch, v] of table) if (s.check(`chapter>=${ch}`)) pick = v;
  return pick;
}

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
    await s.say('eb_cc_mechanic', byChapter(s, [
      [0, 'This ship? Dr. Brief\'s design. It flew to Namek once. Well, its grandfather did. This one mostly flies to the beach.'],
      [7, 'We\'re retrofitting the hangar for "interuniversal travel". I don\'t know what that means but the paycheck is great.'],
      [9, 'Whoever parked that time machine left no fuel in it. None. I\'m a mechanic, not a miracle worker.'],
    ]));
  },
  eb_cc_poolbot: async (s) => {
    const n = s.inc('eb_cc_poolbot_n');
    await s.say('eb_cc_poolbot', [
      'BZZT. POOL CHLORINE: OPTIMAL. WATER TEMPERATURE: 28 DEGREES. SWIMMING PERMITTED.',
      'BZZT. WARNING: DO NOT PERFORM KI BLASTS IN THE POOL. LAST INCIDENT: 3 DAYS AGO. SUSPECT: SMALL, PURPLE HAIR.',
      'BZZT. HELLO, GUEST. HAVE A NICE DAY. THIS UNIT LIKES YOU. THIS UNIT IS NOT PROGRAMMED TO LIKE.',
    ][(n - 1) % 3]);
  },
  eb_cc_tech: async (s) => {
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
    await s.say('eb_cc_receptionist', byChapter(s, [
      [0, 'Bulma\'s computer room is through the door on the left. Please don\'t touch the big monitor; it\'s full of very expensive secrets.'],
      [2, 'A visitor in a purple robe and his tall friend in blue came by asking for "the most delicious food on Earth". I sent them to the kitchen.'],
      [5, 'The phones haven\'t stopped ringing since the invasion. Everyone wants to know if Capsule Corp is behind the "fighting space aliens". Well...'],
      [9, 'Please excuse the noise from the yard. We are definitely not building a time machine. Definitely.'],
    ]));
  },
  eb_cc_labtech: async (s) => {
    await s.say('eb_cc_labtech', byChapter(s, [
      [0, 'That round pod is a Saiyan space pod. We use it to test landing systems. The dent in the floor is from Tuesday.'],
      [2, 'The gravity machine upstairs has been rebuilt nine times this year. Prince Vegeta keeps "improving" it with his fists.'],
      [7, 'Dr. Brief says the radar for the Super Dragon Balls will need a map of an entire universe. We bought a very large printer.'],
      [11, 'We\'re studying the energy signature from the last time-machine jump. It shouldn\'t exist. That\'s what makes it fun.'],
    ]));
  },
  eb_cc_cleanbot: async (s) => {
    const n = s.inc('eb_cc_cleanbot_n');
    await s.say('eb_cc_cleanbot', n % 2 === 1
      ? 'BEEP. CLEANING LOUNGE. DETECTED: 47 VIDEO GAME CARTRIDGES, 12 CANDY WRAPPERS, 1 SMALL BOY HIDING UNDER CUSHION. IGNORING.'
      : 'BEEP. THE KITCHEN WAS CLEANED 4 MINUTES AGO. IT IS NO LONGER CLEAN. A SAIYAN HAS EATEN THERE.');
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
