/** Scouter readings for named cast members (playable characters show ???). */
export interface ScanEntry {
  name: string;
  hp: number | string;
  str: number | string;
  pow: number | string;
  end: number | string;
  desc: string;
}

export const SCANS: Record<string, ScanEntry> = {
  bulma: { name: 'Bulma', hp: 40, str: 2, pow: 1, end: 3, desc: 'Genius inventor and head of Capsule Corporation. Do not make her angry.' },
  chichi: { name: 'Chi-Chi', hp: 160, str: 14, pow: 2, end: 9, desc: 'Goku\'s wife. A former martial artist who runs the Son household with an iron ladle.' },
  krillin: { name: 'Krillin', hp: 1800, str: 23, pow: 24, end: 17, desc: 'Earth\'s strongest human and Goku\'s oldest friend. Now a police officer.' },
  roshi: { name: 'Master Roshi', hp: 1500, str: 20, pow: 25, end: 18, desc: 'The Turtle Hermit. Ancient, lecherous, and far tougher than he looks.' },
  mrSatan: { name: 'Mr. Satan', hp: 50, str: 8, pow: 1, end: 6, desc: 'The World Champion and "savior of Earth". Surprisingly brave when it counts.' },
  beerus: { name: 'Beerus', hp: '???', str: '???', pow: '???', end: '???', desc: 'God of Destruction of Universe 7. Readings exceed the scouter\'s limits.' },
  whis: { name: 'Whis', hp: '???', str: '???', pow: '???', end: '???', desc: 'Beerus\'s attendant and martial arts teacher. An angel. The scouter refuses to guess.' },
  goten: { name: 'Goten', hp: 900, str: 15, pow: 16, end: 12, desc: 'Goku\'s youngest son. Cheerful and frighteningly strong for his age.' },
  trunksKid: { name: 'Trunks', hp: 950, str: 16, pow: 15, end: 13, desc: 'Vegeta and Bulma\'s son. Goten\'s best friend and partner in mischief.' },
  goku: { name: 'Goku', hp: '???', str: '???', pow: '???', end: '???', desc: 'A Saiyan raised on Earth. Lives for the next strong opponent.' },
  vegeta: { name: 'Vegeta', hp: '???', str: '???', pow: '???', end: '???', desc: 'Prince of all Saiyans. Proud, relentless and determined to surpass Goku.' },
  gohan: { name: 'Gohan', hp: '???', str: '???', pow: '???', end: '???', desc: 'Goku\'s eldest son, now a scholar. His hidden potential is enormous.' },
  piccolo: { name: 'Piccolo', hp: '???', str: '???', pow: '???', end: '???', desc: 'A Namekian warrior and Gohan\'s mentor. Trains in weighted clothing.' },
  futureTrunks: { name: 'Trunks', hp: '???', str: '???', pow: '???', end: '???', desc: 'A warrior from a ruined future. Carries a sword and a heavy heart.' },
};

/** Register more scan entries (chapter content). */
export function registerScans(entries: Record<string, ScanEntry>): void {
  Object.assign(SCANS, entries);
}
