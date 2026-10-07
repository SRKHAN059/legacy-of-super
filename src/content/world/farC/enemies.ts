import { registerEnemies } from '../../enemies';

/**
 * Regular enemies for the far regions: Future Earth (prologue, Ch9-11), Beerus's planet (Ch4-6 / Ch7+), Hell (Ch13)
 * and the Tournament of Power stage (Ch14).
 *
 * Each zone's residents are tuned to LoG2's per-enemy grind band for the hero who walks in, in form, at the level the
 * story run arrives with (tests/grind.test.ts measures it with the fair bot): about 5-8 melee hits to kill and at least
 * 15 enemy hits to knock the hero out (early zones 2-5 and about 12), a clear at no knock-out and at most one Senzu
 * Bean. The heroes they are set against: Trunks L6 (prologue Future Earth), Vegeta L15 SSJ (Beerus's planet, Ch4-6),
 * Goku L22 SSB (Beerus's planet, Ch7+), Goku L33 SSB and Trunks L34 Rage (Future Earth, Ch10-11), Goku L40-44 SSB
 * (Hell, the Tournament of Power); tests/balance.test.ts ('grind zones: world C') holds them there. That puts their
 * STR/POW and END below the tier table in CONTENT_GUIDE §6, which outpaces the hero's damage curve from Chapter 4 on;
 * EXP is paced rather than tiered: at the level each zone is entered at, a level costs the fair bot about as many minutes
 * as in LoG2's own zones (tests/grind.test.ts 'grind pace', critic round 3), so the Goku 35 gate costs what LoG2's do.
 * Shooters fire every 80-100 frames: a laser lands far more often than a melee blow, and at 60-70 frames a pair of
 * Hunter Drones or Pride Troopers took most of the hero's HP in one clear.
 */
registerEnemies([
  // ---- Future Earth, prologue tier.
  {
    id: 'fc_scavDrone', name: 'Scavenger Drone', sprite: 'fc_scavDrone', hp: 45, str: 1, pow: 7, end: 4, exp: 35, ai: 'shooter', speed: 0.9, flying: true,
    shot: { color: '#f0a020', cooldown: 100, speed: 2.0, mult: 0.7 },
    desc: 'A rusted salvage drone gone feral after its owners died. Still fires its cutting laser at anything warm.',
  },
  {
    id: 'fc_scrapHound', name: 'Scrap Hound', sprite: 'fc_scrapHound', hp: 110, str: 10, pow: 1, end: 8, exp: 320, ai: 'rusher', speed: 1.2,
    desc: 'A guard-dog robot from a looted security firm. Hunts survivors in the ruins by scent of engine oil.',
  },
  // ---- Future Earth, Ch9+ tier.
  {
    id: 'fc_hunterDrone', name: 'Hunter Drone', sprite: 'fc_hunterDrone', hp: 1250, str: 1, pow: 36, end: 28, exp: 12000, ai: 'shooter', speed: 1.0, flying: true,
    shot: { color: '#c040f0', cooldown: 100, speed: 2.4, mult: 0.8 },
    desc: 'A black-plated drone rewired to sweep the ruins for survivors. Its lens glows the same pink as a certain god\'s ki.',
  },
  {
    id: 'fc_ravager', name: 'Scrap Ravager', sprite: 'fc_ravager', hp: 1400, str: 36, pow: 32, end: 30, exp: 18000, ai: 'heavy', speed: 0.85, box: { w: 20, h: 10 },
    desc: 'A demolition mech that welded itself a new body out of wreckage. Slow, furious, and very hard to stop.',
  },
  // ---- Beerus's planet.
  {
    id: 'fc_puffbird', name: 'Puffbird', sprite: 'fc_puffbird', hp: 360, str: 14, pow: 1, end: 14, exp: 320, ai: 'flyer', speed: 1.3,
    desc: 'A fluffy pink bird from Beerus\'s planet. Pecks hard enough to crack stone. Whis finds them adorable.',
  },
  {
    id: 'fc_mossBeast', name: 'Moss Grazer', sprite: 'fc_mossBeast', hp: 420, str: 14, pow: 1, end: 18, exp: 800, ai: 'charger', speed: 1.1,
    desc: 'A horned grazer covered in teal moss. Charges anyone who steps on its favourite patch of grass.',
  },
  {
    id: 'fc_lakeCrab', name: 'Violet Crab', sprite: 'fc_lakeCrab', hp: 360, str: 14, pow: 1, end: 20, exp: 560, ai: 'rusher', speed: 0.8, drops: 'water',
    desc: 'A crab from the Oracle Fish\'s lake. Its shell shimmers like amethyst.',
  },
  {
    id: 'fc_starWasp', name: 'Star Wasp', sprite: 'fc_starWasp', hp: 760, str: 22, pow: 1, end: 24, exp: 2000, ai: 'flyer', speed: 1.5,
    desc: 'A wasp whose wings glitter like starlight. Nests in the strange rocks on Beerus\'s planet.',
  },
  {
    id: 'fc_hornBeast', name: 'Horned Behemoth', sprite: 'fc_hornBeast', hp: 940, str: 24, pow: 1, end: 30, exp: 3500, ai: 'heavy', speed: 0.85, box: { w: 20, h: 10 },
    desc: 'A huge violet beast that sleeps as much as Lord Beerus does. Waking it is a terrible idea.',
  },
  // ---- Hell.
  {
    id: 'fc_hellBat', name: 'Inferno Bat', sprite: 'fc_hellBat', hp: 1650, str: 44, pow: 1, end: 36, exp: 26400, ai: 'flyer', speed: 1.55,
    desc: 'A bat born in the fires of Hell. Its screech makes the damned cover their ears.',
  },
  {
    id: 'fc_lavaOoze', name: 'Lava Ooze', sprite: 'fc_lavaOoze', hp: 1650, str: 44, pow: 42, end: 36, exp: 30000, ai: 'exploder', speed: 1.0,
    desc: 'Molten muck that crawled out of Hell\'s lava lake. Bursts into burning slag when destroyed.',
  },
  // ---- Tournament of Power stage.
  {
    id: 'fc_topBrawler', name: 'Rival Fighter', sprite: 'universeFighter', hp: 1700, str: 46, pow: 40, end: 40, exp: 38600, ai: 'rusher', speed: 1.3,
    desc: 'A warrior from another universe fighting for its survival. Knock them off the stage!',
  },
  {
    id: 'fc_topGunner', name: 'Pride Trooper', sprite: 'prideTrooper', hp: 1700, str: 44, pow: 46, end: 40, exp: 42100, ai: 'shooter', speed: 1.2,
    shot: { color: '#e04060', cooldown: 80, speed: 2.6, mult: 0.8 },
    desc: 'A Universe 11 Pride Trooper. Strikes from range while shouting about justice.',
  },
]);
