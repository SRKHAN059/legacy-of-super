import { registerEnemies, type EnemyDef } from '../../enemies';
import { registerItems } from '../../items';
import { registerQuests } from '../../quests';

/**
 * Items, journal entries and the Earth's core bestiary for the two late Days of Peace episodes: "Whose Wish?"
 * (anime ep 68) and the Universe 6 vs. Universe 7 baseball game (ep 70).
 */

registerItems([
  { id: 'c12_coreAlloy', name: 'Core Alloy', kind: 'key', max: 1, desc: 'Metal grown in the white heat of the Earth\'s heart. Bulma wants it for a "hobby". It hums.', use: null, icon: { shape: 'star', color: '#b878e0', color2: '#f8e070' } },
  { id: 'c12_gameBall', name: 'Winning-Run Ball', kind: 'key', max: 1, desc: 'The ball from Universe 7\'s walk-off win over Universe 6, signed by Yamcha. He signed it twice.', use: null, icon: { shape: 'ball', color: '#f4f4f0', color2: '#d03030' } },
]);

registerQuests([
  {
    id: 'c12_wish', title: 'Whose wish?', star: 'silver', region: 'spot_westcity',
    desc: 'King Kai is still dead. Gather the seven Dragon Balls (the Dragon Radar marks them on the R map), dive to the Earth\'s core in Bulma\'s drill pod for the metal she wants, then bring it all back to Capsule Corp to summon Shenron.',
  },
  {
    id: 'c12_ball', title: 'Universe 6 vs. Universe 7: baseball', star: 'silver', region: 'spot_westcity',
    desc: 'Champa has challenged Beerus to a baseball game for the right to Earth\'s food. Anything goes, except destruction. Yamcha is the only player on Universe 7 who knows the rules.',
  },
]);

/**
 * The Earth's core bestiary. Regular enemies follow the round-2 critic's grind band rather than the old T6 row of
 * Guide §6: 6-8 hits to kill and 16-18 hits to knock out Goku in Super Saiyan Blue at the Chapter 12 floor (L35, about
 * STR 70-72, END 63-65, 740-800 HP; 6-7 and 21 at L37), so the mantle tunnels are a place to level, not a Senzu sink:
 * the fair bot clears all nine of them with the heat running, without a knock-out and on at most one Senzu
 * (tests/balance.test.ts, at L37 and at the L35 floor).
 */
const CORE: EnemyDef[] = [
  { id: 'c12_magmaSlime', name: 'Magma Slime', sprite: 'c12_magmaSlime', hp: 1150, str: 38, pow: 38, end: 40, exp: 26000, ai: 'exploder', speed: 1.0, drops: 'rich', desc: 'A blob of living lava. It bursts when beaten, so do not stand next to it.' },
  { id: 'c12_cinderBat', name: 'Cinder Bat', sprite: 'c12_cinderBat', hp: 1100, str: 38, pow: 1, end: 38, exp: 24000, ai: 'flyer', speed: 1.5, flying: true, desc: 'Roosts over the lava rivers and dives at anything that glows. Goku glows.' },
  { id: 'c12_crustCrab', name: 'Crust Crab', sprite: 'c12_crustCrab', hp: 1200, str: 38, pow: 1, end: 44, exp: 30000, ai: 'charger', speed: 1.1, box: { w: 20, h: 10 }, desc: 'Its shell is cooled basalt. It charges sideways, which is somehow worse.' },
  { id: 'c12_lavaSerpent', name: 'Lava Serpent', sprite: 'c12_lavaSerpent', hp: 1250, str: 36, pow: 38, end: 40, exp: 28000, ai: 'shooter', speed: 0.9, shot: { color: '#f88020', cooldown: 90, speed: 2.4, mult: 0.7 }, desc: 'Spits globs of magma from the riverbanks.' },
  {
    // The heart's guardian. Tuned like Hit on the hotel roof (fair-play balance: Goku L37 in Super Saiyan Blue wins
    // with about one Senzu, hits ratio near 3) but must be beaten outright: nothing scripted ends it early.
    id: 'c12_mantleWyrm', name: 'Mantle Wyrm', sprite: 'c12_mantleWyrm', hp: 5000, str: 50, pow: 52, end: 58, exp: 120000, ai: 'boss', speed: 1.0,
    box: { w: 26, h: 12 }, desc: 'A serpent of the deep mantle, coiled around the core alloy for a million years. It does not share.',
    boss: {
      endAt: 0, kiColor: '#f88020', minion: 'c12_magmaSlime',
      phases: [
        { until: 0.7, moves: ['chase', 'shot', 'charge', 'shot'], rest: 50 },
        { until: 0.35, moves: ['rain', 'chase', 'volley', 'summon'], rest: 44, speed: 1.1, onStart: 'c12_wyrm_p2' },
        { until: 0, moves: ['charge', 'nova', 'rain', 'chase'], rest: 38, speed: 1.2, onStart: 'c12_wyrm_p3' },
      ],
    },
  },
];

registerEnemies(CORE);
