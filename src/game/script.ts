import type { Pose } from '../art/humanoid';
import type { Expression } from '../art/portrait';
import { portrait } from '../art/registry';
import { CAST, CAST_NAMES } from '../content/cast';
import { CHARACTERS, FORMS, type CharId } from '../content/characters';
import { ENEMIES } from '../content/enemies';
import { CHARGED_MELEE, TECHNIQUES } from '../content/techniques';
import { audio, type Sfx } from '../engine/audio';
import { TILE } from '../engine/constants';
import type { Dir } from '../engine/math';
import type { Line } from '../ui/dialogue';
import type { Actor } from './actor';
import type { Enemy } from './enemy';
import type { Field } from './field';
import type { Game } from './game';
import type { Npc } from './npc';
import type { GameState } from './state';

/** A story script: an async function driving the game through the ScriptApi. */
export type Script = (s: ScriptApi) => Promise<void>;

/** All scripts by id. */
export const SCRIPTS: Record<string, Script> = {};

/** Register scripts. Duplicate ids are a content bug and throw. */
export function registerScripts(map: Record<string, Script>): void {
  for (const [id, fn] of Object.entries(map)) {
    if (SCRIPTS[id]) throw new Error(`Duplicate script id "${id}"`);
    SCRIPTS[id] = fn;
  }
}

/** Context passed when a script is started by an NPC. */
export interface ScriptCtx {
  npc?: Npc;
}

/** Options for `fight`. */
export interface FightOpts {
  /** Spawn position in tiles (defaults to 4 tiles in front of the player). */
  x?: number;
  y?: number;
  /** Unique id; sets `defeated:<uid>` on a kill. */
  uid?: string;
  /** Survive for this many seconds → result 'timeout'. */
  survive?: number;
  /** If the player is knocked out, return 'lose' instead of Game Over (story losses). */
  loseOk?: boolean;
  /** Use an enemy already on the map (by uid) instead of spawning. */
  existing?: boolean;
  /** Countdown label for `survive`. */
  label?: string;
}

/** Fight outcome. 'end' = boss reached its scripted end threshold. */
export type FightResult = 'win' | 'end' | 'lose' | 'timeout';

/**
 * The scripting surface used by all story content (LoG2's bytecode interpreter, as async TypeScript).
 * Coordinates are in TILES unless stated. Speakers are cast ids ('goku', 'bulma'), an NPC id on the
 * current map, 'hero' for the active character, or 'narrator'.
 */
export class ScriptApi {
  constructor(private readonly game: Game, readonly ctx: ScriptCtx = {}) {}

  /** Current field (changes after warps). */
  get field(): Field {
    const f = this.game.field;
    if (!f) throw new Error('No active field');
    return f;
  }

  get state(): GameState {
    return this.game.state;
  }

  /** Active character id. */
  get hero(): CharId {
    return this.game.state.data.active;
  }

  /** NPC that started this script, if any. */
  get npc(): Npc | undefined {
    return this.ctx.npc;
  }

  // ---------------------------------------------------------------- composition

  /** True if a script id is registered (guard cross-act handoffs). */
  hasScript(id: string): boolean {
    return !!SCRIPTS[id];
  }

  /** Run another script inline (same lock, same context) and wait for it. */
  async call(id: string): Promise<void> {
    const fn = SCRIPTS[id];
    if (!fn) throw new Error(`Unknown script "${id}"`);
    await fn(new ScriptApi(this.game, this.ctx));
  }

  // ---------------------------------------------------------------- flags

  flag(name: string): boolean { return this.state.flag(name); }
  set(name: string, v: number | string | boolean = true): void { this.state.set(name, v); }
  clear(name: string): void { this.state.clear(name); }
  check(cond: string): boolean { return this.state.check(cond); }
  /** Numeric flag helper (counters like "times talked"). */
  num(name: string): number { const v = this.state.get(name); return typeof v === 'number' ? v : 0; }
  inc(name: string, by = 1): number { const n = this.num(name) + by; this.state.set(name, n); return n; }

  // ---------------------------------------------------------------- dialogue

  private resolveSpeaker(who: string, expr: Expression): Pick<Line, 'name' | 'portrait'> {
    if (who === 'narrator' || who === '') return {};
    let id = who;
    if (who === 'hero') id = this.heroSprite();
    const npc = this.game.field?.npcs.find((n) => n.def.id === who);
    if (npc) {
      return { name: npc.name || CAST_NAMES[npc.spriteId] || '', portrait: CAST[npc.spriteId] ? portrait(npc.spriteId, expr) : null };
    }
    if (who === 'hero') return { name: CHARACTERS[this.hero].name, portrait: portrait(id, expr) };
    if (CAST[id]) return { name: CAST_NAMES[id] ?? id, portrait: portrait(id, expr) };
    return { name: who };
  }

  private heroSprite(): string {
    return this.game.field?.player.spriteId ?? CHARACTERS[this.hero].sprite;
  }

  /** Substitute {hero} with the active character's name. */
  private fmt(text: string): string {
    return text.replace(/\{hero\}/g, CHARACTERS[this.hero].name);
  }

  /** One line of dialogue. */
  async say(who: string, text: string, expr: Expression = 'neutral'): Promise<void> {
    await this.game.say([{ ...this.resolveSpeaker(who, expr), text: this.fmt(text) }]);
  }

  /** Several lines: [speaker, text, expression?]. */
  async talk(lines: Array<[string, string, Expression?]>): Promise<void> {
    await this.game.say(lines.map(([w, t, e]) => ({ ...this.resolveSpeaker(w, e ?? 'neutral'), text: this.fmt(t) })));
  }

  /** Narrator box (no portrait), e.g. "Three years later...". */
  async narrate(text: string): Promise<void> {
    await this.game.say([{ text: this.fmt(text) }]);
  }

  /** Ask a question; resolves to the chosen option index. */
  async ask(who: string, text: string, options: string[], expr: Expression = 'neutral'): Promise<number> {
    return this.game.ask({ ...this.resolveSpeaker(who, expr), text: this.fmt(text) }, options);
  }

  // ---------------------------------------------------------------- party & progression

  /** A character joins at a level (LoG2 stat roll). Narrator announces it unless quiet. */
  async join(id: CharId, level: number, quiet = false): Promise<void> {
    const was = this.state.char(id).joined;
    this.state.join(id, level);
    if (!was && !quiet) {
      audio.sfx('levelUp');
      await this.narrate(`${CHARACTERS[id].name} has joined! You can switch characters at any save point.`);
    }
  }

  /** Make a character the active one immediately (forced perspective switch). */
  switchTo(id: CharId): void {
    this.game.switchCharacter(id);
  }

  /** Teach a ki technique. */
  async learn(id: CharId, tech: string, quiet = false): Promise<void> {
    if (!TECHNIQUES[tech]) throw new Error(`Unknown technique ${tech}`);
    if (this.state.learn(id, tech) && !quiet) {
      audio.sfx('levelUp');
      await this.narrate(`${CHARACTERS[id].name} now has the ${TECHNIQUES[tech].name} technique! Press L to select it.`);
    }
  }

  /** Teach the charged melee (Master Roshi's training). */
  async learnCharged(id: CharId, quiet = false): Promise<void> {
    const c = this.state.char(id);
    if (c.charged) return;
    c.charged = true;
    if (!quiet) {
      audio.sfx('levelUp');
      await this.narrate(`${CHARACTERS[id].name} learned ${CHARGED_MELEE[CHARACTERS[id].charged].name}! Hold A, then release.`);
    }
  }

  /** Set / upgrade a character's Z transformation. */
  async setForm(id: CharId, form: string | null, quiet = false): Promise<void> {
    const c = this.state.char(id);
    if (form && !FORMS[form]) throw new Error(`Unknown form ${form}`);
    c.form = form;
    const f = this.game.field;
    if (f && f.player.cs.id === id && f.player.formActive) f.player.revert();
    if (form && !quiet) {
      audio.sfx('powerUp');
      await this.narrate(`${CHARACTERS[id].name} has achieved ${FORMS[form].name}! Select Z with L, then press B when the triangle is full.`);
    }
  }

  /** Force the active player into a form now (story moments), or revert with null. */
  transformNow(form: string | null): void {
    const p = this.field.player;
    if (form === null) { p.revert(); return; }
    p.formActive = form;
    p.refreshSprite();
  }

  /** Change a character's outfit sprite (null restores default). */
  outfit(id: CharId, sprite: string | null): void {
    this.state.char(id).outfit = sprite ?? undefined;
    const f = this.game.field;
    if (f && f.player.cs.id === id) f.player.refreshSprite();
  }

  /** Fully heal the party. */
  heal(): void {
    for (const c of Object.values(this.state.data.chars)) { c.hp = c.hpMax; c.ep = c.epMax; }
    audio.sfx('heal');
  }

  /** Award EXP to the active character. */
  exp(amount: number): void {
    this.field.awardExp(amount, true);
  }

  /** Set the chapter number (EXP floors, journal gating). */
  setChapter(n: number): void {
    this.state.data.chapter = n;
  }

  /** Full-screen chapter title card. */
  async chapter(n: number, title: string, subtitle?: string): Promise<void> {
    this.state.data.chapter = n;
    await this.game.titleCard(n === 0 ? 'Prologue' : `Chapter ${n}`, title, subtitle);
  }

  // ---------------------------------------------------------------- items & journal

  /** Give an item with the narrator "You got X!" box unless quiet. */
  async give(item: string, qty = 1, quiet = false): Promise<void> {
    if (quiet) { this.game.giveQuiet(item, qty); return; }
    await this.game.obtain(item, qty);
  }

  take(item: string, qty = 1): boolean { return this.state.take(item, qty); }
  has(item: string): boolean { return this.state.count(item) > 0; }
  count(item: string): number { return this.state.count(item); }

  /** Add a journal entry ("Journal updated!"). */
  async quest(id: string, quiet = false): Promise<void> {
    if (this.state.addQuest(id) && !quiet) {
      audio.sfx('item');
      await this.narrate('Journal updated!');
    }
  }

  /** Complete a journal entry. */
  async done(id: string, quiet = true): Promise<void> {
    if (this.state.completeQuest(id) && !quiet) await this.narrate('Journal updated!');
  }

  /** Take off to the world map (optionally switching world: 'earth' | 'future' | 'space'). */
  async worldMap(world?: 'earth' | 'future' | 'space'): Promise<void> {
    if (world) this.state.set('world', world);
    await this.game.openWorldMap();
  }

  /** Unlock a world-map landing spot. */
  unlockRegion(id: string): void {
    if (!this.state.data.regions.includes(id)) this.state.data.regions.push(id);
  }

  // ---------------------------------------------------------------- world & camera

  /** Lock controls for the rest of this script (default for all scripts). */
  lock(): void { this.game.allowControl = false; }
  /** Give the player control while the script keeps running (fights, timed escapes). */
  free(): void { this.game.allowControl = true; }

  /** Warp to a map position (fade out/in). */
  async warp(map: string, x: number, y: number, dir?: Dir): Promise<void> {
    await this.game.changeMap(map, x, y, dir ?? this.field.player.dir);
  }

  async wait(frames: number): Promise<void> { await this.field.wait(frames); }
  async seconds(s: number): Promise<void> { await this.field.wait(s * 60); }

  /** Fade the screen to black (or a colour). */
  async fadeOut(frames = 20, color = '#000000'): Promise<void> { await this.game.fadeTo(1, frames, color); }
  async fadeIn(frames = 20): Promise<void> { await this.game.fadeTo(0, frames); }

  shake(frames = 20, mag = 2): void { this.field.camera.shake(frames, mag); }
  /** Tint the screen (e.g. 'rgba(20,20,80,0.45)' for night, 'rgba(120,0,40,0.3)' for a nightmare); null clears. */
  tint(color: string | null): void { this.field.tintOverride = color; }
  flash(color = '#ffffff', frames = 10): void { this.field.flashScreen(color, frames); }
  /** Cinematic letterbox bars on/off. */
  letterbox(on: boolean): void { this.field.letterbox = on ? 12 : 0; }
  music(id: string): void { this.game.playMusic(id); }
  stopMusic(): void { audio.stopMusic(); }
  sfx(id: Sfx): void { audio.sfx(id); }
  banner(text: string): void { this.field.showBanner(text); }
  toast(text: string): void { this.field.toast([text]); }

  /** Pan the camera to centre on a tile over `frames`. */
  async pan(x: number, y: number, frames = 40): Promise<void> {
    this.field.camera.panTo({ x: x * TILE + 8, y: y * TILE + 8 }, frames);
    await this.field.until(() => !this.field.camera.panning);
  }

  /** Return the camera to following the player. */
  follow(): void { this.field.camera.release(); }

  // ---------------------------------------------------------------- actors

  /** Find an actor: 'hero', an NPC id, or an enemy uid. */
  actor(id: string): Actor {
    const f = this.field;
    if (id === 'hero') return f.player;
    const n = f.npcs.find((x) => x.def.id === id);
    if (n) return n;
    const e = f.enemies.find((x) => x.uid === id);
    if (e) return e;
    throw new Error(`Script actor "${id}" not found on ${f.def.id}`);
  }

  /** True if an actor exists on the current map. */
  exists(id: string): boolean {
    const f = this.field;
    return id === 'hero' || f.npcs.some((x) => x.def.id === id) || f.enemies.some((x) => x.uid === id);
  }

  /** Spawn a cutscene NPC at a tile. */
  spawn(id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): Npc {
    return this.field.addNpc(id, sprite, x * TILE + 8, y * TILE + 14, dir, name);
  }

  /** Remove a cutscene NPC or enemy. */
  remove(id: string): void {
    const f = this.field;
    f.npcs = f.npcs.filter((n) => n.def.id !== id);
    f.enemies = f.enemies.filter((e) => e.uid !== id);
  }

  /** Walk an actor to a tile (straight line, ignores collision). Speed in px/frame. */
  async walk(id: string, x: number, y: number, speed = 1): Promise<void> {
    const a = this.actor(id);
    const tx = x * TILE + 8;
    const ty = y * TILE + 14;
    await new Promise<void>((resolve) => {
      const f = this.field;
      const step = () => {
        const dx = tx - a.x;
        const dy = ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= speed) { a.x = tx; a.y = ty; a.moving = false; resolve(); return true; }
        a.x += (dx / d) * speed;
        a.y += (dy / d) * speed;
        a.moving = true;
        a.running = speed > 1.4;
        a.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        a.animate();
        return false;
      };
      void f.until(step);
    });
  }

  /** Walk several actors at once. */
  async walkAll(moves: Array<[string, number, number, number?]>): Promise<void> {
    await Promise.all(moves.map(([id, x, y, sp]) => this.walk(id, x, y, sp ?? 1)));
  }

  /** Instantly place an actor. */
  place(id: string, x: number, y: number, dir?: Dir): void {
    const a = this.actor(id);
    a.x = x * TILE + 8;
    a.y = y * TILE + 14;
    if (dir) a.dir = dir;
  }

  /** Face a direction or another actor. */
  face(id: string, to: Dir | string): void {
    const a = this.actor(id);
    if (to === 'up' || to === 'down' || to === 'left' || to === 'right') a.dir = to;
    else { const b = this.actor(to); a.faceTo(b.x, b.y); }
  }

  /** Force a pose (null to clear). */
  pose(id: string, pose: Pose | null): void {
    this.actor(id).scriptPose = pose;
  }

  /** Change an actor's sprite (transformations in cutscenes). */
  sprite(id: string, sprite: string): void {
    this.actor(id).setSprite(sprite);
  }

  /** Aura on/off. */
  aura(id: string, color: string | null): void {
    this.actor(id).aura = color;
  }

  /** Show / hide an actor. */
  show(id: string, visible: boolean): void {
    this.actor(id).hidden = !visible;
  }

  /** Dark silhouette (mystery figures). */
  silhouette(id: string, on: boolean): void {
    this.actor(id).silhouette = on;
  }

  /** Lift an actor into the air (z height in px) over frames. */
  async lift(id: string, z: number, frames = 20): Promise<void> {
    const a = this.actor(id);
    const z0 = a.z;
    for (let i = 1; i <= frames; i++) {
      await this.field.wait(1);
      a.z = z0 + ((z - z0) * i) / frames;
    }
  }

  /** Fly an actor off-screen / to a tile with lift (cutscene flight). */
  async flyTo(id: string, x: number, y: number, speed = 3): Promise<void> {
    const a = this.actor(id);
    await this.lift(id, 12, 10);
    a.scriptPose = 'fly';
    await this.walk(id, x, y, speed);
    a.scriptPose = null;
  }

  /** Emote bubble above an actor ('!', '?', '...', '♥', '#'). */
  async emote(id: string, symbol: string, frames = 50): Promise<void> {
    const a = this.actor(id);
    this.field.fx.number(a.x, a.y - 40, symbol, '#ffffff');
    await this.field.wait(Math.min(frames, 30));
  }

  /** Burst of aura particles + flash at an actor (power-ups). */
  async powerUp(id: string, color: string, frames = 60): Promise<void> {
    const a = this.actor(id);
    audio.sfx('powerUp');
    a.scriptPose = 'charge';
    for (let i = 0; i < frames; i++) {
      await this.field.wait(1);
      this.field.fx.aura(a.x, a.y, color, 2);
      if (i % 8 === 0) this.field.camera.shake(6, 1);
    }
    this.field.flashScreen('#ffffff', 10);
    this.field.fx.explode(a.x, a.y - 12, 18, color);
    a.scriptPose = null;
  }

  /** Explosion effect at a tile. */
  boom(x: number, y: number, radius = 18, color = '#f8c040'): void {
    this.field.fx.explode(x * TILE + 8, y * TILE + 8, radius, color);
    audio.sfx('explode');
    this.field.camera.shake(12, 2);
  }

  /** Cutscene ki blast from one actor toward another (visual only). */
  async blast(from: string, to: string, color = '#f8e070'): Promise<void> {
    const a = this.actor(from);
    const b = this.actor(to);
    a.faceTo(b.x, b.y);
    a.scriptPose = 'blast';
    audio.sfx('blast');
    const steps = Math.max(8, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    for (let i = 0; i <= steps; i++) {
      await this.field.wait(1);
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps - 14;
      this.field.fx.aura(x, y + 14, color, 2);
    }
    this.field.fx.explode(b.x, b.y - 12, 14, color);
    audio.sfx('blastHit');
    a.scriptPose = null;
  }

  /** Cutscene clash: two actors trade blows with sparks for a few seconds. */
  async clash(a: string, b: string, frames = 90): Promise<void> {
    const A = this.actor(a);
    const B = this.actor(b);
    A.faceTo(B.x, B.y);
    B.faceTo(A.x, A.y);
    for (let i = 0; i < frames; i++) {
      await this.field.wait(1);
      if (i % 10 === 0) {
        A.scriptPose = i % 20 ? 'punch1' : 'punch2';
        B.scriptPose = i % 20 ? 'guard' : 'kick';
        this.field.fx.hit((A.x + B.x) / 2, (A.y + B.y) / 2 - 14, '#ffffff', 5);
        audio.sfx(i % 20 ? 'punch' : 'hit');
        this.field.camera.shake(4, 1);
      }
    }
    A.scriptPose = null;
    B.scriptPose = null;
  }

  // ---------------------------------------------------------------- combat

  /** Spawn a regular enemy (tile coords). */
  spawnEnemy(type: string, x: number, y: number, uid?: string): Enemy {
    if (!ENEMIES[type]) throw new Error(`Unknown enemy ${type}`);
    return this.field.spawnEnemy(type, x * TILE + 8, y * TILE + 14, uid);
  }

  /** Wait until all listed enemy uids are gone. */
  async waitDefeat(uids: string[]): Promise<void> {
    await this.field.until(() => !this.field.enemies.some((e) => e.uid && uids.includes(e.uid) && e.state !== 'dying'));
  }

  /**
   * Boss fight (LoG2 style). Spawns the boss, hands control to the player, shows the boss bar,
   * and resolves when the boss dies ('win'), hits its scripted end threshold ('end'),
   * the survive timer runs out ('timeout') or — with `loseOk` — the player is knocked out ('lose').
   */
  async fight(type: string, opts: FightOpts = {}): Promise<FightResult> {
    const f = this.field;
    let boss: Enemy | undefined;
    if (opts.existing && opts.uid) boss = f.enemies.find((e) => e.uid === opts.uid);
    if (!boss) {
      const p = f.player;
      const v = { down: [0, 4], up: [0, -4], left: [-4, 0], right: [4, 0] }[p.dir];
      const tx = opts.x ?? Math.round(p.x / TILE + v[0]);
      const ty = opts.y ?? Math.round(p.y / TILE + v[1]);
      boss = this.spawnEnemy(type, tx, ty, opts.uid ?? `fight:${type}`);
    }
    boss.puppet = false;
    boss.aggro = true;
    f.boss = boss.isBoss ? boss : null;
    const prevHostile = f.forceHostile;
    f.forceHostile = true;
    if (opts.survive) f.timer = { frames: opts.survive * 60, label: opts.label ?? 'SURVIVE' };
    let lost = false;
    const prevDown = this.game.onPlayerDown;
    if (opts.loseOk) {
      this.game.onPlayerDown = () => {
        lost = true;
        const pl = this.field.player;
        pl.cs.hp = 1;
        pl.inv = 9999;
        return true;
      };
    }
    this.game.allowControl = true;
    const b = boss;
    await f.until(() => b.dead || b.ended || lost || (!!opts.survive && !!f.timer && f.timer.frames <= 0) || f.player.state === 'dead');
    this.game.allowControl = false;
    this.game.onPlayerDown = prevDown;
    f.player.inv = 0;
    f.timer = null;
    f.forceHostile = prevHostile;
    // Clear stray projectiles so cutscenes start clean.
    f.shots = [];
    f.beams = [];
    if (f.player.state === 'dead') return new Promise(() => undefined); // Game Over takes over.
    let result: FightResult;
    if (lost) result = 'lose';
    else if (b.ended) result = 'end';
    else if (b.dead) result = 'win';
    else result = 'timeout';
    if (!b.dead) { b.puppet = true; b.ended = false; b.state = 'ended'; }
    f.boss = null;
    f.player.lock(true);
    return result;
  }

  /** Start carrying a fragile quest object (no attacking; a hit breaks it and runs `onBreak`). */
  carry(label: string, onBreak?: string): void {
    this.field.carrying = { label, onBreak };
  }

  /** Stop carrying (delivered). Returns true if the object was still intact. */
  drop(): boolean {
    const had = !!this.field.carrying;
    this.field.carrying = null;
    return had;
  }

  /** True while carrying an intact object. */
  get carrying(): boolean {
    return !!this.game.field?.carrying;
  }

  /**
   * LoG2-style scripted beam struggle: mash A until the hero overpowers the foe (cannot be lost).
   * `hero`/`foe` are cast ids for portraits.
   */
  async beamStruggle(hero: string, foe: string, heroColor: string, foeColor: string, lines: string[] = [], pressure = 0.18): Promise<void> {
    await this.game.beamStruggle({
      heroName: CAST_NAMES[hero] ?? hero, foeName: CAST_NAMES[foe] ?? foe, heroColor, foeColor,
      heroPortrait: portrait(hero, 'shout'), foePortrait: portrait(foe, 'angry'), lines: lines.map((l) => this.fmt(l)), pressure,
    });
  }

  /** Open the Capsule Corp Scouter database viewer. */
  async scouterDatabase(): Promise<void> {
    await this.game.openScouterDb();
  }

  /** Wait until every enemy on the map is defeated (field battles). */
  async clearEnemies(): Promise<void> {
    this.game.allowControl = true;
    this.field.forceHostile = true;
    await this.field.until(() => this.field.enemies.every((e) => e.dead || e.state === 'dying' || e.def.invulnerable));
    this.game.allowControl = false;
  }
}
