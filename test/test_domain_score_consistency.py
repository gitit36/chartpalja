# -*- coding: utf-8 -*-
"""도메인/총운 점수 정합성 — 체인·bias·구신·스키마 버전."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se


def _sample_report(**kwargs):
    defaults = dict(year=1997, month=3, day=6, hour=3, minute=25, gender="male")
    defaults.update(kwargs)
    return se.compute_all(se.BirthInput(**defaults))


def _year_row(r, year: int):
    chart = se.build_chart_payload(r, include_monthly_year=year)
    yd = next(y for y in chart["연도별_타임라인"] if y["year"] == year)
    months = (chart.get("월운_타임라인") or {}).get("data") or []
    return chart, yd, months


class TestDomainChain:
    def test_monthly_closer_to_year_than_daewoon(self):
        """월운 도메인은 대운보다 해당 연 세운에 더 가깝다."""
        r = _sample_report()
        year = 2026
        chart, yd, months = _year_row(r, year)
        assert months, "월운 필요"
        dw = next(
            d for d in chart["대운기둥10"]
            if d["start_year"] <= year < d["end_year"]
        )
        y_job = float(yd["scores"]["직업"])
        dw_job = float(dw["domainScore"]["직업"])
        # 12개월 평균
        m_avg = sum(float(m["scores"]["직업"]) for m in months) / len(months)
        dist_year = abs(m_avg - y_job)
        dist_dw = abs(m_avg - dw_job)
        assert dist_year <= dist_dw + 0.35, (
            f"month_avg={m_avg:.2f} year={y_job:.2f} dw={dw_job:.2f}"
        )

    def test_year_month_daily_job_chain_stable(self):
        """세운→월운→일운 직업 점수가 급격히 점프하지 않는다."""
        r = _sample_report()
        year = 2026
        _, yd, months = _year_row(r, year)
        mw = next((m for m in months if int(m.get("month") or 0) == 7), months[0])
        d = se.build_daily_fortune(r, "2026-07-11")
        y100 = se._domain_10_to_100(float(yd["scores"]["직업"]))
        m100 = se._domain_10_to_100(float(mw["scores"]["직업"]))
        day = float(d["운세도메인"]["직업"])
        assert abs(m100 - y100) <= 30, f"year={y100} month={m100}"
        assert abs(day - m100) <= 25, f"month={m100} day={day}"

    def test_soft_clamp_false_allows_extremes_for_chain(self):
        base = {"직업": 9.5, "재물": 5.0, "건강": 2.0, "연애": 5.0, "결혼": 5.0}
        yfit = {"용신부합": 1.0, "희신부합": 0.5, "기신부합": 0.0, "구신부합": 0.0}
        raw = se._refine_domain_scores(
            base, yfit, ["정관"], [], soft_clamp=False, **se._SW_DOMAIN_W
        )
        clamped = se._refine_domain_scores(
            base, yfit, ["정관"], [], soft_clamp=True, **se._SW_DOMAIN_W
        )
        # raw는 soft_clamp 상한(≈8+여유)보다 클 수 있음
        assert raw["직업"] >= clamped["직업"] - 0.05


class TestDomainBiasAndGu:
    def test_domain_10_to_100_applies_score_bias(self):
        bias = se._SCORE_BIAS
        assert se._domain_10_to_100(5.0) == max(0, min(100, 50 + bias))
        assert se._domain_10_to_100(5.0, apply_bias=False) == 50.0

    def test_daily_domains_include_bias_vs_month(self):
        r = _sample_report()
        chart = se.build_chart_payload(r, include_monthly_year=2026)
        months = chart["월운_타임라인"]["data"]
        mw = next((m for m in months if int(m.get("month") or 0) == 7), months[0])
        d = se.build_daily_fortune(r, "2026-07-11")
        expected = se._domain_10_to_100(float(mw["scores"]["직업"]))
        # 일진 보정 허용 오차
        assert abs(float(d["운세도메인"]["직업"]) - expected) <= 25

    def test_gushin_penalty_lowers_domain(self):
        base = {"직업": 6.0, "재물": 6.0, "건강": 6.0, "연애": 6.0, "결혼": 6.0}
        yfit0 = {"용신부합": 0.0, "희신부합": 0.0, "기신부합": 0.0, "구신부합": 0.0}
        yfit_gu = {"용신부합": 0.0, "희신부합": 0.0, "기신부합": 0.0, "구신부합": 1.0}
        a = se._refine_domain_scores(base, yfit0, [], [], **se._SW_DOMAIN_W)
        b = se._refine_domain_scores(base, yfit_gu, [], [], **se._SW_DOMAIN_W)
        assert b["직업"] < a["직업"]
        assert b["재물"] < a["재물"]


class TestSchemaAndComposite:
    def test_chart_meta_schema_version(self):
        r = _sample_report()
        chart = se.build_chart_payload(r)
        meta = chart["meta"]
        assert meta["scoreSchemaVersion"] == se.SCORE_SCHEMA_VERSION
        assert meta["scoreBias"] == se._SCORE_BIAS
        assert meta["domainScale"] == "0-10-engine"

    def test_composite_hierarchy_still_holds(self):
        r = _sample_report()
        d = se.build_daily_fortune(r, "2026-07-11")
        bd = d["breakdown"]
        expected = (
            bd["monthly_base"] * bd["blend_mw"]
            + bd["daily_independent"] * bd["blend_daily"]
            + bd["synergy"]
        )
        assert abs(d["점수"] - expected) < 1.5

    def test_no_double_anchor_on_sewoon(self):
        base = {"직업": 8.0, "재물": 5.0, "건강": 4.0, "연애": 6.0, "결혼": 5.0}
        yfit = {"용신부합": 0.0, "희신부합": 0.0, "기신부합": 0.0, "구신부합": 0.0}
        with_re = se._refine_domain_scores(base, yfit, [], [], reanchor=True)
        no_re = se._sewoon_domain_scores(base, yfit, [], [])
        assert abs(no_re["직업"] - 8.0) < 0.2
        assert with_re["직업"] < no_re["직업"]

    def test_multi_birth_samples_domains_in_range(self):
        samples = [
            dict(year=1990, month=1, day=15, hour=9, minute=0, gender="female"),
            dict(year=1985, month=8, day=22, hour=14, minute=30, gender="male"),
            dict(year=2001, month=12, day=3, hour=None, minute=0, gender="female"),
        ]
        for kw in samples:
            if kw["hour"] is None:
                inp = se.BirthInput(
                    year=kw["year"], month=kw["month"], day=kw["day"],
                    hour=12, minute=0, gender=kw["gender"],
                )
                # time unknown path if supported — fall back to noon
                r = se.compute_all(inp)
            else:
                r = _sample_report(**kw)
            chart, yd, months = _year_row(r, 2026)
            for dname in ("직업", "재물", "건강", "연애", "결혼"):
                v = float(yd["scores"][dname])
                assert 0 <= v <= 10.5, f"{kw} year {dname}={v}"
            if months:
                for m in months:
                    for dname in ("직업", "재물", "건강", "연애", "결혼"):
                        v = float(m["scores"][dname])
                        assert 0 <= v <= 10.5, f"{kw} month {dname}={v}"
            daily = se.build_daily_fortune(r, "2026-07-11")
            for k, v in daily["운세도메인"].items():
                assert 0 <= int(v) <= 100, f"{kw} daily {k}={v}"


class TestDomainDisplayRoundtrip:
    def test_bias_roundtrip_math(self):
        """클라 domain100ToEngine10 ↔ domain10To100 왕복."""
        bias = se._SCORE_BIAS
        for eng in (2.0, 5.0, 7.3, 9.0):
            ui = se._domain_10_to_100(eng)
            back = max(0.0, min(10.0, (ui - bias) / 10.0))
            assert abs(back - eng) < 0.05, f"eng={eng} ui={ui} back={back}"
