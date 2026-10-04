import { registerEnemies } from '../enemies';
import { registerMaps } from '../registry';
import { registerScripts } from '../../game/script';
import { registerSpots } from '../world';

/** Developer test maps exercising every engine feature. Reachable via ?map=dev_sandbox. */
registerEnemies([
  {
    id: 'devBoss', name: 'Sparring Robot', sprite: 'mechTrooper', hp: 600, str: 10, pow: 12, end: 6, exp: 500, ai: 'boss', speed: 1.0,
    desc: 'A Capsule Corp sparring robot.',
    boss: {
      endAt: 0.25, kiColor: '#f06060',
      phases: [
        { until: 0.6, moves: ['chase', 'shot', 'dash'], rest: 50 },
        { until: 0, moves: ['chase', 'volley', 'beam', 'rain', 'teleport'], rest: 36, speed: 1.3 },
      ],
    },
  },
]);

registerMaps([
  {
    id: 'dev_sandbox', name: 'Test Meadow', music: 'field', hostile: true, region: 'Dev Region',
    legend: { '.': 'grass', ',': 'darkGrass', '=': 'path', '~': 'water', '#': 'cliff', 's': 'sand' },
    grid: [
      '##############################',
      '#,,,,.........====..........,#',
      '#,,...........====...........#',
      '#.............====...........#',
      '#.....~~~~....====...........=',
      '#....~~~~~~...====...........=',
      '#....~~~~~~ss.====...........=',
      '#.....~~~~sss.====...........=',
      '#.............====...........#',
      '#=============================',
      '#=============================',
      '#.............====...........#',
      '#.............====...........#',
      '#.............====...........#',
      '#.............====.......,,,,#',
      '#.............====.......,,,,#',
      '#.............====...........#',
      '#.............====...........#',
      '#.............====...........#',
      '##############################',
    ],
    props: [['tree', 2, 11], ['tree', 4, 13], ['pine', 24, 1], ['pine', 26, 2], ['bush', 9, 2], ['flowers', 20, 3], ['domeHouse', 20, 13], ['rock', 10, 16], ['sign', 12, 8]],
    npcs: [{ id: 'bulma', sprite: 'bulma', x: 17, y: 3, talk: 'dev_bulma', name: 'Bulma', wander: 2 }],
    enemies: [
      { type: 'wolf', x: 22, y: 5 }, { type: 'wolf', x: 24, y: 6 }, { type: 'wolf', x: 23, y: 7 },
      { type: 'snake', x: 6, y: 16 }, { type: 'drone', x: 26, y: 11 },
    ],
    objects: [
      { type: 'save', x: 12, y: 2 },
      { type: 'flight', x: 3, y: 2, to: 'dev_sandbox', tx: 26, ty: 16 },
      { type: 'breakable', x: 6, y: 11, size: 1 }, { type: 'breakable', x: 7, y: 12, size: 2, look: 'jar' }, { type: 'breakable', x: 8, y: 11, size: 3, item: 'str1', id: 'b1' },
      { type: 'chest', x: 2, y: 17, id: 'devChest', item: 'senzu' },
      { type: 'sign', x: 18, y: 8, text: 'East: Test Arena. The gate needs Goku at level 3.' },
      { type: 'worldSign', x: 3, y: 7 },
      { type: 'bag', x: 10, y: 3 },
    ],
    barriers: [{ id: 'g1', x: 29, y: 4, w: 1, h: 4, level: 3, character: 'goku' }],
    exits: { east: { to: 'dev_arena' } },
    triggers: [{ id: 'devIntro', x: 13, y: 9, w: 4, h: 2, script: 'dev_intro', once: true }],
  },
  {
    id: 'dev_arena', name: 'Test Arena', music: 'battle', hostile: true, region: 'Dev Region',
    legend: { '.': 'arena', '#': 'cliff', 'v': 'void' },
    grid: [
      'vvvvvvvvvvvvvvvvvvvv',
      'v..................v',
      'v..................v',
      '...................v',
      '...................v',
      '...................v',
      '...................v',
      'v..................v',
      'v..................v',
      'v..................v',
      'vvvvvvvvvvvvvvvvvvvv',
    ],
    exits: { west: { to: 'dev_sandbox', offset: 0 } },
    triggers: [{ id: 'devBossT', x: 8, y: 3, w: 2, h: 4, script: 'dev_boss', once: true }],
    backdrop: '#100820',
  },
]);

registerScripts({
  dev_bulma: async (s) => {
    const n = s.inc('dev_bulma_talks');
    if (n === 1) {
      await s.talk([
        ['bulma', 'Oh, {hero}! Testing the new engine?', 'happy'],
        ['hero', 'Uh... sure. What do I do?'],
        ['bulma', 'Punch things with A, blast with B, swap techniques with L. Try the gate east when you\'re level 3.', 'smirk'],
      ]);
      await s.give('scouter');
      await s.quest('dev_q1');
    } else {
      const c = await s.ask('bulma', 'Want me to patch you up?', ['Yes', 'No']);
      if (c === 0) { s.heal(); await s.say('bulma', 'Good as new!', 'happy'); }
      else await s.say('bulma', 'Suit yourself.');
    }
  },
  dev_intro: async (s) => {
    s.letterbox(true);
    await s.pan(23, 6, 40);
    await s.narrate('Wolves ahead! This is a hostile zone - see the red icon at the top right.');
    s.follow();
    s.letterbox(false);
  },
  dev_boss: async (s) => {
    await s.say('hero', 'A sparring robot? Let\'s go!', 'smirk');
    s.music('battle');
    const r = await s.fight('devBoss', { x: 14, y: 5, uid: 'devBoss1' });
    await s.narrate(`Fight result: ${r}.`);
    if (r === 'end') {
      await s.say('hero', 'It\'s smoking... I win!', 'happy');
      s.remove('devBoss1');
      s.exp(500);
      await s.done('dev_q1', false);
    }
  },
});

registerSpots([
  { id: 'spot_dev', name: 'Test Meadow', world: 'earth', x: 110, y: 110, map: 'dev_sandbox', tx: 4, ty: 9, icon: 'house' },
  { id: 'spot_dev2', name: 'Test Arena', world: 'earth', x: 160, y: 140, map: 'dev_arena', tx: 3, ty: 5, icon: 'arena' },
]);
