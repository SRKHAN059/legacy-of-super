import { TILE } from '../engine/constants';
import { Painter, type Bitmap } from '../engine/gfx';
import { shade } from './color';

/** Ground terrain types. Higher `priority` terrains draw their edges over lower ones. */
export type Terrain =
  | 'grass' | 'darkGrass' | 'dirt' | 'path' | 'sand' | 'water' | 'deep' | 'cliff' | 'rock'
  | 'floor' | 'wood' | 'carpet' | 'tile' | 'wall' | 'roof' | 'void' | 'arena' | 'snow' | 'lava'
  | 'alienGrass' | 'ruins' | 'asphalt' | 'cloud' | 'marble' | 'hellRock' | 'metal' | 'ice' | 'wasteland';

interface TerrainDef {
  base: string;
  /** Accent colours for speckle texture. */
  speckle: string[];
  density: number;
  priority: number;
  /** Blocks walking. */
  solid: boolean;
  /** Liquids block walking but are animated. */
  liquid?: boolean;
  /** Custom painter for structured terrains (walls, floors). */
  paint?: (p: Painter, x: number, y: number, seed: number) => void;
}

const T: Record<Terrain, TerrainDef> = {
  grass: { base: '#58b048', speckle: ['#489838', '#70c858', '#409030'], density: 0.18, priority: 2, solid: false },
  darkGrass: { base: '#3c8838', speckle: ['#30702c', '#4c9c44'], density: 0.2, priority: 3, solid: false },
  dirt: { base: '#b89058', speckle: ['#a07c48', '#c8a068', '#987040'], density: 0.18, priority: 4, solid: false },
  path: { base: '#d0b078', speckle: ['#c0a068', '#dcc08c'], density: 0.12, priority: 5, solid: false },
  sand: { base: '#e8d898', speckle: ['#d8c880', '#f0e4b0'], density: 0.15, priority: 1, solid: false },
  water: { base: '#3880d8', speckle: ['#4890e0', '#3070c8'], density: 0.08, priority: 0, solid: true, liquid: true },
  deep: { base: '#2860b8', speckle: ['#2058a8', '#3068c0'], density: 0.06, priority: 0, solid: true, liquid: true },
  cliff: {
    base: '#8c7050', speckle: ['#7c6044'], density: 0.05, priority: 9, solid: true,
    paint: (p, x, y, seed) => {
      p.rect(x, y, TILE, TILE, '#8c7050');
      for (let r = 0; r < 4; r++) {
        const yy = y + r * 4;
        p.hline(x, yy + 3, TILE, '#6c5438');
        const off = (r + seed) % 2 ? 4 : 10;
        p.vline(x + off, yy, 3, '#6c5438');
        p.hline(x, yy, TILE, '#a08460');
      }
    },
  },
  rock: { base: '#988878', speckle: ['#887868', '#a89888', '#786858'], density: 0.22, priority: 6, solid: false },
  wasteland: { base: '#c8a878', speckle: ['#b89868', '#d8b888', '#a88858'], density: 0.2, priority: 3, solid: false },
  floor: {
    base: '#d8c8a8', speckle: [], density: 0, priority: 1, solid: false,
    paint: (p, x, y) => {
      p.rect(x, y, TILE, TILE, '#d8c8a8');
      p.hline(x, y + 15, TILE, '#c0b090');
      p.vline(x + 15, y, TILE, '#c0b090');
    },
  },
  wood: {
    base: '#b07840', speckle: [], density: 0, priority: 1, solid: false,
    paint: (p, x, y, seed) => {
      p.rect(x, y, TILE, TILE, '#b07840');
      for (let r = 0; r < 4; r++) {
        p.hline(x, y + r * 4 + 3, TILE, '#905c30');
        p.vline(x + ((r * 7 + seed) % 16), y + r * 4, 3, '#905c30');
      }
    },
  },
  carpet: {
    base: '#b83848', speckle: ['#a83040'], density: 0.05, priority: 2, solid: false,
    paint: (p, x, y) => {
      p.rect(x, y, TILE, TILE, '#b83848');
      p.rect(x + 2, y + 2, 12, 12, '#c84858');
      p.rect(x + 7, y + 7, 2, 2, '#e8c050');
    },
  },
  tile: {
    base: '#e0e0e8', speckle: [], density: 0, priority: 1, solid: false,
    paint: (p, x, y) => {
      p.rect(x, y, TILE, TILE, '#e0e0e8');
      p.hline(x, y + 7, TILE, '#c0c0d0'); p.hline(x, y + 15, TILE, '#c0c0d0');
      p.vline(x + 7, y, TILE, '#c0c0d0'); p.vline(x + 15, y, TILE, '#c0c0d0');
    },
  },
  wall: {
    base: '#e8e0d0', speckle: [], density: 0, priority: 9, solid: true,
    paint: (p, x, y) => {
      p.rect(x, y, TILE, TILE, '#e8e0d0');
      p.rect(x, y + 12, TILE, 4, '#a89878');
      p.hline(x, y + 12, TILE, '#887858');
    },
  },
  roof: {
    base: '#c85040', speckle: [], density: 0, priority: 9, solid: true,
    paint: (p, x, y) => {
      p.rect(x, y, TILE, TILE, '#c85040');
      for (let r = 0; r < 4; r++) p.hline(x, y + r * 4 + 3, TILE, '#a03830');
    },
  },
  void: {
    base: '#100820', speckle: ['#2a1848', '#f0e8ff', '#382060'], density: 0.02, priority: 0, solid: true,
  },
  arena: {
    base: '#b0a8a0', speckle: [], density: 0, priority: 7, solid: false,
    paint: (p, x, y, seed) => {
      p.rect(x, y, TILE, TILE, '#b0a8a0');
      p.hline(x, y, TILE, '#c8c0b8');
      p.vline(x, y, TILE, '#c8c0b8');
      p.hline(x, y + 15, TILE, '#888078');
      p.vline(x + 15, y, TILE, '#888078');
      if (seed % 5 === 0) p.line(x + 3, y + 4, x + 9, y + 11, '#888078');
    },
  },
  snow: { base: '#f0f4f8', speckle: ['#d8e0f0', '#ffffff'], density: 0.15, priority: 2, solid: false },
  ice: { base: '#b8d8f0', speckle: ['#d0e8f8', '#a0c8e8'], density: 0.1, priority: 2, solid: false },
  lava: { base: '#e05018', speckle: ['#f8a020', '#c03010'], density: 0.25, priority: 0, solid: true, liquid: true },
  alienGrass: { base: '#58b8a0', speckle: ['#48a088', '#78d0b8', '#9070c0'], density: 0.18, priority: 2, solid: false },
  ruins: { base: '#807878', speckle: ['#686060', '#989090', '#585050'], density: 0.3, priority: 5, solid: false },
  asphalt: {
    base: '#606068', speckle: ['#585860', '#686870'], density: 0.15, priority: 4, solid: false,
  },
  cloud: { base: '#f8f8ff', speckle: ['#e0e8f8', '#d0d8f0'], density: 0.12, priority: 1, solid: false },
  marble: {
    base: '#e8e0f0', speckle: [], density: 0, priority: 6, solid: false,
    paint: (p, x, y, seed) => {
      p.rect(x, y, TILE, TILE, '#e8e0f0');
      p.rect(x, y, TILE, 1, '#f8f4ff');
      p.rect(x, y + 15, TILE, 1, '#c8c0d8');
      p.vline(x + 15, y, TILE, '#c8c0d8');
      if (seed % 3 === 0) p.line(x + 2, y + 10, x + 7, y + 6, '#d0c8e0');
    },
  },
  hellRock: { base: '#783028', speckle: ['#602018', '#904038'], density: 0.2, priority: 3, solid: false },
  metal: {
    base: '#8890a0', speckle: [], density: 0, priority: 3, solid: false,
    paint: (p, x, y) => {
      p.rect(x, y, TILE, TILE, '#8890a0');
      p.rect(x, y, TILE, 1, '#a0a8b8'); p.rect(x, y, 1, TILE, '#a0a8b8');
      p.rect(x + 15, y, 1, TILE, '#687080'); p.rect(x, y + 15, TILE, 1, '#687080');
      p.px(x + 2, y + 2, '#687080'); p.px(x + 13, y + 2, '#687080'); p.px(x + 2, y + 13, '#687080'); p.px(x + 13, y + 13, '#687080');
    },
  },
};

/** True when a terrain blocks walking. */
export function terrainSolid(t: Terrain): boolean {
  return T[t].solid;
}

/** True when a terrain is a liquid (blocks walking; a flying character can cross). */
export function terrainLiquid(t: Terrain): boolean {
  return !!T[t].liquid;
}

/** All terrain ids. */
export const TERRAINS = Object.keys(T) as Terrain[];

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Render a terrain grid into a single bitmap, with jagged auto-blended edges where a
 * higher-priority terrain meets a lower one and drop-shadows under cliffs.
 */
export function renderGround(grid: Terrain[][]): Bitmap {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const p = new Painter(w * TILE, h * TILE);
  const at = (x: number, y: number): Terrain | null => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : null);

  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const t = grid[ty][tx];
      const d = T[t];
      const x = tx * TILE;
      const y = ty * TILE;
      const seed = hash(tx, ty);
      if (d.paint) d.paint(p, x, y, seed);
      else {
        p.rect(x, y, TILE, TILE, d.base);
        p.speckle(x, y, TILE, TILE, d.speckle, d.density, seed);
        if (t === 'grass' || t === 'darkGrass' || t === 'alienGrass') {
          // Little grass tufts.
          const n = seed % 3;
          for (let i = 0; i < n; i++) {
            const gx = x + ((seed >> (i * 4)) & 15);
            const gy = y + ((seed >> (i * 4 + 2)) & 15);
            p.px(gx, gy, shade(d.base, 0.75));
            p.px(gx + 1, gy - 1, shade(d.base, 0.75));
            p.px(gx + 2, gy, shade(d.base, 0.75));
          }
        }
      }
    }
  }

  // Edge blending: for each tile, neighbours with higher priority bleed a jagged fringe in.
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const t = grid[ty][tx];
      const pri = T[t].priority;
      if (T[t].paint && t !== 'cliff') continue;
      const nbrs: Array<[number, number, 'n' | 's' | 'e' | 'w']> = [[0, -1, 'n'], [0, 1, 's'], [-1, 0, 'w'], [1, 0, 'e']];
      for (const [dx, dy, side] of nbrs) {
        const n = at(tx + dx, ty + dy);
        if (!n || n === t) continue;
        const nd = T[n];
        if (nd.priority <= pri || nd.paint) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        for (let i = 0; i < TILE; i++) {
          const depth = 1 + (hash(tx * 16 + i, ty, side.charCodeAt(0)) % 3);
          for (let k = 0; k < depth; k++) {
            const col = k === depth - 1 ? shade(nd.base, 0.85) : nd.base;
            if (side === 'n') p.px(x + i, y + k, col);
            if (side === 's') p.px(x + i, y + TILE - 1 - k, col);
            if (side === 'w') p.px(x + k, y + i, col);
            if (side === 'e') p.px(x + TILE - 1 - k, y + i, col);
          }
        }
      }
      // Shoreline foam where water meets land.
      if (T[t].liquid) {
        for (const [dx, dy, side] of nbrs) {
          const n = at(tx + dx, ty + dy);
          if (!n || T[n].liquid) continue;
          const x = tx * TILE;
          const y = ty * TILE;
          for (let i = 0; i < TILE; i += 1) {
            if (hash(i, tx + ty) % 3 === 0) continue;
            if (side === 'n') p.px(x + i, y + 1, '#a8d8f8');
            if (side === 's') p.px(x + i, y + TILE - 2, '#a8d8f8');
            if (side === 'w') p.px(x + 1, y + i, '#a8d8f8');
            if (side === 'e') p.px(x + TILE - 2, y + i, '#a8d8f8');
          }
        }
      }
      // Cliff drop shadow on the tile below.
      if (t !== 'cliff' && at(tx, ty - 1) === 'cliff') {
        p.rect(tx * TILE, ty * TILE, TILE, 3, shade(T[t].base, 0.7));
      }
    }
  }
  return p.done();
}
