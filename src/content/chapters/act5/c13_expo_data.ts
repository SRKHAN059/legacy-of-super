import { registerCast } from '../../cast';
import { registerEnemies, type BossDef, type EnemyDef } from '../../enemies';
import { registerQuests } from '../../quests';
import { registerScanAliases, registerScans, SCANS, type ScanEntry } from '../../scans';

/**
 * The Zeno Expo (anime eps 78-82), data: Universe 9's gods and Basil's Danger Doping form, the scouter readings for
 * them, the three Trio de Dangers bouts and the Expo's journal entry. Scripts and fight mechanics: `c13_expo.ts`.
 *
 * Balance (fair-play bot, tests/balance.test.ts "Zeno Expo"): each bout is tuned for the fighter the story puts in
 * the ring at the level the story gives it (the Expo forces its fighters, lifting Goku from a story run's L37 and
 * Gohan from L19 to the Chapter 13 forced floor, L39), inside LoG2's story band (hits ratio 4 or less): Basil for Buu
 * (Goku's level and base stats under Buu's costume), Lavender for Super Saiyan Gohan, Bergamo for Super Saiyan Blue
 * Goku. Every bout ends at a scripted threshold, as the anime's matches do.
 */

const SKIN_KAI = '#a8b4e0';

registerCast({
  // Basil after swallowing Roh's mineral (ep 79): bulked up, fur darkened, eyes gone red.
  c13_basilDoped: { body: 'big', skin: '#8a5a3c', hair: 'catEars', hairColor: '#8a5a3c', accent: '#f0c0a0', eye: '#f04848', top: '#3060a0', topStyle: 'vest', under: '#8a5a3c', sleeves: 'none', pants: '#202030', boots: '#202030', wrist: '#f04848', face: 'stern' },
  // Roh, Supreme Kai of Universe 9: an old Kai with a nasty grin, in Universe 9's gold robes, white mohawk.
  c13_roh: { body: 'male', skin: SKIN_KAI, hair: 'mohawk', hairColor: '#f0f0f0', top: '#e0a830', topStyle: 'robe', under: '#283878', sleeves: 'none', belt: '#d04040', pants: '#f0f0f0', boots: '#283878', earring: '#58e080', ears: 'pointed', face: 'stern' },
  // Sidra, God of Destruction of Universe 9: a dwarfish, bark-brown god with a crown of green leaves.
  c13_sidra: { body: 'child', skin: '#c8884a', hair: 'spiky', hairColor: '#4a9a40', top: '#202028', topStyle: 'robe', under: '#e0c040', sleeves: 'none', belt: '#e0c040', pants: '#e0d8c0', boots: '#e0c040', wrist: '#e0c040', eye: '#e8e040', ears: 'pointed' },
  // Mojito, Universe 9's angel: an angel's halo and robes, shoulder-length white hair.
  c13_mojito: { body: 'male', skin: '#88b0d8', hair: 'bob', hairColor: '#f0f0f0', top: '#3a7a50', topStyle: 'robe', under: '#202028', sleeves: 'long', belt: '#f0f0f0', pants: '#202028', boots: '#f0f0f0', halo: '#4890e0', face: 'gentle' },
}, {
  c13_basilDoped: 'Basil', c13_roh: 'Roh', c13_sidra: 'Sidra', c13_mojito: 'Mojito',
});

const READINGS: Record<string, ScanEntry> = {
  c13_roh: { name: 'Roh', kind: 'U9 Supreme Kai', hp: 4600, str: 30, pow: 44, end: 36, desc: 'Supreme Kai of Universe 9. Loud, greedy and very proud of his "Trio de Dangers". Carries suspicious minerals.' },
  c13_sidra: { name: 'Sidra', kind: 'U9 God of Destruction', hp: '???', str: '???', pow: '???', end: '???', desc: 'God of Destruction of Universe 9. Sweats in front of Zeno and would cut any corner to keep his universe alive.' },
  c13_mojito: { name: 'Mojito', kind: 'U9 Angel', hp: '???', str: '???', pow: '???', end: '???', desc: 'Angel of Universe 9 and Sidra\'s attendant. Calm and polite, and far stronger than the god he serves.' },
};
registerScans(Object.fromEntries(Object.entries(READINGS).filter(([id]) => !SCANS[id])));
// Danger Doping wears off when the bout ends: the form files under Basil's own entry.
registerScanAliases({ c13_basilDoped: 'basil' });

/**
 * Basil vs. Majin Buu (ep 79). Phase two starts with his powered-up legs (the blast through Buu and the crossfire that
 * floors Mr. Satan), phase three with Roh's mineral (Danger Doping: `c13_basilDoped` swaps in, same phases).
 * Buu's bout pays no EXP: Goku's level and stats only stand in for Buu's.
 */
const BASIL_FIGHT: BossDef = {
  endAt: 0.15, kiColor: '#f8a040',
  phases: [
    { until: 0.7, moves: ['chase', 'dash', 'chase', 'shot'], rest: 40 },
    { until: 0.4, moves: ['dash', 'volley', 'chase', 'beam'], rest: 34, speed: 1.1, onStart: 'c13_basil_legs' },
    { until: 0, moves: ['charge', 'dash', 'volley', 'rain', 'chase'], rest: 32, onStart: 'c13_basil_dope' },
  ],
};

/**
 * Lavender vs. Gohan (ep 80). The toxic mist that blinds Gohan opens phase two; in phase three he takes to the air
 * (no footsteps to hear) and fights with ki. The bout stops at 30%: Gohan's full-nelson slam, a double knock-out.
 */
const LAVENDER_FIGHT: BossDef = {
  endAt: 0.3, kiColor: '#a050e0',
  phases: [
    { until: 0.8, moves: ['chase', 'shot', 'guard'], rest: 42 },
    { until: 0.5, moves: ['chase', 'dash', 'chase', 'shot'], rest: 38, onStart: 'c13_lavender_mist' },
    { until: 0, moves: ['volley', 'rain', 'shot', 'teleport'], rest: 36, speed: 1.1, onStart: 'c13_lavender_fly' },
  ],
};

/**
 * Bergamo vs. Goku (ep 81). He leaves himself open at first ("hit me"), then grows with the blows he absorbs: at 80%
 * and at 55% his sprite steps up in size and his entry in size and stats (`c13_bergamoL`, `c13_bergamoXL`, same
 * phases). A giant hits harder but turns slowly and is an easy target. At 30% Goku ends it with a Kaio-ken
 * Kamehameha against Bergamo's Wolfgang Penetrator.
 */
const BERGAMO_FIGHT: BossDef = {
  endAt: 0.3, kiColor: '#b070d0',
  phases: [
    { until: 0.8, moves: ['chase', 'shot', 'chase'], rest: 58 },
    { until: 0.55, moves: ['chase', 'charge', 'shot', 'guard'], rest: 44, onStart: 'c13_bergamo_grow' },
    { until: 0, moves: ['charge', 'rain', 'chase', 'beam'], rest: 46, onStart: 'c13_bergamo_giant' },
  ],
};

const EXPO: EnemyDef[] = [
  {
    id: 'c13_basil', name: 'Basil', sprite: 'basil', hp: 4400, str: 46, pow: 46, end: 44, exp: 0, ai: 'boss', speed: 1.45,
    desc: 'The kicking brother of the Trio de Dangers. Kickboxes at a speed even the two Zenos cheer for.', boss: BASIL_FIGHT,
  },
  {
    id: 'c13_basilDoped', name: 'Basil (Danger Doping)', sprite: 'c13_basilDoped', hp: 4400, str: 52, pow: 52, end: 46, exp: 0, ai: 'boss', speed: 1.3,
    desc: 'Basil pumped up on a mineral from Roh. Twice the muscle, half the sense. It wears off fast.', boss: BASIL_FIGHT,
  },
  {
    id: 'c13_lavender', name: 'Lavender', sprite: 'lavender', hp: 6000, str: 52, pow: 54, end: 54, exp: 120000, ai: 'boss', speed: 1.3,
    desc: 'The poison brother of the Trio de Dangers. His toxic mist blinds, then he strikes from where you cannot see.', boss: LAVENDER_FIGHT,
  },
  {
    id: 'c13_bergamo', name: 'Bergamo', sprite: 'bergamo', hp: 7600, str: 52, pow: 52, end: 56, exp: 160000, ai: 'boss', speed: 1.0,
    desc: 'Eldest of the Trio de Dangers, "Bergamo the Crusher". Every blow he takes makes him bigger and stronger.', boss: BERGAMO_FIGHT,
  },
  {
    id: 'c13_bergamoL', name: 'Bergamo (Grown)', sprite: 'bergamo', hp: 7600, str: 56, pow: 56, end: 58, exp: 160000, ai: 'boss', speed: 0.92,
    desc: 'Bergamo half again his size, fed on the blows he took. Stronger with every hit, and getting bigger.', boss: BERGAMO_FIGHT,
  },
  {
    id: 'c13_bergamoXL', name: 'Bergamo (Giant)', sprite: 'bergamo', hp: 7600, str: 60, pow: 60, end: 58, exp: 160000, ai: 'boss', speed: 0.8,
    desc: 'Bergamo at giant size, the ring cracking under his feet. Huge power, huge blind spots.', boss: BERGAMO_FIGHT,
  },
];

registerEnemies(EXPO);

registerQuests([
  {
    id: 'c13_expo', title: 'The Zeno Expo', star: 'gold', region: 'spot_zeno',
    desc: 'An exhibition for both Zenos: Universe 7 (Goku, Gohan, Buu) against Universe 9\'s Trio de Dangers. Buu faces Basil, Gohan faces Lavender, Goku faces Bergamo.',
  },
]);
