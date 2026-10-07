import { registerEnemies, type EnemyDef } from './enemies';

/**
 * Shared regular enemies, tiered on LoG2's stat curve. Tier guide (intended hero level → stats):
 * T1 L1-5 HP 40-70 STR 6-8 END 3-5 | T2 L6-12 HP 150-300 STR 12-18 END 8-14 | T3 L13-20 HP 400-700 STR 20-28 END 15-22
 * T4 L21-28 HP 800-1200 STR 28-36 END 22-30 | T5 L29-36 HP 1400-2200 STR 36-46 END 30-40
 * T6 L37-44 HP 2500-4000 STR 46-58 END 40-50 | T7 L45-50 HP 4500-6500 STR 58-70 END 50-62
 * Chapter files add story enemies and bosses with `registerEnemies`.
 * Every entry is placed on a hub map (the world test checks it), except the Frieza Soldier grunt, which only comes
 * in Resurrection 'F''s scripted waves. `drops: 'water'` marks the riverside and shore
 * wildlife that can drop a Fish (4% per kill while the pouch holds fewer than 3), Korin's 3-fish Senzu trade:
 * crabs on the Paozu and Korin Forest rivers, the Paozu Peaks pool and Turtle Reef, vipers on the Korin river,
 * Ten-Palm Oasis, Turtle Reef and (from Chapter 3) the Paozu Peaks pool, king crabs at the oasis and on the reef's
 * outer atoll.
 * The engine keeps late tiers dangerous on its own (Guide §6): damage scales with the attacking stat above 28
 * (`enemyPowerScale`) and regular enemies above STR/POW 44 spawn with up to 25% less HP (`enemyMaxHp`).
 * EXP is paced, not copied: a LoG2 port met far below the level LoG2 sets it against would pay half a level a kill
 * there (the ROM clamp), so each zone's residents pay what makes a level cost LoG2's fair-bot minutes at the level the
 * zone is entered at (tests/grind.test.ts, critic round 3: about 0.3-1.6 below L16, 0.7-1.3 at L16-29, 1-1.5 at
 * L30-39, 2.7-3.1 from L40). Where a ROM row is kept value for value, the comment says so.
 */
const SHARED: EnemyDef[] = [
  // Wolves (rusher packs).
  { id: 'wolf', name: 'Wolf', sprite: 'wolf', hp: 65, str: 8, pow: 1, end: 4, exp: 45, ai: 'rusher', speed: 1.1, desc: 'A hungry mountain wolf. Hunts in packs.' },
  // Rocky Wasteland wildlife (timber wolves, sabertooths, pterodactyls, raptors, warthogs, the grizzled bear) is tuned
  // for the Gohan L16 and Piccolo L18 of Resurrection 'F' (Chapter 5), LoG2's Southern Continent band: about 5-8 hits
  // to kill and 16-22 to knock the hero out. Their EXP (500 for the Southern Continent tier, 2,500 for the grizzled
  // bear) makes a level about a fair-bot minute there, as in LoG2; the Chapter 8 Frieza Force camp outranks it.
  { id: 'timberWolf', name: 'Timber Wolf', sprite: 'timberWolf', hp: 260, str: 11, pow: 1, end: 10, exp: 320, ai: 'rusher', speed: 1.25, desc: 'A larger forest wolf with a vicious bite.' },
  { id: 'snowWolf', name: 'Snow Wolf', sprite: 'snowWolf', hp: 1000, str: 33, pow: 1, end: 27, exp: 4700, ai: 'rusher', speed: 1.35, desc: 'A white-furred wolf of the frozen north.' },
  // Dire wolves and giant snakes live in the Chapter 12-13 zones (Paozu Highlands, Gohan's training ground, the
  // Snowy Highlands; the Forest of Terror, Baba's lake): LoG2's grind band for the Goku L35-41 and Gohan L39 who walk
  // in, about 7 hits to kill and 12-18 to knock out. STR 45 keeps the dire wolf in the late tier whose HP the engine
  // trims (`enemyMaxHp`, tests/engine.test.ts). Ten giant snakes ring Baba's lake, their home at Goku L41: at their
  // EXP a level there costs about three fair-bot minutes, LoG2's pace from L40.
  { id: 'direWolf', name: 'Dire Wolf', sprite: 'direWolf', hp: 1350, str: 45, pow: 1, end: 36, exp: 22000, ai: 'rusher', speed: 1.45, desc: 'A monstrous wolf. Its howl chills even Saiyans.' },
  // Big cats.
  { id: 'sabertooth', name: 'Sabertooth', sprite: 'sabertooth', hp: 400, str: 11, pow: 1, end: 12, exp: 500, ai: 'rusher', speed: 1.4, desc: 'A prehistoric cat with dagger fangs.' },
  { id: 'iceSabertooth', name: 'Ice Sabertooth', sprite: 'iceSabertooth', hp: 1500, str: 40, pow: 1, end: 21, exp: 12000, ai: 'rusher', speed: 1.5, desc: 'A sabertooth adapted to arctic hunting.' },
  // Snakes (long reach). The grass snake (like the cave bat) bites with STR 6, one under LoG2's Snake 53: Goku walks
  // into his first hostile zones (Paozu Forest, the shrine cave) at L2 with 105 HP and END 6, and LoG2's first-zone
  // band at Gohan L3 is about 4 hits to kill and 13 to knock out. The viper keeps LoG2's Snake 83 HP (275) and bites
  // with STR 13 (ROM 15) for the Goku L11 SSJ of Chapter 3 on Turtle Reef and the Korin river and the Vegeta L12 SSJ
  // at Ten-Palm Oasis: 5-6 hits to kill, 12-14 to knock out. It pays 120 EXP, not the ROM's 600 (LoG2 meets it at
  // L22). On Paozu Peaks it works the pool from Chapter 3 on.
  { id: 'snake', name: 'Snake', sprite: 'snake', hp: 35, str: 6, pow: 1, end: 3, exp: 30, ai: 'reach', speed: 0.8, desc: 'A grass snake. Strikes from farther than you\'d expect.' },
  { id: 'viper', name: 'Viper', sprite: 'viper', hp: 275, str: 13, pow: 1, end: 12, exp: 120, ai: 'reach', speed: 0.9, drops: 'water', desc: 'A purple swamp viper.' },
  // Diablo Desert is the Vegeta 15 gate's grind zone. Its residents (this sand snake; the scarab, bandit brute, Pilaf
  // Machine and Guard Drone below) are tuned for the Vegeta L12-15 SSJ who walks in, LoG2's Warlord's Domain to
  // Southern Continent band (about 3-7 hits to kill, 16-19 to knock out). The brute has LoG2's Tiger Bandit stat
  // block (ROM entry 9). The desert's own residents pay 140-250 EXP a kill, so a level costs about a fair-bot minute
  // of the desert and the gate the five-plus minutes LoG2's gates did. Pilaf's machines pay more (900; the Guard Drone
  // keeps LoG2's Ladybug 66 EXP, 520): the Goku L10-11 of the Dragon Ball hunt fights through the castle and the
  // vault, where the ROM clamp holds a kill to half a level, and the Beerus fight is tuned at the level that brings.
  { id: 'sandSnake', name: 'Sand Snake', sprite: 'sandSnake', hp: 340, str: 11, pow: 1, end: 12, exp: 200, ai: 'reach', speed: 1.0, desc: 'A desert snake that hides in dunes.' },
  { id: 'giantSnake', name: 'Giant Snake', sprite: 'giantSnake', hp: 1400, str: 39, pow: 1, end: 32, exp: 14500, ai: 'reach', speed: 0.9, box: { w: 22, h: 10 }, desc: 'A serpent large enough to swallow a car.' },
  // Flyers. The hawk is LoG2's Hawk 58 without its L22 stat block: it flies over Goku's Chapter 1 zones (Paozu Forest
  // at L2; the peaks and the hot spring at L4), so it has 70 HP and STR 7, about 6 hits to kill at L2 and 12 to knock
  // Goku out at L4. Its 140 EXP is what the ROM clamp pays for a kill at L4 anyway, and no more on the Chapter 3-5
  // grounds it also crosses. The cave bat bites with STR 6 (see the snakes).
  { id: 'hawk', name: 'Hawk', sprite: 'hawk', hp: 70, str: 7, pow: 1, end: 5, exp: 140, ai: 'flyer', speed: 1.2, desc: 'A territorial hawk. Swoops at intruders.' },
  { id: 'pterodactyl', name: 'Pterodactyl', sprite: 'pterodactyl', hp: 400, str: 11, pow: 1, end: 12, exp: 500, ai: 'flyer', speed: 1.3, desc: 'A flying reptile with a long beak.' },
  { id: 'stormPtero', name: 'Storm Pterodactyl', sprite: 'stormPtero', hp: 1200, str: 40, pow: 1, end: 30, exp: 17000, ai: 'flyer', speed: 1.5, desc: 'A pterodactyl that nests in thunderclouds.' },
  { id: 'caveBat', name: 'Cave Bat', sprite: 'cave_bat', hp: 50, str: 6, pow: 1, end: 3, exp: 40, ai: 'flyer', speed: 1.3, desc: 'A bat that hates being woken up.' },
  // The fire bat haunts Hell's shore before Chapter 13 (hell_lake, a story-warp map first seen in Chapter 4), set like
  // Beerus's planet's wildlife for the Vegeta L15 SSJ of that chapter: 6 hits to kill, 16 to knock out, and EXP for
  // LoG2's pace at L15.
  { id: 'fireBat', name: 'Fire Bat', sprite: 'fireBat', hp: 390, str: 14, pow: 1, end: 16, exp: 760, ai: 'flyer', speed: 1.5, desc: 'A bat from volcanic caves. Its wings smoulder.' },
  // Dinosaurs.
  { id: 'raptor', name: 'Raptor', sprite: 'raptor', hp: 300, str: 11, pow: 1, end: 12, exp: 500, ai: 'rusher', speed: 1.4, desc: 'A pack-hunting dinosaur.' },
  { id: 'redRaptor', name: 'Red Raptor', sprite: 'redRaptor', hp: 1400, str: 38, pow: 1, end: 30, exp: 20000, ai: 'rusher', speed: 1.6, desc: 'An alpha raptor with crimson scales.' },
  { id: 'tRex', name: 'T-Rex', sprite: 'tRex', hp: 1750, str: 40, pow: 1, end: 30, exp: 3750, ai: 'charger', speed: 0.9, box: { w: 22, h: 10 }, desc: 'The king of dinosaurs. Charges anything that moves.' },
  { id: 'blueTRex', name: 'Blue T-Rex', sprite: 'blueTRex', hp: 5120, str: 50, pow: 1, end: 45, exp: 36900, ai: 'charger', speed: 1.0, box: { w: 22, h: 10 }, desc: 'A rare blue tyrant. Prized by grinders.' },
  // Boars and bears. The brown bear is LoG2's first Kuma tier (125 HP, 17/1/15) at its ROM EXP, 250.
  { id: 'boar', name: 'Warthog', sprite: 'boar', hp: 300, str: 11, pow: 1, end: 12, exp: 500, ai: 'charger', speed: 1.2, desc: 'Tusked boars that charge in herds.' },
  { id: 'bear', name: 'Brown Bear', sprite: 'bear', hp: 125, str: 17, pow: 1, end: 15, exp: 250, ai: 'heavy', speed: 0.8, box: { w: 20, h: 10 }, desc: 'A mountain bear. Hits hard, moves slow.' },
  { id: 'greyBear', name: 'Grizzled Bear', sprite: 'greyBear', hp: 450, str: 14, pow: 1, end: 16, exp: 2500, ai: 'heavy', speed: 0.9, box: { w: 20, h: 10 }, desc: 'An old bear scarred by countless fights.' },
  // Bugs (Korin Forest, Paozu Peaks; scarabs in Diablo Desert). Giant hornets swarm the peaks' basin, where Goku comes
  // for Scarface at L4 (Chapter 1): 85 HP and STR 7 make them about 5 hits to kill and 12 to knock him out, EXP kept.
  // Korin Forest's Chapter 3 visitors (L11 SSJ) swat hornets and rhino beetles in two.
  { id: 'beetle', name: 'Rhino Beetle', sprite: 'beetle', hp: 90, str: 9, pow: 1, end: 9, exp: 120, ai: 'rusher', speed: 0.9, desc: 'An armoured beetle. Shrugs off light blows.' },
  { id: 'hornet', name: 'Giant Hornet', sprite: 'hornet', hp: 85, str: 7, pow: 1, end: 6, exp: 260, ai: 'flyer', speed: 1.5, desc: 'A hornet the size of a dog.' },
  { id: 'scarab', name: 'Jade Scarab', sprite: 'scarab', hp: 380, str: 11, pow: 1, end: 20, exp: 250, ai: 'rusher', speed: 1.0, resKi: 0.5, desc: 'A scarab with a ki-resistant shell. Use your fists.' },
  // Water (Fish drops). King Crab is LoG2's Alligator (Tropical Islands: 600 HP, 29/1/20), paying 300 EXP rather than
  // the ROM's 5,400: LoG2 meets it at L30, the oasis at L12. The shore crab pinches on the Paozu river from Goku's L2
  // first visit, so it is a shelled T1 (65 HP, STR 6, END 8: 6 hits to kill at L2, 2 for the Chapter 3 Goku on Turtle
  // Reef); its 140 EXP is the ROM clamp's ceiling at L4.
  { id: 'crab', name: 'Shore Crab', sprite: 'crab', hp: 65, str: 6, pow: 1, end: 8, exp: 140, ai: 'rusher', speed: 0.7, drops: 'water', desc: 'A big crab with bigger claws.' },
  { id: 'kingCrab', name: 'King Crab', sprite: 'kingCrab', hp: 600, str: 29, pow: 1, end: 20, exp: 300, ai: 'heavy', speed: 0.7, drops: 'water', desc: 'An enormous crab that rules the reefs, and any pond it can crawl to.' },
  // Machines.
  { id: 'drone', name: 'Patrol Drone', sprite: 'drone', hp: 29, str: 1, pow: 7, end: 4, exp: 25, ai: 'shooter', speed: 0.9, flying: true, shot: { color: '#f04040', cooldown: 90, speed: 2.2, mult: 0.7 }, desc: 'A hovering security drone. Fires laser bolts.' },
  { id: 'greenDrone', name: 'Guard Drone', sprite: 'greenDrone', hp: 175, str: 1, pow: 11, end: 12, exp: 520, ai: 'shooter', speed: 1.0, flying: true, shot: { color: '#f0f040', cooldown: 80, speed: 2.4, mult: 0.8 }, desc: 'An upgraded drone with rapid lasers.' },
  { id: 'goldDrone', name: 'Elite Drone', sprite: 'goldDrone', hp: 700, str: 1, pow: 32, end: 29, exp: 11200, ai: 'shooter', speed: 1.1, flying: true, shot: { color: '#f8a020', cooldown: 70, speed: 2.6, mult: 0.9 }, desc: 'A gold-plated drone with heavy cannons.' },
  { id: 'pilafRobot', name: 'Pilaf Machine', sprite: 'pilafRobot', hp: 250, str: 11, pow: 11, end: 14, exp: 900, ai: 'heavy', speed: 0.7, desc: 'A clunky robot built by the Pilaf Gang. Has a flamethrower.' },
  { id: 'mechTrooper', name: 'Mech Trooper', sprite: 'mechTrooper', hp: 1463, str: 32, pow: 39, end: 29, exp: 4170, ai: 'heavy', speed: 0.8, desc: 'A military battle robot.' },
  { id: 'redMech', name: 'Red Destroyer', sprite: 'redMech', hp: 3120, str: 44, pow: 42, end: 40, exp: 43180, ai: 'heavy', speed: 0.85, desc: 'A crimson war machine. Flamethrower and crushing fists.' },
  { id: 'goldMech', name: 'Gold Destroyer', sprite: 'goldMech', hp: 4200, str: 49, pow: 44, end: 43, exp: 58900, ai: 'heavy', speed: 0.9, desc: 'The deadliest model. Guards places worth guarding.' },
  // Slimes: bog slimes on the Paozu river, mud golems on Turtle Reef's outer atoll (LoG2 sets this Eggbot against its
  // L22 Piccolo; Earth A's tide slimes hold the reef's Chapter 3 flats), void oozes in the Highland Peak ice cave
  // (LoG2's lowest and highest Eggbot tiers at their ROM EXP: 875 / 46,200).
  { id: 'slime', name: 'Bog Slime', sprite: 'slime', hp: 45, str: 6, pow: 1, end: 3, exp: 20, ai: 'rusher', speed: 0.6, desc: 'A wobbling glob of swamp gunk.' },
  { id: 'mudSlime', name: 'Mud Golem', sprite: 'mudSlime', hp: 250, str: 19, pow: 25, end: 18, exp: 875, ai: 'exploder', speed: 0.9, desc: 'A living mudball that bursts when destroyed. Keep your distance.' },
  { id: 'voidSlime', name: 'Void Ooze', sprite: 'voidSlime', hp: 1349, str: 47, pow: 53, end: 52, exp: 46200, ai: 'exploder', speed: 1.1, desc: 'Ooze from between dimensions. Explodes violently.' },
  // Humans / soldiers. Troopers, heavies and elites (LoG2's Warlord's Henchmen tiers) are the Frieza Force remnants
  // who camp on the Great Mesa from Chapter 8, tuned for the Vegeta L26 SSB who finds them (LoG2's Outside Gingertown
  // band: 7-9 hits to kill, 16 to knock out); the trooper keeps its ROM HP and EXP (Henchman 12) and the heavy its
  // ROM HP (Henchman 51), while the heavy and the elite pay what makes the camp cost about a fair-bot minute a level at
  // L26 (LoG2 meets the 16,200-EXP Henchman at L40).
  { id: 'bandit', name: 'Bandit', sprite: 'bandit', hp: 38, str: 6, pow: 3, end: 4, exp: 14, ai: 'shooter', speed: 0.9, shot: { color: '#d0d0d0', cooldown: 110, speed: 2.0, mult: 0.7 }, desc: 'A desert bandit with a pistol and bad manners.' },
  { id: 'banditBrute', name: 'Bandit Brute', sprite: 'banditChief', hp: 325, str: 10, pow: 12, end: 8, exp: 140, ai: 'rusher', speed: 1.0, desc: 'A hulking bandit enforcer.' },
  { id: 'soldier', name: 'Frieza Soldier', sprite: 'frizaSoldier', hp: 90, str: 12, pow: 15, end: 8, exp: 325, ai: 'shooter', speed: 1.0, shot: { color: '#f070f0', cooldown: 90, speed: 2.3, mult: 0.8 }, desc: 'A Frieza Force grunt. Fires ki blasts from range.' },
  { id: 'soldierB', name: 'Frieza Trooper', sprite: 'frizaSoldierB', hp: 900, str: 30, pow: 34, end: 26, exp: 3200, ai: 'rusher', speed: 1.2, desc: 'A seasoned Frieza Force trooper. Prefers close combat.' },
  { id: 'soldierC', name: 'Frieza Heavy', sprite: 'frizaSoldierC', hp: 1100, str: 30, pow: 30, end: 28, exp: 9000, ai: 'heavy', speed: 0.8, desc: 'A bulky Frieza Force brute.' },
  { id: 'soldierElite', name: 'Frieza Elite', sprite: 'frizaElite', hp: 1000, str: 34, pow: 30, end: 30, exp: 2500, ai: 'shooter', speed: 1.2, shot: { color: '#60d0f8', cooldown: 60, speed: 2.8, mult: 0.9 }, desc: 'An elite Frieza Force officer.' },
];

registerEnemies(SHARED);

/** Ids of the shared regular enemies (for world placement checks). */
export const BESTIARY_IDS: readonly string[] = SHARED.map((e) => e.id);
