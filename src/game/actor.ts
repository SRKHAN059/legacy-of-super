import type { Pose, SpriteSet } from '../art/humanoid';
import { spriteSet } from '../art/registry';
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
  }

  /** Current bitmap. */
  frame(): Bitmap {
    let pose: Pose = this.scriptPose ?? this.pose;
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
