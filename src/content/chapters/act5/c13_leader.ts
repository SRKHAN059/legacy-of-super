import { registerScripts } from '../../../game/script';
import { force, unforce } from '../common';
import { bossFight, freeNear, heroTile, refresh, rememberHero, removeAll, restoreHero, stage, warpTo } from './helpers';

/**
 * Chapter 13, "Goku vs. Gohan: the wall to overcome" (anime ep 90). Once Tien has joined and Gohan has his power
 * back, Gohan asks to test it: a two-on-two ring match on the Wilderness Plateau (Goku and Tien against Gohan and
 * Piccolo) that ends when Piccolo's full-body blast levels the ring, then one more round, father against son, with
 * a Senzu Bean each. Goku picks Gohan to lead the team (he tells everyone at the Chapter 14 gathering).
 * Silver: it plays the moment both recruits are in.
 */

/** Centre of the plateau's dirt ring (maps_c13 `wild`). */
const RING: [number, number] = [18, 12];

/** Cutscene actors of the episode (cleared on entry, so a replay never stacks a second Gohan on screen). */
const ACTORS = ['c13_gohanR', 'c13_piccoloR', 'c13_tienR', 'c13_gohanR2'];

registerScripts({
  /** Called from `c13_check` as soon as Tien has joined and Gohan's training is done (any order). */
  c13_leader_start: async (s) => {
    if (s.check('done:c13_leader')) return;
    rememberHero(s, 'leader');
    await s.fadeOut(16);
    force(s, 'goku');
    await s.quest('c13_leader', true);
    if (s.field.def.id !== 'c13_training_wilds') {
      await s.narrate('That afternoon, Gohan and Piccolo find Goku and Tien at a roadside diner. Gohan has a request.');
      await warpTo(s, 'c13_training_wilds', RING[0] - 3, RING[1] + 3, 'up');
    } else {
      removeAll(s, ...ACTORS);
      const [px, py] = freeNear(s, RING[0] - 3, RING[1] + 3);
      s.place('hero', px, py, 'up');
      await s.narrate('Goku and Tien felt Gohan\'s power from miles away. They arrive before the dust has settled.');
      await s.fadeIn(16);
    }
    removeAll(s, ...ACTORS);
    s.letterbox(true);
    s.music('heroic');
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_tienR', 'tien', hx - 2, hy, 'up', 'Tien');
    stage(s, 'c13_gohanR', 'gohanUltimate', RING[0] - 1, RING[1] - 3, 'down', 'Gohan');
    stage(s, 'c13_piccoloR', 'piccoloUnweighted', RING[0] + 2, RING[1] - 4, 'down', 'Piccolo');
    await s.talk([
      ['gohanUltimate', 'Dad, Tien. I want to test my power against the strongest people I know. Two on two: you two against me and Mr. Piccolo.', 'neutral'],
      ['piccoloUnweighted', 'Out of the ring means out. It\'s a battle royale up there, so we fight as a team.', 'smirk'],
      ['tien', 'It\'s only practice, Goku. Try not to hurt anyone.', 'neutral'],
      ['goku', 'Heh. Looking at Gohan, I think WE\'RE the ones who should be careful!', 'happy'],
    ]);
    await s.call('c13_leader_round1');
  },

  /** Round one: Piccolo charges, Gohan covers him. Tien's Tri-Beam is blocked; Goku has to break through. */
  c13_leader_round1: async (s) => {
    s.pose('c13_piccoloR', 'charge');
    s.aura('c13_piccoloR', '#f8f8a0');
    await s.say('tien', 'Piccolo\'s charging something big! I\'ll stop him. Tri-Beam!', 'shout');
    if (s.exists('c13_tienR') && s.exists('c13_piccoloR')) {
      const [gx, gy] = freeNear(s, RING[0] + 1, RING[1] - 2);
      s.sfx('dash');
      await s.walk('c13_gohanR', gx, gy, 6);
      await s.blast('c13_tienR', 'c13_gohanR', '#f8f070');
      s.pose('c13_gohanR', 'guard');
      await s.wait(10);
      s.pose('c13_gohanR', null);
      await s.blast('c13_gohanR', 'c13_tienR', '#f0f0ff');
      s.pose('c13_tienR', 'ko');
    }
    await s.talk([
      ['gohanUltimate', 'Sorry, Tien. Nobody touches Mr. Piccolo until he\'s ready.', 'smirk'],
      ['goku', 'Teamwork, huh? Then I\'ll just have to go through you, Gohan!', 'shout'],
    ]);
    s.letterbox(false);
    s.music('battle');
    const [bx, by] = s.exists('c13_gohanR') ? [Math.floor(s.actor('c13_gohanR').x / 16), Math.floor((s.actor('c13_gohanR').y - 14) / 16)] : [RING[0], RING[1] - 2];
    removeAll(s, 'c13_gohanR');
    s.banner('Piccolo is charging! Break through Gohan\'s guard before he fires!');
    const r = await bossFight(s, 'c13_gohanTag', { x: bx, y: by, uid: 'c13_gohanR', survive: 30, loseOk: true, label: 'CHARGE' });
    s.letterbox(true);
    if (r === 'end') await s.say('goku', 'Got you! Now, Piccolo...!', 'shout');
    // Piccolo's full-body wave levels the ring either way (ep 90).
    if (s.exists('c13_piccoloR')) s.pose('c13_piccoloR', 'raise');
    await s.say('piccoloUnweighted', 'Too late! Take THIS!', 'shout');
    s.flash('#ffffff', 16);
    for (let i = 0; i < 6; i++) {
      s.boom(RING[0] - 6 + i * 2 + (i % 2), RING[1] - 2 + (i % 3) * 2, 20, '#f8f8a0');
      await s.wait(5);
    }
    s.shake(40, 3);
    if (s.exists('c13_piccoloR')) {
      s.pose('c13_piccoloR', null);
      s.aura('c13_piccoloR', null);
    }
    s.pose('hero', 'hurt');
    await s.wait(20);
    s.pose('hero', null);
    if (s.exists('c13_tienR')) s.pose('c13_tienR', null);
    await s.talk([
      ['goku', 'Whew! That one actually stung. You two make a scary team.', 'happy'],
      ['tien', 'And the ring is gone. The whole mountaintop. That\'s the match.', 'neutral'],
      ['gohanUltimate', 'Dad... one more. Just you and me. Please, I need to know where I stand.', 'neutral'],
      ['goku', 'Heh. I was hoping you\'d say that.', 'smirk'],
      ['piccoloUnweighted', 'Then eat these first. If you two are going to do this, do it properly.', 'smirk'],
    ]);
    s.sfx('heal');
    refresh(s, 'goku');
    await s.narrate('Piccolo tosses each of them a Senzu Bean.');
    await s.call('c13_leader_round2');
  },

  /** Round two: father against son, no holding back. Goku ends it with Blue Kaio-ken and catches Gohan as he falls. */
  c13_leader_round2: async (s) => {
    const [hx, hy] = heroTile(s);
    removeAll(s, 'c13_gohanR');
    const [gx, gy] = freeNear(s, hx + 3, hy - 2);
    stage(s, 'c13_gohanR2', 'gohanUltimate', gx, gy, 'left', 'Gohan');
    s.face('hero', 'c13_gohanR2');
    await s.talk([
      ['goku', 'You\'re not going Super Saiyan?', 'neutral'],
      ['gohanUltimate', 'This IS my full power. I\'m going for an ultimate form of my own. Not the way you did it, Dad. My way.', 'smirk'],
      ['goku', 'All this time I was looking for strong fighters in other universes... and I had you right here. Let\'s go!', 'happy'],
    ]);
    s.letterbox(false);
    s.music('battle');
    removeAll(s, 'c13_gohanR2');
    const r = await bossFight(s, 'c13_gohanUltimate', { x: gx, y: gy, uid: 'c13_gohanR2', loseOk: true });
    s.letterbox(true);
    const [ex, ey] = s.exists('c13_gohanR2') ? [Math.floor(s.actor('c13_gohanR2').x / 16), Math.floor((s.actor('c13_gohanR2').y - 14) / 16)] : [gx, gy];
    removeAll(s, 'c13_gohanR2');
    stage(s, 'c13_gohanR2', 'gohanUltimate', ex, ey, 'left', 'Gohan');
    if (r === 'lose') {
      s.pose('hero', null);
      await s.talk([
        ['gohanUltimate', 'Dad! Are you okay?! I... I actually...', 'shock'],
        ['goku', 'Heh heh... Not bad, Gohan. But you asked for everything I\'ve got. So here it is!', 'smirk'],
      ]);
    } else {
      await s.talk([
        ['gohanUltimate', 'Still holding back, Dad. I can tell. Please... show me everything.', 'shout'],
        ['goku', 'Alright. You asked for it!', 'smirk'],
      ]);
    }
    s.transformNow('ssbkk');
    await s.powerUp('hero', '#f83838', 40);
    await s.say('gohanUltimate', 'Kamehameha!', 'shout');
    await s.clash('hero', 'c13_gohanR2', 70);
    s.flash('#ffffff', 14);
    s.boom(ex, ey, 24, '#80c0f8');
    s.shake(30, 3);
    s.transformNow(null);
    s.pose('c13_gohanR2', 'ko');
    const [cx, cy] = freeNear(s, ex - 1, ey);
    await s.walk('hero', cx, cy, 2);
    s.face('hero', 'c13_gohanR2');
    await s.talk([
      ['goku', 'Gotcha. You did great, Gohan. From here on, we go forward together.', 'happy'],
    ]);
    await s.fadeOut(20);
    s.pose('c13_gohanR2', null);
    await s.fadeIn(20);
    await s.talk([
      ['gohanUltimate', 'Thanks, Dad. And sorry about the mountain, Tien.', 'happy'],
      ['tien', 'I\'ve seen worse. Usually from you two.', 'smirk'],
      ['goku', 'I\'ve decided something. When the whole team gets together, I\'m telling everybody: Gohan is the leader of Team Universe 7!', 'happy'],
      ['gohanUltimate', 'Me? ...Let me think about it, Dad. If I say yes, we fight as a team. Nobody goes it alone.', 'neutral'],
      ['piccoloUnweighted', '(The student surpasses his father\'s plans again. Good.)', 'smirk'],
    ]);
    removeAll(s, ...ACTORS);
    s.music('wasteland');
    s.letterbox(false);
    await s.done('c13_leader', false);
    await s.give('end3');
    unforce(s);
    restoreHero(s, 'leader');
  },

  c13_gohan_p2: async (s) => {
    await s.say('gohanUltimate', 'I can see your moves, Dad. Every one of them!', 'shout');
  },
});
