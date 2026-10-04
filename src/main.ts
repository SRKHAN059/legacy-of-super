import './content';
import { SCREEN_H, SCREEN_W } from './engine/constants';
import { audio } from './engine/audio';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { showCreatures, showGallery, showPortraits } from './debug/gallery';
import { Game } from './game/game';
import type { CharId } from './content/characters';
import { textSettings } from './ui/dialogue';
import { installHarness } from './debug/harness';

const params = new URLSearchParams(location.search);
if (params.has('creatures')) {
  showCreatures();
  throw new Error('creature mode');
}
if (params.has('portraits')) {
  showPortraits();
  throw new Error('portrait mode');
}
if (params.has('gallery')) {
  showGallery(params.get('gallery') ?? '');
  throw new Error('gallery mode');
}

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#screen canvas missing');
const ctx = canvas.getContext('2d', { alpha: false });
if (!ctx) throw new Error('2D canvas context unavailable');
ctx.imageSmoothingEnabled = false;

/** Fit the 240x160 canvas to the window, preferring integer scale for crisp pixels. */
function fit(): void {
  if (!canvas) return;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const availW = window.innerWidth - (touch ? 0 : 32);
  const availH = window.innerHeight - (touch ? 0 : 32);
  const raw = Math.min(availW / SCREEN_W, availH / SCREEN_H);
  const scale = raw >= 2 && !touch ? Math.floor(raw) : raw;
  canvas.style.width = `${Math.floor(SCREEN_W * scale)}px`;
  canvas.style.height = `${Math.floor(SCREEN_H * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

const input = new Input();
input.onFirstGesture = () => audio.unlock();
canvas.addEventListener('pointerdown', () => audio.unlock());
const game = new Game(input);

// Dev entry: ?map=<id>&x=<tile>&y=<tile>&char=<id>&lv=<n>&chapter=<n>&flags=a,b&scouter
const devMap = params.get('map');
if (devMap) {
  const st = game.state;
  const ch = (params.get('char') ?? 'goku') as CharId;
  const lv = parseInt(params.get('lv') ?? '5', 10);
  st.data.chapter = parseInt(params.get('chapter') ?? '1', 10);
  for (const f of (params.get('flags') ?? '').split(',').filter(Boolean)) st.set(f);
  st.join(ch, lv);
  st.data.active = ch;
  if (params.has('scouter')) st.give('scouter', 1, 1);
  game.startField(devMap, parseFloat(params.get('x') ?? '5'), parseFloat(params.get('y') ?? '5'), 'down');
} else {
  game.toTitle();
}
textSettings.speed = game.state.data.textSpeed;

const loop = new Loop(
  () => {
    input.poll();
    game.scenes.update(input);
  },
  () => game.scenes.render(ctx),
);
loop.start();

// Expose for automated play-testing from the browser console.
const w = window as unknown as Record<string, unknown>;
w.__game = game;
w.__loop = loop;
w.__input = input;
installHarness(game, input);
