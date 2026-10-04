import type { Expression } from '../../../art/portrait';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { battle, bossFight, BUSY, forceFade, freeNear, heroTile, npcWithSprite, rememberHero, removeAll, restoreHero, stage, stageOrReuse, stageTalker, warpTo } from './helpers';
import { HUB } from './hubs';

/**
 * Chapter 12 — "Days of Peace" (L40→42). A LoG2-style free-roam hub: four peacetime episodes, any two of
 * which finish the gold quest and roll into Chapter 13 (the other two stay available as side content).
 */

const EPISODES = ['c12_hit', 'c12_pan', 'c12_saiyaman', 'c12_krillin'] as const;

/** Pan's hiding spots in the Paozu Highlands, in chase order. */
const PAN_SPOTS: Array<[number, number]> = [[8, 7], [29, 4], [33, 20], [6, 21]];

function episodesDone(s: ScriptApi): number {
  return EPISODES.filter((q) => s.check(`done:${q}`)).length;
}

/** Shared end-of-episode bookkeeping: count episodes and roll into Chapter 13 after the second. */
async function progress(s: ScriptApi): Promise<void> {
  if (s.hasScript('c12_progress')) await s.call('c12_progress');
}

type Lines = Array<[string, string, Expression?]>;

/**
 * Where Krillin is in his own story when "Krillin's comeback" is played: the moping cop of Chapter 12, a
 * Mighty Ten recruit who is scared stiff, or a tournament veteran (post-game). His lines follow it.
 */
function krillinPhase(s: ScriptApi): 'ch12' | 'team' | 'post' {
  if (!s.check('done:c13_krillin')) return 'ch12';
  return s.flag('c14_won') ? 'post' : 'team';
}

/** Krillin is at Kame House unless he is on patrol (being recruited) or in the World of Void. */
function krillinAtHome(s: ScriptApi): boolean {
  return !s.check('quest:c13_krillin') && !s.check('c14_departed&!c14_won');
}

registerScripts({
  /**
   * First onEnter script of every act 5 map with walk-on exits or event triggers (and of the tournament stage
   * overlays): a freshly entered map is never mid-fight, so an interrupted fight's BUSY flag is dropped here.
   */
  act5_map_enter: async (s) => {
    s.clear(BUSY);
  },

  // ================================================================ chapter start
  c12_start: async (s) => {
    ensureChapterState(s, 12);
    unforce(s);
    await s.chapter(12, 'Days of Peace', 'Some time after the battle with Zamasu');
    s.switchTo('goku');
    s.set('world', 'earth');
    await warpTo(s, HUB.home.map, HUB.home.arrive[0], HUB.home.arrive[1], 'right');
    s.letterbox(true);
    s.music('peaceful');
    await s.narrate('The ruined future is behind them. Trunks and Mai have a new world to rebuild, and on this Earth...');
    await s.narrate('...nothing is happening. Nothing at all. For Son Goku, that is the scariest thing of all.');
    const [gx, gy] = heroTile(s);
    // Chi-Chi and Goten live here from now on (overlay NPCs); stage stand-ins only if they are missing.
    const tempChichi = stageOrReuse(s, 'act5_chichi', 'chichi', gx - 6, gy, 'right', 'Chi-Chi');
    const tempGoten = stageOrReuse(s, 'act5_goten', 'goten', gx + 3, gy - 1, 'left', 'Goten');
    s.pose('hero', 'punch1');
    await s.wait(10);
    s.pose('hero', 'punch2');
    await s.wait(10);
    s.pose('hero', null);
    await s.walk('act5_chichi', gx - 2, gy, 1.5);
    s.face('act5_chichi', 'hero');
    await s.talk([
      ['chichi', 'Goku! You\'ve been punching that same stump since sunrise. The radishes won\'t harvest themselves!', 'angry'],
      ['goku', 'But Chi-Chi, it\'s so peaceful. No Zamasu, no Black, no Frieza... I\'m bored out of my skull.', 'sad'],
      ['chichi', 'Bored? Then make yourself useful! Everyone in this family has a job but you.', 'angry'],
    ]);
    await s.emote('act5_goten', '!');
    await s.walk('act5_goten', gx + 1, gy, 1.5);
    s.face('act5_goten', 'hero');
    await s.talk([
      ['goten', 'Dad! Gohan phoned. Videl needs a babysitter for Pan today... and Pan learned to fly yesterday!', 'happy'],
      ['goten', 'Oh, and Krillin called. He sounded really sad. Something about a robber who outran him.'],
      ['chichi', 'And Gohan is doing stunts for some silly movie in Satan City. Our son, the brilliant scholar, in a costume!', 'sad'],
      ['goku', 'Heh, see? Everyone needs me after all!', 'happy'],
      ['goten', 'Also Whis came by. He said Lord Beerus is at Capsule Corp, and something about "an assassin who works nights." He was giggling.'],
      ['goku', 'An assassin? Now THAT sounds fun!', 'smirk'],
    ]);
    s.unlockRegion('spot_snow');
    await s.narrate('Bulma has also opened a dinosaur preserve in the Snowy Highlands for "research". It is now on the world map. The level 50 gates up there guard old trophies.');
    await s.narrate('DAYS OF PEACE: help your friends! Finish any two of the four episodes in your Journal to continue the story.');
    await s.quest('c12_days', true);
    for (const q of EPISODES) await s.quest(q, true);
    await s.narrate('Journal updated!');
    if (tempChichi) removeAll(s, 'act5_chichi'); else s.place('act5_chichi', HUB.home.chichi[0], HUB.home.chichi[1], 'down');
    if (tempGoten) removeAll(s, 'act5_goten'); else s.place('act5_goten', HUB.home.goten[0], HUB.home.goten[1], 'down');
    s.letterbox(false);
  },

  /** Counts finished episodes; the second one ends the chapter. */
  c12_progress: async (s) => {
    const n = episodesDone(s);
    if (s.state.data.chapter !== 12 || s.flag('c12_finished')) return;
    if (n < 2) {
      await s.narrate(`Days of Peace: ${n} of 2 episodes complete. Your friends are waiting!`);
      return;
    }
    s.set('c12_finished');
    await s.done('c12_days', false);
    s.heal();
    await s.give('senzu', 2);
    await s.narrate('Peaceful days pass. Bulma\'s second baby is due any moment, Vegeta refuses to leave her side... and Goku can\'t sit still any longer.');
    if (s.hasScript('c13_start')) await s.call('c13_start');
  },

  // ================================================================ Episode 1: Hit's contract
  /** Rooftop arrival: the night Hit strikes (needs Whis's hint), or Hit's post-game rematch. */
  c12_roof_enter: async (s) => {
    if (s.flag('c12_hitHinted') && !s.check('done:c12_hit')) { await s.call('c12_hit_scene'); return; }
    if (s.check('quest:c12_hit') && !s.flag('c12_roofLook')) {
      s.set('c12_roofLook');
      await s.narrate('Nothing up here but pigeons and a great view. Goten said Whis knew something about this "assassin"... Lord Beerus and Whis are at Capsule Corp.');
    }
  },

  c12_hit_scene: async (s) => {
    if (s.check('done:c12_hit')) return;
    rememberHero(s, 'hit');
    await forceFade(s, 'goku');
    s.letterbox(true);
    s.music('tense');
    await s.narrate('Midnight over Satan City. Goku sits on the hotel roof, eating cold rice one grain at a time.');
    const [hx, hy] = heroTile(s);
    await s.talk([
      ['goku', 'One grain... I can feel the wind... the pigeons... a cockroach behind a fridge three blocks away...', 'neutral'],
      ['goku', 'Whoever you are, you\'re good. I can\'t feel you at all. So, just in case...', 'smirk'],
    ]);
    s.pose('hero', 'raise');
    s.flash('#f8e070', 8);
    s.sfx('blast');
    await s.wait(20);
    s.pose('hero', null);
    stage(s, 'c12_hitA', 'hit', hx + 2, hy - 1, 'left', 'Hit');
    s.silhouette('c12_hitA', true);
    s.show('c12_hitA', false);
    await s.wait(30);
    s.show('c12_hitA', true);
    s.sfx('teleport');
    s.flash('#c070f0', 12);
    s.shake(16, 2);
    s.pose('hero', 'ko');
    await s.narrate('...');
    await s.narrate('Goku\'s heart has stopped.');
    s.boom(hx, hy, 14, '#f8e070');
    s.pose('hero', null);
    await s.talk([
      ['goku', 'GAAH! Hah... hah... Knew it! You went for the heart! So I set a ki blast to come down and restart it!', 'hurt'],
    ]);
    s.silhouette('c12_hitA', false);
    await s.talk([
      ['hit', 'A delayed blast fired into the sky. You bet your life on your own heartbeat.'],
      ['hit', 'The contract stands. This time I will not stop at one strike.', 'angry'],
      ['goku', 'Then come on, Hit! Show me everything!', 'shout'],
    ]);
    s.letterbox(false);
    s.music('hit');
    const [bx, by] = freeNear(s, hx + 3, hy - 2);
    s.remove('c12_hitA');
    const r = await bossFight(s, 'c12_hit', { x: bx, y: by, uid: 'c12_hit1' });
    removeAll(s, 'c12_hit1');
    s.letterbox(true);
    stage(s, 'c12_hitB', 'hit', bx, by, 'left', 'Hit');
    s.face('hero', 'c12_hitB');
    await s.talk([
      ['hit', r === 'win' ? 'Hm. You read the gaps between my skipped seconds.' : 'Enough. You have learned to read the gaps between my skipped seconds.'],
      ['goku', 'Heh heh. So, uh, about that contract... I\'m the one who hired you. Through Whis and Vados! Best training money can buy!', 'happy'],
      ['hit', 'I am aware. The payment was adequate.'],
      ['hit', 'But the contract you wrote has no end date. Watch your back, Son Goku.', 'smirk'],
    ]);
    s.sfx('teleport');
    s.remove('c12_hitB');
    s.flash('#c070f0', 8);
    await s.narrate('Hit is gone. Somewhere far away, Whis and Vados are surely laughing.');
    s.letterbox(false);
    await s.done('c12_hit', false);
    s.set('c12_hitDone');
    await s.give('end3');
    if (s.flag('post_game')) await s.quest('post_hit');
    unforce(s);
    restoreHero(s, 'hit');
    await progress(s);
  },

  /** Rooftop stairs back down to the plaza. */
  c12_roof_leave: async (s) => {
    await warpTo(s, HUB.plaza.map, HUB.plaza.roofReturn[0], HUB.plaza.roofReturn[1], 'down');
  },

  /** Hotel Satan's night porter (plaza overlay): up to the roof. */
  c12_porter_talk: async (s) => {
    if (!s.check('chapter>=12')) { await s.say('c12_porter', 'Welcome to Hotel Satan. Every room has a view of a Mr. Satan statue.'); return; }
    const hitWaiting = (s.flag('c12_hitHinted') && !s.check('done:c12_hit')) || s.check('quest:post_hit');
    const c = await s.ask('c12_porter', hitWaiting
      ? 'Ah, the guest who asked about the roof. A strange man in a long coat went up there an hour ago. He didn\'t use the stairs. Shall I take you?'
      : 'Roof access is for staff and world champions. ...You look like you could be a world champion. Go on up?', ['Go up to the roof', 'Not now']);
    if (c !== 0) return;
    if (s.flag('c12_hitHinted') && !s.check('done:c12_hit')) {
      // The contract is on Goku: he is the one who goes up tonight (switched in the dark, before the warp).
      rememberHero(s, 'hit');
      if (s.hero !== 'goku') {
        await s.fadeOut(12);
        force(s, 'goku');
      }
    }
    await warpTo(s, 'c12_rooftop', 8, 16, 'up');
  },

  // ================================================================ Episode 2: Pan's first flight
  /** Videl in Paozu Valley (overlay). */
  c12_videl_talk: async (s) => {
    if (s.check('char:satan')) {
      await s.talk([
        ['videl', 'Dad?! You\'re... training? With Goku\'s family? Who are you and what have you done with my father?', 'shock'],
        ['mrSatan', 'Videl, sweetie! A champion never stops improving! ...Is Pan around? Grandpa brought candy!', 'happy'],
      ]);
      return;
    }
    if (s.check('done:c12_pan')) {
      const line = s.flag('post_game') ? 'Gohan says the tournament was "educational". He fell asleep at dinner with his glasses on. My hero.'
        : s.check('done:c13_gohan') ? 'Gohan is training with Piccolo again. He came home bruised and smiling. I haven\'t seen that smile in years.'
          : s.check('chapter>=13') ? 'A tournament for the whole universe... Gohan says he\'s fighting. Pan and I will be cheering. Loudly.'
            : 'Pan hasn\'t stopped talking about "flying with {hero}". Well, babbling. Thank you again.';
      await s.say('videl', line, 'happy');
      return;
    }
    if (!s.check('chapter>=12')) {
      await s.say('videl', 'Gohan is buried in papers again. I\'m going to drag him out for some sun!', 'smirk');
      return;
    }
    s.letterbox(true);
    const [vx, vy] = heroTile(s);
    await s.talk(s.hero === 'gohan' ? [
      ['videl', 'Gohan! Your conference was cancelled? Perfect timing! I have to pick up my dad. Can you watch Pan for an hour?', 'happy'],
      ['gohan', 'Of course! How hard can it be? She\'s my daughter.', 'happy'],
      ['videl', 'She\'s YOUR daughter. That\'s exactly the problem. She learned to fly yesterday, and she thinks it\'s HILARIOUS.', 'smirk'],
    ] : [
      ['videl', '{hero}! Perfect timing! I have to pick up my dad and Gohan is at a conference. Could you watch Pan for an hour?', 'happy'],
      ['hero', 'Sure! How hard can babysitting be?', 'happy'],
      ['videl', 'Just... don\'t take your eyes off her. She learned to fly yesterday. She thinks it\'s HILARIOUS.'],
    ]);
    stage(s, 'c12_panV', 'pan', vx + 1, vy - 1, 'down', 'Pan');
    await s.say('pan', 'Kyahaha! Bwee!', 'happy');
    await s.lift('c12_panV', 16, 16);
    await s.flyTo('c12_panV', vx - 2, vy - 10, 3);
    s.remove('c12_panV');
    await s.talk([
      ['videl', 'PAN! She\'s heading for the highlands! {hero}, please, bring her back without a scratch!', 'shock'],
      ['hero', 'On it!', 'shout'],
    ]);
    await s.quest('c12_pan', true);
    s.set('c12_panStage', 1);
    s.clear('c12_panCaught');
    s.letterbox(false);
    await warpTo(s, 'c12_pan_meadow', 19, 25, 'up');
  },

  /** Meadow arrival: put Pan at her current hiding spot. */
  c12_meadow_enter: async (s) => {
    if (!s.check('quest:c12_pan')) return;
    const stg = Math.max(1, Math.min(4, s.num('c12_panStage') || 1));
    if (s.flag('c12_panCaught')) {
      s.clear('c12_panCaught');
      stageTalker(s, 'c12_pan', 'pan', PAN_SPOTS[3][0], PAN_SPOTS[3][1], 'c12_pan_talk', 'Pan');
      s.set('c12_panStage', 4);
      await s.narrate('Pan wriggled free while you were away. She is giggling somewhere in the south-west meadow.');
      return;
    }
    if (s.exists('c12_pan')) {
      const [px, py] = PAN_SPOTS[stg - 1];
      s.place('c12_pan', px, py, 'down');
    }
    if (!s.flag('c12_meadowIntro')) {
      s.set('c12_meadowIntro');
      await s.narrate('Pan is floating somewhere in the Paozu Highlands. Catch her by talking to her - she won\'t make it easy.');
    }
  },

  c12_pan_talk: async (s) => {
    if (!s.check('quest:c12_pan')) { await s.say('pan', 'Ba-bu!', 'happy'); return; }
    const stg = Math.max(1, s.num('c12_panStage') || 1);
    if (stg < 4) {
      const lines = ['Kyahaha! Bwee!', 'Nyeh! *blows raspberry*', s.hero === 'goku' ? 'Gampa slow! Hehe!' : 'Swowpoke! Hehe!'];
      await s.say('pan', lines[stg - 1], 'happy');
      const [nx, ny] = PAN_SPOTS[stg];
      if (s.exists('c12_pan')) await s.flyTo('c12_pan', nx, ny, 3);
      s.set('c12_panStage', stg + 1);
      await s.say('hero', stg === 1 ? 'Hey! Get back here, you little rocket!' : stg === 2 ? 'She\'s faster than Goten was at her age...' : 'Last chance, Pan. I\'m coming!', 'shock');
      return;
    }
    await s.say('pan', 'Ehehe... *yawn*', 'happy');
    removeAll(s, 'c12_pan');
    s.set('c12_panCaught');
    s.carry('grip on Pan', 'c12_pan_slip');
    await s.narrate('You caught Pan! Carry her back to Videl at the south trail. You can\'t attack while carrying her - one hit and she\'ll wriggle free!');
  },

  /** Hit while carrying Pan: she slips away to the south-west meadow again. */
  c12_pan_slip: async (s) => {
    s.clear('c12_panCaught');
    s.set('c12_panStage', 4);
    const [hx, hy] = heroTile(s);
    stageTalker(s, 'c12_pan', 'pan', hx, hy - 1, 'c12_pan_talk', 'Pan');
    await s.say('pan', 'Waaah! ...Kyahaha!', 'happy');
    await s.flyTo('c12_pan', PAN_SPOTS[3][0], PAN_SPOTS[3][1], 3);
  },

  /** Videl waiting at the meadow trail. */
  c12_videl_meadow: async (s) => {
    if (s.check('done:c12_pan')) { await s.say('videl', 'Thank you so much, {hero}!', 'happy'); return; }
    if (!s.carrying && !s.flag('c12_panCaught')) {
      await s.say('videl', 'She\'s up there somewhere! Pan! Come back to Mommy!', 'shock');
      return;
    }
    s.drop();
    s.clear('c12_panCaught');
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    stage(s, 'c12_panHome', 'pan', hx, hy - 1, 'down', 'Pan');
    await s.walk('c12_panHome', hx + 1, hy, 1);
    await s.talk([
      ['videl', 'Pan! Oh, thank goodness. Not a scratch on her!', 'happy'],
      ['pan', 'Fwy! Fwy again!', 'happy'],
      ['videl', 'Absolutely not. You\'re grounded until you\'re thirty.', 'smirk'],
      ['videl', 'Thank you, {hero}. Here, Gohan keeps these in his desk "for emergencies". I think this counts.', 'happy'],
    ]);
    removeAll(s, 'c12_panHome');
    s.letterbox(false);
    await s.done('c12_pan', false);
    await s.give('str3');
    await progress(s);
  },

  // ================================================================ Episode 3: Great Saiyaman, the movie
  /** Film director in Satan City (overlay). */
  c12_director_plaza: async (s) => {
    if (s.check('done:c12_saiyaman')) {
      await s.say('c12_director', 'The footage is incredible! Nobody believes the monster was real, which is perfect. It\'s called ACTING.', 'happy');
      return;
    }
    if (!s.check('chapter>=12')) {
      await s.say('c12_director', 'I need a leading man, a stunt double and a monster. And a budget.', 'sad');
      return;
    }
    await s.talk([
      ['c12_director', 'You! Have you seen a nerdy young man in glasses? Gohan something? He\'s our stunt double and he\'s LATE!', 'angry'],
      ['hero', s.hero === 'gohan' ? 'Uh... that\'s me. Sorry, I was grading papers.' : 'Gohan? I\'ll go get him!'],
    ]);
    rememberHero(s, 'film');
    await s.fadeOut(12);
    force(s, 'gohan');
    s.outfit('gohan', 'gohanSuit');
    await s.narrate('Gohan reports to ZTV Studios, Lot B.');
    await warpTo(s, 'c12_film_set', 20, 21, 'up');
    await s.call('c12_film_shoot');
  },

  c12_film_shoot: async (s) => {
    s.letterbox(true);
    s.music('town');
    const [hx, hy] = heroTile(s);
    stage(s, 'c12_dirS', 'c12_director', hx - 2, hy + 1, 'up', 'Director');
    stage(s, 'c12_barryS', 'c12_barry', hx + 1, hy - 4, 'down', 'Barry Kahn');
    stage(s, 'c12_cocoaS', 'c12_cocoa', hx - 3, hy - 4, 'down', 'Cocoa');
    await s.talk([
      ['c12_barry', 'So YOU\'re the stunt double. The man Videl married instead of ME. Barry Kahn. You may have heard of me.', 'smirk'],
      ['gohan', 'Nice to meet you, Mr. Kahn! I loved you in "Revenge of the Space Ninja".', 'happy'],
      ['c12_barry', '...Ahem. Today you\'ll be playing the Great Saiyaman. The "monsters" are instructed to hit you. For real. Method acting.', 'smirk'],
      ['c12_director', 'PLACES! Scene twelve: the Great Saiyaman versus the Space Monsters! Costume!', 'shout'],
    ]);
    s.flash('#ffffff', 8);
    s.outfit('gohan', 'c12_saiyaman');
    await s.talk([
      ['gohan', 'The Great Saiyaman, champion of justice, has arrived! Hyah!', 'shout'],
      ['c12_cocoa', '...Huh. That pose is weirdly familiar.'],
      ['c12_director', 'ACTION!', 'shout'],
    ]);
    s.letterbox(false);
    s.music('battle');
    s.spawnEnemy('c12_stuntman', 14, 11);
    s.spawnEnemy('c12_stuntman', 25, 11);
    s.spawnEnemy('c12_stuntman', 20, 17);
    await battle(s);
    s.letterbox(true);
    await s.talk([
      ['c12_director', 'CUT! CUT! Too fast! The camera only caught a green blur! Again, and SLOWER this time!', 'angry'],
      ['gohan', 'Slower... right. Sorry, I\'m out of practice at being bad at this.', 'sad'],
    ]);
    s.sfx('explode');
    s.shake(14, 2);
    await s.talk([
      ['c12_director', 'What now?! Who blew up the bank set?!', 'shock'],
      ['c12_robber', 'Nobody move! This is a robbery! ...Wait, why is the vault made of cardboard?', 'angry'],
      ['gohan', 'Real robbers?! They must have mistaken the set for the real bank across the street!', 'shock'],
    ]);
    s.letterbox(false);
    s.spawnEnemy('c12_robber', 12, 9);
    s.spawnEnemy('c12_robber', 27, 9);
    s.spawnEnemy('c12_robber', 19, 13);
    await battle(s);
    s.letterbox(true);
    stage(s, 'c12_jacoS', 'jaco', hx + 4, hy - 1, 'left', 'Jaco');
    await s.talk([
      ['c12_director', 'Who hired these extras?! They were AMAZING! Get me their agents!', 'happy'],
      ['jaco', 'Gohan! Emergency! Galactic Patrol business! I was transporting the parasite Watagash and it, um, escaped. Into this lot.', 'shock'],
      ['jaco', 'It burrows into a host and mutates! Whatever you do, don\'t let it near anyone with a big ego!'],
      ['c12_barry', 'A tiny alien worm? Ha! What kind of idiot would let a worm... ack... ACK!', 'shock'],
    ]);
    s.flash('#b060e0', 14);
    s.shake(20, 2);
    s.sprite('c12_barryS', 'c12_watagash');
    await s.talk([
      ['c12_barry', 'MY FACE! What\'s happening to my beautiful FACE?!', 'hurt'],
      ['c12_watagash', 'Grrraaah! This body is strong! This ego is DELICIOUS!', 'angry'],
      ['gohan', 'Mr. Kahn! Hang on, I\'ll get that thing out of you!', 'shout'],
    ]);
    s.letterbox(false);
    const [wx, wy] = freeNear(s, 20, 12);
    s.remove('c12_barryS');
    s.music('boss');
    await bossFight(s, 'c12_watagash', { x: wx, y: wy, uid: 'c12_watagash1' });
    s.letterbox(true);
    await s.talk([['gohan', 'It just keeps mutating! Fine. No more holding back!', 'shout']]);
    await s.powerUp('hero', '#f8e048', 50);
    s.transformNow('ssj');
    await s.talk([['gohan', 'The Great Saiyaman... SUPER Saiyaman! Masenko... HA!', 'shout']]);
    if (s.exists('c12_watagash1')) {
      await s.blast('hero', 'c12_watagash1', '#f8f070');
      s.remove('c12_watagash1');
    }
    s.boom(wx, wy, 22, '#b060e0');
    stage(s, 'c12_barryOut', 'c12_barry', wx, wy, 'down', 'Barry Kahn');
    s.pose('c12_barryOut', 'ko');
    const [px, py] = freeNear(s, wx + 1, wy + 1);
    s.spawn('c12_worm', 'c12_watagashSpawn', px, py);
    if (s.exists('c12_jacoS')) await s.walk('c12_jacoS', px, py + 1, 2);
    s.remove('c12_worm');
    s.flash('#ffffff', 6);
    s.transformNow(null);
    await s.talk([
      ['jaco', 'Got it! Capsule sealed! The Galactic Patrol thanks you, citizen!', 'happy'],
      ['c12_director', 'That\'s a WRAP! ...Please tell me somebody was filming.', 'shock'],
      ['c12_cocoa', 'Nice moves, Gohan. Don\'t worry, your secret\'s safe with me...', 'smirk'],
      ['c12_cocoa', '...as long as you fly me home from work sometimes. Deal?', 'happy'],
      ['gohan', 'Eh heh heh... Videl is going to kill me.', 'sad'],
    ]);
    removeAll(s, 'c12_dirS', 'c12_barryOut', 'c12_cocoaS', 'c12_jacoS');
    s.set('c12_filmDone');
    s.outfit('gohan', null);
    s.letterbox(false);
    await s.done('c12_saiyaman', false);
    await s.give('c12_reel');
    await s.give('pow3');
    unforce(s);
    restoreHero(s, 'film');
    await progress(s);
  },

  c12_hit_p2: async (s) => {
    await s.say('hit', 'You are adapting. Then I will skip more time.', 'neutral');
  },
  c12_hit_p3: async (s) => {
    await s.say('goku', 'There! I can feel the gap between the seconds now!', 'shout');
  },
  c12_cell_p2: async (s) => {
    await s.say('c12_cell', 'Krillin\'s fear feeds me. The more you struggle, the stronger I become!', 'smirk');
  },
  c12_watagash_p2: async (s) => {
    await s.say('c12_watagash', 'More! More power! This body was made for STARDOM!', 'angry');
  },
  c12_watagash_p3: async (s) => {
    await s.say('hero', 'It\'s draining energy now! Keep moving!', 'shock');
  },

  /** Film lot gate back to the plaza. */
  c12_film_leave: async (s) => {
    await warpTo(s, HUB.plaza.map, HUB.plaza.filmReturn[0], HUB.plaza.filmReturn[1], 'down');
  },

  c12_director_talk: async (s) => {
    if (s.flag('c12_filmDone')) { await s.say('c12_director', 'Post-production will add a monster that LOOKS real. The real one looked fake.', 'happy'); return; }
    await s.say('c12_director', 'Where is my stunt double?! Somebody find Gohan!', 'angry');
  },
  c12_barry_talk: async (s) => {
    await s.say('c12_barry', 'I don\'t remember a thing after lunch. Why does my face hurt? And why do I crave... attention? More than usual?', 'shock');
  },
  c12_cocoa_talk: async (s) => {
    if (s.flag('c12_filmDone')) { await s.say('c12_cocoa', 'Tell Gohan I\'ll need a lift on Tuesday. He knows why.', 'smirk'); return; }
    await s.say('c12_cocoa', 'I\'m Cocoa. I play the girl the Great Saiyaman rescues. I bet I could rescue myself.', 'smirk');
  },
  c12_grip_talk: async (s) => {
    const n = s.inc('c12_gripTalks');
    const lines = [
      'I\'m the key grip. Nobody knows what that means. Including me.',
      'Lunch is cold sandwiches again. They spent the whole budget on Barry Kahn\'s hair.',
      'Mr. Satan wants a cameo in every ZTV movie. He played "Man Who Saves Day" in the last nine.',
    ];
    await s.say('c12_grip', lines[(n - 1) % lines.length]);
  },

  // ================================================================ Episode 4: Krillin's comeback
  /**
   * Krillin at Kame House (overlay; one stand-in per phase): hand in the herb, or start the Forest of Terror trip
   * with Master Roshi (Act 2's porch NPC). The episode stays open as side content; Krillin's lines follow where he
   * is in his own story (Chapter 12 cop, Mighty Ten recruit, tournament veteran).
   */
  c12_krillin_kame: async (s) => {
    const phase = krillinPhase(s);
    if (s.check('done:c12_krillin')) {
      await s.say('krillin', phase === 'ch12'
        ? 'Back to the dawn training! ...Is it supposed to hurt this much? Master made tea out of that herb. He says he feels thirty years younger.'
        : 'Dawn training, every single day. 18 says if I\'m eliminated first, she keeps my share of the prize money.', 'happy');
      await s.call('c12_forest_boat');
      return;
    }
    if (s.has('c12_herb')) { await s.call('c12_herb_handin'); return; }
    if (!s.check('chapter>=12')) { await s.say('krillin', 'Patrol\'s quiet today. I like quiet.', 'happy'); return; }
    // Master Roshi steps out onto the porch if no other chapter has him standing there already.
    const tempRoshi = !npcWithSprite(s, 'roshi');
    if (tempRoshi) stage(s, 'c12_roshiS', 'roshi', HUB.kame.roshi[0], HUB.kame.roshi[1], 'down', 'Master Roshi');
    s.letterbox(true);
    const opener: Lines = phase === 'ch12' ? [
      ['krillin', 'Hey, {hero}... I chased a purse snatcher today and he outran me. ME. A guy who fought Frieza.', 'sad'],
      ['roshi', 'Then you need training! South of here is an island with the Paradise Herb. A single leaf restores youth!', 'happy'],
    ] : phase === 'team' ? [
      ['krillin', '{hero}... I signed up to fight for the whole universe. Gods, angels, erasing... I can\'t stop shaking.', 'sad'],
      ['roshi', 'Then face your fear head-on! South of here is an island with the Paradise Herb. A single leaf restores youth!', 'happy'],
    ] : [
      ['krillin', 'Eliminated first. In front of every god in existence. I keep dreaming about falling off that stage, {hero}.', 'sad'],
      ['roshi', 'Nightmares, eh? Then go and face them! South of here is an island with the Paradise Herb. A single leaf restores youth!', 'happy'],
    ];
    await s.talk([
      ...opener,
      ['roshi', 'Fetch it for me... ahem, I mean, for your own personal growth. Both of you!'],
      ['krillin', 'The Forest of Terror? People say it makes you see things...', 'shock'],
      ['hero', 'Sounds like great training! Let\'s go, Krillin!', 'happy'],
    ]);
    if (tempRoshi) removeAll(s, 'c12_roshiS');
    s.letterbox(false);
    await s.quest('c12_krillin', true);
    await s.narrate('Master Roshi\'s boat drops you on the Forest of Terror\'s beach.');
    await warpTo(s, 'c12_forest', 20, 30, 'up');
  },

  c12_krillin_forest: async (s) => {
    if (s.flag('c12_calm')) { await s.say('krillin', 'Let\'s get this herb back to Master Roshi.', 'happy'); return; }
    await s.talk([
      ['krillin', 'Did that tree just look at me? ...It looked at me, {hero}.', 'shock'],
      ['krillin', 'Those shadowy guys on the path - my punches go right through them. Don\'t fight them, just get past!'],
      ['krillin', 'The herb grows in the clearing up north. I\'ll be right behind you. Way, way behind you.', 'sad'],
    ]);
  },

  c12_forest_boss: async (s) => {
    if (s.flag('c12_herbGot')) return;
    const phase = krillinPhase(s);
    s.letterbox(true);
    s.music('tense');
    const [hx, hy] = heroTile(s);
    removeAll(s, 'c12_krillinF', 'c12_krillinF2');
    stage(s, 'c12_krillinB', phase === 'ch12' ? 'krillin' : 'krillinGi', hx - 1, hy + 1, 'up', 'Krillin');
    await s.pan(20, 3, 30);
    await s.talk([
      ['krillin', 'There it is! The Paradise Herb! See, that wasn\'t so...', 'happy'],
    ]);
    s.shake(30, 3);
    s.follow();
    stage(s, 'c12_nappaI', 'c12_nappa', hx, hy - 3, 'down', 'Nappa');
    s.flash('#40ff80', 10);
    await s.talk([
      ['c12_nappa', 'Heh heh heh. Remember me, baldy? Let\'s see if you pop like your friends did!', 'smirk'],
      ['krillin', 'N-Nappa?! But Vegeta... you\'re... HUGE!', 'shock'],
      ['hero', 'It\'s only an illusion! Stay behind me, Krillin!', 'shout'],
    ]);
    s.letterbox(false);
    s.remove('c12_nappaI');
    const [ax, ay] = freeNear(s, hx, hy - 3);
    s.music('boss');
    await bossFight(s, 'c12_illNappa', { x: ax, y: ay, uid: 'c12_illNappa1' });
    removeAll(s, 'c12_illNappa1');
    s.letterbox(true);
    stage(s, 'c12_friezaI', 'frieza', hx + 1, hy - 3, 'down', 'Frieza');
    s.flash('#f070f0', 10);
    await s.talk([
      ['frieza', 'Oh my. The little monkey who cut off my tail. I never did thank you properly.', 'smirk'],
      ['krillin', 'No no no no! Not him! Anyone but HIM!', 'shock'],
    ]);
    s.letterbox(false);
    s.remove('c12_friezaI');
    s.music('frieza');
    await bossFight(s, 'c12_illFrieza', { x: ax, y: ay, uid: 'c12_illFrieza1' });
    removeAll(s, 'c12_illFrieza1');
    s.letterbox(true);
    stage(s, 'c12_cellI', 'c12_cell', hx, hy - 3, 'down', 'Cell');
    s.flash('#70e0f0', 10);
    await s.talk([
      ['c12_cell', 'Krillin. You had the remote that could have stopped me. And you crushed it. Do you regret it?', 'smirk'],
      ['krillin', 'I... I...', 'sad'],
    ]);
    s.letterbox(false);
    s.remove('c12_cellI');
    s.music('boss');
    await bossFight(s, 'c12_illCell', { x: ax, y: ay, uid: 'c12_illCell1' });
    s.letterbox(true);
    await s.talk([
      ['hero', 'It\'s healing! The harder I fight, the bigger it gets!', 'shock'],
      ['krillin', 'Wait... the shrine. "The frightened see monsters. The calm see only trees." They\'re feeding on my fear... on our ki!', 'shock'],
      ['krillin', '{hero}! Lower your power! Calm your mind!', 'shout'],
    ]);
    s.pose('c12_krillinB', 'charge');
    s.pose('hero', 'charge');
    for (let i = 0; i < 3; i++) {
      await s.wait(20);
      s.flash('#ffffff', 4);
    }
    removeAll(s, 'c12_illCell1', 'c12_ill1', 'c12_ill2', 'c12_ill3');
    s.set('c12_calm');
    s.pose('c12_krillinB', null);
    s.pose('hero', null);
    s.music('peaceful');
    await s.narrate('The giants dissolve like mist. Where Cell stood, there is only an old, crooked tree.');
    if (phase === 'ch12') {
      await s.talk([
        ['krillin', 'They were never real. I\'ve been scared of everything since I stopped fighting... and the fear was the only monster here.', 'sad'],
        ['krillin', 'You know what? I think I\'m going back to my roots.', 'smirk'],
      ]);
      s.flash('#ffffff', 10);
      s.sprite('c12_krillinB', 'krillinGi');
      await s.talk([
        ['krillinGi', 'Fresh shave, old gi. Krillin is BACK!', 'happy'],
        ['hero', 'Ha! Now that\'s the Krillin I know!', 'happy'],
      ]);
    } else {
      await s.talk([
        ['krillin', phase === 'team'
          ? 'They were never real. I signed up to fight for the universe and I\'ve been terrified ever since... the fear was the only monster here.'
          : 'They were never real. Ever since I got knocked off that stage, I\'ve been scared of my own shadow... the fear was the only monster here.', 'sad'],
        ['krillinGi', 'Okay. No more running. Krillin is BACK!', 'happy'],
        ['hero', 'Ha! Now that\'s the Krillin I know!', 'happy'],
      ]);
    }
    s.set('c12_herbGot');
    await s.give('c12_herb');
    await s.narrate('Take the Paradise Herb back to Master Roshi at Kame House. The boat is waiting at the pier.');
    removeAll(s, 'c12_krillinB');
    s.letterbox(false);
  },

  /**
   * After the episode the Forest of Terror stays a place you can sail back to (its shade wolves are good training,
   * and the Goku L42 gate guards a capsule cache that a Chapter 12 Goku usually cannot open yet).
   */
  c12_forest_boat: async (s) => {
    const c = await s.ask('krillin', 'Want to borrow Master Roshi\'s boat? The Forest of Terror is just a short trip south.', ['Sail to the forest', 'Not now']);
    if (c !== 0) return;
    await s.narrate('Master Roshi\'s boat drops you on the Forest of Terror\'s beach.');
    await warpTo(s, 'c12_forest', 20, 30, 'up');
  },

  /** Boat back to Kame House (Master Roshi meets you on the beach: `c12_herb_home`). */
  c12_forest_leave: async (s) => {
    await s.narrate('You board Master Roshi\'s boat back to Kame House.');
    await warpTo(s, HUB.kame.map, HUB.kame.dock[0], HUB.kame.dock[1], 'up');
  },

  /** Kame Island onEnter: home with the Paradise Herb, Master Roshi comes to collect it. */
  c12_herb_home: async (s) => {
    if (s.has('c12_herb') && !s.check('done:c12_krillin')) await s.call('c12_herb_handin');
  },

  /** Master Roshi takes the Paradise Herb: "Krillin's comeback" is complete. */
  c12_herb_handin: async (s) => {
    if (!s.has('c12_herb') || s.check('done:c12_krillin')) return;
    const phase = krillinPhase(s);
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    let roshi = npcWithSprite(s, 'roshi');
    const tempRoshi = !roshi;
    if (!roshi) {
      stage(s, 'c12_roshiS', 'roshi', hx + 2, hy - 1, 'left', 'Master Roshi');
      roshi = 'c12_roshiS';
    }
    s.face(roshi, 'hero');
    await s.emote(roshi, '!');
    const home = krillinAtHome(s);
    const tempKrillin = home && !npcWithSprite(s, 'krillinGi');
    if (tempKrillin) stage(s, 'c12_krillinH', 'krillinGi', hx - 1, hy, 'right', 'Krillin');
    const thanks = phase === 'ch12' ? 'Heh. You know what? Thanks, Master. I forgot what it felt like to really fight.'
      : phase === 'team' ? 'Heh. Thanks, Master. Now I\'m actually ready for that tournament.'
        : 'Heh. Thanks, Master. Next tournament, I am NOT getting eliminated first.';
    await s.talk(home ? [
      ['roshi', 'Is that... the Paradise Herb? Hand it over, hand it over! At last, eternal youth!', 'happy'],
      ['krillin', 'Master, you know that herb doesn\'t really do anything, right?', 'smirk'],
      ['roshi', '...Hmph. Of course I know! The real treasure was the courage you found, Krillin! Totally planned!', 'shock'],
      ['krillin', thanks, 'happy'],
    ] : [
      ['roshi', 'Is that... the Paradise Herb? Hand it over, hand it over! At last, eternal youth!', 'happy'],
      ['roshi', 'Krillin phoned from his patrol. He says that forest "fixed his head". The real treasure was the courage he found! Totally planned!', 'smirk'],
    ]);
    s.take('c12_herb');
    if (tempRoshi) removeAll(s, 'c12_roshiS');
    if (tempKrillin) removeAll(s, 'c12_krillinH');
    s.letterbox(false);
    await s.done('c12_krillin', false);
    await s.give('end3');
    await progress(s);
  },
  // ================================================================ Capsule Corp: Beerus & Whis (all of act 5)
  /**
   * Beerus lounging at the Capsule Corp garden table. Whis (Act 2's overlay NPC, who also runs the
   * 25-delicacies quest) sits across from him; a stand-in Whis is staged only if he is not on the map.
   */
  act5_beerus_talk: async (s) => {
    const [hx, hy] = heroTile(s);
    let tempWhis = false;
    const callWhis = (): void => {
      if (npcWithSprite(s, 'whis')) return;
      stage(s, 'act5_whisT', 'whis', hx + 1, hy - 1, 'down', 'Whis');
      tempWhis = true;
    };
    const dismissWhis = (): void => { if (tempWhis) removeAll(s, 'act5_whisT'); };
    // Post-game: the true ending comes first.
    if (s.flag('post_game') && !s.check('done:post_trueEnd')) { callWhis(); await s.call('post_beerus_talk'); dismissWhis(); return; }
    // Chapter 13 opening interrupted before the Expo was over (Whis's Charm mid-fight): back to the Expo.
    if (s.check('chapter==13') && !s.flag('c13_expoSeen') && s.hasScript('c13_expo')) {
      await s.say('beerus', 'What are you doing here?! Zeno is waiting at the Expo. Whis, take us back. NOW.', 'angry');
      await s.call('c13_expo');
      return;
    }
    // Chapter 13: the tenth warrior.
    if (s.check('quest:c13_frieza')) { callWhis(); await s.call('c13_whis_frieza'); dismissWhis(); return; }
    // Chapter 14: departure for the World of Void.
    if (s.check('chapter==14') && !s.flag('c14_departed')) { callWhis(); await s.call('c14_depart'); dismissWhis(); return; }
    // Post-game reactions (Hit's hint below stays available for players who skipped that episode).
    if (s.flag('post_game') && !(s.check('quest:c12_hit') && !s.flag('c12_hitHinted'))) { callWhis(); await s.call('post_beerus_talk'); dismissWhis(); return; }
    // Chapter 12 (or later): the assassin hint. The contract is on Goku; anyone else hears about it second-hand.
    if (s.check('quest:c12_hit') && !s.flag('c12_hitHinted')) {
      callWhis();
      await s.talk(s.hero === 'goku' ? [
        ['beerus', 'Goku. You look terribly healthy. Somebody should fix that.', 'smirk'],
        ['whis', 'Ohoho! Word is a very famous assassin has accepted a contract on your life, Goku.', 'happy'],
        ['hero', 'An assassin? Who\'d want me dead? ...Besides the usual people.'],
        ['whis', 'Oh, who can say? I hear he does his best work at night. Satan City\'s rooftops are very fashionable among assassins this season.', 'smirk'],
        ['beerus', 'Try not to die before dinner. Bulma promised crab.', 'neutral'],
      ] : [
        ['beerus', 'Where is Goku? Tell him he looks terribly healthy. Somebody should fix that.', 'smirk'],
        ['whis', 'Ohoho! Word is a very famous assassin has accepted a contract on Goku\'s life.', 'happy'],
        ['hero', 'An assassin? After Goku? ...He\'s going to be thrilled.'],
        ['whis', 'Oh, who can say who hired him? I hear he does his best work at night. Satan City\'s rooftops are very fashionable among assassins this season.', 'smirk'],
        ['beerus', 'Make sure Goku doesn\'t die before dinner. Bulma promised crab.', 'neutral'],
      ]);
      s.set('c12_hitHinted');
      await s.narrate('Hit\'s contract: go to Hotel Satan in Satan City tonight and ask the night porter to take you up to the roof.');
      dismissWhis();
      return;
    }
    const goku = s.hero === 'goku';
    if (s.check('chapter>=13') && !s.check('done:c13_team')) {
      await s.say('beerus', goku
        ? 'Recruit faster, Goku. If Universe 7 loses, I get erased along with it. And I am NOT being erased because of you.'
        : 'Recruit faster. If Universe 7 loses, I get erased along with it. And I am NOT being erased because of Goku.', 'angry');
      return;
    }
    if (s.check('done:c13_team')) {
      await s.say('beerus', goku
        ? 'Frieza on our team... If this goes wrong, I am destroying you both. In that order.'
        : 'Frieza on our team... If this goes wrong, I am destroying Goku and Frieza. In that order.', 'angry');
      return;
    }
    const lines = [
      'Hmph. Earth food is the only reason this planet still exists. Remember that.',
      'Whis says I should "relax more". I am relaxing. Can\'t you tell?',
      'Bulma\'s baby is due any day now. Vegeta has threatened me twice already. Adorable.',
      'Whis keeps asking about rare Earth delicacies. Bring him some, or he will never stop talking about them.',
    ];
    await s.say('beerus', lines[s.inc('act5_beerusTalks') % lines.length], 'smirk');
  },
});
