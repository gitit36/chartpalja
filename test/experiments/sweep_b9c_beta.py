# -*- coding: utf-8 -*-
"""
B9-C β sweep: additive month on S_raw = D + A (α=1, κ=0).

B9-B (R) permanently rejected — not in this sweep.
B9-D not run. B8 = reference only.

Selection priority (NOT raw separation alone):
  1. structural gates (raw/display drift, saturation, ratio guard)
  2. holdout month hit
  3. pairwise / ranking
  4. standardized separation
  5. train–holdout stability
  6. month/year variation ratio (prefer closer to <1 from below)
  7. if tied: smaller β

Grid from diag_b9c_month_material (Q SD ≫ annual → β ≪ 1).

Usage:
  python test/experiments/sweep_b9c_beta.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_b9, arm_b9_month, common as C, md_labels as MD  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402
from experiments import diag_b9c_month_material as DIAG  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9c_beta_sweep.json")
VERSION = "B9C_beta_v1"

# From exp_b9c_month_material.json suggested grid
BETAS = [0.05, 0.087, 0.1, 0.125, 0.188, 0.25, 0.312, 0.5, 0.75, 1.0]

RAW_DRIFT_MAX = SK.POP_MEAN_DRIFT_MAX  # 2.0
DISPLAY_DRIFT_MAX = 5.0  # soft; display can compress
SAT_MAX = SK.SATURATION_MAX  # 0.02
MIN_EVENTS = 2


def _pct(a: Sequence[float], q: float) -> Optional[float]:
    if not a:
        return None
    return float(np.percentile(np.asarray(a, dtype=float), q))


def _std(xs: Sequence[float]) -> float:
    if len(xs) < 2:
        return 0.0
    return float(np.std(xs, ddof=1))


def _mean(xs: Sequence[float]) -> Optional[float]:
    return None if not xs else float(np.mean(xs))


def _pairwise_rate(good: Sequence[float], bad: Sequence[float]) -> Optional[float]:
    if not good or not bad:
        return None
    wins = ties = 0.0
    for g in good:
        for b in bad:
            if g > b:
                wins += 1
            elif g == b:
                ties += 1
    return (wins + 0.5 * ties) / (len(good) * len(bad))


def _wavg(events: List[dict], scores: Dict[Tuple[int, int], float]) -> Tuple[float, int]:
    num = den = 0.0
    used = 0
    for e in events:
        key = (int(e["year"]), int(e["month"]))
        if key not in scores:
            continue
        s = scores[key]
        if s != s:
            continue
        w = float(e.get("weight", 1.0))
        num += s * w
        den += w
        used += 1
    return (num / den if den else float("nan")), used


def _attach_labels(month_packs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep packs that have enough month labels for predictive KPI."""
    out = []
    for pack in month_packs:
        name = pack["n"]["name"]
        good, bad = MD.events_for(name, need_day=False)
        years = set(pack["months_by_year"].keys())
        good = [e for e in good if int(e["year"]) in years]
        bad = [e for e in bad if int(e["year"]) in years]
        if len(good) < MIN_EVENTS or len(bad) < MIN_EVENTS:
            continue
        out.append({
            **pack,
            "name": name,
            "bucket": C.cohort_bucket(name),
            "good": good,
            "bad": bad,
        })
    return out


def _scores_for_beta(pack: Dict[str, Any], beta: float) -> Dict[Tuple[int, int], float]:
    """Display M at given β from cached E/Q (recompute M without engine)."""
    scores: Dict[Tuple[int, int], float] = {}
    for y, row in pack["months_by_year"].items():
        S_raw = float(row["S_raw"])
        Q = row["Q"]
        for mi, q in enumerate(Q, start=1):
            m_raw = S_raw + float(beta) * float(q)
            scores[(int(y), int(mi))] = float(arm_b9.squash(m_raw))
    return scores


def _structure_for_beta(month_packs: List[Dict[str, Any]], beta: float) -> Dict[str, Any]:
    raw_month_means: List[float] = []
    disp_month_means: List[float] = []
    sat_n = sat_bad = 0
    annual_sds: List[float] = []
    monthly_sds: List[float] = []
    ratios: List[float] = []

    # Year-level structure from sewoon (independent of β)
    raw_year_means: List[float] = []
    disp_year_means: List[float] = []

    for pack in month_packs:
        series = pack["sewoon_series"]
        by_p: Dict[str, List[Tuple[float, float, float]]] = defaultdict(list)
        # (S_raw-D, S-D, D) per year in pillar
        for p, sr, s, d in zip(series["pillars"], series["S_raw"], series["S"], series["D"]):
            by_p[str(p)].append((float(sr) - float(d), float(s) - float(d), float(d)))

        person_ann: List[float] = []
        for diffs in by_p.values():
            if len(diffs) < 2:
                continue
            raw_drifts = [x[0] for x in diffs]
            disp_drifts = [x[1] for x in diffs]
            raw_year_means.append(float(np.mean(raw_drifts)))
            disp_year_means.append(float(np.mean(disp_drifts)))
            ann = float(np.std(raw_drifts, ddof=1)) if len(raw_drifts) >= 2 else 0.0
            person_ann.append(ann)
            annual_sds.append(ann)
            for sr_d, s_d, _ in diffs:
                # saturation on display S
                # reconstruct S ≈ D + (S-D); we have S in series already
                pass

        for s in series["S"]:
            sat_n += 1
            if float(s) <= 2.0 or float(s) >= 98.0:
                sat_bad += 1

        ann_ref = float(np.median(person_ann)) if person_ann else float("nan")

        for y, row in pack["months_by_year"].items():
            S_raw = float(row["S_raw"])
            S = float(row["S"])
            Q = row["Q"]
            M_raw = [S_raw + float(beta) * float(q) for q in Q]
            M = [float(arm_b9.squash(x)) for x in M_raw]
            raw_drifts = [mr - S_raw for mr in M_raw]
            disp_drifts = [m - S for m in M]
            raw_month_means.append(float(np.mean(raw_drifts)))
            disp_month_means.append(float(np.mean(disp_drifts)))
            mon_sd = float(np.std(raw_drifts, ddof=1)) if len(raw_drifts) >= 2 else 0.0
            monthly_sds.append(mon_sd)
            if ann_ref == ann_ref and ann_ref > 1e-9:
                ratios.append(mon_sd / ann_ref)
            for m in M:
                sat_n += 1
                if m <= 2.0 or m >= 98.0:
                    sat_bad += 1

    pop_raw_year = _mean(raw_year_means)
    pop_raw_month = _mean(raw_month_means)
    pop_disp_year = _mean(disp_year_means)
    pop_disp_month = _mean(disp_month_means)
    sat_rate = (sat_bad / sat_n) if sat_n else 0.0
    ratio_p50 = _pct(ratios, 50) if ratios else None

    reasons: List[str] = []
    if pop_raw_year is not None and abs(pop_raw_year) > RAW_DRIFT_MAX:
        reasons.append("raw_year_drift")
    if pop_raw_month is not None and abs(pop_raw_month) > RAW_DRIFT_MAX:
        reasons.append("raw_month_drift")
    if pop_disp_year is not None and abs(pop_disp_year) > DISPLAY_DRIFT_MAX:
        reasons.append("display_year_drift")
    if pop_disp_month is not None and abs(pop_disp_month) > DISPLAY_DRIFT_MAX:
        reasons.append("display_month_drift")
    if sat_rate >= SAT_MAX:
        reasons.append("saturation")
    ratio_ok = ratio_p50 is not None and ratio_p50 < 1.0
    if not ratio_ok:
        reasons.append("month_gt_year_variation")

    return {
        "gate_ok": len(reasons) == 0,
        "ratio_ok": ratio_ok,
        "fail_reasons": reasons,
        "pop_raw_year_drift": None if pop_raw_year is None else round(pop_raw_year, 4),
        "pop_raw_month_drift": None if pop_raw_month is None else round(pop_raw_month, 4),
        "pop_display_year_drift": None if pop_disp_year is None else round(pop_disp_year, 4),
        "pop_display_month_drift": None if pop_disp_month is None else round(pop_disp_month, 4),
        "sat_rate": round(sat_rate, 4),
        "annual_sd_p50": None if not annual_sds else round(_pct(annual_sds, 50) or 0, 4),
        "monthly_sd_p50": None if not monthly_sds else round(_pct(monthly_sds, 50) or 0, 4),
        "month_year_ratio_p50": None if ratio_p50 is None else round(ratio_p50, 4),
        "n_ratio_obs": len(ratios),
    }


def _predictive(packs: List[Dict[str, Any]], beta: float, bucket: str) -> Dict[str, Any]:
    """bucket in {train, holdout, all}."""
    good_sc: List[float] = []
    bad_sc: List[float] = []
    pair_rates: List[float] = []
    hit_n = hit_ok = 0

    for pack in packs:
        if bucket != "all" and pack["bucket"] != bucket:
            continue
        scores = _scores_for_beta(pack, beta)
        g_avg, g_n = _wavg(pack["good"], scores)
        b_avg, b_n = _wavg(pack["bad"], scores)
        if g_n < 1 or b_n < 1 or g_avg != g_avg or b_avg != b_avg:
            continue
        good_sc.append(g_avg)
        bad_sc.append(b_avg)
        hit_n += 1
        if g_avg > b_avg:
            hit_ok += 1
        # per-subject pairwise on labeled months
        g_months = []
        b_months = []
        for e in pack["good"]:
            k = (int(e["year"]), int(e["month"]))
            if k in scores:
                g_months.append(scores[k])
        for e in pack["bad"]:
            k = (int(e["year"]), int(e["month"]))
            if k in scores:
                b_months.append(scores[k])
        pr = _pairwise_rate(g_months, b_months)
        if pr is not None:
            pair_rates.append(pr)

    if not good_sc or not bad_sc:
        return {
            "n_subjects": 0,
            "hit_rate": None,
            "raw_sep": None,
            "std_sep": None,
            "pairwise_good_gt_bad": None,
            "auc_micro": None,
        }

    raw_sep = float(np.mean(good_sc) - np.mean(bad_sc))
    if len(good_sc) >= 2 and len(bad_sc) >= 2:
        sp = _std(good_sc)
        sn = _std(bad_sc)
        pooled = np.sqrt(
            ((len(good_sc) - 1) * sp**2 + (len(bad_sc) - 1) * sn**2)
            / (len(good_sc) + len(bad_sc) - 2)
        )
        std_sep = raw_sep / pooled if pooled > 1e-9 else None
    else:
        std_sep = None
    auc = _pairwise_rate(good_sc, bad_sc)

    return {
        "n_subjects": hit_n,
        "hit_rate": round(100.0 * hit_ok / hit_n, 2) if hit_n else None,
        "raw_sep": round(raw_sep, 4),
        "std_sep": None if std_sep is None else round(std_sep, 4),
        "pairwise_good_gt_bad": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "auc_micro": None if auc is None else round(auc, 4),
    }


def _select(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    def hit(r: dict) -> float:
        return float(r["holdout"]["hit_rate"] or 0)

    def pair(r: dict) -> float:
        return float(r["holdout"]["pairwise_good_gt_bad"] or 0)

    def stds(r: dict) -> float:
        return float(r["holdout"]["std_sep"] or -999)

    def stab(r: dict) -> float:
        th = r["train"]["hit_rate"]
        hh = r["holdout"]["hit_rate"]
        if th is None or hh is None:
            return -999.0
        return -abs(float(th) - float(hh))

    def ratio_pref(r: dict) -> float:
        rp = r["structure"]["month_year_ratio_p50"]
        if rp is None:
            return -999.0
        if rp < 1.0:
            return float(rp)  # closer to 1 from below preferred among gated
        return -float(rp)

    gated = [r for r in rows if r["structure"]["gate_ok"]]
    pool = gated if gated else rows
    note = "gated" if gated else "NO_GATE_PASS_fallback_all"

    best = sorted(
        pool,
        key=lambda r: (
            1 if r["structure"]["gate_ok"] else 0,
            hit(r),
            pair(r),
            stds(r),
            stab(r),
            ratio_pref(r),
            -float(r["beta"]),  # reverse=True → smaller β wins ties
        ),
        reverse=True,
    )
    pick = best[0]
    return {
        "selected_beta": pick["beta"],
        "selection_note": note,
        "n_gate_pass": len(gated),
        "selection_priority": [
            "structural_gates",
            "holdout_month_hit",
            "pairwise",
            "std_sep",
            "train_holdout_stability",
            "month_year_ratio",
            "smaller_beta",
        ],
        "winner": {
            "beta": pick["beta"],
            "gate_ok": pick["structure"]["gate_ok"],
            "fail_reasons": pick["structure"]["fail_reasons"],
            "ratio_p50": pick["structure"]["month_year_ratio_p50"],
            "holdout_hit": pick["holdout"]["hit_rate"],
            "holdout_pairwise": pick["holdout"]["pairwise_good_gt_bad"],
            "holdout_std_sep": pick["holdout"]["std_sep"],
            "holdout_raw_sep": pick["holdout"]["raw_sep"],
            "train_hit": pick["train"]["hit_rate"],
        },
    }


def _freeze_beta(beta: float, accept: bool) -> None:
    path = os.path.join(_HERE, "arm_b9_month.py")
    text = open(path, encoding="utf-8").read()
    if accept:
        text, _ = re.subn(
            r'ARM_VERSION = "[^"]*"',
            f'ARM_VERSION = "B9C_beta_{beta:g}"',
            text,
            count=1,
        )
        text, _ = re.subn(
            r'"beta":\s*[0-9.]+',
            f'"beta": {beta}',
            text,
            count=1,
        )
        note = (
            f"# Frozen B9-C β={beta} from sweep_b9c_beta.py "
            f"(α=1 κ=0; B/D out)\n"
        )
        if "# Frozen B9-C" not in text:
            text = note + text
    else:
        # keep scaffold beta but stamp reject note
        if "# B9-C beta" not in text and "# Frozen B9-C" not in text:
            text = (
                f"# B9-C beta sweep: no promote freeze "
                f"(see exp_b9c_beta_sweep.json)\n" + text
            )
    open(path, "w", encoding="utf-8").write(text)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--no-freeze", action="store_true")
    args = ap.parse_args(argv)

    print(f"══════════ B9-C β sweep  version={VERSION} ══════════")
    print("parent S_raw = D + A (α=1 κ=0) · B8 reference only · no B9-D")
    print(f"betas={BETAS}\n")

    assert abs(float(arm_b9.ARM_B9_CONFIG["alpha"]) - 1.0) < 1e-9
    assert abs(float(arm_b9.ARM_B9_CONFIG["kappa"]) - 0.0) < 1e-9

    packs = SW._preload(C.filter_primary(C.load_core_subjects()))
    print(f"loading months for {len(packs)} subjects…")
    month_packs = DIAG.load_month_packs(packs)
    labeled = _attach_labels(month_packs)
    print(
        f"labeled subjects={len(labeled)} "
        f"(train={sum(1 for p in labeled if p['bucket']=='train')} "
        f"hold={sum(1 for p in labeled if p['bucket']=='holdout')})"
    )

    rows: List[Dict[str, Any]] = []
    for beta in BETAS:
        print(f"── β={beta} ──")
        struct = _structure_for_beta(month_packs, beta)
        train = _predictive(labeled, beta, "train")
        hold = _predictive(labeled, beta, "holdout")
        row = {"beta": beta, "structure": struct, "train": train, "holdout": hold}
        rows.append(row)
        print(
            f"  gate={struct['gate_ok']} ratio_p50={struct['month_year_ratio_p50']} "
            f"reasons={struct['fail_reasons']}"
        )
        print(
            f"  hold hit={hold['hit_rate']} pair={hold['pairwise_good_gt_bad']} "
            f"std_sep={hold['std_sep']} raw_sep={hold['raw_sep']}"
        )

    decision = _select(rows)
    # Accept freeze only if gated
    accept = decision["n_gate_pass"] > 0 and decision["winner"]["gate_ok"]
    decision["accept_freeze"] = accept

    print("\n══════════ SELECTION ══════════")
    print(json.dumps(decision, ensure_ascii=False, indent=2))

    if not args.no_freeze:
        _freeze_beta(float(decision["selected_beta"]), accept=accept)
        print(
            f"arm_b9_month.py freeze={'YES β='+str(decision['selected_beta']) if accept else 'NO (gates failed)'}"
        )

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "version": VERSION,
        "parent": "S_raw = D + A",
        "alpha": 1.0,
        "kappa": 0,
        "b9b_status": "permanently_rejected",
        "b9d_status": "not_run_not_candidate",
        "b8": "reference_only",
        "betas": BETAS,
        "corpus": {
            "n_month_packs": len(month_packs),
            "n_labeled": len(labeled),
        },
        "rows": rows,
        "decision": decision,
        "notes": [
            "Do not select β by raw_sep alone.",
            "month_to_year_variation_ratio median must be < 1 (structural guard).",
            "Q scale from material diag ≫ annual → expect β ≪ 1.",
        ],
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
