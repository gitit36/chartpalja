# -*- coding: utf-8 -*-
"""
실험군 B — 월운 계층 재합성 (엔진 미수정).

월 = 세운B × β + amp(월독립_역산) × (1−β)
월독립은 Control 월운 점수에서 역산.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from experiments import lower_hierarchy as LH

ARM_ID = "B_month_v1"
ARM_LABEL = "실험군B · 월운 계층"
ARM_VERSION = "B8_month_sep"

# Phase 6B2 채택 (라벨 분리도 스윕): train≈78% / holdout 100%, sp≈0.99
ARM_MONTH_CONFIG: Dict[str, Any] = {
    "parent_w": 0.715,         # 세운 유지
    "child_w": 0.285,          # 월 독립
    "neutral_child_w": 0.494,  # 세운 중립(45~55) 시
    "child_amp": 1.71,         # 월독립 진폭 (스모크 때보다 ↓ — 분리도 우선)
    "min_parent_w": 0.55,      # 계층 하한
}


def month_score(
    *,
    control_month: float,
    control_sewoon: float,
    sewoon_b: float,
    cfg: Optional[Dict[str, Any]] = None,
    synergy: float = 0.0,
) -> float:
    cfg = cfg or ARM_MONTH_CONFIG
    out = LH.remap_child(
        control_final=control_month,
        control_parent=control_sewoon,
        new_parent=sewoon_b,
        parent_w=float(cfg["parent_w"]),
        child_w=float(cfg["child_w"]),
        child_amp=float(cfg.get("child_amp") or 1.0),
        neutral_child_w=float(cfg.get("neutral_child_w") or 0.42),
        synergy=synergy,
    )
    return float(out["score"])


def remap_year_months(
    control_months: List[float],
    control_sewoon: float,
    sewoon_b: float,
    cfg: Optional[Dict[str, Any]] = None,
) -> List[float]:
    return [
        month_score(
            control_month=m,
            control_sewoon=control_sewoon,
            sewoon_b=sewoon_b,
            cfg=cfg,
        )
        for m in control_months
    ]
