import { PAL } from '../art/color';
import { spriteSet } from '../art/registry';
import { CHARACTERS } from '../content/characters';
import { QUESTS } from '../content/quests';
import { SPOTS, WORLDS, type LandingSpot, type WorldId } from '../content/world';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { font, hexRgb, makeBitmap, type Bitmap } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';

const TEX = 256;
const HORIZON = 46;
const FOCAL = 110;
const CAM_H = 22;
/** Distance from camera to the point under the player sprite. */
const PLAYER_D = (CAM_H * FOCAL) / (138 - HORIZON);

interface WorldTex {
  data: Uint8ClampedArray;
  bmp: Bitmap;
}

const texCache = new Map<WorldId, WorldTex>();

function hash2(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function valueNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  const u = sm(xf);
  const v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, s: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 5; o++) {
    sum += valueNoise((x * f) / 32, (y * f) / 32, s + o * 17) * amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum;
}

type Rgb = readonly [number, number, number];
const C = {
  deep: [32, 88, 192], shallow: [56, 128, 216], sand: [224, 208, 144], grass: [88, 168, 72], forest: [48, 128, 56],
  rock: [136, 112, 88], hill: [112, 128, 80], snow: [240, 240, 248], desert: [216, 184, 112], waste: [176, 112, 72],
  city: [168, 168, 180], block: [120, 120, 136], ruin: [140, 128, 112],
} satisfies Record<string, Rgb>;

/** Biome painted under a landing spot so the place looks like what it is (island, city, desert...). */
type Biome = 'island' | 'city' | 'desert' | 'snow' | 'waste' | 'mountain' | 'rocky' | 'lake' | 'clearing' | 'ruins';

/** Which biome a spot stands in: from its name for the special places, else from its icon. */
export function spotBiome(sp: LandingSpot): Biome {
  const key = `${sp.id} ${sp.name}`;
  if (/desert/i.test(key)) return 'desert';
  if (/snow/i.test(key)) return 'snow';
  if (/wasteland/i.test(key)) return 'waste';
  switch (sp.icon) {
    case 'island': return 'island';
    case 'city': return 'city';
    case 'ruins': return 'ruins';
    case 'mountain': return 'mountain';
    case 'cave': return 'rocky';
    case 'palace': return 'lake';
    default: return 'clearing';
  }
}

/**
 * Stamp a spot's biome onto the texture after the noise pass (the noise alone put Kame House inland and West
 * City on a snowcap). Edges are jittered so the patches blend into the surrounding terrain.
 */
function stampSpot(data: Uint8ClampedArray, sp: LandingSpot, seed: number, future: boolean): void {
  const biome = spotBiome(sp);
  const R = biome === 'island' ? 16 : biome === 'desert' || biome === 'snow' || biome === 'waste' ? 14 : biome === 'city' || biome === 'ruins' ? 12 : 10;
  const put = (x: number, y: number, c: Rgb, water = false): void => {
    if (x < 0 || y < 0 || x >= TEX || y >= TEX) return;
    let [r, g, b] = c;
    if (future) {
      if (water) { r = 48; g = 64; b = 96; } else { const grey = (r + g + b) / 3; r = grey * 0.6 + 70; g = grey * 0.5 + 50; b = grey * 0.5 + 40; }
    }
    const i = (y * TEX + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  };
  for (let y = sp.y - R - 2; y <= sp.y + R + 2; y++) {
    for (let x = sp.x - R - 2; x <= sp.x + R + 2; x++) {
      const d = Math.hypot(x - sp.x, y - sp.y) + (hash2(x, y, seed + 41) - 0.5) * 3;
      if (d > R) continue;
      const k = d / R;
      const n = hash2(x >> 1, y >> 1, seed + 43);
      switch (biome) {
        case 'island': put(x, y, k < 0.3 ? C.grass : k < 0.45 ? C.sand : k < 0.75 ? C.shallow : C.deep, k >= 0.45); break;
        case 'city': {
          const street = (x - sp.x + 64) % 4 === 0 || (y - sp.y + 64) % 4 === 0;
          put(x, y, k > 0.85 ? C.grass : street ? C.city : n > 0.5 ? C.block : C.city);
          break;
        }
        case 'ruins': put(x, y, k > 0.8 ? C.sand : n > 0.6 ? C.ruin : future ? C.block : C.desert); break;
        case 'desert': put(x, y, n > 0.88 ? C.rock : C.desert); break;
        case 'snow': put(x, y, k < 0.35 && n > 0.55 ? C.rock : C.snow); break;
        case 'waste': put(x, y, n > 0.7 ? C.rock : C.waste); break;
        case 'mountain': put(x, y, k < 0.35 ? C.grass : n > 0.45 ? C.rock : C.hill); break;
        case 'rocky': put(x, y, k < 0.3 ? C.hill : C.rock); break;
        case 'lake': put(x, y, Math.hypot(x - (sp.x + 5), y - sp.y) < 4 ? C.shallow : k > 0.8 ? C.forest : C.grass, Math.hypot(x - (sp.x + 5), y - sp.y) < 4); break;
        default: put(x, y, k > 0.75 ? C.forest : C.grass); break;
      }
    }
  }
}

/** Colour of a world texel (tests / tooling). */
export function worldTexel(world: WorldId, x: number, y: number): [number, number, number] {
  const t = buildTexture(world);
  const i = (Math.floor(y) * TEX + Math.floor(x)) * 4;
  return [t.data[i], t.data[i + 1], t.data[i + 2]];
}

/** Procedurally paint a world texture (continents, biomes, landmarks). */
function buildTexture(world: WorldId): WorldTex {
  const hit = texCache.get(world);
  if (hit) return hit;
  const { bmp, ctx } = makeBitmap(TEX, TEX);
  const img = ctx.createImageData(TEX, TEX);
  const seed = WORLDS[world].seed;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const i = (y * TEX + x) * 4;
      let r: number;
      let g: number;
      let b: number;
      if (world === 'space') {
        const st = hash2(x, y, seed);
        const neb = fbm(x * 0.7, y * 0.7, seed);
        r = 8 + neb * 40; g = 6 + neb * 18; b = 24 + neb * 60;
        if (st > 0.996) { r = g = b = 255; } else if (st > 0.99) { r = g = b = 150; }
      } else {
        // Island-ish falloff so the map edges are ocean.
        const dx = (x - TEX / 2) / (TEX / 2);
        const dy = (y - TEX / 2) / (TEX / 2);
        const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 0.9);
        const h = fbm(x, y, seed) * 0.75 + fall * 0.55 - 0.32;
        const moist = fbm(x + 300, y + 300, seed + 5);
        const lat = y / TEX;
        if (h < 0.08) { r = 32; g = 88; b = 192; if (h > 0.04) { r = 56; g = 128; b = 216; } }
        else if (h < 0.11) { r = 224; g = 208; b = 144; }
        else if (h > 0.56 && hash2(x >> 2, y >> 2, seed + 3) > 0.3) { r = 240; g = 240; b = 248; }
        else if (h > 0.47) { r = 136; g = 112; b = 88; }
        else if (h > 0.43) { r = 112; g = 128; b = 80; }
        else if (lat > 0.72 && moist < 0.45) { r = 216; g = 184; b = 112; }
        else if (lat < 0.18) { r = 208; g = 224; b = 232; }
        else if (moist > 0.55) { r = 48; g = 128; b = 56; }
        else { r = 88; g = 168; b = 72; }
        if (world === 'future') {
          const grey = (r + g + b) / 3;
          r = grey * 0.6 + 70; g = grey * 0.5 + 50; b = grey * 0.5 + 40;
          if (h < 0.08) { r = 48; g = 64; b = 96; }
        }
        // Speckle.
        const sp = hash2(x, y, seed + 9);
        if (sp > 0.93) { r *= 0.9; g *= 0.9; b *= 0.9; }
      }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  if (world !== 'space') {
    for (const sp of Object.values(SPOTS)) if (sp.world === world && !sp.toWorld) stampSpot(img.data, sp, seed, world === 'future');
  }
  ctx.putImageData(img, 0, 0);
  const tex = { data: img.data, bmp };
  texCache.set(world, tex);
  return tex;
}

/** LoG2's Mode-7 world map: fly over the planet, land on unlocked spots with A. */
export class WorldMapScene implements Scene {
  readonly done: Promise<void>;
  private resolve!: () => void;
  private x: number;
  private y: number;
  private a = 0;
  private t = 0;
  private readonly world: WorldId;
  private readonly tex: WorldTex;
  private readonly frame: ImageData;
  private readonly frameBmp: Bitmap;
  private readonly frameCtx: CanvasRenderingContext2D;
  private landing = false;
  private paused = false;
  private fadeIn = 16;

  constructor(private readonly game: Game) {
    this.done = new Promise((r) => (this.resolve = r));
    const st = game.state;
    this.world = (st.get('world') as WorldId) || 'earth';
    this.tex = buildTexture(this.world);
    const { bmp, ctx } = makeBitmap(SCREEN_W, SCREEN_H);
    this.frameBmp = bmp;
    this.frameCtx = ctx;
    this.frame = ctx.createImageData(SCREEN_W, SCREEN_H);
    // Start over the spot of the current map, else the centre.
    const cur = this.spots().find((s) => s.map === st.data.map) ?? this.spots()[0];
    const sx = cur?.x ?? TEX / 2;
    const sy = cur?.y ?? TEX / 2;
    this.a = (st.get('wmHeading') as number) || 0;
    // Camera sits behind the player point.
    this.x = sx - Math.sin(this.a) * PLAYER_D;
    this.y = sy + Math.cos(this.a) * PLAYER_D;
    game.playMusic(WORLDS[this.world].music);
    audio.sfx('dash');
  }

  private spots(): LandingSpot[] {
    const unlocked = new Set(this.game.state.data.regions);
    return Object.values(SPOTS).filter((s) => s.world === this.world && unlocked.has(s.id));
  }

  /** Spot the current gold objective points to. */
  private starSpot(): string | null {
    const st = this.game.state.data;
    for (const id of [...st.journalOrder].reverse()) {
      if (st.journal[id] !== 'active') continue;
      const q = QUESTS[id];
      if (q && q.star === 'gold' && q.region) return q.region;
    }
    return null;
  }

  private get px(): number { return this.x + Math.sin(this.a) * PLAYER_D; }
  private get py(): number { return this.y - Math.cos(this.a) * PLAYER_D; }

  private nearSpot(): LandingSpot | null {
    let best: LandingSpot | null = null;
    let bd = 9;
    for (const s of this.spots()) {
      const d = Math.hypot(s.x - this.px, s.y - this.py);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  update(input: Input): void {
    this.t++;
    if (this.fadeIn > 0) this.fadeIn--;
    if (this.landing) return;
    if (input.isDown('left')) this.a -= 0.035;
    if (input.isDown('right')) this.a += 0.035;
    const sp = input.isDown('B') ? 1.9 : 1.1;
    let mv = 0;
    if (input.isDown('up')) mv = sp;
    if (input.isDown('down')) mv = -sp * 0.6;
    this.x += Math.sin(this.a) * mv;
    this.y -= Math.cos(this.a) * mv;
    // Keep the player point on the texture.
    const pxC = Math.max(8, Math.min(TEX - 8, this.px));
    const pyC = Math.max(8, Math.min(TEX - 8, this.py));
    this.x += pxC - this.px;
    this.y += pyC - this.py;
    if (input.pressed('start') && !this.paused) {
      this.paused = true;
      void this.game.openPauseOverWorld().then(() => { this.paused = false; });
      return;
    }
    if (this.paused) return;
    if (input.pressed('A')) {
      const s = this.nearSpot();
      if (s) void this.land(s);
      else audio.sfx('denied');
    }
  }

  private async land(s: LandingSpot): Promise<void> {
    this.landing = true;
    audio.sfx('menuOk');
    if (s.toWorld) {
      this.game.state.set('world', s.toWorld);
      this.resolve();
      const next = new WorldMapScene(this.game);
      this.game.scenes.replace(next);
      audio.sfx('teleport');
      return;
    }
    this.game.state.set('wmHeading', this.a);
    this.resolve();
    const f = this.game.startField(s.map, s.tx, s.ty, 'down');
    f.fade = 1;
    f.fadeColor = '#ffffff';
    f.player.z = 30;
    for (let i = 0; i < 16; i++) { await f.wait(1); f.fade = 1 - i / 16; f.player.z = Math.max(0, 30 - i * 2); }
    f.fade = 0;
    f.player.z = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const data = this.frame.data;
    const tex = this.tex.data;
    const sin = Math.sin(this.a);
    const cos = Math.cos(this.a);
    const space = this.world === 'space';
    const [skR, skG, skB] = space ? [6, 4, 18] : this.world === 'future' ? [120, 96, 88] : [112, 168, 240];
    const [fgR, fgG, fgB] = space ? [20, 14, 40] : this.world === 'future' ? [150, 120, 110] : [200, 220, 248];
    for (let y = 0; y < SCREEN_H; y++) {
      if (y <= HORIZON) {
        const k = y / HORIZON;
        for (let x = 0; x < SCREEN_W; x++) {
          const i = (y * SCREEN_W + x) * 4;
          data[i] = skR + (fgR - skR) * k;
          data[i + 1] = skG + (fgG - skG) * k;
          data[i + 2] = skB + (fgB - skB) * k;
          data[i + 3] = 255;
          if (space && hash2(x + Math.round(this.a * 200), y, 3) > 0.993) { data[i] = data[i + 1] = data[i + 2] = 230; }
        }
        continue;
      }
      const d = (CAM_H * FOCAL) / (y - HORIZON);
      const fog = Math.min(1, Math.max(0, (d - 40) / 160));
      for (let x = 0; x < SCREEN_W; x++) {
        const lat = ((x - SCREEN_W / 2) * d) / FOCAL;
        const wx = Math.floor(this.x + sin * d + cos * lat);
        const wy = Math.floor(this.y - cos * d + sin * lat);
        const i = (y * SCREEN_W + x) * 4;
        let r: number;
        let g: number;
        let b: number;
        if (wx < 0 || wy < 0 || wx >= TEX || wy >= TEX) {
          if (space) { r = 8; g = 6; b = 24; } else { r = 28; g = 76; b = 176; }
        } else {
          const j = (wy * TEX + wx) * 4;
          r = tex[j]; g = tex[j + 1]; b = tex[j + 2];
        }
        data[i] = r + (fgR - r) * fog;
        data[i + 1] = g + (fgG - g) * fog;
        data[i + 2] = b + (fgB - b) * fog;
        data[i + 3] = 255;
      }
    }
    this.frameCtx.putImageData(this.frame, 0, 0);
    ctx.drawImage(this.frameBmp, 0, 0);

    // Landing-spot markers projected into the view.
    const star = this.starSpot();
    for (const s of this.spots()) {
      const rx = s.x - this.x;
      const ry = s.y - this.y;
      const fwd = rx * sin - ry * cos;
      const lat = rx * cos + ry * sin;
      if (fwd < 4) continue;
      const sy = HORIZON + (CAM_H * FOCAL) / fwd;
      const sx = SCREEN_W / 2 + (lat * FOCAL) / fwd;
      if (sx < -10 || sx > SCREEN_W + 10 || sy > SCREEN_H) continue;
      const size = Math.max(2, Math.min(9, 260 / fwd));
      const col = s.color ?? (s.icon === 'city' ? '#e8e8f0' : '#c070f0');
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(sx - size / 2) - 1, Math.round(sy - size) - 1, Math.round(size) + 2, Math.round(size) + 2);
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(sx - size / 2), Math.round(sy - size), Math.round(size), Math.round(size));
      if (s.id === star && this.t % 30 < 20) font.drawCentered(ctx, '★', sx, sy - size - 10, PAL.gold, '#000');
    }

    // Player flying, seen from behind, with a ground shadow.
    const id = CHARACTERS[this.game.state.data.active].sprite;
    const set = spriteSet(this.game.state.hero.outfit ?? id);
    const bob = Math.round(Math.sin(this.t / 12) * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(SCREEN_W / 2, 140, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    const flyer = set.fly.up;
    ctx.drawImage(flyer, Math.round(SCREEN_W / 2 - flyer.width / 2), 130 - flyer.height + bob);
    if (this.t % 4 === 0) { ctx.fillStyle = '#fff8d0'; ctx.fillRect(SCREEN_W / 2 - 1 + ((this.t / 4) % 5) - 2, 132 + bob, 1, 3); }

    this.renderMinimap(ctx, star);
    const near = this.nearSpot();
    const label = near ? `${near.name}  -  A: land` : WORLDS[this.world].name;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, SCREEN_H - 14, SCREEN_W, 14);
    font.drawCentered(ctx, label, SCREEN_W / 2, SCREEN_H - 11, near ? PAL.gold : PAL.white, '#000');
    if (this.fadeIn > 0) {
      ctx.globalAlpha = this.fadeIn / 16;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.globalAlpha = 1;
    }
  }

  private renderMinimap(ctx: CanvasRenderingContext2D, star: string | null): void {
    const S = 52;
    const mx = SCREEN_W - S - 4;
    const my = 4;
    ctx.fillStyle = '#000';
    ctx.fillRect(mx - 1, my - 1, S + 2, S + 2);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.tex.bmp, 0, 0, TEX, TEX, mx, my, S, S);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#40e8f0';
    ctx.strokeRect(mx - 0.5, my - 0.5, S + 1, S + 1);
    const k = S / TEX;
    for (const s of this.spots()) {
      ctx.fillStyle = s.id === star && this.t % 20 < 10 ? PAL.gold : '#c050f0';
      ctx.fillRect(Math.round(mx + s.x * k) - 1, Math.round(my + s.y * k) - 1, 3, 3);
    }
    // Player arrow.
    const px = mx + this.px * k;
    const py = my + this.py * k;
    ctx.fillStyle = '#40f040';
    ctx.beginPath();
    ctx.moveTo(px + Math.sin(this.a) * 4, py - Math.cos(this.a) * 4);
    ctx.lineTo(px + Math.cos(this.a) * 2.5 - Math.sin(this.a) * 2, py + Math.sin(this.a) * 2.5 + Math.cos(this.a) * 2);
    ctx.lineTo(px - Math.cos(this.a) * 2.5 - Math.sin(this.a) * 2, py - Math.sin(this.a) * 2.5 + Math.cos(this.a) * 2);
    ctx.fill();
    void hexRgb;
  }
}
