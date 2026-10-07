import { registerEnemies, type EnemyDef } from '../../enemies';
import { registerQuests } from '../../quests';
import { registerSpots } from '../../world';

/**
 * Chapter 13 side episodes, data: the Universe 6 Saiyans (eps 88-93) and Goku vs. Gohan (ep 90). Chapter 13
 * fights use the 37-44 boss band and T6 regulars; the post-game rematch on Sadala uses the 45-50 band and T7.
 */

const U6: EnemyDef[] = [
  // Caulifla's gang (the old quarter brawl, played as Cabba in base form): street toughs, a notch under the Defense
  // Force ace they jump. Five of them roam a big map and Cabba hits at half a Blue fighter's strength, so each goes
  // down in about fifteen hits and the slinger's blasts are light (fair-play balance: the brawl takes about a minute).
  { id: 'c13_gangPunk', name: 'Gang Punk', sprite: 'c13_gangPunk', hp: 1800, str: 44, pow: 1, end: 40, exp: 27000, ai: 'rusher', speed: 1.25, desc: 'One of Caulifla\'s street toughs. A Saiyan with a lot of energy and nothing to spend it on.' },
  { id: 'c13_gangBrute', name: 'Gang Bruiser', sprite: 'c13_gangBrute', hp: 2200, str: 48, pow: 1, end: 44, exp: 32000, ai: 'charger', speed: 1.1, box: { w: 16, h: 10 }, desc: 'The biggest member of Caulifla\'s gang. Charges first, thinks never.' },
  { id: 'c13_gangSlinger', name: 'Gang Slinger', sprite: 'c13_gangSlinger', hp: 1600, str: 42, pow: 48, end: 40, exp: 26000, ai: 'shooter', speed: 1.05, shot: { color: '#f070a0', cooldown: 120, speed: 2.7, mult: 0.4 }, desc: 'Throws ki blasts from behind the rubble of the old quarter.' },
  {
    id: 'c13_cauliflaSSJ', name: 'Caulifla (Super Saiyan)', sprite: 'c13_cauliflaSSJ', hp: 6800, str: 56, pow: 58, end: 60, exp: 150000, ai: 'boss', speed: 1.35,
    desc: 'Minutes into her first Super Saiyan and already wants to test it on her teacher. A natural.',
    boss: {
      // She runs out of stamina (ep 92): the spar stops a little past half, before a forced L39 Cabba is worn down.
      endAt: 0.55, kiColor: '#f8e048',
      phases: [
        { until: 0.78, moves: ['chase', 'dash', 'shot'], rest: 40 },
        { until: 0, moves: ['volley', 'beam', 'dash', 'nova', 'chase'], rest: 30, speed: 1.15, onStart: 'c13_caulifla_p2' },
      ],
    },
  },
  {
    // Nothing reaches her ("NO EFFECT" until Caulifla has calmed her, which ends the fight): survive, or get
    // Caulifla to step in.
    id: 'c13_kaleBerserk', name: 'Kale (Berserk)', sprite: 'c13_kaleBerserk', hp: 9000, str: 62, pow: 58, end: 68, exp: 0, ai: 'boss', speed: 1.15,
    desc: 'Kale\'s first Legendary Super Saiyan transformation. She hears nothing and stops for no one.',
    boss: {
      endAt: 0, kiColor: '#a0f060', vulnerableIf: 'c13_u6KaleCalmed',
      phases: [{ until: 0, moves: ['charge', 'chase', 'volley', 'rain', 'dash'], rest: 34, speed: 1.1 }],
    },
  },
];

const LEADER: EnemyDef[] = [
  {
    // Round one of the 2-on-2: Gohan guards Piccolo while he charges. The round ends when Piccolo fires.
    id: 'c13_gohanTag', name: 'Gohan', sprite: 'gohanUltimate', hp: 7400, str: 56, pow: 58, end: 62, exp: 0, ai: 'boss', speed: 1.3,
    desc: 'Gohan covering Piccolo while he charges. Teamwork first, punches second.',
    boss: { endAt: 0.6, kiColor: '#f0f0ff', phases: [{ until: 0, moves: ['guard', 'chase', 'shot', 'dash'], rest: 36 }] },
  },
  {
    id: 'c13_gohanUltimate', name: 'Ultimate Gohan', sprite: 'gohanUltimate', hp: 8200, str: 60, pow: 62, end: 64, exp: 200000, ai: 'boss', speed: 1.3,
    desc: 'Gohan with his hidden power drawn out again. Reads every move and holds nothing back.',
    boss: {
      endAt: 0.4, kiColor: '#f0f0ff',
      phases: [
        { until: 0.7, moves: ['chase', 'shot', 'dash', 'guard'], rest: 38 },
        { until: 0, moves: ['beam', 'volley', 'teleport', 'nova', 'chase'], rest: 28, speed: 1.2, onStart: 'c13_gohan_p2' },
      ],
    },
  },
];

const SADALA: EnemyDef[] = [
  // Post-game: the rematch in Caulifla's yard, and the wildlife of the crags.
  {
    id: 'c13_cauliflaRematch', name: 'Caulifla (Super Saiyan 2)', sprite: 'c13_cauliflaSSJ', hp: 9600, str: 70, pow: 74, end: 72, exp: 380000, ai: 'boss', speed: 1.45,
    desc: 'Caulifla at Super Saiyan 2, the form Goku showed her in the tournament. She has been practising.',
    boss: {
      endAt: 0.4, kiColor: '#f8e048',
      phases: [
        { until: 0.7, moves: ['chase', 'dash', 'volley'], rest: 30 },
        { until: 0, moves: ['beam', 'dash', 'nova', 'rain', 'teleport'], rest: 24, speed: 1.2, onStart: 'c13_rematch_p2' },
      ],
    },
  },
  { id: 'c13_kaleRematch', name: 'Kale (Legendary)', sprite: 'kaleLSSJ', hp: 6200, str: 72, pow: 1, end: 66, exp: 70000, ai: 'charger', speed: 1.25, box: { w: 16, h: 10 }, drops: 'rich', desc: 'Kale in a Legendary form she can control now. Mostly.' },
  // The crags' wildlife is a post-game grind spot on LoG2's late band (its Mushroom Cavern at L45): 7-8 hits to kill
  // and 16-19 to knock out the Goku L43-44 in Super Saiyan Blue who comes back after the credits, at LoG2's pace
  // there (about three fair-bot minutes a level).
  { id: 'c13_sadalaPtero', name: 'Crag Pterodactyl', sprite: 'c13_sadalaPtero', hp: 1800, str: 50, pow: 1, end: 42, exp: 26000, ai: 'flyer', speed: 1.5, flying: true, desc: 'Sadala\'s native pterodactyl. Nests on the red spires east of the old quarter.' },
  { id: 'c13_cragHound', name: 'Crag Hound', sprite: 'c13_cragHound', hp: 1850, str: 50, pow: 1, end: 46, exp: 28000, ai: 'rusher', speed: 1.45, desc: 'A rock-skinned hound of the Sadala badlands. Saiyan kids race them for fun.' },
];

registerEnemies([...U6, ...LEADER, ...SADALA]);

registerQuests([
  // The two Universe 6 cutaways open and close inside their own scripts, so their stars never point anywhere.
  { id: 'c13_u6', title: 'Meanwhile, in Universe 6', star: 'gold', region: 'c13_spot_sadala', desc: 'Universe 6 is short of fighters too. On the Saiyan planet Sadala, Cabba sets out to recruit his old captain\'s sister: the gang boss Caulifla.' },
  { id: 'c13_u6kale', title: 'A Legendary Super Saiyan', star: 'gold', region: 'c13_spot_sadala', desc: 'Cabba keeps his promise and teaches Caulifla to go Super Saiyan. Her shy protegee Kale watches from behind a rock, and Kale is not happy.' },
  { id: 'c13_leader', title: 'Goku vs. Gohan: the wall to overcome', star: 'silver', region: 'c13_spot_wilds', desc: 'Gohan is back at full power and wants to test it on the strongest people he knows: Goku and Tien, against him and Piccolo.' },
  { id: 'c13_sadala', title: 'A Saiyan rematch on Sadala', star: 'bronze', region: 'c13_spot_sadala', desc: 'Cabba brought word from Universe 6: Caulifla and Kale want a rematch with Universe 7\'s best. Fly to Sadala and find them in the old quarter.' },
]);

registerSpots([
  // Opened after the tournament by Cabba's visit to Capsule Corp (the Universe 6 Saiyans meet Goku in the tournament).
  { id: 'c13_spot_sadala', name: 'Sadala (U6)', world: 'space', x: 160, y: 46, map: 'c13_sadala_quarter', tx: 4, ty: 16, icon: 'planet', color: '#c88850' },
]);
