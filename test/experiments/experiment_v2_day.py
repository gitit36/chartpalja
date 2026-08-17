# -*- coding: utf-8 -*-
"""
V2 Day experiment (Phase 4).

Parents: V2_DY_B + M1_CONSERVATIVE (V2_MONTH_LOCAL)
DayScore = clamp(M_parent + DailyDev)

Candidates: D1 V2_DAY_LOCAL, D2 V2_DAY_CONTEXTUAL
Amplitudes: CONSERVATIVE / BALANCED / EXPRESSIVE

No Val B. No D/Y or Month redesign. No new labels.

Usage:
  PYTHONPATH=.:test python test/experiments/experiment_v2_day.py
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
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments import experiment_v2_month as VM  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_day.json")
OUT_AUDIT = os.path.join(_HERE, "V2_DAY_CALENDAR_AUDIT.md")
OUT_SPEC = os.path.join(_HERE, "V2_DAY_SPEC.md")
OUT_REPORT = os.path.join(_HERE, "V2_DAY_REPORT.md")
OUT_ATTR = os.path.join(_HERE, "V2_DAY_ATTRIBUTION.md")
OUT_FREEZE = os.path.join(_HERE, "V2_DAY_EVALUABLE_FREEZE.json")
MONTH_FREEZE = os.path.join(_HERE, "V2_MONTH_EVALUABLE_FREEZE.json")

# Day amplitudes (predeclared; smaller than Month CONSERVATIVE=1.5)
AMP = {
    "CONSERVATIVE": 0.55,
    "BALANCED": 0.90,
    "EXPRESSIVE": 1.35,
}

W = {
    "day_month": 0.45,      # PRIMARY Day↔Wolwoon
    "day_natal_struct": 0.30,
    "day_natal_rel": 0.25,
    "day_sewoon_d2": 0.12,  # D2 only, nonredundant
}

MONTH_WINNER = "M1_CONSERVATIVE"
NEUTRAL_HOUR = 12  # KST noon — cannot change civil sexagenary day
BASE = 60.0


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


FEATURE_AUDIT = [
    {"feature": "day_month_relations_contextual", "class": "NEW_DAY_INFORMATION",
     "note": "PRIMARY Day↔Wolwoon timing"},
    {"feature": "day_yongshin_fit_net", "class": "RELATED_BUT_DIFFERENT_TIMESCALE",
     "note": "Day pillar fit; not Month M1 month_yongshin_fit"},
    {"feature": "day_fav_unfav_supply", "class": "RELATED_BUT_DIFFERENT_TIMESCALE",
     "note": "Day-pillar element supply"},
    {"feature": "day_natal_relations_contextual", "class": "NEW_DAY_INFORMATION",
     "note": "Day↔natal; Month↔natal already in M — different pillar/timescale"},
    {"feature": "day_sewoon_relations_contextual", "class": "RELATED_BUT_DIFFERENT_TIMESCALE",
     "note": "D2 only when nonredundant vs Day↔Month"},
    {"feature": "day_daewoon_relations", "class": "DUPLICATE",
     "note": "Excluded from DailyDev (not proven independent)"},
    {"feature": "event_intensity", "class": "NEW_DAY_INFORMATION",
     "note": "Explanation-only — not in DailyDev valence"},
    {"feature": "M1 month features / G / B_trigger / D struct", "class": "ALREADY_IN_MONTH/YEAR",
     "note": "Excluded from DailyDev"},
    {"feature": "legacy build_daily_fortune 종합", "class": "DUPLICATE",
     "note": "Reference only"},
]


# ══════════════════════════════════════════════
# CALENDAR AUDIT
# ══════════════════════════════════════════════

def run_calendar_audit() -> Dict[str, Any]:
    """Document + test civil midnight vs 子時; verify sequence & sajupy align."""
    from sajupy import calculate_saju

    issues = []
    policy = {
        "choice": "A_CIVIL_MIDNIGHT",
        "not_chosen": "B_ZI_SHI_ROLLOVER",
        "reason": "Production 일운 API is civil YYYY-MM-DD; natal early_zi is birth-only school variant",
        "neutral_lookup_time": "12:00 KST",
        "helper": "civil_sexagenary_day",
    }

    # Align vs sajupy
    align_rows = []
    for ds in ("1983-01-27", "1984-02-02", "1990-05-15", "2000-01-01",
               "2017-02-03", "2017-02-04", "2024-02-03", "2024-02-04", "2024-02-10"):
        y, m, d = map(int, ds.split("-"))
        sp = calculate_saju(y, m, d, 12, 0)["day_pillar"]
        ej = se.civil_sexagenary_day(y, m, d)
        ok = sp == ej
        align_rows.append({"date": ds, "sajupy": sp, "engine": ej, "ok": ok})
        if not ok:
            issues.append(f"align_fail_{ds}")

    # Consecutive sequence
    seq_ok = True
    prev = None
    start = datetime(2023, 12, 15)
    for i in range(90):
        dt = start + timedelta(days=i)
        cur = se.civil_sexagenary_day(dt.year, dt.month, dt.day)
        if prev and se.next_ganzhi(prev, 1) != cur:
            seq_ok = False
            issues.append(f"seq_break_{dt.date()}")
            break
        prev = cur

    # 23:00 / 00:00 / 01:00 — civil date pillar unchanged (API date-only)
    hour_probe = []
    for date_s, hours in (("2024-02-04", (23, 0, 1)), ("2025-02-03", (23, 0, 1))):
        y, m, d = map(int, date_s.split("-"))
        pillar = se.civil_sexagenary_day(y, m, d)
        for h in hours:
            # Under policy A, hour is irrelevant to 일운 pillar
            hour_probe.append({
                "civil_date": date_s, "hour": h,
                "day_pillar": pillar,
                "note": "일운 uses civil date only; hour ignored",
            })

    # 立春 / solar-term / month rollover: day sequence continuous; parents may switch
    boundary_rows = []
    for y in (2024, 2025):
        ip = se.ipchun(y)
        for label, t in (
            ("before_ipchun", ip - timedelta(hours=3)),
            ("after_ipchun", ip + timedelta(hours=3)),
        ):
            # civil date of t
            cd = t.astimezone(se.KST)
            noon = datetime(cd.year, cd.month, cd.day, NEUTRAL_HOUR, tzinfo=se.KST)
            pillar = se.civil_sexagenary_day(cd.year, cd.month, cd.day)
            sw = se.live_active_sewoon(noon)
            ww = se.live_active_wolwoon(noon)
            boundary_rows.append({
                "label": f"{y}_{label}",
                "civil": f"{cd.year:04d}-{cd.month:02d}-{cd.day:02d}",
                "day_pillar": pillar,
                "sewoon_year": sw["year"],
                "wolwoon": ww["branch"],
            })

    # Wolwoon month edges
    ww = se.build_wolwoon(datetime(2024, 6, 15, tzinfo=se.KST))
    for idx in (0, 10, 11):
        s = _parse_iso(ww[idx]["start"])
        e = _parse_iso(ww[idx]["end"])
        for label, t in (("start+1h", s + timedelta(hours=1)), ("end-1h", e - timedelta(hours=1))):
            cd = t.astimezone(se.KST)
            boundary_rows.append({
                "label": f"month{ww[idx]['branch']}_{label}",
                "civil": f"{cd.year:04d}-{cd.month:02d}-{cd.day:02d}",
                "day_pillar": se.civil_sexagenary_day(cd.year, cd.month, cd.day),
                "wolwoon": se.live_active_wolwoon(
                    datetime(cd.year, cd.month, cd.day, NEUTRAL_HOUR, tzinfo=se.KST)
                )["branch"],
            })

    # Timezone: fixed KST civil date string (no IANA DST in engine)
    tz_note = "Engine uses civil date strings as KST calendar dates; utc_offset on birth only"

    foundation_ok = not issues and seq_ok and all(r["ok"] for r in align_rows)
    audit = {
        "policy": policy,
        "sajupy_align": align_rows,
        "sequence_90d_ok": seq_ok,
        "hour_probes": hour_probe,
        "boundary_rows": boundary_rows,
        "timezone": tz_note,
        "legacy_bug_fixed": {
            "issue": "build_daily_fortune JD epoch was +47 vs sajupy/enrich",
            "fix": "civil_sexagenary_day aligns to sajupy; still civil midnight (not 子時)",
        },
        "issues": issues,
        "foundation_ok": foundation_ok,
    }

    L = [
        "# V2 Day Calendar Audit",
        "",
        f"**Measured:** {datetime.now().isoformat(timespec='seconds')}",
        f"**Foundation OK:** {foundation_ok}",
        "",
        "## Policy choice (not score-optimized)",
        "",
        "| Option | Decision |",
        "|---|---|",
        "| A. Civil midnight / `YYYY-MM-DD` | **SELECTED** (production 일운) |",
        "| B. 子時-based rollover | Not used for 일운 (birth `early_zi_time` only) |",
        "",
        "- Neutral evaluation time for date-only events: **12:00 KST**",
        "- Helper: `saju_engine.civil_sexagenary_day`",
        "",
        "## Legacy bug",
        "",
        "- Prior `build_daily_fortune` JD epoch was systematically **+47** vs sajupy/enrich natal day.",
        "- Fixed by aligning `civil_sexagenary_day` to sajupy while keeping civil-date policy.",
        "",
        "## Sajupy alignment",
        "",
        "| date | sajupy | engine | ok |",
        "|---|---|---|---|",
    ]
    for r in align_rows:
        L.append(f"| {r['date']} | {r['sajupy']} | {r['engine']} | {r['ok']} |")
    L += [
        "",
        f"## Consecutive sequence (90d): {seq_ok}",
        "",
        f"## Issues: {issues or 'none'}",
        "",
        "## Boundary probes (立春 / month)",
        "",
    ]
    for r in boundary_rows[:12]:
        L.append(f"- {r}")
    L.append("")
    open(OUT_AUDIT, "w", encoding="utf-8").write("\n".join(L))
    return audit


# ══════════════════════════════════════════════
# FREEZE LABELS
# ══════════════════════════════════════════════

def freeze_day_labels(val_b: set) -> Dict[str, Any]:
    src = json.load(open(MONTH_FREEZE, encoding="utf-8"))
    events = []
    for e in src["events"]:
        if e["name"] in val_b:
            continue
        if e.get("day") is None:
            continue
        events.append({
            **e,
            "precision": "EXACT_DATE",
            "eval_time": f"{e['year']:04d}-{e['month']:02d}-{e['day']:02d}T{NEUTRAL_HOUR:02d}:00:00+09:00",
            "eval_time_note": "deterministic noon KST; cannot change civil sexagenary day",
            "exact_timestamp_available": False,
        })
    by_subj = defaultdict(lambda: {"pos": 0, "neg": 0, "pool": None})
    for e in events:
        by_subj[e["name"]]["pool"] = e["pool"]
        by_subj[e["name"]]["pos" if e["polarity"] == "positive" else "neg"] += 1
    payload = {
        "frozen_at": datetime.now().isoformat(timespec="seconds"),
        "source": MONTH_FREEZE,
        "rule": "exact civil date; noon KST lookup; no invented event hours; no new labels",
        "n_events": len(events),
        "n_positive": sum(1 for e in events if e["polarity"] == "positive"),
        "n_negative": sum(1 for e in events if e["polarity"] == "negative"),
        "n_subjects": len(by_subj),
        "by_pool": {
            "OLD_DEV": {
                "n_events": sum(1 for e in events if e["pool"] == "OLD_DEV"),
                "n_subjects": sum(1 for v in by_subj.values() if v["pool"] == "OLD_DEV"),
            },
            "FRESH_A_DEV": {
                "n_events": sum(1 for e in events if e["pool"] == "FRESH_A_DEV"),
                "n_subjects": sum(1 for v in by_subj.values() if v["pool"] == "FRESH_A_DEV"),
            },
        },
        "subjects": {k: dict(v) for k, v in sorted(by_subj.items())},
        "events": events,
        "primary_data_sparse": True,
        "sparsity_reasons": [
            "FRESH_A_DEV has zero exact-dated events",
            f"only {len(by_subj)} OLD subjects",
            "no exact event timestamps (date-only)",
        ],
    }
    open(OUT_FREEZE, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    )
    return payload


# ══════════════════════════════════════════════
# DAY FEATURES
# ══════════════════════════════════════════════

def _day_raw_parts(
    *,
    d_stem: str,
    d_branch: str,
    m_stem: str,
    m_branch: str,
    sw_stem: str,
    sw_branch: str,
    ctx: Dict[str, Any],
    include_sewoon: bool,
) -> Dict[str, Any]:
    yong = ctx["yong"]
    ds = ctx["day_stem"]
    yfit = {}
    try:
        yfit = se._check_yongshin_fit(d_stem, d_branch, yong, ds) if ds and yong else {}
    except Exception:
        yfit = {}
    yong_f = float(yfit.get("용신부합") or 0)
    hee_f = float(yfit.get("희신부합") or 0)
    gi_f = float(yfit.get("기신부합") or 0)
    gu_f = float(yfit.get("구신부합") or 0)
    fit_net = (yong_f + hee_f) - (gi_f + gu_f)

    stem_e = se.STEM_ELEMENT.get(d_stem, "")
    branch_e = se.BRANCH_ELEMENT_MAIN.get(d_branch, "")
    fav_s = 1.0 if (stem_e in ctx["fav"] or branch_e in ctx["fav"]) else 0.0
    unfav_s = 1.0 if (stem_e in ctx["unfav"] or branch_e in ctx["unfav"]) else 0.0
    supply = fav_s - unfav_s

    # Day ↔ Month (PRIMARY)
    rel_m = se._calc_two_pillar_relations(d_stem, d_branch, m_stem, m_branch)
    tm = VM._rel_text(rel_m)
    fm = VM._rel_flags(tm)
    month_rel = (
        (fm["hap"] - fm["chung"]) * (0.55 + 0.45 * supply)
        - 0.55 * fm["hyung"]
        - 0.45 * (fm["pa"] + fm["hae"])
    )

    # Day ↔ natal
    rel_n = se._calc_incoming_relations(d_stem, d_branch, ctx["stems"], ctx["branches"])
    tn = VM._rel_text(rel_n)
    fn = VM._rel_flags(tn)
    natal_rel = (
        (fn["hap"] - fn["chung"]) * (0.5 + 0.5 * np.sign(fit_net + 1e-9) * max(abs(fit_net), 0.2))
        - 0.55 * fn["hyung"]
        - 0.45 * (fn["pa"] + fn["hae"])
    )
    # day-pillar self resonance with natal day
    if d_branch == ctx["day_branch"]:
        natal_rel += 0.25 * (1.0 if fit_net >= 0 else -0.5)
    if d_stem == ctx["day_stem"]:
        natal_rel += 0.15

    natal_struct = 0.55 * fit_net + 0.45 * supply

    raw_d1 = (
        W["day_month"] * month_rel
        + W["day_natal_struct"] * natal_struct
        + W["day_natal_rel"] * natal_rel
    )

    sw_rel = 0.0
    sw_used = False
    ts = ""
    fs = {"hap": 0.0, "chung": 0.0, "hyung": 0.0, "pa": 0.0, "hae": 0.0}
    if include_sewoon:
        rel_s = se._calc_two_pillar_relations(d_stem, d_branch, sw_stem, sw_branch)
        ts = VM._rel_text(rel_s)
        fs = VM._rel_flags(ts)
        if any(fs[k] != fm[k] for k in fs):
            sw_rel = (
                (fs["hap"] - fs["chung"]) * (0.5 + 0.5 * supply)
                - 0.45 * fs["hyung"]
                - 0.35 * (fs["pa"] + fs["hae"])
            )
            sw_used = True

    raw_d2 = raw_d1 + (W["day_sewoon_d2"] * sw_rel if sw_used else 0.0)
    intensity = VM._event_intensity({
        "hap": max(fn["hap"], fm["hap"], fs["hap"]),
        "chung": max(fn["chung"], fm["chung"], fs["chung"]),
        "hyung": max(fn["hyung"], fm["hyung"], fs["hyung"]),
        "pa": max(fn["pa"], fm["pa"], fs["pa"]),
        "hae": max(fn["hae"], fm["hae"], fs["hae"]),
    })

    return {
        "raw_d1": float(raw_d1),
        "raw_d2": float(raw_d2),
        "fit_net": float(fit_net),
        "supply": float(supply),
        "month_rel": float(month_rel),
        "natal_rel": float(natal_rel),
        "sw_rel": float(sw_rel),
        "sw_used": sw_used,
        "intensity": float(intensity),
        "tg_stem": se.ten_god(ds, d_stem) if ds else "",
        "tg_branch": se.branch_main_tg(ds, d_branch) if ds else "",
        "rel_month": tm,
        "rel_natal": tn,
        "rel_sewoon": ts,
        "NUMERIC_SCORE_DRIVER": ["month_rel", "fit_net", "supply", "natal_rel"]
        + (["sw_rel"] if sw_used else []),
        "EXPLANATION_ONLY": ["intensity", "tg_stem", "tg_branch", "rel_texts"],
    }


def iter_civil_days(start: datetime, end: datetime):
    """
    Civil dates whose neutral noon (12:00 KST) lies in [start, end).

    Matches event mapping (noon lookup). Includes the end calendar day when
    noon is still before the exact 節 end (fixes DAY_ITERATION dropouts).
    """
    s = start.astimezone(se.KST)
    e = end.astimezone(se.KST)
    d = datetime(s.year, s.month, s.day, NEUTRAL_HOUR, tzinfo=se.KST)
    if d < s:
        d = d + timedelta(days=1)
        d = datetime(d.year, d.month, d.day, NEUTRAL_HOUR, tzinfo=se.KST)
    while d < e:
        yield datetime(d.year, d.month, d.day, tzinfo=se.KST)
        nxt = d + timedelta(days=1)
        d = datetime(nxt.year, nxt.month, nxt.day, NEUTRAL_HOUR, tzinfo=se.KST)


def build_days_for_months(
    pack: dict,
    month_map: Dict[Tuple[int, int], Dict[str, Any]],
    month_keys: List[Tuple[int, int]],
) -> Dict[str, Dict[str, Any]]:
    """
    date_str YYYY-MM-DD -> day row with DailyDev / DayScore for D1/D2 × amps.
    Centered within each Wolwoon (month_key).
    """
    ctx = VM._natal_ctx(pack["r"])
    by_month: Dict[Tuple[int, int], List[Dict[str, Any]]] = defaultdict(list)

    for key in month_keys:
        mrow = month_map.get(key)
        if not mrow:
            continue
        start, end = _parse_iso(mrow["start"]), _parse_iso(mrow["end"])
        m_gz = mrow["ganzhi"]
        m_stem, m_branch = m_gz[0], mrow["branch"]
        sw_gz = mrow["sewoon_gz"]
        sw_stem, sw_branch = sw_gz[0], sw_gz[1]
        m_parent = float(mrow[f"M_{MONTH_WINNER}"])
        y_parent = float(mrow["Y_parent"])
        annual_dev = float(mrow["annual_dev"])

        for day_dt in iter_civil_days(start, end):
            d_pillar = se.civil_sexagenary_day(day_dt.year, day_dt.month, day_dt.day)
            parts = _day_raw_parts(
                d_stem=d_pillar[0], d_branch=d_pillar[1],
                m_stem=m_stem, m_branch=m_branch,
                sw_stem=sw_stem, sw_branch=sw_branch,
                ctx=ctx, include_sewoon=True,
            )
            row = {
                "_name": pack["name"],
                "date": day_dt.strftime("%Y-%m-%d"),
                "day_pillar": d_pillar,
                "month_key": key,
                "month_pillar": m_gz,
                "M_parent": m_parent,
                "Y_parent": y_parent,
                "D_parent": float(mrow["D_parent"]),
                "annual_dev": annual_dev,
                "MonthlyDev_parent": float(mrow[f"MonthlyDev_{MONTH_WINNER}"]),
                **parts,
            }
            by_month[key].append(row)

    out: Dict[str, Dict[str, Any]] = {}
    for key, rows in by_month.items():
        med1 = float(np.median([r["raw_d1"] for r in rows]))
        med2 = float(np.median([r["raw_d2"] for r in rows]))
        for r in rows:
            c1, c2 = r["raw_d1"] - med1, r["raw_d2"] - med2
            r["center_d1"], r["center_d2"] = med1, med2
            r["centered_d1"], r["centered_d2"] = c1, c2
            for amp_name, amp in AMP.items():
                r[f"DailyDev_D1_{amp_name}"] = amp * c1
                r[f"DailyDev_D2_{amp_name}"] = amp * c2
                r[f"Day_D1_{amp_name}"] = _clamp(r["M_parent"] + amp * c1)
                r[f"Day_D2_{amp_name}"] = _clamp(r["M_parent"] + amp * c2)
            # year-month percentile helpers
            r["_month_devs"] = {}
            out[r["date"]] = r
        for amp_name in AMP:
            for cand in ("D1", "D2"):
                k = f"DailyDev_{cand}_{amp_name}"
                vals = [float(x[k]) for x in rows]
                for x in rows:
                    x["_month_devs"][k] = vals
    return out


# ══════════════════════════════════════════════
# EVAL
# ══════════════════════════════════════════════

def eval_timing(mapped: List[dict], cand: str, amp: str) -> Dict[str, Any]:
    dev_key = f"DailyDev_{cand}_{amp}"
    pos_dev, neg_dev, pos_pct, neg_pct = [], [], [], []
    exact_hits, w1_hits, w3_hits = [], [], []
    by_subj = defaultdict(lambda: {"pos": [], "neg": []})

    for m in mapped:
        row = m["row"]
        pol = m["event"]["polarity"]
        name = m["event"]["name"]
        dev = float(row[dev_key])
        yd = row.get("_month_devs", {}).get(dev_key) or []
        pct = sum(1 for x in yd if x <= dev) / len(yd) if yd else float("nan")
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

        adj1 = m.get("adj1", {}).get(dev_key) or [dev]
        adj3 = m.get("adj3", {}).get(dev_key) or [dev]
        if pol == "positive":
            w1_hits.append(1.0 if max(adj1) > 0 else 0.0)
            w3_hits.append(1.0 if max(adj3) > 0 else 0.0)
        else:
            w1_hits.append(1.0 if min(adj1) < 0 else 0.0)
            w3_hits.append(1.0 if min(adj3) < 0 else 0.0)

    def mean(xs):
        return None if not xs else round(float(np.mean(xs)), 4)

    subj = []
    for name, d in by_subj.items():
        if d["pos"] and d["neg"]:
            subj.append({
                "name": name,
                "sep": round(float(np.mean(d["pos"]) - np.mean(d["neg"])), 4),
                "hit": 1 if np.mean(d["pos"]) > np.mean(d["neg"]) else 0,
            })
    return {
        "n_events": len(mapped),
        "n_pos": len(pos_dev),
        "n_neg": len(neg_dev),
        "exact_direction_hit": mean(exact_hits),
        "window_pm1_hit": mean(w1_hits),
        "window_pm3_hit": mean(w3_hits),
        "pos_mean_DailyDev": mean(pos_dev),
        "neg_mean_DailyDev": mean(neg_dev),
        "pos_neg_sep": None if not (pos_dev and neg_dev) else round(
            float(np.mean(pos_dev) - np.mean(neg_dev)), 4
        ),
        "pos_mean_percentile": mean(pos_pct),
        "neg_mean_percentile": mean(neg_pct),
        "subject_hit_rate": None if not subj else round(
            sum(s["hit"] for s in subj) / len(subj), 4
        ),
        "subjects": subj,
    }


def eval_hierarchy(all_days: List[dict], cand: str, amp: str) -> Dict[str, Any]:
    dev_key = f"DailyDev_{cand}_{amp}"
    score_key = f"Day_{cand}_{amp}"
    groups = defaultdict(list)
    for r in all_days:
        groups[(r["_name"], r["month_key"])].append(r)

    medians, abs_devs, month_abs, annual_abs = [], [], [], []
    ranges, jumps, crosses, sat = [], [], 0, 0
    n_days = 0
    years_ok = years_n = 0
    qa = {
        "fav_day_in_hard_month": 0,
        "hard_day_in_fav_month": 0,
        "fav_day_in_hard_sewoon": 0,
        "hard_day_in_fav_sewoon": 0,
        "n_months": 0,
    }
    missing_dup_ok = True
    boundary_jump = []

    for (name, key), rows in groups.items():
        rows = sorted(rows, key=lambda r: r["date"])
        # completeness: unique dates, no dups
        dates = [r["date"] for r in rows]
        if len(dates) != len(set(dates)):
            missing_dup_ok = False
        years_n += 1
        ds = [float(r[dev_key]) for r in rows]
        med = float(np.median(ds))
        medians.append(abs(med))
        if abs(med) < 0.12:
            years_ok += 1
        abs_devs.extend(abs(x) for x in ds)
        ranges.append(max(ds) - min(ds) if ds else 0)
        for i in range(len(ds) - 1):
            jumps.append(abs(ds[i + 1] - ds[i]))
        m_parent = float(rows[0]["M_parent"])
        month_abs.append(abs(float(rows[0]["MonthlyDev_parent"])))
        annual_abs.append(abs(float(rows[0]["annual_dev"])))
        for r in rows:
            n_days += 1
            sc = float(r[score_key])
            if sc <= 0.5 or sc >= 99.5:
                sat += 1
            if (r[dev_key] > 0 and m_parent < BASE) or (r[dev_key] < 0 and m_parent > BASE):
                crosses += 1
        qa["n_months"] += 1
        d_parent = float(rows[0]["D_parent"])
        y_parent = float(rows[0]["Y_parent"])
        if m_parent < BASE - 1 and max(ds) > 0.25:
            qa["fav_day_in_hard_month"] += 1
        if m_parent > BASE + 1 and min(ds) < -0.25:
            qa["hard_day_in_fav_month"] += 1
        if y_parent < BASE - 1 and max(ds) > 0.25:
            qa["fav_day_in_hard_sewoon"] += 1
        if y_parent > BASE + 1 and min(ds) < -0.25:
            qa["hard_day_in_fav_sewoon"] += 1

    # month-boundary adjacent jumps across months for same subject
    by_subj = defaultdict(list)
    for r in all_days:
        by_subj[r["_name"]].append(r)
    for name, rows in by_subj.items():
        rows = sorted(rows, key=lambda r: r["date"])
        for i in range(len(rows) - 1):
            d0 = datetime.strptime(rows[i]["date"], "%Y-%m-%d")
            d1 = datetime.strptime(rows[i + 1]["date"], "%Y-%m-%d")
            if (d1 - d0).days == 1 and rows[i]["month_key"] != rows[i + 1]["month_key"]:
                boundary_jump.append(
                    abs(float(rows[i][dev_key]) - float(rows[i + 1][dev_key]))
                )

    def pct(xs, p):
        return None if not xs else round(float(np.percentile(xs, p)), 4)

    day_p90 = pct(abs_devs, 90) or 0
    mon_p90 = pct(month_abs, 90) or 1e-6
    ann_p90 = pct(annual_abs, 90) or 1e-6
    return {
        "n_wolwoon_blocks": years_n,
        "frac_median_abs_lt_0.12": None if not years_n else round(years_ok / years_n, 4),
        "abs_DailyDev_p50": pct(abs_devs, 50),
        "abs_DailyDev_p75": pct(abs_devs, 75),
        "abs_DailyDev_p90": pct(abs_devs, 90),
        "abs_DailyDev_p95": pct(abs_devs, 95),
        "abs_DailyDev_max": None if not abs_devs else round(float(np.max(abs_devs)), 4),
        "abs_MonthlyDev_p90": pct(month_abs, 90),
        "abs_annual_dev_p90": pct(annual_abs, 90),
        "day_over_month_p90_ratio": round(day_p90 / mon_p90, 4),
        "day_over_annual_p90_ratio": round(day_p90 / ann_p90, 4),
        "within_wolwoon_range_p50": pct(ranges, 50),
        "adj_jump_p50": pct(jumps, 50),
        "adj_jump_p90": pct(jumps, 90),
        "adj_jump_p95": pct(jumps, 95),
        "month_boundary_jump_p90": pct(boundary_jump, 90),
        "frac_cross_M_parent": None if not n_days else round(crosses / n_days, 4),
        "saturation_frac": None if not n_days else round(sat / n_days, 4),
        "dates_unique_ok": missing_dup_ok,
        "behavior_qa": qa,
        "fav_month_in_hard_D_flag": 0,
        "fav_month_in_hard_D_note": "recorded from Month closure; D/Y not reopened",
    }


def select_winner(results: Dict[str, Any], sparse: bool) -> Tuple[str, str, str]:
    ok = {}
    for key, res in results.items():
        h = res["hierarchy"]
        med = h.get("frac_median_abs_lt_0.12")
        dm = h.get("day_over_month_p90_ratio")
        sat = h.get("saturation_frac")
        p90 = h.get("abs_DailyDev_p90")
        if med is None or med < 0.85:
            continue
        if dm is None or dm > 0.95:  # Day should be below Month
            continue
        if sat is None or sat > 0.02:
            continue
        if p90 is None or p90 < 0.15:
            continue
        if not h.get("dates_unique_ok", True):
            continue
        ok[key] = res
    if not ok:
        return "V2_DAY_NOT_READY", "", "no candidate passed hierarchy gates"

    def rank(k):
        r = ok[k]
        t = r["timing"]
        cand, amp = k.split("_", 1)
        simp = 2 if cand == "D1" else 1
        amp_rank = {"CONSERVATIVE": 3, "BALANCED": 2, "EXPRESSIVE": 1}[amp]
        return (
            t.get("exact_direction_hit") or 0,
            t.get("subject_hit_rate") or 0,
            simp,
            amp_rank,
            t.get("pos_neg_sep") or -99,
            -(r["hierarchy"].get("day_over_month_p90_ratio") or 0),
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
        return "V2_DAY_READY_TO_FREEZE", winner, "timing+hierarchy pass"
    return (
        "V2_DAY_TIMING_ONLY",
        winner,
        "hierarchy/coherence pass but exact-date evidence insufficient for accuracy claim "
        f"(sparse={sparse}, n={tw.get('n_events')}, hit={tw.get('exact_direction_hit')}, "
        f"sep={tw.get('pos_neg_sep')})",
    )


# ══════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════

def main() -> int:
    print("══════════ V2 DAY (Phase 4) ══════════")
    print("── calendar audit ──")
    cal = run_calendar_audit()
    if not cal["foundation_ok"]:
        payload = {
            "measured_at": datetime.now().isoformat(timespec="seconds"),
            "status": "V2_DAY_FOUNDATION_ISSUE",
            "calendar_audit": cal,
            "validation_b_scored": False,
        }
        open(OUT_SNAP, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        open(OUT_REPORT, "w", encoding="utf-8").write(
            f"# V2 Day Report\n\n**Status:** `V2_DAY_FOUNDATION_ISSUE`\n\n{cal['issues']}\n"
        )
        print("V2_DAY_FOUNDATION_ISSUE", cal["issues"])
        return 1
    print("  foundation_ok", cal["foundation_ok"])

    freeze_labels = json.load(open(OUT_LABELS, encoding="utf-8"))
    val_b = set(freeze_labels["validation_b"])

    print("── freeze day labels (before scoring) ──")
    day_freeze = freeze_day_labels(val_b)
    print(f"  events={day_freeze['n_events']} subj={day_freeze['n_subjects']}")

    print("── packs + Y + Month M1_CONSERVATIVE ──")
    old_packs, fresh_packs, _ = DY._load_pools(freeze_labels)
    packs_by_name = {p["name"]: p for p in old_packs}
    need = set(day_freeze["subjects"])
    y_all = VM.build_y_maps(old_packs + fresh_packs)

    months_by_subj = {}
    days_by_subj = {}
    for name in sorted(need):
        pack = packs_by_name.get(name)
        if not pack or name not in y_all:
            continue
        evs = [e for e in day_freeze["events"] if e["name"] == name]
        ey_set = set()
        for e in evs:
            dt = datetime(e["year"], e["month"], e["day"], NEUTRAL_HOUR, tzinfo=se.KST)
            ey_set.add(se.live_active_sewoon_year(dt))
        ys = sorted(y_all[name].keys())
        sample = set(ys[::3][:40]) | ey_set
        for ey in list(ey_set):
            sample.add(ey - 1)
            sample.add(ey + 1)
        sample = {y for y in sample if y in y_all[name]}
        mm = VM.build_subject_months(pack, y_all[name], years=sorted(sample))
        for row in mm.values():
            row["_name"] = name
        months_by_subj[name] = mm

        # month keys: event months + sample every other month for hierarchy
        mkeys = set()
        for e in evs:
            dt = datetime(e["year"], e["month"], e["day"], NEUTRAL_HOUR, tzinfo=se.KST)
            ww = se.live_active_wolwoon(dt)
            sw = se.live_active_sewoon(dt)
            mkeys.add((int(sw["year"]), int(ww["month_index"])))
        # add sparse hierarchy months
        ordered = sorted(mm.keys())
        for i, k in enumerate(ordered):
            if i % 4 == 0:
                mkeys.add(k)
        dd = build_days_for_months(pack, mm, sorted(mkeys))
        days_by_subj[name] = dd
        print(f"  {name}: months={len(mm)} day_rows={len(dd)}")

    print("── map events ──")
    mapped = []
    for e in day_freeze["events"]:
        dd = days_by_subj.get(e["name"])
        if not dd:
            continue
        date_s = f"{e['year']:04d}-{e['month']:02d}-{e['day']:02d}"
        row = dd.get(date_s)
        if not row:
            # rebuild single month if missing
            continue
        # ±1 / ±3 windows
        adj1, adj3 = {}, {}
        base = datetime.strptime(date_s, "%Y-%m-%d")
        for amp in AMP:
            for cand in ("D1", "D2"):
                key = f"DailyDev_{cand}_{amp}"
                v1, v3 = [], []
                for off in (-1, 0, 1):
                    ds = (base + timedelta(days=off)).strftime("%Y-%m-%d")
                    if ds in dd:
                        v1.append(float(dd[ds][key]))
                for off in range(-3, 4):
                    ds = (base + timedelta(days=off)).strftime("%Y-%m-%d")
                    if ds in dd:
                        v3.append(float(dd[ds][key]))
                adj1[key] = v1 or [float(row[key])]
                adj3[key] = v3 or [float(row[key])]
        mapped.append({"event": e, "row": row, "date": date_s, "adj1": adj1, "adj3": adj3})
    print(f"  mapped={len(mapped)}/{day_freeze['n_events']}")

    print("── evaluate ──")
    all_days = []
    for dd in days_by_subj.values():
        all_days.extend(dd.values())

    results = {}
    for cand in ("D1", "D2"):
        for amp in AMP:
            key = f"{cand}_{amp}"
            timing = eval_timing(mapped, cand, amp)
            hier = eval_hierarchy(all_days, cand, amp)
            results[key] = {
                "candidate": "V2_DAY_LOCAL" if cand == "D1" else "V2_DAY_CONTEXTUAL",
                "cand_code": cand,
                "amplitude": amp,
                "amp_value": AMP[amp],
                "timing": timing,
                "hierarchy": hier,
            }
            print(
                f"  {key}: hit={timing['exact_direction_hit']} sep={timing['pos_neg_sep']} "
                f"d/m={hier['day_over_month_p90_ratio']} med0={hier['frac_median_abs_lt_0.12']}"
            )

    status, winner, reason = select_winner(results, day_freeze["primary_data_sparse"])

    # traces
    traces = []
    cand, amp = (winner.split("_", 1) if winner else ("D1", "CONSERVATIVE"))
    for m in (mapped[:6] + mapped[-3:]):
        row = m["row"]
        traces.append({
            "name": m["event"]["name"],
            "label": m["event"]["label"],
            "polarity": m["event"]["polarity"],
            "date": m["date"],
            "M_parent": row["M_parent"],
            "day_pillar": row["day_pillar"],
            "Day_Month": row["rel_month"],
            "Day_Natal": row["rel_natal"],
            "Day_Sewoon": row["rel_sewoon"] if cand == "D2" else "N/A (D1)",
            "valence": {
                "fit_net": row["fit_net"], "supply": row["supply"],
                "month_rel": row["month_rel"], "natal_rel": row["natal_rel"],
                "sw_rel": row["sw_rel"] if cand == "D2" else 0.0,
            },
            "ten_god": {"stem": row["tg_stem"], "branch": row["tg_branch"]},
            "event_intensity": row["intensity"],
            "raw": row["raw_d1"] if cand == "D1" else row["raw_d2"],
            "local_median": row["center_d1"] if cand == "D1" else row["center_d2"],
            "DailyDev": row[f"DailyDev_{cand}_{amp}"],
            "DayScore": row[f"Day_{cand}_{amp}"],
            "NUMERIC_SCORE_DRIVER": row["NUMERIC_SCORE_DRIVER"],
            "EXPLANATION_ONLY": row["EXPLANATION_ONLY"],
        })

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_DAY",
        "validation_b_scored": False,
        "production_v2_day_wired": False,
        "parents": {
            "DY": "V2_DY_B",
            "Month": MONTH_WINNER,
            "Month_status": "V2_MONTH_TIMING_ONLY",
        },
        "composition": "DayScore = clamp(M_parent + DailyDev)",
        "calendar_audit": {
            "policy": cal["policy"],
            "foundation_ok": cal["foundation_ok"],
            "legacy_bug_fixed": cal["legacy_bug_fixed"],
        },
        "date_freeze": {
            "n_events": day_freeze["n_events"],
            "n_positive": day_freeze["n_positive"],
            "n_negative": day_freeze["n_negative"],
            "n_subjects": day_freeze["n_subjects"],
            "by_pool": day_freeze["by_pool"],
            "sparse": day_freeze["primary_data_sparse"],
            "path": OUT_FREEZE,
        },
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
            "experiment_v2_day.py": _sha16(__file__),
            "V2_DAY_EVALUABLE_FREEZE.json": _sha16(OUT_FREEZE),
        },
        "next": "FULL HIERARCHY QA (not another Day candidate phase)",
    }
    open(OUT_SNAP, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n"
    )
    write_report(payload)
    write_attribution(payload)

    print("══════════ STATUS ══════════")
    print(status)
    print("winner", winner, reason)
    print(f"→ {OUT_SNAP}")
    return 0


def write_report(p: Dict[str, Any]) -> None:
    L = [
        "# V2 Day Report",
        "",
        f"**Status:** `{p['status']}`",
        f"**Winner:** `{p['winner']}`",
        f"**Reason:** {p['status_reason']}",
        f"**Measured:** {p['measured_at']}",
        "",
        "## Parents",
        "",
        f"- D/Y: `{p['parents']['DY']}`",
        f"- Month: `{p['parents']['Month']}` ({p['parents']['Month_status']})",
        "- `DayScore = clamp(M_parent + DailyDev)`",
        "",
        "## Calendar",
        "",
        f"- Policy: **civil YYYY-MM-DD** (not 子時)",
        f"- Foundation OK: {p['calendar_audit']['foundation_ok']}",
        f"- Legacy JD +47 bug: fixed / aligned to sajupy",
        "",
        "## Labels",
        "",
        f"- Exact-date events: {p['date_freeze']['n_events']} "
        f"(pos={p['date_freeze']['n_positive']}, neg={p['date_freeze']['n_negative']})",
        f"- Subjects: {p['date_freeze']['n_subjects']} · Fresh A: "
        f"{p['date_freeze']['by_pool']['FRESH_A_DEV']['n_events']}",
        f"- Sparse: {p['date_freeze']['sparse']}",
        "",
        "## Candidates",
        "",
        "| key | exact_hit | sep | subj_hit | ±1 | ±3 | med≈0 | |D|p90 | d/m | d/ann | sat |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for k, r in p["results"].items():
        t, h = r["timing"], r["hierarchy"]
        L.append(
            f"| {k} | {t.get('exact_direction_hit')} | {t.get('pos_neg_sep')} | "
            f"{t.get('subject_hit_rate')} | {t.get('window_pm1_hit')} | {t.get('window_pm3_hit')} | "
            f"{h.get('frac_median_abs_lt_0.12')} | {h.get('abs_DailyDev_p90')} | "
            f"{h.get('day_over_month_p90_ratio')} | {h.get('day_over_annual_p90_ratio')} | "
            f"{h.get('saturation_frac')} |"
        )
    w = p["results"].get(p["winner"] or "", {})
    L += [
        "",
        "## Behavior QA",
        "",
        f"- {(w.get('hierarchy') or {}).get('behavior_qa')}",
        f"- fav-month-in-hard-D flag remains 0 (D/Y not reopened)",
        "",
        "## Hard stop",
        "",
        "- Validation B sealed · D/Y/Month not redesigned · no new labels · production V2 Day not wired",
        "",
        f"**Final:** `{p['status']}`",
        "",
        "Next: FULL HIERARCHY QA.",
        "",
    ]
    open(OUT_REPORT, "w", encoding="utf-8").write("\n".join(L))


def write_attribution(p: Dict[str, Any]) -> None:
    L = [
        "# V2 Day Attribution",
        "",
        f"**Winner:** `{p['winner']}` · **Status:** `{p['status']}`",
        "",
        "## Feature duplication audit",
        "",
        "| feature | class | note |",
        "|---|---|---|",
    ]
    for f in p["feature_duplication_audit"]:
        L.append(f"| {f['feature']} | {f['class']} | {f['note']} |")
    L += ["", "## Trace samples", ""]
    for t in p.get("traces_sample") or []:
        L += [
            f"### {t['name']} — {t['polarity']} — {t['label']}",
            f"- date: {t['date']} · day: {t['day_pillar']} · M_parent: {t['M_parent']}",
            f"- DailyDev → DayScore: {t['DailyDev']} → {t['DayScore']}",
            f"- raw / median: {t['raw']} / {t['local_median']}",
            f"- valence: {t['valence']}",
            f"- intensity (explanation-only): {t['event_intensity']}",
            f"- NUMERIC: {t['NUMERIC_SCORE_DRIVER']}",
            f"- EXPLANATION_ONLY: {t['EXPLANATION_ONLY']}",
            f"- Day↔Month: {t['Day_Month']}",
            f"- Day↔Natal: {t['Day_Natal']}",
            f"- Day↔Sewoon: {t['Day_Sewoon']}",
            "",
        ]
    open(OUT_ATTR, "w", encoding="utf-8").write("\n".join(L))


if __name__ == "__main__":
    sys.exit(main())
