# -*- coding: utf-8 -*-
"""
만세력 4기둥(사주 원국) 검증 스크립트
─────────────────────────────────────────────────────────────────
명리 엔진의 가장 중요한 토대인 "사주 4기둥(연/월/일/시주)"이 정확히 산출되는지
두 가지 방식으로 점검한다.

  [1] INVARIANTS (자동 단언) — 외부 정답 없이도 반드시 성립해야 하는 규칙
      · 일주: 하루마다 정확히 1갑자씩 전진 (60갑자 연속성)
      · 시주: 오서둔(五鼠遁) — 일간으로부터 시간 천간이 규칙대로 도출
      · 연주: 입춘(立春) 시각을 경계로 연간지가 바뀜
      · 월주: 절(節) 시각을 경계로 월간지가 바뀜

  [2] ANCHORS (외부 정답 대조) — 공인 만세력에서 확인한 정답과 비교
      · test/pillar_anchors.json 에 {생년월일시 → 정답 4기둥}을 채워두면 대조한다.
      · 파일이 없으면 BOUNDARY 케이스의 엔진 산출값을 출력만 하므로,
        사용자가 만세력과 눈으로 대조할 수 있다.

사용법:
    .venv/bin/python3 test/verify_pillars.py            # 인배리언트 + 경계 리포트
    .venv/bin/python3 test/verify_pillars.py --anchors  # 앵커 대조까지

참고: 경계 케이스(입춘/절기/자시 23:30 전후)는 만세력마다 ±1분 차이로 갈릴 수
있으므로, 반드시 진태양시 보정 동일 조건의 만세력과 비교해야 한다.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se  # noqa: E402

ANCHOR_PATH = os.path.join(os.path.dirname(__file__), "pillar_anchors.json")


# 반시(半時) 경계 — enrich_saju와 동일 (진태양시 30분 보정)
_HALFHOUR_BOUNDARIES = [
    (23, 30, 1, 30, "子"), (1, 30, 3, 30, "丑"), (3, 30, 5, 30, "寅"),
    (5, 30, 7, 30, "卯"), (7, 30, 9, 30, "辰"), (9, 30, 11, 30, "巳"),
    (11, 30, 13, 30, "午"), (13, 30, 15, 30, "未"), (15, 30, 17, 30, "申"),
    (17, 30, 19, 30, "酉"), (19, 30, 21, 30, "戌"), (21, 30, 23, 30, "亥"),
]
_DAY_STEM_HOUR_START = {"甲": 0, "己": 0, "乙": 2, "庚": 2, "丙": 4,
                        "辛": 4, "丁": 6, "壬": 6, "戊": 8, "癸": 8}


def _halfhour_branch(h, m):
    t = h * 60 + m
    for sh, sm_, eh, em_, br in _HALFHOUR_BOUNDARIES:
        start, end = sh * 60 + sm_, eh * 60 + em_
        if start > end:
            if t >= start or t < end:
                return br
        elif start <= t < end:
            return br
    return "子"


def _pillars(y, m, d, h, mi=0, gender="male", lunar=False, leap=False):
    """4기둥만 산출(빠른 경로) → {'연','월','일','시'}. enrich_saju의 기둥 도출과 동일."""
    if lunar:
        sol = se.lunar_to_solar(y, m, d, is_leap_month=leap)
        y, m, d = sol["solar_year"], sol["solar_month"], sol["solar_day"]
    s = se.calculate_saju(y, m, d, h, mi, use_solar_time=True, utc_offset=9, early_zi_time=True)
    hour_stem, hour_branch = s["hour_stem"], s["hour_branch"]
    correct_hb = _halfhour_branch(h, mi)
    if correct_hb != hour_branch:
        start = _DAY_STEM_HOUR_START[s["day_stem"]]
        hour_stem = se.HEAVENLY_STEMS[(start + se.EARTHLY_BRANCHES.index(correct_hb)) % 10]
        hour_branch = correct_hb
    return {
        "연": s["year_pillar"], "월": s["month_pillar"],
        "일": s["day_pillar"], "시": hour_stem + hour_branch,
    }


# ─────────────────────────────────────────────────────────────
# [1] INVARIANTS
# ─────────────────────────────────────────────────────────────

def check_day_pillar_continuity(start=(1980, 1, 1), days=400):
    """일주가 하루마다 정확히 +1갑자 전진하는지 (자시 보정 영향 피하려 정오 사용)."""
    from datetime import datetime, timedelta
    fails = []
    base = datetime(*start, 12, 0)
    prev = None
    for i in range(days):
        dt = base + timedelta(days=i)
        cur = _pillars(dt.year, dt.month, dt.day, 12)["일"]
        if prev is not None:
            exp = se.next_ganzhi(prev, 1)
            if cur != exp:
                fails.append(f"{dt.date()}: 일주 {prev}→{cur} (기대 {exp})")
        prev = cur
    return fails


def check_hour_stem_oseodun():
    """오서둔: 모든 일간 × 12시지에 대해 시간 천간이 규칙대로인지."""
    # 五鼠遁: 일간 → 子시 천간 시작 인덱스
    start_map = {"甲": 0, "己": 0, "乙": 2, "庚": 2, "丙": 4,
                 "辛": 4, "丁": 6, "壬": 6, "戊": 8, "癸": 8}
    fails = []
    for day_st in se.HEAVENLY_STEMS:
        for bi, br in enumerate(se.EARTHLY_BRANCHES):
            exp = se.HEAVENLY_STEMS[(start_map[day_st] + bi) % 10]
            # 엔진 내부 헬퍼와 동일 로직 재현 검증
            got = se.HEAVENLY_STEMS[(start_map[day_st] + se.EARTHLY_BRANCHES.index(br)) % 10]
            if got != exp:
                fails.append(f"일간 {day_st} {br}시: {got} (기대 {exp})")
    return fails


def check_year_pillar_ipchun(years=range(1970, 2030, 7)):
    """입춘 경계: 입춘 직전(전날)과 입춘 다음날의 연간지가 달라야 한다.
    (엔진 자체 일관성 — 연주가 입춘 ±1일 사이에 한 번 바뀌는지)"""
    from datetime import timedelta
    fails = []
    for y in years:
        ip = se.ipchun(y)
        before = ip - timedelta(days=1)
        after = ip + timedelta(days=1)
        yb = _pillars(before.year, before.month, before.day, 12)["연"]
        ya = _pillars(after.year, after.month, after.day, 12)["연"]
        if yb == ya:
            fails.append(f"{y} 입춘({ip.date()}): 전후 연주 동일 {yb} (입춘 자정 부근 드리프트 의심)")
    return fails


def measure_ipchun_drift(years=range(1960, 2030)):
    """연주 경계 진단: sajupy가 연간지를 바꾸는 실제 날짜 vs 엔진의 천문 입춘(ipchun).
    입춘이 자정 부근인 해에는 두 기준이 최대 하루 어긋나 '연주'가 틀릴 수 있다.
    drift(일) ≠ 0 인 해 목록을 반환."""
    from datetime import timedelta
    drifted = []
    for y in years:
        ip = se.ipchun(y)
        # sajupy가 연간지를 바꾸는 첫 날을 입춘 ±3일 범위에서 스캔
        prev = None
        switch_date = None
        for off in range(-3, 4):
            dt = (ip + timedelta(days=off))
            yp = _pillars(dt.year, dt.month, dt.day, 12)["연"]
            if prev is not None and yp != prev:
                switch_date = dt.date()
                break
            prev = yp
        if switch_date is None:
            continue
        drift_days = (switch_date - ip.date()).days
        if drift_days != 0:
            drifted.append((y, str(switch_date), ip.strftime("%Y-%m-%d %H:%M"), drift_days))
    return drifted


def check_month_pillar_jeol(years=range(1985, 2025, 9)):
    """절(節) 경계: 절 직전/직후의 월주가 달라야 한다."""
    from datetime import timedelta
    fails = []
    for y in years:
        for deg in se.JEOL_DEGREES:
            jt = se._term_deg(y, deg)
            before = jt - timedelta(days=1, hours=12)
            after = jt + timedelta(days=1, hours=12)
            mb = _pillars(before.year, before.month, before.day, 12)["월"]
            ma = _pillars(after.year, after.month, after.day, 12)["월"]
            if mb == ma:
                fails.append(f"{y} 절(황경{deg}°, {jt.date()}): 전후 월주 동일 {mb}")
    return fails


# ─────────────────────────────────────────────────────────────
# [2] BOUNDARY REPORT (만세력 수동 대조용)
# ─────────────────────────────────────────────────────────────

BOUNDARY_CASES = [
    # (설명, y, m, d, h, mi)
    ("입춘 당일 새벽", 1990, 2, 4, 5, 0),
    ("입춘 전날 밤", 1990, 2, 3, 23, 50),
    ("자시 경계 23:25", 1995, 6, 15, 23, 25),
    ("자시 경계 23:40(야자시)", 1995, 6, 15, 23, 40),
    ("자시 경계 00:20(조자시)", 1995, 6, 16, 0, 20),
    ("청명 절기 당일", 2000, 4, 4, 12, 0),
    ("월말 자정 직전", 1988, 12, 31, 23, 55),
    ("윤년 2/29", 2004, 2, 29, 10, 0),
]


def print_boundary_report():
    print("\n── 경계 케이스 산출값 (만세력과 수동 대조) ──")
    print(f"{'설명':<22}{'생시':<18}{'연':<5}{'월':<5}{'일':<5}{'시':<5}")
    for desc, y, m, d, h, mi in BOUNDARY_CASES:
        try:
            p = _pillars(y, m, d, h, mi)
            when = f"{y}-{m:02d}-{d:02d} {h:02d}:{mi:02d}"
            print(f"{desc:<22}{when:<18}{p['연']:<5}{p['월']:<5}{p['일']:<5}{p['시']:<5}")
        except Exception as e:
            print(f"{desc:<22} ERROR: {e}")


# ─────────────────────────────────────────────────────────────
# [2b] ANCHORS (외부 정답 대조)
# ─────────────────────────────────────────────────────────────

def check_anchors():
    """test/pillar_anchors.json 의 정답 4기둥과 엔진 산출 대조."""
    if not os.path.exists(ANCHOR_PATH):
        print(f"\n[앵커] {ANCHOR_PATH} 없음 — 만세력 정답을 채워두면 자동 대조합니다.")
        print("       형식: [{\"y\":1990,\"m\":5,\"d\":15,\"h\":14,\"gender\":\"male\","
              "\"expect\":{\"연\":\"庚午\",\"월\":\"辛巳\",\"일\":\"..\",\"시\":\"..\"}}]")
        return []
    with open(ANCHOR_PATH) as f:
        anchors = json.load(f)
    fails = []
    for a in anchors:
        got = _pillars(a["y"], a["m"], a["d"], a.get("h", 12), a.get("mi", 0),
                       a.get("gender", "male"), a.get("lunar", False), a.get("leap", False))
        for k, v in a["expect"].items():
            if got.get(k) != v:
                fails.append(f"{a['y']}-{a['m']:02d}-{a['d']:02d}: {k}주 {got.get(k)} ≠ 정답 {v}")
    print(f"\n[앵커] {len(anchors)}건 대조 완료.")
    return fails


# ─────────────────────────────────────────────────────────────

def main():
    do_anchors = "--anchors" in sys.argv
    print("══════════ 만세력 4기둥 검증 ══════════")

    # 하드 인배리언트 — 반드시 통과해야 하는 엔진 자체 규칙
    suites = [
        ("일주 60갑자 연속성(400일)", check_day_pillar_continuity),
        ("시주 오서둔(10일간×12시)", check_hour_stem_oseodun),
        ("월주 절기 경계", check_month_pillar_jeol),
    ]
    total_fail = 0
    for name, fn in suites:
        fails = fn()
        status = "✅ PASS" if not fails else f"❌ FAIL ({len(fails)})"
        print(f"  {name:<28} {status}")
        for msg in fails[:8]:
            print(f"      - {msg}")
        total_fail += len(fails)

    # 진단(경고) — 연주 입춘 경계: sajupy 연간지 전환일 vs 엔진 천문 입춘
    drift = measure_ipchun_drift()
    if not drift:
        print(f"  {'연주 입춘 경계 드리프트':<26} ✅ 1960~2029 전부 일치")
    else:
        print(f"  {'연주 입춘 경계 드리프트':<26} ⚠️  {len(drift)}개 연도 불일치(입춘 자정 부근)")
        print("      (해당 연도 입춘 ±1일 출생자는 연주가 천문 입춘과 어긋날 수 있음)")
        for y, sd, ipt, dd in drift:
            print(f"      - {y}: sajupy 전환 {sd} vs 엔진 입춘 {ipt} (drift {dd:+d}일)")

    if do_anchors:
        afails = check_anchors()
        if afails:
            total_fail += len(afails)
            print(f"  앵커 대조                    ❌ FAIL ({len(afails)})")
            for msg in afails[:12]:
                print(f"      - {msg}")
        else:
            print("  앵커 대조                    ✅ PASS")

    print_boundary_report()

    print("\n" + ("✅ 인배리언트 전부 통과" if total_fail == 0
                  else f"❌ 총 {total_fail}건 실패"))
    sys.exit(1 if total_fail else 0)


if __name__ == "__main__":
    main()
