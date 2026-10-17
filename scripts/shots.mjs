// Captures of the production build: full pages per breakpoint, hero timeline frames,
// and the reduced-motion / no-JS stills. Needs `npm run build && npm run preview`.
// Usage: node scripts/shots.mjs [baseUrl]
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || process.env.QA_BASE || 'http://localhost:4198';
const out = join(root, 'qa/shots');
mkdirSync(out, { recursive: true });

const settle = (page) => page.evaluate(async () => {
  document.documentElement.classList.remove('reveal-on');
  // scroll like a visitor so lazy images and CSS masks load, then come back up
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.6) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  scrollTo(0, 0);
  await document.fonts.ready;
  // lazy images report complete before they start: wait for real pixels
  const t0 = performance.now();
  while ([...document.images].some((i) => !i.naturalWidth && i.getAttribute('src')) && performance.now() - t0 < 8000) {
    await new Promise((r) => setTimeout(r, 100));
  }
});

const browser = await launch();
const views = [['desktop-1440', 1440, 900, 1], ['laptop-1280', 1280, 800, 1], ['tablet-820', 820, 1180, 2], ['phone-390', 390, 844, 3], ['phone-360', 360, 740, 2]];
for (const [name, w, h, dpr] of views) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.goto(base + '/?static', { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `${name}-full.png`), fullPage: true });
  await page.goto(base + '/?t=4800', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, `${name}-fold.png`) });
  await page.close();
}
// hero timeline frames (desktop + phone)
for (const [name, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const t of [0, 700, 1400, 2200, 3000, 3600, 4200, 4800]) {
    await page.goto(`${base}/?t=${t}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `t-${name}-${String(t).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: w, height: name === 'phone' ? 520 : h } });
  }
  await page.close();
}
// reduced motion and no-JS: the still, no controls
const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await rm.goto(base + '/', { waitUntil: 'networkidle' });
await rm.screenshot({ path: join(out, 'reduced-motion.png') });
const nojs = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
const nj = await nojs.newPage();
await nj.goto(base + '/', { waitUntil: 'networkidle' });
await nj.screenshot({ path: join(out, 'no-js.png') });
await browser.close();
console.log('wrote qa/shots/');
