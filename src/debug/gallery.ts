import { buildHumanoid, POSES, HUMANOID_H, HUMANOID_W } from '../art/humanoid';
import { buildPortrait, type Expression } from '../art/portrait';
import { CAST } from '../content/cast';
import { CREATURES } from '../content/creatures';
import { buildCreature } from '../art/creatures';
import { font, makeBitmap } from '../engine/gfx';
import { DIRS } from '../engine/math';

/** Portrait sheet: every cast member in each expression. */
export function showPortraits(): void {
  const exprs: Expression[] = ['neutral', 'happy', 'angry', 'shock', 'sad', 'smirk', 'shout', 'hurt'];
  const ids = Object.keys(CAST);
  const W = exprs.length * 34 + 70;
  const H = ids.length * 38 + 4;
  const { bmp, ctx } = makeBitmap(W, H);
  ctx.fillStyle = '#28385c';
  ctx.fillRect(0, 0, W, H);
  ids.forEach((id, r) => {
    font.draw(ctx, id.slice(0, 12), 2, r * 38 + 14, '#fff', '#000');
    exprs.forEach((e, c) => ctx.drawImage(buildPortrait(CAST[id], e), 68 + c * 34, r * 38 + 2));
  });
  bmp.style.width = `${W * 2}px`;
  bmp.style.height = `${H * 2}px`;
  bmp.style.imageRendering = 'pixelated';
  document.body.innerHTML = '';
  document.body.style.overflow = 'auto';
  document.body.style.touchAction = 'auto';
  document.body.appendChild(bmp);
}

/** Developer sprite sheet viewer: `?gallery` shows all cast idle; `?gallery=goku` shows every pose. */
export function showGallery(which: string): void {
  const scale = 2;
  const ids = which && CAST[which] ? [which] : Object.keys(CAST);
  const single = ids.length === 1;
  const cols = single ? POSES.length : 7;
  const cellW = single ? HUMANOID_W + 4 : (HUMANOID_W + 2) * 4 + 6;
  const cellH = single ? (HUMANOID_H + 2) * 4 + 12 : HUMANOID_H + 14;
  const rows = single ? 1 : Math.ceil(ids.length / cols);
  const W = cols * cellW + 8;
  const H = rows * cellH + 8;
  const { bmp, ctx } = makeBitmap(W, H);
  ctx.fillStyle = '#5a7a5a';
  ctx.fillRect(0, 0, W, H);
  ids.forEach((id, n) => {
    const set = buildHumanoid(CAST[id]);
    if (single) {
      POSES.forEach((pose, pi) => {
        const x = 4 + pi * cellW;
        font.draw(ctx, pose.slice(0, 5), x, 2, '#fff', '#000');
        DIRS.forEach((d, di) => ctx.drawImage(set[pose][d], x, 12 + di * (HUMANOID_H + 2)));
      });
    } else {
      const x = 4 + (n % cols) * cellW;
      const y = 4 + Math.floor(n / cols) * cellH;
      font.draw(ctx, id, x, y, '#fff', '#000');
      DIRS.forEach((d, di) => ctx.drawImage(set.idle[d], x + di * (HUMANOID_W + 2), y + 11));
    }
  });
  bmp.style.width = `${W * scale}px`;
  bmp.style.height = `${H * scale}px`;
  bmp.style.imageRendering = 'pixelated';
  document.body.innerHTML = '';
  document.body.style.overflow = 'auto';
  document.body.style.touchAction = 'auto';
  document.body.appendChild(bmp);
}

/** Creature sheet: each creature idle/walk/attack/hurt in three directions. */
export function showCreatures(): void {
  const ids = Object.keys(CREATURES);
  const poses = ['idle', 'walk1', 'walk2', 'punch1', 'hurt'] as const;
  const dirs = ['down', 'up', 'left'] as const;
  const cell = 50;
  const W = poses.length * dirs.length * cell + 70;
  const H = ids.length * cell + 4;
  const { bmp, ctx } = makeBitmap(W, H);
  ctx.fillStyle = '#5a7a5a';
  ctx.fillRect(0, 0, W, H);
  ids.forEach((id, r) => {
    const set = buildCreature(CREATURES[id]);
    font.draw(ctx, id.slice(0, 12), 2, r * cell + 20, '#fff', '#000');
    dirs.forEach((d, di) => poses.forEach((pz, pi) => ctx.drawImage(set[pz][d], 68 + (di * poses.length + pi) * cell, r * cell + 1)));
  });
  bmp.style.width = `${W * 2}px`;
  bmp.style.height = `${H * 2}px`;
  bmp.style.imageRendering = 'pixelated';
  document.body.innerHTML = '';
  document.body.style.overflow = 'auto';
  document.body.appendChild(bmp);
}
