import type { Pose, SpriteAnim, SpriteAnims, SpriteSet } from '../art/humanoid';
import { spriteSet } from '../art/registry';
import { animIndex, POSE_ANIMS, spriteAnims } from '../art/sheets';
import { CREATURES } from '../content/creatures';
import { tint, type Bitmap } from '../engine/gfx';
import type { Dir, Rect } from '../engine/math';

const flashCache = new WeakMap<Bitmap, Bitmap>();
const silhouetteCache = new WeakMap<Bitmap, Bitmap>();

function flashOf(b: Bitmap): Bitmap {
  let f = flashCache.get(b);
  if (!f) {
    f = tint(b, '#ffffff');
    flashCache.set(b, f);
  }
  return f;
}

function silhouetteOf(b: Bitmap): Bitmap {
  let f = silhouetteCache.get(b);
  if (!f) {
    f = tint(b, '#101018');
    silhouetteCache.set(b, f);
  }
  return f;
}

/** Base class for everything that walks around: player, NPCs, enemies. Position is the feet centre. */
export class Actor {
  x: number;
  y: number;
  /** Collision box size at the feet. */
  w = 10;
  h = 6;
  dir: Dir = 'down';
  pose: Pose = 'idle';
  /** Forced pose for scripted scenes (overrides animation). */
  scriptPose: Pose | null = null;
  walkT = 0;
  moving = false;
  running = false;
  /** Knockback velocity. */
  kx = 0;
  ky = 0;
  /** Hit-flash frames. */
  flash = 0;
  /** Invulnerability (blink) frames. */
  inv = 0;
  /** Height above the ground (jumps, flight, scripted lifts). */
  z = 0;
  hidden = false;
  alpha = 1;
  /** Aura colour while charging / transformed. */
  aura: string | null = null;
  /** Draw as a dark silhouette (mystery figures in cutscenes). */
  silhouette = false;
  spriteId: string;
  set: SpriteSet;
  /** Pixel size of a creature frame (0 for humanoids). */
  creatureSize: number;
  /** Animation clock in ticks: advanced by animate(), or by draw() for actors nobody animates. */
  animClock = 0;
  /** Animation currently playing (sheet sprites) and the clock tick it started on. */
  private animKey = '';
  private animStart = 0;
  /** Whether animate() ran since the last draw. */
  private ticked = false;

  constructor(spriteId: string, x: number, y: number) {
    this.spriteId = spriteId;
    this.set = spriteSet(spriteId);
    this.creatureSize = CREATURES[spriteId]?.size ?? 0;
    this.x = x;
    this.y = y;
    if (this.creatureSize >= 40) { this.w = 22; this.h = 10; }
    else if (this.creatureSize >= 32) { this.w = 16; this.h = 8; }
  }

  /** Swap sprite set (transformations, outfit changes). */
  setSprite(id: string): void {
    if (id === this.spriteId) return;
    this.spriteId = id;
    this.set = spriteSet(id);
    this.creatureSize = CREATURES[id]?.size ?? 0;
  }

  /** Feet collision box in world pixels. */
  box(): Rect {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  /** Body hurtbox in world pixels. */
  body(): Rect {
    if (this.creatureSize) {
      const s = this.creatureSize;
      return { x: this.x - s * 0.35, y: this.y - s * 0.7 - this.z, w: s * 0.7, h: s * 0.7 };
    }
    return { x: this.x - 7, y: this.y - 26 - this.z, w: 14, h: 26 };
  }

  /** Visual centre (for effects / projectiles). */
  get cx(): number {
    return this.x;
  }

  get cy(): number {
    const b = this.body();
    return b.y + b.h / 2;
  }

  /** Advance the walk cycle and choose the current pose. */
  animate(): void {
    if (this.moving) this.walkT += this.running ? 1.8 : 1;
    else this.walkT = 0;
    this.animClock++;
    this.ticked = true;
  }

  /** Ticks the current animation has been playing (restarts whenever the animation changes). */
  private animTime(key: string): number {
    if (key !== this.animKey) {
      this.animKey = key;
      this.animStart = this.animClock;
    }
    return this.animClock - this.animStart;
  }

  /**
   * Animated frame for sheet sprites: the walk / run cycle while moving (phase from walkT, so it
   * speeds up with running), the idle loop with periodic blinks, and each Pose's animation timed
   * from the moment the pose began (attacks, charge loop, hurt, ko...). Null when the set has no
   * animation for the pose (the still Pose frame is used).
   */
  private animatedFrame(anims: SpriteAnims, pose: Pose): Bitmap | null {
    if (pose === 'idle' && this.moving) {
      const run = this.running && anims.run;
      const a: SpriteAnim | undefined = run ? anims.run : anims.walk;
      if (!a) return null;
      this.animTime(run ? 'run' : 'walk');
      const frames = a.frames[this.dir];
      const ticks = run ? this.walkT / 1.8 : this.walkT;
      return frames[Math.floor((ticks * a.fps) / 60) % frames.length];
    }
    const name = POSE_ANIMS[pose].find((n) => anims[n]);
    if (!name) return null;
    const a = anims[name];
    const t = this.animTime(name);
    const frames = a.frames[this.dir];
    if (name === 'idle' && frames.length === 1 && anims.blink) {
      // A blink every few seconds; the period varies per sprite so crowds don't blink in unison.
      const blink = anims.blink.frames[this.dir];
      const dur = Math.max(1, Math.round((blink.length * 60) / anims.blink.fps));
      const period = 170 + (this.spriteId.length * 13) % 60;
      const phase = t % period;
      if (phase >= period - dur) return blink[animIndex(anims.blink, blink.length, phase - (period - dur))];
      return frames[0];
    }
    return frames[animIndex(a, frames.length, t)];
  }

  /** Current bitmap. */
  frame(): Bitmap {
    let pose: Pose = this.scriptPose ?? this.pose;
    const anims = spriteAnims(this.set);
    if (anims) {
      const b = this.animatedFrame(anims, pose);
      if (b) return b;
    }
    if (pose === 'idle' && this.moving) {
      const step = Math.floor(this.walkT / 8) % 4;
      pose = step === 0 ? 'walk1' : step === 2 ? 'walk2' : 'idle';
    }
    return this.set[pose][this.dir];
  }

  /** Ground shadow ellipse. */
  drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.hidden) return;
    const w = this.creatureSize ? Math.round(this.creatureSize * 0.5) : 12;
    const shrink = Math.min(4, Math.floor(this.z / 6));
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x - cx), Math.round(this.y - cy - 1), (w - shrink) / 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw the sprite (with flash / blink / alpha). */
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (!this.ticked) this.animClock++;
    this.ticked = false;
    if (this.hidden) return;
    if (this.inv > 0 && Math.floor(this.inv / 3) % 2 === 1) return;
    let bmp = this.frame();
    if (this.flash > 0) bmp = flashOf(bmp);
    else if (this.silhouette) bmp = silhouetteOf(bmp);
    const dx = Math.round(this.x - bmp.width / 2 - cx);
    const dy = Math.round(this.y - bmp.height + 2 - this.z - cy);
    if (this.alpha < 1) ctx.globalAlpha = this.alpha;
    ctx.drawImage(bmp, dx, dy);
    if (this.alpha < 1) ctx.globalAlpha = 1;
  }

  /** Face toward a point. */
  faceTo(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
  }
}
