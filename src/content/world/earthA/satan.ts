import { registerMaps } from '../../registry';

/**
 * Satan City region (not hostile, except the dojo's sparring floor so jars/bags can be hit).
 *
 *   [satan_mansion]      (north; driveway cols 18-21 <-> plaza avenue cols 22-25)
 *   [satan_plaza]        (entry: world sign + save in the south plaza)
 *
 * Interiors: satan_shop (plaza store door 31,11), satan_mansion_in (mansion door 19-20,8),
 * satan_dojo (dojo door 31,7 on the mansion grounds).
 * Reserved: ZTV courtyard behind gate 'ztv_gate' (Mr. Satan L50) = tiles x 7-9, y 6-9 on satan_plaza.
 * Story NPC spot: Mr. Satan on the mansion forecourt (17,10).
 */

const CITY = { '#': 'wall', 'a': 'asphalt', 't': 'tile', '.': 'grass', ',': 'darkGrass', '~': 'water', 'p': 'path' } as const;
const IN = { 'R': 'roof', 'W': 'wall', 't': 'tile', 'k': 'carpet', 'f': 'floor', 'w': 'wood', 'A': 'arena' } as const;

registerMaps([
  // ---------------------------------------------------------------- downtown
  {
    id: 'satan_plaza', name: 'Satan City', music: 'town', region: 'Satan City',
    legend: { ...CITY },
    grid: [
      '######################aaaa######################',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#ttttt#ttt#tttttttttttaaaatttttttttt...........#',
      '#ttttt#ttt#tttttttttttaaaatttttttttt...........#',
      '#ttttt#ttt#taaaaaaatttaaaattttttttttttttttttttt#',
      '#ttttt#ttt#taaaaaaatttaaaattttttttttttttttttttt#',
      '#ttttt#ttt#taaaaaaatttaaaattttttttttttttttttttt#',
      '#tttttttttttaaaaaaatttaaaattttttttttttttttttttt#',
      '#tttttttttttaaaaaaatttaaaattttttttttttttttttttt#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#aaaaaaaaaaaaaaaaaaattaaaattaaaaaaaaaaaaaaaaaaa#',
      '#aaaaaaaaaaaaaaaaaaattaaaattaaaaaaaaaaaaaaaaaaa#',
      '#aaaaaaaaaaaaaaaaaaattaaaattaaaaaaaaaaaaaaaaaaa#',
      '#tttttttttttttttttttttaaaattttttttttttttttttttt#',
      '#........tt.........ttaaaattttttttttttttttttttt#',
      '#........tt.........ttaaaattttttttttttttttttttt#',
      '#.....tttttttt......ttaaaattttttttttttttttttttt#',
      '#.....tttttttt......ttaaaattttttttttttttttttttt#',
      '#.....tttttttt......ttaaaattttttttttttttttttttt#',
      '#.....ttttttttttttttttaaaattttttttttttttttttttt#',
      '#.....ttttttttttttttttaaaattttttttttttttttttttt#',
      '#.....tttttttt......ttaaaattttttttttttttttttttt#',
      '#.....tttttttt......ttttttttttttttttttttttttttt#',
      '#..~~~~~............ttttttttttttttttt..........#',
      '#.~~~~~~~...........ttttttttttttttttt..........#',
      '#..~~~~~............ttttttttttttttttt..........#',
      '#...................ttttttttttttttttt..........#',
      '#,,,,,,,,,,,,,,,,,..ttttttttttttttttt.,,,,,,,,,#',
      '################################################',
    ],
    props: [
      // ZTV studio + reserved courtyard (gate at y=10, x 7-9).
      ['ea_ztv', 5, 2], ['plant', 1.2, 4.8], ['plant', 3.6, 4.8], ['lamp', 11.4, 5.4], ['ea_board', 13.5, 2.4],
      ['car', 12.4, 8.3], ['car', 15.2, 8.3], ['car', 12.4, 11.2], ['car', 16.6, 11.2], ['bush', 19, 9], ['plant', 1.2, 9.6],
      // Hotel Satan + City Bank.
      ['building', 29, 0.6], ['building', 32, 0.6], ['statue', 37.4, 1.6], ['building', 41, 0.6],
      ['lamp', 28.2, 4.6], ['lamp', 40.2, 4.6], ['flowers', 37, 6], ['flowers', 39, 6.4], ['bush', 42, 6.2], ['flowers', 44, 6], ['tree', 44.4, 4.6],
      // Shops (store door 31,11 -> satan_shop; boutique 37,11 closed).
      ['ea_store', 29, 9], ['ea_boutique', 35, 9], ['plant', 33.4, 10.4], ['plant', 39.4, 10.4], ['ea_bench', 42, 11.2], ['lamp', 44.6, 9.6],
      // Avenue lamps.
      ['lamp', 20.2, 1.6], ['lamp', 20.2, 9.4], ['lamp', 26.4, 1.6], ['lamp', 26.4, 9.4], ['lamp', 20.2, 19.6], ['lamp', 26.4, 19.6],
      // Satan Square (park): gold statue, benches, pond.
      ['ea_satanStatue', 9, 20.7], ['flowers', 7, 21.6], ['flowers', 12, 21.6], ['flowers', 6.4, 25.4], ['flowers', 12.6, 25.4],
      ['tree', 1.2, 18.4], ['tree', 14.6, 18.4], ['pine', 3.6, 21.2], ['tree', 16.4, 21.4], ['tree', 1, 24.6], ['pine', 17.4, 25.6],
      ['ea_bench', 6.6, 26.9], ['ea_bench', 11, 26.9], ['lamp', 5.4, 20], ['lamp', 13.8, 20],
      ['bush', 9, 30], ['flowers', 10, 29], ['tree', 12.6, 28.6], ['grassTuft', 2, 31], ['tree', 15.8, 29.2], ['bush', 1.4, 27],
      // Cafe + apartments + police.
      ['ea_cafe', 29, 20], ['building', 35, 18.6], ['building', 41, 18.6],
      ['table', 29.2, 23.6], ['chair', 28.4, 23.8], ['chair', 31.2, 23.8], ['table', 33, 23.6], ['chair', 35, 23.8], ['plant', 33.6, 21],
      ['lamp', 40, 23.6], ['statue', 45, 22.6],
      // South plaza + lower park.
      ['fountain', 29.6, 27.6], ['ea_board', 33.6, 30.2], ['car', 40, 26.2], ['car', 43.4, 26.2],
      ['lamp', 19.2, 27.4], ['lamp', 28.2, 31], ['plant', 24.6, 31.6], ['plant', 21.4, 31.6], ['flowers', 31, 31], ['flowers', 35, 28],
      ['plant', 27.6, 26.4], ['plant', 19.4, 25.4],
      ['tree', 38, 28.6], ['pine', 41, 29.2], ['tree', 44.2, 28.8], ['flowers', 39, 31], ['bush', 36.4, 31.2],
    ],
    npcs: [
      { id: 'ea_sc_fan', sprite: 'kidNpc', x: 12, y: 24, talk: 'ea_sc_fan', name: 'Superfan Kid', wander: 2 },
      { id: 'ea_sc_reporter', sprite: 'reporter', x: 13, y: 6, talk: 'ea_sc_reporter', name: 'ZTV Reporter', wander: 1 },
      { id: 'ea_sc_police', sprite: 'police', x: 19, y: 14, talk: 'ea_sc_police', name: 'Officer Kobayashi', dir: 'down' },
      { id: 'ea_sc_granny', sprite: 'ea_granny', x: 4, y: 26, talk: 'ea_sc_granny', name: 'Granny Hana' },
      { id: 'ea_sc_suit', sprite: 'ea_suit', x: 41, y: 6, talk: 'ea_sc_suit', name: 'Banker', wander: 2 },
      { id: 'ea_sc_waiter', sprite: 'waiter', x: 31, y: 25, talk: 'ea_sc_waiter', name: 'Cafe Waiter', wander: 1 },
      { id: 'ea_sc_tourist', sprite: 'ea_tourist', x: 34, y: 6, talk: 'ea_sc_tourist', name: 'Tourist', wander: 1 },
      { id: 'ea_sc_jogger', sprite: 'ea_jogger', x: 27, y: 12, talk: 'ea_sc_jogger', name: 'Jogger', wander: 4 },
      { id: 'ea_sc_oldman', sprite: 'oldMan', x: 15, y: 27, talk: 'ea_sc_oldman', name: 'Retired Fighter', dir: 'up' },
      { id: 'ea_sc_girl', sprite: 'ea_girl', x: 36, y: 13, talk: 'ea_sc_girl', name: 'Shopper', wander: 2 },
      { id: 'ea_sc_scientist', sprite: 'scientist', x: 44, y: 14, talk: 'ea_sc_scientist', name: 'Professor', wander: 1 },
    ],
    warps: [{ x: 31, y: 11, w: 1, h: 1, to: 'satan_shop', tx: 6, ty: 8, dir: 'up', door: true }],
    exits: { north: { to: 'satan_mansion', offset: -4 } },
    barriers: [{ id: 'ztv_gate', x: 7, y: 10, w: 3, h: 1, level: 50, character: 'satan' }],
    triggers: [
      { id: 'ea_sc_hotel1', x: 30, y: 3, w: 1, h: 1, script: 'ea_sc_hotel', onAction: true },
      { id: 'ea_sc_hotel2', x: 33, y: 3, w: 1, h: 1, script: 'ea_sc_hotel', onAction: true },
      { id: 'ea_sc_bank', x: 42, y: 3, w: 1, h: 1, script: 'ea_sc_bank', onAction: true },
      { id: 'ea_sc_boutique', x: 37, y: 11, w: 1, h: 1, script: 'ea_sc_boutique', onAction: true },
      { id: 'ea_sc_cafe', x: 31, y: 22, w: 1, h: 1, script: 'ea_sc_cafe', onAction: true },
      { id: 'ea_sc_station', x: 42, y: 21, w: 1, h: 1, script: 'ea_sc_station', onAction: true },
      { id: 'ea_sc_flats', x: 36, y: 21, w: 1, h: 1, script: 'ea_sc_flats', onAction: true },
      { id: 'ea_sc_statue', x: 9, y: 24, w: 2, h: 1, script: 'ea_sc_statue', onAction: true },
    ],
    objects: [
      { type: 'worldSign', x: 20, y: 29 },
      { type: 'save', x: 27, y: 29 },
      { type: 'sign', x: 3, y: 8, text: 'ZTV - Satan City\'s number one station! Home of "Hercule Hour" and the Martial Arts Movie Marathon. Studio tours suspended until further notice.' },
      { type: 'sign', x: 28, y: 6, text: 'HOTEL SATAN - Every room has a view of a Mr. Satan statue. (Some rooms have two.)' },
      { type: 'sign', x: 46, y: 18, text: 'SATAN CITY POLICE - 24-hour service. In case of alien invasion, please remain calm and call Mr. Satan.' },
      { type: 'sign', x: 18, y: 31, text: 'Welcome to SATAN CITY, the city that saved the world! North: Avenue of Champions and the Satan Mansion.' },
    ],
    pickups: [{ id: 'del_satan_plaza_1', item: 'delicacy', x: 1, y: 30, hidden: true }],
  },

  // ---------------------------------------------------------------- Mr. Satan's mansion grounds
  {
    id: 'satan_mansion', name: 'Satan Mansion', music: 'town', region: 'Satan City',
    legend: { ...CITY },
    grid: [
      '########################################',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#..............................p.......#',
      '#.............ttttttttttttpppppp.......#',
      '#.............tttttttttttt.............#',
      '#.tttttttttttt....tttt.................#',
      '#.tt~~~~~~~~tt....tttt.................#',
      '#.tt~~~~~~~~tt....tttt.....ppppppppp...#',
      '#.tt~~~~~~~~tt....tttt.....p.......p...#',
      '#.tt~~~~~~~~tt....tttt.....p.......p...#',
      '#.tt~~~~~~~~tt....ttttpppppp.......p...#',
      '#.tt~~~~~~~~tt....tttt.....p.......p...#',
      '#.tttttttttttt....tttt.....p.......p...#',
      '#.................tttt.....ppppppppp...#',
      '#.................tttt.................#',
      '#.................tttt.................#',
      '#.................tttt.................#',
      '#.................tttt.................#',
      '#.................tttt.................#',
      '#.................tttt.................#',
      '#.................tttt.................#',
      '#,,,,,,,,,,,,,,,,,tttt,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,tttt,,,,,,,,,,,,,,,,,#',
      '##################tttt##################',
    ],
    props: [
      // Mansion (door warp 19-20,8) and the dojo (door 31,7).
      ['ea_mansion', 16, 3], ['ea_dojo', 29, 4],
      ['tree', 2, 1], ['tree', 6, 0.6], ['pine', 10, 1.4], ['tree', 12.6, 3.4], ['pine', 14, 0.8], ['tree', 25, 0.8], ['pine', 27.4, 1.6],
      ['tree', 35, 1.2], ['pine', 37.4, 3], ['pine', 1.4, 5], ['tree', 3.6, 6.4], ['flowers', 7, 5], ['flowers', 9, 7], ['bush', 11, 6.6],
      ['statue', 35.6, 5.6], ['flowers', 34, 8.4], ['flowers', 36.6, 8.4], ['bush', 26.4, 6.6], ['plant', 15, 8.6], ['plant', 24.4, 8.6],
      // Pool.
      ['chair', 2.2, 12.2], ['chair', 2.2, 14.2], ['chair', 2.2, 16.2], ['table', 12.2, 18.4], ['plant', 12.6, 10.8], ['plant', 1.2, 10.6],
      // Driveway hedges.
      ['bush', 16.6, 11.6], ['bush', 16.6, 13.4], ['bush', 16.6, 18.4], ['bush', 16.6, 20.2], ['bush', 16.6, 22], ['bush', 16.6, 23.8],
      ['bush', 22.4, 11.6], ['bush', 22.4, 13.4], ['bush', 22.4, 18.4], ['bush', 22.4, 20.2], ['bush', 22.4, 22], ['bush', 22.4, 23.8],
      ['lamp', 17.4, 25.2], ['lamp', 22, 25.2],
      // Garden around the statue ring.
      ['ea_satanStatue', 30.4, 13.6], ['flowers', 28.4, 14.4], ['flowers', 33.6, 14.4], ['flowers', 28.4, 18], ['flowers', 33.6, 18],
      ['bush', 25, 13], ['tree', 37, 11.6], ['tree', 36.6, 16], ['pine', 37.4, 19.6], ['flowers', 25, 18.6], ['bush', 24.4, 21.4],
      ['tree', 27, 21.2], ['flowers', 30, 21.6], ['tree', 31.4, 23.2], ['pine', 35, 22], ['flowers', 33, 25], ['bush', 28, 25.4],
      // West lawn + fountain.
      ['fountain', 6.4, 21.2], ['tree', 1.4, 19.2], ['tree', 12.4, 20.6], ['pine', 2, 23.8], ['flowers', 5, 25.4], ['flowers', 10, 25.4],
      ['tree', 13.6, 24.2], ['bush', 9, 19.6], ['ea_bench', 6.6, 26.2],
      // Gate.
      ['pillar', 16.6, 26.6], ['pillar', 22.4, 26.6], ['fenceH', 1, 27.6], ['fenceH', 38, 27.6],
    ],
    npcs: [
      { id: 'ea_sm_gardener', sprite: 'farmer', x: 26, y: 23, talk: 'ea_sm_gardener', name: 'Gardener', wander: 2 },
      { id: 'ea_sm_guard', sprite: 'police', x: 23, y: 27, talk: 'ea_sm_guard', name: 'Security Guard', dir: 'left' },
      { id: 'ea_sm_swimmer', sprite: 'ea_girl', x: 3, y: 18, talk: 'ea_sm_swimmer', name: 'Pool Guest', wander: 1 },
    ],
    warps: [
      { x: 19, y: 8, w: 2, h: 1, to: 'satan_mansion_in', tx: 9, ty: 12, dir: 'up', door: true },
      { x: 31, y: 7, w: 1, h: 1, to: 'satan_dojo', tx: 9, ty: 12, dir: 'up', door: true },
    ],
    exits: { south: { to: 'satan_plaza', offset: 4 } },
    objects: [
      { type: 'sign', x: 26, y: 10, text: 'SATAN DOJO - Students of the Champion only. Shoes off, spirits high!' },
    ],
    pickups: [{ id: 'del_satan_mansion_1', item: 'delicacy', x: 37, y: 25 }],
  },

  // ---------------------------------------------------------------- mansion interior
  {
    id: 'satan_mansion_in', name: 'Satan Mansion', music: 'town', region: 'Satan City', indoor: true,
    legend: { ...IN },
    grid: [
      'RRRRRRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WkkkkkkWtkkttttttttW',
      'WkkkkkkWtkkttttttttW',
      'WkkkkkkWtkkttttttttW',
      'WkkkkkkWtkkttttttttW',
      'WkkkkkkWtkkttttttttW',
      'WkkkkkkttkkttttttttW',
      'WkkkkkkttkkttttttttW',
      'WkkkkkkttkkttttttttW',
      'WkkkkkkttkkttttttttW',
      'WkkkkkkttkkttttttttW',
      'WWWWWWWWWkkWWWWWWWWW',
    ],
    props: [
      // Trophy room.
      ['statue', 1.2, 2.4], ['statue', 4.6, 2.4], ['pillar', 3, 2.2], ['rug', 2, 6.2], ['bookshelf', 1, 9.6], ['plant', 5.6, 10.6],
      // Grand staircase.
      ['stairs', 9, 3], ['stairs', 10, 3], ['plant', 8, 2.6], ['plant', 11.2, 2.6],
      // Lounge: Buu's TV corner.
      ['tv', 14.6, 2.4], ['rug', 13.6, 5.2], ['table', 13.6, 7.4], ['chair', 12.4, 7.6], ['chair', 16.4, 7.6], ['bed', 17.6, 3.2], ['plant', 18, 10.6],
    ],
    npcs: [
      { id: 'ea_smi_buu', sprite: 'majinBuu', x: 15, y: 5, dir: 'up', talk: 'ea_smi_buu', name: 'Majin Buu', hideIf: 'ea_buuAway' },
      { id: 'ea_smi_bee', sprite: 'ea_dog', x: 15, y: 10, talk: 'ea_smi_bee', name: 'Bee', wander: 2, hideIf: 'ea_beeAway' },
      { id: 'ea_smi_butler', sprite: 'ea_butler', x: 12, y: 11, talk: 'ea_smi_butler', name: 'Butler' },
    ],
    warps: [{ x: 9, y: 13, w: 2, h: 1, to: 'satan_mansion', tx: 19, ty: 9, dir: 'down', door: true }],
    triggers: [
      { id: 'ea_smi_stairs', x: 9, y: 3, w: 2, h: 1, script: 'ea_smi_stairs', onAction: true },
      { id: 'ea_smi_trophies', x: 1, y: 4, w: 5, h: 1, script: 'ea_smi_trophies', onAction: true },
    ],
  },

  // ---------------------------------------------------------------- souvenir shop
  {
    id: 'satan_shop', name: 'Champ Goods', music: 'town', region: 'Satan City', indoor: true,
    legend: { ...IN },
    grid: [
      'RRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWW',
      'WttttttttttttW',
      'WttttttttttttW',
      'WttttttttttttW',
      'WttttttttttttW',
      'WttttttttttttW',
      'WttttttttttttW',
      'WWWWWWttWWWWWW',
    ],
    props: [
      ['bookshelf', 1, 2], ['bookshelf', 11, 2], ['counter', 4.5, 3.9], ['jar', 8, 3.2], ['plant', 3.6, 2.6],
      ['crate', 1, 6.4], ['barrel', 1.2, 7.6], ['crate', 12, 7.4], ['rug', 5, 6.2], ['plant', 12.2, 5.4],
    ],
    npcs: [
      { id: 'ea_sh_clerk', sprite: 'ea_clerk', x: 6, y: 3, dir: 'down', talk: 'ea_sh_clerk', name: 'Clerk' },
      { id: 'ea_sh_customer', sprite: 'kidNpc', x: 10, y: 6, talk: 'ea_sh_customer', name: 'Young Customer', wander: 1 },
    ],
    warps: [{ x: 6, y: 9, w: 2, h: 1, to: 'satan_plaza', tx: 31, ty: 12, dir: 'down', door: true }],
    triggers: [{ id: 'ea_sh_shelf', x: 1, y: 3, w: 2, h: 1, script: 'ea_sh_shelf', onAction: true }],
  },

  // ---------------------------------------------------------------- dojo (sparring arena)
  {
    id: 'satan_dojo', name: 'Satan Dojo', music: 'training', region: 'Satan City', indoor: true, hostile: true,
    legend: { ...IN },
    grid: [
      'RRRRRRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WwwwwwwwwwwwwwwwwwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwAAAAAAAAAAAAAAwwW',
      'WwwwwwwwwwwwwwwwwwwW',
      'WWWWWWWWWwwWWWWWWWWW',
    ],
    props: [
      ['pillar', 1, 2.3], ['pillar', 18, 2.3], ['pillar', 1, 8.6], ['pillar', 18, 8.6],
      ['rug', 8.5, 3], ['plant', 6, 2.6], ['plant', 13.2, 2.6],
    ],
    npcs: [
      { id: 'ea_sd_student1', sprite: 'ea_student', x: 7, y: 7, dir: 'right', talk: 'ea_sd_student1', name: 'Senior Student' },
      { id: 'ea_sd_student2', sprite: 'ea_student2', x: 12, y: 7, dir: 'left', talk: 'ea_sd_student2', name: 'Student' },
    ],
    warps: [{ x: 9, y: 13, w: 2, h: 1, to: 'satan_mansion', tx: 31, ty: 8, dir: 'down', door: true }],
    triggers: [{ id: 'ea_sd_poster', x: 8, y: 2, w: 4, h: 1, script: 'ea_sd_poster', onAction: true }],
    objects: [
      { type: 'breakable', x: 2, y: 5, size: 1, look: 'jar' },
      { type: 'breakable', x: 2, y: 7, size: 1, look: 'jar' },
      { type: 'breakable', x: 17, y: 5, size: 1, look: 'jar' },
      { type: 'breakable', x: 17, y: 7, size: 1, look: 'jar', item: 'delicacy', id: 'del_satan_dojo_1' },
      { type: 'breakable', x: 4, y: 12, size: 1, look: 'jar' },
      { type: 'bag', x: 4, y: 10 },
      { type: 'bag', x: 15, y: 10 },
    ],
  },
]);
