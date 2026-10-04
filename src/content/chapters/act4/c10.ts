import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { actor, bout, clearActors, clearMooks, godWarp, HUB, patchUp, still, talker, timeTravel, who } from './util';

/**
 * CHAPTER 10 - "Gods of Universe 10" (Goku forced, Vegeta for the Rosé fight; L34-37).
 *
 * Beats (gold journal chain):
 *   c10_start          Resistance council in the future; Goku rides back alone to ask the gods     [c10_q_ask]
 *   c10_beerus_talk    Beerus & Whis on the Capsule Corp lawn -> Whis flies Goku to Universe 10      [c10_q_u10]
 *   c10_zamasu_talk    spar vs Zamasu (ends at 50%)              \
 *   c10_ring_shrine    the Time Ring cradle is empty               } both clues -> c10_beerusU_talk
 *   c10_erasure        Zamasu strikes Gowasu, Whis rewinds 3 minutes, Beerus erases Zamasu; Gowasu's
 *                      Time Ring; Shin brings the Zeno summons                                       [c10_q_zeno]
 *   c10_zeno_talk      Zeno befriends Goku and gives the Zeno Button                                 [c10_q_future]
 *   c10_bulma_pad      back to the future; Mai: Vegeta and Trunks went to Black's hideout             [c10_q_lair]
 *   c10_showdown       Vegeta vs Black (ends at 50%) -> Super Saiyan Rosé (story loss) -> Future Zamasu is
 *                      immortal (survive) -> the truth -> retreat, Future Yajirobe -> c11_start
 * Side: c10_q_babari (silver, Planet Babari + Babarian Chief), c10_q_medicine (bronze, carry escort).
 */

/** Make sure the props/flags a standalone Ch10 start needs exist (Cell's machine on the pad, Mai in the base). */
function ensureAct4World(s: ScriptApi): void {
  for (const f of ['c09_hopeCrashed', 'c09_hopeDestroyed', 'c09_cellOut', 'c09_blackDone', 'c09_arrivedFuture']) s.set(f);
}

registerScripts({
  // ================================================================== chapter start
  c10_start: async (s) => {
    ensureChapterState(s, 10);
    ensureAct4World(s);
    await s.chapter(10, 'Gods of Universe 10');
    if (s.field.def.id !== 'future_hideout_in') {
      s.set('world', 'future');
      await s.warp('future_hideout_in', HUB.hideoutIn.arriveX, HUB.hideoutIn.arriveY, 'up');
    }
    s.switchTo('trunks');
    s.letterbox(true);
    s.music('sad');
    actor(s, 'c10_goku', 'goku', 8, 11, 'right');
    actor(s, 'c10_vegeta', 'vegeta', 11, 11, 'left');
    talker(s, 'c09_fmai', 'futureMai', HUB.hideoutIn.maiX, HUB.hideoutIn.maiY, 'down', 'c09_mai_talk', 'Mai');
    s.place('hero', 9, 12, 'up');
    await s.talk([
      ['c10_goku', 'That ki Black had... it felt like a god\'s. Like Beerus or Whis. But it also kinda felt like mine.', 'sad'],
      ['c10_vegeta', 'A god wearing Kakarot\'s body? That\'s absurd.', 'angry'],
      ['c10_goku', 'That\'s why I wanna ask Beerus. If anybody knows about weird gods, it\'s a weird god.'],
      ['hero', 'Then Father and I will stay and guard the base. Black could come back at any moment.'],
      ['c10_vegeta', 'Hmph. Somebody has to keep the boy alive. Go, Kakarot. And don\'t dawdle.'],
      ['c09_fmai', 'Hurry back, Goku. And... thank you. All of you.', 'sad'],
    ]);
    clearActors(s, ['c10_goku', 'c10_vegeta']);
    force(s, 'goku');
    s.place('hero', 9, 12, 'up');
    await s.quest('c10_q_ask');
    await timeTravel(s, 'present', 'cc_yard', HUB.ccPad.arriveX, HUB.ccPad.arriveY + 1, 'Goku rides the time machine back to the present...');
    s.letterbox(true);
    s.music('town');
    await s.talk([
      ['bulma', 'Goku? Back already? Where are Vegeta and Trunks?!', 'shock'],
      ['hero', 'Guarding the Resistance base. I need to ask Beerus something about Black.'],
      ['bulma', 'Then you\'re in luck. He and Whis just ate everything in my fridge. They\'re out on the lawn, digesting.', 'angry'],
    ]);
    s.letterbox(false);
  },

  // ================================================================== Capsule Corp lawn
  c10_beerus_talk: async (s) => {
    const me = who(s, 'beerus');
    if (!s.check('quest:c10_q_ask')) {
      await s.say(me, 'Don\'t look at me like that. I\'m allowed to nap on any lawn I want. I\'m a god.', 'smirk');
      return;
    }
    s.letterbox(true);
    await s.talk([
      [me, 'Mmf. What? Can\'t you see I\'m digesting? Bulma\'s pudding was acceptable, by the way. Barely.', 'smirk'],
      ['hero', 'Lord Beerus, there\'s a guy in the future who looks just like me. His ki feels like a god\'s. Like yours.'],
      [me, '...A god\'s ki, in a mortal\'s body.', 'neutral'],
      [me, 'Hmph. That smells like Kai business. They\'re always poking their noses into the mortal worlds.', 'angry'],
    ]);
    // Whis drifts over from his spot on the lawn.
    const wh = s.exists('c04_whis') ? 'c04_whis' : 'c10_whisL';
    if (wh === 'c10_whisL') actor(s, wh, 'whis', 26, 21, 'left', 'Whis');
    still(s, wh);
    const b = s.actor(me === 'beerus' ? 'hero' : me);
    await s.walk(wh, Math.round((b.x - 8) / 16) + 2, Math.round((b.y - 14) / 16), 1.2);
    s.face(wh, 'hero');
    await s.talk([
      ['whis', 'If time travel is involved, my lord, the Time Rings come to mind. Only Supreme Kais and their apprentices are permitted to wear them.', 'smirk'],
      [me, 'Kais. Ugh. Fine. Universe 10\'s Supreme Kai, Gowasu, keeps a whole collection. He\'s the stuffy one with the tea.', 'angry'],
      ['whis', 'Everyone, place a hand on my back, please. Goku, that includes you. And no, you may not bring snacks.', 'happy'],
    ]);
    await s.done('c10_q_ask');
    s.unlockRegion('spot_u10');
    await s.quest('c10_q_u10');
    await godWarp(s, 'space', 'u10_sacred', HUB.u10.arriveX, HUB.u10.arriveY);
    await s.call('c10_u10_arrive');
  },

  // ================================================================== Universe 10
  c10_u10_arrive: async (s) => {
    s.set('c10_u10Arrived');
    s.letterbox(true);
    s.music('godly');
    // The tea-table Beerus and Whis (overlay NPCs, shown while the quest runs) walk in with Goku and then
    // stroll over to their table; stand-ins are only staged if they are not on the map.
    const godAt = (id: string, sprite: string, x: number): string => {
      if (s.exists(id)) {
        still(s, id);
        s.place(id, x, 21, 'up');
        return id;
      }
      actor(s, `${id}A`, sprite, x, 21, 'up');
      return `${id}A`;
    };
    const bee = godAt('c10_beerusU', 'beerus', 19);
    const whi = godAt('c10_whisU', 'whis', 21);
    await s.walkAll([['hero', 20, 16, 1.2], [bee, 19, 17, 1.2], [whi, 21, 17, 1.2]]);
    await s.talk([
      ['gowasu', 'Lord Beerus! And Whis! What an unexpected honour. Zamasu, tea for our guests, please.', 'happy'],
      ['zamasu', 'At once, master.'],
      ['hero', 'Hi! I\'m Goku! Nice garden!', 'happy'],
      ['zamasu', '...A mortal. Here. In the Sacred World.', 'angry'],
      ['gowasu', 'Zamasu.', 'neutral'],
      ['zamasu', '...Welcome, mortal.'],
      ['beerus', 'Ask your questions and don\'t break anything. I\'m going to find out whether this tea is any good.', 'smirk'],
    ]);
    // Off to the tea table (the overlay posts); stand-ins leave the scene once they get there.
    await s.walkAll([[bee, 25, 16, 1.4], [whi, 26, 16, 1.4]]);
    s.face(bee, 'left');
    s.face(whi, 'left');
    clearActors(s, ['c10_beerusUA', 'c10_whisUA']);
    await s.narrate('Speak with Gowasu and Zamasu. Lord Beerus is waiting by the tea table.');
    s.letterbox(false);
  },

  c10_gowasu_talk: async (s) => {
    const me = who(s, 'gowasu');
    if (!s.check('chapter>=10') || !s.flag('c10_u10Arrived')) {
      await s.say(me, 'Welcome to the Sacred World of Universe 10. Please mind the flowerbeds; they are older than most galaxies.', 'happy');
      return;
    }
    // Babari side quest: hand-in.
    if (s.check('quest:c10_q_babari') && s.has('c10_fruit')) {
      s.take('c10_fruit');
      await s.talk([
        [me, 'Oh my. A Babari fruit... from my tree. It still grows sweet after all these ages.', 'happy'],
        ['hero', 'The Babarians guard it like a treasure. Their chief has a REALLY big club.', 'happy'],
      ]);
      if (s.flag('c10_sawSlain')) {
        await s.talk([
          ['hero', 'There\'s something else. I found a Babarian who\'d been cut down clean. Not by a club. By a ki blade.', 'sad'],
          [me, 'A ki blade...? That is a technique of the Kais.', 'shock'],
          [me, '...I am sure there is an explanation.', 'sad'],
        ]);
      }
      await s.say(me, s.flag('c10_zamasuErased')
        ? 'I meant to share this with Zamasu. ...Please, take something for your trouble.'
        : 'I will share it with Zamasu. Perhaps it will show him that even savage worlds bear sweet things. Here, for your trouble.', 'sad');
      await s.give('pow3');
      await s.done('c10_q_babari', false);
      return;
    }
    if (s.flag('c10_zamasuErased')) {
      const n = s.inc('c10_gowasu_after');
      await s.say(me, n % 2
        ? 'I believed I could teach him. That every heart can learn. Perhaps that is still true, and I was simply not a good enough teacher.'
        : 'Keep the Time Ring safe, Goku. Whatever happens to time, you will remember what is true.', 'sad');
      await s.call('c10_babari_offer');
      return;
    }
    if (!s.flag('c10_gowasuTea')) {
      s.set('c10_gowasuTea');
      await s.talk([
        [me, 'Tea is a lesson in patience, young man. The leaves take a thousand years to mature. Mortals, too, take time to ripen.', 'happy'],
        ['hero', 'A thousand years? I\'d get so hungry.', 'shock'],
        [me, 'Ho ho! Lord Beerus said you were honest. You came about time travel? Then you came about the Time Rings.'],
        [me, 'We keep them in the shrine beyond the Potara tree, east of here. Only Kais may wear them. They let us observe the future of a world.'],
      ]);
      return;
    }
    if (!s.flag('c10_sparDone')) {
      await s.say(me, 'Zamasu is my pupil. Gifted. Earnest. A little... severe. Perhaps a bout with you would broaden his view.', 'happy');
      return;
    }
    await s.call('c10_babari_offer');
  },

  /** Gowasu offers the Babari errand and a Kai Kai teleport there. */
  c10_babari_offer: async (s) => {
    const me = who(s, 'gowasu');
    if (s.check('done:c10_q_babari') || !s.flag('c10_sparDone')) return;
    if (!s.check('quest:c10_q_babari')) {
      await s.talk([
        [me, 'Goku, might I ask a favour? Long ago I planted a fruit tree on the planet Babari. Zamasu has been visiting Babari to observe its people.'],
        [me, 'He finds them... disappointing. Bring me one of the tree\'s fruits. I would like to show him that even a savage world bears sweet things.'],
      ]);
      s.unlockRegion('c10_spot_babari');
      await s.quest('c10_q_babari');
    }
    const c = await s.ask(me, 'Shall I send you to Babari?', ['Send me!', 'Not now']);
    if (c !== 0) return;
    await godWarp(s, 'space', 'c10_babari', 6, 22);
  },

  c10_zamasu_talk: async (s) => {
    const me = who(s, 'zamasu');
    if (!s.check('chapter>=10') || !s.flag('c10_u10Arrived')) {
      await s.say(me, 'This is the Sacred World of the Kais. Mortals do not wander here.');
      return;
    }
    if (s.flag('c10_sparDone')) {
      const n = s.inc('c10_zamasu_n');
      const lines = [
        'Mortals were given the gift of life and spend it on war. Why do the gods simply watch?',
        'Master Gowasu believes in "patience." I have been patient for a very long time.',
        'Your Time Ring questions are tedious. If you wish to look at the future, mortal, simply wait. It arrives on its own.',
      ];
      await s.say(me, lines[n % lines.length], 'angry');
      return;
    }
    s.letterbox(true);
    await s.talk([
      ['hero', 'Hey, Zamasu! You look pretty strong. Wanna spar?', 'happy'],
      [me, 'You wish to fight me? Here?', 'angry'],
      ['gowasu', 'An excellent idea! A gentle bout, Zamasu. You may learn something.', 'happy'],
      [me, 'Learn. From a mortal. ...As you wish, master. The temple plaza, then.', 'angry'],
    ]);
    await s.fadeOut(12);
    clearActors(s, ['c10_zamasu']);
    s.place('hero', 20, 11, 'up');
    await s.fadeIn(12);
    s.letterbox(false);
    s.music('battle');
    const r = await bout(s, 'c10_zamasuSpar', { x: 20, y: 7, uid: 'c10_zamaspar', loseOk: true });
    s.letterbox(true);
    if (r === 'lose') {
      await s.talk([
        ['zamasu', 'Is this the mortal Lord Beerus speaks so highly of? How disappointing.', 'smirk'],
        ['gowasu', 'Now, now. A bout is not a verdict, Zamasu. Rest, Goku, and try again whenever you like.', 'happy'],
      ]);
      await s.fadeOut(12);
      clearActors(s, ['c10_zamaspar']);
      talker(s, 'c10_zamasu', 'zamasu', 22, 13, 'left', 'c10_zamasu_talk', 'Zamasu');
      s.place('hero', 20, 15, 'up');
      patchUp(s);
      s.music('godly');
      await s.fadeIn(12);
      s.letterbox(false);
      return;
    }
    await s.talk([
      ['zamasu', 'Hmph. Your power grows every time you are struck. Like a beast that learns to bite harder.', 'angry'],
      ['hero', 'Heh, thanks! ...Hey, wait. Your ki. It kinda reminds me of somebody.', 'shock'],
      ['zamasu', 'I cannot imagine who.', 'smirk'],
    ]);
    s.exp(52000);
    patchUp(s);
    s.set('c10_sparDone');
    await s.fadeOut(12);
    clearActors(s, ['c10_zamaspar']);
    talker(s, 'c10_zamasu', 'zamasu', 22, 13, 'left', 'c10_zamasu_talk', 'Zamasu');
    s.place('hero', 20, 15, 'up');
    await s.fadeIn(12);
    s.music('godly');
    if (!s.flag('c10_clueRing')) await s.say('hero', 'Gowasu said the Time Rings are in a shrine east of the garden. I should take a look.');
    else await s.say('hero', 'Something\'s bugging me. I should tell Beerus.');
    s.letterbox(false);
  },
  c10_zamasu_phase2: async (s) => {
    await s.say('zamasu', 'Enough play. Let me show you the difference between a god and a mortal.', 'angry');
  },

  c10_ring_shrine: async (s) => {
    if (!s.check('quest:c10_q_u10')) {
      await s.narrate('A shrine of white stone. Green light glimmers inside.');
      return;
    }
    await s.narrate('A long pedestal of white stone holds a row of green Time Rings. One cradle at the end sits empty, polished smooth from use.');
    await s.talk([
      ['hero', 'One of them\'s missing.'],
      ['gowasu', 'Ah, Zamasu has that one. He uses it to observe mortal worlds. He has been very... diligent, lately.'],
    ]);
    s.set('c10_clueRing');
    if (s.flag('c10_sparDone')) await s.say('hero', 'Something\'s bugging me. I should tell Beerus.');
    else await s.say('hero', 'Hmm. Maybe I should get to know Zamasu a little better. With my fists!', 'smirk');
  },

  c10_beerusU_talk: async (s) => {
    const me = who(s, 'beerus');
    if (!s.check('quest:c10_q_u10')) {
      await s.say(me, 'This tea is weak. Like everything in Universe 10.', 'angry');
      return;
    }
    if (!s.flag('c10_sparDone') || !s.flag('c10_clueRing')) {
      await s.say(me, 'Well? Go poke around. Talk to the Kais. See the rings. Whatever it is you mortals do when you "investigate".', 'angry');
      return;
    }
    await s.call('c10_erasure');
  },
  c10_whisU_talk: async (s) => {
    await s.say(who(s, 'whis'), 'Lovely garden. A shame the tea is so weak. Don\'t tell Lord Gowasu I said that.', 'smirk');
  },

  /** Zamasu shows his hand; Whis rewinds; Beerus erases him. Shin brings Zeno's summons. */
  c10_erasure: async (s) => {
    s.letterbox(true);
    s.music('tense');
    clearActors(s, ['c10_zamasu', 'c10_gowasu', 'c10_beerusU', 'c10_whisU']);
    const stage = (): void => {
      actor(s, 'c10_gow', 'gowasu', 20, 8, 'up');
      actor(s, 'c10_zam', 'zamasu', 20, 10, 'up');
      actor(s, 'c10_bee', 'beerus', 23, 15, 'left');
      actor(s, 'c10_whi', 'whis', 24, 15, 'left');
    };
    stage();
    s.place('hero', 18, 15, 'up');
    await s.talk([
      ['hero', 'Lord Beerus, I think-- hey, where did Gowasu and Zamasu go?'],
      ['c10_whi', 'The temple plaza, I believe. Zamasu asked to speak with his master. Alone.', 'neutral'],
    ]);
    await s.pan(20, 9, 30);
    await s.talk([
      ['c10_zam', 'Master. Why do the gods allow mortals to ruin everything they touch?', 'angry'],
      ['c10_gow', 'Because it is not our place to judge them, child. Only to watch over them. And to hope.', 'sad'],
      ['c10_zam', 'Then you are part of the problem.', 'angry'],
    ]);
    s.face('c10_gow', 'down');
    s.sfx('slash');
    s.flash('#f04060', 10);
    s.pose('c10_gow', 'ko');
    await s.wait(12);
    await s.say('hero', 'GOWASU!', 'shout');
    s.follow();
    await s.say('c10_whi', 'Tsk. Let\'s not.', 'angry');
    s.sfx('teleport');
    await s.fadeOut(24, '#ffffff');
    await s.narrate('Whis turned back time by three minutes.');
    stage();
    s.place('hero', 18, 15, 'up');
    await s.fadeIn(24);
    await s.pan(20, 9, 20);
    await s.say('c10_zam', 'Master. Why do the gods allow mortals to--', 'angry');
    s.sfx('teleport');
    s.place('c10_bee', 21, 10, 'left');
    s.flash('#c070f8', 6);
    await s.wait(8);
    await s.talk([
      ['c10_bee', 'I heard enough. Three minutes ago.', 'angry'],
      ['c10_zam', 'Lord Beerus? What is the meaning of--', 'shock'],
      ['c10_bee', 'Hakai.', 'angry'],
    ]);
    s.music('sad');
    await s.powerUp('c10_zam', '#c070f8', 50);
    s.remove('c10_zam');
    s.set('c10_zamasuErased');
    await s.wait(16);
    await s.talk([
      ['c10_gow', 'Zamasu...? Lord Beerus, what have you done?!', 'shock'],
      ['c10_bee', 'Saved your life, old man. Three minutes ago, your star pupil stabbed you in the back. Literally.', 'angry'],
      ['c10_whi', 'It is true, Lord Gowasu. I rewound the moment myself.', 'sad'],
      ['c10_gow', '...I believed I could teach him. I believed every heart could learn.', 'sad'],
    ]);
    s.follow();
    await s.walk('c10_gow', 19, 14, 0.8);
    s.face('c10_gow', 'hero');
    await s.talk([
      ['hero', 'So... was Zamasu the one behind Black? Is the future safe now?'],
      ['c10_whi', 'If he was, then it should be. Should.', 'neutral'],
      ['c10_gow', 'Goku. Take this. Whoever wears a Time Ring remembers the true course of time, even if history is rewritten around them.', 'sad'],
      ['c10_gow', 'Whatever comes... remember my apprentice. And what he might have been.', 'sad'],
    ]);
    await s.give('c10_timeRing');
    actor(s, 'c10_shin', 'supremeKai', 20, 20, 'up', 'Shin');
    s.sfx('teleport');
    s.flash('#ffffff', 8);
    await s.walk('c10_shin', 19, 16, 1.6);
    await s.talk([
      ['c10_shin', 'Goku! There you are! Lord Zeno is asking for you! Personally! Hurry, hurry, HURRY!', 'shock'],
      ['hero', 'Zeno? The little guy from the tournament? Sure, I\'ll go say hi!', 'happy'],
      ['c10_shin', 'Do NOT call him "little guy"!!', 'shock'],
    ]);
    await s.done('c10_q_u10');
    s.unlockRegion('spot_zeno');
    await s.quest('c10_q_zeno');
    await godWarp(s, 'space', 'zeno_palace', HUB.zeno.arriveX, HUB.zeno.arriveY, '#ffffff');
    await s.call('c10_zeno_arrive');
  },

  // ================================================================== Zeno's palace
  c10_zeno_arrive: async (s) => {
    s.letterbox(true);
    s.music('space');
    actor(s, 'c10_shin', 'supremeKai', 19, 21, 'up', 'Shin');
    await s.walkAll([['hero', 20, 9, 1.2], ['c10_shin', 19, 10, 1.2]]);
    await s.talk([
      ['grandPriest', 'Welcome, Son Goku. His Majesty has been looking forward to this.', 'happy'],
      ['c10_shin', 'Bow, Goku! Bow! Lower! LOWER!', 'shock'],
      ['hero', 'Hiya, Zeno!', 'happy'],
    ]);
    await s.emote('c10_shin', '...');
    clearActors(s, ['c10_shin']);
    s.letterbox(false);
  },
  c10_zeno_talk: async (s) => {
    const me = who(s, 'zeno');
    if (!s.check('quest:c10_q_zeno')) {
      await s.say(me, s.has('c10_zenoButton') ? 'Goku! You came to play? Press the button anytime, okay?' : 'Who are you? ...Okay, bye.', 'happy');
      return;
    }
    s.letterbox(true);
    await s.talk([
      [me, 'You\'re Goku! You were fun at the tournament. You fight and you laugh.', 'happy'],
      [me, 'Everyone here bows all the time. It\'s boring. I want a friend. Will you be my friend?'],
    ]);
    await s.ask(me, 'Will you be my friend?', ['Sure!', 'Uh... sure?']);
    await s.talk([
      ['hero', 'Sure! Friends it is... Zen-chan!', 'happy'],
      ['grandPriest', '"Zen-chan." How... novel.', 'smirk'],
      [me, 'Zen-chan! I like it! Here, Goku. Press this, and I\'ll come play. Anywhere. Okay?', 'happy'],
    ]);
    await s.give('c10_zenoButton');
    await s.say('grandPriest', 'Please use it... judiciously. When His Majesty plays, things tend to stop existing.', 'smirk');
    await s.done('c10_q_zeno');
    await s.quest('c10_q_future');
    await godWarp(s, 'earth', 'cc_yard', HUB.ccPad.arriveX, HUB.ccPad.arriveY + 1, '#ffffff');
    await s.say('hero', 'Zamasu\'s gone, and I made a new friend! Time to head back and tell Vegeta and Trunks. Bulma\'s at the time machine.', 'happy');
    s.letterbox(false);
  },
  c10_gp_talk: async (s) => {
    const me = who(s, 'grandPriest');
    await s.say(me, s.check('quest:c10_q_zeno') ? 'His Majesty is waiting, Son Goku. Do try not to be... yourself.' : 'The King of All is resting. Kindly whisper.', 'smirk');
  },

  // ================================================================== back to the future
  c10_bulma_pad: async (s) => {
    const me = who(s, 'bulma');
    if (s.check('quest:c10_q_future')) {
      const c = await s.ask(me, 'Fuel\'s topped up. Ready to head back to the future?', ['Let\'s go!', 'Not yet']);
      if (c !== 0) { await s.say(me, 'Don\'t take too long. Vegeta gets cranky when he\'s left waiting.'); return; }
      await s.call('c10_return');
      return;
    }
    if (s.check('quest:c10_q_ask')) {
      await s.say(me, 'Beerus and Whis are out on the lawn. Probably eating the lawn, at this point.', 'angry');
      return;
    }
    await s.say(me, 'Go do your god stuff. I\'ll keep the machine warm.', 'smirk');
  },
  c10_return: async (s) => {
    await s.done('c10_q_future');
    await timeTravel(s, 'future', 'future_hideout_in', HUB.hideoutIn.arriveX, HUB.hideoutIn.arriveY, 'Back to Trunks\'s era...');
    s.letterbox(true);
    s.music('tense');
    talker(s, 'c09_fmai', 'futureMai', HUB.hideoutIn.maiX, HUB.hideoutIn.maiY, 'down', 'c09_mai_talk', 'Mai');
    await s.walk('c09_fmai', 9, 10, 2);
    s.face('c09_fmai', 'hero');
    await s.talk([
      ['c09_fmai', 'Goku! You\'re back. Vegeta and Trunks went to Black\'s hideout. I found it yesterday, and they left at dawn.', 'shock'],
      ['hero', 'Huh? But Beerus erased Zamasu. Shouldn\'t Black be gone?'],
      ['c09_fmai', 'Black was here an hour ago. And he had someone with him. Green skin, white hair, an earring like his.', 'sad'],
      ['hero', '...Zamasu?!', 'shock'],
    ]);
    s.unlockRegion('c10_spot_lair');
    await s.quest('c10_q_lair');
    await s.call('c10_lair_ride');
  },
  /** Mai guides the hero to the edge of the hideout district. */
  c10_lair_ride: async (s) => {
    const c = await s.ask('c09_fmai', 'It\'s in the ruins east of the highway. I can take you to the edge of the district.', ['Take me there!', 'I need a minute']);
    if (c !== 0) {
      await s.say('c09_fmai', 'Then hurry. You can reach it from the world map too - I marked it for you.');
      s.letterbox(false);
      return;
    }
    await s.fadeOut(20);
    await s.warp('c10_lair', 16, 20, 'up');
    await s.say('hero', 'This is it. I can feel Vegeta\'s ki up ahead... and Black\'s.', 'angry');
    s.letterbox(false);
  },

  // ================================================================== Black's hideout
  /** Entering the hideout district. A save made mid-showdown must not leave the courtyard trigger spent. */
  c10_lair_enter: async (s) => {
    if (!s.flag('c10_lairDone')) s.clear('c10_showdownStarted');
  },

  c10_showdown: async (s) => {
    if (!s.check('quest:c10_q_lair') || s.flag('c10_lairDone') || s.flag('c10_showdownStarted')) return;
    s.set('c10_showdownStarted');
    s.letterbox(true);
    // Black's ki floods the courtyard; every hound and sentry in the ruins bolts.
    if (clearMooks(s, '#c03060') > 0) s.shake(12, 1);
    s.music('black');
    actor(s, 'c10_black', 'gokuBlack', 19, 3, 'left');
    actor(s, 'c10_veg', 'vegeta', 16, 5, 'up');
    actor(s, 'c10_tru', 'futureTrunks', 13, 6, 'up');
    s.place('hero', 16, 7, 'up');
    await s.pan(17, 4, 20);
    await s.talk([
      ['c10_black', 'Welcome, Son Goku. Tea? No? A pity. The leaves are very good this season.', 'smirk'],
      ['hero', 'Black! Where\'s Zamasu?!'],
      ['c10_black', 'Patience. Your prince was just about to entertain me.', 'smirk'],
      ['c10_veg', 'Stay out of this, Kakarot. He\'s mine.', 'angry'],
      ['hero', 'Aw, c\'mon...', 'sad'],
    ]);
    // Vegeta's fight.
    const vx = 16;
    const vy = 5;
    clearActors(s, ['c10_veg']);
    actor(s, 'c10_gok', 'goku', 14, 7, 'up');
    s.switchTo('vegeta');
    s.place('hero', vx, vy, 'up');
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 40);
    await s.wait(12);
    await s.say('hero', 'Super Saiyan Blue. A god\'s power in a Saiyan\'s body. Let\'s see how YOU like it.', 'smirk');
    s.follow();
    s.letterbox(false);
    clearActors(s, ['c10_black']);
    await bout(s, 'c10_black', { x: 18, y: 3, uid: 'c10_black1' });
    s.letterbox(true);
    await s.say('gokuBlack', 'Excellent. Truly. Then allow me to show you something beautiful.', 'smirk');
    const b = s.exists('c10_black1') ? s.actor('c10_black1') : null;
    const bx = b ? Math.round((b.x - 8) / 16) : 18;
    const by = b ? Math.round((b.y - 14) / 16) : 3;
    clearActors(s, ['c10_black1']);
    actor(s, 'c10_rose', 'gokuBlack', bx, by, 'down');
    await s.powerUp('c10_rose', '#f070b0', 60);
    s.sprite('c10_rose', 'blackRose');
    s.aura('c10_rose', '#f070b0');
    await s.wait(12);
    await s.talk([
      ['blackRose', 'Do you see it? A god\'s ki, poured into the finest body in the universe. I call it Super Saiyan Rosé.', 'smirk'],
      ['hero', 'Pink?! You\'re fighting me with PINK hair?!', 'shock'],
      ['blackRose', 'Beautiful, isn\'t it?', 'smirk'],
    ]);
    s.letterbox(false);
    clearActors(s, ['c10_rose']);
    const rr = await bout(s, 'c10_blackRose', { x: bx, y: by, uid: 'c10_rose1', survive: 45, loseOk: true, label: 'HOLD ON' });
    s.letterbox(true);
    if (rr === 'end' || rr === 'timeout') {
      // Vegeta held his own... so Black stops playing fair.
      await s.say('blackRose', 'Impressive, prince. Truly. Now let me stop holding back.', 'smirk');
      if (s.exists('c10_rose1')) {
        s.aura('c10_rose1', '#f070b0');
        await s.blast('c10_rose1', 'hero', '#f070b0');
      }
      s.flash('#f070b0', 10);
    }
    s.transformNow(null);
    s.pose('hero', 'ko');
    s.shake(20, 3);
    await s.wait(12);
    await s.say('blackRose', 'Pink suits me. Pain suits you, prince.', 'smirk');
    // Future Zamasu appears.
    s.sfx('teleport');
    s.flash('#b0f070', 10);
    actor(s, 'c10_fz', 'zamasu', 12, 2, 'right', 'Zamasu');
    await s.pan(14, 3, 20);
    await s.talk([
      ['c10_fz', 'You\'re making a mess of the garden, my friend.', 'smirk'],
      ['c10_gok', 'Zamasu?! But... Beerus erased you!', 'shock'],
      ['c10_fz', 'Erased? Ah. You mean the Zamasu of your time. How very sad for him.', 'smirk'],
    ]);
    // Goku steps in.
    const hv = s.actor('hero');
    actor(s, 'c10_vegDown', 'vegeta', Math.round((hv.x - 8) / 16), Math.round((hv.y - 14) / 16), 'up');
    s.pose('c10_vegDown', 'ko');
    s.pose('hero', null);
    clearActors(s, ['c10_gok']);
    s.switchTo('goku');
    s.place('hero', 14, 6, 'up');
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 30);
    await s.blast('hero', 'c10_fz', '#70c8f8');
    s.boom(12, 2, 26, '#70c8f8');
    await s.wait(30);
    await s.say('c10_fz', 'Is that all? Mortal ki, against a body that cannot be harmed.', 'smirk');
    s.follow();
    s.letterbox(false);
    clearActors(s, ['c10_fz']);
    await bout(s, 'c10_futureZamasu', { x: 13, y: 3, uid: 'c10_fz1', survive: 30, loseOk: true, label: 'SURVIVE' });
    s.letterbox(true);
    patchUp(s);
    await s.call('c10_truth');
  },

  c10_black_blade: async (s) => {
    s.flash('#c03060', 8);
    await s.wait(10);
    await s.talk([
      ['gokuBlack', 'Your fists are honest, prince. Let me answer with something sharper.', 'smirk'],
      ['hero', 'A blade made of ki? Hmph. Cute trick.', 'angry'],
    ]);
  },

  /** The truth about Black, Project Zero Mortals, and Trunks's flash. */
  c10_truth: async (s) => {
    s.music('black');
    await s.talk([
      ['zamasu', 'Do you understand now? I wished upon this world\'s Super Dragon Balls for a body that cannot die. Then I shattered them, so no mortal could wish it back.', 'smirk'],
      ['blackRose', 'And I... am Zamasu as well. Not of this world, Son Goku. Of YOURS - from before your Destroyer ever raised his hand.', 'smirk'],
      ['blackRose', 'I gathered the Super Dragon Balls of your time and traded bodies with its Son Goku. The finest body in all creation. Its owner, I killed. And his family, for good measure.', 'smirk'],
      ['hero', '...You did WHAT?', 'shout'],
      ['blackRose', 'Then my Time Ring carried me here, to the one friend who understood. Your Hakai came too late. It erased a Zamasu who had not yet acted. I already had.', 'smirk'],
      ['blackRose', 'And this earring? A keepsake from the Gowasu of this world. He was the first god we judged.', 'smirk'],
      ['zamasu', 'Gods and mortals, side by side? No. Only gods. A world cleansed of mortal sin. We call it Project Zero Mortals.', 'smirk'],
      ['c10_tru', 'Everyone, cover your eyes!', 'shout'],
    ]);
    s.flash('#ffffff', 30);
    s.sfx('explode');
    s.shake(30, 3);
    await s.fadeOut(30, '#ffffff');
    s.transformNow(null);
    await s.narrate('Trunks\'s blinding flash bought them a few seconds. It was enough to run.');
    await s.call('c10_retreat');
  },

  /** Back at the Resistance base: Future Yajirobe has dragged everyone home. */
  c10_retreat: async (s) => {
    s.set('world', 'future');
    await s.warp('future_hideout_in', HUB.hideoutIn.arriveX, HUB.hideoutIn.arriveY, 'up');
    s.letterbox(true);
    s.music('sad');
    actor(s, 'c10_vegH', 'vegeta', 7, 11, 'right');
    s.pose('c10_vegH', 'ko');
    actor(s, 'c10_truH', 'futureTrunks', 11, 11, 'left');
    actor(s, 'c10_yaji', 'yajirobe', 9, 12, 'up', 'Yajirobe');
    s.place('hero', 9, 10, 'down');
    await s.talk([
      ['c10_yaji', 'Hmph. Found you idiots lying in a crater on the highway. Dragged all three of you back. You owe me dinner. A big one.', 'angry'],
      ['c10_truH', 'Yajirobe? You\'re alive too!', 'shock'],
      ['c10_yaji', 'Course I am. Running away is a skill. You should all try it sometime.', 'smirk'],
      ['c10_vegH', 'Ngh... I... lost. To a man with Kakarot\'s face and pink hair.', 'hurt'],
      ['hero', 'He\'s immortal, Vegeta. The other one. I hit him with everything, and it didn\'t even leave a mark.', 'sad'],
    ]);
    s.exp(30000);
    s.heal();
    s.set('c10_lairDone');
    await s.done('c10_q_lair');
    clearActors(s, ['c10_vegH', 'c10_truH', 'c10_yaji']);
    s.letterbox(false);
    unforce(s);
    if (s.hasScript('c11_start')) await s.call('c11_start');
  },

  // ================================================================== Babari (silver)
  c10_babari_enter: async (s) => {
    if (s.exists('c10_slain')) s.pose('c10_slain', 'ko');
    if (s.flag('c10_babariSeen') || !s.check('quest:c10_q_babari')) return;
    s.set('c10_babariSeen');
    s.letterbox(true);
    await s.pan(30, 6, 50);
    await s.say('hero', 'There\'s the tree, up on the cliff! And a whole village of big guys with clubs between me and it.', 'smirk');
    s.follow();
    await s.narrate('The Kai stone by the landing site will send you back to Universe 10\'s Sacred World.');
    s.letterbox(false);
  },
  c10_chief_rally: async (s) => {
    s.shake(20, 2);
    await s.wait(8);
    await s.say('c10_babarianChief', 'HOO-RAAAH!! (He bangs his club on the ground. Warriors come running from the huts.)', 'shout');
  },
  c10_slain_talk: async (s) => {
    if (!s.check('quest:c10_q_babari')) {
      await s.narrate('A Babarian warrior lies here, perfectly still.');
      return;
    }
    s.set('c10_sawSlain');
    await s.talk([
      ['hero', 'This guy... he\'s gone. Cut down in one clean stroke.', 'sad'],
      ['hero', 'That\'s not a club wound. That\'s a ki blade. A really sharp one.', 'angry'],
    ]);
  },
  c10_chief_talk: async (s) => {
    const me = who(s, 'c10_babarianChief');
    if (!s.check('quest:c10_q_babari')) {
      await s.say(me, 'GRAAH! HOO-RAH! (He waves his club at the tree, then at you, then at the tree again.)', 'angry');
      return;
    }
    s.letterbox(true);
    await s.talk([
      [me, 'GRAAAH! (He plants himself between you and the sacred tree.)', 'angry'],
      ['hero', 'I just need one fruit! For Gowasu! ...You don\'t know who that is. Okay. Let\'s do this the Babarian way.', 'smirk'],
    ]);
    clearActors(s, ['c10_chief']);
    s.letterbox(false);
    s.music('battle');
    await bout(s, 'c10_babarianChief', { x: 30, y: 7, uid: 'c10_chief1' });
    s.letterbox(true);
    await s.say('c10_babarianChief', 'Hrrm... HOO. (He lowers his club, thumps his chest twice, and steps aside.)', 'hurt');
    s.exp(45000);
    patchUp(s);
    s.set('c10_chiefBeaten');
    clearActors(s, ['c10_chief1']);
    s.music('field');
    await s.say('hero', 'I think that means "go ahead". Thanks, big guy!', 'happy');
    s.letterbox(false);
  },
  c10_fruit_tree: async (s) => {
    if (!s.flag('c10_chiefBeaten')) {
      await s.narrate('Fat pink fruit hang from the sacred tree. The Babarian Chief is watching you very, very closely.');
      return;
    }
    if (!s.check('quest:c10_q_babari') || s.has('c10_fruit')) {
      await s.narrate('The sacred tree rustles in the warm wind.');
      return;
    }
    await s.give('c10_fruit');
    await s.say('hero', 'Got one! Back to the Kai stone.', 'happy');
  },
  c10_kaistone: async (s) => {
    const c = await s.ask('narrator', 'The Kai stone hums softly. Return to Universe 10\'s Sacred World?', ['Return', 'Stay']);
    if (c !== 0) return;
    await godWarp(s, 'space', 'u10_sacred', HUB.u10.arriveX, HUB.u10.arriveY);
  },

  // ================================================================== medicine run (bronze)
  c10_runner_talk: async (s) => {
    const me = who(s, 'resistance');
    if (s.check('done:c10_q_medicine')) {
      await s.say(me, 'Sora says the fever ward is already looking better. Thank you. Really.', 'happy');
      return;
    }
    if (!s.check('chapter>=10')) { await s.say(me, 'Keep your voice down. This close to his garden, even the rubble listens.'); return; }
    if (s.carrying) {
      s.drop();
      await s.talk([
        [me, 'The medicine! Not a single vial broken. You\'re a lifesaver. Literally.', 'happy'],
        [me, 'Take these. We found them in the pharmacy\'s back room. I think they\'re worth more to you than to us.'],
      ]);
      await s.done('c10_q_medicine', false);
      s.set('c10_medsDone');
      await s.give('senzu');
      await s.give('end1');
      return;
    }
    if (!s.check('quest:c10_q_medicine')) {
      await s.talk([
        [me, 'You\'re one of the fighters from the past? Listen, I need help. There\'s a pharmacy in the west alley with a case of medicine.'],
        [me, 'Fever\'s spreading at the base. But the hounds out here... I can\'t get past them.', 'sad'],
        [me, 'The vials are fragile. You won\'t be able to fight while you carry the case, and one hit will smash it. Bring it to me here.'],
      ]);
      await s.quest('c10_q_medicine');
      return;
    }
    await s.say(me, 'The pharmacy is in the west alley, past the hounds. Carry the case back without getting hit!');
  },
  c10_pharmacy: async (s) => {
    if (!s.check('quest:c10_q_medicine')) return;
    if (s.carrying) { await s.narrate('You\'re already carrying the medicine case. Careful!'); return; }
    await s.narrate('Behind the counter sits a sealed case of medicine vials. You lift it carefully. (You cannot attack while carrying it. One hit will break it.)');
    s.carry('Medicine Case', 'c10_medicine_broke');
  },
  c10_medicine_broke: async (s) => {
    await s.narrate('The vials shattered! There should be another case behind the pharmacy counter.');
  },
});
