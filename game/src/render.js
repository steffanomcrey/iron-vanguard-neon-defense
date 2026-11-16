// All drawing for the playfield: the starfield, the arena grid, the mech, the
// drones and the shot trails. The renderer owns no game state — it reads the
// simulation and paints one frame, which keeps the visual layer free to be
// tuned without ever touching the rules.

import { FIELD, PALETTE, DRONE, FONT, SHIP } from './config.js';
import { drawParticle } from './particles.js';
import { drawPickup } from './pickups.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const stars = [];
  const rand = Math.random;
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: rand() * FIELD.width,
      y: rand() * FIELD.height,
      depth: 0.25 + rand() * 0.75,
      size: 0.6 + rand() * 1.7,
    });
  }
  return { ctx, stars };
}

/** Letterbox the fixed logical field into whatever window the player has. */
export function fitCanvas(renderer, canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = canvas.clientWidth || window.innerWidth;
  const targetHeight = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(targetWidth * dpr);
  canvas.height = Math.round(targetHeight * dpr);

  const scale = Math.min(targetWidth / FIELD.width, targetHeight / FIELD.height);
  const offsetX = (targetWidth - FIELD.width * scale) / 2;
  const offsetY = (targetHeight - FIELD.height * scale) / 2;

  renderer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.view = { scale, offsetX, offsetY, width: targetWidth, height: targetHeight };
}

function beginField(ctx, view) {
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  ctx.beginPath();
  ctx.rect(0, 0, FIELD.width, FIELD.height);
  ctx.clip();
}

function paintBackdrop(ctx, stars, elapsed) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.void);
  gradient.addColorStop(0.55, PALETTE.deep);
  gradient.addColorStop(1, '#060a14');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Drifting starfield: three depths, slow parallax, no per-frame allocation.
  for (const star of stars) {
    star.y += star.depth * 26 * 0.016;
    if (star.y > FIELD.height) {
      star.y = -4;
      star.x = Math.random() * FIELD.width;
    }
    ctx.globalAlpha = 0.25 + star.depth * 0.6;
    ctx.fillStyle = star.depth > 0.8 ? '#cfe6ff' : '#6f8bb5';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  // Perspective floor: horizon lines converging at centre give the arena depth.
  // Drawn brighter than a HUD grid would be, because the arena reads as empty
  // when the floor is only a couple of levels above the void behind it.
  ctx.strokeStyle = PALETTE.grid;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.2;
  const horizon = FIELD.height * 0.42;
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const x = t * FIELD.width;
    ctx.beginPath();
    ctx.moveTo(x, FIELD.height);
    ctx.lineTo(FIELD.width / 2 + (x - FIELD.width / 2) * 0.12, horizon);
    ctx.stroke();
  }
  for (let row = 0; row < 9; row += 1) {
    const depth = row / 9;
    const y = horizon + (FIELD.height - horizon) * depth * depth;
    ctx.globalAlpha = 0.34 + depth * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Horizon seam: a bright line where the floor meets the sky, which anchors
  // the whole composition instead of letting it fade into black.
  const seam = ctx.createLinearGradient(0, 0, FIELD.width, 0);
  seam.addColorStop(0, 'rgba(79, 214, 255, 0)');
  seam.addColorStop(0.5, 'rgba(79, 214, 255, 0.55)');
  seam.addColorStop(1, 'rgba(79, 214, 255, 0)');
  ctx.fillStyle = seam;
  ctx.fillRect(0, horizon - 1, FIELD.width, 2);

  // Nebula wash: two soft colour fields so the upper half is not flat navy.
  const nebulaA = ctx.createRadialGradient(FIELD.width * 0.22, FIELD.height * 0.2, 20,
    FIELD.width * 0.22, FIELD.height * 0.2, 420);
  nebulaA.addColorStop(0, 'rgba(120, 72, 200, 0.22)');
  nebulaA.addColorStop(1, 'rgba(120, 72, 200, 0)');
  ctx.fillStyle = nebulaA;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const nebulaB = ctx.createRadialGradient(FIELD.width * 0.82, FIELD.height * 0.34, 20,
    FIELD.width * 0.82, FIELD.height * 0.34, 460);
  nebulaB.addColorStop(0, 'rgba(26, 120, 190, 0.24)');
  nebulaB.addColorStop(1, 'rgba(26, 120, 190, 0)');
  ctx.fillStyle = nebulaB;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const glow = ctx.createRadialGradient(FIELD.width / 2, horizon, 10, FIELD.width / 2, horizon, 520);
  glow.addColorStop(0, 'rgba(79, 214, 255, 0.20)');
  glow.addColorStop(1, 'rgba(79, 214, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  void elapsed;
}

function paintShip(ctx, ship, elapsed) {
  if (!ship.alive) return;
  const blink = ship.invulnerable > 0 && Math.floor(ship.invulnerable * 12) % 2 === 0;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.globalAlpha = blink ? 0.42 : 1;

  // Engine plume: two tapered flames that flicker with the engine phase.
  const flicker = 0.72 + Math.sin(ship.enginePhase) * 0.28;
  for (const side of [-1, 1]) {
    const plume = ctx.createLinearGradient(side * 12, 26, side * 12, 26 + 48 * flicker);
    plume.addColorStop(0, 'rgba(255, 214, 102, 0.95)');
    plume.addColorStop(0.5, 'rgba(255, 122, 69, 0.55)');
    plume.addColorStop(1, 'rgba(255, 77, 109, 0)');
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(side * 12 - 6, 24);
    ctx.lineTo(side * 12 + 6, 24);
    ctx.lineTo(side * 12, 26 + 46 * flicker);
    ctx.closePath();
    ctx.fill();
  }

  // Hull: a swept interceptor silhouette with bright edge lighting.
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 22;
  const hull = ctx.createLinearGradient(0, -SHIP.height / 2, 0, SHIP.height / 2);
  hull.addColorStop(0, '#ffffff');
  hull.addColorStop(0.45, PALETTE.hull);
  hull.addColorStop(1, '#7fa6cc');
  ctx.fillStyle = hull;

  ctx.beginPath();
  ctx.moveTo(0, -SHIP.height / 2);
  ctx.lineTo(16, -6);
  ctx.lineTo(SHIP.width / 2, 16);
  ctx.lineTo(SHIP.width / 2 - 6, 26);
  ctx.lineTo(10, 20);
  ctx.lineTo(0, 30);
  ctx.lineTo(-10, 20);
  ctx.lineTo(-SHIP.width / 2 + 6, 26);
  ctx.lineTo(-SHIP.width / 2, 16);
  ctx.lineTo(-16, -6);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.accent;
  ctx.globalAlpha = blink ? 0.3 : 0.85;
  ctx.stroke();

  // Cockpit glass, tinted cyan, catches the arena glow.
  ctx.globalAlpha = blink ? 0.4 : 1;
  const glass = ctx.createLinearGradient(0, -22, 0, 6);
  glass.addColorStop(0, '#bff2ff');
  glass.addColorStop(1, PALETTE.accent);
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -8, 7.5, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shield ring appears only while the mech is briefly invulnerable.
  if (ship.invulnerable > 0) {
    ctx.globalAlpha = 0.25 + Math.sin(elapsed * 22) * 0.15;
    ctx.strokeStyle = PALETTE.health;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function paintDrone(ctx, drone) {
  const spec = DRONE.kinds[drone.kind];
  ctx.save();
  ctx.translate(drone.x, drone.y);
  ctx.shadowColor = spec.colour;
  ctx.shadowBlur = drone.kind === 'bulwark' ? 26 : 16;

  if (drone.kind === 'scout') {
    // Scout: arrowhead, points down at the player.
    ctx.fillStyle = drone.flash > 0 ? '#ffffff' : spec.colour;
    ctx.beginPath();
    ctx.moveTo(0, drone.radius);
    ctx.lineTo(drone.radius * 0.9, -drone.radius * 0.6);
    ctx.lineTo(0, -drone.radius * 0.1);
    ctx.lineTo(-drone.radius * 0.9, -drone.radius * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (drone.kind === 'striker') {
    // Striker: rotating tri-blade, reads as aggressive even when static.
    ctx.rotate(drone.spin);
    ctx.fillStyle = drone.flash > 0 ? '#ffffff' : spec.colour;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(drone.radius, -drone.radius * 0.42);
      ctx.lineTo(drone.radius * 0.55, drone.radius * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.rotate((Math.PI * 2) / 3);
    }
  } else {
    // Bulwark: heavy hex plate with an inner core that lights its health.
    ctx.fillStyle = drone.flash > 0 ? '#ffffff' : spec.colour;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const px = Math.cos(angle) * drone.radius;
      const py = Math.sin(angle) * drone.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    const ratio = drone.hp / drone.maxHp;
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + ratio * 0.55})`;
    ctx.beginPath();
    ctx.arc(0, 0, drone.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(5, 6, 12, 0.65)';
  ctx.stroke();
  ctx.restore();
}

function paintBullets(ctx, bullets) {
  bullets.forEachActive((b) => {
    ctx.save();
    if (b.fromEnemy) {
      // Enemy fire: a fat hot core inside a wide halo. Big and red on purpose —
      // a hostile bolt must be the loudest thing in the frame after the mech.
      const halo = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 18);
      halo.addColorStop(0, 'rgba(255, 77, 109, 0.85)');
      halo.addColorStop(0.45, 'rgba(255, 77, 109, 0.32)');
      halo.addColorStop(1, 'rgba(255, 77, 109, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff0f4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = PALETTE.danger;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const trail = ctx.createLinearGradient(0, b.y - 22, 0, b.y + 12);
      trail.addColorStop(0, 'rgba(79, 214, 255, 0)');
      trail.addColorStop(0.5, '#bff2ff');
      trail.addColorStop(1, PALETTE.accent);
      ctx.shadowColor = PALETTE.accent;
      ctx.shadowBlur = 16;
      ctx.fillStyle = trail;
      ctx.fillRect(b.x - b.width / 2, b.y - 14, b.width, 26);
    }
    ctx.restore();
  });
}

function paintParticles(ctx, particles) {
  particles.forEachActive((p) => drawParticle(ctx, p));
  ctx.globalAlpha = 1;
}

function paintPickups(ctx, pickups) {
  pickups.forEachActive((item) => drawPickup(ctx, item));
}

/** Paint one complete frame of the playfield. */
export function drawWorld(renderer, world) {
  const { ctx } = renderer;
  beginField(ctx, renderer.view);
  paintBackdrop(ctx, renderer.stars, world.elapsed);
  paintPickups(ctx, world.pickups);
  paintParticles(ctx, world.particles);
  world.drones.forEachActive((drone) => paintDrone(ctx, drone));
  paintBullets(ctx, world.bullets);
  paintShip(ctx, world.ship, world.elapsed);
  ctx.restore();
  void FONT;
}
