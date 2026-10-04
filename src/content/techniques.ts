/** How a ki technique behaves when fired. Mirrors LoG2's technique families. */
export type TechKind =
  /** Small fast projectile; tap repeatedly for a stream (Ki Blast). */
  | 'shot'
  /** Hold to sustain a straight beam that drains EP (Kamehameha, Galick Gun). */
  | 'beam'
  /** Like beam but pierces through enemies and cancels enemy shots (Special Beam Cannon). */
  | 'pierceBeam'
  /** Lobbed shot that explodes on landing; hold for range (Masenko). */
  | 'arc'
  /** Hold to grow a ball, release to throw; big AoE (Big Bang, Spirit Bomb). */
  | 'charge'
  /** Three-way spread (Scatter Shot / Hellzone Grenade). */
  | 'spread'
  /** Projectile that stuns (Burning Attack). */
  | 'stun'
  /** Fast heavy wave (Sword Blast). */
  | 'wave'
  /** Replaces melee with ki-charged punches while selected (Energy Punch). */
  | 'punch'
  /** Freezes every enemy on screen (Mr. Satan's pose). */
  | 'pose';

/** A ki technique (B button). */
export interface Technique {
  id: string;
  name: string;
  /** Minimum EP cost (LoG2 values). */
  cost: number;
  kind: TechKind;
  /** Damage multiplier on the POW-based formula. */
  mult: number;
  /** Projectile / beam colour. */
  color: string;
  /** Status-screen how-to text. */
  desc: string;
  /** For charge techniques: maximum cost multiplier at full charge. */
  maxCharge?: number;
}

/** Every ki technique in the game. */
export const TECHNIQUES: Record<string, Technique> = {
  kiBlast: { id: 'kiBlast', name: 'Ki Blast', cost: 2, kind: 'shot', mult: 1.0, color: '#f8e070', desc: 'Tap B to fire a quick energy shot. Tap rapidly for a stream. Briefly stuns foes.' },
  kamehameha: { id: 'kamehameha', name: 'Kamehameha', cost: 5, kind: 'beam', mult: 0.55, color: '#70c8f8', desc: 'Hold B to fire a sustained beam. Drains EP while held.' },
  godKamehameha: { id: 'godKamehameha', name: 'God Kamehameha', cost: 6, kind: 'beam', mult: 0.75, color: '#f87090', desc: 'A divine beam empowered by god ki. Hold B to sustain.' },
  spiritBomb: { id: 'spiritBomb', name: 'Spirit Bomb', cost: 8, kind: 'charge', mult: 3.2, color: '#a8e0ff', desc: 'Hold B to gather energy from all living things, release to throw. Stuns nearby foes.', maxCharge: 3 },
  galickGun: { id: 'galickGun', name: 'Galick Gun', cost: 5, kind: 'beam', mult: 0.6, color: '#c070f8', desc: 'Hold B to fire a violet beam. Drains EP while held.' },
  bigBang: { id: 'bigBang', name: 'Big Bang Attack', cost: 12, kind: 'charge', mult: 2.4, color: '#a0e8ff', desc: 'Hold B to charge a sphere of energy; longer charge travels farther and hits harder.', maxCharge: 3 },
  finalFlash: { id: 'finalFlash', name: 'Final Flash', cost: 10, kind: 'beam', mult: 0.9, color: '#f8f080', desc: 'Vegeta\'s ultimate beam. Massive damage, massive EP drain.' },
  masenko: { id: 'masenko', name: 'Masenko', cost: 4, kind: 'arc', mult: 1.8, color: '#f8f070', desc: 'Lob an exploding blast. Hold B longer to throw it farther and harder.', maxCharge: 3 },
  specialBeamCannon: { id: 'specialBeamCannon', name: 'Special Beam Cannon', cost: 5, kind: 'pierceBeam', mult: 0.6, color: '#f8f0a0', desc: 'A drilling beam that pierces every foe in its path and cancels enemy shots.' },
  hellzoneGrenade: { id: 'hellzoneGrenade', name: 'Hellzone Grenade', cost: 12, kind: 'spread', mult: 1.4, color: '#f8e070', desc: 'Fire three blasts in a spread.' },
  burningAttack: { id: 'burningAttack', name: 'Burning Attack', cost: 6, kind: 'stun', mult: 1.0, color: '#f8a040', desc: 'A blazing shot that stuns. Foes glow when the stun is about to wear off.' },
  swordBlast: { id: 'swordBlast', name: 'Sword Blast', cost: 5, kind: 'wave', mult: 2.0, color: '#d0f0ff', desc: 'Send a fast sword wave cutting through the air.' },
  energyPunch: { id: 'energyPunch', name: 'Energy Punch', cost: 4, kind: 'punch', mult: 1.5, color: '#80c0ff', desc: 'While selected, your punches are charged with ki for 1.5x damage. Costs EP per punch.' },
  victoryPose: { id: 'victoryPose', name: 'Victory Pose', cost: 6, kind: 'pose', mult: 0, color: '#ffffff', desc: 'Strike a dazzling pose. The camera flash freezes every foe on screen.' },
  // Guest techniques (Tournament of Power relay).
  deathBeam: { id: 'deathBeam', name: 'Death Beam', cost: 3, kind: 'wave', mult: 1.6, color: '#f070f0', desc: 'A needle-thin finger beam.' },
  barrier: { id: 'barrier', name: 'Barrier Blast', cost: 10, kind: 'pose', mult: 0, color: '#60e0a0', desc: 'Android 17 erupts in a barrier, freezing nearby foes.' },
};

/** Charged melee moves (hold A then release). No EP cost. */
export interface ChargedMelee {
  id: string;
  name: string;
  /** 'lunge' moves forward, 'spin' hits all around in place, 'flurry' allows 3 follow-up taps. */
  style: 'lunge' | 'spin' | 'flurry' | 'smash' | 'slash';
  /** Multiplier at full charge. */
  mult: number;
  desc: string;
}

export const CHARGED_MELEE: Record<string, ChargedMelee> = {
  flurryPunch: { id: 'flurryPunch', name: 'Flurry Punch', style: 'flurry', mult: 2.4, desc: 'Hold A, release for a punch barrage; tap A for 3 more hits.' },
  superKick: { id: 'superKick', name: 'Super Kick', style: 'lunge', mult: 2.6, desc: 'Hold A, release to lunge forward with a kick. Longer hold, more damage.' },
  twoHandedSmash: { id: 'twoHandedSmash', name: 'Two-Handed Smash', style: 'smash', mult: 2.8, desc: 'Hold A, release to leap forward and hammer down with both fists.' },
  crossSlash: { id: 'crossSlash', name: 'Cross Slash', style: 'slash', mult: 2.7, desc: 'Hold A, release to leap and slash twice with your sword.' },
  spinPunch: { id: 'spinPunch', name: 'Whirlspin', style: 'spin', mult: 1.9, desc: 'Hold A, release to spin and strike everything around you.' },
};
