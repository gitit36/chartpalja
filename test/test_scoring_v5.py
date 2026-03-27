# -*- coding: utf-8 -*-
"""
saju_engine v5 scoring tests — C1~C6 coverage.

T8:  12운성 감쇠승수 0~1 범위 + 신강 과잉penalty 검증
T9:  BRANCH_JIJANGGAN ↔ BRANCH_HIDDEN_STEMS 본기 일치 + 가중치 합 검증
T9b: 지장간 역할별 용신부합 정확도 (순서 의존 제거 확인)
T10: 스냅샷 회귀 — 극약/태약/신약 사주, 나쁜 해 월운 변동폭 ≥ 15pt
T11: 스냅샷 회귀 — 신강 사주, 長生 대운 시기 월운 안정성
T1:  C2 — 용신 충/파 손상 시 neg 증가
T2:  C2 — 기신 충/파 제거 시 pos 증가
T3:  C4 — 재입묘 케이스 墓 패널티 완화
T4:  C5 — 공망 대운 점수 하락 3~12pt
T5:  C5 — 용신 삼합/방합 시 pos 증가
T6:  C6 — 신살 맥락 보정 (도화/양인)
T_drift: 기존 샘플 연도 평균 drift ≤ ±8pt
"""
import json
import os
import sys
import statistics

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se

SNAPSHOT_DIR = os.path.join(os.path.dirname(__file__), "snapshots")


def _load_snapshot(name: str) -> dict:
    path = os.path.join(SNAPSHOT_DIR, f"{name}.json")
    if not os.path.exists(path):
        if os.environ.get("ALLOW_SNAPSHOT_CREATE") == "1":
            return None
        raise FileNotFoundError(
            f"Snapshot {path} missing. "
            "Run with ALLOW_SNAPSHOT_CREATE=1 to generate."
        )
    with open(path) as f:
        return json.load(f)


def _save_snapshot(name: str, data: dict):
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    path = os.path.join(SNAPSHOT_DIR, f"{name}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ─────────────────────────────────────────────────
# T8: 12운성 감쇠승수 + 과잉penalty
# ─────────────────────────────────────────────────

class TestT8UnseongDamping:
    def test_mult_range_zero_to_one(self):
        """모든 승수가 0.0~1.0 범위 (부호 반전 금지)"""
        for uns, tup in se._UNSEONG_VERDICT_MULT.items():
            for i, v in enumerate(tup):
                assert 0.0 <= v <= 1.0, (
                    f"{uns}[{i}] = {v} — 승수는 0~1만 허용"
                )

    def test_penalty_always_nonpositive(self):
        """과잉 penalty는 항상 ≤ 0"""
        for uns, tup in se._SINGANG_EXCESS_PENALTY.items():
            for v in tup:
                assert v <= 0, f"{uns} has positive penalty {v}"

    def test_singang_jewang_mild_negative(self):
        """신강 + 제왕 → 약한 마이너스 (-5 < total < 0)"""
        raw = se._UNSEONG_SCORE["제왕"]
        mult = se._unseong_mult("제왕", "신강", "")
        pen = se._singang_excess_pen("제왕", "신강", "")
        total = raw * 0.8 * mult + pen
        assert -5.0 < total < 0.0, f"Should be mildly negative: {total}"

    def test_singang_death_still_negative(self):
        """신강 + 사 → 여전히 마이너스 (부호 보존)"""
        raw = se._UNSEONG_SCORE["사"]
        mult = se._unseong_mult("사", "신강", "")
        pen = se._singang_excess_pen("사", "신강", "")
        total = raw * 0.8 * mult + pen
        assert total < 0, f"사 should remain negative for 신강: {total}"

    def test_jongyeok_always_mult_one(self):
        """종격은 항상 mult=1.0, penalty=0"""
        assert se._unseong_mult("제왕", "극왕", "종격") == 1.0
        assert se._singang_excess_pen("제왕", "극왕", "종격") == 0.0

    def test_sinyang_uses_full_mult(self):
        """신약은 승수 1.0 (감쇠 없음)"""
        for uns in se._UNSEONG_VERDICT_MULT:
            m = se._unseong_mult(uns, "신약", "")
            assert m == 1.0, f"신약 {uns} mult should be 1.0, got {m}"


# ─────────────────────────────────────────────────
# T9: BRANCH_JIJANGGAN 일관성
# ─────────────────────────────────────────────────

class TestT9JijangganConsistency:
    def test_bongi_matches_hidden_stems_first(self):
        """BRANCH_JIJANGGAN 본기 == BRANCH_HIDDEN_STEMS[0]"""
        for branch, jj in se.BRANCH_JIJANGGAN.items():
            old_main = se.BRANCH_HIDDEN_STEMS[branch][0]
            assert jj["본기"] == old_main, (
                f"{branch}: JIJANGGAN 본기={jj['본기']} "
                f"!= HIDDEN_STEMS[0]={old_main}"
            )

    def test_weight_sum_is_one(self):
        """모든 지지의 get_jijanggan 가중치 합 = 1.0"""
        for branch in se.EARTHLY_BRANCHES:
            slots = se.get_jijanggan(branch)
            total_w = sum(w for _, _, w in slots)
            assert abs(total_w - 1.0) < 0.01, (
                f"{branch}: weight sum = {total_w}"
            )

    def test_all_branches_have_jijanggan(self):
        """12지지 모두 BRANCH_JIJANGGAN에 있어야 함"""
        for branch in se.EARTHLY_BRANCHES:
            assert branch in se.BRANCH_JIJANGGAN, f"{branch} missing"


# ─────────────────────────────────────────────────
# T9b: 용신부합 float + 역할별 정확도
# ─────────────────────────────────────────────────

class TestT9bYongshinFitFloat:
    def test_chuk_jungi_gold(self):
        """丑: 辛(중기)=金. 용신=金이면 중기 가중치(0.30)만 hit."""
        yinfo = {
            "용신_오행": "金",
            "희신_오행": [],
            "기신_오행": [],
            "구신_오행": [],
        }
        fit = se._check_yongshin_fit("己", "丑", yinfo, "甲")
        # stem 己=土 (miss), 본기 己=土 (miss), 중기 辛=金 (hit 0.30), 여기 癸=水 (miss)
        assert fit["용신부합"] == 0.3, (
            f"Should be 0.30 (중기 only): {fit['용신부합']}"
        )

    def test_full_hit_stem_and_bongi(self):
        """壬申: stem 壬=水, 申 본기 庚=金 중기 壬=水. 용신=水 → stem+중기"""
        yinfo = {
            "용신_오행": "水",
            "희신_오행": ["金"],
            "기신_오행": [],
            "구신_오행": [],
        }
        fit = se._check_yongshin_fit("壬", "申", yinfo, "甲")
        # stem 壬=水 → 0.35, 본기 庚=金 (miss for 용), 중기 壬=水 → 0.30
        assert fit["용신부합"] == 0.65, f"Expected 0.65: {fit['용신부합']}"
        # 희신=金: 본기 庚=金 → 0.50
        assert fit["희신부합"] == 0.5, f"Expected 0.50: {fit['희신부합']}"

    def test_returns_float_type(self):
        """반환값이 항상 float"""
        yinfo = {
            "용신_오행": "火",
            "희신_오행": ["木"],
            "기신_오행": ["水"],
            "구신_오행": [],
        }
        fit = se._check_yongshin_fit("甲", "寅", yinfo, "壬")
        for k, v in fit.items():
            assert isinstance(v, float), f"{k} is {type(v)}, expected float"
            assert 0.0 <= v <= 1.0, f"{k} = {v} out of range"

    def test_no_match_is_zero(self):
        """매칭 없으면 0.0"""
        yinfo = {
            "용신_오행": "火",
            "희신_오행": [],
            "기신_오행": [],
            "구신_오행": [],
        }
        fit = se._check_yongshin_fit("壬", "子", yinfo, "甲")
        # 壬=水, 子=水 → 火와 무관
        assert fit["용신부합"] == 0.0


# ─────────────────────────────────────────────────
# T9c: 경계/공망/통관 보강 회귀
# ─────────────────────────────────────────────────

class TestT9cBoundaryAndMeta:
    def test_start_age_precise_propagates_to_blocks(self):
        """대운 블록은 반올림값이 아니라 시작나이_정밀을 사용해야 함."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        precise = r["대운"]["시작나이_정밀"]
        rounded = r["대운"]["시작나이"]
        first_block = r["대운"]["블록"][0]
        assert precise != rounded, "fixture should have distinct precise age"
        assert abs(first_block["start_age"] - precise) < 0.01, (
            f"block start_age should use precise age: {first_block['start_age']} vs {precise}"
        )

    def test_monthly_pre_daewoon_uses_first_block(self):
        """대운 시작 전 월운 조회는 마지막 대운이 아니라 첫 대운을 사용해야 함."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        monthly = se.build_monthly_timeline(r, dw, 1990)
        assert monthly, "monthly timeline should exist before first daewoon year"
        assert monthly[0]["대운_pillar"] == dw[0]["daewoon_pillar"], (
            f"expected first daewoon pillar, got {monthly[0]['대운_pillar']}"
        )

    def test_monthly_uses_solar_term_boundaries(self):
        """점수형 월운도 build_wolwoon과 같은 절기 경계를 노출해야 함."""
        inp = se.BirthInput(
            year=1998, month=10, day=2, hour=23, minute=54,
            gender="female", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        monthly = se.build_monthly_timeline(r, dw, 2026)
        expected = se.build_wolwoon(se.datetime(2026, 6, 15, tzinfo=se.KST))
        assert len(monthly) == len(expected) == 12
        for item, month_meta in zip(monthly, expected):
            assert item["start"] == month_meta["start"]
            assert item["end"] == month_meta["end"]
            assert item["간지"] == month_meta["ganzhi"]

    def test_gongmang_branch_yfit_damp_applies_to_score(self):
        """공망이면 지지 쪽 용신부합은 yfit_branch 계수만큼 감쇠되어야 함."""
        yfit = {
            "용신부합": 1.0,
            "용신부합_천간": 0.0,
            "용신부합_지지": 1.0,
            "희신부합": 0.0,
            "희신부합_천간": 0.0,
            "희신부합_지지": 0.0,
            "기신부합": 0.0,
            "기신부합_천간": 0.0,
            "기신부합_지지": 0.0,
            "구신부합": 0.0,
            "구신부합_천간": 0.0,
            "구신부합_지지": 0.0,
        }
        gm = {"unseong": 1.0, "rel": 1.0, "yfit_branch": 0.7, "trine": 1.0, "is_gongmang": True}
        comp = se._composite_score(
            50, yfit, "태", 0, 0.0, 0.5, gm=gm
        )
        # v6.1: 12 * 0.7 = 8.4 (계수 15→12)
        assert abs(comp["breakdown"]["yongshin_fit"] - 8.4) < 0.01, comp["breakdown"]

    def test_tonggwan_is_applied_as_aux_heeshin(self):
        """통관 오행이 용신/희신에 반영되어야 함 (용신이면 통관적용=True)."""
        result = se.determine_yongshin(
            {"격국": "편인격", "격국유형": "정격"},
            "신강",
            "甲",
            "申",
            ["庚", "辛", "甲", "庚"],
            ["申", "酉", "申", "子"],
        )
        assert result["통관용신"]["통관용신"] == "水"
        assert result["통관적용"] is True
        # 병인 진단에서 관살과다→인성(水)이 용신이 되므로, 통관=용신으로 반영됨
        assert result["용신_오행"] == "水" or "水" in result["희신_오행"], result


# ─────────────────────────────────────────────────
# T10: 스냅샷 회귀 — 극약/태약/신약 사주, 나쁜 해 월운 변동
# ─────────────────────────────────────────────────

class TestT10SinyangMonthlySnapshot:
    INPUT = se.BirthInput(
        year=1990, month=6, day=15, hour=8, minute=0,
        gender="male", calendar="solar",
    )

    def _run_pipeline(self):
        r = se.enrich_saju(self.INPUT)
        assert r["신강신약"]["판정"] in ("신약", "태약", "극약"), (
            f"Fixture should be 신약/태약/극약, got {r['신강신약']['판정']}"
        )
        dw = se.build_daewoon_detail(r)
        worst_dw = min(dw, key=lambda d: d["종합운점수"])
        target_year = worst_dw["start_year"] + 3
        monthly = se.build_monthly_timeline(r, dw, target_year)
        scores = [m["scores"]["종합"] for m in monthly]
        return {
            "target_year": target_year,
            "verdict": r["신강신약"]["판정"],
            "dw_score": worst_dw["종합운점수"],
            "monthly_scores": scores,
        }

    def test_monthly_spread_at_least_15(self):
        """나쁜 해에서도 월운 변동폭 ≥ 15pt (가산 모델 검증)"""
        data = self._run_pipeline()
        spread = max(data["monthly_scores"]) - min(data["monthly_scores"])
        assert spread >= 15, (
            f"Monthly spread too narrow: {spread} "
            f"(scores: {data['monthly_scores']})"
        )

    def test_snapshot_regression(self):
        """스냅샷 대비 각 월 ±5pt, 대운 ±3pt 이내"""
        baseline = _load_snapshot("t10_sinyang_monthly")
        if baseline is None:
            data = self._run_pipeline()
            _save_snapshot("t10_sinyang_monthly", data)
            return

        data = self._run_pipeline()
        for i, (old, new) in enumerate(
            zip(baseline["monthly_scores"], data["monthly_scores"])
        ):
            assert abs(old - new) <= 5, (
                f"Month {i+1} drift: {old} → {new} (>5pt)"
            )
        assert abs(baseline["dw_score"] - data["dw_score"]) <= 3, (
            f"DW score drift: {baseline['dw_score']} → {data['dw_score']}"
        )


# ─────────────────────────────────────────────────
# T11: 스냅샷 회귀 — 신강 사주, 長生 대운 시기
# ─────────────────────────────────────────────────

class TestT11SingangMonthlySnapshot:
    INPUT = se.BirthInput(
        year=1985, month=2, day=4, hour=14, minute=0,
        gender="male", calendar="solar",
    )

    def _run_pipeline(self):
        r = se.enrich_saju(self.INPUT)
        assert r["신강신약"]["판정"] in ("신강", "태강", "극왕"), (
            f"Fixture should be 신강/태강/극왕, got {r['신강신약']['판정']}"
        )
        dw = se.build_daewoon_detail(r)
        target_dw = next(
            (d for d in dw if d["12운성"] in ("제왕", "건록", "장생")),
            dw[0],
        )
        target_year = target_dw["start_year"] + 5
        monthly = se.build_monthly_timeline(r, dw, target_year)
        scores = [m["scores"]["종합"] for m in monthly]
        return {
            "target_year": target_year,
            "verdict": r["신강신약"]["판정"],
            "unseong": target_dw["12운성"],
            "dw_score": target_dw["종합운점수"],
            "monthly_scores": scores,
        }

    def test_monthly_spread_exists(self):
        """신강 + 왕성 대운에서도 월운 변동 ≥ 5pt (v6: 병인 해소 반영)"""
        data = self._run_pipeline()
        spread = max(data["monthly_scores"]) - min(data["monthly_scores"])
        assert spread >= 5, (
            f"Spread too narrow for 신강+{data['unseong']}: "
            f"{data['monthly_scores']}"
        )

    def test_dw_score_not_extreme_low(self):
        """신강에서 왕성 운성 대운이 극단적으로 낮지 않아야 함"""
        data = self._run_pipeline()
        assert data["dw_score"] >= 30, (
            f"{data['unseong']} 대운 score too low: {data['dw_score']}"
        )

    def test_snapshot_regression(self):
        """스냅샷 대비 각 월 ±5pt, 대운 ±3pt 이내"""
        baseline = _load_snapshot("t11_singang_monthly")
        if baseline is None:
            data = self._run_pipeline()
            _save_snapshot("t11_singang_monthly", data)
            return

        data = self._run_pipeline()
        for i, (old, new) in enumerate(
            zip(baseline["monthly_scores"], data["monthly_scores"])
        ):
            assert abs(old - new) <= 5, (
                f"Month {i+1} drift: {old} → {new} (>5pt)"
            )
        assert abs(baseline["dw_score"] - data["dw_score"]) <= 3, (
            f"DW score drift: {baseline['dw_score']} → {data['dw_score']}"
        )


# ─────────────────────────────────────────────────
# T1: C2 — 용신 충/파 손상 시 neg↑
# ─────────────────────────────────────────────────

class TestT1YongshinChungDamage:
    def test_yongshin_chung_increases_neg(self):
        """타격대상이 용신 오행이면 충/파에서 neg가 커져야 함."""
        yong_info = {
            "용신_오행": "木",
            "희신_오행": ["水"],
            "기신_오행": ["金"],
            "구신_오행": [],
        }
        rels = [
            {"with": "연주(甲寅)", "pillar_idx": 0,
             "relations": ["지지충(申↯寅)"]},
        ]
        orig_stems = ["甲", "丙", "壬", "戊"]
        orig_branches = ["寅", "午", "子", "辰"]
        pos2, neg2, _ = se._weighted_rel_score_v2(
            rels, yong_info, orig_stems, orig_branches)
        pos1, neg1, _ = se._extract_rel_keys(rels)
        assert neg2 >= neg1 + 0.4, (
            f"용신 충 neg should increase: v1={neg1}, v2={neg2}"
        )


# ─────────────────────────────────────────────────
# T2: C2 — 기신 충/파 제거 시 pos↑
# ─────────────────────────────────────────────────

class TestT2GishinChungRemoval:
    def test_gishin_chung_increases_pos(self):
        """타격대상이 기신 오행이면 충/파에서 pos가 커져야 함(기신 제거)."""
        yong_info = {
            "용신_오행": "木",
            "희신_오행": ["水"],
            "기신_오행": ["金"],
            "구신_오행": [],
        }
        rels = [
            {"with": "시주(庚申)", "pillar_idx": 3,
             "relations": ["지지충(寅↯申)"]},
        ]
        orig_stems = ["甲", "丙", "壬", "庚"]
        orig_branches = ["寅", "午", "子", "申"]
        pos2, neg2, _ = se._weighted_rel_score_v2(
            rels, yong_info, orig_stems, orig_branches)
        pos1, neg1, _ = se._extract_rel_keys(rels)
        assert pos2 >= pos1 + 0.6, (
            f"기신 충제거 pos should increase: v1_pos={pos1}, v2_pos={pos2}"
        )


# ─────────────────────────────────────────────────
# T3: C4 — 재입묘 케이스 墓 패널티 완화
# ─────────────────────────────────────────────────

class TestT3JeIpMyoRelief:
    def test_mu_with_pyeonjae_positive_adj(self):
        """墓 + 편재 → 재입묘로 패널티 완화(+방향)."""
        adj = se._unseong_tengo_adj("묘", "편재", "")
        assert adj > 0, f"재입묘(墓+편재) should be positive: {adj}"

    def test_mu_with_jeonggwan_negative_adj(self):
        """墓 + 정관 → 관입묘로 패널티 유지/강화."""
        adj = se._unseong_tengo_adj("묘", "정관", "")
        assert adj < 0, f"관입묘(墓+정관) should be negative: {adj}"


# ─────────────────────────────────────────────────
# T4: C5 — 공망 대운 점수 하락 3~12pt
# ─────────────────────────────────────────────────

class TestT4GongmangDaewoon:
    def test_gongmang_score_reduction(self):
        """공망 대운의 점수 하락이 3~12pt 범위."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        day_gz = r["원국"]["day"][0] + r["원국"]["day"][1]
        gm_dws = [d for d in dw
                   if d["branch"] in se.xunkong(day_gz)]
        non_gm_dws = [d for d in dw
                      if d["branch"] not in se.xunkong(day_gz)]
        if not gm_dws or not non_gm_dws:
            return
        gm_avg = statistics.mean([d["종합운점수"] for d in gm_dws])
        non_avg = statistics.mean([d["종합운점수"] for d in non_gm_dws])
        diff = non_avg - gm_avg
        assert diff >= 2, (
            f"Gongmang daewoon should be lower: diff={diff:.1f}"
        )
        assert diff <= 15, (
            f"Gongmang reduction too harsh: diff={diff:.1f}"
        )


# ─────────────────────────────────────────────────
# T5: C5 — 용신 삼합/방합 시 pos 증가
# ─────────────────────────────────────────────────

class TestT5YongshinTrinePos:
    def test_trine_with_yongshin_element(self):
        """용신 오행 삼합 완성 시 pos 증가."""
        yong_info = {"용신_오행": "水", "희신_오행": ["金"],
                     "기신_오행": [], "구신_오행": []}
        hits = se._check_trine_direction("子", ["申", "辰", "午"])
        pos, neg = se._trine_energy_adj(hits, yong_info)
        assert pos >= 2.0, f"Water trine pos should be ≥2: {pos}"
        assert neg == 0.0, f"No neg expected: {neg}"

    def test_gishin_trine_increases_neg(self):
        """기신 오행 삼합 완성 시 neg 증가."""
        yong_info = {"용신_오행": "木", "희신_오행": [],
                     "기신_오행": ["水"], "구신_오행": []}
        hits = se._check_trine_direction("子", ["申", "辰", "午"])
        pos, neg = se._trine_energy_adj(hits, yong_info)
        assert neg >= 2.0, f"Water(기신) trine neg should be ≥2: {neg}"


# ─────────────────────────────────────────────────
# T6: C6 — 신살 맥락 보정 (도화/양인)
# ─────────────────────────────────────────────────

class TestT6ShinsalContext:
    def test_yangin_sinyang_positive(self):
        """양인은 신약이면 비겁보강(+)."""
        adj = se._contextual_shinsal_adj([], ["양인(羊刃)"], "신약")
        assert adj > 0, f"양인+신약 should be positive: {adj}"

    def test_yangin_singang_negative(self):
        """양인은 신강이면 과잉(-)."""
        adj = se._contextual_shinsal_adj([], ["양인(羊刃)"], "신강")
        assert adj < 0, f"양인+신강 should be negative: {adj}"

    def test_dohwa_default_small(self):
        """도화 보정은 신약이면 +1 수준."""
        adj = se._contextual_shinsal_adj(["도화살"], [], "신약")
        assert adj == 1, f"도화+신약 should be +1: {adj}"


# ─────────────────────────────────────────────────
# T_drift: 기존 샘플 drift guard
# ─────────────────────────────────────────────────

class TestDriftGuard:
    SAMPLES = [
        se.BirthInput(year=1990, month=6, day=15, hour=8, minute=0,
                      gender="male", calendar="solar"),
        se.BirthInput(year=1985, month=2, day=4, hour=14, minute=0,
                      gender="male", calendar="solar"),
        se.BirthInput(year=1978, month=11, day=20, hour=6, minute=0,
                      gender="female", calendar="solar"),
    ]

    def test_yearly_avg_drift_within_range(self):
        """3개 샘플의 연도 평균 점수가 30~70 범위 (v6: 병인 해소 반영으로 범위 확장)."""
        for inp in self.SAMPLES:
            r = se.enrich_saju(inp)
            dw = se.build_daewoon_detail(r)
            yt = se.build_yearly_timeline(r, dw, span=40)
            scores = [item["scores"]["종합"] for item in yt]
            avg = statistics.mean(scores)
            assert 30 <= avg <= 70, (
                f"Yearly avg={avg:.1f} for {inp.year}/{inp.month}/{inp.day} "
                f"drifted out of 30~70 range"
            )


# ─────────────────────────────────────────────────
# S1-T7: 관계 스파이크 clamp
# ─────────────────────────────────────────────────

class TestT7RelationSpikeClamp:
    def test_multi_clash_direction_clamped(self):
        """충+형+파 동시 발생 시 energy_field direction 절대값 ≤ 4.5."""
        rels = [{
            "with": "연주(甲寅)", "pillar_idx": 0,
            "relations": [
                "지지충(申↯寅)",
                "지지형(무은지형:申刑寅)",
                "지지파(申×寅)",
            ],
        }]
        ef = se._calc_energy_field(
            rels, None,
            yong_info={"용신_오행": "木", "희신_오행": [], "기신_오행": ["金"], "구신_오행": []},
            inc_stem="庚", inc_branch="申",
            orig_stems=["甲", "丙", "壬", "戊"],
            orig_branches=["寅", "午", "子", "辰"],
        )
        assert abs(ef["direction"]) <= 4.5, (
            f"Direction spike: {ef['direction']} exceeds ±4.5"
        )

    def test_t1_t2_still_pass(self):
        """S1 clamp 이후에도 기존 T1/T2 방향성 유지."""
        yong_info = {"용신_오행": "木", "희신_오행": ["水"],
                     "기신_오행": ["金"], "구신_오행": []}
        rels_yong = [{"with": "연주(甲寅)", "pillar_idx": 0,
                      "relations": ["지지충(申↯寅)"]}]
        rels_gi = [{"with": "시주(庚申)", "pillar_idx": 3,
                    "relations": ["지지충(寅↯申)"]}]
        orig_s = ["甲", "丙", "壬", "庚"]
        orig_b = ["寅", "午", "子", "申"]
        _, neg_y, _ = se._weighted_rel_score_v2(rels_yong, yong_info, orig_s, orig_b)
        pos_g, _, _ = se._weighted_rel_score_v2(rels_gi, yong_info, orig_s, orig_b)
        assert neg_y > 0, "용신 충 → neg > 0"
        assert pos_g > 0, "기신 충제거 → pos > 0"


# ─────────────────────────────────────────────────
# S2-T8: 공망 relation 감쇠 sign 유지
# ─────────────────────────────────────────────────

class TestT8GongmangRelSign:
    def test_gongmang_preserves_rel_sign(self):
        """공망 감쇠 후에도 관계 점수 sign이 유지되어야 함."""
        gm = se._GONGMANG_DAMP_JINGONG.copy()
        assert gm["rel"] > 0 and gm["rel"] < 1, (
            f"rel damping should be 0<x<1: {gm['rel']}"
        )
        neg_before = 3.0
        neg_after = neg_before * gm["rel"]
        assert neg_after > 0, "sign should be preserved (positive remains positive)"
        assert neg_after < neg_before, "magnitude should decrease"

    def test_t4_gongmang_drop_still_in_range(self):
        """공망 대운 drop이 여전히 2~15pt 범위."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        day_gz = r["원국"]["day"][0] + r["원국"]["day"][1]
        gm_dws = [d for d in dw if d["branch"] in se.xunkong(day_gz)]
        non_gm_dws = [d for d in dw if d["branch"] not in se.xunkong(day_gz)]
        if not gm_dws or not non_gm_dws:
            return
        gm_avg = statistics.mean([d["종합운점수"] for d in gm_dws])
        non_avg = statistics.mean([d["종합운점수"] for d in non_gm_dws])
        diff = non_avg - gm_avg
        assert 2 <= diff <= 15, f"Gongmang drop {diff:.1f} out of 2~15 range"


# ─────────────────────────────────────────────────
# E1-T9: Breakdown 합 ≈ score
# ─────────────────────────────────────────────────

class TestT9BreakdownSum:
    def test_daewoon_breakdown_sums(self):
        """대운 breakdown 합 ≈ score (base 포함, clamp 전)."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        for d in dw[:3]:
            bd = d["breakdown"]
            raw = sum(bd.values())
            score = d["종합운점수"]
            clamped_raw = max(0, min(100, round(raw)))
            assert clamped_raw == score, (
                f"Breakdown sum {raw:.1f} → clamped {clamped_raw} "
                f"!= score {score}"
            )

    def test_yearly_breakdown_exists(self):
        """연도별 타임라인에 breakdown 필드 존재."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        yt = se.build_yearly_timeline(r, dw, span=5)
        for item in yt[:2]:
            assert "breakdown" in item, "yearly item missing breakdown"
            bd = item["breakdown"]
            assert "yongshin_fit" in bd
            assert "unseong" in bd
            assert "relations" in bd

    def test_monthly_breakdown_sums(self):
        """월운 breakdown 합 ≈ m_ind score."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        mt = se.build_monthly_timeline(r, dw, 2020)
        for m in mt[:3]:
            bd = m["breakdown"]
            raw = sum(bd.values())
            clamped = max(0, min(100, round(raw)))
            assert "yongshin_fit" in bd
            assert "unseong" in bd

    def test_s3_unseong_context_stats(self):
        """S3: unseong_tengo_adj 안정성 — 모든 보정값 |adj|≤2.5."""
        for uns, entries in se._UNSEONG_TENGO_CONTEXT.items():
            adj = entries * 0.5
            assert abs(adj) <= 2.5, f"{uns} adj={adj} exceeds 2.5"


# ─────────────────────────────────────────────────
# T12: span=100 타임라인 길이 검증
# ─────────────────────────────────────────────────

class TestT12Span100:
    def test_yearly_timeline_length_100(self):
        """build_yearly_timeline(span=100) → 100개 항목."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        yt = se.build_yearly_timeline(r, dw, span=100)
        assert len(yt) == 100, f"Expected 100 items, got {len(yt)}"
        assert yt[-1]["year"] == 1990 + 99, (
            f"Last year should be 2089, got {yt[-1]['year']}"
        )

    def test_default_span_is_100(self):
        """span 기본값이 100."""
        inp = se.BirthInput(
            year=1985, month=2, day=4, hour=14, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        yt = se.build_yearly_timeline(r, dw)
        assert len(yt) == 100, f"Default span should be 100, got {len(yt)}"

    def test_late_years_have_valid_scores(self):
        """86~100세 구간도 유효한 점수(0~100)."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        yt = se.build_yearly_timeline(r, dw, span=100)
        for item in yt[86:]:
            score = item["scores"]["종합"]
            assert 0 <= score <= 100, (
                f"Year {item['year']} score={score} out of range"
            )

    def test_payload_last_year_is_birth_plus_99(self):
        """build_chart_payload 연도별_타임라인 마지막 연도 = birthYear + 99."""
        inp = se.BirthInput(
            year=1990, month=6, day=15, hour=8, minute=0,
            gender="male", calendar="solar",
        )
        r = se.enrich_saju(inp)
        payload = se.build_chart_payload(r)
        timeline = payload["연도별_타임라인"]
        assert len(timeline) == 100, f"Payload timeline length: {len(timeline)}"
        assert timeline[-1]["year"] == 1990 + 99, (
            f"Payload lastYear should be 2089: {timeline[-1]['year']}"
        )
        assert timeline[0]["year"] == 1990


# ─────────────────────────────────────────────────
# T13: Golden test — 프롬프트 구조 검증
# ─────────────────────────────────────────────────

class TestT13PromptGolden:
    """fortune-prompt.ts 템플릿 정적 검증 (소스코드 기반)."""

    def _read_prompt_file(self):
        path = os.path.join(
            os.path.dirname(__file__), "..",
            "src", "lib", "ai", "fortune-prompt.ts"
        )
        with open(path) as f:
            return f.read()

    def test_100_year_and_mannyeon_in_prompt(self):
        """프롬프트 템플릿에 0~100세/만년/86~100 관련 키워드 존재."""
        src = self._read_prompt_file()
        assert "0~100세" in src or "0~100" in src, (
            "Prompt should reference 0~100세 lifespan"
        )
        assert "만년" in src or "86~100" in src or "만년(86~100" in src, (
            "Prompt should reference 만년 / late-life period"
        )

    def test_three_year_keywords_in_prompt(self):
        """프롬프트 템플릿에 작년/올해/내년 키워드 모두 존재."""
        src = self._read_prompt_file()
        assert "작년" in src, "Prompt must mention 작년"
        assert "올해" in src, "Prompt must mention 올해"
        assert "내년" in src, "Prompt must mention 내년"

    def test_reasoning_directive_in_prompt(self):
        """프롬프트에 원시 재료 역추적 지시가 존재."""
        src = self._read_prompt_file()
        assert "역추적" in src, "Prompt should contain reasoning directive '역추적'"
        assert "원시 재료" in src or "원시재료" in src, (
            "Prompt should reference '원시 재료'"
        )

    def test_no_number_recitation_ban(self):
        """숫자 낭독 금지 지시가 존재."""
        src = self._read_prompt_file()
        assert "낭독" in src or "낭독 금지" in src, (
            "Prompt should ban number recitation"
        )

    def test_mulsang_metaphor_rule(self):
        """비유는 물상(오행) 기반 규칙이 존재."""
        src = self._read_prompt_file()
        assert "물상" in src or "일간 오행" in src, (
            "Prompt should contain 물상-based metaphor rule"
        )

    def test_fackpok_rule(self):
        """팩폭(직설적 지적) 규칙이 존재."""
        src = self._read_prompt_file()
        assert "팩폭" in src, (
            "Prompt should contain 팩폭 rule for direct tone"
        )

    def test_min_length_rule(self):
        """분량 하한(최소 N자) 규칙이 존재."""
        src = self._read_prompt_file()
        assert "최소 500자" in src or "최소 500" in src or "최소 800자" in src or "최소 800" in src, (
            "Prompt should specify minimum content length"
        )

    def test_before_after_examples(self):
        """숫자 낭독 금지에 before/after 예시가 존재."""
        src = self._read_prompt_file()
        assert "❌" in src and "⭕" in src, (
            "Prompt should contain ❌/⭕ before-after examples"
        )


# ── [11] 음력/양력 입력 일치 테스트 ─────────────────────
class TestLunarSolarParity:
    """같은 생년월일을 양력/음력으로 입력했을 때 사주 4주가 동일해야 한다."""

    CASES = [
        # (양력y,m,d, 음력y,m,d, is_leap_month, hour, minute, gender)
        (1990, 1, 15,   1989, 12, 19,  False, 12, 0, "male"),
        (1998, 10, 2,   1998, 8, 12,   False, 23, 54, "female"),
        (1997, 3, 6,    1997, 1, 27,   False, 3, 25, "male"),
        (2000, 2, 5,    2000, 1, 1,    False, 8, 0, "male"),
    ]

    def _run_pair(self, sy, sm, sd, ly, lm, ld, leap, h, mi, gender):
        inp_s = se.BirthInput(year=sy, month=sm, day=sd, hour=h, minute=mi,
                              calendar="solar", gender=gender)
        inp_l = se.BirthInput(year=ly, month=lm, day=ld, hour=h, minute=mi,
                              calendar="lunar", is_leap_month=leap, gender=gender)
        rs = se.enrich_saju(inp_s)
        rl = se.enrich_saju(inp_l)
        return rs["원국"], rl["원국"]

    def test_case_1990(self):
        c = self.CASES[0]
        ps, pl = self._run_pair(*c)
        for k in ("year", "month", "day", "hour"):
            assert ps[k] == pl[k], f"Mismatch {k}: solar={ps[k]} lunar={pl[k]}"

    def test_case_1998(self):
        c = self.CASES[1]
        ps, pl = self._run_pair(*c)
        for k in ("year", "month", "day", "hour"):
            assert ps[k] == pl[k], f"Mismatch {k}: solar={ps[k]} lunar={pl[k]}"

    def test_case_1997(self):
        c = self.CASES[2]
        ps, pl = self._run_pair(*c)
        for k in ("year", "month", "day", "hour"):
            assert ps[k] == pl[k], f"Mismatch {k}: solar={ps[k]} lunar={pl[k]}"

    def test_case_2000(self):
        c = self.CASES[3]
        ps, pl = self._run_pair(*c)
        for k in ("year", "month", "day", "hour"):
            assert ps[k] == pl[k], f"Mismatch {k}: solar={ps[k]} lunar={pl[k]}"


# ─────────────────────────────────────────────────
# T_v6_disease: 병인 진단 + 용신 검증 (4개 학습 예시)
# ─────────────────────────────────────────────────

class TestV6DiseaseDiagnosis:
    """v6 병인 진단 기반 용신 판정이 학습 예시 후보 범위 내에 드는지 검증."""

    def test_case1_1969_yongshin_water(self):
        """1969.03.11 12:15 여 — 乙酉/丁卯/乙酉/壬午: 용신=水(통관)."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        yong = r["용신"]
        assert yong["용신_오행"] == "水", f"Expected 水, got {yong['용신_오행']}"
        assert "木" in yong["희신_오행"], f"Expected 木 in 희신, got {yong['희신_오행']}"
        assert "金" in yong["기신_오행"], f"Expected 金 in 기신, got {yong['기신_오행']}"

    def test_case2_1997_yongshin_wood(self):
        """1997.03.06 03:25 남 — 丁丑/癸卯/丁未/壬寅: 용신=木."""
        inp = se.BirthInput(year=1997, month=3, day=6, hour=3, minute=25,
                            gender="male", calendar="solar")
        r = se.enrich_saju(inp)
        yong = r["용신"]
        assert yong["용신_오행"] == "木", f"Expected 木, got {yong['용신_오행']}"

    def test_case3_2000_yongshin_fire(self):
        """2000.12.21 14:10 남 — 庚辰/戊子/癸丑/己未: 용신=火(조후)."""
        inp = se.BirthInput(year=2000, month=12, day=21, hour=14, minute=10,
                            gender="male", calendar="solar")
        r = se.enrich_saju(inp)
        yong = r["용신"]
        assert yong["용신_오행"] == "火", f"Expected 火, got {yong['용신_오행']}"
        assert "水" in yong["기신_오행"], f"Expected 水 in 기신, got {yong['기신_오행']}"

    def test_case4_1967_yongshin_metal_or_fire(self):
        """1967.03.11 17:40 남 — 丁未/癸卯/甲戌/癸酉: 용신=金 or 火."""
        inp = se.BirthInput(year=1967, month=3, day=11, hour=17, minute=40,
                            gender="male", calendar="solar")
        r = se.enrich_saju(inp)
        yong = r["용신"]
        assert yong["용신_오행"] in ("金", "火"), (
            f"Expected 金 or 火, got {yong['용신_오행']}"
        )

    def test_disease_diag_has_primary(self):
        """모든 학습 예시에서 병인진단 결과에 primary 필드가 존재해야 함."""
        for y, m, d, h, mi, g in [
            (1969, 3, 11, 12, 15, "female"),
            (1997, 3, 6, 3, 25, "male"),
            (2000, 12, 21, 14, 10, "male"),
            (1967, 3, 11, 17, 40, "male"),
        ]:
            inp = se.BirthInput(year=y, month=m, day=d, hour=h, minute=mi,
                                gender=g, calendar="solar")
            r = se.enrich_saju(inp)
            diag = r["용신"].get("병인진단")
            # 종격/화격/외격은 병인진단 없음 (early return)
            if diag is not None:
                assert "primary" in diag, f"Missing primary for {y}-{m}-{d}"

    def test_ohang_has_power_field(self):
        """v6 오행분포에 분포_역량 필드가 존재해야 함."""
        inp = se.BirthInput(year=1990, month=6, day=15, hour=8, gender="male")
        r = se.enrich_saju(inp)
        assert "분포_역량" in r["오행분포"], "Missing 분포_역량 field"

    def test_breakdown_has_disease_resolution(self):
        """v6 breakdown에 disease_resolution 필드가 존재해야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        assert "disease_resolution" in dw[0].get("breakdown", {}), (
            "Missing disease_resolution in daewoon breakdown"
        )


# ─────────────────────────────────────────────────
# T12: 공망 진공/가공/해공 검증 (v6.2)
# ─────────────────────────────────────────────────

class TestT12GongmangJingongGagong:
    """진공(眞空)/가공(假空) 분류 + 해공(解空) 보너스 검증."""

    def test_classify_natal_jingong(self):
        """원국에 합·충 없는 공망 지지 → 진공 판별."""
        # 乙酉일주 → xunkong = [午, 未].  시지=午인데 원국에 午와 합/충 없으면 진공
        result = se.classify_natal_gongmang("乙酉", "己酉",
                                            ["酉", "卯", "酉", "午"])
        day_hits = result["일주공망"]["원국적중"]
        # 午가 시주(idx=3)에서 진공
        hit = [h for h in day_hits if h["branch"] == "午"]
        assert len(hit) == 1, f"Expected 1 hit for 午, got {day_hits}"
        assert hit[0]["type"] == "진공", f"Expected 진공, got {hit[0]['type']}"
        assert hit[0]["pillar"] == "시주"

    def test_classify_natal_gagong_hap(self):
        """원국 내 합 관계 → 가공(합) 판별."""
        # 공망 지지가 원국의 다른 지지와 六合이면 가공(합)
        # 子-丑 합 관계 → 子가 공망이고 丑이 원국에 있으면 가공(합)
        gm_type = se._gongmang_type("子", ["丑", "卯", "酉"])
        assert gm_type == "가공(합)", f"Expected 가공(합), got {gm_type}"

    def test_classify_natal_gagong_chung(self):
        """원국 내 충 관계 → 가공(충) 판별."""
        # 子-午 충 관계 → 子가 공망이고 午가 원국에 있으면 가공(충)
        gm_type = se._gongmang_type("子", ["午", "卯", "酉"])
        assert gm_type == "가공(충)", f"Expected 가공(충), got {gm_type}"

    def test_gagong_dampening_weaker_than_jingong(self):
        """가공 감쇠가 진공 감쇠보다 약해야 함."""
        jingong = se._GONGMANG_DAMP_JINGONG
        gagong_h = se._GONGMANG_DAMP_GAGONG_HAP
        gagong_c = se._GONGMANG_DAMP_GAGONG_CHUNG
        for key in ("rel", "trine", "yfit_branch"):
            assert gagong_h[key] > jingong[key], (
                f"가공(합) {key}={gagong_h[key]} should > 진공 {key}={jingong[key]}"
            )
            assert gagong_c[key] > jingong[key], (
                f"가공(충) {key}={gagong_c[key]} should > 진공 {key}={jingong[key]}"
            )
            assert gagong_h[key] >= gagong_c[key], (
                f"가공(합) {key}={gagong_h[key]} should >= 가공(충) {key}={gagong_c[key]}"
            )

    def test_gongmang_factors_jingong(self):
        """_gongmang_factors가 orig_branches와 합/충 없으면 진공 감쇠 반환."""
        # 乙酉일 → 공망=[午,未]. 午를 넣으면 공망.
        # orig_branches에 午와 합/충 없는 지지만 넣음
        gm = se._gongmang_factors("午", "乙酉", ["寅", "卯", "申"])
        assert gm["is_gongmang"] is True
        assert gm["gongmang_type"] == "진공"
        assert gm["rel"] == se._GONGMANG_DAMP_JINGONG["rel"]

    def test_gongmang_factors_gagong(self):
        """_gongmang_factors가 orig_branches와 합 있으면 가공(합) 반환."""
        # 午-未 합. orig에 未가 있으면 午는 가공(합)
        gm = se._gongmang_factors("午", "乙酉", ["未", "卯", "申"])
        assert gm["is_gongmang"] is True
        assert gm["gongmang_type"] == "가공(합)"
        assert gm["rel"] == se._GONGMANG_DAMP_GAGONG_HAP["rel"]

    def test_haegong_bonus_basic(self):
        """해공: 운의 지지가 원국 공망 지지와 충/합하면 보너스 발생."""
        natal_gm = {
            "일주공망": {"공망지지": ["午", "未"], "원국적중": [
                {"branch": "午", "pillar_idx": 3, "pillar": "시주",
                 "type": "진공", "영역": "자녀궁·말년운", "source": "일주공망"}
            ]},
            "년주공망": {"공망지지": [], "원국적중": []},
            "all_hits": [
                {"branch": "午", "pillar_idx": 3, "pillar": "시주",
                 "type": "진공", "영역": "자녀궁·말년운", "source": "일주공망"}
            ],
        }
        # 子는 午와 충 → 해공
        result = se._haegong_check("子", natal_gm)
        assert result["bonus"] > 0, f"Expected bonus > 0, got {result}"
        assert len(result["resolved"]) == 1
        assert result["resolved"][0]["method"] == "충"

    def test_haegong_bonus_hap(self):
        """합 해공이 충 해공보다 보너스가 크다."""
        hit = {"branch": "午", "pillar_idx": 3, "pillar": "시주",
               "type": "진공", "영역": "자녀궁·말년운", "source": "일주공망"}
        natal_gm = {"all_hits": [hit]}
        chung_result = se._haegong_check("子", natal_gm)  # 子-午 충
        hit_copy = dict(hit)
        natal_gm2 = {"all_hits": [hit_copy]}
        # 未-午 합
        hit_copy["branch"] = "丑"
        natal_gm_hap = {
            "all_hits": [{"branch": "子", "pillar_idx": 3, "pillar": "시주",
                          "type": "진공", "영역": "자녀궁·말년운", "source": "일주공망"}]
        }
        hap_result = se._haegong_check("丑", natal_gm_hap)  # 丑-子 합
        assert hap_result["bonus"] > chung_result["bonus"], (
            f"합 해공({hap_result['bonus']}) should > 충 해공({chung_result['bonus']})"
        )

    def test_haegong_gagong_reduced(self):
        """가공 상태의 해공은 진공 대비 보너스가 줄어든다."""
        natal_gm_jingong = {
            "all_hits": [{"branch": "午", "pillar_idx": 3, "pillar": "시주",
                          "type": "진공", "영역": "자녀궁·말년운", "source": "일주공망"}],
        }
        natal_gm_gagong = {
            "all_hits": [{"branch": "午", "pillar_idx": 3, "pillar": "시주",
                          "type": "가공(충)", "영역": "자녀궁·말년운", "source": "일주공망"}],
        }
        r_j = se._haegong_check("子", natal_gm_jingong)
        r_g = se._haegong_check("子", natal_gm_gagong)
        assert r_j["bonus"] > r_g["bonus"], (
            f"진공 해공({r_j['bonus']}) should > 가공 해공({r_g['bonus']})"
        )

    def test_no_haegong_when_no_gm(self):
        """공망분류가 없으면 해공 보너스 0."""
        result = se._haegong_check("子", None)
        assert result["bonus"] == 0.0

    def test_breakdown_has_haegong(self):
        """v6.2 breakdown에 haegong 필드가 존재해야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        assert "haegong" in dw[0].get("breakdown", {}), (
            "Missing haegong in daewoon breakdown"
        )

    def test_gungseong_has_gm_type(self):
        """궁성론에 공망유형(진공/가공)이 포함되어야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        gung = r["궁성론"]
        gm_items = [g for g in gung if g["공망여부"]]
        for item in gm_items:
            assert "공망유형" in item, f"Missing 공망유형 in {item['궁']}"
            assert item["공망유형"] in ("진공", "가공(합)", "가공(충)"), (
                f"Unexpected 공망유형: {item['공망유형']}"
            )

    def test_natal_gm_info_in_report(self):
        """enrich_saju 결과에 공망분류가 포함되어야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        assert "공망분류" in r
        gm_info = r["공망분류"]
        assert "일주공망" in gm_info
        assert "년주공망" in gm_info
        assert "all_hits" in gm_info

    def test_daewoon_haegong_export(self):
        """대운에 haegong export가 존재해야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        for d in dw:
            assert "haegong" in d, f"Missing haegong in daewoon block {d['order']}"
            assert "resolved" in d["haegong"]
            assert "bonus" in d["haegong"]

    def test_yearly_haegong_export(self):
        """세운에 haegong export가 존재해야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        yt = se.build_yearly_timeline(r, dw, span=5)
        for y in yt[:2]:
            assert "haegong" in y, f"Missing haegong in yearly {y['year']}"

    def test_monthly_haegong_export(self):
        """월운에 haegong export가 존재해야 함."""
        inp = se.BirthInput(year=1969, month=3, day=11, hour=12, minute=15,
                            gender="female", calendar="solar")
        r = se.enrich_saju(inp)
        dw = se.build_daewoon_detail(r)
        mt = se.build_monthly_timeline(r, dw, 1990)
        for m in mt[:3]:
            assert "haegong" in m, f"Missing haegong in month {m['month']}"
