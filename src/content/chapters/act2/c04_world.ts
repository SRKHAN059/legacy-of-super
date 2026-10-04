import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerOverlay } from '../../registry';
import { addProp, removeIf, removeProp, respawn } from './shared';

/**
 * Chapter 4 hub overlays, Whis's 25-Delicacies quest (Whis at Capsule Corp from chapter 4 on, and on Beerus's
 * planet), Hell / Frieza's revival cutscene, and progress-tracking chatter.
 */

const CH4 = 'chapter==4';
/** Whis is "unreachable" during the Frieza attack (chapter 5). */
const WHIS_AROUND = 'chapter>=4';
const WHIS_AWAY = 'chapter==5';

// ---------------------------------------------------------------- Capsule Corp
registerOverlay('cc_yard', {
  props: [{ kind: 'table', x: 22.5, y: 15.4, flag: 'chapter>=4' }, { kind: 'chair', x: 21.4, y: 15.6, flag: 'chapter>=4' }],
  npcs: [
    { id: 'c04_whis', sprite: 'whis', x: 23, y: 17, dir: 'down', talk: 'c04_whis_talk', name: 'Whis', showIf: WHIS_AROUND, hideIf: WHIS_AWAY },
    { id: 'c04_bulma', sprite: 'bulma', x: 21, y: 18, dir: 'right', talk: 'c04_bulma_talk', name: 'Bulma', showIf: CH4 },
  ],
});

registerOverlay('cc_inside', {
  triggers: [{ id: 'c04_stash', x: 15, y: 2, w: 2, h: 1, script: 'c04_stash', onAction: true, showIf: 'chapter>=4' }],
});

// ---------------------------------------------------------------- Beerus's planet
registerOverlay('beerus_grounds', {
  npcs: [{ id: 'c04_whisB', sprite: 'whis', x: 25, y: 13, dir: 'down', talk: 'c04_whisB_talk', name: 'Whis', showIf: WHIS_AROUND, hideIf: WHIS_AWAY }],
  objects: [{ type: 'flight', x: 33, y: 13, to: 'c04_whis_field', tx: 4, ty: 5, showIf: 'chapter>=4', label: 'Whis\'s Training Field' }],
});

registerOverlay('beerus_palace_in', {
  npcs: [{ id: 'c04_beerus', sprite: 'beerus', x: 9, y: 6, dir: 'down', talk: 'c04_beerus_talk', name: 'Beerus', showIf: CH4 }],
});

// ---------------------------------------------------------------- Earth chatter
registerOverlay('satan_mansion', {
  npcs: [
    { id: 'c04_satan', sprite: 'mrSatan', x: 17, y: 10, dir: 'down', talk: 'c04_satan_talk', name: 'Mr. Satan', showIf: CH4 },
    { id: 'c04_reporter', sprite: 'reporter', x: 17, y: 12, dir: 'up', talk: 'c04_reporter_talk', name: 'Reporter', showIf: CH4 },
  ],
});

registerOverlay('paozu_home', {
  npcs: [{ id: 'c04_chichi', sprite: 'chichi', x: 21, y: 9, dir: 'down', talk: 'c04_chichi_talk', name: 'Chi-Chi', showIf: CH4 }],
});

registerOverlay('paozu_valley', {
  npcs: [
    { id: 'c04_gohan', sprite: 'gohan', x: 7, y: 7, dir: 'right', talk: 'c04_gohan_talk', name: 'Gohan', showIf: CH4 },
    { id: 'c04_videl', sprite: 'videl', x: 8, y: 7, dir: 'left', talk: 'c04_videl_talk', name: 'Videl', showIf: CH4 },
  ],
});

registerOverlay('kame_island', {
  npcs: [
    { id: 'c04_roshi', sprite: 'roshi', x: 21, y: 13, dir: 'down', talk: 'c04_roshi_talk', name: 'Master Roshi', showIf: CH4 },
    { id: 'c04_krillin', sprite: 'police', x: 17, y: 14, dir: 'right', talk: 'c04_krillin_talk', name: 'Krillin', showIf: CH4 },
  ],
});

// ---------------------------------------------------------------- Whis's Gourmet Earth (25 Delicacies)
const MILESTONES: Array<[number, string]> = [[5, 'senzu'], [10, 'str3'], [15, 'pow3'], [20, 'end3'], [25, 'whisStaff']];

/** Whis tastes the collection (keeps the items as the collectible counter) and pays out milestones. */
async function delicacyMenu(s: ScriptApi): Promise<void> {
  const n = s.count('delicacy');
  if (!s.check('quest:c04_delicacies') && !s.check('done:c04_delicacies')) await s.quest('c04_delicacies');
  if (n === 0) {
    await s.say('whis', 'No delicacies yet? Twenty-five rare dishes are hidden around Earth - and a few beyond it. Some are in plain sight; some you must search for with A.', 'neutral');
    return;
  }
  await s.say('whis', `Ah, ${n} Earth Delicac${n === 1 ? 'y' : 'ies'}! May I? Just a small taste of each...`, 'happy');
  let paid = s.num('c04_delTier');
  while (paid < MILESTONES.length && n >= MILESTONES[paid][0]) {
    const [need, item] = MILESTONES[paid];
    if (item === 'whisStaff') {
      await s.talk([
        ['whis', 'All twenty-five. Marvellous! I have never eaten so well in my entire very long life.', 'happy'],
        ['whis', 'Please, take this little charm. It carries a sliver of my staff\'s power - use it outdoors and you\'ll be whisked to the world map.', 'smirk'],
      ]);
    } else {
      await s.say('whis', `${need} dishes! A small token of my appreciation.`, 'happy');
    }
    await s.give(item);
    paid++;
  }
  s.set('c04_delTier', paid);
  if (n >= 25) {
    await s.done('c04_delicacies', false);
    await s.say('whis', 'If you find anything else delicious, you know where to find me. Ohoho.', 'happy');
    return;
  }
  const next = MILESTONES.find(([need]) => need > n);
  if (next) await s.say('whis', `Bring me ${next[0] - n} more and I'll have something for you.`, 'smirk');
}

async function whisMenu(s: ScriptApi, travel: 'space' | 'earth'): Promise<void> {
  const c = await s.ask('whis', 'Hello, {hero}. What can I do for you?', ['Earth Delicacies', travel === 'space' ? 'Fly me to Beerus\'s planet' : 'Take me back to Earth', 'Never mind'], 'happy');
  if (c === 0) { await delicacyMenu(s); return; }
  if (c === 1) {
    s.unlockRegion('spot_beerus');
    s.unlockRegion('spot_space_earth');
    await s.say('whis', travel === 'space' ? 'Hold on to my back. Space is a little chilly this time of year.' : 'Back to Earth? Do bring me something tasty next time.', 'happy');
    s.flash('#80c0f8', 12);
    await s.worldMap(travel);
    return;
  }
  await s.say('whis', 'Very well. Ohoho.', 'happy');
}

// ---------------------------------------------------------------- Hell: Frieza's revival
async function hellScene(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  await s.fadeOut(30);
  await s.warp('pilaf_castle_out', 20, 24, 'up');
  s.music('tense');
  s.show('hero', false);
  s.letterbox(true);
  await s.narrate('Meanwhile, on Earth, outside a certain desert castle...');
  respawn(s, 'h_pilaf', 'pilaf', 19, 20, 'down');
  respawn(s, 'h_mai', 'mai', 18, 20, 'down');
  respawn(s, 'h_shu', 'shu', 20, 20, 'down');
  await s.pan(22, 22, 20);
  await s.talk([
    ['pilaf', 'Seven balls, gathered all over again! Now nothing can stop me from becoming ruler of the world!', 'happy'],
    ['mai', 'Emperor. Something is landing.', 'shock'],
  ]);
  s.shake(40, 2);
  s.sfx('explode');
  addProp(s, 'spaceship', 26, 21.5, 'h_ship');
  s.flash('#ffffff', 10);
  respawn(s, 'h_sorbet', 'sorbet', 27, 26, 'up');
  respawn(s, 'h_tagoma', 'tagoma', 29, 26, 'up');
  respawn(s, 'h_soldier1', 'frizaSoldier', 25, 26, 'up');
  await s.walkAll([['h_sorbet', 22, 22.5, 1], ['h_tagoma', 23.5, 23, 1], ['h_soldier1', 21, 23.5, 1]]);
  await s.talk([
    ['sorbet', 'Earthlings. We\'ll be taking those Dragon Balls. Tagoma, if you please.', 'smirk'],
    ['pilaf', 'You wouldn\'t dare! I am Emperor Pil-', 'angry'],
  ]);
  s.face('h_tagoma', 'h_pilaf');
  await s.walk('h_tagoma', 20.5, 21, 1.4);
  s.boom(19, 20, 10, '#f0a040');
  for (const id of ['h_pilaf', 'h_mai', 'h_shu']) s.pose(id, 'hurt');
  await s.talk([
    ['shu', 'Th-they\'re all yours, sir! Take them!', 'shock'],
    ['sorbet', 'Eternal Dragon! Come forth!', 'shout'],
  ]);
  s.tint('rgba(10,10,40,0.55)');
  s.flash('#f8f0a0', 16);
  addProp(s, 'c03_shenron', 14.5, 14.6, 'h_shenron');
  await s.pan(19, 18, 30);
  await s.talk([
    ['shenronAvatar', 'State your wish.', 'neutral'],
    ['sorbet', 'Bring Lord Frieza back to life!', 'shout'],
    ['shenronAvatar', 'His body was destroyed long ago. I can only gather what remains of it. Very well...', 'neutral'],
  ]);
  s.flash('#ffffff', 20);
  await s.fadeOut(20);
  s.tint(null);
  // Hell.
  await s.warp('hell_lake', 20, 10, 'up');
  s.show('hero', false);
  s.letterbox(true);
  respawn(s, 'h_angel1', 'c04_angel', 19, 8, 'down');
  respawn(s, 'h_angel2', 'c04_angel', 25, 8, 'down');
  respawn(s, 'h_teddy1', 'c04_teddy', 19, 10, 'right');
  respawn(s, 'h_teddy2', 'c04_teddy', 24, 10, 'left');
  await s.pan(22, 8, 1);
  s.music('peaceful');
  await s.narrate('In Hell, the former emperor of the universe had spent years wrapped in a golden cocoon...');
  await s.walkAll([['h_angel1', 19, 10, 0.6], ['h_angel2', 25, 10, 0.6], ['h_teddy1', 22, 10.5, 0.6], ['h_teddy2', 21, 10.5, 0.6]]);
  await s.narrate('...forced to watch an endless parade of singing angels and dancing stuffed animals. "Love and peace, la la la!"');
  await s.say('frieza', '(from inside the cocoon) Make... it... STOP...', 'angry');
  await s.walkAll([['h_angel1', 19, 8, 0.6], ['h_angel2', 25, 8, 0.6], ['h_teddy1', 19, 10, 0.6], ['h_teddy2', 24, 10, 0.6]]);
  s.stopMusic();
  s.flash('#f8f0a0', 24);
  s.shake(30, 2);
  for (const id of ['h_angel1', 'h_angel2', 'h_teddy1', 'h_teddy2']) await s.emote(id, '?', 10);
  await s.narrate('And then the cocoon fell silent. Its occupant was gone.');
  await s.fadeOut(20);
  // Back on Earth: the regeneration tank.
  await s.warp('pilaf_castle_out', 20, 24, 'up');
  s.music('frieza');
  s.show('hero', false);
  s.letterbox(true);
  addProp(s, 'spaceship', 26, 21.5, 'h_ship');
  addProp(s, 'c04_regenTank', 22, 21, 'h_tank');
  respawn(s, 'h_sorbet', 'sorbet', 21, 24, 'up');
  respawn(s, 'h_tagoma', 'tagoma', 24.5, 24, 'up');
  await s.pan(22, 22, 1);
  await s.fadeIn(20);
  s.flash('#a0e0d0', 12);
  removeProp(s, 'h_tank');
  respawn(s, 'h_frieza', 'frieza', 23, 22.6, 'down');
  await s.talk([
    ['sorbet', 'Lord Frieza! Welcome back! The Frieza Force has been... struggling, in your absence.', 'happy'],
    ['frieza', 'Hell. A cocoon. Singing. I have never been so humiliated.', 'angry'],
    ['frieza', 'And the Saiyan who put me there - Son Goku - is still alive on that little blue planet. How lovely.', 'smirk'],
    ['sorbet', 'Sire... our intelligence says Goku has grown far stronger. He even fought a god.', 'sad'],
    ['frieza', '...Then I will do something I have never needed to do in my entire life.', 'neutral'],
    ['frieza', 'I will TRAIN. Four months should be plenty. I was born with more power than any of them ever earned.', 'smirk'],
  ]);
  removeIf(s, 'h_pilaf', 'h_mai', 'h_shu', 'h_soldier1');
  await s.fadeOut(30);
  removeProp(s, 'h_ship');
  await s.narrate('Four months later, a fleet of round ships set course for Earth. Aboard the flagship: Frieza, Sorbet, Tagoma... and one thousand soldiers.');
  s.letterbox(false);
}

registerScripts({
  c04_whis_talk: async (s) => {
    if (s.check('quest:c04_whis')) {
      if (s.has('c04_ramen')) { await s.call('c04_ramen_scene'); return; }
      await s.talk([
        ['whis', 'Something new... something no restaurant serves. Now THAT would be worth a lesson or two.', 'smirk'],
      ]);
      return;
    }
    if (s.check('chapter<4')) { await s.say('whis', 'Ohoho. Lovely day for a meal.', 'happy'); return; }
    await whisMenu(s, 'space');
  },
  c04_whisB_talk: async (s) => {
    if (s.check('chapter<4')) { await s.say('whis', 'Lord Beerus is napping. Please keep your voice down.', 'happy'); return; }
    await whisMenu(s, 'earth');
  },
  c04_delicacy_menu: async (s) => delicacyMenu(s),
  c04_hell: async (s) => {
    await hellScene(s);
    s.set('c04_done');
    if (s.hasScript('c05_start')) await s.call('c05_start');
  },
  c04_bulma_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('bulma', 'Hey, {hero}!', 'happy'); return; }
    if (s.check('quest:c04_whis')) {
      await s.say('bulma', 'Whis is MY dinner guest, Vegeta. And stay out of the kitchen cupboards!', 'angry');
      return;
    }
    if (s.check('quest:c04_training') || s.check('quest:c04_spar')) {
      await s.say('bulma', 'You stole my LAST instant ramen. You owe me a whole case. Now get back to your angel.', 'angry');
      return;
    }
    await s.say('bulma', 'Goku took my phone and vanished into space! Typical.', 'angry');
  },
  c04_beerus_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('beerus', 'Zzz...', 'neutral'); return; }
    await s.talk([
      ['beerus', '*yawn* ...Mmh? Oh, it\'s you. Whis\'s new pet.', 'neutral'],
      ['beerus', 'Bring pudding next time. Or ramen. Or both. Now let me sleep, or I\'ll destroy something. Probably you.', 'smirk'],
    ]);
  },
  c04_satan_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('mrSatan', 'Hahaha!', 'happy'); return; }
    await s.talk([
      ['mrSatan', 'As I was telling the press: the evil god "Beavis" came to destroy us all. So I flew up and became a god MYSELF!', 'happy'],
      ['mrSatan', '(psst - you won\'t tell anyone, right? The ratings have never been better!)', 'smirk'],
    ]);
  },
  c04_reporter_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('c04_reporter', 'ZTV News, live!', 'happy'); return; }
    await s.say('c04_reporter', 'Mr. Satan, the "god of martial arts", defeats an evil deity named Beavis! Tonight at seven: was it your fists or your hair?', 'happy');
  },
  c04_chichi_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('chichi', 'Mind the radishes!', 'neutral'); return; }
    if (s.flag('c04_whisHit')) {
      await s.say('chichi', 'Pan is barely a month old, and her grandpa grabbed onto an angel and flew off to SPACE. Without finishing the field! Wait till he gets home...', 'angry');
      return;
    }
    await s.say('chichi', 'Gohan and Videl are expecting - any month now! I\'ve already knitted eleven tiny sweaters. Goku hasn\'t knitted any.', 'happy');
  },
  c04_gohan_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('gohan', 'Hi there!', 'happy'); return; }
    await s.say('gohan', 'I\'m reading every parenting book I can find. Chapter one says "Do not let your father train the baby." Noted.', 'happy');
  },
  c04_videl_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('videl', 'Hey!', 'happy'); return; }
    await s.say('videl', 'Dad keeps telling the TV he beat a god. Gohan says I shouldn\'t correct him. It\'s good for the baby\'s college fund.', 'smirk');
  },
  c04_roshi_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('roshi', 'Ho ho!', 'happy'); return; }
    await s.say('roshi', 'An angel teaching Saiyans? In my day you learned martial arts by delivering milk and digging fields with your bare hands. Hmph. Same thing, really.', 'smirk');
  },
  c04_krillin_talk: async (s) => {
    if (!s.check(CH4)) { await s.say('krillin', 'Hi!', 'happy'); return; }
    await s.talk([
      ['krillin', 'Like the uniform? I joined the police force. Steady pay, nice hours, and Marron thinks I\'m a superhero.', 'happy'],
      ['krillin', 'Goku came by and I asked him to hit me, just to see how strong I still was. I went through three walls. Still worth it.', 'sad'],
    ]);
  },
});

