"""生成 App 图标：液态玻璃质感的圆角方块 + 小鲸鱼。

用法：python scripts/make-icons.py
输出：web/icons/icon-{180,192,512,1024}.png 与 icon.svg
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "icons")
os.makedirs(OUT, exist_ok=True)

SIZE = 1024
SCALE = 2  # 超采样后再缩小，边缘更细腻
W = SIZE * SCALE


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def gradient(size, top, bottom):
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        draw.line([(0, y), (size, y)], fill=lerp(top, bottom, t))
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def whale_layer(size):
    """优先用系统彩色 emoji，失败则用矢量鲸鱼兜底"""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = None
    for name in ("seguiemj.ttf", "Apple Color Emoji.ttc", "NotoColorEmoji.ttf"):
        for base in (
            r"C:\Windows\Fonts",
            "/System/Library/Fonts",
            "/usr/share/fonts/truetype/noto",
            "/usr/share/fonts",
        ):
            path = os.path.join(base, name)
            if os.path.exists(path):
                try:
                    font = ImageFont.truetype(path, int(size * 0.62))
                    break
                except Exception:
                    font = None
        if font:
            break

    if font is not None:
        try:
            text = "🐳"
            bbox = draw.textbbox((0, 0), text, font=font, embedded_color=True)
            x = (size - (bbox[2] - bbox[0])) / 2 - bbox[0]
            y = (size - (bbox[3] - bbox[1])) / 2 - bbox[1] - size * 0.02
            draw.text((x, y), text, font=font, embedded_color=True)
            if layer.getbbox():
                return layer
        except Exception:
            pass

    # 矢量兜底：一只圆圆的小鲸鱼
    cx, cy = size * 0.52, size * 0.53
    bw, bh = size * 0.42, size * 0.30
    body = [cx - bw, cy - bh, cx + bw * 0.55, cy + bh]
    draw.ellipse(body, fill=(255, 255, 255, 255))
    tail = [
        (cx + bw * 0.35, cy - bh * 0.1),
        (cx + bw * 0.95, cy - bh * 0.95),
        (cx + bw * 0.92, cy + bh * 0.1),
        (cx + bw * 0.95, cy + bh * 1.0),
    ]
    draw.polygon(tail, fill=(255, 255, 255, 255))
    draw.ellipse([cx - bw * 0.45, cy - bh * 0.1, cx - bw * 0.28, cy + bh * 0.14], fill=(90, 150, 220, 255))
    # 水花
    for i, (dx, dy, r) in enumerate([(-0.1, -0.55, 0.05), (0.05, -0.68, 0.035), (0.2, -0.55, 0.03)]):
        draw.ellipse(
            [
                cx + bw * dx - size * r,
                cy + bh * dy - size * r,
                cx + bw * dx + size * r,
                cy + bh * dy + size * r,
            ],
            fill=(255, 255, 255, 210 - i * 30),
        )
    return layer


def build():
    # 背景渐变（浅蓝 → 靛蓝）
    bg = gradient(W, (140, 210, 255), (54, 78, 235))
    # 左上角光斑
    gloss = Image.new("L", (W, W), 0)
    gd = ImageDraw.Draw(gloss)
    gd.ellipse(
        [-W * 0.35, -W * 0.55, W * 0.85, W * 0.55],
        fill=120,
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(W * 0.05))
    white = Image.new("RGB", (W, W), (255, 255, 255))
    bg = Image.composite(white, bg, gloss.point(lambda v: int(v * 0.55)))

    img = bg.convert("RGBA")

    # 底部内侧阴影，让玻璃有厚度
    depth = Image.new("L", (W, W), 0)
    dd = ImageDraw.Draw(depth)
    dd.ellipse([-W * 0.2, W * 0.55, W * 1.2, W * 1.35], fill=90)
    depth = depth.filter(ImageFilter.GaussianBlur(W * 0.08))
    dark = Image.new("RGB", (W, W), (20, 40, 120))
    img = Image.composite(dark, img.convert("RGB"), depth.point(lambda v: int(v * 0.45))).convert("RGBA")

    # 鲸鱼 + 柔光
    wl = whale_layer(W)
    glow = wl.filter(ImageFilter.GaussianBlur(W * 0.03))
    img.alpha_composite(glow)
    img.alpha_composite(wl)

    # 圆角裁切
    mask = rounded_mask(W, int(W * 0.235))
    img.putalpha(mask)

    # 细描边
    stroke = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stroke)
    sd.rounded_rectangle(
        [2, 2, W - 3, W - 3],
        radius=int(W * 0.235),
        outline=(255, 255, 255, 90),
        width=max(2, W // 200),
    )
    img.alpha_composite(stroke)

    base = img.resize((SIZE, SIZE), Image.LANCZOS)
    for size in (1024, 512, 192, 180):
        out = base.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT, f"icon-{size}.png")
        out.save(path, optimize=True)
        print("written", path)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#8cd2ff"/>
      <stop offset="100%" stop-color="#364eeb"/>
    </linearGradient>
    <radialGradient id="gloss" cx="0.28" cy="0.14" r="0.75">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <rect width="1024" height="1024" rx="240" fill="url(#bg)"/>
  <rect width="1024" height="1024" rx="240" fill="url(#gloss)"/>
  <g transform="translate(512 540) scale(1.02)" filter="url(#soft)" opacity="0.45">
    <ellipse cx="0" cy="0" rx="270" ry="190" fill="#eaf6ff"/>
  </g>
  <g transform="translate(512 540)">
    <ellipse cx="-40" cy="20" rx="250" ry="175" fill="#ffffff"/>
    <path d="M160 -60 C 260 -190 330 -170 300 -60 C 330 60 260 120 150 80 Z" fill="#ffffff"/>
    <ellipse cx="-150" cy="10" rx="26" ry="20" fill="#5a96dc"/>
    <circle cx="-80" cy="-95" r="22" fill="#ffffff" opacity="0.8"/>
    <circle cx="-15" cy="-135" r="15" fill="#ffffff" opacity="0.6"/>
    <circle cx="45" cy="-95" r="11" fill="#ffffff" opacity="0.45"/>
  </g>
</svg>
"""

with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as f:
    f.write(SVG)
print("written icon.svg")

if __name__ == "__main__":
    build()
