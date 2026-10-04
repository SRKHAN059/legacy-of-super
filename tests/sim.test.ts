import { describe, expect, it } from 'vitest';
import { Sim } from './sim';

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
