import { registerEnemies } from '../../enemies';

/**
 * Act 3 bosses and regular enemies. Boss stats follow CONTENT_GUIDE §6:
 * Ch6/Ch7 (hero L22-29) HP 3500-5200 · STR 32-39 · POW 32-41 · END 34-46 · EXP 12k-30k;
 * Ch8 (hero L29-31) HP 4900-6500 · STR 44-50 · POW 46-55 · END 50-60 · EXP 40k-60k.
 * A story run reaches these fights below the bands (Goku L20 at Golden Frieza, L27 at Copy Vegeta), so the bosses
 * the fair-play balance report flagged are tuned to those levels (fair-bot replays in tests/balance.test.ts).
 */
registerEnemies([
  // ---------------------------------------------------------------- Chapter 6: Golden Frieza
  {
    id: 'c06_frieza', name: 'Frieza (Final Form)', sprite: 'frieza', hp: 3800, str: 34, pow: 36, end: 36, exp: 14000, ai: 'boss', speed: 1.15,
    desc: 'Emperor of the universe, back from Hell after four months of the first real training of his life.',
    boss: {
      endAt: 0.5, kiColor: '#e050e0',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'dash'], rest: 46 },
        { until: 0, moves: ['volley', 'beam', 'teleport', 'chase'], rest: 36, speed: 1.2, onStart: 'c06_frieza_phase2' },
      ],
    },
  },
  // Balance (fair bot, tests/balance.test.ts): Goku arrives at L19-20 and Vegeta is forced at L19, so both golden
  // rounds sit just above Final Form on the sheet (STR 35 / END 38) and the overwhelming feel comes from the moves:
  // a fast, ki-heavy opening and a nova/rain middle before the stamina crash.
  {
    id: 'c06_goldenFrieza', name: 'Golden Frieza', sprite: 'goldenFrieza', hp: 3900, str: 35, pow: 38, end: 38, exp: 22000, ai: 'boss', speed: 1.3,
    desc: 'Frieza\'s new golden form. Overwhelming power, but he never trained to sustain it: his stamina drains every second.',
    boss: {
      endAt: 0.35, stamina: 0.004, kiColor: '#f8c040',
      phases: [
        { until: 0.75, moves: ['dash', 'volley', 'teleport', 'chase'], rest: 34, speed: 1.3 },
        { until: 0.55, moves: ['beam', 'nova', 'rain', 'teleport'], rest: 30, speed: 1.35 },
        { until: 0, moves: ['chase', 'shot', 'dash'], rest: 52, speed: 0.9, onStart: 'c06_golden_tired' },
      ],
    },
  },
  {
    id: 'c06_goldenFrieza2', name: 'Golden Frieza', sprite: 'goldenFrieza', hp: 4000, str: 35, pow: 38, end: 38, exp: 26000, ai: 'boss', speed: 1.3,
    desc: 'Golden Frieza, panting and furious. Every second in this form costs him.',
    boss: {
      endAt: 0.4, stamina: 0.005, kiColor: '#f8c040',
      phases: [
        { until: 0.6, moves: ['volley', 'teleport', 'beam', 'chase'], rest: 34, speed: 1.3 },
        { until: 0, moves: ['nova', 'rain', 'dash', 'chase'], rest: 40, speed: 1.1 },
      ],
    },
  },
  {
    id: 'c06_deserter', name: 'Deserter Captain', sprite: 'frizaElite', hp: 1300, str: 33, pow: 38, end: 28, exp: 5200, ai: 'shooter', speed: 1.1,
    shot: { color: '#60d0f8', cooldown: 70, speed: 2.6, mult: 0.85 },
    desc: 'A Frieza Force officer who fled the battle with the payroll. Jaco has a warrant with his name on it.',
  },

  // ---------------------------------------------------------------- Chapter 7: Tournament of Destroyers
  {
    id: 'c07_sparVegeta', name: 'Vegeta (Weighted)', sprite: 'vegeta', hp: 3600, str: 31, pow: 33, end: 35, exp: 9000, ai: 'boss', speed: 0.95,
    desc: 'Vegeta in Whis\'s weighted training clothes. Slower than usual, and twice as irritable about it.',
    boss: {
      endAt: 0.5, kiColor: '#60a0f8',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'dash'], rest: 52, speed: 0.9 },
        { until: 0, moves: ['volley', 'chase', 'teleport', 'dash'], rest: 42, speed: 1.0, onStart: 'c07_spar_phase2' },
      ],
    },
  },
  {
    id: 'c07_botamo', name: 'Botamo', sprite: 'botamo', hp: 4000, str: 30, pow: 20, end: 40, exp: 12000, ai: 'boss', speed: 0.7,
    resMelee: 0, resKi: 0, box: { w: 16, h: 8 },
    desc: 'A rubbery bear from Universe 6. Absorbs every blow. Corner him at the edge and knock him out of the ring.',
    boss: {
      endAt: 0.02, ringOut: true, kiColor: '#f0d060',
      phases: [{ until: 0, moves: ['chase', 'charge', 'guard', 'chase'], rest: 60, speed: 0.8 }],
    },
  },
  {
    id: 'c07_frost1', name: 'Frost', sprite: 'frost', hp: 3600, str: 33, pow: 35, end: 36, exp: 9000, ai: 'boss', speed: 1.1,
    desc: 'Universe 6\'s celebrated hero. Polite, smiling, and suspiciously similar to someone.',
    boss: { endAt: 0.6, kiColor: '#a070f0', phases: [{ until: 0, moves: ['chase', 'shot', 'dash', 'volley'], rest: 44 }] },
  },
  {
    id: 'c07_frost2', name: 'Frost (Final Form)', sprite: 'frost', hp: 4200, str: 36, pow: 38, end: 40, exp: 14000, ai: 'boss', speed: 1.2,
    desc: 'Frost\'s final form. The smile is gone.',
    boss: {
      endAt: 0.5, kiColor: '#a070f0',
      phases: [
        { until: 0.75, moves: ['volley', 'beam', 'chase', 'teleport'], rest: 38, speed: 1.2 },
        { until: 0, moves: ['rain', 'nova', 'dash', 'chase'], rest: 32, speed: 1.3 },
      ],
    },
  },
  {
    id: 'c07_frost3', name: 'Frost (Final Form)', sprite: 'frost', hp: 4200, str: 36, pow: 38, end: 40, exp: 12000, ai: 'boss', speed: 1.2,
    desc: 'Frost, rested and smug. Something about his wrist glints when he moves.',
    boss: {
      endAt: 0.6, kiColor: '#a070f0',
      phases: [
        { until: 0.8, moves: ['volley', 'chase', 'teleport'], rest: 40, speed: 1.2 },
        { until: 0, moves: ['beam', 'rain', 'dash', 'chase'], rest: 32, speed: 1.3 },
      ],
    },
  },
  {
    id: 'c07_frost4', name: 'Frost (Exposed)', sprite: 'frost', hp: 3000, str: 35, pow: 37, end: 38, exp: 10000, ai: 'boss', speed: 1.2,
    desc: 'A space pirate posing as a hero. His poison needle has been confiscated. Probably.',
    boss: { endAt: 0.4, ringOut: true, kiColor: '#a070f0', phases: [{ until: 0, moves: ['chase', 'volley', 'teleport', 'dash'], rest: 36, speed: 1.2 }] },
  },
  // Balance: fists do half damage (a ki fight, not a wall); a big HP bar with an early scripted end (Vegeta's
  // insult finishes it) keeps him the tank of the card.
  {
    id: 'c07_magetta', name: 'Auta Magetta', sprite: 'c07_magetta', hp: 4200, str: 34, pow: 36, end: 40, exp: 24000, ai: 'boss', speed: 0.7,
    resMelee: 0.5, box: { w: 16, h: 8 },
    desc: 'A molten-metal giant. Punching him burns your fists; standing next to him cooks you. Use ki from range.',
    boss: {
      endAt: 0.6, kiColor: '#f86020',
      phases: [
        { until: 0.8, moves: ['chase', 'rain', 'charge'], rest: 50, speed: 0.8 },
        { until: 0, moves: ['rain', 'nova', 'charge', 'guard'], rest: 44, speed: 0.9, onStart: 'c07_magetta_steam' },
      ],
    },
  },
  {
    id: 'c07_cabba', name: 'Cabba', sprite: 'cabba', hp: 3400, str: 32, pow: 33, end: 34, exp: 10000, ai: 'boss', speed: 1.15,
    desc: 'A young Saiyan of Universe 6 and a soldier of planet Sadala. Earnest, polite, and holding back.',
    boss: { endAt: 0.5, kiColor: '#80d0f8', phases: [{ until: 0, moves: ['chase', 'shot', 'dash'], rest: 44 }] },
  },
  {
    id: 'c07_cabbaSSJ', name: 'Cabba (Super Saiyan)', sprite: 'cabbaSSJ', hp: 4200, str: 37, pow: 39, end: 40, exp: 18000, ai: 'boss', speed: 1.3,
    desc: 'Cabba, a Super Saiyan for the first time in his life. He is a fast learner.',
    boss: {
      endAt: 0.4, kiColor: '#f8e048',
      phases: [
        { until: 0.7, moves: ['chase', 'volley', 'dash'], rest: 36, speed: 1.2 },
        { until: 0, moves: ['beam', 'teleport', 'chase'], rest: 32, speed: 1.3 },
      ],
    },
  },
  {
    id: 'c07_hitV', name: 'Hit', sprite: 'hit', hp: 5200, str: 39, pow: 40, end: 46, exp: 20000, ai: 'boss', speed: 1.3,
    desc: 'The legendary assassin of Universe 6. His Time-Skip freezes the world for a tenth of a second.',
    boss: { endAt: 0.7, kiColor: '#c070f0', phases: [{ until: 0, moves: ['timeSkip', 'chase', 'timeSkip', 'shot', 'teleport'], rest: 34, speed: 1.3 }] },
  },
  // Balance: a Time-Skip strike cannot be dodged. In the first round Hit is still measuring Goku: a slightly lighter
  // sheet than his other bouts and one Time-Skip in four moves (it was one in two); c07_hit2 is the real thing.
  {
    id: 'c07_hit1', name: 'Hit', sprite: 'hit', hp: 5000, str: 37, pow: 39, end: 46, exp: 22000, ai: 'boss', speed: 1.3,
    desc: 'Hit, studying Goku as closely as Goku studies him.',
    boss: {
      endAt: 0.6, kiColor: '#c070f0',
      phases: [
        { until: 0.8, moves: ['chase', 'timeSkip', 'shot', 'teleport'], rest: 48, speed: 1.2 },
        { until: 0, moves: ['timeSkip', 'teleport', 'volley', 'chase'], rest: 40, speed: 1.3 },
      ],
    },
  },
  {
    id: 'c07_hit2', name: 'Hit (Full Time-Skip)', sprite: 'hit', hp: 5200, str: 39, pow: 41, end: 46, exp: 30000, ai: 'boss', speed: 1.4,
    desc: 'Hit, skipping half a second at a time. Only something completely new can keep up.',
    boss: { endAt: 0.3, kiColor: '#c070f0', phases: [{ until: 0, moves: ['timeSkip', 'timeSkip', 'dash', 'beam', 'chase'], rest: 28, speed: 1.4 }] },
  },
  // Crater-rim wildlife: the grind zone of the Piccolo 25 story gate (common.ts STORY_GATES), entered by Piccolo at
  // L20 (unweighted: STR 32 / END 35, 293 HP). Tuned to LoG2's Northern Mountains at that stage (Piccolo L22: kill 5
  // / KO 18.5): 7-8 melee hits to kill and 15-17 hits to knock him out, so the fair bot clears the rim without a
  // knock-out (tests/balance.test.ts 'grind zones: act 3'). The rim's own three creatures fill its ten spawns (the
  // desert's Jade Scarabs no longer stand in), and a clear still pays the 43,100 EXP the gate's grind was costed at
  // (about 17 kills from L20 to L24); Vegeta (L27 gate) and Goku (L28 gate) come back here well above it.
  {
    id: 'c07_debrisCrawler', name: 'Debris Crawler', sprite: 'c07_debrisCrawler', hp: 420, str: 18, pow: 1, end: 18, exp: 3950, ai: 'rusher', speed: 0.9,
    resKi: 0.6, desc: 'A crab that wears a shell of space junk. Ki skids off it; fists do not.',
  },
  {
    id: 'c07_rockWisp', name: 'Ember Wisp', sprite: 'c07_rockWisp', hp: 340, str: 1, pow: 16, end: 14, exp: 3300, ai: 'shooter', speed: 1.0, flying: true,
    shot: { color: '#f8a040', cooldown: 80, speed: 2.4, mult: 0.8 }, desc: 'A drifting cinder of meteor rock that spits sparks at anything warm.',
  },
  {
    id: 'c07_debrisGolem', name: 'Debris Golem', sprite: 'c07_debrisGolem', hp: 460, str: 18, pow: 15, end: 22, exp: 5800, ai: 'heavy', speed: 0.75,
    desc: 'Centuries of wreckage fused into a walking scrap heap. Its core glows orange.',
  },

  // ---------------------------------------------------------------- Chapter 8: The Copy
  {
    id: 'c08_monakaBeerus', name: 'Monaka', sprite: 'c08_monakaCostume', hp: 6000, str: 46, pow: 48, end: 55, exp: 40000, ai: 'boss', speed: 1.4,
    desc: 'Universe 7\'s strongest fighter. Taller than you remember. Is that a tail?',
    boss: { endAt: 0.9, kiColor: '#b070f0', phases: [{ until: 0, moves: ['teleport', 'chase', 'dash', 'shot'], rest: 36, speed: 1.4 }] },
  },
  {
    id: 'c08_gryll', name: 'Copy Gryll', sprite: 'c08_gooGryll', hp: 3400, str: 42, pow: 44, end: 46, exp: 30000, ai: 'boss', speed: 1.0,
    desc: 'The space criminal Gryll, or the purple goo that used to be him. Copies whatever it touches.',
    boss: {
      endAt: 0, minion: 'c08_gooBlob', kiColor: '#c060f0',
      phases: [
        { until: 0.5, moves: ['chase', 'shot', 'charge'], rest: 44 },
        { until: 0, moves: ['volley', 'rain', 'summon', 'chase'], rest: 36, speed: 1.1 },
      ],
    },
  },
  // Balance: Goku comes in at L27 from the copies' wave (Potage's water refills him), so the copy's sheet sits at
  // Vegeta's own level at that point (it mirrors him upward if he has out-levelled it). Its first phase covers the
  // whole core hunt, while it cannot be hurt, and keeps its distance with ki; the Galick Gun phase brawls without
  // teleports.
  {
    id: 'c08_copyVegeta', name: 'Copy Vegeta', sprite: 'vegetaSSB', hp: 4800, str: 42, pow: 43, end: 48, exp: 55000, ai: 'boss', speed: 1.35,
    desc: 'A perfect copy of Vegeta made by the Commeson. Blows pass straight through it while its core is intact.',
    boss: {
      endAt: 0.45, vulnerableIf: 'c08_coreExposed', kiColor: '#c070f8',
      phases: [
        { until: 0.75, moves: ['shot', 'volley', 'chase', 'teleport'], rest: 60, speed: 1.1 },
        { until: 0, moves: ['beam', 'chase', 'dash', 'volley'], rest: 40, speed: 1.3, onStart: 'c08_copy_phase2' },
      ],
    },
  },
  {
    id: 'c08_core', name: 'Commeson Core', sprite: 'c08_core', hp: 700, str: 30, pow: 1, end: 40, exp: 8000, ai: 'flyer', speed: 1.6, flying: true,
    absorbKi: true, drops: 'none', desc: 'The Commeson\'s heart. Ki blasts bounce right off it and make it stronger. It has to be caught and smashed by hand.',
  },
  // Mushroom-forest regulars (the henchmen and goo also come in the boys' wave and Copy Gryll's summons): tuned to
  // Vegeta at L26 in Super Saiyan Blue (STR 55 / END 57, 447 HP), the hero who opens Potaufeu, against LoG2's Outside
  // Gingertown (Trunks L27 SSJ: kill 5 / KO 16): 7-8 melee hits to kill, 15-17 hits to knock him out (T4 sheets), so
  // the fair bot clears the forest without a knock-out (tests/balance.test.ts 'grind zones: act 3'). EXP stays at T5.
  // Potaufeu's own creatures fill the forest: the Stalk Serpent and a fourth beetle took the shared Giant Snake's and
  // Red Raptor's spawns (late-game sheets, 21 hits to kill).
  {
    id: 'c08_gooHench', name: 'Copy Henchman', sprite: 'c08_gooHench', hp: 875, str: 30, pow: 28, end: 28, exp: 10000, ai: 'rusher', speed: 1.1,
    desc: 'One of Gryll\'s thugs, copied by the Commeson. The original is a puddle somewhere.',
  },
  {
    id: 'c08_gooBlob', name: 'Goo Spawn', sprite: 'c08_gooBlob', hp: 800, str: 28, pow: 30, end: 26, exp: 9000, ai: 'exploder', speed: 1.0,
    desc: 'A blob of Commeson goo looking for something to copy. Pops when struck.',
  },
  // The copies open the vault beat that Copy Vegeta closes (no save point between): kid-sized T5 stats, and the
  // shooter fires about as often as an ordinary shooter.
  {
    id: 'c08_copyGoten', name: 'Copy Goten', sprite: 'c08_gooGoten', hp: 1400, str: 38, pow: 37, end: 32, exp: 12000, ai: 'rusher', speed: 1.45,
    desc: 'A purple copy of Goten. Has all of his energy and none of his manners.',
  },
  {
    id: 'c08_copyTrunks', name: 'Copy Trunks', sprite: 'c08_gooTrunks', hp: 1300, str: 36, pow: 38, end: 32, exp: 12000, ai: 'shooter', speed: 1.3,
    shot: { color: '#c070f0', cooldown: 95, speed: 2.6, mult: 0.75 }, desc: 'A purple copy of Trunks. Fires ki blasts and snickers about it.',
  },
  {
    id: 'c08_sporeBeetle', name: 'Spore Beetle', sprite: 'c08_sporeBeetle', hp: 950, str: 29, pow: 1, end: 30, exp: 11000, ai: 'charger', speed: 1.1,
    desc: 'A Potaufeu beetle that grazes on giant mushrooms and charges anything that is not a mushroom.',
  },
  {
    id: 'c08_stalkSerpent', name: 'Stalk Serpent', sprite: 'c08_stalkSerpent', hp: 900, str: 30, pow: 1, end: 28, exp: 12000, ai: 'reach', speed: 0.9,
    desc: 'A pale serpent that coils up inside hollow mushroom stalks. Strikes from farther away than its hiding place suggests.',
  },
]);
