"""Generates the PWA icons from the game's logo (same design as the SVG favicon in index.html).
Usage: python tools/make_icons.py   (requires Pillow). Output: icons/*.png and icons/icon.svg"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
BG, CYAN, GREEN = (5, 7, 11, 255), (25, 230, 255, 255), (25, 245, 140, 255)
SS = 4  # supersampling for smooth edges

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#05070b"/><path d="M10 50 L54 14 L54 50 Z" fill="#19e6ff"/><path d="M14 50 L30 36 L38 42 L54 26" stroke="#19f58c" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/></svg>
"""


def draw(size, rounded=True, scale=1.0):
    """scale < 1 shrinks the artwork toward the centre (maskable safe zone)."""
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 12 / 64), fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    k = S / 64 * scale
    off = (S - 64 * k) / 2
    P = lambda x, y: (off + x * k, off + y * k)
    d.polygon([P(10, 50), P(54, 14), P(54, 50)], fill=CYAN)
    pts = [P(14, 50), P(30, 36), P(38, 42), P(54, 26)]
    w = max(1, int(5 * k))
    d.line(pts, fill=GREEN, width=w, joint='curve')
    for p in (pts[0], pts[-1]):
        r = w / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=GREEN)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    draw(192).save(os.path.join(OUT, 'icon-192.png'))
    draw(512).save(os.path.join(OUT, 'icon-512.png'))
    draw(512, rounded=False, scale=0.72).save(os.path.join(OUT, 'icon-maskable-512.png'))
    draw(180, rounded=False, scale=0.86).save(os.path.join(OUT, 'apple-touch-icon.png'))
    draw(32).save(os.path.join(OUT, 'favicon-32.png'))
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(SVG)
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
