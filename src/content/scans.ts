import { ENEMIES } from './enemies';

/** Scouter reading for a named character, creature or extra (LoG2 §8.5). Playable characters and gods show ???. */
export interface ScanEntry {
  name: string;
  /** Race / universe / affiliation line, e.g. "U6 Saiyan / Sadala". Must fit one 116 px database line. */
  kind?: string;
  hp: number | string;
  str: number | string;
  pow: number | string;
  end: number | string;
  desc: string;
}

/** A resolved reading: the database id it is filed under (`npc:<key>` or `enemy:<id>`) plus what the scouter shows. */
export interface ScanReading {
  id: string;
  /** Sprite drawn for this entry in the Capsule Corp database. */
  sprite: string;
  entry: ScanEntry;
  /** True for NPC entries (portrait shown when the sprite has one), false for bestiary entries. */
  npc: boolean;
}

/** Scan key every generic townsperson is filed under (LoG2's 22 "Human" entries collapse into one). */
export const GENERIC_SCAN_KEY = 'human';

/** The reading for anyone in {@link GENERIC_SCAN_SPRITES}: LoG2's "Human, HP 32". */
export const GENERIC_SCAN: ScanEntry = { name: 'Earthling', kind: 'Earthling', hp: 32, str: 2, pow: 1, end: 2, desc: 'An ordinary Earthling. No notable power level.' };

/**
 * Sprites worn by ordinary, interchangeable townsfolk. Only these may fall back to {@link GENERIC_SCAN}; every other
 * sprite needs its own entry, an alias, or (creature stand-ins only) a bestiary entry drawn with the same sprite.
 */
export const GENERIC_SCAN_SPRITES: ReadonlySet<string> = new Set([
  'townsman', 'townswoman', 'oldMan', 'kidNpc', 'police', 'scientist', 'farmer', 'reporter', 'waiter',
  'ea_girl', 'ea_jogger', 'ea_tourist', 'ea_suit', 'ea_clerk', 'eb_clerk', 'eb_suit', 'eb_worker',
]);

/** Forms, outfits and stand-ins that file under their base character's entry (`vegetaCasual` scans as Vegeta). */
export const SCAN_ALIASES: Record<string, string> = {
  gokuSSJ: 'goku', gokuSSG: 'goku', gokuSSB: 'goku', gokuUI: 'goku', gokuWhis: 'goku',
  vegetaSSJ: 'vegeta', vegetaSSB: 'vegeta', vegetaSSBE: 'vegeta', vegetaCasual: 'vegeta',
  gohanSSJ: 'gohan', gohanSuit: 'gohan', gohanUltimate: 'gohan', c12_saiyaman: 'gohan',
  futureTrunksSSJ: 'futureTrunks', futureTrunksRage: 'futureTrunks',
  piccoloUnweighted: 'piccolo', android17Top: 'android17', goldenFrieza: 'frieza', krillinGi: 'krillin',
  cabbaSSJ: 'cabba', blackRose: 'gokuBlack', c11_fusedHalf: 'fusedZamasu', c13_roshiMax: 'roshi',
};

/** Map NPCs in disguise or uniform: NPC id -> scan key (Krillin on duty wears the generic police sprite). */
export const NPC_SCAN_OVERRIDES: Record<string, string> = {
  c04_krillin: 'krillin',
};

export const SCANS: Record<string, ScanEntry> = {
  // ---------------------------------------------------------------- playable party (stats hidden, as in LoG2)
  goku: { name: 'Goku', kind: 'Saiyan / Z Fighter', hp: '???', str: '???', pow: '???', end: '???', desc: 'A Saiyan raised on Earth. Lives for the next strong opponent.' },
  vegeta: { name: 'Vegeta', kind: 'Saiyan / Prince', hp: '???', str: '???', pow: '???', end: '???', desc: 'Prince of all Saiyans. Proud, relentless and determined to surpass Goku.' },
  gohan: { name: 'Gohan', kind: 'Half-Saiyan / Son family', hp: '???', str: '???', pow: '???', end: '???', desc: 'Goku\'s eldest son, now a scholar. His hidden potential is enormous.' },
  piccolo: { name: 'Piccolo', kind: 'Namekian / Z Fighter', hp: '???', str: '???', pow: '???', end: '???', desc: 'A Namekian warrior and Gohan\'s mentor. Trains in weighted clothing.' },
  vegitoBlue: { name: 'Vegito', kind: 'Saiyan / Potara fusion', hp: '???', str: '???', pow: '???', end: '???', desc: 'Goku and Vegeta fused by Potara earrings, in Super Saiyan Blue. Confident, cocky, and off every chart.' },
  futureTrunks: { name: 'Trunks', kind: 'Half-Saiyan / Future', hp: '???', str: '???', pow: '???', end: '???', desc: 'A warrior from a ruined future. Carries a sword and a heavy heart.' },

  // ---------------------------------------------------------------- family & friends
  bulma: { name: 'Bulma', kind: 'Earthling / Capsule Corp', hp: 40, str: 2, pow: 1, end: 3, desc: 'Genius inventor and head of Capsule Corporation. Do not make her angry.' },
  chichi: { name: 'Chi-Chi', kind: 'Earthling / Son family', hp: 160, str: 14, pow: 2, end: 9, desc: 'Goku\'s wife. A former martial artist who runs the Son household with an iron ladle.' },
  krillin: { name: 'Krillin', kind: 'Earthling / Z Fighter', hp: 1800, str: 23, pow: 24, end: 17, desc: 'Earth\'s strongest human and Goku\'s oldest friend. Now a police officer.' },
  roshi: { name: 'Master Roshi', kind: 'Earthling / Turtle School', hp: 1500, str: 20, pow: 25, end: 18, desc: 'The Turtle Hermit. Ancient, lecherous, and far tougher than he looks.' },
  mrSatan: { name: 'Mr. Satan', kind: 'Earthling / Champion', hp: 50, str: 8, pow: 1, end: 6, desc: 'The World Champion and "savior of Earth". Surprisingly brave when it counts.' },
  goten: { name: 'Goten', kind: 'Half-Saiyan / Son family', hp: 900, str: 15, pow: 16, end: 12, desc: 'Goku\'s youngest son. Cheerful and frighteningly strong for his age.' },
  trunksKid: { name: 'Trunks', kind: 'Half-Saiyan / Briefs', hp: 950, str: 16, pow: 15, end: 13, desc: 'Vegeta and Bulma\'s son. Goten\'s best friend and partner in mischief.' },
  pan: { name: 'Pan', kind: 'Saiyan blood / Son family', hp: 120, str: 4, pow: 6, end: 3, desc: 'Gohan and Videl\'s baby daughter. Flew before she could walk, and her crying rattles windows.' },
  korin: { name: 'Korin', kind: 'Sacred cat / Korin Tower', hp: 3470, str: 22, pow: 30, end: 26, desc: 'An 800-year-old cat who grows Senzu beans at the top of his tower. Trades them for fish, of course.' },
  mrPopo: { name: 'Mr. Popo', kind: 'Genie / The Lookout', hp: 830, str: 12, pow: 20, end: 14, desc: 'Keeper of the Lookout for longer than anyone remembers. Tends the garden and serves the Guardian.' },
  shenronAvatar: { name: 'Shenron', kind: 'Eternal Dragon / Earth', hp: '???', str: '???', pow: '???', end: '???', desc: 'The Eternal Dragon of Earth\'s Dragon Balls. Grants a wish, then turns back to stone for a year.' },

  // ---------------------------------------------------------------- gods & angels
  beerus: { name: 'Beerus', kind: 'U7 God of Destruction', hp: '???', str: '???', pow: '???', end: '???', desc: 'God of Destruction of Universe 7. Readings exceed the scouter\'s limits.' },
  whis: { name: 'Whis', kind: 'U7 Angel / Beerus', hp: '???', str: '???', pow: '???', end: '???', desc: 'Beerus\'s attendant and martial arts teacher. An angel. The scouter refuses to guess.' },
  champa: { name: 'Champa', kind: 'U6 God of Destruction', hp: '???', str: '???', pow: '???', end: '???', desc: 'Beerus\'s twin brother and God of Destruction of Universe 6. Shares his brother\'s power and appetite.' },
  vados: { name: 'Vados', kind: 'U6 Angel / Champa', hp: '???', str: '???', pow: '???', end: '???', desc: 'Champa\'s attendant and Whis\'s older sister. Smiles politely while the scouter quietly gives up.' },
  supremeKai: { name: 'Supreme Kai', kind: 'U7 Supreme Kai', hp: 5200, str: 34, pow: 48, end: 40, desc: 'Shin, Supreme Kai of Universe 7. His life is linked to Beerus: if one of them falls, so does the other.' },
  oldKai: { name: 'Old Kai', kind: 'U7 Elder Kai', hp: 900, str: 6, pow: 60, end: 12, desc: 'A Supreme Kai from fifteen generations ago, once sealed in the Z Sword. Unlocks hidden power, for magazines.' },
  zeno: { name: 'Zeno', kind: 'Omni-King / All worlds', hp: '???', str: '???', pow: '???', end: '???', desc: 'King of All, above every god of the twelve universes. Has erased whole universes on a whim. Loves friends.' },
  grandPriest: { name: 'Grand Priest', kind: 'Angel / Zeno\'s court', hp: '???', str: '???', pow: '???', end: '???', desc: 'Zeno\'s attendant and father of every angel. Said to be the strongest being in all the universes.' },
  gowasu: { name: 'Gowasu', kind: 'U10 Supreme Kai', hp: 1600, str: 10, pow: 40, end: 20, desc: 'Supreme Kai of Universe 10. A patient teacher who believes mortals deserve another chance. Fond of tea.' },
  zamasu: { name: 'Zamasu', kind: 'U10 Kai / apprentice', hp: 6000, str: 48, pow: 52, end: 56, desc: 'Gowasu\'s apprentice, training to become Supreme Kai. Gifted, courteous, and quietly disgusted by mortals.' },
  fusedZamasu: { name: 'Fused Zamasu', kind: 'Potara fusion / god', hp: '???', str: '???', pow: '???', end: '???', desc: 'Black and Zamasu joined by Potara earrings. Half of him cannot die, and his readings spill off the lens.' },
  c14_superShenron: { name: 'Super Shenron', kind: 'Super Dragon / Zeno', hp: '???', str: '???', pow: '???', end: '???', desc: 'The dragon of the Super Dragon Balls, larger than a galaxy. Grants any wish at all.' },

  // ---------------------------------------------------------------- Universe 6
  hit: { name: 'Hit', kind: 'U6 assassin / Team U6', hp: 5200, str: 39, pow: 41, end: 46, desc: 'The legendary assassin of Universe 6. Stops time for a split second and strikes in the gap. Paid in advance.' },
  cabba: { name: 'Cabba', kind: 'U6 Saiyan / Sadala', hp: 3400, str: 32, pow: 33, end: 34, desc: 'A young soldier of the Sadala Defense Force. Polite, earnest, and a very fast learner.' },
  frost: { name: 'Frost', kind: 'U6 Frost Demon', hp: 3600, str: 33, pow: 35, end: 36, desc: 'Universe 6\'s celebrated hero and peacekeeper. His smile is perfect. His bow is perfect. Something is off.' },
  botamo: { name: 'Botamo', kind: 'U6 / Team U6', hp: 4000, str: 30, pow: 20, end: 40, desc: 'A rubbery bear-like fighter. Absorbs any blow without budging. Moving him is a different question.' },
  monaka: { name: 'Monaka', kind: 'U7 / Beerus\'s pick', hp: 45, str: 3, pow: 1, end: 4, desc: 'Beerus swears he is the strongest fighter in Universe 7. The scouter reads a delivery driver. One of them is wrong.' },
  c07_attendant: { name: 'Arena Attendant', kind: 'Nameless Planet / staff', hp: 40, str: 3, pow: 2, end: 3, desc: 'One of the staff hired to run the U6-U7 tournament. Has not stopped trembling since Zeno arrived.' },

  // ---------------------------------------------------------------- Universe 10 (Babari)
  babarian: { name: 'Babarian', kind: 'U10 Babarian', hp: 2000, str: 44, pow: 1, end: 38, desc: 'A native of planet Babari. Fights anything that is not a Babarian, and most things that are.' },
  c10_babarianChief: { name: 'Babarian Chief', kind: 'U10 Babarian / chief', hp: 4900, str: 49, pow: 40, end: 52, desc: 'The biggest, loudest Babarian on the planet. Guards the sacred fruit tree with his very large club.' },
  c10_babarianSlinger: { name: 'Babarian Slinger', kind: 'U10 Babarian', hp: 1700, str: 30, pow: 42, end: 34, desc: 'Throws rocks with frightening accuracy. Gowasu insists Babarians will invent writing one day.' },

  // ---------------------------------------------------------------- Tournament of Power
  prideTrooper: { name: 'Pride Trooper', kind: 'U11 / Pride Troopers', hp: 5400, str: 66, pow: 60, end: 58, desc: 'A member of Universe 11\'s elite justice squad. Disciplined, fast, and very sure of what is right.' },
  basil: { name: 'Basil', kind: 'U9 / Trio de Dangers', hp: 5000, str: 66, pow: 1, end: 54, desc: 'The kicking brother of Universe 9\'s Trio de Dangers. A wolf-man who never stops moving.' },
  lavender: { name: 'Lavender', kind: 'U9 / Trio de Dangers', hp: 5000, str: 50, pow: 66, end: 54, desc: 'The poison-breathing brother of the Trio de Dangers. Blinds his foes, then takes his time.' },
  bergamo: { name: 'Bergamo', kind: 'U9 / Trio de Dangers', hp: 9000, str: 64, pow: 62, end: 68, desc: 'Eldest of the Trio de Dangers. Grows larger with every blow he absorbs. Loves a speech.' },
  universeFighter: { name: 'Rival Fighter', kind: 'Multiverse / entrant', hp: 4800, str: 60, pow: 50, end: 52, desc: 'A warrior from another universe, fighting for its survival. Losing means their whole world is erased.' },
  c14_u2Fighter: { name: 'U2 Warrior', kind: 'U2 / Team U2', hp: 4700, str: 50, pow: 64, end: 52, desc: 'A warrior of love from Universe 2. Her heart-shaped blasts hurt surprisingly much.' },
  c14_u4Fighter: { name: 'U4 Fighter', kind: 'U4 / Team U4', hp: 5200, str: 64, pow: 1, end: 54, desc: 'A Universe 4 trickster. Quitela\'s team prefers traps and tricks to a fair fight.' },
  c14_u9Wolf: { name: 'U9 Fighter', kind: 'U9 / Team U9', hp: 4600, str: 60, pow: 1, end: 52, desc: 'A Universe 9 brawler with a wolf\'s snout. His universe is already in trouble, and he knows it.' },
  c14_u10Fighter: { name: 'U10 Fighter', kind: 'U10 / Team U10', hp: 4800, str: 58, pow: 62, end: 52, desc: 'A Universe 10 warrior. Fires pressurised water-ki blasts. Gowasu cheers every single one.' },

  // ---------------------------------------------------------------- Frieza Force & old enemies
  frizaSoldier: { name: 'Frieza Soldier', kind: 'Frieza Force / grunt', hp: 90, str: 12, pow: 15, end: 8, desc: 'One of Frieza\'s thousand. Fires ki blasts from range and panics up close.' },
  frizaSoldierB: { name: 'Frieza Trooper', kind: 'Frieza Force / trooper', hp: 900, str: 30, pow: 34, end: 26, desc: 'A seasoned Frieza Force trooper. Prefers close combat, and loot.' },
  frizaSoldierC: { name: 'Frieza Heavy', kind: 'Frieza Force / heavy', hp: 1100, str: 36, pow: 36, end: 36, desc: 'A bulky Frieza Force brute with a point-blank blaster and very big fists.' },
  frizaElite: { name: 'Frieza Elite', kind: 'Frieza Force / officer', hp: 2000, str: 42, pow: 48, end: 38, desc: 'A Frieza Force officer. Fast, accurate shots, and a scouter of his own pointed straight back at you.' },
  ginyu: { name: 'Captain Ginyu', kind: 'Frieza Force / Ginyu', hp: 2400, str: 34, pow: 32, end: 30, desc: 'Captain of the Ginyu Force. Swaps bodies with his foes. Spent years stuck in a frog\'s body after a swap went wrong on Namek.' },
  c12_raditz: { name: 'Raditz', kind: 'Saiyan / memory', hp: 1500, str: 30, pow: 28, end: 26, desc: 'Goku\'s older brother, dead for decades. The thing wearing his face in this forest is not him.' },
  c12_nappa: { name: 'Nappa', kind: 'Saiyan / memory', hp: 5200, str: 54, pow: 50, end: 58, desc: 'The Saiyan who nearly killed Krillin long ago. The forest has made him larger than life.' },
  c12_cell: { name: 'Cell', kind: 'Bio-Android / memory', hp: 8000, str: 60, pow: 60, end: 64, desc: 'Dr. Gero\'s perfect creation, gone since the Cell Games. Here it is fear wearing his shape.' },
  c09_dabura: { name: 'Dabura', kind: 'Demon King / Babidi', hp: 4900, str: 44, pow: 46, end: 50, desc: 'King of the Demon Realm, bound to Babidi\'s magic in Trunks\'s timeline. His spit turns flesh to stone.' },
  c09_babidi: { name: 'Babidi', kind: 'Wizard / Majin', hp: 300, str: 2, pow: 40, end: 4, desc: 'A wizard who came to Trunks\'s Earth to wake Majin Buu. Weak alone, terrible with servants.' },

  // ---------------------------------------------------------------- outlaws & aliens
  c08_gryll: { name: 'Gryll', kind: 'Space criminal', hp: 2600, str: 36, pow: 38, end: 40, desc: 'A space criminal on the run from the Galactic Patrol. Came to Potaufeu for its secret and found the Commeson.' },
  c08_gooGoten: { name: 'Copy Goten', kind: 'Commeson copy', hp: 1700, str: 41, pow: 40, end: 34, desc: 'A purple copy of Goten made by the Commeson. All of his energy, none of his manners.' },
  c08_gooTrunks: { name: 'Copy Trunks', kind: 'Commeson copy', hp: 1700, str: 40, pow: 42, end: 34, desc: 'A purple copy of Trunks made by the Commeson. Fires ki blasts and snickers about it.' },
  c08_gooGryll: { name: 'Copy Gryll', kind: 'Commeson copy', hp: 3400, str: 42, pow: 44, end: 46, desc: 'The Commeson wearing Gryll. It copies whatever it touches, power included.' },
  c08_gooHench: { name: 'Copy Henchman', kind: 'Commeson copy', hp: 1500, str: 39, pow: 36, end: 32, desc: 'One of Gryll\'s thugs, copied by the Commeson. The original is a puddle somewhere.' },
  c12_watagash: { name: 'Watagash', kind: 'Space parasite', hp: 7800, str: 56, pow: 58, end: 62, desc: 'A parasite wanted by the Galactic Patrol. Lives inside a host and mutates it from within.' },
  c13_assassin: { name: 'U9 Assassin', kind: 'U9 / hired killer', hp: 3400, str: 50, pow: 54, end: 46, desc: 'A killer sent by Universe 9\'s gods to remove Frieza before the tournament.' },
  poacher: { name: 'Poacher', kind: 'Galactic Poachers', hp: 3200, str: 48, pow: 52, end: 44, desc: 'A Galactic Poacher with a tranquilizer rifle. Hunts rare animals for alien collectors.' },
  c13_poacherBoss: { name: 'Poacher Boss', kind: 'Galactic Poachers / boss', hp: 8000, str: 60, pow: 58, end: 64, desc: 'Captain of the Galactic Poachers. His ship\'s hold is full of stolen animals.' },
  resistance: { name: 'Resistance Fighter', kind: 'Future / Resistance', hp: 160, str: 8, pow: 3, end: 7, desc: 'A survivor of Trunks\'s ruined Earth. Hides in the rubble, scavenges by night, and refuses to give up.' },

  // ---------------------------------------------------------------- Earth: troublemakers
  bandit: { name: 'Bandit', kind: 'Earthling / bandit', hp: 38, str: 6, pow: 3, end: 4, desc: 'A desert bandit with a pistol and bad manners.' },
  banditChief: { name: 'Bandit Boss', kind: 'Earthling / bandit', hp: 325, str: 18, pow: 12, end: 12, desc: 'A hulking bandit enforcer. The others do what he says, mostly because he is standing on them.' },
  c02_punk: { name: 'Street Punk', kind: 'Earthling / West City', hp: 200, str: 14, pow: 8, end: 9, desc: 'A West City tough who picked the wrong capsule to steal.' },
  c12_robber: { name: 'Masked Robber', kind: 'Earthling / robber', hp: 2600, str: 46, pow: 48, end: 40, desc: 'A bank robber with a capsule bazooka. Picked the wrong city, and the wrong week.' },
  c12_stuntman: { name: 'Stuntman', kind: 'Earthling / film crew', hp: 2800, str: 48, pow: 1, end: 42, desc: 'A stuntman in a rubber monster suit. Paid by the hour, hits like he means it.' },

  // ---------------------------------------------------------------- Earth: named locals and extras
  c01_kid: { name: 'Mika', kind: 'Earthling / Satan City', hp: 10, str: 1, pow: 1, end: 1, desc: 'Mr. Satan\'s number one fan. Has a poster, a lunchbox and a very loud cheer.' },
  c02_chef: { name: 'Ship\'s Chef', kind: 'Earthling / cruise crew', hp: 45, str: 3, pow: 1, end: 3, desc: 'Runs the galley of Bulma\'s birthday cruise. Cooks for gods without blinking, but not without octopus.' },
  c02_driver: { name: 'Chauffeur', kind: 'Earthling / Capsule Corp', hp: 40, str: 3, pow: 1, end: 3, desc: 'Capsule Corp\'s driver. Has ferried Saiyans, gods and one very rude cat without a single dent.' },
  c02_ramenChef: { name: 'Ramen Chef', kind: 'Earthling / West City', hp: 42, str: 3, pow: 1, end: 3, desc: 'Runs a noodle cart on the West City streets. His house special is worth fighting for.' },
  c02_steward: { name: 'Steward', kind: 'Earthling / cruise crew', hp: 34, str: 2, pow: 1, end: 3, desc: 'A steward on Bulma\'s birthday cruise. Remains professional through pudding-related apocalypses.' },
  c04_angel: { name: 'Hell Choir Fairy', kind: 'Otherworld / Hell', hp: 20, str: 1, pow: 3, end: 2, desc: 'One of the cheerful fairies who sing to Hell\'s worst prisoners. For someone like Frieza, it is torture.' },
  ea_butler: { name: 'Butler', kind: 'Earthling / Satan mansion', hp: 36, str: 2, pow: 1, end: 3, desc: 'The Champion\'s butler. Polishes trophies, walks Bee, and never comments on the pudding bills.' },
  ea_granny: { name: 'Granny Hana', kind: 'Earthling / Satan City', hp: 22, str: 1, pow: 1, end: 2, desc: 'Has lived in Satan City since it was called something else. Remembers every name it ever had.' },
  ea_sailor: { name: 'Ferryman', kind: 'Earthling / Kame Island', hp: 60, str: 5, pow: 1, end: 5, desc: 'Ferries visitors out to Kame House. Knows the sea, the tides and Master Roshi\'s habits far too well.' },
  ea_student: { name: 'Senior Student', kind: 'Earthling / Satan School', hp: 90, str: 8, pow: 1, end: 6, desc: 'A senior student of the Satan School. Can break three boards and recite the Champion\'s every pose.' },
  ea_student2: { name: 'Student', kind: 'Earthling / Satan School', hp: 70, str: 7, pow: 1, end: 5, desc: 'A student of the Satan School. Trains hard and practises her victory pose even harder.' },
  eb_ccGuard: { name: 'Security Guard', kind: 'Earthling / Capsule Corp', hp: 85, str: 7, pow: 3, end: 6, desc: 'Guards the Capsule Corp gate. Has learned to wave through anyone who glows a little.' },
  eb_ccStaff: { name: 'Receptionist', kind: 'Earthling / Capsule Corp', hp: 30, str: 1, pow: 1, end: 2, desc: 'Greets every visitor to Capsule Corp, appointment or not. Unflappable, even around gods.' },
  eb_ccTech: { name: 'Technician', kind: 'Earthling / Capsule Corp', hp: 32, str: 2, pow: 2, end: 2, desc: 'A Capsule Corp engineer in capsule compression. Would very much like to scan your sword. For science.' },
  eb_mechanic: { name: 'Mechanic', kind: 'Earthling / Capsule Corp', hp: 58, str: 5, pow: 1, end: 5, desc: 'Keeps Capsule Corp\'s vehicles running. Has rebuilt the gravity room door more times than he can count.' },
  eb_gardener: { name: 'Gardener', kind: 'Earthling / Capsule Corp', hp: 44, str: 4, pow: 1, end: 4, desc: 'Tends the Capsule Corp gardens. Only hardy plants survive the dinosaurs, sparring and spaceships.' },
  eb_chef: { name: 'Chef Gondo', kind: 'Earthling / West City', hp: 50, str: 4, pow: 1, end: 4, desc: 'Owner of Ramen Ichiban in West City. Never forgets a face, a friend or a promised bowl.' },
  eb_granny: { name: 'Granny Ume', kind: 'Earthling / West City', hp: 20, str: 1, pow: 1, end: 2, desc: 'Feeds the pigeons by the West City fountain every morning. Has seen Cell, Buu and worse from that bench.' },
  eb_kidGirl: { name: 'Mimi', kind: 'Earthling / West City', hp: 9, str: 1, pow: 1, end: 1, desc: 'A West City schoolgirl. Knows there are twelve universes and wants to visit all of them.' },
  eb_geologist: { name: 'Dr. Sekimura', kind: 'Earthling / scientist', hp: 30, str: 2, pow: 2, end: 2, desc: 'A geologist from West City University. Studies mesas, craters, and the alarming number of recent ones.' },
  eb_nomad: { name: 'Old Nomad', kind: 'Earthling / Diablo Desert', hp: 70, str: 5, pow: 1, end: 6, desc: 'Has crossed Diablo Desert for forty years. Remembers a young bandit who fought like a wolf.' },
  eb_trader: { name: 'Trader Saffi', kind: 'Earthling / Diablo Desert', hp: 48, str: 3, pow: 1, end: 4, desc: 'Runs the trading post at Ten-Palm Oasis. Sells water, rumours and the occasional warning.' },
  eb_climber: { name: 'Climber Daichi', kind: 'Earthling / mountaineer', hp: 95, str: 8, pow: 1, end: 9, desc: 'Twelve summits climbed and no frostbite yet. Very impressed by anyone who climbs without a coat.' },
  eb_ranger: { name: 'Ranger', kind: 'Earthling / park ranger', hp: 80, str: 6, pow: 2, end: 6, desc: 'A ranger of Earth\'s wild country. Counts dinosaurs, rescues hikers and files reports nobody believes.' },

  // ---------------------------------------------------------------- animals, machines and other friendly creatures
  ea_dog: { name: 'Bee', kind: 'Dog / Satan family', hp: 9, str: 2, pow: 1, end: 2, desc: 'The puppy Buu once saved. Now Mr. Satan\'s dog and Buu\'s best friend after pudding.' },
  ea_turtle: { name: 'Turtle', kind: 'Sea turtle / Kame House', hp: 300, str: 4, pow: 1, end: 30, desc: 'Master Roshi\'s sea turtle, over a thousand years old. Has carried every student to Kame House.' },
  eb_ccDino: { name: 'Baby Dinosaur', kind: 'Dinosaur / Capsule Corp', hp: 120, str: 5, pow: 1, end: 6, desc: 'One of Dr. Brief\'s many pets. Roams the Capsule Corp yard and eats the gardener\'s tulips.' },
  rescueDrone: { name: 'Service Robot', kind: 'Robot / Capsule Corp', hp: 60, str: 1, pow: 1, end: 8, desc: 'A Capsule Corp service robot. Cleans pools, sweeps floors, and politely asks Saiyans to wipe their feet.' },
  alienFish: { name: 'Oracle Fish', kind: 'Fish / Beerus\'s planet', hp: 12, str: 1, pow: 40, end: 2, desc: 'A fish whose prophecies guide even Lord Beerus. Its visions come in riddles. Its appetite does not.' },
  c04_teddy: { name: 'Hell Teddy', kind: 'Otherworld / Hell', hp: 20, str: 1, pow: 1, end: 3, desc: 'A plush bear that dances for Hell\'s prisoners all day long. Frieza has not stopped screaming.' },
  c05_frog: { name: 'Frog', kind: 'Frog / Namek', hp: 6, str: 1, pow: 2, end: 1, desc: 'A small frog with a commanding croak. Its brain waves match a certain captain lost on Namek.' },
};

/** Register more scan entries (chapter content). */
export function registerScans(entries: Record<string, ScanEntry>): void {
  Object.assign(SCANS, entries);
}

/** Register extra variant -> base aliases (new forms or outfits added by chapter content). */
export function registerScanAliases(aliases: Record<string, string>): void {
  Object.assign(SCAN_ALIASES, aliases);
}

/** The entry key a sprite files under: an NPC override, its own entry, else its base character's, else null. */
export function scanKey(sprite: string, npcId?: string): string | null {
  const forced = npcId ? NPC_SCAN_OVERRIDES[npcId] : undefined;
  if (forced && SCANS[forced]) return forced;
  if (SCANS[sprite]) return sprite;
  const base = SCAN_ALIASES[sprite];
  return base && SCANS[base] ? base : null;
}

/** Bestiary entry drawn with this sprite (creature stand-ins in cutscenes): the enemy of the same id first. */
function enemyForSprite(sprite: string): string | null {
  if (ENEMIES[sprite]?.sprite === sprite) return sprite;
  return Object.values(ENEMIES).find((e) => e.sprite === sprite)?.id ?? null;
}

/**
 * What the Scouter shows for an NPC: its named entry (via {@link scanKey}); for a stand-in with no entry, the
 * bestiary entry drawn with the same sprite; only generic townsfolk read as an Earthling.
 */
export function scanNpc(sprite: string, npcId?: string): ScanReading {
  const key = scanKey(sprite, npcId);
  if (key) return { id: `npc:${key}`, sprite: key, entry: SCANS[key], npc: true };
  if (!GENERIC_SCAN_SPRITES.has(sprite)) {
    const eid = enemyForSprite(sprite);
    if (eid) return scanRecord(`enemy:${eid}`);
  }
  return { id: `npc:${GENERIC_SCAN_KEY}`, sprite: 'townsman', entry: GENERIC_SCAN, npc: true };
}

/** Resolve a stored database id (`npc:<key>` / `enemy:<id>`) to its reading; unknown ids read as an Earthling. */
export function scanRecord(id: string): ScanReading {
  const sep = id.indexOf(':');
  const kind = sep < 0 ? '' : id.slice(0, sep);
  const key = id.slice(sep + 1);
  if (kind === 'enemy') {
    const e = ENEMIES[key];
    if (e) return { id, sprite: e.sprite, entry: { name: e.name, hp: e.hp, str: e.str, pow: e.pow, end: e.end, desc: e.desc }, npc: false };
  }
  const k = kind === 'npc' ? scanKey(key) : null;
  if (k) return { id: `npc:${k}`, sprite: k, entry: SCANS[k], npc: true };
  return { id: `npc:${GENERIC_SCAN_KEY}`, sprite: 'townsman', entry: GENERIC_SCAN, npc: true };
}

/**
 * The database entries a save's stored scan ids file under, unique and in first-scanned order. A save from before
 * the alias table can hold a variant id (`npc:vegetaCasual`) beside its base (`npc:vegeta`); both are one entry.
 */
export function scanEntries(stored: readonly string[]): string[] {
  return [...new Set(stored.map((id) => scanRecord(id).id))];
}

/** Number of Scouter database entries: the pause screen's "Scouter scans" and the Capsule Corp database's count. */
export function scanEntryCount(stored: readonly string[]): number {
  return scanEntries(stored).length;
}

/** Number of distinct named characters scanned: NPC entries other than the generic Earthling (Bulma's scan errand). */
export function namedScanCount(stored: readonly string[]): number {
  return scanEntries(stored).filter((id) => id.startsWith('npc:') && id !== `npc:${GENERIC_SCAN_KEY}`).length;
}
