import { shade } from '../color';
import { registerSheetCast, type SheetLook, type SheetOverlay } from '../sheets';

/**
 * Earthlings and friends drawn from LoG2 sheet blocks: Bulma's and Goku's families, the Z Fighters,
 * Kame House, the Lookout, the Pilaf gang, and every townsperson, police officer and ambient NPC of the
 * Earth hubs. Colours follow the cast specs in src/content/cast.ts (the dialogue portraits are drawn
 * from those specs, so a sprite and its portrait agree).
 */

/** `n` tones from shadow to highlight around `mid`, the colour the cast spec (and the portrait) uses. */
function tones(mid: string, n: number): string[] {
  const at = n >= 4 ? 0.62 : 0.5;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? at : i / (n - 1);
    const f = t < at ? 0.45 + 0.55 * (t / at) : 1 + 0.4 * ((t - at) / (1 - at));
    out.push(Math.abs(f - 1) < 1e-6 ? mid : shade(mid, f));
  }
  return out;
}

/** Where a head overlay's grid sits per facing (top-left relative to the head anchor); `right` mirrors `left`. */
type HeadOffsets = Readonly<Record<'down' | 'left' | 'up', readonly [number, number]>>;

/** Hat palette: O outline, C crown, H highlight, D band / shadow, V visor or brim underside. */
function hatPalette(crown: string, band = shade(crown, 0.7)): Record<string, string> {
  return { O: shade(crown, 0.45), C: crown, H: shade(crown, 1.35), D: band, V: shade(crown, 0.75) };
}

/** Baseball / work cap: crown and band, the visor jutting forward. */
function cap(crown: string, at: HeadOffsets, band?: string): SheetOverlay {
  return {
    palette: hatPalette(crown, band),
    rows: {
      down: [
        '....OOOOO....',
        '..OOCCCCCOO..',
        '.OCCCCCHHCCO.',
        'OCCCCCCCHCCCO',
        'OCCCCCCCCCCCO',
        'ODDDDDDDDDDDO',
        '.OVVVVVVVVVO.',
      ],
      left: [
        '......OOOOO....',
        '....OOCCCCCOO..',
        '...OCCCHHCCCCO.',
        '...OCCCCHCCCCCO',
        '...OCCCCCCCCCCO',
        '...ODDDDDDDDDDO',
        'OOVVVVVVO......',
      ],
      up: [
        '....OOOOO....',
        '..OOCCCCCOO..',
        '.OCCCCCCCCCO.',
        'OCCCCCCCCCCCO',
        'OCCCCCCCCCCCO',
        'ODDDDOOODDDDO',
        '.OO.......OO.',
      ],
    },
    offset: { down: at.down, left: [at.left[0] - 3, at.left[1]], up: at.up },
  };
}

/** Wide-brimmed straw hat (farmers, gardeners). */
function strawHat(crown: string, band: string, at: HeadOffsets): SheetOverlay {
  const rows = [
    '.....OOOOOOO.....',
    '....OCCCHHCCO....',
    '....OCCCCHCCO....',
    '...ODDDDDDDDDO...',
    '.OOCCCCCCCCCCCOO.',
    'OCCCCCCCCCCCCCCCO',
    '.OVVVVVVVVVVVVVO.',
  ];
  return { palette: hatPalette(crown, band), rows: { down: rows, left: rows, up: rows }, offset: at };
}

/** Builder's hard hat with a rim. */
function hardHat(crown: string, at: HeadOffsets): SheetOverlay {
  const rows = [
    '....OOOOOOO....',
    '...OCCCHHCCO...',
    '..OCCCCCHCCCO..',
    '.OCCCCCCCCCCCO.',
    '.OCCCCCCCCCCCO.',
    'ODDDDDDDDDDDDDO',
    '.OOOOOOOOOOOOO.',
  ];
  return { palette: hatPalette(crown), rows: { down: rows, left: rows, up: rows }, offset: at };
}

/** Knitted beanie with a folded band. */
function beanie(crown: string, at: HeadOffsets): SheetOverlay {
  const rows = [
    '.....OOO.....',
    '...OOCHCOO...',
    '..OCCHCCCCO..',
    '.OCCCCCCCCCO.',
    '.OCCCCCCCCCO.',
    'ODDVDDVDDVDDO',
    'ODDVDDVDDVDDO',
    '.OOOOOOOOOOO.',
  ];
  return { palette: hatPalette(crown), rows: { down: rows, left: rows, up: rows }, offset: at };
}

/** Cloth turban wound around the head (desert nomads). */
function turban(cloth: string, at: HeadOffsets): SheetOverlay {
  const rows = [
    '....OOOOO....',
    '..OOCCHCCOO..',
    '.OCCHCCCDCCO.',
    '.OCHCCCDCCCO.',
    'OCCCCCDCCCCCO',
    'OCCCCDCCCCCCO',
    'ODDDDDDDDDDDO',
    '.OOOOOOOOOOO.',
  ];
  return { palette: hatPalette(cloth), rows: { down: rows, left: rows, up: rows }, offset: at };
}

/** Pleated chef's toque. */
function toque(at: HeadOffsets): SheetOverlay {
  const rows = [
    '..OOO.OOO.OOO..',
    '.OHCCOCHCOCCCO.',
    '.OCCCCCCCCCCCO.',
    '..OCCCCCCCCCO..',
    '..OCDCCDCCDCO..',
    '.ODDDDDDDDDDDO.',
    '.OVVVVVVVVVVVO.',
    '..OOOOOOOOOOO..',
  ];
  return { palette: { O: '#909098', C: '#f8f8f8', H: '#ffffff', D: '#d8d8e0', V: '#c0c0c8' }, rows: { down: rows, left: rows, up: rows }, offset: at };
}

/** Cook's bandana tied at the back of the head. */
function headWrap(cloth: string, at: HeadOffsets): SheetOverlay {
  const front = [
    '...OOOOOOOOO...',
    '..OCCCHCCCCCO..',
    '.OCCCCCCCCCCCO.',
    '.OCCCCCCCCCCCO.',
    'OCDCCCDCCCDCCCO',
    'ODDDDDDDDDDDDDO',
    '.OOOOOOOOOOOOO.',
  ];
  const back = [...front, '......OCO......', '.....OC.CO.....'];
  return { palette: hatPalette(cloth), rows: { down: front, left: front, up: back }, offset: at };
}

/** Fortuneteller Baba's pointed witch hat, its tip bent over. */
function witchHat(felt: string, at: HeadOffsets): SheetOverlay {
  const rows = [
    '.........OO....',
    '.......OOCO....',
    '......OCCHO....',
    '.....OCCCCHO...',
    '....OCCCCCCHO..',
    '...ODDDDDDDDDO.',
    'OOCCCCCCCCCCCOO',
    '.OOOOOOOOOOOOO.',
  ];
  return { palette: hatPalette(felt), rows: { down: rows, left: rows, up: rows }, offset: at };
}

const TAN = ['#6b3a18', '#a86838', '#d09060', '#e8b078'];
const DARK_SKIN = ['#4a2810', '#7a4820', '#a86838', '#c88850'];
const BLACK_HAIR = ['#101018', '#202030', '#383848', '#505068'];
const BULMA_HAIR = ['#1c5a86', '#40a8d8', '#9cd8f4'];

/** Hat positions on the townsman heads (npcYoungMan / B / C: anchor at the hair top, 15px wide). */
const TOWNSMAN_CAP: HeadOffsets = { down: [-6, -1], left: [-6, -1], up: [-6, -1] };
const TOWNSMAN_BRIM: HeadOffsets = { down: [-8, -1], left: [-9, -1], up: [-8, -1] };
/** Hat positions on the muscular townsman heads (npcTough / B). */
const TOUGH_CAP: HeadOffsets = { down: [-6, -1], left: [-6, -1], up: [-7, -1] };
const TOUGH_HELMET: HeadOffsets = { down: [-7, -1], left: [-7, -1], up: [-8, -1] };
/** Yamcha's spiky head: the cap covers the crown, the spike tips above it are erased. */
const YAMCHA_CAP: HeadOffsets = { down: [-6, 1], left: [-7, 1], up: [-7, 1] };

/** Marron's two little pigtails, tied with pink bobbles, on the little-girl head. */
const MARRON_PIGTAILS: SheetOverlay = {
  palette: { O: '#6b5a20', k: '#d8c068', h: '#f8ecb0', R: '#f06080' },
  rows: {
    down: ['.OO...........OO.', 'OhkO.........OkhO', 'OkkkO.......OkkkO', '.OkRO.......ORkO.', '..OO.........OO..'],
    left: ['..OO.', '.OkhO', 'OkkkO', 'ORkO.', '.OO..'],
    up: ['.OO...........OO.', 'OhkO.........OkhO', 'OkkkO.......OkkkO', '.OkRO.......ORkO.', '..OO.........OO..'],
  },
  offset: { down: [-8, -1], left: [4, -1], up: [-8, -1] },
};

/**
 * Master Roshi at Max Power: Tien's bald, muscular fighter body in a tan with cream shorts, the
 * third eye painted over, plus Roshi's sunglasses and long white beard.
 */
const ROSHI_MAX: SheetLook = {
  block: 'tien',
  parts: {
    skin: ['#5a3418', '#7a4828', '#a06838', '#c08050', '#d09060', '#e0a870', '#f0c890'],
    skinAlt: ['#a06838', '#d09060', '#e8b078'],
    outfit: ['#a09870', '#d0c8a0', '#f0e8c0'],
    outfit2: tones('#806040', 4),
    wraps: ['#a09870', '#d0c8a0', '#f0e8c0'],
    boots: ['#402818', '#5a3820', '#7a5030'],
  },
  overlay: {
    palette: { s: '#e0a870', S: '#f0c890', K: '#101010', G: '#682028', B: '#909098', W: '#f8f8f8', V: '#c8c8d0' },
    rows: {
      down: [
        '....sSs....',
        '....SSS....',
        '.KGGKKKGGK.',
        '...........',
        '..BWWWWWB..',
        '.BWWWVWWWB.',
        '.BWWWWWWWB.',
        '..BWWWWWB..',
        '..BWWVWWB..',
        '...BWWWB...',
        '....BWB....',
      ],
      left: [
        '.sS.......',
        '.SS.......',
        '.KGGGKKK..',
        '..........',
        'BWWWB.....',
        'BWWWWB....',
        'BWWWWB....',
        '.BWWWB....',
        '.BWWB.....',
        '..BWB.....',
        '..BB......',
      ],
    },
    offset: { down: [-5, 5], left: [-5, 5] },
  },
};

/** Every Earthling look, keyed by cast id. */
export const EARTHLING_LOOKS: Readonly<Record<string, SheetLook>> = {
  // ------------------------------------------------------------------ Bulma's family
  bulma: {
    block: 'bulma',
    parts: { hair: BULMA_HAIR, outfit: tones('#e04878', 5), outfit2: ['#902850', '#b83868', '#e04878', '#f07098'], boots: ['#a8a8b8', '#e8e8f0'] },
  },
  futureBulma: {
    block: 'bulma',
    parts: { hair: BULMA_HAIR, outfit: tones('#606850', 5), outfit2: tones('#504838', 4), boots: ['#281c10', '#382818'] },
    overlay: {
      // Future Bulma ties her hair back in a short ponytail.
      palette: { O: '#1c5a86', c: '#40a8d8', j: '#9cd8f4', W: '#e0e0e0' },
      rows: {
        left: ['OW...', 'OcO..', '.OcO.', '.OjcO', '..OcO', '..OcO', '...O.'],
        up: ['OWO', 'OcO', 'OjO', 'OcO', 'OcO', 'OcO', '.O.'],
      },
      offset: { left: [5, 3], up: [-1, 2] },
    },
  },
  panchy: {
    block: 'panchy',
    parts: { outfit: tones('#f8a8c8', 5), outfit2: tones('#e88cb0', 4), boots: ['#b8b8c8', '#e0e0e8', '#f8f8f8'] },
  },

  // ------------------------------------------------------------------ Goku's family
  chichi: {
    block: 'chichi',
    parts: { outfit: tones('#d05050', 6), outfit2: tones('#a83838', 4) },
    recolor: { '#d66300': '#b89048', '#ff9418': '#e0c070', '#ffd642': '#f8e8b0' },
  },
  videl: {
    block: 'android18',
    parts: { hair: BLACK_HAIR, outfit: tones('#f0f0f0', 4), outfit2: tones('#f0f0f0', 6), leggings: ['#283858'], boots: tones('#d03030', 3) },
  },
  pan: {
    block: 'npcChild',
    parts: { hair: BLACK_HAIR, outfit: tones('#f8a0b0', 5), outfit2: tones('#f080a0', 3), boots: ['#a0a0b0', '#e0e0e8', '#f8f8f8'] },
  },

  // ------------------------------------------------------------------ Z Fighters and family
  krillin: {
    block: 'krillin',
    parts: { outfit: tones('#3858a8', 4), outfit2: ['#101010', '#202020', '#383838'], emblem: ['#5a5a5a', '#283f88', '#3858a8', '#3858a8'] },
    overlay: {
      // Super-era Krillin: short black hair with a ragged fringe.
      palette: { O: '#101018', h: '#202030', H: '#404060' },
      rows: {
        down: [
          '....O.O.O....',
          '...OOHOHOO...',
          '..OHHhHHhHO..',
          '.OHhhhHhhhhO.',
          '.OhHhhhhhHhO.',
          '.OhhhhhhhhhO.',
          '.Ohh.hhh.hhO.',
          '.Oh.......hO.',
        ],
        left: [
          '....O.O.O....',
          '...OOHOHHO...',
          '..OHHHhhHhO..',
          '.OHhhhhhhhhO.',
          '.OhhHhhhhhhhO',
          '.OhhhhhhhhhhO',
          '..h.Ohhhhhh O',
          '......hhhhhhO',
          '.........hhhO',
        ],
        up: [
          '....O.O.O....',
          '...OOHOHOO...',
          '..OHHhhhHHO..',
          '.OHhhhHhhhHO.',
          '.OhhhhhhhhhO.',
          '.OhhHhhhhhhO.',
          '.OhhhhhhHhhO.',
          '.OhhhhhhhhhO.',
          '..OOhhhhhOO..',
        ],
      },
      offset: { down: [-6, -1], left: [-6, -1], up: [-6, -1] },
    },
  },
  android18: {
    // Super-era 18: navy vest over the striped long sleeves, blue jeans (LoG2's skirt hem keeps the
    // vest's navy, the black tights become the jeans) and brown boots.
    block: 'android18',
    parts: { outfit: tones('#283048', 4), leggings: ['#3858a0'], boots: tones('#783828', 3) },
  },
  mrSatan: {
    // The champion's white gi: LoG2's brown Cell-Games top (and the boots, which share its two dark
    // browns) turn white over the grey-white trousers.
    block: 'hercule',
    parts: { outfit: ['#707084', '#d0d0dc', '#f8f8f8'] },
  },
  c02_marron: {
    block: 'npcLittleGirlB',
    parts: { hair: tones('#f0d878', 4), outfit: tones('#f0a0c0', 4), boots: ['#e04040'] },
    overlay: MARRON_PIGTAILS,
  },
  c13_marron: {
    block: 'npcLittleGirlB',
    parts: { hair: tones('#f0d878', 4), outfit: tones('#f8a8c8', 4) },
    overlay: MARRON_PIGTAILS,
  },
  android17: {
    block: 'android17',
    parts: {
      scarf: tones('#f08020', 3), sleeves: tones('#486838', 3), outfit2: tones('#4a5838', 5),
      socks: ['#281c10', '#382818', '#4a3420'], boots: ['#281c10', '#382818', '#4a3420'], belt: ['#382818'],
    },
    recolor: { '#424242': '#2c4424', '#737373': '#304828' },
  },
  android17Top: {
    block: 'android17',
    parts: {
      scarf: tones('#f08020', 3), sleeves: tones('#f07818', 3), outfit2: tones('#2848b8', 5),
      socks: tones('#f07818', 3), boots: tones('#2848b8', 3), belt: ['#f07818'],
    },
    recolor: { '#424242': '#1c3480', '#737373': '#a85010' },
  },
  majinBuu: {
    block: 'hercule',
    parts: { skin: tones('#f8a0c0', 7), outfit: tones('#6838a0', 3) },
    // Hercule flies on jet boots; Buu flies under his own power (Krillin's flying frames, same parts).
    extra: [{ block: 'krillin', anims: ['fly'] }],
    // In the jet-boot poses (overlay skipped) the afro reads as Buu's dark pink head mass; Krillin's
    // blue belt, wristbands and boots (colours Hercule's block lacks) become Buu's gold ones.
    recolor: { '#000000': '#704866', '#21217b': '#987818', '#4221d6': '#d0a830', '#2163ce': '#f0d058' },
    overlay: {
      // Hercule's afro and face are erased and Buu's round head and antenna drawn in their place.
      palette: { O: '#704866', S: '#b9779f', P: '#f8a5c3', H: '#fbd2e2', E: '#281828', M: '#802848' },
      rows: {
        down: [
          '........OO...',
          '.......OHPO..',
          '......OPOO...',
          '....OOOPOO...',
          '..OOPPPPPHOO.',
          '.OPPPPPPPHHPO',
          '.OPPPPPPPPHPO',
          'OPPPPPPPPPPPO',
          'OPPPPPPPPPPPO',
          'OPEEPPPPPEEPO',
          'OPPPPPPPPPPPO',
          'OSPPMMMMMPPSO',
          'OPSPPMMMPPSPO',
          '.OPPPPPPPPPO.',
          '.OSPPPPPPPSO.',
          '..OSSSSSSSO..',
        ],
        left: [
          '.........OO.',
          '........OPHO',
          '.......OPOO.',
          '....OOOPO...',
          '..OOPPPPPOO.',
          '.OPPHHPPPPPO',
          '.OPPHPPPPPPO',
          'OPPPPPPPPPPO',
          'OPPPPPPPPPPO',
          'OPEEPPPPPPPO',
          'OPPPPPPPPSPO',
          'OMMMPPPPPSPO',
          'OPMPPPPPPSPO',
          '.OPPPPPPPSO.',
          '.OSPPPPPSSO.',
          '..OSSSSSSO..',
        ],
        up: [
          '........OO...',
          '.......OHPO..',
          '......OPOO...',
          '....OOOPOO...',
          '..OOPPPPPPOO.',
          '.OPPPPPPPPPPO',
          '.OPPPPPPPPPPO',
          'OPPPPPPPPPPPO',
          'OPPPPPPPPPPPO',
          'OPPPPPPPPPPPO',
          'OPPPPPPPPPPPO',
          'OSPPPPPPPPPSO',
          'OSPPPPPPPPPSO',
          '.OSPPPPPPPSO.',
          '.OSSPPPPPSSO.',
          '..OSSSSSSSO..',
        ],
      },
      offset: { down: [-6, 0], left: [-6, 0], up: [-6, 0] },
      erase: ['#000000'],
      eraseDepth: 16,
      skipAnims: ['flyDownRight', 'flyUpLeft', 'flyUpRight'],
    },
  },

  // ------------------------------------------------------------------ Kame House and friends
  roshi: {
    block: 'roshi',
    parts: { outfit2: ['#a09870', '#c8c098', '#e0d8b0', '#f0e8c0'] },
  },
  c02_oolong: {
    block: 'oolong',
    parts: { outfit: tones('#3a7a3a', 3) },
  },
  dende: {
    block: 'dende',
    parts: { outfit: ['#a8a8b8', '#d8d8e0', '#f8f8f8'], outfit2: tones('#5070c8', 5) },
  },

  // ------------------------------------------------------------------ Pilaf gang
  pilaf: {
    block: 'npcChild',
    parts: { hair: tones('#6880c0', 4), skin: tones('#6880c0', 4), outfit: tones('#f0e050', 5), outfit2: tones('#d03030', 3), boots: ['#2a1414', '#402020', '#583030'] },
    overlay: {
      // Pilaf's big pointed ears.
      palette: { O: '#38487a', P: '#6880c0', L: '#90a8e0' },
      rows: {
        down: ['O...............O', 'OO.............OO', 'OLO...........OLO', '.OPP.........PPO.', '..OO.........OO..'],
        left: ['....O', '...OO', '..OLO', '.OLPO', 'OPPO.', '.OO..'],
        up: ['O...............O', 'OO.............OO', 'OPO...........OPO', '.OPP.........PPO.', '..OO.........OO..'],
      },
      offset: { down: [-8, 4], left: [1, 3], up: [-8, 4] },
    },
  },
  mai: {
    block: 'npcGirlB',
    parts: { hair: BLACK_HAIR, outfit: tones('#383848', 3), outfit2: tones('#585868', 2), boots: ['#202020'] },
  },
  shu: {
    block: 'npcDogMan',
    parts: { outfit: tones('#405880', 3), outfit2: tones('#304060', 3) },
  },

  // ------------------------------------------------------------------ Future timeline
  futureMai: {
    block: 'npcWoman',
    parts: { hair: BLACK_HAIR, outfit: tones('#586048', 3), outfit2: ['#383830'], accent: ['#282018'] },
  },
  resistance: {
    block: 'npcYoungManC',
    parts: { hair: tones('#503828', 4), skin: TAN, outfit: tones('#606850', 4), outfit2: tones('#504838', 4), boots: ['#282018'] },
  },

  // ------------------------------------------------------------------ Episode guests and older selves
  c13_roshiMax: ROSHI_MAX,
  c14_roshiMax: ROSHI_MAX,
  c12_yamchaBall: {
    block: 'yamcha',
    parts: { outfit: tones('#f4f4f0', 4), outfit2: tones('#202030', 4), boots: tones('#202030', 2) },
    overlay: { ...cap('#202030', YAMCHA_CAP, '#f0f0f0'), erase: ['#000000'], eraseDepth: 3 },
  },
  c13_yurin: {
    block: 'chichi',
    parts: { hair: ['#382050', '#8050a0'], outfit: tones('#e0d0f0', 6), outfit2: tones('#6040a0', 4) },
    recolor: { '#d66300': '#8060b8', '#ff9418': '#a888d8', '#ffd642': '#d8c8f0' },
  },
  c13_baba: {
    block: 'npcOldWoman',
    parts: { outfit: tones('#202020', 3), outfit2: tones('#282028', 5), boots: ['#101010', '#382830'] },
    overlay: witchHat('#503080', { down: [-7, -1], left: [-10, -2], up: [-7, -1] }),
  },
  c12_barry: {
    block: 'npcYoungManB',
    parts: { hair: tones('#e8c860', 5), outfit: tones('#f0f0f0', 4), outfit2: tones('#e8e8e8', 4) },
  },
  c12_director: {
    block: 'npcYoungMan',
    parts: { skin: TAN, outfit: tones('#f0c040', 4), outfit2: tones('#506078', 4) },
    overlay: cap('#402818', TOWNSMAN_CAP, '#c8a040'),
  },
  c12_cocoa: {
    block: 'npcWoman',
    parts: { hair: tones('#704020', 4), outfit: tones('#f070a0', 3), outfit2: ['#c05080'] },
  },

  // ------------------------------------------------------------------ Bulma's party and West City errands (chapter 2)
  c01_kid: {
    block: 'npcLittleGirl',
    parts: { hair: tones('#e08040', 4), outfit: tones('#f8d040', 4), outfit2: tones('#4060c0', 2), boots: ['#e8e8e8'] },
  },
  c02_chef: {
    block: 'npcTough',
    parts: { outfit: tones('#f8f8f8', 6), outfit2: tones('#383838', 3) },
    overlay: toque({ down: [-7, -2], left: [-7, -2], up: [-8, -2] }),
  },
  c02_driver: {
    block: 'npcPoliceman',
    parts: { outfit: ['#101018', '#181c28', '#202838', '#384058'], boots: ['#101010', '#282828'] },
  },
  c02_ramenChef: {
    block: 'krillin',
    parts: { outfit: tones('#f0f0f0', 4), outfit2: tones('#c03030', 3), boots: tones('#c03030', 3), emblem: tones('#f0f0f0', 4) },
    overlay: {
      // Ramen-shop hachimaki: a white headband with a red sun, knotted at the back.
      palette: { O: '#909098', W: '#f8f8f8', V: '#d0d0d8', R: '#d03030' },
      rows: {
        down: ['OWWWWWRWWWWWO', 'OVVVVVVVVVVVO'],
        left: ['OWWWWWWWWWWWOO.', 'OVVVVVVVVVVVOWO', '............OWO', '.............O.'],
        up: ['OWWWWWWWWWWWO', 'OVVVVVOOVVVVO', '.....OWWO....', '....OW..WO...'],
      },
      offset: { down: [-6, 4], left: [-6, 4], up: [-6, 4] },
    },
  },
  c02_steward: {
    block: 'npcPoliceman',
    parts: { outfit: ['#2848a0', '#c8c8d0', '#e8e8f0', '#f8f8f8'], boots: ['#202020', '#383838'] },
  },

  // ------------------------------------------------------------------ Generic townsfolk
  // townsman, townswoman and oldMan replace the built-in LoG2 wiring so the sprite wears the same
  // colours as the dialogue portrait; kidNpc, police and scientist already match theirs.
  townsman: {
    block: 'npcYoungMan',
    parts: { hair: tones('#704828', 4), outfit: tones('#4878b8', 4), outfit2: tones('#506078', 4), boots: ['#281c10', '#382818'] },
  },
  townswoman: {
    block: 'npcWoman',
    // A saturated ramp topped by the spec's #f0a040: the plain tones() highlight sits too close to her skin.
    parts: { hair: tones('#a05028', 4), outfit: ['#a05010', '#e08020', '#f0a040'], outfit2: ['#904810'], accent: ['#f0d040'] },
  },
  oldMan: {
    block: 'npcOldMan',
    parts: { outfit: tones('#808060', 3) },
  },
  farmer: {
    block: 'npcYoungMan',
    parts: { skin: DARK_SKIN, outfit: tones('#a07848', 4), outfit2: tones('#4868a0', 4), boots: ['#2a1a0c', '#503018'] },
    overlay: strawHat('#d0b060', '#a05028', TOWNSMAN_BRIM),
  },
  reporter: {
    block: 'npcBobGirl',
    parts: { hair: tones('#e0a040', 4), outfit: tones('#c03040', 4), outfit2: ['#181820', '#202030'] },
  },
  waiter: {
    block: 'npcYoungManC',
    parts: { hair: BLACK_HAIR, outfit2: ['#101010', '#101010', '#202020', '#282828'], boots: ['#101010'] },
    recolor: { '#210084': '#101010' },
  },

  // ------------------------------------------------------------------ Satan City and Kame Island folk (world A)
  ea_suit: {
    block: 'npcYoungMan',
    parts: { hair: BLACK_HAIR, outfit: tones('#404858', 4), outfit2: tones('#383e4c', 4), boots: ['#181818', '#303030'] },
  },
  ea_girl: {
    block: 'npcWoman',
    parts: { hair: tones('#e070a0', 4), outfit: tones('#f0a8c8', 3), outfit2: ['#d080a0'] },
  },
  ea_granny: {
    block: 'npcOldWoman',
    parts: { outfit: tones('#8060a8', 3), outfit2: tones('#604880', 5) },
  },
  ea_jogger: {
    block: 'npcTough',
    parts: { hair: tones('#402818', 3), skin: TAN, outfit: tones('#40b060', 6), outfit2: tones('#f0f0f0', 3) },
  },
  ea_tourist: {
    block: 'npcToughB',
    parts: { outfit: tones('#f08838', 6), outfit2: tones('#c8b080', 3) },
    overlay: cap('#f0f0f0', TOUGH_CAP, '#e05030'),
  },
  ea_clerk: {
    block: 'npcBobGirlB',
    parts: { hair: tones('#402820', 4), outfit: tones('#f8f0e0', 4), outfit2: tones('#383848', 2) },
  },
  ea_butler: {
    block: 'npcYoungMan',
    parts: { hair: tones('#c0c0c0', 4), outfit: tones('#202028', 4), outfit2: tones('#202028', 4), boots: ['#101010', '#282828'] },
    recolor: { '#ad0810': '#e8e8e8' },
  },
  ea_student: {
    block: 'npcYoungManC',
    parts: { hair: BLACK_HAIR, outfit2: tones('#f0f0f0', 4) },
    recolor: { '#210084': '#c0c0c8' },
  },
  ea_student2: {
    block: 'npcGirl',
    parts: { hair: tones('#301810', 4), skin: TAN, outfit: tones('#f0f0f0', 3), outfit2: ['#a8a8b0', '#e0e0e8'] },
  },
  ea_sailor: {
    block: 'npcYoungManC',
    parts: { skin: ['#5a3418', '#a06838', '#c88858', '#e0a878'], outfit2: tones('#2848a0', 4) },
    overlay: cap('#f0f0f0', TOWNSMAN_CAP, '#2848a0'),
  },

  // ------------------------------------------------------------------ West City, desert, wasteland and snowfield folk (world B)
  eb_ccStaff: {
    block: 'npcBobGirl',
    parts: { hair: tones('#c89050', 4), outfit: tones('#f0f0f8', 4), outfit2: tones('#3868b0', 2) },
  },
  eb_ccGuard: {
    block: 'npcPoliceman',
    parts: { skin: TAN, outfit: ['#303848', '#2c4c88', '#3868b0', '#7898d0'] },
  },
  eb_ccTech: {
    block: 'npcGirl',
    parts: { hair: tones('#503020', 4), outfit: tones('#f0f0f0', 3), outfit2: tones('#404858', 2) },
  },
  eb_chef: {
    block: 'npcTough',
    parts: { outfit: tones('#f8f8f8', 6), outfit2: tones('#383840', 3) },
    overlay: headWrap('#f8f8f8', { down: [-7, -1], left: [-7, -1], up: [-8, -1] }),
  },
  eb_clerk: {
    block: 'npcYoungManB',
    parts: { hair: tones('#305080', 5), outfit: tones('#f0c030', 4), outfit2: tones('#303848', 4) },
  },
  eb_worker: {
    block: 'npcToughB',
    parts: { skin: DARK_SKIN, outfit: tones('#f08020', 6), outfit2: tones('#3a4a70', 3) },
    overlay: hardHat('#f0c020', TOUGH_HELMET),
  },
  eb_kidGirl: {
    block: 'npcLittleGirl',
    parts: { hair: tones('#e09040', 4), outfit: tones('#f06898', 4) },
  },
  eb_suit: {
    block: 'npcYoungManB',
    parts: { hair: BLACK_HAIR, outfit: tones('#404858', 4), outfit2: tones('#383e4c', 4), boots: ['#181818', '#303030'] },
  },
  eb_mechanic: {
    block: 'npcPoliceman',
    parts: { skin: TAN, outfit: tones('#e07030', 4) },
  },
  eb_gardener: {
    block: 'npcYoungMan',
    parts: { skin: TAN, outfit: tones('#58a048', 4), outfit2: tones('#806040', 4) },
    overlay: strawHat('#e0c070', '#58a048', TOWNSMAN_BRIM),
  },
  eb_granny: {
    block: 'npcOldWoman',
    parts: { outfit: tones('#b098c8', 3), outfit2: tones('#9070b0', 5) },
  },
  eb_geologist: {
    block: 'npcGirl',
    parts: { hair: tones('#805030', 4), skin: TAN, outfit: tones('#c0a070', 3), outfit2: tones('#706048', 2) },
  },
  eb_nomad: {
    block: 'npcOldManB',
    parts: { skin: DARK_SKIN, outfit: tones('#e8d8b0', 3) },
    overlay: turban('#f0e8d0', { down: [-6, -2], left: [-6, -2], up: [-6, -2] }),
  },
  eb_trader: {
    block: 'npcWoman',
    parts: { hair: tones('#402818', 4), skin: TAN, outfit: tones('#40a0a0', 3), outfit2: ['#e0c070'] },
  },
  eb_climber: {
    block: 'npcYoungMan',
    parts: { outfit: tones('#e04030', 4), outfit2: tones('#303848', 4) },
    overlay: beanie('#583420', { down: [-6, -2], left: [-6, -2], up: [-6, -2] }),
  },
  eb_ranger: {
    block: 'npcBobGirlB',
    parts: { hair: BLACK_HAIR, outfit: tones('#4a6a40', 4), outfit2: tones('#4a5a40', 2) },
  },
};

/**
 * Earthling looks for ids that double as hub or story enemies (bandits, punks, robbers, the stunt
 * crew, Tien's dojo students). Registered as defaults so the enemy cast group may re-dress them
 * without a duplicate-id clash; until then these fighter-block looks give them full attack sets.
 */
export const EARTHLING_ENEMY_LOOKS: Readonly<Record<string, SheetLook>> = {
  bandit: {
    block: 'yamcha',
    parts: { skin: TAN, outfit: tones('#806848', 4), outfit2: tones('#e0d0b0', 4), boots: ['#2a1a10', '#402818'] },
    overlay: { ...cap('#704828', YAMCHA_CAP, '#c03030'), erase: ['#000000'], eraseDepth: 3 },
  },
  banditChief: {
    block: 'hercule',
    // Hercule's trouser greys minus the eye whites and pupils (#5a5a5a, #adadad, #ffffff).
    parts: { outfit: tones('#383030', 3), boots: ['#201818', '#383030'] },
    recolor: { '#000000': '#5a1414', '#424242': '#282020', '#737373': '#3c3030', '#949494': '#504040', '#c6c6c6': '#685454', '#dedede': '#806868' },
  },
  c02_punk: {
    block: 'yamcha',
    parts: { hair: ['#205828'], skin: TAN, outfit: tones('#282828', 4), outfit2: tones('#c03030', 4), boots: ['#181818', '#202020'] },
  },
  c12_robber: {
    block: 'yamcha',
    parts: { outfit: tones('#383840', 4), outfit2: tones('#283048', 4), boots: ['#181818', '#202020'] },
  },
  c12_stuntman: {
    block: 'hercule',
    parts: { skin: tones('#60a060', 7), outfit: tones('#4c8c4c', 3) },
    recolor: { '#000000': '#203820', '#424242': '#1c301c', '#737373': '#284828', '#949494': '#386838', '#c6c6c6': '#4c804c', '#dedede': '#609860' },
  },
  c13_student: {
    block: 'krillin',
    parts: { outfit: tones('#48a058', 4), outfit2: tones('#f0f0f0', 3), boots: ['#303030', '#484848', '#606060'], emblem: tones('#48a058', 4) },
  },
};

registerSheetCast(EARTHLING_LOOKS);
registerSheetCast(EARTHLING_ENEMY_LOOKS, { defaults: true });
