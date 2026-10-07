import type { EnemySpawn } from '../../../game/mapdef';
import { registerOverlay } from '../../registry';

/**
 * Act 4 layers on the shared hub maps. Every element is gated (chapter / story flags) so it only appears
 * during Chapters 9-11. Coordinates come from the hub authors' map notes.
 */

// ------------------------------------------------------------------ West City: Capsule Corp
registerOverlay('cc_yard', {
  props: [
    // The hangar pad's time machine: HOPE!! (crash-landed) -> wreck -> Cell's old machine.
    { kind: 'timeMachine', x: 32, y: 4, id: 'c09_tm', flag: 'c09_hopeCrashed', hideFlag: 'c09_hopeDestroyed' },
    { kind: 'c09_hopeWreck', x: 32, y: 4, id: 'c09_wreck', flag: 'c09_hopeDestroyed', hideFlag: 'c09_cellOut' },
    // Trunks and Mai leave in it at the end of Chapter 11, so the pad is empty afterwards.
    { kind: 'c09_cellMachine', x: 32, y: 3.8, id: 'c09_cell', flag: 'c09_cellOut', hideFlag: 'c11_farewell' },
    // Bulma's open-air classroom for the Pilaf Gang.
    { kind: 'table', x: 8, y: 17, flag: 'c09_hopeCrashed', hideFlag: 'chapter>=12' },
  ],
  npcs: [
    // Bulma rides along on the third trip (c11_third_trip): from then on she is at the Resistance hideout (c11_bulmaF).
    { id: 'c09_bulmaPad', sprite: 'bulma', x: 31, y: 8, dir: 'up', talk: 'c09_bulma_pad', name: 'Bulma', showIf: 'c09_cellOut&chapter<=11', hideIf: 'c11_inFuture' },
    { id: 'c09_pilafK', sprite: 'pilaf', x: 7, y: 18, dir: 'right', talk: 'c09_pilaf_talk', name: 'Pilaf', showIf: 'c09_hopeCrashed', hideIf: 'chapter>=12' },
    { id: 'c09_maiK', sprite: 'mai', x: 11, y: 18, dir: 'left', talk: 'c09_mai_kid_talk', name: 'Mai', showIf: 'c09_hopeCrashed', hideIf: 'chapter>=12' },
    { id: 'c09_shuK', sprite: 'shu', x: 9, y: 19, dir: 'up', talk: 'c09_shu_talk', name: 'Shu', showIf: 'c09_hopeCrashed', hideIf: 'chapter>=12' },
    // While the fuel quest runs, the rest of the family hangs around the lawn (never doubling the active hero).
    { id: 'c09_gokuY', sprite: 'goku', x: 19, y: 21, dir: 'right', talk: 'c09_goku_yard', name: 'Goku', showIf: 'chapter==9&c09_cellOut&!c09_arrivedFuture&!char:goku' },
    { id: 'c09_vegetaY', sprite: 'vegeta', x: 27, y: 18, dir: 'left', talk: 'c09_vegeta_yard', name: 'Vegeta', showIf: 'chapter==9&c09_cellOut&!c09_arrivedFuture&!char:vegeta' },
    { id: 'c09_kidT', sprite: 'trunksKid', x: 12, y: 19, dir: 'up', talk: 'c09_kid_trunks_talk', name: 'Trunks (kid)', showIf: 'c09_hopeCrashed', hideIf: 'chapter>=12' },
    // Beerus naps on the lawn while Goku looks for answers (Whis is already here: he stands on the lawn from Ch4 on).
    { id: 'c10_beerus', sprite: 'beerus', x: 23, y: 20, dir: 'down', talk: 'c10_beerus_talk', name: 'Beerus', showIf: 'quest:c10_q_ask' },
  ],
  onEnter: 'c09_yard_enter',
});

registerOverlay('cc_gravity', {
  npcs: [
    { id: 'c09_vegeta', sprite: 'vegeta', x: 10, y: 5, dir: 'left', talk: 'c09_vegeta_talk', name: 'Vegeta', showIf: 'quest:c09_q_spar' },
  ],
  // Capsule Corp's own save disc, by the gravity-room door. After the Chapter 9 spar the next step into the yard
  // starts Black's arrival and a real boss fight, so this is the save point before it (and before the spar).
  // (Save objects cannot be gated; like Act 5's arena saves it simply stays, a harmless hub save.)
  objects: [{ type: 'save', x: 4, y: 9 }],
});

// ------------------------------------------------------------------ Mt. Paozu: Gohan's house
registerOverlay('gohan_house', {
  npcs: [
    // Never doubles Gohan when the player is Gohan (switchable in Chapter 9 once the fuel quest starts).
    { id: 'c09_gohanH', sprite: 'gohan', x: 3, y: 5, dir: 'left', talk: 'c09_gohan_talk', name: 'Gohan', showIf: 'chapter>=9&!char:gohan', hideIf: 'chapter>=12' },
    { id: 'c09_videlH', sprite: 'videl', x: 11, y: 7, dir: 'down', talk: 'c09_videl_talk', name: 'Videl', showIf: 'chapter>=9', hideIf: 'chapter>=12' },
  ],
});

// ------------------------------------------------------------------ Future Earth
registerOverlay('future_hideout_in', {
  npcs: [
    { id: 'c09_fmai', sprite: 'futureMai', x: 13, y: 8, dir: 'down', talk: 'c09_mai_talk', name: 'Mai', showIf: 'c09_arrivedFuture', hideIf: 'chapter>=12' },
    { id: 'c10_yajirobe', sprite: 'yajirobe', x: 16, y: 11, dir: 'left', talk: 'c10_yajirobe_talk', name: 'Yajirobe', showIf: 'c10_lairDone', hideIf: 'chapter>=12' },
    { id: 'c11_bulmaF', sprite: 'bulma', x: 16, y: 7, dir: 'up', talk: 'c11_bulmaF_talk', name: 'Bulma', showIf: 'c11_inFuture', hideIf: 'c11_finaleDone' },
    { id: 'c11_mother', sprite: 'townswoman', x: 12, y: 10, dir: 'down', talk: 'c11_mother_talk', name: 'Aiko', showIf: 'chapter==11' },
  ],
});

/** Black's clones roam the ruined city during the Chapter 11 finale. */
const clone = (type: string, x: number, y: number): EnemySpawn => ({ type, x, y, showIf: 'chapter==11&c11_inFuture', hideIf: 'c11_finaleDone' });

registerOverlay('future_city', {
  enemies: [
    clone('c11_blackClone', 10, 15), clone('c11_blackClone', 20, 15), clone('c11_roseClone', 34, 15),
    clone('c11_blackClone', 22, 10), clone('c11_roseClone', 9, 24), clone('c11_blackClone', 40, 24),
    clone('c11_blackClone', 22, 20), clone('c11_roseClone', 35, 7),
  ],
  npcs: [
    { id: 'c11_surv1', sprite: 'resistance', x: 28, y: 28, dir: 'up', talk: 'c11_survivor_talk', name: 'Hiding Survivor', showIf: 'quest:c11_q_survivors', hideIf: 'c11_surv1' },
    { id: 'c11_surv2', sprite: 'townsman', x: 13, y: 19, dir: 'down', talk: 'c11_survivor_talk', name: 'Hiding Survivor', showIf: 'quest:c11_q_survivors', hideIf: 'c11_surv2' },
    { id: 'c11_surv3', sprite: 'kidNpc', x: 44, y: 22, dir: 'left', talk: 'c11_survivor_talk', name: 'Hiding Survivor', showIf: 'quest:c11_q_survivors', hideIf: 'c11_surv3' },
  ],
  // The south end of the main street leads to the plaza under the rift (a scripted passage, not a hub warp).
  // The rift's glow leaks over the end of the avenue (walk-through), marking the way.
  props: [{ kind: 'c11_riftTear', x: 20.5, y: 28.6, id: 'c11_riftGlow', flag: 'chapter==11&c11_inFuture', hideFlag: 'c11_finaleDone' }],
  triggers: [{ id: 'c11_t_toRift', x: 21, y: 30, w: 3, h: 1, script: 'c11_to_rift', showIf: 'chapter==11&c11_inFuture', hideIf: 'c11_finaleDone' }],
});

registerOverlay('future_hideout_out', {
  // Cell's time machine, shot down by Black the moment it landed; Bulma is fixing it from the lab below.
  props: [{ kind: 'c11_cellWreck', x: 19.4, y: 16.4, id: 'c11_wreckF', flag: 'c11_inFuture', hideFlag: 'c11_finaleDone' }],
});

registerOverlay('future_cc_ruins', {
  triggers: [{ id: 'c11_t_notes', x: 31, y: 5, w: 4, h: 1, script: 'c11_notes_shelf', onAction: true, showIf: 'quest:c11_q_notes' }],
});

// ------------------------------------------------------------------ Space: Universe 10 and Zeno's palace
registerOverlay('u10_sacred', {
  npcs: [
    { id: 'c10_gowasu', sprite: 'gowasu', x: 17, y: 13, dir: 'right', talk: 'c10_gowasu_talk', name: 'Gowasu', showIf: 'chapter>=10', hideIf: 'chapter>=12' },
    { id: 'c10_zamasu', sprite: 'zamasu', x: 22, y: 13, dir: 'left', talk: 'c10_zamasu_talk', name: 'Zamasu', showIf: 'chapter==10', hideIf: 'c10_zamasuErased' },
    { id: 'c10_beerusU', sprite: 'beerus', x: 25, y: 16, dir: 'left', talk: 'c10_beerusU_talk', name: 'Beerus', showIf: 'quest:c10_q_u10' },
    // Whis is the ride between Earth and space (c04_world.ts): a player who flies home from the Sacred World mid-case
    // finds him at Capsule Corp, and he is back at the tea table when they return.
    { id: 'c10_whisU', sprite: 'whis', x: 26, y: 16, dir: 'left', talk: 'c10_whisU_talk', name: 'Whis', showIf: 'quest:c10_q_u10&world:space' },
  ],
  triggers: [{ id: 'c10_t_shrine', x: 32, y: 10, w: 3, h: 2, script: 'c10_ring_shrine', onAction: true, showIf: 'chapter>=10' }],
});

registerOverlay('zeno_palace', {
  npcs: [
    { id: 'c10_zeno', sprite: 'zeno', x: 20, y: 4, dir: 'down', talk: 'c10_zeno_talk', name: 'Zeno', showIf: 'chapter>=10', hideIf: 'chapter>=12' },
    { id: 'c10_gp', sprite: 'grandPriest', x: 23, y: 6, dir: 'left', talk: 'c10_gp_talk', name: 'Grand Priest', showIf: 'chapter>=10', hideIf: 'chapter>=12' },
  ],
});

// ------------------------------------------------------------------ Kame House and the Lookout (Mafuba)
registerOverlay('kame_island', {
  npcs: [
    { id: 'c11_roshi', sprite: 'roshi', x: 21, y: 13, dir: 'down', talk: 'c11_roshi_talk', name: 'Master Roshi', showIf: 'chapter==11' },
    // After the finale Roshi waits on the porch once more, for the charm/ramen-coupon payoff (until it is heard), except
    // while he fights in the Tournament of Power (one def per stretch, as for his beach post in c05_world.ts).
    { id: 'c11_roshiP', sprite: 'roshi', x: 21, y: 13, dir: 'down', talk: 'c11_roshi_talk', name: 'Master Roshi', showIf: 'chapter>=12&chapter<=13&c11_finaleDone', hideIf: 'c11_couponJoke' },
    { id: 'c11_roshiP', sprite: 'roshi', x: 21, y: 13, dir: 'down', talk: 'c11_roshi_talk', name: 'Master Roshi', showIf: 'chapter>=14&c11_finaleDone&!c11_couponJoke', hideIf: 'c14_departed&!c14_won' },
    // Goku practises the Mafuba on the beach from the lesson until Roshi hands him the charm.
    { id: 'c11_gokuK', sprite: 'goku', x: 24, y: 14, dir: 'left', talk: 'c11_goku_kame', name: 'Goku', showIf: 'chapter==11&done:c11_q_mafuba&!c11_inFuture', hideIf: 'has:c11_charm' },
  ],
  // An Act 4 porch Roshi replaces the training-hall Roshi while he is out (one Roshi on the island).
  onEnter: 'c11_kame_enter',
});

registerOverlay('lookout', {
  triggers: [{ id: 'c11_t_htc', x: 31, y: 7, w: 1, h: 2, script: 'c11_htc_door', onAction: true, showIf: 'chapter==11' }],
  onEnter: 'c11_lookout_enter',
});
