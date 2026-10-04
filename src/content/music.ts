import { expandPattern, type Track } from '../engine/audio';

/*
 * The Legacy of Super soundtrack. Every melody here is original, written for this project in the GBA style LoG2
 * used: one pulse channel for the lead, a second pulse channel for harmony and arpeggios, the wave channel as bass
 * and the noise channel as drums.
 *
 * LoG2's area table gives every zone its own field theme (East District, Northern Wastelands, West City, Southern
 * Continent, Northern Mountains, Snowy Highlands, Tropical Islands...) and keeps towns, dungeons, story scenes and
 * bosses on separate tracks, 44 in all. This soundtrack follows the same plan: region field themes, hub and dungeon
 * themes, story leitmotifs, a generic boss theme plus one for each headline villain, and two jingles.
 *
 * A track is arranged from parts. A part is a run of bars with one chord per bar (or two, split at the half bar),
 * a hand-written lead melody, and arranger styles that build the harmony, bass and drum channels from the chords.
 * A bar is 16 rows (16th notes). `song` checks every bar of every hand-written line and throws on a miscount, so a
 * broken track fails as soon as the module loads.
 */

/** Rows in one 4/4 bar. */
const BAR = 16;
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Chord qualities as intervals above the root. */
const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], add9: [0, 4, 7, 14],
};

/** A parsed chord: pitch classes of the root and the bass note, plus the chord's intervals. */
interface Chord {
  root: number;
  bass: number;
  tones: number[];
}

/**
 * Bass line templates for one bar. R root, O root an octave up, F fifth, T third, N the fifth in whichever octave
 * lies nearer the next chord, A a chromatic approach to the next chord's bass.
 */
const BASS = {
  /** Pumping root-fifth eighths. */
  pump: 'R*2 . R F*2 . F R*2 . R F*2 T*2',
  /** Held root and fifth. */
  soft: 'R*6 . . F*4 R*4',
  /** One long root. */
  hold: 'R*14 . .',
  /** Root and octave eighths. */
  drive: 'R*2 O*2 R*2 O*2 R*2 O*2 R*2 O*2',
  /** Straight root eighths. */
  rock: 'R*2 R*2 R*2 R*2 R*2 R*2 R*2 R*2',
  /** Eighth-two-sixteenths gallop. */
  gallop: 'R*2 R R R*2 R R R*2 R R R*2 F F',
  /** Quarter-note walk into the next chord. */
  walk: 'R*4 T*4 N*4 A*4',
  /** 3-3-2 syncopation. */
  sync: 'R*3 R*3 R*2 F*3 F*3 O*2',
  /** Bouncing root, fifth and octave. */
  bounce: 'R*3 R R*2 O*2 F*3 F F*2 O*2',
  /** Root and octave sixteenths for the hardest fights. */
  octave: 'R O R O R O R O R O R O R O R O',
  /** Heartbeat. */
  heart: 'R*2 . R . . . . R*2 . R . . . .',
} as const;

/** Harmony templates for one bar. 1-4 chord tones low to high, V the voice-led chord tone, W the tone above it. */
const HARM = {
  /** Voice-led held tone. */
  pad: 'V*16',
  /** Voice-led tone, then the chord tone above it. */
  pad2: 'V*8 W*8',
  /** Rising sixteenth arpeggio. */
  arp: '1 2 3 4 1 2 3 4 1 2 3 4 1 2 3 4',
  /** Falling sixteenth arpeggio. */
  arpDown: '4 3 2 1 4 3 2 1 4 3 2 1 4 3 2 1',
  /** Up-and-down eighth arpeggio. */
  arp8: '1*2 2*2 3*2 4*2 3*2 2*2 1*2 2*2',
  /** Alberti eighths. */
  alberti: '1*2 3*2 2*2 3*2 1*2 3*2 2*2 3*2',
  /** Off-beat stabs. */
  stab: '. . V*2 . . V*2 . . V*2 . . V*2',
  /** Repeated eighths. */
  pulse: 'V*2 V*2 V*2 V*2 V*2 V*2 V*2 V*2',
  /** Shimmering two-note sixteenth trill. */
  tremolo: 'V W V W V W V W V W V W V W V W',
} as const;

type BassStyle = keyof typeof BASS;
type HarmStyle = keyof typeof HARM;

/** One-bar drum grooves. */
const GROOVE = {
  rock: 'k . h . x . h . k . h k x . h .',
  rock2: 'k . h k x . h . k k h . x . h h',
  march: 'k . h h x . h . k k h . x . h h',
  soft: 'k . . . h . . . k . . . h . . .',
  light: 'k . . h . . h . k . . h . . h .',
  fast: 'k h x h k h x h k h x h k x x h',
  half: 'k . h . h . h . x . h . h . h k',
  disco: 'k . o . x . o . k . o . x . o .',
  shuffle: 'k . . h x . . h k . . h x . h h',
  gallop: 'k . h k x . h k k . h k x . h k',
  tribal: 'k . . t . . k . k . t . T . . .',
  boss: 'k . h k x . h k k . h k x k x h',
  drive: 'k h h h x h h h k h k h x h h h',
  heavy: 'k . . . X . . . k . k . X . . .',
  tick: 'k . h . h . h . k . h . h . h h',
  sparse: 'k . . . . . . . k . . . . . h .',
  calypso: 'k . o k . o x . k . o k . o x .',
  chant: 'k . x . k k x . k . x . k k x x',
  ride: 'k . o . x . o . k . o . x . o o',
  none: '.*16',
} as const;

/** One-bar drum fills for the end of a part. */
const FILL = {
  snare: 'x . x . x . x x x x x x X . X .',
  toms: 't t t t T T T T x x x x X . . .',
  roll: 'k . x x t . t t T . T T X . . .',
  run: 'x x t t T T x x t t T T X . X .',
  break: 'k . . . X . . . k . . . X . X X',
  soft: 'k . . . h . h . k . h . t . T .',
  stop: 'X . . . . . . . . . . . . . . .',
} as const;

/** A groove with a crash cymbal on the downbeat, to open a part. */
const crash = (groove: string): string => groove.replace(/^\S+/, 'c');

/** A run of bars that shares its arrangement. */
interface Part {
  /** One chord per bar, bars separated by '|'; a bar may hold two chords ('F G'), each taking half the bar. */
  chords: string;
  /** Hand-written lead melody, bars separated by '|'. */
  lead: string;
  /** Harmony channel style (default: silent). */
  harm?: HarmStyle;
  /** Hand-written harmony line that replaces `harm`. */
  counter?: string;
  /** Bass style (default pump). */
  bass?: BassStyle;
  /** Groove for every bar, or a list of grooves cycled bar by bar (default: no drums). */
  beat?: string | string[];
  /** Drum bar for the part's first bar. */
  first?: string;
  /** Drum bar for the part's last bar. */
  fill?: string;
}

/** Tempo, duties and volume of a song. */
interface SongMeta {
  bpm: number;
  leadDuty?: number;
  harmonyDuty?: number;
  volume?: number;
  /** Default true; jingles pass false. */
  loop?: boolean;
}

/** Pitch class of a note letter plus accidental. */
function pitchClass(letter: string, acc: string): number {
  return (LETTER[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
}

/** Parse a chord symbol such as 'Am', 'F#m7', 'Bb', 'Cmaj7', 'D/F#'. */
function parseChord(sym: string): Chord {
  const m = /^([A-G])([#b]?)(maj7|m7b5|m7|m6|dim7|dim|aug|sus2|sus4|add9|m|7|6|5)?(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m) throw new Error(`music: bad chord "${sym}"`);
  const root = pitchClass(m[1], m[2]);
  return { root, bass: m[4] ? pitchClass(m[4], m[5]) : root, tones: QUALITY[m[3] ?? ''] };
}

/** MIDI note number to a tracker note name ('C#4'). */
const noteName = (m: number): string => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
/** Lowest MIDI note at or above `floor` with pitch class `pc`. */
const atOrAbove = (pc: number, floor: number): number => floor + ((((pc - floor) % 12) + 12) % 12);

/** Split a '|'-separated line into bars of exactly 16 rows each. */
function bars(line: string, what: string): string[][] {
  return line.split('|').map((b, i) => {
    const rows = expandPattern(b);
    if (rows.length !== BAR) throw new Error(`music: ${what} bar ${i + 1} has ${rows.length} rows, not ${BAR}`);
    return rows;
  });
}

/** Run-length encode rows back into a pattern string. */
function encode(rows: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < rows.length;) {
    const t = rows[i];
    const cont = t === '.' ? '.' : '-';
    let n = 1;
    while (i + n < rows.length && rows[i + n] === cont) n++;
    out.push(n > 1 ? `${t}*${n}` : t);
    i += n;
  }
  return out.join(' ');
}

/** One chord's stretch of a bar, with the part it came from. */
interface Span {
  chord: Chord;
  len: number;
  part: Part;
}

const BASS_FLOOR = 36; // C2
const BASS_CEIL = 50; // D3
const HARM_LO = 55; // G3
const HARM_HI = 76; // E5

/** Bass rows for one span. */
function bassRows(style: BassStyle, s: Span, next: Span): string[] {
  const { chord } = s;
  // Fifth and third sit above the bass note, folding down an octave when they would climb past the bass register.
  const R = atOrAbove(chord.bass, BASS_FLOOR);
  const up = (pc: number): number => {
    const m = R + ((((pc - R) % 12) + 12) % 12);
    return m > BASS_CEIL ? m - 12 : m;
  };
  const F = up(chord.root + 7);
  const T = up(chord.root + chord.tones[1]);
  // Walking lines head for the next chord: the fifth in the octave nearer it, then a semitone into it from the
  // closer side (or the fifth again when the bass does not move).
  const target = atOrAbove(next.chord.bass, BASS_FLOOR);
  const fifths = [F, F > R ? F - 12 : F + 12];
  const N = fifths.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const A = target === R ? F : Math.abs(target - 1 - N) <= Math.abs(target + 1 - N) ? target - 1 : target + 1;
  const sym: Record<string, number> = { R, O: R + 12, F, T, N, A };
  return expandPattern(BASS[style]).slice(0, s.len).map((t) => (t in sym ? noteName(sym[t]) : t));
}

/** Harmony rows for one span; `voice` carries the voice-led tone from span to span. */
function harmRows(style: HarmStyle, s: Span, voice: { v: number }): string[] {
  const { chord } = s;
  const pcs = chord.tones.map((i) => (chord.root + i) % 12);
  let best = voice.v;
  let bestCost = Infinity;
  for (let m = HARM_LO; m <= HARM_HI; m++) {
    const pc = m % 12;
    if (!pcs.includes(pc)) continue;
    const cost = Math.abs(m - voice.v) + (pc === chord.root ? 1.5 : 0);
    if (cost < bestCost) { bestCost = cost; best = m; }
  }
  voice.v = best;
  let above = best + 1;
  while (!pcs.includes(above % 12) && above < best + 12) above++;
  // Four arpeggio steps from the chord's tones within an octave, wrapping up an octave for triads and dyads.
  const base = atOrAbove(chord.root, HARM_LO);
  const inOctave = chord.tones.filter((i) => i < 12);
  const arp = [0, 1, 2, 3].map((k) => base + inOctave[k % inOctave.length] + 12 * Math.floor(k / inOctave.length));
  const sym: Record<string, number> = { V: best, W: above, 1: arp[0], 2: arp[1], 3: arp[2], 4: arp[3] };
  return expandPattern(HARM[style]).slice(0, s.len).map((t) => (t in sym ? noteName(sym[t]) : t));
}

/**
 * Arrange a song. `intro` parts play once; `form` parts loop. Harmony, bass and drums are built from each part's
 * chords and styles; the lead (and an optional counter-line) is taken as written.
 */
function song(meta: SongMeta, parts: Record<string, Part>, form: string[], intro: string[] = []): Track {
  if (!form.length) throw new Error('music: a song needs at least one looping part');
  const lead: string[] = [];
  const drums: string[] = [];
  const counter: (string[] | null)[] = [];
  const spans: Span[] = [];
  const add = (name: string): void => {
    const p = parts[name];
    if (!p) throw new Error(`music: unknown part "${name}"`);
    const chordBars = p.chords.split('|').map((b) => b.trim().split(/\s+/).map(parseChord));
    const leadBars = bars(p.lead, `part ${name} lead`);
    if (leadBars.length !== chordBars.length) throw new Error(`music: part ${name} has ${chordBars.length} chord bars but ${leadBars.length} lead bars`);
    const counterBars = p.counter ? bars(p.counter, `part ${name} counter`) : null;
    if (counterBars && counterBars.length !== chordBars.length) throw new Error(`music: part ${name} counter has ${counterBars.length} bars, not ${chordBars.length}`);
    const grooves = p.beat === undefined ? [GROOVE.none] : Array.isArray(p.beat) ? p.beat : [p.beat];
    chordBars.forEach((cs, i) => {
      if (cs.length > 2) throw new Error(`music: part ${name} bar ${i + 1} has more than two chords`);
      lead.push(...leadBars[i]);
      const last = i === chordBars.length - 1;
      const groove = last && p.fill ? p.fill : i === 0 && p.first ? p.first : grooves[i % grooves.length];
      drums.push(...bars(groove, `part ${name} drums`)[0]);
      for (const chord of cs) spans.push({ chord, len: BAR / cs.length, part: p });
      counter.push(counterBars ? counterBars[i] : null);
    });
  };
  intro.forEach(add);
  const introSpans = spans.length;
  const loopFrom = lead.length;
  form.forEach(add);
  const harmony: string[] = [];
  const bass: string[] = [];
  const voice = { v: 64 };
  spans.forEach((s, i) => {
    // The last bar's approach notes lead back into the loop point.
    const next = spans[i + 1] ?? spans[introSpans];
    bass.push(...bassRows(s.part.bass ?? 'pump', s, next));
    harmony.push(...(s.part.harm ? harmRows(s.part.harm, s, voice) : Array<string>(s.len).fill('.')));
  });
  counter.forEach((c, bar) => {
    if (c) harmony.splice(bar * BAR, BAR, ...c);
  });
  const track: Track = {
    bpm: meta.bpm,
    loop: meta.loop ?? true,
    leadDuty: meta.leadDuty ?? 0.25,
    lead: encode(lead),
    harmony: encode(harmony),
    bass: encode(bass),
    drums: encode(drums),
  };
  if (meta.harmonyDuty !== undefined) track.harmonyDuty = meta.harmonyDuty;
  if (meta.volume !== undefined) track.volume = meta.volume;
  if (loopFrom > 0) track.loopFrom = loopFrom;
  return track;
}

/** Music tracks by id. */
export const TRACKS: Record<string, Track> = {
  // ---- Menus and maps ----

  /** Title screen. C major, heroic; a four-bar fanfare intro, then A-B-C(bVI-bVII)-A'. */
  title: song({ bpm: 132 }, {
    I: {
      chords: 'C | Bb | F | G', harm: 'pad', bass: 'drive', beat: GROOVE.march, fill: FILL.toms,
      lead: 'C5*2 . C5 C5*2 G4*2 C5*4 E5*4 | D5*2 . D5 D5*2 Bb4*2 D5*4 F5*4 | F5*2 . F5 F5*2 C5*2 F5*4 A5*4 | G5*12 . . . .',
    },
    A: {
      chords: 'C | G/B | Am | F | C | G/B | F G | C', harm: 'arp', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock),
      lead: `G4*2 C5*2 D5*2 E5*6 G5*2 E5*2 | D5*8 . . B4*2 G4*4 | A4*2 C5*2 E5*2 A5*6 G5*2 E5*2 | F5*8 E5*4 D5*4 |
        G4*2 C5*2 D5*2 E5*6 G5*2 C6*2 | B5*8 A5*4 G5*4 | A5*4 F5*4 G5*4 B5*4 | C6*12 . . . .`,
    },
    B: {
      chords: 'F | G | Em | Am | Dm | Em | F | G', harm: 'pulse', bass: 'drive', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `A5*3 A5*3 A5*2 C6*4 A5*4 | B5*3 B5*3 B5*2 D6*4 B5*4 | G5*3 G5*3 G5*2 B5*4 G5*2 E5*2 | A5*12 . . E5*2 |
        F5*2 E5*2 F5*2 A5*6 F5*4 | G5*2 F#5*2 G5*2 B5*6 G5*4 | A5*2 G5*2 A5*2 C6*6 D6*4 | D6*12 . . . .`,
    },
    C: {
      chords: 'Ab | Bb | Eb | Cm | Ab | Bb | C | G7', bass: 'soft', beat: GROOVE.half, first: crash(GROOVE.half), fill: FILL.roll,
      lead: `C6*6 Bb5*2 Ab5*4 Eb5*4 | D5*6 F5*2 Bb5*8 | G5*6 F5*2 Eb5*4 Bb4*4 | C5*8 Eb5*4 G5*4 |
        Ab5*6 G5*2 F5*4 Eb5*4 | F5*6 G5*2 Ab5*4 Bb5*4 | C6*8 E6*4 G6*4 | F6*4 D6*4 B5*4 G5*4`,
      counter: `Eb4*8 Ab4*8 | F4*8 Bb4*8 | G4*8 Bb4*8 | G4*8 C5*8 |
        C5*8 Ab4*8 | D5*8 F5*8 | E5*8 G5*8 | B4*8 D5*4 F5*4`,
    },
    A2: {
      chords: 'C | G/B | Am | F | Dm | G | C/E F | G', harm: 'arp', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock), fill: FILL.run,
      lead: `G4*2 C5*2 D5*2 E5*6 G5*2 E5*2 | D5*8 . . B4*2 G4*4 | A4*2 C5*2 E5*2 A5*6 G5*2 E5*2 | F5*8 A5*4 C6*4 |
        D6*4 C6*2 A5*2 F5*4 D5*4 | G5*6 A5*2 B5*4 D6*4 | E6*4 C6*4 F6*4 A5*4 | G5*4 . . B5*2 D6*8`,
    },
  }, ['A', 'B', 'C', 'A2'], ['I']),

  /** Earth world map: flying over the globe. F major, open and soaring; A-B-C-A'. */
  worldmap: song({ bpm: 120 }, {
    A: {
      chords: 'F | C/E | Dm | Bb | F | C | Bb C | F', harm: 'arp8', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock),
      lead: `C5*4 F5*4 A5*6 G5*2 | E5*8 C5*4 E5*4 | D5*4 F5*4 A5*4 C6*4 | Bb5*12 A5*2 G5*2 |
        A5*4 C6*4 F6*6 E6*2 | C6*8 G5*4 E5*4 | D6*4 Bb5*4 C6*4 E6*4 | F6*8 . . C6*2 A5*4`,
    },
    B: {
      chords: 'Dm | Am | Bb | F | Gm | Am | Bb | C', harm: 'pad2', bass: 'soft', beat: GROOVE.light, fill: FILL.soft,
      lead: `A5*6 G5*2 F5*4 D5*4 | E5*6 F5*2 E5*4 C5*4 | D5*4 F5*4 Bb5*6 A5*2 | A5*8 C6*4 A5*4 |
        Bb5*6 A5*2 G5*4 D5*4 | C6*6 D6*2 C6*4 A5*4 | Bb5*4 D6*4 F6*4 D6*4 | E6*4 C6*4 G5*4 E5*4`,
    },
    C: {
      chords: 'Bb | C | Am | Dm | Gm | C | F | Bb C', harm: 'alberti', bass: 'rock', beat: GROOVE.rock2, fill: FILL.toms,
      lead: `F5*2 . F5 D5*2 F5*2 Bb5*4 A5*2 G5*2 | G5*2 . G5 E5*2 G5*2 C6*4 Bb5*2 A5*2 | A5*2 . A5 E5*2 A5*2 C6*4 E6*2 C6*2 | D6*8 A5*4 F5*4 |
        G5*2 . G5 Bb5*2 D6*2 G6*4 F6*2 D6*2 | E6*4 C6*4 G5*4 Bb5*4 | A5*6 C6*2 F6*8 | F6*4 D6*4 E6*4 G6*4`,
    },
    A2: {
      chords: 'F | C/E | Dm | Bb | F | C | Bb C | F', harm: 'arp', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock), fill: FILL.snare,
      lead: `C5*4 F5*4 A5*6 G5*2 | E5*8 G5*4 C6*4 | D6*4 C6*4 A5*4 F5*4 | D5*12 C5*2 D5*2 |
        F5*4 A5*4 C6*6 Bb5*2 | G5*8 E5*4 C5*4 | D5*4 F5*4 E5*4 G5*4 | F5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Space world map: drifting between worlds. C lydian; A-B-C with a long-note drift. */
  space: song({ bpm: 90, leadDuty: 0.5, volume: 0.85 }, {
    A: {
      chords: 'Cmaj7 | D | Cmaj7 | D | Am | Bm | C | D', harm: 'arp8', bass: 'soft',
      lead: `C5*4 E5*4 G5*4 B5*4 | F#5*8 E5*4 D5*4 | E5*4 G5*4 B5*4 E6*4 | D6*12 A5*2 F#5*2 |
        A5*6 G5*2 E5*4 C5*4 | D5*6 F#5*2 B5*8 | C6*6 B5*2 G5*4 E5*4 | F#5*12 . . . .`,
    },
    B: {
      chords: 'Em | C | G | D | Em | C | Am | B', harm: 'pad2', bass: 'soft', beat: GROOVE.sparse,
      lead: `G5*6 F#5*2 E5*4 B4*4 | C5*4 E5*4 G5*8 | B5*6 A5*2 G5*4 D5*4 | A5*12 . . . . |
        B5*6 C6*2 B5*4 G5*4 | E6*8 D6*4 C6*4 | C6*4 A5*4 E5*4 A5*4 | D#6*8 F#5*8`,
    },
    C: {
      chords: 'Cmaj7 | Cmaj7 | D | D | Bm | Em | Cmaj7 | D', harm: 'arp', bass: 'hold',
      lead: `G4*8 B4*8 | E5*16 | F#5*8 A5*8 | D5*16 | F#5*8 D5*8 | G5*8 B5*8 | E6*8 B5*8 | A5*8 F#5*4 D5*4`,
    },
  }, ['A', 'B', 'C']),

  /** Future Earth world map and the resistance hideout: a ruined world that still hopes. E minor; A-B-A'. */
  futureWorld: song({ bpm: 96, leadDuty: 0.5 }, {
    A: {
      chords: 'Em | C | G | D | Em | C | Am | B', harm: 'arp8', bass: 'soft', beat: GROOVE.half,
      lead: `E5*8 D5*4 B4*4 | C5*8 E5*4 G5*4 | B4*6 D5*2 G5*8 | F#5*8 A5*4 F#5*4 |
        G5*8 F#5*4 E5*4 | E5*8 G5*4 C6*4 | C6*6 B5*2 A5*4 E5*4 | F#5*8 D#5*8`,
    },
    B: {
      chords: 'C | D | Bm | Em | C | D | G | B', harm: 'pad2', bass: 'pump', beat: GROOVE.light, fill: FILL.soft,
      lead: `E6*6 D6*2 C6*4 G5*4 | A5*6 B5*2 A5*4 F#5*4 | F#5*6 G5*2 F#5*4 D5*4 | E5*4 G5*4 B5*8 |
        C6*6 B5*2 C6*4 E6*4 | D6*6 C6*2 A5*4 F#5*4 | G5*4 B5*4 D6*4 G6*4 | F#6*8 D#6*4 B5*4`,
    },
    A2: {
      chords: 'Em | C | G | D | C | D | Em | Em', harm: 'alberti', bass: 'soft', beat: GROOVE.half,
      lead: `B5*8 A5*4 G5*4 | E5*8 G5*4 C6*4 | D6*6 B5*2 G5*8 | A5*8 F#5*4 D5*4 |
        E5*6 F#5*2 G5*8 | A5*6 B5*2 C6*4 D6*4 | B5*8 G5*4 E5*4 | E5*12 . . . .`,
    },
  }, ['A', 'B', 'A2']),

  // ---- Earth: homes, towns and hubs ----

  /** Homes and quiet places: Paozu valley, the Son houses, Kame House inside. C major pastorale; A-B-A'. */
  peaceful: song({ bpm: 92, leadDuty: 0.5, volume: 0.85 }, {
    A: {
      chords: 'C | G/B | Am | Em/G | F | C/E | Dm | G', harm: 'arp8', bass: 'soft', beat: GROOVE.light,
      lead: `E5*6 D5*2 C5*4 G4*4 | D5*12 B4*2 G4*2 | C5*6 B4*2 A4*4 E5*4 | G5*8 E5*4 B4*4 |
        A4*4 C5*4 F5*6 E5*2 | E5*8 G5*4 C5*4 | D5*4 F5*4 A5*4 F5*4 | G5*8 . . B4*2 D5*4`,
    },
    B: {
      chords: 'F | G | Em | Am | Dm | G | C | C', harm: 'pad2', bass: 'walk', beat: GROOVE.soft,
      lead: `A5*6 G5*2 F5*4 C6*4 | B5*6 A5*2 G5*4 D5*4 | E5*4 G5*4 B5*4 G5*4 | A5*12 G5*2 E5*2 |
        F5*6 E5*2 D5*4 A5*4 | G5*6 F5*2 D5*4 B4*4 | C5*4 E5*4 G5*4 C6*4 | C6*8 . . . . G5*4`,
    },
    A2: {
      chords: 'C | G/B | Am | Em/G | F | C/E | Dm G | C', harm: 'alberti', bass: 'soft', beat: GROOVE.light,
      lead: `E5*6 D5*2 C5*4 G4*4 | D5*6 E5*2 D5*4 B4*4 | C5*6 D5*2 E5*4 A5*4 | G5*6 F#5*2 E5*4 B4*4 |
        C6*6 A5*2 F5*4 A5*4 | G5*6 E5*2 C5*4 E5*4 | F5*4 D5*4 B4*4 D5*4 | C5*12 . . . .`,
    },
  }, ['A', 'B', 'A2']),

  /** Satan City: the Champ's showbiz town. G major, bouncy with brass-like stabs; A-B-C(chant)-A'. */
  town: song({ bpm: 116, leadDuty: 0.125 }, {
    A: {
      chords: 'G | Em | C | D | G | Em | Am D | G', harm: 'stab', bass: 'bounce', beat: GROOVE.march,
      lead: `D5*2 G5*2 B5*2 G5*2 D6*4 B5*4 | E5*2 G5*2 B5*2 E6*2 D6*4 B5*4 | C6*2 B5*2 A5*2 G5*2 E5*4 G5*4 | A5*4 F#5*4 D5*4 . . . . |
        D5*2 G5*2 B5*2 G5*2 D6*4 B5*4 | E5*2 G5*2 B5*2 E6*2 G6*4 E6*4 | C6*2 E6*2 A6*4 F#6*4 D6*4 | G6*8 D6*4 B5*4`,
    },
    B: {
      chords: 'C | D | Bm | Em | C | D | G/B C | D', harm: 'pad2', bass: 'pump', beat: GROOVE.rock, fill: FILL.snare,
      lead: `E5*3 E5*3 E5*2 G5*4 E5*4 | F#5*3 F#5*3 F#5*2 A5*4 F#5*4 | D6*6 B5*2 F#5*4 B5*4 | G5*12 E5*2 F#5*2 |
        G5*2 E5*2 G5*2 C6*6 B5*2 C6*2 | D6*4 A5*4 F#5*4 D5*4 | B5*4 D6*4 C6*4 E6*4 | D6*8 . . A5*2 F#5*4`,
    },
    C: {
      chords: 'Em | Em | C | D | Em | Em | C | D', harm: 'pulse', bass: 'sync', beat: GROOVE.chant, fill: FILL.run,
      lead: `E5*2 . E5 G5*2 . G5 B5*2 A5*2 G5*4 | .*8 B4*2 D5*2 E5*4 | C5*2 . C5 E5*2 . E5 G5*2 F#5*2 E5*4 | .*8 A4*2 C5*2 D5*4 |
        G5*2 . G5 B5*2 . B5 E6*2 D6*2 B5*4 | .*8 E6*2 D6*2 B5*4 | C6*2 B5*2 A5*2 G5*2 E5*2 G5*2 A5*4 | F#5*4 A5*4 D6*8`,
    },
    A2: {
      chords: 'G | Em | C | D | G | Em | Am D | G', harm: 'stab', bass: 'walk', beat: GROOVE.march, first: crash(GROOVE.march),
      lead: `D5*2 G5*2 B5*2 G5*2 D6*4 B5*4 | E5*2 G5*2 B5*2 E6*2 D6*4 B5*4 | C6*2 B5*2 A5*2 G5*2 E5*4 G5*4 | A5*4 F#5*4 D5*4 . . . . |
        B5*2 D6*2 G6*2 D6*2 B5*4 G5*4 | E6*4 B5*4 G5*4 E5*4 | A5*4 C6*4 D6*4 F#5*4 | G5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** West City and Capsule Corporation: a bright tech city. Bb major synth-pop; A-B-C(lab)-A'. */
  westCity: song({ bpm: 120, leadDuty: 0.25, harmonyDuty: 0.25 }, {
    A: {
      chords: 'Bb | Gm | Eb | F | Bb | Gm | Cm F | Bb', harm: 'stab', bass: 'sync', beat: GROOVE.disco, first: crash(GROOVE.disco),
      lead: `F5*2 Bb5*2 . F5 D6*3 C6*3 Bb5*2 F5*2 | G5*2 Bb5*2 . G5 D6*3 C6*3 Bb5*4 | G5*2 Bb5*2 Eb6*4 D6*2 C6*2 Bb5*4 | A5*8 C6*4 F5*4 |
        F5*2 Bb5*2 . F5 D6*3 C6*3 Bb5*2 D6*2 | F6*3 D6*3 Bb5*2 G5*4 Bb5*4 | C6*4 Eb6*4 A5*4 C6*4 | Bb5*12 . . . .`,
    },
    B: {
      chords: 'Ebmaj7 | Dm7 | Cm7 | F | Ebmaj7 | Dm7 | Gm | F', harm: 'pad2', bass: 'walk', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `G5*6 F5*2 D5*4 Bb4*4 | C5*6 D5*2 F5*4 A5*4 | G5*6 F5*2 Eb5*4 C5*4 | A5*12 . . . . |
        Bb5*6 A5*2 G5*4 D6*4 | C6*6 A5*2 F5*4 D5*4 | Bb5*4 D6*4 G6*4 F6*4 | F6*8 C6*4 A5*4`,
    },
    C: {
      chords: 'Gm | Gm | Eb | Eb | Cm | Cm | D | D', harm: 'arp', bass: 'drive', beat: GROOVE.drive, fill: FILL.toms,
      lead: `G5 . G5 . D6*2 . G5 Bb5*2 . G5 D6*4 | F6*2 D6*2 Bb5*2 G5*2 F5*4 D5*4 | Eb5 . Eb5 . Bb5*2 . Eb5 G5*2 . Eb5 Bb5*4 | D6*2 Bb5*2 G5*2 Eb5*2 D5*4 Bb4*4 |
        C5 . C5 . G5*2 . C5 Eb5*2 . C5 G5*4 | Bb5*2 G5*2 Eb5*2 C5*2 Bb4*4 G4*4 | F#5*4 A5*4 D6*4 C6*4 | A5*4 F#5*4 D5*8`,
    },
    A2: {
      chords: 'Bb | Gm | Eb | F | Bb | Gm | Cm F | Bb', harm: 'stab', bass: 'sync', beat: GROOVE.disco, first: crash(GROOVE.disco), fill: FILL.run,
      lead: `D6*2 F6*2 . D6 Bb5*3 C6*3 D6*4 | Bb5*2 D6*2 . Bb5 G5*3 A5*3 Bb5*4 | G5*4 Bb5*4 Eb6*4 G6*4 | F6*4 C6*4 A5*8 |
        Bb5*4 D6*4 F6*8 | D6*4 Bb5*4 G5*8 | Eb5*4 G5*4 F5*4 A5*4 | Bb5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Bulma's birthday cruise: a swinging party band. F major with a walking bass; A-B-C(bingo)-A'. */
  party: song({ bpm: 126, leadDuty: 0.5 }, {
    A: {
      chords: 'F | D7 | Gm7 | C7 | F | D7 | Gm7 C7 | F', harm: 'stab', bass: 'walk', beat: GROOVE.shuffle,
      lead: `A5*3 C6 A5*4 F5*3 G5 A5*4 | F#5*3 A5 C6*4 D6*8 | Bb5*3 A5 G5*4 F5*3 D5 F5*4 | E5*8 G5*4 Bb5*4 |
        A5*3 C6 F6*4 E6*3 D6 C6*4 | C6*3 A5 F#5*4 A5*8 | G5*3 Bb5 D6*4 C6*3 Bb5 G5*4 | F5*12 . . . .`,
    },
    B: {
      chords: 'Bb | Bbm | F | D7 | Gm | C7 | Am7 D7 | Gm7 C7', harm: 'pad2', bass: 'walk', beat: GROOVE.shuffle, fill: FILL.snare,
      lead: `D6*3 C6 Bb5*4 F5*8 | Db6*3 C6 Bb5*4 F5*8 | A5*3 G5 F5*4 C5*8 | D5*3 F#5 A5*4 C6*8 |
        Bb5*3 A5 G5*4 D6*8 | E6*3 D6 C6*4 Bb5*8 | C6*3 A5 G5*4 F#5*3 A5 C6*4 | Bb5*8 E5*8`,
    },
    C: {
      chords: 'F | F | Bb | Eb | C | F/C | F | C7', harm: 'pulse', bass: 'bounce', beat: GROOVE.ride, fill: FILL.run,
      lead: `C5 . F5 . A5 . C6 . A5 . F5 . C5*4 | D5 . F5 . A5 . D6 . C6*4 A5*4 | D5 . F5 . Bb5 . D6 . Bb5 . F5 . D5*4 | Eb5 . G5 . Bb5 . Eb6 . D6*4 Bb5*4 |
        E5 . G5 . C6 . E6 . C6 . G5 . E5*4 | F5 . A5 . C6 . F6 . C6*4 A5*4 | A5*4 G5*2 F5*2 E5*4 F5*4 | G5*4 E5*4 C5*4 Bb4*4`,
    },
    A2: {
      chords: 'F | D7 | Gm7 | C7 | F | D7 | Gm7 C7 | F', harm: 'stab', bass: 'walk', beat: GROOVE.shuffle, first: crash(GROOVE.shuffle), fill: FILL.break,
      lead: `C6*3 A5 C6*4 F6*3 E6 F6*4 | F#6*3 E6 D6*4 A5*8 | D6*3 C6 Bb5*4 G5*3 F5 G5*4 | Bb5*8 C6*8 |
        A5*3 Bb5 C6*4 A5*3 G5 F5*4 | F#5*3 G5 A5*4 C6*8 | Bb5*4 D6*4 E6*4 G6*4 | F6*8 . . C6*2 A5*4`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** The Lookout, Kami's Palace and Korin Tower: serene, high above the clouds. Bb major; A-B-A'. */
  lookout: song({ bpm: 88, leadDuty: 0.5, volume: 0.85 }, {
    A: {
      chords: 'Bb | F/A | Gm | Eb | Bb | F | Eb F | Bb', harm: 'arp8', bass: 'soft', beat: GROOVE.sparse,
      lead: `F5*6 Bb5*2 D6*8 | C6*6 A5*2 F5*8 | D6*6 Bb5*2 G5*8 | G5*6 Bb5*2 Eb6*8 |
        D6*6 C6*2 Bb5*4 F5*4 | A5*6 Bb5*2 C6*8 | Bb5*4 G5*4 A5*4 C6*4 | Bb5*12 . . . .`,
    },
    B: {
      chords: 'Gm | Dm | Eb | Bb | Cm | F | Gm | F', harm: 'pad2', bass: 'soft', beat: GROOVE.soft,
      lead: `Bb5*4 D6*4 G6*8 | F6*6 D6*2 A5*8 | G5*6 Bb5*2 Eb6*8 | D6*12 . . . . |
        Eb6*6 D6*2 C6*4 G5*4 | A5*6 C6*2 F6*8 | D6*6 C6*2 Bb5*4 G5*4 | A5*8 C6*4 F5*4`,
    },
    A2: {
      chords: 'Bb | F/A | Gm | Eb | Cm | F | Bb | Bb', harm: 'alberti', bass: 'soft', beat: GROOVE.sparse,
      lead: `D5*6 F5*2 Bb5*8 | A5*6 C6*2 F6*8 | G5*6 Bb5*2 D6*8 | Eb6*6 D6*2 Bb5*8 |
        C6*6 Bb5*2 G5*4 Eb5*4 | F5*6 G5*2 A5*4 C6*4 | D6*4 Bb5*4 F5*8 | Bb5*12 . . . .`,
    },
  }, ['A', 'B', 'A2']),

  // ---- Earth: field regions ----

  /** Earth countryside: Mt. Paozu's forests, Korin Forest, the highland meadows. A minor adventure; A-B-C-A'. */
  field: song({ bpm: 128 }, {
    A: {
      chords: 'Am | F | G | Em | Am | F | G | E', harm: 'arp', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock),
      lead: `A4*2 . A4 C5*2 E5*2 A5*4 G5*2 E5*2 | F5*4 E5*2 D5*2 C5*4 A4*4 | G4*2 . G4 B4*2 D5*2 G5*4 F5*2 D5*2 | E5*8 B4*4 E5*4 |
        A4*2 . A4 C5*2 E5*2 A5*4 B5*2 C6*2 | A5*4 F5*2 A5*2 C6*4 A5*4 | B5*4 G5*2 B5*2 D6*4 B5*4 | G#5*8 E5*4 B4*4`,
    },
    B: {
      chords: 'C | G | Am | Em | F | C | Dm | E', harm: 'pad2', bass: 'pump', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `G5*6 E5*2 C6*8 | B5*6 A5*2 G5*4 D5*4 | C6*6 B5*2 A5*4 E5*4 | G5*8 B5*4 G5*4 |
        A5*6 G5*2 F5*4 C5*4 | E5*6 F5*2 G5*4 C6*4 | D6*4 C6*2 A5*2 F5*4 D5*4 | E5*2 G#5*2 B5*2 E6*2 D6*2 B5*2 G#5*4`,
    },
    C: {
      chords: 'Dm | Am | Dm | Am | Bb | F | G | E', harm: 'pulse', bass: 'drive', beat: GROOVE.gallop, fill: FILL.toms,
      lead: `D5*3 F5*3 A5*2 D6*4 C6*2 A5*2 | C6*3 A5*3 E5*2 A5*8 | F5*3 A5*3 D6*2 F6*4 E6*2 D6*2 | E6*8 C6*4 A5*4 |
        D6*4 Bb5*4 F5*4 Bb5*4 | C6*4 A5*4 F5*4 A5*4 | B5*4 D6*4 G6*4 F6*4 | E6*8 . . G#5*2 B5*4`,
    },
    A2: {
      chords: 'Am | F | G | Em | Am | F | G | E', harm: 'arp', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock), fill: FILL.run,
      lead: `A4*2 . A4 C5*2 E5*2 A5*4 G5*2 E5*2 | F5*4 A5*2 C6*2 F6*4 E6*4 | D6*4 B5*2 G5*2 D5*4 G5*4 | E5*4 G5*4 B5*4 E6*4 |
        C6*6 B5*2 A5*4 E5*4 | F5*6 G5*2 A5*4 C6*4 | B5*6 A5*2 G5*4 D5*4 | E5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Diablo Desert: heat shimmer over the dunes. D phrygian dominant; A-B(descent)-C(sandstorm)-A'. */
  desert: song({ bpm: 108, leadDuty: 0.125 }, {
    A: {
      chords: 'D | Eb | D | Gm | D | Eb | Cm | D', harm: 'pad', bass: 'sync', beat: GROOVE.tribal,
      lead: `D5*4 Eb5*2 F#5*2 A5*8 | G5*4 F#5*2 Eb5*2 D5*8 | A5*2 Bb5*2 A5*2 F#5*2 D5*8 | Bb4*4 D5*4 G5*8 |
        D6*4 C6*2 Bb5*2 A5*8 | G5*4 Bb5*2 Eb6*2 D6*8 | C6*4 Bb5*2 A5*2 G5*4 Eb5*4 | F#5*4 Eb5*4 D5*8`,
    },
    B: {
      chords: 'Gm | F | Eb | D | Gm | F | Eb | D', harm: 'arp8', bass: 'pump', beat: GROOVE.tribal, fill: FILL.toms,
      lead: `G5*3 A5*3 Bb5*2 D6*8 | C6*3 Bb5*3 A5*2 F5*8 | Bb5*3 G5*3 Eb5*2 G5*8 | F#5*8 A5*4 D6*4 |
        D6*3 C6*3 Bb5*2 G5*8 | A5*3 Bb5*3 C6*2 F6*8 | G6*4 F6*2 Eb6*2 Bb5*8 | A5*4 F#5*4 D5*8`,
    },
    C: {
      chords: 'D | D | Eb | Eb | D | Gm D | Eb D | D', harm: 'pulse', bass: 'drive', beat: GROOVE.gallop, fill: FILL.run,
      lead: `D4*2 D4 . F#4*2 A4*2 D5*2 C5*2 A4*4 | Bb4*2 A4*2 F#4*2 Eb4*2 D4*8 | Eb4*2 Eb4 . G4*2 Bb4*2 Eb5*2 D5*2 Bb4*4 | C5*2 Bb4*2 G4*2 F#4*2 G4*8 |
        A4*2 D5*2 F#5*2 A5*2 D6*4 C6*4 | Bb5*4 A5*4 F#5*4 Eb5*4 | G5*4 Eb5*4 F#5*4 A5*4 | D6*12 . . . .`,
    },
    A2: {
      chords: 'D | Eb | D | Gm | D | Eb | Cm | D', harm: 'tremolo', bass: 'sync', beat: GROOVE.tribal,
      lead: `A5*4 Bb5*2 A5*2 F#5*8 | G5*4 Bb5*2 G5*2 Eb5*8 | D5*2 Eb5*2 F#5*2 A5*2 D6*8 | D6*4 Bb5*4 G5*8 |
        F#5*4 A5*2 C6*2 D6*8 | Eb6*4 D6*2 Bb5*2 G5*8 | Eb5*4 G5*2 C6*2 Bb5*4 A5*4 | D5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Rocky Wasteland and the Wilderness Plateau: canyons and open range. E minor gallop; A-B-C(dorian)-A'. */
  wasteland: song({ bpm: 120 }, {
    A: {
      chords: 'Em | D | C | D | Em | D | C | B', harm: 'pulse', bass: 'gallop', beat: GROOVE.gallop, first: crash(GROOVE.gallop),
      lead: `E5*2 . E5 G5*2 B5*2 E6*6 D6*2 | D6*4 A5*4 F#5*8 | E5*2 . E5 G5*2 C6*2 E6*6 D6*2 | D6*8 A5*4 F#5*4 |
        G5*2 . G5 B5*2 E6*2 G6*6 F#6*2 | F#6*4 E6*4 D6*8 | E6*4 C6*4 G5*4 E5*4 | F#5*8 D#5*8`,
    },
    B: {
      chords: 'G | D | Am | Em | G | D | C | B7', harm: 'pad2', bass: 'pump', beat: GROOVE.rock, fill: FILL.snare,
      lead: `B5*6 A5*2 G5*4 D5*4 | F#5*6 G5*2 A5*8 | C6*6 B5*2 A5*4 E5*4 | G5*12 . . . . |
        D6*6 C6*2 B5*4 G5*4 | A5*6 B5*2 D6*8 | E6*4 D6*4 C6*4 G5*4 | F#5*4 A5*4 B5*8`,
    },
    C: {
      chords: 'Em | A | Em | A | C | D | Em | B', harm: 'arp8', bass: 'soft', beat: GROOVE.half, fill: FILL.toms,
      lead: `B4*8 E5*8 | C#5*8 E5*8 | G5*8 B5*8 | A5*8 C#6*8 |
        C6*4 B5*4 G5*4 E5*4 | F#5*4 A5*4 D6*8 | E6*4 D6*4 B5*4 G5*4 | F#5*4 B5*4 D#6*8`,
    },
    A2: {
      chords: 'Em | D | C | D | Em | D | C | B', harm: 'pulse', bass: 'gallop', beat: GROOVE.gallop, first: crash(GROOVE.gallop), fill: FILL.run,
      lead: `B4*2 . B4 E5*2 G5*2 B5*6 A5*2 | A5*4 F#5*4 D5*8 | C5*2 . C5 E5*2 G5*2 C6*6 B5*2 | A5*8 D6*8 |
        E6*4 B5*4 G5*4 B5*4 | A5*4 F#5*4 D5*4 F#5*4 | G5*4 E5*4 C5*4 E5*4 | D#5*4 F#5*4 B5*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Snowy Highlands and the high peaks: crystalline air. E minor / G major; A-B-C(blizzard)-A'. */
  snow: song({ bpm: 100, leadDuty: 0.125 }, {
    A: {
      chords: 'Em | Cmaj7 | G | D | Em | Cmaj7 | Am | B', harm: 'arp', bass: 'soft', beat: GROOVE.light,
      lead: `E6*2 B5*2 G5*2 E5*2 F#5*4 G5*4 | B5*8 G5*4 E5*4 | D6*2 B5*2 G5*2 D5*2 E5*4 G5*4 | F#5*8 A5*8 |
        E6*2 B5*2 G5*2 E5*2 G5*4 B5*4 | E6*8 D6*4 B5*4 | C6*4 B5*4 A5*4 E5*4 | D#5*8 F#5*8`,
    },
    B: {
      chords: 'C | G/B | Am | Em | C | D | Em | Em', harm: 'pad2', bass: 'soft', beat: GROOVE.soft,
      lead: `G5*6 E5*2 C6*8 | B5*6 G5*2 D6*8 | C6*6 A5*2 E6*8 | B5*12 . . . . |
        E6*6 D6*2 C6*4 G5*4 | F#5*6 G5*2 A5*4 D6*4 | B5*6 A5*2 G5*4 F#5*4 | E5*12 . . . .`,
    },
    C: {
      chords: 'Am | Em | Am | Em | F | C | D | B', harm: 'tremolo', bass: 'drive', beat: GROOVE.march, fill: FILL.toms,
      lead: `A5*2 A5*2 C6*2 A5*2 E6*8 | G5*2 G5*2 B5*2 G5*2 E6*8 | A5*2 C6*2 E6*2 A6*2 G6*4 E6*4 | B5*8 G5*8 |
        A5*4 C6*4 F6*8 | E6*4 G5*4 C6*8 | F#6*4 D6*4 A5*8 | D#6*8 B5*8`,
    },
    A2: {
      chords: 'Em | Cmaj7 | G | D | Em | Cmaj7 | Am | B', harm: 'arp8', bass: 'soft', beat: GROOVE.light,
      lead: `G5*4 B5*4 E6*6 D6*2 | C6*4 B5*4 G5*8 | B5*4 D6*4 G6*6 F#6*2 | F#6*4 D6*4 A5*8 |
        G5*6 F#5*2 E5*4 B4*4 | C5*6 E5*2 G5*4 B5*4 | A5*4 C6*4 B5*4 A5*4 | F#5*8 D#5*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Kame House island, Monster Island and the Southern Sea: steel-drum calypso. F major; A-B-C(sunset)-A'. */
  islands: song({ bpm: 112, leadDuty: 0.5 }, {
    A: {
      chords: 'F | Bb | C | F | Dm | Bb | C | F', harm: 'stab', bass: 'sync', beat: GROOVE.calypso,
      lead: `C5*3 F5*3 A5*2 C6*2 A5*2 F5*4 | D5*3 F5*3 Bb5*2 D6*2 Bb5*2 F5*4 | E5*3 G5*3 C6*2 E6*2 D6*2 C6*4 | A5*8 . . F5*2 G5*4 |
        A5*3 F5*3 D5*2 F5*2 A5*2 D6*4 | D6*3 Bb5*3 F5*2 Bb5*2 D6*2 F6*4 | E6*3 D6*3 C6*2 G5*2 Bb5*2 C6*4 | A5*12 . . . .`,
    },
    B: {
      chords: 'Bb | C | Am | Dm | Gm | C | F | F', harm: 'arp8', bass: 'sync', beat: GROOVE.calypso, fill: FILL.toms,
      lead: `F5*2 F5*2 . F5 G5*2 . . F5*2 D5*4 | E5*2 E5*2 . E5 G5*2 . . C6*2 G5*4 | A5*2 A5*2 . A5 C6*2 . . A5*2 E5*4 | F5*8 D5*8 |
        G5*2 G5*2 . G5 Bb5*2 . . D6*2 Bb5*4 | C6*2 C6*2 . C6 E6*2 . . G6*2 E6*4 | F6*4 C6*4 A5*4 F5*4 | G5*4 A5*4 C6*8`,
    },
    C: {
      chords: 'Dm | Am | Bb | F | Gm | Am | Bb | C', harm: 'pad2', bass: 'soft', beat: GROOVE.light,
      lead: `D6*6 C6*2 A5*8 | C6*6 A5*2 E5*8 | D6*6 C6*2 Bb5*8 | A5*6 G5*2 F5*8 |
        Bb5*6 A5*2 G5*8 | C6*6 Bb5*2 A5*8 | D6*4 F6*4 D6*4 Bb5*4 | C6*4 E6*4 G6*8`,
    },
    A2: {
      chords: 'F | Bb | C | F | Dm | Bb | C | F', harm: 'stab', bass: 'sync', beat: GROOVE.calypso, first: crash(GROOVE.calypso), fill: FILL.run,
      lead: `A5*3 C6*3 F6*2 E6*2 C6*2 A5*4 | Bb5*3 D6*3 F6*2 D6*2 Bb5*2 F5*4 | G5*3 C6*3 E6*2 G6*2 E6*2 C6*4 | C6*8 . . A5*2 G5*4 |
        A5*3 F5*3 D5*2 A5*2 F5*2 D5*4 | F5*3 D5*3 Bb4*2 D5*2 F5*2 Bb5*4 | G5*3 A5*3 Bb5*2 C6*2 E6*2 G5*4 | F5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Training grounds: the Gravity Room, Whis's field, the dojos. A minor driving rock; A-B-C(countdown)-D. */
  training: song({ bpm: 140 }, {
    A: {
      chords: 'Am | Am | F | G | Am | Am | C | D', harm: 'pulse', bass: 'drive', beat: GROOVE.rock2, first: crash(GROOVE.rock2),
      lead: `A4*2 A4*2 C5*2 A4*2 D5*2 C5*2 A4*4 | E5*2 E5*2 G5*2 E5*2 A5*4 G5*4 | F5*2 F5*2 A5*2 F5*2 C6*4 A5*4 | G5*2 G5*2 B5*2 G5*2 D6*4 B5*4 |
        A5*2 A5*2 C6*2 A5*2 E6*4 D6*4 | C6*2 B5*2 A5*2 G5*2 E5*8 | G5*2 . G5 C6*2 E6*2 G6*8 | F#6*4 E6*4 D6*4 A5*4`,
    },
    B: {
      chords: 'F | G | Em | Am | F | G | E | E', harm: 'arp', bass: 'rock', beat: GROOVE.rock, fill: FILL.snare,
      lead: `C6*6 A5*2 F5*4 A5*4 | D6*6 B5*2 G5*4 B5*4 | E6*6 B5*2 G5*4 E5*4 | A5*8 C6*4 E6*4 |
        F6*6 E6*2 C6*4 A5*4 | D6*6 C6*2 B5*4 G5*4 | G#5*4 B5*4 E6*8 | D6*4 B5*4 G#5*4 E5*4`,
    },
    C: {
      chords: 'Am | Am | Bb | Bb | Am | Am | E | E', harm: 'pulse', bass: 'gallop', beat: GROOVE.boss, fill: FILL.run,
      lead: `A5*2 . . A5*2 . . A5*2 . . A5*2 G5*2 | A5*2 . . A5*2 . . C6*2 . . E6*4 | Bb5*2 . . Bb5*2 . . Bb5*2 . . Bb5*2 A5*2 | Bb5*2 . . Bb5*2 . . D6*2 . . F6*4 |
        E6*2 . . E6*2 . . E6*2 . . E6*2 D6*2 | C6*2 . . A5*2 . . E5*2 . . A5*4 | G#5*4 B5*4 E6*4 G#6*4 | E6*12 . . . .`,
    },
    D: {
      chords: 'C | G | Am | F | C | G | F | E', harm: 'pad2', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock), fill: FILL.toms,
      lead: `E5*4 G5*4 C6*6 B5*2 | B5*4 D6*4 G6*8 | A5*4 C6*4 E6*6 D6*2 | C6*12 . . . . |
        G5*4 C6*4 E6*6 G6*2 | G6*4 F6*4 D6*8 | C6*4 A5*4 F5*8 | G#5*4 B5*4 E6*8`,
    },
  }, ['A', 'B', 'C', 'D']),

  /** Caves, vaults and castle dungeons: dripping echoes. A minor; A-B-C(phrygian creep). */
  cave: song({ bpm: 76, leadDuty: 0.125, volume: 0.85 }, {
    A: {
      chords: 'Am | G | F | E | Am | G | F | E', harm: 'pad', bass: 'hold', beat: GROOVE.sparse,
      lead: `A4*2 . . E5*2 . . C5*2 . . B4*4 | G4*2 . . D5*2 . . B4*2 . . A4*4 | F4*2 . . C5*2 . . A4*2 . . G4*4 | E4*2 . . B4*2 . . G#4*2 . . E5*4 |
        A5*2 . . E5*2 . . C6*2 . . B5*4 | D6*2 . . B5*2 . . G5*2 . . A5*4 | C6*2 . . A5*2 . . F5*2 . . E5*4 | G#5*8 .*8`,
    },
    B: {
      chords: 'Dm | Am | Dm | Am | Bb | Bb | E | E', harm: 'arp8', bass: 'soft', beat: GROOVE.sparse,
      lead: `F5*8 E5*4 D5*4 | C5*8 B4*4 A4*4 | D5*4 F5*4 A5*8 | G#5*4 A5*12 |
        Bb5*8 A5*4 F5*4 | D5*8 F5*8 | E5*8 F5*4 E5*4 | B4*8 G#4*8`,
    },
    C: {
      chords: 'Am F | Bb | Am | Bb | F | E | Am | E', harm: 'tremolo', bass: 'heart', beat: GROOVE.tick,
      lead: `E5*2 . E5 . . E5*2 F5*8 | F5*2 . F5 . . F5*2 D5*8 | C5*2 . C5 . . C5*2 E5*8 | D5*2 . D5 . . D5*2 Bb4*8 |
        A4*4 C5*4 F5*4 A5*4 | G#5*8 B5*8 | A5*8 E5*8 | E5*4 . . . . G#4*8`,
    },
  }, ['A', 'B', 'C']),

  /** Alien worlds: Potaufeu, Planet Babari, the Nameless Planet's rim. Whole-tone and lydian colours; A-B-C-A'. */
  alien: song({ bpm: 104, leadDuty: 0.125, harmonyDuty: 0.25 }, {
    A: {
      chords: 'Caug | D/C | Caug | D/C | Bb | C | Ab | Bb', harm: 'tremolo', bass: 'soft', beat: GROOVE.tribal,
      lead: `E5*2 F#5*2 G#5*2 . . C6*4 G#5*2 E5*2 | F#5*6 E5*2 D5*4 A5*4 | C6*2 Bb5*2 G#5*2 . . E5*4 F#5*2 G#5*2 | A5*12 . . . . |
        D6*4 F6*4 Bb5*4 C6*4 | E6*4 G6*4 C6*4 D6*4 | C6*4 Eb6*4 Ab5*4 Bb5*4 | D6*12 . . . .`,
    },
    B: {
      chords: 'Em | Fmaj7 | Em | Fmaj7 | Am | Bb | Am | B', harm: 'stab', bass: 'bounce', beat: GROOVE.light, fill: FILL.toms,
      lead: `B4*2 E5*2 . B4 G5*2 . E5 F#5*2 G5*4 | A5*2 C6*2 . A5 E6*2 . C6 A5*4 . . | G5*2 B5*2 . G5 E6*2 . B5 D6*2 B5*4 | C6*8 A5*4 F5*4 |
        E5*2 A5*2 . E5 C6*2 . A5 B5*2 C6*4 | D6*8 F6*4 D6*4 | C6*4 E6*4 A5*8 | D#6*4 B5*4 F#5*8`,
    },
    C: {
      chords: 'Dbmaj7 | Cmaj7 | Dbmaj7 | Cmaj7 | Bbm | Ab | Bb | C', harm: 'arp', bass: 'hold', beat: GROOVE.sparse,
      lead: `F5*8 C6*8 | E5*8 B5*8 | Ab5*8 F5*8 | G5*16 |
        F5*4 Db6*4 Bb5*8 | C6*4 Eb6*4 Ab5*8 | D6*4 F6*4 Bb5*8 | E6*8 G6*8`,
    },
    A2: {
      chords: 'Caug | D/C | Caug | D/C | Bb | C | Ab | Bb', harm: 'tremolo', bass: 'soft', beat: GROOVE.tribal, fill: FILL.toms,
      lead: `G#5*2 E5*2 C5*2 . . E5*4 G#5*2 C6*2 | D6*6 C6*2 A5*4 F#5*4 | E6*2 C6*2 G#5*2 . . C6*4 E6*2 G#6*2 | F#6*12 . . . . |
        F6*4 D6*4 Bb5*4 F5*4 | G5*4 C6*4 E6*4 G6*4 | Eb6*4 C6*4 Ab5*4 Eb5*4 | F5*4 D5*4 Bb4*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Beerus's planet and palace: regal, exotic, a little sleepy. Eb lydian; A-B-C(Whis's lesson)-A'. */
  beerusPlanet: song({ bpm: 96, leadDuty: 0.125 }, {
    A: {
      chords: 'Eb | F/Eb | Eb | F/Eb | Cm | Ab | Bb | Bb', harm: 'tremolo', bass: 'soft', beat: GROOVE.light,
      lead: `Bb4*4 Eb5*4 G5*6 F5*2 | A5*8 F5*4 C5*4 | Bb5*4 G5*4 Eb5*6 F5*2 | A5*12 . . . . |
        G5*4 C6*4 Eb6*6 D6*2 | C6*8 Ab5*4 Eb5*4 | F5*4 Bb5*4 D6*6 C6*2 | Bb5*8 . . F5*2 A5*4`,
    },
    B: {
      chords: 'Ab | Bb | Gm | Cm | Ab | Bb | Eb | Eb', harm: 'pad2', bass: 'pump', beat: GROOVE.march, fill: FILL.snare,
      lead: `C6*6 Bb5*2 Ab5*4 Eb5*4 | D6*6 C6*2 Bb5*4 F5*4 | Bb5*6 A5*2 G5*4 D5*4 | Eb5*12 . . . . |
        Eb6*6 D6*2 C6*4 Ab5*4 | F6*6 Eb6*2 D6*4 Bb5*4 | G5*4 Bb5*4 Eb6*8 | D6*4 Bb5*4 G5*8`,
    },
    C: {
      chords: 'Cm | Fm | Bb | Eb | Ab | Fm | G | G', harm: 'stab', bass: 'bounce', beat: GROOVE.light, fill: FILL.toms,
      lead: `C6 . G5 . Eb5 . G5 . C6 . D6 . Eb6*4 | C6 . Ab5 . F5 . Ab5 . C6 . Db6 . C6*4 | D6 . Bb5 . F5 . Bb5 . D6 . Eb6 . F6*4 | G6*8 Eb6*8 |
        Ab5 . C6 . Eb6 . C6 . Ab5 . G5 . F5*4 | F5 . Ab5 . C6 . Ab5 . F5 . Eb5 . F5*4 | G5*4 B5*4 D6*4 F6*4 | D6*4 B5*4 G5*8`,
    },
    A2: {
      chords: 'Eb | F/Eb | Eb | F/Eb | Cm | Ab | Bb | Bb', harm: 'arp8', bass: 'soft', beat: GROOVE.light,
      lead: `G5*4 Bb5*4 Eb6*6 D6*2 | C6*8 A5*4 F5*4 | Eb6*4 Bb5*4 G5*6 Ab5*2 | A5*8 C6*8 |
        Eb6*4 D6*4 C6*4 G5*4 | Ab5*4 C6*4 Eb6*8 | D6*4 C6*4 Bb5*4 F5*4 | D5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Other World: King Kai's planet, Snake Way, Hell, Baba's palace, the Kais' sacred world. D dorian; A-B(Hell)-C-A'. */
  otherworld: song({ bpm: 100 }, {
    A: {
      chords: 'Dm7 | G | Dm7 | G | Bb | C | Dm | Dm', harm: 'arp8', bass: 'walk', beat: GROOVE.rock2,
      lead: `A5*2 . A5 C6*2 D6*2 A5*4 F5*4 | B5*2 . B5 D6*2 G6*2 F6*4 D6*4 | C6*2 . C6 A5*2 F5*2 D5*4 F5*4 | B4*4 D5*4 G5*8 |
        F5*6 G5*2 Bb5*4 D6*4 | E6*6 D6*2 C6*4 G5*4 | A5*6 G5*2 F5*4 E5*4 | D5*12 . . . .`,
    },
    B: {
      chords: 'Gm | A7 | Dm | Bb | Gm | A7 | Dm | A', harm: 'pulse', bass: 'drive', beat: GROOVE.heavy, fill: FILL.toms,
      lead: `G5*3 Bb5*3 D6*2 Bb5*8 | C#6*3 E6*3 G6*2 E6*8 | F6*3 D6*3 A5*2 F5*8 | D6*8 Bb5*8 |
        Bb5*3 A5*3 G5*2 D5*8 | E5*3 G5*3 A5*2 C#6*8 | D6*4 A5*4 F5*8 | E5*4 C#5*4 A4*8`,
    },
    C: {
      chords: 'F | C | Dm | Am | Bb | F | G | A', harm: 'stab', bass: 'bounce', beat: GROOVE.light, fill: FILL.soft,
      lead: `F5 . A5 . C6 . A5 . F5*2 G5*2 A5*4 | E5 . G5 . C6 . G5 . E5*2 F5*2 G5*4 | D5 . F5 . A5 . F5 . D5*2 E5*2 F5*4 | C5 . E5 . A5 . E5 . C6*8 |
        D6 . Bb5 . F5 . Bb5 . D6*2 C6*2 Bb5*4 | A5 . F5 . C5 . F5 . A5*2 G5*2 F5*4 | G5*4 B5*4 D6*4 G6*4 | E6*4 C#6*4 A5*8`,
    },
    A2: {
      chords: 'Dm7 | G | Dm7 | G | Bb | C | Dm | Dm', harm: 'arp', bass: 'walk', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `D6*2 . D6 C6*2 A5*2 F5*4 A5*4 | G5*2 . G5 B5*2 D6*2 B5*4 G5*4 | F5*2 . F5 A5*2 C6*2 F6*4 E6*4 | D6*8 B5*8 |
        D6*6 C6*2 Bb5*4 F5*4 | G5*6 A5*2 C6*4 E6*4 | F6*6 E6*2 D6*4 A5*4 | D6*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Future Earth's ruins: the cities Black burned. E minor, desolate but driving; A-B-C(rubble)-A'. */
  future: song({ bpm: 100 }, {
    A: {
      chords: 'Em | C | D | Bm | Em | C | Am | B', harm: 'arp8', bass: 'soft', beat: GROOVE.half,
      lead: `B4*4 E5*4 G5*6 F#5*2 | E5*8 G5*4 E5*4 | F#5*4 A5*4 D6*6 C6*2 | B5*12 A5*2 F#5*2 |
        G5*4 B5*4 E6*8 | C6*4 B5*4 G5*4 E5*4 | C6*4 A5*4 E5*4 A5*4 | B5*8 D#6*4 F#6*4`,
    },
    B: {
      chords: 'C | D | Em | Em | C | D | B | B', harm: 'pad2', bass: 'pump', beat: GROOVE.rock, fill: FILL.snare,
      lead: `G5*6 A5*2 G5*4 E5*4 | F#5*6 G5*2 A5*8 | B5*6 A5*2 G5*4 F#5*4 | E5*12 . . . . |
        E6*6 D6*2 C6*4 G5*4 | F#6*6 E6*2 D6*4 A5*4 | B5*8 A5*4 F#5*4 | D#6*8 B5*8`,
    },
    C: {
      chords: 'Am | Em | Am | Em | F | C | D | B', harm: 'arpDown', bass: 'drive', beat: GROOVE.march, fill: FILL.toms,
      lead: `A4*2 C5*2 E5*2 A5*2 . . E5*2 C5*4 | B4*2 E5*2 G5*2 B5*2 . . G5*2 E5*4 | C5*2 E5*2 A5*2 C6*2 . . A5*2 E5*4 | G5*8 B5*8 |
        A5*4 C6*4 F6*8 | E6*4 C6*4 G5*8 | F#5*4 A5*4 D6*8 | D#6*4 F#6*4 B5*8`,
    },
    A2: {
      chords: 'Em | C | D | Bm | Em | C | Am | B', harm: 'arp8', bass: 'soft', beat: GROOVE.half,
      lead: `B4*4 E5*4 G5*6 F#5*2 | E5*4 G5*4 C6*8 | D6*4 A5*4 F#5*6 E5*2 | D5*12 . . . . |
        E5*4 G5*4 B5*6 A5*2 | G5*4 E5*4 C5*8 | E5*4 A5*4 C6*4 E6*4 | D#6*4 B5*4 F#5*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  // ---- Story moods ----

  /** Suspense and danger: hostile zones under threat, cutscenes before a storm. D minor; A-B(ticking)-C. */
  tense: song({ bpm: 90, leadDuty: 0.125, volume: 0.9 }, {
    A: {
      chords: 'Dm | Dm | Bb | A | Dm | Dm | Eb | A', harm: 'pad', bass: 'heart', beat: GROOVE.sparse,
      lead: `D5*8 . . . . Eb5*4 | D5*12 . . . . | F5*8 E5*4 Eb5*4 | D5*4 C#5*12 |
        A5*8 . . . . Bb5*4 | A5*6 G5*2 F5*8 | G5*8 F5*4 Eb5*4 | E5*12 . . . .`,
    },
    B: {
      chords: 'Gm | Gm | Dm | Dm | Bb | C | A | A', harm: 'pulse', bass: 'heart', beat: GROOVE.tick,
      lead: `G4*2 . . Bb4*2 . . D5*2 . . Bb4*2 . . | G4*2 . . Bb4*2 . . Eb5*2 . . D5*2 . . | F4*2 . . A4*2 . . D5*2 . . A4*2 . . | F4*2 . . A4*2 . . E5*2 . . F5*2 . . |
        F5*8 D5*8 | E5*8 G5*8 | A5*8 G5*4 F5*4 | E5*4 C#5*4 A4*8`,
    },
    C: {
      chords: 'Dm | Bbmaj7 | Gm | A7 | Dm | Bb | Gm | A', harm: 'tremolo', bass: 'soft', beat: GROOVE.march, fill: FILL.roll,
      lead: `D6*4 . . D6*2 C6*4 A5*4 | A5*8 F5*8 | G5*4 . . G5*2 Bb5*4 D6*4 | C#6*8 E6*4 G6*4 |
        F6*8 E6*4 D6*4 | D6*8 Bb5*8 | Bb5*8 A5*4 G5*4 | A5*12 . . . .`,
    },
  }, ['A', 'B', 'C']),

  /** Loss and grief. A minor; A-B(hope)-A'. */
  sad: song({ bpm: 72, leadDuty: 0.5, volume: 0.8 }, {
    A: {
      chords: 'Am | F | C | G | Am | F | E | E', harm: 'pad', bass: 'soft',
      lead: `E5*8 C5*4 A4*4 | F5*8 E5*4 D5*4 | C5*8 E5*4 G5*4 | B4*12 . . . . |
        A5*8 G5*4 E5*4 | F5*8 A5*4 F5*4 | E5*4 D5*4 C5*4 B4*4 | G#4*12 . . . .`,
    },
    B: {
      chords: 'F | G | Em | Am | Dm | Em | F | G', harm: 'arp8', bass: 'soft', beat: GROOVE.sparse,
      lead: `C5*6 D5*2 C5*4 A4*4 | B4*6 C5*2 D5*8 | E5*6 D5*2 G5*4 B4*4 | C5*12 B4*2 A4*2 |
        A5*6 G5*2 F5*4 D5*4 | G5*6 F5*2 E5*4 B4*4 | A5*8 C6*8 | B5*8 D6*4 B5*4`,
    },
    A2: {
      chords: 'Am | F | C | G | F | E | Am | Am', harm: 'pad2', bass: 'hold',
      lead: `E6*8 C6*4 A5*4 | F6*8 E6*4 C6*4 | G5*8 E5*4 C5*4 | D5*8 B4*4 G4*4 |
        A4*6 C5*2 F5*8 | E5*6 D5*2 B4*8 | C5*8 B4*4 A4*4 | A4*12 . . . .`,
    },
  }, ['A', 'B', 'A2']),

  /** The gods: Beerus and Whis arriving, Zeno's palace, the divine realms. D phrygian; A-B(radiant)-A'. */
  godly: song({ bpm: 84, leadDuty: 0.125 }, {
    A: {
      chords: 'Dm | Eb | Dm | Eb | Dm | C | Bb | A', harm: 'tremolo', bass: 'soft', beat: 'k . . h . . x . k . h . x . . .',
      lead: `D5*4 Eb5*4 F5*4 A5*4 | G5*8 F5*4 Eb5*4 | D5*4 F5*4 A5*4 C6*4 | Bb5*8 G5*8 |
        A5*6 G5*2 F5*4 D5*4 | E5*6 F5*2 G5*8 | F5*6 D5*2 Bb4*8 | C#5*8 E5*4 A5*4`,
    },
    B: {
      chords: 'F | C | Bb | F | Gm | Dm | Eb | A', harm: 'arp8', bass: 'soft', beat: GROOVE.soft,
      lead: `C6*8 A5*4 F5*4 | G5*8 E5*4 C5*4 | D5*4 F5*4 Bb5*8 | A5*12 . . . . |
        Bb5*6 A5*2 G5*4 D5*4 | F5*6 E5*2 D5*4 A4*4 | G5*6 Bb5*2 Eb6*8 | C#6*8 . . . . E5*4`,
    },
    A2: {
      chords: 'Dm | Eb | Dm | Eb | Dm | C | Bb | A', harm: 'tremolo', bass: 'hold', beat: 'k . . h . . x . k . h . x . . .',
      lead: `A5*4 Bb5*4 A5*4 F5*4 | G5*8 Bb5*8 | A5*4 D6*4 F6*4 D6*4 | Eb6*8 Bb5*8 |
        D6*6 C6*2 A5*4 F5*4 | G5*6 A5*2 G5*4 E5*4 | F5*4 D5*4 Bb4*4 D5*4 | E5*12 . . . .`,
    },
  }, ['A', 'B', 'A2']),

  /** Frieza and his army (and Universe 6's Frost). C minor march, cold and chromatic; A-B(march)-C-A'. */
  frieza: song({ bpm: 112 }, {
    A: {
      chords: 'Cm | Ab | Fm | G | Cm | Ab | Db | G', harm: 'pad2', bass: 'drive', beat: GROOVE.march,
      lead: `C5*4 Eb5*4 G5*4 Ab5*4 | G5*8 Eb5*4 C5*4 | F5*4 Ab5*4 C6*4 Bb5*4 | G5*12 F5*2 Eb5*2 |
        C5*4 Eb5*4 G5*4 C6*4 | Eb6*8 C6*4 Ab5*4 | F5*4 Ab5*4 Db6*4 C6*4 | B5*8 D6*4 G5*4`,
    },
    B: {
      chords: 'Cm | Cm | Bbm | Bbm | Ab | Ab | G | G', harm: 'pulse', bass: 'rock', beat: GROOVE.march, fill: FILL.snare,
      lead: `G5*3 G5 G5*4 Ab5*2 G5*2 F5*2 Eb5*2 | Eb5*4 D5*4 C5*8 | F5*3 F5 F5*4 Gb5*2 F5*2 Eb5*2 Db5*2 | Db5*4 C5*4 Bb4*8 |
        Eb5*3 Eb5 Eb5*4 F5*2 Eb5*2 C5*2 Ab4*2 | C5*4 Eb5*4 Ab5*8 | B4*4 D5*4 F5*4 Ab5*4 | G5*4 F5*4 D5*4 B4*4`,
    },
    C: {
      chords: 'Fm | Cm | Fm | Cm | Db | Ab | Fm | G', harm: 'alberti', bass: 'soft', beat: GROOVE.half,
      lead: `Ab5*6 G5*2 F5*8 | G5*6 F5*2 Eb5*8 | C6*6 Bb5*2 Ab5*8 | G5*12 . . . . |
        Ab5*4 F5*4 Db5*4 F5*4 | Eb5*4 C5*4 Ab4*4 C5*4 | F5*4 Ab5*4 C6*4 F6*4 | D6*4 B5*4 G5*4 B5*4`,
    },
    A2: {
      chords: 'Cm | Ab | Fm | G | Cm | Ab | Db | G', harm: 'arp', bass: 'drive', beat: GROOVE.march, first: crash(GROOVE.march), fill: FILL.roll,
      lead: `C6*4 Bb5*4 G5*4 Eb5*4 | C5*8 Eb5*4 G5*4 | Ab5*4 F5*4 C5*4 F5*4 | D5*12 B4*2 D5*2 |
        Eb5*4 G5*4 C6*4 Eb6*4 | Eb6*8 C6*4 Ab5*4 | Db6*4 C6*4 Ab5*4 F5*4 | G5*4 B5*4 D6*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Goku Black's leitmotif: elegant and cruel. E harmonic minor; A-B(Rose)-C(whisper)-A'. */
  black: song({ bpm: 96, leadDuty: 0.125 }, {
    A: {
      chords: 'Em | B/D# | Em | Am | Em | C | Am | B', harm: 'arp8', bass: 'soft', beat: 'k . . . x . . h k . . . x . h h',
      lead: `B4*6 C5*2 B4*8 | F#5*6 G5*2 F#5*8 | E5*4 F#5*4 G5*4 B5*4 | C6*8 B5*4 A5*4 |
        B4*6 C5*2 B4*4 E5*4 | G5*6 F#5*2 E5*4 C5*4 | A4*4 C5*4 E5*4 A5*4 | D#5*8 F#5*4 B5*4`,
    },
    B: {
      chords: 'C | D | Bm | Em | Am | C | Am | B7', harm: 'pad2', bass: 'pump', beat: GROOVE.march, fill: FILL.snare,
      lead: `E6*6 D6*2 C6*4 G5*4 | F#6*6 E6*2 D6*4 A5*4 | B5*8 D6*4 F#6*4 | G6*8 E6*8 |
        E6*6 C6*2 A5*4 E5*4 | G5*6 E5*2 C5*4 G5*4 | A5*4 C6*4 B5*4 A5*4 | D#6*8 A5*4 F#5*4`,
    },
    C: {
      chords: 'Em | Em | Cm | Cm | Am | Am | B | B', harm: 'tremolo', bass: 'hold', beat: GROOVE.sparse,
      lead: `E4*4 G4*4 B4*8 | C5*4 B4*4 G4*8 | Eb4*4 G4*4 C5*8 | D5*4 C5*4 G4*8 |
        A4*4 C5*4 E5*8 | F5*4 E5*4 C5*8 | D#5*4 F#5*4 B5*8 | A5*4 F#5*4 D#5*8`,
    },
    A2: {
      chords: 'Em | B/D# | Em | Am | Em | C | Am | B', harm: 'arp', bass: 'soft', beat: 'k . . . x . . h k . . . x . h h', fill: FILL.roll,
      lead: `B5*6 C6*2 B5*8 | F#5*6 G5*2 F#5*4 D#5*4 | E5*4 G5*4 B5*4 E6*4 | E6*8 C6*4 A5*4 |
        G5*6 A5*2 B5*4 G5*4 | E5*6 F#5*2 G5*4 E5*4 | C5*4 E5*4 A5*4 C6*4 | B5*8 D#6*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Jiren of the Pride Troopers: stoic, immovable power; also his fights. C minor / phrygian; A-B-C-A'. */
  jiren: song({ bpm: 104, leadDuty: 0.5 }, {
    A: {
      chords: 'Cm | Db | Cm | Db | Ab | Bb | Cm | G', harm: 'pad', bass: 'drive', beat: GROOVE.heavy,
      lead: `C5*12 Db5*4 | C5*8 Ab4*4 F4*4 | Eb5*12 D5*4 | Db5*16 |
        C5*6 Eb5*2 Ab5*8 | F5*6 D5*2 Bb4*8 | G4*4 C5*4 Eb5*4 G5*4 | B4*8 D5*4 G5*4`,
    },
    B: {
      chords: 'Fm | Cm | Fm | Cm | Db | Eb | F | G', harm: 'pulse', bass: 'octave', beat: 'k . . k X . . . k . k . X . . h', fill: FILL.toms,
      lead: `F5*2 . F5 F5*2 Ab5*2 C6*8 | Eb5*2 . Eb5 Eb5*2 G5*2 C6*8 | F5*2 . F5 Ab5*2 C6*2 F6*4 Eb6*4 | G5*16 |
        Ab5*4 F5*4 Db5*4 F5*4 | G5*4 Bb5*4 Eb6*8 | A5*4 C6*4 F6*8 | G5*4 B5*4 D6*4 F6*4`,
    },
    C: {
      chords: 'Cm | Cm | Ab | Ab | Fm | Fm | G | G', harm: 'pad2', bass: 'gallop', beat: 'k k . . X . . . k k . . X . x x',
      lead: `C4*4 . . C4*2 G4*4 C5*4 | Eb5*4 . . D5*2 C5*8 | Ab4*4 . . Ab4*2 Eb5*4 Ab5*4 | G5*4 . . F5*2 Eb5*8 |
        F4*4 . . F4*2 C5*4 F5*4 | Ab5*4 . . G5*2 F5*8 | G5*4 . . G5*2 B5*4 D6*4 | D6*4 B5*4 G5*4 D5*4`,
    },
    A2: {
      chords: 'Cm | Db | Cm | Db | Ab | Bb | Cm | G', harm: 'pad', bass: 'drive', beat: GROOVE.heavy, first: crash(GROOVE.heavy), fill: FILL.break,
      lead: `G5*12 Ab5*4 | F5*8 Db5*4 Ab4*4 | G5*4 Eb5*4 C5*4 Eb5*4 | F5*12 . . . . |
        Eb6*6 C6*2 Ab5*8 | D6*6 Bb5*2 F5*8 | Eb5*4 G5*4 C6*4 Eb6*4 | D6*8 B5*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** The hero rises: power-ups, turning points, last stands. C major, triumphant; A-B-C(bVI-bVII-I)-A'. */
  heroic: song({ bpm: 138 }, {
    A: {
      chords: 'C | Am | F | G | C | Dm | G | G', harm: 'arp', bass: 'pump', beat: GROOVE.fast, first: crash(GROOVE.fast),
      lead: `G4*2 C5*2 E5*2 G5*2 C6*6 B5*2 | A5*4 G5*4 E5*4 C5*4 | F5*2 A5*2 C6*2 F6*2 E6*6 D6*2 | D6*8 B5*4 G5*4 |
        C6*2 E6*2 G6*4 E6*4 C6*4 | D6*2 F6*2 A6*4 F6*4 D6*4 | G6*8 F6*4 E6*4 | D6*8 B5*8`,
    },
    B: {
      chords: 'Am | Em | F | C | Dm | Am | Bb | G', harm: 'pulse', bass: 'drive', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `E5*3 E5*3 E5*2 A5*4 C6*4 | B5*3 B5*3 B5*2 G5*4 E5*4 | F5*3 F5*3 F5*2 A5*4 C6*4 | E6*8 C6*4 G5*4 |
        F5*3 F5*3 F5*2 A5*4 D6*4 | E6*8 C6*4 A5*4 | D6*4 F6*4 Bb5*8 | B5*4 D6*4 G6*8`,
    },
    C: {
      chords: 'Ab | Bb | C | C | Ab | Bb | C | G', harm: 'pad2', bass: 'rock', beat: GROOVE.march, first: crash(GROOVE.march), fill: FILL.toms,
      lead: `Eb5*6 Ab5*2 C6*8 | D6*6 F6*2 Bb5*8 | C6*4 E6*4 G6*8 | E6*8 C6*4 G5*4 |
        Ab5*4 C6*4 Eb6*4 C6*4 | Bb5*4 D6*4 F6*4 D6*4 | E6*4 G6*4 C6*8 | B5*4 G5*4 D6*4 B5*4`,
    },
    A2: {
      chords: 'C | Am | F | G | C | Dm | G | C', harm: 'arp', bass: 'pump', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `G5*2 C6*2 E6*2 G6*2 E6*6 D6*2 | C6*4 A5*4 E5*4 A5*4 | F5*2 A5*2 C6*2 A5*2 F6*6 E6*2 | D6*4 G5*4 B5*4 D6*4 |
        E6*6 D6*2 C6*4 G5*4 | F5*6 E5*2 D5*4 A5*4 | G5*4 B5*4 D6*4 F6*4 | E6*8 C6*8`,
    },
  }, ['A', 'B', 'C', 'A2']),

  /** Credits and the epilogue: warm and nostalgic. C major; a two-bar intro, then A-B-C(bridge)-A'. */
  ending: song({ bpm: 96, leadDuty: 0.5, volume: 0.9 }, {
    I: {
      chords: 'F | G', harm: 'arp8', bass: 'soft', beat: GROOVE.soft, fill: FILL.soft,
      lead: 'A4*4 C5*4 F5*8 | G5*8 D5*4 B4*4',
    },
    A: {
      chords: 'C | Em | F | G | Am | Em | F | G', harm: 'arp8', bass: 'soft', beat: GROOVE.light,
      lead: `E5*4 G5*4 C6*8 | B5*4 A5*4 G5*8 | F5*4 A5*4 C6*8 | B5*8 D6*4 B5*4 |
        C6*6 B5*2 A5*4 E5*4 | G5*6 A5*2 G5*4 E5*4 | A5*6 G5*2 F5*4 A5*4 | G5*12 . . . .`,
    },
    B: {
      chords: 'F | G | Em | Am | Dm | G | C | C7', harm: 'pad2', bass: 'pump', beat: GROOVE.rock, fill: FILL.snare,
      lead: `A5*4 C6*4 F6*6 E6*2 | D6*8 B5*4 G5*4 | E6*6 D6*2 B5*4 G5*4 | C6*8 E6*8 |
        F6*6 E6*2 D6*4 A5*4 | B5*6 C6*2 D6*8 | E6*4 D6*4 C6*4 G5*4 | Bb5*8 G5*4 E5*4`,
    },
    C: {
      chords: 'F | Fm | C | A7 | Dm | G | Em A7 | Dm G', harm: 'alberti', bass: 'walk', beat: GROOVE.soft,
      lead: `A5*8 G5*4 F5*4 | Ab5*8 G5*4 F5*4 | E5*8 G5*4 C6*4 | C#6*8 A5*4 G5*4 |
        F5*6 A5*2 D6*8 | D6*6 B5*2 G5*8 | G5*4 E5*4 C#5*4 E5*4 | F5*4 A5*4 B5*4 D6*4`,
    },
    A2: {
      chords: 'C | Em | F | G | Am | Em | F G | C', bass: 'soft', beat: GROOVE.rock, first: crash(GROOVE.rock), fill: FILL.soft,
      lead: `E5*4 G5*4 C6*6 D6*2 | E6*4 D6*4 B5*8 | C6*4 A5*4 F5*6 G5*2 | A5*4 B5*4 D6*8 |
        E6*6 D6*2 C6*4 A5*4 | B5*6 A5*2 G5*4 E5*4 | F5*4 A5*4 B5*4 D6*4 | C6*12 . . . .`,
      counter: `C5*8 E5*8 | B4*8 G4*8 | A4*8 C5*8 | B4*8 D5*8 |
        C5*8 E5*8 | B4*8 E5*8 | C5*8 B4*8 | G4*4 E4*4 C4*8`,
    },
  }, ['A', 'B', 'C', 'A2'], ['I']),

  // ---- Tournaments ----

  /** Champa's tournament on the Nameless Planet and Zeno's exhibition. E major, festive; A-B-C(chant)-D-A'. */
  tournament: song({ bpm: 144 }, {
    A: {
      chords: 'E | C#m | A | B | E | C#m | A B | E', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast),
      lead: `E5*2 E5*2 G#5*2 B5*2 E6*4 D#6*2 B5*2 | C#6*4 B5*2 G#5*2 E5*4 C#5*4 | A5*2 . A5 C#6*2 E6*2 A5*4 C#6*4 | B5*8 F#5*4 D#5*4 |
        E5*2 E5*2 G#5*2 B5*2 E6*4 F#6*2 G#6*2 | E6*4 C#6*4 G#5*4 E5*4 | A5*4 C#6*4 B5*4 D#6*4 | E6*12 . . . .`,
    },
    B: {
      chords: 'D | A | D | E | D | A | F#m | B', harm: 'stab', bass: 'sync', beat: GROOVE.march, fill: FILL.snare,
      lead: `F#5*3 F#5*3 F#5*2 A5*4 D6*4 | E6*3 C#6*3 A5*2 E5*8 | F#5*3 A5*3 D6*2 F#6*4 E6*2 D6*2 | E6*8 B5*4 G#5*4 |
        A5*2 F#5*2 D5*2 F#5*2 A5*4 D6*4 | C#6*2 A5*2 E5*2 A5*2 C#6*4 E6*4 | F#6*4 E6*4 C#6*4 A5*4 | B5*4 D#6*4 F#6*8`,
    },
    C: {
      chords: 'C#m | A | E | B | C#m | A | F#m | B', harm: 'pulse', bass: 'drive', beat: GROOVE.chant, fill: FILL.run,
      lead: `C#5*2 . C#5 E5*2 . . G#5*8 | .*4 A5*2 G#5*2 E5*4 C#5*4 | B4*2 . B4 E5*2 . . G#5*8 | .*4 B5*2 A5*2 F#5*4 D#5*4 |
        E5*2 . E5 G#5*2 . . C#6*8 | .*4 E6*2 C#6*2 A5*4 E5*4 | F#5*4 A5*4 C#6*4 E6*4 | D#6*8 F#6*4 B5*4`,
    },
    D: {
      chords: 'G | D | C | D | G | D | C | B', harm: 'pad2', bass: 'walk', beat: GROOVE.rock,
      lead: `D6*4 B5*4 G5*4 B5*4 | A5*4 F#5*4 D5*4 F#5*4 | G5*4 E5*4 C5*4 E5*4 | F#5*8 A5*8 |
        B5*2 D6*2 G6*4 F#6*4 D6*4 | A5*2 D6*2 F#6*4 E6*4 D6*4 | E6*4 C6*4 G5*4 E5*4 | D#5*4 F#5*4 B5*4 D#6*4`,
    },
    A2: {
      chords: 'E | C#m | A | B | E | C#m | A B | E', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.toms,
      lead: `E5*2 E5*2 G#5*2 B5*2 E6*4 D#6*2 B5*2 | C#6*4 E6*2 G#6*2 E6*4 C#6*4 | A5*2 . A5 C#6*2 E6*2 A6*4 E6*4 | F#6*8 D#6*4 B5*4 |
        G#5*4 B5*4 E6*4 G#5*4 | G#5*4 E5*4 C#5*4 E5*4 | C#5*4 E5*4 D#5*4 F#5*4 | E5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  /** The Tournament of Power: eight universes on the line. B minor, epic and driving; A-B-C(void)-D(rally)-A'. */
  topArena: song({ bpm: 148 }, {
    A: {
      chords: 'Bm | G | D | A | Bm | G | Em | F#', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast),
      lead: `B4*2 . B4 D5*2 F#5*2 B5*4 A5*2 F#5*2 | G5*4 F#5*2 E5*2 D5*4 B4*4 | D5*2 . D5 F#5*2 A5*2 D6*4 C#6*2 A5*2 | C#6*8 E6*4 A5*4 |
        B5*2 . B5 D6*2 F#6*2 B5*4 C#6*2 D6*2 | E6*4 D6*2 B5*2 G5*4 B5*4 | G5*4 B5*4 E6*4 G6*4 | F#6*8 E6*4 C#6*4`,
    },
    B: {
      chords: 'G | A | F#m | Bm | G | A | F# | F#', harm: 'pulse', bass: 'drive', beat: GROOVE.boss, fill: FILL.snare,
      lead: `D6*3 D6*3 D6*2 B5*4 G5*4 | E6*3 E6*3 E6*2 C#6*4 A5*4 | F#6*3 E6*3 C#6*2 A5*8 | B5*12 . . . . |
        G5*3 A5*3 B5*2 D6*8 | A5*3 B5*3 C#6*2 E6*8 | F#6*4 C#6*4 A#5*4 C#6*4 | F#5*4 A#5*4 C#6*4 E6*4`,
    },
    C: {
      chords: 'Bm | Bm | C | C | Bm | Bm | G | F#', harm: 'tremolo', bass: 'hold', beat: GROOVE.half, fill: FILL.roll,
      lead: `F#5*8 D5*8 | E5*8 C#5*8 | E5*8 G5*8 | C6*8 B5*8 |
        D6*8 F#6*8 | E6*8 C#6*8 | B5*8 D6*8 | C#6*8 A#5*8`,
    },
    D: {
      chords: 'D | A | Bm | F#m | G | D | Em | F#', harm: 'arp', bass: 'pump', beat: GROOVE.rock, first: crash(GROOVE.rock), fill: FILL.toms,
      lead: `A5*2 D6*2 F#6*4 E6*2 D6*2 A5*4 | C#6*2 E6*2 A5*4 B5*2 C#6*2 E6*4 | D6*4 F#6*4 B5*8 | C#6*8 A5*4 F#5*4 |
        B5*2 D6*2 G6*4 F#6*2 E6*2 D6*4 | A5*2 D6*2 F#6*4 E6*2 D6*2 A5*4 | G5*4 B5*4 E6*4 G6*4 | F#6*8 C#6*8`,
    },
    A2: {
      chords: 'Bm | G | D | A | Bm | G | Em | F#', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `F#5*2 . F#5 B5*2 D6*2 F#6*4 E6*2 D6*2 | B5*4 D6*2 B5*2 G5*4 D5*4 | A5*2 . A5 D6*2 F#6*2 A6*4 F#6*4 | E6*8 C#6*4 A5*4 |
        B5*4 F#5*4 D5*4 F#5*4 | G5*4 B5*4 D6*4 G6*4 | F#6*4 E6*4 B5*4 G5*4 | A#5*4 C#6*4 F#6*8`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  // ---- Battles ----

  /** Skirmishes, waves and sparring. D minor, urgent; A-B-D(chase)-C(build)-A'. */
  battle: song({ bpm: 150 }, {
    A: {
      chords: 'Dm | Bb | C | A | Dm | Bb | Gm | A', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast),
      lead: `D5*2 . D5 F5*2 A5*2 D6*4 C6*2 A5*2 | Bb5*4 A5*2 G5*2 F5*4 D5*4 | C5*2 . C5 E5*2 G5*2 C6*4 Bb5*2 G5*2 | A5*8 C#6*4 E6*4 |
        D6*2 . D6 C6*2 A5*2 F5*4 A5*2 D6*2 | F6*4 D6*2 Bb5*2 F5*4 Bb5*4 | G5*2 Bb5*2 D6*2 G6*2 F6*4 D6*4 | E6*4 C#6*4 A5*4 E5*4`,
    },
    B: {
      chords: 'Gm | Dm | Gm | Dm | Bb | C | Dm | A', harm: 'pulse', bass: 'drive', beat: GROOVE.boss, fill: FILL.snare,
      lead: `G5*3 G5*3 Bb5*2 D6*8 | F5*3 F5*3 A5*2 D6*8 | G5*3 G5*3 Bb5*2 D6*4 G6*4 | F6*8 E6*4 D6*4 |
        D6*2 C6*2 Bb5*2 F5*2 D5*4 F5*4 | E5*2 F5*2 G5*2 C6*2 E6*4 G6*4 | F6*4 E6*2 D6*2 A5*4 F5*4 | E5*4 A5*4 C#6*4 E6*4`,
    },
    D: {
      chords: 'F | C | Bb | A | F | C | Bb | A', harm: 'arp8', bass: 'rock', beat: GROOVE.rock2, fill: FILL.toms,
      lead: `A5*2 C6*2 F6*2 C6*2 A5*2 F5*2 C5*4 | G5*2 C6*2 E6*2 C6*2 G5*2 E5*2 C5*4 | F5*2 Bb5*2 D6*2 Bb5*2 F5*2 D5*2 Bb4*4 | C#5*4 E5*4 A5*4 G5*4 |
        A5*4 C6*4 F6*6 E6*2 | E6*4 G6*4 E6*4 C6*4 | D6*4 F6*4 Bb5*4 D6*4 | C#6*4 E6*4 A6*8`,
    },
    C: {
      chords: 'Dm | Dm | Eb | Eb | Dm | Dm | Bb | A', harm: 'pad', bass: 'octave', beat: GROOVE.half, fill: FILL.run,
      lead: `D4*4 F4*4 A4*4 D5*4 | C5*4 A4*4 F4*4 A4*4 | Eb4*4 G4*4 Bb4*4 Eb5*4 | D5*4 Bb4*4 G4*4 Bb4*4 |
        A4*2 D5*2 F5*2 A5*2 D6*2 A5*2 F5*2 D5*2 | F5*2 A5*2 D6*2 F6*2 A6*2 F6*2 D6*2 A5*2 | Bb5*2 D6*2 F6*2 Bb6*2 F6*2 D6*2 Bb5*2 F5*2 | A5*2 C#6*2 E6*2 A6*2 E6*8`,
    },
    A2: {
      chords: 'Dm | Bb | C | A | Dm | Bb | Gm | A', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.toms,
      lead: `D6*2 . D6 F6*2 A6*2 D6*4 C6*2 A5*2 | Bb5*4 D6*2 F6*2 D6*4 Bb5*4 | C6*2 . C6 E6*2 G6*2 E6*4 C6*4 | C#6*8 A5*4 E5*4 |
        F5*2 A5*2 D6*2 F6*2 E6*4 D6*4 | D6*4 Bb5*4 F5*4 D5*4 | G5*4 Bb5*4 D6*4 G6*4 | A5*12 E5*2 C#5*2`,
    },
  }, ['A', 'B', 'D', 'C', 'A2']),

  /** Bosses without a theme of their own. A minor; A-B-C(menace)-D(rush)-A'. */
  boss: song({ bpm: 146 }, {
    A: {
      chords: 'Am | F | Dm | E | Am | F | Dm E | Am', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss),
      lead: `A5*2 . A5 E5*2 A5*2 C6*4 B5*2 A5*2 | C6*4 A5*2 F5*2 C5*4 F5*4 | D5*2 . D5 F5*2 A5*2 D6*4 C6*2 A5*2 | G#5*8 B5*4 E6*4 |
        A5*2 . A5 C6*2 E6*2 G6*4 F6*2 E6*2 | F6*4 E6*2 C6*2 A5*4 C6*4 | D6*4 F6*4 E6*4 G#6*4 | A6*4 E6*4 C6*4 A5*4`,
    },
    B: {
      chords: 'Dm | Am | Bb | E | Dm | Am | F | E', harm: 'pulse', bass: 'pump', beat: GROOVE.fast, fill: FILL.snare,
      lead: `F5*3 F5*3 F5*2 A5*4 D6*4 | E6*3 E6*3 E6*2 C6*4 A5*4 | D6*3 D6*3 D6*2 F6*4 Bb5*4 | B5*8 G#5*8 |
        A5*3 A5*3 A5*2 D6*4 F6*4 | E6*8 C6*8 | C6*4 A5*4 F5*4 A5*4 | G#5*4 B5*4 E6*8`,
    },
    C: {
      chords: 'Am | Am | F | Bb F | Dm | Dm | E | E', harm: 'pad', bass: 'heart', beat: GROOVE.heavy, fill: FILL.roll,
      lead: `A4*4 . . A4*2 E5*8 | D5*4 C5*4 B4*4 A4*4 | F4*4 . . F4*2 C5*8 | Bb4*4 A4*4 G4*4 F4*4 |
        D5*4 . . D5*2 A5*8 | G5*4 F5*4 E5*4 D5*4 | E5*4 . . E5*2 B5*8 | G#5*4 B5*4 D6*4 E6*4`,
    },
    D: {
      chords: 'F | G | Am | Am | F | G | E | E', harm: 'arp', bass: 'octave', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `A5*2 C6*2 F6*2 C6*2 A5*2 C6*2 F6*4 | B5*2 D6*2 G6*2 D6*2 B5*2 D6*2 G6*4 | C6*2 E6*2 A6*2 E6*2 C6*8 | B5*2 C6*2 B5*2 A5*2 E5*8 |
        F5*4 A5*4 C6*4 F6*4 | G6*4 D6*4 B5*4 G5*4 | G#5*2 B5*2 E6*2 G#6*2 E6*8 | D6*4 B5*4 G#5*4 E5*4`,
    },
    A2: {
      chords: 'Am | F | Dm | E | Am | F | Dm E | Am', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss), fill: FILL.toms,
      lead: `E6*2 . E6 C6*2 A5*2 E5*4 A5*4 | C6*4 F6*2 C6*2 A5*4 F5*4 | F5*2 . F5 A5*2 D6*2 F6*4 E6*2 D6*2 | E6*8 G#5*8 |
        C6*4 B5*2 A5*2 E5*4 C5*4 | A4*4 C5*2 F5*2 A5*4 C6*4 | D6*4 A5*4 B5*4 G#5*4 | A5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  /** Beerus, God of Destruction. C phrygian dominant, regal and brutal; A-B-C(Hakai)-D(assault)-A'. */
  beerus: song({ bpm: 140 }, {
    A: {
      chords: 'Cm | Db | Cm | Db | Ab | Bb | Db | C', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss),
      lead: `C5*2 . C5 Db5*2 C5*2 G5*4 F5*2 Eb5*2 | F5*4 Eb5*2 Db5*2 Ab5*8 | G5*2 . G5 Ab5*2 G5*2 C6*4 Bb5*2 G5*2 | Ab5*8 F5*4 Db5*4 |
        Eb6*4 C6*2 Ab5*2 Eb5*4 Ab5*4 | F6*4 D6*2 Bb5*2 F5*4 Bb5*4 | Ab5*4 F5*4 Db6*4 C6*4 | E5*4 G5*4 C6*8`,
    },
    B: {
      chords: 'Fm | C | Fm | C | Db | Bbm | C | C', harm: 'pulse', bass: 'pump', beat: GROOVE.fast, fill: FILL.snare,
      lead: `F5*3 Ab5*3 C6*2 Db6*4 C6*4 | E6*3 Db6*3 C6*2 G5*8 | Ab5*3 C6*3 F6*2 Eb6*4 Db6*4 | C6*8 E6*8 |
        F6*4 Db6*4 Ab5*4 F5*4 | Db6*4 Bb5*4 F5*4 Db5*4 | E5*4 G5*4 Bb5*4 Db6*4 | C6*12 . . . .`,
    },
    C: {
      chords: 'Cm | Cm | Ab | Ab | Fm | Fm | G | G', harm: 'tremolo', bass: 'hold', beat: GROOVE.heavy, fill: FILL.roll,
      lead: `C6*12 . . . . | Bb5*4 G5*4 Eb5*8 | Ab5*12 . . . . | G5*4 Eb5*4 C5*8 |
        F5*12 . . . . | Ab5*4 C6*4 F6*8 | G5*4 B5*4 D6*4 F6*4 | Ab6*4 G6*4 F6*4 D6*4`,
    },
    D: {
      chords: 'Cm | Bb | Ab | G | Cm | Bb | Ab | G', harm: 'arp', bass: 'octave', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `C6*2 G5*2 Eb5*2 G5*2 C6*2 D6*2 Eb6*4 | D6*2 Bb5*2 F5*2 Bb5*2 D6*2 Eb6*2 F6*4 | Eb6*2 C6*2 Ab5*2 C6*2 Eb6*2 F6*2 G6*4 | F6*2 D6*2 B5*2 D6*2 G6*8 |
        G6*2 Eb6*2 C6*2 G5*2 Eb5*2 G5*2 C6*4 | F6*2 D6*2 Bb5*2 F5*2 D5*2 F5*2 Bb5*4 | Ab5*4 C6*4 Eb6*4 Ab6*4 | G6*4 D6*4 B5*4 G5*4`,
    },
    A2: {
      chords: 'Cm | Db | Cm | Db | Ab | Bb | Db | C', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss), fill: FILL.toms,
      lead: `G5*2 . G5 Ab5*2 G5*2 Eb6*4 D6*2 C6*2 | Db6*4 C6*2 Ab5*2 F5*8 | Eb5*2 . Eb5 F5*2 G5*2 C6*4 Eb6*2 G6*2 | F6*8 Db6*4 Ab5*4 |
        C6*4 Ab5*2 Eb5*2 C5*4 Eb5*4 | D5*4 F5*2 Bb5*2 D6*4 F6*4 | F6*4 Db6*4 Ab5*4 F5*4 | E5*4 G5*4 C6*4 E6*4`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  /** Golden Frieza: flashy, arrogant, harmonic minor. G minor; A-B(golden)-C(mockery)-D-A'. */
  goldenFrieza: song({ bpm: 152 }, {
    A: {
      chords: 'Gm | Eb | Cm | D | Gm | Eb | Cm D | Gm', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast),
      lead: `G5*2 D6*2 Bb5*2 G5*2 D5*2 G5*2 Bb5*2 D6*2 | Eb6*4 D6*2 C6*2 Bb5*4 G5*4 | C6*2 G5*2 Eb5*2 C5*2 Eb5*2 G5*2 C6*2 Eb6*2 | D6*4 C6*2 A5*2 F#5*4 D5*4 |
        G5*2 Bb5*2 D6*2 G6*2 F#6*2 G6*2 D6*4 | Eb6*2 G6*2 Bb5*2 Eb6*2 D6*4 Bb5*4 | C6*4 Eb6*4 D6*4 F#6*4 | G6*8 D6*4 Bb5*4`,
    },
    B: {
      chords: 'Bb | F | Gm | D | Eb | Bb | Cm | D', harm: 'pad2', bass: 'pump', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `D6*6 C6*2 Bb5*4 F5*4 | A5*6 Bb5*2 C6*8 | Bb5*6 A5*2 G5*4 D5*4 | F#5*12 . . . . |
        G5*6 Bb5*2 Eb6*8 | F6*6 Eb6*2 D6*4 Bb5*4 | Eb6*4 D6*2 C6*2 G5*4 C6*4 | D6*4 A5*4 F#5*4 A5*4`,
    },
    C: {
      chords: 'Gm | Gm | Ab | Ab | Gm | Gm | D | D', harm: 'pulse', bass: 'rock', beat: GROOVE.march, fill: FILL.toms,
      lead: `D6 . C#6 . D6 . . . G5*2 Bb5*2 D6*4 | D6 . C#6 . D6 . . . Bb5*2 G5*2 D5*4 | Eb6 . D6 . Eb6 . . . Ab5*2 C6*2 Eb6*4 | Eb6 . D6 . Eb6 . . . C6*2 Ab5*2 Eb5*4 |
        G5*2 A5*2 Bb5*2 C6*2 D6*2 Eb6*2 F#6*2 G6*2 | G6*8 D6*8 | F#6*4 D6*4 A5*4 F#5*4 | D5*2 F#5*2 A5*2 C6*2 D6*8`,
    },
    D: {
      chords: 'Eb | F | D | Gm | Eb | F | D | D', harm: 'arp', bass: 'octave', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `Bb5*2 Eb6*2 G6*4 F6*2 Eb6*2 Bb5*4 | A5*2 C6*2 F6*4 Eb6*2 C6*2 A5*4 | F#5*2 A5*2 D6*4 C6*2 A5*2 F#5*4 | G5*2 Bb5*2 D6*4 G6*8 |
        G6*4 Eb6*4 Bb5*4 G5*4 | A5*4 C6*4 F6*4 A5*4 | F#6*4 E6*2 D6*2 C6*4 A5*4 | F#5*4 A5*4 D6*8`,
    },
    A2: {
      chords: 'Gm | Eb | Cm | D | Gm | Eb | Cm D | Gm', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss), fill: FILL.toms,
      lead: `D6*2 G6*2 F#6*2 G6*2 D6*2 Bb5*2 G5*4 | G5*2 Bb5*2 Eb6*2 G6*2 F6*4 Eb6*4 | Eb6*2 C6*2 G5*2 Eb5*2 C5*4 Eb5*4 | F#5*4 A5*4 D6*4 C6*4 |
        Bb5*4 D6*4 G6*8 | G6*4 F6*2 Eb6*2 D6*4 Bb5*4 | C6*4 G5*4 A5*4 F#5*4 | G5*12 . . . .`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  /** Hit, the legendary assassin: cool syncopation with "time-skip" silences. F# minor; A-B(jazz)-C(skip)-D-A'. */
  hit: song({ bpm: 136, harmonyDuty: 0.25 }, {
    A: {
      chords: 'F#m | D | Bm | C# | F#m | D | E | C#', harm: 'stab', bass: 'sync', beat: GROOVE.gallop, first: crash(GROOVE.gallop),
      lead: `F#5*3 . A5*3 . C#6*2 B5*2 A5*4 | F#5*3 . A5*3 . D6*4 . . . . | D6*3 . C#6*3 . B5*2 A5*2 F#5*4 | G#5*8 F5*4 C#5*4 |
        C#6*3 . E6*3 . F#6*2 E6*2 C#6*4 | A5*3 . D6*3 . F#6*4 E6*2 D6*2 | E6*3 . B5*3 . G#5*2 B5*2 E6*4 | F6*4 C#6*4 G#5*8`,
    },
    B: {
      chords: 'Bm7 | E7 | Amaj7 | Dmaj7 | Bm7 | C#7 | F#m | F#m', harm: 'pad2', bass: 'walk', beat: GROOVE.shuffle, fill: FILL.snare,
      lead: `D6*2 C#6*2 B5*2 A5*2 F#5*4 D5*4 | D6*4 B5*2 G#5*2 E5*8 | C#6*2 B5*2 A5*2 G#5*2 E5*4 C#5*4 | F#5*8 C#6*8 |
        B5*2 D6*2 F#6*4 E6*2 D6*2 B5*4 | F6*4 C#6*2 B5*2 G#5*8 | A5*4 C#6*4 F#6*8 | E6*4 C#6*4 A5*4 F#5*4`,
    },
    C: {
      chords: 'F#m | F#m | G | G | F#m | F#m | C# | C#', harm: 'tremolo', bass: 'heart', beat: [GROOVE.sparse, FILL.stop], fill: FILL.roll,
      lead: `.*8 F#6 E6 C#6 A5 F#5*4 | .*8 A5 C#6 E6 F#6 E6*4 | .*8 G6 F#6 D6 B5 G5*4 | .*8 B5 D6 F#6 G6 D6*4 |
        F#5*2 . . F#5*2 . . A5*2 . . C#6*4 | E6*2 . . E6*2 . . C#6*2 . . A5*4 | G#5*4 C#6*4 F6*4 G#6*4 | G#6*8 F6*4 C#6*4`,
    },
    D: {
      chords: 'D | E | F#m | F#m | D | E | C# | C#', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `A5*2 D6*2 F#6*2 D6*2 A5*4 D6*4 | B5*2 E6*2 G#6*2 E6*2 B5*4 E6*4 | C#6*2 F#6*2 A6*2 F#6*2 C#6*8 | A5*4 G#5*4 F#5*8 |
        F#5*4 A5*4 D6*4 F#6*4 | G#6*4 E6*4 B5*4 G#5*4 | F5*4 G#5*4 C#6*4 F6*4 | G#6*8 C#6*8`,
    },
    A2: {
      chords: 'F#m | D | Bm | C# | F#m | D | E | C#', harm: 'stab', bass: 'sync', beat: GROOVE.gallop, first: crash(GROOVE.gallop), fill: FILL.toms,
      lead: `C#6*3 . F#6*3 . E6*2 C#6*2 A5*4 | D6*3 . F#6*3 . A5*4 . . . . | B5*3 . D6*3 . F#6*2 E6*2 D6*4 | F6*8 G#5*8 |
        A5*3 . C#6*3 . F#6*2 E6*2 C#6*4 | D6*3 . A5*3 . F#5*4 A5*4 | G#5*3 . B5*3 . E6*4 D6*4 | C#6*4 G#5*4 F5*4 C#5*4`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  /** Goku Black and Zamasu in battle: divine judgement, harmonic minor. C# minor; A-B(Rose)-C(judgement)-D(blade)-A'. */
  zamasu: song({ bpm: 132, leadDuty: 0.125 }, {
    A: {
      chords: 'C#m | A | F#m | G# | C#m | A | D | G#', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss),
      lead: `C#5*4 E5*4 G#5*4 C#6*4 | B5*4 A5*4 E5*8 | F#5*4 A5*4 C#6*4 E6*4 | D#6*8 B#5*4 G#5*4 |
        G#5*4 C#6*4 E6*4 G#6*4 | E6*4 C#6*4 A5*8 | D6*4 F#6*4 A5*4 D6*4 | B#5*4 D#6*4 G#6*8`,
    },
    B: {
      chords: 'A | B | G#m | C#m | F#m | B | E | G#', harm: 'pad2', bass: 'pump', beat: GROOVE.rock2, fill: FILL.snare,
      lead: `C#6*6 B5*2 A5*4 E5*4 | D#6*6 C#6*2 B5*4 F#5*4 | B5*6 A#5*2 G#5*4 D#5*4 | E5*12 . . . . |
        A5*6 G#5*2 F#5*4 C#6*4 | D#6*6 E6*2 F#6*8 | G#6*4 E6*4 B5*4 G#5*4 | B#5*4 D#6*4 G#5*8`,
    },
    C: {
      chords: 'C#m | B | A | G# | C#m | B | A | G#', harm: 'tremolo', bass: 'hold', beat: GROOVE.heavy, fill: FILL.roll,
      lead: `G#5*16 | F#5*16 | E5*8 C#5*8 | D#5*8 B#4*8 |
        C#6*8 E6*8 | D#6*8 F#6*8 | E6*8 C#6*8 | B#5*8 G#5*8`,
    },
    D: {
      chords: 'C#m | C#m | A | A | F#m | F#m | G# | G#', harm: 'pulse', bass: 'octave', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `C#6*2 G#5*2 E5*2 G#5*2 C#6*2 E6*2 G#6*2 E6*2 | C#6*2 B5*2 C#6*2 E6*2 D#6*4 B5*4 | A5*2 E5*2 C#5*2 E5*2 A5*2 C#6*2 E6*2 C#6*2 | A5*2 G#5*2 A5*2 C#6*2 B5*4 G#5*4 |
        F#5*2 A5*2 C#6*2 F#6*2 E6*2 C#6*2 A5*2 C#6*2 | F#6*4 E6*4 C#6*4 A5*4 | G#5*2 B#5*2 D#6*2 G#6*2 F#6*2 D#6*2 B#5*2 D#6*2 | G#6*8 D#6*8`,
    },
    A2: {
      chords: 'C#m | A | F#m | G# | C#m | A | D | G#', harm: 'arp', bass: 'drive', beat: GROOVE.boss, first: crash(GROOVE.boss), fill: FILL.toms,
      lead: `E6*4 C#6*4 G#5*4 E5*4 | A5*4 C#6*4 E6*8 | F#6*4 E6*4 C#6*4 A5*4 | G#5*8 D#6*8 |
        C#6*4 D#6*4 E6*4 G#6*4 | E6*4 C#6*4 A5*8 | F#6*4 D6*4 A5*4 F#5*4 | G#5*4 B#5*4 D#6*8`,
    },
  }, ['A', 'B', 'C', 'D', 'A2']),

  /** The Tournament of Power's last stand: Ultra Instinct against Jiren. E minor to E major; A-B-E(struggle)-C(stillness)-D(E major)-A'. */
  finale: song({ bpm: 156 }, {
    A: {
      chords: 'Em | C | G | D | Em | C | Am | B', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast),
      lead: `E5*2 G5*2 B5*2 E6*2 D6*4 B5*4 | C6*2 E6*2 G6*2 E6*2 D6*4 C6*4 | B5*2 D6*2 G6*2 D6*2 B5*4 G5*4 | A5*4 D6*4 F#6*8 |
        G6*4 F#6*2 E6*2 B5*4 G5*4 | E6*4 D6*2 C6*2 G5*4 E5*4 | A5*4 C6*4 E6*4 A6*4 | F#6*8 D#6*8`,
    },
    B: {
      chords: 'C | D | Bm | Em | C | D | B | B', harm: 'pulse', bass: 'octave', beat: GROOVE.boss, fill: FILL.snare,
      lead: `G5*3 G5*3 G5*2 C6*4 E6*4 | F#5*3 F#5*3 F#5*2 A5*4 D6*4 | D6*3 D6*3 D6*2 F#6*4 B5*4 | E6*12 . . . . |
        E6*3 D6*3 C6*2 G5*8 | F#6*3 E6*3 D6*2 A5*8 | B5*4 D#6*4 F#6*4 A6*4 | F#6*8 B5*8`,
    },
    E: {
      chords: 'Em | Em | F | F | Em | Em | B | B', harm: 'pulse', bass: 'octave', beat: GROOVE.drive, fill: FILL.run,
      lead: `E5*2 . . E5*2 . . E5*2 . . G5*2 F#5*2 | E5*2 . . E5*2 . . B4*2 . . G4*4 | F5*2 . . F5*2 . . F5*2 . . A5*2 G5*2 | F5*2 . . F5*2 . . C6*2 . . A5*4 |
        G5*2 B5*2 E6*2 G6*2 F#6*2 E6*2 B5*2 G5*2 | B5*2 E6*2 G6*2 E6*2 B5*8 | D#6*4 F#6*4 B5*4 D#6*4 | F#6*4 D#6*4 B5*8`,
    },
    C: {
      chords: 'Cmaj7 | D | Em | Em | Cmaj7 | D | B | B', harm: 'arp', bass: 'soft', beat: GROOVE.half, fill: FILL.roll,
      lead: `G5*8 B5*8 | A5*8 F#5*8 | B5*8 E6*8 | D6*8 B5*8 |
        E6*8 G6*8 | F#6*8 D6*8 | D#6*8 F#6*8 | B5*16`,
    },
    D: {
      chords: 'E | C#m | A | B | E | C#m | A B | E', harm: 'arp', bass: 'pump', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.toms,
      lead: `E5*2 G#5*2 B5*2 E6*2 D#6*4 B5*4 | C#6*2 E6*2 G#6*2 E6*2 C#6*4 G#5*4 | A5*2 C#6*2 E6*2 A6*2 G#6*4 E6*4 | F#6*8 D#6*8 |
        G#6*4 F#6*2 E6*2 B5*4 G#5*4 | E6*4 D#6*2 C#6*2 G#5*4 E5*4 | A5*4 C#6*4 B5*4 D#6*4 | E6*12 . . . .`,
    },
    A2: {
      chords: 'Em | C | G | D | Em | C | Am | B', harm: 'arp', bass: 'drive', beat: GROOVE.fast, first: crash(GROOVE.fast), fill: FILL.run,
      lead: `B5*2 E6*2 G6*2 B5*2 A5*4 G5*4 | G5*2 C6*2 E6*2 C6*2 B5*4 G5*4 | D6*2 G6*2 B5*2 D6*2 G6*8 | F#6*4 E6*4 D6*4 A5*4 |
        E6*4 B5*4 G5*4 B5*4 | C6*4 E6*4 G6*8 | E6*4 C6*4 A5*4 C6*4 | B5*4 D#6*4 F#6*8`,
    },
  }, ['A', 'B', 'E', 'C', 'D', 'A2']),

  // ---- Jingles ----

  /** Victory fanfare (plays once). */
  victory: song({ bpm: 140, loop: false }, {
    A: {
      chords: 'C | F | G | C', harm: 'pad', bass: 'pump', beat: [GROOVE.march, GROOVE.march, FILL.snare, FILL.stop],
      lead: 'C5*2 E5*2 G5*2 C6*6 . . G5*2 | A5*2 C6*2 F6*6 E6*2 D6*2 C6*2 | B5*2 D6*2 G6*4 F6*2 D6*2 B5*4 | C6*8 .*8',
    },
  }, ['A']),

  /** Game over (plays once). */
  gameover: song({ bpm: 70, leadDuty: 0.5, loop: false }, {
    A: {
      chords: 'Am | F | Dm E | Am', harm: 'pad', bass: 'hold',
      lead: 'A5*4 G5*4 E5*4 C5*4 | D5*4 C5*4 A4*8 | F4*8 G#4*8 | A4*12 . . . .',
    },
  }, ['A']),
};
