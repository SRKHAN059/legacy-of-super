import { PAL } from '../art/color';
import { CHARACTERS, type CharId } from '../content/characters';
import { ENEMIES } from '../content/enemies';
import { DROP_RESTORE, ITEMS, type DropKind } from '../content/items';
import { TECHNIQUES } from '../content/techniques';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W, TILE } from '../engine/constants';
import { wrap } from '../engine/fontdata';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import { center, dirVec, overlaps, type Dir, type Rect, Rng } from '../engine/math';
import type { Scene } from '../engine/scene';
import { Camera } from './camera';
import type { CollisionMap } from './collision';
import { Effects } from './effects';
import { Enemy } from './enemy';
import type { Game } from './game';
import { drawHud } from './hud';
import { critChance, damage, ENEMY_POWER, enemyPowerScale, KI_POWER, killExp, MELEE_POWER } from './leveling';
import type { MapDef, TriggerDef, WarpDef } from './mapdef';
import { Npc } from './npc';
import { Player } from './player';
import { Beam, Shot } from './projectiles';
import type { GameState } from './state';
import { MapInstance, type ObjInst } from './world';


interface Pickup {
  x: number;
  y: number;
  kind: DropKind | 'item';
  item?: string;
  qty?: number;
  id?: string;
  t: number;
  hidden?: boolean;
}

/** Widest line a toast or banner draws before wrapping (screen minus a margin). */
const OVERLAY_TEXT_W = SCREEN_W - 20;

interface Toast {
  lines: string[];
  t: number;
  color: string;
}

/** Options for a melee hit test. */
export interface MeleeOpts {
  knock?: number;
  hitList?: Set<object>;
  stun?: number;
}

/** The main gameplay scene: one loaded map with everything on it. */
export class Field implements Scene {
  readonly game: Game;
  readonly map: MapInstance;
  readonly def: MapDef;
  readonly camera: Camera;
  readonly fx = new Effects();
  readonly rng: Rng;
  player: Player;
  npcs: Npc[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  beams: Beam[] = [];
  pickups: Pickup[] = [];
  tick = 0;
  /** Active boss for the HUD bar. */
  boss: Enemy | null = null;
  private waits: Array<{ test: () => boolean; resolve: () => void; abandonable: boolean }> = [];
  /** Set when another map replaced this field; scripted fights still waiting on it are abandoned. */
  abandoned = false;
  private screenFlash: { color: string; t: number; max: number } | null = null;
  private skipT = 0;
  fade = 0;
  fadeColor = '#000000';
  private toasts: Toast[] = [];
  private banner: { text: string; t: number } | null = null;
  /** Letterbox bars during cutscenes. */
  letterbox = 0;
  /** Override for the hostile flag (scripted fights in towns). */
  forceHostile: boolean | null = null;
  /** Edge-exit cooldown so arriving on an edge does not bounce back. */
  private exitCd = 30;
  private triggersInside = new Set<string>();
  /** Script-controlled screen tint (night, dreams). undefined = use the map's own tint. */
  tintOverride: string | null | undefined = undefined;
  /** Countdown timer shown on the HUD (seconds), or null. */
  timer: { frames: number; label: string } | null = null;

  constructor(game: Game, def: MapDef, x: number, y: number, dir: Dir) {
    this.game = game;
    this.def = def;
    this.rng = new Rng((game.state.data.seed ^ (game.state.data.playFrames * 2654435761)) >>> 0);
    this.map = new MapInstance(def, game.state);
    this.camera = new Camera(this.map.pw, this.map.ph);
    this.player = new Player(game.state.hero, x, y);
    this.player.dir = dir;
    this.spawnAll();
    this.camera.update({ x: this.player.x, y: this.player.y - 12 });
    if (!game.state.data.visited.includes(def.id)) game.state.data.visited.push(def.id);
  }

  // ------------------------------------------------------------------ accessors used by entities

  get input(): Input {
    return this.game.input;
  }

  get col(): CollisionMap {
    return this.map.col;
  }

  get state(): GameState {
    return this.game.state;
  }

  /** Combat allowed here (LoG2 hostile zone). */
  get hostile(): boolean {
    return this.forceHostile ?? !!this.def.hostile;
  }

  /** Player may attack right now. */
  get canFight(): boolean {
    return this.hostile && !this.locked && !this.carrying;
  }

  /** True while a scripted fight seals the map (no leaving, saving or warping). */
  get sealed(): boolean {
    return this.game.fightDepth > 0;
  }

  private sealNoticeT = 0;

  /** Feedback when the player tries to leave mid-fight. */
  private sealNotice(): void {
    if (this.tick - this.sealNoticeT < 90) return;
    this.sealNoticeT = this.tick;
    audio.sfx('denied');
    this.toast(["You can't leave in the middle of a fight!"], '#f86060');
  }

  /**
   * True while the player has no control: a cutscene owns the controls, or a door / map-edge transition is
   * fading (enemies, triggers and damage pause so nothing can happen to a field that is being left).
   */
  get locked(): boolean {
    return this.cutscene || this.game.inTransition;
  }

  /** A script holds the controls (HUD hidden). */
  private get cutscene(): boolean {
    return this.game.lockDepth > 0 && !this.game.allowControl;
  }

  // ------------------------------------------------------------------ setup

  private spawnAll(): void {
    const st = this.state;
    for (const n of this.def.npcs ?? []) {
      if (!st.check(n.showIf)) continue;
      if (n.hideIf && st.check(n.hideIf)) continue;
      this.npcs.push(new Npc(n, n.x * TILE + 8, n.y * TILE + 14));
    }
    for (const e of this.def.enemies ?? []) {
      if (!st.check(e.showIf)) continue;
      if (e.hideIf && st.check(e.hideIf)) continue;
      if (e.id && st.flag(`defeated:${e.id}`)) continue;
      if (!ENEMIES[e.type]) { console.error(`[field] unknown enemy ${e.type} on ${this.def.id}`); continue; }
      const en = new Enemy(e.type, e.x * TILE + 8, e.y * TILE + 14);
      en.uid = e.id;
      en.onDefeat = e.onDefeat;
      this.enemies.push(en);
    }
    for (const p of this.def.pickups ?? []) {
      if (st.flag(`pickup:${p.id}`) || !st.check(p.showIf)) continue;
      this.pickups.push({ x: p.x * TILE + 8, y: p.y * TILE + 12, kind: 'item', item: p.item, qty: p.qty ?? 1, id: p.id, t: 0, hidden: p.hidden });
    }
    // A fixed item knocked out of a breakable waits where it fell until it is picked up, even after leaving the map.
    for (const o of this.map.objects) {
      const d = o.def;
      if (d.type !== 'breakable' || !d.item || !d.id || !o.gone || st.flag(`pickup:${d.id}`)) continue;
      const c = center(o.rect);
      this.pickups.push({ x: c.x, y: c.y + 4, kind: 'item', item: d.item, qty: 1, id: d.id, t: 0 });
    }
  }

  /** Spawn an enemy at runtime (summons, scripted fights). */
  spawnEnemy(type: string, x: number, y: number, uid?: string): Enemy {
    const e = new Enemy(type, x, y);
    e.uid = uid;
    e.aggro = true;
    this.enemies.push(e);
    return e;
  }

  /** Add an NPC at runtime (cutscene actors). Coordinates in pixels. */
  addNpc(id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): Npc {
    const n = new Npc({ id, sprite, x: 0, y: 0, talk: '', dir, name }, x, y);
    this.npcs.push(n);
    return n;
  }

  // ------------------------------------------------------------------ waits for scripts

  /**
   * Resolve when `test` becomes true (checked every tick). An `abandonable` wait (scripted fights) is also
   * re-tested once when another map replaces this field, so its test can notice `abandoned`.
   */
  until(test: () => boolean, abandonable = false): Promise<void> {
    if (test()) return Promise.resolve();
    return new Promise((resolve) => this.waits.push({ test, resolve, abandonable }));
  }

  /** Called when another field replaces this one: settle the abandonable waits (see ScriptApi.fight). */
  abandon(): void {
    this.abandoned = true;
    const ready = this.waits.filter((w) => w.abandonable && w.test());
    this.waits = this.waits.filter((w) => !ready.includes(w));
    for (const w of ready) w.resolve();
  }

  /** Resolve after n ticks. */
  wait(frames: number): Promise<void> {
    const end = this.tick + Math.max(1, Math.round(frames));
    return this.until(() => this.tick >= end);
  }

  // ------------------------------------------------------------------ combat API

  spawnShot(s: Shot): void {
    this.shots.push(s);
  }

  addBeam(b: Beam): void {
    b.trace(this.col);
    this.beams.push(b);
  }

  /** True when a rect overlaps the player's hurtbox and the player can be hit. */
  hitsPlayer(r: Rect): boolean {
    return overlaps(r, this.player.body());
  }

  /**
   * Damage the player. Returns damage dealt (0 if invulnerable / dodged).
   * `atk` is the attacker's STR or POW.
   */
  damagePlayer(atk: number, mult: number, fromX: number, fromY: number, opts: { noKnock?: boolean; noInv?: boolean } = {}): number {
    const p = this.player;
    if (p.state === 'dead' || this.locked) return 0;
    if (p.inv > 0 && !opts.noInv) return 0;
    const dodge = p.form?.dodge ?? 0;
    if (dodge > 0 && this.rng.chance(dodge)) {
      this.fx.number(p.x, p.y - 32, 'MISS', '#d0d8ff');
      p.inv = 20;
      return 0;
    }
    const dmg = damage({ power: ENEMY_POWER, mult: mult * enemyPowerScale(atk), stat: atk, end: p.end, res: 1, crit: false, r26: this.rng.int(0, 25) });
    p.cs.hp = Math.max(0, p.cs.hp - dmg);
    this.fx.number(p.x, p.y - 32, dmg, PAL.red);
    this.fx.hit(p.x, p.y - 14, '#ffffff', 4);
    audio.sfx('hurt');
    if (!opts.noKnock) p.onHurt(fromX, fromY);
    else { p.flash = 3; }
    if (this.carrying) {
      const c = this.carrying;
      this.carrying = null;
      this.fx.explode(p.x, p.y - 20, 10, '#f8f0d0');
      this.toast([`The ${c.label} broke!`], '#f86060');
      if (c.onBreak) this.runScript(c.onBreak);
    }
    if (p.cs.hp <= 0) this.playerDown();
    return dmg;
  }

  private playerDown(): void {
    const p = this.player;
    if (this.game.onPlayerDown?.()) return;
    p.state = 'dead';
    p.pose = 'ko';
    p.revert();
    this.carrying = null;
    audio.sfx('die');
    audio.stopMusic();
    void this.game.gameOver();
  }

  /** True when the map is a ring-out arena and this enemy can be knocked out of bounds. */
  canRingOut(e: Enemy): boolean {
    if (!this.def.ringOut || e.def.invulnerable) return false;
    return !e.isBoss || !!e.def.boss?.ringOut;
  }

  /** Terrain at a world pixel is the void. */
  voidAt(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const row = this.map.grid[ty];
    if (!row) return true;
    const t = row[tx];
    return t === undefined || t === 'void';
  }

  /** Eliminate an enemy by ring-out: counts as defeated (EXP, flags, onDefeat). */
  ringOut(e: Enemy): void {
    this.fx.number(e.x, e.y - 34, 'RING OUT!', '#f8e040');
    this.camera.shake(10, 2);
    if (e.isBoss && e.def.boss && e.def.boss.endAt > 0) {
      e.hp = Math.max(1, Math.ceil(e.maxHp * e.def.boss.endAt));
      e.ended = true;
      e.state = 'ended';
      e.hidden = true;
      return;
    }
    e.hp = 0;
    this.killEnemy(e);
    e.hidden = true;
  }

  /** Quest object being carried (LoG2 egg escort): no attacking; a hit breaks it. */
  carrying: { label: string; onBreak?: string } | null = null;

  /** Melee hit test against enemies, breakables, gates and bags. Returns enemies hit. */
  meleeHit(r: Rect, atk: number, mult: number, opts: MeleeOpts = {}): number {
    let n = 0;
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'dying' || e.def.invulnerable || e.hidden) continue;
      if (opts.hitList?.has(e)) continue;
      if (!overlaps(r, e.body())) continue;
      opts.hitList?.add(e);
      const v = dirVec(p.dir);
      this.applyDamage(e, atk, mult, { x: v.x * (opts.knock ?? 1.6), y: v.y * (opts.knock ?? 1.6) }, opts.stun ?? 12, false);
      n++;
    }
    this.hitWorld(r, opts.hitList);
    if (n > 0) audio.sfx('hit');
    return n;
  }

  /** Damage props / gates / bags inside a rect (melee or ki). */
  private hitWorld(r: Rect, hitList?: Set<object>): void {
    for (const o of this.map.objects) {
      if (o.gone || hitList?.has(o)) continue;
      if (!overlaps(r, o.rect)) continue;
      if (o.def.type === 'breakable') {
        hitList?.add(o);
        o.hp--;
        const c = center(o.rect);
        this.fx.hit(c.x, c.y, '#c0b0a0', 5);
        audio.sfx('block');
        if (o.hp <= 0) this.breakObject(o);
      } else if (o.def.type === 'bag') {
        hitList?.add(o);
        this.fx.hit(o.rect.x + 8, o.rect.y + 8, '#ffffff', 3);
        this.awardExp(1, false);
      }
    }
    for (const g of this.map.gates) {
      if (g.broken || hitList?.has(g)) continue;
      if (!overlaps(r, g.rect)) continue;
      hitList?.add(g);
      const hero = this.player.cs;
      const ok = g.def.character && g.def.character === hero.id && hero.level >= g.def.level;
      if (ok) {
        this.map.openGate(g);
        this.state.set(`gate:${this.def.id}:${g.def.id}`);
        const c = center(g.rect);
        this.fx.explode(c.x, c.y, 22, CHARACTERS[g.def.character as CharId]?.color ?? '#ffffff');
        this.camera.shake(12, 2);
        audio.sfx('explode');
      } else {
        audio.sfx('denied');
        this.fx.hit(center(g.rect).x, center(g.rect).y, '#ffffff', 3);
      }
    }
  }

  private breakObject(o: ObjInst): void {
    const c = center(o.rect);
    this.map.removeObject(o);
    this.fx.explode(c.x, c.y, 10, '#a09080');
    audio.sfx('blastHit');
    if (o.def.type !== 'breakable') return;
    if (o.def.id) this.state.set(`broke:${this.def.id}:${o.def.id}`);
    if (o.def.item) this.pickups.push({ x: c.x, y: c.y + 4, kind: 'item', item: o.def.item, qty: 1, id: o.def.id, t: 0 });
    else this.rollDrop(c.x, c.y + 4);
  }

  /** Core damage application to an enemy. `techStun`: the stun comes from a stun technique (see Enemy.onHit). */
  applyDamage(e: Enemy, atk: number, mult: number, knock: { x: number; y: number }, stun: number, ki: boolean, techStun = false): number {
    if (e.ended || e.dead) return 0;
    const b = e.def.boss;
    if (b?.vulnerableIf && !this.state.check(b.vulnerableIf)) {
      this.fx.number(e.x, e.y - 30, 'NO EFFECT', '#c0c0c0');
      audio.sfx('block');
      return 0;
    }
    if (ki && e.absorbsKi) {
      const heal = damage({ power: KI_POWER, mult, stat: atk, end: e.def.end, res: 1, crit: false, r26: 13 });
      e.hp = Math.min(e.maxHp, e.hp + heal);
      this.fx.number(e.x, e.y - 30, heal, '#40e040');
      return 0;
    }
    const crit = !ki && this.rng.chance(critChance(atk));
    const res = ki ? e.def.resKi ?? 1 : e.def.resMelee ?? 1;
    let dmg = damage({ power: ki ? KI_POWER : MELEE_POWER, mult, stat: atk, end: e.def.end, res, crit, r26: this.rng.int(0, 25) });
    if (e.guarding) dmg = Math.max(1, Math.round(dmg * 0.2));
    e.hp -= dmg;
    this.fx.number(e.x, e.y - (e.creatureSize || 32) - 2, dmg, crit ? '#f8f040' : '#ffffff');
    this.fx.hit(e.x, e.cy, crit ? '#f8f040' : '#ffffff', crit ? 8 : 5);
    if (crit) this.camera.shake(4, 1);
    e.onHit(this, knock, stun, techStun);
    const boss = e.def.boss;
    if (boss && boss.endAt > 0 && e.hp / e.maxHp <= boss.endAt) {
      e.hp = Math.max(1, Math.ceil(e.maxHp * boss.endAt));
      e.ended = true;
      e.state = 'ended';
      e.pose = 'hurt';
    } else if (e.hp <= 0) {
      e.hp = 0;
      this.killEnemy(e);
    }
    return dmg;
  }

  private killEnemy(e: Enemy): void {
    e.die();
    audio.sfx(e.isBoss ? 'explode' : 'blastHit');
    if (e.uid) this.state.set(`defeated:${e.uid}`);
    if (e.isBoss) { this.camera.shake(20, 3); this.flashScreen('#ffffff', 12); }
    if (e.def.exp > 0) {
      // Bosses grant scripted EXP (bypasses the clamp); regular kills use the ROM clamp.
      this.awardExp(e.isBoss ? e.def.exp : killExp(e.def.exp, this.player.cs.level), true);
    }
    if (e.def.drops !== 'none') this.rollDrop(e.x, e.y, e.def.drops === 'water');
    if (e.onDefeat) this.runScript(e.onDefeat);
  }

  /** Give EXP to the active character and show level-up popups. */
  awardExp(amount: number, show: boolean): void {
    const id = this.player.cs.id;
    const ups = this.state.gainExp(id, amount);
    if (show && amount > 1) this.fx.number(this.player.x, this.player.y - 42, `+${amount} EXP`, PAL.exp);
    for (const u of ups) {
      audio.sfx('levelUp');
      this.toast([`${CHARACTERS[id].name} reached Level ${u.level}!`, `Attribute bonus: STR+${u.str} POW+${u.pow} END+${u.end}`], PAL.gold);
      this.fx.explode(this.player.x, this.player.y - 14, 14, PAL.gold);
    }
  }

  /**
   * LoG2's standard on-death drop program (ROM): one roll of rand(100) checked as an if/elif chain;
   * health drops only when HP isn't full, energy only when EP isn't full. Water zones add 4% Fish.
   */
  private rollDrop(x: number, y: number, water = false): void {
    const cs = this.player.cs;
    const hpFull = cs.hp >= cs.hpMax;
    const epFull = cs.ep >= cs.epMax;
    if (water && this.state.count('fish') < 3 && this.rng.chance(0.04)) { this.pickups.push({ x, y, kind: 'fish', t: 0 }); return; }
    const r = this.rng.int(0, 99);
    let kind: DropKind | null = null;
    if (r < 2 && !hpFull) kind = 'foodL';
    else if (r < 7 && !hpFull) kind = 'foodM';
    else if (r < 20 && !hpFull) kind = 'foodS';
    else if (r < 23 && !epFull) kind = 'orbL';
    else if (r < 28 && !epFull) kind = 'orbM';
    else if (r < 50 && !epFull) kind = 'orbS';
    if (kind) this.pickups.push({ x, y, kind, t: 0 });
  }

  /** Freeze every on-screen enemy (Victory Pose). */
  freezeEnemies(frames: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sx = e.x - this.camera.x;
      const sy = e.y - this.camera.y;
      if (sx > -16 && sx < SCREEN_W + 16 && sy > -16 && sy < SCREEN_H + 32) e.frozen = frames;
    }
  }

  /** Full-screen colour flash. */
  flashScreen(color: string, frames: number): void {
    this.screenFlash = { color, t: frames, max: frames };
  }

  /** Hit's Time-Skip: the world (player) freezes briefly. */
  timeSkip(frames: number): void {
    this.skipT = frames;
  }

  /** Show a toast message (level-ups, item gets). */
  toast(lines: string[], color: string = PAL.white): void {
    this.toasts.push({ lines, t: 150, color });
  }

  /** Area-name banner. */
  showBanner(text: string): void {
    this.banner = { text, t: 120 };
  }

  /** Run a script by id (fire and forget). */
  runScript(id: string): void {
    void this.game.runScript(id);
  }

  // ------------------------------------------------------------------ interaction

  /** A pressed: talk to NPCs, use objects, read signs, action triggers. Returns true if handled. */
  tryInteract(): boolean {
    if (this.locked) return false;
    const p = this.player;
    const fr = p.front(14, 16);
    // NPCs. Nobody chats in the middle of a scripted fight: A throws a punch instead (a talk script that
    // switched characters or warped would wreck the fight that is still running).
    for (const n of this.npcs) {
      if (n.hidden || !n.def.talk || this.sealed) continue;
      if (overlaps(fr, n.body()) || overlaps(fr, n.box())) {
        n.faceTo(p.x, p.y);
        n.paused = true;
        void this.game.runScript(n.def.talk, { npc: n }).finally(() => { n.paused = false; });
        return true;
      }
    }
    // Objects.
    for (const o of this.map.objects) {
      if (o.gone) continue;
      const d = o.def;
      const standOn = d.type === 'flight' && overlaps(p.box(), o.rect);
      if (!standOn && !overlaps(fr, o.rect)) continue;
      switch (d.type) {
        case 'save':
        case 'worldSign':
        case 'flight':
          if (this.sealed) { this.sealNotice(); return true; }
          if (d.type === 'save') void this.game.openSaveMenu();
          else if (d.type === 'worldSign') void this.game.openWorldMap();
          else void this.game.flyTo(d.to, d.tx, d.ty);
          return true;
        case 'sign': void this.game.say([{ text: d.text }]); return true;
        case 'chest': {
          this.map.removeObject(o);
          this.state.set(`chest:${d.id}`);
          void this.game.obtain(d.item, d.qty ?? 1);
          return true;
        }
        default: break;
      }
    }
    // Hidden pickups.
    for (const pk of this.pickups) {
      if (!pk.hidden) continue;
      if (Math.hypot(pk.x - (fr.x + fr.w / 2), pk.y - (fr.y + fr.h / 2)) < 14) {
        this.collect(pk);
        return true;
      }
    }
    // Action triggers.
    for (const t of this.def.triggers ?? []) {
      if (!t.onAction || !this.triggerActive(t)) continue;
      const r = { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE };
      if (overlaps(fr, r) || overlaps(p.box(), r)) {
        if (t.once) this.state.set(`trig:${t.id}`);
        this.runScript(t.script);
        return true;
      }
    }
    return false;
  }

  private triggerActive(t: TriggerDef): boolean {
    if (t.once && this.state.flag(`trig:${t.id}`)) return false;
    if (!this.state.check(t.showIf)) return false;
    if (t.hideIf && this.state.check(t.hideIf)) return false;
    return true;
  }

  private collect(pk: Pickup): void {
    pk.t = -1;
    const cs = this.player.cs;
    if (pk.kind === 'item' && pk.item) {
      if (pk.id) this.state.set(`pickup:${pk.id}`);
      void this.game.obtain(pk.item, pk.qty ?? 1);
      return;
    }
    if (pk.kind === 'fish') {
      this.state.give('fish', 1, ITEMS.fish.max);
      if (pk.id) this.state.set(`pickup:${pk.id}`);
      this.toast(['Got a Fish!']);
      audio.sfx('item');
      return;
    }
    const frac = DROP_RESTORE[pk.kind as Exclude<DropKind, 'fish'>];
    if (pk.kind.startsWith('food')) {
      const n = Math.max(1, Math.round(cs.hpMax * frac));
      cs.hp = Math.min(cs.hpMax, cs.hp + n);
      this.fx.number(this.player.x, this.player.y - 34, n, '#40e040');
    } else {
      const n = Math.max(1, Math.round(cs.epMax * frac));
      cs.ep = Math.min(cs.epMax, cs.ep + n);
      this.fx.number(this.player.x, this.player.y - 34, n, '#60b0f8');
    }
    audio.sfx('heal');
  }

  // ------------------------------------------------------------------ update

  update(input: Input): void {
    this.tick++;
    this.state.data.playFrames++;
    if (this.exitCd > 0) this.exitCd--;
    const p = this.player;
    p.lock(this.locked);

    if (this.skipT > 0) {
      this.skipT--;
      // Player is frozen in time; enemies still act.
    } else {
      p.update(this);
    }

    // Start = pause, Select = scouter, R = regional map (Scouter required for the last two).
    if (!this.locked && p.state === 'free' && this.fade === 0) {
      if (input.pressed('start')) { void this.game.openPause(); return; }
      if (input.pressed('select') && this.state.count('scouter') > 0) { void this.game.openScouter(); return; }
      if (input.pressed('R') && this.state.count('scouter') > 0) { void this.game.openRegionMap(); return; }
    }

    for (const n of this.npcs) n.update(this);
    const enemiesActive = !this.locked;
    for (const e of this.enemies) if (enemiesActive || e.state === 'dying' || e.puppet) e.update(this);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.boss && (this.boss.dead || !this.enemies.includes(this.boss))) this.boss = this.boss.dead ? null : this.boss;

    this.updateShots();
    this.updateBeams();
    this.fx.update();
    this.updatePickups();
    if (!this.locked) {
      this.checkTriggers();
      this.checkWarps();
    }
    if (this.timer && !this.locked) {
      this.timer.frames = Math.max(0, this.timer.frames - 1);
    }

    for (const t of this.toasts) t.t--;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.banner) { this.banner.t--; if (this.banner.t <= 0) this.banner = null; }
    if (this.screenFlash) { this.screenFlash.t--; if (this.screenFlash.t <= 0) this.screenFlash = null; }

    this.camera.update({ x: p.x, y: p.y - 12 });

    // Resolve script waits last so scripts observe this tick's state.
    if (this.waits.length) {
      const ready = this.waits.filter((w) => w.test());
      this.waits = this.waits.filter((w) => !ready.includes(w));
      for (const w of ready) w.resolve();
    }
  }

  private updateShots(): void {
    const p = this.player;
    for (const s of this.shots) {
      if (s.dead) continue;
      const res = s.update(this.col);
      if (res === 'wall' || res === 'land') {
        this.shotImpact(s);
        continue;
      }
      const r = s.rect();
      if (s.owner === 'player') {
        // Enemy shots cancel against player ki blasts (LoG2: blasting rockets).
        for (const o of this.shots) {
          if (o.owner !== 'enemy' || o.dead) continue;
          if (overlaps(r, o.rect())) { o.dead = true; this.fx.hit(o.x, o.y - o.lift, o.color, 3); if (!s.pierce && s.kind !== 'ball') { s.dead = true; } }
        }
        if (s.dead) continue;
        if (s.kind === 'arc') continue;
        for (const e of this.enemies) {
          if (e.dead || e.state === 'dying' || e.def.invulnerable || s.hit.has(e)) continue;
          if (!overlaps(r, e.body())) continue;
          s.hit.add(e);
          const v = { x: Math.sign(s.vx) * 1.4, y: Math.sign(s.vy) * 1.4 };
          this.applyDamage(e, s.atk, s.mult, v, s.stun || 10, s.ki, s.techStun);
          audio.sfx('blastHit');
          if (!s.pierce) { s.dead = true; if (s.boom) this.shotImpact(s); break; }
        }
        if (!s.dead) this.hitWorld(r, s.hit);
      } else if (this.hitsPlayer(r)) {
        s.dead = true;
        this.damagePlayer(s.atk, s.mult, s.x - s.vx * 4, s.y - s.vy * 4);
        this.fx.hit(s.x, s.y - s.lift, s.color, 4);
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
    void p;
  }

  private shotImpact(s: Shot): void {
    s.dead = true;
    if (s.boom > 0) {
      this.fx.explode(s.x, s.y - 4, s.boom, s.color);
      audio.sfx('explode');
      this.camera.shake(6, 2);
      const area = { x: s.x - s.boom, y: s.y - s.boom - 10, w: s.boom * 2, h: s.boom * 2 + 10 };
      if (s.owner === 'player') {
        for (const e of this.enemies) {
          if (e.dead || e.state === 'dying' || e.def.invulnerable || s.hit.has(e)) continue;
          if (!overlaps(area, e.body())) continue;
          s.hit.add(e);
          const dx = e.x - s.x;
          const dy = e.y - s.y;
          const l = Math.hypot(dx, dy) || 1;
          this.applyDamage(e, s.atk, s.mult, { x: (dx / l) * 2.5, y: (dy / l) * 2.5 }, s.stun || 14, s.ki, s.techStun);
        }
        this.hitWorld(area, s.hit);
      } else if (this.hitsPlayer(area)) {
        this.damagePlayer(s.atk, s.mult, s.x, s.y);
      }
    } else {
      this.fx.hit(s.x, s.y - s.lift, s.color, 3);
    }
  }

  private updateBeams(): void {
    for (const b of this.beams) {
      if (b.dead) continue;
      b.t++;
      b.trace(this.col);
      if (b.owner === 'enemy') {
        if (b.warn > 0) { b.warn--; continue; }
        b.life--;
        if (b.life <= 0) { b.dead = true; continue; }
        if (b.t % 8 === 0 && this.hitsPlayer(b.rect())) this.damagePlayer(b.atk, b.mult, b.ox, b.oy);
        continue;
      }
      // Player beam: shorten at the first enemy unless it pierces; damage every 8 frames.
      const v = dirVec(b.dir);
      if (!b.pierce) {
        let nearest = b.len;
        for (const e of this.enemies) {
          if (e.dead || e.state === 'dying' || e.def.invulnerable) continue;
          if (!overlaps(b.rect(), e.body())) continue;
          const d = v.x !== 0 ? Math.abs(e.x - b.ox) - 6 : Math.abs(e.y - b.oy) - 6;
          nearest = Math.max(8, Math.min(nearest, d));
        }
        b.len = nearest;
      }
      // Beams cancel enemy shots.
      for (const s of this.shots) if (s.owner === 'enemy' && overlaps(b.rect(), s.rect())) { s.dead = true; this.fx.hit(s.x, s.y - s.lift, s.color, 3); }
      if (b.t % 8 === 0) {
        for (const e of this.enemies) {
          if (e.dead || e.state === 'dying' || e.def.invulnerable) continue;
          if (!overlaps(b.rect(), e.body())) continue;
          this.applyDamage(e, b.atk, b.mult, { x: v.x * 1.2, y: v.y * 1.2 }, 10, true);
        }
        this.hitWorld(b.rect());
      }
    }
    this.beams = this.beams.filter((b) => !b.dead);
  }

  private updatePickups(): void {
    const pb = this.player.box();
    for (const pk of this.pickups) {
      if (pk.t < 0 || pk.hidden) continue;
      pk.t++;
      if (pk.t < 20) continue;
      if (overlaps(pb, { x: pk.x - 6, y: pk.y - 8, w: 12, h: 12 })) this.collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => pk.t >= 0);
  }

  private checkTriggers(): void {
    const pb = this.player.box();
    for (const t of this.def.triggers ?? []) {
      if (t.onAction) continue;
      const r = { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE };
      const inside = overlaps(pb, r);
      const was = this.triggersInside.has(t.id);
      if (inside && !was && this.triggerActive(t)) {
        this.triggersInside.add(t.id);
        if (t.once) this.state.set(`trig:${t.id}`);
        this.runScript(t.script);
        return;
      }
      if (!inside) this.triggersInside.delete(t.id);
      else this.triggersInside.add(t.id);
    }
  }

  private warpActive(w: WarpDef): boolean {
    if (!this.state.check(w.showIf)) return false;
    if (w.hideIf && this.state.check(w.hideIf)) return false;
    return true;
  }

  private checkWarps(): void {
    if (this.exitCd > 0 || this.fade > 0) return;
    const p = this.player;
    const pb = p.box();
    for (const w of this.def.warps ?? []) {
      const r = { x: w.x * TILE, y: w.y * TILE, w: w.w * TILE, h: w.h * TILE };
      if (!overlaps(pb, r)) continue;
      if (!this.warpActive(w)) {
        if (w.lockedScript) { this.exitCd = 60; this.runScript(w.lockedScript); this.pushBack(); }
        continue;
      }
      if (this.sealed) { this.sealNotice(); this.pushBack(); return; }
      if (w.door) audio.sfx('door');
      void this.game.changeMap(w.to, w.tx, w.ty, w.dir ?? p.dir);
      return;
    }
    // Edge exits.
    const inp = this.input;
    const edges: Array<['north' | 'south' | 'east' | 'west', boolean]> = [
      ['north', pb.y <= 1 && inp.isDown('up')],
      ['south', pb.y + pb.h >= this.map.ph - 1 && inp.isDown('down')],
      ['west', pb.x <= 1 && inp.isDown('left')],
      ['east', pb.x + pb.w >= this.map.pw - 1 && inp.isDown('right')],
    ];
    for (const [side, hit] of edges) {
      if (!hit) continue;
      const ex = this.def.exits?.[side];
      if (!ex) continue;
      if (this.sealed) { this.sealNotice(); continue; }
      const open = this.state.check(ex.showIf) && !(ex.hideIf && this.state.check(ex.hideIf));
      if (!open) {
        if (ex.lockedScript) { this.exitCd = 60; this.runScript(ex.lockedScript); this.pushBack(); }
        continue;
      }
      void this.game.edgeExit(side, ex.to, ex.offset ?? 0, p.x / TILE, p.y / TILE);
      return;
    }
  }

  /** Nudge the player back from a locked exit. */
  private pushBack(): void {
    const v = dirVec(this.player.dir);
    const r = this.col.move(this.player.box(), -v.x * 8, -v.y * 8);
    this.player.x += r.dx;
    this.player.y += r.dy;
  }

  // ------------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera;
    const cx = cam.ox;
    const cy = cam.oy;
    ctx.fillStyle = this.def.backdrop ?? '#000000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.drawImage(this.map.ground, -cx, -cy);

    // Flat decor + flight circles.
    for (const pr of this.map.props) if (pr.sortY < 0) ctx.drawImage(pr.art.bmp, Math.round(pr.x - cx), Math.round(pr.y - cy));
    for (const o of this.map.objects) {
      if (o.gone || o.def.type !== 'flight') continue;
      this.drawFlightCircle(ctx, o.rect.x + 8 - cx, o.rect.y + 10 - cy);
    }
    // Pickups on the ground.
    for (const pk of this.pickups) if (!pk.hidden) this.drawPickup(ctx, pk, cx, cy);

    // Shadows.
    for (const n of this.npcs) n.drawShadow(ctx, cx, cy);
    for (const e of this.enemies) e.drawShadow(ctx, cx, cy);
    this.player.drawShadow(ctx, cx, cy);

    // Y-sorted world.
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const pr of this.map.props) {
      if (pr.sortY < 0) continue;
      if (pr.x - cx > SCREEN_W || pr.x + pr.art.bmp.width - cx < 0 || pr.y - cy > SCREEN_H || pr.y + pr.art.bmp.height - cy < 0) continue;
      list.push({ y: pr.sortY, draw: () => ctx.drawImage(pr.art.bmp, Math.round(pr.x - cx), Math.round(pr.y - cy)) });
    }
    for (const g of this.map.gates) {
      if (g.broken) continue;
      list.push({ y: g.rect.y + g.rect.h, draw: () => this.drawGate(ctx, g.rect, g.def.character, g.def.level, cx, cy) });
    }
    for (const n of this.npcs) list.push({ y: n.y, draw: () => n.draw(ctx, cx, cy) });
    for (const e of this.enemies) list.push({ y: e.y, draw: () => { e.draw(ctx, cx, cy); if (e.stunGlow && this.tick % 6 < 3) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#f8f080'; const b = e.body(); ctx.fillRect(Math.round(b.x - cx), Math.round(b.y - cy), b.w, b.h); ctx.globalAlpha = 1; } } });
    list.push({ y: this.player.y, draw: () => this.player.draw(ctx, cx, cy) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    for (const e of this.enemies) e.renderMarks(ctx, cx, cy, this.tick);
    for (const b of this.beams) b.render(ctx, cx, cy, this.tick);
    for (const s of this.shots) s.render(ctx, cx, cy, this.tick);
    this.fx.render(ctx, cx, cy);

    const tint = this.tintOverride !== undefined ? this.tintOverride : this.def.tint;
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    if (this.skipT > 0) {
      ctx.fillStyle = 'rgba(80,40,120,0.25)';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    if (this.screenFlash) {
      ctx.globalAlpha = this.screenFlash.t / this.screenFlash.max;
      ctx.fillStyle = this.screenFlash.color;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.globalAlpha = 1;
    }
    if (this.letterbox > 0) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, SCREEN_W, this.letterbox);
      ctx.fillRect(0, SCREEN_H - this.letterbox, SCREEN_W, this.letterbox);
    }

    if (!this.cutscene && !this.game.hideHud) drawHud(ctx, this);
    this.renderToasts(ctx);
    if (this.fade > 0) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.globalAlpha = 1;
    }
  }

  private renderToasts(ctx: CanvasRenderingContext2D): void {
    // Below the HUD (and below a fight's countdown when one is showing).
    let y = this.timer ? 40 : 30;
    for (const t of this.toasts.slice(0, 3)) {
      // Long lines wrap inside the screen; the first source line keeps the highlight colour.
      const rows = t.lines.flatMap((l, i) => wrap(l, OVERLAY_TEXT_W).map((r) => ({ r, first: i === 0 })));
      const w = Math.max(...rows.map((l) => font.drawWidth(l.r))) + 12;
      const h = rows.length * 10 + 6;
      const x = Math.round((SCREEN_W - w) / 2);
      ctx.globalAlpha = Math.min(1, t.t / 20);
      ctx.fillStyle = 'rgba(16,24,40,0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = PAL.uiFrame;
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y + h - 1, w, 1);
      rows.forEach((l, i) => font.drawCentered(ctx, l.r, SCREEN_W / 2, y + 4 + i * 10, l.first ? t.color : PAL.white, '#000'));
      ctx.globalAlpha = 1;
      y += h + 3;
    }
    if (this.banner) {
      const a = Math.min(1, this.banner.t / 20, (120 - this.banner.t) / 10 + 0.1);
      ctx.globalAlpha = a;
      const rows = wrap(this.banner.text, OVERLAY_TEXT_W - 8);
      const w = Math.max(...rows.map((r) => font.drawWidth(r))) + 20;
      const h = rows.length * 10 + 4;
      const x = Math.round((SCREEN_W - w) / 2);
      const top = 150 - h;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, top, w, h);
      rows.forEach((r, i) => font.drawCentered(ctx, r, SCREEN_W / 2, top + 3 + i * 10, PAL.gold, '#000'));
      ctx.globalAlpha = 1;
    }
  }

  private drawFlightCircle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const pulse = 0.6 + 0.4 * Math.sin(this.tick / 10);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#f8e070';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), 9, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff8c0';
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (this.tick % 8 === 0) this.fx.aura(x + this.camera.x, y + this.camera.y + 2, '#f8e070', 1);
  }

  private drawGate(ctx: CanvasRenderingContext2D, r: Rect, character: string | undefined, level: number, cx: number, cy: number): void {
    const color = character ? CHARACTERS[character as CharId]?.color ?? '#ffffff' : '#f0f0f0';
    const x = Math.round(r.x - cx);
    const y = Math.round(r.y - cy);
    const hgt = Math.max(r.h, 24);
    const top = y + r.h - hgt;
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(this.tick / 8);
    ctx.fillStyle = color;
    ctx.fillRect(x, top, r.w, hgt);
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < r.w; i += 6) {
      const off = (this.tick + i * 3) % hgt;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + i + 2, top + off, 1, 6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, top, r.w, 1);
    ctx.fillRect(x, top + hgt - 1, r.w, 1);
    const joined = character ? this.state.char(character as CharId)?.joined : true;
    const label = !character ? '' : joined ? String(level) : '?';
    if (label) {
      const lx = x + r.w / 2;
      const ly = top + hgt / 2 - 5;
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(lx - font.drawWidth(label) / 2 - 3), ly - 2, font.drawWidth(label) + 6, 12);
      font.drawCentered(ctx, label, lx, ly, color, '#000');
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D, pk: Pickup, cx: number, cy: number): void {
    const x = Math.round(pk.x - cx);
    const bob = Math.round(Math.sin((this.tick + pk.x) / 8) * 1.5);
    const y = Math.round(pk.y - cy) - 4 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 3, Math.round(pk.y - cy), 6, 2);
    switch (pk.kind) {
      case 'foodS': this.icon(ctx, x, y, '#e8d0a0', '#f8f8f8', 3); break;
      case 'foodM': this.icon(ctx, x, y, '#c87038', '#f0c070', 4); break;
      case 'foodL': this.icon(ctx, x, y, '#a05028', '#f8d080', 5); break;
      case 'orbS': this.orb(ctx, x, y, 2); break;
      case 'orbM': this.orb(ctx, x, y, 3); break;
      case 'orbL': this.orb(ctx, x, y, 4); break;
      case 'fish': this.icon(ctx, x, y, '#80a8c8', '#d0e8f8', 3); break;
      case 'item': {
        const it = pk.item ? ITEMS[pk.item] : undefined;
        const c = it?.icon.color ?? '#f8d040';
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 4, y - 4, 9, 9);
        ctx.fillStyle = c;
        ctx.fillRect(x - 3, y - 3, 7, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2, y - 2, 2, 2);
        if (this.tick % 30 < 4) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 3, y - 6, 1, 3); ctx.fillRect(x + 2, y - 5, 3, 1); }
        break;
      }
    }
  }

  private icon(ctx: CanvasRenderingContext2D, x: number, y: number, a: string, b: string, r: number): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(x - r - 1, y - r, r * 2 + 2, r * 2);
    ctx.fillStyle = a;
    ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2);
    ctx.fillStyle = b;
    ctx.fillRect(x - r + 1, y - r + 1, r, 1);
  }

  private orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const g = this.tick % 10 < 5;
    ctx.fillStyle = g ? '#f8f080' : '#f8d040';
    ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 0.5, y - 0.5, Math.max(1, r * 0.5), 0, Math.PI * 2); ctx.fill();
  }

  /** Technique currently selected (for HUD). */
  get selectedTech(): string {
    const t = this.player.tech;
    return t ? t.id : 'Z';
  }

  /** Expose TECHNIQUES for HUD without another import there. */
  static techName(id: string): string {
    return TECHNIQUES[id]?.name ?? id;
  }
}
