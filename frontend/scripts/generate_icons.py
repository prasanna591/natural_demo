"""Generate square Android launcher/splash assets from the Naturals wordmark.

Run from the frontend directory:  python scripts/generate_icons.py
"""

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
OUT = ASSETS / "android"
OUT.mkdir(exist_ok=True)

PURPLE = (89, 39, 111, 255)  # #59276F, the Naturals Women brand colour
CREAM = (250, 247, 243, 255)  # #FAF7F3
NOIR = (14, 14, 18, 255)  # #0E0E12, the Naturals Men background
GOLD = (230, 211, 169, 255)  # #E6D3A9


def load_trimmed(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def fit_width(image: Image.Image, width: int) -> Image.Image:
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.LANCZOS)


def compose(background, wordmark: Image.Image, width: int, size=1024) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background)
    logo = fit_width(wordmark, width)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    return canvas


def recolour(image: Image.Image, colour) -> Image.Image:
    solid = Image.new("RGBA", image.size, colour)
    solid.putalpha(image.getchannel("A"))
    return solid


def main() -> None:
    gold_light = load_trimmed(ASSETS / "wordmark-light.png")
    purple_mark = load_trimmed(ASSETS / "wordmark.png")

    # Legacy square launcher icon (also used by iOS).
    compose(PURPLE, gold_light, 760).save(OUT / "icon.png")

    # Adaptive icon layers. Android masks the outer third, so keep the mark
    # inside the 66% safe zone.
    compose((0, 0, 0, 0), gold_light, 600).save(OUT / "adaptive-icon-foreground.png")
    compose((0, 0, 0, 0), recolour(gold_light, (255, 255, 255, 255)), 600).save(
        OUT / "adaptive-icon-monochrome.png"
    )

    # Splash screen marks on both themes.
    compose((0, 0, 0, 0), purple_mark, 720).save(OUT / "splash-icon.png")
    compose((0, 0, 0, 0), gold_light, 720).save(OUT / "splash-icon-dark.png")

    # Social/marketing preview of the icon set.
    print("Generated:")
    for path in sorted(OUT.glob("*.png")):
        print(f"  {path.relative_to(ASSETS.parent)}  {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
