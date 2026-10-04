import { registerScripts } from '../../../game/script';
import { registerOverlay } from '../../registry';
import { giveBall } from './shared';

/**
 * Chapter 3 Dragon Ball hunt overlays on Diablo Desert, Pilaf's castle, Korin Forest and the Lookout.
 * Ball placement (radar shows the pickups on the regional map):
 *   db1 desert_oasis bandit camp (pickup)        db2 Pilaf's castle vault (pickup, behind the lever puzzle)
 *   db3 Pilaf himself after the Mk-II fight      db4 Kame House beach (hidden pickup, c03_world.ts)
 *   db5 Mr. Satan (pudding trade, c03_world.ts)  db6 Yajirobe at Korin Forest (bento trade)
 *   db7 Dende on the Lookout
 */

const CH3 = 'chapter==3';

registerOverlay('desert_entry', { onEnter: 'c03_ballcheck' });
registerOverlay('pilaf_castle_out', { onEnter: 'c03_ballcheck' });

registerOverlay('desert_oasis', {
  // The Desert Fang Gang found a "pretty orange rock" and stashed it by their campfire.
  pickups: [{ id: 'c03_db1', item: 'db1', x: 31, y: 13, showIf: CH3 }],
  enemies: [{ type: 'banditBrute', x: 31, y: 11, showIf: CH3 }, { type: 'sandSnake', x: 34, y: 13, showIf: CH3 }],
  onEnter: 'c03_ballcheck',
});

registerOverlay('pilaf_castle_in', {
  props: [{ kind: 'stairs', x: 2, y: 13, flag: 'chapter>=3' }],
  barriers: [{ id: 'c03_vaultGate', x: 15, y: 7, w: 2, h: 1, level: 0, openIf: '!c03_vaultLocked' }],
  warps: [{ x: 2, y: 13, w: 1, h: 1, to: 'c03_pilaf_vault', tx: 4, ty: 17, dir: 'up', door: true, showIf: 'chapter>=3' }],
  triggers: [
    { id: 'c03_gateNote', x: 15, y: 8, w: 2, h: 1, script: 'c03_gate_note', onAction: true, showIf: 'c03_vaultLocked' },
    { id: 'c03_mk2', x: 15, y: 6, w: 2, h: 1, script: 'c03_mk2_ambush', once: true, showIf: 'pickup:c03_db2&!defeated:c03_mk2' },
  ],
  pickups: [{ id: 'c03_db2', item: 'db2', x: 15, y: 4, showIf: CH3 }],
  onEnter: 'c03_castle_enter',
});

registerOverlay('korin_base', {
  npcs: [{ id: 'c03_yajirobe', sprite: 'yajirobe', x: 8, y: 19, dir: 'up', talk: 'c03_yajirobe_talk', name: 'Yajirobe', showIf: CH3 }],
  onEnter: 'c03_ballcheck',
});

registerOverlay('lookout', {
  npcs: [{ id: 'c03_dende', sprite: 'dende', x: 22, y: 11, dir: 'down', talk: 'c03_dende_talk', name: 'Dende', showIf: CH3 }],
  onEnter: 'c03_ballcheck',
});

registerScripts({
  c03_yajirobe_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('yajirobe', 'Mmf. Whaddaya want? I\'m eatin\'.', 'neutral'); return; }
    if (s.flag('c03_bentoTraded')) {
      await s.say('yajirobe', 'Best lunch I\'ve had in years. Tell that Briefs lady I\'m available for parties. As a guest.', 'happy');
      return;
    }
    if (s.has('c03_bento')) {
      await s.talk([
        ['yajirobe', '...Is that a Capsule Corp party bento? With the fancy shrimp?', 'shock'],
        ['hero', 'It\'s yours if you give me that Dragon Ball you\'re sitting on.', 'smirk'],
        ['yajirobe', 'Deal! Deal deal deal. Ball\'s cold anyway. Hand it over!', 'happy'],
      ]);
      s.take('c03_bento');
      s.set('c03_bentoTraded');
      await giveBall(s, 'db6');
      await s.say('korin', '(from far above) Yajirobe! Was that a bribe? ...Did you save me any?', 'angry');
      return;
    }
    await s.talk([
      ['yajirobe', 'This ball? Found it in the creek this morning. Finders keepers.', 'smirk'],
      ['hero', 'I really need it. A God of Destruction is going to blow up the planet!', 'neutral'],
      ['yajirobe', 'Everybody\'s always blowing up the planet. I\'m starving, and Korin rationed the senzu again. Bring me some REAL food and we\'ll talk.', 'angry'],
    ]);
    if (s.flag('c03_yajiHint')) return;
    s.set('c03_yajiHint');
    await s.say('hero', '(Real food... Mrs. Briefs was packing up leftovers at the party.)', 'neutral');
  },
  c03_dende_talk: async (s) => {
    if (!s.check(CH3)) { await s.say('dende', 'Welcome to the Lookout. Mr. Popo keeps the gardens beautiful, doesn\'t he?', 'happy'); return; }
    if (s.has('db7')) {
      await s.talk([
        ['dende', 'I can feel Lord Beerus\'s presence even from up here. It\'s like the whole sky is holding its breath.', 'sad'],
        ['dende', 'Shenron answers to me, but he is terrified of gods of destruction. Be polite when you summon him!', 'neutral'],
      ]);
      return;
    }
    await s.talk([
      ['dende', 'Goku! I knew you\'d come. This fell onto the Lookout during the party chaos - it nearly hit Mr. Popo.', 'happy'],
      ['dende', 'A Super Saiyan God... I\'ve never heard of one. But the Dragon Balls were made by Guardians to answer questions like that. Shenron will know.', 'neutral'],
    ]);
    await giveBall(s, 'db7');
  },
});
