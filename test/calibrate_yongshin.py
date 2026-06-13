# -*- coding: utf-8 -*-
"""
용신·타임라인 캘리브레이션 하니스
─────────────────────────────────────────────────────────────────
"점수가 실제 인생의 고저와 맞는가?"를 사람 단위로 검증한다.

본인/지인처럼 인생 굴곡(좋았던 해 / 나빴던 해)을 아는 사람들의 생년월일시와
'good_years' / 'bad_years' 를 입력해두면, 엔진이 산출한 연도별 종합운점수가
실제 체감과 같은 방향인지 측정한다.

핵심 지표:
  · good_years 평균점수  vs  bad_years 평균점수  → good가 더 높아야 정상
  · separation = good평균 − bad평균  (클수록 변별력 좋음)
  · hit = good평균 > bad평균 인지 여부 (사람 단위 적중)
  · 용신(rule)도 함께 출력 → 방향이 의심되면 yongshin_override로 재검증 가능

입력 파일: test/yongshin_subjects.json  (없으면 템플릿을 생성하고 종료)
  [
    {
      "name": "본인",
      "y": 1990, "m": 5, "d": 15, "h": 14, "gender": "male",
      "good_years": [2014, 2015, 2021],
      "bad_years":  [2009, 2018],
      "yongshin_override": null      // 선택: {"용신_오행":"水","희신_오행":["金"],"기신_오행":["土","火"]}
    }
  ]

사용법:
    .venv/bin/python3 test/calibrate_yongshin.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se  # noqa: E402

SUBJ_PATH = os.path.join(os.path.dirname(__file__), "yongshin_subjects.json")

_TEMPLATE = [
    {
        "name": "본인(예시 — 실제 값으로 교체)",
        "y": 1990, "m": 5, "d": 15, "h": 14, "gender": "male",
        "good_years": [2014, 2015, 2021],
        "bad_years": [2009, 2018],
        "yongshin_override": None,
    }
]


def _year_scores(subject, override=None):
    """subject → {year: 종합운점수(candle.close)} 맵."""
    inp = se.BirthInput(
        year=subject["y"], month=subject["m"], day=subject["d"],
        hour=subject.get("h", 12), minute=subject.get("mi", 0),
        gender=subject.get("gender", "male"),
        calendar="lunar" if subject.get("lunar") else "solar",
        is_leap_month=subject.get("leap", False),
    )
    r = se.compute_all(inp, yongshin_override=override)
    scores = {}
    for e in r["chart_data"]["연도별_타임라인"]:
        c = e.get("candle") or {}
        if "close" in c:
            scores[e["year"]] = c["close"]
    return r, scores


def _mean(xs):
    return sum(xs) / len(xs) if xs else float("nan")


def _evaluate(subject, override=None):
    r, scores = _year_scores(subject, override)
    good = [scores[y] for y in subject.get("good_years", []) if y in scores]
    bad = [scores[y] for y in subject.get("bad_years", []) if y in scores]
    gm, bm = _mean(good), _mean(bad)
    yong = r["용신"]
    return {
        "용신": f'{yong.get("용신","?")} (오행 {yong.get("용신_오행","?")})',
        "용신체계": yong.get("용신체계", "룰베이스"),
        "신강신약": r["신강신약"]["판정"],
        "격국": r["격국"]["격국"],
        "good_mean": gm, "bad_mean": bm,
        "sep": (gm - bm) if good and bad else float("nan"),
        "hit": (gm > bm) if good and bad else None,
        "good_n": len(good), "bad_n": len(bad),
        "allmin": min(scores.values()) if scores else None,
        "allmax": max(scores.values()) if scores else None,
    }


def main():
    if not os.path.exists(SUBJ_PATH):
        with open(SUBJ_PATH, "w") as f:
            json.dump(_TEMPLATE, f, ensure_ascii=False, indent=2)
        print(f"템플릿 생성됨: {SUBJ_PATH}")
        print("→ 본인/지인의 생년월일시와 good_years/bad_years를 채운 뒤 다시 실행하세요.")
        return

    with open(SUBJ_PATH) as f:
        subjects = json.load(f)

    print("══════════ 용신·타임라인 캘리브레이션 ══════════")
    hits = 0
    counted = 0
    seps = []
    for s in subjects:
        ev = _evaluate(s, s.get("yongshin_override"))
        print(f"\n● {s['name']}  ({s['y']}-{s['m']:02d}-{s['d']:02d} "
              f"{s.get('h',12):02d}시, {s.get('gender','male')})")
        print(f"   신강신약={ev['신강신약']}  격국={ev['격국']}  용신={ev['용신']} [{ev['용신체계']}]")
        print(f"   점수 범위(평생) {ev['allmin']}~{ev['allmax']}")
        if ev["hit"] is None:
            print("   ⚠️  good_years/bad_years 중 하나가 비어 평가 불가")
            continue
        mark = "✅" if ev["hit"] else "❌"
        print(f"   좋은해 평균 {ev['good_mean']:.1f} (n={ev['good_n']})  vs  "
              f"나쁜해 평균 {ev['bad_mean']:.1f} (n={ev['bad_n']})  "
              f"→ 분리도 {ev['sep']:+.1f} {mark}")
        counted += 1
        seps.append(ev["sep"])
        if ev["hit"]:
            hits += 1

    if counted:
        print("\n──────────────────────────────────────────")
        print(f"사람 단위 적중: {hits}/{counted}  ({100*hits/counted:.0f}%)")
        print(f"평균 분리도(좋은해−나쁜해): {_mean(seps):+.1f}점")
        print("※ 분리도가 0 이하/음수인 사람은 용신 방향 의심 → yongshin_override로 재검증 권장")


if __name__ == "__main__":
    main()
