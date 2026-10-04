import { registerScripts, type ScriptApi } from '../../../game/script';
import { TILE } from '../../../engine/constants';
import type { PropInst } from '../../../game/world';
import { ensureChapterState } from '../common';
import { C00_RUBBLE, TUNNEL } from './c00_maps';
import { HUB } from './hubs';
import { actor, arenaFight, endScene, flyHop, nearHero, once, removeAll, scene, SEALED } from './util';

/**
 * PROLOGUE - "A Future Without Hope" (Future Trunks, L6). LoG2 parallel: the Future Trunks tutorial prologue.
 * newGame -> c00_start: title card, opening crawl over ruined West City, Trunks wakes in the Resistance hideout
 * (talk tutorial). Bulma's briefing adds the gold quest c00_fuel (journal + save tutorials; Mai keeps him inside until
 * then). The service tunnel: melee a rubble choke, ki-blast the rubble burying a flight circle across a flooded road,
 * fly across, L / Burning Attack, first hostile zone. Depot No. 4: the fuel locker -> Goku Black's ambush (survive,
 * rage Super Saiyan = transformation tutorial, scripted end) -> back at the hideout: Bulma falls off-screen, Mai shoves
 * Trunks into the time machine and draws Black away, the HOPE!! departs -> trunks.joined = false -> c01_start.
 */

const BLACK_KI = '#c04080';
const TIME_BLUE = '#a0e0ff';

/** The time machine standing in Future Bulma's lab (a prop on the world builder's hideout map). */
function timeMachine(s: ScriptApi): PropInst | undefined {
  return s.field.map.props.find((p) => p.kind === 'timeMachine');
}

/** The engine spins up: blue shimmer around the machine while it rises `rise` pixels over `frames`. */
async function hum(s: ScriptApi, m: PropInst | undefined, frames: number, rise: number): Promise<void> {
  if (!m) { await s.wait(frames); return; }
  const y0 = m.y;
  for (let i = 1; i <= frames; i++) {
    await s.wait(1);
    m.y = y0 - (rise * i) / frames;
    if (i % 2 === 0) s.field.fx.aura(m.x + 20, m.y + 30, TIME_BLUE, 1);
    if (i % 10 === 0) s.shake(6, 1);
  }
}

/** The machine leaves this time: the prop is gone from the lab for the rest of the scene. */
function vanish(s: ScriptApi, m: PropInst | undefined): void {
  if (!m) return;
  const map = s.field.map;
  map.props = map.props.filter((p) => p !== m);
}

/** Tile of an actor (for spawning a boss where a cutscene puppet stands). */
function tileOf(s: ScriptApi, id: string): [number, number] {
  const a = s.actor(id);
  return [Math.round((a.x - 8) / TILE), Math.round((a.y - 14) / TILE)];
}

registerScripts({
  // ---------------------------------------------------------------- boot
  /** Called by the title screen (no map loaded yet). */
  newGame: async (s) => {
    await s.call('c00_start');
  },

  // ---------------------------------------------------------------- opening
  c00_start: async (s) => {
    ensureChapterState(s, 0);
    await s.join('trunks', 6, true);
    s.state.data.active = 'trunks';
    await s.learn('trunks', 'burningAttack', true);
    s.clear('noSwitch');
    s.set('world', 'future');
    s.unlockRegion('spot_future_base');
    s.unlockRegion('spot_future_city');
    await s.chapter(0, 'A Future Without Hope', 'Another timeline - Age 796');

    // Opening crawl over the ruins.
    await s.warp('c00_skyline', 3, 7, 'right');
    s.show('hero', false);
    s.music('sad');
    await scene(s, 6, 5, 1);
    actor(s, 'c00_blackSil', 'gokuBlack', 34, 7, 'left', '???');
    s.silhouette('c00_blackSil', true);
    await s.narrate('This is not the world you know.');
    await s.narrate('In this timeline, two Androids once turned the Earth to ash. A young Saiyan named Trunks crossed time itself to find the strength to stop them - and he did.');
    await s.pan(18, 6, 90);
    await s.narrate('For a few short years, the survivors dared to rebuild. Then a stranger came out of nowhere, wearing the face of Son Goku: a hero who died when Trunks was still a baby.');
    await s.pan(31, 7, 90);
    s.music('black');
    await s.talk([
      ['c00_blackSil', 'So quiet. Every day this world grows a little quieter.'],
      ['c00_blackSil', 'Soon there will be no one left to spoil it.'],
    ]);
    await s.narrate('No one knows why he hunts. They only know what to call him: Black.');
    await s.narrate('Now the last survivors hide beneath the ruins of West City... where one woman is still building a way out.');
    await s.fadeOut(40);
    endScene(s);
    await s.warp('future_hideout_in', HUB.hideoutIn.bunk[0], HUB.hideoutIn.bunk[1], 'down');
    await s.call('c00_wake');
  },

  c00_wake: async (s) => {
    s.music('sad');
    const [mx, my] = HUB.hideoutIn.mai;
    const [bx, by] = HUB.hideoutIn.bulma;
    actor(s, 'c00_fmai', 'futureMai', mx, my, 'up', 'Mai');
    actor(s, 'c00_fbulma', 'futureBulma', bx, by, 'up', 'Bulma');
    s.letterbox(true);
    s.pose('hero', 'ko');
    await s.wait(40);
    s.shake(10, 1);
    await s.narrate('The Resistance hideout, somewhere under West City. Dust sifts down from the ceiling every time something explodes up top.');
    s.pose('hero', null);
    await s.emote('hero', '!');
    await s.walk('c00_fmai', mx, Math.max(my - 3, HUB.hideoutIn.bunk[1] + 1));
    s.face('c00_fmai', 'hero');
    await s.talk([
      ['c00_fmai', 'The same dream again?', 'sad'],
      ['hero', 'The city burning. Him, standing in the smoke... smiling like it was a game.', 'sad'],
      ['c00_fmai', 'Then don\'t give him your sleep too. Bulma\'s been up all night with the machine. She wants you in the lab.'],
      ['c00_fmai', 'East end of the corridor. Go on, before she starts talking to the engine again.', 'smirk'],
    ]);
    await s.walk('c00_fmai', mx, my);
    s.face('c00_fmai', 'down');
    s.letterbox(false);
    await s.narrate('Walk with the direction pad. To talk to someone, face them and press A.');
    s.set('c00_awake');
  },

  c00_fbulma_talk: async (s) => {
    if (!s.check('chapter==0')) return;
    if (!s.flag('c00_briefed')) {
      s.set('c00_briefed');
      s.letterbox(true);
      await s.talk([
        ['futureBulma', 'Trunks! Good, you\'re up. Look at her.', 'happy'],
        ['futureBulma', 'Engine rebuilt, navigation recalibrated, new seat cushion. She can fly. She just can\'t fly on hope and spit.'],
        ['hero', 'Fuel.'],
        ['futureBulma', 'Fuel. Black\'s drones torched our last stockpile. I need three Capsule Corp fuel cells - enough for one trip.', 'sad'],
        ['hero', 'One trip. There and back?'],
        ['futureBulma', 'One way. Without my old lab I can\'t refine a second batch. Whoever goes stays in the past until somebody there can help.', 'sad'],
        ['hero', 'Then you go. I\'ll hold him off here.', 'angry'],
        ['futureBulma', 'Ha! Your father would have said that, in exactly that voice. We\'ll argue once the tank is full.', 'smirk'],
        ['futureBulma', 'Capsule Corp Depot No. 4 is under the old business district. The service tunnel starts in the cave just west of our hatch.'],
        ['futureBulma', 'The road down there flooded years ago, but there\'s an emergency flight circle. And Trunks - the scavenger drones still shoot anything warm.'],
      ]);
      await s.quest('c00_fuel');
      await s.narrate('Your goals are kept in the Journal: press START and choose Journal. A gold star always marks the main story - it also shows on the world map.');
      await s.say('futureBulma', 'And save at the disc in the common room before you go. I\'d rather argue with a save point than with a grave.', 'smirk');
      s.letterbox(false);
      return;
    }
    if (s.check('quest:c00_fuel')) {
      const n = s.count('c00_fuelCell');
      const lines = [
        'The tunnel cave is west of the hatch outside. Three cells, Trunks. Then we argue.',
        'One cell! See, I knew you were my son. The depot locker should have the rest.',
        'Two! If the locker at the depot is jammed, kick it. That\'s official Capsule Corp procedure.',
        'Three already? Then what are you doing here? Bring them to the machine!',
      ];
      await s.say('futureBulma', lines[Math.min(n, 3)], n > 0 ? 'happy' : 'neutral');
      return;
    }
    await s.say('futureBulma', 'Go on. The machine won\'t fuel itself, and I\'m out of coffee.', 'smirk');
  },

  c00_fmai_talk: async (s) => {
    if (!s.check('chapter==0')) return;
    if (!s.flag('c00_briefed')) {
      await s.say('c00_fmai', 'Bulma\'s in the lab, east of the corridor. Go on - she\'s been talking to that machine like it can hear her.');
      return;
    }
    const n = s.inc('c00_maiTalks');
    if (n === 1) {
      await s.talk([
        ['c00_fmai', 'I\'ll watch the hatch. If anything with Goku\'s face comes near it, I\'ll empty a clip into it.', 'angry'],
        ['hero', 'Bullets won\'t stop him, Mai.'],
        ['c00_fmai', 'No. But they\'ll make him look at me instead of the kids.'],
      ]);
      return;
    }
    const tips = [
      'Out there you can fight; in here you can\'t. When the red icon shows in the top-right corner, you\'re in a hostile zone.',
      'If the debris won\'t move, hit it. If it\'s out of reach, shoot it. That\'s how we got the hatch open in the first place.',
      'Enemies drop food and energy orbs sometimes. Grab them - you can\'t afford to be picky out there.',
      'Save at the disc before you leave. And come back, Trunks. That part\'s not a tip.',
    ];
    await s.say('c00_fmai', tips[n % tips.length]);
  },

  /** The save disc in the common room. */
  c00_save_tut: async (s) => {
    await s.narrate('This disc is a Capsule Corp save point. Face it and press A to save your progress - you can only save at these discs.');
    await s.narrate('Later, when friends travel with you, save points are also where you switch characters.');
  },

  /** Mai won't let Trunks wander off before Bulma's briefing. */
  c00_out_enter: async (s) => {
    if (!s.check('chapter==0&c00_awake&!c00_briefed')) return;
    await s.say('futureMai', '(from the hatch) Trunks! Not so fast - Bulma wants you in the lab first!', 'angry');
    await s.say('hero', '...Right. Sorry, Mai.');
    await s.warp('future_hideout_in', HUB.hideoutIn.door[0], HUB.hideoutIn.door[1], 'up');
  },

  /** After the prologue the service tunnel is gone. */
  c00_tunnel_sealed: async (s) => {
    await s.narrate('Rubble fills the old service tunnel to the roof. It caved in the night Black attacked the hideout.');
  },

  // ---------------------------------------------------------------- tunnel tutorials
  c00_tunnel_enter: async (s) => {
    if (!s.check('chapter==0') || !once(s, 'c00_tunIntro')) return;
    await s.wait(20);
    await s.narrate('This is a hostile zone - note the red icon in the top-right corner. Enemies attack on sight here, and you can fight back.');
    await s.narrate('Top left: the red bar is HP, the green bar is EP - the energy ki techniques use. The box beside them shows your selected technique. Defeat enemies to earn EXP and level up.');
  },

  c00_hint_melee: async (s) => {
    if (!s.check('chapter==0')) return;
    await s.say('hero', 'The ceiling came down here. Only one way through... I\'ll have to dig.');
    await s.narrate('Face the rubble and press A to strike. Press A repeatedly for a combo. Bigger rocks take several hits.');
    await s.narrate('Rocks, jars and crates sometimes hide food (restores HP) or energy orbs (restore EP).');
  },

  c00_hint_ki: async (s) => {
    if (!s.check('chapter==0') || s.flag(C00_RUBBLE)) return;
    s.letterbox(true);
    await s.pan(TUNNEL.farPad[0], TUNNEL.farPad[1], 40);
    await s.say('hero', 'The road\'s flooded all the way down. And the landing circle on the far bank... it\'s buried under rubble.');
    await s.narrate('That ring is a flight circle: stand on it and press A to fly to its partner. This one can\'t lock on while the far circle is buried.');
    await s.wait(20);
    s.follow();
    await s.wait(20);
    await s.say('hero', 'Too far to reach with my sword. Fine.', 'smirk');
    await s.narrate('Face the rubble and press B to fire a Ki Blast. Ki flies over water. Each shot costs EP - standing still slowly restores it, and energy orbs refill it.');
    s.letterbox(false);
  },

  /** The near flight circle (only reached while the engine's circle is absent: before the rubble is gone this visit). */
  c00_pad: async (s) => {
    if (!s.flag(C00_RUBBLE)) {
      await s.say('hero', 'Nothing. The far circle is still buried under that rubble.');
      await s.narrate('Clear the rubble on the far bank with Ki Blasts (B), then try the circle again.');
      return;
    }
    s.sfx('powerUp');
    s.flash('#f8e070', 10);
    if (once(s, 'c00_padLit')) await s.narrate('The circle hums back to life! Stand on a flight circle and press A to fly to the circle it\'s linked to.');
    const [x, y] = TUNNEL.farPad;
    await flyHop(s, 'c00_tunnel', x, y, 'right');
  },

  c00_hint_tech: async (s) => {
    if (!s.check('chapter==0')) return;
    await s.narrate('Trunks knows more than one technique. Press L to switch between them.');
    await s.narrate('Burning Attack costs more EP than a Ki Blast, but it stuns enemies for a moment - long enough to close in with the sword.');
  },

  c00_depot_enter: async (s) => {
    if (!s.check('chapter==0')) return;
    await s.say('hero', 'Depot No. 4. The fuel locker should be at the back, past the storage aisles.');
    await s.say('hero', '...It\'s too quiet down here. I\'d better use that save disc.', 'sad');
  },

  // ---------------------------------------------------------------- depot: the locker and the ambush
  c00_locker: async (s) => {
    if (!s.check('chapter==0') || s.flag(SEALED) || s.flag('c00_departed')) return;
    // Resume an ambush that never reached the run home (it is re-entrant: it restarts from Black's entrance).
    if (s.flag('c00_ambushed')) { if (!s.check('quest:c00_return')) await s.call('c00_ambush'); return; }
    if (!s.check('quest:c00_fuel')) {
      await s.narrate('A heavy Capsule Corp fuel locker. It\'s jammed shut.');
      return;
    }
    s.letterbox(true);
    await s.narrate('The fuel locker is rusted shut. Trunks follows official Capsule Corp procedure.');
    s.pose('hero', 'kick');
    s.shake(14, 2);
    s.sfx('hit');
    await s.wait(14);
    s.pose('hero', null);
    const need = Math.max(1, 3 - s.count('c00_fuelCell'));
    await s.give('c00_fuelCell', need, true);
    s.sfx('item');
    await s.narrate(need > 1 ? `Trunks found ${need} Fuel Cells in the locker!` : 'Trunks found a Fuel Cell in the locker!');
    await s.say('hero', 'That\'s three. Hang on, Mom. I\'m coming home.', 'happy');
    await s.done('c00_fuel');
    await s.call('c00_ambush');
  },

  c00_ambush: async (s) => {
    s.set('c00_ambushed');
    s.letterbox(true);
    s.stopMusic();
    s.tint('rgba(0,0,0,0.45)');
    s.flash('#000000', 30);
    await s.wait(40);
    await s.say('hero', '...The lights. Who\'s there?', 'shock');
    const [bx, by] = nearHero(s, -5, 0);
    actor(s, 'c00_black', 'gokuBlack', bx, by, 'right', '???');
    s.silhouette('c00_black', true);
    s.face('hero', 'c00_black');
    s.music('black');
    await s.pan(bx, by, 30);
    await s.talk([
      ['c00_black', 'Such a busy little creature. Scurrying through the dark with your batteries.'],
      ['c00_black', 'I followed the scent of desperation. It led me straight to you.'],
    ]);
    s.silhouette('c00_black', false);
    s.tint(null);
    s.flash('#ffffff', 10);
    await s.talk([
      ['hero', 'Black!', 'angry'],
      ['gokuBlack', 'Draw your sword, then. Show me what a mortal does when he is cornered.', 'smirk'],
    ]);
    await s.narrate('Hold on until Black loses interest!');
    s.follow();
    s.letterbox(false);
    const [fx, fy] = tileOf(s, 'c00_black');
    s.remove('c00_black');
    s.music('zamasu');
    await arenaFight(s, 'c00_blackToy', { x: fx, y: fy, uid: 'c00_black1', survive: 25, loseOk: true, label: 'HOLD ON' });
    s.music('black');

    // He was never trying.
    s.letterbox(true);
    s.pose('hero', 'hurt');
    s.face('c00_black1', 'hero');
    await s.talk([
      ['gokuBlack', 'Your sword is a toy, and you swing it like a child playing at war.'],
      ['gokuBlack', 'The blue-haired woman. Bulma. They say she builds machines - machines that could undo everything I have done.'],
      ['hero', '...Stay away from her.', 'hurt'],
      ['gokuBlack', 'Or what?', 'smirk'],
    ]);
    s.pose('hero', null);
    await s.say('hero', 'I said... STAY AWAY FROM HER!', 'shout');
    s.music('heroic');
    await s.powerUp('hero', '#f8e048', 70);
    s.flash('#ffffff', 16);
    s.shake(20, 3);
    // Trunks has been a Super Saiyan for years: this is the tutorial for the form, not his first transformation.
    await s.setForm('trunks', 'ssj', true);
    s.transformNow('ssj');
    s.heal();
    await s.narrate('Rage burned through the exhaustion, and Trunks\'s Super Saiyan power blazed up brighter than it had in years.');
    await s.narrate('The golden triangle left of your HP bar is the transformation gauge. Press L until Z shows in the technique box; when the triangle is full, press B to transform.');
    await s.narrate('Transformed, STR, POW and END rise sharply - but EP drains every second. Press B with Z selected to power down; the triangle then refills over time.');
    await s.say('gokuBlack', 'Ah... there it is. That golden rage. Yes. Come, Saiyan.', 'smirk');
    s.letterbox(false);
    const [gx, gy] = tileOf(s, 'c00_black1');
    s.remove('c00_black1');
    const rage = await arenaFight(s, 'c00_blackRage', { x: gx, y: gy, uid: 'c00_black2', loseOk: true });

    s.letterbox(true);
    s.face('c00_black2', 'hero');
    await s.talk([
      rage === 'lose'
        ? ['gokuBlack', 'Down already? No matter. That spark was enough to remember you by.', 'smirk']
        : ['gokuBlack', '...You drew blood. How delightful.', 'smirk'],
      ['gokuBlack', 'Keep that anger warm for me, Trunks. I will come for it. And for her.'],
    ]);
    s.sfx('teleport');
    s.flash(BLACK_KI, 12);
    s.remove('c00_black2');
    await s.wait(20);
    s.transformNow(null);
    s.exp(400);
    await s.say('hero', 'He let me go on purpose... He wants me to lead him home. MOM!', 'shock');
    await s.quest('c00_return');
    await s.fadeOut(20);
    await s.narrate('Trunks tore back through the tunnels faster than he had ever flown in his life.');
    endScene(s);
    await s.call('c00_departure');
  },

  c00_black_taunt: async (s) => {
    await s.say('gokuBlack', 'Yes! More! Let me feel how much you hate me!', 'smirk');
  },

  // ---------------------------------------------------------------- departure
  c00_departure: async (s) => {
    const [dx, dy] = HUB.hideoutIn.door;
    const [bx, by] = HUB.hideoutIn.bulma;
    const [mx, my] = HUB.hideoutIn.mai;
    const [lx, ly] = HUB.hideoutIn.labDoor;
    const [cx, cy] = HUB.hideoutIn.cockpit;
    await s.warp('future_hideout_in', dx, dy, 'up');
    s.letterbox(true);
    s.music('tense');
    for (const id of HUB.hideoutIn.ambient) if (s.exists(id)) s.show(id, false);
    actor(s, 'c00_fbulma', 'futureBulma', bx, by, 'up', 'Bulma');
    actor(s, 'c00_fmai', 'futureMai', mx - 6, my + 1, 'left', 'Mai');
    await s.narrate('The hideout was already emptying. Mai had sounded the alarm the moment the tunnel sensors tripped: something was tearing toward home through the dark, fast.');
    await s.say('c00_fmai', 'Everyone into the back tunnels! Don\'t stop for anything - GO!', 'shout');

    // Into the lab.
    await s.walk('hero', lx, dy, 2.5);
    await s.walk('hero', lx, ly - 0.6, 2.5);
    s.face('hero', 'c00_fbulma');
    s.face('c00_fbulma', 'hero');
    await s.talk([
      ['futureBulma', 'Trunks! You\'re bleeding-', 'shock'],
      ['hero', 'Black found me at the depot. He let me go so I\'d lead him here. Mom, I\'m sorry...', 'sad'],
      ['futureBulma', 'Sorry later. Cells. Now.'],
    ]);
    s.take('c00_fuelCell', 3);
    s.sfx('item');
    s.face('c00_fbulma', 'up');
    await s.wait(30);
    s.sfx('powerUp');
    s.flash(TIME_BLUE, 12);
    s.face('c00_fbulma', 'hero');
    await s.talk([
      ['futureBulma', 'Tank\'s full. She\'s ready. Get in.', 'happy'],
      ['hero', 'There\'s room for two if we-', 'sad'],
      ['futureBulma', 'There\'s room for one, and it was never going to be me.', 'sad'],
      ['futureBulma', 'Find Son-kun. Find your father. Tell them everything, and bring their help home. Promise me.'],
      ['hero', '...I promise.', 'sad'],
    ]);

    // He's here.
    s.stopMusic();
    s.shake(30, 3);
    s.boom(dx, dy + 1.5, 24, BLACK_KI);
    await s.wait(20);
    actor(s, 'c00_black', 'gokuBlack', dx, dy + 2, 'up', 'Goku Black');
    s.music('black');
    await s.pan(dx + 2, dy, 30);
    await s.walk('c00_black', dx, dy, 0.8);
    s.face('c00_fmai', 'c00_black');
    await s.blast('c00_fmai', 'c00_black', '#f0d060');
    await s.blast('c00_fmai', 'c00_black', '#f0d060');
    await s.talk([
      ['gokuBlack', 'A nest of rats beneath the ruins. How very... industrious.'],
      ['c00_fmai', 'Trunks! Get to the machine!', 'shout'],
    ]);
    await s.walk('c00_black', lx - 2, dy, 0.8);
    s.face('c00_black', 'up');
    await s.say('gokuBlack', 'And there she is. The woman who builds doors in time.', 'smirk');
    await s.walk('hero', lx, ly + 0.4, 2);
    s.face('hero', 'down');
    await s.say('hero', 'Mom, stay behind me.', 'angry');
    await s.walk('c00_fbulma', lx + 0.5, ly - 0.6, 1.5);
    await s.talk([
      ['futureBulma', 'No. Trunks, look at me.'],
      ['futureBulma', 'If you fall here, there is no one left to fix any of this. Not one person.', 'sad'],
      ['futureBulma', 'Mai! Get him into that machine!', 'shout'],
    ]);
    await s.walk('c00_fmai', lx, dy, 3);
    await s.walk('c00_fmai', lx, ly + 1.2, 3);
    s.face('c00_fmai', 'hero');
    await s.say('c00_fmai', 'She made her choice. Don\'t you DARE waste it!', 'angry');
    s.pose('hero', 'hurt');
    s.sfx('punch');
    await s.walkAll([['hero', cx, cy, 3], ['c00_fmai', cx - 0.8, ly - 0.4, 3]]);
    s.pose('hero', null);
    s.face('hero', 'down');
    s.face('c00_fmai', 'hero');
    await s.say('hero', 'Mai, let go of me-! MOM!', 'shock');
    // Bulma steps into the corridor between Black and the machine.
    await s.walk('c00_fbulma', lx + 0.3, ly + 1.4, 1.2);
    s.face('c00_fbulma', 'c00_black');
    s.face('c00_black', 'c00_fbulma');
    await s.talk([
      ['futureBulma', 'You want my machine? You\'ll have to go through me first.', 'angry'],
      ['gokuBlack', 'Gladly.', 'smirk'],
    ]);
    s.pose('c00_black', 'blast');
    s.stopMusic();
    s.sfx('beam');
    s.flash(BLACK_KI, 8);
    await s.wait(8);
    s.flash('#ffffff', 60);
    s.shake(40, 4);
    await s.say('hero', 'MOOOOM!!!', 'shout');
    await s.fadeOut(30, '#ffffff');
    s.remove('c00_fbulma');
    s.pose('c00_black', null);
    await s.wait(60);
    await s.narrate('...');
    await s.narrate('When the light faded, the corridor was very quiet.');
    await s.fadeIn(40);
    s.music('sad');
    await s.wait(30);

    // Mai buys him the seconds he needs: she lures Black out through the hatch.
    await s.say('c00_fmai', '(quietly) Go, Trunks.', 'sad');
    s.face('c00_fmai', 'c00_black');
    await s.blast('c00_fmai', 'c00_black', '#f0d060');
    await s.say('c00_fmai', 'Hey! You! Over here, you monster!', 'angry');
    await s.walk('c00_fmai', lx, ly + 0.6, 3);
    await s.walk('c00_fmai', lx, dy + 0.8, 3);
    await s.walk('c00_fmai', dx, dy + 1.2, 3);
    await s.walk('c00_fmai', dx, dy + 2.4, 3);
    s.show('c00_fmai', false);
    s.face('c00_black', 'down');
    await s.say('gokuBlack', 'Run, little soldier. I will savour this.', 'smirk');
    await s.walk('c00_black', dx, dy + 1.2, 1.2);
    await s.walk('c00_black', dx, dy + 2.4, 1.2);
    s.show('c00_black', false);
    await s.wait(30);
    s.sfx('explode');
    s.shake(16, 2);
    await s.wait(40);
    await s.say('hero', '...I\'m sorry. I\'m so sorry.', 'sad');
    await s.say('hero', 'I\'ll come back. I swear it.', 'angry');
    s.show('hero', false);
    s.sfx('door');
    await s.wait(20);
    s.sfx('charge');
    s.shake(30, 2);
    const machine = timeMachine(s);
    await s.pan(cx, cy - 0.5, 30);
    await hum(s, machine, 40, 0);
    await s.narrate('The canopy sealed. The engine Bulma had rebuilt by hand shrieked to life.');

    // Black returns a heartbeat too late: the machine rises, blinks out of time, and his blast hits an empty bay.
    s.show('c00_black', true);
    s.place('c00_black', dx, dy + 2, 'up');
    await s.walk('c00_black', dx, dy, 2.5);
    await s.walk('c00_black', lx, ly + 1.6, 2.5);
    s.face('c00_black', 'up');
    await s.say('gokuBlack', 'Going somewhere?', 'angry');
    s.music('black');
    s.pose('c00_black', 'blast');
    s.sfx('charge');
    await hum(s, machine, 50, 18);
    s.sfx('teleport');
    s.flash(TIME_BLUE, 24);
    s.boom(cx, cy - 1, 24, TIME_BLUE);
    vanish(s, machine);
    await s.wait(10);
    await s.blast('c00_black', 'hero', BLACK_KI);
    s.pose('c00_black', null);
    s.flash('#ffffff', 20);
    s.shake(24, 3);
    s.boom(cx, cy - 1, 30, BLACK_KI);
    await s.wait(20);
    await s.narrate('Black\'s dark Kamehameha tore through an empty bay a heartbeat too late. The machine was already gone.');
    s.face('c00_black', 'down');
    await s.say('gokuBlack', '...Run, then. Run as far as you like. Time is only another road, and I will walk it.', 'smirk');
    await s.fadeOut(40, '#ffffff');
    s.stopMusic();
    await s.narrate('Painted across the time machine\'s hull, in Bulma\'s hand, was a single word: HOPE!!');

    // Clean-up and the handoff.
    s.show('hero', true);
    removeAll(s, ['c00_black', 'c00_fmai', 'c00_fbulma']);
    s.exp(150);
    s.transformNow(null);
    s.state.char('trunks').joined = false;
    s.set('c00_departed');
    await s.done('c00_return');
    s.unlockRegion('spot_future_city');
    s.unlockRegion('spot_future_base');
    await s.narrate('The machine vanished into the river of time, bound for a past that did not yet know it would need him.');
    await s.narrate('But Trunks\'s journey is a story for later. This story begins in another timeline - where the Earth is, for now, at peace.');
    s.letterbox(false);
    if (s.hasScript('c01_start')) await s.call('c01_start');
  },
});
