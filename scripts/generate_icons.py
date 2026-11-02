import os
import zlib
import struct

def make_png(size, output_path):
    # RGBA image buffer
    # Background: teal/emerald (#0d9488 -> rgb 13, 148, 136)
    # Icon motif: 3 vertical bars representing analytics & metrics
    width = size
    height = size
    raw_rows = []

    # Bar bounds
    bar_w = max(2, int(size * 0.16))
    gap = max(1, int(size * 0.08))
    start_x = int(size * 0.22)
    base_y = int(size * 0.78)

    h1 = int(size * 0.32)
    h2 = int(size * 0.58)
    h3 = int(size * 0.44)

    bars = [
        (start_x, base_y - h1, start_x + bar_w, base_y),
        (start_x + bar_w + gap, base_y - h2, start_x + 2 * bar_w + gap, base_y),
        (start_x + 2 * (bar_w + gap), base_y - h3, start_x + 3 * bar_w + 2 * gap, base_y)
    ]

    radius = size * 0.22
    inset = max(1, int(size * 0.04))

    for y in range(height):
        row = bytearray([0]) # Filter type 0: None
        for x in range(width):
            # Check rounded box bounds
            dx = max(abs(x - width / 2.0) - (width / 2.0 - radius - inset), 0.0)
            dy = max(abs(y - height / 2.0) - (height / 2.0 - radius - inset), 0.0)
            dist = (dx * dx + dy * dy) ** 0.5

            if dist > radius:
                # Outside rounded corner
                row.extend([0, 0, 0, 0])
                continue

            # Check if inside any bar
            in_bar = False
            for bx1, by1, bx2, by2 in bars:
                if bx1 <= x <= bx2 and by1 <= y <= by2:
                    in_bar = True
                    break

            if in_bar:
                # White bar with solid opacity
                row.extend([255, 255, 255, 255])
            else:
                # Teal gradient from top-left (rgb 16, 185, 129) to bottom-right (rgb 13, 148, 136)
                t = (x + y) / (width + height)
                r = int(16 * (1 - t) + 13 * t)
                g = int(185 * (1 - t) + 148 * t)
                b = int(129 * (1 - t) + 136 * t)
                row.extend([r, g, b, 255])

        raw_rows.append(bytes(row))

    raw_data = b"".join(raw_rows)
    compressed = zlib.compress(raw_data, level=9)

    def chunk(chunk_type, data):
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xffffffff)
        return length + chunk_type + data + crc

    png_header = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    idat = chunk(b"IDAT", compressed)
    iend = chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(png_header + ihdr + idat + iend)

for s in [16, 32, 48, 128]:
    make_png(s, f"icons/icon-{s}.png")
    print(f"Generated icons/icon-{s}.png ({s}x{s})")
