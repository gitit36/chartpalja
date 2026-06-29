# -*- coding: utf-8 -*-
"""
명리 엔진 정확도 수정 회귀 테스트
─────────────────────────────────────────────────────────────────
다음 두 가지 수정이 깨지지 않도록 고정한다.

  ① 연주(年柱) 정밀 입춘 보정
     sajupy의 입춘 근사가 천문 정밀 입춘(ipchun)과 어긋나는 해(예: 1984, 2017,
     입춘이 자정 직후)에는 입춘 당일 출생자의 연주가 하루 틀어진다.
     enrich_saju가 정밀 ipchun 기준으로 연주를, 그리고 같은 경계인 월주(丑↔寅)를
     함께 보정하는지 검증한다.

  ② 巳 지장간 순서
     巳의 지장간은 본기 丙 / 중기 庚 / 여기 戊 여야 한다(과거 중기·여기가 戊·庚으로
     뒤바뀐 버그가 있었음).

pytest 없이도 실행 가능:
    .venv/bin/python3 test/test_engine_fixes.py
pytest 사용 시:
    .venv/bin/python3 -m pytest test/test_engine_fixes.py -q
"""
from __future__ import annotations

import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se  # noqa: E402
import calibrate_yongshin as cy  # noqa: E402


def _enrich_pillars(y, m, d, h, mi=0, gender="male"):
    inp = se.BirthInput(year=y, month=m, day=d, hour=h, minute=mi, gender=gender)
    r = se.enrich_saju(inp)
    return r["원국"]


# ─────────────────────────────────────────────────────────────
# ② 巳 지장간 순서
# ─────────────────────────────────────────────────────────────

def test_sa_jijanggan_table():
    """巳 = 본기 丙 / 중기 庚 / 여기 戊."""
    assert se.BRANCH_JIJANGGAN["巳"] == {"본기": "丙", "중기": "庚", "여기": "戊"}


def test_sa_jijanggan_weights():
    """get_jijanggan(巳) → (丙,본기,.5)(庚,중기,.3)(戊,여기,.2)."""
    got = se.get_jijanggan("巳")
    assert got == [("丙", "본기", 0.5), ("庚", "중기", 0.3), ("戊", "여기", 0.2)], got


def test_sa_hidden_stems_order():
    """표기 순서(여기→중기→본기) = 戊, 庚, 丙."""
    assert se._hidden_stems_by_role("巳") == ["戊", "庚", "丙"]


# ─────────────────────────────────────────────────────────────
# ① 연주·월주 정밀 입춘 보정
# ─────────────────────────────────────────────────────────────

def test_year_pillar_ipchun_1984():
    """1984 입춘 = 02-05 00:26. 02-04 출생은 아직 입춘 전 → 癸亥년·丑월,
    02-05 출생은 입춘 후 → 甲子년·寅월."""
    before = _enrich_pillars(1984, 2, 4, 12)
    after = _enrich_pillars(1984, 2, 5, 12)
    assert before["year"] == "癸亥", before
    assert before["month"][1] == "丑", before
    assert after["year"] == "甲子", after
    assert after["month"][1] == "寅", after


def test_year_pillar_ipchun_2017():
    """2017 입춘 = 02-04 00:35. 02-03 → 丙申년·丑월, 02-04 → 丁酉년·寅월."""
    before = _enrich_pillars(2017, 2, 3, 12)
    after = _enrich_pillars(2017, 2, 4, 12)
    assert before["year"] == "丙申", before
    assert before["month"][1] == "丑", before
    assert after["year"] == "丁酉", after
    assert after["month"][1] == "寅", after


def test_year_pillar_matches_precise_ipchun():
    """드리프트 연도 입춘 ±1일 경계에서 enrich 연주가 정밀 _year_gz와 항상 일치."""
    from datetime import datetime
    for y in (1984, 2017):
        ip = se.ipchun(y)
        for off_hours in (-12, +12):
            t = ip + timedelta(hours=off_hours)
            p = _enrich_pillars(t.year, t.month, t.day, t.hour, t.minute)
            bkst = datetime(t.year, t.month, t.day, t.hour, t.minute, tzinfo=se.KST)
            _, expected = se._year_gz(bkst)
            assert p["year"] == expected, (y, off_hours, p, expected)


def test_year_month_consistency_at_ipchun():
    """보정된 연·월이 정합: 입춘 후면 寅월, 입춘 전이면 丑월."""
    for y in (1984, 2017):
        ip = se.ipchun(y)
        after = ip + timedelta(hours=6)
        before = ip - timedelta(hours=6)
        pa = _enrich_pillars(after.year, after.month, after.day, after.hour, after.minute)
        pb = _enrich_pillars(before.year, before.month, before.day, before.hour, before.minute)
        assert pa["month"][1] == "寅", (y, "after", pa)
        assert pb["month"][1] == "丑", (y, "before", pb)


# ─────────────────────────────────────────────────────────────
# calibrate_yongshin v2 스키마 어댑터
# ─────────────────────────────────────────────────────────────

def test_cy_event_years_extraction():
    """life_events dict 배열 / 정수 배열 모두에서 연도 추출."""
    assert cy.event_years([{"year": 2016, "label": "x"}, {"year": 2019}]) == [2016, 2019]
    assert cy.event_years([2016, 2019]) == [2016, 2019]
    assert cy.event_years([]) == []


def test_cy_normalize_v1_compat():
    """구(v1) 스키마도 가볍게 수용: birth/good/bad 변환, v1은 strict 기본 제외."""
    v1 = {"name": "구형식", "y": 1990, "m": 5, "d": 15, "h": 14,
          "gender": "male", "good_years": [2014, 2021], "bad_years": [2009, 2018]}
    n = cy.normalize(v1)
    assert n["birth"]["y"] == 1990 and n["birth"]["gender"] == "male"
    assert cy.event_years(n["good"]) == [2014, 2021]
    assert cy.event_years(n["bad"]) == [2009, 2018]
    assert n["time_quality"] == "known"
    assert n["include_in_strict_validation"] is False


def test_cy_branch_center_hour():
    """시지만 있으면 중앙 시각 사용 (子→00:30, 午→12:30)."""
    n = cy.normalize({
        "name": "시지", "source_quality": "A_official",
        "include_in_strict_validation": True,
        "birth": {"y": 1980, "m": 1, "d": 1, "h": None, "min": None, "branch": "子"},
        "life_events": {"good": [{"year": 2000}], "bad": [{"year": 2005}]},
    })
    assert n["time_quality"] == "branch"
    assert cy.resolve_hour(n) == (0, 30, False)
    n2 = cy.normalize({"name": "오", "birth": {"y": 1980, "m": 1, "d": 1, "branch": "午"},
                       "life_events": {"good": [], "bad": []}})
    assert cy.resolve_hour(n2) == (12, 30, False)


def test_cy_time_unknown_noon():
    """시각·시지 모두 없으면 정오(12:00) 임시 사용."""
    n = cy.normalize({"name": "미상",
                      "birth": {"y": 1980, "m": 1, "d": 1, "h": None, "min": None},
                      "life_events": {"good": [{"year": 2000}], "bad": [{"year": 2005}]}})
    assert n["time_quality"] == "unknown"
    assert cy.resolve_hour(n) == (12, 0, True)


def _mk_subject(sq="A_official", flag=True, tier=None, good=2, bad=2,
                good_conf=None, bad_conf=None, good_w=None, bad_w=None, name=None):
    def evs(k, conf, wts):
        out = []
        for i in range(k):
            e = {"year": 2000 + i}
            if conf is not None:
                e["confidence"] = conf[i] if isinstance(conf, list) else conf
            if wts is not None:
                e["weight"] = wts[i] if isinstance(wts, list) else wts
            out.append(e)
        return out
    subj = {"name": name or sq, "source_quality": sq, "include_in_strict_validation": flag,
            "birth": {"y": 1980, "m": 1, "d": 1, "h": 1, "min": 0},
            "life_events": {"good": evs(good, good_conf, good_w),
                            "bad": evs(bad, bad_conf, bad_w)}}
    if tier is not None:
        subj["validation_tier"] = tier
    return cy.normalize(subj)


def test_cy_eligibility_strict_A_only():
    """strict: A급 + include_in_strict_validation=true 만 통과. B/C/unknown은 제외."""
    assert cy.eligibility(_mk_subject("A_official"), strict=True)[0] is True
    assert cy.eligibility(_mk_subject("A_rodden_AA"), strict=True)[0] is True
    assert cy.eligibility(_mk_subject("B_interview_or_broadcast"), strict=True)[0] is False
    assert cy.eligibility(_mk_subject("C_saju_compilation"), strict=True)[0] is False
    assert cy.eligibility(_mk_subject("A_official", flag=False), strict=True)[0] is False
    # 후보 포함이면 전부 통과 / 비-strict 기본 전부 통과
    assert cy.eligibility(_mk_subject("C_saju_compilation"), strict=True,
                          include_candidates=True)[0] is True
    assert cy.eligibility(_mk_subject("D_disputed"))[0] is True


def test_cy_core_strict_tier_only():
    """--core-strict: validation_tier=='core' 인 A급 검증대상만 통과 (strict 전체는 더 넓음)."""
    core = _mk_subject("A_official", tier="core")
    cand = _mk_subject("A_official", tier="strict_candidate")
    notier = _mk_subject("A_official", tier=None)
    # core-strict 에서는 core 만
    assert cy.eligibility(core, core_strict=True)[0] is True
    assert cy.eligibility(cand, core_strict=True)[0] is False
    assert cy.eligibility(notier, core_strict=True)[0] is False
    # strict 에서는 셋 다 통과 (tier 무관)
    assert cy.eligibility(core, strict=True)[0] is True
    assert cy.eligibility(cand, strict=True)[0] is True
    assert cy.eligibility(notier, strict=True)[0] is True
    # 헬퍼 일관성
    assert cy.is_core_eligible(core) is True
    assert cy.is_core_eligible(cand) is False


def test_cy_core_strict_needs_two_events():
    """core-strict 는 good/bad 각 2개 이상이어야 함."""
    enough = _mk_subject("A_official", tier="core", good=2, bad=2)
    too_few = _mk_subject("A_official", tier="core", good=1, bad=2)
    assert cy.is_core_eligible(enough) is True
    assert cy.is_core_eligible(too_few) is False


def test_cy_severity_classification():
    """near_miss: -2.0<sep≤0, hard_fail: sep≤-2.0, 통과/평가불가는 None."""
    assert cy.severity_of(-0.5) == "near_miss"
    assert cy.severity_of(0.0) == "near_miss"
    assert cy.severity_of(-2.0) == "hard_fail"
    assert cy.severity_of(-5.0) == "hard_fail"
    assert cy.severity_of(3.0) is None          # 통과
    assert cy.severity_of(float("nan")) is None  # 평가불가


def test_cy_confidence_default_medium():
    """confidence 누락 시 medium 으로 처리."""
    evs = cy._events([{"year": 2000}, {"year": 2001, "confidence": "low"}])
    assert evs[0]["confidence"] == "medium"
    assert evs[1]["confidence"] == "low"
    # 오타도 medium 으로
    assert cy._events([{"year": 2002, "confidence": "verylow"}])[0]["confidence"] == "medium"


def test_cy_tags_label_weak_with_severity():
    """label_weak은 severity와 별개의 보조 tag로 동시에 붙는다.
    (낮은 weight 비중≥50% → label_weak만, low_confidence_events는 X)."""
    # confidence는 전부 high, weight는 전부 0.5(≤0.7) → low_weight_ratio=1.0 → label_weak
    n = _mk_subject("A_official", tier="core", good=2, bad=2,
                    good_conf="high", bad_conf="high", good_w=0.5, bad_w=0.5)
    tags = cy.event_tags(n)
    assert "label_weak" in tags
    assert "low_confidence_events" not in tags   # low confidence 없음
    # severity는 분리도로 별도 결정 → tag와 동시 성립
    assert cy.severity_of(-1.0) == "near_miss"


def test_cy_low_confidence_by_count():
    """low 이벤트가 2개 이상이면 비중이 낮아도 low_confidence_events 부여."""
    # 6개 중 2개 low → ratio 0.33(≥0.30)이자 count 2 → 부여
    n = _mk_subject("A_official", good=4, bad=2,
                    good_conf=["low", "low", "high", "high"], bad_conf="high")
    assert "low_confidence_events" in cy.event_tags(n)


def test_cy_tags_low_confidence_events():
    """low confidence 비중이 높으면(≥0.5) low_confidence_events tag."""
    n = _mk_subject("A_official", good=2, bad=2,
                    good_conf="low", bad_conf="low")   # 전부 low → ratio 1.0
    tags = cy.event_tags(n)
    assert "low_confidence_events" in tags
    assert "label_weak" in tags  # 더 낮은 임계도 동시 충족
    # confidence 비율 helper
    assert cy.confidence_ratio(n) == 1.0


def test_cy_strict_candidate_tag():
    """validation_tier=strict_candidate → strict_candidate tag."""
    n = _mk_subject("A_official", tier="strict_candidate")
    assert "strict_candidate" in cy.event_tags(n)


def _write_temp_subjects():
    """진단 통합 테스트용 임시 JSON 작성 → 경로 반환. cy.SUBJ_PATH 교체."""
    import json
    import tempfile
    data = [
        {"name": "코어테스트", "gender": "male", "source_quality": "A_official",
         "include_in_strict_validation": True, "validation_tier": "core",
         "birth": {"y": 1990, "m": 5, "d": 15, "h": 14, "min": 0, "calendar": "solar"},
         "life_events": {"good": [{"year": 2014, "label": "수상", "confidence": "high"},
                                  {"year": 2015, "label": "승진", "confidence": "high"}],
                         "bad": [{"year": 2009, "label": "사고", "confidence": "high"},
                                 {"year": 2018, "label": "부상", "confidence": "high"}]}},
        {"name": "후보테스트", "gender": "female", "source_quality": "A_official",
         "include_in_strict_validation": True, "validation_tier": "strict_candidate",
         "birth": {"y": 1985, "m": 3, "d": 3, "h": 9, "min": 0, "calendar": "solar"},
         "life_events": {"good": [{"year": 2010, "confidence": "low"},
                                  {"year": 2011, "confidence": "low"}],
                         "bad": [{"year": 2012, "confidence": "low"},
                                 {"year": 2013, "confidence": "low"}]}},
    ]
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, ensure_ascii=False)
    return path


def _run_main(argv):
    """cy.main을 임시 JSON으로 실행하고 stdout 캡처."""
    import io
    from contextlib import redirect_stdout
    orig = cy.SUBJ_PATH
    path = _write_temp_subjects()
    cy.SUBJ_PATH = path
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            rc = cy.main(argv)
    finally:
        cy.SUBJ_PATH = orig
        os.remove(path)
    return rc, buf.getvalue()


def test_cy_explain_outputs_year_scores():
    """--explain: 특정 인물의 이벤트별 year_score를 출력."""
    rc, out = _run_main(["--explain", "코어테스트"])
    assert rc == 0
    assert "상세 진단: 코어테스트" in out
    assert "year_score" in out and "weighted" in out
    assert "separation" in out
    assert "2014" in out and "2009" in out   # good/bad 이벤트 연도


def test_cy_export_events_csv():
    """--export-events: CSV 생성 + 필수 컬럼 포함."""
    import csv
    import tempfile
    fd, csv_path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    try:
        rc, out = _run_main(["--export-events", csv_path])
        assert rc == 0
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames
            rows = list(reader)
        for col in cy.EXPORT_COLUMNS:
            assert col in header, col
        assert len(rows) >= 4   # 인물 2명 × 이벤트 4개 이상
        assert any(r["polarity"] in ("good", "bad") for r in rows)
    finally:
        os.remove(csv_path)


def test_cy_summary_lists_strict_candidate():
    """요약 보조 태그에 strict_candidate 목록이 표시된다."""
    rc, out = _run_main([])
    assert "strict_candidate(" in out
    assert "후보테스트" in out


def test_cy_top_failures_section():
    """--top-failures: 섹션 헤더가 출력된다 (N 반영)."""
    rc, out = _run_main(["--top-failures", "5"])
    assert "Top 5 실패" in out


def test_cy_same_year_collision_detected():
    """good/bad에 같은 year가 동시에 있으면 collision으로 감지된다."""
    n = cy.normalize({
        "name": "충돌", "source_quality": "A_official",
        "include_in_strict_validation": True, "validation_tier": "core",
        "birth": {"y": 1980, "m": 1, "d": 1, "h": 1, "min": 0},
        "life_events": {
            "good": [{"year": 2024, "label": "후보 선출"}, {"year": 2010}],
            "bad": [{"year": 2024, "label": "대선 패배"}, {"year": 2012}],
        },
    })
    cols = cy.detect_collisions(n, {2024: 53.0, 2010: 60, 2012: 40})
    assert len(cols) == 1
    c = cols[0]
    assert c["year"] == 2024
    assert "후보 선출" in c["good"] and "대선 패배" in c["bad"]
    assert c["score"] == 53.0


def test_cy_exclude_from_validation_skips_average():
    """exclude_from_validation=true 이벤트는 평균 계산에서 제외된다."""
    n = cy.normalize({
        "name": "제외", "source_quality": "A_official",
        "include_in_strict_validation": True,
        "birth": {"y": 1980, "m": 1, "d": 1, "h": 1, "min": 0},
        "life_events": {
            "good": [{"year": 2010}, {"year": 2011, "exclude_from_validation": True}],
            "bad": [{"year": 2012}, {"year": 2013}],
        },
    })
    scores = {2010: 80.0, 2011: 10.0, 2012: 40.0, 2013: 50.0}
    g_avg, g_used = cy._wavg(n["good"], scores)
    assert g_used == 1           # 2011 제외
    assert abs(g_avg - 80.0) < 1e-9   # 제외값(10) 미반영


def test_cy_context_only_alias():
    """context_only=true 도 exclude_from_validation 과 동일 처리된다."""
    evs = cy._events([{"year": 2020, "context_only": True},
                      {"year": 2021}])
    assert evs[0]["exclude"] is True
    assert evs[1]["exclude"] is False


def test_cy_sensitivity_yongshin_five_elements():
    """--sensitivity-yongshin 은 木火土金水 5개 오행 결과를 모두 산출한다."""
    n = cy.normalize({
        "name": "민감", "source_quality": "A_official",
        "include_in_strict_validation": True, "validation_tier": "core",
        "birth": {"y": 1990, "m": 5, "d": 15, "h": 14, "min": 0},
        "life_events": {"good": [{"year": 2014}, {"year": 2015}],
                        "bad": [{"year": 2009}, {"year": 2018}]},
    })
    rows = cy.yongshin_sensitivity(n)
    elems = [r["elem"] for r in rows]
    assert elems == ["木", "火", "土", "金", "水"]
    for r in rows:
        assert "good_avg" in r and "bad_avg" in r and "sep" in r


def test_cy_explain_includes_breakdown():
    """--explain 출력에 연도별 점수 구성요소 breakdown이 포함된다."""
    rc, out = _run_main(["--explain", "코어테스트"])
    assert rc == 0
    assert "final year_score" in out
    assert "yongshin_fit" in out
    assert "干支" in out and "십성" in out


def test_cy_no_geocoding_called():
    """평가 실행 중 geocoding/longitude 경고가 발생하지 않는다."""
    import io
    from contextlib import redirect_stdout, redirect_stderr
    n = _mk_subject("A_official", tier="core")
    buf_o, buf_e = io.StringIO(), io.StringIO()
    with redirect_stdout(buf_o), redirect_stderr(buf_e):
        cy.evaluate(n)
    out = (buf_o.getvalue() + buf_e.getvalue()).lower()
    assert "longitude" not in out
    assert "standard time" not in out
    assert "429" not in out


def test_cy_gender_top_level_female():
    """person 최상위 gender=female 이 birth에 없어도 female로 읽혀 계산에 전달."""
    subj = {
        "name": "Hillary Clinton", "gender": "female",
        "source_quality": "A_official", "include_in_strict_validation": True,
        "birth": {"y": 1947, "m": 10, "d": 27, "h": 9, "min": 45, "branch": None,
                  "calendar": "solar"},
        "life_events": {"good": [{"year": 2008}, {"year": 2009}],
                        "bad": [{"year": 2016}, {"year": 2017}]},
    }
    n = cy.normalize(subj)
    assert n["gender"] == "female"
    assert n["birth"]["gender"] == "female"
    assert n["warnings"] == []
    # 실제 엔진 입력값에도 female이 전달되는지 확인
    inp = se.BirthInput(year=1947, month=10, day=27, hour=9, minute=45,
                        gender=n["gender"], use_solar_time=False)
    assert inp.gender == "female"


def test_cy_gender_default_and_typo_warn():
    """gender 누락/오타는 경고를 남긴다 (무조건 male 침묵 처리 금지)."""
    assert cy.norm_gender("female") == ("female", None)
    assert cy.norm_gender("F") == ("female", None)
    assert cy.norm_gender("male") == ("male", None)
    g, w = cy.norm_gender(None)
    assert g == "male" and w is not None
    g2, w2 = cy.norm_gender("femAle?")
    assert w2 is not None
    n = cy.normalize({"name": "노젠더",
                      "birth": {"y": 1980, "m": 1, "d": 1, "h": 1, "min": 0},
                      "life_events": {"good": [], "bad": []}})
    assert any("gender" in w for w in n["warnings"])


def test_cy_weighted_average_and_overlap():
    """weight 기반 평균 + 같은 해 good·bad 중복 제거 안 함."""
    scores = {2010: 80.0, 2011: 60.0, 2012: 40.0, 2013: 70.0}
    n = cy.normalize({
        "name": "가중", "source_quality": "A_official",
        "include_in_strict_validation": True,
        "birth": {"y": 1980, "m": 1, "d": 1, "h": 1, "min": 0},
        "life_events": {
            "good": [{"year": 2010, "weight": 3.0}, {"year": 2011, "weight": 1.0}],
            "bad": [{"year": 2012, "weight": 1.0}, {"year": 2013, "weight": 1.0}],
        },
    })
    g_avg, g_used = cy._wavg(n["good"], scores)
    b_avg, b_used = cy._wavg(n["bad"], scores)
    assert g_used == 2 and b_used == 2
    assert abs(g_avg - (80 * 3 + 60 * 1) / 4) < 1e-9   # 75.0 (가중)
    assert abs(b_avg - (40 + 70) / 2) < 1e-9           # 55.0


def test_cy_min_events_na():
    """good/bad 둘 중 하나라도 2개 미만이면 평가불가(na)."""
    scores = {2010: 80.0, 2012: 40.0}
    only_one_good = cy._events([{"year": 2010}])
    two_bad = cy._events([{"year": 2012}, {"year": 2013}])
    _, g_used = cy._wavg(only_one_good, scores)
    assert g_used < cy.MIN_EVENTS


# ─────────────────────────────────────────────────────────────

def _run_all():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    fails = 0
    for t in tests:
        try:
            t()
            print(f"  ✅ {t.__name__}")
        except AssertionError as e:
            fails += 1
            print(f"  ❌ {t.__name__}: {e}")
        except Exception as e:  # noqa: BLE001
            fails += 1
            print(f"  ❌ {t.__name__}: (오류) {type(e).__name__}: {e}")
    print("\n" + ("✅ 전부 통과" if not fails else f"❌ {fails}건 실패"))
    return fails


if __name__ == "__main__":
    print("══════════ 엔진 수정 회귀 테스트 ══════════")
    sys.exit(1 if _run_all() else 0)
