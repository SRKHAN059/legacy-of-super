import { PAL } from '../art/color';

/** Draw a GBA-style bevelled window: dark translucent fill with a light double frame. */
export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: { fill?: string; alpha?: number } = {}): void {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 0.92;
  ctx.fillStyle = opts.fill ?? PAL.uiDark;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.globalAlpha = 1;
  // Gradient band on top third for depth.
  ctx.fillStyle = PAL.uiMid;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, Math.floor(h / 3)));
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.uiFrame;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  ctx.fillStyle = PAL.uiLight;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, h - 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
  ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
  ctx.restore();
}

/** Horizontal gauge (HP/KI/EXP) with a dark trough and a highlight line. */
export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, trough = '#202030'): void {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = trough;
  ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * f);
  if (fw > 0) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, fw, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + h - 1, fw, 1);
  }
}
