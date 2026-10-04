import { registerScripts, type ScriptApi } from '../../../game/script';

/**
 * Ambient talk for the far regions' generic NPCs. Every script varies by chapter and cycles a few lines so
 * repeat visits feel alive. Story NPCs (Future Bulma, Mai, King Kai, Whis, Gowasu...) are added by chapter overlays.
 */

/** Pick the next line of a rotating set, keyed by a counter flag. */
function cycle<T>(s: ScriptApi, key: string, lines: T[]): T {
  const n = s.inc(key) - 1;
  return lines[n % lines.length];
}

/** Offer a quick patch-up (Medic Sora). */
async function offerHeal(s: ScriptApi): Promise<void> {
  const c = await s.ask('fc_medic', 'Want me to patch you up while you\'re here?', ['Yes, please', 'I\'m fine']);
  if (c === 0) {
    s.heal();
    await s.say('fc_medic', 'There. Try to come back in one piece next time. Or at least in fewer pieces.', 'happy');
  } else {
    await s.say('fc_medic', 'Suit yourself. The door\'s always open. Well. The hatch is.');
  }
}

registerScripts({
  // ---------------------------------------------------------------- Future Earth: hideout entrance
  fc_talk_lookout: async (s) => {
    if (s.check('chapter>=11')) {
      const [a, b] = cycle(s, 'fc_lookout_n', [
        ['There are two of them now. The one in black and one in green robes. Mai says they call themselves gods.', 'Gods are supposed to answer prayers. These two just... count us.'],
        ['I stopped looking up at the sky. It\'s easier to keep watch on the ground.', 'If you see a rift open over the city, don\'t go toward it. Please. We can\'t lose anyone else.'],
      ]);
      await s.talk([['fc_lookout', a, 'sad'], ['fc_lookout', b, 'sad']]);
      return;
    }
    if (s.check('chapter>=9')) {
      const [a, b] = cycle(s, 'fc_lookout_n', [
        ['The patrols have changed. Black drones now, with pink lenses. They don\'t scavenge anymore. They hunt.', 'Whatever you do, don\'t lead them back to this hatch.'],
        ['Folks keep asking me if the past will send help.', 'I tell them yes. Somebody has to believe it out loud.'],
      ]);
      await s.talk([['fc_lookout', a, 'angry'], ['fc_lookout', b]]);
      return;
    }
    const first = !s.flag('fc_lookout_met');
    s.set('fc_lookout_met');
    if (first) {
      await s.talk([
        ['fc_lookout', 'Halt! ...Oh. It\'s you, {hero}. Sorry. Every shadow out here looks like him lately.', 'shock'],
        ['fc_lookout', 'Something with Goku\'s face flew over the highway at dawn. Didn\'t even slow down to look at us.', 'sad'],
        ['fc_lookout', 'The overpass is down in the middle. Take the ramp to the service road, or hop the gap if you can fly.'],
      ]);
      return;
    }
    const line = cycle(s, 'fc_lookout_n', [
      'Scavenger drones nest in the old car wrecks. Rusty, slow, still dangerous. Like me.',
      'The city\'s to the east, past the overpass. Capsule Corp is two blocks north of the big avenue.',
      'Bulma hasn\'t slept in three days. Says the machine is almost ready. She says that a lot.',
    ]);
    await s.say('fc_lookout', line);
  },

  // ---------------------------------------------------------------- Future Earth: hideout interior
  fc_talk_medic: async (s) => {
    if (s.check('chapter>=11')) {
      await s.say('fc_medic', 'If your friends from the past can end this, tell them to hurry. I\'m out of everything except hope, and hope doesn\'t stitch wounds.', 'sad');
    } else if (s.check('chapter>=9')) {
      await s.say('fc_medic', cycle(s, 'fc_medic_n', [
        'Everyone\'s on edge since the raid. Sit. Let me look at those cuts before they get infected.',
        'I keep a list of everyone I\'ve patched up. It used to be a long list. I liked it better long.',
      ]), 'sad');
    } else {
      await s.say('fc_medic', cycle(s, 'fc_medic_n', [
        'We used to have a hospital. Now we have me, a shoebox of bandages, and Tamo\'s "medicinal" peaches.',
        'Kiko caught a fever last week and Bulma rebuilt a thermometer out of a broken scouter. That woman scares me.',
        'You fighters always say "it\'s just a scratch." It is never just a scratch.',
      ]));
    }
    await offerHeal(s);
  },

  fc_talk_tamo: async (s) => {
    if (s.check('chapter>=11')) {
      await s.say('fc_tamo', 'In my day the sky was blue and the worst monster in West City was the tax office. I\'d pay double to have them back.', 'sad');
      return;
    }
    if (s.check('chapter>=9')) {
      await s.talk([
        ['fc_tamo', 'Found a can of West City Deluxe Curry in the ruins today. Expired twelve years ago.', 'happy'],
        ['fc_tamo', 'Best thing I\'ve eaten all year. Don\'t tell Sora.'],
      ]);
      return;
    }
    const n = s.inc('fc_tamo_n');
    if (n === 1) {
      await s.talk([
        ['fc_tamo', 'Tamo\'s Salvage! Open all hours. Prices negotiable. Currency: whatever you\'ve got in your pockets.', 'happy'],
        ['fc_tamo', 'Bulma pays me in thank-yous. Worst customer I ever had. Best person I ever met.'],
      ]);
      return;
    }
    if (n % 3 === 2) {
      await s.talk([
        ['fc_tamo', 'Folks used to picnic in the park by the memorial statue, back when parks had grass.'],
        ['fc_tamo', 'The snack vendors buried their good stock when the androids came. Bet some of it\'s still down there. Look closely by the statue\'s feet.', 'smirk'],
      ]);
      return;
    }
    await s.say('fc_tamo', cycle(s, 'fc_tamo_m', [
      'Scrap wire, two cans of peaches, half a radio. Business is booming.',
      'Don\'t touch the red crate. Bulma\'s capsules. She\'ll know. She always knows.',
    ]));
  },

  fc_talk_kiko: async (s) => {
    const trunks = s.check('char:trunks');
    if (s.check('chapter>=11')) {
      await s.say('fc_kiko', 'I drew the sky from before. It\'s all blue crayon. I\'m saving it for when the real one comes back.', 'sad');
      return;
    }
    if (s.check('chapter>=9')) {
      await s.say('fc_kiko', trunks
        ? 'Trunks! You came back! ...Mom says I shouldn\'t cry in front of the fighters, so I\'m not. This is sweat.'
        : 'Are you from the past? Is it true there are TREES there? With leaves on them? On purpose?', trunks ? 'sad' : 'shock');
      return;
    }
    await s.say('fc_kiko', trunks
      ? cycle(s, 'fc_kiko_n', ['Trunks! Did you beat the bad guy yet? No? Tomorrow then! You promised!', 'When I grow up I\'m gonna have purple hair and a sword too.'])
      : cycle(s, 'fc_kiko_n', ['Trunks is gonna beat the bad guy. He promised. ...He did promise, right?', 'I\'m not scared of the dark. The dark is scared of ME.']),
    'happy');
  },

  // ---------------------------------------------------------------- Beerus's planet
  fc_talk_oracle: async (s) => {
    if (s.check('chapter>=7')) {
      await s.say('fc_oracleFish', cycle(s, 'fc_oracle_n', [
        'Blub... I foresee... great balls, larger than planets, scattered across two universes... and also a snack. Do you have a snack?',
        'Blub. Lord Champa sends his regards. By which I mean he insulted Lord Beerus\'s bedhead. Blub.',
      ]));
      return;
    }
    await s.say('fc_oracleFish', cycle(s, 'fc_oracle_n', [
      'Blub... Lord Beerus is asleep. Lord Beerus is always asleep. Except when he is not. Then everyone is very quiet.',
      'I foresee... a delicious pudding in your future. Possibly not YOUR future. Blub.',
      'Mister Whis swims laps around my lake at dawn. He does not get wet. I find this deeply unfair.',
    ]));
  },
});
