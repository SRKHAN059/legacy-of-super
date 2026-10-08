import { registerSheetCast, type SheetLook, type SheetOverlay } from '../sheets';

// ---------------------------------------------------------------------------------------------
// Colour ramps (darkest → lightest), matched to the DBS palette in src/content/cast.ts
// ---------------------------------------------------------------------------------------------

/** Royal-blue Tournament of Power gi (cast TOP_FIGHTER top #2848b8). */
const TOP_BLUE = ['#142060', '#1c3490', '#2848b8', '#4068e0'];
/** LoG2's own orange gi ramp (Goku's gi), reused wherever DBS wants that orange. */
const GI_ORANGE = ['#7b3100', '#ad4a00', '#d66300', '#ff7300'];
/** Piccolo-style purple gi Gohan trains in (cast gohan top #6038a8). */
const GOHAN_PURPLE = ['#2c1458', '#44247c', '#6038a8', '#7c58cc'];
/** Red sash / wristbands / undershirt. */
const SASH_RED = ['#5a1020', '#7a1c1c', '#b02828', '#d84040'];
/** Goku Black's charcoal gi (cast BLACK_GI top #383840) and black undershirt (#282830). */
const BLACK_GI = ['#26262e', '#383840', '#4c4c58', '#626272'];
const BLACK_UNDER = ['#0a0a0e', '#121216', '#1c1c22', '#282830'];

// ---------------------------------------------------------------------------------------------
// Hair recolours of the LoG2 Super Saiyan blocks
// ---------------------------------------------------------------------------------------------

/**
 * gokuSSJ hair → another colour. The SSJ hair's darkest shade #ad7b39 doubles as the skin
 * outline, so it is shifted to a dark tone that reads as an outline on both hair and skin.
 */
function gokuSsjHair(outline: string, dark: string, mid: string, light: string): Record<string, string> {
  return { '#ad7b39': outline, '#e7a542': dark, '#ffff00': mid, '#ffff39': light };
}

/** Super Saiyan Blue hair (cast gokuSSB hair #38b8f0) with blue eyes (#2060c0). */
const SSB_GOKU = {
  ...gokuSsjHair('#283868', '#2078c8', '#38b0f0', '#60d0f8'),
  '#107b00': '#1848a8',
  '#00ad18': '#3080e0',
};

// ---------------------------------------------------------------------------------------------
// Universe 6 Saiyan women, drawn from Android 18 (LoG2's only female fighter)
// ---------------------------------------------------------------------------------------------

/** Android 18's hair ramp (outline, dark, mid, light) → new hair colours. Her #ffffff highlights stay light. */
function hair18(outline: string, dark: string, mid: string, light: string): Record<string, string> {
  return { '#845218': outline, '#e7a542': dark, '#ffd642': mid, '#ffff7b': light };
}
const HAIR_BLACK_18 = hair18('#100c18', '#221e30', '#363248', '#4c4864');
const HAIR_GOLD_18 = hair18('#8c5010', '#d89828', '#f8d840', '#fff088');
const HAIR_KEFLA_18 = hair18('#4a7018', '#78b030', '#a8e050', '#d0f890');
const HAIR_LSSJ_18 = hair18('#2c6818', '#58a830', '#90e060', '#c8f8a0');
/** Eye colours (iris dark, iris light): Saiyan black, Super Saiyan green and berserk blank. */
const DARK_EYES_18: readonly [string, string] = ['#181820', '#383848'];
const SSJ_EYES_18: readonly [string, string] = ['#107b00', '#31ad00'];
const BLANK_EYES_18: readonly [string, string] = ['#e8f8e8', '#ffffff'];

/**
 * Caulifla's spiky crown: drawn over the top of 18's (recoloured) bob, it repaints the crown with
 * spiky strands and adds spike tips above it; the bob's side locks stay as the hair framing her face.
 * Grid row 0 is one row above the head anchor. `o` outline, `d` dark, `m` mid, `l` light.
 */
function spikyCrown18(o: string, d: string, m: string, l: string): SheetOverlay {
  return {
    palette: { o, d, m, l },
    rows: {
      down: [
        '....o..o...o...o...',
        '...oo.odo.odo.ooo..',
        '..odooddmoodmoddo..',
        '.oodmddmmdmmdmmdoo.',
        'odmmdmmlmmdmlmmdmdo',
        '.odmlmmdmmlmmdmmdo.',
        'odmmdmmlmmdmmlmmdmo',
        '.oodmmdmmdmmdmmdoo.',
        '..odmdmdmmdmdmmdo..',
        '..odmdmo..o.odmo...',
        '..odmmo......odo...',
        '...................',
        '....d..............',
        '....d..............',
      ],
      left: [
        '.....o...o...o.o....',
        '....oo..odoodoodo.o.',
        '....odooddmddmmdoodo',
        '...odmddmmdmmdmmdmo.',
        '...odmmlmmmdmmlmdmdo',
        '...odmlmmdmmlmmmdmo.',
        '...odmmdmmlmmdmmmdoo',
        '....odmmdmmmdmlmdmdo',
        '.....ooo.odmmdmmdmo.',
        '..........odmmdmmdo.',
        '..........odmdmmdmo.',
        '...........odmmdmo..',
        '...........odmdmmo..',
        '...........odmmdmo..',
        '...........odmdmo...',
        '...........odmmo....',
      ],
      up: [
        '......o..o..o..o....',
        '.....oo.odooodoo....',
        '....oodooddmddmdo...',
        '...odmdmmdmmdmmdoo..',
        '..odmmlmmmdmlmmdmdo.',
        '...odmmmlmmmmmlmdo..',
        '..odmlmmmmdmmmmmdmo.',
        '...odmmmmlmmmlmmdmo.',
        '....odmmmmmmmmmmdmo.',
        '....odmlmmmlmmmmdmo.',
        '....odmmmmmmmlmmdmo.',
        '....odmmmlmmmmmmdmo.',
        '....odmmmmmmlmmmdmo.',
        '....odmlmmmmmmmdmmo.',
        '....oodmmmmmmmmmdoo.',
        '......oodmmmmdmoo...',
      ],
    },
    offset: { down: [-10, -1], left: [-10, -1], up: [-10, -1] },
    skipAnims: ['raise', 'fly', 'ko'],
  };
}

/**
 * A Universe 6 Saiyan woman from Android 18: magenta top and skirt (cast #d04870), bare arms and
 * midriff (18's striped shirt becomes skin, its whites a near-white highlight so the swoosh trails
 * stay white), leggings as trousers, black boots.
 */
function android18Saiyan(hair: Record<string, string>, trousers: string, eyes: readonly [string, string] = DARK_EYES_18): SheetLook {
  return {
    block: 'android18',
    recolor: {
      ...hair,
      '#000000': trousers,
      '#007373': eyes[0],
      '#21bdff': eyes[1],
      '#5a5a5a': '#ce8463',
      '#737373': '#e79c84',
      '#949494': '#f0ac98',
      '#adadad': '#f8b8a4',
      '#c6c6c6': '#ffc8b8',
      '#dedede': '#ffd8cc',
      '#ffffff': '#fff0e8',
    },
    parts: {
      outfit: ['#6a1838', '#a02c50', '#d04870', '#f070a0'],
      boots: ['#181820', '#282830', '#383840'],
      emblem: ['#a02c50', '#d04870'],
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Kid Trunks, from Future Trunks
// ---------------------------------------------------------------------------------------------

/**
 * Removes Future Trunks's sword for the kid: the scabbard and hilt (#7b3100 / #ad4a00 / #d66300)
 * above the boots. 22 rows from the head anchor stops short of the boots, whose dark shade is #ad4a00.
 */
const NO_SWORD: SheetOverlay = { palette: {}, rows: {}, erase: ['#7b3100', '#ad4a00', '#d66300'], eraseDepth: 22 };

// ---------------------------------------------------------------------------------------------
// The Great Saiyaman, from Piccolo (turban → helmet, cape → red cape)
// ---------------------------------------------------------------------------------------------

/**
 * Saiyaman's head over Piccolo's: the turban becomes the black helmet (k outline, b/c/x shades),
 * the face below it human skin (s, S shade, O outline) behind a dark visor (v, V glint), with the
 * orange scarf (f, F shade) at the neck. Grids are cut to Piccolo's idle head at its anchor.
 */
const SAIYAMAN_HEAD: SheetOverlay = {
  palette: {
    k: '#0c0c10', b: '#1c1c24', c: '#2c2c38', x: '#4a4a58',
    s: '#f8c890', S: '#d89868', O: '#a06040',
    v: '#101018', V: '#7888b0',
    f: '#f08020', F: '#b05010',
  },
  rows: {
    down: [
      '........kkk.......',
      '......kkbbbkk.....',
      '.....kbbccbbbk....',
      '....kbccxxccbbk...',
      '...kbcxxccccbbbk..',
      '...kbcxcccccbbbk..',
      '...kbccccccbbbbk..',
      '..kkbccccccbbbbkk.',
      '..kbbkkkkkkkkkbbk.',
      '..kbkSsssssssSkbk.',
      '...kbvvvvvvvvvbk..',
      '...kbvVvvvvVvvbk..',
      '....kOSsssssSOk...',
      '......FffffffF....',
    ],
    left: [
      '........kkk.......',
      '......kkbbbkk.....',
      '.....kbbcccbbk....',
      '....kbcxxccbbbk...',
      '....kbcxccccbbbk..',
      '...kbccccccbbbbk..',
      '...kbcccccbbbbbk..',
      '...kbbccccbbbbbk..',
      '....kkkkkkbbbbbk..',
      '....kSssSkbbbbk...',
      '....vVvvvkbbbk....',
      '...OsssSkbbk......',
      '....OssSOk........',
      '.....FffF.........',
    ],
    up: [
      '........kkk.......',
      '......kkbbbkk.....',
      '.....kbbcccbbk....',
      '....kbccxxccbbk...',
      '...kbccxcccccbbk..',
      '...kbcccccccbbbk..',
      '...kbcccccccbbbk..',
      '..kkbcccccccbbbkk.',
      '..kbbccccccbbbbbk.',
      '..kbbbccccbbbbbbk.',
      '...kbbbbbbbbbbbk..',
      '...kkbbbbbbbbbkk..',
      '....kFffffffffFk..',
    ],
  },
  offset: { down: [-9, 0], left: [-9, 0], up: [-9, 0] },
};

// ---------------------------------------------------------------------------------------------
// Goku's heat suit (chapter 12): a full silver helmet over the (erased) hair and face
// ---------------------------------------------------------------------------------------------

/**
 * Closed heat-suit helmet: silver shell (k outline, d shade, w, h highlight) with a cyan face
 * plate (v, V glint) and an orange neck seal (o). Goku's #000000 is only his hair, pupils and
 * teleport streaks, so it is erased from the whole frame (upside-down KO frames included).
 */
const HEAT_HELMET: SheetOverlay = {
  palette: { k: '#586070', d: '#9aa2b0', w: '#c8d0d8', h: '#f0f4f8', v: '#2878b0', V: '#80d8f8', o: '#f08020' },
  rows: {
    down: [
      '....kkkkkk....',
      '..kkwwwwwwkk..',
      '.kwwhhwwwwwdk.',
      '.kwhwwwwwwwdk.',
      'kwwwwwwwwwwwdk',
      'kwkkkkkkkkkkdk',
      'kwkVVvvvvvvkdk',
      'kwkVvvvvvvvkdk',
      'kwkvvvvvvvvkdk',
      'kdkkkkkkkkkkdk',
      '.kddwwwwwwddk.',
      '..kkoooooookk.',
      '....kkkkkk....',
    ],
    left: [
      '....kkkkkk....',
      '..kkwwwwwwkk..',
      '.kwwhhwwwwwdk.',
      '.kwhwwwwwwwwdk',
      'kkkkkkwwwwwwdk',
      'kVVvvkwwwwwwdk',
      'kVvvvkwwwwwwdk',
      'kvvvvkwwwwwddk',
      'kvvvvkwwwwwdk.',
      'kkkkkkwwwwddk.',
      '.kdwwwwwwddk..',
      '..kkoooookk...',
      '....kkkkk.....',
    ],
    up: [
      '....kkkkkk....',
      '..kkwwwwwwkk..',
      '.kwwhhwwwwwdk.',
      '.kwhwwwwwwwdk.',
      'kwwwwwwwwwwwdk',
      'kwwwwwwwwwwwdk',
      'kwwwwwwwwwwwdk',
      'kwwwwwwwwwwddk',
      'kdwwwwwwwwwddk',
      'kddwwwwwwwdddk',
      '.kdddwwwwdddk.',
      '..kkoooooookk.',
      '....kkkkkk....',
    ],
  },
  offset: { down: [-4, 3], left: [-3, 3], up: [-9, 3] },
  erase: ['#000000'],
};

// ---------------------------------------------------------------------------------------------
// Raditz and Nappa (chapter 12 memories), from Vegeta's Saiyan armour
// ---------------------------------------------------------------------------------------------

/** Vegeta's armour, gloves and boots (#424242 → #ffffff) in Saiyan-saga brown; his blue bodysuit in dark violet. */
const SAIYAGA_ARMOUR = {
  '#424242': '#2a1c14',
  '#5a5a5a': '#3c2a1e',
  '#737373': '#4e382a',
  '#949494': '#5a4030',
  '#adadad': '#76563e',
  '#c6c6c6': '#94704e',
  '#dedede': '#b89468',
  '#ffffff': '#e8e8d0',
};
const SAIYAGA_SUIT = ['#201c2c', '#302840', '#443a58'];
/** Tanned Saiyan skin (cast SKIN_TAN #e8b078) for Vegeta's skin ramp. */
const SAIYAGA_SKIN = ['#704018', '#9a6838', '#c88c58', '#e0a870', '#f0c088'];

/** Raditz's knee-length mane hanging behind Vegeta's body (k black, h strand glint); his own flame hair stays. */
const RADITZ_MANE: SheetOverlay = {
  palette: { k: '#06060a', h: '#2a2a3a' },
  rows: {
    down: [
      '...k...............k...',
      '..kk...............kk..',
      '..kh...............hk..',
      '.kkk...............kkk.',
      '.khk...............khk.',
      'kkkk...............kkkk',
      'kkhk...............khkk',
      'khkk...............kkhk',
      'kkkk...............kkkk',
      'kkhk...............khkk',
      'khkk...............kkhk',
      'kkk.................kkk',
      'khk.................khk',
      'kk...................kk',
      'kk...................kk',
      'k.....................k',
    ],
    left: [
      '.kkkk.',
      '.kkhkk',
      'kkkkk.',
      'kkhkkk',
      'kkkkhk',
      'kkkkkk',
      '.kkhkk',
      '.kkkkk',
      '.khkkk',
      '.kkkhk',
      '.kkkkk',
      '..kkhk',
      '..kkkk',
      '..kkk.',
      '..k.k.',
      '....k.',
    ],
    up: [
      '.kkkkkkkkkkkkk.',
      'kkkhkkkkkkkhkkk',
      'kkhkkkkhkkkkhkk',
      'kkkkkhkkkkhkkkk',
      'khkkkkkkhkkkkhk',
      'kkkkhkkkkkkhkkk',
      'kkhkkkkhkkkkkkk',
      'kkkkkkkkkhkkkhk',
      'khkkhkkkkkkkkkk',
      'kkkkkkhkkkkhkkk',
      'kkkhkkkkkhkkkhk',
      '.kkkkkhkkkkkkk.',
      '.khkkkkkkkhkkk.',
      '..kkkk.kkk.kkk.',
      '..k.kk..kk..k..',
      '....k....k.....',
    ],
  },
  offset: { down: [-11, 11], left: [1, 12], up: [-7, 12] },
  skipAnims: ['ko', 'koFront', 'fly', 'flyUpLeft', 'swim'],
};

/**
 * Nappa's bald head (Tien's, minus the third eye, plus a drooping moustache) over Vegeta's body,
 * whose flame hair is erased above the shoulders. Skin t/q/m/s/S/O lightest → outline, eyes w/W/g, black #.
 */
const NAPPA_HEAD: SheetOverlay = {
  palette: {
    t: '#f0c088', q: '#e0a870', m: '#c88c58', s: '#b88048', S: '#9a6838', O: '#704018',
    w: '#c6c6c6', W: '#ffffff', g: '#737373', '#': '#000000',
  },
  rows: {
    down: [
      '......OOOOO......',
      '.....OsqqsmO.....',
      '....OqttttqmO....',
      '...OsqtttttsmO...',
      '...OqttqqqtqmO...',
      '...OqttttttqmO...',
      '...OqmqqtqqmmO...',
      '...OO##qtq##OO...',
      '..OOqm##O##mmOO..',
      '.Oqtmmw#q#wqmqmO.',
      '.OtmOtWgtgWqOmqO.',
      '..OqO#######OqO..',
      '...O##qttq##O....',
      '....#OOOOOO#.....',
    ],
    left: [
      '......OOOOO......',
      '.....OsqqssO.....',
      '....OqttttqsO....',
      '...OsqtttttqsO...',
      '...OqqtttttqsO...',
      '...OqqttttqqsO...',
      '...OqtttqqqqmO...',
      '...Omq##qqqmmO...',
      '...Om##mqqOOmO...',
      '...Ot#wtqOtqO....',
      '..OmtgWtqqmtO....',
      '..###Wqqmqm......',
      '..O###qmOOO......',
      '...#OOOO.........',
    ],
    up: [
      '......OOOOO......',
      '.....OsqqsmO.....',
      '....OqttttqmO....',
      '...OsqtttttsmO...',
      '...OqttttttqmO...',
      '...OqttttttqmO...',
      '...OqqttttqqmO...',
      '...OqqqqqqqqmO...',
      '..mOqqqqqqqsmOO..',
      '.mqtmqqqqqqmmqmO.',
      '.mtmOmqqqqmmOmqO.',
      '..mqOmmmmmmmOqO..',
      '...mOOmmmmmOOO...',
    ],
  },
  offset: { down: [-8, 4], left: [-10, 4], up: [-8, 4] },
  // Vegeta's flame hair (#000000 with #737373 glints) above the shoulders.
  erase: ['#000000', '#737373'],
  eraseDepth: 15,
};

// ---------------------------------------------------------------------------------------------
// Sadala Defense Force (Universe 6)
// ---------------------------------------------------------------------------------------------

/**
 * Vegeta's armour, gloves and boots (#424242 → #ffffff) as the navy Defense Force armour (cast
 * cabba top #405890). Each LoG2 eye is a #c6c6c6 / #ffffff / #c6c6c6 column beside the pupil, so
 * #c6c6c6 goes dark navy (the eye reads as Cabba's dark iris with a glint) and #ffffff stays
 * near-white (the glint, the swoosh trails and the Super Saiyan hair's top highlight).
 */
const CABBA_ARMOUR = {
  '#424242': '#101828',
  '#5a5a5a': '#141c34',
  '#737373': '#1c2844',
  '#949494': '#24345a',
  '#adadad': '#34487c',
  '#c6c6c6': '#34487c',
  '#dedede': '#8098c8',
  '#ffffff': '#e0e8f8',
};
/** Khaki undersuit (cast cabba under #d0c0a0) for Vegeta's blue bodysuit. */
const CABBA_SUIT = ['#8a7858', '#b0a07c', '#d0c0a0'];

export const SAIYAN_LOOKS: Readonly<Record<string, SheetLook>> = {
  // -------------------------------------------------------------------------------- Goku
  /** Super Saiyan God: base-form hair silhouette (LoG2 black hair is a flat #000000 mass, as are the pupils) in crimson. */
  gokuSSG: { block: 'goku', recolor: { '#000000': '#c81c40' } },
  gokuSSB: { block: 'gokuSSJ', recolor: SSB_GOKU, extra: [{ block: 'gokuSSJRaise', anims: ['raise', 'levelUp', 'cheer'] }] },
  gokuUI: {
    block: 'gokuSSJ',
    recolor: { ...gokuSsjHair('#4a4a68', '#8c8cac', '#b8b8d4', '#dcdcee'), '#107b00': '#58586e', '#00ad18': '#9090b0' },
    parts: { outfit: ['#6a2800', '#983c00', '#c45a10', '#e06c18'] },
    extra: [{ block: 'gokuSSJRaise', anims: ['raise', 'levelUp', 'cheer'] }],
  },
  /** Goku in the gi with Whis's symbol: a brighter blue undershirt, wristbands and boots. */
  gokuWhis: { block: 'goku', parts: { outfit2: ['#182890', '#2840b0', '#3058c8', '#4870e0'] } },

  // -------------------------------------------------------------------------------- Vegeta
  vegetaSSB: {
    block: 'vegetaSSJ',
    recolor: { '#ad7b39': '#845218', '#e7a542': '#1c70c0', '#ffff39': '#38b8f0', '#ffffbd': '#90e0fc', '#107b00': '#1848a8', '#31ad00': '#3080e0' },
  },
  vegetaSSBE: {
    block: 'vegetaSSJ',
    recolor: { '#ad7b39': '#845218', '#e7a542': '#102070', '#ffff39': '#2048b8', '#ffffbd': '#4878e0', '#107b00': '#102060', '#31ad00': '#183078' },
  },

  // -------------------------------------------------------------------------------- Gohan
  /** Adult Gohan: Yamcha's short spiky black hair and turtle-school body in Piccolo's purple gi. */
  gohan: { block: 'yamcha', parts: { outfit: GOHAN_PURPLE, outfit2: SASH_RED } },
  gohanSSJ: {
    block: 'gokuSSJ',
    parts: { outfit: GOHAN_PURPLE, outfit2: SASH_RED },
    extra: [{ block: 'gokuSSJRaise', anims: ['raise', 'levelUp', 'cheer'] }],
  },
  gohanUltimate: { block: 'yamcha', parts: { outfit: TOP_BLUE, outfit2: GI_ORANGE } },

  // -------------------------------------------------------------------------------- Future Trunks
  futureTrunksRage: {
    block: 'futureTrunksSSJ',
    recolor: { '#ad7b39': '#3a6088', '#e7a542': '#78b0d8', '#ffff39': '#c0ecfc', '#107b00': '#1c5890', '#31ad00': '#2080c0' },
  },

  // -------------------------------------------------------------------------------- Goku Black
  gokuBlack: { block: 'goku', parts: { outfit: BLACK_GI, outfit2: BLACK_UNDER } },
  blackRose: {
    block: 'gokuSSJ',
    recolor: { ...gokuSsjHair('#5a1840', '#c03880', '#f070b0', '#f8a0d0'), '#107b00': '#505060', '#00ad18': '#808090' },
    parts: { outfit: BLACK_GI, outfit2: BLACK_UNDER },
    extra: [{ block: 'gokuSSJRaise', anims: ['raise', 'levelUp', 'cheer'] }],
  },

  // -------------------------------------------------------------------------------- Vegito
  vegitoBlue: {
    block: 'gokuSSJ',
    recolor: SSB_GOKU,
    parts: { outfit: ['#182a70', '#203c98', '#3050b8', '#4c6ad8'], outfit2: GI_ORANGE },
    extra: [{ block: 'gokuSSJRaise', anims: ['raise', 'levelUp', 'cheer'] }],
  },

  // -------------------------------------------------------------------------------- Kids
  /** Goten: kid Goku, i.e. LoG2 Goku at three-quarter scale. */
  goten: { block: 'goku', scale: 0.75 },
  /** Kid Trunks: Future Trunks at three-quarter scale without the sword, in his navy jacket with grey-white boots. */
  trunksKid: {
    block: 'futureTrunks',
    scale: 0.75,
    parts: { outfit: ['#142840', '#1c3c60', '#285080', '#3c6aa0'], outfit2: ['#141c30', '#1c2840', '#283850', '#344866', '#405878', '#50688a'] },
    recolor: { '#ad4a00': '#9898a4', '#ffd642': '#e0e0e8' },
    overlay: NO_SWORD,
  },
  /**
   * The Commeson's copy of kid Trunks (chapter 8): kid Trunks in goo purples (cast skin #b868d8,
   * lilac hair #d8a0f0, vest #7a3098) with a yellow belt and glowing yellow eyes. #ffffff is his
   * eye white, the hair's glints and the swoosh trails, so all three take the pale goo yellow.
   */
  c08_gooTrunks: {
    block: 'futureTrunks',
    scale: 0.75,
    parts: {
      hair: ['#8a50a8', '#b070d0', '#d8a0f0', '#f0d0ff'],
      skin: ['#6a2c88', '#7a3898', '#8a44a8', '#a85cc8', '#b868d8', '#c87ce4'],
      outfit: ['#3e1458', '#4e1c68', '#62247e', '#7a3098'],
      outfit2: ['#4e1c68', '#62247e', '#7a3098', '#8a40a8', '#9a50c0', '#b470d8'],
    },
    recolor: {
      '#000000': '#4e1c68',
      '#ffffff': '#f8f0a0',
      '#dedede': '#c890e0',
      '#2184ff': '#f8f070',
      '#ad4a00': '#a870c8',
      '#ffd642': '#d8a0f0',
    },
    overlay: NO_SWORD,
  },
  c08_gooGoten: {
    block: 'goku',
    scale: 0.75,
    recolor: { '#000000': '#5a2078', '#adadad': '#d8d060', '#ffffff': '#f8f070', '#5a5a5a': '#a09030' },
    parts: {
      skin: ['#6a2c88', '#7a3898', '#8a44a8', '#9a50b8', '#a85cc8', '#b868d8', '#c87ce4', '#d898f0'],
      outfit: ['#5a2078', '#7a3098', '#9a50c0', '#b470d8'],
      outfit2: ['#3e1458', '#4e1c68', '#62247e', '#7a3098'],
    },
  },

  // -------------------------------------------------------------------------------- Universe 6
  /** Cabba: Vegeta's flame hair and Saiyan armour as the Sadala Defense Force uniform (navy armour, khaki suit). */
  cabba: { block: 'vegeta', recolor: CABBA_ARMOUR, parts: { outfit: CABBA_SUIT } },
  cabbaSSJ: { block: 'vegetaSSJ', recolor: CABBA_ARMOUR, parts: { outfit: CABBA_SUIT } },
  /** Sadala Defense Force trooper: Yamcha's spiky black hair in the navy-and-khaki uniform. */
  c13_sadalaGuard: {
    block: 'yamcha',
    parts: { outfit: ['#1c2844', '#2c3e6c', '#405890', '#5470a8'], outfit2: ['#6a5a40', '#8a7858', '#b0a07c', '#d0c0a0'] },
  },
  c13_renso: {
    block: 'npcYoungManC',
    parts: {
      hair: ['#0c0c12', '#181820', '#262630', '#363644'],
      skin: ['#7a4818', '#c07850', '#d89070', '#e8b078'],
      outfit: ['#7a5820', '#a07830', '#c89848', '#e0b868'],
      outfit2: ['#262c3a', '#343c50', '#4a5468', '#5c6880'],
    },
  },
  c13_sadalan: {
    block: 'npcYoungMan',
    parts: {
      hair: ['#0c0c12', '#181820', '#262630', '#363644'],
      skin: ['#7a4818', '#c07850', '#d89070', '#e8b078'],
      outfit: ['#3a4428', '#4e5c36', '#6a7a50', '#84966a'],
      outfit2: ['#2c2620', '#3c342a', '#504838', '#645a48'],
    },
  },
  c13_sadalanF: { block: 'npcGirlB', recolor: { '#7b3100': '#2a2a34' }, parts: { outfit: ['#7a5028', '#c08850', '#d8a870'] } },
  kale: android18Saiyan(HAIR_BLACK_18, '#a02c50'),
  caulifla: { ...android18Saiyan(HAIR_BLACK_18, '#58284c'), overlay: spikyCrown18('#100c18', '#221e30', '#363248', '#4c4864') },
  c13_cauliflaSSJ: { ...android18Saiyan(HAIR_GOLD_18, '#58284c', SSJ_EYES_18), overlay: spikyCrown18('#8c5010', '#d89828', '#f8d840', '#fff088') },
  kefla: { ...android18Saiyan(HAIR_KEFLA_18, '#58284c', SSJ_EYES_18), overlay: spikyCrown18('#4a7018', '#78b030', '#a8e050', '#d0f890') },
  /** Berserk / Legendary Super Saiyan Kale: hulking (1.25x), blank-eyed, with a wild green mane. */
  kaleLSSJ: { ...android18Saiyan(HAIR_LSSJ_18, '#a02c50', BLANK_EYES_18), overlay: spikyCrown18('#2c6818', '#58a830', '#90e060', '#c8f8a0'), scale: 1.25 },
  c13_kaleBerserk: { ...android18Saiyan(HAIR_LSSJ_18, '#a02c50', BLANK_EYES_18), overlay: spikyCrown18('#2c6818', '#58a830', '#90e060', '#c8f8a0'), scale: 1.25 },

  // -------------------------------------------------------------------------------- Saiyan-saga memories
  c12_raditz: {
    block: 'vegeta',
    recolor: SAIYAGA_ARMOUR,
    parts: { outfit: SAIYAGA_SUIT, skin: SAIYAGA_SKIN },
    overlay: RADITZ_MANE,
  },
  /** Giant Nappa: a boss "larger than life", so the sprite is drawn at 1.5x. */
  c12_nappa: {
    block: 'vegeta',
    recolor: SAIYAGA_ARMOUR,
    parts: { outfit: SAIYAGA_SUIT, skin: SAIYAGA_SKIN },
    overlay: NAPPA_HEAD,
    scale: 1.5,
  },

  // -------------------------------------------------------------------------------- Casual and disguised
  /**
   * The Great Saiyaman: Piccolo's caped body in the green suit (cast top #2a8a3a) over a black
   * undersuit, white gloves, belt and boots, red cape, with SAIYAMAN_HEAD over the turbaned head.
   */
  c12_saiyaman: {
    block: 'piccolo',
    parts: {
      outfit: ['#143a1c', '#1e6a2a', '#2a8a3a'],
      outfit2: ['#4a0c10', '#6a1414', '#8a1c1c', '#a82424', '#c02c2c', '#d84040', '#e85a5a'],
      skin: ['#18181c', '#28282e', '#3a3a44'],
      skin2: ['#a0a0a8', '#d0d0d8', '#e8e8f0', '#ffffff'],
      sash: ['#b0b0b8', '#d8d8e0', '#f0f0f0'],
      boots: ['#b8b8c0', '#e8e8e8'],
      turbanGem: ['#0c0c10', '#1c1c24', '#2c2c38'],
    },
    overlay: SAIYAMAN_HEAD,
  },
  /**
   * Vegeta off duty: the armour plate, gloves and boots become his pink shirt (cast #d06080), the
   * blue bodysuit cream trousers and sleeves. #737373 is also his hair's glint, so it goes a
   * near-neutral dark; #c6c6c6 / #ffffff are also his eyes, so the shirt takes them as its deep
   * shade and a pale highlight and the eyes stay dark with a light glint instead of turning pink.
   */
  vegetaCasual: {
    block: 'vegeta',
    recolor: {
      '#424242': '#3a1020', '#5a5a5a': '#4a1828', '#737373': '#3a2a32', '#949494': '#8a2c48',
      '#adadad': '#a83c5c', '#c6c6c6': '#7a2440', '#dedede': '#e888a8', '#ffffff': '#f8c8d8',
    },
    parts: { outfit: ['#a09880', '#c8c0a8', '#e8e0c8'] },
  },
  /** Goku in the heat-protective suit for the planet's core: silver suit, orange belt, gloves and boots, closed helmet. */
  c12_heatSuit: {
    block: 'goku',
    parts: { outfit: ['#7a8290', '#a8b0bc', '#d8dce4', '#f0f2f6'], outfit2: ['#904008', '#c05810', '#f08020', '#f8a048'] },
    overlay: HEAT_HELMET,
  },
  /** Gohan the scholar: the LoG2 scientist (big round glasses, white coat) with black hair and dark trousers. */
  gohanSuit: {
    block: 'npcScientist',
    parts: {
      hair: ['#0c0c12', '#181820', '#262630', '#363644'],
      outfit2: ['#202028', '#2c2c38', '#3c3c4c', '#4c4c60'],
      accent: ['#283048', '#3c4868'],
    },
  },
};

registerSheetCast(SAIYAN_LOOKS);
