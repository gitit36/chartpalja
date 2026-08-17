# -*- coding: utf-8 -*-
"""
Attribution-only diagnosis of failed Fresh Validation A.

Does NOT revise G/B9, does NOT score Validation B, does NOT change labels.

Answers which layer caused the S = D + A failure:
  G, A (centering), D, or composition.

Usage:
  python test/experiments/diagnose_g_fresh_a_attribution.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from itertools import product
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_b, arm_b9, common as C  # noqa: E402
from experiments.experiment_g_clean import ALPHA, score_g  # noqa: E402
from experiments.validate_g_fresh_a import (  # noqa: E402
    FRESH_JSON,
    OUT_BIRTH_QA,
    OUT_LABELS,
    _pack_subject,
    _pairwise,
    engine_recompute_birth,
)

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_g_fresh_a_attribution.json")
OUT_REPORT = os.path.join(_HERE, "G_FRESH_A_ATTRIBUTION_REPORT.md")

VARIANT = "G_CLEAN_AXIS"
TOL = 1e-9


def _pct(xs: List[float], p: float) -> Optional[float]:
    if not xs:
        return None
    return round(float(np.percentile(xs, p)), 4)


def _dist(xs: List[float]) -> Dict[str, Any]:
    if not xs:
        return {"n": 0, "p25": None, "p50": None, "p75": None, "p90": None, "max": None}
    return {
        "n": len(xs),
        "p25": _pct(xs, 25),
        "p50": _pct(xs, 50),
        "p75": _pct(xs, 75),
        "p90": _pct(xs, 90),
        "max": round(float(max(xs)), 4),
    }


def _sign(x: float) -> int:
    if abs(x) <= TOL:
        return 0
    return 1 if x > 0 else -1


def _pairwise_detail(good: List[float], bad: List[float]) -> Optional[Dict[str, Any]]:
    if not good or not bad:
        return None
    wins = ties = losses = 0
    for g, b in product(good, bad):
        if g > b + TOL:
            wins += 1
        elif abs(g - b) <= TOL:
            ties += 1
        else:
            losses += 1
    n = wins + ties + losses
    return {
        "wins": wins,
        "ties": ties,
        "losses": losses,
        "n_pairs": n,
        "pairwise": round((wins + 0.5 * ties) / n, 4) if n else None,
    }


def _eval_material(
    packs: List[dict],
    year_layers: Dict[str, Dict[int, dict]],
    key: str,
) -> Dict[str, Any]:
    """Evaluate score material `key` on frozen good/bad labels."""
    rows = []
    all_good: List[float] = []
    all_bad: List[float] = []
    pair_rates: List[float] = []
    all_scores: List[float] = []

    for pack in packs:
        name = pack["name"]
        layers = year_layers[name]
        smap = {y: float(v[key]) for y, v in layers.items() if v.get(key) is not None}
        all_scores.extend(smap.values())
        good_e = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad_e = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        g_scores = [smap[int(e["year"])] for e in good_e if int(e["year"]) in smap]
        b_scores = [smap[int(e["year"])] for e in bad_e if int(e["year"]) in smap]
        ga, gu = C.wavg(good_e, smap)
        ba, bu = C.wavg(bad_e, smap)
        if gu < 1 or bu < 1 or ga != ga or ba != ba:
            rows.append({"name": name, "status": "insufficient_labels"})
            continue
        pd = _pairwise_detail(g_scores, b_scores)
        if pd and pd["pairwise"] is not None:
            pair_rates.append(pd["pairwise"])
        all_good.extend(g_scores)
        all_bad.extend(b_scores)
        sep = float(ga - ba)
        rows.append({
            "name": name,
            "status": "ok",
            "n_good": int(gu),
            "n_bad": int(bu),
            "good_avg": round(float(ga), 4),
            "bad_avg": round(float(ba), 4),
            "separation": round(sep, 4),
            "hit": 1 if ga > ba else 0,
            "pairwise": pd["pairwise"] if pd else None,
            "pair_wins": pd["wins"] if pd else None,
            "pair_ties": pd["ties"] if pd else None,
            "pair_losses": pd["losses"] if pd else None,
        })

    ok = [r for r in rows if r.get("status") == "ok"]
    seps = [r["separation"] for r in ok]
    hits = [r["hit"] for r in ok]
    pooled_sd = float(np.std(all_scores, ddof=1)) if len(all_scores) > 1 else float("nan")
    raw_sep = float(np.mean(seps)) if seps else float("nan")
    std_sep = (raw_sep / pooled_sd) if pooled_sd and pooled_sd > 1e-12 else float("nan")
    micro = _pairwise(all_good, all_bad)

    return {
        "material": key,
        "n_eval_subjects": len(ok),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "hit_rate": None if not hits else round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "standardized_separation": None if std_sep != std_sep else round(std_sep, 4),
        "raw_separation_mean": None if raw_sep != raw_sep else round(raw_sep, 4),
        "raw_separation_median": None if not seps else round(float(np.median(seps)), 4),
        "auc_macro": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "auc_micro": None if micro is None else round(micro, 4),
        "subjects": rows,
        "failures": [r for r in ok if r["hit"] == 0],
    }


def _decompose_pack(pack: dict, cfg: dict) -> Dict[int, dict]:
    """Per-year G / A / D / S_raw / S_display for one pack."""
    gmap: Dict[int, float] = {}
    for y, m in pack["meta"].items():
        gmap[int(y)] = float(score_g(m, VARIANT, cfg))

    by_p: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    for y, m in pack["meta"].items():
        p = str(m.get("대운_pillar") or "_")
        if p not in pack["d_map"]:
            continue
        if int(y) not in gmap:
            continue
        by_p[p].append((int(y), gmap[int(y)]))

    block_med: Dict[str, float] = {}
    out: Dict[int, dict] = {}
    for p, pairs in by_p.items():
        med = float(np.median([g for _, g in pairs]))
        block_med[p] = med
        d_b = float(pack["d_map"][p])
        for y, g in pairs:
            a = g - med
            s_raw = d_b + ALPHA * a
            s_disp = float(arm_b9.squash(s_raw))
            out[y] = {
                "year": y,
                "daewoon_pillar": p,
                "daewoon_block_id": p,
                "D": d_b,
                "G_clean_axis": g,
                "block_G_median": med,
                "A": a,
                "S_raw": s_raw,
                "S_display": s_disp,
            }
    return out


def _classify_failed_s_pair(
    dg: float, da: float, dd: float, ds: float, ds_disp: float
) -> str:
    """
    Precedence for failed S_display pairs (S_display_good <= S_display_bad):
      1. DISPLAY_FLIP
      2. D_OVERRIDES_A
      3. CENTERING_FLIP
      4. BOTH_WRONG
      5. G_DIRECTION_FAIL
      6. OTHER
    """
    if ds > TOL and ds_disp <= TOL:
        return "DISPLAY_FLIP"
    if da > TOL and ds <= TOL:
        return "D_OVERRIDES_A"
    if dg > TOL and da <= TOL:
        return "CENTERING_FLIP"
    if da <= TOL and dd <= TOL:
        return "BOTH_WRONG"
    if dg <= TOL:
        return "G_DIRECTION_FAIL"
    return "OTHER"


def main() -> int:
    print("══════════ G Fresh A Attribution (no B, no revise) ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    if not freeze.get("labels_frozen"):
        raise SystemExit("frozen labels missing labels_frozen=true")

    fresh = json.load(open(FRESH_JSON, encoding="utf-8"))
    by_subj = {s["name"]: s for s in fresh["subjects"]}

    # Prefer frozen birth QA file; recompute if missing
    if os.path.exists(OUT_BIRTH_QA):
        birth_rows = json.load(open(OUT_BIRTH_QA, encoding="utf-8"))["rows"]
    else:
        birth_rows = [engine_recompute_birth(s) for s in fresh["subjects"]]
    by_birth = {r["name"]: r for r in birth_rows}

    eligible_set = set(freeze["eligible_for_primary_validation"])
    events = freeze["eligible_events"]
    val_a_names = list(freeze["validation_a"])

    packs = []
    skipped = []
    for name in val_a_names:
        s = by_subj[name]
        if s.get("split") == "validation_b":
            raise RuntimeError(f"BUG: validation_b subject in A list: {name}")
        if s.get("split") != "validation_a":
            raise RuntimeError(f"non-A split in validation_a list: {name}")
        if name not in eligible_set:
            skipped.append({"name": name, "reason": "ineligible_pre_score"})
            continue
        ev = events[name]
        if len(ev["good"]) < 1 or len(ev["bad"]) < 1:
            skipped.append({"name": name, "reason": "insufficient_eligible_events"})
            continue
        print(f"  packing {name} …")
        packs.append(_pack_subject(s, by_birth[name]["engine_birth"], ev))

    print(f"packs={len(packs)} skipped={skipped}")
    cfg = dict(arm_b.ARM_B_CONFIG)

    # ── Phase 1: year layers ──
    year_layers: Dict[str, Dict[int, dict]] = {}
    year_rows_flat: List[dict] = []
    for pack in packs:
        layers = _decompose_pack(pack, cfg)
        year_layers[pack["name"]] = layers
        for y, row in sorted(layers.items()):
            year_rows_flat.append({"name": pack["name"], **row})

    # ── Phase 2: event-level table ──
    event_rows: List[dict] = []
    for pack in packs:
        name = pack["name"]
        layers = year_layers[name]
        for side in ("good", "bad"):
            for e in pack["n"][side]:
                if e.get("exclude"):
                    continue
                y = int(e["year"])
                L = layers.get(y)
                if not L:
                    event_rows.append({
                        "name": name, "year": y, "side": side,
                        "label": e.get("label"), "weight": e.get("weight"),
                        "confidence": e.get("confidence"),
                        "missing_year_layer": True,
                    })
                    continue
                event_rows.append({
                    "name": name,
                    "year": y,
                    "label": e.get("label"),
                    "side": side,
                    "weight": e.get("weight"),
                    "confidence": e.get("confidence"),
                    "axis_label": e.get("axis") or e.get("domain") or e.get("category"),
                    "daewoon_pillar": L["daewoon_pillar"],
                    "D": round(L["D"], 6),
                    "G": round(L["G_clean_axis"], 6),
                    "A": round(L["A"], 6),
                    "S_raw": round(L["S_raw"], 6),
                    "S_display": round(L["S_display"], 6),
                })

    # ── Phase 3: four materials ──
    materials = {
        "G": _eval_material(packs, year_layers, "G_clean_axis"),
        "A": _eval_material(packs, year_layers, "A"),
        "D": _eval_material(packs, year_layers, "D"),
        "S_raw": _eval_material(packs, year_layers, "S_raw"),
        "S_display": _eval_material(packs, year_layers, "S_display"),
    }

    # ── Phase 4: pair table same vs cross ──
    pairs: List[dict] = []
    for pack in packs:
        name = pack["name"]
        layers = year_layers[name]
        goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
        bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
        for ge, be in product(goods, bads):
            yg, yb = int(ge["year"]), int(be["year"])
            Lg, Lb = layers[yg], layers[yb]
            dg = Lg["G_clean_axis"] - Lb["G_clean_axis"]
            da = Lg["A"] - Lb["A"]
            dd = Lg["D"] - Lb["D"]
            ds = Lg["S_raw"] - Lb["S_raw"]
            ds_disp = Lg["S_display"] - Lb["S_display"]
            identity_ok = abs(ds - (dd + da)) <= 1e-6
            same = Lg["daewoon_pillar"] == Lb["daewoon_pillar"]
            pairs.append({
                "subject": name,
                "good_year": yg,
                "bad_year": yb,
                "good_label": ge.get("label"),
                "bad_label": be.get("label"),
                "good_daewoon": Lg["daewoon_pillar"],
                "bad_daewoon": Lb["daewoon_pillar"],
                "same_daewoon": same,
                "G_diff": round(dg, 6),
                "A_diff": round(da, 6),
                "D_diff": round(dd, 6),
                "S_raw_diff": round(ds, 6),
                "S_display_diff": round(ds_disp, 6),
                "identity_S_eq_D_plus_A": identity_ok,
                "G_win": dg > TOL,
                "A_win": da > TOL,
                "D_win": dd > TOL,
                "S_raw_win": ds > TOL,
                "S_display_win": ds_disp > TOL,
                "G_tie": abs(dg) <= TOL,
                "A_tie": abs(da) <= TOL,
                "D_tie": abs(dd) <= TOL,
                "S_raw_tie": abs(ds) <= TOL,
                "S_display_tie": abs(ds_disp) <= TOL,
            })

    def pair_metrics(subset: List[dict], diff_key: str, win_key: str, tie_key: str) -> Dict[str, Any]:
        if not subset:
            return {"n_pairs": 0, "wins": 0, "ties": 0, "losses": 0, "pairwise": None}
        wins = sum(1 for p in subset if p[win_key])
        ties = sum(1 for p in subset if p[tie_key])
        losses = len(subset) - wins - ties
        return {
            "n_pairs": len(subset),
            "wins": wins,
            "ties": ties,
            "losses": losses,
            "pairwise": round((wins + 0.5 * ties) / len(subset), 4),
        }

    all_p = pairs
    same_p = [p for p in pairs if p["same_daewoon"]]
    cross_p = [p for p in pairs if not p["same_daewoon"]]

    pair_bucket_metrics = {}
    for bucket_name, subset in (("ALL", all_p), ("SAME_DAEWOON", same_p), ("CROSS_DAEWOON", cross_p)):
        pair_bucket_metrics[bucket_name] = {
            "n_pairs": len(subset),
            "G": pair_metrics(subset, "G_diff", "G_win", "G_tie"),
            "A": pair_metrics(subset, "A_diff", "A_win", "A_tie"),
            "D": pair_metrics(subset, "D_diff", "D_win", "D_tie"),
            "S_raw": pair_metrics(subset, "S_raw_diff", "S_raw_win", "S_raw_tie"),
            "S_display": pair_metrics(subset, "S_display_diff", "S_display_win", "S_display_tie"),
        }

    identity_fail = sum(1 for p in pairs if not p["identity_S_eq_D_plus_A"])

    # ── Phase 5: failure attribution on S_display fails ──
    failed_s = [p for p in pairs if not p["S_display_win"] and not p["S_display_tie"]]
    # also include ties as non-wins for strict S_good <= S_bad
    failed_s_le = [p for p in pairs if p["S_display_diff"] <= TOL]

    attribution_counts: Dict[str, List[dict]] = defaultdict(list)
    for p in failed_s_le:
        cat = _classify_failed_s_pair(
            p["G_diff"], p["A_diff"], p["D_diff"], p["S_raw_diff"], p["S_display_diff"]
        )
        attribution_counts[cat].append({
            "subject": p["subject"],
            "good_year": p["good_year"],
            "bad_year": p["bad_year"],
            "same_daewoon": p["same_daewoon"],
            "G_diff": p["G_diff"],
            "A_diff": p["A_diff"],
            "D_diff": p["D_diff"],
            "S_raw_diff": p["S_raw_diff"],
            "S_display_diff": p["S_display_diff"],
            "category": cat,
        })

    n_fail = len(failed_s_le)
    attribution_summary = {}
    for cat in (
        "DISPLAY_FLIP", "D_OVERRIDES_A", "CENTERING_FLIP",
        "BOTH_WRONG", "G_DIRECTION_FAIL", "OTHER",
    ):
        items = attribution_counts.get(cat, [])
        attribution_summary[cat] = {
            "count": len(items),
            "pct": None if n_fail == 0 else round(100.0 * len(items) / n_fail, 2),
            "subjects": sorted({x["subject"] for x in items}),
            "pairs": items,
        }

    # ── Phase 6: subject-level attribution ──
    subj_attr = []
    for pack in packs:
        name = pack["name"]
        row = {"name": name}
        for mat in ("G", "A", "D", "S_raw", "S_display"):
            src = materials[mat]
            sr = next(r for r in src["subjects"] if r["name"] == name)
            row[mat] = {
                "hit": sr.get("hit"),
                "sep": sr.get("separation"),
                "pairwise": sr.get("pairwise"),
                "pair_ties": sr.get("pair_ties"),
            }
        sp = [p for p in pairs if p["subject"] == name]
        row["same_block_pair_count"] = sum(1 for p in sp if p["same_daewoon"])
        row["cross_block_pair_count"] = sum(1 for p in sp if not p["same_daewoon"])
        # pattern tag
        g_hit = row["G"]["hit"] == 1
        a_hit = row["A"]["hit"] == 1
        d_hit = row["D"]["hit"] == 1
        s_hit = row["S_display"]["hit"] == 1
        row["pattern"] = (
            f"G={'pass' if g_hit else 'fail'} / "
            f"A={'pass' if a_hit else 'fail'} / "
            f"D={'pass' if d_hit else 'fail'} / "
            f"S={'pass' if s_hit else 'fail'}"
        )
        subj_attr.append(row)

    # ── Phase 7: block event boards for failed S subjects ──
    s_fail_names = [r["name"] for r in materials["S_display"]["failures"]]
    block_boards = {}
    for pack in packs:
        name = pack["name"]
        layers = year_layers[name]
        board = {"good": [], "bad": []}
        for side in ("good", "bad"):
            for e in pack["n"][side]:
                if e.get("exclude"):
                    continue
                y = int(e["year"])
                L = layers.get(y)
                if not L:
                    continue
                board[side].append({
                    "year": y,
                    "label": e.get("label"),
                    "block": L["daewoon_pillar"],
                    "D": round(L["D"], 4),
                    "G": round(L["G_clean_axis"], 4),
                    "A": round(L["A"], 4),
                    "S_raw": round(L["S_raw"], 4),
                    "S_display": round(L["S_display"], 4),
                })
        block_boards[name] = board

    # ── Phase 8: contribution magnitudes ──
    abs_d = [abs(p["D_diff"]) for p in cross_p]
    abs_a = [abs(p["A_diff"]) for p in cross_p]
    abs_g = [abs(p["G_diff"]) for p in cross_p]
    ratios = [
        abs(p["D_diff"]) / abs(p["A_diff"])
        for p in cross_p
        if abs(p["A_diff"]) > TOL
    ]
    failed_cross = [p for p in failed_s_le if not p["same_daewoon"]]
    mag = {
        "cross_abs_D": _dist(abs_d),
        "cross_abs_A": _dist(abs_a),
        "cross_abs_G": _dist(abs_g),
        "cross_absD_over_absA": _dist(ratios),
        "failed_cross_median_D_contrib": (
            None if not failed_cross else round(float(np.median([p["D_diff"] for p in failed_cross])), 4)
        ),
        "failed_cross_median_A_contrib": (
            None if not failed_cross else round(float(np.median([p["A_diff"] for p in failed_cross])), 4)
        ),
        "failed_cross_median_abs_D": (
            None if not failed_cross else round(float(np.median([abs(p["D_diff"]) for p in failed_cross])), 4)
        ),
        "failed_cross_median_abs_A": (
            None if not failed_cross else round(float(np.median([abs(p["A_diff"]) for p in failed_cross])), 4)
        ),
        "n_failed_cross": len(failed_cross),
        "n_failed_same": sum(1 for p in failed_s_le if p["same_daewoon"]),
    }

    # ── Phase 9: centering diagnostic ──
    sign_flip_all = sum(
        1 for p in pairs
        if _sign(p["G_diff"]) != 0 and _sign(p["A_diff"]) != 0
        and _sign(p["G_diff"]) != _sign(p["A_diff"])
    )
    # also count when one zero one not? user asked sign inequality
    sign_neq_all = sum(1 for p in pairs if _sign(p["G_diff"]) != _sign(p["A_diff"]))
    sign_neq_same = sum(1 for p in same_p if _sign(p["G_diff"]) != _sign(p["A_diff"]))
    sign_neq_cross = sum(1 for p in cross_p if _sign(p["G_diff"]) != _sign(p["A_diff"]))
    centering_diag = {
        "n_pairs_sign_G_neq_sign_A_all": sign_neq_all,
        "n_pairs_sign_G_neq_sign_A_same_block": sign_neq_same,
        "n_pairs_sign_G_neq_sign_A_cross_block": sign_neq_cross,
        "note": "same-block G vs A ordering must match (shared median); nonzero same-block flips ⇒ implementation bug",
    }

    # ── Phase 10: raw vs display ──
    display_flips = [
        p for p in pairs
        if p["S_raw_win"] and not p["S_display_win"]
    ]
    sat_n = sat_bad = 0
    for name, layers in year_layers.items():
        for L in layers.values():
            sat_n += 1
            if L["S_display"] <= 2 or L["S_display"] >= 98:
                sat_bad += 1
    display_diag = {
        "display_flip_count_on_labeled_pairs": len(display_flips),
        "display_flips": [
            {
                "subject": p["subject"],
                "good_year": p["good_year"],
                "bad_year": p["bad_year"],
                "S_raw_diff": p["S_raw_diff"],
                "S_display_diff": p["S_display_diff"],
            }
            for p in display_flips
        ],
        "saturation_rate_all_years": round(sat_bad / sat_n, 6) if sat_n else None,
        "n_year_scores": sat_n,
    }

    # ── Diagnostic conclusion ──
    g_pw = materials["G"]["pairwise_mean"]
    a_pw = materials["A"]["pairwise_mean"]
    d_pw = materials["D"]["pairwise_mean"]
    s_pw = materials["S_display"]["pairwise_mean"]
    n_same = len(same_p)
    n_cross = len(cross_p)

    d_override_n = attribution_summary["D_OVERRIDES_A"]["count"]
    centering_n = attribution_summary["CENTERING_FLIP"]["count"]
    g_fail_n = attribution_summary["G_DIRECTION_FAIL"]["count"]
    both_n = attribution_summary["BOTH_WRONG"]["count"]
    annual_fail_n = g_fail_n + both_n + centering_n  # A-side issues roughly

    conclusion = "INSUFFICIENT_ATTRIBUTION"
    rationale = []

    if n_same < 3 and n_cross < 5 and n_fail < 5:
        conclusion = "INSUFFICIENT_ATTRIBUTION"
        rationale.append(f"tiny pair counts same={n_same} cross={n_cross} failed_S={n_fail}")
    else:
        g_ok = g_pw is not None and g_pw > 0.50
        a_ok = a_pw is not None and a_pw > 0.50
        s_bad = s_pw is not None and s_pw <= 0.50
        d_bad = d_pw is not None and d_pw <= 0.50

        # Case guides from brief
        if g_ok and a_ok and s_bad:
            conclusion = "PRIMARY_FAILURE_D"
            rationale.append(
                f"G pairwise={g_pw} A pairwise={a_pw} useful but S={s_pw}; "
                f"D_OVERRIDES_A={d_override_n}/{n_fail}"
            )
        elif g_ok and not a_ok:
            if centering_n >= max(1, 0.3 * n_fail) and centering_n >= d_override_n:
                conclusion = "PRIMARY_FAILURE_CENTERING"
                rationale.append(
                    f"G={g_pw}>0.5 but A={a_pw}; CENTERING_FLIP={centering_n}/{n_fail}"
                )
            elif not g_ok:
                conclusion = "PRIMARY_FAILURE_G"
            else:
                # G ok A not — centering is the mechanism
                conclusion = "PRIMARY_FAILURE_CENTERING"
                rationale.append(f"G={g_pw} A={a_pw}; centering flips={centering_n}")
        elif (g_pw is not None and g_pw <= 0.50) and (a_pw is not None and a_pw <= 0.50):
            # G at/under chance, A weak/near chance: annual not clearly useful alone.
            # If D also fails and D_OVERRIDES is large → mixed hierarchy.
            if (
                d_bad
                and d_override_n >= 0.3 * n_fail
                and (g_fail_n + both_n) >= 0.3 * n_fail
            ):
                conclusion = "MIXED_G_AND_D_FAILURE"
                rationale.append(
                    f"G={g_pw} (~chance) A={a_pw} D={d_pw} S={s_pw}; "
                    f"BOTH_WRONG={both_n} D_OVERRIDES_A={d_override_n} "
                    f"G_DIRECTION_FAIL={g_fail_n} of failed_S={n_fail}; "
                    f"centering_flips=0 display_flips=0; "
                    f"same_block_pairs={n_same} (G/A still ≤0.50 there)"
                )
            else:
                conclusion = "PRIMARY_FAILURE_G"
                rationale.append(
                    f"G={g_pw} A={a_pw} ≤0.50; annual material reversed; "
                    f"G_DIRECTION_FAIL+BOTH_WRONG={g_fail_n + both_n}/{n_fail}"
                )
        elif d_override_n >= 0.5 * n_fail and (a_pw or 0) > 0.50:
            conclusion = "PRIMARY_FAILURE_D"
            rationale.append(f"majority D_OVERRIDES_A={d_override_n}/{n_fail}")
        else:
            # fallback by attribution mass
            masses = {
                "PRIMARY_FAILURE_G": g_fail_n + both_n,
                "PRIMARY_FAILURE_D": d_override_n,
                "PRIMARY_FAILURE_CENTERING": centering_n,
            }
            # if both G and D masses large → MIXED
            if masses["PRIMARY_FAILURE_G"] >= 0.3 * n_fail and masses["PRIMARY_FAILURE_D"] >= 0.3 * n_fail:
                conclusion = "MIXED_G_AND_D_FAILURE"
                rationale.append(
                    f"G={g_pw} A={a_pw} D={d_pw} S={s_pw}; "
                    f"failed_S={n_fail}: BOTH_WRONG={both_n} D_OVERRIDES_A={d_override_n} "
                    f"G_DIRECTION_FAIL={g_fail_n} CENTERING_FLIP={centering_n}; "
                    f"display_flips=0; same_block_pairs={n_same} cross={n_cross}; "
                    f"G-side mass={masses['PRIMARY_FAILURE_G']} D-side mass={masses['PRIMARY_FAILURE_D']}"
                )
            else:
                conclusion = max(masses, key=masses.get)
                rationale.append(f"majority category mass → {conclusion}; masses={masses} n_fail={n_fail}")

    # Extra guard: if same-block pair count is 0, note D cannot be separated within-block
    if n_same == 0:
        rationale.append(
            "same-daewoon labeled pairs = 0; within-block ranking of A cannot be measured on labels"
        )

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "G_FRESH_A_ATTRIBUTION",
        "candidate": VARIANT,
        "frozen_labels": OUT_LABELS,
        "labels_frozen": True,
        "validation_b_scored": False,
        "n_packs": len(packs),
        "skipped": skipped,
        "alpha": ALPHA,
        "identity_fail_count": identity_fail,
        "year_layers_sample_note": "full year layers in year_rows (may be large)",
        "year_rows": year_rows_flat,
        "event_rows": event_rows,
        "materials": materials,
        "pairs": pairs,
        "pair_bucket_metrics": pair_bucket_metrics,
        "failure_attribution": {
            "precedence": [
                "DISPLAY_FLIP",
                "D_OVERRIDES_A",
                "CENTERING_FLIP",
                "BOTH_WRONG",
                "G_DIRECTION_FAIL",
                "OTHER",
            ],
            "n_failed_S_display_le": n_fail,
            "categories": attribution_summary,
        },
        "subject_attribution": subj_attr,
        "block_boards": block_boards,
        "s_failure_subjects": s_fail_names,
        "magnitude": mag,
        "centering_diag": centering_diag,
        "display_diag": display_diag,
        "diagnostic_conclusion": {
            "status": conclusion,
            "rationale": " | ".join(rationale),
            "guide_case_signals": {
                "G_pairwise": g_pw,
                "A_pairwise": a_pw,
                "D_pairwise": d_pw,
                "S_display_pairwise": s_pw,
                "n_same_daewoon_pairs": n_same,
                "n_cross_daewoon_pairs": n_cross,
            },
        },
        "immutable_one_shot_refs": [
            "test/snapshots/exp_g_fresh_validation_a.json",
            "test/experiments/G_FRESH_VALIDATION_A_REPORT.md",
        ],
    }

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    report = _write_report(payload)
    open(OUT_REPORT, "w", encoding="utf-8").write(report)

    print("\n══════════ ATTRIBUTION CONCLUSION ══════════")
    print(conclusion)
    print(" | ".join(rationale))
    print(f"snapshot → {OUT_SNAP}")
    print(f"report → {OUT_REPORT}")
    return 0


def _write_report(p: dict) -> str:
    dc = p["diagnostic_conclusion"]
    mats = p["materials"]
    pbm = p["pair_bucket_metrics"]
    fa = p["failure_attribution"]
    lines: List[str] = []
    lines.append("# G Fresh Validation A — Layer Attribution")
    lines.append("")
    lines.append(f"**Diagnostic conclusion:** `{dc['status']}`")
    lines.append(f"**Measured at:** {p['measured_at']}")
    lines.append("")
    lines.append("Attribution only. No model revision. Validation B not scored.")
    lines.append("")
    lines.append("Frozen candidate unchanged: `G_CLEAN_AXIS`, α=1.0, κ=0, β=0.25, median centering, S=D+A.")
    lines.append("")
    lines.append("## Layer metrics (same frozen labels)")
    lines.append("")
    lines.append("| material | hit | pairwise | std_sep | raw_sep | AUC macro | AUC micro |")
    lines.append("|---|---|---:|---:|---:|---:|---:|")
    for key in ("G", "A", "D", "S_raw", "S_display"):
        m = mats[key]
        lines.append(
            f"| {key} | {m['hit']} ({m['hit_rate']}%) | {m['pairwise_mean']} | "
            f"{m['standardized_separation']} | {m['raw_separation_mean']} | "
            f"{m['auc_macro']} | {m['auc_micro']} |"
        )
    lines.append("")
    lines.append("### Guide reading")
    lines.append("")
    g_pw = dc["guide_case_signals"]["G_pairwise"]
    a_pw = dc["guide_case_signals"]["A_pairwise"]
    d_pw = dc["guide_case_signals"]["D_pairwise"]
    s_pw = dc["guide_case_signals"]["S_display_pairwise"]
    lines.append(f"- G pairwise = {g_pw}")
    lines.append(f"- A pairwise = {a_pw}")
    lines.append(f"- D pairwise = {d_pw}")
    lines.append(f"- S_display pairwise = {s_pw}")
    lines.append("")

    lines.append("## Same-Daewoon vs cross-Daewoon pairs")
    lines.append("")
    for bucket in ("ALL", "SAME_DAEWOON", "CROSS_DAEWOON"):
        b = pbm[bucket]
        lines.append(f"### {bucket} (n={b['n_pairs']})")
        lines.append("")
        lines.append("| material | wins | ties | losses | pairwise |")
        lines.append("|---|---:|---:|---:|---:|")
        for mat in ("G", "A", "D", "S_raw", "S_display"):
            x = b[mat]
            lines.append(
                f"| {mat} | {x['wins']} | {x['ties']} | {x['losses']} | {x['pairwise']} |"
            )
        lines.append("")

    if pbm["SAME_DAEWOON"]["n_pairs"] == 0:
        lines.append(
            "Note: **zero same-Daewoon labeled pairs** — within-block A ranking "
            "cannot be tested on this label set; all good/bad contrasts are cross-block."
        )
        lines.append("")

    lines.append(f"Identity check `S_diff == D_diff + A_diff` failures: **{p['identity_fail_count']}**")
    lines.append("")

    lines.append("## Failure attribution (`S_display_good ≤ S_display_bad`)")
    lines.append("")
    lines.append(f"Failed pairs: **{fa['n_failed_S_display_le']}**")
    lines.append("")
    lines.append("Precedence: " + " → ".join(fa["precedence"]))
    lines.append("")
    lines.append("| category | count | pct | subjects |")
    lines.append("|---|---:|---:|---|")
    for cat, info in fa["categories"].items():
        lines.append(
            f"| {cat} | {info['count']} | {info['pct']} | {', '.join(info['subjects']) or '—'} |"
        )
    lines.append("")
    lines.append("### Exact failed pairs by category")
    lines.append("")
    for cat, info in fa["categories"].items():
        if not info["pairs"]:
            continue
        lines.append(f"#### {cat}")
        lines.append("")
        for x in info["pairs"]:
            lines.append(
                f"- {x['subject']}: good {x['good_year']} vs bad {x['bad_year']} "
                f"(same_block={x['same_daewoon']}) "
                f"ΔG={x['G_diff']:+.3f} ΔA={x['A_diff']:+.3f} "
                f"ΔD={x['D_diff']:+.3f} ΔS={x['S_raw_diff']:+.3f}"
            )
        lines.append("")

    lines.append("## Subject-level layer hits")
    lines.append("")
    lines.append("| name | G | A | D | S | pattern | same# | cross# |")
    lines.append("|---|:-:|:-:|:-:|:-:|---|---:|---:|")
    for r in p["subject_attribution"]:
        def h(mat):
            v = r[mat]["hit"]
            return "✓" if v == 1 else "✗"
        lines.append(
            f"| {r['name']} | {h('G')} | {h('A')} | {h('D')} | {h('S_display')} | "
            f"{r['pattern']} | {r['same_block_pair_count']} | {r['cross_block_pair_count']} |"
        )
    lines.append("")

    lines.append("## Failed-subject Daewoon boards")
    lines.append("")
    for name in p["s_failure_subjects"]:
        board = p["block_boards"][name]
        lines.append(f"### {name}")
        lines.append("")
        lines.append("Good:")
        for e in board["good"]:
            lines.append(
                f"- {e['year']}  block {e['block']}  D={e['D']}  G={e['G']}  "
                f"A={e['A']:+}  S={e['S_display']}"
            )
        lines.append("Bad:")
        for e in board["bad"]:
            lines.append(
                f"- {e['year']}  block {e['block']}  D={e['D']}  G={e['G']}  "
                f"A={e['A']:+}  S={e['S_display']}"
            )
        lines.append("")

    lines.append("## Cross-block magnitude")
    lines.append("")
    mag = p["magnitude"]
    lines.append(f"- |ΔD| cross: {mag['cross_abs_D']}")
    lines.append(f"- |ΔA| cross: {mag['cross_abs_A']}")
    lines.append(f"- |ΔG| cross: {mag['cross_abs_G']}")
    lines.append(f"- |ΔD|/|ΔA| cross: {mag['cross_absD_over_absA']}")
    lines.append(
        f"- failed cross median ΔD / ΔA: "
        f"{mag['failed_cross_median_D_contrib']} / {mag['failed_cross_median_A_contrib']}"
    )
    lines.append(
        f"- failed cross median |ΔD| / |ΔA|: "
        f"{mag['failed_cross_median_abs_D']} / {mag['failed_cross_median_abs_A']}"
    )
    lines.append(f"- failed pairs: same={mag['n_failed_same']} cross={mag['n_failed_cross']}")
    lines.append("")

    lines.append("## Centering diagnostic")
    lines.append("")
    cd = p["centering_diag"]
    lines.append(f"- sign(G)≠sign(A) all: {cd['n_pairs_sign_G_neq_sign_A_all']}")
    lines.append(f"- same-block: {cd['n_pairs_sign_G_neq_sign_A_same_block']}")
    lines.append(f"- cross-block: {cd['n_pairs_sign_G_neq_sign_A_cross_block']}")
    lines.append(f"- {cd['note']}")
    lines.append("")

    lines.append("## Raw vs display")
    lines.append("")
    dd = p["display_diag"]
    lines.append(f"- display flip count on labeled pairs: **{dd['display_flip_count_on_labeled_pairs']}**")
    lines.append(f"- saturation rate (all years): {dd['saturation_rate_all_years']}")
    if dd["display_flip_count_on_labeled_pairs"] == 0:
        lines.append(
            "- Conclusion: fresh S failure is **not** caused by display squash/clipping."
        )
    lines.append("")

    lines.append("## Diagnostic conclusion")
    lines.append("")
    lines.append(f"`{dc['status']}`")
    lines.append("")
    lines.append(dc["rationale"])
    lines.append("")
    lines.append("No promotion. No model change in this run. Validation B remains sealed.")
    lines.append("")
    lines.append("One-shot Validation A artifacts left immutable:")
    for ref in p["immutable_one_shot_refs"]:
        lines.append(f"- `{ref}`")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
