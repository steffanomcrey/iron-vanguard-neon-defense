// Title screen, wave banners, pause card and the game-over summary. These are
// drawn in arena space on top of the live playfield, so the arena is always
// visible behind them — which is what makes the screenshots read well.

import { FIELD, PALETTE } from './config.js';

export function drawOverlays(renderer, world) {
  const { ctx } = renderer;
  ctx.save();
  ctx.translate(renderer.view.offsetX, renderer.view.offsetY);
  ctx.scale(renderer.view.scale, renderer.view.scale);

  if (world.mode === 'title') drawTitle(ctx, world);
  else if (world.mode === 'paused') drawPaused(ctx, world);
  else if (world.mode === 'gameover') drawGameOver(ctx, world);
  else if (world.mode === 'victory') drawVictory(ctx, world);

  ctx.restore();
}

function panel(ctx, width, height, y) {
  const x = FIELD.width / 2 - width / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 18);
  ctx.fill();
  ctx.stroke();
  return { x, y, width, height };
}

function drawTitle(ctx, world) {
  const box = panel(ctx, 760, 380, 160);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText('MAKE.FUN BOUNTY ENTRY', box.x + 48, box.y + 54);
  ctx.letterSpacing = '0px';

  const title = ctx.createLinearGradient(box.x, box.y + 70, box.x + 460, box.y + 140);
  title.addColorStop(0, PALETTE.hull);
  title.addColorStop(0.55, PALETTE.accent);
  title.addColorStop(1, PALETTE.accentWarm);
  ctx.fillStyle = title;
  ctx.font = '800 68px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = 'rgba(79, 214, 255, 0.45)';
  ctx.shadowBlur = 28;
  ctx.fillText('IRON VANGUARD', box.x + 44, box.y + 132);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
  const lines = [
    'Pilot the last interceptor against a ten-wave drone swarm.',
    'Bank shields by finishing a wave untouched — that is where the score is.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, box.x + 48, box.y + 176 + i * 26));

  const controls = [
    ['MOVE', 'A / D  ·  ← →  ·  mouse'],
    ['FIRE', 'SPACE  ·  hold click'],
    ['PAUSE', 'P'],
  ];
  controls.forEach(([key, value], i) => {
    const y = box.y + 250 + i * 32;
    ctx.font = '700 16px "SFMono-Regular", Consolas, monospace';
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(key, box.x + 48, y);
    ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(value, box.x + 150, y);
  });

  const blink = Math.sin(world.elapsed * 4) > -0.3;
  if (blink) {
    ctx.textAlign = 'right';
    ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.accentWarm;
    ctx.fillText('PRESS SPACE TO LAUNCH', box.x + box.width - 48, box.y + box.height - 44);
  }
  ctx.restore();
}

function drawPaused(ctx, world) {
  const box = panel(ctx, 420, 168, FIELD.height / 2 - 84);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, box.y + 66);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Press P to resume, R to restart', FIELD.width / 2, box.y + 106);
  ctx.restore();
  void world;
}

function drawGameOver(ctx, world) {
  const box = panel(ctx, 560, 300, FIELD.height / 2 - 150);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.danger;
  ctx.font = '800 46px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = PALETTE.danger;
  ctx.shadowBlur = 24;
  ctx.fillText('MECH DOWN', FIELD.width / 2, box.y + 76);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 52px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(world.score.total.toLocaleString('en-US'), FIELD.width / 2, box.y + 146);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `Reached wave ${Math.max(1, world.director.wave)} of 10  ·  best ${world.score.best.toLocaleString('en-US')}`,
    FIELD.width / 2,
    box.y + 184,
  );

  ctx.fillStyle = PALETTE.accentWarm;
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PRESS R TO RE-DEPLOY', FIELD.width / 2, box.y + 250);
  ctx.restore();
}

function drawVictory(ctx, world) {
  const box = panel(ctx, 620, 320, FIELD.height / 2 - 160);
  ctx.save();
  ctx.textAlign = 'center';
  const glow = Math.sin(world.elapsed * 3) * 0.5 + 0.5;
  ctx.fillStyle = PALETTE.health;
  ctx.font = '800 48px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = PALETTE.health;
  ctx.shadowBlur = 20 + glow * 24;
  ctx.fillText('ALL WAVES CLEARED', FIELD.width / 2, box.y + 84);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 56px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(world.score.total.toLocaleString('en-US'), FIELD.width / 2, box.y + 158);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Final score  ·  shields intact', FIELD.width / 2, box.y + 196);

  ctx.fillStyle = PALETTE.accentWarm;
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', FIELD.width / 2, box.y + 264);
  ctx.restore();
}
