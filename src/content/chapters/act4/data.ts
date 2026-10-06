import { registerEnemies } from '../../enemies';
import { registerItems } from '../../items';
import { registerQuests } from '../../quests';
import { registerSpots } from '../../world';

/**
 * Act 4 data: key items, journal entries, world-map spots, regular enemies and bosses for
 * Chapters 9 (SOS from the Future), 10 (Gods of Universe 10) and 11 (Project Zero Mortals).
 * Bosses follow CONTENT_GUIDE §6 (boss rows 29-36 and 37-44); regular enemies are tuned to LoG2's own per-enemy band
 * at the level the story brings the hero in (see the regular enemies below).
 */

// ------------------------------------------------------------------ key items

registerItems([
  { id: 'c09_crystal', name: 'Hyper-Crystal', kind: 'key', max: 3, desc: 'A humming blue crystal from the old Capsule Corp mine. Bulma can refine three of them into time-machine fuel.', use: null, icon: { shape: 'star', color: '#80e8f8', color2: '#2080c0' } },
  { id: 'c09_fuel', name: 'Time Machine Fuel', kind: 'key', max: 1, desc: 'A sealed canister of refined Hyper-Crystal fuel. Enough for a round trip... if nobody blows the machine up again.', use: null, icon: { shape: 'capsule', color: '#40c8f0', color2: '#f0f0f0' } },
  { id: 'c10_fruit', name: 'Babari Fruit', kind: 'key', max: 1, desc: 'A sweet fruit from the tree Gowasu planted on Babari ages ago. Still warm from the sun.', use: null, icon: { shape: 'food', color: '#e85890', color2: '#58a040' } },
  { id: 'c10_timeRing', name: 'Time Ring', kind: 'key', max: 1, desc: 'Gowasu\'s green Time Ring. Whoever wears it remembers the true course of time, even when history is rewritten.', use: null, icon: { shape: 'ball', color: '#58e080', color2: '#f0f0f0' } },
  { id: 'c10_zenoButton', name: 'Zeno Button', kind: 'key', max: 1, desc: 'A gift from Lord Zeno himself. Press it and the King of All will come to play... and erase whatever bothers him.', use: null, icon: { shape: 'card', color: '#e05088', color2: '#f8e070' } },
  { id: 'c11_urn', name: 'Sealing Urn', kind: 'key', max: 1, desc: 'The old bottle Kami was once sealed in. Mr. Popo kept it polished for "emergencies".', use: null, icon: { shape: 'box', color: '#c08850', color2: '#f0e0b0' } },
  { id: 'c11_charm', name: 'Sealing Charm', kind: 'key', max: 1, desc: 'A paper charm Master Roshi wrote with his best brush. Slap it on the urn to finish a Mafuba. ...Probably.', use: null, icon: { shape: 'scroll', color: '#f0e8c8', color2: '#d02828' } },
  { id: 'c11_coupon', name: 'Ramen Coupon', kind: 'key', max: 1, desc: '"One free large pork ramen - West City Noodle House." Not, as it turns out, a sealing charm.', use: null, icon: { shape: 'card', color: '#f8d040', color2: '#d03020' } },
  { id: 'c11_notes', name: 'Bulma\'s Notebook', kind: 'key', max: 1, desc: 'Future Bulma\'s last notebook, singed at the edges. Formulas, a shopping list, and a page that just says "Trunks - be safe."', use: null, icon: { shape: 'scroll', color: '#5878c8', color2: '#f0f0f0' } },
]);

// ------------------------------------------------------------------ journal

registerQuests([
  // Chapter 9
  { id: 'c09_q_spar', title: 'A father\'s test', star: 'gold', region: 'spot_westcity', desc: 'Vegeta wants to see what the son from the future can do. Meet him in the Capsule Corp gravity room.' },
  { id: 'c09_q_black', title: 'The man with Goku\'s face', star: 'gold', region: 'spot_westcity', desc: 'Goku Black has followed Trunks into the present! Get out to the Capsule Corp yard, now.' },
  { id: 'c09_q_fuel', title: 'Fuel for a time machine', star: 'gold', region: 'c09_spot_mine', desc: 'Cell\'s old time machine still works, but it has no fuel. Bulma needs three Hyper-Crystals from the abandoned Capsule Corp mine north-east of West City.' },
  { id: 'c09_q_depart', title: 'Back to the future', star: 'gold', region: 'spot_westcity', desc: 'Bring the three Hyper-Crystals to Bulma in the Capsule Corp hangar.' },
  { id: 'c09_q_gohan', title: 'An old master', star: 'silver', region: 'spot_paozu', desc: 'In Trunks\'s era, Gohan died protecting him. This era\'s Gohan lives near Mt. Paozu with his family. Trunks would like to see him, just once.' },
  { id: 'c09_q_homework', title: 'Remedial math', star: 'bronze', region: 'spot_westcity', desc: 'The Pilaf Gang are stuck on their homework inside Capsule Corp. Maybe a time traveller can help.' },
  // Chapter 10
  { id: 'c10_q_ask', title: 'Ask the gods', star: 'gold', region: 'spot_westcity', desc: 'Black\'s partner is a Kai called Zamasu, and nothing can hurt him. Beerus and Whis are raiding the Capsule Corp fridge again - ask them who he is.' },
  { id: 'c10_q_u10', title: 'Gods of Universe 10', star: 'gold', region: 'spot_u10', desc: 'Zamasu is the apprentice of Gowasu, Supreme Kai of Universe 10. Investigate the Sacred World: watch Zamasu, speak with Gowasu, and learn about the Time Rings.' },
  { id: 'c10_q_zeno', title: 'The summons', star: 'gold', region: 'spot_zeno', desc: 'Lord Zeno, King of All, wants to see Goku. Speak with him in his palace. Be polite!' },
  { id: 'c10_q_future', title: 'Return to the future', star: 'gold', region: 'spot_westcity', desc: 'Zamasu is gone, so the future should be safe... right? Take the time machine in the Capsule Corp hangar back to Trunks\'s era.' },
  { id: 'c10_q_lair', title: 'Black\'s hideout', star: 'gold', region: 'c10_spot_lair', desc: 'Black and Zamasu are still in the future. Vegeta and Trunks went back to Black\'s hideout in the ruins east of the Resistance base for a rematch. Hurry after them!' },
  { id: 'c10_q_babari', title: 'Gowasu\'s fruit', star: 'silver', region: 'c10_spot_babari', desc: 'Gowasu planted a fruit tree on the savage planet Babari long ago. Bring back one of its fruits so he can share it with Zamasu.' },
  { id: 'c10_q_medicine', title: 'Medicine run', star: 'bronze', region: 'c10_spot_lair', desc: 'The Resistance medic needs a case of medicine from a pharmacy in the ruins near Black\'s hideout. It is fragile: you cannot fight while carrying it, and one hit breaks it.' },
  // Chapter 11
  { id: 'c11_q_mafuba', title: 'Sealing an immortal', star: 'gold', region: 'spot_kame', desc: 'Zamasu cannot die, so he must be sealed. Master Roshi knows the Evil Containment Wave - go to Kame House.' },
  { id: 'c11_q_urn', title: 'The urn and the charm', star: 'gold', region: 'spot_lookout', desc: 'A Mafuba needs a container and a sealing charm. Mr. Popo keeps an old urn on the Lookout. Roshi will write the charm.' },
  { id: 'c11_q_charm', title: 'Back to the Turtle Hermit', star: 'gold', region: 'spot_kame', desc: 'Mr. Popo lent Trunks the old urn Kami was sealed in. Bring it to Master Roshi at Kame House and collect his sealing charm.' },
  { id: 'c11_q_return', title: 'The third trip', star: 'gold', region: 'spot_westcity', desc: 'Bring the urn and the charm to Bulma\'s time machine in the Capsule Corp hangar.' },
  { id: 'c11_q_rift', title: 'Project Zero Mortals', star: 'gold', region: 'spot_future_city', desc: 'Black\'s clones are tearing through the ruins of West City. Fight through to the sky rift and stop Black and Zamasu.' },
  { id: 'c11_q_notes', title: 'Mother\'s notebook', star: 'silver', region: 'spot_future_city', desc: 'Mai asks Trunks to recover Future Bulma\'s last notebook from the ruins of Capsule Corp before it is lost for good.' },
  { id: 'c11_q_survivors', title: 'Lost in the ruins', star: 'bronze', region: 'spot_future_city', desc: 'Three survivors are hiding from Black\'s clones somewhere in the ruined city. Find them and send them to the Resistance base.' },
]);

// ------------------------------------------------------------------ world-map spots

registerSpots([
  { id: 'c09_spot_mine', name: 'Old Capsule Corp Mine', world: 'earth', x: 176, y: 62, map: 'c09_mine', tx: 5, ty: 25, icon: 'cave' },
  { id: 'c10_spot_babari', name: 'Planet Babari', world: 'space', x: 44, y: 156, map: 'c10_babari', tx: 6, ty: 23, icon: 'planet', color: '#58a040' },
  { id: 'c10_spot_lair', name: 'Black\'s Hideout', world: 'future', x: 178, y: 96, map: 'c10_lair', tx: 16, ty: 21, icon: 'ruins' },
]);

// ------------------------------------------------------------------ regular enemies

// Tuned to LoG2's per-enemy band (critic round 2, gap 1; tests/grind.test.ts measures every hostile zone and
// tests/balance.test.ts 'grind zones: act 4' holds these): with the hero in form at the level the story brings them in,
// 5-9 strings drop one and it takes 15+ of its own hits to knock the hero out, as LoG2's Tropical Islands (L30) and
// Snowy Highlands (L35) mobs do. At the T5/T6 rows of CONTENT_GUIDE §6 they took 10-17 strings, and the engine's late-game
// damage scale let a STR 44 blow take a seventh of Super Saiyan Trunks's health at L30: one clear of the mine cost him
// his whole bag of Senzu. So HP and END sit below those rows and the attack stat (STR, or POW for shooters) runs 29-39,
// rising chapter by chapter; EXP keeps the T5/T6 rates, which the faster clears turn into more EXP a minute.
registerEnemies([
  // ---- Chapter 9: the abandoned mine, the Trunks 33 gate's grind zone (Trunks arrives at L30, Super Saiyan).
  {
    id: 'c09_crystalBat', name: 'Crystal Bat', sprite: 'c09_crystalBat', hp: 720, str: 29, pow: 1, end: 24, exp: 9500, ai: 'flyer', speed: 1.5,
    desc: 'A cave bat that feeds on Hyper-Crystal radiation. Its wings ring like glass when it dives.',
  },
  {
    id: 'c09_mineDrone', name: 'Survey Drone', sprite: 'c09_mineDrone', hp: 820, str: 1, pow: 30, end: 26, exp: 10000, ai: 'shooter', speed: 1.0, flying: true,
    shot: { color: '#40f0f0', cooldown: 95, speed: 2.4, mult: 0.85 },
    desc: 'A Capsule Corp survey drone left running for years. It now treats every visitor as a cave-in hazard.',
  },
  {
    id: 'c09_rockCrawler', name: 'Rock Crawler', sprite: 'c09_rockCrawler', hp: 1000, str: 32, pow: 1, end: 32, exp: 13000, ai: 'charger', speed: 1.15,
    desc: 'A beetle the size of a motorbike with crystal-studded horns. It rams first and asks questions never.',
  },
  {
    id: 'c09_haywireMech', name: 'Haywire Digger', sprite: 'c09_haywireMech', hp: 1150, str: 33, pow: 30, end: 36, exp: 15000, ai: 'heavy', speed: 0.8, box: { w: 20, h: 10 },
    shot: { color: '#f8a040', cooldown: 110, speed: 2.0, mult: 0.9 },
    desc: 'A mining robot whose safety chip fried decades ago. Still drilling. Still very angry about it.',
  },
  // ---- Chapter 10: Babari (Goku L31, Super Saiyan Blue) and the ruins around Black's hideout, the Goku 35 gate's
  // grind zone (Goku arrives at L33).
  {
    id: 'c10_babarian', name: 'Babarian Warrior', sprite: 'babarian', hp: 1100, str: 34, pow: 1, end: 32, exp: 15000, ai: 'rusher', speed: 1.2,
    desc: 'A club-swinging native of Babari. Fights anything that is not a Babarian, and most things that are.',
  },
  {
    id: 'c10_babarianSlinger', name: 'Babarian Slinger', sprite: 'c10_babarianSlinger', hp: 900, str: 24, pow: 33, end: 28, exp: 14000, ai: 'shooter', speed: 1.0,
    shot: { color: '#a08050', cooldown: 80, speed: 2.4, mult: 0.8 },
    desc: 'A Babarian who throws rocks with frightening accuracy. Gowasu insists they will invent writing one day.',
  },
  {
    id: 'c10_babariBeast', name: 'Horned Lizard', sprite: 'c10_babariBeast', hp: 1200, str: 34, pow: 1, end: 34, exp: 18000, ai: 'charger', speed: 1.1,
    desc: 'A Babari predator with a horned snout. The Babarians ride the tame ones. There are no tame ones here.',
  },
  {
    id: 'c10_mutantHound', name: 'Ruin Hound', sprite: 'c10_mutantHound', hp: 1200, str: 36, pow: 1, end: 32, exp: 16000, ai: 'rusher', speed: 1.35,
    desc: 'Wild dogs grown huge and mean in the ruined city. They avoid Black\'s hideout... mostly.',
  },
  {
    id: 'c10_scrapMech', name: 'Black\'s Sentry', sprite: 'c10_scrapMech', hp: 1450, str: 37, pow: 35, end: 38, exp: 19000, ai: 'heavy', speed: 0.85, box: { w: 20, h: 10 },
    shot: { color: '#f070b0', cooldown: 100, speed: 2.2, mult: 0.9 },
    desc: 'A salvaged security robot. Someone painted its visor pink. Someone with a lot of free time.',
  },
  // ---- Chapter 11: Black's clones (Rage Trunks, L34) and the sealing wards.
  {
    id: 'c11_blackClone', name: 'Black Clone', sprite: 'gokuBlack', hp: 1700, str: 39, pow: 1, end: 38, exp: 30000, ai: 'rusher', speed: 1.35,
    desc: 'A copy of Goku Black born from the rift in the sky. As arrogant as the original, and just as eager to fight.',
  },
  {
    // A shooter backs away from the hero at its own speed; at 1.15 a Rose Clone drifted into the plaza's north-west
    // pocket behind the dead tree and dragged a clear out to a minute.
    id: 'c11_roseClone', name: 'Rose Clone', sprite: 'blackRose', hp: 1300, str: 32, pow: 38, end: 36, exp: 32000, ai: 'shooter', speed: 1.0,
    shot: { color: '#f070b0', cooldown: 70, speed: 2.8, mult: 0.9 },
    desc: 'A clone in Super Saiyan Rose. Fires pink ki from a distance and calls it "beautiful" every single time.',
  },
  {
    id: 'c11_ward', name: 'Sealing Ward', sprite: 'c11_ward', hp: 240, str: 1, pow: 1, end: 30, exp: 0, ai: 'idle', speed: 0, drops: 'none',
    desc: 'One of Roshi\'s paper wards, floating in place. Strike all three to close the Mafuba circle.',
  },
]);

// ------------------------------------------------------------------ bosses

registerEnemies([
  // ---- Chapter 9
  {
    id: 'c09_dabura', name: 'Dabura', sprite: 'c09_dabura', hp: 4900, str: 44, pow: 46, end: 50, exp: 40000, ai: 'boss', speed: 1.0,
    desc: 'King of the Demon Realm, in the service of the wizard Babidi. His spit turns living things to stone.',
    boss: {
      endAt: 0.3, kiColor: '#f05030',
      phases: [
        { until: 0.6, moves: ['chase', 'shot', 'dash'], rest: 50 },
        { until: 0, moves: ['chase', 'volley', 'beam', 'rain'], rest: 38, speed: 1.2, onStart: 'c09_dabura_phase2' },
      ],
    },
  },
  {
    id: 'c09_vegetaSpar', name: 'Vegeta', sprite: 'vegetaSSB', hp: 5200, str: 46, pow: 48, end: 52, exp: 42000, ai: 'boss', speed: 1.05,
    desc: 'The Prince of all Saiyans, testing his son from another timeline. He is holding back. A little.',
    boss: {
      endAt: 0.5, kiColor: '#c070f8',
      phases: [
        { until: 0.75, moves: ['chase', 'shot', 'dash'], rest: 46 },
        { until: 0, moves: ['chase', 'volley', 'beam', 'teleport', 'guard'], rest: 34, speed: 1.15, onStart: 'c09_vegeta_phase2' },
      ],
    },
  },
  {
    id: 'c09_black', name: 'Goku Black', sprite: 'gokuBlack', hp: 5800, str: 47, pow: 50, end: 54, exp: 50000, ai: 'boss', speed: 1.1,
    desc: 'A man with Goku\'s face and a god\'s contempt for mortals. He wears a green Time Ring and a single green earring.',
    boss: {
      endAt: 0.5, kiColor: '#c03060',
      phases: [
        { until: 0.8, moves: ['chase', 'teleport', 'shot'], rest: 44 },
        { until: 0, moves: ['volley', 'beam', 'dash', 'teleport', 'rain'], rest: 32, speed: 1.2, onStart: 'c09_black_phase2' },
      ],
    },
  },
  {
    id: 'c09_excavator', name: 'Excavator X-7', sprite: 'c09_excavator', hp: 4900, str: 45, pow: 44, end: 50, exp: 40000, ai: 'boss', speed: 0.9,
    box: { w: 28, h: 12 },
    desc: 'Capsule Corp\'s biggest mining robot, sealed in the deep shaft when the mine closed. It has been guarding the last crystal vein ever since.',
    boss: {
      endAt: 0, kiColor: '#f8a040', minion: 'c09_mineDrone',
      phases: [
        { until: 0.5, moves: ['charge', 'chase', 'shot'], rest: 50 },
        { until: 0, moves: ['charge', 'rain', 'volley', 'summon'], rest: 36, speed: 1.15, onStart: 'c09_excavator_phase2' },
      ],
    },
  },
  // ---- Chapter 10
  {
    id: 'c10_zamasuSpar', name: 'Zamasu', sprite: 'zamasu', hp: 6000, str: 48, pow: 52, end: 56, exp: 52000, ai: 'boss', speed: 1.1,
    desc: 'Apprentice to Supreme Kai Gowasu of Universe 10. Polite, gifted, and quietly disgusted by mortals.',
    boss: {
      endAt: 0.5, kiColor: '#b0f070',
      phases: [
        { until: 0.75, moves: ['chase', 'dash', 'shot'], rest: 44 },
        { until: 0, moves: ['teleport', 'volley', 'beam', 'chase'], rest: 32, speed: 1.2, onStart: 'c10_zamasu_phase2' },
      ],
    },
  },
  {
    id: 'c10_babarianChief', name: 'Babarian Chief', sprite: 'c10_babarianChief', hp: 4900, str: 49, pow: 40, end: 52, exp: 45000, ai: 'boss', speed: 1.0,
    desc: 'The biggest, loudest Babarian on the planet. He guards the sacred fruit tree with his life and his very large club.',
    boss: {
      endAt: 0.3, kiColor: '#a08050', minion: 'c10_babarian',
      phases: [
        { until: 0.6, moves: ['chase', 'charge'], rest: 48 },
        { until: 0, moves: ['chase', 'charge', 'summon', 'rain'], rest: 34, speed: 1.15, onStart: 'c10_chief_rally' },
      ],
    },
  },
  {
    id: 'c10_black', name: 'Goku Black', sprite: 'gokuBlack', hp: 6200, str: 50, pow: 53, end: 58, exp: 55000, ai: 'boss', speed: 1.1,
    desc: 'Black, on his home ground. He fights with a ki blade and talks about justice the whole time.',
    boss: {
      endAt: 0.5, kiColor: '#c03060',
      phases: [
        { until: 0.75, moves: ['chase', 'teleport', 'shot', 'dash'], rest: 42 },
        { until: 0, moves: ['volley', 'beam', 'teleport', 'rain'], rest: 30, speed: 1.2, onStart: 'c10_black_blade' },
      ],
    },
  },
  {
    id: 'c10_blackRose', name: 'Goku Black (Rose)', sprite: 'blackRose', hp: 7500, str: 60, pow: 60, end: 64, exp: 0, ai: 'boss', speed: 1.25,
    desc: 'Super Saiyan Rose: Black\'s divine ki turned pink. Faster and harder than anything Vegeta expected.',
    boss: {
      endAt: 0.6, kiColor: '#f070b0',
      phases: [
        { until: 0.8, moves: ['chase', 'teleport', 'volley', 'dash'], rest: 30 },
        { until: 0, moves: ['beam', 'rain', 'teleport', 'nova', 'chase'], rest: 24, speed: 1.3 },
      ],
    },
  },
  {
    id: 'c10_futureZamasu', name: 'Future Zamasu', sprite: 'zamasu', hp: 7000, str: 54, pow: 56, end: 60, exp: 0, ai: 'boss', speed: 1.1,
    desc: 'The Zamasu of Trunks\'s timeline. He wished for an immortal body. Nothing you do to it leaves a mark.',
    boss: {
      endAt: 0.5, kiColor: '#b0f070', vulnerableIf: 'c10_zamasuMortal',
      phases: [
        { until: 0, moves: ['chase', 'teleport', 'volley', 'beam'], rest: 34, speed: 1.1 },
      ],
    },
  },
  // ---- Chapter 11
  {
    id: 'c11_blackRoseA', name: 'Goku Black (Rose)', sprite: 'blackRose', hp: 7000, str: 54, pow: 57, end: 60, exp: 0, ai: 'boss', speed: 1.2,
    desc: 'Black, amused by a mortal\'s rage. He did not expect it to sting.',
    boss: {
      endAt: 0.85, kiColor: '#f070b0',
      phases: [
        { until: 0, moves: ['chase', 'teleport', 'volley', 'dash', 'beam'], rest: 30, speed: 1.2 },
      ],
    },
  },
  {
    id: 'c11_blackRoseB', name: 'Goku Black (Rose)', sprite: 'blackRose', hp: 7800, str: 55, pow: 59, end: 63, exp: 120000, ai: 'boss', speed: 1.2,
    desc: 'Black at the height of his power, wielding a scythe of pink ki that tears holes in the sky.',
    // Rage Trunks (L34, ~820 HP) has no form above this: STR 57 floored him in six blows and put the hits ratio at
    // 6.5, past the story band's limit of 6. STR 55 (still above the first Rose bout) with Zamasu cutting in at 30%
    // brings it to 5.1.
    boss: {
      endAt: 0.3, kiColor: '#f070b0', minion: 'c11_blackClone',
      phases: [
        { until: 0.7, moves: ['chase', 'dash', 'shot', 'teleport'], rest: 40 },
        { until: 0.45, moves: ['volley', 'beam', 'rain', 'teleport'], rest: 32, speed: 1.15, onStart: 'c11_rose_scythe' },
        { until: 0, moves: ['summon', 'chase', 'beam', 'nova'], rest: 28, speed: 1.25, onStart: 'c11_rose_clones' },
      ],
    },
  },
  {
    id: 'c11_zamasuSeal', name: 'Future Zamasu', sprite: 'zamasu', hp: 7200, str: 55, pow: 57, end: 60, exp: 90000, ai: 'boss', speed: 1.1,
    desc: 'Immortal, but not untouchable: while Roshi\'s three wards are struck, the Mafuba circle pins his body in place.',
    boss: {
      endAt: 0.7, kiColor: '#b0f070', vulnerableIf: 'c11_sealOpen',
      phases: [
        { until: 0, moves: ['chase', 'teleport', 'volley', 'beam'], rest: 36, speed: 1.05 },
      ],
    },
  },
  {
    id: 'c11_fusedA', name: 'Fused Zamasu', sprite: 'fusedZamasu', hp: 8000, str: 58, pow: 60, end: 64, exp: 0, ai: 'boss', speed: 1.2,
    desc: 'Black and Zamasu, fused with the Potara. A god of justice with an immortal half and a Saiyan half.',
    boss: {
      endAt: 0.6, kiColor: '#f04060',
      phases: [
        { until: 0.8, moves: ['chase', 'volley', 'dash'], rest: 36 },
        { until: 0, moves: ['beam', 'rain', 'teleport', 'nova'], rest: 28, speed: 1.2, onStart: 'c11_fused_mutate' },
      ],
    },
  },
  {
    id: 'c11_fusedB', name: 'Fused Zamasu', sprite: 'c11_fusedHalf', hp: 8200, str: 60, pow: 60, end: 64, exp: 0, ai: 'boss', speed: 1.2,
    desc: 'The fusion is breaking down: his immortal half spreads like a purple stain wherever he is hurt.',
    boss: {
      endAt: 0.4, kiColor: '#f04060',
      phases: [
        { until: 0, moves: ['chase', 'beam', 'rain', 'teleport', 'nova', 'volley'], rest: 26, speed: 1.25 },
      ],
    },
  },
  {
    id: 'c11_fusedC', name: 'Fused Zamasu', sprite: 'c11_fusedHalf', hp: 8200, str: 60, pow: 60, end: 65, exp: 200000, ai: 'boss', speed: 1.2,
    desc: 'A god who believes he is the world itself. He has never been more wrong, or more dangerous.',
    boss: {
      endAt: 0.5, kiColor: '#f04060',
      phases: [
        { until: 0, moves: ['chase', 'volley', 'beam', 'teleport', 'rain'], rest: 28, speed: 1.2 },
      ],
    },
  },
]);
