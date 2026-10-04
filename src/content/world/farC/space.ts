import type { EnemySpawn, PropPlacement } from '../../../game/mapdef';
import { registerMaps } from '../../registry';

/**
 * Space hubs (world 'space'): King Kai's planet, Beerus's planet (+ palace interior), the Sacred World of the Kais
 * in Universe 10, and Zeno's palace. Each floats in the void (`backdrop` paints the space between tiles).
 */

const spawn = (type: string, x: number, y: number, showIf: string): EnemySpawn => ({ type, x, y, showIf });
const BEERUS_EARLY = 'chapter>=4&chapter<7';
const BEERUS_LATE = 'chapter>=7';

/** A grid of pillars (Zeno's endless colonnade). */
function pillarRows(xs: number[], ys: number[]): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (const y of ys) for (const x of xs) out.push(['pillar', x, y]);
  return out;
}

registerMaps([
  // ------------------------------------------------------------------ King Kai's planet
  {
    id: 'kingkai_planet', name: 'King Kai\'s Planet', music: 'peaceful', region: 'King Kai\'s Planet', backdrop: '#05050f',
    legend: { 'v': 'void', '.': 'grass', ',': 'darkGrass', 'p': 'path' },
    grid: [
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvv,,,,vvvvvvvvvvvvvvv',
      'vvvvvvvvvvvv,,,,,,,,,,vvvvvvvvvvvv',
      'vvvvvvvvvv,,,........,,,vvvvvvvvvv',
      'vvvvvvvvv,,............,,vvvvvvvvv',
      'vvvvvvvv,,..............,,vvvvvvvv',
      'vvvvvvv,,....pppppppp....,,vvvvvvv',
      'vvvvvv,,...pppp....pppp...,,vvvvvv',
      'vvvvvv,,..ppp........ppp..,,vvvvvv',
      'vvvvvv,...pp..........pp...,vvvvvv',
      'vvvvvv,..pp............pp..,vvvvvv',
      'vvvvv,,..pp.....p......pp..,,vvvvv',
      'vvvvv,,..pp.....p......pp..,,vvvvv',
      'vvvvvv,..pp.....p......pp..,vvvvvv',
      'vvvvvv,..pp.....p......pp..,vvvvvv',
      'vvvvvv,,..pp....p.....pp..,,vvvvvv',
      'vvvvvv,,..ppp...p....ppp..,,vvvvvv',
      'vvvvvvv,,..pppp.p..pppp..,,vvvvvvv',
      'vvvvvvvv,,...pppppppp...,,vvvvvvvv',
      'vvvvvvvvv,,............,,vvvvvvvvv',
      'vvvvvvvvvv,,,........,,,vvvvvvvvvv',
      'vvvvvvvvvvvv,,,,,,,,,,vvvvvvvvvvvv',
      'vvvvvvvvvvvvvvv,,,,vvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    ],
    props: [
      // King Kai's dome house, his beloved car, the fruit trees and the well.
      ['domeHouse', 14.5, 9], ['car', 19.2, 11.2], ['well', 20.6, 14.6],
      ['tree', 12, 12.6], ['tree', 26, 8.6], ['tree', 5.4, 10.4],
      ['flowers', 12.5, 5], ['flowers', 20, 21], ['flowers', 7, 16], ['grassTuft', 24, 17], ['grassTuft', 10, 6], ['bush', 22.5, 4.5],
      ['mailbox', 18.4, 12.2],
    ],
    objects: [
      { type: 'save', x: 19, y: 21 },
      { type: 'worldSign', x: 13, y: 21 },
      { type: 'sign', x: 22, y: 20, text: 'KING KAI\'S PLANET. Gravity: 10x Earth. Entry fee: one (1) good joke. Puns accepted.' },
    ],
    pickups: [{ id: 'del_kingkai_planet_1', item: 'delicacy', x: 15, y: 8, hidden: true }],
  },

  // ------------------------------------------------------------------ Beerus's planet
  {
    id: 'beerus_grounds', name: 'Beerus\'s Planet', music: 'godly', hostile: true, region: 'Beerus\'s Planet', backdrop: '#1a0c30',
    legend: { 'v': 'void', 'g': 'alienGrass', 'k': 'rock', 'M': 'marble', 'p': 'path', 's': 'sand', '~': 'water', 'D': 'deep' },
    grid: [
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvggggggggkgkkkkkkkkkvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvggggggggkgkggggggkvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvkggggggggggggggggkgvvvvvvvvvvvvv',
      'vvvvvvvvvkkkvvkgggggggggggggggggkkvvvvvvvvvvvv',
      'vvvvvvvvgkkkkvkggggggggggggggggggkvvvvvvvvvvvv',
      'vvvvvvvvkgggkkkgggggggggggggggggggvgvvvvvvvvvv',
      'vvvvvvkkkgggggggggggggMMMggggggggggsssvvvvvvvv',
      'vvvvvvggggggggggggggggMMMggggggggggs~~~vvvvvvv',
      'vvvvgvkgggggggggggggggMMMgggggggggs~~~~~vvvvvv',
      'vvvgvkkgggggggggggggggMMMgggggggggss~~~svvvvvv',
      'vvvgkggggggggkggMMMMMMMMMMMMMMMgggggsssgggvvvv',
      'vgvvkggggggggkggMMMMMMMMMMMMMMMggggggggggvgvvv',
      'vgkkkgggggggggggMMMMMMMMMMMMMMMgggggggggkkgvvv',
      'vkkkggggggggggggMMMMMMMMMMMMMMMggggggggggkvvvv',
      'vkggggggggggggggMMMMMMMMMMMMMMMggggggggggkkggv',
      'vkkkggggggggggggMMMMMMMMMMMMMMMgggkkkkggggggvv',
      'vvvkkkggggggggggMMMMMMMMMMMMMMMgggkkkkgggggkkv',
      'vvvvvkgsgsssssssggggggggggppggggggkkkkkkkggkvv',
      'vvgkkkggsss~~~~~ssgggggggkgpppggggkkkkkkkggkkv',
      'vvvgkgs~~~~~~~~~~~~ggggggkkpppgkkkkkkkkkkkkgvv',
      'vvvvs~~~~~DDDD~~~~~sgggggggppggkkkkkkkkkkkgvvv',
      'vvkk~~~~DDDDDDDD~~~~sggggggggpgpkkkkkkkkkkvvvv',
      'vvkg~~~~DDsssDDD~~~gggggggggggpggggkkkkkkvvvvv',
      'vvkks~~~DDsssDDD~~~~gggggggggppppggkkkkkkgvvvv',
      'vvvkss~~DDDDDDDD~~~~gggggggggppgggggggggkvvvvv',
      'vgkksss~~~DDDD~~~~~~sggggggggppppgggggkkkvvvvv',
      'vvvkkgs~~~~~~~~~~~~sggggggggppppppgkkkkvvvvvvv',
      'vvvvvkkkss~~sss~ssggggggggggppppppkgkgvvvvvvvv',
      'vvvvvvvkgg~skkkksgggggggggggggpgpkkvvvvvvvvvvv',
      'vvvvvvvvvgggvvvkkgggggggggggkkgvvvvvvvvvvvvvvv',
      'vvvvvvvvggvvvvvvkkkkgggkkggggvvgvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvggvgvvggggvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    ],
    props: [
      // The pyramid palace on the planet's crown; its door faces the marble avenue.
      ['pyramid', 19.5, 1],
      // Whis's training yard: a marble court ringed by pillars.
      ['pillar', 16, 8.6], ['pillar', 30, 8.6], ['pillar', 16, 15.2], ['pillar', 30, 15.2],
      // Alien woods.
      ['alienTree', 7, 6.4], ['alienTree', 10.5, 10.5], ['alienTree', 3.5, 12.8], ['alienTree', 12.5, 3.8], ['alienTree', 30, 2.6],
      ['alienTree', 35, 11.4], ['alienTree', 40.5, 13.4], ['alienTree', 22, 25], ['alienTree', 25.5, 28.2], ['alienTree', 17, 28.6],
      ['bush', 14, 8], ['bush', 32, 6.2], ['flowers', 9, 8], ['flowers', 27, 20], ['flowers', 20, 19],
      // Strange floating rocks and boulders to the east.
      ['floatingRock', 36, 17.4], ['floatingRock', 33, 23], ['boulder', 38.4, 21.2], ['rock', 37, 25], ['smallRock', 41, 18], ['smallRock', 34, 20],
      // Hot spring rocks.
      ['rock', 34, 7.4], ['smallRock', 38.5, 11],
    ],
    npcs: [
      { id: 'fc_oracleFish', sprite: 'alienFish', x: 18, y: 21, dir: 'right', talk: 'fc_talk_oracle', name: 'Oracle Fish', showIf: 'chapter>=4' },
    ],
    enemies: [
      spawn('fc_puffbird', 10, 9, BEERUS_EARLY), spawn('fc_puffbird', 33, 19, BEERUS_EARLY), spawn('fc_mossBeast', 8, 16, BEERUS_EARLY),
      spawn('fc_mossBeast', 27, 23, BEERUS_EARLY), spawn('fc_lakeCrab', 21, 23, BEERUS_EARLY), spawn('fc_lakeCrab', 5, 18, BEERUS_EARLY),
      spawn('fc_starWasp', 10, 9, BEERUS_LATE), spawn('fc_starWasp', 37, 21, BEERUS_LATE), spawn('fc_hornBeast', 9, 16, BEERUS_LATE),
      spawn('fc_hornBeast', 26, 22, BEERUS_LATE), spawn('fc_lakeCrab', 21, 23, BEERUS_LATE),
    ],
    objects: [
      { type: 'save', x: 32, y: 26 },
      { type: 'worldSign', x: 28, y: 26 },
      { type: 'sign', x: 21, y: 8, text: 'Lord Beerus is sleeping. Kindly knock quietly. Better yet, do not knock at all. - Whis' },
      { type: 'flight', x: 20, y: 23, to: 'beerus_grounds', tx: 11, ty: 23, label: 'Islet' },
      { type: 'flight', x: 12, y: 24, to: 'beerus_grounds', tx: 21, ty: 24, label: 'Shore' },
      { type: 'chest', x: 40, y: 19, id: 'fc_cap_beerus_1', item: 'end3' },
      { type: 'breakable', x: 8, y: 11, size: 2 },
      { type: 'breakable', x: 35, y: 16, size: 2, item: 'pow1', id: 'fc_brk_beerus_1' },
      { type: 'breakable', x: 21, y: 29, size: 1 },
      { type: 'breakable', x: 41, y: 16, size: 3 },
    ],
    pickups: [{ id: 'del_beerus_grounds_1', item: 'delicacy', x: 10, y: 23 }],
    warps: [{ x: 23, y: 6, w: 1, h: 1, to: 'beerus_palace_in', tx: 9.5, ty: 11, dir: 'up', door: true }],
  },

  // ------------------------------------------------------------------ Inside the pyramid
  {
    id: 'beerus_palace_in', name: 'Beerus\'s Palace', music: 'godly', indoor: true, region: 'Beerus\'s Planet',
    legend: { 'W': 'wall', 'M': 'marble', 'c': 'carpet' },
    grid: [
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWW',
      'WMMMMMMccccccMMMMMMW',
      'WMMMMMMccccccMMMMMMW',
      'WMMMMMMccccccMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WMMMMMMMMccMMMMMMMMW',
      'WWWWWWWWWMMWWWWWWWWW',
    ],
    props: [
      ['throne', 9, 3],
      ['fc_godBed', 1, 3], ['plant', 4.5, 3.2],
      ['table', 14, 6], ['table', 16, 6], ['chair', 14.6, 4.9], ['chair', 16.6, 4.9], ['chair', 14.6, 7.6], ['chair', 16.6, 7.6],
      ['pillar', 7, 6], ['pillar', 12, 6], ['pillar', 7, 9.6], ['pillar', 12, 9.6],
      ['bookshelf', 1, 8.6], ['plant', 1.2, 11], ['plant', 17.8, 11], ['jar', 18, 3.4], ['barrel', 17, 3.4],
    ],
    objects: [{ type: 'chest', x: 17, y: 10, id: 'del_beerus_palace_in_1', item: 'delicacy' }],
    warps: [{ x: 9, y: 13, w: 2, h: 1, to: 'beerus_grounds', tx: 23, ty: 7.2, dir: 'down', door: true }],
  },

  // ------------------------------------------------------------------ Sacred World of the Kais, Universe 10
  {
    id: 'u10_sacred', name: 'Sacred World of the Kais (U10)', music: 'godly', region: 'Sacred World (U10)', backdrop: '#0c1830',
    legend: { 'v': 'void', 'g': 'grass', '.': 'darkGrass', ',': 'alienGrass', 'M': 'marble', '~': 'water', 'D': 'deep' },
    grid: [
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv..ggg.vvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv.ggggg...vvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvMMMMMMMMMMMMMMvvvvvvvvvvvvv',
      'vvvvvvv......MMMMMMMMMMMMMM..vvvvvvvvvvv',
      'vvvvv..ggggggMMMMMMMMMMMMMMgg..v.vvvvvvv',
      'vvvvv.gggggggMMMMMMMMMMMMMMgggg.g..vvvvv',
      'vvv..ggggggggMMMMMMMMMMMMMMgggggg..vvvvv',
      'vv.ggggggggggMMMMMMMMMMMMMM.ggggggg...vv',
      'vv.ggggg.g.ggggggggMMM.gggggg.ggg,,gg.vv',
      'vv...ggggggggggggg.MMMggggggg,,,,,,,gg.v',
      'vvvvv.g~~~ggggMMMMMMMMMMMMMg,,,,,,,,gggv',
      'vvvv.~~~~~~gggMMMMMMMMMMMMM,,,,,,,,,,g.v',
      'vvvv.~~DD~~~ggMMMMMMMMMMMMMg,,,,,,,,gg.v',
      'vvv.~~DDDD~~ggMMMMMMMMMMMMM.,,,,,,,,,g.v',
      'vvv..~~DD~~gggMMMMMMMMMMMMMg,,,,,,,,,ggv',
      'vvvvv~~~~~ggggMMMMMMMMMMMMMggg,,,,ggg..v',
      'vvvv.gg~ggggggMMMMMMMMMMMMMggggggggg.vvv',
      'vvv.ggggggg.gg.ggggMMMgggg.gggggg.g.v.vv',
      'vv.ggggg.gg.ggg.gg.MMMggg.g.ggggggg..vvv',
      'vv.gg...gggggggggg.MMMggggg.gg,ggg.v.vvv',
      'vvv..ggggggggggggggMMMgggggg,,,,,,.vvvvv',
      'vvvvv.g.gggggggggggMMMggggg,,,,,,,vvvvvv',
      'vvvv.gggggggggg.gggMMMgggggg,,,,vvvvvvvv',
      'vvvvv.ggggggg.gg.g.MMM.gggggg.v.vvvvvvvv',
      'vvvvvv...ggg.gggMMMMMMMMMggg...vvvvvvvvv',
      'vvvvvvvvv....gggMMMMMMMMM...vvvvvvvvvvvv',
      'vvvvvvvvvvvvv...MMMMMMMMMvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv....g.vvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    ],
    props: [
      // Gowasu's temple on the north plaza.
      ['fc_kaiTemple', 17.5, 2], ['pillar', 13.2, 4.6], ['pillar', 25.8, 4.6], ['plant', 15, 6.6], ['plant', 24.2, 6.6],
      // Tea terrace: the table where Gowasu and Zamasu take their tea.
      ['table', 19, 13], ['chair', 18.1, 13], ['chair', 21.1, 13], ['plant', 14.2, 11.2], ['plant', 25.8, 11.2],
      // Pillared approach from the landing.
      ['pillar', 18, 18.6], ['pillar', 22, 18.6], ['pillar', 18, 22.6], ['pillar', 22, 22.6],
      // Garden (east): the Potara tree and the Time Ring shrine, among alien flowers.
      ['fc_potaraTree', 29, 10.4], ['shrine', 32.5, 8.4], ['flowers', 28, 15], ['flowers', 32, 14], ['flowers', 34, 12],
      ['flowers', 29, 21], ['flowers', 31, 22], ['flowers', 33, 16], ['bush', 35, 15.4], ['alienTree', 33.5, 18.6],
      // Orchard and pond edge (west).
      ['tree', 8, 4.4], ['tree', 3.6, 7], ['pine', 5, 16.4], ['tree', 9.4, 19.4], ['tree', 13, 21.6], ['pine', 11, 6.2],
      ['tree', 27.5, 4.4], ['tree', 25, 22.4], ['bush', 11.5, 10], ['flowers', 6, 10], ['flowers', 12, 17], ['grassTuft', 4, 12],
    ],
    objects: [
      { type: 'save', x: 23, y: 26 },
      { type: 'worldSign', x: 17, y: 26 },
    ],
    pickups: [{ id: 'del_u10_sacred_1', item: 'delicacy', x: 31, y: 15 }],
  },

  // ------------------------------------------------------------------ Zeno's palace
  {
    id: 'zeno_palace', name: 'Zeno\'s Palace', music: 'space', region: 'Zeno\'s Palace', backdrop: '#180838',
    legend: { 'v': 'void', 'M': 'marble', 'c': 'carpet', 'C': 'cloud' },
    grid: [
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvMMMMMMMMMMMccccccccccMMMMMMMMMMMvvvv',
      'vvvvMMMMMMMMMMMccccccccccMMMMMMMMMMMvvvv',
      'vvvvMMMMMMMMMMMccccccccccMMMMMMMMMMMvvvv',
      'vMMMMMMMMMMMMMMccccccccccMMMMMMMMMMMMMMv',
      'vMMMMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMMMMv',
      'vMMMMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMMMMv',
      'vMMMMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMMMMv',
      'vMMMMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMMMMv',
      'vvvvMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMvvvv',
      'vvvvMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMvvvv',
      'vvvvMMMMMMMMMMMMMMccccMMMMMMMMMMMMMMvvvv',
      'vvvvvvvvvvvvvvvvvvMccMvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvMccMvvvMvvvvvvvvvvvvvv',
      'vvvvvvvvvMvvvvvvvvMccMvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvMMvvvvvvvvMccMvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvMMvvvvvvvvMccMvvvvvvvvMvvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvMccMvvvvvvvMMMvvvvvvvv',
      'vvvvvvvvvvvvMvvvvvMccMvvvvvvvMMMvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvMccMvvvvvvvvvvvvvvvvvv',
      'vvvvvMMvvvvvvvvvvvMccMvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvvCCMccMCCvvvvvvvvvMMvvvvv',
      'vvvvvvvvvvvvvCCCCCMccMCCCvCvCvvvvMMvvvvv',
      'vvvvvvvvvCCCCMMMMMMMMMMMMMMCCCvvvvvvvvvv',
      'vvvvvvvvCCCCMMMMMMMMMMMMMMMMCCCvvvvvvvvv',
      'vvvvvvvvvCCCMMMMMMMMMMMMMMMMCCCCvvvvvvvv',
      'vvvvvvvCCCCCMMMMMMMMMMMMMMMMCCCvCvvvvvvv',
      'vvvvvvvvCCCCCMMMMMMMMMMMMMMCCCvCvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    ],
    props: [
      ['throne', 19, 2],
      // Endless white pillars, three ranks on each side of the throne.
      ...pillarRows([5, 9, 13, 26, 30, 34], [1.6, 5.4, 9.4]),
      // Golden glyphs set into the floor along the approach to the throne.
      ['fc_glowTile', 15.5, 6.4], ['fc_glowTile', 22.5, 6.4], ['fc_glowTile', 15.5, 10], ['fc_glowTile', 22.5, 10], ['fc_glowTile', 19, 25.2],
      // A universe gate in the west wing.
      ['portal', 1.2, 5.2],
      // Lanterns along the approach.
      ['lamp', 18.1, 14.4], ['lamp', 21.3, 14.4], ['lamp', 18.1, 18.4], ['lamp', 21.3, 18.4], ['lamp', 18.1, 22.2], ['lamp', 21.3, 22.2],
      ['stoneArch', 18.5, 10.6],
    ],
    objects: [
      { type: 'save', x: 24, y: 25 },
      { type: 'worldSign', x: 15, y: 25 },
      { type: 'chest', x: 37, y: 7, id: 'del_zeno_palace_1', item: 'delicacy' },
    ],
  },
]);
