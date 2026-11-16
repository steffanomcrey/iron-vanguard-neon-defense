// Capture the three entry screenshots with a real headless browser.
// Usage: node shoot.mjs
// Writes screenshots/1-start.jpg, 2-play.jpg, 3-end.jpg at 1280x720, under the
// grader's 256 KiB per-shot cap.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, 'game'));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const stats = statSync(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': stats.size,
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/index.html`;

const browser = await chromium.launch({
  args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

page.on('console', (m) => { if (m.type() === 'error') console.log('  [page error]', m.text()); });
page.on('pageerror', (e) => console.log('  [page exception]', e.message));

for (const shot of shots) {
  const url = `${base}${shot.query}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const target = join(here, 'screenshots', shot.name);
  await page.screenshot({ path: target, type: 'jpeg', quality: 88 });
  const size = statSync(target).size;
  const flag = size > 262144 ? '  !! OVER 256 KiB CAP' : '';
  console.log(`${shot.name.padEnd(12)} ${String(size).padStart(7)} bytes${flag}`);
}

await browser.close();
server.close();
