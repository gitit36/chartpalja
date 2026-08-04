# -*- coding: utf-8 -*-
"""
조후↔억부 용신 정책 A/B (core 세트).

정책을 바꿔 core_strict 통과율·평균 분리도를 비교한다.
엔진 기본값(default)은 바꾸지 않고, 모듈 변수 YONGSHIN_JOHU_POLICY 만 전환.

정책:
  default        현재 운영 (병인/시급도/민감도로 조후 전환)
  eokbu_only     조후가 주용신을 덮지 않음
  johu_slim      조후 전환 유지 + 희·기 축소 (식상기신·수혜희신 제거)
  johu_slim_gi   조후 전환·희신 유지 + 식상기신만 제거
  johu_as_hee    억부 주용신 유지 + 조후를 희신 편입
  high_threshold 조후 민감도 임계 상향 (1.2 → 2.4)

사용:
  ./.venv/bin/python test/ab_yongshin_policy.py
  ./.venv/bin/python test/ab_yongshin_policy.py --exclude-collisions
  ./.venv/bin/python test/ab_yongshin_policy.py --slim-only
"""
from __future__ import annotations

import io
import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import saju_engine as se  # noqa: E402
import calibrate_yongshin as cy  # noqa: E402

POLICIES = (
    "default", "eokbu_only", "johu_slim", "johu_slim_gi",
    "johu_as_hee", "high_threshold",
)
SLIM_POLICIES = ("default", "eokbu_only", "johu_slim", "johu_slim_gi")
SUBJ_PATH = cy.SUBJ_PATH


def _eval_core(exclude_collisions: bool):
    with open(SUBJ_PATH) as f:
        raw = json.load(f)
    rows = []
    for subj in raw:
        n = cy.normalize(subj)
        if not cy.is_core_eligible(n):
            continue
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            ev = cy.evaluate(n, exclude_collisions=exclude_collisions)
        rows.append((n, ev))
    return rows


def _summary(rows):
    evalable = [(n, e) for n, e in rows if e["status"] in ("pass", "fail")]
    p = sum(1 for _, e in evalable if e["status"] == "pass")
    f = len(evalable) - p
    seps = [e["sep"] for _, e in evalable if e["sep"] == e["sep"]]
    avg = sum(seps) / len(seps) if seps else float("nan")
    hard = sum(1 for _, e in evalable if e.get("severity") == "hard_fail")
    near = sum(1 for _, e in evalable if e.get("severity") == "near_miss")
    return {
        "n": len(rows),
        "evalable": len(evalable),
        "pass": p,
        "fail": f,
        "rate": (100.0 * p / len(evalable)) if evalable else float("nan"),
        "avg_sep": avg,
        "hard_fail": hard,
        "near_miss": near,
        "detail": [
            {
                "name": n["name"],
                "sep": e["sep"],
                "status": e["status"],
                "severity": e.get("severity"),
                "yong": e.get("용신_오행"),
                "yong_label": e.get("용신"),
                "johu": (e.get("원국") and None),  # placeholder
            }
            for n, e in sorted(evalable, key=lambda r: -(r[1]["sep"] if r[1]["sep"] == r[1]["sep"] else -999))
        ],
    }


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    exclude_collisions = "--exclude-collisions" in argv
    policies = SLIM_POLICIES if "--slim-only" in argv else POLICIES

    print("══════════ 조후 정책 A/B (core_strict) ══════════")
    print(f"subjects: {SUBJ_PATH}")
    print(f"exclude_collisions: {exclude_collisions}")
    print(f"policies: {', '.join(policies)}")
    print()

    results = {}
    baseline_detail = None
    for policy in policies:
        se.YONGSHIN_JOHU_POLICY = policy
        rows = _eval_core(exclude_collisions)
        enriched = []
        for n, ev in rows:
            buf = io.StringIO()
            with redirect_stdout(buf), redirect_stderr(buf):
                r, _, _ = cy._year_scores(n)
            yong = r.get("용신") or {}
            ev = dict(ev)
            ev["_조후전환"] = yong.get("조후전환")
            ev["_조후정책"] = yong.get("조후정책", policy)
            ev["_용신라벨"] = yong.get("용신")
            ev["_hee"] = yong.get("희신_오행") or []
            ev["_gi"] = yong.get("기신_오행") or []
            enriched.append((n, ev))
        s = _summary(enriched)
        s["detail"] = [
            {
                "name": n["name"],
                "sep": e["sep"],
                "status": e["status"],
                "severity": e.get("severity"),
                "yong": e.get("용신_오행"),
                "yong_label": e.get("_용신라벨"),
                "johu_override": e.get("_조후전환"),
                "hee": e.get("_hee"),
                "gi": e.get("_gi"),
            }
            for n, e in sorted(
                [(n, e) for n, e in enriched if e["status"] in ("pass", "fail")],
                key=lambda r: -(r[1]["sep"] if r[1]["sep"] == r[1]["sep"] else -999),
            )
        ]
        results[policy] = s
        if policy == "default":
            baseline_detail = {d["name"]: d for d in s["detail"]}

        rate = f"{s['rate']:.0f}%" if s["rate"] == s["rate"] else "—"
        avg = f"{s['avg_sep']:+.2f}" if s["avg_sep"] == s["avg_sep"] else "—"
        print(f"[{policy:<14}]  pass {s['pass']}/{s['evalable']} ({rate})  "
              f"avg_sep {avg}  hard {s['hard_fail']}  near {s['near_miss']}  "
              f"johu_override={sum(1 for d in s['detail'] if d['johu_override'])}")

    print("\n── 인물별 sep Δ (vs default) ──")
    header = f"{'name':<18} {'default':>8}"
    for p in policies[1:]:
        header += f"  {p:>14}"
    print(header)

    names = [d["name"] for d in results["default"]["detail"]]
    focus = {"Lionel Messi", "Donald Trump", "윤석열"}
    for name in names:
        base = baseline_detail.get(name, {})
        line = f"{name:<18} {base.get('sep', float('nan')):>+8.2f}"
        for p in policies[1:]:
            d = next((x for x in results[p]["detail"] if x["name"] == name), None)
            if d is None or base.get("sep") != base.get("sep") or d["sep"] != d["sep"]:
                line += f"  {'—':>14}"
            else:
                delta = d["sep"] - base["sep"]
                mark = "✓" if d["status"] == "pass" else "✗"
                line += f"  {mark}{d['sep']:+.2f}(Δ{delta:+.2f})"
        print(line)
        changed = name in focus
        for p in policies[1:]:
            d = next((x for x in results[p]["detail"] if x["name"] == name), None)
            if not d:
                continue
            if (d["hee"] != base.get("hee") or d["gi"] != base.get("gi")
                    or d["yong"] != base.get("yong") or abs((d["sep"] or 0) - (base.get("sep") or 0)) > 1e-9):
                changed = True
        if changed:
            for p in policies:
                d = next(x for x in results[p]["detail"] if x["name"] == name)
                print(f"{'':18}  [{p}] 용={d['yong']} hee={d['hee']} gi={d['gi']} "
                      f"override={d['johu_override']}")

    se.YONGSHIN_JOHU_POLICY = "default"

    print("\n※ pass = separation > 0. 엔진 기본 정책은 default로 되돌림.")
    print("※ johu_slim 목표: Messi/Trump 개선을 eokbu_only 수준으로 가져가되 윤석열 악화 최소화.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
