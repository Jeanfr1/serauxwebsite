"""Builds the source plates for the site from the design kit (run once, output in assets-src/).

  hero   00-referencias/HERO-ESCOLHIDO.png (the approved hero) cleaned of its baked text,
         logo and nav, its screenshot corners/right strip filled, then Real-ESRGAN x4.
  photos the owner's three workshop photos (04-fotos-originais) cleaned of the Maps
         viewer UI, Real-ESRGAN x2.

Usage: python3 scripts/prepare-images.py [hero|layers|photos|all] [--no-sr]
"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets-src')
os.makedirs(OUT, exist_ok=True)


def kit(path, flags=cv2.IMREAD_COLOR):
    return cv2.imread(os.path.join(ROOT, path), flags)


def save(name, img):
    cv2.imwrite(os.path.join(OUT, name), img)
    print('wrote', name, img.shape)


# ---------------------------------------------------------------- hero
# Approved hero (812x490 screenshot). Board px = hero px x 1.2623 (SIFT, residual 0.6 px).
HERO_W = 812          # board width 1024 maps to the full screenshot width
ART_RIGHT = 799       # x >= 799 is the window's black strip
TEXT_BOXES = [        # baked UI and copy, re-set as live HTML on the page
    (36, 6, 340, 84),     # logo
    (386, 14, 620, 40),   # nav
    (628, 10, 780, 44),   # header button
    (42, 98, 210, 132),   # eyebrow
    (42, 138, 404, 284),  # headline
    (42, 284, 386, 328),  # intro (stops before the baked 'Precisión.')
]


def hero_clean():
    src = kit('00-referencias/HERO-ESCOLHIDO.png')
    img = src.copy()
    h = img.shape[0]
    # Right strip: continue the paper and the horizontal red rules by edge replication.
    strip = img[:, ART_RIGHT - 10:ART_RIGHT].copy()
    reps = int(np.ceil((HERO_W - ART_RIGHT) / 10)) + 1
    ext = np.concatenate([strip[:, ::(-1) ** (i + 1)] for i in range(reps)], axis=1)
    img[:, ART_RIGHT:] = ext[:, :HERO_W - ART_RIGHT]
    mask = np.zeros(img.shape[:2], np.uint8)
    # Rounded window corners (top-left r~8, top-right r~10): repaint as paper.
    g = src.mean(2)
    mask[:16, :16][g[:16, :16] < 170] = 255
    mask[:16, ART_RIGHT - 18:ART_RIGHT][g[:16, ART_RIGHT - 18:ART_RIGHT] < 170] = 255
    mask[:26, ART_RIGHT - 20:] = 255
    # Text ink inside the boxes: anything clearly off the paper tone.
    paper = np.array([223, 232, 236], np.float32)  # BGR
    diff = np.abs(img.astype(np.float32) - paper).sum(2)
    for x0, y0, x1, y1 in TEXT_BOXES:
        sub = (diff[y0:y1, x0:x1] > 45).astype(np.uint8) * 255
        mask[y0:y1, x0:x1] |= sub
    x0, y0, x1, y1 = TEXT_BOXES[2]   # the button is a solid block
    mask[y0:y1, x0:x1] = 255
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    out = cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA)
    # Inpainting leaves flat patches; give them the paper's grain back.
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 3.2, out.shape[:2]).astype(np.float32)
    soft = cv2.GaussianBlur(mask, (0, 0), 1.5).astype(np.float32)[..., None] / 255
    out = np.clip(out.astype(np.float32) + grain[..., None] * soft, 0, 255).astype(np.uint8)
    save('hero-clean-lr.png', out)
    save('hero-mask-lr.png', mask)
    return out


def hero():
    import esrgan
    clean = hero_clean()
    net = esrgan.load_model()
    big = esrgan.sr4(net, clean)
    save('hero-plate-x4.png', big)


# ---------------------------------------------------------------- hero layers
# The intro animation (06-roteiros/ANIMACAO.md) needs the approved art without its tyre:
#   hero-paper   the plate with the tyre replaced by paper, the red plane completed and the
#                red construction lines kept (start state, and the "Ver esquema" ground)
#   hero-sketch  the same tyre as a graphite drawing (RGBA), the "detalles tecnicos"
#   hero-lines   tyre silhouette, rim lip and hub as SVG paths for the line draw-on
# All in hero px x4 (the plate grid); the SVG uses the 812x490 hero px grid.
RED_PLANE = (684, 74, 765, 339)   # x0, y0, x1, y1 in hero px, from the red blobs


def tyre_geometry(lr):
    f = lr.astype(np.int32)
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    gray = 0.299 * r + 0.587 * g + 0.114 * b
    red = r - np.maximum(g, b) > 60
    dark = ((gray < 85) & ~red).astype(np.uint8) * 255
    roi = np.zeros_like(dark)
    roi[50:490, 430:790] = 255
    dark &= roi
    m = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(cs[0])[:, 0, :].astype(np.float32)
    # rim lip: hull of the bright metal right of the tread
    hm = np.zeros(gray.shape, np.uint8)
    cv2.fillPoly(hm, [hull.astype(np.int32)], 1)
    br = ((gray > 150) & ~red & (hm > 0)).astype(np.uint8)
    br[:, :600] = 0
    br = cv2.morphologyEx(br, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(br)
    keep = np.isin(lab, 1 + np.nonzero(st[1:, 4] > 40)[0])
    ys, xs = np.nonzero(keep)
    pts = cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))
    rim = cv2.fitEllipse(pts)
    return hull, rim, gray, red


def smooth_path(pts, closed=True):
    """Catmull-Rom through the points as cubic Beziers (SVG path data)."""
    p = [tuple(map(float, q)) for q in pts]
    n = len(p)
    out = [f'M{p[0][0]:.1f},{p[0][1]:.1f}']
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f'C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}')
    return ' '.join(out) + (' Z' if closed else '')


def ellipse_path(cx, cy, rx, ry, rot, start=0.0):
    """Closed ellipse as two arcs, starting at angle `start` (radians)."""
    t = np.radians(rot)

    def pt(a):
        x, y = rx * np.cos(a), ry * np.sin(a)
        return cx + x * np.cos(t) - y * np.sin(t), cy + x * np.sin(t) + y * np.cos(t)
    a0, a1 = pt(start), pt(start + np.pi)
    return (f'M{a0[0]:.1f},{a0[1]:.1f} A{rx:.1f},{ry:.1f} {rot:.1f} 1 1 {a1[0]:.1f},{a1[1]:.1f} '
            f'A{rx:.1f},{ry:.1f} {rot:.1f} 1 1 {a0[0]:.1f},{a0[1]:.1f}')


def hero_layers():
    lr = cv2.imread(os.path.join(OUT, 'hero-clean-lr.png'))
    plate = cv2.imread(os.path.join(OUT, 'hero-plate-x4.png'))
    S = plate.shape[1] / lr.shape[1]
    hull, rim, gray_lr, red_lr = tyre_geometry(lr)
    H, W = plate.shape[:2]

    # tyre mask on the x4 grid, a little outside the silhouette, feathered
    m4 = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m4, [(hull * S).round().astype(np.int32)], 255, lineType=cv2.LINE_AA)
    m4 = cv2.dilate(m4, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    feather = cv2.GaussianBlur(m4, (0, 0), 5).astype(np.float32)[..., None] / 255
    # the paper layer reaches further out so the pencil ghosts around the tyre fade softly
    wide = cv2.dilate(m4, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)))
    wide = cv2.GaussianBlur(wide, (0, 0), 22).astype(np.float32)[..., None] / 255

    # paper tone field: inpaint everything that isn't paper, at low res
    f = lr.astype(np.int32)
    notpaper = ((gray_lr < 200) | red_lr).astype(np.uint8) * 255
    hm = np.zeros(gray_lr.shape, np.uint8)
    cv2.fillPoly(hm, [hull.astype(np.int32)], 255)
    tone = cv2.inpaint(lr, cv2.dilate(notpaper | hm, np.ones((5, 5), np.uint8)), 25, cv2.INPAINT_TELEA)
    tone = cv2.GaussianBlur(tone, (0, 0), 6)
    tone4 = cv2.resize(tone, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    # paper grain: fine noise plus a soft mottle (a sampled patch repeats visibly)
    rng = np.random.default_rng(11)
    fine = cv2.GaussianBlur(rng.normal(0, 3.4, (H, W)).astype(np.float32), (0, 0), 0.7)
    mottle = cv2.resize(rng.normal(0, 1.0, (H // 64, W // 64)).astype(np.float32), (W, H),
                        interpolation=cv2.INTER_CUBIC)
    tile = (fine + mottle)[..., None]
    paper = tone4 + tile

    # complete the red plane behind the tyre: its median red plus a pencil-stroke texture
    x0, y0, x1, y1 = [int(round(v * S)) for v in RED_PLANE]
    rh, rw = y1 - y0, x1 - x0
    strokes = rng.normal(0, 9.0, (rh, rw)).astype(np.float32)
    k = np.zeros((15, 15), np.float32)
    cv2.line(k, (0, 14), (14, 0), 1.0, 1)
    strokes = cv2.filter2D(strokes, -1, k / k.sum()) * 2.2
    strokes += cv2.GaussianBlur(rng.normal(0, 3.0, (rh, rw)).astype(np.float32), (0, 0), 0.8)
    paper[y0:y1, x0:x1] = np.array([44, 48, 168], np.float32) + strokes[..., None]

    # red construction lines that cross the tyre: keep them, recoloured onto paper
    pf = plate.astype(np.float32)
    redness = pf[..., 2] - np.maximum(pf[..., 0], pf[..., 1])
    inplane = np.zeros((H, W), bool)
    inplane[y0:y1, x0:x1] = True
    a = np.clip((redness - 35) / 70, 0, 1) * (~inplane)
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.8)[..., None]
    line_col = np.array([52, 44, 206], np.float32)   # BGR of the drafting red on paper
    paper = paper * (1 - a * 0.85) + line_col * a * 0.85

    out = plate.astype(np.float32) * (1 - wide) + paper * wide
    save('hero-paper-x4.png', np.clip(out, 0, 255).astype(np.uint8))

    # graphite drawing of the same tyre (colour dodge "pencil" filter)
    g4 = cv2.GaussianBlur(cv2.cvtColor(plate, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.1)
    inv_blur = cv2.GaussianBlur(255 - g4, (0, 0), 7)
    dodge = np.clip(g4 * 255 / np.maximum(255 - inv_blur, 1), 0, 255)
    ink = (255 - dodge) / 255
    ink = np.clip(ink * 2.1, 0, 1) ** 1.25
    tonal = np.clip((150 - g4) / 150, 0, 1) * 0.16          # a light shading under the lines
    alpha = np.clip(ink + tonal, 0, 1) * feather[..., 0]
    alpha = np.where(alpha < 0.07, 0, alpha)          # drop the faint grain: smaller file
    sketch = np.zeros((H, W, 4), np.uint8)
    sketch[..., :3] = (38, 40, 44)
    sketch[..., 3] = (alpha * 255).round().astype(np.uint8)
    # only the tyre area carries ink: ship that crop (its box goes to hero-lines.json)
    ys, xs = np.nonzero(sketch[..., 3] > 2)
    sk_box = [int(xs.min()) // 8 * 8, int(ys.min()) // 8 * 8, min(W, -(-int(xs.max() + 1) // 8) * 8), H]
    save('hero-sketch-x4.png', sketch[sk_box[1]:sk_box[3], sk_box[0]:sk_box[2]])

    # SVG paths for the draw-on, in hero px
    (cx, cy), (w_, h_), ang = rim
    hullp = hull[::-1] if cv2.contourArea(hull) < 0 else hull
    paths = {
        'silhouette': smooth_path(hullp[::2]),
        'rim': ellipse_path(cx, cy, w_ / 2, h_ / 2, ang, start=np.pi),
        'hub': ellipse_path(cx + 2, cy + 6, w_ * 0.085, h_ * 0.075, ang),
    }
    import json
    with open(os.path.join(ROOT, 'src', 'hero-lines.json'), 'w') as fh:   # read by src/hero.js
        json.dump({'viewBox': [0, 0, lr.shape[1], lr.shape[0]], 'paths': paths,
                   'rim': [round(float(v), 2) for v in (cx, cy, w_, h_, ang)],
                   'hull_bbox': [int(v) for v in cv2.boundingRect(hull.astype(np.int32))],
                   'sketch_box_x4': sk_box, 'plate_x4': [W, H]}, fh, indent=1)
    print('rim ellipse', rim)


# ---------------------------------------------------------------- photos
# The owner's photos are screenshots of the Maps photo viewer: avatar + name + close
# button in the top band (cropped away) and translucent arrow buttons on the sides.
PHOTOS = {
    # name: (top crop, [approx arrow centres])
    'acessorios': (86, [(57.5, 484.5), (1278.5, 484.5)]),
    'oficina': (86, [(47.5, 483.5), (1272.5, 484.5)]),
    'fachada': (70, [(1270.0, 470.0)]),
}


def find_circle(gray, cx, cy, search=14):
    """Refine an arrow button: the centre/radius with the strongest edge on its rim."""
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1)
    th = np.linspace(0, 2 * np.pi, 180, endpoint=False)
    best = None
    for r in np.arange(34, 38.25, 0.25):
        for dy in range(-search, search + 1):
            for dx in range(-search, search + 1):
                x = cx + dx + r * np.cos(th)
                y = cy + dy + r * np.sin(th)
                xi = np.clip(x.round().astype(int), 0, gray.shape[1] - 1)
                yi = np.clip(y.round().astype(int), 0, gray.shape[0] - 1)
                rad = gx[yi, xi] * np.cos(th) + gy[yi, xi] * np.sin(th)
                score = np.abs(np.median(rad))
                if best is None or score > best[0]:
                    best = (score, cx + dx, cy + dy, r)
    return best[1:]


# Maps viewer buttons are rgba(33,34,36,0.6) discs (joint least-squares fit over the five
# buttons' rims, rmse 3.2/255), so the photo underneath can be recovered exactly.
BUTTON_ALPHA = 0.6
BUTTON_BGR = np.array([36.3, 34.1, 32.6], np.float32)


def remove_button(img, cx, cy, r):
    """Undo a translucent viewer disc (out = a*C + (1-a)*bg) and inpaint its white glyph."""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    d = np.hypot(xx - cx, yy - cy)
    fl = img.astype(np.float32)
    cover = np.clip(r + 0.5 - d, 0, 1)[..., None] * BUTTON_ALPHA   # anti-aliased rim
    rest = (fl - cover * BUTTON_BGR) / (1 - cover)
    rest = np.clip(rest, 0, 255).astype(np.uint8)
    inner = d < r + 1
    # recovered pixels carry 2.5x the JPEG noise: smooth them a little
    smooth = cv2.bilateralFilter(rest, 5, 18, 3)
    rest[inner] = smooth[inner]
    glyph = ((fl.min(2) > 185) & (d < r * 0.62)).astype(np.uint8) * 255
    glyph = cv2.dilate(glyph, np.ones((5, 5), np.uint8))
    seam = ((d > r - 1.5) & (d < r + 1.5)).astype(np.uint8) * 255
    out = cv2.inpaint(rest, glyph | seam, 3, cv2.INPAINT_TELEA)
    print(f'  button at ({cx:.1f},{cy:.1f}) r={r:.1f}')
    return out


def photos():
    import esrgan
    net = None if '--no-sr' in sys.argv else esrgan.load_model()
    for name, (top, buttons) in PHOTOS.items():
        img = kit(f'04-fotos-originais/{name}.png')
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        for cx, cy in buttons:
            img = remove_button(img, *find_circle(gray, cx, cy))
        img = img[top:]
        save(f'{name}-clean.png', img)
        if '--no-sr' not in sys.argv:
            save(f'{name}-x2.png', esrgan.x2(net, img))


# ---------------------------------------------------------------- photo grade
# The board shows the same three photos brighter and more vivid. Move each real photo's
# Lab mean/std part of the way towards the board's version of it (Reinhard transfer).
GRADE = {   # photo: (board region x0, y0, x1, y1 of the solid photo, strength, lightness strength)
    'acessorios': ((390, 625, 1024, 980), 0.6, 0.0),
    'oficina': ((0, 995, 680, 1306), 0.6, 0.0),   # the board's crop holds more dark cars: keep L
    'fachada': ((370, 1322, 985, 1536), 0.5, 0.5),
}


def grade():
    board = kit('02-direcao/composicao-final.png')
    for name, ((x0, y0, x1, y1), k, kl) in GRADE.items():
        ref = cv2.cvtColor(board[y0:y1, x0:x1], cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
        img = cv2.imread(os.path.join(OUT, f'{name}-x2.png'))
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        flat = lab.reshape(-1, 3)
        mu, sd = flat.mean(0), flat.std(0) + 1e-3
        rmu, rsd = ref.mean(0), ref.std(0)
        tgt_mu = mu + (rmu - mu) * np.array([kl, k, k], np.float32)
        tgt_sd = sd * (1 + (rsd / sd - 1) * k)
        out = (lab - mu) / sd * tgt_sd + tgt_mu
        out = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
        print(f'  {name}: L {mu[0]:.0f}->{tgt_mu[0]:.0f}  sdL {sd[0]:.0f}->{tgt_sd[0]:.0f}')
        save(f'{name}-graded.png', out)


# ---------------------------------------------------------------- small assets
def crop_alpha(img, pad=8):
    ys, xs = np.nonzero(img[..., 3] > 8)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.shape[1])
    return img[y0:y1, x0:x1]


def value_noise(h, w, cell, rng, aniso=1.0):
    """Smooth noise in [0,1]; aniso > 1 stretches it horizontally (dry-brush streaks)."""
    gh, gw = max(h // cell + 2, 2), max(int(w // (cell * aniso)) + 2, 2)
    g = rng.random((gh, gw)).astype(np.float32)
    return cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC)


def brush_edge(w, h, side, band, rng):
    """Alpha for a photo whose `side` edge dissolves into paper like a dry brush."""
    x = np.arange(w, dtype=np.float32)[None, :].repeat(h, 0)
    if side == 'right':
        x = x[:, ::-1]
    coarse = value_noise(h, w, 120, rng, 1.5)
    bristle = value_noise(h, w, 3, rng, 14.0)          # long thin horizontal streaks
    mid = value_noise(h, w, 14, rng, 6.0)
    t = x / band + (coarse - 0.5) * 0.85 + (mid - 0.5) * 0.4 + (bristle - 0.5) * 0.16
    a = np.clip((t - 0.3) / 0.45, 0, 1)
    a = a * a * (3 - 2 * a)
    # gritty, uneven coverage inside the transition (paper tooth showing through)
    grit = rng.random((h, w)).astype(np.float32)
    a = np.where((a > 0.02) & (a < 0.98), np.clip(a + (grit - 0.5) * 0.55 * (1 - a), 0, 1), a)
    # a few clustered flecks of photo out in the paper, like dragged pigment
    cluster = value_noise(h, w, 30, rng, 3.0)
    fleck = (rng.random((h, w)) > 0.985) & (cluster > 0.62) & (t > 0.05) & (t < 0.45)
    a = np.maximum(a, cv2.dilate(fleck.astype(np.uint8), np.ones((2, 3), np.uint8)) * 0.85)
    return cv2.GaussianBlur(a, (0, 0), 0.6)


def masks():
    rng = np.random.default_rng(23)
    # board px of each photo box -> mask at 2 px per board px
    specs = {
        'mask-s1': (744, 363, [('left', 96)]),
        'mask-s2': (790, 321, [('right', 92)]),
        'mask-s3': (680, 234, [('left', 40), ('right', 26)]),
    }
    for name, (bw, bh, edges) in specs.items():
        w, h = bw * 2, bh * 2
        a = np.ones((h, w), np.float32)
        for side, band in edges:
            a = np.minimum(a, brush_edge(w, h, side, band * 2, rng))
        rgba = np.zeros((h, w, 4), np.uint8)
        rgba[..., :3] = 0
        rgba[..., 3] = (a * 255).round().astype(np.uint8)
        save(f'{name}.png', rgba)


def assets():
    logo = kit('01-identidade/seraux-logo-transparente.png', cv2.IMREAD_UNCHANGED)
    save('logo.png', crop_alpha(logo, 2))
    save('rueda.png', crop_alpha(kit('05-camadas/roda-esboco.png', cv2.IMREAD_UNCHANGED)))
    wrench = kit('05-camadas/chave-esboco.png', cv2.IMREAD_UNCHANGED)
    # the wrench comes with a soft white glow in its alpha: keep only the drawing
    bgr, al = wrench[..., :3].astype(np.float32), wrench[..., 3].astype(np.float32) / 255
    ink = 1 - bgr.mean(2) / 255                      # graphite strength
    body = cv2.morphologyEx((al > 0.85).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    body = cv2.GaussianBlur(body.astype(np.float32), (0, 0), 1.2)
    w2 = wrench.copy()
    w2[..., 3] = (np.clip(np.maximum(body * 0.92, ink * al * 1.4), 0, 1) * 255).astype(np.uint8)
    save('llave.png', crop_alpha(w2))
    masks()


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what == 'hero-lr':
        hero_clean()
    if what in ('hero', 'all'):
        hero()
    if what in ('layers', 'hero', 'all'):
        hero_layers()
    if what in ('photos', 'all'):
        photos()
    if what in ('grade', 'photos', 'all'):
        grade()
    if what in ('assets', 'all'):
        assets()
