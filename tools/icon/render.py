#!/usr/bin/env python3
# Run: python3 tools/icon/render.py   (renders every icon PNG from the SVGs in tools/icon with headless Chrome, then checks each file)
"""Mail Deck icons: SVG sources -> PNG files.

Sources (this folder):
  master.svg               store / notification / options / landing artwork, 128 grid
  16/ 18/ 19/ 32/<state>   toolbar glyphs, each drawn on its own pixel grid
  tray/<state>             the 16x11 tray glyph
  states: normal, signedout, quiet, new, load0..load3

The extension's state folders keep their historical names: red = normal,
blue = signed out, gray = quiet (see extension/core/button.js).

Rendering uses chrome-headless-shell (Playwright's build; `npx playwright install
chromium-headless-shell`), or the binary named by $CHROME. Each PNG is a
screenshot of an <img> holding the SVG at the exact output size, on a
transparent background, in sRGB.
"""
import base64
import glob
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ICONS = ROOT / 'extension' / 'data' / 'icons'
DOCS = ROOT / 'docs'

# master.svg with the store margin trimmed: same artwork, filling ~89 % of a small canvas
TIGHT = '7.5 8.5 112 112'

STATE_DIRS = {
    'red': 'normal', 'blue': 'signedout', 'gray': 'quiet', 'new': 'new',
    'load0': 'load0', 'load1': 'load1', 'load2': 'load2', 'load3': 'load3',
}


def jobs():
    """(source svg, output png, width, height, viewBox override)"""
    for folder, state in STATE_DIRS.items():
        for size in (16, 18, 19, 32):
            yield f'{size}/{state}.svg', ICONS / folder / f'{size}.png', size, size, None
    yield 'master.svg', ICONS / 'red' / '48.png', 48, 48, TIGHT
    yield 'master.svg', ICONS / 'red' / '64.png', 64, 64, TIGHT
    yield 'master.svg', ICONS / 'red' / '128.png', 128, 128, None
    yield '16/normal.svg', ICONS / 'notification' / '16.png', 16, 16, None
    yield '32/normal.svg', ICONS / 'notification' / '32.png', 32, 32, None
    yield 'master.svg', ICONS / 'notification' / '48.png', 48, 48, TIGHT
    yield 'master.svg', ICONS / 'notification' / '64.png', 64, 64, TIGHT
    yield '32/normal.svg', ICONS / 'options' / '32.png', 32, 32, None
    yield 'master.svg', ICONS / 'options' / '64.png', 64, 64, TIGHT
    yield 'tray/normal.svg', ICONS / 'tray' / 'red.png', 16, 11, None
    yield 'tray/signedout.svg', ICONS / 'tray' / 'blue.png', 16, 11, None
    yield 'tray/quiet.svg', ICONS / 'tray' / 'gray.png', 16, 11, None
    yield 'master.svg', DOCS / 'icon.png', 128, 128, None
    yield 'master.svg', DOCS / 'icon-60.png', 60, 60, TIGHT
    yield '32/normal.svg', DOCS / 'favicon.png', 32, 32, None


def find_chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    home = Path.home()
    patterns = [
        home / 'Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell',
        home / '.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell',
    ]
    found = [p for pat in patterns for p in glob.glob(str(pat))]
    if not found:
        sys.exit('chrome-headless-shell not found: run `npx playwright install chromium-headless-shell` or set CHROME=/path/to/it')
    return max(found, key=lambda p: int(re.search(r'shell-(\d+)', p).group(1)))


def render(chrome, src, out, w, h, viewbox):
    svg = (HERE / src).read_text()
    if viewbox:
        svg = re.sub(r'viewBox="[^"]*"', f'viewBox="{viewbox}"', svg, count=1)
    data = base64.b64encode(svg.encode()).decode()
    page = ('<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block}</style>'
            f'<img width="{w}" height="{h}" src="data:image/svg+xml;base64,{data}">')
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / 'page.html'
        html.write_text(page)
        shot = Path(tmp) / 'shot.png'
        subprocess.run([
            chrome, '--disable-gpu', '--no-first-run', f'--user-data-dir={tmp}/profile',
            '--hide-scrollbars', '--force-device-scale-factor=1', '--force-color-profile=srgb',
            '--default-background-color=00000000', f'--window-size={w},{h}',
            '--run-all-compositor-stages-before-draw', '--virtual-time-budget=2000',
            f'--screenshot={shot}', html.as_uri(),
        ], check=True, capture_output=True, timeout=90)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(shot), out)
    return out


# ---------------------------------------------------------------- checks

def read_png(path):
    """Decode an 8-bit RGBA PNG into (width, height, rows of RGBA bytes)."""
    b = path.read_bytes()
    assert b[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos, idat, ihdr = 8, b'', None
    while pos < len(b):
        n, kind = struct.unpack('>I4s', b[pos:pos + 8])
        body = b[pos + 8:pos + 8 + n]
        if kind == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            idat += body
        pos += 12 + n
    w, h, depth, ctype, _, _, interlace = ihdr
    assert (depth, ctype, interlace) == (8, 6, 0), f'expected 8-bit RGBA, got depth {depth} type {ctype}'
    raw, stride, rows, prev = zlib.decompress(idat), w * 4, [], bytearray(w * 4)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - 4] if i >= 4 else 0
            up = prev[i]
            c = prev[i - 4] if i >= 4 else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + up) & 255
            elif f == 3:
                line[i] = (line[i] + (a + up) // 2) & 255
            elif f == 4:
                p = a + up - c
                pa, pb, pc = abs(p - a), abs(p - up), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, rows


def src_is_master(path):
    return (path.parent.name, path.name) in {('red', '48.png'), ('red', '64.png'), ('red', '128.png'), ('notification', '48.png'),
                                             ('notification', '64.png'), ('options', '64.png'), ('docs', 'icon.png'), ('docs', 'icon-60.png')}


def check(path, w, h):
    pw, ph, rows = read_png(path)
    assert (pw, ph) == (w, h), f'size {pw}x{ph}, expected {w}x{h}'
    alpha = [[rows[y][x * 4 + 3] for x in range(w)] for y in range(h)]
    corners = [alpha[0][0], alpha[0][w - 1], alpha[h - 1][0], alpha[h - 1][w - 1]]
    if path.parent.name == 'tray':
        corners = corners[1:3]         # the 16x11 tray glyph fills its top-left and bottom-right corners
    assert not any(corners), f'corners not transparent: {corners}'
    # one connected shape: anything else is a stray pixel
    seen, parts = set(), 0
    for y in range(h):
        for x in range(w):
            if alpha[y][x] and (x, y) not in seen:
                parts += 1
                stack = [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    for nx in (cx - 1, cx, cx + 1):
                        for ny in (cy - 1, cy, cy + 1):
                            if 0 <= nx < w and 0 <= ny < h and alpha[ny][nx] and (nx, ny) not in seen:
                                seen.add((nx, ny))
                                stack.append((nx, ny))
    assert parts == 1, f'{parts} separate shapes (stray pixels?)'
    if path.parent.name != 'tray':
        edge = max(alpha[0] + alpha[h - 1] + [r[0] for r in alpha] + [r[w - 1] for r in alpha]) if src_is_master(path) else 0
        assert not edge, f'shadow clipped at the canvas edge (alpha {edge})'
    opaque = sum(a == 255 for r in alpha for a in r)
    assert opaque, 'no fully opaque pixel'
    xs = [x for y in range(h) for x in range(w) if alpha[y][x]]
    ys = [y for y in range(h) for x in range(w) if alpha[y][x]]
    return f'{w}x{h}  art {min(xs)},{min(ys)}..{max(xs)},{max(ys)}  opaque {opaque}'


def main():
    chrome = find_chrome()
    todo = list(jobs())
    with ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as pool:
        list(pool.map(lambda j: render(chrome, *j), todo))
    failed = 0
    for src, out, w, h, _ in todo:
        try:
            note = check(out, w, h)
            print(f'ok    {out.relative_to(ROOT)}  {note}  <- {src}')
        except AssertionError as e:
            failed += 1
            print(f'FAIL  {out.relative_to(ROOT)}  {e}')
    print(f'{len(todo) - failed}/{len(todo)} files rendered and checked with {Path(chrome).name} ({Path(chrome).parents[1].name})')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
