# -*- coding: utf-8 -*-
"""
실험군 B — 일운 계층 재합성 (엔진 미수정).

일 = 월운B × γ + amp(일독립_역산) × (1−γ)
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from experiments import lower_hierarchy as LH

ARM_ID = "B_day_v1"
ARM_LABEL = "실험군B · 일운 계층"
ARM_VERSION = "B8_day_sep"

# Phase 6C2 채택 (라벨 분리도 스윕): train≈78% / holdout 80%, sp≈0.80
ARM_DAY_CONFIG: Dict[str, Any] = {
    "parent_w": 0.58,          # 월운 유지
    "child_w": 0.42,           # 일 독립
    "neutral_child_w": 0.455,  # 월 중립 시
    "child_amp": 1.91,
    "min_parent_w": 0.55,
}


def day_score(
    *,
    control_day: float,
    control_month: float,
    month_b: float,
    cfg: Optional[Dict[str, Any]] = None,
    synergy: float = 0.0,
) -> float:
    cfg = cfg or ARM_DAY_CONFIG
    out = LH.remap_child(
        control_final=control_day,
        control_parent=control_month,
        new_parent=month_b,
        parent_w=float(cfg["parent_w"]),
        child_w=float(cfg["child_w"]),
        child_amp=float(cfg.get("child_amp") or 1.0),
        neutral_child_w=float(cfg.get("neutral_child_w") or 0.45),
        synergy=synergy,
    )
    return float(out["score"])
