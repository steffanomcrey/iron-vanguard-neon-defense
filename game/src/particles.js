// Particle bursts: one short-lived struct used for engine trails, muzzle
// flashes, shield breaks and drone explosions. All additive, all cheap, and
// pooled so even a ten-wave finale stays inside the frame budget.

import { PARTICLE } from './config.js';

export function emitBurst(pool, x, y, count, colour, speed, spread = Math.PI * 2, heading = 0) {
  for (let i = 0; i < count; i += 1) {
    const p = pool.spawn();
    if (!p) return;
    const angle = heading + (Math.random() - 0.5) * spread;
    const velocity = speed * (0.35 + Math.random() * 0.65);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * velocity;
    p.vy = Math.sin(angle) * velocity;
    p.life = 1;
    p.decay = 1.1 + Math.random() * 1.4;
    p.size = 2 + Math.random() * 3.2;
    p.colour = colour;
  }
}

export function updateParticle(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= PARTICLE.drag;
  p.vy = p.vy * PARTICLE.drag + PARTICLE.gravity * dt;
  p.life -= dt * p.decay;
}

export function drawParticle(ctx, p) {
  const alpha = p.life < 0 ? 0 : p.life;
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = p.colour;
  const size = p.size * (0.4 + alpha * 0.6);
  ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
}
