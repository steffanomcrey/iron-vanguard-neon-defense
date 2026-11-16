// Hostile drones: three archetypes, one pool, sine weave on the way down.

import { DRONE } from './config.js';

export function spawnDrone(pool, kind, x, y, rand) {
  const stats = DRONE.kinds[kind];
  if (!stats) return null;

  const drone = pool.spawn();
  if (!drone) return null;

  drone.kind = kind;
  drone.stats = stats;
  drone.x = x;
  drone.y = y;
  drone.baseX = x;
  drone.w = stats.radius * 2;
  drone.h = stats.radius * 2;
  drone.vx = 0;
  drone.vy = stats.speed;
  drone.hp = stats.hp;
  drone.maxHp = stats.hp;
  drone.radius = stats.radius;
  drone.score = stats.score;
  drone.fireInterval = stats.fireInterval;
  // Stagger the first shot so a wave never fires in unison.
  drone.fireTimer = rand.range(0, stats.fireInterval);
  drone.phase = rand.range(0, Math.PI * 2);
  drone.age = 0;
  drone.flash = 0;
  drone.active = true;

  return drone;
}

export function updateDrone(drone, dt, field) {
  if (!drone.active) return drone;

  drone.age += dt;
  drone.y += drone.stats.speed * dt;
  drone.x = drone.baseX + Math.sin(drone.age * 1.15 + drone.phase) * drone.stats.weave;

  const pad = drone.radius;
  if (drone.x < pad) drone.x = pad;
  if (drone.x > field.w - pad) drone.x = field.w - pad;

  drone.fireTimer -= dt;
  drone.flash = Math.max(0, drone.flash - dt);

  if (drone.y > field.h + drone.radius * 2) {
    drone.active = false;
  }

  return drone;
}

export function hitDrone(drone, damage) {
  drone.hp -= damage;
  drone.flash = 0.12;
  if (drone.hp <= 0) {
    drone.active = false;
    return true;
  }
  return false;
}
