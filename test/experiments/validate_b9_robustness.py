# -*- coding: utf-8 -*-
"""
B9 robustness validation — frozen hierarchy only.

Frozen (do not retune):
  alpha=1.0, kappa=0, beta=0.25
  median centering, D=engine daewoon 종합운점수
  no interaction, no synergy

Reports:
  1. Subject-level + leave-one-subject-out
  2. Month Q outlier sensitivity (baseline / top1% / top5% |Q|)
  3. Month/year hierarchy ratio distribution
  4. B7/B8 reference compare (B7 flagged non-comparable)

Does NOT modify saju_engine. Does NOT search hyperparameters.

Usage:
  python test/experiments/validate_b9_robustness.py
"""
from __future__ import annotations

import argparse
import json
import os
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

from experiments import arm_b, arm_b9, arm_b9_month, arm_b_month, common as C  # noqa: E402
from experiments import diag_b9c_month_material as DIAG  # noqa: E402
from experiments import md_labels as MD  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402
from experiments import sweep_b9c_beta as B9C  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9_robustness.json")

FROZEN = {
    "alpha": 1.0,
    "kappa": 0.0,
    "beta": 0.25,
    "centering": "median",
    "d_source": "engine_pillar",
    "interaction": False,
    "synergy": False,
    "arm_sewoon": "B9A_alpha_1",
    "arm_month": "B9C_beta_0.25",
}

MIN_EVENTS = 2
BETA = float(FROZEN["beta"])


def _clean(o: Any) -> Any:
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    if isinstance(o, float) and o != o:
        return None
    return o


def _pct(xs: Sequence[float], q: float) -> Optional[float]:
    if not xs:
        return None
    return round(float(np.percentile(np.asarray(xs, dtype=float), q)), 4)


def _std(xs: Sequence[float]) -> float:
    if len(xs) < 2:
        return 0.0
    return float(np.std(xs, ddof=1))


def _pairwise(good: Sequence[float], bad: Sequence[float]) -> Optional[float]:
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


def _assert_frozen() -> None:
    assert abs(float(arm_b9.ARM_B9_CONFIG["alpha"]) - 1.0) < 1e-9
    assert abs(float(arm_b9.ARM_B9_CONFIG["kappa"]) - 0.0) < 1e-9
    assert str(arm_b9.ARM_B9_CONFIG.get("centering") or "median") == "median"
    assert abs(float(arm_b9_month.ARM_B9_MONTH_CONFIG["beta"]) - 0.25) < 1e-9
    assert str(arm_b9_month.ARM_B9_MONTH_CONFIG.get("centering") or "median") == "median"


def _attach_labels(month_packs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return B9C._attach_labels(month_packs)


def _b9_month_cells(
    pack: Dict[str, Any],
    *,
    beta: float = BETA,
    q_abs_max: Optional[float] = None,
) -> Dict[Tuple[int, int], Dict[str, float]]:
    """(y,m) → {M, Q, absQ} with optional |Q| filter (exclude if |Q| > max)."""
    out: Dict[Tuple[int, int], Dict[str, float]] = {}
    for y, row in pack["months_by_year"].items():
        S_raw = float(row["S_raw"])
        for mi, q in enumerate(row["Q"], start=1):
            aq = abs(float(q))
            if q_abs_max is not None and aq > q_abs_max:
                continue
            m_raw = S_raw + float(beta) * float(q)
            out[(int(y), int(mi))] = {
                "M": float(arm_b9.squash(m_raw)),
                "Q": float(q),
                "absQ": aq,
            }
    return out


def _b8_month_scores(pack: Dict[str, Any]) -> Dict[Tuple[int, int], float]:
    """B8 month remap using B7 sewoon as parent (reference only)."""
    scores: Dict[Tuple[int, int], float] = {}
    meta = pack["meta"]
    scorer = arm_b.make_year_scorer(arm_b.ARM_B_CONFIG, meta)
    for y, row in pack["months_by_year"].items():
        if int(y) not in meta:
            continue
        sew_b = float(scorer(meta[int(y)]))
        rem = arm_b_month.remap_year_months(
            row["ctrl_months"],
            float(row["ctrl_sw"]),
            sew_b,
            arm_b_month.ARM_MONTH_CONFIG,
        )
        for mon, sc in enumerate(rem, start=1):
            scores[(int(y), int(mon))] = float(sc)
    return scores


def _b7_year_scores(pack: Dict[str, Any]) -> Dict[int, float]:
    meta = pack["meta"]
    scorer = arm_b.make_year_scorer(arm_b.ARM_B_CONFIG, meta)
    return {int(y): float(scorer(m)) for y, m in meta.items()}


def _weighted_vals(
    events: List[dict],
    scores: Dict[Tuple[int, int], float],
) -> Tuple[List[float], List[float], Optional[float]]:
    """Return (unweighted month scores, weights, weighted mean)."""
    vals: List[float] = []
    weights: List[float] = []
    for e in events:
        k = (int(e["year"]), int(e["month"]))
        if k not in scores:
            continue
        vals.append(scores[k])
        weights.append(float(e.get("weight", 1.0)))
    if not vals:
        return [], [], None
    wsum = sum(weights)
    wmean = sum(v * w for v, w in zip(vals, weights)) / wsum if wsum else None
    return vals, weights, wmean


def _subject_metrics_from_scores(
    pack: Dict[str, Any],
    scores: Dict[Tuple[int, int], float],
) -> Optional[Dict[str, Any]]:
    g_vals, _, g_avg = _weighted_vals(pack["good"], scores)
    b_vals, _, b_avg = _weighted_vals(pack["bad"], scores)
    if g_avg is None or b_avg is None or len(g_vals) < 1 or len(b_vals) < 1:
        return None
    raw_sep = float(g_avg) - float(b_avg)
    pooled = None
    if len(g_vals) >= 2 and len(b_vals) >= 2:
        pooled_sd = np.sqrt(
            ((len(g_vals) - 1) * _std(g_vals) ** 2 + (len(b_vals) - 1) * _std(b_vals) ** 2)
            / (len(g_vals) + len(b_vals) - 2)
        )
        pooled = raw_sep / pooled_sd if pooled_sd > 1e-9 else None
    elif len(g_vals) + len(b_vals) >= 3:
        sd = _std(g_vals + b_vals)
        pooled = raw_sep / sd if sd > 1e-9 else None
    hit = 1 if g_avg > b_avg else (0.5 if g_avg == b_avg else 0)
    return {
        "name": pack["name"],
        "bucket": pack["bucket"],
        "n_good": len(g_vals),
        "n_bad": len(b_vals),
        "hit": hit,
        "pairwise": None if _pairwise(g_vals, b_vals) is None else round(_pairwise(g_vals, b_vals) or 0, 4),
        "raw_sep": round(raw_sep, 4),
        "std_sep": None if pooled is None else round(float(pooled), 4),
        "good_mean": round(float(g_avg), 4),
        "bad_mean": round(float(b_avg), 4),
    }


def _aggregate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rows:
        return {
            "n": 0,
            "hit_rate": None,
            "pairwise_mean": None,
            "std_sep_mean": None,
            "raw_sep_mean": None,
        }
    hits = [float(r["hit"]) for r in rows]
    pairs = [float(r["pairwise"]) for r in rows if r.get("pairwise") is not None]
    stds = [float(r["std_sep"]) for r in rows if r.get("std_sep") is not None]
    raws = [float(r["raw_sep"]) for r in rows]
    return {
        "n": len(rows),
        "hit_rate": round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pairs else round(float(np.mean(pairs)), 4),
        "std_sep_mean": None if not stds else round(float(np.mean(stds)), 4),
        "raw_sep_mean": round(float(np.mean(raws)), 4),
    }


def _dist_summary(vals: Sequence[float], *, worst_is_min: bool = True) -> Dict[str, Any]:
    if not vals:
        return {"n": 0, "median": None, "p25": None, "p75": None, "worst": None}
    a = list(vals)
    worst = min(a) if worst_is_min else max(a)
    return {
        "n": len(a),
        "median": _pct(a, 50),
        "p25": _pct(a, 25),
        "p75": _pct(a, 75),
        "worst": round(float(worst), 4),
    }


def _subject_breakdown(
    labeled: List[Dict[str, Any]],
    *,
    q_abs_max: Optional[float] = None,
    arm: str = "b9",
) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    for pack in labeled:
        if arm == "b9":
            cells = _b9_month_cells(pack, q_abs_max=q_abs_max)
            scores = {k: v["M"] for k, v in cells.items()}
        elif arm == "b8":
            scores = _b8_month_scores(pack)
        else:
            raise ValueError(arm)
        m = _subject_metrics_from_scores(pack, scores)
        if m:
            rows.append(m)

    hits = [float(r["hit"]) for r in rows]
    pairs = [float(r["pairwise"]) for r in rows if r.get("pairwise") is not None]
    stds = [float(r["std_sep"]) for r in rows if r.get("std_sep") is not None]

    by_bucket = {
        "all": _aggregate(rows),
        "train": _aggregate([r for r in rows if r["bucket"] == "train"]),
        "holdout": _aggregate([r for r in rows if r["bucket"] == "holdout"]),
    }

    # Leave-one-subject-out: aggregate metrics on N-1
    loo_hits: List[float] = []
    loo_pairs: List[float] = []
    loo_stds: List[float] = []
    loo_rows: List[Dict[str, Any]] = []
    for i, left in enumerate(rows):
        rest = rows[:i] + rows[i + 1 :]
        agg = _aggregate(rest)
        loo_rows.append({
            "left_out": left["name"],
            "left_out_hit": left["hit"],
            "rest": agg,
        })
        if agg["hit_rate"] is not None:
            loo_hits.append(agg["hit_rate"])
        if agg["pairwise_mean"] is not None:
            loo_pairs.append(agg["pairwise_mean"])
        if agg["std_sep_mean"] is not None:
            loo_stds.append(agg["std_sep_mean"])

    worst_subj = sorted(rows, key=lambda r: (r["hit"], r.get("pairwise") or 0, r.get("std_sep") or -999))
    return {
        "subjects": rows,
        "aggregate": by_bucket,
        "subject_dist": {
            "hit": _dist_summary(hits),
            "pairwise": _dist_summary(pairs),
            "std_sep": _dist_summary(stds),
        },
        "loo": {
            "n": len(loo_rows),
            "hit_rate_dist": _dist_summary(loo_hits, worst_is_min=True),
            "pairwise_dist": _dist_summary(loo_pairs, worst_is_min=True),
            "std_sep_dist": _dist_summary(loo_stds, worst_is_min=True),
            "rows": loo_rows,
        },
        "worst_subjects": [
            {
                "name": r["name"],
                "bucket": r["bucket"],
                "hit": r["hit"],
                "pairwise": r["pairwise"],
                "std_sep": r["std_sep"],
                "raw_sep": r["raw_sep"],
            }
            for r in worst_subj[:5]
        ],
    }


def _q_thresholds(month_packs: List[Dict[str, Any]]) -> Dict[str, float]:
    abs_q: List[float] = []
    for pack in month_packs:
        for row in pack["months_by_year"].values():
            for q in row["Q"]:
                if q == q and abs(q) != float("inf"):
                    abs_q.append(abs(float(q)))
    a = np.asarray(abs_q, dtype=float)
    return {
        "n": int(a.size),
        "p95": float(np.percentile(a, 95)),
        "p99": float(np.percentile(a, 99)),
        "max": float(np.max(a)),
    }


def _count_labeled_kept(
    labeled: List[Dict[str, Any]],
    q_abs_max: Optional[float],
) -> Dict[str, int]:
    total = kept = 0
    for pack in labeled:
        cells = _b9_month_cells(pack, q_abs_max=None)
        cells_f = _b9_month_cells(pack, q_abs_max=q_abs_max) if q_abs_max is not None else cells
        for e in pack["good"] + pack["bad"]:
            k = (int(e["year"]), int(e["month"]))
            if k in cells:
                total += 1
                if k in cells_f:
                    kept += 1
    return {"labeled_total": total, "labeled_kept": kept, "labeled_dropped": total - kept}


def _ratio_distribution(month_packs: List[Dict[str, Any]], beta: float = BETA) -> Dict[str, Any]:
    ratios: List[float] = []
    for pack in month_packs:
        series = pack["sewoon_series"]
        by_p: Dict[str, List[float]] = defaultdict(list)
        for p, sr, d in zip(series["pillars"], series["S_raw"], series["D"]):
            by_p[str(p)].append(float(sr) - float(d))
        person_ann = []
        for diffs in by_p.values():
            if len(diffs) >= 2:
                person_ann.append(float(np.std(diffs, ddof=1)))
        ann_ref = float(np.median(person_ann)) if person_ann else float("nan")
        if not (ann_ref == ann_ref and ann_ref > 1e-9):
            continue
        for row in pack["months_by_year"].values():
            S_raw = float(row["S_raw"])
            drifts = [float(beta) * float(q) for q in row["Q"]]
            if len(drifts) < 2:
                continue
            mon_sd = float(np.std(drifts, ddof=1))
            ratios.append(mon_sd / ann_ref)
    if not ratios:
        return {"n": 0}
    a = np.asarray(ratios, dtype=float)
    return {
        "n": int(a.size),
        "beta": beta,
        "p25": round(float(np.percentile(a, 25)), 4),
        "p50": round(float(np.percentile(a, 50)), 4),
        "p75": round(float(np.percentile(a, 75)), 4),
        "p90": round(float(np.percentile(a, 90)), 4),
        "max": round(float(np.max(a)), 4),
        "P_gt_1": round(float(np.mean(a > 1.0)), 4),
        "P_gt_1_5": round(float(np.mean(a > 1.5)), 4),
        "guard_median_lt_1": bool(float(np.median(a)) < 1.0),
    }


def _b7_year_subject_metrics(labeled: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Year-level B7 reference on month-label years (good/bad year means).
    NOT directly comparable to month B9 — year_resid enters B7 parent climate.
    """
    rows = []
    for pack in labeled:
        yscores = _b7_year_scores(pack)
        g_years = [int(e["year"]) for e in pack["good"] if int(e["year"]) in yscores]
        b_years = [int(e["year"]) for e in pack["bad"] if int(e["year"]) in yscores]
        if not g_years or not b_years:
            continue
        g_vals = [yscores[y] for y in g_years]
        b_vals = [yscores[y] for y in b_years]
        g_avg, b_avg = float(np.mean(g_vals)), float(np.mean(b_vals))
        raw_sep = g_avg - b_avg
        sd = _std(g_vals + b_vals)
        std_sep = raw_sep / sd if sd > 1e-9 else None
        rows.append({
            "name": pack["name"],
            "bucket": pack["bucket"],
            "hit": 1 if g_avg > b_avg else (0.5 if g_avg == b_avg else 0),
            "pairwise": None if _pairwise(g_vals, b_vals) is None else round(_pairwise(g_vals, b_vals) or 0, 4),
            "std_sep": None if std_sep is None else round(std_sep, 4),
            "raw_sep": round(raw_sep, 4),
        })
    return {
        "note": (
            "B7 year scores on month-event years — NOT directly comparable to B9 month. "
            "B7 daewoon climate uses year_resid, so year-level signal leaks into the parent."
        ),
        "comparable_to_b9_month": False,
        "aggregate": {
            "all": _aggregate(rows),
            "train": _aggregate([r for r in rows if r["bucket"] == "train"]),
            "holdout": _aggregate([r for r in rows if r["bucket"] == "holdout"]),
        },
        "subjects": rows,
    }


def _verdict(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Heuristic readiness for shadow/prototype (not production promote)."""
    b9 = payload["subject_breakdown_b9"]
    sens = payload["q_outlier_sensitivity"]
    ratio = payload["hierarchy_ratio"]
    b8 = payload["reference_b8_month"]

    hold = b9["aggregate"]["holdout"]
    train = b9["aggregate"]["train"]
    loo_hit = b9["loo"]["hit_rate_dist"]
    worst = b9["worst_subjects"]

    checks = []

    def add(name: str, ok: bool, detail: str):
        checks.append({"name": name, "ok": ok, "detail": detail})

    add(
        "holdout_hit_ge_60",
        hold.get("hit_rate") is not None and hold["hit_rate"] >= 60,
        f"holdout hit={hold.get('hit_rate')}",
    )

    add(
        "train_holdout_gap_lt_25pp",
        (
            train.get("hit_rate") is not None
            and hold.get("hit_rate") is not None
            and abs(train["hit_rate"] - hold["hit_rate"]) < 25
        ),
        f"train={train.get('hit_rate')} hold={hold.get('hit_rate')}",
    )
    add(
        "loo_worst_hit_ge_70",
        loo_hit.get("worst") is not None and loo_hit["worst"] >= 70,
        f"LOO worst hit_rate={loo_hit.get('worst')}",
    )
    add(
        "ratio_median_lt_1",
        bool(ratio.get("guard_median_lt_1")),
        f"ratio p50={ratio.get('p50')} P(>1)={ratio.get('P_gt_1')}",
    )
    add(
        "ratio_P_gt_1_5_lt_0_25",
        ratio.get("P_gt_1_5") is not None and ratio["P_gt_1_5"] < 0.25,
        f"P(ratio>1.5)={ratio.get('P_gt_1_5')}",
    )

    base_hit = sens["baseline"]["aggregate"]["all"]["hit_rate"]
    ex5_hit = sens["exclude_top5pct_absQ"]["aggregate"]["all"]["hit_rate"]
    add(
        "q_outlier_hit_stable",
        (
            base_hit is not None
            and ex5_hit is not None
            and abs(base_hit - ex5_hit) <= 15
        ),
        f"all hit baseline={base_hit} excl5%={ex5_hit}",
    )

    # B8 month is the fair reference; B9 need not beat it to be shadow-ready
    b8_hold = b8["aggregate"]["holdout"].get("hit_rate")
    add(
        "b8_reference_recorded",
        b8_hold is not None,
        f"B8 holdout hit={b8_hold} (reference; B7 year not comparable)",
    )

    n_fail_hard = sum(
        1
        for c in checks
        if not c["ok"]
        and c["name"] in {
            "holdout_hit_ge_60",
            "loo_worst_hit_ge_70",
            "ratio_median_lt_1",
            "q_outlier_hit_stable",
        }
    )
    if n_fail_hard == 0:
        decision = "shadow_prototype_candidate"
        rationale = (
            "Frozen B9 passes core robustness gates for shadow/prototype integration. "
            "Not a production promote; engine remains untouched."
        )
    elif n_fail_hard <= 1:
        decision = "shadow_candidate_with_watchouts"
        rationale = (
            "Mostly robust; review failed checks before shadow wiring. "
            "Do not retune α/β/κ to paper over failures."
        )
    else:
        decision = "not_ready_for_shadow"
        rationale = "Multiple robustness gates failed under frozen HPs."

    return {
        "decision": decision,
        "rationale": rationale,
        "checks": checks,
        "n_hard_failures": n_fail_hard,
        "worst_subjects_preview": worst[:3],
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ B9 robustness validation (frozen HPs) ══════════")
    print(json.dumps(FROZEN, ensure_ascii=False))
    print("no HP search · no engine edits · B7/B8 reference only\n")
    _assert_frozen()

    packs = SW._preload(C.filter_primary(C.load_core_subjects()))
    print(f"loading months for {len(packs)} subjects…")
    month_packs = DIAG.load_month_packs(packs)
    labeled = _attach_labels(month_packs)
    print(f"labeled={len(labeled)}")

    # 1) Subject + LOO
    print("\n── 1. Subject / LOO breakdown ──")
    b9_bd = _subject_breakdown(labeled, arm="b9")
    print(
        f"B9 all hit={b9_bd['aggregate']['all']['hit_rate']} "
        f"train={b9_bd['aggregate']['train']['hit_rate']} "
        f"hold={b9_bd['aggregate']['holdout']['hit_rate']}"
    )
    print(
        f"subject hit dist med/p25/p75/worst="
        f"{b9_bd['subject_dist']['hit']['median']}/"
        f"{b9_bd['subject_dist']['hit']['p25']}/"
        f"{b9_bd['subject_dist']['hit']['p75']}/"
        f"{b9_bd['subject_dist']['hit']['worst']}"
    )
    print(
        f"LOO hit med/worst="
        f"{b9_bd['loo']['hit_rate_dist']['median']}/"
        f"{b9_bd['loo']['hit_rate_dist']['worst']}"
    )
    for w in b9_bd["worst_subjects"][:3]:
        print(f"  worst: {w['name']} hit={w['hit']} pair={w['pairwise']} std={w['std_sep']}")

    # 2) Q outlier sensitivity
    print("\n── 2. Q outlier sensitivity (β=0.25 fixed) ──")
    thr = _q_thresholds(month_packs)
    print(f"|Q| p95={thr['p95']:.4f} p99={thr['p99']:.4f} max={thr['max']:.4f}")
    sens = {}
    for key, qmax in (
        ("baseline", None),
        ("exclude_top1pct_absQ", thr["p99"]),
        ("exclude_top5pct_absQ", thr["p95"]),
    ):
        bd = _subject_breakdown(labeled, arm="b9", q_abs_max=qmax)
        kept = _count_labeled_kept(labeled, qmax)
        sens[key] = {
            "q_abs_max": qmax,
            "labeled_filter": kept,
            "aggregate": bd["aggregate"],
            "subject_dist": bd["subject_dist"],
            "worst_subjects": bd["worst_subjects"][:3],
        }
        print(
            f"  {key}: hit all={bd['aggregate']['all']['hit_rate']} "
            f"hold={bd['aggregate']['holdout']['hit_rate']} "
            f"pair={bd['aggregate']['all']['pairwise_mean']} "
            f"dropped={kept['labeled_dropped']}"
        )

    # 3) Hierarchy ratios
    print("\n── 3. Month/year hierarchy ratio ──")
    ratio = _ratio_distribution(month_packs, BETA)
    print(
        f"ratio p25/p50/p75/p90/max="
        f"{ratio.get('p25')}/{ratio.get('p50')}/{ratio.get('p75')}/"
        f"{ratio.get('p90')}/{ratio.get('max')}"
    )
    print(f"P(>1)={ratio.get('P_gt_1')} P(>1.5)={ratio.get('P_gt_1_5')}")

    # 4) References
    print("\n── 4. B8 month reference + B7 year (flagged) ──")
    b8_bd = _subject_breakdown(labeled, arm="b8")
    print(
        f"B8 month hold hit={b8_bd['aggregate']['holdout']['hit_rate']} "
        f"pair={b8_bd['aggregate']['holdout']['pairwise_mean']} "
        f"std={b8_bd['aggregate']['holdout']['std_sep_mean']}"
    )
    b7_ref = _b7_year_subject_metrics(labeled)
    print(
        f"B7 year (NOT comparable) hold hit="
        f"{b7_ref['aggregate']['holdout']['hit_rate']}"
    )

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "B9_robustness_validation",
        "frozen": FROZEN,
        "no_hp_search": True,
        "engine_untouched": True,
        "corpus": {
            "n_month_packs": len(month_packs),
            "n_labeled": len(labeled),
        },
        "subject_breakdown_b9": b9_bd,
        "q_abs_thresholds": thr,
        "q_outlier_sensitivity": sens,
        "hierarchy_ratio": ratio,
        "reference_b8_month": {
            "note": "Fair month-label reference (B8 remap on B7 sewoon parent).",
            "aggregate": b8_bd["aggregate"],
            "subject_dist": b8_bd["subject_dist"],
            "worst_subjects": b8_bd["worst_subjects"][:5],
        },
        "reference_b7_year": b7_ref,
        "comparability_warning": (
            "B7 predictive results are NOT directly comparable to B9: "
            "year-level information entered B7's parent climate via year_resid. "
            "Use B8 month as the primary reference arm for month-label KPIs."
        ),
    }
    payload["verdict"] = _verdict(payload)

    print("\n══════════ VERDICT ══════════")
    print(json.dumps(payload["verdict"], ensure_ascii=False, indent=2))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(_clean(payload), f, ensure_ascii=False, indent=2)
    print(f"\n저장 → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
