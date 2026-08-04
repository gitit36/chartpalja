from __future__ import annotations

import base64
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SCREENSHOTS = Path(
    "/var/folders/25/rf0h45hx1f57zz9m83t2gd8r0000gq/T/cursor/screenshots"
)

W, H = 1080, 1350
BG = "#111116"
SURFACE = "#1D1D24"
SURFACE_2 = "#2A2A34"
TEXT = "#F7F7FA"
MUTED = "#A3A3B2"
RED = "#F04452"
BLUE = "#4B82EF"
YELLOW = "#FFE64A"
GREEN = "#58C8AD"


def data_uri(path: Path) -> str:
    mime = "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def text(x: int, y: int, value: str, size: int, weight: int = 600,
         fill: str = TEXT, anchor: str = "start", opacity: float = 1) -> str:
    return (
        f'<text x="{x}" y="{y}" font-family="Pretendard, Apple SD Gothic Neo, sans-serif" '
        f'font-size="{size}" font-weight="{weight}" fill="{fill}" '
        f'text-anchor="{anchor}" opacity="{opacity}">{esc(value)}</text>'
    )


def multiline(x: int, y: int, lines: list[str], size: int, line_h: int,
              weight: int = 700, fill: str = TEXT) -> str:
    parts = [
        f'<text x="{x}" y="{y}" font-family="Pretendard, Apple SD Gothic Neo, sans-serif" '
        f'font-size="{size}" font-weight="{weight}" fill="{fill}">'
    ]
    for i, line in enumerate(lines):
        parts.append(f'<tspan x="{x}" dy="{0 if i == 0 else line_h}">{esc(line)}</tspan>')
    parts.append("</text>")
    return "".join(parts)


def base(page: int, eyebrow: str, title_lines: list[str], subtitle: str,
         next_tease: str, body: str, accent: str = RED) -> str:
    progress = "".join(
        f'<rect x="{70 + i * 34}" y="70" width="24" height="6" rx="3" '
        f'fill="{accent if i < page else "#393944"}"/>'
        for i in range(1, 8)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12121A"/>
      <stop offset="0.55" stop-color="#171624"/>
      <stop offset="1" stop-color="#241331"/>
    </linearGradient>
    <linearGradient id="redGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F04452" stop-opacity=".2"/>
      <stop offset="1" stop-color="#4B82EF" stop-opacity=".08"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#000" flood-opacity=".38"/>
    </filter>
    <clipPath id="screen"><rect x="82" y="435" width="916" height="680" rx="34"/></clipPath>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#bg)"/>
  <circle cx="970" cy="90" r="230" fill="{accent}" opacity=".07"/>
  <circle cx="80" cy="1210" r="290" fill="#4B82EF" opacity=".05"/>
  {progress}
  {text(1010, 79, f"{page}/7", 22, 700, MUTED, "end")}
  {text(70, 142, eyebrow, 24, 700, accent)}
  {multiline(70, 215, title_lines, 58, 72, 800)}
  {text(70, 390, subtitle, 27, 500, MUTED)}
  {body}
  <rect x="70" y="1188" width="940" height="92" rx="28" fill="#20202A" stroke="#343442"/>
  {text(105, 1245, "다음", 22, 800, accent)}
  {text(188, 1245, next_tease, 24, 600, TEXT)}
  {text(955, 1246, "→", 34, 600, accent, "end")}
  {text(70, 1320, "차트팔자  ·  사주팔자, 차트로 읽다", 19, 600, MUTED)}
</svg>"""


def image_panel(uri: str, view_box: str, y: int = 435, h: int = 680,
                overlay: str = "") -> str:
    return f"""
  <rect x="82" y="{y}" width="916" height="{h}" rx="34" fill="{SURFACE}" stroke="#383845" filter="url(#shadow)"/>
  <svg x="82" y="{y}" width="916" height="{h}" viewBox="{view_box}" preserveAspectRatio="xMidYMid slice" overflow="hidden">
    <image href="{uri}" x="0" y="0" width="1024" height="768"/>
  </svg>
  {overlay}
"""


def card_1() -> str:
    bars = "".join(
        f'<rect x="{570 + i * 27}" y="{950 - h}" width="18" height="{h}" rx="7" '
        f'fill="{RED if i % 3 else BLUE}" opacity="{0.65 + (i % 4) * 0.08}"/>'
        for i, h in enumerate([120, 185, 145, 240, 180, 300, 218, 350, 275, 390, 310, 430, 370, 470])
    )
    body = f"""
  <rect x="70" y="455" width="940" height="635" rx="44" fill="url(#redGlow)" stroke="#3A3546"/>
  {text(120, 575, "출시 하루 만에", 34, 650, MUTED)}
  {text(120, 735, "133", 138, 850, TEXT)}
  {text(120, 785, "명의 이용자", 30, 700, TEXT)}
  {text(120, 925, "270", 138, 850, YELLOW)}
  {text(120, 975, "개의 사주 차트", 30, 700, TEXT)}
  {bars}
  {text(540, 1038, "한 사람이 평균 2개 이상의 차트를 열어봤어요", 25, 600, TEXT, "middle")}
"""
    return base(
        1,
        "LAUNCH DAY 01",
        ["하루 만에,", "이만큼 열어봤습니다"],
        "무료 이용자를 포함한 실제 사주 입력 기준",
        "왜 한 사람당 2개 넘게 만들었을까?",
        body,
        YELLOW,
    )


def card_2(main_uri: str) -> str:
    overlay = f"""
  <rect x="111" y="454" width="858" height="64" rx="18" fill="#1C1C24" opacity=".96"/>
  {text(540, 496, "샘플 인생 차트 · 개인정보 비공개", 21, 650, MUTED, "middle")}
  <rect x="105" y="1023" width="870" height="64" rx="20" fill="#17171E" opacity=".9"/>
  {text(540, 1065, "0세부터 100세까지, 한 화면에서", 25, 700, TEXT, "middle")}
"""
    return base(
        2,
        "100-YEAR LIFE CHART",
        ["말로 듣던 사주를", "100년 차트로"],
        "대운의 기조와 매년의 파동을 한눈에",
        "선 하나로 끝이 아닙니다",
        image_panel(main_uri, "210 135 605 585", overlay=overlay),
    )


def card_3(aux_uri: str) -> str:
    chips = [
        ("필요한 기운", "#A760C2"),
        ("변화의 파도", GREEN),
        ("귀인의 도움", "#D8871C"),
        ("오행 균형도", "#3CA7E8"),
    ]
    chip_svg = "".join(
        f'<rect x="{110 + (i % 2) * 435}" y="{1000 + (i // 2) * 58}" width="395" height="44" rx="18" '
        f'fill="{color}" opacity=".14"/>{text(307 + (i % 2) * 435, 1030 + (i // 2) * 58, label, 20, 700, color, "middle")}'
        for i, (label, color) in enumerate(chips)
    )
    body = f"""
  <rect x="82" y="435" width="916" height="680" rx="34" fill="{SURFACE}" stroke="#383845" filter="url(#shadow)"/>
  <svg x="105" y="460" width="870" height="510" viewBox="0 0 890 858" preserveAspectRatio="xMidYMid slice">
    <image href="{aux_uri}" x="0" y="0" width="890" height="858"/>
  </svg>
  <rect x="105" y="932" width="870" height="160" rx="24" fill="#17171F" opacity=".98"/>
  {chip_svg}
"""
    return base(
        3,
        "AUXILIARY INDICATORS",
        ["주식은 거래량,", "사주는 변화의 이유"],
        "차트 아래 보조지표로 파동의 배경까지",
        "그럼 내 사주 안에서는 무엇을 볼까?",
        body,
        GREEN,
    )


def card_4(rel_uri: str) -> str:
    overlay = f"""
  <rect x="105" y="1010" width="870" height="72" rx="22" fill="#17171E" opacity=".93"/>
  {text(540, 1055, "항목을 누르면 관계와 복·걸림돌이 펼쳐져요", 23, 700, TEXT, "middle")}
"""
    return base(
        4,
        "DEEP SAJU DETAILS",
        ["내 안의 관계도", "직접 눌러봅니다"],
        "타고난 기운의 관계 · 타고난 복과 걸림돌",
        "혼자 보는 차트, 둘이 겹치면?",
        image_panel(rel_uri, "220 145 600 545", overlay=overlay),
        BLUE,
    )


def card_5(compat_uri: str) -> str:
    overlay = f"""
  <rect x="110" y="454" width="860" height="74" rx="20" fill="#1D1D25" opacity=".98"/>
  {text(220, 500, "나", 23, 800, RED)}
  <line x1="255" y1="492" x2="330" y2="492" stroke="{RED}" stroke-width="6"/>
  {text(390, 500, "상대", 23, 800, BLUE)}
  <line x1="455" y1="492" x2="530" y2="492" stroke="{BLUE}" stroke-width="6"/>
  {text(940, 500, "좋음 · 보통 · 주의", 21, 650, MUTED, "end")}
  <rect x="105" y="1020" width="870" height="62" rx="20" fill="#17171E" opacity=".94"/>
  {text(540, 1062, "점수 하나가 아니라, 해마다 달라지는 궁합 흐름", 23, 700, TEXT, "middle")}
"""
    return base(
        5,
        "COMPATIBILITY FLOW",
        ["궁합은 점수보다", "흐름이 중요하니까"],
        "두 사람의 100년 라인을 같은 차트 위에",
        "좋은 결과는 혼자만 보기 아깝죠",
        image_panel(compat_uri, "210 140 610 575", overlay=overlay),
        RED,
    )


def card_6(share_uri: str) -> str:
    overlay = f"""
  <rect x="112" y="466" width="856" height="215" rx="25" fill="#1D1D25" opacity=".96"/>
  {text(145, 522, "차트팔자", 22, 800, TEXT)}
  {text(145, 575, "내 인생 차트", 32, 800, TEXT)}
  {text(145, 625, "카카오톡에서 바로 보이는 미리보기", 22, 550, MUTED)}
  <path d="M720 610 C760 555 810 645 850 560 S930 610 950 535" fill="none" stroke="{BLUE}" stroke-width="7"/>
"""
    return base(
        6,
        "SHARE IN ONE TAP",
        ["만든 차트는", "바로 공유됩니다"],
        "카카오톡 공유 · 링크 복사 · 이미지 저장",
        "그리고 다음 차트의 주인공은",
        image_panel(share_uri, "210 105 610 590", overlay=overlay),
        YELLOW,
    )


def card_7(logo_uri: str) -> str:
    body = f"""
  <rect x="70" y="450" width="940" height="645" rx="48" fill="url(#redGlow)" stroke="#3A3546"/>
  <image href="{logo_uri}" x="420" y="505" width="240" height="300" preserveAspectRatio="xMidYMid meet"/>
  {text(540, 842, "133명이 먼저 열어본", 28, 650, MUTED, "middle")}
  {text(540, 912, "270개의 인생 차트", 48, 850, TEXT, "middle")}
  <rect x="205" y="972" width="670" height="82" rx="28" fill="{YELLOW}"/>
  {text(540, 1025, "차트만 먼저 보기  →", 28, 850, "#211C11", "middle")}
"""
    return base(
        7,
        "YOUR TURN",
        ["다음 차트는", "당신의 것입니다"],
        "생년월일과 생시만 입력하면 시작",
        "chartpalja.com",
        body,
        YELLOW,
    ).replace("다음</text>", "바로가기</text>")


def main() -> None:
    required = {
        "main": SCREENSHOTS / "chartpalja-life-chart-actual.png",
        "aux": SCREENSHOTS / "chartpalja-aux-indicators.png",
        "relations": SCREENSHOTS / "chartpalja-relations-blessings.png",
        "compat": SCREENSHOTS / "chartpalja-compatibility-actual.png",
        "share": SCREENSHOTS / "chartpalja-share-sheet.png",
        "logo": ROOT / "public" / "svc_logo_with_slogan_vertical.png",
    }
    missing = [str(path) for path in required.values() if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing assets:\n" + "\n".join(missing))

    uris = {name: data_uri(path) for name, path in required.items()}
    cards = [
        card_1(),
        card_2(uris["main"]),
        card_3(uris["aux"]),
        card_4(uris["relations"]),
        card_5(uris["compat"]),
        card_6(uris["share"]),
        card_7(uris["logo"]),
    ]
    for i, svg in enumerate(cards, 1):
        path = OUT / f"{i:02d}_chartpalja_card.svg"
        path.write_text(svg, encoding="utf-8")
        print(path)


if __name__ == "__main__":
    main()
