import { registerEnemies } from '../../enemies';

/**
 * Regular enemies for the far regions. Tiers follow CONTENT_GUIDE §6:
 * Future Earth prologue (Trunks L6) T1-T2, Future Earth Ch9-11 T5, Beerus's planet T3 (Ch4-6) / T4-T5 (Ch7+),
 * Hell T6 (Ch13), Tournament of Power T7 (Ch14).
 */
registerEnemies([
  // ---- Future Earth, prologue tier.
  {
    id: 'fc_scavDrone', name: 'Scavenger Drone', sprite: 'fc_scavDrone', hp: 45, str: 1, pow: 7, end: 4, exp: 35, ai: 'shooter', speed: 0.9, flying: true,
    shot: { color: '#f0a020', cooldown: 100, speed: 2.0, mult: 0.7 },
    desc: 'A rusted salvage drone gone feral after its owners died. Still fires its cutting laser at anything warm.',
  },
  {
    id: 'fc_scrapHound', name: 'Scrap Hound', sprite: 'fc_scrapHound', hp: 190, str: 14, pow: 1, end: 10, exp: 320, ai: 'rusher', speed: 1.2,
    desc: 'A guard-dog robot from a looted security firm. Hunts survivors in the ruins by scent of engine oil.',
  },
  // ---- Future Earth, Ch9+ tier.
  {
    id: 'fc_hunterDrone', name: 'Hunter Drone', sprite: 'fc_hunterDrone', hp: 1500, str: 1, pow: 42, end: 33, exp: 12000, ai: 'shooter', speed: 1.1, flying: true,
    shot: { color: '#c040f0', cooldown: 70, speed: 2.7, mult: 0.9 },
    desc: 'A black-plated drone rewired to sweep the ruins for survivors. Its lens glows the same pink as a certain god\'s ki.',
  },
  {
    id: 'fc_ravager', name: 'Scrap Ravager', sprite: 'fc_ravager', hp: 2100, str: 45, pow: 40, end: 38, exp: 18000, ai: 'heavy', speed: 0.85, box: { w: 20, h: 10 },
    desc: 'A demolition mech that welded itself a new body out of wreckage. Slow, furious, and very hard to stop.',
  },
  // ---- Beerus's planet.
  {
    id: 'fc_puffbird', name: 'Puffbird', sprite: 'fc_puffbird', hp: 420, str: 21, pow: 1, end: 15, exp: 900, ai: 'flyer', speed: 1.3,
    desc: 'A fluffy pink bird from Beerus\'s planet. Pecks hard enough to crack stone. Whis finds them adorable.',
  },
  {
    id: 'fc_mossBeast', name: 'Moss Grazer', sprite: 'fc_mossBeast', hp: 620, str: 25, pow: 1, end: 20, exp: 2200, ai: 'charger', speed: 1.1,
    desc: 'A horned grazer covered in teal moss. Charges anyone who steps on its favourite patch of grass.',
  },
  {
    id: 'fc_lakeCrab', name: 'Violet Crab', sprite: 'fc_lakeCrab', hp: 560, str: 23, pow: 1, end: 21, exp: 1600, ai: 'rusher', speed: 0.8, drops: 'water',
    desc: 'A crab from the Oracle Fish\'s lake. Its shell shimmers like amethyst.',
  },
  {
    id: 'fc_starWasp', name: 'Star Wasp', sprite: 'fc_starWasp', hp: 1000, str: 34, pow: 1, end: 26, exp: 5200, ai: 'flyer', speed: 1.5,
    desc: 'A wasp whose wings glitter like starlight. Nests in the strange rocks on Beerus\'s planet.',
  },
  {
    id: 'fc_hornBeast', name: 'Horned Behemoth', sprite: 'fc_hornBeast', hp: 1900, str: 42, pow: 1, end: 36, exp: 14000, ai: 'heavy', speed: 0.85, box: { w: 20, h: 10 },
    desc: 'A huge violet beast that sleeps as much as Lord Beerus does. Waking it is a terrible idea.',
  },
  // ---- Hell.
  {
    id: 'fc_hellBat', name: 'Inferno Bat', sprite: 'fc_hellBat', hp: 2800, str: 50, pow: 1, end: 42, exp: 30000, ai: 'flyer', speed: 1.55,
    desc: 'A bat born in the fires of Hell. Its screech makes the damned cover their ears.',
  },
  {
    id: 'fc_lavaOoze', name: 'Lava Ooze', sprite: 'fc_lavaOoze', hp: 3000, str: 52, pow: 50, end: 44, exp: 34000, ai: 'exploder', speed: 1.0,
    desc: 'Molten muck that crawled out of Hell\'s lava lake. Bursts into burning slag when destroyed.',
  },
  // ---- Tournament of Power stage.
  {
    id: 'fc_topBrawler', name: 'Rival Fighter', sprite: 'universeFighter', hp: 4800, str: 60, pow: 50, end: 52, exp: 55000, ai: 'rusher', speed: 1.3,
    desc: 'A warrior from another universe fighting for its survival. Knock them off the stage!',
  },
  {
    id: 'fc_topGunner', name: 'Pride Trooper', sprite: 'prideTrooper', hp: 4500, str: 50, pow: 62, end: 50, exp: 60000, ai: 'shooter', speed: 1.2,
    shot: { color: '#e04060', cooldown: 60, speed: 2.9, mult: 0.9 },
    desc: 'A Universe 11 Pride Trooper. Strikes from range while shouting about justice.',
  },
]);
