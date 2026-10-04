/** Item categories as shown in the Items menu. */
export type ItemKind = 'consumable' | 'capsule' | 'key' | 'collectible' | 'trophy';

/** Effect when used from the Items menu on the current character. */
export type ItemUse =
  | { heal: number | 'full'; ep?: number | 'full' }
  | { healPct: number }
  | { stat: 'str' | 'pow' | 'end'; amount: number }
  | { warp: 'world' }
  | null;

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  max: number;
  desc: string;
  use: ItemUse;
  /** Icon colours (drawn procedurally in menus/pickups). */
  icon: { shape: 'bean' | 'cookie' | 'capsule' | 'ball' | 'card' | 'food' | 'star' | 'gear' | 'scroll' | 'trophy' | 'fish' | 'box'; color: string; color2?: string };
}

const cap = (stat: 'str' | 'pow' | 'end', n: number): ItemDef => ({
  id: `${stat}${n}`,
  name: `${stat.toUpperCase()} Capsule +${n}`,
  kind: 'capsule',
  max: 99,
  desc: `Permanently raises the current character's ${stat === 'str' ? 'Strength' : stat === 'pow' ? 'Power' : 'Endurance'} by ${n}.`,
  use: { stat, amount: n },
  icon: { shape: 'capsule', color: stat === 'str' ? '#e04040' : stat === 'pow' ? '#4080f0' : '#40c060', color2: '#f0f0f0' },
});

/** Every inventory item. Content files may extend this with `registerItems`. */
export const ITEMS: Record<string, ItemDef> = {
  senzu: { id: 'senzu', name: 'Senzu Bean', kind: 'consumable', max: 3, desc: 'A magic bean from Korin. Fully restores HP and EP.', use: { heal: 'full', ep: 'full' }, icon: { shape: 'bean', color: '#58b848' } },
  cookie: { id: 'cookie', name: 'Cookie', kind: 'consumable', max: 99, desc: 'Fresh from Mrs. Briefs\'s oven. Restores 5 HP.', use: { heal: 5 }, icon: { shape: 'cookie', color: '#d8a058' } },
  fish: { id: 'fish', name: 'Fish', kind: 'consumable', max: 3, desc: 'A fresh catch. Restores 10% HP. Korin will trade a Senzu Bean for three of these.', use: { healPct: 0.1 }, icon: { shape: 'fish', color: '#80a8c8' } },
  str1: cap('str', 1), str3: cap('str', 3), str5: cap('str', 5),
  pow1: cap('pow', 1), pow3: cap('pow', 3), pow5: cap('pow', 5),
  end1: cap('end', 1), end3: cap('end', 3), end5: cap('end', 5),
  delicacy: { id: 'delicacy', name: 'Earth Delicacy', kind: 'collectible', max: 25, desc: 'A rare dish Whis has never tasted. He wants all 25.', use: null, icon: { shape: 'food', color: '#f8d040', color2: '#e05030' } },
  whisStaff: { id: 'whisStaff', name: 'Whis\'s Charm', kind: 'key', max: 1, desc: 'A tiny replica of Whis\'s staff. Use outdoors to fly to the world map.', use: { warp: 'world' }, icon: { shape: 'scroll', color: '#4890e0', color2: '#f0f0f0' } },
  scouter: { id: 'scouter', name: 'Scouter', kind: 'key', max: 1, desc: 'Bulma\'s rebuilt scouter. SELECT: scan. R: regional map.', use: null, icon: { shape: 'gear', color: '#38e070' } },
  dragonRadar: { id: 'dragonRadar', name: 'Dragon Radar', kind: 'key', max: 1, desc: 'Shows Dragon Balls on the regional map.', use: null, icon: { shape: 'gear', color: '#f0f0f0', color2: '#40c040' } },
  db1: { id: 'db1', name: '1-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with one star.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  db2: { id: 'db2', name: '2-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with two stars.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  db3: { id: 'db3', name: '3-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with three stars.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  db4: { id: 'db4', name: '4-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with four stars.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  db5: { id: 'db5', name: '5-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with five stars.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  db6: { id: 'db6', name: '6-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with six stars.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  db7: { id: 'db7', name: '7-Star Ball', kind: 'key', max: 1, desc: 'A Dragon Ball with seven stars.', use: null, icon: { shape: 'ball', color: '#f89820' } },
  trophyGoku: { id: 'trophyGoku', name: 'Goku Trophy', kind: 'trophy', max: 1, desc: 'Proof of Goku\'s mastery.', use: null, icon: { shape: 'trophy', color: '#f08828' } },
  trophyVegeta: { id: 'trophyVegeta', name: 'Vegeta Trophy', kind: 'trophy', max: 1, desc: 'Proof of Vegeta\'s pride.', use: null, icon: { shape: 'trophy', color: '#3048c8' } },
  trophyGohan: { id: 'trophyGohan', name: 'Gohan Trophy', kind: 'trophy', max: 1, desc: 'Proof of Gohan\'s hidden power.', use: null, icon: { shape: 'trophy', color: '#60c8f0' } },
  trophyTrunks: { id: 'trophyTrunks', name: 'Trunks Trophy', kind: 'trophy', max: 1, desc: 'Proof of Trunks\'s resolve.', use: null, icon: { shape: 'trophy', color: '#9058c8' } },
  trophyPiccolo: { id: 'trophyPiccolo', name: 'Piccolo Trophy', kind: 'trophy', max: 1, desc: 'Proof of Piccolo\'s discipline.', use: null, icon: { shape: 'trophy', color: '#48b048' } },
};

/** Register additional items (chapter key items). */
export function registerItems(items: ItemDef[]): void {
  for (const it of items) ITEMS[it.id] = it;
}

/** Instant-use field drops (never stored). */
export type DropKind = 'foodS' | 'foodM' | 'foodL' | 'orbS' | 'orbM' | 'orbL' | 'fish';

/** Fraction of max HP/EP restored by each drop size. */
export const DROP_RESTORE: Record<Exclude<DropKind, 'fish'>, number> = {
  foodS: 0.1, foodM: 0.2, foodL: 0.3, orbS: 0.1, orbM: 0.2, orbL: 0.3,
};
