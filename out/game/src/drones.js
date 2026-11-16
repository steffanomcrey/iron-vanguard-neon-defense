// Drone archetypes and how they fly. Each kind has its own silhouette, speed,
// health and firing rhythm, so a mixed swarm forces three different dodges at
// once instead of one repeated pattern.

import { DRONE, FIELD } from './config.js';
import { clamp } from './collision.js';

export function spawnDrone(pool, kind, x, y, rand) {
  const spec = DRONE.kinds[kind];
  const drone = pool.spawn();
  if (!drone) return null;
  drone.kind = kind;
  drone.hp = spec.hp;
  drone.maxHp = spec.hp;
  drone.radius = spec.radius;
  drone.points = spec.points;
  drone.x = x;
  drone.y = y;
  drone.vy = spec.speed;
  drone.baseX = x;
  drone.phase = rand() * Math.PI * 2;
  drone.weave = spec.weave;
  drone.flash = 0;
  drone.cooldown = DRONE.fireInterval[kind] * (0.4 + rand() * 0.6);
  drone.spin = rand() * Math.PI * 2;
  return drone;
}

/** Move one drone. Returns a shot request when it fires this step. */
export function updateDrone(drone, dt, elapsed) {
  const spec = DRONE.kinds[drone.kind];
  drone.y += drone.vy * dt;
  drone.spin += dt * 1.7;

  if (drone.weave > 0) {
    // Sine weave around its entry column: readable, but it breaks straight aim.
    drone.x = drone.baseX + Math.sin(elapsed * 2.1 + drone.phase) * drone.weave;
    drone.x = clamp(drone.x, drone.radius, FIELD.width - drone.radius);
  }

  drone.flash = Math.max(0, drone.flash - dt * 4);
  drone.cooldown -= dt;

  if (drone.cooldown <= 0 && drone.y > 60 && drone.y < FIELD.height * 0.72) {
    drone.cooldown = DRONE.fireInterval[drone.kind];
    return { x: drone.x, y: drone.y + drone.radius, speed: DRONE.bulletSpeed };
  }
  void spec;
  return null;
}

/** Returns true when this hit destroyed the drone. */
export function hitDrone(drone, damage) {
  drone.hp -= damage;
  drone.flash = 1;
  return drone.hp <= 0;
}

/** Aim a drone shot at the mech so the threat is aimed, not random. */
export function aimAt(drone, targetX, targetY) {
  const dx = targetX - drone.x;
  const dy = targetY - drone.y;
  const length = Math.hypot(dx, dy) || 1;
  return { dx: dx / length, dy: dy / length };
}
