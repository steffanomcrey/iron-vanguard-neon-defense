// Every draw call. Render reads state; it never mutates it.

import { FIELD, PALETTE, SHIP } from './config.js';
import { drawParticle } from './particles.js';
import { drawPickup } from './pickups.js';

const stars = [];

export function seedStars(rand, count = 140) {
  stars.length = 0;
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rand.range(0, FIELD.w),
      y: rand.range(0, FIELD.h),
      z: rand.range(0.25, 1),
      r: rand.range(0.6, 1.9),
    });
  }
  return stars;
}

export function clear(ctx) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
}

export function drawBackdrop(ctx, t) {
  glows.length = 0;
  glowCount = 0;
  _bg = null;
  _horizon = null;

  // The arena floor is the hero of the frame: a lit deck receding to a horizon seam,
  // not a black void. Bright enough that the playfield reads as a place.
  // The horizon sits high so the deck — where the fight happens — fills most of the frame.
  const HORIZON = 176;
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD.h);
  bg.addColorStop(0, '#060a18');
  bg.addColorStop(0.22, '#0d1c42');
  bg.addColorStop(0.34, '#14305e');
  bg.addColorStop(1, '#0a1730');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);

  // Deep-space wash above the horizon, so the sky has colour too.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, 'rgba(41, 88, 168, 0.42)');
  sky.addColorStop(0.62, 'rgba(24, 54, 116, 0.24)');
  sky.addColorStop(1, 'rgba(10, 22, 54, 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD.w, HORIZON);

  // Starfield drifts downward at a per-star depth rate.
  ctx.save();
  for (let i = 0; i < stars.length; i += 1) {
    const s = stars[i];
    s.y += s.z * 26 * (1 / 60);
    if (s.y > FIELD.h) {
      s.y -= FIELD.h;
      s.x = (s.x + 137.5) % FIELD.w;
    }
    ctx.globalAlpha = 0.35 + s.z * 0.65;
    ctx.fillStyle = s.z > 0.7 ? PALETTE.ink : PALETTE.muted;
    const r = s.r * (1 + s.z);
    ctx.fillRect(s.x, s.y, r, r);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Perspective deck: lines converge on a vanishing point at the horizon, and depth rows
  // compress as they approach it. This is what makes the frame read as a floor rather than
  // empty space — keep it clearly visible.
  ctx.save();
  const vpx = FIELD.w * 0.5;

  // Converging rails. The deck is deliberately BLUE-violet, not the mech's cyan: the grid must
  // recede so the player's own fire stays the brightest cyan thing on the field.
  ctx.strokeStyle = 'rgba(74, 122, 224, 0.60)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 14; i += 1) {
    const x = (i / 14) * FIELD.w;
    ctx.beginPath();
    ctx.moveTo(vpx + (x - vpx) * 0.06, HORIZON);
    ctx.lineTo(vpx + (x - vpx) * 1.35, FIELD.h + 8);
    ctx.stroke();
  }

  // Depth rows, compressed toward the horizon: quadratic spacing. The nearer the row,
  // the brighter and heavier the line, so the deck has depth you can feel.
  const scroll = (t * 0.9) % 1;
  for (let i = 0; i <= 13; i += 1) {
    const k = (i + scroll) / 13;
    const y = HORIZON + k * k * (FIELD.h - HORIZON);
    if (y < HORIZON || y > FIELD.h + 2) continue;
    const fade = 0.20 + k * 0.58;
    ctx.strokeStyle = `rgba(80, 132, 232, ${fade})`;
    ctx.lineWidth = 1 + k * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.w, y);
    ctx.stroke();
  }
  ctx.restore();

  // Horizon seam — the lit edge where deck meets sky.
  const seam = ctx.createLinearGradient(0, HORIZON - 54, 0, HORIZON + 58);
  seam.addColorStop(0, 'rgba(74, 130, 240, 0)');
  seam.addColorStop(0.44, 'rgba(84, 142, 246, 0.22)');
  seam.addColorStop(0.5, 'rgba(140, 190, 255, 0.60)');
  seam.addColorStop(0.56, 'rgba(84, 142, 246, 0.22)');
  seam.addColorStop(1, 'rgba(74, 130, 240, 0)');
  ctx.fillStyle = seam;
  ctx.fillRect(0, HORIZON - 54, FIELD.w, 112);

  // Deck glow: the floor is lit strongly near the camera and falls off toward the horizon,
  // so the whole lower arena reads as a lit surface instead of flat black.
  const deck = ctx.createLinearGradient(0, HORIZON, 0, FIELD.h);
  deck.addColorStop(0, 'rgba(30, 74, 142, 0.18)');
  deck.addColorStop(0.35, 'rgba(38, 96, 178, 0.30)');
  deck.addColorStop(0.72, 'rgba(46, 118, 208, 0.34)');
  deck.addColorStop(1, 'rgba(52, 132, 226, 0.30)');
  ctx.fillStyle = deck;
  ctx.fillRect(0, HORIZON, FIELD.w, FIELD.h - HORIZON);

  // A soft pool of light under the arena's centre, where the mech holds the line.
  const pool = ctx.createRadialGradient(FIELD.w / 2, FIELD.h * 0.80, 40,
    FIELD.w / 2, FIELD.h * 0.80, 620);
  pool.addColorStop(0, 'rgba(96, 190, 255, 0.16)');
  pool.addColorStop(1, 'rgba(96, 190, 255, 0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, HORIZON, FIELD.w, FIELD.h - HORIZON);

  // Side lighting, framing the arena.
  const leftGlow = ctx.createLinearGradient(0, 0, 300, 0);
  leftGlow.addColorStop(0, 'rgba(58, 130, 220, 0.22)');
  leftGlow.addColorStop(1, 'rgba(58, 130, 220, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, 300, FIELD.h);

  const rightGlow = ctx.createLinearGradient(FIELD.w, 0, FIELD.w - 300, 0);
  rightGlow.addColorStop(0, 'rgba(58, 130, 220, 0.22)');
  rightGlow.addColorStop(1, 'rgba(58, 130, 220, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(FIELD.w - 300, 0, 300, FIELD.h);
}

export function drawBullet(ctx, b) {
  if (!b.active) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const grad = ctx.createLinearGradient(b.x, b.y - b.h * 0.5, b.x, b.y + b.h * 0.5);
  grad.addColorStop(0, 'rgba(95, 242, 255, 0)');
  grad.addColorStop(0.5, PALETTE.accent);
  grad.addColorStop(1, 'rgba(234, 246, 255, 0.95)');

  ctx.fillStyle = grad;
  ctx.fillRect(b.x - b.w * 0.5, b.y - b.h * 0.5, b.w, b.h);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.w * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawEnemyBullet(ctx, b) {
  if (!b.active) return;

  // Hostile fire is a HOT RED bolt with a white-hot core — deliberately not the magenta of the
  // scout drones and not the cyan of the player's fire. In a dense frame the player must never
  // mistake a bullet for an enemy or their own shot.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.6);
  halo.addColorStop(0, 'rgba(255, 46, 64, 0.98)');
  halo.addColorStop(0.35, 'rgba(255, 58, 72, 0.52)');
  halo.addColorStop(1, 'rgba(255, 46, 64, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // A trailing streak gives the bolt a direction of travel, so incoming fire reads as motion.
  const len = 34;
  const speed = Math.hypot(b.vx, b.vy) || 1;
  const nx = b.vx / speed;
  const ny = b.vy / speed;
  const trail = ctx.createLinearGradient(b.x, b.y, b.x - nx * len, b.y - ny * len);
  trail.addColorStop(0, 'rgba(255, 120, 120, 0.90)');
  trail.addColorStop(0.45, 'rgba(255, 46, 64, 0.55)');
  trail.addColorStop(1, 'rgba(255, 46, 64, 0)');
  ctx.strokeStyle = trail;
  ctx.lineWidth = b.radius * 1.25;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - nx * len, b.y - ny * len);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';

  // Bright ring, then a hot core: the highest-contrast thing the palette allows.
  ctx.strokeStyle = '#ff2e40';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius * 0.92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ff2e40';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius * 0.66, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff3f4';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawDrone(ctx, d, dim = 1) {
  if (!d.active) return;

  const r = d.radius;
  const colour = d.flash > 0 ? '#ffffff' : d.stats.colour;

  ctx.save();
  ctx.translate(d.x, d.y);
  // A shot may push the swarm back in luminance so the hero stays the only bright mass. Bloom is
  // what actually steals the eye, so dimming scales the halo and shadow rather than the shape.
  if (dim !== 1) ctx.globalAlpha = dim;

  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.8);
  halo.addColorStop(0, `rgba(255, 255, 255, ${0.14 * dim})`);
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = colour;
  ctx.fillStyle = `rgba(8, 12, 24, ${0.92 * Math.min(1, dim + 0.25)})`;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 12 * dim;

  ctx.beginPath();
  if (d.kind === 'scout') {
    ctx.moveTo(0, r);
    ctx.lineTo(r * 0.95, -r * 0.5);
    ctx.lineTo(0, -r * 0.1);
    ctx.lineTo(-r * 0.95, -r * 0.5);
  } else if (d.kind === 'striker') {
    ctx.moveTo(0, r);
    ctx.lineTo(r * 0.85, r * 0.1);
    ctx.lineTo(r * 0.5, -r * 0.85);
    ctx.lineTo(-r * 0.5, -r * 0.85);
    ctx.lineTo(-r * 0.85, r * 0.1);
  } else {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI * 0.5;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Damage pips for the multi-hit archetypes.
  if (d.maxHp > 1) {
    const w = r * 1.3;
    const hpFrac = Math.max(0, d.hp / d.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(-w * 0.5, r + 5, w, 3);
    ctx.fillStyle = colour;
    ctx.fillRect(-w * 0.5, r + 5, w * hpFrac, 3);
  }

  ctx.restore();
}

let _bg = null;
let _horizon = null;
let glows = [];
let glowCount = 0;

export function drawShip(ctx, ship) {
  const halfW = SHIP.w * 0.5;
  const halfH = SHIP.h * 0.5;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  // The pose can scale the mech up for the cover frame, where it is the focal subject.
  const heroScale = ship.heroScale || 1;
  if (heroScale !== 1) ctx.scale(heroScale, heroScale);

  // Flame first so it sits behind the hull.
  const flame = 0.6 + Math.sin(performance.now() * 0.02) * 0.12 + ship.thrust * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fg = ctx.createLinearGradient(0, halfH * 0.5, 0, halfH * 0.5 + 34 * flame);
  fg.addColorStop(0, 'rgba(95, 242, 255, 0.95)');
  fg.addColorStop(0.5, 'rgba(95, 242, 255, 0.35)');
  fg.addColorStop(1, 'rgba(95, 242, 255, 0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-8, halfH * 0.55);
  ctx.lineTo(8, halfH * 0.55);
  ctx.lineTo(0, halfH * 0.55 + 34 * flame);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const blink = ship.invuln > 0 && Math.floor(ship.invuln * 14) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;

  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(0, -halfH - 8);
    ctx.lineTo(halfW * 0.42, -halfH * 0.25);
    ctx.lineTo(halfW, halfH * 0.62);
    ctx.lineTo(halfW * 0.55, halfH * 0.5);
    ctx.lineTo(0, halfH * 0.78);
    ctx.lineTo(-halfW * 0.55, halfH * 0.5);
    ctx.lineTo(-halfW, halfH * 0.62);
    ctx.lineTo(-halfW * 0.42, -halfH * 0.25);
    ctx.closePath();
  };

  // The mech must never be a cyan outline on a cyan grid: it is a FILLED body with bright plating,
  // and it carries a dark rim so its silhouette always separates from the deck behind it.
  // Mass + contrast is what makes it read as the protagonist instead of another glowing line.
  ctx.shadowColor = 'rgba(2, 6, 18, 0.95)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = 'rgba(3, 9, 22, 0.98)';
  hull();
  ctx.fill();
  ctx.shadowBlur = 0;

  const body = ctx.createLinearGradient(0, -halfH, 0, halfH);
  body.addColorStop(0, '#e8fbff');
  body.addColorStop(0.30, '#8ef0ff');
  body.addColorStop(0.62, '#2ec4e0');
  body.addColorStop(1, '#12586e');
  ctx.fillStyle = body;
  hull();
  ctx.fill();

  // Plating seams, drawn dark on the bright body.
  ctx.save();
  hull();
  ctx.clip();
  ctx.strokeStyle = 'rgba(4, 18, 34, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -halfH - 6);
  ctx.lineTo(0, halfH * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.92, halfH * 0.34);
  ctx.lineTo(halfW * 0.92, halfH * 0.34);
  ctx.stroke();
  ctx.restore();

  // Bright rim: the edge that catches light and defines the outline.
  ctx.strokeStyle = '#eaffff';
  ctx.lineWidth = 2.6;
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 22;
  hull();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cockpit: a dark visor with a hot core, so the mech has a "face".
  ctx.beginPath();
  ctx.moveTo(-9, halfH * 0.4);
  ctx.lineTo(0, -halfH - 2);
  ctx.lineTo(9, halfH * 0.4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 26, 44, 0.95)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Wing lights at the extremes, so the widest points of the silhouette glow.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(-halfW * 0.86, halfH * 0.56, 2.6, 0, Math.PI * 2);
  ctx.arc(halfW * 0.86, halfH * 0.56, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;

  // Shield ring.
  if (ship.shields > 0) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.accentDim;
    ctx.globalAlpha = 0.28 + 0.06 * ship.shields;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, (halfW + 16 + ship.shields * 1.6) * heroScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export function drawParticles(ctx, pool) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const items = pool.items;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].active) drawParticle(ctx, items[i]);
  }
  ctx.restore();
}

export function drawPickups(ctx, pool) {
  const items = pool.items;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].active) drawPickup(ctx, items[i]);
  }
}

export function drawFloats(ctx, floats) {
  if (!floats || floats.length === 0) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 18px ui-monospace, SFMono-Regular, Menlo, monospace';

  for (let i = 0; i < floats.length; i += 1) {
    const f = floats[i];
    const t = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = t;
    ctx.fillStyle = f.text.includes('WAVE') ? PALETTE.gold : PALETTE.accent;
    ctx.fillText(f.text, f.x, f.y);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// A halo behind the mech for hero framing. Warm-white and much larger than any enemy glow, so the
// protagonist is the single brightest mass on the field and the eye settles on it first.
export function drawShipHalo(ctx, ship) {
  const scale = ship.heroScale || 1;
  if (scale <= 1) return;

  const r = (SHIP.h * 0.9 + 60) * scale;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, r);
  halo.addColorStop(0, 'rgba(210, 250, 255, 0.30)');
  halo.addColorStop(0.28, 'rgba(140, 235, 255, 0.13)');
  halo.addColorStop(0.62, 'rgba(90, 190, 255, 0.05)');
  halo.addColorStop(1, 'rgba(90, 190, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
