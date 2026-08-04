# -*- coding: utf-8 -*-
"""
Phase 0+1 정확도 프로토타입
────────────────────────────────────────────────────────────
Phase 0: KPI 3층 (raw / collision제외 / known-birth)
Phase 1: 연점수 3축(career/health/relationship) + matched 평가

운영 엔진(_composite_score / candle.close)은 변경하지 않는다.
타임라인 meta·breakdown을 읽어 축별 점수를 재합성한 뒤 core 분리도를 비교한다.

사용:
  ./.venv/bin/python test/proto_multiaxis.py
  ./.venv/bin/python test/proto_multiaxis.py --name "Lionel Messi"
"""
from __future__ import annotations

import io
import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import calibrate_yongshin as cy  # noqa: E402

AXES = ("career", "health", "relationship", "general")

_HEALTH_KW = (
    "부상", "골절", "질병", "수술", "암", "사망", "건강", "입원", "injury",
    "fracture", "hamstring", "병", "결장",
)
_REL_KW = (
    "결혼", "이혼", "연애", "출생", "아들", "딸", "배우자", "wedding",
    "marriage", "divorce", "born", "출산",
)
_CAREER_KW = (
    "우승", "수상", "이적", "데뷔", "당선", "낙선", "파산", "우승", "골든",
    "월드컵", "챔피언", "ballon", "트로피", "결승", "이적", "구단", "세금",
    "유죄", "은퇴", "골", "메달", "award", "cup", "league", "대통령", "훈장",
    "선거", "탄핵", "임기", "사임", "해임", "노벨", "oscar", "그래미",
)


def infer_axis(label: str, explicit: Optional[str] = None) -> str:
    if explicit in AXES and explicit != "general":
        return explicit
    s = (label or "").lower()
    # health before career: "결장" appears in injury labels
    if any(k.lower() in s for k in _HEALTH_KW):
        return "health"
    if any(k.lower() in s for k in _REL_KW):
        return "relationship"
    if any(k.lower() in s for k in _CAREER_KW):
        return "career"
    return explicit if explicit in AXES else "general"


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def axis_scores_from_meta(meta: Optional[dict]) -> Dict[str, float]:
    """breakdown + 십성/일주관계로 축별 점수 합성 (프로토타입).

    설계 의도:
      - 용신 부합 비중 ↓
      - 관계·구조 비중 ↑
      - career: 관/재 십성 소폭 가산 (용신이 기신이어도 커리어 신호 유지)
      - health: 충·형·해 충격, 관/재 인플레 억제
      - relationship: 합·배우자운
    """
    if not meta:
        return {a: float("nan") for a in ("career", "health", "relationship", "general")}

    bd = meta.get("breakdown") or {}
    yfit = float(bd.get("yongshin_fit") or 0.0)
    rel = float(bd.get("relations") or 0.0)
    struct = float(bd.get("structural_adj") or 0.0)
    uns = float(bd.get("unseong") or 0.0)
    bal = float(bd.get("balance") or 0.0)

    tg_s = meta.get("세운_십성_천간") or ""
    tg_b = meta.get("세운_십성_지지") or ""
    ilju = meta.get("세운_일주관계") or []
    if not isinstance(ilju, list):
        ilju = []

    career_tg = 0.0
    for tg in (tg_s, tg_b):
        if tg in ("정관", "편관", "정재", "편재", "식신"):
            career_tg += 2.2
        elif tg in ("상관", "겁재"):
            career_tg -= 1.0
        elif tg in ("편인", "정인"):
            career_tg += 0.5

    health_shock = 0.0
    rel_bond = 0.0
    conflict = False
    for s in ilju:
        t = str(s)
        if "충" in t or "형" in t:
            health_shock -= 4.0
            conflict = True
        elif "파" in t or "해" in t:
            health_shock -= 2.0
        if "극" in t or "갈등" in t:
            conflict = True
        if "합" in t or "배우자" in t or "인연" in t:
            rel_bond += 3.0

    # 용신 진폭 축소. 충·극 갈등 해에서 양의 yfit은 절반만 반영
    # (Messi 2020형: 용신운↑ + 갈등 공존 → 커리어 과대평가 억제)
    yfit_career = yfit * (0.10 if (conflict and yfit > 0) else 0.32)
    career_conflict_pen = -6.0 if conflict else 0.0

    career = _clamp(
        52 + yfit_career + rel * 0.55 + struct * 0.45 + uns * 0.15
        + career_tg + career_conflict_pen
    )
    health = _clamp(
        52 + yfit * 0.25 + struct * 0.55 + bal * 0.45 + health_shock
        - career_tg * 0.35 + uns * 0.1
    )
    relationship = _clamp(52 + yfit * 0.30 + rel * 0.55 + rel_bond + bal * 0.25 + uns * 0.1)
    general = _clamp(0.40 * career + 0.35 * health + 0.25 * relationship)

    return {
        "career": round(career, 1),
        "health": round(health, 1),
        "relationship": round(relationship, 1),
        "general": round(general, 1),
    }


def _wavg(events: List[dict], scores: Dict[int, float]) -> Tuple[float, int]:
    num = den = 0.0
    used = 0
    for e in events:
        if e.get("exclude"):
            continue
        y = e["year"]
        if y in scores and scores[y] == scores[y]:
            w = float(e.get("weight", 1.0))
            num += scores[y] * w
            den += w
            used += 1
    return (num / den if den else float("nan")), used


def _tag_events(n: dict, exclude_collisions: bool, scores_for_coll: Dict[int, float]):
    good = []
    bad = []
    for e in n["good"]:
        axis = infer_axis(e.get("label", ""), e.get("axis"))
        good.append({**e, "axis": axis})
    for e in n["bad"]:
        axis = infer_axis(e.get("label", ""), e.get("axis"))
        bad.append({**e, "axis": axis})
    if exclude_collisions:
        coll = {c["year"] for c in cy.detect_collisions(
            {"good": good, "bad": bad}, scores_for_coll)}
        good = cy._mark_collision_exclude(good, coll)
        bad = cy._mark_collision_exclude(bad, coll)
    return good, bad


def build_year_maps(n: dict):
    """(baseline_close, axis_maps, year_meta)."""
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        _r, close_scores, meta = cy._year_scores(n)
    axis_maps = {a: {} for a in ("career", "health", "relationship", "general")}
    for y, m in meta.items():
        ax = axis_scores_from_meta(m)
        for a, sc in ax.items():
            axis_maps[a][y] = sc
    return close_scores, axis_maps, meta


def eval_person(n: dict, exclude_collisions: bool = False) -> Dict[str, Any]:
    close_scores, axis_maps, meta = build_year_maps(n)
    good, bad = _tag_events(n, exclude_collisions, close_scores)

    def _pack(scores: Dict[int, float], g=None, b=None):
        g = good if g is None else g
        b = bad if b is None else b
        ga, gu = _wavg(g, scores)
        ba, bu = _wavg(b, scores)
        if gu < cy.MIN_EVENTS or bu < cy.MIN_EVENTS:
            return {"status": "na", "sep": float("nan"), "good_avg": ga, "bad_avg": ba,
                    "good_used": gu, "bad_used": bu}
        sep = ga - ba
        return {
            "status": "pass" if sep > 0 else "fail",
            "sep": sep,
            "good_avg": ga,
            "bad_avg": ba,
            "good_used": gu,
            "bad_used": bu,
            "severity": cy.severity_of(sep),
        }

    # matched: 이벤트별 axis 점수로 가중평균 (같은 해도 축이 다르면 다른 점수)
    def _wavg_matched(events):
        num = den = 0.0
        used = 0
        for e in events:
            if e.get("exclude"):
                continue
            ax = e.get("axis") or "general"
            sc = axis_maps.get(ax, {}).get(e["year"])
            if sc is None or sc != sc:
                sc = axis_maps["general"].get(e["year"])
            if sc is None or sc != sc:
                continue
            w = float(e.get("weight", 1.0))
            num += sc * w
            den += w
            used += 1
        if used < cy.MIN_EVENTS:
            return float("nan"), used
        return num / den, used

    g_m, gu_m = _wavg_matched(good)
    b_m, bu_m = _wavg_matched(bad)
    if gu_m < cy.MIN_EVENTS or bu_m < cy.MIN_EVENTS:
        matched = {"status": "na", "sep": float("nan"), "good_avg": g_m, "bad_avg": b_m,
                   "good_used": gu_m, "bad_used": bu_m, "severity": None}
    else:
        sep_m = g_m - b_m
        matched = {
            "status": "pass" if sep_m > 0 else "fail",
            "sep": sep_m,
            "good_avg": g_m,
            "bad_avg": b_m,
            "good_used": gu_m,
            "bad_used": bu_m,
            "severity": cy.severity_of(sep_m),
        }

    return {
        "name": n["name"],
        "time_quality": n["time_quality"],
        "tier": n.get("validation_tier"),
        "baseline": _pack(close_scores),
        "proto_general": _pack(axis_maps["general"]),
        "proto_career": _pack(axis_maps["career"]),
        "proto_health": _pack(axis_maps["health"]),
        "proto_relationship": _pack(axis_maps["relationship"]),
        "proto_matched": matched,
        "close_scores": close_scores,
        "axis_maps": axis_maps,
        "meta": meta,
        "good": good,
        "bad": bad,
    }


def _tally(rows: List[dict], key: str) -> Dict[str, Any]:
    evalable = [r for r in rows if r[key]["status"] in ("pass", "fail")]
    p = sum(1 for r in evalable if r[key]["status"] == "pass")
    f = len(evalable) - p
    seps = [r[key]["sep"] for r in evalable if r[key]["sep"] == r[key]["sep"]]
    avg = sum(seps) / len(seps) if seps else float("nan")
    hard = sum(1 for r in evalable if r[key].get("severity") == "hard_fail")
    near = sum(1 for r in evalable if r[key].get("severity") == "near_miss")
    return {
        "n": len(rows), "evalable": len(evalable), "pass": p, "fail": f,
        "rate": (100.0 * p / len(evalable)) if evalable else float("nan"),
        "avg_sep": avg, "hard_fail": hard, "near_miss": near,
    }


def _fmt_rate(t: dict) -> str:
    if t["evalable"] == 0:
        return "—"
    return f"{t['pass']}/{t['evalable']} ({t['rate']:.0f}%)"


def run_kpi(core_only: bool = True) -> None:
    with open(cy.SUBJ_PATH) as f:
        raw = json.load(f)

    subjects = []
    for s in raw:
        n = cy.normalize(s)
        if core_only and not cy.is_core_eligible(n):
            continue
        subjects.append(n)

    print("══════════ Phase 0+1 프로토타입 KPI ══════════")
    print(f"대상: {'core_strict' if core_only else '전체'} {len(subjects)}명")
    print()

    layers = [
        ("A raw baseline", False, None),
        ("B collision제외 baseline", True, None),
        ("C collision제외 + known-birth", True, "known"),
    ]

    # Precompute both collision modes
    cache = {}
    for n in subjects:
        for excl in (False, True):
            cache[(n["name"], excl)] = eval_person(n, exclude_collisions=excl)

    print("── Phase 0: 측정 층 ──")
    for label, excl, tq in layers:
        rows = [cache[(n["name"], excl)] for n in subjects]
        if tq:
            rows = [r for r in rows if r["time_quality"] == tq]
        t = _tally(rows, "baseline")
        avg = f"{t['avg_sep']:+.2f}" if t["avg_sep"] == t["avg_sep"] else "—"
        print(f"  [{label:<32}]  {_fmt_rate(t):<16}  avg_sep {avg}  "
              f"hard {t['hard_fail']} near {t['near_miss']}")

    print("\n── Phase 1: 점수 프로토타입 (collision제외 기준) ──")
    rows_b = [cache[(n["name"], True)] for n in subjects]
    for key, label in (
        ("baseline", "baseline close"),
        ("proto_general", "proto general blend"),
        ("proto_matched", "proto axis-matched"),
        ("proto_career", "proto career-only"),
    ):
        t = _tally(rows_b, key)
        avg = f"{t['avg_sep']:+.2f}" if t["avg_sep"] == t["avg_sep"] else "—"
        print(f"  [{label:<24}]  {_fmt_rate(t):<16}  avg_sep {avg}  "
              f"hard {t['hard_fail']} near {t['near_miss']}")

    print("\n── 인물별 sep (collision제외) ──")
    print(f"{'name':<18} {'base':>7} {'general':>8} {'matched':>8} {'career':>8}")
    for n in subjects:
        r = cache[(n["name"], True)]
        def _s(k):
            v = r[k]["sep"]
            st = "✓" if r[k]["status"] == "pass" else ("·" if r[k]["status"] == "na" else "✗")
            return f"{st}{v:+.1f}" if v == v else f"{st}—"
        print(f"{n['name']:<18} {_s('baseline'):>7} {_s('proto_general'):>8} "
              f"{_s('proto_matched'):>8} {_s('proto_career'):>8}")

    print("\n※ proto는 운영 candle.close를 대체하지 않는 실험 점수.")
    print("※ matched = 이벤트 axis(명시/추론)별 축 점수로 분리도 계산.")


def explain_name(name: str) -> int:
    with open(cy.SUBJ_PATH) as f:
        raw = json.load(f)
    n = cy._find_subject(raw, name)
    if n is None:
        print(f"'{name}' not found")
        return 1

    r = eval_person(n, exclude_collisions=True)
    print(f"══════════ proto explain: {n['name']} ══════════")
    for key in ("baseline", "proto_general", "proto_matched", "proto_career",
                "proto_health", "proto_relationship"):
        e = r[key]
        print(f"  {key:<18} sep={e['sep'] if e['sep']==e['sep'] else float('nan'):+.2f}  "
              f"{e['status']}  good={e['good_avg'] if e['good_avg']==e['good_avg'] else float('nan'):.1f} "
              f"bad={e['bad_avg'] if e['bad_avg']==e['bad_avg'] else float('nan'):.1f}")

    print("\n  [events] year axis  pol  base  career health rel   general  label")
    close = r["close_scores"]
    am = r["axis_maps"]
    for pol, evs in (("good", r["good"]), ("bad", r["bad"])):
        for e in evs:
            y = e["year"]
            ax = e["axis"]
            mark = "X" if e.get("exclude") else " "
            print(f"  {mark} {y}  {ax:<12} {pol:<4} "
                  f"{close.get(y, float('nan')):>5} "
                  f"{am['career'].get(y, float('nan')):>6} "
                  f"{am['health'].get(y, float('nan')):>6} "
                  f"{am['relationship'].get(y, float('nan')):>6} "
                  f"{am['general'].get(y, float('nan')):>7}  "
                  f"{str(e.get('label',''))[:40]}")
    return 0


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    name = cy._opt_value(argv, "--name") or cy._opt_value(argv, "--explain")
    if name:
        return explain_name(name)
    core_only = "--all" not in argv
    run_kpi(core_only=core_only)
    return 0


if __name__ == "__main__":
    sys.exit(main())
