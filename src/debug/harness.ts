import type { Button, Input } from '../engine/input';
import type { Game } from '../game/game';

/** Browser-console play-test helpers: window.__t.tap('A'), hold('right', 500), info(). */
export function installHarness(game: Game, input: Input): void {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const api = {
    sleep,
    async tap(btn: Button, n = 1, gap = 150): Promise<void> {
      for (let i = 0; i < n; i++) { input.inject(btn, true); await sleep(70); input.inject(btn, false); await sleep(gap); }
    },
    async hold(btn: Button, ms: number): Promise<void> {
      input.inject(btn, true); await sleep(ms); input.inject(btn, false); await sleep(60);
    },
    /** Advance any open dialogue boxes / choices by tapping A until none are open (max n taps). */
    async skip(n = 30): Promise<number> {
      let i = 0;
      while (i < n && game.scenes.size > 1 && /Dialogue|Choice|TitleCard/.test(game.scenes.top?.constructor.name ?? '')) {
        await api.tap('A', 1, 120); i++;
      }
      return i;
    },
    info(): Record<string, unknown> {
      const f = game.field;
      return {
        top: game.scenes.top?.constructor.name, stack: game.scenes.size, lock: game.lockDepth, allow: game.allowControl,
        map: f?.def.id, px: f && Math.round(f.player.x / 16 * 10) / 10, py: f && Math.round(f.player.y / 16 * 10) / 10,
        hero: game.state.data.active, lv: game.state.hero.level, hp: `${game.state.hero.hp}/${game.state.hero.hpMax}`, ep: `${game.state.hero.ep}/${game.state.hero.epMax}`,
        exp: game.state.hero.exp, chapter: game.state.data.chapter,
        enemies: f?.enemies.map((e) => `${e.def.id}:${e.hp}`).join(' '),
      };
    },
    /** Put the hero next to an NPC facing it. */
    faceNpc(id: string): boolean {
      const f = game.field;
      const n = f?.npcs.find((x) => x.def.id === id);
      if (!f || !n) return false;
      f.player.x = n.x; f.player.y = n.y + 16; f.player.dir = 'up';
      return true;
    },
    /** Teleport hero to a tile. */
    tp(x: number, y: number): void {
      const f = game.field;
      if (!f) return;
      f.player.x = x * 16 + 8; f.player.y = y * 16 + 14;
    },
  };
  (window as unknown as Record<string, unknown>).__t = api;
}
