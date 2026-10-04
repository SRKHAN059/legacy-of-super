import { TILE } from '../../../engine/constants';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { HUB } from './hubs';
import { C02_ERRANDS } from './c02_side';
import { actor, arenaClear, arenaFight, calm, endScene, pointOfNoReturn, removeAll, SEALED, talker, unlockSpot } from './util';

/**
 * CHAPTER 2 - "The Destroyer's Feast" (Vegeta joins L8, forced).
 * c02_start: gravity room (drone warm-up, Big Bang), King Kai's telepathic warning, Bulma's invitation (gold c02_party).
 * The Princess Bulma: Scouter from Bulma (Select/R tutorial), Beerus and Whis crash the party (gold c02_feast).
 * Fetch chain driven by Beerus's mood: takoyaki (galley chef -> old fisherman's octopus dive -> Krillin's wasabi prank),
 * ramen (marina chauffeur -> West City noodle cart -> street punks), bingo + the Pilaf Gang heist (the gang sneaks off
 * deck, a chase through the cargo hold, Vegeta L10 gate on the vault's side store, mini-boss Pilaf Machine), pudding
 * (Buu; point of no return) -> Beerus's rampage, Bulma's slap, Vegeta's Super Saiyan 2 rage fight (endAt 0.85) ->
 * Goku arrives and talks Beerus into coming ashore -> c03_start (which plays the Super Saiyan God conversation).
 */

const BEERUS_KI = '#b070f0';
const MOODS = ['bored', 'curious', 'pleased', 'delighted', 'about to explode'];

function tileOf(s: ScriptApi, id: string): [number, number] {
  const a = s.actor(id);
  return [Math.round((a.x - 8) / TILE), Math.round((a.y - 14) / TILE)];
}

async function showMood(s: ScriptApi): Promise<void> {
  const m = Math.min(MOODS.length - 1, s.num('c02_mood'));
  await s.narrate(`Lord Beerus's mood: ${MOODS[m]}.`);
}

registerScripts({
  // ---------------------------------------------------------------- start: the gravity room
  c02_start: async (s) => {
    ensureChapterState(s, 2);
    await s.join('vegeta', 8, true);
    await s.learn('vegeta', 'bigBang', true);
    await s.setForm('vegeta', 'ssj', true);
    force(s, 'vegeta');
    s.set('world', 'earth');
    await s.chapter(2, 'The Destroyer\'s Feast');
    const [vx, vy] = HUB.ccGravity.vegeta;
    await s.warp('cc_gravity', vx, vy, 'up');
    await s.call('c02_gravity');
  },

  /** Re-entrant: cc_gravity's onEnter (c02_gravity_enter) picks it back up if the visit was ever cut short. */
  c02_gravity: async (s) => {
    if (s.flag(SEALED) || s.flag('c02_intro')) return;
    s.set('c02_gravityOn');
    s.letterbox(true);
    s.music('battle');
    await s.narrate('West City. Capsule Corporation\'s gravity room, set to one hundred and fifty times Earth\'s gravity.');
    s.pose('hero', 'charge');
    s.shake(20, 1);
    await s.say('vegeta', 'Hah... hah... Again! Kakarot is off playing farmer. This is my chance to leave him in the dust.', 'angry');
    s.pose('hero', null);
    await s.narrate('Vegeta has joined! The story follows him for now, so you can\'t switch characters at save points until this chapter ends.');
    await s.narrate('Vegeta knows the Big Bang Attack: select it with L, hold B to charge the sphere and release to throw it. A longer charge flies farther and hits harder.');
    s.letterbox(false);
    await s.say('vegeta', 'Training drones, activate!', 'shout');
    HUB.ccGravity.drones.forEach(([x, y], i) => { if (!s.exists(`c02_drone${i}`)) s.spawnEnemy('c02_gravDrone', x, y, `c02_drone${i}`); });
    await arenaClear(s);
    calm(s);
    s.letterbox(true);
    await s.say('vegeta', 'Pathetic. Bulma will have to build sturdier toys.', 'smirk');
    await s.talk([
      ['kingKai', '(Vegeta! Vegeta, can you hear me? It\'s King Kai!)', 'shock'],
      ['vegeta', '...Get out of my head, you blue insect.', 'angry'],
      ['kingKai', '(Listen to me! Lord Beerus, the God of Destruction, is on his way to Earth! He knocked Goku out with ONE chop!)'],
      ['vegeta', 'Kakarot lost...? Beerus... That name...', 'shock'],
    ]);
    s.flash('#000000', 30);
    await s.narrate('A memory surfaced: a purple, cat-like god lounging on a throne... and Vegeta\'s proud father, King Vegeta, pressed face-down beneath his foot.');
    await s.talk([
      ['vegeta', 'Lord Beerus. Here. On Earth.', 'shock'],
      ['kingKai', '(Whatever you do, DON\'T make him angry! If he gets in a bad mood, he\'ll destroy the whole planet just to feel better!)'],
    ]);
    const [dx, dy] = HUB.ccGravity.door;
    actor(s, 'c02_bulmaG', 'bulma', dx, dy, 'up', 'Bulma');
    await s.walk('c02_bulmaG', dx, dy - 1.5, 1.5);
    await s.talk([
      ['bulma', 'Vegeta! You\'re still in here? Don\'t tell me you forgot!', 'angry'],
      ['vegeta', 'Forgot what.'],
      ['bulma', 'My birthday party! On the Princess Bulma! Everybody\'s coming, and you PROMISED you\'d wear a nice shirt.'],
      ['vegeta', 'I promised nothing.'],
      ['bulma', 'The ship\'s at the West City marina. A driver is waiting on the front lawn. And Vegeta? Try to smile. Just once. For me.', 'happy'],
    ]);
    await s.walk('c02_bulmaG', dx, dy + 1, 1.5);
    s.remove('c02_bulmaG');
    await s.say('vegeta', '(If that god is coming here, I\'d better be where everyone else is. Tch.)', 'sad');
    await s.quest('c02_party');
    await unlockSpot(s, 'spot_westcity');
    s.set('c02_intro');
    s.letterbox(false);
  },

  c02_gravity_enter: async (s) => {
    if (!s.check(`chapter==2&c02_gravityOn&!c02_intro&!${SEALED}`)) return;
    await s.wait(16);
    await s.call('c02_gravity');
  },

  // ---------------------------------------------------------------- getting around: the chauffeur
  c02_driver_yard: async (s) => { await s.call('c02_driver_offer'); },
  c02_driver_city: async (s) => { await s.call('c02_driver_offer'); },

  c02_driver_offer: async (s) => {
    if (!s.check('chapter==2')) { await s.say('c02_driver', 'Capsule Corp car service. Good day, sir.'); return; }
    if (s.flag(SEALED)) { await s.say('c02_driver', 'Sir! Perhaps deal with the hooligans first? I\'ll keep the engine warm.', 'shock'); return; }
    const c = await s.ask('c02_driver', 'Mr. Vegeta. Shall I drive you to the marina, sir?', ['To the marina', 'Not now']);
    if (c !== 0) { await s.say('c02_driver', 'Very good, sir. I\'ll keep the engine warm.'); return; }
    await s.fadeOut(20);
    await s.warp('c02_pier', 6, 13, 'up');
  },

  c02_driver_pier: async (s) => {
    const c = await s.ask('c02_driver', 'Where to, sir?', ['Downtown West City', 'Capsule Corporation', 'Stay here']);
    if (c === 2) { await s.say('c02_driver', 'Of course, sir.'); return; }
    await s.fadeOut(20);
    if (c === 0) {
      const [x, y] = HUB.wcStreets.driver;
      await s.warp('wc_streets', x + 1, y + 1, 'right');
    } else {
      const [x, y] = HUB.ccYard.driver;
      await s.warp('cc_yard', x, y + 1, 'down');
    }
  },

  c02_gangway_locked: async (s) => {
    await s.say('c02_steward', 'I\'m afraid boarding hasn\'t started yet.');
  },

  // ---------------------------------------------------------------- boarding: the Scouter
  c02_deck_enter: async (s) => {
    if (!s.check('chapter==2') || s.flag('c02_boarded')) return;
    s.set('c02_boarded');
    s.set('ea_buuAway');
    await s.wait(16);
    s.letterbox(true);
    s.music('town');
    const p = s.field.player;
    const hx = Math.round((p.x - 8) / TILE);
    const hy = Math.round((p.y - 14) / TILE);
    actor(s, 'c02_bulma', 'bulma', 20, 4, 'down', 'Bulma');
    await s.walk('c02_bulma', hx, hy - 2, 2);
    await s.talk([
      ['bulma', 'You came! And you\'re wearing... your training suit. Of course you are.', 'smirk'],
      ['vegeta', 'Hmph. Happy birthday.'],
      ['bulma', 'Aww! Okay, I have a present for YOU, even though it\'s MY birthday. Ta-da!', 'happy'],
    ]);
    await s.give('scouter');
    await s.talk([
      ['bulma', 'I rebuilt one of those old Frieza Force scouters. Better battery, better sensors, and it doesn\'t explode when it looks at Goku.', 'smirk'],
    ]);
    await s.narrate('Press SELECT to aim the Scouter at people and enemies and read their power. Every reading is stored in the Capsule Corp database.');
    await s.narrate('Press R to open the regional map. It shows the areas you\'ve visited in this region.');
    await s.talk([
      ['bulma', 'Do me a favour and field-test it on the guests. Scan five of them and tell me how it went - I want data!'],
      ['bulma', 'Now go mingle! The stage show starts soon. And SMILE.', 'happy'],
    ]);
    await s.done('c02_party');
    await s.quest('c02_scan');
    s.set('c02_scouter');
    await s.walk('c02_bulma', 20, 4, 2);
    s.face('c02_bulma', 'down');
    s.letterbox(false);
  },

  // ---------------------------------------------------------------- Beerus crashes the party
  c02_beerus_arrive: async (s) => {
    if (!s.check('chapter==2&c02_scouter') || s.flag('c02_beerusArrived')) return;
    s.set('c02_beerusArrived');
    s.set('c02_mood', 0);
    s.letterbox(true);
    s.stopMusic();
    s.flash('#ffffff', 20);
    s.sfx('teleport');
    talker(s, 'c02_beerus', 'beerus', 34, 5, 'left', 'Beerus', 'c02_beerus_talk');
    talker(s, 'c02_whis', 'whis', 36, 6, 'left', 'Whis', 'c02_whis_talk');
    actor(s, 'c02_bulma', 'bulma', 20, 4, 'down', 'Bulma');
    await s.pan(33, 5, 30);
    s.music('godly');
    s.face('hero', 'c02_beerus');
    await s.emote('hero', '!');
    await s.talk([
      ['whis', 'Oh my! Pardon the intrusion. We heard there was a party.', 'happy'],
      ['bulma', 'The more the merrier! Vegeta, are these friends of yours?', 'happy'],
      ['vegeta', 'L-Lord Beerus... What brings the God of Destruction to Earth?', 'shock'],
      ['beerus', 'Vegeta. You were a brat the last time I saw you. I\'m looking for the Super Saiyan God. Ever heard of him?'],
      ['vegeta', 'A Super Saiyan... God? N-no, my lord. Never.', 'shock'],
      ['beerus', 'Hm. Then I\'ll wait and see. Something here smells good.'],
      ['whis', 'Lord Beerus, look! A whole table of dishes we have never tasted!', 'happy'],
      ['bulma', 'Help yourselves! Any friend of Vegeta\'s is welcome!', 'happy'],
    ]);
    s.follow();
    await s.say('vegeta', '(Keep him happy. Keep. Him. Happy. If his mood sours even a little, this planet is finished.)', 'sad');
    await s.quest('c02_feast');
    await showMood(s);
    await s.narrate('Talk to Lord Beerus to find out what he wants.');
    s.letterbox(false);
  },

  c02_beerus_talk: async (s) => {
    if (!s.check('chapter==2') || s.flag('c02_rage')) { await s.say('beerus', 'Mm. What.'); return; }
    const mood = s.num('c02_mood');
    if (mood === 0) {
      if (s.has('c02_takoyaki')) { await s.call('c02_serve_takoyaki'); return; }
      if (!s.check('quest:c02_takoyaki')) {
        await s.talk([
          ['beerus', 'Vegeta. I\'m hungry. Bring me something I\'ve never eaten before.'],
          ['whis', 'The chef mentioned "takoyaki". Little dough balls with octopus inside. It sounded heavenly.', 'happy'],
          ['vegeta', 'At once, Lord Beerus. (The galley is on the west side of the deck.)'],
        ]);
        s.set('c02_tako', 1);
        await s.quest('c02_takoyaki');
        return;
      }
      await s.say('beerus', 'I\'m still waiting on those dough balls, Vegeta.', 'angry');
      return;
    }
    if (mood === 1) {
      if (s.has('c02_ramen')) { await s.call('c02_serve_ramen'); return; }
      if (!s.check('quest:c02_ramen')) {
        await s.talk([
          ['beerus', 'Those were good. Next. Whis won\'t stop talking about a soup with noodles in it.'],
          ['whis', 'Ramen! I read about it in an Earth magazine. Apparently the best comes from a little cart in West City.', 'happy'],
          ['vegeta', '...The chauffeur at the marina can drive me downtown. I\'ll be back.'],
        ]);
        s.set('c02_ramenStep', 1);
        await s.quest('c02_ramen');
        return;
      }
      await s.say('beerus', 'Noodles, Vegeta. NOODLES.', 'angry');
      return;
    }
    if (mood === 2) {
      if (!s.flag('c02_heist')) { await s.call('c02_bingo'); return; }
      await s.say('beerus', 'Whatever is crashing around under the deck, I hope it\'s entertaining.');
      return;
    }
    if (mood >= 3) {
      if (!s.check('quest:c02_pudding')) {
        await s.talk([
          ['beerus', 'That explosion downstairs rattled my plate. Best part of the party so far.', 'smirk'],
          ['beerus', 'Now. Dessert. Something sweet. Something... wobbly.'],
          ['bulma', 'Ooh, I ordered custard pudding! There should be plenty. Buu was guarding the tray, I think.', 'happy'],
          ['vegeta', '(Buu. Of course it\'s Buu.)', 'sad'],
        ]);
        await s.quest('c02_pudding');
        return;
      }
      await s.say('beerus', 'Pudding, Vegeta. Bulma said there was pudding.');
    }
  },

  c02_whis_talk: async (s) => {
    if (!s.check('chapter==2')) { await s.say('whis', 'Oh, hello there.', 'happy'); return; }
    const m = s.num('c02_mood');
    const lines = [
      'Lord Beerus becomes much more agreeable when he is fed. Do keep that in mind.',
      'Delightful little dough balls! I could eat a hundred. Well. I did eat a hundred.',
      'Earth has so many wonderful things. Noodles, bingo, explosions...',
      'Pudding is Lord Beerus\'s favourite kind of food: the kind he has not had yet.',
    ];
    await s.say('whis', lines[Math.min(m, lines.length - 1)], 'happy');
  },

  // ---------------------------------------------------------------- takoyaki chain
  c02_chef_talk: async (s) => {
    const step = s.num('c02_tako');
    if (s.check('chapter==2') && step === 1) {
      await s.talk([
        ['c02_chef', 'Takoyaki for the purple gentleman? I would love to, monsieur, but we are OUT of octopus!', 'sad'],
        ['c02_chef', 'The guests ate everything with eight legs. Perhaps the old fisherman on the marina knows where to find one.'],
      ]);
      s.set('c02_tako', 2);
      return;
    }
    if (s.check('chapter==2') && step === 2 && !s.has('c02_octopus')) {
      await s.say('c02_chef', 'No octopus, no takoyaki. Try the old fisherman down on the pier, monsieur.');
      return;
    }
    if (s.check('chapter==2') && s.has('c02_octopus')) {
      s.take('c02_octopus');
      s.letterbox(true);
      await s.talk([
        ['c02_chef', 'Magnifique! Fresh, furious and... is that ink all over your armour? Never mind. To the grill!', 'happy'],
      ]);
      s.sfx('blast');
      await s.wait(30);
      await s.talk([
        ['c02_chef', 'Voila! Eight perfect takoyaki.'],
        ['c02_chef', 'Oh, and the bald gentleman - Krillin? - asked me to fill ONE of them with wasabi. A little prank for his friend Yamcha.', 'smirk'],
        ['vegeta', '...Which one.', 'angry'],
        ['c02_chef', 'The one that is a little bit green. Bon appetit!', 'happy'],
      ]);
      await s.give('c02_takoyaki');
      s.set('c02_tako', 4);
      s.letterbox(false);
      return;
    }
    await s.say('c02_chef', 'Welcome to my galley! Tonight: lobster, sushi, cake the size of a car, and a buffet for one very hungry Saiyan family.');
  },

  c02_cook_talk: async (s) => {
    await s.say('c02_cook', s.flag('c02_beerusArrived')
      ? 'The purple guest and the tall pale one ate the whole second buffet. I don\'t know where they PUT it.'
      : 'Chef says if Goku shows up we should lock the pantry. We don\'t have a lock big enough.');
  },

  c02_fisher_talk: async (s) => {
    if (s.check('chapter==2') && s.num('c02_tako') === 2 && !s.has('c02_octopus')) {
      await s.talk([
        ['c02_fisher', 'Octopus? Hah! They hide under the pier pilings, right below your feet. Too clever for nets.'],
        ['c02_fisher', 'Only way to catch one is to dive in and grab it. They don\'t like that. They fight dirty.'],
      ]);
      const c = await s.ask('vegeta', '(Dive into the harbour... for an octopus... in front of everyone.)', ['Dive in', 'Absolutely not']);
      if (c !== 0) { await s.say('c02_fisher', 'Heh. Suit yourself. The octopus\'ll still be there when your pride runs out.'); return; }
      s.letterbox(true);
      await s.say('vegeta', 'For the planet. ONLY for the planet.', 'angry');
      s.show('hero', false);
      s.sfx('dash');
      s.flash('#4080f0', 14);
      s.shake(10, 1);
      await s.wait(50);
      s.shake(20, 2);
      s.sfx('hit');
      await s.wait(30);
      s.show('hero', true);
      s.flash('#202040', 20);
      await s.narrate('Vegeta bursts out of the water clutching a furious octopus - and wearing most of its ink.');
      await s.talk([
        ['c02_fisher', 'HA! Now THAT\'s a fisherman! You\'ve got a little something on your... everything.', 'happy'],
        ['vegeta', 'Not. One. Word.', 'angry'],
      ]);
      await s.give('c02_octopus');
      s.set('c02_tako', 3);
      s.letterbox(false);
      return;
    }
    await s.say('c02_fisher', s.flag('c02_rage')
      ? 'Saw the whole sky light up over the ship. Biggest fireworks I ever saw. The fish haven\'t come back since.'
      : 'Forty years I\'ve fished this harbour. Never seen a boat that size. Or a party guest with a tail.');
  },

  c02_serve_takoyaki: async (s) => {
    s.take('c02_takoyaki');
    s.letterbox(true);
    const c = await s.ask('vegeta', 'Lord Beerus, your takoyaki. (One of them is green inside...)', ['Serve the whole plate', 'Quietly remove the green one']);
    if (c === 1) {
      await s.talk([
        ['beerus', 'Why did you take that one out? Are you hiding the best one from me? Give it.', 'angry'],
        ['vegeta', 'My lord, that one is-', 'shock'],
      ]);
    }
    await s.say('beerus', '*munch* ...Hm. Soft. Hot. Good.');
    s.shake(30, 2);
    s.flash('#40c040', 16);
    await s.talk([
      ['beerus', '...!!! HHHHHHH!! My NOSE! My BRAIN!', 'shock'],
      ['whis', 'Ohohoho! Lord Beerus, your ears are steaming!', 'happy'],
      ['krillin', '(from across the deck) Uh oh. That one was supposed to be for Yamcha...', 'shock'],
      ['beerus', '...', 'angry'],
      ['beerus', '...That burn. It\'s... interesting. Again. Bring me another green one later.', 'smirk'],
      ['vegeta', '(He... liked it?! I\'ll deal with Krillin after the planet survives.)', 'shock'],
    ]);
    s.set('c02_mood', 1);
    await s.done('c02_takoyaki', false);
    s.exp(200);
    await showMood(s);
    s.letterbox(false);
  },

  // ---------------------------------------------------------------- ramen chain (West City)
  c02_cart_talk: async (s) => {
    const step = s.num('c02_ramenStep');
    if (s.check('chapter==2') && step === 1) {
      s.letterbox(true);
      await s.talk([
        ['c02_ramenChef', 'Sorry, friend, the cart\'s closed tonight. No noodles!', 'sad'],
        ['c02_ramenChef', 'A gang of punks swiped my noodle delivery capsule right off the cart. They\'re loitering in the little garden by the houses, laughing about it.', 'angry'],
        ['vegeta', 'Punks. Stealing noodles. While a god waits for them.', 'angry'],
        ['c02_ramenChef', 'If you can get it back, I\'ll make you my house special. On the house!'],
      ]);
      s.set('c02_ramenStep', 2);
      s.set('c02_punks');
      const [px, py] = HUB.wcStreets.punks;
      talker(s, 'c02_punkBoss', 'c02_punk', px, py, 'down', 'Punk Boss', 'c02_punk_talk');
      s.letterbox(false);
      return;
    }
    if (s.check('chapter==2') && s.has('c02_capsule')) {
      s.take('c02_capsule');
      s.letterbox(true);
      await s.talk([
        ['c02_ramenChef', 'My capsule! You actually got it back! Give me two minutes...', 'happy'],
      ]);
      s.sfx('blast');
      await s.wait(30);
      await s.say('c02_ramenChef', 'One house special: pork bone broth, twelve hours, extra everything. Careful, it\'s hot!', 'happy');
      await s.give('c02_ramen');
      s.set('c02_ramenStep', 4);
      s.letterbox(false);
      return;
    }
    if (s.check('chapter==2') && step === 2) {
      await s.say('c02_ramenChef', 'The punks are in the pocket garden down the residential lane, by the old wishing well.');
      return;
    }
    await s.say('c02_ramenChef', 'Best noodles in West City, from a cart my grandpa built. The fancy place on Food Street can keep its chairs.', 'happy');
  },

  c02_punk_talk: async (s) => {
    if (s.flag(SEALED)) return;
    if (!s.check('c02_punks') || s.flag('c02_punksBeaten')) { await s.say('c02_punk', 'We ain\'t doin\' nothin\'. Beat it.'); return; }
    s.letterbox(true);
    await s.talk([
      ['c02_punk', 'Whaddaya want, spiky? This is our garden.', 'smirk'],
      ['vegeta', 'The noodle capsule. Hand it over, and I\'ll let you keep your teeth.', 'angry'],
      ['c02_punk', 'Ooh, scary! Boys - get him!', 'shout'],
    ]);
    s.letterbox(false);
    const [px, py] = HUB.wcStreets.punks;
    if (s.exists('c02_punkBoss')) s.remove('c02_punkBoss');
    s.spawnEnemy('c02_punk', px, py, 'c02_p1');
    s.spawnEnemy('c02_punk', px + 2, py - 1, 'c02_p2');
    s.spawnEnemy('c02_punkGun', px - 2, py + 1, 'c02_p3');
    await arenaClear(s);
    calm(s);
    s.set('c02_punksBeaten');
    await s.narrate('The punks scatter, leaving the stolen capsule behind.');
    await s.give('c02_capsule');
  },

  c02_serve_ramen: async (s) => {
    s.take('c02_ramen');
    s.letterbox(true);
    await s.talk([
      ['vegeta', 'Lord Beerus. Ramen. From the best cart in West City.'],
      ['beerus', '*slurrrp* ...', 'neutral'],
      ['beerus', '...!! The broth... the noodles... they\'re fighting each other in my mouth and BOTH are winning!', 'happy'],
      ['whis', 'Oh my. Simply divine. Do they deliver to other galaxies?', 'happy'],
    ]);
    s.set('c02_mood', 2);
    await s.done('c02_ramen', false);
    s.exp(250);
    await showMood(s);
    s.letterbox(false);
  },

  // ---------------------------------------------------------------- bingo and the heist
  c02_bingo: async (s) => {
    s.letterbox(true);
    actor(s, 'c02_bulma', 'bulma', 20, 4, 'down', 'Bulma');
    await s.pan(20, 3, 30);
    await s.talk([
      ['beerus', 'I\'m full. Entertain me.'],
      ['bulma', 'Perfect timing! Everybody, it\'s BINGO time!', 'happy'],
      ['bulma', 'First prize: a new car! Second: a private jet! And the grand prize... all SEVEN Dragon Balls! They\'re in the prize vault down in the hold.', 'smirk'],
      ['beerus', 'Dragon Balls? The wish-granting toys? ...Fine. I\'ll play.'],
    ]);
    // Three "children" by the east rail heard that too.
    actor(s, 'c02_pilaf', 'pilaf', 31, 9, 'down', 'Pilaf');
    actor(s, 'c02_mai', 'mai', 33, 9, 'down', 'Mai');
    actor(s, 'c02_shu', 'shu', 32, 10, 'up', 'Shu');
    await s.pan(32, 10, 40);
    s.face('c02_pilaf', 'right');
    s.face('c02_mai', 'left');
    await s.talk([
      ['pilaf', '(All seven! In a vault! Guarded by nothing but bingo cards!)', 'happy'],
      ['mai', '(Emperor, the vault has a force field.)'],
      ['shu', '(Not anymore! The little boy with purple hair unplugged it to look inside. I saw him!)', 'happy'],
      ['pilaf', '(Then it is DESTINY. To the hold, my loyal minions. Quietly!)', 'smirk'],
    ]);
    // Around the east cabin to the crew hatch on its south face.
    const pan = s.pan(33, 16, 70);
    await s.walkAll([['c02_pilaf', 36, 12, 2.2], ['c02_mai', 37, 12, 2.2], ['c02_shu', 36.5, 13, 2.2]]);
    await s.walkAll([['c02_pilaf', 36, 21, 2.2], ['c02_mai', 37, 21.5, 2.2], ['c02_shu', 36.5, 22, 2.2]]);
    await s.walkAll([['c02_pilaf', 30.5, 21, 2.2], ['c02_mai', 31.5, 21.5, 2.2], ['c02_shu', 31, 22, 2.2]]);
    await pan;
    for (const id of ['c02_pilaf', 'c02_mai', 'c02_shu']) {
      await s.walk(id, 30.5, 20.2, 2.2);
      s.sfx('door');
      s.remove(id);
    }
    await s.pan(30, 8, 30);
    await s.say('vegeta', '...The brats from the buffet. Sneaking down to the cargo hold.', 'angry');
    s.shake(30, 2);
    s.sfx('explode');
    s.flash('#f04040', 12);
    await s.wait(20);
    // The steward bursts out of the crew hatch and runs around the cabin to Bulma.
    actor(s, 'c02_stewardD', 'c02_steward', 30.5, 21, 'down', 'Steward');
    await s.walk('c02_stewardD', 35.5, 21, 2.8);
    await s.walk('c02_stewardD', 35.5, 8, 2.8);
    await s.walk('c02_stewardD', 27, 6, 2.8);
    await s.talk([
      ['c02_stewardD', 'Miss Bulma! Something just blew the prize vault door off its hinges! Down in the cargo hold!', 'shock'],
      ['bulma', 'The Dragon Balls?! Who would-', 'shock'],
      ['beerus', '...Is the bingo cancelled?', 'angry'],
      ['vegeta', '(If the prize disappears, he\'ll sulk. If he sulks...) Nobody move. I\'ll handle it.', 'angry'],
    ]);
    removeAll(s, ['c02_pilaf', 'c02_mai', 'c02_shu', 'c02_stewardD']);
    s.set('c02_heist');
    await s.quest('c02_thieves');
    await s.narrate('The hatch to the cargo hold is on the east cabin, at the back of the deck.');
    s.follow();
    s.letterbox(false);
  },

  c02_hold_locked: async (s) => {
    await s.narrate('A heavy hatch marked CREW ONLY - CARGO HOLD. It\'s locked.');
  },

  /** Cargo hold onEnter: first glimpse of the Pilaf Gang, scattering ahead through the crate maze. */
  c02_hold_enter: async (s) => {
    if (!s.check(`chapter==2&c02_heist&!c02_machineBeaten&!c02_chaseA&!${SEALED}`)) return;
    s.set('c02_chaseA');
    await s.wait(16);
    s.letterbox(true);
    const gang: Array<[string, string, string, number, number]> = [
      ['c02_pilafC', 'pilaf', 'Pilaf', 8.5, 13], ['c02_maiC', 'mai', 'Mai', 9.5, 14], ['c02_shuC', 'shu', 'Shu', 8, 14.5],
    ];
    for (const [id, sprite, name, x, y] of gang) actor(s, id, sprite, x, y, 'left', name);
    await s.pan(8, 11, 40);
    await s.talk([
      ['shu', 'Emperor! The scary one followed us down!', 'shock'],
      ['pilaf', 'Then RUN, you fools! To the vault! The machine is waiting!', 'shout'],
    ]);
    await s.walkAll([['c02_pilafC', 9.5, 3, 2.4], ['c02_maiC', 10.5, 3.5, 2.4], ['c02_shuC', 9, 4, 2.4]]);
    await s.walkAll([['c02_pilafC', 15, 3, 2.4], ['c02_maiC', 15, 3.5, 2.4], ['c02_shuC', 15, 4, 2.4]]);
    removeAll(s, gang.map((g) => g[0]));
    s.follow();
    await s.say('vegeta', 'Run all you like, Pilaf. This ship only goes down so far.', 'smirk');
    await s.narrate('Chase the Pilaf Gang through the cargo hold! Their guard robots don\'t care whose side you\'re on.');
    s.letterbox(false);
  },

  /** Halfway through the maze: the gang dashes for the vault. */
  c02_hold_chase: async (s) => {
    if (!s.check(`chapter==2&c02_heist&!c02_machineBeaten&!${SEALED}`)) return;
    s.letterbox(true);
    const gang: Array<[string, string, string, number, number]> = [
      ['c02_pilafC', 'pilaf', 'Pilaf', 16, 13], ['c02_maiC', 'mai', 'Mai', 16.5, 14], ['c02_shuC', 'shu', 'Shu', 15.5, 14.5],
    ];
    for (const [id, sprite, name, x, y] of gang) actor(s, id, sprite, x, y, 'right', name);
    await s.pan(17, 9, 30);
    await s.talk([
      ['mai', 'Emperor, he\'s gaining on us!', 'shock'],
      ['pilaf', 'Faster, Shu! Your legs are longer than mine!', 'angry'],
      ['shu', 'They\'re exactly the same length, Emperor!', 'sad'],
    ]);
    await s.walkAll([['c02_pilafC', 20.5, 14, 2.4], ['c02_maiC', 21.5, 14.5, 2.4], ['c02_shuC', 20, 15, 2.4]]);
    await s.walkAll([['c02_pilafC', 20.5, 3, 2.4], ['c02_maiC', 21.5, 3.5, 2.4], ['c02_shuC', 20, 4, 2.4]]);
    removeAll(s, gang.map((g) => g[0]));
    s.follow();
    s.letterbox(false);
  },

  c02_gate_hint: async (s) => {
    await s.say('vegeta', 'One of Bulma\'s security shutters, guarding the prize store. Hmph. I\'ll punch through it once I\'m warmed up.', 'smirk');
    if (s.state.char('vegeta').level < 10) await s.narrate('Dark blue level gates answer only to Vegeta. This one needs level 10 - the robots in the hold make good sparring partners.');
  },

  c02_hold_vault: async (s) => {
    if (!s.check('chapter==2&c02_heist') || s.flag(SEALED) || s.flag('c02_machineBeaten')) return;
    s.letterbox(true);
    actor(s, 'c02_pilafH', 'pilaf', 33, 6, 'down', 'Pilaf');
    actor(s, 'c02_maiH', 'mai', 35, 7, 'left', 'Mai');
    actor(s, 'c02_shuH', 'shu', 32, 7, 'right', 'Shu');
    await s.pan(33, 7, 30);
    await s.talk([
      ['pilaf', 'Hurry, Shu! Crack the case! With the Dragon Balls, I\'ll wish to be ruler of the world AND a grown-up again!', 'happy'],
      ['shu', 'The lock\'s got a pink force field, Emperor Pilaf! Somebody already pulled the plug, though...'],
      ['mai', 'Emperor... behind us. It\'s the scary one with the hair.', 'shock'],
      ['vegeta', 'You three. The children Goten and Trunks fed at the buffet. I should have known.', 'angry'],
      ['pilaf', 'D-don\'t panic! We were prepared for this! Shu! Mai! Into the PILAF MACHINE!', 'shout'],
    ]);
    s.flash('#ffffff', 14);
    s.sfx('teleport');
    removeAll(s, ['c02_pilafH', 'c02_maiH', 'c02_shuH']);
    s.shake(20, 2);
    s.follow();
    s.letterbox(false);
    s.music('battle');
    await arenaFight(s, 'c02_pilafMachine', { x: 34, y: 9, uid: 'c02_machine' });
    s.letterbox(true);
    s.music('tense');
    actor(s, 'c02_pilafH', 'pilaf', 34, 9, 'down', 'Pilaf');
    actor(s, 'c02_maiH', 'mai', 35, 10, 'down', 'Mai');
    actor(s, 'c02_shuH', 'shu', 33, 10, 'down', 'Shu');
    s.pose('c02_pilafH', 'ko');
    await s.talk([
      ['pilaf', 'Our beautiful machine... the snack dispenser too...', 'hurt'],
      ['mai', 'Emperor, retreat! The lifeboat!', 'shout'],
      ['pilaf', 'This isn\'t over, spiky man! The world will be MINE! ...After a nap!', 'angry'],
    ]);
    s.pose('c02_pilafH', null);
    await s.walkAll([['c02_pilafH', 29, 9, 2.5], ['c02_maiH', 29, 8, 2.5], ['c02_shuH', 29, 9, 2.5]]);
    removeAll(s, ['c02_pilafH', 'c02_maiH', 'c02_shuH']);
    await s.narrate('Vegeta locks the seven Dragon Balls back inside the prize vault.');
    await s.say('vegeta', 'Hmph. A three-year-old\'s toy with a flamethrower. Lord Beerus had better appreciate this.', 'smirk');
    s.set('c02_machineBeaten');
    s.set('c02_mood', 3);
    await s.done('c02_thieves', false);
    s.letterbox(false);
  },

  c02_mech_phase2: async (s) => {
    await s.say('pilaf', 'Shu! Launch the drones! All of them! ...The ones that work!', 'shout');
  },

  c02_mech_phase3: async (s) => {
    await s.talk([
      ['shu', 'Emperor, the engine\'s on fire!', 'shock'],
      ['pilaf', 'Then fight FASTER!', 'angry'],
    ]);
  },

  // ---------------------------------------------------------------- pudding -> rage
  c02_buu_talk: async (s) => {
    if (s.check('chapter==2&quest:c02_pudding') && !s.flag('c02_rage')) {
      // Point of no return: the pudding standoff runs straight through Beerus's rampage into Chapter 3.
      const go = await pointOfNoReturn(s, C02_ERRANDS,
        'Confront Buu over the pudding? Things are about to get out of hand, and the party will not survive it.',
        'Not yet', 'Confront Buu');
      if (!go) { await s.say('majinBuu', 'Buu has pudding! Mmm. Buu shares with nobody!', 'happy'); return; }
      await s.call('c02_rage');
      return;
    }
    if (s.flag('c02_beerusArrived')) {
      await s.say('majinBuu', 'Buu has pudding! Mmm. Buu shares with nobody! ...Maybe Mr. Satan. Maybe.', 'happy');
      return;
    }
    await s.say('majinBuu', 'Party! Buu loves party! Cake, candy, and the jiggly yellow stuff!', 'happy');
  },

  c02_rage: async (s) => {
    s.letterbox(true);
    s.music('tense');
    const buu = actor(s, 'c02_buu', 'majinBuu', 11, 16, 'down', 'Buu');
    actor(s, 'c02_satan', 'mrSatan', 12, 17, 'left', 'Mr. Satan');
    await s.talk([
      ['vegeta', 'Buu. Give Lord Beerus one of those puddings. Now.', 'angry'],
      ['majinBuu', 'No! Buu\'s pudding! Buu saw them first!', 'angry'],
    ]);
    await s.ask('vegeta', '(Choose your words very carefully...)', ['Please, Buu. Just one.', 'I\'ll buy you a mountain of candy.', 'HAND IT OVER.']);
    await s.say('majinBuu', '...No.', 'smirk');
    const [bx, by] = tileOf(s, buu);
    s.sfx('teleport');
    actor(s, 'c02_beerus', 'beerus', bx + 1, by, 'left', 'Beerus');
    await s.talk([
      ['beerus', 'Just one. That\'s all I\'m asking.'],
      ['majinBuu', '*lick* Buu licked it. Now it\'s Buu\'s.', 'happy'],
      ['beerus', '...', 'angry'],
    ]);
    s.stopMusic();
    s.shake(30, 3);
    s.sfx('hit');
    s.flash(BEERUS_KI, 12);
    await s.walk(buu, 1, by, 6);
    s.remove(buu);
    s.boom(1, by, 20, '#f8a0c0');
    await s.narrate('A single flick sent Buu - and the last pudding - sailing over the rail and into the sea.');
    s.music('godly');
    await s.say('mrSatan', 'BUUUUU!', 'shock');
    // The party fights back, one by one.
    actor(s, 'c02_goten', 'goten', 9, 9, 'right', 'Goten');
    actor(s, 'c02_trunks', 'trunksKid', 10, 10, 'right', 'Trunks');
    await s.talk([
      ['goten', 'Hey! You hurt Buu!', 'angry'],
      ['trunksKid', 'Get him, Goten!', 'shout'],
    ]);
    await s.walkAll([['c02_goten', bx - 1, by - 1, 3], ['c02_trunks', bx - 1, by + 1, 3]]);
    await s.clash('c02_goten', 'c02_beerus', 30);
    s.boom(bx, by, 16, BEERUS_KI);
    s.pose('c02_goten', 'ko');
    s.pose('c02_trunks', 'ko');
    actor(s, 'c02_piccolo', 'piccolo', 37, 3, 'left', 'Piccolo');
    actor(s, 'c02_18', 'android18', 6, 15, 'up', 'Android 18');
    actor(s, 'c02_tien', 'tien', 31, 16, 'left', 'Tien');
    await s.say('piccolo', 'Enough. Together - now!', 'angry');
    await s.blast('c02_piccolo', 'c02_beerus', '#f8f0a0');
    await s.blast('c02_18', 'c02_beerus', '#f8f080');
    await s.blast('c02_tien', 'c02_beerus', '#f8d060');
    await s.say('beerus', 'Was that supposed to tickle?', 'smirk');
    s.flash('#ffffff', 12);
    s.boom(bx, by, 26, BEERUS_KI);
    for (const id of ['c02_piccolo', 'c02_18', 'c02_tien']) s.pose(id, 'ko');
    actor(s, 'c02_gohan', 'gohan', 24, 17, 'up', 'Gohan');
    await s.say('gohan', 'Leave them alone!', 'shout');
    await s.walk('c02_gohan', bx, by + 1, 3);
    await s.clash('c02_gohan', 'c02_beerus', 40);
    s.pose('c02_gohan', 'ko');
    await s.say('vegeta', '...You leave me no choice, Lord Beerus.', 'angry');
    await s.powerUp('hero', '#f8e048', 40);
    s.transformNow('ssj');
    s.letterbox(false);
    s.remove('c02_beerus');
    await arenaFight(s, 'c01_beerus', { x: bx + 1, y: by, uid: 'c02_beerusW', survive: 15, loseOk: true, label: 'HOLD ON' });

    s.letterbox(true);
    s.transformNow(null);
    s.pose('hero', 'ko');
    await s.say('beerus', 'Hmph. Super Saiyan. I\'ve seen better from your father.');
    actor(s, 'c02_bulma', 'bulma', 20, 4, 'down', 'Bulma');
    const [wx, wy] = tileOf(s, 'c02_beerusW');
    await s.walk('c02_bulma', wx - 1, wy, 2);
    s.face('c02_bulma', 'c02_beerusW');
    await s.say('bulma', 'HEY! You! What kind of guest ruins a girl\'s birthday party?!', 'angry');
    s.shake(14, 2);
    s.sfx('punch');
    s.flash('#ffffff', 8);
    await s.talk([
      ['beerus', '...Did you just slap me?', 'shock'],
      ['bulma', 'And I\'ll do it again!', 'angry'],
    ]);
    s.sfx('hit');
    s.flash('#ffffff', 12);
    s.pose('c02_bulma', 'ko');
    await s.narrate('Beerus slapped her back - barely a tap, for a god. Bulma crumpled to the deck.');
    await s.wait(30);
    s.pose('hero', null);
    await s.say('vegeta', '...You struck her.', 'shock');
    await s.say('vegeta', 'God of Destruction or not... NOBODY lays a hand on Bulma!!!', 'shout');
    s.music('heroic');
    await s.powerUp('hero', '#f8f080', 90);
    s.transformNow('ssj');
    s.aura('hero', '#f8f080');
    // Lightning crackles through the aura: the mark of the second level.
    for (let i = 0; i < 3; i++) {
      s.flash('#e8f4ff', 6);
      s.sfx('hit');
      s.shake(10, 2);
      await s.wait(12);
    }
    s.flash('#ffffff', 24);
    s.shake(40, 4);
    s.heal();
    await s.narrate('Rage tore through every limit Vegeta had. Lightning crackled through his golden aura: Super Saiyan 2, burning hotter than he had ever pushed it before!');
    s.letterbox(false);
    s.remove('c02_beerusW');
    const rage = await arenaFight(s, 'c02_beerusRage', { x: wx, y: wy, uid: 'c02_beerusR', loseOk: true });

    s.letterbox(true);
    s.aura('hero', null);
    s.transformNow(null);
    await s.talk([
      rage === 'lose'
        ? ['beerus', 'Hmph. All that fury, and you still fell over. Still... for a moment there, you almost worried me.', 'smirk']
        : ['beerus', '...Not bad. You actually landed a few. I\'m impressed, Vegeta. A little.', 'smirk'],
      ['beerus', 'But my appetite is ruined. This planet has bored me.', 'angry'],
    ]);
    s.sfx('hit');
    s.flash('#ffffff', 10);
    s.pose('hero', 'ko');
    s.exp(600);
    await s.wait(30);
    s.sfx('charge');
    s.flash(BEERUS_KI, 30);
    s.shake(40, 3);
    s.boom(20, 1, 30, BEERUS_KI);
    await s.narrate('Beerus\'s blast tore through the bingo stage. The prize vault below burst open, and seven orange stars streaked away across the sky.');
    await s.say('pilaf', '(from a lifeboat) The Dragon Balls! They\'re scattering! After them, you fools!', 'shout');
    await s.say('beerus', 'Now. Where were we? Ah, yes. Destroying the Earth.', 'smirk');
    s.sfx('teleport');
    s.flash('#ffffff', 16);
    const p = s.field.player;
    const gx = Math.round((p.x - 8) / TILE) + 1;
    const gy = Math.round((p.y - 14) / TILE);
    actor(s, 'c02_goku', 'goku', gx, gy, 'up', 'Goku');
    s.music('heroic');
    // Goku only buys time here; the Super Saiyan God conversation itself opens Chapter 3 (c03_start).
    await s.talk([
      ['goku', 'Hold it, Lord Beerus! Please - don\'t do anything yet!', 'shout'],
      ['vegeta', 'Ka... Kakarot...', 'hurt'],
      ['goku', 'Sorry I\'m late, Vegeta. King Kai only just stopped yelling long enough to tell me what was going on.', 'sad'],
      ['beerus', '...', 'angry'],
      ['whis', 'Ah, the young man from King Kai\'s planet. He seems to want a word with you, my lord.', 'happy'],
      ['whis', 'And the hostess mentioned a refrigerator full of pudding back at her house. Perhaps the conversation could happen there?', 'happy'],
      ['beerus', '...Pudding.'],
      ['beerus', 'Fine. Ashore. The Saiyan can talk while I eat. If I don\'t like what I hear...', 'smirk'],
    ]);
    await s.fadeOut(30);
    await s.narrate('The Princess Bulma limped back into port, and what was left of the party moved ashore to the lawn of Capsule Corporation...');
    await s.narrate('...where the refrigerator turned out to hold exactly one pudding. Lord Beerus flattened half the lawn before Bulma found it.');
    s.pose('hero', null);
    s.heal();
    s.set('c02_rage');
    s.clear('ea_buuAway');
    await s.done('c02_pudding', false);
    await s.done('c02_feast', false);
    s.unlockRegion('spot_westcity');
    s.unlockRegion('spot_kame');
    unforce(s);
    await s.fadeOut(30);
    removeAll(s, ['c02_beerusR', 'c02_goku']);
    endScene(s);
    if (s.hasScript('c03_start')) await s.call('c03_start');
  },

  c02_rage_taunt: async (s) => {
    await s.say('beerus', 'Oh? That one actually connected. Do it again.', 'smirk');
  },
});
