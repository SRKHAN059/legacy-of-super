import { registerScripts } from '../../../game/script';
import { ally, cloakCues, everyFrame, twinFight, type TwinOutcome } from './c14_assist';
import './c14_cast';
import { SQUAD, TWIN_EXP } from './c14_enemies';
import { eliminated, erased, FIGHT_MARGIN, onStage, ringOut, stageOn, standIn } from './c14_kit';
import { bossFight, handOff, heroTile, readyGuest, removeAll, sweepRivals } from './helpers';

/**
 * Chapter 14 set pieces (dbs_story.md §7.1 D, eps 101-119), run inline by the stage relays in `c14.ts`:
 *   stage A: the Pride Trooper squad (ep 101), the Kamikaze Fireballs (ep 102), Goku and Hit vs Dyspo and K'nsi
 *            (ep 104), Hit vs Jiren (ep 111);
 *   stage B: Android 17 and 18 vs Ribrianne and Rozie (eps 117-118), Gohan and Piccolo vs Saonel and Pirina
 *            (ep 118), Gamisalas and Damom (ep 119).
 * Each one sets its `c14_*Done` flag when it ends. Like the rest of a relay, a set piece replays from the top when
 * its stage restarts.
 */

registerScripts({
  // ================================================================ stage A
  /**
   * Ep 101: Kahseral's strike squad corners Goku and the Universe 6 Saiyans. Kahseral is untouchable while his four
   * troopers hold formation; once he is worn down, Kale takes control of her power for the first time and blasts
   * him off the stage.
   */
  c14_pride: async (s) => {
    s.clear('c14_squadDown');
    s.music('tense');
    // Goku falls back to the open middle of the ring before the squad closes in: holding off Kale can leave him at the
    // crumbling edge, and a five-on-one there pins troopers against the void where no blow reaches them.
    const [cx, cy] = onStage(s, 22, 16, FIGHT_MARGIN);
    await s.walk('hero', cx, cy, 3);
    const [gx, gy] = heroTile(s);
    stageOn(s, 'c14_cauliflaP', 'caulifla', gx - 3, gy + 1, 'right', 'Caulifla');
    stageOn(s, 'c14_kaleP', 'kale', gx - 4, gy + 2, 'right', 'Kale');
    s.pose('c14_kaleP', 'ko');
    s.flash('#f04050', 8);
    s.sfx('teleport');
    const squad: Array<[string, string, number, number, string]> = [
      ['c14_kahseralP', 'c14_kahseral', gx + 4, gy - 3, 'Kahseral'], ['c14_tupperP', 'c14_tupper', gx + 2, gy - 4, 'Tupper'],
      ['c14_zoirayP', 'c14_zoiray', gx + 7, gy - 1, 'Zoiray'], ['c14_kettleP', 'c14_kettle', gx + 6, gy - 4, 'Kettle'],
      ['c14_cocotteP', 'c14_cocotte', gx + 3, gy + 2, 'Cocotte'],
    ];
    const at = new Map<string, [number, number]>();
    for (const [id, sp, x, y, name] of squad) at.set(sp, stageOn(s, id, sp, x, y, 'left', name, FIGHT_MARGIN));
    await s.talk([
      ['c14_kahseralP', 'Pride Troopers, encircle them! The Saiyans of two universes in one place. Justice is efficient today.', 'smirk'],
      ['c14_cocotteP', 'Space around them sealed, Captain. They have nowhere to run.', 'neutral'],
      ['goku', 'Whoa, whoa! Five of you at once?', 'shock'],
      ['caulifla', 'Back off, red suits! Kale can\'t even stand up yet!', 'angry'],
      ['c14_kahseralP', 'Then she falls first. Universe 11 leaves no threat standing on this stage.', 'neutral'],
      ['goku', 'Caulifla! Keep them off Kale - I\'ll take the front!', 'shout'],
      ['caulifla', 'Tch. Fine! Anybody who lays a finger on Kale gets flattened!', 'angry'],
    ]);
    await s.narrate('The Pride Troopers fight as one unit. While his squad holds formation, Kahseral cannot be touched: break the formation first! Caulifla fights at your side.');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, ...squad.map((q) => q[0]));
    const members: Array<[string, string]> = [['c14_tupper', 'c14_tupper1'], ['c14_zoiray', 'c14_zoiray1'], ['c14_kettle', 'c14_kettle1'], ['c14_cocotte', 'c14_cocotte1']];
    for (const [type, uid] of members) {
      const [x, y] = at.get(type) ?? onStage(s, gx + 3, gy - 2, FIGHT_MARGIN);
      s.spawnEnemy(type, x, y, uid);
    }
    // The formation breaks the moment the last of the four is down (knocked out or rung out). One watcher instead of
    // an onDefeat per trooper (troopers falling in the same frame would start overlapping scripts), and the news is a
    // toast, so the fight never stops for it.
    const formation = everyFrame(s, (f) => {
      if (s.flag('c14_squadDown')) return;
      if (SQUAD.some((uid) => f.enemies.some((e) => e.uid === uid && !e.dead && e.state !== 'dying'))) return;
      s.set('c14_squadDown');
      const k = f.enemies.find((e) => e.uid === 'c14_kahseral1');
      if (k) f.fx.number(k.x, k.y - 40, 'GUARD BROKEN', '#f8e040');
      f.flashScreen('#f04050', 8);
      f.toast(['Kahseral: My formation... broken?!', 'The captain can be hurt now!'], '#f8e040');
    });
    const [kx, ky] = at.get('c14_kahseral') ?? onStage(s, gx + 4, gy - 3, FIGHT_MARGIN);
    // Ep 101: Caulifla guards Kale by going after the troopers who come near (Goku arrives here straight from
    // holding off berserk Kale, so the squad is never his alone).
    const caulifla = ally(s, { id: 'c14_cauliflaP', sprite: 'caulifla', name: 'Caulifla', style: 'strike', atk: 60, mult: 0.6, every: 110, color: '#f8e048', prefer: [...SQUAD] });
    try {
      await bossFight(s, 'c14_kahseral', { x: kx, y: ky, uid: 'c14_kahseral1' });
    } finally {
      formation.stop();
      caulifla.stop();
    }
    s.letterbox(true);
    const boss = standIn(s, 'c14_kahseral1', 'c14_kahseral', kx, ky, 'Kahseral');
    await s.talk([
      ['c14_kahseral', 'You are strong, Son Goku. But justice never tires. Troopers, to me!', 'angry'],
      ['kale', 'Sis... I can do it. This time... I\'m the one in control!', 'shout'],
    ]);
    s.pose('c14_kaleP', null);
    await s.powerUp('c14_kaleP', '#90f070', 40);
    s.sprite('c14_kaleP', 'kaleLSSJ');
    await s.talk([
      ['caulifla', 'Kale... your eyes! You\'re actually in there this time!', 'shock'],
      ['kaleLSSJ', 'Get away from my sister!', 'shout'],
    ]);
    await s.blast('c14_kaleP', boss, '#90f070');
    const b = s.actor(boss);
    const [bx, by] = [Math.floor(b.x / 16), Math.floor((b.y - 14) / 16)];
    s.boom(bx, by, 34, '#90f070');
    await ringOut(s, boss, bx + 9, by - 10);
    await eliminated(s, 'Kale\'s blast throws Kahseral off the stage! Between Goku and Kale, Universe 11 has lost five Pride Troopers.');
    await s.talk([
      ['caulifla', 'THAT\'s my Kale! ...Don\'t get comfy, Goku. Next time it\'s you against us.', 'smirk'],
      ['goku', 'Heh. I\'ll be waiting!', 'happy'],
    ]);
    s.sprite('c14_kaleP', 'kale');
    if (s.exists('c14_cauliflaP')) await s.walkAll([['c14_cauliflaP', gx - 12, gy + 2, 3], ['c14_kaleP', gx - 13, gy + 3, 3]]);
    removeAll(s, 'c14_cauliflaP', 'c14_kaleP');
    s.set('c14_prideDone');
  },

  c14_kahseral_p2: async (s) => {
    await s.say('c14_kahseral', 'Formation or no formation, justice does not retreat! Face me, Son Goku!', 'shout');
  },

  /**
   * Ep 102: Android 17 (guest) against Universe 2's Kamikaze Fireballs. They start in their everyday looks; at the
   * first phase change all three transform (`c14_fireballs_transform`) and Kakunsa turns into a beast-warrior.
   * Ribrianne and Rozie hang back behind a barrier of love. 17 throws Kakunsa out; the other two retreat.
   */
  c14_fireballs: async (s) => {
    s.clear('c14_fireballsUp');
    readyGuest(s, 'android17', 46);
    await handOff(s, 'android17');
    s.music('topArena');
    await s.narrate('Elsewhere on the west ring, Android 17 runs into Universe 2\'s warriors of love.');
    const [hx, hy] = heroTile(s);
    const [bx, by] = stageOn(s, 'c14_brianneF', 'c14_brianne', hx + 3, hy - 3, 'left', 'Brianne', FIGHT_MARGIN);
    const [rx, ry] = stageOn(s, 'c14_sankaF', 'c14_sanka', hx + 6, hy - 2, 'left', 'Su Roas', FIGHT_MARGIN);
    const [kx, ky] = stageOn(s, 'c14_suroasF', 'c14_suroas', hx + 4, hy - 1, 'left', 'Sanka Ku', FIGHT_MARGIN);
    s.face('hero', 'c14_suroasF');
    await s.talk([
      ['c14_brianneF', 'Android 17 of Universe 7! The maidens of Universe 2 have chosen you as our first sweetheart!', 'happy'],
      ['android17', 'Sweetheart. Right. ...You do know this is a fistfight?', 'smirk'],
      ['c14_suroasF', 'Grrr... Brianne, let me bite him already!', 'angry'],
      ['c14_sankaF', 'Not yet, Sanka! We fight at our most beautiful, or not at all!', 'happy'],
      ['c14_brianneF', 'Exactly. Watch closely, Universe 7. Love is about to bloom!', 'happy'],
    ]);
    await s.narrate('Sanka Ku leaps in while the other two hang back behind a barrier of love that no blow can pass. Take Sanka Ku down - and keep an eye on the girls in the back!');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c14_brianneF', 'c14_sankaF', 'c14_suroasF');
    s.spawnEnemy('c14_brianneEscort', bx, by, 'c14_brianneE');
    s.spawnEnemy('c14_rozieEscort', rx, ry, 'c14_sankaE');
    await bossFight(s, 'c14_kakunsa', { x: kx, y: ky, uid: 'c14_kakunsa1' });
    s.letterbox(true);
    // However the fight went, the Fireballs end it transformed.
    if (!s.flag('c14_fireballsUp')) await s.call('c14_fireballs_transform');
    // The two escorts step out of the fight as cutscene actors where they stood.
    const spots: Array<[string, string, string, string]> = [['c14_brianneE', 'c14_ribrianneF', 'ribrianne', 'Ribrianne'], ['c14_sankaE', 'c14_rozieF', 'c14_rozie', 'Rozie']];
    for (const [uid, id, sp, name] of spots) {
      const e = s.exists(uid) ? s.actor(uid) : null;
      const tx = e ? Math.floor(e.x / 16) : hx + 5;
      const ty = e ? Math.floor((e.y - 14) / 16) : hy - 3;
      removeAll(s, uid);
      stageOn(s, id, sp, tx, ty, 'left', name);
    }
    const kak = standIn(s, 'c14_kakunsa1', 'c14_kakunsa', kx, ky, 'Kakunsa');
    s.sprite(kak, 'c14_kakunsa');
    s.face('hero', kak);
    await s.talk([
      ['c14_kakunsa', 'Grrraaah! I\'m not done!', 'angry'],
      ['android17', 'Easy, girl. I\'m a park ranger. I know exactly what to do with a wild animal.', 'smirk'],
    ]);
    await s.blast('hero', kak, '#60e0a0');
    const k = s.actor(kak);
    await ringOut(s, kak, Math.floor(k.x / 16) + 8, Math.floor((k.y - 14) / 16) - 9);
    await eliminated(s, 'Android 17 throws Kakunsa out of the ring! Kakunsa has been eliminated.');
    await s.talk([
      ['ribrianne', 'Kakunsa! ...You\'ll pay for that, Universe 7! Rozie, fall back. Our love will bloom again!', 'angry'],
      ['android17', 'Next time, skip the dance number.', 'smirk'],
    ]);
    if (s.exists('c14_ribrianneF')) await s.flyTo('c14_ribrianneF', hx + 14, hy - 10, 4);
    if (s.exists('c14_rozieF')) await s.flyTo('c14_rozieF', hx + 15, hy - 9, 4);
    removeAll(s, 'c14_ribrianneF', 'c14_rozieF');
    s.set('c14_fireballsDone');
  },

  /** Kakunsa's first phase ends: all three Kamikaze Fireballs transform at once. */
  c14_fireballs_transform: async (s) => {
    if (s.flag('c14_fireballsUp')) return;
    s.set('c14_fireballsUp');
    const looks: Array<[string, string]> = [['c14_kakunsa1', 'c14_kakunsa'], ['c14_brianneE', 'ribrianne'], ['c14_sankaE', 'c14_rozie']];
    for (const [id, sp] of looks) {
      if (!s.exists(id)) continue;
      s.sprite(id, sp);
      const a = s.actor(id);
      s.field.fx.explode(a.x, a.y - 12, 14, '#f878b8');
    }
    s.flash('#f878b8', 18);
    s.sfx('powerUp');
    s.banner('KAMIKAZE FIREBALLS');
    await s.talk([
      ['ribrianne', 'Hearts of Universe 2, shine! Kamikaze Fireballs... TRANSFORM!', 'shout'],
      ['c14_kakunsa', 'Grrrraaah! NOW I get to bite!', 'angry'],
    ]);
  },

  /** Kakunsa's last phase (a heavy blow can skip her second phase: the transformation still happens first). */
  c14_kakunsa_p3: async (s) => {
    if (!s.flag('c14_fireballsUp')) await s.call('c14_fireballs_transform');
    await s.say('android17', 'She fights like a cornered animal. Good thing I have experience with those.', 'smirk');
  },

  /**
   * Ep 104: Goku, in Super Saiyan God to save his stamina, teams up with Hit against Dyspo and K'nsi. Hit fights at
   * Goku's side and his Time-Skip freezes whoever he strikes. K'nsi is eliminated; Dyspo pulls back. Starts in the
   * dark (the caller fades out for the time skip).
   */
  c14_dyspoTag: async (s) => {
    await handOff(s, 'goku');
    s.music('topArena');
    const [gx, gy] = heroTile(s);
    stageOn(s, 'c14_hitD', 'hit', gx - 2, gy + 1, 'right', 'Hit');
    const [dx, dy] = stageOn(s, 'c14_dyspoD', 'dyspo', gx + 4, gy - 2, 'left', 'Dyspo', FIGHT_MARGIN);
    const [nx, ny] = stageOn(s, 'c14_knsiD', 'c14_knsi', gx + 5, gy, 'left', 'K\'nsi', FIGHT_MARGIN);
    s.face('hero', 'c14_dyspoD');
    await s.talk([
      ['dyspo', 'Son Goku AND the assassin of Universe 6, side by side. That saves me a trip.', 'smirk'],
      ['c14_knsiD', 'Leave the assassin to me, Dyspo.', 'neutral'],
      ['hit', 'Goku. Alone, they would pick us off one at a time. I will lend you my hand... this once.', 'neutral'],
      ['goku', 'A team-up with Hit?! Now THAT\'s exciting!', 'happy'],
      ['goku', 'I\'d better save my strength for Jiren, though. Super Saiyan God!', 'shout'],
    ]);
    s.transformNow('ssg');
    await s.powerUp('hero', '#f85070', 30);
    await s.narrate('Hit fights at your side! Each Time-Skip freezes his target for a moment - strike while it cannot move.');
    s.letterbox(false);
    s.music('hit');
    removeAll(s, 'c14_dyspoD', 'c14_knsiD');
    s.spawnEnemy('c14_knsi', nx, ny, 'c14_knsi1');
    const hit = ally(s, { id: 'c14_hitD', sprite: 'hit', name: 'Hit', style: 'timeSkip', atk: 70, mult: 0.8, every: 300, freeze: 45, color: '#c070f0', prefer: ['c14_knsi1'] });
    try {
      await bossFight(s, 'c14_dyspoA', { x: dx, y: dy, uid: 'c14_dyspoA1' });
    } finally {
      hit.stop();
    }
    s.letterbox(true);
    const k = s.field.enemies.find((e) => e.uid === 'c14_knsi1' && !e.dead && e.state !== 'dying' && !e.hidden);
    if (k) {
      // K'nsi is still standing: Hit finishes the job.
      const kx = Math.floor(k.x / 16);
      const ky = Math.floor((k.y - 14) / 16);
      s.flash('#c070f0', 6);
      s.sfx('teleport');
      s.place('c14_hitD', kx - 1, ky, 'right');
      await s.say('hit', 'Time-Skip.', 'neutral');
      s.pose('c14_hitD', 'punch2');
      s.boom(kx, ky, 18, '#c070f0');
      await ringOut(s, 'c14_knsi1', kx + 9, ky + 9);
      s.pose('c14_hitD', null);
    }
    await eliminated(s, 'K\'nsi has been eliminated!');
    const dys = standIn(s, 'c14_dyspoA1', 'dyspo', dx, dy, 'Dyspo');
    await s.talk([
      ['dyspo', 'Tch. Your Time-Skip is quicker than I was told, assassin.', 'angry'],
      ['hit', 'And you are slower than you think.', 'neutral'],
      ['dyspo', 'We\'ll see about that. Universe 11 does not lose the same fight twice!', 'angry'],
    ]);
    // Dyspo is not eliminated (Gohan and Frieza face him in ep 124): he streaks off across the ring, not over its edge.
    const d = s.actor(dys);
    const [rx, ry] = onStage(s, Math.floor(d.x / 16) + 12, Math.floor((d.y - 14) / 16) - 6);
    s.sfx('dash');
    await s.walk(dys, rx, ry, 8);
    removeAll(s, dys);
    await s.talk([
      ['goku', 'Thanks, Hit! We make a pretty good team!', 'happy'],
      ['hit', 'Don\'t get used to it. The next time we meet, we are opponents again.', 'neutral'],
    ]);
    if (s.exists('c14_hitD')) await s.walk('c14_hitD', gx - 12, gy + 2, 3);
    removeAll(s, 'c14_hitD');
    s.transformNow(null);
    s.set('c14_dyspoTagDone');
  },

  c14_dyspoA_p2: async (s) => {
    await s.say('dyspo', 'Faster! Let\'s see your Time-Skip keep up with THIS!', 'shout');
  },

  /**
   * Ep 111, a cutscene as in the anime: Goku lies spent after Ultra Instinct -Sign- fades. Hit steps between him and
   * Jiren, lands Time Release after Time Release on the same spot, seals Jiren in a Time Prison... and Jiren breaks
   * out and throws him off the stage. Expects Goku (the hero) knocked down beside Jiren (`c14_jiren1`).
   */
  c14_hitJiren: async (s) => {
    const [hx, hy] = heroTile(s);
    const jiren = 'c14_jiren1';
    if (!s.exists(jiren)) stageOn(s, jiren, 'jiren', hx + 3, hy - 1, 'left', 'Jiren');
    s.actor(jiren).hidden = false;
    s.face(jiren, 'hero');
    await s.say('jiren', 'Leave the stage while you still can.', 'neutral');
    s.flash('#c070f0', 10);
    s.sfx('teleport');
    s.music('hit');
    stageOn(s, 'c14_hitJ', 'hit', hx + 1, hy, 'right', 'Hit');
    s.face('c14_hitJ', jiren);
    await s.talk([
      ['hit', 'Rest, Goku. This one is my job.', 'neutral'],
      ['goku', 'Hit...?', 'hurt'],
      ['jiren', 'The assassin of Universe 6. I have already seen through your Time-Skip.', 'neutral'],
      ['hit', 'Then see through this.', 'smirk'],
    ]);
    // Time-Skip after Time-Skip: Jiren reads every one.
    const j = s.actor(jiren);
    s.pose(jiren, 'guard');
    for (let i = 0; i < 3; i++) {
      s.flash('#c070f0', 4);
      s.sfx('block');
      s.field.fx.hit(j.x + (i - 1) * 6, j.y - 16, '#c070f0', 5);
      await s.wait(12);
    }
    await s.narrate('Jiren reads every Time-Skip. Hit\'s blows land on nothing but his guard...');
    await s.say('hit', 'Then the same spot. Again. And again.', 'neutral');
    for (let i = 0; i < 3; i++) await s.blast('c14_hitJ', jiren, '#c070f0');
    s.pose(jiren, 'hurt');
    s.aura(jiren, '#c070f0');
    s.tint('rgba(112,48,160,0.35)');
    s.shake(20, 1);
    await s.narrate('Hit traps Jiren in a Time Prison: a pocket of frozen time, sealed with every last ounce of his power.');
    await s.talk([
      ['hit', 'Goku. Use the time I am buying you.', 'neutral'],
      ['goku', 'Hit... thanks.', 'hurt'],
    ]);
    s.shake(30, 3);
    s.flash('#f05050', 16);
    s.tint(null);
    s.music('jiren');
    s.aura(jiren, '#f05050');
    s.pose(jiren, null);
    await s.narrate('Then the prison cracks... and shatters from the inside.');
    await s.say('jiren', 'A worthy technique. It is not enough.', 'neutral');
    await s.blast(jiren, 'c14_hitJ', '#f05050');
    s.boom(hx + 1, hy, 22, '#f05050');
    await ringOut(s, 'c14_hitJ', hx + 2, hy + 12);
    await eliminated(s, 'Hit has been eliminated! Universe 6 fights on without its strongest warrior.');
    await s.say('goku', 'Hit... I won\'t waste it.', 'hurt');
    s.aura(jiren, null);
    // Jiren is not eliminated: he turns his back on Goku and walks off across the ring.
    const [lx, ly] = onStage(s, hx + 11, hy - 5);
    await s.walk(jiren, lx, ly, 2);
    removeAll(s, jiren);
    s.set('c14_hitOut');
  },

  // ================================================================ stage B
  /**
   * Eps 117-118: Android 17 (guest) with Android 18 fighting at his side against Ribrianne, who grows into Super
   * Ribrianne halfway (`c14_ribrianne_super`). 18 knocks her out; then Goku, 17 and 18 throw Rozie off together.
   */
  c14_ribrianne: async (s) => {
    readyGuest(s, 'android17', 46);
    await handOff(s, 'android17');
    s.music('topArena');
    await s.narrate('On the far side of the central ring, Universe 2\'s leader has been waiting for the androids.');
    const [hx, hy] = heroTile(s);
    stageOn(s, 'c14_18R', 'android18', hx - 1, hy + 1, 'up', 'Android 18');
    const [bx, by] = stageOn(s, 'c14_ribrianneR', 'ribrianne', hx + 3, hy - 3, 'down', 'Ribrianne', FIGHT_MARGIN);
    stageOn(s, 'c14_rozieR', 'c14_rozie', hx + 6, hy - 2, 'down', 'Rozie');
    await s.talk([
      ['c14_ribrianneR', 'Universe 7\'s androids! You threw our dear Kakunsa off the stage. Now feel Universe 2\'s love at full strength!', 'angry'],
      ['android18', 'Love? I have a husband and a daughter waiting at home. Don\'t lecture me about love.', 'smirk'],
      ['c14_rozieR', 'Show them, Ribrianne! I\'ll keep the Saiyans busy!', 'happy'],
      ['android17', 'Here we go again with the posing.', 'smirk'],
      ['android18', 'You take the left, I take the right. Like old times.', 'neutral'],
    ]);
    if (s.exists('c14_rozieR')) await s.flyTo('c14_rozieR', hx + 14, hy - 8, 4);
    removeAll(s, 'c14_rozieR', 'c14_ribrianneR');
    await s.narrate('Android 18 fights at your side!');
    s.letterbox(false);
    s.music('boss');
    const eighteen = ally(s, { id: 'c14_18R', sprite: 'android18', name: 'Android 18', style: 'strike', atk: 62, mult: 0.7, every: 110, color: '#f8f0a0' });
    try {
      await bossFight(s, 'c14_ribrianne', { x: bx, y: by, uid: 'c14_ribrianne1' });
    } finally {
      eighteen.stop();
    }
    s.letterbox(true);
    const rib = standIn(s, 'c14_ribrianne1', 'c14_superRibrianne', bx, by, 'Ribrianne', 'down');
    await s.talk([
      ['ribrianne', 'Impossible! My love is the greatest in all the universes!', 'shock'],
      ['android18', 'Your love is for yourself. Mine is for two people waiting at home. That\'s why you lose.', 'neutral'],
    ]);
    const r = s.actor(rib);
    const [rx, ry] = [Math.floor(r.x / 16), Math.floor((r.y - 14) / 16)];
    if (s.exists('c14_18R')) {
      const [ex, ey] = onStage(s, rx - 1, ry + 1);
      await s.walk('c14_18R', ex, ey, 4);
      s.face('c14_18R', rib);
      s.pose('c14_18R', 'kick');
    }
    s.boom(rx, ry, 24, '#f8f0a0');
    await ringOut(s, rib, rx + 8, ry - 10);
    if (s.exists('c14_18R')) s.pose('c14_18R', null);
    await eliminated(s, 'Android 18 kicks Ribrianne out of the ring!');
    // Ep 118: Rozie's last stand.
    s.flash('#f8d070', 8);
    stageOn(s, 'c14_rozieR', 'c14_rozie', hx + 5, hy - 3, 'left', 'Rozie');
    stageOn(s, 'c14_gokuR', 'goku', hx - 2, hy - 2, 'right', 'Goku');
    await s.talk([
      ['c14_rozieR', 'Ribrianne! ...Then I will carry Universe 2\'s love on my own!', 'angry'],
      ['goku', 'Sorry, Rozie. We can\'t lose either!', 'shout'],
    ]);
    await Promise.all([s.blast('c14_gokuR', 'c14_rozieR', '#70c8f8'), s.blast('hero', 'c14_rozieR', '#60e0a0')]);
    if (s.exists('c14_18R')) await s.blast('c14_18R', 'c14_rozieR', '#f8f0a0');
    const z = s.actor('c14_rozieR');
    await ringOut(s, 'c14_rozieR', Math.floor(z.x / 16) + 9, Math.floor((z.y - 14) / 16) - 9);
    await eliminated(s, 'Goku, 17 and 18 blast Rozie off the stage! Universe 2\'s last warriors follow her over the edge.');
    removeAll(s, 'c14_gokuR', 'c14_18R');
    s.set('c14_ribrianneDone');
  },

  /** Ribrianne's second phase: the love of all Universe 2 makes her a giant. */
  c14_ribrianne_super: async (s) => {
    if (s.exists('c14_ribrianne1')) {
      s.sprite('c14_ribrianne1', 'c14_superRibrianne');
      const a = s.actor('c14_ribrianne1');
      s.field.fx.explode(a.x, a.y - 16, 22, '#f878b8');
    }
    s.flash('#f878b8', 16);
    s.sfx('powerUp');
    await s.say('ribrianne', 'Universe 2, lend me your love! Super... RIBRIANNE!', 'shout');
  },

  /**
   * Ep 118: Gohan with Piccolo fighting at his side against Universe 6's Namekians. A twin boss: knock one down
   * and the other must fall within ten seconds, or the first regenerates. Canon's twist (`c14_namek_twist`): every
   * Namekian of their world fused into the two of them. Ends with Universe 6 and Universe 2 being erased.
   */
  c14_namek: async (s) => {
    s.clear('c14_namekTwist');
    await handOff(s, 'gohan');
    s.music('tense');
    await s.narrate('Meanwhile, Gohan and Piccolo come face to face with Universe 6\'s Namekians.');
    const [hx, hy] = heroTile(s);
    stageOn(s, 'c14_piccoloN', 'piccolo', hx - 1, hy + 1, 'up', 'Piccolo');
    const [ax, ay] = stageOn(s, 'c14_saonelN', 'c14_saonel', hx + 2, hy - 3, 'down', 'Saonel', FIGHT_MARGIN);
    const [bx, by] = stageOn(s, 'c14_pirinaN', 'c14_pirina', hx + 5, hy - 2, 'down', 'Pirina', FIGHT_MARGIN);
    await s.talk([
      ['c14_saonelN', 'The Namekian of Universe 7. And his pupil. Our universe needs you gone.', 'neutral'],
      ['piccolo', 'Namekians from Universe 6... Gohan, stay sharp. Their ki is strange. Crowded, somehow.', 'neutral'],
      ['gohan', 'Crowded?', 'shock'],
      ['c14_pirinaN', 'You will understand soon enough.', 'smirk'],
    ]);
    await s.narrate('Namekians regenerate! Knock one of them down and the other must fall within ten seconds - or the first gets back up. Piccolo fights at your side.');
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c14_saonelN', 'c14_pirinaN');
    sweepRivals(s);
    const piccolo = ally(s, { id: 'c14_piccoloN', sprite: 'piccolo', name: 'Piccolo', style: 'blast', atk: 62, mult: 0.6, every: 150, color: '#f8f070' });
    let out: TwinOutcome[] = [];
    try {
      out = await twinFight(s, [{ type: 'c14_saonel', uid: 'c14_saonel1', x: ax, y: ay }, { type: 'c14_pirina', uid: 'c14_pirina1', x: bx, y: by }], 10);
    } finally {
      piccolo.stop();
    }
    s.exp(TWIN_EXP);
    s.letterbox(true);
    // The pair falls together; stage them on their knees where they went down (unless already off the stage).
    const finish: Array<[string, string, string, string]> = [];
    for (const [i, o] of out.entries()) {
      removeAll(s, o.uid);
      if (o.ringedOut) continue;
      const [id, sp, name] = i === 0 ? ['c14_saonelF', 'c14_saonel', 'Saonel'] : ['c14_pirinaF', 'c14_pirina', 'Pirina'];
      stageOn(s, id, sp, o.x, o.y, 'down', name);
      s.pose(id, 'hurt');
      finish.push([id, i === 0 ? 'hero' : 'c14_piccoloN', i === 0 ? '#f0f0ff' : '#f8f070', name]);
    }
    if (finish.length) {
      await s.talk([
        [finish[0][0], 'We carry... a whole world inside us. We cannot... fall here...', 'hurt'],
        ['gohan', 'Neither can we. Piccolo, together!', 'shout'],
        ['piccolo', 'Right behind you!', 'shout'],
      ]);
      await Promise.all(finish.map(([id, from, color]) => (s.exists(from) ? s.blast(from, id, color) : Promise.resolve())));
      await Promise.all(finish.map(([id]) => {
        const a = s.actor(id);
        return ringOut(s, id, Math.floor(a.x / 16) + 8, Math.floor((a.y - 14) / 16) - 10);
      }));
    }
    await eliminated(s, 'Saonel and Pirina are blasted off the stage!');
    await s.say('piccolo', 'They fought for every Namekian of their world. ...I can respect that.', 'neutral');
    await erased(s, 'Before long, Universe 6 and Universe 2 have no fighters left. Champa waves goodbye to Beerus with a grin. Then they are gone.');
    s.set('c14_namekDone');
  },

  /** Either twin's second phase: the reveal of what fills their ki (once per fight). */
  c14_namek_twist: async (s) => {
    if (s.flag('c14_namekTwist')) return;
    s.set('c14_namekTwist');
    await s.talk([
      ['c14_saonel', 'Enough holding back. Show them, Pirina.', 'angry'],
      ['c14_pirina', 'Before this tournament, every warrior of our planet fused into the two of us. We fight with the strength of all Namek!', 'shout'],
      ['piccolo', 'So that\'s what I sensed... a whole planet\'s worth of Namekians!', 'shock'],
    ]);
  },

  /**
   * Ep 119: Piccolo hunts Universe 4's invisible Gamisalas while Gohan deals with the illusions. Gamisalas is unseen
   * except for his cues (`cloakCues`). Then the tiny Damom eliminates Piccolo, Gohan avenges him and Universe 4 is
   * erased. Ends faded out with the hero shown again, ready for the next fighter.
   */
  c14_gamisalas: async (s) => {
    await handOff(s, 'piccolo', { out: { id: 'c14_gohanG', name: 'Gohan' }, at: 'c14_piccoloN' });
    if (s.exists('c14_gohanG')) s.face('hero', 'c14_gohanG');
    await s.talk([
      ['gohan', 'Piccolo! Something just hit me... but there\'s nobody there!', 'hurt'],
      ['piccolo', 'Universe 4. One of them bends light around his body, and the rest are casting illusions.', 'neutral'],
      ['piccolo', 'Gohan, the illusions are yours. Leave the invisible one to me.', 'neutral'],
      ['gohan', 'Right!', 'shout'],
    ]);
    const [hx, hy] = heroTile(s);
    if (s.exists('c14_gohanG')) await s.walk('c14_gohanG', hx - 10, hy + 3, 3);
    removeAll(s, 'c14_gohanG');
    await s.narrate('Gamisalas is invisible! Watch for footprints in the dust and the shimmer before he strikes - or stand perfectly still and let Piccolo\'s ears find him.');
    s.letterbox(false);
    s.music('tense');
    sweepRivals(s);
    const [gx, gy] = onStage(s, hx + 4, hy - 2, FIGHT_MARGIN);
    s.spawnEnemy('c14_gamisalas', gx, gy, 'c14_gamisalas1').cloak = 1;
    const cues = cloakCues(s, 'c14_gamisalas1');
    try {
      await bossFight(s, 'c14_gamisalas', { uid: 'c14_gamisalas1', existing: true });
    } finally {
      cues.stop();
    }
    s.letterbox(true);
    const ge = s.field.enemies.find((e) => e.uid === 'c14_gamisalas1');
    if (ge) ge.cloak = 0;
    const gam = standIn(s, 'c14_gamisalas1', 'gamisalas', gx, gy, 'Gamisalas');
    const g = s.actor(gam);
    g.flash = 6;
    s.face('hero', gam);
    await s.talk([
      ['gamisalas', 'H-how?! Nobody can see me!', 'shock'],
      ['piccolo', 'I didn\'t need to see you. You breathe far too loudly.', 'smirk'],
    ]);
    await s.blast('hero', gam, '#f8f070');
    const [mx, my] = [Math.floor(g.x / 16), Math.floor((g.y - 14) / 16)];
    s.boom(mx, my, 20, '#f8f070');
    await ringOut(s, gam, mx + 9, my - 9);
    await eliminated(s, 'Gamisalas has been eliminated!');
    // Damom: too small to see, strong enough to matter.
    await s.say('piccolo', '...Hm? Another one. Small. Very small...', 'shock');
    const [px, py] = heroTile(s);
    const look = s.field.player.spriteId;
    s.show('hero', false);
    stageOn(s, 'c14_piccoloOut', look, px, py, 'left', 'Piccolo');
    stageOn(s, 'c14_damomG', 'c14_damom', px - 1, py, 'right', 'Damom');
    s.flash('#ffffff', 6);
    s.shake(16, 2);
    s.pose('c14_damomG', 'punch2');
    s.pose('c14_piccoloOut', 'hurt');
    await ringOut(s, 'c14_piccoloOut', px + 10, py + 9);
    s.pose('c14_damomG', null);
    await eliminated(s, 'Piccolo has been eliminated by Damom, a fighter almost too tiny to see!');
    stageOn(s, 'c14_gohanG', 'gohanUltimate', px - 5, py - 1, 'right', 'Gohan');
    await s.say('gohan', 'PICCOLO! ...You\'ll pay for that!', 'shout');
    await s.blast('c14_gohanG', 'c14_damomG', '#f0f0ff');
    await ringOut(s, 'c14_damomG', px + 8, py - 10);
    await erased(s, 'Gohan avenges his mentor: Damom and Universe 4\'s last tricksters are thrown off the stage. Universe 4 is erased.');
    await s.fadeOut(20);
    removeAll(s, 'c14_gohanG');
    s.show('hero', true);
    s.set('c14_gamisalasDone');
  },

  c14_gamisalas_p2: async (s) => {
    await s.say('gamisalas', 'You can hear me? Then I\'ll just have to move faster!', 'angry');
  },
});
