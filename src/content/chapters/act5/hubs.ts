/**
 * Staging coordinates on shared hub maps (owned by the world builders). Every use goes through
 * `freeNear`/`warpTo`, so a slightly-off coordinate still lands on a walkable tile.
 */
export const HUB = {
  /** Son family home: Chi-Chi's yard spot and Goten's training stump (world builder notes). */
  home: { map: 'paozu_home', arrive: [31, 10] as [number, number], chichi: [21, 9] as [number, number], goten: [35, 8] as [number, number] },
  /** Paozu Valley: Gohan & Videl's yard. */
  valley: { map: 'paozu_valley', videl: [8, 7] as [number, number], gohan: [7, 7] as [number, number] },
  /** Capsule Corp grounds. Whis (Act 2's overlay) sits at the garden table at (23,17); Beerus takes the other side. */
  cc: { map: 'cc_yard', arrive: [22, 20] as [number, number], whis: [24, 18] as [number, number], beerus: [25, 16] as [number, number], bulma: [20, 18] as [number, number], vegeta: [17, 19] as [number, number] },
  /** Satan City downtown. */
  plaza: { map: 'satan_plaza', arrive: [24, 27] as [number, number], director: [8, 14] as [number, number], filmReturn: [8, 15] as [number, number], krillin: [20, 23] as [number, number], k18: [18, 23] as [number, number], porter: [31, 5] as [number, number], roofReturn: [31, 6] as [number, number], fans: [14, 23] as [number, number] },
  /** Kame Island. */
  kame: { map: 'kame_island', arrive: [20, 22] as [number, number], roshi: [21, 13] as [number, number], krillin: [24, 14] as [number, number], chiaotzu: [16, 13] as [number, number], dock: [20, 22] as [number, number] },
  /** Kami's Lookout platform. */
  lookout: { map: 'lookout', arrive: [22, 22] as [number, number], piccolo: [27, 23] as [number, number], dende: [22, 11] as [number, number] },
  /** Hell: the cocoon island. */
  hell: { map: 'hell_lake', island: [20, 10] as [number, number], cocoon: [22, 11] as [number, number], entry: [20, 26] as [number, number] },
  /** Zeno's palace hall. */
  zeno: { map: 'zeno_palace', hall: [29, 7] as [number, number], arrive: [20, 26] as [number, number], zeno: [20, 4] as [number, number] },
};
