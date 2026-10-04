import { PAL } from '../art/color';
import { TECHNIQUES, type TechKind } from '../content/techniques';
import { SCREEN_W } from '../engine/constants';
import { font } from '../engine/gfx';
import type { Field } from './field';
import { expFraction } from './leveling';

/** Draw a tiny icon for a technique kind inside a 18x8 box. */
function techIcon(ctx: CanvasRenderingContext2D, kind: TechKind | 'Z', color: string, x: number, y: number, dim: boolean, glow: boolean): void {
  ctx.globalAlpha = dim ? 0.35 : 1;
  ctx.fillStyle = color;
  switch (kind) {
    case 'shot': ctx.fillRect(x + 7, y + 2, 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(x + 8, y + 3, 2, 2); break;
    case 'beam':
    case 'pierceBeam': ctx.fillRect(x + 2, y + 3, 14, kind === 'beam' ? 3 : 2); ctx.fillStyle = '#fff'; ctx.fillRect(x + 2, y + 4, 14, 1); break;
    case 'charge': ctx.beginPath(); ctx.arc(x + 9, y + 4, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x + 8, y + 3, 2, 2); break;
    case 'arc': ctx.fillRect(x + 3, y + 5, 2, 2); ctx.fillRect(x + 6, y + 2, 2, 2); ctx.fillRect(x + 10, y + 1, 2, 2); ctx.fillRect(x + 13, y + 3, 3, 3); break;
    case 'spread': ctx.fillRect(x + 4, y + 1, 3, 2); ctx.fillRect(x + 8, y + 3, 3, 2); ctx.fillRect(x + 12, y + 5, 3, 2); break;
    case 'stun': ctx.fillRect(x + 8, y, 2, 8); ctx.fillRect(x + 5, y + 3, 8, 2); break;
    case 'wave': ctx.fillRect(x + 8, y, 3, 8); ctx.fillStyle = '#fff'; ctx.fillRect(x + 9, y + 1, 1, 6); break;
    case 'punch': ctx.fillRect(x + 6, y + 2, 6, 5); ctx.fillStyle = '#fff'; ctx.fillRect(x + 7, y + 3, 4, 1); break;
    case 'pose': ctx.fillRect(x + 8, y, 2, 8); ctx.fillRect(x + 5, y + 3, 8, 2); ctx.fillRect(x + 6, y + 1, 1, 1); ctx.fillRect(x + 11, y + 6, 1, 1); break;
    case 'Z':
      font.draw(ctx, 'Z', x + 6, y - 1, glow ? PAL.gold : '#a0a0b0', '#000');
      break;
  }
  ctx.globalAlpha = 1;
}

/** Segmented bar (LoG2's red HP bar is drawn in 2px segments). */
function segBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, dark: string): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, fw, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 3; i < fw; i += 3) ctx.fillRect(x + i, y, 1, h);
}

/** Draw the field HUD. */
export function drawHud(ctx: CanvasRenderingContext2D, f: Field): void {
  const p = f.player;
  const cs = p.cs;
  const x0 = 4;
  const y0 = 4;

  // Panel backing.
  ctx.fillStyle = 'rgba(8,12,28,0.6)';
  ctx.fillRect(x0, y0, 92, 18);
  ctx.fillStyle = PAL.uiLight;
  ctx.fillRect(x0, y0, 92, 1);

  // Transformation triangle.
  const tx = x0 + 2;
  const ty = y0 + 2;
  if (p.canTransform) {
    const fill = p.formActive ? 1 : p.zGauge;
    for (let r = 0; r < 12; r++) {
      const w = Math.max(1, Math.round(((r + 1) / 12) * 10));
      const lx = tx + 5 - Math.floor(w / 2);
      const filled = 1 - r / 12 <= fill + 0.001;
      ctx.fillStyle = r === 11 ? '#000' : filled ? (p.formActive ? (f.tick % 10 < 5 ? '#fff8a0' : PAL.gold) : PAL.gold) : '#383820';
      ctx.fillRect(lx, ty + r, w, 1);
    }
    if (p.zGauge >= 1 && !p.formActive && f.tick % 30 < 15) { ctx.fillStyle = '#ffffff'; ctx.fillRect(tx + 5, ty + 1, 1, 2); }
  }

  // HP / EP bars.
  const bx = x0 + 15;
  segBar(ctx, bx, y0 + 3, 54, 4, cs.hp / cs.hpMax, cs.hp / cs.hpMax < 0.25 && f.tick % 20 < 10 ? '#f87060' : '#e83828', '#401010');
  segBar(ctx, bx, y0 + 10, 54, 3, cs.ep / cs.epMax, '#38c848', '#103010');

  // Technique box.
  const kx = bx + 58;
  const ky = y0 + 3;
  ctx.fillStyle = '#000';
  ctx.fillRect(kx - 1, ky - 1, 20, 12);
  ctx.fillStyle = '#202848';
  ctx.fillRect(kx, ky, 18, 10);
  if (p.zSelected) techIcon(ctx, 'Z', PAL.gold, kx, ky + 1, false, p.zGauge >= 1 || !!p.formActive);
  else {
    const t = p.tech;
    if (t) techIcon(ctx, t.kind, t.color, kx, ky + 1, cs.ep < t.cost, false);
  }

  // EXP line.
  ctx.fillStyle = '#000';
  ctx.fillRect(x0 + 1, y0 + 19, 90, 3);
  ctx.fillStyle = '#183058';
  ctx.fillRect(x0 + 2, y0 + 20, 88, 1);
  ctx.fillStyle = '#58a0f8';
  ctx.fillRect(x0 + 2, y0 + 20, Math.round(88 * expFraction(cs.level, cs.exp)), 1);

  // Boss bar.
  const boss = f.boss;
  if (boss && !boss.dead) {
    const w = 72;
    const x = SCREEN_W - w - 18;
    font.drawRight(ctx, boss.def.name, x + w, 4, PAL.white, '#000');
    segBar(ctx, x, 14, w, 5, boss.hp / boss.maxHp, '#e83828', '#401010');
  }

  // Hostile-zone icon (LoG2's jar; ours is a red scouter glyph).
  if (f.hostile) {
    const ix = SCREEN_W - 13;
    const iy = boss ? 22 : 4;
    ctx.fillStyle = '#000';
    ctx.fillRect(ix - 1, iy - 1, 11, 11);
    ctx.fillStyle = '#c02020';
    ctx.fillRect(ix, iy, 9, 9);
    ctx.fillStyle = '#f86060';
    ctx.fillRect(ix + 1, iy + 1, 5, 4);
    ctx.fillStyle = '#ffd0d0';
    ctx.fillRect(ix + 2, iy + 2, 2, 1);
    ctx.fillStyle = '#601010';
    ctx.fillRect(ix + 6, iy + 5, 2, 3);
  }

  // Carried quest object (LoG2 shows an icon top-right).
  if (f.carrying) {
    const ix = SCREEN_W - 26;
    const iy = f.hostile ? 4 : 4;
    ctx.fillStyle = '#000';
    ctx.fillRect(ix - 1, iy - 1, 11, 11);
    ctx.fillStyle = '#f8f0d0';
    ctx.beginPath(); ctx.ellipse(ix + 4.5, iy + 5, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0c090';
    ctx.fillRect(ix + 2, iy + 6, 2, 2);
  }

  // Countdown timer.
  if (f.timer) {
    const s = Math.ceil(f.timer.frames / 60);
    const txt = `${f.timer.label} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    font.drawCentered(ctx, txt, SCREEN_W / 2, 6, s <= 10 && f.tick % 30 < 15 ? '#f84040' : PAL.white, '#000');
  }

  // Grab escape prompt.
  if (p.grabbed > 0 && f.tick % 20 < 14) font.drawCentered(ctx, 'Mash A / B!', p.x - f.camera.x, p.y - f.camera.y - 44, PAL.gold, '#000');
  void TECHNIQUES;
}
