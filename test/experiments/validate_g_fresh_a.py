# -*- coding: utf-8 -*-
"""
One-shot Validation A for frozen G_CLEAN_AXIS.

Phases 0–9 per user brief / G_FRESH_VALIDATION_RUN_SPEC.md.

- Does NOT score Validation B (hard reject).
- Does NOT retune / patch / edit engine / change B9 hierarchy.
- Uses engine sajupy longitude solar correction (no EOT) as scoring clock.

Usage:
  python test/experiments/validate_g_fresh_a.py
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import unicodedata
from collections import Counter, defaultdict
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import sajupy  # noqa: E402
import saju_engine as se  # noqa: E402
from experiments import arm_b, arm_b9, common as C  # noqa: E402
from experiments import diag_b9a_alpha_select as DIAG  # noqa: E402
from experiments.experiment_g_clean import score_g, _b9_from_g, ALPHA  # noqa: E402

FRESH_JSON = os.path.join(_HERE, "g_fresh_subjects_completed.json")
SHA_FILE = os.path.join(_TEST, "g_fresh_subjects_completed.sha256")
EXISTING_JSON = os.path.join(_TEST, "yongshin_subjects.json")

OUT_BIRTH_QA = os.path.join(_HERE, "exp_g_fresh_birth_qa.json")
OUT_LABELS = os.path.join(_HERE, "g_fresh_labels_frozen.json")
OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_g_fresh_validation_a.json")
OUT_REPORT = os.path.join(_HERE, "G_FRESH_VALIDATION_A_REPORT.md")

SAJUPY_MIN_YEAR = 1900
SAJUPY_MAX_YEAR = 2100
MAX_ENGINE_DELTA_VS_LON_ONLY = 1.0  # minutes; engine has no EOT


def _norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = "".join(s.split())
    return s.casefold()


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _hour_branch(h: int, m: int) -> str:
    t = h * 60 + m
    bounds = [
        (23, 30, 1, 30, "子"), (1, 30, 3, 30, "丑"), (3, 30, 5, 30, "寅"),
        (5, 30, 7, 30, "卯"), (7, 30, 9, 30, "辰"), (9, 30, 11, 30, "巳"),
        (11, 30, 13, 30, "午"), (13, 30, 15, 30, "未"), (15, 30, 17, 30, "申"),
        (17, 30, 19, 30, "酉"), (19, 30, 21, 30, "戌"), (21, 30, 23, 30, "亥"),
    ]
    for sh, sm, eh, em, br in bounds:
        start, end = sh * 60 + sm, eh * 60 + em
        if start > end:
            if t >= start or t < end:
                return br
        elif start <= t < end:
            return br
    return "子"


def engine_recompute_birth(subj: dict) -> Dict[str, Any]:
    """LOCAL civil → (optional DST→standard) → sajupy lon correction.

    Does NOT convert to KST. Does NOT apply equation of time (engine has none).
    """
    ob = subj["original_birth"]
    tsc = subj.get("true_solar_conversion") or {}
    calc = sajupy.get_saju_calculator()

    civil = datetime(int(ob["y"]), int(ob["m"]), int(ob["d"]), int(ob["h"]), int(ob["min"]))
    c2s = float(tsc.get("civil_to_standard_minutes") or 0.0)
    std = civil + timedelta(minutes=c2s)
    lon = float(ob["lon"])
    utc = float(ob["standard_utc_offset_hours"])
    corr = float(calc._calculate_solar_time_correction(lon, utc))
    h, mi, dc = calc._adjust_time_for_solar(std.hour, std.minute, corr)
    y, mo, da = calc._adjust_date_for_solar(std.year, std.month, std.day, dc)

    eng_dt = datetime(y, mo, da, h, mi)
    supplied = datetime(
        int(subj["birth"]["y"]), int(subj["birth"]["m"]), int(subj["birth"]["d"]),
        int(subj["birth"]["h"]), int(subj["birth"]["min"]),
    )
    # lon-only expected from dataset components (exclude EOT)
    lon_only = std + timedelta(minutes=float(tsc.get("longitude_correction_minutes") or corr))
    eot = float(tsc.get("equation_of_time_minutes") or 0.0)

    return {
        "name": subj["name"],
        "split": subj["split"],
        "original_local_civil": civil.isoformat(sep=" "),
        "birthplace": ob.get("place"),
        "timezone": ob.get("timezone"),
        "timezone_abbr_at_birth": ob.get("timezone_abbr_at_birth"),
        "standard_utc_offset_hours": utc,
        "civil_to_standard_minutes": c2s,
        "longitude": lon,
        "engine_lon_correction_minutes": round(corr, 4),
        "dataset_lon_correction_minutes": tsc.get("longitude_correction_minutes"),
        "dataset_eot_minutes": eot,
        "dataset_total_correction_minutes": tsc.get("total_correction_minutes"),
        "supplied_normalized": supplied.isoformat(sep=" "),
        "engine_recomputed": eng_dt.isoformat(sep=" "),
        "delta_minutes_vs_supplied": round((eng_dt - supplied).total_seconds() / 60.0, 3),
        "delta_minutes_vs_lon_only_expected": round((eng_dt - lon_only).total_seconds() / 60.0, 3),
        "supplied_hour_branch": _hour_branch(supplied.hour, supplied.minute),
        "engine_hour_branch": _hour_branch(eng_dt.hour, eng_dt.minute),
        "hour_branch_match": _hour_branch(supplied.hour, supplied.minute)
        == _hour_branch(eng_dt.hour, eng_dt.minute),
        "crosses_hour_branch_vs_supplied": _hour_branch(supplied.hour, supplied.minute)
        != _hour_branch(eng_dt.hour, eng_dt.minute),
        "crosses_date_vs_civil": eng_dt.date() != civil.date(),
        "engine_year_in_sajupy_range": SAJUPY_MIN_YEAR <= eng_dt.year <= SAJUPY_MAX_YEAR,
        "engine_birth": {
            "calendar": "solar",
            "y": eng_dt.year,
            "m": eng_dt.month,
            "d": eng_dt.day,
            "h": eng_dt.hour,
            "min": eng_dt.minute,
            "timezone_basis": "ENGINE_LOCAL_TRUE_SOLAR_LON_ONLY",
        },
    }


def phase0_sha_and_schema(fresh: dict) -> Dict[str, Any]:
    expected = open(SHA_FILE, encoding="utf-8").read().strip().split()[0]
    actual = _sha256_file(FRESH_JSON)
    sha_ok = expected == actual

    fails = []
    for s in fresh["subjects"]:
        for k in (
            "name", "gender", "birth", "original_birth", "source_quality",
            "life_events", "split", "fresh_eligibility",
        ):
            if k not in s:
                fails.append({"name": s.get("name"), "error": f"missing_{k}"})
        ob = s.get("original_birth") or {}
        for k in ("y", "m", "d", "h", "min", "place", "lat", "lon", "timezone",
                  "standard_utc_offset_hours"):
            if k not in ob:
                fails.append({"name": s.get("name"), "error": f"original_birth.missing_{k}"})
        le = s.get("life_events") or {}
        for side in ("good", "bad"):
            for e in le.get(side) or []:
                for k in ("year", "label", "weight", "confidence"):
                    if k not in e:
                        fails.append({"name": s.get("name"), "error": f"event.missing_{k}", "side": side})

    return {
        "sha_expected": expected,
        "sha_actual": actual,
        "sha_ok": sha_ok,
        "schema_failures": fails,
        "schema_ok": len(fails) == 0,
        "n_subjects": len(fresh.get("subjects") or []),
    }


def phase1_contamination(fresh: dict) -> Dict[str, Any]:
    existing = json.load(open(EXISTING_JSON, encoding="utf-8"))
    blocked = {s["name"] for s in existing if s.get("name")}
    blocked_n = {_norm_name(n) for n in blocked}
    fresh_names = [s["name"] for s in fresh["subjects"]]
    overlap = []
    for n in fresh_names:
        if n in blocked or _norm_name(n) in blocked_n:
            overlap.append(n)
        # heuristic alias fragments
        for b in blocked:
            bn, nn = _norm_name(b), _norm_name(n)
            if bn and nn and (bn in nn or nn in bn) and bn != nn:
                overlap.append(f"{n}~alias?~{b}")

    a = [s["name"] for s in fresh["subjects"] if s.get("split") == "validation_a"]
    b = [s["name"] for s in fresh["subjects"] if s.get("split") == "validation_b"]
    return {
        "n_fresh": len(fresh_names),
        "n_unique": len(set(fresh_names)),
        "n_existing_blocked": len(blocked),
        "overlap": sorted(set(overlap)),
        "overlap_ok": len(overlap) == 0,
        "n_validation_a": len(a),
        "n_validation_b": len(b),
        "split_ok": len(a) == 15 and len(b) == 15,
        "validation_a": a,
        "validation_b": b,
    }


def phase3_quality(fresh: dict, birth_rows: List[dict]) -> Dict[str, Any]:
    by_name = {r["name"]: r for r in birth_rows}
    grades = Counter()
    flags = []
    eligible = []
    ineligible = []
    for s in fresh["subjects"]:
        sq = str(s.get("source_quality") or "")
        if "AA" in sq:
            grades["AA"] += 1
            g = "AA"
        elif sq.endswith("_A") or sq == "A" or "Rodden_A" == sq:
            grades["A"] += 1
            g = "A"
        elif "B" in sq:
            grades["B"] += 1
            g = "B"
        else:
            grades["other"] += 1
            g = "other"

        br = by_name[s["name"]]
        reasons = []
        if not br["engine_year_in_sajupy_range"]:
            reasons.append(f"engine_year_out_of_range({br['engine_recomputed'][:4]})")
        if abs(br["delta_minutes_vs_lon_only_expected"]) > MAX_ENGINE_DELTA_VS_LON_ONLY:
            reasons.append(
                f"lon_only_mismatch_gt_{MAX_ENGINE_DELTA_VS_LON_ONLY}m"
                f"({br['delta_minutes_vs_lon_only_expected']})"
            )
        # EOT-driven supplied mismatch is expected — flag but not auto-exclude
        if abs(br["delta_minutes_vs_supplied"]) > MAX_ENGINE_DELTA_VS_LON_ONLY:
            flags.append({
                "name": s["name"],
                "flag": "supplied_includes_EOT_engine_does_not",
                "delta_vs_supplied": br["delta_minutes_vs_supplied"],
                "dataset_eot": br["dataset_eot_minutes"],
            })
        if br["crosses_hour_branch_vs_supplied"]:
            flags.append({"name": s["name"], "flag": "hour_branch_diff_vs_supplied_EOT"})

        row = {
            "name": s["name"],
            "split": s["split"],
            "source_quality": sq,
            "grade": g,
            "eligible_for_primary_validation": len(reasons) == 0,
            "exclusion_reasons": reasons,
        }
        if row["eligible_for_primary_validation"]:
            eligible.append(row)
        else:
            ineligible.append(row)

    return {
        "grade_counts": dict(grades),
        "flags": flags,
        "eligible": eligible,
        "ineligible": ineligible,
        "note": (
            "Engine solar correction = longitude×4min only (no equation of time). "
            "Dataset precompute includes EOT → large delta_vs_supplied is expected; "
            "scoring uses engine_recomputed clock. "
            f"Lon-only consistency gate: |Δ|≤{MAX_ENGINE_DELTA_VS_LON_ONLY} min."
        ),
    }


def phase4_label_qa(fresh: dict) -> Dict[str, Any]:
    issues = []
    eligible_events = {}
    for s in fresh["subjects"]:
        name = s["name"]
        by = int(s["original_birth"]["y"])
        good = []
        bad = []
        g_years = set()
        b_years = set()
        for e in (s["life_events"].get("good") or []):
            y = int(e["year"])
            excl = bool(e.get("exclude_from_validation") or e.get("ambiguity") or e.get("ambiguity_flag"))
            if e.get("weight", 1) is None or float(e.get("weight", 1)) <= 0:
                issues.append({"name": name, "issue": "invalid_weight", "year": y, "side": "good"})
                excl = True
            if y < by or y > by + 120:
                issues.append({"name": name, "issue": "outside_lifetime", "year": y, "side": "good"})
                excl = True
            rec = {**e, "exclude": excl}
            if not excl:
                good.append(rec)
                g_years.add(y)
            else:
                issues.append({"name": name, "issue": "excluded_event", "year": y, "side": "good"})
        for e in (s["life_events"].get("bad") or []):
            y = int(e["year"])
            excl = bool(e.get("exclude_from_validation") or e.get("ambiguity") or e.get("ambiguity_flag"))
            if e.get("weight", 1) is None or float(e.get("weight", 1)) <= 0:
                issues.append({"name": name, "issue": "invalid_weight", "year": y, "side": "bad"})
                excl = True
            if y < by or y > by + 120:
                issues.append({"name": name, "issue": "outside_lifetime", "year": y, "side": "bad"})
                excl = True
            rec = {**e, "exclude": excl}
            if not excl:
                bad.append(rec)
                b_years.add(y)
            else:
                issues.append({"name": name, "issue": "excluded_event", "year": y, "side": "bad"})
        both = g_years & b_years
        if both:
            issues.append({"name": name, "issue": "same_year_good_and_bad", "years": sorted(both)})
            # exclude mixed years from both sides (predeclared mixed-year rule)
            good = [e for e in good if int(e["year"]) not in both]
            bad = [e for e in bad if int(e["year"]) not in both]
        eligible_events[name] = {"good": good, "bad": bad}

    return {"issues": issues, "eligible_events": eligible_events}


def _pack_subject(s: dict, engine_birth: dict, events: dict) -> Dict[str, Any]:
    """Build a pack compatible with B9/G scoring (use_solar_time=False on engine birth)."""
    n = {
        "name": s["name"],
        "gender": s["gender"],
        "birth": {
            "y": engine_birth["y"],
            "m": engine_birth["m"],
            "d": engine_birth["d"],
            "h": engine_birth["h"],
            "min": engine_birth["min"],
            "calendar": "solar",
            "leap": False,
        },
        "time_quality": "known",
        "good": events["good"],
        "bad": events["bad"],
        "yongshin_override": s.get("yongshin_override"),
        "source_quality": s.get("source_quality"),
        "split": s["split"],
    }
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        hh, mm = int(engine_birth["h"]), int(engine_birth["min"])
        inp = se.BirthInput(
            year=engine_birth["y"], month=engine_birth["m"], day=engine_birth["d"],
            hour=hh, minute=mm, gender=s["gender"], calendar="solar",
            is_leap_month=False, use_solar_time=False, utc_offset=9,
        )
        r = se.compute_all(inp, yongshin_override=s.get("yongshin_override"))
        dw = se.build_daewoon_detail(r)
    close, meta = {}, {}
    for e in r["chart_data"]["연도별_타임라인"]:
        c = e.get("candle") or {}
        if "close" in c:
            close[e["year"]] = c["close"]
            meta[e["year"]] = e
    d_map = arm_b9.d_map_from_daewoon_detail(dw)
    return {
        "n": n,
        "name": s["name"],
        "bucket": "holdout",  # all fresh A treated as external holdout-like
        "split": s["split"],
        "close": close,
        "meta": meta,
        "d_map": d_map,
        "r": r,
        "dw": dw,
    }


def _pairwise(good: List[float], bad: List[float]) -> Optional[float]:
    if not good or not bad:
        return None
    wins = ties = 0.0
    for g in good:
        for b in bad:
            if g > b:
                wins += 1
            elif g == b:
                ties += 1
    return (wins + 0.5 * ties) / (len(good) * len(bad))


def _eval_packs(packs: List[dict], variant: str = "G_CLEAN_AXIS") -> Dict[str, Any]:
    cfg = dict(arm_b.ARM_B_CONFIG)
    score_maps = []
    g_all = []
    a_sds = []
    pattern_hits = Counter()
    n_years = 0
    sat_n = sat_bad = 0

    for pack in packs:
        gmap = {}
        for y, m in pack["meta"].items():
            g = score_g(m, variant, cfg)
            gmap[int(y)] = g
            g_all.append(g)
            n_years += 1
            # pattern activation via G_REF parts would need _parts; approximate via clean axis
        smap = _b9_from_g(pack, gmap)
        score_maps.append(smap)
        for v in smap.values():
            sat_n += 1
            if v <= 2 or v >= 98:
                sat_bad += 1
        # A_y within block
        by_p = defaultdict(list)
        for y, g in gmap.items():
            p = str(pack["meta"][y].get("대운_pillar") or "_")
            by_p[p].append(g)
        for gs in by_p.values():
            if len(gs) >= 2:
                med = float(np.median(gs))
                a_sds.append(float(np.std([g - med for g in gs], ddof=1)))

    # subject metrics
    rows = []
    all_good = []
    all_bad = []
    pair_rates = []
    for pack, smap in zip(packs, score_maps):
        good_e = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad_e = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        g_scores = [smap[int(e["year"])] for e in good_e if int(e["year"]) in smap]
        b_scores = [smap[int(e["year"])] for e in bad_e if int(e["year"]) in smap]
        ga, gu = C.wavg(good_e, smap)
        ba, bu = C.wavg(bad_e, smap)
        if gu < 1 or bu < 1 or ga != ga or ba != ba:
            rows.append({
                "name": pack["name"],
                "status": "insufficient_labels",
                "n_good": gu,
                "n_bad": bu,
            })
            continue
        pr = _pairwise(g_scores, b_scores)
        if pr is not None:
            pair_rates.append(pr)
        all_good.extend(g_scores)
        all_bad.extend(b_scores)
        sep = float(ga - ba)
        rows.append({
            "name": pack["name"],
            "status": "ok",
            "n_good": int(gu),
            "n_bad": int(bu),
            "good_avg": round(float(ga), 4),
            "bad_avg": round(float(ba), 4),
            "separation": round(sep, 4),
            "hit": 1 if ga > ba else 0,
            "pairwise": None if pr is None else round(pr, 4),
        })

    ok = [r for r in rows if r.get("status") == "ok"]
    seps = [r["separation"] for r in ok]
    hits = [r["hit"] for r in ok]
    all_s = [v for sm in score_maps for v in sm.values()]
    pooled_sd = float(np.std(all_s, ddof=1)) if len(all_s) > 1 else float("nan")
    raw_sep = float(np.mean(seps)) if seps else float("nan")
    std_sep = (raw_sep / pooled_sd) if pooled_sd and pooled_sd > 1e-12 else float("nan")

    def auc(gs, bs):
        if not gs or not bs:
            return None
        return _pairwise(gs, bs)

    return {
        "n_packs": len(packs),
        "n_eval_subjects": len(ok),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "hit_rate": None if not hits else round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "standardized_separation": None if std_sep != std_sep else round(std_sep, 4),
        "raw_separation_mean": None if raw_sep != raw_sep else round(raw_sep, 4),
        "raw_separation_median": None if not seps else round(float(np.median(seps)), 4),
        "auc_micro": None if auc(all_good, all_bad) is None else round(auc(all_good, all_bad) or 0, 4),
        "auc_macro": None if not pair_rates else round(float(np.mean(pair_rates)), 4),
        "subject_sep_dist": {
            "median": None if not seps else round(float(np.median(seps)), 4),
            "p25": None if not seps else round(float(np.percentile(seps, 25)), 4),
            "p75": None if not seps else round(float(np.percentile(seps, 75)), 4),
            "worst": None if not seps else round(float(min(seps)), 4),
        },
        "subjects": rows,
        "failures": [r for r in ok if r["hit"] == 0],
        "structural": {
            "G_dist": {
                "mean": round(float(np.mean(g_all)), 4) if g_all else None,
                "sd": round(float(np.std(g_all, ddof=1)), 4) if len(g_all) > 1 else None,
                "p05": round(float(np.percentile(g_all, 5)), 4) if g_all else None,
                "p50": round(float(np.percentile(g_all, 50)), 4) if g_all else None,
                "p95": round(float(np.percentile(g_all, 95)), 4) if g_all else None,
            },
            "A_within_block_sd_p50": None if not a_sds else round(float(np.median(a_sds)), 4),
            "sat_rate": round(sat_bad / sat_n, 4) if sat_n else None,
            "n_year_scores": n_years,
        },
    }


def _decision(primary: dict, quality: dict, contam: dict, sha: dict) -> str:
    if not sha["sha_ok"] or not sha["schema_ok"] or not contam["overlap_ok"] or not contam["split_ok"]:
        return "DATASET_QA_FAILURE"
    # hard engine exclusions alone are not full QA failure if documented
    if not primary or primary.get("n_eval_subjects", 0) == 0:
        return "DATASET_QA_FAILURE"

    pair = primary.get("pairwise_mean")
    stds = primary.get("standardized_separation")
    sat = (primary.get("structural") or {}).get("sat_rate") or 0
    ok = [r for r in primary["subjects"] if r.get("status") == "ok"]
    seps = sorted([r["separation"] for r in ok], reverse=True)

    fail = False
    reasons = []
    if pair is None or pair <= 0.50:
        fail = True
        reasons.append("pairwise<=0.50")
    if stds is None or stds <= 0:
        fail = True
        reasons.append("std_sep<=0")
    if sat >= 0.02:
        fail = True
        reasons.append("saturation>=2%")
    # concentration: top-2 separations account for all positive mass
    if len(seps) >= 5:
        pos = [x for x in seps if x > 0]
        if pos and sum(seps[:2]) >= 0.85 * sum(pos):
            # also check if without top2 hit collapses
            rest = ok[:]
            top2_names = {r["name"] for r in sorted(ok, key=lambda r: -r["separation"])[:2]}
            rest_hits = [r["hit"] for r in rest if r["name"] not in top2_names]
            if rest_hits and (sum(rest_hits) / len(rest_hits)) < 0.45:
                fail = True
                reasons.append("performance_concentrated_in_top2")

    if fail:
        return "REQUIRES_MODEL_REVISION"
    return "PASS_TO_VALIDATION_B"


def _write_report(payload: dict) -> str:
    a = payload["validation_a"]
    dec = payload["decision"]
    lines = []
    lines.append("# G Fresh Validation A Report")
    lines.append("")
    lines.append(f"**Decision:** `{dec['status']}`")
    lines.append(f"**Measured at:** {payload['measured_at']}")
    lines.append("")
    lines.append("## Dataset")
    lines.append("")
    lines.append(f"- SHA OK: {payload['phase0']['sha_ok']}")
    lines.append(f"- Fresh n: {payload['phase1']['n_fresh']} (overlap={payload['phase1']['overlap']})")
    lines.append(f"- Split A/B: {payload['phase1']['n_validation_a']}/{payload['phase1']['n_validation_b']}")
    lines.append(f"- Birth grades: {payload['phase3']['grade_counts']}")
    lines.append(f"- Ineligible (pre-score): {payload['phase3']['ineligible']}")
    lines.append(f"- Val A attempted: {a['subjects_attempted']}")
    lines.append(f"- Val A eligible scored: {a['subjects_eligible']}")
    lines.append(f"- Good/bad label counts (eligible events): {a['n_good_labels']}/{a['n_bad_labels']}")
    lines.append("")
    lines.append("## Birth QA note")
    lines.append("")
    lines.append(payload["phase3"]["note"])
    lines.append("")
    lines.append(
        f"- max|Δ vs supplied|: {payload['birth_qa_summary']['max_abs_delta_vs_supplied']} min "
        f"(EOT expected)"
    )
    lines.append(
        f"- max|Δ vs lon-only|: {payload['birth_qa_summary']['max_abs_delta_vs_lon_only']} min "
        f"(gate ≤{MAX_ENGINE_DELTA_VS_LON_ONLY})"
    )
    lines.append("")
    lines.append("## Primary results (`G_CLEAN_AXIS`)")
    lines.append("")
    p = a["G_CLEAN_AXIS"]
    lines.append(f"- subject hit: **{p['hit']}** ({p['hit_rate']}%)")
    lines.append(f"- pairwise mean: **{p['pairwise_mean']}**")
    lines.append(f"- standardized separation: **{p['standardized_separation']}**")
    lines.append("")
    lines.append("## Secondary")
    lines.append("")
    lines.append(f"- AUC macro: {p['auc_macro']}")
    lines.append(f"- AUC micro: {p['auc_micro']}")
    lines.append(f"- raw sep mean/median: {p['raw_separation_mean']} / {p['raw_separation_median']}")
    lines.append(f"- subject sep median/p25/p75/worst: {p['subject_sep_dist']}")
    lines.append("")
    lines.append("## Structural")
    lines.append("")
    lines.append(f"- {p['structural']}")
    lines.append("")
    lines.append("## Per-subject")
    lines.append("")
    lines.append("| name | n_g | n_b | good_avg | bad_avg | sep | hit | pairwise |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|")
    for r in p["subjects"]:
        if r.get("status") != "ok":
            lines.append(
                f"| {r['name']} | {r.get('n_good')} | {r.get('n_bad')} | — | — | — | — | {r.get('status')} |"
            )
        else:
            lines.append(
                f"| {r['name']} | {r['n_good']} | {r['n_bad']} | {r['good_avg']} | {r['bad_avg']} | "
                f"{r['separation']} | {r['hit']} | {r['pairwise']} |"
            )
    lines.append("")
    lines.append("## Failures (hit=0)")
    lines.append("")
    for r in p["failures"]:
        lines.append(f"- {r['name']}: sep={r['separation']} pair={r['pairwise']}")
    if not p["failures"]:
        lines.append("- none")
    lines.append("")
    if a.get("G_REF_readonly"):
        lines.append("## G_REF read-only reference (not used for decision)")
        lines.append("")
        gr = a["G_REF_readonly"]
        lines.append(
            f"- hit {gr['hit']} ({gr['hit_rate']}%), pairwise {gr['pairwise_mean']}, "
            f"std_sep {gr['standardized_separation']}"
        )
        lines.append("")
    lines.append("## Development comparison (contaminated — not pooled)")
    lines.append("")
    lines.append(
        "Dev G_CLEAN_AXIS reference: hold std_sep≈0.152, pairwise≈0.583, hit=60%. "
        "Fresh A is judged on directionality / distribution / structure, not exact reproduction."
    )
    lines.append("")
    lines.append(f"## Decision rationale")
    lines.append("")
    lines.append(dec.get("rationale", ""))
    lines.append("")
    if dec["status"] == "PASS_TO_VALIDATION_B":
        lines.append("Validation B remains **untouched**. Do not score B in this run.")
    elif dec["status"] == "REQUIRES_MODEL_REVISION":
        lines.append("Do **not** open Validation B. A is now development evidence.")
    else:
        lines.append("Candidate scoring skipped or invalid due to dataset QA.")
    lines.append("")
    lines.append("## Hard prohibitions respected")
    lines.append("")
    lines.append("- no engine edit, no α/κ/β/D change, no weight opt, no B scoring, no label edits after freeze")
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-score", action="store_true", help="QA only")
    args = ap.parse_args(argv)

    print("══════════ G Fresh Validation A ══════════")
    fresh = json.load(open(FRESH_JSON, encoding="utf-8"))

    # Phase 0
    print("── Phase 0 SHA/schema ──")
    p0 = phase0_sha_and_schema(fresh)
    print(f"sha_ok={p0['sha_ok']} schema_ok={p0['schema_ok']} n={p0['n_subjects']}")
    if not p0["sha_ok"]:
        print("STOP: SHA mismatch", p0)
        open(OUT_REPORT, "w", encoding="utf-8").write(
            f"# DATASET_QA_FAILURE\n\nSHA mismatch\n\n{json.dumps(p0, indent=2)}\n"
        )
        return 2

    # Phase 1
    print("── Phase 1 contamination ──")
    p1 = phase1_contamination(fresh)
    print(f"overlap={p1['overlap']} split_ok={p1['split_ok']}")
    if not p1["overlap_ok"] or not p1["split_ok"] or p1["n_fresh"] != 30:
        print("STOP: contamination/split failure")
        open(OUT_REPORT, "w", encoding="utf-8").write(
            f"# DATASET_QA_FAILURE\n\n{json.dumps(p1, indent=2)}\n"
        )
        return 2

    # Phase 2 birth QA
    print("── Phase 2 birth recompute ──")
    birth_rows = [engine_recompute_birth(s) for s in fresh["subjects"]]
    birth_payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "method": "sajupy longitude×4min on local standard clock; no EOT; no KST conversion",
        "rows": birth_rows,
    }
    with open(OUT_BIRTH_QA, "w", encoding="utf-8") as f:
        json.dump(birth_payload, f, ensure_ascii=False, indent=2)
    birth_summary = {
        "max_abs_delta_vs_supplied": round(max(abs(r["delta_minutes_vs_supplied"]) for r in birth_rows), 3),
        "max_abs_delta_vs_lon_only": round(
            max(abs(r["delta_minutes_vs_lon_only_expected"]) for r in birth_rows), 3
        ),
        "n_hour_branch_mismatch_vs_supplied": sum(
            1 for r in birth_rows if r["crosses_hour_branch_vs_supplied"]
        ),
        "n_out_of_sajupy_year_range": sum(
            1 for r in birth_rows if not r["engine_year_in_sajupy_range"]
        ),
    }
    print("birth_summary", birth_summary)

    # Phase 3
    print("── Phase 3 quality gate ──")
    p3 = phase3_quality(fresh, birth_rows)
    print("grades", p3["grade_counts"], "ineligible", p3["ineligible"])

    # Phase 4
    print("── Phase 4 label QA ──")
    p4 = phase4_label_qa(fresh)
    print(f"label issues={len(p4['issues'])}")

    by_birth = {r["name"]: r for r in birth_rows}
    elig_map = {e["name"]: e for e in p3["eligible"]}
    freeze = {
        "dataset_path": "test/experiments/g_fresh_subjects_completed.json",
        "dataset_sha256": p0["sha_actual"],
        "labels_frozen": True,
        "frozen_at": datetime.now().isoformat(timespec="seconds"),
        "candidate_model": "G_CLEAN_AXIS",
        "validation_a": p1["validation_a"],
        "validation_b": p1["validation_b"],
        "eligible_for_primary_validation": [e["name"] for e in p3["eligible"]],
        "ineligible_for_primary_validation": p3["ineligible"],
        "eligible_events": p4["eligible_events"],
        "label_issues": p4["issues"],
        "birth_qa_path": "test/experiments/exp_g_fresh_birth_qa.json",
        "scoring_clock": "engine_recomputed LOCAL_TRUE_SOLAR lon-only",
        "note": "Do not edit labels during Validation A.",
    }
    with open(OUT_LABELS, "w", encoding="utf-8") as f:
        json.dump(freeze, f, ensure_ascii=False, indent=2)
    print(f"froze → {OUT_LABELS}")

    if args.skip_score:
        print("skip-score set; stopping after freeze")
        return 0

    # Phase 6 — Validation A only
    print("── Phase 6 score Validation A only ──")
    a_subjects = []
    for s in fresh["subjects"]:
        if s.get("split") == "validation_b":
            continue  # hard reject B
        if s.get("split") != "validation_a":
            continue
        a_subjects.append(s)

    packs = []
    skipped = []
    for s in a_subjects:
        br = by_birth[s["name"]]
        if s["name"] not in elig_map:
            skipped.append({"name": s["name"], "reason": "ineligible_pre_score"})
            continue
        if s["split"] == "validation_b":
            raise RuntimeError("BUG: attempted to score validation_b")
        ev = p4["eligible_events"][s["name"]]
        if len(ev["good"]) < 1 or len(ev["bad"]) < 1:
            skipped.append({"name": s["name"], "reason": "insufficient_eligible_events"})
            continue
        print(f"  packing {s['name']} …")
        packs.append(_pack_subject(s, br["engine_birth"], ev))

    print(f"scored packs={len(packs)} skipped={skipped}")
    primary = _eval_packs(packs, "G_CLEAN_AXIS")
    ref = _eval_packs(packs, "G_REF")

    n_good = sum(len(p4["eligible_events"][s["name"]]["good"]) for s in a_subjects if s["name"] in elig_map)
    n_bad = sum(len(p4["eligible_events"][s["name"]]["bad"]) for s in a_subjects if s["name"] in elig_map)

    val_a = {
        "subjects_attempted": len(a_subjects),
        "subjects_eligible": len(packs),
        "skipped": skipped,
        "n_good_labels": n_good,
        "n_bad_labels": n_bad,
        "G_CLEAN_AXIS": primary,
        "G_REF_readonly": {
            "hit": ref["hit"],
            "hit_rate": ref["hit_rate"],
            "pairwise_mean": ref["pairwise_mean"],
            "standardized_separation": ref["standardized_separation"],
            "note": "read-only reference; does not change candidate",
        },
    }

    status = _decision(primary, p3, p1, p0)
    rationale_parts = [
        f"hit={primary.get('hit')} pairwise={primary.get('pairwise_mean')} "
        f"std_sep={primary.get('standardized_separation')} sat={primary['structural'].get('sat_rate')}",
        f"eligible_scored={len(packs)}/{len(a_subjects)} (ineligible pre-score: {p3['ineligible']})",
        "Validation B not scored.",
    ]
    if status == "PASS_TO_VALIDATION_B":
        rationale_parts.append(
            "Primary metrics above predeclared fail floors; proceed to a separate B confirmation run later."
        )
    elif status == "REQUIRES_MODEL_REVISION":
        rationale_parts.append(
            "Failed predeclared floors or concentration check; do not open B; revise model offline."
        )
    else:
        rationale_parts.append("Dataset QA blocked reliable scoring.")

    decision = {"status": status, "rationale": " ".join(rationale_parts)}

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "G_FRESH_VALIDATION_A",
        "candidate": "G_CLEAN_AXIS",
        "phase0": p0,
        "phase1": p1,
        "phase3": p3,
        "birth_qa_summary": birth_summary,
        "label_issue_count": len(p4["issues"]),
        "validation_a": val_a,
        "validation_b": {"scored": False, "subjects": p1["validation_b"]},
        "decision": decision,
        "dev_reference_not_pooled": {
            "G_CLEAN_AXIS_dev_hold": {"std_sep": 0.152, "pairwise": 0.583, "hit": 60.0}
        },
    }

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    report = _write_report(payload)
    open(OUT_REPORT, "w", encoding="utf-8").write(report)

    print("\n══════════ DECISION ══════════")
    print(decision["status"])
    print(decision["rationale"])
    print(f"snapshot → {OUT_SNAP}")
    print(f"report → {OUT_REPORT}")
    return 0 if status != "DATASET_QA_FAILURE" else 2


if __name__ == "__main__":
    sys.exit(main())
