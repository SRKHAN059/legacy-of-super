import { TILE } from '../engine/constants';
import type { Rect } from '../engine/math';

/** Farthest a blocked straight step slides sideways to get around a corner (px). */
const NUDGE = 4;
/** Clearance (px) the assist keeps from the edge it slides past and from anything on its far side. */
const NUDGE_EPS = 1e-6;

/**
 * How a blocked straight step slides around a corner. 'assist', the player's d-pad assist: toward the nearest opening
 * within NUDGE px (`nudge`). 'probe': a 1 px slide when the box NUDGE px over is clear ahead, which misses a lane
 * whose far side is closer than that; enemies and NPCs keep it, as their chase and patrol steering (and the balance
 * of every fight) was tuned with it.
 */
export type CornerSlide = 'assist' | 'probe';

/**
 * Static collision: a tile solidity grid plus arbitrary solid rectangles (props, barriers).
 * DOM-free so movement can be unit tested.
 */
export class CollisionMap {
  readonly cols: number;
  readonly rows: number;
  private readonly solid: Uint8Array;
  /** 1 = liquid (flyable). */
  private readonly liquid: Uint8Array;
  private rects: Array<Rect & { tag?: string }> = [];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.solid = new Uint8Array(cols * rows);
    this.liquid = new Uint8Array(cols * rows);
  }

  /** Mark a tile solid (and whether it is liquid). */
  setTile(tx: number, ty: number, solid: boolean, liquid = false): void {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    this.solid[ty * this.cols + tx] = solid ? 1 : 0;
    this.liquid[ty * this.cols + tx] = liquid ? 1 : 0;
  }

  /** Tile solidity; out of bounds is solid. */
  tileSolid(tx: number, ty: number, flying = false): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    const i = ty * this.cols + tx;
    if (!this.solid[i]) return false;
    return !(flying && this.liquid[i]);
  }

  /** Add a solid rectangle in world pixels. `tag` lets callers remove it later. */
  addRect(r: Rect, tag?: string): void {
    this.rects.push({ ...r, tag });
  }

  /** The solid rectangles (props, objects, gates) in world pixels, for tooling that rasterises the map. */
  solidRects(): ReadonlyArray<Readonly<Rect & { tag?: string }>> {
    return this.rects;
  }

  /** Remove all rects carrying a tag. */
  removeTag(tag: string): void {
    this.rects = this.rects.filter((r) => r.tag !== tag);
  }

  /** True when a world-space box overlaps anything solid. */
  blocked(box: Rect, flying = false): boolean {
    const x0 = Math.floor(box.x / TILE);
    const y0 = Math.floor(box.y / TILE);
    const x1 = Math.floor((box.x + box.w - 0.001) / TILE);
    const y1 = Math.floor((box.y + box.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (this.tileSolid(tx, ty, flying)) return true;
    }
    for (const r of this.rects) {
      if (box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y) return true;
    }
    return false;
  }

  /**
   * Move a box by (dx, dy) one axis at a time, stopping at obstacles, with corner
   * nudging so the player slides around corners like in classic top-down games
   * (straight moves; a diagonal slides on its own). Returns the resolved delta.
   */
  move(
    box: Rect, dx: number, dy: number, flying = false, slide: CornerSlide = 'probe',
  ): { dx: number; dy: number; hitX: boolean; hitY: boolean } {
    let hitX = false;
    let hitY = false;
    let rx = 0;
    let ry = 0;
    const corner = (ax: number, ay: number): number =>
      (slide === 'assist' ? this.nudge(box, rx, ry, ax, ay, flying) : this.probe(box, rx, ry, ax, ay, flying));
    const tryAxis = (ax: number, ay: number): boolean => {
      const nb = { x: box.x + rx + ax, y: box.y + ry + ay, w: box.w, h: box.h };
      return !this.blocked(nb, flying);
    };
    // X axis in 1px steps (speeds are small so this is cheap and exact).
    const sx = Math.sign(dx);
    let remX = Math.abs(dx);
    while (remX > 0) {
      const step = Math.min(1, remX) * sx;
      if (tryAxis(step, 0)) rx += step;
      else {
        // Corner nudge: if blocked only by a corner, slide perpendicular.
        if (dy === 0) ry += corner(step, 0);
        hitX = true;
        break;
      }
      remX -= 1;
    }
    const sy = Math.sign(dy);
    let remY = Math.abs(dy);
    while (remY > 0) {
      const step = Math.min(1, remY) * sy;
      if (tryAxis(0, step)) ry += step;
      else {
        if (dx === 0) rx += corner(0, step);
        hitY = true;
        break;
      }
      remY -= 1;
    }
    return { dx: rx, dy: ry, hitX, hitY };
  }

  /** The probe slide (see CornerSlide) for a blocked step (ax, ay): +-1 px perpendicular, or 0. */
  private probe(box: Rect, ox: number, oy: number, ax: number, ay: number, flying: boolean): number {
    for (const n of [1, -1]) {
      const px = ay !== 0 ? n : 0;
      const py = ax !== 0 ? n : 0;
      const side = { x: box.x + ox + px, y: box.y + oy + py, w: box.w, h: box.h };
      // Same float arithmetic as ever, so enemies and NPCs move bit for bit as before.
      const ahead = { x: box.x + (ox + ax + px * NUDGE), y: box.y + (oy + ay + py * NUDGE), w: box.w, h: box.h };
      if (!this.blocked(side, flying) && !this.blocked(ahead, flying)) return n;
    }
    return 0;
  }

  /**
   * The assist slide (see CornerSlide) for a step (ax, ay) along one axis that is blocked: this frame's perpendicular
   * slide (at most 1 px) toward the nearest offset within NUDGE px at which the step is free, sliding there is free,
   * and nothing else is in the way; 0 when there is none. Only offsets that line the box up with an obstacle edge are
   * candidates (the nearest free offset always does), so a lane barely wider than the box still lets a held direction
   * through: the probe misses a lane whose far side is closer than NUDGE px (Crater Rim's rock beside the cliff, row
   * 5). The box lands a hair past the edge it clears and must stay a hair short of anything on its far side, so float
   * rounding in the caller's position never leaves it overlapping a wall: a lane exactly as wide as the box takes no
   * nudge.
   */
  private nudge(box: Rect, ox: number, oy: number, ax: number, ay: number, flying: boolean): number {
    const alongX = ax !== 0;
    const pos = alongX ? box.y + oy : box.x + ox;
    const size = alongX ? box.h : box.w;
    // Obstacle edges on the perpendicular axis: tile boundaries and the solid rects' sides.
    const edges: number[] = [];
    for (let e = Math.floor((pos - NUDGE) / TILE) * TILE; e <= pos + size + NUDGE; e += TILE) edges.push(e);
    for (const r of this.rects) edges.push(...(alongX ? [r.y, r.y + r.h] : [r.x, r.x + r.w]));
    const offs: number[] = [];
    for (const e of edges) {
      const down = e - pos + NUDGE_EPS;
      if (down > 0 && down <= NUDGE + NUDGE_EPS) offs.push(down);
      const up = e - pos - size - NUDGE_EPS;
      if (up < 0 && up >= -NUDGE - NUDGE_EPS) offs.push(up);
    }
    // Nearest first; on a tie the positive side, as the probe does.
    offs.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
    for (const o of offs) {
      // The slide and the box at its end, each reaching a hair further on the leading side (the slide starts a hair
      // inside the box on the trailing side, which may sit flush against something).
      const lo = o > 0 ? pos + NUDGE_EPS : pos + o - NUDGE_EPS;
      const span = size + Math.abs(o);
      const sweep = alongX ? { x: box.x + ox, y: lo, w: box.w, h: span } : { x: lo, y: box.y + oy, w: span, h: box.h };
      if (this.blocked(sweep, flying)) continue;
      const at = o > 0 ? pos + o : pos + o - NUDGE_EPS;
      const ahead = alongX
        ? { x: box.x + ox + ax, y: at, w: box.w, h: size + NUDGE_EPS }
        : { x: at, y: box.y + oy + ay, w: size + NUDGE_EPS, h: box.h };
      if (this.blocked(ahead, flying)) continue;
      return Math.sign(o) * Math.min(1, Math.abs(o));
    }
    return 0;
  }
}
