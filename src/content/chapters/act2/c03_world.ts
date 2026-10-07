import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerOverlay } from '../../registry';
import { ballCheck, dbCount, giveBall, removeIf, respawn } from './shared';

/**
 * Chapter 3 hub overlays (party guests at Capsule Corp, Mr. Satan's "Champion Orb", Kame House's buried ball)
 * and their talk scripts. Every talk script is safe to run in any chapter (smoke tests run them at chapter 0).
 */

const CH3 = 'chapter==3';

// ---------------------------------------------------------------- Capsule Corp party lawn
registerOverlay('cc_yard', {
  props: [
    { kind: 'table', x: 12.5, y: 16.6, flag: CH3 }, { kind: 'table', x: 21.5, y: 16.4, flag: CH3 }, { kind: 'table', x: 29.5, y: 16.6, flag: CH3 },
    { kind: 'counter', x: 33.5, y: 16.2, flag: CH3 }, { kind: 'crater', x: 24, y: 24.6, flag: CH3 }, { kind: 'rubble', x: 36, y: 25, flag: CH3 },
    { kind: 'chair', x: 16, y: 17, flag: CH3 }, { kind: 'rubble', x: 8.5, y: 18.5, flag: CH3 },
  ],
  npcs: [
    { id: 'c03_bulma', sprite: 'bulma', x: 19, y: 20, dir: 'right', talk: 'c03_bulma_talk', name: 'Bulma', showIf: CH3 },
    { id: 'c03_beerus', sprite: 'beerus', x: 22, y: 18, dir: 'down', talk: 'c03_beerus_talk', name: 'Beerus', showIf: CH3, hideIf: 'c03_ritualDone' },
    { id: 'c03_whis', sprite: 'whis', x: 24, y: 18, dir: 'down', talk: 'c03_whis_talk', name: 'Whis', showIf: CH3, hideIf: 'c03_ritualDone' },
    { id: 'c03_vegeta', sprite: 'vegeta', x: 26, y: 20, dir: 'left', talk: 'c03_vegeta_talk', name: 'Vegeta', showIf: `${CH3}&!char:vegeta` },
    { id: 'c03_gohan', sprite: 'gohan', x: 14, y: 22, dir: 'right', talk: 'c03_gohan_talk', name: 'Gohan', showIf: CH3 },
    { id: 'c03_videl', sprite: 'videl', x: 15, y: 22, dir: 'left', talk: 'c03_videl_talk', name: 'Videl', showIf: CH3 },
    { id: 'c03_goten', sprite: 'goten', x: 9, y: 24, talk: 'c03_kids_talk', name: 'Goten', showIf: CH3, wander: 2 },
    { id: 'c03_trunks', sprite: 'trunksKid', x: 11, y: 24, talk: 'c03_kids_talk', name: 'Trunks', showIf: CH3, wander: 2 },
    { id: 'c03_chichi', sprite: 'chichi', x: 12, y: 19, dir: 'right', talk: 'c03_chichi_talk', name: 'Chi-Chi', showIf: CH3 },
    // Krillin spars at the Satan Dojo until the player has beaten him there, then joins 18 at the party.
    { id: 'c03_krillin', sprite: 'krillin', x: 31, y: 22, dir: 'left', talk: 'c03_krillin_talk', name: 'Krillin', showIf: `${CH3}&c02_beatKrillin` },
    { id: 'c03_18', sprite: 'android18', x: 32, y: 22, dir: 'left', talk: 'c03_18_talk', name: 'Android 18', showIf: CH3 },
    { id: 'c03_piccolo', sprite: 'piccolo', x: 37, y: 20, dir: 'left', talk: 'c03_piccolo_talk', name: 'Piccolo', showIf: CH3 },
    { id: 'c03_panchy', sprite: 'panchy', x: 29, y: 19, dir: 'down', talk: 'c03_panchy_talk', name: 'Mrs. Briefs', showIf: CH3 },
  ],
  onEnter: 'c03_ballcheck',
});

/** Which leads are still open, as a short hint list. */
function openLeads(s: ScriptApi): string[] {
  const out: string[] = [];
  if (!s.has('db1')) out.push('the oasis in Diablo Desert');
  if (!s.has('db2') || !s.has('db3')) out.push('Pilaf\'s castle in Diablo Desert');
  if (!s.has('db4')) out.push('the beach at Kame House');
  if (!s.has('db5')) out.push('Mr. Satan\'s mansion in Satan City');
  if (!s.has('db6')) out.push('Korin Tower');
  if (!s.has('db7')) out.push('the Lookout above Korin Tower');
  return out;
}

registerScripts({
  c03_bulma_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('bulma', 'Capsule Corp is always busy. Did you need something, {hero}?', 'neutral'); return; }
    if (s.flag('c03_ritualDone')) {
      const c = await s.ask('bulma', 'Beerus is waiting for you over the southern sea. Ready?', ['Take me there', 'Not yet']);
      if (c !== 0) { await s.say('bulma', 'Don\'t keep a god waiting too long!', 'neutral'); return; }
      await s.say('bulma', 'Go get him, Goku! And try not to land on my house!', 'happy');
      await s.warp('c03_sky_sea', 6, 11, 'right');
      return;
    }
    if (dbCount(s) >= 7) {
      if (s.check('quest:c03_dragonballs')) await ballCheck(s);
      const c = await s.ask('bulma', 'You found all seven! Ready to call Shenron?', ['Summon Shenron!', 'Not yet']);
      if (c === 0) await s.call('c03_ritual');
      else await s.say('bulma', 'Don\'t take too long. Beerus is on his fourth cake.', 'angry');
      return;
    }
    const n = dbCount(s);
    const leads = openLeads(s);
    await s.talk([
      ['bulma', n === 0 ? 'The radar\'s in your bag - press R for the regional map and look for blinking dots!' : `${n} down, ${7 - n} to go! You\'re doing great.`, n === 0 ? 'neutral' : 'happy'],
      ['bulma', `Still missing: ${leads.join(', ')}.`, 'neutral'],
    ]);
    if (!s.has('dragonRadar')) { await s.give('dragonRadar'); await s.quest('c03_dragonballs'); }
  },
  c03_beerus_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('beerus', 'Hmm? I\'m not here. I\'m asleep. Go away.', 'neutral'); return; }
    const n = dbCount(s);
    if (s.hero === 'vegeta') {
      await s.say('beerus', 'Prince of Saiyans. That bingo dance of yours earlier... do it again. No? Pity.', 'smirk');
      return;
    }
    if (n >= 7) await s.say('beerus', 'Seven shiny balls. Well? Summon your dragon before I lose interest.', 'smirk');
    else if (n >= 4) await s.say('beerus', `Whis, how many of those balls are there again? Seven? He has ${n}. I\'m going to need more cake.`, 'neutral');
    else await s.say('beerus', 'Tick, tock, Saiyan. This pudding won\'t last forever. Neither will your planet.', 'smirk');
  },
  c03_whis_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('whis', 'Ohoho. Lovely day for a meal, isn\'t it?', 'happy'); return; }
    const n = s.inc('c03_whis_n');
    if (n === 1) {
      await s.talk([
        ['whis', 'Do not worry about Lord Beerus. As long as there is food, he is in a forgiving mood. Mostly.', 'happy'],
        ['whis', 'Earth cuisine is marvellous. If you ever come across dishes I haven\'t tried, do let me know. I keep a list.', 'smirk'],
      ]);
    } else {
      await s.say('whis', 'This "takoyaki" is a revelation. Octopus! In a ball! What will they think of next?', 'happy');
    }
  },
  c03_vegeta_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('vegeta', 'Hmph.', 'neutral'); return; }
    if (dbCount(s) >= 7) { await s.say('vegeta', 'You have them ALL? Then what are you standing around for? Go to Bulma!', 'angry'); return; }
    await s.talk([
      ['vegeta', 'Don\'t look at me like that. I am keeping a god entertained. It is a perfectly honourable task.', 'angry'],
      ['vegeta', 'If you tell anyone I danced, Kakarot, I will end you myself. Now hurry up!', 'angry'],
    ]);
  },
  c03_gohan_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('gohan', 'Hi! Good to see you.', 'happy'); return; }
    if (dbCount(s) >= 4) {
      await s.say('gohan', 'Over halfway there, Dad! Videl wants to tell everyone something once this is over... but she won\'t tell me what!', 'happy');
    } else {
      await s.talk([
        ['gohan', 'Beerus knocked me flat with one finger. I really have let my training slip.', 'sad'],
        ['gohan', 'The Lookout is a long climb - Korin Tower first, then up to Dende. He might have sensed where a ball landed.', 'neutral'],
      ]);
    }
  },
  c03_videl_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('videl', 'Hey there!', 'happy'); return; }
    await s.talk([
      ['videl', 'My dad has a Dragon Ball? That\'s so like him. He probably thinks it\'s a trophy for saving the world.', 'smirk'],
      ['videl', 'He\'ll do anything for Buu, though. Ever since Beerus ate that pudding, Buu won\'t stop sulking.', 'neutral'],
    ]);
  },
  c03_kids_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('goten', 'Wanna play tag?', 'happy'); return; }
    await s.talk([
      ['goten', 'We tried fusing to beat the cat guy, but he flicked us!', 'sad'],
      ['trunksKid', 'Hey, the three weirdos we fed earlier? The short blue one said they live in a castle in the desert.', 'neutral'],
      ['goten', 'He said there\'s a secret password. He made us promise not to tell. So I won\'t tell you it\'s about the moon.', 'happy'],
    ]);
  },
  c03_chichi_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('chichi', 'Goku, you\'d better be home for dinner!', 'angry'); return; }
    if (s.hero === 'goku') {
      await s.say('chichi', 'Goku! If you get yourself erased by a giant cat, I will NEVER forgive you! Now go find those balls!', 'angry');
    } else {
      await s.say('chichi', 'Vegeta, make sure Goku doesn\'t do anything stupid. ...More stupid than usual.', 'angry');
    }
  },
  c03_krillin_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('krillin', 'Hey, buddy!', 'happy'); return; }
    await s.talk([
      ['krillin', 'Master Roshi called. He says the Turtle saw a "shooting star" land on the beach behind Kame House.', 'neutral'],
      ['krillin', 'Of course he only noticed because he was out on the beach with his binoculars. Don\'t ask.', 'sad'],
    ]);
  },
  c03_18_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('android18', '...', 'neutral'); return; }
    await s.say('android18', 'The fate of the planet depends on a man collecting balls. Wonderful. Marron is asleep in the car, so be quick.', 'smirk');
  },
  c03_piccolo_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('piccolo', 'Hmph.', 'neutral'); return; }
    await s.talk([
      ['piccolo', 'Shenron is older than any of us. If a Saiyan god ever existed, he will know.', 'neutral'],
      ['piccolo', 'Dende sensed one of the balls fall near the Lookout. Climb Korin Tower and fly up from the top.', 'neutral'],
    ]);
  },
  c03_panchy_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('panchy', 'Would you like some tea, dear?', 'happy'); return; }
    if (s.has('c03_bento') || s.flag('c03_bentoTraded')) {
      await s.say('panchy', 'That nice purple kitty has eaten four cakes! I\'ll have to bake another.', 'happy');
      return;
    }
    await s.talk([
      ['panchy', 'Goku dear, you can\'t save the world on an empty stomach! I packed the best of the buffet for you.', 'happy'],
    ]);
    await s.give('c03_bento');
    await s.say('hero', 'Thanks, Mrs. Briefs! ...I\'ll try not to eat it all on the way.', 'happy');
  },
});

// ---------------------------------------------------------------- Satan City: the "Champion Orb" and the pudding
registerOverlay('satan_mansion', {
  npcs: [
    { id: 'c03_satan', sprite: 'mrSatan', x: 17, y: 10, dir: 'down', talk: 'c03_satan_talk', name: 'Mr. Satan', showIf: CH3, hideIf: 'c03_satanDone' },
  ],
  onEnter: 'c03_ballcheck',
});

registerOverlay('satan_plaza', {
  npcs: [{ id: 'c03_pastry', sprite: 'waiter', x: 28, y: 22, dir: 'right', talk: 'c03_pastry_talk', name: 'Pastry Chef', showIf: CH3 }],
  onEnter: 'c03_ballcheck',
});

registerScripts({
  c03_satan_talk: async (s) => {
    if (!s.check(CH3) || s.flag('c03_satanDone')) { await s.say('mrSatan', 'Hahaha! The champ is always happy to meet a fan!', 'happy'); return; }
    if (s.has('c03_pudding')) {
      s.take('c03_pudding');
      s.letterbox(true);
      await s.talk([
        ['hero', 'Mr. Satan! I brought pudding for Buu!', 'happy'],
        ['mrSatan', 'The Royal Pudding?! The legendary triple-layer?! BUU! BUUUU! Come quick!', 'shock'],
      ]);
      respawn(s, 'c03_buu', 'majinBuu', 19.5, 9, 'down');
      await s.walk('c03_buu', 18.5, 10, 1.5);
      await s.talk([
        ['majinBuu', 'Pudding?! For Buu?!', 'happy'],
        ['majinBuu', '*nom* ...Mmmm. Buu happy again. Cat man not get this one.', 'happy'],
        ['mrSatan', 'He\'s smiling! My best friend is smiling! You... you\'re a true hero. Second only to me, of course!', 'happy'],
        ['mrSatan', 'Here - the Champion Orb. A fan gave it to me. It has five little stars. I always thought they stood for my five world titles.', 'neutral'],
      ]);
      await giveBall(s, 'db5');
      await s.say('mrSatan', 'Don\'t tell the press I gave it away. Tell them I lent it to you, champion to... slightly-less-champion!', 'happy');
      s.set('c03_satanDone');
      await s.done('c03_champion');
      await s.walk('c03_buu', 19.5, 9, 1.5);
      removeIf(s, 'c03_buu');
      s.letterbox(false);
      return;
    }
    if (!s.flag('c03_satanAsked')) {
      s.set('c03_satanAsked');
      await s.talk([
        ['mrSatan', 'Well, well! If it isn\'t my old pal from the tournaments! Here for an autograph?', 'happy'],
        ['hero', 'I need that orange ball you\'ve got. The one with stars on it. Please?', 'neutral'],
        ['mrSatan', 'The Champion Orb? Out of the question! It\'s... sentimental!', 'angry'],
        ['mrSatan', '...Although. Buu has been sulking for hours. Some "purple cat" ate his pudding at a party and he won\'t come out of his room.', 'sad'],
        ['mrSatan', 'Cheer him up and the Orb is yours. He loves the Royal Pudding from the cafe on the plaza. Hint, hint.', 'smirk'],
      ]);
      await s.quest('c03_champion');
      return;
    }
    await s.say('mrSatan', 'The Royal Pudding! From the cafe on the south side of the plaza! Buu won\'t eat anything else!', 'angry');
  },
  c03_pastry_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('c03_pastry', 'Our cafe has the best desserts in Satan City. Mr. Satan said so himself!', 'happy'); return; }
    if (s.has('c03_pudding') || s.flag('c03_satanDone')) {
      await s.say('c03_pastry', 'Come back any time! Tell Mr. Satan the next one is on the house.', 'happy');
      return;
    }
    if (!s.check('quest:c03_champion')) {
      await s.say('c03_pastry', 'Today\'s special: the Royal Pudding. Mr. Satan\'s friend Buu orders twelve a day.', 'happy');
      return;
    }
    await s.talk([
      ['c03_pastry', 'A Royal Pudding for Buu? Of course! Mr. Satan has a running tab. A very, very long running tab.', 'happy'],
    ]);
    await s.give('c03_pudding');
  },
});

// ---------------------------------------------------------------- Kame House: the four-star ball on the beach
registerOverlay('kame_island', {
  npcs: [{ id: 'c03_roshi', sprite: 'roshi', x: 21, y: 13, dir: 'down', talk: 'c03_roshi_talk', name: 'Master Roshi', showIf: CH3 }],
  pickups: [{ id: 'c03_db4', item: 'db4', x: 12, y: 17, hidden: true, showIf: CH3 }],
  onEnter: 'c03_ballcheck',
});

registerScripts({
  c03_roshi_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('roshi', 'Ho ho! Come to train with the Turtle Hermit?', 'happy'); return; }
    if (s.has('db4')) {
      await s.talk([
        ['roshi', 'So it really was a Dragon Ball. The four-star, no less.', 'neutral'],
        ['roshi', 'That was your grandpa Gohan\'s ball, Goku. Funny how it always finds its way back to you.', 'happy'],
      ]);
      return;
    }
    await s.talk([
      ['roshi', 'Goku! Have you come to ask the Turtle Hermit about the "shooting star"?', 'happy'],
      ['roshi', 'Turtle saw it fall last night, on the sand west of the house, near the leaning palm. I was there for... astronomy. Yes.', 'smirk'],
      ['roshi', 'It must have buried itself. Use that radar of Bulma\'s, then search the sand with A.', 'neutral'],
    ]);
  },
});
