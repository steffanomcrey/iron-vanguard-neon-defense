// Heads-up display drawn in screen space: shields, score, wave progress and
// the floating score pops. Kept out of render.js because the HUD is anchored to
// the window, while the playfield is anchored to the logical arena.

import { FIELD, PALETTE, SHIP } from './config.js';

export function drawHud(renderer, world) {
  const { ctx, view } = renderer;
  const scale = view.scale;
  const ox = view.offsetX;
  const oy = view.offsetY;

  ctx.save();
  ctx.setTransform(ctx.getTransform());
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  drawShields(ctx, world.ship);
  drawScore(ctx, world.score);
  drawWave(ctx, world.director);
  drawFloaters(ctx, world.score.floaters);
  drawCombo(ctx, world.score);

  if (world.director.state === 'breather' && world.director.wave > 0) {
    drawBanner(ctx, `WAVE ${world.director.wave} CLEARED`, PALETTE.health);
  }

  ctx.restore();
}

function drawShields(ctx, ship) {
  const x = 34;
  const y = 30;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.letterSpacing = '2px';
  ctx.fillText('SHIELD', x, y - 8);

  for (let i = 0; i < SHIP.maxShields; i += 1) {
    const filled = i < ship.shields;
    const cx = x + i * 30;
    const cy = y + 10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, -4);
    ctx.lineTo(9, 6);
    ctx.lineTo(0, 12);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-9, -4);
    ctx.closePath();
    if (filled) {
      ctx.shadowColor = PALETTE.health;
      ctx.shadowBlur = 14;
      ctx.fillStyle = PALETTE.health;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(93, 123, 166, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawScore(ctx, score) {
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('SCORE', FIELD.width - 34, 22);

  ctx.letterSpacing = '0px';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 40px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = 'rgba(79, 214, 255, 0.55)';
  ctx.shadowBlur = 20;
  ctx.fillText(score.total.toLocaleString('en-US'), FIELD.width - 34, 62);
  ctx.shadowBlur = 0;

  if (score.best > 0) {
    ctx.fillStyle = '#8fa8c9';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`BEST ${score.best.toLocaleString('en-US')}`, FIELD.width - 34, 86);
  }
}

/** Threat bar: fills as the current wave is whittled down, so it reads at a glance. */
function drawWave(ctx, director) {
  const label = director.wave === 0 ? 'STANDBY' : `WAVE ${director.wave} / 10`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8fa8c9';
  ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(label, FIELD.width / 2, 26);
  ctx.letterSpacing = '0px';

  // Progress is tracked by the director as a 0..1 fraction of wave cleared.
  const fraction = director.progress === undefined ? 0.62 : director.progress;
  const barWidth = 260;
  const x = FIELD.width / 2 - barWidth / 2;
  const y = 38;

  ctx.fillStyle = 'rgba(8, 16, 30, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, barWidth + 4, 12, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(79, 214, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const fill = ctx.createLinearGradient(x, 0, x + barWidth, 0);
  fill.addColorStop(0, PALETTE.accent);
  fill.addColorStop(1, PALETTE.health);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(8, barWidth * fraction), 8, 4);
  ctx.fill();

  // Tick marks make the bar legible as a meter rather than a divider.
  ctx.strokeStyle = 'rgba(5, 6, 12, 0.75)';
  ctx.lineWidth = 2;
  for (let tick = 1; tick < 5; tick += 1) {
    const tx = x + (barWidth * tick) / 5;
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.lineTo(tx, y + 8);
    ctx.stroke();
  }

  ctx.fillStyle = '#8fa8c9';
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.round(fraction * 100)}% CLEARED`, FIELD.width / 2, 64);
}

function drawCombo(ctx, score) {
  if (score.combo < 2) return;
  const alpha = Math.min(1, score.comboTimer);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.accentWarm;
  ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`COMBO x${score.combo}`, FIELD.width / 2, 74);
  ctx.restore();
}

function drawFloaters(ctx, floaters) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.label ? PALETTE.accentWarm : PALETTE.text;
    const text = f.label ? `+${f.amount} ${f.label}` : `+${f.amount}`;
    ctx.fillText(text, f.x, f.y);
  }
  ctx.restore();
}

function drawBanner(ctx, text, colour) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.font = '700 34px "Segoe UI", system-ui, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 24;
  ctx.fillText(text, FIELD.width / 2, FIELD.height / 2 - 40);
  ctx.restore();
}
