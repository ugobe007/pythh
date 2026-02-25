"""
Pythh / Pythia X Brand Asset Generator
Outputs:
  brand-assets/
    profile-calm-1024.png
    profile-calm-400.png
    profile-calm-200.png
    profile-active-1024.png
    profile-active-400.png
    profile-active-200.png
    post-square-1600.png
    post-landscape-1920.png
"""

from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance
import numpy as np
import os

OUT_DIR = "public/brand-assets"
os.makedirs(OUT_DIR, exist_ok=True)

ICON_PATH = "public/images/delphi-pythia-icon-in-glyph-style-vector.jpg"


def load_icon_with_alpha(path):
    """
    Load a black-on-white JPEG and convert to RGBA with white → transparent.
    Uses luminosity masking: bright pixels become transparent, dark = opaque ink.
    Slight threshold clean-up removes JPEG compression fringing.
    """
    img = Image.open(path).convert("L")           # greyscale
    arr = np.array(img, dtype=np.float32)

    # Invert: white (255) → 0 alpha, black (0) → 255 alpha
    alpha = np.clip(255 - arr, 0, 255)

    # Threshold: crush near-white fringe (JPEG artefacts)
    # Pixels below 18 luminosity on the alpha → fully transparent
    alpha = np.where(alpha < 18, 0, alpha)
    # Hard-cap mid-tones to keep strokes crisp (optional — comment out for softer)
    alpha = np.where(alpha > 200, 255, alpha)

    alpha_img = Image.fromarray(alpha.astype(np.uint8), "L")

    # RGB channels: keep the ink near-black (#0A0A0A) so glow pops
    ink = np.full_like(arr, 8, dtype=np.uint8)     # very dark fill
    ink_ch = Image.fromarray(ink, "L")

    rgba = Image.merge("RGBA", (ink_ch, ink_ch, ink_ch, alpha_img))
    return rgba

# ── Palette ─────────────────────────────────────────────────────────────────
CYAN_PRIMARY   = (0,   229, 255)   # #00E5FF
CYAN_SECONDARY = (43,  212, 255)   # #2BD4FF
BG_CENTER      = (15,  27,  46)    # #0F1B2E
BG_EDGE        = (5,   8,   15)    # #05080F
BG_SOLID       = (7,   10,  18)    # #070A12
TEXT_LIGHT     = (230, 236, 243)   # #E6ECF3
TEXT_ACCENT    = (0,   229, 255)   # #00E5FF


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_bg_gradient(size, center=BG_CENTER, edge=BG_EDGE, noise_pct=0.025):
    """Radial gradient from center to edge, with film-grain noise."""
    w, h = size
    cx, cy = w / 2, h / 2
    max_r = (cx**2 + cy**2) ** 0.5

    buf = np.zeros((h, w, 3), dtype=np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    r = ((xx - cx)**2 + (yy - cy)**2) ** 0.5
    t = np.clip(r / max_r, 0, 1)             # 0 = center, 1 = corner

    for ch in range(3):
        buf[:, :, ch] = center[ch] * (1 - t) + edge[ch] * t

    # Film grain
    noise = np.random.normal(0, 255 * noise_pct, (h, w, 3))
    buf = np.clip(buf + noise, 0, 255).astype(np.uint8)

    return Image.fromarray(buf, "RGB")


def make_cyan_glow(size, icon_alpha, glow_color=CYAN_PRIMARY,
                   outer_opacity=0.40, blur_radius=None, inner_opacity=0.28):
    """
    Build a glow layer behind the Pythia mark.
    icon_alpha: the alpha channel of the icon (L mode, 0=transparent 255=opaque)
    Returns RGBA image.
    """
    w, h = size
    if blur_radius is None:
        blur_radius = int(w * 0.027)     # ~28px at 1024

    glow = Image.new("RGBA", size, (0, 0, 0, 0))

    # 1. Mark-shape glow (outer)
    mark_glow = Image.new("RGBA", size, (0, 0, 0, 0))
    # Expand the mark slightly and colour it cyan
    tinted = Image.merge("RGBA", [
        Image.new("L", size, glow_color[0]),
        Image.new("L", size, glow_color[1]),
        Image.new("L", size, glow_color[2]),
        icon_alpha
    ])
    mark_glow.paste(tinted, mask=tinted)
    # Blur outward
    mark_glow = mark_glow.filter(ImageFilter.GaussianBlur(radius=blur_radius * 2))
    # Apply outer opacity
    r, g, b, a = mark_glow.split()
    a = a.point(lambda x: int(x * outer_opacity))
    mark_glow = Image.merge("RGBA", (r, g, b, a))
    glow = Image.alpha_composite(glow, mark_glow)

    # 2. Inner radial halo (centered behind head)
    # Head is roughly in the upper centre of the mark, ~0-60% of mark height
    halo = Image.new("RGBA", size, (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    # Halo centre slightly above canvas centre, radius ~35% of canvas
    halo_cx = w * 0.5
    halo_cy = h * 0.42
    halo_r  = w * 0.35
    # Draw concentric filled ellipse; we'll blur it heavily
    halo_draw.ellipse([
        halo_cx - halo_r, halo_cy - halo_r,
        halo_cx + halo_r, halo_cy + halo_r
    ], fill=(glow_color[0], glow_color[1], glow_color[2], int(255 * inner_opacity)))
    halo = halo.filter(ImageFilter.GaussianBlur(radius=int(w * 0.06)))
    glow = Image.alpha_composite(glow, halo)

    return glow


def ice_outline(icon_alpha, size, opacity=0.06):
    """Faint white/ice edge lift — barely-there crisp outline."""
    w, h = size
    # Dilate alpha then subtract original → ring
    expanded = icon_alpha.filter(ImageFilter.MaxFilter(size=5))
    ring = ImageChops.subtract(expanded, icon_alpha)
    ice = Image.merge("RGBA", [
        Image.new("L", size, 234),   # #EAFBFF-ish
        Image.new("L", size, 251),
        Image.new("L", size, 255),
        ring.point(lambda x: int(x * opacity))
    ])
    return ice


def composite_profile(size, icon_path, glow_outer_opacity, glow_inner_opacity=0.28,
                      blur_radius=None, noise_pct=0.025):
    w = size
    canvas_size = (w, w)

    bg = make_bg_gradient(canvas_size, noise_pct=noise_pct)
    bg = bg.convert("RGBA")

    # Load icon with white-background stripped
    icon_raw = load_icon_with_alpha(icon_path)

    # Scale icon to fill ~74% of canvas (keeps head within safe circle)
    safe_pct = 0.74
    icon_dim = int(w * safe_pct)
    icon = icon_raw.resize((icon_dim, icon_dim), Image.LANCZOS)

    # Centre on canvas with padding
    pad_x = (w - icon_dim) // 2
    pad_y = (w - icon_dim) // 2
    _, _, _, icon_a = icon.split()

    # Full-canvas alpha for glow calculations
    icon_a_full = Image.new("L", canvas_size, 0)
    icon_a_full.paste(icon_a, (pad_x, pad_y))

    # Build glow
    glow_layer = make_cyan_glow(
        canvas_size, icon_a_full,
        outer_opacity=glow_outer_opacity,
        inner_opacity=glow_inner_opacity,
        blur_radius=blur_radius
    )

    # Ice outline
    ice_layer = ice_outline(icon_a_full, canvas_size, opacity=0.07)

    # Composite: bg + glow + icon + ice
    result = bg.copy()
    result = Image.alpha_composite(result, glow_layer)

    # Paste icon (dark mark) — it should remain near-black
    # But the icon's "white" background should be transparent. The Pythia mark
    # is black lines on transparent bg. We invert alpha so the black lines show.
    mark_layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    mark_layer.paste(icon, (pad_x, pad_y), icon)
    result = Image.alpha_composite(result, mark_layer)
    result = Image.alpha_composite(result, ice_layer)

    return result.convert("RGB")


def add_post_headline(img, text_top, label_top, size_wh):
    """Add headline text for post assets."""
    w, h = size_wh
    draw = ImageDraw.Draw(img)

    font_path = "/System/Library/Fonts/Helvetica.ttc"
    try:
        from PIL import ImageFont
        font_headline = ImageFont.truetype(font_path, int(h * 0.042))
        font_label    = ImageFont.truetype(font_path, int(h * 0.026))
    except:
        from PIL import ImageFont
        font_headline = ImageFont.load_default()
        font_label    = font_headline

    from PIL import ImageFont

    # Label (small / all-caps feel)
    draw.text(
        (w // 2, label_top),
        "SIGNAL  INTELLIGENCE",
        fill=TEXT_ACCENT,
        font=font_label,
        anchor="mm"
    )

    # Headline
    draw.text(
        (w // 2, text_top),
        "pythh.ai",
        fill=TEXT_LIGHT,
        font=font_headline,
        anchor="mm"
    )


# ── Profile images ────────────────────────────────────────────────────────────

VARIANTS = {
    "calm": {
        "outer_opacity": 0.28,
        "inner_opacity": 0.20,
    },
    "active": {
        "outer_opacity": 0.45,
        "inner_opacity": 0.32,
    },
}

for variant, settings in VARIANTS.items():
    print(f"\n--- {variant.upper()} variant ---")
    for size in [1024, 400, 200]:
        blur = max(6, int(size * 0.027)) if size >= 400 else 4
        img = composite_profile(
            size,
            ICON_PATH,
            glow_outer_opacity=settings["outer_opacity"],
            glow_inner_opacity=settings["inner_opacity"],
            blur_radius=blur,
        )
        out = f"{OUT_DIR}/profile-{variant}-{size}.png"
        img.save(out, "PNG", optimize=True)
        kb = os.path.getsize(out) // 1024
        print(f"  ✓ {out}  ({kb} KB)")


# ── Post Square 1600×1600 ─────────────────────────────────────────────────────

def make_post_square():
    W = H = 1600
    bg = make_bg_gradient((W, H), noise_pct=0.022)
    bg = bg.convert("RGBA")

    icon_raw = load_icon_with_alpha(ICON_PATH)

    # Icon sits at ~56% of canvas, shifted slightly above centre
    icon_dim = int(W * 0.56)
    icon = icon_raw.resize((icon_dim, icon_dim), Image.LANCZOS)
    pad_x = (W - icon_dim) // 2
    pad_y = int(H * 0.07)   # push up a bit; text goes below

    _, _, _, icon_a = icon.split()
    icon_a_full = Image.new("L", (W, H), 0)
    icon_a_full.paste(icon_a, (pad_x, pad_y))

    glow_layer = make_cyan_glow((W, H), icon_a_full,
                                outer_opacity=0.38, inner_opacity=0.26,
                                blur_radius=42)
    ice_layer  = ice_outline(icon_a_full, (W, H), opacity=0.06)

    result = Image.alpha_composite(bg, glow_layer)
    mark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mark.paste(icon, (pad_x, pad_y), icon)
    result = Image.alpha_composite(result, mark)
    result = Image.alpha_composite(result, ice_layer)
    result = result.convert("RGB")

    # Text block below icon
    icon_bottom = pad_y + icon_dim
    text_y = icon_bottom + int(H * 0.04)
    label_y = text_y + int(H * 0.065)
    add_post_headline(result, text_y, label_y, (W, H))

    out = f"{OUT_DIR}/post-square-1600.png"
    result.save(out, "PNG", optimize=True)
    print(f"\n  ✓ {out}  ({os.path.getsize(out)//1024} KB)")


# ── Post Landscape 1920×1080 ──────────────────────────────────────────────────

def make_post_landscape():
    W, H = 1920, 1080
    bg = make_bg_gradient((W, H), noise_pct=0.022)
    bg = bg.convert("RGBA")

    icon_raw = load_icon_with_alpha(ICON_PATH)

    # Icon centred; ~70% of height
    icon_dim = int(H * 0.70)
    icon = icon_raw.resize((icon_dim, icon_dim), Image.LANCZOS)

    # Icon centre at ~38% from left — leaves right side for caption
    icon_cx = int(W * 0.38)
    pad_x = icon_cx - icon_dim // 2
    pad_y = (H - icon_dim) // 2

    _, _, _, icon_a = icon.split()
    icon_a_full = Image.new("L", (W, H), 0)
    icon_a_full.paste(icon_a, (pad_x, pad_y))

    glow_layer = make_cyan_glow((W, H), icon_a_full,
                                outer_opacity=0.40, inner_opacity=0.26,
                                blur_radius=38)
    ice_layer  = ice_outline(icon_a_full, (W, H), opacity=0.06)

    result = Image.alpha_composite(bg, glow_layer)
    mark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mark.paste(icon, (pad_x, pad_y), icon)
    result = Image.alpha_composite(result, mark)
    result = Image.alpha_composite(result, ice_layer)
    result = result.convert("RGB")

    # Right-column text
    from PIL import ImageFont, ImageDraw as ID2
    draw = ID2.Draw(result)
    try:
        font_brand  = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 96)
        font_tag    = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 42)
        font_small  = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 30)
    except:
        font_brand = font_tag = font_small = ImageFont.load_default()

    text_cx = int(W * 0.72)
    mid_y   = H // 2

    # Accent label
    draw.text((text_cx, mid_y - 120), "SIGNAL INTELLIGENCE", fill=TEXT_ACCENT,
              font=font_small, anchor="mm")
    # Brand name
    draw.text((text_cx, mid_y), "pythh.ai", fill=TEXT_LIGHT,
              font=font_brand, anchor="mm")
    # Sub
    draw.text((text_cx, mid_y + 80), "Infrastructure for Venture Capital",
              fill=(140, 165, 190), font=font_tag, anchor="mm")

    # Horizontal rule beneath brand
    rule_y = mid_y + 130
    rule_w = 320
    draw.line([(text_cx - rule_w//2, rule_y), (text_cx + rule_w//2, rule_y)],
              fill=(0, 180, 210, 120), width=2)

    out = f"{OUT_DIR}/post-landscape-1920.png"
    result.save(out, "PNG", optimize=True)
    print(f"  ✓ {out}  ({os.path.getsize(out)//1024} KB)")


make_post_square()
make_post_landscape()

print("\n\n=== All assets generated ===")
print(f"Output: {OUT_DIR}/")
for f in sorted(os.listdir(OUT_DIR)):
    kb = os.path.getsize(f"{OUT_DIR}/{f}") // 1024
    print(f"  {f:45s}  {kb:>5} KB")
