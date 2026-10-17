// QA of the production build (or a live URL): layout overflow, links, hero states,
// controls, menu, accessibility basics and copy hygiene. Exits 1 on any failure.
// Usage: node scripts/qa.mjs [baseUrl]   (default http://localhost:4198 = npm run preview)
import { launch } from './browser.mjs';

const base = process.argv[2] || process.env.QA_BASE || 'http://localhost:4198';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };

const browser = await launch();
const errors = [];

async function open(w, h, opts = {}, path = '/') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}px: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}px console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`${w}px request failed: ${r.url()}`));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  return { ctx, page };
}
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.6) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    scrollTo(0, document.documentElement.scrollHeight);
    // give the last lazy images time to arrive before judging them
    const t0 = performance.now();
    while ([...document.images].some((i) => i.getAttribute('src') && !i.complete) && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 100));
    scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

// 1. no horizontal overflow; every image decodes
for (const [w, h] of [[320, 640], [360, 740], [390, 844], [600, 900], [820, 1180], [959, 800], [960, 800], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]]) {
  const { ctx, page } = await open(w, h, {}, '/?static');
  await scrollThrough(page);
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    broken: [...document.images].filter((i) => i.getAttribute('src') && !i.naturalWidth).map((i) => i.currentSrc || i.src),
  }));
  check(`no horizontal scroll @${w}`, r.sw <= r.iw, `${r.sw}/${r.iw}`);
  check(`all images loaded @${w}`, r.broken.length === 0, r.broken.join(' '));
  await ctx.close();
}

// 2. desktop board: text blocks inside their sections, nothing overlapping the CTA
{
  const { ctx, page } = await open(1440, 900, {}, '/?static');
  const r = await page.evaluate(() => {
    const box = (s) => document.querySelector(s).getBoundingClientRect();
    const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
    const pairs = [['#s1-title', '.s1'], ['.s1 .sheet-copy > p', '.s1'], ['#s2-title', '.s2'], ['.s2 .sheet-copy > p', '.s2'], ['#s3-title', '.s3'], ['.map-cta', '.s3'], ['.s3 .tel', '.s3'], ['#hero-title', '.hero']];
    const hit = (sel) => {
      document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' });
      const b = box(sel); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return el && el.closest(sel) !== null;
    };
    return { inside: pairs.map(([a, b]) => [a, inside(box(a), box(b))]), clickable: ['.head-cta', '.map-cta', '.s3 .tel', '.nav a[href="#taller"]'].map((s) => [s, hit(s)]) };
  });
  r.inside.forEach(([s, ok]) => check(`desktop: ${s} inside its section`, ok));
  r.clickable.forEach(([s, ok]) => check(`desktop: ${s} on top (clickable)`, ok));
  // nav anchors land on their sections
  for (const [href, sel] of [['#neumaticos', '#neumaticos'], ['#servicios', '#servicios'], ['#taller', '#taller'], ['#contacto', '#contacto']]) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.click(`.nav a[href="${href}"]`);
    await page.waitForTimeout(900);
    const { top, atEnd } = await page.evaluate((s) => ({ top: document.querySelector(s).getBoundingClientRect().top,
      atEnd: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 }), sel);
    check(`nav ${href} scrolls to its section`, Math.abs(top) < 40 || (atEnd && top >= 0 && top < 900), `top ${Math.round(top)}${atEnd ? ' (page end)' : ''}`);
  }
  await ctx.close();
}

// 3. links and copy
{
  const { ctx, page } = await open(1440, 900, {}, '/?static');
  const r = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim(), target: a.target, rel: a.rel }));
    const text = document.body.innerText + ' ' + [...document.querySelectorAll('img')].map((i) => i.alt).join(' ') + ' ' + document.title + ' ' + document.querySelector('meta[name=description]').content;
    return { links, text, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang,
      imgsNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      robots: document.querySelector('meta[name=robots]')?.content };
  });
  const tels = r.links.filter((l) => l.href?.startsWith('tel:'));
  check('phone links use +34942369163', tels.length >= 3 && tels.every((l) => l.href === 'tel:+34942369163'), `${tels.length} tel links`);
  const maps = r.links.filter((l) => l.href?.includes('google.com/maps'));
  check('map links open safely in a new tab', maps.length >= 2 && maps.every((l) => l.target === '_blank' && l.rel.includes('noopener')));
  check('no empty or placeholder hrefs', r.links.every((l) => l.href && l.href !== '#'));
  check('one h1, lang es', r.h1 === 1 && r.lang === 'es');
  check('every img has an alt attribute', r.imgsNoAlt === 0);
  check('noindex until the final domain', /noindex/.test(r.robots || ''));
  const process = r.text.match(/\b(conceptual|generad[oa]|edited|editad[oa]|original photo|ilustrativ[oa]|mockup|maqueta|campa[ñn]a|lorem|placeholder|kit)\b/gi) || r.text.match(/\bTODO\b/g);
  check('no production notes in visible copy / alts', !process, process ? process.join(', ') : '');
  const claims = r.text.match(/\b(\d{1,2}:\d{2}|€|desde \d|años de|garant[ií]a|diagn[oó]stico|wh?atsapp|@\w+\.\w+)/gi);
  check('no unsourced hours, prices, guarantees or contacts', !claims, claims ? claims.join(', ') : '');
  await ctx.close();
}

// 4. hero intro: runs, controls work, ends on the still
{
  const { ctx, page } = await open(1440, 900);
  await page.waitForTimeout(400);
  const s0 = await page.evaluate(() => ({ ready: document.documentElement.classList.contains('motion-ready'), controls: !document.querySelector('.motion-controls').hidden, anims: document.getAnimations().length }));
  check('intro starts (motion layers ready, controls shown)', s0.ready && s0.controls && s0.anims > 5, JSON.stringify(s0));
  await page.click('[data-act="pause"]');
  const paused = await page.evaluate(() => document.getAnimations().every((a) => a.playState === 'paused'));
  check('Pausar pauses every layer', paused);
  check('button reads Continuar', (await page.textContent('[data-act="pause"]')) === 'Continuar');
  await page.click('[data-act="pause"]');
  await page.click('[data-act="diagram"]');
  const diag = await page.evaluate(() => ({ cls: document.querySelector('.hero').classList.contains('diagram'), op: getComputedStyle(document.querySelector('.hero-plate')).opacity, label: document.querySelector('[data-act="diagram"]').textContent }));
  check('Ver esquema shows the line study', diag.cls && +diag.op < 0.3 && diag.label === 'Ver fotografía', JSON.stringify(diag));
  await page.click('[data-act="replay"]');
  const rep = await page.evaluate(() => ({ cls: document.querySelector('.hero').classList.contains('diagram'), running: document.getAnimations().some((a) => a.playState === 'running') }));
  check('Repetir animación leaves diagram mode and plays', !rep.cls && rep.running);
  await page.waitForTimeout(5200);
  const end = await page.evaluate(() => ({ clip: getComputedStyle(document.querySelector('.hero-plate')).clipPath, lines: getComputedStyle(document.querySelector('.hero-lines')).opacity, label: document.querySelector('[data-act="pause"]').textContent }));
  check('intro ends on the full still', /inset\(0(px)? 0(%|px)? 0(px)? 0(px)?\)|none/.test(end.clip) && +end.lines === 0, JSON.stringify(end));
  check('pause button reports the end', end.label === 'Animación finalizada');
  const textClick = await page.evaluate(() => { const b = document.querySelector('#hero-title').getBoundingClientRect(); return document.elementFromPoint(b.left + 20, b.top + 20)?.closest('h1') !== null; });
  check('hero text stays on top of the art', textClick);
  await ctx.close();
}

// 5. reduced motion / no JS / ?static: the still, no controls
{
  const { ctx, page } = await open(1440, 900, { reducedMotion: 'reduce' });
  const r = await page.evaluate(() => ({ controls: document.querySelector('.motion-controls').hidden, anims: document.getAnimations().length, intro: document.documentElement.classList.contains('intro'), paper: document.querySelector('.hero-paper').currentSrc }));
  check('reduced motion: no intro, no controls, motion layers not loaded', r.controls && r.anims === 0 && !r.intro && !r.paper, JSON.stringify(r));
  await ctx.close();
  const nj = await open(1440, 900, { javaScriptEnabled: false });
  const v = await nj.page.evaluate(() => 0).catch(() => null);
  const shot = await nj.page.screenshot();
  check('no-JS renders (screenshot taken)', shot.length > 50000 && v === null || shot.length > 50000);
  await nj.ctx.close();
}

// 6. phone: menu opens/closes, CTA sizes
{
  const { ctx, page } = await open(390, 844, { hasTouch: true, isMobile: true, deviceScaleFactor: 3 }, '/?static');
  await page.click('.menu-toggle');
  const open1 = await page.evaluate(() => ({ exp: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), vis: getComputedStyle(document.querySelector('.nav')).display }));
  check('phone menu opens', open1.exp === 'true' && open1.vis === 'flex');
  await page.keyboard.press('Escape');
  check('Escape closes the menu', (await page.getAttribute('.menu-toggle', 'aria-expanded')) === 'false');
  const sizes = await page.evaluate(() => ['.menu-toggle', '.map-cta'].map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(b.height)]; }));
  sizes.forEach(([s, hgt]) => check(`phone tap target ${s} >= 44px`, hgt >= 44, `${hgt}px`));
  await ctx.close();
}

check('no console errors, page errors or failed requests', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
