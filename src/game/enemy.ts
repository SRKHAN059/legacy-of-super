import { ENEMIES, type BossMove, type BossPhase, type EnemyDef } from '../content/enemies';
import { audio } from '../engine/audio';
import { dirVec, dist, norm, vecDir, type Dir, type Rect } from '../engine/math';
import { Actor } from './actor';
import type { Field } from './field';
import { Beam, Shot } from './projectiles';

type EState =
  | 'idle' | 'wander' | 'chase' | 'windup' | 'strike' | 'recover' | 'charging' | 'swoop'
  | 'flame' | 'dying' | 'move' | 'vanish' | 'grab' | 'ended';

const AGGRO = 110;
const LEASH = 220;

/**
 * Boss poise (LoG2's chase-lock: a boss can be pinned by a combo briefly, then recovers and counters).
 * An ordinary hit puts at most BOSS_HITSTUN frames of hitstun on a boss; after BOSS_POISE_HITS hits (or
 * BOSS_POISE_FRAMES of accumulated hitstun) without a BOSS_POISE_RESET-frame pause, the boss breaks free:
 * a shockwave shoves the player back, it ignores hitstun for BOSS_ARMOR frames and opens with a counter move.
 */
export const BOSS_HITSTUN = 6;
export const BOSS_POISE_HITS = 5;
export const BOSS_POISE_FRAMES = 45;
export const BOSS_POISE_RESET = 50;
export const BOSS_ARMOR = 60;
/** Stun techniques (Burning Attack, Spirit Bomb) hold a boss this long (LoG2: 1-2 s), then it breaks free. */
export const BOSS_TECH_STUN = 90;
/** Frames a boss stays stunned after being hit out of a bull-charge wind-up. */
const BOSS_CHARGE_PUNISH = 40;
/** Counter moves a boss may open with after breaking free (used when its current phase knows them). */
const COUNTER_MOVES: readonly BossMove[] = ['teleport', 'timeSkip', 'dash', 'charge', 'nova', 'volley', 'guard'];

/**
 * Max HP of a spawned enemy. Late-tier regular enemies (T6/T7, Guide §6) are trimmed by up to 25% so
 * fights stay at ~12-18 hits as hero HP and damage compound; bosses keep their authored HP.
 */
export function enemyMaxHp(def: EnemyDef): number {
  if (def.ai === 'boss' || def.invulnerable) return def.hp;
  const k = Math.max(0, Math.min(1, (Math.max(def.str, def.pow) - 44) / 14));
  return Math.max(1, Math.round(def.hp * (1 - 0.25 * k)));
}

/** A hostile actor: regular enemy or boss. */
export class Enemy extends Actor {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  state: EState = 'wander';
  t = 0;
  cd = 0;
  /** Stun frames (ki blast hitstun, Burning Attack, pose freeze). */
  stun = 0;
  /** Glows when a stun is about to end. */
  stunGlow = false;
  frozen = 0;
  homeX: number;
  homeY: number;
  aggro = false;
  dead = false;
  /** Unique spawn id (bosses / one-offs). */
  uid?: string;
  onDefeat?: string;
  /** Target direction for charges/dashes. */
  private vx = 0;
  private vy = 0;
  private wanderT = 0;
  private hitCount = 0;
  /** Boss state. */
  private move: BossMove | null = null;
  private phaseIdx = -1;
  private refilled = false;
  private guardT = 0;
  private hitPlayer = false;
  private grabT = 0;
  private marks: Array<{ x: number; y: number; t: number }> = [];
  /** Set when a scripted boss fight reaches its end threshold. */
  ended = false;
  /** Script-driven: AI disabled. */
  puppet = false;
  private staminaAcc = 0;
  /** Boss poise: hits and hitstun absorbed since the last pause, frames since the last hit. */
  private poiseHits = 0;
  private poiseFrames = 0;
  private sinceHit = 9999;
  /** Frames left of stun immunity after a boss breaks free. */
  armorT = 0;
  /** The current stun came from a stun technique / punish: the boss breaks free when it ends. */
  private heldByTech = false;
  /**
   * Cloak strength 0..1 (an invisible fighter such as Gamisalas): drawn at (1 - cloak) of its opacity, with no
   * ground shadow while mostly cloaked. A hit flash always shows through. Scripts set it each frame from their cues.
   */
  cloak = 0;

  constructor(type: string, x: number, y: number) {
    const def = ENEMIES[type];
    if (!def) throw new Error(`Unknown enemy type "${type}"`);
    super(def.sprite, x, y);
    this.def = def;
    this.hp = enemyMaxHp(def);
    this.maxHp = this.hp;
    this.homeX = x;
    this.homeY = y;
    if (def.box) { this.w = def.box.w; this.h = def.box.h; }
    if (def.ai === 'boss') this.aggro = true;
    if (def.ai === 'hazard') this.state = 'move';
  }

  get isBoss(): boolean {
    return this.def.ai === 'boss';
  }

  get flying(): boolean {
    return !!this.def.flying || this.def.ai === 'flyer';
  }

  get absorbsKi(): boolean {
    return !!this.def.absorbKi || !!this.def.boss?.absorbKi;
  }

  /** Damage reduction while guarding. */
  get guarding(): boolean {
    return this.guardT > 0;
  }

  /**
   * Called by the field after damage was applied. `techStun` marks a stun technique (Burning Attack,
   * Spirit Bomb): on bosses it bypasses the hitstun cap for BOSS_TECH_STUN frames.
   */
  onHit(f: Field, knock: { x: number; y: number }, stun: number, techStun = false): void {
    this.flash = 4;
    this.aggro = true;
    this.hitCount++;
    if (this.isBoss) {
      // Bosses shrug off most knockback; while breaking free they barely move at all.
      const k = this.armorT > 0 ? 0.2 : 0.5;
      this.kx = knock.x * k;
      this.ky = knock.y * k;
      if (this.armorT > 0 || this.state === 'dying') return;
      if (this.state === 'windup' && this.move === 'charge') {
        // Hitting a boss out of its bull-charge wind-up cancels the charge and staggers it (LoG2 punish).
        this.endMove();
        this.holdStun(BOSS_CHARGE_PUNISH);
        return;
      }
      if (techStun && stun > 0) { this.holdStun(Math.min(stun, BOSS_TECH_STUN)); return; }
      // Already held by a technique: extra hits neither extend nor break the hold.
      if (this.heldByTech && this.stun > 0) return;
      const s = Math.min(stun, BOSS_HITSTUN);
      if (this.sinceHit > BOSS_POISE_RESET) { this.poiseHits = 0; this.poiseFrames = 0; }
      this.sinceHit = 0;
      this.poiseHits++;
      this.poiseFrames += s;
      this.stun = Math.max(this.stun, s);
      if (this.poiseHits >= BOSS_POISE_HITS || this.poiseFrames >= BOSS_POISE_FRAMES) this.breakFree(f);
    } else {
      this.kx = knock.x;
      this.ky = knock.y;
      if (this.state === 'windup' && this.def.ai === 'charger') this.stun = 60;
      this.stun = Math.max(this.stun, stun);
      if (this.state !== 'dying') this.state = 'chase';
    }
  }

  /** Long stun (technique / punish) on a boss; it breaks free and counters when the stun runs out. */
  private holdStun(frames: number): void {
    this.stun = Math.max(this.stun, frames);
    this.heldByTech = true;
    this.poiseHits = 0;
    this.poiseFrames = 0;
  }

  /** Boss recovers from a chase-lock: shockwave, brief stun immunity and a counter move. */
  private breakFree(f: Field): void {
    if (this.state === 'grab') f.player.grabbed = 0;
    this.stun = 0;
    this.frozen = 0;
    this.heldByTech = false;
    this.poiseHits = 0;
    this.poiseFrames = 0;
    this.armorT = BOSS_ARMOR;
    this.flash = 6;
    this.alpha = 1;
    const p = f.player;
    const color = this.def.boss?.kiColor ?? '#f8f0c0';
    f.fx.explode(this.x, this.y - 12, 16, color);
    f.camera.shake(6, 2);
    audio.sfx('blastHit');
    if (dist(this, p) < 34) f.damagePlayer(this.def.str, 0.4, this.x, this.y);
    const moves = this.phase()?.moves ?? [];
    const options = COUNTER_MOVES.filter((m) => moves.includes(m));
    if (!options.length) { this.endMove(); return; }
    this.move = f.rng.pick(options);
    this.state = 'windup';
    this.t = 0;
    this.hitPlayer = false;
  }

  update(f: Field): void {
    if (this.flash > 0) this.flash--;
    if (this.cd > 0) this.cd--;
    if (this.guardT > 0) this.guardT--;
    if (this.armorT > 0) this.armorT--;
    if (this.sinceHit < 9999) this.sinceHit++;
    if (this.kx || this.ky) {
      const r = f.col.move(this.box(), this.kx, this.ky, this.flying);
      this.x += r.dx;
      this.y += r.dy;
      // Tournament of Power: a hard knock into the void is a ring-out.
      if ((r.hitX || r.hitY) && Math.hypot(this.kx, this.ky) > 1.2 && this.state !== 'dying' && !this.ended) {
        if (f.canRingOut(this) && f.voidAt(this.x + Math.sign(this.kx) * (this.w / 2 + 4), this.y + Math.sign(this.ky) * 4)) {
          f.ringOut(this);
          return;
        }
      }
      this.kx *= 0.75;
      this.ky *= 0.75;
      if (Math.abs(this.kx) < 0.1) this.kx = 0;
      if (Math.abs(this.ky) < 0.1) this.ky = 0;
    }
    if (this.state === 'dying') { this.t++; this.updateDying(f); return; }
    if (this.puppet || this.ended) { this.t++; this.animate(); return; }
    // Frozen / stunned enemies pause their current move (its frame counter `t` does not advance), so a
    // move's timed frames (shots, strikes, summons) fire late instead of being skipped.
    if (this.frozen > 0) { this.frozen--; this.moving = false; return; }
    if (this.stun > 0) {
      this.stun--;
      this.stunGlow = this.stun > 0 && this.stun < 30;
      this.pose = 'hurt';
      this.moving = false;
      if (this.stun === 0 && this.heldByTech && this.isBoss) this.breakFree(f);
      return;
    }
    this.heldByTech = false;
    this.stunGlow = false;
    this.t++;
    if (this.isBoss) this.updateBoss(f);
    else this.updateRegular(f);
    this.animate();
  }

  // ------------------------------------------------------------------ regular AI

  private stepToward(f: Field, tx: number, ty: number, speed: number): void {
    const v = norm({ x: tx - this.x, y: ty - this.y });
    const r = f.col.move(this.box(), v.x * speed, v.y * speed, this.flying);
    this.x += r.dx;
    this.y += r.dy;
    this.moving = r.dx !== 0 || r.dy !== 0;
    if (Math.abs(v.x) + Math.abs(v.y) > 0) this.dir = vecDir(v, this.dir);
  }

  private wander(f: Field): void {
    this.wanderT--;
    if (this.wanderT <= 0) {
      this.wanderT = 40 + f.rng.int(0, 60);
      const a = f.rng.next() * Math.PI * 2;
      const home = dist(this, { x: this.homeX, y: this.homeY }) > 48;
      if (home) { const v = norm({ x: this.homeX - this.x, y: this.homeY - this.y }); this.vx = v.x; this.vy = v.y; }
      else if (f.rng.chance(0.35)) { this.vx = 0; this.vy = 0; }
      else { this.vx = Math.cos(a); this.vy = Math.sin(a); }
    }
    if (this.vx || this.vy) {
      const sp = this.def.speed * 0.5;
      const r = f.col.move(this.box(), this.vx * sp, this.vy * sp, this.flying);
      this.x += r.dx;
      this.y += r.dy;
      this.moving = true;
      this.dir = vecDir({ x: this.vx, y: this.vy }, this.dir);
      if (r.hitX || r.hitY) this.wanderT = 0;
    } else this.moving = false;
  }

  /** Melee reach rectangle in front. */
  private front(reach: number): Rect {
    const v = dirVec(this.dir);
    const half = 9;
    if (v.x !== 0) return { x: v.x > 0 ? this.x + 2 : this.x - 2 - reach, y: this.y - 20, w: reach, h: 20 };
    if (v.y > 0) return { x: this.x - half, y: this.y - 8, w: half * 2, h: reach };
    return { x: this.x - half, y: this.y - 18 - reach, w: half * 2, h: reach };
  }

  private updateRegular(f: Field): void {
    const p = f.player;
    const d = dist(this, p);
    if (!this.aggro && d < AGGRO && f.canFight) this.aggro = true;
    if (this.aggro && d > LEASH) this.aggro = false;
    if (!f.canFight) this.aggro = false;
    this.pose = 'idle';
    const ai = this.def.ai;

    if (ai === 'hazard') { this.updateHazard(f); return; }
    if (ai === 'idle') { this.moving = false; return; }
    if (!this.aggro && this.state !== 'windup' && this.state !== 'strike' && this.state !== 'charging') {
      this.state = 'wander';
      if (ai === 'flyer') this.hover(f);
      else this.wander(f);
      return;
    }

    switch (this.state) {
      case 'wander':
      case 'idle':
      case 'chase':
      case 'move':
        this.state = 'chase';
        if (ai === 'shooter') this.shooter(f, d);
        else if (ai === 'charger') this.chargerSeek(f);
        else if (ai === 'flyer') this.flyerSeek(f, d);
        else if (ai === 'heavy') this.heavySeek(f, d);
        else this.rusher(f, d, ai === 'reach' ? 26 : 18);
        break;
      case 'windup':
        this.moving = false;
        this.pose = ai === 'charger' || ai === 'heavy' ? 'charge' : 'idle';
        if (ai === 'charger' && this.t % 4 < 2) this.x += this.t % 8 < 4 ? 1 : -1;
        if (this.t >= (ai === 'charger' ? 30 : ai === 'heavy' ? 20 : 12)) {
          this.state = ai === 'charger' ? 'charging' : ai === 'heavy' && d < 40 ? 'flame' : 'strike';
          this.t = 0;
          this.hitPlayer = false;
        }
        break;
      case 'strike': {
        this.pose = 'punch1';
        if (this.t === 2) {
          const reach = ai === 'reach' ? 26 : 20;
          if (f.hitsPlayer(this.front(reach))) f.damagePlayer(this.def.str, 0.5, this.x, this.y);
          audio.sfx('punch');
        }
        if (this.t >= 10) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'flame': {
        this.pose = 'blast';
        const fr = this.front(34);
        if (this.t % 4 === 0) f.fx.aura(fr.x + fr.w / 2, fr.y + fr.h, '#f88020', 2);
        if (this.t % 10 === 0 && f.hitsPlayer(fr)) f.damagePlayer(this.def.pow, 0.45, this.x, this.y);
        if (this.t >= 40) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'charging': {
        this.pose = 'punch1';
        const sp = 3.6;
        const r = f.col.move(this.box(), this.vx * sp, this.vy * sp, this.flying);
        this.x += r.dx;
        this.y += r.dy;
        this.moving = true;
        if (!this.hitPlayer && f.hitsPlayer(this.body())) { this.hitPlayer = true; f.damagePlayer(this.def.str, 1.2, this.x, this.y); }
        if (r.hitX || r.hitY || this.t > 50) { this.state = 'recover'; this.t = 0; if (r.hitX || r.hitY) f.camera.shake(6, 1); }
        break;
      }
      case 'swoop': {
        this.pose = 'punch1';
        const r = f.col.move(this.box(), this.vx * 3, this.vy * 3, true);
        this.x += r.dx;
        this.y += r.dy;
        if (!this.hitPlayer && f.hitsPlayer(this.body())) { this.hitPlayer = true; f.damagePlayer(this.def.str, 0.9, this.x, this.y); }
        if (this.t > 26) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'recover':
        this.moving = false;
        if (this.t >= (ai === 'charger' ? 45 : 30)) { this.state = 'chase'; this.t = 0; this.cd = 40 + f.rng.int(0, 40); }
        break;
      default:
        this.state = 'chase';
    }
  }

  private rusher(f: Field, d: number, reach: number): void {
    const p = f.player;
    if (d > reach) this.stepToward(f, p.x, p.y, this.def.speed);
    else {
      this.moving = false;
      this.faceTo(p.x, p.y);
      if (this.cd <= 0) { this.state = 'windup'; this.t = 0; }
    }
  }

  private shooter(f: Field, d: number): void {
    const p = f.player;
    if (d < 56) this.stepToward(f, this.x * 2 - p.x, this.y * 2 - p.y, this.def.speed);
    else if (d > 104) this.stepToward(f, p.x, p.y, this.def.speed);
    else { this.moving = false; this.faceTo(p.x, p.y); }
    if (this.cd <= 0 && d < 150) {
      const s = this.def.shot ?? { color: '#f06060', cooldown: 90, speed: 2.2, mult: 0.8 };
      const v = norm({ x: p.x - this.x, y: p.y - this.y });
      const shot = new Shot('enemy', s.color === '#d0d0d0' ? 'rocket' : 'shot', this.x + v.x * 8, this.y + v.y * 4, v, s.speed, s.mult, s.color, this.def.pow, 0);
      f.spawnShot(shot);
      this.pose = 'blast';
      this.cd = s.cooldown + f.rng.int(0, 30);
      audio.sfx('blast');
    }
  }

  private chargerSeek(f: Field): void {
    const p = f.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const aligned = Math.abs(dx) < 10 || Math.abs(dy) < 10;
    if (aligned && Math.hypot(dx, dy) < 130 && this.cd <= 0) {
      this.faceTo(p.x, p.y);
      const v = dirVec(this.dir);
      this.vx = v.x;
      this.vy = v.y;
      this.state = 'windup';
      this.t = 0;
      return;
    }
    // Line up on the nearer axis.
    if (Math.abs(dx) < Math.abs(dy)) this.stepToward(f, p.x, this.y, this.def.speed);
    else this.stepToward(f, this.x, p.y, this.def.speed);
  }

  private hover(f: Field): void {
    const a = (this.t / 60) + (this.homeX % 7);
    this.stepToward(f, this.homeX + Math.cos(a) * 30, this.homeY + Math.sin(a) * 18, this.def.speed * 0.6);
    this.z = 10;
  }

  private flyerSeek(f: Field, d: number): void {
    const p = f.player;
    this.z = 10;
    const a = this.t / 40;
    this.stepToward(f, p.x + Math.cos(a) * 52, p.y + Math.sin(a) * 36, this.def.speed);
    if (this.cd <= 0 && d < 90) {
      const v = norm({ x: p.x - this.x, y: p.y - this.y });
      this.vx = v.x;
      this.vy = v.y;
      this.faceTo(p.x, p.y);
      this.state = 'swoop';
      this.t = 0;
      this.hitPlayer = false;
      this.cd = 90 + f.rng.int(0, 40);
    }
  }

  private heavySeek(f: Field, d: number): void {
    const p = f.player;
    if (d > 30) this.stepToward(f, p.x, p.y, this.def.speed);
    else this.moving = false;
    this.faceTo(p.x, p.y);
    if (d < 44 && this.cd <= 0) { this.state = 'windup'; this.t = 0; }
  }

  private updateHazard(f: Field): void {
    const v = dirVec(this.dir);
    const r = f.col.move(this.box(), v.x * this.def.speed, v.y * this.def.speed, false);
    this.x += r.dx;
    this.y += r.dy;
    this.moving = true;
    if (r.hitX || r.hitY || dist(this, { x: this.homeX, y: this.homeY }) > 160) {
      this.dir = this.dir === 'left' ? 'right' : this.dir === 'right' ? 'left' : this.dir === 'up' ? 'down' : 'up';
      this.x -= v.x * 2;
      this.y -= v.y * 2;
    }
    if (f.hitsPlayer(this.body()) && f.player.inv <= 0) f.damagePlayer(this.def.str, 1, this.x, this.y);
  }

  private updateDying(f: Field): void {
    this.pose = 'hurt';
    if (this.def.ai === 'exploder') {
      this.flash = this.t % 6 < 3 ? 2 : 0;
      this.x += this.t % 4 < 2 ? 1 : -1;
      if (this.t >= 40) {
        f.fx.explode(this.x, this.y - 8, 26, '#f8a030');
        audio.sfx('explode');
        // The blast hits as hard as the creature's strongest attack stat (summing STR+POW inside the cubic stat
        // curve made it 5-8x the creature's own strike).
        if (dist(this, f.player) < 32) f.damagePlayer(Math.max(this.def.pow, this.def.str), 1.1, this.x, this.y);
        this.dead = true;
      }
      return;
    }
    this.alpha = 1 - this.t / 24;
    this.pose = 'ko';
    if (this.t >= 24) this.dead = true;
  }

  /** Start the death sequence. */
  die(): void {
    this.state = 'dying';
    this.t = 0;
    this.stun = 0;
    this.frozen = 0;
  }

  // ------------------------------------------------------------------ boss AI

  private phase(): BossPhase | null {
    const b = this.def.boss;
    if (!b) return null;
    const frac = this.hp / this.maxHp;
    for (let i = 0; i < b.phases.length; i++) if (frac > b.phases[i].until || i === b.phases.length - 1) return b.phases[i];
    return null;
  }

  private updateBoss(f: Field): void {
    const b = this.def.boss;
    if (!b) return;
    const p = f.player;
    const ph = this.phase();
    if (!ph) return;
    const idx = b.phases.indexOf(ph);
    if (idx !== this.phaseIdx) {
      this.phaseIdx = idx;
      if (ph.onStart) f.runScript(ph.onStart);
    }
    if (b.stamina) {
      this.staminaAcc += (b.stamina * this.maxHp) / 60;
      while (this.staminaAcc >= 1) { this.staminaAcc -= 1; this.hp = Math.max(1, this.hp - 1); }
    }
    if (b.refillAt !== undefined && !this.refilled && this.hp / this.maxHp <= b.refillAt) {
      this.refilled = true;
      this.maxHp = b.refillTo ?? this.maxHp;
      this.hp = this.maxHp;
      f.fx.number(this.x, this.y - 30, 'FULL POWER', '#40e040');
      f.flashScreen('#ffffff', 10);
      audio.sfx('powerUp');
    }
    const speed = this.def.speed * (ph.speed ?? 1);
    const d = dist(this, p);
    const kiColor = b.kiColor ?? '#f8e070';

    // Pending ki-rain marks.
    for (const m of this.marks) {
      m.t--;
      if (m.t === 0) {
        f.fx.explode(m.x, m.y, 14, kiColor);
        audio.sfx('blastHit');
        if (Math.hypot(p.x - m.x, p.y - m.y) < 16) f.damagePlayer(this.def.pow, 0.8, m.x, m.y);
      }
    }
    this.marks = this.marks.filter((m) => m.t > 0);

    if (this.state === 'wander' || this.state === 'idle' || this.state === 'chase') {
      // Rest: drift toward a comfortable range.
      this.pose = 'idle';
      if (d > 70) this.stepToward(f, p.x, p.y, speed * 0.8);
      else if (d < 34) this.stepToward(f, this.x * 2 - p.x, this.y * 2 - p.y, speed * 0.6);
      else { this.moving = false; this.faceTo(p.x, p.y); }
      if (this.t >= ph.rest) {
        this.move = f.rng.pick(ph.moves);
        this.state = 'windup';
        this.t = 0;
        this.hitPlayer = false;
      }
      return;
    }

    const mv = this.move ?? 'chase';
    switch (mv) {
      case 'chase': {
        if (this.state === 'windup') { this.state = 'move'; this.t = 0; }
        if (this.state === 'move') {
          if (d > 18) this.stepToward(f, p.x, p.y, speed * 1.3);
          else { this.faceTo(p.x, p.y); this.state = 'strike'; this.t = 0; this.hitCount = 0; }
          if (this.t > 120) this.endMove();
        } else if (this.state === 'strike') {
          this.moving = false;
          const step = Math.floor(this.t / 9);
          this.pose = step % 2 ? 'punch2' : 'punch1';
          if (this.t % 9 === 3) {
            if (f.hitsPlayer(this.front(20))) f.damagePlayer(this.def.str, step === 2 ? 0.9 : 0.6, this.x, this.y);
            audio.sfx('punch');
          }
          if (this.t >= 27) this.endMove();
        }
        break;
      }
      case 'shot':
      case 'volley':
      case 'nova': {
        this.moving = false;
        this.faceTo(p.x, p.y);
        this.pose = this.t < 14 ? 'charge' : 'blast';
        if (this.t < 14 && this.t % 3 === 0) f.fx.aura(this.x, this.y, kiColor, 1);
        const fire = (vx: number, vy: number) => {
          const s = new Shot('enemy', 'ball', this.x + vx * 10, this.y + vy * 6, { x: vx, y: vy }, 2.4, 0.8, kiColor, this.def.pow, 0);
          s.r = 4;
          f.spawnShot(s);
        };
        if (mv === 'shot' && (this.t === 14 || this.t === 26 || this.t === 38)) {
          const v = norm({ x: p.x - this.x, y: p.y - this.y });
          fire(v.x, v.y);
          audio.sfx('blast');
        }
        if (mv === 'volley' && this.t === 18) {
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = -2; i <= 2; i++) fire(Math.cos(base + i * 0.28), Math.sin(base + i * 0.28));
          audio.sfx('blast');
        }
        if (mv === 'nova' && this.t === 20) {
          for (let i = 0; i < 12; i++) fire(Math.cos((i / 12) * Math.PI * 2), Math.sin((i / 12) * Math.PI * 2));
          audio.sfx('explode');
          f.camera.shake(8, 2);
        }
        if (this.t >= 50) this.endMove();
        break;
      }
      case 'rain': {
        this.moving = false;
        this.pose = 'raise';
        if (this.t === 10) {
          for (let i = 0; i < 5; i++) this.marks.push({ x: p.x + f.rng.int(-40, 40), y: p.y + f.rng.int(-30, 30), t: 40 + i * 6 });
          this.marks.push({ x: p.x, y: p.y, t: 46 });
          audio.sfx('charge');
        }
        if (this.t >= 60) this.endMove();
        break;
      }
      case 'beam': {
        this.moving = false;
        if (this.t === 1) {
          this.faceTo(p.x, p.y);
          const v = dirVec(this.dir);
          const beam = new Beam('enemy', this.x + v.x * 10, this.y + v.y * 6, this.dir, 8, kiColor, 0.35, true, this.def.pow, 0);
          beam.warn = 36;
          beam.life = 36 + 40;
          f.addBeam(beam);
          audio.sfx('charge');
        }
        this.pose = this.t < 36 ? 'charge' : 'blast';
        if (this.t === 36) audio.sfx('beam');
        if (this.t >= 80) this.endMove();
        break;
      }
      case 'dash':
      case 'charge': {
        if (this.state === 'windup') {
          this.pose = 'charge';
          if (this.t === 1) {
            const v = mv === 'charge' ? dirVec(vecDir({ x: p.x - this.x, y: p.y - this.y })) : norm({ x: p.x - this.x, y: p.y - this.y });
            this.vx = v.x;
            this.vy = v.y;
            this.faceTo(p.x, p.y);
          }
          if (this.t % 4 < 2) this.x += this.t % 8 < 4 ? 1 : -1;
          if (this.t >= (mv === 'charge' ? 28 : 16)) { this.state = 'move'; this.t = 0; audio.sfx('dash'); }
        } else {
          this.pose = 'punch1';
          const sp = mv === 'charge' ? 4 : 5;
          const r = f.col.move(this.box(), this.vx * sp, this.vy * sp, this.flying);
          this.x += r.dx;
          this.y += r.dy;
          this.moving = true;
          if (this.t % 3 === 0) f.fx.dust(this.x, this.y);
          if (!this.hitPlayer && f.hitsPlayer(this.body())) { this.hitPlayer = true; f.damagePlayer(this.def.str, 1.1, this.x, this.y); }
          if (r.hitX || r.hitY || this.t > 30) { if (r.hitX || r.hitY) f.camera.shake(6, 2); this.endMove(); }
        }
        break;
      }
      case 'teleport':
      case 'timeSkip': {
        if (this.t === 1) {
          audio.sfx('teleport');
          if (mv === 'timeSkip') { f.timeSkip(36); }
        }
        if (this.t < 16) { this.alpha = 1 - this.t / 16; this.moving = false; }
        if (this.t === 16) {
          const v = dirVec(p.dir);
          const tx = p.x - v.x * 18;
          const ty = p.y - v.y * 14;
          if (!f.col.blocked({ x: tx - this.w / 2, y: ty - this.h, w: this.w, h: this.h }, this.flying)) { this.x = tx; this.y = ty; }
          this.faceTo(p.x, p.y);
        }
        if (this.t > 16 && this.t < 26) this.alpha = (this.t - 16) / 10;
        if (this.t === 28) {
          this.alpha = 1;
          this.pose = 'punch2';
          if (f.hitsPlayer(this.front(22))) f.damagePlayer(this.def.str, mv === 'timeSkip' ? 1.2 : 1, this.x, this.y);
          audio.sfx('hit');
        }
        if (this.t >= 40) { this.alpha = 1; this.endMove(); }
        break;
      }
      case 'summon': {
        this.pose = 'raise';
        this.moving = false;
        if (this.t === 12 && b.minion) {
          const n = f.enemies.filter((e) => e.def.id === b.minion && !e.dead).length;
          for (let i = n; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const ex = this.x + Math.cos(a) * 28;
            const ey = this.y + Math.sin(a) * 20;
            if (!f.col.blocked({ x: ex - 6, y: ey - 6, w: 12, h: 6 })) f.spawnEnemy(b.minion, ex, ey);
          }
          f.fx.explode(this.x, this.y - 10, 18, kiColor);
          audio.sfx('teleport');
        }
        if (this.t >= 40) this.endMove();
        break;
      }
      case 'drain': {
        if (this.state === 'windup') {
          this.pose = 'charge';
          if (this.t >= 18) { this.state = 'move'; this.t = 0; const v = norm({ x: p.x - this.x, y: p.y - this.y }); this.vx = v.x; this.vy = v.y; this.faceTo(p.x, p.y); }
        } else if (this.state === 'move') {
          this.pose = 'punch1';
          const r = f.col.move(this.box(), this.vx * 3.4, this.vy * 3.4, this.flying);
          this.x += r.dx;
          this.y += r.dy;
          if (f.hitsPlayer(this.body()) && p.inv <= 0) {
            this.state = 'grab';
            this.t = 0;
            this.grabT = 0;
            p.grabbed = 300;
          }
          if (r.hitX || r.hitY || this.t > 34) this.endMove();
        } else if (this.state === 'grab') {
          this.pose = 'guard';
          this.grabT++;
          if (this.grabT % 15 === 0) {
            const dealt = f.damagePlayer(this.def.pow, 0.12, this.x, this.y, { noKnock: true, noInv: true });
            this.hp = Math.min(this.maxHp, this.hp + dealt);
            f.fx.number(this.x, this.y - 30, dealt, '#40e040');
          }
          if (p.grabbed <= 0 || this.grabT > 480) { p.grabbed = 0; this.endMove(); }
        }
        break;
      }
      case 'guard':
        this.pose = 'guard';
        this.moving = false;
        if (this.t === 1) this.guardT = 70;
        if (this.t >= 70) this.endMove();
        break;
    }
  }

  private endMove(): void {
    this.state = 'chase';
    this.t = 0;
    this.move = null;
    this.alpha = 1;
    this.pose = 'idle';
  }

  /** Ground shadow, left out while the enemy is mostly cloaked. */
  override drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.cloak > 0.5) return;
    super.drawShadow(ctx, cx, cy);
  }

  /** Sprite at the cloak's opacity; a hit flash always shows at full strength. */
  override draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.cloak <= 0 || this.flash > 0) { super.draw(ctx, cx, cy); return; }
    const alpha = this.alpha;
    this.alpha = alpha * (1 - Math.min(1, this.cloak));
    super.draw(ctx, cx, cy);
    this.alpha = alpha;
  }

  /** Render pending boss ki-rain target markers. */
  renderMarks(ctx: CanvasRenderingContext2D, cx: number, cy: number, tick: number): void {
    for (const m of this.marks) {
      const r = 4 + (m.t % 10) / 2;
      ctx.strokeStyle = tick % 4 < 2 ? '#f84040' : '#f8f040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(Math.round(m.x - cx), Math.round(m.y - cy), r * 2, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Face a direction (script helper). */
  face(d: Dir): void {
    this.dir = d;
  }
}
