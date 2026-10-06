import { registerEnemies, type EnemyDef } from '../../enemies';

/**
 * Act 5 bestiary. Bosses use the 37–44 band in Ch12–13 and the 45–50 band in Ch14 / post-game (Jiren hardest);
 * Ch14's set-piece fighters follow Guide §6's T7 row. The wildlife and poachers of the Ch12–13 hostile zones and the
 * rivals roaming the Tournament stage follow LoG2's grind band instead (critic round 2, gap 1; LoG2's Snowy Highlands,
 * Northern Mountains and Mushroom Cavern at the same hero levels): about 7 melee hits to kill and at least 15 hits to
 * knock out the hero who walks in, in form (Goku L35–37 in Super Saiyan Blue for Chapter 12, Gohan L39 in Super Saiyan
 * and Goku L40 for Chapter 13, Goku L40–44 on the stage). Lower HP and END buy that, not lower EXP, so a story gate
 * stays a short grind (tests/grind.test.ts measures every zone).
 */

const C12: EnemyDef[] = [
  { id: 'c12_robber', name: 'Masked Robber', sprite: 'c12_robber', hp: 2600, str: 46, pow: 48, end: 40, exp: 26000, ai: 'shooter', speed: 1.0, shot: { color: '#e0e0e0', cooldown: 80, speed: 2.6, mult: 0.8 }, desc: 'A bank robber with a capsule bazooka. Picked the wrong city.' },
  { id: 'c12_stuntman', name: 'Rubber-Suit Monster', sprite: 'c12_stuntman', hp: 2800, str: 48, pow: 1, end: 42, exp: 28000, ai: 'rusher', speed: 1.1, desc: 'A stuntman in a Watagash costume. Paid by the hour, hits like he means it.' },
  { id: 'c12_watagashSpawn', name: 'Watagash Spawn', sprite: 'c12_watagashSpawn', hp: 2500, str: 46, pow: 50, end: 40, exp: 25000, ai: 'exploder', speed: 1.1, desc: 'A blob of the parasite Watagash. Bursts when beaten.' },
  {
    id: 'c12_watagash', name: 'Watagash', sprite: 'c12_watagash', hp: 7800, str: 56, pow: 58, end: 62, exp: 160000, ai: 'boss', speed: 1.1,
    desc: 'A space parasite wanted by the Galactic Patrol. It has possessed Barry Kahn and is mutating fast.',
    boss: {
      endAt: 0.25, kiColor: '#b060e0', minion: 'c12_watagashSpawn',
      phases: [
        { until: 0.7, moves: ['chase', 'shot', 'summon'], rest: 50 },
        { until: 0.45, moves: ['charge', 'volley', 'summon', 'drain'], rest: 40, speed: 1.15, onStart: 'c12_watagash_p2' },
        { until: 0, moves: ['charge', 'rain', 'nova', 'drain', 'chase'], rest: 32, speed: 1.3, onStart: 'c12_watagash_p3' },
      ],
    },
  },
  {
    id: 'c12_hit', name: 'Hit', sprite: 'hit', hp: 7600, str: 52, pow: 54, end: 62, exp: 150000, ai: 'boss', speed: 1.3,
    desc: 'The legendary assassin of Universe 6. Skips time for a fraction of a second to strike unseen.',
    boss: {
      // A Time-Skip can't be dodged, so its share sets the fight's pace (fair-play balance: Goku L37 wins with about
      // one Senzu): Hit waits with his hands in his pockets at first, skips the most once Goku adapts ("Then I will
      // skip more time", ep 72), and less once Goku can feel the gap between the seconds. He calls it off at 45%.
      endAt: 0.45, kiColor: '#c070f0',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'guard', 'shot', 'timeSkip'], rest: 46 },
        { until: 0.6, moves: ['timeSkip', 'teleport', 'volley', 'timeSkip', 'chase', 'guard'], rest: 40, speed: 1.2, onStart: 'c12_hit_p2' },
        { until: 0, moves: ['teleport', 'beam', 'chase', 'timeSkip', 'volley'], rest: 34, speed: 1.35, onStart: 'c12_hit_p3' },
      ],
    },
  },
  { id: 'c12_ironBoar', name: 'Iron Boar', sprite: 'c12_ironBoar', hp: 1400, str: 42, pow: 1, end: 40, exp: 34000, ai: 'charger', speed: 1.1, box: { w: 20, h: 10 }, desc: 'A highland boar with tusks like crowbars. Charges anything that moves, including toddlers.' },
  // Forest of Terror illusions: untouchable hazards that pace the paths until Krillin faces his fears. Their touch
  // hurts about as much as a dire wolf's bite, so the forest stays a grind zone around them.
  { id: 'c12_illRaditz', name: 'Illusion of Raditz', sprite: 'c12_raditz', hp: 1, str: 44, pow: 1, end: 40, exp: 0, ai: 'hazard', speed: 0.9, invulnerable: true, drops: 'none', desc: 'A memory given shape by the forest. Your fists pass straight through it.' },
  { id: 'c12_illGinyu', name: 'Illusion of Ginyu', sprite: 'ginyu', hp: 1, str: 44, pow: 1, end: 40, exp: 0, ai: 'hazard', speed: 1.0, invulnerable: true, drops: 'none', desc: 'A posing phantom. Untouchable while your ki is raised.' },
  { id: 'c12_shadeWolf', name: 'Shade Wolf', sprite: 'direWolf', hp: 1300, str: 39, pow: 1, end: 36, exp: 30000, ai: 'rusher', speed: 1.4, desc: 'A wolf that feeds on fear in the Forest of Terror.' },
  {
    id: 'c12_illNappa', name: 'Giant Nappa', sprite: 'c12_nappa', hp: 5200, str: 54, pow: 50, end: 58, exp: 90000, ai: 'boss', speed: 1.0,
    desc: 'Krillin\'s memory of the Saiyan who nearly killed him. Larger than life.',
    boss: { endAt: 0, kiColor: '#f0e060', phases: [{ until: 0.5, moves: ['chase', 'charge', 'shot'], rest: 44 }, { until: 0, moves: ['charge', 'beam', 'rain', 'chase'], rest: 34, speed: 1.2 }] },
  },
  {
    id: 'c12_illFrieza', name: 'Giant Frieza', sprite: 'frieza', hp: 6000, str: 56, pow: 58, end: 60, exp: 110000, ai: 'boss', speed: 1.2,
    desc: 'The nightmare of Namek, conjured from Krillin\'s worst memory.',
    boss: { endAt: 0, kiColor: '#f070f0', phases: [{ until: 0.5, moves: ['shot', 'teleport', 'volley'], rest: 40 }, { until: 0, moves: ['beam', 'nova', 'teleport', 'rain'], rest: 30, speed: 1.2 }] },
  },
  {
    id: 'c12_illCell', name: 'Giant Cell', sprite: 'c12_cell', hp: 8000, str: 60, pow: 60, end: 64, exp: 180000, ai: 'boss', speed: 1.15,
    desc: 'The forest\'s final illusion. It feeds on Krillin\'s fear: the more you fight it, the bigger it grows.',
    boss: {
      endAt: 0.5, kiColor: '#70e0f0',
      phases: [
        { until: 0.75, moves: ['chase', 'drain', 'shot'], rest: 42 },
        { until: 0, moves: ['beam', 'drain', 'teleport', 'rain'], rest: 32, speed: 1.2, onStart: 'c12_cell_p2' },
      ],
    },
  },
];

const C13: EnemyDef[] = [
  {
    id: 'c13_toppo', name: 'Toppo', sprite: 'toppo', hp: 8200, str: 60, pow: 60, end: 65, exp: 200000, ai: 'boss', speed: 1.1,
    desc: 'Leader of Universe 11\'s Pride Troopers. Fights for justice with fists like boulders.',
    boss: {
      endAt: 0.5, kiColor: '#f05040',
      phases: [
        { until: 0.8, moves: ['chase', 'guard', 'shot'], rest: 44 },
        { until: 0, moves: ['charge', 'beam', 'guard', 'volley', 'chase'], rest: 34, speed: 1.15, onStart: 'c13_toppo_p2' },
      ],
    },
  },
  {
    id: 'c13_krillin', name: 'Krillin', sprite: 'krillin', hp: 6800, str: 52, pow: 58, end: 60, exp: 90000, ai: 'boss', speed: 1.3,
    desc: 'Earth\'s strongest human, rusty but full of tricks.',
    boss: { endAt: 0.5, kiColor: '#f8e070', phases: [{ until: 0.75, moves: ['chase', 'shot', 'dash'], rest: 42 }, { until: 0, moves: ['beam', 'volley', 'nova', 'dash'], rest: 32, speed: 1.2, onStart: 'c13_krillin_p2' }] },
  },
  { id: 'c13_student', name: 'Brainwashed Student', sprite: 'c13_student', hp: 2600, str: 50, pow: 1, end: 44, exp: 30000, ai: 'rusher', speed: 1.2, desc: 'A Tien-Shin student under Yurin\'s spell. Glassy eyes, very real kicks.' },
  { id: 'c13_studentB', name: 'Brainwashed Senior', sprite: 'c13_student', hp: 2600, str: 48, pow: 48, end: 44, exp: 33000, ai: 'shooter', speed: 1.0, shot: { color: '#f0d040', cooldown: 90, speed: 2.6, mult: 0.6 }, desc: 'A senior student throwing ki blasts on Yurin\'s orders.' },
  {
    id: 'c13_roshiMax', name: 'Max Power Roshi', sprite: 'c13_roshiMax', hp: 7400, str: 52, pow: 54, end: 62, exp: 140000, ai: 'boss', speed: 1.2,
    desc: 'Master Roshi at maximum power, brainwashed by Yurin. Still somehow thinking about magazines.',
    boss: {
      endAt: 0.4, kiColor: '#70c8f8',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'guard'], rest: 42 },
        { until: 0, moves: ['beam', 'dash', 'rain', 'chase'], rest: 32, speed: 1.2, onStart: 'c13_roshi_p2' },
      ],
    },
  },
  {
    id: 'c13_piccolo', name: 'Piccolo', sprite: 'piccoloUnweighted', hp: 8000, str: 58, pow: 60, end: 64, exp: 180000, ai: 'boss', speed: 1.25,
    desc: 'Gohan\'s mentor, weights off and taking no excuses.',
    boss: {
      endAt: 0.5, kiColor: '#f8f070',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'teleport'], rest: 40 },
        { until: 0, moves: ['rain', 'beam', 'volley', 'teleport', 'chase'], rest: 30, speed: 1.2, onStart: 'c13_piccolo_p2' },
      ],
    },
  },
  // Up to five rifles and snare drones shoot at once in the camp, so their shots are slow and light for the stage (the
  // fair bot clears the camp and the jungle on at most one Senzu, tests/grind.test.ts).
  { id: 'c13_poacher', name: 'Poacher', sprite: 'poacher', hp: 1400, str: 40, pow: 40, end: 38, exp: 32000, ai: 'shooter', speed: 1.0, shot: { color: '#f0a030', cooldown: 100, speed: 2.6, mult: 0.7 }, desc: 'A Galactic Poacher with a tranquilizer rifle. Hunts rare animals for alien collectors.' },
  { id: 'c13_poacherBrute', name: 'Poacher Brute', sprite: 'babarian', hp: 1600, str: 42, pow: 1, end: 42, exp: 40000, ai: 'rusher', speed: 1.1, desc: 'Muscle hired by the Galactic Poachers. Carries the cages.' },
  // The deckhands the Poacher Boss whistles up mid-fight carry stun pistols, far lighter than the poachers' rifles,
  // since up to three of them shoot at once while the boss himself attacks.
  { id: 'c13_poacherGrunt', name: 'Poacher Deckhand', sprite: 'poacher', hp: 1400, str: 44, pow: 46, end: 42, exp: 20000, ai: 'shooter', speed: 1.0, shot: { color: '#f0a030', cooldown: 120, speed: 2.4, mult: 0.4 }, desc: 'A deckhand off the poachers\' ship with a stun pistol. Paid to hold the line while the boss works.' },
  { id: 'c13_poacherDrone', name: 'Snare Drone', sprite: 'c13_poacherDrone', hp: 1200, str: 1, pow: 40, end: 36, exp: 28000, ai: 'shooter', speed: 1.1, flying: true, shot: { color: '#e0a030', cooldown: 100, speed: 2.8, mult: 0.6 }, desc: 'A net-firing drone used to snare animals from the air.' },
  { id: 'c13_jungleRaptor', name: 'Jungle Raptor', sprite: 'c13_jungleRaptor', hp: 1450, str: 42, pow: 1, end: 38, exp: 36000, ai: 'rusher', speed: 1.5, desc: 'A Monster Island raptor. Territorial, but no friend of poachers either.' },
  { id: 'c13_mossBoar', name: 'Moss Boar', sprite: 'c13_mossBoar', hp: 1600, str: 42, pow: 1, end: 40, exp: 38000, ai: 'charger', speed: 1.1, desc: 'A boar so old moss grows on its back. Charges in straight lines.' },
  {
    id: 'c13_poacherBoss', name: 'Poacher Boss', sprite: 'c13_poacherBoss', hp: 7200, str: 52, pow: 50, end: 64, exp: 190000, ai: 'boss', speed: 1.05,
    desc: 'Captain of the Galactic Poachers. His ship\'s hold is full of stolen animals.',
    boss: {
      // A thug with a big gun, not a fighter on Hit's level: Goku walks in hurt from the camp, and the deckhands only
      // come out in the second phase ("Release the backup!").
      endAt: 0.3, kiColor: '#f0a030', minion: 'c13_poacherGrunt',
      phases: [
        { until: 0.7, moves: ['shot', 'volley', 'charge'], rest: 46 },
        { until: 0.35, moves: ['summon', 'beam', 'volley', 'charge'], rest: 40, speed: 1.1, onStart: 'c13_poacher_p2' },
        { until: 0, moves: ['rain', 'beam', 'nova', 'charge'], rest: 34, speed: 1.2 },
      ],
    },
  },
  {
    id: 'c13_17spar', name: 'Android 17', sprite: 'android17', hp: 8200, str: 54, pow: 52, end: 65, exp: 200000, ai: 'boss', speed: 1.3,
    desc: 'The ranger of Monster Island. Infinite energy, zero patience for nonsense.',
    boss: {
      endAt: 0.5, kiColor: '#60e0a0',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'guard'], rest: 40 },
        { until: 0, moves: ['volley', 'guard', 'beam', 'dash', 'nova'], rest: 30, speed: 1.2, onStart: 'c13_17_p2' },
      ],
    },
  },
  // The assassins ambush Goku right before Frieza's spar: two snipers, two blades, and the lake's own snakes.
  { id: 'c13_assassin', name: 'U9 Assassin', sprite: 'c13_assassin', hp: 2600, str: 50, pow: 46, end: 46, exp: 36000, ai: 'shooter', speed: 0.95, shot: { color: '#60a0f0', cooldown: 100, speed: 2.8, mult: 0.5 }, desc: 'A killer sent by Universe 9\'s gods to remove Frieza before the tournament.' },
  { id: 'c13_assassinB', name: 'U9 Blade', sprite: 'c13_assassin', hp: 2800, str: 56, pow: 1, end: 48, exp: 40000, ai: 'rusher', speed: 1.35, desc: 'A Universe 9 assassin who prefers to get close.' },
  {
    id: 'c13_goldenFrieza', name: 'Golden Frieza', sprite: 'goldenFrieza', hp: 8200, str: 56, pow: 56, end: 65, exp: 200000, ai: 'boss', speed: 1.3,
    desc: 'Frieza, fresh from Hell, now able to hold his golden form without tiring.',
    boss: {
      // A warm-up spar ("Save some for the tournament!"): it stops a little past half, Frieza toying with Goku first.
      endAt: 0.55, kiColor: '#f070f0',
      phases: [
        { until: 0.8, moves: ['shot', 'teleport', 'chase'], rest: 42 },
        { until: 0, moves: ['beam', 'volley', 'rain', 'teleport', 'nova'], rest: 32, speed: 1.25, onStart: 'c13_frieza_p2' },
      ],
    },
  },
];

/**
 * The rivals roaming the Tournament stage (and the opening relay's two small waves) are tuned like the fc_top*
 * fighters of src/content/world/farC/enemies.ts: LoG2's late grind band for the Goku L40-44 in Super Saiyan Blue who
 * crosses the rings, 7-9 strings to drop one and 15-24 of its hits to knock him out, EXP kept at the T7 row. The U4
 * fighter is the exception: the stage's big-bodied rival, with more HP than any Universe 4 set piece (Magetta's 4000
 * included) but a thin hide, it takes 12-15 strings, and each ring sends at most one at a time.
 */
const C14: EnemyDef[] = [
  { id: 'c14_u9Wolf', name: 'U9 Fighter', sprite: 'c14_u9Wolf', hp: 1650, str: 46, pow: 1, end: 40, exp: 52000, ai: 'rusher', speed: 1.35, desc: 'A Universe 9 brawler. Universe 9 is already in trouble and knows it.' },
  { id: 'c14_u10Fighter', name: 'U10 Fighter', sprite: 'c14_u10Fighter', hp: 1650, str: 42, pow: 46, end: 40, exp: 55000, ai: 'shooter', speed: 1.05, shot: { color: '#60c0f0', cooldown: 100, speed: 2.8, mult: 0.5 }, desc: 'A Universe 10 warrior. Fires pressurised water-ki blasts.' },
  { id: 'c14_u4Fighter', name: 'U4 Fighter', sprite: 'c14_u4Fighter', hp: 4100, str: 44, pow: 1, end: 10, exp: 58000, ai: 'charger', speed: 1.2, desc: 'A Universe 4 trickster. Charges in straight, unhidden lines for once.' },
  { id: 'c14_u2Fighter', name: 'U2 Warrior', sprite: 'c14_u2Fighter', hp: 1650, str: 38, pow: 46, end: 40, exp: 54000, ai: 'shooter', speed: 1.1, shot: { color: '#f8a0d0', cooldown: 100, speed: 2.8, mult: 0.5 }, desc: 'A Universe 2 warrior of love. Her heart-shaped blasts hurt surprisingly much.' },
  { id: 'c14_u3Robot', name: 'U3 Robot', sprite: 'c14_u3Robot', hp: 1700, str: 46, pow: 38, end: 44, exp: 64000, ai: 'heavy', speed: 0.9, desc: 'A Universe 3 combat robot. Flamethrower arms, no sense of humour.' },
  { id: 'c14_pride', name: 'Pride Trooper', sprite: 'prideTrooper', hp: 1650, str: 46, pow: 40, end: 42, exp: 62000, ai: 'rusher', speed: 1.3, desc: 'A Universe 11 Pride Trooper. Disciplined, fast and very sure of justice.' },
  // Basil and Lavender back their big brother up in Bergamo's fight (U9 gangs up on the Saiyans, eps 97-98): Vegeta
  // fights all three at once, so the younger two hit like the brothers who lost the Zeno Expo, not like Bergamo.
  { id: 'c14_basil', name: 'Basil', sprite: 'basil', hp: 1800, str: 52, pow: 1, end: 54, exp: 60000, ai: 'rusher', speed: 1.5, desc: 'The kicking brother of the Trio de Dangers.' },
  { id: 'c14_lavender', name: 'Lavender', sprite: 'lavender', hp: 1600, str: 50, pow: 52, end: 54, exp: 60000, ai: 'shooter', speed: 1.1, shot: { color: '#a050e0', cooldown: 120, speed: 2.6, mult: 0.4 }, desc: 'The poison-breathing brother of the Trio de Dangers.' },
  {
    id: 'c14_bergamo', name: 'Bergamo', sprite: 'bergamo', hp: 8200, str: 56, pow: 54, end: 64, exp: 320000, ai: 'boss', speed: 1.0,
    desc: 'Eldest of the Trio de Dangers. Grows larger with every hit he absorbs.',
    boss: {
      // Vegeta only has to wear him down: Goku arrives and their joint blast rings all three brothers out. His
      // brothers are the gang-up (no summons), and his guard is the absorbing.
      endAt: 0.5, ringOut: true, kiColor: '#f0e060',
      phases: [
        // Rests 52/42 (were 48/38): his charges come a beat apart, so a lone L42 Vegeta can answer each one; the fair
        // bot wins 20 of 20 (18 of 20 before).
        { until: 0.75, moves: ['chase', 'guard', 'charge'], rest: 52 },
        { until: 0, moves: ['charge', 'beam', 'guard', 'chase'], rest: 42, speed: 1.15, onStart: 'c14_bergamo_grow' },
      ],
    },
  },
  {
    id: 'c14_kaleBerserk', name: 'Kale (Berserk)', sprite: 'kaleLSSJ', hp: 11000, str: 52, pow: 46, end: 74, exp: 0, ai: 'boss', speed: 1.25,
    desc: 'A Legendary Super Saiyan out of control. Nothing you do seems to reach her. Survive!',
    boss: {
      // Her menace is that nothing reaches her, not raw damage: Goku walks straight from this into the Pride Troopers'
      // ambush with whatever HP he has left, and the stage A relay shares one bag of Senzu Beans.
      endAt: 0, kiColor: '#90f070', vulnerableIf: 'c14_kaleCalm',
      phases: [{ until: 0, moves: ['charge', 'volley', 'rain', 'chase', 'dash'], rest: 54, speed: 1.05 }],
    },
  },
  {
    id: 'c14_jiren1', name: 'Jiren', sprite: 'jiren', hp: 11500, str: 80, pow: 82, end: 90, exp: 0, ai: 'boss', speed: 1.0,
    desc: 'Universe 11\'s strongest. He barely moves. He doesn\'t need to.',
    boss: { endAt: 0.9, kiColor: '#f05050', phases: [{ until: 0, moves: ['guard', 'shot', 'chase', 'beam'], rest: 40 }] },
  },
  {
    id: 'c14_frost', name: 'Frost', sprite: 'frost', hp: 8400, str: 62, pow: 64, end: 66, exp: 300000, ai: 'boss', speed: 1.2,
    desc: 'Universe 6\'s "hero". Hides poison needles in his arms and lies in every sentence.',
    boss: {
      endAt: 0, ringOut: true, kiColor: '#a0d0f0',
      phases: [{ until: 0.5, moves: ['shot', 'dash', 'chase'], rest: 40 }, { until: 0, moves: ['volley', 'beam', 'teleport', 'drain'], rest: 32, speed: 1.2, onStart: 'c14_frost_p2' }],
    },
  },
  {
    id: 'c14_kefla', name: 'Kefla', sprite: 'kefla', hp: 10000, str: 64, pow: 66, end: 72, exp: 0, ai: 'boss', speed: 1.35,
    desc: 'Caulifla and Kale fused with Potara earrings. Overwhelming in every way.',
    // Blue barely dents her ("None of it works on me!"): the fight stops once Goku has taken a third off her, and
    // Ultra Instinct -Sign- finishes the job. Her speed and her dash are the overwhelming part.
    boss: { endAt: 0.7, kiColor: '#a0f070', phases: [{ until: 0.85, moves: ['chase', 'volley', 'dash'], rest: 42 }, { until: 0, moves: ['beam', 'rain', 'nova', 'dash', 'teleport'], rest: 34, speed: 1.2 }] },
  },
  {
    id: 'c14_keflaUI', name: 'Super Saiyan 2 Kefla', sprite: 'kefla', hp: 10000, str: 74, pow: 76, end: 74, exp: 450000, ai: 'boss', speed: 1.45,
    desc: 'Kefla at Super Saiyan 2, throwing everything she has.',
    boss: { endAt: 0, ringOut: true, kiColor: '#c0f080', phases: [{ until: 0.5, moves: ['volley', 'dash', 'beam', 'teleport'], rest: 26 }, { until: 0, moves: ['rain', 'nova', 'beam', 'dash'], rest: 20, speed: 1.3, onStart: 'c14_kefla_p2' }] },
  },
  { id: 'c14_reactor', name: 'Energy Reactor', sprite: 'c14_reactor', hp: 3000, str: 1, pow: 1, end: 50, exp: 0, ai: 'idle', speed: 0, drops: 'none', desc: 'The power core feeding Universe 3\'s fused robot. Smash it!' },
  {
    id: 'c14_anilaza', name: 'Anilaza', sprite: 'c14_anilaza', hp: 9600, str: 66, pow: 62, end: 68, exp: 450000, ai: 'boss', speed: 0.9, box: { w: 28, h: 12 },
    desc: 'Universe 3\'s four-way robot fusion. Shielded by an energy reactor somewhere on the stage.',
    boss: {
      // All four robots are inside it (no summons). Android 17 is alone against it and must find the reactor first,
      // so it is slow and heavy rather than a wall of armour; the fight stops when its fist throws 17 to the edge.
      endAt: 0.45, kiColor: '#f05050', vulnerableIf: 'c14_reactorDown',
      phases: [
        { until: 0.7, moves: ['beam', 'charge', 'rain'], rest: 50 },
        { until: 0, moves: ['beam', 'nova', 'charge', 'rain'], rest: 40, speed: 1.15, onStart: 'c14_anilaza_p2' },
      ],
    },
  },
  {
    id: 'c14_toppoGoD', name: 'Toppo (Destroyer)', sprite: 'toppo', hp: 10000, str: 68, pow: 72, end: 72, exp: 500000, ai: 'boss', speed: 1.15,
    desc: 'Toppo has cast aside justice for the Energy of Destruction. Hakai spheres erase what they touch.',
    boss: {
      // Far above the Toppo of the Zeno Expo and below Jiren, but Vegeta's Evolved Blue must be able to break him: the
      // Hakai barrage (novas, beams, rain) carries the menace, and the fight stops for Vegeta's last stand at a third.
      endAt: 0.35, ringOut: true, kiColor: '#b040f0',
      phases: [
        { until: 0.7, moves: ['shot', 'guard', 'charge', 'chase'], rest: 42 },
        { until: 0.45, moves: ['nova', 'beam', 'volley', 'guard'], rest: 34, speed: 1.15, onStart: 'c14_toppo_p2' },
        { until: 0, moves: ['rain', 'nova', 'beam', 'charge', 'teleport'], rest: 28, speed: 1.25 },
      ],
    },
  },
  {
    id: 'c14_dyspo', name: 'Dyspo', sprite: 'dyspo', hp: 9800, str: 60, pow: 58, end: 70, exp: 420000, ai: 'boss', speed: 1.9,
    desc: 'The Pride Troopers\' speedster. Moves at the speed of light and reads every intention.',
    boss: {
      // His speed is the threat (he outruns everything Gohan does), his blows are light; Gohan only has to slow him
      // until Frieza's cage closes.
      endAt: 0.55, kiColor: '#f0f0a0',
      phases: [{ until: 0.75, moves: ['dash', 'teleport', 'chase'], rest: 44 }, { until: 0, moves: ['dash', 'teleport', 'volley', 'chase'], rest: 36, speed: 1.15, onStart: 'c14_dyspo_p2' }],
    },
  },
  {
    id: 'c14_jiren2', name: 'Jiren (Full Power)', sprite: 'jiren', hp: 12000, str: 80, pow: 88, end: 90, exp: 600000, ai: 'boss', speed: 1.3,
    desc: 'Jiren at full power, his willpower blazing red. The strongest mortal in all the universes.',
    boss: {
      endAt: 0.3, kiColor: '#f03030',
      phases: [
        { until: 0.75, moves: ['chase', 'volley', 'guard', 'beam'], rest: 30 },
        { until: 0.5, moves: ['rain', 'beam', 'dash', 'teleport', 'chase'], rest: 24, speed: 1.15, onStart: 'c14_jiren_p2' },
        { until: 0, moves: ['nova', 'beam', 'rain', 'dash', 'teleport'], rest: 18, speed: 1.3, onStart: 'c14_jiren_p3' },
      ],
    },
  },
  {
    id: 'c14_jiren3', name: 'Jiren (Super Full Power)', sprite: 'jiren', hp: 12000, str: 82, pow: 90, end: 92, exp: 0, ai: 'boss', speed: 1.35,
    desc: 'Jiren past his limits. Every blow could end a universe.',
    boss: { endAt: 0.9, kiColor: '#f02020', phases: [{ until: 0, moves: ['nova', 'beam', 'rain', 'dash', 'chase'], rest: 22, speed: 1.2 }] },
  },
  {
    id: 'c14_jiren4', name: 'Jiren (Super Full Power)', sprite: 'jiren', hp: 12000, str: 82, pow: 90, end: 92, exp: 0, ai: 'boss', speed: 1.35,
    desc: 'Jiren past his limits. Android 17 just has to hold on.',
    boss: { endAt: 0.82, kiColor: '#f02020', phases: [{ until: 0, moves: ['beam', 'volley', 'dash', 'chase', 'rain'], rest: 24, speed: 1.2 }] },
  },
];

const POST: EnemyDef[] = [
  {
    id: 'post_jiren', name: 'Jiren (Rematch)', sprite: 'jiren', hp: 12000, str: 80, pow: 90, end: 90, exp: 600000, ai: 'boss', speed: 1.35,
    desc: 'No ring, no clock, no Ultra Instinct to lean on. The strongest mortal wants an honest fight.',
    boss: {
      endAt: 0, kiColor: '#f03030',
      phases: [
        { until: 0.7, moves: ['chase', 'guard', 'volley', 'beam'], rest: 30 },
        { until: 0.35, moves: ['rain', 'beam', 'dash', 'teleport', 'chase'], rest: 24, speed: 1.15, onStart: 'post_jiren_p2' },
        { until: 0, moves: ['nova', 'beam', 'rain', 'dash', 'teleport', 'guard'], rest: 18, speed: 1.3, onStart: 'post_jiren_p3' },
      ],
    },
  },
  {
    id: 'post_hit', name: 'Hit (No Rules)', sprite: 'hit', hp: 10500, str: 76, pow: 80, end: 84, exp: 500000, ai: 'boss', speed: 1.45,
    desc: 'Hit with the contract open and no tournament rules. Time-Skip and Time Cage, at full strength.',
    boss: {
      endAt: 0, kiColor: '#c070f0',
      phases: [
        { until: 0.6, moves: ['timeSkip', 'teleport', 'chase', 'shot'], rest: 30 },
        { until: 0, moves: ['timeSkip', 'timeSkip', 'teleport', 'beam', 'volley', 'guard'], rest: 20, speed: 1.25, onStart: 'post_hit_p2' },
      ],
    },
  },
];

registerEnemies([...C12, ...C13, ...C14, ...POST]);
