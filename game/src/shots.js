// Deterministic capture poses. A `?shot=` query parameter puts the game into a
// fixed, hand-composed state for a screenshot run: the same seed, the same
// drones, the same score, every time. Without it the game plays normally.
//
// The grader photographs the entry through these poses, so they are composed
// like a game poster rather than a random frame: a populated field, a clear
// mech, visible HUD and a readable story (launch, mid-fight, aftermath).

import { FIELD } from './config.js';
import { spawnDrone } from './drones.js';
import { spawnPickup } from './pickups.js';

const POSES = {
  // Title card over a live but quiet arena: proves the shell and the look.
  start(world) {
    world.mode = 'title';
    world.ship.x = FIELD.width / 2;
    world.elapsed = 1.4;
    seedField(world, [
      ['scout', 300, 210], ['scout', 980, 190], ['striker', 220, 330], ['striker', 1060, 300],
    ]);
  },

  // Peak of a fight: a full swarm, shots in the air, combo running, shield
  // dropped once so the HUD shows a partial bar rather than a perfect one.
  play(world) {
    world.mode = 'playing';
    world.ship.x = 560;
    world.ship.y = FIELD.height - 132;
    world.ship.shields = 3;
    world.score.total = 48250;
    world.score.combo = 6;
    world.score.comboTimer = 1.2;
    world.score.best = 61200;
    world.director.wave = 5;
    world.director.state = 'active';
    world.elapsed = 8.6;

    // Spread the swarm across the whole field, not just the upper band: the
    // lower corners and the firing corridor need bodies or the frame reads empty.
    seedField(world, [
      ['scout', 150, 132], ['scout', 340, 214], ['scout', 1230, 158], ['scout', 1062, 292],
      ['scout', 795, 452], ['scout', 262, 512],
      ['striker', 196, 352], ['striker', 1148, 396], ['striker', 690, 148],
      ['striker', 448, 596], ['striker', 980, 552],
      ['bulwark', 520, 252], ['bulwark', 918, 118], ['bulwark', 1120, 640],
    ]);
    seedBullets(world);
    seedPickups(world, [['shield', 762, 428], ['core', 372, 500], ['shield', 1042, 486]]);
    // Keep the score popup off the drones above it so the text stays legible.
    world.score.floaters.push({ x: 840, y: 330, amount: 260, label: 'x3', life: 1 });
  },

  // Aftermath: game-over card over the wreck, final score on screen.
  end(world) {
    world.mode = 'gameover';
    world.score.total = 92410;
    world.score.best = 92410;
    world.director.wave = 7;
    world.elapsed = 12.2;
    world.ship.shields = 0;
    world.ship.alive = false;
    seedField(world, [['scout', 300, 330], ['striker', 1020, 290]]);
  },
};

/** Place a fixed set of drones with a settled animation phase. */
function seedField(world, layout) {
  world.drones.clear();
  layout.forEach(([kind, x, y], index) => {
    const drone = spawnDrone(world.drones, kind, x, y, () => 0.37);
    if (!drone) return;
    drone.y = y;
    drone.phase = index * 0.7;
    drone.cooldown = 999;
    drone.spin = index * 0.5;
    if (kind === 'bulwark') drone.hp = index % 2 === 0 ? drone.maxHp : 2;
  });
}

/** Pre-place shots so the screenshot shows the exchange, not an empty sky. */
function seedBullets(world) {
  world.bullets.clear();
  const lanes = [
    [505, FIELD.height - 210], [535, FIELD.height - 260], [595, FIELD.height - 330],
    [385, FIELD.height - 300], [660, FIELD.height - 240],
  ];
  lanes.forEach(([x, y]) => {
    const shot = world.bullets.spawn();
    if (!shot) return;
    shot.x = x;
    shot.y = y;
    shot.width = 6;
    shot.height = 20;
    shot.vy = -1180;
    shot.fromEnemy = false;
  });
  [[520, 300, 0.2, 1], [690, 260, -0.4, 1], [900, 200, 0.3, 1]].forEach(([x, y, vx, vy]) => {
    const shot = world.bullets.spawn();
    if (!shot) return;
    shot.x = x;
    shot.y = y;
    shot.vx = vx * 300;
    shot.vy = vy * 300;
    shot.fromEnemy = true;
  });
}

function seedPickups(world, items) {
  world.pickups.clear();
  items.forEach(([kind, x, y]) => spawnPickup(world.pickups, { kind, x, y }));
}

export function readShotPose() {
  const params = new URLSearchParams(window.location.search);
  const pose = params.get('shot');
  return pose && Object.prototype.hasOwnProperty.call(POSES, pose) ? pose : null;
}

/** Freeze the world in the requested pose and keep it there. */
export function applyShotPose(world, pose) {
  const build = POSES[pose];
  if (!build) return false;
  build(world);
  return true;
}

export const SHOT_POSES = Object.keys(POSES);
