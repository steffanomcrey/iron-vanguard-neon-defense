// Object pools for bullets, enemies, particles and pickups.
// Everything is allocated up front, so a long run never triggers a garbage
// collection spike mid-wave — the frame time stays flat however busy it gets.

export function createPool(size, make) {
  const items = new Array(size);
  for (let i = 0; i < size; i += 1) {
    items[i] = make();
    items[i].active = false;
  }
  return {
    items,
    /** Hand back the next free slot, or null when the pool is exhausted. */
    spawn() {
      for (let i = 0; i < items.length; i += 1) {
        if (!items[i].active) {
          items[i].active = true;
          return items[i];
        }
      }
      return null;
    },
    forEachActive(fn) {
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].active) fn(items[i]);
      }
    },
    countActive() {
      let n = 0;
      for (let i = 0; i < items.length; i += 1) if (items[i].active) n += 1;
      return n;
    },
    clear() {
      for (let i = 0; i < items.length; i += 1) items[i].active = false;
    },
  };
}

/** Randomised spawn helper used by the wave director and the pickup table. */
export function jitter(rand, amount) {
  return (rand() * 2 - 1) * amount;
}
