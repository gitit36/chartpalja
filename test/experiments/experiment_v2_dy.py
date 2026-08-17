# -*- coding: utf-8 -*-
"""
V2 Daewoon + Sewoon experiment (Phase 2).

Max 3 architecture families. No Month/Day. No Validation B.
No saju_engine.py edits.

Architectures:
  V2_DY_A  SIMPLE_CONTEXTUAL
  V2_DY_B  STRUCTURE_TRIGGER
  V2_DY_C  MINIMAL_HIERARCHY

Reference (not a candidate):
  LEGACY_B9 = engine D + G_CLEAN_AXIS annual A

Usage:
  python test/experiments/experiment_v2_dy.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from itertools import combinations, product
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import saju_engine as se  # noqa: E402
from experiments import arm_b, arm_b9, common as C  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402
from experiments.experiment_g_clean import ALPHA, score_g  # noqa: E402
from experiments.validate_g_fresh_a import (  # noqa: E402
    FRESH_JSON,
    OUT_BIRTH_QA,
    OUT_LABELS,
    _pack_subject,
    _pairwise,
    engine_recompute_birth,
)

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_dy.json")
OUT_REPORT = os.path.join(_HERE, "V2_DY_REPORT.md")

VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0
# Amplitude hygiene: sparse structural flags make MAD tiny → extreme z → 0/100 clamp.
# Winsorize z inside architectures (calibration, not a 4th candidate).
Z_CLIP = 2.5
# Prefer adj Daewoon jumps below this p90 (product DoD).
ADJ_D_P90_SOFT_MAX = 18.0


def _mad(xs: Sequence[float]) -> float:
    a = np.asarray(xs, dtype=float)
    return float(np.median(np.abs(a - np.median(a))))


def _robust_params(xs: Sequence[float]) -> Tuple[float, float]:
    med = float(np.median(xs))
    # Floor scale so binary/sparse features cannot explode z.
    scale = max(1.4826 * _mad(xs), 0.35)
    return med, scale


def _z(x: float, center: float, scale: float) -> float:
    return (float(x) - center) / scale


def _z_clip(x: float, center: float, scale: float, clip: float = Z_CLIP) -> float:
    return float(np.clip(_z(x, center, scale), -clip, clip))


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))

def _ilju_flags(meta: dict) -> Dict[str, float]:
    ilju = meta.get("세운_일주관계") or []
    if not isinstance(ilju, list):
        ilju = []
    text = " ".join(str(s) for s in ilju)
    return {
        "year_chung": 1.0 if ("충" in text) else 0.0,
        "year_hyung": 1.0 if ("형" in text) else 0.0,
        "year_hap": 1.0 if ("합" in text or "배우자" in text or "인연" in text) else 0.0,
        "year_pa_hae": 1.0 if ("파" in text or "해" in text) else 0.0,
    }


def _tg_career(meta: dict) -> float:
    sc = 0.0
    for tg in (meta.get("세운_십성_천간") or "", meta.get("세운_십성_지지") or ""):
        if tg in ("정관", "편관", "정재", "편재", "식신"):
            sc += 1.0
        elif tg in ("상관", "겁재"):
            sc -= 0.5
    return sc


def _load_pools(freeze: dict):
    import calibrate_yongshin as cy

    val_b = set(freeze["validation_b"])
    raw_ys = json.load(open(os.path.join(_TEST, "yongshin_subjects.json"), encoding="utf-8"))
    old_subjects = []
    for s in raw_ys:
        if s.get("name") == "본인":
            continue
        try:
            n = cy.normalize(s)
        except Exception:
            continue
        g = [e for e in n.get("good") or [] if not e.get("exclude")]
        b = [e for e in n.get("bad") or [] if not e.get("exclude")]
        if len(g) < 1 or len(b) < 1:
            continue
        if n["name"] in val_b:
            raise RuntimeError(f"Val B in OLD_DEV: {n['name']}")
        old_subjects.append(n)

    print(f"  OLD_DEV={len(old_subjects)}")
    old_packs = SW._preload(old_subjects)
    for pack, n in zip(old_packs, old_subjects):
        r, dw = SK._quiet_daewoon(n)
        pack["r"] = r
        pack["dw"] = dw
        pack["name"] = n["name"]
        pack["pool"] = "OLD_DEV"
        good, bad = C.prepare_events(n, {}, exclude_collisions=False)
        pack["n"] = {**pack["n"], "good": good, "bad": bad, "name": n["name"]}
        if not pack.get("d_map"):
            pack["d_map"] = arm_b9.d_map_from_daewoon_detail(dw)

    fresh = json.load(open(FRESH_JSON, encoding="utf-8"))
    by_subj = {s["name"]: s for s in fresh["subjects"]}
    birth_rows = json.load(open(OUT_BIRTH_QA, encoding="utf-8"))["rows"] if os.path.exists(OUT_BIRTH_QA) else [
        engine_recompute_birth(s) for s in fresh["subjects"]
    ]
    by_birth = {r["name"]: r for r in birth_rows}
    eligible = set(freeze["eligible_for_primary_validation"])
    events = freeze["eligible_events"]
    fresh_packs = []
    for name in freeze["validation_a"]:
        s = by_subj[name]
        if s.get("split") == "validation_b" or name in val_b:
            raise RuntimeError(f"Val B leak: {name}")
        if name not in eligible:
            continue
        pack = _pack_subject(s, by_birth[name]["engine_birth"], events[name])
        pack["pool"] = "FRESH_A_DEV"
        fresh_packs.append(pack)

    return old_packs, fresh_packs, val_b


def _block_feats(pack: dict) -> Dict[str, dict]:
    """pillar -> daewoon feature dict (no engine D as feature)."""
    r = pack.get("r") or {}
    yong = r.get("용신") or {}
    disease = yong.get("병인진단") or {}
    natal_ohang = disease.get("오행분포_raw")
    yong_e = yong.get("용신_오행") or ""
    hee = set(yong.get("희신_오행") or [])
    gi = set(yong.get("기신_오행") or [])
    fav = {yong_e} | hee - {""}
    unfav = gi - {""}
    day_stem = (r.get("원국") or {}).get("day", ["", ""])[0]

    out = {}
    for row in pack.get("dw") or []:
        pillar = row["daewoon_pillar"]
        stem, branch = row.get("stem") or pillar[0], row.get("branch") or pillar[1]
        stem_e = row.get("stemElement") or se.STEM_ELEMENT.get(stem, "")
        branch_e = row.get("branchElement") or se.BRANCH_ELEMENT_MAIN.get(branch, "")
        yfit = {}
        if day_stem and yong:
            try:
                yfit = se._check_yongshin_fit(stem, branch, yong, day_stem)
            except Exception:
                yfit = {}
        yong_f = float(yfit.get("용신부합") or row.get("용신부합") or 0.0)
        hee_f = float(yfit.get("희신부합") or row.get("희신부합") or 0.0)
        gi_f = float(yfit.get("기신부합") or row.get("기신부합") or 0.0)
        gu_f = float(yfit.get("구신부합") or 0.0)
        supplies_fav = 1.0 if (stem_e in fav or branch_e in fav) else 0.0
        supplies_unfav = 1.0 if (stem_e in unfav or branch_e in unfav) else 0.0
        fav_act = supplies_fav * (yong_f + hee_f)
        unfav_act = supplies_unfav * (gi_f + gu_f)

        rels = row.get("관계_with_원국") or []
        text = json.dumps(rels, ensure_ascii=False)
        has_hap = 1.0 if "합" in text else 0.0
        has_chung = 1.0 if "충" in text else 0.0
        has_samhap = 1.0 if ("삼합" in text or "방합" in text or "반합" in text) else 0.0
        # day pillar hit + 충
        has_day_chung = 0.0
        for rel in rels:
            if not isinstance(rel, dict):
                continue
            idx = rel.get("pillar_idx")
            pats = " ".join(str(x) for x in (rel.get("patterns") or rel.get("pairs") or []))
            if idx == 2 and "충" in pats:
                has_day_chung = 1.0
            bet = str(rel.get("between") or "")
            if "일" in bet and "충" in (pats + bet + text):
                has_day_chung = 1.0

        excess = activ = disrupt = 0.0
        try:
            excess = float(se._ohang_excess_penalty(stem, branch, natal_ohang, yong) or 0.0)
            activ = float(se._yongshin_activation_bonus(
                stem, branch, yong, natal_ohang, trine_hits=row.get("trine_hits"),
                disease_res_sc=float((row.get("breakdown") or {}).get("disease_resolution") or 0),
            ) or 0.0)
            disrupt = float(se._gishin_disruption_penalty(
                stem, branch, yong, natal_ohang,
                disease_res_sc=float((row.get("breakdown") or {}).get("disease_resolution") or 0),
            ) or 0.0)
        except Exception:
            pass

        out[pillar] = {
            "D_REF": float(row["종합운점수"]),
            "start_year": int(row["start_year"]),
            "end_year": int(row["end_year"]),
            "fav_act": fav_act,
            "unfav_act": unfav_act,
            "fav_minus_unfav": supplies_fav - supplies_unfav,
            "struct_activ": activ,
            "struct_disrupt": disrupt,
            "struct_excess": excess,
            "struct_net": activ - disrupt,
            "has_hap": has_hap,
            "has_chung": has_chung,
            "has_samhap": has_samhap,
            "has_day_chung": has_day_chung,
        }
    return out


def _annual_metrics(packs, score_maps) -> Dict[str, Any]:
    rows, pairs, seps = [], [], []
    all_s = []
    for pack, smap in zip(packs, score_maps):
        all_s.extend(smap.values())
        good = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        ga, gu = C.wavg(good, smap)
        ba, bu = C.wavg(bad, smap)
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
            "good_avg": round(float(ga), 4), "bad_avg": round(float(ba), 4),
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


def _override_stats(packs, layers_list, d_lookup) -> Dict[str, Any]:
    """D_OVERRIDE: A correct but S wrong on labeled pairs."""
    override = rescue = both_ok = both_bad = n = 0
    abs_d, abs_a, ratios = [], [], []
    for pack, layers in zip(packs, layers_list):
        goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
        bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
        for ge, be in product(goods, bads):
            Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
            da = Lg["A"] - Lb["A"]
            dg = float(d_lookup[(pack["name"], Lg["pillar"])]) - float(d_lookup[(pack["name"], Lb["pillar"])])
            ds = dg + da
            n += 1
            a_ok, d_ok, s_ok = da > 1e-9, dg > 1e-9, ds > 1e-9
            if a_ok and not s_ok:
                override += 1
            if (not a_ok) and s_ok and d_ok:
                rescue += 1
            if a_ok and s_ok:
                both_ok += 1
            if (not a_ok) and (not d_ok):
                both_bad += 1
            if Lg["pillar"] != Lb["pillar"]:
                abs_d.append(abs(dg))
                abs_a.append(abs(da))
                if abs(da) > 1e-9:
                    ratios.append(abs(dg) / abs(da))
    return {
        "n_pairs": n,
        "D_OVERRIDE_rate": None if not n else round(override / n, 4),
        "D_RESCUE_rate": None if not n else round(rescue / n, 4),
        "both_ok_rate": None if not n else round(both_ok / n, 4),
        "cross_abs_D_p50": None if not abs_d else round(float(np.median(abs_d)), 4),
        "cross_abs_A_p50": None if not abs_a else round(float(np.median(abs_a)), 4),
        "cross_absD_over_absA_p50": None if not ratios else round(float(np.median(ratios)), 4),
    }


def main() -> int:
    print("══════════ V2 DY (Phase 1+2) ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    print("── packing ──")
    old_packs, fresh_packs, val_b = _load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b:
            raise RuntimeError(f"Val B present: {p['name']}")

    cfg = dict(arm_b.ARM_B_CONFIG)
    print("── features + G_CLEAN_AXIS ──")

    # Collect all block feats for global robust z (label-free)
    all_block_rows = []
    pack_blocks = {}
    for pack in all_packs:
        bf = _block_feats(pack)
        pack_blocks[pack["name"]] = bf
        for pillar, f in bf.items():
            all_block_rows.append(f)

    z_keys = [
        "fav_act", "unfav_act", "fav_minus_unfav",
        "struct_activ", "struct_disrupt", "struct_net", "struct_excess",
        "has_hap", "has_chung", "has_samhap", "has_day_chung",
    ]
    z_params = {k: _robust_params([float(r[k]) for r in all_block_rows]) for k in z_keys}

    def zf(row, k):
        return _z_clip(row[k], *z_params[k])

    # D scores per architecture per (name, pillar)
    D_maps = {
        "LEGACY_B9": {},
        "V2_DY_A": {},
        "V2_DY_B": {},
        "V2_DY_C": {},
    }
    for pack in all_packs:
        bf = pack_blocks[pack["name"]]
        for pillar, f in bf.items():
            key = (pack["name"], pillar)
            D_maps["LEGACY_B9"][key] = float(f["D_REF"])

            # A: contextual structural blend (γ=5; z-clipped)
            h_a = (
                0.35 * zf(f, "fav_act")
                - 0.30 * zf(f, "unfav_act")
                + 0.20 * zf(f, "struct_net")
                + 0.10 * zf(f, "has_samhap")
                - 0.15 * zf(f, "has_day_chung")
                + 0.10 * zf(f, "has_hap")
            )
            D_maps["V2_DY_A"][key] = _clamp(BASE + 5.0 * h_a)

            # B: structure-only (no relation triggers in D); γ=3 after amp calibration
            h_b = (
                0.45 * zf(f, "fav_minus_unfav")
                + 0.35 * zf(f, "struct_activ")
                - 0.35 * zf(f, "struct_disrupt")
                - 0.15 * zf(f, "struct_excess")
            )
            D_maps["V2_DY_B"][key] = _clamp(BASE + 3.0 * h_b)

            # C: minimal — tiny within-person regime only
            h_c = 0.7 * zf(f, "fav_minus_unfav") + 0.3 * zf(f, "struct_net")
            D_maps["V2_DY_C"][key] = _clamp(BASE + 2.0 * h_c)
    # Year layers: G and annual trigger extras
    print("── score years ──")
    results = {}
    for arch in ("LEGACY_B9", "V2_DY_A", "V2_DY_B", "V2_DY_C"):
        print(f"  architecture {arch}")
        layers_by_pack = []
        score_maps_all = []
        d_lookup = D_maps[arch]

        for pack in all_packs:
            # G map
            gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
            # block medians of G
            by_p = defaultdict(list)
            for y, m in pack["meta"].items():
                p = str(m.get("대운_pillar") or "_")
                if (pack["name"], p) not in d_lookup:
                    continue
                by_p[p].append((int(y), gmap[int(y)]))
            med = {p: float(np.median([g for _, g in pairs])) for p, pairs in by_p.items()}

            layers = {}
            smap = {}
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                if (pack["name"], pillar) not in d_lookup:
                    continue
                g = gmap[int(y)]
                a = g - med[pillar]
                d = float(d_lookup[(pack["name"], pillar)])
                flags = _ilju_flags(m)
                tg = _tg_career(m)
                # annual trigger add-on (event-oriented; not reusing D scalars)
                trigger = (
                    1.2 * flags["year_hap"]
                    - 1.5 * flags["year_chung"]
                    - 1.0 * flags["year_hyung"]
                    - 0.8 * flags["year_pa_hae"]
                    + 0.4 * tg
                )

                if arch == "LEGACY_B9":
                    annual_dev = a
                    ctx = 0.0
                elif arch == "V2_DY_A":
                    # A: G-centered annual + small trigger + D×Y context
                    annual_dev = 0.85 * a + 0.15 * trigger
                    # context: high-pressure D + year day-clash → dampen slightly already in D;
                    # year hap in supportive D → small boost
                    d_z = (d - BASE) / 5.0
                    ctx = 0.25 * d_z * (flags["year_hap"] - flags["year_chung"])
                elif arch == "V2_DY_B":
                    # B: structure D; annual carries more trigger weight
                    annual_dev = 0.65 * a + 0.35 * trigger
                    ctx = 0.0
                else:  # C
                    annual_dev = 1.0 * a + 0.25 * trigger
                    ctx = 0.0

                y_raw = d + annual_dev + ctx
                y_disp = _clamp(y_raw)
                layers[int(y)] = {
                    "pillar": pillar,
                    "D": d,
                    "G": g,
                    "A": a,
                    "annual_dev": annual_dev,
                    "ctx": ctx,
                    "Y_raw": y_raw,
                    "Y": y_disp,
                    "trigger": trigger,
                }
                smap[int(y)] = y_disp

            layers_by_pack.append(layers)
            score_maps_all.append(smap)

        # evaluate by pool
        arch_res = {"architecture": arch}
        for pool_name, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs)):
            idx = [i for i, p in enumerate(all_packs) if p["pool"] == pool_name]
            sub_packs = [all_packs[i] for i in idx]
            sub_maps = [score_maps_all[i] for i in idx]
            sub_layers = [layers_by_pack[i] for i in idx]
            ann = _annual_metrics(sub_packs, sub_maps)
            ov = _override_stats(sub_packs, sub_layers, d_lookup)
            # amplitude
            d_vals, a_vals, adj = [], [], []
            for pack, layers in zip(sub_packs, sub_layers):
                bf = pack_blocks[pack["name"]]
                ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])
                ds = [d_lookup[(pack["name"], p)] for p, _ in ordered]
                d_vals.extend(ds)
                if len(ds) >= 2:
                    for i in range(len(ds) - 1):
                        adj.append(abs(ds[i + 1] - ds[i]))
                for L in layers.values():
                    a_vals.append(abs(L["annual_dev"]))
            arch_res[pool_name] = {
                "annual": {k: v for k, v in ann.items() if k != "subjects"},
                "subjects": ann["subjects"],
                "failures": ann["failures"],
                "override": ov,
                "amplitude": {
                    "D_p50": None if not d_vals else round(float(np.median(d_vals)), 4),
                    "D_sd": None if len(d_vals) < 2 else round(float(np.std(d_vals, ddof=1)), 4),
                    "adj_D_jump_p50": None if not adj else round(float(np.median(adj)), 4),
                    "adj_D_jump_p90": None if not adj else round(float(np.percentile(adj, 90)), 4),
                    "abs_annual_dev_p50": None if not a_vals else round(float(np.median(a_vals)), 4),
                    "abs_annual_dev_p90": None if not a_vals else round(float(np.percentile(a_vals, 90)), 4),
                },
            }
        results[arch] = arch_res

    # ── Selection among V2_DY_A/B/C only ──
    print("── select ──")
    cands = ["V2_DY_A", "V2_DY_B", "V2_DY_C"]

    def score_tuple(arch: str):
        fa = results[arch]["FRESH_A_DEV"]["annual"]
        old = results[arch]["OLD_DEV"]["annual"]
        ov = results[arch]["FRESH_A_DEV"]["override"]
        amp = results[arch]["FRESH_A_DEV"]["amplitude"]
        fa_pw = fa.get("pairwise_mean") or 0.0
        old_pw = old.get("pairwise_mean") or 0.0
        fa_hit = (fa.get("hit_rate") or 0) / 100.0
        ratio = ov.get("cross_absD_over_absA_p50")
        if ratio is None:
            ratio = 0.0  # most pairs same-block → no cross-D; not a penalty
        override = ov.get("D_OVERRIDE_rate") or 1.0
        adj_p90 = amp.get("adj_D_jump_p90") or 99.0
        amp_ok = 1 if adj_p90 <= ADJ_D_P90_SOFT_MAX else 0
        # prefer simpler: C > B > A as final tie-break
        simplicity = {"V2_DY_C": 3, "V2_DY_B": 2, "V2_DY_A": 1}[arch]
        broken = fa_pw < 0.50
        return (
            0 if broken else 1,
            fa_pw,
            amp_ok,
            old_pw,
            fa_hit,
            -(override or 1),
            -max(0.0, (ratio or 0) - 2.0),  # only penalize if D ≫ A on cross pairs
            -adj_p90,
            simplicity,
        )

    ranked = sorted(cands, key=score_tuple, reverse=True)
    winner = ranked[0]
    fa_pw = results[winner]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
    old_pw = results[winner]["OLD_DEV"]["annual"]["pairwise_mean"] or 0
    leg_fa = results["LEGACY_B9"]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
    adj_p90_w = results[winner]["FRESH_A_DEV"]["amplitude"].get("adj_D_jump_p90") or 99
    override_w = results[winner]["FRESH_A_DEV"]["override"].get("D_OVERRIDE_rate") or 1

    if (
        fa_pw >= 0.55
        and old_pw >= 0.52
        and fa_pw >= leg_fa - 0.01
        and adj_p90_w <= ADJ_D_P90_SOFT_MAX
        and override_w <= 0.10
    ):
        status = "V2_DY_READY_TO_FREEZE"
    elif fa_pw >= 0.52 and old_pw >= 0.50:
        status = "V2_DY_BORDERLINE_BUT_FREEZE"
    elif fa_pw >= 0.50 and old_pw >= 0.48 and fa_pw > leg_fa + 0.02:
        status = "V2_DY_BORDERLINE_BUT_FREEZE"
    else:
        status = "V2_DY_NOT_USABLE"

    # feature family notes
    families = {
        "V2_DY_A": {
            "D": ["fav_act", "unfav_act", "struct_net", "has_samhap", "has_day_chung", "has_hap"],
            "Y": ["G_CLEAN_AXIS centered A", "ilju trigger", "ten-god career nudge", "D×Y context"],
            "gamma_D": 5.0,
            "amp_calibration": f"z_clip=±{Z_CLIP}, scale_floor=0.35",
        },
        "V2_DY_B": {
            "D": ["fav_minus_unfav", "struct_activ", "struct_disrupt", "struct_excess"],
            "Y": ["G_CLEAN_AXIS A (0.65)", "ilju/ten-god trigger (0.35)"],
            "gamma_D": 3.0,
            "amp_calibration": f"z_clip=±{Z_CLIP}, scale_floor=0.35, gamma 4→3",
        },
        "V2_DY_C": {
            "D": ["fav_minus_unfav", "struct_net"],
            "Y": ["G_CLEAN_AXIS A", "small trigger"],
            "gamma_D": 2.0,
            "amp_calibration": f"z_clip=±{Z_CLIP}, scale_floor=0.35",
        },
    }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_DY",
        "validation_b_scored": False,
        "pools": {
            "OLD_DEV_n": len(old_packs),
            "FRESH_A_DEV_n": len(fresh_packs),
        },
        "candidates": cands,
        "reference": "LEGACY_B9",
        "results": results,
        "ranking": ranked,
        "selected": winner,
        "status": status,
        "families": families,
        "z_params": {k: {"center": v[0], "scale": v[1]} for k, v in z_params.items()},
        "selection_notes": {
            "priority": [
                "Fresh A annual pairwise",
                "amplitude adj_D_p90 soft gate",
                "OLD_DEV annual pairwise",
                "override rate",
                "simplicity tie-break",
            ],
            "adj_D_p90_soft_max": ADJ_D_P90_SOFT_MAX,
            "z_clip": Z_CLIP,
        },
        "notes": {
            "G_material": "G_CLEAN_AXIS (frozen annual reference; not retuned)",
            "D_not_engine": "V2 D does not use engine 종합운점수 as input feature",
            "max_architectures": 3,
            "amp_calibration": "winsorized z + scale floor; B gamma 4→3 (not a new architecture)",
        },
    }

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    report = _write_report(payload)
    open(OUT_REPORT, "w", encoding="utf-8").write(report)

    print("\n══════════ STATUS ══════════")
    print(status)
    print("winner", winner, "ranked", ranked)
    for arch in ["LEGACY_B9"] + cands:
        fa = results[arch]["FRESH_A_DEV"]["annual"]
        old = results[arch]["OLD_DEV"]["annual"]
        print(
            f"  {arch}: FA pw={fa['pairwise_mean']} hit={fa['hit']} | "
            f"OLD pw={old['pairwise_mean']} hit={old['hit']} | "
            f"FA override={results[arch]['FRESH_A_DEV']['override']['D_OVERRIDE_rate']} "
            f"ratio={results[arch]['FRESH_A_DEV']['override']['cross_absD_over_absA_p50']}"
        )
    print(f"snapshot → {OUT_SNAP}")
    print(f"report → {OUT_REPORT}")
    return 0


def _write_report(p: dict) -> str:
    L: List[str] = []
    L.append("# V2 Daewoon + Sewoon Report")
    L.append("")
    L.append(f"**Status:** `{p['status']}`")
    L.append(f"**Selected:** `{p['selected']}`")
    L.append(f"**Measured at:** {p['measured_at']}")
    L.append("")
    L.append("Phase 1+2 only. Month/Day not implemented. Validation B sealed. Engine untouched.")
    L.append("")

    L.append("## 1. What was wrong with the old temporal architecture?")
    L.append("")
    L.append(
        "- Daewoon and Sewoon shared `_composite_score` (same DNA + SCORE_BIAS).\n"
        "- Production year ≈ 0.6·D + 0.4·SW; B9 then did S=D+A with A from related breakdown → "
        "D amplitude (~4–5× A) mass-overrode annual direction.\n"
        "- Encoded scalars (yongshin_fit, unseong, …) failed as block material; "
        "failure is encoding, not a license to invert theory."
    )
    L.append("")

    L.append("## 2. How V2 separates Daewoon vs Sewoon")
    L.append("")
    L.append(
        "- **D:** contextual / structural regime from separated fav·unfav activation + structural "
        "subparts (+ limited relation flags in A only).\n"
        "- **Y:** parent D + centered `G_CLEAN_AXIS` annual deviation + explicit year triggers "
        "(합/충/형/파해, ten-god nudge) + optional small D×Y context (A only).\n"
        "- Engine `종합운점수` is **not** the V2 D input.\n"
        "- Amplitude hygiene: robust-z floor + winsorize ±2.5 (calibration inside the 3 families)."
    )
    L.append("")

    L.append("## 3. Three tested architectures")
    L.append("")
    for arch, fam in p["families"].items():
        L.append(f"### {arch}")
        L.append(f"- D families: {fam['D']} (γ≈{fam['gamma_D']})")
        L.append(f"- Y families: {fam['Y']}")
        L.append(f"- amp calibration: {fam.get('amp_calibration')}")
        L.append("")

    L.append("## 4. Which one wins?")
    L.append("")
    L.append(f"**Winner:** `{p['selected']}`")
    L.append(f"**Ranking:** {p['ranking']}")
    L.append("")

    L.append("## 5–6. OLD_DEV and Fresh A annual metrics")
    L.append("")
    L.append(
        "| arch | OLD hit | OLD pw | OLD std | FA hit | FA pw | FA std | "
        "FA override | cross |ΔD|/|ΔA| p50 | adj|ΔD| p50 | adj|ΔD| p90 |"
    )
    L.append("|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|")
    for arch in ["LEGACY_B9"] + p["candidates"]:
        old = p["results"][arch]["OLD_DEV"]
        fa = p["results"][arch]["FRESH_A_DEV"]
        L.append(
            f"| {arch} | {old['annual']['hit']} | {old['annual']['pairwise_mean']} | "
            f"{old['annual']['std_sep']} | {fa['annual']['hit']} | {fa['annual']['pairwise_mean']} | "
            f"{fa['annual']['std_sep']} | {fa['override']['D_OVERRIDE_rate']} | "
            f"{fa['override']['cross_absD_over_absA_p50']} | "
            f"{fa['amplitude']['adj_D_jump_p50']} | {fa['amplitude']['adj_D_jump_p90']} |"
        )
    L.append("")

    w = p["selected"]
    L.append("### Fresh A subjects (winner)")
    L.append("")
    L.append("| name | hit | sep | pairwise |")
    L.append("|---|:-:|---:|---:|")
    for r in p["results"][w]["FRESH_A_DEV"]["subjects"]:
        L.append(f"| {r['name']} | {r['hit']} | {r['sep']} | {r['pairwise']} |")
    L.append("")

    L.append("## 7–10. Does D override A? Amplitude? Extreme jumps?")
    L.append("")
    fa = p["results"][w]["FRESH_A_DEV"]
    old = p["results"][w]["OLD_DEV"]
    leg = p["results"]["LEGACY_B9"]["FRESH_A_DEV"]
    L.append(
        f"- **7. Override:** FA D_OVERRIDE_rate={fa['override']['D_OVERRIDE_rate']} "
        f"(legacy {leg['override']['D_OVERRIDE_rate']}); "
        f"OLD={old['override']['D_OVERRIDE_rate']}"
    )
    L.append(
        f"- **8. Typical D amplitude:** adj|ΔD| p50/p90 = "
        f"{fa['amplitude']['adj_D_jump_p50']}/{fa['amplitude']['adj_D_jump_p90']} "
        f"(FA); OLD {old['amplitude']['adj_D_jump_p50']}/{old['amplitude']['adj_D_jump_p90']}"
    )
    L.append(
        f"- **9. Typical annual |dev|:** p50/p90 = "
        f"{fa['amplitude']['abs_annual_dev_p50']}/{fa['amplitude']['abs_annual_dev_p90']}"
    )
    L.append(
        f"- **10. Extreme jumps:** soft gate adj_p90 ≤ "
        f"{p.get('selection_notes', {}).get('adj_D_p90_soft_max', 18)}; "
        f"winner FA adj_p90={fa['amplitude']['adj_D_jump_p90']} "
        f"(legacy {leg['amplitude']['adj_D_jump_p90']})"
    )
    L.append(
        f"- Cross-daewoon |ΔD|/|ΔA| p50 (FA)={fa['override']['cross_absD_over_absA_p50']} "
        f"(legacy {leg['override']['cross_absD_over_absA_p50']})"
    )
    L.append("")

    L.append("## 11–12. Feature dominance / double-count")
    L.append("")
    fam = p["families"][w]
    L.append(f"- Winner D families: {fam['D']}")
    L.append(f"- Winner Y families: {fam['Y']}")
    L.append(
        "- D uses separated activation/structure (not enc_* scalars).\n"
        "- Y still uses `G_CLEAN_AXIS` (known thematic overlap with classical families) "
        "+ explicit ilju/ten-god triggers.\n"
        "- Residual double-theme risk: 용신/관계 concepts appear in G and lightly in D fav/unfav — "
        "accepted at different timescales; no final-G pattern restack."
    )
    L.append("")

    L.append("## 13–14. Weaknesses / backlog")
    L.append("")
    L.append(
        "- Annual signal still modest on OLD_DEV; FA n=14 is small.\n"
        "- Block-target construct imperfect (backlog) — not reopened.\n"
        "- G_CLEAN_AXIS not redesigned this phase.\n"
        "- Sparse D features can still produce plateaus (adj p50 near 0) even after z-clip.\n"
        "- Month/Day not built yet.\n"
        "- See `V2_RND_BACKLOG.md`."
    )
    L.append("")

    L.append("## 15. Freeze readiness — proceed to Month/Day?")
    L.append("")
    L.append(f"**`{p['status']}`**")
    if p["status"] in ("V2_DY_READY_TO_FREEZE", "V2_DY_BORDERLINE_BUT_FREEZE"):
        L.append("")
        L.append("Yes — D/Y frozen enough to proceed to Month/Day in the **next** explicit phase.")
        L.append("Do **not** invent more DY candidates. Do **not** open Validation B.")
    else:
        L.append("")
        L.append("No — not usable under freeze rules. Document and stop without Month/Day.")
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
