import { registerCreatures } from '../../creatures';
import { registerEnemies } from '../../enemies';

/**
 * Region-only wildlife for world/earthB.
 * - eb_trihorn: the Snowy Highlands dino park's LoG2 Triceratops (ROM stat entry 54: 870 HP, STR/END 40, 35,000 EXP,
 *   charger). Fragile for its tier and worth a fortune, which is what made LoG2's Goku-40 park the grinding spot.
 */
registerCreatures({
  eb_trihorn: { kind: 'quadruped', body: '#7a9050', belly: '#d8d0a0', accent: '#4a5a30', horns: true, stripes: true, size: 40 },
});

registerEnemies([
  {
    id: 'eb_trihorn', name: 'Trihorn', sprite: 'eb_trihorn', hp: 870, str: 40, pow: 1, end: 40, exp: 35000, ai: 'charger', speed: 1.0,
    box: { w: 20, h: 10 },
    desc: 'A three-horned plant-eater from the hot-spring valley. Placid, until something comes between it and the herd.',
  },
]);
