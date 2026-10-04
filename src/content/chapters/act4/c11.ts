import { registerScripts, type ScriptApi } from '../../../game/script';
import { QUESTS } from '../../quests';
import { ensureChapterState, force, unforce } from '../common';
import { actor, bout, boost, clearActors, clearMooks, HUB, patchUp, propOff, propOn, talker, timeTravel, unboost, who } from './util';

/**
 * CHAPTER 11 - "Project Zero Mortals" (Trunks forced, SSJ Rage; L37-40). LoG2 parallel: the Cell Games relay.
 *
 * Beats (gold journal chain):
 *   c11_start          Black & Zamasu find the Resistance; Trunks awakens Super Saiyan Rage (setForm) and holds
 *                      the line (survive); everyone rides back to the present                           [c11_q_mafuba]
 *   c11_roshi_talk     Roshi teaches the Evil Containment Wave (hand-sign quiz)                          [c11_q_urn]
 *   c11_lookout_enter  Mr. Popo lends Kami's old bottle (Sealing Urn); Vegeta is in the Room of Spirit and Time
 *                                                                                                    [c11_q_charm]
 *   c11_roshi_talk     Roshi hands over the charm (Goku pockets "it")                                    [c11_q_return]
 *   c11_bulma_pad      third trip: Black wrecks the time machine on arrival, Black clones in the city    [c11_q_rift]
 *   c11_showdown       point-of-no-return prompt -> Black Rose boss (Trunks) -> Mafuba ward puzzle on Future
 *                      Zamasu -> the "charm" is a ramen coupon -> Potara fusion -> Fused Zamasu relay: Goku (SSB)
 *                      -> Vegito Blue (outfit + survive timer) -> Trunks's Sword of Hope (beam struggle) -> Infinite
 *                      Zamasu strikes down the survivors -> Zeno Button -> Future Zeno erases the timeline ->
 *                      grief and farewell (Trunks stays in the party; leftover Act 4 errands are closed) -> c12_start
 * Side: c11_q_notes (silver, Bulma's notebook in the Capsule Corp ruins), c11_q_survivors (bronze).
 * After the finale: Roshi's porch payoff for the ramen coupon (c11_roshiP, Chapter 12+ until heard).
 */

/**
 * Act 4 side quests, by where they are finished. None can be finished once Chapter 11 ends (their NPCs and the
 * future are gone), and the present-day ones are out of reach once the third trip leaves (the machine is wrecked
 * on landing and only repaired in the finale). Both departures warn first; the epilogue closes what is left.
 */
const PRESENT_ERRANDS = ['c09_q_gohan', 'c09_q_homework', 'c10_q_babari'] as const;
const FUTURE_ERRANDS = ['c10_q_medicine', 'c11_q_notes', 'c11_q_survivors'] as const;

/** Journal titles of the listed side quests that are still open. */
function openErrands(s: ScriptApi, ids: readonly string[]): string[] {
  return ids.filter((id) => s.check(`quest:${id}`)).map((id) => QUESTS[id]?.title ?? id);
}

/** Take a quest that can no longer be finished out of the journal (and off the world-map stars). */
function dropQuest(s: ScriptApi, id: string): void {
  const d = s.state.data;
  delete d.journal[id];
  const i = d.journalOrder.indexOf(id);
  if (i >= 0) d.journalOrder.splice(i, 1);
}

/** Flags a standalone Chapter 11 needs (earlier act-4 beats). */
function ensureAct4World(s: ScriptApi): void {
  for (const f of ['c09_hopeCrashed', 'c09_hopeDestroyed', 'c09_cellOut', 'c09_blackDone', 'c09_arrivedFuture', 'c10_zamasuErased', 'c10_lairDone']) s.set(f);
  if (!s.has('c10_zenoButton')) s.state.give('c10_zenoButton', 1, 1);
  if (!s.has('c10_timeRing')) s.state.give('c10_timeRing', 1, 1);
}

/** Where Cell's time machine lands outside the Resistance hatch on the third trip (prop top-left, tiles). */
const CELL_F = { x: 19.4, y: 16.4 } as const;

/** The three Mafuba wards around Zamasu (tile positions on c11_rift_sky). */
const WARDS: Array<[string, number, number]> = [['c11_w1', 7, 9], ['c11_w2', 22, 9], ['c11_w3', 15, 15]];

registerScripts({
  // ================================================================== chapter start
  c11_start: async (s) => {
    ensureChapterState(s, 11);
    ensureAct4World(s);
    await s.chapter(11, 'Project Zero Mortals');
    s.set('world', 'future');
    await s.warp('future_hideout_out', HUB.hideoutOut.x, HUB.hideoutOut.y + 1, 'up');
    force(s, 'trunks');
    s.letterbox(true);
    s.music('tense');
    actor(s, 'c11_gk', 'goku', 15, 17, 'up');
    actor(s, 'c11_vg', 'vegeta', 19, 17, 'up');
    actor(s, 'c11_mai', 'futureMai', 17, 19, 'up', 'Mai');
    s.place('hero', 17, 16, 'up');
    if (s.exists('fc_lookout')) {
      await s.say('fc_lookout', 'Up there! Two of them! They found us!', 'shock');
      await s.walk('fc_lookout', 26, 14, 2);
      clearActors(s, ['fc_lookout']);
    }
    s.music('black');
    actor(s, 'c11_bk', 'gokuBlack', 16, 4, 'down');
    actor(s, 'c11_zm', 'zamasu', 19, 4, 'down');
    await s.pan(17, 8, 30);
    await s.walkAll([['c11_bk', 16, 8, 1], ['c11_zm', 19, 8, 1]]);
    await s.talk([
      ['c11_zm', 'So this is where the last mortals hide. Underground. Like insects beneath a stone.', 'smirk'],
      ['c11_bk', 'Then let us lift the stone. Project Zero Mortals: the final chapter of mortal history.', 'smirk'],
    ]);
    s.sfx('blast');
    s.boom(16, 12, 26, '#c03060');
    s.shake(30, 3);
    await s.wait(24);
    await s.talk([
      ['c11_mai', 'The hatch! There are children down there!', 'shock'],
      ['c11_bk', 'Children grow into mortals. That is rather the point.', 'smirk'],
    ]);
    s.follow();
    await s.say('hero', 'You took my mother. My master. My whole world. I won\'t let you take ONE more person!', 'shout');
    s.music('heroic');
    await s.powerUp('hero', '#88d8ff', 90);
    await s.wait(12);
    await s.setForm('trunks', 'rage');
    s.transformNow('rage');
    await s.talk([
      ['c11_bk', 'What is this? His ki... it keeps climbing.', 'shock'],
      ['c11_zm', 'Mortal anger. Loud, ugly and brief. Put it out, my friend.', 'angry'],
    ]);
    await s.powerUp('c11_bk', '#f070b0', 40);
    s.sprite('c11_bk', 'blackRose');
    // Trunks draws Black away from the broken hatch (and the children under it), out onto the open ground.
    await s.say('hero', 'Over here, Black! Your fight is with ME!', 'shout');
    await s.walkAll([['hero', 25, 15, 2.6], ['c11_bk', 25, 9, 2.2]]);
    s.face('hero', 'up');
    s.letterbox(false);
    clearActors(s, ['c11_bk']);
    s.music('zamasu');
    await bout(s, 'c11_blackRoseA', { x: 25, y: 9, uid: 'c11_roseA', survive: 30, loseOk: true, label: 'HOLD THE LINE' });
    s.letterbox(true);
    patchUp(s);
    await s.talk([
      ['blackRose', 'He... cut me. A mortal drew a god\'s blood.', 'shock'],
      ['c11_zm', 'Let them have this little victory. They have nowhere left to run. We will finish them at our leisure.', 'smirk'],
    ]);
    if (s.exists('c11_roseA')) await s.flyTo('c11_roseA', 25, -3, 3);
    await s.flyTo('c11_zm', 19, -3, 3);
    clearActors(s, ['c11_roseA', 'c11_zm']);
    s.transformNow(null);
    s.music('sad');
    await s.talk([
      ['c11_gk', 'Trunks, that was amazing! Your hair went all spiky and blue-ish!', 'happy'],
      ['c11_vg', 'Hmph. He gets that from me.', 'smirk'],
      ['c11_gk', 'But... the green one can\'t die. We can\'t beat somebody we can\'t kill.', 'sad'],
      ['hero', 'Then we don\'t kill him. We seal him. Gohan told me stories about Master Roshi\'s Evil Containment Wave. The Mafuba.'],
      ['c11_gk', 'Roshi! Of course! Let\'s go ask him!', 'happy'],
      ['c11_mai', 'Go. We\'ll hold out here. We always do.', 'sad'],
      ['hero', 'I\'ll come back for you, Mai. I promise.'],
      ['c11_mai', 'You\'d better.', 'smirk'],
    ]);
    clearActors(s, ['c11_gk', 'c11_vg', 'c11_mai']);
    await timeTravel(s, 'present', 'cc_yard', HUB.ccPad.arriveX, HUB.ccPad.arriveY + 1, 'Back to the present, with a plan...');
    s.letterbox(true);
    s.music('westCity');
    actor(s, 'c11_gk', 'goku', 29, 10, 'up');
    actor(s, 'c11_vg', 'vegeta', 34, 10, 'up');
    await s.talk([
      ['bulma', 'You\'re back! Is everyone-- why is Vegeta limping? Why is Goku smiling? What HAPPENED?', 'shock'],
      ['c11_vg', 'You two can go play with jars. I\'m going to the Room of Spirit and Time. One year in there, and that pink fool is finished.', 'angry'],
      ['c11_gk', 'Kame House it is! Come on, Trunks!', 'happy'],
    ]);
    clearActors(s, ['c11_gk', 'c11_vg']);
    await s.quest('c11_q_mafuba');
    s.letterbox(false);
  },

  // ================================================================== Kame House
  c11_kame_enter: async (s) => {
    // While an Act 4 Roshi is out on the porch (the Mafuba lessons in Chapter 11, the coupon payoff afterwards),
    // he stands in for the training-hall Roshi: never two Roshis at once.
    if ((s.exists('c11_roshi') || s.exists('c11_roshiP')) && s.exists('c05_roshi')) s.remove('c05_roshi');
  },

  c11_roshi_talk: async (s) => {
    const me = who(s, 'roshi');
    if (s.flag('c11_finaleDone')) {
      if (s.flag('c11_couponJoke')) {
        // The porch Roshi stays until the next visit; he still teaches like the training-hall Roshi he replaces.
        if (s.hasScript('c05_roshi_talk')) await s.call('c05_roshi_talk');
        else await s.say(me, 'Hohoho. A sealing charm and a ramen coupon look nothing alike. Nothing!', 'smirk');
        return;
      }
      s.set('c11_couponJoke');
      await s.talk([
        [me, 'So, it worked? Hohoho! I knew it would. You know, I found my charm on the table after you left...', 'smirk'],
        [me, '...And who took my ramen coupon?! One free large pork ramen! I was saving that!', 'angry'],
      ]);
      if (s.take('c11_coupon')) {
        await s.narrate('You handed the Ramen Coupon back to Master Roshi.');
        await s.say(me, 'Hohoho! Here, take this for your trouble. Don\'t tell Goku where you got it.', 'happy');
        await s.give('pow1');
      }
      return;
    }
    if (!s.check('chapter==11')) {
      await s.say(me, 'Hohoho. Come to learn from the Turtle Hermit? Come back when there\'s something worth teaching.', 'smirk');
      return;
    }
    if (s.check('quest:c11_q_mafuba')) { await s.call('c11_mafuba_lesson'); return; }
    if (s.check('quest:c11_q_urn') || s.check('quest:c11_q_charm')) {
      if (!s.has('c11_urn')) {
        await s.say(me, 'The bottle Kami was sealed in. Mr. Popo keeps it on the Lookout. Climb Korin Tower, then fly up. Go on!');
        return;
      }
      await s.call('c11_charm_handover');
      return;
    }
    await s.say(me, 'You did take the charm, right? The one on my table? ...Good, good. Hohoho.', 'happy');
  },

  c11_mafuba_lesson: async (s) => {
    const me = who(s, 'roshi');
    s.letterbox(true);
    actor(s, 'c11_gkK', 'goku', 23, 14, 'left');
    await s.talk([
      [me, 'The Evil Containment Wave? Hoho... you youngsters have no idea what you\'re asking. That technique cost my master his life.', 'sad'],
      ['hero', 'Please, Master Roshi. A god who cannot die is erasing my world. Sealing him is our only chance.'],
      ['c11_gkK', 'Teach me too! Two people who know it is better than one!', 'happy'],
      [me, 'Hmph. Fine, fine. Watch closely, both of you. I only have so much life left to spend on demonstrations.', 'smirk'],
    ]);
    await s.powerUp(me === 'roshi' ? 'hero' : me, '#60f080', 50);
    await s.wait(12);
    await s.narrate('Roshi swept his hands through a great arc. A green whirlwind rose from the sand... and swallowed one passing fly into an old rice cooker.');
    await s.talk([
      [me, 'Hah! ...Ahem. Yes. That is the gist of it. Now you!', 'happy'],
      ['c11_gkK', 'That\'s it? A fly?', 'shock'],
      [me, 'The principle is the same for flies and gods! Hand positions! Show me!', 'angry'],
    ]);
    let right = 0;
    if (await s.ask(me, 'First, the hands draw back, palms...', ['Facing each other', 'Facing the sky', 'In my pockets']) === 0) right++;
    if (await s.ask(me, 'Then the wave sweeps around the target in a...', ['Spiral', 'Straight line', 'Zigzag']) === 0) right++;
    if (await s.ask(me, 'And at the end, you shout...', ['"MAFUBA!"', '"KAMEHAMEHA!"', '"Excuse me!"']) === 0) right++;
    s.set('c11_mafubaScore', right);
    await s.say(me, right === 3
      ? 'Perfect form! You have the makings of a real Turtle School student, young man!'
      : `${right} out of 3... Close enough! The technique lives in the heart, not the hands. Mostly.`, right === 3 ? 'happy' : 'smirk');
    await s.narrate('Trunks and Goku learned the Evil Containment Wave!');
    await s.talk([
      [me, 'Now listen carefully, because this is the important part. You need TWO things.', 'neutral'],
      [me, 'A container, sturdy enough to hold what you seal. And a sealing charm, to close it. Without the charm, the seal breaks.'],
      [me, 'I\'ll write the charm myself. As for the container... Kami was once sealed in an old bottle. Mr. Popo still keeps it on the Lookout.'],
      ['c11_gkK', 'I\'ll wait here and practise on flies!', 'happy'],
    ]);
    await s.done('c11_q_mafuba');
    await s.quest('c11_q_urn');
    // Goku stays on the beach, practising (the overlay Goku takes over from the cutscene actor).
    if (s.exists('c11_gkK')) await s.walk('c11_gkK', 24, 14, 1.2);
    clearActors(s, ['c11_gkK']);
    talker(s, 'c11_gokuK', 'goku', 24, 14, 'left', 'c11_goku_kame', 'Goku');
    s.letterbox(false);
  },

  c11_charm_handover: async (s) => {
    const me = who(s, 'roshi');
    s.letterbox(true);
    const gk = s.exists('c11_gokuK') ? 'c11_gokuK' : 'c11_gkK';
    if (gk === 'c11_gkK') actor(s, 'c11_gkK', 'goku', 23, 14, 'left');
    await s.talk([
      [me, 'Kami\'s old bottle! Hoho, it hasn\'t aged a day. Good. And here\'s my side of the bargain...', 'happy'],
      [me, 'One sealing charm, written with my finest brush. It\'s right here on the table. Next to my, er, reading materials.', 'smirk'],
      [gk, 'I\'ll hang onto it! I\'ve got a pocket!', 'happy'],
      ['hero', 'Goku, please be careful with it.'],
      [gk, 'Don\'t worry! What could go wrong?', 'happy'],
    ]);
    s.sfx('item');
    await s.give('c11_charm');
    await s.done('c11_q_urn');
    await s.done('c11_q_charm');
    await s.quest('c11_q_return');
    await s.say(me, 'Off you go. And Trunks - come back alive. I\'d like to meet the man you grow into.', 'happy');
    await s.say(gk, 'I\'ll fly ahead and meet you at Capsule Corp! Bring the urn!', 'happy');
    await s.flyTo(gk, 24, -3, 3);
    clearActors(s, ['c11_gkK', 'c11_gokuK']);
    s.letterbox(false);
  },
  c11_goku_kame: async (s) => {
    const me = who(s, 'goku');
    if (s.check('quest:c11_q_urn')) {
      await s.say(me, 'Mafuba! ...Mafuba! ...Huh. Missed the fly again. You go get the urn, Trunks, I\'ll keep practising!', 'happy');
      return;
    }
    if (s.check('quest:c11_q_charm')) {
      await s.say(me, 'You got the urn? Great! Go show Roshi - he said the charm\'s on his table somewhere.', 'happy');
      return;
    }
    await s.say(me, 'Roshi\'s charm is safe in my pocket! ...I think it\'s this pocket.', 'happy');
  },

  // ================================================================== The Lookout
  c11_lookout_enter: async (s) => {
    if (!s.check('quest:c11_q_urn') || s.has('c11_urn')) return;
    s.letterbox(true);
    const popo = s.exists('ea_lk_popo') ? 'ea_lk_popo' : 'c11_popo';
    if (popo === 'c11_popo') actor(s, 'c11_popo', 'mrPopo', 33, 17, 'left', 'Mr. Popo');
    const h = s.actor('hero');
    const hx = Math.round((h.x - 8) / 16);
    const hy = Math.round((h.y - 14) / 16);
    await s.walk(popo, hx + 1, hy - 1, 1.4);
    s.face(popo, 'hero');
    s.face('hero', popo);
    await s.talk([
      [popo, 'Mr. Popo knew you would come. Dende saw it in the clouds.'],
      [popo, 'The old bottle. Kami was sealed inside it once, long ago. Mr. Popo has kept it polished. For emergencies.'],
    ]);
    await s.give('c11_urn');
    await s.talk([
      [popo, 'Vegeta entered the Room of Spirit and Time this morning. He said one year would be enough.', 'neutral'],
      [popo, 'Mr. Popo will need a new floor.', 'sad'],
      ['hero', 'Thank you, Mr. Popo. Back to Master Roshi.'],
    ]);
    // The journal (and the world-map star) now point back to Kame House.
    await s.done('c11_q_urn');
    await s.quest('c11_q_charm');
    await s.walk(popo, 33, 17, 1.2);
    if (popo === 'c11_popo') clearActors(s, ['c11_popo']);
    s.letterbox(false);
  },
  c11_htc_door: async (s) => {
    if (s.check('chapter==11') && !s.flag('c11_finaleDone')) {
      await s.narrate('The great door is hot to the touch. Through it, faintly, comes the sound of someone yelling "KAKAROT!" at regular intervals.');
      return;
    }
    await s.narrate('The door to the Room of Spirit and Time. A year inside is a single day out here.');
  },

  // ================================================================== Capsule Corp: the third trip
  c11_bulma_pad: async (s) => {
    const me = who(s, 'bulma');
    if (s.check('quest:c11_q_return') && s.has('c11_urn') && s.has('c11_charm')) {
      // Leaving is a point of no return for errands in the present (see PRESENT_ERRANDS).
      const left = openErrands(s, PRESENT_ERRANDS);
      if (left.length) {
        await s.say(me, 'One thing first. Once we land over there, nobody comes back until this is over. If you promised anybody here anything, now\'s the time!');
        await s.narrate(`(Unfinished in the present: ${left.join(', ')}.)`);
      }
      const c = await s.ask(me, 'Urn? Check. Charm? Goku says he has it. Ready for the third trip? This time I\'m coming too.', ['Let\'s go!', 'Not yet']);
      if (c !== 0) { await s.say(me, 'Don\'t take too long. Who knows what those two are doing over there.'); return; }
      await s.call('c11_third_trip');
      return;
    }
    if (s.check('quest:c11_q_mafuba') || s.check('quest:c11_q_urn') || s.check('quest:c11_q_charm')) {
      await s.say(me, 'Roshi lives at Kame House, out on the southern sea. Go! I\'ll have the machine fuelled by the time you\'re back.');
      return;
    }
    await s.say(me, 'I\'ll get the machine running. I always get it running.', 'smirk');
  },

  c11_third_trip: async (s) => {
    s.letterbox(true);
    await s.done('c11_q_return');
    actor(s, 'c11_gk', 'goku', 29, 10, 'up');
    actor(s, 'c11_vg', 'vegeta', 24, 10, 'right');
    await s.walk('c11_vg', 34, 10, 1.6);
    await s.talk([
      ['c11_vg', 'Took you long enough.', 'smirk'],
      ['c11_gk', 'Vegeta! Whoa, your ki is crazy! How long were you in there?', 'happy'],
      ['c11_vg', 'A year. Long enough to stop being angry at Kakarot\'s face. Mostly.', 'smirk'],
      ['c11_gk', 'Got the urn, got the charm! Let\'s go!', 'happy'],
    ]);
    clearActors(s, ['c11_gk', 'c11_vg']);
    s.set('c11_inFuture');
    await timeTravel(s, 'future', 'future_hideout_out', HUB.hideoutOut.x, HUB.hideoutOut.y + 1, 'The third trip to the future...');
    s.letterbox(true);
    s.music('black');
    // Cell's old egg sets down beside the hatch... for about two seconds.
    propOff(s, 'c11_wreckF');
    propOn(s, 'c09_cellMachine', CELL_F.x, CELL_F.y, 'c11_cellF');
    actor(s, 'c11_gk', 'goku', 15, 17, 'up');
    actor(s, 'c11_vg', 'vegeta', 19, 15, 'up');
    actor(s, 'c11_bu', 'bulma', 17, 19, 'up');
    s.place('hero', 17, 16, 'up');
    await s.pan(18, 18, 20);
    await s.wait(20);
    s.sfx('blast');
    s.flash('#c03060', 10);
    s.boom(CELL_F.x + 1, CELL_F.y + 1, 28, '#c03060');
    propOff(s, 'c11_cellF');
    propOn(s, 'c11_cellWreck', CELL_F.x, CELL_F.y, 'c11_wreckF');
    s.shake(30, 3);
    for (const id of ['c11_gk', 'c11_vg', 'c11_bu']) s.face(id, 'right');
    s.face('hero', 'right');
    await s.emote('c11_bu', '!');
    await s.talk([
      ['c11_bu', 'MY TIME MACHINE!! He shot it the second we landed!', 'shock'],
      ['c11_bu', '...Fine. FINE. I\'ll fix it. I always fix it. Go! I\'ll set up in Future me\'s lab.', 'angry'],
    ]);
    // Mai climbs out of the hatch.
    actor(s, 'c11_mai', 'futureMai', 17, 12, 'down', 'Mai');
    await s.walk('c11_mai', 17, 14, 1.6);
    await s.talk([
      ['c11_mai', 'Trunks! You came back! Black has made copies of himself. The city is crawling with them!', 'shock'],
      ['c11_mai', 'And the sky over the old plaza... it\'s torn open. Look.', 'sad'],
    ]);
    await s.pan(26, 3, 40);
    s.tint('rgba(110,30,90,0.25)');
    await s.say('hero', 'The rift... That\'s where they\'ll be. South end of the main street, past the city.', 'angry');
    s.follow();
    await s.quest('c11_q_rift');
    await s.talk([
      ['c11_mai', 'Trunks... if you pass Capsule Corp, your mother\'s notebook is still in her vault. Please. Don\'t let it burn with everything else.', 'sad'],
      ['hero', 'I\'ll find it. Stay safe, Mai.'],
    ]);
    await s.quest('c11_q_notes', true);
    clearActors(s, ['c11_gk', 'c11_vg', 'c11_bu', 'c11_mai']);
    s.letterbox(false);
  },

  // ================================================================== the plaza under the rift
  /** The south end of the ruined avenue: the way down to the plaza. */
  c11_to_rift: async (s) => {
    if (!s.check('chapter==11&c11_inFuture') || s.flag('c11_finaleDone')) return;
    if (!s.flag('c11_riftNear')) {
      s.set('c11_riftNear');
      s.shake(20, 1);
      await s.say('hero', 'The air down here tastes like lightning... The plaza is right under the rift. They\'re waiting for me.', 'angry');
    }
    await s.warp('c11_rift_sky', 14, 18, 'up');
  },

  /** Entering the plaza. Also undoes anything a mid-finale save could have frozen in place. */
  c11_rift_enter: async (s) => {
    if (s.flag('c11_finaleDone')) return;
    s.clear('c11_finaleLock');
    s.clear('c11_sealOpen');
    if (s.state.char('vegeta').outfit === 'vegitoBlue') s.outfit('vegeta', null);
    unboost(s, 'vegeta');
    if (s.check('chapter==11') && s.hero !== 'trunks' && s.state.char('trunks').joined) force(s, 'trunks');
    if (!s.check('quest:c11_q_rift') || s.flag('c11_riftSeen')) return;
    s.set('c11_riftSeen');
    s.letterbox(true);
    await s.pan(15, 4, 50);
    s.shake(30, 1);
    await s.narrate('Above the old city plaza, the sky hangs open like a wound. Pink light drips from it, and every drop is another Black.');
    await s.pan(14, 13, 30);
    await s.say('hero', 'The clones are guarding the plaza. Black and Zamasu must be just past them. ...There\'s a save point by the barricades.', 'angry');
    s.follow();
    s.letterbox(false);
  },

  c11_showdown: async (s) => {
    if (!s.check('quest:c11_q_rift') || s.flag('c11_finaleDone') || s.flag('c11_finaleLock')) return;
    // Point of no return: the finale runs straight into the end of this timeline.
    const open = openErrands(s, FUTURE_ERRANDS);
    await s.narrate(open.length
      ? `Black and Zamasu are waiting just ahead. Once this battle begins there is no turning back, and anything left undone in this time stays undone. (Unfinished: ${open.join(', ')}.)`
      : 'Black and Zamasu are waiting just ahead. Once this battle begins, there is no turning back.');
    if (await s.ask('narrator', 'Face them now?', ['Face them', 'Not yet']) !== 0) {
      const h = s.actor('hero');
      s.place('hero', Math.round((h.x - 8) / 16), 15, 'down');
      return;
    }
    s.set('c11_finaleLock');
    force(s, 'trunks');
    s.letterbox(true);
    // Black's clones on the plaza freeze mid-swing, then fade back into the rift: the duel is his alone.
    if (clearMooks(s, '#f070b0') > 0) s.shake(12, 1);
    s.music('black');
    actor(s, 'c11_bk', 'blackRose', 14, 6, 'down');
    actor(s, 'c11_zm', 'zamasu', 17, 5, 'down');
    actor(s, 'c11_gk', 'goku', 11, 15, 'up');
    actor(s, 'c11_vg', 'vegeta', 18, 15, 'up');
    s.place('hero', 14, 14, 'up');
    await s.pan(15, 6, 30);
    await s.talk([
      ['c11_bk', 'You came. Good. I wanted you to see this.', 'smirk'],
      ['c11_zm', 'Look up, mortals. The sky itself weeps for you.', 'smirk'],
    ]);
    await s.powerUp('c11_bk', '#f070b0', 50);
    s.flash('#f070b0', 12);
    s.shake(40, 3);
    await s.wait(14);
    await s.talk([
      ['c11_bk', 'My justice will not be held by one body. My scythe cuts the sky, and from every cut, I am born again!', 'shout'],
      ['hero', 'Goku. Father. Leave Black to me. I owe him for my mother.', 'angry'],
      ['c11_vg', '...Go, then. Make it count.'],
    ]);
    s.follow();
    s.transformNow('rage');
    await s.powerUp('hero', '#88d8ff', 40);
    s.letterbox(false);
    clearActors(s, ['c11_bk']);
    s.music('zamasu');
    await bout(s, 'c11_blackRoseB', { x: 14, y: 6, uid: 'c11_rose1' });
    s.letterbox(true);
    // With Black down, his copies flicker out like reflections in broken glass.
    if (clearMooks(s, '#f070b0') > 0) {
      s.sfx('teleport');
      s.flash('#f070b0', 8);
      await s.wait(10);
    }
    s.set('c11_roseBeaten');
    s.exp(120000);
    patchUp(s);
    await s.talk([
      ['blackRose', 'A mortal... wounding a god... again...', 'hurt'],
      ['c11_zm', 'Step aside, my friend. Let them try their little trick. It will change nothing.', 'smirk'],
      ['c11_gk', 'Now, Trunks! The Mafuba!', 'shout'],
    ]);
    await s.call('c11_seal');
  },
  c11_rose_scythe: async (s) => {
    s.flash('#f070b0', 10);
    await s.wait(12);
    await s.say('blackRose', 'Do you feel it? The scythe of my justice!', 'shout');
  },
  c11_rose_clones: async (s) => {
    s.shake(20, 2);
    await s.say('blackRose', 'Come, my other selves! Show this mortal what a god looks like in numbers!', 'shout');
  },

  /** The Mafuba: strike all three wards, then hurt Zamasu while the circle holds. */
  c11_seal: async (s) => {
    // Black kneels at the edge of the circle while the seal is attempted.
    const rb = s.exists('c11_rose1') ? s.actor('c11_rose1') : null;
    clearActors(s, ['c11_rose1']);
    actor(s, 'c11_bk', 'blackRose', rb ? Math.round((rb.x - 8) / 16) : 12, rb ? Math.round((rb.y - 14) / 16) : 7, 'down');
    s.pose('c11_bk', 'hurt');
    await s.narrate('Trunks set the urn down. Three of Roshi\'s paper wards drifted into place around Zamasu.');
    await s.narrate('Strike all three wards to close the Mafuba circle. While it holds, Zamasu\'s body can be hurt!');
    clearActors(s, ['c11_zm']);
    s.clear('c11_sealOpen');
    const spawnWards = (): void => {
      for (const [id, x, y] of WARDS) {
        s.clear(`defeated:${id}`);
        if (!s.exists(id)) s.spawnEnemy('c11_ward', x, y, id);
      }
    };
    spawnWards();
    let over = false;
    let openT = 0;
    const watch = (async () => {
      while (!over) {
        await s.wait(6);
        if (over) break;
        if (!s.flag('c11_sealOpen')) {
          if (WARDS.every(([id]) => s.flag(`defeated:${id}`))) {
            s.set('c11_sealOpen');
            openT = 600;
            s.flash('#80f080', 8);
            s.sfx('powerUp');
            s.toast('The Mafuba circle holds! Strike Zamasu now!');
          }
        } else {
          openT -= 6;
          if (openT <= 0) {
            s.clear('c11_sealOpen');
            s.toast('The wards burned out! Strike them again!');
            spawnWards();
          }
        }
      }
    })();
    s.letterbox(false);
    s.music('zamasu');
    await bout(s, 'c11_zamasuSeal', { x: 15, y: 6, uid: 'c11_zseal' });
    over = true;
    await watch;
    clearActors(s, WARDS.map(([id]) => id));
    s.clear('c11_sealOpen');
    s.letterbox(true);
    s.exp(90000);
    patchUp(s);
    const z = s.exists('c11_zseal') ? s.actor('c11_zseal') : null;
    const zx = z ? Math.round((z.x - 8) / 16) : 15;
    const zy = z ? Math.round((z.y - 14) / 16) : 6;
    clearActors(s, ['c11_zseal']);
    actor(s, 'c11_zm', 'zamasu', zx, zy, 'down');
    actor(s, 'c11_urn', 'c11_ward', 15, 11, 'down', 'Urn');
    await s.say('hero', 'EVIL... CONTAINMENT...', 'shout');
    await s.powerUp('hero', '#60f080', 40);
    await s.wait(10);
    await s.say('hero', 'WAVE!!', 'shout');
    s.sfx('beam');
    await s.walk('c11_zm', 15, 11, 3);
    s.remove('c11_zm');
    s.flash('#60f080', 14);
    s.shake(20, 2);
    await s.wait(16);
    await s.talk([
      ['hero', 'He\'s in! Goku, the charm! Quick, before he breaks out!', 'shout'],
      ['c11_gk', 'Right! Charm, charm... here!', 'happy'],
      ['c11_gk', '...Huh. Trunks? Why does it say "One free large pork ramen"?', 'shock'],
    ]);
    s.take('c11_charm');
    await s.give('c11_coupon');
    await s.talk([
      ['hero', 'WHAT?!', 'shock'],
      ['c11_gk', 'There were two papers on Roshi\'s table... I guess I grabbed the wrong one. Heh heh.', 'happy'],
      ['c11_vg', 'KAKAROT!!!', 'shout'],
    ]);
    s.shake(30, 3);
    s.boom(15, 11, 24, '#b0f070');
    s.remove('c11_urn');
    actor(s, 'c11_zm', 'zamasu', 15, 9, 'down');
    s.music('black');
    await s.wait(24);
    await s.say('c11_zm', 'Did you truly believe a JAR could hold a god?!', 'angry');
    await s.call('c11_fusion');
  },

  /** Black and Zamasu fuse with the Potara. */
  c11_fusion: async (s) => {
    if (!s.exists('c11_zm')) actor(s, 'c11_zm', 'zamasu', 15, 9, 'down');
    if (!s.exists('c11_bk')) actor(s, 'c11_bk', 'blackRose', 12, 7, 'right');
    await s.pan(15, 10, 24);
    s.pose('c11_bk', null);
    s.face('c11_bk', 'c11_zm');
    await s.talk([
      ['c11_bk', 'Zamasu. It is time.', 'smirk'],
      ['c11_zm', 'Yes. Two halves of one justice. Let us become the perfect god.', 'smirk'],
    ]);
    s.sfx('teleport');
    s.flash('#58e080', 10);
    await s.walkAll([['c11_bk', 14, 7, 2], ['c11_zm', 15, 7, 2]]);
    s.flash('#ffffff', 30);
    s.shake(40, 3);
    clearActors(s, ['c11_bk', 'c11_zm']);
    actor(s, 'c11_fz', 'fusedZamasu', 15, 6, 'down');
    await s.powerUp('c11_fz', '#f04060', 60);
    await s.wait(12);
    await s.talk([
      ['c11_fz', 'I am the god of justice. I am the world itself. Kneel, mortals, and be erased.', 'smirk'],
      ['c11_vg', 'Potara earrings... Zamasu\'s, and the one Black took from this world\'s Gowasu. They fused.', 'shock'],
      ['c11_gk', 'Then we hit him with everything. Me first!', 'angry'],
    ]);
    await s.call('c11_relay_goku');
  },

  /** Relay 1: Goku (Super Saiyan Blue). */
  c11_relay_goku: async (s) => {
    const h = s.actor('hero');
    actor(s, 'c11_tr', 'futureTrunksRage', Math.round((h.x - 8) / 16), Math.round((h.y - 14) / 16), 'up');
    clearActors(s, ['c11_gk']);
    s.switchTo('goku');
    s.place('hero', 11, 13, 'up');
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 40);
    await s.wait(12);
    await s.say('hero', 'Let\'s see how tough a fused god really is!', 'smirk');
    s.follow();
    s.letterbox(false);
    clearActors(s, ['c11_fz']);
    s.music('zamasu');
    await bout(s, 'c11_fusedA', { x: 15, y: 6, uid: 'c11_fa', loseOk: true });
    s.letterbox(true);
    patchUp(s);
    if (s.exists('c11_fa')) s.sprite('c11_fa', 'c11_fusedHalf');
    s.pose('hero', 'hurt');
    s.shake(20, 2);
    await s.talk([
      ['fusedZamasu', 'Strike me, and I only grow. My immortal half heals what your fists break.', 'smirk'],
      ['hero', 'Ngh... his arm... it turned purple and grew back!', 'hurt'],
    ]);
    s.pose('hero', null);
    await s.call('c11_relay_vegito');
  },

  /** Relay 2: the Potara - Vegito Blue holds Zamasu off until the fusion burns out. */
  c11_relay_vegito: async (s) => {
    actor(s, 'c11_shin', 'supremeKai', 9, 19, 'up');
    actor(s, 'c11_gow', 'gowasu', 11, 19, 'up');
    s.sfx('teleport');
    s.flash('#58e080', 8);
    await s.walkAll([['c11_shin', 9, 16, 1.6], ['c11_gow', 11, 17, 1.2]]);
    await s.talk([
      ['c11_shin', 'Goku! Vegeta! Lord Gowasu brought us with another Time Ring from his shrine! Take my Potara - fuse!', 'shout'],
      ['c11_gow', 'Zamasu... what have you made of yourself?', 'sad'],
      ['c11_vg', 'I swore I would never do this again.', 'angry'],
      ['hero', 'C\'mon, Vegeta! Just this once!', 'shout'],
      ['c11_vg', '...Just this once!', 'angry'],
    ]);
    s.flash('#ffffff', 24);
    s.shake(30, 3);
    s.transformNow(null);
    clearActors(s, ['c11_vg']);
    s.switchTo('vegeta');
    s.outfit('vegeta', 'vegitoBlue');
    boost(s, 'vegeta', 18);
    s.place('hero', 13, 12, 'up');
    await s.powerUp('hero', '#40c0f8', 50);
    await s.wait(12);
    await s.say('vegitoBlue', 'Hey, Zamasu. You fused into a god? Cute. Let me show you what a REAL fusion looks like.', 'smirk');
    await s.narrate('Goku and Vegeta fused into Vegito Blue! A fusion this powerful burns out fast - make every second count!');
    s.music('heroic');
    s.letterbox(false);
    const fx = s.exists('c11_fa') ? s.actor('c11_fa') : null;
    const bx = fx ? Math.round((fx.x - 8) / 16) : 15;
    const by = fx ? Math.round((fx.y - 14) / 16) : 6;
    clearActors(s, ['c11_fa']);
    await bout(s, 'c11_fusedB', { x: bx, y: by, uid: 'c11_fb', survive: 45, loseOk: true, label: 'FUSION' });
    s.letterbox(true);
    s.flash('#ffffff', 20);
    s.outfit('vegeta', null);
    unboost(s, 'vegeta');
    patchUp(s);
    await s.wait(20);
    s.place('hero', 12, 12, 'up');
    actor(s, 'c11_gk', 'goku', 14, 12, 'up');
    await s.talk([
      ['hero', 'What?! We split apart! It hasn\'t been anywhere near an hour!', 'shock'],
      ['c11_shin', 'Your power burned through the fusion! Non-Kais were never meant to hold that much!', 'shock'],
      ['c11_gk', 'Aw, man... and we almost had him!', 'sad'],
    ]);
    await s.call('c11_relay_trunks');
  },

  /** Relay 3: Trunks gathers the hope of everyone left alive into one blade. */
  c11_relay_trunks: async (s) => {
    const tile = (v: number, off: number): number => Math.round((v - off) / 16);
    if (s.hero === 'vegeta') {
      const h = s.actor('hero');
      actor(s, 'c11_vg', 'vegeta', tile(h.x, 8), tile(h.y, 14), 'up');
    }
    const tr = s.exists('c11_tr') ? s.actor('c11_tr') : null;
    const tx = tr ? tile(tr.x, 8) : 14;
    const ty = tr ? tile(tr.y, 14) : 14;
    clearActors(s, ['c11_tr']);
    s.switchTo('trunks');
    s.place('hero', tx, ty, 'up');
    s.transformNow('rage');
    s.music('sad');
    // Goku and Vegeta step aside; Trunks walks to the front of the plaza.
    if (!s.exists('c11_gk')) actor(s, 'c11_gk', 'goku', 14, 12, 'up');
    if (!s.exists('c11_vg')) actor(s, 'c11_vg', 'vegeta', 12, 12, 'up');
    await s.walkAll([['c11_gk', 11, 13, 1.4], ['c11_vg', 19, 13, 1.4], ['hero', 15, 12, 1.2]]);
    s.face('hero', 'up');
    await s.pan(15, 12, 24);
    // The survivors climb out of the ruins behind him.
    const crowd: Array<[string, string, number, number, string]> = [
      ['c11_mai', 'futureMai', 13, 16, 'Mai'], ['c11_r1', 'resistance', 17, 16, 'Resistance'], ['c11_r2', 'townswoman', 15, 17, 'Survivor'],
      ['c11_r3', 'oldMan', 19, 17, 'Survivor'], ['c11_r4', 'kidNpc', 21, 16, 'Survivor'],
    ];
    for (const [id, sprite, x, , name] of crowd) actor(s, id, sprite, x, 21, 'up', name);
    await s.walkAll(crowd.map(([id, , x, y]) => [id, x, y, 1.1] as [string, number, number, number]));
    await s.narrate('All across the ruins, the last people of Earth crawled out of their shelters, and raised their hands to the sky.');
    await s.say('c11_mai', 'Trunks! Take it! All of it - everyone\'s!', 'shout');
    for (const [id] of crowd) await s.blast(id, 'hero', '#a8e8ff');
    await s.powerUp('hero', '#a8e8ff', 60);
    await s.wait(12);
    await s.say('hero', 'Everyone\'s hope... in one blade. This is the last thing you\'ll ever see, Zamasu!', 'shout');
    s.music('heroic');
    s.follow();
    s.letterbox(false);
    const fx = s.exists('c11_fb') ? s.actor('c11_fb') : null;
    const bx = fx ? tile(fx.x, 8) : 15;
    const by = fx ? tile(fx.y, 14) : 6;
    clearActors(s, ['c11_fb']);
    await bout(s, 'c11_fusedC', { x: bx, y: by, uid: 'c11_fc', loseOk: true });
    s.letterbox(true);
    const fc = s.exists('c11_fc') ? s.actor('c11_fc') : null;
    const ex = fc ? tile(fc.x, 8) : bx;
    const ey = fc ? tile(fc.y, 14) : by;
    if (fc) s.face('hero', 'c11_fc');
    await s.beamStruggle('futureTrunksRage', 'fusedZamasu', '#a8e8ff', '#f04060', [
      '{hero}: This is the hope of every person you tried to erase!',
      'Zamasu: Mortals... cannot... touch... a god!',
      '{hero}: SWORD... OF... HOPE!!',
    ], 0.2);
    s.flash('#ffffff', 40);
    s.shake(40, 3);
    s.boom(ex, ey, 32, '#a8e8ff');
    clearActors(s, ['c11_fc']);
    s.exp(200000);
    patchUp(s);
    await s.wait(40);
    await s.narrate('The Sword of Hope cut Fused Zamasu in two.');
    await s.call('c11_infinite');
  },

  /** Infinite Zamasu fills the sky and strikes down the last of Earth's people; Goku presses the Zeno Button. */
  c11_infinite: async (s) => {
    const tile = (v: number, off: number): number => Math.round((v - off) / 16);
    s.music('black');
    s.tint('rgba(170,50,130,0.38)');
    s.shake(60, 3);
    await s.narrate('But Zamasu\'s immortal half did not die. It spread - into the clouds, into the air, into the sky itself.');
    await s.talk([
      ['fusedZamasu', 'I AM THE WORLD. I AM EVERYWHERE. THERE IS NO ESCAPE FROM JUSTICE.', 'shout'],
      ['hero', 'He\'s... he\'s the whole sky!', 'shock'],
    ]);
    // The Kais cannot stay: their borrowed Time Ring is already pulling them home.
    if (s.exists('c11_gow') || s.exists('c11_shin')) {
      await s.talk([
        [s.exists('c11_gow') ? 'c11_gow' : 'gowasu', 'Zamasu... this is not justice. It is only hatred, wearing the sky.', 'sad'],
        [s.exists('c11_shin') ? 'c11_shin' : 'supremeKai', 'Lord Gowasu, the ring is pulling us back! Everyone, get out of here!', 'shock'],
      ]);
      s.sfx('teleport');
      s.flash('#58e080', 8);
      clearActors(s, ['c11_gow', 'c11_shin']);
    }
    // The sky answers the people who lent Trunks their hope. He reaches Mai in time. No one else.
    await s.say('fusedZamasu', 'MORTALS WHO LEND THEIR LIGHT TO A BLADE. HOW TOUCHING. HOW FILTHY. BE ERASED.', 'shout');
    if (!s.exists('c11_mai')) actor(s, 'c11_mai', 'futureMai', 13, 16, 'up', 'Mai');
    const m = s.actor('c11_mai');
    s.flash('#f04060', 16);
    s.shake(40, 3);
    await s.walk('hero', tile(m.x, 8), tile(m.y, 14) - 1, 3.2);
    s.face('hero', 'up');
    s.pose('hero', 'guard');
    for (const id of ['c11_r1', 'c11_r2', 'c11_r3', 'c11_r4']) {
      if (!s.exists(id)) continue;
      const a = s.actor(id);
      s.boom(tile(a.x, 8), tile(a.y, 14), 22, '#f04060');
      s.remove(id);
      await s.wait(8);
    }
    s.flash('#f04060', 24);
    s.shake(40, 3);
    await s.wait(40);
    s.pose('hero', null);
    s.face('hero', 'down');
    s.music('sad');
    await s.talk([
      ['c11_mai', 'Trunks... they\'re gone. All of them. Just like that...', 'shock'],
      ['hero', 'No... NO! They gave me everything they had... and I couldn\'t protect a single one of them!', 'shout'],
      ['fusedZamasu', 'THE INSECTS BENEATH THEIR STONE. THE ONES WHO HID IN THE RUINS. ALL ERASED. OF THIS WORLD\'S MORTALS, TWO REMAIN.', 'shout'],
    ]);
    s.music('black');
    actor(s, 'c11_bu', 'bulma', 9, 20, 'up');
    await s.walk('c11_bu', 10, 17, 2);
    await s.say('c11_bu', 'The time machine is fixed! Get in, all of you! NOW!', 'shout');
    if (!s.exists('c11_gk')) actor(s, 'c11_gk', 'goku', 12, 13, 'up');
    await s.emote('c11_gk', '!');
    await s.talk([
      ['c11_gk', 'Wait! ...Zen-chan said to press this if I ever needed him.', 'shock'],
    ]);
    await s.pan(14, 11, 30);
    await s.narrate('Goku pressed the Zeno Button.');
    s.sfx('teleport');
    s.flash('#ffffff', 20);
    actor(s, 'c11_fzeno', 'zeno', 15, 8, 'down', 'Future Zeno');
    await s.wait(20);
    await s.talk([
      ['c11_fzeno', 'Who are you? ...Who is HE? He\'s all over my world. I don\'t like him.', 'angry'],
      ['c11_gk', 'Uh-oh. EVERYBODY INTO THE TIME MACHINE!!', 'shout'],
      ['c11_fzeno', 'Erase.'],
    ]);
    s.sfx('explode');
    await s.fadeOut(90, '#ffffff');
    await s.narrate('Future Zeno erased Zamasu - and with him, the entire timeline. Only the little time machine slipped away, carrying its passengers into the past.');
    s.transformNow(null);
    s.set('c11_finaleDone');
    s.clear('c11_finaleLock');
    await s.done('c11_q_rift');
    await s.call('c11_epilogue');
  },

  /** Capsule Corp: Future Zeno, a new branch of time, and goodbye (for now). */
  c11_epilogue: async (s) => {
    s.set('world', 'earth');
    await s.warp('cc_yard', HUB.ccLawn.x, HUB.ccLawn.y, 'up');
    s.letterbox(true);
    s.music('sad');
    // Whis makes his own entrance below; the lawn's usual Whis and the hangar-pad Bulma step out of the scene.
    clearActors(s, ['c04_whis', 'c09_bulmaPad', 'c09_gokuY', 'c09_vegetaY']);
    s.switchTo('trunks');
    s.place('hero', 23, 21, 'up');
    actor(s, 'c11_bu', 'bulma', 22, 19, 'down');
    actor(s, 'c11_gk', 'goku', 20, 20, 'right');
    actor(s, 'c11_vg', 'vegeta', 26, 20, 'left');
    actor(s, 'c11_mai', 'futureMai', 24, 22, 'up', 'Mai');
    actor(s, 'c11_fzeno', 'zeno', 19, 18, 'down', 'Future Zeno');
    // Grief first: everyone Trunks fought for is gone with his world.
    await s.talk([
      ['c11_bu', 'We made it...', 'sad'],
      ['hero', 'Not "we". Mai and I are all that\'s left of my world.', 'sad'],
      ['hero', s.check('done:c11_q_survivors')
        ? 'The Resistance. Yajirobe. Aiko, and the three I sent home to her... I brought them home just in time for the sky to fall on them.'
        : 'The Resistance. Yajirobe. The children under the hatch. Everyone who lent me their strength... gone with the sky.', 'sad'],
      ['c11_mai', 'They held on for years, Trunks, because you kept coming back. At the end they gave you their hope. Black never took that from them.', 'sad'],
      ['c11_vg', '...Then carry it, boy. That is what the living owe the dead.', 'neutral'],
    ]);
    await s.wait(30);
    await s.talk([
      ['c11_bu', '...Goku. Why is there a Zeno on my lawn?', 'shock'],
      ['c11_gk', 'I went back and got him! He looked lonely, all by himself in a world with nothing left in it.', 'sad'],
      ['c11_bu', 'You brought the KING OF ALL to my HOUSE?!', 'shock'],
    ]);
    actor(s, 'c11_wh', 'whis', 18, 21, 'right');
    s.sfx('teleport');
    s.flash('#a0e0ff', 8);
    await s.wait(10);
    await s.talk([
      ['c11_wh', 'Oh my. Two of them. Well, Lord Zeno did say he wanted a friend.', 'smirk'],
    ]);
    await s.narrate('Later, at Zeno\'s palace, the two Zenos met... and became best friends on the spot. The Grand Priest declined to comment.');
    s.music('peaceful');
    await s.talk([
      ['c11_wh', 'Trunks. There is a branch of time where Lord Beerus erased Zamasu before any of this began. A world where Black never existed.', 'neutral'],
      ['c11_wh', 'I can guide your time machine there. You and Mai could live in peace.'],
      ['hero', 'A world without Black... There would be another me there. Another Mai.', 'sad'],
      ['c11_mai', 'A world where people can just... live, without hiding. We\'ll live it for them. Let\'s go, Trunks.', 'sad'],
      ['c11_vg', 'Train. Every single day. And if you ever need help... you come back. That is an order.', 'angry'],
      ['hero', 'Yes, Father.', 'happy'],
      ['c11_vg', '...Hmph.', 'smirk'],
      ['c11_bu', 'I painted HOPE!! on that old egg, just like Future me did. And I built in a beacon. Press it, and the machine will find this timeline again. Your room\'s always ready.', 'sad'],
      ['c11_gk', 'Bring Mai next time! We\'ll have a party! With food! Lots of food!', 'happy'],
      ['hero', 'Thank you. All of you. I\'ll come back - whenever the past needs me.', 'happy'],
    ]);
    await s.narrate('Trunks and Mai set off for a new future. But Bulma\'s beacon keeps a door open across time: whenever the past calls, Trunks answers. (Trunks remains in your party.)');
    await s.give('str3');
    await s.give('end3');
    // Errands that died with Trunks's world (or whose people have moved on) leave the journal and the world map.
    const lost = [...PRESENT_ERRANDS, ...FUTURE_ERRANDS].filter((id) => s.check(`quest:${id}`));
    for (const id of lost) dropQuest(s, id);
    if (lost.length) await s.narrate('Some errands from these days can never be finished now. (They have been removed from your journal.)');
    s.set('c11_farewell');
    s.outfit('vegeta', null);
    unboost(s, 'vegeta');
    clearActors(s, ['c11_bu', 'c11_gk', 'c11_vg', 'c11_mai', 'c11_fzeno', 'c11_wh']);
    s.heal();
    unforce(s);
    s.switchTo('goku');
    s.letterbox(false);
    if (s.hasScript('c12_start')) await s.call('c12_start');
  },
  c11_fused_mutate: async (s) => {
    s.flash('#9068b0', 10);
    s.toast('Zamasu\'s immortal half is spreading!');
  },

  // ================================================================== future side content
  /** Mai in the Resistance base (Chapters 9-11). */
  c09_mai_talk: async (s) => {
    const me = who(s, 'futureMai');
    if (s.check('chapter==11')) {
      if (s.check('quest:c11_q_notes') && s.has('c11_notes')) {
        s.take('c11_notes');
        await s.talk([
          [me, 'Her notebook... You found it.', 'sad'],
          [me, '"Trunks - be safe." She wrote that on every page she didn\'t need. I used to tease her about it.', 'sad'],
          ['hero', 'Keep it, Mai. She\'d want it to be with someone who remembers her laughing.', 'sad'],
          [me, '...Thank you. Here. I\'ve been saving these for the day we won. I think that day is close.', 'happy'],
        ]);
        await s.give('str3');
        await s.done('c11_q_notes', false);
        return;
      }
      await s.say(me, s.flag('c11_inFuture')
        ? 'The plaza under the rift is at the south end of the main street. Go. And come back.'
        : 'We\'ll hold out. We always do. Go find a way to seal that monster.', 'smirk');
      return;
    }
    if (s.check('chapter==10')) {
      if (s.check('quest:c10_q_lair')) { await s.call('c10_lair_ride'); return; }
      await s.say(me, s.flag('c10_lairDone')
        ? 'Rest while you can. They know where we are now.'
        : 'Vegeta won\'t lie down. Trunks says that means he\'s hurt. Vegeta says it means he\'s bored.', 'sad');
      return;
    }
    await s.say(me, 'Trunks is back, and he brought heroes. For the first time in years, the kids down here are laughing.', 'happy');
  },
  c10_yajirobe_talk: async (s) => {
    const me = who(s, 'yajirobe');
    await s.say(me, s.check('chapter>=11')
      ? 'If those two gods come back, I\'m hiding in the supply closet. It\'s a very strategic closet.'
      : 'Don\'t look at me like that. I said you owe me dinner, and I meant it.', 'smirk');
  },
  c11_bulmaF_talk: async (s) => {
    const me = who(s, 'bulma');
    const n = s.inc('c11_bulmaF_n');
    await s.say(me, n % 2
      ? 'Future me kept such NEAT notes. Mine are on napkins. ...Don\'t tell anyone. Go, I\'ve got a machine to fix!'
      : 'Fuel lines, check. Hull, ugh. Give me time and duct tape and I can fix anything.', 'smirk');
  },
  c11_notes_shelf: async (s) => {
    if (!s.check('quest:c11_q_notes') || s.has('c11_notes')) {
      await s.narrate('A scorched bookshelf full of engineering manuals.');
      return;
    }
    await s.give('c11_notes');
    await s.talk([
      ['hero', 'Mom\'s notebook. Formulas, wiring diagrams... a shopping list...', 'sad'],
      ['hero', '"Trunks - be safe." ...I will, Mom. I promise.', 'sad'],
    ]);
  },
  c11_mother_talk: async (s) => {
    const me = who(s, 'townswoman');
    if (s.check('done:c11_q_survivors')) {
      await s.say(me, 'Everyone\'s home. All of them. I don\'t know how to thank you.', 'happy');
      return;
    }
    if (!s.check('chapter==11') || !s.flag('c11_inFuture')) {
      await s.say(me, 'We count heads every night. Every night there are fewer.', 'sad');
      return;
    }
    const found = ['c11_surv1', 'c11_surv2', 'c11_surv3'].filter((f) => s.flag(f)).length;
    if (!s.check('quest:c11_q_survivors')) {
      await s.talk([
        [me, 'Please, you have to help. Three of our people were out scavenging when those... copies appeared.', 'sad'],
        [me, 'They must be hiding somewhere in the city. Tell them to come home.'],
      ]);
      await s.quest('c11_q_survivors');
      return;
    }
    if (found >= 3) {
      await s.say(me, 'They all made it back! Here - it isn\'t much, but please take it.', 'happy');
      await s.give('senzu', 2);
      await s.done('c11_q_survivors', false);
      return;
    }
    await s.say(me, `${found} of 3 are back. Please, find the others. Somewhere in the ruined city.`, 'sad');
  },
  c11_survivor_talk: async (s) => {
    const id = s.npc?.def.id ?? 'c11_surv1';
    const flag = ['c11_surv1', 'c11_surv2', 'c11_surv3'].includes(id) ? id : 'c11_surv1';
    await s.talk([
      [who(s, 'resistance'), 'You\'re... not one of HIM? Oh thank goodness. I\'ve been hiding here since the sky tore open.', 'shock'],
      ['hero', 'The Resistance base is west of the highway. Go now - I\'ll keep the clones busy.'],
    ]);
    s.set(flag);
    if (s.npc) s.remove(id);
    s.toast('A survivor is heading home.');
  },
});
