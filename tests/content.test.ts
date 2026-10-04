import { describe, expect, it } from 'vitest';
import '../src/content';
import { propArt } from '../src/art/props';
import { CAST } from '../src/content/cast';
import { CHARACTERS } from '../src/content/characters';
import { CREATURES } from '../src/content/creatures';
import { ENEMIES } from '../src/content/enemies';
import { ITEMS } from '../src/content/items';
import { QUESTS } from '../src/content/quests';
import { MAPS, resolveMap } from '../src/content/registry';
import { SPOTS } from '../src/content/world';
import { FORMS } from '../src/content/characters';
import { TECHNIQUES } from '../src/content/techniques';
import { SCRIPTS } from '../src/game/script';
import { parseGrid } from '../src/game/world';

const sprite = (id: string) => !!(CAST[id] || CREATURES[id]);

describe('content integrity', () => {
  for (const id of Object.keys(MAPS)) {
    it(`map ${id}`, () => {
      const m = resolveMap(id);
      expect(m).toBeTruthy();
      if (!m) return;
      const grid = parseGrid(m);
      const W = grid[0].length;
      const H = grid.length;
      const inb = (x: number, y: number, what: string) => {
        expect(x >= 0 && x < W && y >= 0 && y < H, `${id}: ${what} at ${x},${y} out of bounds ${W}x${H}`).toBe(true);
      };
      const scr = (s: string | undefined, what: string) => { if (s) expect(SCRIPTS[s], `${id}: ${what} script "${s}" missing`).toBeTruthy(); };
      for (const e of [m.onEnter].flat()) scr(e, 'onEnter');
      for (const n of m.npcs ?? []) {
        expect(sprite(n.sprite), `${id}: npc ${n.id} sprite ${n.sprite}`).toBe(true);
        if (n.talk) scr(n.talk, `npc ${n.id}`);
        inb(n.x, n.y, `npc ${n.id}`);
      }
      for (const e of m.enemies ?? []) {
        expect(ENEMIES[e.type], `${id}: enemy type ${e.type}`).toBeTruthy();
        scr(e.onDefeat, `enemy ${e.type} onDefeat`);
        inb(e.x, e.y, `enemy ${e.type}`);
      }
      for (const w of m.warps ?? []) {
        expect(MAPS[w.to], `${id}: warp to ${w.to}`).toBeTruthy();
        scr(w.lockedScript, 'warp locked');
        if (MAPS[w.to]) {
          const tg = parseGrid(MAPS[w.to]);
          expect(w.tx >= 0 && w.tx < tg[0].length && w.ty >= 0 && w.ty < tg.length, `${id}: warp dest ${w.to} ${w.tx},${w.ty} out of bounds`).toBe(true);
        }
      }
      for (const [side, ex] of Object.entries(m.exits ?? {})) {
        if (!ex) continue;
        expect(MAPS[ex.to], `${id}: ${side} exit to ${ex.to}`).toBeTruthy();
        scr(ex.lockedScript, 'exit locked');
      }
      for (const t of m.triggers ?? []) { scr(t.script, `trigger ${t.id}`); inb(t.x, t.y, `trigger ${t.id}`); }
      for (const p of m.pickups ?? []) { expect(ITEMS[p.item], `${id}: pickup item ${p.item}`).toBeTruthy(); inb(p.x, p.y, `pickup ${p.id}`); }
      for (const b of m.barriers ?? []) {
        if (b.character) expect(CHARACTERS[b.character as keyof typeof CHARACTERS], `${id}: gate character ${b.character}`).toBeTruthy();
        inb(b.x, b.y, `gate ${b.id}`);
      }
      for (const o of m.objects ?? []) {
        inb(o.x, o.y, `object ${o.type}`);
        if (o.type === 'flight') expect(MAPS[o.to], `${id}: flight to ${o.to}`).toBeTruthy();
        if (o.type === 'chest' || (o.type === 'breakable' && o.item)) expect(ITEMS[o.item as string], `${id}: object item ${o.item}`).toBeTruthy();
      }
      for (const p of m.props ?? []) {
        const kind = Array.isArray(p) ? p[0] : p.kind;
        expect(() => propArt(kind), `${id}: prop ${kind}`).not.toThrow();
      }
    });
  }

  it('enemies reference valid sprites, scripts and minions', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(sprite(e.sprite), `enemy ${e.id} sprite ${e.sprite}`).toBe(true);
      if (e.boss?.minion) expect(ENEMIES[e.boss.minion], `enemy ${e.id} minion`).toBeTruthy();
      for (const ph of e.boss?.phases ?? []) if (ph.onStart) expect(SCRIPTS[ph.onStart], `enemy ${e.id} phase script ${ph.onStart}`).toBeTruthy();
      expect(e.end, `enemy ${e.id} END must stay below 124`).toBeLessThan(124);
    }
  });

  it('landing spots and quests are consistent', () => {
    for (const s of Object.values(SPOTS)) expect(MAPS[s.map], `spot ${s.id} map ${s.map}`).toBeTruthy();
    for (const q of Object.values(QUESTS)) if (q.region) expect(SPOTS[q.region], `quest ${q.id} region ${q.region}`).toBeTruthy();
  });

  it('forms and techniques reference valid data', () => {
    for (const f of Object.values(FORMS)) if (f.sprite) expect(sprite(f.sprite), `form ${f.id} sprite ${f.sprite}`).toBe(true);
    for (const c of Object.values(CHARACTERS)) {
      expect(sprite(c.sprite), `char ${c.id}`).toBe(true);
      for (const s of Object.values(c.formSprites)) expect(sprite(s), `char ${c.id} form sprite ${s}`).toBe(true);
    }
    expect(Object.keys(TECHNIQUES).length).toBeGreaterThan(5);
  });
});
