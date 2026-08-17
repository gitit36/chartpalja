# -*- coding: utf-8 -*-
"""
B9-A only — alpha sweep (no B/C/D).

Usage:
  python test/experiments/sweep_b9a_alpha.py
  python test/experiments/sweep_b9a_alpha.py --freeze   # write selected α into arm_b9.py
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
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

from experiments import arm_b, arm_b9, common as C  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9a_alpha_sweep.json")
ALPHAS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]


def _preload(subjects: List[dict]) -> List[Dict[str, Any]]:
    packs = []
    for n in subjects:
        close, meta = C.engine_year_maps(n)
        _r, dw = SK._quiet_daewoon(n)
        d_map = arm_b9.d_map_from_daewoon_detail(dw, allow_open_fallback=False)
        packs.append({
            "n": n,
            "close": close,
            "meta": meta,
            "d_map": d_map,
            "bucket": C.cohort_bucket(n["name"]),
        })
    return packs


def _predictive(packs: List[Dict[str, Any]], score_maps: List[Dict[int, float]]) -> Dict[str, Any]:
    rows = []
    for pack, scores in zip(packs, score_maps):
        n = pack["n"]
        good, bad = C.prepare_events(n, pack["close"], exclude_collisions=True)
        ga, gu = C.wavg(good, scores)
        ba, bu = C.wavg(bad, scores)
        sep = C.pack_sep(ga, ba, gu, bu)
        rows.append({"name": n["name"], "bucket": pack["bucket"], "sep": sep})

    def _t(bucket: Optional[str] = None):
        sub = rows if bucket is None else [r for r in rows if r["bucket"] == bucket]
        return C.tally(sub, "sep")

    return {"train": _t("train"), "holdout": _t("holdout"), "all": _t(None)}


def _shock_sd_percentiles(series_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Per-block SD of (S_raw-D); pool percentiles across all blocks/subjects."""
    sds = []
    for series in series_list:
        raw_diff = [float(sr - d) for sr, d in zip(series["S_raw"], series["D"])]
        by_p = defaultdict(list)
        for p, v in zip(series["pillars"], raw_diff):
            by_p[str(p)].append(v)
        for vs in by_p.values():
            if len(vs) >= 2:
                sds.append(float(np.std(vs)))
            elif vs:
                sds.append(0.0)
    if not sds:
        return {"p25": None, "p50": None, "p75": None, "p90": None, "n_blocks": 0}
    a = np.asarray(sds, dtype=float)
    return {
        "p25": round(float(np.percentile(a, 25)), 3),
        "p50": round(float(np.percentile(a, 50)), 3),
        "p75": round(float(np.percentile(a, 75)), 3),
        "p90": round(float(np.percentile(a, 90)), 3),
        "n_blocks": len(sds),
    }


def _aggregate_structure(series_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    block_means = []
    block_medians_abs = []
    block_medians_signed = []
    max_abs_block_mean = 0.0
    all_S_raw = []
    all_S = []
    all_gated = True
    subject_structs = []

    for series in series_list:
        st = SK.eval_sewoon_structure(series)
        subject_structs.append(st)
        if not st["gated"]:
            all_gated = False
        for v in st["block_mean_raw"].values():
            block_means.append(float(v))
            max_abs_block_mean = max(max_abs_block_mean, abs(float(v)))
        for v in st["block_median_raw"].values():
            block_medians_signed.append(float(v))
            block_medians_abs.append(abs(float(v)))
        all_S_raw.extend(series["S_raw"])
        all_S.extend(series["S"])

    pop_mean = float(np.mean(block_means)) if block_means else 0.0
    n = len(all_S_raw) or 1
    raw_oor = sum(1 for v in all_S_raw if v < 0 or v > 100) / n
    sat = sum(1 for v in all_S if v <= 2 or v >= 98) / n

    median_inv_ok = all(s["median_invariant_ok"] for s in subject_structs)
    dae_ok = all(s["daewoon_sd_zero"] for s in subject_structs)
    pop_ok = abs(pop_mean) <= SK.POP_MEAN_DRIFT_MAX
    sat_ok = sat < SK.SATURATION_MAX
    missing = sum(int(ser.get("missing_d_years") or 0) for ser in series_list)
    gated = bool(all_gated and dae_ok and median_inv_ok and pop_ok and sat_ok and missing == 0)

    return {
        "gated": gated,
        "pop_mean_raw_drift": round(pop_mean, 4),
        "max_abs_block_mean_drift": round(max_abs_block_mean, 4),
        "median_block_median_drift": round(float(median(block_medians_signed)) if block_medians_signed else 0.0, 4),
        "median_abs_block_median_drift": round(float(median(block_medians_abs)) if block_medians_abs else 0.0, 4),
        "raw_oor_rate": round(raw_oor, 5),
        "display_saturation_rate": round(sat, 5),
        "dae_sd_zero": dae_ok,
        "median_invariant_ok": median_inv_ok,
        "pop_mean_ok": pop_ok,
        "saturation_ok": sat_ok,
        "missing_d_years_total": missing,
        "shock_sd": _shock_sd_percentiles(series_list),
        "n_subjects": len(series_list),
    }


def eval_alpha(packs: List[Dict[str, Any]], alpha: float) -> Dict[str, Any]:
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

    structure = _aggregate_structure(series_list)
    pred = _predictive(packs, score_maps)
    return {
        "alpha": alpha,
        "structure": structure,
        "predictive": {
            "train": {k: (None if isinstance(v, float) and v != v else v) for k, v in pred["train"].items()},
            "holdout": {k: (None if isinstance(v, float) and v != v else v) for k, v in pred["holdout"].items()},
            "all": {k: (None if isinstance(v, float) and v != v else v) for k, v in pred["all"].items()},
        },
    }


def eval_b7_reference(packs: List[Dict[str, Any]]) -> Dict[str, Any]:
    score_maps = []
    vals = []
    for pack in packs:
        scorer = arm_b.make_year_scorer(arm_b.ARM_B_CONFIG, pack["meta"])
        sm = {}
        for y, m in pack["meta"].items():
            try:
                v = float(scorer(m))
            except Exception:
                continue
            sm[int(y)] = v
            vals.append(v)
        score_maps.append(sm)
    pred = _predictive(packs, score_maps)
    n = len(vals) or 1
    sat = sum(1 for v in vals if v <= 2 or v >= 98) / n
    return {
        "arm": "B7_reference",
        "version": arm_b.ARM_VERSION,
        "note": "reference only — not promote candidate; not additive hierarchy",
        "display_saturation_rate": round(sat, 5),
        "sigma": round(float(np.std(vals)), 3) if vals else None,
        "predictive": {
            "train": {k: (None if isinstance(v, float) and v != v else v) for k, v in pred["train"].items()},
            "holdout": {k: (None if isinstance(v, float) and v != v else v) for k, v in pred["holdout"].items()},
            "all": {k: (None if isinstance(v, float) and v != v else v) for k, v in pred["all"].items()},
        },
    }


def _rank_key(r: Dict[str, Any]) -> Tuple:
    st = r["structure"]
    tr = r["predictive"]["train"]
    ho = r["predictive"]["holdout"]
    tr_rate = float(tr.get("rate") or 0)
    ho_rate = float(ho.get("rate") or 0)
    ho_sep = float(ho.get("avg_sep") or 0) if ho.get("avg_sep") is not None else -1e9
    tr_sep = float(tr.get("avg_sep") or 0) if tr.get("avg_sep") is not None else -1e9
    gap = abs(tr_rate - ho_rate)
    # 1 gated, 2 holdout rate, 3 holdout sep, 4 stability (small gap), 5 train sep, 6 smaller alpha
    return (
        1 if st.get("gated") else 0,
        ho_rate,
        ho_sep,
        -gap,
        tr_sep,
        -float(r["alpha"]),
    )


def select_alpha(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    ranked = sorted(results, key=_rank_key, reverse=True)
    best = ranked[0]
    # material tie → smaller alpha among near-equal holdout
    gated = [r for r in results if r["structure"]["gated"]]
    if gated:
        best_ho = float(best["predictive"]["holdout"].get("rate") or 0)
        best_sep = float(best["predictive"]["holdout"].get("avg_sep") or 0) if best["predictive"]["holdout"].get("avg_sep") is not None else 0
        tied = [
            r for r in gated
            if abs(float(r["predictive"]["holdout"].get("rate") or 0) - best_ho) < 1e-9
            and abs((float(r["predictive"]["holdout"].get("avg_sep") or 0) if r["predictive"]["holdout"].get("avg_sep") is not None else 0) - best_sep) < 0.25
        ]
        if tied:
            best = min(tied, key=lambda r: float(r["alpha"]))
    return best


def freeze_alpha(alpha: float) -> None:
    path = os.path.join(_HERE, "arm_b9.py")
    with open(path, encoding="utf-8") as f:
        text = f.read()
    text2, n1 = re.subn(
        r'ARM_VERSION = "[^"]+"',
        f'ARM_VERSION = "B9A_alpha_{alpha:g}"',
        text,
        count=1,
    )
    text3, n2 = re.subn(
        r'"alpha":\s*[0-9.]+',
        f'"alpha": {alpha}',
        text2,
        count=1,
    )
    # comment update
    text3 = re.sub(
        r"# Unresolved HP \(SPEC §8\): α default = [^\n]+",
        f"# Frozen B9-A α={alpha} from sweep_b9a_alpha.py",
        text3,
        count=1,
    )
    if n1 < 1 or n2 < 1:
        raise RuntimeError(f"freeze failed: version_sub={n1} alpha_sub={n2}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text3)


def run(alphas: List[float]) -> Dict[str, Any]:
    subjects = C.filter_primary(C.load_core_subjects())
    print(f"loading {len(subjects)} primary subjects…")
    packs = _preload(subjects)
    print("B7 reference…")
    b7 = eval_b7_reference(packs)
    print(
        f"  B7 train={C.fmt_rate(b7['predictive']['train'])} "
        f"hold={C.fmt_rate(b7['predictive']['holdout'])}"
    )

    results = []
    for a in alphas:
        print(f"α={a} …", end=" ", flush=True)
        r = eval_alpha(packs, a)
        results.append(r)
        st, tr, ho = r["structure"], r["predictive"]["train"], r["predictive"]["holdout"]
        mark = "★" if st["gated"] else " "
        print(
            f"{mark}gated={st['gated']} popDrift={st['pop_mean_raw_drift']:+.3f} "
            f"max|blkMean|={st['max_abs_block_mean_drift']:.3f} "
            f"rawOOR={st['raw_oor_rate']:.3f} sat={st['display_saturation_rate']:.3f} "
            f"train={C.fmt_rate(tr)} hold={C.fmt_rate(ho)}"
        )

    selected = select_alpha(results)
    return {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "B9A_alpha_sweep",
        "fixed": {
            "d_source": "engine_pillar_종합운점수",
            "centering": "median",
            "G": "arm_b.year_score_pure_from_meta",
            "R": False,
            "interaction": False,
            "month": "irrelevant_to_this_sweep",
        },
        "alphas": alphas,
        "selection_rule": [
            "hard structural gates must pass",
            "optimize holdout, not train",
            "prefer stable train/holdout",
            "if predictive materially tied, prefer smaller alpha",
        ],
        "thresholds": {
            "median_invariant_max": SK.MEDIAN_INVARIANT_MAX,
            "pop_mean_drift_max": SK.POP_MEAN_DRIFT_MAX,
            "saturation_max": SK.SATURATION_MAX,
        },
        "B7_reference": b7,
        "results": results,
        "selected": {
            "alpha": selected["alpha"],
            "structure": selected["structure"],
            "predictive": selected["predictive"],
            "rank_note": "gated → holdout rate → holdout sep → stability → smaller α",
        },
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--freeze", action="store_true", help="Write selected α into arm_b9.py")
    args = ap.parse_args(argv)

    print("══════════ B9-A alpha sweep (no B/C/D) ══════════")
    print(f"alphas={ALPHAS}")
    print()

    payload = run(ALPHAS)
    sel = payload["selected"]
    print("\n── selected ──")
    print(json.dumps(sel, ensure_ascii=False, indent=2))

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

    # Always freeze selected alpha after sweep (user asked to freeze before proceeding)
    freeze_alpha(float(sel["alpha"]))
    print(f"frozen arm_b9.ARM_B9_CONFIG alpha={sel['alpha']} version=B9A_alpha_{sel['alpha']:g}")
    if not args.freeze:
        print("(freeze applied as required by selection workflow)")

    return 0 if payload["selected"]["structure"]["gated"] else 1


if __name__ == "__main__":
    sys.exit(main())
