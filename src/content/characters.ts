import type { Growth } from '../game/leveling';

/** Playable character ids. Guests are only playable in scripted relay fights. */
export type CharId = 'goku' | 'vegeta' | 'gohan' | 'trunks' | 'piccolo' | 'satan' | 'android17' | 'frieza';

export const MAIN_ROSTER: readonly CharId[] = ['goku', 'vegeta', 'gohan', 'trunks', 'piccolo', 'satan'];

/** A transformation reachable with the Z icon. */
export interface FormDef {
  id: string;
  name: string;
  /** Flat bonus to STR/POW/END while active. 'max' = stats become 100 (story god-mode). */
  bonus: number | 'max';
  /** Walk speed multiplier. */
  speed: number;
  /** EP drained per second (0 = none). */
  drain: number;
  /** HP regenerated per second as a fraction of max. */
  regen: number;
  /** HP lost per second as a fraction of max (Kaio-ken). */
  hpDrain?: number;
  /** Sprite id from CAST while transformed. */
  sprite: string;
  /** Aura colour. */
  aura: string;
  /** Auto-dodge chance (Ultra Instinct). */
  dodge?: number;
}

export const FORMS: Record<string, FormDef> = {
  ssj: { id: 'ssj', name: 'Super Saiyan', bonus: 10, speed: 2, drain: 2, regen: 0, sprite: '', aura: '#f8e048' },
  ssg: { id: 'ssg', name: 'Super Saiyan God', bonus: 14, speed: 2, drain: 1.5, regen: 0.004, sprite: 'gokuSSG', aura: '#f85070' },
  ssb: { id: 'ssb', name: 'Super Saiyan Blue', bonus: 18, speed: 2, drain: 2, regen: 0, sprite: '', aura: '#40c0f8' },
  ssbkk: { id: 'ssbkk', name: 'Blue Kaio-ken', bonus: 26, speed: 2.2, drain: 2.5, regen: 0, hpDrain: 0.012, sprite: 'gokuSSB', aura: '#f83838' },
  ssbe: { id: 'ssbe', name: 'SSB Evolved', bonus: 24, speed: 2, drain: 1.5, regen: 0, sprite: 'vegetaSSBE', aura: '#3058d8' },
  ultimate: { id: 'ultimate', name: 'Ultimate', bonus: 20, speed: 1.6, drain: 0.6, regen: 0.003, sprite: 'gohanUltimate', aura: '#f0f0ff' },
  rage: { id: 'rage', name: 'Super Saiyan Rage', bonus: 22, speed: 2, drain: 1.5, regen: 0, sprite: 'futureTrunksRage', aura: '#88d8ff' },
  unweighted: { id: 'unweighted', name: 'Weights Off', bonus: 6, speed: 2, drain: 1.2, regen: 0.01, sprite: 'piccoloUnweighted', aura: '#f8f8d0' },
  ui: { id: 'ui', name: 'Ultra Instinct', bonus: 'max', speed: 2.2, drain: 0, regen: 0.01, sprite: 'gokuUI', aura: '#d0d8ff', dodge: 0.5 },
  goldenFrieza: { id: 'goldenFrieza', name: 'Golden Form', bonus: 'max', speed: 2, drain: 0, regen: 0, sprite: 'goldenFrieza', aura: '#f8d040' },
};

/** Static definition of a playable character. */
export interface CharDef {
  id: CharId;
  name: string;
  /** Base sprite id (CAST). */
  sprite: string;
  /** Per-form sprite overrides when the form's own sprite is ''. */
  formSprites: Record<string, string>;
  /** Level-1 base stats (LoG2 datamined values for the matching role). */
  base: { hp: number; ep: number; str: number; pow: number; end: number };
  growth: Growth;
  /** Gate colour. */
  color: string;
  /** Charged melee id learned from Master Roshi (or on join). */
  charged: string;
  /** Idle animation flavour. */
  idle: 'pushups' | 'meditate' | 'sit' | 'leanSword' | 'kiBall' | 'flex' | 'stand';
  /** Walk speed in px/frame before forms. */
  walk: number;
  /** Uses a sword for melee (Trunks). */
  sword?: boolean;
}

/**
 * Role mapping from LoG2: Goku inherits LoG2-Goku's stat line; Gohan inherits LoG2-Gohan's
 * (best late-game growth); Vegeta, Trunks, Piccolo and Mr. Satan (Hercule) map 1:1.
 */
export const CHARACTERS: Record<CharId, CharDef> = {
  goku: {
    id: 'goku', name: 'Goku', sprite: 'goku', formSprites: { ssj: 'gokuSSJ', ssb: 'gokuSSB' },
    base: { hp: 100, ep: 20, str: 5, pow: 7, end: 6 },
    growth: { str: [255, 455], pow: [255, 455], end: [198, 398] },
    color: '#f08828', charged: 'flurryPunch', idle: 'pushups', walk: 1.0,
  },
  vegeta: {
    id: 'vegeta', name: 'Vegeta', sprite: 'vegeta', formSprites: { ssj: 'vegetaSSJ', ssb: 'vegetaSSB' },
    base: { hp: 105, ep: 20, str: 6, pow: 4, end: 6 },
    growth: { str: [234, 434], pow: [219, 419], end: [245, 445] },
    color: '#3048c8', charged: 'twoHandedSmash', idle: 'kiBall', walk: 1.0,
  },
  gohan: {
    id: 'gohan', name: 'Gohan', sprite: 'gohan', formSprites: { ssj: 'gohanSSJ' },
    base: { hp: 85, ep: 20, str: 3, pow: 5, end: 3 },
    growth: { str: [318, 518], pow: [302, 502], end: [256, 456] },
    color: '#60c8f0', charged: 'superKick', idle: 'sit', walk: 1.0,
  },
  trunks: {
    id: 'trunks', name: 'Trunks', sprite: 'futureTrunks', formSprites: { ssj: 'futureTrunksSSJ' },
    base: { hp: 110, ep: 20, str: 6, pow: 3, end: 4 },
    growth: { str: [287, 487], pow: [172, 372], end: [182, 382] },
    color: '#9058c8', charged: 'crossSlash', idle: 'leanSword', walk: 1.0, sword: true,
  },
  piccolo: {
    id: 'piccolo', name: 'Piccolo', sprite: 'piccolo', formSprites: {},
    base: { hp: 95, ep: 20, str: 4, pow: 4, end: 5 },
    growth: { str: [224, 424], pow: [245, 445], end: [208, 408] },
    color: '#48b048', charged: 'spinPunch', idle: 'meditate', walk: 1.0,
  },
  satan: {
    id: 'satan', name: 'Mr. Satan', sprite: 'mrSatan', formSprites: {},
    base: { hp: 50, ep: 20, str: 8, pow: 1, end: 6 },
    growth: { str: [64, 192], pow: [64, 192], end: [64, 192] },
    color: '#e03030', charged: 'superKick', idle: 'flex', walk: 1.0,
  },
  android17: {
    id: 'android17', name: 'Android 17', sprite: 'android17', formSprites: {},
    base: { hp: 120, ep: 30, str: 6, pow: 6, end: 6 },
    growth: { str: [260, 460], pow: [260, 460], end: [240, 440] },
    color: '#40a060', charged: 'spinPunch', idle: 'stand', walk: 1.0,
  },
  frieza: {
    id: 'frieza', name: 'Frieza', sprite: 'frieza', formSprites: {},
    base: { hp: 110, ep: 30, str: 6, pow: 7, end: 5 },
    growth: { str: [250, 450], pow: [270, 470], end: [220, 420] },
    color: '#c070e0', charged: 'superKick', idle: 'stand', walk: 1.0,
  },
};
