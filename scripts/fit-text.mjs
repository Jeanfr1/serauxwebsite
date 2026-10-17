// Fits every live text block of the desktop layout to the ink measured on the approved
// board (scripts/board.json, from measure-board.py) and writes src/fit.css.
// Each block gets --x/--y (block top-left), --fs, --lh and --ls in board px; the page
// multiplies them by --u (one board px). Run after changing fonts or copy.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const board = JSON.parse(readFileSync(join(root, 'scripts/board.json'), 'utf8'));
const font = (p) => 'file://' + join(root, 'node_modules', p);

const FONTS = {
  anton: { family: 'Anton', weight: 400 },
  barlow: { family: 'Barlow Condensed', weight: 800 },
  inter: { family: 'InterVariable', weight: 400 },
  inter5: { family: 'InterVariable', weight: 500 },
  inter6: { family: 'InterVariable', weight: 600 },
};

// mode: 'height' fits the ink height (and corrects width with letter-spacing),
//       'width' fits the ink width. lines: [text, box name, text used for the ink box]
const BLOCKS = [
  { cls: 'f-eyebrow', font: 'inter6', mode: 'height', spread: true, lines: [['EL CONTACTO', 'eyebrow1'], ['CON LA CARRETERA.', 'eyebrow2', 'CON LA CARRETERA']] },
  { cls: 'f-h1', font: 'anton', mode: 'height', lines: [['Todo empieza', 'h1a'], ['en el contacto.', ['h1b', 'h1c']]] },
  { cls: 'f-intro', font: 'inter', mode: 'width', lines: [['Neumáticos, mecánica y lavado en Santander.', 'intro1'], ['Tu vehículo, en manos de especialistas.', 'intro2', 'Tu vehículo, en manos de especialistas']] },
  { cls: 'f-nav', font: 'inter5', mode: 'width', lines: [['Neumáticos', 'nav1']] },
  { cls: 'f-headbtn', font: 'inter5', mode: 'width', lines: [['Solicitar presupuesto', 'headBtnText']] },
  { cls: 'f-s1t', font: 'barlow', mode: 'height', lines: [['Neumáticos', 's1t1'], ['y llantas.', 's1t2']] },
  { cls: 'f-s1p', font: 'inter', mode: 'width', lines: [['Primeras marcas y un servicio', 's1p1'], ['profesional para que sigas', 's1p2'], ['siempre en la carretera.', 's1p3']] },
  { cls: 'f-s2t', font: 'barlow', mode: 'height', lines: [['Mecánica', 's2t1'], ['y lavado.', 's2t2']] },
  { cls: 'f-s2p', font: 'inter', mode: 'width', lines: [['Mantenimiento, reparaciones', 's2p1'], ['y lavado para que tu vehículo', 's2p2'], ['siempre rinda al máximo.', 's2p3']] },
  { cls: 'f-s3t', font: 'barlow', mode: 'height', lines: [['Encuéntranos', 's3t1'], ['en Raos.', ['s3t2a', 's3t2b']]] },
  { cls: 'f-s3a', font: 'inter', mode: 'width', lines: [['Polígono de Raos · Santander', 's3addr']] },
  { cls: 'f-s3btn', font: 'inter5', mode: 'width', lines: [['Cómo llegar', 's3btnText']] },
];

const box = (name) => {
  const names = Array.isArray(name) ? name : [name];
  const bs = names.map((n) => board[n]);
  return [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];
};

const html = `<!doctype html><style>
@font-face{font-family:Anton;src:url(${font('@fontsource/anton/files/anton-latin-400-normal.woff2')})}
@font-face{font-family:'Barlow Condensed';font-weight:800;src:url(${font('@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2')})}
@font-face{font-family:InterVariable;font-weight:100 900;src:url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')})}
</style><body><span style="font-family:Anton">a</span><span style="font-family:'Barlow Condensed';font-weight:800">a</span><span style="font-family:InterVariable">a</span><span style="font-family:InterVariable;font-weight:500">a</span><span style="font-family:InterVariable;font-weight:600">a</span>`;

const browser = await launch();
const page = await browser.newPage();
// a file:// page so the local font files may load (about:blank cannot fetch them)
mkdirSync(join(root, 'qa'), { recursive: true });
writeFileSync(join(root, 'qa/fit.html'), html);
await page.goto('file://' + join(root, 'qa/fit.html'));
await page.evaluate(() => document.fonts.ready);
const ok = await page.evaluate(() => ['100px Anton', '800 100px "Barlow Condensed"', '400 100px InterVariable'].map((f) => document.fonts.check(f)));
if (ok.includes(false)) throw new Error('fonts did not load: ' + ok);

async function metrics(f, text, ls = 0) {
  return page.evaluate(({ f, text, ls }) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${f.weight} 100px ${f.family}`;
    c.letterSpacing = `${ls}px`;
    const m = c.measureText(text);
    return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, A: m.fontBoundingBoxAscent, D: m.fontBoundingBoxDescent, adv: m.width };
  }, { f, text, ls });
}

const out = [];
const report = [];
for (const b of BLOCKS) {
  const f = FONTS[b.font];
  const rows = [];
  for (const [text, name, inkText] of b.lines) {
    const [x0, y0, x1, y1] = box(name);
    const m = await metrics(f, inkText || text);
    const fsH = (100 * (y1 - y0)) / (m.a + m.d);
    const fsW = (100 * (x1 - x0)) / (m.l + m.r);
    rows.push({ text, inkText: inkText || text, x0, y0, x1, y1, m, fsH, fsW });
  }
  // accents sit higher in Anton than in the board's lettering: size display lines from
  // the lines without diacritics when there are any
  const plain = rows.filter((q) => !/[áéíóúñÁÉÍÓÚÑ]/.test(q.inkText));
  const src = b.mode === 'height' && plain.length ? plain : rows;
  const fs = src.reduce((s, r) => s + (b.mode === 'height' ? r.fsH : r.fsW), 0) / src.length;
  // letter-spacing (px at 100px) so the first line's ink width matches at this size
  let ls = 0;
  if (b.mode === 'height') {
    const r0 = src[0];
    const n = [...r0.inkText].length - 1;
    ls = ((r0.x1 - r0.x0) * (100 / fs) - (r0.m.l + r0.m.r)) / n;
    if (!b.spread) ls = Math.max(-2.5, Math.min(3, ls));
  }
  const k = fs / 100;
  const base = [];
  const sxs = [];
  for (const r of rows) {
    const m = ls ? await metrics(f, r.inkText, ls) : r.m;
    // baseline from the ink top (wrong when accents ride higher than the board's) or from
    // the ink bottom (wrong with descenders); use whichever the line allows, else average
    const acc = /[áéíóúñÁÉÍÓÚÑ]/.test(r.inkText), desc = /[gjpqy,;]/.test(r.inkText);
    const fromTop = r.y0 + m.a * k, fromBottom = r.y1 - m.d * k;
    base.push(acc && !desc ? fromBottom : desc && !acc ? fromTop : (fromTop + fromBottom) / 2);
    r.left = r.x0 + m.l * k;
    r.w = (m.l + m.r) * k;
    sxs.push((r.x1 - r.x0) / r.w);
  }
  // display faces only: a gentle horizontal scale closes what letter-spacing could not
  const sx = b.mode === 'height' && !b.spread ? Math.max(0.85, Math.min(1.1, sxs.reduce((a, v) => a + v, 0) / sxs.length)) : 1;
  for (const r of rows) r.wErr = (r.w * sx - (r.x1 - r.x0)).toFixed(1);
  const lh = base.length > 1 ? (base[base.length - 1] - base[0]) / (base.length - 1) : fs * 1.2;
  const m0 = rows[0].m;
  const y = base[0] - lh / 2 - ((m0.A - m0.D) * k) / 2;
  const x = rows.reduce((s, r) => s + r.left, 0) / rows.length;
  const r = (v) => Math.round(v * 100) / 100;
  out.push(`.${b.cls}{--x:${r(x)};--y:${r(y)};--fs:${r(fs)};--lh:${r(lh)};--ls:${Math.round(ls * 10) / 1000}em;--sx:${Math.round(sx * 1000) / 1000}}`);
  report.push(`${b.cls.padEnd(10)} fs ${fs.toFixed(2)} (H ${rows.map((q) => q.fsH.toFixed(1)).join('/')}, W ${rows.map((q) => q.fsW.toFixed(1)).join('/')}) lh ${lh.toFixed(1)} ls ${(ls / 100).toFixed(3)}em sx ${sx.toFixed(3)}  x ${rows.map((q) => q.left.toFixed(1)).join('/')}  wErr ${rows.map((q) => q.wErr).join('/')}`);
}
await browser.close();
writeFileSync(join(root, 'src/fit.css'), `/* generated by scripts/fit-text.mjs from scripts/board.json — board px */\n${out.join('\n')}\n`);
console.log(report.join('\n'));
