import { TILE } from '../../../engine/constants';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { force, unforce } from '../common';
import { EP, POD_OUT, WISH_BALLS } from './c12_eps_maps';
import { bossFight, BUSY, forceFade, freeNear, heroTile, npcWithSprite, rememberHero, removeAll, restoreHero, stage, warpTo } from './helpers';
import { HUB } from './hubs';

/**
 * Chapter 12 episode "Whose Wish?" (anime ep 68). King Kai is still dead, and Goku finally means to fix that: Bulma
 * lends the Dragon Radar on condition that Goku fetches a metal that only forms at the Earth's core, for a "hobby"
 * she keeps under a tarp on the old time machine pad. The player gathers the seven Dragon Balls across Earth and
 * dives in the drill pod to the core (two hostile maps with a heat hazard and a guardian). Then everyone shows up to
 * fight over the wish (a dialogue choice), Gohan's feverish Pan gets the wish instead, Beerus recognises the metal as
 * time machine material and erases it along with Bulma's workshop, and Shenron, out of patience, leaves before King
 * Kai's wish. King Kai stays dead (the running gag of the anime).
 */

/** Journal entry of the episode. */
const QUEST = 'c12_wish';
/** Frames of coolant left in the heat suit (kept in the save while Goku is in the core). */
const COOLANT = 'c12_coolant';
/** Raised while the guardian fight runs: the pod's whole coolant tank is diverted to the suit. */
const COOL_PAUSE = 'c12_coolPause';
/**
 * A full tank: a minute and a half of the core's heat, long enough to clear the mantle tunnels once at the level the
 * story gives (the fair bot's grind-zone check in tests/balance.test.ts), so the vents matter for a longer stay.
 */
export const COOLANT_MAX = 90 * 60;
/** HUD labels of the suit's countdown. */
const LABEL_OK = 'COOLANT';
const LABEL_HOT = 'OVERHEAT!';
/** Share of max HP the core burns away per second once the coolant is gone (never below 1 HP). */
const BURN_PER_SECOND = 0.02;
const DB_ITEMS = ['db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7'] as const;

/** Whose wish the player backed first in the argument (its candidate gives a consolation present at the end). */
type Backer = 'kingkai' | 'pilaf' | 'android18' | 'roshi' | 'kids';

/** Dragon Balls the party is carrying. */
function ballCount(s: ScriptApi): number {
  return DB_ITEMS.filter((d) => s.count(d) > 0).length;
}

/** The places Bulma's radar still shows a ball (pickups not taken yet). */
function ballsLeft(s: ScriptApi): string[] {
  return WISH_BALLS.filter(([id, item]) => !s.flag(`pickup:${id}`) && s.count(item) === 0).map((b) => b[6]);
}

/** The episode can start: Chapter 12 or the post-game (Chapters 13-14 keep everyone busy with the tournament). */
function episodeOpen(s: ScriptApi): boolean {
  return s.check('chapter==12') || s.flag('post_game');
}

/** Bulma's alloy is in her workshop, waiting for the summoning. */
function alloyIn(s: ScriptApi): boolean {
  return s.flag('c12_alloyDelivered');
}

/** Ready to summon: all seven balls in hand and the core alloy delivered. */
function readyToSummon(s: ScriptApi): boolean {
  return s.check(`quest:${QUEST}`) && ballCount(s) >= 7 && alloyIn(s) && !s.flag('c12_summoned');
}

/** Put the heat suit on Goku (forced) for the trip down. */
function suitUp(s: ScriptApi): void {
  s.transformNow(null);
  s.outfit('goku', 'c12_heatSuit');
}

/** Out of the core: suit off, coolant forgotten (Goku stays forced until `handBack`). */
function suitOff(s: ScriptApi): void {
  s.outfit('goku', null);
  s.clear(COOLANT);
  s.clear(COOL_PAUSE);
  s.field.timer = null;
}

/** Controls back to whoever was playing before the dive. */
function handBack(s: ScriptApi): void {
  unforce(s);
  restoreHero(s, 'core');
}

/**
 * The heat hazard of the Earth's core (started by every core map's onEnter, ends when the map is left). The suit
 * holds a minute and a half of coolant, shown as a HUD countdown; blue vents refill it. Once it runs dry the heat burns 2% of
 * max HP a second, never below 1 HP (the danger is meeting an enemy like that). Paused while a cutscene or dialogue
 * holds the controls and during the guardian fight.
 */
function startHeat(s: ScriptApi): void {
  const f = s.field;
  if (s.state.get(COOLANT) === undefined) s.set(COOLANT, COOLANT_MAX);
  let burn = 0;
  let warned = false;
  void f.until(() => {
    if (f.abandoned) return true;
    if (f.locked) return false;
    if (f.timer && f.timer.label !== LABEL_OK && f.timer.label !== LABEL_HOT) return false;
    let left = Math.max(0, Math.min(COOLANT_MAX, s.num(COOLANT)));
    if (!s.flag(COOL_PAUSE) && left > 0) left--;
    s.set(COOLANT, left);
    f.timer = { frames: left, label: left > 0 ? LABEL_OK : LABEL_HOT };
    if (left > 0 || s.flag(COOL_PAUSE)) { burn = 0; warned = false; return false; }
    if (!warned) {
      warned = true;
      f.toast(['The suit is overheating! Find a blue coolant vent!'], '#f86040');
    }
    if (++burn % 60 !== 0) return false;
    const cs = f.player.cs;
    const loss = Math.min(cs.hp - 1, Math.max(1, Math.round(cs.hpMax * BURN_PER_SECOND)));
    if (loss > 0) {
      cs.hp -= loss;
      f.fx.number(f.player.x, f.player.y - 34, loss, '#f88020');
      s.sfx('hurt');
    }
    return false;
  }, true);
}

/**
 * A cutscene actor of `sprite` at (x, y): the NPC already standing on the map (another act's overlay, e.g. Bulma at
 * the garden table) is moved there and reused, so nobody appears twice; otherwise one is staged under `id`.
 * Returns the actor id to script.
 */
function reuseOrStage(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: 'up' | 'down' | 'left' | 'right', name: string): string {
  const existing = npcWithSprite(s, sprite);
  if (existing) {
    const [fx, fy] = freeNear(s, x, y);
    s.place(existing, fx, fy, dir);
    return existing;
  }
  stage(s, id, sprite, x, y, dir, name);
  return id;
}

/** Put a reused overlay NPC back where its map has it (a staged stand-in is removed instead). */
function sendBack(s: ScriptApi, actor: string, staged: string, home: [number, number]): void {
  if (actor === staged) removeAll(s, actor);
  else if (s.exists(actor)) s.place(actor, home[0], home[1], 'down');
}

registerScripts({
  // ================================================================ the pad: the episode starts, Bulma checks in
  /** A at Bulma's covered project on the Capsule Corp pad. */
  c12_project_look: async (s) => {
    if (s.flag('c12_labGone')) return;
    if (s.check(`quest:${QUEST}`)) { await s.call('c12_wish_status'); return; }
    if (s.check(`done:${QUEST}`) || !episodeOpen(s)) {
      await s.narrate('Something lumpy hides under a tarp on the old time machine pad. The sign says KEEP OUT in Bulma\'s handwriting. Twice.');
      return;
    }
    await s.call('c12_wish_start');
  },

  /** Goku asks Bulma for the Dragon Balls; Bulma names her price. */
  c12_wish_start: async (s) => {
    if (s.check(`quest:${QUEST}`) || s.check(`done:${QUEST}`)) return;
    rememberHero(s, 'wish');
    await forceFade(s, 'goku');
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    await s.talk([
      ['goku', 'Hey, what\'s under the sheet? It looks like the old time machine...', 'neutral'],
      ['kingKai', 'GOKU! I can see you from here! You\'re at Capsule Corp! Bulma has the Dragon Radar! Ask her! NOW!', 'angry'],
      ['goku', 'Okay, okay! Jeez, King Kai, you\'re even louder dead.', 'sad'],
      ['kingKai', 'I have been dead since the Cell Games, Goku. Bubbles has started a calendar. A CALENDAR!', 'angry'],
    ]);
    const bulma = reuseOrStage(s, 'c12_bulmaPad', 'bulma', hx - 4, hy + 1, 'right', 'Bulma');
    await s.walk(bulma, hx - 1, hy, 1.6);
    s.face(bulma, 'hero');
    s.face('hero', bulma);
    await s.talk([
      ['bulma', 'HEY! Hands off the tarp, Goku! That\'s a... private project.', 'angry'],
      ['goku', 'Sorry! I just need the Dragon Radar. King Kai\'s still dead and he\'s really mad about it.', 'sad'],
      ['bulma', 'The Dragon Balls, huh? ...Okay. You can use them. On one condition.', 'smirk'],
      ['bulma', 'There\'s a metal that only forms at the Earth\'s core. Bring me a chunk. My drill pod can take you down, and I\'ve got a heat suit in your size.', 'happy'],
      ['goku', 'The middle of the planet? Neat! What\'s the metal for?', 'neutral'],
      ['bulma', 'A hobby. Don\'t ask. And whatever you do, don\'t mention it to Beerus. Or Whis. Or anyone with ears.', 'smirk'],
    ]);
    if (!s.has('dragonRadar')) await s.give('dragonRadar');
    await s.quest(QUEST);
    s.set(POD_OUT);
    s.field.map.removeProp('c12_pod');
    s.field.map.addProp('c12_drillPod', EP.pad.pod[0] * TILE, EP.pad.pod[1] * TILE, 'c12_pod');
    // The pod rolls out beside the tarp: step aside if it lands where the hero stands.
    const [px, py] = heroTile(s);
    const [fx, fy] = freeNear(s, px, py);
    if (fx !== px || fy !== py) s.place('hero', fx, fy, 'up');
    s.sfx('door');
    await s.narrate('Bulma wheels her drill pod out onto the pad.');
    await s.narrate('Open the regional map (R) with the Dragon Radar to see a Dragon Ball nearby. When you are ready for the Earth\'s core, press A at the drill pod.');
    sendBack(s, bulma, 'c12_bulmaPad', HUB.cc.bulma);
    s.letterbox(false);
    unforce(s);
    restoreHero(s, 'wish');
  },

  /** Bulma's progress report at the pad (the radar's remaining blips, the alloy), or the summoning when ready. */
  c12_wish_status: async (s) => {
    if (!s.check(`quest:${QUEST}`)) return;
    if (readyToSummon(s)) { await s.call('c12_wish_summon'); return; }
    if (s.has('c12_coreAlloy')) {
      await s.call('c12_alloy_handin');
      if (readyToSummon(s)) await s.call('c12_wish_summon');
      return;
    }
    const left = ballsLeft(s);
    const n = ballCount(s);
    if (n >= 7) {
      await s.say('bulma', 'All seven Dragon Balls! Now my metal from the Earth\'s core, please. The drill pod is right there.', 'neutral');
      return;
    }
    await s.say('bulma', `${n} of 7 Dragon Balls so far. ${left.length ? `The radar still shows one at ${left[0]}${left.length > 1 ? `, and ${left.length - 1} more elsewhere` : ''}.` : ''}`, 'neutral');
    if (!alloyIn(s)) await s.say('bulma', 'And don\'t forget my metal from the core. No metal, no wish.', 'smirk');
  },

  /** Capsule Corp onEnter: back with everything (the summoning starts), and the workshop rebuilt in a new chapter. */
  c12_wish_yard: async (s) => {
    if (s.flag('c12_labGone') && !s.flag('c12_labRebuilt') && s.state.data.chapter !== s.num('c12_labGoneCh')) {
      // The story has moved on since Beerus's visit: the crater has been filled in by the time Goku gets here.
      s.set('c12_labRebuilt');
      s.field.map.removeProp('c12_crater');
    }
    if (!readyToSummon(s) || s.flag(BUSY)) return;
    await s.say('bulma', 'You found all seven? And my metal is safe in the workshop. Then let\'s call Shenron right here on the lawn!', 'happy');
    await s.call('c12_wish_summon');
  },

  // ================================================================ the drill pod and the Earth's core
  /**
   * A at the drill pod on the pad: down to the core. The pod stays on the pad once Bulma has wheeled it out (Beerus
   * only erased the workshop), so the core can be revisited like any LoG2 dungeon: for the mantle's cache and
   * breakable rocks, or as a place to level, after the alloy and after the episode.
   */
  c12_pod_down: async (s) => {
    if (!s.flag(POD_OUT) && !s.check(`quest:${QUEST}`)) return;
    if (s.has('c12_coreAlloy')) { await s.call('c12_alloy_handin'); return; }
    const c = await s.ask('narrator', s.flag('c12_alloyCut')
      ? 'Bulma\'s drill pod, rinsed and refuelled. The heat suit hangs by the hatch. Dive to the Earth\'s core again?'
      : 'Bulma\'s drill pod. The seat is still warm from the last test run. Dive to the Earth\'s core?', ['Dive!', 'Not yet']);
    if (c !== 0) return;
    rememberHero(s, 'core');
    // Whoever is playing, Goku is the one who fits the suit (switched in the dark).
    if (s.hero !== 'goku') await s.fadeOut(12);
    force(s, 'goku');
    suitUp(s);
    s.set(COOLANT, COOLANT_MAX);
    s.clear(COOL_PAUSE);
    s.sfx('door');
    await s.narrate('The pod drills straight down: crust, then mantle, the gauges climbing all the way...');
    await warpTo(s, 'c12_core_mantle', EP.mantle.arrive[0], EP.mantle.arrive[1], 'down');
  },

  /** A at the pod in the mantle tunnels: back up to Capsule Corp (the episode stays open). */
  c12_pod_up: async (s) => {
    if (s.flag(BUSY)) return;
    const c = await s.ask('narrator', 'Ride the drill pod back up to Capsule Corp?', ['Go up', 'Stay']);
    if (c !== 0) return;
    await s.narrate('The pod winches its way back up through the crust.');
    suitOff(s);
    handBack(s);
    await warpTo(s, 'cc_yard', EP.pad.podFront[0], EP.pad.podFront[1], 'down');
  },

  /** Every core map: suit check, the radio briefing on the first visit, and the heat hazard. */
  c12_core_enter: async (s) => {
    s.clear(COOL_PAUSE);
    if (s.hero === 'goku' && s.state.char('goku').outfit !== 'c12_heatSuit' && !s.field.player.formActive) s.outfit('goku', 'c12_heatSuit');
    startHeat(s);
    if (s.flag('c12_coreIntro') || s.field.def.id !== 'c12_core_mantle') return;
    s.set('c12_coreIntro');
    await s.talk([
      ['goku', 'Whoa! It\'s hot even through the suit. And everything down here glows!', 'shock'],
      ['bulma', '(Radio) Goku, can you hear me? The suit\'s coolant lasts about a minute and a half. The blue vents are my coolant line. Stand on one to refill.', 'neutral'],
      ['bulma', '(Radio) The metal grows in the heart of the planet, further down. Oh, and the readings say something big lives there. Be nice to it.', 'smirk'],
      ['goku', 'Something big? Heh... now THAT\'S a hobby!', 'happy'],
    ]);
  },

  /** A blue vent: refill the suit. */
  c12_core_vent: async (s) => {
    const was = s.num(COOLANT);
    s.set(COOLANT, COOLANT_MAX);
    if (was < COOLANT_MAX - 60) {
      s.sfx('heal');
      s.field.fx.number(s.field.player.x, s.field.player.y - 34, 'COOL', '#80d8f8');
    }
  },

  /** The guardian rises between Goku and the crystal island. */
  c12_wyrm_fight: async (s) => {
    if (s.flag('c12_wyrmDown') || s.flag(BUSY)) return;
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    await s.pan(EP.heart.island[0], EP.heart.island[1] - 3, 40);
    await s.say('goku', 'There it is! The crystal on that island is glowing just like Bulma said.', 'happy');
    s.shake(50, 3);
    s.sfx('explode');
    s.boom(EP.heart.wyrm[0], EP.heart.wyrm[1] + 2, 26, '#f88020');
    const [wx, wy] = freeNear(s, Math.max(hx - 2, Math.min(hx + 2, EP.heart.wyrm[0])), Math.min(hy + 3, EP.heart.wyrm[1] + 2));
    stage(s, 'c12_wyrmA', 'c12_mantleWyrm', wx, wy, 'up', 'Mantle Wyrm');
    s.follow();
    await s.emote('hero', '!');
    await s.talk([
      ['goku', 'Whoa! A giant lava snake! So THAT\'S the big thing living down here.', 'shock'],
      ['bulma', '(Radio) It\'s been guarding that crystal since before there were dinosaurs! Goku, just take a little piece and run!', 'shock'],
      ['goku', 'Sorry, big guy! I only need a little bit. But if you want to fight first... I\'m game!', 'smirk'],
      ['bulma', '(Radio) I\'m pumping all the pod\'s coolant into your suit. Make it count!', 'neutral'],
    ]);
    s.remove('c12_wyrmA');
    s.letterbox(false);
    s.set(COOL_PAUSE);
    s.music('boss');
    const r = await bossFight(s, 'c12_mantleWyrm', { x: wx, y: wy, uid: 'c12_wyrm1' });
    s.clear(COOL_PAUSE);
    s.set(COOLANT, COOLANT_MAX);
    removeAll(s, 'c12_wyrm1');
    s.music(s.field.def.music);
    if (r !== 'win' && r !== 'end') return;
    s.set('c12_wyrmDown');
    s.letterbox(true);
    s.boom(wx, wy, 22, '#f8c040');
    await s.narrate('The Mantle Wyrm sinks back into the molten rock, sulking. The bridge to the crystal is clear.');
    await s.talk([
      ['goku', 'Phew! It\'s really strong, for a snake. I\'ll only take a small piece. Promise!', 'happy'],
      ['bulma', '(Radio) Your coolant\'s topped up. Cut me a chunk from the crystal, and the pod will winch you straight back up.', 'happy'],
    ]);
    s.letterbox(false);
  },

  c12_wyrm_p2: async (s) => {
    await s.say('bulma', '(Radio) Goku, it\'s calling up lava from the river! Watch the slimes!', 'shock');
  },
  c12_wyrm_p3: async (s) => {
    await s.say('goku', 'It\'s getting hotter... I bet it\'s almost tired out!', 'smirk');
  },

  /** A at the crystal: cut out the core alloy and ride the pod home. */
  c12_cut_alloy: async (s) => {
    if (!s.flag('c12_wyrmDown') || s.flag('c12_alloyCut')) return;
    s.letterbox(true);
    s.pose('hero', 'punch2');
    s.sfx('hit');
    s.flash('#d8a8f8', 10);
    await s.wait(10);
    s.pose('hero', null);
    s.set('c12_alloyCut');
    s.field.map.removeProp('c12_crystal');
    s.field.map.addProp('c12_coreStump', EP.heart.crystal[0] * TILE, (EP.heart.crystal[1] + 2.4) * TILE, 'c12_stump');
    await s.give('c12_coreAlloy');
    await s.talk([
      ['goku', 'Got it! It\'s warm... and it hums. Weird.', 'happy'],
      ['bulma', '(Radio) Perfect! Hold on tight, I\'m reeling the pod in!', 'happy'],
    ]);
    await s.fadeOut(20);
    s.letterbox(false);
    suitOff(s);
    await warpTo(s, 'cc_yard', EP.pad.podFront[0], EP.pad.podFront[1], 'down');
    // Goku hands the alloy over himself. With all seven Dragon Balls already in hand the summoning follows at once,
    // still as Goku, and gives the controls back to the hero from before the dive when it is over (`rememberHero`
    // keys, helpers.ts); it may end the chapter, so nothing runs after it. Otherwise that hero takes over now.
    await s.call('c12_alloy_handin');
    if (readyToSummon(s)) {
      const prev = s.state.get('act5_prev_core');
      s.clear('act5_prev_core');
      if (typeof prev === 'string') s.set('act5_prev_wish', prev);
      await s.call('c12_wish_summon');
      return;
    }
    handBack(s);
  },

  /** Bulma takes the core alloy into her workshop under the tarp. */
  c12_alloy_handin: async (s) => {
    if (!s.has('c12_coreAlloy') || alloyIn(s)) return;
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    const bulma = reuseOrStage(s, 'c12_bulmaPad', 'bulma', hx - 2, hy, 'right', 'Bulma');
    s.face(bulma, 'hero');
    await s.talk([
      ['bulma', 'You\'re back! And you brought it! Oh, look at that shine... it\'s even better than the samples from the old machine.', 'happy'],
      ['hero', s.hero === 'goku' ? 'The old machine? So it IS a time mach-' : 'The old machine? Bulma, is that a time mach-', 'neutral'],
      ['bulma', 'A HOBBY. Into the workshop it goes. Thank you!', 'smirk'],
    ]);
    s.take('c12_coreAlloy');
    s.set('c12_alloyDelivered');
    const n = ballCount(s);
    if (n < 7) {
      await s.say('bulma', `A deal's a deal: the Dragon Balls are yours. You have ${n} of 7. The radar shows the rest on the R map.`, 'happy');
    }
    sendBack(s, bulma, 'c12_bulmaPad', HUB.cc.bulma);
    s.letterbox(false);
  },

  // ================================================================ the summoning: whose wish?
  c12_wish_summon: async (s) => {
    if (!readyToSummon(s)) return;
    s.set('c12_summoned');
    rememberHero(s, 'wish');
    const [lx, ly] = EP.pad.lawn;
    // Always summoned from Capsule Corp (the pad, the yard's entry or the alloy hand-in); the warp is a safety net.
    if (s.field.def.id !== 'cc_yard') await warpTo(s, 'cc_yard', lx + 1, ly + 2, 'up');
    s.letterbox(true);
    await s.fadeOut(16);
    force(s, 'goku');
    s.outfit('goku', null);
    s.transformNow(null);
    const [hx, hy] = freeNear(s, lx + 1, ly + 3);
    s.place('hero', hx, hy, 'up');
    // Champa and Vados, waiting at the garden table with their baseball challenge (c12_baseball.ts), are not at this
    // party: in the anime they only come to Earth two episodes later. They are back at the table on the next visit.
    removeAll(s, 'c12_champaY', 'c12_vadosY', 'c12_champaP', 'c12_vadosP');
    // The crowd: the overlay NPCs already on the lawn are reused, the rest arrive for the occasion.
    reuseOrStage(s, 'c12_bulmaW', 'bulma', lx - 4, ly + 1, 'right', 'Bulma');
    const beerus = reuseOrStage(s, 'c12_beerusW', 'beerus', lx + 5, ly - 1, 'left', 'Beerus');
    const whis = reuseOrStage(s, 'c12_whisW', 'whis', lx + 6, ly - 1, 'left', 'Whis');
    const vegeta = npcWithSprite(s, 'vegetaCasual');
    if (vegeta) s.place(vegeta, lx - 5, ly - 1, 'right');
    stage(s, 'c12_pilafW', 'pilaf', lx - 5, ly + 3, 'right', 'Pilaf');
    stage(s, 'c12_maiW', 'mai', lx - 6, ly + 2, 'right', 'Mai');
    stage(s, 'c12_shuW', 'shu', lx - 6, ly + 4, 'right', 'Shu');
    stage(s, 'c12_18W', 'android18', lx + 7, ly + 2, 'left', 'Android 18');
    stage(s, 'c12_roshiW', 'roshi', lx + 7, ly + 1, 'left', 'Master Roshi');
    stage(s, 'c12_oolongW', 'c02_oolong', lx + 8, ly + 1, 'left', 'Oolong');
    stage(s, 'c12_gotenW', 'goten', lx + 4, ly + 4, 'up', 'Goten');
    stage(s, 'c12_trunksW', 'trunksKid', lx + 5, ly + 4, 'up', 'Trunks');
    for (const d of DB_ITEMS) while (s.count(d) > 0) s.take(d);
    s.field.map.removeProp('c12_ring');
    s.field.map.addProp('c03_dbRing', (lx - 0.25) * TILE, (ly - 0.75) * TILE, 'c12_ring');
    await s.pan(lx, ly - 1, 1);
    await s.fadeIn(20);
    await s.talk([
      ['bulma', 'All seven! Go on, Goku. Say the words.', 'happy'],
      ['goku', 'Eternal Dragon! Come on out, Shenron!', 'shout'],
    ]);
    s.stopMusic();
    s.tint('rgba(10,10,40,0.55)');
    s.shake(60, 2);
    s.sfx('powerUp');
    await s.seconds(1);
    s.flash('#f8f0a0', 20);
    s.field.map.removeProp('c12_shenron');
    s.field.map.addProp('c03_shenron', (lx - 4.5) * TILE, (ly - 8.4) * TILE, 'c12_shenron');
    s.music('godly');
    s.face(whis, 'up');
    s.face(beerus, 'up');
    await s.pan(lx - 1, ly - 4, 50);
    await s.talk([
      ['shenronAvatar', 'I AM THE ETERNAL DRAGON. STATE YOUR WISH.', 'neutral'],
      ['pilaf', 'MY WISH! Mine! I was here first!', 'shout'],
      ['android18', 'You were here second. I was here first, and I have a list.', 'smirk'],
      ['roshi', 'Now, now, children. Let an old man go first. It\'s only polite.', 'happy'],
      ['goten', 'Trunks! Quick, think of something!', 'shock'],
      ['bulma', 'EVERYBODY QUIET! Goku called him, so Goku decides who\'s first. Goku?', 'angry'],
    ]);
    // The argument (LoG2-style dialogue choice): two rounds of pitches, each shot down by someone else.
    const heard = new Set<Backer>();
    const order: Backer[] = ['kingkai', 'pilaf', 'android18', 'roshi', 'kids'];
    const label: Record<Backer, string> = { kingkai: 'Revive King Kai', pilaf: 'Pilaf\'s wish', android18: '18\'s wish', roshi: 'Roshi and Oolong', kids: 'Goten and Trunks' };
    for (let round = 0; round < 2; round++) {
      const left = order.filter((b) => !heard.has(b));
      const pick = left[await s.ask('goku', round === 0 ? 'Uh... okay! Whose wish goes first?' : 'Okay, okay! Then how about...', left.map((b) => label[b]))] ?? left[0];
      heard.add(pick);
      if (round === 0) s.set('c12_wishBacked', pick);
      await s.call(`c12_wish_pitch_${pick}`);
    }
    // Gohan bursts in: Pan's fever.
    s.follow();
    await s.pan(lx - 3, ly + 1, 30);
    stage(s, 'c12_gohanW', 'gohan', lx - 12, ly + 2, 'right', 'Gohan');
    stage(s, 'c12_videlW', 'videl', lx - 13, ly + 3, 'right', 'Videl');
    stage(s, 'c12_panW', 'pan', lx - 12, ly + 3, 'right', 'Pan');
    await s.talk([['gohan', 'WAIT! Everyone, please! Dad!', 'shout']]);
    await Promise.all([s.walk('c12_gohanW', lx - 2, ly + 2, 2.2), s.walk('c12_panW', lx - 2, ly + 3, 2.2), s.walk('c12_videlW', lx - 3, ly + 3, 2)]);
    s.pose('c12_panW', 'hurt');
    await s.talk([
      ['gohan', 'It\'s Pan. She\'s had a high fever for two days and it won\'t come down. The doctors tried everything...', 'sad'],
      ['videl', 'They say medicine doesn\'t work on her properly. It\'s her Saiyan blood.', 'sad'],
      ['pan', '...Hhh... hhh...', 'hurt'],
    ]);
    await s.emote('c12_18W', '...');
    await s.talk([
      ['android18', '...Fine. My wish can wait.', 'neutral'],
      ['pilaf', 'W-well, I suppose world conquest can wait one more day. ONE.', 'sad'],
      ['goku', 'Go on, Gohan. This one\'s yours.', 'neutral'],
      ['gohan', 'Shenron! Please, make my daughter Pan\'s fever go away!', 'shout'],
      ['shenronAvatar', 'THAT IS AN EASY WISH. IT SHALL BE GRANTED.', 'neutral'],
    ]);
    s.flash('#f8f0a0', 16);
    s.sfx('heal');
    await s.powerUp('c12_panW', '#f8f0a0', 40);
    s.pose('c12_panW', null);
    await s.talk([['pan', 'Ba-bwee! Kyahaha!', 'happy']]);
    await s.lift('c12_panW', 14, 14);
    await s.flyTo('c12_panW', lx, ly - 2, 2.5);
    await s.talk([
      ['videl', 'Pan! She\'s flying again. She\'s FINE! Oh, thank you, Shenron!', 'happy'],
      ['gohan', 'Thank you, Dad. Thank you, everyone.', 'happy'],
      ['goku', 'Heh heh. Okay! Now for the next wish. Shenron, bring back King K-', 'happy'],
    ]);
    // Beerus finds the "hobby".
    s.face(beerus, 'up');
    await s.emote(beerus, '?');
    await s.talk([
      ['beerus', 'Hold on. What is that smell? Hot metal... Whis. What is under the sheet on that pad?', 'neutral'],
      ['whis', 'Ohoho. A time machine, my lord, very nearly finished. And its frame is grown from that lovely metal at the planet\'s heart.', 'happy'],
      ['bulma', 'Whis! It\'s a HOBBY! I only wanted to drop in on Trunks and Mai and see how they\'re doing!', 'shock'],
      ['beerus', 'After Zamasu? After the Time Rings? Time travel is a crime against the gods, Bulma. You know that.', 'angry'],
    ]);
    await s.pan(EP.pad.project[0] + 1.5, EP.pad.project[1] + 2, 40);
    s.pose(beerus, 'raise');
    s.sfx('charge');
    await s.wait(30);
    s.flash('#c070f0', 18);
    s.sfx('explode');
    s.shake(30, 3);
    s.boom(EP.pad.project[0] + 1.5, EP.pad.project[1] + 1.5, 30, '#c070f0');
    s.field.map.removeProp('c12_project');
    s.field.map.addProp('c12_labCrater', (EP.pad.project[0] - 1) * TILE, (EP.pad.project[1] - 0.4) * TILE, 'c12_crater');
    s.set('c12_labGone');
    s.set('c12_labGoneCh', s.state.data.chapter);
    await s.wait(30);
    s.pose(beerus, null);
    await s.pan(lx - 1, ly - 2, 40);
    await s.talk([
      ['bulma', 'MY WORKSHOP!! My metal! Three weeks of work!', 'shock'],
      ['beerus', 'Be glad it was only the workshop.', 'smirk'],
      ...(vegeta ? [['vegetaCasual', '...I told her not to. Twice.', 'neutral'] as [string, string, 'neutral']] : []),
      ['goku', 'Uh... anyway! Shenron! The second wish! King Ka-', 'happy'],
    ]);
    await s.emote('hero', '?');
    await s.talk([
      ['shenronAvatar', 'ENOUGH! FIRST YOU QUARREL, THEN YOU BLOW THINGS UP. I HAVE WAITED LONG ENOUGH.', 'angry'],
      ['shenronAvatar', 'I HAVE GRANTED A WISH. THAT IS PLENTY FOR ONE DAY. FAREWELL!', 'neutral'],
    ]);
    s.flash('#ffffff', 20);
    s.field.map.removeProp('c12_shenron');
    s.field.map.removeProp('c12_ring');
    s.tint(null);
    await s.narrate('The seven Dragon Balls rose into the sky and scattered across the world once more.');
    await s.talk([
      ['goku', 'Hey, wait! Shenron! We still had a wish left! ...Aw, nuts.', 'shock'],
      ['whis', 'Ohoho. He did seem rather keen to leave.', 'happy'],
    ]);
    // Meanwhile, on King Kai's planet.
    await s.fadeOut(20);
    await warpTo(s, 'kingkai_planet', 16, 17, 'up');
    s.letterbox(true);
    s.music('otherworld');
    stage(s, 'c12_kingKaiW', 'kingKai', 16, 13, 'down', 'King Kai');
    stage(s, 'c12_bubblesW', 'c01_bubbles', 14, 14, 'right', 'Bubbles');
    stage(s, 'c12_gregoryW', 'c01_gregory', 18, 14, 'left', 'Gregory');
    s.show('hero', false);
    await s.pan(16, 14, 1);
    await s.fadeIn(20);
    await s.narrate('Meanwhile, on King Kai\'s planet...');
    const backed = s.state.get('c12_wishBacked');
    await s.talk([
      ['kingKai', 'Any second now, Bubbles! Goku promised! Gregory, get the streamers ready!', 'happy'],
      ['kingKai', '...Any second now.', 'neutral'],
      ['kingKai', backed === 'kingkai'
        ? '...He picked me FIRST, I heard it! And he still forgot! GOKUUUUU!!'
        : '...He forgot. He forgot AGAIN. GOKUUUUU!!', 'angry'],
    ]);
    await s.emote('c12_bubblesW', '...');
    await s.fadeOut(20);
    s.show('hero', true);
    await warpTo(s, 'cc_yard', lx, ly + 2, 'up');
    s.letterbox(true);
    s.music('westCity');
    stage(s, 'c12_gohanW2', 'gohan', lx - 1, ly, 'down', 'Gohan');
    await s.fadeIn(16);
    await s.talk([
      ['gohan', 'Dad, thank you for giving the wish to Pan. Here. It\'s not much, but Videl and I want you to have it.', 'happy'],
      ['goku', 'Aw, you don\'t have to... ooh, a capsule! Thanks, Gohan!', 'happy'],
    ]);
    await s.give('pow3');
    removeAll(s, 'c12_gohanW2');
    await s.call('c12_wish_thanks');
    // Where the anime goes next (ep 69, the inventors' fair), in one line; the crossover itself is not adapted.
    if (s.check('chapter==12')) await s.say('bulma', 'Oh, and Goku? Chi-Chi called. You\'re working security at the West City inventors\' fair tomorrow. Her idea, not mine!', 'smirk');
    s.letterbox(false);
    await s.done(QUEST, false);
    s.set('c12_wishDone');
    unforce(s);
    restoreHero(s, 'wish');
    if (s.hasScript('c12_progress')) await s.call('c12_progress');
  },

  // ---------------------------------------------------------------- the pitches (the dialogue choice)
  c12_wish_pitch_kingkai: async (s) => {
    await s.talk([
      ['goku', 'King Kai! He\'s been dead since the Cell Games, and that was kind of my fault. Let\'s bring him back!', 'happy'],
      ['beerus', 'Who?', 'neutral'],
      ['whis', 'The North Kai, my lord. The one who tells jokes.', 'happy'],
      ['beerus', 'Then he can stay dead.', 'smirk'],
      ['bulma', 'He\'s waited this long, Goku. He can wait five more minutes. Next!', 'neutral'],
    ]);
  },
  c12_wish_pitch_pilaf: async (s) => {
    await s.talk([
      ['pilaf', 'Shenron! Make me ruler of the WORLD! Every nation! Every ocean! Every pudding shop!', 'shout'],
      ['mai', 'Lord Pilaf, the last time we made a wish, we turned into children.', 'neutral'],
      ['shu', 'And he cried for a whole week.', 'sad'],
      ['pilaf', 'SILENCE!', 'angry'],
      ['bulma', 'World domination? On MY lawn? Absolutely not. Next!', 'angry'],
    ]);
  },
  c12_wish_pitch_android18: async (s) => {
    await s.talk([
      ['android18', 'Something nice for Krillin. He works too hard and never asks for anything.', 'neutral'],
      ['goku', 'Aw, that\'s really sweet, 18!', 'happy'],
      ['roshi', 'Krillin needs TRAINING, not presents! A wish would only make him soft.', 'angry'],
      ['android18', 'Say that again, old man.', 'angry'],
      ['roshi', '...Lovely wish. Next!', 'shock'],
    ]);
  },
  c12_wish_pitch_roshi: async (s) => {
    await s.talk([
      ['roshi', 'Ahem. A wish for the advancement of the martial arts. And perhaps... a little something for an old man\'s eyes. Heh heh.', 'happy'],
      ['c02_oolong', 'And I\'ll have what I wished for the very first time! A nice fresh pair of-', 'happy'],
      ['android18', 'No.', 'angry'],
      ['bulma', 'NO. Both of you.', 'angry'],
      ['roshi', 'Forget we said anything.', 'sad'],
    ]);
  },
  c12_wish_pitch_kids: async (s) => {
    await s.talk([
      ['goten', 'Uh... um... we didn\'t think of one.', 'shock'],
      ['trunksKid', 'Infinite pudding! A mountain of it!', 'happy'],
      ['beerus', '...Pudding? I find myself supporting this wish.', 'happy'],
      ['whis', 'My lord.', 'smirk'],
      ['bulma', 'NO pudding wishes! Next!', 'angry'],
    ]);
  },

  /** The candidate the player backed first gives a consolation present (King Kai can only shout). */
  c12_wish_thanks: async (s) => {
    const backed = s.state.get('c12_wishBacked') as Backer | undefined;
    const [lx, ly] = EP.pad.lawn;
    switch (backed) {
      case 'pilaf':
        stage(s, 'c12_pilafT', 'pilaf', lx + 1, ly, 'down', 'Pilaf');
        await s.say('pilaf', 'You chose MY wish first. Very well. A future emperor rewards loyalty. Here, my emergency snacks. Don\'t tell Mai.', 'smirk');
        await s.give('cookie', 3);
        removeAll(s, 'c12_pilafT');
        break;
      case 'android18':
        stage(s, 'c12_18T', 'android18', lx + 1, ly, 'down', 'Android 18');
        await s.say('android18', 'You picked my wish first. Krillin owes you one now. Take this, he never uses them.', 'neutral');
        await s.give('end1');
        removeAll(s, 'c12_18T');
        break;
      case 'roshi':
        stage(s, 'c12_roshiT', 'roshi', lx + 1, ly, 'down', 'Master Roshi');
        await s.say('roshi', 'You stood up for your old master! Here, from my private training stock. For your muscles. Not for anything else.', 'happy');
        await s.give('str1');
        removeAll(s, 'c12_roshiT');
        break;
      case 'kids':
        stage(s, 'c12_gotenT', 'goten', lx + 1, ly, 'down', 'Goten');
        await s.say('goten', 'Dad, you backed us! Trunks says we have to share our candy stash. ...Only five, though.', 'happy');
        await s.give('cookie', 5);
        removeAll(s, 'c12_gotenT');
        break;
      default:
        await s.say('goku', 'Hm? Why do I feel like somebody far away is yelling at me?', 'neutral');
        break;
    }
  },

  // ---------------------------------------------------------------- King Kai's planet afterwards
  c12_kingkai_talk: async (s) => {
    const lines = s.flag('post_game')
      ? ['Universe 7 survived the Tournament of Power, everyone says. Wonderful! I watched from the Other World. Where I still live.',
        'Bubbles and I are planning a party for the day somebody remembers us. It\'s been planned for years. The cake is a rock now.']
      : ['Shenron flew off with a wish left over. He got tired of waiting while they all bickered. I KNOW the feeling, but STILL!',
        'Do you know what the halo does to my antennae? It tangles them. Every. Single. Morning.'];
    await s.say('kingKai', lines[s.inc('c12_kingKaiTalks') % lines.length], 'angry');
  },
  c12_bubbles_talk: async (s) => {
    await s.say('c12_bubblesK', 'Ook! Ook ook!', 'happy');
    await s.narrate('Bubbles points at a calendar nailed to King Kai\'s house. Every day is crossed out.');
  },
});
