// Page vs approved board at the board's own width (1024 px): side-by-side + 50% blend,
// and the mean absolute difference per section. Needs `npm run build && npm run preview`.
// Usage: node scripts/board-compare.mjs [baseUrl]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || process.env.QA_BASE || 'http://localhost:4198';
const outDir = join(root, 'qa');
mkdirSync(outDir, { recursive: true });

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1 });
await page.goto(base + '/?static', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
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
await page.waitForTimeout(300);
const shot = await page.screenshot({ fullPage: true });
await browser.close();

const boardPath = join(root, '02-direcao/composicao-final.png');
const H = 1536;
const pageImg = await sharp(shot).extract({ left: 0, top: 0, width: 1024, height: H }).removeAlpha().raw().toBuffer();
const boardImg = await sharp(boardPath).removeAlpha().raw().toBuffer();
const sections = { hero: [0, 614], s1: [620, 983], s2: [990, 1311], s3: [1318, 1536] };
for (const [k, [y0, y1]] of Object.entries(sections)) {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < 1024; x++) for (let c = 0; c < 3; c++) {
    const i = (y * 1024 + x) * 3 + c; s += Math.abs(pageImg[i] - boardImg[i]); n++;
  }
  console.log(k.padEnd(5), 'mean |page - board|', (s / n).toFixed(1));
}
const blend = Buffer.alloc(pageImg.length);
for (let i = 0; i < blend.length; i++) blend[i] = (pageImg[i] + boardImg[i]) >> 1;
const raw = { raw: { width: 1024, height: H, channels: 3 } };
await sharp({ create: { width: 3072, height: H, channels: 3, background: '#fff' } })
  .composite([
    { input: await sharp(boardImg, raw).png().toBuffer(), left: 0, top: 0 },
    { input: await sharp(pageImg, raw).png().toBuffer(), left: 1024, top: 0 },
    { input: await sharp(blend, raw).png().toBuffer(), left: 2048, top: 0 },
  ]).png().toFile(join(outDir, 'board-compare.png'));
await sharp(shot).toFile(join(outDir, 'page-1024.png'));
console.log('wrote qa/board-compare.png (board | page | blend)');
