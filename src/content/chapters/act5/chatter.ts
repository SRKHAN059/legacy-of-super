import { registerScripts, type ScriptApi } from '../../../game/script';
import { trophyCount } from './post';

/**
 * Act 5 hub chatter (LoG2 style: the people at home comment on whatever the hero has just done).
 * Chi-Chi and Goten at the Son house, Bulma and Vegeta at Capsule Corp, from Chapter 12 to the post-game.
 */

const EPISODES = ['c12_hit', 'c12_pan', 'c12_saiyaman', 'c12_krillin', 'c12_wish', 'c12_ball'] as const;

/** Where to find each Days of Peace episode, in Goten's words (he talks to his brother differently). */
function episodeHint(s: ScriptApi, q: (typeof EPISODES)[number]): string {
  const gohan = s.hero === 'gohan';
  switch (q) {
    case 'c12_hit': return 'Whis was giggling about an assassin. Ask him and Lord Beerus at Capsule Corp!';
    case 'c12_pan': return gohan
      ? 'Videl\'s looking for you, big brother! Pan learned to fly and Videl needs a babysitter. Not me. I\'m too young. Or too busy.'
      : 'Videl\'s in Paozu Valley by Gohan\'s house. She needs a babysitter. Not me. I\'m too young. Or too busy.';
    case 'c12_saiyaman': return gohan
      ? 'There\'s a movie director yelling outside the ZTV studio in Satan City. He wants YOU, big brother! You\'re late!'
      : 'There\'s a movie director yelling outside the ZTV studio in Satan City. He wants Gohan!';
    case 'c12_wish': return 'Trunks says his mom hid something under a sheet on the old time machine pad. She won\'t even let HIM look!';
    case 'c12_ball': return 'A big purple cat is eating everything at Capsule Corp! Trunks says he wants to challenge Lord Beerus to something.';
    default: return 'Krillin\'s at Kame House with Master Roshi. He sounded really, really sad on the phone.';
  }
}

/** How Goten addresses the active character. */
function gotenCalls(s: ScriptApi): string {
  return s.hero === 'goku' ? 'Dad' : s.hero === 'gohan' ? 'Big brother' : '{hero}';
}

/** True while the tournament runs (the party left for the World of Void and has not won yet). */
function midTournament(s: ScriptApi): boolean {
  return s.check('c14_departed&!c14_won');
}

/** Fighters signed for the Tournament of Power so far (Goku, Vegeta, Gohan, Piccolo and Buu start on the list). */
function fightersSigned(s: ScriptApi): number {
  if (s.check('done:c13_team')) return 10;
  return 5 + (s.check('done:c13_krillin') ? 2 : 0) + (s.check('done:c13_tien') ? 2 : 0) + (s.check('done:c13_17') ? 1 : 0);
}

/** Pick the next line from a rotating list (keyed by a counter flag). */
function rotate(s: ScriptApi, key: string, lines: string[]): string {
  return lines[(s.inc(key) - 1) % lines.length];
}

registerScripts({
  /** Chi-Chi at the Son house. */
  act5_chichi_talk: async (s) => {
    if (s.check('char:satan')) {
      await s.talk([
        ['chichi', 'Mr. Satan?! In MY yard? ...Well, since you\'re here, the radishes need weeding.', 'shock'],
        ['mrSatan', 'Ha... ha ha! The World Champion would be honoured to... weed. Yes.', 'shock'],
      ]);
      return;
    }
    if (s.flag('post_game')) {
      await s.say('chichi', rotate(s, 'act5_chichiPost', [
        s.hero === 'goku'
          ? 'The universe is saved, Bulma paid the prize money, and you spent your share on a new fishing rod. ONE fishing rod, Goku.'
          : 'The universe is saved, Bulma paid the prize money, and Goku spent his share on a new fishing rod. ONE fishing rod.',
        s.hero === 'goku'
          ? 'Goten says you turned silver during the tournament. Silver! As long as it washes out before Pan\'s birthday.'
          : 'Goten says Goku turned silver during the tournament. Silver! As long as it washes out before Pan\'s birthday.',
        `Trophies? ${trophyCount(s)} of 5 so far, I hear. I say there are radishes to pick.`,
      ]), 'smirk');
      return;
    }
    const goku = s.hero === 'goku';
    const gohan = s.hero === 'gohan';
    if (midTournament(s)) {
      await s.say('chichi', 'What are you doing HERE?! Aren\'t you supposed to be saving the universe right now? Go to Zeno\'s palace and get back on that stage!', 'angry');
      return;
    }
    if (s.check('chapter>=13')) {
      if (s.check('done:c13_team')) {
        await s.say('chichi', goku
          ? 'You put FRIEZA on your team? The one who... Goku, you are sleeping in the barn until this is over.'
          : 'Goku put FRIEZA on the team? The one who... When he gets home, he is sleeping in the barn until this is over.', 'angry');
        return;
      }
      const lines = [goku
        ? 'A tournament where whole universes get ERASED, and the prize for winning is... not being erased?! Goku, how could you!'
        : 'A tournament where whole universes get ERASED, and the prize for winning is... not being erased?! Wait until I get my hands on Goku!'];
      if (s.check('done:c13_gohan')) {
        lines.push(gohan
          ? 'You came home with your glasses broken and the biggest smile I\'ve seen on you in years. Piccolo, I swear...'
          : 'Gohan came home with his glasses broken and the biggest smile I\'ve seen on him in years. Piccolo, I swear...');
      } else {
        lines.push(gohan
          ? 'Fighting for the universe again, Gohan? You\'d better not skip your lectures for it. ...Well. Just this once.'
          : 'My Gohan, fighting for the universe again. He\'d better not skip his lectures for it. ...Well. Just this once.');
      }
      if (s.check('done:c13_17')) {
        lines.push(`Goten says he and Trunks are "rangers" on Monster Island now. If he comes home with a dinosaur, it lives with ${goku ? 'YOU' : 'Goku'}.`);
      }
      await s.say('chichi', rotate(s, 'act5_chichi13', lines), 'angry');
      return;
    }
    const done = EPISODES.filter((q) => s.check(`done:${q}`));
    if (done.length === 0) {
      await s.say('chichi', goku
        ? 'If you\'re so bored, go help your friends! Gohan, Videl, Krillin... half of Earth has called here this week.'
        : 'Goku is so bored he\'s punching tree stumps. Go and help your friends - and take him with you! Half of Earth has called here this week.', 'angry');
      return;
    }
    const lines: string[] = [];
    if (done.includes('c12_hit')) {
      lines.push(goku
        ? 'An ASSASSIN, Goku? You hired an assassin to attack yourself? ...I\'m not even surprised any more.'
        : 'Goku hired an ASSASSIN to attack himself. ...I\'m not even surprised any more.');
    }
    if (done.includes('c12_pan')) lines.push('Videl says Pan flew all the way to the highlands. Just like her grandpa, that girl. Heaven help us.');
    if (done.includes('c12_saiyaman')) {
      lines.push(gohan
        ? 'A brilliant scholar, in a MOVIE, Gohan? In a helmet and a cape! ...Is it out in theatres yet?'
        : 'My Gohan, a brilliant scholar, in a movie! In a helmet and a cape! ...Is it out in theatres yet?');
    }
    if (done.includes('c12_krillin')) lines.push('Krillin shaved his head again? 18 must be thrilled. Or furious. With her it\'s hard to tell.');
    if (done.includes('c12_wish')) {
      lines.push(goku
        ? 'Gohan told me. You gave the wish to Pan, for her fever. ...Thank you, Goku. That\'s all. Thank you.'
        : gohan
          ? 'Your father gave the wish to Pan, for her fever. ...Tell him thank you from me. And don\'t tell him I cried.'
          : 'Gohan told me. Goku gave the wish to Pan, for her fever. ...Tell him thank you from me.');
    }
    if (done.includes('c12_ball')) lines.push(goku ? 'BASEBALL? Against a god of destruction? ...Did you at least win?' : 'Goku played BASEBALL against a god of destruction. ...Did they at least win?');
    await s.say('chichi', rotate(s, 'act5_chichi12', lines), 'smirk');
  },

  /** Goten at the Son house: points to the Days of Peace episodes still open. */
  act5_goten_talk: async (s) => {
    if (s.check('char:satan')) {
      await s.say('goten', 'Whoa, Mr. Satan! Are you here to fight my dad? ...Ha ha, just kidding!', 'happy');
      return;
    }
    const who = gotenCalls(s);
    if (s.flag('post_game')) {
      await s.say('goten', rotate(s, 'act5_gotenPost', [
        `${who}! Uncle 17 let Trunks and me watch the WHOLE island while he was gone! ...We only lost one dinosaur. For a bit.`,
        s.hero === 'goku'
          ? 'Mom says you turned silver during the tournament! Can I turn silver too? Trunks says he\'ll do it first.'
          : 'Mom says Dad turned silver during the tournament. Can I turn silver too? Trunks says he\'ll do it first.',
      ]), 'happy');
      return;
    }
    if (midTournament(s)) {
      await s.say('goten', `${who}?! Is the tournament over? Did we win?! ...Wait, then why are you here?`, 'shock');
      return;
    }
    if (s.check('chapter>=13')) {
      await s.say('goten', `${who}, can Trunks and I fight in the tournament? ...Aww. When we fuse we're WAY stronger than Master Roshi!`, 'sad');
      return;
    }
    const open = EPISODES.filter((q) => !s.check(`done:${q}`));
    if (open.length === 0) {
      await s.say('goten', s.hero === 'goku'
        ? 'You helped EVERYBODY, Dad! Mom says you can stop being bored now. Please?'
        : `You helped EVERYBODY, ${who}! Now Dad has nothing left to do. Mom says that's even worse.`, 'happy');
      return;
    }
    const q = open[(s.inc('act5_gotenTalks') - 1) % open.length];
    await s.say('goten', episodeHint(s, q), 'happy');
  },

  /** Bulma at Capsule Corp: pregnant in Chapter 12, a new mother (and the Mighty Ten's sponsor) in Chapter 13. */
  act5_bulma_talk: async (s) => {
    if (s.check('char:satan')) {
      await s.say('bulma', 'Mr. Satan! Bulla, wave at the funny man! ...No, sweetie, we don\'t believe everything he says.', 'happy');
      return;
    }
    if (s.flag('post_game')) {
      await s.say('bulma', rotate(s, 'act5_bulmaPost', [
        `Ten million zeni times nine fighters. I'm sending the bill to Beerus. Oh, and the trophies? ${trophyCount(s)} of 5 so far.`,
        'Bulla has already pulled Beerus\'s tail twice. He let her. I think he\'s going soft.',
        'Whis says the Capsule Corp garden is his favourite restaurant in the universe. We are not a restaurant!',
      ]), 'smirk');
      return;
    }
    if (midTournament(s)) {
      await s.say('bulma', '{hero}?! Aren\'t you supposed to be in the World of Void?! Go to Zeno\'s palace - the Grand Priest can send you back to the stage. Hurry!', 'shock');
      return;
    }
    if (s.check('chapter>=13')) {
      if (s.check('done:c13_team')) {
        await s.say('bulma', 'Frieza. On OUR team. If he so much as looks at Bulla, Vegeta will... well. I\'ll let Vegeta handle it.', 'angry');
        return;
      }
      await s.say('bulma', `${fightersSigned(s)} of 10 fighters signed, at ten million zeni each. My accountant fainted. Twice. Go find the rest, {hero}!`, 'smirk');
      return;
    }
    if (s.check('done:c12_hit')) {
      await s.say('bulma', s.hero === 'goku'
        ? 'You paid an ASSASSIN to attack you? With whose money, Goku? ...Wait. Did Whis put that on my account?!'
        : 'Goku paid an ASSASSIN to attack him. With whose money? ...Wait. Did Whis put that on my account?!', 'angry');
      return;
    }
    await s.say('bulma', 'This baby kicks like a Saiyan. Vegeta won\'t let me lift anything heavier than a teacup. It\'s sweet. And SO annoying.', 'happy');
  },

  /** Vegeta at Capsule Corp: refuses to leave Bulma's side (Chapter 12), then guards the new baby (Chapter 13). */
  act5_vegeta_talk: async (s) => {
    const goku = s.hero === 'goku';
    if (s.check('done:c13_team')) {
      await s.say('vegetaCasual', goku
        ? 'You recruited FRIEZA. ...Fine. If he betrays us, I will throw him off the stage myself.'
        : 'Kakarot recruited FRIEZA. ...Fine. If he betrays us, I will throw him off the stage myself.', 'angry');
      return;
    }
    if (s.check('chapter>=13')) {
      await s.say('vegetaCasual', `Bulla is three days old and some god wants to erase her universe. Nobody erases my daughter${goku ? ', Kakarot' : ''}. Nobody.`, 'angry');
      return;
    }
    if (s.check('done:c12_hit')) {
      await s.say('vegetaCasual', goku
        ? 'You hired an assassin as a sparring partner? ...Hmph. Why didn\'t I think of that?'
        : 'Kakarot hired an assassin as a sparring partner? ...Hmph. Why didn\'t I think of that?', 'smirk');
      return;
    }
    await s.say('vegetaCasual', `Bulma is due any day. I am not leaving Capsule Corp. Go play with your little friends${goku ? ', Kakarot' : ''}.`, 'neutral');
  },
});
