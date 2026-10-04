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
 * crabs on the Paozu and Korin Forest rivers and Turtle Reef, vipers on the Paozu Peaks pool, the Korin river,
 * Ten-Palm Oasis and Turtle Reef, king crabs at the oasis and on the reef's outer atoll.
 * The engine keeps late tiers dangerous on its own (Guide §6): damage scales with the attacking stat above 28
 * (`enemyPowerScale`) and regular enemies above STR/POW 44 spawn with up to 25% less HP (`enemyMaxHp`).
 */
const SHARED: EnemyDef[] = [
  // Wolves (rusher packs).
  { id: 'wolf', name: 'Wolf', sprite: 'wolf', hp: 65, str: 8, pow: 1, end: 4, exp: 45, ai: 'rusher', speed: 1.1, desc: 'A hungry mountain wolf. Hunts in packs.' },
  { id: 'timberWolf', name: 'Timber Wolf', sprite: 'timberWolf', hp: 260, str: 16, pow: 1, end: 11, exp: 320, ai: 'rusher', speed: 1.25, desc: 'A larger forest wolf with a vicious bite.' },
  { id: 'snowWolf', name: 'Snow Wolf', sprite: 'snowWolf', hp: 1000, str: 33, pow: 1, end: 27, exp: 4700, ai: 'rusher', speed: 1.35, desc: 'A white-furred wolf of the frozen north.' },
  { id: 'direWolf', name: 'Dire Wolf', sprite: 'direWolf', hp: 3200, str: 52, pow: 1, end: 45, exp: 30000, ai: 'rusher', speed: 1.45, desc: 'A monstrous wolf. Its howl chills even Saiyans.' },
  // Big cats.
  { id: 'sabertooth', name: 'Sabertooth', sprite: 'sabertooth', hp: 750, str: 32, pow: 1, end: 14, exp: 6160, ai: 'rusher', speed: 1.4, desc: 'A prehistoric cat with dagger fangs.' },
  { id: 'iceSabertooth', name: 'Ice Sabertooth', sprite: 'iceSabertooth', hp: 1500, str: 40, pow: 1, end: 21, exp: 20000, ai: 'rusher', speed: 1.5, desc: 'A sabertooth adapted to arctic hunting.' },
  // Snakes (long reach).
  { id: 'snake', name: 'Snake', sprite: 'snake', hp: 35, str: 7, pow: 1, end: 3, exp: 30, ai: 'reach', speed: 0.8, desc: 'A grass snake. Strikes from farther than you\'d expect.' },
  { id: 'viper', name: 'Viper', sprite: 'viper', hp: 275, str: 18, pow: 1, end: 12, exp: 600, ai: 'reach', speed: 0.9, drops: 'water', desc: 'A purple swamp viper.' },
  { id: 'sandSnake', name: 'Sand Snake', sprite: 'sandSnake', hp: 530, str: 28, pow: 1, end: 22, exp: 3290, ai: 'reach', speed: 1.0, desc: 'A desert snake that hides in dunes.' },
  { id: 'giantSnake', name: 'Giant Snake', sprite: 'giantSnake', hp: 2400, str: 44, pow: 1, end: 34, exp: 17355, ai: 'reach', speed: 0.9, box: { w: 22, h: 10 }, desc: 'A serpent large enough to swallow a car.' },
  // Flyers.
  { id: 'hawk', name: 'Hawk', sprite: 'hawk', hp: 110, str: 10, pow: 1, end: 5, exp: 300, ai: 'flyer', speed: 1.2, desc: 'A territorial hawk. Swoops at intruders.' },
  { id: 'pterodactyl', name: 'Pterodactyl', sprite: 'pterodactyl', hp: 900, str: 28, pow: 1, end: 16, exp: 9580, ai: 'flyer', speed: 1.3, desc: 'A flying reptile with a long beak.' },
  { id: 'stormPtero', name: 'Storm Pterodactyl', sprite: 'stormPtero', hp: 1200, str: 40, pow: 1, end: 30, exp: 25000, ai: 'flyer', speed: 1.5, desc: 'A pterodactyl that nests in thunderclouds.' },
  { id: 'caveBat', name: 'Cave Bat', sprite: 'cave_bat', hp: 50, str: 7, pow: 1, end: 3, exp: 40, ai: 'flyer', speed: 1.3, desc: 'A bat that hates being woken up.' },
  { id: 'fireBat', name: 'Fire Bat', sprite: 'fireBat', hp: 620, str: 26, pow: 1, end: 18, exp: 2400, ai: 'flyer', speed: 1.5, desc: 'A bat from volcanic caves. Its wings smoulder.' },
  // Dinosaurs.
  { id: 'raptor', name: 'Raptor', sprite: 'raptor', hp: 300, str: 20, pow: 1, end: 14, exp: 800, ai: 'rusher', speed: 1.4, desc: 'A pack-hunting dinosaur.' },
  { id: 'redRaptor', name: 'Red Raptor', sprite: 'redRaptor', hp: 1400, str: 38, pow: 1, end: 30, exp: 11000, ai: 'rusher', speed: 1.6, desc: 'An alpha raptor with crimson scales.' },
  { id: 'tRex', name: 'T-Rex', sprite: 'tRex', hp: 1750, str: 40, pow: 1, end: 30, exp: 3750, ai: 'charger', speed: 0.9, box: { w: 22, h: 10 }, desc: 'The king of dinosaurs. Charges anything that moves.' },
  { id: 'blueTRex', name: 'Blue T-Rex', sprite: 'blueTRex', hp: 5120, str: 50, pow: 1, end: 45, exp: 36900, ai: 'charger', speed: 1.0, box: { w: 22, h: 10 }, desc: 'A rare blue tyrant. Prized by grinders.' },
  // Boars and bears. The brown bear is LoG2's first Kuma tier (125 HP, 17/1/15) at its ROM EXP, 250.
  { id: 'boar', name: 'Warthog', sprite: 'boar', hp: 300, str: 20, pow: 1, end: 14, exp: 800, ai: 'charger', speed: 1.2, desc: 'Tusked boars that charge in herds.' },
  { id: 'bear', name: 'Brown Bear', sprite: 'bear', hp: 125, str: 17, pow: 1, end: 15, exp: 250, ai: 'heavy', speed: 0.8, box: { w: 20, h: 10 }, desc: 'A mountain bear. Hits hard, moves slow.' },
  { id: 'greyBear', name: 'Grizzled Bear', sprite: 'greyBear', hp: 940, str: 35, pow: 1, end: 32, exp: 9800, ai: 'heavy', speed: 0.9, box: { w: 20, h: 10 }, desc: 'An old bear scarred by countless fights.' },
  // Bugs (Korin Forest, Paozu Peaks; scarabs in Diablo Desert).
  { id: 'beetle', name: 'Rhino Beetle', sprite: 'beetle', hp: 90, str: 9, pow: 1, end: 9, exp: 120, ai: 'rusher', speed: 0.9, desc: 'An armoured beetle. Shrugs off light blows.' },
  { id: 'hornet', name: 'Giant Hornet', sprite: 'hornet', hp: 180, str: 15, pow: 1, end: 8, exp: 260, ai: 'flyer', speed: 1.5, desc: 'A hornet the size of a dog.' },
  { id: 'scarab', name: 'Jade Scarab', sprite: 'scarab', hp: 700, str: 30, pow: 1, end: 34, exp: 5400, ai: 'rusher', speed: 1.0, resKi: 0.5, desc: 'A scarab with a ki-resistant shell. Use your fists.' },
  // Water (Fish drops). King Crab is LoG2's Alligator (Tropical Islands: 600 HP, 29/1/20, 5,400 EXP).
  { id: 'crab', name: 'Shore Crab', sprite: 'crab', hp: 120, str: 12, pow: 1, end: 12, exp: 200, ai: 'rusher', speed: 0.7, drops: 'water', desc: 'A big crab with bigger claws.' },
  { id: 'kingCrab', name: 'King Crab', sprite: 'kingCrab', hp: 600, str: 29, pow: 1, end: 20, exp: 5400, ai: 'heavy', speed: 0.7, drops: 'water', desc: 'An enormous crab that rules the reefs, and any pond it can crawl to.' },
  // Machines.
  { id: 'drone', name: 'Patrol Drone', sprite: 'drone', hp: 29, str: 1, pow: 7, end: 4, exp: 25, ai: 'shooter', speed: 0.9, flying: true, shot: { color: '#f04040', cooldown: 90, speed: 2.2, mult: 0.7 }, desc: 'A hovering security drone. Fires laser bolts.' },
  { id: 'greenDrone', name: 'Guard Drone', sprite: 'greenDrone', hp: 175, str: 1, pow: 17, end: 12, exp: 520, ai: 'shooter', speed: 1.0, flying: true, shot: { color: '#f0f040', cooldown: 80, speed: 2.4, mult: 0.8 }, desc: 'An upgraded drone with rapid lasers.' },
  { id: 'goldDrone', name: 'Elite Drone', sprite: 'goldDrone', hp: 700, str: 1, pow: 32, end: 29, exp: 11200, ai: 'shooter', speed: 1.1, flying: true, shot: { color: '#f8a020', cooldown: 70, speed: 2.6, mult: 0.9 }, desc: 'A gold-plated drone with heavy cannons.' },
  { id: 'pilafRobot', name: 'Pilaf Machine', sprite: 'pilafRobot', hp: 250, str: 19, pow: 25, end: 18, exp: 1450, ai: 'heavy', speed: 0.7, desc: 'A clunky robot built by the Pilaf Gang. Has a flamethrower.' },
  { id: 'mechTrooper', name: 'Mech Trooper', sprite: 'mechTrooper', hp: 1463, str: 32, pow: 39, end: 29, exp: 4170, ai: 'heavy', speed: 0.8, desc: 'A military battle robot.' },
  { id: 'redMech', name: 'Red Destroyer', sprite: 'redMech', hp: 3120, str: 44, pow: 42, end: 40, exp: 43180, ai: 'heavy', speed: 0.85, desc: 'A crimson war machine. Flamethrower and crushing fists.' },
  { id: 'goldMech', name: 'Gold Destroyer', sprite: 'goldMech', hp: 4200, str: 49, pow: 44, end: 43, exp: 58900, ai: 'heavy', speed: 0.9, desc: 'The deadliest model. Guards places worth guarding.' },
  // Slimes: bog slimes on the Paozu river, mud golems on Turtle Reef, void oozes in the Highland Peak ice cave
  // (LoG2's lowest and highest Eggbot tiers at their ROM EXP: 875 / 46,200).
  { id: 'slime', name: 'Bog Slime', sprite: 'slime', hp: 45, str: 6, pow: 1, end: 3, exp: 20, ai: 'rusher', speed: 0.6, desc: 'A wobbling glob of swamp gunk.' },
  { id: 'mudSlime', name: 'Mud Golem', sprite: 'mudSlime', hp: 250, str: 19, pow: 25, end: 18, exp: 875, ai: 'exploder', speed: 0.9, desc: 'A living mudball that bursts when destroyed. Keep your distance.' },
  { id: 'voidSlime', name: 'Void Ooze', sprite: 'voidSlime', hp: 1349, str: 47, pow: 53, end: 52, exp: 46200, ai: 'exploder', speed: 1.1, desc: 'Ooze from between dimensions. Explodes violently.' },
  // Humans / soldiers. Troopers, heavies and elites (LoG2's Warlord's Henchmen tiers) are the Frieza Force remnants
  // who camp on the Great Mesa from Chapter 8.
  { id: 'bandit', name: 'Bandit', sprite: 'bandit', hp: 38, str: 6, pow: 3, end: 4, exp: 14, ai: 'shooter', speed: 0.9, shot: { color: '#d0d0d0', cooldown: 110, speed: 2.0, mult: 0.7 }, desc: 'A desert bandit with a pistol and bad manners.' },
  { id: 'banditBrute', name: 'Bandit Brute', sprite: 'banditChief', hp: 325, str: 18, pow: 12, end: 12, exp: 650, ai: 'rusher', speed: 1.0, desc: 'A hulking bandit enforcer.' },
  { id: 'soldier', name: 'Frieza Soldier', sprite: 'frizaSoldier', hp: 90, str: 12, pow: 15, end: 8, exp: 325, ai: 'shooter', speed: 1.0, shot: { color: '#f070f0', cooldown: 90, speed: 2.3, mult: 0.8 }, desc: 'A Frieza Force grunt. Fires ki blasts from range.' },
  { id: 'soldierB', name: 'Frieza Trooper', sprite: 'frizaSoldierB', hp: 900, str: 30, pow: 34, end: 26, exp: 3200, ai: 'rusher', speed: 1.2, desc: 'A seasoned Frieza Force trooper. Prefers close combat.' },
  { id: 'soldierC', name: 'Frieza Heavy', sprite: 'frizaSoldierC', hp: 1100, str: 36, pow: 36, end: 36, exp: 16200, ai: 'heavy', speed: 0.8, desc: 'A bulky Frieza Force brute.' },
  { id: 'soldierElite', name: 'Frieza Elite', sprite: 'frizaElite', hp: 2000, str: 42, pow: 48, end: 38, exp: 22000, ai: 'shooter', speed: 1.2, shot: { color: '#60d0f8', cooldown: 60, speed: 2.8, mult: 0.9 }, desc: 'An elite Frieza Force officer.' },
];

registerEnemies(SHARED);

/** Ids of the shared regular enemies (for world placement checks). */
export const BESTIARY_IDS: readonly string[] = SHARED.map((e) => e.id);
