import { PAL } from '../art/color';
import { CHARACTERS, type CharId } from '../content/characters';
import { MAPS } from '../content/registry';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W, TILE } from '../engine/constants';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import type { MapDef } from '../game/mapdef';

interface Block {
  def: MapDef;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Lay out a region by walking edge exits from a starting map (positions in tiles). */
export function layoutRegion(start: MapDef): Block[] {
  const region = start.region ?? start.id;
  const out = new Map<string, Block>();
  const q: Block[] = [{ def: start, x: 0, y: 0, w: start.grid[0].length, h: start.grid.length }];
  out.set(start.id, q[0]);
  while (q.length) {
    const b = q.shift() as Block;
    for (const [side, ex] of Object.entries(b.def.exits ?? {})) {
      if (!ex) continue;
      const d = MAPS[ex.to];
      if (!d || out.has(d.id) || (d.region ?? d.id) !== region) continue;
      const w = d.grid[0].length;
      const h = d.grid.length;
      const o = ex.offset ?? 0;
      let x = b.x;
      let y = b.y;
      if (side === 'north') { x = b.x - o; y = b.y - h; }
      if (side === 'south') { x = b.x - o; y = b.y + b.h; }
      if (side === 'west') { x = b.x - w; y = b.y - o; }
      if (side === 'east') { x = b.x + b.w; y = b.y - o; }
      const nb = { def: d, x, y, w, h };
      out.set(d.id, nb);
      q.push(nb);
    }
  }
  return [...out.values()];
}

/** R: regional map of the current area (LoG2 §8.6). */
export class RegionMapScene implements Scene {
  readonly transparent = true;
  readonly done: Promise<void>;
  private resolve!: () => void;
  private t = 0;
  private readonly blocks: Block[];

  constructor(private readonly game: Game) {
    this.done = new Promise((r) => (this.resolve = r));
    const f = game.field;
    this.blocks = f ? layoutRegion(f.def) : [];
    audio.sfx('menuOk');
  }

  update(input: Input): void {
    this.t++;
    if (input.pressed('B') || input.pressed('R') || input.pressed('start')) { audio.sfx('menuBack'); this.resolve(); }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.game.field;
    ctx.fillStyle = 'rgba(4,8,20,0.92)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (!f || !this.blocks.length) return;
    const st = this.game.state;
    const visited = new Set(st.data.visited);
    const showAll = st.flag('scouterPlus');
    const shown = this.blocks.filter((b) => visited.has(b.def.id) || showAll);
    const minX = Math.min(...shown.map((b) => b.x));
    const minY = Math.min(...shown.map((b) => b.y));
    const maxX = Math.max(...shown.map((b) => b.x + b.w));
    const maxY = Math.max(...shown.map((b) => b.y + b.h));
    const scale = Math.min((SCREEN_W - 20) / (maxX - minX), (SCREEN_H - 36) / (maxY - minY), 3);
    const ox = Math.round((SCREEN_W - (maxX - minX) * scale) / 2 - minX * scale);
    const oy = Math.round(20 + (SCREEN_H - 36 - (maxY - minY) * scale) / 2 - minY * scale);
    const P = (tx: number, ty: number) => [Math.round(ox + tx * scale), Math.round(oy + ty * scale)] as const;
    font.drawCentered(ctx, (f.def.region ?? f.def.name).toUpperCase(), SCREEN_W / 2, 4, PAL.gold, '#000');

    for (const b of shown) {
      const [x, y] = P(b.x, b.y);
      const w = Math.max(2, Math.round(b.w * scale));
      const h = Math.max(2, Math.round(b.h * scale));
      ctx.fillStyle = visited.has(b.def.id) ? '#3c9848' : '#505860';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = visited.has(b.def.id) ? '#58b860' : '#687078';
      ctx.fillRect(x, y, w, 1);
      ctx.strokeStyle = '#102010';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      // Transitions.
      for (const [side, ex] of Object.entries(b.def.exits ?? {})) {
        if (!ex) continue;
        ctx.fillStyle = '#a8f8a0';
        if (side === 'north') ctx.fillRect(x + w / 2 - 2, y, 4, 2);
        if (side === 'south') ctx.fillRect(x + w / 2 - 2, y + h - 2, 4, 2);
        if (side === 'west') ctx.fillRect(x, y + h / 2 - 2, 2, 4);
        if (side === 'east') ctx.fillRect(x + w - 2, y + h / 2 - 2, 2, 4);
      }
      // Objects.
      for (const o of b.def.objects ?? []) {
        const [px, py] = P(b.x + o.x, b.y + o.y);
        if (o.type === 'save') { ctx.fillStyle = '#4080f8'; ctx.beginPath(); ctx.arc(px + 1, py + 1, 2, 0, Math.PI * 2); ctx.fill(); }
        if (o.type === 'worldSign') { ctx.fillStyle = '#a06030'; ctx.fillRect(px, py, 3, 3); }
        if (o.type === 'flight') { ctx.fillStyle = '#f8c040'; ctx.beginPath(); ctx.arc(px + 1, py + 1, 2, 0, Math.PI * 2); ctx.fill(); }
      }
      for (const g of b.def.barriers ?? []) {
        if (st.flag(`gate:${b.def.id}:${g.id}`)) continue;
        const [px, py] = P(b.x + g.x, b.y + g.y);
        ctx.fillStyle = g.character ? CHARACTERS[g.character as CharId]?.color ?? '#fff' : '#f0f0f0';
        ctx.fillRect(px, py, Math.max(2, g.w * scale), Math.max(2, g.h * scale));
      }
      if (st.count('dragonRadar') > 0) {
        for (const pk of b.def.pickups ?? []) {
          if (!/^db\d$/.test(pk.item) || st.flag(`pickup:${pk.id}`)) continue;
          const [px, py] = P(b.x + pk.x, b.y + pk.y);
          ctx.fillStyle = this.t % 20 < 10 ? '#f89820' : '#f8e060';
          ctx.beginPath(); ctx.arc(px + 1, py + 1, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // Player.
    const cur = this.blocks.find((b) => b.def.id === f.def.id);
    if (cur && this.t % 30 < 20) {
      const [px, py] = P(cur.x + f.player.x / TILE, cur.y + f.player.y / TILE);
      ctx.fillStyle = '#f83030';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    font.drawCentered(ctx, `${f.def.name}  -  B: close`, SCREEN_W / 2, SCREEN_H - 11, '#a0a8c8', '#000');
  }
}
