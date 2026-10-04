import { PAL } from '../art/color';
import { portrait } from '../art/registry';
import { CAST_NAMES } from '../content/cast';
import { scanNpc } from '../content/scans';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { wrap } from '../engine/fontdata';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import { clamp, overlaps } from '../engine/math';
import type { Scene } from '../engine/scene';
import type { Actor } from '../game/actor';
import { Enemy } from '../game/enemy';
import type { Game } from '../game/game';
import { Npc } from '../game/npc';

interface Readout {
  id: string;
  name: string;
  hp: number | string;
  str: number | string;
  pow: number | string;
  end: number | string;
  /** Race / universe / affiliation line (named entries only). */
  kind: string;
  desc: string;
  actor: Actor;
}

/** SELECT: freeze the world, move a cursor, scan creatures/NPCs (LoG2 §8.5). */
export class ScouterScene implements Scene {
  readonly transparent = true;
  readonly done: Promise<void>;
  private resolve!: () => void;
  private cx: number;
  private cy: number;
  private t = 0;
  private readout: Readout | null = null;

  constructor(private readonly game: Game) {
    this.done = new Promise((r) => (this.resolve = r));
    const f = game.field;
    this.cx = f ? f.player.x - f.camera.x + 16 : SCREEN_W / 2;
    this.cy = f ? f.player.y - f.camera.y - 12 : SCREEN_H / 2;
    audio.sfx('teleport');
  }

  private target(): Actor | null {
    const f = this.game.field;
    if (!f) return null;
    const r = { x: this.cx + f.camera.x - 3, y: this.cy + f.camera.y - 3, w: 6, h: 6 };
    for (const e of f.enemies) if (!e.dead && overlaps(r, e.body())) return e;
    for (const n of f.npcs) if (!n.hidden && overlaps(r, n.body())) return n;
    return null;
  }

  private scan(a: Actor): Readout {
    if (a instanceof Enemy) {
      const d = a.def;
      return { id: `enemy:${d.id}`, name: d.name, hp: a.maxHp, str: d.str, pow: d.pow, end: d.end, kind: '', desc: d.desc, actor: a };
    }
    const n = a as Npc;
    const r = scanNpc(n.spriteId, n.def.id);
    const e = r.entry;
    const name = n.def.name || CAST_NAMES[n.spriteId] || e.name;
    return { id: r.id, name, hp: e.hp, str: e.str, pow: e.pow, end: e.end, kind: e.kind ?? '', desc: e.desc, actor: a };
  }

  update(input: Input): void {
    this.t++;
    if (this.readout) {
      if (input.pressed('A') || input.pressed('B')) { this.readout = null; audio.sfx('menuBack'); }
      return;
    }
    if (input.pressed('B') || input.pressed('select')) { audio.sfx('menuBack'); this.resolve(); return; }
    const sp = 2;
    if (input.isDown('left')) this.cx -= sp;
    if (input.isDown('right')) this.cx += sp;
    if (input.isDown('up')) this.cy -= sp;
    if (input.isDown('down')) this.cy += sp;
    this.cx = clamp(this.cx, 4, SCREEN_W - 4);
    this.cy = clamp(this.cy, 4, SCREEN_H - 4);
    if (input.pressed('A')) {
      const t = this.target();
      if (!t) { audio.sfx('denied'); return; }
      this.readout = this.scan(t);
      const scans = this.game.state.data.scans;
      if (!scans.includes(this.readout.id)) scans.push(this.readout.id);
      audio.sfx('menuOk');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Green scouter tint over the frozen field.
    ctx.fillStyle = 'rgba(40,200,80,0.18)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (let y = 0; y < SCREEN_H; y += 3) { ctx.fillStyle = 'rgba(0,40,0,0.15)'; ctx.fillRect(0, y, SCREEN_W, 1); }
    if (this.readout) { this.renderReadout(ctx, this.readout); return; }
    const tgt = this.target();
    const c = tgt ? '#f8f040' : '#60f080';
    const x = Math.round(this.cx);
    const y = Math.round(this.cy);
    ctx.fillStyle = c;
    ctx.fillRect(x - 8, y, 5, 1); ctx.fillRect(x + 4, y, 5, 1);
    ctx.fillRect(x, y - 8, 1, 5); ctx.fillRect(x, y + 4, 1, 5);
    if (this.t % 20 < 10) { ctx.strokeStyle = c; ctx.strokeRect(x - 5.5, y - 5.5, 12, 12); }
    font.draw(ctx, 'SCOUTER  A: scan  B: exit', 4, SCREEN_H - 11, '#80f8a0', '#002000');
    if (tgt) {
      const name = tgt instanceof Enemy ? tgt.def.name : (tgt as Npc).def.name || CAST_NAMES[tgt.spriteId] || '?';
      font.draw(ctx, name, x + 10, y - 10, '#f8f040', '#000');
    }
  }

  private renderReadout(ctx: CanvasRenderingContext2D, r: Readout): void {
    ctx.fillStyle = '#041808';
    ctx.fillRect(8, 8, SCREEN_W - 16, SCREEN_H - 16);
    ctx.strokeStyle = '#40f070';
    ctx.strokeRect(8.5, 8.5, SCREEN_W - 17, SCREEN_H - 17);
    // Grid floor.
    ctx.fillStyle = '#0c3a18';
    for (let i = 0; i < 9; i++) ctx.fillRect(16 + i * 10, 30, 1, 70);
    for (let i = 0; i < 8; i++) ctx.fillRect(16, 30 + i * 10, 80, 1);
    const frame = r.actor.set.idle[(['down', 'left', 'up', 'right'] as const)[Math.floor(this.t / 30) % 4]];
    ctx.drawImage(frame, 56 - Math.round(frame.width / 2), 94 - frame.height);
    font.draw(ctx, r.name.toUpperCase(), 16, 14, '#80f8a0', '#000');
    const rows: Array<[string, number | string]> = [['HP', r.hp], ['STR', r.str], ['POW', r.pow], ['END', r.end]];
    rows.forEach(([k, v], i) => {
      font.draw(ctx, k, 108, 30 + i * 12, '#40c060', '#000');
      font.drawRight(ctx, String(v), 170, 30 + i * 12, '#c8f8d0', '#000');
    });
    const por = r.actor instanceof Npc ? portrait(r.actor.spriteId) : null;
    if (por) ctx.drawImage(por, 186, 26);
    else { font.drawCentered(ctx, 'NO', 204, 36, '#307040'); font.drawCentered(ctx, 'PORTRAIT', 204, 46, '#307040'); }
    if (r.kind) font.drawLines(ctx, wrap(r.kind, SCREEN_W - 124).slice(0, 2), 108, 80, '#60d880', '#000', 10);
    font.drawLines(ctx, wrap(r.desc, SCREEN_W - 40).slice(0, 4), 16, 104, '#c8f8d0', '#000', 11);
  }
}
