# -*- coding: utf-8 -*-
"""B9 scaffold smoke tests (no B/C/D runs)."""
from __future__ import annotations

from experiments import arm_b9, arm_b9_month


def test_b9a_ordinary_year_equals_d():
    """A_y=0 ⇒ S_raw=D."""
    assert abs(arm_b9.squash(55.0 + 1.0 * 0.0) - 55.0) < 1e-9


def test_b9a_d_map_uses_jonghab():
    rows = [
        {"daewoon_pillar": "庚子", "종합운점수": 59},
        {"daewoon_pillar": "己亥", "종합운점수": 64},
    ]
    m = arm_b9.d_map_from_daewoon_detail(rows, allow_open_fallback=False)
    assert m["庚子"] == 59.0 and m["己亥"] == 64.0


def test_b9_month_raw_parent_is_s_raw():
    out = arm_b9_month.month_series_for_year(
        control_months=[60, 62, 58, 64, 61, 59, 63, 57, 60, 62, 58, 61],
        control_sewoon=62.0,
        S_raw_y=70.0,
        S_y=70.0,
        b9_m_cfg={"beta": 1.0},
    )
    # mean(M_raw) should sit near S_raw under median-centered Q
    import numpy as np
    assert abs(float(np.mean(out["M_raw"])) - 70.0) < 1.5
    assert out["S_raw"] == 70.0


def test_b9a_alpha_frozen():
    assert abs(float(arm_b9.ARM_B9_CONFIG["alpha"]) - 1.0) < 1e-9
    assert arm_b9.ARM_VERSION == "B9A_alpha_1"
