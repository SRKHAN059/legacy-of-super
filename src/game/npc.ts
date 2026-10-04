import { CAST } from '../content/cast';
import { vecDir } from '../engine/math';
import { Actor } from './actor';
import type { Field } from './field';
import type { NpcDef } from './mapdef';

/** A friendly character that can wander and be talked to. */
export class Npc extends Actor {
  def: NpcDef;
  private wanderT = 0;
  private vx = 0;
  private vy = 0;
  readonly homeX: number;
  readonly homeY: number;
  /** Paused while talking / during scripts. */
  paused = false;
  /** Scripted walk target. */
  target: { x: number; y: number; speed: number; resolve: () => void } | null = null;

  constructor(def: NpcDef, x: number, y: number) {
    super(def.sprite, x, y);
    this.def = def;
    this.dir = def.dir ?? 'down';
    this.homeX = x;
    this.homeY = y;
  }

  /** Display name for dialogue boxes. */
  get name(): string {
    return this.def.name ?? '';
  }

  /** True when this NPC has a dialogue portrait. */
  get hasPortrait(): boolean {
    return !!CAST[this.spriteId];
  }

  update(f: Field): void {
    if (this.flash > 0) this.flash--;
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= this.target.speed) {
        this.x = this.target.x;
        this.y = this.target.y;
        this.moving = false;
        const r = this.target.resolve;
        this.target = null;
        r();
      } else {
        this.x += (dx / d) * this.target.speed;
        this.y += (dy / d) * this.target.speed;
        this.moving = true;
        this.running = this.target.speed > 1.4;
        this.dir = vecDir({ x: dx, y: dy }, this.dir);
      }
      this.animate();
      return;
    }
    const radius = (this.def.wander ?? 0) * 16;
    if (this.paused || radius <= 0) {
      this.moving = false;
      this.animate();
      return;
    }
    this.wanderT--;
    if (this.wanderT <= 0) {
      this.wanderT = 50 + f.rng.int(0, 90);
      if (f.rng.chance(0.5)) { this.vx = 0; this.vy = 0; }
      else {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const [vx, vy] = f.rng.pick(dirs);
        this.vx = vx;
        this.vy = vy;
        if (Math.hypot(this.x - this.homeX, this.y - this.homeY) > radius) {
          this.vx = Math.sign(this.homeX - this.x);
          this.vy = this.vx === 0 ? Math.sign(this.homeY - this.y) : 0;
        }
      }
    }
    if (this.vx || this.vy) {
      const r = f.col.move(this.box(), this.vx * 0.5, this.vy * 0.5);
      // Don't walk into the player.
      const pb = f.player.box();
      const nb = this.box();
      nb.x += r.dx;
      nb.y += r.dy;
      if (!(nb.x < pb.x + pb.w && nb.x + nb.w > pb.x && nb.y < pb.y + pb.h && nb.y + nb.h > pb.y)) {
        this.x += r.dx;
        this.y += r.dy;
      }
      this.moving = r.dx !== 0 || r.dy !== 0;
      this.dir = vecDir({ x: this.vx, y: this.vy }, this.dir);
      if (r.hitX || r.hitY) this.wanderT = 0;
    } else this.moving = false;
    this.animate();
  }
}
