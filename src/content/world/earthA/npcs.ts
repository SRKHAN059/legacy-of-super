import type { Expression } from '../../../art/portrait';
import { registerScripts, type ScriptApi } from '../../../game/script';
import type { CharId } from '../../characters';
import { ITEMS } from '../../items';
import { heroTalk, type TalkLines } from '../earthB/talk';

/**
 * Ambient (non-story) dialogue for the Earth A hubs: Mt. Paozu, Satan City, Kame House and the Lookout. Every
 * script is prefixed `ea_` and safe to run in any chapter.
 *
 * LoG2's townsfolk branch on two things, and so do these (`EA_TALK`):
 *  - the character you play (its scripts test CurChar): every NPC has a reaction to each of the six main
 *    characters, played with West City's `heroTalk` rule (first talk as that character, then every other talk).
 *    Satan City adores Mr. Satan and is wary of Vegeta; the old-timers remember the Demon King when they see
 *    Piccolo; Korin, Popo, Turtle and Yajirobe know exactly who everyone is.
 *  - the story so far: the talks in between play the NPC's chatter for the current story point, keyed to the
 *    chapter and to the story flags and quests the acts set (Beerus's golden sky over the sea, Frieza's army, the
 *    day the Earth blew up and came back, Future Trunks's time machine and Goku Black's visit, the Mafuba lesson,
 *    the Days of Peace episodes, the Zeno tournament, Buu's hibernation, the empty city while the Mighty Ten are
 *    away, and the post-game). The chatter never names whoever might be listening: that is what reactions are for.
 * Mr. Satan himself answers from upstairs in his mansion (the staircase) whenever no chapter has him out front.
 */

// ------------------------------------------------------------------ NPC ids
const FARMER = 'ea_pv_farmer';
const ANGLER = 'ea_pv_fisher';
const UME = 'ea_ph_neighbor';
const FAN = 'ea_sc_fan';
const REPORTER = 'ea_sc_reporter';
const COP = 'ea_sc_police';
const GRANNY = 'ea_sc_granny';
const BANKER = 'ea_sc_suit';
const WAITER = 'ea_sc_waiter';
const TOURIST = 'ea_sc_tourist';
const JOGGER = 'ea_sc_jogger';
const VETERAN = 'ea_sc_oldman';
const SHOPPER = 'ea_sc_girl';
const AOKI = 'ea_sc_scientist';
const GARDENER = 'ea_sm_gardener';
const GUARD = 'ea_sm_guard';
const SWIMMER = 'ea_sm_swimmer';
const BUU = 'ea_smi_buu';
const BEE = 'ea_smi_bee';
const BUTLER = 'ea_smi_butler';
const CLERK = 'ea_sh_clerk';
const CUSTOMER = 'ea_sh_customer';
const SENIOR = 'ea_sd_student1';
const STUDENT = 'ea_sd_student2';
const TURTLE = 'ea_ki_turtle';
const FERRYMAN = 'ea_ki_sailor';
const YAJIROBE = 'ea_kb_yajirobe';
const KORIN = 'ea_kt_korin';
const POPO = 'ea_lk_popo';
/** The mansion staircase: Mr. Satan's voice from his private quarters. */
const STAIRS = 'ea_smi_stairs';

/** Buu's months-long hibernation starts when the ninth fighter signs up (Act 5's `c13_check`) and outlasts the tournament. */
export const BUU_ASLEEP = 'c13_friezaIntro';

/**
 * The day the Earth blew up and Whis rewound it. `c06_earthGone` only lives inside that one cutscene, so the townsfolk's
 * "it happened twice" chatter keys on `c06_won`, set just before the victory party hands control back.
 */
export const EARTH_RESTORED = 'c06_won';

/**
 * Goku Black's first visit to the present (Chapter 9's fight at Capsule Corp). Before it the hubs only know about
 * the time machine that crashed there.
 */
export const BLACK_SEEN = 'c09_blackDone';

/**
 * Chapter 11's Mafuba lesson at Kame House (Trunks and Goku, then Kami's bottle from Mr. Popo). The hubs are walkable
 * on both sides of it, so the news of the lesson waits for its journal entry.
 */
export const MAFUBA_TAUGHT = 'done:c11_q_mafuba';

// ------------------------------------------------------------------ dialogue model

/**
 * A story point: a chapter number (reached at `chapter>=n`) or any condition (`c07_champaDone`, `ea_buuAway&chapter==2`).
 * A flag key must outlive the scene that sets it, and a flag set in a chapter's last scene (`c02_rage`, `c03_beerusDone`,
 * `c11_farewell`) is first heard in the next chapter, where a step keyed to that chapter's number would hide it.
 */
export type StoryKey = number | string;

/** Story-ordered steps. The last step whose key holds is the current one (West City's `byChapter`, plus story flags). */
export type StoryTable<T> = Array<[StoryKey, T]>;

/** Pick the entry for the current story point. The first entry is the fallback. */
export function byStory<T>(s: Pick<ScriptApi, 'check'>, table: StoryTable<T>): T {
  let pick = table[0][1];
  for (const [key, v] of table) if (s.check(typeof key === 'number' ? `chapter>=${key}` : key)) pick = v;
  return pick;
}

/** One line with its portrait expression. */
type Moody = [string, Expression];

/**
 * What is said: a line by the NPC (default expression), a line with an expression, or an exchange
 * ([speaker, text, expression?] with the NPC's own id, 'hero' = you, 'narrator', or a cast id).
 */
export type Talk = string | Moody | TalkLines;

/** Lines an NPC rotates through on successive talks at the same story point. */
export interface Cycle {
  cycle: Talk[];
}

/** A reaction to a character that changes with the story. */
export interface Staged {
  story: StoryTable<Talk>;
}

/** Everything an ambient NPC can say outside its one-off beats (intros, gifts, trades). */
export interface NpcTalk {
  /** Reactions to the character you play (LoG2 CurChar branches). */
  heroes: Partial<Record<CharId, Talk | Staged>>;
  /**
   * Story-progress chatter. Every character hears it between reactions, so it never names a character who could be
   * the one listening at that point of the story (that belongs in `heroes`).
   */
  story: StoryTable<Talk | Cycle>;
}

function isMoody(t: Moody | TalkLines): t is Moody {
  return typeof t[0] === 'string';
}

function isStaged(r: Talk | Staged): r is Staged {
  return typeof r === 'object' && !Array.isArray(r);
}

function isCycle(c: Talk | Cycle): c is Cycle {
  return typeof c === 'object' && !Array.isArray(c);
}

/** Dialogue lines for `t`. Plain lines are spoken by `me`; in exchanges the NPC's own id becomes `me` too. */
export function talkLines(t: Talk, id: string, me: string, expr: Expression = 'neutral'): TalkLines {
  if (typeof t === 'string') return [[me, t, expr]];
  if (isMoody(t)) return [[me, t[0], t[1]]];
  return t.map(([who, text, e]): [string, string, Expression?] => [who === id ? me : who, text, e]);
}

/** The reaction `id` has for the active character right now (staged reactions follow the story), if any. */
export function reactionFor(s: Pick<ScriptApi, 'check' | 'hero'>, id: string): Talk | null {
  const r = EA_TALK[id]?.heroes[s.hero];
  if (!r) return null;
  return isStaged(r) ? byStory(s, r.story) : r;
}

/** Speaker id for an ambient NPC: the NPC itself when present, else a cast id / display name. */
function spk(s: ScriptApi, id: string, fallback: string): string {
  return s.exists(id) ? id : fallback;
}

/** Play the NPC's reaction to the active character when one is due (West City's `heroTalk` rule). */
async function react(s: ScriptApi, id: string, me: string, expr: Expression = 'neutral'): Promise<boolean> {
  const t = reactionFor(s, id);
  if (!t) return false;
  return heroTalk(s, id, { [s.hero]: talkLines(t, id, me, expr) });
}

/** Play the NPC's chatter for the current story point. */
async function chatter(s: ScriptApi, id: string, me: string, expr: Expression = 'neutral'): Promise<void> {
  const c = byStory(s, EA_TALK[id].story);
  const t = isCycle(c) ? c.cycle[(s.inc(`${id}_said`) - 1) % c.cycle.length] : c;
  await s.talk(talkLines(t, id, me, expr));
}

/** A townsperson's whole talk: their reaction to you when one is due, otherwise the news. */
async function townTalk(s: ScriptApi, id: string, me: string, expr: Expression = 'neutral'): Promise<void> {
  if (await react(s, id, me, expr)) return;
  await chatter(s, id, me, expr);
}

/** The active character's own remark at an examined object, if they have one. */
async function aside(s: ScriptApi, id: string): Promise<void> {
  const t = EA_ASIDES[id]?.[s.hero];
  if (t) await s.talk(talkLines(t, id, 'hero'));
}

/**
 * Mr. Satan is in his quarters unless a chapter has him out front in the garden (Acts 1-2: chapters 1, 4 and 5, and
 * Chapter 3 until the Champion Orb changes hands) or at Bulma's birthday cruise with Buu, or you are playing him.
 */
export function satanHome(s: Pick<ScriptApi, 'check' | 'hero'>): boolean {
  if (s.hero === 'satan') return false;
  if (s.check('chapter==1') || s.check('chapter==4') || s.check('chapter==5')) return false;
  return !s.check('chapter==3&!c03_satanDone') && !s.check('chapter==2&ea_buuAway');
}

/** Buu is hibernating (and won't wake for anyone). */
function buuAsleep(s: ScriptApi): boolean {
  return s.check(BUU_ASLEEP) || s.check('chapter>=14');
}

// ------------------------------------------------------------------ the townsfolk

/** Yajirobe's standing advice once the free beans are done. */
const YAJI_FISH_TIP = 'Want fish? Crabs and swamp vipers carry \'em around for some reason. Beat one up, sometimes a fish pops out. Don\'t ask me how.';
/** Korin's standing offer. */
const KORIN_TRADE = 'Bring me three fish and I\'ll trade you a Senzu Bean. Creatures that live by the water - crabs, vipers - often have one on them.';

/** Reactions and story chatter for every Earth A townsperson (keyed by NPC id; `STAIRS` is Mr. Satan's voice). */
export const EA_TALK: Record<string, NpcTalk> = {
  // ================================================================ Mt. Paozu
  [FARMER]: {
    heroes: {
      goku: [
        [FARMER, 'Goku! You promised to help with my harvest, then went for "a quick training run". Three days ago.', 'angry'],
        ['hero', 'Heh heh... I got a little carried away.', 'smirk'],
        [FARMER, 'Chi-Chi says you owe me a crate of radishes. And an apology. Mostly the radishes.'],
      ],
      vegeta: [
        [FARMER, 'You there! Quit glaring at my cows. They\'re skittish.', 'angry'],
        ['hero', 'I am not glaring. This is my face.', 'angry'],
        [FARMER, 'Well, your face is curdling the milk.'],
      ],
      gohan: ['Gohan! How\'s the book-learning? Videl brought me a pie last week. I\'m still full.', 'happy'],
      piccolo: [
        [FARMER, 'Gah! A green- oh, it\'s you. Gohan\'s teacher. You stood in my field all night once.', 'shock'],
        ['hero', 'I was meditating.'],
        [FARMER, 'Not one crow came near the place. Come meditate any time!', 'happy'],
      ],
      trunks: 'That sword\'s no good for weeding, young man. ...Huh. You look like Bulma\'s boy. Taller, though. And sadder.',
      satan: [
        [FARMER, 'MR. SATAN?! On my farm?! Honey! Get the camera! Get the GOOD radishes!', 'shock'],
        ['hero', 'HAHAHA! The Champion loves the countryside! Fresh air! Simple folk! ...Is that a dinosaur?!', 'shock'],
        [FARMER, 'Just a little one. He eats the turnips.'],
      ],
      android17: 'A ranger, eh? Then tell the dinosaurs to stay off my terraces. ...They listen to you? Well, I\'ll be.',
      frieza: [
        [FARMER, 'Can I help you, mister? You look a mite chilly.'],
        ['hero', 'What a quaint little planet. I might keep it.', 'smirk'],
        [FARMER, 'Land\'s not for sale. Especially not to fellas with tails.'],
      ],
    },
    story: [
      [0, { cycle: [
        [
          [FARMER, 'Gohan and Videl\'s place is up the path. Nice young couple. Quiet, except when they\'re "sparring".'],
          [FARMER, 'Last month a pterodactyl tried to nest on their roof. It flew off very politely after Videl had a word with it.', 'smirk'],
        ],
        'Goten drove the family tractor off the ridge again. Something orange caught it in mid-air. My wife fainted. I bought a new fence.',
      ] }],
      [2, 'A fancy car came for the little ones this morning. Some birthday on a boat. Up here we get cake on a stump, and we\'re grateful.'],
      [3, 'Chi-Chi\'s hunting for orange balls with little stars on them. Says a god wants a word. I gave her a radish. Seemed to help.'],
      ['c03_beerusDone', [
        [FARMER, 'You feel that quake the other night? The sky over the sea lit up gold, then red, then gold again.', 'shock'],
        [FARMER, 'My wife says the gods are fighting over our radishes. I say any god with taste is welcome to them.', 'happy'],
      ]],
      [5, [
        [FARMER, 'Spaceships full of soldiers just flew over the ridge, heading west! Folks say somebody\'s gone to meet them in a suit and tie!', 'shock'],
        [FARMER, 'My cows are hiding in the barn. Smart cows. Mountain life, eh?'],
      ]],
      [EARTH_RESTORED, ['I dreamed the whole mountain went white and quiet. Then my rooster crowed, same as always. Twice, now I think on it.', 'sad']],
      ['c07_champaDone', 'Chi-Chi says the whole planet\'s been bet on a tournament against "another universe". I nodded like I understood. I didn\'t.'],
      [8, 'So the planet\'s safe? Won "by a technicality", Chi-Chi says. My cows won the county fair by a technicality once. Still counts.'],
      [9, 'Heard a boom from West City way this morning. Chi-Chi says something "fell out of time". I said, "Out of WHAT?"'],
      [BLACK_SEEN, ['Folks in West City say a fella in a dark gi picked a fight over Capsule Corp, then just... vanished. Mid-punch.', 'sad']],
      [12, ['Little Pan floats over my terraces now. Lands in the cabbages, giggles, takes off again. Best scarecrow I ever had.', 'happy']],
      [13, 'Somebody\'s going door to door looking for "really strong fighters". I put my wife\'s name down. She hasn\'t stopped stretching.'],
      ['c14_departed', 'Quiet up here these days. No quakes, no golden lights, nobody crashing through my fence. Funny how you miss it.'],
      [15, ['Universe saved, they say. My fence is broken again, too. Everything\'s back to normal!', 'happy']],
    ],
  },

  [ANGLER]: {
    heroes: {
      goku: 'Goku! Last time you fished here you jumped in and came out with a carp in your teeth. Use the rod today, eh?',
      vegeta: [
        [ANGLER, 'Shh! You\'ll scare them off with that scowl.'],
        ['hero', 'I could boil this whole pond with one finger.', 'angry'],
        [ANGLER, 'And then what would you catch? Sit. Breathe. Be patient, sonny.'],
      ],
      gohan: ['Little Gohan! You used to come down here with a baby dragon on your head. The fish still remember you.', 'happy'],
      piccolo: 'You\'re the green fellow who stands under the waterfall. The fish think you\'re a rock. Highest praise a fisherman can give.',
      trunks: 'Sit a spell, young man. You\'ve got the shoulders of a fella who\'s carried too much. Fishing\'s good for that.',
      satan: [
        [ANGLER, 'The World Champion? At MY pond?', 'shock'],
        ['hero', 'HAHAHA! I once caught a whale with my bare hands! ...It was a small whale.', 'happy'],
        [ANGLER, 'Rod\'s over there, champ.', 'smirk'],
      ],
      android17: 'Park ranger, are you? Then you\'ll approve. I throw the little ones back.',
      frieza: [
        [ANGLER, 'Nice tail. Ever fish with it?'],
        ['hero', 'I have destroyed planets for less.', 'angry'],
        [ANGLER, 'Sure, sure. Bait\'s in the bucket.'],
      ],
    },
    story: [
      [0, 'Fish bite best when you\'re not watching. That goes for most things in life, youngster.'],
      ['c03_beerusDone', 'The pond rippled all night when the sky went gold. Fish wouldn\'t bite for days. Even the fish were scared, I reckon.'],
      [5, 'Folks are going on about aliens. Out here the only invaders are herons. Thieving birds.'],
      [EARTH_RESTORED, ['Caught the same fish twice in one morning. Same scar, same look of betrayal. Like the day ran itself over.', 'shock']],
      [9, 'A yellow egg-shaped machine whizzed overhead. Spooked my bobber clean under. Big fish, though.'],
      [12, ['A little girl flew over the pond yesterday. Flew! Couldn\'t have been older than a year. I\'m switching to decaf.', 'shock']],
      ['c14_departed', 'Pond\'s dead still today. Not a ripple, not a bite. Like the whole world\'s holding its breath.'],
      [15, ['Caught the big one this morning. Then I let him go. Felt like a day for second chances.', 'happy']],
    ],
  },

  [UME]: {
    heroes: {
      goku: [
        [UME, 'Goku! Chi-Chi\'s looking for you. She has the ladle.', 'shock'],
        ['hero', 'Uh-oh. Which ladle?', 'shock'],
        [UME, 'The big one.'],
      ],
      vegeta: [
        [UME, 'Oh! Bulma\'s husband. Chi-Chi calls you "that bad influence".'],
        ['hero', 'Kakarot is the bad influence.', 'angry'],
        [UME, 'She says that about him too. Pickle?', 'happy'],
      ],
      gohan: ['Gohan! Your mother brags about you to the whole valley. Professor this, research that. Sit, have a pickle.', 'happy'],
      piccolo: ['Mr. Piccolo! Chi-Chi says you\'re welcome for tea now. She used to chase you off with a broom. Progress!', 'happy'],
      trunks: 'Bulma\'s boy? No, you\'re older. Chi-Chi says you\'re "from the future". She also says Goku is "working". I believe one of those.',
      satan: [
        [UME, 'Mr. Satan! What brings the Champion all the way out to Mt. Paozu?', 'shock'],
        ['hero', 'Visiting my granddaughter\'s other grandma! Chi-Chi and I go WAY back! ...She scares me.', 'happy'],
      ],
      android17: 'You must be the ranger Goten keeps talking about. He wants to be a ranger now. Last week it was a dinosaur.',
      frieza: [
        [UME, 'Oh dear. Are you one of Goku\'s... friends?', 'shock'],
        ['hero', '"Friend" is a strong word.', 'smirk'],
        [UME, 'Well. Chi-Chi doesn\'t allow tails at the table. House rule.'],
      ],
    },
    story: [
      [0, 'Chi-Chi\'s radishes win the county fair every year. Her family eats the runners-up. Every year.'],
      [2, 'Goten and his friend went to some birthday on a ship. Chi-Chi packed them three lunches each. Saiyan portions.'],
      [4, [
        [UME, 'Chi-Chi says the men in this valley are "training with a god" now. And here I thought my husband\'s fishing trips were an excuse.', 'smirk'],
        [UME, 'Somebody has to help Chi-Chi with that field. Those radishes don\'t pull themselves.'],
      ]],
      [5, 'Aliens again! Chi-Chi locked every door, then unlocked them all. "The boys will want lunch after," she said.'],
      [EARTH_RESTORED, 'Chi-Chi dropped her best teapot this morning. Then it was back on the shelf. She says she\'s working too hard. So am I, apparently.'],
      ['c07_champaDone', 'A tournament against another universe, and Chi-Chi\'s first question was "Is there prize money?" There isn\'t. Poor woman.'],
      [8, [
        [UME, 'I came over to borrow sugar and ended up babysitting a baby who can fly. Pan floated right up to the rafters!', 'shock'],
        [UME, 'Chi-Chi just said "Oh, that\'s normal," and poured more tea.'],
      ]],
      [9, ['Bulma phoned in a panic. Something about a time machine crashing in her yard. Chi-Chi made rice balls. It\'s what she does.', 'shock']],
      [11, 'Chi-Chi says "the future" is in trouble again. She\'s packing lunches for it. I didn\'t ask how you mail rice balls to the future.'],
      [12, 'Quiet times again. Chi-Chi planted twice as many radishes. Somebody in that house is going to farm, like it or not.'],
      [13, ['If this tournament goes badly, "everything disappears", Chi-Chi says. She told the boys to be home by dinner. She\'s the brave one.', 'sad']],
      ['c14_departed', ['Chi-Chi\'s swept the same step all morning. She says she isn\'t worried. She\'s on her fourth broom.', 'sad']],
      [15, ['They\'re home! Chi-Chi cried, waved the big ladle around, then cried again. Lovely family.', 'happy']],
    ],
  },

  // ================================================================ Satan City - plaza
  [FAN]: {
    heroes: {
      goku: [
        [FAN, 'Mister, are you strong? You look kinda strong.'],
        ['hero', 'Pretty strong! Wanna see?', 'happy'],
        [FAN, 'Nah. Nobody\'s stronger than Mr. Satan. ...But you can carry my backpack.', 'happy'],
      ],
      vegeta: [
        [FAN, 'Whoa. Mister, why are you so grumpy? Did somebody beat you in a fight?', 'shock'],
        ['hero', '...', 'angry'],
        [FAN, 'It\'s okay! Mr. Satan beat EVERYBODY. There\'s no shame in it!', 'happy'],
      ],
      gohan: [
        [FAN, 'You\'re Videl\'s husband! Mr. Satan\'s son-in-law!', 'happy'],
        ['hero', 'That\'s me. Hi!', 'happy'],
        [FAN, 'Does he give you free lessons? Is he super strict? ...Why are you laughing?'],
      ],
      piccolo: [
        [FAN, 'Are you a monster? Are you gonna fight Mr. Satan?! He\'ll beat you SO bad!', 'shock'],
        ['hero', '...I\'ll take my chances.', 'smirk'],
      ],
      trunks: 'Cool sword! Are you a ninja? Mr. Satan beat a ninja once. Probably. He beat everybody once.',
      satan: [
        [FAN, 'M-M-M-MR. SATAN!!! It\'s really YOU!!!', 'shock'],
        ['hero', 'HAHAHA! Of course it\'s me! Who else has a jaw this heroic?', 'happy'],
        [FAN, 'Sign my forehead! I\'ll never wash it! Mom\'s gonna be SO mad!', 'happy'],
      ],
      android17: 'You\'re the ranger from TV! You punched a poacher\'s spaceship! ...Mr. Satan could do that too. Probably.',
      frieza: [
        [FAN, 'Whoa, cool costume! Are you a space emperor? Mr. Satan beats space emperors for breakfast!', 'happy'],
        ['hero', 'Does he now.', 'smirk'],
      ],
    },
    story: [
      [0, ['I polish the statue\'s toes every Sunday. For luck! Don\'t tell the park ranger.', 'happy']],
      ['c02_boarded', ['Mr. Satan went to a party on a GIANT ship! He took Buu! I bet he won every bingo game.', 'happy']],
      ['c03_beerusDone', ['When the sky went gold, Mr. Satan stood on his balcony and flexed at it. Then it stopped. COINCIDENCE? No!', 'happy']],
      [5, ['My mom says aliens are attacking. Don\'t worry, Mr. Satan will scare them off with his Victory Pose. That\'s how it works.', 'happy']],
      [EARTH_RESTORED, ['I dreamed the world blew up! Then Mr. Satan went "HAHAHA" and it un-blew. Best dream ever!', 'happy']],
      ['ea_buuAway&chapter==7', 'Mr. Buu\'s off on a sports trip to another universe! Mr. Satan\'s staying home to protect us. That\'s what heroes do.'],
      [8, ['Mr. Buu\'s back from his sports trip! He didn\'t even play. He says the snacks were the best part.', 'happy']],
      [9, 'My cousin saw a guy with a SWORD climb out of a flying egg in West City! I told Mr. Satan. He\'ll handle it.'],
      [12, [
        [FAN, 'They\'re filming a GREAT SAIYAMAN movie in town! With a monster! And robbers! And a bank!', 'shock'],
        [FAN, 'I asked the guy in the helmet for an autograph. He signed it, panicked, scribbled it out and signed it again. Weird guy.'],
      ]],
      [13, ['Mr. Buu beat a "champion of the gods" at some Expo! Mr. Satan trained him personally. Obviously.', 'happy']],
      [BUU_ASLEEP, 'Mr. Satan says Buu\'s taking a "very important nap". I take important naps too. Mom calls it "grounded".'],
      ['c14_departed', 'Grown-ups keep looking at the sky today. I\'m doing the Victory Pose at it. Just in case.'],
      [15, 'Grown-ups say the universe almost ended while we were asleep. I slept right through it! That\'s the BEST way to survive stuff.'],
      ['post_ztvSeen', ['The press conference is on every channel! A GOD OF DESTRUCTION! With a Dynamite Kick! I KNEW it!', 'happy']],
    ],
  },

  [REPORTER]: {
    heroes: {
      goku: { story: [
        [0, [
          [REPORTER, 'You! Farmer type! The Champion is searching the whole country for "a farmer called Goku". Know him?'],
          ['hero', 'Huh? That\'s me!', 'happy'],
          [REPORTER, 'Ha! Sure it is. And I\'m the World Champion. Next!', 'smirk'],
        ]],
        ['c01_metSatan', [
          [REPORTER, 'Hey! You\'re the farmer Mr. Satan gave a hundred million zeni to! Any comment on the donation?', 'happy'],
          ['hero', 'Uh... it bought a lotta food!', 'happy'],
          [REPORTER, '"It bought a lot of food." Inspiring. Front page.', 'smirk'],
        ]],
      ] },
      vegeta: [
        [REPORTER, 'Sir! You\'re married to Bulma Briefs! How does it feel to marry into the richest family on Earth?', 'happy'],
        ['hero', 'Get that camera out of my face before I melt it.', 'angry'],
        [REPORTER, '...We\'ll go with "no comment".', 'shock'],
      ],
      gohan: [
        [REPORTER, 'Son Gohan! Mr. Satan\'s son-in-law! Is the Champion as tough at home as he is on TV?'],
        ['hero', 'Oh, he\'s, um... very enthusiastic.', 'happy'],
        [REPORTER, '"Enthusiastic." That\'s a scoop.', 'smirk'],
      ],
      piccolo: [
        [REPORTER, 'Sir, ZTV News! Were you at the 23rd World Tournament? Did you see Mr. Satan-'],
        ['hero', 'Mr. Satan wasn\'t at the 23rd World Tournament.', 'angry'],
        [REPORTER, '...I\'ll check my notes.', 'shock'],
      ],
      trunks: 'Are you the "Mystery Swordsman" my viewers keep spotting? Any comment? No? Just a sad stare. Great visual. Keep rolling.',
      satan: [
        [REPORTER, 'CHAMP! ZTV News! Any words for your adoring city?', 'happy'],
        ['hero', 'HAHAHA! Tell them the Champion trains harder than ever! And buy the new lunchbox!', 'happy'],
        [REPORTER, 'And that\'s a wrap! Ratings gold, as always.', 'happy'],
      ],
      android17: 'Aren\'t you the ranger from that nature documentary? "Man Punches Poacher\'s Spaceship"? Our highest-rated show ever!',
      frieza: [
        [REPORTER, 'Sir! You look just like the alien emperor from the invasion! Can you describe it for our viewers?', 'shock'],
        ['hero', 'Gladly. It begins with your city on fire.', 'smirk'],
        [REPORTER, 'I\'m... going to go cover the bake sale.', 'shock'],
      ],
    },
    story: [
      [0, [
        [REPORTER, 'ZTV News, Satan City Desk! Do you have any comment on the Champion\'s new prize donation?', 'happy'],
        [REPORTER, 'Rumour says he\'s giving a hundred million zeni to some mountain farmer. A farmer! What did a farmer ever do to save the world?'],
      ]],
      [2, 'Capsule Corp\'s birthday cruise sails tonight. Every celebrity in the country is on board. My invitation got lost. In the mail.'],
      ['c02_rage', 'Big story: Capsule Corp\'s birthday cruise came home with a hole in the hull and every guest swearing "a cat did it".'],
      [4, { cycle: [
        'The sky over the sea lit up gold for an hour. Official cause: "festive weather". I\'ve seen festive weather. That wasn\'t it.',
        'Mr. Satan says he became a god and beat an evil deity called "Beavis". My editor wants a follow-up. I want a lie detector.',
      ] }],
      [5, ['Alien ships over the Rocky Wasteland, and a frozen-looking alien emperor! And the army won\'t let my van past the checkpoint!', 'angry']],
      [EARTH_RESTORED, 'Every camera in the city recorded the same day twice. ZTV legal says we "do not discuss the double Tuesday."'],
      ['ea_buuAway&chapter==7', 'Mr. Satan\'s pupil "Mr. Buu" left on a cultural exchange. With whom? "Universe Six," says the butler. Is that a hotel chain?'],
      [8, 'Mr. Buu is back from his "cultural exchange". The butler says he "failed the entrance exam". Exam for WHAT?'],
      [9, 'An egg-shaped craft crash-landed in West City. My editor says "time machine" isn\'t a real word. It\'s two words!'],
      [12, 'I\'m covering the Great Saiyaman movie! The lead actor won\'t stop calling the stunt double "the man Videl married instead".'],
      ['c12_filmDone', 'The movie set got invaded by a parasite that ate the lead actor\'s ego. Critics are calling it his best work.'],
      [13, 'Mr. Satan says his pupil Buu beat "a champion of the gods" at some Expo. Proof? "Buu ate a cake the size of a car." Exclusive!'],
      [BUU_ASLEEP, [
        [REPORTER, 'Exclusive tip: Majin Buu hasn\'t woken up in DAYS. Mr. Satan says he\'s "saving energy for something cosmic."', 'shock'],
        [REPORTER, 'Cosmic! My editor wants it on the front page. My gut says it\'s a nap.'],
      ]],
      ['c14_departed', 'Officer Krillin, his wife AND the old hermit all vanished the same morning. Is it a cult? A cruise? I need a source!'],
      [15, 'Everyone who vanished came home yesterday, hungry. "We were at a tournament," they say. What tournament?! No footage!'],
      ['post_ztvSeen', ['That press conference rerun just broke every ratings record in ZTV history. My editor wants a sequel. In SPACE.', 'smirk']],
    ],
  },

  [COP]: {
    heroes: {
      goku: [
        [COP, 'Hold it. Are you the fella Officer Krillin calls his best friend? He says you\'re a terrible driver.'],
        ['hero', 'Heh heh. Piccolo\'s worse!', 'happy'],
      ],
      vegeta: [
        [COP, 'Sir, you\'re loitering. And glaring. Glaring with intent.', 'angry'],
        ['hero', 'Arrest me, then.', 'smirk'],
        [COP, '...Have a nice day, sir. A very nice day. Please.', 'shock'],
      ],
      gohan: 'Gohan! Videl\'s husband! She still holds the precinct record for arrests. You must sleep with one eye open.',
      piccolo: [
        [COP, 'You there! Green fella! You match the Demon King in our oldest files.', 'shock'],
        ['hero', 'That was my father. Technically.'],
        [COP, '...I\'m going to pretend I didn\'t hear that.'],
      ],
      trunks: 'Carrying a sword in public needs a permit, son. ...A permit from the future doesn\'t count. Keep it sheathed, okay?',
      satan: [
        [COP, 'Mr. Satan, sir! Crime\'s at an all-time low, sir! All thanks to you!', 'happy'],
        ['hero', 'HAHAHA! Keep up the good work, officer! The Champion sees all!', 'happy'],
        [COP, '...And the young lady who used to patrol with us. Videl. Mostly her, sir.', 'smirk'],
      ],
      android17: 'A ranger! Monster Island\'s got jurisdiction problems, I hear. Poachers? Send \'em our way. Or just punch them. Same result.',
      frieza: [
        [COP, 'Freeze! ...Wait, that isn\'t your name, is it?', 'shock'],
        ['hero', 'Ohoho. Officer. How very brave.', 'smirk'],
        [COP, 'Backup. I need backup. I need Videl.', 'shock'],
      ],
    },
    story: [
      [0, [
        [COP, 'Move along, citizen. Nothing to see here. Unless you\'re here to see the statue. Then, plenty to see.'],
        [COP, 'Crime\'s at an all-time low. Criminals are scared Mr. Satan might be watching. Or worse, Videl.', 'shock'],
      ]],
      [2, 'Officer Krillin took the day off for a birthday on a boat. He left me his paperwork. And his lunch. Fair trade.'],
      ['c02_rage', ['Krillin came back from that boat party with seaweed in his hair. He won\'t say a word about it. He just shivers.', 'shock']],
      ['c03_beerusDone', 'We got a report of two men punching each other ABOVE the clouds. I wrote "pigeons" on the form. Nobody reads these forms.'],
      [5, 'Officer Krillin went off to "help with the alien thing". Took off his badge, put on his old gi. Hopes he "still has it".'],
      [EARTH_RESTORED, 'The whole precinct had the same nightmare last week. HR says it\'s workplace stress. HR had it too.'],
      [9, 'West City asked us to watch for "anything that fell out of the future". I\'ve checked the lost and found twice.'],
      [BLACK_SEEN, 'West City Police put out a bulletin: a man in a dark gi with a very nice smile. The nice smile is the suspicious part.'],
      [12, [
        [COP, 'Our colleague Krillin put in for leave. Said he wants to "get his edge back."'],
        [COP, 'Between you and me, he once stopped a getaway car by flicking it. I don\'t think his edge went anywhere.', 'smirk'],
      ]],
      ['c12_herbGot', 'Krillin\'s back from leave. Shaved head, gi under the uniform. He keeps "accidentally" lifting the squad car.'],
      [13, 'Krillin AND his wife are on patrol together this week. Crime is down a hundred percent. The criminals have complained.'],
      ['c14_departed', 'Krillin missed his shift. His note says "Saving the universe. Back by dinner." HR is furious.'],
      [15, ['Krillin\'s back. I asked how his tournament went. He said, "I was first out, but I got a shot in first." Good for him.', 'happy']],
    ],
  },

  [GRANNY]: {
    heroes: {
      goku: [
        [GRANNY, 'Oh my! The boy with the tail, all grown up! You flew past my window on a yellow cloud once and took my washing line.', 'happy'],
        ['hero', 'I did? Sorry, Granny! Did you get it back?', 'happy'],
        [GRANNY, 'A week later. Folded. On a dinosaur.', 'smirk'],
      ],
      vegeta: [
        [GRANNY, 'Young man, you\'ll get wrinkles frowning like that. Sit. I\'ll knit you a scarf. Pink. It\'ll brighten you up.'],
        ['hero', 'I am a prince.', 'angry'],
        [GRANNY, 'Then you\'ll want a little pink crown to match.', 'happy'],
      ],
      gohan: ['Little Gohan! Videl\'s young man! You take good care of that girl, and that baby. And wear a scarf, it\'s cold.', 'happy'],
      piccolo: [
        [GRANNY, 'Oh! You gave me a fright. You look just like the Demon King from the news, all those years ago.', 'shock'],
        ['hero', '...I get that a lot.'],
        [GRANNY, 'But you have kind eyes. He never did. Have a cracker.', 'happy'],
      ],
      trunks: [
        [GRANNY, 'You look like you\'ve seen the end of the world, dear.', 'sad'],
        ['hero', '...I have.', 'sad'],
        [GRANNY, 'Well. It\'s still here. Sit with an old woman a while.', 'happy'],
      ],
      satan: [
        [GRANNY, 'Ah, the loud man! You saved the city, didn\'t you? Twice, they say.', 'happy'],
        ['hero', 'HAHAHA! Three times, ma\'am! But who\'s counting?', 'happy'],
        [GRANNY, 'I still liked the oranges better.', 'smirk'],
      ],
      android17: 'A park ranger! My grandson wanted to be one. Then he became an accountant. Life happens, dear.',
      frieza: [
        [GRANNY, 'Oh, what a lovely shade of purple. Are you cold, dearie?'],
        ['hero', '...No one has ever asked me that.', 'shock'],
        [GRANNY, 'Take my scarf. I insist.', 'happy'],
      ],
    },
    story: [
      [0, [
        [GRANNY, 'This used to be Orange Star City, you know. Then that nice loud man saved everyone and they renamed it.', 'happy'],
        [GRANNY, 'I liked the oranges better. But don\'t tell anyone I said so.'],
      ]],
      ['c03_beerusDone', 'When the sky went gold I put on my best hat. If it\'s the end of the world, I\'ll be dressed for it.'],
      [5, 'Aliens again? In my day it was the Red Ribbon Army. Before that, the Demon King. You get used to it, dear.'],
      [EARTH_RESTORED, [
        [GRANNY, 'Dearie, did you have the dream too? The one where the world went boom, and then it was breakfast again?', 'sad'],
        [GRANNY, 'Half the city had it. The pharmacist is out of sleeping pills. I just knit faster.'],
      ]],
      [9, 'My grandson says a flying egg crashed into Capsule Corp. In my day, things fell from the sky politely. Rain, mostly.'],
      [12, ['My knitting circle is making a tiny cape for Mr. Satan\'s granddaughter. She flies, you know. Babies these days!', 'happy']],
      [13, 'The air feels... listened to, lately. As if someone very small and very powerful is deciding something.'],
      ['c14_departed', 'I woke up this morning and thought, "Today might be the last day of everything." So I had dessert first.'],
      [15, ['The air feels light again. Whatever it was, someone fixed it. Probably some nice young person who forgot to say goodbye.', 'happy']],
    ],
  },

  [BANKER]: {
    heroes: {
      goku: { story: [
        [0, 'Mr. Son? The Champion\'s office keeps asking us how to wire money to "a farmer with no bank account". Know anyone?'],
        ['c01_metSatan', [
          [BANKER, 'Ah. Mr. Son. Our hundred-million-zeni farmer. How is the money?'],
          ['hero', 'Chi-Chi says it\'s "safe". I\'m not allowed to know where.', 'happy'],
          [BANKER, 'A wise woman. Do tell Mrs. Son we offer very competitive rates.'],
        ]],
      ] },
      vegeta: 'Mr... Briefs? The Capsule Corp account holder\'s husband. Your gold card is ready. Please stop looking at the vault like that.',
      gohan: 'Mr. Son. Your research grant cleared. Your father-in-law co-signed it. In gold ink. With a signed photo attached.',
      piccolo: [
        [BANKER, 'Sir, do you have an account with us?'],
        ['hero', 'I don\'t need money. I drink water.'],
        [BANKER, 'A... remarkably low-risk lifestyle.'],
      ],
      trunks: 'We can\'t open an account under a name that already belongs to a nine-year-old. Unless you ARE the nine-year-old? No? Next!',
      satan: [
        [BANKER, 'Mr. Satan, sir! Your vault is ready! We added the mirror you asked for.', 'happy'],
        ['hero', 'HAHAHA! A champion must always check his hair before counting his money!', 'happy'],
      ],
    },
    story: [
      [0, [
        [BANKER, 'The City Bank handles the Champion\'s finances. Do you know how many statues one man can commission? Neither do we.'],
        [BANKER, 'He just withdrew a hundred million zeni in cash. In a suitcase. We had to borrow a forklift.', 'shock'],
      ]],
      ['c03_beerusDone', ['Insurance claims for "divine thunderstorm damage" are up four hundred percent. We had to invent a form for it.', 'sad']],
      [5, 'Our "alien invasion" policy has a waiting period of one invasion. Very popular right now.'],
      [EARTH_RESTORED, ['Our ledgers show every payment from last Tuesday went through twice. Accounting quit. Then un-quit.', 'shock']],
      ['c07_champaDone', 'The Champion\'s account is fine, before you ask. He did buy "one jumbo cake, to go, for another universe".'],
      [9, 'Capsule Corp stock jumped this morning. Rumour says Bulma has a time machine. Our investors would like a word with the future.'],
      ['c12_filmDone', 'A gang tried to rob us during the movie shoot. They hit the cardboard vault on the set across the street. Our best day.'],
      [BUU_ASLEEP, 'Mr. Buu\'s candy bill is down ninety percent this month. The Champion is fine. The candy shops are in mourning.'],
      [15, 'Business is booming. People spend more when they feel the world almost ended. Nobody knows why. They just feel generous.'],
    ],
  },

  [WAITER]: {
    heroes: {
      goku: [
        [WAITER, 'Welcome! Table for one?'],
        ['hero', 'Yep! And can I see the whole menu? Like, ALL of it?', 'happy'],
        [WAITER, 'Sir, the menu is four pages long.'],
        ['hero', 'Perfect. I\'ll have four pages.', 'happy'],
      ],
      vegeta: [
        [WAITER, 'Would sir care for our Dynamite Kick Parfait?', 'happy'],
        ['hero', 'I would care for you to never say "Dynamite Kick" near me again.', 'angry'],
        [WAITER, 'One... plain coffee, then.', 'shock'],
      ],
      gohan: 'Mr. Son! Your wife ordered you the Champion\'s Special last week and you fell asleep in the whipped cream. Long night?',
      piccolo: 'Just water? Very good, sir. Our finest. Straight from the tap. ...A straw? No? Right.',
      trunks: 'Something warm, sir? You look like you haven\'t had a proper meal in years. It\'s on the house. I insist.',
      satan: { story: [
        [0, [
          [WAITER, 'Mr. Satan! Your usual? Two Dynamite Parfaits and a bucket of whipped cream for Mr. Buu?', 'happy'],
          ['hero', 'HAHAHA! Make it three! My Buu has been a VERY good boy this week!', 'happy'],
        ]],
        [BUU_ASLEEP, [
          [WAITER, 'Mr. Satan! Just the one parfait, sir? With Mr. Buu still... resting?', 'sad'],
          ['hero', 'Two! Box his up. The Champion\'s buddy is going to wake up HUNGRY!', 'happy'],
        ]],
      ] },
    },
    story: [
      [0, 'Seating\'s outside only today. The kitchen\'s still recovering from Mr. Buu\'s visit.'],
      [3, 'Our Royal Pudding sold out in a minute today. A customer said "a god is waiting". Gods, it seems, love custard.'],
      [4, ['A tall gentleman with blue skin and a staff tipped us in "the finest compliments in the universe". Cleaned out the cakes.', 'smirk']],
      [5, 'Half our customers fled when the alien ships flew over. The other half finished their parfaits first. Priorities.'],
      ['c07_champaDone', 'A round purple gentleman and a lady in teal ordered one of everything "to compare with our universe". Then seconds "to be fair".'],
      [12, 'A man in a long coat sat in the corner all night and never ordered. Left a tip anyway. Nobody saw him leave.'],
      [BUU_ASLEEP, ['Mr. Buu hasn\'t come in for a week. We baked his usual cake anyway. Out of respect. Then we ate it. Out of grief.', 'sad']],
      [15, ['A tall blue gentleman with a staff ordered every dessert "to celebrate a universe saved". Lovely tipper. Strange toast.', 'happy']],
    ],
  },

  [TOURIST]: {
    heroes: {
      goku: [
        [TOURIST, 'Could you take my picture with the statue?', 'happy'],
        ['hero', 'Sure! ...Which side is the front of this thing?', 'happy'],
        [TOURIST, 'That\'s a sandwich, sir. That\'s MY sandwich.', 'shock'],
      ],
      vegeta: [
        [TOURIST, 'Excuse me, are you a local? Which statue is the best one?'],
        ['hero', 'The one that\'s melting.', 'angry'],
        [TOURIST, 'None of them are... oh. Oh no.', 'shock'],
      ],
      gohan: [
        [TOURIST, 'You look like you know things. Is the Champion really as strong as they say?'],
        ['hero', '...He\'s got a really strong heart.', 'happy'],
      ],
      piccolo: [
        [TOURIST, 'Is that a costume? Are you part of the Mr. Satan show?', 'shock'],
        ['hero', 'I play the villain.', 'smirk'],
        [TOURIST, 'Can I get a photo? Do the villain face! ...That\'s just your face? Perfect!', 'happy'],
      ],
      trunks: 'Ooh, a sword! Is there a samurai festival? You look like a poster from one of those Capsule Corp adverts.',
      satan: [
        [TOURIST, 'MR. SATAN?! In person?! I flew three thousand kilometres for THIS!', 'shock'],
        ['hero', 'HAHAHA! And the Champion flew three thousand kilometres... in his heart!', 'happy'],
        [TOURIST, 'I don\'t know what that means but I\'m CRYING.', 'happy'],
      ],
    },
    story: [
      [0, [
        [TOURIST, 'I flew in from the South Islands just to see the statue! Then I saw the OTHER statue. And the other one. How many are there?!', 'happy'],
        [TOURIST, 'The hotel\'s fully booked by Mr. Satan fan clubs. I\'m sleeping on a bench tonight. Worth it!'],
      ]],
      ['c03_beerusDone', ['I came for the statues and got a golden sky show! The brochure never mentioned a light show. Five stars.', 'happy']],
      [5, 'My tour group got evacuated during the "alien thing". Then un-evacuated. Then evacuated again. I\'ve seen a LOT of bus stations.'],
      ['ea_buuAway&chapter==7', 'I took the "Mr. Satan\'s Home" tour. The guide said Buu was away "on business in another universe". Great writing on these tours.'],
      [8, 'The tour guide says Mr. Buu is back from "another universe" and "very full". The writing on these tours keeps getting better.'],
      [12, ['There\'s a movie shooting in town! I\'m an extra! I play "Screaming Bystander Number Six". I\'ve been practising.', 'happy']],
      [13, 'I\'m extending my stay. Something big is going on. Everyone\'s so... alert. Feels like the city before a big game.'],
      [15, ['Best vacation ever. Statues, a golden sky, aliens, a movie, a tournament nobody can explain... Same time next year!', 'happy']],
    ],
  },

  [JOGGER]: {
    heroes: {
      goku: [
        [JOGGER, 'Huff... Want to... run a lap with me...?'],
        ['hero', 'Sure!', 'happy'],
        ['narrator', 'Goku laps the whole avenue before the jogger takes two steps.'],
        [JOGGER, 'Huff... I hate... this city...', 'sad'],
      ],
      vegeta: [
        [JOGGER, 'Huff... Nice form... You train...?'],
        ['hero', 'In three hundred times Earth\'s gravity.', 'smirk'],
        [JOGGER, 'Huff... I train... in sneakers...', 'sad'],
      ],
      gohan: 'Huff... Hey, I know you... The researcher... I went to your public lecture... fell asleep... no offense...',
      piccolo: 'Huff... Is that a weighted cape...? Respect... I\'m wearing... ankle weights... of shame...',
      trunks: 'Huff... You look like... you run from things... a lot... Me too... Taxes...',
      satan: [
        [JOGGER, 'Huff... MR. SATAN...! Do you really... run a hundred laps...?', 'shock'],
        ['hero', 'HAHAHA! Two hundred! Before breakfast! ...Which I eat in the limo.', 'happy'],
      ],
    },
    story: [
      [0, 'Huff... Every morning... I run the Avenue of Champions... Fifty laps... Mr. Satan does a hundred... allegedly...'],
      ['c03_beerusDone', ['Huff... Did you see that guy... with red hair... flying above the clouds? I was running... and he passed me... upward.', 'shock']],
      [5, 'Huff... I ran away... from the aliens... at a personal best... Every cloud... has a silver lining...'],
      [EARTH_RESTORED, ['Huff... My watch says... I ran my morning route... twice... I only remember once...', 'shock']],
      [9, 'Huff... Heard a crash... over West City... Some kind of flying egg... I didn\'t stop... to look...'],
      [BLACK_SEEN, 'Huff... My cousin in West City... saw a guy in a dark gi... He smiled at her... She hasn\'t slept since...'],
      ['c12_hitDone', 'Huff... I jog at night now... Saw a guy on the hotel roof... eating rice... one grain at a time... Weirdo...'],
      [13, 'Huff... Everybody\'s training lately... Even that old hermit... on the island... I saw him... doing push-ups...'],
      [15, ['Huff... New personal best... I feel like... I could run forever... like the universe... wants me to...', 'happy']],
    ],
  },

  [VETERAN]: {
    heroes: {
      goku: [
        [VETERAN, 'Wait... that grin. YOU! The monkey-tailed boy! You beat me in the first round!', 'shock'],
        ['hero', 'Huh? Oh! Did we have lunch after?', 'happy'],
        [VETERAN, 'We did! You ate mine. Thirty years and I still want a rematch.', 'happy'],
      ],
      vegeta: [
        [VETERAN, 'Hmph. Proud stance, that. All chin. A clever fighter would go straight for it.'],
        ['hero', 'Many have tried.', 'smirk'],
        [VETERAN, 'And?'],
        ['hero', 'And they are no longer trying.', 'angry'],
      ],
      gohan: 'You fight like a scholar, son. You think first. Good. The thinkers are the ones who live long enough to retire.',
      piccolo: [
        [VETERAN, 'Junior! The 23rd Tournament! You were the green fellow who fought the monkey boy in the final!', 'shock'],
        ['hero', '...You have a good memory, old man.', 'smirk'],
        [VETERAN, 'Best final I ever saw. You lost with dignity.', 'happy'],
      ],
      trunks: 'You hold that sword like a man who\'s had to use it. Not for sport. I\'m sorry, son.',
      satan: [
        [VETERAN, 'Mr. Satan. You won the 24th Tournament fair and square. I was there.'],
        ['hero', 'HAHAHA! Of course! ...Wait, really? You believe me?', 'shock'],
        [VETERAN, 'The 24th, I said. Not the Cell Games.', 'smirk'],
      ],
      android17: 'Hm. You fight like a hunter, not a brawler. Calm. That\'s rarer than strength, young man.',
    },
    story: [
      [0, 'Back in my day, a fellow blew up the moon at the World Tournament. The MOON. Now they hand out trophies for posing.'],
      ['c03_beerusDone', 'When the sky went gold, my old knees stopped aching. Haven\'t felt that strong in forty years. Something divine was up there.'],
      [5, 'I\'d have joined the fight against those aliens, but my back went out. During the warm-up. Of the warm-up.'],
      [7, ['Saw a fellow at the noodle stand last week with that monkey boy\'s grin. Ate twenty bowls. Must run in the family.', 'smirk']],
      [12, 'The Satan Dojo takes older students now. I went. They had me break a jar. The jar won.'],
      [13, 'There\'s a smell in the air, like the night before a big tournament. Somebody, somewhere, is about to fight for everything.'],
      [15, ['I watched the sky all week. Whatever happened up there, the good side won. You feel it in the bones.', 'happy']],
    ],
  },

  [SHOPPER]: {
    heroes: {
      goku: [
        [SHOPPER, 'Ooh, your gi is SO retro. Orange is totally back. Who\'s your designer?', 'happy'],
        ['hero', 'Uh... Chi-Chi?', 'happy'],
      ],
      vegeta: [
        [SHOPPER, 'Cute boots! Are those designer?', 'happy'],
        ['hero', 'They are Saiyan battle boots.', 'angry'],
        [SHOPPER, 'Saiyan! Is that a brand? I want them in pink.', 'happy'],
      ],
      gohan: 'Gohan! Videl\'s husband! Tell her the boutique has her colour back in stock. She\'ll know which.',
      piccolo: 'That cape and turban combo is BOLD. I love it. Very "mysterious desert sorcerer".',
      trunks: 'Long coat, red scarf, sword... very end-of-the-world chic. Where do you even SHOP?',
      satan: [
        [SHOPPER, 'MR. SATAN! I own SEVEN of your gold jackets!', 'shock'],
        ['hero', 'HAHAHA! Only seven? The Champion owns forty! One for each day of the week! ...The weeks are long.', 'happy'],
      ],
    },
    story: [
      [0, [
        [SHOPPER, 'The boutique\'s closed for a "Satan Day" display change. Every year it\'s a new gold jacket.'],
        [SHOPPER, 'Champ Goods next door is open, though. They sell the cutest Buu plushies. They squeak when you hug them!', 'happy'],
      ]],
      ['c02_rage', 'Bulma Briefs had her birthday on a CRUISE SHIP. I saw the photos. One guest was a purple cat in a robe. Fashion!'],
      [4, 'A tall blue man in a gorgeous robe bought every cake in the plaza. And his neck ring! I need to know where he got it.'],
      ['ea_buuAway&chapter==7', 'Champ Goods marked down the Buu plushies while Mr. Buu\'s away "in another universe". I bought six.'],
      [8, 'Mr. Buu\'s home, so the plushies are back to full price. I bought a seventh anyway. Don\'t judge me.'],
      [12, ['Champ Goods has a new Great Saiyaman helmet. It lights up! I bought two. One for my cat.', 'happy']],
      [13, 'They\'re selling "End of the Universe" party hats at the boutique. Nobody knows why. They\'re selling out.'],
      [15, ['Limited edition: "I Survived the Tournament of Power" shirts! I don\'t know what it was, but I survived it!', 'happy']],
    ],
  },

  [AOKI]: {
    heroes: {
      goku: [
        [AOKI, 'Fascinating! Your vital signs are off the charts. May I take a blood sample?', 'shock'],
        ['hero', 'Is that the thing with the needle? No thanks!', 'shock'],
      ],
      vegeta: [
        [AOKI, 'Sir, you\'re emitting energy in the "hostile" range. Is that a medical condition?'],
        ['hero', 'It\'s my personality.', 'angry'],
      ],
      gohan: [
        [AOKI, 'Son Gohan! I read your last paper. Brilliant! You should join our department.', 'happy'],
        ['hero', 'Thank you, Professor! I\'ll... check my training schedule.', 'happy'],
        [AOKI, 'Training? For a lecture?'],
      ],
      piccolo: 'A Namekian! May I measure your antennae? With a ruler. Just a ruler. Please don\'t look at me like that.',
      trunks: [
        [AOKI, 'Your coat carries an isotope signature that won\'t exist for another twenty years. How?', 'shock'],
        ['hero', '...Laundry.'],
      ],
      satan: [
        [AOKI, 'Mr. Satan. The subject of my "Champion Effect" study himself. Would you stand near a statue? For science.'],
        ['hero', 'HAHAHA! For science, the Champion will stand near ANY statue!', 'happy'],
      ],
    },
    story: [
      [0, [
        [AOKI, 'Professor Aoki, Satan City University. I\'m studying the "Champion Effect": crime drops near every statue.'],
        [AOKI, 'My hypothesis? Gold is very reflective. Burglars hate being seen.', 'smirk'],
      ]],
      ['c03_beerusDone', 'During the golden sky event my instruments recorded two energies colliding above the stratosphere. I\'ve named them A and B.'],
      [5, 'Alien ships! I begged the army for a debris sample. They said "after the invasion". As if invasions keep office hours!'],
      [EARTH_RESTORED, 'Hypothesis: last week happened twice. Evidence: two copies of the same receipt. Peer review: my cat. She agrees.'],
      [9, [
        [AOKI, 'My seismographs registered a disturbance in the fourth dimension. Yes, I own a seismograph for that.', 'shock'],
        [AOKI, 'Capsule Corporation won\'t return my calls. Typical.'],
      ]],
      [12, { cycle: [
        ['My fourth-dimension seismograph has gone silent. Not quiet. SILENT. As if a whole timeline was simply... erased.', 'shock'],
        'New study: infants who fly. Sample size: one. Her grandfather threatened me with a lawsuit and a lollipop.',
      ] }],
      [13, 'My instruments detect a vast presence "above" twelve whole universes. Twelve! I\'ve only ever counted one.'],
      ['c14_departed', 'My readings say eight universes are currently... in a room. A very large, very empty room. I\'ve changed the batteries twice.'],
      [15, ['Universes that went dark on my instruments are back. All of them. I\'m writing a paper. Nobody will read it.', 'happy']],
    ],
  },

  // ================================================================ Satan City - mansion grounds
  [GARDENER]: {
    heroes: {
      goku: 'Mind the hedges, Mr. Son. Last time you visited, you "practised" on the topiary. It\'s still shaped like a fist.',
      vegeta: [
        [GARDENER, 'Careful where you stand, sir. Those are prize begonias.'],
        ['hero', 'I could level this garden with a sneeze.', 'angry'],
        [GARDENER, 'Then please aim the sneeze at the weeds.'],
      ],
      gohan: 'Young Mr. Gohan! Miss Videl planted that cherry tree the day she met you. Don\'t tell the Champion I said so.',
      piccolo: [
        [GARDENER, 'You\'ve got a green thumb, sir. Well, a green everything.', 'smirk'],
        ['hero', '...The roses need more water.'],
        [GARDENER, 'They DO! You can tell? Come back any time, sir.', 'happy'],
      ],
      trunks: 'You\'re looking at the flowers like you\'ve never seen a garden before, son. Take your time. They\'re not going anywhere.',
      satan: [
        [GARDENER, 'Welcome home, Mr. Satan! The topiary is finished. Note the heroic moustache.', 'happy'],
        ['hero', 'HAHAHA! Magnificent! Make the biceps bigger. And the other biceps.', 'happy'],
      ],
    },
    story: [
      [0, [
        [GARDENER, 'Thirty-two rosebushes, eleven hedge sculptures, and one Mr. Satan topiary. Mind the topiary\'s nose.'],
        [GARDENER, 'Mr. Buu helps with the weeding. Well, he turns the weeds into candy. It\'s not technically weeding.', 'smirk'],
      ]],
      ['ea_buuAway&chapter==2', 'The Champion and Mr. Buu went to a party on a ship. The topiary and I are having a quiet day.'],
      [3, 'The Champion had me bury his "Champion Orb" in the trophy garden for safekeeping. Then dig it up. Twice before lunch.'],
      [5, 'Alien soldiers? Mr. Buu turned three of my rosebushes into gumdrops "so the aliens can\'t have them". Very thoughtful.'],
      ['ea_buuAway&chapter==7', 'Mr. Buu\'s joined a team to fight another universe. The garden\'s so quiet. I almost miss the candy weeds.'],
      [8, ['Mr. Buu\'s home! First thing he did was turn the weeds into candy again. I missed it. Don\'t tell him.', 'happy']],
      [12, ['The Champion\'s granddaughter flew into the hedge maze yesterday. Flew OUT the top. He fainted in the begonias.', 'shock']],
      [BUU_ASLEEP, ['Mr. Buu fell asleep in my flowerbed again. Days now. I\'ve been watering around him.', 'sad']],
      [15, 'Mr. Buu\'s still asleep. I\'ve planted his favourite candy-flowers all around the window, so he wakes up to them.'],
    ],
  },

  [GUARD]: {
    heroes: {
      goku: 'Mr. Son, sir. The Champion left word: you may come in any time. Please use the door. The DOOR.',
      vegeta: [
        [GUARD, 'Halt! Name and business?', 'angry'],
        ['hero', 'Vegeta. My business is none of yours.', 'angry'],
        [GUARD, '...The Champion did say to let in anyone who scares me. Go right ahead, sir.', 'shock'],
      ],
      gohan: 'Mr. Gohan! Family\'s always welcome. The Champion says you\'re "the second strongest man in the house". He\'s first, he says.',
      piccolo: [
        [GUARD, 'Sir, I have to ask: are you on the list?'],
        ['hero', 'Do I look like I\'m on a list?', 'smirk'],
        [GUARD, '...You look like the list is on you. Go ahead.', 'shock'],
      ],
      trunks: 'No weapons past the gate, sir. ...That\'s not a toy, is it. Please keep it on your back and your hands where I can see them.',
      satan: [
        [GUARD, 'Welcome home, Champ! All quiet, sir!', 'happy'],
        ['hero', 'HAHAHA! Of course it\'s quiet! Nobody would dare attack the Champion\'s house!', 'happy'],
        [GUARD, 'Well, there was that pink thing that one time, sir.'],
        ['hero', 'That pink thing is my best friend!', 'angry'],
      ],
      android17: 'You\'re the ranger from Monster Island, right? The Champion likes your show. Just don\'t bring any of the animals inside.',
      frieza: [
        [GUARD, 'H-halt! Who goes there?!', 'shock'],
        ['hero', 'Someone you will tell your grandchildren about. If you have the time to have any.', 'smirk'],
        [GUARD, 'MR. BUU! MR. BUU, COULD YOU COME OUT HERE PLEASE?!', 'shock'],
      ],
    },
    story: [
      [0, [
        [GUARD, 'Welcome to the Satan Mansion. The Champion is very generous with visitors - as long as they don\'t ask for a demonstration.'],
        [GUARD, 'The dojo out east is open to students. Watch out for the jars. The Champion\'s students break about forty a week.'],
      ]],
      ['ea_buuAway&chapter==2', 'The Champion\'s at a birthday cruise with Mr. Buu. I\'m guarding an empty house and a very confused dog.'],
      [5, 'Security\'s doubled since the alien business. Not that it matters. The big pink fella in there is the real security system.'],
      ['ea_buuAway&chapter==7', 'With Mr. Buu away, I\'m the only security here. Me and a dog. The dog is better at it.'],
      [12, 'Some fella in a long coat was standing on the hotel roof across the plaza at midnight. Didn\'t move for an hour. Creepy.'],
      [BUU_ASLEEP, 'Mr. Buu\'s been asleep for days. The Champion says to keep the noise down. I\'ve been whispering at burglars.'],
      ['c14_departed', 'The Champion paces upstairs all night. Says he can feel "the whole universe being very nervous". Me too, I guess.'],
      [15, ['Whatever had the whole city so jumpy is over. Even the dog sleeps through the night again.', 'happy']],
    ],
  },

  [SWIMMER]: {
    heroes: {
      goku: 'Wanna race? Two laps! ...Wait. You can\'t swim faster than that. Nobody can. Are you even touching the water?',
      vegeta: [
        [SWIMMER, 'Hey! No glaring in the pool area. Fan club rules.', 'smirk'],
        ['hero', 'I am not in the pool area.', 'angry'],
        [SWIMMER, 'You\'re glaring AT the pool area. Same thing.'],
      ],
      gohan: 'Gohan! Videl taught half the fan club to swim here. She threw us all in. It worked!',
      piccolo: 'You\'re kind of overdressed for the pool, mister. Wanna borrow some trunks? ...Swim trunks. Not a person.',
      trunks: 'Hey, the water\'s great. You look like you could use a day off. Like, a hundred days off.',
      satan: [
        [SWIMMER, 'MR. SATAN! Do the Champion Cannonball! PLEASE!', 'happy'],
        ['hero', 'HAHAHA! Stand back, everyone! The Champion Cannonball makes TIDAL WAVES!', 'happy'],
        ['narrator', 'Mr. Satan cannonballs into the pool. It is, in fairness, a very big splash.'],
      ],
    },
    story: [
      [0, ['Mr. Satan lets the fan club use the pool on weekends! The water\'s heated to exactly "Champion temperature". Nobody knows what that means.', 'happy']],
      ['c03_beerusDone', ['When the sky went gold, the pool got WARM. Hot-spring warm. Best swim of my life.', 'happy']],
      [5, 'The fan club pool party got cancelled because of "aliens". Rescheduled for next weekend. Aliens permitting.'],
      ['ea_buuAway&chapter==7', 'Mr. Buu cannonballed into the pool before leaving for his "sports trip". We\'re still finding water in the garage.'],
      [8, ['Pool party\'s back on! Mr. Buu came home with a cake "from another universe". It tasted like Earth cake. Big, though.', 'happy']],
      [12, ['A flying baby did a perfect dive into the deep end yesterday. Mr. Satan did a less perfect dive after her. Both fine!', 'happy']],
      [BUU_ASLEEP, 'Pool\'s closed. The Champion says no splashing while Mr. Buu is "hibernating". Kind of sweet, honestly.'],
      [15, ['Pool\'s open again! There\'s a "Universe Saved" party on Saturday. Nobody knows which universe. We\'re partying anyway.', 'happy']],
    ],
  },

  // ================================================================ Satan City - mansion interior
  [BUU]: {
    heroes: {
      goku: { story: [
        [0, [
          [BUU, 'Goku! Goku play with Buu?', 'happy'],
          ['hero', 'Next time, Buu! Save your energy for the big fights.', 'happy'],
          [BUU, 'Buu always have energy! Buu run on candy!', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Goku pokes Buu\'s belly. It wobbles. Buu does not wake.'],
          ['hero', 'Sleep well, buddy. We\'ll win this one for you.', 'happy'],
        ]],
      ] },
      vegeta: { story: [
        [0, [
          [BUU, 'Vegeta! Vegeta go BOOM one time. Buu remember.', 'shock'],
          ['hero', '...So do I. It didn\'t work.', 'angry'],
          [BUU, 'Buu not mad. Buu make Vegeta candy. Grumpy candy!', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Vegeta stares down at the snoring Buu.'],
          ['hero', 'Sleeping through the end of the universe. Hmph. Typical.', 'angry'],
        ]],
      ] },
      gohan: { story: [
        [0, [
          [BUU, 'Gohan! Pan daddy! Buu babysit Pan! Buu best babysitter!', 'happy'],
          ['hero', 'Ha ha... Videl mentioned that. Thanks, Buu. No candy beams near the baby, okay?', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Buu snores. Gohan quietly tucks a blanket around Bee.'],
          ['hero', 'Rest up, Buu. Mr. Satan will be lonely without you.', 'sad'],
        ]],
      ] },
      piccolo: { story: [
        [0, [
          [BUU, 'Green man! Green man want candy?', 'happy'],
          ['hero', 'I only drink water.'],
          [BUU, 'Buu make water candy!', 'happy'],
          ['narrator', 'A puff of pink smoke. Piccolo is now holding an ice cube.'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Piccolo listens to Buu\'s snoring for a long moment.'],
          ['hero', 'His ki is calm. Deeper than sleep. He won\'t wake for months.'],
        ]],
      ] },
      trunks: { story: [
        [0, [
          [BUU, 'Purple hair boy! No... BIG purple hair boy! Buu confused.', 'shock'],
          ['hero', 'I\'m the Trunks from the future. It\'s... complicated.', 'happy'],
          [BUU, 'Buu like complicated. Complicated taste like caramel.', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Trunks watches the big pink belly rise and fall.'],
          ['hero', 'In my time, we never let you wake up at all. Here, you\'re family. ...Sleep well, Buu.', 'happy'],
        ]],
      ] },
      satan: { story: [
        [0, [
          [BUU, 'MR. SATAN! Buu missed you! Buu missed you SO much!', 'happy'],
          ['hero', 'Buu! I was only gone twenty minutes!', 'happy'],
          [BUU, 'Twenty minutes VERY long! Buu make you chocolate! Buu make you TWO!', 'happy'],
          ['hero', 'HAHAHA! That\'s my best friend! One for me and one for Bee. Deal?', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Mr. Satan sits on the edge of the sofa and pulls the blanket up to Buu\'s chin.'],
          ['hero', 'Sleep as long as you need, buddy. The Champion will keep the candy cupboard full.', 'sad'],
          ['hero', 'And if any more gods come knocking, I\'ll tell them you\'re resting. Very firmly!', 'shock'],
        ]],
      ] },
      android17: { story: [
        [0, [
          [BUU, 'Ranger man! You like animals? Buu animal? Buu not sure.', 'happy'],
          ['hero', 'You\'re a protected species, Buu. Definitely.', 'smirk'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', '17 checks Buu\'s breathing the way a ranger checks a hibernating bear.'],
          ['hero', 'Healthy. Deep hibernation. Leave him be.'],
        ]],
      ] },
      frieza: { story: [
        [0, [
          [BUU, 'Buu not like you. You smell like mean.', 'angry'],
          ['hero', 'And you smell like a candy shop exploded.', 'smirk'],
          [BUU, 'Thank you!', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Frieza regards the sleeping Buu with mild disgust.'],
          ['hero', 'THIS is what I\'m replacing? How utterly insulting.', 'angry'],
        ]],
      ] },
    },
    story: [
      [0, 'Buu and Bee best friends. Bee good boy. Buu good boy too!'],
      [2, 'Mr. Satan say party tonight! Buu bring big appetite! Buu bring two big appetites!'],
      ['c02_rage', ['Buu met scary purple cat at party. Cat want Buu pudding. Buu eat pudding first! Then cat beat Buu up. ...Worth it.', 'angry']],
      ['c03_satanDone', 'Royal Pudding best pudding! Buu not mad at cat anymore. ...Buu little bit mad at cat.'],
      [4, 'Blue man with stick eat cake at cafe. Blue man say cake "magnificent". Buu like blue man. Blue man know cake.'],
      [5, 'Bad aliens come? Mr. Satan say Buu stay home and guard candy. Buu very brave guard. Buu guard candy... inside Buu.'],
      [EARTH_RESTORED, ['Buu have bad dream. Whole world go poof. Buu wake up, world still here. Buu eat breakfast twice. To be safe.', 'sad']],
      [8, 'Buu take test for tournament! Buu draw candy on every answer. Lady say zero points. Buu watch fight with snacks. Best day!'],
      [12, 'Mr. Satan granddaughter fly to Buu! Buu make Pan candy. Mr. Satan say no candy for baby. So Buu eat it. Problem solved!'],
      [13, 'Buu fight at big party with gods! Buu beat doggy man! Mr. Satan say Buu go to big tournament. Buu train... after nap.'],
      [BUU_ASLEEP, [
        ['narrator', 'Majin Buu is snoring like a thunderstorm. Bee is curled up on his belly, rising and falling with each breath.'],
        [BUU, 'Zzz... mmm... chocolate... Zzz...'],
      ]],
      [15, [
        ['narrator', 'Majin Buu sleeps on. A sign is taped to his belly: "UNIVERSE SAVED. WAKE ME FOR CAKE." It is in Mr. Satan\'s handwriting.'],
        [BUU, 'Zzz... best friend... strongest... Zzz...'],
      ]],
    ],
  },

  [BEE]: {
    heroes: {
      goku: [['narrator', 'Bee leaps into Goku\'s arms and licks his face.'], ['hero', 'Ha ha! Hey, Bee! You\'ve gotten heavier!', 'happy']],
      vegeta: [['narrator', 'Bee sniffs Vegeta\'s boots, then sits down very politely.'], ['hero', 'Hmph. At least the dog knows royalty.', 'smirk']],
      gohan: [['narrator', 'Bee rolls over for a belly rub. Gohan obliges.'], ['hero', 'Who\'s a good boy? You are! ...Don\'t tell Videl I used the baby voice.', 'happy']],
      piccolo: [
        ['narrator', 'Bee growls at Piccolo\'s cape, then tries to eat a corner of it.'],
        ['hero', '...Let go.', 'angry'],
        ['narrator', 'Bee does not let go.'],
      ],
      trunks: [['narrator', 'Bee drops a chewed ball at Trunks\'s feet and wags.'], ['hero', 'There weren\'t many dogs left in my time. ...Okay, buddy. One throw.', 'happy']],
      satan: [
        ['narrator', 'Bee goes wild, spinning in circles and barking at Mr. Satan.'],
        ['hero', 'BEE! My brave boy! You\'re the reason Buu and I became friends, you know! HAHAHA!', 'happy'],
      ],
      android17: [['narrator', 'Bee sniffs 17\'s hand and immediately sits, perfectly still.'], ['hero', 'Good dog. Better trained than most rangers.', 'smirk']],
      frieza: [['narrator', 'Bee bares his teeth and growls at Frieza. Brave dog.'], ['hero', 'How charming. It thinks it can protect something.', 'smirk']],
    },
    story: [
      [0, { cycle: ['Woof! Woof!', 'Arf! (Bee wags his tail so hard his whole body wiggles.)'] }],
      ['ea_buuAway&chapter==2', [['narrator', 'Bee keeps trotting to the door and whining. Buu went to a party without him.']]],
      ['chapter==5', [['narrator', 'Bee is hiding under the sofa. He has been there since the alien ships flew over.']]],
      ['ea_buuAway&chapter==7', [['narrator', 'Bee sits by the door, waiting for Buu to come home from his tournament.']]],
      [8, { cycle: ['Woof! Woof!', 'Arf! (Bee wags his tail so hard his whole body wiggles.)'] }],
      [12, [['narrator', 'Bee is wearing a tiny Great Saiyaman helmet. He seems very proud of it.'], [BEE, 'Arf!']]],
      [BUU_ASLEEP, [['narrator', 'Bee is curled up on Buu\'s belly. He thumps his tail once, but he will not leave his friend.']]],
      [15, [['narrator', 'Bee has a new tag on his collar: "UNIVERSE 7 MASCOT". He is still guarding Buu.'], [BEE, 'Woof!']]],
    ],
  },

  [BUTLER]: {
    heroes: {
      goku: 'Mr. Son. The Master asks that you be offered every courtesy, and no food. He remembers the last banquet.',
      vegeta: [
        [BUTLER, 'Prince Vegeta. I\'m afraid the Master is... not at home.'],
        ['hero', 'I can sense him upstairs.', 'smirk'],
        [BUTLER, 'He is not at home to princes, sir.'],
      ],
      gohan: 'Young Master Gohan. Miss Videl\'s room is kept exactly as she left it. The Master dusts it himself. He weeps a little.',
      piccolo: 'Good day, sir. May I take your cape? ...No? Your turban? Very well. I shall simply stand here, holding nothing.',
      trunks: 'Welcome, sir. You bear a remarkable resemblance to young Master Briefs. Shall I announce you as... the elder Master Briefs?',
      satan: [
        [BUTLER, 'Welcome home, Master. Shall I draw the victory bath?', 'happy'],
        ['hero', 'HAHAHA! Not yet, Jeeves! The Champion trains first! ...Then the bath. With the bubbles.', 'happy'],
        [BUTLER, 'My name is not Jeeves, sir. As always.'],
      ],
    },
    story: [
      [0, [
        [BUTLER, 'Good day. I am the head butler of the Satan household. Please refrain from feeding Mr. Buu before supper. Or after. Or during.'],
        [BUTLER, 'The trophy room is to your left. Every trophy is genuine, except the honorary ones. Which is most of them.'],
      ]],
      ['ea_buuAway&chapter==2', 'The Master and Mr. Buu are at a birthday cruise. I have been instructed to "guard the fridge". I take it very seriously.'],
      ['c03_satanDone', 'The Master\'s "Champion Orb" has left the house. He insists it was a loan. He also insists pudding is a business expense.'],
      [4, 'The Master told the press he defeated a god named "Beavis". I have ordered extra hairspray for the follow-up interviews.'],
      [5, 'The Master has retired to the panic room for the alien incident. He calls it "the strategy room". He is strategising with snacks.'],
      [EARTH_RESTORED, 'Every clock in the house is a day behind. Or ahead. I have stopped winding them. Time is no longer my department.'],
      ['ea_buuAway&chapter==7', 'Mr. Buu has joined a tournament in "another universe". The Master has rehearsed his welcome-home speech forty times. It is mostly sobbing.'],
      [8, 'Mr. Buu returned having failed a written examination. The Master framed a photocopy. The original, I am told, belongs to a god.'],
      [9, 'Since the news of a time machine in West City, the Master has hidden his diary "in case they read the future". It is mostly menus.'],
      [12, 'Miss Pan visits on Sundays. The Master lets her win at arm-wrestling. He insists he is letting her win.'],
      [13, 'Mr. Buu won his bout at the gods\' "Expo". The Master has ordered a commemorative statue. Of Mr. Buu. Holding the Master.'],
      [BUU_ASLEEP, 'The Master is upstairs rehearsing a speech for "the end of the universe". He insists it is a metaphor. I have stopped asking.'],
      ['c14_departed', 'The Master has not left Mr. Buu\'s side. He reads him the sports pages. Aloud. With voices.'],
      [15, 'All is as it was. The fridge is full, the house is calm, and Mr. Buu sleeps on. I may even take a holiday.'],
    ],
  },

  // Mr. Satan's voice from his quarters (the staircase): he reacts to whoever is downstairs.
  [STAIRS]: {
    heroes: {
      goku: [
        ['mrSatan', 'Is that GOKU?! Don\'t come up! I mean, come up! No, don\'t! What do you want?!', 'shock'],
        ['hero', 'Just saying hi, Mr. Satan!', 'happy'],
        ['mrSatan', 'HAHAHA! Hi! Hi, buddy! Tell Chi-Chi the Champion says hi! From a safe distance!', 'happy'],
      ],
      vegeta: [
        ['mrSatan', 'Who\'s down th- V-V-VEGETA?! The Champion is NOT home! This is a recording! BEEEEP!', 'shock'],
        ['hero', 'Pathetic.', 'angry'],
      ],
      gohan: [
        ['mrSatan', 'Gohan, my boy! Did you bring Pan?! Grandpa\'s coming down! As soon as I find my other slipper!', 'happy'],
        ['hero', 'She\'s with Videl today, Mr. Satan.', 'happy'],
        ['mrSatan', '...Then the slipper can wait.', 'sad'],
      ],
      piccolo: [
        ['mrSatan', 'Who\'s that? ...The tall green fellow! You watch Pan sometimes, don\'t you?', 'shock'],
        ['mrSatan', 'You\'re a good man, Mr. Piccolo! Scary! But good! Please stay downstairs!', 'happy'],
      ],
      trunks: [
        ['mrSatan', 'Is that Bulma\'s boy? No, too tall... A time traveller?! HAHAHA! The Champion has met MANY time travellers!', 'happy'],
        ['mrSatan', '...Have I? I feel like I would remember that.'],
      ],
      satan: { story: [
        [0, [
          ['narrator', 'Your own private staircase. The velvet rope is for other people.'],
          ['hero', 'HAHAHA! Home sweet home! Buu? Bee? The Champion is HOME!', 'happy'],
        ]],
        [BUU_ASLEEP, [
          ['narrator', 'Your own private staircase. The velvet rope is for other people.'],
          ['hero', 'HAHAHA! Home sweet h- ...Shh. Buu\'s sleeping. The Champion is home. Quietly.', 'sad'],
        ]],
      ] },
      android17: [
        ['mrSatan', 'Is that the ranger from TV? Android... something? HAHAHA! Big fan! Huge! Please don\'t come up!', 'shock'],
      ],
      frieza: [
        ['mrSatan', 'Wh-who\'s there? That voice... THE ALIEN EMPEROR?! BUU! BUU, WAKE UP! BUUUUU!', 'shock'],
        ['hero', 'Ohoho. Your champion hides under the bed. How very Earthling.', 'smirk'],
      ],
    },
    story: [
      [0, ['Who\'s down there? Autographs are by appointment! ...Oh, what the heck, the Champ\'s in a good mood. Come back later!', 'happy']],
      [2, ['Is it time for Bulma\'s party?! Buu! Have you seen my party jacket? The gold one! No, the OTHER gold one!', 'shock']],
      ['c03_satanDone', { cycle: [
        ['My Buu is smiling again! The Champion owes you one! ...One autograph, I mean.', 'happy'],
        ['What a party! Buu wouldn\'t share his pudding with a cat-god, and the whole boat limped home! The Champion hid. Bravely.', 'shock'],
      ] }],
      [6, ['The press loved my story! "Mr. Satan, God of Martial Arts!" I\'m practising my divine pose. Like the regular one, but holier!', 'happy']],
      [EARTH_RESTORED, ['Did anybody else feel the whole house disappear for a second?! No? Just me? Must be the Champion\'s... sensitive... ki!', 'shock']],
      ['ea_buuAway&chapter==7', 'Buu\'s going to fight in ANOTHER UNIVERSE?! Who\'s going to eat my cooking?! Who\'s going to tell me I\'m strong?! ...Bee? Bee, come here!'],
      [8, ['Buu\'s home! He failed some test, but the Champion says: tests are for people who aren\'t already champions!', 'happy']],
      [9, ['A time machine crashed in West City?! Tell anybody from the future that the Champion is on vacation! Indefinitely!', 'shock']],
      [12, ['Pan? Is that my granddaughter?! ...Oh. It\'s you. Have you seen Pan? She flies now. Grandpa can\'t catch her!', 'sad']],
      [13, ['Buu\'s going to the big tournament! I\'ve been training him myself! He did ten sit-ups! TEN! ...Then he had a snack.', 'happy']],
      [BUU_ASLEEP, ['Buu won\'t wake up. The doctor says it\'s "hibernation". I\'ll... I\'ll keep his candy fresh till he does. Don\'t worry, buddy.', 'sad']],
      ['c14_departed', ['They\'re fighting for the whole universe and Buu\'s asleep and I\'m... upstairs. Somebody tell me when it\'s over!', 'shock']],
      [15, ['We\'re still here! The universe is still here! HAHAHA! I KNEW they could do it! ...I mean, I knew I could. Through them.', 'happy']],
      ['post_ztvSeen', ['Did you see my press conference?! Record ratings! Lord Beerus sent me a very scary letter. I framed it.', 'happy']],
    ],
  },

  // ================================================================ Satan City - Champ Goods
  [CLERK]: {
    heroes: {
      goku: 'Ooh, you look like the "Mystery Fighter" figure from our Cell Games line. Discontinued. Nobody bought it. Sorry!',
      vegeta: [
        [CLERK, 'Can I interest you in a Mr. Satan bobblehead?', 'happy'],
        ['hero', 'You can interest me in burning this shop to the ground.', 'angry'],
        [CLERK, '...We have a strict no-returns policy on threats, sir.', 'shock'],
      ],
      gohan: [
        [CLERK, 'Sir! The very last Great Saiyaman keychain! A collector\'s item! Nobody even remembers who he was!', 'happy'],
        ['hero', 'Ha ha... yeah. Nobody.', 'smirk'],
      ],
      piccolo: 'Sir, would you consider modelling for our costume aisle? That turban would sell a thousand turbans.',
      trunks: 'Swords are in the toy aisle. ...Oh. That\'s a REAL sword. Please keep it away from the inflatables.',
      satan: [
        [CLERK, 'Mr. Satan! Our best customer AND our best product!', 'happy'],
        ['hero', 'HAHAHA! I\'ll take one of everything with my face on it! ...Employee discount?', 'happy'],
        [CLERK, 'Sir, you own the store.'],
      ],
    },
    story: [
      [0, 'Our bestseller is still the Buu plushie. Squeeze it and it says "Buu hungry!" Don\'t squeeze it near the real one.'],
      [3, 'New in stock: "Champion Orb" replicas! Orange, with stars, just like the real one! We\'ve never seen the real one.'],
      [4, 'Hot item: the "Mr. Satan Beat Beavis" commemorative mug. For some reason the artist put a cat on it.'],
      [5, 'We sold out of "Mr. Satan Protects Earth From Aliens" shirts in an hour. Printed them during the invasion. Pure hustle.'],
      ['ea_buuAway&chapter==7', 'Buu plushies are half price while Mr. Buu is away. Sales are up. Turns out people miss him.'],
      [8, 'New: the "Mr. Buu Takes a Test" plushie. Comes with a tiny exam paper. Every answer is a drawing of candy.'],
      [12, ['Great Saiyaman helmets are flying off the shelves! The movie isn\'t even out yet. The Champion is... thrilled. Mostly.', 'smirk']],
      ['c12_filmDone', 'The Great Saiyaman movie is a smash! The Champion asked for a cameo in the sequel. He wants to play "the real hero".'],
      [13, 'Strange order this week: ten good-luck headbands, one extra-extra-large, one Namekian-sized. Billed to Capsule Corp.'],
      [15, ['Our new bestseller: the "God Slayer" action figure. Comes with a tiny Dynamite Kick and an even tinier disclaimer.', 'happy']],
    ],
  },

  [CUSTOMER]: {
    heroes: {
      goku: [
        [CUSTOMER, 'Mister, can you reach the top shelf?'],
        ['narrator', 'Goku hops up to the top shelf and back down without touching the ladder.'],
        [CUSTOMER, 'You jumped like ten metres. Can you do that again?! Can you teach me?!', 'shock'],
      ],
      vegeta: [
        [CUSTOMER, 'Mister, are you here for the Mr. Satan figure too? I saw it first!', 'angry'],
        ['hero', 'I would rather die.', 'angry'],
        [CUSTOMER, 'Good! More for me!', 'happy'],
      ],
      gohan: 'You\'re Pan\'s daddy! Pan bit my finger at the park. It was so cool. Can she bite me again?',
      piccolo: 'Whoa, are you an action figure? A real-life one? Can I see if your arm goes up AND down?',
      trunks: 'You look like the hero of my comic book! He\'s from the future and he\'s sad all the time. Want a gummy?',
      satan: [
        [CUSTOMER, 'MR. SATAN! I\'ve been saving for a MONTH for your action figure!', 'shock'],
        ['hero', 'HAHAHA! For my most loyal fan, the Champion will... sign the box!', 'happy'],
        [CUSTOMER, 'You\'re not gonna BUY it for me? ...Signing\'s good too!', 'happy'],
      ],
    },
    story: [
      [0, ['I\'ve saved up for a month for the Victory Pose action figure. The arm goes up AND down!', 'happy']],
      [3, 'Now I\'m saving for the Royal Pudding plushie. It\'s a pudding. That\'s a plushie. Mr. Buu loves pudding.'],
      [5, 'Mom says aliens attacked. I\'m saving for the Mr. Satan Alien-Fighting Kit. It\'s a stick and a cape.'],
      ['ea_buuAway&chapter==7', 'Mr. Buu\'s going to another universe! I\'m saving for a ticket. How much is a ticket to another universe?'],
      [8, 'Now I\'m saving for the Majin Buu cake-hat. It\'s a hat. That\'s a cake. Buu wore one on TV.'],
      [9, 'My brother saw a time machine in West City. I\'m saving up for a time machine now. I have four zeni.'],
      [12, ['I got the Great Saiyaman helmet! Now I\'m saving for the Great Saiyaman watch. It doesn\'t do anything. I NEED it.', 'happy']],
      [13, 'The Victory Pose figure\'s sold out. Grown-ups are buying good-luck charms. Grown-ups are weird this week.'],
      [15, ['I finally got the Victory Pose figure! The arm goes up AND down! It was worth the whole universe!', 'happy']],
    ],
  },

  // ================================================================ Satan City - dojo
  [SENIOR]: {
    heroes: {
      goku: [
        [SENIOR, 'Osu! A challenger? Sensei says to always accept a challenge!', 'shout'],
        ['hero', 'Really? Great! Let\'s go!', 'happy'],
        [SENIOR, '...Sensei also says to know when to bow out. Osu. Bowing out.', 'shock'],
      ],
      vegeta: [
        [SENIOR, 'Osu! Welcome to the Satan Dojo, sir! Shall I teach you the Victory Pose?', 'happy'],
        ['hero', 'Show me that pose and it will be your last.', 'angry'],
        [SENIOR, 'O-osu...', 'shock'],
      ],
      gohan: 'Osu! Senpai Gohan! Is it true you trained under Sensei? ...Why are you laughing, senpai?',
      piccolo: 'Osu! Are you a Namekian? Sensei says Namekians are "just guys in really good makeup". ...You\'re not in makeup. Osu. Sorry.',
      trunks: 'Osu! A swordsman! The Satan School has no sword style. Sensei says swords are "cheating with extra steps".',
      satan: [
        [SENIOR, 'OSU! SENSEI IS HERE! Everybody bow!', 'shout'],
        ['hero', 'HAHAHA! At ease! Today\'s lesson: the Dynamite Kick! Watch closely. Closer. Not THAT close.', 'happy'],
      ],
    },
    story: [
      [0, [
        [SENIOR, 'Osu! Welcome to the Satan Dojo. The floor in the middle is for sparring - feel free to use the punching bags.'],
        [SENIOR, 'Breaking jars builds focus. That\'s what Sensei says. The cleaning bill says otherwise.', 'smirk'],
      ]],
      [2, 'We have guest instructors this week! Sensei calls them his "old sparring partners". They didn\'t seem to know that.'],
      [4, 'Sensei says he beat a god called "Beavis", so now we have Divine Combat 101. It\'s mostly posing at the sky.'],
      [5, 'Sensei says the real secret of the Satan School is "showing up after the fight is already over." I think it\'s a riddle.'],
      [EARTH_RESTORED, 'During meditation the whole dojo felt the world end. Then begin again. Sensei says it was "a really good stretch".'],
      ['c07_champaDone', 'We asked Sensei if he\'d fight in the tournament against another universe. He had a dentist appointment.'],
      [9, 'Sensei cancelled class. He heard a time machine landed in West City and says he\'s "guarding the timeline". From under his bed.'],
      [12, ['Sensei\'s granddaughter came to class. She\'s one. She threw me across the room. Sensei says she gets it from him.', 'shock']],
      [13, 'Sensei has us practising cheering stances this week. For a tournament he "can\'t talk about". Our cheering is very advanced.'],
      [15, ['The universe got saved and nobody knows who did it. We\'re crediting "the Satan School spirit". I was cheering REALLY hard.', 'happy']],
    ],
  },

  [STUDENT]: {
    heroes: {
      goku: 'You\'re Gohan\'s dad?! Videl says you\'re the strongest man alive. Sensei says that\'s HIM. One of them is lying and I\'m scared of both.',
      vegeta: [
        [STUDENT, 'Hey! No street shoes on the mat!', 'angry'],
        ['hero', '...', 'angry'],
        [STUDENT, 'K-keep them on! Shoes are great! I love shoes!', 'shock'],
      ],
      gohan: [
        [STUDENT, 'Gohan! Show us the move Videl always talks about! The one where you FLY!', 'happy'],
        ['hero', 'Uh... maybe after class.', 'happy'],
      ],
      piccolo: 'You\'re the green guy from Videl\'s photos! She says her baby only stops crying when YOU hold her. Is that true?',
      trunks: 'Hey, cool sword. Do you sponsor fighters? You look like you\'ve got Capsule Corp money. Can you sponsor me?',
      satan: [
        [STUDENT, 'Sensei! I\'ve almost landed the Videl Drop!', 'happy'],
        ['hero', 'HAHAHA! My daughter learned everything from me! ...Except that one. I don\'t know that one.', 'shock'],
      ],
    },
    story: [
      [0, [
        [STUDENT, 'Videl used to train here before she got married. She once threw the whole senior class out of the window. One at a time.', 'happy'],
        [STUDENT, 'We still practise the Videl Drop. Nobody\'s landed it yet.'],
      ]],
      [2, 'Capsule Corp donated the punching bags. They\'re rated for "Saiyan use". Whatever that means, they\'re HEAVY.'],
      [5, ['Videl visited with her baby! Pan kicked a punching bag off its chain. She\'s a few months old!', 'shock']],
      [10, 'Videl says her father-in-law went to the FUTURE. Sensei said that\'s impossible. Then he went very pale.'],
      [12, 'I tried the Videl Drop at the movie audition. Landed on the director. Didn\'t get the part.'],
      [13, 'Everybody\'s training harder lately. Sensei says the air "smells like a big fight". I think it\'s the mats.'],
      [15, 'We added a new move to the curriculum: the "Universe Seven". Nobody knows what it is. We just yell it.'],
    ],
  },

  // ================================================================ Kame House
  [TURTLE]: {
    heroes: {
      goku: [
        [TURTLE, 'Goku! Remember when you found me lost in the woods and carried me all the way back to the sea?', 'happy'],
        ['hero', 'Ha ha, sure do! You were heavy!', 'happy'],
        [TURTLE, 'I was not! ...I was a little.', 'sad'],
      ],
      vegeta: ['Oh! Um. Hello, Prince Vegeta. Master Roshi\'s inside. I\'ll just be... over here. In my shell.', 'shock'],
      gohan: 'Gohan! I remember when you were small enough to ride on my back. Now you\'d squash me flat. Please don\'t.',
      piccolo: 'Piccolo! You used to scare me terribly. You still do. But in a friendly way now. I think.',
      trunks: 'Hello, young man. You have Bulma\'s eyes. She rode on my back too, once. A very long time ago.',
      satan: [
        [TURTLE, 'Mr. Satan! Master Roshi has your poster!', 'happy'],
        ['hero', 'HAHAHA! Of course he does! Where does he hang it?', 'happy'],
        [TURTLE, '...In the bathroom.', 'smirk'],
      ],
      android17: 'Oh, you look like 18! Her brother? She visits Krillin here. She never brings me snacks. Do you? No? Family resemblance.',
      frieza: [['narrator', 'Turtle takes one look at Frieza and pulls his head into his shell. He refuses to come out.']],
    },
    story: [
      [0, 'The tide brings in all sorts of things. Last week it brought a whole lost spaceship. Master Roshi used it as a deck chair.'],
      [2, 'Master Roshi went to a party on a cruise ship! He packed sunscreen, a snorkel and a VERY small swimsuit. I stayed home.'],
      [4, 'Krillin visits more often lately. He says police work is "peaceful". He says it like it hurts.'],
      [5, ['Master Roshi\'s gone to fight an alien army! With his shirt off! I have never been so proud or so embarrassed.', 'shock']],
      [EARTH_RESTORED, 'The sea went still for a moment, as if the whole world stopped breathing. Then a wave hit me in the face. Very rude.'],
      [9, 'A time machine crashed at Capsule Corp, they say. Master Roshi asked if anyone from the future brought magazines.'],
      [BLACK_SEEN, 'Master Roshi sat up and said he felt "a familiar ki gone cold". Then he put his magazine down. He never does that.'],
      [11, 'Bulma phoned about "a god who can\'t die". Master Roshi went very quiet. The Evil Containment Wave cost his own master his life.'],
      [MAFUBA_TAUGHT, 'Master Roshi sealed a fly in our rice cooker for the lesson. We have no rice cooker now. Or fly.'],
      [12, { cycle: [
        ['Master Roshi found his sealing charm on the table after everyone left. So what went to the future? ...His ramen coupon. Oh dear.', 'shock'],
        ['Krillin\'s moping on the beach. He says he\'s "lost his edge". I told him turtles don\'t have edges and we\'re very happy.', 'sad'],
      ] }],
      ['c12_herbGot', 'Krillin came back from the Forest of Terror with his head shaved and his eyes clear. He looks years younger. I look a thousand.'],
      [13, ['Master Roshi\'s been doing push-ups! Real ones! I\'m over a thousand years old and I\'ve never seen that.', 'shock']],
      ['c14_departed', 'Master Roshi left for the tournament with a toothbrush and a bottle of sake. I\'m guarding the house. Mostly I sit.'],
      [15, ['Master Roshi\'s back! He says he "lasted ages" and met "a lovely lady from Universe 4". He\'s been humming for three days.', 'happy']],
    ],
  },

  [FERRYMAN]: {
    heroes: {
      goku: 'Goku! Need a ride? ...Right, you fly. Everybody flies except me. I have a boat.',
      vegeta: [
        [FERRYMAN, 'Boat\'s leaving in ten, if you need a lift.'],
        ['hero', 'Do I look like I need a boat?', 'angry'],
        [FERRYMAN, 'You look like you need a nap, pal.', 'smirk'],
      ],
      gohan: 'Gohan, right? Krillin brags about you every Tuesday. Says you saved the world when you were eleven. Then he asks for extra fish.',
      piccolo: 'Salty air\'s good for the skin, friend. ...Though you\'ve already got the green part down.',
      trunks: 'Need a ride? You look like a man trying to get somewhere very far away. I only go as far as the mainland, sorry.',
      satan: [
        [FERRYMAN, 'Mr. Satan! On MY dock! Need a ride?', 'shock'],
        ['hero', 'HAHAHA! The Champion swam here! ...Okay, a jet ski. Okay, a rowboat. Can I get a ride back?', 'happy'],
      ],
    },
    story: [
      [0, [
        [FERRYMAN, 'Ahoy. I run the supply boat out here every Tuesday. Rice, fish, and a very suspicious number of magazines.'],
        [FERRYMAN, 'The old hermit tips well, but he keeps asking if I have any "fit young deckhands" for hire. Odd fellow.', 'smirk'],
      ]],
      [2, 'Extra run this week: the old hermit wanted a lift to a birthday cruise. He tipped me in coupons. Expired coupons.'],
      [5, 'I dropped off groceries the day the aliens came. The hermit went off to fight them in his swim trunks. I want a raise.'],
      [EARTH_RESTORED, 'Funny week. I sailed the same Tuesday twice. Same waves. Same seagull stealing my lunch. Twice.'],
      [11, 'The hermit had me fetch his old rice cooker from the shed. Says he needs it for "sealing a god". I just drive the boat.'],
      [MAFUBA_TAUGHT, 'Goku\'s been out here all afternoon shouting "MAFUBA!" at flies. The hermit calls it practice. The flies call it harassment.'],
      [12, 'Krillin keeps asking me to take him "somewhere dangerous". I took him to the fish market. He seemed disappointed.'],
      ['c12_herbGot', 'Krillin took the hermit\'s boat out to the Forest of Terror. Came back bald and grinning. I wouldn\'t go there for all the zeni in Satan City.'],
      [13, 'The hermit wants me to row him "to the edge of the universe" for some tournament. I said that\'s not on my route.'],
      ['c14_departed', 'Turns out the hermit didn\'t need my boat. Krillin flew him to the mainland. Piggyback. I\'ve seen everything now.'],
      [15, ['Back to the regular route. Rice, fish, magazines. Feels good to be boring again.', 'happy']],
    ],
  },

  // ================================================================ The Lookout
  [YAJIROBE]: {
    heroes: {
      goku: [
        [YAJIROBE, 'Goku! Remember when I saved your hide from that Saiyan? Took his tail clean off. You\'re welcome. Still.', 'smirk'],
        ['hero', 'Ha ha! You were really brave, Yajirobe!', 'happy'],
        [YAJIROBE, '...I was. Wasn\'t I.', 'happy'],
      ],
      vegeta: [
        [YAJIROBE, 'GAH! V-V-Vegeta!', 'shock'],
        ['hero', 'You. The fat samurai who cut off my tail.', 'angry'],
        [YAJIROBE, 'Th-that was a DIFFERENT fat samurai! There\'s lots of us! It\'s a club!', 'shock'],
      ],
      gohan: 'Gohan! Last time I saw you fight you were a little kid with a bowl cut. Now you\'ve got a bowl cut AND glasses. Progress.',
      piccolo: [
        [YAJIROBE, 'Oh, it\'s you. The green one. You still not eating?'],
        ['hero', 'Namekians only need water.'],
        [YAJIROBE, 'Then you won\'t mind if I finish this fish. And yours.', 'happy'],
      ],
      trunks: 'Hey, you\'re the kid with the sword who sliced up Frieza way back. I like a guy who cuts things. Professional respect.',
      satan: [
        [YAJIROBE, 'The "Champion", huh? Gimme an autograph. On a fish. I\'ll sell it.', 'smirk'],
        ['hero', 'HAHAHA! A shrewd businessman! The Champion respects that!', 'happy'],
      ],
      android17: 'You\'re one of those androids. Last time I saw your face I ran the other way. Sit down, I\'m too full to run.',
      frieza: [[YAJIROBE, 'NOPE. Nope nope nope.', 'shock'], ['narrator', 'Yajirobe dives into a bush. The bush trembles.']],
    },
    story: [
      [0, YAJI_FISH_TIP],
      [3, { cycle: ['Some kid with a radar came asking about a "shiny orange ball". I was using it as a paperweight. Long story.', YAJI_FISH_TIP] }],
      [5, { cycle: [['Heard there was another big fight. I wasn\'t hiding. I was guarding the forest. From the back. Very important job.', 'smirk'], YAJI_FISH_TIP] }],
      [EARTH_RESTORED, { cycle: ['Had a nightmare the planet blew up while I was holding my lunch. Woke up, lunch was gone. THAT\'s the real tragedy.', YAJI_FISH_TIP] }],
      [9, { cycle: ['Heard a time machine crashed at Capsule Corp. If I had one, I\'d go back and eat the lunch I dropped last week.', YAJI_FISH_TIP] }],
      [12, { cycle: ['Krillin\'s training again. He asked if I wanted to train too. I said no. I\'m retired. From what? Exactly.', YAJI_FISH_TIP] }],
      [13, { cycle: ['A tournament where the losers get erased? Erased! Count me out. I\'ll be right here. Existing.', YAJI_FISH_TIP] }],
      ['c14_departed', { cycle: ['Everyone\'s gone. If the universe gets erased, at least I\'ll go out full.', YAJI_FISH_TIP] }],
      [15, { cycle: [['So you won the thing, huh? Knew you would. I was rooting for you. From here. Eating.', 'happy'], YAJI_FISH_TIP] }],
    ],
  },

  [KORIN]: {
    heroes: {
      goku: 'Goku. You climbed this tower as a boy to steal my water. Now you come for beans. You never change. That\'s a compliment.',
      vegeta: [
        [KORIN, 'The Saiyan prince. You once came to this planet to destroy it.'],
        ['hero', 'And now I live here. Life is strange.', 'smirk'],
        [KORIN, 'Hoho. Stranger still, I believe you.', 'happy'],
      ],
      gohan: 'Little Gohan. Your father climbed this tower as a boy, one handhold at a time. You flew past it with a school bag. Times change.',
      piccolo: [
        [KORIN, 'Ah. Kami\'s other half. You carry his calm now.'],
        ['hero', '...Some days more than others.'],
      ],
      trunks: { story: [
        [0, ['The boy from the future. You carry more than a sword this time. Sit a while. The beans can wait.', 'sad']],
        ['c11_farewell', 'The boy from the future. Your stride is lighter than last time. Good. Carry less, if you can.'],
      ] },
      satan: [
        [KORIN, 'The World Champion. You took the flight circle up, didn\'t you?', 'smirk'],
        ['hero', 'I CLIMBED! With my HANDS! ...In my heart.', 'shock'],
        [KORIN, 'Hoho. Close enough.', 'happy'],
      ],
      android17: 'An android who protects animals. Hm. The world is full of surprises. Have a sip of water.',
      frieza: [
        [KORIN, 'Frieza. My tower does not welcome you.', 'angry'],
        ['hero', 'Your tower is quite small.', 'smirk'],
        [KORIN, 'Then you will leave it quickly.', 'angry'],
      ],
    },
    story: [
      [0, KORIN_TRADE],
      ['c03_beerusDone', { cycle: ['Hoho. The sky turned gold, and a god went home with a full belly. Earth survives on pudding. Remarkable planet.', KORIN_TRADE] }],
      [5, { cycle: ['Frieza is back. I felt it in my whiskers. Keep your pouch full of beans, young one.', KORIN_TRADE] }],
      [EARTH_RESTORED, { cycle: ['The planet died for a moment. Even I felt it. Then time stitched itself back. An angel\'s work, I\'d wager.', KORIN_TRADE] }],
      [9, { cycle: ['Time machines again. Every time one lands, my bean crop has a very busy year. Bring fish.', KORIN_TRADE] }],
      [BLACK_SEEN, { cycle: [['Something out there wears a familiar ki, and none of its heart. My whiskers don\'t like it. Bring fish. Bring friends.', 'sad'], KORIN_TRADE] }],
      [11, { cycle: ['A god who cannot die, they say. Then don\'t fight to kill him. Fight to end it. ...Old cats know a few things.', KORIN_TRADE] }],
      [12, { cycle: ['Peace at last. My beans are growing fat and lazy. So is Yajirobe.', KORIN_TRADE] }],
      [13, { cycle: [['This tournament smells like the end of everything. Bring fish. Lots of fish.', 'sad'], KORIN_TRADE] }],
      ['c14_departed', { cycle: ['The universe is holding its breath. Even the clouds have stopped moving. Win, young ones.', KORIN_TRADE] }],
      [15, { cycle: [['Hoho! The sky breathes again. Universe 7 lives, and so do my beans.', 'happy'], KORIN_TRADE] }],
    ],
  },

  [POPO]: {
    heroes: {
      goku: 'Goku. Mr. Popo once taught you to move without thinking. You still think too little. That is a different problem.',
      vegeta: [
        [POPO, 'Vegeta. You once flew over this Lookout without asking.'],
        ['hero', 'I do not ask permission.', 'smirk'],
        [POPO, 'Mr. Popo remembers everything.'],
      ],
      gohan: 'Gohan. Mr. Popo remembers a small boy who came out of the Room of Spirit and Time with golden hair. You have grown.',
      piccolo: [
        [POPO, 'Ah... Kami.', 'happy'],
        ['hero', 'It\'s Piccolo, Mr. Popo.'],
        [POPO, 'Mr. Popo knows. Mr. Popo still says it sometimes. Mr. Popo misses him.', 'sad'],
      ],
      trunks: 'The boy from the future. You trained in the Room of Spirit and Time with your father. You came out stronger. And arguing.',
      satan: [
        [POPO, 'Mr. Satan. Mr. Popo knows who really beat Cell.'],
        ['hero', 'Ha... ha ha... who doesn\'t, right? Ha...', 'shock'],
        [POPO, 'Mr. Popo will not tell. Mr. Popo also will not forget.', 'smirk'],
      ],
      android17: 'An android. Your sister\'s husband is a good man. Mr. Popo approves of him. Mr. Popo is still deciding about you.',
      frieza: [
        [POPO, 'Frieza. You are not welcome on God\'s Lookout.', 'angry'],
        ['hero', 'And who will stop me? You?', 'smirk'],
        [POPO, 'Mr. Popo will.', 'angry'],
        ['narrator', 'For one long second, even Frieza hesitates.'],
      ],
    },
    story: [
      [0, 'Every flower here was planted by a Guardian of Earth. Please walk on the paths.'],
      [3, 'Dende\'s Dragon Balls are scattered and restless. So is Dende. Mr. Popo made tea for all of them.'],
      [5, ['Frieza has returned. Mr. Popo remembers him. Mr. Popo does not forgive. Mr. Popo waters the flowers.', 'angry']],
      [EARTH_RESTORED, 'For a moment the Lookout fell into nothing. Mr. Popo was sweeping. Mr. Popo finished sweeping when the world came back.'],
      ['c07_champaDone', [
        [POPO, 'The Room of Spirit and Time has been busy. Mr. Popo cleans it after every visitor. Saiyans are very messy.'],
        [POPO, 'If you wish to use it, ask Dende first. And wipe your feet.'],
      ]],
      [11, 'Vegeta has been in the Room of Spirit and Time for a whole year. Since this morning. Mr. Popo can hear him yelling from here.'],
      [MAFUBA_TAUGHT, [
        [POPO, 'Kami\'s old bottle once held Kami himself. Mr. Popo would like it back. Empty.'],
        [POPO, 'Dende watches the clouds for the future all day. Mr. Popo brings him tea. Dende forgets to drink it.', 'sad'],
      ]],
      [12, ['Peaceful days. Mr. Popo planted a new flower. Mr. Popo named it "Quiet".', 'happy']],
      [13, 'The flowers are restless. Something very large is about to happen to the whole universe. Mr. Popo will water them anyway.'],
      ['c14_departed', 'Dende is praying. Mr. Popo is watering. Both are important. Only one of them is helping the flowers.'],
      [15, ['The flowers bloomed this morning. All of them, all at once. Mr. Popo thinks they know.', 'happy']],
    ],
  },
};

/** The active character's own remark at an examined object (after its description). */
export const EA_ASIDES: Record<string, Partial<Record<CharId, Talk>>> = {
  ea_sc_statue: {
    goku: ['Heh. It looks just like him. Shinier, though.', 'smirk'],
    vegeta: ['Solid gold, for a man Cell flicked out of the ring. This planet never stops amazing me.', 'angry'],
    gohan: ['Heh. It looks just like him. Videl says the moustache is "artistic licence".', 'smirk'],
    piccolo: ['Hmph. The truth would make a much smaller statue.', 'smirk'],
    trunks: ['In my time there were no statues. Only ruins. ...It\'s good to see people with something to celebrate.', 'sad'],
    satan: ['HAHAHA! Magnificent! Though the real thing is even more handsome. The moustache is fuller.', 'happy'],
    android17: ['Solid gold. For a guy my sister let win for a bag of money. People are funny.', 'smirk'],
    frieza: ['A golden statue of a weakling. How tacky. I do approve of the gold.', 'smirk'],
  },
  ea_sc_hotel: {
    satan: ['HAHAHA! Fully booked by MY fan club, of course! ...Do I get a room? No? Right.', 'happy'],
  },
  ea_smi_trophies: {
    goku: ['Wow, that\'s a lot of trophies! Do any of them have food in them?', 'happy'],
    vegeta: ['"Cell Games - Winner by Default." For once, a plaque that tells the truth.', 'smirk'],
    gohan: ['...He polished the Cell Games one. Of course he did.', 'happy'],
    piccolo: 'A whole room of lies, kept very clean.',
    trunks: ['He\'s made a museum out of the days everyone survived. ...I think I like that.', 'happy'],
    satan: ['HAHAHA! Every one of them earned with sweat! ...And a very good publicist.', 'happy'],
  },
  ea_sh_shelf: {
    vegeta: ['A toothbrush with his face on it. Earthlings deserve whatever happens to them.', 'angry'],
    gohan: ['...One dusty Great Saiyaman keychain. I can\'t tell if I\'m relieved or hurt.', 'sad'],
    satan: ['HAHAHA! So many handsome faces! The cookbook\'s mine too. Somebody wrote it for me.', 'happy'],
  },
  ea_sd_poster: {
    goku: ['Heh. His back foot\'s all wrong. ...Still looks cool, though!', 'happy'],
    vegeta: ['"Mostly showmanship." Finally, an honest sign on this planet.', 'smirk'],
    satan: ['HAHAHA! Look at that form! ...I really should learn that kick someday.', 'happy'],
  },
  ea_kh_shelf: {
    goku: ['Hey, there\'s the old training manual! Under... a lot of other stuff.', 'happy'],
    gohan: ['...I\'m going to pretend I didn\'t see any of these.', 'shock'],
    piccolo: ['The old man\'s mind is as sharp as ever. It\'s just pointed at the wrong things.', 'angry'],
    satan: ['Ooh... "fitness magazines". Purely for research! Champion research!', 'shock'],
  },
  ea_lp_altar: {
    goku: ['Shenron! I should come say hi next time the balls are gathered.', 'happy'],
    piccolo: 'Kami carved this, long before I was born. ...I remember carving it.',
  },
  ea_lp_books: {
    gohan: ['"Things Mr. Popo says I must not do." ...I really want to read Volumes 1 and 2.', 'happy'],
    piccolo: ['Volume 3. Dende is too honest for his own good.', 'smirk'],
  },
};

// ------------------------------------------------------------------ Senzu economy

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
    const me = spk(s, FARMER, 'farmer');
    if (s.inc('ea_pv_farmer_n') === 1) {
      await s.talk([
        [me, 'Morning! Name\'s Takeda. I farm the terraces past the valley.', 'happy'],
        [me, 'Chi-Chi\'s got you on radish duty too? That woman could run an army with a frying pan.'],
      ]);
      return;
    }
    await townTalk(s, FARMER, me);
  },

  ea_pv_fisher: async (s) => {
    const me = spk(s, ANGLER, 'oldMan');
    if (!s.flag('ea_pv_fishGift')) {
      await s.talk([
        [me, 'Shh... they\'re biting today. Forty years I\'ve fished this pond and never caught the big one.'],
        [me, 'Here, I\'ve got more than I can eat. Old Korin up the great tower swaps magic beans for fish, or so my grandfather swore.', 'happy'],
      ]);
      s.set('ea_pv_fishGift');
      await s.give('fish');
      return;
    }
    await townTalk(s, ANGLER, me);
  },

  ea_ph_neighbor: async (s) => {
    const me = spk(s, UME, 'townswoman');
    if (s.inc('ea_ph_neighbor_n') === 1) {
      await s.talk([
        [me, 'Oh! You startled me. I\'m Ume, from over the hill. I trade Chi-Chi pickles for radishes.', 'happy'],
        [me, 'Did you see that tractor? Goku tried to plough with it and it ended up in the river. Twice.'],
      ]);
      return;
    }
    await townTalk(s, UME, me);
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
    const me = spk(s, FAN, 'kidNpc');
    if (s.inc('ea_sc_fan_n') === 1) {
      await s.talk([
        [me, 'Isn\'t he AMAZING? Mr. Satan beat Cell AND saved the world from Majin Buu! With his bare hands!', 'happy'],
        s.hero === 'satan' ? ['hero', 'HAHAHA! Bare hands, kid! And just a little bit of elbow!', 'happy'] : ['hero', '...Sure. Bare hands.', 'smirk'],
        [me, 'When I grow up I\'m gonna do the Dynamite Kick too! Hi-yah! Ow, my ankle.'],
      ]);
      return;
    }
    await townTalk(s, FAN, me);
  },

  ea_sc_reporter: async (s) => {
    await townTalk(s, REPORTER, spk(s, REPORTER, 'reporter'));
  },

  ea_sc_police: async (s) => {
    await townTalk(s, COP, spk(s, COP, 'police'));
  },

  ea_sc_granny: async (s) => {
    await townTalk(s, GRANNY, spk(s, GRANNY, 'ea_granny'));
  },

  ea_sc_suit: async (s) => {
    await townTalk(s, BANKER, spk(s, BANKER, 'ea_suit'));
  },

  ea_sc_waiter: async (s) => {
    const me = spk(s, WAITER, 'waiter');
    if (s.inc('ea_sc_waiter_n') === 1) {
      await s.talk([
        [me, 'Welcome to Cafe Victory! Today\'s special is the Dynamite Kick Parfait. Comes with a sparkler.', 'happy'],
        [me, 'We\'re closed for the lunch rush - a large man in a purple vest ordered the entire menu. Twice. Then asked for dessert.'],
      ]);
      return;
    }
    await townTalk(s, WAITER, me);
  },

  ea_sc_tourist: async (s) => {
    await townTalk(s, TOURIST, spk(s, TOURIST, 'ea_tourist'), 'happy');
  },

  ea_sc_jogger: async (s) => {
    await townTalk(s, JOGGER, spk(s, JOGGER, 'ea_jogger'));
  },

  ea_sc_oldman: async (s) => {
    const me = spk(s, VETERAN, 'oldMan');
    if (s.inc('ea_sc_oldman_n') === 1) {
      await s.talk([
        [me, 'I fought in the World Martial Arts Tournament once, way back. Lost in the first round to a little monkey-tailed boy.'],
        [me, 'He waved at me afterwards and asked if I wanted to eat. Strangest beating I ever took. Best lunch too.', 'happy'],
      ]);
      return;
    }
    await townTalk(s, VETERAN, me);
  },

  ea_sc_girl: async (s) => {
    await townTalk(s, SHOPPER, spk(s, SHOPPER, 'ea_girl'));
  },

  ea_sc_scientist: async (s) => {
    await townTalk(s, AOKI, spk(s, AOKI, 'scientist'));
  },

  ea_sc_hotel: async (s) => {
    await s.narrate('HOTEL SATAN. A gold sign reads: "FULLY BOOKED - the Mr. Satan International Fan Club Convention." Someone has added: "Again."');
    await aside(s, 'ea_sc_hotel');
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
    await s.narrate(byStory(s, [
      [0, 'The police station door is locked. A handwritten note: "Out on patrol. In an emergency, call Mr. Satan. In a REAL emergency, call Videl."'],
      [12, 'A memo on the police station door: "Officer Krillin on leave. Do NOT let the new recruits try his \'Destructo Disc\' on parking tickets."'],
      ['c12_herbGot', 'A memo on the police station door: "Welcome back, Officer Krillin! Please stop lifting the squad car to check for loose change."'],
      ['c14_departed', 'A note on the door in Krillin\'s handwriting: "Gone to save the universe. Back by dinner. 18 says hi." Below, in neater writing: "No I don\'t."'],
      [15, 'The door is open. Inside, Officer Krillin is telling the new recruits about "the tournament". They think he means bowling.'],
    ]));
  },

  ea_sc_flats: async (s) => {
    await s.narrate('An apartment block. The buzzer panel lists a dozen names. Three of them are "SATAN", none of them related.');
  },

  ea_sc_statue: async (s) => {
    const n = s.inc('ea_sc_statue_n');
    if (n === 1) {
      await s.narrate('A solid gold statue of Mr. Satan, fist to the sky. The plaque reads: "To the Champion who saved the world from Cell and Majin Buu. Twice, if you count the rematch."');
      await aside(s, 'ea_sc_statue');
      return;
    }
    await s.narrate(byStory(s, [
      [0, 'Someone has left fresh flowers and a box of Champion Cookies at the statue\'s feet.'],
      [BUU_ASLEEP, 'Someone has left a "SWEET DREAMS, MR. BUU" card and a box of chocolates at the statue\'s feet.'],
      [15, 'A fresh banner hangs from the statue\'s fist: "THANK YOU, CHAMP!" Nobody is quite sure what for. It feels right anyway.'],
    ]));
    if (n % 2 === 0) await aside(s, 'ea_sc_statue');
  },

  // ================================================================ Satan City - mansion
  ea_sm_gardener: async (s) => {
    await townTalk(s, GARDENER, spk(s, GARDENER, 'farmer'));
  },

  ea_sm_guard: async (s) => {
    await townTalk(s, GUARD, spk(s, GUARD, 'police'));
  },

  ea_sm_swimmer: async (s) => {
    await townTalk(s, SWIMMER, spk(s, SWIMMER, 'ea_girl'), 'happy');
  },

  ea_smi_buu: async (s) => {
    const me = spk(s, BUU, 'majinBuu');
    const n = s.inc('ea_smi_buu_n');
    // Mr. Satan himself gets no "watching the Mr. Satan show" intro: Buu just mobs him.
    if (n === 1 && !buuAsleep(s) && s.hero !== 'satan') {
      await s.talk([
        [me, 'Shh! Buu watching Mr. Satan show. Mr. Satan very strong on TV. Strongest!', 'happy'],
        [me, 'You want candy? Buu make you candy... no. Mr. Satan say no turning guests into candy. Buu forgot.'],
      ]);
      return;
    }
    await townTalk(s, BUU, me, 'happy');
  },

  ea_smi_bee: async (s) => {
    const me = spk(s, BEE, 'Bee');
    const n = s.inc('ea_smi_bee_n');
    if (n === 3 && !s.flag('ea_beeGift')) {
      s.set('ea_beeGift');
      await s.narrate('Bee barks happily, trots off behind the sofa, and comes back with something in his mouth.');
      await s.give('cookie', 3);
      await s.say(me, 'Woof!', 'happy');
      return;
    }
    await townTalk(s, BEE, me, 'happy');
  },

  ea_smi_butler: async (s) => {
    await townTalk(s, BUTLER, spk(s, BUTLER, 'ea_butler'));
  },

  ea_smi_stairs: async (s) => {
    if (s.hero === 'satan' && await react(s, STAIRS, 'mrSatan')) return;
    await s.narrate('A grand staircase. A velvet rope blocks the way, with a sign: "PRIVATE - Champion\'s Quarters. Autographs by appointment only."');
    if (!satanHome(s)) return;
    await s.narrate('A familiar voice booms down the stairs.');
    await townTalk(s, STAIRS, 'mrSatan');
  },

  ea_smi_trophies: async (s) => {
    await s.narrate('Rows of golden trophies: "World Martial Arts Champion", "Savior of Earth", "Best Moustache (Honorary)", "Cell Games - Winner by Default"...');
    // Both mementos of the Tournament of Destroyers arrive with Buu, who comes home in Chapter 8.
    if (s.check('chapter>=8')) {
      await s.narrate('A new plaque sits slightly crooked: "Universe Exhibition Match - Moral Victory."');
      await s.narrate('Beside it hangs a framed photocopy of an exam paper. Every answer is a drawing of candy. It is marked "0" in red ink.');
    }
    await aside(s, 'ea_smi_trophies');
  },

  ea_sh_clerk: async (s) => {
    const me = spk(s, CLERK, 'ea_clerk');
    if (!s.flag('ea_shopSample')) {
      await s.talk([
        [me, 'Welcome to Champ Goods! Official Mr. Satan merchandise, approved by the Champion\'s own legal team.', 'happy'],
        [me, 'Today we\'re giving out free samples of Champion Cookies. Strength in every bite! Results not guaranteed.'],
      ]);
      s.set('ea_shopSample');
      await s.give('cookie', 2);
      return;
    }
    await townTalk(s, CLERK, me);
  },

  ea_sh_customer: async (s) => {
    await townTalk(s, CUSTOMER, spk(s, CUSTOMER, 'kidNpc'));
  },

  ea_sh_shelf: async (s) => {
    await s.narrate('Shelves of merchandise: Mr. Satan lunchboxes, Mr. Satan toothbrushes, a Mr. Satan cookbook titled "Eat Like a Champ"... and one dusty "Great Saiyaman" keychain.');
    await aside(s, 'ea_sh_shelf');
  },

  ea_sd_student1: async (s) => {
    await townTalk(s, SENIOR, spk(s, SENIOR, 'ea_student'));
  },

  ea_sd_student2: async (s) => {
    await townTalk(s, STUDENT, spk(s, STUDENT, 'ea_student2'));
  },

  ea_sd_poster: async (s) => {
    await s.narrate('A huge poster of Mr. Satan mid-kick. The caption: "THE SATAN SCHOOL - Strength! Speed! Showmanship!" Below, in small print: "Mostly showmanship."');
    await aside(s, 'ea_sd_poster');
  },

  // ================================================================ Kame House
  ea_ki_turtle: async (s) => {
    const me = spk(s, TURTLE, 'Turtle');
    if (s.inc('ea_ki_turtle_n') === 1) {
      await s.talk([
        [me, 'Oh, hello! I\'m Turtle. I\'ve lived with Master Roshi for, oh... a few centuries now.', 'happy'],
        [me, 'He\'s inside, probably "researching." Knock loudly, and please don\'t mind the magazines.'],
      ]);
      return;
    }
    await townTalk(s, TURTLE, me);
  },

  ea_ki_sailor: async (s) => {
    await townTalk(s, FERRYMAN, spk(s, FERRYMAN, 'ea_sailor'));
  },

  ea_kh_stairs: async (s) => {
    await s.narrate('Stairs to the upper floor. From above comes loud snoring - or possibly very enthusiastic "meditation."');
  },

  ea_kh_shelf: async (s) => {
    await s.narrate('A bookshelf crammed with "fitness magazines." A handful of real martial arts manuals sit at the very back, covered in dust.');
    await aside(s, 'ea_kh_shelf');
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
    const me = spk(s, YAJIROBE, 'yajirobe');
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
    await townTalk(s, YAJIROBE, me);
  },

  ea_kt_korin: async (s) => {
    const me = spk(s, KORIN, 'korin');
    const first = !s.flag('ea_korinMet');
    if (first) {
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
    if (first) return;
    await townTalk(s, KORIN, me);
  },

  ea_lk_popo: async (s) => {
    const me = spk(s, POPO, 'mrPopo');
    if (s.inc('ea_lk_popo_n') === 1) {
      await s.talk([
        [me, 'Welcome to the Lookout. Mr. Popo tends the garden, the palace, and the young Guardian.', 'happy'],
        [me, 'That door by the palace leads to the Room of Spirit and Time. One year inside is one day outside. It is very hot, then very cold. Mr. Popo does not recommend it.'],
      ]);
      return;
    }
    await townTalk(s, POPO, me);
  },

  ea_lp_altar: async (s) => {
    await s.narrate('An old altar. Carvings show the Dragon Balls arranged in a circle, and a great dragon coiling over the Earth.');
    await aside(s, 'ea_lp_altar');
  },

  ea_lp_books: async (s) => {
    await s.narrate('Ancient scrolls in a Namekian script, and a much newer notebook in Dende\'s handwriting: "Things Mr. Popo says I must not do - Volume 3."');
    await aside(s, 'ea_lp_books');
  },
});
