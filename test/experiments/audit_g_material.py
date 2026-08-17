# -*- coding: utf-8 -*-
"""
G material forensic audit (diagnosis only — no retune, no engine edit).

Writes:
  test/snapshots/exp_g_audit.json
  (G_AUDIT.md written separately from these numbers)

Usage:
  python test/experiments/audit_g_material.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_b, arm_b9, common as C  # noqa: E402
from experiments import diag_b9a_alpha_select as DIAG  # noqa: E402
from experiments import md_labels as MD  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_g_audit.json")

# Frozen B9 hierarchy — do not change
ALPHA = 1.0
KAPPA = 0.0


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def _pct(a: np.ndarray, q: float) -> Optional[float]:
    if a.size == 0:
        return None
    return round(float(np.percentile(a, q)), 4)


def _summary(xs: Sequence[float]) -> Dict[str, Any]:
    a = np.asarray([x for x in xs if x == x], dtype=float)
    if a.size == 0:
        return {"n": 0}
    return {
        "n": int(a.size),
        "mean": round(float(np.mean(a)), 4),
        "sd": round(float(np.std(a, ddof=1)) if a.size > 1 else 0.0, 4),
        "p05": _pct(a, 5),
        "p50": _pct(a, 50),
        "p95": _pct(a, 95),
    }


def _pearson(xs: Sequence[float], ys: Sequence[float]) -> Optional[float]:
    a = np.asarray(xs, dtype=float)
    b = np.asarray(ys, dtype=float)
    if a.size < 3 or a.size != b.size:
        return None
    if float(np.std(a)) < 1e-12 or float(np.std(b)) < 1e-12:
        return None
    return round(float(np.corrcoef(a, b)[0, 1]), 4)


def _decompose(meta: dict, cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Fully expanded intermediate signals for one year (mirrors arm_b._axis_scores)."""
    bd = (meta or {}).get("breakdown") or {}
    yfit_raw = float(bd.get("yongshin_fit") or 0.0)
    yfit = arm_b._scaled_yfit(yfit_raw, cfg)
    rel = float(bd.get("relations") or 0.0)
    struct = float(bd.get("structural_adj") or 0.0)
    uns = float(bd.get("unseong") or 0.0)
    bal = float(bd.get("balance") or 0.0)
    close = float(((meta or {}).get("candle") or {}).get("close") or 50.0)

    tg_s = meta.get("세운_십성_천간") or ""
    tg_b = meta.get("세운_십성_지지") or ""
    ilju = meta.get("세운_일주관계") or []
    if not isinstance(ilju, list):
        ilju = []

    career_tg = 0.0
    for tg in (tg_s, tg_b):
        if tg in ("정관", "편관", "정재", "편재", "식신"):
            career_tg += 2.2
        elif tg in ("상관", "겁재"):
            career_tg -= 1.0
        elif tg in ("편인", "정인"):
            career_tg += 0.5

    health_shock = 0.0
    rel_bond = 0.0
    conflict = False
    for s in ilju:
        t = str(s)
        if "충" in t or "형" in t:
            health_shock -= 4.0
            conflict = True
        elif "파" in t or "해" in t:
            health_shock -= 2.0
        if "극" in t or "갈등" in t:
            conflict = True
        if "합" in t or "배우자" in t or "인연" in t:
            rel_bond += 3.0

    yfit_c = yfit * (
        cfg["yfit_career_conflict"] if (conflict and yfit > 0) else cfg["yfit_career_normal"]
    )
    career_pen = cfg["career_conflict_pen"] if conflict else 0.0
    has_hap = any(("합" in str(s) or "인연" in str(s) or "배우자" in str(s)) for s in ilju)

    discord = 0.0
    if (
        yfit_raw >= float(cfg["discord_yfit_min"])
        and rel <= float(cfg["discord_rel_max"])
        and not has_hap
    ):
        if (not cfg.get("require_risk_gate")) or arm_b._risk_gate(
            meta or {}, cfg, yfit_raw, ilju
        ):
            discord = float(cfg["discord_pen"])

    risk = 0.0
    hyung_pen = 0.0
    yangin_pen = 0.0
    if discord and not has_hap:
        hyung_pen = arm_b._hyungsal_pen(meta or {}, cfg)
        yangin_pen = arm_b._yangin_pen(meta or {}, cfg)
        risk = hyung_pen + yangin_pen

    hollow = arm_b._hollow_boom(yfit_raw, bal, rel, conflict, has_hap, cfg)
    friction = arm_b._yangin_geopsal_friction(meta or {}, rel, has_hap, cfg)
    health_x = arm_b._health_guan_crisis(yfit_raw, tg_s, tg_b, has_hap, cfg)
    pattern = hollow + friction + health_x
    base = float(cfg["base"])

    career = _clamp(
        base
        + yfit_c
        + rel * cfg["rel_weight"]
        + struct * cfg["struct_career"]
        + uns * 0.15
        + career_tg
        + career_pen
        + discord * 0.85
        + risk * 0.55
        + pattern * 0.8
    )
    health = _clamp(
        base
        + yfit * cfg["yfit_health"]
        + struct * cfg["struct_health"]
        + bal * 0.45
        + health_shock
        - career_tg * 0.35
        + uns * 0.1
        + discord * 0.55
        + risk * 0.7
        + pattern * 0.5
    )
    relationship = _clamp(
        base
        + yfit * cfg["yfit_rel"]
        + rel * cfg["rel_weight"]
        + rel_bond
        + bal * 0.25
        + uns * 0.1
        + risk * 0.35
        + pattern * 0.35
    )
    general = _clamp(
        cfg["w_career"] * career
        + cfg["w_health"] * health
        + cfg["w_relationship"] * relationship
        + discord * 0.45
        + risk * 0.4
        + pattern * 0.55
    )

    # verify against arm_b
    ref = arm_b._axis_scores(meta, cfg)
    return {
        "primitives": {
            "yfit_raw": yfit_raw,
            "yfit_scaled": yfit,
            "relations": rel,
            "structural_adj": struct,
            "unseong": uns,
            "balance": bal,
            "close": close,
            "career_tg": career_tg,
            "health_shock": health_shock,
            "rel_bond": rel_bond,
            "conflict": conflict,
            "has_hap": has_hap,
        },
        "patterns": {
            "discord": discord,
            "hyungsal_pen": hyung_pen,
            "yangin_pen": yangin_pen,
            "risk": risk,
            "hollow": hollow,
            "friction": friction,
            "health_guan": health_x,
            "pattern": pattern,
            "career_conflict_pen": career_pen,
        },
        "axes": {
            "career": career,
            "health": health,
            "relationship": relationship,
            "general": general,
        },
        "weighted_axis": {
            "w_career_term": cfg["w_career"] * career,
            "w_health_term": cfg["w_health"] * health,
            "w_rel_term": cfg["w_relationship"] * relationship,
            "extra_discord": discord * 0.45,
            "extra_risk": risk * 0.4,
            "extra_pattern": pattern * 0.55,
        },
        "match_arm_b": {
            "career": abs(career - ref["career"]) < 0.15,
            "health": abs(health - ref["health"]) < 0.15,
            "relationship": abs(relationship - ref["relationship"]) < 0.15,
            "general": abs(general - ref["general"]) < 0.15,
        },
        "ref": ref,
    }


def _g_from_mode(meta: dict, mode: str, cfg: Dict[str, Any]) -> float:
    """Ablation / baseline G variants. Hierarchy untouched; only G material changes."""
    d = _decompose(meta, cfg)
    c, h, r = d["axes"]["career"], d["axes"]["health"], d["axes"]["relationship"]
    pat = d["patterns"]
    discord, risk, pattern = pat["discord"], pat["risk"], pat["pattern"]

    if mode == "current":
        return float(d["axes"]["general"])
    if mode == "equal_weights":
        return _clamp(
            (c + h + r) / 3.0
            + discord * 0.45
            + risk * 0.4
            + pattern * 0.55
        )
    if mode == "career_only":
        return float(c)
    if mode == "health_only":
        return float(h)
    if mode == "relationship_only":
        return float(r)
    if mode == "axes_no_pattern_extras":
        # zero pattern/discord/risk inside axes AND strip extras on G
        # rebuild axes without discord/risk/pattern/career_pen
        base = float(cfg["base"])
        yfit = d["primitives"]["yfit_scaled"]
        yfit_raw = d["primitives"]["yfit_raw"]
        rel = d["primitives"]["relations"]
        struct = d["primitives"]["structural_adj"]
        uns = d["primitives"]["unseong"]
        bal = d["primitives"]["balance"]
        career_tg = d["primitives"]["career_tg"]
        health_shock = d["primitives"]["health_shock"]
        rel_bond = d["primitives"]["rel_bond"]
        conflict = d["primitives"]["conflict"]
        yfit_c = yfit * (
            cfg["yfit_career_conflict"] if (conflict and yfit > 0) else cfg["yfit_career_normal"]
        )
        career = _clamp(
            base + yfit_c + rel * cfg["rel_weight"] + struct * cfg["struct_career"]
            + uns * 0.15 + career_tg
        )
        health = _clamp(
            base + yfit * cfg["yfit_health"] + struct * cfg["struct_health"]
            + bal * 0.45 + health_shock - career_tg * 0.35 + uns * 0.1
        )
        relationship = _clamp(
            base + yfit * cfg["yfit_rel"] + rel * cfg["rel_weight"]
            + rel_bond + bal * 0.25 + uns * 0.1
        )
        return _clamp(
            cfg["w_career"] * career
            + cfg["w_health"] * health
            + cfg["w_relationship"] * relationship
        )
    if mode == "pattern_only":
        # diagnostic: base + pattern family stack only (not a real score)
        return _clamp(50.0 + discord + risk + pattern + pat["career_conflict_pen"])
    if mode == "no_career":
        w_h, w_r = cfg["w_health"], cfg["w_relationship"]
        s = w_h + w_r
        return _clamp(
            (w_h / s) * h
            + (w_r / s) * r
            + discord * 0.45
            + risk * 0.4
            + pattern * 0.55
        )
    if mode == "no_health":
        w_c, w_r = cfg["w_career"], cfg["w_relationship"]
        s = w_c + w_r
        return _clamp(
            (w_c / s) * c
            + (w_r / s) * r
            + discord * 0.45
            + risk * 0.4
            + pattern * 0.55
        )
    if mode == "no_relationship":
        w_c, w_h = cfg["w_career"], cfg["w_health"]
        s = w_c + w_h
        return _clamp(
            (w_c / s) * c
            + (w_h / s) * h
            + discord * 0.45
            + risk * 0.4
            + pattern * 0.55
        )
    if mode == "no_pattern_penalties":
        # keep axes but zero pattern/discord/risk contributions that were baked in —
        # approximate by subtracting their known additive terms from general
        # Better: rebuild like axes_no_pattern but KEEP career_conflict? User asked no pattern penalties
        return _g_from_mode(meta, "axes_no_pattern_extras", cfg)
    if mode == "no_discord":
        # remove discord from axes + extras (keep hollow/friction/health_x/risk partially)
        # rebuild with discord forced 0
        cfg2 = deepcopy(cfg)
        # force by zeroing threshold so discord never fires
        cfg2["discord_yfit_min"] = 1e9
        return float(_decompose(meta, cfg2)["axes"]["general"])
    if mode == "no_hollow":
        cfg2 = deepcopy(cfg)
        cfg2["hollow_pen"] = 0.0
        return float(_decompose(meta, cfg2)["axes"]["general"])
    if mode == "no_friction":
        cfg2 = deepcopy(cfg)
        cfg2["yangin_geopsal_pen"] = 0.0
        return float(_decompose(meta, cfg2)["axes"]["general"])
    if mode == "no_health_guan":
        cfg2 = deepcopy(cfg)
        cfg2["health_guan_pen"] = 0.0
        return float(_decompose(meta, cfg2)["axes"]["general"])
    if mode == "no_risk":
        cfg2 = deepcopy(cfg)
        cfg2["hyungsal_pen"] = 0.0
        cfg2["yangin_risk_pen"] = 0.0
        cfg2["hyungsal_cap"] = 0.0
        return float(_decompose(meta, cfg2)["axes"]["general"])
    raise ValueError(mode)


def _b9_scores_from_g_map(
    pack: Dict[str, Any],
    g_by_y: Dict[int, float],
) -> Dict[int, float]:
    """B9-A display S with α=1, custom G materials, frozen D."""
    d_map = pack["d_map"]
    meta = pack["meta"]
    # rebuild A within block from custom G
    by_p: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    for y, m in meta.items():
        p = str(m.get("대운_pillar") or "_")
        if p not in d_map:
            continue
        g = g_by_y.get(int(y))
        if g is None:
            continue
        by_p[p].append((int(y), float(g)))
    out: Dict[int, float] = {}
    for p, pairs in by_p.items():
        gs = [g for _, g in pairs]
        c_b = float(np.median(gs)) if gs else 50.0
        d_b = float(d_map[p])
        for y, g in pairs:
            a = g - c_b
            out[y] = float(arm_b9.squash(d_b + ALPHA * a))
    return out


def _year_metrics(
    packs: List[Dict[str, Any]],
    score_maps: List[Dict[int, float]],
    bucket: str,
) -> Dict[str, Any]:
    # series_list only needed for pooled_sd over display S values
    series_list = [{"S": list(sm.values())} for sm in score_maps]
    return DIAG._cohort_metrics(packs, score_maps, series_list, bucket)


def _subject_hit_table(
    packs: List[Dict[str, Any]],
    score_maps: List[Dict[int, float]],
) -> List[Dict[str, Any]]:
    rows = []
    for pack, smap in zip(packs, score_maps):
        n = pack["n"]
        name = n["name"]
        good, bad = C.prepare_events(n, pack["close"], exclude_collisions=True)
        ga, gu = C.wavg(good, smap)
        ba, bu = C.wavg(bad, smap)
        if gu < 2 or bu < 2 or ga != ga or ba != ba:
            continue
        rows.append({
            "name": name,
            "bucket": C.cohort_bucket(name),
            "hit": 1 if ga > ba else 0,
            "sep": round(float(ga - ba), 4),
            "good_avg": round(float(ga), 2),
            "bad_avg": round(float(ba), 2),
        })
    return rows


def _flip_report(
    base_rows: List[Dict[str, Any]],
    alt_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    b = {r["name"]: r for r in base_rows}
    a = {r["name"]: r for r in alt_rows}
    flips = []
    for name, br in b.items():
        ar = a.get(name)
        if not ar:
            continue
        if br["hit"] != ar["hit"]:
            flips.append({
                "name": name,
                "bucket": br["bucket"],
                "base_hit": br["hit"],
                "alt_hit": ar["hit"],
                "base_sep": br["sep"],
                "alt_sep": ar["sep"],
            })
    return {"n_flips": len(flips), "flips": flips}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ G material forensic audit ══════════")
    print("B9 hierarchy frozen α=1 κ=0 · G diagnosis only · no optimizer\n")

    cfg = dict(arm_b.ARM_B_CONFIG)
    packs = SW._preload(C.filter_primary(C.load_core_subjects()))
    print(f"subjects={len(packs)}")

    # ── empirical contribution ──
    career_v, health_v, rel_v, g_v = [], [], [], []
    a_v = []  # A_y
    block_sds = {"career": [], "health": [], "relationship": [], "general": []}
    pattern_hits = defaultdict(list)
    match_ok = True
    close_corr_g = []

    all_decomp_years = 0
    for pack in packs:
        meta = pack["meta"]
        # per pillar for within-block SD and A_y
        by_p: Dict[str, List[Dict[str, float]]] = defaultdict(list)
        for y, m in meta.items():
            d = _decompose(m, cfg)
            if not all(d["match_arm_b"].values()):
                match_ok = False
            ax = d["axes"]
            career_v.append(ax["career"])
            health_v.append(ax["health"])
            rel_v.append(ax["relationship"])
            g_v.append(ax["general"])
            close_corr_g.append((d["primitives"]["close"], ax["general"]))
            by_p[str(m.get("대운_pillar") or "_")].append(ax)
            for k, v in d["patterns"].items():
                if abs(float(v)) > 1e-9:
                    pattern_hits[k].append(float(v))
            all_decomp_years += 1

        for rows in by_p.values():
            if len(rows) < 2:
                continue
            for key in ("career", "health", "relationship", "general"):
                vals = [r[key] for r in rows]
                block_sds[key].append(float(np.std(vals, ddof=1)))
            gs = [r["general"] for r in rows]
            med = float(np.median(gs))
            for g in gs:
                a_v.append(g - med)

    closes = [c for c, _ in close_corr_g]
    gens = [g for _, g in close_corr_g]

    # effective influence
    eff = {}
    for key, w in (
        ("career", cfg["w_career"]),
        ("health", cfg["w_health"]),
        ("relationship", cfg["w_relationship"]),
    ):
        wb = block_sds[key]
        med_sd = float(np.median(wb)) if wb else 0.0
        eff[key] = {
            "nominal_weight": w,
            "within_block_sd_p50": round(med_sd, 4),
            "effective_w_x_sd": round(w * med_sd, 4),
            "pop_sd": _summary(
                {"career": career_v, "health": health_v, "relationship": rel_v}[key]
            )["sd"],
        }

    # variance share via weighted axis terms on A_y path: permute one axis
    # Simple: SD of w*axis within block vs others
    contrib = {
        "axis_distributions": {
            "career": _summary(career_v),
            "health": _summary(health_v),
            "relationship": _summary(rel_v),
            "general_G": _summary(g_v),
            "A_y": _summary(a_v),
        },
        "within_block_sd": {k: _summary(v) for k, v in block_sds.items()},
        "correlations": {
            "career_health": _pearson(career_v, health_v),
            "career_relationship": _pearson(career_v, rel_v),
            "health_relationship": _pearson(health_v, rel_v),
            "career_G": _pearson(career_v, g_v),
            "health_G": _pearson(health_v, g_v),
            "relationship_G": _pearson(rel_v, g_v),
            "G_vs_Control_close": _pearson(gens, closes),
        },
        "effective_influence": eff,
        "pattern_activation": {
            k: {"n_nonzero": len(v), "rate": round(len(v) / max(all_decomp_years, 1), 4),
                "dist": _summary(v)}
            for k, v in pattern_hits.items()
        },
        "decompose_match_arm_b": match_ok,
        "n_year_obs": all_decomp_years,
    }

    print("── contribution ──")
    print("effective:", json.dumps(eff, ensure_ascii=False))
    print("corr axes:", contrib["correlations"])

    # ── ablations & baselines on B9-A year labels ──
    modes = [
        "current",
        "equal_weights",
        "career_only",
        "health_only",
        "relationship_only",
        "axes_no_pattern_extras",
        "pattern_only",
        "no_career",
        "no_health",
        "no_relationship",
        "no_pattern_penalties",
        "no_discord",
        "no_hollow",
        "no_friction",
        "no_health_guan",
        "no_risk",
    ]

    results = {}
    base_subj = None
    for mode in modes:
        score_maps = []
        for pack in packs:
            gmap = {int(y): _g_from_mode(m, mode, cfg) for y, m in pack["meta"].items()}
            score_maps.append(_b9_scores_from_g_map(pack, gmap))
        train = _year_metrics(packs, score_maps, "train")
        hold = _year_metrics(packs, score_maps, "holdout")
        subj = _subject_hit_table(packs, score_maps)
        if mode == "current":
            base_subj = subj
        flips = _flip_report(base_subj or subj, subj) if base_subj else {"n_flips": 0, "flips": []}
        results[mode] = {
            "train": train,
            "holdout": hold,
            "subject_hit_rate": round(
                100.0 * sum(r["hit"] for r in subj) / len(subj), 2
            ) if subj else None,
            "n_subjects": len(subj),
            "flips_vs_current": flips if mode != "current" else {"n_flips": 0, "flips": []},
            "worst_subjects": sorted(subj, key=lambda r: (r["hit"], r["sep"]))[:5],
        }
        print(
            f"  {mode:28s} train_hit={train.get('hit_rate')} "
            f"hold_hit={hold.get('hit_rate')} "
            f"hold_std={hold.get('std_sep')} "
            f"flips={flips.get('n_flips')}"
        )

    # permutation importance proxy: SD of holdout std_sep drop when removing component
    perm = {}
    base_std = results["current"]["holdout"].get("std_sep") or 0
    for mode in (
        "no_career", "no_health", "no_relationship",
        "no_pattern_penalties", "no_discord", "no_hollow",
        "no_friction", "no_health_guan", "no_risk",
    ):
        alt = results[mode]["holdout"].get("std_sep")
        if alt is None:
            continue
        perm[mode] = {
            "delta_holdout_std_sep": round(float(alt) - float(base_std), 4),
            "delta_holdout_hit": round(
                float(results[mode]["holdout"].get("hit_rate") or 0)
                - float(results["current"]["holdout"].get("hit_rate") or 0),
                4,
            ),
            "n_flips": results[mode]["flips_vs_current"]["n_flips"],
        }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "G_material_audit",
        "frozen_hierarchy": {"alpha": ALPHA, "kappa": KAPPA, "note": "unchanged"},
        "cfg_snapshot": {
            k: cfg[k]
            for k in (
                "w_career", "w_health", "w_relationship", "base",
                "yfit_career_normal", "yfit_career_conflict", "career_conflict_pen",
                "yfit_health", "yfit_rel", "rel_weight",
                "struct_career", "struct_health",
                "yfit_pos_scale", "discord_yfit_min", "discord_rel_max", "discord_pen",
                "hollow_pen", "yangin_geopsal_pen", "health_guan_pen",
                "yangin_risk_pen", "hyungsal_pen", "hyungsal_cap",
            )
            if k in cfg
        },
        "contribution": contrib,
        "permutation_proxy": perm,
        "ablations_and_baselines": results,
        "notes": [
            "Ablations change G material only; D and α fixed.",
            "no_* axis ablations re-normalize remaining axis weights to sum 1.",
            "pattern_only is diagnostic, not a valid life-quality score.",
            "w_career/w_health/w_relationship were NOT in Phase A/D HP search space.",
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
