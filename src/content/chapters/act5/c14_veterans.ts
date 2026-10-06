import { audio } from '../../../engine/audio';
import { norm, overlaps } from '../../../engine/math';
import type { Enemy } from '../../../game/enemy';
import type { Field } from '../../../game/field';
import { killExp } from '../../../game/leveling';
import { Shot } from '../../../game/projectiles';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { ENEMIES } from '../../enemies';
import { registerQuests } from '../../quests';
import { everyFrame, type FrameLoop } from './c14_assist';
import { pastEdge, ringCentre, tileOf } from './c14_edge';
import { SNIPER_NEST } from './c14_enemies';
import { guestHandOff, guestPower, ROSHI, takeOffGuest, TIEN } from './c14_guests';
import { eliminated, FIGHT_MARGIN, onStage, ringOut, stageOn, standIn } from './c14_kit';
import { battle, bossFight, heroTile, removeAll } from './helpers';

/**
 * Chapter 14, the veterans' hour of the west-ring relay (dbs_story.md §7.1 D, eps 105-107), run inline by stage A
 * (`c14.ts`) between Goku and Hit's team-up and Frieza's meeting with Frost:
 *   - `c14_roshi` (ep 105): Master Roshi, out of breath, is cornered by Universe 4. Caway and Dercori attack together;
 *     worn down, Caway sees him flex and jumps off the stage herself, and he seals Dercori in a jar with the Evil
 *     Containment Wave (Zeno finds it neat, so it is allowed). He goes Max Power against Ganos (a bird of prey from
 *     his second phase), ends it with a Kamehameha fired from his own life force, and his heart stops until Goku's
 *     Super Saiyan Blue ki starts it again.
 *   - `c14_snipers` (ep 106): Tien against Universe 2's snipers. Harmira, the real sniper, fires from a hiding place
 *     across the ring and bounces his shots off Prum, whose body is a mirror (ki blasts come straight back off him);
 *     Tien has to trace the shots back to the nest. At Harmira's scripted end he shoots the stage out from under Tien,
 *     and Tien's Multi-Form copies drag him down too; then Vegeta blasts Prum out of the ring.
 *   - `c14_frostTrap` (ep 107): Frost dodges Roshi's first Evil Containment Wave and turns the second back on Vegeta,
 *     who is sealed in Roshi's jar. Roshi makes Frost drop it (Frost cannot be rung out: Frieza eliminates him in ep
 *     108) and smashes it open; Vegeta goes Super Saiyan Blue and throws Magetta out, Frost slips away, and Roshi
 *     retires on his own two feet.
 * Roshi and Tien are guests worn over Goku (`c14_guests.ts`); each beat sets its `c14_*Done` flag and journal entry.
 */

registerQuests([
  { id: 'c14_epRoshi', title: 'The old master\'s last stand', star: 'gold', region: 'spot_zeno', desc: 'Master Roshi is out of breath, and Universe 4 thinks he is easy prey. He still has a few tricks up his sleeve - and one Kamehameha left in him.' },
  { id: 'c14_epSnipers', title: 'Tien and the snipers', star: 'gold', region: 'spot_zeno', desc: 'Shots are coming from across the stage, bounced off Prum\'s mirror body. Watch for the glint of the real sniper\'s scope and follow his shots back to his nest.' },
  { id: 'c14_epFrostTrap', title: 'Frost\'s trap', star: 'gold', region: 'spot_zeno', desc: 'Frost turned Master Roshi\'s Evil Containment Wave back on Vegeta and sealed him in a jar. Make Frost let go of it before he throws it off the stage.' },
]);

/** Raised once Tien has found Harmira's nest (close up, or by landing a blow on him). */
export const SNIPER_FOUND = 'c14_sniperFound';

/** Harmira's sniping through Prum's mirror, in frames and pixels. */
export const SNIPE = {
  /** One shot every this many frames... */
  every: 150,
  /** ...each one telegraphed this long before by a glint at his scope. */
  aim: 36,
  speed: 4.2,
  mult: 0.42,
  /** Cloak strength while he lies hidden in his nest (too faint to cast a shadow). */
  cloak: 0.75,
  /** Within this distance the hero finds him. */
  near: 72,
  /** Frames the glint gives his position away. */
  seen: 50,
  /** A shot this close to Prum is bounced on toward the hero. */
  mirror: 12,
  /** Prum's mirror flash. */
  silver: '#e8ecf8',
} as const;

// ================================================================ dazed fighters

/**
 * Leave the regular fighters `uids` dazed when they reach their `boss.endAt` (`DAZED` in `c14_enemies.ts`): they stop
 * where they stand, hurt, can no longer be hit or rung out, and no longer hold up a field battle, so the scene after
 * the fight can finish them the way canon does. A fighter rung out before that is simply gone.
 */
function daze(s: ScriptApi, uids: readonly string[]): FrameLoop {
  return everyFrame(s, (f) => {
    for (const e of f.enemies) {
      if (!e.uid || !uids.includes(e.uid) || !e.ended || e.def.invulnerable) continue;
      e.def = { ...e.def, invulnerable: true };
      e.puppet = true;
      e.scriptPose = 'hurt';
      f.fx.number(e.x, e.y - 36, 'DAZED', '#f8e040');
      audio.sfx('hit');
    }
  });
}

/** True when the fighter was worn down to a daze (as opposed to still fighting when the fight ended). */
function isDazed(e: Enemy): boolean {
  return !!e.def.invulnerable && !ENEMIES[e.def.id]?.invulnerable;
}

/** A fighter still standing on the stage (dazed or fighting), by uid; null once knocked out or rung out. */
function standing(s: ScriptApi, uid: string): Enemy | null {
  return s.field.enemies.find((e) => e.uid === uid && !e.dead && e.state !== 'dying' && !e.hidden) ?? null;
}

/** Pay the regular EXP for a fighter the hero wore down and canon eliminates in a cutscene (as a knockout would). */
function payOut(s: ScriptApi, type: string): void {
  const f = s.field;
  f.awardExp(killExp(ENEMIES[type]?.exp ?? 0, f.player.cs.level), true);
}

// ================================================================ the snipers

/** Spawn an enemy ki shot from (x, y) toward a point, with range enough to reach it. */
function fire(f: Field, x: number, y: number, tx: number, ty: number, pow: number, color: string): Shot {
  const v = norm({ x: tx - x, y: ty - y });
  const shot = new Shot('enemy', 'shot', x + v.x * 8, y + v.y * 4, v, SNIPE.speed, SNIPE.mult, color, pow, 0);
  shot.life = Math.ceil(Math.hypot(tx - x, ty - y) / SNIPE.speed) + 40;
  f.spawnShot(shot);
  return shot;
}

/**
 * Drive the snipers for the rest of the fight. While Harmira holds his nest (HP above `SNIPER_NEST`) he lies hidden
 * (faint, shadowless) and every `SNIPE.every` frames his scope glints and he fires at Prum, whose mirror body bounces
 * the shot on at the hero; once found he fires straight at the hero. Prum also bounces the hero's own ki blasts back,
 * and fists glance off him. Raises `SNIPER_FOUND` when the hero comes close to Harmira or lands a blow on him.
 */
function snipers(s: ScriptApi, harmira: string, prum: string): FrameLoop {
  let t = 0;
  let seen = 0;
  let found = false;
  let hinted = false;
  let glance = 0;
  const inbound: Shot[] = [];
  const reflect = (f: Field, m: Enemy, pow: number): void => {
    const p = f.player;
    fire(f, m.x, m.y, p.x, p.y, pow, SNIPE.silver);
    m.flash = 6;
    f.fx.number(m.x, m.y - 36, 'REFLECT', SNIPE.silver);
  };
  return everyFrame(s, (f) => {
    const h = f.enemies.find((e) => e.uid === harmira);
    if (!h || h.dead || h.ended || h.puppet || h.state === 'dying') { if (h) h.cloak = 0; return; }
    if (f.locked) return;
    t++;
    const p = f.player;
    const m = f.enemies.find((e) => e.uid === prum && !e.dead && !e.hidden) ?? null;
    const nest = h.hp > h.maxHp * SNIPER_NEST;
    if (!found && (!nest || Math.hypot(p.x - h.x, p.y - h.y) < SNIPE.near)) {
      found = true;
      s.set(SNIPER_FOUND);
      f.fx.number(h.x, h.y - 40, '!', '#f8e040');
      f.toast(['Tien: There you are - the real sniper!'], '#f8e040');
    }
    if (seen > 0) seen--;
    h.cloak = found ? 0 : seen > 0 ? 0.2 : SNIPE.cloak;

    // Prum's mirror: the hero's ki blasts come straight back, and fists glance off.
    if (m) {
      m.faceTo(p.x, p.y);
      for (const sh of f.shots) {
        if (sh.owner !== 'player' || sh.dead || !overlaps(sh.rect(), m.body())) continue;
        sh.dead = true;
        reflect(f, m, m.def.pow);
        audio.sfx('block');
      }
      if (glance > 0) glance--;
      else if (p.state === 'attack' && overlaps(p.front(20), m.body())) {
        glance = 24;
        m.flash = 6;
        f.fx.number(m.x, m.y - 36, 'REFLECT', SNIPE.silver);
        audio.sfx('block');
      }
    }

    // Harmira's shots on their way to the mirror are bounced on toward the hero.
    for (let i = inbound.length - 1; i >= 0; i--) {
      const sh = inbound[i];
      if (sh.dead || !m) { inbound.splice(i, 1); continue; }
      if (Math.hypot(sh.x - m.x, sh.y - m.y) > SNIPE.mirror) continue;
      sh.dead = true;
      inbound.splice(i, 1);
      reflect(f, m, h.def.pow);
      audio.sfx('blast');
      if (!hinted) {
        hinted = true;
        f.toast(['Prum: Reflection!', 'That shot flew INTO Prum first... the sniper is somewhere else!'], '#f878b8');
      }
    }

    if (!nest) return;
    if (m && !found) h.faceTo(m.x, m.y);
    else h.faceTo(p.x, p.y);
    const phase = t % SNIPE.every;
    if (phase === SNIPE.every - SNIPE.aim) {
      // The scope catches the light just before he fires.
      f.fx.hit(h.x, h.y - 24, '#ffffff', 5);
      f.fx.number(h.x, h.y - 38, '+', '#f8f0a0');
      audio.sfx('charge');
      seen = SNIPE.aim + SNIPE.seen;
    }
    if (phase === 0) {
      if (m && !found) inbound.push(fire(f, h.x, h.y, m.x, m.y, h.def.pow, '#f878b8'));
      else fire(f, h.x, h.y, p.x, p.y, h.def.pow, '#f878b8');
      audio.sfx('blast');
    }
  });
}

/** Which way the stage's open middle lies from the hero (staging leans that way so nobody spawns at the rim). */
function inward(s: ScriptApi): 1 | -1 {
  const [hx] = heroTile(s);
  return hx < s.field.map.grid[0].length / 2 ? 1 : -1;
}

registerScripts({
  // ================================================================ ep 105: Master Roshi against Universe 4
  c14_roshi: async (s) => {
    await s.quest('c14_epRoshi', true);
    // In the dark: time passes, and the relay picks up with Master Roshi in the middle of the ring.
    await guestHandOff(s, ROSHI, { to: ringCentre(s) });
    s.music('tense');
    await s.narrate('Elsewhere on the west ring, Master Roshi stops to catch his breath. Universe 4 has been waiting for exactly that.');
    const side = inward(s);
    const [hx, hy] = heroTile(s);
    const [cx, cy] = stageOn(s, 'c14_cawayR', 'c14_caway', hx + side * 3, hy - 2, side > 0 ? 'left' : 'right', 'Caway', FIGHT_MARGIN);
    const [dx, dy] = stageOn(s, 'c14_dercoriR', 'c14_dercori', hx + side * 5, hy + 1, side > 0 ? 'left' : 'right', 'Dercori', FIGHT_MARGIN);
    s.face('hero', 'c14_cawayR');
    await s.talk([
      ['c14_cawayR', 'Look, Dercori. Universe 7\'s oldest fighter, all on his own and out of breath.', 'smirk'],
      ['c14_dercoriR', 'The easiest elimination of the day. Don\'t waste it.', 'neutral'],
      ['roshi', 'Hoho! Two lovely young ladies, and both of them want me? This tournament is wasted on the young.', 'happy'],
      ['c14_cawayR', 'Then look into my eyes, old man... and walk right off the stage for me.', 'smirk'],
      ['roshi', '(Not today. A pretty face is the oldest trick in the book... and I wrote that book!)', 'smirk'],
    ]);
    await s.narrate('Caway and Dercori attack together! Wear them both down.');
    s.letterbox(false);
    s.music('battle');
    removeAll(s, 'c14_cawayR', 'c14_dercoriR');
    s.spawnEnemy('c14_caway', cx, cy, 'c14_caway1');
    s.spawnEnemy('c14_dercori', dx, dy, 'c14_dercori1');
    const dazed = daze(s, ['c14_caway1', 'c14_dercori1']);
    try {
      await battle(s);
    } finally {
      dazed.stop();
    }
    s.letterbox(true);

    // Caway: her last blast batted aside, one flex of the old man's muscles, and she jumps.
    if (standing(s, 'c14_caway1')) {
      s.face('hero', 'c14_caway1');
      s.pose('c14_caway1', null);
      await s.say('c14_caway', 'What IS this old man?! Fine - then take THIS!', 'angry');
      await s.blast('c14_caway1', 'hero', '#f8a0d0');
      s.pose('hero', 'guard');
      s.shake(10, 1);
      await s.narrate('Master Roshi bats Caway\'s blast apart with one hand... then flexes. Every muscle on him bulges.');
      await s.powerUp('hero', '#f8e070', 24);
      s.pose('hero', null);
      await s.say('c14_caway', 'N-no way! I am NOT getting hit by THAT!', 'shock');
      const [cx2, cy2] = tileOf(s, 'c14_caway1');
      const [qx, qy] = pastEdge(s, cx2, cy2);
      await ringOut(s, 'c14_caway1', qx, qy);
      await s.narrate('Caway leaps off the stage of her own accord!');
      payOut(s, 'c14_caway');
    }
    // Dercori: the Evil Containment Wave, and a jar thrown off the stage.
    if (standing(s, 'c14_dercori1')) {
      s.face('hero', 'c14_dercori1');
      s.pose('c14_dercori1', null);
      await s.talk([
        ['c14_dercori', 'Stay back! One more step and I curse you where you stand!', 'angry'],
        ['roshi', 'Sorry, young lady. This old man has a trick of his own. Evil Containment Wave... MAFUBA!', 'shout'],
      ]);
      s.pose('hero', 'blast');
      await s.blast('hero', 'c14_dercori1', '#60f0a0');
      s.aura('c14_dercori1', '#60f0a0');
      s.shake(16, 2);
      await s.lift('c14_dercori1', 10, 12);
      s.flash('#60f0a0', 12);
      removeAll(s, 'c14_dercori1');
      s.pose('hero', null);
      await s.narrate('A green whirlwind sweeps Dercori into the little jar Master Roshi carries. He corks it... and tosses it off the stage.');
      await s.talk([
        ['grandPriest', 'A sealing technique... Hmm. Your Majesties, shall we allow it?', 'neutral'],
        ['zeno', 'That was neat!', 'happy'],
        ['grandPriest', 'Then it is allowed. Dercori of Universe 4 is eliminated.', 'happy'],
      ]);
      payOut(s, 'c14_dercori');
    }
    await eliminated(s, 'The old master outfoxes them both! Caway and Dercori have been eliminated.');

    // Ganos: Max Power, then a Kamehameha from the last of his life force.
    const [rx, ry] = heroTile(s);
    const [gx, gy] = stageOn(s, 'c14_ganosR', 'c14_ganos', rx + side * 4, ry - 2, side > 0 ? 'left' : 'right', 'Ganos', FIGHT_MARGIN);
    s.face('hero', 'c14_ganosR');
    await s.talk([
      ['c14_ganosR', 'Caway! Dercori! You\'ll pay for that, old man. I\'m Ganos, and I don\'t go down easy!', 'angry'],
      ['roshi', 'Hoo... another one. These old bones won\'t last a long slugging match.', 'hurt'],
      ['roshi', 'Then no more holding back. Time to show you youngsters... MAX POWER!', 'shout'],
    ]);
    await s.powerUp('hero', '#f8e070', 40);
    guestPower(s, true);
    s.shake(20, 2);
    await s.narrate('Master Roshi swells to Max Power! His muscles bulge... and so does his fighting spirit.');
    await s.say('c14_ganosR', 'Big muscles won\'t save you, grandpa!', 'smirk');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c14_ganosR');
    await bossFight(s, 'c14_ganos', { x: gx, y: gy, uid: 'c14_ganos1' });
    s.letterbox(true);
    const ganos = standIn(s, 'c14_ganos1', 'c14_ganosBird', gx, gy, 'Ganos');
    s.sprite(ganos, 'c14_ganosBird');
    s.face('hero', ganos);
    await s.talk([
      ['c14_ganosBird', 'Hah... hah... you\'re running on empty, old man! All I have to do is outlast you!', 'smirk'],
      ['c14_roshiMax', 'You\'re right. So I\'ll put everything I have left into one shot. Every last drop!', 'shout'],
      ['c14_roshiMax', 'Ka... me... ha... me...', 'shout'],
    ]);
    await s.beamStruggle('c14_roshiMax', 'c14_ganosBird', '#70c8f8', '#f0a020', [
      'Master Roshi pours his whole life into the Kamehameha!',
      'Ganos beats his wings against the beam!',
      'Hold on, Master Roshi!',
    ], 0.22);
    const [bx, by] = tileOf(s, ganos);
    s.boom(bx, by, 26, '#70c8f8');
    const [ex, ey] = pastEdge(s, bx, by);
    await ringOut(s, ganos, ex, ey);
    await eliminated(s, 'Ganos is blasted off the stage! Master Roshi has eliminated three fighters of Universe 4.');

    // The life-force Kamehameha takes its toll.
    guestPower(s, false);
    s.pose('hero', 'ko');
    s.stopMusic();
    await s.wait(40);
    await s.narrate('Master Roshi sinks to the stage... and lies still. That Kamehameha took everything he had. His heart has stopped.');
    await s.say('krillin', '(from the stands) MASTER ROSHI! Get up! Please, GET UP!', 'shock');
    // Goku leaves his own fight and drives Super Saiyan Blue ki into the old man's heart until it beats again (ep 105).
    const [rx0, ry0] = heroTile(s);
    stageOn(s, 'c14_gokuRoshi', 'gokuSSB', rx0 + side, ry0, side > 0 ? 'left' : 'right', 'Goku');
    s.aura('c14_gokuRoshi', '#40c0f8');
    await s.say('c14_gokuRoshi', 'Master Roshi! Come on, hang in there! Your heart just has to start again!', 'shout');
    for (let i = 0; i < 3; i++) {
      s.pose('c14_gokuRoshi', 'blast');
      s.flash('#40c0f8', 6);
      s.sfx('charge');
      await s.wait(16);
      s.pose('c14_gokuRoshi', null);
      await s.wait(14);
    }
    s.aura('c14_gokuRoshi', null);
    s.sprite('c14_gokuRoshi', 'goku');
    s.flash('#f8f0a0', 8);
    s.pose('hero', 'hurt');
    s.music('topArena');
    await s.talk([
      ['roshi', '...Gwahh! Hoo... hoo... A beautiful lady was waving at me from the other side. It seemed rude to leave without her number.', 'hurt'],
      ['c14_gokuRoshi', 'Phew! Don\'t scare me like that, Master Roshi! Here, grab my hand.', 'happy'],
      ['krillin', '(from the stands) Thank goodness...!', 'happy'],
    ]);
    const [gx0, gy0] = onStage(s, rx0 + side * 8, ry0 - 3);
    await s.walk('c14_gokuRoshi', gx0, gy0, 3);
    removeAll(s, 'c14_gokuRoshi');
    await s.narrate('Master Roshi is still in the tournament. Barely.');
    s.set('c14_roshiDone');
    await s.done('c14_epRoshi', false);
  },

  /** Ganos's second phase: cornered, he turns into a bird of prey. */
  c14_ganos_bird: async (s) => {
    if (s.exists('c14_ganos1')) {
      s.sprite('c14_ganos1', 'c14_ganosBird');
      const a = s.actor('c14_ganos1');
      s.field.fx.explode(a.x, a.y - 14, 20, '#f0a020');
    }
    s.flash('#f0a020', 10);
    s.sfx('powerUp');
    await s.say('c14_ganosBird', 'You pushed me into a corner, old man. Big mistake! The harder I\'m pushed, the stronger I get!', 'shout');
  },

  // ================================================================ ep 106: Tien and Universe 2's snipers
  c14_snipers: async (s) => {
    s.clear(SNIPER_FOUND);
    await s.quest('c14_epSnipers', true);
    // Tien steps in beside the spent Roshi, who sits down to rest (he stays on the stage).
    await guestHandOff(s, TIEN, { out: { id: 'c14_roshiS', name: 'Master Roshi', pose: 'hurt', sprite: 'roshi' } });
    s.music('tense');
    s.face('hero', 'c14_roshiS');
    await s.talk([
      ['roshi', 'Hoo... I need a little rest, Tien. Fight for me a while.', 'hurt'],
      ['tien', 'You\'ve done more than enough, Master Roshi. Rest - I\'ll keep watch.', 'neutral'],
      ['roshi', 'Hoho... always the good student, Tien.', 'hurt'],
    ]);
    const side = inward(s);
    const away = side > 0 ? 'left' : 'right';
    const [hx, hy] = heroTile(s);
    // A shot out of nowhere - from the little fighter standing in plain sight, it seems.
    const [mx, my] = stageOn(s, 'c14_prumS', 'c14_prum', hx + side * 4, hy + 3, away, 'Prum', FIGHT_MARGIN);
    s.flash('#f878b8', 6);
    s.boom(hx + side, hy - 1, 14, '#f878b8');
    s.face('hero', 'c14_prumS');
    await s.say('tien', 'That shot came from... him? Then take this!', 'angry');
    s.pose('hero', 'blast');
    await s.blast('hero', 'c14_prumS', '#f8f0a0');
    s.pose('hero', null);
    s.flash(SNIPE.silver, 8);
    await s.say('c14_prumS', 'Reflection! Hee hee!', 'smirk');
    await s.blast('c14_prumS', 'hero', SNIPE.silver);
    s.shake(10, 1);
    await s.talk([
      ['tien', 'His body is a mirror! He doesn\'t fire at all - he bounces someone else\'s shots. The real sniper is out there somewhere.', 'shock'],
      ['tien', 'Two eyes won\'t be enough to find him. Then I\'ll use more. MULTI-FORM!', 'shout'],
    ]);
    // Tien splits into four; three copies fan out across the ring to watch every direction.
    s.flash('#ffffff', 8);
    s.sfx('teleport');
    const copies: string[] = [];
    const lookouts: Array<[number, number]> = [];
    for (const [i, [cx, cy]] of ([[hx - 1, hy], [hx + 1, hy], [hx, hy + 1]] as Array<[number, number]>).entries()) {
      const id = `c14_tienC${i}`;
      stageOn(s, id, 'tien', cx, cy, 'down', 'Tien');
      copies.push(id);
      lookouts.push(onStage(s, hx + (i - 1) * 9, hy - 6 + i * 4));
    }
    await Promise.all(copies.map((id, i) => s.walk(id, lookouts[i][0], lookouts[i][1], 3)));
    removeAll(s, ...copies);
    await s.narrate('The sniper fires at Prum, and Prum\'s mirror sends the shot at you. Watch for the glint of his scope and follow his shots back to the nest. Ki blasts bounce straight off Prum!');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c14_prumS');
    s.spawnEnemy('c14_prum', mx, my, 'c14_prum1');
    // Harmira's nest: across the ring, on ground Tien can reach.
    const [ax, ay] = onStage(s, hx + side * 11, hy - 5, FIGHT_MARGIN);
    s.spawnEnemy('c14_harmira', ax, ay, 'c14_harmira1').cloak = SNIPE.cloak;
    const scope = snipers(s, 'c14_harmira1', 'c14_prum1');
    try {
      await bossFight(s, 'c14_harmira', { uid: 'c14_harmira1', existing: true });
    } finally {
      scope.stop();
    }
    s.letterbox(true);
    const [px, py] = s.exists('c14_prum1') ? tileOf(s, 'c14_prum1') : [mx, my];
    removeAll(s, 'c14_prum1');
    stageOn(s, 'c14_prumS', 'c14_prum', px, py, away, 'Prum');
    const har = standIn(s, 'c14_harmira1', 'c14_harmira', ax, ay, 'Harmira');
    s.face('hero', har);
    await s.talk([
      ['c14_harmira', 'You found my nest, Tien. Clever. But you\'re standing on very thin ground.', 'smirk'],
      ['tien', 'What-?!', 'shock'],
    ]);
    // Harmira shoots the stage out from under Tien...
    const [tx, ty] = heroTile(s);
    s.pose(har, 'blast');
    await s.blast(har, 'hero', '#f878b8');
    s.pose(har, null);
    s.boom(tx, ty, 22, '#f878b8');
    s.shake(20, 3);
    await s.narrate('Harmira fires straight down at the stage beneath Tien\'s feet. The ground gives way...');
    s.show('hero', false);
    stageOn(s, 'c14_tienS', 'tien', tx, ty, 'up', 'Tien');
    s.pose('c14_tienS', 'hurt');
    // ...but Tien's three copies come back for him.
    const [hmx, hmy] = tileOf(s, har);
    const holds: string[] = [];
    for (const [i, [cx, cy]] of ([[hmx - 1, hmy], [hmx + 1, hmy], [hmx, hmy - 1]] as Array<[number, number]>).entries()) {
      const id = `c14_tienC${i}`;
      stageOn(s, id, 'tien', cx, cy, 'down', 'Tien');
      s.face(id, har);
      holds.push(id);
    }
    s.flash('#ffffff', 8);
    s.sfx('teleport');
    s.pose(har, 'hurt');
    await s.narrate('...and Tien\'s three copies burst out of hiding and seize Harmira by the arms and legs!');
    await s.talk([
      ['c14_harmira', 'Let go! LET GO OF ME!', 'shock'],
      ['tien', 'If I\'m going down, you\'re coming with me! Universe 7... is in your hands now!', 'shout'],
    ]);
    const [ox, oy] = pastEdge(s, hmx, hmy);
    const [fx, fy] = pastEdge(s, tx, ty);
    await Promise.all([ringOut(s, har, ox, oy), ...holds.map((id) => ringOut(s, id, ox, oy)), ringOut(s, 'c14_tienS', fx, fy)]);
    await eliminated(s, 'Tien drags Harmira off the stage with him! Harmira... and Tien have been eliminated. Universe 7: eight fighters remain.');

    // Prum, without his sniper.
    await s.say('c14_prumS', 'H-Harmira?! Without you, I can\'t... Eek!', 'shock');
    const [vx, vy] = stageOn(s, 'c14_vegetaP', 'vegeta', px - side * 4, py - 2, side > 0 ? 'right' : 'left', 'Vegeta');
    s.face('c14_vegetaP', 'c14_prumS');
    await s.say('c14_vegetaP', 'You talk too much.', 'neutral');
    await s.blast('c14_vegetaP', 'c14_prumS', '#c070f8');
    const [qx, qy] = pastEdge(s, px, py);
    await ringOut(s, 'c14_prumS', qx, qy);
    await eliminated(s, 'Vegeta\'s Galick Gun blasts Prum out of the ring!');
    const [wx, wy] = onStage(s, vx - side * 8, vy - 2);
    await s.walk('c14_vegetaP', wx, wy, 3);
    removeAll(s, 'c14_vegetaP');
    await s.say('roshi', 'Tien, you fool... Well done, my boy. Well done.', 'sad');
    s.set('c14_snipersDone');
    await s.done('c14_epSnipers', false);
  },

  /** Harmira found: he leaves his nest and fights Tien head-on. */
  c14_harmira_found: async (s) => {
    s.set(SNIPER_FOUND);
    await s.say('c14_harmira', 'So you followed my shots back to me. Fine - up close, I don\'t need a mirror!', 'angry');
  },

  /** Harmira's last phase. */
  c14_harmira_p2: async (s) => {
    await s.say('c14_harmira', 'Stop dodging and fall already!', 'angry');
  },

  // ================================================================ ep 107: Frost's trap
  c14_frostTrap: async (s) => {
    await s.quest('c14_epFrostTrap', true);
    // Master Roshi gets back on his feet where he was resting (the hero was hidden after Tien's fall).
    await guestHandOff(s, ROSHI, { at: 'c14_roshiS' });
    s.music('tense');
    const side = inward(s);
    const away = side > 0 ? 'right' : 'left';
    const toward = side > 0 ? 'left' : 'right';
    const [hx, hy] = heroTile(s);
    const [vx, vy] = stageOn(s, 'c14_vegetaF', 'vegeta', hx + side * 4, hy - 1, away, 'Vegeta', FIGHT_MARGIN);
    const [mx, my] = stageOn(s, 'c14_magettaF', 'c07_magetta', vx + side * 2, vy, toward, 'Magetta', FIGHT_MARGIN);
    const [fx, fy] = stageOn(s, 'c14_frostF', 'frost', vx - side, vy - 3, 'down', 'Frost', FIGHT_MARGIN);
    await s.narrate('Not far away, Vegeta has Magetta on the ropes. Neither of them sees Frost creeping up behind the prince.');
    await s.talk([
      ['c14_vegetaF', 'Still sulking over what I called you last time, scrap heap? You\'re a walking junkyard!', 'smirk'],
      ['c14_magettaF', '...', 'neutral'],
      ['c14_vegetaF', 'He\'s plugged his ears?! Tch. Somebody taught that pile of bolts a lesson.', 'angry'],
      ['roshi', '(Frost is going for Vegeta\'s back. The Evil Containment Wave took a lot out of me with Dercori... but it\'s the only trick I have left.)', 'neutral'],
      ['roshi', 'Evil Containment Wave! MAFUBA!', 'shout'],
    ]);
    // The first wave misses: Frost has seen it before.
    s.pose('hero', 'blast');
    await s.blast('hero', 'c14_frostF', '#60f0a0');
    s.sfx('teleport');
    s.flash('#a070f0', 6);
    const [jx, jy] = onStage(s, fx - side * 2, fy, FIGHT_MARGIN);
    s.place('c14_frostF', jx, jy, 'down');
    await s.say('c14_frostF', 'Not twice, old man. I saw what you did to Dercori.', 'smirk');
    await s.say('roshi', 'Then... once more! MAFUBA!', 'shout');
    await s.blast('hero', 'c14_frostF', '#60f0a0');
    s.aura('c14_frostF', '#a070f0');
    s.flash('#a070f0', 10);
    await s.say('c14_frostF', 'A barrier turns it right around. Now, let\'s see who it seals.', 'smirk');
    await s.blast('c14_frostF', 'c14_vegetaF', '#60f0a0');
    s.aura('c14_frostF', null);
    s.aura('c14_vegetaF', '#60f0a0');
    s.shake(20, 2);
    await s.say('c14_vegetaF', 'What... is this?! Something is pulling me-', 'shock');
    await s.lift('c14_vegetaF', 10, 12);
    s.flash('#60f0a0', 12);
    removeAll(s, 'c14_vegetaF');
    s.pose('hero', null);
    await s.narrate('Frost turns the Evil Containment Wave back with a barrier, and it sucks Vegeta into Master Roshi\'s jar!');
    await s.talk([
      ['vegeta', '(from inside the jar) Let me OUT of here! When I get out, I\'ll tear you apart, Frost!', 'angry'],
      ['c14_frostF', 'A prince in a jar. One toss over the edge, and Universe 7 is a Saiyan short.', 'smirk'],
      ['roshi', 'Not while this old man is still standing! Give that back!', 'angry'],
    ]);
    await s.narrate('Frost has Vegeta\'s jar under his arm! Hit him hard enough to make him let go of it. Magetta guards his back - wear him down to get him off yours.');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c14_frostF', 'c14_magettaF');
    s.spawnEnemy('c14_magetta', mx, my, 'c14_magetta1');
    const dazed = daze(s, ['c14_magetta1']);
    try {
      await bossFight(s, 'c14_frostJar', { x: jx, y: jy, uid: 'c14_frostJar1' });
    } finally {
      dazed.stop();
    }
    s.letterbox(true);
    // Magetta stops where he stands (unless he has already been thrown out).
    const mag = standing(s, 'c14_magetta1');
    const wornDown = !!mag && isDazed(mag);
    if (mag) mag.puppet = true;
    else removeAll(s, 'c14_magetta1');
    const frost = standIn(s, 'c14_frostJar1', 'frost', jx, jy, 'Frost');
    s.face('hero', frost);
    await s.say('frost', 'Ngh! The jar-!', 'shock');
    await s.narrate('The jar slips out of Frost\'s grip and rolls for the edge. Master Roshi dives after it... and with the last of his strength, smashes it open!');
    s.flash('#60f0a0', 16);
    s.shake(20, 3);
    const [ox, oy] = heroTile(s);
    stageOn(s, 'c14_vegetaF', 'vegeta', ox + side, oy, toward, 'Vegeta');
    await s.narrate('Master Roshi frees Vegeta from Frost\'s trap!');
    await s.say('c14_vegetaF', 'FROST! You dare stuff the prince of all Saiyans into a JAR?!', 'shout');
    await s.powerUp('c14_vegetaF', '#40c0f8', 30);
    s.sprite('c14_vegetaF', 'vegetaSSB');
    s.aura('c14_vegetaF', '#40c0f8');
    if (mag) {
      await s.blast('c14_vegetaF', 'c14_magetta1', '#40c0f8');
      const [gx, gy] = tileOf(s, 'c14_magetta1');
      s.boom(gx, gy, 22, '#40c0f8');
      const [qx, qy] = pastEdge(s, gx, gy);
      await ringOut(s, 'c14_magetta1', qx, qy);
      await eliminated(s, 'Vegeta blasts Magetta clean out of the ring!');
      if (wornDown) payOut(s, 'c14_magetta');
    } else {
      await s.narrate('With Magetta already out of the ring, Frost is on his own.');
    }
    s.aura('c14_vegetaF', null);
    await s.say('frost', 'Tch. Another time, Saiyan.', 'angry');
    const [lx, ly] = tileOf(s, frost);
    const [wx, wy] = onStage(s, lx - side * 10, ly - 4);
    s.sfx('dash');
    await s.walk(frost, wx, wy, 5);
    removeAll(s, frost);
    await s.talk([
      ['c14_vegetaF', 'Get back here, you coward!', 'angry'],
      ['roshi', 'Hoo... that was the last of me, Vegeta. Any longer and I\'d only get in your way.', 'hurt'],
      ['c14_vegetaF', 'Old man...?', 'shock'],
      ['roshi', 'Win this, all of you. I\'ll be cheering you on from the stands. Hohoho!', 'happy'],
    ]);
    // Roshi walks off the stage by himself.
    const [rx, ry] = heroTile(s);
    s.show('hero', false);
    stageOn(s, 'c14_roshiOut', 'roshi', rx, ry, toward, 'Master Roshi');
    const [qx, qy] = pastEdge(s, rx, ry);
    await s.walk('c14_roshiOut', qx, qy, 1.5);
    removeAll(s, 'c14_roshiOut');
    await eliminated(s, 'Master Roshi steps off the stage on his own two feet. Universe 7: seven fighters remain.');
    await s.say('c14_vegetaF', '...Hmph. You fought like a true warrior, old man.', 'neutral');
    if (s.exists('c14_vegetaF')) {
      const [vx2, vy2] = tileOf(s, 'c14_vegetaF');
      const [gx2, gy2] = onStage(s, vx2 - side * 9, vy2 - 3);
      await s.walk('c14_vegetaF', gx2, gy2, 3);
    }
    removeAll(s, 'c14_vegetaF', 'c14_roshiS');
    s.set('c14_frostTrapDone');
    await s.done('c14_epFrostTrap', false);
    // Out of costume in the dark, ready for the next fighter.
    await s.fadeOut(20);
    takeOffGuest(s);
    s.show('hero', true);
  },

  /** Frost's second phase. */
  c14_frostJar_p2: async (s) => {
    await s.say('frost', 'Careful, old man. Hit me too hard and this jar goes straight over the edge!', 'smirk');
  },
});
