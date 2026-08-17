# Frozen B9-C β=0.25 from sweep_b9c_beta.py (α=1 κ=0; B/D out)
# -*- coding: utf-8 -*-
"""
B9 month additive scaffold (C/D only — do not run until A passes).

M_raw = S_raw + β·Q
M     = squash(M_raw)

E_ym = estimated_month_resid (recovered from Control; not true indep).
"""
from __future__ import annotations

from statistics import median
from typing import Any, Dict, List, Optional, Sequence

from experiments import common as C
from experiments import lower_hierarchy as LH
from experiments import arm_b9

ARM_ID = "B9_month"
ARM_LABEL = "실험군B9 · additive month"
ARM_VERSION = "B9C_beta_0.25"

# Engine recovery weights (identity recover only)
_RECOVER_PW = 0.65
_RECOVER_CW = 0.35

ARM_B9_MONTH_CONFIG: Dict[str, Any] = {
    "beta": 0.25,               # frozen B9-C (exp_b9c_beta_sweep.json)
    "centering": "median",
}


def estimated_month_resid(
    control_month: float,
    control_sewoon: float,
    *,
    parent_w: float = _RECOVER_PW,
    child_w: float = _RECOVER_CW,
    neutral_child_w: float = 0.42,
) -> float:
    """Mandatory name: estimated_month_resid (not 'month independent')."""
    pw, cw = LH.blend_weights(
        control_sewoon, parent_w, child_w, neutral_child_w=neutral_child_w
    )
    return float(LH.recover_indep(control_month, control_sewoon, pw, cw))


def month_series_for_year(
    *,
    control_months: Sequence[float],
    control_sewoon: float,
    S_raw_y: float,
    S_y: float,
    b9_m_cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """12 months → E, Q, M_raw, M. Parent for M_raw is S_raw (SPEC)."""
    cfg = dict(ARM_B9_MONTH_CONFIG)
    if b9_m_cfg:
        cfg.update(b9_m_cfg)
    beta = float(cfg.get("beta") or 1.0)
    centering = str(cfg.get("centering") or "median")

    E: List[float] = [
        estimated_month_resid(float(m), float(control_sewoon))
        for m in control_months
    ]
    if centering == "mean":
        c_y = float(sum(E) / len(E)) if E else 50.0
    else:
        c_y = float(median(E)) if E else 50.0
    Q = [float(e - c_y) for e in E]
    M_raw = [float(S_raw_y) + beta * q for q in Q]
    M = [float(arm_b9.squash(x)) for x in M_raw]
    return {
        "E": E,
        "Q": Q,
        "C_y": c_y,
        "M_raw": M_raw,
        "M": M,
        "S_raw": float(S_raw_y),
        "S": float(S_y),
        "beta": beta,
        "centering": centering,
        "version": ARM_VERSION,
    }
