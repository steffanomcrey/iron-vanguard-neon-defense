// The mech the player pilots: movement, firing cadence, shield budget and the
// invulnerability window after a hit. Reads input, writes its own rect — no
// rendering decisions live here.

import { SHIP, BULLET, FIELD } from './config.js';

export function createShip() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height - 96,
    width: SHIP.width,
    height: SHIP.height,
    shields: SHIP.startShields,
    cooldown: 0,
    invulnerable: 0,
    enginePhase: 0,
    alive: true,
  };
}

export function shipRect(ship) {
  return {
    x: ship.x - ship.width / 2,
    y: ship.y - ship.height / 2,
    width: ship.width,
    height: ship.height,
  };
}

/** Advance the mech one fixed step. Returns the shots fired this step. */
export function updateShip(ship, input, dt, bullets) {
  const shots = [];

  if (input.left && !input.right) ship.x -= SHIP.speed * dt;
  else if (input.right && !input.left) ship.x += SHIP.speed * dt;
  else if (input.pointerX !== null) {
    // Pointer steering eases toward the cursor so the mech never snaps.
    const delta = input.pointerX - ship.x;
    const maxStep = SHIP.speed * dt;
    ship.x += Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep;
  }

  const half = ship.width / 2;
  ship.x = Math.max(half, Math.min(FIELD.width - half, ship.x));

  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
  ship.cooldown = Math.max(0, ship.cooldown - dt);
  ship.enginePhase += dt * 18;

  if (input.firing && ship.cooldown === 0 && ship.alive) {
    ship.cooldown = SHIP.fireCooldown;
    const muzzle = ship.y - ship.height / 2;
    for (const offset of [-13, 13]) {
      const shot = bullets.spawn();
      if (!shot) break;
      shot.x = ship.x + offset;
      shot.y = muzzle - BULLET.height / 2;
      shot.width = BULLET.width;
      shot.height = BULLET.height;
      shot.vy = -BULLET.speed;
      shot.fromEnemy = false;
    }
    shots.push(muzzle);
  }

  return shots;
}

/** Apply one hit. Returns true when the mech actually lost a shield. */
export function damageShip(ship) {
  if (ship.invulnerable > 0 || !ship.alive) return false;
  ship.shields -= 1;
  ship.invulnerable = SHIP.invulnerableAfterHit;
  if (ship.shields <= 0) {
    ship.shields = 0;
    ship.alive = false;
  }
  return true;
}
