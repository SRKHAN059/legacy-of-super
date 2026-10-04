import { finishProp, registerProp } from '../../../art/props';
import { Painter } from '../../../engine/gfx';
import { registerCast } from '../../cast';
import { registerCreatures } from '../../creatures';
import { registerEnemies } from '../../enemies';
import { registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerScans } from '../../scans';

/**
 * Act 1 shared data: key items, journal entries, extra cast/creatures, Scouter readings, enemies and bosses,
 * and custom props for the chapter-owned maps (Prologue, Chapter 1, Chapter 2).
 */

const SKIN = '#f8c890';

// ------------------------------------------------------------------ items

registerItems([
  { id: 'c00_fuelCell', name: 'Fuel Cell', kind: 'key', max: 3, desc: 'A Capsule Corp energy cell. Three of these will power the time machine for one trip.', use: null, icon: { shape: 'capsule', color: '#f8d040', color2: '#40c0f0' } },
  { id: 'c01_radish', name: 'Radish', kind: 'key', max: 5, desc: 'A plump white radish from the Son family field. Chi-Chi wants five.', use: null, icon: { shape: 'food', color: '#f0f0f0', color2: '#58b848' } },
  { id: 'c01_lunch', name: 'Lunchbox', kind: 'key', max: 1, desc: 'Chi-Chi\'s home-made lunch for Gohan and Videl. Do NOT eat it on the way.', use: null, icon: { shape: 'box', color: '#d84848', color2: '#f8f0d0' } },
  { id: 'c01_zeni', name: '100 Million Zeni', kind: 'key', max: 1, desc: 'Mr. Satan\'s "thank-you" for saving the world. Chi-Chi will be thrilled.', use: null, icon: { shape: 'card', color: '#f8d040', color2: '#58b848' } },
  { id: 'c01_springWater', name: 'Spring Water', kind: 'key', max: 1, desc: 'Steaming water from a mountain hot spring. Rumoured to smooth away wrinkles.', use: null, icon: { shape: 'box', color: '#80d0f0', color2: '#f0f0f0' } },
  { id: 'c01_photo', name: 'Signed Photo', kind: 'key', max: 1, desc: 'A glossy photo of Mr. Satan mid-victory pose. Signed with three exclamation marks.', use: null, icon: { shape: 'card', color: '#f0f0f0', color2: '#e03030' } },
  { id: 'c01_tail', name: 'Dino Tail', kind: 'key', max: 1, desc: 'A hefty slab of tail from the tyrant of Paozu Peaks. Don\'t worry - it grows back. Goten has dinner plans.', use: null, icon: { shape: 'food', color: '#c87850', color2: '#f0d8b0' } },
  { id: 'c02_octopus', name: 'Octopus', kind: 'key', max: 1, desc: 'A furious octopus Vegeta caught with his bare hands. It still has opinions.', use: null, icon: { shape: 'fish', color: '#d05878' } },
  { id: 'c02_takoyaki', name: 'Takoyaki', kind: 'key', max: 1, desc: 'Eight golden octopus balls. One of them is suspiciously green inside.', use: null, icon: { shape: 'food', color: '#d89040', color2: '#704020' } },
  { id: 'c02_capsule', name: 'Noodle Capsule', kind: 'key', max: 1, desc: 'A delivery capsule packed with fresh noodles for the ramen shop.', use: null, icon: { shape: 'capsule', color: '#f0f0f0', color2: '#e04040' } },
  { id: 'c02_ramen', name: 'Special Ramen', kind: 'key', max: 1, desc: 'The house special from West City\'s best ramen counter. Still steaming.', use: null, icon: { shape: 'food', color: '#f0c040', color2: '#e04030' } },
]);

// ------------------------------------------------------------------ journal

registerQuests([
  // Prologue.
  { id: 'c00_fuel', title: 'Fuel for the time machine', star: 'gold', region: 'spot_future_base', desc: 'Bulma needs three fuel cells for a one-way trip to the past. Capsule Corp Depot No. 4 lies at the end of the old service tunnel - its entrance is the cave just west of the hideout hatch.' },
  { id: 'c00_return', title: 'Get back to the hideout!', star: 'gold', region: 'spot_future_base', desc: 'Black let Trunks go on purpose. He is following him home. Bulma, Mai and everyone in the hideout are in danger.' },
  // Chapter 1.
  { id: 'c01_farm', title: 'Harvest five radishes', star: 'gold', region: 'spot_paozu', desc: 'Chi-Chi wants five radishes from the field outside the Son house before Goku even thinks about training.' },
  { id: 'c01_tracks', title: 'Follow the tracks into Paozu Forest', star: 'gold', region: 'spot_paozu', desc: 'Something huge has been raiding the radish field at night. Its paw prints lead west into Paozu Forest, toward an old cave.' },
  { id: 'c01_lunch', title: 'Take lunch to Gohan and Videl', star: 'gold', region: 'spot_paozu', desc: 'Chi-Chi packed lunch for the newlyweds. Their house is east of the Son home, in Paozu Valley.' },
  { id: 'c01_satan', title: 'See Mr. Satan in Satan City', star: 'gold', region: 'spot_satancity', desc: 'Mr. Satan wants to thank Goku for "helping" him save the world. He is waiting at his mansion in Satan City. Use the world map signpost to fly there.' },
  { id: 'c01_money', title: 'Bring the reward home to Chi-Chi', star: 'gold', region: 'spot_paozu', desc: 'One hundred million zeni. Chi-Chi might finally let Goku train full time.' },
  { id: 'c01_kingkai', title: 'Train on King Kai\'s planet', star: 'gold', region: 'spot_kingkai', desc: 'Goku teleported to King Kai\'s tiny planet to get back into fighting shape.' },
  { id: 'c01_gift', title: 'A wedding gift for Videl', star: 'bronze', region: 'spot_satancity', desc: 'Goten and Trunks want to give Videl a present. The shops in Satan City are a start.' },
  { id: 'c01_autograph', title: 'A little fan in Satan City', star: 'bronze', region: 'spot_satancity', desc: 'Mika, a little girl in the Satan City plaza, dreams of an autograph from the World Champion. Mr. Satan lives in the mansion up the avenue.' },
  { id: 'c01_goat', title: 'The runaway goat', star: 'bronze', region: 'spot_paozu', desc: 'Old Hiro\'s goat bolted deep into Paozu Forest. Carry her back to him at the forest\'s east edge - you can\'t fight while carrying her, and one hit will make her run.' },
  { id: 'c01_dino', title: 'The tyrant of Paozu Peaks', star: 'bronze', region: 'spot_paozu', desc: 'A scarred old T-rex chased Goten and Trunks off the plateau above Paozu Peaks (the flight circle in the basin goes up). Goten wants Dad to teach it some manners - and to bring home some tail for dinner.' },
  // Chapter 2.
  { id: 'c02_party', title: 'Bulma\'s birthday party', star: 'gold', region: 'spot_westcity', desc: 'Bulma\'s party is aboard the cruise liner Princess Bulma at the West City marina. A Capsule Corp driver waits on the lawn.' },
  { id: 'c02_feast', title: 'Keep Beerus happy', star: 'gold', region: 'spot_westcity', desc: 'The God of Destruction is at the party. If his mood sours, Earth is gone. Talk to Beerus to find out what he wants next.' },
  { id: 'c02_takoyaki', title: 'Takoyaki for a god', star: 'silver', region: 'spot_westcity', desc: 'Beerus wants something he has never tasted. The ship\'s chef can make takoyaki - if somebody finds him an octopus.' },
  { id: 'c02_ramen', title: 'The ramen run', star: 'silver', region: 'spot_westcity', desc: 'Whis has been talking about ramen. The best counter in West City is downtown - the driver at the marina can take you.' },
  { id: 'c02_thieves', title: 'Stop the Dragon Ball thieves', star: 'silver', region: 'spot_westcity', desc: 'Someone broke into the bingo prize vault in the cargo hold. The hatch is on the east side of the party deck.' },
  { id: 'c02_pudding', title: 'Dessert for the Destroyer', star: 'silver', region: 'spot_westcity', desc: 'Beerus wants dessert. Bulma ordered custard pudding... and Buu is sitting on all of it.' },
  { id: 'c02_scan', title: 'Scouter field test', star: 'bronze', region: 'spot_westcity', desc: 'Bulma wants data. Scan five different party guests with the Scouter (SELECT), then report back.' },
  { id: 'c02_spar', title: 'The Satan Dojo challenge', star: 'silver', region: 'spot_satancity', desc: 'Yamcha, Krillin and Tien are sparring at the Satan Dojo. One bout per visit. Beat all three.' },
]);

// ------------------------------------------------------------------ cast & creatures

registerCast({
  c02_oolong: { body: 'child', skin: '#f4b0b8', hair: 'catEars', hairColor: '#f4b0b8', accent: '#e88898', top: '#3a7a3a', topStyle: 'suit', under: '#3a7a3a', sleeves: 'long', pants: '#3a7a3a', boots: '#202020', face: 'gentle' },
  c02_marron: { body: 'child', skin: SKIN, hair: 'braids', hairColor: '#f0d878', top: '#f0a0c0', topStyle: 'dress', sleeves: 'short', pants: '#f0a0c0', boots: '#e04040' },
  c02_chef: { body: 'big', skin: SKIN, hair: 'hat', hairColor: '#f8f8f8', top: '#f8f8f8', topStyle: 'coat', under: '#f8f8f8', sleeves: 'long', pants: '#383838', boots: '#202020', face: 'mustache' },
  c02_driver: { body: 'male', skin: SKIN, hair: 'cap', hairColor: '#202020', accent: '#2848a0', top: '#202838', topStyle: 'suit', under: '#f0f0f0', sleeves: 'long', pants: '#202838', boots: '#101010', face: 'shades' },
  c02_punk: { body: 'male', skin: '#e8b078', hair: 'mohawk', hairColor: '#40c060', top: '#282828', topStyle: 'vest', under: '#c03030', sleeves: 'none', pants: '#384868', boots: '#202020', face: 'stern' },
  c02_ramenChef: { body: 'male', skin: SKIN, hair: 'bald', hairColor: '#303030', top: '#f0f0f0', topStyle: 'shirt', under: '#f0f0f0', sleeves: 'short', belt: '#c03030', pants: '#383848', boots: '#202020', face: 'gentle' },
  c02_steward: { body: 'male', skin: SKIN, hair: 'cap', hairColor: '#f0f0f0', accent: '#2848a0', top: '#f0f0f0', topStyle: 'suit', under: '#2848a0', sleeves: 'long', pants: '#2848a0', boots: '#202020' },
  c01_kid: { body: 'child', skin: SKIN, hair: 'ponytail', hairColor: '#e08040', accent: '#f04080', top: '#f8d040', topStyle: 'shirt', sleeves: 'short', pants: '#4060c0', boots: '#f0f0f0' },
}, {
  c02_oolong: 'Oolong', c02_marron: 'Marron', c02_chef: 'Chef', c02_driver: 'Chauffeur', c02_punk: 'Punk', c02_ramenChef: 'Ramen Chef', c02_steward: 'Steward', c01_kid: 'Mika',
});

registerCreatures({
  c00_drone: { kind: 'drone', body: '#8a7058', accent: '#f0a030', size: 24 },
  c00_rat: { kind: 'quadruped', body: '#7a8068', belly: '#a8b090', eye: '#f04040', size: 24 },
  c01_fang: { kind: 'quadruped', body: '#c87028', belly: '#f0d8a8', accent: '#402010', eye: '#f0e040', stripes: true, size: 40 },
  c01_gregory: { kind: 'bug', body: '#58b048', accent: '#f0e060', size: 24 },
  c01_bubbles: { kind: 'quadruped', body: '#a07040', belly: '#e8c8a0', size: 24 },
  c01_goat: { kind: 'quadruped', body: '#f0ece0', belly: '#ffffff', accent: '#a09080', horns: true, size: 24 },
  c01_serpent: { kind: 'snake', body: '#38a0a0', belly: '#c8f0e0', accent: '#206060', eye: '#f0e040', size: 48 },
  c01_scarface: { kind: 'dino', body: '#7a8a48', belly: '#d8d0a0', accent: '#b03828', eye: '#f8c020', horns: true, stripes: true, size: 48 },
  c02_drone: { kind: 'drone', body: '#e8e8f0', accent: '#40a0f0', size: 24 },
  c02_mech: { kind: 'robot', body: '#5878c8', accent: '#f8d040', size: 48 },
});

registerScans({
  futureBulma: { name: 'Bulma', hp: 38, str: 2, pow: 1, end: 3, desc: 'The genius of a ruined future. She has kept the resistance alive on scrap, coffee and stubbornness.' },
  futureMai: { name: 'Mai', hp: 210, str: 9, pow: 6, end: 8, desc: 'A resistance soldier and Trunks\'s closest ally. Steady hands, steadier nerves.' },
  gokuBlack: { name: '???', hp: '???', str: '???', pow: '???', end: '???', desc: 'A man with Goku\'s face and none of his warmth. The scouter flickers whenever it locks on.' },
  kingKai: { name: 'King Kai', hp: 2800, str: 20, pow: 30, end: 22, desc: 'The North Kai. Martial arts master, terrible comedian, and still dead after the Cell incident.' },
  android18: { name: 'Android 18', hp: 2600, str: 28, pow: 30, end: 24, desc: 'Krillin\'s wife and Marron\'s mother. Unimpressed by almost everything.' },
  tien: { name: 'Tien', hp: 2110, str: 35, pow: 29, end: 27, desc: 'A disciplined Crane-school fighter with a third eye. Trains in the mountains with Chiaotzu.' },
  yamcha: { name: 'Yamcha', hp: 800, str: 18, pow: 12, end: 14, desc: 'Former desert bandit, former baseball star, current life of the party.' },
  chiaotzu: { name: 'Chiaotzu', hp: 520, str: 8, pow: 16, end: 9, desc: 'Tien\'s best friend. A telekinetic with a fondness for party snacks.' },
  videl: { name: 'Videl', hp: 300, str: 12, pow: 6, end: 10, desc: 'Mr. Satan\'s daughter and Gohan\'s new wife. Learned to fly in a week.' },
  drBrief: { name: 'Dr. Brief', hp: 30, str: 1, pow: 1, end: 2, desc: 'Founder of Capsule Corporation. Usually has a cat on his shoulder and a cigarette nobody can take away.' },
  panchy: { name: 'Mrs. Briefs', hp: 28, str: 1, pow: 1, end: 2, desc: 'Bulma\'s mother. Bakes cookies at a speed that should not be possible.' },
  c02_oolong: { name: 'Oolong', hp: 15, str: 1, pow: 1, end: 1, desc: 'A shapeshifting pig. Lazy, greedy and the worst at rock-paper-scissors.' },
  c02_marron: { name: 'Marron', hp: 8, str: 1, pow: 1, end: 1, desc: 'Krillin and 18\'s daughter. Her hair-buns are not optional.' },
  c01_bubbles: { name: 'Bubbles', hp: 1200, str: 15, pow: 1, end: 12, desc: 'King Kai\'s monkey. Running in ten times Earth\'s gravity made him annoyingly fast.' },
  c01_gregory: { name: 'Gregory', hp: 24, str: 1, pow: 1, end: 2, desc: 'King Kai\'s cricket. Hard to hit, harder to shut up.' },
  c01_goat: { name: 'Goat', hp: 9, str: 2, pow: 1, end: 2, desc: 'A goat with no respect for fences.' },
  c01_scarface: { name: 'Scarface', hp: 450, str: 13, pow: 1, end: 7, desc: 'The oldest T-rex on Mt. Paozu. The scar is from a fight with a boy with a monkey tail, about thirty years ago.' },
});

// ------------------------------------------------------------------ enemies & bosses

registerEnemies([
  // Prologue (Trunks L6).
  {
    id: 'c00_scavDrone', name: 'Scavenger Drone', sprite: 'c00_drone', hp: 150, str: 1, pow: 12, end: 8, exp: 160, ai: 'shooter', speed: 0.9, flying: true,
    shot: { color: '#f0a030', cooldown: 100, speed: 2.2, mult: 0.7 }, desc: 'A rusty salvage drone. Its targeting was reprogrammed long ago to shoot anything warm.',
  },
  { id: 'c00_rat', name: 'Mutant Rat', sprite: 'c00_rat', hp: 170, str: 13, pow: 1, end: 9, exp: 180, ai: 'rusher', speed: 1.15, desc: 'Something that used to be a rat. The ruins changed it.' },
  {
    id: 'c00_blackToy', name: '???', sprite: 'gokuBlack', hp: 6000, str: 15, pow: 14, end: 110, exp: 0, ai: 'boss', speed: 1.1, drops: 'none',
    desc: 'He has Goku\'s face. He does not have Goku\'s eyes.',
    boss: { endAt: 0, kiColor: '#c04080', phases: [{ until: 0, moves: ['chase', 'teleport', 'shot', 'dash'], rest: 55 }] },
  },
  {
    id: 'c00_blackRage', name: 'Goku Black', sprite: 'gokuBlack', hp: 900, str: 16, pow: 15, end: 12, exp: 0, ai: 'boss', speed: 1.15, drops: 'none',
    desc: 'He is smiling. He wants to see what a Saiyan\'s anger looks like.',
    boss: {
      endAt: 0.75, kiColor: '#c04080',
      phases: [
        { until: 0.88, moves: ['chase', 'shot', 'guard'], rest: 50 },
        { until: 0, moves: ['chase', 'teleport', 'volley', 'dash'], rest: 40, speed: 1.2, onStart: 'c00_black_taunt' },
      ],
    },
  },
  // Chapter 1 (Goku L1-8).
  {
    id: 'c01_dreamFrieza', name: 'Frieza?', sprite: 'frieza', hp: 140, str: 8, pow: 6, end: 4, exp: 50, ai: 'boss', speed: 0.9, drops: 'none',
    desc: 'Frieza. Or a memory of him wearing his smile.',
    boss: {
      endAt: 0, kiColor: '#d060f0',
      phases: [
        { until: 0.5, moves: ['chase', 'shot'], rest: 70 },
        { until: 0, moves: ['chase', 'shot', 'dash'], rest: 55, onStart: 'c01_dream_taunt' },
      ],
    },
  },
  {
    id: 'c01_fang', name: 'Fang', sprite: 'c01_fang', hp: 400, str: 11, pow: 1, end: 5, exp: 0, ai: 'boss', speed: 1.0, box: { w: 22, h: 10 }, drops: 'none',
    desc: 'An old sabertooth the size of a truck. Has developed a taste for radishes.',
    boss: {
      endAt: 0.05,
      phases: [
        { until: 0.6, moves: ['chase', 'charge'], rest: 60 },
        { until: 0, moves: ['chase', 'charge', 'dash'], rest: 45, speed: 1.15, onStart: 'c01_fang_roar' },
      ],
    },
  },
  {
    id: 'c01_serpent', name: 'Spring Serpent', sprite: 'c01_serpent', hp: 360, str: 12, pow: 9, end: 7, exp: 0, ai: 'boss', speed: 0.8, box: { w: 22, h: 10 }, drops: 'none',
    desc: 'A serpent that has guarded the hot spring for a hundred years. It spits scalding water.',
    boss: {
      endAt: 0.05, kiColor: '#80e0d0',
      phases: [
        { until: 0.5, moves: ['chase', 'shot'], rest: 60 },
        { until: 0, moves: ['chase', 'volley', 'dash'], rest: 45, onStart: 'c01_serpent_hiss' },
      ],
    },
  },
  {
    id: 'c01_scarface', name: 'Scarface', sprite: 'c01_scarface', hp: 450, str: 13, pow: 1, end: 7, exp: 0, ai: 'boss', speed: 0.95, box: { w: 22, h: 10 }, drops: 'none',
    desc: 'The oldest T-rex on Mt. Paozu. Bullies raptors, eats boulders, hates small boys.',
    boss: {
      endAt: 0.05,
      phases: [
        { until: 0.55, moves: ['chase', 'charge'], rest: 58 },
        { until: 0, moves: ['charge', 'dash', 'chase'], rest: 42, speed: 1.15, onStart: 'c01_scarface_roar' },
      ],
    },
  },
  { id: 'c01_gregory', name: 'Gregory', sprite: 'c01_gregory', hp: 24, str: 1, pow: 1, end: 2, exp: 0, ai: 'flyer', speed: 1.7, drops: 'none', desc: 'King Kai\'s cricket. Dodges, chirps, gloats.' },
  {
    id: 'c01_beerus', name: 'Beerus', sprite: 'beerus', hp: 9999, str: 40, pow: 40, end: 120, exp: 0, ai: 'boss', speed: 1.3, drops: 'none',
    desc: 'The God of Destruction of Universe 7. He is not even trying.',
    boss: { endAt: 0, kiColor: '#b070f0', phases: [{ until: 0, moves: ['teleport', 'chase', 'dash', 'guard'], rest: 50 }] },
  },
  // Chapter 2 (Vegeta L8-12).
  {
    id: 'c02_gravDrone', name: 'Training Drone', sprite: 'c02_drone', hp: 160, str: 1, pow: 13, end: 9, exp: 200, ai: 'shooter', speed: 1.0, flying: true,
    shot: { color: '#60c0f8', cooldown: 90, speed: 2.4, mult: 0.7 }, desc: 'Bulma\'s gravity-room sparring drone. Rated for 150 G. Rated for Vegeta? Debatable.',
  },
  { id: 'c02_punk', name: 'Street Punk', sprite: 'c02_punk', hp: 200, str: 14, pow: 8, end: 9, exp: 300, ai: 'rusher', speed: 1.0, desc: 'A West City tough who picked the wrong capsule to steal.' },
  {
    id: 'c02_punkGun', name: 'Punk Gunner', sprite: 'c02_punk', hp: 160, str: 6, pow: 13, end: 8, exp: 280, ai: 'shooter', speed: 0.9,
    shot: { color: '#d0d0d0', cooldown: 110, speed: 2.0, mult: 0.7 }, desc: 'He bought a rocket pistol online. He has not read the manual.',
  },
  {
    id: 'c02_pilafMachine', name: 'Pilaf Machine', sprite: 'c02_mech', hp: 900, str: 19, pow: 14, end: 18, exp: 1800, ai: 'boss', speed: 0.8, box: { w: 22, h: 10 },
    desc: 'The Pilaf Gang\'s three-seat battle robot. Fists, flamethrowers and an emergency snack dispenser.',
    boss: {
      endAt: 0, kiColor: '#f86040', minion: 'drone',
      phases: [
        { until: 0.65, moves: ['chase', 'shot', 'charge'], rest: 60 },
        { until: 0.3, moves: ['volley', 'charge', 'summon'], rest: 50, onStart: 'c02_mech_phase2' },
        { until: 0, moves: ['chase', 'volley', 'rain', 'charge'], rest: 38, speed: 1.2, onStart: 'c02_mech_phase3' },
      ],
    },
  },
  {
    id: 'c02_beerusRage', name: 'Beerus', sprite: 'beerus', hp: 1400, str: 22, pow: 18, end: 20, exp: 0, ai: 'boss', speed: 1.2, drops: 'none',
    desc: 'Beerus, mildly inconvenienced. That is still a planet-ending threat.',
    boss: {
      endAt: 0.85, kiColor: '#b070f0',
      phases: [
        { until: 0.93, moves: ['chase', 'teleport', 'guard'], rest: 50 },
        { until: 0, moves: ['chase', 'teleport', 'volley', 'dash'], rest: 40, speed: 1.2, onStart: 'c02_rage_taunt' },
      ],
    },
  },
  // Sparring arena (no EXP, they yield before getting hurt).
  {
    id: 'c02_spYamcha', name: 'Yamcha', sprite: 'yamcha', hp: 800, str: 18, pow: 12, end: 14, exp: 0, ai: 'boss', speed: 1.1, drops: 'none',
    desc: 'Wolf Fang Fist at the ready. Mostly.',
    boss: { endAt: 0.02, kiColor: '#f8e070', phases: [{ until: 0.5, moves: ['chase', 'dash', 'shot'], rest: 50 }, { until: 0, moves: ['chase', 'dash', 'volley'], rest: 40, speed: 1.15 }] },
  },
  {
    id: 'c02_spKrillin', name: 'Krillin', sprite: 'krillinGi', hp: 1800, str: 23, pow: 24, end: 17, exp: 0, ai: 'boss', speed: 1.15, drops: 'none',
    desc: 'Earth\'s strongest human, out of practice and loving it.',
    boss: { endAt: 0.02, kiColor: '#f8f080', phases: [{ until: 0.5, moves: ['chase', 'shot', 'teleport'], rest: 48 }, { until: 0, moves: ['volley', 'beam', 'teleport', 'chase'], rest: 38 }] },
  },
  {
    id: 'c02_spTien', name: 'Tien', sprite: 'tien', hp: 2110, str: 35, pow: 29, end: 27, exp: 0, ai: 'boss', speed: 1.1, drops: 'none',
    desc: 'Disciplined, tireless and fond of the Tri-Beam.',
    boss: { endAt: 0.02, kiColor: '#f8d060', phases: [{ until: 0.5, moves: ['chase', 'dash', 'beam'], rest: 50 }, { until: 0, moves: ['beam', 'teleport', 'chase', 'rain'], rest: 36, speed: 1.15 }] },
  },
]);

// ------------------------------------------------------------------ props

/** Paw prints (flat decal, 16x16) for the radish thief's trail. */
registerProp('c01_pawprint', () => {
  const p = new Painter(16, 16);
  const pad = (x: number, y: number) => {
    p.ellipse(x, y + 2, 5, 4, '#5a4028');
    p.px(x, y, '#5a4028'); p.px(x + 2, y - 1, '#5a4028'); p.px(x + 4, y, '#5a4028');
  };
  pad(2, 4); pad(9, 10);
  return { bmp: p.done(), solid: null, flat: true };
});

/** An unpowered flight circle (flat decal, 16x16): the live circle is drawn over it by the engine when active. */
registerProp('c00_deadPad', () => {
  const p = new Painter(16, 16);
  p.ellipse(-1, 5, 18, 11, '#3c3c48');
  p.ellipse(1, 6, 14, 9, '#5a5a68');
  p.ellipse(3, 7, 10, 7, '#2a2a34');
  p.ellipse(6, 9, 4, 3, '#4a4a58');
  return { bmp: p.done(), solid: null, flat: true };
});

/** Hot spring steam (decor, 24x24). */
registerProp('c01_steam', () => {
  const p = new Painter(24, 24);
  p.ellipse(2, 12, 10, 8, '#e8f0f8');
  p.ellipse(9, 6, 10, 9, '#f4f8fc');
  p.ellipse(13, 13, 9, 7, '#dce8f0');
  p.ellipse(6, 1, 7, 6, '#f8fcff');
  return { bmp: p.done(), solid: null };
});

/** Grandpa Gohan's training shrine marker: a carved stone tablet (24x32). */
registerProp('c01_tablet', () => {
  const p = new Painter(24, 32);
  p.rect(2, 26, 20, 5, '#787068');
  p.rect(4, 4, 16, 23, '#a8a098');
  p.rect(5, 2, 14, 3, '#a8a098');
  p.vline(4, 4, 23, '#c8c0b8');
  p.rect(8, 8, 8, 1, '#585048'); p.rect(11, 9, 2, 8, '#585048'); p.rect(8, 13, 8, 1, '#585048');
  p.ellipse(9, 19, 6, 5, '#585048'); p.ellipse(10, 20, 4, 3, '#a8a098');
  return { bmp: finishProp(p), solid: { x: 2, y: 24, w: 20, h: 7 } };
});

/** The liner Princess Bulma seen from the pier: white hull with a blue stripe and portholes (384x72). */
registerProp('c02_hull', () => {
  const p = new Painter(384, 72);
  p.rect(0, 30, 384, 36, '#f0f0f4');
  p.rect(16, 66, 352, 6, '#d8d8e0');
  p.rect(0, 46, 384, 5, '#3058c0');
  p.rect(0, 52, 384, 2, '#f8d040');
  for (let x = 12; x < 372; x += 18) { p.ellipse(x, 36, 7, 7, '#406080'); p.px(x + 2, 37, '#a0d0f0'); }
  // Superstructure decks.
  p.rect(48, 10, 288, 20, '#f8f8fc');
  p.rect(48, 18, 288, 3, '#d0d8e8');
  for (let x = 56; x < 330; x += 14) p.rect(x, 12, 9, 5, '#5880a8');
  p.rect(150, 0, 28, 12, '#e04040'); p.rect(206, 0, 28, 12, '#e04040');
  p.rect(150, 0, 28, 3, '#303030'); p.rect(206, 0, 28, 3, '#303030');
  // Gangway opening.
  p.rect(178, 50, 28, 22, '#a07040');
  return { bmp: finishProp(p), solid: null };
});

/** Prize vault pedestal with the seven Dragon Balls behind a pink force field (48x40). */
registerProp('c02_vault', () => {
  const p = new Painter(48, 40);
  p.rect(4, 26, 40, 12, '#787890');
  p.rect(6, 22, 36, 6, '#a0a0b8');
  const balls: Array<[number, number]> = [[9, 16], [15, 13], [21, 16], [27, 13], [33, 16], [18, 19], [30, 19]];
  for (const [x, y] of balls) { p.ellipse(x, y, 6, 6, '#f89820'); p.px(x + 2, y + 2, '#e03020'); p.px(x + 1, y + 1, '#fff0c0'); }
  for (let y = 4; y < 26; y += 2) { p.hline(2, y, 2, '#f070c0'); p.hline(44, y, 2, '#f070c0'); }
  p.hline(2, 3, 44, '#f8a0e0');
  return { bmp: finishProp(p), solid: { x: 4, y: 24, w: 40, h: 14 } };
});

/** Bingo board on the party stage (48x32). */
registerProp('c02_bingo', () => {
  const p = new Painter(48, 32);
  p.rect(2, 2, 44, 24, '#f8f0d0');
  p.rect(2, 2, 44, 5, '#e04878');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const lit = (r * 7 + c * 3) % 5 === 0;
    p.ellipse(5 + c * 7, 9 + r * 4, 4, 3, lit ? '#f8d040' : '#c8c0b0');
  }
  p.rect(6, 26, 3, 6, '#605048'); p.rect(39, 26, 3, 6, '#605048');
  return { bmp: finishProp(p), solid: { x: 4, y: 26, w: 40, h: 6 } };
});

/** Buffet table loaded with party food (48x24). */
registerProp('c02_buffet', () => {
  const p = new Painter(48, 24);
  p.rect(0, 8, 48, 12, '#f8f8f8');
  p.rect(0, 18, 48, 3, '#e04878');
  p.rect(2, 20, 3, 4, '#806040'); p.rect(43, 20, 3, 4, '#806040');
  const dish = (x: number, c: string, c2: string) => { p.ellipse(x, 6, 9, 5, '#e8e8f0'); p.ellipse(x + 2, 4, 5, 4, c); p.px(x + 3, 4, c2); };
  dish(2, '#d89040', '#704020'); dish(13, '#f0c040', '#e04030'); dish(24, '#f8d870', '#a05818'); dish(35, '#e05050', '#f0f0f0');
  return { bmp: finishProp(p), solid: { x: 0, y: 10, w: 48, h: 12 } };
});
