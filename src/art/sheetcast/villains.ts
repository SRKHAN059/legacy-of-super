import type { Dir } from '../../engine/math';
import { mix, shade } from '../color';
import { lookPalette, registerSheetCast, sheetBlock, type SheetExtra, type SheetLook, type SheetOverlay } from '../sheets';

// =============================================================================================
// Villains, soldiers, rival fighters and filler enemies drawn from the LoG2 sprite sheets.
//
// LoG2 has its own block for only a handful of these (Frieza, two Frieza Force soldiers), so
// most looks are a LoG2 fighter body re-dressed through palette ramps, with the head replaced
// by an overlay: a head lifted from another LoG2 block (Krillin's or Tien's bald head, Future
// Trunks's long hair, a townsman's short hair, the soldiers' crested and domed helmets) dyed to
// the character's colours, or hand-drawn in the same style (the wolf head, horns, mohawks,
// plumes, scouters, ears, Cell's crest). Enemies always get a fighter body, so every attack,
// hurt and knock-out Pose animates. Colours follow the cast specs in src/content/cast.ts, which
// the dialogue portraits use.
// =============================================================================================

/** Facings a head patch is authored for: the engine mirrors the left grid for the right facing. */
type Facing = 'down' | 'left' | 'up';
const FACINGS: readonly Facing[] = ['down', 'left', 'up'];

/** A darkest-to-lightest colour ramp for a palette part. */
type Ramp = readonly string[];

/** Per-facing (dx, dy). */
type Offsets = Readonly<Partial<Record<Facing, readonly [number, number]>>>;

/**
 * A pixel patch per facing. Head patches are authored in "head space": the top of a bald head
 * is row 0, the chin is row 12 and, in profile, the face front is about x = -5 (Krillin's head).
 * Hosts move them onto their own head anchor (see HOSTS).
 */
interface Patch {
  readonly rows: Readonly<Partial<Record<Facing, readonly string[]>>>;
  /** Top-left of each facing's grid. */
  readonly at: Offsets;
  /** Grid character → '#rrggbb'; '.' and ' ' are transparent. */
  readonly colors: Readonly<Record<string, string>>;
}

/** Characters an overlay palette may use (never '.' or ' ', which are transparent). */
const PALETTE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+-=?@^~';

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

/** '#rrggbb' of an [r, g, b] triple. */
function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Recolour a patch lifted from `block` exactly as a look with these part ramps / exact recolours
 * recolours that block, so a borrowed head takes the new body's skin and hair.
 */
function dye(patch: Patch, block: string, dress: Pick<SheetLook, 'parts' | 'recolor'>): Patch {
  const b = sheetBlock(block);
  const recolor = Object.fromEntries(Object.entries(dress.recolor ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const pal = b ? lookPalette({ block, ...dress }) : null;
  const colors: Record<string, string> = {};
  for (const [ch, c] of Object.entries(patch.colors)) {
    const from = c.toLowerCase();
    const i = b ? b.palette.indexOf(from) : -1;
    const rgb = pal && i >= 0 ? pal[i + 1] : null;
    colors[ch] = rgb ? toHex(rgb) : recolor[from] ?? c;
  }
  return { ...patch, colors };
}

/** The same patch moved by (dx, dy) on the given facings. */
function moved(patch: Patch, by: Offsets): Patch {
  const at: Partial<Record<Facing, readonly [number, number]>> = {};
  for (const f of FACINGS) {
    const p = patch.at[f];
    if (!p) continue;
    const d = by[f] ?? [0, 0];
    at[f] = [p[0] + d[0], p[1] + d[1]];
  }
  return { ...patch, at };
}

/** The same patch with some grid characters given new colours. */
function tinted(patch: Patch, colors: Readonly<Record<string, string>>): Patch {
  return { ...patch, colors: { ...patch.colors, ...colors } };
}

/** Exact-colour recolour of `from` (a darkest → lightest run of sheet colours) onto `to`, by relative position. */
function rampMap(from: readonly string[], to: Ramp): Record<string, string> {
  const out: Record<string, string> = {};
  from.forEach((c, i) => {
    out[c] = to[from.length === 1 ? to.length - 1 : Math.round((i * (to.length - 1)) / (from.length - 1))];
  });
  return out;
}

/**
 * Flatten patches (later ones drawn on top) into one SheetOverlay: one grid per facing over the
 * union of the patches' extents, with a palette character per distinct colour.
 */
function overlayOf(patches: readonly Patch[], opts: Pick<SheetOverlay, 'erase' | 'eraseDepth' | 'skipAnims'> = {}): SheetOverlay {
  const palette: Record<string, string> = {};
  const charOf = new Map<string, string>();
  const rows: Partial<Record<Dir, readonly string[]>> = {};
  const offset: Partial<Record<Dir, readonly [number, number]>> = {};
  for (const f of FACINGS) {
    const layers = patches.filter((p) => p.rows[f]?.length && p.at[f]);
    if (!layers.length) continue;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of layers) {
      const [px, py] = p.at[f] as readonly [number, number];
      const grid = p.rows[f] as readonly string[];
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px + Math.max(...grid.map((r) => r.length)) - 1);
      y1 = Math.max(y1, py + grid.length - 1);
    }
    const w = x1 - x0 + 1;
    const cells: (string | null)[] = new Array(w * (y1 - y0 + 1)).fill(null);
    for (const p of layers) {
      const [px, py] = p.at[f] as readonly [number, number];
      (p.rows[f] as readonly string[]).forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          const ch = row[gx];
          if (ch === '.' || ch === ' ') continue;
          const col = p.colors[ch];
          if (!col) throw new Error(`Overlay patch uses "${ch}" without a colour`);
          cells[(py + gy - y0) * w + (px + gx - x0)] = col.toLowerCase();
        }
      });
    }
    const out: string[] = [];
    for (let y = 0; y <= y1 - y0; y++) {
      let s = '';
      for (let x = 0; x < w; x++) {
        const col = cells[y * w + x];
        if (!col) {
          s += '.';
          continue;
        }
        let ch = charOf.get(col);
        if (!ch) {
          ch = PALETTE_CHARS[charOf.size];
          if (!ch) throw new Error('Overlay uses more colours than palette characters');
          charOf.set(col, ch);
          palette[ch] = col;
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

// =============================================================================================
// Borrowed LoG2 heads, in head space (colours are the donor block's own; `dye` re-dresses them)
// =============================================================================================

/** Krillin's bald head (Cell saga), from his idle frames. Parts: skin, eyes. */
const KRILLIN_HEAD: Patch = {
  rows: {
    down: [
      '.....aaaaa.....',
      '....abccbba....',
      '...acddddcba...',
      '..abcdddddba...',
      '..acddddddcba..',
      '..acddddddcea..',
      '..acddddddcea..',
      '.aaaffcdcffaaa.',
      'acdcbffaffbacba',
      'adbaddgdgdcabca',
      '.acacdfdfdbaca.',
      '....acdddba....',
      '.....aaaaa.....',
    ],
    left: [
      '......aaaaa....',
      '.....abccbba...',
      '....accdddcba..',
      '...abcddddcba..',
      '...accddddccba.',
      '...abdddddccba.',
      '...acccddccbba.',
      '...abcffcaabba.',
      '...acfffacbaba.',
      '...aagdddbcaba.',
      '...acfddacaba..',
      '....acdba.aa...',
      '.....aaa.......',
    ],
    up: [
      '.....aaaaa.....',
      '....abccbba....',
      '...acddddcba...',
      '..abcdddddba...',
      '..acddddddcba..',
      '..acddddddcba..',
      '..acdddddccba..',
      '.aaccdddccbbaa.',
      'acaaccccccbaaba',
      'adbabcccbbbabba',
      '.acaabbbbbaaba.',
      '...aaaaaaaaa...',
    ],
  },
  at: { down: [-7, 0], left: [-8, 0], up: [-7, 0] },
  colors: { a: '#845218', b: '#ce8463', c: '#e79c84', d: '#ffbdad', e: '#ad7b39', f: '#000000', g: '#5a5a5a' },
};

/** Tien's big bald head with the third eye painted out, from his idle frames. Parts: skin, eyes. */
const TIEN_HEAD: Patch = {
  rows: {
    down: [
      '......aaaaa......',
      '.....abccbda.....',
      '....aceeeecda....',
      '...abceeeeebda...',
      '...aceeeeeecda...',
      '...aceeeeeecda...',
      '...acdceeecdda...',
      '...aahhcechhaa...',
      '..aacdhhahhddaa..',
      '.aceddfhchfcdcda.',
      '.aedaegeeegcadca.',
      '..acacghehgdaca..',
      '...aaaceecdaaa...',
    ],
    left: [
      '.......aaaaa....',
      '......abccbba...',
      '.....aceeeecba..',
      '....abceeeeecba.',
      '....acceeeeecba.',
      '....aceeeeeccba.',
      '....aceeeecccda.',
      '....adchhcccdda.',
      '....adhhdccaada.',
      '....aehfecaeca..',
      '...adeegeccdea..',
      '....achgccdca...',
      '.....accdaaa....',
    ],
    up: [
      '......aaaaa......',
      '.....abccbda.....',
      '....aceeeecda....',
      '...abceeeeebda...',
      '...aceeeeeecda...',
      '...aceeeeeecda...',
      '...acceeeeccda...',
      '...accccccccda...',
      '..dacccccccbdaa..',
      '.dcedccccccddcda.',
      '.dedadccccddadca.',
      '..dcadddddddaca..',
      '...daadddddaaa...',
    ],
  },
  at: { down: [-8, 0], left: [-9, 0], up: [-8, 0] },
  colors: { a: '#845218', b: '#c69452', c: '#e79c84', d: '#ce8463', e: '#ffbdad', f: '#c6c6c6', g: '#ffffff', h: '#000000' },
};

/**
 * Shoulder-length centre-parted light hair and face: Future Trunks's long hair (his first arrival)
 * from the front and side, Android 18's hair from behind (that Trunks block has no back row).
 * Hair characters: `o` outline / deep shade, `d` dark, `m` mid, `l` light, `w` white; skin is
 * Trunks's (dye with block futureTrunksLongHair), `i` / `k` irises, `h` eye white.
 */
const LIGHT_LONG_HAIR_HEAD: Patch = {
  rows: {
    down: [
      '....oo.oo....',
      '..oolmommoo..',
      '.oolmomlmloo.',
      '.olwwloolwlo.',
      'omwwlmomllwmo',
      'ollmoomoolllo',
      'olmomooomomlo',
      'olmoososoomlo',
      'oloostuosoomo',
      'olooomtmooomo',
      'oloshiuihsomo',
      'omojwkukwjomo',
      'omoojuuspoomo',
      'omoonnnnnoomo',
      '.ooosususooo.',
    ],
    left: [
      '......ooooo....',
      '....oolloooo...',
      '...omloomommo..',
      '..olmomollwlmo.',
      '..ooomllwlwwlo.',
      '..ooommllwlmlmo',
      '.oomoomllmllmmo',
      'o.omnsomlmllmlo',
      '..oonsommlmlmlo',
      '..onuooomlmlmmo',
      '..nsuiwomlmlmmo',
      '..onskwoolmlmmo',
      '..omnsuoololmmo',
      '..ooonnoomomoo.',
      '.....s..oooo...',
    ],
    up: [
      '....oo.ooo......',
      '...omdodldoo....',
      '...odldodlldo...',
      '..omwdodlwwdmo..',
      '..odldodomdldo..',
      '..olwwdodlwddmo.',
      '..olwdlmoodlddo.',
      '..odwdwodlddmdmo',
      '..odwlwdwllddmmo',
      '..odllwdwdwldmmo',
      '..odldllldlldmo.',
      '..odldllldlddmo.',
      '..odldldldlmdmo.',
      '..ooldldldlodoo.',
      '....odldloloo...',
    ],
  },
  at: { down: [-6, -1], left: [-8, -1], up: [-9, -1] },
  colors: {
    o: '#7b217b', d: '#ad21ad', m: '#d652ff', l: '#efadff', w: '#ffffff',
    s: '#c69452', t: '#dead63', u: '#f7c673', j: '#ad7b39', p: '#a56b31', n: '#845218',
    h: '#dedede', i: '#4221d6', k: '#210084',
  },
};

/** A townsman's short side-parted hair and face (npcYoungManC), from his idle frames. Parts: hair, skin, eyes. */
const SHORT_HAIR_HEAD: Patch = {
  rows: {
    down: [
      '.......aaaa......',
      '.....aabbaaaa....',
      '....aabbbabbaa...',
      '..aaacbbdabbaa...',
      '.aaccdbddbabcaa..',
      '.acdddddbbabdcba.',
      '.abddbbbaaaabdaa.',
      '.aababaaeefeabaa.',
      '.aaaeaeggeggeah..',
      '..ahiahjgfgjhhfh.',
      '...hfeiffiffhheh.',
      '....hhfiiiieehh..',
      '......heiifeh....',
      '.......hhhhh.....',
    ],
    left: [
      '......aaaaa......',
      '....aabdcbba.....',
      '...abbbabcbba....',
      '..abcabddddbba...',
      '.abcabddddbdba...',
      '.abdabbddbbbbba..',
      '.aabaabbbbbbbaa..',
      '..aaheaabbbaaaa..',
      '...aeggfabahaa...',
      '...higjhfahfha...',
      '..heiifiiffeeh...',
      '...hfgiifehh.....',
      '....hfifhh.......',
      '.....hhh.........',
    ],
    up: [
      '......aaaa.......',
      '....aaaabbaaa....',
      '...aabbaccdbbaa..',
      '...abcbabbdbcba..',
      '..aacbaaabdbbbba.',
      '.abbdbbaabbdbbda.',
      '.abbbdbabdbbddba.',
      '.abbdbdbbbdbdbba.',
      '..abbdbbbbbbbba..',
      '.haabbbbbbbbba...',
      '.hfabbabbabbaa...',
      '..haabaaaaaaa....',
      '...haaaaaaaa.....',
      '....aaaaaa.......',
    ],
  },
  at: { down: [-8, -1], left: [-7, -1], up: [-8, -1] },
  colors: { a: '#6b3110', b: '#7b6342', c: '#ced6ad', d: '#ada57b', e: '#ce8463', f: '#e79c84', g: '#000000', h: '#845218', i: '#ffbdad', j: '#c6c6c6' },
};

/**
 * A wolf's head in the LoG2 style: tall pointed ears, a pale muzzle with a black nose, and a long
 * snout in profile. `k` outline, `f` fur, `F` light fur, `m` muzzle, `i` inner ear, `e` eye,
 * `p` pupil, `n` nose, `M` mouth; see wolfHead for the dye.
 */
const WOLF_HEAD: Patch = {
  rows: {
    down: [
      '.kk...........kk.',
      '.kik.........kik.',
      '.kiik.kkkkk.kiik.',
      '.kfiikfffffkiifk.',
      '..kffffFFFffffk..',
      '..kfffFFFFFfffk..',
      '.kffffFFFFFffffk.',
      '.kfkkkfFFFfkkkfk.',
      'kffeepkFFFkpeeffk',
      'kfffkkmmmmmkkfffk',
      '.kfFfmmnnnmmfFfk.',
      '..kffmmmnmmmffk..',
      '..kfFkmMMMmkFfk..',
      '...kffkmmmkffk...',
      '....kkkkkkkkk....',
    ],
    left: [
      '........kik.kk...',
      '........kiikkfk..',
      '.......kfiiffffk.',
      '......kffffffFfk.',
      '.....kffffffFFffk',
      '....kfffffffFFffk',
      '...kfkkkffffFFffk',
      '..kfpekfffFFffffk',
      'kkffFFffffFFffffk',
      'nmmmmmFFfffffffk.',
      'kmmmmmmffffffffk.',
      '.kMMMmmkfffffffk.',
      '..kmmmmkffffffk..',
      '...kkkkkfffffk...',
      '........kkkkk....',
    ],
    up: [
      '.kk...........kk.',
      '.kfk.........kfk.',
      '.kffk.kkkkk.kffk.',
      '.kfffkfffffkfffk.',
      '..kfffffffffffk..',
      '..kffffFFFffffk..',
      '.kfffffFFFfffffk.',
      '.kffffFFFFFffffk.',
      'kfffffFFFFFfffffk',
      'kffffffFFFffffffk',
      '.kfffffffffffffk.',
      '..kfffffffffffk..',
      '..kfffffffffffk..',
      '...kfffffffffk...',
      '....kkkkkkkkk....',
    ],
  },
  at: { down: [-8, -2], left: [-10, -2], up: [-8, -2] },
  colors: { k: '#3a2818', f: '#806040', F: '#a88058', m: '#e0d0b8', i: '#d88890', e: '#f0e8a0', p: '#101010', n: '#181818', M: '#402020' },
};

/** Frieza Force soldier B's domed head plate, crest and visor (friezaSoldierB). Parts: outfit (plate), outfit2 (crest), eyes (visor), skin. */
const DOME_HELMET_HEAD: Patch = {
  rows: {
    down: [
      '.......aaa.......',
      '......abcaa......',
      '.....bacbaab.....',
      '....bcacbaacb....',
      '....bdabaaacb....',
      '...bcdaaaaaccb...',
      '...bdbbaaabbcb...',
      '..bbcbeefffbbb...',
      '..bdbedafagcbcb..',
      '..bcbhcafagbbcb..',
      '...bbieeehhibb...',
      '.....ihieihi.....',
      '.....iihehii.....',
    ],
    left: [
      '......aa.........',
      '......ba.........',
      '.....aca.........',
      '.....aca.bbbbb...',
      '.....ababcccccb..',
      '.....aaacddcccb..',
      '.....aaaddddcccb.',
      '.....aacddddcccb.',
      '.....aabbdcbbccb.',
      '......gagfbdcbcb.',
      '....ihfagfbccbb..',
      '....ieeehhi......',
      '.....ieehii......',
    ],
    up: [
      '.......aaa.......',
      '......aaaaa......',
      '......aaaaa......',
      '.....bbbbbbb.....',
      '....bcdddcccb....',
      '....bdddddccb....',
      '...bcdddddcccb...',
      '...bddddddcccb...',
      '..bbcdddddcccb...',
      '..bdbcdddcccbbb..',
      '..bcbcccccccbcb..',
      '...bbiiiiiiibb...',
      '.....iiiiiii.....',
    ],
  },
  at: { down: [-8, 0], left: [-8, 0], up: [-8, 0] },
  colors: { a: '#000000', b: '#949494', c: '#c6c6c6', d: '#ffffff', e: '#21efce', f: '#007b08', g: '#00ad18', h: '#00a5a5', i: '#21637b' },
};

/** Frieza Force soldier A's spiky crested head and breathing mask (friezaSoldierA). Parts: skin (crest and face), outfit (mask), eyes. */
const CREST_HEAD: Patch = {
  rows: {
    down: [
      '........a........',
      '........a........',
      '.......aba.......',
      '.......aba.......',
      '......aabaa......',
      '....aaccacbaa....',
      '....adcdabbca....',
      '.aaacdbaaabccaaa.',
      '.adacdddabdbbaba.',
      '..adbaaaaeeaffa..',
      '..abbbghehigfgf..',
      '...aadjhehijfjf..',
      '.....adddbba.....',
      '.....aaeieaa.....',
    ],
    left: [
      '.......aa........',
      '......adda.......',
      '.....addba.......',
      '....adbbba.aaa...',
      '...abaaaaaaddba..',
      '...aaccbbbaaba...',
      '..aadccdccbaa....',
      '..acbbddbcbbaa...',
      '..aaddccbbbbaba..',
      '..abaadbffbbaa...',
      '..aihigfgjfba....',
      '...ihijffjfaaa...',
      '..adiia....aa....',
      '..eebaaa.........',
    ],
    up: [
      '........a........',
      '........a........',
      '.......aba.......',
      '.......aba.......',
      '......aabaa......',
      '....aabcaccaa....',
      '....acbbabcba....',
      '.aaaccdbaabbcaaa.',
      '.adabdccaccbcaba.',
      '..aabdddabcbaba..',
      '....adddaabbaba..',
      '....abdbabbbaa...',
      '.....abbbbba.....',
      '.....aabbbaa.....',
    ],
  },
  at: { down: [-8, -1], left: [-7, -1], up: [-8, -1] },
  colors: { a: '#6b6b00', b: '#9c9c00', c: '#ad5a29', d: '#cece00', e: '#007b08', f: '#949494', g: '#ffffff', h: '#000000', i: '#21a542', j: '#c6c6c6' },
};

// =============================================================================================
// Hand-drawn patches, in head space
// =============================================================================================

/** Scouter over the left eye (the viewer's right in the front view) and its ear unit: `l` lens, `L` shine, `k` frame. */
const SCOUTER: Patch = {
  rows: {
    down: [
      '...kk',
      'lLk.k',
      'llk.k',
      '...kk',
    ],
    left: [
      'lk.kk',
      'lk..k',
      '.kkkk',
    ],
    up: [
      'k',
      'k',
      'k',
    ],
  },
  at: { down: [1, 7], left: [-6, 7], up: [-7, 7] },
  colors: { k: '#606070', l: '#40c060', L: '#a0f0b0' },
};

/** A crest of hair along the top of a bald head, front to back: `h` shadow, `H` light. */
const MOHAWK: Patch = {
  rows: {
    down: [
      '.h.',
      'hHh',
      'hHh',
      'hHh',
      '.h.',
    ],
    left: [
      '..h.h.h..',
      '.hHhHhHh.',
      'hHHHHHHHh',
      '.hhHHHhh.',
    ],
    up: [
      '.h.',
      'hHh',
      'hHh',
      'hHh',
      'hHh',
      '.h.',
    ],
  },
  at: { down: [-1, -3], left: [-3, -3], up: [-1, -3] },
  colors: { h: '#202020', H: '#404040' },
};

/** A tall crest of hair standing up from front to back (the Babarian chief): `h` shadow, `H` hair, `l` light. */
const TALL_MOHAWK: Patch = {
  rows: {
    down: [
      '.h.',
      'hlh',
      'hHh',
      'hHh',
      'hHh',
      '.h.',
    ],
    left: [
      '.h..h..h..h.',
      'hlh.hlhhlhhl',
      'hHHhHHhHHhHh',
      'hHHHHHHHHHHh',
      '.hhHHHHHHhh.',
    ],
    up: [
      '.h.',
      'hHh',
      'hHh',
      'hHh',
      'hHh',
      'hHh',
      '.h.',
    ],
  },
  at: { down: [-1, -4], left: [-4, -4], up: [-1, -4] },
  colors: { h: '#202020', H: '#404040', l: '#606060' },
};

/** A swept-back plume of crest feathers (Ganos): `h` shadow, `H` feathers, `l` light. */
const PLUME: Patch = {
  rows: {
    down: [
      '.hHhHh.',
      'hHHlHHh',
      'hHlHlHh',
      '.hHHHh.',
      '..hHh..',
    ],
    left: [
      '...hhHHHh..',
      '.hhHHlHHHh.',
      'hHHlHHHHHHh',
      'hHHHHHhhhHh',
      '.hhhhh...hh',
    ],
    up: [
      '.hHhHh.',
      'hHHHHHh',
      'hHHlHHh',
      'hHHHHHh',
      '.hHHHh.',
    ],
  },
  at: { down: [-3, -4], left: [-2, -4], up: [-3, -4] },
  colors: { h: '#a03010', H: '#f08030', l: '#f8c070' },
};

/** Two horns rising from the top of the skull (Ginyu): `k` horn, `K` sheen. */
const HORNS: Patch = {
  rows: {
    down: [
      'k...........k',
      'kk.........kk',
      'kK.........Kk',
      '.kK.......Kk.',
      '.kk.......kk.',
      '..k.......k..',
    ],
    left: [
      'k....k.',
      'kk...kk',
      'kK...kK',
      '.kK...k',
      '.kk....',
    ],
    up: [
      'k...........k',
      'kk.........kk',
      'kK.........Kk',
      '.kK.......Kk.',
      '.kk.......kk.',
      '..k.......k..',
    ],
  },
  at: { down: [-6, -3], left: [-4, -3], up: [-6, -3] },
  colors: { k: '#181820', K: '#585868' },
};

/** Big pointed ears sticking out from the sides of the head (Babidi). */
const POINTED_EARS: Patch = {
  rows: {
    down: [
      'o...............o',
      'oo.............oo',
      'mmo...........omm',
      '.mmo.........omm.',
      '..oo.........oo..',
    ],
    left: [
      '.o.',
      'oo.',
      'mmo',
      'mmo',
      '.oo',
    ],
    up: [
      'o...............o',
      'oo.............oo',
      'mmo...........omm',
      '.mmo.........omm.',
      '..oo.........oo..',
    ],
  },
  at: { down: [-8, 5], left: [1, 5], up: [-8, 5] },
  colors: { o: '#845218', m: '#e79c84' },
};

/** Two short horns on the brow (Dabura), drawn over Vegeta's own hair (anchor space, no host offset). */
const BROW_HORNS: Patch = {
  rows: {
    down: [
      'h.........h',
      'hH.......Hh',
      '.hH.....Hh.',
      '..h.....h..',
    ],
    left: [
      'h...',
      'hH..',
      '.hH.',
      '..h.',
    ],
    up: [
      'h.........h',
      'hH.......Hh',
      '.hH.....Hh.',
      '..h.....h..',
    ],
  },
  at: { down: [-5, 5], left: [-8, 6], up: [-5, 5] },
  colors: { h: '#a89880', H: '#e8e0d0' },
};

/** Long braids hanging from a hair cap (the Babarian slinger), for Krillin's head. */
const BRAIDS: Patch = {
  rows: {
    down: [
      '.....hhhhh.....',
      '...hhHHHHHhh...',
      '..hHHHhhHHHHh..',
      '..hHhh...hhHh..',
      '.hh.........hh.',
      '.hH.........Hh.',
      '.hh.........hh.',
      '.hH.........Hh.',
      '.hh.........hh.',
      '.hH.........Hh.',
      '..h.........h..',
      '.hHh.......hHh.',
      '..h.........h..',
    ],
    left: [
      '......hhhhh....',
      '....hhHHHHhh...',
      '...hHHhhHHHHh..',
      '...hhh..hHHHHh.',
      '........hhHHh..',
      '.........hHh...',
      '.........hh....',
      '.........hH....',
      '.........hh....',
      '.........hH....',
      '..........h....',
      '.........hHh...',
      '..........h....',
    ],
    up: [
      '.....hhhhh.....',
      '...hhHHHHHhh...',
      '..hHHHHHHHHHh..',
      '..hHHhHHHhHHh..',
      '.hhHhhHHhhHhhh.',
      '.hHhHhhhhHhhHh.',
      '.hh..hHHHh..hh.',
      '.hH...hHh...Hh.',
      '.hh....h....hh.',
      '.hH.........Hh.',
      '..h.........h..',
      '.hHh.......hHh.',
      '..h.........h..',
    ],
  },
  at: { down: [-7, -1], left: [-8, -1], up: [-7, -1] },
  colors: { h: '#a08860', H: '#e0d0a0' },
};

/** Dark glasses over the eyes of Android 18's face (anchor space on her block). */
const SHADES: Patch = {
  rows: {
    down: ['kkkkkkk', '.kKkKk.', '.kk.kk.'],
    left: ['kkkk', '.kKk', '..kk'],
  },
  at: { down: [-4, 10], left: [-4, 11] },
  colors: { k: '#101014', K: '#505868' },
};

/** A pointed hood over Android 18's hair (Dercori), anchor space on her block. */
const HOOD: Patch = {
  rows: {
    down: [
      '.......h.......',
      '......hHh......',
      '.....hHHHh.....',
      '....hHHHHHh....',
      '...hHHHHHHHh...',
      '..hHHHHHHHHHh..',
      '..hHHhhhhhHHh..',
      '.hHHh.....hHHh.',
      '.hHh.......hHh.',
      '.hHh.......hHh.',
      '.hHh.......hHh.',
      '.hHh.......hHh.',
      '.hHh.......hHh.',
      '.hhh.......hhh.',
    ],
    left: [
      '.........h.....',
      '........hHh....',
      '.......hHHHh...',
      '......hHHHHHh..',
      '.....hHHHHHHHh.',
      '....hHHHHHHHHh.',
      '...hhhHHHHHHHh.',
      '.....hHHHHHHHh.',
      '.....hhHHHHHHh.',
      '.......hHHHHHh.',
      '.......hHHHHHh.',
      '.......hHHHHHh.',
      '.......hHHHHh..',
      '.......hhhhh...',
    ],
    up: [
      '.......h.......',
      '......hHh......',
      '.....hHHHh.....',
      '....hHHHHHh....',
      '...hHHHHHHHh...',
      '..hHHHHHHHHHh..',
      '..hHHHHHHHHHh..',
      '.hHHHHHHHHHHHh.',
      '.hHHHHHHHHHHHh.',
      '.hHHHHHHHHHHHh.',
      '.hHHHHHHHHHHHh.',
      '.hHHHHHHHHHHHh.',
      '.hHHHHHHHHHHHh.',
      '.hhhhhhhhhhhhh.',
    ],
  },
  at: { down: [-8, -4], left: [-8, -4], up: [-8, -4] },
  colors: { h: '#141c30', H: '#283850' },
};

/**
 * Perfect Cell's pale face, lifted from Frieza's own face pixels (anchor space on Frieza's block)
 * so it follows his head through every frame: `e` shade, `i` mid, `f` light, `h` highlight,
 * `g` outline, `j` eyes / mouth, `r` iris.
 */
const CELL_FACE: Patch = {
  rows: {
    down: [
      '..efe.....efg.',
      '..ehhe...effg.',
      '..ehhhhhhhffg.',
      '.eheegfhfgegfg',
      '.efehegfgefgig',
      '..eehhjhjhfgg.',
      '....ehififgg..',
    ],
    left: [
      '......effe....',
      '..e..ehhhhe...',
      '..efhhhhfifeg.',
      '..efegefehefg.',
      '...gjrhehgfg..',
      '..efjhhehgfg..',
      '..gefhhfefg...',
      '...geifieg....',
    ],
  },
  at: { down: [-7, 5], left: [-7, 5] },
  colors: { e: '#8a7080', i: '#c8a8b4', f: '#e0ccd2', h: '#f6ecee', g: '#1c2c18', j: '#101010', r: '#d03060' },
};

/** Perfect Cell's two-pronged crest over Frieza's dome (anchor space on Frieza's block). */
const CELL_CREST: Patch = {
  rows: {
    down: [
      'k...........k',
      'kk.........kk',
      'kgk.......kgk',
      '.kgk.....kgk.',
      '..kg.....gk..',
    ],
    left: [
      '......k',
      '.....kk',
      '....kgk',
      '...kgk.',
      '..kgk..',
    ],
    up: [
      'k...........k',
      'kk.........kk',
      'kgk.......kgk',
      '.kgk.....kgk.',
      '..kg.....gk..',
    ],
  },
  at: { down: [-6, -3], left: [0, -3], up: [-6, -3] },
  colors: { k: '#1c3018', g: '#58a040' },
};

// =============================================================================================
// Hosts: the LoG2 fighter bodies these looks are built on
// =============================================================================================

/** How head patches (head space) land on a host block's frames, and what the host needs erased / left alone. */
interface Host {
  block: string;
  /** Head space → this host's head anchor, per facing. */
  at: Offsets;
  /** Host colours erased under the new head (its own hair), and how far down from the anchor. */
  erase?: readonly string[];
  eraseDepth?: number;
  /** Animations whose frames turn or hide the head (lying, flying, arms over the head): drawn without the overlay. */
  skip: readonly string[];
}

const HOSTS = {
  /** Vegeta's Saiyan-armour body: bodysuit `outfit`, armour with gloves and boots `outfit2` (`boots` shares its tones), shoulder straps `trim`. */
  vegeta: {
    block: 'vegeta',
    at: { down: [0, 4], left: [-3, 4], up: [0, 4] },
    erase: ['#000000', '#737373'],
    eraseDepth: 17,
    skip: ['ko', 'koFront', 'fly', 'flyUpLeft', 'swim'],
  },
  /** Krillin's short bald body: gi `outfit`, undershirt, belt, wristbands and boots `outfit2`/`boots`, back emblem `emblem`. */
  krillin: { block: 'krillin', at: {}, skip: ['ko', 'koHold', 'fly', 'raise', 'levelUp', 'cheer'] },
  /** Tien's big bald body: tank top and trousers `outfit`, sash `outfit2`, boots, wrist wraps `wraps`. */
  tien: { block: 'tien', at: {}, skip: ['ko', 'koHold', 'fly', 'raise', 'levelUp', 'cheer', 'blownAway'] },
  /** Piccolo without his weights: sleeveless gi `outfit`, sash `sash`, boots, bare arms banded with `skin2`. */
  piccolo: {
    block: 'piccoloNoWeights',
    at: { down: [0, -1], left: [0, -1], up: [0, -1] },
    skip: ['ko', 'fly', 'flyDownRight', 'flyDownLeft', 'flyUpLeft', 'flyUpRight', 'levelUp', 'putOnWeights', 'regenerateArm'],
  },
} as const satisfies Record<string, Host>;

type HostId = keyof typeof HOSTS;

/** Which frames replace a head-swapped host's lying and flying frames (which turn the head away from the overlay). */
type Fallen = 'bald' | 'hair';

/** Options for a look built on a host body. */
interface Dress {
  /** Part ramps (host part names). */
  parts: Readonly<Record<string, Ramp>>;
  recolor?: Readonly<Record<string, string>>;
  /** Head-space patches, bottom to top. */
  head?: readonly Patch[];
  /** Patches already in the host's anchor space (not moved by the host offset). */
  anchored?: readonly Patch[];
  /** Keep the host's own hair (no erase): the patches only add to it. */
  keepHair?: boolean;
  /** Vegeta hosts: 'bald' takes Krillin's lying / flying frames, 'hair' Trunks's (hair dyed with `hair`); omitted keeps Vegeta's. */
  fallen?: Fallen;
  /** Hair ramp for Trunks's lying / flying frames (fallen 'hair'). */
  hair?: Ramp;
  scale?: number;
}

/** Future Trunks's hair colours (unique to his blocks), dyed for 'hair' fallen frames. */
const TRUNKS_HAIR = ['#7b217b', '#ad21ad', '#d652ff', '#efadff'] as const;

/** A look on a host body with its head re-dressed by overlay patches. */
function dressed(hostId: HostId, d: Dress): SheetLook {
  const host: Host = HOSTS[hostId];
  const patches = [...(d.head ?? []).map((p) => moved(p, host.at)), ...(d.anchored ?? [])];
  const erase = d.keepHair ? {} : { erase: host.erase, eraseDepth: host.eraseDepth };
  const recolor: Record<string, string> = { ...(d.recolor ?? {}) };
  const extra: SheetExtra[] = [];
  if (hostId === 'vegeta' && d.fallen === 'bald') extra.push({ block: 'krillin', anims: ['ko', 'fly'] });
  if (hostId === 'vegeta' && d.fallen === 'hair') {
    extra.push({ block: 'futureTrunks', anims: ['ko', 'fly'] });
    const hair = d.hair ?? [];
    TRUNKS_HAIR.forEach((c, i) => {
      if (hair.length) recolor[c] = hair[Math.round((i * (hair.length - 1)) / (TRUNKS_HAIR.length - 1))];
    });
  }
  return {
    block: host.block,
    parts: d.parts,
    ...(Object.keys(recolor).length ? { recolor } : {}),
    ...(patches.length ? { overlay: overlayOf(patches, { ...erase, skipAnims: host.skip }) } : {}),
    ...(extra.length ? { extra } : {}),
    ...(d.scale ? { scale: d.scale } : {}),
  };
}

/** Dye a borrowed head's skin part (and optionally others) with ramps. */
const headOf = (head: Patch, block: string, parts: Readonly<Record<string, Ramp>>, recolor?: Readonly<Record<string, string>>): Patch =>
  dye(head, block, { parts, recolor });

// =============================================================================================
// Colours
// =============================================================================================

/** Frieza Force armour: cream plates (8 tones for Vegeta's armour, gloves and boots). */
const FF_ARMOUR = ramp('#e8e8d0', 8);
const GOLD: Ramp = ['#7a4c08', '#c08418', '#f0c030', '#fff0a0'];

/**
 * Eight armour tones for Vegeta's armour, gloves and boots, with the cast colour as the main plate
 * tone (LoG2 lights the plates from its upper tones, so the colour sits two thirds up).
 */
function plates(color: string): string[] {
  return [0.3, 0.42, 0.55, 0.68, 0.82, 1, 1.14, 1.3].map((f) => (f === 1 ? color : shade(color, f)));
}

/** Three bodysuit / cloth tones with the cast colour as the main tone. */
function cloth(color: string): string[] {
  return [shade(color, 0.55), color, shade(color, 1.2)];
}

/** Five hair tones, outline / deep shade to white highlight. */
type HairTones = readonly [string, string, string, string, string];

const WHITE_HAIR_TONES: HairTones = ['#7c7c94', '#a8a8bc', '#c8c8d8', '#e4e4ee', '#ffffff'];
const SILVER_HAIR_TONES: HairTones = ['#7c88a8', '#a8b4cc', '#d0d8e8', '#eef2f8', '#ffffff'];

/** The light shoulder-length hair and face re-dressed: hair tones, skin ramp, iris colour. */
function longHair(hair: HairTones, skin: Ramp, eye: string): Patch {
  const face = headOf(LIGHT_LONG_HAIR_HEAD, 'futureTrunksLongHair', { skin });
  return tinted(face, { o: hair[0], d: hair[1], m: hair[2], l: hair[3], w: hair[4], i: eye, k: shade(eye, 0.6) });
}

// =============================================================================================
// Frieza and the Frieza Force
// =============================================================================================

const SORBET_SKIN = ramp('#5878d0', 5);
const HEAVY_SKIN = ramp('#7090c0', 5);
const GINYU_SKIN = ramp('#9860c0', 5);
const ELITE_SKIN = ramp('#e0b0d0', 5);
const TAGOMA_SKIN = ramp('#e8d0a8', 5);
const SHISAMI_SKIN = ramp('#9cb0d4', 5);
const WHITE_HAIR = ramp('#e8e8e8', 4);
const SILVER_HAIR = ramp('#e8e8f0', 4);

/** Vegeta's bodysuit and Krillin's gi / undershirt (sheet colours unique to those blocks). */
const VEGETA_SUIT = ['#210084', '#3110ad', '#4221d6'] as const;
const KRILLIN_GI = ['#7b3100', '#ad4a00', '#d66300', '#ff9418'] as const;
const KRILLIN_BLUE = ['#21217b', '#4221d6', '#2163ce'] as const;
/**
 * Vegeta's and Krillin's skin without #ad7b39, which the soldier blocks also use for the brown
 * trim on their armour: those few mid-tone pixels stay tan rather than re-dye the soldiers' own frames.
 */
const VEGETA_SKIN = ['#845218', '#c69452', '#dead63', '#f7c673'] as const;
const KRILLIN_SKIN = ['#845218', '#a56b31', '#c69452', '#ce8463', '#e79c84', '#ffbdad'] as const;
/** Frieza Force black bodysuit. */
const FF_BODYSUIT: Ramp = ['#08080c', '#18181f', '#2c2c38'];
const FF_ARMOUR_WHITE: Ramp = ['#949494', '#c6c6c6', '#ffffff'];

/** Animations a soldier's own LoG2 block has, and the fighting set it borrows from Vegeta. */
const SOLDIER_A_OWN = ['idle', 'blink', 'walk'] as const;
const SOLDIER_B_OWN = ['idle', 'blink', 'walk', 'startled', 'battleStance', 'hurt', 'guard'] as const;
const VEGETA_FIGHT = ['punch1', 'punch2', 'punch3', 'kick', 'blast', 'charge', 'hurt', 'guard', 'raise'] as const;

/**
 * A Frieza Force soldier whose LoG2 block only stands and walks: its own frames for those, and
 * Vegeta's fighting frames (bodysuit blackened, shoulder straps browned) under the soldier's own
 * head for everything else, falling and flying on Krillin's frames with the head dyed to match.
 */
function soldier(block: 'friezaSoldierA' | 'friezaSoldierB', head: Patch, skin: Ramp, own: readonly string[]): SheetLook {
  const fight = VEGETA_FIGHT.filter((a) => !own.includes(a));
  return {
    block,
    parts: { trim: ['#7b6342', '#7b6342', '#ad7b39'] },
    recolor: {
      ...rampMap(VEGETA_SUIT, FF_BODYSUIT),
      ...rampMap(VEGETA_SKIN, skin),
      ...rampMap(KRILLIN_SKIN, skin),
      ...rampMap(KRILLIN_GI, FF_ARMOUR_WHITE),
      ...rampMap(KRILLIN_BLUE, FF_BODYSUIT),
    },
    extra: [{ block: 'vegeta', anims: fight }, { block: 'krillin', anims: ['ko', 'fly'] }],
    overlay: overlayOf([moved(head, HOSTS.vegeta.at)], {
      erase: HOSTS.vegeta.erase,
      eraseDepth: HOSTS.vegeta.eraseDepth,
      skipAnims: [...own, 'ko', 'fly'],
    }),
  };
}

registerSheetCast({
  // Golden Frieza: Frieza's own block with the white body gilded; the purple carapace stays.
  goldenFrieza: { block: 'frieza', parts: { skin: GOLD }, recolor: { '#c6c6c6': '#e04060' } },

  // The two LoG2 Frieza Force soldiers, given full fighting sets.
  frizaSoldier: soldier('friezaSoldierA', CREST_HEAD, ['#6b6b00', '#9c9c00', '#b8b800', '#cece00'], SOLDIER_A_OWN),
  frizaSoldierB: soldier('friezaSoldierB', DOME_HELMET_HEAD, ['#21637b', '#00a5a5', '#10c8b8', '#21efce'], SOLDIER_B_OWN),

  // Sorbet: short, blue and bald (Krillin's round head) in Frieza Force armour, scouter on.
  sorbet: dressed('vegeta', {
    parts: { skin: SORBET_SKIN, outfit: ramp('#383870', 3), outfit2: FF_ARMOUR, boots: FF_ARMOUR, trim: ramp('#b89838', 3) },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: SORBET_SKIN }), SCOUTER],
    fallen: 'bald',
  }),

  // Frieza Force heavy: big blue bald brute (Tien's head) with a green bodysuit.
  frizaSoldierC: dressed('vegeta', {
    parts: { skin: HEAVY_SKIN, outfit: ramp('#285828', 3), outfit2: ramp('#d8d8c0', 8), boots: ramp('#d8d8c0', 8) },
    head: [headOf(TIEN_HEAD, 'tien', { skin: HEAVY_SKIN }), moved(SCOUTER, { down: [1, 1], left: [-1, 1] })],
    fallen: 'bald',
  }),

  // Frieza Force elite / officer: pale pink skin, long white hair, purple-black bodysuit, blue scouter.
  frizaElite: dressed('vegeta', {
    parts: { skin: ELITE_SKIN, outfit: ramp('#382858', 3), outfit2: FF_ARMOUR, boots: FF_ARMOUR },
    head: [longHair(WHITE_HAIR_TONES, ELITE_SKIN, '#802050'), tinted(SCOUTER, { l: '#40c0f0', L: '#b0e8f8' })],
    fallen: 'hair',
    hair: WHITE_HAIR,
  }),

  // Tagoma: big, pale, short white hair, maroon bodysuit.
  tagoma: dressed('vegeta', {
    parts: { skin: TAGOMA_SKIN, outfit: ramp('#583848', 3), outfit2: FF_ARMOUR, boots: FF_ARMOUR },
    head: [headOf(SHORT_HAIR_HEAD, 'npcYoungManC', { hair: WHITE_HAIR, skin: TAGOMA_SKIN })],
    fallen: 'hair',
    hair: WHITE_HAIR,
  }),

  // Shisami: pale blue skin, long silver hair, blue bodysuit.
  shisami: dressed('vegeta', {
    parts: { skin: SHISAMI_SKIN, outfit: ramp('#4060a0', 3), outfit2: FF_ARMOUR, boots: FF_ARMOUR },
    head: [longHair(SILVER_HAIR_TONES, SHISAMI_SKIN, '#303050')],
    fallen: 'hair',
    hair: SILVER_HAIR,
  }),

  // Captain Ginyu: purple, horned, navy bodysuit.
  ginyu: dressed('vegeta', {
    parts: { skin: GINYU_SKIN, outfit: ramp('#304088', 3), outfit2: FF_ARMOUR, boots: FF_ARMOUR },
    head: [headOf(TIEN_HEAD, 'tien', { skin: GINYU_SKIN }), HORNS],
    fallen: 'bald',
  }),
});

// =============================================================================================
// Universe 9: the Trio de Dangers and their wolf-men
// =============================================================================================

/**
 * The wolf head dyed: fur (outline, fur, light fur), with a muzzle paled from the light fur and an
 * iris colour, lowered `dy` rows so the ears clear the top of the host's frames (the snout and
 * ruff then sit over the top of the shoulders, as a wolf-man's thick neck does).
 */
function wolfHead(fur: Ramp, dy: number, eye = '#f0e8a0'): Patch[] {
  const head = tinted(WOLF_HEAD, { k: fur[0], f: fur[1], F: fur[2], m: mix(fur[2], '#f4ead8', 0.55), e: eye });
  return [moved(head, { down: [0, dy], left: [0, dy], up: [0, dy] })];
}

/** Piccolo's lean fighter body for a wolf: fur on skin and arm bands, uniform on the gi. */
function wolfOnPiccolo(fur: Ramp, suit: Ramp, sash: Ramp): SheetLook {
  return dressed('piccolo', {
    parts: { skin: fur, skin2: [fur[0], fur[1], fur[1], fur[2]], outfit: suit, sash, boots: ['#141420', '#24243a'] },
    head: wolfHead(fur, 2),
  });
}

/** Trio de Dangers uniform: blue sleeveless top (cast top #3060a0) and near-black trousers / sash (#202030). */
const U9_TOP: Ramp = ['#183060', '#24488a', '#3060a0', '#4880c8'];
const U9_DARK: Ramp = ['#10101a', '#181826', '#202030', '#30304a'];

const BASIL_FUR: Ramp = ['#5a3c26', '#a07858', '#c8a080'];
const LAVENDER_FUR: Ramp = ['#402c5c', '#8060a8', '#a888cc'];
const BERGAMO_FUR: Ramp = ['#3a303a', '#706070', '#988898'];
const DOPED_FUR: Ramp = ['#4a2c18', '#8a5a3c', '#b07c58'];
const U9_WOLF_FUR: Ramp = ['#4a382a', '#8a6a50', '#b09070'];

registerSheetCast({
  basil: wolfOnPiccolo(BASIL_FUR, U9_TOP, U9_DARK),
  lavender: wolfOnPiccolo(LAVENDER_FUR, U9_TOP, U9_DARK),
  c14_u9Wolf: wolfOnPiccolo(U9_WOLF_FUR, U9_DARK, U9_TOP),
  bergamo: dressed('tien', {
    parts: { skin: [BERGAMO_FUR[0], BERGAMO_FUR[0], BERGAMO_FUR[1], BERGAMO_FUR[1], BERGAMO_FUR[1], BERGAMO_FUR[2], BERGAMO_FUR[2]], skinAlt: BERGAMO_FUR, outfit: U9_TOP, outfit2: U9_DARK, boots: U9_DARK, wraps: U9_DARK },
    head: wolfHead(BERGAMO_FUR, 1),
  }),
  c13_basilDoped: dressed('tien', {
    parts: { skin: [DOPED_FUR[0], DOPED_FUR[0], DOPED_FUR[1], DOPED_FUR[1], DOPED_FUR[1], DOPED_FUR[2], DOPED_FUR[2]], skinAlt: DOPED_FUR, outfit: U9_TOP, outfit2: U9_DARK, boots: U9_DARK, wraps: ['#801818', '#c02828', '#f04848'] },
    head: wolfHead(DOPED_FUR, 1, '#f04848'),
  }),
});

// =============================================================================================
// Helmeted troopers: Galactic Poachers, Gryll's gang, the U9 assassin
// =============================================================================================

/** Frieza Force soldier B's domed helmet re-dyed: plate (dark → light), crest, face skin (dark → light), visor (dark, light). */
function domeHelmet(plate: Ramp, crest: string, skin: Ramp, visor: readonly [string, string]): Patch {
  return tinted(DOME_HELMET_HEAD, { b: plate[0], c: plate[1], d: plate[2], a: crest, i: skin[0], h: skin[1], e: skin[2], f: visor[0], g: visor[1] });
}

const POACHER_SKIN = ramp('#90a070', 5);
const POACHER_BOSS_SKIN = ramp('#8098a8', 5);
const GOO_SKIN = ramp('#b868d8', 5);
const GOO_EYES = ['#c0a020', '#f8f070'] as const;

registerSheetCast({
  // Galactic Poacher: olive armour over a drab bodysuit, olive helmet with an amber visor.
  poacher: dressed('vegeta', {
    parts: { skin: POACHER_SKIN, outfit: cloth('#585840'), outfit2: plates('#a0a078'), trim: cloth('#e0a030') },
    head: [domeHelmet(cloth('#787860'), '#282418', [POACHER_SKIN[0], POACHER_SKIN[2], POACHER_SKIN[4]], ['#a06010', '#f0b040'])],
    fallen: 'bald',
  }),

  // Poacher captain: Tien's bulk, dark sleeves and gloves under brown armour, gold belt, red visor.
  c13_poacherBoss: dressed('tien', {
    parts: {
      skin: ramp('#383028', 7),
      skinAlt: ramp('#383028', 3),
      outfit: ramp('#585040', 3),
      outfit2: ramp('#e0a030', 4),
      boots: ramp('#202018', 3),
      wraps: ramp('#383028', 3),
    },
    head: [domeHelmet(ramp('#605848', 3), '#181810', [POACHER_BOSS_SKIN[0], POACHER_BOSS_SKIN[2], POACHER_BOSS_SKIN[4]], ['#a02010', '#f05030'])],
  }),

  // Gryll: green, bald and mohawked, in purple-grey armour.
  c08_gryll: dressed('vegeta', {
    parts: { skin: ramp('#70a060', 5), outfit: cloth('#403840'), outfit2: plates('#706070'), trim: cloth('#a090a0') },
    head: [headOf(TIEN_HEAD, 'tien', { skin: ramp('#70a060', 5) }), tinted(MOHAWK, { h: '#202a14', H: '#304020' })],
    fallen: 'bald',
  }),

  // The Commeson's copy of Gryll: the same thug in goo purples with glowing yellow eyes.
  c08_gooGryll: dressed('vegeta', {
    parts: { skin: GOO_SKIN, outfit: cloth('#7a3098'), outfit2: plates('#9a58c0'), trim: cloth('#c888e0') },
    head: [headOf(TIEN_HEAD, 'tien', { skin: GOO_SKIN }, { '#000000': GOO_EYES[1], '#c6c6c6': GOO_EYES[0] }), tinted(MOHAWK, { h: '#4a1c60', H: '#7a3098' })],
    fallen: 'bald',
  }),

  // The Commeson's copy of one of Gryll's helmeted henchmen.
  c08_gooHench: dressed('vegeta', {
    parts: { skin: GOO_SKIN, outfit: cloth('#7a3098'), outfit2: plates('#9a58c0'), trim: cloth('#f8f070') },
    head: [domeHelmet(ramp('#7a3098', 3), '#40205a', [GOO_SKIN[0], GOO_SKIN[2], GOO_SKIN[4]], GOO_EYES)],
    fallen: 'bald',
  }),

  // Universe 9's assassin: a navy bodysuit head to toe, dark helmet, red visor.
  c13_assassin: dressed('vegeta', {
    parts: { skin: ramp('#80a0c0', 5), outfit: cloth('#202838'), outfit2: plates('#384868'), trim: cloth('#f04040') },
    head: [domeHelmet(cloth('#405478'), '#101018', ramp('#80a0c0', 3), ['#a01818', '#f04040'])],
    fallen: 'bald',
  }),
});

// =============================================================================================
// Universe 10's Babarians
// =============================================================================================

/** Tien's seven skin tones (dark → light) from one cast colour, and his three secondary skin tones. */
function tienSkin(color: string): { skin: string[]; skinAlt: string[] } {
  const r = ramp(color, 7);
  return { skin: r, skinAlt: [r[2], r[4], r[6]] };
}

const BABARIAN = tienSkin('#88a058');
const BABARIAN_CHIEF = tienSkin('#7a9048');
const SLINGER_SKIN = ramp('#98b068', 7);

registerSheetCast({
  // Babarian warrior: green, brown-mohawked, in a leather vest and breeches.
  babarian: dressed('tien', {
    parts: { ...BABARIAN, outfit: cloth('#806040'), outfit2: ramp('#402010', 4), boots: cloth('#402010'), wraps: cloth('#806040') },
    head: [headOf(TIEN_HEAD, 'tien', { skin: BABARIAN.skin }), tinted(MOHAWK, { h: '#2c1c10', H: '#503820' })],
  }),

  // Babarian chief: darker green, a tall red crest, gold sash and wrist bands over a dark vest.
  c10_babarianChief: dressed('tien', {
    parts: { ...BABARIAN_CHIEF, outfit: cloth('#5a4030'), outfit2: ramp('#e0c040', 4), boots: cloth('#402010'), wraps: cloth('#e0c040') },
    head: [headOf(TIEN_HEAD, 'tien', { skin: BABARIAN_CHIEF.skin }), tinted(TALL_MOHAWK, { h: '#701810', H: '#c03020', l: '#e86048' })],
  }),

  // Babarian slinger: a slighter, pale-green Babarian with long blond braids.
  c10_babarianSlinger: dressed('krillin', {
    parts: { skin: SLINGER_SKIN, outfit: ramp('#a07848', 4), outfit2: ramp('#806040', 3), boots: ramp('#402010', 3), emblem: [shade('#a07848', 0.85)] },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: SLINGER_SKIN }), BRAIDS],
  }),
});

// =============================================================================================
// Universe 4
// =============================================================================================

const GANOS_SKIN = ramp('#e0c070', 5);
const GANOS_BIRD = tienSkin('#f0b040');
const GAMISALAS_SKIN: Ramp = ['#6a5030', '#a08458', '#c0a070'];
const DAMOM_SKIN = ramp('#b0a080', 7);
const U4_SKIN = ramp('#90b070', 5);
/** Quitela's team colours: navy armour over a darker bodysuit, gold trim. */
const U4_ARMOUR = plates('#405880');
const U4_SUIT = cloth('#283850');
const U4_GOLD = cloth('#d0c080');

registerSheetCast({
  // Ganos: lanky and yellow with an orange feather crest, in Universe 4 armour.
  c14_ganos: dressed('vegeta', {
    parts: { skin: GANOS_SKIN, outfit: U4_SUIT, outfit2: U4_ARMOUR, trim: U4_GOLD },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: GANOS_SKIN }), PLUME],
    fallen: 'bald',
  }),

  // Ganos transformed: a big golden bird-man with a blazing crest, bare-chested over navy breeches.
  c14_ganosBird: dressed('tien', {
    parts: { ...GANOS_BIRD, outfit: cloth('#34486a'), outfit2: ramp('#e09030', 4), boots: cloth('#e09030'), wraps: cloth('#f06020') },
    head: [headOf(TIEN_HEAD, 'tien', { skin: GANOS_BIRD.skin }), tinted(PLUME, { h: '#902008', H: '#f06020', l: '#f8b048' })],
  }),

  // Gamisalas: tan, mohawked, in a rust sleeveless gi.
  gamisalas: dressed('piccolo', {
    parts: { skin: GAMISALAS_SKIN, skin2: [GAMISALAS_SKIN[0], GAMISALAS_SKIN[1], GAMISALAS_SKIN[1], GAMISALAS_SKIN[2]], outfit: cloth('#a05030'), sash: cloth('#504030'), boots: ['#201408', '#302010'] },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: ramp('#c0a070', 7) }), tinted(MOHAWK, { h: '#40341c', H: '#706040' })],
  }),

  // Damom: small, khaki-skinned and mohawked, in a brown vest.
  c14_damom: dressed('krillin', {
    parts: { skin: DAMOM_SKIN, outfit: ramp('#806040', 4), outfit2: ramp('#504030', 3), boots: ramp('#302010', 3), emblem: [shade('#806040', 0.85)] },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: DAMOM_SKIN }), tinted(MOHAWK, { h: '#3a3018', H: '#605030' })],
  }),

  // A Universe 4 trickster: green skin, dark-green mohawk, team armour.
  c14_u4Fighter: dressed('vegeta', {
    parts: { skin: U4_SKIN, outfit: U4_SUIT, outfit2: U4_ARMOUR, trim: U4_GOLD },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: U4_SKIN }), tinted(MOHAWK, { h: '#2a3814', H: '#486028' })],
    fallen: 'bald',
  }),
});

// =============================================================================================
// Android 18's body: the women of Universe 4 and the street gang
// =============================================================================================

/** Android 18's hair (outline, dark, mid, light) → new colours; her #ffffff highlights stay. */
function hair18(o: string, d: string, m: string, l: string): Record<string, string> {
  return { '#845218': o, '#e7a542': d, '#ffd642': m, '#ffff7b': l };
}

/** 18's striped long sleeves (dark → light, without the white her hair shares) → new tones. */
const SLEEVES_18 = ['#5a5a5a', '#737373', '#949494', '#adadad', '#c6c6c6', '#dedede'] as const;

/** 18's six skin tones from one cast colour. */
function skin18(color: string): string[] {
  return [0.62, 0.72, 0.84, 1, 1.12, 1.16].map((f) => (f === 1 ? color : shade(color, f)));
}

const CAWAY_SKIN = skin18('#e8b4cc');
const DERCORI_SKIN = skin18('#806878');
const SLINGER_GANG_SKIN = skin18('#f0b888');

registerSheetCast({
  // Caway: pink-skinned, white-haired, bare-armed in a navy suit with gold boots.
  c14_caway: {
    block: 'android18',
    parts: { skin: CAWAY_SKIN, outfit: cloth('#405880').concat('#5070a0'), boots: ['#806020', '#b09040', '#d0c080'], emblem: ['#b09040', '#d0c080'] },
    recolor: {
      ...hair18('#7c7c94', '#b8b8cc', '#e0e0ec', '#f8f8ff'),
      ...rampMap(SLEEVES_18, CAWAY_SKIN),
      '#000000': '#283850',
      '#007373': '#503060',
      '#21bdff': '#9060b0',
    },
  },

  // Dercori: the hooded fortune-teller, mauve-skinned under a pointed navy hood and robe.
  c14_dercori: {
    block: 'android18',
    parts: { skin: DERCORI_SKIN, outfit: cloth('#283850').concat('#34486a'), boots: ['#100c14', '#201828', '#302838'], emblem: ['#a08030', '#d0c080'] },
    recolor: {
      ...hair18('#0c1020', '#141c30', '#1c2840', '#283850'),
      ...rampMap(SLEEVES_18, plates('#405880').slice(1, 7)),
      '#000000': '#201828',
      '#007373': '#a08030',
      '#21bdff': '#d0c080',
    },
    overlay: overlayOf([tinted(HOOD, { h: '#141c30', H: '#2c3c58' })], { skipAnims: ['ko', 'fly'] }),
  },

  // Gang slinger: black bob, dark shades, a dark vest and skirt over maroon leggings.
  c13_gangSlinger: {
    block: 'android18',
    parts: { skin: SLINGER_GANG_SKIN, outfit: cloth('#303038').concat('#44444e'), boots: ['#101010', '#202020', '#303030'], emblem: ['#a03050', '#d04870'] },
    recolor: {
      ...hair18('#100c18', '#221e30', '#363248', '#4c4864'),
      ...rampMap(SLEEVES_18, SLINGER_GANG_SKIN),
      // 18's white hair glints (also her eye shine and swoosh trails) as a cool sheen on black hair.
      '#ffffff': '#6c6890',
      '#000000': '#683058',
    },
    overlay: overlayOf([SHADES], { skipAnims: ['ko', 'fly'] }),
  },
});

// =============================================================================================
// The street gang's men, the rival fighter
// =============================================================================================

const GANG_BRUTE = tienSkin('#e8b078');
const FIGHTER_SKIN = ramp('#c0b0e0', 5);

registerSheetCast({
  // Gang punk: Yamcha's spiky-haired fighter in a maroon vest with pink bands.
  c13_gangPunk: {
    block: 'yamcha',
    parts: { outfit: cloth('#683058').concat('#8a4478'), outfit2: ['#902848', '#a03058', '#b83c64', '#d04870'], boots: ['#181818', '#202020'] },
  },

  // Gang bruiser: big, tan, black-mohawked, in a grey-purple vest with a brass belt.
  c13_gangBrute: dressed('tien', {
    parts: { ...GANG_BRUTE, outfit: cloth('#504048'), outfit2: ramp('#a07030', 4), boots: cloth('#202020'), wraps: cloth('#e0c040') },
    head: [headOf(TIEN_HEAD, 'tien', { skin: GANG_BRUTE.skin }), tinted(MOHAWK, { h: '#101014', H: '#282830' })],
  }),

  // A rival universe's warrior: lilac skin, short teal hair, grey-blue armour.
  universeFighter: dressed('vegeta', {
    parts: { skin: FIGHTER_SKIN, outfit: cloth('#384050'), outfit2: plates('#606880'), trim: cloth('#40a0a0') },
    head: [headOf(SHORT_HAIR_HEAD, 'npcYoungManC', { hair: ['#184848', '#287070', '#40a0a0', '#68c8c8'], skin: FIGHTER_SKIN })],
    fallen: 'hair',
    hair: ['#184848', '#287070', '#40a0a0', '#68c8c8'],
  }),
});

// =============================================================================================
// Filler villains: Watagash, Cell's memory, Dabura and Babidi
// =============================================================================================

const WATAGASH_SKIN: Ramp = ['#4a1c64', '#7a3098', '#9850b8'];

registerSheetCast({
  // Watagash: a purple, antennaed space parasite in a sleeveless white coat, purple sash, brown boots.
  c12_watagash: dressed('piccolo', {
    parts: { skin: WATAGASH_SKIN, skin2: ['#4a1c64', '#6a2a90', '#7a3098', '#b070d0'], outfit: cloth('#e8e8f0'), sash: cloth('#7a3098'), boots: ['#584020', '#806040'] },
  }),

  // A stuntman in a rubber Watagash suit: the same costume in a duller, rubbery purple.
  c12_stuntman: dressed('piccolo', {
    parts: { skin: ['#4a3058', '#705080', '#8a6898'], skin2: ['#4a3058', '#604070', '#705080', '#9a80a8'], outfit: cloth('#d8d4cc'), sash: cloth('#604070'), boots: ['#403020', '#5a4830'] },
  }),

  // Perfect Cell (a memory): Frieza's frame in Cell's green with black crest plates and the two-pronged crown.
  c12_cell: {
    block: 'frieza',
    parts: { skin: ['#386028', '#58a040', '#78c058', '#a8e088'], carapace: ['#101810', '#1c2c18', '#283028', '#405838'] },
    recolor: { '#c6c6c6': '#d03060' },
    overlay: overlayOf([CELL_FACE, CELL_CREST], { skipAnims: ['ko', 'fly'] }),
  },

  // Dabura: Vegeta's armoured frame in demon red, with brow horns, a dark bodysuit and cream armour.
  c09_dabura: dressed('vegeta', {
    parts: { skin: ramp('#d84848', 5), outfit: cloth('#383040'), outfit2: plates('#d8d0c0'), trim: cloth('#c0a040') },
    anchored: [BROW_HORNS],
    keepHair: true,
  }),

  // Babidi: a tiny, big-headed, yellow wizard with pointed ears in a cream robe trimmed red.
  c09_babidi: dressed('krillin', {
    parts: { skin: ramp('#e0c860', 7), outfit: ramp('#e8e0d0', 4), outfit2: ramp('#a03030', 3), boots: ramp('#806040', 3), emblem: ['#a03030'] },
    head: [headOf(KRILLIN_HEAD, 'krillin', { skin: ramp('#e0c860', 7) }), dye(POINTED_EARS, 'krillin', { parts: { skin: ramp('#e0c860', 7) } })],
  }),
});

// =============================================================================================
// Multiverse fighters other cast groups may re-dress: registered as defaults, so a plain look
// for the same id (from any module, in any load order) replaces these instead of clashing.
// =============================================================================================

registerSheetCast(
  {
    // Frost, Universe 6's Frieza: Frieza's own frame, near-white with blue-violet plates and dome.
    frost: {
      block: 'frieza',
      parts: { skin: ['#7880a8', '#a8b4d8', '#d0dcf0', '#f4f8ff'], carapace: ['#202860', '#34449a', '#5464b8', '#8090dc'] },
      recolor: { '#c6c6c6': '#d02040' },
    },
    // A Universe 10 water-ki warrior: blue, antennaed, gold vest.
    c14_u10Fighter: dressed('piccolo', {
      parts: { skin: ['#284870', '#4070a0', '#6098c8'], skin2: ['#284870', '#3a6090', '#4070a0', '#80b0d8'], outfit: cloth('#d0a040'), sash: cloth('#806020'), boots: ['#201408', '#302010'] },
    }),
    // A Universe 2 warrior of love: pink hair and dress, white boots.
    c14_u2Fighter: {
      block: 'android18',
      parts: { outfit: cloth('#f8a0c8').concat('#fcc0dc'), boots: ['#b0b0b8', '#d8d8e0', '#f8f8f8'], emblem: ['#d04888', '#f8f0a0'] },
      recolor: {
        ...hair18('#903868', '#d070a8', '#f0a0d0', '#f8c8e8'),
        ...rampMap(SLEEVES_18, ['#ce8463', '#e79c84', '#f0ac98', '#f8b8a4', '#ffc8b8', '#ffd8cc']),
        '#000000': '#f8a0c8',
      },
    },
  },
  { defaults: true },
);
