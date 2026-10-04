import { TILE } from '../engine/constants';
import type { Rect } from '../engine/math';

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
   * nudging so the player slides around corners like in classic top-down games.
   * Returns the resolved delta.
   */
  move(box: Rect, dx: number, dy: number, flying = false): { dx: number; dy: number; hitX: boolean; hitY: boolean } {
    let hitX = false;
    let hitY = false;
    let rx = 0;
    let ry = 0;
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
        if (dy === 0) {
          for (const n of [1, -1]) {
            if (tryAxis(0, n * 1) && this.clearAhead(box, rx + step, ry + n * 4, flying)) { ry += n; break; }
          }
        }
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
        if (dx === 0) {
          for (const n of [1, -1]) {
            if (tryAxis(n * 1, 0) && this.clearAhead(box, rx + n * 4, ry + step, flying)) { rx += n; break; }
          }
        }
        hitY = true;
        break;
      }
      remY -= 1;
    }
    return { dx: rx, dy: ry, hitX, hitY };
  }

  private clearAhead(box: Rect, ox: number, oy: number, flying: boolean): boolean {
    return !this.blocked({ x: box.x + ox, y: box.y + oy, w: box.w, h: box.h }, flying);
  }
}
