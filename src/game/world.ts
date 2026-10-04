import { propArt, type PropArt, type PropKind } from '../art/props';
import { renderGround, terrainLiquid, terrainSolid, type Terrain } from '../art/tiles';
import { TILE } from '../engine/constants';
import type { Bitmap } from '../engine/gfx';
import type { Rect } from '../engine/math';
import { CollisionMap } from './collision';
import type { BarrierDef, MapDef, ObjectDef } from './mapdef';
import type { GameState } from './state';

/** A placed prop ready to draw. */
export interface PropInst {
  kind: PropKind | string;
  art: PropArt;
  /** Bitmap top-left in world pixels. */
  x: number;
  y: number;
  /** Depth-sort key (bottom of the footprint). */
  sortY: number;
  id?: string;
}

/** Runtime object with built-in behaviour. */
export interface ObjInst {
  def: ObjectDef;
  /** Interaction / hit rect in world pixels. */
  rect: Rect;
  /** Remaining hits for breakables. */
  hp: number;
  gone: boolean;
  tag: string;
  prop?: PropInst;
}

/** Runtime level gate. */
export interface GateInst {
  def: BarrierDef;
  rect: Rect;
  broken: boolean;
  tag: string;
}

const groundCache = new Map<string, Bitmap>();

/** Parse a map's terrain grid, validating dimensions and legend coverage. */
export function parseGrid(def: MapDef): Terrain[][] {
  const w = def.grid[0]?.length ?? 0;
  return def.grid.map((row, y) => {
    if (row.length !== w) throw new Error(`Map ${def.id}: row ${y} has length ${row.length}, expected ${w}`);
    return [...row].map((ch, x) => {
      const t = def.legend[ch];
      if (!t) throw new Error(`Map ${def.id}: unknown legend char "${ch}" at ${x},${y}`);
      return t;
    });
  });
}

/** Everything static about a loaded map. */
export class MapInstance {
  readonly def: MapDef;
  readonly cols: number;
  readonly rows: number;
  readonly pw: number;
  readonly ph: number;
  readonly col: CollisionMap;
  readonly ground: Bitmap;
  readonly grid: Terrain[][];
  props: PropInst[] = [];
  objects: ObjInst[] = [];
  gates: GateInst[] = [];

  constructor(def: MapDef, state: GameState) {
    this.def = def;
    this.grid = parseGrid(def);
    this.rows = this.grid.length;
    this.cols = this.grid[0]?.length ?? 0;
    this.pw = this.cols * TILE;
    this.ph = this.rows * TILE;
    this.col = new CollisionMap(this.cols, this.rows);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.grid[y][x];
        this.col.setTile(x, y, terrainSolid(t), terrainLiquid(t));
      }
    }
    let g = groundCache.get(def.id);
    if (!g) {
      g = renderGround(this.grid);
      groundCache.set(def.id, g);
    }
    this.ground = g;

    for (const raw of def.props ?? []) {
      const pl = Array.isArray(raw) ? { kind: raw[0], x: raw[1], y: raw[2] } : raw;
      if ('flag' in pl && pl.flag && !state.check(pl.flag)) continue;
      if ('hideFlag' in pl && pl.hideFlag && state.check(pl.hideFlag)) continue;
      this.addProp(pl.kind, pl.x * TILE, pl.y * TILE, 'id' in pl ? pl.id : undefined);
    }

    (def.objects ?? []).forEach((o, i) => this.addObject(o, i, state));

    for (const b of def.barriers ?? []) {
      const rect = { x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE };
      const broken = state.flag(`gate:${def.id}:${b.id}`) || (b.openIf ? state.check(b.openIf) : false);
      const tag = `gate:${b.id}`;
      this.gates.push({ def: b, rect, broken, tag });
      if (!broken) this.col.addRect(rect, tag);
    }
  }

  /** Place a prop at a pixel position (top-left of its bitmap). */
  addProp(kind: PropKind | string, x: number, y: number, id?: string): PropInst {
    const art = propArt(kind);
    const sortY = art.solid ? y + art.solid.y + art.solid.h : y + art.bmp.height;
    const inst: PropInst = { kind, art, x, y, sortY: art.flat ? -1 : sortY, id };
    this.props.push(inst);
    if (art.solid) this.col.addRect({ x: x + art.solid.x, y: y + art.solid.y, w: art.solid.w, h: art.solid.h }, id ? `prop:${id}` : undefined);
    return inst;
  }

  /** Remove a prop by id (scripted changes). */
  removeProp(id: string): void {
    this.props = this.props.filter((p) => p.id !== id);
    this.col.removeTag(`prop:${id}`);
  }

  private addObject(o: ObjectDef, i: number, state: GameState): void {
    const px = o.x * TILE;
    const py = o.y * TILE;
    const tag = `obj:${i}`;
    const inst: ObjInst = { def: o, rect: { x: px, y: py, w: TILE, h: TILE }, hp: 1, gone: false, tag };
    switch (o.type) {
      case 'save': {
        inst.prop = this.addPropTagged('savePoint', px, py - 8, tag);
        inst.rect = { x: px - 2, y: py - 4, w: TILE + 4, h: TILE + 6 };
        break;
      }
      case 'flight':
        if (o.showIf && !state.check(o.showIf)) inst.gone = true;
        inst.rect = { x: px, y: py, w: TILE, h: TILE };
        break;
      case 'worldSign':
        inst.prop = this.addPropTagged('sign', px, py - 2, tag);
        inst.rect = { x: px - 2, y: py, w: TILE + 4, h: TILE + 4 };
        break;
      case 'sign':
        inst.prop = this.addPropTagged('sign', px, py - 2, tag);
        inst.rect = { x: px - 2, y: py, w: TILE + 4, h: TILE + 4 };
        break;
      case 'chest': {
        const opened = state.flag(`chest:${o.id}`);
        if ((o.showIf && !state.check(o.showIf))) { inst.gone = true; break; }
        if (!opened) inst.prop = this.addPropTagged('chest', px, py + 2, tag);
        inst.gone = opened;
        inst.rect = { x: px - 2, y: py, w: TILE + 4, h: TILE + 4 };
        break;
      }
      case 'breakable': {
        const look = o.look ?? 'rock';
        const kind: PropKind = look === 'jar' ? 'jar' : look === 'crate' ? 'crate' : o.size === 3 ? 'boulder' : o.size === 2 ? 'rock' : 'smallRock';
        const art = propArt(kind);
        inst.rect = { x: px, y: py, w: art.bmp.width, h: art.bmp.height };
        if (o.id && state.flag(`broke:${this.def.id}:${o.id}`)) { inst.gone = true; break; }
        inst.prop = this.addPropTagged(kind, px, py, tag);
        if (kind === 'smallRock') this.col.addRect({ x: px + 1, y: py + 2, w: 8, h: 6 }, tag);
        inst.hp = o.size;
        break;
      }
      case 'bag':
        inst.prop = this.addPropTagged('barrel', px, py, tag);
        inst.rect = { x: px - 2, y: py - 8, w: 18, h: 24 };
        break;
    }
    this.objects.push(inst);
  }

  private addPropTagged(kind: PropKind, x: number, y: number, tag: string): PropInst {
    const art = propArt(kind);
    const sortY = art.solid ? y + art.solid.y + art.solid.h : y + art.bmp.height;
    const inst: PropInst = { kind, art, x, y, sortY: art.flat ? -1 : sortY, id: tag };
    this.props.push(inst);
    if (art.solid) this.col.addRect({ x: x + art.solid.x, y: y + art.solid.y, w: art.solid.w, h: art.solid.h }, tag);
    return inst;
  }

  /** Remove an object's prop + collision (opened chest, broken rock). */
  removeObject(o: ObjInst): void {
    o.gone = true;
    this.col.removeTag(o.tag);
    this.props = this.props.filter((p) => p.id !== o.tag);
  }

  /** Break a gate open. */
  openGate(g: GateInst): void {
    g.broken = true;
    this.col.removeTag(g.tag);
  }
}
