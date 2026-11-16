// Pickups that drift down from a destroyed drone: shield cells top the mech's
// defence back up, cores are a flat score bonus. Both pulse so they read as
// collectable at a glance instead of blending into the debris.

import { PICKUP, PALETTE } from './config.js';
import { circlesOverlap } from './collision.js';

export function spawnPickup(pool, spec) {
  const item = pool.spawn();
  if (!item) return null;
  item.kind = spec.kind;
  item.x = spec.x;
  item.y = spec.y;
  item.radius = PICKUP.radius;
  item.phase = spec.x * 0.01;
  return item;
}

export function updatePickup(item, dt) {
  item.y += PICKUP.speed * dt;
  item.phase += dt * 4;
}

export function pickupTouchesShip(item, ship) {
  return circlesOverlap(item.x, item.y, item.radius, ship.x, ship.y, ship.width * 0.42);
}

/** Draw one pickup as a spinning diamond in its own colour. */
export function drawPickup(ctx, item) {
  const pulse = 1 + Math.sin(item.phase) * 0.14;
  const size = item.radius * pulse;
  const colour = item.kind === 'shield' ? PALETTE.health : PALETTE.gold;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.phase * 0.6);
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18;

  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size, 0);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.9;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.fillStyle = PALETTE.void;
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.kind === 'shield' ? '+' : '★', 0, 1);
  ctx.restore();
}
