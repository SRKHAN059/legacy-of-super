import type { HumanoidSpec } from '../art/humanoid';

const SKIN = '#f8c890';
const SKIN_TAN = '#e8b078';
const SKIN_DARK = '#a86838';
const NAMEK = '#68b848';

const GOKU_GI = {
  top: '#f07818', topStyle: 'gi', under: '#2848b8', sleeves: 'short', belt: '#2848b8', pants: '#f07818',
  boots: '#2848b8', bootTrim: '#d83020', wrist: '#2848b8', emblem: '#f8f0d8',
} as const;
const VEGETA_SUIT = {
  top: '#f0f0f0', topStyle: 'armor', under: '#2838a0', sleeves: 'long', pants: '#2838a0', boots: '#f0f0f0', bootTrim: '#e0c040', wrist: '#f0f0f0', face: 'stern',
} as const;
const BLACK_GI = {
  top: '#383840', topStyle: 'gi', under: '#282830', sleeves: 'short', belt: '#b03050', pants: '#383840', boots: '#e8e8e8', wrist: '#282830', earring: '#58e080',
} as const;
const ZAMASU_ROBE = {
  top: '#e8e0f0', topStyle: 'robe', under: '#305830', sleeves: 'none', belt: '#d0a030', pants: '#305830', boots: '#d0a030', earring: '#58e080', ears: 'pointed',
} as const;
const PRIDE = {
  top: '#c02828', topStyle: 'suit', under: '#202020', sleeves: 'long', pants: '#202020', boots: '#f0f0f0', bootTrim: '#c02828',
} as const;
const TOP_FIGHTER = {
  top: '#2848b8', topStyle: 'gi', under: '#f07818', sleeves: 'short', belt: '#f07818', pants: '#2848b8', boots: '#f07818', bootTrim: '#2848b8',
} as const;

/** Sprite specs for every humanoid in the game, keyed by sprite id. */
export const CAST: Record<string, HumanoidSpec> = {
  // ---------------------------------------------------------------- playable + forms
  goku: { body: 'male', skin: SKIN, hair: 'goku', hairColor: '#202030', ...GOKU_GI },
  gokuSSJ: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#f8e048', eye: '#208868', ...GOKU_GI },
  gokuSSG: { body: 'male', skin: SKIN, hair: 'goku', hairColor: '#d02848', eye: '#c02040', ...GOKU_GI },
  gokuSSB: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#38b8f0', eye: '#2060c0', ...GOKU_GI },
  gokuUI: { body: 'male', skin: SKIN, hair: 'goku', hairColor: '#c8c8e0', eye: '#9090b0', ...GOKU_GI, top: '#d06818', pants: '#d06818', topStyle: 'vest', sleeves: 'none' },
  gokuWhis: { body: 'male', skin: SKIN, hair: 'goku', hairColor: '#202030', ...GOKU_GI, under: '#3058c8', emblem: '#f0f0f0' },
  vegeta: { body: 'male', skin: SKIN, hair: 'vegeta', hairColor: '#202030', ...VEGETA_SUIT },
  vegetaSSJ: { body: 'male', skin: SKIN, hair: 'vegeta', hairColor: '#f8e048', eye: '#208868', ...VEGETA_SUIT },
  vegetaSSB: { body: 'male', skin: SKIN, hair: 'vegeta', hairColor: '#38b8f0', eye: '#2060c0', ...VEGETA_SUIT },
  vegetaSSBE: { body: 'male', skin: SKIN, hair: 'vegeta', hairColor: '#2048b8', eye: '#183078', ...VEGETA_SUIT },
  vegetaCasual: { body: 'male', skin: SKIN, hair: 'vegeta', hairColor: '#202030', top: '#d06080', topStyle: 'shirt', sleeves: 'short', pants: '#e8e0c8', boots: '#704020', face: 'stern' },
  gohan: { body: 'male', skin: SKIN, hair: 'gohan', hairColor: '#202030', top: '#6038a8', topStyle: 'gi', under: '#e8e0f0', sleeves: 'short', belt: '#d03028', pants: '#6038a8', boots: '#704020', wrist: '#d03028' },
  gohanSSJ: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#f8e048', eye: '#208868', top: '#6038a8', topStyle: 'gi', under: '#e8e0f0', sleeves: 'short', belt: '#d03028', pants: '#6038a8', boots: '#704020', wrist: '#d03028' },
  gohanSuit: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#202030', top: '#f0f0f0', topStyle: 'shirt', sleeves: 'long', under: '#f0f0f0', belt: '#383838', pants: '#383848', boots: '#382818', face: 'shades' },
  gohanUltimate: { body: 'male', skin: SKIN, hair: 'gohan', hairColor: '#202030', eye: '#1a1a40', ...TOP_FIGHTER },
  futureTrunks: { body: 'male', skin: SKIN, hair: 'trunks', hairColor: '#a898d8', top: '#283050', topStyle: 'coat', under: '#383838', sleeves: 'long', belt: '#e0c040', pants: '#383838', boots: '#a87838', scarf: '#e86048', sword: true },
  futureTrunksSSJ: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#f8e048', eye: '#208868', top: '#283050', topStyle: 'coat', under: '#383838', sleeves: 'long', belt: '#e0c040', pants: '#383838', boots: '#a87838', scarf: '#e86048', sword: true },
  futureTrunksRage: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#b8e8f8', eye: '#2080c0', top: '#283050', topStyle: 'coat', under: '#383838', sleeves: 'long', belt: '#e0c040', pants: '#383838', boots: '#a87838', scarf: '#e86048', sword: true },
  piccolo: { body: 'male', skin: NAMEK, hair: 'turban', hairColor: '#f0f0f0', accent: '#6038a8', top: '#6038a8', topStyle: 'gi', under: '#6038a8', sleeves: 'none', belt: '#4898d8', pants: '#6038a8', boots: '#704020', wrist: '#b02838', cape: '#f0f0f0', ears: 'pointed', face: 'stern' },
  piccoloUnweighted: { body: 'male', skin: NAMEK, hair: 'antennae', hairColor: '#58a838', top: '#6038a8', topStyle: 'gi', under: '#6038a8', sleeves: 'none', belt: '#4898d8', pants: '#6038a8', boots: '#704020', wrist: '#b02838', ears: 'pointed', face: 'stern' },
  mrSatan: { body: 'big', skin: SKIN_TAN, hair: 'afro', hairColor: '#201810', top: '#f0f0f0', topStyle: 'gi', under: '#f0f0f0', sleeves: 'none', belt: '#e0c040', pants: '#f0f0f0', boots: '#e0c040', face: 'mustache' },
  android17: { body: 'male', skin: SKIN, hair: 'long', hairColor: '#181820', top: '#486838', topStyle: 'shirt', under: '#486838', sleeves: 'long', belt: '#382818', pants: '#4a5838', boots: '#382818', scarf: '#f08020', eye: '#2878c8' },
  android17Top: { body: 'male', skin: SKIN, hair: 'long', hairColor: '#181820', ...TOP_FIGHTER, scarf: '#f08020', eye: '#2878c8' },
  frieza: { body: 'male', skin: '#f0f0f8', hair: 'dome', hairColor: '#a050c8', accent: '#a050c8', top: '#f0f0f8', topStyle: 'suit', under: '#f0f0f8', sleeves: 'none', pants: '#f0f0f8', boots: '#f0f0f8', tail: '#f0f0f8', eye: '#c02040', face: 'stern' },
  goldenFrieza: { body: 'male', skin: '#f8d040', hair: 'dome', hairColor: '#a050c8', accent: '#a050c8', top: '#f8d040', topStyle: 'suit', under: '#f8d040', sleeves: 'none', pants: '#f8d040', boots: '#f8d040', tail: '#f8d040', eye: '#c02040', face: 'stern' },

  // ---------------------------------------------------------------- family & friends
  bulma: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#40a8d8', top: '#e04878', topStyle: 'dress', sleeves: 'none', pants: '#e04878', boots: '#e8e8f0' },
  futureBulma: { body: 'female', skin: SKIN, hair: 'ponytail', hairColor: '#40a8d8', accent: '#e0e0e0', top: '#606850', topStyle: 'shirt', sleeves: 'long', pants: '#504838', boots: '#382818' },
  chichi: { body: 'female', skin: SKIN, hair: 'bun', hairColor: '#202030', top: '#d05050', topStyle: 'dress', under: '#e0c070', sleeves: 'long', pants: '#d05050', boots: '#583828' },
  videl: { body: 'female', skin: SKIN, hair: 'short', hairColor: '#202030', top: '#f0f0f0', topStyle: 'shirt', sleeves: 'short', pants: '#283858', boots: '#d03030' },
  pan: { body: 'child', skin: SKIN, hair: 'short', hairColor: '#202030', top: '#f8a0b0', topStyle: 'dress', sleeves: 'none', pants: '#f8a0b0', boots: '#f0f0f0' },
  goten: { body: 'child', skin: SKIN, hair: 'goku', hairColor: '#202030', ...GOKU_GI, emblem: undefined },
  trunksKid: { body: 'child', skin: SKIN, hair: 'trunksKid', hairColor: '#a898d8', top: '#285080', topStyle: 'vest', under: '#f08030', sleeves: 'long', belt: '#e0c040', pants: '#285080', boots: '#d8d8d8' },
  krillin: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#202030', top: '#3858a8', topStyle: 'shirt', sleeves: 'short', belt: '#202020', pants: '#3858a8', boots: '#202020', face: 'gentle' },
  krillinGi: { body: 'male', skin: SKIN, hair: 'bald', hairColor: '#202030', ...GOKU_GI, emblem: undefined, face: 'gentle' },
  android18: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#f0d878', top: '#283048', topStyle: 'vest', under: '#e8e8e8', sleeves: 'long', pants: '#3858a0', boots: '#783828', eye: '#2878c8' },
  tien: { body: 'big', skin: SKIN, hair: 'bald', hairColor: '#202030', top: '#48a058', topStyle: 'vest', under: '#48a058', sleeves: 'none', belt: '#d03030', pants: '#f0f0f0', boots: '#202020', face: 'thirdEye' },
  yamcha: { body: 'male', skin: SKIN, hair: 'spiky', hairColor: '#202030', ...GOKU_GI, emblem: undefined },
  roshi: { body: 'male', skin: SKIN, hair: 'bald', hairColor: '#f0f0f0', top: '#e88838', topStyle: 'shirt', sleeves: 'short', pants: '#f0e8c0', boots: '#806040', face: 'beard' },
  chiaotzu: { body: 'child', skin: '#f8e0e0', hair: 'bald', hairColor: '#f0f0f0', top: '#e8d040', topStyle: 'robe', under: '#d03838', sleeves: 'long', pants: '#d03838', boots: '#202020' },
  majinBuu: { body: 'big', skin: '#f8a0c0', hair: 'antennae', hairColor: '#f8a0c0', top: '#6838a0', topStyle: 'vest', under: '#6838a0', sleeves: 'none', belt: '#e0c040', pants: '#f0f0f0', boots: '#e0c040', face: 'gentle' },
  drBrief: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#a8a8b8', top: '#f0f0f0', topStyle: 'coat', under: '#506078', sleeves: 'long', pants: '#506078', boots: '#382818', face: 'mustache' },
  panchy: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#f8e090', top: '#f8a8c8', topStyle: 'dress', sleeves: 'short', pants: '#f8a8c8', boots: '#f0f0f0', face: 'gentle' },
  dende: { body: 'child', skin: NAMEK, hair: 'antennae', hairColor: '#58a838', top: '#f0f0f0', topStyle: 'robe', under: '#5070c8', sleeves: 'none', pants: '#f0f0f0', boots: '#704020', ears: 'pointed' },
  mrPopo: { body: 'male', skin: '#283048', hair: 'turban', hairColor: '#f0f0f0', accent: '#d03030', top: '#d03030', topStyle: 'vest', under: '#d03030', sleeves: 'none', pants: '#f0f0f0', boots: '#d03030', face: 'gentle' },
  yajirobe: { body: 'big', skin: SKIN, hair: 'spiky', hairColor: '#202030', top: '#c05028', topStyle: 'gi', under: '#c05028', sleeves: 'short', belt: '#e0c040', pants: '#c05028', boots: '#704020' },
  jaco: { body: 'child', skin: '#9080c8', hair: 'antennae', hairColor: '#c0b0f0', top: '#f0f0f0', topStyle: 'suit', under: '#303030', sleeves: 'long', pants: '#303030', boots: '#f0f0f0', eye: '#101010' },
  kingKai: { body: 'big', skin: '#3870c8', hair: 'antennae', hairColor: '#202020', top: '#202020', topStyle: 'robe', under: '#f0d040', sleeves: 'long', pants: '#202020', boots: '#f0d040', face: 'shades' },
  shenronAvatar: { body: 'big', skin: '#40a048', hair: 'catEars', hairColor: '#40a048', accent: '#f0e060', top: '#40a048', topStyle: 'suit', under: '#40a048', sleeves: 'none', pants: '#40a048', boots: '#40a048', eye: '#e02020', face: 'stern', tail: '#40a048' },
  pilaf: { body: 'child', skin: '#6880c0', hair: 'bald', hairColor: '#6880c0', top: '#f0e050', topStyle: 'robe', under: '#d03030', sleeves: 'long', pants: '#d03030', boots: '#402020', ears: 'pointed' },
  mai: { body: 'female', skin: SKIN, hair: 'long', hairColor: '#202030', top: '#383848', topStyle: 'shirt', sleeves: 'long', pants: '#383848', boots: '#202020' },
  shu: { body: 'child', skin: SKIN, hair: 'catEars', hairColor: '#605048', accent: '#a09080', top: '#405880', topStyle: 'suit', under: '#405880', sleeves: 'long', pants: '#405880', boots: '#202020' },
  futureMai: { body: 'female', skin: SKIN, hair: 'long', hairColor: '#202030', top: '#586048', topStyle: 'vest', under: '#383830', sleeves: 'long', pants: '#383830', boots: '#282018', face: 'stern' },
  resistance: { body: 'male', skin: SKIN_TAN, hair: 'short', hairColor: '#503828', top: '#606850', topStyle: 'vest', under: '#404838', sleeves: 'long', pants: '#504838', boots: '#282018' },
  korin: { body: 'child', skin: '#f0f0e8', hair: 'catEars', hairColor: '#f0f0e8', accent: '#f0b0b0', top: '#f0f0e8', topStyle: 'suit', under: '#f0f0e8', sleeves: 'none', pants: '#f0f0e8', boots: '#f0f0e8', tail: '#f0f0e8', face: 'gentle' },

  // ---------------------------------------------------------------- gods & angels
  beerus: { body: 'male', skin: '#9070c0', hair: 'catEars', hairColor: '#9070c0', accent: '#e8a0b0', top: '#202028', topStyle: 'robe', under: '#e0c040', sleeves: 'none', belt: '#e0c040', pants: '#c83838', boots: '#e0c040', wrist: '#e0c040', tail: '#9070c0', eye: '#e8e040', ears: 'pointed' },
  whis: { body: 'male', skin: '#90b8e0', hair: 'whis', hairColor: '#f0f0f0', top: '#a03050', topStyle: 'robe', under: '#202028', sleeves: 'long', belt: '#f0f0f0', pants: '#202028', boots: '#f0f0f0', halo: '#4890e0', face: 'gentle' },
  champa: { body: 'big', skin: '#8078c0', hair: 'catEars', hairColor: '#8078c0', accent: '#e8a0b0', top: '#202028', topStyle: 'robe', under: '#e0c040', sleeves: 'none', belt: '#e0c040', pants: '#3858a8', boots: '#e0c040', tail: '#8078c0', eye: '#e8e040', ears: 'pointed' },
  vados: { body: 'female', skin: '#80b0e0', hair: 'whis', hairColor: '#f0f0f0', top: '#284890', topStyle: 'robe', under: '#202028', sleeves: 'long', belt: '#f0f0f0', pants: '#202028', boots: '#f0f0f0', halo: '#4890e0', face: 'gentle' },
  supremeKai: { body: 'male', skin: '#c8a0e8', hair: 'mohawk', hairColor: '#f0f0f0', top: '#283878', topStyle: 'robe', under: '#d06818', sleeves: 'none', belt: '#58b0e0', pants: '#f0f0f0', boots: '#d06818', earring: '#58e080', ears: 'pointed' },
  oldKai: { body: 'male', skin: '#c8a0e8', hair: 'mohawk', hairColor: '#f0f0f0', top: '#c03030', topStyle: 'robe', under: '#283878', sleeves: 'long', pants: '#283878', boots: '#d06818', earring: '#58e080', ears: 'pointed', face: 'beard' },
  zeno: { body: 'child', skin: '#90a0e8', hair: 'bald', hairColor: '#90a0e8', top: '#e8c848', topStyle: 'robe', under: '#e05088', sleeves: 'long', belt: '#e05088', pants: '#f0f0f0', boots: '#e05088', ears: 'pointed', face: 'gentle' },
  grandPriest: { body: 'male', skin: '#90b8e0', hair: 'mohawk', hairColor: '#f0f0f0', top: '#283060', topStyle: 'robe', under: '#e0c040', sleeves: 'long', belt: '#e0c040', pants: '#283060', boots: '#e0c040', halo: '#4890e0', face: 'gentle' },
  gowasu: { body: 'male', skin: '#e0d0b0', hair: 'mohawk', hairColor: '#f0f0f0', top: '#e8e0f0', topStyle: 'robe', under: '#4868a8', sleeves: 'none', pants: '#4868a8', boots: '#d0a030', earring: '#58e080', ears: 'pointed', face: 'beard' },
  zamasu: { body: 'male', skin: '#78c868', hair: 'mohawk', hairColor: '#f0f0f0', ...ZAMASU_ROBE, face: 'stern' },
  gokuBlack: { body: 'male', skin: SKIN, hair: 'goku', hairColor: '#202030', ...BLACK_GI, face: 'stern' },
  blackRose: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#f070b0', eye: '#808090', ...BLACK_GI, face: 'stern' },
  fusedZamasu: { body: 'male', skin: '#78c868', hair: 'long', hairColor: '#f0f0f0', ...ZAMASU_ROBE, top: '#d0c8e0', eye: '#f04060', face: 'stern' },
  vegitoBlue: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#38b8f0', eye: '#2060c0', top: '#3050b8', topStyle: 'vest', under: '#f07818', sleeves: 'none', belt: '#f0f0f0', pants: '#f0f0f0', boots: '#e0c040', wrist: '#f07818', earring: '#f0d040' },

  // ---------------------------------------------------------------- Frieza Force
  frizaSoldier: { body: 'male', skin: '#80a858', hair: 'helmet', hairColor: '#585868', accent: '#38c0e0', top: '#e8e8d0', topStyle: 'armor', under: '#383870', sleeves: 'long', pants: '#383870', boots: '#e8e8d0', scouter: '#38e070' },
  frizaSoldierB: { body: 'male', skin: '#c07858', hair: 'helmet', hairColor: '#585868', accent: '#f04040', top: '#e8e8d0', topStyle: 'armor', under: '#583030', sleeves: 'long', pants: '#583030', boots: '#e8e8d0', scouter: '#f05050' },
  frizaSoldierC: { body: 'big', skin: '#7090c0', hair: 'bald', hairColor: '#7090c0', top: '#d8d8c0', topStyle: 'armor', under: '#285828', sleeves: 'none', pants: '#285828', boots: '#d8d8c0', scouter: '#40f070' },
  frizaElite: { body: 'male', skin: '#e0b0d0', hair: 'long', hairColor: '#e8e8e8', top: '#e8e8d0', topStyle: 'armor', under: '#382858', sleeves: 'long', pants: '#382858', boots: '#e8e8d0', scouter: '#40c0f0' },
  sorbet: { body: 'child', skin: '#5878d0', hair: 'bald', hairColor: '#5878d0', top: '#e8e8d0', topStyle: 'armor', under: '#383870', sleeves: 'long', pants: '#383870', boots: '#e8e8d0', scouter: '#40f070', face: 'stern' },
  tagoma: { body: 'big', skin: '#e8d0a8', hair: 'short', hairColor: '#e8e8e8', top: '#e8e8d0', topStyle: 'armor', under: '#583848', sleeves: 'none', pants: '#583848', boots: '#e8e8d0', face: 'stern' },
  shisami: { body: 'male', skin: '#b0c0d8', hair: 'long', hairColor: '#e8e8f0', top: '#e8e8d0', topStyle: 'armor', under: '#4060a0', sleeves: 'long', pants: '#4060a0', boots: '#e8e8d0', face: 'stern' },
  ginyu: { body: 'big', skin: '#9860c0', hair: 'catEars', hairColor: '#9860c0', accent: '#202020', top: '#e8e8d0', topStyle: 'armor', under: '#304088', sleeves: 'none', pants: '#304088', boots: '#e8e8d0', face: 'stern' },

  // ---------------------------------------------------------------- Universe 6
  cabba: { body: 'male', skin: SKIN, hair: 'vegeta', hairColor: '#202030', top: '#405890', topStyle: 'armor', under: '#d0c0a0', sleeves: 'short', pants: '#405890', boots: '#d0c0a0', face: 'gentle' },
  cabbaSSJ: { body: 'male', skin: SKIN, hair: 'ssj', hairColor: '#f8e048', eye: '#208868', top: '#405890', topStyle: 'armor', under: '#d0c0a0', sleeves: 'short', pants: '#405890', boots: '#d0c0a0' },
  hit: { body: 'big', skin: '#9070b8', hair: 'bald', hairColor: '#503070', top: '#383050', topStyle: 'coat', under: '#c8c0d8', sleeves: 'long', belt: '#202020', pants: '#383050', boots: '#202020', eye: '#d02040', face: 'stern' },
  frost: { body: 'male', skin: '#e0e8f8', hair: 'dome', hairColor: '#6878c8', accent: '#6878c8', top: '#e0e8f8', topStyle: 'suit', under: '#e0e8f8', sleeves: 'none', pants: '#e0e8f8', boots: '#e0e8f8', tail: '#e0e8f8', eye: '#d02040', face: 'gentle' },
  botamo: { body: 'big', skin: '#e8c050', hair: 'catEars', hairColor: '#e8c050', accent: '#f0e0b0', top: '#e8c050', topStyle: 'suit', under: '#5070c0', sleeves: 'none', belt: '#5070c0', pants: '#5070c0', boots: '#e8c050', face: 'gentle' },
  monaka: { body: 'child', skin: '#5870c8', hair: 'bald', hairColor: '#5870c8', top: '#e8e8e8', topStyle: 'suit', under: '#e8e8e8', sleeves: 'long', pants: '#e8e8e8', boots: '#d03030', eye: '#101010' },
  kale: { body: 'female', skin: SKIN, hair: 'ponytail', hairColor: '#202030', top: '#d04870', topStyle: 'vest', under: '#d04870', sleeves: 'none', belt: '#e0c040', pants: '#d04870', boots: '#202020' },
  kaleLSSJ: { body: 'big', skin: SKIN, hair: 'ssj', hairColor: '#90f070', eye: '#101010', top: '#d04870', topStyle: 'vest', under: '#d04870', sleeves: 'none', belt: '#e0c040', pants: '#d04870', boots: '#202020', face: 'stern' },
  caulifla: { body: 'female', skin: SKIN, hair: 'spikyTail', hairColor: '#202030', accent: '#d04870', top: '#d04870', topStyle: 'vest', under: '#202020', sleeves: 'none', belt: '#e0c040', pants: '#683058', boots: '#202020', face: 'stern' },
  kefla: { body: 'female', skin: SKIN, hair: 'spikyTail', hairColor: '#b0f070', accent: '#d04870', eye: '#208868', top: '#d04870', topStyle: 'vest', under: '#202020', sleeves: 'none', belt: '#e0c040', pants: '#683058', boots: '#202020', face: 'stern' },

  // ---------------------------------------------------------------- Tournament of Power
  jiren: { body: 'big', skin: '#b0a8a8', hair: 'bald', hairColor: '#b0a8a8', ...PRIDE, eye: '#101010', face: 'stern' },
  toppo: { body: 'big', skin: '#e0b090', hair: 'bald', hairColor: '#f0f0f0', ...PRIDE, face: 'mustache' },
  dyspo: { body: 'male', skin: '#a088c8', hair: 'rabbit', hairColor: '#a088c8', accent: '#f0d0f0', ...PRIDE, face: 'stern' },
  prideTrooper: { body: 'male', skin: '#d0b0a0', hair: 'helmet', hairColor: '#c02828', accent: '#202020', ...PRIDE },
  basil: { body: 'male', skin: '#a07858', hair: 'catEars', hairColor: '#a07858', accent: '#f0d0b0', top: '#3060a0', topStyle: 'vest', under: '#3060a0', sleeves: 'none', pants: '#202030', boots: '#202030', face: 'stern' },
  lavender: { body: 'male', skin: '#8060a8', hair: 'catEars', hairColor: '#8060a8', accent: '#e0c0f0', top: '#3060a0', topStyle: 'vest', under: '#3060a0', sleeves: 'none', pants: '#202030', boots: '#202030', face: 'stern' },
  bergamo: { body: 'big', skin: '#706070', hair: 'catEars', hairColor: '#706070', accent: '#d0b0c0', top: '#3060a0', topStyle: 'vest', under: '#3060a0', sleeves: 'none', pants: '#202030', boots: '#202030', face: 'stern' },
  ribrianne: { body: 'female', skin: SKIN, hair: 'braids', hairColor: '#f080b0', accent: '#f8f0a0', top: '#f8a0c8', topStyle: 'dress', sleeves: 'short', pants: '#f8a0c8', boots: '#f0f0f0', face: 'gentle' },
  gamisalas: { body: 'male', skin: '#c0a070', hair: 'mohawk', hairColor: '#706040', top: '#a05030', topStyle: 'vest', under: '#a05030', sleeves: 'none', pants: '#504030', boots: '#302010' },
  poacher: { body: 'male', skin: '#90a070', hair: 'helmet', hairColor: '#505048', accent: '#e0a030', top: '#686850', topStyle: 'armor', under: '#484838', sleeves: 'long', pants: '#484838', boots: '#302820', scouter: '#e0a030' },
  babarian: { body: 'big', skin: '#88a058', hair: 'mohawk', hairColor: '#503820', top: '#806040', topStyle: 'vest', under: '#806040', sleeves: 'none', belt: '#402010', pants: '#605030', boots: '#402010', face: 'stern' },
  universeFighter: { body: 'male', skin: '#c0b0e0', hair: 'spiky', hairColor: '#40a0a0', top: '#606880', topStyle: 'armor', under: '#384050', sleeves: 'long', pants: '#384050', boots: '#202028' },

  // ---------------------------------------------------------------- generic townsfolk & enemies
  townsman: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#704828', top: '#4878b8', topStyle: 'shirt', sleeves: 'short', pants: '#506078', boots: '#382818' },
  townswoman: { body: 'female', skin: SKIN, hair: 'ponytail', hairColor: '#a05028', accent: '#f0d040', top: '#f0a040', topStyle: 'dress', sleeves: 'short', pants: '#f0a040', boots: '#704020' },
  oldMan: { body: 'male', skin: SKIN, hair: 'bald', hairColor: '#e0e0e0', top: '#808060', topStyle: 'robe', under: '#605840', sleeves: 'long', pants: '#605840', boots: '#382818', face: 'beard' },
  kidNpc: { body: 'child', skin: SKIN, hair: 'short', hairColor: '#503018', top: '#e04040', topStyle: 'shirt', sleeves: 'short', pants: '#3050a0', boots: '#f0f0f0' },
  police: { body: 'male', skin: SKIN, hair: 'cap', hairColor: '#202840', accent: '#e0c040', top: '#283868', topStyle: 'shirt', sleeves: 'long', belt: '#202020', pants: '#283868', boots: '#101010' },
  scientist: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#606060', top: '#f0f0f0', topStyle: 'coat', under: '#80a0c0', sleeves: 'long', pants: '#506078', boots: '#382818', face: 'shades' },
  farmer: { body: 'male', skin: SKIN_DARK, hair: 'hat', hairColor: '#d0b060', accent: '#a05028', top: '#a07848', topStyle: 'shirt', sleeves: 'long', pants: '#4868a0', boots: '#503018' },
  reporter: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#e0a040', top: '#c03040', topStyle: 'shirt', sleeves: 'long', pants: '#202030', boots: '#202020' },
  waiter: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#202020', top: '#f0f0f0', topStyle: 'vest', under: '#f0f0f0', sleeves: 'long', belt: '#202020', pants: '#202020', boots: '#101010' },
  bandit: { body: 'male', skin: SKIN_TAN, hair: 'cap', hairColor: '#704828', accent: '#c03030', top: '#806848', topStyle: 'vest', under: '#e0d0b0', sleeves: 'short', belt: '#402818', pants: '#605040', boots: '#402818' },
  banditChief: { body: 'big', skin: SKIN_TAN, hair: 'mohawk', hairColor: '#c03030', top: '#383030', topStyle: 'vest', under: '#c03030', sleeves: 'none', belt: '#e0c040', pants: '#504040', boots: '#202020', face: 'stern' },
};

/** Display names for dialogue, keyed by cast id. Forms share their base character's name. */
export const CAST_NAMES: Record<string, string> = {
  goku: 'Goku', gokuSSJ: 'Goku', gokuSSG: 'Goku', gokuSSB: 'Goku', gokuUI: 'Goku', gokuWhis: 'Goku',
  vegeta: 'Vegeta', vegetaSSJ: 'Vegeta', vegetaSSB: 'Vegeta', vegetaSSBE: 'Vegeta', vegetaCasual: 'Vegeta',
  gohan: 'Gohan', gohanSSJ: 'Gohan', gohanSuit: 'Gohan', gohanUltimate: 'Gohan',
  futureTrunks: 'Trunks', futureTrunksSSJ: 'Trunks', futureTrunksRage: 'Trunks',
  piccolo: 'Piccolo', piccoloUnweighted: 'Piccolo', mrSatan: 'Mr. Satan',
  android17: 'Android 17', android17Top: 'Android 17', frieza: 'Frieza', goldenFrieza: 'Frieza',
  bulma: 'Bulma', futureBulma: 'Bulma', chichi: 'Chi-Chi', videl: 'Videl', pan: 'Pan', goten: 'Goten', trunksKid: 'Trunks',
  krillin: 'Krillin', krillinGi: 'Krillin', android18: 'Android 18', tien: 'Tien', yamcha: 'Yamcha', roshi: 'Master Roshi',
  chiaotzu: 'Chiaotzu', majinBuu: 'Buu', drBrief: 'Dr. Brief', panchy: 'Mrs. Briefs', dende: 'Dende', mrPopo: 'Mr. Popo',
  yajirobe: 'Yajirobe', jaco: 'Jaco', kingKai: 'King Kai', shenronAvatar: 'Shenron', pilaf: 'Pilaf', mai: 'Mai', shu: 'Shu',
  futureMai: 'Mai', resistance: 'Resistance Fighter', korin: 'Korin',
  beerus: 'Beerus', whis: 'Whis', champa: 'Champa', vados: 'Vados', supremeKai: 'Supreme Kai', oldKai: 'Old Kai',
  zeno: 'Zeno', grandPriest: 'Grand Priest', gowasu: 'Gowasu', zamasu: 'Zamasu', gokuBlack: 'Goku Black', blackRose: 'Goku Black',
  fusedZamasu: 'Zamasu', vegitoBlue: 'Vegito',
  frizaSoldier: 'Soldier', frizaSoldierB: 'Trooper', frizaSoldierC: 'Heavy', frizaElite: 'Elite', sorbet: 'Sorbet', tagoma: 'Tagoma', shisami: 'Shisami', ginyu: 'Ginyu',
  cabba: 'Cabba', cabbaSSJ: 'Cabba', hit: 'Hit', frost: 'Frost', botamo: 'Botamo', monaka: 'Monaka', kale: 'Kale', kaleLSSJ: 'Kale', caulifla: 'Caulifla', kefla: 'Kefla',
  jiren: 'Jiren', toppo: 'Toppo', dyspo: 'Dyspo', prideTrooper: 'Pride Trooper', basil: 'Basil', lavender: 'Lavender', bergamo: 'Bergamo',
  ribrianne: 'Ribrianne', gamisalas: 'Gamisalas', poacher: 'Poacher', babarian: 'Babarian', universeFighter: 'Fighter',
  townsman: 'Townsman', townswoman: 'Townswoman', oldMan: 'Old Man', kidNpc: 'Kid', police: 'Officer', scientist: 'Scientist',
  farmer: 'Farmer', reporter: 'Reporter', waiter: 'Waiter', bandit: 'Bandit', banditChief: 'Bandit Boss',
};

/** Register additional cast members (chapter content). Ids must be unique. */
export function registerCast(specs: Record<string, HumanoidSpec>, names: Record<string, string> = {}): void {
  for (const id of Object.keys(specs)) if (CAST[id]) throw new Error(`Duplicate cast id "${id}"`);
  Object.assign(CAST, specs);
  Object.assign(CAST_NAMES, names);
}
