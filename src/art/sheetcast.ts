import { registerSheetCast } from './sheets';
// Content looks (recoloured / overlaid blocks per cast group); './sheetcast' alone resolves to this file.
import './sheetcast/index';

/**
 * Cast ids drawn straight from their own LoG2 sprite-sheet blocks: the characters (and generic
 * townsfolk / soldier roles) LoG2 itself has. Registered as defaults, so a content file may
 * re-dress any of these ids with a plain registerSheetCast call regardless of module load order;
 * further looks (recoloured / overlaid blocks for characters LoG2 lacks) are registered by content.
 */
registerSheetCast(
  {
    // Fighters
    goku: { block: 'goku' },
    gokuSSJ: { block: 'gokuSSJ', extra: [{ block: 'gokuSSJRaise', anims: ['raise', 'levelUp', 'cheer'] }] },
    vegeta: { block: 'vegeta' },
    vegetaSSJ: { block: 'vegetaSSJ' },
    futureTrunks: { block: 'futureTrunks' },
    futureTrunksSSJ: { block: 'futureTrunksSSJ' },
    piccolo: { block: 'piccolo' },
    piccoloUnweighted: { block: 'piccoloNoWeights' },
    krillinGi: { block: 'krillin' },
    tien: { block: 'tien' },
    yamcha: { block: 'yamcha' },
    mrSatan: { block: 'hercule' },
    android17: { block: 'android17' },
    android18: { block: 'android18' },
    frieza: { block: 'frieza' },
    chiaotzu: { block: 'chiaotzu' },
    // Friends and family
    bulma: { block: 'bulma' },
    chichi: { block: 'chichi' },
    roshi: { block: 'roshi' },
    drBrief: { block: 'drBriefs' },
    panchy: { block: 'panchy' },
    dende: { block: 'dende' },
    mrPopo: { block: 'popo' },
    korin: { block: 'korin' },
    yajirobe: { block: 'yajirobe' },
    c02_oolong: { block: 'oolong' },
    // Frieza Force rank and file
    frizaSoldier: { block: 'friezaSoldierA' },
    frizaSoldierB: { block: 'friezaSoldierB' },
    // Generic townsfolk roles
    townsman: { block: 'npcYoungMan' },
    townswoman: { block: 'npcWoman' },
    oldMan: { block: 'npcOldMan' },
    kidNpc: { block: 'npcChildB' },
    police: { block: 'npcPoliceman' },
    scientist: { block: 'npcScientist' },
  },
  { defaults: true },
);
