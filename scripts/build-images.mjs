// assets-src/ (from prepare-images.py) -> public/img/ as AVIF + WebP at the sizes the page uses.
// Names carry a version (V) because /img is served immutable: bump V when an image changes.
import sharp from 'sharp';
import { mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'assets-src', f);
const out = join(root, 'public/img');
const V = 'v1';

const JOBS = [
  // name, source, widths, options
  ['hero', 'hero-plate-x4.png', [1200, 1800, 2600], { q: 62 }],
  ['hero-papel', 'hero-paper-x4.png', [1200, 1800, 2600], { q: 60 }],
  // the sketch is a crop of the plate grid: these widths match the plate's 1200/1800/2600
  ['hero-boceto', 'hero-sketch-x4.png', [460, 690, 990], { q: 50, alpha: true, alphaQ: 55 }],
  ['neumaticos', 'acessorios-graded.png', [800, 1400, 2000], { q: 62 }],
  ['taller', 'oficina-graded.png', [800, 1400, 2000], { q: 62 }],
  ['fachada', 'fachada-graded.png', [800, 1400, 2000], { q: 62 }],
  ['logo', 'logo.png', [480, 960], { q: 80, alpha: true }],
  ['rueda', 'rueda.png', [300, 600], { q: 60, alpha: true }],
  ['llave', 'llave.png', [420, 840], { q: 70, alpha: true }],
  ['borde-s1', 'mask-s1.png', [1488], { q: 70, alpha: true, webpOnly: true }],
  ['borde-s2', 'mask-s2.png', [1580], { q: 70, alpha: true, webpOnly: true }],
  ['borde-s3', 'mask-s3.png', [1360], { q: 70, alpha: true, webpOnly: true }],
];

mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(join(out, f));

for (const [name, file, widths, o] of JOBS) {
  const meta = await sharp(src(file)).metadata();
  for (const w of widths) {
    const width = Math.min(w, meta.width);
    const base = sharp(src(file)).resize({ width });
    const stem = join(out, `${name}-${V}-${w}`);
    await base.clone().webp({ quality: o.q, alphaQuality: o.alphaQ ?? (o.alpha ? 85 : 100), effort: 6 }).toFile(stem + '.webp');
    if (!o.webpOnly) await base.clone().avif({ quality: Math.round(o.q * 0.8), effort: 6 }).toFile(stem + '.avif');
  }
  console.log(name, meta.width + 'x' + meta.height, '->', widths.join(','));
}
// social card: the cleaned hero, 1200x630
await sharp(src('hero-plate-x4.png')).resize(1200, 630, { fit: 'cover', position: 'right' }).jpeg({ quality: 78 }).toFile(join(out, `og-${V}.jpg`));
