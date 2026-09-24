"""
generate_icons.py
Creates ic_launcher.png at all standard Android mipmap densities using only
the Python standard library (struct + zlib). No Pillow required.

Icon: solid #0EA5E9 (Travora sky-blue) square with a simple white 'T' lettermark.
"""
import os
import struct
import zlib

BASE = r"c:\Projects\Travora\Travora\sms_gateway\android\app\src\main\res"

SIZES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

# Sky-blue background  (#0EA5E9) and white lettermark (#FFFFFF)
BG  = (0x0E, 0xA5, 0xE9, 0xFF)   # RGBA
FG  = (0xFF, 0xFF, 0xFF, 0xFF)


def make_png(size: int) -> bytes:
    """Return raw PNG bytes for a solid coloured square with a centred white 'T'."""
    # Build RGBA pixel grid
    grid = [[BG] * size for _ in range(size)]

    # Draw a simple 'T' glyph scaled to the icon size
    thickness = max(2, size // 12)
    bar_w     = size * 2 // 3          # horizontal bar width
    bar_h     = thickness              # horizontal bar height
    stem_w    = thickness              # vertical stem width
    stem_h    = size * 5 // 9         # vertical stem height (below bar)

    # Horizontal bar (centred)
    bx = (size - bar_w) // 2
    by = size // 5
    for y in range(by, by + bar_h):
        for x in range(bx, bx + bar_w):
            if 0 <= y < size and 0 <= x < size:
                grid[y][x] = FG

    # Vertical stem (centred under bar)
    sx = (size - stem_w) // 2
    sy = by + bar_h
    for y in range(sy, sy + stem_h):
        for x in range(sx, sx + stem_w):
            if 0 <= y < size and 0 <= x < size:
                grid[y][x] = FG

    # PNG chunk helpers
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    # IHDR
    ihdr_data = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    # IDAT — raw image data, filter byte 0 per scanline, RGB (drop alpha for compat)
    raw = b""
    for row in grid:
        raw += b"\x00"          # filter type None
        for px in row:
            raw += bytes(px[:3])  # RGB
    # Rewrite IHDR as RGB (colour type 2)
    ihdr_data = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)

    idat_data = zlib.compress(raw, 9)

    png  = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr_data)
    png += chunk(b"IDAT", idat_data)
    png += chunk(b"IEND", b"")
    return png


for folder, size in SIZES.items():
    dst_dir = os.path.join(BASE, folder)
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, "ic_launcher.png")
    with open(dst, "wb") as f:
        f.write(make_png(size))
    print(f"  wrote {dst}  ({size}x{size})")

print("Done.")
