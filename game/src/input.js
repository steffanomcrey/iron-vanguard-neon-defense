// Keyboard and pointer input, normalised into one small state object the
// simulation reads. Arrow keys, WASD and the mouse all drive the same mech,
// so the game plays the same on a laptop trackpad and a desktop keyboard.

import { clamp } from './collision.js';

export function createInput(canvas, field) {
  const held = new Set();
  const state = {
    left: false,
    right: false,
    firing: false,
    pointerX: null,
    anyKeyPressed: false,
  };

  const keyMap = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    Space: 'firing',
    KeyJ: 'firing',
  };

  function onKeyDown(event) {
    const action = keyMap[event.code];
    if (action) {
      held.add(action);
      event.preventDefault();
    }
    state.anyKeyPressed = true;
  }

  function onKeyUp(event) {
    const action = keyMap[event.code];
    if (action) {
      held.delete(action);
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    state.pointerX = clamp(ratio * field.width, 0, field.width);
  }

  function onPointerDown(event) {
    state.firing = true;
    onPointerMove(event);
  }

  function onPointerUp() {
    // Pointer firing is momentary; holding the keyboard fires continuously.
    if (!held.has('firing')) state.firing = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  return {
    state,
    /** Fold the held-key set into the state the simulation reads each step. */
    sample() {
      state.left = held.has('left');
      state.right = held.has('right');
      if (held.has('firing')) state.firing = true;
      return state;
    },
    reset() {
      held.clear();
      state.firing = false;
      state.pointerX = null;
    },
  };
}
