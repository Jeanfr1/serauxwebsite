// Raw captures for the README from the production build (npm run build && npm run preview):
// hero intro frames (?t=), desktop section shots, phone shots and the banner page.
// scripts/readme-composite.py turns them into .github/assets/*.
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'http://localhost:4198';
const out = join(root, 'qa/readme');
mkdirSync(join(out, 'frames'), { recursive: true });

const settle = (page) => page.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.6) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, 0);
  document.documentElement.classList.remove('reveal-on');
  await document.fonts.ready;
  const t0 = performance.now();
  while ([...document.images].some((i) => i.getAttribute('src') && !i.complete) && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 100));
});

const browser = await launch();

// intro frames, 12 fps over 4.8 s
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const fps = 12, dur = 4800;
  for (let i = 0; i <= (dur / 1000) * fps; i++) {
    const t = Math.round((i * 1000) / fps);
    await page.goto(`${base}/?t=${t}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(out, 'frames', `f_${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();
}

// desktop sections
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base + '/?static', { waitUntil: 'networkidle' });
  await settle(page);
  for (const [name, sel] of [['d-s1', '#neumaticos'], ['d-s2', '#servicios'], ['d-s3', '#taller']]) {
    const b = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { y: r.top + scrollY, h: r.height }; }, sel);
    const extra = name === 'd-s3' ? 190 : 0;
    await page.screenshot({ path: join(out, name + '.png'), fullPage: true, clip: { x: 0, y: Math.max(0, b.y - 14), width: 1440, height: b.h + 28 + extra } });
  }
  await page.close();
}

// phone screens
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(base + '/?static', { waitUntil: 'networkidle' });
  await settle(page);
  const shots = [['m-hero', 0], ['m-s1', '#neumaticos'], ['m-s2', '#servicios'], ['m-s3', '#taller']];
  for (const [name, sel] of shots) {
    const y = sel ? await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY - 24, sel) : 0;
    await page.screenshot({ path: join(out, name + '.png'), fullPage: true, clip: { x: 0, y, width: 390, height: 844 } });
  }
  await page.close();
}

// banner, rendered with the site's own fonts and plate
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 560 } });
  await page.goto(base + '/?static', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.body.innerHTML = `
    <div id="b" style="position:fixed;inset:0;background:#f4ebdf;overflow:hidden;font-family:'Inter Variable',sans-serif">
      <img src="/img/hero-v1-2600.webp" style="position:absolute;right:-30px;top:-34px;height:640px;width:auto">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,#f4ebdf 0,#f4ebdf 44%,rgba(244,235,223,.8) 49%,rgba(244,235,223,0) 58%)"></div>
      <img src="/img/logo-v1-960.webp" style="position:absolute;left:70px;top:58px;height:78px;width:auto">
      <p style="position:absolute;left:72px;top:176px;margin:0;color:#d30f18;font:600 15px/1 'Inter Variable';letter-spacing:.38em">EL CONTACTO CON LA CARRETERA.</p>
      <h1 style="position:absolute;left:68px;top:206px;margin:0;font:400 112px/0.92 Anton;color:#0a0a0b;letter-spacing:-.02em;transform:scaleX(.9);transform-origin:0 0">Todo empieza<br>en el <span style="color:#d30f18">contacto.</span></h1>
      <p style="position:absolute;left:72px;top:440px;margin:0;font:400 21px/1.45 'Inter Variable';color:#1e1e1f">Neumáticos, mecánica y lavado · Polígono de Raos, Santander</p>
    </div>`;
  });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => 0))); });
  await page.screenshot({ path: join(out, 'banner.png') });
  await page.close();
}
await browser.close();
console.log('captured to qa/readme/');
