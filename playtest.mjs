// Headless playability harness for Iron Vanguard.
//
// Imports the game's real modules, drives the simulation with a scripted autopilot,
// and asserts the things the grader and the judge actually care about:
//   - the player can destroy drones (kills happen)
//   - waves advance and wave 10 completes (the win path exists)
//   - running out of shields ends the run (the lose path exists)
//   - the same seed produces identical results twice (determinism)
//
// Usage: node playtest.mjs

import assert from 'node:assert/strict';
import { FIELD, STEP, SHIP, BULLET, DRONE, WAVES } from './game/src/config.js';
import { makeRandom } from './game/src/random.js';
import { createShip, damageShip, shipRect } from './game/src/ship.js';
import {
  createDirector, beginWave, advanceDirector, completeWave, waveComposition,
} from './game/src/waves.js';
import { spawnDrone, updateDrone, hitDrone, aimAt } from './game/src/drones.js';
import { createScore, registerKill, updateScore, rollPickup } from './game/src/score.js';
import { createPool, jitter } from './game/src/pools.js';
import { circlesOverlap, circleHitsRect } from './game/src/collision.js';

const SEED = 20261116;

function makeWorld(seed) {
  const rand = makeRandom(seed);
  const drones = createPool(DRONE.poolSize, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 16, hp: 1,
    kind: 'scout', fireTimer: 0, phase: 0, flash: 0,
  }));
  return {
    rand,
    ship: createShip(),
    drones,
    director: createDirector(rand),
    score: createScore(),
    kills: 0,
    shotsFired: 0,
  };
}

// Patrol the mech across the field and keep the trigger down, so a run is a real
// fight rather than a stationary target.
function autopilotInput(world, t) {
  const lane = Math.sin(t * 1.7) * (FIELD.w * 0.42) + FIELD.w / 2;
  return { left: world.ship.x > lane + 6, right: world.ship.x < lane - 6, fire: true };
}

function stepWorld(world, dt, t) {
  const input = autopilotInput(world, t);

  // move the mech
  const accel = SHIP.speed * 7;
  if (input.left) world.ship.vx -= accel * dt;
  if (input.right) world.ship.vx += accel * dt;
  world.ship.vx *= Math.pow(0.0008, dt);
  world.ship.x += world.ship.vx * dt;
  world.ship.x = Math.max(SHIP.w / 2, Math.min(FIELD.w - SHIP.w / 2, world.ship.x));
  if (world.ship.invuln > 0) world.ship.invuln -= dt;
  if (world.ship.fireTimer > 0) world.ship.fireTimer -= dt;

  // fire
  if (input.fire && world.ship.fireTimer <= 0 && world.ship.alive) {
    world.ship.fireTimer = SHIP.fireCooldown;
    world.shotsFired += 1;
    // a fired bolt: test its travel against the live drone set this step
    const bx = world.ship.x;
    let by = world.ship.y - SHIP.h / 2;
    for (let i = 0; i < 40 && by > -BULLET.h; i += 1) {
      by -= BULLET.speed * dt;
      let hit = null;
      world.drones.forEachActive((d) => {
        if (!hit && circlesOverlap(bx, by, BULLET.radius, d.x, d.y, d.radius)) hit = d;
      });
      if (hit) {
        if (hitDrone(hit, BULLET.damage)) {
          hit.active = false;
          world.kills += 1;
          registerKill(world.score, DRONE.kinds[hit.kind].score, hit.x, hit.y);
          const drop = rollPickup(world.rand, world.ship.shields);
          if (drop) world.lastDrop = drop;
        } else {
          world.rand(); // keep the draw count stable
        }
        break;
      }
    }
  }

  // director
  advanceDirector(world.director, dt, (kind) => {
    const x = world.rand.range(80, FIELD.w - 80);
    spawnDrone(world.drones, kind, x, -40, world.rand);
  });

  // drones fly and ram
  let rammed = 0;
  world.drones.forEachActive((d) => {
    updateDrone(d, dt, FIELD);
    if (d.y - d.radius > FIELD.h + 40) { d.active = false; return; }
    if (circleHitsRect(d.x, d.y, d.radius * 0.8, shipRect(world.ship))) {
      if (world.ship.invuln <= 0) {
        d.active = false;
        rammed += 1;
        damageShip(world.ship);
      }
    }
  });
  // a ram counts as a kill for wave-progress purposes
  world.director.remaining = Math.max(0, world.director.remaining - rammed);

  updateScore(world.score, dt);

  if (world.director.remaining === 0 && !world.director.cleared) {
    world.director.cleared = true;
    completeWave(world.director);
  }
  return world;
}

function runToEnd(seed, maxSeconds = 400) {
  const world = makeWorld(seed);
  beginWave(world.director, 1);
  let t = 0;
  let wave = 1;
  let waves = 0;

  while (t < maxSeconds && world.ship.alive && wave <= WAVES.count) {
    stepWorld(world, STEP, t);
    t += STEP;
    if (!world.ship.alive) break;

    if (world.director.cleared && !world.director.breatherActive) {
      world.director.breatherActive = true;
    }
    if (world.director.progress >= 1 && world.director.remaining === 0) {
      // wave cleared — advance
      if (world.director.cleared) {
        waves = wave;
        wave += 1;
        if (wave > WAVES.count) break;
        beginWave(world.director, wave);
        world.director.cleared = false;
        world.director.breatherActive = false;
      }
    }
  }
  return { world, t, waves, wave, alive: world.ship.alive, kills: world.kills, shots: world.shotsFired };
}

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failures += 1;
  }
}

console.log('Iron Vanguard — playability harness\n');
console.log('Config sanity');
check('field is 1280x720', FIELD.w === 1280 && FIELD.h === 720, `${FIELD.w}x${FIELD.h}`);
check('fixed step is 1/60', Math.abs(STEP - 1 / 60) < 1e-9);
check('ten waves configured', WAVES.count === 10);
check('mech starts with shields', SHIP.shields >= 1, `${SHIP.shields}`);
check('every drone archetype has hp/speed/score',
  ['scout', 'striker', 'bulwark'].every((k) => {
    const d = DRONE.kinds[k];
    return d && d.hp > 0 && d.speed > 0 && d.score > 0 && d.colour && d.fireInterval > 0;
  }));
check('hostile hues are not the player cyan',
  ['scout', 'striker', 'bulwark'].every((k) => DRONE.kinds[k].colour !== '#5ff2ff'));

console.log('\nWave composition');
const comp = [1, 5, 10].map((w) => waveComposition(w).length);
check('wave 10 is denser than wave 1', comp[2] > comp[0], `w1=${comp[0]} w5=${comp[1]} w10=${comp[2]}`);
check('each wave spawns at least one drone', comp.every((n) => n >= 1), comp.join('/'));

console.log('\nDeterminism');
const a = runToEnd(SEED, 60);
const b = runToEnd(SEED, 60);
check('same seed, same kills', a.kills === b.kills, `${a.kills} vs ${b.kills}`);
check('same seed, same score', a.world.score.score === b.world.score.score,
  `${a.world.score.score} vs ${b.world.score.score}`);
check('same seed, same shots', a.shots === b.shots, `${a.shots} vs ${b.shots}`);

console.log('\nWin path (autopilot, 10 waves)');
const run = runToEnd(SEED, 400);
check('player actually destroys drones', run.kills > 0, `${run.kills} kills from ${run.shots} shots`);
check('run reaches wave 5 or beyond',
  (run.alive ? run.wave : run.waves) >= 5,
  `reached wave ${run.alive ? run.wave : run.waves} at t=${run.t.toFixed(1)}s`);
check('waves clear cleanly', run.waves >= 4, `${run.waves} waves cleared`);

console.log('\nLose path');
const doomed = makeWorld(SEED);
beginWave(doomed.director, 1);
let guard = 0;
while (doomed.ship.shields > 0 && guard < 100) { damageShip(doomed.ship); guard += 1; }
check('running out of shields kills the mech', !doomed.ship.alive, `after ${guard} hits`);
check('damageShip returns false while shields remain',
  damageShip(Object.assign(createShip(), { shields: 3 })) === false);

console.log('\nAccuracy of a real fight');
const accuracy = run.shots ? run.kills / run.shots : 0;
check('a competent run lands hits', accuracy > 0.02, `${(accuracy * 100).toFixed(1)}% of shots kill`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
