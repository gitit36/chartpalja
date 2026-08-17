# -*- coding: utf-8 -*-
"""
B9-C month-material diagnostic (before beta sweep).

E_ym = estimated_month_resid
Q_ym = E_ym - median(E within year)

Also reports annual vs monthly variation (at β=1 probe).
Does NOT select beta; does NOT run B9-D.

Usage:
  python test/experiments/diag_b9c_month_material.py
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
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import saju_engine as se  # noqa: E402
from experiments import arm_b9, arm_b9_month, common as C, md_labels as MD  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9c_month_material.json")
PROBE_BETA = 1.0


def _pct(a: np.ndarray, qs=(1, 50, 99)) -> Dict[str, float]:
    if a.size == 0:
        return {f"p{q:02d}": None for q in qs} | {"min": None, "max": None, "n": 0}
    return {
        "min": round(float(np.min(a)), 4),
        "p01": round(float(np.percentile(a, 1)), 4),
        "p50": round(float(np.percentile(a, 50)), 4),
        "p99": round(float(np.percentile(a, 99)), 4),
        "max": round(float(np.max(a)), 4),
        "n": int(a.size),
    }


def _sd_pct(sds: List[float]) -> Dict[str, Any]:
    if not sds:
        return {"p25": None, "p50": None, "p75": None, "p90": None, "n": 0}
    a = np.asarray(sds, dtype=float)
    return {
        "p25": round(float(np.percentile(a, 25)), 4),
        "p50": round(float(np.percentile(a, 50)), 4),
        "p75": round(float(np.percentile(a, 75)), 4),
        "p90": round(float(np.percentile(a, 90)), 4),
        "n": len(sds),
    }


def _years_for_person(n: dict, meta: Dict[int, dict]) -> List[int]:
    good, bad = MD.events_for(n["name"], need_day=False)
    ys = sorted({int(e["year"]) for e in good + bad if int(e["year"]) in meta})
    # pad with a few timeline years for material coverage
    all_y = sorted(meta.keys())
    for y in (2020, 2024, 2026):
        if y in meta and y not in ys:
            ys.append(y)
    if len(ys) < 4 and all_y:
        mid = all_y[len(all_y) // 2]
        for y in (all_y[0], mid, all_y[-1]):
            if y not in ys:
                ys.append(y)
    return sorted(set(ys))


def load_month_packs(packs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Attach monthly Control series + B9-A S_raw/S for selected years."""
    out = []
    for pack in packs:
        n = pack["n"]
        series = arm_b9.sewoon_series_for_person(
            pack["meta"],
            pack["d_map"],
            b9_cfg={
                "alpha": 1.0,
                "kappa": 0.0,
                "arm": "A",
                "d_source": "engine_pillar",
            },
        )
        s_by_y = {int(y): (float(sr), float(s)) for y, sr, s in zip(
            series["years"], series["S_raw"], series["S"]
        )}
        d_by_y = {int(y): float(d) for y, d in zip(series["years"], series["D"])}
        pillar_by_y = {int(y): p for y, p in zip(series["years"], series["pillars"])}

        r, dw = SK._quiet_daewoon(n)
        years = _years_for_person(n, pack["meta"])
        months_by_year = {}
        for y in years:
            if y not in s_by_y:
                continue
            buf = io.StringIO()
            with redirect_stdout(buf), redirect_stderr(buf):
                mt = se.build_monthly_timeline(r, dw, y)
            if not mt or len(mt) < 12:
                continue
            ctrl_m = [float(m["scores"]["종합"]) for m in mt]
            ctrl_sw = float(mt[0]["candle"]["open"])
            # clipping flags on Control month display
            clipped = sum(1 for v in ctrl_m if v <= 2 or v >= 98)
            near_wall = sum(1 for v in ctrl_m if v <= 5 or v >= 95)
            S_raw, S = s_by_y[y]
            mon = arm_b9_month.month_series_for_year(
                control_months=ctrl_m,
                control_sewoon=ctrl_sw,
                S_raw_y=S_raw,
                S_y=S,
                b9_m_cfg={"beta": PROBE_BETA, "centering": "median"},
            )
            months_by_year[y] = {
                "ctrl_months": ctrl_m,
                "ctrl_sw": ctrl_sw,
                "S_raw": S_raw,
                "S": S,
                "D": d_by_y[y],
                "pillar": pillar_by_y[y],
                "E": mon["E"],
                "Q": mon["Q"],
                "C_y": mon["C_y"],
                "M_raw": mon["M_raw"],
                "M": mon["M"],
                "ctrl_clipped_n": clipped,
                "ctrl_near_wall_n": near_wall,
            }
        out.append({
            **pack,
            "sewoon_series": series,
            "months_by_year": months_by_year,
        })
    return out


def diagnose(month_packs: List[Dict[str, Any]]) -> Dict[str, Any]:
    E_all: List[float] = []
    Q_all: List[float] = []
    year_median_Q: List[float] = []
    year_mean_Q: List[float] = []
    within_sd_Q: List[float] = []
    recovery = {"attempted": 0, "finite": 0, "nan": 0, "inf": 0}
    outliers = []
    clip_cases = []

    annual_vars = []  # per block SD(S_raw-D)
    monthly_vars = []  # per year SD(M_raw-S_raw) at probe beta
    ratios = []

    # annual variation from sewoon series
    for pack in month_packs:
        series = pack["sewoon_series"]
        by_p = defaultdict(list)
        for p, sr, d in zip(series["pillars"], series["S_raw"], series["D"]):
            by_p[str(p)].append(float(sr - d))
        for p, diffs in by_p.items():
            if len(diffs) >= 2:
                annual_vars.append(float(np.std(diffs)))

        for y, row in pack["months_by_year"].items():
            E = row["E"]
            Q = row["Q"]
            recovery["attempted"] += len(E)
            for e in E:
                if e != e:
                    recovery["nan"] += 1
                elif abs(e) == float("inf"):
                    recovery["inf"] += 1
                else:
                    recovery["finite"] += 1
                    E_all.append(float(e))
            for q in Q:
                if q == q and abs(q) != float("inf"):
                    Q_all.append(float(q))
            year_median_Q.append(float(median(Q)))
            year_mean_Q.append(float(np.mean(Q)))
            within_sd_Q.append(float(np.std(Q)))
            mvar = float(np.std([mr - row["S_raw"] for mr in row["M_raw"]]))
            monthly_vars.append(mvar)
            # match to this year's pillar annual var if possible
            outliers.append({
                "name": pack["n"]["name"],
                "year": y,
                "sd_Q": round(float(np.std(Q)), 3),
                "max_abs_Q": round(float(np.max(np.abs(Q))), 3),
                "max_abs_E": round(float(np.max(np.abs(E))), 3),
                "ctrl_near_wall_n": row["ctrl_near_wall_n"],
                "ctrl_range": [round(min(row["ctrl_months"]), 1), round(max(row["ctrl_months"]), 1)],
            })
            if row["ctrl_clipped_n"] or row["ctrl_near_wall_n"] >= 2:
                clip_cases.append({
                    "name": pack["n"]["name"],
                    "year": y,
                    "clipped_n": row["ctrl_clipped_n"],
                    "near_wall_n": row["ctrl_near_wall_n"],
                    "ctrl_min": round(min(row["ctrl_months"]), 1),
                    "ctrl_max": round(max(row["ctrl_months"]), 1),
                    "max_abs_E": round(float(np.max(np.abs(E))), 2),
                })

    # ratios: pair each monthly_var with median annual_var as reference scale
    # Plus per-pack: for each year, ratio = monthly / mean(annual_vars of that person)
    for pack in month_packs:
        series = pack["sewoon_series"]
        by_p = defaultdict(list)
        for p, sr, d in zip(series["pillars"], series["S_raw"], series["D"]):
            by_p[str(p)].append(float(sr - d))
        person_ann = []
        for diffs in by_p.values():
            if len(diffs) >= 2:
                person_ann.append(float(np.std(diffs)))
        ann_ref = float(np.median(person_ann)) if person_ann else float("nan")
        for y, row in pack["months_by_year"].items():
            mvar = float(np.std([mr - row["S_raw"] for mr in row["M_raw"]]))
            if ann_ref == ann_ref and ann_ref > 1e-9:
                ratios.append(mvar / ann_ref)

    outliers_sorted = sorted(outliers, key=lambda x: x["max_abs_Q"], reverse=True)[:15]
    Ea = np.asarray(E_all, dtype=float) if E_all else np.asarray([])
    Qa = np.asarray(Q_all, dtype=float) if Q_all else np.asarray([])

    med_ann = float(np.median(annual_vars)) if annual_vars else float("nan")
    med_mon = float(np.median(monthly_vars)) if monthly_vars else float("nan")
    med_ratio = float(np.median(ratios)) if ratios else float("nan")

    # suggested beta range from Q p50/p90 so β·Q stays ~ annual shock scale
    q_p50 = float(np.percentile(Qa, 50)) if Qa.size else 0.0
    q_p90_abs = float(np.percentile(np.abs(Qa), 90)) if Qa.size else 1.0
    # target β·q_p90_abs ≈ med_ann (or 1 if missing)
    target = med_ann if med_ann == med_ann and med_ann > 0 else 4.0
    beta_hi = min(2.0, max(0.25, target / max(q_p90_abs, 1e-6)))
    beta_lo = max(0.05, beta_hi * 0.15)
    # build grid
    grid = sorted(set(round(x, 3) for x in [
        beta_lo, beta_lo * 2, beta_hi * 0.35, beta_hi * 0.5, beta_hi * 0.75,
        beta_hi, min(2.0, beta_hi * 1.25), 0.25, 0.5, 0.75, 1.0,
    ] if 0.05 <= x <= 2.0))

    return {
        "recovery": {
            **recovery,
            "finite_rate": round(recovery["finite"] / recovery["attempted"], 6)
            if recovery["attempted"] else None,
        },
        "E_dist": _pct(Ea),
        "Q_dist": _pct(Qa),
        "Q_abs_dist": _pct(np.abs(Qa)) if Qa.size else _pct(np.asarray([])),
        "per_year_median_Q": {
            "max_abs": round(max(abs(v) for v in year_median_Q), 6) if year_median_Q else None,
            "invariant_ok": all(abs(v) < 1e-9 for v in year_median_Q),
            "n_years": len(year_median_Q),
        },
        "per_year_mean_Q": _pct(np.asarray(year_mean_Q, dtype=float)) if year_mean_Q else _pct(np.asarray([])),
        "within_year_sd_Q": _sd_pct(within_sd_Q),
        "largest_outlier_subject_years": outliers_sorted,
        "control_clip_saturation_cases": clip_cases[:20],
        "n_clip_cases": len(clip_cases),
        "variation": {
            "annual_variation_sd": _sd_pct(annual_vars),
            "monthly_variation_sd_beta1": _sd_pct(monthly_vars),
            "month_to_year_ratio": {
                "p50": None if med_ratio != med_ratio else round(med_ratio, 4),
                "p25": round(float(np.percentile(ratios, 25)), 4) if ratios else None,
                "p75": round(float(np.percentile(ratios, 75)), 4) if ratios else None,
                "p90": round(float(np.percentile(ratios, 90)), 4) if ratios else None,
                "guard_median_lt_1": bool(med_ratio == med_ratio and med_ratio < 1.0),
                "n": len(ratios),
                "probe_beta": PROBE_BETA,
                "note": "ratio uses person median annual SD(S_raw-D) as denominator; monthly at β=1",
            },
            "median_annual": None if med_ann != med_ann else round(med_ann, 4),
            "median_monthly_beta1": None if med_mon != med_mon else round(med_mon, 4),
        },
        "suggested_beta_sweep": {
            "q_abs_p90": round(q_p90_abs, 4),
            "median_annual_variation": None if med_ann != med_ann else round(med_ann, 4),
            "rationale": (
                "choose β so β·|Q|_p90 is on the order of median annual variation; "
                "ratio guard pushes β down if month SD dominates"
            ),
            "grid": grid,
            "beta_lo": round(beta_lo, 3),
            "beta_hi": round(beta_hi, 3),
        },
        "corpus": {
            "n_subjects": len(month_packs),
            "n_subject_years": sum(len(p["months_by_year"]) for p in month_packs),
        },
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ B9-C month material diagnostic ══════════")
    print("A frozen α=1.0 κ=0 · B/D not run · probe β=1 for variation only\n")

    assert abs(float(arm_b9.ARM_B9_CONFIG["alpha"]) - 1.0) < 1e-9
    assert abs(float(arm_b9.ARM_B9_CONFIG["kappa"]) - 0.0) < 1e-9

    packs = SW._preload(C.filter_primary(C.load_core_subjects()))
    print(f"loading months for {len(packs)} subjects…")
    month_packs = load_month_packs(packs)
    diag = diagnose(month_packs)

    print(f"recovery finite_rate={diag['recovery']['finite_rate']} "
          f"({diag['recovery']['finite']}/{diag['recovery']['attempted']})")
    print(f"E dist: {diag['E_dist']}")
    print(f"Q dist: {diag['Q_dist']}")
    print(f"per-year median(Q) invariant_ok={diag['per_year_median_Q']['invariant_ok']} "
          f"max|medQ|={diag['per_year_median_Q']['max_abs']}")
    print(f"within-year SD(Q): {diag['within_year_sd_Q']}")
    print(f"annual SD p50={diag['variation']['annual_variation_sd']['p50']} "
          f"monthly(β=1) SD p50={diag['variation']['monthly_variation_sd_beta1']['p50']}")
    print(f"month/year ratio p50={diag['variation']['month_to_year_ratio']['p50']} "
          f"guard<1={diag['variation']['month_to_year_ratio']['guard_median_lt_1']}")
    print(f"clip/near-wall cases={diag['n_clip_cases']}")
    print(f"suggested beta grid={diag['suggested_beta_sweep']['grid']}")

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "B9C_month_material_diag",
        "frozen_A": {"alpha": 1.0, "kappa": 0.0, "version": arm_b9.ARM_VERSION},
        "B9_B": "rejected_permanently",
        "B9_D": "not_production_candidate",
        "diagnostic": diag,
    }

    def _clean(o):
        if isinstance(o, dict):
            return {k: _clean(v) for k, v in o.items()}
        if isinstance(o, list):
            return [_clean(v) for v in o]
        if isinstance(o, float) and o != o:
            return None
        return o

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(_clean(payload), f, ensure_ascii=False, indent=2)
    print(f"\n저장 → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
