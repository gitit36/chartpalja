# -*- coding: utf-8 -*-
"""
실험군 A (EXP-A) — proto_multiaxis general blend

운영 엔진을 변경하지 않는다.
timeline meta/breakdown 위에서 proto의 general 축 점수를 재합성한다.
원본 구현: test/proto_multiaxis.py (axis_scores_from_meta)
"""
from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
sys.path.insert(0, _TEST)

import proto_multiaxis as proto  # noqa: E402

ARM_ID = "A_proto"
ARM_LABEL = "실험군A · proto general"
ARM_VERSION = "proto_multiaxis.general"


def year_score_from_meta(meta: dict) -> float:
    """proto general blend (종합 1점). matched/축별이 아님."""
    ax = proto.axis_scores_from_meta(meta)
    v = ax.get("general")
    if v != v or v is None:
        c = (meta or {}).get("candle") or {}
        return float(c.get("close") or 50.0)
    return float(v)
