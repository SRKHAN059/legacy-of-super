import { type BossDef, registerEnemies, type EnemyDef } from '../../enemies';

/**
 * Chapter 14 set-piece bestiary (Guide §6: T7 regulars, 45-50 band bosses). The set-piece bosses sit below the
 * tournament's headliners (Kefla, Anilaza, Toppo, Jiren) and are tuned for the fighter the story forces into each
 * fight (Goku L45, guests 17/Frieza, Gohan/Piccolo at the forced floor L42), counting their partner where one
 * fights alongside (Hit, Android 18, Piccolo).
 */

/** Kahseral's squad: his formation shields him until all four are down (`c14_squadDown`). */
export const SQUAD = ['c14_tupper1', 'c14_zoiray1', 'c14_kettle1', 'c14_cocotte1'] as const;

/** EXP for Saonel and Pirina together, paid once when both are down (each twin may regenerate). */
export const TWIN_EXP = 420000;

// The squad is far lighter than free-roaming T7 troopers: four of them fight at once beside an untouchable captain,
// and Goku walks in straight from holding off berserk Kale. The formation is the puzzle, not the damage race.
const PRIDE_SQUAD: EnemyDef[] = [
  { id: 'c14_tupper', name: 'Tupper', sprite: 'c14_tupper', hp: 1100, str: 52, pow: 48, end: 56, exp: 60000, ai: 'heavy', speed: 0.95, desc: 'A hulking Pride Trooper. Holds the front of Kahseral\'s formation with a wall of ki.' },
  { id: 'c14_zoiray', name: 'Zoiray', sprite: 'c14_zoiray', hp: 1000, str: 52, pow: 54, end: 54, exp: 58000, ai: 'shooter', speed: 1.1, shot: { color: '#e04060', cooldown: 110, speed: 2.9, mult: 0.35 }, desc: 'The squad\'s marksman. Covers his captain from the back of the formation.' },
  { id: 'c14_kettle', name: 'Kettle', sprite: 'c14_kettle', hp: 900, str: 50, pow: 1, end: 52, exp: 56000, ai: 'rusher', speed: 1.55, desc: 'The smallest and quickest of the squad. First through any gap in your guard.' },
  { id: 'c14_cocotte', name: 'Cocotte', sprite: 'c14_cocotte', hp: 1000, str: 50, pow: 58, end: 54, exp: 60000, ai: 'reach', speed: 1.2, desc: 'Seals the space around the squad\'s targets, then strikes from beyond arm\'s length through the folds she made.' },
  {
    id: 'c14_kahseral', name: 'Kahseral', sprite: 'c14_kahseral', hp: 8400, str: 60, pow: 58, end: 60, exp: 320000, ai: 'boss', speed: 1.2,
    desc: 'Captain of the Pride Troopers\' strike squad. While his four troopers hold formation, no blow can reach him.',
    boss: {
      // Kale finishes him (ep 101): Goku only has to break the formation and land a few blows.
      endAt: 0.7, ringOut: true, kiColor: '#f04050', vulnerableIf: 'c14_squadDown',
      // No summons: his four troopers are the adds, and Goku comes into this fight straight from surviving Kale.
      // While the formation holds he directs it from behind a guard.
      phases: [
        { until: 0.95, moves: ['guard'], rest: 90 },
        { until: 0.85, moves: ['shot', 'guard', 'dash', 'chase'], rest: 60 },
        { until: 0, moves: ['volley', 'dash', 'beam', 'chase'], rest: 44, speed: 1.15, onStart: 'c14_kahseral_p2' },
      ],
    },
  },
];

const FIREBALLS: EnemyDef[] = [
  {
    // She steps into the fight as Sanka Ku, in her everyday look and under that name (`c14_fireballs` dresses the
    // spawned fighter down); the transformation at her first phase change makes her Kakunsa, as this entry reads.
    id: 'c14_kakunsa', name: 'Kakunsa', sprite: 'c14_kakunsa', hp: 8400, str: 62, pow: 48, end: 54, exp: 300000, ai: 'boss', speed: 1.25,
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
  // They read on the Scouter exactly as they do when they fight for real later (eps 117-118); the shot multipliers
  // keep their sniping at the strength of a 56-POW shot.
  { id: 'c14_brianneEscort', name: 'Ribrianne', sprite: 'c14_brianne', hp: 9000, str: 56, pow: 62, end: 56, exp: 0, ai: 'shooter', speed: 0.9, invulnerable: true, drops: 'none', shot: { color: '#f878b8', cooldown: 250, speed: 2.2, mult: 0.26 }, desc: 'The Fireballs\' leader, hanging back behind a barrier of love. Your blows pass straight through it.' },
  { id: 'c14_rozieEscort', name: 'Rozie', sprite: 'c14_sanka', hp: 6400, str: 50, pow: 60, end: 52, exp: 0, ai: 'shooter', speed: 0.95, invulnerable: true, drops: 'none', shot: { color: '#f8d070', cooldown: 270, speed: 2.4, mult: 0.29 }, desc: 'Ribrianne\'s partner, sniping from behind the same barrier of love.' },
  {
    id: 'c14_ribrianne', name: 'Ribrianne', sprite: 'ribrianne', hp: 9000, str: 56, pow: 62, end: 56, exp: 420000, ai: 'boss', speed: 1.15,
    desc: 'Leader of Universe 2\'s Kamikaze Fireballs. Fed by her universe\'s love, she grows into Super Ribrianne.',
    boss: {
      endAt: 0.3, ringOut: true, kiColor: '#f878b8',
      phases: [
        { until: 0.75, moves: ['shot', 'volley', 'rain', 'chase'], rest: 42 },
        { until: 0, moves: ['charge', 'nova', 'beam', 'rain', 'chase'], rest: 32, speed: 1.1, onStart: 'c14_ribrianne_super' },
      ],
    },
  },
];

const PRIDE_TAG: EnemyDef[] = [
  { id: 'c14_knsi', name: 'K\'nsi', sprite: 'c14_knsi', hp: 3200, str: 54, pow: 56, end: 54, exp: 60000, ai: 'rusher', speed: 1.35, desc: 'Dyspo\'s partner for the hunt. Sure he can catch an assassin.' },
  {
    id: 'c14_dyspoA', name: 'Dyspo', sprite: 'dyspo', hp: 8400, str: 52, pow: 50, end: 60, exp: 320000, ai: 'boss', speed: 1.75,
    desc: 'The Pride Troopers\' speedster, testing Goku and Hit. Even a Time-Skip barely keeps up with him.',
    boss: {
      // A probing first clash (ep 104): Goku is in Super Saiyan God to save himself for Jiren, and Dyspo backs off
      // once K'nsi is in trouble. His speed is the threat; his blows are light.
      endAt: 0.6, ringOut: true, kiColor: '#f0f0a0',
      phases: [
        { until: 0.8, moves: ['dash', 'teleport', 'chase'], rest: 46 },
        { until: 0, moves: ['dash', 'teleport', 'volley', 'chase'], rest: 36, speed: 1.1, onStart: 'c14_dyspoA_p2' },
      ],
    },
  },
];

const NAMEKIANS: EnemyDef[] = [
  {
    id: 'c14_saonel', name: 'Saonel', sprite: 'c14_saonel', hp: 8200, str: 54, pow: 50, end: 56, exp: 0, ai: 'boss', speed: 1.15,
    desc: 'A Namekian of Universe 6. Regenerates from any wound unless Pirina falls with him.',
    boss: {
      endAt: 0.45, ringOut: true, kiColor: '#f0f070',
      phases: [
        { until: 0.65, moves: ['chase', 'shot', 'guard'], rest: 52 },
        { until: 0, moves: ['chase', 'beam', 'dash', 'rain'], rest: 42, speed: 1.15, onStart: 'c14_namek_twist' },
      ],
    },
  },
  {
    id: 'c14_pirina', name: 'Pirina', sprite: 'c14_pirina', hp: 8200, str: 52, pow: 50, end: 56, exp: 0, ai: 'boss', speed: 1.1,
    desc: 'Saonel\'s partner. Stretches his arms across half the ring and regenerates unless Saonel falls with him.',
    boss: {
      endAt: 0.45, ringOut: true, kiColor: '#c0f070',
      phases: [
        { until: 0.65, moves: ['shot', 'volley', 'chase'], rest: 52 },
        { until: 0, moves: ['volley', 'rain', 'beam', 'teleport'], rest: 42, speed: 1.1, onStart: 'c14_namek_twist' },
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

// ---------------------------------------------------------------- the middle of the west-ring relay (eps 103-107)
// Short set pieces between the headliners: the finale band's HP with early scripted ends, so each lasts a minute or
// two. Master Roshi and Tien are played over Goku (`c14_guests.ts`) with no Z form, so their opponents are tuned for
// Goku L42 in base form (Roshi at Max Power against Ganos); Obni for Gohan L42 in his Ultimate form.
// Canon finishes several of these fighters its own way (Caway jumps, Dercori is sealed in a jar, Vegeta throws
// Magetta out), so they carry a `boss.endAt` although they fight as regular enemies: the engine then stops them at
// that fraction instead of knocking them out (`Field.applyDamage`), and `c14_veterans.ts` (`daze`) leaves them dazed
// on the stage for the scene that ends them. Only a ring-out takes them out first.

/** Where a regular fighter of these episodes stops, dazed, for canon's own finish. */
const DAZED: BossDef = { endAt: 0.3, phases: [] };

/** Obni's afterimages (`c14_obni.ts`): a summoned decoy that vanishes at the first touch. */
export const OBNI_IMAGE = 'c14_obniImage';

/** Harmira holds his sniper's nest while his HP stays above this fraction (`c14_veterans.ts` snipes for him). */
export const SNIPER_NEST = 0.97;

const VETERANS: EnemyDef[] = [
  {
    id: 'c14_obni', name: 'Obni', sprite: 'c14_obni', hp: 8200, str: 54, pow: 52, end: 60, exp: 320000, ai: 'boss', speed: 1.3,
    desc: 'Universe 10\'s last fighter. Splits into afterimages, and every blow carries the weight of the family waiting for him.',
    boss: {
      // The void cannot take him mid-fight: canon's finish is the scripted end, Gohan's cross-counter and the
      // Kamehameha that throws him out of the ring (`c14_obni.ts`).
      endAt: 0.35, kiColor: '#c0a040', minion: OBNI_IMAGE,
      phases: [
        { until: 0.7, moves: ['chase', 'summon', 'dash', 'chase'], rest: 46 },
        { until: 0, moves: ['teleport', 'summon', 'charge', 'chase'], rest: 34, speed: 1.15, onStart: 'c14_obni_p2' },
      ],
    },
  },
  {
    id: OBNI_IMAGE, name: 'Obni', sprite: 'c14_obni', hp: 1, str: 1, pow: 1, end: 0, exp: 0, ai: 'idle', speed: 0, drops: 'none',
    desc: 'One of Obni\'s afterimages. Fades the moment anything touches it, and it casts no shadow.',
  },
  { id: 'c14_caway', name: 'Caway', sprite: 'c14_caway', hp: 2400, str: 50, pow: 46, end: 46, exp: 56000, ai: 'rusher', speed: 1.4, boss: DAZED, desc: 'A Universe 4 fighter who counts on a pretty smile to make her opponents drop their guard.' },
  { id: 'c14_dercori', name: 'Dercori', sprite: 'c14_dercori', hp: 2200, str: 40, pow: 52, end: 44, exp: 54000, ai: 'shooter', speed: 1.0, boss: DAZED, shot: { color: '#9060c0', cooldown: 110, speed: 2.6, mult: 0.45 }, desc: 'A hooded Universe 4 fighter who throws dark ki from a safe distance.' },
  {
    id: 'c14_ganos', name: 'Ganos', sprite: 'c14_ganos', hp: 8200, str: 48, pow: 46, end: 56, exp: 320000, ai: 'boss', speed: 1.2,
    desc: 'A Universe 4 fighter who turns into a bird of prey when he is cornered, and grows faster the harder he is pushed.',
    boss: {
      endAt: 0.45, ringOut: true, kiColor: '#f0a020',
      phases: [
        { until: 0.65, moves: ['chase', 'dash', 'shot'], rest: 48 },
        // The bird swoops (dashes) far more than it walks.
        { until: 0, moves: ['dash', 'chase', 'dash', 'rain'], rest: 40, speed: 1.25, onStart: 'c14_ganos_bird' },
      ],
    },
  },
  {
    // Universe 2's decoy (ep 106): his body is a mirror. Fists and ki pass him by, and `c14_veterans.ts` bounces
    // Harmira's shots (and the hero's ki blasts) off him; canon has Vegeta blast him off the stage once Harmira is out.
    id: 'c14_prum', name: 'Prum', sprite: 'c14_prum', hp: 1800, str: 1, pow: 56, end: 42, exp: 0, ai: 'idle', speed: 0, invulnerable: true, drops: 'none',
    desc: 'Universe 2\'s lookout. His body turns to a mirror that bounces his partner\'s shots at targets from angles nobody expects.',
  },
  {
    // Universe 2's sniper (ep 106). From a hiding place across the ring he fires at Prum, who bounces the shots on
    // (`c14_veterans.ts`); he holds his nest until the first blows land, then fights head-on. No ring-out: canon ends
    // it with Tien's Multi-Form dragging him down (the scripted end).
    id: 'c14_harmira', name: 'Harmira', sprite: 'c14_harmira', hp: 8200, str: 52, pow: 52, end: 52, exp: 320000, ai: 'boss', speed: 1.0,
    desc: 'Universe 2\'s sniper. Tracks his targets by their body heat and fires from a hiding place, bouncing his shots off Prum.',
    boss: {
      endAt: 0.6, kiColor: '#f878b8',
      phases: [
        // In his nest: he only snipes (the script fires the shots) and does not stir.
        { until: SNIPER_NEST, moves: ['guard'], rest: 600, speed: 0 },
        { until: 0.8, moves: ['shot', 'charge', 'chase', 'volley'], rest: 48, onStart: 'c14_harmira_found' },
        { until: 0, moves: ['charge', 'chase', 'volley', 'rain'], rest: 38, speed: 1.15, onStart: 'c14_harmira_p2' },
      ],
    },
  },
  {
    // Frost holds the jar Vegeta is sealed in (ep 107). He must not fall here: Frieza eliminates him in ep 108.
    id: 'c14_frostJar', name: 'Frost', sprite: 'frost', hp: 8200, str: 47, pow: 47, end: 54, exp: 300000, ai: 'boss', speed: 1.2,
    desc: 'Frost with the jar that holds Vegeta tucked under his arm. Strike him hard enough and he will have to let go.',
    boss: {
      endAt: 0.65, kiColor: '#a070f0',
      phases: [
        // No poison-needle grab here: the jar is under his arm (the needles come out against Frieza in ep 108).
        { until: 0.8, moves: ['shot', 'dash', 'chase', 'guard'], rest: 48 },
        { until: 0, moves: ['teleport', 'volley', 'dash', 'chase'], rest: 40, speed: 1.15, onStart: 'c14_frostJar_p2' },
      ],
    },
  },
  // Fists do half damage against the metal giant, as in the Tournament of Destroyers: he is Frost's shield, not the goal.
  // Dazed, he waits for the freed Vegeta to throw him out (canon).
  { id: 'c14_magetta', name: 'Auta Magetta', sprite: 'c07_magetta', hp: 4000, str: 42, pow: 44, end: 54, exp: 58000, ai: 'heavy', speed: 0.6, resMelee: 0.5, boss: DAZED, box: { w: 16, h: 8 }, desc: 'Universe 6\'s metal giant, guarding Frost\'s back. Punching him burns your fists; ki works better.' },
];

/** Free-roam Pride Troopers for the late tournament, when Universe 11 is the only rival left standing. */
const ROAMERS: EnemyDef[] = [
  { id: 'c14_prideLancer', name: 'Pride Lancer', sprite: 'prideTrooper', hp: 1650, str: 46, pow: 1, end: 42, exp: 62000, ai: 'reach', speed: 1.2, desc: 'A Pride Trooper who strikes from beyond arm\'s length with a ki spear.' },
];

registerEnemies([...PRIDE_SQUAD, ...FIREBALLS, ...PRIDE_TAG, ...NAMEKIANS, ...TRICKSTERS, ...VETERANS, ...ROAMERS]);
