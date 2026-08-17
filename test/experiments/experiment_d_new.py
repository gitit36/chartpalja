# -*- coding: utf-8 -*-
"""
D_NEW material experiment (experiment-only).

Frozen: G_CLEAN_AXIS, α=1, κ=0, β=0.25, median centering.
No saju_engine edit. No Validation B.

Writes:
  test/snapshots/exp_d_new.json
  test/experiments/D_NEW_REPORT.md

Usage:
  python test/experiments/experiment_d_new.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from scipy.stats import kendalltau, spearmanr

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_b, arm_b9, common as C  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402
from experiments.audit_d_material import (  # noqa: E402
    CASE_NAMES,
    _axis_tags,
    _block_targets,
    _dist,
    _pct,
    _w,
)
from experiments.experiment_g_clean import ALPHA, score_g  # noqa: E402
from experiments.validate_g_fresh_a import (  # noqa: E402
    FRESH_JSON,
    OUT_BIRTH_QA,
    OUT_LABELS,
    _pack_subject,
    _pairwise,
    engine_recompute_birth,
)

try:
    from sklearn.linear_model import Ridge
except ImportError:  # pragma: no cover
    Ridge = None

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_d_new.json")
OUT_REPORT = os.path.join(_HERE, "D_NEW_REPORT.md")

VARIANT = "G_CLEAN_AXIS"
BASE = 60.0
GAMMAS = [3, 5, 7, 9]
RIDGE_ALPHAS = [0.1, 1.0, 10.0]
N_PERM = 200
RNG = np.random.RandomState(42)

CORE_FAMS = ("fit", "unseong", "relations", "balance", "structural")
AUX_FAMS = ("trine", "shinsal", "disease", "haegong")
ALL_FAMS = CORE_FAMS + AUX_FAMS

# Material gate (predeclared)
GATE_COMBINED_MIN = 0.52
GATE_FRESH_MIN = 0.50
GATE_OLD_FLOOR = 0.48


def _mad(xs: Sequence[float]) -> float:
    a = np.asarray(xs, dtype=float)
    med = float(np.median(a))
    return float(np.median(np.abs(a - med)))


def _robust_z_params(xs: Sequence[float]) -> Tuple[float, float]:
    med = float(np.median(xs))
    mad = _mad(xs)
    scale = max(1.4826 * mad, 1e-6)
    return med, scale


def _z_params(xs: Sequence[float]) -> Tuple[float, float]:
    m = float(np.mean(xs))
    sd = float(np.std(xs, ddof=1)) if len(xs) > 1 else 1.0
    return m, max(sd, 1e-6)


def _apply_z(x: float, center: float, scale: float) -> float:
    return (float(x) - center) / scale


def _eval_scores(blocks: List[dict], score_key: str, target_key: str = "simple_net") -> Dict[str, Any]:
    by_subj: Dict[str, List[dict]] = defaultdict(list)
    for b in blocks:
        if b.get("insufficient_event_evidence"):
            continue
        if b.get(target_key) is None:
            continue
        if b.get(score_key) is None:
            continue
        by_subj[b["name"]].append(b)

    pair_rates = []
    wins = ties = losses = 0
    all_s, all_t = [], []
    for name, blist in by_subj.items():
        if len(blist) < 2:
            continue
        ss = [float(b[score_key]) for b in blist]
        ts = [float(b[target_key]) for b in blist]
        all_s.extend(ss)
        all_t.extend(ts)
        local_w = local_t = local_l = 0
        for i, j in combinations(range(len(blist)), 2):
            if abs(ts[i] - ts[j]) < 1e-12:
                continue
            if ts[i] > ts[j]:
                better, worse = ss[i], ss[j]
            else:
                better, worse = ss[j], ss[i]
            if better > worse + 1e-12:
                wins += 1
                local_w += 1
            elif abs(better - worse) <= 1e-12:
                ties += 1
                local_t += 1
            else:
                losses += 1
                local_l += 1
        nloc = local_w + local_t + local_l
        if nloc:
            pair_rates.append((local_w + 0.5 * local_t) / nloc)

    n_pairs = wins + ties + losses
    sp = ken = None
    if len(all_s) >= 3:
        sp_r = spearmanr(all_s, all_t)
        ken_r = kendalltau(all_s, all_t)
        sp = None if sp_r.correlation != sp_r.correlation else round(float(sp_r.correlation), 4)
        ken = None if ken_r.correlation != ken_r.correlation else round(float(ken_r.correlation), 4)

    return {
        "target": target_key,
        "n_subjects": len(pair_rates),
        "n_pairs": n_pairs,
        "wins": wins,
        "ties": ties,
        "losses": losses,
        "pairwise_mean": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "pairwise_median": None if not pair_rates else round(float(np.median(pair_rates)), 4),
        "pairwise_p25": None if not pair_rates else round(float(np.percentile(pair_rates, 25)), 4),
        "pairwise_p75": None if not pair_rates else round(float(np.percentile(pair_rates, 75)), 4),
        "pairwise_pooled": None if not n_pairs else round((wins + 0.5 * ties) / n_pairs, 4),
        "spearman": sp,
        "kendall": ken,
    }


def _classify_primitive(old_pw, fa_pw, comb_pw, theory_sign: int = 1) -> str:
    def band(p):
        if p is None:
            return "INSUFFICIENT"
        if p > 0.55:
            return "SUPPORTIVE"
        if p < 0.45:
            return "HARMFUL"
        return "NEUTRAL"

    bo, bf, bc = band(old_pw), band(fa_pw), band(comb_pw)
    if bo == "INSUFFICIENT" or bf == "INSUFFICIENT":
        return "INSUFFICIENT"
    if (bo == "SUPPORTIVE" and bf == "HARMFUL") or (bo == "HARMFUL" and bf == "SUPPORTIVE"):
        return "UNSTABLE"
    # theory conflict: expected + but both harmful
    if theory_sign > 0 and bo == "HARMFUL" and bf == "HARMFUL":
        return "THEORY_DATA_CONFLICT"
    if theory_sign > 0 and bc == "HARMFUL" and bo != "SUPPORTIVE" and bf != "SUPPORTIVE":
        return "THEORY_DATA_CONFLICT"
    if bc == "SUPPORTIVE" or (bo == "SUPPORTIVE" and bf in ("SUPPORTIVE", "NEUTRAL")):
        return "SUPPORTIVE"
    if bo == "HARMFUL" and bf == "HARMFUL":
        return "HARMFUL"
    if bc == "HARMFUL":
        return "HARMFUL"
    return "NEUTRAL"


def _decompose_layers(pack: dict, cfg: dict) -> Dict[int, dict]:
    gmap = {int(y): float(score_g(m, VARIANT, cfg)) for y, m in pack["meta"].items()}
    by_p: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    for y, m in pack["meta"].items():
        p = str(m.get("대운_pillar") or "_")
        if p not in pack["d_map"]:
            continue
        by_p[p].append((int(y), gmap[int(y)]))
    out = {}
    for p, pairs in by_p.items():
        med = float(np.median([g for _, g in pairs]))
        d_b = float(pack["d_map"][p])
        for y, g in pairs:
            out[y] = {"G": g, "A": g - med, "D": d_b, "pillar": p}
    return out


def _annual_metrics(packs: List[dict], score_maps: List[Dict[int, float]]) -> Dict[str, Any]:
    rows, pair_rates, seps = [], [], []
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
            pair_rates.append(pr)
        sep = float(ga - ba)
        seps.append(sep)
        rows.append({
            "name": pack["name"], "hit": 1 if ga > ba else 0,
            "sep": round(sep, 4), "pairwise": None if pr is None else round(pr, 4),
        })
    hits = [r["hit"] for r in rows]
    pooled_sd = float(np.std(all_s, ddof=1)) if len(all_s) > 1 else float("nan")
    raw = float(np.mean(seps)) if seps else float("nan")
    std = (raw / pooled_sd) if pooled_sd and pooled_sd > 1e-12 else float("nan")
    return {
        "n": len(rows),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "hit_rate": None if not hits else round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "raw_sep_mean": None if raw != raw else round(raw, 4),
        "std_sep": None if std != std else round(std, 4),
        "subjects": rows,
    }


def _attrib_pairs(packs, layers_list, d_by_name_pillar):
    """Count D_OVERRIDE / D_RESCUE on labeled good/bad pairs."""
    override = rescue = both_wrong = both_right = 0
    n = 0
    for pack, layers in zip(packs, layers_list):
        goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
        bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
        for ge in goods:
            for be in bads:
                Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
                da = Lg["A"] - Lb["A"]
                dg_pillar = d_by_name_pillar.get((pack["name"], Lg["pillar"]))
                db_pillar = d_by_name_pillar.get((pack["name"], Lb["pillar"]))
                if dg_pillar is None or db_pillar is None:
                    continue
                dd = float(dg_pillar) - float(db_pillar)
                ds = dd + da
                n += 1
                a_ok = da > 1e-12
                d_ok = dd > 1e-12
                s_ok = ds > 1e-12
                if a_ok and not s_ok:
                    override += 1
                elif (not a_ok) and s_ok and d_ok:
                    rescue += 1
                if (not a_ok) and (not d_ok):
                    both_wrong += 1
                if a_ok and d_ok and s_ok:
                    both_right += 1
    return {
        "n_pairs": n,
        "D_OVERRIDE": override,
        "D_OVERRIDE_rate": None if not n else round(override / n, 4),
        "D_RESCUE": rescue,
        "D_RESCUE_rate": None if not n else round(rescue / n, 4),
        "BOTH_WRONG": both_wrong,
        "BOTH_RIGHT": both_right,
    }


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
            raise RuntimeError(f"BUG: Validation B in OLD_DEV: {n['name']}")
        old_subjects.append(n)

    print(f"  OLD_DEV usable={len(old_subjects)}")
    old_packs = SW._preload(old_subjects)
    for pack, n in zip(old_packs, old_subjects):
        _r, dw = SK._quiet_daewoon(n)
        pack["dw"] = dw
        pack["name"] = n["name"]
        pack["pool"] = "OLD_DEV"
        good, bad = C.prepare_events(n, {}, exclude_collisions=False)
        pack["n"] = {**pack["n"], "good": good, "bad": bad, "name": n["name"]}

    fresh = json.load(open(FRESH_JSON, encoding="utf-8"))
    by_subj = {s["name"]: s for s in fresh["subjects"]}
    if os.path.exists(OUT_BIRTH_QA):
        birth_rows = json.load(open(OUT_BIRTH_QA, encoding="utf-8"))["rows"]
    else:
        birth_rows = [engine_recompute_birth(s) for s in fresh["subjects"]]
    by_birth = {r["name"]: r for r in birth_rows}
    eligible = set(freeze["eligible_for_primary_validation"])
    events = freeze["eligible_events"]
    fresh_packs = []
    for name in freeze["validation_a"]:
        s = by_subj[name]
        if s.get("split") == "validation_b" or name in val_b:
            raise RuntimeError(f"BUG: Validation B leak: {name}")
        if name not in eligible:
            continue
        pack = _pack_subject(s, by_birth[name]["engine_birth"], events[name])
        pack["pool"] = "FRESH_A_DEV"
        fresh_packs.append(pack)

    return old_packs, fresh_packs, val_b


def _extract_blocks(packs: List[dict]) -> List[dict]:
    blocks = []
    for pack in packs:
        dw = pack.get("dw") or []
        if not pack.get("d_map"):
            pack["d_map"] = arm_b9.d_map_from_daewoon_detail(dw)
        events_by_pillar: Dict[str, Dict[str, List[dict]]] = defaultdict(lambda: {"good": [], "bad": []})
        for side in ("good", "bad"):
            for e in pack["n"].get(side) or []:
                if e.get("exclude"):
                    continue
                y = int(e["year"])
                for row in dw:
                    if int(row["start_year"]) <= y < int(row["end_year"]):
                        events_by_pillar[row["daewoon_pillar"]][side].append(e)
                        break
        for row in sorted(dw, key=lambda r: int(r["start_year"])):
            pillar = row["daewoon_pillar"]
            bd = row.get("breakdown") or {}
            tg = _block_targets(events_by_pillar.get(pillar, {"good": [], "bad": []}))
            # primitives from breakdown + row fields (no final D as feature)
            fit = float(bd.get("yongshin_fit") or 0.0)
            uns = float(bd.get("unseong") or 0.0)
            uns_ctx = float(bd.get("unseong_context") or 0.0)
            rel = float(bd.get("relations") or 0.0)
            bal = float(bd.get("balance") or 0.0)
            struct = float(bd.get("structural_adj") or 0.0)
            tri = float(bd.get("trine") or 0.0)
            shin = float(bd.get("shinsal") or 0.0)
            dis = float(bd.get("disease_resolution") or 0.0)
            haeg = float(bd.get("haegong") or 0.0)
            h_raw = sum(float(bd.get(k) or 0.0) for k in (
                "base", "yongshin_fit", "unseong", "unseong_context", "relations", "trine",
                "balance", "shinsal", "disease_resolution", "haegong", "structural_adj",
            ))
            energy = ((row.get("indicators") or {}).get("에너지장") or {})
            gm = row.get("gongmang_factors") or {}
            blocks.append({
                "pool": pack["pool"],
                "name": pack["name"],
                "daewoon_pillar": pillar,
                "start_year": int(row["start_year"]),
                "end_year": int(row["end_year"]),
                "D_REF": float(row["종합운점수"]),
                "H_REF_RAW": round(h_raw, 6),
                "prim": {
                    "fit": fit,
                    "unseong": uns + uns_ctx,
                    "unseong_only": uns,
                    "unseong_context": uns_ctx,
                    "relations": rel,
                    "balance": bal,
                    "structural": struct,
                    "trine": tri,
                    "shinsal": shin,
                    "disease": dis,
                    "haegong": haeg,
                    "yong_fit": float(row.get("용신부합") or 0.0),
                    "hee_fit": float(row.get("희신부합") or 0.0),
                    "gi_fit": float(row.get("기신부합") or 0.0),
                    "energy_direction": float(energy.get("direction") or 0.0),
                    "noble_power": float(((row.get("indicators") or {}).get("귀인력") or 0.0)
                                        if not isinstance((row.get("indicators") or {}).get("귀인력"), dict)
                                        else 0.0),
                    "gm_unseong": float(gm.get("unseong") or 1.0),
                    "gm_rel": float(gm.get("rel") or 1.0),
                    "gm_yfit_branch": float(gm.get("yfit_branch") or 1.0),
                    "raw_unseong_state": row.get("12운성"),
                    "tg_stem": row.get("십성_천간"),
                    "tg_branch": row.get("십성_지지"),
                },
                **tg,
            })
    return blocks


def main() -> int:
    print("══════════ D_NEW MATERIAL EXPERIMENT ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    print("── packing pools ──")
    old_packs, fresh_packs, val_b = _load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b or p.get("split") == "validation_b":
            raise RuntimeError(f"BUG: Validation B present: {p['name']}")

    print("── extract blocks ──")
    blocks = _extract_blocks(all_packs)
    print(f"blocks={len(blocks)} evidence={sum(1 for b in blocks if not b['insufficient_event_evidence'])}")

    # ── normalization params on ALL development blocks (label-free) ──
    fam_raw = {f: [b["prim"][f] for b in blocks] for f in ALL_FAMS}
    robust_params = {f: _robust_z_params(fam_raw[f]) for f in ALL_FAMS}
    z_params = {f: _z_params(fam_raw[f]) for f in ALL_FAMS}

    for b in blocks:
        b["z_robust"] = {f: _apply_z(b["prim"][f], *robust_params[f]) for f in ALL_FAMS}
        b["z_mean"] = {f: _apply_z(b["prim"][f], *z_params[f]) for f in ALL_FAMS}
        # aux family = mean of aux robust z
        b["z_robust"]["auxiliary"] = float(np.mean([b["z_robust"][f] for f in AUX_FAMS]))
        b["z_mean"]["auxiliary"] = float(np.mean([b["z_mean"][f] for f in AUX_FAMS]))

    def pool_blocks(pool: str) -> List[dict]:
        if pool == "COMBINED_DEV":
            return blocks
        return [b for b in blocks if b["pool"] == pool]

    # ── Phase: feature direction audit ──
    print("── feature direction audit ──")
    direction = {}
    for fam in ALL_FAMS:
        direction[fam] = {}
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            bl = pool_blocks(pool)
            for b in bl:
                b["_tmp_score"] = b["z_robust"][fam]
            direction[fam][pool] = {
                "simple_net": _eval_scores(bl, "_tmp_score", "simple_net"),
                "normalized_balance": _eval_scores(bl, "_tmp_score", "normalized_balance"),
                "high_confidence_balance": _eval_scores(bl, "_tmp_score", "high_confidence_balance"),
            }
        old_pw = direction[fam]["OLD_DEV"]["simple_net"]["pairwise_mean"]
        fa_pw = direction[fam]["FRESH_A_DEV"]["simple_net"]["pairwise_mean"]
        comb_pw = direction[fam]["COMBINED_DEV"]["simple_net"]["pairwise_mean"]
        direction[fam]["class"] = _classify_primitive(old_pw, fa_pw, comb_pw, theory_sign=1)
        direction[fam]["activation_rate"] = round(
            sum(1 for b in blocks if abs(b["prim"][fam]) > 1e-9) / len(blocks), 4
        )

    supportive = [
        f for f in CORE_FAMS
        if direction[f]["class"] in ("SUPPORTIVE", "NEUTRAL")
        and direction[f]["class"] not in ("HARMFUL", "THEORY_DATA_CONFLICT", "UNSTABLE")
        and (direction[f]["COMBINED_DEV"]["simple_net"]["pairwise_mean"] or 0) >= 0.50
    ]
    if not supportive:
        ranked = sorted(
            [
                f for f in CORE_FAMS
                if direction[f]["class"] not in ("HARMFUL", "THEORY_DATA_CONFLICT", "UNSTABLE")
            ],
            key=lambda f: (direction[f]["COMBINED_DEV"]["simple_net"]["pairwise_mean"] or 0),
            reverse=True,
        )
        supportive = ranked[:2]
    if not supportive:
        supportive = ["relations", "structural"]

    # D6: never include THEORY_DATA_CONFLICT / HARMFUL / UNSTABLE
    d6_fams = [f for f in CORE_FAMS if direction[f]["class"] == "SUPPORTIVE"]
    if len(d6_fams) < 2:
        d6_fams = [
            f for f in list(supportive)[:3]
            if direction[f]["class"] not in ("HARMFUL", "THEORY_DATA_CONFLICT", "UNSTABLE")
        ]
    d6_fams = [
        f for f in d6_fams
        if direction[f]["class"] not in ("HARMFUL", "THEORY_DATA_CONFLICT", "UNSTABLE")
    ]
    if len(d6_fams) < 1:
        d6_fams = ["relations", "structural"]
    print(f"  D6_MINIMAL families={d6_fams} (supportive_pool={supportive})")

    # ── Candidate H scores ──
    def set_h(bl, key, fams, zsrc="z_robust"):
        for b in bl:
            vals = [b[zsrc][f] for f in fams]
            b[key] = float(np.mean(vals)) if vals else 0.0

    for b in blocks:
        b["D_REF_score"] = b["D_REF"]
        b["H_REF_RAW_score"] = b["H_REF_RAW"]

    set_h(blocks, "D1_EQUAL_ALL", list(CORE_FAMS) + ["auxiliary"])
    set_h(blocks, "D2_CORE", list(CORE_FAMS))
    set_h(blocks, "D3_NO_YFIT", [f for f in CORE_FAMS if f != "fit"])
    set_h(blocks, "D4_NO_UNSEONG", [f for f in CORE_FAMS if f != "unseong"])
    set_h(blocks, "D5_NO_RELATIONS", [f for f in CORE_FAMS if f != "relations"])
    set_h(blocks, "D6_MINIMAL", d6_fams)

    # sensitivity: D2 with mean-z
    set_h(blocks, "D2_CORE_meanz", list(CORE_FAMS), zsrc="z_mean")

    # aux one-at-a-time on top of D2
    for aux in AUX_FAMS:
        set_h(blocks, f"D2_PLUS_{aux.upper()}", list(CORE_FAMS) + [aux])

    cand_keys = [
        "D_REF_score", "H_REF_RAW_score",
        "D1_EQUAL_ALL", "D2_CORE", "D3_NO_YFIT", "D4_NO_UNSEONG", "D5_NO_RELATIONS",
        "D6_MINIMAL", "D2_CORE_meanz",
    ] + [f"D2_PLUS_{a.upper()}" for a in AUX_FAMS]

    print("── evaluate deterministic candidates ──")
    cand_eval = {}
    for key in cand_keys:
        cand_eval[key] = {}
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            bl = pool_blocks(pool)
            cand_eval[key][pool] = {
                "simple_net": _eval_scores(bl, key, "simple_net"),
                "normalized_balance": _eval_scores(bl, key, "normalized_balance"),
                "high_confidence_balance": _eval_scores(bl, key, "high_confidence_balance"),
            }

    # ── D7 constrained ridge LOSO ──
    print("── D7 constrained ridge LOSO ──")
    d7 = {"available": Ridge is not None}
    if Ridge is not None:
        evid = [b for b in blocks if not b["insufficient_event_evidence"]]
        subjects = sorted({b["name"] for b in evid})
        X_all = np.array([[b["z_robust"][f] for f in CORE_FAMS] for b in evid], dtype=float)
        y_all = np.array([b["simple_net"] for b in evid], dtype=float)
        names = [b["name"] for b in evid]

        best_reg = None
        best_cv = -1.0
        cv_by_reg = {}
        oof_scores = {id(b): None for b in evid}  # use index
        oof_by_idx = [None] * len(evid)

        for reg in RIDGE_ALPHAS:
            oof = []
            fold_coefs = []
            for held in subjects:
                tr_idx = [i for i, n in enumerate(names) if n != held]
                te_idx = [i for i, n in enumerate(names) if n == held]
                if len(tr_idx) < 5 or not te_idx:
                    continue
                model = Ridge(alpha=reg, fit_intercept=True)
                model.fit(X_all[tr_idx], y_all[tr_idx])
                pred = model.predict(X_all[te_idx])
                fold_coefs.append(model.coef_.tolist())
                for j, i in enumerate(te_idx):
                    oof_by_idx[i] = float(pred[j])
            # assign oof to temp key on evidence blocks
            for i, b in enumerate(evid):
                b["_d7_oof"] = oof_by_idx[i]
            # evaluate oof on combined evidence
            for b in blocks:
                b["D7_OOF"] = None
            for b in evid:
                b["D7_OOF"] = b["_d7_oof"]
            metrics = {}
            for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
                bl = [b for b in pool_blocks(pool) if b.get("D7_OOF") is not None]
                metrics[pool] = _eval_scores(bl, "D7_OOF", "simple_net")
            pw = metrics["COMBINED_DEV"]["pairwise_mean"] or 0.0
            cv_by_reg[str(reg)] = {
                "metrics": metrics,
                "coef_folds": fold_coefs,
                "coef_mean": None if not fold_coefs else [round(float(x), 4) for x in np.mean(fold_coefs, axis=0)],
                "coef_std": None if not fold_coefs else [round(float(x), 4) for x in np.std(fold_coefs, axis=0)],
                "sign_stable": None if not fold_coefs else [
                    bool(np.all(np.array(fold_coefs)[:, j] > 0) or np.all(np.array(fold_coefs)[:, j] < 0))
                    for j in range(len(CORE_FAMS))
                ],
            }
            if pw > best_cv:
                best_cv = pw
                best_reg = reg
                # keep best oof on blocks
                for b in evid:
                    b["D7_CONSTRAINED"] = b["_d7_oof"]

        d7.update({
            "features": list(CORE_FAMS),
            "best_alpha_reg": best_reg,
            "cv_by_reg": cv_by_reg,
            "note": "OOF LOSO primary; in-sample not used for evidence",
        })
        cand_eval["D7_CONSTRAINED"] = {}
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            bl = [b for b in pool_blocks(pool) if b.get("D7_CONSTRAINED") is not None]
            cand_eval["D7_CONSTRAINED"][pool] = {
                "simple_net": _eval_scores(bl, "D7_CONSTRAINED", "simple_net"),
                "normalized_balance": _eval_scores(bl, "D7_CONSTRAINED", "normalized_balance"),
                "high_confidence_balance": _eval_scores(bl, "D7_CONSTRAINED", "high_confidence_balance"),
            }
        # Freeze production scoring coefficients on full evidence (amplitude / all-block map).
        # Material gate evidence remains OOF above — do not use in-sample for gating.
        if best_reg is not None:
            final = Ridge(alpha=best_reg, fit_intercept=True)
            final.fit(X_all, y_all)
            d7["frozen_coef"] = [round(float(x), 6) for x in final.coef_]
            d7["frozen_intercept"] = round(float(final.intercept_), 6)
            for b in blocks:
                x = np.array([[b["z_robust"][f] for f in CORE_FAMS]], dtype=float)
                b["D7_CONSTRAINED_ALL"] = float(final.predict(x)[0])
                # For selected-H amplitude, prefer ALL-block score; OOF kept separately
                if b.get("D7_CONSTRAINED") is None:
                    b["D7_CONSTRAINED"] = b["D7_CONSTRAINED_ALL"]
        else:
            for b in blocks:
                b["D7_CONSTRAINED"] = b.get("D7_CONSTRAINED")
    else:
        d7["error"] = "sklearn not available"

    # ── Material selection ──
    print("── material selection ──")

    def passes_gate(key: str) -> Tuple[bool, Dict[str, Any]]:
        ev = cand_eval.get(key) or {}
        if not ev:
            return False, {}
        comb = (ev.get("COMBINED_DEV") or {}).get("simple_net") or {}
        fa = (ev.get("FRESH_A_DEV") or {}).get("simple_net") or {}
        old = (ev.get("OLD_DEV") or {}).get("simple_net") or {}
        c_pw, f_pw, o_pw = comb.get("pairwise_mean"), fa.get("pairwise_mean"), old.get("pairwise_mean")
        ok = (
            c_pw is not None and c_pw >= GATE_COMBINED_MIN
            and f_pw is not None and f_pw >= GATE_FRESH_MIN
            and o_pw is not None and o_pw >= GATE_OLD_FLOOR
        )
        # concentration: p75-p25 and n_subjects
        if ok and (comb.get("n_subjects") or 0) < 5:
            ok = False
        # robustness: at least one of normalized/high-conf not < 0.48 if defined
        for t in ("normalized_balance", "high_confidence_balance"):
            tp = (ev.get("COMBINED_DEV") or {}).get(t, {}).get("pairwise_mean")
            if tp is not None and tp < 0.45:
                ok = False
        return ok, {"combined": c_pw, "fresh": f_pw, "old": o_pw, "n_subj": comb.get("n_subjects")}

    # Prefer simpler deterministic over D7 if tied
    select_order = [
        "D6_MINIMAL", "D3_NO_YFIT", "D4_NO_UNSEONG", "D5_NO_RELATIONS",
        "D2_CORE", "D1_EQUAL_ALL", "D7_CONSTRAINED",
    ]
    # also consider aux if they beat core
    select_order += [f"D2_PLUS_{a.upper()}" for a in AUX_FAMS]

    gated = []
    for key in select_order:
        ok, info = passes_gate(key)
        if not ok:
            continue
        # Extra cleanliness gate for supervised: reject theory-inverted / unstable fits
        if key == "D7_CONSTRAINED":
            br = str(d7.get("best_alpha_reg"))
            info_cv = (d7.get("cv_by_reg") or {}).get(br) or {}
            sign_stable = info_cv.get("sign_stable") or []
            coef_mean = info_cv.get("coef_mean") or []
            n_stable = sum(1 for s in sign_stable if s)
            # Reject if <4/5 sign-stable OR any CORE family with THEORY_DATA_CONFLICT
            # receives a large negative mean coefficient (label inversion of harmful primitives).
            inverted_conflict = False
            for fam, coef in zip(CORE_FAMS, coef_mean):
                if direction[fam]["class"] in ("THEORY_DATA_CONFLICT", "HARMFUL") and coef is not None and coef < -0.05:
                    inverted_conflict = True
            if n_stable < 4 or inverted_conflict:
                info = {
                    **info,
                    "rejected_cleanliness": True,
                    "n_sign_stable": n_stable,
                    "inverted_conflict": inverted_conflict,
                    "coef_mean": coef_mean,
                }
                # record but do not accept as gated freeze candidate
                print(f"  D7 failed cleanliness gate: stable={n_stable}/5 inverted_conflict={inverted_conflict}")
                continue
        gated.append((key, info))

    # Track D7 OOF metrics even if cleanliness-rejected
    d7_gate_note = None
    if "D7_CONSTRAINED" in cand_eval:
        ok7, info7 = passes_gate("D7_CONSTRAINED")
        d7_gate_note = {"numeric_gate": ok7, **info7}

    # pick best among gated by fresh then combined; prefer simpler (earlier in select_order)
    H_key = None
    if gated:
        # sort by fresh, combined; stable by order index
        def score_tuple(item):
            key, info = item
            return (
                info.get("fresh") or 0,
                info.get("combined") or 0,
                -select_order.index(key) if key in select_order else -99,
            )
        gated_sorted = sorted(gated, key=score_tuple, reverse=True)
        # if top two within 0.01 fresh, prefer earlier (simpler)
        top = gated_sorted[0]
        for other in gated:
            if other[0] == top[0]:
                continue
            if abs((other[1].get("fresh") or 0) - (top[1].get("fresh") or 0)) <= 0.01:
                if select_order.index(other[0]) < select_order.index(top[0]):
                    top = other
        H_key = top[0]

    material_ready = H_key is not None
    # Amplitude uses a complete block score map. For D7, OOF is gate-only;
    # frozen full-fit scores live on D7_CONSTRAINED_ALL.
    H_score_key = H_key
    if H_key == "D7_CONSTRAINED":
        H_score_key = "D7_CONSTRAINED_ALL"
    print(f"  gated={[(k, i) for k, i in gated]}")
    print(f"  selected H={H_key} score_key={H_score_key} material_ready={material_ready}")

    # permutation null for selected H
    perm_diag = None
    if material_ready:
        fa_bl = [b for b in pool_blocks("FRESH_A_DEV") if not b["insufficient_event_evidence"]]
        # permutation uses gated score key (OOF for D7 on evidence)
        obs = _eval_scores(fa_bl, H_key, "simple_net")["pairwise_mean"]
        nulls = []
        by_subj = defaultdict(list)
        for b in fa_bl:
            by_subj[b["name"]].append(b)
        for _ in range(N_PERM):
            for name, rows in by_subj.items():
                vals = [r[H_key] for r in rows]
                RNG.shuffle(vals)
                for r, v in zip(rows, vals):
                    r["_perm"] = v
            nulls.append(_eval_scores(fa_bl, "_perm", "simple_net")["pairwise_mean"] or 0.5)
        pct = sum(1 for x in nulls if x >= (obs or 0)) / len(nulls)
        perm_diag = {
            "observed_fresh_pairwise": obs,
            "null_mean": round(float(np.mean(nulls)), 4),
            "null_p95": round(float(np.percentile(nulls, 95)), 4),
            "frac_null_ge_obs": round(pct, 4),
            "n_perm": N_PERM,
        }

    # ── Amplitude (only if material ready) ──
    amplitude = {"ran": False}
    composition = {}
    status = "DNEW_MATERIAL_NOT_READY"
    gamma_sel = None
    H_z_params = None

    cfg = dict(arm_b.ARM_B_CONFIG)
    # precompute A layers for packs
    for pack in all_packs:
        pack["_layers"] = _decompose_layers(pack, cfg)

    if material_ready:
        print("── amplitude grid ──")
        hs = [b[H_score_key] for b in blocks]
        H_z_params = _robust_z_params(hs)
        for b in blocks:
            b["H_z"] = _apply_z(b[H_score_key], *H_z_params)

        # map name,pillar -> D_new per gamma
        amp_rows = {}
        for g in GAMMAS:
            for b in blocks:
                b[f"D_new_g{g}"] = BASE + g * b["H_z"]
            amp_rows[g] = {}
            for pool, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs), ("COMBINED_DEV", all_packs)):
                bl = pool_blocks(pool)
                dvals = [b[f"D_new_g{g}"] for b in bl]
                # within-subject range/sd
                ranges, sds, adj = [], [], []
                by_subj = defaultdict(list)
                for b in bl:
                    by_subj[b["name"]].append(b)
                for rows in by_subj.values():
                    rows = sorted(rows, key=lambda r: r["start_year"])
                    ds = [r[f"D_new_g{g}"] for r in rows]
                    if len(ds) >= 2:
                        ranges.append(max(ds) - min(ds))
                        sds.append(float(np.std(ds, ddof=1)))
                        for i in range(len(ds) - 1):
                            adj.append(abs(ds[i + 1] - ds[i]))
                # labeled cross ratios
                abs_d, ratios = [], []
                for pack in packs:
                    layers = pack["_layers"]
                    goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
                    bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
                    dmap = {(b["name"], b["daewoon_pillar"]): b[f"D_new_g{g}"] for b in bl if b["name"] == pack["name"]}
                    # rebuild local
                    local = {b["daewoon_pillar"]: b[f"D_new_g{g}"] for b in blocks if b["name"] == pack["name"]}
                    for ge in goods:
                        for be in bads:
                            Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
                            if Lg["pillar"] == Lb["pillar"]:
                                continue
                            dd = abs(local[Lg["pillar"]] - local[Lb["pillar"]])
                            da = abs(Lg["A"] - Lb["A"])
                            abs_d.append(dd)
                            if da > 1e-9:
                                ratios.append(dd / da)
                amp_rows[g][pool] = {
                    "D_dist": _dist(dvals),
                    "within_range": _dist(ranges),
                    "within_sd": _dist(sds),
                    "adjacent_jump": {**_dist(adj), "p90": _pct(adj, 90) if adj else None},
                    "cross_abs_D": _dist(abs_d),
                    "cross_absD_over_absA": _dist(ratios),
                    "block_ranking": _eval_scores(bl, f"D_new_g{g}", "simple_net"),
                }

            # composition S = D_new + A
            composition[g] = {}
            for pool, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs)):
                d_lookup = {(b["name"], b["daewoon_pillar"]): b[f"D_new_g{g}"] for b in blocks}
                score_maps = []
                for pack in packs:
                    layers = pack["_layers"]
                    smap = {}
                    for y, L in layers.items():
                        d_new = d_lookup[(pack["name"], L["pillar"])]
                        smap[y] = float(arm_b9.squash(d_new + ALPHA * L["A"]))
                    score_maps.append(smap)
                ann = _annual_metrics(packs, score_maps)
                attrib = _attrib_pairs(packs, [p["_layers"] for p in packs], d_lookup)
                # CONSTANT_D control
                const_maps = []
                for pack in packs:
                    layers = pack["_layers"]
                    # subject median of D_new
                    ds = [d_lookup[(pack["name"], p)] for p in pack["d_map"].keys() if (pack["name"], p) in d_lookup]
                    med = float(np.median(ds)) if ds else BASE
                    smap = {y: float(arm_b9.squash(med + ALPHA * L["A"])) for y, L in layers.items()}
                    const_maps.append(smap)
                const_ann = _annual_metrics(packs, const_maps)
                # REF D composition
                ref_maps = []
                for pack in packs:
                    layers = pack["_layers"]
                    smap = {y: float(arm_b9.squash(L["D"] + ALPHA * L["A"])) for y, L in layers.items()}
                    ref_maps.append(smap)
                ref_ann = _annual_metrics(packs, ref_maps)
                composition[g][pool] = {
                    "S_new": {k: v for k, v in ann.items() if k != "subjects"},
                    "CONSTANT_D_plus_A": {k: v for k, v in const_ann.items() if k != "subjects"},
                    "D_REF_plus_A": {k: v for k, v in ref_ann.items() if k != "subjects"},
                    "attribution": attrib,
                    "subjects_S_new": ann["subjects"],
                }

        amplitude = {"ran": True, "BASE": BASE, "gammas": amp_rows, "H_z_params": {
            "center": H_z_params[0], "scale": H_z_params[1],
        }}

        # Prefer structurally moderate amplitude: among gammas that beat CONSTANT on FA
        # and keep ratio_p50 < 3.5, choose lowest override then ratio closest to ~1.5–2.
        best = None
        for g in GAMMAS:
            fa = composition[g]["FRESH_A_DEV"]
            old = composition[g]["OLD_DEV"]
            fa_ratio = amp_rows[g]["FRESH_A_DEV"]["cross_absD_over_absA"].get("p50")
            ov = fa["attribution"]["D_OVERRIDE_rate"] or 1
            s_pw = fa["S_new"]["pairwise_mean"] or 0
            c_pw = fa["CONSTANT_D_plus_A"]["pairwise_mean"] or 0
            beats_const = s_pw >= c_pw + 0.01
            if not beats_const:
                continue
            if fa_ratio is None or fa_ratio >= 3.5:
                continue
            score = (
                -(ov or 1),
                -abs((fa_ratio or 2) - 1.75),
                s_pw,
                old["S_new"]["pairwise_mean"] or 0,
                -g,  # prefer smaller gamma when tied
            )
            if best is None or score > best[0]:
                best = (score, g)
        if best is None:
            # fallback: smallest gamma that beats constant
            for g in GAMMAS:
                fa = composition[g]["FRESH_A_DEV"]
                s_pw = fa["S_new"]["pairwise_mean"] or 0
                c_pw = fa["CONSTANT_D_plus_A"]["pairwise_mean"] or 0
                if s_pw >= c_pw + 0.01:
                    best = ((0,), g)
                    break
        gamma_sel = best[1] if best else None

        # decide amplitude readiness
        fa_final = composition[gamma_sel]["FRESH_A_DEV"]
        beats = (fa_final["S_new"]["pairwise_mean"] or 0) > (fa_final["CONSTANT_D_plus_A"]["pairwise_mean"] or 0) + 0.01
        ratio_p50 = amp_rows[gamma_sel]["FRESH_A_DEV"]["cross_absD_over_absA"].get("p50")
        amp_ok = beats and ratio_p50 is not None and ratio_p50 < 4.0
        # also require not worse than A-only (constant) by much on OLD
        old_final = composition[gamma_sel]["OLD_DEV"]
        old_ok = (old_final["S_new"]["pairwise_mean"] or 0) >= (old_final["CONSTANT_D_plus_A"]["pairwise_mean"] or 0) - 0.02

        if amp_ok and old_ok:
            status = "DNEW_CANDIDATE_READY_TO_FREEZE"
        elif material_ready and not amp_ok:
            status = "DNEW_AMPLITUDE_NOT_READY"
        else:
            status = "DNEW_BOTH_NOT_READY"
    else:
        # check if any candidate was close
        status = "DNEW_MATERIAL_NOT_READY"

    # case review after selection
    cases = {}
    if H_key:
        for name in CASE_NAMES:
            rows = [b for b in blocks if b["name"] == name and not b["insufficient_event_evidence"]]
            cases[name] = [
                {
                    "pillar": b["daewoon_pillar"],
                    "years": f"{b['start_year']}-{b['end_year']}",
                    "D_REF": b["D_REF"],
                    "H": round(b.get(H_score_key, b.get(H_key, 0)), 4),
                    "H_z": None if not material_ready else round(b.get("H_z", 0), 4),
                    "D_new": None if gamma_sel is None else round(b.get(f"D_new_g{gamma_sel}", 0), 4),
                    "simple_net": b["simple_net"],
                    "prim_z": {f: round(b["z_robust"][f], 3) for f in CORE_FAMS},
                    "good": [],
                    "bad": [],
                }
                for b in rows
            ]
        # attach events from pack
        pack_by = {p["name"]: p for p in all_packs}
        for name, rows in cases.items():
            pack = pack_by.get(name)
            if not pack:
                continue
            for row in rows:
                sy, ey = map(int, row["years"].split("-"))
                goods, bads = [], []
                for e in pack["n"]["good"]:
                    if not e.get("exclude") and sy <= int(e["year"]) < ey:
                        goods.append({"year": e["year"], "label": e.get("label")})
                for e in pack["n"]["bad"]:
                    if not e.get("exclude") and sy <= int(e["year"]) < ey:
                        bads.append({"year": e["year"], "label": e.get("label")})
                row["good"] = goods
                row["bad"] = bads

    # duplication matrix (static semantic)
    dup = [
        {"family": "fit / yongshin", "D_new": True, "G": True, "note": "same theme, different pillar timescale"},
        {"family": "unseong", "D_new": "unseong" in (d6_fams if H_key == "D6_MINIMAL" else CORE_FAMS), "G": True, "note": "duplicated theme risk"},
        {"family": "relations", "D_new": True, "G": True, "note": "duplicated theme risk"},
        {"family": "balance", "D_new": True, "G": True, "note": "duplicated theme"},
        {"family": "structural", "D_new": True, "G": True, "note": "duplicated theme"},
        {"family": "discord/hollow/ilju patterns", "D_new": False, "G": True, "note": "annual-only in G"},
    ]

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "D_NEW_MATERIAL_EXPERIMENT",
        "validation_b_scored": False,
        "pools": {
            "OLD_DEV_n": len(old_packs),
            "FRESH_A_DEV_n": len(fresh_packs),
            "OLD_DEV_names": [p["name"] for p in old_packs],
            "FRESH_A_DEV_names": [p["name"] for p in fresh_packs],
        },
        "normalization": {
            "primary": "robust_z median/MAD",
            "sensitivity": "mean/sd via D2_CORE_meanz",
            "robust_params": {f: {"center": robust_params[f][0], "scale": robust_params[f][1]} for f in ALL_FAMS},
        },
        "feature_direction": {
            f: {
                "class": direction[f]["class"],
                "activation_rate": direction[f]["activation_rate"],
                "OLD_DEV_pw": direction[f]["OLD_DEV"]["simple_net"]["pairwise_mean"],
                "FRESH_A_pw": direction[f]["FRESH_A_DEV"]["simple_net"]["pairwise_mean"],
                "COMBINED_pw": direction[f]["COMBINED_DEV"]["simple_net"]["pairwise_mean"],
                "detail": direction[f],
            }
            for f in ALL_FAMS
        },
        "d6_families": d6_fams,
        "candidates": {
            k: {
                pool: {
                    t: cand_eval[k][pool][t]
                    for t in ("simple_net", "normalized_balance", "high_confidence_balance")
                }
                for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV")
            }
            for k in cand_eval
        },
        "d7": d7,
        "material_gate": {
            "combined_min": GATE_COMBINED_MIN,
            "fresh_min": GATE_FRESH_MIN,
            "old_floor": GATE_OLD_FLOOR,
            "gated": [{"key": k, **info} for k, info in gated],
            "gated": [{"key": k, **info} for k, info in gated],
            "selected_H": H_key,
            "H_score_key_for_amplitude": H_score_key if material_ready else None,
            "material_ready": material_ready,
            "d7_numeric_gate_but_cleanliness": d7_gate_note,
        },
        "permutation_null_fresh": perm_diag,
        "amplitude": amplitude,
        "composition": composition,
        "selected_gamma": gamma_sel,
        "cases": cases,
        "duplication_vs_G": dup,
        "status": status,
        "ref_vs_raw_bias_check": {
            "D_REF": cand_eval["D_REF_score"]["COMBINED_DEV"]["simple_net"],
            "H_REF_RAW": cand_eval["H_REF_RAW_score"]["COMBINED_DEV"]["simple_net"],
            "note": "SCORE_BIAS should barely change within-subject ranking",
        },
    }

    # compact block table for snapshot (evidence only)
    payload["block_table_evidence"] = [
        {
            "pool": b["pool"], "name": b["name"], "pillar": b["daewoon_pillar"],
            "D_REF": b["D_REF"], "H_REF_RAW": b["H_REF_RAW"],
            "simple_net": b["simple_net"],
            "prim": {f: b["prim"][f] for f in ALL_FAMS},
            "z_robust": {f: round(b["z_robust"][f], 4) for f in list(ALL_FAMS) + ["auxiliary"]},
            **({H_key: round(b[H_key], 4)} if H_key else {}),
        }
        for b in blocks if not b["insufficient_event_evidence"]
    ]

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    report = _write_report(payload)
    open(OUT_REPORT, "w", encoding="utf-8").write(report)

    print("\n══════════ STATUS ══════════")
    print(status)
    print(f"H={H_key} gamma={gamma_sel}")
    print(f"snapshot → {OUT_SNAP}")
    print(f"report → {OUT_REPORT}")
    return 0


def _write_report(p: dict) -> str:
    L: List[str] = []
    L.append("# D_NEW Material Experiment Report")
    L.append("")
    L.append(f"**Status:** `{p['status']}`")
    L.append(f"**Measured at:** {p['measured_at']}")
    L.append("")
    L.append("Validation B sealed. G/α/κ/β/centering frozen. Engine untouched.")
    L.append("")
    L.append(f"Pools: OLD_DEV={p['pools']['OLD_DEV_n']} FRESH_A_DEV={p['pools']['FRESH_A_DEV_n']}")
    L.append("")

    L.append("## Feature direction audit (robust-z primitive vs simple_net)")
    L.append("")
    L.append("| family | class | OLD pw | FA pw | COMB pw | act |")
    L.append("|---|---|---:|---:|---:|---:|")
    fd = p["feature_direction"]
    for f in ALL_FAMS:
        r = fd[f]
        L.append(
            f"| {f} | {r['class']} | {r['OLD_DEV_pw']} | {r['FRESH_A_pw']} | "
            f"{r['COMBINED_pw']} | {r['activation_rate']} |"
        )
    L.append("")
    L.append(f"D6_MINIMAL families (aggregate): `{p['d6_families']}`")
    L.append("")

    L.append("## SCORE_BIAS ranking check")
    L.append("")
    L.append(f"- D_REF COMBINED: {p['ref_vs_raw_bias_check']['D_REF']}")
    L.append(f"- H_REF_RAW COMBINED: {p['ref_vs_raw_bias_check']['H_REF_RAW']}")
    L.append("")

    L.append("## Deterministic + D7 candidates (simple_net)")
    L.append("")
    L.append("| candidate | OLD pw | FA pw | COMB pw | FA n_subj |")
    L.append("|---|---:|---:|---:|---:|")
    for key, ev in p["candidates"].items():
        L.append(
            f"| {key} | {ev['OLD_DEV']['simple_net']['pairwise_mean']} | "
            f"{ev['FRESH_A_DEV']['simple_net']['pairwise_mean']} | "
            f"{ev['COMBINED_DEV']['simple_net']['pairwise_mean']} | "
            f"{ev['FRESH_A_DEV']['simple_net']['n_subjects']} |"
        )
    L.append("")

    if p.get("d7", {}).get("best_alpha_reg") is not None:
        L.append("### D7 ridge LOSO")
        L.append("")
        L.append(f"- best α_reg: {p['d7']['best_alpha_reg']}")
        br = str(p["d7"]["best_alpha_reg"])
        info = p["d7"]["cv_by_reg"][br]
        L.append(f"- coef mean: {info['coef_mean']} (features {p['d7']['features']})")
        L.append(f"- coef std: {info['coef_std']}")
        L.append(f"- sign stable: {info['sign_stable']}")
        L.append("")

    mg = p["material_gate"]
    L.append("## Material gate")
    L.append("")
    L.append(f"- thresholds: COMB≥{mg['combined_min']} FA≥{mg['fresh_min']} OLD≥{mg['old_floor']}")
    L.append(f"- gated: {mg['gated']}")
    L.append(f"- selected H: `{mg['selected_H']}`")
    L.append(f"- D7 numeric-gate note: {mg.get('d7_numeric_gate_but_cleanliness')}")
    L.append(f"- permutation null (Fresh A): {p.get('permutation_null_fresh')}")
    L.append("")
    L.append(
        "Note: D7 OOF can look strong on Fresh A while learning **negative** weights on "
        "`unseong`/`relations`/`balance` (THEORY_DATA_CONFLICT / near-chance families). "
        "That fails the cleanliness gate and is **not** freeze-eligible under the D_NEW semantic contract."
    )
    L.append("")

    if p["amplitude"].get("ran"):
        L.append("## Amplitude grid")
        L.append("")
        L.append(f"BASE={BASE}; selected gamma=`{p['selected_gamma']}`")
        L.append("")
        for g in GAMMAS:
            fa = p["amplitude"]["gammas"][g]["FRESH_A_DEV"]
            L.append(
                f"- γ={g}: FA |ΔD|/|ΔA| p50={fa['cross_absD_over_absA'].get('p50')} "
                f"adjJump p50={fa['adjacent_jump'].get('p50')} "
                f"D sd={fa['D_dist'].get('sd')}"
            )
        L.append("")
        L.append("## Composition S = D_new + A (DEVELOPMENT)")
        L.append("")
        for g in GAMMAS:
            L.append(f"### γ={g}")
            for pool in ("FRESH_A_DEV", "OLD_DEV"):
                c = p["composition"][g][pool]
                L.append(
                    f"- {pool}: S_new pw={c['S_new']['pairwise_mean']} hit={c['S_new']['hit']} | "
                    f"CONSTANT pw={c['CONSTANT_D_plus_A']['pairwise_mean']} | "
                    f"D_REF pw={c['D_REF_plus_A']['pairwise_mean']} | "
                    f"override={c['attribution']['D_OVERRIDE_rate']} rescue={c['attribution']['D_RESCUE_rate']}"
                )
            L.append("")

    if p.get("cases"):
        L.append("## Case boards (post-selection only)")
        L.append("")
        for name, rows in p["cases"].items():
            L.append(f"### {name}")
            for r in rows:
                L.append(
                    f"- {r['pillar']} {r['years']}: D_REF={r['D_REF']} H={r['H']} "
                    f"D_new={r['D_new']} net={r['simple_net']} z={r['prim_z']}"
                )
                L.append(f"  - good={r['good']} bad={r['bad']}")
            L.append("")

    L.append("## Explicit answers")
    L.append("")
    fd = p["feature_direction"]
    old_sup = [f for f in ALL_FAMS if (fd[f]["OLD_DEV_pw"] or 0) > 0.55]
    fa_sup = [f for f in ALL_FAMS if (fd[f]["FRESH_A_pw"] or 0) > 0.55]
    both_harm = [f for f in ALL_FAMS if fd[f]["class"] in ("HARMFUL", "THEORY_DATA_CONFLICT")]
    L.append(f"1. Useful on OLD_DEV (pw>0.55): {old_sup or 'none clear'}")
    L.append(f"2. Useful on Fresh A (pw>0.55): {fa_sup or 'none clear'}")
    L.append(f"3. Harmful/unstable/conflict on audit: {both_harm}; classes={[ (f, fd[f]['class']) for f in ALL_FAMS ]}")
    L.append(f"4. yongshin_fit dominant role deserved? class={fd['fit']['class']} FA={fd['fit']['FRESH_A_pw']} COMB={fd['fit']['COMBINED_pw']} → likely **no** as sole driver.")
    L.append(f"5. unseong independent? FA={fd['unseong']['FRESH_A_pw']} COMB={fd['unseong']['COMBINED_pw']} class={fd['unseong']['class']}")
    L.append(f"6. relations independent? FA={fd['relations']['FRESH_A_pw']} COMB={fd['relations']['COMBINED_pw']} class={fd['relations']['class']}")
    d2 = p["candidates"]["D2_CORE"]["COMBINED_DEV"]["simple_net"]["pairwise_mean"]
    dref = p["candidates"]["D_REF_score"]["COMBINED_DEV"]["simple_net"]["pairwise_mean"]
    L.append(f"7. D2_CORE vs D_REF COMBINED: {d2} vs {dref}")
    L.append(f"8. D3_NO_YFIT FA/COMB: {p['candidates']['D3_NO_YFIT']['FRESH_A_DEV']['simple_net']['pairwise_mean']} / {p['candidates']['D3_NO_YFIT']['COMBINED_DEV']['simple_net']['pairwise_mean']}")
    L.append(f"9. D4_NO_UNSEONG: {p['candidates']['D4_NO_UNSEONG']['FRESH_A_DEV']['simple_net']['pairwise_mean']} / {p['candidates']['D4_NO_UNSEONG']['COMBINED_DEV']['simple_net']['pairwise_mean']}")
    L.append(f"10. D5_NO_RELATIONS: {p['candidates']['D5_NO_RELATIONS']['FRESH_A_DEV']['simple_net']['pairwise_mean']} / {p['candidates']['D5_NO_RELATIONS']['COMBINED_DEV']['simple_net']['pairwise_mean']}")
    aux_notes = []
    for a in AUX_FAMS:
        k = f"D2_PLUS_{a.upper()}"
        if k in p["candidates"]:
            fa = p["candidates"][k]["FRESH_A_DEV"]["simple_net"]["pairwise_mean"]
            old = p["candidates"][k]["OLD_DEV"]["simple_net"]["pairwise_mean"]
            base_fa = p["candidates"]["D2_CORE"]["FRESH_A_DEV"]["simple_net"]["pairwise_mean"]
            flag = ""
            if (old or 0) > (p["candidates"]["D2_CORE"]["OLD_DEV"]["simple_net"]["pairwise_mean"] or 0) + 0.02 and (fa or 0) < (base_fa or 0) - 0.02:
                flag = " legacy_overfit_risk"
            aux_notes.append(f"{a}: FA={fa} OLD={old}{flag}")
    L.append(f"11. Aux add-ons: {aux_notes}")
    if "D7_CONSTRAINED" in p["candidates"]:
        L.append(
            f"12. D7 OOF vs D2: FA {p['candidates']['D7_CONSTRAINED']['FRESH_A_DEV']['simple_net']['pairwise_mean']} "
            f"vs {p['candidates']['D2_CORE']['FRESH_A_DEV']['simple_net']['pairwise_mean']}"
        )
        br = str(p["d7"].get("best_alpha_reg"))
        L.append(f"13. D7 coef stability: {p['d7']['cv_by_reg'].get(br, {}).get('sign_stable')}")
    else:
        L.append("12–13. D7 unavailable or not gated.")
    L.append(f"14. Selected H: `{mg['selected_H']}`")
    if mg["selected_H"]:
        L.append(f"15. H on Fresh A: {p['candidates'][mg['selected_H']]['FRESH_A_DEV']['simple_net']['pairwise_mean']}")
        L.append(f"16. H on Combined: {p['candidates'][mg['selected_H']]['COMBINED_DEV']['simple_net']['pairwise_mean']}")
    else:
        L.append("15–16. No H passed material gate.")
    L.append(f"17. Selected gamma: {p.get('selected_gamma')}")
    if p.get("selected_gamma") is not None:
        g = p["selected_gamma"]
        L.append(f"18. D_new |ΔD|/|ΔA| p50 (FA): {p['amplitude']['gammas'][g]['FRESH_A_DEV']['cross_absD_over_absA'].get('p50')}")
        L.append(f"19. D_OVERRIDE rate (FA): {p['composition'][g]['FRESH_A_DEV']['attribution']['D_OVERRIDE_rate']}")
        s = p["composition"][g]["FRESH_A_DEV"]["S_new"]["pairwise_mean"]
        c = p["composition"][g]["FRESH_A_DEV"]["CONSTANT_D_plus_A"]["pairwise_mean"]
        L.append(f"20. D_new+A vs CONSTANT+A (FA): {s} vs {c}")
        L.append(f"21. Subject distribution: see composition subject rows / pairwise p25–p75 in candidates.")
    else:
        L.append("18–21. Amplitude not completed or not justified.")
    L.append("22. Candidate depends on named cases? **No** — selection used aggregate gates only; cases are post-hoc.")
    L.append(f"23. Ready to freeze? **{'yes' if p['status']=='DNEW_CANDIDATE_READY_TO_FREEZE' else 'no'}** (`{p['status']}`)")
    L.append("24. Unproven until Validation B: external generalization of H ranking + chosen gamma under sealed lives.")
    L.append("")
    L.append("## Final status")
    L.append("")
    L.append(f"`{p['status']}`")
    L.append("")
    L.append("Do **not** score Validation B in this run.")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
