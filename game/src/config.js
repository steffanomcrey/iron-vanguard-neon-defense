// Tunable constants for Iron Vanguard: Neon Defense.
// Everything frozen so a running match cannot drift the rules out from under itself.

export const FIELD = Object.freeze({ w: 1280, h: 720 });

export const STEP = 1 / 60;

export const SHIP = Object.freeze({
  w: 54,
  h: 62,
  speed: 620,
  fireCooldown: 0.16,
  invuln: 1.8,
  shields: 3,
  maxShields: 5,
  hitRadius: 18,
});

export const BULLET = Object.freeze({
  w: 9,
  h: 30,
  speed: 1180,
  poolSize: 96,
  radius: 7,
  damage: 1,
});

export const ENEMY_BULLET = Object.freeze({
  poolSize: 96,
  radius: 15,
  speed: 300,
  damage: 1,
});

export const DRONE = Object.freeze({
  poolSize: 128,
  kinds: Object.freeze({
    // Drone hues are split by ARCHETYPE so the player reads threat class by colour alone:
    // scout = cool magenta/pink, striker = amber/orange, bulwark = violet. None of them may be
    // cyan (the mech's own fire) and none may be red (reserved for incoming fire).
    // Weaves wide, dies to one hit, rarely fires.
    scout: Object.freeze({
      hp: 1,
      speed: 150,
      radius: 20,
      score: 100,
      fireInterval: 2.6,
      colour: '#ff4fd8',
      weave: 46,
    }),
    // Presses straight in, fires steadily.
    striker: Object.freeze({
      hp: 3,
      speed: 105,
      radius: 24,
      score: 250,
      fireInterval: 1.9,
      colour: '#ffa62b',
      weave: 22,
    }),
    // Slow, soaks hits, worth the most.
    bulwark: Object.freeze({
      hp: 5,
      speed: 62,
      radius: 32,
      score: 420,
      fireInterval: 1.4,
      colour: '#a259ff',
      weave: 10,
    }),
  }),
});

export const WAVES = Object.freeze({
  count: 10,
  breather: 2.4,
  baseCount: 5,
});

export const PICKUPS = Object.freeze({
  poolSize: 24,
  fallSpeed: 130,
  radius: 14,
});

export const PARTICLES = Object.freeze({
  poolSize: 320,
  life: 0.55,
});

// Cyan is reserved for the player's mech, its bolts and its pickups. No hostile uses it.
export const PALETTE = Object.freeze({
  bg: '#05070f',
  deep: '#0a1430',
  // Deck lines are BLUE-VIOLET and sit under everything, so no gameplay object can be mistaken
  // for scenery and the grid never competes with the player's fire.
  grid: '#4a7ae0',
  horizon: '#5f8ef0',
  // Cyan is reserved: the mech, its bolts and the HUD. Nothing hostile may use it.
  accent: '#5ff2ff',
  accentDim: '#2e8f9e',
  ink: '#eaf6ff',
  muted: '#8fa8c9',
  // Hot red is reserved for incoming fire. Nothing else in the game may be red.
  danger: '#ff2e40',
  good: '#57e6a0',
  gold: '#ffd166',
});
