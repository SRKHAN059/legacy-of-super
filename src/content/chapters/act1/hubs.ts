/**
 * Coordinates on the shared hub maps (built by the world agents) that Act 1 scripts and overlays rely on.
 * Kept in one place so a hub layout change only needs one edit here. All values are tiles: [x, y].
 */
export const HUB = {
  // Future Earth (farC: future.ts).
  hideoutIn: {
    bunk: [3, 5], bulma: [16, 7], mai: [9, 10], door: [9.5, 11], save: [1, 12],
    /** The gap in the lab's south wall (common room -> lab). */
    labDoor: [15.5, 9],
    /** Where Trunks climbs into the time machine (the prop sits at 14,5). */
    cockpit: [15, 7],
    /** Ambient Resistance NPCs owned by the world builder (cleared during the attack). */
    ambient: ['fc_medic', 'fc_tamo', 'fc_kiko'],
  },
  hideoutOut: { tunnelDoor: [5, 9], tunnelArrive: [5.5, 11] },
  // Mt. Paozu (earthA: paozu.ts).
  paozuHouse: { bed: [14, 4], chichi: [7, 5], wakeChichi: [13, 6], door: [5.5, 10] },
  paozuHome: { goten: [12, 18] },
  paozuValley: { goten: [12, 7], trunks: [14, 7] },
  gohanHouse: { gohan: [4, 6], videl: [11, 7] },
  paozuForest: { caveDoor: [5.5, 4], caveArrive: [6.5, 6], hiro: [40, 13], goat: [6, 22] },
  paozuPeaks: { springDoor: [25, 2], springArrive: [25.5, 3.6], rexEnter: [31, 5], rexFight: [27, 6] },
  // Satan City (earthA: satan.ts).
  satanMansion: { satan: [17, 10] },
  satanPlaza: { kid: [24, 28] },
  satanShop: { shopper: [9, 5] },
  satanDojo: { yamcha: [6, 12], krillin: [13, 12], tien: [16, 12], ring: [10, 5] },
  // Space (farC: space.ts).
  kingKai: { arrive: [16, 18], kingKai: [16, 13], bubbles: [12, 16], fight: [16, 15], whis: [20, 13], gregory: [19, 15] },
  beerusPalace: { bed: [2, 4], whis: [5, 5], arrive: [9.5, 11] },
  beerusGrounds: { fish: [17, 21], beerus: [20, 20], whis: [21, 21], arrive: [24, 20] },
  // West City (earthB: westcity.ts).
  ccGravity: { vegeta: [7.5, 7], door: [7.5, 9.5], drones: [[3, 4], [12, 4], [8, 8]] },
  ccYard: { driver: [17, 10] },
  wcStreets: { driver: [3, 16], cart: [26, 11], punks: [21, 26] },
} as const;
