// Composed screenshot poses.
//
// The entry's captures are not lucky frames — they are stages the world is rebuilt into,
// on demand, from a fixed seed. `?shot=start|play|end` selects one; the bootstrap paints
// that pose and skips simulation entirely, so the same three images come out every run.
//
// These are the entry's covers: `start` sells the premise, `play` shows the fight at its
// busiest, `end` shows that the run can actually be won.

import { FIELD, DRONE, BULLET, ENEMY_BULLET, PALETTE } from './config.js';

export const SHOT_NAMES = ['cover', 'start', 'play', 'end'];

// Read the requested pose from the URL. Returns null when the game should play normally.
export function readShotPose() {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search || '');
  const raw = params.get('shot');
  if (!raw) return null;
  const name = raw.trim().toLowerCase();
  return SHOT_NAMES.includes(name) ? name : null;
}

function activate(pool, x, y, props) {
  const item = pool.spawn();
  if (!item) return null;
  item.x = x;
  item.y = y;
  Object.assign(item, props);
  item.active = true;
  return item;
}

function clearPools(engine) {
  for (const pool of [engine.bullets, engine.enemyBullets, engine.drones,
    engine.pickups, engine.particles]) {
    pool.items.forEach((item) => { item.active = false; });
    if (pool.reset) pool.reset();
  }
  engine.score.floats.length = 0;
  engine.kills = 0;
}

function seedDrone(engine, kind, x, y, rand, hp) {
  const stats = DRONE.kinds[kind];
  const d = activate(engine.drones, x, y, {
    kind,
    stats,
    hp: hp === undefined ? stats.hp : hp,
    radius: stats.radius,
    speed: stats.speed,
    fireTimer: rand.range(0.3, stats.fireInterval),
    phase: rand.range(0, Math.PI * 2),
    flash: 0,
    vx: 0,
    vy: 0,
    age: 0,
  });
  return d;
}

// A stream of player bolts rising from the mech's guns, spaced so the eye reads motion.
function seedPlayerFire(engine, x, y, count, rand) {
  for (let i = 0; i < count; i += 1) {
    const lane = i % 2 === 0 ? -13 : 13;
    activate(engine.bullets, x + lane + rand.range(-2, 2), y - 60 - i * 96, {
      w: BULLET.w, h: BULLET.h, radius: BULLET.radius,
      vx: 0, vy: -BULLET.speed, damage: BULLET.damage, hostile: false,
    });
  }
}

// Hostile fire converging on the mech from three directions — the pressure the run is about.
function seedEnemyFire(engine, targetX, targetY, rand, volleys) {
  // A pose may hand in its own volleys so the fire is composed into the picture instead of
  // scattered across it; otherwise fall back to a generic wide spread.
  const fans = volleys && volleys.length
    ? volleys.map((v) => ({ ox: v.x, oy: v.y, n: v.n, spread: v.spread }))
    : [
      { ox: 300, oy: 150, n: 4 },
      { ox: 980, oy: 250, n: 4 },
      { ox: 640, oy: 96, n: 3 },
      { ox: 470, oy: 200, n: 3 },
      { ox: 830, oy: 118, n: 3 },
    ];
  // Nearer the mech the shot has already travelled, so place a closer wave too. Custom volleys
  // already sit where the pose wants them, so they get no extra near wave.
  const closeFans = volleys && volleys.length ? [] : [
    { ox: 520, oy: 430, n: 2 },
    { ox: 780, oy: 470, n: 2 },
  ];
  for (const fan of fans) {
    for (let i = 0; i < fan.n; i += 1) {
      const gap = fan.spread ? fan.spread / Math.max(1, fan.n) : 46;
      const x = fan.ox + (i - (fan.n - 1) / 2) * gap + rand.range(-6, 6);
      const y = fan.oy + rand.range(0, 90);
      const dx = targetX - x;
      const dy = targetY - y;
      const len = Math.hypot(dx, dy) || 1;
      activate(engine.enemyBullets, x, y, {
        radius: ENEMY_BULLET.radius,
        vx: (dx / len) * ENEMY_BULLET.speed,
        vy: (dy / len) * ENEMY_BULLET.speed,
        damage: ENEMY_BULLET.damage,
        hostile: true,
      });
    }
  }
  for (const fan of closeFans) {
    for (let i = 0; i < fan.n; i += 1) {
      const x = fan.ox + (i - (fan.n - 1) / 2) * 52;
      const y = fan.oy;
      const dx = targetX - x;
      const dy = targetY - y;
      const len = Math.hypot(dx, dy) || 1;
      activate(engine.enemyBullets, x, y, {
        radius: ENEMY_BULLET.radius,
        vx: (dx / len) * ENEMY_BULLET.speed,
        vy: (dy / len) * ENEMY_BULLET.speed,
        damage: ENEMY_BULLET.damage,
        hostile: true,
      });
    }
  }
}

function seedPickups(engine, rand) {
  const drops = [
    { type: 'shield', x: 300, y: 470 },
    { type: 'core', x: 828, y: 396 },
    { type: 'shield', x: 512, y: 250 },
  ];
  for (const d of drops) {
    activate(engine.pickups, d.x, d.y, {
      type: d.type,
      radius: 14,
      vy: 130,
      spin: rand.range(0, Math.PI * 2),
    });
  }
}

function seedSparks(engine, spots, rand) {
  for (const s of spots) {
    for (let i = 0; i < s.n; i += 1) {
      const a = rand.range(0, Math.PI * 2);
      const sp = rand.range(30, 170);
      activate(engine.particles, s.x, s.y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand.range(0.25, 0.55),
        maxLife: 0.55,
        colour: s.colour || PALETTE.gold,
        radius: rand.range(1.4, 3.2),
      });
    }
  }
}

// The three poses, as frozen stage directions.
export const POSES = Object.freeze({
  // The cover. A composed hero frame rather than a busy mid-fight screenshot: the mech sits large
  // on the lower third, every archetype is on screen so each colour reads, and hostile fire
  // crosses the whole width so the frame has no dead zone. Judges see this image first and
  // smallest, so it needs one dominant subject plus rhythm, not a scattered dusting of sprites.
  cover: {
    seed: 940081,
    state: 'playing',
    ship: { x: 372, y: 452, shields: 3, invuln: 0, heroScale: 5.0 },
    wave: 6,
    waveProgress: 0.44,
    score: 91430,
    best: 91430,
    combo: 4,
    elapsed: 402,
    minimalHud: true,
    // Swarm sits back in luminance: the hero craft must be the only bright mass on the cover.
    swarmDim: 0.62,
    drones: [
      // One enclosed swarm, not a field of clutter. The right side of the frame is left empty on
      // purpose so the hero owns the only bright mass; the enemies read as a single shape the mech
      // is holding back, which is what the composition has to say.
      // The title's column stays clear all the way down: no enemy may overlap a letter, or the
      // cover ships with a misread name.
      ['striker', 1088, 286],
      ['striker', 1174, 332],
      ['striker', 1130, 214],
      ['scout', 1024, 236],
      ['scout', 1108, 356],
      ['scout', 1196, 272],
      ['bulwark', 1140, 300],
    ],
    playerFire: 8,
    enemyFire: true,
    pickups: true,
    // Enemy fire is seeded inside the swarm's volume so it strengthens that one shape instead of
    // adding a second bright zone the eye would have to choose between.
    enemyVolleys: [
      { x: 1062, y: 232, n: 3, spread: 130 },
      { x: 1150, y: 314, n: 3, spread: 118 },
    ],
    sparkSeeds: [
      { x: 1130, y: 214, n: 18, colour: DRONE.kinds.striker.colour },
      { x: 1108, y: 356, n: 14, colour: DRONE.kinds.scout.colour },
      { x: 1140, y: 300, n: 15, colour: DRONE.kinds.bulwark.colour },
      { x: 1196, y: 272, n: 13, colour: DRONE.kinds.scout.colour },
      { x: 1062, y: 232, n: 14, colour: PALETTE.danger },
      { x: 1174, y: 332, n: 12, colour: DRONE.kinds.striker.colour },
    ],
    // Score popups live with the swarm, never over the hero: a number beside the mech would fight
    // the ship for the same space and read as clutter.
    floats: [
      { x: 1122, y: 250, text: '+420', colour: PALETTE.gold },
      { x: 1210, y: 350, text: '+250', colour: PALETTE.gold },
    ],
  },

  // Title card over a live arena — scouts already drifting in, fire already in the air,
  // so the cover shows the game rather than a menu floating in darkness.
  start: {
    seed: 771101,
    state: 'title',
    ship: { x: 640, y: 604, shields: 3, invuln: 0 },
    wave: 1,
    waveProgress: 0.24,
    score: 0,
    best: 0,
    combo: 1,
    elapsed: 0,
    drones: [
      ['scout', 176, 132], ['scout', 402, 96], ['scout', 664, 118],
      ['scout', 902, 148], ['scout', 1122, 108], ['scout', 296, 262],
      ['scout', 566, 232], ['scout', 840, 278], ['striker', 1046, 246],
    ],
    playerFire: 5,
    enemyFire: true,
    pickups: true,
    sparkSeeds: [
      { x: 902, y: 148, n: 12, colour: DRONE.kinds.scout.colour },
      { x: 296, y: 262, n: 10, colour: PALETTE.danger },
    ],
    floats: [],
  },

  // Mid-battle and busy: fourteen drones spread across the whole arena, fire in the air both
  // ways, pickups falling, score and combo populated. This is the fight, at its fullest.
  play: {
    seed: 48250,
    state: 'playing',
    ship: { x: 560, y: 588, shields: 3, invuln: 0 },
    wave: 5,
    waveProgress: 0.62,
    score: 48250,
    best: 61200,
    combo: 6,
    elapsed: 518,
    drones: [
      ['scout', 128, 118], ['scout', 286, 196], ['striker', 452, 96],
      ['scout', 604, 172], ['striker', 742, 108], ['scout', 884, 208],
      ['bulwark', 1012, 138], ['striker', 1156, 226], ['scout', 196, 330],
      ['striker', 372, 300], ['bulwark', 566, 358], ['scout', 792, 322],
      ['striker', 968, 384], ['scout', 1118, 420],
    ],
    playerFire: 7,
    enemyFire: true,
    pickups: true,
    sparkSeeds: [
      { x: 452, y: 96, n: 14, colour: PALETTE.danger },
      { x: 884, y: 208, n: 12, colour: DRONE.kinds.scout.colour },
      { x: 1012, y: 138, n: 16, colour: DRONE.kinds.bulwark.colour },
    ],
    floats: [
      { text: '+ 2 500', x: 840, y: 330, life: 0.42, maxLife: 0.9, combo: 6 },
    ],
  },

  // The win state: the sector cleared, the victory card up, wreckage still settling and the
  // mech holding the field — the cover that proves the run can actually be finished.
  end: {
    seed: 940081,
    state: 'victory',
    ship: { x: 640, y: 596, shields: 5, invuln: 0 },
    wave: 10,
    waveProgress: 1,
    score: 188420,
    best: 188420,
    combo: 1,
    elapsed: 1146,
    drones: [
      ['scout', 214, 152], ['scout', 1088, 178], ['striker', 396, 108],
      ['striker', 872, 128], ['bulwark', 640, 168],
      ['scout', 268, 330], ['striker', 1012, 302], ['bulwark', 486, 382],
      ['scout', 806, 396], ['striker', 1128, 396],
    ],
    playerFire: 4,
    enemyFire: false,
    pickups: false,
    sparkSeeds: [
      { x: 380, y: 300, n: 22, colour: PALETTE.gold },
      { x: 640, y: 210, n: 26, colour: PALETTE.accent },
      { x: 906, y: 320, n: 22, colour: PALETTE.gold },
      { x: 560, y: 430, n: 16, colour: PALETTE.danger },
      { x: 760, y: 400, n: 16, colour: PALETTE.ink },
      { x: 214, y: 152, n: 12, colour: DRONE.kinds.scout.colour },
      { x: 1012, y: 302, n: 12, colour: DRONE.kinds.striker.colour },
    ],
    floats: [],
    final: { score: 188420, best: 188420, wave: 10, kills: 132, shields: 5, elapsed: 1146 },
  },
});

// Rebuild the world into the requested pose. Pure staging: no simulation steps, so the
// capture is byte-identical every time.
export function applyShotPose(engine, poseName) {
  const pose = POSES[poseName];
  if (!pose || !engine) return false;

  engine.reseed ? engine.reseed(pose.seed) : null;
  const rand = engine.rand;

  clearPools(engine);

  engine.state = pose.state;
  engine.elapsed = pose.elapsed;
  engine.final = pose.final || null;
  // The pose owns presentation flags for its own frame (e.g. the cover strips the HUD back).
  engine.poseMinimalHud = pose.minimalHud === true;
  engine.swarmDim = typeof pose.swarmDim === 'number' ? pose.swarmDim : 1;

  engine.ship.x = pose.ship.x;
  engine.ship.y = pose.ship.y;
  engine.ship.vx = 0;
  engine.ship.vy = 0;
  engine.ship.shields = pose.ship.shields;
  engine.ship.invuln = pose.ship.invuln;
  engine.ship.heroScale = pose.ship.heroScale || 1;
  engine.ship.fireTimer = 0;
  engine.ship.alive = true;

  engine.score.score = pose.score;
  engine.score.best = pose.best;
  engine.score.combo = pose.combo;
  engine.score.comboTimer = pose.combo > 1 ? 2.4 : 0;
  engine.score.floats.length = 0;
  for (const f of pose.floats) engine.score.floats.push({ ...f });

  engine.director.wave = pose.wave;
  engine.director.progress = pose.waveProgress;
  engine.director.remaining = 0;
  engine.director.spawnQueue.length = 0;
  engine.director.breather = 0;

  for (const [kind, x, y] of pose.drones) seedDrone(engine, kind, x, y, rand);

  if (pose.playerFire) seedPlayerFire(engine, pose.ship.x, pose.ship.y, pose.playerFire, rand);
  if (pose.enemyFire) seedEnemyFire(engine, pose.ship.x, pose.ship.y - 20, rand, pose.enemyVolleys);
  if (pose.pickups) seedPickups(engine, rand);
  const sparkList = pose.sparkSeeds || pose.sparks || [];
  if (sparkList.length) seedSparks(engine, sparkList, rand);

  return true;
}

export default { readShotPose, applyShotPose, POSES, SHOT_NAMES };
