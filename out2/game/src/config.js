// Every tuning number, colour and layout constant for Iron Vanguard.
// One place to balance the game: no magic numbers live in the systems.
// The playfield is a fixed logical area the renderer scales to any window.

export const FIELD = { width: 1280, height: 720 };

/** The simulation runs at a fixed 60 Hz whatever the display refresh rate is. */
export const STEP = 1 / 60;

/** Player mech: a nimble craft that shoots upward and banks shield charge. */
export const SHIP = {
  width: 54,
  height: 62,
  speed: 620,
  fireCooldown: 0.16,
  invulnerableAfterHit: 1.8,
  startShields: 3,
  maxShields: 5,
};

/** Bullets the mech fires. Pooled; the pool is allocated once at boot. */
export const BULLET = {
  width: 6,
  height: 20,
  speed: 1180,
  damage: 1,
  poolSize: 96,
};

/** Drone swarm: three archetypes with distinct silhouettes, speeds and value.
 *  Enemy hues deliberately stay off the cyan the mech, its bullets and its
 *  pickups own: a player must never confuse a hostile with a friendly bolt. */
export const DRONE = {
  poolSize: 128,
  kinds: {
    scout:    { hp: 1, speed: 132, points: 40,  radius: 20, colour: '#ff6ec7', weave: 150 },
    striker:  { hp: 2, speed: 188, points: 90,  radius: 24, colour: '#ff7a45', weave: 40 },
    bulwark:  { hp: 5, speed: 84,  points: 260, radius: 34, colour: '#c168ff', weave: 0 },
  },
  fireInterval: { scout: 2.6, striker: 1.9, bulwark: 1.4 },
  bulletSpeed: 260,
};

/** Enemy shots: slow, fat and lake-red, so they never read as a star or a
 *  friendly laser against the dark floor. */
export const ENEMY_BULLET = {
  poolSize: 96,
  radius: 10,
  speed: 300,
};

/** Waves ramp difficulty step by step and give the player a breather between them. */
export const WAVE = {
  count: 10,
  firstSeed: 1337,
  breatherSeconds: 3.2,
  bannerSeconds: 2.1,
  spawnBase: 4,
  spawnPerWave: 2,
  bulwarkFrom: 3,
  strikerFrom: 2,
};

/** Pickups: shield cells restore defence, cores are pure score. */
export const PICKUP = {
  poolSize: 32,
  chance: 0.14,
  radius: 16,
  speed: 120,
  shieldPoints: 0,
  corePoints: 500,
};

/** Particle bursts for impacts, explosions and engine trails. */
export const PARTICLE = {
  poolSize: 512,
  gravity: 190,
  drag: 0.985,
};

export const SCORE = {
  waveClear: 1000,
  shieldPerfect: 2500,
  survivalPerSecond: 12,
};

/** One coherent palette so every screen reads as the same machine. */
export const PALETTE = {
  void: '#05060c',
  deep: '#0a0f1e',
  grid: '#12203a',
  horizon: '#1b3a6b',
  hull: '#e8f4ff',
  accent: '#4fd6ff',
  accentWarm: '#ffb347',
  danger: '#ff4d6d',
  gold: '#ffd166',
  health: '#63f7d2',
  text: '#eaf4ff',
  muted: '#5d7ba6',
  panel: 'rgba(10, 18, 34, 0.82)',
  panelEdge: 'rgba(79, 214, 255, 0.35)',
};

export const FONT = {
  display: '"Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

/** Where the best score is remembered in this browser. */
export const BEST_KEY = 'iron-vanguard.best';
