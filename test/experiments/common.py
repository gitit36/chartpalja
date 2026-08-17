# -*- coding: utf-8 -*-
"""
실험 암 공통 유틸.

중요:
  - saju_engine 의 _composite_score / blend / SCORE_BIAS 를 절대 수정·패치하지 않는다.
  - 엔진은 대조군(control) 산출용으로만 호출하고, A/B 점수는 timeline meta 위에서
    순수 함수로 재합성한다.
"""
from __future__ import annotations

import io
import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from typing import Any, Callable, Dict, List, Optional, Tuple

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)

import calibrate_yongshin as cy  # noqa: E402
from experiments import phase_config as PC  # noqa: E402

YearScorer = Callable[[dict], float]  # meta(연도 타임라인 row) -> 0~100


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def load_core_subjects() -> List[dict]:
    with open(cy.SUBJ_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    out = []
    for s in raw:
        n = cy.normalize(s)
        if cy.is_core_eligible(n):
            out.append(n)
    return out


def cohort_bucket(name: str) -> str:
    """Phase0: soft_exclude | holdout | train."""
    if name in PC.SOFT_EXCLUDE_NAMES:
        return "soft_exclude"
    if name in PC.HOLDOUT_NAMES:
        return "holdout"
    return "train"


def filter_primary(subjects: List[dict]) -> List[dict]:
    """Primary KPI 분모: core − soft_exclude."""
    return [s for s in subjects if cohort_bucket(s["name"]) != "soft_exclude"]


def split_train_holdout(subjects: List[dict]) -> Tuple[List[dict], List[dict]]:
    primary = filter_primary(subjects)
    train = [s for s in primary if cohort_bucket(s["name"]) == "train"]
    holdout = [s for s in primary if cohort_bucket(s["name"]) == "holdout"]
    return train, holdout


def engine_year_maps(n: dict) -> Tuple[Dict[int, float], Dict[int, dict]]:
    """대조군용: 엔진 candle.close + meta. 엔진 상태를 변경하지 않음."""
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        _r, close_scores, meta = cy._year_scores(n)
    return close_scores, meta


def wavg(events: List[dict], scores: Dict[int, float]) -> Tuple[float, int]:
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


def pack_sep(good_avg: float, bad_avg: float, gu: int, bu: int) -> Dict[str, Any]:
    if gu < cy.MIN_EVENTS or bu < cy.MIN_EVENTS:
        return {
            "status": "na",
            "sep": float("nan"),
            "good_avg": good_avg,
            "bad_avg": bad_avg,
            "good_used": gu,
            "bad_used": bu,
            "severity": None,
        }
    sep = good_avg - bad_avg
    return {
        "status": "pass" if sep > 0 else "fail",
        "sep": sep,
        "good_avg": good_avg,
        "bad_avg": bad_avg,
        "good_used": gu,
        "bad_used": bu,
        "severity": cy.severity_of(sep),
    }


def prepare_events(n: dict, close_scores: Dict[int, float], exclude_collisions: bool):
    good = [dict(e) for e in n["good"]]
    bad = [dict(e) for e in n["bad"]]
    if exclude_collisions:
        coll = {c["year"] for c in cy.detect_collisions({"good": good, "bad": bad}, close_scores)}
        good = cy._mark_collision_exclude(good, coll)
        bad = cy._mark_collision_exclude(bad, coll)
    return good, bad


def scores_from_meta(
    meta_by_year: Dict[int, dict],
    scorer: YearScorer,
) -> Dict[int, float]:
    out: Dict[int, float] = {}
    for y, m in meta_by_year.items():
        try:
            out[y] = float(scorer(m))
        except Exception:
            continue
    return out


def eval_arm_on_person(
    n: dict,
    close_scores: Dict[int, float],
    meta_by_year: Dict[int, dict],
    scorer: Optional[YearScorer],
    *,
    exclude_collisions: bool = True,
) -> Dict[str, Any]:
    """scorer=None 이면 대조군(close). scorer 있으면 실험 점수."""
    good, bad = prepare_events(n, close_scores, exclude_collisions)
    if scorer is None:
        scores = close_scores
    else:
        scores = scores_from_meta(meta_by_year, scorer)
    ga, gu = wavg(good, scores)
    ba, bu = wavg(bad, scores)
    return pack_sep(ga, ba, gu, bu)


def tally(rows: List[Dict[str, Any]], key: str) -> Dict[str, Any]:
    evalable = [r for r in rows if r[key]["status"] in ("pass", "fail")]
    p = sum(1 for r in evalable if r[key]["status"] == "pass")
    f = len(evalable) - p
    seps = [r[key]["sep"] for r in evalable if r[key]["sep"] == r[key]["sep"]]
    avg = sum(seps) / len(seps) if seps else float("nan")
    hard = sum(1 for r in evalable if r[key].get("severity") == "hard_fail")
    near = sum(1 for r in evalable if r[key].get("severity") == "near_miss")
    return {
        "n": len(rows),
        "evalable": len(evalable),
        "pass": p,
        "fail": f,
        "rate": (100.0 * p / len(evalable)) if evalable else float("nan"),
        "avg_sep": avg,
        "hard_fail": hard,
        "near_miss": near,
    }


def fmt_rate(t: dict) -> str:
    if t["evalable"] == 0:
        return "—"
    return f"{t['pass']}/{t['evalable']} ({t['rate']:.0f}%)"


def fmt_sep(e: dict) -> str:
    v = e.get("sep")
    st = e.get("status")
    mark = "✓" if st == "pass" else ("·" if st == "na" else "✗")
    if v != v or v is None:
        return f"{mark}—"
    return f"{mark}{v:+.1f}"
