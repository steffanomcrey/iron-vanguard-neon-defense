// The wave director: decides what spawns, when, and how hard each wave hits.
// Difficulty is a single curve rather than scattered constants, so the ramp can
// be retuned in one line and the whole run stays fair.

import { WAVE, DRONE, FIELD } from './config.js';
import { spawnDrone } from './drones.js';
import { randomInt } from './random.js';

export function createDirector(rand) {
  return {
    rand,
    wave: 0,
    pending: [],
    timer: 0,
    state: 'breather',
    stateTimer: WAVE.breatherSeconds,
    elapsed: 0,
    totalInWave: 0,
    progress: 0,
  };
}

/** How many drones wave N sends, and in what mix. */
export function waveComposition(wave) {
  const total = WAVE.spawnBase + WAVE.spawnPerWave * wave;
  const mix = [];
  for (let i = 0; i < total; i += 1) {
    if (wave >= WAVE.bulwarkFrom && i % 6 === 5) mix.push('bulwark');
    else if (wave >= WAVE.strikerFrom && i % 3 === 2) mix.push('striker');
    else mix.push('scout');
  }
  return mix;
}

export function beginWave(director, pool) {
  director.wave += 1;
  director.state = 'active';
  director.stateTimer = 0;
  director.timer = 0;

  const mix = waveComposition(director.wave);
  director.totalInWave = mix.length;
  director.progress = 0;
  const span = FIELD.width - 240;
  director.pending = mix.map((kind, index) => {
    const spec = DRONE.kinds[kind];
    const x = 120 + (span * (index + 0.5)) / mix.length;
    return { kind, x, delay: index * 0.42, radius: spec.radius };
  });
  void pool;
}

/** Spawn due drones and report whether the wave is finished. */
export function advanceDirector(director, pool, dt) {
  director.elapsed += dt;
  director.timer += dt;

  if (director.state === 'breather') {
    director.stateTimer -= dt;
    director.progress = 0;
    if (director.stateTimer <= 0) {
      beginWave(director, pool);
      return { started: director.wave, cleared: 0, finished: false };
    }
    return { started: 0, cleared: 0, finished: false };
  }

  while (director.pending.length && director.pending[0].delay <= director.timer) {
    const next = director.pending.shift();
    spawnDrone(pool, next.kind, next.x, -next.radius - 20, director.rand);
  }

  // Fraction of this wave already destroyed, for the HUD threat bar.
  const queued = director.totalInWave || 0;
  const remaining = director.pending.length + pool.countActive();
  director.progress = queued > 0 ? Math.min(1, (queued - remaining) / queued) : 0;

  if (director.pending.length === 0 && pool.countActive() === 0) {
    const cleared = director.wave;
    director.state = 'breather';
    director.stateTimer = WAVE.breatherSeconds;
    director.timer = 0;
    director.progress = 1;
    return { started: 0, cleared, finished: director.wave >= WAVE.count };
  }

  return { started: 0, cleared: 0, finished: false };
}

/** Debris carried by a random-free scatter used after a kill. */
export function killScatter(rand, x, y, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const speed = 60 + rand() * 260;
    out.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }
  return out;
}

export { randomInt };
