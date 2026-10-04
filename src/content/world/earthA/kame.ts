import { registerMaps } from '../../registry';

/**
 * Kame House: a sand island in open sea. Entry = the boat dock (world sign + save) on the south side.
 * Door warp at (19,11) -> kame_house_in. Story NPC spot: Master Roshi on the porch (21,13);
 * Roshi's training overlay (Ch5) can use the sand east of the house (24-28, 13-16).
 *
 * Turtle Reef (kame_reef, hostile) is the region's LoG2 Tropical-Islands stand-in: the low-tide sandbar off the
 * island's east beach (rows 12-13) walks straight onto it. Its water wildlife (crabs, vipers, king crabs) is what
 * drops the Fish that Korin trades for Senzu Beans. Inner flats: open from Ch2 (crabs, vipers, mud golems).
 * Outer atoll: behind the Gohan L25 gate 'ea_g25_gohan' on the spit (22, 12-13): king crabs, a pterodactyl and
 * the region's Delicacy.
 */

registerMaps([
  {
    id: 'kame_island', name: 'Kame House', music: 'islands', region: 'Kame House',
    legend: { 'D': 'deep', '~': 'water', 's': 'sand', '.': 'grass', 'b': 'wood' },
    grid: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDD~~~~~~~~~~DDDDDDDDDDDDDDD',
      'DDDDDDDDDDD~~~~~~~~~~~~~~~~~~DDDDDDDDDDD',
      'DDDDDDDDD~~~~~sssssssssss~~~~~~DDDDDDDDD',
      'DDDDDDDD~~~~sssssssssssssss~~~~~DDDDDDDD',
      'DDDDDDD~~~ssssssssssssssssssss~~~DDDDDDD',
      'DDDDDD~~~sssss..........sssssss~~~DDDDDD',
      'DDDDDD~~ssss............ssssssss~~~DDDDD',
      'DDDDD~~~sss.............sssssssss~~DDDDD',
      'DDDDD~~ssss.............ssssssssss~~DDDD',
      'DDDDD~~sssss...........sssssssssss~~~~~~',
      'DDDDD~~ssssss..........sssssssssssssssss',
      'DDDDD~~sssssssss......ssssssssssssssssss',
      'DDDDDD~~ssssssssssssssssssssssssss~~~~~~',
      'DDDDDD~~~sssssssssssssssssssssss~~~DDDDD',
      'DDDDDDD~~~sssssssssssssssssssss~~~DDDDDD',
      'DDDDDDDD~~~ssssssssssssssssss~~~DDDDDDDD',
      'DDDDDDDDD~~~~ssssssssssssss~~~~DDDDDDDDD',
      'DDDDDDDDDDD~~~~~~sssssss~~~~~DDDDDDDDDDD',
      'DDDDDDDDDDDDD~~~~~~bbb~~~~~~DDDDDDDDDDDD',
      'DDDDDDDDDDDDDDD~~~~bbb~~~~DDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDD~~bbb~~DDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDbbbDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDbbbbbbbbbDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDbbbbbbbbbDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDbbbbbbbbbDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ],
    props: [
      ['kameHouse', 18, 8],
      ['palm', 12, 4.4], ['palm', 25.4, 5], ['palm', 27.6, 11.4], ['palm', 9.6, 11.6], ['palm', 14.2, 14.2],
      ['flowers', 15, 9], ['flowers', 23, 9.4], ['grassTuft', 13, 11], ['grassTuft', 22.6, 12.4], ['mailbox', 22.4, 10.4],
      ['rock', 30.4, 12.6], ['smallRock', 32, 11], ['rock', 8.4, 9.2], ['smallRock', 11, 16.4], ['boulder', 28.6, 15.4], ['smallRock', 17, 6],
      ['crate', 16.2, 24.6], ['barrel', 23.6, 24.4], ['fenceV', 16, 25.2], ['fenceV', 24.6, 25.2],
    ],
    npcs: [
      { id: 'ea_ki_turtle', sprite: 'ea_turtle', x: 26, y: 17, dir: 'left', talk: 'ea_ki_turtle', name: 'Turtle', wander: 1 },
      { id: 'ea_ki_sailor', sprite: 'ea_sailor', x: 22, y: 26, dir: 'left', talk: 'ea_ki_sailor', name: 'Ferryman' },
    ],
    warps: [{ x: 19, y: 11, w: 1, h: 1, to: 'kame_house_in', tx: 7, ty: 9, dir: 'up', door: true }],
    exits: { east: { to: 'kame_reef' } },
    objects: [
      { type: 'worldSign', x: 17, y: 25 },
      { type: 'save', x: 23, y: 25 },
      { type: 'sign', x: 23, y: 13, text: 'KAME HOUSE - Residence of the Turtle Hermit. Salesmen, reporters and young ladies selling "insurance": please knock loudly.' },
      { type: 'sign', x: 33, y: 11, text: 'TURTLE REEF - east along the sandbar. Crabs pinch, vipers bite, and the big crabs do both. Bring back a fish or two for Korin. - Turtle' },
    ],
  },

  // ---------------------------------------------------------------- Turtle Reef (hostile)
  {
    id: 'kame_reef', name: 'Turtle Reef', music: 'islands', hostile: true, region: 'Kame House',
    legend: { 'D': 'deep', '~': 'water', 's': 'sand', '.': 'grass', 'r': 'rock' },
    grid: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 0
      'DDDDDDDDDDD~~~~~~DDDDDDDDDDDDDDDDDDDDDDD', // 1
      'DDDDDDDD~~~~ssss~~~~DDDDDDDDDDDDDDDDDDDD', // 2
      'DDDDDDD~~ssssssssss~~DDDDDDDDDDDDDDDDDDD', // 3
      'DDDDDD~~sss......sss~~DDDDDDD~~~~~DDDDDD', // 4
      'DDDDDD~sss........sss~DDDDD~~~sss~~~DDDD', // 5
      'DDDDDD~sss........sss~DDDD~~sssssss~~DDD', // 6
      'DDDDDD~~sss......sss~~DDDD~ssssssss.~DDD', // 7
      'DDDDDDD~~ssssssssss~~DDDD~~sssssss..~~DD', // 8
      'DDDDDDDD~~~~ssss~~~~DDDDD~ssss~~~s...~DD', // 9
      'DDD~~~~~~~~~sss~~~DDDDDD~~sss~~~~~...~~D', // 10
      '~~~~sssssssssssss~~~~~~~~ssss~~~~~...s~D', // 11
      'sssssssssssssssssssssssssssss~~~~~s.ss~D', // 12
      'sssssssssssssssssssssssssssss~~~~~ssss~D', // 13
      '~sssssssssssssssssss~~~~~ssss~~~~~ssss~D', // 14
      '~sssss~~ssssssssssss~DDD~ssss~~~~~ssss~D', // 15
      '~~~~ss~~sssssssss~~~~DDD~~ssss~~~ssss~~D', // 16
      'DDD~~ssssssssssss~~~~DDDD~sssssssssss~DD', // 17
      'DD~~ssssssssssssssss~~DDD~~sssssssss~~DD', // 18
      'DD~sssssrss~~ssrrssss~DDDD~sss...sss~DDD', // 19
      'DD~sssrrrrrssrrrrrrss~DDDD~~.......~~DDD', // 20
      'DD~~srrrrrrrsrrrrrrs~~DDDDD~~~...~~~DDDD', // 21
      'DDD~~srrrrrsrssrrss~~DDDDDDDD~~~~~DDDDDD', // 22
      'DDDD~~~srrrrrrrrs~~~DDDDDDDDDDDDDDDDDDDD', // 23
      'DDDDDD~~~~~~r~~~~~DDDDDDDDDDDDDDDDDDDDDD', // 24
      'DDDDDDDDDDD~~~DDDDDDDDDDDDDDDDDDDDDDDDDD', // 25
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 26
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 27
    ],
    props: [
      // Palm islet (north).
      ['palm', 9.4, 2.8], ['palm', 16.2, 2.6], ['palm', 12.6, 4.6], ['flowers', 10, 6], ['flowers', 15, 5.4], ['grassTuft', 13, 7],
      ['grassTuft', 17, 6.4], ['smallRock', 9, 7.2],
      // Tide flats: driftwood, shells and a washed-up crate.
      ['deadTree', 5.6, 9.4], ['smallRock', 7, 12.4], ['smallRock', 17.4, 14.2], ['crate', 18.2, 15], ['barrel', 5.6, 17.6], ['smallRock', 12, 16.4],
      // Rock reef (south).
      ['rock', 6.2, 19.4], ['boulder', 13.4, 20.4], ['rock', 17.4, 18.6], ['smallRock', 9, 22.4], ['smallRock', 15.6, 22.2], ['rock', 5.4, 21.2],
      // Outer atoll.
      ['palm', 34.6, 6.4], ['palm', 35.8, 10.6], ['palm', 28.6, 17.6], ['palm', 33.6, 18.2], ['rock', 26.6, 9.2], ['rock', 31, 5.4],
      ['grassTuft', 36, 12.6], ['flowers', 30, 20], ['flowers', 31.6, 19.6], ['smallRock', 26.4, 15.6],
    ],
    enemies: [
      // Inner flats (open from Chapter 2). LoG2's Tropical Islands let every foe roll for a Fish; here the shore
      // wildlife carries them, so the flats hold the region's biggest crab-and-viper population.
      { type: 'crab', x: 9, y: 14 }, { type: 'crab', x: 15, y: 12 }, { type: 'crab', x: 11, y: 17 },
      { type: 'crab', x: 16, y: 17 }, { type: 'crab', x: 14, y: 19 },
      { type: 'viper', x: 13, y: 9 }, { type: 'viper', x: 19, y: 5 },
      { type: 'mudSlime', x: 8, y: 20 }, { type: 'mudSlime', x: 16, y: 21 },
      // Outer atoll (Gohan L25).
      { type: 'kingCrab', x: 28, y: 7 }, { type: 'kingCrab', x: 35, y: 15 }, { type: 'kingCrab', x: 27, y: 16 },
      { type: 'pterodactyl', x: 32, y: 19 },
    ],
    exits: { west: { to: 'kame_island' } },
    barriers: [{ id: 'ea_g25_gohan', x: 22, y: 12, w: 1, h: 2, level: 25, character: 'gohan' }],
    objects: [
      { type: 'sign', x: 3, y: 14, text: 'TURTLE REEF. Low-tide flats, rock pools and one very old atoll. Swimming not advised: the crabs are territorial.' },
      { type: 'chest', x: 13, y: 3, id: 'ea_reef_end1', item: 'end1' },
      { type: 'breakable', x: 11, y: 5, size: 1, look: 'jar' },
      { type: 'breakable', x: 18, y: 12, size: 2 },
      { type: 'breakable', x: 11, y: 21, size: 2 },
      { type: 'breakable', x: 36, y: 13, size: 3, item: 'pow1', id: 'ea_reef_rock' },
    ],
    pickups: [{ id: 'del_kame_reef_1', item: 'delicacy', x: 31, y: 21 }],
  },

  {
    id: 'kame_house_in', name: 'Kame House', music: 'peaceful', region: 'Kame House', indoor: true,
    legend: { 'R': 'roof', 'W': 'wall', 'w': 'wood', 'k': 'carpet' },
    grid: [
      'RRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WwwwwwwwwwwwwwwW',
      'WwwwwwwwwwwwwwwW',
      'WwwwwwwwwwwwwwwW',
      'WwwwwwwwwwwwwwwW',
      'WwwwwwwwwwwwwwwW',
      'WwwwwwwwwwwwwwwW',
      'WwwwwwwwwwwwwwwW',
      'WWWWWWWwwWWWWWWW',
    ],
    props: [
      ['tv', 2, 2.5], ['chair', 2.6, 4.6], ['rug', 5, 5.4], ['table', 5, 5.8], ['chair', 4, 6.8],
      ['bookshelf', 9, 2], ['stairs', 13, 3], ['stairs', 14, 3], ['counter', 10.4, 7.6], ['plant', 1, 8.2], ['jar', 14, 8.6],
    ],
    warps: [{ x: 7, y: 10, w: 2, h: 1, to: 'kame_island', tx: 19, ty: 12, dir: 'down', door: true }],
    triggers: [
      { id: 'ea_kh_stairs', x: 13, y: 3, w: 2, h: 1, script: 'ea_kh_stairs', onAction: true },
      { id: 'ea_kh_shelf', x: 9, y: 3, w: 2, h: 1, script: 'ea_kh_shelf', onAction: true },
      { id: 'ea_kh_tv', x: 2, y: 3, w: 2, h: 1, script: 'ea_kh_tv', onAction: true },
    ],
  },
]);
