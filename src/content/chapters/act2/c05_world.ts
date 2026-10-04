import type { CharId } from '../../characters';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerOverlay } from '../../registry';

/**
 * Chapter 5 hub overlays: Master Roshi's charged-melee training at Kame House (silver quest, chapter 5 on)
 * and progress-tracking chatter while Frieza's army lands.
 */

const CH5 = 'chapter==5';
const ROSHI_STUDENTS: CharId[] = ['goku', 'vegeta', 'gohan', 'piccolo'];

registerOverlay('kame_island', {
  npcs: [{ id: 'c05_roshi', sprite: 'roshi', x: 26, y: 14, dir: 'left', talk: 'c05_roshi_talk', name: 'Master Roshi', showIf: 'chapter>=5' }],
});

registerOverlay('cc_yard', {
  props: [{ kind: 'c05_jacoShip', x: 28.5, y: 22, flag: CH5 }],
  npcs: [
    { id: 'c05_bulma', sprite: 'bulma', x: 24, y: 20, dir: 'down', talk: 'c05_bulma_talk', name: 'Bulma', showIf: `${CH5}&c05_called` },
    { id: 'c05_jacoNpc', sprite: 'jaco', x: 31, y: 25, dir: 'left', talk: 'c05_jaco_talk', name: 'Jaco', showIf: `${CH5}&c05_called` },
    { id: 'c05_goten', sprite: 'goten', x: 22, y: 21, talk: 'c05_kids_talk', name: 'Goten', showIf: `${CH5}&c05_called`, wander: 1 },
    { id: 'c05_trunks', sprite: 'trunksKid', x: 26, y: 21, talk: 'c05_kids_talk', name: 'Trunks', showIf: `${CH5}&c05_called`, wander: 1 },
  ],
});

registerOverlay('gohan_house', {
  npcs: [{ id: 'c05_videl', sprite: 'videl', x: 13, y: 7, dir: 'down', talk: 'c05_videl_talk', name: 'Videl', showIf: CH5 }],
});

registerOverlay('paozu_home', {
  npcs: [{ id: 'c05_chichi', sprite: 'chichi', x: 21, y: 9, dir: 'down', talk: 'c05_chichi_talk', name: 'Chi-Chi', showIf: CH5 }],
});

registerOverlay('satan_mansion', {
  npcs: [{ id: 'c05_satan', sprite: 'mrSatan', x: 17, y: 10, dir: 'down', talk: 'c05_satan_talk', name: 'Mr. Satan', showIf: CH5 }],
});

/** Lines Roshi uses when teaching each student. */
const LESSON: Record<string, Array<[string, string, ('neutral' | 'happy' | 'smirk' | 'angry' | 'shock')?]>> = {
  goku: [
    ['roshi', 'Goku, my boy! You\'ve become a god, and still you visit your old master. *sniff*', 'happy'],
    ['roshi', 'Gather your strength, hold it... and release it all in a storm of fists. The Flurry Punch!', 'neutral'],
  ],
  vegeta: [
    ['roshi', 'The Prince himself? Hmph. Fine, fine. Pride is just a heavy weight you carry into every fight.', 'smirk'],
    ['roshi', 'Gather it in both fists, leap, and bring it all down at once. The Two-Handed Smash!', 'neutral'],
  ],
  gohan: [
    ['roshi', 'Gohan, you\'ve grown soft behind that desk. Your legs remember, though. Plant, coil, and kick.', 'neutral'],
    ['roshi', 'Hold it until your whole body is a spring - then let go. The Super Kick!', 'happy'],
  ],
  piccolo: [
    ['roshi', 'The Namekian? Ho ho. You don\'t need my help... but you came anyway. Respect, young man. Respect.', 'happy'],
    ['roshi', 'Stand your ground, gather your ki, and spin - strike everything around you at once.', 'neutral'],
  ],
};

async function roshiLesson(s: ScriptApi): Promise<void> {
  const st = s.state;
  if (!s.check('quest:c05_roshi') && !s.check('done:c05_roshi')) {
    await s.talk([
      ['roshi', 'Ho ho! So, you want to learn the Turtle Hermit\'s secret technique?', 'happy'],
      ['roshi', 'Every fighter can store their strength and unleash it in one blow. I\'ll teach each of you the way that suits you best. Bring all your friends!', 'smirk'],
    ]);
    await s.quest('c05_roshi');
  }
  const me = s.hero;
  if (ROSHI_STUDENTS.includes(me) && !st.char(me).charged) {
    await s.talk(LESSON[me] ?? []);
    await s.learnCharged(me);
  } else if (st.char(me).charged) {
    await s.say('roshi', 'You already know my technique. Send me one of your friends!', 'neutral');
  } else {
    await s.say('roshi', 'Hmm, I\'m not sure my style suits you. But you\'re welcome to sit and watch the sea.', 'neutral');
  }
  const left = ROSHI_STUDENTS.filter((c) => !st.char(c).charged);
  if (left.length === 0 && !s.check('done:c05_roshi')) {
    await s.say('roshi', 'That\'s all of you trained! Not bad for an old turtle. Here, a little something I won at the races.', 'happy');
    await s.give('pow3');
    await s.done('c05_roshi', false);
    return;
  }
  if (left.length > 0) {
    const names = left.map((c) => ({ goku: 'Goku', vegeta: 'Vegeta', gohan: 'Gohan', piccolo: 'Piccolo' } as Record<string, string>)[c]);
    await s.say('roshi', `Still to train: ${names.join(', ')}. Switch at a save point and come see me.`, 'neutral');
  }
}

registerScripts({
  c05_roshi_talk: async (s) => {
    if (!s.check('chapter>=5')) { await s.say('roshi', 'Ho ho! Come back when you\'re stronger.', 'happy'); return; }
    await roshiLesson(s);
  },
  c05_bulma_talk: async (s) => {
    if (!s.check(CH5)) { await s.say('bulma', 'Hi, {hero}!', 'happy'); return; }
    if (s.check('quest:c05_mesa')) {
      await s.say('bulma', 'Gohan got hurt?! And Goku STILL isn\'t answering? I\'m going to have words with that angel.', 'angry');
      return;
    }
    await s.say('bulma', 'The Rocky Wasteland, Gohan! Fly from the world sign in West City. I\'ll keep trying Whis.', 'neutral');
  },
  c05_jaco_talk: async (s) => {
    if (!s.check(CH5)) { await s.say('jaco', 'Jaco of the Galactic Patrol. Elite.', 'happy'); return; }
    await s.say('jaco', 'My ship is fine. Mostly. The lawn is not. Please tell Bulma it was a "tactical landing".', 'sad');
  },
  c05_kids_talk: async (s) => {
    if (!s.check(CH5)) { await s.say('goten', 'Hi!', 'happy'); return; }
    await s.talk([
      ['trunksKid', 'Mom says we\'re "too young" to fight Frieza. We beat Buu! Kind of!', 'angry'],
      ['goten', 'Psst. If we sneak out, it\'s not really disobeying if we come back before dinner, right?', 'happy'],
    ]);
  },
  c05_videl_talk: async (s) => {
    if (!s.check(CH5)) { await s.say('videl', 'Shh, the baby\'s sleeping.', 'neutral'); return; }
    await s.say('videl', 'Pan finally fell asleep. Gohan, please... come home in one piece. We\'re both waiting.', 'sad');
  },
  c05_chichi_talk: async (s) => {
    if (!s.check(CH5)) { await s.say('chichi', 'Goku! Dinner!', 'angry'); return; }
    await s.say('chichi', 'My Gohan, fighting an ARMY? And Goku is off eating with angels! Somebody bring my baby home safe!', 'sad');
  },
  c05_satan_talk: async (s) => {
    if (!s.check(CH5)) { await s.say('mrSatan', 'Hahaha!', 'happy'); return; }
    await s.say('mrSatan', 'Frieza? Never heard of him. Probably some tribute act. Grandpa Satan is busy babysitting Pan, the strongest baby in the world!', 'happy');
  },
});
