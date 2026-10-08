/** Decode a PNG file buffer to RGBA (4 bytes per pixel). */
export function decodePng(buf: Uint8Array): { width: number; height: number; data: Uint8Array };
/** Encode an RGBA image as a PNG buffer. */
export function encodePng(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): Uint8Array;
