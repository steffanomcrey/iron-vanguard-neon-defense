// Fixed-timestep engine. All simulation happens at 60 Hz; the renderer does not.

import {
  FIELD,
  STEP,
  BULLET,
  ENEMY_BULLET,
  DRONE,
  PICKUPS,
  PARTICLES,
  PALETTE,
  SHIP,
} from './config.js';
import { createPool, jitter } from './pools.js';
import { createRandom } from './random.js';
import { createShip, updateShip, damageShip, grantShip, shipRect } from './ship.js';
import { updateDrone, hitDrone } from './drones.js';
import {
  createDirector,
  beginWave,
  completeWave,
  advanceDirector,
  waveComposition,
} from './waves.js';
import {
  createScore,
  registerKill,
  updateScore,
  addWaveBonus,
  rollPickup,
  finalWave,
} from './score.js';
import { spawnPickup, updatePickup, pickupTouchesShip, PICKUP_TYPES } from './pickups.js';
import { emitBurst, updateParticle } from './particles.js';
import { circlesOverlap, travel } from './collision.js';
import * as render from './render.js';
import * as hud from './hud.js';

function readSeed() {
  if (typeof window === 'undefined' || !window.location) return 0x9e3779b9;
  const params = new URLSearchParams(window.location.search || '');
  const raw = params.get('seed');
  if (raw === null) return 0x9e3779b9;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
}

export class Engine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.field = options.field || FIELD;
    this.seed = options.seed !== undefined ? options.seed : readSeed();
    this.input = options.input || null;

    this.rand = createRandom(this.seed);
    this.starsSeed = createRandom(this.seed ^ 0x5bf03635);

    render.seedStars(this.starsSeed);

    this.bullets = createPool(BULLET.poolSize, () => ({
      x: 0,
      y: 0,
      w: BULLET.w,
      h: BULLET.h,
      vx: 0,
      vy: 0,
      radius: BULLET.radius,
      damage: BULLET.damage,
    }));

    this.enemyBullets = createPool(ENEMY_BULLET.poolSize, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: ENEMY_BULLET.radius,
      damage: ENEMY_BULLET.damage,
    }));

    this.drones = createPool(DRONE.poolSize, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 1,
      maxHp: 1,
      radius: 20,
      kind: 'scout',
      stats: DRONE.kinds.scout,
      baseX: 0,
      phase: 0,
      age: 0,
      fireTimer: 0,
      flash: 0,
      score: 0,
    }));

    this.pickups = createPool(PICKUPS.poolSize, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      type: PICKUP_TYPES.shield,
      radius: PICKUPS.radius,
      age: 0,
      spin: 0,
    }));

    this.particles = createPool(PARTICLES.poolSize, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      colour: PALETTE.accent,
    }));

    this.ship = createShip();
    this.score = createScore();
    this.director = createDirector(this.rand);
    this.director.pool = this.drones;

    this.state = 'title';
    this.previousState = 'title';
    this.final = null;
    this.elapsed = 0;
    this.shotsFired = 0;
    this.kills = 0;
    this.bestCombo = 1;
    this.pausedFrom = 'playing';
    this.step = STEP;
    this.bound = { w: this.field.w, h: this.field.h };
    this.bulletJitter = 0.55;

    this.wavesTotal = finalWave();
  }

  handleEvent(e) {
    const type = e && e.type;

    if (type === 'keydown:Space' || type === 'keydown:Enter') {
      if (this.state === 'playing') return;
      if (this.state === 'paused') {
        this.state = 'playing';
        return;
      }
      this.reset();
      this.state = 'playing';
      return;
    }

    if (type === 'keydown:Escape' || type === 'keydown:KeyP') {
      if (this.state === 'playing') {
        this.previousState = 'playing';
        this.state = 'paused';
      } else if (this.state === 'paused') {
        this.state = this.previousState === 'paused' ? 'playing' : this.previousState;
      }
      return;
    }

    if (type === 'click' || type === 'pointerdown:start') {
      if (this.state === 'playing') return;
      if (this.state === 'paused') {
        this.state = 'playing';
        return;
      }
      this.reset();
      this.state = 'playing';
    }
  }

  reset() {
    this.rand = createRandom(this.seed);
    this.starsSeed = createRandom(this.seed ^ 0x5bf03635);
    render.seedStars(this.starsSeed);

    this.bullets.releaseAll();
    this.enemyBullets.releaseAll();
    this.drones.releaseAll();
    this.pickups.releaseAll();
    this.particles.releaseAll();

    this.ship = createShip();
    this.score = createScore();
    this.director = createDirector(this.rand);
    this.director.pool = this.drones;

    this.elapsed = 0;
    this.shotsFired = 0;
    this.kills = 0;
    this.bestCombo = 1;
    this.final = null;

    beginWave(this.director, 1);
  }

  update(dt) {
    if (dt <= 0) return;

    if (this.state === 'playing') {
      this.elapsed += dt;
      this.simulate(dt);
      return;
    }

    if (this.state === 'title' || this.state === 'attract') {
      this.spectate(dt);
      return;
    }

    if (this.state === 'wave-intro' || this.state === 'wave-clear') {
      this.spectate(dt);
    }
  }

  spectate(dt) {
    for (let i = 0; i < this.particles.items.length; i += 1) {
      const p = this.particles.items[i];
      if (p.active) updateParticle(p, dt);
    }
  }

  simulate(dt) {
    const input = this.input || this.blankInput();

    updateShip(this.ship, input, dt, this.field);

    if (input.fire && this.ship.fireTimer <= 0 && this.ship.alive) {
      this.playerFire();
    }

    this.fireDrones(dt);
    this.advanceSpawns(dt);
    this.moveEntities(dt);
    this.resolvePlayerShots();
    this.resolveEnemyThreats();
    this.collectPickups();
    this.cullAndAnimate(dt);
    this.advanceWaves();
    updateScore(this.score, dt);

    if (!this.ship.alive) {
      this.gameOver();
    }
  }

  blankInput() {
    return {
      left: false,
      right: false,
      fire: false,
      pointerActive: false,
      pointerX: this.field.w * 0.5,
      pointerY: this.field.h * 0.9,
    };
  }

  playerFire() {
    const gunY = this.ship.y - SHIP.h * 0.5 - 6;
    const jitterAmount = this.bulletJitter;

    const offsets = [-14, 14];
    for (let i = 0; i < offsets.length; i += 1) {
      const b = this.bullets.spawn();
      if (!b) break;
      b.x = this.ship.x + offsets[i] + jitter(this.rand, jitterAmount);
      b.y = gunY;
      b.w = BULLET.w;
      b.h = BULLET.h;
      b.vx = jitter(this.rand, 18);
      b.vy = -BULLET.speed;
      b.radius = BULLET.radius;
      b.damage = BULLET.damage;
      b.active = true;
    }

    this.ship.fireTimer = SHIP.fireCooldown;
    this.shotsFired += 2;

    emitBurst(this.particles, this.ship.x, gunY, 3, PALETTE.accent, this.rand);
  }

  fireDrones(dt) {
    const pool = this.drones.items;
    for (let i = 0; i < pool.length; i += 1) {
      const d = pool[i];
      if (!d.active) continue;
      if (d.fireTimer > 0) continue;
      // Only hostiles that have actually entered the playfield shoot.
      if (d.y < 20) {
        d.fireTimer = 0.4;
        continue;
      }

      this.spawnEnemyShot(d);
      d.fireTimer = d.fireInterval * this.rand.range(0.85, 1.2);
    }
    void dt;
  }

  spawnEnemyShot(d) {
    const b = this.enemyBullets.spawn();
    if (!b) return null;

    const dx = this.ship.x - d.x;
    const dy = this.ship.y - d.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = ENEMY_BULLET.speed * (d.kind === 'bulwark' ? 1.2 : 1);

    b.x = d.x;
    b.y = d.y + d.radius * 0.5;
    b.vx = (dx / len) * speed;
    b.vy = (dy / len) * speed;
    b.radius = ENEMY_BULLET.radius;
    b.damage = ENEMY_BULLET.damage;
    b.active = true;

    return b;
  }

  advanceSpawns(dt) {
    const before = this.director.remaining;
    advanceDirector(this.director, dt);
    // A drone entering the field counts as spawned; culling subtracts from remaining.
    this.director.remaining = before;
  }

  moveEntities(dt) {
    const items = this.bullets.items;
    for (let i = 0; i < items.length; i += 1) {
      const b = items[i];
      if (!b.active) continue;
      travel(b, dt);
      if (b.y + b.h * 0.5 < -20) b.active = false;
    }

    const shots = this.enemyBullets.items;
    for (let i = 0; i < shots.length; i += 1) {
      const b = shots[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y - b.radius > this.field.h + 20) b.active = false;
      else if (b.y + b.radius < -40) b.active = false;
      else if (b.x < -60 || b.x > this.field.w + 60) b.active = false;
    }

    const drones = this.drones.items;
    for (let i = 0; i < drones.length; i += 1) {
      const d = drones[i];
      if (d.active) updateDrone(d, dt, this.field);
    }

    const drops = this.pickups.items;
    for (let i = 0; i < drops.length; i += 1) {
      const p = drops[i];
      if (p.active) updatePickup(p, dt, this.field);
    }
  }

  resolvePlayerShots() {
    const bullets = this.bullets.items;
    const drones = this.drones.items;

    for (let i = 0; i < bullets.length; i += 1) {
      const b = bullets[i];
      if (!b.active) continue;

      for (let j = 0; j < drones.length; j += 1) {
        const d = drones[j];
        if (!d.active) continue;
        if (d.y < -d.radius) continue;

        if (circlesOverlap(b.x, b.y, b.radius, d.x, d.y, d.radius)) {
          b.active = false;
          const died = hitDrone(d, b.damage);
          if (died) this.killDrone(d);
          else emitBurst(this.particles, b.x, b.y, 4, d.stats.colour, this.rand);
          break;
        }
      }
    }
  }

  killDrone(d) {
    this.kills += 1;
    registerKill(this.score, d);
    if (this.score.combo > this.bestCombo) this.bestCombo = this.score.combo;

    emitBurst(this.particles, d.x, d.y, 14, d.stats.colour, this.rand);
    emitBurst(this.particles, d.x, d.y, 6, PALETTE.ink, this.rand);

    if (this.director.remaining > 0) this.director.remaining -= 1;

    const drop = rollPickup(this.rand, d.kind);
    if (drop === 'shield') spawnPickup(this.pickups, PICKUP_TYPES.shield, d.x, d.y);
    else if (drop === 'core') spawnPickup(this.pickups, PICKUP_TYPES.core, d.x, d.y);
  }

  resolveEnemyThreats() {
    if (!this.ship.alive) return;

    const rect = shipRect(this.ship);
    const shots = this.enemyBullets.items;

    for (let i = 0; i < shots.length; i += 1) {
      const b = shots[i];
      if (!b.active) continue;
      if (circlesOverlap(b.x, b.y, b.radius, this.ship.x, this.ship.y, SHIP.hitRadius)) {
        b.active = false;
        this.damagePlayer();
      }
    }

    const drones = this.drones.items;
    for (let j = 0; j < drones.length; j += 1) {
      const d = drones[j];
      if (!d.active) continue;
      if (circlesOverlap(d.x, d.y, d.radius, this.ship.x, this.ship.y, SHIP.hitRadius)) {
        d.active = false;
        if (d.kind !== 'bulwark') {
          emitBurst(this.particles, d.x, d.y, 10, d.stats.colour, this.rand);
          if (this.director.remaining > 0) this.director.remaining -= 1;
        }
        this.damagePlayer();
      }
    }
    void rect;
  }

  damagePlayer() {
    const wasInvuln = this.ship.invuln > 0;
    const destroyed = damageShip(this.ship);
    if (wasInvuln) return;

    this.score.combo = 1;
    this.score.comboTimer = 0;
    emitBurst(this.particles, this.ship.x, this.ship.y, 12, PALETTE.accent, this.rand);

    if (destroyed) {
      emitBurst(this.particles, this.ship.x, this.ship.y, 26, PALETTE.danger, this.rand);
      emitBurst(this.particles, this.ship.x, this.ship.y, 18, PALETTE.ink, this.rand);
    }
  }

  collectPickups() {
    if (!this.ship.alive) return;

    const drops = this.pickups.items;
    for (let i = 0; i < drops.length; i += 1) {
      const p = drops[i];
      if (!p.active) continue;
      if (!pickupTouchesShip(p, this.ship)) continue;

      p.active = false;

      if (p.type === PICKUP_TYPES.shield) {
        const gained = grantShip(this.ship, 1);
        emitBurst(this.particles, p.x, p.y, gained > 0 ? 12 : 6, PALETTE.accent, this.rand);
      } else {
        this.score.score += 500;
        if (this.score.score > this.score.best) this.score.best = this.score.score;
        this.score.floats.push({
          x: p.x,
          y: p.y,
          text: '+500',
          life: 1.1,
          maxLife: 1.1,
        });
        emitBurst(this.particles, p.x, p.y, 12, PALETTE.accent, this.rand);
      }
    }
  }

  cullAndAnimate(dt) {
    const particles = this.particles.items;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (p.active) updateParticle(p, dt);
    }
  }

  advanceWaves() {
    const director = this.director;

    if (this.state !== 'playing') return;

    if (director.cleared && director.breather > 0) {
      const next = director.wave + 1;
      if (next > this.wavesTotal) {
        this.victory();
        return;
      }
    }

    const waveEmpty = director.remaining <= 0 && director.spawnQueue.length === 0;
    const noLiveDrones = this.drones.countActive() === 0;

    if (!director.cleared && waveEmpty && noLiveDrones) {
      completeWave(director);
      addWaveBonus(this.score, director.wave, this.ship.shields);
      emitBurst(this.particles, this.field.w * 0.5, 120, 24, PALETTE.gold, this.rand);
    }

    if (director.cleared && director.breather <= 0) {
      const next = director.wave + 1;
      if (next > this.wavesTotal) {
        this.victory();
      } else {
        beginWave(director, next);
        director.pool = this.drones;
      }
    }
  }

  gameOver() {
    this.final = {
      score: this.score.score,
      best: this.score.best,
      wave: this.director.wave,
      elapsed: this.elapsed,
      kills: this.kills,
      combo: this.bestCombo,
      outcome: 'defeat',
    };
    this.state = 'gameover';
  }

  victory() {
    this.final = {
      score: this.score.score,
      best: this.score.best,
      wave: this.wavesTotal,
      elapsed: this.elapsed,
      kills: this.kills,
      combo: this.bestCombo,
      outcome: 'victory',
    };
    this.state = 'victory';
  }

  render() {
    const ctx = this.ctx;
    const t = this.elapsed;

    render.clear(ctx);
    render.drawBackdrop(ctx, t);

    render.drawPickups(ctx, this.pickups);

    const shots = this.enemyBullets.items;
    for (let i = 0; i < shots.length; i += 1) {
      if (shots[i].active) render.drawEnemyBullet(ctx, shots[i]);
    }

    const drones = this.drones.items;
    for (let i = 0; i < drones.length; i += 1) {
      if (drones[i].active) render.drawDrone(ctx, drones[i], this.swarmDim);
    }

    const bullets = this.bullets.items;
    for (let i = 0; i < bullets.length; i += 1) {
      if (bullets[i].active) render.drawBullet(ctx, bullets[i]);
    }

    render.drawParticles(ctx, this.particles);

    if (this.ship.alive || this.state === 'playing') {
      // Halo first, then the mech on top of it: the light belongs behind the hero, not over it.
      render.drawShipHalo(ctx, this.ship);
      render.drawShip(ctx, this.ship);
    }

    render.drawFloats(ctx, this.score.floats);

    if (this.state === 'playing' || this.state === 'paused') {
      hud.drawHud(ctx, {
        ship: this.ship,
        score: this.score,
        wave: this.director.wave,
        wavesTotal: this.wavesTotal,
        waveProgress: this.director.progress,
        elapsed: this.elapsed,
        // Presentation flag owned by the active shot pose. Without this the cover pose renders a
        // full live HUD, which buries the composition under stats.
        poseMinimalHud: this.poseMinimalHud === true,
      });
    }

    if (this.state !== 'playing') {
      hud.drawOverlay(ctx, {
        state: this.state,
        final: this.final,
        wavesTotal: this.wavesTotal,
      });
    }
  }

  snapshot() {
    return {
      state: this.state,
      wave: this.director.wave,
      wavesTotal: this.wavesTotal,
      score: this.score.score,
      best: this.score.best,
      shields: this.ship.shields,
      elapsed: this.elapsed,
      kills: this.kills,
      dronesActive: this.drones.countActive(),
      remaining: this.director.remaining,
      queued: this.director.spawnQueue.length,
      final: this.final,
      seed: this.seed,
      composition: waveComposition(this.director.wave).length,
    };
  }
}

export default Engine;
