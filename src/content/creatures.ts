import type { CreatureSpec } from '../art/creatures';

/** Sprite specs for non-humanoid creatures, keyed by sprite id. */
export const CREATURES: Record<string, CreatureSpec> = {
  wolf: { kind: 'quadruped', body: '#8888a0', belly: '#c8c8d8', size: 32 },
  sabertooth: { kind: 'quadruped', body: '#e09838', belly: '#f8e0b0', accent: '#583818', stripes: true, size: 32 },
  bear: { kind: 'quadruped', body: '#704828', belly: '#a07850', size: 40 },
  boar: { kind: 'quadruped', body: '#806050', belly: '#a88878', horns: true, size: 32 },
  tRex: { kind: 'dino', body: '#68a050', belly: '#c8d890', accent: '#406830', horns: true, size: 48 },
  raptor: { kind: 'dino', body: '#c09048', belly: '#e8d8a0', size: 32 },
  pterodactyl: { kind: 'flyer', body: '#a07858', accent: '#e0b040', horns: true, size: 32 },
  hawk: { kind: 'flyer', body: '#806040', belly: '#e0d0b0', accent: '#f0c030', size: 24 },
  bat: { kind: 'bat', body: '#584070', eye: '#f04040', size: 24 },
  snake: { kind: 'snake', body: '#58a040', belly: '#c8e090', accent: '#305820', size: 32 },
  giantSnake: { kind: 'snake', body: '#a04828', belly: '#e8c080', accent: '#602818', size: 48 },
  pilafRobot: { kind: 'robot', body: '#a0a8b8', accent: '#e03030', size: 32 },
  mechTrooper: { kind: 'robot', body: '#606878', accent: '#40e0f0', size: 32 },
  drone: { kind: 'drone', body: '#8890a8', accent: '#e03030', size: 24 },
  rescueDrone: { kind: 'drone', body: '#e8e0d0', accent: '#40a0f0', size: 24 },
  slime: { kind: 'blob', body: '#70c070', size: 24 },
  commeson: { kind: 'blob', body: '#c040c0', size: 48 },
  beetle: { kind: 'bug', body: '#384878', accent: '#e8c040', stripes: true, horns: true, size: 24 },
  wasp: { kind: 'bug', body: '#e8c030', accent: '#202020', stripes: true, size: 24 },
  crab: { kind: 'crab', body: '#d84830', size: 32 },
  alienFish: { kind: 'blob', body: '#58a8d8', size: 32 },
  // Palette tiers (LoG2 recolours stronger variants of the same sprite).
  timberWolf: { kind: 'quadruped', body: '#906848', belly: '#d0b090', size: 32 },
  snowWolf: { kind: 'quadruped', body: '#e0e8f0', belly: '#ffffff', eye: '#40a0f0', size: 32 },
  direWolf: { kind: 'quadruped', body: '#383040', belly: '#685870', eye: '#f04040', size: 32 },
  iceSabertooth: { kind: 'quadruped', body: '#c8d8f0', belly: '#ffffff', accent: '#5878a8', stripes: true, size: 32 },
  viper: { kind: 'snake', body: '#a040a0', belly: '#e0b0e0', accent: '#601860', size: 32 },
  sandSnake: { kind: 'snake', body: '#c8a058', belly: '#f0e0b0', accent: '#806030', size: 32 },
  blueTRex: { kind: 'dino', body: '#4878c0', belly: '#a8c8f0', accent: '#284878', horns: true, size: 48 },
  blackTRex: { kind: 'dino', body: '#303038', belly: '#686878', accent: '#c03030', horns: true, size: 48 },
  redRaptor: { kind: 'dino', body: '#c05040', belly: '#f0c0a0', size: 32 },
  stormPtero: { kind: 'flyer', body: '#606878', accent: '#f0e040', horns: true, size: 32 },
  greenDrone: { kind: 'drone', body: '#58a060', accent: '#f0f040', size: 24 },
  goldDrone: { kind: 'drone', body: '#d0a838', accent: '#e03030', size: 24 },
  redMech: { kind: 'robot', body: '#c04040', accent: '#f8f040', size: 32 },
  goldMech: { kind: 'robot', body: '#d8b040', accent: '#40e0f0', size: 32 },
  cave_bat: { kind: 'bat', body: '#3a3050', eye: '#f0f040', size: 24 },
  fireBat: { kind: 'bat', body: '#a03020', eye: '#f8f040', size: 24 },
  hornet: { kind: 'bug', body: '#d06020', accent: '#202020', stripes: true, size: 24 },
  scarab: { kind: 'bug', body: '#30a080', accent: '#f0d040', stripes: true, horns: true, size: 24 },
  greyBear: { kind: 'quadruped', body: '#686868', belly: '#989898', size: 40 },
  kingCrab: { kind: 'crab', body: '#a02868', size: 32 },
  mudSlime: { kind: 'blob', body: '#806848', size: 24 },
  voidSlime: { kind: 'blob', body: '#6040a0', size: 24 },
};

/** Register chapter-specific creatures. */
export function registerCreatures(specs: Record<string, CreatureSpec>): void {
  for (const [id, sp] of Object.entries(specs)) {
    if (CREATURES[id]) throw new Error(`Duplicate creature id "${id}"`);
    CREATURES[id] = sp;
  }
}
