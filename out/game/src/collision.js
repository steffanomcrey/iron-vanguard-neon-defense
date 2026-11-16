// Geometry helpers. Deliberately tiny and allocation-light.

export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function circleHitsRect(cx, cy, cr, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= cr * cr;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

// Apply an entity's per-second velocity for dt seconds.
export function travel(entity, dt) {
  if (!entity) return entity;
  entity.x += (entity.vx || 0) * dt;
  entity.y += (entity.vy || 0) * dt;
  return entity;
}
