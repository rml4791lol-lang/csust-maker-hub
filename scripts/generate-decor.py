"""生成站点装饰用的「AI 感」抽象视觉（纯程序化生成，无外部素材/版权问题）。

输出到 public/decor/*.webp：
- orbit.webp   发光轨道环 + 粒子（首屏右侧/页头角标装饰）
- mesh.webp    线框波纹网格（首屏底部、页脚装饰）
- neural.webp  神经网络节点连线（页头/区块装饰）
- aurora.webp  极光色块（背景柔光）
"""
from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "decor")
os.makedirs(OUT, exist_ok=True)

INDIGO = (94, 106, 210)
BLUE = (143, 164, 255)
CYAN = (85, 205, 255)
VIOLET = (167, 139, 250)
PINK = (232, 121, 249)


def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGB", (w, h), (0, 0, 0))


def add_glow(base: Image.Image, layer: Image.Image, radius: int = 6, strength: float = 1.0) -> Image.Image:
    glow = layer.filter(ImageFilter.GaussianBlur(radius))
    return Image.blend(base, Image.blend(base, Image.blend(base, glow, strength), 0.6), 0.35)


def save(img: Image.Image, name: str, width: int) -> None:
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, "WEBP", quality=88, method=6)
    print(name, img.size, round(os.path.getsize(path) / 1024), "KB")


def orbit() -> Image.Image:
    w = h = 1800
    layer = blank(w, h)
    d = ImageDraw.Draw(layer)
    cx, cy = w / 2, h / 2
    rng = random.Random(7)
    rings = [
        (760, 560, -14, INDIGO, 3, 46),
        (640, 430, 22, BLUE, 2, 34),
        (520, 300, -38, CYAN, 2, 26),
        (420, 470, 8, VIOLET, 1, 22),
        (300, 240, 50, PINK, 1, 16),
    ]
    for rx, ry, angle, color, width, alpha in rings:
        layer2 = blank(w, h)
        d2 = ImageDraw.Draw(layer2)
        a = math.radians(angle)
        steps = 240
        pts = []
        for i in range(steps + 1):
            t = 2 * math.pi * i / steps
            x = rx * math.cos(t)
            y = ry * math.sin(t)
            xr = x * math.cos(a) - y * math.sin(a)
            yr = x * math.sin(a) + y * math.cos(a)
            pts.append((cx + xr, cy + yr))
        d2.line(pts, fill=color, width=width)
        layer = add_glow(layer, layer2, radius=10, strength=alpha / 60)
        d.line(pts, fill=tuple(min(255, c + 40) for c in color), width=width)
        # 轨道粒子
        for _ in range(5):
            t = rng.uniform(0, 2 * math.pi)
            x = rx * math.cos(t)
            y = ry * math.sin(t)
            xr = x * math.cos(a) - y * math.sin(a)
            yr = x * math.sin(a) + y * math.cos(a)
            px, py = cx + xr, cy + yr
            rr = rng.uniform(2.5, 5.5)
            d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=CYAN)
    # 中心核
    core = blank(w, h)
    dc = ImageDraw.Draw(core)
    for r, col, a in [(190, INDIGO, 26), (120, BLUE, 34), (56, CYAN, 60)]:
        dc.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    layer = add_glow(layer, core, radius=60, strength=0.9)
    return layer


def mesh() -> Image.Image:
    w, h = 2600, 1000
    layer = blank(w, h)
    d = ImageDraw.Draw(layer)
    rows = 26
    cols = 90
    for row in range(rows):
        pts = []
        for col in range(cols + 1):
            x = col / cols * (w + 300) - 150
            base = h * 0.18 + row * (h * 0.62 / rows)
            wave = (
                math.sin(col * 0.19 + row * 0.32) * 18
                + math.sin(col * 0.07 - row * 0.18) * 34
                + math.sin(col * 0.33 + row * 0.9) * 6
            )
            pts.append((x, base + wave))
        t = row / rows
        color = tuple(
            int(INDIGO[i] * (1 - t) + CYAN[i] * t) for i in range(3)
        )
        d.line(pts, fill=color, width=2)
    # 纵向连接线（少量）
    for col in range(0, cols + 1, 6):
        pts = []
        for row in range(rows):
            x = col / cols * (w + 300) - 150
            base = h * 0.18 + row * (h * 0.62 / rows)
            wave = (
                math.sin(col * 0.19 + row * 0.32) * 18
                + math.sin(col * 0.07 - row * 0.18) * 34
                + math.sin(col * 0.33 + row * 0.9) * 6
            )
            pts.append((x, base + wave))
        d.line(pts, fill=(70, 90, 170), width=1)
    glow = layer.filter(ImageFilter.GaussianBlur(9))
    layer = Image.blend(layer, glow, 0.55)
    # 上下渐隐遮罩
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    for y in range(h):
        v = int(255 * min(1, y / (h * 0.22), (h - y) / (h * 0.22)))
        md.line([(0, y), (w, y)], fill=v)
    out = Image.new("RGB", (w, h), (0, 0, 0))
    out.paste(layer, (0, 0), mask)
    return out


def neural() -> Image.Image:
    w, h = 1700, 1000
    layer = blank(w, h)
    d = ImageDraw.Draw(layer)
    rng = random.Random(42)
    nodes = []
    clusters = [(w * 0.22, h * 0.35), (w * 0.5, h * 0.62), (w * 0.78, h * 0.34)]
    for cx, cy in clusters:
        for _ in range(26):
            nx = cx + rng.gauss(0, 130)
            ny = cy + rng.gauss(0, 105)
            nodes.append((nx, ny))
    nodes += [(rng.uniform(0, w), rng.uniform(0, h)) for _ in range(30)]
    # 连线
    for i, (x1, y1) in enumerate(nodes):
        for x2, y2 in nodes[i + 1 :]:
            dist = math.hypot(x1 - x2, y1 - y2)
            if 40 < dist < 230 and rng.random() < (1 - dist / 260) * 0.6:
                alpha_color = (INDIGO if dist < 140 else (80, 95, 170))
                d.line([(x1, y1), (x2, y2)], fill=alpha_color, width=1)
    glow = layer.filter(ImageFilter.GaussianBlur(6))
    layer = Image.blend(layer, glow, 0.5)
    # 节点
    for x, y in nodes:
        r = rng.uniform(2.5, 6.5)
        col = rng.choice([BLUE, CYAN, VIOLET, PINK])
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
        rr = r * 3.2
        d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=col, width=1)
    glow2 = layer.filter(ImageFilter.GaussianBlur(4))
    layer = Image.blend(layer, glow2, 0.45)
    return layer


def aurora() -> Image.Image:
    w, h = 2200, 1300
    xx, yy = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))
    field = np.zeros((h, w, 3), dtype=np.float32)
    blobs = [
        (0.22, 0.32, 0.42, INDIGO, 1.0),
        (0.72, 0.24, 0.30, VIOLET, 0.75),
        (0.52, 0.78, 0.46, CYAN, 0.55),
        (0.86, 0.68, 0.24, PINK, 0.35),
        (0.10, 0.80, 0.30, BLUE, 0.45),
    ]
    for cx, cy, radius, color, strength in blobs:
        d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / (radius * radius)
        g = np.exp(-d2 * 2.2) * strength
        for i in range(3):
            field[:, :, i] += color[i] * g
    # 噪点云
    rng = np.random.default_rng(9)
    noise = rng.random((h // 6 + 1, w // 6 + 1)).astype(np.float32)
    noise = np.array(Image.fromarray((noise * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255.0
    field *= (0.55 + 0.45 * noise)[:, :, None]
    field = np.clip(field, 0, 255).astype(np.uint8)
    img = Image.fromarray(field)
    return img.filter(ImageFilter.GaussianBlur(22))


if __name__ == "__main__":
    save(orbit(), "orbit.webp", 1500)
    save(mesh(), "mesh.webp", 2200)
    save(neural(), "neural.webp", 1500)
    save(aurora(), "aurora.webp", 1800)
    print("total KB:", round(sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1024))
