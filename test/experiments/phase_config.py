# -*- coding: utf-8 -*-
"""실험 Phase 설정 (운영 엔진과 무관).

필수 계층 순서 (다시 어기지 말 것):
  0 위생 → 1~3 세운 패턴 → **6D 대운 climate** → **6E 세운(부모=climate)**
  → 6B 월 → 6C 일 → (라벨 후 월·일 분리도 재스윕)
※ 6A는 대운 선확정 없이 세운만 튜닝한 과도기 → 6E가 대체.
"""
from __future__ import annotations

SOFT_EXCLUDE_NAMES = frozenset({
    "Sean Penn",
    "John Ritter",
})

HOLDOUT_NAMES = frozenset({
    "Barack Obama",
    "Justin Bieber",
    "Lionel Messi",
    "윤석열",
    "Monica Lewinsky",
})

PHASE = {
    "current": "9",
    "order_note": "6D→6E→6B2/6C2 reference; B9 additive hierarchy (A first)",
    "0": {"name": "KPI·데이터 위생", "status": "done"},
    "1": {
        "name": "세운 composite 재설계",
        "status": "done",
        "version": "B1_gated_discord",
        "result": "train 75% / holdout 80%",
    },
    "2": {
        "name": "실패 패턴별 composite 보강",
        "status": "done",
        "version": "B2_pattern",
        "result": "train 100% / holdout 80%",
    },
    "3": {
        "name": "건강악재 + 대운 KPI 도입",
        "status": "done",
        "version": "B3_health_hier",
        "result": "sewoon 100%; daewoon 재정의 필요",
    },
    "4": {
        "name": "계층 혼합 + climate KPI",
        "status": "done",
        "version": "B4_hier_blend",
        "result": "sewoon 100%; dae climate excl-mixed 4/4",
    },
    "5": {
        "name": "climate α + 세운독립 진폭",
        "status": "done",
        "version": "B5_hier_amp",
        "result": "α=0.40 amp=2.25; σ↑",
    },
    "6A": {
        "name": "세운 HP (대운 미선확정·과도기)",
        "status": "superseded_by_6E",
        "version": "B6_hp_hier",
        "result": "α=0.45 — 6D 없이 진행한 실수. 6E로 대체",
    },
    "6D": {
        "name": "대운 climate HP (조립→재료)",
        "status": "done",
        "version": "B7_dae_first",
        "result": (
            "D1: year_resid가 block_*보다 climate KPI 우위(block 25%대); "
            "D2: resid_scale≈2.10 + 재료 재가중; dae 4/4 sep≈+11.6 "
            "(control 75%/+1.4)"
        ),
    },
    "6E": {
        "name": "세운 재스윕 (확정 climate 부모)",
        "status": "done",
        "version": "B7_dae_first",
        "target_train_rate": 100.0,
        "target_holdout_rate": 90.0,
        "result": (
            "α≥0.35 제약 채택 α=0.38 amp=2.93; "
            "sewoon 100% sep≈+6.1; dae 100% 유지"
        ),
    },
    "6B": {
        "name": "월운 계층 스모크",
        "status": "superseded_by_6B2",
        "version": "B6B_month_hier",
        "result": "β=0.72 amp=2.34; 라벨 후 6B2로 대체",
    },
    "6B2": {
        "name": "월운 라벨 분리도 재스윕",
        "status": "done",
        "version": "B8_month_sep",
        "result": (
            "month_day_labels.json 14명; β=0.715 amp=1.71; "
            "train 7/9 (78%) holdout 5/5 (100%); fail=Brown·Gore"
        ),
    },
    "6C": {
        "name": "일운 계층 스모크",
        "status": "superseded_by_6C2",
        "version": "B6C_day_hier",
        "result": "γ=0.56 amp=2.42; 라벨 후 6C2로 대체",
    },
    "6C2": {
        "name": "일운 라벨 분리도 재스윕",
        "status": "done",
        "version": "B8_day_sep",
        "result": (
            "γ=0.58 amp=1.91; train 7/9 (78%) holdout 4/5 (80%); "
            "fail=Brown·Gore·Messi(hold)"
        ),
    },
    "9": {
        "name": "B9 additive hierarchy (spec+scaffold)",
        "status": "in_progress",
        "version": "B9_freeze_a1_b0.25",
        "result": (
            "Permanent freeze α=1 κ=0 β=0.25 median; D=engine pillar; "
            "no interaction/synergy; B/R rejected; D arm not candidate; "
            "robustness: validate_b9_robustness.py → exp_b9_robustness.json"
        ),
    },
}
