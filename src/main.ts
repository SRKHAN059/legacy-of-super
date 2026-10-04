import './content';
import { SCREEN_H, SCREEN_W } from './engine/constants';
import { audio } from './engine/audio';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { showCreatures, showGallery, showPortraits } from './debug/gallery';
import { Game } from './game/game';
import type { CharId } from './content/characters';
import { textSettings } from './ui/dialogue';
import { IntroScene } from './ui/intro';
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

/**
 * Space the on-screen controls take on a touch screen: in landscape the two clusters' width on each side, in
 * portrait their height along the bottom. The game screen is laid out in what is left, so the controls never
 * cover the play field, the dialogue box or the HUD.
 */
function touchReserve(): { side: number; bottom: number } {
  const left = document.querySelector('#touch .cluster.left')?.getBoundingClientRect();
  const right = document.querySelector('#touch .cluster.right')?.getBoundingClientRect();
  if (!left || !right || !left.width || !right.width) return { side: 0, bottom: 0 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const gap = 6;
  if (w > h) return { side: Math.ceil(Math.max(left.right, w - right.left)) + gap, bottom: 0 };
  return { side: 0, bottom: Math.ceil(h - Math.min(left.top, right.top)) + gap };
}

/** Fit the 240x160 canvas to the window, preferring integer scale for crisp pixels. */
function fit(): void {
  if (!canvas) return;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const shell = document.getElementById('shell');
  const reserve = touch ? touchReserve() : { side: 0, bottom: 0 };
  if (shell) shell.style.padding = `0 ${reserve.side}px ${reserve.bottom}px`;
  const availW = window.innerWidth - (touch ? 0 : 32) - reserve.side * 2;
  const availH = window.innerHeight - (touch ? 0 : 32) - reserve.bottom;
  const raw = Math.max(0.5, Math.min(availW / SCREEN_W, availH / SCREEN_H));
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

// Dev entry: ?map=<id>&x=<tile>&y=<tile>&char=<id>&lv=<n>&chapter=<n>&flags=a,b&scouter ; ?nointro boots to the title.
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
} else if (params.has('nointro')) {
  game.toTitle();
} else {
  // Cold boot: fan-project splash and the story opening, then the title (A / Start skips to it at any point).
  game.scenes.replace(new IntroScene(game, { splash: true }));
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
