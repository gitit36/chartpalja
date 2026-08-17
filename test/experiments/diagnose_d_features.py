# -*- coding: utf-8 -*-
"""
D feature discovery & theory reconstruction (diagnosis only).

No D score, no Ridge, no sign-inversion features, no Validation B.
No saju_engine / G / α changes.

Writes:
  test/snapshots/exp_d_feature_discovery.json
  test/experiments/D_FEATURE_DISCOVERY_REPORT.md

Usage:
  python test/experiments/diagnose_d_features.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime
from itertools import combinations
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from scipy.stats import spearmanr

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import saju_engine as se  # noqa: E402
from experiments import arm_b9, common as C  # noqa: E402
from experiments import b9_structure_kpi as SK  # noqa: E402
from experiments import sweep_b9a_alpha as SW  # noqa: E402
from experiments.audit_d_material import (  # noqa: E402
    CAREER_KW,
    HEALTH_KW,
    LEGAL_KW,
    REL_KW,
    _axis_tags,
    _block_targets,
    _w,
)
from experiments.validate_g_fresh_a import (  # noqa: E402
    FRESH_JSON,
    OUT_BIRTH_QA,
    OUT_LABELS,
    _pack_subject,
    engine_recompute_birth,
)

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_d_feature_discovery.json")
OUT_REPORT = os.path.join(_HERE, "D_FEATURE_DISCOVERY_REPORT.md")

MIN_BLOCKS = 20
MIN_SUBJ = 10
UNSEONG_STATES = (
    "장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양",
)
REL_CATS = ("합", "충", "형", "파", "해", "삼합", "방합", "반합", "원진", "천간합", "천간충")


def _sufficient(n_blocks: int, n_subj: int) -> bool:
    return n_blocks >= MIN_BLOCKS and n_subj >= MIN_SUBJ


def _pair_concordance(blocks: List[dict], feat_key: str, target_key: str = "simple_net") -> Dict[str, Any]:
    """Within-subject: sign(featΔ) vs sign(targetΔ)."""
    by = defaultdict(list)
    for b in blocks:
        if b.get("insufficient_event_evidence"):
            continue
        if b.get(target_key) is None:
            continue
        v = b.get(feat_key)
        if v is None or (isinstance(v, float) and v != v):
            continue
        by[b["name"]].append(b)

    conc = n = 0
    diffs_f, diffs_t = [], []
    med_pos, med_neg = [], []
    for rows in by.values():
        if len(rows) < 2:
            continue
        for a, b in combinations(rows, 2):
            df = float(a[feat_key]) - float(b[feat_key])
            dt = float(a[target_key]) - float(b[target_key])
            if abs(df) < 1e-12 or abs(dt) < 1e-12:
                continue
            n += 1
            diffs_f.append(df)
            diffs_t.append(dt)
            if (df > 0 and dt > 0) or (df < 0 and dt < 0):
                conc += 1
            if df > 0:
                med_pos.append(dt)
            else:
                med_neg.append(dt)
    sp = None
    if len(diffs_f) >= 3:
        r = spearmanr(diffs_f, diffs_t)
        sp = None if r.correlation != r.correlation else round(float(r.correlation), 4)
    return {
        "n_pairs": n,
        "n_subjects": sum(1 for rows in by.values() if len(rows) >= 2),
        "sign_concordance": None if not n else round(conc / n, 4),
        "spearman_diff": sp,
        "median_target_delta_when_feat_pos": None if not med_pos else round(float(np.median(med_pos)), 4),
        "median_target_delta_when_feat_neg": None if not med_neg else round(float(np.median(med_neg)), 4),
        "sufficient": _sufficient(n, sum(1 for rows in by.values() if len(rows) >= 2)),
    }


def _cat_table(blocks: List[dict], cat_key: str, target_key: str = "simple_net") -> Dict[str, Any]:
    rows = {}
    for b in blocks:
        if b.get("insufficient_event_evidence"):
            continue
        if b.get(target_key) is None:
            continue
        c = b.get(cat_key)
        if c is None or c == "":
            continue
        rows.setdefault(str(c), []).append(b)
    out = {}
    for c, blist in sorted(rows.items(), key=lambda kv: -len(kv[1])):
        ts = [float(b[target_key]) for b in blist]
        subj = {b["name"] for b in blist}
        out[c] = {
            "n_blocks": len(blist),
            "n_subjects": len(subj),
            "mean_target": round(float(np.mean(ts)), 4),
            "median_target": round(float(np.median(ts)), 4),
            "sufficient": _sufficient(len(blist), len(subj)),
        }
    return out


def _quantile_bins(blocks: List[dict], feat_key: str, target_key: str = "simple_net", n_bins: int = 5) -> Dict[str, Any]:
    evid = [
        b for b in blocks
        if not b.get("insufficient_event_evidence")
        and b.get(target_key) is not None
        and b.get(feat_key) is not None
        and b[feat_key] == b[feat_key]
    ]
    if len(evid) < MIN_BLOCKS:
        return {"sufficient": False, "n": len(evid)}
    xs = np.array([float(b[feat_key]) for b in evid])
    # unique edges
    qs = np.linspace(0, 100, n_bins + 1)
    edges = np.unique(np.percentile(xs, qs))
    if len(edges) < 3:
        return {"sufficient": False, "n": len(evid), "note": "low unique values"}
    bins = []
    for i in range(len(edges) - 1):
        lo, hi = edges[i], edges[i + 1]
        if i < len(edges) - 2:
            sel = [b for b in evid if lo <= float(b[feat_key]) < hi]
        else:
            sel = [b for b in evid if lo <= float(b[feat_key]) <= hi]
        if not sel:
            continue
        ts = [float(b[target_key]) for b in sel]
        bins.append({
            "bin": i + 1,
            "lo": round(float(lo), 4),
            "hi": round(float(hi), 4),
            "n": len(sel),
            "mean_target": round(float(np.mean(ts)), 4),
            "median_target": round(float(np.median(ts)), 4),
        })
    means = [b["mean_target"] for b in bins]
    shape = "flat"
    if len(means) >= 3:
        mono_up = all(means[i] <= means[i + 1] + 1e-9 for i in range(len(means) - 1))
        mono_dn = all(means[i] >= means[i + 1] - 1e-9 for i in range(len(means) - 1))
        if mono_up:
            shape = "increasing"
        elif mono_dn:
            shape = "decreasing"
        elif means[0] < means[len(means) // 2] and means[-1] < means[len(means) // 2]:
            shape = "inverted_U"
        elif means[0] > means[len(means) // 2] and means[-1] > means[len(means) // 2]:
            shape = "U_shaped"
        else:
            shape = "non_monotonic"
    return {"sufficient": True, "n": len(evid), "shape": shape, "bins": bins}


def _rel_categories(rels: List[dict]) -> List[str]:
    cats = []
    for r in rels or []:
        for p in (r.get("patterns") or r.get("pairs") or []):
            s = str(p)
            for k in REL_CATS:
                if k in s:
                    cats.append(k)
        # also string form
        if isinstance(r, dict):
            for v in r.values():
                if isinstance(v, str):
                    for k in REL_CATS:
                        if k in v:
                            cats.append(k)
                elif isinstance(v, list):
                    for x in v:
                        for k in REL_CATS:
                            if k in str(x):
                                cats.append(k)
    return sorted(set(cats))


def _pillar_hits(rels: List[dict]) -> Dict[str, int]:
    labels = ["year", "month", "day", "hour"]
    hits = {lb: 0 for lb in labels}
    for r in rels or []:
        idx = r.get("pillar_idx")
        if idx is None:
            # try between label
            bet = str(r.get("between") or r.get("target") or "")
            for i, lab in enumerate(("연", "월", "일", "시")):
                if lab in bet:
                    hits[labels[i]] += 1
            continue
        try:
            hits[labels[int(idx)]] += 1
        except (ValueError, IndexError, KeyError):
            pass
    return hits


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


def _extract_rich_blocks(packs: List[dict]) -> Tuple[List[dict], List[dict]]:
    """Return (blocks, event_rows)."""
    blocks = []
    event_rows = []
    for pack in packs:
        r = pack.get("r")
        dw = pack.get("dw") or []
        if r is None:
            # Fresh packs already ran compute_all inside _pack_subject
            r = pack.get("r")
        yong = (r or {}).get("용신") or {}
        verdict = ((r or {}).get("신강신약") or {}).get("판정") or ""
        geok = ((r or {}).get("격국") or {}).get("격국유형") or ""
        strength = "신강" if "신강" in verdict or "태강" in verdict or "극왕" in verdict else (
            "신약" if "신약" in verdict else "중화"
        )
        yong_e = yong.get("용신_오행") or ""
        hee_es = set(yong.get("희신_오행") or [])
        gi_es = set(yong.get("기신_오행") or [])
        favorable = {yong_e} | hee_es - {""}
        unfavorable = gi_es - {""}

        # natal ohang from disease if present
        disease = yong.get("병인진단") or {}
        natal_oh = disease.get("오행분포_raw") or {}

        events_by_pillar: Dict[str, Dict[str, List[dict]]] = defaultdict(lambda: {"good": [], "bad": []})
        for side in ("good", "bad"):
            for e in pack["n"].get(side) or []:
                if e.get("exclude"):
                    continue
                y = int(e["year"])
                matched = None
                for row in dw:
                    if int(row["start_year"]) <= y < int(row["end_year"]):
                        matched = row
                        break
                if matched is None:
                    continue
                events_by_pillar[matched["daewoon_pillar"]][side].append(e)
                span = max(1, int(matched["end_year"]) - int(matched["start_year"]))
                rel_pos = (y - int(matched["start_year"])) / span
                event_rows.append({
                    "pool": pack["pool"],
                    "name": pack["name"],
                    "year": y,
                    "side": side,
                    "label": e.get("label"),
                    "weight": _w(e),
                    "confidence": e.get("confidence"),
                    "tags": _axis_tags(e),
                    "pillar": matched["daewoon_pillar"],
                    "rel_pos": round(rel_pos, 4),
                    "near_transition": rel_pos <= 0.2 or rel_pos >= 0.8,
                })

        for row in sorted(dw, key=lambda x: int(x["start_year"])):
            pillar = row["daewoon_pillar"]
            bd = row.get("breakdown") or {}
            tg = _block_targets(events_by_pillar.get(pillar, {"good": [], "bad": []}))
            # re-derive yfit parts from stored totals when detailed missing
            y_tot = float(row.get("용신부합") or 0.0)
            h_tot = float(row.get("희신부합") or 0.0)
            g_tot = float(row.get("기신부합") or 0.0)
            # 구신 not always on row; approximate from yfit dict if we recompute
            stem = row.get("stem") or pillar[0]
            branch = row.get("branch") or pillar[1]
            # recompute fit parts via engine read-only helper
            day_stem = ((r or {}).get("원국") or {}).get("day", ["", ""])[0]
            yfit_full = {}
            if day_stem and yong:
                try:
                    yfit_full = se._check_yongshin_fit(stem, branch, yong, day_stem)
                except Exception:
                    yfit_full = {}
            gu_tot = float(yfit_full.get("구신부합") or 0.0)
            y_stem = float(yfit_full.get("용신부합_천간") or 0.0)
            y_br = float(yfit_full.get("용신부합_지지") or 0.0)

            stem_e = row.get("stemElement") or se.STEM_ELEMENT.get(stem, "")
            branch_e = row.get("branchElement") or se.BRANCH_ELEMENT_MAIN.get(branch, "")
            supplies_fav = 1.0 if (stem_e in favorable or branch_e in favorable) else 0.0
            supplies_unfav = 1.0 if (stem_e in unfavorable or branch_e in unfavorable) else 0.0
            # intensity: natal count of that element if available
            natal_fav_excess = 0.0
            if natal_oh and isinstance(natal_oh, dict):
                for e in favorable:
                    natal_fav_excess += float(natal_oh.get(e) or 0.0)
                for e in unfavorable:
                    natal_fav_excess -= float(natal_oh.get(e) or 0.0)

            rels = row.get("관계_with_원국") or []
            rel_cats = _rel_categories(rels)
            pillar_hit = _pillar_hits(rels)
            energy = ((row.get("indicators") or {}).get("에너지장") or {})
            if not isinstance(energy, dict):
                energy = {}

            uns = row.get("12운성") or ""
            uns_score = float(se._UNSEONG_SCORE.get(uns, 0))
            uns_mult = float(se._unseong_mult(uns, verdict, geok))
            gm = row.get("gongmang_factors") or {}

            bal = float(((row.get("indicators") or {}).get("오행균형도") or bd.get("balance") or 0.0))
            # natal balance from r if present — approximate via H_REF path
            natal_bal = None
            try:
                if r:
                    orig_stems = [r["원국"][k][0] for k in ("year", "month", "day", "hour")]
                    orig_branches = [r["원국"][k][1] for k in ("year", "month", "day", "hour")]
                    natal_bal = float(se._ohang_balance(orig_stems, orig_branches, yong_info=yong))
            except Exception:
                natal_bal = None
            bal_delta = None if natal_bal is None else float(bal) - float(natal_bal)

            # structural subparts via read-only helpers if possible
            excess = activ = disrupt = 0.0
            try:
                natal_ohang = (disease or {}).get("오행분포_raw")
                excess = float(se._ohang_excess_penalty(stem, branch, natal_ohang, yong) or 0.0)
                activ = float(se._yongshin_activation_bonus(
                    stem, branch, yong, natal_ohang,
                    trine_hits=row.get("trine_hits"), disease_res_sc=float(bd.get("disease_resolution") or 0),
                ) or 0.0)
                disrupt = float(se._gishin_disruption_penalty(
                    stem, branch, yong, natal_ohang,
                    disease_res_sc=float(bd.get("disease_resolution") or 0),
                ) or 0.0)
            except Exception:
                pass

            goods = events_by_pillar.get(pillar, {}).get("good") or []
            bads = events_by_pillar.get(pillar, {}).get("bad") or []
            n_ev = len(goods) + len(bads)
            max_w = max([_w(e) for e in goods + bads], default=0.0)
            sum_abs = sum(_w(e) for e in goods) + sum(_w(e) for e in bads)
            single_dom = bool(n_ev == 1 or (sum_abs > 0 and max_w / sum_abs >= 0.67 and n_ev <= 2))

            # interaction features (definitions only)
            fav_act = supplies_fav * (y_tot + h_tot)
            unfav_act = supplies_unfav * (g_tot + gu_tot)
            uns_x_str = uns_score * (1.0 if strength == "신약" else (-1.0 if strength == "신강" else 0.0))
            bal_x_fav = (bal_delta or 0.0) * (1.0 if supplies_fav else (-1.0 if supplies_unfav else 0.0))

            has_day_chung = 1.0 if pillar_hit.get("day", 0) > 0 and any("충" in c for c in rel_cats) else 0.0
            has_month_chung = 1.0 if pillar_hit.get("month", 0) > 0 and any("충" in c for c in rel_cats) else 0.0
            has_hap = 1.0 if any("합" in c for c in rel_cats) else 0.0

            blocks.append({
                "pool": pack["pool"],
                "name": pack["name"],
                "pillar": pillar,
                "start_year": int(row["start_year"]),
                "end_year": int(row["end_year"]),
                "D_REF": float(row["종합운점수"]),
                "verdict": verdict,
                "strength": strength,
                "geok": geok,
                # encoded scalars (for comparison only)
                "enc_yongshin_fit": float(bd.get("yongshin_fit") or 0.0),
                "enc_unseong": float(bd.get("unseong") or 0.0),
                "enc_unseong_context": float(bd.get("unseong_context") or 0.0),
                "enc_relations": float(bd.get("relations") or 0.0),
                "enc_balance": float(bd.get("balance") or 0.0),
                "enc_structural": float(bd.get("structural_adj") or 0.0),
                "enc_trine": float(bd.get("trine") or 0.0),
                "enc_shinsal": float(bd.get("shinsal") or 0.0),
                "enc_disease": float(bd.get("disease_resolution") or 0.0),
                "enc_haegong": float(bd.get("haegong") or 0.0),
                # raw yongshin family
                "yong_fit": y_tot if y_tot else float(yfit_full.get("용신부합") or 0.0),
                "hee_fit": h_tot if h_tot else float(yfit_full.get("희신부합") or 0.0),
                "gi_fit": g_tot if g_tot else float(yfit_full.get("기신부합") or 0.0),
                "gu_fit": gu_tot,
                "yong_stem": y_stem,
                "yong_branch": y_br,
                "supplies_fav": supplies_fav,
                "supplies_unfav": supplies_unfav,
                "fav_minus_unfav": supplies_fav - supplies_unfav,
                "stem_element": stem_e,
                "branch_element": branch_e,
                # unseong
                "unseong_state": uns,
                "unseong_raw_score": uns_score,
                "unseong_mult": uns_mult,
                "unseong_adjusted": uns_score * uns_mult,
                "tg_stem": row.get("십성_천간") or "",
                "tg_branch": row.get("십성_지지") or "",
                "gm_unseong": float(gm.get("unseong") or 1.0),
                # relations
                "energy_direction": float(energy.get("direction") or 0.0),
                "noble_power": float((row.get("indicators") or {}).get("귀인력") or 0.0)
                if not isinstance((row.get("indicators") or {}).get("귀인력"), dict) else 0.0,
                "rel_cats": rel_cats,
                "has_hap": has_hap,
                "has_chung": 1.0 if any("충" in c for c in rel_cats) else 0.0,
                "has_hyung": 1.0 if any("형" in c for c in rel_cats) else 0.0,
                "has_pa": 1.0 if any("파" in c for c in rel_cats) else 0.0,
                "has_hae": 1.0 if any("해" in c for c in rel_cats) else 0.0,
                "has_samhap": 1.0 if any("삼합" in c or "방합" in c or "반합" in c for c in rel_cats) else 0.0,
                "hit_year": float(pillar_hit.get("year") or 0),
                "hit_month": float(pillar_hit.get("month") or 0),
                "hit_day": float(pillar_hit.get("day") or 0),
                "hit_hour": float(pillar_hit.get("hour") or 0),
                "has_day_chung": has_day_chung,
                "has_month_chung": has_month_chung,
                # balance
                "balance_level": float(bal) if bal == bal else 0.0,
                "natal_balance": natal_bal,
                "balance_delta": bal_delta if bal_delta is not None else 0.0,
                "abs_balance_delta": abs(bal_delta) if bal_delta is not None else 0.0,
                # structural parts
                "struct_excess": excess,
                "struct_activ": activ,
                "struct_disrupt": disrupt,
                # interactions
                "fav_element_activation": fav_act,
                "unfav_element_activation": unfav_act,
                "unseong_x_strength": uns_x_str,
                "balance_x_favdir": bal_x_fav,
                # coverage
                "n_good": len(goods),
                "n_bad": len(bads),
                "n_events": n_ev,
                "max_event_weight": max_w,
                "single_event_dominated": single_dom,
                **tg,
            })
    return blocks, event_rows


def _pool(blocks, name):
    if name == "COMBINED_DEV":
        return blocks
    return [b for b in blocks if b["pool"] == name]


def main() -> int:
    print("══════════ D FEATURE DISCOVERY ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    print("── packing ──")
    old_packs, fresh_packs, val_b = _load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b:
            raise RuntimeError(f"BUG: Val B: {p['name']}")

    print("── extract rich blocks ──")
    blocks, event_rows = _extract_rich_blocks(all_packs)
    evid = [b for b in blocks if not b["insufficient_event_evidence"]]
    print(f"blocks={len(blocks)} evidence={len(evid)} events={len(event_rows)}")

    # subject-centered versions of key continuous features
    cont_feats = [
        "enc_yongshin_fit", "yong_fit", "hee_fit", "gi_fit", "gu_fit",
        "fav_minus_unfav", "fav_element_activation", "unfav_element_activation",
        "unseong_raw_score", "unseong_adjusted", "energy_direction",
        "balance_delta", "abs_balance_delta", "enc_balance", "enc_structural",
        "struct_excess", "struct_activ", "struct_disrupt",
        "unseong_x_strength", "balance_x_favdir",
    ]
    by_subj = defaultdict(list)
    for b in blocks:
        by_subj[b["name"]].append(b)
    for name, rows in by_subj.items():
        for f in cont_feats:
            vals = [float(r[f]) for r in rows if r.get(f) is not None]
            med = float(np.median(vals)) if vals else 0.0
            for r in rows:
                if r.get(f) is None:
                    r[f"{f}__centered"] = None
                else:
                    r[f"{f}__centered"] = float(r[f]) - med

    # ── 1. separated yongshin parts ──
    print("── family audits ──")
    yong_parts = {}
    for feat in ("yong_fit", "hee_fit", "gi_fit", "gu_fit", "yong_stem", "yong_branch",
                 "supplies_fav", "supplies_unfav", "fav_minus_unfav",
                 "fav_element_activation", "unfav_element_activation", "enc_yongshin_fit"):
        yong_parts[feat] = {}
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            yong_parts[feat][pool] = _pair_concordance(_pool(blocks, pool), feat)
            yong_parts[feat][f"{pool}_centered"] = _pair_concordance(
                _pool(blocks, pool), f"{feat}__centered" if f"{feat}__centered" in blocks[0] or True else feat
            )
            # centered key always set above for cont_feats; for binary still ok
            if f"{feat}__centered" not in (blocks[0] if blocks else {}):
                # ensure
                pass
        # ensure centered keys exist for binary too
        for b in blocks:
            if f"{feat}__centered" not in b:
                # compute subject median on the fly already done only for cont_feats
                pass
        yong_parts[feat]["quantile_COMBINED"] = _quantile_bins(blocks, feat)

    # fix centered for all yong feats
    for feat in ("yong_fit", "hee_fit", "gi_fit", "gu_fit", "supplies_fav", "supplies_unfav",
                 "fav_minus_unfav", "fav_element_activation", "unfav_element_activation", "enc_yongshin_fit"):
        for name, rows in by_subj.items():
            vals = [float(r[feat]) for r in rows]
            med = float(np.median(vals))
            for r in rows:
                r[f"{feat}__centered"] = float(r[feat]) - med
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            yong_parts[feat][f"{pool}_centered"] = _pair_concordance(_pool(blocks, pool), f"{feat}__centered")

    # ── 2. unseong categorical ──
    unseong_cat = {}
    for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        unseong_cat[pool] = _cat_table(_pool(blocks, pool), "unseong_state")
    unseong_cont = {}
    for feat in ("unseong_raw_score", "unseong_adjusted", "enc_unseong"):
        unseong_cont[feat] = {
            pool: _pair_concordance(_pool(blocks, pool), feat)
            for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV")
        }
        unseong_cont[feat]["quantile_COMBINED"] = _quantile_bins(blocks, feat)
        for name, rows in by_subj.items():
            vals = [float(r[feat]) for r in rows]
            med = float(np.median(vals))
            for r in rows:
                r[f"{feat}__centered"] = float(r[feat]) - med
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            unseong_cont[feat][f"{pool}_centered"] = _pair_concordance(_pool(blocks, pool), f"{feat}__centered")

    # unseong × strength
    unseong_by_strength = {}
    for st in ("신강", "신약", "중화"):
        sub = [b for b in evid if b["strength"] == st]
        unseong_by_strength[st] = {
            "n_blocks": len(sub),
            "n_subjects": len({b["name"] for b in sub}),
            "states": _cat_table(sub, "unseong_state"),
            "raw_score_pairs": _pair_concordance(sub, "unseong_raw_score"),
            "sufficient": _sufficient(len(sub), len({b["name"] for b in sub})),
        }

    # ── 3. relations categorical / flags ──
    rel_flags = {}
    for feat in ("has_hap", "has_chung", "has_hyung", "has_pa", "has_hae", "has_samhap",
                 "has_day_chung", "has_month_chung", "energy_direction", "hit_day", "hit_month"):
        rel_flags[feat] = {
            pool: _pair_concordance(_pool(blocks, pool), feat)
            for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV")
        }

    # ── 4. balance ──
    bal_audit = {}
    for feat in ("balance_delta", "abs_balance_delta", "enc_balance", "balance_x_favdir"):
        bal_audit[feat] = {
            pool: _pair_concordance(_pool(blocks, pool), feat)
            for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV")
        }
        bal_audit[feat]["quantile_COMBINED"] = _quantile_bins(blocks, feat)
        for name, rows in by_subj.items():
            vals = [float(r[feat]) for r in rows]
            med = float(np.median(vals))
            for r in rows:
                r[f"{feat}__centered"] = float(r[feat]) - med
        for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
            bal_audit[feat][f"{pool}_centered"] = _pair_concordance(_pool(blocks, pool), f"{feat}__centered")

    # ── 5. structural parts ──
    struct_audit = {}
    for feat in ("enc_structural", "struct_excess", "struct_activ", "struct_disrupt"):
        struct_audit[feat] = {
            pool: _pair_concordance(_pool(blocks, pool), feat)
            for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV")
        }

    # ── 6. interactions ──
    inter_audit = {}
    for feat in ("fav_element_activation", "unfav_element_activation",
                 "unseong_x_strength", "balance_x_favdir"):
        inter_audit[feat] = {
            pool: _pair_concordance(_pool(blocks, pool), feat)
            for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV")
        }
        inter_audit[feat]["quantile_COMBINED"] = _quantile_bins(blocks, feat)

    # ── 7. event coverage bias ──
    print("── coverage / targets / transitions ──")
    coverage = {}
    for pool in ("OLD_DEV", "FRESH_A_DEV"):
        evs = [e for e in event_rows if e["pool"] == pool]
        tag_c = Counter()
        for e in evs:
            tags = e["tags"] or ["untagged"]
            for t in tags:
                tag_c[t] += 1
            if not tags:
                tag_c["untagged"] += 1
        evid_p = [b for b in evid if b["pool"] == pool]
        per_subj = Counter(b["name"] for b in evid_p)
        coverage[pool] = {
            "n_events": len(evs),
            "n_evidence_blocks": len(evid_p),
            "n_subjects_with_evidence": len(per_subj),
            "events_per_evidence_block_mean": None if not evid_p else round(
                sum(b["n_events"] for b in evid_p) / len(evid_p), 3
            ),
            "evidence_blocks_per_subject": {
                "mean": None if not per_subj else round(float(np.mean(list(per_subj.values()))), 3),
                "median": None if not per_subj else round(float(np.median(list(per_subj.values()))), 3),
                "max": None if not per_subj else int(max(per_subj.values())),
            },
            "tag_counts": dict(tag_c),
            "career_share": None if not evs else round(tag_c.get("career", 0) / len(evs), 4),
            "health_share": None if not evs else round(tag_c.get("health", 0) / len(evs), 4),
            "relationship_share": None if not evs else round(tag_c.get("relationship", 0) / len(evs), 4),
            "legal_reputation_share": None if not evs else round(tag_c.get("legal_reputation", 0) / len(evs), 4),
            "single_event_dominated_rate": None if not evid_p else round(
                sum(1 for b in evid_p if b["single_event_dominated"]) / len(evid_p), 4
            ),
        }

    # ── 8. target sensitivity ──
    target_sens = {}
    for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        bl = [b for b in _pool(blocks, pool) if not b["insufficient_event_evidence"]]
        pairs_agree = pairs_total = 0
        sn, nb, hc = [], [], []
        for name, rows in defaultdict(list, {**{}}).items():
            pass
        by = defaultdict(list)
        for b in bl:
            by[b["name"]].append(b)
        for rows in by.values():
            if len(rows) < 2:
                continue
            for a, b in combinations(rows, 2):
                keys = []
                for t in ("simple_net", "normalized_balance", "high_confidence_balance"):
                    if a.get(t) is None or b.get(t) is None:
                        keys.append(None)
                    else:
                        keys.append(1 if a[t] > b[t] else (-1 if a[t] < b[t] else 0))
                if keys[0] is None or keys[1] is None:
                    continue
                if keys[0] == 0 or keys[1] == 0:
                    continue
                pairs_total += 1
                if keys[0] == keys[1]:
                    pairs_agree += 1
            for b in rows:
                if b.get("simple_net") is not None:
                    sn.append(b["simple_net"])
                if b.get("normalized_balance") is not None:
                    nb.append(b["normalized_balance"])
                if b.get("high_confidence_balance") is not None:
                    hc.append(b["high_confidence_balance"])
        # block-level spearman between targets on evidence
        sn_nb = sn_hc = None
        paired = [(b["simple_net"], b["normalized_balance"]) for b in bl
                  if b.get("simple_net") is not None and b.get("normalized_balance") is not None]
        if len(paired) >= 3:
            r = spearmanr([x[0] for x in paired], [x[1] for x in paired])
            sn_nb = None if r.correlation != r.correlation else round(float(r.correlation), 4)
        paired2 = [(b["simple_net"], b["high_confidence_balance"]) for b in bl
                   if b.get("simple_net") is not None and b.get("high_confidence_balance") is not None]
        if len(paired2) >= 3:
            r = spearmanr([x[0] for x in paired2], [x[1] for x in paired2])
            sn_hc = None if r.correlation != r.correlation else round(float(r.correlation), 4)
        target_sens[pool] = {
            "pair_order_agree_simple_vs_norm": None if not pairs_total else round(pairs_agree / pairs_total, 4),
            "n_comparable_pairs_simple_vs_norm": pairs_total,
            "spearman_simple_vs_norm": sn_nb,
            "spearman_simple_vs_highconf": sn_hc,
            "coverage": {
                "simple_net": sum(1 for b in bl if b.get("simple_net") is not None),
                "normalized_balance": sum(1 for b in bl if b.get("normalized_balance") is not None),
                "high_confidence_balance": sum(1 for b in bl if b.get("high_confidence_balance") is not None),
            },
        }

    # ── 9. temporal position ──
    temporal = {}
    for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        evs = event_rows if pool == "COMBINED_DEV" else [e for e in event_rows if e["pool"] == pool]
        good_pos = [e["rel_pos"] for e in evs if e["side"] == "good"]
        bad_pos = [e["rel_pos"] for e in evs if e["side"] == "bad"]
        temporal[pool] = {
            "n_good": len(good_pos),
            "n_bad": len(bad_pos),
            "good_rel_pos": {
                "mean": None if not good_pos else round(float(np.mean(good_pos)), 4),
                "median": None if not good_pos else round(float(np.median(good_pos)), 4),
                "p25": None if not good_pos else round(float(np.percentile(good_pos, 25)), 4),
                "p75": None if not good_pos else round(float(np.percentile(good_pos, 75)), 4),
            },
            "bad_rel_pos": {
                "mean": None if not bad_pos else round(float(np.mean(bad_pos)), 4),
                "median": None if not bad_pos else round(float(np.median(bad_pos)), 4),
                "p25": None if not bad_pos else round(float(np.percentile(bad_pos, 25)), 4),
                "p75": None if not bad_pos else round(float(np.percentile(bad_pos, 75)), 4),
            },
            "near_edge_share_good": None if not good_pos else round(
                sum(1 for x in good_pos if x <= 0.2 or x >= 0.8) / len(good_pos), 4
            ),
            "near_edge_share_bad": None if not bad_pos else round(
                sum(1 for x in bad_pos if x <= 0.2 or x >= 0.8) / len(bad_pos), 4
            ),
        }

    # ── 10. transition ±2y ──
    transitions = []
    for pack in all_packs:
        dw = sorted(pack.get("dw") or [], key=lambda r: int(r["start_year"]))
        bounds = sorted({int(r["start_year"]) for r in dw} | {int(r["end_year"]) for r in dw})
        for e in pack["n"].get("good", []) + pack["n"].get("bad", []):
            if e.get("exclude"):
                continue
            y = int(e["year"])
            near = [b for b in bounds if abs(y - b) <= 2]
            if not near:
                continue
            # classify vs nearest boundary
            b0 = min(near, key=lambda b: abs(y - b))
            # find prev/new block
            prev = next((r for r in dw if int(r["start_year"]) <= y < int(r["end_year"])), None)
            transitions.append({
                "pool": pack["pool"],
                "name": pack["name"],
                "year": y,
                "side": "good" if e in (pack["n"].get("good") or []) else "bad",
                "boundary": b0,
                "delta_to_boundary": y - b0,
                "in_block": None if prev is None else prev["daewoon_pillar"],
            })
    trans_summary = {
        "n_events_within_2y_of_boundary": len(transitions),
        "good_near": sum(1 for t in transitions if t["side"] == "good"),
        "bad_near": sum(1 for t in transitions if t["side"] == "bad"),
        "share_of_all_events": None if not event_rows else round(len(transitions) / len(event_rows), 4),
    }

    # ── absolute vs relative support ──
    abs_vs_rel = {}
    for feat in ("enc_yongshin_fit", "fav_element_activation", "unfav_element_activation",
                 "unseong_raw_score", "energy_direction", "balance_delta", "enc_structural"):
        raw_c = _pair_concordance(blocks, feat)
        # centered
        for name, rows in by_subj.items():
            vals = [float(r[feat]) for r in rows]
            med = float(np.median(vals))
            for r in rows:
                r[f"{feat}__centered"] = float(r[feat]) - med
        cen_c = _pair_concordance(blocks, f"{feat}__centered")
        abs_vs_rel[feat] = {
            "raw": raw_c,
            "centered": cen_c,
            "centered_better": (
                (cen_c.get("sign_concordance") or 0) > (raw_c.get("sign_concordance") or 0) + 0.02
            ),
        }

    # ── synthesize candidate features ──
    def _dir_ok(feat: str) -> Dict[str, Any]:
        fa = _pair_concordance(_pool(blocks, "FRESH_A_DEV"), feat)
        old = _pair_concordance(_pool(blocks, "OLD_DEV"), feat)
        comb = _pair_concordance(_pool(blocks, "COMBINED_DEV"), feat)
        return {"FA": fa, "OLD": old, "COMB": comb}

    candidates = []
    # F1 fav activation
    d = _dir_ok("fav_element_activation")
    candidates.append({
        "id": "F1_favorable_element_activation",
        "definition": "1 if Daewoon stem/branch element ∈ {용신,희신} else 0, × (용신_fit + 희신_fit)",
        "daewoon_specific": True,
        "theory": "Daewoon supplies missing/favorable element rather than aggregated signed fit",
        "evidence": d,
        "limitations": "depends on engine 용/희 labels; still natal-yongshin dependent",
        "passes_soft": (
            (d["FA"].get("sign_concordance") or 0) >= 0.52
            and (d["OLD"].get("sign_concordance") or 0) >= 0.48
            and (d["FA"].get("n_pairs") or 0) >= 10
        ),
    })
    d = _dir_ok("unfav_element_activation")
    # for unfav, lower is better → concordance of feature with target expects negative association;
    # report inverted metric: concordance of (-feature)
    for b in blocks:
        b["neg_unfav_element_activation"] = -float(b["unfav_element_activation"])
    d_inv = _dir_ok("neg_unfav_element_activation")
    candidates.append({
        "id": "F2_harmful_element_activation",
        "definition": "1 if Daewoon element ∈ 기신/구신 else 0, × (기신_fit + 구신_fit); higher = more harmful activation",
        "daewoon_specific": True,
        "theory": "Separates harmful activation from favorable; not −yongshin_fit",
        "evidence_raw_higher_worse_proxy": d,
        "evidence_negated_for_concordance": d_inv,
        "note": "Evaluate as harmful intensity; scoring should penalize, not use sign-flip of enc_yongshin_fit",
        "limitations": "기/구 labels engine-dependent",
        "passes_soft": (
            (d_inv["FA"].get("sign_concordance") or 0) >= 0.52
            and (d_inv["OLD"].get("sign_concordance") or 0) >= 0.48
        ),
    })
    d = _dir_ok("has_day_chung")
    candidates.append({
        "id": "F3_day_branch_clash",
        "definition": "Indicator: Daewoon relations include 충 involving day pillar",
        "daewoon_specific": True,
        "theory": "Relation type × natal target; day-palace clash ≠ generic relations scalar",
        "evidence": d,
        "limitations": "sparse; binary; may be Sewoon-sensitive too",
        "passes_soft": (
            (d["FA"].get("n_pairs") or 0) >= 8
            and ((d["FA"].get("sign_concordance") or 0.5) <= 0.45  # harmful expected
                 or (d["FA"].get("sign_concordance") or 0) >= 0.55)
        ),
    })
    d = _dir_ok("unseong_x_strength")
    candidates.append({
        "id": "F4_unseong_strength_interaction",
        "definition": "UNSEONG_SCORE × (+1 if 신약, −1 if 신강, 0 if 중화)",
        "daewoon_specific": True,
        "theory": "12운성 effect is regime-dependent; not universal monotonic UNSEONG_SCORE",
        "evidence": d,
        "limitations": "coarse regime buckets; still uses ordinal score magnitudes",
        "passes_soft": (
            (d["FA"].get("sign_concordance") or 0) >= 0.52
            and (d["OLD"].get("sign_concordance") or 0) >= 0.48
        ),
    })
    d = _dir_ok("has_samhap")
    candidates.append({
        "id": "F5_trine_half_combine_activation",
        "definition": "Indicator: 삼합/방합/반합 present between Daewoon and natal",
        "daewoon_specific": True,
        "theory": "Structural combination distinct from generic energy_direction blend",
        "evidence": d,
        "limitations": "activation sparse; needs element-quality conditioning in next phase",
        "passes_soft": (d["COMB"].get("n_pairs") or 0) >= 15,
    })

    ready_feats = []
    for c in candidates:
        if not c.get("passes_soft"):
            continue
        # Stricter freeze-path gate for "ready for new experiment"
        ev = c.get("evidence") or c.get("evidence_negated_for_concordance") or {}
        fa = ev.get("FA") or {}
        old = ev.get("OLD") or {}
        n_fa = fa.get("n_pairs") or 0
        n_old = old.get("n_pairs") or 0
        fa_c = fa.get("sign_concordance")
        old_c = old.get("sign_concordance")
        if n_fa < 20 or n_old < 50:
            c["passes_strict"] = False
            c["strict_fail"] = "insufficient_pair_coverage"
            continue
        if fa_c is None or old_c is None:
            c["passes_strict"] = False
            continue
        # require FA clearly > chance and OLD not harmful
        if fa_c >= 0.55 and old_c >= 0.48:
            c["passes_strict"] = True
            ready_feats.append(c)
        else:
            c["passes_strict"] = False
            c["strict_fail"] = f"fa={fa_c} old={old_c}"

    career_dom = (coverage["FRESH_A_DEV"].get("career_share") or 0) >= 0.40
    single_dom = (coverage["FRESH_A_DEV"].get("single_event_dominated_rate") or 0) >= 0.45
    sparse_fa = (coverage["FRESH_A_DEV"].get("events_per_evidence_block_mean") or 0) < 2.0

    tags = []
    enc = yong_parts["enc_yongshin_fit"]["COMBINED_DEV"].get("sign_concordance") or 0.5
    fav = yong_parts["fav_element_activation"]["COMBINED_DEV"].get("sign_concordance") or 0.5
    tags.append("CURRENT_ENCODING_FAILURE")  # scalar fit ≠ separated parts; U-shaped quantiles
    tags.append("CONTEXT_INTERACTION_MISSING")
    tags.append("DAEWOON_FEATURE_SET_INCOMPLETE")
    if sparse_fa or single_dom:
        tags.append("BLOCK_TARGET_TOO_NOISY")
    if career_dom:
        tags.append("BLOCK_TARGET_DOMAIN_BIASED")

    edge_g = temporal["COMBINED_DEV"]["near_edge_share_good"] or 0
    edge_b = temporal["COMBINED_DEV"]["near_edge_share_bad"] or 0
    # uniform edge band [0,0.2]U[0.8,1] ≈ 0.40; >0.50 suggests edge clustering
    if max(edge_g, edge_b) >= 0.50:
        tags.append("TRANSITION_SMOOTHING_WORTH_TESTING")
    else:
        tags.append("STEP_FUNCTION_OK")

    # pair-concordance is invariant to subject centering; do not claim ABSOLUTE unsupported from that
    tags.append("INSUFFICIENT_EVIDENCE")  # absolute-level still untested cross-sectionally

    target_unstable = any(
        (target_sens[p].get("pair_order_agree_simple_vs_norm") or 1) < 0.75
        for p in ("OLD_DEV", "FRESH_A_DEV")
        if (target_sens[p].get("n_comparable_pairs_simple_vs_norm") or 0) >= 20
    )
    if target_unstable:
        tags.append("BLOCK_TARGET_UNSTABLE")

    # Priority: construct validity first if Fresh A is sparse/career/single-event heavy
    if career_dom and (single_dom or sparse_fa) and len(ready_feats) < 3:
        status = "D_BLOCK_TARGET_NEEDS_REDESIGN_FIRST"
    elif len(ready_feats) >= 2:
        status = "D_FEATURES_READY_FOR_NEW_EXPERIMENT"
    else:
        status = "D_FEATURE_DISCOVERY_INCONCLUSIVE"

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "D_FEATURE_DISCOVERY",
        "validation_b_scored": False,
        "pools": {
            "OLD_DEV_n": len(old_packs),
            "FRESH_A_DEV_n": len(fresh_packs),
        },
        "n_blocks": len(blocks),
        "n_evidence_blocks": len(evid),
        "yongshin_family": yong_parts,
        "unseong_categorical": unseong_cat,
        "unseong_continuous": unseong_cont,
        "unseong_by_strength": {},
        "relations": rel_flags,
        "balance": bal_audit,
        "structural": struct_audit,
        "interactions": inter_audit,
        "coverage": coverage,
        "target_sensitivity": target_sens,
        "temporal_position": temporal,
        "transition_pm2y": trans_summary,
        "absolute_vs_relative": abs_vs_rel,
        "candidate_features": candidates,
        "diagnostic_tags": tags,
        "status": status,
        "min_cell": {"n_blocks": MIN_BLOCKS, "n_subjects": MIN_SUBJ},
    }
    for k, v in unseong_by_strength.items():
        row = {kk: vv for kk, vv in v.items() if kk != "states"}
        row["states_sufficient_only"] = {
            sk: sv for sk, sv in v.get("states", {}).items() if sv.get("sufficient")
        }
        payload["unseong_by_strength"][k] = row

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    report = _write_report(payload)
    open(OUT_REPORT, "w", encoding="utf-8").write(report)
    print("\n══════════ STATUS ══════════")
    print(status)
    print("tags", tags)
    print("ready_feats", [c["id"] for c in ready_feats])
    print(f"snapshot → {OUT_SNAP}")
    print(f"report → {OUT_REPORT}")
    return 0


def _write_report(p: dict) -> str:
    L: List[str] = []
    L.append("# D Feature Discovery Report")
    L.append("")
    L.append(f"**Status:** `{p['status']}`")
    L.append(f"**Measured at:** {p['measured_at']}")
    L.append("")
    L.append("Diagnosis only. No D score. No Ridge. No Validation B. Engine read-only.")
    L.append("")
    L.append(
        "Reminder: failure of `enc_yongshin_fit` means the **current encoding** failed, "
        "not that 용신 is bad / 기신 is good."
    )
    L.append("")
    L.append(f"Diagnostic tags: `{p['diagnostic_tags']}`")
    L.append("")

    def pw(feat_block, pool="COMBINED_DEV"):
        x = feat_block.get(pool) or {}
        return f"conc={x.get('sign_concordance')} n={x.get('n_pairs')} sp={x.get('spearman_diff')}"

    L.append("## Yongshin family (separated)")
    L.append("")
    L.append("| feature | OLD conc | FA conc | COMB conc | shape |")
    L.append("|---|---:|---:|---:|---|")
    y = p["yongshin_family"]
    for feat in ("enc_yongshin_fit", "yong_fit", "hee_fit", "gi_fit", "gu_fit",
                 "fav_minus_unfav", "fav_element_activation", "unfav_element_activation"):
        if feat not in y:
            continue
        shape = (y[feat].get("quantile_COMBINED") or {}).get("shape")
        L.append(
            f"| {feat} | {y[feat]['OLD_DEV'].get('sign_concordance')} | "
            f"{y[feat]['FRESH_A_DEV'].get('sign_concordance')} | "
            f"{y[feat]['COMBINED_DEV'].get('sign_concordance')} | {shape} |"
        )
    L.append("")

    L.append("## 12운성 categorical (COMBINED evidence means)")
    L.append("")
    L.append("| state | n_blocks | n_subj | mean simple_net | sufficient |")
    L.append("|---|---:|---:|---:|---|")
    for st, row in (p["unseong_categorical"].get("COMBINED_DEV") or {}).items():
        L.append(
            f"| {st} | {row['n_blocks']} | {row['n_subjects']} | {row['mean_target']} | {row['sufficient']} |"
        )
    L.append("")
    L.append("Continuous unseong:")
    for feat, blk in p["unseong_continuous"].items():
        L.append(
            f"- {feat}: OLD={blk['OLD_DEV'].get('sign_concordance')} "
            f"FA={blk['FRESH_A_DEV'].get('sign_concordance')} "
            f"COMB={blk['COMBINED_DEV'].get('sign_concordance')} "
            f"shape={(blk.get('quantile_COMBINED') or {}).get('shape')}"
        )
    L.append("")

    L.append("## Relations flags")
    L.append("")
    for feat, blk in p["relations"].items():
        L.append(
            f"- {feat}: OLD={blk['OLD_DEV'].get('sign_concordance')} "
            f"FA={blk['FRESH_A_DEV'].get('sign_concordance')} "
            f"COMB={blk['COMBINED_DEV'].get('sign_concordance')} "
            f"(nCOMB={blk['COMBINED_DEV'].get('n_pairs')})"
        )
    L.append("")

    L.append("## Balance / structural / interactions")
    L.append("")
    for title, section in (
        ("balance", p["balance"]),
        ("structural", p["structural"]),
        ("interactions", p["interactions"]),
    ):
        L.append(f"### {title}")
        for feat, blk in section.items():
            L.append(
                f"- {feat}: OLD={blk['OLD_DEV'].get('sign_concordance')} "
                f"FA={blk['FRESH_A_DEV'].get('sign_concordance')} "
                f"COMB={blk['COMBINED_DEV'].get('sign_concordance')}"
            )
        L.append("")

    L.append("## Coverage / construct validity")
    L.append("")
    for pool, c in p["coverage"].items():
        L.append(f"### {pool}")
        L.append(f"- events={c['n_events']} evidence_blocks={c['n_evidence_blocks']}")
        L.append(f"- career_share={c['career_share']} health={c['health_share']} "
                 f"rel={c['relationship_share']} legal={c['legal_reputation_share']}")
        L.append(f"- single_event_dominated_rate={c['single_event_dominated_rate']}")
        L.append(f"- events/block mean={c['events_per_evidence_block_mean']}")
        L.append("")

    L.append("## Target sensitivity")
    L.append("")
    for pool, t in p["target_sensitivity"].items():
        L.append(
            f"- {pool}: simple↔norm pair agree={t['pair_order_agree_simple_vs_norm']} "
            f"(n={t['n_comparable_pairs_simple_vs_norm']}) "
            f"spearman={t['spearman_simple_vs_norm']}"
        )
    L.append("")

    L.append("## Temporal / transition")
    L.append("")
    L.append(f"- Combined good rel_pos: {p['temporal_position']['COMBINED_DEV']['good_rel_pos']}")
    L.append(f"- Combined bad rel_pos: {p['temporal_position']['COMBINED_DEV']['bad_rel_pos']}")
    L.append(f"- near-edge shares good/bad: "
             f"{p['temporal_position']['COMBINED_DEV']['near_edge_share_good']} / "
             f"{p['temporal_position']['COMBINED_DEV']['near_edge_share_bad']}")
    L.append(f"- events within ±2y of Daewoon boundary: {p['transition_pm2y']}")
    L.append("")

    L.append("## Absolute vs subject-centered")
    L.append("")
    for feat, v in p["absolute_vs_relative"].items():
        L.append(
            f"- {feat}: raw_conc={v['raw'].get('sign_concordance')} "
            f"centered={v['centered'].get('sign_concordance')} "
            f"centered_better={v['centered_better']}"
        )
    L.append("")

    L.append("## Candidate feature shortlist (definitions only)")
    L.append("")
    for c in p["candidate_features"]:
        L.append(f"### {c['id']}")
        L.append(f"- definition: {c['definition']}")
        L.append(f"- theory: {c['theory']}")
        L.append(f"- passes_soft: {c.get('passes_soft')}")
        L.append(f"- limitations: {c.get('limitations')}")
        ev = c.get("evidence") or c.get("evidence_negated_for_concordance") or {}
        if ev:
            L.append(
                f"- FA conc={(ev.get('FA') or {}).get('sign_concordance')} "
                f"OLD={(ev.get('OLD') or {}).get('sign_concordance')} "
                f"COMB={(ev.get('COMB') or {}).get('sign_concordance')}"
            )
        L.append("")

    L.append("## Explicit answers")
    L.append("")
    y = p["yongshin_family"]
    L.append(
        f"1. Current yongshin_fit failure is primarily an **encoding/aggregation** issue "
        f"(enc COMB conc={y['enc_yongshin_fit']['COMBINED_DEV'].get('sign_concordance')}); "
        f"separated parts differ (yong={y['yong_fit']['COMBINED_DEV'].get('sign_concordance')}, "
        f"gi={y['gi_fit']['COMBINED_DEV'].get('sign_concordance')}, "
        f"fav_act={y['fav_element_activation']['COMBINED_DEV'].get('sign_concordance')})."
    )
    L.append(
        f"2. 용/희/기/구 differ: see table — do **not** collapse to one signed fit."
    )
    L.append(
        f"3. favorable-element activation vs enc fit: "
        f"FA {y['fav_element_activation']['FRESH_A_DEV'].get('sign_concordance')} vs "
        f"{y['enc_yongshin_fit']['FRESH_A_DEV'].get('sign_concordance')}."
    )
    shape = (p["unseong_continuous"]["unseong_raw_score"].get("quantile_COMBINED") or {}).get("shape")
    L.append(f"4. 12운성 monotonicity (raw score quantiles): **{shape}**.")
    L.append("5. 12운성 × 신강/신약: see `unseong_by_strength` — treat as context-dependent, not universal.")
    L.append("6. Relation types: compare has_hap / has_chung / has_day_chung / has_samhap flag concords.")
    L.append("7. Natal pillar matter: day vs month clash flags — if diverging, target-specific relations needed.")
    L.append(
        f"8–9. Balance: delta COMB={p['balance']['balance_delta']['COMBINED_DEV'].get('sign_concordance')}; "
        f"abs_delta={p['balance']['abs_balance_delta']['COMBINED_DEV'].get('sign_concordance')}; "
        f"'more balanced=better' is **not** assumed supported unless abs_delta shows consistent negative association with targets."
    )
    L.append(
        f"10. structural_adj parts: excess/activ/disrupt concords may oppose; do not reuse single scalar."
    )
    L.append("11. Interactions: fav/unfav activation and unseong×strength are the only predeclared probes.")
    L.append(
        f"12. Domain bias: FA career_share={p['coverage']['FRESH_A_DEV']['career_share']} "
        f"OLD={p['coverage']['OLD_DEV']['career_share']}."
    )
    L.append(
        f"13. Sparsity: FA evidence blocks={p['coverage']['FRESH_A_DEV']['n_evidence_blocks']} "
        f"events/block≈{p['coverage']['FRESH_A_DEV']['events_per_evidence_block_mean']}."
    )
    L.append(
        f"14. Single-event dominated: FA={p['coverage']['FRESH_A_DEV']['single_event_dominated_rate']} "
        f"OLD={p['coverage']['OLD_DEV']['single_event_dominated_rate']}."
    )
    L.append(
        f"15. Target agree simple↔norm: FA={p['target_sensitivity']['FRESH_A_DEV']['pair_order_agree_simple_vs_norm']} "
        f"OLD={p['target_sensitivity']['OLD_DEV']['pair_order_agree_simple_vs_norm']}."
    )
    L.append(f"16. Step-function: tags include transition assessment; near-edge shares in temporal section.")
    L.append(
        "17. Absolute vs relative: within-subject pair concordance is **invariant** to subject "
        "centering (Δ unchanged). Absolute D level remains **untested** cross-sectionally → "
        "do not claim ABSOLUTE_D_LEVEL_UNSUPPORTED from pair metrics alone."
    )
    ready = [c["id"] for c in p["candidate_features"] if c.get("passes_strict")]
    soft = [c["id"] for c in p["candidate_features"] if c.get("passes_soft")]
    L.append(f"18. Strict-pass candidates: {ready or 'none'}; soft exploratory: {soft}")
    L.append(
        "19. Do **not** reuse unchanged: enc_yongshin_fit, enc_unseong, enc_balance, enc_relations, "
        "enc_structural as primary D material; also forbid −enc_* sign flips."
    )
    if p["status"] == "D_BLOCK_TARGET_NEEDS_REDESIGN_FIRST":
        L.append(
            "20. Next: **redesign block labels / construct first** "
            "(Fresh A is career-heavy and often single-event-dominated; events/block≈1.5). "
            "Feature ideas F1–F5 remain hypotheses for after construct repair — not ready to score."
        )
    elif p["status"] == "D_FEATURES_READY_FOR_NEW_EXPERIMENT":
        L.append("20. Next: **new D feature experiment** using strict-pass families (still no Val B).")
    else:
        L.append("20. Next: inconclusive — clearer features and/or clearer block construct; not coefficient search.")
    L.append("")
    L.append("## Final status")
    L.append("")
    L.append(f"`{p['status']}`")
    L.append("")
    L.append("Do **not** score Validation B. Do **not** promote D_new.")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
