# -*- coding: utf-8 -*-
"""
B9 structural KPI harness (raw vs display).

Usage (B9-A only until gates pass):
  python test/experiments/b9_structure_kpi.py
  python test/experiments/b9_structure_kpi.py --arm A --alpha 1.0

Does NOT run B/C/D predictive sweeps.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from collections import defaultdict
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime
from statistics import median
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import calibrate_yongshin as cy  # noqa: E402
import saju_engine as se  # noqa: E402
from experiments import arm_b9, common as C  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9a_structure.json")

# SPEC thresholds
MEDIAN_INVARIANT_MAX = 1.0
POP_MEAN_DRIFT_MAX = 2.0
SATURATION_MAX = 0.02  # P(<=2 or >=98)


def _birth_input(n: dict) -> se.BirthInput:
    hh, mm, _ = cy.resolve_hour(n)
    b = n["birth"]
    return se.BirthInput(
        year=b["y"], month=b["m"], day=b["d"], hour=hh, minute=mm,
        gender=n["gender"],
        calendar="lunar" if str(b.get("calendar", "solar")).lower() in ("lunar", "음력") else "solar",
        is_leap_month=b.get("leap", False),
        use_solar_time=False,
    )


def _quiet_daewoon(n: dict):
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        r = se.compute_all(_birth_input(n), yongshin_override=n.get("yongshin_override"))
        dw = se.build_daewoon_detail(r)
    return r, dw


def _group_by_pillar(years, pillars, values) -> Dict[str, List[float]]:
    out: Dict[str, List[float]] = defaultdict(list)
    for y, p, v in zip(years, pillars, values):
        out[str(p)].append(float(v))
    return dict(out)


def eval_sewoon_structure(series: Dict[str, Any]) -> Dict[str, Any]:
    years = series["years"]
    pillars = series["pillars"]
    D = series["D"]
    S_raw = series["S_raw"]
    S = series["S"]

    # Daewoon constancy: within each pillar, SD(D)==0
    d_by_p = _group_by_pillar(years, pillars, D)
    d_sds = {p: float(np.std(vs)) if len(vs) > 1 else 0.0 for p, vs in d_by_p.items()}
    dae_ok = all(sd < 1e-9 for sd in d_sds.values())

    # Per-block drifts
    raw_diff = [float(sr - d) for sr, d in zip(S_raw, D)]
    disp_diff = [float(s - d) for s, d in zip(S, D)]
    raw_by_p = _group_by_pillar(years, pillars, raw_diff)
    disp_by_p = _group_by_pillar(years, pillars, disp_diff)

    block_median_raw = {p: float(median(vs)) for p, vs in raw_by_p.items()}
    block_mean_raw = {p: float(sum(vs) / len(vs)) for p, vs in raw_by_p.items()}
    block_median_disp = {p: float(median(vs)) for p, vs in disp_by_p.items()}
    block_mean_disp = {p: float(sum(vs) / len(vs)) for p, vs in disp_by_p.items()}

    # Invariant: |median(S_raw-D)| per block
    max_abs_med = max((abs(v) for v in block_median_raw.values()), default=0.0)
    median_invariant_ok = max_abs_med <= MEDIAN_INVARIANT_MAX

    # Population systematic = mean of block MEAN raw drifts (not mean of medians)
    pop_mean_raw = float(sum(block_mean_raw.values()) / len(block_mean_raw)) if block_mean_raw else 0.0
    pop_mean_ok = abs(pop_mean_raw) <= POP_MEAN_DRIFT_MAX

    # Saturation on display S
    n = len(S) or 1
    sat = sum(1 for v in S if v <= 2 or v >= 98) / n
    sat_ok = sat < SATURATION_MAX

    return {
        "daewoon_sd_zero": dae_ok,
        "daewoon_sds": {p: round(v, 6) for p, v in d_sds.items()},
        "median_invariant_ok": median_invariant_ok,
        "max_abs_block_median_raw": round(max_abs_med, 4),
        "pop_mean_raw_drift": round(pop_mean_raw, 4),
        "pop_mean_raw_ok": pop_mean_ok,
        "display_mean_drift": round(float(np.mean(disp_diff)) if disp_diff else 0.0, 4),
        "display_median_drift": round(float(median(disp_diff)) if disp_diff else 0.0, 4),
        "block_mean_raw": {p: round(v, 4) for p, v in block_mean_raw.items()},
        "block_median_raw": {p: round(v, 4) for p, v in block_median_raw.items()},
        "block_mean_display": {p: round(v, 4) for p, v in block_mean_disp.items()},
        "saturation_rate": round(sat, 5),
        "saturation_ok": sat_ok,
        "n_years": len(years),
        "gated": bool(
            dae_ok and median_invariant_ok and pop_mean_ok and sat_ok
            and series.get("missing_d_years", 0) == 0
        ),
    }


def run_arm_a(alpha: float) -> Dict[str, Any]:
    subjects = C.filter_primary(C.load_core_subjects())
    rows = []
    block_means_for_pop: List[float] = []

    for n in subjects:
        close, meta = C.engine_year_maps(n)
        _r, dw = _quiet_daewoon(n)
        d_map = arm_b9.d_map_from_daewoon_detail(dw, allow_open_fallback=False)
        series = arm_b9.sewoon_series_for_person(
            meta,
            d_map,
            b9_cfg={"alpha": alpha, "arm": "A", "kappa": 0.0, "d_source": "engine_pillar"},
        )
        st = eval_sewoon_structure(series)
        # collect every block mean for global pop (equal weight blocks across people)
        for v in st["block_mean_raw"].values():
            block_means_for_pop.append(float(v))
        rows.append({
            "name": n["name"],
            "bucket": C.cohort_bucket(n["name"]),
            "structure": st,
            "cfg": series["cfg"],
            "missing_d_years": series["missing_d_years"],
            "n_pillars": len(series["d_by_pillar"]),
        })

    pop = float(sum(block_means_for_pop) / len(block_means_for_pop)) if block_means_for_pop else 0.0
    n_pass = sum(1 for r in rows if r["structure"]["gated"])
    all_sat = []
    for r in rows:
        # reconstruct approx from rate * n — store rates only; recompute from flags
        all_sat.append(r["structure"]["saturation_rate"])

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "arm": "B9-A",
        "version": arm_b9.ARM_VERSION,
        "alpha": alpha,
        "d_source": "engine_pillar_종합운점수",
        "thresholds": {
            "median_invariant_max": MEDIAN_INVARIANT_MAX,
            "pop_mean_drift_max": POP_MEAN_DRIFT_MAX,
            "saturation_max": SATURATION_MAX,
        },
        "population": {
            "n_subjects": len(rows),
            "n_blocks": len(block_means_for_pop),
            "systematic_mean_raw_drift": round(pop, 4),
            "pop_mean_ok": abs(pop) <= POP_MEAN_DRIFT_MAX,
            "subjects_gated": n_pass,
            "subjects_gated_rate": round(100.0 * n_pass / len(rows), 1) if rows else 0.0,
            "note": "population drift = mean of per-block mean(S_raw-D), not mean of medians",
        },
        "subjects": rows,
        "overall_gated": bool(
            abs(pop) <= POP_MEAN_DRIFT_MAX
            and n_pass == len(rows)
        ),
        "b_c_d": "not_run — A structural pass required first",
    }
    return payload


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", default="A", choices=["A"], help="Only A allowed until gates pass")
    ap.add_argument("--alpha", type=float, default=1.0)
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ B9 structural KPI (A only) ══════════")
    print(f"arm=B9-{args.arm} alpha={args.alpha} D=engine 종합운점수")
    print("B/C/D: blocked")
    print()

    payload = run_arm_a(args.alpha)
    pop = payload["population"]
    print(
        f"subjects gated {pop['subjects_gated']}/{pop['n_subjects']} "
        f"({pop['subjects_gated_rate']}%)"
    )
    print(
        f"population mean raw drift={pop['systematic_mean_raw_drift']} "
        f"ok={pop['pop_mean_ok']}"
    )
    print(f"overall_gated={payload['overall_gated']}")
    for r in payload["subjects"]:
        st = r["structure"]
        mark = "✓" if st["gated"] else "✗"
        print(
            f"  {mark} {r['bucket']:8} {r['name']:20} "
            f"medInv={st['max_abs_block_median_raw']:.3f} "
            f"blkMeanPop={st['pop_mean_raw_drift']:.3f} "
            f"dispMean={st['display_mean_drift']:.3f} "
            f"sat={st['saturation_rate']:.4f} "
            f"daeOK={st['daewoon_sd_zero']}"
        )

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\n저장 → {args.out}")
    return 0 if payload["overall_gated"] else 1


if __name__ == "__main__":
    sys.exit(main())
