import { registerScripts, type ScriptApi } from '../../../game/script';
import { ITEMS } from '../../items';

/**
 * Ambient (non-story) dialogue for the Earth A hubs. Every script is prefixed `ea_` and safe to run in any
 * chapter. Lines change with `chapter` where the townsfolk would plausibly notice world events:
 *   ch3+  the strange golden sky / quakes of the Battle of Gods
 *   ch5+  Frieza's army landing (and, from ch6, everyone's shared "Earth blew up" nightmare)
 *   ch12+ the Great Saiyaman movie shoot and other peacetime oddities
 *   ch13+ Buu's deep sleep before the Tournament of Power
 */

/** Speaker id for an ambient NPC: the NPC itself when present, else a cast id / display name. */
function spk(s: ScriptApi, id: string, fallback: string): string {
  return s.exists(id) ? id : fallback;
}

/** Free Senzu Beans Yajirobe hands out before he quits (LoG2: three meetings). */
export const YAJI_MAX_GIFTS = 3;
/** Numeric flag: Senzu Beans Yajirobe has given so far. */
export const YAJI_GIFTS = 'ea_yajiGifts';
/** Numeric flag: chapter of his most recent gift (one gift per chapter). */
export const YAJI_GIFT_CH = 'ea_yajiGiftCh';
/** Flag: he has delivered his "get them yourself" line. */
export const YAJI_QUIT = 'ea_yajiQuit';
/** Flag: a gift is waiting because the player's Senzu pouch was full. */
export const YAJI_HELD = 'ea_yajiHeld';

/** Senzu pouch capacity. */
function senzuMax(): number {
  return ITEMS.senzu?.max ?? 3;
}

registerScripts({
  // ================================================================ Mt. Paozu
  ea_pv_farmer: async (s) => {
    const me = spk(s, 'ea_pv_farmer', 'farmer');
    if (s.check('chapter>=5')) {
      await s.talk([
        [me, 'Spaceships full of soldiers came down past the ridge a while back. Folks say Gohan went out to meet them in a suit and tie!', 'shock'],
        [me, 'Next morning my whole field was fine and my cows were grumpy. Mountain life, eh?'],
      ]);
      return;
    }
    if (s.check('chapter>=3')) {
      await s.talk([
        [me, 'You feel that quake the other night? The sky lit up gold, then red, then gold again.', 'shock'],
        [me, 'My wife says it was the Son boy\'s doing. I say a man that grows radishes that big can\'t be all bad.', 'happy'],
      ]);
      return;
    }
    const n = s.inc('ea_pv_farmer_n');
    if (n % 2 === 1) {
      await s.talk([
        [me, 'Morning! Name\'s Takeda. I farm the terraces past the valley.', 'happy'],
        [me, 'Chi-Chi\'s got you on radish duty too? That woman could run an army with a frying pan.'],
      ]);
    } else {
      await s.talk([
        [me, 'Gohan and Videl\'s place is up the path. Nice young couple. Quiet, except when they\'re "sparring".'],
        [me, 'Last month a pterodactyl tried to nest on their roof. It flew off very politely after Videl had a word with it.', 'smirk'],
      ]);
    }
  },

  ea_pv_fisher: async (s) => {
    const me = spk(s, 'ea_pv_fisher', 'oldMan');
    if (!s.flag('ea_pv_fishGift')) {
      await s.talk([
        [me, 'Shh... they\'re biting today. Forty years I\'ve fished this pond and never caught the big one.'],
        [me, 'Here, I\'ve got more than I can eat. Old Korin up the great tower swaps magic beans for fish, or so my grandfather swore.', 'happy'],
      ]);
      s.set('ea_pv_fishGift');
      await s.give('fish');
      return;
    }
    if (s.check('chapter>=12')) {
      await s.say(me, 'A little girl flew over the pond yesterday. Flew! Couldn\'t have been older than a year. I\'m switching to decaf.', 'shock');
      return;
    }
    await s.say(me, 'Fish bite best when you\'re not watching. That goes for most things in life, youngster.');
  },

  ea_ph_neighbor: async (s) => {
    const me = spk(s, 'ea_ph_neighbor', 'townswoman');
    if (s.check('chapter>=8')) {
      await s.talk([
        [me, 'I came over to borrow sugar and ended up babysitting a baby who can fly. Pan floated right up to the rafters!', 'shock'],
        [me, 'Chi-Chi just said "Oh, that\'s normal," and poured more tea.'],
      ]);
      return;
    }
    if (s.check('chapter>=4')) {
      await s.talk([
        [me, 'Goku\'s off "training with a god" again, apparently. And here I thought my husband\'s fishing trips were an excuse.', 'smirk'],
        [me, 'Somebody has to help Chi-Chi with that field. Those radishes don\'t pull themselves.'],
      ]);
      return;
    }
    await s.talk([
      [me, 'Oh! You startled me. I\'m Ume, from over the hill. I trade Chi-Chi pickles for radishes.', 'happy'],
      [me, 'Did you see that tractor? Goku tried to plough with it and it ended up in the river. Twice.'],
    ]);
  },

  ea_pf_cave: async (s) => {
    if (s.check('chapter>=9')) {
      await s.narrate('Cold air breathes out of the cave mouth. Deep inside, something big shifts in its sleep... Better leave it be for now.');
      return;
    }
    await s.narrate('An old bat cave. It\'s pitch black inside, and the squeaking is deafening. Nothing in there is worth the guano.');
  },

  // ================================================================ Satan City - plaza
  ea_sc_fan: async (s) => {
    const me = spk(s, 'ea_sc_fan', 'kidNpc');
    const n = s.inc('ea_sc_fan_n');
    if (s.check('chapter>=12')) {
      await s.talk([
        [me, 'They\'re filming a GREAT SAIYAMAN movie in town! With Mr. Satan as the villain! Or the hero? Both?!', 'shock'],
        [me, 'I asked the guy in the helmet for an autograph and he signed it "Gohan." Weird stage name.'],
      ]);
      return;
    }
    if (n === 1) {
      await s.talk([
        [me, 'Isn\'t he AMAZING? Mr. Satan beat Cell AND saved the world from Majin Buu! With his bare hands!', 'happy'],
        ['hero', '...Sure. Bare hands.', 'smirk'],
        [me, 'When I grow up I\'m gonna do the Dynamite Kick too! Hi-yah! Ow, my ankle.'],
      ]);
    } else if (s.check('chapter>=5')) {
      await s.say(me, 'My mom says aliens attacked. Don\'t worry, Mr. Satan probably scared them off with his Victory Pose. That\'s how it works.', 'happy');
    } else {
      await s.say(me, 'I polish the statue\'s toes every Sunday. For luck! Don\'t tell the park ranger.', 'happy');
    }
  },

  ea_sc_reporter: async (s) => {
    const me = spk(s, 'ea_sc_reporter', 'reporter');
    if (s.check('chapter>=13')) {
      await s.talk([
        [me, 'Exclusive tip: Majin Buu hasn\'t woken up in DAYS. Mr. Satan says he\'s "hibernating to save energy for something cosmic."', 'shock'],
        [me, 'Cosmic! My editor wants it on the front page. My gut says it\'s a nap.'],
      ]);
      return;
    }
    if (s.check('chapter>=5')) {
      await s.talk([
        [me, 'I was THIS close to a scoop: hundreds of soldiers, a frozen-looking alien emperor... and then nothing. No footage. No wreckage.', 'angry'],
        [me, 'Every camera in the city recorded the same day twice. ZTV legal says we "do not discuss the double Tuesday."'],
      ]);
      return;
    }
    await s.talk([
      [me, 'ZTV News, Satan City Desk! Do you have any comment on the Champion\'s new prize donation?', 'happy'],
      [me, 'Rumour says he gave a hundred million zeni to some mountain farmer. A farmer! What did a farmer ever do to save the world?'],
    ]);
  },

  ea_sc_police: async (s) => {
    const me = spk(s, 'ea_sc_police', 'police');
    if (s.check('chapter>=12')) {
      await s.talk([
        [me, 'Our colleague Krillin put in for leave. Said he wants to "get his edge back."'],
        [me, 'Between you and me, he once stopped a getaway car by flicking it. I don\'t think his edge went anywhere.', 'smirk'],
      ]);
      return;
    }
    await s.talk([
      [me, 'Move along, citizen. Nothing to see here. Unless you\'re here to see the statue. Then, plenty to see.'],
      [me, 'Crime\'s at an all-time low. Criminals are scared Mr. Satan might be watching. Or worse, that girl who used to patrol with us. Videl. Brrr.', 'shock'],
    ]);
  },

  ea_sc_granny: async (s) => {
    const me = spk(s, 'ea_sc_granny', 'ea_granny');
    if (s.check('chapter>=6')) {
      await s.talk([
        [me, 'Dearie, did you have the dream too? The one where the whole world went boom, and then it was breakfast again?', 'sad'],
        [me, 'Half the city had it. The pharmacist is out of sleeping pills. I just knit faster.'],
      ]);
      return;
    }
    await s.talk([
      [me, 'This used to be Orange Star City, you know. Then that nice loud man saved everyone and they renamed it.', 'happy'],
      [me, 'I liked the oranges better. But don\'t tell anyone I said so.'],
    ]);
  },

  ea_sc_suit: async (s) => {
    const me = spk(s, 'ea_sc_suit', 'ea_suit');
    if (s.check('chapter>=3')) {
      await s.say(me, 'Insurance claims for "divine thunderstorm damage" are up four hundred percent. We had to invent a form for it.', 'sad');
      return;
    }
    await s.talk([
      [me, 'The City Bank handles the Champion\'s finances. Do you know how many statues one man can commission? Neither do we. We stopped counting.'],
      [me, 'He just withdrew a hundred million zeni in cash. In a suitcase. We had to borrow a forklift.', 'shock'],
    ]);
  },

  ea_sc_waiter: async (s) => {
    const me = spk(s, 'ea_sc_waiter', 'waiter');
    const n = s.inc('ea_sc_waiter_n');
    if (n === 1) {
      await s.talk([
        [me, 'Welcome to Cafe Victory! Today\'s special is the Dynamite Kick Parfait. Comes with a sparkler.', 'happy'],
        [me, 'We\'re closed for the lunch rush - a large man in a purple suit ordered the entire menu. Twice. Then asked for dessert.'],
      ]);
      return;
    }
    if (s.check('chapter>=4')) {
      await s.say(me, 'A tall gentleman with blue skin and a staff tipped us in "the finest compliments in the universe." Lovely man. Cleaned out the cake display.', 'smirk');
      return;
    }
    await s.say(me, 'Seating\'s outside only today. Kitchen\'s still recovering from Mr. Buu\'s visit.');
  },

  ea_sc_tourist: async (s) => {
    const me = spk(s, 'ea_sc_tourist', 'ea_tourist');
    await s.talk([
      [me, 'I flew in from the South Islands just to see the statue! Then I saw the OTHER statue. And the other one. How many are there?!', 'happy'],
      [me, 'The hotel\'s fully booked by Mr. Satan fan clubs. I\'m sleeping on a bench tonight. Worth it!'],
    ]);
  },

  ea_sc_jogger: async (s) => {
    const me = spk(s, 'ea_sc_jogger', 'ea_jogger');
    if (s.check('chapter>=3')) {
      await s.say(me, 'Huff... huff... Did you see that guy... with red hair... flying above the clouds? I was running... and he passed me... upward.', 'shock');
      return;
    }
    await s.say(me, 'Huff... Every morning... I run the Avenue of Champions... Fifty laps... Mr. Satan does a hundred... allegedly...');
  },

  ea_sc_oldman: async (s) => {
    const me = spk(s, 'ea_sc_oldman', 'oldMan');
    await s.talk([
      [me, 'I fought in the World Martial Arts Tournament once, way back. Lost in the first round to a little monkey-tailed boy.'],
      [me, 'He waved at me afterwards and asked if I wanted to eat. Strangest beating I ever took. Best lunch too.', 'happy'],
    ]);
    if (s.check('chapter>=7')) await s.say(me, 'Funny. Saw a fellow at the noodle stand last week with that same grin. Ate twenty bowls. Must run in the family.', 'smirk');
  },

  ea_sc_girl: async (s) => {
    const me = spk(s, 'ea_sc_girl', 'ea_girl');
    if (s.check('chapter>=12')) {
      await s.say(me, 'Champ Goods has a new Great Saiyaman helmet. It lights up! I bought two. One for my cat.', 'happy');
      return;
    }
    await s.talk([
      [me, 'The boutique\'s closed for a "Satan Day" display change. Every year it\'s a new gold jacket.'],
      [me, 'Champ Goods next door is open, though. They sell the cutest Buu plushies. They squeak when you hug them!', 'happy'],
    ]);
  },

  ea_sc_scientist: async (s) => {
    const me = spk(s, 'ea_sc_scientist', 'scientist');
    if (s.check('chapter>=9')) {
      await s.talk([
        [me, 'My seismographs registered a disturbance in the fourth dimension last week. Yes, I have a seismograph for that.', 'shock'],
        [me, 'Capsule Corporation won\'t return my calls. Typical.'],
      ]);
      return;
    }
    await s.talk([
      [me, 'Professor Aoki, Satan City University. I\'m studying the "Champion Effect": the city\'s crime rate drops near every statue.'],
      [me, 'My hypothesis? Gold is very reflective. Burglars hate being seen.', 'smirk'],
    ]);
  },

  ea_sc_hotel: async (s) => {
    await s.narrate('HOTEL SATAN. A gold sign reads: "FULLY BOOKED - the Mr. Satan International Fan Club Convention." Someone has added: "Again."');
  },

  ea_sc_bank: async (s) => {
    await s.narrate('SATAN CITY BANK. The doors are shut. A notice says the vault is being reinforced "to hold the Champion\'s sense of humility."');
  },

  ea_sc_boutique: async (s) => {
    await s.narrate('The boutique is closed. In the window, a mannequin wears a golden cape with "WORLD CHAMP" sewn on in rhinestones.');
  },

  ea_sc_cafe: async (s) => {
    await s.narrate('A chalkboard by the door: "Kitchen closed after Mr. Buu\'s visit. Outdoor seating only. We apologise for nothing, he was delightful."');
  },

  ea_sc_station: async (s) => {
    if (s.check('chapter>=12')) {
      await s.narrate('A memo on the police station door: "Officer Krillin on leave. Do NOT let the new recruits try his \'Destructo Disc\' on parking tickets."');
      return;
    }
    await s.narrate('The police station door is locked. A handwritten note: "Out on patrol. In an emergency, call Mr. Satan. In a REAL emergency, call Videl."');
  },

  ea_sc_flats: async (s) => {
    await s.narrate('An apartment block. The buzzer panel lists a dozen names. Three of them are "SATAN", none of them related.');
  },

  ea_sc_statue: async (s) => {
    const n = s.inc('ea_sc_statue_n');
    if (n === 1) {
      await s.narrate('A solid gold statue of Mr. Satan, fist to the sky. The plaque reads: "To the Champion who saved the world from Cell and Majin Buu. Twice, if you count the rematch."');
      if (s.hero === 'goku' || s.hero === 'gohan') await s.say('hero', 'Heh. It looks just like him.', 'smirk');
      return;
    }
    await s.narrate('Someone has left fresh flowers and a box of Champion Cookies at the statue\'s feet.');
  },

  // ================================================================ Satan City - mansion
  ea_sm_gardener: async (s) => {
    const me = spk(s, 'ea_sm_gardener', 'farmer');
    if (s.check('chapter>=13')) {
      await s.say(me, 'Mr. Buu fell asleep in my flowerbed again. Three days now. I\'ve been watering around him.', 'sad');
      return;
    }
    await s.talk([
      [me, 'Thirty-two rosebushes, eleven hedge sculptures, and one Mr. Satan topiary. Mind the topiary\'s nose, I just trimmed it.'],
      [me, 'Mr. Buu helps with the weeding. Well, he turns the weeds into candy. It\'s not technically weeding.', 'smirk'],
    ]);
  },

  ea_sm_guard: async (s) => {
    const me = spk(s, 'ea_sm_guard', 'police');
    if (s.check('chapter>=5')) {
      await s.say(me, 'Security\'s doubled since the alien business. Not that it matters. The big pink fella in there is the real security system.');
      return;
    }
    await s.talk([
      [me, 'Welcome to the Satan Mansion. The Champion is very generous with visitors - as long as they don\'t ask him to demonstrate anything.'],
      [me, 'The dojo out east is open to students. Watch out for the jars. The Champion\'s students break about forty a week.'],
    ]);
  },

  ea_sm_swimmer: async (s) => {
    const me = spk(s, 'ea_sm_swimmer', 'ea_girl');
    await s.say(me, 'Mr. Satan lets the fan club use the pool on weekends! The water\'s heated to exactly "Champion temperature." Nobody knows what that means.', 'happy');
  },

  ea_smi_buu: async (s) => {
    const me = spk(s, 'ea_smi_buu', 'majinBuu');
    if (s.check('chapter>=13')) {
      await s.narrate('Majin Buu is snoring like a thunderstorm. Bee is curled up on his belly, rising and falling with each breath.');
      await s.say(me, 'Zzz... mmm... chocolate... Zzz...');
      return;
    }
    const n = s.inc('ea_smi_buu_n');
    if (n === 1) {
      await s.talk([
        [me, 'Shh! Buu watching Mr. Satan show. Mr. Satan very strong on TV. Strongest!', 'happy'],
        [me, 'You want candy? Buu make you candy... no. Mr. Satan say no turning guests into candy. Buu forgot.'],
      ]);
      return;
    }
    if (s.check('chapter>=3')) {
      await s.say(me, 'Buu met scary purple cat at party. Cat ate Buu pudding! Buu so mad! Then Buu got beat up. Buu still mad about pudding.', 'angry');
      return;
    }
    await s.say(me, 'Buu and Bee best friends. Bee good boy. Buu good boy too!', 'happy');
  },

  ea_smi_bee: async (s) => {
    const me = spk(s, 'ea_smi_bee', 'Bee');
    const n = s.inc('ea_smi_bee_n');
    if (n === 3 && !s.flag('ea_beeGift')) {
      s.set('ea_beeGift');
      await s.narrate('Bee barks happily, trots off behind the sofa, and comes back with something in his mouth.');
      await s.give('cookie', 3);
      await s.say(me, 'Woof!', 'happy');
      return;
    }
    await s.say(me, n % 2 ? 'Woof! Woof!' : 'Arf! (Bee wags his tail so hard his whole body wiggles.)', 'happy');
  },

  ea_smi_butler: async (s) => {
    const me = spk(s, 'ea_smi_butler', 'ea_butler');
    if (s.check('chapter>=13')) {
      await s.say(me, 'Master Satan is upstairs rehearsing a speech for "the end of the universe." He insists it is a metaphor. I have stopped asking.');
      return;
    }
    await s.talk([
      [me, 'Good day. I am the head butler of the Satan household. Please refrain from feeding Mr. Buu before supper. Or after supper. Or during.'],
      [me, 'The trophy room is to your left. Every trophy is genuine, except the ones that are honorary. Which is most of them.'],
    ]);
  },

  ea_smi_stairs: async (s) => {
    await s.narrate('A grand staircase. A velvet rope blocks the way, with a sign: "PRIVATE - Champion\'s Quarters. Autographs by appointment only."');
  },

  ea_smi_trophies: async (s) => {
    await s.narrate('Rows of golden trophies: "World Martial Arts Champion", "Savior of Earth", "Best Moustache (Honorary)", "Cell Games - Winner by Default"...');
    if (s.check('chapter>=7')) await s.narrate('A new plaque sits slightly crooked: "Universe Exhibition Match - Moral Victory."');
  },

  ea_sh_clerk: async (s) => {
    const me = spk(s, 'ea_sh_clerk', 'ea_clerk');
    if (!s.flag('ea_shopSample')) {
      await s.talk([
        [me, 'Welcome to Champ Goods! Official Mr. Satan merchandise, approved by the Champion\'s own legal team.', 'happy'],
        [me, 'Today we\'re giving out free samples of Champion Cookies. Strength in every bite! Results not guaranteed.'],
      ]);
      s.set('ea_shopSample');
      await s.give('cookie', 2);
      return;
    }
    if (s.check('chapter>=12')) {
      await s.say(me, 'Great Saiyaman helmets are flying off the shelves! The movie hasn\'t even come out yet. The Champion is... thrilled. Mostly.', 'smirk');
      return;
    }
    await s.say(me, 'Our bestseller is still the Buu plushie. Squeeze it and it says "Buu hungry!" Don\'t squeeze it near the real one.');
  },

  ea_sh_customer: async (s) => {
    const me = spk(s, 'ea_sh_customer', 'kidNpc');
    await s.say(me, 'I\'ve saved up for a month for the Victory Pose action figure. The arm goes up AND down!', 'happy');
  },

  ea_sh_shelf: async (s) => {
    await s.narrate('Shelves of merchandise: Mr. Satan lunchboxes, Mr. Satan toothbrushes, a Mr. Satan cookbook titled "Eat Like a Champ"... and one dusty "Great Saiyaman" keychain.');
  },

  ea_sd_student1: async (s) => {
    const me = spk(s, 'ea_sd_student1', 'ea_student');
    if (s.check('chapter>=5')) {
      await s.say(me, 'Sensei Satan says the real secret of the Satan School is "showing up after the fight is already over." I think it\'s a riddle.');
      return;
    }
    await s.talk([
      [me, 'Osu! Welcome to the Satan Dojo. The floor in the middle is for sparring - feel free to use the punching bags.'],
      [me, 'Breaking jars builds focus. That\'s what Sensei says. The cleaning bill says otherwise.', 'smirk'],
    ]);
  },

  ea_sd_student2: async (s) => {
    const me = spk(s, 'ea_sd_student2', 'ea_student2');
    await s.talk([
      [me, 'Videl used to train here before she got married. She once threw the whole senior class out of the window. One at a time.', 'happy'],
      [me, 'We still practice the Videl Drop. Nobody\'s landed it yet.'],
    ]);
  },

  ea_sd_poster: async (s) => {
    await s.narrate('A huge poster of Mr. Satan mid-kick. The caption: "THE SATAN SCHOOL - Strength! Speed! Showmanship!" Below, in small print: "Mostly showmanship."');
  },

  // ================================================================ Kame House
  ea_ki_turtle: async (s) => {
    const me = spk(s, 'ea_ki_turtle', 'Turtle');
    if (s.check('chapter>=13')) {
      await s.say(me, 'Master Roshi\'s been doing push-ups! Real ones! I\'m over a thousand years old and I\'ve never seen that.', 'shock');
      return;
    }
    const n = s.inc('ea_ki_turtle_n');
    if (n === 1) {
      await s.talk([
        [me, 'Oh, hello! I\'m Turtle. I\'ve lived with Master Roshi for, oh... a few centuries now.', 'happy'],
        [me, 'He\'s inside, probably "researching." Knock loudly, and please don\'t mind the magazines.'],
      ]);
      return;
    }
    await s.say(me, 'The tide brings in all sorts of things. Last week it brought a whole lost spaceship. Master Roshi used it as a deck chair.');
  },

  ea_ki_sailor: async (s) => {
    const me = spk(s, 'ea_ki_sailor', 'ea_sailor');
    await s.talk([
      [me, 'Ahoy. I run the supply boat out here every Tuesday. Rice, fish, and a very suspicious number of magazines.'],
      [me, 'The old hermit tips well, but he keeps asking if I have any "fit young deckhands" for hire. Odd fellow.', 'smirk'],
    ]);
  },

  ea_kh_stairs: async (s) => {
    await s.narrate('Stairs to the upper floor. From above comes loud snoring - or possibly very enthusiastic "meditation."');
  },

  ea_kh_shelf: async (s) => {
    await s.narrate('A bookshelf crammed with "fitness magazines." A handful of real martial arts manuals sit at the very back, covered in dust.');
  },

  ea_kh_tv: async (s) => {
    if (s.check('chapter>=12')) {
      await s.narrate('The TV is tuned to a morning aerobics show. A sticky note on the screen: "DO NOT CHANGE CHANNEL - Roshi."');
      return;
    }
    await s.narrate('The TV plays a cooking show at full volume. On screen: "Today - Seafood Paella!" Turtle seems to find this upsetting.');
  },

  // ================================================================ The Lookout
  // LoG2 §9.3: Yajirobe hands over one free Senzu at each of his first three meetings. He camps at Korin's base
  // instead of travelling to you, so a "meeting" is the first talk in a chapter. At the next meeting he quits and
  // points you to Korin's 3-fish trade. A gift is never wasted: with a full pouch he holds it until a bean is eaten.
  ea_kb_yajirobe: async (s) => {
    const me = spk(s, 'ea_kb_yajirobe', 'yajirobe');
    const n = s.inc('ea_kb_yajirobe_n');
    const ch = s.state.data.chapter;
    const gifts = s.num(YAJI_GIFTS);
    const newMeeting = gifts === 0 || ch !== s.num(YAJI_GIFT_CH);
    if (gifts < YAJI_MAX_GIFTS && newMeeting) {
      if (s.flag(YAJI_HELD)) {
        await s.say(me, 'Ate one already, huh? Fine. Here\'s the bean I was holding for you. I only licked it a little.', 'smirk');
      } else if (n === 1) {
        await s.talk([
          [me, 'Hey! Get away from my fish. Find your own campfire.', 'angry'],
          [me, '...Oh. It\'s you, {hero}. What\'s up? Korin sent me down here to give you a little gift!', 'happy'],
        ]);
      } else if (gifts === 0) {
        await s.say(me, 'There you are, {hero}! Korin\'s been nagging me all week. He sent me down here to give you a little gift!', 'happy');
      } else {
        await s.say(me, 'What\'s up, {hero}? Korin sent me over here with another little gift. Don\'t tell him I ate the other one.', 'happy');
      }
      if (s.count('senzu') >= senzuMax()) {
        s.set(YAJI_HELD);
        await s.say(me, 'Huh, your pouch is already stuffed with beans. I\'ll, uh... hold onto this one. Come back after you\'ve eaten one.', 'smirk');
        return;
      }
      s.clear(YAJI_HELD);
      await s.give('senzu');
      s.set(YAJI_GIFTS, gifts + 1);
      s.set(YAJI_GIFT_CH, ch);
      if (gifts === 0) {
        await s.talk([
          [me, 'Senzu Beans fill up your health and energy! To use one, open your inventory. Don\'t waste it.'],
          [me, 'Need more? The cat up top trades \'em for fish. Three fish, one bean. Highway robbery.'],
          [me, 'Me? I don\'t climb the tower anymore. Too many stairs. Well, no stairs. That\'s the problem.'],
        ]);
      }
      return;
    }
    if (gifts >= YAJI_MAX_GIFTS && newMeeting && !s.flag(YAJI_QUIT)) {
      s.set(YAJI_QUIT);
      await s.talk([
        [me, 'I guess you\'re expecting me to give you a Senzu Bean, right?', 'smirk'],
        [me, 'Well, guess what? I\'m tired of running errands for that cat. From now on you get \'em yourself.', 'angry'],
        [me, 'Fly up to Korin and he\'ll set you up. Three fish a bean. But don\'t expect to get \'em for nothing!'],
      ]);
      return;
    }
    if (s.check('chapter>=5') && n > 1) {
      await s.say(me, 'Heard there was another big fight. I wasn\'t hiding. I was... guarding the forest. From the back. Very important job.', 'smirk');
      return;
    }
    await s.say(me, 'Want fish? Crabs and swamp vipers carry \'em around for some reason. Beat one up, sometimes a fish pops out. Don\'t ask me how.');
  },

  ea_kt_korin: async (s) => {
    const me = spk(s, 'ea_kt_korin', 'korin');
    if (!s.flag('ea_korinMet')) {
      s.set('ea_korinMet');
      await s.talk([
        [me, 'Hoho! A visitor. In my day, people climbed this tower with their own two hands. Took them days. Builds character.'],
        [me, 'I grow the Senzu Beans. One bean heals any wound and fills your belly for ten days. I\'ll trade one for three fresh fish.'],
      ]);
    }
    if (s.count('fish') >= 3) {
      if (s.count('senzu') >= 3) {
        await s.say(me, 'You\'re already carrying three beans. Greedy, greedy. Come back when you\'ve used one.', 'smirk');
        return;
      }
      const c = await s.ask(me, 'Mmm, I smell fish. Three fish for one Senzu Bean?', ['Trade', 'Not now']);
      if (c === 0 && s.take('fish', 3)) {
        await s.give('senzu');
        await s.say(me, 'A fair trade. Don\'t eat it all at once. ...That was a joke. It\'s one bean.', 'happy');
      } else {
        await s.say(me, 'Suit yourself. The beans aren\'t going anywhere. Neither am I.');
      }
      return;
    }
    if (s.check('chapter>=11')) {
      await s.say(me, 'The young man from the future came for beans again. His eyes... he\'s been through a lot. I gave him extra.', 'sad');
      return;
    }
    await s.say(me, 'Bring me three fish and I\'ll trade you a Senzu Bean. Creatures that live by the water - crabs, vipers - often have one on them.');
  },

  ea_lk_popo: async (s) => {
    const me = spk(s, 'ea_lk_popo', 'mrPopo');
    if (s.check('chapter>=13')) {
      await s.say(me, 'The flowers are restless. Something very large is about to happen to the whole universe. Mr. Popo will water them anyway.');
      return;
    }
    if (s.check('chapter>=7')) {
      await s.talk([
        [me, 'The Room of Spirit and Time has been busy. Mr. Popo cleans it after every visitor. Saiyans are very messy.'],
        [me, 'If you wish to use it, ask Dende first. And wipe your feet.'],
      ]);
      return;
    }
    const n = s.inc('ea_lk_popo_n');
    if (n === 1) {
      await s.talk([
        [me, 'Welcome to the Lookout. Mr. Popo tends the garden, the palace, and the young Guardian.', 'happy'],
        [me, 'That door by the palace leads to the Room of Spirit and Time. One year inside is one day outside. It is very hot, then very cold. Mr. Popo does not recommend it.'],
      ]);
      return;
    }
    await s.say(me, 'Every flower here was planted by a Guardian of Earth. Please walk on the paths.');
  },

  ea_lp_altar: async (s) => {
    await s.narrate('An old altar. Carvings show the Dragon Balls arranged in a circle, and a great dragon coiling over the Earth.');
  },

  ea_lp_books: async (s) => {
    await s.narrate('Ancient scrolls in a Namekian script, and a much newer notebook in Dende\'s handwriting: "Things Mr. Popo says I must not do - Volume 3."');
  },
});
