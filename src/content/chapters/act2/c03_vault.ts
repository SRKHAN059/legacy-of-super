import { registerScripts, type ScriptApi } from '../../../game/script';
import { addProp, ballCheck, giveBall, removeIf, removeProp, respawn } from './shared';

/**
 * Chapter 3 - Pilaf's castle vault. LoG2-style puzzle dungeon:
 * the vault at the end of the castle's north corridor is sealed by a white story gate (overlay on pilaf_castle_in).
 * The controls are in the Security Basement (c03_pilaf_vault, hatch in the castle workshop). Pilaf's memo gives the
 * lever order as a riddle (Moon, Sun, Dragon, Pilaf); a wrong lever sounds the alarm and releases robots.
 * Inside the vault waits a Dragon Ball - and the Pilaf Gang in their Mk-II battle suit.
 */

type Lever = 'moon' | 'sun' | 'dragon' | 'pilaf';
const ORDER: Lever[] = ['moon', 'sun', 'dragon', 'pilaf'];
const LEVER_X: Record<Lever, number> = { dragon: 3.25, pilaf: 6.25, moon: 9.25, sun: 12.25 };
const LEVER_TEXT: Record<Lever, string> = {
  moon: 'A lever below a statue engraved with a crescent moon.',
  sun: 'A lever below a statue engraved with a blazing sun.',
  dragon: 'A lever below a statue engraved with a coiled dragon.',
  pilaf: 'A lever below a statue of... a small blue man in a crown. Very flattering.',
};

function leverDown(s: ScriptApi, l: Lever): boolean {
  return s.flag(`c03_lever_${l}`);
}

function setLever(s: ScriptApi, l: Lever, down: boolean): void {
  if (down) {
    s.set(`c03_lever_${l}`);
    removeProp(s, `c03_lvu_${l}`);
    addProp(s, 'c03_leverDown', LEVER_X[l], 3.2, `c03_lvd_${l}`);
  } else {
    s.clear(`c03_lever_${l}`);
    removeProp(s, `c03_lvd_${l}`);
    addProp(s, 'c03_leverUp', LEVER_X[l], 3.2, `c03_lvu_${l}`);
  }
}

function resetLevers(s: ScriptApi): void {
  for (const l of ORDER) if (leverDown(s, l)) setLever(s, l, false);
  s.set('c03_leverStep', 0);
}

async function pullLever(s: ScriptApi, l: Lever): Promise<void> {
  if (s.flag('c03_vaultOpen')) { await s.narrate('The lever is locked in the down position. The vault gate stands open.'); return; }
  if (leverDown(s, l)) { await s.narrate(`${LEVER_TEXT[l]} It is already pulled.`); return; }
  const c = await s.ask('narrator', `${LEVER_TEXT[l]} Pull it?`, ['Pull it', 'Leave it']);
  if (c !== 0) return;
  s.sfx('menuOk');
  setLever(s, l, true);
  const step = s.num('c03_leverStep');
  if (ORDER[step] !== l) {
    s.flash('#f83030', 16);
    s.shake(20, 2);
    s.sfx('denied');
    await s.narrate('*WHOOP WHOOP* "INTRUDER! INTRUDER! Wrong password, Shu! How many times do I have to - oh. This is a recording. Ahem. PREPARE TO DIE!"');
    resetLevers(s);
    s.spawnEnemy('pilafRobot', 5, 6);
    s.spawnEnemy('pilafRobot', 11, 6);
    await s.say('hero', 'Whoops. I think that was the wrong order...', 'shock');
    return;
  }
  s.set('c03_leverStep', step + 1);
  if (step + 1 < ORDER.length) {
    s.toast(`*click* (${step + 1}/4)`);
    return;
  }
  s.set('c03_vaultOpen');
  s.clear('c03_vaultLocked');
  s.shake(40, 2);
  s.sfx('explode');
  await s.narrate('A deep rumble shakes the ceiling. Somewhere upstairs, a heavy energy barrier powers down.');
  await s.say('hero', 'Moon, sun, dragon, Pilaf. Heh, thanks for the memo, Pilaf! The vault upstairs should be open now.', 'happy');
}

/** Mk-II mini-boss: the gang bursts in after the hero grabs the vault's Dragon Ball. */
async function mk2Ambush(s: ScriptApi): Promise<void> {
  if (s.flag('defeated:c03_mk2')) return;
  s.letterbox(true);
  s.music('tense');
  await s.walk('hero', 18, 4, 1.5);
  s.face('hero', 'down');
  respawn(s, 'c03_pilaf', 'pilaf', 15.5, 11, 'up');
  respawn(s, 'c03_mai', 'mai', 15, 12, 'up');
  respawn(s, 'c03_shu', 'shu', 16, 12, 'up');
  await s.walkAll([['c03_pilaf', 15.5, 6, 1.4], ['c03_mai', 14.5, 6, 1.4], ['c03_shu', 16.5, 6, 1.4]]);
  await s.talk([
    ['pilaf', 'HALT, thief! That Dragon Ball belongs to the future ruler of the world!', 'angry'],
    ['hero', 'Pilaf? Hey, I need that ball! There\'s a God of Destruction at Bulma\'s house!', 'neutral'],
    ['pilaf', 'A likely story! Mai! Shu! Activate the Pilaf Machine... MARK TWO!', 'shout'],
    ['mai', 'Mark Two is three times the missiles, Emperor. We spent the whole snack budget on it.', 'neutral'],
    ['shu', 'Worth it, sir!', 'happy'],
  ]);
  s.shake(30, 2);
  s.sfx('explode');
  respawn(s, 'c03_mk2npc', 'c03_pilafMk2', 12, 3, 'right');
  await s.lift('c03_mk2npc', 30, 1);
  await s.lift('c03_mk2npc', 0, 16);
  s.boom(12, 4, 18, '#f8c040');
  s.flash('#ffffff', 8);
  removeIf(s, 'c03_pilaf', 'c03_mai', 'c03_shu');
  await s.say('pilaf', '(over a crackling speaker) Ha ha ha! Behold my genius! Hand over the ball, monkey boy!', 'smirk');
  removeIf(s, 'c03_mk2npc');
  s.letterbox(false);
  s.music('battle');
  const r = await s.fight('c03_pilafMk2', { x: 12, y: 3, uid: 'c03_mk2' });
  if (r !== 'win' && r !== 'end') return;
  s.set('defeated:c03_mk2');
  s.letterbox(true);
  s.remove('c03_mk2');
  s.boom(13, 4, 22, '#f8a040');
  respawn(s, 'c03_pilaf', 'pilaf', 13, 5, 'right');
  respawn(s, 'c03_mai', 'mai', 12, 5, 'right');
  respawn(s, 'c03_shu', 'shu', 13, 6, 'right');
  for (const id of ['c03_pilaf', 'c03_mai', 'c03_shu']) s.pose(id, 'ko');
  await s.seconds(0.6);
  for (const id of ['c03_pilaf', 'c03_mai', 'c03_shu']) s.pose(id, null);
  s.music('peaceful');
  await s.talk([
    ['pilaf', 'My Mark Two... my beautiful Mark Two... it wasn\'t even paid off yet...', 'sad'],
    ['hero', 'Sorry, Pilaf. But if Beerus gets bored, there won\'t BE a world to rule.', 'neutral'],
    ['mai', 'Emperor. Give him the other one. I don\'t want to rule a planet that\'s been destroyed.', 'neutral'],
    ['pilaf', '...FINE. Take it! But I\'m only lending it! With interest!', 'angry'],
  ]);
  await giveBall(s, 'db3');
  await s.talk([
    ['shu', 'Sir, the snack budget...', 'sad'],
    ['pilaf', 'RETREAT! Strategic retreat! We\'ll be back, mark my words!', 'shout'],
  ]);
  await s.walkAll([['c03_pilaf', 15.5, 12, 2], ['c03_mai', 15.5, 12, 2], ['c03_shu', 15.5, 12, 2]]);
  removeIf(s, 'c03_pilaf', 'c03_mai', 'c03_shu');
  s.letterbox(false);
  s.music('cave');
  await ballCheck(s);
}

registerScripts({
  c03_vault_enter: async (s) => {
    if (!s.flag('c03_vaultOpen')) s.set('c03_leverStep', 0);
    for (const l of ORDER) if (!s.flag('c03_vaultOpen')) s.clear(`c03_lever_${l}`);
    if (!s.check('chapter==3') || s.flag('c03_vaultOpen')) return;
    if (!s.flag('c03_basementSeen')) {
      s.set('c03_basementSeen');
      await s.say('hero', 'Four statues and four levers... These must be the vault controls. There was a memo on that desk, too.', 'neutral');
      await s.quest('c03_vault');
    }
  },
  /** The sealed vault door upstairs (examine). */
  c03_gate_note: async (s) => {
    if (!s.flag('c03_vaultLocked')) { await s.narrate('The vault corridor is open.'); return; }
    await s.narrate('A crackling energy barrier seals the vault. A brass plate reads: "VAULT CONTROLS: BASEMENT. Hatch in the workshop. Password REQUIRED."');
    if (s.check('chapter==3')) await s.quest('c03_vault');
  },
  /** Castle onEnter: radar hint and ball count. */
  c03_castle_enter: async (s) => {
    if (!s.check('chapter==3')) return;
    if (!s.flag('c03_castleSeen')) {
      s.set('c03_castleSeen');
      await s.say('hero', 'The radar says there\'s a ball at the north end of the castle. Somewhere behind all these robots...', 'neutral');
    }
    await ballCheck(s);
  },
  c03_memo: async (s) => {
    if (!s.has('c03_memo')) {
      await s.narrate('A cluttered desk covered in snack wrappers and world-domination plans. A memo is taped to the lamp.');
      await s.give('c03_memo');
    }
    await s.narrate('"Vault password - DO NOT LOSE (Shu!!): First bow to the queen of the night. Then hail the king of the day. Third, the one who grants every wish. And LAST, the greatest ruler of all. Me. Obviously."');
  },
  c03_lever_moon: async (s) => pullLever(s, 'moon'),
  c03_lever_sun: async (s) => pullLever(s, 'sun'),
  c03_lever_dragon: async (s) => pullLever(s, 'dragon'),
  c03_lever_pilaf: async (s) => pullLever(s, 'pilaf'),
  c03_mk2_ambush: async (s) => mk2Ambush(s),
  c03_mk2_phase2: async (s) => {
    await s.say('pilaf', 'Shu! Release the backup robots! And stop eating the controls!', 'angry');
  },
});
