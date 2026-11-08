"""Draw the app icon (a mini type-chart grid) as PNGs with no dependencies.
usage (from the repo folder): python tools/make_icons.py icons"""
import struct, sys, zlib, os

def png(path, size, px):
    raw = b"".join(b"\x00" + bytes(px[y * size * 3:(y + 1) * size * 3]) for y in range(size))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
BG = hexrgb("#1c1f25")
G, R, N, D = hexrgb("#3fb06a"), hexrgb("#e5533d"), hexrgb("#3a3f49"), hexrgb("#8f2a20")
HEAD = [hexrgb(c) for c in ("#e62829", "#2980ef", "#3fa129", "#e5b800")]
# 4x4: top row = type colors, rest = a little matchup pattern
GRID = [HEAD,
        [G, N, R, G],
        [N, R, G, D],
        [R, G, N, G]]

def draw(size):
    px = bytearray(BG * (size * size))
    inner = size * 0.62                     # keep inside the maskable safe zone
    gap = inner * 0.06
    cell = (inner - gap * 3) / 4
    x0 = y0 = (size - inner) / 2
    rad = cell * 0.18
    for r in range(4):
        for c in range(4):
            col = GRID[r][c]
            cx, cy = x0 + c * (cell + gap), y0 + r * (cell + gap)
            for y in range(int(cy), int(cy + cell) + 1):
                for x in range(int(cx), int(cx + cell) + 1):
                    # rounded corners
                    dx = max(cx + rad - x, 0, x - (cx + cell - rad))
                    dy = max(cy + rad - y, 0, y - (cy + cell - rad))
                    if dx * dx + dy * dy <= rad * rad and 0 <= x < size and 0 <= y < size:
                        i = (y * size + x) * 3
                        px[i:i + 3] = bytes(col)
    return px

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for s in (192, 512):
    png(os.path.join(out, f"icon-{s}.png"), s, draw(s))
print("ok")
