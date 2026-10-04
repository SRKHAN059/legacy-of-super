import { registerScripts, type ScriptApi } from '../../../game/script';
import { unforce } from '../common';
import { bossFight, freeNear, heroTile, removeAll, stage, warpTo } from './helpers';
import { HUB } from './hubs';

/**
 * Epilogue & post-game (LoG2 §16): free roam, the "true ending" with Whis and Beerus, the five trophies →
 * Mr. Satan unlock, his ZTV alternate ending, and the optional superbosses (Jiren's rematch after the seven
 * animals, Hit's no-rules contract). Whis's 25 Earth Delicacies reward stays with Act 2's Whis (c04_delicacies).
 */

const TROPHIES = ['trophyGoku', 'trophyVegeta', 'trophyGohan', 'trophyTrunks', 'trophyPiccolo'] as const;

/**
 * LoG2's Mr. Satan rule: he joins at L40 if Goku was L45+ when Cell was beaten (5 levels past that chapter's
 * gate), otherwise at L1. Here the final battle is Jiren's, Chapter 14 starts every fighter at L45 and its curve
 * ends at L48, so the equivalent "beyond the curve" mark is Goku at L50 when Universe 7 won (`c14_gokuLv`).
 */
export const SATAN_RULE_GOKU_LEVEL = 50;

/** How many of the five L50-gate trophies the party holds. */
export function trophyCount(s: ScriptApi): number {
  return TROPHIES.filter((t) => s.has(t)).length;
}

registerScripts({
  // ================================================================ post-game start (after the credits)
  post_start: async (s) => {
    s.set('post_game');
    s.setChapter(15);
    s.clear('fc_topQuiet');
    s.set('world', 'earth');
    unforce(s);
    s.switchTo('goku');
    s.heal();
    await warpTo(s, HUB.cc.map, HUB.cc.arrive[0], HUB.cc.arrive[1], 'up');
    await s.narrate('Universe 7 lives on. The adventure continues: explore freely, take on the level 50 gates and finish what you started.');
    await s.quest('post_trueEnd', true);
    await s.quest('post_trophies', true);
    if (s.check('done:c12_hit')) await s.quest('post_hit', true);
    await s.narrate('Journal updated! Lord Beerus and Whis are lounging at the Capsule Corp garden table.');
    // Trophies won before the credits count too.
    await s.call('post_trophy_check');
  },

  /** Beerus (and Whis) at Capsule Corp after the tournament: true ending, delicacies, Mr. Satan. */
  post_beerus_talk: async (s) => {
    if (s.check('char:satan')) {
      await s.talk([
        ['beerus', '...You. The "champion". You know I could erase this whole planet with a sneeze?', 'angry'],
        ['mrSatan', 'Ha... HAHAHA! Of course, Lord Beerus! May I offer you this commemorative Satan Pudding? Limited edition!', 'shock'],
        ['beerus', '...Hm. Leave the pudding. You may live.', 'smirk'],
      ]);
      return;
    }
    if (!s.check('done:post_trueEnd')) {
      s.letterbox(true);
      s.music('ending');
      await s.talk([
        ['beerus', 'So. Universe 7 survived. Barely. Because an ANDROID was the only one still standing.', 'angry'],
        ['whis', 'Ohoho. Would you like to see how everyone is doing, my lord? My staff shows quite a lot.', 'happy'],
      ]);
      s.flash('#4890e0', 12);
      await s.narrate('In Universe 11, Jiren trains beside Toppo and Belmod. For the first time, he is not training alone.');
      await s.narrate('Far across space, Frieza\'s new army salutes its old emperor. He is smiling, which is never good news.');
      await s.narrate('In another future, Trunks and Mai walk through a city with its lights back on. A child chases pigeons in the square.');
      await s.narrate('And on Earth, a Saiyan who once just wanted a good fight has learned what it means to fight for everyone.');
      s.flash('#4890e0', 12);
      await s.talk([
        ['beerus', 'Goku. Next time you feel like asking Zeno for a tournament... I will destroy you FIRST.', 'angry'],
        ['hero', 'Heh heh... sure thing, Lord Beerus. ...But it WAS fun, right?', 'happy'],
        ['whis', 'Ohohoho! Shall we have dessert, then?', 'happy'],
      ]);
      await s.narrate('THE END. ...But the adventure never really ends. Free roam continues.');
      s.letterbox(false);
      s.music('town');
      await s.done('post_trueEnd', false);
      await s.give('end3');
      return;
    }
    const n = trophyCount(s);
    const lines = [
      n >= 5 ? 'All five trophies. And now that loud "champion" follows you around. Was it worth it?' : `Trophies? You have ${n} of 5. Someone in Satan City keeps calling here asking about them. Loudly.`,
      'Whis, is this cake from the new bakery? ...It\'s acceptable. Barely.',
      'Champa keeps sending me videos of his universe. Ugh. I liked it better when it was erased.',
      s.check('done:post_jiren') ? 'You beat Jiren without a ring to save you? ...Fine. I am mildly impressed. Tell no one.' : 'Jiren is sulking at Zeno\'s palace, I hear. Go and lose to him, it builds character.',
    ];
    await s.say('beerus', lines[s.inc('post_beerusTalks') % lines.length], 'smirk');
  },

  // ================================================================ trophies → Mr. Satan
  /** onEnter on hubs: all five trophies → Mr. Satan bursts in and joins. */
  post_trophy_check: async (s) => {
    if (!s.check('quest:post_trophies') || s.state.char('satan').joined || trophyCount(s) < 5) return;
    await s.call('post_satan_unlock');
  },

  post_satan_unlock: async (s) => {
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    stage(s, 'post_satanJ', 'mrSatan', hx + 3, hy, 'left', 'Mr. Satan');
    s.flash('#ffffff', 6);
    await s.walk('post_satanJ', hx + 1, hy, 2);
    await s.talk([
      ['mrSatan', 'HAHAHA! So YOU\'RE the one collecting all the trophies! The whole city is talking about it!', 'happy'],
      ['mrSatan', 'Five trophies... impressive. Almost as impressive as my forty-seven championship belts!', 'smirk'],
      ['hero', 'Uh... thanks, Mr. Satan?', 'neutral'],
      ['mrSatan', 'I have decided! As the World Champion and savior of Earth, I will personally join your training! For the children! And the cameras!', 'shout'],
    ]);
    await s.join('satan', s.num('c14_gokuLv') >= SATAN_RULE_GOKU_LEVEL ? 40 : 1);
    await s.narrate('Mr. Satan can be switched in at any save point. His Victory Pose freezes every foe on screen - and only he can break the red gates.');
    removeAll(s, 'post_satanJ');
    await s.done('post_trophies', false);
    await s.give('post_belt');
    await s.quest('post_ztv');
    s.letterbox(false);
  },

  // ================================================================ ZTV alternate ending
  post_ztv_ending: async (s) => {
    if (!s.check('char:satan')) {
      await s.narrate('The ZTV studio\'s VIP entrance. A sign reads: "Reserved for the World Champion."');
      return;
    }
    await s.narrate('The red gate is rubble. Mr. Satan straightens his gi and marches into ZTV\'s studio, cameras already rolling.');
    await warpTo(s, 'post_ztv_studio', 10, 9, 'up');
    s.letterbox(true);
    s.music('heroic');
    s.place('hero', 11, 4, 'down');
    const reporters: Array<[string, string, number, number]> = [
      ['post_rep1', 'reporter', 6, 8], ['post_rep2', 'townsman', 9, 9], ['post_rep3', 'reporter', 13, 8], ['post_rep4', 'scientist', 15, 9], ['post_rep5', 'townswoman', 5, 10],
    ];
    for (const [id, sp, x, y] of reporters) stage(s, id, sp, x, y, 'up');
    for (let i = 0; i < 4; i++) { s.flash('#ffffff', 4); s.sfx('blastHit'); await s.wait(8); }
    await s.talk([
      ['reporter', 'Mr. Satan! Is it true? Did you really save every universe in existence?', 'shock'],
      ['mrSatan', 'HAHAHA! Of course! It was nothing for the World Champion!', 'happy'],
      ['mrSatan', 'There was this purple cat god. Big ears. Very scary! I said, "Lord Destruction, sir, step aside!"', 'smirk'],
      ['mrSatan', 'Then I fought a fella named Jiren. Bald. Grumpy. I knocked him right off the stage with my Dynamite Kick!', 'shout'],
      ['reporter', 'And the Tournament of Power?!', 'happy'],
      ['mrSatan', 'Won it! Single-handed! With a little help from my pupils, of course. Very little.', 'smirk'],
    ]);
    s.pose('hero', 'raise');
    for (let i = 0; i < 6; i++) { s.flash('#ffffff', 3); await s.wait(5); }
    s.pose('hero', null);
    await s.narrate('Meanwhile, at Capsule Corp, a certain God of Destruction is watching the broadcast.');
    await s.talk([
      ['beerus', 'Whis. Should I destroy him?', 'angry'],
      ['whis', 'Oh, I don\'t think so, my lord. He\'s far too entertaining.', 'happy'],
      ['beerus', '...He did bring pudding last time.', 'smirk'],
    ]);
    await s.narrate('And so the World Champion\'s legend grew one universe larger. THE END?');
    removeAll(s, ...reporters.map((r) => r[0]));
    s.set('post_ztvSeen');
    await s.done('post_ztv', false);
    s.letterbox(false);
    await s.credits([
      '#The Legend of Mr. Satan',
      'Mr. Satan: World Champion, Savior of Earth, Savior of All Universes (self-declared)',
      '',
      '#Also appearing (briefly)',
      'Son Goku', 'Vegeta', 'Everyone else who actually fought',
      '',
      '#ZTV News',
      'Ace Reporter', 'Camera Crew', 'Studio Audience', 'A Very Patient Beerus',
    ]);
    await warpTo(s, HUB.plaza.map, 8, 12, 'down');
  },

  // ================================================================ optional superbosses
  post_jiren_talk: async (s) => {
    s.letterbox(true);
    await s.talk([
      ['jiren', 'You came. I wanted to fight Universe 7 once more without a tournament hanging over us.', 'neutral'],
      ['jiren', 'No ring. No clock. No instinct moving your body for you. Only strength... and whatever you trust.', 'neutral'],
    ]);
    const c = await s.ask('jiren', 'Are you ready?', ['Fight Jiren', 'Not yet']);
    if (c !== 0) { await s.say('jiren', 'I will wait. Train.', 'neutral'); s.letterbox(false); return; }
    s.letterbox(false);
    s.music('jiren');
    const [hx, hy] = heroTile(s);
    const [jx, jy] = freeNear(s, hx + 3, hy - 1);
    removeAll(s, 'post_jirenN');
    const r = await bossFight(s, 'post_jiren', { x: jx, y: jy, uid: 'post_jiren1' });
    if (r !== 'win') return;
    s.letterbox(true);
    stage(s, 'post_jirenE', 'jiren', jx, jy, 'left', 'Jiren');
    await s.talk([
      ['jiren', '...Strength alone was not enough. Again. Perhaps that is the lesson.', 'neutral'],
      ['jiren', 'Take these. Toppo insists they are a "proper Pride Trooper gift".', 'neutral'],
    ]);
    removeAll(s, 'post_jirenE');
    s.letterbox(false);
    await s.done('post_jiren', false);
    await s.give('pow5');
    await s.give('str5');
    await s.give('end5');
  },
  post_jiren_p2: async (s) => {
    await s.say('jiren', 'Good. Now I will stop holding back.', 'angry');
  },
  post_jiren_p3: async (s) => {
    await s.say('jiren', 'This is my full power. Show me yours!', 'shout');
  },

  post_hit_talk: async (s) => {
    s.letterbox(true);
    await s.talk([
      ['hit', 'The contract remains open. Tonight there is no tournament, no rules and no referee.', 'neutral'],
      ['hero', 'You came all this way just to fight me?'],
      ['hit', 'I came to finish a job. Don\'t blink.', 'smirk'],
    ]);
    const c = await s.ask('hit', 'Begin?', ['Fight Hit', 'Not tonight']);
    if (c !== 0) { await s.say('hit', 'Then watch your back.', 'neutral'); s.letterbox(false); return; }
    s.letterbox(false);
    s.music('battle');
    const [hx, hy] = heroTile(s);
    const [bx, by] = freeNear(s, hx + 3, hy);
    removeAll(s, 'post_hitN');
    const r = await bossFight(s, 'post_hit', { x: bx, y: by, uid: 'post_hit1' });
    if (r !== 'win') return;
    s.letterbox(true);
    await s.talk([
      ['hit', '...Contract terminated. By the target. That has never happened before.', 'neutral'],
      ['hit', 'Keep this. Consider it my professional fee... refunded.', 'smirk'],
    ]);
    s.letterbox(false);
    await s.done('post_hit', false);
    await s.give('str5');
    await s.give('end3');
  },
  post_hit_p2: async (s) => {
    await s.say('hit', 'Time Cage.', 'neutral');
  },

  // ================================================================ hub reactions (post-game, Mr. Satan)
  post_fan_talk: async (s) => {
    if (s.check('char:satan')) {
      const lines = [
        'IT\'S HIM! IT\'S REALLY MR. SATAN! Can you sign my forehead?!',
        'Mr. Satan! My grandma says you saved the universe! All of them! Is that true?!',
        'I\'m gonna be just like you when I grow up! Do the pose! DO THE POSE!',
      ];
      await s.say(s.npc?.def.id ?? 'kidNpc', lines[s.inc('post_fanTalks') % lines.length], 'happy');
      return;
    }
    const lines = [
      'Did you hear? The universe almost got erased and Mr. Satan stopped it! ...Probably!',
      'The news says there were glowing lights in the sky the other day. Mr. Satan was "in training".',
      'Have you seen Mr. Satan? He hasn\'t been on TV in a whole week! Is he okay?!',
    ];
    await s.say(s.npc?.def.id ?? 'townsman', lines[s.inc('post_fanTalks') % lines.length]);
  },

  post_krillin_talk: async (s) => {
    if (s.check('char:satan')) {
      await s.talk([
        ['krillin', 'Mr. Satan? Here? ...You know you didn\'t actually fight in the tournament, right?', 'smirk'],
        ['mrSatan', 'Shhh! Not so loud! The fans have very good ears!', 'shock'],
      ]);
      return;
    }
    // "Krillin's comeback" never played: it is still open, re-voiced for a tournament veteran.
    if (!s.check('done:c12_krillin')) { await s.call('c12_krillin_kame'); return; }
    await s.say('krillin', 'Eliminated first. Again. But hey - I got to be there! And 18 bought a new car with the prize money.', 'happy');
  },
});
