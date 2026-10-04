import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { battle, bossFight, forceFade, freeNear, heroTile, rememberHero, removeAll, restoreHero, stage, stageOrReuse, warpTo } from './helpers';
import { HUB } from './hubs';

/**
 * Chapter 13 — "Universe Survival" (L42→45). Zeno Expo exhibition (Goku vs Toppo), then the LoG2
 * "collection chapter": recruit the Mighty Ten through four silver sub-objectives, then the tenth warrior
 * (Frieza from Hell). Canon interludes play where the anime puts them (`c13_u6.ts`, `c13_leader.ts`): Cabba recruits
 * Caulifla on Sadala once Gohan has trained or Tien has joined (eps 88-89), Goku vs. Gohan once both are in (ep 90),
 * and Caulifla's Super Saiyan and Kale's berserk form between Goku's Frieza plan and his trip to Hell (eps 92-93).
 * Side: Monster Island's seven escaped animals (LoG2's missing Namekians), three of them in old Earth regions behind
 * coloured gates.
 */

const RECRUITS = ['c13_krillin', 'c13_tien', 'c13_gohan', 'c13_17'] as const;

/** The seven escaped animals: NPC id → display name. */
export const ANIMALS: Record<string, string> = {
  c13_ani1: 'Puffball', c13_ani2: 'Baby Dino', c13_ani3: 'Glow Moth', c13_ani4: 'Emerald Kite',
  c13_ani5: 'Cliff Bat', c13_ani6: 'Rainbow Snake', c13_ani7: 'Minotaurus Calf',
};

/** Where 17's sensors place each missing animal (three hide in old regions, behind gates only one fighter can break). */
const ANIMAL_HINTS: Record<string, string> = {
  c13_ani1: 'right here on the island\'s beach, by the tide pool',
  c13_ani2: 'in a warm valley full of dinosaurs on Highland Peak, in the Snowy Highlands. An orange barrier blocks the way in',
  c13_ani3: 'at the wrecked poacher camp',
  c13_ani4: 'out on the atoll of Turtle Reef, past Kame House. A light blue barrier closes the sandbar',
  c13_ani5: 'in a sealed cave in Dragon\'s Throat Canyon, in the Rocky Wasteland. A dark blue barrier seals it',
  c13_ani6: 'by Fortuneteller Baba\'s lake', c13_ani7: 'near a farmhouse on Mt. Paozu',
};

/** World-map spots for the chapter 13 locations, unlocked on first visit. */
const MAP_SPOTS: Record<string, [string, string]> = {
  c13_tien_dojo: ['c13_spot_dojo', 'Tien-Shin Dojo'], c13_training_wilds: ['c13_spot_wilds', 'Wilderness Plateau'], c13_baba_lake: ['c13_spot_baba', 'Baba\'s Palace'],
};

/** How many escaped animals have been beamed home. */
export function animalsFound(s: ScriptApi): number {
  return Object.keys(ANIMALS).filter((id) => s.flag(`c13_ani_${id}`)).length;
}

async function recruitCheck(s: ScriptApi): Promise<void> {
  if (s.hasScript('c13_check')) await s.call('c13_check');
}

registerScripts({
  // ================================================================ chapter start: the Zeno Expo
  c13_start: async (s) => {
    ensureChapterState(s, 13);
    unforce(s);
    await s.chapter(13, 'Universe Survival', 'The Zeno Expo');
    s.switchTo('goku');
    if (s.has('c10_zenoButton')) {
      await s.narrate('Goku turns the Zeno Button over in his hands. "Press the back to come and play," Zeno had said. So he does.');
    } else {
      await s.narrate('Goku remembers a promise: Lord Zeno wanted a tournament of all the universes. So he goes to remind him.');
    }
    await s.narrate('A few confused days later, the Grand Priest gathers every God of Destruction for an exhibition: the Zeno Expo.');
    await s.call('c13_expo');
  },

  /**
   * The Zeno Expo: Universe 7 vs Universe 9, Goku vs Toppo and the rules of the tournament, then the team
   * planning at Capsule Corp. Replayable from Beerus at Capsule Corp if the Expo was ever left mid-fight.
   */
  c13_expo: async (s) => {
    if (s.flag('c13_expoSeen')) { await s.call('c13_planning'); return; }
    if (s.hero !== 'goku') {
      await s.fadeOut(12);
      s.switchTo('goku');
    }
    await warpTo(s, 'c13_expo', 16, 16, 'up');
    s.letterbox(true);
    s.music('godly');
    // The gallery of gods.
    s.spawn('c13_zeno', 'zeno', 16, 4, 'down', 'Zeno');
    s.spawn('c13_gp', 'grandPriest', 18, 4, 'down', 'Grand Priest');
    s.spawn('c13_beerusX', 'beerus', 8, 3, 'down', 'Beerus');
    s.spawn('c13_whisX', 'whis', 9, 4, 'down', 'Whis');
    s.spawn('c13_skX', 'supremeKai', 7, 4, 'down', 'Supreme Kai');
    s.spawn('c13_champaX', 'champa', 24, 3, 'down', 'Champa');
    s.spawn('c13_vadosX', 'vados', 25, 4, 'down', 'Vados');
    // The fighters.
    s.spawn('c13_gohanX', 'gohan', 13, 16, 'up', 'Gohan');
    s.spawn('c13_buuX', 'majinBuu', 19, 16, 'up', 'Buu');
    s.spawn('c13_basilX', 'basil', 12, 11, 'down', 'Basil');
    s.spawn('c13_lavenderX', 'lavender', 16, 11, 'down', 'Lavender');
    s.spawn('c13_bergamoX', 'bergamo', 20, 11, 'down', 'Bergamo');
    await s.pan(16, 6, 40);
    await s.talk([
      ['grandPriest', 'Welcome, gods of every universe, to the Zeno Expo! Today Universe 7 and Universe 9 will give us a preview of the grand tournament.', 'happy'],
      ['zeno', 'Fight, fight! It\'ll be fun!', 'happy'],
      ['beerus', '(Goku... what have you DONE?)', 'angry'],
    ]);
    s.follow();
    await s.narrate('Round one: Buu versus Basil.');
    await s.walkAll([['c13_buuX', 15, 13, 1.5], ['c13_basilX', 14, 12, 1.5]]);
    await s.clash('c13_buuX', 'c13_basilX', 60);
    await s.walk('c13_basilX', 4, 10, 4);
    s.remove('c13_basilX');
    await s.say('majinBuu', 'Buu win! Buu want candy now.', 'happy');
    await s.walk('c13_buuX', 19, 16, 1.5);
    await s.narrate('Round two: Gohan versus Lavender. Lavender\'s poison blinds Gohan, but Gohan fights on by feel...');
    await s.walkAll([['c13_gohanX', 15, 13, 1.5], ['c13_lavenderX', 16, 12, 1.5]]);
    await s.blast('c13_lavenderX', 'c13_gohanX', '#a050e0');
    await s.clash('c13_gohanX', 'c13_lavenderX', 60);
    s.pose('c13_gohanX', 'ko');
    s.pose('c13_lavenderX', 'ko');
    await s.narrate('Both fighters collapse at the same moment. A draw!');
    s.remove('c13_lavenderX');
    s.pose('c13_gohanX', null);
    s.place('c13_gohanX', 13, 16, 'up');
    await s.narrate('Final round: Goku versus Bergamo.');
    await s.walk('c13_bergamoX', 16, 13, 1);
    await s.talk([
      ['bergamo', 'Gods of all universes, hear me! This man is the reason this deadly tournament exists! He asked Zeno for it!', 'shout'],
      ['bergamo', 'I propose a deal: if I win, Universe 9 is spared from the tournament!', 'smirk'],
      ['goku', 'Huh? But... there\'s no erasing. Right? It\'s just for fun... right?', 'shock'],
      ['grandPriest', 'Oh, there will most certainly be erasing.', 'happy'],
    ]);
    s.sprite('hero', 'gokuSSB');
    s.aura('hero', '#f83838');
    await s.powerUp('hero', '#f83838', 40);
    await s.clash('hero', 'c13_bergamoX', 70);
    await s.walk('c13_bergamoX', 28, 13, 4);
    s.remove('c13_bergamoX');
    s.aura('hero', null);
    s.sprite('hero', 'goku');
    await s.narrate('Bergamo is knocked clean out of the ring!');
    // Toppo cuts in.
    s.spawn('c13_toppoX', 'toppo', 22, 4, 'down', 'Toppo');
    s.sfx('dash');
    await s.walk('c13_toppoX', 18, 12, 4);
    await s.talk([
      ['toppo', 'Halt! I am Toppo, leader of Universe 11\'s Pride Troopers. A man who starts a war for fun is no hero.', 'angry'],
      ['toppo', 'In the name of justice, I will judge you myself!', 'shout'],
      ['goku', 'Ooh, you\'re strong! Okay, let\'s go!', 'happy'],
    ]);
    s.letterbox(false);
    s.music('boss');
    const [tx, ty] = freeNear(s, 18, 12);
    s.remove('c13_toppoX');
    await bossFight(s, 'c13_toppo', { x: tx, y: ty, uid: 'c13_toppo1' });
    s.letterbox(true);
    await s.talk([
      ['grandPriest', 'That will do! Save it for the real thing.', 'neutral'],
      ['toppo', 'Hmph. Know this, Son Goku: our Jiren is far stronger than I am.', 'smirk'],
    ]);
    removeAll(s, 'c13_toppo1');
    s.music('tense');
    await s.talk([
      ['grandPriest', 'Now, the rules of the Tournament of Power. Eight universes. Ten warriors each. A battle royale lasting forty-eight minutes.', 'neutral'],
      ['grandPriest', 'Knock opponents off the stage to eliminate them. No killing. No weapons. No flying, unless you have wings.', 'neutral'],
      ['grandPriest', 'The last universe standing wins the Super Dragon Balls. Every universe that loses will be erased. Along with its gods.', 'happy'],
      ['zeno', 'Erase, erase! Hehe!', 'happy'],
      ['beerus', 'GOKUUU!!', 'shout'],
    ]);
    removeAll(s, 'c13_zeno', 'c13_gp', 'c13_beerusX', 'c13_whisX', 'c13_skX', 'c13_champaX', 'c13_vadosX', 'c13_gohanX', 'c13_buuX');
    s.letterbox(false);
    s.set('c13_expoSeen');
    await s.call('c13_planning');
  },

  /** Team planning at Capsule Corp: Bulla is born, the Mighty Ten are drafted and the recruitment quests open. */
  c13_planning: async (s) => {
    if (s.check('quest:c13_team') || s.check('done:c13_team')) return;
    await s.narrate('Back on Earth. That same week, Bulma gives birth to a baby girl: Bulla. Vegeta refuses to leave her side.');
    await warpTo(s, HUB.cc.map, HUB.cc.arrive[0], HUB.cc.arrive[1], 'up');
    s.set('world', 'earth');
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    // Bulma and Vegeta live in the yard from Chapter 12 on (overlay NPCs); stand-ins only if they are missing.
    const tempBulma = stageOrReuse(s, 'act5_bulma', 'bulma', hx - 2, hy - 1, 'right', 'Bulma');
    const tempVegeta = stageOrReuse(s, 'act5_vegeta', 'vegetaCasual', hx - 3, hy - 1, 'right', 'Vegeta');
    stage(s, 'c13_gohanC', 'gohan', hx + 2, hy - 1, 'left', 'Gohan');
    await s.walkAll([['act5_bulma', hx - 2, hy - 1, 1.5], ['act5_vegeta', hx - 3, hy - 1, 1.5]]);
    s.face('act5_bulma', 'hero');
    s.face('act5_vegeta', 'hero');
    await s.talk([
      ['gohan', 'Ten fighters. You, me, Vegeta, Piccolo and Buu... we need five more, Dad.', 'neutral'],
      ['goku', 'Krillin! And 18! And Tien, and Master Roshi... and Android 17! He\'s super strong.', 'happy'],
      ['gohan', 'Nobody\'s seen 17 in years. Dende can sense him from the Lookout... Dende says he\'s a park ranger on Monster Island!'],
      ['goku', 'I\'ll tell everyone there\'s prize money. Ten million zeni each! Bulma will pay.', 'happy'],
      ['bulma', 'I\'ll WHAT?!', 'angry'],
      ['vegetaCasual', 'Just make sure they\'re not dead weight, Kakarot. I am not losing my daughter\'s universe to your recruiting.', 'angry'],
      ['bulma', '...Fine. But if you lose, I\'m charging Beerus.', 'smirk'],
    ]);
    removeAll(s, 'c13_gohanC');
    if (tempBulma) removeAll(s, 'act5_bulma'); else s.place('act5_bulma', HUB.cc.bulma[0], HUB.cc.bulma[1], 'down');
    if (tempVegeta) removeAll(s, 'act5_vegeta'); else s.place('act5_vegeta', HUB.cc.vegeta[0], HUB.cc.vegeta[1], 'right');
    s.unlockRegion('spot_monster');
    await s.give('c13_contract');
    await s.narrate('Monster Island is now on the world map.');
    await s.quest('c13_team', true);
    for (const q of RECRUITS) await s.quest(q, true);
    await s.narrate('Journal updated! Recruit Krillin and 18 (Satan City), Tien and Roshi (ask at Kame House), train Gohan (the Lookout) and find Android 17 (Monster Island), in any order.');
    s.letterbox(false);
  },

  c13_toppo_p2: async (s) => {
    await s.say('toppo', 'Justice... RUSH!', 'shout');
  },

  /**
   * After each recruit: Universe 6's recruiting cutaway once Gohan has trained or Tien has joined (eps 88-89), Goku
   * vs. Gohan once both are in (ep 90), then the progress count; all four → Buu falls asleep → the tenth warrior.
   */
  c13_check: async (s) => {
    if (s.state.data.chapter !== 13) return;
    const tien = s.check('done:c13_tien');
    const gohan = s.check('done:c13_gohan');
    // Cabba is played through Vegeta's moves (Vegeta is always in the party by now).
    if ((tien || gohan) && !s.check('done:c13_u6') && s.state.char('vegeta').joined && s.hasScript('c13_u6_recruit')) {
      await s.call('c13_u6_recruit');
    }
    if (tien && gohan && !s.check('done:c13_leader') && s.hasScript('c13_leader_start')) {
      await s.call('c13_leader_start');
    }
    const n = RECRUITS.filter((q) => s.check(`done:${q}`)).length;
    if (n < 4) {
      const fighters = 5 + (s.check('done:c13_krillin') ? 2 : 0) + (s.check('done:c13_tien') ? 2 : 0) + (s.check('done:c13_17') ? 1 : 0);
      const lead = s.check('done:c13_leader') ? ' Gohan is back at full strength, and Goku wants him to lead the team.'
        : gohan ? ' Gohan is back at full strength.' : ' Gohan still needs to train with Piccolo.';
      await s.narrate(`The Mighty Ten: ${fighters} of 10 fighters signed up.${lead}`);
      return;
    }
    if (s.flag('c13_friezaIntro')) return;
    s.set('c13_friezaIntro');
    await s.narrate('Nine fighters. Then a call comes from the Satan Mansion: Buu has fallen into his months-long hibernation. Nothing will wake him.');
    await s.talk([
      ['goku', 'Buu\'s asleep?! We need a tenth fighter. Somebody really strong...', 'shock'],
      ['goku', '...Oh! I know exactly who!', 'happy'],
      ['gohan', 'Dad, please tell me you\'re not thinking what I think you\'re thinking.', 'shock'],
    ]);
    await s.quest('c13_frieza');
  },

  // ================================================================ Krillin & 18 (Satan City)
  c13_krillin_talk: async (s) => {
    if (s.check('done:c13_krillin')) {
      await s.say('krillin', 'Ten million zeni... 18 already spent it in her head. Twice.', 'happy');
      return;
    }
    if (!s.check('quest:c13_krillin')) {
      await s.say('krillin', 'Officer Krillin, Satan City Police! Nothing to see here, citizen!', 'happy');
      return;
    }
    s.letterbox(true);
    await s.talk([
      ['hero', 'Krillin! There\'s a tournament between universes. We need you on the team!'],
      ['krillin', 'Me? I\'m a cop now. I haven\'t trained seriously in years. I\'d just slow you down.', 'sad'],
      ['hero', 'Then let\'s find out! Spar with me, right here, right now!', 'smirk'],
      ['krillin', '...Fine! But no Super Saiyan stuff right away. I mean it!', 'shock'],
    ]);
    s.letterbox(false);
    const [hx, hy] = heroTile(s);
    const [kx, ky] = freeNear(s, hx, hy - 3);
    removeAll(s, 'c13_krillinP');
    s.music('battle');
    await bossFight(s, 'c13_krillin', { x: kx, y: ky, uid: 'c13_krillin1' });
    removeAll(s, 'c13_krillin1');
    s.letterbox(true);
    stage(s, 'c13_krillinS', 'krillin', kx, ky, 'down', 'Krillin');
    if (!s.exists('c13_18P')) stage(s, 'c13_18S', 'android18', hx + 2, hy, 'left', 'Android 18');
    await s.talk([
      ['krillin', 'Hah... hah... Okay, I\'m rusty, but I\'ve still got a few tricks!', 'happy'],
      ['android18', 'This tournament. Is there prize money?', 'neutral'],
      ['hero', 'Ten million zeni each! Bulma\'s paying.'],
      ['android18', 'Then we\'re in. Both of us. Krillin, start stretching.', 'smirk'],
      ['krillin', 'Yes, dear.', 'sad'],
    ]);
    removeAll(s, 'c13_krillinS', 'c13_18S');
    s.music(s.field.def.music);
    s.letterbox(false);
    await s.done('c13_krillin', false);
    await s.give('str3');
    await recruitCheck(s);
  },
  c13_krillin_p2: async (s) => {
    await s.say('krillin', 'Solar Flare! ...Wait, that\'s not how it works in a spar. Destructo Disc, then!', 'shout');
  },
  c13_18_talk: async (s) => {
    if (s.check('done:c13_krillin')) { await s.say('android18', 'Ten million. Each. In cash. Tell Bulma.', 'smirk'); return; }
    await s.say('android18', 'Talk to Krillin. If it involves money, then talk to me.', 'neutral');
  },

  // ================================================================ Tien & Roshi (Tien's dojo)
  c13_chiaotzu_talk: async (s) => {
    if (s.check('done:c13_tien')) { await s.say('chiaotzu', 'Tien says the prize money will fix the village roof!', 'happy'); return; }
    if (!s.check('quest:c13_tien')) { await s.say('chiaotzu', 'Master Roshi\'s turtle says hi.', 'happy'); return; }
    await s.talk([
      ['chiaotzu', '{hero}! Something\'s wrong at Tien\'s dojo! His students stopped answering, and Tien hasn\'t called in three days!', 'shock'],
      ['roshi', 'Trouble at a dojo, eh? I\'d better come along. For Tien\'s sake. Not because I heard the new instructor is a pretty lady.', 'smirk'],
      ['chiaotzu', 'I\'ll take you both there. Hold on!'],
    ]);
    await s.narrate('Chiaotzu\'s telekinesis whisks you and Master Roshi to the Tien-Shin Dojo in the mountains. Roshi hurries on ahead...');
    await warpTo(s, 'c13_tien_dojo', 18, 23, 'up');
  },

  c13_dojo_event: async (s) => {
    if (s.check('done:c13_tien')) return;
    s.letterbox(true);
    s.music('tense');
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_tienE', 'tien', hx - 1, hy + 1, 'up', 'Tien');
    stage(s, 'c13_chiaotzuE', 'chiaotzu', hx + 1, hy + 1, 'up', 'Chiaotzu');
    stage(s, 'c13_yurinE', 'c13_yurin', 18, 8, 'down', 'Yurin');
    stage(s, 'c13_roshiE', 'c13_roshiMax', 16, 9, 'down', 'Master Roshi');
    await s.pan(17, 10, 30);
    await s.talk([
      ['chiaotzu', 'Tien! You\'re all right!', 'happy'],
      ['tien', '{hero}. Chiaotzu. You came. My students have turned on me. And Master Roshi walked straight up to that woman and...', 'angry'],
      ['c13_yurin', 'Tien Shinhan. Do you remember Yurin? The girl you laughed out of the Crane School?', 'smirk'],
      ['tien', '...Yurin?', 'shock'],
      ['c13_yurin', 'I learned a new art since then. Mind control. Your students are mine. And so is your precious old master.', 'smirk'],
      ['c13_roshiMax', '...Must... obey... the pretty lady...', 'angry'],
      ['hero', 'Master Roshi?! He\'s so... muscly!', 'shock'],
    ]);
    s.follow();
    s.letterbox(false);
    s.music('battle');
    s.spawnEnemy('c13_student', 11, 11);
    s.spawnEnemy('c13_student', 24, 11);
    s.spawnEnemy('c13_studentB', 13, 16);
    s.spawnEnemy('c13_studentB', 23, 16);
    await battle(s);
    s.letterbox(true);
    await s.talk([
      ['c13_yurin', 'Useless children. Master Roshi, MAXIMUM POWER!', 'angry'],
      ['tien', 'Careful! Even brainwashed, the old man is a monster at full power!', 'shout'],
    ]);
    s.letterbox(false);
    const [rx, ry] = freeNear(s, 17, 12);
    s.remove('c13_roshiE');
    await bossFight(s, 'c13_roshiMax', { x: rx, y: ry, uid: 'c13_roshi1' });
    removeAll(s, 'c13_roshi1');
    s.letterbox(true);
    stage(s, 'c13_roshiOld', 'roshi', rx, ry, 'down', 'Master Roshi');
    s.pose('c13_roshiOld', 'ko');
    if (s.exists('c13_yurinE')) await s.blast('hero', 'c13_yurinE', '#f8f070');
    s.flash('#ffffff', 10);
    s.pose('c13_roshiOld', null);
    await s.talk([
      ['c13_yurin', 'My spell! You broke the charm!', 'shock'],
      ['roshi', 'Ow, ow, my back... Why am I in my underwear in the mountains?', 'hurt'],
      ['tien', 'Yurin. When we were young, I was cruel to you. I\'m sorry. If you want to learn real martial arts, this dojo\'s doors are open.', 'sad'],
      ['c13_yurin', '...You\'re different now. Fine. But I\'m not calling you "master".', 'smirk'],
      ['hero', 'So, Tien... about that tournament. There\'s ten million zeni of prize money.'],
      ['tien', 'The village needs repairs after all this. I\'m in.', 'neutral'],
      ['roshi', 'Ten million?! Count me in too! A man my age has expenses! Magazines are not cheap!', 'happy'],
    ]);
    removeAll(s, 'c13_tienE', 'c13_chiaotzuE', 'c13_yurinE', 'c13_roshiOld');
    s.music('peaceful');
    s.letterbox(false);
    await s.done('c13_tien', false);
    await s.give('end3');
    await recruitCheck(s);
  },
  c13_roshi_p2: async (s) => {
    await s.say('c13_roshiMax', 'Kame... hame... HAAA!', 'shout');
  },
  c13_tien_talk: async (s) => {
    await s.say('tien', 'I\'ll be ready for the tournament. Discipline is its own reward. The ten million helps too.', 'neutral');
  },
  c13_chiaotzu_dojo: async (s) => {
    await s.say('chiaotzu', 'Yurin teaches the beginners now. She\'s really strict! Everyone\'s terrified. It\'s great!', 'happy');
  },
  c13_yurin_talk: async (s) => {
    await s.say('c13_yurin', 'Don\'t think this means I forgive him. I simply have nowhere better to be.', 'smirk');
  },
  c13_student_talk: async (s) => {
    const lines = ['I had the strangest dream. A lady told me to kick my own teacher.', 'Hyah! Hyah! ...Sorry, morning drills.', 'Master Tien says we\'re fighting in a tournament for the universe. We\'re not. He is.'];
    await s.say('c13_student', lines[s.inc('c13_studentTalks') % lines.length]);
  },

  // ================================================================ Gohan's ultimate training (Lookout)
  c13_piccolo_talk: async (s) => {
    if (s.check('done:c13_gohan')) { await s.say('piccolo', 'Gohan is finally himself again. Don\'t tell him I said I\'m proud.', 'smirk'); return; }
    if (!s.check('quest:c13_gohan')) { await s.say('piccolo', '...I\'m meditating. Go away.', 'neutral'); return; }
    rememberHero(s, 'gohanTrain');
    await forceFade(s, 'gohan');
    s.letterbox(true);
    await s.talk([
      ['piccolo', 'Gohan. You\'ve gone soft. Your power is a shadow of what it was against Buu.', 'angry'],
      ['gohan', 'I know, Mr. Piccolo. I\'ve been studying... and being a dad. But this time, I want to protect everyone myself.', 'sad'],
      ['piccolo', 'Then we train. Not here. Somewhere you can\'t hold back.', 'smirk'],
    ]);
    s.letterbox(false);
    await warpTo(s, 'c13_training_wilds', 18, 15, 'up');
    s.letterbox(true);
    stage(s, 'c13_piccoloW', 'piccolo', 18, 10, 'down', 'Piccolo');
    await s.talk([
      ['piccolo', 'Off come the weights.', 'neutral'],
    ]);
    s.sprite('c13_piccoloW', 'piccoloUnweighted');
    s.boom(18, 10, 10, '#c0c0c0');
    await s.talk([
      ['piccolo', 'Come at me with everything. If you hold back, I will put you in the hospital.', 'angry'],
      ['gohan', 'Here I go!', 'shout'],
    ]);
    s.letterbox(false);
    s.music('battle');
    s.remove('c13_piccoloW');
    await bossFight(s, 'c13_piccolo', { x: 18, y: 10, uid: 'c13_piccolo1' });
    removeAll(s, 'c13_piccolo1');
    s.letterbox(true);
    stage(s, 'c13_piccoloW2', 'piccoloUnweighted', 18, 10, 'down', 'Piccolo');
    await s.talk([
      ['gohan', 'That feeling... the power Elder Kai drew out of me. It\'s still in there. I just have to stop being afraid of it.', 'neutral'],
    ]);
    await s.powerUp('hero', '#f0f0ff', 70);
    await s.setForm('gohan', 'ultimate');
    s.transformNow('ultimate');
    await s.talk([
      ['piccolo', '...There it is. The Gohan I remember.', 'smirk'],
      ['gohan', 'Dad\'s been showing me his Kamehameha again, too. I think I finally have it down.', 'happy'],
    ]);
    await s.learn('gohan', 'kamehameha');
    await s.talk([
      ['piccolo', 'And I\'ve been working on something. Watch.', 'smirk'],
    ]);
    for (let i = 0; i < 4; i++) {
      s.boom(14 + i * 2, 6 + (i % 2), 12, '#f8e070');
      await s.wait(6);
    }
    await s.learn('piccolo', 'hellzoneGrenade');
    s.transformNow(null);
    removeAll(s, 'c13_piccoloW2');
    s.letterbox(false);
    await s.done('c13_gohan', false);
    await s.give('pow3');
    unforce(s);
    restoreHero(s, 'gohanTrain');
    await recruitCheck(s);
  },
  /** Gohan's training as seen from Piccolo: Gohan asks for it, then the scene plays as Gohan facing Piccolo. */
  c13_gohanL_talk: async (s) => {
    if (!s.check('quest:c13_gohan')) { await s.say('c13_gohanL', 'Mr. Piccolo! Thanks for everything.', 'happy'); return; }
    await s.talk([
      ['c13_gohanL', 'Mr. Piccolo... I need your help. If Universe 7 loses, everyone disappears. Pan, Videl... everyone.', 'sad'],
      ['hero', 'Then stop talking and get ready. We train now.', 'neutral'],
    ]);
    rememberHero(s, 'gohanTrain');
    await s.fadeOut(12);
    const [px, py] = heroTile(s);
    s.remove('c13_gohanL');
    stage(s, 'c13_piccoloL', 'piccolo', px, py, 'right', 'Piccolo');
    force(s, 'gohan');
    s.place('hero', HUB.lookout.piccolo[0], HUB.lookout.piccolo[1], 'left');
    await s.fadeIn(12);
    await s.call('c13_piccolo_talk');
  },
  c13_piccolo_p2: async (s) => {
    await s.say('piccolo', 'Better! Now dodge THIS!', 'shout');
  },
  c13_dende_talk: async (s) => {
    if (s.flag('post_game')) { await s.say('dende', 'I can sense every universe again. Thank you, {hero}. Thank Android 17 too, if he\'ll let you.', 'happy'); return; }
    if (s.check('chapter>=14')) { await s.say('dende', 'I can\'t sense the World of Void from here... All we can do is believe in them.', 'sad'); return; }
    if (s.check('done:c13_17')) { await s.say('dende', 'Android 17 joined? Wonderful! I\'d keep an eye on Monster Island while he\'s away, but Goten and Trunks volunteered. ...Oh dear.', 'happy'); return; }
    if (s.check('chapter>=13')) { await s.say('dende', 'Android 17 is on Monster Island, far to the north-east. He\'s protecting the animals there.', 'neutral'); return; }
    await s.say('dende', 'The Earth is peaceful today. I like days like this.', 'happy');
  },

  // ================================================================ Android 17 (Monster Island)
  /** Unlock the world-map spot of a chapter 13 location on its first visit. */
  c13_spot_enter: async (s) => {
    const spot = MAP_SPOTS[s.field.def.id];
    if (!spot || s.state.data.regions.includes(spot[0])) return;
    s.unlockRegion(spot[0]);
    s.toast(`${spot[1]} added to the world map`);
  },

  c13_beach_enter: async (s) => {
    if (s.check('quest:c13_17') && !s.flag('c13_beachIntro')) {
      s.set('c13_beachIntro');
      await s.narrate('Monster Island: a protected wildlife reserve. Somewhere inside, a ranger keeps the poachers away. The ranger station lies east of the jungle.');
    }
  },

  c13_17_talk: async (s) => {
    if (s.flag('post_game') && s.check('char:satan')) {
      await s.say('android17', 'The World Champion. On my island. Don\'t touch the animals and don\'t pose at them. They spook.', 'smirk');
      return;
    }
    // Recruitment (Chapter 13): meet him, clear the poacher camp, then win his spar at the camp.
    if (s.check('quest:c13_17') && !s.flag('c13_17met')) {
      s.set('c13_17met');
      await s.talk([
        ['android17', 'Who... {hero}? What are you doing on my island? You\'re scaring the Minotaurus.', 'neutral'],
        ['hero', '17! There\'s a tournament between universes. We need you on the team!'],
        ['android17', 'No. Poachers are after this island\'s animals. I don\'t leave my post.', 'neutral'],
        ['hero', 'Then let me help you get rid of them!'],
        ['android17', '...Their camp is north of the jungle, where their ship came down. If you\'re serious, clear them out. I\'ll be right behind you.', 'smirk'],
      ]);
      return;
    }
    if (s.check('quest:c13_17') && !s.flag('c13_bossDone')) {
      await s.say('android17', 'The poacher camp is through the jungle, to the north. Go.', 'neutral');
      return;
    }
    if (s.check('quest:c13_17') && !s.flag('c13_17Joined')) {
      await s.say('android17', 'You still want me for that tournament? Then meet me back at the poacher camp and show me you\'re worth it.', 'smirk');
      return;
    }
    // The seven escaped animals: reward once all are home.
    const n = animalsFound(s);
    if (s.flag('c13_animalsLoose') && n >= 7 && !s.flag('c13_animalsDone')) {
      s.set('c13_animalsDone');
      await s.talk([
        ['android17', 'All seven, back home. The Minotaurus calf even remembered me.', 'happy'],
        ['android17', 'You did a ranger\'s job. Take these. Poachers keep leaving them behind.', 'smirk'],
      ]);
      await s.done('c13_animals', false);
      await s.give('pow3');
      await s.give('end3');
      await s.give('senzu');
      if (!s.flag('post_game')) return;
    }
    if (s.flag('post_game') && s.flag('c13_animalsDone') && !s.check('quest:post_jiren') && !s.check('done:post_jiren')) {
      await s.talk([
        ['android17', 'One more thing. A message came through the Grand Priest. Jiren wants a rematch. At Zeno\'s palace. No ring, no clock.', 'neutral'],
        ['android17', 'He asked for whoever beat the poachers. Don\'t make me regret recommending you.', 'smirk'],
      ]);
      await s.quest('post_jiren');
      return;
    }
    // Where the story is (the post-game and tournament lines come before the animal count, which follows them).
    let line = 'Ranger business. Move along.';
    if (s.flag('post_game')) {
      line = s.inc('c13_17PostTalks') % 2 === 1
        ? 'Last one standing in a universe battle royale. I just wanted a boat.'
        : 'My cruise ship wish was obviously a joke. Obviously. ...The animals would have hated it.';
    } else if (s.check('chapter>=14')) {
      line = 'Tournament day. Goten and Trunks are "watching the island". I\'ve made my peace with that. Mostly.';
    } else if (s.flag('c13_17Joined')) {
      line = s.flag('c13_animalsDone') ? 'Seven out of seven. Not bad, for a Saiyan.' : 'I\'ll be at Capsule Corp when Beerus calls. Until then, this island still needs its ranger.';
    }
    await s.say('android17', line, 'smirk');
    if (s.flag('c13_animalsLoose') && n < 7) {
      await s.say('android17', `${n} of 7 animals are back. The rest are out there somewhere, scared. Use the Ranger Beacon on them.`, 'neutral');
      const missing = Object.keys(ANIMALS).find((id) => !s.flag(`c13_ani_${id}`));
      if (missing) await s.say('android17', `My tracker picked up the ${ANIMALS[missing]}: ${ANIMAL_HINTS[missing]}.`, 'neutral');
    }
  },

  /**
   * The poacher camp (trigger, not `once`): the Poacher Boss, then 17's spar. Each half is skipped once won, so an
   * interrupted visit picks up where it stopped when the player crosses the trigger again.
   */
  c13_camp_boss: async (s) => {
    if (s.flag('c13_17Joined') || !s.check('quest:c13_17')) return;
    s.set('c13_17met');
    s.letterbox(true);
    s.music('tense');
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_17C', 'android17', hx + 1, hy + 1, 'up', 'Android 17');
    if (!s.flag('c13_bossDone')) {
      stage(s, 'c13_bossC', 'c13_poacherBoss', 20, 7, 'down', 'Poacher Boss');
      await s.talk([
        ['c13_poacherBoss', 'The ranger. And he brought a friend. You two are bad for business.', 'smirk'],
        ['android17', 'You\'re standing on a protected reserve. Leave the animals and leave the planet.', 'neutral'],
        ['c13_poacherBoss', 'Every one of those beasts sells for a fortune across the galaxy. Boys! Snare them both!', 'angry'],
      ]);
      s.letterbox(false);
      s.music('boss');
      const [bx, by] = freeNear(s, 20, 8);
      s.remove('c13_bossC');
      // He breaks off at a quarter of his health (scripted end) and runs for his ship.
      await bossFight(s, 'c13_poacherBoss', { x: bx, y: by, uid: 'c13_poacherBoss1' });
      s.letterbox(true);
      if (!s.exists('c13_poacherBoss1')) stage(s, 'c13_poacherBoss1', 'c13_poacherBoss', bx, by, 'down', 'Poacher Boss');
      for (const e of s.field.enemies) if (!e.uid && !e.dead && e.def.id.startsWith('c13_poacher')) e.dead = true;
      await s.say('c13_poacherBoss', 'Enough! Keep your stinking animals - I\'m out of here! Boys, to the ship!', 'shock');
      await s.walk('c13_poacherBoss1', 20, 5, 3);
      s.remove('c13_poacherBoss1');
      await s.narrate('The Poacher Boss scrambles aboard his ship! The engines roar...');
      s.shake(30, 2);
      // An unseen target on the hull for 17's shot.
      s.spawn('c13_shipT', 'c13_poacherBoss', 19, 3);
      s.show('c13_shipT', false);
      if (s.exists('c13_17C')) await s.blast('c13_17C', 'c13_shipT', '#60e0a0');
      s.remove('c13_shipT');
      s.boom(20, 4, 26, '#f8a030');
      s.boom(18, 3, 18, '#f8e070');
      await s.talk([
        ['android17', 'Not on my island. ...The ship\'s down. But its cargo hold broke open...', 'neutral'],
      ]);
      await s.narrate('Seven rare animals burst out of the hold and scatter in every direction - across the island and far beyond!');
      s.set('c13_poachersGone');
      s.set('c13_bossDone');
      s.set('c13_animalsLoose');
      await s.talk([
        ['android17', 'Great. Take this Ranger Beacon. If you find any of them, calm them down with it and it\'ll beam them home.', 'neutral'],
      ]);
      await s.give('c13_beacon');
      await s.quest('c13_animals');
      await s.talk([
        ['android17', 'And now... you wanted me for your tournament. Fine. Show me you\'re worth it.', 'smirk'],
        ['hero', 'Heh. I was hoping you\'d say that!', 'happy'],
      ]);
    } else {
      await s.talk([
        ['android17', 'You came back. So you still want me for your tournament. Fine. Show me you\'re worth it.', 'smirk'],
        ['hero', 'Heh. I was hoping you\'d say that!', 'happy'],
      ]);
    }
    s.letterbox(false);
    const [sx, sy] = freeNear(s, hx + 1, hy - 2);
    removeAll(s, 'c13_17C');
    s.music('battle');
    await bossFight(s, 'c13_17spar', { x: sx, y: sy, uid: 'c13_17spar1' });
    removeAll(s, 'c13_17spar1');
    s.letterbox(true);
    stage(s, 'c13_17D', 'android17', sx, sy, 'down', 'Android 17');
    await s.talk([
      ['android17', 'You\'re ridiculous, you know that? ...Alright. I\'ll fight. Goten and Trunks can watch the island.', 'smirk'],
      ['android17', 'And if we win the Super Dragon Balls, I get a wish. A cruise ship. For the family.', 'neutral'],
      ['hero', 'Deal! Welcome to the team, 17!', 'happy'],
    ]);
    removeAll(s, 'c13_17D');
    s.set('c13_17Joined');
    s.music(s.field.def.music);
    s.letterbox(false);
    await s.done('c13_17', false);
    await s.give('str3');
    await recruitCheck(s);
  },
  c13_poacher_p2: async (s) => {
    await s.say('c13_poacherBoss', 'Release the backup! Nobody gets paid if they win!', 'shout');
  },
  c13_17_p2: async (s) => {
    await s.say('android17', 'Barrier. Try punching through that.', 'smirk');
  },

  c13_minotaurus_talk: async (s) => {
    await s.narrate(s.flag('c13_animalsDone') ? 'The Minotaurus snorts happily. Its calf is curled up beside it.' : 'The Minotaurus snorts nervously and paws the ground. It seems to be looking for something.');
  },

  /** Any of the seven escaped animals. */
  c13_animal_talk: async (s) => {
    const id = s.npc?.def.id ?? '';
    const name = ANIMALS[id] ?? 'strange animal';
    if (!s.has('c13_beacon')) {
      await s.narrate(`A frightened ${name}. It doesn't look like it belongs here.`);
      return;
    }
    if (id && ANIMALS[id]) {
      s.set(`c13_ani_${id}`);
      removeAll(s, id);
    }
    s.sfx('teleport');
    await s.narrate(`You calm the ${name} with the Ranger Beacon. A soft green light beams it back to Monster Island! (${animalsFound(s)}/7)`);
  },

  c13_babysit_talk: async (s) => {
    const lines = [
      'We\'re watching the island while 17 is away! The dinosaurs are SO cool!',
      'Marron keeps naming all the animals. That raptor is "Mr. Fluffy" now.',
      'If poachers come back, we\'ll go Super Saiyan on them! ...Then fuse. Then go Super Saiyan again.',
    ];
    await s.say(s.npc?.def.id === 'c13_trunksK' ? 'trunksKid' : 'goten', lines[s.inc('c13_babysitTalks') % lines.length], 'happy');
  },
  c13_marron_talk: async (s) => {
    await s.say('c13_marron', 'Uncle 17 says I can feed the Minotaurus when I\'m bigger! I\'m already bigger than yesterday!', 'happy');
  },

  // ================================================================ The tenth warrior (Frieza)
  /** Called from Beerus at Capsule Corp while 'c13_frieza' is active (Whis is staged beside him). */
  c13_whis_frieza: async (s) => {
    // It is Goku's terrible idea, so Goku pitches it (and goes to Hell for it).
    rememberHero(s, 'frieza');
    await forceFade(s, 'goku');
    s.letterbox(true);
    await s.talk([
      ['goku', 'Lord Beerus! Buu fell asleep and we need a tenth fighter. So I was thinking... Frieza!', 'happy'],
      ['beerus', 'You want to put FRIEZA on Universe 7\'s team. The tyrant who blew up your home planet. Twice.', 'shock'],
      ['whis', 'Ohoho. Strategically, it is not the worst idea. He is very strong now, and very, very motivated.', 'happy'],
      ['beerus', '...If he betrays us, I\'m destroying him and then YOU. Go.', 'angry'],
      ['whis', 'King Yemma will want paperwork. I will tell him you said please.', 'smirk'],
    ]);
    // Eps 92-93 cut from Goku's plan to Universe 6, where Cabba is training his new recruits, and back to Goku in Hell.
    const cutaway = !s.check('done:c13_u6kale') && s.hasScript('c13_u6_episode');
    if (cutaway) {
      await s.talk([
        ['whis', 'Speaking of recruiting... my sister Vados tells me Universe 6 has found itself some new Saiyans. Young ones.', 'smirk'],
        ['goku', 'More Saiyans?! Aw, now I REALLY can\'t wait for the tournament!', 'happy'],
        ['beerus', 'Go to Hell, Goku. I mean that literally. GO.', 'angry'],
      ]);
    }
    removeAll(s, 'act5_whisT');
    if (cutaway) {
      s.letterbox(false);
      await s.call('c13_u6_episode');
      await s.narrate('Back in Universe 7, Goku presents himself at King Yemma\'s check-in desk. After some fast talking, he is allowed one visit to Hell.');
    } else {
      s.letterbox(false);
      await s.narrate('After some fast talking at King Yemma\'s check-in desk, Goku is allowed one visit to Hell.');
    }
    await s.call('c13_hell_scene');
  },

  c13_hell_scene: async (s) => {
    await warpTo(s, HUB.hell.map, HUB.hell.island[0], HUB.hell.island[1], 'up');
    s.letterbox(true);
    s.music('frieza');
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_friezaH', 'frieza', hx + 2, hy, 'left', 'Frieza');
    s.flash('#f8d040', 12);
    await s.talk([
      ['frieza', 'Well, well. Son Goku. Come to gloat, or did you finally die of stupidity?', 'smirk'],
      ['goku', 'Neither! There\'s a tournament. If Universe 7 loses, everything gets erased. Fight on our team, Frieza.', 'neutral'],
      ['frieza', 'And what would I get for saving your precious universe?', 'smirk'],
      ['goku', 'You\'d get to live again.', 'neutral'],
      ['frieza', '...Ohohoho. You would trust ME? How delightfully stupid. Very well. I accept.', 'happy'],
    ]);
    removeAll(s, 'c13_friezaH');
    s.letterbox(false);
    await s.narrate('Fortuneteller Baba agrees to return Frieza to the world of the living - for twenty-four hours only.');
    s.set('world', 'earth');
    await warpTo(s, 'c13_baba_lake', 18, 23, 'up');
    s.letterbox(true);
    s.music('tense');
    stage(s, 'c13_friezaB', 'frieza', 20, 23, 'left', 'Frieza');
    await s.talk([
      ['c13_baba', 'Twenty-four hours, not one minute more. Then it\'s back to Hell with you, and no refunds.', 'neutral'],
      ['frieza', 'Ahh, fresh air. And so many lovely, fragile things to break.', 'smirk'],
    ]);
    s.flash('#60a0f0', 8);
    await s.narrate('Shapes leap from the reeds! Universe 9\'s gods have sent assassins to remove Frieza before the tournament.');
    await s.talk([['c13_assassin', 'Frieza of Universe 7! Lord Sidra sends his regards!', 'angry']]);
    s.letterbox(false);
    s.music('battle');
    s.spawnEnemy('c13_assassin', 8, 21);
    s.spawnEnemy('c13_assassin', 28, 21);
    s.spawnEnemy('c13_assassinB', 12, 23);
    s.spawnEnemy('c13_assassinB', 25, 23);
    await battle(s);
    s.letterbox(true);
    s.flash('#b040f0', 14);
    s.shake(20, 2);
    await s.talk([
      ['frieza', 'Purple light... Energy of Destruction. Universe 9\'s God offers me a deal: betray you, and I live forever.', 'smirk'],
      ['goku', 'Frieza...', 'shock'],
      ['frieza', 'Tempting. But I make my own deals.', 'smirk'],
    ]);
    if (s.exists('c13_friezaB')) s.pose('c13_friezaB', 'blast');
    s.boom(18, 9, 22, '#f070f0');
    await s.narrate('Frieza\'s death beam silences the last assassin hiding across the lake.');
    if (s.exists('c13_friezaB')) s.pose('c13_friezaB', null);
    await s.talk([
      ['frieza', 'Now then. A little warm-up before the tournament, Goku? I trained in Hell, you know. Lots of free time.', 'smirk'],
    ]);
    if (s.exists('c13_friezaB')) {
      await s.powerUp('c13_friezaB', '#f8d040', 50);
      s.sprite('c13_friezaB', 'goldenFrieza');
    }
    await s.talk([
      ['frieza', 'Golden... and this time, I don\'t get tired.', 'smirk'],
      ['goku', 'Heh. Bring it!', 'shout'],
    ]);
    s.letterbox(false);
    const [fx, fy] = freeNear(s, 18, 15);
    removeAll(s, 'c13_friezaB');
    s.music('goldenFrieza');
    await bossFight(s, 'c13_goldenFrieza', { x: fx, y: fy, uid: 'c13_frieza1' });
    removeAll(s, 'c13_frieza1');
    s.letterbox(true);
    stage(s, 'c13_friezaE', 'goldenFrieza', fx, fy, 'down', 'Frieza');
    await s.talk([
      ['goku', 'Okay, okay! Save some for the tournament!', 'happy'],
      ['frieza', 'Hmph. Very well. I\'ll save your pathetic universe. And then we will settle this.', 'smirk'],
    ]);
    removeAll(s, 'c13_friezaE');
    s.letterbox(false);
    await s.done('c13_frieza', false);
    unforce(s);
    restoreHero(s, 'frieza');
    await s.call('c13_finish');
  },
  c13_frieza_p2: async (s) => {
    await s.say('goldenFrieza', 'Is that all? Even my left hand finds you boring!', 'smirk');
  },

  c13_baba_talk: async (s) => {
    // Frieza's twenty-four hours cover the tournament day; Whis makes his life permanent after Universe 7 wins.
    if (s.flag('c14_won') || s.flag('post_game')) { await s.say('c13_baba', 'Frieza\'s time was up... or so I thought. Somebody up there pulled strings. Hmph!', 'angry'); return; }
    if (s.check('done:c13_frieza')) { await s.say('c13_baba', 'Frieza\'s clock is ticking. Twenty-four hours, not one minute more. I am counting every one of them.', 'neutral'); return; }
    await s.say('c13_baba', 'Fortunes told, the dead revived for a day. Reasonable rates. My brother Roshi still owes me money.', 'smirk');
  },

  /** All ten fighters assembled: close Chapter 13 and begin the Tournament of Power. */
  c13_finish: async (s) => {
    if (s.flag('c13_finished')) return;
    s.set('c13_finished');
    await s.done('c13_team', false);
    s.heal();
    await s.narrate('The Mighty Ten of Universe 7: Goku, Vegeta, Gohan, Piccolo, Krillin, Android 18, Tien, Master Roshi, Android 17... and Frieza.');
    await s.narrate('The Mighty Ten are complete. In a few hours, in the World of Void, the fate of Universe 7 will be decided.');
    if (s.hasScript('c14_start')) await s.call('c14_start');
  },
});
