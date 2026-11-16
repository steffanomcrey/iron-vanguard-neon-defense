// Wave director: composition, spawn queue, drain timer, progress.

import { WAVES, FIELD } from './config.js';
import { spawnDrone } from './drones.js';

export function waveComposition(wave) {
  const n = Math.max(1, Math.min(WAVES.count, Math.floor(wave) || 1));

  // Roughly 5 drones on wave 1 growing to about 22 on wave 10.
  const total = Math.round(WAVES.baseCount + (n - 1) * 1.9);

  const list = [];
  for (let i = 0; i < total; i += 1) {
    if (n <= 2) {
      list.push('scout');
      continue;
    }

    // Deeper waves trade scouts for the heavy archetypes.
    const strikerFrom = 2.5;
    const bulwarkFrom = 5.5;

    if (n >= bulwarkFrom && i % Math.max(3, 9 - Math.floor(n / 2)) === 0) {
      list.push('bulwark');
    } else if (n >= strikerFrom && i % 3 !== 1) {
      list.push('striker');
    } else {
      list.push('scout');
    }
  }

  return list;
}

export function createDirector(rand) {
  return {
    wave: 1,
    remaining: 0,
    spawnQueue: [],
    timer: 0,
    breather: WAVES.breather,
    totalInWave: 0,
    progress: 0,
    cleared: false,
    rand,
  };
}

export function beginWave(director, wave) {
  const w = Math.max(1, Math.min(WAVES.count, Math.floor(wave) || 1));
  director.wave = w;
  director.spawnQueue = waveComposition(w);
  director.totalInWave = director.spawnQueue.length;
  director.remaining = director.spawnQueue.length;
  director.progress = 0;
  director.breather = 0;
  director.cleared = false;
  // First drop is quick, then the queue drains on a per-drone timer.
  director.timer = 0.35;
  return director;
}

export function completeWave(director) {
  director.breather = WAVES.breather;
  director.progress = 0;
  director.cleared = true;
  director.spawnQueue.length = 0;
  director.remaining = 0;
  return director;
}

export function advanceDirector(director, dt) {
  let spawned = 0;

  if (director.breather > 0) {
    director.breather = Math.max(0, director.breather - dt);
    return spawned;
  }

  if (director.spawnQueue.length > 0) {
    director.timer -= dt;
    if (director.timer <= 0) {
      const kind = director.spawnQueue.shift();
      const spread = FIELD.w - 160;
      const x = 80 + director.rand.next() * spread;
      const y = -60 - director.rand.range(0, 40);
      const drone = spawnDrone(director.pool, kind, x, y, director.rand);
      if (drone) {
        spawned += 1;
        // Pace tightens slightly as the waves go on.
        const pace = Math.max(0.14, 0.62 - director.wave * 0.035);
        director.timer = pace + director.rand.range(0, pace * 0.6);
      } else {
        director.timer = 0.2;
      }
    }
  }

  if (director.totalInWave > 0) {
    const killed = director.totalInWave - director.remaining;
    director.progress = Math.max(0, Math.min(1, killed / director.totalInWave));
    if (director.progress >= 1) director.progress = 1;
  }

  return spawned;
}
