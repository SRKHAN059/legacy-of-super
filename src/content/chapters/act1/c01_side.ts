import { TILE } from '../../../engine/constants';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { HUB } from './hubs';
import { actor, arenaFight, once, SEALED, type Errand } from './util';

/**
 * Chapter 1 side content and hub chatter.
 * - Tutorials on entering Son home (run) and Paozu Forest (hostile zone + save points).
 * - Family / town NPCs whose lines follow the chapter-1 beats (Goten, Gohan, Videl, Goten & Trunks, Mr. Satan, King Kai...).
 * - Bronze: c01_gift (Trunks & Goten's wedding gift -> hot spring serpent), c01_autograph (Mika's signed photo),
 *   c01_goat (Old Hiro's goat, LoG2 egg-escort carry), c01_dino (Goten's dino hunt -> mini-boss Scarface on the
 *   Paozu Peaks plateau).
 */

// ---------------------------------------------------------------- rewards (shared by the turn-in scenes and the point of no return)

async function giftReward(s: ScriptApi): Promise<void> {
  await s.done('c01_gift', false);
  await s.give('pow1');
  await s.give('end1');
  s.exp(80);
}

async function dinoReward(s: ScriptApi): Promise<void> {
  await s.done('c01_dino', false);
  await s.give('end1');
  await s.give('cookie', 3);
  s.exp(60);
}

async function autographReward(s: ScriptApi): Promise<void> {
  await s.done('c01_autograph', false);
  await s.give('str1');
  s.exp(40);
}

/**
 * Chapter 1's optional errands. Handing Chi-Chi the zeni runs straight through Beerus's awakening and King Kai's
 * planet into Chapter 2 (Vegeta, forced), and these quest-givers stay behind on Mt. Paozu and in Satan City, so
 * c01_chichi_talk warns first (`pointOfNoReturn`). Deliverables already in hand are handed over off-screen.
 */
export const C01_ERRANDS: Errand[] = [
  {
    quest: 'c01_gift',
    ready: (s) => s.has('c01_springWater'),
    deliver: async (s) => {
      s.take('c01_springWater');
      await s.narrate('On his way home, Goku dropped the spring water off with Videl. She sent two capsules back for the boys\' "very thoughtful" present.');
      await giftReward(s);
    },
  },
  {
    quest: 'c01_dino',
    ready: (s) => s.has('c01_tail'),
    deliver: async (s) => {
      s.take('c01_tail');
      await s.narrate('Goku left the dino tail with Goten and Trunks, who paid him in "borrowed" Capsule Corp capsules.');
      await dinoReward(s);
    },
  },
  {
    quest: 'c01_autograph',
    ready: (s) => s.has('c01_photo'),
    deliver: async (s) => {
      s.take('c01_photo');
      await s.narrate('Goku swung by the plaza and handed Mika the signed photo. She pressed her lucky capsule into his hand.');
      await autographReward(s);
    },
  },
  // Mei cannot leave Paozu Forest in Goku's arms, so the goat can only be dropped.
  { quest: 'c01_goat' },
];

/** Which chapter-1 beat the story is at (for chatter). */
function beat(s: ScriptApi): 'farm' | 'tracks' | 'lunch' | 'satan' | 'money' | 'away' {
  if (s.check('quest:c01_farm') || !s.flag('c01_awake')) return 'farm';
  if (s.check('quest:c01_tracks')) return 'tracks';
  if (s.check('quest:c01_lunch') || (s.check('done:c01_tracks') && !s.check('done:c01_lunch'))) return 'lunch';
  if (s.check('quest:c01_satan')) return 'satan';
  if (s.check('quest:c01_money')) return 'money';
  return 'away';
}

registerScripts({
  // ---------------------------------------------------------------- tutorials on entering hubs
  c01_home_enter: async (s) => {
    if (!s.check('chapter==1&quest:c01_farm') || !once(s, 'c01_tutRun')) return;
    await s.wait(20);
    await s.narrate('Tap a direction twice and hold it to run. Running gets you around Mt. Paozu much faster.');
  },

  c01_forest_enter: async (s) => {
    if (!s.check('chapter==1&quest:c01_tracks') || !once(s, 'c01_tutForest')) return;
    await s.wait(20);
    await s.narrate('Paozu Forest is a hostile zone (red icon): wild animals attack on sight. Defeat them to earn EXP and level up.');
    await s.narrate('Save discs are your lifeline: there is one in Paozu Valley, and travellers say another sits inside the old cave. Before a tough fight, always save.');
    await s.say('goku', 'The tracks go across the bridge... toward that old bat cave in the north-west. Let\'s go!', 'happy');
  },

  // ---------------------------------------------------------------- Goten
  c01_goten_talk: async (s) => {
    switch (beat(s)) {
      case 'farm': {
        const n = s.count('c01_radish');
        if (n >= 5) { await s.say('goten', 'You got five! Mom\'s gonna be SO happy. Go show her!', 'happy'); return; }
        await s.talk([
          ['goten', 'Dad! I\'m helping! ...I ate one radish already. Don\'t tell Mom.', 'happy'],
          ['goten', 'The radishes are in the dirt rows. They sparkle a little when they\'re ready. Just walk over them!'],
        ]);
        return;
      }
      case 'tracks':
        await s.talk([
          ['goten', 'The footprints go over the bridge and into the forest. Can I come? Pleeeease?', 'happy'],
          ['goku', 'Not this time, Goten. Somebody has to guard the field!', 'smirk'],
          ['goten', 'Ooh! Guard duty! Okay!', 'happy'],
        ]);
        return;
      default:
        await s.say('goten', 'Trunks is coming over today! We\'re gonna play at big brother\'s house!', 'happy');
    }
  },

  /** Goten in Paozu Valley: the dino hunt. */
  c01_vgoten_talk: async (s) => {
    if (!s.check('chapter==1')) { await s.say('goten', 'Hi Dad!', 'happy'); return; }
    if (s.check('done:c01_dino')) {
      await s.talk([
        ['goten', 'Mom made dino-tail stew! Trunks had THREE bowls!', 'happy'],
        ['trunksKid', 'Two and a half. And don\'t tell my mom. She thinks I eat salad.', 'smirk'],
      ]);
      return;
    }
    if (s.check('quest:c01_dino')) {
      if (s.has('c01_tail')) { await s.call('c01_dino_done'); return; }
      await s.say('goten', 'The big T-rex lives on the plateau above Paozu Peaks! Use the flight circle in the basin. It has a scar right across its face!', 'happy');
      return;
    }
    await s.talk([
      ['goten', 'Dad! Dad! We found a secret base on the plateau above the Peaks, but a GIANT T-rex chased us out!', 'shock'],
      ['trunksKid', 'It had a huge scar across its face. And it roared at us. Rudely.', 'angry'],
      ['goten', 'Can you beat it up? Not too much! Just enough that it shares!'],
      ['goten', 'And bring back some tail! Mom says dino tail is the best meat in the whole world!', 'happy'],
    ]);
    const c = await s.ask('goku', 'Dinosaur tail, huh...', ['Now you\'re talking!', 'Maybe later.']);
    if (c === 0) {
      await s.say('goku', 'Leave it to me! I haven\'t had dino tail since I was your age!', 'happy');
      await s.quest('c01_dino');
    } else {
      await s.say('goten', 'Aww. Okay. We\'ll guard the valley instead.', 'sad');
    }
  },

  c01_dino_done: async (s) => {
    s.take('c01_tail');
    s.letterbox(true);
    await s.talk([
      ['goku', 'One dino tail, as ordered! Don\'t worry, it grows back.', 'happy'],
      ['goten', 'WHOA! It\'s bigger than me! Trunks, look!', 'happy'],
      ['trunksKid', 'Okay. That\'s... actually really cool, Mr. Goku.', 'shock'],
      ['goten', 'Here, Dad, this is from our secret base. It\'s a power capsule! Trunks swiped it from his grandpa.', 'happy'],
      ['trunksKid', '"Borrowed." Grandpa has, like, a thousand.', 'smirk'],
    ]);
    await dinoReward(s);
    s.letterbox(false);
  },

  /** The plateau above Paozu Peaks: Scarface (walk-in trigger while c01_dino is active). */
  c01_scarface: async (s) => {
    if (!s.check('quest:c01_dino') || s.flag(SEALED) || s.flag('c01_scarfaceBeaten') || s.has('c01_tail')) return;
    const [ex, ey] = HUB.paozuPeaks.rexEnter;
    const [fx, fy] = HUB.paozuPeaks.rexFight;
    s.letterbox(true);
    s.shake(20, 2);
    s.sfx('explode');
    await s.say('goku', 'Whoa... the whole plateau is shaking!', 'shock');
    actor(s, 'c01_rexNpc', 'c01_scarface', ex, ey, 'left', 'Scarface');
    await s.pan(fx + 1, fy, 30);
    await s.walk('c01_rexNpc', fx, fy, 1.2);
    s.shake(30, 3);
    s.face('hero', 'c01_rexNpc');
    await s.talk([
      ['c01_rexNpc', 'GRAAAOOOHHH!!'],
      ['goku', 'Hey, wait a second... that scar. You\'re the big guy I fought when I was a kid!', 'shock'],
      ['goku', 'You got old! ...So did I, I guess. Okay - round two!', 'happy'],
    ]);
    s.follow();
    s.letterbox(false);
    s.remove('c01_rexNpc');
    s.music('boss');
    const r = await arenaFight(s, 'c01_scarface', { x: fx, y: fy, uid: 'c01_rex', loseOk: true });
    s.letterbox(true);
    if (r === 'lose') {
      await s.narrate('Scarface stomps off across the plateau, roaring in triumph. Goku picks himself up, grinning.');
      await s.say('goku', 'Heh. Still got it, old timer. I\'ll be back once I\'m a little stronger!', 'happy');
      s.heal();
      if (s.exists('c01_rex')) s.remove('c01_rex');
      s.music('snow');
      s.letterbox(false);
      return;
    }
    s.exp(380);
    await s.say('goku', 'Sorry, big guy - I promised Goten! HYAH!', 'shout');
    s.pose('hero', 'kick');
    s.sfx('hit');
    s.flash('#ffffff', 8);
    s.shake(12, 2);
    await s.wait(16);
    s.pose('hero', null);
    await s.narrate('One clean karate chop later, Scarface was a little shorter at one end.');
    await s.give('c01_tail');
    if (s.exists('c01_rex')) await s.walk('c01_rex', ex + 2, ey, 2.5);
    if (s.exists('c01_rex')) s.remove('c01_rex');
    await s.say('goku', 'It grows back, I promise! And go easy on the kids from now on, okay?', 'happy');
    s.set('c01_scarfaceBeaten');
    s.music('snow');
    s.letterbox(false);
  },

  c01_scarface_roar: async (s) => {
    s.shake(20, 3);
    await s.say('goku', 'Whoa, it\'s charging! Time to get out of the way!', 'shock');
  },

  /** Trunks in Paozu Valley: Videl's wedding gift. */
  c01_boys_talk: async (s) => {
    if (!s.check('chapter==1')) { await s.say('trunksKid', 'Hi, Mr. Goku!', 'happy'); return; }
    if (s.check('done:c01_gift')) {
      await s.talk([
        ['trunksKid', 'Videl LOVED it. Told you a gift from the mountains beats some boring ring.', 'smirk'],
        ['goten', 'It was MY idea!', 'angry'],
        ['trunksKid', 'You wanted to give her a bug.'],
      ]);
      return;
    }
    if (s.check('quest:c01_gift')) {
      if (s.has('c01_springWater')) { await s.say('goten', 'You got the magic water! Give it to Videl! Quick, before Gohan sees!', 'happy'); return; }
      if (s.flag('c01_giftSpring')) {
        await s.talk([
          ['trunksKid', 'A hot spring that makes you younger? Up past Paozu Peaks? That\'s PERFECT.', 'happy'],
          ['goten', 'There\'s a cave on the top plateau of the Peaks. You have to fly up with the flight circle!'],
          ['trunksKid', 'If there\'s a monster guarding it, punch it. That\'s how my dad does everything.', 'smirk'],
        ]);
        return;
      }
      await s.say('trunksKid', 'The fancy shops are in Satan City. Mr. Goku, you can fly there - check the souvenir store on the main avenue!');
      return;
    }
    await s.talk([
      ['goten', 'Dad! Dad! Trunks and me want to give Videl a wedding present!', 'happy'],
      ['trunksKid', 'Something grown-up. Jewellery, or that face-cream stuff my mom buys.'],
      ['goten', 'But we\'re not allowed to fly to the city alone... Can you help us, Dad?', 'sad'],
    ]);
    const c = await s.ask('goku', 'A present for Videl, huh?', ['Sure, I\'ll help!', 'Maybe later.']);
    if (c === 0) {
      await s.say('trunksKid', 'Great! Satan City has the fanciest shops. Go look, and tell us what\'s good!', 'happy');
      await s.quest('c01_gift');
    } else {
      await s.say('goten', 'Aww. Okay. We\'ll be right here thinking really hard.', 'sad');
    }
  },

  // ---------------------------------------------------------------- Gohan & Videl
  c01_gohan_talk: async (s) => {
    if (!s.check('chapter==1')) return;
    if (s.check('quest:c01_lunch') && s.has('c01_lunch')) { await s.call('c01_gohan_lunch'); return; }
    switch (beat(s)) {
      case 'farm':
      case 'tracks':
        await s.say('gohan', 'Morning, Dad! Shouldn\'t you be in the field? Mom called twice already.', 'smirk');
        return;
      case 'satan':
        await s.say('gohan', 'Mr. Satan\'s mansion is at the north end of Satan City. Follow the big statues. All of them.', 'smirk');
        return;
      case 'money':
        await s.say('gohan', 'A hundred million zeni?! Dad, please don\'t let Goten near it. He\'ll buy a dinosaur.', 'shock');
        return;
      default:
        await s.talk([
          ['gohan', 'I\'m almost finished with my thesis. Then I\'ll have more time to train... I promise.'],
          ['gohan', 'Videl keeps saying that too. She just says it more like a threat.', 'smirk'],
        ]);
    }
  },

  c01_videl_talk: async (s) => {
    if (!s.check('chapter==1')) return;
    if (s.check('quest:c01_gift') && s.has('c01_springWater')) {
      s.take('c01_springWater');
      await s.talk([
        ['goku', 'Videl! This is from Goten and Trunks. Hot spring water from the mountains. Supposedly it keeps you young!', 'happy'],
        ['videl', 'For me? From the boys? That\'s so sweet...', 'happy'],
        ['videl', '...Wait. Did they think I NEED it?', 'angry'],
        ['goku', 'Uh. It was Trunks\'s idea!', 'shock'],
        ['videl', 'Ha ha! Relax, I\'m teasing. Tell them thank you. Here - Gohan won these at a science fair. He never uses them.', 'happy'],
      ]);
      await giftReward(s);
      return;
    }
    switch (beat(s)) {
      case 'farm':
      case 'tracks':
        await s.say('videl', 'Mr. Goku! Did Chi-Chi let you out already? You must have worked hard.', 'smirk');
        return;
      case 'lunch':
        await s.say('videl', 'Is that lunch? Gohan, put the book down, your mom cooked!', 'happy');
        return;
      case 'satan':
        await s.say('videl', 'Papa will talk your ear off about Buu. Just nod. It\'s what I do.', 'smirk');
        return;
      default:
        await s.say('videl', 'Gohan and I are thinking about... the future. Things. Nothing! Never mind!', 'happy');
    }
  },

  // ---------------------------------------------------------------- Mr. Satan
  c01_satan_talk: async (s) => {
    if (s.check('quest:c01_satan')) { await s.call('c01_satan_meet'); return; }
    if (s.check('quest:c01_autograph') && !s.has('c01_photo') && !s.check('done:c01_autograph')) {
      await s.talk([
        ['goku', 'Hey, Mr. Satan. There\'s a little girl in the plaza who really wants your autograph.'],
        ['mrSatan', 'A fan?! Of course! The Champ never forgets the little people! Especially the very little people!', 'happy'],
        ['mrSatan', 'Here. My best photo. The pose took me three years to perfect. Note the triple exclamation marks.', 'smirk'],
      ]);
      await s.give('c01_photo');
      return;
    }
    if (s.check('quest:c01_money')) {
      await s.say('mrSatan', 'Go on, take it home! And remember our little talk. Ha ha! Hah... ha.', 'happy');
      return;
    }
    if (s.check('chapter>=2')) {
      await s.say('mrSatan', 'Bulma\'s party is tonight! I\'m bringing Buu. What could go wrong? Ha ha ha!', 'happy');
      return;
    }
    await s.say('mrSatan', 'The Champ is always training! Well. Mostly posing. Posing is training for the face!', 'happy');
  },

  // ---------------------------------------------------------------- bronze: autograph
  c01_fan_talk: async (s) => {
    // The errand is Goku's: in Chapter 2 the forced hero is Vegeta.
    if (s.hero !== 'goku') {
      await s.say('c01_fan', 'Are you a fighter too, mister? You look really grumpy. Mr. Satan never looks grumpy!', 'happy');
      return;
    }
    if (s.check('done:c01_autograph')) {
      await s.say('c01_fan', 'I put the photo next to my bed! Mr. Satan protects me from nightmares now!', 'happy');
      return;
    }
    if (s.has('c01_photo')) {
      s.take('c01_photo');
      await s.talk([
        ['c01_fan', 'Is that... A SIGNED MR. SATAN PHOTO?! With THREE exclamation marks?!', 'shock'],
        ['c01_fan', 'Thank you thank you thank you! Here, you can have my lucky capsule. I found it under the statue!', 'happy'],
      ]);
      await autographReward(s);
      return;
    }
    if (s.check('quest:c01_autograph')) {
      await s.say('c01_fan', 'Mr. Satan lives in the big mansion up the avenue. Please please please get me his autograph!', 'happy');
      return;
    }
    if (!s.check('chapter==1')) { await s.say('c01_fan', 'Mr. Satan is the strongest man in the whole world! Everybody knows that.', 'happy'); return; }
    await s.talk([
      ['c01_fan', 'Mister! You look strong. Are you a fighter like Mr. Satan?', 'happy'],
      ['goku', 'Heh, something like that.'],
      ['c01_fan', 'I want his autograph more than anything, but the guards never let kids near the mansion...', 'sad'],
    ]);
    const c = await s.ask('goku', 'Get her an autograph?', ['Leave it to me!', 'Sorry, I\'m busy.']);
    if (c === 0) {
      await s.say('c01_fan', 'Really?! You\'re the best! Mr. Satan\'s mansion is north, past the avenue!', 'happy');
      await s.quest('c01_autograph');
    }
  },

  // ---------------------------------------------------------------- bronze: Videl's gift
  c01_shopper_talk: async (s) => {
    if (!s.check('quest:c01_gift')) {
      await s.say('c01_shopper', 'Eighty thousand zeni for a jar of "Champion Youth Cream"! With Mr. Satan\'s face on the lid! Hmph!', 'angry');
      return;
    }
    await s.talk([
      ['c01_shopper', 'A present for a young bride? Don\'t waste money on these jars. Eighty thousand zeni for cream with Mr. Satan\'s face on it!', 'angry'],
      ['c01_shopper', 'When I was a girl, we climbed past Paozu Peaks to the old hot spring. One dip and you\'d look ten years younger.'],
      ['c01_shopper', 'Of course, there was a serpent the size of a train guarding it. Character building!', 'smirk'],
    ]);
    if (once(s, 'c01_giftSpring')) await s.say('goku', 'A hot spring past the Peaks... and a giant serpent? Sounds fun!', 'happy');
  },

  c01_g4_hint: async (s) => {
    await s.narrate('Another level gate - Goku needs level 4 to break through. If he\'s not strong enough yet, train on the mountain trail below.');
  },

  c01_spring: async (s) => {
    if (!s.check('quest:c01_gift') || s.flag(SEALED) || s.flag('c01_serpentBeaten')) return;
    s.letterbox(true);
    await s.say('goku', 'Wow, look at all that steam! This must be the spring.', 'happy');
    s.shake(20, 2);
    s.sfx('explode');
    actor(s, 'c01_serpentNpc', 'c01_serpent', 17, 4, 'down', 'Spring Serpent');
    s.flash('#a0e0ff', 12);
    await s.talk([
      ['c01_serpentNpc', 'HSSSSSSS!'],
      ['goku', 'Whoa! The granny wasn\'t kidding! Sorry, I just need one jar!', 'shock'],
    ]);
    s.letterbox(false);
    const a = s.actor('c01_serpentNpc');
    const fx = Math.round((a.x - 8) / TILE);
    s.remove('c01_serpentNpc');
    s.music('boss');
    const r = await arenaFight(s, 'c01_serpent', { x: fx, y: 6, uid: 'c01_serpent1', loseOk: true });
    s.letterbox(true);
    if (r === 'lose') {
      await s.narrate('The serpent slithers back into the steaming water, satisfied. Goku catches his breath.');
      s.heal();
      if (s.exists('c01_serpent1')) s.remove('c01_serpent1');
      s.letterbox(false);
      s.music('field');
      return;
    }
    s.exp(320);
    await s.narrate('The serpent hisses one last time and sinks into the deep end of the pool, sulking.');
    if (s.exists('c01_serpent1')) s.remove('c01_serpent1');
    s.set('c01_serpentBeaten');
    await s.give('c01_springWater');
    await s.say('goku', 'Got it! The boys are gonna be so happy. Videl too... hopefully.', 'happy');
    s.music('field');
    s.letterbox(false);
  },

  c01_serpent_hiss: async (s) => {
    await s.say('goku', 'Hot hot HOT! It\'s spitting boiling water!', 'shock');
  },

  // ---------------------------------------------------------------- bronze: the runaway goat
  c01_hiro_talk: async (s) => {
    // The errand is Goku's: in Chapter 2 the forced hero is Vegeta.
    if (s.hero !== 'goku') {
      await s.say('c01_hiro', 'Another of Goku\'s friends? Mind the wolves out here, young man. They don\'t care how strong you are.');
      return;
    }
    if (s.check('done:c01_goat')) {
      await s.say('c01_hiro', 'Mei hasn\'t left my side since. Well, except to eat my hat. Thank you again, Goku.', 'happy');
      return;
    }
    if (s.carrying && s.check('quest:c01_goat')) {
      s.drop();
      s.set('c01_goatHome');
      await s.talk([
        ['c01_hiro', 'Mei! You silly thing! Not a scratch on her, either. You\'re a gentle one, for a fighter.', 'happy'],
        ['c01_hiro', 'Here. I don\'t have much, but these were my son\'s. Some city vitamin capsule. Never did him any good.'],
      ]);
      await s.done('c01_goat', false);
      await s.give('str1');
      s.exp(60);
      return;
    }
    if (s.check('quest:c01_goat')) {
      await s.say('c01_hiro', 'Mei ran south-west, toward the river. Carry her gently - one bump and she\'ll bolt again!');
      return;
    }
    if (!s.check('chapter==1')) { await s.say('c01_hiro', 'Mei came wandering home on her own in the end. Hungry, muddy and very pleased with herself.'); return; }
    await s.talk([
      ['c01_hiro', 'Oh, Goku. You haven\'t seen a goat, have you? White, horns, terrible attitude?', 'sad'],
      ['c01_hiro', 'My Mei broke through the fence and ran into the forest. These old legs won\'t carry me past the wolves.'],
    ]);
    const c = await s.ask('goku', 'Find Hiro\'s goat?', ['I\'ll bring her back!', 'Not right now.']);
    if (c === 0) {
      await s.say('c01_hiro', 'Bless you! She went south-west, toward the river. Bring her back here to me!', 'happy');
      await s.quest('c01_goat');
    }
  },

  c01_goat_talk: async (s) => {
    if (!s.check('quest:c01_goat') || s.check('done:c01_goat')) { await s.say('c01_goatNpc', 'Mehhh.'); return; }
    if (s.carrying) return;
    await s.say('c01_goatNpc', 'MEHHH!');
    if (s.exists('c01_goatNpc')) s.show('c01_goatNpc', false);
    s.carry('goat', 'c01_goat_break');
    await s.narrate('Goku picks up the goat! You can\'t attack while carrying her, and one hit will make her bolt. Bring her to Old Hiro at the forest\'s east edge.');
  },

  c01_goat_break: async (s) => {
    const [gx, gy] = HUB.paozuForest.goat;
    if (s.exists('c01_goatNpc')) { s.place('c01_goatNpc', gx, gy, 'down'); s.show('c01_goatNpc', true); }
    await s.say('goku', 'Hey, come back! ...She ran all the way back to the river.', 'sad');
  },

  // ---------------------------------------------------------------- King Kai's planet extras
  c01_bubbles_talk: async (s) => {
    await s.say('c01_bubbles', s.check('chapter>=2') ? 'Ook... ook. (Bubbles is still hiding from the cat god.)' : 'Ook! Ook ook!');
  },
});
