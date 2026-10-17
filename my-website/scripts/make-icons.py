"""Generate PWA app icons from my-website/logo.png."""
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parents[1]
SOURCE = BASE / 'logo.png'
OUT_DIR = BASE / 'icons'
OUT_DIR.mkdir(exist_ok=True)

logo = Image.open(SOURCE).convert('RGB')
for size in (36, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512):
    logo.resize((size, size), Image.Resampling.LANCZOS).save(
        OUT_DIR / f'icon-{size}x{size}.png', optimize=True
    )
for size in (192, 512):
    logo.resize((size, size), Image.Resampling.LANCZOS).save(
        OUT_DIR / f'icon-{size}x{size}-maskable.png', optimize=True
    )
logo.resize((180, 180), Image.Resampling.LANCZOS).save(
    OUT_DIR / 'apple-touch-icon.png', optimize=True
)
print('icons regenerated from logo.png')
