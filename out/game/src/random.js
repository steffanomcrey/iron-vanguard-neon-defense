// One seeded generator for the whole game. Same seed, same arena — no Math.random anywhere.

function normaliseSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    // Fold into uint32 and refuse the all-zero state, which xorshift32 cannot leave.
    let s = Math.trunc(seed) >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return s;
  }
  if (typeof seed === 'string' && seed.length > 0) {
    // FNV-1a over the string so ?seed=hello works too.
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h === 0 ? 0x9e3779b9 : h;
  }
  return 0x9e3779b9;
}

export function makeRandom(seed) {
  let state = normaliseSeed(seed);

  function next() {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    if (hi < lo) return lo;
    return lo + Math.floor(next() * (hi - lo + 1));
  }

  function pick(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[int(0, array.length - 1)];
  }

  return { next, range, int, pick };
}

// Modules elsewhere import the factory by this name.
export const createRandom = makeRandom;

export default makeRandom;
