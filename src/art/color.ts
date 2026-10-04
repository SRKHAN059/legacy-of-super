import { hexRgb } from '../engine/gfx';

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Darken (f < 1) or brighten (f > 1) a colour multiplicatively, with a slight hue shift toward blue in shadows like hand-made GBA palettes. */
export function shade(hex: string, f: number): string {
  const [r, g, b] = hexRgb(hex);
  if (f < 1) return toHex(r * f, g * f, b * Math.min(1, f + 0.08));
  return toHex(r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1));
}

/** Linear blend between two colours. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexRgb(a);
  const [r2, g2, b2] = hexRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Shared palette constants for UI and effects. */
export const PAL = {
  outline: '#181020',
  white: '#f8f8f8',
  black: '#000000',
  textShadow: '#202028',
  hp: '#40d040',
  hpLow: '#f04030',
  ki: '#4098f8',
  exp: '#f8c818',
  uiDark: '#101828',
  uiMid: '#28385c',
  uiLight: '#6878b0',
  uiFrame: '#c8d0f0',
  gold: '#f8d030',
  red: '#e03028',
} as const;
