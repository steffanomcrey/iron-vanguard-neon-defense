// The player mech: acceleration + friction steering, shields, invulnerability window.

import { SHIP, FIELD } from './config.js';
import { clamp } from './collision.js';

export function createShip() {
  return {
    x: FIELD.w * 0.5,
    y: FIELD.h - 150,
    w: SHIP.w,
    h: SHIP.h,
    vx: 0,
    vy: 0,
    shields: SHIP.shields,
    maxShields: SHIP.maxShields,
    fireTimer: 0,
    invuln: 0,
    alive: true,
    thrust: 0,
  };
}

export function shipRect(ship) {
  return {
    x: ship.x - ship.w * 0.5,
    y: ship.y - ship.h * 0.5,
    w: ship.w,
    h: ship.h,
  };
}

export function updateShip(ship, input, dt, field) {
  const target = input.pointerActive
    ? clamp(input.pointerX, SHIP.w * 0.5, field.w - SHIP.w * 0.5)
    : ship.x;

  let drive = 0;
  if (input.left && !input.right) drive -= 1;
  else if (input.right && !input.left) drive += 1;

  if (input.pointerActive && drive === 0) {
    const delta = target - ship.x;
    if (Math.abs(delta) > 2) drive = clamp(delta / 120, -1, 1);
  }

  const accel = 4200;
  const friction = 9.5;

  if (drive !== 0) {
    ship.vx += accel * drive * dt;
  }

  // Exponential friction keeps steering from feeling like ice.
  ship.vx -= ship.vx * Math.min(1, friction * dt);
  ship.vx = clamp(ship.vx, -SHIP.speed, SHIP.speed);

  ship.x += ship.vx * dt;

  const half = SHIP.w * 0.5;
  if (ship.x < half) {
    ship.x = half;
    ship.vx = 0;
  } else if (ship.x > field.w - half) {
    ship.x = field.w - half;
    ship.vx = 0;
  }

  const halfH = SHIP.h * 0.5;
  ship.y = clamp(ship.y, halfH + 40, field.h - halfH - 8);

  ship.thrust = clamp(Math.abs(ship.vx) / SHIP.speed, 0, 1);

  ship.fireTimer = Math.max(0, ship.fireTimer - dt);
  ship.invuln = Math.max(0, ship.invuln - dt);

  return ship;
}

export function damageShip(ship) {
  if (ship.invuln > 0 || !ship.alive) return false;
  ship.shields -= 1;
  ship.invuln = SHIP.invuln;
  if (ship.shields <= 0) {
    ship.shields = 0;
    ship.alive = false;
    return true;
  }
  return false;
}

export function grantShip(ship, shields) {
  const before = ship.shields;
  ship.shields = clamp(ship.shields + shields, 0, ship.maxShields);
  return ship.shields - before;
}
