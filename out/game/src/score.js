// Scoring and the shield economy. Score is the headline number, but shields are
// the real resource: finishing a wave untouched banks a bonus, which is what
// turns careful flying into a higher score than reckless spraying.

import { SCORE, PICKUP, SHIP } from './config.js';

export function createScore() {
  return {
    total: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    waveStartShields: SHIP.startShields,
    survivalTimer: 0,
    floaters: [],
  };
}

export function addPoints(score, amount, x, y, label) {
  score.total += amount;
  if (x !== undefined) {
    score.floaters.push({ x, y, amount, label, life: 1 });
    if (score.floaters.length > 18) score.floaters.shift();
  }
}

/** Called on each kill: the multiplier rewards clearing a wave without gaps. */
export function registerKill(score, points, x, y) {
  score.combo = Math.min(score.combo + 1, 10);
  score.comboTimer = 1.6;
  const multiplier = 1 + (score.combo - 1) * 0.15;
  const gained = Math.round(points * multiplier);
  addPoints(score, gained, x, y, score.combo > 2 ? `x${score.combo}` : '');
  return gained;
}

export function updateScore(score, dt) {
  score.comboTimer = Math.max(0, score.comboTimer - dt);
  if (score.comboTimer === 0) score.combo = 0;

  score.survivalTimer += dt;
  if (score.survivalTimer >= 1) {
    score.survivalTimer -= 1;
    score.total += SCORE.survivalPerSecond;
  }

  for (let i = score.floaters.length - 1; i >= 0; i -= 1) {
    const f = score.floaters[i];
    f.life -= dt * 1.1;
    f.y -= dt * 42;
    if (f.life <= 0) score.floaters.splice(i, 1);
  }
}

/** End-of-wave bookkeeping: perfect shield bonus and wave clear points. */
export function completeWave(score, wave, shieldsLeft) {
  addPoints(score, SCORE.waveClear, undefined, undefined, '');
  if (shieldsLeft >= score.waveStartShields) {
    addPoints(score, SCORE.shieldPerfect, undefined, undefined, '');
    return { perfect: true, bonus: SCORE.shieldPerfect };
  }
  void wave;
  return { perfect: false, bonus: 0 };
}

export function resetWaveWatch(score, shields) {
  score.waveStartShields = shields;
}

/** Decide whether a destroyed drone leaves a pickup, and which kind. */
export function rollPickup(rand, shields, x, y) {
  if (rand() > PICKUP.chance) return null;
  const low = shields < SHIP.maxShields;
  const kind = low && rand() < 0.7 ? 'shield' : 'core';
  return { kind, x, y };
}
