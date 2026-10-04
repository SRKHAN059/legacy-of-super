import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { addProp, ballCheck, DB_ITEMS, dbCount, removeIf, removeProp, respawn, stage } from './shared';

/**
 * Chapter 3 - "Battle of Gods" (Goku, L12-15). Main story beats:
 *   c03_start (cc_yard)  -> radar hunt (see c03_world.ts / c03_vault.ts)
 *   c03_ritual (Bulma, all 7 balls) -> Shenron + the Saiyan ritual -> Super Saiyan God
 *   c03_sky_sea: Beerus (3 phases, ends at 50%) -> c03_orbit clash -> c03_end at cc_yard -> c04_start
 */

/** Party guests standing on the Capsule Corp lawn during chapter 3 (overlay NPC ids). */
const C03_PARTY = [
  'c03_bulma', 'c03_beerus', 'c03_whis', 'c03_vegeta', 'c03_gohan', 'c03_videl', 'c03_goten', 'c03_trunks',
  'c03_chichi', 'c03_krillin', 'c03_18', 'c03_piccolo', 'c03_panchy',
] as const;

/** Opening scene on the Capsule Corp lawn: Beerus gives Goku time; Bulma hands over the Dragon Radar. */
async function openingScene(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.music('tense');
  stage(s, 'c03_beerus', 'beerus', 22, 18, 'down');
  stage(s, 'c03_whis', 'whis', 24, 18, 'down');
  stage(s, 'c03_bulma', 'bulma', 19, 20, 'right');
  stage(s, 'c03_vegeta', 'vegeta', 26, 20, 'left');
  s.place('hero', 22, 21, 'up');
  await s.pan(22, 19, 30);
  await s.narrate('The party lawn at Capsule Corporation lies in ruins. Lord Beerus sits among the wreckage, licking pudding off a spoon.');
  await s.talk([
    ['beerus', 'So you\'re Kakarot. The one who bounced off my finger on King Kai\'s little planet.', 'smirk'],
    ['goku', 'Heh... yeah. Sorry about everybody here, Lord Beerus. They didn\'t know who you were.', 'sad'],
    ['beerus', 'I came for one thing: the Super Saiyan God from my dream. Show me one and maybe I won\'t erase this planet.', 'neutral'],
    ['goku', 'A Super Saiyan God? I\'ve never even heard of one... but I bet Shenron has!', 'happy'],
  ]);
  s.face('c03_bulma', 'hero');
  await s.talk([
    ['bulma', 'The Dragon Balls! They were in the bingo prize case!', 'shock'],
    ['bulma', 'When Beerus had his little pudding tantrum the case blew open. Pilaf and his brats grabbed some and ran, and the rest went flying all over the planet.', 'angry'],
    ['vegeta', 'Then go and FIND them, Kakarot. Quickly.', 'angry'],
    ['vegeta', 'I will... keep our guest entertained.', 'sad'],
    ['whis', 'Do take your time. The food on this planet is simply exquisite. Lord Beerus, have you tried these octopus dumplings?', 'happy'],
    ['beerus', 'Hmph. Fine. I\'ll wait until I\'m bored. Don\'t make me bored, Saiyan.', 'smirk'],
  ]);
  await s.emote('hero', '!');
  s.face('c03_bulma', 'hero');
  await s.talk([
    ['bulma', 'Here. My Dragon Radar - freshly calibrated. It beeps when you\'re close.', 'happy'],
  ]);
  await s.give('dragonRadar');
  await s.narrate('Press R to open the regional map. With the Dragon Radar, nearby Dragon Balls blink in orange.');
  await s.talk([
    ['bulma', 'Last reading, the biggest cluster was out in Diablo Desert - that\'s Pilaf\'s old castle. I\'ve also got signals near Satan City, Kame House and Korin Tower... and one way up on the Lookout.', 'neutral'],
    ['goku', 'Got it! Seven balls, here I come!', 'happy'],
  ]);
  s.unlockRegion('spot_desert');
  s.unlockRegion('spot_lookout');
  s.unlockRegion('spot_satancity');
  s.unlockRegion('spot_kame');
  await s.quest('c03_dragonballs');
  await s.narrate('New destinations on the world map: Diablo Desert and The Lookout.');
  s.follow();
  s.letterbox(false);
  unforce(s);
  await s.narrate('You can switch between Goku and Vegeta at any save point. The West City world sign is west of the Capsule Corp gate.');
  s.music('town');
}

/** The ritual: Shenron appears, five Saiyans plus Videl's unborn child turn Goku into a Super Saiyan God. */
async function ritualScene(s: ScriptApi): Promise<void> {
  force(s, 'goku');
  s.letterbox(true);
  await s.fadeOut(20);
  for (const id of C03_PARTY) removeIf(s, id);
  respawn(s, 'r_bulma', 'bulma', 18, 21, 'right');
  respawn(s, 'r_chichi', 'chichi', 17, 22, 'right');
  respawn(s, 'r_videl', 'videl', 18, 23, 'right');
  respawn(s, 'r_vegeta', 'vegeta', 27, 22, 'left');
  respawn(s, 'r_gohan', 'gohan', 19, 24, 'right');
  respawn(s, 'r_goten', 'goten', 26, 25, 'up');
  respawn(s, 'r_trunks', 'trunksKid', 27, 25, 'up');
  respawn(s, 'r_krillin', 'krillin', 29, 22, 'left');
  respawn(s, 'r_18', 'android18', 30, 22, 'left');
  respawn(s, 'r_piccolo', 'piccolo', 30, 20, 'left');
  respawn(s, 'r_beerus', 'beerus', 27, 19, 'left');
  respawn(s, 'r_whis', 'whis', 28, 19, 'left');
  s.place('hero', 23, 22.5, 'up');
  for (const d of DB_ITEMS) s.take(d);
  addProp(s, 'c03_dbRing', 21.75, 19.25, 'c03_dbRingProp');
  await s.pan(23, 20, 1);
  await s.fadeIn(20);
  await s.talk([
    ['bulma', 'All seven! Okay, Goku - say the words.', 'happy'],
    ['goku', 'Eternal Dragon! Come on out, Shenron!', 'shout'],
  ]);
  s.stopMusic();
  s.tint('rgba(10,10,40,0.55)');
  s.shake(60, 2);
  s.sfx('powerUp');
  await s.seconds(1);
  s.flash('#f8f0a0', 20);
  addProp(s, 'c03_shenron', 17.5, 11.6, 'c03_shenronProp');
  s.music('godly');
  await s.pan(21, 16, 50);
  await s.talk([
    ['shenronAvatar', 'I am the Eternal Dragon. State your wish, and I shall... grant...', 'neutral'],
    ['shenronAvatar', '...L-Lord Beerus?! The God of Destruction himself?!', 'shock'],
    ['beerus', 'Relax, dragon. They only want a question answered. I\'m just watching.', 'smirk'],
    ['goku', 'Shenron, what\'s a Super Saiyan God? And how do I become one?', 'neutral'],
    ['shenronAvatar', 'Long ago, righteous Saiyans could raise a god from among themselves. Five Saiyans of pure heart join hands and pour their spirit into a sixth.', 'neutral'],
  ]);
  await s.pan(23, 23, 30);
  await s.talk([
    ['bulma', 'Six Saiyans? Okay... Goku, Vegeta, Gohan, Goten, Trunks... that\'s five!', 'shock'],
    ['vegeta', 'Tch. I\'m holding hands with Kakarot\'s brats for this planet. Remember that.', 'angry'],
    ['goku', 'Let\'s just try it! Everybody, around me!', 'happy'],
  ]);
  // Attempt one: four around Goku.
  await s.walkAll([['r_vegeta', 23, 20.8, 1.2], ['r_gohan', 21, 22.5, 1.2], ['r_goten', 25, 22.5, 1.2], ['r_trunks', 23, 24.2, 1.2]]);
  for (const id of ['r_vegeta', 'r_gohan', 'r_goten', 'r_trunks']) s.face(id, 'hero');
  for (const id of ['r_vegeta', 'r_gohan', 'r_goten', 'r_trunks', 'hero']) s.pose(id, 'charge');
  s.aura('hero', '#f8e048');
  await s.seconds(1.5);
  s.aura('hero', null);
  for (const id of ['r_vegeta', 'r_gohan', 'r_goten', 'r_trunks', 'hero']) s.pose(id, null);
  await s.emote('hero', '?');
  await s.talk([
    ['shenronAvatar', 'You lack a sixth Saiyan. Pushing your ki will not change that.', 'neutral'],
    ['goku', 'Aw, man. Where are we gonna find another Saiyan?', 'sad'],
  ]);
  s.face('r_videl', 'r_gohan');
  await s.talk([
    ['videl', 'Um... Shenron? Does a Saiyan who hasn\'t been born yet count?', 'neutral'],
    ['gohan', 'V-Videl? You mean...', 'shock'],
    ['videl', 'I was going to tell you after the party. We\'re having a baby, Gohan.', 'happy'],
  ]);
  await s.emote('r_gohan', '!');
  await s.emote('r_chichi', '♥');
  await s.talk([
    ['chichi', 'A GRANDCHILD! Goku, did you hear?! We\'re going to be grandparents!', 'happy'],
    ['goku', 'Hey, congrats, you two! ...So does that count, Shenron?', 'happy'],
    ['shenronAvatar', 'The child carries Saiyan blood. It counts. Now - do not push your power. Pour your hearts into him.', 'neutral'],
  ]);
  // Attempt two: Videl joins the ring.
  await s.walk('r_videl', 21.2, 24, 1.2);
  await s.walkAll([['r_gohan', 21, 22, 1], ['r_trunks', 24.6, 24.4, 1], ['r_goten', 25, 22, 1]]);
  for (const id of ['r_vegeta', 'r_gohan', 'r_goten', 'r_trunks', 'r_videl']) { s.face(id, 'hero'); s.pose(id, 'charge'); }
  await s.narrate('Six hearts joined as one...');
  s.letterbox(true);
  s.aura('hero', '#f85070');
  await s.powerUp('hero', '#f85070', 90);
  s.sprite('hero', 'gokuSSG');
  s.flash('#f85070', 24);
  for (const id of ['r_vegeta', 'r_gohan', 'r_goten', 'r_trunks', 'r_videl']) s.pose(id, null);
  await s.setForm('goku', 'ssg');
  s.transformNow('ssg');
  await s.talk([
    ['goku', '...Whoa. I feel calm. Really calm. Like my body\'s weightless.', 'neutral'],
    ['vegeta', 'His hair is... red? And I can\'t sense ANYTHING from him.', 'shock'],
    ['beerus', 'That\'s it. That\'s the face from my dream. Finally!', 'happy'],
    ['shenronAvatar', 'My task is complete. And I would very much prefer to leave before the God of Destruction gets bored. Farewell!', 'neutral'],
  ]);
  s.flash('#ffffff', 20);
  removeProp(s, 'c03_shenronProp');
  removeProp(s, 'c03_dbRingProp');
  s.tint(null);
  await s.narrate('The seven Dragon Balls rose into the sky and scattered across the world once more.');
  s.set('c03_ritualDone');
  await s.done('c03_summon');
  await s.quest('c03_beerus');
  s.face('r_beerus', 'hero');
  await s.walk('r_beerus', 25, 21, 1);
  await s.talk([
    ['beerus', 'Well then, Super Saiyan God. Shall we?', 'smirk'],
    ['bulma', 'Not on my lawn! The cake is still out!', 'angry'],
    ['goku', 'Heh. Let\'s go somewhere with more room, Lord Beerus. Over the ocean!', 'happy'],
  ]);
  s.music('godly');
  await s.flyTo('r_beerus', 34, 14, 3);
  s.letterbox(false);
  s.set('c03_seaArrived');
  await s.warp('c03_sky_sea', 6, 11, 'right');
  await s.say('hero', 'Whoa, I can stand on the clouds in this form! ...Lord Beerus is waiting up ahead.', 'happy');
  await s.narrate('Save your game at the save point, then go and meet Lord Beerus.');
}

/** The pre-fight scene on the sea arena, then the boss fight itself. Re-entered after a Game Over via the trigger. */
async function godBattle(s: ScriptApi): Promise<void> {
  if (s.flag('c03_beerusDone')) return;
  force(s, 'goku');
  s.set('c03_seaArrived');
  s.letterbox(true);
  respawn(s, 'c03_sea_beerus', 'beerus', 22, 11, 'left');
  const ready = await s.ask('beerus', 'Well, Super Saiyan God? Shall we begin?', ['Let\'s fight!', 'Give me a minute']);
  if (ready !== 0) {
    await s.say('beerus', 'Fine. Go stretch, eat something, whatever Saiyans do. I\'ll wait over the sea. Not forever.', 'neutral');
    s.remove('c03_sea_beerus');
    s.letterbox(false);
    unforce(s);
    await s.warp('cc_yard', 23, 21, 'down');
    await s.narrate('Talk to Bulma on the Capsule Corp lawn when you are ready to face Lord Beerus.');
    return;
  }
  removeIf(s, 'c03_beerusNpc');
  await s.talk([
    ['beerus', 'No crowd, no cake, nothing to break but water. Perfect.', 'smirk'],
    ['goku', 'This body feels so light I keep overshooting... I\'ll get used to it while we fight!', 'happy'],
    ['beerus', 'Then come. Show me what a god of your kind can do.', 'neutral'],
  ]);
  s.letterbox(false);
  s.remove('c03_sea_beerus');
  s.transformNow('ssg');
  s.music('battle');
  const r = await s.fight('c03_beerus', { x: 22, y: 11, uid: 'c03_beerus1' });
  if (r !== 'end' && r !== 'win') return;
  s.set('c03_beerusDone');
  s.exp(9000);
  await spaceClash(s);
}

/** Space clash, the sphere of destruction, and Beerus calling it a day. */
async function spaceClash(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.remove('c03_beerus1');
  respawn(s, 'c03_sea_beerus', 'beerus', 21, 10, 'left');
  await s.talk([
    ['beerus', 'Ha! You\'re finally keeping up. But this place is too cramped for a real fight.', 'happy'],
    ['goku', 'Then let\'s go higher!', 'shout'],
  ]);
  s.flash('#ffffff', 16);
  await s.narrate('Their fists met over the sea, again and again, and every clash sent a shockwave across the galaxy...');
  await s.warp('c03_orbit', 11, 6, 'right');
  s.letterbox(true);
  respawn(s, 'c03_sp_beerus', 'beerus', 15, 6, 'left');
  s.place('hero', 9, 6, 'right');
  s.sprite('hero', 'gokuSSG');
  await s.lift('hero', 12, 10);
  await s.lift('c03_sp_beerus', 12, 10);
  s.pose('hero', 'fly');
  s.pose('c03_sp_beerus', 'fly');
  await s.pan(12, 6, 20);
  await s.clash('hero', 'c03_sp_beerus', 90);
  s.shake(30, 3);
  await s.narrate('Far away, Old Kai dropped his tea. "If those two keep this up, the universe itself will crack!"');
  await s.talk([
    ['beerus', 'You\'re matching my blows exactly - speed, angle, everything. You learn fast.', 'smirk'],
    ['goku', 'Then try this! God... Kamehameha!', 'shout'],
  ]);
  await s.beamStruggle('gokuSSG', 'beerus', '#f87090', '#c070f8', [
    'Beerus: That\'s more like it!',
    '{hero}: Come on... a little more!',
    'Beerus: Don\'t stop now, Saiyan!',
  ]);
  s.flash('#ffffff', 20);
  s.boom(12, 6, 30, '#f8a0c0');
  await s.narrate('The red glow faded from Goku\'s hair - but the god ki had soaked into his body. Goku kept fighting at the god\'s level, even as a regular Super Saiyan.');
  s.sprite('hero', 'gokuSSJ');
  await s.learn('goku', 'godKamehameha');
  await s.talk([
    ['beerus', 'You absorbed it? Ha! Alright. One last exchange, then.', 'happy'],
  ]);
  s.pose('c03_sp_beerus', 'raise');
  for (let i = 0; i < 4; i++) { s.boom(16, 3 + i, 14 + i * 4, '#c070f8'); await s.wait(8); }
  await s.talk([
    ['goku', 'Whoa... that\'s a whole sun!', 'shock'],
    ['goku', 'Everything I\'ve got - HAAAAH!', 'shout'],
  ]);
  await s.blast('hero', 'c03_sp_beerus', '#70c8f8');
  s.flash('#ffffff', 30);
  s.shake(40, 4);
  s.boom(13, 6, 40, '#f8f0ff');
  await s.seconds(1);
  s.pose('hero', 'ko');
  s.sprite('hero', 'goku');
  await s.lift('hero', 0, 30);
  await s.narrate('Goku punched straight through the sphere of destruction... and the last of his energy went with it.');
  await s.fadeOut(30, '#ffffff');
  s.pose('hero', null);
  await s.warp('cc_yard', 23, 22, 'up');
  await ending(s);
}

/** Back at Capsule Corp: Beerus spares the Earth and falls asleep; Whis takes him home. */
async function ending(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.transformNow(null);
  for (const id of C03_PARTY) removeIf(s, id);
  respawn(s, 'e_vegeta', 'vegeta', 22, 22, 'right');
  respawn(s, 'e_bulma', 'bulma', 19, 21, 'right');
  respawn(s, 'e_gohan', 'gohan', 20, 23, 'right');
  respawn(s, 'e_videl', 'videl', 19, 23, 'right');
  respawn(s, 'e_chichi', 'chichi', 18, 22, 'right');
  respawn(s, 'e_goten', 'goten', 25, 24, 'up');
  respawn(s, 'e_trunks', 'trunksKid', 26, 24, 'up');
  respawn(s, 'e_beerus', 'beerus', 27, 20, 'left');
  respawn(s, 'e_whis', 'whis', 28, 20, 'left');
  s.pose('hero', 'ko');
  await s.pan(23, 21, 1);
  await s.fadeIn(30);
  s.music('peaceful');
  await s.talk([
    ['vegeta', 'Hmph. You fell out of the sky like a sack of rice, Kakarot. I caught you. Don\'t get used to it.', 'smirk'],
    ['goku', 'Heh heh... thanks, Vegeta. Did... did we lose?', 'hurt'],
  ]);
  s.pose('hero', null);
  await s.talk([
    ['beerus', 'Of course you lost. But that was the most fun I\'ve had in a few million years.', 'happy'],
    ['beerus', '*yawn* ...Destroying the Earth now seems like a lot of work. And somebody here makes excellent pudding.', 'neutral'],
  ]);
  s.pose('e_beerus', 'ko');
  await s.emote('e_beerus', '...');
  await s.talk([
    ['whis', 'Oh dear, he\'s fallen asleep. That means the Earth is safe - for now.', 'happy'],
    ['whis', 'Between us, Goku, Lord Beerus wasn\'t using his full power. Perhaps seventy percent. Still, you did very well.', 'smirk'],
    ['goku', 'Seventy?! Ha... hahaha! Then I\'ve got a long way to go!', 'happy'],
    ['whis', 'Please keep plenty of pudding in stock. He wakes up hungry. Until next time, everyone!', 'happy'],
  ]);
  s.flash('#80c0f8', 14);
  removeIf(s, 'e_beerus', 'e_whis');
  await s.talk([
    ['vegeta', 'Gods, angels... I won\'t borrow anyone\'s power. I\'ll surpass them with my own.', 'angry'],
    ['bulma', 'Okay, okay. But first - who\'s cleaning up my party?', 'angry'],
  ]);
  await s.narrate('Far out at sea, a small rowboat carrying three exhausted figures drifted toward the sunset. Pilaf had given up on the Dragon Balls. For today.');
  await s.done('c03_beerus', false);
  s.set('c03_done');
  if (s.flag('c03_hidYajirobe')) { s.clear('ea_yajirobeAway'); s.clear('c03_hidYajirobe'); }
  s.clear('c03_vaultLocked');
  s.unlockRegion('spot_desert');
  s.unlockRegion('spot_lookout');
  unforce(s);
  s.heal();
  s.letterbox(false);
  if (s.hasScript('c04_start')) await s.call('c04_start');
}

registerScripts({
  /** Chapter 3 entry point (called at the end of chapter 2). */
  c03_start: async (s) => {
    ensureChapterState(s, 3);
    s.setChapter(3);
    // Whatever was left of the bingo prize scattered when Beerus threw his tantrum.
    for (const d of DB_ITEMS) while (s.count(d) > 0) s.take(d);
    // Pilaf's vault is sealed until the basement lever puzzle is solved.
    if (!s.flag('c03_vaultOpen')) s.set('c03_vaultLocked');
    // Yajirobe is sitting on a Dragon Ball this chapter: our own Yajirobe stands in for the ambient one.
    if (!s.flag('ea_yajirobeAway')) { s.set('ea_yajirobeAway'); s.set('c03_hidYajirobe'); }
    force(s, 'goku');
    await s.chapter(3, 'Battle of Gods', 'Find the Super Saiyan God');
    await s.warp('cc_yard', 22, 21, 'up');
    await openingScene(s);
  },
  /** Bulma's summon prompt with all seven balls (also callable directly). */
  c03_ritual: async (s) => {
    if (s.flag('c03_ritualDone')) return;
    if (dbCount(s) < 7) { await s.say('bulma', 'We need all seven Dragon Balls first, Goku!', 'angry'); return; }
    if (s.field.def.id !== 'cc_yard') await s.warp('cc_yard', 23, 22, 'up');
    await ritualScene(s);
  },
  /** Trigger/NPC on the sea arena: start (or retry) the Beerus fight. */
  c03_battle: async (s) => {
    if (!s.check('c03_ritualDone&!c03_beerusDone')) {
      await s.narrate('Waves crash far below the cloud bank.');
      return;
    }
    await godBattle(s);
  },
  /** Beerus boss phase taunts. */
  c03_beerus_p2: async (s) => {
    await s.say('beerus', 'Not bad, not bad! Let\'s turn it up a little.', 'smirk');
  },
  c03_beerus_p3: async (s) => {
    await s.say('beerus', 'You\'re getting used to that body. Good... GOOD! Now I\'m actually having fun!', 'happy');
  },
  /** Ball-count check on entering any hunt map (self-gated). */
  c03_ballcheck: async (s) => {
    if (!s.check('chapter==3')) return;
    await ballCheck(s);
  },
});
