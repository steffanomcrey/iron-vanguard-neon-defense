// Score, combo chain, wave bonus and the drop table.

import { DRONE, WAVES } from './config.js';

const COMBO_WINDOW = 3.2;
const COMBO_CAP = 10;

export function createScore() {
  return {
    score: 0,
    best: 0,
    combo: 1,
    comboTimer: 0,
    wave: 1,
    floats: [],
  };
}

export function registerKill(score, drone) {
  const base = drone.score || (drone.stats ? drone.stats.score : 0);
  const gained = Math.round(base * comboMultiplier(score.combo));
  score.score += gained;

  score.combo = Math.min(COMBO_CAP, score.combo + 1);
  score.comboTimer = COMBO_WINDOW;

  score.floats.push({
    x: drone.x,
    y: drone.y,
    text: `+${gained}`,
    life: 1.1,
    maxLife: 1.1,
  });
  if (score.floats.length > 24) score.floats.shift();

  if (score.score > score.best) score.best = score.score;
  return gained;
}

export function comboMultiplier(combo) {
  const c = Math.max(1, Math.min(COMBO_CAP, combo));
  return 1 + (c - 1) * 0.15;
}

export function updateScore(score, dt) {
  if (score.comboTimer > 0) {
    score.comboTimer -= dt;
    if (score.comboTimer <= 0) {
      score.comboTimer = 0;
      score.combo = 1;
    }
  }

  for (let i = score.floats.length - 1; i >= 0; i -= 1) {
    const f = score.floats[i];
    f.life -= dt;
    f.y -= 42 * dt;
    if (f.life <= 0) score.floats.splice(i, 1);
  }

  return score;
}

export function addWaveBonus(score, wave, shieldsLeft) {
  const bonus = 500 * Math.max(1, wave) + 250 * Math.max(0, shieldsLeft);
  score.score += bonus;
  if (score.score > score.best) score.best = score.score;
  score.floats.push({
    x: 640,
    y: 300,
    text: `WAVE ${wave} CLEAR +${bonus}`,
    life: 1.6,
    maxLife: 1.6,
  });
  return bonus;
}

export function addPoints(score, amount) {
  score.score += amount;
  if (score.score > score.best) score.best = score.score;
  return score.score;
}

// Scouts mostly drop nothing; bulwarks usually drop something.
export function rollPickup(rand, kind) {
  const roll = rand.next();

  if (kind === 'bulwark') {
    if (roll < 0.45) return 'shield';
    if (roll < 0.8) return 'core';
    return null;
  }

  if (kind === 'striker') {
    if (roll < 0.22) return 'shield';
    if (roll < 0.42) return 'core';
    return null;
  }

  if (roll < 0.07) return 'shield';
  if (roll < 0.14) return 'core';
  return null;
}

export function finalWave() {
  return WAVES.count;
}
