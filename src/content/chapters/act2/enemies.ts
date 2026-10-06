import { registerEnemies } from '../../enemies';

/**
 * Act 2 bosses and story enemies. Boss stats follow the LoG2 boss table (CONTENT_GUIDE §6) for the hero level
 * at that point of the story: Ch3 L12-15, Ch4 L15-18, Ch5 L16-22.
 */
registerEnemies([
  // ---------------------------------------------------------------- Chapter 3
  {
    id: 'c03_pilafMk2', name: 'Pilaf Machine Mk-II', sprite: 'c03_pilafMk2', hp: 900, str: 18, pow: 17, end: 18, exp: 3000,
    // A mini-boss sprung on Goku (L11-12) at the end of the castle, often at half HP and before any Senzu exist: low in
    // the L8-12 boss band, with a slower missile phase, so a fair player wins it at the first try about nine times in
    // ten and it is no harder than Beerus at the chapter's end.
    ai: 'boss', speed: 0.8, box: { w: 24, h: 12 },
    desc: 'The Pilaf Gang\'s upgraded battle suit. Twice the armour, three times the missiles, still steered by Shu.',
    boss: {
      endAt: 0, kiColor: '#f86030', minion: 'pilafRobot',
      phases: [
        { until: 0.5, moves: ['chase', 'shot', 'charge', 'rain'], rest: 58 },
        { until: 0, moves: ['chase', 'volley', 'charge', 'summon', 'rain'], rest: 50, speed: 1.15, onStart: 'c03_mk2_phase2' },
      ],
    },
  },
  {
    id: 'c03_beerus', name: 'Beerus', sprite: 'beerus', hp: 2500, str: 25, pow: 29, end: 26, exp: 9000, ai: 'boss', speed: 1.2,
    // Fought by forced Goku (L14 SSG, no Senzu yet): the three escalating phases carry the god's menace, the numbers
    // sit mid-to-high in the L15-20 boss band, so a fair player reaches the scripted end, often on a sliver of HP.
    desc: 'The God of Destruction of Universe 7, finally fighting a Super Saiyan God. He is still holding back.',
    boss: {
      endAt: 0.5, kiColor: '#c070f8',
      phases: [
        { until: 0.85, moves: ['chase', 'teleport', 'dash', 'chase'], rest: 46 },
        { until: 0.68, moves: ['volley', 'rain', 'teleport', 'chase'], rest: 40, speed: 1.15, onStart: 'c03_beerus_p2' },
        { until: 0, moves: ['nova', 'beam', 'teleport', 'rain', 'chase'], rest: 32, speed: 1.3, onStart: 'c03_beerus_p3' },
      ],
    },
  },
  // ---------------------------------------------------------------- Chapter 4
  {
    id: 'c04_whis', name: 'Whis', sprite: 'whis', hp: 1500, str: 14, pow: 14, end: 60, exp: 4000, ai: 'boss', speed: 1.5, resKi: 0.5,
    desc: 'An angel and Lord Beerus\'s teacher. He bats ki aside and blocks almost everything. Land one clean punch while his guard is down.',
    boss: {
      endAt: 0.985, kiColor: '#80c0f8',
      phases: [{ until: 0, moves: ['teleport', 'guard', 'dash', 'guard', 'teleport', 'chase'], rest: 24, speed: 1.4 }],
    },
  },
  {
    id: 'c04_vegetaSpar', name: 'Vegeta', sprite: 'vegeta', hp: 2400, str: 26, pow: 24, end: 22, exp: 7000, ai: 'boss', speed: 1.15,
    desc: 'Your rival, fresh from Whis\'s chores and in a foul mood about it.',
    boss: {
      endAt: 0.5, kiColor: '#c070f8',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'dash'], rest: 46 },
        { until: 0, moves: ['chase', 'volley', 'beam', 'teleport'], rest: 36, speed: 1.2, onStart: 'c04_spar_p2' },
      ],
    },
  },
  {
    id: 'c04_critter', name: 'Thieving Puffbird', sprite: 'c04_critter', hp: 60, str: 1, pow: 1, end: 4, exp: 0, ai: 'flyer', speed: 1.9,
    touch: 0, drops: 'none', desc: 'A skittish bird from Beerus\'s planet with a taste for shiny cutlery.',
  },
  {
    id: 'c04_roller', name: 'Rolling Beetle', sprite: 'c04_roller', hp: 999, str: 12, pow: 1, end: 50, exp: 0, ai: 'hazard', speed: 1.1,
    invulnerable: true, drops: 'none', desc: 'It rolls back and forth all day. Nobody knows why. Never carry anything fragile near one.',
  },
  // ---------------------------------------------------------------- Chapter 5
  {
    id: 'c05_grunt', name: 'Frieza Force Grunt', sprite: 'frizaSoldier', hp: 300, str: 20, pow: 22, end: 15, exp: 900, ai: 'shooter', speed: 1.0,
    // Fodder, as in the film: a few strings drop one, and with four or five firing at once in every wave their shots
    // must stay light (a wave of them costs about one Senzu, not the chapter's whole supply).
    shot: { color: '#f070f0', cooldown: 100, speed: 2.4, mult: 0.65 }, desc: 'One of Frieza\'s thousand. Fires from range and panics up close.',
  },
  {
    id: 'c05_raider', name: 'Frieza Force Raider', sprite: 'frizaSoldierB', hp: 460, str: 24, pow: 18, end: 18, exp: 1300, ai: 'rusher', speed: 1.25,
    desc: 'A brawler who likes to charge in first and ask questions never.',
  },
  {
    id: 'c05_brute', name: 'Frieza Force Brute', sprite: 'frizaSoldierC', hp: 700, str: 27, pow: 20, end: 22, exp: 2400, ai: 'heavy', speed: 0.8,
    box: { w: 18, h: 10 }, desc: 'A hulking soldier with a point-blank blaster and very big fists.',
  },
  {
    id: 'c05_officer', name: 'Frieza Force Officer', sprite: 'frizaElite', hp: 460, str: 22, pow: 23, end: 20, exp: 2600, ai: 'shooter', speed: 1.0,
    // Tuned against forced L16 Gohan (no form, ~210 HP) and L18 Piccolo: a shot costs ~10% HP, about a fifth more than a
    // grunt's, on a slightly slower fire rate, so the mesa wave with two of them costs about one Senzu like the others.
    shot: { color: '#60d0f8', cooldown: 110, speed: 2.8, mult: 0.75 }, desc: 'A squad leader. Fast, accurate shots that sting more than a grunt\'s.',
  },
  {
    id: 'c05_shisami', name: 'Shisami', sprite: 'shisami', hp: 1900, str: 23, pow: 22, end: 19, exp: 5000, ai: 'boss', speed: 1.3,
    // Forced L18 Gohan (no form, ~240 HP, the mesa's two Senzu): still the fastest mover of the invasion, but a few
    // frames slower to strike again, so his dashes can be read; at 2,200 HP / STR 25 he used up both beans every time.
    desc: 'A Frieza Force elite with lightning-fast strikes.',
    boss: {
      // Tagoma's blast cuts the duel short at half HP: Gohan has no form and only the mesa's two beans, and at 0.35 he
      // used both nearly every time and lost 2 bouts in 20 (fair bot); at 0.5 he wins 20 of 20 on 1.65 beans.
      endAt: 0.5, kiColor: '#80a0f0',
      phases: [
        { until: 0.65, moves: ['chase', 'dash', 'shot'], rest: 56 },
        { until: 0, moves: ['dash', 'chase', 'volley', 'teleport'], rest: 44, speed: 1.25, onStart: 'c05_shisami_p2' },
      ],
    },
  },
  {
    id: 'c05_tagoma', name: 'Tagoma', sprite: 'tagoma', hp: 3000, str: 28, pow: 26, end: 40, exp: 0, ai: 'boss', speed: 1.0,
    resMelee: 0.2, resKi: 0.2, desc: 'Sorbet\'s enforcer. His steel body barely registers your attacks. Survive!',
    boss: { endAt: 0.85, kiColor: '#f0a040', phases: [{ until: 0, moves: ['chase', 'charge', 'shot', 'volley'], rest: 40 }] },
  },
  {
    id: 'c05_ginyuTagoma', name: 'Ginyu (Tagoma\'s body)', sprite: 'tagoma', hp: 2500, str: 28, pow: 30, end: 24, exp: 9000, ai: 'boss', speed: 1.15,
    desc: 'Captain Ginyu, back from years as a frog and wearing Tagoma like a new suit. Strikes a pose between attacks.',
    boss: {
      endAt: 0.3, kiColor: '#c070f8',
      phases: [
        { until: 0.7, moves: ['chase', 'shot', 'charge'], rest: 44 },
        { until: 0, moves: ['volley', 'beam', 'rain', 'chase', 'dash'], rest: 34, speed: 1.2, onStart: 'c05_ginyu_pose' },
      ],
    },
  },
  {
    id: 'c05_frieza', name: 'Frieza', sprite: 'frieza', hp: 6000, str: 45, pow: 50, end: 55, exp: 0, ai: 'boss', speed: 1.2,
    desc: 'Frieza in his first form, toying with you. Land a real blow - or just survive.',
    boss: { endAt: 0.9, kiColor: '#f070f0', phases: [{ until: 0, moves: ['shot', 'teleport', 'volley', 'chase', 'beam'], rest: 34, speed: 1.2 }] },
  },
]);
