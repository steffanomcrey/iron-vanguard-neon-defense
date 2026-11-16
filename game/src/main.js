// Boot and the fixed-step loop. The simulation always advances in 1/60 s
// slices no matter the display refresh rate, so physics and scoring behave
// identically on a 60 Hz laptop, a 144 Hz monitor and a headless screenshot
// run — which is what keeps a captured frame reproducible.

import { STEP, FIELD, SHIP, BULLET, DRONE, ENEMY_BULLET, PICKUP, PARTICLE, BEST_KEY } from './config.js';
import { createInput } from './input.js';
import { createPool } from './pools.js';
import { createRandom } from './random.js';
import { createShip, updateShip, damageShip, shipRect } from './ship.js';
import { updateDrone, hitDrone, aimAt } from './drones.js';
import { createDirector, advanceDirector } from './waves.js';
import { createScore, updateScore, registerKill, completeWave, resetWaveWatch, rollPickup } from './score.js';
import { spawnPickup, updatePickup, pickupTouchesShip } from './pickups.js';
import { emitBurst, updateParticle } from './particles.js';
import { circlesOverlap, circleHitsRect } from './collision.js';
import { createRenderer, fitCanvas, drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { drawOverlays } from './screens.js';
import { readShotPose, applyShotPose } from './shots.js';
import { PALETTE } from './config.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');

/** Screenshot poses hold the world still, so a captured frame never drifts. */
const shotPose = readShotPose();

function readSeed() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 20260101;
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* storage can be blocked in private windows; the score still counts. */
  }
}

const renderer = createRenderer(canvas);
const rand = createRandom(readSeed());
const input = createInput(canvas, FIELD);

const world = {
  mode: 'title',
  elapsed: 0,
  ship: createShip(),
  bullets: createPool(BULLET.poolSize, () => ({})),
  drones: createPool(DRONE.poolSize, () => ({})),
  pickups: createPool(PICKUP.poolSize, () => ({})),
  particles: createPool(PARTICLE.poolSize, () => ({})),
  director: createDirector(rand),
  score: createScore(),
  rand,
};

world.score.best = readBest();

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function resetWorld() {
  world.ship = createShip();
  world.bullets.clear();
  world.drones.clear();
  world.pickups.clear();
  world.particles.clear();
  world.director = createDirector(rand);
  world.score = createScore();
  world.score.best = readBest();
  world.elapsed = 0;
  resetWaveWatch(world.score, world.ship.shields);
  announce('Wave 1 incoming. Three shields.');
}

function startRun() {
  resetWorld();
  world.mode = 'playing';
}

function fireEnemyShot(drone) {
  const shot = world.bullets.spawn();
  if (!shot) return;
  const aim = aimAt(drone, world.ship.x, world.ship.y);
  shot.x = drone.x;
  shot.y = drone.y + drone.radius;
  shot.width = ENEMY_BULLET.radius * 2;
  shot.height = ENEMY_BULLET.radius * 2;
  shot.vx = aim.dx * ENEMY_BULLET.speed;
  shot.vy = aim.dy * ENEMY_BULLET.speed;
  shot.fromEnemy = true;
}

function explodeDrone(drone) {
  emitBurst(world.particles, drone.x, drone.y, drone.kind === 'bulwark' ? 26 : 14,
    DRONE.kinds[drone.kind].colour, 340);
  registerKill(world.score, drone.points, drone.x, drone.y);

  const drop = rollPickup(rand, world.ship.shields, drone.x, drone.y);
  if (drop) spawnPickup(world.pickups, drop);
}

function stepBullets(dt) {
  world.bullets.forEachActive((b) => {
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (b.y < -40 || b.y > FIELD.height + 40 || b.x < -40 || b.x > FIELD.width + 40) {
      b.active = false;
    }
  });
}

function resolveBulletHits() {
  const shipBox = shipRect(world.ship);

  world.bullets.forEachActive((b) => {
    if (b.fromEnemy) {
      if (circleHitsRect(b.x, b.y, 7, shipBox) && damageShip(world.ship)) {
        b.active = false;
        emitBurst(world.particles, b.x, b.y, 16, PALETTE.danger, 300);
        announce(`Shield hit. ${world.ship.shields} left.`);
        if (!world.ship.alive) endRun();
      }
      return;
    }

    world.drones.forEachActive((drone) => {
      if (!b.active) return;
      if (circlesOverlap(b.x, b.y, 4, drone.x, drone.y, drone.radius)) {
        b.active = false;
        emitBurst(world.particles, b.x, b.y, 4, '#bff2ff', 180);
        if (hitDrone(drone, BULLET.damage)) {
          drone.active = false;
          explodeDrone(drone);
        }
      }
    });
  });
}

function resolveDroneCollisions() {
  const shipBox = shipRect(world.ship);
  world.drones.forEachActive((drone) => {
    if (drone.y - drone.radius > FIELD.height + 40) {
      drone.active = false;
      return;
    }
    if (circleHitsRect(drone.x, drone.y, drone.radius * 0.8, shipBox) && damageShip(world.ship)) {
      drone.active = false;
      emitBurst(world.particles, drone.x, drone.y, 20, DRONE.kinds[drone.kind].colour, 320);
      announce(`Hull breach. ${world.ship.shields} shields left.`);
      if (!world.ship.alive) endRun();
    }
  });
}

function resolvePickups() {
  world.pickups.forEachActive((item) => {
    if (item.y > FIELD.height + 30) {
      item.active = false;
      return;
    }
    if (!pickupTouchesShip(item, world.ship)) return;
    item.active = false;
    if (item.kind === 'shield') {
      world.ship.shields = Math.min(SHIP.maxShields, world.ship.shields + 1);
      registerKill(world.score, 120, item.x, item.y);
      emitBurst(world.particles, item.x, item.y, 12, PALETTE.health, 220);
      announce(`Shield cell collected. ${world.ship.shields} of ${SHIP.maxShields}.`);
    } else {
      registerKill(world.score, 500, item.x, item.y);
      emitBurst(world.particles, item.x, item.y, 12, PALETTE.gold, 220);
    }
  });
}

function endRun() {
  if (world.score.total > world.score.best) {
    world.score.best = world.score.total;
    writeBest(world.score.best);
  }
  world.mode = 'gameover';
  announce(`Mech destroyed. Final score ${world.score.total}.`);
}

function stepWorld(dt) {
  world.elapsed += dt;

  const state = input.sample();
  updateShip(world.ship, state, dt, world.bullets);
  if (world.ship.cooldown === SHIP.fireCooldown) {
    emitBurst(world.particles, world.ship.x, world.ship.y - 30, 2, PALETTE.accent, 90, 0.9, -Math.PI / 2);
  }

  const result = advanceDirector(world.director, world.drones, dt);
  if (result.started) {
    resetWaveWatch(world.score, world.ship.shields);
    announce(`Wave ${result.started}. ${world.drones.countActive()} contacts.`);
  }
  if (result.cleared) {
    const bonus = completeWave(world.score, result.cleared, world.ship.shields);
    announce(bonus.perfect
      ? `Wave ${result.cleared} cleared with no damage. Bonus ${bonus.bonus}.`
      : `Wave ${result.cleared} cleared.`);
    if (result.finished) {
      world.mode = 'victory';
      if (world.score.total > world.score.best) {
        world.score.best = world.score.total;
        writeBest(world.score.best);
      }
      return;
    }
  }

  world.drones.forEachActive((drone) => {
    const shot = updateDrone(drone, dt, world.elapsed);
    if (shot) fireEnemyShot(drone);
  });

  stepBullets(dt);
  resolveBulletHits();
  resolveDroneCollisions();

  world.pickups.forEachActive((item) => updatePickup(item, dt));
  resolvePickups();

  world.particles.forEachActive((p) => updateParticle(p, dt));
  world.particles.forEachActive((p) => {
    if (p.life <= 0) p.active = false;
  });

  updateScore(world.score, dt);
}

function onActionKey(code) {
  if (code === 'Space' && (world.mode === 'title' || world.mode === 'gameover' || world.mode === 'victory')) {
    startRun();
    return true;
  }
  if (code === 'KeyR' && world.mode !== 'playing') {
    startRun();
    return true;
  }
  if (code === 'KeyP') {
    if (world.mode === 'playing') {
      world.mode = 'paused';
      announce('Paused.');
    } else if (world.mode === 'paused') {
      world.mode = 'playing';
      announce('Resumed.');
    }
    return true;
  }
  if (code === 'KeyR' && world.mode === 'paused') {
    startRun();
    return true;
  }
  if (world.mode === 'title' && (code === 'Enter' || code === 'Space')) {
    startRun();
    return true;
  }
  return false;
}

window.addEventListener('keydown', (event) => {
  if (onActionKey(event.code)) event.preventDefault();
});

let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;

  if (shotPose) {
    // A captured frame is a still photograph: the pose is rebuilt every frame
    // so nothing drifts, then painted once. No stepping, no randomness.
    applyShotPose(world, shotPose);
    drawWorld(renderer, world);
    drawHud(renderer, world);
    drawOverlays(renderer, world);
    requestAnimationFrame(frame);
    return;
  }

  if (world.mode === 'playing') {
    accumulator += delta;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      stepWorld(STEP);
      accumulator -= STEP;
      guard += 1;
      if (world.mode !== 'playing') {
        accumulator = 0;
        break;
      }
    }
  } else {
    world.elapsed += delta;
    world.particles.forEachActive((p) => updateParticle(p, delta));
    world.particles.forEachActive((p) => {
      if (p.life <= 0) p.active = false;
    });
  }

  drawWorld(renderer, world);
  drawHud(renderer, world);
  drawOverlays(renderer, world);
  requestAnimationFrame(frame);
}

function resize() {
  fitCanvas(renderer, canvas);
}

window.addEventListener('resize', resize);
resize();
announce('Iron Vanguard ready. Press Space to launch.');
requestAnimationFrame(frame);
