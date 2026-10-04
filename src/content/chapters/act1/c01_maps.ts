import { registerMaps } from '../../registry';
import { HUB } from './hubs';
import { SEALED } from './util';

/**
 * Chapter 1 maps.
 * - c01_dream: Goku's nightmare (a twisted Mt. Paozu clearing) for the Dream Frieza tutorial boss.
 * - c01_shrine: the hidden cave in Paozu Forest - Goku L2 gate, Grandpa Gohan's training tablet (Kamehameha), Fang.
 * - c01_hotspring: the mountain hot spring above Paozu Peaks (Videl's gift side quest) - Goku L4 gate, the Spring Serpent.
 */
registerMaps([
  {
    id: 'c01_dream', name: 'Nightmare', music: 'frieza', hostile: true, region: 'Mt. Paozu',
    tint: 'rgba(120,0,40,0.30)',
    legend: { '#': 'cliff', ',': 'darkGrass', '.': 'grass', 'd': 'dirt' },
    grid: [
      '######################',
      '#,,,,,,,,,,,,,,,,,,,,#',
      '#,,..,,,,,,,,,,,,..,,#',
      '#,.....,,,,,,,,.....,#',
      '#,.........dd.......,#',
      '#,......dddddddd....,#',
      '#,....dddddddddddd..,#',
      '#,....dddddddddddd..,#',
      '#,.....dddddddddd...,#',
      '#,......dddddddd....,#',
      '#,.........dd.......,#',
      '#,,.....,,,,,,.....,,#',
      '#,,,,,,,,,,,,,,,,,,,,#',
      '######################',
    ],
    props: [
      ['domeHouse', 8, 0.5], ['deadTree', 2, 1], ['deadTree', 17, 1.5], ['deadTree', 1, 9], ['deadTree', 18.5, 9.5],
      ['crater', 3, 6], ['crater', 15, 10.5], ['brokenPillar', 4, 2], ['brokenPillar', 16, 4.5], ['grassTuft', 12, 12],
    ],
    objects: [
      { type: 'breakable', x: 4, y: 7, size: 1 },
      { type: 'breakable', x: 17, y: 7, size: 1 },
      { type: 'breakable', x: 7, y: 11, size: 1 },
    ],
  },
  {
    id: 'c01_shrine', name: 'Hidden Cave', music: 'cave', hostile: true, region: 'Mt. Paozu',
    tint: 'rgba(10,20,40,0.35)',
    legend: { '#': 'cliff', 'k': 'rock', 'd': 'dirt', 'M': 'marble', '~': 'water' },
    grid: [
      '##############################',
      '#########MMMMMMMMMMMM#########',
      '########MMMMMMMMMMMMMM########',
      '#######MMMMMMMMMMMMMMMM#######',
      '#######MMMMMMMMMMMMMMMM#######',
      '#######MMMMMMMMMMMMMMMM#######',
      '########MMMMMMMMMMMMMM########',
      '###########MMMMMMMM###########',
      '#############kkkk#############',
      '#############kkkk#############',
      '#############kkkk#############',
      '######kkkkkkkkkkkkkkkkk#######',
      '####kkkkkddkkkkkkkkkkkkkkk####',
      '###kkkkdddddkkkkk~~~kkkkkkk###',
      '###kkkkkddkkkkkk~~~~~kkkkkk###',
      '###kkkkkkkkkkkkkk~~~kkkkkkkk##',
      '####kkkkkkkkkkkkkkkkkkkkkkk###',
      '######kkkkkkkkkkkkkkkkkkk#####',
      '#########kkkkkkkkkkkkk########',
      '############kkkkkk############',
      '############kkkkkk############',
      '############kkkkkk############',
    ],
    props: [
      ['c01_tablet', 14, 1], ['jar', 12, 3], ['jar', 17.2, 3], ['brokenPillar', 8, 3], ['brokenPillar', 21, 3],
      ['statue', 10, 1.4], ['statue', 18.5, 1.4], ['stoneArch', 12.5, 6.2],
      ['rock', 4, 15], ['boulder', 21, 15.2], ['grassTuft', 8, 13], ['grassTuft', 18, 17], ['smallRock', 11, 18], ['rock', 22, 11.2],
    ],
    enemies: [
      { type: 'caveBat', x: 8, y: 12 }, { type: 'caveBat', x: 20, y: 13 }, { type: 'caveBat', x: 14, y: 16 },
      { type: 'snake', x: 5, y: 13 }, { type: 'snake', x: 23, y: 15 },
    ],
    objects: [
      { type: 'save', x: 18, y: 11 },
      { type: 'breakable', x: 6, y: 14, size: 1 },
      { type: 'breakable', x: 24, y: 13, size: 2, item: 'pow1', id: 'c01_shrineRock' },
      { type: 'breakable', x: 19, y: 17, size: 1, look: 'jar' },
      { type: 'breakable', x: 10, y: 16, size: 1 },
    ],
    barriers: [{ id: 'c01_g2', x: 13, y: 9, w: 4, h: 1, level: 2, character: 'goku' }],
    warps: [{ x: 12, y: 21, w: 6, h: 1, to: 'paozu_forest', tx: HUB.paozuForest.caveArrive[0], ty: HUB.paozuForest.caveArrive[1], dir: 'down' }],
    triggers: [
      { id: 'c01_gateHint', x: 13, y: 10, w: 4, h: 1, script: 'c01_gate_hint', once: true },
      { id: 'c01_shrine', x: 13, y: 3, w: 4, h: 2, script: 'c01_shrine_pray', onAction: true },
      // After a lost bout Fang is still prowling: he pounces again when Goku heads back up to the tablet.
      { id: 'c01_fangAgain', x: 11, y: 2, w: 8, h: 3, script: 'c01_fang_fight', showIf: `c01_fangLost&quest:c01_tracks&!${SEALED}`, hideIf: 'c01_fangBeaten' },
    ],
  },
  {
    id: 'c01_hotspring', name: 'Mountain Hot Spring', music: 'field', hostile: true, region: 'Mt. Paozu',
    legend: { '#': 'cliff', 'k': 'rock', 'd': 'dirt', '.': 'grass', ',': 'darkGrass', '~': 'water', 's': 'sand' },
    grid: [
      '##################################',
      '######kkkkkkkk~~~~~~kkkkkkkk######',
      '#####kkkkkkkk~~~~~~~~kkkkkkkkk####',
      '####kkkkkkkk~~~~~~~~~~kkkkkkkkk###',
      '####kkkksskk~~~~~~~~~~kksskkkkk###',
      '####kkkkssssss~~~~~~sssssskkkk####',
      '#####kkkkssssssssssssssssskkk#####',
      '######kkkkkksssssssssskkkkkk######',
      '##########kkkkkkkkkkkkkk##########',
      '############kkkkkkkkkk############',
      '##############kkkkkk##############',
      '##############kkkkkk##############',
      '############kkkkdddkkk############',
      '##########kkkkdddddddkkkk#########',
      '########,,kkkdddddddddkkk,,#######',
      '######,,,,,kkdddddd...kkk,,,,#####',
      '#####,,,,......ddd.......,,,,,####',
      '#####,,,.........d.........,,,####',
      '####,,,..........d..........,,,###',
      '####,,,..........d..........,,,###',
      '#####,,..........d..........,,####',
      '######,,,........d........,,,#####',
      '########,,,,.....d.....,,,,#######',
      '############.....d.....###########',
    ],
    props: [
      ['c01_steam', 13, 1.5], ['c01_steam', 17, 2.6], ['c01_steam', 15, 4.2], ['c01_steam', 19, 1],
      ['boulder', 5, 3.5], ['rock', 25, 4.5], ['rock', 10, 12.5], ['boulder', 21, 12],
      ['pine', 5, 14.5], ['pine', 27, 15], ['pine', 6, 18], ['pine', 27.5, 19], ['tree', 8.5, 19.5], ['tree', 24, 20],
      ['flowers', 12, 18], ['flowers', 21, 17], ['grassTuft', 9, 16], ['grassTuft', 23, 21], ['smallRock', 14, 20],
    ],
    enemies: [
      { type: 'wolf', x: 10, y: 17 }, { type: 'wolf', x: 23, y: 18 }, { type: 'snake', x: 8, y: 19 },
      { type: 'snake', x: 26, y: 16 }, { type: 'hawk', x: 17, y: 15 },
    ],
    objects: [
      { type: 'save', x: 17, y: 13 },
      { type: 'sign', x: 15, y: 22, text: 'Old trail to the hot spring. The water is said to make you ten years younger. The serpent is said to make you ten years dead.' },
      { type: 'chest', x: 26, y: 6, id: 'c01_hs_cap', item: 'end1' },
      { type: 'breakable', x: 9, y: 18, size: 2 },
      { type: 'breakable', x: 25, y: 19, size: 1 },
      { type: 'breakable', x: 12, y: 15, size: 1 },
    ],
    barriers: [{ id: 'c01_g4', x: 14, y: 10, w: 6, h: 1, level: 4, character: 'goku' }],
    warps: [{ x: 12, y: 23, w: 11, h: 1, to: 'paozu_peaks', tx: HUB.paozuPeaks.springArrive[0], ty: HUB.paozuPeaks.springArrive[1], dir: 'down' }],
    triggers: [
      { id: 'c01_g4Hint', x: 14, y: 11, w: 6, h: 1, script: 'c01_g4_hint', once: true },
      { id: 'c01_spring', x: 11, y: 6, w: 12, h: 2, script: 'c01_spring', showIf: `quest:c01_gift&char:goku&!${SEALED}`, hideIf: 'c01_serpentBeaten' },
    ],
  },
]);
