import { PAL } from '../art/color';
import { portrait, spriteSet } from '../art/registry';
import { CHARACTERS } from '../content/characters';
import { MAPS } from '../content/registry';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { font, makeBitmap, type Bitmap } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import type { SaveData } from '../game/state';
import { drawWindow } from './window';

type Mode = 'press' | 'menu' | 'files' | 'fileAction' | 'confirmDelete' | 'options' | 'credits';

let logoCache: Bitmap | null = null;

/** Big two-tone logo rendered from the bitmap font at 2x with an outline. */
function logo(): Bitmap {
  if (logoCache) return logoCache;
  const line1 = 'LEGACY OF';
  const line2 = 'SUPER';
  const { bmp: small, ctx: sctx } = makeBitmap(120, 24);
  font.drawCentered(sctx, line1, 60, 0, '#f8f8f8');
  font.drawCentered(sctx, line2, 60, 11, '#f8c020');
  const { bmp, ctx } = makeBitmap(244, 52);
  // Outline by stamping a dark copy offset in 8 directions.
  const { bmp: dark, ctx: dctx } = makeBitmap(120, 24);
  font.drawCentered(dctx, line1, 60, 0, '#301000');
  font.drawCentered(dctx, line2, 60, 11, '#301000');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [2, 2]]) ctx.drawImage(dark, 0, 0, 120, 24, 2 + dx * 2, 2 + dy * 2, 240, 48);
  ctx.drawImage(small, 0, 0, 120, 24, 2, 2, 240, 48);
  logoCache = bmp;
  return bmp;
}

/** Title screen, file select and title options. */
export class TitleScene implements Scene {
  private t = 0;
  private mode: Mode = 'press';
  private sel = 0;
  private fileSel = 0;
  private actionSel = 0;
  private files: Array<{ slot: number; data: SaveData | null }> = [];
  private readonly heroes = ['gokuSSB', 'vegetaSSB', 'gohan', 'futureTrunksSSJ', 'piccolo'];

  constructor(private readonly game: Game) {
    this.files = game.saves.summaries();
  }

  update(input: Input): void {
    this.t++;
    const up = input.repeat('up');
    const down = input.repeat('down');
    const ok = input.pressed('A') || input.pressed('start');
    const back = input.pressed('B');
    switch (this.mode) {
      case 'press':
        if (ok) { this.mode = 'menu'; audio.sfx('menuOk'); }
        break;
      case 'menu':
        if (up || down) { this.sel ^= 1; audio.sfx('menuMove'); }
        if (ok) {
          audio.sfx('menuOk');
          if (this.sel === 0) { this.files = this.game.saves.summaries(); this.mode = 'files'; }
          else { this.mode = 'options'; this.sel = 0; }
        }
        break;
      case 'files':
        if (up) { this.fileSel = (this.fileSel + 2) % 3; audio.sfx('menuMove'); }
        if (down) { this.fileSel = (this.fileSel + 1) % 3; audio.sfx('menuMove'); }
        if (back) { this.mode = 'menu'; this.sel = 0; audio.sfx('menuBack'); }
        if (ok) { this.mode = 'fileAction'; this.actionSel = 0; audio.sfx('menuOk'); }
        break;
      case 'fileAction': {
        const has = !!this.files[this.fileSel].data;
        const opts = has ? ['Continue', 'New Game', 'Delete'] : ['New Game'];
        if (up) { this.actionSel = (this.actionSel + opts.length - 1) % opts.length; audio.sfx('menuMove'); }
        if (down) { this.actionSel = (this.actionSel + 1) % opts.length; audio.sfx('menuMove'); }
        if (back) { this.mode = 'files'; audio.sfx('menuBack'); }
        if (ok) {
          const o = opts[this.actionSel];
          audio.sfx('menuOk');
          if (o === 'Continue') this.game.continueGame(this.fileSel);
          else if (o === 'New Game') void this.game.startNewGame(this.fileSel);
          else { this.mode = 'confirmDelete'; this.actionSel = 1; }
        }
        break;
      }
      case 'confirmDelete':
        if (up || down) { this.actionSel ^= 1; audio.sfx('menuMove'); }
        if (back) { this.mode = 'files'; audio.sfx('menuBack'); }
        if (ok) {
          if (this.actionSel === 0) { this.game.saves.erase(this.fileSel); this.files = this.game.saves.summaries(); audio.sfx('explode'); }
          this.mode = 'files';
        }
        break;
      case 'options': {
        const d = this.game.state.data;
        if (up) { this.sel = (this.sel + 3) % 4; audio.sfx('menuMove'); }
        if (down) { this.sel = (this.sel + 1) % 4; audio.sfx('menuMove'); }
        const l = input.repeat('left');
        const r = input.repeat('right');
        if (l || r) {
          const dv = r ? 1 : -1;
          if (this.sel === 0) d.textSpeed = Math.max(1, Math.min(4, d.textSpeed + dv));
          if (this.sel === 1) { d.musicVol = Math.max(0, Math.min(1, +(d.musicVol + dv * 0.1).toFixed(1))); audio.musicVolume = d.musicVol; }
          if (this.sel === 2) { d.sfxVol = Math.max(0, Math.min(1, +(d.sfxVol + dv * 0.1).toFixed(1))); audio.sfxVolume = d.sfxVol; audio.sfx('menuMove'); }
        }
        if (ok && this.sel === 3) { this.mode = 'credits'; this.t = 0; audio.sfx('menuOk'); }
        if (back) { this.mode = 'menu'; this.sel = 1; audio.sfx('menuBack'); }
        break;
      }
      case 'credits':
        if (back || (ok && this.t > 30)) { this.mode = 'options'; this.sel = 3; }
        break;
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    // Energy-burst sky.
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, '#081038');
    g.addColorStop(0.6, '#283880');
    g.addColorStop(1, '#f0a040');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.save();
    ctx.translate(SCREEN_W / 2, 150);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + this.t / 400;
      ctx.fillStyle = i % 2 ? 'rgba(255,220,120,0.10)' : 'rgba(120,180,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 300, Math.sin(a) * 300);
      ctx.lineTo(Math.cos(a + 0.17) * 300, Math.sin(a + 0.17) * 300);
      ctx.fill();
    }
    ctx.restore();
    // Heroes lined up on a cliff.
    ctx.fillStyle = '#20182c';
    ctx.fillRect(0, 140, SCREEN_W, 20);
    this.heroes.forEach((id, i) => {
      const set = spriteSet(id);
      const bob = Math.round(Math.sin((this.t + i * 20) / 30) * 1);
      const x = 40 + i * 40 - 12;
      const y = 112 + bob + (i === 2 ? -2 : 0);
      ctx.drawImage(set[i % 2 ? 'charge' : 'idle'].down, x, y);
      if (this.t % 6 === i) { ctx.fillStyle = '#fff8c0'; ctx.fillRect(x + 4 + (this.t % 13), y + 4, 1, 2); }
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackdrop(ctx);
    const lg = logo();
    ctx.drawImage(lg, Math.round((SCREEN_W - lg.width) / 2), 10 + Math.round(Math.sin(this.t / 50) * 1.5));
    font.drawCentered(ctx, 'A Dragon Ball Super fan tribute', SCREEN_W / 2, 64, '#c8d0f0', '#000');

    switch (this.mode) {
      case 'press':
        if (Math.floor(this.t / 30) % 2 === 0) font.drawCentered(ctx, 'PRESS START', SCREEN_W / 2, 90, PAL.white, '#000');
        break;
      case 'menu': {
        drawWindow(ctx, 84, 80, 72, 34);
        ['START', 'OPTIONS'].forEach((o, i) => {
          font.draw(ctx, o, 104, 86 + i * 12, i === this.sel ? PAL.gold : PAL.white, '#000');
          if (i === this.sel) this.orb(ctx, 94, 89 + i * 12);
        });
        break;
      }
      case 'files':
      case 'fileAction':
      case 'confirmDelete':
        this.renderFiles(ctx);
        break;
      case 'options':
        this.renderOptions(ctx);
        break;
      case 'credits':
        this.renderCredits(ctx);
        break;
    }
  }

  private orb(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#f89820';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e03020';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  private renderFiles(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.55)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    font.drawCentered(ctx, 'SELECT FILE', SCREEN_W / 2, 6, PAL.gold, '#000');
    this.files.forEach(({ slot, data }, i) => {
      const y = 20 + i * 44;
      drawWindow(ctx, 16, y, 208, 40, { fill: i === this.fileSel ? '#203060' : undefined });
      font.draw(ctx, `FILE ${slot + 1}`, 24, y + 4, i === this.fileSel ? PAL.gold : PAL.white, '#000');
      if (!data) { font.draw(ctx, '- New Game -', 90, y + 16, '#a0a8c8', '#000'); return; }
      const hero = data.chars[data.active];
      const pid = CHARACTERS[data.active].sprite;
      const por = portrait(pid);
      if (por) ctx.drawImage(por, 0, 4, 32, 30, 24, y + 9, 32, 30);
      font.draw(ctx, `${CHARACTERS[data.active].name}  Lv ${hero.level}`, 62, y + 14, PAL.white, '#000');
      const area = MAPS[data.map]?.name ?? data.map;
      font.draw(ctx, area, 62, y + 25, '#a8c8f8', '#000');
      const secs = Math.floor(data.playFrames / 60);
      const tm = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}`;
      font.drawRight(ctx, data.chapter === 0 ? 'Prologue' : `Ch.${data.chapter}`, 216, y + 4, '#c8c8c8', '#000');
      font.drawRight(ctx, tm, 216, y + 25, '#c8c8c8', '#000');
    });
    if (this.mode === 'fileAction' || this.mode === 'confirmDelete') {
      const has = !!this.files[this.fileSel].data;
      const opts = this.mode === 'confirmDelete' ? ['Delete', 'Cancel'] : has ? ['Continue', 'New Game', 'Delete'] : ['New Game'];
      const h = opts.length * 12 + 8;
      const y = 24 + this.fileSel * 44;
      drawWindow(ctx, 150, Math.min(SCREEN_H - h - 2, y), 70, h);
      if (this.mode === 'confirmDelete') font.draw(ctx, 'Erase?', 154, Math.min(SCREEN_H - h - 2, y) - 10, '#f86060', '#000');
      opts.forEach((o, i) => {
        const yy = Math.min(SCREEN_H - h - 2, y) + 5 + i * 12;
        font.draw(ctx, o, 166, yy, i === this.actionSel ? PAL.gold : PAL.white, '#000');
        if (i === this.actionSel) font.draw(ctx, '▶', 156, yy, PAL.gold, '#000');
      });
    }
  }

  private renderOptions(ctx: CanvasRenderingContext2D): void {
    const d = this.game.state.data;
    drawWindow(ctx, 40, 74, 160, 60);
    const rows: Array<[string, string]> = [
      ['Text Speed', ['', 'Slow', 'Normal', 'Fast', 'Instant'][d.textSpeed]],
      ['Music', `${Math.round(d.musicVol * 10)}`],
      ['Sound FX', `${Math.round(d.sfxVol * 10)}`],
      ['Credits', ''],
    ];
    rows.forEach(([k, v], i) => {
      const y = 80 + i * 12;
      font.draw(ctx, k, 58, y, i === this.sel ? PAL.gold : PAL.white, '#000');
      if (v) font.drawRight(ctx, `< ${v} >`, 192, y, PAL.white, '#000');
      if (i === this.sel) font.draw(ctx, '▶', 48, y, PAL.gold, '#000');
    });
  }

  private renderCredits(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.8)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const lines = [
      'LEGACY OF SUPER',
      '',
      'A non-commercial fan tribute.',
      'Gameplay modelled on The Legacy of Goku II',
      '(Webfoot / Atari, 2003).',
      'Dragon Ball Super (c) Bird Studio / Shueisha,',
      'Toei Animation. All rights belong to their owners.',
      '',
      'All sprites, music and code in this build are',
      'original and generated procedurally.',
      '',
      'B: back',
    ];
    lines.forEach((l, i) => font.drawCentered(ctx, l, SCREEN_W / 2, 12 + i * 11, i === 0 ? PAL.gold : PAL.white, '#000'));
  }
}
