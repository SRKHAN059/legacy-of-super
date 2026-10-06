import { registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerSpots } from '../../world';

/** Act 5 key items, journal entries and the Monster Island landing spot. */

registerItems([
  { id: 'c12_herb', name: 'Paradise Herb', kind: 'key', max: 1, desc: 'A glowing herb from the Forest of Terror. Master Roshi swears it restores youth. It smells like old socks.', use: null, icon: { shape: 'food', color: '#68d058', color2: '#f8f080' } },
  { id: 'c12_reel', name: 'Saiyaman Film Reel', kind: 'key', max: 1, desc: 'The uncut stunt footage of the Great Saiyaman. Gohan would rather nobody watched it.', use: null, icon: { shape: 'box', color: '#383840', color2: '#2a8a3a' } },
  { id: 'c13_beacon', name: 'Ranger Beacon', kind: 'key', max: 1, desc: 'Android 17\'s capsule beacon. Calm a lost Monster Island animal and it is beamed safely home.', use: null, icon: { shape: 'gear', color: '#40a060', color2: '#f08020' } },
  { id: 'c13_contract', name: 'Recruitment Contract', kind: 'key', max: 1, desc: 'Bulma\'s contract: ten million zeni per fighter, payable after the Tournament of Power.', use: null, icon: { shape: 'card', color: '#f0e0b0', color2: '#d03030' } },
  { id: 'post_belt', name: 'Champion\'s Belt', kind: 'key', max: 1, desc: 'Mr. Satan\'s spare championship belt. He has eleven more at home.', use: null, icon: { shape: 'trophy', color: '#f0d040', color2: '#e03030' } },
]);

registerQuests([
  // Chapter 12
  { id: 'c12_days', title: 'Days of Peace: finish any two episodes', star: 'gold', region: 'spot_satancity', desc: 'Earth is quiet for once. Help your friends: Hit\'s contract (Beerus and Whis at Capsule Corp), Pan\'s first flight (Videl in Mt. Paozu), the Saiyaman movie (Satan City), Krillin\'s comeback (Kame House), King Kai\'s wish (Bulma\'s secret project on the Capsule Corp pad) or Champa\'s challenge (the Capsule Corp garden). Any two will do.' },
  { id: 'c12_hit', title: 'The unseen assassin', star: 'silver', region: 'spot_satancity', desc: 'Someone has hired the legendary assassin Hit to take Goku out. Ask Beerus and Whis at Capsule Corp, then take Hotel Satan\'s roof stairs at night (talk to the night porter).' },
  { id: 'c12_pan', title: 'Pan\'s first flight', star: 'silver', region: 'spot_paozu', desc: 'Videl needs a babysitter, and baby Pan has just learned to fly. Catch her and carry her back without letting anything hit you.' },
  { id: 'c12_saiyaman', title: 'Great Saiyaman: the movie', star: 'silver', region: 'spot_satancity', desc: 'Barry Kahn hired Gohan as his stunt double to humiliate him. Report to the film lot in Satan City.' },
  { id: 'c12_krillin', title: 'Krillin\'s comeback', star: 'silver', region: 'spot_kame', desc: 'Master Roshi wants the Paradise Herb from the Forest of Terror. Krillin will need his courage back to get it.' },
  // Chapter 13
  { id: 'c13_team', title: 'Recruit the Mighty Ten of Universe 7', star: 'gold', region: 'spot_westcity', desc: 'Universe 7 needs ten fighters. Goku, Vegeta, Gohan and Piccolo are in. Recruit Krillin and 18, Tien and Roshi, train Gohan, find Android 17... then find a tenth.' },
  { id: 'c13_krillin', title: 'Recruit Krillin and Android 18', star: 'silver', region: 'spot_satancity', desc: 'Krillin is on patrol in Satan City. 18 will want to talk about money.' },
  { id: 'c13_tien', title: 'Recruit Tien and Master Roshi', star: 'silver', region: 'spot_kame', desc: 'Chiaotzu is waiting at Kame House. Something has gone wrong at Tien\'s dojo.' },
  { id: 'c13_gohan', title: 'Gohan\'s ultimate training', star: 'silver', region: 'spot_lookout', desc: 'Gohan has gone soft. Piccolo is waiting on the Lookout to beat his potential back out of him.' },
  { id: 'c13_17', title: 'Find Android 17 on Monster Island', star: 'silver', region: 'spot_monster', desc: 'Dende says Android 17 works as a park ranger on Monster Island. Poachers are prowling the reserve.' },
  { id: 'c13_frieza', title: 'The tenth warrior', star: 'silver', region: 'spot_westcity', desc: 'Buu fell asleep and won\'t wake for months. Goku has a terrible idea. Talk to Beerus and Whis at Capsule Corp.' },
  { id: 'c13_animals', title: 'Return the seven escaped animals', star: 'bronze', region: 'spot_monster', desc: 'The poachers\' ship broke open and seven rare animals fled across the world. Find them, calm them with the Ranger Beacon, then tell 17.' },
  // Chapter 14
  { id: 'c14_ready', title: 'The Mighty Ten assemble', star: 'gold', region: 'spot_westcity', desc: 'The Tournament of Power starts in a few hours. Save, prepare, then tell Beerus at the Capsule Corp garden table when Universe 7 is ready to leave for the World of Void.' },
  { id: 'c14_top', title: 'Win the Tournament of Power', star: 'gold', region: 'spot_zeno', desc: 'Eight universes, eighty fighters, forty-eight minutes. Fight from the west ring to the east, knock every rival out of the ring and be the last universe standing. If you ever leave the stage, the Grand Priest at Zeno\'s palace will send you back.' },
  // Post-game
  { id: 'post_trueEnd', title: 'Visit Whis and Beerus', star: 'gold', region: 'spot_westcity', desc: 'The universes are safe. Whis and Beerus are raiding the buffet at Capsule Corp. Talk to them whenever you are ready to see how the story ends - free roam carries on afterwards.' },
  { id: 'post_trophies', title: 'Collect the five trophies', star: 'silver', region: 'spot_snow', desc: 'Level 50 gates guard a trophy for Goku, Vegeta, Gohan, Trunks and Piccolo. Rumour says the World Champion is watching.' },
  { id: 'post_ztv', title: 'Mr. Satan\'s press conference', star: 'silver', region: 'spot_satancity', desc: 'Get Mr. Satan to level 50 and break the red gate at the ZTV studio. The world deserves to hear the "truth".' },
  { id: 'post_jiren', title: 'Jiren\'s rematch', star: 'bronze', region: 'spot_zeno', desc: 'Jiren is waiting at Zeno\'s palace. No time limit, no ring, no holding back.' },
  { id: 'post_hit', title: 'Hit\'s open contract', star: 'bronze', region: 'spot_satancity', desc: 'Hit left the contract open. Tonight, on the Satan City rooftops, there are no rules.' },
]);

registerSpots([
  { id: 'spot_monster', name: 'Monster Island', world: 'earth', x: 214, y: 84, map: 'c13_monster_beach', tx: 16, ty: 16, icon: 'island' },
  // Chapter 13 locations become revisitable once found (the escaped animals may be hiding there).
  { id: 'c13_spot_dojo', name: 'Tien-Shin Dojo', world: 'earth', x: 56, y: 64, map: 'c13_tien_dojo', tx: 18, ty: 23, icon: 'mountain' },
  { id: 'c13_spot_wilds', name: 'Wilderness Plateau', world: 'earth', x: 184, y: 118, map: 'c13_training_wilds', tx: 6, ty: 13, icon: 'mountain' },
  { id: 'c13_spot_baba', name: 'Baba\'s Palace', world: 'earth', x: 140, y: 190, map: 'c13_baba_lake', tx: 18, ty: 23, icon: 'palace' },
]);
