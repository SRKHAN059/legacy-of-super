import { registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerScans } from '../../scans';

/** Act 2 key items, journal entries and Scouter readings. */

registerItems([
  {
    id: 'c03_bento', name: 'Party Bento', kind: 'key', max: 1,
    desc: 'Mrs. Briefs packed the best of the party buffet "for the road". It smells incredible. Someone hungry would trade a lot for it.',
    use: null, icon: { shape: 'box', color: '#e04848', color2: '#f8f0d0' },
  },
  {
    id: 'c03_pudding', name: 'Royal Pudding', kind: 'key', max: 1,
    desc: 'A triple-layer caramel pudding from the Satan City cafe. The exact kind Buu never got to finish.',
    use: null, icon: { shape: 'food', color: '#f8d870', color2: '#a05818' },
  },
  {
    id: 'c03_memo', name: 'Pilaf\'s Memo', kind: 'key', max: 1,
    desc: '"Vault password - DO NOT LOSE (Shu!!): First bow to the queen of the night. Then hail the king of the day. '
      + 'Third, the one who grants every wish. And LAST, the greatest ruler of all. Me. Obviously."',
    use: null, icon: { shape: 'scroll', color: '#f0e8c8', color2: '#6880c0' },
  },
  {
    id: 'c04_ramen', name: 'Instant Ramen', kind: 'key', max: 1,
    desc: 'Bulma\'s secret weapon against hungry gods. Just add hot water and wait three minutes.',
    use: null, icon: { shape: 'food', color: '#f0c040', color2: '#e04030' },
  },
  {
    id: 'c04_spoon', name: 'Dessert Spoon', kind: 'key', max: 1,
    desc: 'Lord Beerus\'s personal pudding spoon, recovered from a thieving puffbird. Slightly chewed.',
    use: null, icon: { shape: 'gear', color: '#e8d070', color2: '#c0a040' },
  },
]);

registerQuests([
  // ---------------------------------------------------------------- Chapter 3
  {
    id: 'c03_dragonballs', title: 'Gather the seven Dragon Balls', star: 'gold', region: 'spot_desert',
    desc: 'The balls scattered when Beerus threw his tantrum. Use the Dragon Radar (R) to find them. Leads: Pilaf\'s castle in '
      + 'Diablo Desert, the desert oasis, Mr. Satan in Satan City, Kame House, Korin Tower and the Lookout.',
  },
  {
    id: 'c03_vault', title: 'Crack Pilaf\'s vault', star: 'silver', region: 'spot_desert',
    desc: 'The Pilaf Gang hid a Dragon Ball in a vault under their castle. Pilaf is terrible at keeping passwords secret.',
  },
  {
    id: 'c03_champion', title: 'Mr. Satan\'s "Champion Orb"', star: 'silver', region: 'spot_satancity',
    desc: 'Mr. Satan keeps a Dragon Ball as a trophy. He\'ll only part with it if Buu stops sulking. Buu wants pudding - the cafe in Satan City sells the good stuff.',
  },
  {
    id: 'c03_summon', title: 'Summon Shenron at Capsule Corp', star: 'gold', region: 'spot_westcity',
    desc: 'All seven Dragon Balls are together. Bring them to Bulma on the Capsule Corp lawn and ask Shenron about the Super Saiyan God.',
  },
  {
    id: 'c03_beerus', title: 'Battle of Gods', star: 'gold', region: 'spot_westcity',
    desc: 'Goku has become a Super Saiyan God. Now he has to give Lord Beerus the fight he came for - and keep Earth in one piece.',
  },
  // ---------------------------------------------------------------- Chapter 4
  {
    id: 'c04_whis', title: 'Win Whis over with Earth food', star: 'gold', region: 'spot_westcity',
    desc: 'Vegeta wants Whis to train him. Whis only cares about food he has never tasted. Bulma must be hiding something in the Capsule Corp kitchen...',
  },
  {
    id: 'c04_training', title: 'Train under Whis on Beerus\'s planet', star: 'gold', region: 'spot_beerus',
    desc: 'Whis\'s Training Field: carry three jars of water to the basin, smash the three training boulders, recover Lord Beerus\'s spoon from the puffbird, then land one clean hit on Whis.',
  },
  {
    id: 'c04_spar', title: 'Goku vs. Vegeta', star: 'gold', region: 'spot_beerus',
    desc: 'Goku hitched a ride with Whis. Show Vegeta what you\'ve learned on the training field ring.',
  },
  {
    id: 'c04_delicacies', title: 'Whis\'s Gourmet Earth', star: 'bronze',
    desc: 'Whis wants to taste all 25 Earth Delicacies hidden around the world (and beyond). Show him your collection at Capsule Corp or on Beerus\'s planet - he rewards milestones.',
  },
  // ---------------------------------------------------------------- Chapter 5
  {
    id: 'c05_army', title: 'Hold off Frieza\'s army', star: 'gold', region: 'spot_wasteland',
    desc: 'Frieza is back with a thousand soldiers and they\'re landing in the Rocky Wasteland. Goku and Vegeta can\'t be reached. Gohan has to hold the line until they get here.',
  },
  {
    id: 'c05_mesa', title: 'Piccolo: stop Tagoma at the mesa', star: 'gold', region: 'spot_wasteland',
    desc: 'Tagoma flattened Gohan and fell back to Frieza\'s landing site on the mesa. Piccolo is taking over.',
  },
  {
    id: 'c05_roshi', title: 'Master Roshi\'s secret technique', star: 'silver', region: 'spot_kame',
    desc: 'Master Roshi will teach each fighter a charged attack (hold A, then release). Talk to him at Kame House as Goku, Vegeta, Gohan and Piccolo.',
  },
]);

registerScans({
  pilaf: { name: 'Emperor Pilaf', hp: 12, str: 1, pow: 1, end: 2, desc: 'Self-proclaimed future ruler of the world. Currently about eight years old, thanks to a wish gone wrong.' },
  mai: { name: 'Mai', hp: 30, str: 3, pow: 1, end: 3, desc: 'Pilaf\'s most competent minion. Handles anything with a trigger.' },
  shu: { name: 'Shu', hp: 25, str: 2, pow: 1, end: 3, desc: 'Pilaf\'s ninja dog. Drives the robots, forgets the passwords.' },
  majinBuu: { name: 'Majin Buu', hp: '???', str: '???', pow: '???', end: '???', desc: 'Mr. Satan\'s best friend. Gentle unless someone touches his pudding.' },
  yajirobe: { name: 'Yajirobe', hp: 420, str: 14, pow: 2, end: 11, desc: 'A lazy samurai who lives at Korin Tower and eats most of the Senzu harvest.' },
  dende: { name: 'Dende', hp: 300, str: 3, pow: 18, end: 8, desc: 'Earth\'s young Guardian. A Namekian healer who keeps the Dragon Balls working.' },
  jaco: { name: 'Jaco', hp: 900, str: 16, pow: 19, end: 12, desc: 'A Galactic Patrolman. Elite, according to Jaco.' },
  sorbet: { name: 'Sorbet', hp: 380, str: 9, pow: 14, end: 8, desc: 'Leader of what is left of the Frieza Force. Cowardly, clever, and wearing a dangerous ring.' },
  tagoma: { name: 'Tagoma', hp: 3000, str: 28, pow: 26, end: 40, desc: 'Sorbet\'s enforcer. His "steel body" shrugs off blows that would fell a mountain.' },
  shisami: { name: 'Shisami', hp: 2200, str: 25, pow: 22, end: 19, desc: 'A Frieza Force elite. Fast, proud, and very sure of himself.' },
  frieza: { name: 'Frieza', hp: '???', str: '???', pow: '???', end: '???', desc: 'The former emperor of the universe. Four months of training - his first ever - and the readings break the scale.' },
});
