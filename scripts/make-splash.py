"""生成 iOS 启动图（2732x2732）：渐变底 + 居中鲸鱼图标。"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPLASH = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets", "Splash.imageset")
ICON = os.path.join(ROOT, "web", "icons", "icon-1024.png")
SIZE = 2732


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


img = Image.new("RGB", (SIZE, SIZE))
draw = ImageDraw.Draw(img)
for y in range(SIZE):
    t = y / (SIZE - 1)
    draw.line([(0, y), (SIZE, y)], fill=lerp((238, 245, 255), (247, 236, 252), t))

# 柔和光斑
blob = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bd = ImageDraw.Draw(blob)
bd.ellipse([-400, -500, 1600, 1100], fill=(150, 205, 255, 120))
bd.ellipse([1400, 1500, 3100, 3000], fill=(255, 205, 235, 110))
bd.ellipse([900, 1900, 2400, 3200], fill=(170, 245, 225, 100))
blob = blob.filter(ImageFilter.GaussianBlur(180))
img = Image.alpha_composite(img.convert("RGBA"), blob)

# 居中 App 图标
icon = Image.open(ICON).convert("RGBA").resize((620, 620), Image.LANCZOS)
x = (SIZE - 620) // 2
y = (SIZE - 620) // 2 - 80

shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle([x, y + 28, x + 620, y + 648], radius=150, fill=(20, 50, 120, 70))
shadow = shadow.filter(ImageFilter.GaussianBlur(60))
img = Image.alpha_composite(img, shadow)
img.alpha_composite(icon, (x, y))

os.makedirs(SPLASH, exist_ok=True)
for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    path = os.path.join(SPLASH, name)
    img.convert("RGB").save(path, optimize=True)
    print("written", path)
