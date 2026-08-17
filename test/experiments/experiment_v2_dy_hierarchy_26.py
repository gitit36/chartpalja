# -*- coding: utf-8 -*-
"""
V2 Phase 2.6 — Confidence-gated Daewoon → Sewoon hierarchy.

REFERENCE: V2_DY_B
H1: V2_DY_GATE_D_ONLY
H2: V2_DY_GATE_D_PLUS_DY

No Month/Day. No Val B. No engine edits. No H3. No G redesign.
No orthodox contextual year trigger as annual valence.

Usage:
  PYTHONPATH=.:test python test/experiments/experiment_v2_dy_hierarchy_26.py
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

from experiments import arm_b  # noqa: E402
from experiments import experiment_v2_dy as B  # noqa: E402
from experiments import experiment_v2_dy_orthodox as O  # noqa: E402
from experiments.experiment_g_clean import score_g  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS, _pairwise  # noqa: E402
import saju_engine as se  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_dy_hierarchy_26.json")
OUT_REPORT = os.path.join(_HERE, "V2_DY_HIERARCHY_26_REPORT.md")
OUT_PARENT = os.path.join(_HERE, "V2_DY_PARENT_CORRECTION_ANALYSIS.md")
OUT_GATE = os.path.join(_HERE, "V2_DY_REGIME_GATE_AUDIT.md")

VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0
TIE_BAND = 0.015
REF = "V2_DY_B"
H1 = "V2_DY_GATE_D_ONLY"
H2 = "V2_DY_GATE_D_PLUS_DY"

# Predeclared gated amplitude maps (signed points at |dir|=1)
GATE_AMP = {
    "CONSERVATIVE": {"LOW": 0.0, "MEDIUM": 2.0, "HIGH": 6.0, "TRANSFORMATIVE": 10.0},
    "BALANCED": {"LOW": 0.0, "MEDIUM": 3.0, "HIGH": 9.0, "TRANSFORMATIVE": 14.0},
    "EXPRESSIVE": {"LOW": 1.0, "MEDIUM": 4.0, "HIGH": 12.0, "TRANSFORMATIVE": 18.0},
}

# D×Y bounds by gate (H2 only)
DY_BOUNDS = {
    "LOW": (0.0, 0.0),
    "MEDIUM": (0.6, 1.5),
    "HIGH": (1.0, 2.5),
    "TRANSFORMATIVE": (1.2, 3.0),
}

GATE_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "TRANSFORMATIVE": 3}

# Independent evidence groups (Phase 2.5 dims)
EVIDENCE_GROUPS = {
    "ELEMENTAL_USEFULNESS": ("elemental_environment_shift", "yong_xiang_support_shift"),
    "STRUCTURAL_STATE": ("structural_activation_shift", "geju_state_change"),
    "ROOTING_MANIFESTATION": ("rooting_exposure_change", "stem_branch_convergence"),
    "RELATION_STRUCTURE": ("major_relation_change",),
    "KEY_PILLAR": ("key_pillar_change",),
    "SEASONAL_TIAOHOU": ("tiaohou_change",),
    "SPECIAL_STRUCTURE": ("special_structure_change",),
}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def _natal_confidence(nc: dict) -> float:
    c = 1.0
    if nc.get("xiangshen_uncertain"):
        c -= 0.10
    if nc.get("special") == "normal" and not (nc.get("geju_type") or "").strip():
        c -= 0.05
    if nc.get("special") in ("follow", "transform"):
        # known special — slight uncertainty unless clear fav
        c -= 0.08
    if not nc.get("tiaohou_usable"):
        c -= 0.05
    if not (nc.get("strength_regime") or "").strip():
        c -= 0.07
    return float(np.clip(c, 0.45, 1.0))


def _independent_groups(dims: dict, signed: dict) -> Tuple[int, int, int, List[str]]:
    """Return n_agree_pos_groups, n_agree_neg_groups, n_contradicting_pairs_proxy, active_groups."""
    pos_g, neg_g, mixed_g, active = [], [], [], []
    for gname, keys in EVIDENCE_GROUPS.items():
        vals = []
        for k in keys:
            st = dims.get(k, "inactive")
            if st == "inactive":
                continue
            vals.append(float(signed.get(k, 0.0)))
        if not vals:
            continue
        active.append(gname)
        s = float(np.mean(vals))
        if abs(s) < 0.05 or any(dims.get(k) == "ambiguous" for k in keys if dims.get(k) != "inactive"):
            mixed_g.append(gname)
        elif s > 0:
            pos_g.append(gname)
        else:
            neg_g.append(gname)
    n_pos, n_neg = len(pos_g), len(neg_g)
    contrad = min(n_pos, n_neg) + (1 if mixed_g and (n_pos or n_neg) else 0)
    n_agree = max(n_pos, n_neg)
    return n_agree, contrad, len(active), active


def _compute_gate(ev: dict, natal_conf: float) -> Dict[str, Any]:
    dims, signed = ev["dims"], ev["signed"]
    n_agree, contrad, n_active, active = _independent_groups(dims, signed)
    direction = float(ev["direction_score"])
    abs_dir = abs(direction)
    conf_eff = float(ev["confidence"]) * natal_conf
    intensity = float(ev.get("event_intensity") or 0.0)

    # Signed gate
    if n_agree <= 1 or abs_dir < 0.15 or contrad >= 2 or conf_eff < 0.45:
        gate = "LOW"
    elif n_agree >= 4 and abs_dir >= 0.40 and contrad == 0 and conf_eff >= 0.70:
        gate = "TRANSFORMATIVE"
    elif n_agree >= 3 and abs_dir >= 0.25 and contrad == 0 and conf_eff >= 0.55:
        gate = "HIGH"
    elif n_agree >= 2 and abs_dir >= 0.15 and contrad <= 1:
        gate = "MEDIUM"
    else:
        gate = "LOW"

    # High intensity / strength without clear valence → restrain signed gate
    restrain_signed = False
    if abs_dir < 0.20 and n_agree >= 3:
        restrain_signed = True
        if GATE_RANK[gate] > GATE_RANK["MEDIUM"]:
            gate = "MEDIUM"
        intensity = max(intensity, 1.5)

    return {
        "gate": gate,
        "n_indep_agree": n_agree,
        "contradiction_groups": contrad,
        "n_active_groups": n_active,
        "active_groups": active,
        "direction": round(direction, 4),
        "abs_direction": round(abs_dir, 4),
        "confidence_eff": round(conf_eff, 4),
        "natal_confidence": round(natal_conf, 4),
        "restrain_signed": restrain_signed,
        "event_intensity": round(intensity, 4),
        "legacy_strength_class": ev.get("strength_class"),
    }


def _d_correction(gate_info: dict, h_b: float, amp_name: str) -> Tuple[float, float]:
    table = GATE_AMP[amp_name]
    gate = gate_info["gate"]
    mag = table[gate]
    # blend B direction with orthodox direction
    dir_unit = float(np.tanh(0.7 * np.tanh(h_b) + 0.3 * gate_info["direction"]))
    if gate_info["restrain_signed"] or abs(gate_info["direction"]) < 0.12:
        dir_unit *= 0.35
    conf_eff = gate_info["confidence_eff"]
    corr = dir_unit * mag * (0.70 + 0.30 * conf_eff)
    return float(corr), float(dir_unit)


def _dy_signed(gate: str, reinforce: float, dy_v: float, ambiguous: bool) -> float:
    if ambiguous or gate == "LOW":
        return 0.0
    kappa, cap = DY_BOUNDS[gate]
    raw = kappa * (1.0 * reinforce + 0.4 * dy_v)
    return float(np.clip(raw, -cap, cap))


def _annual_metrics(packs, score_maps) -> Dict[str, Any]:
    rows, pairs, seps, all_s = [], [], [], []
    for pack, smap in zip(packs, score_maps):
        all_s.extend(smap.values())
        good = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        ga, gu = B.C.wavg(good, smap)
        ba, bu = B.C.wavg(bad, smap)
        if gu < 1 or bu < 1 or ga != ga or ba != ba:
            continue
        gs = [smap[int(e["year"])] for e in good if int(e["year"]) in smap]
        bs = [smap[int(e["year"])] for e in bad if int(e["year"]) in smap]
        pr = _pairwise(gs, bs)
        if pr is not None:
            pairs.append(pr)
        sep = float(ga - ba)
        seps.append(sep)
        rows.append({
            "name": pack["name"], "hit": 1 if ga > ba else 0,
            "sep": round(sep, 4), "pairwise": None if pr is None else round(pr, 4),
        })
    hits = [r["hit"] for r in rows]
    sd = float(np.std(all_s, ddof=1)) if len(all_s) > 1 else float("nan")
    raw = float(np.mean(seps)) if seps else float("nan")
    std = raw / sd if sd and sd > 1e-12 else float("nan")
    return {
        "n": len(rows),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "hit_rate": None if not hits else round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pairs else round(float(np.mean(pairs)), 4),
        "raw_sep_mean": None if raw != raw else round(raw, 4),
        "std_sep": None if std != std else round(std, 4),
        "subjects": rows,
        "failures": [r for r in rows if r["hit"] == 0],
    }


def _pair_regime_diff(g_i: dict, g_j: dict) -> Tuple[float, str]:
    ddir = abs(g_i["direction"] - g_j["direction"])
    drank = abs(GATE_RANK[g_i["gate"]] - GATE_RANK[g_j["gate"]]) / 3.0
    score = 0.5 * ddir + 0.5 * drank
    if (g_i["gate"] == "TRANSFORMATIVE" or g_j["gate"] == "TRANSFORMATIVE") and ddir >= 0.35:
        cls = "TRANSFORM"
    elif score >= 0.55:
        cls = "HIGH"
    elif score >= 0.25:
        cls = "MEDIUM"
    else:
        cls = "LOW"
    return float(score), cls


def _parent_matrix(packs, layers_list) -> Dict[str, Any]:
    """PARENT_HELP / PARENT_HARM with full matrix + stratifications."""
    counts = defaultdict(int)
    by_gate = defaultdict(lambda: defaultdict(int))
    by_rdiff = defaultdict(lambda: defaultdict(int))
    same_pairs, cross_pairs = [], []
    cross_by_rdiff = defaultdict(list)
    high_pairs = []
    harm = help_ = n = 0
    same_n = cross_n = 0

    for pack, layers in zip(packs, layers_list):
        goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
        bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
        for ge, be in product(goods, bads):
            Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
            da = Lg["A"] - Lb["A"]
            dg = Lg["D"] - Lb["D"]
            ds = Lg["Y"] - Lb["Y"]
            n += 1
            a_ok = da > 1e-9
            a_bad = da < -1e-9
            s_ok = ds > 1e-9
            d_ok = dg > 1e-9
            parent_changes = (np.sign(ds) != np.sign(da)) and abs(da) > 1e-9 and abs(ds) > 1e-9
            # tie local
            a_tie = abs(da) <= 1e-9

            if a_ok and s_ok and not parent_changes:
                tag = "LOCAL_CORRECT_PARENT_PRESERVES"
            elif a_ok and s_ok and abs(ds) > abs(da):
                tag = "LOCAL_CORRECT_PARENT_STRENGTHENS"
            elif a_ok and not s_ok:
                tag = "LOCAL_CORRECT_PARENT_HARMS"
            elif a_bad and s_ok and d_ok:
                tag = "LOCAL_WRONG_PARENT_HELPS"
            elif a_bad and not s_ok:
                tag = "LOCAL_WRONG_PARENT_STILL_WRONG"
            elif a_tie and s_ok:
                tag = "LOCAL_TIE_PARENT_RESOLVES"
            else:
                tag = "LOCAL_OTHER"

            counts[tag] += 1
            if tag == "LOCAL_CORRECT_PARENT_HARMS":
                harm += 1
            if tag == "LOCAL_WRONG_PARENT_HELPS":
                help_ += 1

            same = Lg["pillar"] == Lb["pillar"]
            pr = 1.0 if s_ok else 0.0
            gate_key = Lg.get("gate") or "LOW"
            if same:
                same_n += 1
                same_pairs.append(pr)
            else:
                cross_n += 1
                cross_pairs.append(pr)
                rdiff_s, rdiff_c = _pair_regime_diff(
                    {"direction": Lg.get("direction", 0), "gate": Lg.get("gate", "LOW")},
                    {"direction": Lb.get("direction", 0), "gate": Lb.get("gate", "LOW")},
                )
                cross_by_rdiff[rdiff_c].append(pr)
                by_rdiff[rdiff_c][tag] += 1
                # use max gate of the two for stratification of parent effect
                g_use = gate_key if GATE_RANK[gate_key] >= GATE_RANK[Lb.get("gate", "LOW")] else Lb.get("gate", "LOW")
                by_gate[g_use][tag] += 1
                by_gate[g_use]["n"] += 1
                if tag == "LOCAL_CORRECT_PARENT_HARMS":
                    by_gate[g_use]["harm"] += 1
                if tag == "LOCAL_WRONG_PARENT_HELPS":
                    by_gate[g_use]["help"] += 1
                if rdiff_c in ("HIGH", "TRANSFORM"):
                    high_pairs.append(pr)

    def rate(a, b):
        return None if not b else round(a / b, 4)

    gate_stats = {}
    for g, d in by_gate.items():
        nn = d.get("n", 0)
        hh, hm = d.get("help", 0), d.get("harm", 0)
        gate_stats[g] = {
            "n_cross_pairs": nn,
            "PARENT_HELP_rate": rate(hh, nn),
            "PARENT_HARM_rate": rate(hm, nn),
            "NET_PARENT_VALUE": rate(hh - hm, nn),
            "matrix": {k: v for k, v in d.items() if k not in ("n", "help", "harm")},
        }

    return {
        "n_pairs": n,
        "PARENT_HELP_rate": rate(help_, n),
        "PARENT_HARM_rate": rate(harm, n),
        "NET_PARENT_VALUE": rate(help_ - harm, n),
        "matrix": dict(counts),
        "same_D_pairwise": None if not same_pairs else round(float(np.mean(same_pairs)), 4),
        "cross_D_pairwise": None if not cross_pairs else round(float(np.mean(cross_pairs)), 4),
        "high_regime_cross_pairwise": None if not high_pairs else round(float(np.mean(high_pairs)), 4),
        "cross_by_regime_diff": {k: round(float(np.mean(v)), 4) for k, v in cross_by_rdiff.items() if v},
        "by_gate": gate_stats,
        "same_n": same_n,
        "cross_n": cross_n,
    }


def _d_dist(d_by_subj: Dict[str, List[float]]) -> Dict[str, Any]:
    ranges, jumps, uniq = [], [], []
    buckets = defaultdict(int)
    for ds in d_by_subj.values():
        if not ds:
            continue
        ranges.append(max(ds) - min(ds))
        uniq.append(len(set(round(x, 2) for x in ds)))
        for i in range(len(ds) - 1):
            j = abs(ds[i + 1] - ds[i])
            jumps.append(j)
            if j < 2:
                buckets["lt2"] += 1
            elif j < 5:
                buckets["2_5"] += 1
            elif j < 10:
                buckets["5_10"] += 1
            elif j < 20:
                buckets["10_20"] += 1
            elif j < 30:
                buckets["20_30"] += 1
            else:
                buckets["gt30"] += 1
    a = np.asarray(jumps, dtype=float) if jumps else np.asarray([0.0])
    return {
        "within_range_p50": round(float(np.median(ranges)), 4) if ranges else None,
        "unique_levels_p50": round(float(np.median(uniq)), 4) if uniq else None,
        "adj_p25": round(float(np.percentile(a, 25)), 4),
        "adj_p50": round(float(np.percentile(a, 50)), 4),
        "adj_p75": round(float(np.percentile(a, 75)), 4),
        "adj_p90": round(float(np.percentile(a, 90)), 4),
        "adj_p95": round(float(np.percentile(a, 95)), 4),
        "adj_max": round(float(np.max(a)), 4),
        "jump_buckets": dict(buckets),
        "plateau_rate": round(buckets["lt2"] / max(1, len(jumps)), 4),
    }


def _jump_validity(pack_blocks, d_eff, gate_map, threshold: float = 10.0) -> Dict[str, Any]:
    rows = []
    for name, bf in pack_blocks.items():
        ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])
        for i in range(len(ordered) - 1):
            p0, p1 = ordered[i][0], ordered[i + 1][0]
            jump = d_eff[(name, p1)] - d_eff[(name, p0)]
            if abs(jump) < threshold:
                continue
            g = gate_map[(name, p1)]
            supported = g["gate"] in ("HIGH", "TRANSFORMATIVE") and not g["restrain_signed"] and g["abs_direction"] >= 0.25
            rows.append({
                "name": name, "from": p0, "to": p1, "jump": round(jump, 4),
                "gate": g["gate"], "abs_direction": g["abs_direction"],
                "n_indep_agree": g["n_indep_agree"], "supported": supported,
                "active_groups": g["active_groups"],
            })
    if not rows:
        return {"n": 0, "p_supported": None, "rows": []}
    return {
        "n": len(rows),
        "p_supported": round(sum(1 for r in rows if r["supported"]) / len(rows), 4),
        "rows": rows[:30],
    }


def main() -> int:
    print("══════════ V2 DY HIERARCHY 2.6 ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    print("── packing ──")
    old_packs, fresh_packs, val_b = B._load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b:
            raise RuntimeError(f"Val B: {p['name']}")

    cfg = dict(arm_b.ARM_B_CONFIG)
    print("── features + gates ──")
    pack_blocks, natal, all_rows = {}, {}, []
    for pack in all_packs:
        natal[pack["name"]] = O._natal_context(pack)
        bf = B._block_feats(pack)
        by_p = {row["daewoon_pillar"]: row for row in (pack.get("dw") or [])}
        for pillar, f in bf.items():
            row = by_p.get(pillar) or {}
            f["stem"] = row.get("stem") or pillar[0]
            f["branch"] = row.get("branch") or pillar[1]
            f["rels"] = row.get("관계_with_원국") or []
        pack_blocks[pack["name"]] = bf
        all_rows.extend(bf.values())

    z_keys = [
        "fav_act", "unfav_act", "fav_minus_unfav",
        "struct_activ", "struct_disrupt", "struct_net", "struct_excess",
        "has_hap", "has_chung", "has_samhap", "has_day_chung",
    ]
    z_params = {k: B._robust_params([float(r[k]) for r in all_rows]) for k in z_keys}

    evid, hB, gate_map, natal_conf = {}, {}, {}, {}
    for pack in all_packs:
        nc = natal[pack["name"]]
        natal_conf[pack["name"]] = _natal_confidence(nc)
        for pillar, f in pack_blocks[pack["name"]].items():
            key = (pack["name"], pillar)
            hB[key] = O._h_b(f, z_params)
            evid[key] = O._regime_evidence(nc, f, f["stem"], f["branch"], f.get("rels") or [])
            gate_map[key] = _compute_gate(evid[key], natal_conf[pack["name"]])

    # gate histogram
    gate_hist = defaultdict(int)
    for g in gate_map.values():
        gate_hist[g["gate"]] += 1
    print("  gate_hist", dict(gate_hist))

    def build_D_eff(amp_name: str) -> Dict[Tuple[str, str], Tuple[float, float, float]]:
        """key -> (D_B, correction, D_eff)"""
        out = {}
        for key, hb in hB.items():
            d_b = _clamp(BASE + 3.0 * hb)
            corr, _ = _d_correction(gate_map[key], hb, amp_name)
            out[key] = (d_b, corr, _clamp(d_b + corr))
        return out

    print("── score ──")
    variants = [("REF", REF, "BALANCED", False)]
    for amp in ("BALANCED", "CONSERVATIVE", "EXPRESSIVE"):
        variants.append(("H1", f"{H1}::{amp}", amp, False))
        variants.append(("H2", f"{H2}::{amp}", amp, True))

    results = {}
    for mode, label, amp, use_dy in variants:
        print(f"  {label}")
        d_pack = build_D_eff(amp) if mode != "REF" else None
        layers_by_pack, score_maps_all = [], []
        d_by_subj = defaultdict(list)
        corr_by_gate = defaultdict(list)
        within_ranges, between_bases = [], []
        cross_up, cross_down, cross_mags = 0, 0, []
        n_years = 0

        for pack in all_packs:
            nc = natal[pack["name"]]
            gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
            by_p = defaultdict(list)
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                if (pack["name"], pillar) not in hB:
                    continue
                by_p[pillar].append(gmap[int(y)])
            med = {p: float(np.median(v)) for p, v in by_p.items()}
            bf = pack_blocks[pack["name"]]
            ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])

            block_D = []
            for pp, _ in ordered:
                key = (pack["name"], pp)
                if mode == "REF":
                    d_eff = _clamp(BASE + 3.0 * hB[key])
                    corr = 0.0
                    d_b = d_eff
                else:
                    d_b, corr, d_eff = d_pack[key]
                d_by_subj[pack["name"]].append(d_eff)
                block_D.append(d_eff)
                corr_by_gate[gate_map[key]["gate"]].append(abs(corr))
            if block_D:
                between_bases.append(max(block_D) - min(block_D))

            layers, smap = {}, {}
            years_by_block = defaultdict(list)
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                key = (pack["name"], pillar)
                if key not in hB:
                    continue
                g = gmap[int(y)]
                a = g - med[pillar]
                flags = B._ilju_flags(m)
                tg = B._tg_career(m)
                trigger = (
                    1.2 * flags["year_hap"] - 1.5 * flags["year_chung"]
                    - 1.0 * flags["year_hyung"] - 0.8 * flags["year_pa_hae"] + 0.4 * tg
                )
                annual_dev_b = 0.65 * a + 0.35 * trigger
                gi = gate_map[key]
                if mode == "REF":
                    d_eff = _clamp(BASE + 3.0 * hB[key])
                    corr = 0.0
                    d_b = d_eff
                    dy = 0.0
                else:
                    d_b, corr, d_eff = d_pack[key]
                    dy = 0.0
                    if use_dy:
                        f = bf[pillar]
                        cy = O._contextual_year(nc, m, f["stem"], f["branch"], gi["direction"])
                        # only reinforce / dy relation — treat ambiguous if |reinforce| tiny and event high
                        ambiguous = abs(cy.get("reinforce", 0)) < 0.05 and abs(cy.get("dy_context", 0)) < 0.2
                        # extract reinforce from cy; dy_context includes reinforce already — use reinforce + clipped
                        dy = _dy_signed(gi["gate"], cy.get("reinforce", 0.0), cy.get("dy_context", 0.0) * 0.5, ambiguous)

                y_disp = _clamp(d_eff + annual_dev_b + dy)
                n_years += 1
                # crossing: Y vs D relative to BASE
                if d_eff < BASE - 1 and y_disp > d_eff + 1 and y_disp >= BASE:
                    cross_up += 1
                    cross_mags.append(y_disp - d_eff)
                if d_eff > BASE + 1 and y_disp < d_eff - 1 and y_disp <= BASE:
                    cross_down += 1
                    cross_mags.append(d_eff - y_disp)

                layers[int(y)] = {
                    "pillar": pillar, "D_B": d_b, "D": d_eff, "corr": corr,
                    "G": g, "A": a, "annual_dev": annual_dev_b, "dy": dy, "Y": y_disp,
                    "gate": gi["gate"], "direction": gi["direction"],
                    "confidence_eff": gi["confidence_eff"],
                    "event_intensity": gi["event_intensity"],
                }
                smap[int(y)] = y_disp
                years_by_block[pillar].append(y_disp)

            for ys in years_by_block.values():
                if len(ys) >= 2:
                    within_ranges.append(max(ys) - min(ys))

            layers_by_pack.append(layers)
            score_maps_all.append(smap)

        arch = {"label": label, "mode": mode, "amp": amp, "use_dy": use_dy}
        for pool_name, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs)):
            idx = [i for i, pk in enumerate(all_packs) if pk["pool"] == pool_name]
            sub_packs = [all_packs[i] for i in idx]
            sub_maps = [score_maps_all[i] for i in idx]
            sub_layers = [layers_by_pack[i] for i in idx]
            ann = _annual_metrics(sub_packs, sub_maps)
            parent = _parent_matrix(sub_packs, sub_layers)
            sub_d = {pk["name"]: d_by_subj[pk["name"]] for pk in sub_packs}
            dist = _d_dist(sub_d)
            # D_eff for jump validity
            d_eff_map = {}
            for pk in sub_packs:
                for pillar in pack_blocks[pk["name"]]:
                    key = (pk["name"], pillar)
                    if mode == "REF":
                        d_eff_map[key] = _clamp(BASE + 3.0 * hB[key])
                    else:
                        d_eff_map[key] = d_pack[key][2]
            jv = _jump_validity({pk["name"]: pack_blocks[pk["name"]] for pk in sub_packs}, d_eff_map, gate_map, 10.0)
            mean_corr_gate = {g: round(float(np.mean(vs)), 4) for g, vs in corr_by_gate.items() if vs}
            arch[pool_name] = {
                "annual": {k: v for k, v in ann.items() if k not in ("subjects",)},
                "subjects": ann["subjects"],
                "failures": ann["failures"],
                "parent": parent,
                "d_dist": dist,
                "jump_gt10": {k: v for k, v in jv.items() if k != "rows"},
                "jump_examples": jv.get("rows", [])[:12],
                "mean_abs_corr_by_gate": mean_corr_gate,
            }
        arch["crossing"] = {
            "n_years": n_years,
            "frac_cross_up_from_hard_D": round(cross_up / max(1, n_years), 4),
            "frac_cross_down_from_good_D": round(cross_down / max(1, n_years), 4),
            "mean_cross_mag": None if not cross_mags else round(float(np.mean(cross_mags)), 4),
        }
        arch["within_vs_between"] = {
            "within_block_Y_range_p50": None if not within_ranges else round(float(np.median(within_ranges)), 4),
            "between_block_D_range_p50": None if not between_bases else round(float(np.median(between_bases)), 4),
            "ratio_within_over_between_p50": (
                None if not within_ranges or not between_bases
                else round(float(np.median(within_ranges)) / max(1e-6, float(np.median(between_bases))), 4)
            ),
        }
        arch["gate_hist"] = dict(gate_hist)
        results[label] = arch

    def pick_amp(prefix: str) -> str:
        cands = [k for k in results if k.startswith(prefix + "::")]

        def key(lab):
            fa = results[lab]["FRESH_A_DEV"]
            old = results[lab]["OLD_DEV"]
            fa_pw = fa["annual"]["pairwise_mean"] or 0
            old_pw = old["annual"]["pairwise_mean"] or 0
            same = fa["parent"]["same_D_pairwise"] or 0
            cross = fa["parent"]["cross_D_pairwise"] or 0
            high = fa["parent"]["high_regime_cross_pairwise"] or 0
            net = fa["parent"]["NET_PARENT_VALUE"] or 0
            high_gate_net = (fa["parent"]["by_gate"].get("HIGH") or {}).get("NET_PARENT_VALUE")
            if high_gate_net is None:
                high_gate_net = 0.0
            low_corr = fa.get("mean_abs_corr_by_gate", {}).get("LOW", 0) or 0
            return (fa_pw, cross, high, same, old_pw, net, high_gate_net, -low_corr)

        return sorted(cands, key=key, reverse=True)[0]

    h1_best = pick_amp(H1)
    h2_best = pick_amp(H2)
    ref = REF

    def row(lab):
        fa = results[lab]["FRESH_A_DEV"]
        old = results[lab]["OLD_DEV"]
        return {
            "label": lab,
            "FA_pw": fa["annual"]["pairwise_mean"],
            "FA_hit": fa["annual"]["hit"],
            "FA_same": fa["parent"]["same_D_pairwise"],
            "FA_cross": fa["parent"]["cross_D_pairwise"],
            "FA_high": fa["parent"]["high_regime_cross_pairwise"],
            "FA_help": fa["parent"]["PARENT_HELP_rate"],
            "FA_harm": fa["parent"]["PARENT_HARM_rate"],
            "FA_net": fa["parent"]["NET_PARENT_VALUE"],
            "OLD_pw": old["annual"]["pairwise_mean"],
            "OLD_hit": old["annual"]["hit"],
            "adj_p50": fa["d_dist"]["adj_p50"],
            "adj_p90": fa["d_dist"]["adj_p90"],
            "adj_max": fa["d_dist"]["adj_max"],
            "jump_support": fa["jump_gt10"].get("p_supported"),
            "jump_n": fa["jump_gt10"].get("n"),
            "cross_by_rdiff": fa["parent"]["cross_by_regime_diff"],
            "by_gate": fa["parent"]["by_gate"],
            "mean_corr_gate": fa.get("mean_abs_corr_by_gate"),
            "crossing": results[lab]["crossing"],
            "within_vs_between": results[lab]["within_vs_between"],
        }

    rows = [row(ref), row(h1_best), row(h2_best)]
    ref_fa = results[ref]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
    ref_same = results[ref]["FRESH_A_DEV"]["parent"]["same_D_pairwise"] or 0
    ref_cross = results[ref]["FRESH_A_DEV"]["parent"]["cross_D_pairwise"] or 0
    ref_old = results[ref]["OLD_DEV"]["annual"]["pairwise_mean"] or 0

    def promote_ok(lab: str) -> Tuple[bool, str]:
        fa = results[lab]["FRESH_A_DEV"]
        old = results[lab]["OLD_DEV"]
        fa_pw = fa["annual"]["pairwise_mean"] or 0
        same = fa["parent"]["same_D_pairwise"] or 0
        cross = fa["parent"]["cross_D_pairwise"] or 0
        high = fa["parent"]["high_regime_cross_pairwise"] or 0
        old_pw = old["annual"]["pairwise_mean"] or 0
        high_net = (fa["parent"]["by_gate"].get("HIGH") or {}).get("NET_PARENT_VALUE")
        low_corr = fa.get("mean_abs_corr_by_gate", {}).get("LOW", 99) or 99
        jsup = fa["jump_gt10"].get("p_supported")

        if fa_pw < ref_fa - TIE_BAND:
            return False, "FA_below_tie"
        if same < ref_same - 0.02:
            return False, "sameD_drop"
        if old_pw < ref_old - 0.03:
            return False, "OLD_drop"
        if high_net is not None and high_net < 0:
            return False, "HIGH_gate_negative_net"
        if low_corr > 1.5:
            return False, "LOW_gate_large_corr"
        # must improve something hierarchical or earn distinctiveness with tie
        improved = (cross >= ref_cross + 0.005) or (high is not None and high >= 0.70)
        distinct = (fa["d_dist"]["adj_p90"] or 0) >= 3.0
        if fa_pw >= ref_fa - TIE_BAND and improved and (high_net is None or high_net >= 0):
            return True, "strong_or_tie_improve"
        if fa_pw >= ref_fa - TIE_BAND and distinct and (fa["parent"]["NET_PARENT_VALUE"] or 0) >= 0:
            return True, "tie_distinctiveness"
        return False, "no_clear_gain"

    h1_ok, h1_why = promote_ok(h1_best)
    h2_ok, h2_why = promote_ok(h2_best)

    winner = ref
    status = "V2_DY_B_FINAL_NUMERIC_FREEZE"
    if h2_ok and (not h1_ok or (results[h2_best]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0) >= (results[h1_best]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0) - 0.005):
        winner = h2_best
        status = "V2_DY_HIERARCHY_26_READY_TO_FREEZE"
    elif h1_ok:
        winner = h1_best
        status = "V2_DY_HIERARCHY_26_READY_TO_FREEZE"
    else:
        # explanation-only if gate calibration shows monotonic helpful pattern without overall promote
        hg = results[h2_best]["FRESH_A_DEV"]["parent"]["by_gate"]
        high_net = (hg.get("HIGH") or {}).get("NET_PARENT_VALUE")
        low_corr = results[h2_best]["FRESH_A_DEV"].get("mean_abs_corr_by_gate", {}).get("LOW", 99)
        if high_net is not None and high_net > 0 and (low_corr or 0) <= 1.0:
            status = "V2_DY_HIERARCHY_26_EXPLANATION_ONLY"
            winner = ref

    # conflict case samples (FA)
    conflict_cases = []
    fa_idx = [i for i, pk in enumerate(all_packs) if pk["pool"] == "FRESH_A_DEV"]
    # rebuild winner layers lightly from results subjects — use last scored winner path
    # store from h2_best layers by re-scoring quickly for FA only
    amp_w = winner.split("::")[1] if "::" in winner else "BALANCED"
    use_dy_w = H2 in winner
    d_pack_w = build_D_eff(amp_w)
    for i in fa_idx[:14]:
        pack = all_packs[i]
        nc = natal[pack["name"]]
        gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
        by_p = defaultdict(list)
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            if (pack["name"], pillar) not in hB:
                continue
            by_p[pillar].append(gmap[int(y)])
        med = {p: float(np.median(v)) for p, v in by_p.items()}
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            key = (pack["name"], pillar)
            if key not in hB:
                continue
            a = gmap[int(y)] - med[pillar]
            gi = gate_map[key]
            d_b, corr, d_eff = d_pack_w[key]
            if abs(gi["direction"]) >= 0.35 and abs(a) >= 2.0 and np.sign(gi["direction"]) != np.sign(a):
                flags = B._ilju_flags(m)
                tg = B._tg_career(m)
                trigger = (
                    1.2 * flags["year_hap"] - 1.5 * flags["year_chung"]
                    - 1.0 * flags["year_hyung"] - 0.8 * flags["year_pa_hae"] + 0.4 * tg
                )
                annual = 0.65 * a + 0.35 * trigger
                dy = 0.0
                if use_dy_w or True:
                    f = pack_blocks[pack["name"]][pillar]
                    cy = O._contextual_year(nc, m, f["stem"], f["branch"], gi["direction"])
                    ambiguous = abs(cy.get("reinforce", 0)) < 0.05
                    if use_dy_w:
                        dy = _dy_signed(gi["gate"], cy.get("reinforce", 0.0), cy.get("dy_context", 0.0) * 0.5, ambiguous)
                conflict_cases.append({
                    "name": pack["name"], "year": int(y), "pillar": pillar,
                    "D_B": round(d_b, 2), "gate": gi["gate"], "direction": gi["direction"],
                    "corr": round(corr, 2), "D_eff": round(d_eff, 2),
                    "A": round(a, 2), "annual_dev_B": round(annual, 2), "dy": round(dy, 2),
                    "Y": round(_clamp(d_eff + annual + dy), 2),
                    "active_groups": gi["active_groups"],
                })
                if len(conflict_cases) >= 20:
                    break
        if len(conflict_cases) >= 20:
            break

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_DY_HIERARCHY_26",
        "validation_b_scored": False,
        "tie_band": TIE_BAND,
        "gate_amp_maps": GATE_AMP,
        "dy_bounds": DY_BOUNDS,
        "gate_hist": dict(gate_hist),
        "reference": ref,
        "h1_selected": h1_best,
        "h2_selected": h2_best,
        "winner": winner,
        "status": status,
        "promote_notes": {"h1": h1_why, "h2": h2_why},
        "summary_rows": rows,
        "results": results,
        "conflict_cases": conflict_cases,
        "terminology_erratum": {
            "PARENT_HELP": "annual-local wrong, parent made final correct",
            "PARENT_HARM": "annual-local correct, parent made final wrong",
            "NET_PARENT_VALUE": "HELP - HARM",
            "note": "Parent changing annual order is allowed; evaluate usefulness.",
        },
    }
    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    open(OUT_REPORT, "w", encoding="utf-8").write(_write_report(payload))
    open(OUT_PARENT, "w", encoding="utf-8").write(_write_parent(payload))
    open(OUT_GATE, "w", encoding="utf-8").write(_write_gate(payload))

    print("\n══════════ STATUS ══════════")
    print(status)
    print("winner", winner)
    for r in rows:
        print(r["label"], "FA", r["FA_pw"], "same", r["FA_same"], "cross", r["FA_cross"], "high", r["FA_high"], "net", r["FA_net"])
    print(f"→ {OUT_SNAP}")
    return 0


def _write_report(p: dict) -> str:
    L = [
        "# V2 DY Hierarchy 2.6 Report",
        "",
        f"**Status:** `{p['status']}`",
        f"**Winner:** `{p['winner']}`",
        f"**H1:** `{p['h1_selected']}` · **H2:** `{p['h2_selected']}`",
        f"**Measured:** {p['measured_at']}",
        "",
        "Val B sealed. Engine untouched. No Month/Day. No Phase 2.7.",
        "",
        "## Philosophy correction",
        "",
        "Parent influence is allowed. Metrics are PARENT_HELP / PARENT_HARM / NET_PARENT_VALUE — not “override=bad”.",
        "Hierarchy ≠ fixed D>Y weights. Sewoon may cross Daewoon baseline.",
        "",
        "## Metrics",
        "",
        "| label | FA pw | same-D | cross-D | high-reg | help | harm | net | OLD pw | adj p90 | jump support |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in p["summary_rows"]:
        L.append(
            f"| {r['label']} | {r['FA_pw']} | {r['FA_same']} | {r['FA_cross']} | {r['FA_high']} | "
            f"{r['FA_help']} | {r['FA_harm']} | {r['FA_net']} | {r['OLD_pw']} | {r['adj_p90']} | {r['jump_support']} |"
        )
    L += [
        "",
        f"Promote notes: {p['promote_notes']}",
        "",
        f"**Final status:** `{p['status']}`",
        "",
        "STOP. Next: calendar foundation patch → Month → Day → Val B.",
        "",
    ]
    # Q&A condensed
    L.append("## Answers (1–42)")
    L.append("")
    w = p["winner"]
    ref = p["summary_rows"][0]
    h1 = p["summary_rows"][1]
    h2 = p["summary_rows"][2]
    L.append(f"1. Yes — old “D_OVERRIDE=bad” was wrong; parent corrections must be evaluated by usefulness.")
    L.append(f"2. Natal → Daewoon regime → Sewoon inside regime → Y = D_eff + AnnualDev_B + optional DxY.")
    L.append(f"3. No — not fixed numeric weights.")
    L.append(f"4. Yes — Sewoon may cross Daewoon baseline.")
    L.append(f"5. Daewoon = long-term baseline when evidence earns influence (gated).")
    L.append(f"6. Sewoon = annual-local activation (frozen B spine).")
    L.append(f"7. D×Y = reinforce/counter between regime and year (H2 only, gated).")
    L.append(f"8. PARENT_HELP = local wrong, final correct with parent contribution.")
    L.append(f"9. PARENT_HARM = local correct, final wrong.")
    L.append(f"10. NET = HELP − HARM.")
    L.append(f"11. B: FA pw={ref['FA_pw']} help={ref['FA_help']} harm={ref['FA_harm']} net={ref['FA_net']}.")
    L.append(f"12. H1: FA pw={h1['FA_pw']} same={h1['FA_same']} cross={h1['FA_cross']} high={h1['FA_high']} net={h1['FA_net']}.")
    L.append(f"13. H2: FA pw={h2['FA_pw']} same={h2['FA_same']} cross={h2['FA_cross']} high={h2['FA_high']} net={h2['FA_net']}.")
    L.append(f"14–18. See table (FA overall/same/cross/high/OLD).")
    L.append(f"19. Gate nets: H2 by_gate={h2['by_gate']}.")
    L.append(f"20–21. See mean_corr_gate={h2['mean_corr_gate']} and by_gate nets.")
    L.append(f"22–23. Jump support H2={h2['jump_support']} (n={h2['jump_n']}).")
    L.append(f"24–25. Independent groups + natal confidence applied (see gate audit).")
    L.append(f"26. Yes — H2 keeps annual_dev_B; no orthodox year trigger.")
    L.append(f"27–29. Compare H1 vs H2 vs B in table.")
    L.append(f"30–31. Crossing rates: {h2['crossing']}.")
    L.append(f"32–35. Distinctiveness adj p90 B={ref['adj_p90']} H2={h2['adj_p90']}; within/between={h2['within_vs_between']}.")
    L.append(f"37. Winner `{w}`.")
    L.append(f"38. Numeric freeze: `{p['status']}`.")
    L.append(f"39. Full orthodox contextual year trigger remains explanation-only.")
    L.append(f"40–41. Val B + real-user broad-period QA still unproven.")
    L.append(f"42. Wolwoon 子/丑 + 立春 sewoon alignment — see V2_PHASE_3_FOUNDATION_HANDOFF.md.")
    L.append("")
    return "\n".join(L)


def _write_parent(p: dict) -> str:
    L = ["# V2 DY Parent Correction Analysis (Phase 2.6)", "", f"Status: `{p['status']}`", ""]
    L.append("Terminology: PARENT_HELP / PARENT_HARM / NET_PARENT_VALUE (parent change is allowed).")
    L.append("")
    for r in p["summary_rows"]:
        L.append(f"## {r['label']}")
        L.append(f"- HELP={r['FA_help']} HARM={r['FA_harm']} NET={r['FA_net']}")
        L.append(f"- same-D={r['FA_same']} cross-D={r['FA_cross']} high={r['FA_high']}")
        L.append(f"- cross_by_regime_diff={r['cross_by_rdiff']}")
        L.append(f"- by_gate={r['by_gate']}")
        L.append("")
    L.append("## Conflict cases (strong D vs opposing A)")
    L.append("")
    for c in p.get("conflict_cases", [])[:15]:
        L.append(
            f"- {c['name']} {c['year']} {c['pillar']}: gate={c['gate']} dir={c['direction']} "
            f"D_B={c['D_B']} corr={c['corr']} A={c['A']} Y={c['Y']} groups={c['active_groups']}"
        )
    L.append("")
    return "\n".join(L)


def _write_gate(p: dict) -> str:
    L = [
        "# V2 DY Regime Gate Audit (Phase 2.6)",
        "",
        f"Status: `{p['status']}`",
        f"Gate histogram (blocks): {p['gate_hist']}",
        "",
        "## Predeclared maps",
        f"```{json.dumps(p['gate_amp_maps'], indent=2)}```",
        "",
        "## Calibration pattern (FA)",
        "",
    ]
    h2 = p["summary_rows"][2]
    L.append(f"Mean |corr| by gate: {h2['mean_corr_gate']}")
    L.append(f"Net parent by gate: { {k: v.get('NET_PARENT_VALUE') for k, v in h2['by_gate'].items()} }")
    L.append(f"Jump ≥10 support rate: {h2['jump_support']} (n={h2['jump_n']})")
    L.append("")
    L.append("Ideal: LOW≈0 corr / little parent effect; HIGH larger corr + positive net.")
    L.append("Independent evidence groups + natal confidence damp applied.")
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
