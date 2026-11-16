// Falling pickups: cyan chevron = one shield cell, cyan diamond = 500 points.

import { PICKUPS, PALETTE } from './config.js';
import { circleHitsRect } from './collision.js';

export const PICKUP_TYPES = Object.freeze({
  shield: 'shield',
  core: 'core',
});

export function spawnPickup(pool, type, x, y) {
  const pickup = pool.spawn();
  if (!pickup) return null;

  pickup.type = type === PICKUP_TYPES.core ? PICKUP_TYPES.core : PICKUP_TYPES.shield;
  pickup.x = x;
  pickup.y = y;
  pickup.vx = 0;
  pickup.vy = PICKUPS.fallSpeed;
  pickup.radius = PICKUPS.radius;
  pickup.age = 0;
  pickup.spin = 0;
  pickup.active = true;

  return pickup;
}

export function updatePickup(pickup, dt, field) {
  if (!pickup.active) return pickup;
  pickup.age += dt;
  pickup.spin += dt * 2.2;
  pickup.y += PICKUPS.fallSpeed * dt;
  if (pickup.y - pickup.radius > field.h) {
    pickup.active = false;
  }
  return pickup;
}

export function pickupTouchesShip(pickup, ship) {
  if (!pickup.active) return false;
  const rect = {
    x: ship.x - ship.w * 0.5,
    y: ship.y - ship.h * 0.5,
    w: ship.w,
    h: ship.h,
  };
  return circleHitsRect(pickup.x, pickup.y, pickup.radius + 6, rect);
}

export function drawPickup(ctx, pickup) {
  if (!pickup.active) return;

  const { x, y } = pickup;
  const r = pickup.radius;
  const pulse = 1 + Math.sin(pickup.age * 6) * 0.08;

  // Pickups are GOLD — a disk with a spinning ring, never a cyan diamond. Cyan belongs to the
  // player's fire, so a collectible must not be mistakable for a shot.
  const GOLD = '#ffd166';
  const GOLD_HOT = '#fff3cf';

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';

  // Soft glow behind the glyph.
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.7);
  halo.addColorStop(0, 'rgba(255, 209, 102, 0.48)');
  halo.addColorStop(0.5, 'rgba(255, 209, 102, 0.14)');
  halo.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.scale(pulse, pulse);

  // A slowly rotating outer ring, so the pickup reads as an object that wants collecting.
  ctx.save();
  ctx.rotate(pickup.age * 1.4);
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([r * 0.55, r * 0.42]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.lineWidth = 3;
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = 'rgba(255, 209, 102, 0.20)';
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 16;

  // Both pickup kinds are six-sided, so they are never confused with a projectile's silhouette.
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(a) * r * 0.98;
    const py = Math.sin(a) * r * 0.98;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (pickup.type === PICKUP_TYPES.core) {
    // Shield cell: a solid core with an inner ring.
    ctx.fillStyle = GOLD_HOT;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.40, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(60, 34, 0, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.40, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Overdrive: an upward lightning wedge, distinct from the cell at a glance.
    ctx.fillStyle = GOLD_HOT;
    ctx.beginPath();
    ctx.moveTo(-r * 0.26, -r * 0.44);
    ctx.lineTo(r * 0.30, -r * 0.12);
    ctx.lineTo(r * 0.04, -r * 0.04);
    ctx.lineTo(r * 0.26, r * 0.46);
    ctx.lineTo(-r * 0.30, r * 0.10);
    ctx.lineTo(-r * 0.04, r * 0.02);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
