# -*- coding: utf-8 -*-
"""
용신 fallback 정책 진단 리포트 (③-④)
─────────────────────────────────────────────────────────────────
목적: "신강 명식인데 인성을 용신으로 주는" 케이스가 실제로 얼마나 발생하며,
      그 결정이 (a) 병약/조후/관인상생처럼 명확한 설명조건에 의한 것인지,
      (b) 단지 STRONG_TABLE/NEUTRAL_TABLE fallback 때문인지 분리해서 본다.

배경:
  determine_yongshin의 억부 fallback 테이블에서
    · STRONG_TABLE 편관격/정관격 → 용신 "인성"   ← 신강+관격에 인성(억부 역방향 의심)
    · NEUTRAL_TABLE 편인격/정인격 → 용신 "인성"   ← 중화(신강계열)+인격에 인성
  이 두 행이 명확한 설명조건 없이 인성을 주는지 정량 확인한다.

스캔 방식: 1945~2014년 그리드 명식을 가벼운 경로로 산출(대운/세운 제외).
  강약 = strength_score, 격국 = classify_geokguk, 용신 = determine_yongshin.

실행:
    .venv/bin/python3 test/report_yongshin_fallback.py
"""
from __future__ import annotations

import io
import os
import sys
from collections import Counter
from contextlib import redirect_stdout

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se  # noqa: E402

STRONG = se._STRONG_VERDICTS              # 극왕·태강·신강
NEUTRAL = se._NEUTRAL_VERDICTS            # 중화신강·중화신약
GWAN_GEOK = {"편관격", "정관격"}
IN_GEOK = {"편인격", "정인격"}
_NULL = io.StringIO()


def _chart(y, m, d, h, mi=0):
    with redirect_stdout(_NULL):
        s = se.calculate_saju(y, m, d, h, mi, use_solar_time=True,
                              utc_offset=9, early_zi_time=True)
    stems = [s["year_stem"], s["month_stem"], s["day_stem"], s["hour_stem"]]
    branches = [s["year_branch"], s["month_branch"], s["day_branch"], s["hour_branch"]]
    ds, mb = s["day_stem"], s["month_branch"]
    sc = se.strength_score(ds, mb, stems, branches)
    verdict = sc[1] if isinstance(sc[1], str) else sc[0]
    geok_info = se.classify_geokguk(ds, mb, stems, branches, verdict)
    yong = se.determine_yongshin(geok_info, verdict, ds, mb, stems, branches)
    return {
        "stems": stems, "branches": branches, "ds": ds, "mb": mb,
        "verdict": verdict, "geok": geok_info["격국"],
        "geok_type": geok_info.get("격국유형", "정격"),
        "yong_cat": _yong_cat(ds, yong), "yong_elem": yong.get("용신_오행", "?"),
        "conf": yong.get("판정확신도", ""), "bigo": yong.get("비고", ""),
        "johu_switch": yong.get("조후전환", False),
        "pillar": f"{s['year_pillar']} {s['month_pillar']} {s['day_pillar']} {s['hour_pillar']}",
    }


def _yong_cat(day_stem, yong):
    """용신_오행 → 일간 기준 십성 카테고리(비겁/식상/재성/관살/인성)."""
    tmap = se.day_tengo_ohaeng(day_stem)
    e = yong.get("용신_오행")
    for cat, elem in tmap.items():
        if elem == e:
            return cat
    return "기타"


def _path(c):
    """용신 결정 경로 분류."""
    conf, bigo = c["conf"], c["bigo"]
    if conf.startswith("높음(병인") or conf.startswith("매우높음(병인"):
        return "병약"
    if c["johu_switch"] or "조후" in conf:
        return "조후"
    if "주성 유지" in bigo:
        return "중화fallback"
    if bigo.startswith("억부법"):
        return "억부fallback"
    return "억부(기타)"


def _justified(c):
    """user 기준 '명확한 설명조건': 병약/조후. (관인상생은 엔진 미라벨 → 별도 진단)"""
    p = _path(c)
    return p in ("병약", "조후")


def _gwan_in_natal(c):
    """원국에 관살이 실재하는가(관인상생 성립 가능성의 최소 조건)."""
    tmap = se.day_tengo_ohaeng(c["ds"])
    gwan = tmap["관살"]
    n = sum(1 for s in c["stems"] if se.STEM_ELEMENT.get(s) == gwan)
    for b in c["branches"]:
        for h, role, _ in se.get_jijanggan(b):
            if role == "본기" and se.STEM_ELEMENT.get(h) == gwan:
                n += 1
    return n


def main():
    charts = []
    for y in range(1945, 2015):
        for m in range(1, 13):
            for d in (6, 19):
                for h in (3, 9, 15, 21):
                    try:
                        charts.append(_chart(y, m, d, h))
                    except Exception:
                        continue

    N = len(charts)
    print("══════════ 용신 fallback 진단 리포트 ══════════")
    print(f"표본: {N}개 명식 (1945~2014 그리드)\n")

    # ── 전체 분포 ───────────────────────────────
    vc = Counter(c["verdict"] for c in charts)
    print("[강약 분포]", "  ".join(f"{k} {v}({100*v/N:.0f}%)" for k, v in vc.most_common()))
    yc = Counter(c["yong_cat"] for c in charts)
    print("[용신 분포]", "  ".join(f"{k} {v}({100*v/N:.0f}%)" for k, v in yc.most_common()))
    print()

    # ── A. STRONG × 관격 → 인성? ────────────────
    A = [c for c in charts if c["verdict"] in STRONG and c["geok"] in GWAN_GEOK]
    A_in = [c for c in A if c["yong_cat"] == "인성"]
    print(f"[A] 신강계열(극왕·태강·신강) × 관격(편관·정관): {len(A)}개")
    if A:
        print(f"    └ 용신=인성: {len(A_in)}개 ({100*len(A_in)/len(A):.0f}%)  ← STRONG_TABLE 관격행")
        print("       경로:", "  ".join(f"{k} {v}" for k, v in Counter(_path(c) for c in A_in).most_common()))
        print(f"       이 중 병약/조후로 설명됨: {sum(_justified(c) for c in A_in)}개, "
              f"순수 fallback: {sum(not _justified(c) for c in A_in)}개")

    # ── B. STRONG × 인격 → 무엇? ────────────────
    B = [c for c in charts if c["verdict"] in STRONG and c["geok"] in IN_GEOK]
    print(f"\n[B] 신강계열 × 인격(편인·정인): {len(B)}개")
    if B:
        print("    용신 분포:", "  ".join(f"{k} {v}" for k, v in Counter(c["yong_cat"] for c in B).most_common()))
        b_in = [c for c in B if c["yong_cat"] == "인성"]
        print(f"    └ 용신=인성: {len(b_in)}개 (참고: STRONG_TABLE 인격행은 '재성'이 정상)")

    # ── C. 중화 × 인격 → 인성(NEUTRAL_TABLE) ────
    C = [c for c in charts if c["verdict"] in NEUTRAL and c["geok"] in IN_GEOK]
    C_in = [c for c in C if c["yong_cat"] == "인성"]
    print(f"\n[C] 중화(중화신강·중화신약) × 인격: {len(C)}개")
    if C:
        print(f"    └ 용신=인성: {len(C_in)}개 ({100*len(C_in)/len(C):.0f}%)  ← NEUTRAL_TABLE 인격행")
        print("       경로:", "  ".join(f"{k} {v}" for k, v in Counter(_path(c) for c in C_in).most_common()))
        print(f"       이 중 병약/조후로 설명됨: {sum(_justified(c) for c in C_in)}개, "
              f"순수 fallback: {sum(not _justified(c) for c in C_in)}개")

    # ── 핵심 지표: 신강계열 + 용신 인성 전체 ────
    SIN = STRONG | {"중화신강"}
    susp = [c for c in charts if c["verdict"] in SIN and c["yong_cat"] == "인성"
            and not c["geok_type"].startswith(("종격", "화격", "외격"))]
    unjust = [c for c in susp if not _justified(c)]
    print("\n──────────────────────────────────────────")
    print(f"[핵심] 신강계열(극왕·태강·신강·중화신강) & 용신=인성: {len(susp)}개")
    print(f"       └ 병약/조후로 설명됨: {len(susp)-len(unjust)}개")
    print(f"       └ 순수 fallback(설명조건 없음): {len(unjust)}개  ← #5 정책 대상")
    if susp:
        have_gwan = sum(_gwan_in_natal(c) >= 1 for c in unjust)
        print(f"          (이 중 원국에 관살 실재=관인상생 여지 있음: {have_gwan}개, "
              f"관살 부재=설명 곤란: {len(unjust)-have_gwan}개)")

    # ── 예시 출력 ───────────────────────────────
    print("\n[예시] 순수 fallback 신강+인성 (관살 부재 → 설명 곤란한 케이스 우선)")
    ex = sorted(unjust, key=lambda c: _gwan_in_natal(c))[:8]
    for c in ex:
        print(f"  · {c['pillar']:<20} {c['verdict']:<5} {c['geok']:<5} "
              f"용신=인성({c['yong_elem']}) 관살수={_gwan_in_natal(c)}  [{_path(c)}] {c['bigo'][:38]}")


if __name__ == "__main__":
    main()
