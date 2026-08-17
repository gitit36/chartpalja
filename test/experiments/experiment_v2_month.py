# -*- coding: utf-8 -*-
"""
V2 Month experiment (Phase 3).

Frozen parent: V2_DY_B
M = clamp(Y_parent + MonthlyDev)

Candidates: M1 V2_MONTH_LOCAL, M2 V2_MONTH_CONTEXTUAL
Amplitudes: CONSERVATIVE / BALANCED / EXPRESSIVE

No Val B. No Day. No D/Y redesign. No production scoring edits.

Usage:
  PYTHONPATH=.:test python test/experiments/experiment_v2_month.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from itertools import combinations
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import calibrate_yongshin as cy  # noqa: E402
import saju_engine as se  # noqa: E402
from experiments import arm_b, common as C  # noqa: E402
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments import md_labels as MD  # noqa: E402
from experiments.experiment_g_clean import score_g  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS, _pairwise  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_month.json")
OUT_SPEC = os.path.join(_HERE, "V2_MONTH_SPEC.md")
OUT_REPORT = os.path.join(_HERE, "V2_MONTH_REPORT.md")
OUT_ATTR = os.path.join(_HERE, "V2_MONTH_ATTRIBUTION.md")
OUT_AUDIT = os.path.join(_HERE, "V2_MONTH_DATE_PRECISION_AUDIT.md")
OUT_FREEZE = os.path.join(_HERE, "V2_MONTH_EVALUABLE_FREEZE.json")

VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0

# Predeclared amplitude scales (features identical)
AMP = {
    "CONSERVATIVE": 1.5,
    "BALANCED": 2.5,
    "EXPRESSIVE": 4.0,
}

# Predeclared feature weights (not dense-searched)
W = {
    "natal_struct": 0.35,
    "month_sewoon": 0.40,
    "rel_timing": 0.25,
    "month_daewoon_m2": 0.15,  # only M2; applied after M1 raw
}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def _sha16(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def _parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _rel_text(rels) -> str:
    if isinstance(rels, list):
        return " ".join(str(x) for x in rels)
    return str(rels or "")


def _rel_flags(text: str) -> Dict[str, float]:
    return {
        "hap": 1.0 if "합" in text else 0.0,
        "chung": 1.0 if "충" in text else 0.0,
        "hyung": 1.0 if "형" in text else 0.0,
        "pa": 1.0 if "파" in text else 0.0,
        "hae": 1.0 if "해" in text else 0.0,
    }


def _event_intensity(flags: Dict[str, float]) -> float:
    """VALENCE ≠ EVENT_INTENSITY — magnitude only."""
    return (
        1.5 * flags["chung"]
        + 1.0 * flags["hyung"]
        + 0.8 * flags["pa"]
        + 0.8 * flags["hae"]
        + 0.5 * flags["hap"]
    )


# ══════════════════════════════════════════════
# DATE PRECISION AUDIT + FREEZE
# ══════════════════════════════════════════════

def date_precision_audit(val_b: set) -> Dict[str, Any]:
    """Audit OLD_DEV + Fresh A life_events + existing month_day_labels."""
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    fa_names = set(freeze["validation_a"]) & set(freeze["eligible_for_primary_validation"])
    raw_ys = json.load(open(os.path.join(_TEST, "yongshin_subjects.json"), encoding="utf-8"))
    old_names = set()
    year_only_counts = {"OLD_DEV": {"n": 0, "pos": 0, "neg": 0}, "FRESH_A_DEV": {"n": 0, "pos": 0, "neg": 0}}

    for s in raw_ys:
        if s.get("name") == "본인" or s.get("name") in val_b:
            continue
        try:
            n = cy.normalize(s)
        except Exception:
            continue
        g = [e for e in (n.get("good") or []) if not e.get("exclude")]
        b = [e for e in (n.get("bad") or []) if not e.get("exclude")]
        if not g or not b:
            continue
        old_names.add(n["name"])
        year_only_counts["OLD_DEV"]["pos"] += len(g)
        year_only_counts["OLD_DEV"]["neg"] += len(b)
        year_only_counts["OLD_DEV"]["n"] += len(g) + len(b)

    fresh = json.load(open(os.path.join(_HERE, "g_fresh_labels_frozen.json"), encoding="utf-8"))
    for name in fa_names:
        ev = (fresh.get("eligible_events") or {}).get(name) or {}
        g = [e for e in (ev.get("good") or []) if not e.get("exclude")]
        b = [e for e in (ev.get("bad") or []) if not e.get("exclude")]
        year_only_counts["FRESH_A_DEV"]["pos"] += len(g)
        year_only_counts["FRESH_A_DEV"]["neg"] += len(b)
        year_only_counts["FRESH_A_DEV"]["n"] += len(g) + len(b)

    # month_day_labels — existing curated exact dates (not newly searched)
    md = MD.load_raw()
    exact_rows = []
    month_only_rows = []
    for name, block in (md.get("subjects") or {}).items():
        if name in val_b:
            continue
        pool = "OLD_DEV" if name in old_names else ("FRESH_A_DEV" if name in fa_names else "OUT_OF_POOL")
        for pol, key in (("positive", "good"), ("negative", "bad")):
            for e in block.get(key) or []:
                conf = str(e.get("confidence", "medium")).lower()
                if conf == "low" or e.get("exclude_from_validation"):
                    continue
                if e.get("year") is None or e.get("month") is None:
                    continue
                row = {
                    "name": name,
                    "pool": pool,
                    "polarity": pol,
                    "year": int(e["year"]),
                    "month": int(e["month"]),
                    "day": int(e["day"]) if e.get("day") is not None else None,
                    "label": e.get("label") or "",
                    "weight": float(e.get("weight", 1.0)),
                    "confidence": conf,
                }
                if row["day"] is not None:
                    row["precision"] = "EXACT_DATE"
                    exact_rows.append(row)
                else:
                    row["precision"] = "MONTH_KNOWN_NO_DAY"
                    month_only_rows.append(row)

    # Primary evaluable: EXACT_DATE in OLD_DEV or FRESH_A_DEV only (no guessing)
    evaluable = [r for r in exact_rows if r["pool"] in ("OLD_DEV", "FRESH_A_DEV")]
    by_subj = defaultdict(lambda: {"pos": 0, "neg": 0, "pool": None})
    for r in evaluable:
        by_subj[r["name"]]["pool"] = r["pool"]
        by_subj[r["name"]]["pos" if r["polarity"] == "positive" else "neg"] += 1

    freeze_payload = {
        "frozen_at": datetime.now().isoformat(timespec="seconds"),
        "rule": "EXACT_DATE only; mapped via live_active_wolwoon; no year-only inference",
        "n_events": len(evaluable),
        "n_positive": sum(1 for r in evaluable if r["polarity"] == "positive"),
        "n_negative": sum(1 for r in evaluable if r["polarity"] == "negative"),
        "n_subjects": len(by_subj),
        "by_pool": {
            "OLD_DEV": {
                "n_events": sum(1 for r in evaluable if r["pool"] == "OLD_DEV"),
                "n_pos": sum(1 for r in evaluable if r["pool"] == "OLD_DEV" and r["polarity"] == "positive"),
                "n_neg": sum(1 for r in evaluable if r["pool"] == "OLD_DEV" and r["polarity"] == "negative"),
                "n_subjects": sum(1 for v in by_subj.values() if v["pool"] == "OLD_DEV"),
            },
            "FRESH_A_DEV": {
                "n_events": sum(1 for r in evaluable if r["pool"] == "FRESH_A_DEV"),
                "n_pos": sum(1 for r in evaluable if r["pool"] == "FRESH_A_DEV" and r["polarity"] == "positive"),
                "n_neg": sum(1 for r in evaluable if r["pool"] == "FRESH_A_DEV" and r["polarity"] == "negative"),
                "n_subjects": sum(1 for v in by_subj.values() if v["pool"] == "FRESH_A_DEV"),
            },
        },
        "subjects": {k: dict(v) for k, v in sorted(by_subj.items())},
        "events": evaluable,
    }
    open(OUT_FREEZE, "w", encoding="utf-8").write(
        json.dumps(freeze_payload, ensure_ascii=False, indent=2) + "\n"
    )

    sparse = (
        freeze_payload["by_pool"]["FRESH_A_DEV"]["n_events"] == 0
        or freeze_payload["n_subjects"] < 20
        or freeze_payload["n_events"] < 80
    )

    audit = {
        "year_only_life_events": year_only_counts,
        "year_only_note": "Cannot assign solar-term month without guessing — excluded from primary Month KPI",
        "month_known_no_day_n": len(month_only_rows),
        "exact_date_n": len(exact_rows),
        "evaluable_freeze": {
            "n_events": freeze_payload["n_events"],
            "n_positive": freeze_payload["n_positive"],
            "n_negative": freeze_payload["n_negative"],
            "n_subjects": freeze_payload["n_subjects"],
            "by_pool": freeze_payload["by_pool"],
            "path": OUT_FREEZE,
        },
        "primary_data_sparse": sparse,
        "sparsity_reasons": [
            x for x in [
                "FRESH_A_DEV has zero exact-dated month events" if freeze_payload["by_pool"]["FRESH_A_DEV"]["n_events"] == 0 else "",
                f"only {freeze_payload['n_subjects']} subjects with month-evaluable events" if freeze_payload["n_subjects"] < 20 else "",
                f"only {freeze_payload['n_events']} exact-dated events" if freeze_payload["n_events"] < 80 else "",
            ] if x
        ],
    }
    return audit, freeze_payload


def write_date_audit_md(audit: Dict[str, Any]) -> None:
    ev = audit["evaluable_freeze"]
    L = [
        "# V2 Month Date Precision Audit",
        "",
        f"**Frozen before scoring:** `{ev['path']}`",
        f"**Measured:** {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Policy",
        "",
        "- Primary Month validation: **EXACT_DATE** only (`year+month+day`).",
        "- Map via `live_active_wolwoon` / solar 節 — no civil-month guessing.",
        "- Year-only life_events: **excluded** (cannot assign Wolwoon without guessing).",
        "- No new people / web labels / post-hoc reinterpretation.",
        "",
        "## Year-only life_events (excluded)",
        "",
        f"- OLD_DEV: n={audit['year_only_life_events']['OLD_DEV']['n']} "
        f"(pos={audit['year_only_life_events']['OLD_DEV']['pos']}, "
        f"neg={audit['year_only_life_events']['OLD_DEV']['neg']})",
        f"- Fresh A: n={audit['year_only_life_events']['FRESH_A_DEV']['n']} "
        f"(pos={audit['year_only_life_events']['FRESH_A_DEV']['pos']}, "
        f"neg={audit['year_only_life_events']['FRESH_A_DEV']['neg']})",
        "",
        "## Existing month_day_labels",
        "",
        f"- EXACT_DATE rows (pre-filter): {audit['exact_date_n']}",
        f"- MONTH_KNOWN_NO_DAY: {audit['month_known_no_day_n']}",
        "",
        "## Frozen month-evaluable development subset",
        "",
        f"- n events: **{ev['n_events']}**",
        f"- n positive: **{ev['n_positive']}**",
        f"- n negative: **{ev['n_negative']}**",
        f"- n subjects: **{ev['n_subjects']}**",
        f"- OLD_DEV: {ev['by_pool']['OLD_DEV']}",
        f"- Fresh A: {ev['by_pool']['FRESH_A_DEV']}",
        "",
        f"**Primary data sparse:** {audit['primary_data_sparse']}",
    ]
    for r in audit["sparsity_reasons"]:
        L.append(f"- {r}")
    L += [
        "",
        "Do **not** manufacture a Month accuracy claim if sparse.",
        "",
    ]
    open(OUT_AUDIT, "w", encoding="utf-8").write("\n".join(L))


# ══════════════════════════════════════════════
# V2_DY_B Y_parent maps (historical civil-year keys)
# ══════════════════════════════════════════════

def build_y_maps(packs: List[dict]) -> Dict[str, Dict[int, Dict[str, float]]]:
    """name -> civil_year -> {Y, D, annual_dev, pillar}."""
    all_block_rows = []
    pack_blocks = {}
    for pack in packs:
        bf = DY._block_feats(pack)
        pack_blocks[pack["name"]] = bf
        all_block_rows.extend(bf.values())
    z_keys = [
        "fav_minus_unfav", "struct_activ", "struct_disrupt", "struct_excess",
    ]
    z_params = {k: DY._robust_params([float(r[k]) for r in all_block_rows]) for k in z_keys}

    def zf(row, k):
        return DY._z_clip(row[k], *z_params[k])

    D_map = {}
    for pack in packs:
        for pillar, f in pack_blocks[pack["name"]].items():
            h_b = (
                0.45 * zf(f, "fav_minus_unfav")
                + 0.35 * zf(f, "struct_activ")
                - 0.35 * zf(f, "struct_disrupt")
                - 0.15 * zf(f, "struct_excess")
            )
            D_map[(pack["name"], pillar)] = DY._clamp(BASE + 3.0 * h_b)

    cfg = dict(arm_b.ARM_B_CONFIG)
    out: Dict[str, Dict[int, Dict[str, float]]] = {}
    for pack in packs:
        gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
        by_p = defaultdict(list)
        for y, m in pack["meta"].items():
            p = str(m.get("대운_pillar") or "_")
            if (pack["name"], p) not in D_map:
                continue
            by_p[p].append(gmap[int(y)])
        med = {p: float(np.median(vs)) for p, vs in by_p.items()}
        ymap = {}
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            if (pack["name"], pillar) not in D_map:
                continue
            a = gmap[int(y)] - med[pillar]
            d = float(D_map[(pack["name"], pillar)])
            flags = DY._ilju_flags(m)
            tg = DY._tg_career(m)
            trigger = (
                1.2 * flags["year_hap"]
                - 1.5 * flags["year_chung"]
                - 1.0 * flags["year_hyung"]
                - 0.8 * flags["year_pa_hae"]
                + 0.4 * tg
            )
            annual_dev = 0.65 * a + 0.35 * trigger
            ymap[int(y)] = {
                "Y": DY._clamp(d + annual_dev),
                "D": d,
                "A": a,
                "annual_dev": annual_dev,
                "trigger": trigger,
                "pillar": pillar,
            }
        out[pack["name"]] = ymap
    return out


# ══════════════════════════════════════════════
# MONTH FEATURES (no new astrology families)
# ══════════════════════════════════════════════

FEATURE_AUDIT = [
    {"feature": "month_yongshin_fit_net", "class": "NEW_MONTH_INFORMATION",
     "note": "Month-pillar yongshin fit; not G_CLEAN_AXIS year breakdown"},
    {"feature": "month_fav_unfav_supply", "class": "RELATED_BUT_DIFFERENT_TIMESCALE",
     "note": "Same fav/unfav concept as D, applied to month pillar"},
    {"feature": "month_natal_relations_contextual", "class": "NEW_MONTH_INFORMATION",
     "note": "Month↔natal timing; valence contextualized by fit — not fixed 합+/충−"},
    {"feature": "month_sewoon_relations_contextual", "class": "NEW_MONTH_INFORMATION",
     "note": "PRIMARY short-term axis Month↔Sewoon"},
    {"feature": "month_daewoon_relations_contextual", "class": "RELATED_BUT_DIFFERENT_TIMESCALE",
     "note": "M2 only; excluded when redundant with Y_parent/Sewoon flags"},
    {"feature": "event_intensity", "class": "NEW_MONTH_INFORMATION",
     "note": "Explanation/diagnostic only — NOT added into MonthlyDev valence"},
    {"feature": "G_CLEAN_AXIS", "class": "ALREADY_IN_Y", "note": "Excluded from MonthlyDev"},
    {"feature": "B_trigger", "class": "ALREADY_IN_Y", "note": "Excluded from MonthlyDev"},
    {"feature": "legacy_month_종합", "class": "DUPLICATE", "note": "Reference only — not in M1/M2"},
]


def _natal_ctx(r: dict) -> Dict[str, Any]:
    yong = r.get("용신") or {}
    yong_e = yong.get("용신_오행") or ""
    hee = set(yong.get("희신_오행") or [])
    gi = set(yong.get("기신_오행") or [])
    fav = {yong_e} | hee - {""}
    unfav = gi - {""}
    o = r.get("원국") or {}
    stems = [o[k][0] for k in ("year", "month", "day", "hour") if k in o]
    branches = [o[k][1] for k in ("year", "month", "day", "hour") if k in o]
    day_stem = o.get("day", ["", ""])[0]
    day_branch = o.get("day", ["", ""])[1]
    return {
        "yong": yong, "fav": fav, "unfav": unfav,
        "stems": stems, "branches": branches,
        "day_stem": day_stem, "day_branch": day_branch,
        "year_branch": o.get("year", ["", ""])[1],
    }


def _month_raw_parts(
    *,
    m_stem: str,
    m_branch: str,
    sw_stem: str,
    sw_branch: str,
    dw_stem: str,
    dw_branch: str,
    ctx: Dict[str, Any],
    include_daewoon: bool,
) -> Dict[str, Any]:
    yong = ctx["yong"]
    ds = ctx["day_stem"]
    yfit = {}
    try:
        yfit = se._check_yongshin_fit(m_stem, m_branch, yong, ds) if ds and yong else {}
    except Exception:
        yfit = {}
    yong_f = float(yfit.get("용신부합") or 0)
    hee_f = float(yfit.get("희신부합") or 0)
    gi_f = float(yfit.get("기신부합") or 0)
    gu_f = float(yfit.get("구신부합") or 0)
    fit_net = (yong_f + hee_f) - (gi_f + gu_f)

    stem_e = se.STEM_ELEMENT.get(m_stem, "")
    branch_e = se.BRANCH_ELEMENT_MAIN.get(m_branch, "")
    fav_s = 1.0 if (stem_e in ctx["fav"] or branch_e in ctx["fav"]) else 0.0
    unfav_s = 1.0 if (stem_e in ctx["unfav"] or branch_e in ctx["unfav"]) else 0.0
    supply = fav_s - unfav_s

    # Month ↔ natal
    rel_n = se._calc_incoming_relations(m_stem, m_branch, ctx["stems"], ctx["branches"])
    tn = _rel_text(rel_n)
    fn = _rel_flags(tn)
    # contextual: 합 supports when fav/fit positive; 충 pressures when unfav/fit negative
    natal_rel = (
        (fn["hap"] - fn["chung"]) * (0.5 + 0.5 * np.sign(fit_net + 1e-9) * max(abs(fit_net), 0.2))
        - 0.6 * fn["hyung"]
        - 0.5 * (fn["pa"] + fn["hae"])
    )
    # day-pillar emphasis
    ilju = se._calc_sewoon_ilju_relation(m_stem, m_branch, ds, ctx["day_branch"])
    ti = _rel_text(ilju)
    fi = _rel_flags(ti)
    natal_rel += 0.35 * (fi["hap"] - fi["chung"]) * (1.0 if fit_net >= 0 else -1.0)

    # Month ↔ Sewoon (PRIMARY)
    rel_s = se._calc_two_pillar_relations(m_stem, m_branch, sw_stem, sw_branch)
    ts = _rel_text(rel_s)
    fs = _rel_flags(ts)
    sw_rel = (
        (fs["hap"] - fs["chung"]) * (0.6 + 0.4 * supply)
        - 0.5 * fs["hyung"]
        - 0.4 * (fs["pa"] + fs["hae"])
    )

    natal_struct = 0.55 * fit_net + 0.45 * supply
    rel_timing = 0.45 * natal_rel + 0.55 * sw_rel

    raw_m1 = (
        W["natal_struct"] * natal_struct
        + W["month_sewoon"] * sw_rel
        + W["rel_timing"] * natal_rel
    )

    dw_rel = 0.0
    dw_used = False
    td = ""
    fd = {"hap": 0.0, "chung": 0.0, "hyung": 0.0, "pa": 0.0, "hae": 0.0}
    if include_daewoon:
        rel_d = se._calc_two_pillar_relations(m_stem, m_branch, dw_stem, dw_branch)
        td = _rel_text(rel_d)
        fd = _rel_flags(td)
        # Non-redundant: only if Month↔Daewoon flags differ from Month↔Sewoon
        if any(fd[k] != fs[k] for k in fd):
            dw_rel = (
                (fd["hap"] - fd["chung"]) * (0.5 + 0.5 * supply)
                - 0.45 * fd["hyung"]
                - 0.35 * (fd["pa"] + fd["hae"])
            )
            dw_used = True

    raw_m2 = raw_m1 + (W["month_daewoon_m2"] * dw_rel if dw_used else 0.0)

    intensity = _event_intensity({
        "hap": max(fn["hap"], fs["hap"], fd["hap"]),
        "chung": max(fn["chung"], fs["chung"], fd["chung"]),
        "hyung": max(fn["hyung"], fs["hyung"], fd["hyung"]),
        "pa": max(fn["pa"], fs["pa"], fd["pa"]),
        "hae": max(fn["hae"], fs["hae"], fd["hae"]),
    })

    tg_stem = se.ten_god(ds, m_stem) if ds else ""
    tg_br = se.branch_main_tg(ds, m_branch) if ds else ""

    return {
        "raw_m1": float(raw_m1),
        "raw_m2": float(raw_m2),
        "fit_net": float(fit_net),
        "supply": float(supply),
        "natal_rel": float(natal_rel),
        "sw_rel": float(sw_rel),
        "dw_rel": float(dw_rel),
        "dw_used": dw_used,
        "intensity": float(intensity),
        "tg_stem": tg_stem,
        "tg_branch": tg_br,
        "rel_natal": tn,
        "rel_sewoon": ts,
        "rel_daewoon": td,
        "yfit": {"용": yong_f, "희": hee_f, "기": gi_f, "구": gu_f},
        "NUMERIC_SCORE_DRIVER": ["fit_net", "supply", "natal_rel", "sw_rel"]
        + (["dw_rel"] if dw_used else []),
        "EXPLANATION_ONLY": ["intensity", "tg_stem", "tg_branch", "rel_texts"],
    }


def build_subject_months(
    pack: dict,
    ymap: Dict[int, Dict[str, float]],
    years: Optional[List[int]] = None,
) -> Dict[Tuple[int, int], Dict[str, Any]]:
    """
    Key: (lichun_year, month_index 1..12) -> month layer dict.
    Y_parent from ymap[lichun_year] (LIVE_MONTH_PARENT_CONTEXT).
    """
    r = pack["r"]
    dw = pack["dw"]
    ctx = _natal_ctx(r)
    if years is None:
        years = sorted(ymap.keys())
    # Limit span for speed: birth..birth+90 intersecting ymap
    birth_y = int((r.get("입력") or {}).get("년") or min(ymap))
    years = [y for y in years if birth_y - 1 <= y <= birth_y + 95 and y in ymap]

    out: Dict[Tuple[int, int], Dict[str, Any]] = {}
    raws_m1: Dict[int, List[float]] = defaultdict(list)
    raws_m2: Dict[int, List[float]] = defaultdict(list)
    keyed: Dict[int, List[Tuple[int, Dict[str, Any]]]] = defaultdict(list)

    for ey in years:
        # mid-year proxy inside 立春 year
        mid = se.ipchun(ey) + timedelta(days=180)
        months = se.build_wolwoon(mid)
        sw = se.live_active_sewoon(mid)
        assert sw["year"] == ey
        sw_gz = sw["ganzhi"]
        sw_stem, sw_branch = sw_gz[0], sw_gz[1]
        dw_blk = se.live_active_daewoon(dw, mid) or {}
        dw_stem = dw_blk.get("stem") or (dw_blk.get("daewoon_pillar") or dw_blk.get("ganzhi") or "甲子")[0]
        dw_branch = dw_blk.get("branch") or (dw_blk.get("daewoon_pillar") or dw_blk.get("ganzhi") or "甲子")[1]
        yp = ymap.get(ey)
        if not yp:
            continue
        for m in months:
            mi = int(m["month_index"])
            gz = m["ganzhi"]
            parts = _month_raw_parts(
                m_stem=gz[0], m_branch=m["branch"],
                sw_stem=sw_stem, sw_branch=sw_branch,
                dw_stem=dw_stem, dw_branch=dw_branch,
                ctx=ctx, include_daewoon=True,
            )
            row = {
                "lichun_year": ey,
                "month_index": mi,
                "branch": m["branch"],
                "ganzhi": gz,
                "start": m["start"],
                "end": m["end"],
                "Y_parent": float(yp["Y"]),
                "D_parent": float(yp["D"]),
                "annual_dev": float(yp["annual_dev"]),
                "sewoon_gz": sw_gz,
                "daewoon_pillar": dw_blk.get("daewoon_pillar") or dw_blk.get("ganzhi"),
                **parts,
            }
            keyed[ey].append((mi, row))
            raws_m1[ey].append(parts["raw_m1"])
            raws_m2[ey].append(parts["raw_m2"])

    # center within each lichun year + apply amps
    for ey, items in keyed.items():
        med1 = float(np.median(raws_m1[ey])) if raws_m1[ey] else 0.0
        med2 = float(np.median(raws_m2[ey])) if raws_m2[ey] else 0.0
        for mi, row in items:
            c1 = row["raw_m1"] - med1
            c2 = row["raw_m2"] - med2
            row["center_m1"] = med1
            row["center_m2"] = med2
            row["centered_m1"] = c1
            row["centered_m2"] = c2
            for amp_name, amp in AMP.items():
                row[f"MonthlyDev_M1_{amp_name}"] = amp * c1
                row[f"MonthlyDev_M2_{amp_name}"] = amp * c2
                row[f"M_M1_{amp_name}"] = _clamp(row["Y_parent"] + amp * c1)
                row[f"M_M2_{amp_name}"] = _clamp(row["Y_parent"] + amp * c2)
            out[(ey, mi)] = row
    return out


def map_event_to_month(ev: dict, months: Dict[Tuple[int, int], Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    dt = datetime(int(ev["year"]), int(ev["month"]), int(ev["day"]), 12, 0, tzinfo=se.KST)
    sw = se.live_active_sewoon(dt)
    ww = se.live_active_wolwoon(dt)
    key = (int(sw["year"]), int(ww["month_index"]))
    row = months.get(key)
    if not row:
        # build on the fly not available — skip
        return None
    return {
        "event": ev,
        "at": dt.isoformat(),
        "lichun_year": sw["year"],
        "month_index": ww["month_index"],
        "month_branch": ww["branch"],
        "row": row,
        "key": key,
    }


def adjacent_keys(key: Tuple[int, int]) -> List[Tuple[int, int]]:
    ey, mi = key
    out = [key]
    if mi > 1:
        out.append((ey, mi - 1))
    else:
        out.append((ey - 1, 12))
    if mi < 12:
        out.append((ey, mi + 1))
    else:
        out.append((ey + 1, 1))
    return out


# ══════════════════════════════════════════════
# EVALUATION
# ══════════════════════════════════════════════

def eval_timing(
    mapped: List[Dict[str, Any]],
    cand: str,
    amp: str,
) -> Dict[str, Any]:
    """cand in M1/M2; amp in AMP keys."""
    dev_key = f"MonthlyDev_{cand}_{amp}"
    score_key = f"M_{cand}_{amp}"
    pos_dev, neg_dev = [], []
    pos_pct, neg_pct = [], []
    exact_hits = []
    window_hits = []
    by_subj = defaultdict(lambda: {"pos": [], "neg": []})

    # within-year percentiles need all months of that year — use row's year siblings via mapped cache
    year_devs: Dict[Tuple[str, int], List[float]] = defaultdict(list)
    # filled externally? we compute percentile among 12 months of that lichun year from row fields
    # For percentile of event month: need all 12 MonthlyDev — store on row via precompute

    for m in mapped:
        row = m["row"]
        name = m["event"]["name"]
        pol = m["event"]["polarity"]
        dev = float(row[dev_key])
        # percentile: compare to 12 months — use centered*amp siblings if present on row._year_devs
        yd = row.get("_year_devs", {}).get(dev_key)
        if yd and len(yd) >= 12:
            pct = sum(1 for x in yd if x <= dev) / len(yd)
        else:
            pct = float("nan")
        if pol == "positive":
            pos_dev.append(dev)
            if pct == pct:
                pos_pct.append(pct)
            by_subj[name]["pos"].append(dev)
            exact_hits.append(1.0 if dev > 0 else 0.0)
        else:
            neg_dev.append(dev)
            if pct == pct:
                neg_pct.append(pct)
            by_subj[name]["neg"].append(dev)
            exact_hits.append(1.0 if dev < 0 else 0.0)

        # ±1 window: best directional month among adjacent
        best = None
        for k in adjacent_keys(m["key"]):
            # need sibling row — stored in m["adj_rows"]
            pass
        adj = m.get("adj_devs", {}).get(dev_key) or [dev]
        if pol == "positive":
            window_hits.append(1.0 if max(adj) > 0 else 0.0)
        else:
            window_hits.append(1.0 if min(adj) < 0 else 0.0)

    def _mean(xs):
        return None if not xs else round(float(np.mean(xs)), 4)

    sep = None
    if pos_dev and neg_dev:
        sep = round(float(np.mean(pos_dev) - np.mean(neg_dev)), 4)

    subj_rows = []
    for name, d in by_subj.items():
        if d["pos"] and d["neg"]:
            subj_rows.append({
                "name": name,
                "pos_mean_dev": round(float(np.mean(d["pos"])), 4),
                "neg_mean_dev": round(float(np.mean(d["neg"])), 4),
                "sep": round(float(np.mean(d["pos"]) - np.mean(d["neg"])), 4),
                "hit": 1 if np.mean(d["pos"]) > np.mean(d["neg"]) else 0,
            })

    return {
        "n_events": len(mapped),
        "n_pos": len(pos_dev),
        "n_neg": len(neg_dev),
        "exact_direction_hit": _mean(exact_hits),
        "window_pm1_hit": _mean(window_hits),
        "pos_mean_MonthlyDev": _mean(pos_dev),
        "neg_mean_MonthlyDev": _mean(neg_dev),
        "pos_neg_sep": sep,
        "pos_mean_percentile": _mean(pos_pct),
        "neg_mean_percentile": _mean(neg_pct),
        "subject_hit_rate": None if not subj_rows else round(
            sum(r["hit"] for r in subj_rows) / len(subj_rows), 4
        ),
        "subjects": subj_rows,
    }


def eval_hierarchy(all_months: List[Dict[str, Any]], cand: str, amp: str, ymaps) -> Dict[str, Any]:
    dev_key = f"MonthlyDev_{cand}_{amp}"
    score_key = f"M_{cand}_{amp}"
    devs, annuals, ranges, medians, jumps, crosses = [], [], [], [], [], 0
    sat = 0
    n_m = 0
    by_year_ok = 0
    by_year_n = 0
    # group by (name, lichun_year)
    groups = defaultdict(list)
    for row in all_months:
        groups[(row["_name"], row["lichun_year"])].append(row)

    hard_d_fav_m = fav_d_hard_m = hard_y_fav_m = fav_y_hard_m = 0
    n_years_checked = 0

    for (name, ey), rows in groups.items():
        if len(rows) != 12:
            continue
        by_year_n += 1
        rows = sorted(rows, key=lambda r: r["month_index"])
        ds = [float(r[dev_key]) for r in rows]
        med = float(np.median(ds))
        medians.append(abs(med))
        if abs(med) < 0.15:
            by_year_ok += 1
        devs.extend(ds)
        ranges.append(max(ds) - min(ds))
        for i in range(11):
            jumps.append(abs(ds[i + 1] - ds[i]))
        yp = float(rows[0]["Y_parent"])
        annuals.append(abs(float(rows[0]["annual_dev"])))
        for r in rows:
            n_m += 1
            mscore = float(r[score_key])
            if mscore <= 0.5 or mscore >= 99.5:
                sat += 1
            if (r[dev_key] > 0 and yp < BASE) or (r[dev_key] < 0 and yp > BASE):
                crosses += 1
        # hierarchy QA flags (do not modify D/Y)
        d_parent = float(rows[0]["D_parent"])
        n_years_checked += 1
        if d_parent < BASE - 1 and max(ds) > 0.5:
            hard_d_fav_m += 1
        if d_parent > BASE + 1 and min(ds) < -0.5:
            fav_d_hard_m += 1
        if yp < BASE - 1 and max(ds) > 0.5:
            hard_y_fav_m += 1
        if yp > BASE + 1 and min(ds) < -0.5:
            fav_y_hard_m += 1

    def pct(xs, p):
        return None if not xs else round(float(np.percentile(xs, p)), 4)

    abs_d = [abs(x) for x in devs]
    month_p90 = pct(abs_d, 90) or 0
    ann_p90 = pct(annuals, 90) or 1e-6
    return {
        "n_complete_years": by_year_n,
        "frac_median_abs_lt_0.15": None if not by_year_n else round(by_year_ok / by_year_n, 4),
        "median_MonthlyDev_abs_mean": pct(medians, 50),
        "abs_MonthlyDev_p50": pct(abs_d, 50),
        "abs_MonthlyDev_p75": pct(abs_d, 75),
        "abs_MonthlyDev_p90": pct(abs_d, 90),
        "abs_MonthlyDev_p95": pct(abs_d, 95),
        "abs_MonthlyDev_max": None if not abs_d else round(float(np.max(abs_d)), 4),
        "abs_annual_dev_p50": pct(annuals, 50),
        "abs_annual_dev_p90": pct(annuals, 90),
        "month_over_annual_p90_ratio": round(month_p90 / ann_p90, 4) if ann_p90 else None,
        "frac_cross_Y_parent": None if not n_m else round(crosses / n_m, 4),
        "saturation_frac": None if not n_m else round(sat / n_m, 4),
        "within_year_range_p50": pct(ranges, 50),
        "adj_jump_p50": pct(jumps, 50),
        "adj_jump_p90": pct(jumps, 90),
        "hierarchy_qa": {
            "years_with_fav_month_in_hard_D": hard_d_fav_m,
            "years_with_hard_month_in_fav_D": fav_d_hard_m,
            "years_with_fav_month_in_hard_Y": hard_y_fav_m,
            "years_with_hard_month_in_fav_Y": fav_y_hard_m,
            "n_years": n_years_checked,
            "note": "D/Y crossing asymmetry from closure audit NOT modified; Month-only observation",
        },
    }


def select_winner(results: Dict[str, Any], sparse: bool) -> Tuple[str, str, str]:
    """
    Returns (status, winner_key, reason).
    winner_key like M1_BALANCED.
    """
    # hierarchy filters
    ok = {}
    for key, res in results.items():
        h = res["hierarchy"]
        med_ok = h.get("frac_median_abs_lt_0.15")
        ratio = h.get("month_over_annual_p90_ratio")
        sat = h.get("saturation_frac")
        p90 = h.get("abs_MonthlyDev_p90")
        if med_ok is None or med_ok < 0.85:
            continue
        if ratio is None or ratio > 1.25:
            continue
        if sat is None or sat > 0.02:
            continue
        if p90 is None or p90 < 0.3:
            continue  # imperceptible
        ok[key] = res

    if not ok:
        return "V2_MONTH_NOT_READY", "", "no candidate passed hierarchy gates"

    def h_amp_penalty(r):
        return r["hierarchy"].get("month_over_annual_p90_ratio") or 0

    def rank(k):
        r = ok[k]
        t = r["timing"]
        cand, amp = k.split("_", 1)
        simp = 2 if cand == "M1" else 1
        # Prefer smaller amplitude — do not win on larger swings alone.
        # exact_direction_hit is amp-invariant for positive scales.
        amp_rank = {"CONSERVATIVE": 3, "BALANCED": 2, "EXPRESSIVE": 1}[amp]
        return (
            t.get("exact_direction_hit") or 0,
            t.get("subject_hit_rate") or 0,
            simp,
            amp_rank,
            t.get("pos_neg_sep") or -99,
            -h_amp_penalty(r),
        )

    winner = max(ok.keys(), key=rank)
    tw = ok[winner]["timing"]
    credible = (
        not sparse
        and (tw.get("n_events") or 0) >= 80
        and (tw.get("exact_direction_hit") or 0) >= 0.55
        and (tw.get("pos_neg_sep") or 0) > 0
        and (tw.get("subject_hit_rate") or 0) >= 0.55
    )
    if credible:
        return "V2_MONTH_READY_TO_FREEZE", winner, "timing+hierarchy pass"
    return (
        "V2_MONTH_TIMING_ONLY",
        winner,
        "hierarchy/coherence pass but exact-date data insufficient for accuracy claim "
        f"(sparse={sparse}, n={tw.get('n_events')}, hit={tw.get('exact_direction_hit')}, sep={tw.get('pos_neg_sep')})",
    )


# ══════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════

def main() -> int:
    print("══════════ V2 MONTH (Phase 3) ══════════")
    freeze_labels = json.load(open(OUT_LABELS, encoding="utf-8"))
    val_b = set(freeze_labels["validation_b"])

    print("── date precision audit (before scoring) ──")
    audit, eval_freeze = date_precision_audit(val_b)
    write_date_audit_md(audit)
    print(
        f"  evaluable events={eval_freeze['n_events']} "
        f"subj={eval_freeze['n_subjects']} sparse={audit['primary_data_sparse']}"
    )

    print("── pack OLD (+ FA for Y maps; FA has no month labels) ──")
    old_packs, fresh_packs, val_b2 = DY._load_pools(freeze_labels)
    assert not (val_b & {p["name"] for p in old_packs + fresh_packs})
    # Need packs for evaluable subjects
    need = set(eval_freeze["subjects"])
    packs_by_name = {p["name"]: p for p in old_packs}
    missing = [n for n in need if n not in packs_by_name]
    if missing:
        print("  WARNING missing packs", missing)

    use_packs = [packs_by_name[n] for n in sorted(need) if n in packs_by_name]
    # Also need Y calibration z-params from full OLD+FA development (label-free D feats)
    print("── V2_DY_B Y_parent maps ──")
    y_all = build_y_maps(old_packs + fresh_packs)
    ymaps = {n: y_all[n] for n in need if n in y_all}

    print("── build months ──")
    months_by_subj: Dict[str, Dict[Tuple[int, int], Dict[str, Any]]] = {}
    # years: union of event lichun years + sample of ymap years for hierarchy
    for name, pack in [(n, packs_by_name[n]) for n in sorted(need) if n in packs_by_name]:
        evs = [e for e in eval_freeze["events"] if e["name"] == name]
        ey_set = set()
        for e in evs:
            dt = datetime(e["year"], e["month"], e["day"], 12, tzinfo=se.KST)
            ey_set.add(se.live_active_sewoon_year(dt))
        # hierarchy sample: every 2nd year in ymap within life span
        ys = sorted(ymaps[name].keys())
        sample = set(ys[::2][:50]) | ey_set
        # ensure neighbors for ±1 window
        for ey in list(ey_set):
            sample.add(ey - 1)
            sample.add(ey + 1)
        sample = {y for y in sample if y in ymaps[name]}
        mm = build_subject_months(pack, ymaps[name], years=sorted(sample))
        # attach year dev lists for percentiles
        by_ey = defaultdict(list)
        for (ey, mi), row in mm.items():
            row["_name"] = name
            by_ey[ey].append(row)
        for ey, rows in by_ey.items():
            for amp in AMP:
                for cand in ("M1", "M2"):
                    key = f"MonthlyDev_{cand}_{amp}"
                    vals = [float(r[key]) for r in rows]
                    for r in rows:
                        r.setdefault("_year_devs", {})[key] = vals
        months_by_subj[name] = mm
        print(f"  {name}: months={len(mm)} years≈{len(by_ey)}")

    print("── map events ──")
    mapped = []
    for e in eval_freeze["events"]:
        mm = months_by_subj.get(e["name"])
        if not mm:
            continue
        m = map_event_to_month(e, mm)
        if not m:
            continue
        # adjacent MonthlyDevs
        adj = {}
        for amp in AMP:
            for cand in ("M1", "M2"):
                key = f"MonthlyDev_{cand}_{amp}"
                vals = []
                for k in adjacent_keys(m["key"]):
                    if k in mm:
                        vals.append(float(mm[k][key]))
                adj[key] = vals or [float(m["row"][key])]
        m["adj_devs"] = adj
        mapped.append(m)
    print(f"  mapped={len(mapped)}/{eval_freeze['n_events']}")

    # reference legacy (optional diagnostic on mapped events only)
    print("── evaluate candidates ──")
    results = {}
    all_month_rows = []
    for rows in months_by_subj.values():
        all_month_rows.extend(rows.values())

    for cand in ("M1", "M2"):
        for amp in AMP:
            key = f"{cand}_{amp}"
            timing = eval_timing(mapped, cand, amp)
            hier = eval_hierarchy(all_month_rows, cand, amp, ymaps)
            results[key] = {
                "candidate": "V2_MONTH_LOCAL" if cand == "M1" else "V2_MONTH_CONTEXTUAL",
                "cand_code": cand,
                "amplitude": amp,
                "amp_value": AMP[amp],
                "timing": timing,
                "hierarchy": hier,
            }
            print(
                f"  {key}: exact_hit={timing['exact_direction_hit']} "
                f"sep={timing['pos_neg_sep']} med0={hier['frac_median_abs_lt_0.15']} "
                f"m/a={hier['month_over_annual_p90_ratio']}"
            )

    status, winner, reason = select_winner(results, audit["primary_data_sparse"])

    # Traceability samples
    traces = []
    for m in mapped[:8] + mapped[-4:]:
        row = m["row"]
        cand, amp = (winner.split("_", 1) if winner else ("M1", "BALANCED"))
        traces.append({
            "name": m["event"]["name"],
            "label": m["event"]["label"],
            "polarity": m["event"]["polarity"],
            "at": m["at"],
            "Y_parent": row["Y_parent"],
            "month_pillar": row["ganzhi"],
            "natal_interactions": row["rel_natal"],
            "sewoon_interactions": row["rel_sewoon"],
            "daewoon_interactions": row["rel_daewoon"] if cand == "M2" else "N/A (M1)",
            "ten_god": {"stem": row["tg_stem"], "branch": row["tg_branch"]},
            "directional_valence_evidence": {
                "fit_net": row["fit_net"],
                "supply": row["supply"],
                "natal_rel": row["natal_rel"],
                "sw_rel": row["sw_rel"],
                "dw_rel": row["dw_rel"] if cand == "M2" else 0.0,
            },
            "event_intensity": row["intensity"],
            "raw_month_signal": row["raw_m1"] if cand == "M1" else row["raw_m2"],
            "centering_adjustment": row["center_m1"] if cand == "M1" else row["center_m2"],
            "MonthlyDev": row[f"MonthlyDev_{cand}_{amp}"],
            "final_M": row[f"M_{cand}_{amp}"],
            "NUMERIC_SCORE_DRIVER": row["NUMERIC_SCORE_DRIVER"],
            "EXPLANATION_ONLY": row["EXPLANATION_ONLY"],
        })

    # Foundation check: calendar still coherent on a probe
    foundation_ok = True
    try:
        for y in (2024, 2025):
            ww = se.build_wolwoon(datetime(y, 6, 15, tzinfo=se.KST))
            assert len(ww) == 12
            zi = ww[10]
            assert _parse_iso(zi["end"]) > _parse_iso(zi["start"])
            ip = se.ipchun(y)
            assert se.live_active_sewoon(ip - timedelta(hours=1))["year"] == y - 1
    except Exception:
        foundation_ok = False
        status = "V2_MONTH_FOUNDATION_ISSUE"
        reason = "calendar/live hierarchy probe failed"

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_MONTH",
        "validation_b_scored": False,
        "production_scoring_modified": False,
        "parent": "V2_DY_B",
        "composition": "M = clamp(Y_parent + MonthlyDev)",
        "policies": {
            "HISTORICAL_DY_VALIDATION": "civil year",
            "LIVE_MONTH_PARENT_CONTEXT": "立春 Sewoon",
            "month_boundary": "solar 節",
        },
        "date_precision_audit": audit,
        "feature_duplication_audit": FEATURE_AUDIT,
        "amplitudes": AMP,
        "weights": W,
        "results": results,
        "winner": winner,
        "status": status,
        "status_reason": reason,
        "mapped_events_n": len(mapped),
        "traces_sample": traces,
        "hashes": {
            "experiment_v2_month.py": _sha16(__file__),
            "month_day_labels.json": _sha16(MD.LABELS_PATH),
            "V2_MONTH_EVALUABLE_FREEZE.json": _sha16(OUT_FREEZE),
        },
        "dy_qa_flag": {
            "good_year_in_hard_D_crossing_was_0": True,
            "month_observation": results.get(winner, {}).get("hierarchy", {}).get("hierarchy_qa") if winner else None,
            "action": "revisit in Full Hierarchy QA / blind user QA; D/Y untouched",
        },
    }

    open(OUT_SNAP, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n"
    )
    write_report(payload)
    write_attribution(payload, FEATURE_AUDIT)

    print("══════════ STATUS ══════════")
    print(status)
    print("winner", winner, reason)
    print(f"→ {OUT_SNAP}")
    return 0


def write_report(p: Dict[str, Any]) -> None:
    L = [
        "# V2 Month Report",
        "",
        f"**Status:** `{p['status']}`",
        f"**Winner:** `{p['winner']}`",
        f"**Reason:** {p['status_reason']}",
        f"**Measured:** {p['measured_at']}",
        "",
        "## Parent",
        "",
        "- Numeric D/Y frozen: `V2_DY_B`",
        "- `M = clamp(Y_parent + MonthlyDev)`",
        "- `Y_parent` from LIVE 立春 Sewoon year (not rewriting historical civil-year DY metrics)",
        "",
        "## Date precision",
        "",
        f"- Evaluable exact-dated events: {p['date_precision_audit']['evaluable_freeze']['n_events']}",
        f"- Subjects: {p['date_precision_audit']['evaluable_freeze']['n_subjects']}",
        f"- Fresh A exact-dated: {p['date_precision_audit']['evaluable_freeze']['by_pool']['FRESH_A_DEV']['n_events']}",
        f"- Sparse: {p['date_precision_audit']['primary_data_sparse']}",
        "",
        "## Candidates",
        "",
        "| key | exact_hit | sep | subj_hit | window±1 | med≈0 | |M|p90 | m/ann p90 | sat |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for k, r in p["results"].items():
        t, h = r["timing"], r["hierarchy"]
        L.append(
            f"| {k} | {t.get('exact_direction_hit')} | {t.get('pos_neg_sep')} | "
            f"{t.get('subject_hit_rate')} | {t.get('window_pm1_hit')} | "
            f"{h.get('frac_median_abs_lt_0.15')} | {h.get('abs_MonthlyDev_p90')} | "
            f"{h.get('month_over_annual_p90_ratio')} | {h.get('saturation_frac')} |"
        )
    L += [
        "",
        "## Selection policy",
        "",
        "- Prefer timing evidence when credible; else conservative structural TIMING_ONLY.",
        "- Do not choose merely for larger swings.",
        "- No dense weight search; amplitudes predeclared.",
        "",
        "## Hierarchy QA (Month observation; D/Y untouched)",
        "",
    ]
    w = p["results"].get(p["winner"] or "", {})
    hq = (w.get("hierarchy") or {}).get("hierarchy_qa") or {}
    L.append(f"- {json.dumps(hq, ensure_ascii=False)}")
    L += [
        "",
        "## Hard stop",
        "",
        "- Validation B sealed",
        "- Day not built",
        "- D/Y not redesigned",
        "- Production scoring untouched",
        "",
        f"**Final:** `{p['status']}`",
        "",
    ]
    open(OUT_REPORT, "w", encoding="utf-8").write("\n".join(L))


def write_attribution(p: Dict[str, Any], feat_audit: List[dict]) -> None:
    L = [
        "# V2 Month Attribution",
        "",
        f"**Winner:** `{p['winner']}` · **Status:** `{p['status']}`",
        "",
        "## Feature duplication audit",
        "",
        "| feature | class | note |",
        "|---|---|---|",
    ]
    for f in feat_audit:
        L.append(f"| {f['feature']} | {f['class']} | {f['note']} |")
    L += [
        "",
        "## Trace samples (NUMERIC vs EXPLANATION)",
        "",
    ]
    for t in p.get("traces_sample") or []:
        L += [
            f"### {t['name']} — {t['polarity']} — {t['label']}",
            f"- at: {t['at']}",
            f"- Y_parent: {t['Y_parent']}",
            f"- month: {t['month_pillar']}",
            f"- MonthlyDev → M: {t['MonthlyDev']} → {t['final_M']}",
            f"- raw / center: {t['raw_month_signal']} / {t['centering_adjustment']}",
            f"- valence evidence: {t['directional_valence_evidence']}",
            f"- event_intensity (explanation-only): {t['event_intensity']}",
            f"- NUMERIC_SCORE_DRIVER: {t['NUMERIC_SCORE_DRIVER']}",
            f"- EXPLANATION_ONLY: {t['EXPLANATION_ONLY']}",
            f"- natal: {t['natal_interactions']}",
            f"- sewoon: {t['sewoon_interactions']}",
            f"- daewoon: {t['daewoon_interactions']}",
            "",
        ]
    open(OUT_ATTR, "w", encoding="utf-8").write("\n".join(L))


if __name__ == "__main__":
    sys.exit(main())
