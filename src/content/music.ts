import type { Track } from '../engine/audio';

// All compositions are original. Each bar = 16 rows (16th notes).

const rep = (s: string, n: number): string => Array(n).fill(s).join(' ');
/** Pumping root-fifth bass bar. */
const bass = (r: string, f: string, t: string): string => `${r}*2 . ${r} ${f}*2 . ${f} ${r}*2 . ${r} ${f}*2 ${t}*2`;
/** Gentle held bass bar. */
const soft = (r: string, f: string): string => `${r}*6 . . ${f}*4 ${r}*4`;
/** Driving octave bass bar. */
const drive = (lo: string, hi: string): string => rep(`${lo}*2 ${hi}*2`, 4);
const pad = (...notes: string[]): string => notes.map((n) => `${n}*16`).join(' ');

const DR_ROCK = 'k . h . x . h . k . h k x . h .';
const DR_MARCH = 'k . h h x . h . k k h . x . h h';
const DR_SOFT = 'k . . . h . . . k . . . h . . .';
const DR_FAST = 'k h x h k h x h k h x h k x x h';
const DR_HALF = 'k . . . x . . . k . k . x . . .';

/** Music tracks by id. */
export const TRACKS: Record<string, Track> = {
  title: {
    bpm: 132, loop: true, leadDuty: 0.25,
    lead: 'E5*4 G5*4 C6*6 B5*2 A5*8 E5*4 G5*4 F5*4 A5*4 C6*4 D6*4 B5*12 G5*4 E5*4 G5*4 C6*6 D6*2 E6*8 D6*4 C6*4 A5*4 C6*4 F6*4 E6*4 D6*8 . . . . B5*4',
    harmony: pad('C5', 'A4', 'A4', 'B4', 'C5', 'C5', 'C5', 'B4'),
    bass: [bass('C3', 'G2', 'E2'), bass('A2', 'E3', 'G2'), bass('F2', 'C3', 'A2'), bass('G2', 'D3', 'B2')].join(' ').repeat(1) + ' ' + [bass('C3', 'G2', 'E2'), bass('A2', 'E3', 'G2'), bass('F2', 'C3', 'A2'), bass('G2', 'D3', 'B2')].join(' '),
    drums: rep(DR_ROCK, 8),
  },
  worldmap: {
    bpm: 120, loop: true, leadDuty: 0.5,
    lead: 'C5*4 F5*4 A5*6 G5*2 E5*8 C5*4 E5*4 D5*4 F5*4 A5*4 C6*4 Bb5*12 A5*2 G5*2 A5*4 C6*4 F6*6 E6*2 C6*8 G5*4 C6*4 D6*4 C6*4 A5*4 F5*4 G5*8 F5*8',
    harmony: pad('A4', 'G4', 'F4', 'F4', 'A4', 'G4', 'F4', 'E4'),
    bass: rep([bass('F2', 'C3', 'A2'), bass('C3', 'G2', 'E2'), bass('D3', 'A2', 'F2'), bass('Bb2', 'F2', 'D3')].join(' '), 2),
    drums: rep(DR_ROCK, 8),
  },
  peaceful: {
    bpm: 92, loop: true, leadDuty: 0.5, volume: 0.85,
    lead: 'G4*4 C5*4 E5*8 D5*4 B4*4 G4*8 A4*4 C5*4 E5*4 A5*4 G5*8 F5*4 E5*4 E5*4 G5*4 C6*8 B5*4 G5*4 D5*8 C5*4 E5*4 A5*6 G5*2 F5*8 E5*4 D5*4',
    harmony: pad('E4', 'D4', 'C4', 'C4', 'E4', 'D4', 'E4', 'A3'),
    bass: rep([soft('C3', 'G2'), soft('G2', 'D3'), soft('A2', 'E3'), soft('F2', 'C3')].join(' '), 2),
    drums: rep(DR_SOFT, 8),
  },
  town: {
    bpm: 116, loop: true, leadDuty: 0.125,
    lead: 'D5*2 G5*2 B5*2 G5*2 D6*4 B5*4 E5*2 G5*2 B5*2 E6*2 D6*4 B5*4 C6*2 B5*2 A5*2 G5*2 E5*4 G5*4 A5*4 F#5*4 D5*4 . . . . D5*2 G5*2 B5*2 G5*2 D6*4 B5*4 E5*2 G5*2 B5*2 E6*2 D6*4 B5*4 C6*2 E6*2 D6*2 C6*2 B5*4 A5*4 G5*12 . . . .',
    harmony: pad('B4', 'G4', 'E4', 'F#4', 'B4', 'G4', 'E4', 'D4'),
    bass: rep([bass('G2', 'D3', 'B2'), bass('E2', 'B2', 'G2'), bass('C3', 'G2', 'E2'), bass('D3', 'A2', 'F#2')].join(' '), 2),
    drums: rep(DR_MARCH, 8),
  },
  field: {
    bpm: 128, loop: true, leadDuty: 0.25,
    lead: 'A4*2 . A4 C5*2 E5*2 A5*4 G5*2 E5*2 F5*4 E5*2 D5*2 C5*4 A4*4 G4*2 . G4 B4*2 D5*2 G5*4 F5*2 D5*2 E5*8 B4*4 E5*4 A4*2 . A4 C5*2 E5*2 A5*4 G5*2 E5*2 F5*4 A5*4 C6*4 A5*4 G5*4 B5*4 D6*4 B5*4 E6*8 D6*4 B5*4',
    harmony: pad('E4', 'C4', 'D4', 'B3', 'E4', 'C4', 'D4', 'G#4'),
    bass: rep([bass('A2', 'E3', 'C3'), bass('F2', 'C3', 'A2'), bass('G2', 'D3', 'B2'), bass('E2', 'B2', 'G#2')].join(' '), 2),
    drums: rep(DR_ROCK, 8),
  },
  battle: {
    bpm: 150, loop: true, leadDuty: 0.25,
    lead: 'D5*2 . D5 F5*2 A5*2 D6*4 C6*2 A5*2 Bb5*4 A5*2 G5*2 F5*4 D5*4 C5*2 . C5 E5*2 G5*2 C6*4 Bb5*2 G5*2 A5*8 C#6*4 E6*4 D6*4 A5*4 F5*4 D5*4 Bb5*2 D6*2 F6*4 E6*4 D6*4 C6*2 E6*2 G6*4 F6*4 E6*4 A5*4 C#6*4 E6*4 A6*4',
    harmony: pad('F4', 'D4', 'E4', 'C#4', 'F4', 'D4', 'E4', 'E4'),
    bass: rep([drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('C2', 'C3'), drive('A1', 'A2')].join(' '), 2),
    drums: rep(DR_FAST, 8),
  },
  tense: {
    bpm: 90, loop: true, leadDuty: 0.125, volume: 0.9,
    lead: 'D5*8 . . . . Eb5*4 D5*12 . . . . F5*8 E5*4 Eb5*4 D5*16',
    harmony: pad('A4', 'A4', 'Bb4', 'A4'),
    bass: 'D2*8 D2*8 D2*8 D2*8 D2*8 D2*8 D2*8 C#2*8',
    drums: rep('k . . . . . . . k . . . . . h .', 4),
  },
  sad: {
    bpm: 72, loop: true, leadDuty: 0.5, volume: 0.8,
    lead: 'E5*8 C5*4 A4*4 F5*8 E5*4 D5*4 C5*8 E5*4 G5*4 B4*12 . . . . A5*8 G5*4 E5*4 F5*8 A5*4 F5*4 E5*4 D5*4 C5*4 B4*4 A4*16',
    harmony: pad('C5', 'A4', 'G4', 'G4', 'C5', 'C5', 'G#4', 'A4'),
    bass: [soft('A2', 'E3'), soft('F2', 'C3'), soft('C3', 'G2'), soft('G2', 'D3'), soft('A2', 'E3'), soft('F2', 'C3'), soft('E2', 'B2'), soft('A2', 'E3')].join(' '),
  },
  future: {
    bpm: 100, loop: true, leadDuty: 0.25,
    lead: 'B4*4 E5*4 G5*6 F#5*2 E5*8 G5*4 E5*4 F#5*4 A5*4 D6*6 C6*2 B5*12 A5*2 F#5*2 G5*4 B5*4 E6*8 C6*4 B5*4 G5*4 E5*4 D6*4 C6*4 A5*4 F#5*4 B5*16',
    harmony: pad('G4', 'E4', 'F#4', 'D#4', 'G4', 'E4', 'F#4', 'D#4'),
    bass: rep([soft('E2', 'B2'), soft('C3', 'G2'), soft('D3', 'A2'), soft('B2', 'F#2')].join(' '), 2),
    drums: rep(DR_HALF, 8),
  },
  godly: {
    bpm: 84, loop: true, leadDuty: 0.125,
    lead: 'D5*4 Eb5*4 F5*4 A5*4 G5*8 F5*4 Eb5*4 D5*4 F5*4 A5*4 C6*4 Bb5*8 A5*8 D6*4 C6*4 Bb5*4 A5*4 G5*4 F5*4 Eb5*8 F5*4 G5*4 A5*4 Bb5*4 A5*8 Eb5*4 D5*4',
    harmony: pad('A4', 'Bb4', 'A4', 'F4', 'A4', 'Bb4', 'C5', 'A4'),
    bass: [soft('D2', 'A2'), soft('D2', 'A2'), soft('D2', 'A2'), soft('D2', 'A2'), soft('D2', 'A2'), soft('Eb2', 'Bb2'), soft('D2', 'A2'), soft('D2', 'A2')].join(' '),
    drums: rep('k . . h . . x . k . h . x . . .', 8),
  },
  tournament: {
    bpm: 144, loop: true, leadDuty: 0.25,
    lead: 'E5*2 E5*2 G5*2 B5*2 E6*4 D6*2 B5*2 C6*4 B5*2 A5*2 G5*4 E5*4 D5*2 F#5*2 A5*2 D6*2 F#6*4 E6*2 D6*2 E6*8 B5*4 G5*4 E5*2 E5*2 G5*2 B5*2 E6*4 D6*2 B5*2 C6*2 E6*2 G6*4 F#6*4 E6*4 D6*2 F#6*2 A6*4 G6*4 F#6*4 E6*12 . . . .',
    harmony: pad('B4', 'G4', 'A4', 'G4', 'B4', 'G4', 'A4', 'B4'),
    bass: rep([drive('E2', 'E3'), drive('C2', 'C3'), drive('D2', 'D3'), drive('E2', 'E3')].join(' '), 2),
    drums: rep(DR_FAST, 8),
  },
  cave: {
    bpm: 76, loop: true, leadDuty: 0.125, volume: 0.85,
    lead: 'A4*2 . . E5*2 . . C5*2 . . B4*4 G4*2 . . D5*2 . . B4*2 . . A4*4 F4*2 . . C5*2 . . A4*2 . . G4*4 E4*2 . . B4*2 . . G#4*2 . . E5*4',
    bass: 'A1*16 G1*16 F1*16 E1*16',
    drums: rep('k . . . . . . . . . h . . . . .', 4),
  },
  space: {
    bpm: 90, loop: true, leadDuty: 0.5, volume: 0.85,
    lead: 'C5*4 E5*4 G5*4 B5*4 F#5*8 E5*8 D5*4 F#5*4 A5*4 C6*4 B5*16',
    harmony: pad('G4', 'A4', 'F#4', 'G4'),
    bass: 'C2*16 C2*16 D2*16 D2*16',
  },
  futureWorld: {
    bpm: 96, loop: true, leadDuty: 0.25,
    lead: 'E5*8 D5*4 B4*4 C5*8 E5*4 G5*4 F#5*8 A5*4 F#5*4 B5*16',
    harmony: pad('B4', 'G4', 'A4', 'D#4'),
    bass: [soft('E2', 'B2'), soft('C3', 'G2'), soft('D3', 'A2'), soft('B2', 'F#2')].join(' '),
    drums: rep(DR_HALF, 4),
  },
  frieza: {
    bpm: 112, loop: true, leadDuty: 0.25,
    lead: 'C5*4 Eb5*4 G5*4 Ab5*4 G5*8 Eb5*4 C5*4 F5*4 Ab5*4 C6*4 Bb5*4 G5*12 F5*2 Eb5*2 C5*4 Eb5*4 G5*4 C6*4 Db6*8 C6*4 Ab5*4 Bb5*4 G5*4 Eb5*4 F5*4 G5*16',
    harmony: pad('G4', 'Eb4', 'F4', 'D4', 'G4', 'F4', 'Eb4', 'B3'),
    bass: rep([drive('C2', 'C3'), drive('Ab1', 'Ab2'), drive('F1', 'F2'), drive('G1', 'G2')].join(' '), 2),
    drums: rep(DR_MARCH, 8),
  },
  black: {
    bpm: 96, loop: true, leadDuty: 0.125,
    lead: 'B4*6 C5*2 B4*8 F#5*6 G5*2 F#5*8 E5*4 F#5*4 G5*4 B5*4 C6*8 B5*8 B4*6 C5*2 B4*8 F5*6 E5*2 D#5*8 E5*4 G5*4 B5*4 E6*4 D#6*16',
    harmony: pad('E4', 'D#4', 'E4', 'E4', 'E4', 'C4', 'E4', 'B3'),
    bass: rep([soft('E2', 'B2'), soft('B1', 'F#2'), soft('C2', 'G2'), soft('A1', 'E2')].join(' '), 2),
    drums: rep('k . . . x . . h k . . . x . h h', 8),
  },
  jiren: {
    bpm: 84, loop: true, leadDuty: 0.5,
    lead: 'C5*12 Db5*4 C5*16 Eb5*12 D5*4 Db5*16 C5*8 G4*8 Ab4*8 Bb4*8 C5*16 G4*16',
    harmony: pad('G4', 'G4', 'Ab4', 'Ab4', 'Eb4', 'F4', 'G4', 'G4'),
    bass: 'C2*16 C2*16 Ab1*16 Ab1*16 F1*16 F1*16 G1*16 G1*16',
    drums: rep('k . . . . . . . X . . . . . . .', 8),
  },
  heroic: {
    bpm: 138, loop: true, leadDuty: 0.25,
    lead: 'G4*2 C5*2 E5*2 G5*2 C6*6 B5*2 A5*4 G5*4 E5*4 C5*4 F5*2 A5*2 C6*2 F6*2 E6*6 D6*2 C6*8 B5*4 G5*4 C6*2 E6*2 G6*4 E6*4 C6*4 D6*2 F6*2 A6*4 F6*4 D6*4 G6*8 F6*4 E6*4 D6*8 B5*8',
    harmony: pad('E4', 'A4', 'A4', 'G4', 'E5', 'F5', 'B4', 'G4'),
    bass: [bass('C3', 'G2', 'E2'), bass('A2', 'E3', 'C3'), bass('F2', 'C3', 'A2'), bass('G2', 'D3', 'B2'), bass('C3', 'G2', 'E2'), bass('D3', 'A2', 'F2'), bass('G2', 'D3', 'B2'), bass('G2', 'D3', 'F2')].join(' '),
    drums: rep(DR_FAST, 8),
  },
  ending: {
    bpm: 96, loop: true, leadDuty: 0.5, volume: 0.9,
    lead: 'E5*4 G5*4 C6*8 B5*4 A5*4 G5*8 F5*4 A5*4 D6*8 C6*4 B5*4 C6*8 E5*4 G5*4 C6*8 D6*4 E6*4 D6*8 C6*4 A5*4 F5*4 D5*4 G5*16',
    harmony: pad('C5', 'E4', 'A4', 'G4', 'C5', 'G4', 'F4', 'B4'),
    bass: [soft('C3', 'G2'), soft('E2', 'B2'), soft('F2', 'C3'), soft('G2', 'D3'), soft('A2', 'E3'), soft('G2', 'D3'), soft('F2', 'C3'), soft('G2', 'D3')].join(' '),
    drums: rep(DR_SOFT, 8),
  },
  victory: {
    bpm: 140, loop: false, leadDuty: 0.25,
    lead: 'G5*2 G5*2 G5*2 C6*8 . . Bb5*4 C6*4 D6*4 C6*12 . . . . . . . .',
    harmony: 'E5*2 E5*2 E5*2 E5*8 . . F5*4 F5*4 F5*4 E5*12 . . . . . . . .',
    bass: 'C3*14 . . Bb2*12 C3*12 . . . . . . . .',
    drums: 'k . k . k . X . . . . . . . . . k . . . k . . . X . . . . . . . . . . . . . . . . . . . . . . .',
  },
  gameover: {
    bpm: 70, loop: false, leadDuty: 0.5,
    lead: 'E5*4 D5*4 C5*4 B4*4 A4*16',
    bass: 'A2*16 E2*16',
  },
};
