# -*- coding: utf-8 -*-
"""
대조군 (CONTROL)

운영 엔진이 실제로 차트에 그리는 세운 composite = candle.close.
이 모듈은 엔진을 호출해 close를 읽을 뿐, 어떤 점수도 재정의하지 않는다.
"""
from __future__ import annotations

ARM_ID = "control"
ARM_LABEL = "대조군 · 엔진 candle.close"
ARM_VERSION = "production"


def year_score_from_meta(meta: dict) -> float:
    """대조군 스코어러 — meta의 close를 그대로 반환 (실험 재합성 없음)."""
    c = (meta or {}).get("candle") or {}
    if "close" in c:
        return float(c["close"])
    # fallback: scores.종합
    sc = (meta or {}).get("scores") or {}
    return float(sc.get("종합") or 50.0)
