// Fixed-size object pools. No allocation during play, no GC hitches mid-wave.

export function createPool(size, make) {
  const items = [];
  for (let i = 0; i < size; i += 1) {
    const item = make();
    item.active = false;
    items.push(item);
  }

  function spawn(...args) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.active) {
        item.active = true;
        if (typeof item.reset === 'function') item.reset(...args);
        return item;
      }
    }
    return null;
  }

  function countActive() {
    let n = 0;
    for (let i = 0; i < items.length; i += 1) if (items[i].active) n += 1;
    return n;
  }

  function releaseAll() {
    for (let i = 0; i < items.length; i += 1) items[i].active = false;
  }

  return { items, size: items.length, spawn, countActive, releaseAll };
}

export function jitter(rand, amount) {
  return rand.range(-amount, amount);
}
