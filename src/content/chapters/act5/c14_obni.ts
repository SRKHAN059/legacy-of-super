import type { Enemy } from '../../../game/enemy';
import type { Field } from '../../../game/field';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerQuests } from '../../quests';
import { everyFrame, type FrameLoop } from './c14_assist';
import { OBNI_IMAGE } from './c14_enemies';
import { pastEdge, ringCentre } from './c14_edge';
import { eliminated, erased, FIGHT_MARGIN, onStage, ringOut, stageOn, standIn } from './c14_kit';
import { bossFight, handOff, heroTile, removeAll } from './helpers';

/**
 * Ep 103: Gohan against Obni, Universe 10's last fighter, run inline by the stage A relay (`c14.ts`) between the
 * Kamikaze Fireballs and Goku and Hit's team-up. Obni hides his ki and splits into afterimages (`OBNI_IMAGE`,
 * summoned by his boss pattern): faint copies that cast no shadow, circle the hero, and vanish at the first touch.
 * At the scripted end Gohan does what canon has him do: he lets Obni's punch land to find the real one, answers with
 * a cross-counter, and a Kamehameha throws Obni out of the ring. The locket Obni drops (his wife and daughter) fades
 * from Gohan's hand when Zeno erases Universe 10. Sets `c14_obniDone`.
 */

registerQuests([
  { id: 'c14_epObni', title: 'Gohan vs. Obni', star: 'gold', region: 'spot_zeno', desc: 'Universe 10 is down to one fighter, and Obni fights for the family waiting for him at home. Gohan knows that feeling. Only the real Obni casts a shadow.' },
]);

/** Afterimage rules, in frames and pixels. */
export const MIRAGE = {
  /** Cloak strength of an afterimage: faint, and too faint to cast a shadow (Enemy.drawShadow). */
  cloak: 0.55,
  /** An afterimage fades on its own after this long. */
  life: 300,
  /** Radius of the circle the afterimages run around the hero. */
  radius: 34,
  /** Running speed, px per frame. */
  speed: 1.7,
} as const;

/** An afterimage still on the stage. */
function liveImage(e: Enemy): boolean {
  return e.def.id === OBNI_IMAGE && !e.dead && e.state !== 'dying';
}

/** Fade an afterimage out (no death throes: there was never anyone there). */
function fade(f: Field, e: Enemy): void {
  f.fx.dust(e.x, e.y);
  f.fx.hit(e.x, e.cy, '#e8e8f4', 3);
  e.dead = true;
}

/**
 * Drive Obni's afterimages for the rest of the fight: each one is faint and shadowless, runs a circle around the hero
 * (so the real Obni hides among them), and fades after `MIRAGE.life` frames.
 */
function mirage(s: ScriptApi): FrameLoop {
  const born = new Map<Enemy, number>();
  let n = 0;
  return everyFrame(s, (f) => {
    if (f.locked) return;
    n++;
    const p = f.player;
    for (const e of f.enemies) {
      if (!liveImage(e)) continue;
      if (!born.has(e)) born.set(e, n);
      const age = n - (born.get(e) ?? n);
      if (age >= MIRAGE.life) { fade(f, e); continue; }
      e.cloak = MIRAGE.cloak;
      // Each image keeps its own place on the circle (by spawn order), turning slowly around the hero.
      const slot = [...born.keys()].indexOf(e);
      const a = slot * 2.1 + n / 90;
      const tx = p.x + Math.cos(a) * MIRAGE.radius;
      const ty = p.y + Math.sin(a) * MIRAGE.radius * 0.7;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        const k = Math.min(MIRAGE.speed, d) / d;
        const r = f.col.move(e.box(), dx * k, dy * k);
        e.x += r.dx;
        e.y += r.dy;
        e.moving = r.dx !== 0 || r.dy !== 0;
      } else e.moving = false;
      e.faceTo(p.x, p.y);
    }
  });
}

/** Fade every afterimage still on the stage. */
function clearImages(s: ScriptApi): void {
  const f = s.field;
  for (const e of f.enemies) if (liveImage(e)) fade(f, e);
}

registerScripts({
  c14_obni: async (s) => {
    await s.quest('c14_epObni', true);
    // A time skip in the dark: the relay picks up in the middle of the ring, where whoever played the last set piece
    // hands over to Gohan.
    await s.fadeOut(16);
    const [mx, my] = ringCentre(s);
    s.place('hero', mx, my);
    await handOff(s, 'gohan');
    s.music('tense');
    await s.narrate('Twenty minutes in. Universe 10 is down to two fighters... and Piccolo cages Rubalt in a ring of ki blasts and knocks him off the stage.');
    await s.narrate('Now Universe 10 has one fighter left. He has found Gohan.');
    const [hx, hy] = heroTile(s);
    const [ox, oy] = stageOn(s, 'c14_obniO', 'c14_obni', hx + 4, hy - 2, 'left', 'Obni', FIGHT_MARGIN);
    s.face('hero', 'c14_obniO');
    await s.talk([
      ['c14_obniO', 'Son Gohan. Universe 7\'s leader. If you fall, your team loses its head.', 'neutral'],
      ['gohan', 'You\'re the last one left from Universe 10, aren\'t you?', 'neutral'],
      ['c14_obniO', 'Then I fight for all of it. For my universe... and for the two people waiting for me there.', 'angry'],
    ]);
    await s.narrate('Obni hides his ki and moves faster than the eye can follow, leaving afterimages behind. Only the real Obni casts a shadow - strike him, not his copies!');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c14_obniO');
    const images = mirage(s);
    try {
      await bossFight(s, 'c14_obni', { x: ox, y: oy, uid: 'c14_obni1' });
    } finally {
      images.stop();
      clearImages(s);
    }
    s.letterbox(true);
    const obni = standIn(s, 'c14_obni1', 'c14_obni', ox, oy, 'Obni');
    s.face('hero', obni);
    await s.talk([
      ['c14_obni', 'My wife... my daughter... I cannot fall here!', 'shout'],
      ['gohan', 'I have a wife and a daughter waiting too. That\'s exactly why I won\'t lose!', 'shout'],
    ]);
    await s.narrate('Obni scatters into afterimages one last time. Gohan stops chasing them... and lets the punch come.');
    const [gx, gy] = heroTile(s);
    const o = s.actor(obni);
    const [ex, ey] = onStage(s, Math.floor(o.x / 16) < gx ? gx - 1 : gx + 1, gy);
    await s.walk(obni, ex, ey, 4);
    s.face(obni, 'hero');
    s.face('hero', obni);
    s.pose(obni, 'punch2');
    s.pose('hero', 'punch2');
    s.flash('#ffffff', 10);
    s.shake(16, 2);
    s.boom(ex, ey, 16, '#f0f0ff');
    await s.narrate('The blow lands - and in that instant Gohan knows exactly where Obni is. His fist sinks into Obni\'s stomach. A cross-counter!');
    s.pose(obni, 'hurt');
    await s.say('gohan', 'Ka... me... ha... me... HAAA!', 'shout');
    s.pose('hero', 'blast');
    await s.blast('hero', obni, '#70c8f8');
    s.pose('hero', null);
    s.boom(ex, ey, 24, '#70c8f8');
    const [qx, qy] = pastEdge(s, ex, ey);
    await ringOut(s, obni, qx, qy);
    await eliminated(s, 'The Kamehameha throws Obni out of the ring! Universe 10\'s last fighter is out.');
    // The locket he dropped as he flew.
    s.field.fx.hit(ex * 16 + 8, ey * 16 + 10, '#f8e070', 5);
    s.sfx('item');
    await s.walk('hero', ex, ey, 1.2);
    s.face('hero', 'down');
    await s.narrate('Something glints where Obni stood: a locket. Inside is a picture of Obni with his wife and their little daughter.');
    await s.say('gohan', '...', 'sad');
    s.flash('#f8f8f8', 8);
    await erased(s, 'Universe 10 has no fighters left. In the stands, Gowasu bows his head. Then Zeno erases Universe 10... and the locket fades away in Gohan\'s hand.');
    await s.say('gohan', 'He fought for his family to the very end. ...I won\'t forget that.', 'sad');
    s.set('c14_obniDone');
    await s.done('c14_epObni', false);
    await s.fadeOut(20);
  },

  /** Obni's second phase: he stops holding anything back. */
  c14_obni_p2: async (s) => {
    if (s.exists('c14_obni1')) {
      const a = s.actor('c14_obni1');
      s.field.fx.explode(a.x, a.y - 14, 18, '#c0a040');
      s.aura('c14_obni1', '#c0a040');
    }
    s.sfx('powerUp');
    await s.say('c14_obni', 'Your strength is real, Gohan. Then I will show you all of mine!', 'shout');
  },
});
