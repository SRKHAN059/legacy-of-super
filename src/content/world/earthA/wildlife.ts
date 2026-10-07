import { registerCreatures } from '../../creatures';
import { registerEnemies } from '../../enemies';

/**
 * Region-only wildlife for world/earthA.
 * - ea_tideSlime: Turtle Reef's inner-flats slime, the step between the Paozu river's Bog Slime and the Mud Golem
 *   (LoG2's Eggbot 37, a Northern Mountains foe for its L22 Piccolo, which now lives on the reef's outer atoll behind
 *   the Gohan L25 gate). The flats open after Chapter 2, so the Goku of Chapter 3 (about L11, Super Saiyan) meets it:
 *   a T2 exploder that dies in 3-4 hits and needs 13 of its own to knock him out (12 bursts: max(STR, POW) x1.1
 *   within 32 px). It is worth what the golems paid on the flats, so a reef clear still lifts him a level.
 */
registerCreatures({
  ea_tideSlime: { kind: 'blob', body: '#3a9e9a', size: 24 },
});

registerEnemies([
  {
    id: 'ea_tideSlime', name: 'Tide Slime', sprite: 'ea_tideSlime', hp: 170, str: 11, pow: 12, end: 10, exp: 150, ai: 'exploder', speed: 0.9,
    desc: 'Sea foam and kelp that came alive at low tide. Bursts like a soap bubble when beaten. Step back.',
  },
]);
