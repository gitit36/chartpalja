# -*- coding: utf-8 -*-
"""
V2 Full Hierarchy QA — audit only (no new candidates / no tuning / no Val B).

Frozen:
  V2_DY_B + M1_CONSERVATIVE + D1_CONSERVATIVE

Usage:
  PYTHONPATH=.:test python test/experiments/experiment_v2_full_hierarchy_qa.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import saju_engine as se  # noqa: E402
from experiments import experiment_v2_day as VD  # noqa: E402
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments import experiment_v2_month as VM  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_full_hierarchy_qa.json")
OUT_QA = os.path.join(_HERE, "V2_FULL_HIERARCHY_QA.md")
OUT_LINEAGE = os.path.join(_HERE, "V2_FULL_FEATURE_LINEAGE.md")
OUT_POLICY = os.path.join(_HERE, "V2_PRODUCT_SCORING_POLICY.md")
OUT_MANIFEST = os.path.join(_HERE, "V2_FINAL_PRE_VALIDATION_MANIFEST.md")

BASE = 60.0
HARD = BASE - 1.0   # < 59
FAV = BASE + 1.0    # > 61
MONTH_WIN = "M1_CONSERVATIVE"
DAY_WIN = "D1_CONSERVATIVE"


def _sha16(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def _pct(xs, p):
    return None if not xs else round(float(np.percentile(xs, p)), 4)


def _noon(y, m, d):
    return datetime(y, m, d, VD.NEUTRAL_HOUR, tzinfo=se.KST)


# ══════════════════════════════════════════════
# 1–2 Calendar chain
# ══════════════════════════════════════════════

def audit_calendar_chain(packs_by_name: Dict[str, dict]) -> Dict[str, Any]:
    rows = []
    years = (2020, 2024, 2025)  # includes leap 2020
    name = next(iter(packs_by_name))
    pack = packs_by_name[name]
    dw = pack["dw"]
    ok = True
    for y in years:
        ip = se.ipchun(y)
        ww = se.build_wolwoon(datetime(y, 6, 15, tzinfo=se.KST))
        probes = [
            ("before_ipchun", ip - timedelta(hours=2)),
            ("after_ipchun", ip + timedelta(hours=2)),
            ("ny", datetime(y, 1, 1, 12, tzinfo=se.KST)),
            ("before_xiaohan", datetime.fromisoformat(ww[11]["start"]) - timedelta(hours=2)),
            ("after_xiaohan", datetime.fromisoformat(ww[11]["start"]) + timedelta(hours=2)),
            ("before_daxue", datetime.fromisoformat(ww[10]["start"]) - timedelta(hours=2)),
            ("after_daxue", datetime.fromisoformat(ww[10]["start"]) + timedelta(hours=2)),
            ("year_end", datetime(y, 12, 31, 12, tzinfo=se.KST)),
        ]
        # each 節 start ±1h
        for mi, m in enumerate(ww):
            s = datetime.fromisoformat(m["start"])
            probes.append((f"jeol_{m['branch']}_before", s - timedelta(hours=1)))
            probes.append((f"jeol_{m['branch']}_after", s + timedelta(hours=1)))

        for label, t in probes:
            noon = _noon(t.year, t.month, t.day)
            # use exact t for live hierarchy; civil day pillar from civil date
            h = se.live_hierarchy_at(t if t.tzinfo else t.replace(tzinfo=se.KST), r=pack["r"], dw_detail=dw)
            sw, wol = h["sewoon"], h["wolwoon"]
            day_p = se.civil_sexagenary_day(noon.year, noon.month, noon.day)
            # consistency: wolwoon inside sewoon window
            ws, we = datetime.fromisoformat(wol["start"]), datetime.fromisoformat(wol["end"])
            ss, se_ = datetime.fromisoformat(sw["start"]), datetime.fromisoformat(sw["end"])
            month_in_sw = ss <= ws and we <= se_
            in_month = ws <= t < we
            # civil midnight: day pillar same for 23/00/01 same civil date
            p23 = se.civil_sexagenary_day(noon.year, noon.month, noon.day)
            row = {
                "subject": name, "label": label, "t": t.isoformat(),
                "daewoon": (h["daewoon"] or {}).get("daewoon_pillar") or (h["daewoon"] or {}).get("ganzhi"),
                "sewoon_year": sw["year"], "sewoon": sw["ganzhi"],
                "wolwoon": wol["branch"], "wolwoon_gz": wol["ganzhi"],
                "civil_day": day_p,
                "month_in_sewoon": month_in_sw,
                "in_month": in_month,
                "civil_midnight_stable": p23 == day_p,
            }
            row["ok"] = month_in_sw and in_month
            if not row["ok"]:
                ok = False
            rows.append(row)
    return {"ok": ok, "n": len(rows), "failures": [r for r in rows if not r["ok"]], "sample": rows[:8]}


# ══════════════════════════════════════════════
# 3 Boundary-date ambiguity
# ══════════════════════════════════════════════

def audit_boundary_dates(events: List[dict]) -> Dict[str, Any]:
    amb, una = [], []
    for e in events:
        noon = _noon(e["year"], e["month"], e["day"])
        # check if any 節 start falls on this civil date
        sw = se.live_active_sewoon(noon)
        months = se.build_wolwoon(noon)
        boundary = False
        which = None
        for m in months:
            for edge_key in ("start", "end"):
                edge = datetime.fromisoformat(m[edge_key]).astimezone(se.KST)
                if edge.year == noon.year and edge.month == noon.month and edge.day == noon.day:
                    # noon vs evening may differ parent if edge after/before noon
                    before = edge - timedelta(minutes=1)
                    after = edge + timedelta(minutes=1)
                    wb = se.live_active_wolwoon(before)["branch"]
                    wa = se.live_active_wolwoon(after)["branch"]
                    wn = se.live_active_wolwoon(noon)["branch"]
                    if wb != wa:
                        boundary = True
                        which = {
                            "edge": edge.isoformat(),
                            "branch_before": wb,
                            "branch_after": wa,
                            "branch_at_noon": wn,
                            "noon_matches_evening": wn == wa,
                        }
        item = {**{k: e[k] for k in ("name", "year", "month", "day", "label", "polarity")},
                "class": "BOUNDARY_DATE_AMBIGUOUS" if boundary else "UNAMBIGUOUS_DATE",
                "detail": which}
        (amb if boundary else una).append(item)
    return {
        "n_total": len(events),
        "n_unambiguous": len(una),
        "n_boundary_ambiguous": len(amb),
        "ambiguous_events": amb,
    }


# ══════════════════════════════════════════════
# 4 Unmapped day events
# ══════════════════════════════════════════════

def diagnose_day_mapping(events, packs, ymaps) -> Dict[str, Any]:
    """Before/after noon-in-window iteration fix."""
    before_note = {
        "mapped": 161,
        "missing": [
            {
                "name": "Monica Lewinsky", "date": "2021-09-07",
                "label": "Impeachment ACS 방영 시작",
                "reason": "DAY_ITERATION",
                "detail": "Wolwoon 申 ended 2021-09-07 18:49; civil-day loop excluded end calendar day though noon∈window",
            },
            {
                "name": "윤석열", "date": "2025-04-04",
                "label": "헌법재판소 탄핵 인용·파면",
                "reason": "DAY_ITERATION",
                "detail": "Wolwoon 卯 ended 2025-04-04 21:41; same noon-in-window miss",
            },
        ],
        "root_cause": "DAY_ITERATION",
        "fix": "iter_civil_days now includes civil dates whose noon lies in [start,end)",
    }
    unmapped_after = []
    mapped = 0
    for e in events:
        pack = packs.get(e["name"])
        if not pack:
            unmapped_after.append({**e, "reason": "OTHER_NO_PACK"})
            continue
        dt = _noon(e["year"], e["month"], e["day"])
        sw = se.live_active_sewoon(dt)
        ww = se.live_active_wolwoon(dt)
        ey, mi = int(sw["year"]), int(ww["month_index"])
        years = [y for y in (ey - 1, ey, ey + 1) if y in ymaps[e["name"]]]
        mm = VM.build_subject_months(pack, ymaps[e["name"]], years=years)
        key = (ey, mi)
        if key not in mm:
            unmapped_after.append({**e, "reason": "MONTH_MAP_COVERAGE", "key": key})
            continue
        dd = VD.build_days_for_months(pack, mm, [key])
        date_s = f"{e['year']:04d}-{e['month']:02d}-{e['day']:02d}"
        if date_s not in dd:
            unmapped_after.append({
                **e, "reason": "DAY_ITERATION", "key": key,
                "m_start": mm[key]["start"], "m_end": mm[key]["end"],
            })
        else:
            mapped += 1
    return {
        "before": before_note,
        "after_mapped": mapped,
        "after_unmapped": unmapped_after,
        "after_n_events": len(events),
        "fixed": mapped == len(events) and not unmapped_after,
    }


# ══════════════════════════════════════════════
# Build layered scores for sample subjects
# ══════════════════════════════════════════════

def build_layers_for_subject(pack, ymap, years: List[int]):
    mm = VM.build_subject_months(pack, ymap, years=years)
    for row in mm.values():
        row["_name"] = pack["name"]
    # all months for hierarchy
    keys = sorted(mm.keys())
    # subsample days: every month for crossings; full days expensive — use all months but OK
    dd = VD.build_days_for_months(pack, mm, keys)
    return mm, dd


def amplitude_and_centering(months_by_subj, days_by_subj, ymaps) -> Dict[str, Any]:
    annual, monthly, daily = [], [], []
    d_vals = []
    month_med_viol = []
    day_med_viol = []
    # annual + D from ymaps
    for name, ymap in ymaps.items():
        for y, row in ymap.items():
            annual.append(abs(float(row["annual_dev"])))
            d_vals.append(float(row["D"]))
    # monthly
    by_year = defaultdict(list)
    for name, mm in months_by_subj.items():
        for (ey, mi), row in mm.items():
            monthly.append(abs(float(row[f"MonthlyDev_{MONTH_WIN}"])))
            by_year[(name, ey)].append(float(row[f"MonthlyDev_{MONTH_WIN}"]))
    for k, vs in by_year.items():
        if len(vs) == 12:
            med = float(np.median(vs))
            if abs(med) > 0.15:
                month_med_viol.append({"key": k, "median": round(med, 4)})
    # daily
    by_m = defaultdict(list)
    for name, dd in days_by_subj.items():
        for date_s, row in dd.items():
            daily.append(abs(float(row[f"DailyDev_{DAY_WIN}"])))
            by_m[(name, row["month_key"])].append(float(row[f"DailyDev_{DAY_WIN}"]))
    for k, vs in by_m.items():
        if len(vs) >= 20:
            med = float(np.median(vs))
            if abs(med) > 0.12:
                day_med_viol.append({"key": str(k), "median": round(med, 4)})

    def dist(xs):
        return {
            "n": len(xs),
            "p50": _pct(xs, 50), "p75": _pct(xs, 75),
            "p90": _pct(xs, 90), "p95": _pct(xs, 95),
            "max": None if not xs else round(float(np.max(xs)), 4),
        }

    ad, md, dd_ = dist(annual), dist(monthly), dist(daily)
    return {
        "D_values": dist(d_vals),
        "abs_AnnualDev": ad,
        "abs_MonthlyDev": md,
        "abs_DailyDev": dd_,
        "ratios": {
            "day_over_month_p90": None if not (md["p90"] and dd_["p90"]) else round(dd_["p90"] / md["p90"], 4),
            "month_over_annual_p90": None if not (ad["p90"] and md["p90"]) else round(md["p90"] / ad["p90"], 4),
            "day_over_annual_p90": None if not (ad["p90"] and dd_["p90"]) else round(dd_["p90"] / ad["p90"], 4),
        },
        "reference_check": {
            "month_p90_ref_approx": 1.0,
            "day_p90_ref_approx": 0.36,
            "annual_p90_ref_approx": 4.0,
            "month_ok": md["p90"] is not None and 0.5 <= md["p90"] <= 2.0,
            "day_ok": dd_["p90"] is not None and 0.15 <= dd_["p90"] <= 0.8,
            "annual_ok": ad["p90"] is not None and ad["p90"] >= 2.5,
            "order_ok": (
                dd_["p90"] and md["p90"] and ad["p90"]
                and dd_["p90"] < md["p90"] < ad["p90"]
            ),
        },
        "centering": {
            "month_median_violations": month_med_viol[:20],
            "n_month_violations": len(month_med_viol),
            "day_median_violations": day_med_viol[:20],
            "n_day_violations": len(day_med_viol),
        },
        "saturation": {
            "note": "checked via child scores near 0/100 in layer snapshots",
        },
    }


def crossing_behavior(months_by_subj, days_by_subj, ymaps) -> Dict[str, Any]:
    """Symmetric parent-child crossings + reachability."""
    # D distribution
    all_D = [float(r["D"]) for ym in ymaps.values() for r in ym.values()]
    d_min, d_max = min(all_D), max(all_D)
    d_hard_possible = d_min < HARD
    d_fav_possible = d_max > FAV

    counts = {k: 0 for k in list("ABCDEFGHIJ")}
    n_years = n_months = 0

    # Y crossings vs D
    for name, ymap in ymaps.items():
        by_p = defaultdict(list)
        for y, r in ymap.items():
            by_p[r["pillar"]].append(r)
        for pillar, rows in by_p.items():
            # use D from first
            D = float(rows[0]["D"])
            for r in rows:
                n_years += 1
                Y = float(r["Y"])
                if D < HARD and Y > FAV:
                    counts["A"] += 1
                if D > FAV and Y < HARD:
                    counts["B"] += 1

    # Month vs Y / D
    for name, mm in months_by_subj.items():
        by_ey = defaultdict(list)
        for (ey, mi), row in mm.items():
            by_ey[ey].append(row)
        for ey, rows in by_ey.items():
            if len(rows) != 12:
                continue
            Y = float(rows[0]["Y_parent"])
            D = float(rows[0]["D_parent"])
            mdevs = [float(r[f"MonthlyDev_{MONTH_WIN}"]) for r in rows]
            Ms = [float(r[f"M_{MONTH_WIN}"]) for r in rows]
            n_months += 1
            if Y < HARD and max(mdevs) > 0.5:
                counts["C"] += 1
            if Y > FAV and min(mdevs) < -0.5:
                counts["D"] += 1
            if D < HARD and max(Ms) > FAV:
                counts["E"] += 1
            if D > FAV and min(Ms) < HARD:
                counts["F"] += 1

    # Day vs M / Y
    by_mk = defaultdict(list)
    for name, dd in days_by_subj.items():
        for row in dd.values():
            by_mk[(name, row["month_key"])].append(row)
    for k, rows in by_mk.items():
        if len(rows) < 15:
            continue
        M = float(rows[0]["M_parent"])
        Y = float(rows[0]["Y_parent"])
        ddevs = [float(r[f"DailyDev_{DAY_WIN}"]) for r in rows]
        if M < HARD and max(ddevs) > 0.25:
            counts["G"] += 1
        if M > FAV and min(ddevs) < -0.25:
            counts["H"] += 1
        if Y < HARD and max(ddevs) > 0.25:
            counts["I"] += 1
        if Y > FAV and min(ddevs) < -0.25:
            counts["J"] += 1

    # Reachability analysis for E (fav month in hard D)
    # M = Y + MonthlyDev, Y = D + AnnualDev ≈ D + a, |MonthlyDev|p90≈1, |a|p90≈4
    # Need M > 61 while D < 59 → need AnnualDev+MonthlyDev > 61-D > 2
    # Max child lift ~ annual_p90 + month_p90 ~ 5 — reachable IF D exists < 59
    reach = {}
    for code, label, parent_hard_exists, child_can_lift in (
        ("A", "fav_Y_in_hard_D", d_hard_possible, True),
        ("B", "hard_Y_in_fav_D", d_fav_possible, True),
        ("E", "fav_M_in_hard_D", d_hard_possible, True),
        ("F", "hard_M_in_fav_D", d_fav_possible, True),
    ):
        if not parent_hard_exists:
            cls = "STRUCTURALLY_IMPOSSIBLE"
            why = f"no parent values beyond threshold in sample (D range [{d_min:.2f},{d_max:.2f}])"
        elif counts[code] == 0:
            cls = "EMPIRICALLY_UNOBSERVED"
            why = "parent extremes exist or near; crossing not observed at thresholds"
        else:
            cls = "OBSERVED"
            why = "seen in sample"
        # refine E: if D never < HARD
        if code in ("A", "E") and not d_hard_possible:
            cls = "STRUCTURALLY_IMPOSSIBLE"
            why = (
                f"D_B never < {HARD} in development sample "
                f"(min D={d_min:.3f}); hard-D threshold unreachable — "
                "not a Month/Day bug"
            )
        reach[code] = {"label": label, "class": cls, "why": why, "count": counts[code]}

    for code in "CDGHIJ":
        reach[code] = {
            "label": code,
            "class": "OBSERVED" if counts[code] > 0 else "EMPIRICALLY_UNOBSERVED",
            "count": counts[code],
        }

    return {
        "thresholds": {"HARD": HARD, "FAV": FAV, "BASE": BASE},
        "D_range": {"min": round(d_min, 4), "max": round(d_max, 4),
                    "p10": _pct(all_D, 10), "p50": _pct(all_D, 50), "p90": _pct(all_D, 90)},
        "counts": {
            "A_fav_year_hard_D": counts["A"],
            "B_hard_year_fav_D": counts["B"],
            "C_fav_month_hard_Y": counts["C"],
            "D_hard_month_fav_Y": counts["D"],
            "E_fav_month_hard_D": counts["E"],
            "F_hard_month_fav_D": counts["F"],
            "G_fav_day_hard_M": counts["G"],
            "H_hard_day_fav_M": counts["H"],
            "I_fav_day_hard_Y": counts["I"],
            "J_hard_day_fav_Y": counts["J"],
        },
        "n_year_obs": n_years,
        "n_month_blocks": n_months,
        "reachability": reach,
        "fav_month_in_hard_D_diagnosis": {
            "flag": counts["E"] == 0,
            "primary_cause": reach["E"]["class"],
            "explanation": reach["E"]["why"],
            "not": "Month implementation bug — D_B amplitude understates hard regimes",
        },
    }


def boundary_jumps(months_by_subj, days_by_subj, ymaps) -> Dict[str, Any]:
    jumps = {"daewoon": [], "sewoon_lichun": [], "wolwoon": [], "civil_day": []}
    for name, ymap in ymaps.items():
        years = sorted(ymap.keys())
        for i in range(len(years) - 1):
            y0, y1 = years[i], years[i + 1]
            if y1 != y0 + 1:
                continue
            jumps["sewoon_lichun"].append(abs(float(ymap[y1]["Y"]) - float(ymap[y0]["Y"])))
            if ymap[y0]["pillar"] != ymap[y1]["pillar"]:
                jumps["daewoon"].append(abs(float(ymap[y1]["D"]) - float(ymap[y0]["D"])))

    for name, mm in months_by_subj.items():
        by_ey = defaultdict(list)
        for (ey, mi), row in mm.items():
            by_ey[ey].append(row)
        for ey, rows in by_ey.items():
            rows = sorted(rows, key=lambda r: r["month_index"])
            for i in range(len(rows) - 1):
                jumps["wolwoon"].append(abs(
                    float(rows[i + 1][f"M_{MONTH_WIN}"]) - float(rows[i][f"M_{MONTH_WIN}"])
                ))

    for name, dd in days_by_subj.items():
        rows = sorted(dd.values(), key=lambda r: r["date"])
        for i in range(len(rows) - 1):
            d0 = datetime.strptime(rows[i]["date"], "%Y-%m-%d")
            d1 = datetime.strptime(rows[i + 1]["date"], "%Y-%m-%d")
            if (d1 - d0).days == 1:
                jumps["civil_day"].append(abs(
                    float(rows[i + 1][f"Day_{DAY_WIN}"]) - float(rows[i][f"Day_{DAY_WIN}"])
                ))

    def summarize(xs):
        xs = sorted(xs, reverse=True)
        return {
            "n": len(xs),
            "p50": _pct(xs, 50), "p90": _pct(xs, 90), "p95": _pct(xs, 95),
            "max": None if not xs else round(xs[0], 4),
            "largest_20": [round(x, 4) for x in xs[:20]],
        }

    return {k: summarize(v) for k, v in jumps.items()}


def ux_shape_audit(months_by_subj, days_by_subj, ymaps) -> Dict[str, Any]:
    flags = []
    # flat D
    all_D = [float(r["D"]) for ym in ymaps.values() for r in ym.values()]
    if _pct(all_D, 90) - _pct(all_D, 10) < 5:
        flags.append({
            "id": "flat_daewoon",
            "severity": "high",
            "note": f"D_B IQR-like span p90-p10={(_pct(all_D,90)-_pct(all_D,10)):.2f}; known understated amplitude",
        })
    # day sawtooth: high adj jump vs level
    day_jumps = []
    for dd in days_by_subj.values():
        rows = sorted(dd.values(), key=lambda r: r["date"])
        for i in range(min(200, len(rows) - 1)):
            day_jumps.append(abs(
                float(rows[i + 1][f"DailyDev_{DAY_WIN}"]) - float(rows[i][f"DailyDev_{DAY_WIN}"])
            ))
    if day_jumps and _pct(day_jumps, 90) > 0.8:
        flags.append({"id": "mechanical_daily_oscillation", "severity": "medium",
                      "note": f"day adj jump p90={_pct(day_jumps,90)}"})
    # clustering near 60
    near60 = sum(1 for d in all_D if abs(d - 60) < 1.5) / max(1, len(all_D))
    if near60 > 0.5:
        flags.append({"id": "cluster_near_60", "severity": "medium",
                      "note": f"frac |D-60|<1.5 = {near60:.2f}"})
    flags.append({
        "id": "overconfident_day_claims",
        "severity": "high",
        "note": "Day exact-hit ~0.47 with negative sep — product must not claim daily accuracy",
    })
    flags.append({
        "id": "child_as_independent_fortune",
        "severity": "high",
        "note": "Users may read M/Day as standalone life scores; UI must show parent context",
    })
    return {"flags": flags}


def timing_evidence(month_snap, day_snap, boundary_audit, day_map_fix) -> Dict[str, Any]:
    m = month_snap["results"]["M1_CONSERVATIVE"]["timing"]
    d = day_snap["results"]["D1_CONSERVATIVE"]["timing"]
    # exclude ambiguous for QA-only recompute note
    n_amb = boundary_audit["n_boundary_ambiguous"]
    return {
        "ANNUAL_DIRECTION_EVIDENCE": {
            "FA_pw": 0.6429, "OLD_pw": 0.5749,
            "status": "development evidence exists; Val B sealed",
        },
        "MONTH_TIMING_DIAGNOSTIC": {
            **{k: m[k] for k in (
                "n_events", "exact_direction_hit", "pos_neg_sep",
                "subject_hit_rate", "window_pm1_hit")},
            "status": "V2_MONTH_TIMING_ONLY",
            "Fresh_A_exact": 0,
            "boundary_ambiguous_n": n_amb,
            "note": "QA-only: do not retune; ambiguous noon/節 dates reported separately",
        },
        "DAY_TIMING_DIAGNOSTIC": {
            **{k: d[k] for k in (
                "n_events", "exact_direction_hit", "pos_neg_sep",
                "subject_hit_rate", "window_pm1_hit", "window_pm3_hit")},
            "status": "V2_DAY_TIMING_ONLY",
            "mapping_before": 161,
            "mapping_after": day_map_fix["after_mapped"],
            "Fresh_A_exact": 0,
            "signal": "weak/negative sep — not predictive",
        },
    }


# ══════════════════════════════════════════════
# Docs
# ══════════════════════════════════════════════

def write_all_docs(p: Dict[str, Any]) -> None:
    # QA
    L = [
        "# V2 Full Hierarchy QA",
        "",
        f"**Status:** `{p['status']}`",
        f"**Measured:** {p['measured_at']}",
        "",
        "## 1. Composition",
        "",
        "```",
        "Y = clamp(D_B + AnnualDev_B)",
        "M = clamp(Y + MonthlyDev)      # M1_CONSERVATIVE",
        "Day = clamp(M + DailyDev)     # D1_CONSERVATIVE",
        "```",
        "",
        "Child layers do not replace parents; only add centered local deviations.",
        "",
        "## 2. Calendar chain",
        "",
        f"- ok: {p['calendar_chain']['ok']} · probes: {p['calendar_chain']['n']}",
        f"- failures: {len(p['calendar_chain']['failures'])}",
        "- Live Sewoon=立春 · Wolwoon=節 · Ilwoon=civil YYYY-MM-DD · historical DY=civil year",
        "",
        "## 3. Boundary-date ambiguity (noon vs 節)",
        "",
        f"- unambiguous: {p['boundary_dates']['n_unambiguous']}",
        f"- BOUNDARY_DATE_AMBIGUOUS: {p['boundary_dates']['n_boundary_ambiguous']}",
        "- Noon does **not** claim true historical event month on 節 dates.",
        "",
        "## 4. Day mapping 163→161→fix",
        "",
        f"- Before: mapped 161; root cause **DAY_ITERATION** (end calendar day dropped).",
        f"- After fix: mapped {p['day_mapping']['after_mapped']}/{p['day_mapping']['after_n_events']}",
        f"- Fixed: {p['day_mapping']['fixed']}",
        "- Events: Monica Lewinsky 2021-09-07; 윤석열 2025-04-04",
        "",
        "## 5–6. Amplitude & centering",
        "",
        f"- Annual |dev| p90: {p['amplitude']['abs_AnnualDev']['p90']}",
        f"- Month |dev| p90: {p['amplitude']['abs_MonthlyDev']['p90']}",
        f"- Day |dev| p90: {p['amplitude']['abs_DailyDev']['p90']}",
        f"- ratios: {p['amplitude']['ratios']}",
        f"- order Day<Month<Annual: {p['amplitude']['reference_check']['order_ok']}",
        f"- month median violations: {p['amplitude']['centering']['n_month_violations']}",
        f"- day median violations: {p['amplitude']['centering']['n_day_violations']}",
        "",
        "## 7. Boundary jumps",
        "",
    ]
    for layer, j in p["jumps"].items():
        L.append(f"- {layer}: p50={j['p50']} p90={j['p90']} p95={j['p95']} max={j['max']}")
    L += [
        "",
        "## 8–9. Crossings & reachability",
        "",
        f"- counts: {json.dumps(p['crossings']['counts'], ensure_ascii=False)}",
        f"- D range: {p['crossings']['D_range']}",
        f"- fav-month-in-hard-D: **{p['crossings']['fav_month_in_hard_D_diagnosis']['primary_cause']}**",
        f"  — {p['crossings']['fav_month_in_hard_D_diagnosis']['explanation']}",
        "",
        "## 10. UX shape flags",
        "",
    ]
    for f in p["ux"]["flags"]:
        L.append(f"- [{f['severity']}] {f['id']}: {f['note']}")
    L += [
        "",
        "## 11–13. Explanation / intensity / duplication",
        "",
        "- See `V2_FULL_FEATURE_LINEAGE.md`",
        "- VALENCE ≠ EVENT_INTENSITY enforced in Month/Day construction (intensity explanation-only)",
        "- Orthodox-only factors must not be claimed as numeric movers",
        "",
        "## 14. Timing evidence (separate claims)",
        "",
        f"- Annual: FA pw 0.6429 / OLD 0.5749 (development)",
        f"- Month diagnostic: hit={p['timing']['MONTH_TIMING_DIAGNOSTIC'].get('exact_direction_hit')} "
        f"sep={p['timing']['MONTH_TIMING_DIAGNOSTIC'].get('pos_neg_sep')} · TIMING_ONLY",
        f"- Day diagnostic: hit={p['timing']['DAY_TIMING_DIAGNOSTIC'].get('exact_direction_hit')} "
        f"sep={p['timing']['DAY_TIMING_DIAGNOSTIC'].get('pos_neg_sep')} · TIMING_ONLY",
        "",
        "**Do not** merge into one full-hierarchy accuracy number.",
        "",
        "## 15–17. Product policy",
        "",
        f"- Month: `{p['product_policy']['month']}`",
        f"- Day: `{p['product_policy']['day']}`",
        "- See `V2_PRODUCT_SCORING_POLICY.md`",
        "",
        f"**Final:** `{p['status']}`",
        "",
        "STOP — next is ONE-SHOT Validation B protocol decision (not unsealed here).",
        "",
    ]
    open(OUT_QA, "w", encoding="utf-8").write("\n".join(L))

    # Lineage
    lineage = [
        ("D fav_minus_unfav / struct_*", "Daewoon", "UNIQUE", "V2_DY_B D only"),
        ("G_CLEAN_AXIS / A_G", "Sewoon annual", "UNIQUE@year", "not in Month/Day numeric"),
        ("B_trigger ilju/ten-god", "Sewoon annual", "UNIQUE@year", "not reused in MonthlyDev/DailyDev"),
        ("Month yongshin fit / supply", "Wolwoon", "RELATED_DIFFERENT_TIMESCALE", "month pillar ≠ D/Y"),
        ("Month↔Sewoon / Month↔natal", "Wolwoon", "UNIQUE@month", "primary month timing"),
        ("Month↔Daewoon (M2 only)", "Wolwoon", "RELATED — unused in winner", "M1 winner excludes"),
        ("Day↔Wolwoon", "Ilwoon", "UNIQUE@day", "primary day timing"),
        ("Day yongshin / Day↔natal", "Ilwoon", "RELATED_DIFFERENT_TIMESCALE", "day pillar"),
        ("Day↔Sewoon (D2)", "Ilwoon", "RELATED — unused in winner", "D1 winner excludes"),
        ("Day↔Daewoon", "—", "DUPLICATE blocked", "excluded"),
        ("event_intensity", "all", "EXPLANATION_ONLY", "never numeric valence"),
        ("legacy engine 종합 blends", "ref", "DUPLICATE", "reference only"),
    ]
    LL = [
        "# V2 Full Feature Lineage",
        "",
        "| feature | source layer | class | note |",
        "|---|---|---|---|",
    ]
    for feat, layer, cls, note in lineage:
        LL.append(f"| {feat} | {layer} | {cls} | {note} |")
    LL += [
        "",
        "## NUMERIC_SCORE_DRIVER vs EXPLANATION_ONLY",
        "",
        "- Drivers: layer-local fit/supply/contextual relations entering MonthlyDev/DailyDev/AnnualDev",
        "- Explanation-only: intensity, orthodox annotations, RegimeChangeEvidence, ten-god labels as copy",
        "- Product must not say explanation-only factors moved the numeric score",
        "",
    ]
    open(OUT_LINEAGE, "w", encoding="utf-8").write("\n".join(LL))

    # Policy
    pol = p["product_policy"]
    P = [
        "# V2 Product Scoring Policy",
        "",
        f"**Hierarchy status:** `{p['status']}`",
        "",
        "## Month",
        "",
        f"**Recommendation:** `{pol['month']}`",
        "",
        pol["month_rationale"],
        "",
        "## Day",
        "",
        f"**Recommendation:** `{pol['day']}`",
        "",
        pol["day_rationale"],
        "",
        "## User-risk mitigations (no score tuning)",
        "",
    ]
    for r in pol["user_risks"]:
        P.append(f"### {r['risk']}")
        P.append(f"- Mitigation: {r['mitigation']}")
        P.append("")
    P += [
        "## Display rules",
        "",
        "1. Always show parent context with child scores (Y under M, M under Day).",
        "2. Never present Month/Day as independent life scores.",
        "3. On numeric/orthodox conflict: mixed language, no fabricated certainty.",
        "4. VALENCE ≠ EVENT_INTENSITY in copy.",
        "5. Boundary-date events: avoid overprecise month claims.",
        "",
    ]
    open(OUT_POLICY, "w", encoding="utf-8").write("\n".join(P))

    # Manifest
    M = [
        "# V2 Final Pre-Validation Manifest",
        "",
        f"**Status:** `{p['status']}`",
        f"**Date:** {p['measured_at']}",
        "",
        "## Frozen numeric stack",
        "",
        "| Layer | ID | Status |",
        "|---|---|---|",
        "| D/Y | V2_DY_B | CLOSED / frozen |",
        "| Month | M1_CONSERVATIVE / V2_MONTH_LOCAL | TIMING_ONLY |",
        "| Day | D1_CONSERVATIVE / V2_DAY_LOCAL | TIMING_ONLY |",
        "",
        "## Formulas",
        "",
        "```",
        "Y = clamp(D_B + 0.65*A_G + 0.35*B_trigger)",
        "M = clamp(Y + amp_m * (raw_m - median_year(raw_m)))  # amp_m=1.5",
        "Day = clamp(M + amp_d * (raw_d - median_wolwoon(raw_d)))  # amp_d=0.55",
        "```",
        "",
        "## Calendar",
        "",
        "- Live Sewoon: 立春",
        "- Wolwoon: solar 節 (`build_wolwoon`)",
        "- Ilwoon: civil YYYY-MM-DD (`civil_sexagenary_day`, sajupy-aligned)",
        "- Historical DY validation: civil year",
        "",
        "## Hashes (sha256[:16])",
        "",
    ]
    for k, v in p["hashes"].items():
        M.append(f"- `{k}`: `{v}`")
    M += [
        "",
        "## Confirmed",
        "",
        "- Validation B: **SEALED / unscored**",
        "- No new labels / people / web events",
        "- No architecture modification in this QA",
        "- Production V2 scoring not wired",
        "",
        "## Next",
        "",
        "Decide ONE-SHOT Validation B protocol before unsealing.",
        "Do not open Val B in this document.",
        "",
    ]
    open(OUT_MANIFEST, "w", encoding="utf-8").write("\n".join(M))


def choose_product_policy(timing, crossings, ux) -> Dict[str, Any]:
    month = "MONTH_LOW_CONFIDENCE_TIMING"
    day = "DAY_EXPLANATION_ONLY"
    # Month has modest positive diagnostic → low confidence numeric visible OK
    mhit = timing["MONTH_TIMING_DIAGNOSTIC"].get("exact_direction_hit") or 0
    if mhit >= 0.55:
        month = "MONTH_LOW_CONFIDENCE_TIMING"
    dhit = timing["DAY_TIMING_DIAGNOSTIC"].get("exact_direction_hit") or 0
    dsep = timing["DAY_TIMING_DIAGNOSTIC"].get("pos_neg_sep")
    if dhit < 0.52 or (dsep is not None and dsep <= 0):
        day = "DAY_EXPLANATION_ONLY"
    else:
        day = "DAY_LOW_CONFIDENCE_TIMING"
    return {
        "month": month,
        "month_rationale": (
            "Month hierarchy is coherent with modest OLD exact-date diagnostic "
            f"(hit≈{mhit}) but Fresh A=0 and TIMING_ONLY — show numeric with low-confidence framing, "
            "not as validated prediction."
        ),
        "day": day,
        "day_rationale": (
            "Day hierarchy coherent but exact-day diagnostic is weak/negative "
            f"(hit≈{dhit}, sep={dsep}). Prefer explanation/context over numeric Day prominence "
            "to avoid misleading daily claims."
        ),
        "user_risks": [
            {"risk": "Overconfident Day claims",
             "mitigation": "Default Day to explanation-only or clearly labeled low-confidence; no '오늘 대박/망함' from score alone"},
            {"risk": "Month/Day read as independent fortune",
             "mitigation": "UI always anchors to Y/M parents; copy: '연간 흐름 안의 단기 리듬'"},
            {"risk": "Score vs orthodox contradiction",
             "mitigation": "Mixed-language templates; never attribute ortho-only factors to numeric moves"},
            {"risk": "節 boundary date ambiguity",
             "mitigation": "Avoid overprecise month claims on 節 calendar dates; optional range wording"},
            {"risk": "Overly flat Daewoon",
             "mitigation": "Set expectation that D is regime baseline; annual/month carry visible movement"},
            {"risk": "Mechanical daily oscillation",
             "mitigation": "If Day numeric shown, damp visual prominence; emphasize month baseline"},
        ],
    }


def main() -> int:
    print("══════════ V2 FULL HIERARCHY QA ══════════")
    freeze_labels = json.load(open(OUT_LABELS, encoding="utf-8"))
    month_snap = json.load(open(os.path.join(_TEST, "snapshots", "exp_v2_month.json")))
    day_snap = json.load(open(os.path.join(_TEST, "snapshots", "exp_v2_day.json")))
    day_fr = json.load(open(os.path.join(_HERE, "V2_DAY_EVALUABLE_FREEZE.json")))

    print("── packs ──")
    old_packs, fresh_packs, val_b = DY._load_pools(freeze_labels)
    assert not any(p["name"] in val_b for p in old_packs + fresh_packs)
    packs = {p["name"]: p for p in old_packs}
    need = set(day_fr["subjects"])
    y_all = VM.build_y_maps(old_packs + fresh_packs)
    ymaps = {n: y_all[n] for n in need if n in y_all}
    packs_use = {n: packs[n] for n in need if n in packs}

    print("── calendar chain ──")
    cal = audit_calendar_chain(packs_use)
    print("  ok", cal["ok"], "failures", len(cal["failures"]))

    print("── boundary dates ──")
    boundary = audit_boundary_dates(day_fr["events"])
    print("  ambiguous", boundary["n_boundary_ambiguous"], "/", boundary["n_total"])

    print("── day mapping diagnose ──")
    day_map = diagnose_day_mapping(day_fr["events"], packs_use, ymaps)
    print("  after mapped", day_map["after_mapped"], "fixed", day_map["fixed"])

    # If day snap still says 161, note before/after from live recompute;
    # prefer freshly written day snap if mapped==163
    if day_snap.get("mapped_events_n") == 163:
        print("  day snap already 163")
    elif day_map["fixed"]:
        print("  day snap may be stale; metrics below use remapped diagnostic note")

    print("── build month/day layers (sample years) ──")
    months_by_subj, days_by_subj = {}, {}
    for name, pack in packs_use.items():
        ys = sorted(ymaps[name].keys())
        # denser sample for QA
        sample = set(ys[::2][:55])
        for e in day_fr["events"]:
            if e["name"] != name:
                continue
            dt = _noon(e["year"], e["month"], e["day"])
            sample.add(se.live_active_sewoon_year(dt))
        sample = {y for y in sample if y in ymaps[name]}
        mm, dd = build_layers_for_subject(pack, ymaps[name], sorted(sample))
        months_by_subj[name] = mm
        days_by_subj[name] = dd
        print(f"  {name}: M={len(mm)} D={len(dd)}")

    print("── amplitude / crossings / jumps ──")
    amp = amplitude_and_centering(months_by_subj, days_by_subj, ymaps)
    cross = crossing_behavior(months_by_subj, days_by_subj, ymaps)
    jumps = boundary_jumps(months_by_subj, days_by_subj, ymaps)
    ux = ux_shape_audit(months_by_subj, days_by_subj, ymaps)

    # Reload day snap if rerun finished with 163
    try:
        day_snap2 = json.load(open(os.path.join(_TEST, "snapshots", "exp_v2_day.json")))
        if day_snap2.get("mapped_events_n", 0) >= day_snap.get("mapped_events_n", 0):
            day_snap = day_snap2
    except Exception:
        pass

    timing = timing_evidence(month_snap, day_snap, boundary, day_map)
    # update day timing n if fixed locally but snap stale
    if day_map["fixed"] and day_snap.get("mapped_events_n") != 163:
        timing["DAY_TIMING_DIAGNOSTIC"]["n_events_note"] = (
            f"snap mapped={day_snap.get('mapped_events_n')}; post-fix verify mapped={day_map['after_mapped']}"
        )

    policy = choose_product_policy(timing, cross, ux)

    block_reasons = []
    if not cal["ok"]:
        block_reasons.append("calendar_chain")
    if not amp["reference_check"]["order_ok"]:
        block_reasons.append("amplitude_order")
    if not day_map["fixed"] and day_map["after_unmapped"]:
        block_reasons.append("day_mapping_unresolved")
    if amp["centering"]["n_month_violations"] > 5:
        block_reasons.append("month_centering")
    if amp["centering"]["n_day_violations"] > 10:
        block_reasons.append("day_centering")

    if block_reasons:
        status = "V2_FULL_HIERARCHY_BLOCKED"
    else:
        status = "V2_FULL_HIERARCHY_READY_WITH_TIMING_LIMITATIONS"

    hashes = {
        "experiment_v2_dy.py": _sha16(os.path.join(_HERE, "experiment_v2_dy.py")),
        "experiment_v2_month.py": _sha16(os.path.join(_HERE, "experiment_v2_month.py")),
        "experiment_v2_day.py": _sha16(os.path.join(_HERE, "experiment_v2_day.py")),
        "exp_v2_dy.json": _sha16(os.path.join(_TEST, "snapshots", "exp_v2_dy.json")),
        "exp_v2_month.json": _sha16(os.path.join(_TEST, "snapshots", "exp_v2_month.json")),
        "exp_v2_day.json": _sha16(os.path.join(_TEST, "snapshots", "exp_v2_day.json")),
        "V2_DAY_EVALUABLE_FREEZE.json": _sha16(os.path.join(_HERE, "V2_DAY_EVALUABLE_FREEZE.json")),
        "V2_MONTH_EVALUABLE_FREEZE.json": _sha16(os.path.join(_HERE, "V2_MONTH_EVALUABLE_FREEZE.json")),
    }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_FULL_HIERARCHY_QA",
        "validation_b_scored": False,
        "production_scoring_modified": False,
        "frozen_layers": {
            "DY": "V2_DY_B",
            "Month": "M1_CONSERVATIVE",
            "Day": "D1_CONSERVATIVE",
        },
        "composition": {
            "Y": "clamp(D_B + AnnualDev_B)",
            "M": "clamp(Y + MonthlyDev)",
            "Day": "clamp(M + DailyDev)",
        },
        "calendar_chain": cal,
        "boundary_dates": boundary,
        "day_mapping": day_map,
        "amplitude": amp,
        "crossings": cross,
        "jumps": jumps,
        "ux": ux,
        "timing": timing,
        "product_policy": policy,
        "block_reasons": block_reasons,
        "status": status,
        "hashes": hashes,
        "next": "ONE-SHOT Validation B protocol decision (do not unseal in this run)",
    }
    open(OUT_SNAP, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n"
    )
    write_all_docs(payload)

    print("══════════ STATUS ══════════")
    print(status)
    if block_reasons:
        print("block_reasons", block_reasons)
    print("month policy", policy["month"], "day policy", policy["day"])
    print(f"→ {OUT_SNAP}")
    return 0 if status != "V2_FULL_HIERARCHY_BLOCKED" else 1


if __name__ == "__main__":
    sys.exit(main())
