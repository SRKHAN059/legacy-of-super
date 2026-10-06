import { describe, expect, it } from 'vitest';
import '../src/content';
import { portrait } from '../src/art/registry';
import { scaledSprite } from '../src/content/chapters/act5/c13_expo';
import type { StruggleOpts } from '../src/ui/beamstruggle';
import type { Line } from '../src/ui/dialogue';
import { registerScripts } from '../src/game/script';
import { Sim } from './sim';

/**
 * Presentation checks from the hands-on playtest: what the player sees must match the hero on the field (a transformed
 * hero's portrait) and the hero must never vanish behind a giant (Bergamo at full size).
 */

registerScripts({
  zz_present_formFace: async (s) => {
    await s.say('gohan', 'Blind or not... this close, I can\'t miss!', 'shout');
    await s.say('goku', 'Go, Gohan!', 'happy');
    await s.beamStruggle('gohan', 'lavender', '#70c8f8', '#a050e0');
  },
});

/** A sim on the Capsule Corp lawn with Gohan as the active hero (Super Saiyan available) and Goku in the party. */
function gohanSim(): Sim {
  const sim = new Sim();
  const st = sim.game.state;
  st.data.chapter = 13;
  st.join('goku', 37);
  st.join('gohan', 39);
  st.char('gohan').form = 'ssj';
  st.data.active = 'gohan';
  sim.start('cc_yard', 22, 18);
  return sim;
}

/** Run the portrait script and capture each dialogue line and the beam struggle's options. */
async function capture(sim: Sim): Promise<{ lines: Line[]; struggle: StruggleOpts | null }> {
  const lines: Line[] = [];
  let struggle: StruggleOpts | null = null;
  const g = sim.game;
  const say = g.say.bind(g);
  g.say = (ls) => { lines.push(...ls); return say(ls); };
  const bs = g.beamStruggle.bind(g);
  g.beamStruggle = (o) => { struggle = o; return bs(o); };
  expect(await sim.run('zz_present_formFace')).toBe(true);
  return { lines, struggle };
}

describe('presentation: portraits follow the hero\'s form', () => {
  it('a transformed hero named by their own id speaks and struggles with the form\'s face; others keep theirs', async () => {
    const sim = gohanSim();
    await sim.tick(2);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    f.player.formActive = 'ssj';
    f.player.refreshSprite();
    expect(f.player.spriteId).toBe('gohanSSJ');
    const { lines, struggle } = await capture(sim);
    expect(lines[0].name).toBe('Gohan');
    expect(lines[0].portrait).toBe(portrait('gohanSSJ', 'shout'));
    // Goku is not the hero here: his own portrait.
    expect(lines[1].portrait).toBe(portrait('goku', 'happy'));
    expect(struggle?.heroPortrait).toBe(portrait('gohanSSJ', 'shout'));
    expect(struggle?.heroName).toBe('Gohan');
    expect(sim.errors).toEqual([]);
  });

  it('in base form the hero keeps the base portrait', async () => {
    const sim = gohanSim();
    await sim.tick(2);
    const { lines, struggle } = await capture(sim);
    expect(lines[0].portrait).toBe(portrait('gohan', 'shout'));
    expect(struggle?.heroPortrait).toBe(portrait('gohan', 'shout'));
  });
});

describe('presentation: the hero shows through a giant', () => {
  it('only an enemy sprite taller than a hero, standing in front and covering most of the hero, counts', async () => {
    const sim = new Sim();
    sim.game.state.join('goku', 37);
    sim.game.state.data.active = 'goku';
    sim.start('cc_yard', 22, 18);
    await sim.tick(2);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const p = f.player;
    const e = f.spawnEnemy('c13_bergamo', p.x, p.y + 20, 'zz_giant');
    e.aggro = false;
    // Bergamo as he enters the ring is hero-sized: overlapping him is ordinary melee range.
    expect(f.heroBehindGiant()).toBe(false);
    // Grown to giant size (the Expo's growth step), in front of the hero (larger y): the hero is hidden by him.
    e.set = scaledSprite('bergamo', 2);
    expect(e.frame().height).toBeGreaterThanOrEqual(64);
    expect(f.heroBehindGiant()).toBe(true);
    // Behind the hero (smaller y) he is drawn first, and to one side he covers too little of the hero.
    e.y = p.y - 4;
    expect(f.heroBehindGiant()).toBe(false);
    e.y = p.y + 20;
    e.x = p.x + 40;
    expect(f.heroBehindGiant()).toBe(false);
    e.x = p.x;
    e.dead = true;
    expect(f.heroBehindGiant()).toBe(false);
  });
});
