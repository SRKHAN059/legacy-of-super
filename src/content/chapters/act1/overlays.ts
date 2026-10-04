import type { PickupDef, PropPlacement } from '../../../game/mapdef';
import { registerOverlay } from '../../registry';
import { HUB } from './hubs';
import { SEALED } from './util';

/**
 * Act 1 layers on the shared hub maps. Every element is gated by chapter/flags so it only appears during its beat.
 * Hub coordinates live in hubs.ts.
 */

const xy = (p: readonly [number, number]) => ({ x: p[0], y: p[1] });

/** Paw-print trail of the radish thief (visible only while c01_tracks is active). */
function pawTrail(points: Array<[number, number]>): PropPlacement[] {
  return points.map(([x, y]) => ({ kind: 'c01_pawprint', x, y, flag: 'quest:c01_tracks' }));
}

// ------------------------------------------------------------------ Prologue: Future Earth

registerOverlay('future_hideout_in', {
  npcs: [
    { id: 'c00_fbulma', sprite: 'futureBulma', ...xy(HUB.hideoutIn.bulma), dir: 'up', talk: 'c00_fbulma_talk', name: 'Bulma', showIf: 'chapter==0', hideIf: 'c00_departed' },
    { id: 'c00_fmai', sprite: 'futureMai', ...xy(HUB.hideoutIn.mai), dir: 'down', talk: 'c00_fmai_talk', name: 'Mai', showIf: 'chapter==0', hideIf: 'c00_departed' },
  ],
  // Save-point tutorial: walking up to the disc in the common room.
  triggers: [{ id: 'c00_saveTut', x: HUB.hideoutIn.save[0], y: HUB.hideoutIn.save[1] - 2, w: 3, h: 3, script: 'c00_save_tut', once: true, showIf: 'chapter==0' }],
});

registerOverlay('future_hideout_out', {
  props: [{ kind: 'caveEntrance', x: 4.2, y: 6.9 }],
  objects: [{ type: 'sign', x: 7, y: 9, text: 'SERVICE TUNNEL 4-E - to Capsule Corp Depot No. 4. Partially collapsed. Enter at your own risk.' }],
  warps: [{
    x: HUB.hideoutOut.tunnelDoor[0], y: HUB.hideoutOut.tunnelDoor[1], w: 1, h: 0.4, to: 'c00_tunnel', tx: 3.5, ty: 11.6, dir: 'up',
    hideIf: 'c00_departed', lockedScript: 'c00_tunnel_sealed',
  }],
  onEnter: 'c00_out_enter',
});

// ------------------------------------------------------------------ Chapter 1: Mt. Paozu

const RADISHES: PickupDef[] = ([[8, 17], [12, 17], [16, 19], [10, 21], [14, 23], [9, 25]] as Array<[number, number]>)
  .map(([x, y], i) => ({ id: `c01_rad${i + 1}`, item: 'c01_radish', x, y, showIf: 'quest:c01_farm' }));

registerOverlay('paozu_house', {
  npcs: [{ id: 'c01_chichi', sprite: 'chichi', ...xy(HUB.paozuHouse.chichi), dir: 'down', talk: 'c01_chichi_talk', name: 'Chi-Chi', showIf: 'chapter==1' }],
});

registerOverlay('paozu_home', {
  npcs: [{ id: 'c01_goten', sprite: 'goten', ...xy(HUB.paozuHome.goten), dir: 'up', talk: 'c01_goten_talk', name: 'Goten', wander: 1, showIf: 'chapter==1', hideIf: 'done:c01_tracks' }],
  pickups: RADISHES,
  props: pawTrail([[12, 20], [14, 22], [15, 16], [10, 15.3], [5, 14.4], [1, 15.2]]),
  onEnter: 'c01_home_enter',
});

registerOverlay('paozu_forest', {
  props: pawTrail([[42, 14.2], [35, 15], [28, 14.3], [21, 15], [15, 14.4], [9, 15], [4, 12], [3, 9], [4, 6.5], [6, 4.6]]),
  npcs: [
    { id: 'c01_hiro', sprite: 'farmer', ...xy(HUB.paozuForest.hiro), dir: 'left', talk: 'c01_hiro_talk', name: 'Old Hiro', showIf: 'chapter>=1', hideIf: 'chapter>=3' },
    { id: 'c01_goatNpc', sprite: 'c01_goat', ...xy(HUB.paozuForest.goat), talk: 'c01_goat_talk', name: 'Mei', wander: 1, showIf: 'quest:c01_goat', hideIf: 'c01_goatHome' },
  ],
  warps: [{ x: HUB.paozuForest.caveDoor[0], y: HUB.paozuForest.caveDoor[1], w: 2, h: 0.4, to: 'c01_shrine', tx: 14.5, ty: 19, dir: 'up' }],
  onEnter: 'c01_forest_enter',
});

registerOverlay('paozu_valley', {
  npcs: [
    { id: 'c01_vgoten', sprite: 'goten', ...xy(HUB.paozuValley.goten), dir: 'right', talk: 'c01_vgoten_talk', name: 'Goten', showIf: 'chapter==1&done:c01_tracks' },
    { id: 'c01_vtrunks', sprite: 'trunksKid', ...xy(HUB.paozuValley.trunks), dir: 'left', talk: 'c01_boys_talk', name: 'Trunks', showIf: 'chapter==1&done:c01_tracks' },
  ],
  onEnter: 'c01_valley_enter',
});

registerOverlay('gohan_house', {
  npcs: [
    { id: 'c01_gohan', sprite: 'gohan', ...xy(HUB.gohanHouse.gohan), dir: 'down', talk: 'c01_gohan_talk', name: 'Gohan', showIf: 'chapter==1' },
    { id: 'c01_videl', sprite: 'videl', ...xy(HUB.gohanHouse.videl), dir: 'down', talk: 'c01_videl_talk', name: 'Videl', showIf: 'chapter==1' },
  ],
});

registerOverlay('paozu_peaks', {
  props: [{ kind: 'caveEntrance', x: 24, y: 0 }, ['c01_steam', 25, 0.4]],
  objects: [{ type: 'sign', x: 22, y: 3, text: 'OLD SPRING TRAIL. The mountain hot spring lies beyond this pass. Beware the guardian of the waters.' }],
  warps: [{ x: HUB.paozuPeaks.springDoor[0] - 0.4, y: HUB.paozuPeaks.springDoor[1], w: 1.4, h: 0.4, to: 'c01_hotspring', tx: 17, ty: 21, dir: 'up', showIf: 'chapter>=1' }],
  // Goten's dino hunt: Scarface rules the plateau.
  triggers: [{ id: 'c01_scarfaceZone', x: 12, y: 2, w: 20, h: 7, script: 'c01_scarface', showIf: `quest:c01_dino&char:goku&!${SEALED}`, hideIf: 'c01_scarfaceBeaten' }],
});

// ------------------------------------------------------------------ Chapter 1: Satan City

registerOverlay('satan_mansion', {
  npcs: [{ id: 'c01_satan', sprite: 'mrSatan', ...xy(HUB.satanMansion.satan), dir: 'down', talk: 'c01_satan_talk', name: 'Mr. Satan', showIf: 'chapter==1' }],
});

registerOverlay('satan_plaza', {
  npcs: [{ id: 'c01_fan', sprite: 'c01_kid', ...xy(HUB.satanPlaza.kid), dir: 'down', talk: 'c01_fan_talk', name: 'Mika', wander: 1, showIf: 'chapter>=1', hideIf: 'chapter>=3' }],
});

registerOverlay('satan_shop', {
  npcs: [{ id: 'c01_shopper', sprite: 'townswoman', ...xy(HUB.satanShop.shopper), dir: 'left', talk: 'c01_shopper_talk', name: 'Picky Shopper', showIf: 'chapter==1' }],
});

// ------------------------------------------------------------------ Chapter 1: King Kai's planet

registerOverlay('kingkai_planet', {
  npcs: [
    { id: 'c01_kingkai', sprite: 'kingKai', ...xy(HUB.kingKai.kingKai), dir: 'down', talk: 'c01_kingkai_talk', name: 'King Kai', showIf: 'chapter>=1', hideIf: 'chapter>=3' },
    { id: 'c01_bubbles', sprite: 'c01_bubbles', ...xy(HUB.kingKai.bubbles), talk: 'c01_bubbles_talk', name: 'Bubbles', wander: 2, showIf: 'chapter>=1', hideIf: 'chapter>=3' },
  ],
  // Picks a cut-short training visit back up (c01_kingkai_enter).
  onEnter: 'c01_kingkai_enter',
});

// ------------------------------------------------------------------ Chapter 2: West City + Satan Dojo

// Picks a cut-short gravity-room opening back up (c02_gravity_enter).
registerOverlay('cc_gravity', { onEnter: 'c02_gravity_enter' });

registerOverlay('cc_yard', {
  props: [{ kind: 'car', x: HUB.ccYard.driver[0] - 2.5, y: HUB.ccYard.driver[1] + 0.2, flag: 'chapter==2', hideFlag: 'c02_rage' }],
  npcs: [{ id: 'c02_driverYard', sprite: 'c02_driver', ...xy(HUB.ccYard.driver), dir: 'down', talk: 'c02_driver_yard', name: 'Chauffeur', showIf: 'chapter==2', hideIf: 'c02_rage' }],
});

registerOverlay('wc_streets', {
  props: [['barrel', HUB.wcStreets.cart[0] + 1.2, HUB.wcStreets.cart[1] - 0.8], { kind: 'crate', x: HUB.wcStreets.cart[0] - 1.2, y: HUB.wcStreets.cart[1] - 0.8, flag: 'chapter>=2' }],
  npcs: [
    { id: 'c02_driverCity', sprite: 'c02_driver', ...xy(HUB.wcStreets.driver), dir: 'right', talk: 'c02_driver_city', name: 'Chauffeur', showIf: 'chapter==2', hideIf: 'c02_rage' },
    { id: 'c02_cart', sprite: 'c02_ramenChef', ...xy(HUB.wcStreets.cart), dir: 'down', talk: 'c02_cart_talk', name: 'Noodle Cart Owner', showIf: 'chapter>=2' },
    { id: 'c02_punkBoss', sprite: 'c02_punk', ...xy(HUB.wcStreets.punks), dir: 'down', talk: 'c02_punk_talk', name: 'Punk Boss', showIf: 'c02_punks', hideIf: 'c02_punksBeaten' },
  ],
});

const SPARRING = 'chapter>=2';
const AT_PARTY = 'c02_boarded&!c02_rage';
registerOverlay('satan_dojo', {
  npcs: [
    // A sparring partner who has been beaten goes home (the story needs Krillin and Tien elsewhere later on).
    { id: 'c02_spYamchaNpc', sprite: 'yamcha', ...xy(HUB.satanDojo.yamcha), dir: 'up', talk: 'c02_spar_yamcha', name: 'Yamcha', showIf: `${SPARRING}&!c02_beatYamcha`, hideIf: AT_PARTY },
    { id: 'c02_spKrillinNpc', sprite: 'krillinGi', ...xy(HUB.satanDojo.krillin), dir: 'up', talk: 'c02_spar_krillin', name: 'Krillin', showIf: `${SPARRING}&!c02_beatKrillin`, hideIf: AT_PARTY },
    { id: 'c02_spTienNpc', sprite: 'tien', ...xy(HUB.satanDojo.tien), dir: 'up', talk: 'c02_spar_tien', name: 'Tien', showIf: `${SPARRING}&!c02_beatTien`, hideIf: AT_PARTY },
  ],
  onEnter: 'c02_dojo_enter',
});
