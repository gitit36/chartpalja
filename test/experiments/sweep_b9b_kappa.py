# -*- coding: utf-8 -*-
"""
B9-B only — kappa sweep for Control residual R.

Frozen A: alpha=1.0 (do not revisit).
S_raw = D + 1.0*A + κ*R
R_y = (G-close) - median_block(G-close)

Usage:
  python test/experiments/sweep_b9b_kappa.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_b9, common as C  # noqa: E402
from experiments import diag_b9a_alpha_select as DIAG  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_b9b_kappa_sweep.json")
KAPPAS = [-0.25, -0.15, -0.10, -0.05, 0.0, 0.05, 0.10, 0.15, 0.25]
ALPHA_FROZEN = 1.0

# Holdout incremental value vs κ=0 (B9-A)
STD_SEP_EPS = 0.05
RANK_EPS = 0.02
HIT_EPS = 1.0  # percentage points


def eval_kappa(packs: List[Dict[str, Any]], kappa: float) -> Dict[str, Any]:
    series_list = []
    score_maps = []
    for pack in packs:
        series = arm_b9.sewoon_series_for_person(
            pack["meta"],
            pack["d_map"],
            b9_cfg={
                "alpha": ALPHA_FROZEN,
                "kappa": float(kappa),
                "arm": "B" if abs(float(kappa)) > 1e-15 else "A",
                "d_source": "engine_pillar",
                "centering": "median",
            },
        )
        series_list.append(series)
        score_maps.append(arm_b9.year_score_map(series, display=True))

    structure = SW._aggregate_structure(series_list)
    train = DIAG._cohort_metrics(packs, score_maps, series_list, "train")
    hold = DIAG._cohort_metrics(packs, score_maps, series_list, "holdout")
    return {
        "kappa": kappa,
        "structure": {
            "gated": structure["gated"],
            "pop_mean_raw_drift": structure["pop_mean_raw_drift"],
            "max_abs_block_mean_drift": structure["max_abs_block_mean_drift"],
            "median_block_median_drift": structure["median_block_median_drift"],
            "annual_shock_sd": structure["shock_sd"],
            "raw_oor_rate": structure["raw_oor_rate"],
            "display_saturation_rate": structure["display_saturation_rate"],
            "dae_sd_zero": structure["dae_sd_zero"],
            "median_invariant_ok": structure["median_invariant_ok"],
            "pop_mean_ok": structure["pop_mean_ok"],
            "saturation_ok": structure["saturation_ok"],
        },
        "train": train,
        "holdout": hold,
    }


def _f(d: dict, k: str, default: float = 0.0) -> float:
    v = d.get(k)
    return default if v is None else float(v)


def deltas_vs_base(row: Dict[str, Any], base: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for split in ("train", "holdout"):
        a, b = row[split], base[split]
        out[split] = {
            "hit_rate": round(_f(a, "hit_rate") - _f(b, "hit_rate"), 4),
            "raw_sep_mean": round(_f(a, "raw_sep_mean") - _f(b, "raw_sep_mean"), 4),
            "std_sep": round(_f(a, "std_sep") - _f(b, "std_sep"), 4),
            "pairwise_good_gt_bad": round(
                _f(a, "pairwise_good_gt_bad") - _f(b, "pairwise_good_gt_bad"), 4
            ),
            "auc_micro": round(_f(a, "auc_micro") - _f(b, "auc_micro"), 4),
            "auc_macro": round(_f(a, "auc_macro") - _f(b, "auc_macro"), 4),
        }
    out["structure"] = {
        "pop_mean_raw_drift": round(
            _f(row["structure"], "pop_mean_raw_drift")
            - _f(base["structure"], "pop_mean_raw_drift"),
            4,
        ),
        "max_abs_block_mean_drift": round(
            _f(row["structure"], "max_abs_block_mean_drift")
            - _f(base["structure"], "max_abs_block_mean_drift"),
            4,
        ),
        "raw_oor_rate": round(
            _f(row["structure"], "raw_oor_rate") - _f(base["structure"], "raw_oor_rate"), 5
        ),
        "display_saturation_rate": round(
            _f(row["structure"], "display_saturation_rate")
            - _f(base["structure"], "display_saturation_rate"),
            5,
        ),
    }
    return out


def holdout_material(row: Dict[str, Any], base: Dict[str, Any]) -> bool:
    """Clear holdout incremental value (not just raw sep)."""
    if not row["structure"]["gated"]:
        return False
    d = deltas_vs_base(row, base)["holdout"]
    if d["std_sep"] >= STD_SEP_EPS:
        return True
    if d["pairwise_good_gt_bad"] >= RANK_EPS or d["auc_micro"] >= RANK_EPS or d["auc_macro"] >= RANK_EPS:
        return True
    if d["hit_rate"] >= HIT_EPS:
        return True
    return False


def neighbor_support(results: List[Dict[str, Any]], base: Dict[str, Any], kappa: float) -> int:
    """Count neighboring κ (adjacent in sorted list) that also show holdout material gain."""
    ks = sorted(float(r["kappa"]) for r in results)
    by = {float(r["kappa"]): r for r in results}
    idx = ks.index(float(kappa))
    n_ok = 0
    for j in (idx - 1, idx + 1):
        if 0 <= j < len(ks):
            if holdout_material(by[ks[j]], base):
                n_ok += 1
    return n_ok


def decide(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    base = next(r for r in results if abs(float(r["kappa"])) < 1e-15)
    candidates = []
    for r in results:
        if abs(float(r["kappa"])) < 1e-15:
            continue
        if not r["structure"]["gated"]:
            continue
        if not holdout_material(r, base):
            continue
        # train-only insufficient: require holdout material (already) and not collapse holdout
        d = deltas_vs_base(r, base)
        if d["holdout"]["hit_rate"] < -HIT_EPS and d["holdout"]["std_sep"] < STD_SEP_EPS:
            continue
        score = (
            d["holdout"]["std_sep"],
            d["holdout"]["pairwise_good_gt_bad"],
            d["holdout"]["auc_micro"],
            d["holdout"]["hit_rate"],
            -abs(float(r["kappa"])),  # prefer smaller |κ| if tied
        )
        candidates.append((score, r, d, neighbor_support(results, base, float(r["kappa"]))))

    if not candidates:
        return {
            "accept_R": False,
            "kappa": 0.0,
            "arm": "B9-A",
            "reason": (
                "no κ provides clear holdout incremental value vs κ=0 "
                f"(eps std_sep={STD_SEP_EPS}, rank={RANK_EPS}, hit={HIT_EPS}pp); reject R"
            ),
        }

    # Prefer candidates with neighbor support, then best score
    candidates.sort(key=lambda t: (t[3], t[0]), reverse=True)
    best_score, best, best_d, n_nb = candidates[0]
    if n_nb < 1 and best_d["holdout"]["std_sep"] < STD_SEP_EPS * 1.5:
        # unstable single spike without neighbors and only marginal — reject
        return {
            "accept_R": False,
            "kappa": 0.0,
            "arm": "B9-A",
            "reason": (
                f"best κ={best['kappa']} lacks neighbor reproducibility "
                f"(neighbors_material={n_nb}); reject unstable R"
            ),
            "best_rejected": {
                "kappa": best["kappa"],
                "holdout_delta": best_d["holdout"],
                "neighbor_support": n_nb,
            },
        }

    return {
        "accept_R": True,
        "kappa": best["kappa"],
        "arm": f"B9B_kappa_{best['kappa']:g}",
        "reason": (
            f"κ={best['kappa']} clear holdout gain vs A; "
            f"neighbor_support={n_nb}"
        ),
        "holdout_delta": best_d["holdout"],
        "neighbor_support": n_nb,
    }


def freeze_decision(decision: Dict[str, Any]) -> None:
    """Keep A frozen if reject; else set κ and version for B."""
    path = os.path.join(_HERE, "arm_b9.py")
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if not decision.get("accept_R"):
        # ensure A freeze intact
        text, _ = re.subn(r'ARM_VERSION = "[^"]+"', 'ARM_VERSION = "B9A_alpha_1"', text, count=1)
        text, _ = re.subn(r'"alpha":\s*[0-9.]+', '"alpha": 1.0', text, count=1)
        text, _ = re.subn(r'"kappa":\s*-?[0-9.]+', '"kappa": 0.0', text, count=1)
        text, _ = re.subn(r'"arm":\s*"[AB]"', '"arm": "A"', text, count=1)
        note = (
            "# Frozen B9-A α=1.0; B9-B residual R rejected "
            "(see exp_b9b_kappa_sweep.json)\n"
        )
    else:
        k = float(decision["kappa"])
        text, _ = re.subn(
            r'ARM_VERSION = "[^"]+"',
            f'ARM_VERSION = "B9B_kappa_{k:g}"',
            text,
            count=1,
        )
        text, _ = re.subn(r'"alpha":\s*[0-9.]+', '"alpha": 1.0', text, count=1)
        text, _ = re.subn(r'"kappa":\s*-?[0-9.]+', f'"kappa": {k}', text, count=1)
        text, _ = re.subn(r'"arm":\s*"[AB]"', '"arm": "B"', text, count=1)
        note = f"# Frozen B9-B α=1.0 κ={k} from sweep_b9b_kappa.py\n"

    # replace frozen comment line(s)
    text = re.sub(
        r"# Frozen B9-A α=[^\n]+\n",
        note,
        text,
        count=1,
    )
    if "# Frozen B9-B" not in text and decision.get("accept_R"):
        text = text.replace(
            'ARM_VERSION = "',
            note + 'ARM_VERSION = "',
            1,
        )
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ B9-B kappa sweep (A frozen α=1.0) ══════════")
    print(f"kappas={KAPPAS}")
    print("C/D: blocked · alpha not revisited\n")

    # Sanity: A freeze
    assert abs(float(arm_b9.ARM_B9_CONFIG["alpha"]) - 1.0) < 1e-9, arm_b9.ARM_B9_CONFIG

    packs = SW._preload(C.filter_primary(C.load_core_subjects()))
    results = []
    for k in KAPPAS:
        print(f"κ={k:+.2f} …", end=" ", flush=True)
        r = eval_kappa(packs, k)
        results.append(r)
        st, ho = r["structure"], r["holdout"]
        mark = "★" if st["gated"] else " "
        print(
            f"{mark}gated={st['gated']} "
            f"hold hit={ho['hit']} std_sep={ho['std_sep']} "
            f"pair={ho['pairwise_good_gt_bad']} auc={ho['auc_micro']} "
            f"raw_sep={ho['raw_sep_mean']}"
        )

    base = next(r for r in results if abs(float(r["kappa"])) < 1e-15)
    enriched = []
    for r in results:
        row = dict(r)
        row["delta_vs_kappa0"] = deltas_vs_base(r, base)
        enriched.append(row)

    decision = decide(enriched)
    print("\n── decision ──")
    print(json.dumps(decision, ensure_ascii=False, indent=2))

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "B9B_kappa_sweep",
        "frozen_A": {"alpha": ALPHA_FROZEN, "version": "B9A_alpha_1"},
        "kappas": KAPPAS,
        "material_eps": {
            "std_sep": STD_SEP_EPS,
            "rank": RANK_EPS,
            "hit_pp": HIT_EPS,
        },
        "decision_rule": [
            "structural gates must pass",
            "R must add clear holdout incremental value (std_sep/rank/hit), not just raw sep",
            "prefer gains reproduced on neighboring kappa",
            "train-only improvement insufficient",
            "if small/unstable vs A → reject R keep B9-A",
        ],
        "results": enriched,
        "decision": decision,
        "C_D": "not_run",
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

    freeze_decision(decision)
    print(
        "arm_b9 freeze:",
        "reject R → keep B9A_alpha_1" if not decision.get("accept_R")
        else f"accept κ={decision['kappa']}",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
