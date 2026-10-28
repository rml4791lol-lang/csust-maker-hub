"""生成分享卡片（og:image，1200×630）：首页一张 + 每位成员一张。

用法：python scripts/generate-share-cards.py
输出：public/share/home.jpg、public/share/member-mXX.jpg
素材：public/photos/ 现场照片、public/decor/orbit.webp 装饰、content/profiles.json 成员档案
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "share")
os.makedirs(OUT, exist_ok=True)

W, H = 1200, 630
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"

INDIGO = (94, 106, 210)
LIGHT = (143, 164, 255)
WHITE = (244, 246, 250)
GREY = (163, 170, 182)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cover(path: str, size: tuple[int, int], blur: float = 0) -> Image.Image:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    scale = max(size[0] / w, size[1] / h)
    img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    left = (img.width - size[0]) // 2
    top = (img.height - size[1]) // 2
    img = img.crop((left, top, left + size[0], top + size[1]))
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return img


def darken(img: Image.Image, strength: float = 0.72) -> Image.Image:
    overlay = Image.new("RGB", (W, H), (5, 6, 8))
    return Image.blend(img, overlay, strength)


def add_orbit(img: Image.Image, opacity: float = 0.35, size: int = 760) -> Image.Image:
    """把发光轨道装饰以叠加方式放到卡片右侧。"""
    from PIL import ImageChops

    path = os.path.join(ROOT, "public", "decor", "orbit.webp")
    if not os.path.exists(path):
        return img
    orbit = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), (0, 0, 0))
    canvas.paste(orbit, (W - size + 140, H // 2 - size // 2))
    canvas = canvas.point(lambda v: int(v * opacity))
    return ImageChops.add(img, canvas)


def pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, f: ImageFont.FreeTypeFont) -> int:
    x, y = xy
    pad_x, pad_y = 14, 8
    box = draw.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.rounded_rectangle([x, y, x + w + pad_x * 2, y + h + pad_y * 2 + 4], radius=10, fill=(255, 255, 255, 18), outline=(143, 164, 255, 90), width=1)
    draw.text((x + pad_x, y + pad_y - 2), text, font=f, fill=WHITE)
    return x + w + pad_x * 2 + 10


def home_card() -> Image.Image:
    bg = cover(os.path.join(ROOT, "public/photos/innovation-port-aerial.jpg"), (W, H))
    img = darken(bg, 0.64)
    img = add_orbit(img, opacity=0.4)
    draw = ImageDraw.Draw(img, "RGBA")

    # 顶部协会标识
    draw.rounded_rectangle([64, 58, 126, 120], radius=14, fill=INDIGO)
    draw.text((81, 70), "AI", font=font(FONT_BOLD, 30), fill=WHITE)
    draw.text((142, 66), "长沙理工大学 AI 创客协会", font=font(FONT_BOLD, 28), fill=WHITE)
    draw.text((142, 102), "CSUST AI MAKER  ·  云塘校区 · 科创港", font=font(FONT_REG, 17), fill=GREY)

    # 主标题
    draw.text((64, 208), "把 AI 用起来，", font=font(FONT_BOLD, 62), fill=WHITE)
    draw.text((64, 288), "把想法做出来。", font=font(FONT_BOLD, 62), fill=LIGHT)

    draw.text((64, 400), "协会活动与成果  ·  成员能力档案", font=font(FONT_REG, 28), fill=GREY)
    draw.text((64, 520), "长沙理工大学云塘校区 · 科创港", font=font(FONT_REG, 22), fill=GREY)
    return img


def member_card(profile: dict, bg_path: str) -> Image.Image:
    bg = cover(bg_path, (W, H), blur=5)
    img = darken(bg, 0.66)
    img = add_orbit(img, opacity=0.32)
    draw = ImageDraw.Draw(img, "RGBA")

    draw.text((64, 54), "MEMBERS / 成员能力档案", font=font(FONT_REG, 18), fill=LIGHT)
    # 头像
    avatar = Image.new("RGB", (132, 132), (0, 0, 0))
    ad = ImageDraw.Draw(avatar)
    for y in range(132):
        t = y / 131
        ad.line([(0, y), (132, y)], fill=(int(INDIGO[0] + (85 - INDIGO[0]) * t), int(INDIGO[1] + (205 - INDIGO[1]) * t), int(INDIGO[2] + (255 - INDIGO[2]) * t)))
    mask = Image.new("L", (132, 132), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 131, 131], fill=255)
    img.paste(avatar, (64, 132), mask)
    initial = (profile.get("name") or "?")[:1]
    draw.text((96, 158), initial, font=font(FONT_BOLD, 56), fill=WHITE)

    name = profile.get("name", "")
    role = profile.get("role", "")
    dept = profile.get("dept", "")
    draw.text((64, 300), name, font=font(FONT_BOLD, 64), fill=WHITE)
    line = f"{dept}" + (f" · {role}" if role else "")
    draw.text((66, 384), line, font=font(FONT_REG, 26), fill=GREY)

    tags = (profile.get("focusTags") or [])[:3]
    x = 64
    for tag in tags:
        x = pill(draw, (x, 440), tag, font(FONT_REG, 20))

    stats = profile.get("stats", {})
    draw.text((64, 530), f"{stats.get('contributions', 0)} 条成果记录  ·  {stats.get('projects', 0)} 个项目  ·  {stats.get('competitions', 0)} 个竞赛", font=font(FONT_REG, 20), fill=GREY)
    draw.text((W - 300, H - 52), "长理 AI 创客", font=font(FONT_BOLD, 22), fill=(200, 208, 225))
    return img


if __name__ == "__main__":
    home_card().save(os.path.join(OUT, "home.jpg"), "JPEG", quality=84, optimize=True, progressive=True)
    print("home.jpg")
    profiles = json.load(open(os.path.join(ROOT, "content", "profiles.json"), encoding="utf-8"))
    bgs = ["innovation-port-aerial.jpg", "innovation-port-2.jpg", "innovation-port-3.jpg"]
    for i, p in enumerate(profiles):
        path = os.path.join(ROOT, "public/photos", bgs[i % len(bgs)])
        out = os.path.join(OUT, f"member-{p['memberId']}.jpg")
        member_card(p, path).save(out, "JPEG", quality=82, optimize=True, progressive=True)
        print(os.path.basename(out), round(os.path.getsize(out) / 1024), "KB")
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print("total KB:", round(total / 1024))
