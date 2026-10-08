import { POSES, HUMANOID_H, HUMANOID_W, type SpriteAnim } from '../art/humanoid';
import { isSheetSprite, spriteSet } from '../art/registry';
import { animIndex, FRAME_POOL_CAP, sheetCastIds, spriteAnims } from '../art/sheets';
import { buildPortrait, type Expression } from '../art/portrait';
import { CAST } from '../content/cast';
import { CREATURES } from '../content/creatures';
import { buildCreature } from '../art/creatures';
import { font, makeBitmap, type Bitmap } from '../engine/gfx';
import { DIRS, type Dir } from '../engine/math';

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

/** Put a gallery canvas on the page at an integer zoom. */
function mount(bmp: HTMLCanvasElement, scale: number): void {
  bmp.style.width = `${bmp.width * scale}px`;
  bmp.style.height = `${bmp.height * scale}px`;
  bmp.style.imageRendering = 'pixelated';
  document.body.innerHTML = '';
  document.body.style.overflow = 'auto';
  document.body.style.touchAction = 'auto';
  document.body.appendChild(bmp);
}

/** Frame of an animation `t` ticks into a gallery loop (one-shot animations replay after a pause). */
function galleryFrame(a: SpriteAnim, d: Dir, t: number): Bitmap {
  const frames = a.frames[d];
  const dur = Math.ceil((frames.length * 60) / a.fps);
  const tt = a.loop ? t : t % (dur + 40);
  return frames[animIndex(a, frames.length, tt)];
}

/**
 * Developer sprite viewer. `?gallery` shows every cast member, `?gallery=sheet` only the
 * sheet-backed ones (both walk in place when the frame pool can hold every walk frame at once,
 * else they stand), and `?gallery=<id>` every pose of one id - for a sheet sprite also every
 * animation playing in all four facings.
 */
export function showGallery(which: string): void {
  const scale = 2;
  const sheetIds = sheetCastIds().filter(isSheetSprite);
  const single = !!which && (!!CAST[which] || sheetIds.includes(which));
  const ids = single ? [which] : which === 'sheet' ? sheetIds : [...new Set([...Object.keys(CAST), ...sheetIds])];
  if (single) {
    showOne(which, scale);
    return;
  }
  const cols = 7;
  const fw = 32;
  const cellW = (fw + 2) * 4 + 6;
  const cellH = HUMANOID_H + 14;
  const rows = Math.ceil(ids.length / cols);
  const W = cols * cellW + 8;
  const H = rows * cellH + 8;
  const { bmp, ctx } = makeBitmap(W, H);
  const sets = ids.map((id) => ({ id, set: spriteSet(id) }));
  // Walking in place needs every walk frame of every facing alive at once: only while that fits in
  // the sheet frame pool (a larger overview shows still frames rather than re-render frames each tick).
  const walkFrames = sets.reduce((n, { set }) => n + DIRS.reduce((m, d) => m + (spriteAnims(set)?.walk?.frames[d].length ?? 0), 0), 0);
  const walking = walkFrames <= FRAME_POOL_CAP / 2;
  const draw = (t: number) => {
    ctx.fillStyle = '#5a7a5a';
    ctx.fillRect(0, 0, W, H);
    sets.forEach(({ id, set }, n) => {
      const x = 4 + (n % cols) * cellW;
      const y = 4 + Math.floor(n / cols) * cellH;
      const anims = spriteAnims(set);
      font.draw(ctx, anims ? `${id} *` : id, x, y, anims ? '#ffe070' : '#fff', '#000');
      DIRS.forEach((d, di) => {
        const b = walking && anims?.walk ? galleryFrame(anims.walk, d, t) : set.idle[d];
        ctx.drawImage(b, x + di * (fw + 2) + ((fw - b.width) >> 1), y + 11 + HUMANOID_H - b.height);
      });
    });
  };
  draw(0);
  mount(bmp, scale);
  if (walking && sets.some(({ set }) => spriteAnims(set))) loop(draw);
}

/** Run a draw callback at 60 ticks per second. */
function loop(draw: (t: number) => void): void {
  let t = 0;
  let last = performance.now();
  const step = (now: number) => {
    while (now - last >= 1000 / 60) {
      t++;
      last += 1000 / 60;
    }
    draw(t);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Every still pose of one id, and for sheet sprites every animation playing in all four facings. */
function showOne(id: string, scale: number): void {
  const set = spriteSet(id);
  const anims = spriteAnims(set);
  const fw = Math.max(HUMANOID_W, set.idle.down.width);
  const fh = Math.max(HUMANOID_H, set.idle.down.height);
  const poseW = fw + 4;
  const names = anims ? Object.keys(anims) : [];
  const LABEL = 56;
  const W = Math.max(POSES.length * poseW, LABEL + DIRS.length * (fw + 4)) + 8;
  const H = 12 + (fh + 2) * 4 + 12 + names.length * (fh + 4) + 8;
  const { bmp, ctx } = makeBitmap(W, H);
  const draw = (t: number) => {
    ctx.fillStyle = '#5a7a5a';
    ctx.fillRect(0, 0, W, H);
    POSES.forEach((pose, pi) => {
      const x = 4 + pi * poseW;
      font.draw(ctx, pose.slice(0, 5), x, 2, '#fff', '#000');
      DIRS.forEach((d, di) => ctx.drawImage(set[pose][d], x, 12 + di * (fh + 2)));
    });
    let y = 12 + (fh + 2) * 4 + 8;
    for (const name of names) {
      const a = anims?.[name];
      if (!a) continue;
      font.draw(ctx, name, 4, y + (fh >> 1) - 8, '#ffe070', '#000');
      font.draw(ctx, `${a.fps}${a.loop ? ' loop' : ''}`, 4, y + (fh >> 1) + 2, '#c0d0c0', '#000');
      DIRS.forEach((d, di) => ctx.drawImage(galleryFrame(a, d, t), LABEL + di * (fw + 4), y));
      y += fh + 4;
    }
  };
  draw(0);
  mount(bmp, scale);
  if (anims) loop(draw);
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
