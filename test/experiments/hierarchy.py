# -*- coding: utf-8 -*-
"""
계층 평가 (대운 climate).

중요:
  같은 대운 블록에 good/bad가 같이 있으면, 블록 평균 점수로 둘을 가르는 것은
  구조적으로 불가능하다 (10년 기조 = 동일 점수). 이런 블록은 mixed로 제외한다.

라벨: `month_day_labels.json` → Phase 6B2/6C2는 분리도(train/holdout) + Spearman 게이트.
(`arm_b_month.py`, `arm_b_day.py`, `sweep_phase_bc.py`).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Callable, Dict, List, Optional, Set

from experiments import common as C

YearScorer = Callable[[dict], float]


def mixed_polarity_pillars(
    good: List[dict],
    bad: List[dict],
    meta_by_year: Dict[int, dict],
) -> Set[str]:
    gw: Dict[str, float] = defaultdict(float)
    bw: Dict[str, float] = defaultdict(float)
    for e in good:
        if e.get("exclude"):
            continue
        m = meta_by_year.get(e["year"])
        if not m:
            continue
        gw[str(m.get("대운_pillar") or "_")] += float(e.get("weight", 1.0))
    for e in bad:
        if e.get("exclude"):
            continue
        m = meta_by_year.get(e["year"])
        if not m:
            continue
        bw[str(m.get("대운_pillar") or "_")] += float(e.get("weight", 1.0))
    return {p for p in set(gw) | set(bw) if gw[p] > 0 and bw[p] > 0}


def eval_daewoon_on_person(
    n: dict,
    close_scores: Dict[int, float],
    meta_by_year: Dict[int, dict],
    scorer: Optional[YearScorer],
    *,
    exclude_collisions: bool = True,
    exclude_mixed_blocks: bool = True,
) -> Dict[str, Any]:
    """
    대운 climate 분리도.
    scorer=None → candle.open (엔진 대운기조)
    scorer 있으면 해당 스코어 (권장: arm_b.daewoon_score_from_meta)
    mixed 블록 이벤트는 기본 제외.
    """
    good, bad = C.prepare_events(n, close_scores, exclude_collisions)
    mixed = mixed_polarity_pillars(good, bad, meta_by_year) if exclude_mixed_blocks else set()

    def _score(m: dict) -> float:
        if scorer is None:
            return float((m.get("candle") or {}).get("open") or 50.0)
        return float(scorer(m))

    mapped: Dict[int, float] = {}
    g2: List[dict] = []
    b2: List[dict] = []
    for e in good:
        if e.get("exclude"):
            continue
        m = meta_by_year.get(e["year"])
        if not m:
            continue
        p = str(m.get("대운_pillar") or "_")
        if p in mixed:
            continue
        mapped[e["year"]] = _score(m)
        g2.append(e)
    for e in bad:
        if e.get("exclude"):
            continue
        m = meta_by_year.get(e["year"])
        if not m:
            continue
        p = str(m.get("대운_pillar") or "_")
        if p in mixed:
            continue
        mapped[e["year"]] = _score(m)
        b2.append(e)

    ga, gu = C.wavg(g2, mapped)
    ba, bu = C.wavg(b2, mapped)
    pack = C.pack_sep(ga, ba, gu, bu)
    pack["n_mixed_blocks"] = len(mixed)
    pack["coverage"] = "climate_excl_mixed"
    return pack


def hierarchy_consistency(
    meta_by_year: Dict[int, dict],
    year_scores: Dict[int, float],
) -> Dict[str, float]:
    """세운 점수 vs candle.open 편차 — 계층 정합 진단."""
    diffs = []
    for y, m in meta_by_year.items():
        if y not in year_scores:
            continue
        open_v = (m.get("candle") or {}).get("open")
        if open_v is None:
            continue
        diffs.append(abs(float(year_scores[y]) - float(open_v)))
    if not diffs:
        return {"mean_abs_open_delta": float("nan"), "n": 0}
    return {
        "mean_abs_open_delta": sum(diffs) / len(diffs),
        "max_abs_open_delta": max(diffs),
        "n": len(diffs),
    }
