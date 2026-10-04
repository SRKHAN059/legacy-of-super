import { TILE } from '../../../engine/constants';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, unforce } from '../common';
import { HUB } from './hubs';
import { C01_ERRANDS } from './c01_side';
import { actor, arenaClear, arenaFight, endScene, freeTile, heroTile, once, pointOfNoReturn, removeAll, scene, SEALED, unlockSpot } from './util';

/**
 * CHAPTER 1 - "A Peaceful World" (Goku L1 -> 8).
 * c01_start: title card, Goku's nightmare (Dream Frieza tutorial boss) -> wakes in paozu_house.
 * Gold chain: c01_farm (pickup tutorial: 5 radishes) -> c01_tracks (run/save/hostile/gate tutorials, the hidden cave,
 * Grandpa Gohan's tablet = Kamehameha, mini-boss Fang) -> c01_lunch (Gohan & Videl) -> c01_satan (world-map tutorial,
 * Mr. Satan's 100 million zeni) -> c01_money (Chi-Chi) -> "Meanwhile" Beerus wakes -> c01_kingkai (Gregory, SSJ regained,
 * King Kai's warning, Beerus arrives, scripted loss) -> c02_start.
 */

const BEERUS_KI = '#b070f0';

function tileOf(s: ScriptApi, id: string): [number, number] {
  const a = s.actor(id);
  return [Math.round((a.x - 8) / TILE), Math.round((a.y - 14) / TILE)];
}

registerScripts({
  // ---------------------------------------------------------------- start + nightmare
  c01_start: async (s) => {
    ensureChapterState(s, 1);
    s.state.char('trunks').joined = false;
    unforce(s);
    await s.join('goku', 1, true);
    s.switchTo('goku');
    s.set('world', 'earth');
    s.unlockRegion('spot_paozu');
    await s.chapter(1, 'A Peaceful World', 'Mt. Paozu - Age 774');
    await s.warp('c01_dream', 10, 10, 'up');
    await s.call('c01_dream');
  },

  c01_dream: async (s) => {
    await scene(s);
    await s.narrate('Half a year after the defeat of Majin Buu, the Earth was at peace. Its greatest hero was sound asleep...');
    await s.narrate('...and having a very bad dream.');
    s.flash('#d060f0', 16);
    s.sfx('teleport');
    actor(s, 'c01_dreamF', 'frieza', 10, 4, 'down', 'Frieza');
    await s.emote('hero', '!');
    await s.talk([
      ['frieza', 'Hello again, monkey. Did you miss me?', 'smirk'],
      ['goku', 'Frieza?! What are you doing here? You\'re supposed to be in Hell!', 'shock'],
      ['frieza', 'And you are supposed to be a warrior. Look at you. Soft. Pulling vegetables out of the dirt for your wife.'],
      ['goku', 'Hey! Farming is hard work! ...Kind of.'],
      ['frieza', 'Let us find out whether those hands still remember how to make a fist.', 'angry'],
    ]);
    await s.narrate('Dream or not, you have to fight! Press A to punch and B to fire a Ki Blast. If you get hurt, break the rocks - sometimes there\'s food inside.');
    endScene(s);
    const [fx, fy] = tileOf(s, 'c01_dreamF');
    s.remove('c01_dreamF');
    const r = await arenaFight(s, 'c01_dreamFrieza', { x: fx, y: fy, uid: 'c01_dreamF1', loseOk: true });
    s.letterbox(true);
    if (r === 'lose') await s.say('frieza', 'Pathetic. Wake up and remember this feeling, Goku.', 'smirk');
    else await s.say('frieza', 'Enjoy your little peace, Saiyan... while it lasts. Ohohoho...', 'smirk');
    s.flash('#ffffff', 30);
    await s.fadeOut(30, '#ffffff');
    await s.narrate('"...ku. Goku! GOKU!"');
    s.set('c01_dreamDone');
    const [bx, by] = HUB.paozuHouse.bed;
    await s.warp('paozu_house', bx, by, 'down');
    await s.call('c01_wake');
  },

  c01_dream_taunt: async (s) => {
    await s.say('frieza', 'Ohohoho! Is that all the rust allows?', 'smirk');
  },

  c01_wake: async (s) => {
    s.heal();
    s.letterbox(true);
    const [wx, wy] = HUB.paozuHouse.wakeChichi;
    const [cx, cy] = HUB.paozuHouse.chichi;
    actor(s, 'c01_chichi', 'chichi', wx, wy, 'up', 'Chi-Chi');
    s.pose('hero', 'ko');
    s.shake(12, 2);
    await s.say('chichi', 'GOKU! It\'s almost noon! Get out of that bed!', 'angry');
    s.pose('hero', null);
    await s.emote('hero', '!');
    await s.talk([
      ['goku', 'Whoa! Chi-Chi! I was fighting Frieza! He was right there, and I almost had him!', 'shock'],
      ['chichi', 'Frieza is dead, and the radishes are not going to pick themselves.', 'angry'],
      ['goku', 'Aww...', 'sad'],
      ['chichi', 'You promised, Goku. Gohan is studying, Goten is growing, and you are farming. Like a normal husband.'],
      ['chichi', 'Five radishes from the field outside. Then, MAYBE, we can talk about "training".'],
    ]);
    await s.walk('c01_chichi', cx, cy, 1.5);
    s.face('c01_chichi', 'down');
    await s.quest('c01_farm');
    await s.narrate('Some items are lying on the ground. Walk over them to pick them up. The radish field is south of the house, past the road.');
    s.letterbox(false);
    s.set('c01_awake');
  },

  // ---------------------------------------------------------------- Chi-Chi drives the gold chain
  c01_chichi_talk: async (s) => {
    if (!s.check('chapter==1')) return;
    if (!s.flag('c01_awake')) { await s.say('chichi', 'Goku is STILL asleep. Unbelievable.', 'angry'); return; }
    if (s.check('quest:c01_farm')) {
      const n = s.count('c01_radish');
      if (n >= 5) { await s.call('c01_farm_done'); return; }
      await s.say('chichi', n === 0
        ? 'The field is right outside. Five radishes, Goku. You can count to five, can\'t you?'
        : `That's ${n}. I said FIVE. You can do it - I believe in you!`, n === 0 ? 'angry' : 'happy');
      return;
    }
    if (s.check('quest:c01_tracks')) {
      await s.say('chichi', s.flag('c01_kame')
        ? 'Did you find that radish thief? Don\'t come back covered in mud!'
        : 'Follow those footprints into the forest and teach that animal a lesson. Then come straight back!');
      return;
    }
    if (s.check('done:c01_tracks') && !s.check('quest:c01_lunch') && !s.check('done:c01_lunch')) { await s.call('c01_report_fang'); return; }
    if (s.check('quest:c01_lunch')) {
      await s.say('chichi', 'Gohan\'s house is east of here, in the valley. And don\'t you DARE eat that lunch on the way.', 'angry');
      return;
    }
    if (s.check('quest:c01_satan')) {
      await s.talk([
        ['chichi', 'Mr. Satan? That man has been calling here all week. Something about a "reward".'],
        ['chichi', 'Well, go and see what he wants! A reward is a reward. The world-map sign is in the valley.', 'happy'],
      ]);
      return;
    }
    if (s.check('quest:c01_money')) {
      if (s.has('c01_zeni')) {
        // Point of no return: the money starts Beerus's chain, which runs straight into Chapter 2.
        const go = await pointOfNoReturn(s, C01_ERRANDS,
          'Give Chi-Chi the money? Goku leaves Mt. Paozu right after, and the errands above will be left behind.',
          'Not yet', 'Hand it over');
        if (!go) { await s.say('chichi', 'Well? Don\'t just stand there holding it! ...Fine, finish whatever you\'re doing. Then come straight home.', 'smirk'); return; }
        await s.call('c01_money_home');
        return;
      }
      await s.say('chichi', 'You came back empty-handed?', 'sad');
      return;
    }
    await s.say('chichi', 'Go on, go train. Just be home for dinner!', 'happy');
  },

  c01_farm_done: async (s) => {
    s.take('c01_radish', 5);
    s.letterbox(true);
    await s.talk([
      ['chichi', 'Five beautiful radishes! See? You CAN work when you want to.', 'happy'],
      ['goku', 'Heh heh. So... can I go train now?'],
    ]);
    await s.done('c01_farm');
    s.exp(20);
    // Goten bursts in with news.
    const [dx, dy] = HUB.paozuHouse.door;
    actor(s, 'c01_gotenIn', 'goten', dx, dy, 'up', 'Goten');
    await s.walk('c01_gotenIn', dx, dy - 2, 2);
    await s.talk([
      ['goten', 'Mom! Dad! Something HUGE was digging in the field again last night! There\'s footprints everywhere!', 'shock'],
      ['chichi', 'That beast again! It\'s been stealing my radishes all week!', 'angry'],
      ['goten', 'The tracks go into Paozu Forest. They\'re THIS big!', 'happy'],
      ['goku', 'A big beast, huh? Now THAT\'S a chore I can get behind!', 'happy'],
      ['chichi', 'Fine. Go and chase it off. But you be back in time for lunch!'],
    ]);
    await s.walk('c01_gotenIn', dx, dy + 1, 2);
    s.remove('c01_gotenIn');
    await s.quest('c01_tracks');
    s.letterbox(false);
  },

  c01_report_fang: async (s) => {
    s.letterbox(true);
    await s.talk([
      ['goku', 'Chi-Chi! I found the radish thief - a sabertooth as big as a truck! He won\'t bother the field again.', 'happy'],
      ['chichi', 'Oh, Goku, you\'re filthy! ...But thank you.', 'happy'],
      ['goku', 'And I remembered the Kamehameha! Well, I never really forgot, but it felt good!'],
      ['chichi', 'That\'s nice, dear. Now, I made lunch for Gohan and Videl. They\'re newlyweds - they forget to eat.'],
      ['chichi', 'Take this to their house in the valley, east of here. And Goku? It\'s for THEM.', 'angry'],
    ]);
    await s.give('c01_lunch');
    await s.quest('c01_lunch');
    s.letterbox(false);
  },

  // ---------------------------------------------------------------- the hidden cave
  c01_gate_hint: async (s) => {
    await s.narrate('A glowing level gate blocks the way. Its colour shows who can break it (orange: Goku) and the number shows the level required. Hit it with A when you\'re ready.');
    if (s.state.char('goku').level < 2) await s.narrate('Goku isn\'t strong enough yet. Defeat enemies in the cave and the forest to gain experience.');
  },

  c01_shrine_pray: async (s) => {
    if (s.flag(SEALED)) return;
    // Kamehameha remembered but Fang still loose (a lost bout): the tablet is where he pounces again.
    if (s.check('c01_kame&!c01_fangBeaten&quest:c01_tracks')) { await s.call('c01_fang_fight'); return; }
    if (s.flag('c01_kame') || !s.check('chapter>=1')) {
      await s.narrate('An old stone tablet carved with the Turtle School symbol. Someone has kept it clean all these years.');
      return;
    }
    if (!s.check('quest:c01_tracks')) {
      await s.narrate('An old stone tablet carved with the Turtle School symbol. It feels strangely familiar...');
      if (s.hero === 'goku') await s.say('goku', 'Huh. I feel like I\'ve been here before. Better finish my chores first, though, or Chi-Chi will kill me.');
      return;
    }
    await scene(s);
    await s.narrate('An old stone tablet carved with the Turtle School symbol. Someone has kept it clean all these years.');
    await s.talk([
      ['goku', 'I know this place... Grandpa Gohan used to bring me here when I was really little.'],
      ['goku', 'He trained under Master Roshi, same as me. He said this cave was where he practised the hard stuff.'],
      ['goku', 'Feet apart. Hands together. Pull it all into one point...'],
      ['goku', 'Ka... me... ha... me...', 'shout'],
    ]);
    await s.powerUp('hero', '#70c8f8', 70);
    s.flash('#a0e0ff', 14);
    await s.learn('goku', 'kamehameha');
    await s.narrate('Select the Kamehameha with L, then hold B to fire a sustained beam. It drains EP for as long as you hold it.');
    s.set('c01_kame');
    s.exp(40);
    await s.call('c01_fang_fight');
  },

  /**
   * Mini-boss Fang. Re-entrant: losing sends him back into the tunnels (the field is NOT safe yet), and he pounces
   * again when Goku returns to the shrine (walk-in trigger) or touches the tablet.
   */
  c01_fang_fight: async (s) => {
    if (s.flag(SEALED) || s.flag('c01_fangBeaten')) return;
    const again = s.flag('c01_fangLost');
    s.letterbox(true);
    s.shake(30, 2);
    s.sfx('explode');
    await s.wait(20);
    const [hx, hy] = heroTile(s);
    const [ax, ay] = freeTile(s, hx, hy + 5);
    const [bx, by] = freeTile(s, hx, hy + 2);
    actor(s, 'c01_fangNpc', 'c01_fang', ax, ay, 'up', 'Fang');
    s.face('hero', 'down');
    await s.walk('c01_fangNpc', bx, by, 1.4);
    await s.talk(again
      ? [
        ['c01_fangNpc', 'GRRRRR...'],
        ['goku', 'There you are! Round two, big guy. This time I\'m not holding back!', 'smirk'],
      ]
      : [
        ['goku', 'Whoa! You must be the radish thief!', 'shock'],
        ['c01_fangNpc', 'GRRRRAAAWR!'],
        ['goku', 'Sorry, big guy. Those radishes are Chi-Chi\'s, and Chi-Chi is way scarier than you!', 'smirk'],
      ]);
    s.letterbox(false);
    const [fx, fy] = tileOf(s, 'c01_fangNpc');
    s.remove('c01_fangNpc');
    s.music('battle');
    const r = await arenaFight(s, 'c01_fang', { x: fx, y: fy, uid: 'c01_fang1', loseOk: true });
    s.letterbox(true);
    if (r === 'lose') {
      await s.narrate('Fang bowls Goku over, snatches a mouthful of his gi and lopes off into the dark tunnels, growling.');
      if (s.exists('c01_fang1')) await s.walk('c01_fang1', 14, 21, 3);
      if (s.exists('c01_fang1')) s.remove('c01_fang1');
      s.heal();
      s.music('cave');
      await s.say('goku', 'Ow... Okay, he\'s tougher than he looks. He\'s still prowling around in here - I can\'t go home until he\'s done raiding!', 'hurt');
      await s.narrate('Catch your breath at the save disc, then face Fang again: he will pounce when Goku heads back up to the tablet.');
      s.set('c01_fangLost');
      s.letterbox(false);
      return;
    }
    s.exp(275);
    await s.narrate('Fang whimpers, tucks its tail and bolts out of the cave. It won\'t be raiding any fields soon.');
    if (s.exists('c01_fang1')) await s.walk('c01_fang1', 14, 21, 3);
    if (s.exists('c01_fang1')) s.remove('c01_fang1');
    s.music('cave');
    await s.say('goku', 'Hehe! That was a fun warm-up. Better tell Chi-Chi the field\'s safe.', 'happy');
    s.set('c01_fangBeaten');
    await s.done('c01_tracks', false);
    s.letterbox(false);
  },

  c01_fang_roar: async (s) => {
    s.shake(16, 2);
    await s.say('goku', 'Whoa, now he\'s really mad!', 'shock');
  },

  // ---------------------------------------------------------------- Gohan & Videl, then Mr. Satan
  c01_gohan_lunch: async (s) => {
    s.letterbox(true);
    s.take('c01_lunch');
    await s.talk([
      ['gohan', 'Dad! What brings you- wait, is that Mom\'s cooking?', 'happy'],
      ['videl', 'Hi, Mr. Goku! Thank you so much. Gohan hasn\'t looked up from his thesis since breakfast.', 'happy'],
      ['gohan', 'Ha ha... sorry. Oh, Dad, that reminds me. Mr. Satan keeps calling. He says he owes you a reward.'],
      ['videl', 'Papa wants to thank you for "helping" him defeat Buu. He\'s at the mansion in Satan City.', 'smirk'],
      ['goku', 'A reward? For me? Huh. Sure, I\'ll go say hi!', 'happy'],
      ['videl', 'The world map signpost is out in the valley. Satan City is south-east of here. You can\'t miss the statues.'],
    ]);
    await s.done('c01_lunch');
    s.exp(30);
    s.unlockRegion('spot_paozu');
    await unlockSpot(s, 'spot_satancity');
    await s.quest('c01_satan');
    s.letterbox(false);
  },

  c01_valley_enter: async (s) => {
    if (!s.check('chapter==1&quest:c01_satan') || !once(s, 'c01_tutSign')) return;
    await s.wait(20);
    await s.narrate('To travel far, use a world map signpost. Press A at the sign, steer with the D-pad (hold B to fly faster) and press A over a landing spot to land.');
    await s.narrate('The gold star on the world map always marks your current main objective.');
  },

  c01_satan_meet: async (s) => {
    s.letterbox(true);
    await s.talk([
      ['mrSatan', 'Ah! G-Goku! My good, good friend! Come in, come in!', 'happy'],
      ['mrSatan', '(whispering) About Buu... and Cell... and, uh, everything. You won\'t say anything to anyone, right?', 'sad'],
      ['goku', 'Say what?'],
      ['mrSatan', 'EXACTLY! Ha ha ha! That\'s the spirit!', 'happy'],
      ['mrSatan', 'Now! The world gave me a reward for saving it. And since you... helped... a little... I want you to have half!'],
      ['goku', 'Huh? What would I even do with that?'],
      ['mrSatan', 'Give it to Chi-Chi! Trust me, Goku. A happy wife means a happy life. And a man with a happy wife gets to TRAIN.', 'smirk'],
      ['majinBuu', 'Buu wants candy money too!', 'happy'],
      ['mrSatan', 'Buu, we talked about this. Candy is after dinner.'],
    ]);
    await s.give('c01_zeni');
    await s.done('c01_satan');
    s.set('c01_metSatan');
    s.exp(30);
    await s.quest('c01_money');
    s.letterbox(false);
  },

  // ---------------------------------------------------------------- the money, Beerus wakes, off to King Kai
  c01_money_home: async (s) => {
    s.letterbox(true);
    s.take('c01_zeni');
    await s.talk([
      ['goku', 'Chi-Chi, Mr. Satan gave us some money. He said you\'d like it.'],
      ['chichi', 'One hundred... MILLION... zeni?!', 'shock'],
    ]);
    await s.emote('c01_chichi', '♥');
    await s.talk([
      ['chichi', 'Oh, Goku! Do you know what this means? Goten\'s school! A new roof! A tractor that isn\'t held together with tape!', 'happy'],
      ['goku', 'So... does this mean I don\'t have to farm anymore?'],
      ['chichi', '...', 'smirk'],
      ['chichi', 'Fine! Go train! Go to King Kai\'s or wherever you go! Just be home for dinner!', 'happy'],
      ['goku', 'Really?! You\'re the best, Chi-Chi!', 'happy'],
    ]);
    await s.done('c01_money');
    s.set('c01_moneyHome');
    await s.call('c01_beerus_wakes');
    // Back home: Instant Transmission.
    const [cx, cy] = HUB.paozuHouse.chichi;
    await s.warp('paozu_house', cx - 2, cy, 'right');
    s.letterbox(true);
    actor(s, 'c01_chichi', 'chichi', cx, cy, 'left', 'Chi-Chi');
    await s.say('goku', 'Okay! I\'ll be back by dinner. Probably!', 'happy');
    await s.narrate('Goku presses two fingers to his forehead and searches for a familiar ki, far beyond the clouds...');
    s.pose('hero', 'raise');
    s.sfx('teleport');
    s.flash('#ffffff', 16);
    await s.wait(16);
    s.pose('hero', null);
    await s.quest('c01_kingkai');
    const [ax, ay] = HUB.kingKai.arrive;
    await s.warp('kingkai_planet', ax, ay, 'up');
    await s.call('c01_kingkai_arrive');
  },

  c01_beerus_wakes: async (s) => {
    await s.fadeOut(30);
    await s.narrate('Meanwhile, at the far edge of Universe 7...');
    const [ax, ay] = HUB.beerusPalace.arrive;
    await s.warp('beerus_palace_in', ax, ay, 'up');
    s.show('hero', false);
    s.letterbox(true);
    s.music('godly');
    const [bx, by] = HUB.beerusPalace.bed;
    const [wx, wy] = HUB.beerusPalace.whis;
    actor(s, 'c01_beerus', 'beerus', bx, by, 'down', 'Beerus');
    actor(s, 'c01_whis', 'whis', wx, wy, 'left', 'Whis');
    s.pose('c01_beerus', 'ko');
    await s.pan(bx + 2, by + 1, 30);
    await s.talk([
      ['whis', 'Lord Beerus. Lord Beerus... It has been thirty-nine years. Your breakfast is, well. Somewhat late.'],
    ]);
    s.pose('c01_beerus', null);
    await s.emote('c01_beerus', '...');
    await s.talk([
      ['beerus', 'Mmh. Whis. I had a dream. A prophecy, maybe.'],
      ['beerus', 'I fought someone. A Super Saiyan... God. And I actually had fun.', 'smirk'],
      ['whis', 'A Super Saiyan God? How curious. Shall we ask the Oracle Fish?'],
    ]);
    await s.fadeOut(20);
    const [gx, gy] = HUB.beerusGrounds.arrive;
    await s.warp('beerus_grounds', gx, gy, 'left');
    s.show('hero', false);
    s.letterbox(true);
    const [fx, fy] = HUB.beerusGrounds.fish;
    const [b2x, b2y] = HUB.beerusGrounds.beerus;
    const [w2x, w2y] = HUB.beerusGrounds.whis;
    actor(s, 'c01_fish', 'alienFish', fx, fy, 'right', 'Oracle Fish');
    actor(s, 'c01_beerus', 'beerus', b2x, b2y, 'left', 'Beerus');
    actor(s, 'c01_whis', 'whis', w2x, w2y, 'left', 'Whis');
    await s.pan(fx + 1, fy, 30);
    await s.talk([
      ['c01_fish', '*blub* ...The one from your dream is real, Lord Beerus. *blub*'],
      ['c01_fish', 'A Saiyan... on a small blue planet... *blub* ...that is all I can see.'],
      ['beerus', 'Saiyans? I thought Frieza took care of them for me years ago.', 'angry'],
      ['whis', 'A handful survived on a planet called Earth. One of them, a Son Goku, even defeated Frieza.'],
      ['beerus', 'Goku, eh? Where is he now?'],
      ['whis', 'Training on King Kai\'s planet, it seems. It\'s only twenty-six minutes away.'],
      ['beerus', 'Then let\'s pay the North Kai a visit. I\'m in the mood to meet a god.', 'smirk'],
      ['c01_fish', '*blub* (That poor little planet...)'],
    ]);
    await s.fadeOut(30);
    removeAll(s, ['c01_fish', 'c01_beerus', 'c01_whis']);
    s.show('hero', true);
    s.letterbox(false);
    s.set('c01_beerusAwake');
  },

  // ---------------------------------------------------------------- King Kai's planet
  c01_kingkai_arrive: async (s) => {
    s.letterbox(true);
    s.music('peaceful');
    const [kx, ky] = HUB.kingKai.kingKai;
    actor(s, 'c01_kingkai', 'kingKai', kx, ky, 'down', 'King Kai');
    await s.walk('hero', kx, ky + 3, 1);
    await s.emote('c01_kingkai', '!');
    await s.talk([
      ['kingKai', 'WAAAH! Goku! How many times have I told you not to just pop into people\'s homes?!', 'shock'],
      ['goku', 'Heya, King Kai! Sorry! Can I train here for a while? I\'ve been farming for months and I\'m super rusty.', 'happy'],
      ['kingKai', 'Hmph. It\'s still my planet, you know, even if I\'m still dead because of YOU.', 'angry'],
      ['kingKai', 'Fine. But first, the rule of my planet: tell me a joke!'],
    ]);
    const c = await s.ask('goku', 'Uh... a joke...', ['Why did Gregory cross the road?', 'What do you call a sleepy bull?']);
    if (c === 0) {
      await s.talk([
        ['goku', 'Why did Gregory cross the road? ...Because you hit him with a hammer!', 'happy'],
        ['kingKai', '...Pfff... PFAHAHAHA! Because I hit him! Oh, that poor cricket! HAHAHA!', 'happy'],
      ]);
    } else {
      await s.talk([
        ['goku', 'What do you call a sleepy bull? ...A bull-dozer!', 'happy'],
        ['kingKai', '...BWAHAHAHA! A bull-DOZER! Oh, I\'m stealing that one! HAHAHA!', 'happy'],
      ]);
    }
    await s.say('kingKai', 'Ahem. Alright, alright. Let\'s see how rusty you really are. Out on the lawn!');
    await unlockSpot(s, 'spot_kingkai');
    s.letterbox(false);
    s.set('c01_atKingKai');
    await s.call('c01_kingkai_train');
  },

  /** Re-entrant (King Kai and the planet's onEnter resume it if a visit was ever cut short). */
  c01_kingkai_train: async (s) => {
    if (s.flag(SEALED) || s.flag('c01_beerusFight')) return;
    s.letterbox(true);
    const [gx, gy] = HUB.kingKai.gregory;
    await s.talk([
      ['kingKai', 'My planet has ten times Earth\'s gravity. You remember your first lesson here?'],
      ['goku', 'Catch Bubbles, then hit Gregory with the hammer!'],
      ['kingKai', 'Skip the hammer. Your fists will do. Gregory! Front and centre!'],
    ]);
    actor(s, 'c01_gregoryNpc', 'c01_gregory', gx, gy, 'left', 'Gregory');
    await s.say('c01_gregoryNpc', 'Hey! Why is it always ME?!', 'angry');
    s.remove('c01_gregoryNpc');
    s.letterbox(false);
    await s.narrate('Land a hit on Gregory! He\'s fast in this gravity.');
    if (!s.exists('c01_greg')) s.spawnEnemy('c01_gregory', gx, gy, 'c01_greg');
    await arenaClear(s);
    s.field.forceHostile = null;
    s.letterbox(true);
    actor(s, 'c01_gregoryNpc', 'c01_gregory', gx, gy, 'left', 'Gregory');
    await s.talk([
      ['c01_gregoryNpc', 'Ow ow ow... I\'m filing a complaint!', 'hurt'],
      ['kingKai', 'Not bad! Now show me the transformation that made Frieza turn pale. Super Saiyan, Goku!'],
      ['goku', 'You got it! HAAAAAAAH!', 'shout'],
    ]);
    s.remove('c01_gregoryNpc');
    await s.powerUp('hero', '#f8e048', 70);
    await s.setForm('goku', 'ssj');
    s.transformNow('ssj');
    await s.narrate('While transformed, Goku\'s STR, POW and END rise sharply, but EP drains every second. Press B with Z selected again to power down.');
    await s.talk([
      ['kingKai', 'Now THAT\'s more like it! The farming didn\'t take the Saiyan out of you.', 'happy'],
      ['goku', 'Hehe. Hey, King Kai... who\'s the strongest guy in the whole universe? Besides me, someday!', 'happy'],
      ['kingKai', 'W-what? There\'s nobody! Nope! Go chase Bubbles!', 'shock'],
      ['goku', 'C\'mon, King Kai, I can tell you\'re hiding something.'],
      ['kingKai', '...Fine. Above the Kais, there is a God of Destruction. Lord Beerus. He destroys planets so that we Kais can create new ones.', 'sad'],
      ['kingKai', 'And when he\'s in a bad mood, he destroys them for fun. Luckily he\'s been asleep for decades-'],
    ]);
    s.transformNow(null);
    await s.call('c01_beerus_arrives');
  },

  c01_beerus_arrives: async (s) => {
    s.letterbox(true);
    s.stopMusic();
    const [kx, ky] = HUB.kingKai.kingKai;
    const [fx, fy] = HUB.kingKai.fight;
    const [wx, wy] = HUB.kingKai.whis;
    s.flash('#ffffff', 20);
    s.sfx('teleport');
    s.shake(20, 2);
    actor(s, 'c01_beerus', 'beerus', fx, fy - 1, 'down', 'Beerus');
    actor(s, 'c01_whis', 'whis', wx, wy, 'left', 'Whis');
    actor(s, 'c01_kingkai', 'kingKai', kx, ky, 'down', 'King Kai');
    s.music('godly');
    await s.emote('c01_kingkai', '!');
    await s.talk([
      ['kingKai', 'L-L-L-LORD BEERUS?!', 'shock'],
      ['beerus', 'North Kai. Long time. So which of you is the Saiyan who beat Frieza?'],
      ['goku', 'That\'s me! I\'m Goku. You must be Beerus! King Kai says you\'re super strong. Will you fight me?', 'happy'],
      ['kingKai', 'GOKU!!! Bow! BOW, you idiot!', 'shout'],
      ['beerus', '...Ha. You\'ve got nerve. Fine. I\'ve been asleep for thirty-nine years; I could use a stretch.', 'smirk'],
      ['whis', 'Do try not to break the planet, my lord. It\'s very small.'],
    ]);
    await s.narrate('A real God of Destruction! Goku goes Super Saiyan and throws everything he has at him. Hold on as long as you can!');
    s.transformNow('ssj');
    s.letterbox(false);
    const [bx, by] = tileOf(s, 'c01_beerus');
    s.remove('c01_beerus');
    await arenaFight(s, 'c01_beerus', { x: bx, y: by, uid: 'c01_beerusF', survive: 40, loseOk: true, label: 'HOLD ON' });

    // All out: Super Saiyan isn't enough, so Goku goes to the third level.
    s.letterbox(true);
    s.pose('hero', null);
    s.face('hero', 'c01_beerusF');
    await s.talk([
      ['goku', 'Hah... hah... You\'re incredible! I can\'t even touch you!', 'happy'],
      ['beerus', 'Is that really all? King Kai, your star pupil is a disappointment.', 'smirk'],
      ['goku', 'Nope! I\'ve still got one more. Hang on - this takes a second!', 'shout'],
    ]);
    s.music('heroic');
    await s.powerUp('hero', '#f8e048', 90);
    s.aura('hero', '#f8e048');
    s.flash('#ffffff', 20);
    s.shake(40, 3);
    await s.narrate('Goku forced his way past Super Saiyan, past the second level, all the way to the third. The little planet shook under his feet.');
    await s.talk([
      ['kingKai', 'Super Saiyan 3?! Goku, you\'ll tear my planet in half!', 'shock'],
      ['beerus', 'Oh? Now this is a little more interesting.', 'smirk'],
    ]);
    await s.say('goku', 'HAAAAAH!', 'shout');
    await s.clash('hero', 'c01_beerusF', 50);
    s.stopMusic();
    s.aura('hero', null);
    s.transformNow(null);
    await s.say('beerus', 'Hm. That\'s enough warming up.');
    s.sfx('teleport');
    s.place('c01_beerusF', Math.round(s.field.player.x / TILE), Math.round((s.field.player.y - 14) / TILE) - 1, 'down');
    s.flash('#ffffff', 10);
    s.shake(20, 3);
    s.sfx('hit');
    s.pose('hero', 'ko');
    await s.wait(40);
    await s.talk([
      ['beerus', 'One tap. Hmph. He isn\'t the Super Saiyan God.', 'angry'],
      ['whis', 'Perhaps the other Saiyan on Earth knows something, my lord. The prince... Vegeta, I believe.'],
      ['beerus', 'Vegeta. Yes, I remember that brat\'s father. Let\'s go to this Earth.'],
      ['whis', 'Oh, wonderful! I hear the food on Earth is simply divine.', 'happy'],
    ]);
    s.flash(BEERUS_KI, 16);
    s.sfx('teleport');
    removeAll(s, ['c01_beerusF', 'c01_whis']);
    await s.wait(30);
    await s.talk([
      ['kingKai', 'Goku! Goku, wake up! ...Out cold. From a single chop.', 'shock'],
      ['kingKai', 'This is bad. This is very, very bad. If Vegeta does something stupid down there...', 'sad'],
      ['kingKai', 'I have to warn him. VEGETA! CAN YOU HEAR ME?!', 'shout'],
    ]);
    s.pose('hero', null);
    s.heal();
    s.exp(300);
    s.set('c01_beerusFight');
    await s.done('c01_kingkai', false);
    unforce(s);
    await s.fadeOut(30);
    endScene(s);
    if (s.hasScript('c02_start')) await s.call('c02_start');
  },

  /** King Kai's planet onEnter: picks a cut-short training visit back up (Gregory -> SSJ -> Beerus). */
  c01_kingkai_enter: async (s) => {
    if (!s.check(`chapter==1&c01_atKingKai&!c01_beerusFight&!${SEALED}`)) return;
    await s.wait(16);
    await s.say('kingKai', 'There you are! Where did you run off to? We were in the middle of training!', 'angry');
    await s.call('c01_kingkai_train');
  },

  c01_kingkai_talk: async (s) => {
    if (s.check(`chapter==1&c01_atKingKai&!c01_beerusFight&!${SEALED}`)) { await s.call('c01_kingkai_train'); return; }
    if (s.check('chapter==1&c01_atKingKai')) {
      await s.say('kingKai', 'Bubbles has been training too, you know. He\'s faster than ever. Ten times gravity does wonders for a monkey.');
      return;
    }
    if (s.check('chapter>=2')) {
      await s.say('kingKai', 'Lord Beerus came to MY planet. Sat on MY lawn. I\'ll be finding cat hair in the grass for a century.', 'sad');
      return;
    }
    await s.say('kingKai', 'Hmm? Mortals aren\'t supposed to visit without an appointment. Or a joke.');
  },
});
