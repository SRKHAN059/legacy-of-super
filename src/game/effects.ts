import { PAL } from '../art/color';
import { font } from '../engine/gfx';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'dot' | 'spark' | 'ring' | 'boom' | 'dust' | 'flash' | 'beamEnd';
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

/** Particles, explosions and floating damage/heal numbers. */
export class Effects {
  private parts: Particle[] = [];
  private floaters: Floater[] = [];

  /** Impact spark burst at a point. */
  hit(x: number, y: number, color = '#ffffff', n = 6): void {
    this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 8, max: 8, color: '#ffffff', size: 7, kind: 'flash' });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const sp = 1 + Math.random() * 1.6;
      this.parts.push({ x, y, z: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0, life: 10 + (i % 4), max: 14, color, size: 2, kind: 'spark' });
    }
  }

  /** Explosion with expanding ring and debris. */
  explode(x: number, y: number, radius = 16, color = '#f8c040'): void {
    this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 18, max: 18, color, size: radius, kind: 'boom' });
    this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 14, max: 14, color: '#ffffff', size: radius, kind: 'ring' });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2;
      this.parts.push({ x, y, z: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: 1 + Math.random() * 2, life: 20 + Math.random() * 10, max: 30, color: i % 2 ? color : '#a08060', size: 2, kind: 'dot' });
    }
  }

  /** Small dust puff at the feet (running, landing). */
  dust(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      this.parts.push({ x: x + (Math.random() * 8 - 4), y, z: 0, vx: Math.random() - 0.5, vy: -0.2, vz: 0.3, life: 14, max: 14, color: '#d8d0c0', size: 2, kind: 'dust' });
    }
  }

  /** Rising aura sparks around a body (charging / transformed). */
  aura(x: number, y: number, color: string, intensity = 1): void {
    const n = intensity > 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      this.parts.push({ x: x + (Math.random() * 18 - 9), y: y - Math.random() * 6, z: Math.random() * 10, vx: 0, vy: 0, vz: 0.8 + Math.random() * 0.8 * intensity, life: 16, max: 16, color, size: 1 + (Math.random() < 0.3 ? 1 : 0), kind: 'dot' });
    }
  }

  /** Floating number above a point. */
  number(x: number, y: number, n: number | string, color: string = PAL.red): void {
    this.floaters.push({ x, y, text: String(n), color, life: 40 });
  }

  /** Remove everything (map change). */
  clear(): void {
    this.parts = [];
    this.floaters = [];
  }

  update(): void {
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      if (p.kind === 'dot') { p.vz -= 0.12; if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; } }
      if (p.kind === 'spark') { p.vx *= 0.85; p.vy *= 0.85; }
      p.life--;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life--;
      if (f.life > 25) f.y -= 0.6;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  render(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (const p of this.parts) {
      const x = Math.round(p.x - cx);
      const y = Math.round(p.y - cy - p.z);
      const k = p.life / p.max;
      switch (p.kind) {
        case 'dot':
        case 'spark':
        case 'dust':
          ctx.globalAlpha = p.kind === 'dust' ? k * 0.7 : 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, p.size, p.size);
          ctx.globalAlpha = 1;
          break;
        case 'flash': {
          const s = Math.round(p.size * k);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - s, y - 1, s * 2 + 1, 3);
          ctx.fillRect(x - 1, y - s, 3, s * 2 + 1);
          break;
        }
        case 'boom': {
          const r = Math.round(p.size * (1.2 - k * 0.5));
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff8d0';
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, r * 0.55 * k), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'ring': {
          const r = Math.round(p.size * (1.6 - k));
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'beamEnd':
          break;
      }
    }
    for (const f of this.floaters) {
      if (f.life < 8 && f.life % 2) continue;
      font.drawCentered(ctx, f.text, Math.round(f.x - cx), Math.round(f.y - cy), f.color, '#000');
    }
  }
}
