// Pure pixel processing for LoG2 sprite-sheet cells: background keying, baked-shadow removal,
// ground alignment, head anchors and the palette-indexed RLE frame codec.
// Shared by build.mjs (Node) and tests/sprites.test.ts; no I/O here.

/** Sheet colours that are never sprite pixels: the two checkerboard greens, the outer background and the empty-cell border. */
export const KEY_COLORS = Object.freeze(['#47ffbb', '#34bc88', '#2a966c', '#237f5a']);

/** Colour of the baked ground shadow in every LoG2 sheet. */
export const SHADOW_COLOR = '#000000';

/** The shadow sits at the bottom of a cell; lowest black row must be at least this far down (in a 32px cell) to count. */
const SHADOW_MIN_BOTTOM = 27;
/**
 * Shadow fragments reach at most this many rows above the shadow's lowest row (the ellipse itself
 * is 4-6 rows; a fragment seen between the legs of a back-facing stance can start 7 rows up).
 */
const SHADOW_BAND = 8;
/** The ellipse's own rows (counted up from the shadow's lowest row), where black under the body is ground. */
const GROUND_ROWS = 4;
/** Colours whose every channel is at least this bright are effects (white swooshes), not outlined body. */
const NEAR_WHITE = 214;

/** '#rrggbb' for an RGB triple. */
export function hexOf(r, g, b) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Cut one w×h cell out of an RGBA image into a colour grid (hex string per pixel, null = transparent).
 * Key colours and fully transparent pixels become null.
 * @param {{ width: number, height: number, data: Uint8Array }} img
 * @returns {(string | null)[]} row-major, w*h
 */
export function sliceCell(img, x0, y0, w, h = w) {
  const keys = new Set(KEY_COLORS);
  const out = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const i = (sy * img.width + sx) * 4;
      if (img.data[i + 3] < 128) continue;
      const hex = hexOf(img.data[i], img.data[i + 1], img.data[i + 2]);
      if (!keys.has(hex)) out[y * w + x] = hex;
    }
  }
  return out;
}

/**
 * Place a w×h cell in a size×size frame, centred horizontally and standing on the bottom row
 * (16×32 NPC cells and 32×16 creature cells become ordinary 32×32 frames).
 */
export function embedCell(cell, w, h, size) {
  if (w === size && h === size) return cell.slice();
  if (w > size || h > size) throw new Error(`cell ${w}x${h} does not fit a ${size}px frame`);
  const ox = Math.floor((size - w) / 2);
  const oy = size - h;
  const out = new Array(size * size).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(oy + y) * size + ox + x] = cell[y * w + x];
  return out;
}

/** Connected components (4- or 8-connected) of the pixels matching `pred`; each is a list of pixel indices. */
function components(size, pred, eight) {
  const seen = new Uint8Array(size * size);
  const comps = [];
  for (let start = 0; start < size * size; start++) {
    if (seen[start] || !pred(start)) continue;
    const comp = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      comp.push(p);
      const px = p % size;
      const py = (p - px) / size;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!eight && dx && dy) continue;
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const n = ny * size + nx;
          if (!seen[n] && pred(n)) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Find the baked ground-shadow pixels of a cell.
 *
 * LoG2 composites a pure-black ellipse under each character's feet, and the character is drawn
 * over it, so the shadow shows up as black fragments in a band of up to nine rows at the bottom of
 * the cell (between and around the feet). Black hair, eyes and shoes also use pure black, so a
 * black fragment only counts as shadow when its whole 4-connected component lies inside the
 * bottom band (hair reaching down from the head, e.g. a knocked-out character lying on the ground, is
 * connected to pixels above the band and survives), and when it touches a transparent pixel (the
 * ellipse is wider than the feet, so visible pieces of it border the background) or reaches the
 * shadow's bottom rows (pieces boxed in by feet and white attack trails). Eyes, mouths and belts of
 * a body lying on the ground are enclosed by the body higher up and survive.
 * Cells whose lowest black row is too high up (flying frames) have no shadow.
 *
 * `flat` (for bodies lying on the ground, whose black hair can sit entirely inside the band) only
 * accepts fragments at most 4 rows tall: the visible slivers of an ellipse beside a lying body are
 * thin, a head of hair is not.
 *
 * `outline` (for characters with black trousers, tights, bodysuits or shoes, which merge with the
 * ellipse into one black component) first sets aside the black pixels that border a coloured (not
 * near-white) body pixel: the edges where black clothing meets the coloured body, and the black
 * undersides of skirts and coats. In the ellipse's own bottom rows, black under the lowest coloured
 * pixel of a column is ground, not outline (LoG2 draws soles in dark colours, never black, so a
 * black line under a shoe is the shadow). The remaining black pixels of the band are
 * grouped into fragments with the usual rules, so the ellipse is found even when black clothing
 * touches it, while a fragment that carries on upward in black past the band (a leg) stays.
 * @param {(string | null)[]} cell
 * @param {number} size
 * @param {{ flat?: boolean, outline?: boolean }} [opts]
 * @returns {Set<number>} pixel indices of the shadow
 */
export function findShadow(cell, size, opts = {}) {
  const isBlack = (i) => cell[i] === SHADOW_COLOR;
  let bottom = -1;
  for (let i = 0; i < size * size; i++) if (isBlack(i)) bottom = Math.max(bottom, Math.floor(i / size));
  const out = new Set();
  if (bottom < Math.round((SHADOW_MIN_BOTTOM * size) / 32)) return out;
  const top = bottom - SHADOW_BAND;
  /**
   * A black pixel 4-adjacent to a coloured body pixel: part of the body's outline. Near-white
   * neighbours do not count: LoG2's attack swooshes and sparks are white and sweep along the floor
   * through the shadow, which they do not outline.
   */
  const isBodyColor = (c) => {
    if (c === null || c === SHADOW_COLOR) return false;
    const v = parseInt(c.slice(1), 16);
    return Math.min(v >> 16, (v >> 8) & 255, v & 255) < NEAR_WHITE;
  };
  // Lowest body-coloured row of each column: black under it is ground, never an outline drawn by
  // the body (LoG2 outlines in dark colours, so black below the last coloured pixel is the ellipse).
  const lowestBody = new Array(size).fill(-1);
  for (let i = 0; i < size * size; i++) if (isBodyColor(cell[i])) lowestBody[i % size] = Math.max(lowestBody[i % size], Math.floor(i / size));
  const isOutline = (i) => {
    const x = i % size;
    const y = (i - x) / size;
    if (y > lowestBody[x] && y > bottom - GROUND_ROWS) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return false;
      return isBodyColor(cell[ny * size + nx]);
    });
  };
  const isShadowColor = opts.outline ? (i) => isBlack(i) && Math.floor(i / size) >= top && !isOutline(i) : isBlack;
  for (const comp of components(size, isShadowColor, false)) {
    if (comp.some((p) => Math.floor(p / size) < top)) continue;
    // Outline mode cuts fragments off at the band's top row; one that carries on upward in black is body.
    if (opts.outline && comp.some((p) => p >= size && Math.floor(p / size) === top && isBlack(p - size))) continue;
    if (opts.flat) {
      const rows = comp.map((p) => Math.floor(p / size));
      if (Math.max(...rows) - Math.min(...rows) + 1 > 4) continue;
    }
    const touchesClear = comp.some((p) => {
      const x = p % size;
      const y = (p - x) / size;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx < 0 || ny < 0 || nx >= size || ny >= size || cell[ny * size + nx] === null;
      });
    });
    const reachesFloor = comp.length >= 2 && comp.some((p) => Math.floor(p / size) >= bottom - 2);
    if (!touchesClear && !reachesFloor) continue;
    for (const p of comp) out.add(p);
  }
  return out;
}

/** Copy of a cell with its baked ground shadow made transparent. */
export function stripShadow(cell, size, opts = {}) {
  const shadow = findShadow(cell, size, opts);
  return cell.map((c, i) => (shadow.has(i) ? null : c));
}

/** Lowest row holding an opaque pixel, or -1 for an empty cell. */
export function bottomRow(cell, size) {
  for (let y = size - 1; y >= 0; y--) for (let x = 0; x < size; x++) if (cell[y * size + x] !== null) return y;
  return -1;
}

/**
 * Move a cell's content down so the block's ground row lands on the cell's last row (where the
 * engine puts the feet). Frames whose content already reaches lower than the ground row (bodies
 * lying on the ground) move only as far as they can without losing pixels.
 * @returns {{ cell: (string | null)[], shift: number }}
 */
export function alignToGround(cell, size, groundRow) {
  const low = bottomRow(cell, size);
  if (low < 0) return { cell: cell.slice(), shift: 0 };
  const shift = Math.max(0, Math.min(size - 1 - groundRow, size - 1 - low));
  if (!shift) return { cell: cell.slice(), shift: 0 };
  const out = new Array(size * size).fill(null);
  for (let y = 0; y + shift < size; y++) for (let x = 0; x < size; x++) out[(y + shift) * size + x] = cell[y * size + x];
  return { cell: out, shift };
}

/**
 * Head anchor of a frame: the top row of its biggest 8-connected opaque blob (the body, not
 * detached effect trails) and the centre column of that blob's top four rows.
 * @returns {[number, number]} [x, y], or [size/2, 0] for an empty cell
 */
export function headAnchor(cell, size) {
  const comps = components(size, (i) => cell[i] !== null, true);
  if (!comps.length) return [size >> 1, 0];
  let body = comps[0];
  for (const c of comps) if (c.length > body.length) body = c;
  let top = size;
  for (const p of body) top = Math.min(top, Math.floor(p / size));
  let sum = 0;
  let n = 0;
  for (const p of body) {
    if (Math.floor(p / size) < top + 4) {
      sum += p % size;
      n++;
    }
  }
  return [Math.round(sum / n), top];
}

/**
 * Encode a palette-index grid (0 = transparent) as bytes: the opaque bounding box [x, y, w, h],
 * then its pixels row-major as tokens. A byte < 0x80 is one pixel of that palette index; a byte
 * >= 0x80 is a run of (byte - 0x80 + 2) pixels of the index in the next byte.
 * @param {Uint8Array | number[]} idx
 * @returns {Uint8Array}
 */
export function encodeIndices(idx, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!idx[y * size + x]) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return Uint8Array.from([0, 0, 0, 0]);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const flat = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) flat.push(idx[y * size + x]);
  const out = [x0, y0, w, h];
  for (let i = 0; i < flat.length;) {
    const v = flat[i];
    if (v > 0x7f) throw new Error(`Palette index ${v} does not fit the frame codec (max 127 colours per block)`);
    let run = 1;
    while (i + run < flat.length && flat[i + run] === v && run < 0x7f + 2) run++;
    if (run >= 2) out.push(0x80 + run - 2, v);
    else out.push(v);
    i += run;
  }
  return Uint8Array.from(out);
}

/** Inverse of encodeIndices: a size*size palette-index grid. */
export function decodeIndices(bytes, size) {
  const out = new Uint8Array(size * size);
  const [x0, y0, w, h] = bytes;
  let p = 0;
  const put = (v) => {
    const x = x0 + (p % w);
    const y = y0 + Math.floor(p / w);
    if (x < size && y < size) out[y * size + x] = v;
    p++;
  };
  for (let i = 4; i < bytes.length && p < w * h;) {
    const b = bytes[i++];
    if (b < 0x80) put(b);
    else {
      const v = bytes[i++];
      for (let n = b - 0x80 + 2; n > 0; n--) put(v);
    }
  }
  return out;
}
