import { registerMaps } from '../../registry';
import { registerScripts } from '../../../game/script';
import { GRIDS } from './grids';

/*
 * DIABLO DESERT (region 'Diablo Desert', hostile, T2-T3):
 * desert_entry --east--> desert_oasis --north--> pilaf_castle_out --door--> pilaf_castle_in.
 *
 * Coordinates chapters need (tiles):
 *  - desert_entry: world sign (3,13), save (6,13), landing (4,15). Yamcha's old cave mouth at (12-14, 5-7).
 *  - desert_oasis: pond x 7-16 rows 10-17; bandit camp x 26-39 rows 8-21 (campfire (32,14)).
 *  - pilaf_castle_out: castle prop eb_pilafCastle at (15,3) (9x7 tiles), door warp (19,9), arrival outside (19,10).
 *    Courtyard x 10-29 rows 7-18, gate x 18-21 row 19, save point (15,21) outside the gate.
 *  - pilaf_castle_in: entrance warp (15-16,21), arrival (15,20). Save point (13,19) in the entry hall.
 *    VAULT: room x 10-21 rows 2-6, Pilaf's throne at the top (14.5,1.6); open floor x 11-20 rows 4-6,
 *    vault centre (15.5,5); the only way in is the corridor x 15-16 rows 7-12 (good spot for a white story gate
 *    at {x:15,y:7,w:2,h:1}).
 */

const DESERT = { s: 'sand', w: 'wasteland', d: 'dirt', r: 'rock', u: 'ruins', '#': 'cliff', '.': 'grass', '~': 'water' } as const;

registerMaps([
  {
    id: 'desert_entry', name: 'Diablo Desert', music: 'field', hostile: true, region: 'Diablo Desert',
    legend: DESERT,
    grid: GRIDS.desert_entry,
    props: [
      ['caveEntrance', 12, 5.2],
      ['cactus', 6, 4], ['cactus', 22, 2.6], ['cactus', 35, 8.4], ['cactus', 28, 10.4], ['cactus', 4, 23.4], ['cactus', 9.6, 25.4],
      ['cactus', 37, 24.4], ['cactus', 31, 15.6], ['cactus', 24, 16.6], ['cactus', 9.6, 9.4], ['cactus', 39, 4],
      // Ancient ruins.
      ['brokenPillar', 15, 18.6], ['brokenPillar', 21.6, 18.4], ['brokenPillar', 15.6, 23.4], ['brokenPillar', 22, 22.6],
      ['pillar', 18.6, 19.6], ['rubble', 17.6, 22.6], ['rubble', 20.4, 24.6], ['smallRock', 19, 21.4],
      ['rock', 30, 8.2], ['deadTree', 8.6, 18.2], ['deadTree', 33.4, 1.6], ['boulder', 2.4, 3.6],
      ['smallRock', 13, 12.4], ['smallRock', 26, 17.4], ['smallRock', 36, 11.4], ['smallRock', 7, 26.4], ['smallRock', 29, 26.4],
      ['crater', 31, 22.6],
    ],
    npcs: [{ id: 'eb_desert_nomad', sprite: 'eb_nomad', x: 7, y: 16, talk: 'eb_desert_nomad', name: 'Old Nomad', wander: 1 }],
    enemies: [
      { type: 'bandit', x: 25, y: 7 }, { type: 'bandit', x: 31, y: 17 }, { type: 'bandit', x: 14, y: 10 },
      { type: 'banditBrute', x: 19, y: 23 }, { type: 'banditBrute', x: 36, y: 19 },
      { type: 'sandSnake', x: 9, y: 23 }, { type: 'sandSnake', x: 34, y: 25 },
      { type: 'scarab', x: 29, y: 5 },
    ],
    exits: { east: { to: 'desert_oasis' } },
    triggers: [{ id: 'eb_desert_cave', x: 13, y: 6, w: 2, h: 1, script: 'eb_desert_cave', onAction: true }],
    pickups: [{ id: 'del_desert_entry_1', item: 'delicacy', x: 20, y: 24, hidden: true }],
    objects: [
      { type: 'worldSign', x: 3, y: 13 },
      { type: 'save', x: 6, y: 13 },
      { type: 'sign', x: 8, y: 12, text: 'DIABLO DESERT. Water: none. Shade: none. Bandits: plenty. Oasis 2 days east on foot.' },
      { type: 'sign', x: 16, y: 26, text: 'These ruins are older than any kingdom on the map. Nobody knows who built them.' },
      { type: 'breakable', x: 20, y: 7, size: 2 },
      { type: 'breakable', x: 33, y: 17, size: 1 },
      { type: 'breakable', x: 6, y: 27, size: 2 },
      { type: 'breakable', x: 38, y: 21, size: 3, item: 'pow1', id: 'eb_de_rock' },
    ],
  },
  {
    id: 'desert_oasis', name: 'Ten-Palm Oasis', music: 'field', hostile: true, region: 'Diablo Desert',
    legend: DESERT,
    grid: GRIDS.desert_oasis,
    props: [
      // Palms around the pond.
      ['palm', 3.6, 6.4], ['palm', 14.6, 6], ['palm', 18, 9.6], ['palm', 2.4, 13.6], ['palm', 18.6, 14.4],
      ['palm', 5, 16.6], ['palm', 15.6, 17], ['palm', 9.6, 17.4], ['palm', 11.4, 6.4], ['palm', 6.6, 7.4],
      ['flowers', 5, 11], ['flowers', 17, 12], ['flowers', 13, 19], ['bush', 4.6, 19.2],
      // Trader's stall.
      ['tent', 1.2, 17.6], ['barrel', 3.8, 19.6], ['jar', 4.8, 20.2],
      // Bandit camp.
      ['tent', 28.4, 8.6], ['tent', 34, 8.8], ['tent', 28.4, 18], ['tent', 34.6, 18.2],
      ['campfire', 32, 14], ['crate', 37.6, 12], ['crate', 37.6, 13.1], ['barrel', 36.6, 12.4], ['barrel', 27.4, 12.6],
      ['fenceH', 27, 21], ['fenceH', 28, 21], ['fenceH', 33, 21], ['fenceH', 34, 21], ['fenceH', 35, 21],
      // Desert scatter.
      ['cactus', 24, 4.6], ['cactus', 38, 23.6], ['cactus', 22, 26], ['cactus', 8, 25.4], ['cactus', 31, 25.6],
      ['smallRock', 21, 18.4], ['smallRock', 13, 24.4], ['smallRock', 26, 26.4], ['rock', 36, 4.2], ['deadTree', 24.4, 23.6],
    ],
    npcs: [{ id: 'eb_oasis_trader', sprite: 'eb_trader', x: 3, y: 21, talk: 'eb_oasis_trader', name: 'Trader Saffi' }],
    enemies: [
      { type: 'bandit', x: 30, y: 12 }, { type: 'bandit', x: 35, y: 15 }, { type: 'bandit', x: 31, y: 17 },
      { type: 'banditBrute', x: 33, y: 11 }, { type: 'banditBrute', x: 29, y: 15 },
      { type: 'sandSnake', x: 24, y: 23 }, { type: 'sandSnake', x: 9, y: 23 },
      { type: 'scarab', x: 33, y: 4 }, { type: 'hawk', x: 12, y: 4 },
    ],
    exits: { west: { to: 'desert_entry' }, north: { to: 'pilaf_castle_out' } },
    objects: [
      { type: 'sign', x: 2, y: 12, text: 'TEN-PALM OASIS. Fresh water, free to all travellers. (Bandits not included.)' },
      { type: 'sign', x: 26, y: 12, text: 'KEEP OUT. Property of the Desert Fang Gang. Trespassers will be robbed. Again.' },
      { type: 'chest', x: 37, y: 15, id: 'del_desert_oasis_1', item: 'delicacy' },
      { type: 'breakable', x: 30, y: 20, size: 2, look: 'crate', item: 'end1', id: 'eb_do_crate' },
      { type: 'breakable', x: 38, y: 17, size: 1, look: 'crate' },
      { type: 'breakable', x: 11, y: 21, size: 2 },
      { type: 'breakable', x: 21, y: 8, size: 1, look: 'jar' },
    ],
  },
  {
    id: 'pilaf_castle_out', name: 'Pilaf Castle', music: 'cave', hostile: true, region: 'Diablo Desert',
    legend: { ...DESERT, W: 'wall', t: 'tile' },
    grid: GRIDS.pilaf_castle_out,
    props: [
      ['eb_pilafCastle', 15, 3],
      // Courtyard.
      ['statue', 11.4, 12], ['statue', 26.4, 12], ['lamp', 17, 16], ['lamp', 22.4, 16], ['lamp', 12, 3], ['lamp', 27.4, 3],
      ['barrel', 28.6, 7.2], ['barrel', 28.6, 8.4], ['crate', 10.2, 7.2], ['flowers', 13, 17], ['flowers', 25, 17],
      // Outside the walls.
      ['cactus', 4, 4.6], ['cactus', 35, 3.6], ['cactus', 6, 16], ['cactus', 33, 17], ['cactus', 12, 24.6], ['cactus', 28, 25],
      ['rock', 3, 10.2], ['rock', 36, 13.2], ['deadTree', 25.6, 21.6], ['smallRock', 14, 22.4], ['smallRock', 31, 19.4],
      ['smallRock', 7, 26.4], ['rubble', 35, 26.6],
    ],
    enemies: [
      { type: 'pilafRobot', x: 14, y: 13 }, { type: 'pilafRobot', x: 25, y: 13 },
      { type: 'greenDrone', x: 12, y: 6 }, { type: 'greenDrone', x: 27, y: 6 },
      { type: 'bandit', x: 8, y: 24 }, { type: 'banditBrute', x: 31, y: 24 },
    ],
    warps: [{ x: 19, y: 9, w: 1, h: 1, to: 'pilaf_castle_in', tx: 15, ty: 20, dir: 'up', door: true }],
    exits: { south: { to: 'desert_oasis' } },
    objects: [
      { type: 'save', x: 15, y: 21 },
      { type: 'sign', x: 23, y: 21, text: 'PILAF CASTLE. Future capital of the entire world. No solicitors. No Saiyans. ESPECIALLY no Saiyans.' },
      { type: 'chest', x: 11, y: 4, id: 'eb_cap_pilaf_yard', item: 'str1' },
      { type: 'breakable', x: 11, y: 17, size: 1, look: 'jar' },
      { type: 'breakable', x: 28, y: 17, size: 1, look: 'jar' },
      { type: 'breakable', x: 28, y: 4, size: 2, look: 'crate' },
      { type: 'breakable', x: 5, y: 21, size: 2 },
    ],
  },
  {
    id: 'pilaf_castle_in', name: 'Pilaf Castle Interior', music: 'cave', hostile: true, indoor: true, region: 'Diablo Desert',
    tint: 'rgba(40,20,0,0.14)',
    legend: { '#': 'wall', t: 'tile', c: 'carpet', x: 'metal', f: 'floor' },
    grid: GRIDS.pilaf_castle_in,
    props: [
      // Vault: throne at the back, pillars, red rug. Floor rows 4-6 left clear for Chapter 3.
      ['throne', 14.5, 1.6], ['pillar', 10.1, 1.4], ['pillar', 20.9, 1.4], ['rug', 14, 4.4], ['jar', 12, 2.2], ['jar', 19, 2.2],
      // Entry hall.
      ['pillar', 12, 12.4], ['pillar', 19, 12.4], ['pillar', 12, 16.4], ['pillar', 19, 16.4], ['statue', 15.25, 13], ['rug', 14.5, 17.6],
      // Robot workshop.
      ['table', 1, 11.4], ['tv', 1.3, 10.8], ['table', 4.6, 11.4], ['bookshelf', 5.8, 15.6], ['crate', 1, 17.6], ['crate', 2.1, 17.6], ['barrel', 1.2, 16.4],
      // Barracks.
      ['bed', 29.7, 11.6], ['bed', 29.7, 14.2], ['bed', 24.1, 11.6], ['table', 26, 16], ['chair', 25.2, 16], ['chair', 28.1, 16], ['barrel', 24.2, 18.4],
      // Trap room + storeroom.
      ['rug', 3, 3], ['crate', 24.2, 2], ['crate', 25.3, 2], ['barrel', 24.4, 4.4], ['crate', 28.6, 4.6],
    ],
    npcs: [{ id: 'eb_pilaf_captive', sprite: 'townsman', x: 6, y: 4, talk: 'eb_pilaf_captive', name: 'Captive Mechanic' }],
    enemies: [
      { type: 'pilafRobot', x: 13, y: 15 }, { type: 'pilafRobot', x: 18, y: 18 },
      { type: 'greenDrone', x: 15, y: 9 }, { type: 'greenDrone', x: 16, y: 11 },
      { type: 'greenDrone', x: 3, y: 14 }, { type: 'pilafRobot', x: 6, y: 18 },
      { type: 'greenDrone', x: 27, y: 14 }, { type: 'greenDrone', x: 25, y: 18 },
      { type: 'pilafRobot', x: 27, y: 3 },
    ],
    warps: [{ x: 15, y: 21, w: 2, h: 1, to: 'pilaf_castle_out', tx: 19, ty: 10, dir: 'down', door: true }],
    triggers: [{ id: 'eb_pilaf_statue', x: 15, y: 14, w: 2, h: 2, script: 'eb_pilaf_statue', onAction: true }],
    objects: [
      { type: 'save', x: 13, y: 19 },
      { type: 'chest', x: 2, y: 4, id: 'eb_pilaf_senzu', item: 'senzu' },
      { type: 'chest', x: 30, y: 2, id: 'eb_cap_pilaf_store', item: 'pow3' },
      { type: 'chest', x: 7, y: 12, id: 'eb_cap_pilaf_workshop', item: 'end3' },
      { type: 'breakable', x: 1, y: 2, size: 1, look: 'jar' },
      { type: 'breakable', x: 7, y: 2, size: 1, look: 'jar' },
      { type: 'breakable', x: 30, y: 19, size: 1, look: 'jar' },
      { type: 'breakable', x: 7, y: 19, size: 2, look: 'crate' },
      { type: 'breakable', x: 29, y: 4, size: 2, look: 'crate' },
    ],
  },
]);

registerScripts({
  eb_desert_nomad: async (s) => {
    const n = s.inc('eb_desert_nomad_n');
    if (n === 1) {
      await s.talk([
        ['eb_desert_nomad', 'Ah, a traveller. Sit, sit. The desert is not in a hurry, and neither am I.'],
        ['eb_desert_nomad', 'Forty years I have crossed Diablo Desert. Bandits, sand snakes, and once, long ago, a young bandit who could fight like a wolf.', 'smirk'],
        ['eb_desert_nomad', 'He lived in that cave to the north with a little flying cat. Then he met a blue-haired girl and moved to the city. Love makes fools of us all.'],
      ]);
      return;
    }
    if (s.check('chapter>=3') && n % 2 === 0) {
      await s.say('eb_desert_nomad', 'Three strange folk built a castle east of the oasis. A tiny blue one, a lady with a pistol and a dog in a ninja suit. They are loud, but they pay for water.');
      return;
    }
    await s.say('eb_desert_nomad', byChapterLine(s));
  },
  eb_oasis_trader: async (s) => {
    const n = s.inc('eb_oasis_trader_n');
    if (n === 1) {
      await s.talk([
        ['eb_oasis_trader', 'Welcome to Ten-Palm Oasis! Water\'s free. Gossip costs extra. Today it\'s on the house.', 'happy'],
        ['eb_oasis_trader', 'The bandits camped east of the pond have been raiding caravans. They stash everything in a chest by their supply crates.'],
        ['eb_oasis_trader', 'North of here is a castle. Robots, flags, an anthem played from loudspeakers every morning at six. Very annoying.'],
      ]);
      return;
    }
    if (!s.flag('eb_oasis_trader_gift')) {
      s.set('eb_oasis_trader_gift');
      await s.say('eb_oasis_trader', 'You look parched. Here, dates from my own palms. On the house, but tell your friends about Saffi\'s stall!', 'happy');
      await s.give('cookie', 3);
      return;
    }
    await s.say('eb_oasis_trader', s.check('chapter>=5')
      ? 'Caravans stopped coming for a week after those alien ships flew over. Bad for business. Good for the camels.'
      : 'The castle folk buy water in bulk. Their little emperor complains about the price every time and pays every time.');
  },
  eb_desert_cave: async (s) => {
    await s.narrate('An old cave mouth, half buried by a rockslide. Scratched into the stone: "Yamcha & Puar\'s hideout. KEEP OUT. (Girls welcome.)"');
  },
  eb_pilaf_statue: async (s) => {
    await s.narrate('A golden statue of a short, blue, very proud man. The plaque reads: "EMPEROR PILAF - Future Ruler of the World." Someone drew a moustache on it.');
  },
  eb_pilaf_captive: async (s) => {
    const n = s.inc('eb_pilaf_captive_n');
    if (n === 1) {
      await s.talk([
        ['eb_pilaf_captive', 'Oh thank goodness, a real person! They kidnapped me to repair their robots. Six weeks ago!', 'shock'],
        ['eb_pilaf_captive', 'Honestly? They feed me dumplings three times a day and the beds are comfy. I might stay till the weekend.'],
        ['eb_pilaf_captive', 'Word of advice: Pilaf keeps his treasures in the vault at the end of the long north corridor. Every robot in the castle guards that hallway.'],
      ]);
      return;
    }
    await s.say('eb_pilaf_captive', 'The flamethrower robots overheat if you keep moving. Hit them, step back, hit them again. I should know, I built half of them.');
  },
});

/** Nomad's rotating desert wisdom. */
function byChapterLine(s: { check(c: string): boolean; num(n: string): number }): string {
  if (s.check('chapter>=9')) return 'Last night the stars over the desert flickered, as if someone had cut the sky with a knife. Old eyes, maybe.';
  if (s.check('chapter>=5')) return 'Round ships flew north over the dunes last month, a hundred of them. The scorpions hid. Wise creatures, scorpions.';
  return s.num('eb_desert_nomad_n') % 3 === 0
    ? 'Never fight a sand snake in the dunes. It strikes from farther than you think. Lure it onto hard ground.'
    : 'The jade scarabs shrug off ki blasts. Use your fists. That is the desert\'s lesson: some things must be done by hand.';
}
