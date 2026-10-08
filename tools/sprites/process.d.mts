/** A cell as a row-major colour grid: '#rrggbb' per pixel, null = transparent. */
export type CellGrid = (string | null)[];
/** Sheet colours that are never sprite pixels (checkerboard greens, background, empty-cell border). */
export const KEY_COLORS: readonly string[];
/** Colour of the baked ground shadow. */
export const SHADOW_COLOR: string;
/** '#rrggbb' for an RGB triple. */
export function hexOf(r: number, g: number, b: number): string;
/** Cut one w×h cell out of an RGBA image into a colour grid with the background keyed out. */
export function sliceCell(img: { width: number; height: number; data: Uint8Array }, x0: number, y0: number, w: number, h?: number): CellGrid;
/** Place a w×h cell centred and bottom-aligned in a size×size frame. */
export function embedCell(cell: CellGrid, w: number, h: number, size: number): CellGrid;
/** Pixel indices of a cell's baked ground shadow. */
export function findShadow(cell: CellGrid, size: number, opts?: { flat?: boolean; outline?: boolean }): Set<number>;
/** Copy of a cell with its baked ground shadow made transparent. */
export function stripShadow(cell: CellGrid, size: number, opts?: { flat?: boolean; outline?: boolean }): CellGrid;
/** Lowest opaque row, or -1 for an empty cell. */
export function bottomRow(cell: CellGrid, size: number): number;
/** Move content down so the ground row lands on the last row (never cropping). */
export function alignToGround(cell: CellGrid, size: number, groundRow: number): { cell: CellGrid; shift: number };
/** Head anchor [x, y] of a frame. */
export function headAnchor(cell: CellGrid, size: number): [number, number];
/** Encode a palette-index grid as the frame codec bytes. */
export function encodeIndices(idx: Uint8Array | number[], size: number): Uint8Array;
/** Decode frame codec bytes to a palette-index grid. */
export function decodeIndices(bytes: Uint8Array | number[], size: number): Uint8Array;
