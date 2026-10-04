import { registerMaps } from '../../registry';

/**
 * Kame House: a sand island in open sea. Entry = the boat dock (world sign + save) on the south side.
 * Door warp at (19,11) -> kame_house_in. Story NPC spot: Master Roshi on the porch (21,13);
 * Roshi's training overlay (Ch5) can use the sand east of the house (24-28, 13-16).
 */

registerMaps([
  {
    id: 'kame_island', name: 'Kame House', music: 'peaceful', region: 'Kame House',
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
      'DDDDD~~sssss...........sssssssssss~~DDDD',
      'DDDDD~~ssssss..........ssssssssssss~DDDD',
      'DDDDD~~sssssssss......ssssssssssss~~DDDD',
      'DDDDDD~~ssssssssssssssssssssssssss~~DDDD',
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
    objects: [
      { type: 'worldSign', x: 17, y: 25 },
      { type: 'save', x: 23, y: 25 },
      { type: 'sign', x: 23, y: 13, text: 'KAME HOUSE - Residence of the Turtle Hermit. Salesmen, reporters and young ladies selling "insurance": please knock loudly.' },
    ],
    pickups: [{ id: 'del_kame_island_1', item: 'delicacy', x: 31, y: 14, hidden: true }],
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
