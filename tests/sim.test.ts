import { describe, expect, it } from 'vitest';
import type { CharId } from '../src/content/characters';
import { CHARGED_MELEE } from '../src/content/techniques';
import { CHARACTERS } from '../src/content/characters';
import type { Button } from '../src/engine/input';
import { Sim } from './sim';

/** Advance the game n ticks with exactly these buttons held (no bot). */
async function hold(sim: Sim, n: number, held: Partial<Record<Button, boolean>> = {}): Promise<void> {
  for (let i = 0; i < n; i++) {
    for (const b of Object.keys(held) as Button[]) sim.input.inject(b, !!held[b]);
    sim.input.poll();
    sim.game.scenes.update(sim.input);
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

/** A hero standing in the dev arena facing a sturdy, motionless target dummy. */
function arena(id: CharId, charged: boolean, gap = 16) {
  const sim = new Sim();
  const st = sim.game.state;
  st.join(id, 20);
  st.data.active = id;
  sim.start('dev_arena', 4, 8);
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  const p = f.player;
  p.dir = 'right';
  p.cs.charged = charged;
  const dummy = f.spawnEnemy('blueTRex', p.x + gap, p.y);
  dummy.puppet = true;
  return { sim, f, p, dummy };
}

describe('headless sim', () => {
  it('runs a scripted boss fight to its scripted end and applies rewards', async () => {
    const sim = new Sim();
    sim.start('dev_arena', 5, 5);
    await sim.tick(5);
    const before = sim.game.state.hero.exp;
    const ok = await sim.run('dev_boss');
    expect(ok).toBe(true);
    expect(sim.errors).toEqual([]);
    expect(sim.game.state.data.journal.dev_q1).toBe('done');
    expect(sim.game.state.hero.exp).toBeGreaterThan(before);
  });

  it('reports a missing actor as an error', async () => {
    const { registerScripts } = await import('../src/game/script');
    registerScripts({ test_bad: async (s) => { s.face('nobody', 'up'); } });
    const sim = new Sim();
    sim.start('dev_arena');
    await sim.run('test_bad');
    expect(sim.errors.join('\n')).toContain('nobody');
  });
});

describe('fight sealing (engine)', () => {
  it('blocks warps, edge exits, save discs and world signs while a scripted fight runs', async () => {
    const { registerScripts } = await import('../src/game/script');
    let during: { sealed: boolean; map: string } | null = null;
    registerScripts({
      test_sealed_fight: async (s) => {
        const p = s.fight('devBoss', { x: 14, y: 5, uid: 'sealBoss' });
        await s.wait(2);
        const f = s.field;
        // Try to walk off the west edge (dev_arena has a west exit) mid-fight.
        f.player.x = 6; f.player.y = 5 * 16 + 14;
        during = { sealed: f.sealed, map: f.def.id };
        await p;
      },
    });
    const sim = new Sim();
    sim.start('dev_arena', 5, 5);
    await sim.tick(3);
    // Don't let the bot auto-win immediately: drive input west for a while first.
    const started = sim.game.runScript('test_sealed_fight');
    for (let i = 0; i < 40; i++) {
      sim.input.inject('left', true);
      sim.input.poll();
      sim.game.scenes.update(sim.input);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    sim.input.inject('left', false);
    expect(during).toEqual({ sealed: true, map: 'dev_arena' });
    expect(sim.game.field?.def.id).toBe('dev_arena');
    await sim.tick(400);
    await started;
    expect(sim.game.fightDepth).toBe(0);
    expect(sim.game.field?.sealed).toBe(false);
  });
});

describe('input latching', () => {
  it('registers a tap that starts and ends between two polls exactly once', async () => {
    const { Input } = await import('../src/engine/input');
    const inp = new Input(null);
    inp.inject('A', true);
    inp.inject('A', false);
    inp.poll();
    expect(inp.pressed('A')).toBe(true);
    inp.poll();
    expect(inp.pressed('A')).toBe(false);
    expect(inp.isDown('A')).toBe(false);
  });
});

describe('charged melee (Master Roshi, LoG2 hold-A specials)', () => {
  for (const id of ['goku', 'vegeta', 'gohan', 'trunks', 'piccolo'] as CharId[]) {
    const move = CHARGED_MELEE[CHARACTERS[id].charged];
    it(`${id}: holding A through the jab charges ${move.name}, releasing runs it and it hits`, async () => {
      // The Two-Handed Smash leaps ~35 px before it lands: stand the dummy where the hammer comes down.
      const { sim, p, dummy } = arena(id, true, move.style === 'smash' ? 50 : 16);
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) { await hold(sim, 1, { A: true }); seen.add(p.state); }
      expect([...seen]).toContain('chargeMelee');
      expect(p.state).toBe('chargeMelee');
      const before = dummy.hp;
      await hold(sim, 1, { A: false });
      expect(p.state).toBe('special');
      for (let i = 0; i < 120 && p.state !== 'free'; i++) await hold(sim, 1, { A: false });
      expect(p.state).toBe('free');
      expect(dummy.hp).toBeLessThan(before);
      expect(sim.errors).toEqual([]);
    });
  }

  it('mashing A runs the normal combo and never charges', async () => {
    const { sim, p } = arena('goku', true);
    const seen = new Set<string>();
    for (let i = 0; i < 90; i++) { await hold(sim, 1, { A: i % 4 < 2 }); seen.add(p.state); }
    expect(seen.has('attack')).toBe(true);
    expect(seen.has('chargeMelee')).toBe(false);
  });

  it('holding A without Roshi\'s training just ends the jab', async () => {
    const { sim, p } = arena('vegeta', false);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) { await hold(sim, 1, { A: true }); seen.add(p.state); }
    expect(seen.has('chargeMelee')).toBe(false);
    expect(p.state).toBe('free');
  });
});
