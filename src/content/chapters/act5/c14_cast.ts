import { registerCast } from '../../cast';
import { registerScanAliases, registerScans } from '../../scans';

/**
 * Chapter 14 set-piece cast: the Pride Trooper squad, Universe 2's Kamikaze Fireballs (everyday and transformed
 * looks), Universe 6's Namekian pair, Universe 4's tricksters, and the middle of the west-ring relay (Obni, Roshi's
 * Universe 4 trio, Universe 2's snipers, Max Power Roshi). Every new sprite has a Scouter entry; fighters read the
 * same as their bestiary entry (regular fighters at the engine's trimmed late-tier HP).
 */

const SKIN = '#f8c890';
const NAMEK = '#68b848';

/** Universe 11's Pride Trooper uniform (matches the shared `prideTrooper` sprite). */
const PRIDE = {
  top: '#c02828', topStyle: 'suit', under: '#202020', sleeves: 'long', pants: '#202020', boots: '#f0f0f0', bootTrim: '#c02828',
} as const;

registerCast({
  // ---------------------------------------------------------------- Universe 11: the Pride Trooper squad (ep 101, 104)
  c14_kahseral: { body: 'male', skin: '#7088c8', hair: 'long', hairColor: '#e8e8f0', ears: 'pointed', ...PRIDE, wrist: '#f0f0f0', face: 'stern' },
  c14_tupper: { body: 'big', skin: '#d07858', hair: 'mohawk', hairColor: '#f0d040', ...PRIDE, face: 'stern' },
  c14_zoiray: { body: 'male', skin: '#90c0a0', hair: 'antennae', hairColor: '#4a8060', ...PRIDE, eye: '#d02040' },
  c14_kettle: { body: 'child', skin: '#e0c080', hair: 'helmet', hairColor: '#c02828', accent: '#202020', ...PRIDE },
  c14_cocotte: { body: 'female', skin: '#ece4f0', hair: 'bob', hairColor: '#2c2c48', ...PRIDE, eye: '#5048a0' },
  c14_knsi: { body: 'male', skin: '#c0a0e0', hair: 'spiky', hairColor: '#402060', ...PRIDE, face: 'stern' },

  // ---------------------------------------------------------------- Universe 2: the Kamikaze Fireballs (eps 102, 117-118)
  // Everyday looks, before the transformation. `c14_sanka` is Su Roas (Rozie's everyday self); `c14_suroas` is the
  // wild Sanka Ku (Kakunsa's).
  c14_brianne: { body: 'big', skin: SKIN, hair: 'bun', hairColor: '#f0a0c0', accent: '#f8f0a0', top: '#f0e8f8', topStyle: 'dress', sleeves: 'short', pants: '#f0e8f8', boots: '#f080b0', face: 'gentle' },
  c14_sanka: { body: 'female', skin: '#e0b0a0', hair: 'bob', hairColor: '#806048', top: '#a8c8e8', topStyle: 'shirt', sleeves: 'short', pants: '#506088', boots: '#f0f0f0' },
  c14_suroas: { body: 'female', skin: '#b08058', hair: 'ponytail', hairColor: '#403028', top: '#c8b090', topStyle: 'vest', under: '#c8b090', sleeves: 'none', pants: '#806848', boots: '#503828' },
  // Transformed: Rozie and the beast-warrior Kakunsa (Ribrianne's magical look is the shared `ribrianne` sprite).
  c14_rozie: { body: 'female', skin: SKIN, hair: 'long', hairColor: '#f8d070', accent: '#f878b8', top: '#f0f0f8', topStyle: 'dress', sleeves: 'short', pants: '#f0f0f8', boots: '#80c0f0', wrist: '#80c0f0', face: 'gentle' },
  c14_kakunsa: { body: 'female', skin: '#f0d0a0', hair: 'catEars', hairColor: '#f0b060', accent: '#f8f0d0', top: '#f0a050', topStyle: 'vest', under: '#f0a050', sleeves: 'none', pants: '#f0a050', boots: '#f8f0d0', tail: '#f0b060', eye: '#d04020', face: 'stern' },
  // Super Ribrianne: Universe 2's love made giant.
  c14_superRibrianne: { body: 'big', skin: SKIN, hair: 'braids', hairColor: '#f878b8', accent: '#f8f0a0', top: '#f8a0c8', topStyle: 'dress', sleeves: 'short', pants: '#f8a0c8', boots: '#f0f0f0', wrist: '#f8f0a0', face: 'gentle' },

  // ---------------------------------------------------------------- Universe 6: the Namekian pair (ep 118)
  c14_saonel: { body: 'male', skin: NAMEK, hair: 'antennae', hairColor: NAMEK, ears: 'pointed', top: '#283868', topStyle: 'gi', under: '#283868', sleeves: 'none', belt: '#d0a040', pants: '#283868', boots: '#5a3a20', wrist: '#d03030', face: 'stern' },
  c14_pirina: { body: 'male', skin: '#78c058', hair: 'turban', hairColor: '#f0f0f0', accent: '#d03030', ears: 'pointed', top: '#704028', topStyle: 'gi', under: '#704028', sleeves: 'none', belt: '#283868', pants: '#704028', boots: '#5a3a20', cape: '#f0f0f0', face: 'stern' },

  // ---------------------------------------------------------------- Universe 4: the tiny trickster (ep 119)
  c14_damom: { body: 'child', skin: '#b0a080', hair: 'mohawk', hairColor: '#605030', top: '#806040', topStyle: 'vest', under: '#806040', sleeves: 'none', pants: '#504030', boots: '#302010', face: 'stern' },

  // ---------------------------------------------------------------- Universe 10's last fighter (ep 103)
  c14_obni: { body: 'male', skin: '#9aa0b4', hair: 'spiky', hairColor: '#e8e8f4', accent: '#c0a040', top: '#382838', topStyle: 'suit', under: '#382838', sleeves: 'none', belt: '#c0a040', pants: '#281c28', boots: '#c0a040', wrist: '#c0a040', face: 'stern' },

  // ---------------------------------------------------------------- Universe 4 against Master Roshi (eps 105-106)
  // Universe 4's colours follow the stage's U4 fighters (slate armour, sand trim).
  c14_caway: { body: 'female', skin: '#e8b4cc', hair: 'ponytail', hairColor: '#f4ecf4', accent: '#d0c080', top: '#405880', topStyle: 'suit', under: '#283850', sleeves: 'none', pants: '#283850', boots: '#d0c080', face: 'gentle' },
  c14_dercori: { body: 'female', skin: '#806878', hair: 'hat', hairColor: '#283850', accent: '#d0c080', top: '#283850', topStyle: 'robe', under: '#405880', sleeves: 'long', pants: '#283850', boots: '#201828', eye: '#d0c080', face: 'stern' },
  c14_ganos: { body: 'male', skin: '#e0c070', hair: 'mohawk', hairColor: '#f08030', accent: '#d0c080', top: '#405880', topStyle: 'armor', under: '#283850', sleeves: 'none', pants: '#283850', boots: '#d0c080', eye: '#f0a020', face: 'stern' },
  // Pushed into a corner he turns into a bird of prey: bigger, crested, wings spread behind him.
  c14_ganosBird: { body: 'big', skin: '#f0b040', hair: 'spikyTail', hairColor: '#f06020', accent: '#f8e070', top: '#f0b040', topStyle: 'vest', under: '#405880', sleeves: 'none', pants: '#283850', boots: '#e09030', cape: '#e07028', tail: '#f06020', eye: '#f8e070', face: 'stern' },
  // Master Roshi at Max Power in the tournament: the dojo's brainwashed look without Yurin's glowing eyes.
  c14_roshiMax: { body: 'big', skin: '#e8b078', hair: 'bald', hairColor: '#f0f0f0', top: '#e8b080', topStyle: 'vest', under: '#e8b080', sleeves: 'none', belt: '#e88838', pants: '#f0e8c0', boots: '#806040', face: 'beard' },

  // ---------------------------------------------------------------- Universe 2's snipers (ep 106)
  // Prum, the lookout, sees through a scouter lens; Harmira, the sniper, is the heavy of the pair.
  c14_prum: { body: 'child', skin: '#c8b0e0', hair: 'helmet', hairColor: '#f878b8', accent: '#f8f0a0', top: '#f0e8f8', topStyle: 'suit', under: '#f878b8', sleeves: 'long', pants: '#f878b8', boots: '#f0f0f0', scouter: '#f05080', face: 'stern' },
  c14_harmira: { body: 'big', skin: '#ecdcc4', hair: 'bald', hairColor: '#ecdcc4', top: '#f0e8f8', topStyle: 'suit', under: '#f878b8', sleeves: 'none', belt: '#f878b8', pants: '#f878b8', boots: '#f0f0f0', wrist: '#f878b8', face: 'stern' },
}, {
  c14_kahseral: 'Kahseral', c14_tupper: 'Tupper', c14_zoiray: 'Zoiray', c14_kettle: 'Kettle', c14_cocotte: 'Cocotte', c14_knsi: 'K\'nsi',
  c14_brianne: 'Brianne', c14_sanka: 'Su Roas', c14_suroas: 'Sanka Ku', c14_rozie: 'Rozie', c14_kakunsa: 'Kakunsa', c14_superRibrianne: 'Ribrianne',
  c14_saonel: 'Saonel', c14_pirina: 'Pirina', c14_damom: 'Damom',
  c14_obni: 'Obni', c14_caway: 'Caway', c14_dercori: 'Dercori', c14_ganos: 'Ganos', c14_ganosBird: 'Ganos', c14_roshiMax: 'Master Roshi',
  c14_prum: 'Prum', c14_harmira: 'Harmira',
});

registerScans({
  c14_kahseral: { name: 'Kahseral', kind: 'U11 / Pride Troopers', hp: 8400, str: 60, pow: 58, end: 60, desc: 'Captain of the Pride Troopers\' strike squad. Untouchable while his troopers hold formation.' },
  c14_tupper: { name: 'Tupper', kind: 'U11 / Pride Troopers', hp: 943, str: 52, pow: 48, end: 56, desc: 'A hulking Pride Trooper who fights from inside a wall of his own ki.' },
  c14_zoiray: { name: 'Zoiray', kind: 'U11 / Pride Troopers', hp: 821, str: 52, pow: 54, end: 54, desc: 'A Pride Trooper marksman. Fires from the back of the formation.' },
  c14_kettle: { name: 'Kettle', kind: 'U11 / Pride Troopers', hp: 804, str: 50, pow: 1, end: 52, desc: 'The smallest Pride Trooper and the first one through any gap.' },
  c14_cocotte: { name: 'Cocotte', kind: 'U11 / Pride Troopers', hp: 750, str: 50, pow: 58, end: 54, desc: 'A Pride Trooper who folds space itself. She seals her squad\'s targets into a pocket they cannot slip out of.' },
  c14_knsi: { name: 'K\'nsi', kind: 'U11 / Pride Troopers', hp: 2514, str: 54, pow: 56, end: 54, desc: 'A Pride Trooper who partners with Dyspo. Sure he is fast enough to catch an assassin.' },
  c14_brianne: { name: 'Brianne', kind: 'U2 / Kamikaze Fireballs', hp: 900, str: 10, pow: 40, end: 20, desc: 'An idol of Universe 2 in her everyday clothes. The readings soar the moment she transforms.' },
  c14_sanka: { name: 'Su Roas', kind: 'U2 / Kamikaze Fireballs', hp: 800, str: 12, pow: 36, end: 18, desc: 'Brianne\'s loyal partner. Becomes Rozie when she transforms.' },
  c14_suroas: { name: 'Sanka Ku', kind: 'U2 / Kamikaze Fireballs', hp: 1100, str: 30, pow: 8, end: 22, desc: 'A wild girl from Universe 2 who would rather bite than pose. Becomes Kakunsa when she transforms.' },
  ribrianne: { name: 'Ribrianne', kind: 'U2 / Kamikaze Fireballs', hp: 9000, str: 56, pow: 62, end: 56, desc: 'Leader of the Kamikaze Fireballs. Believes love is the strongest power there is.' },
  c14_superRibrianne: { name: 'Super Ribrianne', kind: 'U2 / Kamikaze Fireballs', hp: 9000, str: 56, pow: 62, end: 56, desc: 'Ribrianne grown giant on the love of all Universe 2. Her readings fill the screen.' },
  c14_rozie: { name: 'Rozie', kind: 'U2 / Kamikaze Fireballs', hp: 6400, str: 50, pow: 60, end: 52, desc: 'Ribrianne\'s second in command. Fires arrows of love that hurt like real ones.' },
  c14_kakunsa: { name: 'Kakunsa', kind: 'U2 / Kamikaze Fireballs', hp: 8400, str: 62, pow: 48, end: 54, desc: 'The beast-warrior of the Kamikaze Fireballs. Fights on instinct, claws first.' },
  c14_saonel: { name: 'Saonel', kind: 'U6 Namekian / Team U6', hp: 8200, str: 54, pow: 50, end: 56, desc: 'A Namekian of Universe 6. His readings flicker as if many warriors were inside him.' },
  c14_pirina: { name: 'Pirina', kind: 'U6 Namekian / Team U6', hp: 8200, str: 52, pow: 50, end: 56, desc: 'Saonel\'s partner. Every Namekian of their world fused into the two of them.' },
  gamisalas: { name: 'Gamisalas', kind: 'U4 / Team U4', hp: 8200, str: 52, pow: 50, end: 40, desc: 'A Universe 4 fighter who bends light around himself. The scouter can read him even when your eyes cannot.' },
  c14_damom: { name: 'Damom', kind: 'U4 / Team U4', hp: 2000, str: 40, pow: 30, end: 30, desc: 'A Universe 4 fighter so small he is almost invisible. Hits far above his size.' },
  c14_obni: { name: 'Obni', kind: 'U10 / Team U10', hp: 8200, str: 54, pow: 52, end: 60, desc: 'Universe 10\'s last fighter. A husband and a father, and his fists know it.' },
  c14_caway: { name: 'Caway', kind: 'U4 / Team U4', hp: 2143, str: 50, pow: 46, end: 46, desc: 'A Universe 4 fighter who counts on a pretty smile to make her opponents drop their guard.' },
  c14_dercori: { name: 'Dercori', kind: 'U4 / Team U4', hp: 1886, str: 40, pow: 52, end: 44, desc: 'A hooded Universe 4 fighter who throws dark ki from a safe distance.' },
  c14_ganos: { name: 'Ganos', kind: 'U4 / Team U4', hp: 8200, str: 48, pow: 46, end: 56, desc: 'A Universe 4 fighter with a bird\'s crest. The more he is pushed, the stronger he gets.' },
  c14_ganosBird: { name: 'Ganos', kind: 'U4 / Team U4', hp: 8200, str: 48, pow: 46, end: 56, desc: 'Ganos transformed into a bird of prey. His readings climb with every blow he takes.' },
  c14_prum: { name: 'Prum', kind: 'U2 / Team U2', hp: 1800, str: 1, pow: 56, end: 42, desc: 'Universe 2\'s lookout and decoy. His body turns to a mirror that bounces Harmira\'s shots at targets from angles nobody expects.' },
  c14_harmira: { name: 'Harmira', kind: 'U2 / Team U2', hp: 8200, str: 52, pow: 52, end: 52, desc: 'Universe 2\'s real sniper. He tracks targets by their body heat and fires from a hiding place, through Prum\'s mirror.' },
});

// Master Roshi at Max Power files under Master Roshi, like the dojo's brainwashed Max Power look.
registerScanAliases({ c14_roshiMax: 'roshi' });
