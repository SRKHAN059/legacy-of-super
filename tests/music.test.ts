import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/content/music';
import { expandPattern, noteFreq } from '../src/engine/audio';

describe('music tracks', () => {
  for (const [id, t] of Object.entries(TRACKS)) {
    it(`${id}: channels are whole bars, aligned, and use valid notes`, () => {
      const chans = { lead: t.lead, harmony: t.harmony, bass: t.bass, drums: t.drums };
      const lens: Record<string, number> = {};
      for (const [name, p] of Object.entries(chans)) {
        if (!p) continue;
        const rows = expandPattern(p);
        lens[name] = rows.length;
        expect(rows.length % 16, `${id}.${name} has ${rows.length} rows`).toBe(0);
        for (const tok of rows) {
          if (name === 'drums') expect(['.', '-', 'x', 'X', 'h', 'k'], `${id}.${name} token ${tok}`).toContain(tok);
          else if (tok !== '.' && tok !== '-') expect(noteFreq(tok), `${id}.${name} note ${tok}`).not.toBeNull();
        }
      }
      // Channels must divide the lead length so loops stay in phase.
      for (const [name, n] of Object.entries(lens)) {
        expect(lens.lead % n === 0 || n % lens.lead === 0, `${id}.${name} (${n}) vs lead (${lens.lead})`).toBe(true);
      }
    });
  }
});
