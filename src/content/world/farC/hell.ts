import type { EnemySpawn } from '../../../game/mapdef';
import { registerMaps } from '../../registry';

/**
 * Hell: a lava lake under a red sky. Frieza's golden cocoon sits on the island in the middle of the lake
 * (reached by flight circle). Fire bats before Ch13; Inferno Bats and Lava Oozes from Ch13 (Frieza's recruitment).
 */

const spawn = (type: string, x: number, y: number, showIf: string): EnemySpawn => ({ type, x, y, showIf });
const EARLY = 'chapter<13';
const LATE = 'chapter>=13';

registerMaps([
  {
    id: 'hell_lake', name: 'Hell', music: 'tense', hostile: true, region: 'Hell', tint: 'rgba(120,20,0,0.12)',
    legend: { '#': 'cliff', 'h': 'hellRock', 'k': 'rock', 'L': 'lava' },
    grid: [
      '############################################',
      '#h#####hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh#hhhh##',
      '########hhhhhhhhhhhkkhhhhhhhhhhhhhhh########',
      '########hhhhhhhhhhhhkhhhhhhhhhhhhhhh########',
      '########hhhhhhhLhhhLLLhLLLLhhhhhhhhhh#######',
      '########hhhhhhLLLLLLLLLLLLLLhhLhhhhh########',
      '#######hhhhhhLLLLLLLLLLhLLLLLLLLLhhh########',
      '#######hhhhhLLLLLLLhhhhhhLLLLLLLLhhhhhh###h#',
      '##h##hhhhhkLLLLLLLLhhhhhhhLLLLLLLLhhhhhhhhh#',
      '##hhhhhhhhkhLLLLLLLhhhhhhhLLLLLLhhhhhhhhhhh#',
      '#hhhhhhhhhhhLLLLLLLhhhhhhLLLLLLLLLhhhhhhhhh#',
      '#hhhhhhhhhhhhhLLLLLLLLhLLLLLLLLLhhhhhhhhhhh#',
      '#hhhhhhhhhhhhLLLLLLLLLLLLLLLLLLLLhhhhhhhhhh#',
      '#hhhhhhhhhhhhhLLLLLLLLLLLLLLLhLLLLhhhhhhhhh#',
      '#hhhhhhhkkhhhhhhhhhhLLLhhhhhhhhhLLhhhhhhhhh#',
      '#hhhhhhhhhhhhhhhhhhLLLLhhhhhhhhhLLLhhhhhhhh#',
      '#hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhLLhhLLLLhh#',
      '##hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhLLLLLLLLLh#',
      '###hhhhhkkhhhhhhhhhhhhhhhhhhhhhhkhLLLkkkkLL#',
      '####hhhhhkkkkkhhhhhhhhhhhhhhhhhhkkLLLkkkkLL#',
      '######hhkkkkkhhhhhhhhhhhhhhhhhhhhLLLLLLLLL##',
      '######hhkkkkkhhhhhhhhhhhhhhhhhhhhLLhhLLLL###',
      '######hhkkhhhhhhhhhhhhhhhhhhhhhkhLLhhhh#####',
      '#####hhhhhhhhhhhhhhkhkkhhhhhhhhkhLLLhh######',
      '#####hhhhhhhhhhhkkkkkkkkkkhhhhhhhhLLLhh#####',
      '#####hhhhhhhhhhhkkkkkkkkkhhhhhhhhhLLLh######',
      '#####hhhhhhhhhhhhkkkkkkkhhhhhhhhhhhLLLh#####',
      '###hhhhhhhhhhhhhhhhhhkkhhhhhhhhhhhhLLL######',
      '#h#hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhLLL#####',
      '#####################################LL#####',
    ],
    props: [
      // The cocoon (island, centre of the lava lake).
      ['fc_cocoon', 21, 6],
      // The stuffed animals and their endless, cheerful song: Frieza's eternal punishment.
      ['fc_teddy', 19.4, 7.4], ['fc_teddy', 24.4, 7.6], ['fc_teddy', 19.6, 9.2], ['fc_teddy', 18.6, 16.4], ['fc_teddy', 24, 16.6],
      ['fc_smoke', 9, 4], ['fc_smoke', 31, 1.5], ['fc_smoke', 36, 10.5],
      // Scorched dead trees and old graves along the shore.
      ['deadTree', 4.5, 9.6], ['deadTree', 9.5, 15], ['deadTree', 28, 16.4], ['deadTree', 13.5, 21.2], ['deadTree', 30.5, 23.4], ['deadTree', 38.5, 7.4],
      ['grave', 6, 13], ['grave', 8, 13.2], ['grave', 7, 15.6], ['grave', 25, 20], ['grave', 27.2, 20.4],
      ['boulder', 3.4, 17.6], ['rock', 37, 11.4], ['rock', 12, 3], ['smallRock', 24, 15], ['smallRock', 18, 19], ['crater', 9, 23],
    ],
    enemies: [
      spawn('fireBat', 10, 6, EARLY), spawn('fireBat', 34, 8, EARLY), spawn('fireBat', 14, 18, EARLY), spawn('fireBat', 28, 22, EARLY),
      spawn('fc_hellBat', 10, 6, LATE), spawn('fc_hellBat', 34, 8, LATE), spawn('fc_hellBat', 28, 22, LATE),
      spawn('fc_lavaOoze', 14, 18, LATE), spawn('fc_lavaOoze', 38, 14, LATE),
    ],
    objects: [
      { type: 'save', x: 17, y: 24 },
      { type: 'worldSign', x: 24, y: 24 },
      { type: 'sign', x: 26, y: 26, text: 'WELCOME TO HELL. Keep to the path. Do not feed the lava. Complaints to King Yemma\'s office, 3rd cloud on the left.' },
      { type: 'flight', x: 21, y: 16, to: 'hell_lake', tx: 20, ty: 10, label: 'Cocoon island' },
      { type: 'flight', x: 24, y: 10, to: 'hell_lake', tx: 22, ty: 17, label: 'Shore' },
      { type: 'flight', x: 39, y: 15, to: 'hell_lake', tx: 38, ty: 18, label: 'Islet' },
      { type: 'flight', x: 40, y: 18, to: 'hell_lake', tx: 39, ty: 14, label: 'Shore' },
      { type: 'chest', x: 37, y: 18, id: 'fc_cap_hell_1', item: 'pow5' },
      { type: 'breakable', x: 7, y: 18, size: 3 },
      { type: 'breakable', x: 30, y: 15, size: 2 },
      { type: 'breakable', x: 12, y: 25, size: 1 },
      { type: 'breakable', x: 33, y: 5, size: 2, item: 'end1', id: 'fc_brk_hell_1' },
    ],
  },
]);
