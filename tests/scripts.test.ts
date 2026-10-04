import { describe, expect, it } from 'vitest';
import { MAPS, resolveMap } from '../src/content/registry';
import { Sim } from './sim';

/**
 * Smoke-run every script referenced from a map (NPC talk, triggers, onEnter, onDefeat) on that map,
 * with a bot advancing dialogue and resolving fights. Catches runtime errors, bad actor ids,
 * unknown items/maps/enemies and scripts that never finish.
 */
describe('script smoke tests', () => {
  for (const id of Object.keys(MAPS)) {
    const m = resolveMap(id);
    if (!m) continue;
    const refs = new Set<string>();
    for (const n of m.npcs ?? []) if (n.talk) refs.add(n.talk);
    for (const t of m.triggers ?? []) refs.add(t.script);
    for (const e of m.enemies ?? []) if (e.onDefeat) refs.add(e.onDefeat);
    if (!refs.size) continue;
    it(`scripts on ${id}`, async () => {
      for (const sid of refs) {
        const sim = new Sim();
        sim.start(id);
        await sim.tick(5);
        const npc = sim.game.field?.npcs.find((n) => n.def.talk === sid);
        const ok = await sim.run(sid, npc ? { npc } : {});
        expect(sim.errors, `${id}/${sid} errors`).toEqual([]);
        expect(ok, `${id}/${sid} did not finish`).toBe(true);
      }
    });
  }
});
