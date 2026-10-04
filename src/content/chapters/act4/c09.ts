import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { actor, bout, clearActors, HUB, patchUp, propOff, propOn, still, talker, timeTravel, who } from './util';

/**
 * CHAPTER 9 - "SOS from the Future" (Trunks rejoins at L30, forced; L30-34).
 *
 * Beats (gold journal chain):
 *   c09_start         prelude (Black + Time Ring) -> HOPE!! crashes at Capsule Corp -> Trunks wakes, joins L30,
 *                     learns Sword Blast + Cross Slash -> flashback (Dabura fight) -> Vegeta's challenge   [c09_q_spar]
 *   c09_vegeta_talk   gravity-room spar vs Vegeta (ends at 50%) -> Goku senses Black                       [c09_q_black]
 *   c09_yard_enter    Black wrecks the HOPE!! -> Goku vs Black at the outskirts (ends at 50%, Time Ring)
 *                     -> Bulma finds Cell's time machine, needs fuel                                        [c09_q_fuel]
 *   c09_mine_*        three Hyper-Crystals in the old Capsule Corp mine (Excavator X-7 mini-boss)         [c09_q_depart]
 *   c09_bulma_pad     fuel synthesized -> Goku, Vegeta and Trunks ride to the future -> Mai lives -> c10_start
 * Side: c09_q_gohan (silver, Gohan's house), c09_q_homework (bronze, Pilaf Gang in Capsule Corp).
 */

/** Bulma's open-air classroom table on the Capsule Corp west lawn (prop top-left, tiles). Mirrors the overlay. */
const CLASS = { x: 8, y: 17 } as const;

/** Trunks's kit on rejoining (stats roll on top of the prologue character, LoG2 rule). */
async function trunksRejoins(s: ScriptApi): Promise<void> {
  await s.join('trunks', 30);
  force(s, 'trunks');
  await s.learn('trunks', 'burningAttack', true);
  if (!s.state.char('trunks').form) await s.setForm('trunks', 'ssj', true);
  await s.learn('trunks', 'swordBlast');
  await s.learnCharged('trunks');
}

registerScripts({
  // ================================================================== chapter start
  c09_start: async (s) => {
    ensureChapterState(s, 9);
    await s.chapter(9, 'SOS from the Future', 'The "Future" Trunks Saga');
    await s.call('c09_prelude');
    await s.call('c09_crash');
    await s.call('c09_wake');
    await s.call('c09_flashback');
    await s.call('c09_after_story');
  },

  /** Another timeline: Black learns that Trunks escaped, and lifts his Time Ring. */
  c09_prelude: async (s) => {
    await s.warp('future_hideout_out', 17, 18, 'up');
    s.letterbox(true);
    s.show('hero', false);
    s.music('black');
    s.tint('rgba(50,10,50,0.35)');
    clearActors(s, ['fc_lookout']);
    actor(s, 'c09_pBlack', 'gokuBlack', 17, 9, 'up');
    actor(s, 'c09_pZamasu', 'zamasu', 23, 7, 'left', '???');
    s.silhouette('c09_pZamasu', true);
    s.show('c09_pZamasu', false);
    await s.pan(17, 10, 30);
    await s.narrate('Another timeline. Age 796. What is left of West City.');
    await s.say('c09_pBlack', 'Gone. The boy slipped through time again, and took his little machine of "hope" with him.', 'smirk');
    s.face('c09_pBlack', 'down');
    await s.say('c09_pBlack', 'Hope. Mortals cling to it the way a drowning man clings to a reed.');
    s.sfx('teleport');
    s.flash('#58e080', 10);
    s.aura('c09_pBlack', '#58e080');
    await s.wait(12);
    await s.say('c09_pBlack', 'No matter. Wherever he runs, time itself will carry me after him.', 'smirk');
    s.show('c09_pZamasu', true);
    await s.walk('c09_pZamasu', 21, 8, 0.6);
    await s.say('???', 'Go, then, my friend. Show the past what the future has become.');
    await s.say('c09_pBlack', 'Patience. Let the boy have his little reunion first. Despair tastes better after hope.', 'smirk');
    s.aura('c09_pBlack', null);
    await s.flyTo('c09_pBlack', 17, -3, 3);
    await s.fadeOut(30);
  },

  /** The present: the HOPE!! crash-lands on the Capsule Corp hangar pad during Bulma's tutoring session. */
  c09_crash: async (s) => {
    await s.narrate('Meanwhile, in the present day...');
    await s.warp('cc_yard', 9, 21, 'up');
    s.letterbox(true);
    s.show('hero', false);
    s.music('peaceful');
    // Whis wanders off with Beerus for this chapter's opening; he is back on the lawn next visit.
    clearActors(s, ['c04_whis']);
    // Bulma's open-air classroom on the west lawn.
    propOn(s, 'table', CLASS.x, CLASS.y, 'c09_desk');
    actor(s, 'c09_bulma', 'bulma', CLASS.x + 1, CLASS.y - 1, 'down');
    actor(s, 'c09_pilaf', 'pilaf', CLASS.x - 1, CLASS.y + 1, 'right');
    actor(s, 'c09_mai', 'mai', CLASS.x + 3, CLASS.y + 1, 'left', 'Mai');
    actor(s, 'c09_shu', 'shu', CLASS.x + 1, CLASS.y + 2, 'up');
    actor(s, 'c09_kidTrunks', 'trunksKid', CLASS.x + 4, CLASS.y + 2, 'up');
    await s.pan(CLASS.x + 2, CLASS.y + 2, 20);
    await s.talk([
      ['c09_bulma', 'Okay, class! Pilaf, what is seven times eight?', 'happy'],
      ['c09_pilaf', 'Fifty... six... hundred? Fifty-six hundred! Write it down, Shu!', 'smirk'],
      ['c09_shu', 'Writing it down, sire!'],
      ['c09_kidTrunks', 'Mom, why do I have to sit with these dorks? I already know my times tables.', 'angry'],
      ['c09_mai', 'Hmph. Dorks who could take over the world, if we wanted.'],
      ['c09_bulma', 'Because if they flunk out, Pilaf moves back into our garage. Now pay attention!', 'angry'],
    ]);
    // A tear in the sky above the hangar pad.
    s.music('tense');
    s.sfx('teleport');
    s.shake(40, 3);
    s.flash('#ffffff', 14);
    for (const id of ['c09_bulma', 'c09_kidTrunks', 'c09_mai', 'c09_pilaf', 'c09_shu']) s.face(id, 'right');
    await s.emote('c09_bulma', '!');
    await s.pan(HUB.ccPad.tmX + 1, HUB.ccPad.tmY + 1, 30);
    s.boom(HUB.ccPad.tmX + 1, HUB.ccPad.tmY + 1, 26, '#80c0ff');
    s.set('c09_hopeCrashed');
    propOn(s, 'timeMachine', HUB.ccPad.tmX, HUB.ccPad.tmY, 'c09_tm');
    actor(s, 'c09_trunks', 'futureTrunks', HUB.ccPad.tmX + 1, HUB.ccPad.tmY + 3, 'down');
    s.pose('c09_trunks', 'ko');
    // The hangar mechanic dives for cover.
    if (s.exists('eb_cc_mechanic')) {
      still(s, 'eb_cc_mechanic');
      await s.emote('eb_cc_mechanic', '!');
      await s.walk('eb_cc_mechanic', 38, 11, 2.4);
      s.face('eb_cc_mechanic', 'left');
    }
    await s.wait(30);
    await s.walkAll([
      ['c09_bulma', 31, 8, 2.4], ['c09_kidTrunks', 30, 9, 2.4], ['c09_mai', 32, 9, 2], ['c09_pilaf', 34, 8, 1.8], ['c09_shu', 35, 9, 1.6],
    ]);
    for (const id of ['c09_bulma', 'c09_kidTrunks', 'c09_mai', 'c09_pilaf', 'c09_shu']) s.face(id, 'c09_trunks');
    await s.talk([
      ['c09_bulma', 'That is... my time machine! Well, HER time machine. My future time machine. You know what I mean!', 'shock'],
      ['c09_kidTrunks', 'Whoa. That guy has my hair. And a SWORD.', 'shock'],
      ['c09_mai', '...He\'s kind of handsome.'],
      ['c09_bulma', 'Trunks! It\'s the future Trunks! He\'s hurt. Help me get him inside, and somebody call Goku!', 'shock'],
      ['c09_pilaf', 'Does this mean class is cancelled?', 'happy'],
    ]);
    await s.fadeOut(30);
  },

  /** Capsule Corp lounge: Trunks wakes, mistakes Goku for Black, and rejoins the party. */
  c09_wake: async (s) => {
    await s.warp('cc_inside', 16, 12, 'up');
    s.letterbox(true);
    s.show('hero', false);
    s.music('sad');
    actor(s, 'c09_trunks', 'futureTrunks', 16, 10, 'down');
    s.pose('c09_trunks', 'ko');
    actor(s, 'c09_bulma', 'bulma', 15, 9, 'down');
    actor(s, 'c09_goku', 'goku', 9, 12, 'up');
    await s.narrate('An hour later...');
    await s.walk('c09_goku', 9, 10, 1.6);
    await s.walk('c09_goku', 14, 10, 1.6);
    s.face('c09_goku', 'c09_trunks');
    await s.talk([
      ['c09_goku', 'I got Senzu Beans from Korin! Here, Trunks. Chew, okay?', 'happy'],
      ['c09_bulma', 'Goku, he\'s unconscious. You can\'t just shove a bean in his-- oh. He swallowed it.', 'shock'],
    ]);
    s.flash('#80f080', 8);
    s.sfx('heal');
    s.pose('c09_trunks', null);
    await s.emote('c09_trunks', '!');
    s.face('c09_trunks', 'c09_goku');
    await s.say('c09_trunks', 'BLACK!!', 'shout');
    await s.clash('c09_trunks', 'c09_goku', 50);
    actor(s, 'c09_vegeta', 'vegeta', 18, 12, 'up');
    await s.walk('c09_vegeta', 17, 10, 3);
    s.face('c09_vegeta', 'c09_trunks');
    s.face('c09_trunks', 'c09_vegeta');
    await s.talk([
      ['c09_vegeta', 'Enough! Look closer, boy. That clown couldn\'t be evil if he studied for it.', 'angry'],
      ['c09_trunks', 'Father...? And... Mr. Goku. The real one. I... I\'m sorry. He has your face. Your exact face.', 'sad'],
      ['c09_goku', 'My face, huh? That\'s weird. I think I\'d remember being evil.'],
      ['c09_bulma', 'Trunks. Sweetie. What happened? Where\'s... me?', 'sad'],
      ['c09_trunks', 'Mom is gone. A man who calls himself Goku Black did it. He\'s been hunting down everyone left in our world.', 'sad'],
    ]);
    // Trunks rejoins: the player takes control of him. The hidden field player becomes Trunks during the join
    // boxes (the cutscene Trunks stays on screen), then steps into the actor's place, so no one is ever doubled.
    const t = s.actor('c09_trunks');
    const tx = Math.round((t.x - 8) / 16);
    const ty = Math.round((t.y - 14) / 16);
    await trunksRejoins(s);
    s.place('hero', tx, ty, 'down');
    s.remove('c09_trunks');
    s.show('hero', true);
    await s.give('senzu', 2);
    await s.say('c09_bulma', 'Keep those. Korin owes Goku about a thousand favours anyway.', 'smirk');
  },

  /** Trunks tells his story: the flashback fight against Dabura, and the first sight of Black. */
  c09_flashback: async (s) => {
    s.letterbox(true);
    await s.say('hero', 'It started after I defeated the androids and Cell. A wizard named Babidi came to Earth with his servant, Dabura. They wanted to wake a monster called Majin Buu.', 'sad');
    await s.fadeOut(30, '#e0c080');
    await s.warp('c09_flash_wastes', 13, 13, 'up');
    s.letterbox(true);
    s.music('tense');
    actor(s, 'c09_dabura', 'c09_dabura', 13, 8, 'down');
    actor(s, 'c09_babidi', 'c09_babidi', 16, 6, 'down');
    await s.narrate('Trunks\'s memory. Two years earlier...');
    await s.talk([
      ['c09_babidi', 'Papapara! A Super Saiyan! Dabura, squash him, and let\'s get on with waking Buu!', 'smirk'],
      ['c09_dabura', 'As you command, master. The boy will make a fine statue.', 'smirk'],
      ['hero', 'I won\'t let this world be destroyed again. Not ever again.', 'angry'],
    ]);
    s.transformNow('ssj');
    await s.powerUp('hero', '#f8e048', 40);
    s.letterbox(false);
    s.music('battle');
    s.remove('c09_dabura');
    // A memory can't kill you: if Trunks falls, he remembers it again, the way it really happened.
    let r = await bout(s, 'c09_dabura', { x: 13, y: 8, uid: 'c09_dabura1', loseOk: true });
    while (r === 'lose') {
      s.letterbox(true);
      clearActors(s, ['c09_dabura1']);
      s.flash('#e0c080', 20);
      await s.wait(20);
      await s.narrate('No... that isn\'t how it happened. Trunks steadied his breathing and remembered again.');
      s.heal();
      s.place('hero', 13, 13, 'up');
      s.letterbox(false);
      r = await bout(s, 'c09_dabura', { x: 13, y: 8, uid: 'c09_dabura1', loseOk: true });
    }
    s.letterbox(true);
    if (r !== 'win') {
      await s.say('c09_dabura', 'Impossible... a mere mortal...', 'hurt');
      await s.blast('hero', 'c09_dabura1', '#d0f0ff');
      s.boom(13, 8, 24, '#f05030');
      s.remove('c09_dabura1');
      await s.wait(24);
    }
    await s.talk([
      ['c09_babidi', 'W-wait! Let\'s make a deal! I could make you a king! An emperor! A--', 'shock'],
      ['hero', 'No deals.', 'angry'],
    ]);
    await s.blast('hero', 'c09_babidi', '#f8a040');
    s.boom(16, 6, 20, '#f8a040');
    s.remove('c09_babidi');
    if (r !== 'win') s.exp(40000);
    await s.wait(30);
    await s.narrate('Without Babidi, Majin Buu never woke. For a little while, Trunks\'s world knew peace.');
    s.music('black');
    s.tint('rgba(60,20,60,0.3)');
    actor(s, 'c09_fbBlack', 'gokuBlack', 13, 3, 'down', '???');
    s.silhouette('c09_fbBlack', true);
    await s.walk('c09_fbBlack', 13, 9, 0.6);
    await s.talk([
      ['hero', 'Mr. Goku...? Is that... you?', 'shock'],
      ['c09_fbBlack', 'Goku? ...Yes. I suppose I am. Strange, how well it fits.', 'smirk'],
    ]);
    s.flash('#f070b0', 12);
    s.boom(13, 11, 22, '#c03060');
    await s.fadeOut(40, '#ffffff');
    s.transformNow(null);
  },
  c09_dabura_phase2: async (s) => {
    s.flash('#f05030', 10);
    s.shake(20, 2);
    await s.wait(12);
    await s.say('c09_dabura', 'Enough of this. Hold still, boy, and I\'ll give you the honour of becoming my finest statue!', 'angry');
  },

  /** Back at Capsule Corp: Vegeta throws down the gauntlet. */
  c09_after_story: async (s) => {
    await s.warp('cc_inside', 16, 10, 'down');
    s.letterbox(true);
    s.music('sad');
    actor(s, 'c09_bulma', 'bulma', 15, 9, 'down');
    actor(s, 'c09_goku', 'goku', 14, 10, 'right');
    actor(s, 'c09_vegeta', 'vegeta', 18, 10, 'left');
    await s.talk([
      ['hero', 'Since that day, Black has been erasing humanity, one city at a time. Mom built the time machine so I could find you.', 'sad'],
      ['c09_bulma', 'Oh, Trunks...', 'sad'],
      ['c09_goku', 'Someone with my face, as strong as me... Heh. Sorry, I know it\'s bad. But I kinda want to fight him.', 'smirk'],
      ['c09_vegeta', 'Of course you do. Boy. Your mother sent you here because she believed we could win.', 'angry'],
      ['c09_vegeta', 'Prove you were worth the trip. Gravity room. Now.'],
      ['c09_bulma', 'Vegeta! He woke up five minutes ago!', 'angry'],
      ['c09_vegeta', 'Saiyans heal by fighting. Up the stairs in the lab. Don\'t keep me waiting.', 'smirk'],
    ]);
    s.music('town');
    // Out through the lobby and up into the lab, where the stairs lead to the gravity room.
    await s.walk('c09_vegeta', 12, 10, 2);
    await s.walk('c09_vegeta', 7, 9, 2);
    await s.walk('c09_vegeta', 7, 5, 2);
    s.remove('c09_vegeta');
    await s.say('c09_goku', 'He\'s happy you\'re here. That\'s just how he shows it. ...I think.', 'happy');
    clearActors(s, ['c09_goku']);
    await s.quest('c09_q_spar');
    s.letterbox(false);
  },

  // ================================================================== gravity room spar
  c09_vegeta_talk: async (s) => {
    const me = who(s, 'vegeta');
    if (!s.check('quest:c09_q_spar')) {
      await s.say(me, 'Hmph. Shouldn\'t you be resting? Go eat something. You look like your mother when she skips meals.');
      return;
    }
    await s.talk([
      [me, 'Took you long enough. Gravity\'s at three hundred times. Don\'t hold back. I won\'t.', 'smirk'],
      ['hero', 'Yes, Father.'],
      [me, '...Don\'t call me that where Kakarot can hear it.', 'angry'],
    ]);
    const c = await s.ask(me, 'Well? Are you ready?', ['Ready!', 'One moment']);
    if (c !== 0) { await s.say(me, 'Then warm up. Quickly.'); return; }
    s.remove('c09_vegeta');
    s.music('battle');
    const r = await bout(s, 'c09_vegetaSpar', { x: 10, y: 5, uid: 'c09_vegspar', loseOk: true });
    s.letterbox(true);
    if (r === 'lose') {
      // A spar, not a funeral: Vegeta powers down and sends him off to try again.
      if (s.exists('c09_vegspar')) s.sprite('c09_vegspar', 'vegeta');
      await s.talk([
        ['vegeta', 'Get up. You dropped your guard the moment I turned Blue. Black won\'t give you a second chance.', 'angry'],
        ['vegeta', 'Eat something, catch your breath, and come back. We\'re not done.', 'angry'],
      ]);
      clearActors(s, ['c09_vegspar']);
      talker(s, 'c09_vegeta', 'vegeta', 10, 5, 'left', 'c09_vegeta_talk', 'Vegeta');
      patchUp(s);
      s.music('battle');
      s.letterbox(false);
      return;
    }
    await s.talk([
      ['vegetaSSB', 'Hmph. Your stance is too wide. You hesitate before every finishing blow. And your sword arm drops when you\'re tired.', 'angry'],
      ['vegetaSSB', 'But... you don\'t back down. ...Not bad.', 'smirk'],
      ['hero', 'Thank you!', 'happy'],
      ['vegetaSSB', 'Don\'t make that face.', 'angry'],
    ]);
    s.exp(42000);
    patchUp(s);
    await s.done('c09_q_spar');
    actor(s, 'c09_goku', 'goku', 7, 9, 'up');
    await s.walk('c09_goku', 7, 7, 2);
    s.face('c09_goku', 'hero');
    await s.talk([
      ['c09_goku', 'Hey, you two! I just felt something out in the yard. That ki... it\'s like mine, but wrong. Cold.', 'shock'],
      ['hero', 'Black! He followed me through time!', 'shock'],
      ['vegetaSSB', 'Then let\'s go greet him.', 'smirk'],
    ]);
    s.set('c09_sparDone');
    if (s.exists('c09_vegspar')) {
      s.sprite('c09_vegspar', 'vegeta');
      await s.walkAll([['c09_vegspar', 8, 10, 2.2], ['c09_goku', 7, 10, 2.2]]);
      await s.walkAll([['c09_vegspar', 8, 12, 2.2], ['c09_goku', 7, 12, 2.2]]);
    }
    clearActors(s, ['c09_goku', 'c09_vegspar']);
    await s.quest('c09_q_black');
    s.letterbox(false);
  },
  c09_vegeta_phase2: async (s) => {
    s.flash('#40c0f8', 8);
    s.shake(16, 2);
    await s.wait(12);
    await s.say('vegetaSSB', 'Hmph. You can keep up. Then the warm-up is over - show me what that sword is really for!', 'smirk');
  },

  // ================================================================== Goku Black in the present
  c09_yard_enter: async (s) => {
    if (!s.check('quest:c09_q_black') || s.flag('c09_blackDone')) return;
    s.letterbox(true);
    s.music('black');
    clearActors(s, ['c04_whis']);
    if (s.exists('eb_cc_mechanic')) {
      still(s, 'eb_cc_mechanic');
      s.place('eb_cc_mechanic', 38, 11, 'left');
    }
    actor(s, 'c09_goku', 'goku', 20, 9, 'right');
    actor(s, 'c09_vegeta', 'vegeta', 22, 9, 'right');
    actor(s, 'c09_bulma', 'bulma', 27, 10, 'right');
    await s.pan(HUB.ccPad.tmX + 1, HUB.ccPad.tmY + 2, 30);
    actor(s, 'c09_black', 'gokuBlack', HUB.ccPad.tmX - 1, HUB.ccPad.tmY + 3, 'left');
    s.show('c09_black', false);
    s.sfx('teleport');
    s.flash('#58e080', 10);
    s.show('c09_black', true);
    await s.wait(12);
    await s.talk([
      ['c09_black', 'So this is the past. How quaint. Everything still has a roof.', 'smirk'],
      ['c09_black', 'And here is the little machine of hope. Let\'s not have any more of that.', 'smirk'],
    ]);
    s.face('c09_black', 'right');
    s.sfx('blast');
    s.flash('#c03060', 8);
    s.boom(HUB.ccPad.tmX + 1, HUB.ccPad.tmY + 1, 28, '#c03060');
    propOff(s, 'c09_tm');
    s.set('c09_hopeDestroyed');
    propOn(s, 'c09_hopeWreck', HUB.ccPad.tmX, HUB.ccPad.tmY, 'c09_wreck');
    await s.wait(16);
    await s.say('c09_bulma', 'MY TIME MACHINE!!', 'shock');
    s.follow();
    await s.walk('c09_black', 25, 9, 1.2);
    s.face('c09_black', 'c09_goku');
    await s.talk([
      ['c09_black', 'Son Goku. At last. I have so wanted to meet the original.', 'smirk'],
      ['c09_goku', 'Whoa. It really IS my face. Do I look like that when I smirk?', 'shock'],
      ['c09_vegeta', 'Worse.'],
      ['c09_goku', 'Hey, let\'s take this somewhere with fewer people. Follow me!'],
      ['c09_black', 'Lead the way. I\'m a guest, after all.', 'smirk'],
    ]);
    await s.fadeOut(24);
    await s.call('c09_black_fight');
  },

  /** West City outskirts: Goku (forced) vs Goku Black; the Time Ring pulls Black home at 50%. */
  c09_black_fight: async (s) => {
    force(s, 'goku');
    await s.warp('c09_outskirts', 15, 13, 'up');
    s.letterbox(true);
    s.music('black');
    actor(s, 'c09_black', 'gokuBlack', 15, 8, 'down');
    actor(s, 'c09_trunks', 'futureTrunks', 6, 11, 'right');
    actor(s, 'c09_vegeta', 'vegeta', 24, 11, 'left');
    await s.talk([
      ['c09_black', 'This will do. Tell me, Son Goku. What does it feel like, to have a body like that and waste it on fun?', 'smirk'],
      ['hero', 'Fun\'s the best part! But you hurt Trunks\'s mom. So this one\'s not for fun.', 'angry'],
      ['c09_trunks', 'Be careful, Mr. Goku! He gets stronger the longer he fights!'],
    ]);
    s.letterbox(false);
    s.remove('c09_black');
    const r = await bout(s, 'c09_black', { x: 15, y: 8, uid: 'c09_black1' });
    s.letterbox(true);
    if (r !== 'win') s.face('c09_black1', 'hero');
    await s.say('gokuBlack', 'Splendid! Your power rises every time you\'re hit. Just as I hoped. This body is learning from you.', 'smirk');
    s.sfx('teleport');
    s.flash('#58e080', 12);
    if (s.exists('c09_black1')) s.aura('c09_black1', '#58e080');
    await s.wait(14);
    await s.say('gokuBlack', 'Ah. The Time Ring calls me home. Until we meet again, Son Goku... in my world.', 'smirk');
    s.flash('#ffffff', 16);
    clearActors(s, ['c09_black1']);
    await s.wait(18);
    await s.talk([
      ['c09_trunks', 'The Time Ring... it pulled him back to the future.', 'shock'],
      ['hero', 'Aw, shoot. It was just getting good.', 'sad'],
      ['c09_vegeta', 'Idiot. He was studying you. Every punch you threw, he learned from.', 'angry'],
    ]);
    s.exp(50000);
    patchUp(s);
    s.set('c09_blackDone');
    await s.done('c09_q_black');
    await s.fadeOut(24);
    await s.call('c09_cell_machine');
  },
  c09_black_phase2: async (s) => {
    s.flash('#c03060', 8);
    s.shake(16, 2);
    await s.wait(12);
    await s.talk([
      ['gokuBlack', 'Ha! Yes, THIS is it! Push it harder, and the body pushes back. Saiyans truly are marvellous beasts.', 'smirk'],
      ['hero', 'Quit talking about my body like it\'s yours!', 'angry'],
    ]);
  },

  /** Bulma pulls Cell's old time machine out of storage; it needs fuel. */
  c09_cell_machine: async (s) => {
    await s.warp('cc_yard', HUB.ccPad.arriveX, HUB.ccPad.arriveY + 1, 'up');
    s.letterbox(true);
    s.music('town');
    actor(s, 'c09_bulma', 'bulma', 33, 8, 'up');
    actor(s, 'c09_goku', 'goku', 29, 9, 'up');
    actor(s, 'c09_vegeta', 'vegeta', 35, 9, 'left');
    actor(s, 'c09_trunks', 'futureTrunks', 31, 10, 'up');
    s.show('hero', false);
    await s.talk([
      ['c09_bulma', 'It\'s scrap. Total scrap. Future me spent a YEAR on that thing and he just...', 'sad'],
      ['c09_trunks', 'Then I\'m stuck here. And Mai, and everyone back home...', 'sad'],
      ['c09_bulma', 'Wait. Wait wait wait. Cell\'s time machine! We hauled it out of that cave years ago. It\'s in a storage capsule!', 'shock'],
    ]);
    s.sfx('teleport');
    s.flash('#ffffff', 10);
    propOff(s, 'c09_wreck');
    s.set('c09_cellOut');
    propOn(s, 'c09_cellMachine', HUB.ccPad.tmX, HUB.ccPad.tmY - 0.2, 'c09_cell');
    await s.wait(12);
    await s.talk([
      ['c09_goku', 'Whoa! It looks like a giant egg!', 'happy'],
      ['c09_bulma', 'An egg that still works, I bet. But there\'s no fuel. Future me\'s notes say making it took her months...', 'sad'],
      ['c09_trunks', 'Months?!', 'shock'],
      ['c09_bulma', 'Relax, I\'m a genius. Her notes say Hyper-Crystals cut that to a single day. And Capsule Corp happens to own a mine full of them.', 'smirk'],
      ['c09_bulma', 'We shut it down when Dad\'s mining robot went haywire. It\'s north-east of here - I\'ve marked it on your map.'],
      ['c09_bulma', 'Bring me three crystals, Trunks. And... take one of these big lugs with you if you want. Switch at any save point.', 'happy'],
      ['c09_vegeta', 'Hmph. The boy can handle a few rocks.'],
      ['c09_goku', 'Oh! Trunks, while you\'re here, you should visit Gohan. He lives out near Mt. Paozu now. He\'d love to see you.', 'happy'],
    ]);
    clearActors(s, ['c09_trunks', 'c09_goku', 'c09_vegeta', 'c09_bulma']);
    talker(s, 'c09_bulmaPad', 'bulma', HUB.ccPad.bulmaX, HUB.ccPad.bulmaY, 'up', 'c09_bulma_pad', 'Bulma');
    s.show('hero', true);
    s.switchTo('trunks');
    unforce(s);
    s.place('hero', 31, 10, 'up');
    s.unlockRegion('c09_spot_mine');
    await s.quest('c09_q_fuel');
    await s.quest('c09_q_gohan', true);
    s.letterbox(false);
  },

  // ================================================================== the mine
  c09_mine_enter: async (s) => {
    // A save made mid-fight must not leave the Excavator's shaft trigger spent.
    if (!s.flag('defeated:c09_excavator1')) s.clear('c09_exStarted');
    if (s.flag('c09_mineSeen') || !s.check('quest:c09_q_fuel')) return;
    s.set('c09_mineSeen');
    s.letterbox(true);
    await s.pan(19, 18, 40);
    await s.say('hero', 'Old tunnels, a lake, and something is moving down there... Bulma said the crystals glow blue.');
    await s.pan(33, 4, 40);
    await s.narrate('Examine glowing Hyper-Crystal veins with A. One lies on the islet in the lake, one in the west gallery, and the last deep in the shaft.');
    s.follow();
    s.letterbox(false);
  },

  c09_crystal1: async (s) => {
    if (s.flag('c09_crys1')) return;
    await s.call('c09_crystal_take');
    s.set('c09_crys1');
    if (s.field.def.id === 'c09_mine') propOff(s, 'c09_vein1');
    await s.call('c09_crystal_check');
  },
  c09_crystal2: async (s) => {
    if (s.flag('c09_crys2')) return;
    await s.call('c09_crystal_take');
    s.set('c09_crys2');
    if (s.field.def.id === 'c09_mine') propOff(s, 'c09_vein2');
    await s.call('c09_crystal_check');
  },
  c09_crystal3: async (s) => {
    if (s.flag('c09_crys3')) return;
    if (!s.flag('defeated:c09_excavator1')) {
      await s.narrate('A huge drill arm is clamped around this vein. Something big is resting on the platform nearby.');
      return;
    }
    await s.call('c09_crystal_take');
    s.set('c09_crys3');
    if (s.field.def.id === 'c09_mine') propOff(s, 'c09_vein3');
    await s.call('c09_crystal_check');
  },
  c09_crystal_take: async (s) => {
    s.sfx('slash');
    s.flash('#80e8f8', 6);
    await s.wait(8);
    await s.give('c09_crystal');
  },
  c09_crystal_check: async (s) => {
    const n = s.count('c09_crystal');
    if (n >= 3 && s.check('quest:c09_q_fuel')) {
      await s.done('c09_q_fuel');
      await s.say('hero', 'That\'s all three! Time to get these back to Bulma.', 'happy');
      await s.quest('c09_q_depart');
    } else if (n < 3) {
      await s.say('hero', `${n} down, ${3 - n} to go.`);
    }
  },

  /** Mini-boss: the Excavator wakes when someone walks into its shaft. */
  c09_excavator_fight: async (s) => {
    if (s.flag('defeated:c09_excavator1') || s.flag('c09_exStarted')) return;
    s.set('c09_exStarted');
    s.letterbox(true);
    await s.pan(32, 4, 30);
    actor(s, 'c09_exNpc', 'c09_excavator', 32, 4, 'down', 'Excavator X-7');
    s.flash('#f04040', 6);
    s.sfx('charge');
    await s.wait(8);
    await s.say('c09_exNpc', 'WARNING. INTRUDER IN SHAFT 7. MINING PROTOCOL: REMOVE OBSTRUCTION. OBSTRUCTION IS: YOU.');
    s.follow();
    await s.say('hero', 'Dr. Brief really should have unplugged this thing.', 'smirk');
    s.remove('c09_exNpc');
    s.letterbox(false);
    s.music('battle');
    const r = await bout(s, 'c09_excavator', { x: 32, y: 4, uid: 'c09_excavator1' });
    if (r !== 'win') s.set('defeated:c09_excavator1');
    clearActors(s, ['c09_excavator1']);
    s.music('cave');
    await s.say('hero', 'It\'s down. The last crystal vein should be free now.');
  },
  c09_excavator_phase2: async (s) => {
    s.toast('EXCAVATOR: OVERDRIVE ENGAGED. DEPLOYING SURVEY DRONES.');
  },

  // ================================================================== departure
  /** Bulma at the hangar pad (Chapters 9-11). Dispatches by story state. */
  c09_bulma_pad: async (s) => {
    const me = who(s, 'bulma');
    if (s.check('chapter==11')) { await s.call('c11_bulma_pad'); return; }
    if (s.check('chapter==10')) { await s.call('c10_bulma_pad'); return; }
    if (s.check('quest:c09_q_depart') && s.count('c09_crystal') >= 3) { await s.call('c09_depart'); return; }
    if (s.check('quest:c09_q_fuel')) {
      const n = s.count('c09_crystal');
      await s.say(me, n > 0
        ? `${n} crystal${n > 1 ? 's' : ''}! Keep going. The mine is north-east of West City - fly there from the world map.`
        : 'Three Hyper-Crystals from the old mine, north-east of West City. Use the world map sign out on the street!');
      return;
    }
    await s.say(me, 'Cell\'s old egg runs better than it has any right to. Science!', 'happy');
  },

  /** The trip to the future. */
  c09_depart: async (s) => {
    const me = who(s, 'bulma');
    s.take('c09_crystal', 3);
    s.letterbox(true);
    await s.say(me, 'Three Hyper-Crystals! Okay. Give me one hour, and don\'t touch anything.', 'happy');
    await s.fadeOut(30);
    // Whoever fetched the crystals, it is Trunks who rides home: swap him in while the screen is dark.
    if (s.hero !== 'trunks') {
      s.switchTo('trunks');
      s.place('hero', HUB.ccPad.arriveX, HUB.ccPad.arriveY, 'up');
    }
    await s.narrate('One hour later...');
    await s.fadeIn(30);
    await s.give('c09_fuel');
    await s.done('c09_q_depart');
    // Goku and Vegeta come in from the lawn to see them off.
    clearActors(s, ['c09_gokuY', 'c09_vegetaY']);
    actor(s, 'c09_goku', 'goku', 29, 10, 'up');
    actor(s, 'c09_vegeta', 'vegeta', 34, 10, 'up');
    await s.talk([
      [me, 'Fuel\'s in. It will get you there and back. Once. Twice if NOBODY BLOWS IT UP.', 'angry'],
      ['c09_goku', 'Alright! Let\'s go meet this Black guy on his home turf!', 'happy'],
      ['c09_vegeta', 'Try not to get in my way, Kakarot.'],
      ['hero', 'Mom... I mean, Bulma. Thank you. For everything. In both timelines.', 'sad'],
      [me, 'Come back in one piece. All three of you. That\'s an order from the president of Capsule Corp.', 'sad'],
    ]);
    s.take('c09_fuel');
    s.unlockRegion('spot_future_city');
    s.unlockRegion('spot_future_base');
    s.set('c09_arrivedFuture');
    await timeTravel(s, 'future', 'future_hideout_in', HUB.hideoutIn.arriveX, HUB.hideoutIn.arriveY, 'The time machine tears through the years...');
    await s.call('c09_reunion');
  },

  /** The Resistance hideout: Mai is alive. */
  c09_reunion: async (s) => {
    s.set('c09_arrivedFuture');
    talker(s, 'c09_fmai', 'futureMai', HUB.hideoutIn.maiX, HUB.hideoutIn.maiY, 'down', 'c09_mai_talk', 'Mai');
    s.letterbox(true);
    s.music('sad');
    actor(s, 'c09_goku', 'goku', 8, 12, 'up');
    actor(s, 'c09_vegeta', 'vegeta', 11, 12, 'up');
    s.place('hero', 9, 11, 'up');
    await s.say('c09_fmai', 'Trunks...? TRUNKS!', 'shock');
    await s.walk('c09_fmai', 9, 10, 2);
    await s.talk([
      ['hero', 'Mai! You\'re alive! I thought Black had...', 'shock'],
      ['c09_fmai', 'I hid under the rubble for two days. It takes more than a fake Goku to get rid of me.', 'smirk'],
      ['c09_goku', 'So you\'re Mai? Huh. You\'re way taller than the one in our time.', 'happy'],
      ['c09_fmai', '...What?'],
      ['hero', 'Long story. A really, really long story.', 'smirk'],
      ['c09_vegeta', 'Enough reunions. Where is Black?', 'angry'],
      ['c09_fmai', 'Quiet, since you left. Too quiet. But there\'s something else... he isn\'t alone anymore.', 'sad'],
    ]);
    clearActors(s, ['c09_goku', 'c09_vegeta']);
    await s.walk('c09_fmai', HUB.hideoutIn.maiX, HUB.hideoutIn.maiY, 1.4);
    s.face('c09_fmai', 'down');
    s.letterbox(false);
    if (s.hasScript('c10_start')) await s.call('c10_start');
  },

  // ================================================================== side quests
  /** Pilaf Gang homework (bronze), kitchen of Capsule Corp. */
  c09_pilaf_talk: async (s) => {
    const me = who(s, 'pilaf');
    if (s.check('done:c09_q_homework')) {
      await s.say(me, 'We got a B-minus! Do you know what this means? World domination is only a few grades away!', 'happy');
      return;
    }
    if (!s.check('chapter>=9')) { await s.say(me, 'Go away, we\'re studying! ...Shu, what\'s a "fraction"?'); return; }
    if (s.hero !== 'trunks') {
      await s.say(me, 'Not you! We need the one from the FUTURE. He has seen the answers already. Probably.', 'angry');
      return;
    }
    await s.talk([
      [me, 'You! Time traveller! You\'re from the future, so you must know the answers to our homework!', 'smirk'],
      ['hero', 'That\'s not really how it works...'],
      [me, 'Silence! Answer three questions, or we will be forced to... um... keep asking!', 'angry'],
    ]);
    await s.quest('c09_q_homework', true);
    let right = 0;
    if (await s.ask(me, 'Question one! What is seven times eight?', ['54', '56', '58']) === 1) right++;
    if (await s.ask(me, 'Question two! A time machine leaves Age 796 and travels back 17 years. What year does it land in?', ['Age 777', 'Age 779', 'Age 781']) === 1) right++;
    if (await s.ask(me, 'Question three! How do you spell "Capsule"?', ['Kapsool', 'Capsule', 'Capsool']) === 1) right++;
    if (right === 3) {
      await s.talk([
        [me, 'All correct?! Genius! The future must be full of geniuses!', 'happy'],
        ['hero', 'The future is mostly full of rubble, but thanks.', 'smirk'],
      ]);
      await s.done('c09_q_homework');
      await s.give('end1');
      await s.give('cookie', 3);
    } else {
      await s.say(me, `Only ${right} right?! Shu says that\'s an F. Come back when you\'ve studied!`, 'angry');
    }
  },
  c09_mai_kid_talk: async (s) => {
    const me = who(s, 'mai');
    if (s.check('chapter>=11')) {
      await s.say(me, s.hero === 'trunks'
        ? 'Bulma says the Mai in your time is brave and tall and good with a rifle. ...Tell her I said hi. Or don\'t. Whatever.'
        : 'Pilaf wants to sneak into the time machine and conquer the past. I told him we ARE the past. He cried.', 'smirk');
      return;
    }
    if (s.hero === 'trunks') {
      await s.say(me, 'So in the future... do I still hang out with Pilaf? ...Don\'t answer that.', 'sad');
      return;
    }
    await s.say(me, 'The guy from the future has a sword. Our Trunks has a skateboard. Life isn\'t fair.');
  },
  c09_shu_talk: async (s) => {
    const me = who(s, 'shu');
    if (s.check('done:c09_q_homework')) {
      await s.say(me, 'I wrote down ALL the answers this time! Then Lord Pilaf used the paper as a napkin.', 'happy');
      return;
    }
    await s.say(me, 'I\'m in charge of writing down the answers! I haven\'t written anything yet!', 'happy');
  },

  /** Kid Trunks meets (and keeps reacting to) his grown-up self. */
  c09_kid_trunks_talk: async (s) => {
    const me = who(s, 'trunksKid');
    if (s.check('chapter>=11')) {
      await s.say(me, 'Goten and me are gonna train SO hard that next time the future needs help, WE go. ...After homework.', 'happy');
      return;
    }
    if (s.check('chapter==10')) {
      await s.say(me, s.hero === 'goku'
        ? 'Goku! Is big me okay over there? Dad too? ...Not that I\'m worried about Dad. He\'s Dad.'
        : 'Mom keeps staring at Cell\'s egg machine. She says it\'s "personal" now.', 'sad');
      return;
    }
    if (s.hero === 'trunks') {
      const n = s.inc('c09_kidT_n');
      const lines: Array<[string, 'happy' | 'shock' | 'smirk' | 'sad']> = [
        ['So you\'re... me? From the future? Do I get a sword? Do I get TALLER?', 'shock'],
        ['Mom says you\'re super polite. That\'s so weird. Are you sure you\'re me?', 'smirk'],
        ['Hey... is it scary? Over there? ...You can tell me. I won\'t tell Goten.', 'sad'],
      ];
      const [line, e] = lines[(n - 1) % lines.length];
      await s.say(me, line, e);
      return;
    }
    await s.say(me, 'The guy from the future is ME. That\'s so cool. ...Is it cool? He looks really tired.', 'happy');
  },

  /** Goku hangs around the lawn while the fuel quest runs. */
  c09_goku_yard: async (s) => {
    const me = who(s, 'goku');
    if (s.count('c09_crystal') >= 3) {
      await s.say(me, 'All three crystals? Then what are we waiting for! Bulma\'s over at the hangar pad!', 'happy');
      return;
    }
    if (s.hero === 'vegeta') {
      await s.say(me, 'Vegeta! Race you to the mine? Loser buys dinner! ...Hey, wait up!', 'happy');
      return;
    }
    const n = s.inc('c09_gokuY_n');
    await s.say(me, n % 2
      ? 'Dr. Brief\'s giant mining robot is still in that cave? Aw, man. I wanna punch a giant robot.'
      : 'That Black guy\'s ki was so cold... Trunks, when this is over, I owe you a real spar. Vegeta says I\'m not allowed to "steal" you.', 'smirk');
  },

  /** Vegeta pretends not to wait for his son. */
  c09_vegeta_yard: async (s) => {
    const me = who(s, 'vegeta');
    if (s.count('c09_crystal') >= 3) {
      await s.say(me, 'Good. Now get them to Bulma before Kakarot "helps" and drops one in the pool.', 'smirk');
      return;
    }
    if (s.hero === 'goku') {
      await s.say(me, 'Don\'t talk to me, Kakarot. I\'m picturing beating a man with your face. It\'s very relaxing.', 'smirk');
      return;
    }
    await s.say(me, s.hero === 'trunks'
      ? 'What are you standing around for? The crystals won\'t dig themselves up. ...Watch out for the robot.'
      : 'Hmph. The boy went to the mine, and I am NOT waiting for him. I\'m just... standing here.', 'angry');
  },

  /** An old master (silver): Trunks meets this era's Gohan. */
  c09_gohan_talk: async (s) => {
    const me = who(s, 'gohan');
    if (s.check('done:c09_q_gohan')) {
      await s.say(me, 'Come by any time, Trunks. Videl makes too much food anyway. Pan would love another uncle.', 'happy');
      return;
    }
    if (!s.check('chapter>=9')) { await s.say(me, 'Sorry, I\'m in the middle of a paper. Can it wait?'); return; }
    if (s.hero !== 'trunks') {
      await s.say(me, 'I heard Trunks from the future is back. I hope he stops by... I\'d like to meet him properly.');
      return;
    }
    s.letterbox(true);
    await s.talk([
      [me, 'Trunks? Wow... Dad said you were back. Come in, come in! Sorry about the mess, I\'m writing a thesis.', 'happy'],
      ['hero', 'Gohan. You... you were my master. In my world, you trained me. You lost your arm protecting me.', 'sad'],
      ['hero', 'And then you went to fight the androids alone, so I wouldn\'t have to.', 'sad'],
      [me, '...', 'sad'],
      [me, 'Then I\'m glad. Not that it happened. But that even over there, I tried to do the right thing.', 'sad'],
      [me, 'I\'m not much of a fighter these days, Trunks. But if he trained you, then he\'s still fighting. Through you.', 'happy'],
      ['hero', '...Thank you, Gohan. I needed to hear that.', 'happy'],
    ]);
    await s.give('pow3');
    await s.say(me, 'And take this. Dad keeps leaving stat capsules in our fridge. I don\'t even know where he gets them.', 'smirk');
    await s.done('c09_q_gohan', false);
    s.letterbox(false);
  },
  c09_videl_talk: async (s) => {
    const me = who(s, 'videl');
    if (s.hero === 'gohan') {
      await s.say(me, s.check('done:c09_q_gohan')
        ? 'Trunks seemed lighter after talking with you. You should invite him back. Pan liked his sword.'
        : 'Did you hear? Trunks from the future is back! Go see him at Capsule Corp, Gohan. ...After you eat something.', 'happy');
      return;
    }
    if (s.hero === 'trunks') {
      await s.say(me, 'You\'re the Trunks from the future? Gohan has been grinning since you walked in. Stay for dinner!', 'happy');
      return;
    }
    await s.say(me, 'Gohan is buried in his research again. If you see him come up for air, tell him dinner\'s ready.');
  },
});
