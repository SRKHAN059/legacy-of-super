import { shade } from '../art/color';
import type { Dir, Rect } from '../engine/math';
import { dirVec } from '../engine/math';
import type { CollisionMap } from './collision';

export type ShotKind = 'shot' | 'stun' | 'wave' | 'ball' | 'arc' | 'rocket';

/** A ki projectile. `x,y` is the ground point beneath it; `lift` is its draw height. */
export class Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  lift = 14;
  life: number;
  dead = false;
  /** Enemies already hit (piercing shots). */
  hit = new Set<object>();
  pierce = false;
  /** Explosion radius on impact (0 = none). */
  boom = 0;
  /** Stun frames applied on hit. */
  stun = 0;
  /** Arc shots: travel progress. */
  arcT = 0;
  arcDur = 0;
  tx = 0;
  ty = 0;
  sx = 0;
  sy = 0;
  /** Charged ball growth factor 1..3 for visuals. */
  size = 1;
  /** Absorbable by ki-absorbing bosses. */
  ki = true;

  constructor(
    public readonly owner: 'player' | 'enemy',
    public readonly kind: ShotKind,
    x: number,
    y: number,
    dir: { x: number; y: number },
    speed: number,
    public readonly mult: number,
    public readonly color: string,
    /** Attacker's POW and level at fire time. */
    public readonly atk: number,
    public readonly level: number,
  ) {
    this.x = x;
    this.y = y;
    this.vx = dir.x * speed;
    this.vy = dir.y * speed;
    this.r = kind === 'ball' ? 6 : kind === 'wave' ? 6 : 3;
    this.life = kind === 'wave' ? 70 : 90;
  }

  /** Configure as a lobbed arc toward a target point. */
  lob(tx: number, ty: number, frames: number): void {
    this.sx = this.x;
    this.sy = this.y;
    this.tx = tx;
    this.ty = ty;
    this.arcDur = frames;
    this.arcT = 0;
    this.life = frames + 2;
  }

  /** Hit box at body height. */
  rect(): Rect {
    return { x: this.x - this.r, y: this.y - this.lift - this.r, w: this.r * 2, h: this.r * 2 };
  }

  /** Advance; returns 'wall' when it struck terrain, 'land' when an arc landed. */
  update(col: CollisionMap): 'wall' | 'land' | null {
    this.life--;
    if (this.life <= 0) { this.dead = true; return this.kind === 'arc' ? 'land' : null; }
    if (this.arcDur > 0) {
      this.arcT++;
      const k = this.arcT / this.arcDur;
      this.x = this.sx + (this.tx - this.sx) * k;
      this.y = this.sy + (this.ty - this.sy) * k;
      this.lift = 10 + Math.sin(k * Math.PI) * 30;
      if (this.arcT >= this.arcDur) { this.dead = true; return 'land'; }
      return null;
    }
    this.x += this.vx;
    this.y += this.vy;
    if (col.blocked({ x: this.x - 2, y: this.y - 2, w: 4, h: 4 }, true)) {
      this.dead = true;
      return 'wall';
    }
    return null;
  }

  render(ctx: CanvasRenderingContext2D, cx: number, cy: number, tick: number): void {
    const x = Math.round(this.x - cx);
    const y = Math.round(this.y - this.lift - cy);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(Math.round(this.x - cx) - 2, Math.round(this.y - cy) - 1, 4, 2);
    switch (this.kind) {
      case 'shot':
      case 'stun': {
        const trail = shade(this.color, 0.75);
        ctx.fillStyle = trail;
        ctx.fillRect(Math.round(x - this.vx * 2) - 2, Math.round(y - this.vy * 2) - 2, 4, 4);
        ctx.fillStyle = this.color;
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y - 1, 2, 2);
        if (this.kind === 'stun' && tick % 4 < 2) { ctx.fillStyle = '#fff8a0'; ctx.fillRect(x - 4, y, 8, 1); ctx.fillRect(x, y - 4, 1, 8); }
        break;
      }
      case 'rocket': {
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(x - 3, y - 2, 6, 4);
        ctx.fillStyle = '#f08020';
        ctx.fillRect(Math.round(x - this.vx * 2) - 1, Math.round(y - this.vy * 2) - 1, 3, 3);
        break;
      }
      case 'wave': {
        ctx.fillStyle = this.color;
        const horiz = Math.abs(this.vx) > Math.abs(this.vy);
        if (horiz) { ctx.fillRect(x - 2, y - 8, 4, 16); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 6, 2, 12); }
        else { ctx.fillRect(x - 8, y - 2, 16, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6, y - 1, 12, 2); }
        break;
      }
      case 'ball':
      case 'arc': {
        const r = Math.round(this.r * (this.kind === 'ball' ? 1 : 0.8)) + (tick % 6 < 3 ? 1 : 0);
        ctx.fillStyle = shade(this.color, 0.7);
        ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x - 1, y - 1, Math.max(1, r * 0.45), 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
  }
}

/** A sustained beam from an origin in a facing direction. */
export class Beam {
  len = 0;
  /** Ticks since the beam started. */
  t = 0;
  dead = false;
  /** For enemy beams: remaining life; player beams live while B is held. */
  life = 0;
  /** Telegraph frames before damage (enemy beams). */
  warn = 0;

  constructor(
    public readonly owner: 'player' | 'enemy',
    public ox: number,
    public oy: number,
    public dir: Dir,
    public readonly width: number,
    public readonly color: string,
    public readonly mult: number,
    public readonly pierce: boolean,
    public atk: number,
    public level: number,
    public readonly maxLen = 220,
  ) {}

  /** Recompute length by marching until terrain (beams fly over water). */
  trace(col: CollisionMap): void {
    const v = dirVec(this.dir);
    let l = 0;
    while (l < this.maxLen) {
      l += 4;
      if (col.blocked({ x: this.ox + v.x * l - 1, y: this.oy + v.y * l - 1, w: 2, h: 2 }, true)) break;
    }
    this.len = l;
  }

  /** Damage rectangle at body height (ground y is oy; we treat the beam as a ground-aligned band). */
  rect(): Rect {
    const v = dirVec(this.dir);
    const half = this.width / 2;
    if (v.x !== 0) {
      const x0 = v.x > 0 ? this.ox : this.ox - this.len;
      return { x: x0, y: this.oy - 20 - half, w: this.len, h: this.width + 20 };
    }
    const y0 = v.y > 0 ? this.oy : this.oy - this.len;
    return { x: this.ox - half - 4, y: y0 - 16, w: this.width + 8, h: this.len + 16 };
  }

  render(ctx: CanvasRenderingContext2D, cx: number, cy: number, tick: number): void {
    const v = dirVec(this.dir);
    const lift = 14;
    const x = Math.round(this.ox - cx);
    const y = Math.round(this.oy - lift - cy);
    const wob = tick % 4 < 2 ? 1 : 0;
    const w = this.warn > 0 ? 2 : this.width + wob;
    const outer = shade(this.color, 0.75);
    const draw = (col: string, ww: number) => {
      ctx.fillStyle = col;
      const h = Math.max(1, Math.round(ww));
      if (v.x !== 0) {
        const x0 = v.x > 0 ? x : x - this.len;
        ctx.fillRect(x0, y - Math.floor(h / 2), this.len, h);
      } else {
        const y0 = v.y > 0 ? y : y - this.len;
        ctx.fillRect(x - Math.floor(h / 2), y0, h, this.len);
      }
    };
    if (this.warn > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tick * 0.6);
      draw(this.color, 2);
      ctx.globalAlpha = 1;
      return;
    }
    draw(outer, w + 2);
    draw(this.color, w);
    draw('#ffffff', Math.max(1, w * 0.4));
    // Muzzle and tip glows.
    const tipX = x + v.x * this.len;
    const tipY = y + v.y * this.len;
    for (const [px, py, r] of [[x, y, this.width * 0.8], [tipX, tipY, this.width * 0.9 + wob]] as Array<[number, number, number]>) {
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
