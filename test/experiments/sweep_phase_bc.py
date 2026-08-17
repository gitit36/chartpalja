# -*- coding: utf-8 -*-
"""
Phase 6B2/6C2 — 월·일 계층 HP 스윕 (라벨 분리도 + 스모크 게이트).

Usage:
  python test/experiments/sweep_phase_bc.py
  python test/experiments/sweep_phase_bc.py --month-trials 120 --day-trials 100
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
from datetime import datetime
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
from experiments import arm_b, arm_b_day, arm_b_month, common as C  # noqa: E402
from experiments import lower_hierarchy as LH  # noqa: E402
from experiments import md_labels as MD  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_sweep_phase_bc.json")

MONTH_SPEARMAN_MIN = 0.90
DAY_SPEARMAN_MIN = 0.80
MONTH_PARENT_MIN = 0.55
DAY_PARENT_MIN = 0.55
MONTH_PARENT_MAX = 0.75
DAY_PARENT_MAX = 0.72
# 분리도 게이트 (표본 작아 세운보다 완화)
MONTH_TRAIN_MIN = 70.0
MONTH_HOLDOUT_MIN = 60.0
DAY_TRAIN_MIN = 60.0
DAY_HOLDOUT_MIN = 50.0
MIN_EVENTS = 2


def _birth_input(n: dict) -> se.BirthInput:
    hh, mm, _ = cy.resolve_hour(n)
    b = n["birth"]
    return se.BirthInput(
        year=b["y"], month=b["m"], day=b["d"], hour=hh, minute=mm,
        gender=n["gender"],
        calendar="lunar" if str(b.get("calendar", "solar")).lower() in ("lunar", "음력") else "solar",
        is_leap_month=b.get("leap", False),
        use_solar_time=False,
    )


def _quiet_compute(n: dict):
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        r = se.compute_all(_birth_input(n), yongshin_override=n.get("yongshin_override"))
        dw = se.build_daewoon_detail(r)
    return r, dw


def _wavg(events: List[dict], scores: Dict[Tuple[int, int], float]) -> Tuple[float, int]:
    num = den = 0.0
    used = 0
    for e in events:
        key = (int(e["year"]), int(e["month"]))
        if key not in scores:
            continue
        s = scores[key]
        if s != s:
            continue
        w = float(e.get("weight", 1.0))
        num += s * w
        den += w
        used += 1
    return (num / den if den else float("nan")), used


def _wavg_day(events: List[dict], scores: Dict[str, float]) -> Tuple[float, int]:
    num = den = 0.0
    used = 0
    for e in events:
        if e.get("day") is None:
            continue
        key = f"{int(e['year']):04d}-{int(e['month']):02d}-{int(e['day']):02d}"
        if key not in scores:
            continue
        s = scores[key]
        if s != s:
            continue
        w = float(e.get("weight", 1.0))
        num += s * w
        den += w
        used += 1
    return (num / den if den else float("nan")), used


def _load_person_month_pack(n: dict) -> Optional[Dict[str, Any]]:
    good, bad = MD.events_for(n["name"], need_day=False)
    if len(good) < MIN_EVENTS or len(bad) < MIN_EVENTS:
        return None
    years = sorted({int(e["year"]) for e in good + bad})
    close, meta = C.engine_year_maps(n)
    r, dw = _quiet_compute(n)
    months_by_year: Dict[int, Dict[str, Any]] = {}
    for y in years:
        if y not in meta:
            continue
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            mt = se.build_monthly_timeline(r, dw, y)
        if not mt or len(mt) < 12:
            continue
        ctrl_months = [float(m["scores"]["종합"]) for m in mt]
        ctrl_sw = float(mt[0]["candle"]["open"])
        sew_b = float(arm_b.year_score_from_meta(meta[y]))
        months_by_year[y] = {
            "ctrl_months": ctrl_months,
            "ctrl_sw": ctrl_sw,
            "sew_b": sew_b,
        }
    # drop events whose year missing
    good = [e for e in good if e["year"] in months_by_year]
    bad = [e for e in bad if e["year"] in months_by_year]
    if len(good) < MIN_EVENTS or len(bad) < MIN_EVENTS:
        return None
    return {
        "name": n["name"],
        "bucket": C.cohort_bucket(n["name"]),
        "good": good,
        "bad": bad,
        "months_by_year": months_by_year,
        # smoke: first available year series
        "smoke_year": next(iter(months_by_year)),
    }


def _load_person_day_pack(n: dict, month_cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    good, bad = MD.events_for(n["name"], need_day=True)
    if len(good) < MIN_EVENTS or len(bad) < MIN_EVENTS:
        return None
    years = sorted({int(e["year"]) for e in good + bad})
    close, meta = C.engine_year_maps(n)
    r, dw = _quiet_compute(n)
    # month parents for remapping
    month_cache: Dict[Tuple[int, int], Dict[str, float]] = {}
    for y in years:
        if y not in meta:
            continue
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            mt = se.build_monthly_timeline(r, dw, y)
        if not mt:
            continue
        sew_b = float(arm_b.year_score_from_meta(meta[y]))
        ctrl_sw = float(mt[0]["candle"]["open"])
        for mrow in mt:
            mon = int(mrow["month"])
            ctrl_m = float(mrow["scores"]["종합"])
            month_b = arm_b_month.month_score(
                control_month=ctrl_m,
                control_sewoon=ctrl_sw,
                sewoon_b=sew_b,
                cfg=month_cfg,
            )
            month_cache[(y, mon)] = {
                "ctrl_month": ctrl_m,
                "ctrl_sw": ctrl_sw,
                "sew_b": sew_b,
                "month_b": month_b,
                "ctrl_month_parent": ctrl_m,  # engine month parent ≈ month score open chain
            }

    day_ctrl: Dict[str, Dict[str, float]] = {}
    for e in good + bad:
        if e.get("day") is None:
            continue
        y, m, d = int(e["year"]), int(e["month"]), int(e["day"])
        if (y, m) not in month_cache:
            continue
        date_s = f"{y:04d}-{m:02d}-{d:02d}"
        if date_s in day_ctrl:
            continue
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            try:
                row = se.build_daily_fortune(r, date_s)
            except Exception:
                continue
        day_ctrl[date_s] = {
            "ctrl_day": float(row["점수"]),
            "ctrl_month_parent": float(row["상위운"]["월운종합"]),
            "synergy": float((row.get("breakdown") or {}).get("synergy") or 0.0),
            "year": y,
            "month": m,
        }

    good = [e for e in good if f"{e['year']:04d}-{e['month']:02d}-{e['day']:02d}" in day_ctrl]
    bad = [e for e in bad if f"{e['year']:04d}-{e['month']:02d}-{e['day']:02d}" in day_ctrl]
    if len(good) < MIN_EVENTS or len(bad) < MIN_EVENTS:
        return None

    # smoke series: 12 mid-month days in a labeled year
    smoke_year = years[len(years) // 2]
    smoke_days = []
    if smoke_year in meta:
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            mt = se.build_monthly_timeline(r, dw, smoke_year)
        sew_b = float(arm_b.year_score_from_meta(meta[smoke_year]))
        ctrl_sw = float(mt[0]["candle"]["open"]) if mt else 50.0
        for mrow in mt or []:
            mon = int(mrow["month"])
            date_s = f"{smoke_year}-{mon:02d}-15"
            buf2 = io.StringIO()
            with redirect_stdout(buf2), redirect_stderr(buf2):
                try:
                    row = se.build_daily_fortune(r, date_s)
                except Exception:
                    continue
            smoke_days.append({
                "date": date_s,
                "ctrl_day": float(row["점수"]),
                "ctrl_month_parent": float(row["상위운"]["월운종합"]),
                "ctrl_month_score": float(mrow["scores"]["종합"]),
                "synergy": float((row.get("breakdown") or {}).get("synergy") or 0.0),
                "ctrl_sw": ctrl_sw,
                "sew_b": sew_b,
            })

    return {
        "name": n["name"],
        "bucket": C.cohort_bucket(n["name"]),
        "good": good,
        "bad": bad,
        "day_ctrl": day_ctrl,
        "month_cache": month_cache,
        "smoke_days": smoke_days,
    }


def eval_month_cfg(cfg: Dict[str, Any], packs: List[Dict[str, Any]]) -> Dict[str, Any]:
    spears = []
    remapped_series = []
    person_rows = []
    for pack in packs:
        # smoke spearman on one year
        y = pack["smoke_year"]
        info = pack["months_by_year"][y]
        rem = arm_b_month.remap_year_months(
            info["ctrl_months"], info["ctrl_sw"], info["sew_b"], cfg
        )
        spears.append(LH.spearman(info["ctrl_months"], rem))
        remapped_series.append(rem)

        scores: Dict[Tuple[int, int], float] = {}
        for yy, mi in pack["months_by_year"].items():
            rem_y = arm_b_month.remap_year_months(
                mi["ctrl_months"], mi["ctrl_sw"], mi["sew_b"], cfg
            )
            for mon, sc in enumerate(rem_y, start=1):
                scores[(yy, mon)] = sc
        ga, gu = _wavg(pack["good"], scores)
        ba, bu = _wavg(pack["bad"], scores)
        sep_pack = C.pack_sep(ga, ba, gu, bu)
        person_rows.append({
            "name": pack["name"],
            "bucket": pack["bucket"],
            "sep": sep_pack,
        })

    sp = float(np.nanmean(spears)) if spears else float("nan")
    sigma = LH.pooled_sigma(remapped_series)

    def _tally(bucket: Optional[str] = None):
        rows = person_rows if bucket is None else [r for r in person_rows if r["bucket"] == bucket]
        return C.tally(rows, "sep")

    train_t = _tally("train")
    hold_t = _tally("holdout")
    all_t = _tally(None)
    pw = float(cfg["parent_w"])
    gated = (
        sp >= MONTH_SPEARMAN_MIN
        and MONTH_PARENT_MIN <= pw <= MONTH_PARENT_MAX
        and train_t["evalable"] > 0
        and hold_t["evalable"] > 0
        and float(train_t["rate"]) >= MONTH_TRAIN_MIN
        and float(hold_t["rate"]) >= MONTH_HOLDOUT_MIN
    )
    return {
        "gated": gated,
        "spearman": round(sp, 4),
        "sigma": round(sigma, 3),
        "train": {k: (None if isinstance(v, float) and v != v else v) for k, v in train_t.items()},
        "holdout": {k: (None if isinstance(v, float) and v != v else v) for k, v in hold_t.items()},
        "all": {k: (None if isinstance(v, float) and v != v else v) for k, v in all_t.items()},
        "config": {
            "parent_w": cfg["parent_w"],
            "child_w": cfg["child_w"],
            "neutral_child_w": cfg.get("neutral_child_w"),
            "child_amp": cfg.get("child_amp"),
            "min_parent_w": cfg.get("min_parent_w"),
        },
        "n_persons": len(packs),
    }


def eval_day_cfg(
    cfg: Dict[str, Any],
    packs: List[Dict[str, Any]],
    month_cfg: Dict[str, Any],
) -> Dict[str, Any]:
    spears = []
    remapped_series = []
    person_rows = []
    for pack in packs:
        # smoke
        if pack["smoke_days"]:
            ctrl = []
            rem = []
            for d in pack["smoke_days"]:
                month_b = arm_b_month.month_score(
                    control_month=d["ctrl_month_score"],
                    control_sewoon=d["ctrl_sw"],
                    sewoon_b=d["sew_b"],
                    cfg=month_cfg,
                )
                ctrl.append(d["ctrl_day"])
                rem.append(
                    arm_b_day.day_score(
                        control_day=d["ctrl_day"],
                        control_month=d["ctrl_month_parent"],
                        month_b=month_b,
                        cfg=cfg,
                        synergy=float(d.get("synergy") or 0.0),
                    )
                )
            spears.append(LH.spearman(ctrl, rem))
            remapped_series.append(rem)

        scores: Dict[str, float] = {}
        for date_s, dc in pack["day_ctrl"].items():
            y, m = int(dc["year"]), int(dc["month"])
            mc = pack["month_cache"].get((y, m))
            if not mc:
                continue
            scores[date_s] = arm_b_day.day_score(
                control_day=dc["ctrl_day"],
                control_month=dc["ctrl_month_parent"],
                month_b=mc["month_b"],
                cfg=cfg,
                synergy=float(dc.get("synergy") or 0.0),
            )
        ga, gu = _wavg_day(pack["good"], scores)
        ba, bu = _wavg_day(pack["bad"], scores)
        sep_pack = C.pack_sep(ga, ba, gu, bu)
        person_rows.append({
            "name": pack["name"],
            "bucket": pack["bucket"],
            "sep": sep_pack,
        })

    sp = float(np.nanmean(spears)) if spears else float("nan")
    sigma = LH.pooled_sigma(remapped_series)

    def _tally(bucket: Optional[str] = None):
        rows = person_rows if bucket is None else [r for r in person_rows if r["bucket"] == bucket]
        return C.tally(rows, "sep")

    train_t = _tally("train")
    hold_t = _tally("holdout")
    all_t = _tally(None)
    pw = float(cfg["parent_w"])
    gated = (
        (sp != sp or sp >= DAY_SPEARMAN_MIN)
        and DAY_PARENT_MIN <= pw <= DAY_PARENT_MAX
        and train_t["evalable"] > 0
        and (hold_t["evalable"] == 0 or float(hold_t["rate"]) >= DAY_HOLDOUT_MIN)
        and float(train_t["rate"]) >= DAY_TRAIN_MIN
    )
    return {
        "gated": gated,
        "spearman": None if sp != sp else round(sp, 4),
        "sigma": round(sigma, 3),
        "train": {k: (None if isinstance(v, float) and v != v else v) for k, v in train_t.items()},
        "holdout": {k: (None if isinstance(v, float) and v != v else v) for k, v in hold_t.items()},
        "all": {k: (None if isinstance(v, float) and v != v else v) for k, v in all_t.items()},
        "config": {
            "parent_w": cfg["parent_w"],
            "child_w": cfg["child_w"],
            "neutral_child_w": cfg.get("neutral_child_w"),
            "child_amp": cfg.get("child_amp"),
            "min_parent_w": cfg.get("min_parent_w"),
        },
        "n_persons": len(packs),
    }


def _sample_month_cfg(rng: np.random.Generator, base: Dict[str, Any]) -> Dict[str, Any]:
    cfg = deepcopy(base)
    parent_w = float(rng.uniform(0.52, 0.78))
    cfg["parent_w"] = parent_w
    cfg["child_w"] = 1.0 - parent_w
    cfg["neutral_child_w"] = float(rng.uniform(0.36, 0.50))
    cfg["child_amp"] = float(rng.uniform(1.0, 3.0))
    cfg["min_parent_w"] = MONTH_PARENT_MIN
    return cfg


def _sample_day_cfg(rng: np.random.Generator, base: Dict[str, Any]) -> Dict[str, Any]:
    cfg = deepcopy(base)
    parent_w = float(rng.uniform(0.50, 0.72))
    cfg["parent_w"] = parent_w
    cfg["child_w"] = 1.0 - parent_w
    cfg["neutral_child_w"] = float(rng.uniform(0.38, 0.50))
    cfg["child_amp"] = float(rng.uniform(1.0, 3.0))
    cfg["min_parent_w"] = DAY_PARENT_MIN
    return cfg


def _rank_month(r: Dict[str, Any]) -> Tuple:
    tr = float((r.get("train") or {}).get("rate") or 0)
    hr = float((r.get("holdout") or {}).get("rate") or 0)
    sep = float((r.get("all") or {}).get("avg_sep") or 0)
    return (
        1 if r.get("gated") else 0,
        min(tr, hr),
        hr,
        tr,
        sep,
        float(r.get("sigma") or 0),
        float(r.get("spearman") or 0),
    )


def _rank_day(r: Dict[str, Any]) -> Tuple:
    tr = float((r.get("train") or {}).get("rate") or 0)
    hr = float((r.get("holdout") or {}).get("rate") or 0) if (r.get("holdout") or {}).get("evalable") else tr
    sep = float((r.get("all") or {}).get("avg_sep") or 0)
    return (
        1 if r.get("gated") else 0,
        min(tr, hr),
        hr,
        tr,
        sep,
        float(r.get("sigma") or 0),
        float(r.get("spearman") or 0),
    )


def run(month_trials: int, day_trials: int, seed: int) -> Dict[str, Any]:
    rng = np.random.default_rng(seed)
    subjects = [n for n in C.load_core_subjects() if C.cohort_bucket(n["name"]) != "soft_exclude"]
    cov_m = MD.coverage_report([n["name"] for n in subjects], need_day=False)
    cov_d = MD.coverage_report([n["name"] for n in subjects], need_day=True)
    print(f"label coverage month evalable={cov_m['evalable']}/{cov_m['n_subjects']}")
    print(f"label coverage day   evalable={cov_d['evalable']}/{cov_d['n_subjects']}")

    print("loading month packs…")
    month_packs = []
    for n in subjects:
        p = _load_person_month_pack(n)
        if p:
            month_packs.append(p)
            print(f"  + {p['name']} ({p['bucket']}) g={len(p['good'])} b={len(p['bad'])}")
    print(f"  month packs={len(month_packs)}")

    m_base = deepcopy(arm_b_month.ARM_MONTH_CONFIG)
    m_results = []
    m0 = eval_month_cfg(m_base, month_packs)
    m0["trial"] = 0
    m0["tag"] = "baseline_locked"
    m_results.append(m0)
    print(
        f"month baseline gated={m0['gated']} "
        f"train={C.fmt_rate(m0['train'])} hold={C.fmt_rate(m0['holdout'])} "
        f"sp={m0['spearman']} σ={m0['sigma']} sep={m0['all'].get('avg_sep')}"
    )

    for i in range(1, month_trials + 1):
        cfg = _sample_month_cfg(rng, m_base)
        ev = eval_month_cfg(cfg, month_packs)
        ev["trial"] = i
        ev["tag"] = "random"
        m_results.append(ev)
        if i % 25 == 0 or (ev["gated"] and i <= 10):
            mark = "★" if ev["gated"] else " "
            print(
                f"  {mark}[m{i}] train={C.fmt_rate(ev['train'])} hold={C.fmt_rate(ev['holdout'])} "
                f"sp={ev['spearman']:.3f} β={ev['config']['parent_w']:.2f} amp={ev['config']['child_amp']:.2f}"
            )

    m_ranked = sorted(m_results, key=_rank_month, reverse=True)
    m_gated = [r for r in m_ranked if r["gated"]]
    m_rec = m_gated[0] if m_gated else m_ranked[0]

    month_cfg_rec = deepcopy(m_base)
    for k, v in m_rec["config"].items():
        month_cfg_rec[k] = v

    print("loading day packs…")
    day_packs = []
    for n in subjects:
        p = _load_person_day_pack(n, month_cfg_rec)
        if p:
            day_packs.append(p)
            print(f"  + {p['name']} ({p['bucket']}) g={len(p['good'])} b={len(p['bad'])}")
    print(f"  day packs={len(day_packs)}")

    d_base = deepcopy(arm_b_day.ARM_DAY_CONFIG)
    d_results = []
    d0 = eval_day_cfg(d_base, day_packs, month_cfg_rec)
    d0["trial"] = 0
    d0["tag"] = "baseline_locked"
    d_results.append(d0)
    print(
        f"day baseline gated={d0['gated']} "
        f"train={C.fmt_rate(d0['train'])} hold={C.fmt_rate(d0['holdout'])} "
        f"sp={d0['spearman']} σ={d0['sigma']} sep={d0['all'].get('avg_sep')}"
    )

    for i in range(1, day_trials + 1):
        cfg = _sample_day_cfg(rng, d_base)
        ev = eval_day_cfg(cfg, day_packs, month_cfg_rec)
        ev["trial"] = i
        ev["tag"] = "random"
        d_results.append(ev)
        if i % 25 == 0 or (ev["gated"] and i <= 10):
            mark = "★" if ev["gated"] else " "
            print(
                f"  {mark}[d{i}] train={C.fmt_rate(ev['train'])} hold={C.fmt_rate(ev['holdout'])} "
                f"sp={ev['spearman']} γ={ev['config']['parent_w']:.2f} amp={ev['config']['child_amp']:.2f}"
            )

    d_ranked = sorted(d_results, key=_rank_day, reverse=True)
    d_gated = [r for r in d_ranked if r["gated"]]
    d_rec = d_gated[0] if d_gated else d_ranked[0]

    return {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "6B2_6C2_month_day_sep",
        "seed": seed,
        "sewoon_arm": arm_b.ARM_VERSION,
        "label_file": "month_day_labels.json",
        "coverage": {"month": cov_m, "day": cov_d},
        "month": {
            "n_trials": month_trials,
            "n_gated": len(m_gated),
            "baseline": m0,
            "recommend": m_rec,
            "top5": m_ranked[:5],
            "gates": {
                "spearman_min": MONTH_SPEARMAN_MIN,
                "parent_min": MONTH_PARENT_MIN,
                "parent_max": MONTH_PARENT_MAX,
                "train_min": MONTH_TRAIN_MIN,
                "holdout_min": MONTH_HOLDOUT_MIN,
            },
        },
        "day": {
            "n_trials": day_trials,
            "n_gated": len(d_gated),
            "baseline": d0,
            "recommend": d_rec,
            "top5": d_ranked[:5],
            "month_cfg_used": m_rec["config"],
            "gates": {
                "spearman_min": DAY_SPEARMAN_MIN,
                "parent_min": DAY_PARENT_MIN,
                "parent_max": DAY_PARENT_MAX,
                "train_min": DAY_TRAIN_MIN,
                "holdout_min": DAY_HOLDOUT_MIN,
            },
        },
        "corpus": {
            "month_persons": len(month_packs),
            "day_persons": len(day_packs),
            "month_names": [p["name"] for p in month_packs],
            "day_names": [p["name"] for p in day_packs],
        },
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--month-trials", type=int, default=120)
    ap.add_argument("--day-trials", type=int, default=100)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ Phase 6B2/6C2 월·일 분리도 스윕 ══════════")
    print(f"sewoon parent arm={arm_b.ARM_VERSION}")
    print(f"month_trials={args.month_trials} day_trials={args.day_trials} seed={args.seed}")
    print("engine untouched · labels from month_day_labels.json")
    print()

    payload = run(args.month_trials, args.day_trials, args.seed)
    mr = payload["month"]["recommend"]
    dr = payload["day"]["recommend"]
    print("\n── 월 추천 ──")
    print(json.dumps(mr, ensure_ascii=False, indent=2))
    print("\n── 일 추천 ──")
    print(json.dumps(dr, ensure_ascii=False, indent=2))

    def _clean(o):
        if isinstance(o, dict):
            return {k: _clean(v) for k, v in o.items()}
        if isinstance(o, list):
            return [_clean(v) for v in o]
        if isinstance(o, float) and o != o:
            return None
        return o

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(_clean(payload), f, ensure_ascii=False, indent=2)
    print(f"\n저장 → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
