"""README assets from qa/readme (scripts/readme-assets.mjs) -> .github/assets/:
banner.png, hero-intro.gif (ffmpeg), desktop-sections.jpg (browser frames),
mobile-screens.jpg (phone frames)."""
import glob
import os
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'qa/readme')
OUT = os.path.join(ROOT, '.github/assets')
os.makedirs(OUT, exist_ok=True)
PAPER = (244, 235, 223)
URL = 'seraux-santander.vercel.app'


def font(size):
    for f in ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf']:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def browser(img, scale=1):
    w, h = img.size
    bar = int(44 * scale)
    out = Image.new('RGB', (w, h + bar), (232, 232, 235))
    d = ImageDraw.Draw(out)
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        x = int((22 + i * 22) * scale)
        d.ellipse([x - 6 * scale, bar / 2 - 6 * scale, x + 6 * scale, bar / 2 + 6 * scale], fill=c)
    d.rounded_rectangle([w * 0.3, bar * 0.22, w * 0.7, bar * 0.78], radius=int(8 * scale), fill=(255, 255, 255))
    f = font(int(15 * scale))
    tw = d.textlength(URL, font=f)
    d.text(((w - tw) / 2, bar / 2 - 9 * scale), URL, fill=(70, 70, 75), font=f)
    out.paste(img, (0, bar))
    return out


def rounded(img, r):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=r, fill=255)
    return m


def phone(img):
    w, h = img.size
    pad, r = 26, 86
    body = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle([0, 0, body.size[0] - 1, body.size[1] - 1], radius=r + pad, fill=(20, 20, 22, 255))
    body.paste(img, (pad, pad), rounded(img, r))
    return body


def main():
    shutil.copy(os.path.join(SRC, 'banner.png'), os.path.join(OUT, 'banner.png'))

    # desktop sections, stacked in one browser frame
    shots = [Image.open(os.path.join(SRC, f'd-{k}.png')).convert('RGB') for k in ('s1', 's2', 's3')]
    W = shots[0].size[0]
    stack = Image.new('RGB', (W, sum(s.size[1] for s in shots)), PAPER)
    y = 0
    for s in shots:
        stack.paste(s, (0, y))
        y += s.size[1]
    framed = browser(stack)
    framed = framed.resize((1400, int(framed.size[1] * 1400 / framed.size[0])), Image.LANCZOS)
    framed.save(os.path.join(OUT, 'desktop-sections.jpg'), quality=82, optimize=True, progressive=True)

    # phones
    phones = [phone(Image.open(os.path.join(SRC, f'm-{k}.png')).convert('RGB')) for k in ('hero', 's1', 's2', 's3')]
    pw, ph = phones[0].size
    gap = 70
    sheet = Image.new('RGB', (pw * 4 + gap * 5, ph + gap * 2), PAPER)
    for i, p in enumerate(phones):
        sheet.paste(p, (gap + i * (pw + gap), gap), p)
    sheet = sheet.resize((1600, int(sheet.size[1] * 1600 / sheet.size[0])), Image.LANCZOS)
    sheet.save(os.path.join(OUT, 'mobile-screens.jpg'), quality=82, optimize=True, progressive=True)

    # intro gif: hold the first frame 0.6 s and the last 1.6 s
    frames = sorted(glob.glob(os.path.join(SRC, 'frames', 'f_*.png')))
    seq = os.path.join(SRC, 'seq')
    shutil.rmtree(seq, ignore_errors=True)
    os.makedirs(seq)
    order = [frames[0]] * 7 + frames + [frames[-1]] * 19
    for i, f in enumerate(order):
        os.symlink(f, os.path.join(seq, f's_{i:04d}.png'))
    gif = os.path.join(OUT, 'hero-intro.gif')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '12', '-i', os.path.join(seq, 's_%04d.png'),
                    '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];'
                    '[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', gif], check=True)
    for f in os.listdir(OUT):
        print(f, round(os.path.getsize(os.path.join(OUT, f)) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
