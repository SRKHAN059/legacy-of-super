import { registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerSpots } from '../../world';

/** Act 3 key items, journal entries and world-map landing spots. */

registerItems([
  { id: 'c06_badge', name: 'Frieza Force Badge', kind: 'collectible', max: 3, desc: 'Rank insignia torn from a deserting Frieza Force officer. Jaco needs three for his report.', use: null, icon: { shape: 'star', color: '#d8d8c0', color2: '#c040c0' } },
  { id: 'c07_superRadar', name: 'Super Dragon Radar', kind: 'key', max: 1, desc: 'Bulma\'s prototype radar for the planet-sized Super Dragon Balls. Shows nothing but static so far.', use: null, icon: { shape: 'gear', color: '#f8a020', color2: '#40c040' } },
  { id: 'c07_cake', name: 'Mrs. Briefs\'s Cake', kind: 'key', max: 1, desc: 'A towering strawberry cake. Buu has been staring at it since you picked it up.', use: null, icon: { shape: 'food', color: '#f8a0b0', color2: '#f8f8f8' } },
  { id: 'c07_buuPaper', name: 'Buu\'s Exam Paper', kind: 'key', max: 1, desc: 'Every answer is a drawing of candy. Score: 0. Vados added a smiley face anyway.', use: null, icon: { shape: 'scroll', color: '#f0e8d0', color2: '#f8a0c0' } },
  { id: 'c07_snackCrate', name: 'Snack Crate', kind: 'key', max: 1, desc: 'A crate of Galaxy Puffs that fell off a supply cube near the crater rim.', use: null, icon: { shape: 'box', color: '#c08040', color2: '#f8d040' } },
  { id: 'c07_puffs', name: 'Galaxy Puffs', kind: 'key', max: 1, desc: 'Crunchy, glittering snacks from the neutral zone. Two gods are fighting over the last bag.', use: null, icon: { shape: 'food', color: '#c070f0', color2: '#f8f070' } },
  { id: 'c07_starShard', name: 'Orange Stone', kind: 'collectible', max: 3, desc: 'A smooth orange fragment from under the Nameless Planet\'s debris. Faintly warm, like a Dragon Ball.', use: null, icon: { shape: 'ball', color: '#f0a020', color2: '#e04020' } },
  { id: 'c08_parcel', name: 'Monaka\'s Parcel', kind: 'collectible', max: 3, desc: 'A delivery box with Monaka\'s company sticker. Someone on Potaufeu is waiting for it.', use: null, icon: { shape: 'box', color: '#f0f0f0', color2: '#d03030' } },
  { id: 'c08_water', name: 'Superhuman Water?', kind: 'collectible', max: 3, desc: 'A sealed jar labelled "SUPERHUMAN WATER". It sloshes exactly like ordinary water.', use: null, icon: { shape: 'bean', color: '#60b0f0', color2: '#f0f0f0' } },
  { id: 'c08_sealKey', name: 'Pacifier Key', kind: 'key', max: 1, desc: 'The ancient key to the Commeson seal. It looks exactly like a baby\'s pacifier. Teeth marks included.', use: null, icon: { shape: 'gear', color: '#f8d060', color2: '#a050c0' } },
]);

registerQuests([
  { id: 'c06_frieza', title: 'Frieza\'s revenge', star: 'gold', region: 'spot_wasteland', desc: 'Frieza is back from Hell and waiting on the mesa in the Rocky Wasteland. Face him before he turns on the others.' },
  { id: 'c06_party', title: 'Celebrate at Capsule Corp', star: 'gold', region: 'spot_westcity', desc: 'Bulma is throwing a victory party on the Capsule Corp lawn. Talk to everyone, then tell Beerus when you are ready to leave.' },
  { id: 'c06_deserters', title: 'Jaco\'s report', star: 'bronze', region: 'spot_wasteland', desc: 'Three Frieza Force officers fled into the Rocky Wasteland canyon. Defeat them and bring their badges back for Jaco\'s Galactic Patrol report.' },
  { id: 'c07_spar', title: 'Weighted sparring', star: 'gold', region: 'spot_beerus', desc: 'Whis has Goku and Vegeta training in weighted clothing on Lord Beerus\'s planet. Spar with Vegeta on the marble court.' },
  { id: 'c07_recruit', title: 'Assemble Team Universe 7', star: 'gold', region: 'spot_westcity', desc: 'Champa wants a five-on-five tournament. Recruit Piccolo and Buu at Capsule Corp, then tell Beerus you are ready to leave.' },
  { id: 'c07_cake', title: 'A cake for Buu', star: 'silver', region: 'spot_westcity', desc: 'Buu will only join the team if someone brings him a cake. Mrs. Briefs always has one in the kitchen.' },
  { id: 'c07_exam', title: 'The written exam', star: 'gold', region: 'spot_nameless', desc: 'Every fighter must pass a written test before the tournament. Report to Vados at the exam hall on the Nameless Planet.' },
  { id: 'c07_tournament', title: 'Win the Tournament of Destroyers', star: 'gold', region: 'spot_nameless', desc: 'Universe 7 against Universe 6, five fighters each. Talk to the announcer beside the ring to start each match.' },
  { id: 'c07_snacks', title: 'Snacks for the gods', star: 'bronze', region: 'spot_nameless', desc: 'The concession stand is out of Galaxy Puffs and Lord Beerus is getting cranky. A supply crate fell somewhere along the crater rim.' },
  { id: 'c07_shards', title: 'The orange stone', star: 'silver', region: 'spot_nameless', desc: 'Whis noticed strange orange stone under the debris on the crater rim. Bring him three fragments.' },
  { id: 'c08_monaka', title: 'The mighty Monaka', star: 'gold', region: 'spot_westcity', desc: 'Universe 7\'s champion Monaka showed up at the victory party. Goku wants a match. Everyone else wants to keep a secret.' },
  { id: 'c08_potaufeu', title: 'Rescue Goten and Trunks', star: 'gold', region: 'c08_spot_potaufeu', desc: 'The boys stowed away in Monaka\'s delivery truck and ended up on the planet Potaufeu. Find them before someone else does.' },
  { id: 'c08_gryll', title: 'Stop Copy Gryll', star: 'gold', region: 'c08_spot_potaufeu', desc: 'A goo copy of the space criminal Gryll stole Potage\'s seal key and is heading for the Commeson vault at the north end of the mushroom forest. Stop him before he opens it.' },
  { id: 'c08_copy', title: 'Destroy the Commeson', star: 'gold', region: 'c08_spot_potaufeu', desc: 'A copy of Vegeta is loose in the Commeson vault. The real Vegeta is fading. Find a way to hurt the copy.' },
  { id: 'c08_delivery', title: 'Lost delivery', star: 'bronze', region: 'c08_spot_potaufeu', desc: 'Monaka dropped three parcels when his truck bounced across Potaufeu. Find them in the mushroom forest.' },
  { id: 'c08_water', title: 'The superhuman water', star: 'silver', region: 'c08_spot_potaufeu', desc: 'Gryll\'s gang dug up jars of "superhuman water" in the mushroom forest. Potage wants them back before anyone drinks one.' },
]);

registerSpots([
  { id: 'spot_nameless', name: 'Nameless Planet', world: 'space', x: 190, y: 80, map: 'c07_nameless_grounds', tx: 7, ty: 13, icon: 'arena', color: '#e09040' },
  { id: 'c08_spot_potaufeu', name: 'Potaufeu', world: 'space', x: 214, y: 140, map: 'c08_potaufeu_landing', tx: 18, ty: 13, icon: 'planet', color: '#d8b060' },
]);
