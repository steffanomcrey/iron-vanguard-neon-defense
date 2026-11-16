// HUD and the three overlay screens. Overlays read a live state object; callbacks only fire on change.

import { FIELD, PALETTE, SHIP, STEP } from './config.js';

const SCREEN_COPY = {
  title: {
    heading: 'IRON VANGUARD',
    sub: 'NEON DEFENSE',
    lines: [
      'A / D or \u2190 \u2192 to steer  \u00b7  Space or J to fire',
      'Pointer: move to aim, press and hold to fire',
      'Survive 10 waves. Cyan is yours \u2014 everything else burns.',
    ],
    prompt: 'PRESS SPACE OR CLICK TO DEPLOY',
  },
  paused: {
    heading: 'PAUSED',
    sub: '',
    lines: ['Threat grid held. Take your time.'],
    prompt: 'PRESS ESC TO RESUME',
  },
  gameover: {
    heading: 'MECH DOWN',
    sub: '',
    lines: ['The line broke. The sector is dark.'],
    prompt: 'PRESS SPACE TO REDEPLOY',
  },
  victory: {
    heading: 'SECTOR SECURED',
    sub: '',
    lines: ['Ten waves. Nothing left standing.'],
    prompt: 'PRESS SPACE FOR A NEW RUN',
  },
};

function pad(n, width) {
  let s = String(Math.max(0, Math.floor(n)));
  while (s.length < width) s = `0${s}`;
  return s;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad(m, 2)}:${pad(s, 2)}`;
}

export function drawHud(ctx, state) {
  const ship = state.ship;
  const score = state.score;

  // The cover pose runs a stripped HUD: the arena, the mech's silhouette and the title are the
  // composition, so every band of live stats is suppressed. A cover needs one subject and one
  // name, not a dashboard.
  if (state.poseMinimalHud) {
    drawCoverTitle(ctx, state);
    return;
  }

  ctx.save();
  ctx.font = '600 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'alphabetic';

  // Score, left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 12px ui-monospace, monospace';
  ctx.fillText('SCORE', 24, 30);

  ctx.fillStyle = PALETTE.ink;
  ctx.font = '700 26px ui-monospace, monospace';
  ctx.fillText(String(score.score), 24, 58);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 12px ui-monospace, monospace';
  ctx.fillText(`BEST ${score.best}`, 24, 78);

  // Combo, under the score.
  if (score.combo > 1) {
    const t = Math.max(0, Math.min(1, score.comboTimer / 3.2));
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 16px ui-monospace, monospace';
    ctx.fillText(`x${(1 + (score.combo - 1) * 0.15).toFixed(2)} COMBO`, 24, 102);

    ctx.fillStyle = 'rgba(255, 209, 102, 0.3)';
    ctx.fillRect(24, 110, 120, 3);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(24, 110, 120 * t, 3);
  }

  // Shields, right.
  const cellW = 22;
  const cellH = 12;
  const gap = 6;
  const rightEdge = FIELD.w - 24 - 26;

  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 12px ui-monospace, monospace';
  ctx.fillText('INTEGRITY', FIELD.w - 24, 30);

  for (let i = 0; i < ship.maxShields; i += 1) {
    const x = rightEdge - i * (cellW + gap);
    const y = 42;
    const filled = i < ship.shields;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + cellW, y);
    ctx.lineTo(x + cellW - 4, y + cellH);
    ctx.lineTo(x + 4, y + cellH);
    ctx.closePath();

    if (filled) {
      ctx.fillStyle = PALETTE.accent;
      ctx.shadowColor = PALETTE.accent;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(143, 168, 201, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // WAVE and the progress bar are labelled as one unit: TIME on the left, WAVE CLEARED on the
  // right, so neither the clock nor the bar is an unlabelled ornament.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '700 22px ui-monospace, monospace';
  ctx.fillText(`WAVE ${state.wave} / ${state.wavesTotal}`, FIELD.w * 0.5, 40);

  const barW = 320;
  const barX = FIELD.w * 0.5 - barW * 0.5;
  const barY = 74;
  const progress = Math.max(0, Math.min(1, state.waveProgress));

  ctx.font = '600 12px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`TIME ${formatTime(state.elapsed)}`, barX - 12, barY + 5);

  ctx.textAlign = 'left';
  ctx.fillText(`WAVE CLEARED ${Math.round(progress * 100)}%`, barX + barW + 12, barY + 5);

  ctx.fillStyle = 'rgba(143, 168, 201, 0.22)';
  ctx.fillRect(barX, barY, barW, 5);
  ctx.fillStyle = PALETTE.accent;
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 9;
  ctx.fillRect(barX, barY, barW * progress, 5);
  ctx.shadowBlur = 0;

  // Tick marks at each quarter, so the bar reads as measured progress rather than a decoration.
  ctx.fillStyle = 'rgba(8, 14, 30, 0.85)';
  for (let i = 1; i < 4; i += 1) {
    ctx.fillRect(barX + (barW / 4) * i, barY, 1.5, 5);
  }

  ctx.restore();
}

export function drawOverlay(ctx, state) {
  const away = state.state === 'attract' || state.state === 'title';
  const copy = SCREEN_COPY[state.state] || SCREEN_COPY.title;

  ctx.save();
  // Dim the arena with a vignette rather than a flat curtain: the fight stays visible
  // behind the card, so the card sits *in* the world instead of replacing it.
  const curtain = ctx.createRadialGradient(
    FIELD.w * 0.5, FIELD.h * 0.52, 120,
    FIELD.w * 0.5, FIELD.h * 0.52, FIELD.w * 0.72,
  );
  curtain.addColorStop(0, away ? 'rgba(5, 10, 24, 0.30)' : 'rgba(5, 10, 24, 0.42)');
  curtain.addColorStop(0.62, away ? 'rgba(4, 8, 20, 0.52)' : 'rgba(4, 8, 20, 0.62)');
  curtain.addColorStop(1, away ? 'rgba(3, 6, 16, 0.88)' : 'rgba(3, 6, 16, 0.92)');
  ctx.fillStyle = curtain;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);

  const panelW = 640;
  const panelH = state.final ? 380 : 320;
  const px = FIELD.w * 0.5 - panelW * 0.5;
  const py = FIELD.h * 0.5 - panelH * 0.5;

  ctx.strokeStyle = 'rgba(95, 242, 255, 0.72)';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 26;
  ctx.fillStyle = 'rgba(8, 18, 42, 0.84)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(px, py, panelW, panelH, 14) : ctx.rect(px, py, panelW, panelH);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';

  ctx.fillStyle = PALETTE.accent;
  ctx.font = '700 44px ui-monospace, monospace';
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 22;
  ctx.fillText(copy.heading, FIELD.w * 0.5, py + 84);
  ctx.shadowBlur = 0;

  let y = py + 118;

  if (copy.sub) {
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '600 20px ui-monospace, monospace';
    ctx.fillText(copy.sub, FIELD.w * 0.5, y);
    y += 34;
  }

  if (state.final) {
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '700 30px ui-monospace, monospace';
    ctx.fillText(`SCORE ${state.final.score}`, FIELD.w * 0.5, y);
    y += 34;

    ctx.fillStyle = PALETTE.muted;
    ctx.font = '500 15px ui-monospace, monospace';
    ctx.fillText(
      `BEST ${state.final.best}   \u00b7   WAVE ${state.final.wave} / ${state.wavesTotal}   \u00b7   TIME ${formatTime(state.final.elapsed)}`,
      FIELD.w * 0.5,
      y,
    );
    y += 40;
  }

  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 15px ui-monospace, monospace';
  for (let i = 0; i < copy.lines.length; i += 1) {
    ctx.fillText(copy.lines[i], FIELD.w * 0.5, y);
    y += 24;
  }

  // Prompt breathes so a still frame never looks frozen.
  const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.004);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.accent;
  ctx.font = '700 18px ui-monospace, monospace';
  ctx.fillText(copy.prompt, FIELD.w * 0.5, py + panelH - 40);
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function createScreens() {
  const listeners = new Set();

  function onEnter(state) {
    listeners.forEach((fn) => fn(state));
  }

  function attachHandlers(previousState, enter) {
    const bounds = [0, 0, FIELD.w, FIELD.h];

    // Reserve the strip the canvas actually occupies so clicks land on the game.
    const rect = typeof document !== 'undefined'
      ? document.getElementById('game')
      : null;
    if (rect && rect.getBoundingClientRect) {
      const r = rect.getBoundingClientRect();
      bounds[0] = r.left;
      bounds[1] = r.top;
      bounds[2] = r.right;
      bounds[3] = r.bottom;
    }

    return { previousState, enter, bounds };
  }

  return {
    listeners,
    onEnter,
    attachHandlers,
    copy: SCREEN_COPY,
    step: STEP,
  };
}

export function hudGeometry() {
  return { FIELD, SHIP_SHIELDS: SHIP.maxShields, STEP };
}

// The cover title block. A game cover without a name is just a screenshot, so the name is set
// across the upper-left with a rule above it and a strapline beneath.
// Deliberately one step DOWN from the mech in contrast: the craft is the hero, the name is the
// signature. Three equally bright zones make the eye bounce, so the title is smaller and dimmer
// than the ship's glow and lives inside a fixed column no drone may enter.
function drawCoverTitle(ctx, state) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const x = 60;
  const top = 62;

  // Eyebrow rule + kicker, anchoring the block to the corner.
  ctx.strokeStyle = 'rgba(95, 242, 255, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + 64, top);
  ctx.stroke();

  ctx.fillStyle = 'rgba(143, 168, 201, 0.9)';
  ctx.font = '600 13px ui-monospace, monospace';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
  ctx.fillText('SECTOR 07 // LAST STAND', x, top + 24);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // The name, split so a word can never be buried by an enemy: IRON on one line, VANGUARD under
  // it. Big enough to survive a thumbnail — a cover that loses its name at small sizes has lost
  // the only part a judge reads from a dossier list.
  ctx.shadowColor = 'rgba(2, 8, 22, 0.95)';
  ctx.shadowBlur = 16;

  ctx.font = '800 56px "Arial Black", Impact, ui-sans-serif, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('IRON', x, top + 86);

  ctx.font = '800 48px "Arial Black", Impact, ui-sans-serif, sans-serif';
  ctx.fillStyle = PALETTE.accent;
  ctx.shadowColor = PALETTE.accent;
  ctx.shadowBlur = 24;
  ctx.fillText('VANGUARD', x, top + 134);

  ctx.shadowBlur = 16;
  ctx.shadowColor = 'rgba(2, 8, 22, 0.95)';
  ctx.font = '800 30px "Arial Black", Impact, ui-sans-serif, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('NEON DEFENSE', x, top + 172);
  ctx.shadowBlur = 0;

  // Strapline rule and text.
  ctx.strokeStyle = 'rgba(143, 168, 201, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, top + 196);
  ctx.lineTo(x + 300, top + 196);
  ctx.stroke();

  ctx.fillStyle = 'rgba(214, 230, 246, 1)';
  ctx.font = '600 14px ui-monospace, monospace';
  ctx.shadowColor = 'rgba(2, 8, 22, 0.95)';
  ctx.shadowBlur = 8;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
  ctx.fillText('HOLD THE LINE. TEN WAVES. NO RETREAT.', x, top + 220);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.shadowBlur = 0;

  // Score chip, bottom-left and deliberately tiny: proof of a real run, not a headline.
  ctx.fillStyle = 'rgba(3, 9, 22, 0.78)';
  ctx.fillRect(x, FIELD.h - 58, 206, 32);
  ctx.strokeStyle = 'rgba(95, 242, 255, 0.40)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, FIELD.h - 58, 206, 32);

  ctx.fillStyle = PALETTE.ink;
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.fillText(`${state.score.score} PTS`, x + 13, FIELD.h - 35);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '600 12px ui-monospace, monospace';
  ctx.fillText(`x${state.score.combo} COMBO`, x + 122, FIELD.h - 35);

  ctx.restore();
}
