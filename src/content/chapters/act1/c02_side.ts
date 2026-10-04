import type { Expression } from '../../../art/portrait';
import type { Dir } from '../../../engine/math';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { HUB } from './hubs';
import { arenaFight, scanCount, unlockSpot, type Errand } from './util';

/**
 * Chapter 2 side content and party chatter.
 * - Guests on the Princess Bulma react to the party's three phases (before Beerus, during the feast, after the heist).
 * - Bronze c02_scan: Bulma's Scouter field test (scan five guests).
 * - Silver c02_spar: the Satan Dojo sparring arena (LoG2 §11): Yamcha, then Krillin, then Tien; one bout per visit,
 *   no EXP; losing leaves the fighter on half HP outside the dojo door (ROM script 0x3B63B4); rewards STR+3, POW+3, END+3.
 * - Marina ambient NPCs.
 */

type Line = [string, string, Expression?];

/** Bulma's thanks for the Scouter field test. */
async function scanReward(s: ScriptApi): Promise<void> {
  await s.done('c02_scan', false);
  await s.give('pow1');
}

/**
 * Chapter 2's optional errands that die with the party: confronting Buu over the pudding runs Beerus's rampage
 * straight into Chapter 3, so c02_buu_talk warns first (`pointOfNoReturn`). The dojo sparring (c02_spar) stays open.
 */
export const C02_ERRANDS: Errand[] = [
  {
    quest: 'c02_scan',
    ready: (s) => scanCount(s) >= 5,
    deliver: async (s) => {
      await s.narrate('Vegeta grudgingly beamed the Scouter readings to Bulma\'s tablet. A delivery drone dropped a power capsule into his hand a minute later.');
      await scanReward(s);
    },
  },
];

/** Party phase for guest chatter. */
function phase(s: ScriptApi): 0 | 1 | 2 {
  if (s.flag('c02_heist')) return 2;
  if (s.flag('c02_beerusArrived')) return 1;
  return 0;
}

/** Register a guest whose talk is three lines (one per party phase), with an optional follow-up beat. */
function guest(id: string, speaker: string, lines: [Line[], Line[], Line[]], after?: (s: ScriptApi) => Promise<void>): Record<string, (s: ScriptApi) => Promise<void>> {
  return {
    [`${id}_talk`]: async (s) => {
      if (!s.check('chapter==2')) { await s.say(speaker, lines[0][0][1]); return; }
      await s.talk(lines[phase(s)]);
      if (once(s, `${id}_met`)) s.inc('c02_mingle');
      if (after) await after(s);
    },
  };
}

/** Master Roshi invites Vegeta to Kame House (world-map unlock). */
async function roshiInvite(s: ScriptApi): Promise<void> {
  if (s.state.data.regions.includes('spot_kame')) return;
  await s.say('roshi', 'If you ever need a quiet place to think, drop by Kame House. Bring snacks. Bring Bulma\'s mother\'s cookies.', 'happy');
  await unlockSpot(s, 'spot_kame');
}

function once(s: ScriptApi, flag: string): boolean {
  if (s.flag(flag)) return false;
  s.set(flag);
  return true;
}

registerScripts({
  ...guest('c02_krillin', 'krillin', [
    [['krillin', 'Vegeta! You came! Bulma owes me a thousand zeni. ...Don\'t tell her I said that.', 'happy']],
    [['krillin', 'Who\'s the purple guy? Why are you sweating? Vegeta, you\'re SWEATING.', 'shock'], ['krillin', 'Hey, that takoyaki tray... I didn\'t touch it. Nope.', 'smirk']],
    [['krillin', 'The Pilaf Gang? Those little kids? They used to be grown men, you know. Shenron\'s wishes are weird.']],
  ]),
  ...guest('c02_18', 'android18', [
    [['android18', 'Krillin dragged us here through two hours of traffic. In the end we flew. With the car.', 'smirk']],
    [['android18', 'Your guest has eaten three buffets. If he starts on the furniture, I\'m leaving.']],
    [['android18', 'Somebody stole the Dragon Balls during bingo? This party is better than I expected.', 'smirk']],
  ]),
  ...guest('c02_marron', 'c02_marron', [
    [['c02_marron', 'Mister, your hair is pointy! Can I touch it?', 'happy']],
    [['c02_marron', 'The kitty man ate my cupcake. He said "thank you" though.', 'sad']],
    [['c02_marron', 'Daddy said there\'s robots downstairs! Real ones!', 'happy']],
  ]),
  ...guest('c02_yamcha', 'yamcha', [
    [['yamcha', 'Vegeta! Glad you made it. Nice... armour? Shirt? Is that a shirt?', 'happy']],
    [['yamcha', 'I slapped the purple guy on the back and said "nice ears, buddy". Why is everyone staring at me?', 'shock']],
    [['yamcha', 'If there\'s a fight in the hold, call me! ...Actually, call Tien.']],
  ]),
  ...guest('c02_tien', 'tien', [
    [['tien', 'Chiaotzu and I came down from the mountains for Bulma. Parties are training for patience.']],
    [['tien', 'That guest. His ki... I can\'t sense anything at all. That frightens me more than any monster.', 'sad']],
    [['tien', 'Go. We\'ll keep the guests calm up here.']],
  ]),
  ...guest('c02_chiaotzu', 'chiaotzu', [
    [['chiaotzu', 'The buffet has seven kinds of dumplings! I counted twice.', 'happy']],
    [['chiaotzu', 'I tried to read the cat god\'s mind. It just said "pudding" over and over.']],
    [['chiaotzu', 'Tien says I\'m not allowed to telekinesis the robots. No fair.', 'sad']],
  ]),
  ...guest('c02_roshi', 'roshi', [
    [['roshi', 'Oh-ho! Vegeta! Lovely party. Lovely view. Lovely... view.', 'smirk']],
    [['roshi', 'That fellow\'s presence... in all my three hundred years, I have never felt anything like it. Keep him happy, boy.', 'shock']],
    [['roshi', 'Thieves on a cruise ship! In my day, we just let the turtle bite them.']],
  ], roshiInvite),
  ...guest('c02_oolong', 'c02_oolong', [
    [['c02_oolong', 'Free food, free drinks, and nobody\'s blown up the planet yet. Best birthday ever.', 'happy']],
    [['c02_oolong', 'Psst. If that guy wants to play rock-paper-scissors, don\'t pick me. I ALWAYS throw scissors.', 'shock']],
    [['c02_oolong', 'Hey, if the Dragon Balls are up for grabs... no. No. Not again. I\'ve learned my lesson. Mostly.']],
  ]),
  ...guest('c02_gohan', 'gohan', [
    [['gohan', 'Hi, Vegeta! Dad\'s not here yet. He said he was training at King Kai\'s.']],
    [['gohan', 'Vegeta, who is that? You\'re treating him like he\'s... dangerous.', 'shock'], ['gohan', 'A God of Destruction?! Okay. Okay. I\'ll keep Goten and Trunks away from him.', 'shock']],
    [['gohan', 'I\'ll watch the deck. You go find those thieves!']],
  ]),
  ...guest('c02_videl', 'videl', [
    [['videl', 'Bulma\'s ship is bigger than my dad\'s whole mansion. Don\'t tell him I said that.', 'smirk']],
    [['videl', 'Your friend keeps staring at the dessert table. Like, REALLY staring.']],
    [['videl', 'I\'m kind of tired tonight. Must be all the sea air.', 'happy']],
  ]),
  ...guest('c02_goten', 'goten', [
    [['goten', 'Vegeta! Trunks and me made friends with three little kids! They were super hungry so we fed them!', 'happy']],
    [['goten', 'The purple kitty is scary... but his friend gave me a cookie!', 'happy']],
    [['goten', 'Wait, the kids we fed were THIEVES? ...Oops.', 'shock']],
  ]),
  ...guest('c02_trunks', 'trunksKid', [
    [['trunksKid', 'Dad! You\'re actually here! Mom said you\'d come. I said you wouldn\'t. I owe her a chore.', 'smirk']],
    [['trunksKid', 'Dad, why are you bowing to that cat? You never bow to anybody.', 'shock']],
    [['trunksKid', 'I may have... unplugged the vault\'s force field earlier. To look at the Dragon Balls. Just a little.', 'sad']],
  ]),
  ...guest('c02_satan', 'mrSatan', [
    [['mrSatan', 'The Champ has arrived! Ha ha ha! Buu, don\'t eat the decorations!', 'happy']],
    [['mrSatan', 'That purple gentleman wants pudding? Buu has been guarding every cup since we got here...', 'shock']],
    [['mrSatan', 'Thieves?! Not to worry! The Champ will... supervise. From up here. Bravely.']],
  ]),
  ...guest('c02_piccolo', 'piccolo', [
    [['piccolo', '...I\'m here because Gohan asked. Don\'t make small talk with me.']],
    [['piccolo', 'Vegeta. That being could erase this planet with a sneeze. Whatever you\'re doing - keep doing it.', 'shock']],
    [['piccolo', 'Thieves are a distraction. Don\'t let him get bored.']],
  ]),
  ...guest('c02_brief', 'drBrief', [
    [['drBrief', 'Ah, Vegeta! The gravity room\'s new drones, how did they hold up? ...Ah. All of them? I see.']],
    [['drBrief', 'Fascinating ears on your guest. And the tail! I wonder if he\'d let me take measurements.', 'happy']],
    [['drBrief', 'The vault\'s force field was one of my best. Ruined by a child pulling the plug. Humbling.', 'sad']],
  ]),
  ...guest('c02_panchy', 'panchy', [
    [['panchy', 'Vegeta, dear! Have a cookie. Have two. You\'re so thin from all that training!', 'happy']],
    [['panchy', 'What a handsome young man your friend is! Purple is SUCH a good colour on him.', 'happy']],
    [['panchy', 'Oh my, an explosion? How exciting! More cake?', 'happy']],
  ]),
  ...guest('c02_chichi', 'chichi', [
    [['chichi', 'Goku said he\'d be "a little late". From King Kai\'s planet. In space. Hmph!', 'angry']],
    [['chichi', 'Goten! Stay away from that... cat person. Mommy doesn\'t like how he looks at the food.', 'shock']],
    [['chichi', 'If anyone hurt my Goten during that commotion, they\'ll answer to me!', 'angry']],
  ]),
  ...guest('c02_pilaf', 'pilaf', [
    [['pilaf', 'We are simple children enjoying a party. Nothing suspicious. Move along, spiky man!', 'smirk']],
    [['pilaf', 'Is the grand prize still the Dragon Balls? Just asking. As a child.']],
    [['pilaf', '...']],
  ]),
  ...guest('c02_mai', 'mai', [
    [['mai', 'Th-thank you for the food. We were stranded on an island for... a while.', 'sad']],
    [['mai', 'That boy with the purple hair is very nice. That doesn\'t mean anything. Shut up.', 'angry']],
    [['mai', '...']],
  ]),
  ...guest('c02_shu', 'shu', [
    [['shu', 'Emperor Pilaf says we\'re just here for the cake. ...We\'re just here for the cake!', 'happy']],
    [['shu', 'Do you know how to open a vault with a pink force field? Asking for a friend!']],
    [['shu', '...']],
  ]),

  c02_bulma_talk: async (s) => {
    if (!s.check('chapter==2')) { await s.say('bulma', 'Happy birthday to me!', 'happy'); return; }
    if (s.check('quest:c02_scan')) {
      const n = scanCount(s);
      if (n >= 5) {
        await s.talk([
          ['bulma', `${n} readings already? And it didn't explode once! I'm a genius.`, 'happy'],
          ['bulma', 'Take this as a thank-you. Dad says it\'s a power booster capsule. I say it\'s my birthday and I\'m feeling generous.'],
        ]);
        await scanReward(s);
        return;
      }
      await s.say('bulma', `Scouter test: ${n} of 5 guests scanned. Press SELECT, aim at someone and press A. Go on - Krillin won't mind!`);
      return;
    }
    const lines: Line[][] = [
      [['bulma', 'Isn\'t this ship amazing? I designed the pool myself. Now go mingle!', 'happy']],
      [['bulma', 'Your friend Beerus is fun! A bit grumpy. Is he an old classmate? He looks like a cat.', 'happy']],
      [['bulma', 'Vegeta, if you get the Dragon Balls back, I\'ll... I\'ll let you skip the next party. Deal.', 'smirk']],
    ];
    await s.talk(lines[phase(s)]);
  },

  // ---------------------------------------------------------------- marina ambient
  c02_steward_talk: async (s) => {
    if (s.flag('c02_rage')) { await s.say('c02_steward', 'The captain says the stage can be rebuilt. The captain is an optimist.', 'sad'); return; }
    await s.say('c02_steward', s.flag('c02_boarded')
      ? 'Welcome back aboard, sir. The party deck is straight up the gangway.'
      : 'Welcome aboard the Princess Bulma, Mr. Vegeta. Miss Bulma is waiting on the party deck. Please, the gangway is right behind me.');
  },

  c02_pier_man: async (s) => {
    await s.say('c02_pierMan', s.flag('c02_beerusArrived')
      ? 'Did you see that flash on the ship? Like lightning, but purple. And then everyone went very quiet.'
      : 'Capsule Corp built that ship. Imagine having enough money to throw a birthday party on a CRUISE LINER.');
  },

  c02_pier_woman: async (s) => {
    await s.say('c02_pierWoman', 'My dog won\'t stop barking at the ship. He did the same thing the day the Saiyans landed, years ago...');
  },

  // ---------------------------------------------------------------- Satan Dojo sparring arena
  c02_dojo_enter: async (s) => {
    s.clear('c02_sparToday');
    if (!s.check('chapter>=2') || s.flag('c02_dojoIntro') || s.check('c02_boarded&!c02_rage')) return;
    s.set('c02_dojoIntro');
    await s.wait(16);
    await s.talk([
      ['yamcha', 'Hey! Over here! Krillin, Tien and me rented the Satan Dojo for a little sparring. Mr. Satan said yes before he knew who we were.', 'happy'],
      ['krillin', 'One bout per visit, okay? We\'re not as young as we used to be. Beat Yamcha first, then me, then Tien.'],
    ]);
    await s.quest('c02_spar');
  },

  c02_spar_yamcha: async (s) => { await s.call('c02_spar_y'); },
  c02_spar_krillin: async (s) => { await s.call('c02_spar_k'); },
  c02_spar_tien: async (s) => { await s.call('c02_spar_t'); },

  c02_spar_y: async (s) => {
    await spar(s, {
      npc: 'c02_spYamchaNpc', enemy: 'c02_spYamcha', speaker: 'yamcha', beaten: 'c02_beatYamcha', reward: 'str3', need: null,
      intro: 'Ready to see the Wolf Fang Fist? I\'ve been practising! ...At the batting cages, mostly.',
      win: 'Okay, okay! I yield! You\'re way too strong. Here - a STR capsule. I was saving it for a date.',
      lose: 'Ha! The Wolf Fang Fist lives! Come back any time for a rematch.',
      after: 'Wanna know a secret? I lose to EVERYONE eventually. It\'s about the journey.',
    });
  },
  c02_spar_k: async (s) => {
    await spar(s, {
      npc: 'c02_spKrillinNpc', enemy: 'c02_spKrillin', speaker: 'krillin', beaten: 'c02_beatKrillin', reward: 'pow3', need: 'c02_beatYamcha',
      intro: 'Alright, my turn! I\'m a cop now, but I still remember the Destructo Disc. Don\'t worry, I\'ll aim it... somewhere else.',
      win: 'Phew! Okay, I\'m out. Take this POW capsule. 18 says I should stop buying "stuff for training I never do".',
      lose: 'Not bad, not bad! Rest up and try me again next visit.',
      after: 'Marron thinks I\'m the strongest guy in the world. Let\'s keep that between us.',
      wait: 'Beat Yamcha first! It\'s tradition. He insisted.',
    });
  },
  c02_spar_t: async (s) => {
    await spar(s, {
      npc: 'c02_spTienNpc', enemy: 'c02_spTien', speaker: 'tien', beaten: 'c02_beatTien', reward: 'end3', need: 'c02_beatKrillin',
      intro: 'I don\'t hold back in sparring. Neither should you. Begin.',
      win: '...Well fought. I concede. This END capsule is yours. Train hard.',
      lose: 'Your guard drops after you attack. Fix that, then come back.',
      after: 'Chiaotzu and I are opening a dojo someday. You\'re welcome to visit. Bring snacks for Chiaotzu.',
      wait: 'Prove yourself against Krillin first.',
    });
  },
});

interface SparOpts {
  npc: string;
  enemy: string;
  speaker: string;
  beaten: string;
  reward: string;
  need: string | null;
  intro: string;
  win: string;
  lose: string;
  after: string;
  wait?: string;
}

/** Where a lost spar drops the player: the far side of the dojo's own door (falls back to the mansion grounds). */
function dojoExit(s: ScriptApi): { map: string; x: number; y: number; dir: Dir } {
  const w = s.field.def.warps?.find((d) => d.door) ?? s.field.def.warps?.[0];
  if (w) return { map: w.to, x: w.tx, y: w.ty, dir: w.dir ?? 'down' };
  const [x, y] = HUB.satanDojo.outside;
  return { map: 'satan_mansion', x, y, dir: 'down' };
}

/**
 * One LoG2-style sparring bout: one per visit, no EXP, and no free heal. A win gives only the capsule; a loss
 * (ROM script 0x3B63B4) sets the fighter's HP to HPmax/2, EP untouched, and puts them outside the arena.
 */
async function spar(s: ScriptApi, o: SparOpts): Promise<void> {
  if (s.flag(o.beaten)) { await s.say(o.speaker, o.after, 'happy'); return; }
  if (o.need && !s.flag(o.need)) { await s.say(o.speaker, o.wait ?? 'Not yet.'); return; }
  if (s.flag('c02_sparToday')) { await s.say(o.speaker, 'That\'s enough for one visit. Come back later and we\'ll go again.'); return; }
  const c = await s.ask(o.speaker, o.intro, ['Let\'s fight!', 'Not now']);
  if (c !== 0) return;
  if (!s.check('quest:c02_spar') && !s.check('done:c02_spar')) await s.quest('c02_spar');
  s.set('c02_sparToday');
  const [rx, ry] = HUB.satanDojo.ring;
  if (s.exists(o.npc)) s.show(o.npc, false);
  const r = await arenaFight(s, o.enemy, { x: rx, y: ry, uid: `${o.enemy}_bout`, loseOk: true });
  if (s.exists(`${o.enemy}_bout`)) s.remove(`${o.enemy}_bout`);
  if (s.exists(o.npc)) s.show(o.npc, true);
  if (r === 'lose') {
    const c = s.state.char(s.hero);
    c.hp = Math.max(1, Math.floor(c.hpMax / 2));
    await s.say(o.speaker, o.lose, 'smirk');
    const out = dojoExit(s);
    await s.warp(out.map, out.x, out.y, out.dir);
    return;
  }
  await s.say(o.speaker, o.win, 'happy');
  s.set(o.beaten);
  await s.give(o.reward);
  if (s.flag('c02_beatYamcha') && s.flag('c02_beatKrillin') && s.flag('c02_beatTien')) await s.done('c02_spar', false);
}
