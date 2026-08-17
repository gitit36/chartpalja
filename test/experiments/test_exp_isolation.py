# -*- coding: utf-8 -*-
"""실험 암이 운영 엔진 close를 오염시키지 않는지 스모크."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from experiments import arm_a_proto, arm_b, arm_b_day, arm_b_month, arm_control, common as C, phase_config as PC
from experiments import hierarchy as H
from experiments import lower_hierarchy as LH


def test_arm_ids_distinct():
    assert arm_control.ARM_ID != arm_a_proto.ARM_ID != arm_b.ARM_ID


def test_phase0_buckets_partition_core():
    subjects = C.load_core_subjects()
    names = {s["name"] for s in subjects}
    soft = PC.SOFT_EXCLUDE_NAMES & names
    hold = PC.HOLDOUT_NAMES & names
    assert soft, "soft_exclude must hit at least one core subject"
    assert hold, "holdout must hit at least one core subject"
    assert soft.isdisjoint(hold)
    train, holdout = C.split_train_holdout(subjects)
    assert all(C.cohort_bucket(s["name"]) == "train" for s in train)
    assert all(C.cohort_bucket(s["name"]) == "holdout" for s in holdout)
    primary = C.filter_primary(subjects)
    assert len(primary) == len(train) + len(holdout)


def test_b1_gated_discord_brown_2009():
    """Brown 2009: yfit↑ rel↓ + 양인 → A보다 낮음."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Chris Brown")
    _close, meta = C.engine_year_maps(n)
    a = arm_a_proto.year_score_from_meta(meta[2009])
    b = arm_b.year_score_from_meta(meta[2009])
    assert b < a - 1.0, f"gated discord: A={a} B={b}"


def test_b1_skips_yun_2021_without_risk_gate():
    """윤석열 2021: risk gate 미충족 → discord 미발동 (기후 혼합으로 A와 달라도 OK)."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "윤석열")
    _close, meta = C.engine_year_maps(n)
    m = meta[2021]
    bd = (m.get("breakdown") or {})
    yfit = float(bd.get("yongshin_fit") or 0)
    ilju = m.get("세운_일주관계") or []
    if not isinstance(ilju, list):
        ilju = []
    assert not arm_b._risk_gate(m, arm_b.ARM_B_CONFIG, yfit, ilju)
    a = arm_a_proto.year_score_from_meta(m)
    b = arm_b.year_score_from_meta(m)
    # discord(-12.5)급 급락은 없어야 함
    assert b > a - 10.0, f"unexpected crash without risk gate: A={a} B={b}"


def test_b2_hollow_boom_hillary_2012():
    """Hillary 2012 Benghazi: hollow-boom으로 A보다 낮음."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Hillary Clinton")
    _close, meta = C.engine_year_maps(n)
    a = arm_a_proto.year_score_from_meta(meta[2012])
    b = arm_b.year_score_from_meta(meta[2012])
    assert b < a - 2.0, f"hollow boom: A={a} B={b}"


def test_b3_health_guan_bieber_2020():
    """Bieber 2020 라임병: 정관+극고yfit → A보다 크게 하락."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Justin Bieber")
    _close, meta = C.engine_year_maps(n)
    a = arm_a_proto.year_score_from_meta(meta[2020])
    b = arm_b.year_score_from_meta(meta[2020])
    assert b < a - 5.0, f"health guan: A={a} B={b}"


def test_b4_blend_preserves_holdout_bieber_pass():
    """계층 혼합 후에도 Bieber는 pass 유지."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Justin Bieber")
    close, meta = C.engine_year_maps(n)
    e = C.eval_arm_on_person(
        n, close, meta, arm_b.year_score_from_meta, exclude_collisions=True
    )
    assert e["status"] == "pass", e


def test_b6_daewoon_blend_climate_parent():
    assert float(arm_b.ARM_B_CONFIG.get("daewoon_blend") or 0) >= 0.35
    assert arm_b.ARM_B_CONFIG.get("daewoon_parent") == "climate"
    assert float(arm_b.ARM_B_CONFIG.get("yindep_amp") or 1) > 1.0
    assert arm_b.ARM_B_CONFIG.get("dae_climate_mode") in (
        "year_resid", "block_resid", "block_blend"
    )
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Lionel Messi")
    _close, meta = C.engine_year_maps(n)
    m = meta[2022]
    pure = arm_b.year_score_pure_from_meta(m)
    amp = arm_b._amplified_indep(pure, arm_b.ARM_B_CONFIG)
    climate = arm_b.daewoon_score_from_meta(m)
    blended = arm_b.year_score_from_meta(m)
    lo, hi = sorted([amp, climate])
    assert lo - 0.05 <= blended <= hi + 0.05


def test_b6_holdout_gate_messi_pass():
    """B7: Messi holdout sep>0."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Lionel Messi")
    close, meta = C.engine_year_maps(n)
    sc = arm_b.make_year_scorer(arm_b.ARM_B_CONFIG, meta)
    e = C.eval_arm_on_person(n, close, meta, sc, exclude_collisions=True)
    assert e["status"] == "pass", e
    assert e["sep"] > 0


def test_b7_dae_climate_beats_control_rate():
    """대운 climate primary ≥ control (75%)."""
    subjects = C.load_core_subjects()
    primary = [s for s in subjects if C.cohort_bucket(s["name"]) != "soft_exclude"]
    rows_c, rows_b = [], []
    for n in primary:
        close, meta = C.engine_year_maps(n)
        dae_b = arm_b.make_dae_scorer(arm_b.ARM_B_CONFIG, meta)
        rows_c.append({
            "name": n["name"], "bucket": C.cohort_bucket(n["name"]),
            "X": H.eval_daewoon_on_person(n, close, meta, None, exclude_collisions=True),
        })
        rows_b.append({
            "name": n["name"], "bucket": C.cohort_bucket(n["name"]),
            "X": H.eval_daewoon_on_person(n, close, meta, dae_b, exclude_collisions=True),
        })
    tc = C.tally(rows_c, "X")
    tb = C.tally(rows_b, "X")
    assert (tb.get("rate") or 0) >= (tc.get("rate") or 0)
    assert (tb.get("rate") or 0) >= 90.0


def test_make_year_scorer_matches_default_cfg():
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Lionel Messi")
    _close, meta = C.engine_year_maps(n)
    m = meta[2022]
    a = arm_b.year_score_from_meta(m)
    b = arm_b.make_year_scorer(dict(arm_b.ARM_B_CONFIG))(m)
    assert abs(a - b) < 0.01


def test_control_equals_engine_close():
    subjects = C.load_core_subjects()
    n = subjects[0]
    close, meta = C.engine_year_maps(n)
    for y, m in list(meta.items())[:5]:
        assert abs(arm_control.year_score_from_meta(m) - float(close[y])) < 0.01


def test_running_b_does_not_change_engine_close():
    """B 스코어러 호출 전후 엔진 close 불변."""
    subjects = C.load_core_subjects()
    n = next(s for s in subjects if s["name"] == "Lionel Messi")
    close1, meta = C.engine_year_maps(n)
    for m in meta.values():
        _ = arm_b.year_score_from_meta(m)
    close2, _ = C.engine_year_maps(n)
    assert close1 == close2


def test_b6b_month_rank_preserved_on_synthetic():
    """월 재합성: Control 월 순위를 대체로 보존."""
    ctrl = [60, 62, 63, 65, 63, 68, 61, 58, 60, 64, 60, 58]
    rem = arm_b_month.remap_year_months(ctrl, 62.0, 54.1)
    sp = LH.spearman(ctrl, rem)
    assert sp >= 0.95, sp
    assert float(arm_b_month.ARM_MONTH_CONFIG["parent_w"]) >= 0.55


def test_b6c_day_hierarchy_weights():
    assert float(arm_b_day.ARM_DAY_CONFIG["parent_w"]) >= 0.55
    s = arm_b_day.day_score(
        control_day=58.0, control_month=62.0, month_b=55.0
    )
    assert 0.0 <= s <= 100.0


def test_month_day_labels_cover_primary_core():
    from experiments import md_labels as MD
    names = [n["name"] for n in C.filter_primary(C.load_core_subjects())]
    cov = MD.coverage_report(names, need_day=False)
    assert cov["evalable"] >= 12, cov
    cov_d = MD.coverage_report(names, need_day=True)
    assert cov_d["evalable"] >= 12, cov_d


def test_b8_month_day_versions_locked():
    assert arm_b_month.ARM_VERSION == "B8_month_sep"
    assert arm_b_day.ARM_VERSION == "B8_day_sep"
    assert abs(float(arm_b_month.ARM_MONTH_CONFIG["parent_w"]) - 0.715) < 1e-6
    assert abs(float(arm_b_day.ARM_DAY_CONFIG["parent_w"]) - 0.58) < 1e-6
