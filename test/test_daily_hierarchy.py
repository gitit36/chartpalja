# -*- coding: utf-8 -*-
"""일운 v6.5 계층 점수: 월운종합 + 일운독립 + 시너지."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se


def _sample_report():
    inp = se.BirthInput(
        year=1997, month=3, day=6, hour=3, minute=25, gender="male"
    )
    return se.compute_all(inp)


class TestDailyHierarchy:
    def test_blend_breakdown_present(self):
        r = _sample_report()
        d = se.build_daily_fortune(r, "2026-07-11")
        bd = d["breakdown"]
        assert "monthly_base" in bd
        assert "daily_independent" in bd
        assert "synergy" in bd
        assert 0 <= d["점수"] <= 100
        upper = d["상위운"]
        assert upper["월운종합"] == bd["monthly_base"]
        assert upper["일운독립"] == bd["daily_independent"]

    def test_yongshin_fit_is_graded(self):
        r = _sample_report()
        d = se.build_daily_fortune(r, "2026-07-11")
        detail = d["용신부합_상세"]
        assert "용신부합_천간" in detail
        assert "용신부합_지지" in detail
        for k in ("용신부합", "희신부합", "기신부합", "구신부합"):
            assert 0.0 <= float(detail[k]) <= 1.0

    def test_upper_relations_keys_exist(self):
        r = _sample_report()
        d = se.build_daily_fortune(r, "2026-07-11")
        assert "관계_with_대운" in d
        assert "관계_with_세운" in d
        assert "관계_with_월운" in d
        assert isinstance(d["관계_with_대운"], list)

    def test_score_near_monthly_base(self):
        """최종 점수는 월운 종합 근처에서 일진만큼 움직인다."""
        r = _sample_report()
        d = se.build_daily_fortune(r, "2026-07-11")
        mw = d["상위운"]["월운종합"]
        ind = d["상위운"]["일운독립"]
        # 혼합 가중 결과와 일치 (시너지 포함 ±5)
        expected = mw * d["breakdown"]["blend_mw"] + ind * d["breakdown"]["blend_daily"]
        assert abs(d["점수"] - (expected + d["breakdown"]["synergy"])) < 1.5

    def test_domains_are_0_100(self):
        r = _sample_report()
        d = se.build_daily_fortune(r, "2026-07-11")
        for k, v in d["운세도메인"].items():
            assert 0 <= int(v) <= 100, f"{k}={v}"
