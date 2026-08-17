# -*- coding: utf-8 -*-
"""
유명인(yongshin_subjects.json) 기반 점수 정합 검증.

1) 연운 총점 good/bad 분리도 (calibrate_yongshin.evaluate 재사용)
2) 원국 DomainScore 분포 (신규 _DOMAIN_CALIB 중심성)
3) 포커스 인물 상세 표

Usage:
  python scripts/validate_celebrity_scores.py
  python scripts/validate_celebrity_scores.py --focus "Lionel Messi,윤석열,Justin Bieber,박정희"
"""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import statistics
import sys
from collections import Counter
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "test"))

import saju_engine as se  # noqa: E402
import calibrate_yongshin as cy  # noqa: E402

SUBJ_PATH = os.path.join(ROOT, "test", "yongshin_subjects.json")
DOMAINS = ("직업", "재물", "건강", "연애", "결혼")

DEFAULT_FOCUS = [
    "Lionel Messi",
    "윤석열",
    "Justin Bieber",
    "박정희",
    "Donald Trump",
    "손흥민",
    "김연아",
    "노무현",
    "문재인",
    "이건희",
]


def _natal_domain(n):
    with contextlib.redirect_stderr(io.StringIO()):
        r, _, _ = cy._year_scores(n)  # enrich + timeline; we only need DomainScore
    return r["DomainScore"]["점수"], r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--focus", default=",".join(DEFAULT_FOCUS))
    ap.add_argument(
        "--out",
        default=os.path.join(ROOT, "test", "snapshots", "celebrity_score_validation.json"),
    )
    args = ap.parse_args()
    focus = [x.strip() for x in args.focus.split(",") if x.strip()]

    with open(SUBJ_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    norms = [cy.normalize(s) for s in raw]

    print("══════════ 유명인 사주 점수 검증 ══════════")
    print(f"표본 {len(norms)}명  ·  {_DOMAIN_CALIB_line()}")
    print(f"시각 {datetime.now().isoformat(timespec='seconds')}\n")

    # ── 1) 분리도 평가 ──
    records = []
    for n in norms:
        with contextlib.redirect_stderr(io.StringIO()):
            ev = cy.evaluate(n, exclude_collisions=False)
        records.append((n, ev))

    def _tally(pred):
        recs = [(n, e) for n, e in records if pred(n)]
        return cy.tally(recs), len(recs), recs

    (p_all, f_all, na_all, rate_all), n_all, _ = _tally(lambda n: True)
    (p_st, f_st, na_st, rate_st), n_st, strict_recs = _tally(cy.is_strict_eligible)
    (p_co, f_co, na_co, rate_co), n_co, core_recs = _tally(cy.is_core_eligible)

    print("── 연운 총점 good/bad 분리도 ──")
    print(f"  전체         통과 {p_all}/{p_all+f_all} ({cy._rate_str(rate_all)})  · 평가불가 {na_all}  · {n_all}명")
    print(f"  strict       통과 {p_st}/{p_st+f_st} ({cy._rate_str(rate_st)})  · 평가불가 {na_st}  · {n_st}명")
    print(f"  core_strict  통과 {p_co}/{p_co+f_co} ({cy._rate_str(rate_co)})  · 평가불가 {na_co}  · {n_co}명")

    fails = sorted(
        [(n, e) for n, e in records if e["status"] == "fail"],
        key=lambda r: r[1]["sep"],
    )
    print("\n── 실패 Top10 (분리도↑ 나쁨) ──")
    if not fails:
        print("  (없음)")
    for n, e in fails[:10]:
        print(
            f"  {e['sep']:+6.1f}  {n['name']:<16} [{e['severity']}]  "
            f"tier={n['validation_tier'] or '-'}  "
            f"good={e['good_avg']:.1f} bad={e['bad_avg']:.1f}"
        )

    # ── 2) 원국 도메인 분포 ──
    print("\n── 원국 DomainScore 분포 (전원) ──")
    dom_vals = {d: [] for d in DOMAINS}
    focus_rows = []
    name_set = {n["name"] for n, _ in records}
    for n, ev in records:
        try:
            with contextlib.redirect_stderr(io.StringIO()):
                # reuse report from evaluate path: recompute natal cheaply
                hh, mm, _ = cy.resolve_hour(n)
                b = n["birth"]
                inp = se.BirthInput(
                    year=int(b["y"]), month=int(b["m"]), day=int(b["d"]),
                    hour=hh, minute=mm, gender=n["gender"],
                    calendar=b.get("calendar") or "solar",
                    use_solar_time=False,
                )
                r = se.enrich_saju(inp)
            sc = r["DomainScore"]["점수"]
            for d in DOMAINS:
                dom_vals[d].append(float(sc[d]))
            if n["name"] in focus:
                focus_rows.append({
                    "name": n["name"],
                    "sep": ev["sep"] if ev["status"] != "na" else None,
                    "status": ev["status"],
                    "severity": ev["severity"],
                    "good_avg": ev.get("good_avg"),
                    "bad_avg": ev.get("bad_avg"),
                    "domains": {d: float(sc[d]) for d in DOMAINS},
                    "용신": r["용신"].get("용신_오행"),
                    "신강신약": r["신강신약"]["판정"],
                    "격국": r["격국"]["격국"],
                    "tier": n["validation_tier"],
                    "strict": cy.is_strict_eligible(n),
                })
        except Exception as e:
            print(f"  [warn] {n['name']}: {e}", file=sys.stderr)

    for d in DOMAINS:
        xs = dom_vals[d]
        if len(xs) < 2:
            continue
        mu, sd = statistics.mean(xs), statistics.pstdev(xs)
        lo = sum(1 for x in xs if x < 4) / len(xs)
        hi = sum(1 for x in xs if x >= 7) / len(xs)
        print(f"  {d}: μ={mu:.2f} σ={sd:.2f}  Low(<4)={lo:.0%} High(≥7)={hi:.0%}")

    missing = [x for x in focus if x not in name_set]
    if missing:
        print(f"\n[warn] focus 미존재: {missing}")

    print("\n── 포커스 인물 ──")
    print(f"{'이름':<16} {'분리도':>7} {'상태':<10} {'직업':>5} {'재물':>5} {'건강':>5} {'연애':>5} {'결혼':>5}  용신/신강")
    for row in sorted(focus_rows, key=lambda r: (r["status"] != "pass", -(r["sep"] or -99))):
        sep = f"{row['sep']:+.1f}" if row["sep"] is not None else "  n/a"
        st = row["status"]
        if row["severity"]:
            st = f"{st}/{row['severity']}"
        dm = row["domains"]
        print(
            f"{row['name']:<16} {sep:>7} {st:<10} "
            f"{dm['직업']:5.1f} {dm['재물']:5.1f} {dm['건강']:5.1f} "
            f"{dm['연애']:5.1f} {dm['결혼']:5.1f}  "
            f"{row['용신']}/{row['신강신약']}"
        )

    # ── 저장 ──
    out = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "n": len(records),
        "domain_calib": {d: list(se._DOMAIN_CALIB[d]) for d in DOMAINS},
        "separation": {
            "all": {"pass": p_all, "fail": f_all, "na": na_all, "rate": rate_all, "n": n_all},
            "strict": {"pass": p_st, "fail": f_st, "na": na_st, "rate": rate_st, "n": n_st},
            "core": {"pass": p_co, "fail": f_co, "na": na_co, "rate": rate_co, "n": n_co},
        },
        "domain_dist": {
            d: {
                "mu": round(statistics.mean(dom_vals[d]), 3) if dom_vals[d] else None,
                "sd": round(statistics.pstdev(dom_vals[d]), 3) if len(dom_vals[d]) > 1 else None,
            }
            for d in DOMAINS
        },
        "focus": focus_rows,
        "fails": [
            {
                "name": n["name"],
                "sep": e["sep"],
                "severity": e["severity"],
                "tier": n["validation_tier"],
                "good_avg": e["good_avg"],
                "bad_avg": e["bad_avg"],
            }
            for n, e in fails
        ],
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\n저장 → {args.out}")
    return 0 if (p_co + f_co == 0 or rate_co >= 50) else 1


def _DOMAIN_CALIB_line():
    parts = [f"{d}={se._DOMAIN_CALIB[d]}" for d in DOMAINS]
    return "CALIB " + " ".join(parts)


if __name__ == "__main__":
    sys.exit(main())
