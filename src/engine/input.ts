/** The ten GBA buttons. */
export type Button = 'up' | 'down' | 'left' | 'right' | 'A' | 'B' | 'L' | 'R' | 'start' | 'select';

export const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'A', 'B', 'L', 'R', 'start', 'select'];

const KEYMAP: Record<string, Button> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'A', KeyJ: 'A', Space: 'A',
  KeyX: 'B', KeyK: 'B',
  KeyQ: 'L', KeyU: 'L',
  KeyE: 'R', KeyI: 'R',
  Enter: 'start',
  ShiftLeft: 'select', ShiftRight: 'select', Backspace: 'select',
};

/**
 * Directions held by a touch at (dx, dy) from the D-pad's centre: 8 sectors of 45°, so one thumb can hold a
 * diagonal (two buttons). Inside the small dead zone (`dead` px) nothing is held.
 */
export function dpadButtons(dx: number, dy: number, dead = 8): Button[] {
  if (Math.hypot(dx, dy) < dead) return [];
  const sector = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return ([
    ['right'], ['right', 'down'], ['down'], ['down', 'left'], ['left'], ['left', 'up'], ['up'], ['up', 'right'],
  ] as Button[][])[sector];
}

/** Standard-mapping gamepad button indices per GBA button. */
const PADMAP: Partial<Record<Button, number[]>> = {
  A: [0], B: [1, 2], L: [4, 6], R: [5, 7], select: [8], start: [9],
  up: [12], down: [13], left: [14], right: [15],
};

/**
 * Polled input state merged from keyboard, gamepad and touch.
 * Call `poll()` once per fixed tick; `pressed` is true only on the tick a button went down.
 */
export class Input {
  private readonly keys = new Set<Button>();
  private readonly touch = new Set<Button>();
  /** Buttons that went down since the last poll; a tap shorter than one frame still registers once. */
  private readonly latched = new Set<Button>();
  private readonly down = new Set<Button>();
  private readonly prev = new Set<Button>();
  /** Ticks each button has been held, for key-repeat in menus. */
  private readonly held = new Map<Button, number>();
  /** Set when any input happens; used to unlock WebAudio on first gesture. */
  onFirstGesture: (() => void) | null = null;

  constructor(target: Window | null = typeof window !== 'undefined' ? window : null) {
    if (!target) return;
    target.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      this.keys.add(b);
      this.latched.add(b);
      this.gesture();
    });
    target.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (b) this.keys.delete(b);
    });
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.touch.clear();
    });
    this.bindTouch();
  }

  private gesture(): void {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  /**
   * Touch controls. The D-pad is one zone (8-way: a thumb on a corner or sliding between arms holds a
   * diagonal); a thumb that went down on it keeps steering from it even if it drifts off the edge.
   * Every other button maps to the element under the pointer.
   */
  private bindTouch(): void {
    const root = typeof document !== 'undefined' ? document.getElementById('touch') : null;
    if (!root) return;
    const active = new Map<number, { btns: Button[]; pad: HTMLElement | null }>();
    const held = (): Set<Button> => new Set([...active.values()].flatMap((a) => a.btns));
    const refresh = () => {
      const now = held();
      for (const b of BUTTONS) {
        const was = this.touch.has(b);
        if (now.has(b) && !was) { this.touch.add(b); this.latched.add(b); }
        if (!now.has(b) && was) this.touch.delete(b);
        root.querySelector(`[data-btn="${b}"]`)?.classList.toggle('pressed', now.has(b));
      }
    };
    const update = (e: PointerEvent, on: boolean) => {
      if (!on) { active.delete(e.pointerId); refresh(); return; }
      const prev = active.get(e.pointerId);
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const pad = prev ? prev.pad : (el?.closest('.dpad') as HTMLElement | null) ?? null;
      let btns: Button[];
      if (pad) {
        const r = pad.getBoundingClientRect();
        btns = dpadButtons(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width * 0.1);
      } else {
        const b = el?.dataset.btn as Button | undefined;
        btns = b ? [b] : [];
      }
      active.set(e.pointerId, { btns, pad });
      refresh();
    };
    root.addEventListener('pointerdown', (e) => { e.preventDefault(); this.gesture(); update(e, true); });
    root.addEventListener('pointermove', (e) => { if (active.has(e.pointerId)) update(e, true); });
    const end = (e: PointerEvent) => update(e, false);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Snapshot all sources into this tick's state. */
  poll(): void {
    this.prev.clear();
    for (const b of this.down) this.prev.add(b);
    this.down.clear();
    for (const b of this.keys) this.down.add(b);
    for (const b of this.touch) this.down.add(b);
    for (const b of this.latched) this.down.add(b);
    this.latched.clear();
    const pads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      for (const [b, idx] of Object.entries(PADMAP) as [Button, number[]][]) {
        if (idx.some((i) => p.buttons[i]?.pressed)) this.down.add(b);
      }
      const [ax = 0, ay = 0] = p.axes;
      if (ax < -0.5) this.down.add('left');
      if (ax > 0.5) this.down.add('right');
      if (ay < -0.5) this.down.add('up');
      if (ay > 0.5) this.down.add('down');
      if (p.buttons.some((x) => x.pressed)) this.gesture();
    }
    for (const b of BUTTONS) {
      this.held.set(b, this.down.has(b) ? (this.held.get(b) ?? 0) + 1 : 0);
    }
  }

  /** Button currently held. */
  isDown(b: Button): boolean {
    return this.down.has(b);
  }

  /** Button went down this tick. */
  pressed(b: Button): boolean {
    return this.down.has(b) && !this.prev.has(b);
  }

  /** Button went up this tick. */
  released(b: Button): boolean {
    return !this.down.has(b) && this.prev.has(b);
  }

  /** Ticks the button has been held (0 when up). */
  heldFor(b: Button): number {
    return this.held.get(b) ?? 0;
  }

  /** Pressed with menu auto-repeat: fires on press, then every 6 ticks after 20. */
  repeat(b: Button): boolean {
    const t = this.heldFor(b);
    return t === 1 || (t > 20 && (t - 20) % 6 === 0);
  }

  /** Clear all held state, e.g. after a scene change so a held A does not leak through. */
  swallow(): void {
    for (const b of this.down) this.prev.add(b);
  }

  /** Programmatically press buttons (used by automated play-tests). */
  inject(b: Button, on: boolean): void {
    if (on) { this.keys.add(b); this.latched.add(b); }
    else this.keys.delete(b);
  }
}
