// A tiny seeded random generator so a wave plays out identically for everyone.
// Screenshot runs pass a seed in the query string, which is what makes the
// shots in screenshots/ reproducible rather than lucky.

export function makeRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    // xorshift32: small, fast, and good enough for gameplay variety.
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function randomInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

/** Alias kept for the boot path, which reads better as a factory name. */
export const createRandom = makeRandom;
