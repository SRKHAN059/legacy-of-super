import { shade } from '../color';
import {
  frameAnchor, frameIndices, lookPalette, registerSheetCast, resolveAnims, sheetBlock,
  type SheetExtra, type SheetLook, type SheetOverlay,
} from '../sheets';

// =============================================================================================
// Gods, angels, Kais and the alien cast of the multiverse, drawn from the LoG2 sprite sheets.
//
// LoG2 has none of these characters, so every look is a LoG2 body (Android 18's slim frame,
// Mr. Satan's bulk, Krillin, Piccolo, Vegeta, Master Roshi, Chiaotzu ...) re-dressed through
// palette ramps, usually with the head swapped by an overlay: the top of Krillin's bald skull or
// Android 18's whole head, lifted pixel for pixel from the sheet data at module load and dyed to
// the character, finished with hand-drawn faces and patches in the same style (cat ears, Kai
// mohawks, angel rings, helmets, antennae). Colours follow the cast specs (src/content/cast.ts
// and the chapter registerCast calls).
// =============================================================================================

/** Facings an overlay is authored for: the engine mirrors `left` for the right facing. */
type Facing = 'down' | 'left' | 'up';
const FACINGS: readonly Facing[] = ['down', 'left', 'up'];

/** A darkest-to-lightest colour ramp for a palette part. */
type Ramp = readonly string[];
type XY = readonly [number, number];
type PerFacing<T> = Readonly<Partial<Record<Facing, T>>>;

/** Pixels keyed by "x,y", relative to a head anchor (x = head centre column, y = top of head). */
type Px = ReadonlyMap<string, string>;
/** Pixels per facing. */
type Kit = PerFacing<Px>;

const key = (x: number, y: number): string => `${x},${y}`;
const unkey = (k: string): [number, number] => {
  const i = k.indexOf(',');
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
};
const hex2 = (v: number): string => v.toString(16).padStart(2, '0');

/** `n` tones from shadow to highlight around `mid`, the spec colour, which sits about two thirds up the ramp. */
function ramp(mid: string, n = 4): string[] {
  const at = n >= 4 ? 0.62 : 0.5;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? at : i / (n - 1);
    const f = t < at ? 0.42 + 0.58 * (t / at) : 1 + 0.42 * ((t - at) / (1 - at));
    out.push(Math.abs(f - 1) < 1e-6 ? mid : shade(mid, f));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Kits: lifted and hand-drawn pixel layers
// ---------------------------------------------------------------------------------------------

/** Options for lifting pixels out of a block frame. */
interface Lift {
  /** Animation and frame index to lift from (default idle, frame 0). */
  anim?: string;
  frame?: number;
  facings?: readonly Facing[];
  /** Rows to keep, relative to the anchor (inclusive). */
  rows?: XY;
  /** Columns to keep, relative to the anchor (inclusive). */
  cols?: XY;
  /** Keep only the colours of these parts (plus `only`). */
  parts?: readonly string[];
  only?: readonly string[];
  /** Drop these sheet colours. */
  drop?: readonly string[];
  /** Re-dress the lifted pixels exactly as a look with these ramps / recolours would. */
  dress?: Pick<SheetLook, 'parts' | 'recolor'>;
}

/** Pixels of a block's frame relative to its head anchor, per facing, filtered and dyed. Empty if the block is not built. */
function lift(block: string, o: Lift = {}): Kit {
  const b = sheetBlock(block);
  const a = b ? resolveAnims(block)[o.anim ?? 'idle'] : undefined;
  if (!b || !a) return {};
  const pal = lookPalette({ block, ...(o.dress ?? {}) });
  const keep = new Set<string>([...(o.only ?? []), ...(o.parts ?? []).flatMap((p) => b.parts[p] ?? [])]);
  const drop = new Set(o.drop ?? []);
  const out: Partial<Record<Facing, Px>> = {};
  for (const f of o.facings ?? FACINGS) {
    const refs = a.dirs[f];
    const ref = refs[Math.min(refs.length - 1, o.frame ?? 0)];
    const grid = frameIndices(block, ref);
    const [ax, ay] = frameAnchor(block, ref);
    const px = new Map<string, string>();
    for (let y = 0; y < b.size; y++) {
      for (let x = 0; x < b.size; x++) {
        const v = grid[y * b.size + x];
        if (!v) continue;
        const dx = x - ax;
        const dy = y - ay;
        if (o.rows && (dy < o.rows[0] || dy > o.rows[1])) continue;
        if (o.cols && (dx < o.cols[0] || dx > o.cols[1])) continue;
        const c = b.palette[v - 1];
        if ((keep.size && !keep.has(c)) || drop.has(c)) continue;
        const rgb = pal[v];
        if (rgb) px.set(key(dx, dy), `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`);
      }
    }
    out[f] = px;
  }
  return out;
}

/** A hand-drawn layer: per facing, rows of characters with their top-left at `at` (anchor space). '.' and ' ' are transparent. */
function draw(rows: PerFacing<readonly string[]>, at: PerFacing<XY>, colors: Readonly<Record<string, string>>): Kit {
  const out: Partial<Record<Facing, Px>> = {};
  for (const f of FACINGS) {
    const g = rows[f];
    const p = at[f];
    if (!g || !p) continue;
    const px = new Map<string, string>();
    g.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        const ch = row[gx];
        if (ch === '.' || ch === ' ') continue;
        const c = colors[ch];
        if (!c) throw new Error(`Overlay grid uses "${ch}" without a colour`);
        px.set(key(p[0] + gx, p[1] + gy), c);
      }
    });
    out[f] = px;
  }
  return out;
}

/** Mirror the given facings' pixels about column 0 (draw one half of a symmetric front / back view). */
function sym(k: Kit, facings: readonly Facing[] = ['down', 'up']): Kit {
  const out: Partial<Record<Facing, Px>> = { ...k };
  for (const f of facings) {
    const px = k[f];
    if (!px) continue;
    const m = new Map(px);
    for (const [kk, c] of px) {
      const [x, y] = unkey(kk);
      if (!m.has(key(-x, y))) m.set(key(-x, y), c);
    }
    out[f] = m;
  }
  return out;
}

/** Stack kits (later ones drawn on top). */
function stack(...kits: readonly Kit[]): Kit {
  const out: Partial<Record<Facing, Map<string, string>>> = {};
  for (const k of kits) {
    for (const f of FACINGS) {
      const px = k[f];
      if (!px) continue;
      const m = out[f] ?? new Map<string, string>();
      for (const [kk, c] of px) m.set(kk, c);
      out[f] = m;
    }
  }
  return out;
}

/** The kit moved by (dx, dy) per facing. */
function moved(k: Kit, by: PerFacing<XY>): Kit {
  const out: Partial<Record<Facing, Px>> = {};
  for (const f of FACINGS) {
    const px = k[f];
    if (!px) continue;
    const [dx, dy] = by[f] ?? [0, 0];
    out[f] = new Map([...px].map(([kk, c]) => {
      const [x, y] = unkey(kk);
      return [key(x + dx, y + dy), c] as const;
    }));
  }
  return out;
}

/** Characters an overlay palette may use (never '.' or ' ', which are transparent). */
const PALETTE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+-=?@^~';

/** Flatten a kit (in the host's anchor space) into a SheetOverlay. */
function overlayOf(k: Kit, opts: Pick<SheetOverlay, 'erase' | 'eraseDepth' | 'skipAnims'>): SheetOverlay {
  const palette: Record<string, string> = {};
  const charOf = new Map<string, string>();
  const rows: Partial<Record<Facing, readonly string[]>> = {};
  const offset: Partial<Record<Facing, XY>> = {};
  for (const f of FACINGS) {
    const px = k[f];
    if (!px?.size) continue;
    const pts = [...px.keys()].map(unkey);
    const x0 = Math.min(...pts.map((p) => p[0]));
    const x1 = Math.max(...pts.map((p) => p[0]));
    const y0 = Math.min(...pts.map((p) => p[1]));
    const y1 = Math.max(...pts.map((p) => p[1]));
    const out: string[] = [];
    for (let y = y0; y <= y1; y++) {
      let s = '';
      for (let x = x0; x <= x1; x++) {
        const c = px.get(key(x, y))?.toLowerCase();
        if (!c) {
          s += '.';
          continue;
        }
        let ch = charOf.get(c);
        if (!ch) {
          ch = PALETTE_CHARS[charOf.size];
          if (!ch) throw new Error('Overlay uses more colours than palette characters');
          charOf.set(c, ch);
          palette[ch] = c;
        }
        s += ch;
      }
      out.push(s);
    }
    rows[f] = out;
    offset[f] = [x0, y0];
  }
  return { palette, rows, offset, ...opts };
}

// ---------------------------------------------------------------------------------------------
// Hosts: the LoG2 bodies these looks are built on
// ---------------------------------------------------------------------------------------------

/** How head kits (head space: Krillin's head anchor) land on a host block and what the host needs erased / left alone. */
interface Host {
  block: string;
  /** Head space → this host's anchor space, per facing. */
  at: PerFacing<XY>;
  /** Host colours erased under a new head (its own hair and face outline), and how far down from the anchor. */
  erase?: readonly string[];
  eraseDepth?: number;
  /** Animations whose frames turn or hide the head (lying, flying flat): drawn without the overlay. */
  skip: readonly string[];
}

const HOSTS = {
  /** Android 18 (slim): vest `outfit`, striped sleeves `outfit2`, black shirt and leggings `leggings`, `boots`, back bow `emblem`. */
  slim: {
    block: 'android18',
    at: { down: [-1, 2], left: [-1, 2], up: [-2, 2] },
    erase: ['#845218', '#e7a542', '#ffd642', '#ffff7b', '#ffffff'],
    eraseDepth: 15,
    skip: ['fly'],
  },
  /** Mr. Satan (bulky): gi top `outfit` (its two darker tones shared with `boots`), trousers `outfit2`, `skin`. */
  big: {
    block: 'hercule',
    at: { down: [0, 4], left: [0, 4], up: [0, 4] },
    erase: ['#000000'],
    eraseDepth: 16,
    skip: ['ko', 'koHold', 'fly', 'flyDownRight', 'flyUpLeft', 'flyUpRight'],
  },
  /** Vegeta (armoured): bodysuit `outfit`, armour, gloves and boots `outfit2` (boots also `boots`), shoulder straps `trim`. */
  armour: {
    block: 'vegeta',
    at: { down: [0, 4], left: [-3, 4], up: [0, 4] },
    erase: ['#000000', '#737373'],
    eraseDepth: 17,
    skip: ['ko', 'koFront', 'fly', 'flyUpLeft', 'swim'],
  },
  /** Piccolo without weights (tall): gi `outfit`, sash, boots, skin (and outline) `skin`, arm patches `skin2`. */
  tall: {
    block: 'piccoloNoWeights',
    at: { down: [-1, 1], left: [0, 1], up: [0, 1] },
    erase: ['#107b00', '#31ad00', '#52d600', '#000000', '#c6c6c6', '#ffffff'],
    eraseDepth: 13,
    skip: ['ko', 'fly', 'flyDownRight', 'flyDownLeft', 'flyUpLeft', 'flyUpRight'],
  },
  /** Krillin (short, bald): gi `outfit`, undershirt, belt, wristbands and boots `outfit2`/`boots`, back emblem `emblem`. */
  small: { block: 'krillin', at: {}, skip: ['ko', 'koHold', 'fly'] },
  /** Master Roshi (old, bearded; idle and walk only): shirt `outfit`, trousers `outfit2`, beard and brows `hair`, sunglasses `eyes`. */
  elder: { block: 'roshi', at: {}, skip: [] },
  /** Chiaotzu (tiny, big round head; idle and walk only): cap, tunic and trousers `hair`, robe `outfit`, sleeves `accent`. */
  tiny: { block: 'chiaotzu', at: { down: [-1, 1], left: [-1, 1], up: [-1, 1] }, skip: [] },
} as const satisfies Record<string, Host>;

type HostId = keyof typeof HOSTS;

/** A look on a host body: part ramps for the body, a head kit (head space) and patches in the host's own anchor space. */
interface Dress {
  parts: Readonly<Record<string, Ramp>>;
  recolor?: Readonly<Record<string, string>>;
  head?: Kit;
  /** Extra head-space offset for this look (e.g. a tall head sitting lower). */
  nudge?: PerFacing<XY>;
  anchored?: Kit;
  /** Keep the host's own head (no erase): the head kit only adds to it. */
  keepHead?: boolean;
  /** Host colours to erase near the anchor instead of the host's own list (e.g. a cap's pompom under a new head). */
  erase?: { readonly colors: readonly string[]; readonly depth: number };
  /** Animations drawn without the overlay besides the host's own list. */
  skip?: readonly string[];
  extra?: readonly SheetExtra[];
  scale?: number;
}

/** Build a look on a host body. */
function dressed(hostId: HostId, d: Dress): SheetLook {
  const host: Host = HOSTS[hostId];
  const at: Partial<Record<Facing, XY>> = {};
  for (const f of FACINGS) {
    const a = host.at[f] ?? [0, 0];
    const n = d.nudge?.[f] ?? [0, 0];
    at[f] = [a[0] + n[0], a[1] + n[1]];
  }
  const kit = stack(d.head ? moved(d.head, at) : {}, d.anchored ?? {});
  const erase = d.erase
    ? { erase: d.erase.colors, eraseDepth: d.erase.depth }
    : d.keepHead || !host.erase ? {} : { erase: host.erase, eraseDepth: host.eraseDepth };
  const skipAnims = [...host.skip, ...(d.skip ?? [])];
  return {
    block: host.block,
    parts: d.parts,
    ...(d.recolor ? { recolor: d.recolor } : {}),
    ...(FACINGS.some((f) => kit[f]?.size) ? { overlay: overlayOf(kit, { ...erase, skipAnims }) } : {}),
    ...(d.extra ? { extra: d.extra } : {}),
    ...(d.scale ? { scale: d.scale } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Heads (head space = Krillin's head anchor: x = centre column, y = top of the skull)
// ---------------------------------------------------------------------------------------------

/** Skin keys used by hand-drawn heads: o outline, n shadow, d dark, g mid, i light, k highlight. */
function skinKeys(skin: Ramp): Record<string, string> {
  const at = (t: number): string => skin[Math.round(t * (skin.length - 1))];
  return { o: at(0), n: at(1 / 6), d: at(2 / 6), g: at(3 / 6), i: at(5 / 6), k: at(1) };
}

/** Feature keys shared by every hand-drawn face: e pupil / eyeliner, w eye white, r mouth. */
const FACE_KEYS = { e: '#101014', w: '#f4f4f8', r: '#702838' };

/**
 * The top of Krillin's bald skull (rows 0-6 of his idle frames, above the brows and ears) dyed with a
 * skin ramp, his forehead dots smoothed over: the base every bald head here is finished from by hand.
 */
function skull(skin: Ramp): Kit {
  const k = lift('krillin', { rows: [0, 6], parts: ['skin'], dress: { parts: { skin } } });
  return stack(k, draw({ down: ['....k.k....', '...........', '..i.k.k.i..'] }, { down: [-5, 4] }, skinKeys(skin)));
}

/** Lower faces (head rows 7-12, 11 columns from x = -5): eyes, nose, mouth and jaw per facing. */
type Face = PerFacing<readonly string[]>;

const FACE_PLAIN: Face = {
  down: ['oieeikieeio', 'oiwekikewio', 'oiiikgkiiio', '.oiigrgiio.', '..odiiido..', '...ooooo...'],
  left: ['oeeiikkiigo', 'oweikkkiigo', 'ogiikkkiido', '.orikkiiddo', '..oiiiiddo.', '...ooooo...'],
  up: ['oiikkkkkigo', 'ogiikkkiigo', 'ogiiiiiiigo', '.oggiiiggo.', '..odggddo..', '...ooooo...'],
};
/** Heavy brows and a hard mouth. */
const FACE_STERN: Face = {
  down: ['oeeeikieeeo', 'oiwekikewio', 'oiiikgkiiio', '.oiirrriio.', '..odiiido..', '...ooooo...'],
  left: ['eeeiikkiigo', 'oweikkkiigo', 'ogiikkkiido', '.rrikkiiddo', '..oiiiiddo.', '...ooooo...'],
  up: FACE_PLAIN.up,
};
/** Big dark alien eyes with a glint. */
const FACE_BIG_EYES: Face = {
  down: ['oiikkikkiio', 'oeeekikeeeo', 'oewekikeweo', '.oeeigieeo.', '..odirido..', '...ooooo...'],
  left: ['oiikkkkiigo', 'eeekkkkiigo', 'ewekkkiiido', '.eeikkiiddo', '..oriiiddo.', '...ooooo...'],
  up: FACE_PLAIN.up,
};

/** A bald head: Krillin's skull top dyed `skin`, finished with a hand-drawn lower face. */
function head(skin: Ramp, face: Face = FACE_PLAIN, keys: Readonly<Record<string, string>> = {}): Kit {
  return stack(skull(skin), draw(face, { down: [-5, 7], left: [-5, 7], up: [-5, 7] }, { ...skinKeys(skin), ...FACE_KEYS, ...keys }));
}

// ---------------------------------------------------------------------------------------------
// Hand-drawn head patches (head space)
// ---------------------------------------------------------------------------------------------

/** A mohawk crest along the crown (white for the Kais): `x` outline, `h` shade, `W` light. */
const mohawk = (x: string, h: string, w: string): Kit =>
  draw(
    {
      down: ['.xxx.', 'xWWWx', 'xWWWx', 'xhWhx', 'xhWhx', '.xhx.'],
      left: ['..xxxxx..', '.xWWWWWx.', 'xWWWWWWhx', 'xhWWWWhhx', '.xhhhhx..'],
      up: ['.xxx.', 'xWWWx', 'xhWhx', 'xhWhx', 'xhWhx', 'xhWhx', '.xhx.'],
    },
    { down: [-2, -4], left: [-3, -4], up: [-2, -4] },
    { x, h, W: w },
  );

/** Small pointed Kai / Namekian ears at the sides of the head (`o` outline, `g` mid, `i` light). */
const pointedEars = (skin: Ramp): Kit =>
  stack(
    sym(draw({ down: ['o..', 'oo.', 'oio', '.og', '..o'], up: ['o..', 'oo.', 'ogo', '.og', '..o'] }, { down: [-8, 6], up: [-8, 6] }, skinKeys(skin)), ['down', 'up']),
    draw({ left: ['...o', '..oo', '.oio', 'ogio', '.oo.'] }, { left: [1, 6] }, skinKeys(skin)),
  );

/** A Potara earring hanging under each ear. */
const potara = (c: string): Kit =>
  stack(sym(draw({ down: ['c'], up: ['c'] }, { down: [-6, 11], up: [-6, 11] }, { c }), ['down', 'up']), draw({ left: ['c'] }, { left: [2, 11] }, { c }));

/** The angels' ring floating around the neck: `r` rim, `R` light. */
const angelRing = (r: string, R: string): Kit =>
  draw(
    {
      down: ['rR.........Rr', '.rRRRRRRRRRr.'],
      left: ['.rRR.....RRr.', 'rRRRRRRRRRRRr'],
      up: ['.rRRRRRRRRRr.', 'rR.........Rr'],
    },
    { down: [-6, 12], left: [-6, 12], up: [-6, 12] },
    { r, R },
  );

// =============================================================================================
// Shared colours
// =============================================================================================

const GOLD: Ramp = ['#7a5410', '#b8861c', '#e8b830', '#f8e070'];
const BLACK_CLOTH: Ramp = ['#0c0c12', '#181820', '#262630', '#363642'];
const WHITE_CLOTH: Ramp = ['#8a8a9c', '#b8b8c8', '#dcdce6', '#f8f8fc'];
const WHITE_HAIR = { x: '#6a7088', h: '#b8c0d0', W: '#f8f8fc' };
const WHITE8: Ramp = ['#5a5a6a', '#7a7a8c', '#9a9aac', '#b8b8c8', '#ccccd8', '#dcdce6', '#ececf2', '#fafafc'];

// =============================================================================================
// Gods of Destruction and angels
// =============================================================================================

const BEERUS_SKIN = ramp('#9070c0', 7);
const BEERUS_KEYS = { ...skinKeys(BEERUS_SKIN), ...FACE_KEYS, y: '#e8d840', p: '#b05888', P: '#e898b8' };

/** Beerus's sphinx-cat head: yellow eyes lined in black, tall pointed ears with pink insides. */
const catGodHead = (skin: Ramp, keys: Readonly<Record<string, string>>): Kit =>
  stack(
    skull(skin),
    draw(
      {
        down: ['oieekikeeio', 'oiyeikieyio', 'oiiikgkiiio', '.oiigrgiio.', '..odiiido..', '...ooooo...'],
        left: ['oeeiikkiigo', 'oyeikkkiigo', 'ogiikkkiido', '.orikkiiddo', '..oiiiiddo.', '...ooooo...'],
        up: FACE_PLAIN.up,
      },
      { down: [-5, 7], left: [-5, 7], up: [-5, 7] },
      keys,
    ),
    sym(draw(
      {
        down: ['o.....', 'oo....', 'opo...', 'oPpo..', 'oPPpo.', '.oPPpo', '..oPpo', '...oo.'],
        up: ['o.....', 'oo....', 'odo...', 'oddo..', 'odgdo.', '.oddgo', '..oddo', '...oo.'],
      },
      { down: [-7, -5], up: [-7, -5] },
      keys,
    )),
    draw({ left: ['.....o', '....oo', '...opo', '..oPpo', '.oPPpo', 'oPPpo.', 'oPpo..'] }, { left: [0, -5] }, keys),
  );

/** A God of Destruction's broad gold collar (usekh) over the shoulders. */
const USEKH: Kit = stack(
  sym(draw({ down: ['.yYYYY', '..yyyy'], up: ['.yyyyy', '..yyyy'] }, { down: [-5, 12], up: [-5, 12] }, { y: '#b88a20', Y: '#f0c840' })),
  draw({ left: ['yYYYYy'] }, { left: [-2, 12] }, { y: '#b88a20', Y: '#f0c840' }),
);

const CHAMPA_SKIN = ramp('#8078c0', 7);
const CHAMPA_KEYS = { ...skinKeys(CHAMPA_SKIN), ...FACE_KEYS, y: '#e8d840', p: '#a85888', P: '#e098b8' };

/** Angels: pale blue skin, the ring around the neck. */
const ANGEL_SKIN = ramp('#90b8e0', 7);
const ANGEL_RING = angelRing('#2870c0', '#78c8f8');

/** Whis's hair: a tall white column standing up from the crown. */
const WHIS_HAIR = draw(
  {
    down: ['..xxx..', '.xWWWx.', 'xhWWWhx', 'xhHWHhx', 'xhHWHhx', 'xhhHhhx', '.xhhhx.'],
    left: ['..xxx..', '.xWWWx.', 'xhWWWhx', 'xhHWHhx', 'xhHWHhx', 'xhhHhhx', '.xhhhx.'],
    up: ['..xxx..', '.xWWWx.', 'xhWWWhx', 'xhHWHhx', 'xhHHHhx', 'xhhhhhx', '.xhhhx.'],
  },
  { down: [-3, -4], left: [-2, -4], up: [-3, -4] },
  { ...WHITE_HAIR, H: '#dce0ec' },
);

/** The Grand Priest's hair: two white lobes swept up from the brow. */
const PRIEST_HAIR = draw(
  {
    down: ['.xxx.xxx.', 'xWWWxWWWx', 'xWHhWhHWx', 'xhHhhhHhx', '.xhhhhhx.'],
    left: ['..xxxx...', '.xWWWWxx.', 'xWWHhWWWx', 'xhHhhHhhx', '.xhhhhhx.'],
    up: ['.xxx.xxx.', 'xWWWxWWWx', 'xWHhWhHWx', 'xhHhhhHhx', '.xhhhhhx.'],
  },
  { down: [-4, -2], left: [-4, -2], up: [-4, -2] },
  { ...WHITE_HAIR, H: '#dce0ec' },
);

/** Vados's white topknot. */
const TOPKNOT = draw(
  { down: ['.xxx.', 'xWWWx', 'xhWhx', '.xhx.'], left: ['.xxx.', 'xWWWx', 'xhWhx', '.xhx.'], up: ['.xxx.', 'xWWWx', 'xhWhx', '.xhx.'] },
  { down: [-2, -3], left: [0, -3], up: [-2, -3] },
  WHITE_HAIR,
);

// =============================================================================================
// Kais
// =============================================================================================

/** A Supreme Kai's head: bald with a white mohawk, pointed ears and Potara earrings. */
const kaiHead = (skin: Ramp, face: Face = FACE_PLAIN, earring = '#48d070'): Kit =>
  stack(pointedEars(skin), head(skin, face), mohawk(WHITE_HAIR.x, WHITE_HAIR.h, WHITE_HAIR.W), potara(earring));

const SHIN_SKIN = ramp('#c8a0e8', 7);
const ROH_SKIN = ramp('#a8b4e0', 7);
const ZAMASU_SKIN = ramp('#78c868', 7);
const GOWASU_SKIN = ramp('#e0d0b0', 7);
const POTAGE_SKIN = ramp('#a8b8d8', 7);
const KING_SKIN = ramp('#d8a8e0', 7);

/** Eyes painted over Master Roshi's sunglasses (his own head, head space). */
const elderEyes = (skin: Ramp): Kit =>
  draw(
    { down: ['kkkkkkkkk', 'iewkikwei', 'iiiigiiii'], left: ['kkkkii', 'ewkkii', 'iikkig'] },
    { down: [-4, 8], left: [-5, 7] },
    { ...skinKeys(skin), ...FACE_KEYS },
  );

/** White hair swept back from a high forehead (Elder Kai, Gowasu). */
const ELDER_HAIR = draw(
  {
    down: ['..xxx..', '.xWWWx.', 'xWWhWWx', 'xh...hx'],
    left: ['...xxxx..', '..xWWWWx.', '.xWWWhhWx', '..xhh.xhx', '......xhx', '.......x.'],
    up: ['..xxx..', '.xWWWx.', 'xWWWWWx', 'xhWWWhx', 'xhWWWhx', 'xhhWhhx', '.xhhhx.', '..xhx..'],
  },
  { down: [-3, -2], left: [-2, -2], up: [-3, -2] },
  WHITE_HAIR,
);

/** A gold crown (Galactic King). */
const CROWN = draw(
  {
    down: ['y..y..y', 'yY.Y.Yy', 'yYYYYYy', 'yrYrYry'],
    left: ['y..y..', 'yY.Yy.', 'yYYYYy', 'yrYrYy'],
    up: ['y..y..y', 'yY.Y.Yy', 'yYYYYYy', 'yYYYYYy'],
  },
  { down: [-3, -3], left: [-2, -3], up: [-3, -3] },
  { y: '#a87818', Y: '#f0c840', r: '#d03040' },
);

// =============================================================================================
// Zeno and other small folk
// =============================================================================================

const ZENO_SKIN = ramp('#a8b4f0', 7);

/** Zeno's big round head over Chiaotzu's cap and face (Chiaotzu's anchor space): huge eyes, purple ear marks. */
const ZENO_HEAD = draw(
  {
    down: [
      '....ooooo....',
      '..ookkkkkoo..',
      '.oikkkkkkkio.',
      '.oikkkkkkkio.',
      'oikkkkkkkkkio',
      'oikeekkkeekio',
      'oPkewkkkewkPo',
      'oPkeekkkeekPo',
      'oiikkkrkkkiio',
      '.oiikkkkkiio.',
      '.ogiiiiiiigo.',
      '..oogggggoo..',
      '....ooooo....',
    ],
    left: [
      '...ooooo....',
      '..okkkkkoo..',
      '.okkkkkkkio.',
      'okkkkkkkkkio',
      'okkkkkkkkkio',
      'oeekkkkkkkio',
      'ewkkkkPPkiio',
      'eekkkkPPkiio',
      'orkkkkkkkiio',
      '.okkkkkkiio.',
      '.ogiiiiiigo.',
      '..oogggggo..',
      '....ooooo...',
    ],
    up: [
      '....ooooo....',
      '..ookkkkkoo..',
      '.oikkkkkkkio.',
      '.oikkkkkkkio.',
      'oikkkkkkkkkio',
      'oikkkkkkkkkio',
      'oPikkkkkkkiPo',
      'oPiikkkkkiiPo',
      'oiiikkkkkiiio',
      '.oiiiiiiiiio.',
      '.ogiiiiiiigo.',
      '..oogggggoo..',
      '....ooooo....',
    ],
  },
  { down: [-6, 1], left: [-6, 1], up: [-6, 1] },
  { ...skinKeys(ZENO_SKIN), ...FACE_KEYS, P: '#9050c0' },
);

/** A golden halo ring floating over a small head (Chiaotzu's anchor space). */
const HALO_TINY = draw(
  { down: ['.yyyyy.', 'y.....y', '.yyyyy.'], left: ['.yyyyy.', 'y.....y', '.yyyyy.'], up: ['.yyyyy.', 'y.....y', '.yyyyy.'] },
  { down: [-3, -3], left: [-2, -3], up: [-3, -3] },
  { y: '#f8e060' },
);

/** A pair of antennae rising from the crown (`a` stalk, `A` tip), `tall` rows high. */
function antennae(a: string, A: string, tall = 5): Kit {
  const down = ['A.........A', '.a.......a.', '..a.....a..', '..a.....a..', '...a...a...', '...a...a...'].slice(6 - tall);
  const left = ['....A', '...a.', '..a..', '..a..', '.a...', '.a...'].slice(6 - tall);
  return draw({ down, left, up: down }, { down: [-5, 1 - tall], left: [0, 1 - tall], up: [-5, 1 - tall] }, { a, A });
}

/** Round black sunglasses and drooping whiskers over Krillin's own face (King Kai). */
const KING_KAI_FACE = draw(
  {
    down: ['.eeee.eeee.', '.eEee.eEee.', '..ee...ee..', 'ee.......ee', 'e.........e'],
    left: ['eeee', 'eEee', '.ee.', '...e', '..ee', '.e..'],
  },
  { down: [-5, 7], left: [-6, 7] },
  { e: '#101014', E: '#485068' },
);

/** Krillin's forehead dots painted out (his own head, head space). */
const krillinBrow = (skin: Ramp): Kit => draw({ down: ['....k.k....', '...........', '..i.k.k.i..'] }, { down: [-5, 4] }, skinKeys(skin));

/** A lower face drawn over Krillin's own (head rows 7-12), keeping his skull and ears. */
const krillinFace = (skin: Ramp, face: Face, keys: Readonly<Record<string, string>> = {}): Kit =>
  stack(krillinBrow(skin), draw(face, { down: [-5, 7], left: [-5, 7], up: [-5, 7] }, { ...skinKeys(skin), ...FACE_KEYS, ...keys }));

// =============================================================================================
// Universe fighters: shared kits
// =============================================================================================

/** Pride Trooper uniform colours. */
const PRIDE_RED: Ramp = ['#6a1014', '#9c1c20', '#c02828', '#e05048'];
const PRIDE_BLACK: Ramp = ['#08080c', '#101016', '#18181f', '#202028', '#2a2a34', '#34343f', '#40404c'];

/** Pride Trooper uniform on the slim body: red vest, black sleeves and trousers, white boots. */
const PRIDE_SLIM = { outfit: PRIDE_RED, outfit2: PRIDE_BLACK, leggings: ['#16161c'], boots: WHITE_CLOTH.slice(1), emblem: ['#c8c8d8', '#f8f8fc'] };
/** Pride Trooper uniform on the bulky body: red top, black trousers and boots. */
const PRIDE_BIG = { outfit: PRIDE_RED.slice(0, 3), outfit2: [...PRIDE_BLACK, '#4c4c58'] };

/** A dome helmet over the skull (`h` shade, `H` light, `W` shine, `a` band). */
const helmet = (h: string, H: string, W: string, a: string): Kit =>
  draw(
    {
      down: ['...hhhhh...', '..hHHWHHh..', '.hHWHHHHHh.', 'hHHHHHHHHHh', 'hHHHHHHHHHh', 'haaaaaaaaah', 'h.........h'],
      left: ['...hhhhh...', '..hWHHHHh..', '.hWHHHHHHh.', 'hHHHHHHHHHh', 'aaaaHHHHHHh', '....aaaaaah', '.........hh'],
      up: ['...hhhhh...', '..hHHHHHh..', '.hHHHHHHHh.', 'hHHHHHHHHHh', 'hHHHHHHHHHh', 'haaaaaaaaah', 'hHHHHHHHHHh'],
    },
    { down: [-5, -1], left: [-5, -1], up: [-5, -1] },
    { h, H, W, a },
  );

/** Dyspo's long upright rabbit ears (`p` inner ear). */
const rabbitEars = (skin: Ramp, inner: string): Kit =>
  stack(
    sym(draw({ down: ['.o.', 'oio', 'opo', 'opo', 'opo', 'oio', '.o.'], up: ['.o.', 'oio', 'ogo', 'ogo', 'ogo', 'oio', '.o.'] }, { down: [-4, -6], up: [-4, -6] }, { ...skinKeys(skin), p: inner })),
    draw({ left: ['..o.', '.oio', '.opo', 'oipo', 'oio.', 'oio.', '.o..'] }, { left: [0, -6] }, { ...skinKeys(skin), p: inner }),
  );

/** Toppo's white crew cut and handlebar moustache. */
const TOPPO_HAIR = stack(
  draw(
    { down: ['.xxxxxxx.', 'xWWWWWWWx', 'xhhhhhhhx'], left: ['..xxxxxx.', '.xWWWWWWx', 'xhhhhhhWx', '......xhx'], up: ['.xxxxxxx.', 'xWWWWWWWx', 'xWWWWWWWx', 'xhhhhhhhx'] },
    { down: [-4, -1], left: [-3, -1], up: [-4, -1] },
    WHITE_HAIR,
  ),
  draw({ down: ['.xWWW.WWWx.', 'xWWhx.xhWWx', 'xh.......hx'], left: ['xWWWx', 'WWhx.', 'hx...'] }, { down: [-5, 9], left: [-7, 9] }, WHITE_HAIR),
);

/** Android 18's head (bob, face and eyes) lifted onto another body, dyed: a woman's head for the bulky body. */
const womanHead = (hair: Ramp, skin: Ramp, eyes: Ramp): Kit =>
  moved(
    lift('android18', { rows: [0, 14], parts: ['hair', 'skin', 'eyes'], only: ['#000000'], dress: { parts: { hair, skin, eyes } } }),
    { down: [1, -2], left: [1, -2], up: [2, -2] },
  );

/** Two thick twin tails hanging at the sides of the head (Ribrianne). */
const twinTails = (h: string, H: string): Kit =>
  stack(
    sym(draw({ down: ['.hh', 'hHh', 'hHh', 'hHh', 'hHh', '.hH', '.hh', '..h'], up: ['.hh', 'hHh', 'hHh', 'hHh', 'hHh', '.hH', '.hh', '..h'] }, { down: [-9, 2], up: [-9, 2] }, { h, H })),
    draw({ left: ['hh.', 'hHh', 'hHh', 'hHh', 'hHh', '.hH', '.hh', '..h'] }, { left: [4, 2] }, { h, H }),
  );

/** A bun on top of the head. */
const bun = (h: string, H: string): Kit =>
  draw({ down: ['.hhh.', 'hHHHh', 'hHHHh', '.hhh.'], left: ['.hhh.', 'hHHHh', 'hHHHh', '.hhh.'], up: ['.hhh.', 'hHHHh', 'hHHHh', '.hhh.'] }, { down: [-2, -3], left: [0, -3], up: [-2, -3] }, { h, H });

/** A ponytail falling behind the head. */
const ponytail = (h: string, H: string): Kit =>
  draw({ left: ['.hh.', 'hHHh', '.hHh', '.hHh', '..hh', '..h.'], up: ['.hhh.', '.hHh.', '.hHh.', '.hHh.', '..h..'] }, { left: [5, 3], up: [-2, 9] }, { h, H });

/** Pointed cat ears (Kakunsa). */
const catEars = (o: string, f: string, p: string): Kit =>
  stack(
    sym(draw({ down: ['o...', 'oo..', 'opo.', 'oppo', 'offo'], up: ['o...', 'oo..', 'ofo.', 'offo', 'offo'] }, { down: [-6, -5], up: [-6, -5] }, { o, f, p })),
    draw({ left: ['...o', '..oo', '.opo', 'oppo', 'offo'] }, { left: [1, -5] }, { o, f, p }),
  );

/** Botamo's round bear ears. */
const bearEars = (skin: Ramp, inner: string): Kit =>
  stack(
    sym(draw({ down: ['.oo.', 'oipo', 'oppo', '.oo.'], up: ['.oo.', 'oiio', 'oggo', '.oo.'] }, { down: [-6, -1], up: [-6, -1] }, { ...skinKeys(skin), p: inner })),
    draw({ left: ['.oo.', 'oipo', 'oppo', '.oo.'] }, { left: [1, -1] }, { ...skinKeys(skin), p: inner }),
  );

/** A bear's muzzle face (Botamo): `c` cream muzzle. */
const FACE_BEAR: Face = {
  down: ['oikkkkkkkio', 'oiekkikkeio', 'oikccccckio', '.oicceccio.', '..odcrcdo..', '...ooooo...'],
  left: ['oikkkkkiigo', 'oekkkkkiigo', 'ccckkkkiido', 'ceccikiiddo', '.ocrkiiddo.', '..ooooooo..'],
  up: FACE_PLAIN.up,
};

/** Auta Magetta's chimney head: a metal cylinder with a dark visor and glowing eyes (drawn whole, head space). */
const magettaHead = (metal: Ramp): Kit =>
  draw(
    {
      down: [
        '..ooooooo..',
        '.okkkkkkio.',
        '.okkkkkkio.',
        '.oiiiiiigo.',
        '.oeeeeeeeo.',
        '.oeaeeeaeo.',
        '.oeeeeeeeo.',
        '.okkkkkkio.',
        'okkkkkkkkio',
        'okiiiiiiigo',
        'oigggggggdo',
        '.ooooooooo.',
      ],
      left: [
        '..ooooooo..',
        '.okkkkkkio.',
        '.okkkkkkio.',
        '.oiiiiiigo.',
        '.oeeeeeeio.',
        '.oaeeeiigo.',
        '.oeeeeeigo.',
        '.okkkkkkio.',
        'okkkkkkkkio',
        'okiiiiiiigo',
        'oigggggggdo',
        '.ooooooooo.',
      ],
      up: [
        '..ooooooo..',
        '.okkkkkkio.',
        '.okkkkkkio.',
        '.oiiiiiigo.',
        '.oiiiiiigo.',
        '.oiiiiiigo.',
        '.oiiiiiigo.',
        '.okkkkkkio.',
        'okkkkkkkkio',
        'okiiiiiiigo',
        'oigggggggdo',
        '.ooooooooo.',
      ],
    },
    { down: [-5, -1], left: [-5, -1], up: [-5, -1] },
    { ...skinKeys(metal), e: '#181820', a: '#f08030' },
  );

/** Sidra's leafy green crown of hair. */
const LEAFY_HAIR = draw(
  {
    down: ['.h.h.h.h.', 'hHhHhHhHh', 'hHHHHHHHh', '.hhhhhhh.'],
    left: ['..h.h.h..', '.hHhHhHh.', 'hHHHHHHHh', '.hhhhhhHh', '.......hh'],
    up: ['.h.h.h.h.', 'hHhHhHhHh', 'hHHHHHHHh', 'hHHHHHHHh', '.hhhhhhh.'],
  },
  { down: [-4, -2], left: [-4, -2], up: [-4, -2] },
  { h: '#2a6a28', H: '#4a9a40' },
);

/** Hit's high coat collar and the darker spots on his crown. */
const hitDetails = (coat: Ramp, skin: Ramp): Kit =>
  stack(
    draw({ down: ['..d.....d..', '...........', '.d.......d.'], up: ['..d.....d..', '...........', '.d.......d.', '...........', '..d.....d..'], left: ['....d..d...', '...........', '........d..'] }, { down: [-5, 1], left: [-5, 1], up: [-5, 1] }, { d: skin[2] }),
    draw(
      { down: ['oc.......co', 'occ.....cco'], left: ['occco', 'occcco'], up: ['ocdddddddco', 'occccccccco'] },
      { down: [-5, 10], left: [0, 10], up: [-5, 10] },
      { o: coat[0], c: coat[2], d: coat[1] },
    ),
  );

const GOD_LOOKS: Record<string, SheetLook> = {
  // Beerus: lean purple cat god in a black top, gold collar and shoes, red sarouel trousers.
  beerus: dressed('slim', {
    parts: {
      outfit: BLACK_CLOTH,
      outfit2: BEERUS_SKIN,
      skin: BEERUS_SKIN,
      leggings: ['#a82c34'],
      boots: GOLD.slice(0, 3),
      emblem: GOLD.slice(1, 3),
      hair: BEERUS_SKIN,
    },
    head: stack(catGodHead(BEERUS_SKIN, BEERUS_KEYS), USEKH),
    nudge: { down: [0, 1], left: [0, 1], up: [0, 1] },
  }),

  // Champa: Beerus's portly twin on Mr. Satan's bulk, black top, blue trousers.
  champa: dressed('big', {
    parts: { outfit: BLACK_CLOTH.slice(0, 3), boots: BLACK_CLOTH.slice(0, 2), outfit2: ramp('#3858a8', 8), skin: CHAMPA_SKIN },
    head: stack(catGodHead(CHAMPA_SKIN, CHAMPA_KEYS), USEKH),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
  }),

  // Whis: maroon robe under a black cuirass, pale blue skin, tall white hair, the angel ring.
  whis: dressed('slim', {
    parts: {
      outfit: BLACK_CLOTH,
      outfit2: ramp('#a03050', 7),
      skin: ANGEL_SKIN,
      leggings: ['#6a1c34'],
      boots: WHITE_CLOTH.slice(1),
      emblem: ['#d87830', '#f8b860'],
      hair: WHITE_CLOTH,
    },
    head: stack(head(ANGEL_SKIN, FACE_PLAIN, { e: '#402060' }), WHIS_HAIR, ANGEL_RING),
  }),

  // The Grand Priest: navy robe with gold, pale blue skin, two-lobed white hair, the angel ring.
  grandPriest: dressed('slim', {
    parts: {
      outfit: ramp('#283060', 4),
      outfit2: ramp('#3a4478', 7),
      skin: ANGEL_SKIN,
      leggings: ['#1c2244'],
      boots: GOLD.slice(0, 3),
      emblem: GOLD.slice(1, 3),
      hair: WHITE_CLOTH,
    },
    head: stack(head(ANGEL_SKIN, FACE_PLAIN, { e: '#402060' }), PRIEST_HAIR, ANGEL_RING),
  }),
  // Vados: Android 18's own face and bob turned angel-white, blue skin, topknot, teal-blue robe, the ring.
  vados: dressed('slim', {
    parts: {
      hair: ['#7880a0', '#c0c8dc', '#e0e4f0', '#f4f6fa', '#ffffff'],
      skin: ANGEL_SKIN.slice(1),
      eyes: ['#402060', '#7050a0', '#e0e0f0', '#f8f8fc'],
      outfit: BLACK_CLOTH,
      outfit2: ramp('#284890', 7),
      leggings: ['#1a2a58'],
      boots: WHITE_CLOTH.slice(1),
      emblem: ['#d87830', '#f8b860'],
    },
    keepHead: true,
    head: stack(TOPKNOT, moved(ANGEL_RING, { down: [0, 1], left: [0, 1], up: [0, 1] })),
  }),

  // Mojito, Universe 9's angel: white bob, blue skin, green robe, the ring.
  c13_mojito: dressed('slim', {
    parts: {
      hair: ['#7880a0', '#c0c8dc', '#e0e4f0', '#f4f6fa', '#ffffff'],
      skin: ramp('#88b0d8', 6),
      eyes: ['#203040', '#406080', '#e0e0f0', '#f8f8fc'],
      outfit: BLACK_CLOTH,
      outfit2: ramp('#3a7a50', 7),
      leggings: ['#1c3a28'],
      boots: WHITE_CLOTH.slice(1),
      emblem: ['#d87830', '#f8b860'],
    },
    keepHead: true,
    head: moved(ANGEL_RING, { down: [0, 1], left: [0, 1], up: [0, 1] }),
  }),

  // Shin, the Supreme Kai: lavender skin, white mohawk, navy tunic over orange sleeves, white trousers.
  supremeKai: dressed('slim', {
    parts: {
      outfit: ramp('#283878', 4),
      outfit2: ramp('#d06818', 7),
      skin: SHIN_SKIN,
      leggings: ['#e8e8f0'],
      boots: ramp('#d06818', 3),
      emblem: ['#3890c8', '#78c8f0'],
      hair: SHIN_SKIN,
    },
    head: kaiHead(SHIN_SKIN),
    nudge: { down: [0, 1], left: [0, 1], up: [0, 1] },
  }),

  // Roh, Universe 9's Supreme Kai: blue-lilac skin, gold robe over navy, white trousers.
  c13_roh: dressed('slim', {
    parts: {
      outfit: ramp('#e0a830', 4),
      outfit2: ramp('#283878', 7),
      skin: ROH_SKIN,
      leggings: ['#e8e8f0'],
      boots: ramp('#283878', 3),
      emblem: GOLD.slice(1, 3),
      hair: ROH_SKIN,
    },
    head: kaiHead(ROH_SKIN, FACE_STERN),
    nudge: { down: [0, 1], left: [0, 1], up: [0, 1] },
  }),

  // Zamasu: green skin, white mohawk, one Potara, pale robe over dark green, gold shoes.
  zamasu: dressed('slim', {
    parts: {
      outfit: ['#a098b8', '#c8c0d8', '#e8e0f0', '#f8f4fc'],
      outfit2: ramp('#3a6a3c', 7),
      skin: ZAMASU_SKIN,
      leggings: ['#305830'],
      boots: GOLD.slice(0, 3),
      emblem: GOLD.slice(1, 3),
      hair: ZAMASU_SKIN,
    },
    head: kaiHead(ZAMASU_SKIN, FACE_STERN),
    nudge: { down: [0, 1], left: [0, 1], up: [0, 1] },
  }),

  // Elder Kai on Master Roshi: lavender skin, swept-back white hair and beard, red robe, navy trousers.
  oldKai: dressed('elder', {
    parts: { skin: SHIN_SKIN, outfit: ramp('#c03030', 3), outfit2: ramp('#283878', 4), boots: ['#d06818'], accent: SHIN_SKIN.slice(2, 4) },
    keepHead: true,
    head: stack(pointedEars(SHIN_SKIN), elderEyes(SHIN_SKIN), ELDER_HAIR, potara('#48d070')),
  }),

  // Gowasu, Universe 10's Supreme Kai: pale skin, white hair and beard, white robe, blue trousers.
  gowasu: dressed('elder', {
    parts: { skin: GOWASU_SKIN, outfit: ['#a098b8', '#d0c8e0', '#f0ecf8'], outfit2: ramp('#4868a8', 4), boots: ['#d0a030'], accent: GOWASU_SKIN.slice(2, 4) },
    keepHead: true,
    head: stack(pointedEars(GOWASU_SKIN), elderEyes(GOWASU_SKIN), ELDER_HAIR, potara('#48d070')),
  }),

  // Potage: an old bearded alien elder with pointed ears in a brown robe.
  c08_potage: dressed('elder', {
    parts: { skin: POTAGE_SKIN, outfit: ramp('#806850', 3), outfit2: ramp('#584838', 4), boots: ['#382818'], accent: POTAGE_SKIN.slice(2, 4) },
    keepHead: true,
    head: stack(pointedEars(POTAGE_SKIN), elderEyes(POTAGE_SKIN)),
  }),

  // The Galactic King: a big bearded king in a red robe and gold crown.
  c07_galacticKing: dressed('elder', {
    parts: { skin: KING_SKIN, outfit: ramp('#c03030', 3), outfit2: ramp('#283060', 4), boots: ['#e0c040'], accent: KING_SKIN.slice(2, 4) },
    keepHead: true,
    head: stack(elderEyes(KING_SKIN), CROWN),
    scale: 1.25,
  }),

  // Zeno: tiny, with a huge round pale-blue head, in a magenta and gold robe.
  zeno: dressed('tiny', {
    parts: {
      skin: ZENO_SKIN,
      hair: ['#3a1830', '#901c50', '#b83068', '#e05088', '#f070a8', '#f898c0'],
      outfit: ramp('#e8c848', 3),
      outfit2: ['#e8e8f0'],
      accent: ['#b83068', '#e05088'],
    },
    anchored: ZENO_HEAD,
    erase: { colors: ['#7b0000', '#ad0810', '#d61029', '#ff1839', '#ff4a4a'], depth: 3 },
  }),

  // A Hell choir fairy: tiny, golden-haired, white-robed, with a halo.
  c04_angel: dressed('tiny', {
    parts: {
      skin: ['#c08868', '#d8a080', '#e8b898', '#f8d8b8', '#f8d8b8', '#fff0e0', '#ffffff'],
      hair: ['#a87818', '#f0f0f8', '#f8f8fc', '#f8f8fc', '#ffffff', '#ffffff'],
      outfit: WHITE_CLOTH.slice(1),
      outfit2: ['#e8d8a0'],
      accent: ['#e0c860', '#f8e8a0'],
    },
    recolor: { '#000000': '#d8a830' },
    keepHead: true,
    anchored: HALO_TINY,
  }),

  // King Kai on Krillin: blue skin, antennae, sunglasses and whiskers, dark robe with yellow trim.
  kingKai: dressed('small', {
    parts: { skin: ramp('#3870c8', 7), outfit: ['#101014', '#1c1c24', '#2a2a34', '#3a3a46'], outfit2: ramp('#f0d040', 3), boots: ramp('#f0d040', 3), emblem: ['#806010', '#b89020', '#e0c040', '#f8e080'] },
    keepHead: true,
    head: stack(krillinBrow(ramp('#3870c8', 7)), KING_KAI_FACE, antennae('#101014', '#303040')),
  }),
};

// =============================================================================================
// Fighters of the other universes
// =============================================================================================

const HIT_SKIN = ramp('#9070b8', 7);
const HIT_COAT = ramp('#383050', 4);
const JIREN_SKIN = ramp('#b0a8a8', 7);
const TOPPO_SKIN = ramp('#e0b090', 7);
const TUPPER_SKIN = ramp('#d07858', 7);
const DYSPO_SKIN = ramp('#a088c8', 7);
const TROOPER_SKIN = ramp('#d0b0a0', 7);
const ZOIRAY_SKIN = ramp('#90c0a0', 7);
const KETTLE_SKIN = ramp('#e0c080', 7);
const JACO_SKIN = ramp('#9080c8', 7);
const PATROL_SKIN = ramp('#80c0a0', 7);
const MONAKA_SKIN = ramp('#5870c8', 7);
const BOTAMO_FUR = ramp('#e8c050', 7);
const MAGETTA_METAL = ramp('#6c7078', 7);
const SIDRA_SKIN = ramp('#c8884a', 7);
const ATTENDANT_SKIN = ramp('#90c0b0', 7);
const HUMAN_SKIN = ramp('#f8c890', 6);
const U2_EYES: Ramp = ['#203868', '#3870c8', '#d8d8e8', '#f0f0f8'];

/** The angels' and fused Zamasu's shared white hair ramp for Android 18's bob (5 tones). */
const WHITE_BOB: Ramp = ['#7880a0', '#c0c8dc', '#e0e4f0', '#f4f6fa', '#ffffff'];
/** Fused Zamasu's red eyes on Android 18's face. */
const ZAMASU_EYES: Ramp = ['#801020', '#e04060', '#e8e0e8', '#ffffff'];

const FIGHTER_LOOKS: Record<string, SheetLook> = {
  // ---------------------------------------------------------------- Zamasu, fused
  fusedZamasu: dressed('slim', {
    parts: { hair: WHITE_BOB, skin: ZAMASU_SKIN.slice(1), eyes: ZAMASU_EYES, outfit: ['#8a8098', '#b0a8c0', '#d0c8e0', '#ece8f4'], outfit2: ramp('#3a6a3c', 7), leggings: ['#305830'], boots: GOLD.slice(0, 3), emblem: GOLD.slice(1, 3) },
    keepHead: true,
    head: potara('#48d070'),
  }),
  c11_fusedHalf: dressed('slim', {
    parts: { hair: WHITE_BOB, skin: ramp('#9068b0', 6), eyes: ZAMASU_EYES, outfit: ['#8a8098', '#b0a8c0', '#d0c8e0', '#ece8f4'], outfit2: ramp('#3a6a3c', 7), leggings: ['#305830'], boots: GOLD.slice(0, 3), emblem: GOLD.slice(1, 3) },
    keepHead: true,
    head: potara('#48d070'),
  }),

  // ---------------------------------------------------------------- Universe 6
  // Hit: Piccolo's tall frame in a long dark coat, purple bald head, red eyes.
  hit: dressed('tall', {
    parts: { skin: HIT_COAT.slice(0, 3), skin2: HIT_COAT, outfit: HIT_COAT.slice(0, 3), sash: ['#8a8098', '#b0a8c0', '#c8c0d8'], boots: ['#101014', '#202028'] },
    head: stack(head(HIT_SKIN, FACE_STERN, { w: '#e03040' }), hitDetails(HIT_COAT, HIT_SKIN)),
  }),
  // Saonel and Pirina: Namekians in their own gi colours.
  c14_saonel: { block: 'piccoloNoWeights', parts: { outfit: ramp('#283868', 3), sash: ramp('#c03030', 3) } },
  c14_pirina: { block: 'piccolo', parts: { outfit: ramp('#704028', 3), sash: ramp('#d03030', 3) } },
  // Botamo: a big yellow bear in blue trunks.
  botamo: dressed('big', {
    parts: { outfit: BOTAMO_FUR.slice(1, 4), boots: BOTAMO_FUR.slice(1, 3), outfit2: ramp('#5070c0', 8), skin: BOTAMO_FUR },
    head: stack(bearEars(BOTAMO_FUR, '#c89838'), head(BOTAMO_FUR, FACE_BEAR, { c: '#f0e0b0' })),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
    scale: 1.15,
  }),
  // Auta Magetta: a huge grey metal man with a chimney head.
  c07_magetta: dressed('big', {
    parts: { outfit: MAGETTA_METAL.slice(1, 4), boots: MAGETTA_METAL.slice(1, 3), outfit2: ramp('#4c5058', 8), skin: MAGETTA_METAL },
    head: magettaHead(MAGETTA_METAL),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
    scale: 1.25,
  }),

  // ---------------------------------------------------------------- Universe 11: the Pride Troopers
  jiren: dressed('big', {
    parts: { ...PRIDE_BIG, skin: JIREN_SKIN },
    head: head(JIREN_SKIN, FACE_BIG_EYES),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
  }),
  toppo: dressed('big', {
    parts: { ...PRIDE_BIG, skin: TOPPO_SKIN },
    head: stack(head(TOPPO_SKIN, FACE_STERN), TOPPO_HAIR),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
  }),
  c14_tupper: dressed('big', {
    parts: { ...PRIDE_BIG, skin: TUPPER_SKIN },
    head: stack(head(TUPPER_SKIN, FACE_STERN), mohawk('#806010', '#c09020', '#f0d040')),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
    scale: 1.15,
  }),
  dyspo: dressed('slim', {
    parts: { ...PRIDE_SLIM, skin: DYSPO_SKIN.slice(1), hair: DYSPO_SKIN.slice(2) },
    head: stack(rabbitEars(DYSPO_SKIN, '#f0d0f0'), head(DYSPO_SKIN, FACE_STERN)),
  }),
  prideTrooper: dressed('slim', {
    parts: { ...PRIDE_SLIM, skin: TROOPER_SKIN.slice(1), hair: PRIDE_RED.slice(0, 3) },
    head: stack(head(TROOPER_SKIN, FACE_STERN), helmet('#801418', '#c02828', '#f06058', '#18181e')),
  }),
  c14_kahseral: dressed('slim', {
    parts: { ...PRIDE_SLIM, skin: ramp('#7088c8', 6), hair: WHITE_BOB, eyes: ['#302040', '#604080', '#e0e0f0', '#f8f8fc'] },
    keepHead: true,
  }),
  c14_zoiray: dressed('slim', {
    parts: { ...PRIDE_SLIM, skin: ZOIRAY_SKIN.slice(1), hair: ZOIRAY_SKIN.slice(2) },
    head: stack(head(ZOIRAY_SKIN, FACE_PLAIN), antennae('#2a5a40', '#4a8060', 4)),
  }),
  c14_cocotte: dressed('slim', {
    parts: { ...PRIDE_SLIM, skin: ramp('#ece4f0', 6), hair: ['#141428', '#20203a', '#2c2c48', '#3c3c5c', '#545478'], eyes: ['#302040', '#604080', '#e0e0f0', '#f8f8fc'] },
    keepHead: true,
  }),
  c14_knsi: {
    block: 'vegeta',
    parts: { skin: ramp('#c0a0e0', 5), hair: ['#402060', '#603888'], outfit: PRIDE_BLACK.slice(1, 4), outfit2: [...PRIDE_RED, '#e86060', '#f08080', '#f8a8a8', '#fcd0d0'], trim: WHITE_CLOTH.slice(1) },
  },
  c14_kettle: dressed('small', {
    parts: { skin: KETTLE_SKIN, outfit: PRIDE_RED, outfit2: PRIDE_BLACK.slice(1, 4), boots: WHITE_CLOTH.slice(1), emblem: WHITE_CLOTH },
    keepHead: true,
    head: stack(krillinFace(KETTLE_SKIN, FACE_STERN), helmet('#801418', '#c02828', '#f06058', '#18181e')),
  }),

  // ---------------------------------------------------------------- Universe 2
  ribrianne: dressed('slim', {
    parts: { hair: ramp('#f080b0', 5), skin: HUMAN_SKIN, eyes: U2_EYES, outfit: ramp('#f8a0c8', 4), outfit2: ramp('#f8c8dc', 7), leggings: ['#f8a0c8'], boots: WHITE_CLOTH.slice(1), emblem: ['#e0d070', '#f8f0a0'] },
    keepHead: true,
    head: twinTails('#c05088', '#f080b0'),
  }),
  c14_rozie: dressed('slim', {
    parts: { skin: HUMAN_SKIN, eyes: U2_EYES, outfit: WHITE_CLOTH, outfit2: ramp('#f0f0f8', 7), leggings: ['#f0f0f8'], boots: ramp('#80c0f0', 3), emblem: ['#d05090', '#f878b8'] },
    keepHead: true,
  }),
  c14_sanka: dressed('slim', {
    parts: { hair: ramp('#806048', 5), skin: ramp('#e0b0a0', 6), outfit: ramp('#a8c8e8', 4), outfit2: ramp('#a8c8e8', 7), leggings: ['#506088'], boots: WHITE_CLOTH.slice(1) },
    keepHead: true,
  }),
  c14_suroas: dressed('slim', {
    parts: { hair: ramp('#403028', 5), skin: ramp('#b08058', 6), outfit: ramp('#c8b090', 4), outfit2: ramp('#b08058', 7), leggings: ['#806848'], boots: ramp('#503828', 3) },
    keepHead: true,
    head: ponytail('#281c18', '#504038'),
  }),
  c14_kakunsa: dressed('slim', {
    parts: { hair: ramp('#f0b060', 5), skin: ramp('#f0d0a0', 6), outfit: ramp('#f0a050', 4), outfit2: ramp('#f0b060', 7), leggings: ['#e09040'], boots: ramp('#f8f0d0', 3) },
    keepHead: true,
    head: catEars('#704010', '#e09848', '#f8e0c0'),
  }),
  c14_brianne: dressed('big', {
    parts: { outfit: ramp('#f0e8f8', 3), boots: ramp('#f080b0', 2), outfit2: ramp('#f0e8f8', 8), skin: HUMAN_SKIN, hair: ramp('#f0a0c0', 5), eyes: U2_EYES, leggings: ['#e8d8f0'] },
    head: stack(womanHead(ramp('#f0a0c0', 5), HUMAN_SKIN, U2_EYES), bun('#c07090', '#f0a0c0')),
    extra: [{ block: 'android18', anims: ['ko', 'fly'] }],
  }),
  c14_superRibrianne: dressed('big', {
    parts: { outfit: ramp('#f8a0c8', 3), boots: ramp('#f8a0c8', 2), outfit2: ramp('#f8c8dc', 8), skin: HUMAN_SKIN, hair: ramp('#f878b8', 5), eyes: U2_EYES, leggings: ['#f8b8d4'] },
    head: stack(womanHead(ramp('#f878b8', 5), HUMAN_SKIN, U2_EYES), twinTails('#c05088', '#f878b8')),
    extra: [{ block: 'android18', anims: ['ko', 'fly'] }],
    scale: 1.15,
  }),
  c14_harmira: dressed('big', {
    parts: { outfit: ramp('#f0e8f8', 3), boots: ramp('#f0e8f8', 2), outfit2: ramp('#f878b8', 8), skin: ramp('#ecdcc4', 7) },
    head: head(ramp('#ecdcc4', 7), FACE_STERN),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
  }),
  c14_prum: dressed('small', {
    parts: { skin: ramp('#c8b0e0', 7), outfit: ramp('#f0e8f8', 4), outfit2: ramp('#f878b8', 3), boots: ramp('#f878b8', 3), emblem: WHITE_CLOTH },
    keepHead: true,
    head: stack(krillinFace(ramp('#c8b0e0', 7), FACE_STERN), helmet('#a04878', '#f878b8', '#fcc0e0', '#f8f0a0')),
  }),

  // ---------------------------------------------------------------- Universe 10
  c14_obni: {
    block: 'vegeta',
    parts: { skin: ramp('#9aa0b4', 5), hair: ['#a0a0b8', '#e8e8f4'], outfit: ramp('#281c28', 3), outfit2: ramp('#382838', 8), trim: GOLD.slice(0, 3) },
  },
};

const NPC_LOOKS: Record<string, SheetLook> = {
  // Jaco: short Galactic Patrolman, purple skin and big dark eyes, white armour over a black suit.
  jaco: dressed('armour', {
    parts: { skin: JACO_SKIN.slice(2), outfit: ramp('#202028', 3), outfit2: WHITE8, trim: ['#a01818', '#d03030', '#f06060'] },
    head: stack(head(JACO_SKIN, FACE_BIG_EYES), antennae('#a090d8', '#d8d0f8', 2)),
    extra: [{ block: 'krillin', anims: ['ko', 'fly'] }],
  }),
  c08_patrolman: dressed('armour', {
    parts: { skin: PATROL_SKIN.slice(2), outfit: ramp('#303030', 3), outfit2: WHITE8, trim: ramp('#3070e0', 3) },
    head: stack(head(PATROL_SKIN, FACE_PLAIN), helmet('#9898a8', '#e8e8f0', '#ffffff', '#3070e0')),
    extra: [{ block: 'krillin', anims: ['ko', 'fly'] }],
  }),
  // Monaka: tiny blue alien with big eyes in a white suit and red boots.
  monaka: dressed('small', {
    parts: { skin: MONAKA_SKIN, outfit: WHITE_CLOTH, outfit2: ramp('#d03030', 3), boots: ramp('#d03030', 3), emblem: WHITE_CLOTH },
    keepHead: true,
    head: krillinFace(MONAKA_SKIN, FACE_BIG_EYES),
  }),
  // Beerus inside the big Monaka costume.
  c08_monakaCostume: dressed('big', {
    parts: { outfit: WHITE_CLOTH.slice(1), boots: ramp('#d03030', 2), outfit2: WHITE8, skin: MONAKA_SKIN },
    head: head(MONAKA_SKIN, FACE_BIG_EYES),
    extra: [{ block: 'krillin', anims: ['ko', 'koHold', 'fly'] }],
  }),
  // Sidra, Universe 9's God of Destruction: small, brown, leafy-haired, in black and gold.
  c13_sidra: dressed('small', {
    parts: { skin: SIDRA_SKIN, outfit: BLACK_CLOTH, outfit2: GOLD.slice(0, 3), boots: GOLD.slice(0, 3), emblem: GOLD },
    keepHead: true,
    head: stack(krillinFace(SIDRA_SKIN, FACE_STERN, { w: '#e8e040' }), LEAFY_HAIR, USEKH),
  }),
  // The tournament attendant: teal, bald, pointed ears, navy robe.
  c07_attendant: dressed('slim', {
    parts: { outfit: ramp('#384878', 4), outfit2: ramp('#384878', 7), skin: ATTENDANT_SKIN.slice(1), leggings: ['#283458'], boots: ramp('#202030', 3), emblem: GOLD.slice(1, 3), hair: ATTENDANT_SKIN.slice(2) },
    head: stack(pointedEars(ATTENDANT_SKIN), head(ATTENDANT_SKIN, FACE_PLAIN)),
  }),
  // The tournament announcer: the microphone man in a red suit, pink skin and yellow hair.
  c07_announcer: { block: 'npcSuitMan', parts: { outfit: ['#a02030', '#d03040'], skin: ramp('#e0a8c8', 5), hair: ['#e0b830'] } },
  // The snack vendor: a green, antennaed townsman in a white vest and brown trousers.
  c07_vendor: {
    block: 'npcTough',
    parts: { skin: ramp('#b0d080', 6), hair: ramp('#80a060', 3), outfit: WHITE8.slice(2), outfit2: ramp('#604030', 3) },
    overlay: overlayOf(antennae('#4a6a30', '#80a060', 3), {}),
  },
};

/** Gods, angels and Kais no other cast module draws: registered outright. */
const OWN_IDS: readonly string[] = [
  'beerus', 'champa', 'whis', 'vados', 'grandPriest', 'c13_mojito', 'supremeKai', 'c13_roh', 'oldKai', 'gowasu', 'zeno', 'c13_sidra',
];

const ALL_LOOKS: Readonly<Record<string, SheetLook>> = { ...GOD_LOOKS, ...FIGHTER_LOOKS, ...NPC_LOOKS };

registerSheetCast(Object.fromEntries(OWN_IDS.map((id) => [id, ALL_LOOKS[id]])));
// Fighters, villains and alien NPCs another cast module may also dress (Zamasu, the tournament
// fighters, King Kai ...) are registered as defaults: a plain registration elsewhere replaces
// them instead of throwing, whatever the module load order.
registerSheetCast(Object.fromEntries(Object.entries(ALL_LOOKS).filter(([id]) => !OWN_IDS.includes(id))), { defaults: true });
