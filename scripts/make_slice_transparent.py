from PIL import Image
from pathlib import Path

src = Path(r"c:\Users\Chriiss1997\Desktop\Billiga Pizzor - Live\images\Slice_karta.png")
out = Path(r"c:\Users\Chriiss1997\Desktop\Billiga Pizzor - Live\images\Slice_karta_clean.png")

im = Image.open(src).convert("RGBA")
p = im.load()

# Remove neutral checkerboard background tones while preserving colorful foreground.
# Pixels that are near-neutral and fairly bright are treated as background.
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = p[x, y]
        mx = max(r, g, b)
        mn = min(r, g, b)
        chroma = mx - mn
        if a > 0 and chroma <= 18 and mx >= 170:
            p[x, y] = (r, g, b, 0)

# Light edge cleanup for near-background pixels
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = p[x, y]
        mx = max(r, g, b)
        mn = min(r, g, b)
        chroma = mx - mn
        if a > 0 and chroma <= 24 and mx >= 155:
            p[x, y] = (r, g, b, max(0, a - 220))

im.save(out, format="PNG")
print(f"saved:{out}")
