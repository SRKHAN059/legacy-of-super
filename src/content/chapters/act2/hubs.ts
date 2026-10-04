/**
 * Coordinates on the shared hub maps (built by the world builders) that act 2 depends on.
 * Kept in one place so a hub layout change only needs one edit here.
 */
export const HUB = {
  /** Arrival in Pilaf's castle when leaving the vault (next to the vault stairs overlay). */
  castleIn: { map: 'pilaf_castle_in', x: 2, y: 15 },
  /** Arrival on Beerus's planet from the training-field flight circle. */
  beerusFlight: { map: 'beerus_grounds', x: 33, y: 14 },
} as const;
