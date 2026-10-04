import { registerEnemies, type EnemyDef } from '../../enemies';

/**
 * Chapter 14 set-piece bestiary (Guide §6: T7 regulars, 45-50 band bosses). The set-piece bosses sit below the
 * tournament's headliners (Kefla, Anilaza, Toppo, Jiren) and are tuned for the fighter the story forces into each
 * fight (Goku L45, guests 17/Frieza, Gohan/Piccolo at the forced floor L42), counting their partner where one
 * fights alongside (Hit, Android 18, Piccolo).
 */

/** Kahseral's squad: his formation shields him until all four are down (`c14_squadDown`). */
export const SQUAD = ['c14_tupper1', 'c14_zoiray1', 'c14_kettle1', 'c14_vewon1'] as const;

/** EXP for Saonel and Pirina together, paid once when both are down (each twin may regenerate). */
export const TWIN_EXP = 420000;

// The squad is lighter than free-roaming T7 troopers: four of them fight at once, and a hard knock near the edge
// rings any of them out on the spot.
const PRIDE_SQUAD: EnemyDef[] = [
  { id: 'c14_tupper', name: 'Tupper', sprite: 'c14_tupper', hp: 4200, str: 64, pow: 54, end: 56, exp: 60000, ai: 'heavy', speed: 0.95, desc: 'A hulking Pride Trooper. Holds the front of Kahseral\'s formation with a wall of ki.' },
  { id: 'c14_zoiray', name: 'Zoiray', sprite: 'c14_zoiray', hp: 3600, str: 52, pow: 64, end: 54, exp: 58000, ai: 'shooter', speed: 1.1, shot: { color: '#e04060', cooldown: 70, speed: 2.9, mult: 0.85 }, desc: 'The squad\'s marksman. Covers his captain from the back of the formation.' },
  { id: 'c14_kettle', name: 'Kettle', sprite: 'c14_kettle', hp: 3400, str: 60, pow: 1, end: 52, exp: 56000, ai: 'rusher', speed: 1.55, desc: 'The smallest and quickest of the squad. First through any gap in your guard.' },
  { id: 'c14_vewon', name: 'Vewon', sprite: 'c14_vewon', hp: 3800, str: 64, pow: 1, end: 56, exp: 60000, ai: 'charger', speed: 1.15, desc: 'Charges in straight lines like a battering ram, in the name of justice.' },
  {
    id: 'c14_kahseral', name: 'Kahseral', sprite: 'c14_kahseral', hp: 8400, str: 62, pow: 64, end: 60, exp: 320000, ai: 'boss', speed: 1.2,
    desc: 'Captain of the Pride Troopers\' strike squad. While his four troopers hold formation, no blow can reach him.',
    boss: {
      endAt: 0.4, ringOut: true, kiColor: '#f04050', minion: 'c14_pride', vulnerableIf: 'c14_squadDown',
      phases: [
        { until: 0.7, moves: ['shot', 'guard', 'dash', 'chase'], rest: 54 },
        { until: 0, moves: ['volley', 'dash', 'beam', 'summon', 'chase'], rest: 34, speed: 1.15, onStart: 'c14_kahseral_p2' },
      ],
    },
  },
];

const FIREBALLS: EnemyDef[] = [
  {
    id: 'c14_kakunsa', name: 'Kakunsa', sprite: 'c14_suroas', hp: 8400, str: 62, pow: 48, end: 54, exp: 300000, ai: 'boss', speed: 1.25,
    desc: 'A Kamikaze Fireball of Universe 2. Love transforms her into a snarling beast-warrior.',
    boss: {
      endAt: 0.5, ringOut: true, kiColor: '#f8a0d0',
      phases: [
        { until: 0.85, moves: ['chase', 'guard'], rest: 52 },
        { until: 0.65, moves: ['chase', 'dash', 'charge'], rest: 34, speed: 1.2, onStart: 'c14_fireballs_transform' },
        { until: 0, moves: ['dash', 'charge', 'chase', 'drain'], rest: 28, speed: 1.35, onStart: 'c14_kakunsa_p3' },
      ],
    },
  },
  // Ribrianne and Rozie hang back during Kakunsa's fight behind a barrier of love: untouchable, but they still shoot.
  { id: 'c14_brianneEscort', name: 'Ribrianne', sprite: 'c14_brianne', hp: 9000, str: 1, pow: 56, end: 56, exp: 0, ai: 'shooter', speed: 0.9, invulnerable: true, drops: 'none', shot: { color: '#f878b8', cooldown: 250, speed: 2.2, mult: 0.35 }, desc: 'The Fireballs\' leader, hanging back behind a barrier of love. Your blows pass straight through it.' },
  { id: 'c14_rozieEscort', name: 'Rozie', sprite: 'c14_sanka', hp: 6400, str: 1, pow: 56, end: 52, exp: 0, ai: 'shooter', speed: 0.95, invulnerable: true, drops: 'none', shot: { color: '#f8d070', cooldown: 270, speed: 2.4, mult: 0.35 }, desc: 'Ribrianne\'s partner, sniping from behind the same barrier of love.' },
  {
    id: 'c14_ribrianne', name: 'Ribrianne', sprite: 'ribrianne', hp: 9000, str: 56, pow: 62, end: 56, exp: 420000, ai: 'boss', speed: 1.15,
    desc: 'Leader of Universe 2\'s Kamikaze Fireballs. Fed by her universe\'s love, she grows into Super Ribrianne.',
    boss: {
      endAt: 0.45, ringOut: true, kiColor: '#f878b8',
      phases: [
        { until: 0.75, moves: ['shot', 'volley', 'rain', 'chase'], rest: 42 },
        { until: 0, moves: ['charge', 'nova', 'beam', 'rain', 'chase'], rest: 32, speed: 1.1, onStart: 'c14_ribrianne_super' },
      ],
    },
  },
];

const PRIDE_TAG: EnemyDef[] = [
  { id: 'c14_knsi', name: 'K\'nsi', sprite: 'c14_knsi', hp: 5200, str: 62, pow: 56, end: 54, exp: 60000, ai: 'rusher', speed: 1.35, desc: 'Dyspo\'s partner for the hunt. Sure he can catch an assassin.' },
  {
    id: 'c14_dyspoA', name: 'Dyspo', sprite: 'dyspo', hp: 8400, str: 64, pow: 58, end: 60, exp: 320000, ai: 'boss', speed: 1.75,
    desc: 'The Pride Troopers\' speedster, testing Goku and Hit. Even a Time-Skip barely keeps up with him.',
    boss: {
      endAt: 0.5, ringOut: true, kiColor: '#f0f0a0',
      phases: [
        { until: 0.75, moves: ['dash', 'teleport', 'chase'], rest: 38 },
        { until: 0, moves: ['dash', 'dash', 'teleport', 'volley', 'chase'], rest: 28, speed: 1.1, onStart: 'c14_dyspoA_p2' },
      ],
    },
  },
];

const NAMEKIANS: EnemyDef[] = [
  {
    id: 'c14_saonel', name: 'Saonel', sprite: 'c14_saonel', hp: 8200, str: 54, pow: 56, end: 56, exp: 0, ai: 'boss', speed: 1.15,
    desc: 'A Namekian of Universe 6. Regenerates from any wound unless Pirina falls with him.',
    boss: {
      endAt: 0.45, ringOut: true, kiColor: '#f0f070',
      phases: [
        { until: 0.65, moves: ['chase', 'shot', 'guard'], rest: 48 },
        { until: 0, moves: ['chase', 'beam', 'dash', 'rain'], rest: 36, speed: 1.15, onStart: 'c14_namek_twist' },
      ],
    },
  },
  {
    id: 'c14_pirina', name: 'Pirina', sprite: 'c14_pirina', hp: 8200, str: 52, pow: 58, end: 56, exp: 0, ai: 'boss', speed: 1.1,
    desc: 'Saonel\'s partner. Stretches his arms across half the ring and regenerates unless Saonel falls with him.',
    boss: {
      endAt: 0.45, ringOut: true, kiColor: '#c0f070',
      phases: [
        { until: 0.65, moves: ['shot', 'volley', 'chase'], rest: 48 },
        { until: 0, moves: ['volley', 'rain', 'beam', 'teleport'], rest: 36, speed: 1.1, onStart: 'c14_namek_twist' },
      ],
    },
  },
];

const TRICKSTERS: EnemyDef[] = [
  {
    id: 'c14_gamisalas', name: 'Gamisalas', sprite: 'gamisalas', hp: 8200, str: 52, pow: 50, end: 40, exp: 320000, ai: 'boss', speed: 1.2,
    desc: 'A Universe 4 fighter who bends light around himself. Unseen, but not unheard: his footsteps still stir the dust.',
    boss: {
      endAt: 0.55, ringOut: true, kiColor: '#c0a070',
      phases: [
        { until: 0.8, moves: ['chase', 'dash', 'chase'], rest: 46 },
        { until: 0, moves: ['chase', 'dash', 'charge', 'shot'], rest: 34, speed: 1.15, onStart: 'c14_gamisalas_p2' },
      ],
    },
  },
];

/** Free-roam Pride Troopers for the late tournament, when Universe 11 is the only rival left standing. */
const ROAMERS: EnemyDef[] = [
  { id: 'c14_prideLancer', name: 'Pride Lancer', sprite: 'prideTrooper', hp: 5200, str: 64, pow: 1, end: 56, exp: 62000, ai: 'reach', speed: 1.2, desc: 'A Pride Trooper who strikes from beyond arm\'s length with a ki spear.' },
];

registerEnemies([...PRIDE_SQUAD, ...FIREBALLS, ...PRIDE_TAG, ...NAMEKIANS, ...TRICKSTERS, ...ROAMERS]);
