import { registerOverlay } from '../../registry';
import { HUB } from './hubs';

/**
 * Act 5 layers on the shared hub maps. Every element is gated (chapter / quest / post-game flags) so it
 * only appears when the story needs it. Coordinates follow the world builders' story-NPC notes.
 */

// ---------------------------------------------------------------- Mt. Paozu
registerOverlay('paozu_valley', {
  // Videl stays home with Pan from Chapter 12 on (her lines follow the story).
  npcs: [
    { id: 'c12_videlV', sprite: 'videl', x: HUB.valley.videl[0], y: HUB.valley.videl[1], dir: 'down', talk: 'c12_videl_talk', name: 'Videl', showIf: 'chapter>=12' },
  ],
});

registerOverlay('paozu_home', {
  npcs: [
    { id: 'act5_chichi', sprite: 'chichi', x: HUB.home.chichi[0], y: HUB.home.chichi[1], dir: 'down', talk: 'act5_chichi_talk', name: 'Chi-Chi', showIf: 'chapter>=12' },
    // Goten moves to Monster Island to "help" 17 once the ranger joins the team, and comes home after the tournament.
    { id: 'act5_goten', sprite: 'goten', x: HUB.home.goten[0], y: HUB.home.goten[1], dir: 'down', talk: 'act5_goten_talk', name: 'Goten', showIf: 'chapter>=12', hideIf: 'c13_17Joined&!post_game' },
    // The seventh escaped animal wandered all the way to the Son family's grove.
    { id: 'c13_ani7', sprite: 'c13_minotaurus', x: 35, y: 21, talk: 'c13_animal_talk', name: 'Minotaurus Calf', wander: 1, showIf: 'c13_animalsLoose', hideIf: 'c13_ani_c13_ani7' },
  ],
});

registerOverlay('paozu_peaks', { onEnter: 'post_trophy_check' });

// ---------------------------------------------------------------- Satan City
registerOverlay('satan_plaza', {
  npcs: [
    { id: 'c12_porter', sprite: 'waiter', x: HUB.plaza.porter[0], y: HUB.plaza.porter[1], dir: 'down', talk: 'c12_porter_talk', name: 'Night Porter', showIf: 'chapter>=12' },
    { id: 'c12_directorP', sprite: 'c12_director', x: HUB.plaza.director[0], y: HUB.plaza.director[1], dir: 'right', talk: 'c12_director_plaza', name: 'Film Director', showIf: 'chapter>=12', hideIf: 'done:c12_saiyaman' },
    { id: 'c13_krillinP', sprite: 'krillin', x: HUB.plaza.krillin[0], y: HUB.plaza.krillin[1], dir: 'left', talk: 'c13_krillin_talk', name: 'Krillin', showIf: 'quest:c13_krillin' },
    { id: 'c13_18P', sprite: 'android18', x: HUB.plaza.k18[0], y: HUB.plaza.k18[1], dir: 'right', talk: 'c13_18_talk', name: 'Android 18', showIf: 'quest:c13_krillin' },
    { id: 'post_fanA', sprite: 'kidNpc', x: HUB.plaza.fans[0], y: HUB.plaza.fans[1], talk: 'post_fan_talk', name: 'Young Fan', wander: 2, showIf: 'post_game' },
    { id: 'post_fanB', sprite: 'townswoman', x: 16, y: 24, talk: 'post_fan_talk', name: 'Satan Fan Club President', wander: 1, showIf: 'post_game' },
  ],
  // Mr. Satan's alternate ending: the courtyard behind the red L50 gate 'ztv_gate'.
  triggers: [{ id: 'post_ztv', x: 7, y: 7, w: 3, h: 3, script: 'post_ztv_ending', showIf: 'post_game', hideIf: 'post_ztvSeen' }],
  onEnter: 'post_trophy_check',
});

// ---------------------------------------------------------------- Kame House
registerOverlay('kame_island', {
  // Krillin at Kame House, one stand-in per phase (the four conditions never overlap):
  //  - Chapter 12, before the Forest of Terror: the moping cop who starts "Krillin's comeback".
  //  - back from the forest (still Chapter 12, or later): shaved, in his old gi.
  //  - recruited for the Mighty Ten without having done the episode: training in his gi, episode re-voiced.
  //  - post-game.
  // He is on patrol in Satan City while being recruited (Chapter 13) and in the World of Void during the tournament.
  npcs: [
    { id: 'c12_krillinK', sprite: 'krillin', x: HUB.kame.krillin[0], y: HUB.kame.krillin[1], dir: 'left', talk: 'c12_krillin_kame', name: 'Krillin', showIf: 'chapter>=12&!quest:c13_krillin&!done:c13_krillin', hideIf: 'c12_herbGot' },
    { id: 'act5_krillinK1', sprite: 'krillinGi', x: HUB.kame.krillin[0], y: HUB.kame.krillin[1], dir: 'left', talk: 'c12_krillin_kame', name: 'Krillin', showIf: 'c12_herbGot&!quest:c13_krillin&!post_game', hideIf: 'c14_departed' },
    { id: 'act5_krillinK2', sprite: 'krillinGi', x: HUB.kame.krillin[0], y: HUB.kame.krillin[1], dir: 'left', talk: 'c12_krillin_kame', name: 'Krillin', showIf: 'done:c13_krillin&!c12_herbGot&!post_game', hideIf: 'c14_departed' },
    { id: 'post_krillinK', sprite: 'krillinGi', x: HUB.kame.krillin[0], y: HUB.kame.krillin[1], dir: 'left', talk: 'post_krillin_talk', name: 'Krillin', showIf: 'post_game' },
    { id: 'c13_chiaotzuK', sprite: 'chiaotzu', x: HUB.kame.chiaotzu[0], y: HUB.kame.chiaotzu[1], dir: 'right', talk: 'c13_chiaotzu_talk', name: 'Chiaotzu', showIf: 'quest:c13_tien' },
  ],
  // Coming home with the Paradise Herb: Master Roshi meets you on the beach and takes it.
  onEnter: ['c12_herb_home', 'post_trophy_check'],
});

// ---------------------------------------------------------------- The Lookout
registerOverlay('lookout', {
  npcs: [
    { id: 'c13_piccoloL', sprite: 'piccolo', x: HUB.lookout.piccolo[0], y: HUB.lookout.piccolo[1], dir: 'left', talk: 'c13_piccolo_talk', name: 'Piccolo', showIf: 'quest:c13_gohan&!char:piccolo' },
    // Playing as Piccolo, Gohan comes to him instead (never two Piccolos on the Lookout).
    { id: 'c13_gohanL', sprite: 'gohan', x: HUB.lookout.piccolo[0], y: HUB.lookout.piccolo[1], dir: 'left', talk: 'c13_gohanL_talk', name: 'Gohan', showIf: 'quest:c13_gohan&char:piccolo' },
    { id: 'c13_dendeL', sprite: 'dende', x: HUB.lookout.dende[0], y: HUB.lookout.dende[1], dir: 'down', talk: 'c13_dende_talk', name: 'Dende', showIf: 'chapter>=13' },
  ],
});

// ---------------------------------------------------------------- Capsule Corp
registerOverlay('cc_yard', {
  npcs: [
    // Beerus shares the garden table with Whis (Act 2's overlay NPC at 23,17). He is in the World of Void's stands
    // while the tournament runs.
    { id: 'act5_beerus', sprite: 'beerus', x: HUB.cc.beerus[0], y: HUB.cc.beerus[1], dir: 'left', talk: 'act5_beerus_talk', name: 'Beerus', showIf: 'chapter>=12', hideIf: 'c14_departed&!c14_won' },
    { id: 'act5_bulma', sprite: 'bulma', x: HUB.cc.bulma[0], y: HUB.cc.bulma[1], dir: 'down', talk: 'act5_bulma_talk', name: 'Bulma', showIf: 'chapter>=12' },
    // Vegeta stays at Bulma's side until the tournament (hidden while he is the active character).
    { id: 'act5_vegeta', sprite: 'vegetaCasual', x: HUB.cc.vegeta[0], y: HUB.cc.vegeta[1], dir: 'right', talk: 'act5_vegeta_talk', name: 'Vegeta', showIf: 'chapter>=12&!char:vegeta', hideIf: 'chapter>=14' },
  ],
  onEnter: 'post_trophy_check',
});

// ---------------------------------------------------------------- Trophy regions
registerOverlay('waste_mesa', { onEnter: 'post_trophy_check' });
registerOverlay('snow_peak', { onEnter: 'post_trophy_check' });

// ---------------------------------------------------------------- Zeno's palace: Jiren's rematch
registerOverlay('zeno_palace', {
  npcs: [
    { id: 'act5_zeno', sprite: 'zeno', x: HUB.zeno.zeno[0], y: HUB.zeno.zeno[1], dir: 'down', talk: 'act5_zeno_talk', name: 'Zeno', showIf: 'chapter>=12' },
    { id: 'act5_gp', sprite: 'grandPriest', x: 23, y: 6, dir: 'left', talk: 'c14_gp_talk', name: 'Grand Priest', showIf: 'chapter>=12' },
    { id: 'post_jirenN', sprite: 'jiren', x: HUB.zeno.hall[0], y: HUB.zeno.hall[1], dir: 'left', talk: 'post_jiren_talk', name: 'Jiren', showIf: 'post_game&quest:post_jiren', hideIf: 'defeated:post_jiren1' },
  ],
});

// ---------------------------------------------------------------- Tournament of Power: the three stage relays
// Every exit between the rings is closed while a relay fight runs (`act5_busy`), and the way east only opens once
// the ring you are in has been won. Stage A restarts whenever the west ring is entered before it is won (onEnter);
// stages B and C restart by crossing their trigger bands again, which span every walkable row of their column.
registerOverlay('top_arena_a', {
  onEnter: ['act5_map_enter', 'c14_topA_enter'],
  exits: { east: { to: 'top_arena_b', showIf: '!act5_busy', hideIf: 'chapter==14&c14_departed&!c14_stageA' } },
  // Post-game training trips: the Grand Priest waits by the arrival point to send you back to the palace.
  npcs: [{ id: 'act5_gpStage', sprite: 'grandPriest', x: 2, y: 16, dir: 'right', talk: 'act5_gp_stage_talk', name: 'Grand Priest', showIf: 'post_game' }],
});
registerOverlay('top_arena_b', {
  onEnter: 'act5_map_enter',
  exits: {
    west: { to: 'top_arena_a', showIf: '!act5_busy' },
    east: { to: 'top_arena_c', showIf: '!act5_busy', hideIf: 'chapter==14&c14_departed&!c14_stageB' },
  },
  objects: [{ type: 'save', x: 3, y: 15 }],
  triggers: [{ id: 'c14_stageB_t', x: 12, y: 8, w: 2, h: 18, script: 'c14_stageB', showIf: 'chapter==14&c14_stageA&!act5_busy', hideIf: 'c14_stageB' }],
});
registerOverlay('top_arena_c', {
  onEnter: 'act5_map_enter',
  exits: { west: { to: 'top_arena_b', showIf: '!act5_busy' } },
  objects: [{ type: 'save', x: 3, y: 17 }],
  triggers: [{ id: 'c14_stageC_t', x: 8, y: 3, w: 2, h: 23, script: 'c14_stageC', showIf: 'chapter==14&c14_stageB&!act5_busy', hideIf: 'c14_stageC' }],
});
