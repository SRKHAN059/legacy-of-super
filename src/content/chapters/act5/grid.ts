/**
 * Tiny terrain painter for authoring act 5 maps: start from a fill character, then paint
 * rectangles, ellipses and thick lines (paths, rivers) so every row is guaranteed the same width.
 */
export class GridPainter {
  private readonly cells: string[][];

  constructor(readonly w: number, readonly h: number, fill: string) {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }

  /** Set one cell (ignored when out of bounds). */
  set(ch: string, x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ch;
    return this;
  }

  /** Read one cell. */
  get(x: number, y: number): string | undefined {
    return this.cells[y]?.[x];
  }

  /** Fill a rectangle. */
  rect(ch: string, x: number, y: number, w: number, h: number): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(ch, xx, yy);
    return this;
  }

  /** Fill an ellipse centred on (cx, cy) with radii rx, ry. */
  ellipse(ch: string, cx: number, cy: number, rx: number, ry: number): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5);
        const dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(ch, x, y);
      }
    }
    return this;
  }

  /**
   * Thick polyline through the given points (paths, rivers). `over` maps existing cells to a different
   * output, e.g. `{ '~': 'w' }` turns a path into a wooden bridge where it crosses water.
   */
  line(ch: string, pts: Array<[number, number]>, width = 1, over: Record<string, string> = {}): this {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps);
        const y = Math.round(y0 + ((y1 - y0) * s) / steps);
        const r0 = -Math.floor((width - 1) / 2);
        for (let oy = r0; oy < r0 + width; oy++) {
          for (let ox = r0; ox < r0 + width; ox++) {
            const cur = this.get(x + ox, y + oy);
            this.set(cur !== undefined && over[cur] ? over[cur] : ch, x + ox, y + oy);
          }
        }
      }
    }
    return this;
  }

  /** Solid border of `t` cells on every side. */
  border(ch: string, t = 1): this {
    this.rect(ch, 0, 0, this.w, t).rect(ch, 0, this.h - t, this.w, t);
    this.rect(ch, 0, 0, t, this.h).rect(ch, this.w - t, 0, t, this.h);
    return this;
  }

  /** Replace every `from` cell inside a rectangle with `to`. */
  replace(from: string, to: string, x = 0, y = 0, w = this.w, h = this.h): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.get(xx, yy) === from) this.set(to, xx, yy);
    return this;
  }

  /** The finished grid rows. */
  rows(): string[] {
    return this.cells.map((r) => r.join(''));
  }
}

/** Solid-footprint tiles (offsets from the prop's top-left tile) for common outdoor props. */
const FOOTPRINT: Record<string, Array<[number, number]>> = {
  tree: [[0, 2], [1, 2]],
  palm: [[0, 2], [1, 2]],
  alienTree: [[0, 2], [1, 2]],
  pine: [[0, 1], [0, 2]],
  deadTree: [[0, 1], [0, 2], [1, 2]],
  bush: [[0, 0], [1, 0]],
  rock: [[0, 0], [1, 0]],
  boulder: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  cactus: [[0, 1]],
  flowers: [[0, 0]],
  grassTuft: [[0, 0]],
  smallRock: [[0, 0]],
};

/**
 * Keep only the prop placements whose footprint lies entirely on terrain chars in `ok`,
 * so scattered trees never block a painted path, river crossing or clearing.
 */
export function propsOn(g: GridPainter, ok: string, list: Array<[string, number, number]>): Array<[string, number, number]> {
  return list.filter(([kind, x, y]) => (FOOTPRINT[kind] ?? [[0, 0]]).every(([dx, dy]) => {
    const c = g.get(x + dx, y + dy);
    return c !== undefined && ok.includes(c);
  }));
}
