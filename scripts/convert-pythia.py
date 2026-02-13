"""Convert Pythia illustration: black-on-white → white outline on transparent background."""
from PIL import Image
import numpy as np

img = Image.open("/Users/leguplabs/Downloads/124e96c7-34e2-46c7-a38b-87b12f4bced5.jpg")
img = img.convert("RGBA")
data = np.array(img)

r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
luminance = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float64)

# Line mask: anything darker than 180 luminance is "line art"
line_mask = luminance < 180

new_data = np.zeros_like(data)
new_data[:,:,0] = 255  # white
new_data[:,:,1] = 255
new_data[:,:,2] = 255

# Alpha: darker original = more opaque white line
alpha = np.clip((255 - luminance) * 1.8, 0, 255).astype(np.uint8)
alpha[~line_mask] = 0
new_data[:,:,3] = alpha

result = Image.fromarray(new_data)
result.save("/Users/leguplabs/Desktop/hot-honey/public/pythia-outline.png")

# Square crop
w, h = result.size
s = min(w, h)
left = (w - s) // 2
top = (h - s) // 2
square = result.crop((left, top, left + s, top + s))
square.save("/Users/leguplabs/Desktop/hot-honey/public/pythia-outline-square.png")

print(f"Original: {img.size}")
print(f"Output: {result.size}")  
print(f"Square: {square.size}")
print("Done — white outline on transparent background")
