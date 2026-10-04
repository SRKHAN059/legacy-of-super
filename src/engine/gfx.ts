import { GLYPHS, GLYPH_H, GLYPH_SPACING, LINE_H, measure } from './fontdata';

/** An offscreen bitmap used as a sprite or atlas. */
export type Bitmap = HTMLCanvasElement;

/** Create an offscreen canvas with nearest-neighbour drawing. */
export function makeBitmap(w: number, h: number): { bmp: Bitmap; ctx: CanvasRenderingContext2D } {
  const bmp = document.createElement('canvas');
  bmp.width = w;
  bmp.height = h;
  const ctx = bmp.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  return { bmp, ctx };
}

const rgbCache = new Map<string, [number, number, number]>();

/** Parse '#rrggbb' or '#rgb' into [r, g, b]. Memoised; procedural art calls this per pixel. */
export function hexRgb(hex: string): [number, number, number] {
  const hit = rgbCache.get(hex);
  if (hit) return hit;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, rgb);
  return rgb;
}

/** Quantise a colour to GBA BGR555 precision so the palette feels authentic. */
export function gbaColor(hex: string): string {
  const [r, g, b] = hexRgb(hex).map((c) => Math.round((c >> 3) * 255 / 31));
  return `rgb(${r},${g},${b})`;
}

/**
 * Build a bitmap from palette-indexed rows. '.' and ' ' are transparent; every other
 * character is looked up in `pal`.
 */
export function pixmap(rows: readonly string[], pal: Readonly<Record<string, string>>): Bitmap {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const { bmp, ctx } = makeBitmap(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.' || c === ' ') continue;
      const col = pal[c];
      if (!col) continue;
      const [r, g, b] = hexRgb(col);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return bmp;
}

/** Horizontally mirrored copy of a bitmap. */
export function flipX(src: Bitmap): Bitmap {
  const { bmp, ctx } = makeBitmap(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return bmp;
}

/** Copy of a bitmap with every opaque pixel replaced by a flat colour (hit flashes, silhouettes). */
export function tint(src: Bitmap, color: string): Bitmap {
  const { bmp, ctx } = makeBitmap(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, src.width, src.height);
  return bmp;
}

/** Copy of a bitmap with a 1px outline drawn around opaque pixels. Output grows by 2px each axis. */
export function outline(src: Bitmap, color: string): Bitmap {
  const w = src.width + 2;
  const h = src.height + 2;
  const sctx = src.getContext('2d');
  if (!sctx) throw new Error('2D canvas context unavailable');
  const sd = sctx.getImageData(0, 0, src.width, src.height).data;
  const { bmp, ctx } = makeBitmap(w, h);
  const out = ctx.createImageData(w, h);
  const [r, g, b] = hexRgb(color);
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < src.width && y < src.height && sd[(y * src.width + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - 1;
      const sy = y - 1;
      const i = (y * w + x) * 4;
      if (opaque(sx, sy)) {
        const j = (sy * src.width + sx) * 4;
        out.data[i] = sd[j]; out.data[i + 1] = sd[j + 1]; out.data[i + 2] = sd[j + 2]; out.data[i + 3] = 255;
      } else if (opaque(sx - 1, sy) || opaque(sx + 1, sy) || opaque(sx, sy - 1) || opaque(sx, sy + 1)) {
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return bmp;
}

/**
 * Direct pixel painter for procedural art. Writes into an ImageData buffer and
 * flushes once, which is far faster than fillRect per pixel.
 */
export class Painter {
  readonly w: number;
  readonly h: number;
  private readonly data: Uint8ClampedArray;
  private readonly img: ImageData;
  private readonly ctx: CanvasRenderingContext2D;
  readonly bmp: Bitmap;

  constructor(w: number, h: number) {
    const { bmp, ctx } = makeBitmap(w, h);
    this.w = w;
    this.h = h;
    this.bmp = bmp;
    this.ctx = ctx;
    this.img = ctx.createImageData(w, h);
    this.data = this.img.data;
  }

  /** Set one pixel. Out-of-bounds writes are ignored. */
  px(x: number, y: number, color: string | null): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (color === null) { this.data[i + 3] = 0; return; }
    const [r, g, b] = hexRgb(color);
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
  }

  /** True when the pixel is opaque. */
  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.data[(y * this.w + x) * 4 + 3] > 0;
  }

  /** Filled rectangle. */
  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color);
  }

  /** Horizontal run. */
  hline(x: number, y: number, len: number, color: string): void {
    for (let i = 0; i < len; i++) this.px(x + i, y, color);
  }

  /** Vertical run. */
  vline(x: number, y: number, len: number, color: string): void {
    for (let j = 0; j < len; j++) this.px(x, y + j, color);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Filled ellipse inside the given box. */
  ellipse(x: number, y: number, w: number, h: number, color: string): void {
    const cx = x + w / 2 - 0.5;
    const cy = y + h / 2 - 0.5;
    const rx = w / 2;
    const ry = h / 2;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const dx = (x + i - cx) / rx;
        const dy = (y + j - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) this.px(x + i, y + j, color);
      }
    }
  }

  /** Stamp palette-indexed rows at an offset. */
  rows(x: number, y: number, rows: readonly string[], pal: Readonly<Record<string, string>>): void {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '.' || c === ' ') continue;
        const col = pal[c];
        if (col) this.px(x + i, y + j, col);
      }
    }
  }

  /** Trace a 1px outline around all opaque pixels, in place. */
  outline(color: string): void {
    const src = new Uint8ClampedArray(this.data);
    const op = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3] > 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (op(x, y)) continue;
        if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) this.px(x, y, color);
      }
    }
  }

  /** Deterministic per-pixel noise speckle, for ground textures. */
  speckle(x: number, y: number, w: number, h: number, colors: readonly string[], density: number, seed: number): void {
    let s = seed >>> 0 || 1;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
        if ((s & 0xffff) / 0xffff < density) this.px(x + i, y + j, colors[s % colors.length]);
      }
    }
  }

  /** Write pixels to the bitmap and return it. */
  done(): Bitmap {
    this.ctx.putImageData(this.img, 0, 0);
    return this.bmp;
  }
}

/** Bitmap font renderer with per-colour glyph atlases. */
export class Font {
  private readonly atlases = new Map<string, Bitmap>();
  private readonly offsets = new Map<string, number>();
  private readonly chars: string[];

  constructor() {
    this.chars = Object.keys(GLYPHS);
    let x = 0;
    for (const ch of this.chars) {
      this.offsets.set(ch, x);
      x += GLYPHS[ch][0].length + 1;
    }
  }

  private atlas(color: string): Bitmap {
    const hit = this.atlases.get(color);
    if (hit) return hit;
    const total = this.chars.reduce((a, ch) => a + GLYPHS[ch][0].length + 1, 0);
    const p = new Painter(total, GLYPH_H);
    for (const ch of this.chars) {
      const ox = this.offsets.get(ch) ?? 0;
      const g = GLYPHS[ch];
      for (let y = 0; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) if (g[y][x] === '#') p.px(ox + x, y, color);
      }
    }
    const bmp = p.done();
    this.atlases.set(color, bmp);
    return bmp;
  }

  /** Draw one line of text. Optional drop shadow one pixel down-right. */
  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, shadow?: string): void {
    if (shadow) this.drawRaw(ctx, text, x + 1, y + 1, shadow);
    this.drawRaw(ctx, text, x, y, color);
  }

  /** Pixel width of a string. */
  drawWidth(text: string): number {
    return measure(text);
  }

  /** Draw text centred horizontally on `cx`. */
  drawCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, shadow?: string): void {
    this.draw(ctx, text, Math.round(cx - measure(text) / 2), y, color, shadow);
  }

  /** Draw text right-aligned to `rx`. */
  drawRight(ctx: CanvasRenderingContext2D, text: string, rx: number, y: number, color: string, shadow?: string): void {
    this.draw(ctx, text, rx - measure(text), y, color, shadow);
  }

  /** Draw multiple lines. */
  drawLines(ctx: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, color: string, shadow?: string, lineH = LINE_H): void {
    lines.forEach((l, i) => this.draw(ctx, l, x, y + i * lineH, color, shadow));
  }

  private drawRaw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
    const atlas = this.atlas(color);
    let cx = x | 0;
    for (const raw of text) {
      const ch = GLYPHS[raw] ? raw : '?';
      const w = GLYPHS[ch][0].length;
      const ox = this.offsets.get(ch) ?? 0;
      ctx.drawImage(atlas, ox, 0, w, GLYPH_H, cx, y | 0, w, GLYPH_H);
      cx += w + GLYPH_SPACING;
    }
  }
}

/** Shared font instance. */
export const font = new Font();
