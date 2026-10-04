/**
 * GBA-flavoured chiptune audio: two pulse channels, a triangle-ish wave channel and noise,
 * synthesised live with WebAudio. Music is a tiny tracker format; SFX are parameterised blips.
 */

/** A music track: tempo plus one pattern string per channel. */
export interface Track {
  /** Tempo in beats per minute. */
  bpm: number;
  /** Rows per beat (subdivision). Default 4 (16th notes). */
  rpb?: number;
  /** Whether to loop. */
  loop: boolean;
  /** Row the loop jumps back to (default 0), so an intro before it plays only once. */
  loopFrom?: number;
  /**
   * Channel patterns. Tokens separated by spaces; each token is one row:
   *   C4 D#5 Bb3  note (sharps '#', flats 'b')
   *   -           sustain previous note
   *   .           rest / note off
   * Drums channel: k kick, x snare, X accented snare, h closed hi-hat, o open hi-hat, c crash cymbal,
   * t high tom, T low tom.
   * A token may carry a length multiplier: 'C4*3' spans three rows.
   */
  lead: string;
  harmony?: string;
  bass?: string;
  drums?: string;
  /** Pulse duty for the lead: 0.125, 0.25 or 0.5. */
  leadDuty?: number;
  /** Pulse duty for the harmony channel (default 0.125). */
  harmonyDuty?: number;
  /** Master volume for this track 0..1. */
  volume?: number;
}

/** Tokens the drums channel understands (plus '.' and '-'). */
export const DRUM_TOKENS = ['k', 'x', 'X', 'h', 'o', 'c', 't', 'T'] as const;

/** Sound-effect identifiers. */
export type Sfx =
  | 'punch' | 'hit' | 'blast' | 'blastHit' | 'charge' | 'beam' | 'explode' | 'hurt' | 'die'
  | 'levelUp' | 'item' | 'menuMove' | 'menuOk' | 'menuBack' | 'text' | 'door' | 'heal'
  | 'powerUp' | 'denied' | 'save' | 'teleport' | 'dash' | 'block' | 'slash';

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a note name like 'C#4', or null for non-notes. */
export function noteFreq(tok: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  let n = NOTE_INDEX[m[1]];
  if (m[2] === '#') n++;
  if (m[2] === 'b') n--;
  const midi = (parseInt(m[3], 10) + 1) * 12 + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Expand a pattern string into one token per row, honouring '*n' multipliers. */
export function expandPattern(p: string): string[] {
  const out: string[] = [];
  for (const raw of p.trim().split(/\s+/)) {
    if (!raw) continue;
    const [tok, mul] = raw.split('*');
    out.push(tok);
    const n = mul ? parseInt(mul, 10) : 1;
    for (let i = 1; i < n; i++) out.push(tok === '.' ? '.' : '-');
  }
  return out;
}

/** Owns the AudioContext, music sequencer and SFX. Safe to call before unlock; it no-ops. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private pulseWaves = new Map<number, PeriodicWave>();
  private current: { track: Track; name: string; rows: string[][]; row: number; nextTime: number } | null = null;
  private timer: number | null = null;
  private pendingTrack: { name: string; track: Track } | null = null;
  private musicVol = 0.55;
  private sfxVol = 0.7;
  muted = false;

  /** Music volume 0..1; takes effect immediately on the playing track. */
  get musicVolume(): number {
    return this.musicVol;
  }

  set musicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.ctx && this.musicBus) this.musicBus.gain.setValueAtTime(this.musicVol * (this.current?.track.volume ?? 1), this.ctx.currentTime);
  }

  /** Sound-effect volume 0..1; takes effect immediately. */
  get sfxVolume(): number {
    return this.sfxVol;
  }

  set sfxVolume(v: number) {
    this.sfxVol = Math.max(0, Math.min(1, v));
    if (this.ctx && this.sfxBus) this.sfxBus.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
  }

  /** Create the AudioContext; must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let lfsr = 0x7fff;
    for (let i = 0; i < len; i++) {
      // 15-bit LFSR like the GB/GBA noise channel.
      const bit = (lfsr ^ (lfsr >> 1)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      d[i] = lfsr & 1 ? 0.6 : -0.6;
    }
    if (this.pendingTrack) {
      const p = this.pendingTrack;
      this.pendingTrack = null;
      this.play(p.name, p.track);
    }
  }

  /** Toggle mute. */
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(m ? 0 : 0.5, this.ctx.currentTime);
  }

  private pulse(duty: number): PeriodicWave | null {
    if (!this.ctx) return null;
    const hit = this.pulseWaves.get(duty);
    if (hit) return hit;
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    // Use cosine terms for a true pulse shape.
    for (let k = 1; k < n; k++) { real[k] = imag[k]; imag[k] = 0; }
    const w = this.ctx.createPeriodicWave(real, imag);
    this.pulseWaves.set(duty, w);
    return w;
  }

  private tone(bus: GainNode, freq: number, start: number, dur: number, opts: {
    type?: OscillatorType; duty?: number; vol?: number; slideTo?: number; attack?: number; release?: number; vibrato?: number;
  } = {}): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    if (opts.duty !== undefined) {
      const w = this.pulse(opts.duty);
      if (w) osc.setPeriodicWave(w);
    } else {
      osc.type = opts.type ?? 'square';
    }
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), start + dur);
    if (opts.vibrato && dur > 0.2) {
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = freq * opts.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(start + 0.15);
      lfo.stop(start + dur);
    }
    const vol = opts.vol ?? 0.2;
    const a = opts.attack ?? 0.005;
    const r = opts.release ?? 0.04;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + a);
    g.gain.setValueAtTime(vol, Math.max(start + a, start + dur - r));
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g).connect(bus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(bus: GainNode, start: number, dur: number, vol: number, filterHz = 4000, slideHz?: number): void {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, start);
    if (slideHz) f.frequency.exponentialRampToValueAtTime(slideHz, start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.02);
  }

  /** Play a sound effect. */
  sfx(id: Sfx): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime + 0.001;
    const b = this.sfxBus;
    switch (id) {
      case 'punch': this.noise(b, t, 0.07, 0.5, 2500, 400); this.tone(b, 180, t, 0.05, { duty: 0.5, vol: 0.15, slideTo: 80 }); break;
      case 'hit': this.noise(b, t, 0.12, 0.6, 3000, 300); this.tone(b, 120, t, 0.08, { duty: 0.25, vol: 0.2, slideTo: 50 }); break;
      case 'block': this.tone(b, 900, t, 0.06, { duty: 0.125, vol: 0.12 }); this.noise(b, t, 0.05, 0.3, 6000); break;
      case 'blast': this.tone(b, 1400, t, 0.12, { duty: 0.25, vol: 0.14, slideTo: 300 }); this.noise(b, t, 0.08, 0.2, 5000, 1500); break;
      case 'blastHit': this.noise(b, t, 0.18, 0.55, 2000, 150); break;
      case 'charge': this.tone(b, 200, t, 0.5, { duty: 0.5, vol: 0.08, slideTo: 900 }); break;
      case 'beam': this.tone(b, 300, t, 0.6, { duty: 0.125, vol: 0.12, slideTo: 1200, vibrato: 0.03 }); this.noise(b, t, 0.6, 0.35, 6000, 1200); break;
      case 'explode': this.noise(b, t, 0.6, 0.8, 1800, 60); this.tone(b, 90, t, 0.4, { duty: 0.5, vol: 0.2, slideTo: 30 }); break;
      case 'hurt': this.tone(b, 400, t, 0.15, { duty: 0.5, vol: 0.18, slideTo: 120 }); break;
      case 'die': this.tone(b, 600, t, 0.5, { duty: 0.25, vol: 0.15, slideTo: 60 }); this.noise(b, t + 0.1, 0.4, 0.3, 1200, 100); break;
      case 'levelUp': ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => this.tone(b, noteFreq(n) ?? 0, t + i * 0.07, i === 5 ? 0.3 : 0.07, { duty: 0.25, vol: 0.14 })); break;
      case 'item': ['G5', 'C6', 'E6'].forEach((n, i) => this.tone(b, noteFreq(n) ?? 0, t + i * 0.06, i === 2 ? 0.2 : 0.06, { duty: 0.125, vol: 0.14 })); break;
      case 'heal': ['C5', 'G5', 'E6'].forEach((n, i) => this.tone(b, noteFreq(n) ?? 0, t + i * 0.08, 0.12, { type: 'triangle', vol: 0.3 })); break;
      case 'powerUp': this.tone(b, 110, t, 0.9, { duty: 0.5, vol: 0.12, slideTo: 880, vibrato: 0.05 }); this.noise(b, t, 0.9, 0.25, 800, 8000); break;
      case 'menuMove': this.tone(b, 1200, t, 0.03, { duty: 0.25, vol: 0.08 }); break;
      case 'menuOk': this.tone(b, 880, t, 0.05, { duty: 0.25, vol: 0.1 }); this.tone(b, 1320, t + 0.05, 0.07, { duty: 0.25, vol: 0.1 }); break;
      case 'menuBack': this.tone(b, 660, t, 0.06, { duty: 0.25, vol: 0.1, slideTo: 330 }); break;
      case 'text': this.tone(b, 1500, t, 0.015, { duty: 0.125, vol: 0.04 }); break;
      case 'door': this.noise(b, t, 0.15, 0.3, 900, 200); this.tone(b, 200, t, 0.1, { type: 'triangle', vol: 0.25 }); break;
      case 'denied': this.tone(b, 200, t, 0.08, { duty: 0.5, vol: 0.14 }); this.tone(b, 150, t + 0.1, 0.12, { duty: 0.5, vol: 0.14 }); break;
      case 'save': ['E5', 'A5', 'E6'].forEach((n, i) => this.tone(b, noteFreq(n) ?? 0, t + i * 0.1, 0.15, { duty: 0.5, vol: 0.1 })); break;
      case 'teleport': this.tone(b, 2000, t, 0.25, { duty: 0.125, vol: 0.1, slideTo: 200 }); this.tone(b, 200, t + 0.25, 0.25, { duty: 0.125, vol: 0.1, slideTo: 2000 }); break;
      case 'dash': this.noise(b, t, 0.15, 0.25, 7000, 2000); break;
      case 'slash': this.noise(b, t, 0.09, 0.35, 9000, 3000); this.tone(b, 1800, t, 0.08, { duty: 0.125, vol: 0.08, slideTo: 600 }); break;
    }
  }

  /** Start a music track by name; no-op if it is already playing. */
  play(name: string, track: Track): void {
    if (!this.ctx || !this.musicBus) {
      this.pendingTrack = { name, track };
      return;
    }
    if (this.current?.name === name) return;
    this.stopMusic();
    const chans = [track.lead, track.harmony ?? '', track.bass ?? '', track.drums ?? ''].map(expandPattern);
    const len = Math.max(...chans.map((c) => c.length));
    const rows: string[][] = [];
    for (let i = 0; i < len; i++) rows.push(chans.map((c) => (c.length ? c[i % c.length] : '.')));
    this.musicBus.gain.setValueAtTime(this.musicVolume * (track.volume ?? 1), this.ctx.currentTime);
    this.current = { track, name, rows, row: 0, nextTime: this.ctx.currentTime + 0.05 };
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** Name of the track currently playing. */
  get playing(): string | null {
    return this.current?.name ?? this.pendingTrack?.name ?? null;
  }

  /** Stop music immediately. */
  stopMusic(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.current = null;
    this.pendingTrack = null;
  }

  /** One drums-channel hit: noise for snares, hats and cymbals, falling triangle blips for the kick and toms. */
  private drum(tok: string, t: number): void {
    const bus = this.musicBus;
    if (!bus) return;
    switch (tok) {
      case 'k': this.tone(bus, 150, t, 0.1, { type: 'triangle', vol: 0.5, slideTo: 40 }); break;
      case 'x': this.noise(bus, t, 0.12, 0.35, 1800, 200); break;
      case 'X': this.noise(bus, t, 0.2, 0.5, 2400, 150); break;
      case 'h': this.noise(bus, t, 0.04, 0.18, 9000); break;
      case 'o': this.noise(bus, t, 0.16, 0.16, 9000, 5000); break;
      case 'c': this.noise(bus, t, 0.6, 0.3, 9000, 2500); break;
      case 't': this.tone(bus, 260, t, 0.12, { type: 'triangle', vol: 0.42, slideTo: 120 }); break;
      case 'T': this.tone(bus, 170, t, 0.16, { type: 'triangle', vol: 0.46, slideTo: 70 }); break;
    }
  }

  private schedule(): void {
    const cur = this.current;
    if (!this.ctx || !this.musicBus || !cur) return;
    const rowDur = 60 / cur.track.bpm / (cur.track.rpb ?? 4);
    while (cur.nextTime < this.ctx.currentTime + 0.12) {
      if (cur.row >= cur.rows.length) {
        if (!cur.track.loop) { this.stopMusic(); return; }
        const from = cur.track.loopFrom ?? 0;
        cur.row = from > 0 && from < cur.rows.length ? from : 0;
      }
      const row = cur.rows[cur.row];
      for (let ch = 0; ch < 4; ch++) {
        const tok = row[ch];
        if (!tok || tok === '.' || tok === '-') continue;
        if (ch === 3) {
          this.drum(tok, cur.nextTime);
          continue;
        }
        const f = noteFreq(tok);
        if (!f) continue;
        // Note length = this row plus following sustains.
        let n = 1;
        const chan = cur.rows;
        for (let k = cur.row + 1; k < chan.length && chan[k][ch] === '-'; k++) n++;
        const dur = n * rowDur;
        if (ch === 0) this.tone(this.musicBus, f, cur.nextTime, dur * 0.95, { duty: cur.track.leadDuty ?? 0.25, vol: 0.11, vibrato: 0.012 });
        if (ch === 1) this.tone(this.musicBus, f, cur.nextTime, dur * 0.9, { duty: cur.track.harmonyDuty ?? 0.125, vol: 0.06 });
        if (ch === 2) this.tone(this.musicBus, f, cur.nextTime, dur * 0.85, { type: 'triangle', vol: 0.3 });
      }
      cur.nextTime += rowDur;
      cur.row++;
    }
  }
}

/** Shared audio instance. */
export const audio = new Audio();
