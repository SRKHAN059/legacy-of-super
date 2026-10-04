import { registerEnemies } from '../../enemies';

/**
 * Act 3 bosses and regular enemies. Boss stats follow CONTENT_GUIDE §6:
 * Ch6/Ch7 (hero L22-29) HP 3500-5200 · STR 32-39 · POW 32-41 · END 34-46 · EXP 12k-30k;
 * Ch8 (hero L29-31) HP 4900-6500 · STR 44-50 · POW 46-55 · END 50-60 · EXP 40k-60k.
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
  {
    id: 'c06_goldenFrieza', name: 'Golden Frieza', sprite: 'goldenFrieza', hp: 4800, str: 38, pow: 40, end: 42, exp: 22000, ai: 'boss', speed: 1.3,
    desc: 'Frieza\'s new golden form. Overwhelming power, but he never trained to sustain it: his stamina drains every second.',
    boss: {
      endAt: 0.3, stamina: 0.004, kiColor: '#f8c040',
      phases: [
        { until: 0.7, moves: ['dash', 'volley', 'teleport', 'chase'], rest: 34, speed: 1.3 },
        { until: 0.45, moves: ['beam', 'nova', 'rain', 'teleport'], rest: 30, speed: 1.35 },
        { until: 0, moves: ['chase', 'shot', 'dash'], rest: 52, speed: 0.9, onStart: 'c06_golden_tired' },
      ],
    },
  },
  {
    id: 'c06_goldenFrieza2', name: 'Golden Frieza', sprite: 'goldenFrieza', hp: 5000, str: 39, pow: 41, end: 44, exp: 26000, ai: 'boss', speed: 1.3,
    desc: 'Golden Frieza, panting and furious. Every second in this form costs him.',
    boss: {
      endAt: 0.35, stamina: 0.005, kiColor: '#f8c040',
      phases: [
        { until: 0.55, moves: ['volley', 'teleport', 'beam', 'chase'], rest: 34, speed: 1.3 },
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
  {
    id: 'c07_magetta', name: 'Auta Magetta', sprite: 'c07_magetta', hp: 4800, str: 36, pow: 38, end: 44, exp: 24000, ai: 'boss', speed: 0.7,
    resMelee: 0.35, box: { w: 16, h: 8 },
    desc: 'A molten-metal giant. Punching him burns your fists; standing next to him cooks you. Use ki from range.',
    boss: {
      endAt: 0.45, kiColor: '#f86020',
      phases: [
        { until: 0.7, moves: ['chase', 'rain', 'charge'], rest: 50, speed: 0.8 },
        { until: 0, moves: ['rain', 'nova', 'charge', 'guard'], rest: 40, speed: 0.9, onStart: 'c07_magetta_steam' },
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
  {
    id: 'c07_hit1', name: 'Hit', sprite: 'hit', hp: 5200, str: 39, pow: 41, end: 46, exp: 22000, ai: 'boss', speed: 1.3,
    desc: 'Hit, studying Goku as closely as Goku studies him.',
    boss: {
      endAt: 0.6, kiColor: '#c070f0',
      phases: [
        { until: 0.8, moves: ['timeSkip', 'chase', 'shot'], rest: 40, speed: 1.2 },
        { until: 0, moves: ['timeSkip', 'timeSkip', 'teleport', 'volley'], rest: 34, speed: 1.3 },
      ],
    },
  },
  {
    id: 'c07_hit2', name: 'Hit (Full Time-Skip)', sprite: 'hit', hp: 5200, str: 39, pow: 41, end: 46, exp: 30000, ai: 'boss', speed: 1.4,
    desc: 'Hit, skipping half a second at a time. Only something completely new can keep up.',
    boss: { endAt: 0.3, kiColor: '#c070f0', phases: [{ until: 0, moves: ['timeSkip', 'timeSkip', 'dash', 'beam', 'chase'], rest: 28, speed: 1.4 }] },
  },
  // Crater-rim wildlife (T4, hero L25-29).
  {
    id: 'c07_debrisCrawler', name: 'Debris Crawler', sprite: 'c07_debrisCrawler', hp: 950, str: 31, pow: 1, end: 27, exp: 3600, ai: 'rusher', speed: 0.9,
    resKi: 0.6, desc: 'A crab that wears a shell of space junk. Ki skids off it; fists do not.',
  },
  {
    id: 'c07_rockWisp', name: 'Ember Wisp', sprite: 'c07_rockWisp', hp: 800, str: 1, pow: 33, end: 22, exp: 3300, ai: 'shooter', speed: 1.0, flying: true,
    shot: { color: '#f8a040', cooldown: 80, speed: 2.4, mult: 0.8 }, desc: 'A drifting cinder of meteor rock that spits sparks at anything warm.',
  },
  {
    id: 'c07_debrisGolem', name: 'Debris Golem', sprite: 'c07_debrisGolem', hp: 1200, str: 35, pow: 30, end: 30, exp: 5800, ai: 'heavy', speed: 0.75,
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
  {
    id: 'c08_copyVegeta', name: 'Copy Vegeta', sprite: 'vegetaSSB', hp: 6200, str: 48, pow: 50, end: 56, exp: 55000, ai: 'boss', speed: 1.35,
    desc: 'A perfect copy of Vegeta made by the Commeson. Blows pass straight through it while its core is intact.',
    boss: {
      endAt: 0.3, vulnerableIf: 'c08_coreExposed', kiColor: '#c070f8',
      phases: [
        { until: 0.7, moves: ['chase', 'volley', 'dash', 'teleport'], rest: 36, speed: 1.3 },
        { until: 0, moves: ['beam', 'nova', 'chase', 'teleport'], rest: 30, speed: 1.35, onStart: 'c08_copy_phase2' },
      ],
    },
  },
  {
    id: 'c08_core', name: 'Commeson Core', sprite: 'c08_core', hp: 1800, str: 30, pow: 1, end: 45, exp: 8000, ai: 'flyer', speed: 1.6, flying: true,
    absorbKi: true, drops: 'none', desc: 'The Commeson\'s heart. Ki blasts bounce right off it and make it stronger. It has to be caught and smashed by hand.',
  },
  {
    id: 'c08_gooHench', name: 'Copy Henchman', sprite: 'c08_gooHench', hp: 1500, str: 39, pow: 36, end: 32, exp: 10000, ai: 'rusher', speed: 1.1,
    desc: 'One of Gryll\'s thugs, copied by the Commeson. The original is a puddle somewhere.',
  },
  {
    id: 'c08_gooBlob', name: 'Goo Spawn', sprite: 'c08_gooBlob', hp: 1350, str: 40, pow: 44, end: 32, exp: 9000, ai: 'exploder', speed: 1.0,
    desc: 'A blob of Commeson goo looking for something to copy. Pops when struck.',
  },
  {
    id: 'c08_copyGoten', name: 'Copy Goten', sprite: 'c08_gooGoten', hp: 1700, str: 41, pow: 40, end: 34, exp: 12000, ai: 'rusher', speed: 1.45,
    desc: 'A purple copy of Goten. Has all of his energy and none of his manners.',
  },
  {
    id: 'c08_copyTrunks', name: 'Copy Trunks', sprite: 'c08_gooTrunks', hp: 1700, str: 40, pow: 42, end: 34, exp: 12000, ai: 'shooter', speed: 1.3,
    shot: { color: '#c070f0', cooldown: 70, speed: 2.6, mult: 0.85 }, desc: 'A purple copy of Trunks. Fires ki blasts and snickers about it.',
  },
  {
    id: 'c08_sporeBeetle', name: 'Spore Beetle', sprite: 'c08_sporeBeetle', hp: 1600, str: 40, pow: 1, end: 38, exp: 11000, ai: 'charger', speed: 1.1,
    desc: 'A Potaufeu beetle that grazes on giant mushrooms and charges anything that is not a mushroom.',
  },
]);
