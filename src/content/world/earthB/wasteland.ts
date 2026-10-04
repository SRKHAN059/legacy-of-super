import { registerMaps } from '../../registry';
import { registerScripts } from '../../../game/script';
import { GRIDS } from './grids';
import { heroTalk } from './talk';

/*
 * ROCKY WASTELAND (region 'Rocky Wasteland', hostile, T2-T4):
 * waste_entry --east--> waste_canyon --north (offset -10)--> waste_mesa.
 *
 * Coordinates chapters need (tiles):
 *  - waste_entry: world sign (2,13), save (5,13), landing (3,15). East opening rows 11-17.
 *  - waste_canyon: Vegeta 25 gate 'eb_g25_vegeta' at x10 y3-5 seals the side cave x 2-9 rows 1-8 (LoG2's
 *    "T-Rex guarding a Golden Capsule" cave): a T-Rex, chest eb_cap_canyon_v25 (str3) at (5,4) and the Delicacy
 *    del_waste_canyon_1 at (3,7). Flight circle basin (29,22) → ledge (37,21); ledge circle (35,23) → basin (27,22).
 *  - waste_mesa (Resurrection 'F' / Golden Frieza battlefield): open ground x 12-36 rows 11-27 with only flat
 *    craters; battlefield centre (24,19). South entrance x 20-25 (save point (19,29)).
 *    Vegeta L50 trophy gate 'g50_vegeta' at x40-42 y10 → chest 'trophy_vegeta' (trophyVegeta) at (41,5).
 *    NW plateau (flight from (14,12) → (6,4); back from (8,6) → (13,13)): good spot for spectators/Bulma's camp.
 *    From Chapter 8, Frieza Force remnants who regrouped after Resurrection 'F' (a trooper, two heavies, an elite;
 *    T4/T5 for a party at L29+) dig in around two crashed pods under the trophy cliffs, x 37-44 rows 12-19.
 *    The pod at (38,14) is examined from just below it (38-39, 15-16).
 */

/** Story point from which the Frieza Force remnants camp on the Great Mesa (its battles are long over by then). */
const REMNANTS = 'chapter>=8';

const WASTE = { w: 'wasteland', d: 'dirt', r: 'rock', '#': 'cliff' } as const;

registerMaps([
  {
    id: 'waste_entry', name: 'Rocky Wasteland', music: 'wasteland', hostile: true, region: 'Rocky Wasteland',
    legend: WASTE,
    grid: GRIDS.waste_entry,
    props: [
      ['deadTree', 5, 9.5], ['deadTree', 24, 8.6], ['deadTree', 33, 23.6], ['deadTree', 17.6, 23.2], ['deadTree', 9, 3.6],
      ['rubble', 20, 9.6], ['rubble', 31, 11.2], ['rubble', 3, 25], ['rubble', 27, 24.4],
      ['rock', 26, 6.2], ['rock', 10, 20.2], ['rock', 37, 19], ['boulder', 15.4, 18.6], ['boulder', 4.4, 6],
      ['smallRock', 8, 14.4], ['smallRock', 15, 16.3], ['smallRock', 27.4, 12.2], ['smallRock', 34, 16.4], ['smallRock', 22, 24.2],
      ['smallRock', 4, 20.4], ['smallRock', 12, 4.6], ['smallRock', 36, 6.4],
      ['crater', 22.6, 13.4], ['crater', 6, 22.6],
      // The delivery scooter's crash site.
      ['crate', 10, 18.6], ['barrel', 12.4, 18.8], ['smallRock', 11.6, 17.4],
    ],
    npcs: [{ id: 'eb_waste_geologist', sprite: 'eb_geologist', x: 6, y: 16, talk: 'eb_waste_geologist', name: 'Dr. Sekimura', wander: 1 }],
    enemies: [
      { type: 'timberWolf', x: 21, y: 6 }, { type: 'timberWolf', x: 23, y: 7 }, { type: 'timberWolf', x: 20, y: 8 },
      { type: 'raptor', x: 30, y: 20 }, { type: 'raptor', x: 33, y: 22 },
      { type: 'boar', x: 13, y: 21 }, { type: 'boar', x: 15, y: 23 },
      { type: 'hawk', x: 27, y: 15 }, { type: 'hawk', x: 35, y: 9 },
    ],
    exits: { east: { to: 'waste_canyon' } },
    pickups: [
      { id: 'del_waste_entry_1', item: 'delicacy', x: 20, y: 25, hidden: true },
      { id: 'eb_broth', item: 'eb_brothCapsule', x: 11, y: 18, showIf: 'quest:eb_delivery' },
    ],
    objects: [
      { type: 'worldSign', x: 2, y: 13 },
      { type: 'save', x: 5, y: 13 },
      { type: 'sign', x: 7, y: 12, text: 'ROCKY WASTELAND. Beware of falling rocks, wild beasts and the occasional sparring Saiyan.' },
      { type: 'sign', x: 37, y: 12, text: 'East: Dragon\'s Throat Canyon. Beyond it lies the Great Mesa.' },
      { type: 'breakable', x: 9, y: 9, size: 2 },
      { type: 'breakable', x: 26, y: 16, size: 1 },
      { type: 'breakable', x: 35, y: 24, size: 3, item: 'str1', id: 'eb_we_boulder' },
      { type: 'breakable', x: 14, y: 25, size: 2 },
    ],
  },
  {
    id: 'waste_canyon', name: 'Dragon\'s Throat Canyon', music: 'wasteland', hostile: true, region: 'Rocky Wasteland',
    legend: WASTE,
    grid: GRIDS.waste_canyon,
    props: [
      ['deadTree', 11.4, 7.6], ['deadTree', 21.6, 1], ['deadTree', 26.6, 19], ['deadTree', 40, 15.6],
      ['rubble', 7, 11.2], ['rubble', 23, 25.2], ['rubble', 15.6, 7.4], ['rubble', 8, 5.6],
      // Side cave behind the Vegeta gate: bones of the T-Rex's last meals.
      ['rock', 2.2, 5.2], ['smallRock', 8.4, 2.4], ['smallRock', 4, 1.4], ['smallRock', 7.2, 7.6],
      ['rock', 18.4, 12.4], ['boulder', 19, 19.2], ['rock', 36.2, 25.2],
      ['smallRock', 3, 16.4], ['smallRock', 11, 9.4], ['smallRock', 24, 4.4], ['smallRock', 29, 1.4], ['smallRock', 21, 23.4],
      ['smallRock', 15, 21.4], ['smallRock', 38, 18.4], ['crater', 22, 21.6],
    ],
    enemies: [
      { type: 'timberWolf', x: 4, y: 13 }, { type: 'timberWolf', x: 6, y: 15 },
      { type: 'raptor', x: 12, y: 12 }, { type: 'raptor', x: 14, y: 16 },
      { type: 'boar', x: 22, y: 22 }, { type: 'boar', x: 26, y: 24 },
      { type: 'sabertooth', x: 24, y: 20 },
      { type: 'pterodactyl', x: 20, y: 4 }, { type: 'pterodactyl', x: 30, y: 3 }, { type: 'pterodactyl', x: 40, y: 24 },
      // The side cave's guardian (behind the Vegeta 25 gate).
      { type: 'tRex', x: 6, y: 6 },
    ],
    exits: { west: { to: 'waste_entry' }, north: { to: 'waste_mesa', offset: -10 } },
    barriers: [{ id: 'eb_g25_vegeta', x: 10, y: 3, w: 1, h: 3, level: 25, character: 'vegeta' }],
    pickups: [{ id: 'del_waste_canyon_1', item: 'delicacy', x: 3, y: 7 }],
    objects: [
      { type: 'sign', x: 2, y: 11, text: 'DRAGON\'S THROAT CANYON. Rockslides likely. North: the Great Mesa.' },
      { type: 'chest', x: 5, y: 4, id: 'eb_cap_canyon_v25', item: 'str3' },
      { type: 'breakable', x: 7, y: 3, size: 1 },
      { type: 'flight', x: 29, y: 22, to: 'waste_canyon', tx: 37, ty: 21, label: 'Ledge' },
      { type: 'flight', x: 35, y: 23, to: 'waste_canyon', tx: 27, ty: 22, label: 'Canyon floor' },
      { type: 'chest', x: 40, y: 19, id: 'eb_cap_canyon_ledge', item: 'pow1' },
      { type: 'breakable', x: 36, y: 19, size: 2 },
      { type: 'breakable', x: 16, y: 10, size: 2 },
      { type: 'breakable', x: 20, y: 26, size: 1 },
    ],
  },
  {
    id: 'waste_mesa', name: 'The Great Mesa', music: 'wasteland', hostile: true, region: 'Rocky Wasteland',
    legend: WASTE,
    grid: GRIDS.waste_mesa,
    props: [
      // Flat craters only in the battlefield centre.
      ['crater', 16, 14.4], ['crater', 28.4, 12.6], ['crater', 21, 22.2], ['crater', 32, 18], ['crater', 11.6, 18.6],
      // Debris at the edges.
      ['rubble', 5, 19.4], ['rubble', 42, 13.2], ['rubble', 9, 28.6], ['rubble', 36, 28.4], ['rubble', 15, 3.6], ['rubble', 31, 3.4],
      ['boulder', 41.6, 20.2], ['boulder', 3.6, 27.4], ['rock', 27, 4.6], ['rock', 42.4, 15.2],
      ['deadTree', 42, 21.6], ['deadTree', 4, 18.6], ['deadTree', 19, 2.2], ['deadTree', 33.4, 29],
      ['smallRock', 9, 12.4], ['smallRock', 39, 16.4], ['smallRock', 25, 6.4], ['smallRock', 14, 26.4], ['smallRock', 30, 27.4],
      // NW plateau lookout.
      ['deadTree', 9.2, 1.4], ['smallRock', 5, 6.4], ['rubble', 3, 6.6],
      // NE trophy notch.
      ['brokenPillar', 38.6, 3], ['brokenPillar', 43.4, 3],
      // Frieza Force remnant camp (Chapter 8 on): two crashed attack pods and salvaged supplies.
      { kind: 'crater', x: 37.4, y: 13.6, flag: REMNANTS }, { kind: 'pod', x: 38.4, y: 14, flag: REMNANTS },
      { kind: 'pod', x: 40.6, y: 16.4, flag: REMNANTS }, { kind: 'crate', x: 43, y: 12.2, flag: REMNANTS },
      { kind: 'crate', x: 44, y: 12.6, flag: REMNANTS }, { kind: 'barrel', x: 36.4, y: 17.6, flag: REMNANTS },
    ],
    enemies: [
      { type: 'sabertooth', x: 8, y: 21 }, { type: 'sabertooth', x: 42, y: 18 },
      { type: 'pterodactyl', x: 30, y: 6 }, { type: 'pterodactyl', x: 16, y: 6 },
      { type: 'greyBear', x: 40, y: 28 },
      { type: 'raptor', x: 12, y: 28 }, { type: 'raptor', x: 34, y: 29 }, { type: 'raptor', x: 44, y: 14 },
      // Frieza Force remnants (T4/T5): they never got the news.
      { type: 'soldierElite', x: 41, y: 13, showIf: REMNANTS }, { type: 'soldierB', x: 39, y: 12, showIf: REMNANTS },
      { type: 'soldierC', x: 37, y: 19, showIf: REMNANTS }, { type: 'soldierC', x: 43, y: 17, showIf: REMNANTS },
    ],
    exits: { south: { to: 'waste_canyon', offset: 10 } },
    barriers: [{ id: 'g50_vegeta', x: 40, y: 10, w: 3, h: 1, level: 50, character: 'vegeta' }],
    triggers: [{ id: 'eb_mesa_pod', x: 38, y: 15, w: 2, h: 2, script: 'eb_mesa_pod', onAction: true, showIf: REMNANTS }],
    objects: [
      { type: 'save', x: 19, y: 29 },
      { type: 'sign', x: 26, y: 29, text: 'THE GREAT MESA. Nothing grows here. Nothing has for a very long time.' },
      { type: 'chest', x: 41, y: 5, id: 'trophy_vegeta', item: 'trophyVegeta' },
      { type: 'flight', x: 14, y: 12, to: 'waste_mesa', tx: 6, ty: 4, label: 'Plateau' },
      { type: 'flight', x: 8, y: 6, to: 'waste_mesa', tx: 13, ty: 13, label: 'Battlefield' },
      { type: 'chest', x: 4, y: 3, id: 'eb_cap_mesa_plateau', item: 'end3' },
      { type: 'breakable', x: 9, y: 3, size: 2 },
      { type: 'breakable', x: 5, y: 12, size: 2 },
      { type: 'breakable', x: 42, y: 27, size: 3 },
      { type: 'breakable', x: 13, y: 30, size: 1 },
      { type: 'breakable', x: 30, y: 30, size: 2 },
    ],
  },
]);

registerScripts({
  // The scouter follows Frieza's canon comebacks: Baba's 24-hour revival for the Tournament of Power (ep 94,
  // 'c13_frieza'), then his full revival and the army he reclaims once Universe 7 has won (ep 131, 'c14_won').
  eb_mesa_pod: async (s) => {
    await s.narrate('A Frieza Force attack pod, half buried in the mesa. A cracked scouter wired to its hatch is still receiving.');
    if (s.check('c14_won')) {
      await s.narrate('"...all units, all units! Lord Frieza lives again, for good, and is reclaiming his army. Report to the flagship. ...Earth squad? Do you copy?"');
      await s.say('hero', 'Sounds like their boss is back in business. ...And they still can\'t get a signal out of this place.', 'smirk');
      return;
    }
    if (s.check('done:c13_frieza')) {
      await s.narrate('"...confirmed, Lord Frieza lives again! ...On the Saiyans\' team? Fighting for the universe? All units hold position until someone explains."');
      return;
    }
    await s.narrate('"...all surviving units, hold this position. Lord Frieza will return. Lord Frieza always returns..."');
    await s.say('hero', 'They\'re still out here waiting for him. Somebody should really break the news.', 'smirk');
  },
  eb_waste_geologist: async (s) => {
    const n = s.inc('eb_waste_geologist_n');
    if (n === 1) {
      await s.talk([
        ['eb_waste_geologist', 'Careful where you step! I\'m Dr. Sekimura, West City University, Department of Geology.', 'shock'],
        ['eb_waste_geologist', 'These mesas are sixty million years old. Half the craters, however, are about twenty years old. Make of that what you will.', 'smirk'],
        ['eb_waste_geologist', 'The canyon east of here leads up to the Great Mesa. There\'s a sealed side cave in the canyon behind one of those strange energy barriers.'],
      ]);
      return;
    }
    if (await heroTalk(s, 'eb_waste_geologist', {
      goku: 'You\'re the fellow who keeps "training" out here, aren\'t you? Half my new craters have your name written all over them. Figuratively.',
      vegeta: 'Whatever you do, please don\'t blast the mesas. They\'re sixty million years old. Some of us have papers to write about them.',
      gohan: 'Excuse me... Son Gohan? I read your paper in the university journal! What is a scholar doing out in the wasteland in a fighting gi?',
      piccolo: s.check('chapter>=6')
        ? 'You! Tall, green, cape... I have a photo of someone just like you on the Great Mesa holding off an entire army. My colleagues say it\'s a lens flare.'
        : 'A Namekian! Is it true you live on water alone? The wasteland would be paradise for you. Apart from the wolves.',
      trunks: 'That sword has seen real fighting. Out here, a blade is handy for rock samples too. ...You don\'t want to hear about rock samples, do you.',
      satan: 'Mr. Satan?! The Champion, out here? Are you here to... punch a mesa? Please don\'t. Please don\'t punch the mesa.',
    })) return;
    // The chatter alternates on its own count: heroTalk answers every other talk, so for a player who keeps one
    // character `n` is always odd by the time it gets here and an `n`-parity line would never play.
    const k = s.inc('eb_waste_geologist_chat');
    if (s.check(REMNANTS) && k % 2 === 1) {
      await s.talk([
        ['eb_waste_geologist', 'Some of those armoured soldiers never went home. They dug in around two crashed pods under the cliffs at the far end of the Great Mesa.', 'shock'],
        ['eb_waste_geologist', 'They shoot at my survey drones and salute an empty sky every morning. I have stopped asking questions.'],
      ]);
      return;
    }
    if (s.check('chapter>=6')) {
      await s.talk([
        ['eb_waste_geologist', 'The Great Mesa is unrecognizable. New craters everywhere, scorch glass, a trench that goes on for kilometres!', 'shock'],
        ['eb_waste_geologist', 'My colleagues think it was a meteor shower. I found a scouter lens and a piece of purple armor. Some meteor.'],
      ]);
      return;
    }
    if (s.check('chapter>=5')) {
      await s.say('eb_waste_geologist', 'Ships! Dozens of round ships flew over the canyon toward the Great Mesa! I am NOT staying to collect samples today!', 'shock');
      return;
    }
    await s.say('eb_waste_geologist', k % 2 === 0
      ? 'Wolves in the north, raptors around the southern mesa, and hawks everywhere. Field work here pays very well, for a reason.'
      : 'A delivery boy crashed his scooter just over there last week. Poor kid limped all the way back to West City. His cargo\'s probably still lying around.');
  },
});
