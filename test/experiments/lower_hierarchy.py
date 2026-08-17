# -*- coding: utf-8 -*-
"""
월·일 계층 재합성 (실험 격리).

엔진 monthly/daily 타임라인은 읽기만 하고,
부모(세운/월운)만 Exp-B 점수로 바꾼 뒤 독립점수는 Control에서 역산·증폭한다.

라벨(`month_day_labels.json`) + 스모크:
  - 월/일 사건 분리도 (train/holdout)
  - 월내/일내 순위 보존 (Spearman vs Control)
  - 부모 비중 하한 (계층)
  - 진폭 σ
"""
from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def blend_weights(
    parent: float,
    parent_w: float,
    child_w: float,
    *,
    neutral_lo: float = 45.0,
    neutral_hi: float = 55.0,
    neutral_child_w: Optional[float] = None,
) -> Tuple[float, float]:
    """엔진과 동일: 부모 중립이면 자식 비중 상향."""
    if neutral_child_w is not None and neutral_lo <= parent <= neutral_hi:
        cw = float(neutral_child_w)
        return 1.0 - cw, cw
    return float(parent_w), float(child_w)


def recover_indep(
    final_score: float,
    parent: float,
    parent_w: float,
    child_w: float,
) -> float:
    """final ≈ parent*pw + indep*cw  (+ synergy ignored → residual into indep)."""
    if child_w <= 1e-9:
        return float(final_score)
    return (float(final_score) - float(parent) * float(parent_w)) / float(child_w)


def amplify_around(value: float, amp: float, center: float = 50.0) -> float:
    return clamp(center + float(amp) * (float(value) - center))


def remap_child(
    *,
    control_final: float,
    control_parent: float,
    new_parent: float,
    parent_w: float,
    child_w: float,
    child_amp: float = 1.0,
    neutral_child_w: Optional[float] = 0.42,
    synergy: float = 0.0,
) -> Dict[str, float]:
    """Control 한 점에서 독립 역산 → 새 부모로 재혼합."""
    pw_c, cw_c = blend_weights(
        control_parent, parent_w, child_w, neutral_child_w=neutral_child_w
    )
    indep = recover_indep(control_final, control_parent, pw_c, cw_c)
    indep_a = amplify_around(indep, child_amp)
    pw_n, cw_n = blend_weights(
        new_parent, parent_w, child_w, neutral_child_w=neutral_child_w
    )
    score = clamp(new_parent * pw_n + indep_a * cw_n + synergy)
    return {
        "score": round(score, 1),
        "indep": round(indep, 2),
        "indep_amp": round(indep_a, 2),
        "parent_w": pw_n,
        "child_w": cw_n,
    }


def spearman(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) < 3 or len(a) != len(b):
        return float("nan")
    aa = np.asarray(a, dtype=float)
    bb = np.asarray(b, dtype=float)
    ra = aa.argsort().argsort().astype(float)
    rb = bb.argsort().argsort().astype(float)
    if ra.std() < 1e-12 or rb.std() < 1e-12:
        return 1.0
    return float(np.corrcoef(ra, rb)[0, 1])


def pooled_sigma(series_list: Iterable[Sequence[float]]) -> float:
    vals: List[float] = []
    for s in series_list:
        vals.extend(float(x) for x in s)
    if len(vals) < 2:
        return 0.0
    return float(np.std(np.asarray(vals, dtype=float)))


def mean_abs_parent_gap(child_means: Sequence[float], parents: Sequence[float]) -> float:
    if not child_means:
        return float("nan")
    gaps = [abs(float(c) - float(p)) for c, p in zip(child_means, parents)]
    return float(np.mean(gaps))
