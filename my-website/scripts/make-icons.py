"""Generate PWA app icons from the logo assets.

- logo-new.png (full badge wordmark) is used as-is for standard icons,
  since the badge fits within a rounded-square safe area.
- logo-new-icon.png (mascot mark on dark bg) is used for maskable icons
  because its mascot sits centered with generous padding, so nothing is
  clipped by circular/squircle masks.
"""
from PIL import Image
import os

BASE = os.path.dirname(os.path.dirname(__file__))
BADGE = os.path.join(BASE, "logo-new.png")
MARK = os.path.join(BASE, "logo-new-icon.png")
OUT_DIR = os.path.join(BASE, "icons")
os.makedirs(OUT_DIR, exist_ok=True)

badge = Image.open(BADGE).convert("RGB").resize((512, 512), Image.LANCZOS)
mark = Image.open(MARK).convert("RGB").resize((512, 512), Image.LANCZOS)

for size in (36, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512):
    badge.resize((size, size), Image.LANCZOS).save(
        os.path.join(OUT_DIR, f"icon-{size}x{size}.png"), optimize=True
    )

for size in (192, 512):
    mark.resize((size, size), Image.LANCZOS).save(
        os.path.join(OUT_DIR, f"icon-{size}x{size}-maskable.png"), optimize=True
    )

badge.resize((180, 180), Image.LANCZOS).save(
    os.path.join(OUT_DIR, "apple-touch-icon.png"), optimize=True
)
print("icons regenerated")
