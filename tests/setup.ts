/**
 * Minimal DOM/canvas shim so the real engine (maps, sprites, scenes) runs headless in Node.
 * Drawing calls are no-ops; ImageData buffers are real so pixel code executes.
 */
class FakeImageData {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    this.data = new Uint8ClampedArray(Math.max(1, width * height * 4));
  }
}

function fakeCtx(canvas: { width: number; height: number }): Record<string, unknown> {
  const noop = () => undefined;
  return new Proxy({
    canvas,
    createImageData: (w: number, h: number) => new FakeImageData(w, h),
    getImageData: (_x: number, _y: number, w: number, h: number) => new FakeImageData(w, h),
    putImageData: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 0 }),
  } as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return noop;
    },
    set(target, prop: string, v) {
      target[prop] = v;
      return true;
    },
  });
}

function fakeCanvas(): Record<string, unknown> {
  const c: Record<string, unknown> = { width: 300, height: 150, style: {} };
  const ctx = fakeCtx(c as { width: number; height: number });
  c.getContext = () => ctx;
  return c;
}

const g = globalThis as Record<string, unknown>;
const store = new Map<string, string>();
g.document = {
  createElement: () => fakeCanvas(),
  getElementById: () => null,
  body: { appendChild: () => undefined, style: {} },
};
g.window = {
  addEventListener: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
  matchMedia: () => ({ matches: false }),
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};
g.requestAnimationFrame = () => 0;
