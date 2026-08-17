# -*- coding: utf-8 -*-
"""
Blind 4-person retrospective QA — engine data generation only.

Frozen stack: V2_DY_B. z-params from OLD_DEV + Fresh A only.
Does not load/score Validation B. Does not tune. Does not use life history.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_ROOT = os.path.dirname(_TEST)
_EXP = os.path.join(_TEST, "experiments")
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _EXP)

import saju_engine as se  # noqa: E402
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS  # noqa: E402
from experiments.validate_v2_b_one_shot import (  # noqa: E402
    FROZEN_MODEL_HASH16,
    _score_v2_dy_b,
    _sha256,
    collect_integrity_hashes,
)

LIVED_THROUGH = 2026
FUTURE_AGE = 100
PILOT_KIND = "BLIND_USER_QA_PILOT"

SUBJECTS = [
    {
        "id": "P01",
        "gender": "male",
        "solar_birth": {"y": 1967, "m": 3, "d": 11, "h": 17, "min": 40, "tz": "Asia/Seoul"},
        "lunar_metadata_reference_only": "1967-02-01",
        "natal_reference": ["丁未", "癸卯", "甲戌", "癸酉"],
        "daewoon_reference": ["壬寅", "辛丑", "庚子", "己亥", "戊戌", "丁酉", "丙申", "乙未", "甲午"],
        "daewoon_year_claims": [("丙申", 2028), ("乙未", 2038)],
        "current_claim_2026": None,
    },
    {
        "id": "P02",
        "gender": "female",
        "solar_birth": {"y": 1969, "m": 3, "d": 11, "h": 12, "min": 15, "tz": "Asia/Seoul"},
        "lunar_metadata_reference_only": "1969-01-23",
        "natal_reference": ["己酉", "丁卯", "乙酉", "壬午"],
        "daewoon_reference": ["戊辰", "己巳", "庚午", "辛未", "壬申", "癸酉", "甲戌", "乙亥", "丙子", "丁丑"],
        "daewoon_year_claims": [("癸酉", 2027)],
        "current_claim_2026": None,
    },
    {
        "id": "P03",
        "gender": "male",
        "solar_birth": {"y": 1997, "m": 3, "d": 6, "h": 3, "min": 20, "tz": "Asia/Seoul"},
        "lunar_metadata_reference_only": None,
        "natal_reference": ["丁丑", "癸卯", "丁未", "辛丑"],
        "daewoon_reference": ["庚子", "己亥", "戊戌", "丁酉", "丙申", "乙未", "甲午"],
        "daewoon_year_claims": [("己亥", 2027), ("戊戌", 2037)],
        "current_claim_2026": "庚子",
    },
    {
        "id": "P04",
        "gender": "male",
        "solar_birth": {"y": 2000, "m": 12, "d": 21, "h": 14, "min": 10, "tz": "Asia/Seoul"},
        "lunar_metadata_reference_only": None,
        "natal_reference": ["庚辰", "戊子", "癸丑", "己未"],
        "daewoon_reference": ["庚寅", "辛卯", "壬辰", "癸巳", "甲午", "乙未", "丙申", "丁酉", "戊戌"],
        "daewoon_year_claims": [("辛卯", 2026), ("壬辰", 2036)],
        "current_claim_2026": "庚寅",
    },
]


def _r4(x: Optional[float]) -> Optional[float]:
    if x is None or (isinstance(x, float) and x != x):
        return None
    return round(float(x), 4)


def _pillar(v) -> str:
    if isinstance(v, str):
        return v
    if isinstance(v, (list, tuple)) and len(v) >= 2:
        return f"{v[0]}{v[1]}"
    return str(v or "")


def _relation_types(ilju) -> List[str]:
    """Strip fortune-tail wording. Keep 합/충/형/파/해 only."""
    out = []
    for item in (ilju or []):
        s = str(item)
        for key in ("합", "충", "형", "파", "해"):
            if key in s:
                out.append(key)
    return sorted(set(out))


def classify_natal(engine: List[str], ref: List[str]) -> Dict[str, Any]:
    labels = ["year", "month", "day", "hour"]
    diffs = [
        {"pillar": labels[i], "engine": engine[i], "reference": ref[i]}
        for i in range(4) if engine[i] != ref[i]
    ]
    material = [d for d in diffs if d["pillar"] in ("day", "hour")]
    if not diffs:
        status = "MATCH"
    elif material:
        status = "MISMATCH"
    else:
        status = "MINOR_BOUNDARY_DIFFERENCE"
    return {
        "status": status,
        "engine": engine,
        "reference": ref,
        "diffs": diffs,
        "material_day_or_hour_mismatch": bool(material),
    }


def _subsequence_start(hay: List[str], needle: List[str]) -> Optional[int]:
    n = len(needle)
    for i in range(len(hay) - n + 1):
        if hay[i:i + n] == needle:
            return i
    return None


def classify_daewoon(engine_seq: List[str], blocks: List[dict], spec: dict, natal_year: int) -> Dict[str, Any]:
    ref = list(spec["daewoon_reference"])
    idx = _subsequence_start(engine_seq, ref)
    prefix = engine_seq[:len(ref)] == ref
    first_mismatch = None
    if idx is None and not prefix:
        for i, p in enumerate(ref):
            if i >= len(engine_seq) or engine_seq[i] != p:
                first_mismatch = {"index": i, "engine": engine_seq[i] if i < len(engine_seq) else None, "reference": p}
                break
    by_p = {b["pillar"]: b for b in blocks}
    year_deltas = []
    for pillar, claim_year in spec["daewoon_year_claims"]:
        b = by_p.get(pillar)
        if not b:
            year_deltas.append({"pillar": pillar, "claim_year": claim_year, "engine_start_year": None, "delta": None})
            continue
        year_deltas.append({
            "pillar": pillar,
            "claim_year": claim_year,
            "engine_start_year": b["start_year"],
            "delta": int(b["start_year"]) - int(claim_year),
        })
    current_2026 = None
    for b in blocks:
        if b["start_year"] <= LIVED_THROUGH < b["end_year"]:
            current_2026 = b["pillar"]
            break
    current_claim = spec.get("current_claim_2026")
    current_ok = (current_claim is None) or (current_2026 == current_claim)

    order_ok = idx is not None or prefix
    max_abs_delta = max((abs(d["delta"]) for d in year_deltas if d["delta"] is not None), default=0)
    missing_claim = any(d["engine_start_year"] is None for d in year_deltas)

    if not order_ok:
        status = "MISMATCH"
    elif missing_claim or max_abs_delta >= 3 or (current_claim and not current_ok and max_abs_delta >= 3):
        status = "MISMATCH"
    elif max_abs_delta >= 1 or (current_claim and not current_ok):
        status = "MINOR_BOUNDARY_DIFFERENCE"
    else:
        status = "MATCH"

    return {
        "status": status,
        "engine_sequence": engine_seq,
        "reference_sequence": ref,
        "reference_is_contiguous_subsequence": idx is not None,
        "subsequence_index": idx,
        "first_mismatch": first_mismatch,
        "year_claim_deltas": year_deltas,
        "engine_current_2026": current_2026,
        "reference_current_2026": current_claim,
        "direction_material_mismatch": False,
    }


def compute_subject(spec: dict) -> Dict[str, Any]:
    b = spec["solar_birth"]
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        inp = se.BirthInput(
            year=b["y"], month=b["m"], day=b["d"], hour=b["h"], minute=b["min"],
            gender=spec["gender"], calendar="solar", is_leap_month=False,
            city="Seoul", use_solar_time=True, utc_offset=9, early_zi_time=False,
        )
        r = se.compute_all(inp)
        dw = se.build_daewoon_detail(r)
        timeline = se.build_yearly_timeline(r, dw, span=FUTURE_AGE + 1)
    natal = [_pillar(r["원국"][k]) for k in ("year", "month", "day", "hour")]
    blocks = []
    for blk in dw:
        blocks.append({
            "pillar": blk["daewoon_pillar"],
            "stem": blk["stem"],
            "branch": blk["branch"],
            "start_age_years": float(blk["start_age_years"]),
            "end_age_years": float(blk["end_age_years"]),
            "start_year": int(blk["start_year"]),
            "end_year": int(blk["end_year"]),
            "end_exclusive": True,
        })
    natal_cmp = classify_natal(natal, spec["natal_reference"])
    dw_cmp = classify_daewoon([x["pillar"] for x in blocks], blocks, spec, b["y"])
    dw_cmp["direction"] = r["대운"]["방향"]
    dw_cmp["start_age"] = r["대운"]["시작나이"]
    dw_cmp["start_age_precise"] = r["대운"].get("시작나이_정밀")
    dw_cmp["meta"] = r["대운"].get("메타")
    meta = {int(e["year"]): e for e in timeline}
    pack = {
        "name": spec["id"],
        "n": {"name": spec["id"], "gender": spec["gender"], "good": [], "bad": []},
        "r": r,
        "dw": dw,
        "meta": meta,
        "pool": "BLIND_PILOT",
    }
    return {
        "spec": spec,
        "pack": pack,
        "r": r,
        "dw": dw,
        "natal": natal,
        "natal_cmp": natal_cmp,
        "dw_cmp": dw_cmp,
        "blocks": blocks,
        "birth_year": b["y"],
        "civil_kst": f"{b['y']:04d}-{b['m']:02d}-{b['d']:02d} {b['h']:02d}:{b['min']:02d}",
        "yongshin_confidence": (r.get("용신") or {}).get("판정확신도"),
    }


def year_row(pid: str, year: int, birth_year: int, layers: dict, meta: dict) -> Dict[str, Any]:
    L = layers[year]
    m = meta[year]
    trans = m.get("대운전환기") or {}
    trans_flag = bool(trans.get("전환기")) if isinstance(trans, dict) else bool(trans)
    return {
        "calendar_year": year,
        "age": year - birth_year,
        "daewoon_pillar": L["pillar"],
        "D_B": float(L["D"]),
        "AnnualDev_B": float(L["annual_dev"]),
        "Y": float(L["Y"]),
        "A_G": float(L["A"]),
        "G": float(L["G"]),
        "B_trigger": float(L["trigger"]),
        "sewoon_pillar": m.get("세운_pillar"),
        "daewoon_transition": trans_flag,
        "ilju_relation_types": _relation_types(m.get("세운_일주관계")),
        "sewoon_tg_stem": m.get("세운_십성_천간"),
        "sewoon_tg_branch": m.get("세운_십성_지지"),
        "context_confidence": None,
    }


def block_summaries(rows: List[dict], blocks: List[dict]) -> List[dict]:
    by_p = {}
    for r in rows:
        by_p.setdefault(r["daewoon_pillar"], []).append(r)
    out = []
    for b in blocks:
        ys = [x["Y"] for x in by_p.get(b["pillar"], [])]
        ds = [x["D_B"] for x in by_p.get(b["pillar"], [])]
        out.append({
            **b,
            "D_B": _r4(ds[0]) if ds else None,
            "n_years_in_slice": len(ys),
            "Y_mean": _r4(float(np.mean(ys))) if ys else None,
            "Y_median": _r4(float(np.median(ys))) if ys else None,
            "Y_min": _r4(float(np.min(ys))) if ys else None,
            "Y_max": _r4(float(np.max(ys))) if ys else None,
            "Y_range": _r4(float(np.max(ys) - np.min(ys))) if ys else None,
        })
    return out


def internal_summaries(lived: List[dict], blocks: List[dict]) -> Dict[str, Any]:
    if not lived:
        return {}
    ys = np.asarray([r["Y"] for r in lived], dtype=float)
    lo, hi = np.quantile(ys, 0.10), np.quantile(ys, 0.90)
    top = [r["calendar_year"] for r in lived if r["Y"] >= hi]
    bot = [r["calendar_year"] for r in lived if r["Y"] <= lo]
    yoy = []
    for a, b in zip(lived, lived[1:]):
        yoy.append({
            "from_year": a["calendar_year"],
            "to_year": b["calendar_year"],
            "delta_Y": _r4(b["Y"] - a["Y"]),
        })
    yoy_sorted = sorted(yoy, key=lambda x: x["delta_Y"] or 0)
    boundaries = sorted({b["start_year"] for b in blocks if lived[0]["calendar_year"] <= b["start_year"] <= lived[-1]["calendar_year"]})
    return {
        "top_10pct_Y_years": top,
        "bottom_10pct_Y_years": bot,
        "top_10pct_threshold": _r4(float(hi)),
        "bottom_10pct_threshold": _r4(float(lo)),
        "largest_positive_yoy": list(reversed(yoy_sorted[-5:])),
        "largest_negative_yoy": yoy_sorted[:5],
        "daewoon_boundary_years": boundaries,
    }


def write_chart_md(pid: str, civil: str, natal: List[str], blocks: List[dict], lived: List[dict]) -> str:
    lines = [
        f"# {pid}",
        "",
        f"Birth (solar, KST): `{civil}`",
        "",
        f"Natal: {' / '.join(natal)}",
        "",
        "## Daewoon",
        "",
        "| pillar | start_year | end_year (exclusive) | age_start | age_end | D_B |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for b in blocks:
        if b["start_year"] > LIVED_THROUGH:
            continue
        lines.append(
            f"| {b['pillar']} | {b['start_year']} | {b['end_year']} | "
            f"{b['start_age_years']:.1f} | {b['end_age_years']:.1f} | {b.get('D_B') if b.get('D_B') is not None else ''} |"
        )
    lines += [
        "",
        f"## Annual scores ({lived[0]['calendar_year']}–{LIVED_THROUGH})",
        "",
        "| year | age | daewoon | sewoon | D_B | Y |",
        "|---:|---:|---|---|---:|---:|",
    ]
    for r in lived:
        lines.append(
            f"| {r['calendar_year']} | {r['age']} | {r['daewoon_pillar']} | "
            f"{r['sewoon_pillar']} | {_r4(r['D_B'])} | {_r4(r['Y'])} |"
        )
    lines.append("")
    return "\n".join(lines)


def _numeric_dir(delta: Optional[float]) -> str:
    if delta is None:
        return "flat"
    if delta > 0.05:
        return "up"
    if delta < -0.05:
        return "down"
    return "flat"


def write_expl_md(pid: str, blocks_lived: List[dict], lived: List[dict], yong_conf) -> str:
    lines = [
        f"# {pid} explanation",
        "",
        "Revealed only after the chart-only packet has been evaluated.",
        "",
        "Numeric features that can raise/lower Y: D_B (block baseline), A_G, B_trigger (합/충/형/파해, selected 십성).",
        "Other factors below are structural context only. They are not claimed to have changed Y.",
        "",
        f"Natal explanation confidence (engine): {yong_conf}",
        "",
        "## Daewoon blocks (lived years through 2026)",
        "",
    ]
    prev = None
    for b in blocks_lived:
        if not b.get("n_years_in_slice"):
            continue
        ddir = _numeric_dir(None if prev is None or b["D_B"] is None or prev["D_B"] is None else b["D_B"] - prev["D_B"])
        ydir = _numeric_dir(None if prev is None or b["Y_mean"] is None or prev["Y_mean"] is None else b["Y_mean"] - prev["Y_mean"])
        lines += [
            f"### {b['pillar']} ({b['start_year']}–{b['end_year']}, exclusive end)",
            "",
            f"- numeric D_B: {b['D_B']} (block-to-block D direction: {ddir})",
            f"- numeric mean Y: {b['Y_mean']} (median {b['Y_median']}; range {b['Y_min']}–{b['Y_max']}; block-to-block mean-Y direction: {ydir})",
            "- orthodox/context: Daewoon pillar vs natal is structural setting only unless already inside D_B features.",
            "",
        ]
        prev = b

    # notable YoY inside lived window — numeric only, not labeled good/bad
    yoy = []
    for a, b in zip(lived, lived[1:]):
        yoy.append((abs(b["Y"] - a["Y"]), b["Y"] - a["Y"], a, b))
    yoy.sort(reverse=True, key=lambda t: t[0])
    lines += ["## Notable annual numeric movements", ""]
    for _, delta, a, b in yoy[:8]:
        lines += [
            f"### {a['calendar_year']} → {b['calendar_year']}",
            "",
            f"- numeric ΔY: {_r4(delta)} ({_numeric_dir(delta)})",
            f"- Y: {_r4(a['Y'])} → {_r4(b['Y'])}",
            f"- D_B: {_r4(a['D_B'])} → {_r4(b['D_B'])} (same block)" if a["daewoon_pillar"] == b["daewoon_pillar"]
            else f"- D_B: {_r4(a['D_B'])} → {_r4(b['D_B'])} (Daewoon {a['daewoon_pillar']} → {b['daewoon_pillar']})",
            f"- AnnualDev: {_r4(a['AnnualDev_B'])} → {_r4(b['AnnualDev_B'])}",
            f"- numeric drivers: A_G {_r4(a['A_G'])}→{_r4(b['A_G'])}; B_trigger {_r4(a['B_trigger'])}→{_r4(b['B_trigger'])}",
        ]
        ctx = []
        if b["ilju_relation_types"]:
            ctx.append("tension/activation markers: " + ",".join(b["ilju_relation_types"]))
        if b.get("sewoon_tg_stem") or b.get("sewoon_tg_branch"):
            ctx.append(f"structural 십성 context: {b.get('sewoon_tg_stem')}/{b.get('sewoon_tg_branch')}")
        if b["daewoon_transition"]:
            ctx.append("Daewoon boundary year (timing context)")
        if ctx:
            lines.append("- mixed/orthodox context (not independently claimed as Y change): " + "; ".join(ctx))
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    print("══════════ BLIND PILOT ENGINE DATA ══════════")
    hashes = collect_integrity_hashes()
    dy_hash = hashes["experiment_v2_dy.py"]["sha256_16"]
    if dy_hash != FROZEN_MODEL_HASH16["experiment_v2_dy.py"]:
        print("BLOCK: V2_DY_B source hash drifted")
        return 1

    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old_packs, fresh_packs, val_b = DY._load_pools(freeze)
    if any(p["name"] in val_b for p in old_packs + fresh_packs):
        print("BLOCK: Validation B leaked into z-source packs")
        return 1
    dev = old_packs + fresh_packs
    print(f"  z-source packs: OLD={len(old_packs)} FA={len(fresh_packs)} (B not packed)")

    computed = [compute_subject(s) for s in SUBJECTS]
    holdout = [c["pack"] for c in computed]
    layers_list, score_maps, z_params = _score_v2_dy_b(dev, holdout)

    subjects_out = []
    qa_rows = []
    block_reasons = []
    used_life_history = False

    for c, layers, smap in zip(computed, layers_list, score_maps):
        pid = c["spec"]["id"]
        birth_year = c["birth_year"]
        years_all = sorted(int(y) for y in smap)
        lived_years = [y for y in years_all if birth_year <= y <= LIVED_THROUGH]
        future_years = [y for y in years_all if y > LIVED_THROUGH]
        if not lived_years:
            block_reasons.append(f"{pid}:no_lived_years")
            continue
        lived = [year_row(pid, y, birth_year, layers, c["pack"]["meta"]) for y in lived_years]
        future = [year_row(pid, y, birth_year, layers, c["pack"]["meta"]) for y in future_years]
        blocks_all = block_summaries(lived + future, c["blocks"])
        blocks_lived = block_summaries(lived, c["blocks"])
        natal_s = c["natal_cmp"]["status"]
        dw_s = c["dw_cmp"]["status"]
        if c["natal_cmp"]["material_day_or_hour_mismatch"] or dw_s == "MISMATCH":
            block_reasons.append(f"{pid}:foundation_{natal_s}/{dw_s}")

        engine = {
            "participant_id": pid,
            "pilot_kind": PILOT_KIND,
            "model": "V2_DY_B",
            "formula": {
                "D_B": "clamp(60 + 3 * h_B)",
                "annual_dev_B": "0.65*A_G + 0.35*B_trigger",
                "Y": "clamp(D_B + annual_dev_B)",
            },
            "z_params_source": "OLD_DEV + FRESH_A_DEV only",
            "civil_kst_input": c["civil_kst"],
            "timezone": "Asia/Seoul",
            "engine_clock_notes": {
                "year_month_day": "calculate_saju use_solar_time=True city=Seoul",
                "hour_pillar": "civil KST half-hour (반시) correction",
                "daewoon_start": "civil KST birth datetime vs 절",
            },
            "gender": c["spec"]["gender"],
            "natal_engine": c["natal"],
            "natal_reference_qa": c["natal_cmp"],
            "daewoon_reference_qa": {
                k: c["dw_cmp"][k] for k in (
                    "status", "engine_sequence", "reference_sequence",
                    "reference_is_contiguous_subsequence", "first_mismatch",
                    "year_claim_deltas", "engine_current_2026", "reference_current_2026",
                    "direction", "start_age", "start_age_precise",
                )
            },
            "daewoon_blocks": blocks_all,
            "lived_years": [{
                "calendar_year": r["calendar_year"], "age": r["age"],
                "daewoon_pillar": r["daewoon_pillar"], "sewoon_pillar": r["sewoon_pillar"],
                "D_B": _r4(r["D_B"]), "AnnualDev_B": _r4(r["AnnualDev_B"]), "Y": _r4(r["Y"]),
                "daewoon_transition": r["daewoon_transition"],
                "explanation_context_confidence": r["context_confidence"],
            } for r in lived],
            "future_years_internal_only": [{
                "calendar_year": r["calendar_year"], "age": r["age"],
                "daewoon_pillar": r["daewoon_pillar"], "sewoon_pillar": r["sewoon_pillar"],
                "D_B": _r4(r["D_B"]), "AnnualDev_B": _r4(r["AnnualDev_B"]), "Y": _r4(r["Y"]),
            } for r in future],
            "month_day_excluded_from_pilot_chart": True,
            "life_history_used": False,
        }
        with open(os.path.join(_HERE, f"{pid}_engine.json"), "w", encoding="utf-8") as f:
            json.dump(engine, f, ensure_ascii=False, indent=2)
            f.write("\n")

        chart = write_chart_md(pid, c["civil_kst"], c["natal"], blocks_lived, lived)
        with open(os.path.join(_HERE, f"{pid}_chart_only.md"), "w", encoding="utf-8") as f:
            f.write(chart)

        expl = write_expl_md(pid, blocks_lived, lived, c["yongshin_confidence"])
        with open(os.path.join(_HERE, f"{pid}_explanation.md"), "w", encoding="utf-8") as f:
            f.write(expl)

        internal = {
            "participant_id": pid,
            "pilot_kind": PILOT_KIND,
            "not_validation": True,
            "engine_output_ref": f"{pid}_engine.json",
            "A_engine_headlines": {
                "natal_match": natal_s,
                "daewoon_match": dw_s,
                "n_lived_years": len(lived),
                "n_future_years_internal": len(future),
            },
            "B_top_bottom_score_years": internal_summaries(lived, c["blocks"]),
            "C_largest_transitions": internal_summaries(lived, c["blocks"]),
            "D_daewoon_boundaries": [b["start_year"] for b in c["blocks"]],
            "E_participant_response_placeholders": {
                "participant_good_periods": [],
                "participant_bad_periods": [],
                "participant_turning_points": [],
                "participant_chart_fit_rating": None,
                "participant_comments": None,
            },
            "do_not_show_before_responses": True,
        }
        with open(os.path.join(_HERE, f"{pid}_internal_qa.json"), "w", encoding="utf-8") as f:
            json.dump(internal, f, ensure_ascii=False, indent=2)
            f.write("\n")

        subjects_out.append({
            "id": pid,
            "gender": c["spec"]["gender"],
            "solar_birth_kst": c["civil_kst"],
            "lunar_metadata_reference_only": c["spec"]["lunar_metadata_reference_only"],
            "natal_reference": c["spec"]["natal_reference"],
            "daewoon_reference": c["spec"]["daewoon_reference"],
        })
        first_mm = c["dw_cmp"].get("first_mismatch") or c["natal_cmp"].get("diffs") or None
        if first_mm is None and dw_s != "MATCH":
            first_mm = {
                "year_claim_deltas": c["dw_cmp"].get("year_claim_deltas"),
                "engine_current_2026": c["dw_cmp"].get("engine_current_2026"),
                "reference_current_2026": c["dw_cmp"].get("reference_current_2026"),
            }
        qa_rows.append({
            "id": pid,
            "natal_reference_match": natal_s,
            "daewoon_reference_match": dw_s,
            "first_mismatch": first_mm,
            "annual_years_generated": len(lived),
            "future_years_internal": len(future),
        })
        print(f"  {pid} natal={natal_s} daewoon={dw_s} lived={len(lived)}")

    status = "BLIND_PILOT_ENGINE_DATA_READY" if not block_reasons else "BLIND_PILOT_ENGINE_DATA_BLOCKED"
    subjects_payload = {
        "pilot_kind": PILOT_KIND,
        "not": ["VALIDATION", "ACCURACY_ESTIMATE", "STATISTICAL_EVIDENCE"],
        "timezone": "Asia/Seoul",
        "model": "V2_DY_B",
        "lived_through": LIVED_THROUGH,
        "subjects": subjects_out,
        "real_names_present": False,
        "life_history_used": False,
        "validation_b_used": False,
    }
    with open(os.path.join(_HERE, "BLIND_PILOT_SUBJECTS.json"), "w", encoding="utf-8") as f:
        json.dump(subjects_payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    z_ser = {k: [float(x) for x in v] for k, v in z_params.items()}
    report = [
        "# Blind Pilot Engine QA",
        "",
        f"**Status:** `{status}`",
        "",
        "This n=4 exercise is `BLIND_USER_QA_PILOT`.",
        "It is not validation, not an accuracy estimate, and not statistical evidence.",
        "",
        "| ID | natal reference match | Daewoon reference match | first mismatch | annual years generated |",
        "|---|---|---|---|---:|",
    ]
    for row in qa_rows:
        fm = row["first_mismatch"]
        fm_s = "—" if not fm else json.dumps(fm, ensure_ascii=False)
        report.append(
            f"| {row['id']} | {row['natal_reference_match']} | {row['daewoon_reference_match']} | {fm_s} | {row['annual_years_generated']} |"
        )
    report += [
        "",
        "## Confirmations",
        "",
        f"- V2_DY_B hash unchanged: `experiment_v2_dy.py` `{dy_hash}` (preregistered `{FROZEN_MODEL_HASH16['experiment_v2_dy.py']}`)",
        f"- z-params source: OLD_DEV + Fresh A only; {json.dumps(z_ser)}",
        "- no participant life history used",
        "- no tuning performed",
        "- no Validation B reused (B names never packed or scored)",
        "- no Month/Day score included in participant-facing chart",
        "- future years excluded from retrospective chart packet (internal engine JSON only)",
        "- participant-response fields left empty",
        "",
        "## Notes",
        "",
        "- Solar civil KST is the engine input. Lunar dates and supplied pillars/Daewoon are QA references only.",
        "- Engine output was not rewritten to match supplied Daewoon year claims.",
        "- P03/P04 supplied Daewoon lists start at 'current' and omit earlier childhood blocks; subsequence match is used.",
        "- P04 辛卯 engine start is 2025 vs supplied 2026 (1-year boundary).",
        "",
    ]
    if block_reasons:
        report += ["## Block reasons", "", *[f"- {x}" for x in block_reasons], ""]
    with open(os.path.join(_HERE, "BLIND_PILOT_ENGINE_QA.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report))

    print("══════════ STATUS ══════════")
    print(status)
    if block_reasons:
        print("block_reasons", block_reasons)
    return 0 if not block_reasons else 1


if __name__ == "__main__":
    sys.exit(main())
