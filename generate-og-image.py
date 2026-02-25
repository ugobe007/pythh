from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os

W, H = 1200, 630
bg_dark = (10, 15, 30)
bg_mid  = (15, 23, 42)
cyan    = (0, 229, 255)

img = Image.new("RGB", (W, H), bg_dark)
draw = ImageDraw.Draw(img)

# Horizontal gradient background
for x in range(W):
    t = x / W
    r = int(bg_dark[0] + (bg_mid[0] - bg_dark[0]) * t)
    g = int(bg_dark[1] + (bg_mid[1] - bg_dark[1]) * t)
    b = int(bg_dark[2] + (bg_mid[2] - bg_dark[2]) * t)
    draw.line([(x, 0), (x, H)], fill=(r, g, b))

# Load JPEG and strip white background via luminosity mask
src_path = "public/images/delphi-pythia-icon-in-glyph-style-vector.jpg"
raw = Image.open(src_path).convert("L")
arr = np.array(raw, dtype=np.float32)
alpha = np.clip(255 - arr, 0, 255)
alpha = np.where(alpha < 18, 0, alpha)
alpha = np.where(alpha > 200, 255, alpha)
alpha_img = Image.fromarray(alpha.astype(np.uint8))
ink = np.full_like(arr, 8, dtype=np.uint8)
ink_ch = Image.fromarray(ink)
icon_rgba = Image.merge("RGBA", (ink_ch, ink_ch, ink_ch, alpha_img))

icon_size = 310
icon_rgba = icon_rgba.resize((icon_size, icon_size), Image.LANCZOS)

# Tint cyan
_, _, _, a_ch = icon_rgba.split()
cyan_r = Image.new("L", (icon_size, icon_size), 0)
cyan_g = Image.new("L", (icon_size, icon_size), 200)
cyan_b = Image.new("L", (icon_size, icon_size), 220)
icon_tinted = Image.merge("RGBA", (cyan_r, cyan_g, cyan_b, a_ch))

# Cyan glow behind icon
icon_x = 70
icon_y = (H - icon_size) // 2
glow_full_a = Image.new("L", (W, H), 0)
glow_full_a.paste(a_ch, (icon_x, icon_y))
glow_mark = Image.merge("RGBA", [
    Image.new("L", (W, H), 0),
    Image.new("L", (W, H), 229),
    Image.new("L", (W, H), 255),
    glow_full_a
])
glow_mark = glow_mark.filter(ImageFilter.GaussianBlur(radius=22))
r2, g2, b2, a2 = glow_mark.split()
a2 = a2.point(lambda x: int(x * 0.45))
glow_mark = Image.merge("RGBA", (r2, g2, b2, a2))
img_rgba = img.convert("RGBA")
img_rgba = Image.alpha_composite(img_rgba, glow_mark)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

img.paste(icon_tinted, (icon_x, icon_y), icon_tinted)

# Divider
div_x = icon_x + icon_size + 60
draw.line([(div_x, 110), (div_x, H - 110)], fill=(0, 80, 100), width=1)

# Text
text_x = div_x + 50
font_large = font_medium = font_small = None
for fp in ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/SFNS.ttf"]:
    if os.path.exists(fp):
        try:
            font_large  = ImageFont.truetype(fp, 96)
            font_medium = ImageFont.truetype(fp, 38)
            font_small  = ImageFont.truetype(fp, 24)
            break
        except:
            pass
if not font_large:
    font_large = font_medium = font_small = ImageFont.load_default()

draw.text((text_x, 140), "SIGNAL INTELLIGENCE", fill=cyan, font=font_small)
draw.text((text_x, 175), "pythh.ai", fill=(230, 236, 243), font=font_large)
draw.text((text_x, 295), "Signal Science for Venture", fill=(140, 180, 210), font=font_medium)
draw.text((text_x, 350), "Match with the right investors using the GOD Algorithm\u2122",
          fill=(80, 110, 145), font=font_small)

# Cyan bottom bar
draw.rectangle([(0, H - 5), (W, H)], fill=cyan)

out_path = "public/og-image.png"
img.save(out_path, "PNG", optimize=True)
print(f"Saved: {out_path}  ({os.path.getsize(out_path)//1024} KB)")
