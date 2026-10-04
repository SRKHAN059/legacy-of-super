import { PAL } from '../art/color';
import { portrait } from '../art/registry';
import { CHARACTERS, FORMS, type CharId } from '../content/characters';
import { ITEMS, type ItemDef } from '../content/items';
import { QUESTS, type Star } from '../content/quests';
import { CHARGED_MELEE, TECHNIQUES } from '../content/techniques';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { wrap } from '../engine/fontdata';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import { expToNext, MAX_LEVEL, STAT_CAP } from '../game/leveling';
import type { CharState } from '../game/state';
import { textSettings } from './dialogue';
import { drawWindow } from './window';

type Page = 'status' | 'journal' | 'options' | 'items';
const RING: Page[] = ['status', 'journal', 'options', 'items'];

/** Draw a small item icon. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, it: ItemDef, x: number, y: number): void {
  const c = it.icon.color;
  const c2 = it.icon.color2 ?? '#ffffff';
  ctx.fillStyle = '#000';
  switch (it.icon.shape) {
    case 'bean': ctx.fillRect(x + 1, y + 2, 7, 5); ctx.fillStyle = c; ctx.fillRect(x + 2, y + 3, 5, 3); ctx.fillStyle = '#a0e090'; ctx.fillRect(x + 3, y + 3, 2, 1); break;
    case 'cookie': ctx.fillRect(x + 1, y + 1, 7, 7); ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, 5, 5); ctx.fillStyle = '#704020'; ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + 5, y + 5, 1, 1); break;
    case 'capsule': ctx.fillRect(x + 1, y + 2, 8, 5); ctx.fillStyle = c; ctx.fillRect(x + 2, y + 3, 3, 3); ctx.fillStyle = c2; ctx.fillRect(x + 5, y + 3, 3, 3); break;
    case 'ball': ctx.beginPath(); ctx.arc(x + 4.5, y + 4.5, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 4.5, y + 4.5, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e02020'; ctx.fillRect(x + 4, y + 4, 1, 1); break;
    case 'trophy': ctx.fillRect(x + 1, y, 8, 9); ctx.fillStyle = '#f8d040'; ctx.fillRect(x + 2, y + 1, 6, 4); ctx.fillRect(x + 4, y + 5, 2, 2); ctx.fillStyle = c; ctx.fillRect(x + 3, y + 7, 4, 1); break;
    case 'fish': ctx.fillRect(x, y + 2, 9, 5); ctx.fillStyle = c; ctx.fillRect(x + 1, y + 3, 5, 3); ctx.fillRect(x + 6, y + 2, 2, 5); break;
    default: ctx.fillRect(x + 1, y + 1, 7, 7); ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, 5, 5); ctx.fillStyle = c2; ctx.fillRect(x + 3, y + 3, 2, 2);
  }
}

function starColor(s: Star): string {
  return s === 'gold' ? '#f8d030' : s === 'silver' ? '#d0d8e8' : '#d08848';
}

/** LoG2 pause menu: Status ⇄ Journal ⇄ Options ⇄ Items, L/R to cycle, opens on Status. */
export class PauseMenu implements Scene {
  readonly transparent = true;
  readonly done: Promise<void>;
  private resolve!: () => void;
  private page: Page = 'status';
  private t = 0;
  private charIdx = 0;
  private techSel = 0;
  private journalFinished = false;
  private journalSel = 0;
  private itemSel = 0;
  private optSel = 0;
  private message: string | null = null;
  private stars: Array<[number, number]> = [];

  constructor(private readonly game: Game) {
    this.done = new Promise((r) => (this.resolve = r));
    const party = this.party;
    this.charIdx = Math.max(0, party.findIndex((c) => c.id === game.state.data.active));
    for (let i = 0; i < 70; i++) this.stars.push([Math.floor(Math.random() * SCREEN_W), Math.floor(Math.random() * SCREEN_H)]);
    audio.sfx('menuOk');
  }

  private get party(): CharState[] {
    const p = this.game.state.party;
    return p.length ? p : [this.game.state.hero];
  }

  private close(): void {
    audio.sfx('menuBack');
    this.resolve();
  }

  update(input: Input): void {
    this.t++;
    if (this.message) {
      if (input.pressed('A') || input.pressed('B')) this.message = null;
      return;
    }
    if (input.pressed('start')) { this.close(); return; }
    // LoG2: from Status, L goes to Journal and R goes to Items.
    if (input.pressed('L')) { this.page = RING[(RING.indexOf(this.page) + 1) % RING.length]; audio.sfx('menuMove'); return; }
    if (input.pressed('R')) { this.page = RING[(RING.indexOf(this.page) + RING.length - 1) % RING.length]; audio.sfx('menuMove'); return; }
    if (input.pressed('B')) { this.close(); return; }
    switch (this.page) {
      case 'status': this.updateStatus(input); break;
      case 'journal': this.updateJournal(input); break;
      case 'options': this.updateOptions(input); break;
      case 'items': this.updateItems(input); break;
    }
  }

  private updateStatus(input: Input): void {
    const party = this.party;
    if (input.repeat('left')) { this.charIdx = (this.charIdx + party.length - 1) % party.length; this.techSel = 0; audio.sfx('menuMove'); }
    if (input.repeat('right')) { this.charIdx = (this.charIdx + 1) % party.length; this.techSel = 0; audio.sfx('menuMove'); }
    const c = party[this.charIdx];
    const n = this.techList(c).length;
    if (input.repeat('up') && n) { this.techSel = (this.techSel + n - 1) % n; audio.sfx('menuMove'); }
    if (input.repeat('down') && n) { this.techSel = (this.techSel + 1) % n; audio.sfx('menuMove'); }
    if (input.pressed('A') && n) {
      const [, desc] = this.techList(c)[this.techSel];
      this.message = desc;
      audio.sfx('menuOk');
    }
  }

  private techList(c: CharState): Array<[string, string]> {
    const out: Array<[string, string]> = c.techs.map((t) => [TECHNIQUES[t]?.name ?? t, `${TECHNIQUES[t]?.desc ?? ''} (EP ${TECHNIQUES[t]?.cost ?? 0})`]);
    if (c.charged) {
      const cm = CHARGED_MELEE[CHARACTERS[c.id].charged];
      out.push([cm.name, cm.desc]);
    }
    if (c.form) out.push([`Z: ${FORMS[c.form].name}`, 'Select Z with L. When the yellow triangle is full, press B to transform. EP drains while transformed; press B again to power down.']);
    return out;
  }

  private quests(): string[] {
    const j = this.game.state.data.journal;
    const want = this.journalFinished ? 'done' : 'active';
    const ids = this.game.state.data.journalOrder.filter((id) => j[id] === want && QUESTS[id]);
    // Gold first within unfinished, newest first.
    return ids.reverse().sort((a, b) => (this.journalFinished ? 0 : ['gold', 'silver', 'bronze'].indexOf(QUESTS[a].star) - ['gold', 'silver', 'bronze'].indexOf(QUESTS[b].star)));
  }

  private updateJournal(input: Input): void {
    if (input.pressed('left') || input.pressed('right')) { this.journalFinished = !this.journalFinished; this.journalSel = 0; audio.sfx('menuMove'); }
    const n = this.quests().length;
    if (input.repeat('up') && n) { this.journalSel = (this.journalSel + n - 1) % n; audio.sfx('menuMove'); }
    if (input.repeat('down') && n) { this.journalSel = (this.journalSel + 1) % n; audio.sfx('menuMove'); }
    if (input.pressed('A') && n) { this.message = QUESTS[this.quests()[this.journalSel]].desc; audio.sfx('menuOk'); }
  }

  private items(): ItemDef[] {
    const inv = this.game.state.data.inv;
    const order = ['consumable', 'capsule', 'collectible', 'key', 'trophy'];
    return Object.keys(inv).filter((k) => inv[k] > 0 && ITEMS[k]).map((k) => ITEMS[k]).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  }

  private updateItems(input: Input): void {
    const list = this.items();
    const n = list.length;
    if (input.repeat('up') && n) { this.itemSel = (this.itemSel + n - 1) % n; audio.sfx('menuMove'); }
    if (input.repeat('down') && n) { this.itemSel = (this.itemSel + 1) % n; audio.sfx('menuMove'); }
    if (!input.pressed('A') || !n) return;
    const it = list[Math.min(this.itemSel, n - 1)];
    const st = this.game.state;
    const cs = st.hero;
    const u = it.use;
    if (!u) { this.message = it.desc; audio.sfx('menuOk'); return; }
    if ('healPct' in u) {
      if (cs.hp >= cs.hpMax) { audio.sfx('denied'); this.message = 'Already at full health.'; return; }
      st.take(it.id, 1);
      cs.hp = Math.min(cs.hpMax, cs.hp + Math.max(1, Math.floor(cs.hpMax * u.healPct)));
      audio.sfx('heal');
      this.message = `${CHARACTERS[cs.id].name} ate the ${it.name}.`;
    } else if ('heal' in u) {
      if (cs.hp >= cs.hpMax && (u.ep === undefined || cs.ep >= cs.epMax)) { audio.sfx('denied'); this.message = 'Already at full strength.'; return; }
      st.take(it.id, 1);
      cs.hp = u.heal === 'full' ? cs.hpMax : Math.min(cs.hpMax, cs.hp + u.heal);
      if (u.ep !== undefined) cs.ep = u.ep === 'full' ? cs.epMax : Math.min(cs.epMax, cs.ep + u.ep);
      audio.sfx('heal');
      this.message = `${CHARACTERS[cs.id].name} used the ${it.name}.`;
    } else if ('stat' in u) {
      if (cs[u.stat] >= STAT_CAP) { audio.sfx('denied'); this.message = 'That stat is already at its limit.'; return; }
      st.take(it.id, 1);
      cs[u.stat] = Math.min(STAT_CAP, cs[u.stat] + u.amount);
      audio.sfx('levelUp');
      this.message = `${CHARACTERS[cs.id].name}'s ${u.stat.toUpperCase()} rose by ${u.amount}!`;
    } else if ('warp' in u) {
      const f = this.game.field;
      if (!f || f.def.indoor) { audio.sfx('denied'); this.message = 'It can only be used outdoors.'; return; }
      this.resolve();
      void this.game.openWorldMap();
    }
  }

  private updateOptions(input: Input): void {
    const d = this.game.state.data;
    if (input.repeat('up')) { this.optSel = (this.optSel + 3) % 4; audio.sfx('menuMove'); }
    if (input.repeat('down')) { this.optSel = (this.optSel + 1) % 4; audio.sfx('menuMove'); }
    const l = input.repeat('left');
    const r = input.repeat('right');
    if (l || r) {
      const dv = r ? 1 : -1;
      if (this.optSel === 0) { d.textSpeed = Math.max(1, Math.min(4, d.textSpeed + dv)); textSettings.speed = d.textSpeed; }
      if (this.optSel === 1) { d.musicVol = Math.max(0, Math.min(1, +(d.musicVol + dv * 0.1).toFixed(1))); audio.musicVolume = d.musicVol; }
      if (this.optSel === 2) { d.sfxVol = Math.max(0, Math.min(1, +(d.sfxVol + dv * 0.1).toFixed(1))); audio.sfxVolume = d.sfxVol; audio.sfx('menuMove'); }
    }
    if (input.pressed('A') && this.optSel === 3) { this.resolve(); this.game.toTitle(); }
  }

  // ------------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#180c30';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (const [x, y] of this.stars) {
      ctx.fillStyle = (x + y + Math.floor(this.t / 20)) % 7 === 0 ? '#ffffff' : '#6050a0';
      ctx.fillRect(x, y, 1, 1);
    }
    // Page tabs.
    const names: Record<Page, string> = { status: 'STATUS', journal: 'JOURNAL', options: 'OPTIONS', items: 'ITEMS' };
    RING.forEach((p, i) => {
      const x = 8 + i * 58;
      const on = p === this.page;
      ctx.fillStyle = on ? '#4858a0' : '#282850';
      ctx.fillRect(x, 3, 54, 12);
      ctx.fillStyle = on ? PAL.uiFrame : '#404070';
      ctx.fillRect(x, 3, 54, 1);
      font.drawCentered(ctx, names[p], x + 27, 5, on ? PAL.gold : '#9090c0', '#000');
    });
    font.drawRight(ctx, 'L', SCREEN_W - 1, 5, '#9090c0');
    font.draw(ctx, 'R', 1, 5, '#9090c0');
    switch (this.page) {
      case 'status': this.renderStatus(ctx); break;
      case 'journal': this.renderJournal(ctx); break;
      case 'options': this.renderOptions(ctx); break;
      case 'items': this.renderItems(ctx); break;
    }
    if (this.message) {
      const lines = wrap(this.message, 200);
      const h = lines.length * 11 + 10;
      drawWindow(ctx, 16, SCREEN_H - h - 6, SCREEN_W - 32, h);
      font.drawLines(ctx, lines, 24, SCREEN_H - h, PAL.white, '#000', 11);
    }
  }

  private statBar(ctx: CanvasRenderingContext2D, label: string, v: number, x: number, y: number): void {
    font.draw(ctx, label, x, y, PAL.white, '#000');
    const bx = x + 26;
    const w = 70;
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 1, y, w + 2, 8);
    const segs = 20;
    const filled = Math.round((Math.min(v, STAT_CAP) / STAT_CAP) * segs);
    for (let i = 0; i < segs; i++) {
      const k = i / segs;
      const col = i < filled ? `rgb(${Math.round(232 + 16 * k)},${Math.round(56 + 160 * k)},${Math.round(40)})` : '#2a2040';
      ctx.fillStyle = col;
      ctx.fillRect(bx + i * 3.5, y + 1, 3, 6);
    }
    font.drawRight(ctx, `${v}/${STAT_CAP}`, bx + w + 38, y, PAL.white, '#000');
  }

  private renderStatus(ctx: CanvasRenderingContext2D): void {
    const party = this.party;
    const c = party[Math.min(this.charIdx, party.length - 1)];
    const def = CHARACTERS[c.id as CharId];
    drawWindow(ctx, 4, 18, 232, 138, { fill: '#202848' });
    font.draw(ctx, def.name.toUpperCase(), 12, 24, def.color, '#000');
    font.draw(ctx, `LEVEL: ${c.level}`, 84, 24, PAL.white, '#000');
    if (party.length > 1) {
      font.draw(ctx, '▶', 226, 24, this.t % 30 < 15 ? PAL.gold : PAL.white, '#000');
      ctx.save(); ctx.translate(14, 0); ctx.scale(-1, 1); font.draw(ctx, '▶', -142, 24, this.t % 30 < 15 ? PAL.gold : PAL.white, '#000'); ctx.restore();
    }
    // HP / EP.
    font.draw(ctx, 'HP', 12, 38, PAL.white, '#000');
    ctx.fillStyle = '#000'; ctx.fillRect(31, 39, 72, 7);
    ctx.fillStyle = '#e83828'; ctx.fillRect(32, 40, Math.round(70 * c.hp / c.hpMax), 5);
    font.draw(ctx, `${c.hp}/${c.hpMax}`, 108, 38, PAL.white, '#000');
    font.draw(ctx, 'EP', 12, 50, PAL.white, '#000');
    ctx.fillStyle = '#000'; ctx.fillRect(31, 51, 72, 7);
    ctx.fillStyle = '#38c848'; ctx.fillRect(32, 52, Math.round(70 * c.ep / c.epMax), 5);
    font.draw(ctx, `${c.ep}/${c.epMax}`, 108, 50, PAL.white, '#000');
    this.statBar(ctx, 'STR', c.str, 12, 64);
    this.statBar(ctx, 'POW', c.pow, 12, 76);
    this.statBar(ctx, 'END', c.end, 12, 88);
    // Portrait + EXP.
    const por = portrait(c.outfit ?? def.sprite, 'neutral');
    ctx.fillStyle = '#000'; ctx.fillRect(183, 34, 36, 40);
    ctx.fillStyle = '#304070'; ctx.fillRect(185, 36, 32, 36);
    if (por) ctx.drawImage(por, 185, 36);
    font.draw(ctx, 'EXP', 160, 80, '#a8c8f8', '#000');
    font.drawRight(ctx, String(c.exp), 230, 80, PAL.white, '#000');
    if (c.level < MAX_LEVEL) {
      font.draw(ctx, 'NEXT', 160, 91, '#a8c8f8', '#000');
      font.drawRight(ctx, String(expToNext(c.level, c.exp)), 230, 91, PAL.white, '#000');
    }
    // Techniques.
    const techs = this.techList(c);
    ctx.fillStyle = '#101830';
    ctx.fillRect(10, 102, 220, 50);
    font.draw(ctx, 'TECHNIQUES', 14, 104, PAL.gold, '#000');
    const start = Math.max(0, Math.min(this.techSel - 2, techs.length - 3));
    techs.slice(start, start + 3).forEach(([name], i) => {
      const idx = start + i;
      font.draw(ctx, name, 24, 115 + i * 11, idx === this.techSel ? PAL.gold : PAL.white, '#000');
      if (idx === this.techSel) font.draw(ctx, '▶', 14, 115 + i * 11, PAL.gold, '#000');
    });
    if (c.trophy) font.drawRight(ctx, '★ Trophy', 226, 104, def.color, '#000');
  }

  private renderJournal(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 4, 18, 232, 138, { fill: '#202848' });
    const tabs = ['UNFINISHED', 'FINISHED'];
    tabs.forEach((t, i) => font.drawCentered(ctx, t, 62 + i * 116, 24, (i === 1) === this.journalFinished ? PAL.gold : '#7078a8', '#000'));
    const qs = this.quests();
    if (!qs.length) { font.drawCentered(ctx, 'No entries.', SCREEN_W / 2, 80, '#9098c0', '#000'); return; }
    const start = Math.max(0, Math.min(this.journalSel - 4, qs.length - 10));
    qs.slice(start, start + 10).forEach((id, i) => {
      const q = QUESTS[id];
      const y = 38 + i * 11;
      const idx = start + i;
      if (this.journalFinished) font.draw(ctx, '♥', 12, y, '#60e060', '#000');
      else font.draw(ctx, '★', 12, y, starColor(q.star), '#000');
      const title = q.title.length > 44 ? `${q.title.slice(0, 43)}...` : q.title;
      font.draw(ctx, title, 22, y, idx === this.journalSel ? PAL.gold : PAL.white, '#000');
    });
    font.drawCentered(ctx, '◀ ▶ switch   A: details', SCREEN_W / 2, 146, '#7078a8');
  }

  private renderItems(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 4, 18, 232, 138, { fill: '#202848' });
    const list = this.items();
    if (!list.length) { font.drawCentered(ctx, 'No items.', SCREEN_W / 2, 80, '#9098c0', '#000'); return; }
    const sel = Math.min(this.itemSel, list.length - 1);
    const start = Math.max(0, Math.min(sel - 4, list.length - 8));
    list.slice(start, start + 8).forEach((it, i) => {
      const y = 26 + i * 12;
      const idx = start + i;
      drawItemIcon(ctx, it, 14, y);
      font.draw(ctx, it.name, 28, y, idx === sel ? PAL.gold : PAL.white, '#000');
      const n = this.game.state.count(it.id);
      if (it.max > 1) font.drawRight(ctx, `${n}/${it.max}`, 226, y, PAL.white, '#000');
    });
    const it = list[sel];
    ctx.fillStyle = '#101830';
    ctx.fillRect(10, 124, 220, 28);
    font.drawLines(ctx, wrap(it.desc, 210).slice(0, 2), 14, 127, '#c8d0f0', '#000', 11);
  }

  private renderOptions(ctx: CanvasRenderingContext2D): void {
    const d = this.game.state.data;
    drawWindow(ctx, 4, 18, 232, 138, { fill: '#202848' });
    const rows: Array<[string, string]> = [
      ['Text Speed', ['', 'Slow', 'Normal', 'Fast', 'Instant'][d.textSpeed]],
      ['Music Volume', `${Math.round(d.musicVol * 10)}`],
      ['Sound FX Volume', `${Math.round(d.sfxVol * 10)}`],
      ['Quit to Title', ''],
    ];
    rows.forEach(([k, v], i) => {
      const y = 36 + i * 16;
      font.draw(ctx, k, 30, y, i === this.optSel ? PAL.gold : PAL.white, '#000');
      if (v) font.drawRight(ctx, `< ${v} >`, 220, y, PAL.white, '#000');
      if (i === this.optSel) font.draw(ctx, '▶', 18, y, PAL.gold, '#000');
    });
    const secs = Math.floor(d.playFrames / 60);
    font.draw(ctx, `Play time ${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}`, 30, 118, '#9098c0', '#000');
    font.draw(ctx, `Delicacies ${this.game.state.count('delicacy')}/25   Scouter scans ${d.scans.length}`, 30, 130, '#9098c0', '#000');
  }
}
