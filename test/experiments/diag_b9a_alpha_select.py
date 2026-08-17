# -*- coding: utf-8 -*-
"""
B9-A final alpha selection diagnostic (0.75 / 1.0 / 1.25 only).

Raw separation is scale-inflated by α; prefer holdout standardized/ranking metrics.
Does NOT run B/C/D.

Usage:
  python test/experiments/diag_b9a_alpha_select.py
  python test/experiments/diag_b9a_alpha_select.py --freeze
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
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

from experiments import arm_b9, common as C  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9a_alpha_diag.json")
ALPHAS = [0.75, 1.0, 1.25]
# Material improvement thresholds (holdout scale-normalized)
STD_SEP_EPS = 0.05          # absolute std_sep gain required to prefer larger α
RANK_EPS = 0.02             # absolute pairwise/AUC gain (fraction)
HIT_EPS = 1.0               # percentage points


def _event_scores(
    events: List[dict], scores: Dict[int, float]
) -> List[float]:
    out = []
    for e in events:
        if e.get("exclude"):
            continue
        y = int(e["year"])
        if y in scores and scores[y] == scores[y]:
            out.append(float(scores[y]))
    return out


def _pairwise_rate(good_sc: Sequence[float], bad_sc: Sequence[float]) -> Optional[float]:
    if not good_sc or not bad_sc:
        return None
    wins = sum(1 for g in good_sc for b in bad_sc if g > b)
    ties = sum(1 for g in good_sc for b in bad_sc if g == b)
    n = len(good_sc) * len(bad_sc)
    # AUC-style: win + 0.5 tie
    return (wins + 0.5 * ties) / n if n else None


def _mann_whitney_auc(good_sc: Sequence[float], bad_sc: Sequence[float]) -> Optional[float]:
    """Same as pairwise win+0.5tie rate (Mann–Whitney AUC)."""
    return _pairwise_rate(good_sc, bad_sc)


def _cohort_metrics(
    packs: List[Dict[str, Any]],
    score_maps: List[Dict[int, float]],
    series_list: List[Dict[str, Any]],
    bucket: str,
) -> Dict[str, Any]:
    seps = []
    pair_rates = []
    aucs = []
    all_scores = []
    good_all = []
    bad_all = []
    n_pass = n_eval = 0

    for pack, scores, series in zip(packs, score_maps, series_list):
        if pack["bucket"] != bucket:
            continue
        n = pack["n"]
        good, bad = C.prepare_events(n, pack["close"], exclude_collisions=True)
        ga, gu = C.wavg(good, scores)
        ba, bu = C.wavg(bad, scores)
        sep_pack = C.pack_sep(ga, ba, gu, bu)
        if sep_pack["status"] in ("pass", "fail"):
            n_eval += 1
            if sep_pack["status"] == "pass":
                n_pass += 1
            seps.append(float(sep_pack["sep"]))
        gsc = _event_scores(good, scores)
        bsc = _event_scores(bad, scores)
        pr = _pairwise_rate(gsc, bsc)
        if pr is not None:
            pair_rates.append(pr)
            aucs.append(pr)
        good_all.extend(gsc)
        bad_all.extend(bsc)
        # pooled SD: all years in series for this person
        all_scores.extend(float(v) for v in series["S"])

    hit_rate = (100.0 * n_pass / n_eval) if n_eval else float("nan")
    raw_sep = float(np.mean(seps)) if seps else float("nan")
    med_sep = float(median(seps)) if seps else float("nan")
    pooled_sd = float(np.std(all_scores)) if len(all_scores) >= 2 else float("nan")
    std_sep = (raw_sep / pooled_sd) if pooled_sd and pooled_sd > 1e-12 and raw_sep == raw_sep else float("nan")
    pairwise = float(np.mean(pair_rates)) if pair_rates else float("nan")
    # micro AUC across pooled events
    micro_auc = _mann_whitney_auc(good_all, bad_all)
    macro_auc = float(np.mean(aucs)) if aucs else float("nan")

    return {
        "hit_rate": None if hit_rate != hit_rate else round(hit_rate, 2),
        "hit": f"{n_pass}/{n_eval}" if n_eval else "—",
        "raw_sep_mean": None if raw_sep != raw_sep else round(raw_sep, 4),
        "raw_sep_median": None if med_sep != med_sep else round(med_sep, 4),
        "pooled_sd": None if pooled_sd != pooled_sd else round(pooled_sd, 4),
        "std_sep": None if std_sep != std_sep else round(std_sep, 4),
        "pairwise_good_gt_bad": None if pairwise != pairwise else round(pairwise, 4),
        "auc_macro": None if macro_auc != macro_auc else round(macro_auc, 4),
        "auc_micro": None if micro_auc is None else round(float(micro_auc), 4),
        "n_eval": n_eval,
        "n_persons": sum(1 for p in packs if p["bucket"] == bucket),
    }


def eval_alpha_diag(packs: List[Dict[str, Any]], alpha: float) -> Dict[str, Any]:
    series_list = []
    score_maps = []
    for pack in packs:
        series = arm_b9.sewoon_series_for_person(
            pack["meta"],
            pack["d_map"],
            b9_cfg={"alpha": alpha, "arm": "A", "kappa": 0.0, "d_source": "engine_pillar"},
        )
        series_list.append(series)
        score_maps.append(arm_b9.year_score_map(series, display=True))

    structure = SW._aggregate_structure(series_list)
    train = _cohort_metrics(packs, score_maps, series_list, "train")
    hold = _cohort_metrics(packs, score_maps, series_list, "holdout")

    return {
        "alpha": alpha,
        "structure": {
            "gated": structure["gated"],
            "pop_mean_raw_drift": structure["pop_mean_raw_drift"],
            "max_abs_block_mean_drift": structure["max_abs_block_mean_drift"],
            "median_block_median_drift": structure["median_block_median_drift"],
            "annual_shock_sd": structure["shock_sd"],
            "raw_oor_rate": structure["raw_oor_rate"],
            "display_saturation_rate": structure["display_saturation_rate"],
        },
        "train": train,
        "holdout": hold,
    }


def _materially_better(hi: Dict[str, Any], lo: Dict[str, Any]) -> bool:
    """Does hi (e.g. 1.25) materially beat lo (1.0) on holdout scale-normalized metrics?"""
    h, l = hi["holdout"], lo["holdout"]
    if not hi["structure"]["gated"]:
        return False
    if not lo["structure"]["gated"]:
        return True

    def _f(d, k, default=0.0):
        v = d.get(k)
        return default if v is None else float(v)

    # primary: std_sep, pairwise/AUC, hit rate
    std_gain = _f(h, "std_sep") - _f(l, "std_sep")
    rank_gain = max(
        _f(h, "pairwise_good_gt_bad") - _f(l, "pairwise_good_gt_bad"),
        _f(h, "auc_macro") - _f(l, "auc_macro"),
        _f(h, "auc_micro") - _f(l, "auc_micro"),
    )
    hit_gain = _f(h, "hit_rate") - _f(l, "hit_rate")

    if std_gain >= STD_SEP_EPS:
        return True
    if rank_gain >= RANK_EPS:
        return True
    if hit_gain >= HIT_EPS:
        return True
    return False


def select(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_a = {float(r["alpha"]): r for r in results}
    gated = [r for r in results if r["structure"]["gated"]]
    if not gated:
        return {"alpha": None, "reason": "no gated candidate"}

    a075, a100, a125 = by_a.get(0.75), by_a.get(1.0), by_a.get(1.25)

    # Prefer 1.0 over 1.25 unless 1.25 materially improves scale-normalized holdout
    if a100 and a100["structure"]["gated"] and a125 and a125["structure"]["gated"]:
        if not _materially_better(a125, a100):
            return {
                "alpha": 1.0,
                "reason": (
                    "1.25 does not materially improve holdout std_sep/ranking/hit "
                    f"vs 1.0 (eps std_sep={STD_SEP_EPS}, rank={RANK_EPS}, hit={HIT_EPS}pp); "
                    "prefer smaller alpha"
                ),
                "compare_125_vs_100": {
                    "std_sep_gain": round(
                        (a125["holdout"]["std_sep"] or 0) - (a100["holdout"]["std_sep"] or 0), 4
                    ),
                    "pairwise_gain": round(
                        (a125["holdout"]["pairwise_good_gt_bad"] or 0)
                        - (a100["holdout"]["pairwise_good_gt_bad"] or 0),
                        4,
                    ),
                    "hit_gain_pp": round(
                        (a125["holdout"]["hit_rate"] or 0) - (a100["holdout"]["hit_rate"] or 0), 4
                    ),
                    "raw_sep_gain": round(
                        (a125["holdout"]["raw_sep_mean"] or 0) - (a100["holdout"]["raw_sep_mean"] or 0), 4
                    ),
                },
            }
        return {
            "alpha": 1.25,
            "reason": "1.25 materially improves holdout scale-normalized metrics vs 1.0",
            "compare_125_vs_100": {
                "std_sep_gain": round(
                    (a125["holdout"]["std_sep"] or 0) - (a100["holdout"]["std_sep"] or 0), 4
                ),
                "pairwise_gain": round(
                    (a125["holdout"]["pairwise_good_gt_bad"] or 0)
                    - (a100["holdout"]["pairwise_good_gt_bad"] or 0),
                    4,
                ),
                "hit_gain_pp": round(
                    (a125["holdout"]["hit_rate"] or 0) - (a100["holdout"]["hit_rate"] or 0), 4
                ),
            },
        }

    # fallback: among gated, best holdout std_sep then pairwise then smaller alpha
    def key(r):
        h = r["holdout"]
        return (
            float(h.get("std_sep") or -1e9),
            float(h.get("pairwise_good_gt_bad") or -1e9),
            float(h.get("hit_rate") or -1e9),
            -float(r["alpha"]),
        )

    best = max(gated, key=key)
    # if 0.75 vs 1.0 tied-ish, prefer smaller
    if a075 and a100 and a075["structure"]["gated"] and a100["structure"]["gated"]:
        if not _materially_better(a100, a075):
            return {
                "alpha": 0.75,
                "reason": "1.0 not materially better than 0.75 on holdout normalized metrics; smaller α",
            }
    return {"alpha": best["alpha"], "reason": "best gated holdout std_sep/ranking among remaining"}


def freeze_alpha(alpha: float) -> None:
    path = os.path.join(_HERE, "arm_b9.py")
    with open(path, encoding="utf-8") as f:
        text = f.read()
    text, n1 = re.subn(
        r'ARM_VERSION = "[^"]+"',
        f'ARM_VERSION = "B9A_alpha_{alpha:g}"',
        text,
        count=1,
    )
    text, n2 = re.subn(
        r'"alpha":\s*[0-9.]+',
        f'"alpha": {alpha}',
        text,
        count=1,
    )
    text = re.sub(
        r"# Frozen B9-A α=[^\n]+",
        f"# Frozen B9-A α={alpha} from diag_b9a_alpha_select.py (scale-normalized)",
        text,
        count=1,
    )
    if n1 < 1 or n2 < 1:
        raise RuntimeError(f"freeze failed version={n1} alpha={n2}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--freeze", action="store_true")
    args = ap.parse_args(argv)

    print("══════════ B9-A alpha diagnostic (0.75 / 1.0 / 1.25) ══════════")
    print("raw sep is secondary (mechanically ↑ with α); prefer holdout std_sep / ranking")
    print("B/C/D: blocked\n")

    subjects = C.filter_primary(C.load_core_subjects())
    packs = SW._preload(subjects)
    results = []
    for a in ALPHAS:
        r = eval_alpha_diag(packs, a)
        results.append(r)
        st, tr, ho = r["structure"], r["train"], r["holdout"]
        print(f"── α={a} gated={st['gated']} ──")
        print(
            f"  struct: popDrift={st['pop_mean_raw_drift']:+.3f} "
            f"max|blkMean|={st['max_abs_block_mean_drift']:.3f} "
            f"shock_p50={st['annual_shock_sd']['p50']} "
            f"oor={st['raw_oor_rate']:.4f} sat={st['display_saturation_rate']:.4f}"
        )
        for label, m in (("train", tr), ("holdout", ho)):
            print(
                f"  {label:8}: hit={m['hit']} ({m['hit_rate']}%) "
                f"raw_sep={m['raw_sep_mean']} med_sep={m['raw_sep_median']} "
                f"sd={m['pooled_sd']} std_sep={m['std_sep']} "
                f"pair={m['pairwise_good_gt_bad']} aucμ={m['auc_micro']}"
            )

    decision = select(results)
    print("\n── decision ──")
    print(json.dumps(decision, ensure_ascii=False, indent=2))

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "B9A_alpha_diag_final",
        "note": "1.25 was provisional until this diagnostic",
        "alphas": ALPHAS,
        "material_eps": {
            "std_sep": STD_SEP_EPS,
            "rank": RANK_EPS,
            "hit_pp": HIT_EPS,
        },
        "selection_rule": [
            "structural gates first",
            "prioritize holdout directional/ranking/standardized separation",
            "raw separation secondary (α-inflated)",
            "if 1.25 not material vs 1.0 on normalized holdout → select 1.0",
            "prefer smaller alpha when effectively tied",
        ],
        "results": results,
        "decision": decision,
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

    if args.freeze or True:  # always freeze final diagnostic choice
        a = decision.get("alpha")
        if a is None:
            print("no alpha to freeze")
            return 1
        freeze_alpha(float(a))
        print(f"frozen arm_b9 alpha={a} version=B9A_alpha_{a:g}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
