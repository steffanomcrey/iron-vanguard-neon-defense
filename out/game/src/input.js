// Keyboard + pointer input. Keyboard always wins the frame it is used.

export function createInput(canvas, field) {
  const state = {
    left: false,
    right: false,
    fire: false,
    pointerActive: false,
    pointerX: field.w * 0.5,
    pointerY: field.h * 0.9,
  };

  const buttons = new Set();

  function sync() {
    state.fire = state.fireKey || buttons.size > 0;
    state.left = state.leftKey;
    state.right = state.rightKey;
  }

  function keyDown(e) {
    let used = true;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        state.leftKey = true;
        state.pointerActive = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        state.rightKey = true;
        state.pointerActive = false;
        break;
      case 'Space':
      case 'KeyJ':
        state.fireKey = true;
        break;
      default:
        used = false;
    }
    if (used && e.preventDefault) e.preventDefault();
    sync();
  }

  function keyUp(e) {
    let used = true;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        state.leftKey = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        state.rightKey = false;
        break;
      case 'Space':
      case 'KeyJ':
        state.fireKey = false;
        break;
      default:
        used = false;
    }
    if (used && e.preventDefault) e.preventDefault();
    sync();
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * field.w;
    const y = ((e.clientY - rect.top) / rect.height) * field.h;
    state.pointerX = x;
    state.pointerY = y;
    state.pointerActive = true;
  }

  function pointerMove(e) {
    pointerPos(e);
    sync();
  }

  function pointerDown(e) {
    pointerPos(e);
    buttons.add(e.pointerId === undefined ? 1 : e.pointerId);
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety, not a requirement */
      }
    }
    if (e.preventDefault) e.preventDefault();
    sync();
  }

  function pointerUp(e) {
    buttons.delete(e.pointerId === undefined ? 1 : e.pointerId);
    if (e.preventDefault) e.preventDefault();
    sync();
  }

  function pointerLeave() {
    buttons.clear();
    sync();
  }

  function clearKeys() {
    state.leftKey = false;
    state.rightKey = false;
    state.fireKey = false;
    buttons.clear();
    sync();
  }

  function attach(target) {
    target.addEventListener('keydown', keyDown);
    target.addEventListener('keyup', keyUp);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('pointerleave', pointerLeave);
    window.addEventListener('blur', clearKeys);
    return state;
  }

  function detach(target) {
    target.removeEventListener('keydown', keyDown);
    target.removeEventListener('keyup', keyUp);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerUp);
    canvas.removeEventListener('pointerleave', pointerLeave);
    window.removeEventListener('blur', clearKeys);
    clearKeys();
  }

  state.leftKey = false;
  state.rightKey = false;
  state.fireKey = false;
  state.attach = attach;
  state.detach = detach;

  return state;
}

// Ease the mech toward the pointer instead of teleporting it under the cursor.
export function easePointer(current, target, dt, rate = 16) {
  return current + (target - current) * Math.min(1, rate * dt);
}
