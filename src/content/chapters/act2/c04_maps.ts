import { registerMaps } from '../../registry';
import { HUB } from './hubs';

/**
 * Chapter 4 map: Whis's Training Field on Beerus's planet. A pond (fill water jars), a hazard lane of rolling
 * beetles on the way to the basin plaza, three training boulders, a thieving puffbird, a sparring ring for the
 * Whis and Goku-vs-Vegeta fights, and a Vegeta L17 gate in front of a little shrine. Its wildlife is the young of
 * Beerus's grounds (puffbird chicks, a moss calf; see enemies.ts), tuned for Vegeta's L15-17 grind to that gate.
 */
registerMaps([
  {
    id: 'c04_whis_field', name: 'Whis\'s Training Field', music: 'training', hostile: true, region: 'Beerus\'s Planet',
    legend: { '#': 'cliff', '.': 'alienGrass', ',': 'darkGrass', '~': 'water', '=': 'path', m: 'marble', a: 'arena', r: 'rock', d: 'dirt' },
    grid: [
      '####################################',
      '####################################',
      '#....................mmmmmmmm.#mmmm#',
      '#..,,,,,,............mmmmmmmm.#mmmm#',
      '#..,,,,,,...,,,,,,...mmmmmmmm.mmmmm#',
      '#..,,,,,,...,,,,,,...mmmmmmmm.mmmmm#',
      '#..,,,,,,...,,,,,,...mmmmmmmm.#mmmm#',
      '#...d.......,,,,,,.....===....#mmmm#',
      '#...d.......,,,,,,.....===....#mmmm#',
      '#...d.......,,,,,,.....===....######',
      '#...d.......,,,,,,.....===.........#',
      '#...d..................===.aaaaaaaa#',
      '#...d..................===.aaaaaaaa#',
      '#...d..................===.aaaaaaaa#',
      '#...ddddddd............===.aaaaaaaa#',
      '#..........rrrrrrrrrrrr===.aaaaaaaa#',
      '#......................===.aaaaaaaa#',
      '#......................===.aaaaaaaa#',
      '#..~~~~~~..............===.aaaaaaaa#',
      '#.~~~~~~~=================.aaaaaaaa#',
      '#.~~~~~~~=================.aaaaaaaa#',
      '#.~~~~~~~=================.aaaaaaaa#',
      '#..~~~~~~..........................#',
      '#..................................#',
      '#..................................#',
      '####################################',
    ],
    props: [
      ['fountain', 23.5, 3], ['stoneArch', 22.5, 6.6], ['alienTree', 9, 2], ['alienTree', 17, 2], ['alienTree', 1.5, 11.5],
      ['alienTree', 9, 22], ['alienTree', 19, 21.8], ['alienTree', 29.5, 21.6], ['pillar', 27, 8.4], ['pillar', 34, 8.4],
      ['jar', 7, 16.6], ['jar', 7.8, 16.8], ['jar', 3.4, 16.7], ['shrine', 32, 2], ['flowers', 13, 23], ['flowers', 25, 23],
      ['grassTuft', 2, 8], ['grassTuft', 15, 13], ['grassTuft', 20, 11], ['floatingRock', 12, 0.4],
    ],
    enemies: [
      { type: 'c04_roller', x: 13, y: 18 }, { type: 'c04_roller', x: 16, y: 22 }, { type: 'c04_roller', x: 19, y: 17 },
      { type: 'c04_critter', x: 14, y: 6, id: 'c04_critter', onDefeat: 'c04_critter_caught', showIf: 'quest:c04_training' },
      { type: 'c04_puffChick', x: 6, y: 12 }, { type: 'c04_puffChick', x: 18, y: 11 }, { type: 'c04_mossCalf', x: 15, y: 9 },
    ],
    // Whis teaches here from the end of the ramen scene; a player who flies home mid-lesson finds him at Capsule Corp.
    npcs: [{ id: 'c04_fieldWhis', sprite: 'whis', x: 26, y: 12, dir: 'left', talk: 'c04_fieldWhis_talk', name: 'Whis', showIf: 'chapter==4&done:c04_whis&world:space' }],
    barriers: [{ id: 'c04_v17', x: 30, y: 4, w: 1, h: 2, level: 17, character: 'vegeta' }],
    objects: [
      { type: 'save', x: 6, y: 3 },
      { type: 'flight', x: 2, y: 4, to: HUB.beerusFlight.map, tx: HUB.beerusFlight.x, ty: HUB.beerusFlight.y, label: 'Lord Beerus\'s palace' },
      { type: 'sign', x: 8, y: 7, text: 'WHIS\'S TRAINING FIELD. Chores are training, and training is chores. Mind the beetles. - W.' },
      { type: 'breakable', x: 5, y: 9, size: 3, id: 'c04_rock1' },
      { type: 'breakable', x: 9, y: 11, size: 3, id: 'c04_rock2' },
      { type: 'breakable', x: 14, y: 12, size: 3, id: 'c04_rock3' },
      { type: 'breakable', x: 20, y: 3, size: 1, look: 'jar' }, { type: 'breakable', x: 2, y: 23, size: 2 },
      { type: 'chest', x: 33, y: 6, id: 'c04_shrineChest', item: 'end3' },
    ],
    triggers: [
      { id: 'c04_pond', x: 8, y: 19, w: 1, h: 3, script: 'c04_jar_fill', onAction: true },
      { id: 'c04_basin', x: 23, y: 6, w: 3, h: 1, script: 'c04_jar_deliver' },
    ],
    onEnter: 'c04_field_enter',
  },
]);
