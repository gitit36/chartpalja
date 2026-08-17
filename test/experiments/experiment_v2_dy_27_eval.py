# -*- coding: utf-8 -*-
"""
V2 Phase 2.7A — Corrected evaluation of B / H1::CONS / H2::CONS.

No formula changes. Marginal value vs B. Pair regime contrast.
Decide whether 2.7B continuous candidate is justified.

Usage:
  PYTHONPATH=.:test python test/experiments/experiment_v2_dy_27_eval.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from itertools import product
from typing import Any, Dict, List, Tuple

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
from experiments import experiment_v2_dy_hierarchy_26 as H26  # noqa: E402
from experiments.experiment_g_clean import score_g  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS, _pairwise  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_dy_27_eval.json")
OUT_REPORT = os.path.join(_HERE, "V2_DY_27_EVALUATION_REPORT.md")
OUT_MARG = os.path.join(_HERE, "V2_DY_27_MARGINAL_VALUE.md")
OUT_DECISION = os.path.join(_HERE, "V2_DY_27_FINAL_DECISION.md")

VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0
AMP = "CONSERVATIVE"
N_BOOT = 5000
RNG = np.random.default_rng(27)


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def _group_orientation(gate_info: dict, evid: dict) -> Dict[str, float]:
    """Signed orientation per independent group ∈ {-1,0,1}."""
    dims, signed = evid["dims"], evid["signed"]
    out = {}
    for gname, keys in H26.EVIDENCE_GROUPS.items():
        vals = []
        for k in keys:
            if dims.get(k, "inactive") == "inactive":
                continue
            if dims.get(k) == "ambiguous":
                continue
            vals.append(float(signed.get(k, 0.0)))
        if not vals:
            out[gname] = 0.0
        else:
            m = float(np.mean(vals))
            out[gname] = 0.0 if abs(m) < 0.05 else float(np.sign(m))
    return out


def _pair_regime_contrast(Lg: dict, Lb: dict) -> Tuple[float, str]:
    dir_c = min(1.0, abs(Lg["direction"] - Lb["direction"]) / 1.0)
    corr_c = min(1.0, abs(Lg["corr"] - Lb["corr"]) / 8.0)
    conf_c = min(1.0, abs(Lg["confidence_eff"] - Lb["confidence_eff"]) / 0.5)
    og, ob = Lg.get("group_orient") or {}, Lb.get("group_orient") or {}
    keys = set(og) | set(ob)
    if not keys:
        g_c = 0.0
    else:
        diffs = [abs(og.get(k, 0.0) - ob.get(k, 0.0)) / 2.0 for k in keys]
        g_c = float(np.mean(diffs))
    score = 0.40 * dir_c + 0.30 * corr_c + 0.20 * conf_c + 0.10 * g_c
    if score >= 0.55:
        band = "HIGH"
    elif score >= 0.25:
        band = "MID"
    else:
        band = "LOW"
    return float(score), band


def _annual_metrics(packs, score_maps) -> Dict[str, Any]:
    rows, pairs, seps = [], [], []
    for pack, smap in zip(packs, score_maps):
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
        rows.append({"name": pack["name"], "hit": 1 if ga > ba else 0, "sep": round(sep, 4),
                     "pairwise": None if pr is None else round(pr, 4)})
    hits = [r["hit"] for r in rows]
    return {
        "n": len(rows),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "pairwise_mean": None if not pairs else round(float(np.mean(pairs)), 4),
        "raw_sep_mean": None if not seps else round(float(np.mean(seps)), 4),
        "subjects": rows,
    }


def _collect_pairs(packs, layers_b, layers_c) -> List[dict]:
    """All good/bad pairs with B and candidate layer fields."""
    out = []
    for pi, pack in enumerate(packs):
        Lb_map = layers_b[pi]
        Lc_map = layers_c[pi]
        goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in Lb_map and int(e["year"]) in Lc_map]
        bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in Lb_map and int(e["year"]) in Lc_map]
        for ge, be in product(goods, bads):
            yg, yb = int(ge["year"]), int(be["year"])
            Bg, Bb = Lb_map[yg], Lb_map[yb]
            Cg, Cb = Lc_map[yg], Lc_map[yb]
            same = Bg["pillar"] == Bb["pillar"]
            # locals
            dA = Bg["A"] - Bb["A"]
            dAnn = Bg["annual_dev"] - Bb["annual_dev"]
            dYB = Bg["Y"] - Bb["Y"]
            dYC = Cg["Y"] - Cb["Y"]
            dDB = Bg["D"] - Bb["D"]
            dDC = Cg["D"] - Cb["D"]
            dCorr = Cg["corr"] - Cb["corr"]
            dDy = Cg.get("dy", 0.0) - Cb.get("dy", 0.0)

            a_ok = dA > 1e-9
            ann_ok = dAnn > 1e-9
            b_ok = dYB > 1e-9
            c_ok = dYC > 1e-9
            a_tie = abs(dA) <= 1e-9
            ann_tie = abs(dAnn) <= 1e-9
            b_tie = abs(dYB) <= 1e-9

            # B parent vs annual_dev_B
            if ann_ok and not b_ok:
                b_parent_tag = "PARENT_HARM"
            elif (not ann_ok) and (not ann_tie) and b_ok and (dDB > 1e-9):
                b_parent_tag = "PARENT_HELP"
            elif ann_ok and b_ok:
                b_parent_tag = "PARENT_PRESERVE"
            else:
                b_parent_tag = "OTHER"

            # A-only parent tag for B (erratum)
            if a_ok and not b_ok:
                a_parent_tag = "PARENT_HARM"
            elif (not a_ok) and (not a_tie) and b_ok and (dDB > 1e-9):
                a_parent_tag = "PARENT_HELP"
            elif a_ok and b_ok:
                a_parent_tag = "PARENT_PRESERVE"
            else:
                a_parent_tag = "OTHER"

            # Marginal B → candidate
            if b_ok and c_ok:
                marg = "B_CORRECT_CANDIDATE_CORRECT"
            elif b_ok and not c_ok:
                marg = "MARGINAL_HARM"
            elif (not b_ok) and (not b_tie) and c_ok:
                marg = "MARGINAL_HELP"
            elif b_tie and c_ok:
                marg = "B_TIE_CANDIDATE_RESOLVES"
            else:
                marg = "B_WRONG_CANDIDATE_WRONG"

            # D vs DxY attribution for changed pairs
            changed = (np.sign(dYC) != np.sign(dYB)) or (abs(dYC - dYB) > 1e-6 and (b_ok != c_ok))
            d_part = dCorr  # D gate contribution to delta Y equals delta corr when annual same
            dy_part = dDy
            # For ranking change relative to B: effect of corr and dy on pair delta
            # Y_c - Y_b delta difference = dCorr + dDy (annual identical)
            attr = "UNCHANGED"
            if abs(dCorr) < 1e-9 and abs(dDy) < 1e-9:
                attr = "UNCHANGED"
            elif marg == "MARGINAL_HELP":
                if abs(dCorr) > 1e-9 and abs(dDy) <= 1e-9:
                    attr = "D_ONLY_HELP"
                elif abs(dDy) > 1e-9 and abs(dCorr) <= 1e-9:
                    attr = "DXY_ONLY_HELP"
                elif abs(dCorr) > 1e-9 and abs(dDy) > 1e-9:
                    if np.sign(dCorr) == np.sign(dYC) and np.sign(dDy) == np.sign(dYC):
                        attr = "D_AND_DXY_HELP"
                    else:
                        attr = "MIXED_EFFECT"
            elif marg == "MARGINAL_HARM":
                if abs(dCorr) > 1e-9 and abs(dDy) <= 1e-9:
                    attr = "D_ONLY_HARM"
                elif abs(dDy) > 1e-9 and abs(dCorr) <= 1e-9:
                    attr = "DXY_ONLY_HARM"
                elif abs(dCorr) > 1e-9 and abs(dDy) > 1e-9:
                    # Both components active: aligned with final (wrong) delta → joint harm; else mixed.
                    if np.sign(dCorr) == np.sign(dYC) and np.sign(dDy) == np.sign(dYC):
                        attr = "D_AND_DXY_HARM"
                    elif np.sign(dCorr) != np.sign(dDy):
                        attr = "MIXED_EFFECT"
                    else:
                        # both same nonzero sign but dYC≈0 — still joint directional push
                        attr = "D_AND_DXY_HARM"

            contrast, band = _pair_regime_contrast(Cg, Cb)

            out.append({
                "name": pack["name"],
                "yg": yg, "yb": yb,
                "same_D": same,
                "dA": dA, "dAnn": dAnn, "dYB": dYB, "dYC": dYC,
                "dDB": dDB, "dDC": dDC, "dCorr": dCorr, "dDy": dDy,
                "a_ok": a_ok, "ann_ok": ann_ok, "b_ok": b_ok, "c_ok": c_ok,
                "b_parent_tag": b_parent_tag,
                "a_parent_tag": a_parent_tag,
                "marg": marg,
                "attr": attr,
                "contrast": contrast,
                "band": band,
                "gate_g": Cg.get("gate"), "gate_b": Cb.get("gate"),
            })
    return out


def _summarize_pairs(pairs: List[dict], pool: str) -> Dict[str, Any]:
    n = len(pairs)
    if not n:
        return {"n": 0}

    def rate(pred):
        return round(sum(1 for p in pairs if pred(p)) / n, 4)

    # B parent (full annual)
    b_help = rate(lambda p: p["b_parent_tag"] == "PARENT_HELP")
    b_harm = rate(lambda p: p["b_parent_tag"] == "PARENT_HARM")
    # A-only parent for B
    a_help = rate(lambda p: p["a_parent_tag"] == "PARENT_HELP")
    a_harm = rate(lambda p: p["a_parent_tag"] == "PARENT_HARM")
    flip = sum(1 for p in pairs if p["b_parent_tag"] != p["a_parent_tag"])

    marg_help = rate(lambda p: p["marg"] == "MARGINAL_HELP")
    marg_harm = rate(lambda p: p["marg"] == "MARGINAL_HARM")

    same = [p for p in pairs if p["same_D"]]
    cross = [p for p in pairs if not p["same_D"]]

    def pw(subset):
        if not subset:
            return None
        return round(sum(1 for p in subset if p["c_ok"]) / len(subset), 4)

    def pw_b(subset):
        if not subset:
            return None
        return round(sum(1 for p in subset if p["b_ok"]) / len(subset), 4)

    by_band = {}
    for band in ("LOW", "MID", "HIGH"):
        sub = [p for p in cross if p["band"] == band]
        if not sub:
            by_band[band] = {"n": 0}
            continue
        mh = sum(1 for p in sub if p["marg"] == "MARGINAL_HELP")
        mm = sum(1 for p in sub if p["marg"] == "MARGINAL_HARM")
        names = sorted(set(p["name"] for p in sub))
        by_band[band] = {
            "n": len(sub),
            "n_subjects": len(names),
            "subjects": names,
            "B_pairwise": pw_b(sub),
            "C_pairwise": pw(sub),
            "MARGINAL_HELP_rate": round(mh / len(sub), 4),
            "MARGINAL_HARM_rate": round(mm / len(sub), 4),
            "MARGINAL_NET": round((mh - mm) / len(sub), 4),
        }

    attr_counts = defaultdict(int)
    for p in pairs:
        attr_counts[p["attr"]] += 1

    # subject-level pairwise vs B
    by_subj = defaultdict(lambda: {"b": [], "c": []})
    for p in pairs:
        by_subj[p["name"]]["b"].append(1.0 if p["b_ok"] else 0.0)
        by_subj[p["name"]]["c"].append(1.0 if p["c_ok"] else 0.0)
    improve = worsen = tie = 0
    subj_deltas = []
    for name, d in by_subj.items():
        pb, pc = float(np.mean(d["b"])), float(np.mean(d["c"]))
        subj_deltas.append({"name": name, "B_pw": round(pb, 4), "C_pw": round(pc, 4), "delta": round(pc - pb, 4)})
        if pc > pb + 1e-9:
            improve += 1
        elif pc < pb - 1e-9:
            worsen += 1
        else:
            tie += 1

    return {
        "pool": pool,
        "n_pairs": n,
        "n_subjects": len(by_subj),
        "B_PARENT_HELP_rate": b_help,
        "B_PARENT_HARM_rate": b_harm,
        "B_PARENT_NET": round(b_help - b_harm, 4),
        "A_ONLY_PARENT_HELP_rate": a_help,
        "A_ONLY_PARENT_HARM_rate": a_harm,
        "A_ONLY_PARENT_NET": round(a_help - a_harm, 4),
        "parent_tag_flip_rate_A_vs_AnnB": round(flip / n, 4),
        "parent_tag_flip_n": flip,
        "MARGINAL_HELP_rate": marg_help,
        "MARGINAL_HARM_rate": marg_harm,
        "MARGINAL_NET_VALUE": round(marg_help - marg_harm, 4),
        "same_D_pairwise_B": pw_b(same),
        "same_D_pairwise_C": pw(same),
        "cross_D_pairwise_B": pw_b(cross),
        "cross_D_pairwise_C": pw(cross),
        "by_contrast_band": by_band,
        "attr_counts": dict(attr_counts),
        "subject_improve_n": improve,
        "subject_worsen_n": worsen,
        "subject_tie_n": tie,
        "subject_deltas": sorted(subj_deltas, key=lambda x: x["delta"]),
    }


def _bootstrap_marginal(pairs: List[dict], band=None) -> Dict[str, Any]:
    if band:
        use = [p for p in pairs if (not p["same_D"]) and p["band"] == band]
    else:
        use = pairs
    if not use:
        return {"n": 0}
    by_subj = defaultdict(list)
    for p in use:
        by_subj[p["name"]].append(p)
    names = list(by_subj.keys())
    if len(names) < 2:
        return {"n": len(use), "n_subjects": len(names), "note": "too_few_subjects"}

    nets = []
    for _ in range(N_BOOT):
        samp = RNG.choice(names, size=len(names), replace=True)
        ps = []
        for nm in samp:
            ps.extend(by_subj[nm])
        if not ps:
            continue
        h = sum(1 for p in ps if p["marg"] == "MARGINAL_HELP")
        m = sum(1 for p in ps if p["marg"] == "MARGINAL_HARM")
        nets.append((h - m) / len(ps))
    a = np.asarray(nets, dtype=float)
    return {
        "n_pairs": len(use),
        "n_subjects": len(names),
        "mean": round(float(np.mean(a)), 4),
        "median": round(float(np.median(a)), 4),
        "p025": round(float(np.percentile(a, 2.5)), 4),
        "p975": round(float(np.percentile(a, 97.5)), 4),
        "frac_gt0": round(float(np.mean(a > 0)), 4),
    }


def _loso(pairs: List[dict]) -> Dict[str, Any]:
    by_subj = defaultdict(list)
    for p in pairs:
        by_subj[p["name"]].append(p)
    names = list(by_subj.keys())
    deltas = []
    for leave in names:
        rest = [p for p in pairs if p["name"] != leave]
        if not rest:
            continue
        # overall pairwise delta C-B
        pb = sum(1 for p in rest if p["b_ok"]) / len(rest)
        pc = sum(1 for p in rest if p["c_ok"]) / len(rest)
        deltas.append({"left_out": leave, "delta_pw": round(pc - pb, 4)})
    if not deltas:
        return {}
    ds = [d["delta_pw"] for d in deltas]
    return {
        "n": len(deltas),
        "mean_delta_pw": round(float(np.mean(ds)), 4),
        "min_delta_pw": round(float(np.min(ds)), 4),
        "max_delta_pw": round(float(np.max(ds)), 4),
        "rows": deltas,
    }


def _redundancy(pairs: List[dict]) -> Dict[str, Any]:
    """Correlation of deltas among cross-D pairs."""
    cross = [p for p in pairs if not p["same_D"]]
    if len(cross) < 5:
        return {"n": len(cross)}
    dB = np.array([p["dDB"] for p in cross], dtype=float)
    dCorr = np.array([p["dCorr"] for p in cross], dtype=float)
    dAnn = np.array([p["dAnn"] for p in cross], dtype=float)

    def corr(x, y):
        if np.std(x) < 1e-12 or np.std(y) < 1e-12:
            return None
        return round(float(np.corrcoef(x, y)[0, 1]), 4)

    return {
        "n_cross": len(cross),
        "corr_DB_vs_corr": corr(dB, dCorr),
        "corr_DB_vs_Ann": corr(dB, dAnn),
        "corr_corr_vs_Ann": corr(dCorr, dAnn),
    }


def main() -> int:
    print("══════════ V2 DY 2.7A EVALUATION ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old_packs, fresh_packs, val_b = B._load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b:
            raise RuntimeError(f"Val B: {p['name']}")

    cfg = dict(arm_b.ARM_B_CONFIG)
    print("── features ──")
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

    hB, gate_map, evid = {}, {}, {}
    for pack in all_packs:
        nc = natal[pack["name"]]
        nconf = H26._natal_confidence(nc)
        for pillar, f in pack_blocks[pack["name"]].items():
            key = (pack["name"], pillar)
            hB[key] = O._h_b(f, z_params)
            evid[key] = O._regime_evidence(nc, f, f["stem"], f["branch"], f.get("rels") or [])
            gate_map[key] = H26._compute_gate(evid[key], nconf)

    def build_layers(mode: str) -> List[dict]:
        """mode: B | H1 | H2"""
        layers_by_pack = []
        score_maps = []
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
            layers, smap = {}, {}
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
                annual = 0.65 * a + 0.35 * trigger
                d_b = _clamp(BASE + 3.0 * hB[key])
                gi = gate_map[key]
                corr, _ = H26._d_correction(gi, hB[key], AMP)
                dy = 0.0
                if mode == "B":
                    corr = 0.0
                    d_eff = d_b
                elif mode == "H1":
                    d_eff = _clamp(d_b + corr)
                else:
                    f = bf[pillar]
                    cy = O._contextual_year(nc, m, f["stem"], f["branch"], gi["direction"])
                    ambiguous = abs(cy.get("reinforce", 0)) < 0.05 and abs(cy.get("dy_context", 0)) < 0.2
                    dy = H26._dy_signed(gi["gate"], cy.get("reinforce", 0.0), cy.get("dy_context", 0.0) * 0.5, ambiguous)
                    d_eff = _clamp(d_b + corr)
                y_disp = _clamp(d_eff + annual + (dy if mode == "H2" else 0.0))
                orient = _group_orientation(gi, evid[key])
                layers[int(y)] = {
                    "pillar": pillar, "D": d_eff, "D_B": d_b, "corr": corr, "dy": dy if mode == "H2" else 0.0,
                    "A": a, "annual_dev": annual, "Y": y_disp,
                    "gate": gi["gate"], "direction": gi["direction"],
                    "confidence_eff": gi["confidence_eff"],
                    "group_orient": orient,
                }
                smap[int(y)] = y_disp
            layers_by_pack.append(layers)
            score_maps.append(smap)
        return layers_by_pack, score_maps

    print("── score B / H1 / H2 ──")
    layers_B, maps_B = build_layers("B")
    layers_H1, maps_H1 = build_layers("H1")
    layers_H2, maps_H2 = build_layers("H2")

    results = {}
    for label, layers_c, maps_c in (
        ("V2_DY_B", layers_B, maps_B),
        ("V2_DY_GATE_D_ONLY::CONSERVATIVE", layers_H1, maps_H1),
        ("V2_DY_GATE_D_PLUS_DY::CONSERVATIVE", layers_H2, maps_H2),
    ):
        print(f"  {label}")
        entry = {"label": label}
        for pool_name, packs in (("FRESH_A_DEV", fresh_packs), ("OLD_DEV", old_packs)):
            idx = [i for i, p in enumerate(all_packs) if p["pool"] == pool_name]
            sub_packs = [all_packs[i] for i in idx]
            sub_maps = [maps_c[i] for i in idx]
            entry[pool_name] = {"annual": _annual_metrics(sub_packs, sub_maps)}
        results[label] = entry

    # Pair analyses: H1 vs B, H2 vs B; also B self for parent
    print("── pair attribution ──")
    analyses = {}
    for cand_name, layers_c in (
        ("H1", layers_H1),
        ("H2", layers_H2),
    ):
        analyses[cand_name] = {}
        for pool_name, packs in (("FRESH_A_DEV", fresh_packs), ("OLD_DEV", old_packs)):
            idx = [i for i, p in enumerate(all_packs) if p["pool"] == pool_name]
            sub_packs = [all_packs[i] for i in idx]
            sub_B = [layers_B[i] for i in idx]
            sub_C = [layers_c[i] for i in idx]
            pairs = _collect_pairs(sub_packs, sub_B, sub_C)
            print(f"    {cand_name} {pool_name} pairs={len(pairs)}")
            summary = _summarize_pairs(pairs, pool_name)
            if "MARGINAL_NET_VALUE" not in summary:
                print("    WARN summary keys", summary)
            summary["bootstrap_overall"] = _bootstrap_marginal(pairs, None)
            summary["bootstrap_HIGH"] = _bootstrap_marginal(pairs, "HIGH")
            summary["loso"] = _loso(pairs)
            summary["redundancy"] = _redundancy(pairs)
            # B helpful vs harmful vs orthodox corr magnitude
            help_pairs = [p for p in pairs if p["b_parent_tag"] == "PARENT_HELP" and not p["same_D"]]
            harm_pairs = [p for p in pairs if p["b_parent_tag"] == "PARENT_HARM" and not p["same_D"]]
            summary["B_help_mean_abs_corr"] = (
                None if not help_pairs else round(float(np.mean([abs(p["dCorr"]) for p in help_pairs])), 4)
            )
            summary["B_harm_mean_abs_corr"] = (
                None if not harm_pairs else round(float(np.mean([abs(p["dCorr"]) for p in harm_pairs])), 4)
            )
            summary["B_help_mean_abs_DB"] = (
                None if not help_pairs else round(float(np.mean([abs(p["dDB"]) for p in help_pairs])), 4)
            )
            summary["B_harm_mean_abs_DB"] = (
                None if not harm_pairs else round(float(np.mean([abs(p["dDB"]) for p in harm_pairs])), 4)
            )
            analyses[cand_name][pool_name] = summary
            # store pair count for erratum
            analyses[cand_name][pool_name]["_n_pairs_raw"] = len(pairs)

    # Combined diagnostic (labeled clearly)
    for cand_name, layers_c in (("H1", layers_H1), ("H2", layers_H2)):
        pairs = _collect_pairs(all_packs, layers_B, layers_c)
        summary = _summarize_pairs(pairs, "COMBINED_DEV_DIAGNOSTIC")
        summary["bootstrap_overall"] = _bootstrap_marginal(pairs, None)
        summary["bootstrap_HIGH"] = _bootstrap_marginal(pairs, "HIGH")
        analyses[cand_name]["COMBINED_DEV_DIAGNOSTIC"] = summary

    # 2.7B gate decision
    h1_fa = analyses["H1"]["FRESH_A_DEV"]
    h2_fa = analyses["H2"]["FRESH_A_DEV"]
    h1_old = analyses["H1"]["OLD_DEV"]
    h2_old = analyses["H2"]["OLD_DEV"]
    print("  H1 FA keys", sorted(h1_fa.keys())[:30], "n", h1_fa.get("n_pairs") or h1_fa.get("n"))
    print("  H2 FA keys", sorted(h2_fa.keys())[:30], "n", h2_fa.get("n_pairs") or h2_fa.get("n"))

    def passes2(fa, old) -> Tuple[bool, List[str]]:
        reasons = []
        if "MARGINAL_NET_VALUE" not in fa:
            return False, ["missing_summary_keys", str(list(fa.keys())[:20])]
        net = fa["MARGINAL_NET_VALUE"]
        boot = fa.get("bootstrap_overall") or {}
        frac = boot.get("frac_gt0")
        med = boot.get("median")
        A = bool((net is not None and net >= 0) or (frac is not None and frac >= 0.60 and (med or 0) >= 0))
        if not A:
            reasons.append("A_fail_marginal_FA")
        improve = fa.get("subject_improve_n") or 0
        if net and net > 1e-12 and improve < 2:
            reasons.append("B_fail_subject_concentration")
        C = (old.get("MARGINAL_NET_VALUE") or 0) >= -0.02
        if not C:
            reasons.append("C_fail_OLD_opposite")
        high = (fa.get("by_contrast_band") or {}).get("HIGH") or {}
        low = (fa.get("by_contrast_band") or {}).get("LOW") or {}
        high_net = high.get("MARGINAL_NET")
        low_net = low.get("MARGINAL_NET")
        if high.get("n", 0) > 0 and high_net is not None:
            if high_net < 0 and (low_net is None or high_net < low_net):
                reasons.append("D_fail_HIGH_contrast")
        flip = fa.get("parent_tag_flip_rate_A_vs_AnnB") or 0
        story = (net is not None and abs(net) > 1e-12) or flip >= 0.05
        if not story:
            reasons.append("E_fail_erratum_or_story")
        ok = len(reasons) == 0
        return ok, reasons

    h1_ok, h1_why = passes2(h1_fa, h1_old)
    h2_ok, h2_why = passes2(h2_fa, h2_old)
    run_27b = h1_ok or h2_ok

    # Prefer H1 for continuous path justification (no DxY)
    if h1_ok:
        justified_by = "H1"
    elif h2_ok:
        justified_by = "H2"
    else:
        justified_by = None

    if run_27b:
        status = "V2_DY_27_EVALUATION_ONLY"  # interim; continuous may upgrade
        decision = "RUN_27B"
    else:
        # Check if evaluation-only insight without candidate
        status = "V2_DY_B_FINAL_FINAL_FREEZE"
        decision = "SKIP_27B"

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_DY_27_EVAL",
        "validation_b_scored": False,
        "phase26_erratum": (
            "Phase 2.6 used A for primary parent attribution; "
            "correct local is annual_dev_B=0.65*A+0.35*B_trigger. "
            "Final pairwise/hit/same/cross/OLD/amplitude from 2.6 remain valid."
        ),
        "models": {
            "B": results["V2_DY_B"],
            "H1": results["V2_DY_GATE_D_ONLY::CONSERVATIVE"],
            "H2": results["V2_DY_GATE_D_PLUS_DY::CONSERVATIVE"],
        },
        "analyses": analyses,
        "gate_27b": {
            "run": run_27b,
            "justified_by": justified_by,
            "h1_ok": h1_ok,
            "h1_fail_reasons": h1_why,
            "h2_ok": h2_ok,
            "h2_fail_reasons": h2_why,
        },
        "status": status,
        "decision": decision,
    }

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    open(OUT_REPORT, "w", encoding="utf-8").write(_write_report(payload))
    open(OUT_MARG, "w", encoding="utf-8").write(_write_marg(payload))

    if not run_27b:
        open(OUT_DECISION, "w", encoding="utf-8").write(_write_decision_skip(payload))

    print("\n══════════ 2.7A DECISION ══════════")
    print("decision", decision)
    print("status", status)
    print("H1", h1_ok, h1_why, "FA net", h1_fa["MARGINAL_NET_VALUE"], "OLD net", h1_old["MARGINAL_NET_VALUE"])
    print("H2", h2_ok, h2_why, "FA net", h2_fa["MARGINAL_NET_VALUE"], "OLD net", h2_old["MARGINAL_NET_VALUE"])
    print("FA flip rate", h1_fa["parent_tag_flip_rate_A_vs_AnnB"])
    print("boot H1", h1_fa["bootstrap_overall"])
    print(f"→ {OUT_SNAP}")
    return 0 if not run_27b else 2  # exit 2 signals run 27B


def _write_report(p: dict) -> str:
    L = [
        "# V2 DY 2.7A Evaluation Report",
        "",
        f"**Decision:** `{p['decision']}`",
        f"**Status (interim):** `{p['status']}`",
        f"**Measured:** {p['measured_at']}",
        "",
        "## Phase 2.6 erratum",
        "",
        p["phase26_erratum"],
        "",
        "## Final score metrics (unchanged formulas)",
        "",
        "| model | FA pw | FA hit | OLD pw | OLD hit |",
        "|---|---:|---|---:|---|",
    ]
    for k, lab in (("B", "V2_DY_B"), ("H1", "H1"), ("H2", "H2")):
        m = p["models"][k]
        # keys differ
        if k == "B":
            fa = m["FRESH_A_DEV"]["annual"]
            old = m["OLD_DEV"]["annual"]
            name = "V2_DY_B"
        else:
            # stored under models H1/H2 with annual inside — fix structure
            pass
    # models structure: B/H1/H2 each have FRESH/OLD annual
    for name, key in (("V2_DY_B", "B"), ("H1::CONS", "H1"), ("H2::CONS", "H2")):
        m = p["models"][key]
        fa = m["FRESH_A_DEV"]["annual"]
        old = m["OLD_DEV"]["annual"]
        L.append(f"| {name} | {fa.get('pairwise_mean')} | {fa.get('hit')} | {old.get('pairwise_mean')} | {old.get('hit')} |")

    L += ["", "## Marginal value (primary)", ""]
    for cand in ("H1", "H2"):
        L.append(f"### {cand}")
        for pool in ("FRESH_A_DEV", "OLD_DEV", "COMBINED_DEV_DIAGNOSTIC"):
            a = p["analyses"][cand][pool]
            L.append(
                f"- **{pool}**: MARGINAL_NET={a['MARGINAL_NET_VALUE']} "
                f"(help={a['MARGINAL_HELP_rate']} harm={a['MARGINAL_HARM_rate']}) "
                f"subjects improve/worsen/tie={a['subject_improve_n']}/{a['subject_worsen_n']}/{a['subject_tie_n']}"
            )
            L.append(f"  - B parent NET (ann_B)={a['B_PARENT_NET']} · A-only NET={a['A_ONLY_PARENT_NET']} · flip={a['parent_tag_flip_rate_A_vs_AnnB']}")
            L.append(f"  - boot overall={a['bootstrap_overall']} · boot HIGH={a['bootstrap_HIGH']}")
            L.append(f"  - by band={a['by_contrast_band']}")
            if cand == "H2":
                L.append(f"  - attr={a['attr_counts']}")
        L.append("")
    L.append("## 2.7B gate")
    L.append("")
    L.append(f"```{json.dumps(p['gate_27b'], indent=2)}```")
    L.append("")
    return "\n".join(L)


def _write_marg(p: dict) -> str:
    L = ["# V2 DY 2.7 Marginal Value", "", f"Decision: `{p['decision']}`", ""]
    for cand in ("H1", "H2"):
        L.append(f"## {cand}")
        a = p["analyses"][cand]["FRESH_A_DEV"]
        L.append(f"FA MARGINAL_NET={a['MARGINAL_NET_VALUE']}")
        L.append(f"Subject deltas: {a['subject_deltas']}")
        L.append(f"LOSO: {a['loso']}")
        L.append(f"Redundancy: {a['redundancy']}")
        L.append("")
    return "\n".join(L)


def _write_decision_skip(p: dict) -> str:
    return "\n".join([
        "# V2 DY 2.7 Final Decision",
        "",
        "**Status:** `V2_DY_B_FINAL_FINAL_FREEZE`",
        "",
        "Phase 2.7B continuous candidate was **NOT** run.",
        "",
        "## Why",
        "",
        f"2.7A gate failed: `{json.dumps(p['gate_27b'], ensure_ascii=False)}`",
        "",
        "Corrected attribution did not show distributed, OLD-compatible, contrast-calibrated marginal value of gated orthodox D beyond V2_DY_B.",
        "",
        "## Permanent freeze",
        "",
        "- Numeric D/Y: **V2_DY_B**",
        "- Orthodox / gate / D×Y: explanation & audit only",
        "- No Phase 2.8",
        "",
        "Next: calendar foundation → Month → Day → Val B → user QA.",
        "",
    ])


if __name__ == "__main__":
    sys.exit(main())
