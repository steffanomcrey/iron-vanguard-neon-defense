// Bootstrap: canvas sizing, fixed-step loop, input wiring, debug hooks.

import { FIELD, STEP } from './config.js';
import { createInput } from './input.js';
import { Engine } from './engine.js';
import { formatTime } from './hud.js';
import { readShotPose, applyShotPose } from './shots.js';

const MAX_FRAME_DT = 0.25;

function readSeed() {
  if (typeof window === 'undefined' || !window.location) return 0x9e3779b9;
  const params = new URLSearchParams(window.location.search || '');
  const raw = params.get('seed');
  if (raw === null) return 0x9e3779b9;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
}

function fatal(message) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('status');
  if (el) el.textContent = `Iron Vanguard failed to start: ${message}`;
}

export function createGame(canvas, options = {}) {
  const engine = new Engine(canvas, {
    seed: options.seed !== undefined ? options.seed : readSeed(),
    input: null,
  });

  const input = createInput(canvas, FIELD);
  engine.input = input;

  function trigger(type) {
    engine.handleEvent({ type });
  }

  // Keyboard events drive menu transitions; the input module owns movement and fire.
  const keyBridge = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      trigger(`keydown:${e.code === 'Enter' ? 'Enter' : 'Space'}`);
      if (e.preventDefault) e.preventDefault();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      trigger(`keydown:${e.code}`);
      if (e.preventDefault) e.preventDefault();
    }
  };

  let downAt = 0;
  const pointerBridge = (e) => {
    if (engine.state === 'playing') return;
    downAt = performance.now();
    trigger('pointerdown:start');
    void e;
  };

  return { engine, input, keyBridge, pointerBridge, downAt };
}

export function start(canvas, options = {}) {
  const ctx = canvas.getContext('2d');

  const engine = new Engine(canvas, {
    seed: options.seed !== undefined ? options.seed : readSeed(),
    input: null,
  });

  const input = createInput(canvas, FIELD);
  engine.input = input;
  input.attach(window);

  // A requested screenshot pose replaces the live game with a frozen stage: every frame
  // rebuilds the pose and paints it, and nothing is stepped or drawn at random. This is how
  // the entry's captures are produced, so they are reproducible rather than lucky.
  const shotPose = options.shot !== undefined ? options.shot : readShotPose();

  let raf = 0;
  let last = performance.now();
  let accumulator = 0;
  let running = true;

  function bridgeKey(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      engine.handleEvent({ type: 'keydown:Space' });
      if (e.preventDefault) e.preventDefault();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      engine.handleEvent({ type: `keydown:${e.code}` });
      if (e.preventDefault) e.preventDefault();
    }
  }

  function bridgePointer(e) {
    if (engine.state === 'playing') return;
    engine.handleEvent({ type: 'pointerdown:start' });
    void e;
  }

  window.addEventListener('keydown', bridgeKey);
  canvas.addEventListener('pointerdown', bridgePointer);

  function frame(now) {
    if (!running) return;

    let dt = (now - last) / 1000;
    last = now;

    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

    if (shotPose) {
      applyShotPose(engine, shotPose);
      engine.render();
      updateStatus(engine);
      raf = window.requestAnimationFrame(frame);
      return;
    }

    accumulator += dt;

    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      engine.update(STEP);
      accumulator -= STEP;
      steps += 1;
    }

    if (steps === 0 && engine.state !== 'playing') {
      engine.update(Math.min(dt, STEP));
    }

    engine.render();
    updateStatus(engine);

    raf = window.requestAnimationFrame(frame);
  }

  raf = window.requestAnimationFrame(frame);

  const handle = {
    engine,
    input,
    stop() {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', bridgeKey);
      canvas.removeEventListener('pointerdown', bridgePointer);
      input.detach(window);
    },
  };

  return handle;
}

let lastStatus = '';

function updateStatus(engine) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('status');
  if (!el) return;

  let text;
  const snap = engine.snapshot();

  switch (snap.state) {
    case 'title':
      text = 'Iron Vanguard: Neon Defense \u2014 press Space to begin.';
      break;
    case 'playing':
      text = `Wave ${snap.wave}/${snap.wavesTotal} \u00b7 score ${snap.score} \u00b7 integrity ${snap.shields} \u00b7 ${formatTime(snap.elapsed)}`;
      break;
    case 'paused':
      text = 'Paused \u2014 press Esc to resume.';
      break;
    case 'gameover':
      text = `Mech down \u2014 score ${snap.final ? snap.final.score : snap.score} \u00b7 press Space to redeploy.`;
      break;
    case 'victory':
      text = `Sector secured \u2014 score ${snap.final ? snap.final.score : snap.score} \u00b7 press Space for a new run.`;
      break;
    default:
      text = 'Iron Vanguard: Neon Defense';
  }

  if (text !== lastStatus) {
    lastStatus = text;
    el.textContent = text;
  }
}

function boot() {
  if (typeof document === 'undefined') return;

  const canvas = document.getElementById('game');
  if (!canvas) {
    fatal('canvas element #game not found');
    return;
  }

  canvas.width = FIELD.w;
  canvas.height = FIELD.h;
  canvas.tabIndex = 0;

  let handle;
  try {
    handle = start(canvas);
  } catch (err) {
    fatal(err && err.message ? err.message : 'unknown error');
    return;
  }

  // Debug surface: stays quiet for players, gives tests a deterministic hook.
  const debug = {
    engine: handle.engine,
    snapshot: () => handle.engine.snapshot(),
    seed: handle.engine.seed,
    step(n = 1) {
      for (let i = 0; i < n; i += 1) handle.engine.update(STEP);
    },
    run(seconds) {
      const steps = Math.max(0, Math.floor(seconds / STEP));
      for (let i = 0; i < steps; i += 1) handle.engine.update(STEP);
      return handle.engine.snapshot();
    },
    start() {
      handle.engine.reset();
      handle.engine.state = 'playing';
      return handle.engine.snapshot();
    },
    pause() {
      handle.engine.handleEvent({ type: 'keydown:Escape' });
      return handle.engine.snapshot();
    },
    resume() {
      handle.engine.handleEvent({ type: 'keydown:Space' });
      return handle.engine.snapshot();
    },
    stop: handle.stop,
  };

  window.IV_DEBUG = debug;
  window.IV_GAME = handle.engine;

  canvas.focus();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

export default { start, createGame };
