import { CHARACTERS, FORMS, type CharDef, type FormDef } from '../content/characters';
import { CHARGED_MELEE, TECHNIQUES, type Technique } from '../content/techniques';
import { audio } from '../engine/audio';
import type { Button } from '../engine/input';
import { dirVec, type Dir, type Rect } from '../engine/math';
import { STAT_CAP } from './leveling';
import { Actor } from './actor';
import type { Field } from './field';
import { Beam, Shot } from './projectiles';
import type { CharState } from './state';

type PState = 'free' | 'attack' | 'chargeMelee' | 'special' | 'kiCharge' | 'beam' | 'hurt' | 'transform' | 'dead' | 'locked';

const COMBO_LEN = [13, 13, 17];
const COMBO_HIT = 4;
const COMBO_MULT = [1, 1, 1.35];
const HOLD_TO_CHARGE = 16;
/** Burning Attack's stun on regular enemies (LoG2: 3-5 s). Bosses are held for less (see Enemy.onHit). */
const STUN_TECH_FRAMES = 240;
const MAX_MELEE_CHARGE = 60;
const Z_FILL_FRAMES = 600; // ~10 s, LoG2 design default
const TRANSFORM_FRAMES = 60;
const RUN_TAP_WINDOW = 14;
const IDLE_ANIM_AFTER = 600;

/** The controllable hero. Wraps a CharState and implements LoG2's field combat controls. */
export class Player extends Actor {
  cs: CharState;
  def: CharDef;
  state: PState = 'free';
  private t = 0;
  private combo = 0;
  private queued = false;
  private aHeld = 0;
  private chargeT = 0;
  private special: { style: string; mult: number; t: number; extra: number } | null = null;
  private kiCharge: { tech: Technique; lv: number; t: number } | null = null;
  beam: Beam | null = null;
  private beamDrain = 0;
  private shotCd = 0;
  private lastTap: { btn: Button; t: number } | null = null;
  private runBtn: Button | null = null;
  private idleT = 0;
  /** Enemies already struck by the current swing. */
  hitList = new Set<object>();
  /** Active Z form id. */
  formActive: string | null = null;
  /** Transformation gauge 0..1 (LoG2's yellow triangle). */
  zGauge = 1;
  private drainAcc = 0;
  private regenAcc = 0;
  private kiRegenT = 0;
  /** Frames of being held by a drain grab (mash A/B to escape). */
  grabbed = 0;

  constructor(cs: CharState, x: number, y: number) {
    super(CHARACTERS[cs.id].sprite, x, y);
    this.cs = cs;
    this.def = CHARACTERS[cs.id];
    this.refreshSprite();
  }

  /** Switch which character this player represents. */
  bind(cs: CharState): void {
    this.cs = cs;
    this.def = CHARACTERS[cs.id];
    this.formActive = null;
    this.zGauge = 1;
    this.state = 'free';
    this.refreshSprite();
  }

  /** Current form definition. */
  get form(): FormDef | null {
    return this.formActive ? FORMS[this.formActive] ?? null : null;
  }

  /** Sprite id for the current form. */
  spriteFor(): string {
    const f = this.form;
    if (!f) return this.cs.outfit ?? this.def.sprite;
    return f.sprite || this.def.formSprites[f.id] || this.def.sprite;
  }

  refreshSprite(): void {
    this.setSprite(this.spriteFor());
    this.aura = this.form?.aura ?? null;
  }

  private bonus(): number {
    const f = this.form;
    if (!f) return 0;
    return f.bonus === 'max' ? 999 : f.bonus;
  }

  /** Effective STR (form bonus applied; 'max' forms pin to 100). */
  get str(): number { return this.form?.bonus === 'max' ? STAT_CAP : this.cs.str + this.bonus(); }
  get pow(): number { return this.form?.bonus === 'max' ? STAT_CAP : this.cs.pow + this.bonus(); }
  get end(): number { return this.form?.bonus === 'max' ? STAT_CAP : this.cs.end + this.bonus(); }

  /** Technique in the current L slot, or null when the Z slot is selected. */
  get tech(): Technique | null {
    const id = this.cs.techs[this.cs.selected];
    return id ? TECHNIQUES[id] ?? null : null;
  }

  /** Whether the Z slot exists (character can transform). */
  get canTransform(): boolean {
    return !!this.cs.form;
  }

  get zSelected(): boolean {
    return this.cs.selected >= this.cs.techs.length;
  }

  /** Rect in front of the player for melee / interaction. */
  front(reach = 16, width = 18): Rect {
    const v = dirVec(this.dir);
    const midY = this.y - 12;
    if (v.x !== 0) return { x: v.x > 0 ? this.x + 4 : this.x - 4 - reach, y: midY - width / 2, w: reach, h: width };
    if (v.y > 0) return { x: this.x - width / 2, y: this.y - 6, w: width, h: reach };
    return { x: this.x - width / 2, y: this.y - 20 - reach, w: width, h: reach };
  }

  /** Hand position for projectiles (ground point + facing offset). */
  muzzle(): { x: number; y: number } {
    const v = dirVec(this.dir);
    return { x: this.x + v.x * 10, y: this.y + v.y * 6 + (v.y < 0 ? -4 : 0) };
  }

  /** Called by the field when the player takes damage. */
  onHurt(fromX: number, fromY: number): void {
    if (this.state === 'transform') {
      // LoG2: getting hit during the transformation cancels it and empties the triangle.
      this.zGauge = 0;
      this.aura = this.form?.aura ?? null;
    }
    this.endBeam();
    this.kiCharge = null;
    this.special = null;
    this.state = 'hurt';
    this.t = 0;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const l = Math.hypot(dx, dy) || 1;
    this.kx = (dx / l) * 2.4;
    this.ky = (dy / l) * 2.4;
    this.inv = 45;
    this.flash = 4;
  }

  /** Enter scripted/locked state (cutscenes). */
  lock(on: boolean): void {
    if (this.state === 'dead') return;
    if (on) {
      this.endBeam();
      this.kiCharge = null;
      this.special = null;
      this.state = 'locked';
      this.moving = false;
      this.running = false;
      this.pose = 'idle';
    } else if (this.state === 'locked') {
      this.state = 'free';
    }
  }

  private endBeam(): void {
    if (this.beam) this.beam.dead = true;
    this.beam = null;
  }

  /** Revert from a transformation. */
  revert(): void {
    if (!this.formActive) return;
    this.formActive = null;
    this.zGauge = 0;
    this.refreshSprite();
  }

  update(f: Field): void {
    const inp = f.input;
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.inv > 0) this.inv--;
    if (this.shotCd > 0) this.shotCd--;

    // Knockback.
    if (this.kx || this.ky) {
      const r = f.col.move(this.box(), this.kx, this.ky);
      this.x += r.dx;
      this.y += r.dy;
      this.kx *= 0.78;
      this.ky *= 0.78;
      if (Math.abs(this.kx) < 0.1) this.kx = 0;
      if (Math.abs(this.ky) < 0.1) this.ky = 0;
    }

    this.passives(f);

    if (this.state === 'dead') { this.pose = 'ko'; return; }
    if (this.state === 'locked') { this.animate(); return; }

    if (this.grabbed > 0) {
      this.grabbed--;
      this.pose = 'hurt';
      if (inp.pressed('A') || inp.pressed('B')) this.grabbed = Math.max(0, this.grabbed - 6);
      return;
    }

    // L cycles technique / Z.
    if (inp.pressed('L') && this.state === 'free') {
      const slots = this.cs.techs.length + (this.canTransform ? 1 : 0);
      if (slots > 1) {
        this.cs.selected = (this.cs.selected + 1) % slots;
        audio.sfx('menuMove');
      }
    }
    if (this.cs.selected >= this.cs.techs.length + (this.canTransform ? 1 : 0)) this.cs.selected = 0;

    switch (this.state) {
      case 'free': this.updateFree(f); break;
      case 'attack': this.updateAttack(f); break;
      case 'chargeMelee': this.updateChargeMelee(f); break;
      case 'special': this.updateSpecial(f); break;
      case 'kiCharge': this.updateKiCharge(f); break;
      case 'beam': this.updateBeam(f); break;
      case 'transform': this.updateTransform(f); break;
      case 'hurt':
        this.pose = 'hurt';
        if (this.t > 16) { this.state = 'free'; this.pose = 'idle'; }
        break;
    }
    this.animate();
  }

  /** EP drain while transformed, regen, Z gauge refill, idle anims. */
  private passives(f: Field): void {
    const form = this.form;
    if (form) {
      if (form.drain > 0) {
        this.drainAcc += form.drain / 60;
        while (this.drainAcc >= 1) { this.drainAcc -= 1; this.cs.ep = Math.max(0, this.cs.ep - 1); }
        if (this.cs.ep <= 0) { this.revert(); audio.sfx('menuBack'); }
      }
      if (form.regen > 0) {
        this.regenAcc += form.regen * this.cs.hpMax / 60;
        while (this.regenAcc >= 1) { this.regenAcc -= 1; this.cs.hp = Math.min(this.cs.hpMax, this.cs.hp + 1); }
      }
      if (form.hpDrain) {
        this.regenAcc -= form.hpDrain * this.cs.hpMax / 60;
        while (this.regenAcc <= -1) { this.regenAcc += 1; this.cs.hp = Math.max(1, this.cs.hp - 1); }
      }
      if (f.tick % 3 === 0) f.fx.aura(this.x, this.y, form.aura, 1);
    } else if (this.zGauge < 1 && this.state !== 'transform') {
      this.zGauge = Math.min(1, this.zGauge + 1 / Z_FILL_FRAMES);
    }
    // Very slow natural EP regen while standing still (LoG2).
    if (!form && this.state === 'free' && !this.moving) {
      this.kiRegenT++;
      if (this.kiRegenT >= 90) { this.kiRegenT = 0; this.cs.ep = Math.min(this.cs.epMax, this.cs.ep + 1); }
    } else this.kiRegenT = 0;
  }

  private moveInput(f: Field): { x: number; y: number } {
    const inp = f.input;
    let x = 0;
    let y = 0;
    if (inp.isDown('left')) x -= 1;
    if (inp.isDown('right')) x += 1;
    if (inp.isDown('up')) y -= 1;
    if (inp.isDown('down')) y += 1;
    // Double-tap-and-hold to run.
    for (const b of ['left', 'right', 'up', 'down'] as Button[]) {
      if (inp.pressed(b)) {
        if (this.lastTap && this.lastTap.btn === b && f.tick - this.lastTap.t <= RUN_TAP_WINDOW) this.runBtn = b;
        this.lastTap = { btn: b, t: f.tick };
      }
    }
    if (this.runBtn && !inp.isDown(this.runBtn)) this.runBtn = null;
    return { x, y };
  }

  private updateFree(f: Field): void {
    const inp = f.input;
    const v = this.moveInput(f);
    this.moving = v.x !== 0 || v.y !== 0;
    this.running = this.moving && this.runBtn !== null;
    this.pose = 'idle';
    if (this.moving) {
      this.idleT = 0;
      this.z = 0;
      // Facing: keep current facing if it is one of the pressed diagonal components.
      const cur = dirVec(this.dir);
      const keep = (cur.x !== 0 && cur.x === v.x) || (cur.y !== 0 && cur.y === v.y);
      if (!keep) this.dir = v.x !== 0 ? (v.x < 0 ? 'left' : 'right') : v.y < 0 ? 'up' : 'down';
      const diag = v.x !== 0 && v.y !== 0 ? Math.SQRT1_2 : 1;
      const sp = this.def.walk * (this.form?.speed ?? 1) * (this.running ? 1.75 : 1) * diag;
      const r = f.col.move(this.box(), v.x * sp, v.y * sp);
      this.x += r.dx;
      this.y += r.dy;
      if (this.running && f.tick % 10 === 0) f.fx.dust(this.x, this.y);
    } else {
      this.idleT++;
      if (this.idleT > IDLE_ANIM_AFTER) this.idleAnim(f);
    }

    if (inp.pressed('A')) {
      this.idleT = 0;
      if (f.tryInteract()) return;
      if (f.canFight) this.startCombo(f);
      return;
    }
    if (inp.pressed('B') && f.canFight) {
      this.idleT = 0;
      this.startKi(f);
    }
  }

  private idleAnim(f: Field): void {
    const ph = Math.floor((this.idleT - IDLE_ANIM_AFTER) / 20) % 4;
    switch (this.def.idle) {
      case 'pushups': this.pose = (['punch1', 'punch2', 'kick', 'idle'] as const)[ph]; break;
      case 'kiBall': this.pose = 'raise'; if (f.tick % 4 === 0) f.fx.aura(this.x + 8, this.y - 26, '#80c0ff', 1); break;
      case 'meditate': this.pose = 'guard'; this.z = 3 + Math.round(Math.sin(this.idleT / 15) * 2); break;
      case 'flex': this.pose = ph % 2 ? 'raise' : 'guard'; break;
      case 'leanSword':
      case 'sit': this.pose = 'guard'; break;
      default: break;
    }
  }

  private startCombo(f: Field): void {
    this.state = 'attack';
    this.combo = 0;
    this.t = 0;
    this.queued = false;
    this.aHeld = 0;
    this.hitList.clear();
    this.pose = 'punch1';
    this.z = 0;
    audio.sfx(this.def.sword ? 'slash' : 'punch');
    void f;
  }

  private updateAttack(f: Field): void {
    const inp = f.input;
    // Consecutive frames A has stayed down since the jab started (a release resets it, so mashing never charges).
    this.aHeld = inp.isDown('A') ? this.aHeld + 1 : 0;
    // Holding A through the first jab charges the special melee (once learned from Roshi).
    if (this.combo === 0 && this.aHeld >= HOLD_TO_CHARGE && this.cs.charged) {
      this.state = 'chargeMelee';
      this.chargeT = 0;
      this.t = 0;
      audio.sfx('charge');
      return;
    }
    const len = COMBO_LEN[this.combo];
    const v = dirVec(this.dir);
    if (this.t < 8) {
      const r = f.col.move(this.box(), v.x * 0.5, v.y * 0.5);
      this.x += r.dx;
      this.y += r.dy;
    }
    if (this.t === COMBO_HIT) {
      const energy = this.tech?.kind === 'punch';
      let mult = COMBO_MULT[this.combo];
      if (energy && this.cs.ep >= TECHNIQUES.energyPunch.cost) {
        this.cs.ep -= TECHNIQUES.energyPunch.cost;
        mult *= TECHNIQUES.energyPunch.mult;
        f.fx.hit(this.front().x + 8, this.front().y + 8, '#80c0ff', 4);
      }
      const reach = this.def.sword ? 20 : 16;
      const n = f.meleeHit(this.front(reach), this.str, mult, { knock: this.combo === 2 ? 3.2 : 1.6, hitList: this.hitList });
      if (n === 0 && this.combo === 0) audio.sfx('dash');
    }
    if (this.t > 5 && inp.pressed('A')) this.queued = true;
    if (this.t >= len) {
      // LoG2: the first jab's follow-through holds while A stays down, so the hold can reach the charge threshold.
      if (this.combo === 0 && this.cs.charged && this.aHeld > 0) { this.pose = 'punch1'; return; }
      if (this.queued && this.combo < 2) {
        this.combo++;
        this.t = 0;
        this.queued = false;
        this.hitList.clear();
        this.pose = this.combo === 1 ? 'punch2' : this.def.sword ? 'punch1' : 'kick';
        audio.sfx(this.def.sword ? 'slash' : 'punch');
      } else {
        this.state = 'free';
        this.pose = 'idle';
      }
    }
  }

  private updateChargeMelee(f: Field): void {
    const inp = f.input;
    this.pose = 'charge';
    this.chargeT = Math.min(MAX_MELEE_CHARGE, this.chargeT + 1);
    if (f.tick % 2 === 0) f.fx.aura(this.x, this.y, '#ffffff', this.chargeT >= MAX_MELEE_CHARGE ? 2 : 1);
    if (!inp.isDown('A')) {
      const cm = CHARGED_MELEE[this.def.charged];
      const k = this.chargeT / MAX_MELEE_CHARGE;
      this.special = { style: cm.style, mult: 1 + (cm.mult - 1) * k, t: 0, extra: 0 };
      this.state = 'special';
      this.t = 0;
      this.hitList.clear();
      audio.sfx(cm.style === 'spin' ? 'dash' : 'punch');
    }
  }

  private updateSpecial(f: Field): void {
    const s = this.special;
    if (!s) { this.state = 'free'; return; }
    s.t++;
    const v = dirVec(this.dir);
    const mv = (sp: number) => {
      const r = f.col.move(this.box(), v.x * sp, v.y * sp);
      this.x += r.dx;
      this.y += r.dy;
    };
    switch (s.style) {
      case 'lunge':
        this.pose = 'kick';
        if (s.t <= 14) { mv(3.5); f.meleeHit(this.front(18, 20), this.str, s.mult, { knock: 4, hitList: this.hitList }); }
        if (s.t >= 20) this.finishSpecial();
        break;
      case 'smash':
        this.pose = s.t < 14 ? 'raise' : 'punch2';
        if (s.t < 14) { mv(2.5); this.z = Math.round(Math.sin((s.t / 14) * Math.PI) * 12); }
        if (s.t === 14) {
          this.z = 0;
          f.camera.shake(8, 2);
          const fr = this.front(26, 32);
          f.fx.explode(fr.x + fr.w / 2, fr.y + fr.h / 2, 12, '#e0d0b0');
          f.meleeHit(fr, this.str, s.mult, { knock: 4.5, hitList: this.hitList });
          audio.sfx('hit');
        }
        if (s.t >= 26) this.finishSpecial();
        break;
      case 'slash':
        this.pose = s.t < 8 ? 'punch1' : 'punch2';
        if (s.t <= 14) mv(3);
        if (s.t === 4 || s.t === 11) {
          this.hitList.clear();
          const fr = this.front(22, 24);
          f.fx.hit(fr.x + fr.w / 2, fr.y + fr.h / 2, '#d0f0ff', 8);
          f.meleeHit(fr, this.str, s.mult * 0.6, { knock: 2.5, hitList: this.hitList });
          audio.sfx('blast');
        }
        if (s.t >= 22) this.finishSpecial();
        break;
      case 'spin': {
        const order: Dir[] = ['down', 'left', 'up', 'right'];
        this.dir = order[Math.floor(s.t / 3) % 4];
        this.pose = 'punch1';
        if (s.t === 4 || s.t === 10 || s.t === 16) {
          this.hitList.clear();
          f.meleeHit({ x: this.x - 24, y: this.y - 34, w: 48, h: 44 }, this.str, s.mult * 0.5, { knock: 3, hitList: this.hitList });
        }
        if (s.t >= 22) this.finishSpecial();
        break;
      }
      case 'flurry': {
        const active = s.t <= 24 || (s.extra > 0 && s.t <= 24 + s.extra * 8);
        if (s.t > 24 && s.t <= 54 && f.input.pressed('A') && s.extra < 3) { s.extra++; }
        if (active) {
          this.pose = Math.floor(s.t / 4) % 2 ? 'punch1' : 'punch2';
          if (s.t % 4 === 0) {
            this.hitList.clear();
            f.meleeHit(this.front(18, 22), this.str, s.mult * 0.35, { knock: 0.6, hitList: this.hitList });
            if (s.t % 8 === 0) audio.sfx('punch');
          }
        } else this.pose = 'guard';
        if (s.t >= 24 + Math.max(30, s.extra * 8)) this.finishSpecial();
        break;
      }
      default: this.finishSpecial();
    }
  }

  private finishSpecial(): void {
    this.special = null;
    this.state = 'free';
    this.pose = 'idle';
    this.z = 0;
  }

  private startKi(f: Field): void {
    if (this.zSelected) {
      if (this.formActive) { this.revert(); audio.sfx('menuBack'); return; }
      if (!this.cs.form) return;
      if (this.zGauge < 1 || this.cs.ep < 4) { audio.sfx('denied'); return; }
      this.state = 'transform';
      this.t = 0;
      audio.sfx('powerUp');
      return;
    }
    const tech = this.tech;
    if (!tech) return;
    if (this.cs.ep < tech.cost) { audio.sfx('denied'); return; }
    const m = this.muzzle();
    const v = dirVec(this.dir);
    switch (tech.kind) {
      case 'shot':
        if (this.shotCd > 0) return;
        this.cs.ep -= tech.cost;
        f.spawnShot(new Shot('player', 'shot', m.x, m.y, v, 3.6, tech.mult, tech.color, this.pow, this.cs.level));
        this.shotCd = 7;
        this.pose = 'blast';
        this.state = 'attack';
        this.combo = 2;
        this.t = COMBO_LEN[2] - 6;
        audio.sfx('blast');
        break;
      case 'stun':
      case 'wave': {
        if (this.shotCd > 0) return;
        this.cs.ep -= tech.cost;
        const s = new Shot('player', tech.kind === 'wave' ? 'wave' : 'stun', m.x, m.y, v, tech.kind === 'wave' ? 4.5 : 3, tech.mult, tech.color, this.pow, this.cs.level);
        if (tech.kind === 'stun') { s.stun = STUN_TECH_FRAMES; s.techStun = true; }
        if (tech.kind === 'wave') s.pierce = true;
        f.spawnShot(s);
        this.shotCd = 20;
        this.pose = this.def.sword ? 'punch2' : 'blast';
        this.state = 'attack';
        this.combo = 2;
        this.t = COMBO_LEN[2] - 10;
        audio.sfx('blast');
        break;
      }
      case 'spread': {
        if (this.shotCd > 0) return;
        this.cs.ep -= tech.cost;
        for (const a of [-0.32, 0, 0.32]) {
          const ang = Math.atan2(v.y, v.x) + a;
          const s = new Shot('player', 'ball', m.x, m.y, { x: Math.cos(ang), y: Math.sin(ang) }, 3, tech.mult, tech.color, this.pow, this.cs.level);
          s.r = 4;
          s.boom = 14;
          f.spawnShot(s);
        }
        this.shotCd = 24;
        this.pose = 'blast';
        this.state = 'attack';
        this.combo = 2;
        this.t = COMBO_LEN[2] - 12;
        audio.sfx('blast');
        break;
      }
      case 'beam':
      case 'pierceBeam': {
        this.cs.ep -= tech.cost;
        this.state = 'beam';
        this.t = 0;
        this.beamDrain = 0;
        this.pose = 'blast';
        const width = tech.id === 'finalFlash' ? 10 : 7;
        this.beam = new Beam('player', m.x, m.y, this.dir, tech.kind === 'pierceBeam' ? 4 : width, tech.color, tech.mult, tech.kind === 'pierceBeam', this.pow, this.cs.level);
        f.addBeam(this.beam);
        audio.sfx('beam');
        break;
      }
      case 'charge':
      case 'arc':
        this.cs.ep -= tech.cost;
        this.kiCharge = { tech, lv: 1, t: 0 };
        this.state = 'kiCharge';
        this.t = 0;
        this.pose = tech.kind === 'charge' && tech.id === 'spiritBomb' ? 'raise' : 'charge';
        audio.sfx('charge');
        break;
      case 'pose':
        this.cs.ep -= tech.cost;
        this.pose = 'raise';
        this.state = 'attack';
        this.combo = 2;
        this.t = 0;
        f.freezeEnemies(tech.id === 'barrier' ? 150 : 270);
        f.flashScreen('#ffffff', 10);
        audio.sfx('teleport');
        break;
      case 'punch':
        // Energy Punch only modifies A; B does nothing while selected.
        break;
    }
  }

  private updateKiCharge(f: Field): void {
    const kc = this.kiCharge;
    if (!kc) { this.state = 'free'; return; }
    kc.t++;
    const max = kc.tech.maxCharge ?? 3;
    if (kc.t % 24 === 0 && kc.lv < max && f.input.isDown('B')) {
      if (this.cs.ep >= kc.tech.cost) { this.cs.ep -= kc.tech.cost; kc.lv++; audio.sfx('charge'); }
    }
    if (f.tick % 2 === 0) f.fx.aura(this.x, this.y, kc.tech.color, kc.lv);
    if (!f.input.isDown('B') || kc.t > 200) {
      const m = this.muzzle();
      const v = dirVec(this.dir);
      if (kc.tech.kind === 'charge') {
        const s = new Shot('player', 'ball', m.x, m.y, v, 2.4, kc.tech.mult * (0.6 + kc.lv * 0.4), kc.tech.color, this.pow, this.cs.level);
        s.r = 5 + kc.lv * 3;
        s.boom = 14 + kc.lv * 8;
        s.life = 60 + kc.lv * 30;
        s.lift = kc.tech.id === 'spiritBomb' ? 22 : 14;
        if (kc.tech.id === 'spiritBomb') { s.stun = 90; s.techStun = true; }
        f.spawnShot(s);
      } else {
        const dist = 36 + kc.lv * 28;
        const s = new Shot('player', 'arc', m.x, m.y, v, 0, kc.tech.mult * (0.7 + kc.lv * 0.3), kc.tech.color, this.pow, this.cs.level);
        s.r = 5;
        s.boom = 16 + kc.lv * 4;
        s.lob(m.x + v.x * dist, m.y + v.y * dist, 22 + kc.lv * 6);
        f.spawnShot(s);
      }
      audio.sfx('blast');
      this.kiCharge = null;
      this.pose = 'blast';
      this.state = 'attack';
      this.combo = 2;
      this.t = COMBO_LEN[2] - 10;
    }
  }

  private updateBeam(f: Field): void {
    const b = this.beam;
    this.pose = 'blast';
    if (!b || b.dead) { this.state = 'free'; this.beam = null; return; }
    const m = this.muzzle();
    b.ox = m.x;
    b.oy = m.y;
    b.atk = this.pow;
    this.beamDrain++;
    const tech = this.tech;
    const drainEvery = tech?.id === 'finalFlash' ? 3 : 6;
    if (this.beamDrain >= drainEvery) {
      this.beamDrain = 0;
      this.cs.ep -= 1;
    }
    if (f.tick % 2 === 0) f.camera.shake(2, 1);
    const held = f.input.isDown('B');
    if ((!held && this.t > 20) || this.cs.ep <= 0) {
      this.cs.ep = Math.max(0, this.cs.ep);
      this.endBeam();
      this.state = 'free';
      this.pose = 'idle';
    }
  }

  private updateTransform(f: Field): void {
    this.pose = 'charge';
    f.fx.aura(this.x, this.y, FORMS[this.cs.form ?? 'ssj']?.aura ?? '#f8e048', 2);
    if (this.t % 8 === 0) f.camera.shake(6, 1);
    if (this.t === Math.floor(TRANSFORM_FRAMES * 0.6)) this.flash = 6;
    if (this.t >= TRANSFORM_FRAMES) {
      this.formActive = this.cs.form;
      this.zGauge = 0;
      this.refreshSprite();
      f.flashScreen('#ffffff', 8);
      f.fx.explode(this.x, this.y - 12, 18, this.form?.aura ?? '#f8e048');
      this.state = 'free';
      this.pose = 'idle';
    }
  }
}
