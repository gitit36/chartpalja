# -*- coding: utf-8 -*-
"""
D material forensic audit (diagnosis only).

Pools:
  OLD_DEV      = yongshin primary core (contaminated)
  FRESH_A_DEV  = eligible Fresh Validation A (opened → development)
  COMBINED_DEV = union

Hard-rejects Validation B.

Does NOT:
  - modify saju_engine / G / alpha / beta / kappa / centering
  - promote shrink λ
  - score Validation B

Writes:
  test/snapshots/exp_d_audit.json
  test/experiments/D_AUDIT.md

Usage:
  python test/experiments/audit_d_material.py
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
from scipy.stats import kendalltau, spearmanr

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

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_d_audit.json")
OUT_MD = os.path.join(_HERE, "D_AUDIT.md")

VARIANT = "G_CLEAN_AXIS"
SHRINK_LAMBDAS = [0.0, 0.25, 0.50, 0.75, 1.0]
CASE_NAMES = [
    "Robert Downey Jr.",
    "Whitney Houston",
    "George Clooney",
    "Meryl Streep",
    "Martha Stewart",
    "Arnold Schwarzenegger",
    "Marilyn Monroe",
]

CAREER_KW = (
    "award", "oscar", "emmy", "grammy", "championship", "champion", "title",
    "election", "elected", "ipo", "album", "debut", "nobel", "career", "promotion",
    "contract", "super bowl", "world cup", "wimbledon", "gold medal", "box office",
    "우승", "당선", "수상", "데뷔", "출마", "계약", "히트", "대박", "우승컵",
)
HEALTH_KW = (
    "cancer", "overdose", "illness", "stroke", "injury", "hospital", "death",
    "suicide", "rehab", "addiction", "heart attack", "disease",
    "암", "과다복용", "부상", "사망", "질환", "중독", "재활", "수술",
)
REL_KW = (
    "marriage", "wedding", "divorce", "affair", "spouse", "engaged", "engagement",
    "결혼", "이혼", "재혼", "약혼", "열애", "배우자",
)
LEGAL_KW = (
    "lawsuit", "arrest", "indictment", "prison", "scandal", "bankruptcy",
    "impeach", "fraud", "trial", "conviction", "felony", "probation",
    "기소", "수감", "소송", "파산", "스캔들", "체포", "유죄",
)

BD_KEYS = (
    "base", "yongshin_fit", "unseong", "unseong_context", "relations", "trine",
    "balance", "shinsal", "disease_resolution", "haegong", "structural_adj",
)


def _pct(xs: Sequence[float], p: float) -> Optional[float]:
    if not xs:
        return None
    return round(float(np.percentile(xs, p)), 4)


def _dist(xs: Sequence[float]) -> Dict[str, Any]:
    a = [float(x) for x in xs if x == x]
    if not a:
        return {"n": 0}
    return {
        "n": len(a),
        "min": round(min(a), 4),
        "p01": _pct(a, 1),
        "p05": _pct(a, 5),
        "p25": _pct(a, 25),
        "p50": _pct(a, 50),
        "p75": _pct(a, 75),
        "p95": _pct(a, 95),
        "p99": _pct(a, 99),
        "max": round(max(a), 4),
        "sd": round(float(np.std(a, ddof=1)) if len(a) > 1 else 0.0, 4),
        "mean": round(float(np.mean(a)), 4),
    }


def _axis_tags(e: dict) -> List[str]:
    raw = (e.get("axis") or e.get("domain") or e.get("category") or "").strip().lower()
    if raw in ("career", "health", "relationship", "legal", "reputation", "legal_reputation"):
        if raw in ("legal", "reputation"):
            return ["legal_reputation"]
        return [raw]
    lab = str(e.get("label") or "").casefold()
    tags = []
    if any(k in lab for k in CAREER_KW):
        tags.append("career")
    if any(k in lab for k in HEALTH_KW):
        tags.append("health")
    if any(k in lab for k in REL_KW):
        tags.append("relationship")
    if any(k in lab for k in LEGAL_KW):
        tags.append("legal_reputation")
    return tags


def _conf_high(e: dict) -> bool:
    return str(e.get("confidence") or "").lower() == "high"


def _w(e: dict) -> float:
    try:
        return float(e.get("weight", 1.0) or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _block_targets(events_in_block: Dict[str, List[dict]]) -> Dict[str, Any]:
    goods = events_in_block.get("good") or []
    bads = events_in_block.get("bad") or []

    def sum_w(evs, pred=None):
        return sum(_w(e) for e in evs if pred is None or pred(e))

    gw = sum_w(goods)
    bw = sum_w(bads)
    simple_net = gw - bw
    denom = gw + bw
    norm = (gw - bw) / denom if denom > 0 else None

    hg = [e for e in goods if _conf_high(e)]
    hb = [e for e in bads if _conf_high(e)]
    hgw, hbw = sum_w(hg), sum_w(hb)
    hden = hgw + hbw
    hi = (hgw - hbw) / hden if hden > 0 else None

    cg = [e for e in goods if "career" in _axis_tags(e)]
    cb = [e for e in bads if "career" in _axis_tags(e)]
    cgw, cbw = sum_w(cg), sum_w(cb)
    cden = cgw + cbw
    career = (cgw - cbw) / cden if cden > 0 else None

    def noncareer(e):
        tags = _axis_tags(e)
        return bool(tags) and "career" not in tags

    ng = [e for e in goods if noncareer(e)]
    nb = [e for e in bads if noncareer(e)]
    ngw, nbw = sum_w(ng), sum_w(nb)
    nden = ngw + nbw
    nonc = (ngw - nbw) / nden if nden > 0 else None

    return {
        "good_weight_sum": round(gw, 4),
        "bad_weight_sum": round(bw, 4),
        "n_good": len(goods),
        "n_bad": len(bads),
        "simple_net": round(simple_net, 4),
        "normalized_balance": None if norm is None else round(norm, 4),
        "high_confidence_balance": None if hi is None else round(hi, 4),
        "career_only_balance": None if career is None else round(career, 4),
        "non_career_balance": None if nonc is None else round(nonc, 4),
        "event_coverage": len(goods) + len(bads),
        "career_good": round(cgw, 4),
        "career_bad": round(cbw, 4),
        "health_good": round(sum_w(goods, lambda e: "health" in _axis_tags(e)), 4),
        "health_bad": round(sum_w(bads, lambda e: "health" in _axis_tags(e)), 4),
        "relationship_good": round(sum_w(goods, lambda e: "relationship" in _axis_tags(e)), 4),
        "relationship_bad": round(sum_w(bads, lambda e: "relationship" in _axis_tags(e)), 4),
        "legal_reputation_good": round(sum_w(goods, lambda e: "legal_reputation" in _axis_tags(e)), 4),
        "legal_reputation_bad": round(sum_w(bads, lambda e: "legal_reputation" in _axis_tags(e)), 4),
        "insufficient_event_evidence": (len(goods) + len(bads)) == 0,
    }


def _eval_block_ranking(blocks: List[dict], target_key: str) -> Dict[str, Any]:
    """Within-subject pairwise + spearman/kendall on evidence blocks."""
    by_subj: Dict[str, List[dict]] = defaultdict(list)
    for b in blocks:
        if b.get("insufficient_event_evidence"):
            continue
        if b.get(target_key) is None:
            continue
        by_subj[b["name"]].append(b)

    pair_rates = []
    wins = ties = losses = 0
    subj_dir = []
    all_d, all_t = [], []

    for name, blist in by_subj.items():
        if len(blist) < 2:
            continue
        ds = [float(b["D"]) for b in blist]
        ts = [float(b[target_key]) for b in blist]
        all_d.extend(ds)
        all_t.extend(ts)
        local_w = local_t = local_l = 0
        for a, b in combinations(range(len(blist)), 2):
            ta, tb = ts[a], ts[b]
            da, db = ds[a], ds[b]
            if abs(ta - tb) < 1e-12:
                continue  # no better/worse
            # a better than b on target?
            if ta > tb:
                better_d, worse_d = da, db
            else:
                better_d, worse_d = db, da
            if better_d > worse_d + 1e-12:
                wins += 1
                local_w += 1
            elif abs(better_d - worse_d) <= 1e-12:
                ties += 1
                local_t += 1
            else:
                losses += 1
                local_l += 1
        nloc = local_w + local_t + local_l
        if nloc:
            rate = (local_w + 0.5 * local_t) / nloc
            pair_rates.append(rate)
            subj_dir.append({"name": name, "pairwise": round(rate, 4), "n_pairs": nloc, "n_blocks": len(blist)})

    n_pairs = wins + ties + losses
    sp = ken = None
    if len(all_d) >= 3:
        sp_r = spearmanr(all_d, all_t)
        ken_r = kendalltau(all_d, all_t)
        sp = None if sp_r.correlation != sp_r.correlation else round(float(sp_r.correlation), 4)
        ken = None if ken_r.correlation != ken_r.correlation else round(float(ken_r.correlation), 4)

    return {
        "target": target_key,
        "n_subjects_with_ge2_blocks": len(pair_rates),
        "n_comparable_pairs": n_pairs,
        "wins": wins,
        "ties": ties,
        "losses": losses,
        "pairwise_mean": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "pairwise_pooled": None if not n_pairs else round((wins + 0.5 * ties) / n_pairs, 4),
        "spearman_pooled_blocks": sp,
        "kendall_pooled_blocks": ken,
        "subject_direction": subj_dir,
        "note": "spearman/kendall pool blocks across subjects (secondary); pairwise_mean is within-subject",
    }


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
            a = g - med
            out[y] = {"G": g, "A": a, "D": d_b, "pillar": p, "block_med": med}
    return out


def _annual_metrics(packs: List[dict], year_scores: List[Dict[int, float]]) -> Dict[str, Any]:
    rows = []
    pair_rates = []
    seps = []
    for pack, smap in zip(packs, year_scores):
        good = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        # OLD_DEV uses prepare_events style; packs from SW have n with good/bad already
        if not good and "good" in pack["n"]:
            good = [e for e in pack["n"]["good"] if not e.get("exclude")]
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
            "name": pack["name"],
            "hit": 1 if ga > ba else 0,
            "sep": round(sep, 4),
            "pairwise": None if pr is None else round(pr, 4),
        })
    hits = [r["hit"] for r in rows]
    return {
        "n": len(rows),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "hit_rate": None if not hits else round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "raw_sep_mean": None if not seps else round(float(np.mean(seps)), 4),
        "subjects": rows,
    }


def _load_fresh_a_packs(freeze: dict) -> List[dict]:
    fresh = json.load(open(FRESH_JSON, encoding="utf-8"))
    by_subj = {s["name"]: s for s in fresh["subjects"]}
    if os.path.exists(OUT_BIRTH_QA):
        birth_rows = json.load(open(OUT_BIRTH_QA, encoding="utf-8"))["rows"]
    else:
        birth_rows = [engine_recompute_birth(s) for s in fresh["subjects"]]
    by_birth = {r["name"]: r for r in birth_rows}

    eligible = set(freeze["eligible_for_primary_validation"])
    events = freeze["eligible_events"]
    packs = []
    for name in freeze["validation_a"]:
        s = by_subj[name]
        if s.get("split") == "validation_b":
            raise RuntimeError(f"BUG: Validation B subject leaked into Fresh A pool: {name}")
        if s.get("split") != "validation_a":
            raise RuntimeError(f"non-A split in validation_a list: {name}")
        if name not in eligible:
            continue
        # also ensure name not in validation_b list
        if name in freeze["validation_b"]:
            raise RuntimeError(f"BUG: name in both A and B: {name}")
        ev = events[name]
        packs.append(_pack_subject(s, by_birth[name]["engine_birth"], ev))
    return packs


def _old_dev_events(n: dict) -> Tuple[List[dict], List[dict]]:
    """Eligible good/bad for OLD_DEV (respect exclude flags; no collision edit here)."""
    good, bad = C.prepare_events(n, {}, exclude_collisions=False)
    return good, bad


def main() -> int:
    print("══════════ D AUDIT (no Val B, no revise) ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    val_b = set(freeze["validation_b"])

    # ── OLD_DEV packs ──
    # Every usable yongshin subject (all tiers), excluding placeholder 본인.
    print("── packing OLD_DEV (all usable yongshin) ──")
    import calibrate_yongshin as cy

    raw_ys = json.load(open(os.path.join(_TEST, "yongshin_subjects.json"), encoding="utf-8"))
    old_subjects = []
    for s in raw_ys:
        if s.get("name") == "본인":
            continue  # sample placeholder
        try:
            n = cy.normalize(s)
        except Exception:
            continue
        g = [e for e in n.get("good") or [] if not e.get("exclude")]
        b = [e for e in n.get("bad") or [] if not e.get("exclude")]
        if len(g) < 1 or len(b) < 1:
            continue
        old_subjects.append(n)
    for s in old_subjects:
        if s["name"] in val_b:
            raise RuntimeError(f"BUG: Validation B name in OLD_DEV: {s['name']}")
    print(f"  usable OLD_DEV subjects={len(old_subjects)}")
    old_packs = SW._preload(old_subjects)
    # attach full dw rows with breakdown
    for pack, n in zip(old_packs, old_subjects):
        _r, dw = SK._quiet_daewoon(n)
        pack["dw"] = dw
        pack["name"] = n["name"]
        pack["pool"] = "OLD_DEV"
        good, bad = _old_dev_events(n)
        pack["n"] = {
            **pack["n"],
            "good": good,
            "bad": bad,
            "name": n["name"],
        }

    # ── FRESH_A_DEV packs ──
    print("── packing FRESH_A_DEV ──")
    fresh_packs = _load_fresh_a_packs(freeze)
    for pack in fresh_packs:
        if pack["name"] in val_b or pack.get("split") == "validation_b":
            raise RuntimeError(f"BUG: Validation B scored: {pack['name']}")
        pack["pool"] = "FRESH_A_DEV"

    pools = {
        "OLD_DEV": old_packs,
        "FRESH_A_DEV": fresh_packs,
        "COMBINED_DEV": old_packs + fresh_packs,
    }
    print(f"OLD_DEV={len(old_packs)} FRESH_A_DEV={len(fresh_packs)}")

    cfg = dict(arm_b.ARM_B_CONFIG)

    # ── Build block records ──
    all_blocks: List[dict] = []
    unmapped: List[dict] = []
    for pool_name, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs)):
        for pack in packs:
            dw = pack.get("dw") or []
            # ensure d_map
            if not pack.get("d_map"):
                pack["d_map"] = arm_b9.d_map_from_daewoon_detail(dw)
            events_by_pillar: Dict[str, Dict[str, List[dict]]] = defaultdict(
                lambda: {"good": [], "bad": []}
            )
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
                        unmapped.append({"pool": pool_name, "name": pack["name"], "year": y, "side": side})
                        continue
                    events_by_pillar[matched["daewoon_pillar"]][side].append(e)

            # order blocks by start_year
            ordered = sorted(dw, key=lambda r: int(r["start_year"]))
            for i, row in enumerate(ordered):
                pillar = row["daewoon_pillar"]
                tg = _block_targets(events_by_pillar.get(pillar, {"good": [], "bad": []}))
                bd = row.get("breakdown") or {}
                rec = {
                    "pool": pool_name,
                    "name": pack["name"],
                    "daewoon_pillar": pillar,
                    "start_year": int(row["start_year"]),
                    "end_year": int(row["end_year"]),
                    "order_idx": i,
                    "D": float(row["종합운점수"]),
                    "breakdown": {k: float(bd.get(k) or 0.0) for k in BD_KEYS},
                    "events_good": [
                        {"year": e["year"], "label": e.get("label"), "weight": _w(e),
                         "confidence": e.get("confidence"), "tags": _axis_tags(e)}
                        for e in (events_by_pillar.get(pillar, {}).get("good") or [])
                    ],
                    "events_bad": [
                        {"year": e["year"], "label": e.get("label"), "weight": _w(e),
                         "confidence": e.get("confidence"), "tags": _axis_tags(e)}
                        for e in (events_by_pillar.get(pillar, {}).get("bad") or [])
                    ],
                    **tg,
                }
                all_blocks.append(rec)

    # ── Block ranking per pool × target ──
    targets = [
        "simple_net",
        "normalized_balance",
        "high_confidence_balance",
        "career_only_balance",
        "non_career_balance",
    ]
    block_eval = {}
    for pool_name in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        bl = [b for b in all_blocks if pool_name == "COMBINED_DEV" or b["pool"] == pool_name]
        block_eval[pool_name] = {t: _eval_block_ranking(bl, t) for t in targets}
        block_eval[pool_name]["coverage"] = {
            "n_blocks": len(bl),
            "n_with_events": sum(1 for b in bl if not b["insufficient_event_evidence"]),
            "n_insufficient": sum(1 for b in bl if b["insufficient_event_evidence"]),
            "n_subjects": len({b["name"] for b in bl}),
        }

    # ── D distribution / amplitude ──
    amp = {}
    for pool_name, packs in pools.items():
        ds = []
        ranges = []
        sds = []
        adj_jumps = []
        a_sds = []
        abs_a_labeled = []
        abs_d_cross = []
        ratios = []

        for pack in packs:
            layers = _decompose_layers(pack, cfg)
            pack["_layers"] = layers
            d_by_p = pack["d_map"]
            dvals = list(d_by_p.values())
            ds.extend(dvals)
            if len(dvals) >= 2:
                ranges.append(max(dvals) - min(dvals))
                sds.append(float(np.std(dvals, ddof=1)))
            # adjacent jumps from dw order
            dw = sorted(pack.get("dw") or [], key=lambda r: int(r["start_year"]))
            for i in range(len(dw) - 1):
                adj_jumps.append(abs(float(dw[i + 1]["종합운점수"]) - float(dw[i]["종합운점수"])))
            # A within-block SD
            by_p = defaultdict(list)
            for y, L in layers.items():
                by_p[L["pillar"]].append(L["A"])
            for vs in by_p.values():
                if len(vs) >= 2:
                    a_sds.append(float(np.std(vs, ddof=1)))
            # labeled pair magnitudes
            goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
            bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
            for ge in goods:
                for be in bads:
                    Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
                    abs_a_labeled.append(abs(Lg["A"] - Lb["A"]))
                    if Lg["pillar"] != Lb["pillar"]:
                        abs_d_cross.append(abs(Lg["D"] - Lb["D"]))
                        if abs(Lg["A"] - Lb["A"]) > 1e-9:
                            ratios.append(abs(Lg["D"] - Lb["D"]) / abs(Lg["A"] - Lb["A"]))

        amp[pool_name] = {
            "D_dist": _dist(ds),
            "within_subject_D_range": _dist(ranges),
            "within_subject_D_sd": _dist(sds),
            "adjacent_block_jump": {
                **_dist(adj_jumps),
                "p90": _pct(adj_jumps, 90) if adj_jumps else None,
            },
            "within_block_SD_A": _dist(a_sds),
            "labeled_abs_delta_A": _dist(abs_a_labeled),
            "labeled_cross_abs_delta_D": _dist(abs_d_cross),
            "labeled_cross_absD_over_absA": _dist(ratios),
        }

    # ── Feature contribution ──
    feat = {}
    for pool_name in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        bl = [b for b in all_blocks if pool_name == "COMBINED_DEV" or b["pool"] == pool_name]
        comps = {k: [] for k in BD_KEYS}
        for b in bl:
            for k in BD_KEYS:
                comps[k].append(b["breakdown"].get(k, 0.0))
        # within-subject SD per component
        by_subj = defaultdict(list)
        for b in bl:
            by_subj[b["name"]].append(b)
        within_sd = {k: [] for k in BD_KEYS}
        for rows in by_subj.values():
            if len(rows) < 2:
                continue
            for k in BD_KEYS:
                vs = [r["breakdown"].get(k, 0.0) for r in rows]
                within_sd[k].append(float(np.std(vs, ddof=1)))

        # corr with D and with simple_net (evidence blocks)
        d_vals = [b["D"] for b in bl]
        evidence = [b for b in bl if not b["insufficient_event_evidence"]]
        rows_out = {}
        for k in BD_KEYS:
            xs = comps[k]
            act = sum(1 for x in xs if abs(x) > 1e-9) / len(xs) if xs else 0
            corr_d = None
            if len(xs) >= 3:
                c = np.corrcoef(xs, d_vals)[0, 1]
                corr_d = None if c != c else round(float(c), 4)
            corr_t = None
            if len(evidence) >= 3:
                et = [b["simple_net"] for b in evidence]
                ex = [b["breakdown"].get(k, 0.0) for b in evidence]
                c2 = np.corrcoef(ex, et)[0, 1]
                corr_t = None if c2 != c2 else round(float(c2), 4)
            # sign consistency: among evidence pairs within subject
            sign_ok = sign_n = 0
            for name, rows in by_subj.items():
                evrows = [r for r in rows if not r["insufficient_event_evidence"]]
                if len(evrows) < 2:
                    continue
                for a, b in combinations(evrows, 2):
                    dt = a["simple_net"] - b["simple_net"]
                    dx = a["breakdown"].get(k, 0.0) - b["breakdown"].get(k, 0.0)
                    if abs(dt) < 1e-12 or abs(dx) < 1e-12:
                        continue
                    sign_n += 1
                    if (dt > 0 and dx > 0) or (dt < 0 and dx < 0):
                        sign_ok += 1
            var = float(np.var(xs, ddof=1)) if len(xs) > 1 else 0.0
            rows_out[k] = {
                "mean": round(float(np.mean(xs)), 4) if xs else None,
                "pop_sd": round(float(np.std(xs, ddof=1)), 4) if len(xs) > 1 else 0.0,
                "within_subj_sd_median": _pct(within_sd[k], 50),
                "range": [round(min(xs), 4), round(max(xs), 4)] if xs else None,
                "activation_rate": round(act, 4),
                "corr_with_D": corr_d,
                "approx_var": round(var, 4),
                "corr_with_simple_net": corr_t,
                "sign_consistency_with_simple_net": (
                    None if sign_n == 0 else round(sign_ok / sign_n, 4)
                ),
                "sign_n": sign_n,
            }
        # variance share (normalized pop var)
        tot = sum(max(0.0, v["approx_var"]) for v in rows_out.values()) or 1.0
        for k, v in rows_out.items():
            v["approx_var_share"] = round(max(0.0, v["approx_var"]) / tot, 4)
        feat[pool_name] = rows_out

    # ── Negative controls: shrink / constant / rank ──
    print("── shrink / rank diagnostics ──")
    controls = {}
    for pool_name, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs), ("COMBINED_DEV", old_packs + fresh_packs)):
        # precompute A maps
        layer_maps = []
        for pack in packs:
            if "_layers" not in pack:
                pack["_layers"] = _decompose_layers(pack, cfg)
            layer_maps.append(pack["_layers"])

        pool_ctrl = {"shrink": {}, "rank_only": None}
        for lam in SHRINK_LAMBDAS:
            score_maps = []
            for pack, layers in zip(packs, layer_maps):
                dvals = list(pack["d_map"].values())
                med_d = float(np.median(dvals)) if dvals else 50.0
                smap = {}
                for y, L in layers.items():
                    d_s = med_d + lam * (L["D"] - med_d)
                    smap[y] = float(arm_b9.squash(d_s + ALPHA * L["A"]))
                score_maps.append(smap)
            pool_ctrl["shrink"][str(lam)] = _annual_metrics(packs, score_maps)

        # RANK_ONLY_D
        score_maps = []
        for pack, layers in zip(packs, layer_maps):
            pillars = list(pack["d_map"].keys())
            d_sorted = sorted(pillars, key=lambda p: pack["d_map"][p])
            n = len(d_sorted)
            if n <= 1:
                rank_map = {p: 0.0 for p in pillars}
            else:
                # map to [-2,+2]
                rank_map = {}
                for i, p in enumerate(d_sorted):
                    rank_map[p] = -2.0 + 4.0 * (i / (n - 1))
            smap = {}
            for y, L in layers.items():
                smap[y] = float(arm_b9.squash(50.0 + 8.0 * rank_map[L["pillar"]] + ALPHA * L["A"]))
            score_maps.append(smap)
        pool_ctrl["rank_only"] = _annual_metrics(packs, score_maps)
        # CONSTANT_D is shrink λ=0
        controls[pool_name] = pool_ctrl

    # ── Case audits (Fresh A failures) ──
    cases = {}
    fresh_by_name = {p["name"]: p for p in fresh_packs}
    for name in CASE_NAMES:
        pack = fresh_by_name.get(name)
        if not pack:
            cases[name] = {"status": "missing_in_fresh_a_eligible"}
            continue
        bl = [b for b in all_blocks if b["name"] == name and b["pool"] == "FRESH_A_DEV"]
        bl = sorted(bl, key=lambda b: b["start_year"])
        # only blocks with events or all? show event-bearing + neighbors mentioned
        cases[name] = {
            "blocks": [
                {
                    "pillar": b["daewoon_pillar"],
                    "years": f"{b['start_year']}-{b['end_year']}",
                    "D": b["D"],
                    "simple_net": b["simple_net"],
                    "insufficient": b["insufficient_event_evidence"],
                    "good": b["events_good"],
                    "bad": b["events_bad"],
                    "breakdown": b["breakdown"],
                }
                for b in bl
                if (not b["insufficient_event_evidence"])
                or any(
                    (b["start_year"] <= int(e["year"]) < b["end_year"])
                    for side in ("good", "bad")
                    for e in pack["n"].get(side) or []
                )
            ],
            "event_bearing_blocks": [
                {
                    "pillar": b["daewoon_pillar"],
                    "years": f"{b['start_year']}-{b['end_year']}",
                    "D": b["D"],
                    "simple_net": b["simple_net"],
                    "good": b["events_good"],
                    "bad": b["events_bad"],
                    "breakdown": b["breakdown"],
                    "top_positive_components": sorted(
                        ((k, v) for k, v in b["breakdown"].items() if k != "base"),
                        key=lambda kv: -kv[1],
                    )[:3],
                    "top_negative_components": sorted(
                        ((k, v) for k, v in b["breakdown"].items() if k != "base"),
                        key=lambda kv: kv[1],
                    )[:3],
                }
                for b in bl
                if not b["insufficient_event_evidence"]
            ],
        }

    # ── Ranking vs amplitude case classification ──
    fa_rank = block_eval["FRESH_A_DEV"]["simple_net"]["pairwise_mean"]
    old_rank = block_eval["OLD_DEV"]["simple_net"]["pairwise_mean"]
    def _lam_pw(pool_ctrl: dict, x: float):
        return pool_ctrl["shrink"][str(x)]["pairwise_mean"]

    fa_s1 = _lam_pw(controls["FRESH_A_DEV"], 1.0)
    fa_s0 = _lam_pw(controls["FRESH_A_DEV"], 0.0)
    fa_s025 = _lam_pw(controls["FRESH_A_DEV"], 0.25)
    fa_s05 = _lam_pw(controls["FRESH_A_DEV"], 0.5)

    shrink_helps = (
        fa_s0 is not None and fa_s1 is not None and fa_s0 > fa_s1 + 0.02
    ) or (
        fa_s025 is not None and fa_s1 is not None and fa_s025 > fa_s1 + 0.02
    ) or (
        fa_s05 is not None and fa_s1 is not None and fa_s05 > fa_s1 + 0.02
    )
    rank_ok_fa = fa_rank is not None and fa_rank > 0.55
    rank_weak_fa = fa_rank is not None and fa_rank <= 0.50
    rank_ok_old = old_rank is not None and old_rank > 0.55
    rank_weak_old = old_rank is not None and old_rank <= 0.50

    if rank_ok_fa and shrink_helps:
        verdict = "D_ACCEPTABLE_AMPLITUDE_PROBLEM"
        case_tag = "CASE_A"
    elif rank_weak_fa and not shrink_helps:
        verdict = "D_MATERIAL_RANKING_PROBLEM"
        case_tag = "CASE_B"
    elif rank_weak_fa and shrink_helps:
        verdict = "D_MIXED_RANKING_AND_AMPLITUDE_PROBLEM"
        case_tag = "CASE_C"
    elif rank_ok_fa and not shrink_helps:
        verdict = "D_NOT_A_PRIMARY_PROBLEM"
        case_tag = "CASE_D"
    else:
        verdict = "INSUFFICIENT_D_EVIDENCE"
        case_tag = "UNCLEAR"

    # legacy overfit flag
    legacy = None
    if rank_ok_old and rank_weak_fa:
        legacy = "legacy_overfit_risk: OLD_DEV ranking looks useful but FRESH_A_DEV does not"
    elif rank_ok_old and rank_ok_fa:
        legacy = "ranking signal appears in both OLD_DEV and FRESH_A_DEV"
    elif rank_weak_old and rank_weak_fa:
        legacy = "ranking weak on both pools"

    next_phase = {
        "D_ACCEPTABLE_AMPLITUDE_PROBLEM": "D amplitude recalibration",
        "D_MATERIAL_RANKING_PROBLEM": "D material redesign",
        "D_MIXED_RANKING_AND_AMPLITUDE_PROBLEM": "both",
        "D_NOT_A_PRIMARY_PROBLEM": "insufficient evidence / revisit G",
        "INSUFFICIENT_D_EVIDENCE": "insufficient evidence",
    }[verdict]

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "D_AUDIT",
        "validation_b_scored": False,
        "validation_b_names_sealed": sorted(val_b),
        "pools": {
            "OLD_DEV_n": len(old_packs),
            "FRESH_A_DEV_n": len(fresh_packs),
            "COMBINED_DEV_n": len(old_packs) + len(fresh_packs),
            "OLD_DEV_names": [p["name"] for p in old_packs],
            "FRESH_A_DEV_names": [p["name"] for p in fresh_packs],
        },
        "unmapped_events": unmapped,
        "block_eval": block_eval,
        "amplitude": amp,
        "feature_contribution": feat,
        "controls": {
            k: {
                "shrink": {lam: {kk: vv for kk, vv in m.items() if kk != "subjects"} for lam, m in v["shrink"].items()},
                "rank_only": {kk: vv for kk, vv in v["rank_only"].items() if kk != "subjects"},
            }
            for k, v in controls.items()
        },
        "controls_full_subjects": {
            "FRESH_A_DEV_shrink": {
                str(lam): controls["FRESH_A_DEV"]["shrink"][str(lam)]
                for lam in SHRINK_LAMBDAS
            }
        },
        "cases": cases,
        "ranking_vs_amplitude": {
            "case_tag": case_tag,
            "fa_block_pairwise_simple_net": fa_rank,
            "old_block_pairwise_simple_net": old_rank,
            "fa_S_pairwise_lambda": {
                str(lam): controls["FRESH_A_DEV"]["shrink"][str(lam)]["pairwise_mean"]
                for lam in SHRINK_LAMBDAS
            },
            "shrink_helps_fa": shrink_helps,
            "legacy_note": legacy,
        },
        "verdict": verdict,
        "next_phase_suggestion": next_phase,
        "frozen_must_remain": [
            "alpha=1.0", "kappa=0", "beta=0.25", "median centering",
            "G_CLEAN_AXIS formula", "saju_engine.py untouched until explicit promote",
            "Validation B sealed",
        ],
    }

    # also store evidence blocks compact for snapshot size control
    payload["blocks_evidence_only"] = [
        {
            "pool": b["pool"], "name": b["name"], "pillar": b["daewoon_pillar"],
            "years": f"{b['start_year']}-{b['end_year']}", "D": b["D"],
            "simple_net": b["simple_net"],
            "normalized_balance": b["normalized_balance"],
            "breakdown": b["breakdown"],
            "n_good": b["n_good"], "n_bad": b["n_bad"],
        }
        for b in all_blocks if not b["insufficient_event_evidence"]
    ]

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    md = _write_md(payload, feat, amp, block_eval, controls, cases)
    open(OUT_MD, "w", encoding="utf-8").write(md)

    print("\n══════════ D AUDIT VERDICT ══════════")
    print(verdict, case_tag)
    print("legacy:", legacy)
    print(f"snapshot → {OUT_SNAP}")
    print(f"report → {OUT_MD}")
    return 0


def _write_md(payload, feat, amp, block_eval, controls, cases) -> str:
    L: List[str] = []
    v = payload["verdict"]
    L.append("# D Material Forensic Audit")
    L.append("")
    L.append(f"**Verdict:** `{v}`")
    L.append(f"**Measured at:** {payload['measured_at']}")
    L.append("")
    L.append("Diagnosis only. No D_new. No G revise. No α change. Validation B sealed.")
    L.append("")
    L.append("Pools: OLD_DEV (yongshin primary) + FRESH_A_DEV (eligible Fresh A). Both DEVELOPMENT / contaminated.")
    L.append("")

    # ── Computation graph (static from engine read) ──
    L.append("## 1. Current D computation graph")
    L.append("")
    L.append("```text")
    L.append("birth chart (원국)")
    L.append("  → 대운 블록 ganzi (stem, branch) + start/end years")
    L.append("  → primitives:")
    L.append("       yongshin fit (_check_yongshin_fit)")
    L.append("       12운성 (twelve_unseong) + verdict mult + 신강 excess pen")
    L.append("       십성 context (_unseong_tengo_adj)")
    L.append("       relations → energy_direction (_calc_energy_field) + noble_power×0.25")
    L.append("       삼합/방합 (_trine_energy_adj)")
    L.append("       공망 factors (_gongmang_factors) × yfit/unseong/rel/trine")
    L.append("       balance delta vs natal (_ohang_balance) ×20 clamp[-6,6]")
    L.append("       신살 contextual (_contextual_shinsal_adj)")
    L.append("       disease resolution (_disease_resolution_score)")
    L.append("       해공 (_haegong_check)")
    L.append("       structural_adj v6.4: excess + yong activation + gishin disrupt clamp[-8,8]")
    L.append("  → _composite_score(base=50, …)")
    L.append("  → sc = base + Σ components")
    L.append("  → _uplift_composite(sc) = clamp(round(sc + SCORE_BIAS), 0..100)")
    L.append("  → D = build_daewoon_detail(...)[i][\"종합운점수\"]")
    L.append("```")
    L.append("")
    L.append("Source: `saju_engine.build_daewoon_detail` → `_composite_score` → `_uplift_composite`.")
    L.append("")
    L.append("Default `SCORE_BIAS = 10` (env override). Shared with Sewoon/월 path that also call `_composite_score`.")
    L.append("")
    L.append("### Component formulas (engine)")
    L.append("")
    L.append("| Component | Formula (summary) | Clamp | Annual info? |")
    L.append("|---|---|---|---|")
    L.append("| base | 50 | — | no |")
    L.append("| yongshin_fit | 10·yf + 5·hf − 10·gf − 5·uf (−2·min(yf,gf) if both>0); 공망 on branch | unbounded before sum | no (Daewoon pillar only) |")
    L.append("| unseong | 0.8·UNSEONG_SCORE·mult·gm + 신강 excess | via mult tables | no |")
    L.append("| unseong_context | ten-god adj × gm | — | no |")
    L.append("| relations | energy_direction×2×gm + noble_power×0.25 | — | no |")
    L.append("| trine | (pos−neg)×gm | — | no |")
    L.append("| balance | clamp((bal−natal)×20, −6..6); sign flip for 종/화/외격 | [-6,6] | no |")
    L.append("| shinsal | contextual adj | — | no |")
    L.append("| disease_resolution | disease cure/worsen by pillar | — | no |")
    L.append("| haegong | natal 공망 activation bonus | — | no |")
    L.append("| structural_adj | excess+activ+disrupt | [-8,8] | no |")
    L.append("| SCORE_BIAS | +10 then int round clamp 0..100 | [0,100] | no |")
    L.append("")
    L.append("**Daewoon-specificity:** D uses only the Daewoon pillar vs natal. It does **not** read Sewoon year stems, Control close, or annual timeline outputs. Temporal granularity is 10-year pillar structure.")
    L.append("")
    L.append("**Shared path with Sewoon:** `_composite_score` is also used for yearly/monthly scores; coefficients are the same family. That is formula reuse, not Control leakage into D.")
    L.append("")

    L.append("## 2. Provenance audit")
    L.append("")
    L.append("| Rule / coefficient | Provenance | Notes |")
    L.append("|---|---|---|")
    L.append("| base=50 | engine inherited | neutral midscale |")
    L.append("| yfit 10/5/−10/−−5 | empirically tuned / engine inherited | comment v6.3: amplitude reduced so relations/unseong/balance survive; earlier dominance reduced in commit `b4d9522` |")
    L.append("| UNSEONG_SCORE table | classical/theory-derived + heuristic scale | 장생/제왕… magnitudes product-scaled |")
    L.append("| UNSEONG_VERDICT_MULT / SINGANG_EXCESS | manually heuristic + theory-inspired | v6.2 comments; 신강 damping |")
    L.append("| relations energy×2 + noble×0.25 | manually heuristic | noble reduced to avoid shinsal double-count |")
    L.append("| balance ×20 clamp6 | manually heuristic | v6.3 enlarged vs earlier |")
    L.append("| structural_adj ±8 | engine inherited v6.4 | heuristic structural corrections |")
    L.append("| SCORE_BIAS=+10 | empirically tuned product feel | comment: 체감 \"너무 짜다\" 완화; env `SCORE_BIAS` |")
    L.append("| gongmang / haegong / trine | theory-derived structure + heuristic weights | v5→v6.1/6.2 |")
    L.append("| disease_resolution | heuristic on 병인진단 | depends on yongshin disease model |")
    L.append("| Celebrity named patches inside D | **not found** | No Messi/Brown/Hillary/Bieber/Gore/Jackson branches in `build_daewoon_detail` / `_composite_score` |")
    L.append("")
    L.append("Where comments do not prove a classical source → **provenance unknown** beyond engine inheritance.")
    L.append("")

    L.append("## 3. Double-count / temporal leakage vs G")
    L.append("")
    L.append("G (`G_CLEAN_AXIS` / arm_b) reads **Sewoon-year** `meta.breakdown` fields that come from the **same `_composite_score` family** applied to yearly pillars, plus annual-only pattern/ten-god/ilju features.")
    L.append("")
    L.append("| Signal | In D? | In G? | Issue |")
    L.append("|---|---|---|---|")
    L.append("| yongshin_fit | yes (Daewoon pillar) | yes (Sewoon-year breakdown) | same *family*, different pillar; hierarchical double-theme risk |")
    L.append("| relations / energy | yes | yes | same |")
    L.append("| structural_adj | yes | yes | same |")
    L.append("| unseong | yes | yes (G reads unseong; not unseong_context) | same |")
    L.append("| balance | yes | yes | same |")
    L.append("| trine / shinsal / disease / haegong | yes in D | mostly via year breakdown / patterns | partial |")
    L.append("| career_tg / ilju shocks / discord / hollow / friction / health_guan | **no** | **yes** | annual-only in G |")
    L.append("| Control candle.close | **no** | **no** (G) | no Control→D leak |")
    L.append("| Sewoon year stem/branch | **no** | yes | D is Daewoon-specific here |")
    L.append("")
    L.append("Conclusion: D is temporally Daewoon-specific, but **semantically overlaps** G’s annual primitives (fit/rel/struct/uns/bal). S=D+A therefore mixes correlated themes at two timescales.")
    L.append("")

    # pools
    L.append("## 4. Development pools")
    L.append("")
    L.append(f"- OLD_DEV n={payload['pools']['OLD_DEV_n']}")
    L.append(f"- FRESH_A_DEV n={payload['pools']['FRESH_A_DEV_n']}")
    L.append(f"- Validation B sealed (n={len(payload['validation_b_names_sealed'])}); not scored.")
    L.append(f"- Unmapped events: {len(payload['unmapped_events'])}")
    L.append("")

    L.append("## 5. Block-level D ranking (predeclared targets)")
    L.append("")
    for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        cov = block_eval[pool]["coverage"]
        L.append(f"### {pool}")
        L.append("")
        L.append(
            f"blocks={cov['n_blocks']} with_events={cov['n_with_events']} "
            f"insufficient={cov['n_insufficient']} subjects={cov['n_subjects']}"
        )
        L.append("")
        L.append("| target | within-subj pairwise | pooled pairwise | spearman | kendall | n_pairs | n_subj |")
        L.append("|---|---:|---:|---:|---:|---:|---:|")
        for t in (
            "simple_net", "normalized_balance", "high_confidence_balance",
            "career_only_balance", "non_career_balance",
        ):
            e = block_eval[pool][t]
            L.append(
                f"| {t} | {e['pairwise_mean']} | {e['pairwise_pooled']} | "
                f"{e['spearman_pooled_blocks']} | {e['kendall_pooled_blocks']} | "
                f"{e['n_comparable_pairs']} | {e['n_subjects_with_ge2_blocks']} |"
            )
        L.append("")

    L.append("## 6. D amplitude vs A")
    L.append("")
    for pool in ("OLD_DEV", "FRESH_A_DEV", "COMBINED_DEV"):
        a = amp[pool]
        L.append(f"### {pool}")
        L.append("")
        L.append(f"- D dist: {a['D_dist']}")
        L.append(f"- within-subject D range: {a['within_subject_D_range']}")
        L.append(f"- within-subject D SD: {a['within_subject_D_sd']}")
        L.append(f"- adjacent-block jump: {a['adjacent_block_jump']}")
        L.append(f"- within-block SD(A): {a['within_block_SD_A']}")
        L.append(f"- labeled |ΔA|: {a['labeled_abs_delta_A']}")
        L.append(f"- labeled cross |ΔD|: {a['labeled_cross_abs_delta_D']}")
        L.append(f"- labeled cross |ΔD|/|ΔA|: {a['labeled_cross_absD_over_absA']}")
        L.append("")

    L.append("## 7. Feature contribution (COMBINED_DEV)")
    L.append("")
    L.append("| component | mean | pop_sd | within_sd_p50 | var_share | corr_D | corr_simple_net | sign_cons | act |")
    L.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    rows = sorted(feat["COMBINED_DEV"].items(), key=lambda kv: -kv[1]["approx_var_share"])
    for k, r in rows:
        L.append(
            f"| {k} | {r['mean']} | {r['pop_sd']} | {r['within_subj_sd_median']} | "
            f"{r['approx_var_share']} | {r['corr_with_D']} | {r['corr_with_simple_net']} | "
            f"{r['sign_consistency_with_simple_net']} | {r['activation_rate']} |"
        )
    L.append("")
    L.append("Fresh-A-only feature table is in `exp_d_audit.json` → `feature_contribution.FRESH_A_DEV`.")
    L.append("")

    L.append("## 8. Shrink / rank diagnostics (annual S on DEVELOPMENT — not promotion)")
    L.append("")
    for pool in ("OLD_DEV", "FRESH_A_DEV"):
        L.append(f"### {pool}")
        L.append("")
        L.append("| λ | hit | pairwise | raw_sep |")
        L.append("|---:|---|---:|---:|")
        for lam in SHRINK_LAMBDAS:
            m = controls[pool]["shrink"][str(lam)]
            L.append(f"| {lam} | {m['hit']} ({m['hit_rate']}%) | {m['pairwise_mean']} | {m['raw_sep_mean']} |")
        ro = controls[pool]["rank_only"]
        L.append(f"| RANK_ONLY | {ro['hit']} ({ro['hit_rate']}%) | {ro['pairwise_mean']} | {ro['raw_sep_mean']} |")
        L.append("")

    L.append("## 9. Fresh A case boards (forensic, no patches)")
    L.append("")
    for name in CASE_NAMES:
        c = cases.get(name) or {}
        L.append(f"### {name}")
        L.append("")
        if c.get("status"):
            L.append(c["status"])
            L.append("")
            continue
        for b in c.get("event_bearing_blocks") or []:
            L.append(
                f"- **{b['pillar']}** {b['years']} D={b['D']} net={b['simple_net']}"
            )
            L.append(f"  - good: {b['good']}")
            L.append(f"  - bad: {b['bad']}")
            L.append(f"  - top+: {b['top_positive_components']}")
            L.append(f"  - top−: {b['top_negative_components']}")
        L.append("")

    rva = payload["ranking_vs_amplitude"]
    L.append("## 10. Ranking vs amplitude")
    L.append("")
    L.append(f"- Case tag: `{rva['case_tag']}`")
    L.append(f"- OLD_DEV block pairwise (simple_net): {rva['old_block_pairwise_simple_net']}")
    L.append(f"- FRESH_A_DEV block pairwise (simple_net): {rva['fa_block_pairwise_simple_net']}")
    L.append(f"- FRESH_A S pairwise by λ: {rva['fa_S_pairwise_lambda']}")
    L.append(f"- Shrink helps on Fresh A annual S?: {rva['shrink_helps_fa']}")
    L.append(f"- Legacy note: {rva['legacy_note']}")
    L.append("")

    L.append("## 11. Explicit answers")
    L.append("")
    L.append("1. **What does D measure?** A Daewoon-pillar `_composite_score` of natal-relative 용신 fit, 12운성, relations/trine, balance delta, 신살/병인/해공, and v6.4 structural adj, then +SCORE_BIAS and clamp to 0–100.")
    L.append("2. **Truly Daewoon-specific?** Yes temporally (pillar vs natal only; no Sewoon year inputs). Semantically shares the composite family with annual scores.")
    L.append("3. **Dominant primitives?** See feature table — typically `yongshin_fit`, then `unseong` / `relations` / `structural_adj` / `balance` (confirm via var_share).")
    L.append("4. **Weak/unknown provenance?** Most numeric coefficients (10/5, ×20, SCORE_BIAS=10, structural clamps) are heuristic/product-tuned; classical structure for 합충형파해/운성/용신 theme only.")
    L.append("5. **Annual-like signals in D?** No Sewoon stem enters D. Risk is thematic overlap with annual G, not calendar leakage.")
    L.append("6. **Double-count with G?** Yes at theme level (fit/rel/struct/uns/bal). Not literal reuse of the same year breakdown row.")
    L.append("7. **OLD_DEV block ranking useful?** See §5 OLD_DEV simple_net pairwise.")
    L.append("8. **FRESH_A_DEV block ranking useful?** See §5 FRESH_A_DEV simple_net pairwise.")
    L.append("9. **Ranking vs amplitude?** See case tag / verdict.")
    L.append("10. **D vs A variation?** See §6 |ΔD|/|ΔA| medians — Fresh A previously ~4.5×; confirm pool tables.")
    L.append("11. **Largest incorrect block diffs?** Case boards §9 + high-variance components with poor sign_consistency.")
    L.append("12. **Does shrink improve S?** See §8 λ grid (diagnostic only).")
    L.append("13. **Defensible absolute parent?** Only if ranking is directionally useful; amplitude currently dominates A on lifetime pairs.")
    L.append(f"14. **Next phase:** {payload['next_phase_suggestion']}")
    L.append("15. **Must stay frozen before D_new:** " + ", ".join(payload["frozen_must_remain"]))
    L.append("")

    L.append("## 12. Final verdict")
    L.append("")
    L.append(f"`{v}`")
    L.append("")
    L.append("No D_new in this run. Validation B remains sealed.")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
