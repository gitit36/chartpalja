# -*- coding: utf-8 -*-
"""
대조군 vs 실험군A vs 실험군B 비교 하네스.

Usage:
  python test/experiments/compare_arms.py
  python test/experiments/compare_arms.py --include-collisions
  python test/experiments/compare_arms.py --name "Lionel Messi"

원칙:
  - saju_engine 점수 경로를 패치하지 않음
  - 엔진 candle.close = 대조군
  - A = proto general (meta 재합성)
  - B = arm_b.py 만 수정해서 개발 (반영 전까지 운영 무영향)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_a_proto, arm_b, arm_control  # noqa: E402
from experiments import common as C  # noqa: E402
from experiments import hierarchy as H  # noqa: E402
from experiments import phase_config as PC  # noqa: E402
import statistics as stats  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_arms_compare.json")
ARM_KEYS = [
    ("control", "대조군 close"),
    ("A_proto", "실험군A proto"),
    ("B_composite_v2", "실험군B v2"),
]
DAE_KEYS = [
    ("dae_control", "대운·대조군"),
    ("dae_A", "대운·A"),
    ("dae_B", "대운·B"),
]


def _amplitude(scorer, meta_maps) -> dict:
    vals = []
    for meta in meta_maps:
        for m in meta.values():
            vals.append(float(scorer(m)))
    if len(vals) < 2:
        return {"n": 0, "mu": None, "sigma": None, "range": None, "p10_p90": None}
    s = sorted(vals)
    p10 = s[max(0, int(0.1 * len(s)) - 1)]
    p90 = s[min(len(s) - 1, int(0.9 * len(s)))]
    return {
        "n": len(vals),
        "mu": round(stats.mean(vals), 2),
        "sigma": round(stats.pstdev(vals), 2),
        "range": round(max(vals) - min(vals), 1),
        "p10_p90": round(p90 - p10, 1),
    }


def eval_all(subjects, exclude_collisions: bool = True):
    rows = []
    for n in subjects:
        close, meta = C.engine_year_maps(n)
        sew_b = arm_b.make_year_scorer(arm_b.ARM_B_CONFIG, meta)
        dae_b = arm_b.make_dae_scorer(arm_b.ARM_B_CONFIG, meta)
        row = {
            "name": n["name"],
            "tier": n.get("validation_tier"),
            "bucket": C.cohort_bucket(n["name"]),
            "control": C.eval_arm_on_person(
                n, close, meta, None, exclude_collisions=exclude_collisions
            ),
            "A_proto": C.eval_arm_on_person(
                n, close, meta, arm_a_proto.year_score_from_meta,
                exclude_collisions=exclude_collisions,
            ),
            "B_composite_v2": C.eval_arm_on_person(
                n, close, meta, sew_b,
                exclude_collisions=exclude_collisions,
            ),
            "dae_control": H.eval_daewoon_on_person(
                n, close, meta, None, exclude_collisions=exclude_collisions
            ),
            "dae_A": H.eval_daewoon_on_person(
                n, close, meta, None, exclude_collisions=exclude_collisions
            ),
            "dae_B": H.eval_daewoon_on_person(
                n, close, meta, dae_b, exclude_collisions=exclude_collisions
            ),
        }
        # 엔진 close와 control scorer 일치 검증 (격리 깨짐 감지)
        ctrl2 = C.eval_arm_on_person(
            n, close, meta, arm_control.year_score_from_meta,
            exclude_collisions=exclude_collisions,
        )
        row["control_scorer"] = ctrl2
        # 계층 정합 진단 (B)
        b_scores = C.scores_from_meta(meta, sew_b)
        row["hier_consistency_B"] = H.hierarchy_consistency(meta, b_scores)
        rows.append(row)
    return rows


def _print_summary(title: str, rows: list, summary_out: dict, prefix: str = ""):
    print(f"\n── {title} (n={len(rows)}) ──")
    for key, label in ARM_KEYS:
        t = C.tally(rows, key)
        summary_out[f"{prefix}{key}"] = t
        avg = f"{t['avg_sep']:+.2f}" if t["avg_sep"] == t["avg_sep"] else "—"
        print(f"  [{label:<16}]  {C.fmt_rate(t):<16}  avg_sep {avg}  "
              f"hard {t['hard_fail']} near {t['near_miss']}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Control vs Exp-A vs Exp-B")
    ap.add_argument("--include-collisions", action="store_true",
                    help="default is exclude collisions")
    ap.add_argument("--name", default=None, help="single subject explain")
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--all-subjects", action="store_true",
                    help="core가 아니라 전원(느림·노이즈)")
    args = ap.parse_args(argv)

    excl = not args.include_collisions
    if args.all_subjects:
        import calibrate_yongshin as cy
        with open(cy.SUBJ_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        subjects = [cy.normalize(s) for s in raw]
        cohort = "all"
    else:
        subjects = C.load_core_subjects()
        cohort = "core_strict"

    if args.name:
        import calibrate_yongshin as cy
        with open(cy.SUBJ_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        n = cy._find_subject(raw, args.name)
        if n is None:
            print(f"not found: {args.name}")
            return 1
        subjects = [n]
        cohort = f"single:{n['name']}"

    print("══════════ 실험 암 비교 ══════════")
    print(f"Phase current={PC.PHASE['current']}  "
          f"P0={PC.PHASE['0']['status']} P1={PC.PHASE['1']['status']} "
          f"P2={PC.PHASE['2']['status']} P3={PC.PHASE['3']['status']} "
          f"P4={PC.PHASE['4']['status']} P5={PC.PHASE.get('5', {}).get('status', '—')} "
          f"P6A={PC.PHASE.get('6A', {}).get('status', '—')} "
          f"P6D={PC.PHASE.get('6D', {}).get('status', '—')} "
          f"P6E={PC.PHASE.get('6E', {}).get('status', '—')} "
          f"P6B={PC.PHASE.get('6B', {}).get('status', '—')} "
          f"P6C={PC.PHASE.get('6C', {}).get('status', '—')}")
    print(f"cohort={cohort}  n={len(subjects)}  collision_exclude={excl}")
    print(f"soft_exclude={sorted(PC.SOFT_EXCLUDE_NAMES)}")
    print(f"holdout={sorted(PC.HOLDOUT_NAMES)}")
    print(f"CONTROL  {arm_control.ARM_VERSION} — {arm_control.ARM_LABEL}")
    print(f"EXP-A    {arm_a_proto.ARM_VERSION} — {arm_a_proto.ARM_LABEL}")
    print(f"EXP-B    {arm_b.ARM_VERSION} — {arm_b.ARM_LABEL}")
    print(f"B config={arm_b.ARM_B_CONFIG}")
    print()

    rows = eval_all(subjects, exclude_collisions=excl)

    # isolation check: control vs control_scorer must match status/sep
    mismatches = 0
    for r in rows:
        a, b = r["control"], r["control_scorer"]
        if a["status"] != b["status"] or (
            a["sep"] == a["sep"] and b["sep"] == b["sep"] and abs(a["sep"] - b["sep"]) > 0.05
        ):
            mismatches += 1
    if mismatches:
        print(f"⚠ isolation warning: control scorer mismatch on {mismatches} subjects")
    else:
        print("✓ isolation: control scorer ≡ engine close")

    summary = {}
    primary = [r for r in rows if r["bucket"] != "soft_exclude"]
    train = [r for r in rows if r["bucket"] == "train"]
    holdout = [r for r in rows if r["bucket"] == "holdout"]
    soft = [r for r in rows if r["bucket"] == "soft_exclude"]

    _print_summary("Primary (core − soft_exclude)", primary, summary, "primary_")
    if cohort == "core_strict":
        _print_summary("Train (튜닝용)", train, summary, "train_")
        _print_summary("Holdout (게이트)", holdout, summary, "holdout_")
        if soft:
            _print_summary("Soft-exclude (참고)", soft, summary, "soft_")
    _print_summary("Core raw (참고)", rows, summary, "core_")

    # Phase5: 진폭 (primary 전원 연도 meta)
    amplitude = {}
    if cohort == "core_strict":
        meta_maps = []
        for n in subjects:
            if C.cohort_bucket(n["name"]) == "soft_exclude":
                continue
            _c, meta = C.engine_year_maps(n)
            meta_maps.append(meta)
        amplitude = {
            "control": _amplitude(arm_control.year_score_from_meta, meta_maps),
            "A_proto": _amplitude(arm_a_proto.year_score_from_meta, meta_maps),
            "B_composite_v2": _amplitude(arm_b.year_score_from_meta, meta_maps),
        }
        print("\n── 진폭 (primary 연도 pooled) ──")
        for key, label in ARM_KEYS:
            a = amplitude[key]
            print(
                f"  [{label:<16}]  σ={a['sigma']:>5}  "
                f"range={a['range']:>5}  p90−p10={a['p10_p90']:>5}  μ={a['mu']}"
            )

    # Phase3: 대운 climate KPI (mixed 블록 제외)
    if cohort == "core_strict":
        print("\n── 대운 climate 분리도 (mixed 블록 제외) ──")
        for key, label in DAE_KEYS:
            t = C.tally(primary, key)
            summary[f"primary_{key}"] = t
            avg = f"{t['avg_sep']:+.2f}" if t["avg_sep"] == t["avg_sep"] else "—"
            print(f"  [{label:<16}]  {C.fmt_rate(t):<16}  avg_sep {avg}")
        t_tr = C.tally(train, "dae_B")
        t_ho = C.tally(holdout, "dae_B")
        summary["train_dae_B"] = t_tr
        summary["holdout_dae_B"] = t_ho
        print(f"  B dae train {C.fmt_rate(t_tr)}  holdout {C.fmt_rate(t_ho)}")
        # consistency
        deltas = [
            r["hier_consistency_B"]["mean_abs_open_delta"]
            for r in primary
            if r.get("hier_consistency_B", {}).get("mean_abs_open_delta")
            == r.get("hier_consistency_B", {}).get("mean_abs_open_delta")
        ]
        if deltas:
            print(f"  B |세운−open| 평균 {sum(deltas)/len(deltas):.1f}pt (계층 정합 진단)")
        print("  ※ 월·일 분리도: sweep_phase_bc.py + month_day_labels.json (B8). mixed 대운은 기조로 사건 분리 불가.")

    print("\n── 인물별 ──")
    print(f"{'name':<18} {'bucket':<12} {'control':>8} {'A_proto':>8} {'B_v2':>8} {'daeB':>8}")
    for r in rows:
        print(
            f"{r['name']:<18} {r['bucket']:<12} "
            f"{C.fmt_sep(r['control']):>8} "
            f"{C.fmt_sep(r['A_proto']):>8} "
            f"{C.fmt_sep(r['B_composite_v2']):>8} "
            f"{C.fmt_sep(r['dae_B']):>8}"
        )

    # Phase 게이트 힌트
    if cohort == "core_strict" and "train_B_composite_v2" in summary:
        tb = summary["train_B_composite_v2"]
        hb = summary["holdout_B_composite_v2"]
        ta = summary.get("train_A_proto", {})
        cur = str(PC.PHASE.get("current", "1"))
        phase_meta = PC.PHASE.get(cur, {})
        t_train = float(phase_meta.get("target_train_rate") or PC.PHASE["1"]["target_train_rate"])
        t_hold = float(
            phase_meta.get("target_holdout_rate")
            or PC.PHASE["1"].get("target_holdout_rate")
            or 60.0
        )
        print(f"\n── Phase{cur} 게이트 ──")
        print(f"  B train   {C.fmt_rate(tb)}  (target ≥{t_train:.0f}%)")
        print(f"  B holdout {C.fmt_rate(hb)}  (target ≥{t_hold:.0f}%)")
        if ta.get("rate") == ta.get("rate") and tb.get("rate") == tb.get("rate"):
            delta = tb["rate"] - ta["rate"]
            print(f"  B−A train Δrate {delta:+.1f}pp")
    print("※ 운영 엔진(saju_engine)은 이 스크립트에서 수정되지 않음.")
    print("※ B 개발: test/experiments/arm_b.py 만 수정.")

    def _sum_pack(t):
        return {
            "pass": t["pass"],
            "fail": t["fail"],
            "evalable": t["evalable"],
            "rate": t["rate"],
            "avg_sep": t["avg_sep"],
        }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": PC.PHASE,
        "cohort": cohort,
        "exclude_collisions": excl,
        "soft_exclude": sorted(PC.SOFT_EXCLUDE_NAMES),
        "holdout": sorted(PC.HOLDOUT_NAMES),
        "arms": {
            "control": {"id": arm_control.ARM_ID, "version": arm_control.ARM_VERSION},
            "A": {"id": arm_a_proto.ARM_ID, "version": arm_a_proto.ARM_VERSION},
            "B": {
                "id": arm_b.ARM_ID,
                "version": arm_b.ARM_VERSION,
                "config": arm_b.ARM_B_CONFIG,
            },
        },
        "summary": {k: _sum_pack(v) for k, v in summary.items()},
        "amplitude": amplitude,
        "rows": [
            {
                "name": r["name"],
                "bucket": r["bucket"],
                "control": r["control"],
                "A_proto": r["A_proto"],
                "B_composite_v2": r["B_composite_v2"],
                "dae_control": r["dae_control"],
                "dae_A": r["dae_A"],
                "dae_B": r["dae_B"],
                "hier_consistency_B": r.get("hier_consistency_B"),
            }
            for r in rows
        ],
    }
    if not args.name:
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"\n저장 → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
