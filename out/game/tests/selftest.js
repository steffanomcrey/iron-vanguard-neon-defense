// Headless self-check. No DOM, no canvas, no dependencies:
//   node game/tests/selftest.js

import { makeRandom } from '../src/random.js';
import { clamp, circlesOverlap, circleHitsRect, travel } from '../src/collision.js';
import { createPool } from '../src/pools.js';
import { createShip, updateShip, damageShip, grantShip, shipRect } from '../src/ship.js';
import { spawnDrone, updateDrone, hitDrone } from '../src/drones.js';
import {
  createDirector,
  beginWave,
  completeWave,
  advanceDirector,
  waveComposition,
} from '../src/waves.js';
import {
  createScore,
  registerKill,
  updateScore,
  addWaveBonus,
  rollPickup,
  finalWave,
} from '../src/score.js';
import { spawnPickup, updatePickup, pickupTouchesShip } from '../src/pickups.js';
import { emitBurst, updateParticle } from '../src/particles.js';
import { FIELD, STEP, BULLET, DRONE, PICKUPS, PARTICLES, SHIP, WAVES } from '../src/config.js';

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push(`${name}: ${err && err.message ? err.message : String(err)}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'mismatch'}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, eps, message) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${message || 'not close'}: expected ~${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------- random

check('seed reproduces the same stream', () => {
  const a = makeRandom(1234);
  const b = makeRandom(1234);
  for (let i = 0; i < 64; i += 1) {
    assertEqual(a.next(), b.next(), `stream diverged at ${i}`);
  }
});

check('different seeds diverge', () => {
  const a = makeRandom(1);
  const b = makeRandom(2);
  let same = 0;
  for (let i = 0; i < 32; i += 1) if (a.next() === b.next()) same += 1;
  assert(same < 4, 'seeds 1 and 2 produced near-identical streams');
});

check('zero seed still produces a stream', () => {
  const r = makeRandom(0);
  const first = r.next();
  assert(Number.isFinite(first) && first !== 0, 'zero seed stalled the generator');
});

check('string seeds hash deterministically', () => {
  const a = makeRandom('iron-vanguard');
  const b = makeRandom('iron-vanguard');
  assertEqual(a.next(), b.next(), 'string seed was not stable');
});

check('next() stays in [0, 1)', () => {
  const r = makeRandom(99);
  for (let i = 0; i < 5000; i += 1) {
    const v = r.next();
    assert(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

check('int() respects an inclusive range', () => {
  const r = makeRandom(7);
  for (let i = 0; i < 2000; i += 1) {
    const v = r.int(3, 9);
    assert(Number.isInteger(v) && v >= 3 && v <= 9, `bad int: ${v}`);
  }
});

check('pick() returns a member', () => {
  const r = makeRandom(11);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 100; i += 1) assert(arr.includes(r.pick(arr)), 'pick left the array');
});

// ---------------------------------------------------------------- collision

check('clamp bounds values', () => {
  assertEqual(clamp(-5, 0, 10), 0);
  assertEqual(clamp(50, 0, 10), 10);
  assertEqual(clamp(5, 0, 10), 5);
});

check('circlesOverlap catches a genuine overlap', () => {
  assert(circlesOverlap(0, 0, 10, 5, 0, 10), 'overlap missed');
  assert(!circlesOverlap(0, 0, 10, 40, 0, 10), 'phantom overlap');
});

check('circlesOverlap treats touching as a hit', () => {
  assert(circlesOverlap(0, 0, 5, 10, 0, 5), 'tangent circles should collide');
});

check('circleHitsRect sees inside and outside', () => {
  const rect = { x: 0, y: 0, w: 20, h: 20 };
  assert(circleHitsRect(10, 10, 1, rect), 'centre miss');
  assert(circleHitsRect(21, 10, 2, rect), 'edge miss');
  assert(!circleHitsRect(40, 40, 2, rect), 'far hit');
});

check('travel integrates velocity', () => {
  const e = { x: 0, y: 0, vx: 100, vy: -50 };
  travel(e, 0.5);
  assertEqual(e.x, 50);
  assertEqual(e.y, -25);
});

// ---------------------------------------------------------------- pools

check('pool spawns and recycles', () => {
  const pool = createPool(2, () => ({ n: 0 }));
  const a = pool.spawn();
  const b = pool.spawn();
  assert(a && b, 'pool refused a spawn with free slots');
  assertEqual(pool.spawn(), null, 'pool over-allocated');
  a.active = false;
  const c = pool.spawn();
  assert(c === a, 'pool did not reuse the freed slot');
  assertEqual(pool.countActive(), 2);
});

check('pool reset runs on reuse', () => {
  const pool = createPool(1, () => ({
    v: 0,
    reset(x) {
      this.v = x;
    },
  }));
  const a = pool.spawn(5);
  assertEqual(a.v, 5, 'reset was not invoked');
  a.active = false;
  const b = pool.spawn(9);
  assertEqual(b.v, 9, 'stale state survived reuse');
});

// ---------------------------------------------------------------- ship

check('ship starts centred with full shields', () => {
  const s = createShip();
  assertEqual(s.shields, SHIP.shields);
  assertEqual(s.maxShields, SHIP.maxShields);
  assertClose(s.x, FIELD.w * 0.5, 0.001);
  assert(s.alive, 'ship should start alive');
});

check('ship accelerates under right input', () => {
  const s = createShip();
  const input = { left: false, right: true, fire: false, pointerActive: false, pointerX: 0, pointerY: 0 };
  const x0 = s.x;
  for (let i = 0; i < 20; i += 1) updateShip(s, input, STEP, FIELD);
  assert(s.x > x0, 'ship did not move right');
});

check('ship is clamped inside the field', () => {
  const s = createShip();
  const input = { left: true, right: false, fire: false, pointerActive: false, pointerX: 0, pointerY: 0 };
  for (let i = 0; i < 600; i += 1) updateShip(s, input, STEP, FIELD);
  assert(s.x >= SHIP.w * 0.5 - 0.001, `ship escaped left at ${s.x}`);
});

check('ship rect tracks position', () => {
  const s = createShip();
  s.x = 100;
  s.y = 200;
  const r = shipRect(s);
  assertClose(r.x, 100 - s.w * 0.5, 0.001);
  assertClose(r.y, 200 - s.h * 0.5, 0.001);
});

check('damage is blocked during invulnerability', () => {
  const s = createShip();
  s.invuln = 1;
  const before = s.shields;
  const destroyed = damageShip(s);
  assertEqual(destroyed, false, 'invulnerable ship was destroyed');
  assertEqual(s.shields, before, 'invulnerable ship lost a shield');
});

check('shields deplete to destruction', () => {
  const s = createShip();
  let destroyed = false;
  for (let i = 0; i < SHIP.shields; i += 1) {
    s.invuln = 0;
    destroyed = damageShip(s);
  }
  assert(destroyed, 'ship survived its last hit');
  assertEqual(s.shields, 0);
  assertEqual(s.alive, false);
});

check('grantShip caps at maxShields', () => {
  const s = createShip();
  s.shields = s.maxShields;
  assertEqual(grantShip(s, 2), 0, 'grant exceeded the cap');
  s.shields = 1;
  assertEqual(grantShip(s, 10), s.maxShields - 1, 'grant did not fill to the cap');
});

check('ship clamps vertical position', () => {
  const s = createShip();
  s.y = -500;
  updateShip(s, { left: false, right: false, fire: false, pointerActive: false, pointerX: 0, pointerY: 0 }, STEP, FIELD);
  assert(s.y > 0, 'ship escaped above the field');
  s.y = 5000;
  updateShip(s, { left: false, right: false, fire: false, pointerActive: false, pointerX: 0, pointerY: 0 }, STEP, FIELD);
  assert(s.y < FIELD.h, 'ship escaped below the field');
});

// ---------------------------------------------------------------- drones

check('drone pool spawn sets kind stats', () => {
  const pool = createPool(8, () => ({}));
  const rand = makeRandom(3);
  const d = spawnDrone(pool, 'striker', 400, -50, rand);
  assert(d, 'drone failed to spawn');
  assertEqual(d.kind, 'striker');
  assertEqual(d.hp, DRONE.kinds.striker.hp);
  assertEqual(d.radius, DRONE.kinds.striker.radius);
});

check('unknown drone kind is refused', () => {
  const pool = createPool(4, () => ({}));
  const rand = makeRandom(3);
  assertEqual(spawnDrone(pool, 'juggernaut', 0, 0, rand), null);
});

check('drone descends and eventually leaves', () => {
  const pool = createPool(1, () => ({}));
  const rand = makeRandom(4);
  const d = spawnDrone(pool, 'scout', FIELD.w * 0.5, -50, rand);
  const y0 = d.y;
  updateDrone(d, STEP, FIELD);
  assert(d.y > y0, 'drone did not descend');
  for (let i = 0; i < 2000; i += 1) updateDrone(d, STEP, FIELD);
  assertEqual(d.active, false, 'drone never left the field');
});

check('drone weave stays inside the field', () => {
  const pool = createPool(1, () => ({}));
  const rand = makeRandom(5);
  const d = spawnDrone(pool, 'scout', 20, -50, rand);
  for (let i = 0; i < 400; i += 1) {
    updateDrone(d, STEP, FIELD);
    assert(d.x >= 0 && d.x <= FIELD.w, `drone left the field at x=${d.x}`);
  }
});

check('hits reduce hp and kill on the last one', () => {
  const pool = createPool(1, () => ({}));
  const rand = makeRandom(6);
  const d = spawnDrone(pool, 'bulwark', 500, 100, rand);
  let died = false;
  for (let i = 0; i < DRONE.kinds.bulwark.hp; i += 1) died = hitDrone(d, 1);
  assert(died, 'bulwark survived its full hp');
  assertEqual(d.active, false);
});

// ---------------------------------------------------------------- waves

check('wave composition grows with depth', () => {
  const first = waveComposition(1);
  const last = waveComposition(WAVES.count);
  assert(first.length > 0, 'wave 1 was empty');
  assert(last.length > first.length, 'wave 10 was not larger than wave 1');
});

check('early waves are all scouts', () => {
  const kinds = new Set(waveComposition(2));
  assertEqual(kinds.size, 1, 'wave 2 mixed archetypes');
  assert(kinds.has('scout'), 'wave 2 was not scouts');
});

check('late waves include heavies', () => {
  const kinds = new Set(waveComposition(WAVES.count));
  assert(kinds.has('bulwark'), 'wave 10 had no bulwark');
  assert(kinds.has('striker'), 'wave 10 had no striker');
});

check('wave index is clamped to the table', () => {
  assertEqual(waveComposition(99).length, waveComposition(WAVES.count).length);
  assertEqual(waveComposition(0).length, waveComposition(1).length);
});

check('beginWave populates the queue', () => {
  const rand = makeRandom(8);
  const director = createDirector(rand);
  beginWave(director, 3);
  assertEqual(director.wave, 3);
  assertEqual(director.totalInWave, waveComposition(3).length);
  assertEqual(director.remaining, director.totalInWave);
  assertEqual(director.cleared, false);
});

check('director drains its queue into the pool', () => {
  const rand = makeRandom(9);
  const pool = createPool(DRONE.poolSize, () => ({}));
  const director = createDirector(rand);
  director.pool = pool;
  beginWave(director, 1);
  const total = director.totalInWave;
  let spawned = 0;
  for (let i = 0; i < 1200; i += 1) spawned += advanceDirector(director, STEP);
  assertEqual(spawned, total, 'queue did not fully drain');
  assertEqual(pool.countActive(), total, 'pool active count disagreed');
});

check('completeWave starts a breather', () => {
  const rand = makeRandom(10);
  const director = createDirector(rand);
  beginWave(director, 2);
  completeWave(director);
  assertEqual(director.cleared, true);
  assertEqual(director.remaining, 0);
  assert(director.breather > 0, 'no breather scheduled');
});

check('progress reports a fraction', () => {
  const rand = makeRandom(12);
  const director = createDirector(rand);
  director.pool = createPool(DRONE.poolSize, () => ({}));
  beginWave(director, 2);
  advanceDirector(director, STEP);
  assert(director.progress >= 0 && director.progress <= 1, 'progress out of range');
});

// ---------------------------------------------------------------- score

check('kills score and build combo', () => {
  const score = createScore();
  registerKill(score, { x: 0, y: 0, score: 100 });
  assertEqual(score.score, 100);
  registerKill(score, { x: 0, y: 0, score: 100 });
  assert(score.score > 200, 'combo did not amplify the second kill');
  assertEqual(score.combo, 3);
});

check('combo lapses after the window', () => {
  const score = createScore();
  registerKill(score, { x: 0, y: 0, score: 100 });
  assertEqual(score.combo, 2);
  for (let i = 0; i < 300; i += 1) updateScore(score, STEP);
  assertEqual(score.combo, 1, 'combo did not reset');
});

check('best score tracks the peak', () => {
  const score = createScore();
  registerKill(score, { x: 0, y: 0, score: 500 });
  const peak = score.score;
  score.score = 0;
  userlessReset(score);
  assertEqual(score.best >= peak, true, 'best score fell behind');
});

function userlessReset(score) {
  score.score = 10;
  updateScore(score, STEP);
}

check('wave bonus scales with wave and shields', () => {
  const score = createScore();
  const small = addWaveBonus(score, 1, 0);
  const large = addWaveBonus(createScore(), 5, 4);
  assert(large > small, 'later waves paid less');
});

check('float toasts expire', () => {
  const score = createScore();
  registerKill(score, { x: 0, y: 0, score: 100 });
  assert(score.floats.length > 0, 'no toast raised');
  for (let i = 0; i < 200; i += 1) updateScore(score, STEP);
  assertEqual(score.floats.length, 0, 'toast never expired');
});

check('drop table returns known types or nothing', () => {
  const rand = makeRandom(13);
  const seen = new Set();
  for (let i = 0; i < 4000; i += 1) {
    const drop = rollPickup(rand, 'striker');
    assert(drop === null || drop === 'shield' || drop === 'core', `unknown drop: ${drop}`);
    if (drop) seen.add(drop);
  }
  assert(seen.has('shield') && seen.has('core'), 'drop table is too narrow');
});

check('bulwarks drop more often than scouts', () => {
  const rand = makeRandom(14);
  let heavies = 0;
  let lights = 0;
  for (let i = 0; i < 4000; i += 1) {
    if (rollPickup(rand, 'bulwark')) heavies += 1;
    if (rollPickup(rand, 'scout')) lights += 1;
  }
  assert(heavies > lights, 'heavy drones dropped less than scouts');
});

check('final wave matches the table', () => {
  assertEqual(finalWave(), WAVES.count);
});

// ---------------------------------------------------------------- pickups

check('pickup drifts down and expires', () => {
  const pool = createPool(PICKUPS.poolSize, () => ({}));
  const p = spawnPickup(pool, 'shield', 100, 100);
  const y0 = p.y;
  updatePickup(p, STEP, FIELD);
  assert(p.y > y0, 'pickup did not fall');
  for (let i = 0; i < 2000; i += 1) updatePickup(p, STEP, FIELD);
  assertEqual(p.active, false, 'pickup never left the field');
});

check('pickup touches the ship only when close', () => {
  const pool = createPool(PICKUPS.poolSize, () => ({}));
  const ship = createShip();
  const hit = spawnPickup(pool, 'core', ship.x, ship.y);
  assert(pickupTouchesShip(hit, ship), 'overlapping pickup missed');
  const far = spawnPickup(pool, 'core', 10, 10);
  assert(!pickupTouchesShip(far, ship), 'distant pickup registered');
});

check('unknown pickup type falls back to shield', () => {
  const pool = createPool(2, () => ({}));
  const p = spawnPickup(pool, 'nonsense', 0, 0);
  assertEqual(p.type, 'shield');
});

// ---------------------------------------------------------------- particles

check('burst emits and expires', () => {
  const pool = createPool(PARTICLES.poolSize, () => ({}));
  const rand = makeRandom(15);
  const emitted = emitBurst(pool, 100, 100, 20, '#ffffff', rand);
  assertEqual(emitted, 20);
  for (let i = 0; i < 200; i += 1) {
    for (let j = 0; j < pool.items.length; j += 1) {
      if (pool.items[j].active) updateParticle(pool.items[j], STEP);
    }
  }
  assertEqual(pool.countActive(), 0, 'particles never expired');
});

check('burst respects pool capacity', () => {
  const pool = createPool(4, () => ({}));
  const rand = makeRandom(16);
  const emitted = emitBurst(pool, 0, 0, 100, '#ffffff', rand);
  assertEqual(emitted, 4, 'burst overran the pool');
});

// ---------------------------------------------------------------- config

check('frozen config cannot be mutated', () => {
  let threw = false;
  try {
    FIELD.w = 999;
  } catch {
    threw = true;
  }
  assert(threw || FIELD.w === 1280, 'config was mutated');
  assertEqual(FIELD.w, 1280);
  assertEqual(STEP, 1 / 60);
});

check('pool sizes are positive', () => {
  assert(BULLET.poolSize > 0 && DRONE.poolSize > 0 && PARTICLES.poolSize > 0, 'bad pool size');
});

// ---------------------------------------------------------------- report

const total = passed + failures.length;
if (failures.length > 0) {
  console.error(`selftest: ${passed}/${total} checks passed`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}

console.log(`selftest: ${passed}/${total} checks passed`);
