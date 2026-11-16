// Circle-versus-rectangle and circle-versus-circle overlap tests, plus the
// small vector helpers the systems share. Kept apart from the systems so the
// collision rules are readable on their own.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function circleHitsRect(cx, cy, radius, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.width);
  const ny = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= radius * radius;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy <= reach * reach;
}

/** Distance an entity travels this step; used so fast shots never tunnel. */
export function travel(speed, dt) {
  return speed * dt;
}
