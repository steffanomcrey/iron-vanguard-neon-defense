// Debris. Small, cheap, additive-blended.

import { PARTICLES } from './config.js';

export function emitBurst(pool, x, y, count, colour, rand) {
  const n = Math.max(0, Math.floor(count));
  let emitted = 0;

  for (let i = 0; i < n; i += 1) {
    const p = pool.spawn();
    if (!p) break;

    const angle = rand.range(0, Math.PI * 2);
    const speed = rand.range(60, 320);

    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = PARTICLES.life * rand.range(0.6, 1.25);
    p.maxLife = p.life;
    p.size = rand.range(1.4, 3.6);
    p.colour = colour;
    p.active = true;
    emitted += 1;
  }

  return emitted;
}

export function updateParticle(p, dt) {
  if (!p.active) return p;

  p.life -= dt;
  if (p.life <= 0) {
    p.active = false;
    return p;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Drag plus a whisper of gravity so debris settles rather than drifting forever.
  const drag = Math.min(1, 2.6 * dt);
  p.vx -= p.vx * drag;
  p.vy -= p.vy * drag;
  p.vy += 26 * dt;

  return p;
}

export function drawParticle(ctx, p) {
  if (!p.active || p.life <= 0) return;

  const t = Math.max(0, Math.min(1, p.life / p.maxLife));

  ctx.globalAlpha = t * 0.95;
  ctx.fillStyle = p.colour;
  const r = p.size * (0.4 + t * 0.8);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
