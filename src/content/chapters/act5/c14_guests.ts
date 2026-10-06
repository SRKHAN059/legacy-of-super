import { STAT_CAP } from '../../../game/leveling';
import type { ScriptApi } from '../../../game/script';
import type { CharId } from '../../characters';
import { force } from '../common';
import { freeNear, heroTile, type Outgoing, refresh, stage } from './helpers';

/**
 * Tournament of Power fighters who are not party members (Master Roshi, Tien), played the way Chapter 13 plays Cabba
 * and Chapter 11 plays Vegito: a costume (outfit) over a forced host. The guest keeps the host's level, HP/EP and stat
 * growth, but has the guest's own looks and techniques and no Z form. Putting a costume on stashes the host's HP, EP,
 * Z form and technique list; taking it off puts them back exactly. A relay that restarts takes any costume off first
 * (`takeOffGuest`), so a reload mid-segment never leaves the host dressed up.
 */

/** A guest fighter worn over a party member. */
export interface Guest {
  /** Cast id of the guest (speaker portraits, the outgoing actor). */
  id: string;
  name: string;
  /** Costume sprite while in base form. */
  sprite: string;
  /** Party member whose level, HP and stats the guest fights with. */
  host: CharId;
  /** Techniques while the costume is on (the guest's own repertoire). */
  techs: string[];
  /** A power-up the story turns on (Master Roshi's Max Power): costume and flat stat bonus, like a Z form's. */
  power?: { sprite: string; bonus: number };
}

/** Master Roshi: his Kamehameha, and Max Power when the story calls for it (eps 105-107). */
export const ROSHI: Guest = { id: 'roshi', name: 'Master Roshi', sprite: 'roshi', host: 'goku', techs: ['kiBlast', 'kamehameha'], power: { sprite: 'c14_roshiMax', bonus: 12 } };

/** Tien: ki blasts and the Kamehameha he copied from Master Roshi long ago (ep 106). */
export const TIEN: Guest = { id: 'tien', name: 'Tien', sprite: 'tien', host: 'goku', techs: ['kiBlast', 'kamehameha'] };

const GUESTS: Record<string, Guest> = { roshi: ROSHI, tien: TIEN };

/** State key of the host's stash while a costume is on. */
export const GUEST_STASH = 'c14_guestStash';

/** What the host had before the costume went on, and the power bonus currently applied. */
interface Stash {
  guest: string;
  host: CharId;
  hp: number;
  ep: number;
  form: string | null;
  techs: string[];
  selected: number;
  /** STR/POW/END points the power-up added (removed exactly when it ends). */
  boost: [number, number, number] | null;
}

function readStash(s: ScriptApi): Stash | null {
  const raw = s.state.get(GUEST_STASH);
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as Stash;
  } catch {
    return null;
  }
}

function writeStash(s: ScriptApi, st: Stash): void {
  s.set(GUEST_STASH, JSON.stringify(st));
}

/** The guest currently worn, if any. */
export function wornGuest(s: ScriptApi): Guest | null {
  const st = readStash(s);
  return st ? GUESTS[st.guest] ?? null : null;
}

/**
 * Put a guest's costume on its host: force the host, set aside its Z form and techniques, dress it, and step in fresh
 * (a new fighter enters the ring with full HP and EP, as in every LoG2 relay hand-off).
 */
function wear(s: ScriptApi, g: Guest): void {
  const c = s.state.char(g.host);
  force(s, g.host);
  s.transformNow(null);
  writeStash(s, { guest: g.id, host: g.host, hp: c.hp, ep: c.ep, form: c.form, techs: [...c.techs], selected: c.selected, boost: null });
  c.form = null;
  c.techs = [...g.techs];
  c.selected = 0;
  s.outfit(g.host, g.sprite);
  refresh(s, g.host);
}

/**
 * Turn the worn guest's power-up on (costume and stat bonus) or off. Safe to call twice either way; stats are capped
 * like a form's and the exact points added come off again.
 */
export function guestPower(s: ScriptApi, on: boolean): void {
  const st = readStash(s);
  const g = st ? GUESTS[st.guest] : null;
  if (!st || !g?.power) return;
  const c = s.state.char(st.host);
  if (on && !st.boost) {
    const add = (v: number): number => Math.max(0, Math.min(g.power?.bonus ?? 0, STAT_CAP - v));
    st.boost = [add(c.str), add(c.pow), add(c.end)];
    c.str += st.boost[0];
    c.pow += st.boost[1];
    c.end += st.boost[2];
  } else if (!on && st.boost) {
    c.str -= st.boost[0];
    c.pow -= st.boost[1];
    c.end -= st.boost[2];
    st.boost = null;
  }
  writeStash(s, st);
  s.outfit(st.host, on ? g.power.sprite : g.sprite);
}

/**
 * Take the worn costume off: power-up off, the host's HP, EP, Z form and techniques back as they were. Does nothing
 * when no costume is on. Leaves `noSwitch` to the caller (the relay decides who plays next).
 */
export function takeOffGuest(s: ScriptApi): void {
  const st = readStash(s);
  if (!st) return;
  guestPower(s, false);
  const c = s.state.char(st.host);
  c.hp = Math.max(1, Math.min(c.hpMax, st.hp));
  c.ep = Math.max(0, Math.min(c.epMax, st.ep));
  c.form = st.form;
  c.techs = [...st.techs];
  c.selected = Math.min(st.selected, c.techs.length);
  s.clear(GUEST_STASH);
  s.outfit(st.host, null);
}

/** Options for `guestHandOff`. */
export interface GuestHandOffOpts {
  /** Stage the outgoing fighter where the hero stood (drawn with the hero's current look unless `sprite` is given). */
  out?: Outgoing;
  /** Where the guest stands relative to the outgoing fighter (default one tile to the right). */
  dx?: number;
  dy?: number;
  /** Take the place of this cutscene actor instead (it is removed: the guest "was" that actor). */
  at?: string;
  /** Step in at this tile instead: the relay picks up elsewhere on the stage after a time skip in the dark. */
  to?: [number, number];
}

/**
 * LoG2 relay hand-off into a guest (helpers.ts `handOff` for costumes): fade out, keep the outgoing fighter on the
 * stage as an actor, swap costumes in the dark (the worn one comes off first), and fade back in with the guest fresh.
 */
export async function guestHandOff(s: ScriptApi, g: Guest, opts: GuestHandOffOpts = {}): Promise<void> {
  const [hx, hy] = heroTile(s);
  const look = s.field.player.spriteId;
  const facing = s.field.player.dir;
  await s.fadeOut(16);
  s.pose('hero', null);
  s.show('hero', true);
  s.transformNow(null);
  let [tx, ty] = [hx, hy];
  if (opts.out) {
    stage(s, opts.out.id, opts.out.sprite ?? look, hx, hy, facing, opts.out.name);
    if (opts.out.pose) s.pose(opts.out.id, opts.out.pose);
    tx = hx + (opts.dx ?? 1);
    ty = hy + (opts.dy ?? 0);
  }
  if (opts.at && s.exists(opts.at)) {
    const a = s.actor(opts.at);
    tx = Math.floor(a.x / 16);
    ty = Math.floor((a.y - 14) / 16);
    s.remove(opts.at);
  } else if (opts.to) [tx, ty] = opts.to;
  takeOffGuest(s);
  wear(s, g);
  const [fx, fy] = freeNear(s, tx, ty);
  s.place('hero', fx, fy, facing);
  await s.fadeIn(16);
}
