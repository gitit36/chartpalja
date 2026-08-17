# -*- coding: utf-8 -*-
"""
PUBLIC_LIFE_V1 bounded V3 development.

CONTROL = production candle.close.
V2 = frozen V2_DY_B (z from OLD_DEV+Fresh A only).
Never loads Validation B packs. Never opens FINAL.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
from collections import defaultdict
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta
from itertools import product
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_EXP = os.path.dirname(_HERE)
_TEST = os.path.dirname(_EXP)
_ROOT = os.path.dirname(_TEST)
_STAGE1 = os.path.join(_TEST, "CURSOR_STAGE1_PUBLIC_LIFE_V1")
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _EXP)

import sajupy  # noqa: E402
import saju_engine as se  # noqa: E402
from experiments import arm_b, arm_control  # noqa: E402
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments.experiment_g_clean import score_g  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS  # noqa: E402
from experiments.validate_v2_b_one_shot import (  # noqa: E402
    FROZEN_MODEL_HASH16,
    _clamp,
    _eval_pool,
    _r4,
    _score_v2_dy_b,
    primary_from_subject_raws,
    subject_raw_row,
)

EXPECT_V2_HASH16 = "d2c0199c5194dd63"
VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0
# V3 structural constants (predeclared from DEV diagnosis, not swept).
# V2 |annual_dev| p90 ≈ 4.0; Control annual p90 ≈ 11 and D jumps p90 ≈ 20.
V3_ANNUAL_CLIP = 4.0
V3_ID = "V3_ENGINE_D_CLIPPED_G"

OUT_DIAG = os.path.join(_HERE, "V3_DIAGNOSTICS.json")
OUT_REPORT = os.path.join(_HERE, "V3_DEV_CHECK_REPORT.md")
OUT_SPEC = os.path.join(_HERE, "V3_FROZEN_SPEC.json")


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_v2_hash() -> str:
    p = os.path.join(_EXP, "experiment_v2_dy.py")
    h = _sha256(p)
    if h[:16] != EXPECT_V2_HASH16:
        raise RuntimeError(f"V2 hash drift: {h[:16]}")
    return h


def parse_utc_offset(raw) -> float:
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    sign = -1.0 if s.startswith("-") else 1.0
    s = s[1:] if s[0] in "+-" else s
    hh, mm = s.split(":")
    return sign * (int(hh) + int(mm) / 60.0)


def lon_corrected_birth(date: str, time: str, lon: float, utc_hours: float) -> dict:
    y, m, d = [int(x) for x in date.split("-")]
    hh, mi = [int(x) for x in time.split(":")[:2]]
    calc = sajupy.get_saju_calculator()
    civil = datetime(y, m, d, hh, mi)
    corr = float(calc._calculate_solar_time_correction(float(lon), float(utc_hours)))
    h, minute, dc = calc._adjust_time_for_solar(civil.hour, civil.minute, corr)
    yy, mo, da = calc._adjust_date_for_solar(civil.year, civil.month, civil.day, dc)
    return {"y": yy, "m": mo, "d": da, "h": h, "min": minute, "corr_min": corr}


def pack_public_life(subj: dict) -> dict:
    b = subj["birth"]
    utc = parse_utc_offset(b["utc_offset"])
    eng = lon_corrected_birth(b["date"], b["time"], float(b["longitude"]), utc)
    good = [{"year": int(e["year"]), "weight": 1.0} for e in subj["events"] if e["valence"] == "positive"]
    bad = [{"year": int(e["year"]), "weight": 1.0} for e in subj["events"] if e["valence"] == "negative"]
    name = subj["subject_id"]
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        inp = se.BirthInput(
            year=eng["y"], month=eng["m"], day=eng["d"], hour=eng["h"], minute=eng["min"],
            gender=subj["gender"], calendar="solar", is_leap_month=False,
            use_solar_time=False, utc_offset=9,
        )
        r = se.compute_all(inp)
        dw = se.build_daewoon_detail(r)
    meta = {}
    for e in r["chart_data"]["연도별_타임라인"]:
        meta[int(e["year"])] = e
    return {
        "name": name,
        "subject_id": name,
        "n": {"name": name, "gender": subj["gender"], "good": good, "bad": bad},
        "r": r,
        "dw": dw,
        "meta": meta,
        "pool": subj.get("split") or "PUBLIC_LIFE",
        "engine_birth": eng,
    }


def load_split(split: str) -> List[dict]:
    if split == "DEV":
        path = os.path.join(_STAGE1, "PUBLIC_LIFE_V1_DEV.json")
    elif split == "CHECK":
        path = os.path.join(_STAGE1, "PUBLIC_LIFE_V1_CHECK.json")
    else:
        raise ValueError("FINAL is sealed")
    data = json.load(open(path, encoding="utf-8"))
    return [pack_public_life(s) for s in data["subjects"]]


def load_z_source():
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old, fa, val_b = DY._load_pools(freeze)
    if any(p["name"] in val_b for p in old + fa):
        raise RuntimeError("Validation B leaked into z-source")
    return old, fa


def control_maps(packs: List[dict]) -> List[dict]:
    out = []
    for pack in packs:
        out.append({int(y): float(arm_control.year_score_from_meta(m)) for y, m in pack["meta"].items()})
    return out


def control_layers(packs: List[dict], smaps: List[dict]) -> List[dict]:
    """Synthetic parent/annual from production open/close for diagnostics only."""
    layers_list = []
    for pack, smap in zip(packs, smaps):
        layers = {}
        for y, m in pack["meta"].items():
            y = int(y)
            d = float((m.get("candle") or {}).get("open") or 50.0)
            yy = float(smap[y])
            layers[y] = {
                "pillar": str(m.get("대운_pillar") or "_"),
                "D": d, "Y": yy, "annual_dev": yy - d, "A": yy - d, "trigger": 0.0,
            }
        layers_list.append(layers)
    return layers_list


def headline_from_eval(agg: dict) -> dict:
    return {
        "n": agg["n"],
        "macro_pairwise": agg["macro_pairwise_raw"],
        "subject_hit": f"{agg['n_hit']}/{agg['n']}",
        "subject_hit_n": agg["n_hit"],
        "std_sep": agg["std_sep_raw"],
        "median_sep": agg["median_sep_raw"],
        "positive": agg["positive"],
        "neutral": agg["neutral"],
        "negative": agg["negative"],
        "same_D_pairwise": agg.get("same_D_pairwise_raw"),
        "cross_D_pairwise": agg.get("cross_D_pairwise_raw"),
        "B_PARENT_HELP": agg.get("B_PARENT_HELP"),
        "B_PARENT_HARM": agg.get("B_PARENT_HARM"),
        "B_PARENT_NET": agg.get("B_PARENT_NET"),
    }


def structure_from_layers(layers_list: List[dict]) -> dict:
    Ds, Anns, Ys, jumps = [], [], [], []
    for layers in layers_list:
        by_p = {}
        years = sorted(layers)
        for y in years:
            L = layers[y]
            Ds.append(L["D"])
            Anns.append(L["annual_dev"])
            Ys.append(L["Y"])
            by_p.setdefault(L["pillar"], L["D"])
        ordered = []
        seen = set()
        for y in years:
            p = layers[y]["pillar"]
            if p not in seen:
                seen.add(p)
                ordered.append(by_p[p])
        for a, b in zip(ordered, ordered[1:]):
            jumps.append(abs(b - a))
        for a, b in zip(years, years[1:]):
            if layers[b]["pillar"] != layers[a]["pillar"]:
                jumps.append(abs(layers[b]["D"] - layers[a]["D"]))  # counted in adj pillar already
    yoy = []
    for layers in layers_list:
        years = sorted(layers)
        for a, b in zip(years, years[1:]):
            yoy.append(abs(layers[b]["Y"] - layers[a]["Y"]))
    sat = sum(1 for y in Ys if y <= 0.5 or y >= 99.5) / len(Ys) if Ys else None
    return {
        "D_min": _r4(min(Ds) if Ds else None),
        "D_max": _r4(max(Ds) if Ds else None),
        "D_p50": _r4(float(np.median(Ds)) if Ds else None),
        "adj_D_jump_p50": _r4(float(np.median(jumps)) if jumps else None),
        "adj_D_jump_p90": _r4(float(np.percentile(jumps, 90)) if jumps else None),
        "abs_annual_dev_p50": _r4(float(np.median(np.abs(Anns))) if Anns else None),
        "abs_annual_dev_p90": _r4(float(np.percentile(np.abs(Anns), 90)) if Anns else None),
        "Y_sat_frac": _r4(sat),
        "Y_min": _r4(min(Ys) if Ys else None),
        "Y_max": _r4(max(Ys) if Ys else None),
        "yoy_abs_p90": _r4(float(np.percentile(yoy, 90)) if yoy else None),
        "yoy_abs_p99": _r4(float(np.percentile(yoy, 99)) if yoy else None),
        "annual_dominates_D_frac": _r4(
            float(np.mean([abs(a) > abs(d - 60) for a, d in zip(Anns, Ds)])) if Anns else None
        ),
    }


def failure_clusters(packs, layers_list, score_maps) -> dict:
    """Broad clusters only. No biographies."""
    miss_same = miss_cross = n_same = n_cross = 0
    miss_ids = []
    for pack, layers, smap in zip(packs, layers_list, score_maps):
        good = [e for e in pack["n"]["good"] if int(e["year"]) in smap]
        bad = [e for e in pack["n"]["bad"] if int(e["year"]) in smap]
        row = subject_raw_row(pack["name"], [smap[int(e["year"])] for e in good], [smap[int(e["year"])] for e in bad])
        if row and not row["hit"]:
            miss_ids.append(pack["name"])
        for ge, be in product(good, bad):
            Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
            wrong = Lg["Y"] < Lb["Y"]
            if Lg["pillar"] == Lb["pillar"]:
                n_same += 1
                miss_same += int(wrong)
            else:
                n_cross += 1
                miss_cross += int(wrong)
    return {
        "n_subjects_miss": len(miss_ids),
        "miss_subject_ids": miss_ids[:5],
        "same_D_error_rate": _r4(miss_same / n_same if n_same else None),
        "cross_D_error_rate": _r4(miss_cross / n_cross if n_cross else None),
        "n_same_pairs": n_same,
        "n_cross_pairs": n_cross,
    }


def _engine_D_map(pack: dict) -> Dict[str, float]:
    out = {}
    for blk in pack.get("dw") or []:
        out[str(blk["daewoon_pillar"])] = float(blk["종합운점수"])
    return out


def score_v3(dev_packs, holdout_packs, z_params=None):
    """
    V3 — chosen after PUBLIC_LIFE DEV diagnosis. Exactly 3 structural changes:

    1. Parent D = production engine 종합운점수 (not flat V2 D_B).
    2. Drop B_trigger and the 0.65/0.35 mix.
    3. annual_dev = clip(A_G, ±4) so the year cannot dominate the parent.

    z_params unused (no V2 D z). Argument kept so call sites stay stable.
    """
    cfg = dict(arm_b.ARM_B_CONFIG)
    layers_list, score_maps = [], []
    for pack in holdout_packs:
        dmap = _engine_D_map(pack)
        gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
        by_p = defaultdict(list)
        for y, m in pack["meta"].items():
            p = str(m.get("대운_pillar") or "_")
            if p not in dmap:
                continue
            by_p[p].append(gmap[int(y)])
        med = {p: float(np.median(vs)) for p, vs in by_p.items()}
        layers, smap = {}, {}
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            if pillar not in dmap:
                continue
            a = gmap[int(y)] - med[pillar]
            d = float(dmap[pillar])
            annual_dev = float(np.clip(a, -V3_ANNUAL_CLIP, V3_ANNUAL_CLIP))
            y_disp = _clamp(d + annual_dev)
            layers[int(y)] = {
                "pillar": pillar, "D": d, "A": a, "annual_dev": annual_dev,
                "Y": y_disp, "G": gmap[int(y)], "trigger": 0.0,
            }
            smap[int(y)] = y_disp
        layers_list.append(layers)
        score_maps.append(smap)
    return layers_list, score_maps, z_params or {}


def eval_model(packs, layers_list, score_maps) -> dict:
    _rows, _s, _same, _cross, agg = _eval_pool(packs, layers_list, score_maps)
    return {
        "headline": headline_from_eval(agg),
        "structure": structure_from_layers(layers_list),
        "clusters": failure_clusters(packs, layers_list, score_maps),
    }


def diagnose_dev() -> dict:
    verify_v2_hash()
    old, fa = load_z_source()
    zsrc = old + fa
    packs = load_split("DEV")
    print(f"  packed PUBLIC_LIFE DEV n={len(packs)}")
    v2_l, v2_m, z_params = _score_v2_dy_b(zsrc, packs)
    ctrl_m = control_maps(packs)
    ctrl_l = control_layers(packs, ctrl_m)
    v2 = eval_model(packs, v2_l, v2_m)
    ctrl = eval_model(packs, ctrl_l, ctrl_m)
    return {
        "n_dev": len(packs),
        "CONTROL": ctrl,
        "V2_DY_B": v2,
        "z_params": {k: [float(x) for x in v] for k, v in z_params.items()},
    }


def _valid_day(y, m, d) -> bool:
    try:
        datetime(y, m, d)
        return True
    except ValueError:
        return False


def generate_synthetic(n: int = 5000, seed: int = 20260815) -> List[dict]:
    rng = np.random.default_rng(seed)
    stems = list("甲乙丙丁戊己庚辛壬癸")
    packs = []
    attempts = 0
    while len(packs) < n and attempts < n * 4:
        attempts += 1
        y = int(rng.integers(1920, 2006))
        m = int(rng.integers(1, 13))
        d = int(rng.integers(1, 29))
        if not _valid_day(y, m, d):
            continue
        h = int(rng.choice([0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]))
        mi = int(rng.choice([0, 30]))
        gender = "male" if rng.random() < 0.5 else "female"
        try:
            buf = io.StringIO()
            with redirect_stdout(buf), redirect_stderr(buf):
                inp = se.BirthInput(
                    year=y, month=m, day=d, hour=h, minute=mi, gender=gender,
                    calendar="solar", use_solar_time=False, utc_offset=9,
                )
                r = se.enrich_saju(inp)
                dw = se.build_daewoon_detail(r)
            if not dw or not r.get("원국"):
                continue
            meta = {}
            if len(packs) < 400:
                tl = se.build_yearly_timeline(r, dw, span=40)
                meta = {int(e["year"]): e for e in tl}
            packs.append({
                "name": f"SYN_{len(packs):04d}",
                "n": {"name": f"SYN_{len(packs):04d}", "gender": gender, "good": [], "bad": []},
                "r": r, "dw": dw, "meta": meta, "pool": "SYNTHETIC",
                "day_stem": r["원국"]["day"][0] if isinstance(r["원국"]["day"], (list, tuple)) else str(r["원국"]["day"])[0],
                "strength": (r.get("신강신약") or {}).get("판정"),
            })
        except Exception:
            continue
        if len(packs) % 500 == 0:
            print(f"  synthetic packed {len(packs)}/{n}")
    return packs


def synthetic_qa(zsrc, packs: List[dict], full_annual_n: int = 400) -> dict:
    """Structural sanity. No labels / no accuracy."""
    sub = [p for p in packs if p.get("meta")][:full_annual_n]
    ctrl_m = control_maps(sub)
    v2_l, v2_m, _ = _score_v2_dy_b(zsrc, sub)
    v3_l, v3_m, _ = score_v3(zsrc, sub)

    def cliff_stats(pack_list, get_Ds):
        cliffs, flats, n = 0, 0, 0
        for pack in pack_list:
            ds = get_Ds(pack)
            if len(ds) < 2:
                continue
            n += 1
            jumps = [abs(ds[i + 1] - ds[i]) for i in range(len(ds) - 1)]
            if max(jumps) >= 20:
                cliffs += 1
            if max(ds) - min(ds) < 1.0:
                flats += 1
        return {"n": n, "cliff_frac": _r4(cliffs / n if n else None), "flat_frac": _r4(flats / n if n else None)}

    def ds_engine(pack):
        return [float(b["종합운점수"]) for b in pack["dw"]]

    def ds_v2(pack, layers):
        seen, out = set(), []
        for y in sorted(layers):
            p = layers[y]["pillar"]
            if p not in seen:
                seen.add(p)
                out.append(layers[y]["D"])
        return out

    by_stem_ctrl = defaultdict(list)
    by_str_ctrl = defaultdict(list)
    sat_ctrl = []
    for pack, smap in zip(sub, ctrl_m):
        vs = list(smap.values())
        if vs:
            sat_ctrl.append(sum(1 for v in vs if v <= 2 or v >= 98) / len(vs))
        by_stem_ctrl[pack.get("day_stem") or "?"].extend(vs)
        by_str_ctrl[str(pack.get("strength") or "?")].extend(vs)
    by_stem_D, by_str_D = defaultdict(list), defaultdict(list)
    for pack in packs:
        ds = [float(b["종합운점수"]) for b in pack["dw"]]
        by_stem_D[pack.get("day_stem") or "?"].extend(ds)
        by_str_D[str(pack.get("strength") or "?")].extend(ds)

    def bias(d):
        return {k: _r4(float(np.mean(v))) for k, v in sorted(d.items()) if v}

    v2_struct = structure_from_layers(v2_l)
    v3_struct = structure_from_layers(v3_l)
    return {
        "n_births": len(packs),
        "n_full_annual": len(sub),
        "CONTROL": {
            "Y_sat_frac": _r4(float(np.mean(sat_ctrl)) if sat_ctrl else None),
            "daewoon": cliff_stats(packs, ds_engine),
            "mean_by_day_stem_Y": bias(by_stem_ctrl),
            "mean_by_strength_Y": bias(by_str_ctrl),
            "mean_by_day_stem_D": bias(by_stem_D),
            "mean_by_strength_D": bias(by_str_D),
        },
        "V2_DY_B": {
            **v2_struct,
            "daewoon": cliff_stats(sub, lambda p, lyr=iter(v2_l): ds_v2(p, next(lyr))),
        },
        "V3": {
            **v3_struct,
            "daewoon": cliff_stats(sub, lambda p, lyr=iter(v3_l): ds_v2(p, next(lyr))),
        },
    }


def materially_worse(challenger: dict, control: dict, pw_tol: float = 0.03, sep_tol: float = 0.05) -> bool:
    """Regression guard: material means pairwise drop > 0.03 or std_sep drop > 0.05."""
    pw_c, pw_v = control["macro_pairwise"], challenger["macro_pairwise"]
    sep_c, sep_v = control["std_sep"], challenger["std_sep"]
    if pw_c is None or pw_v is None or sep_c is None or sep_v is None:
        return True
    return (pw_v < pw_c - pw_tol) or (sep_v < sep_c - sep_tol)


def gate(dev_ctrl, dev_v3, old_ctrl, old_v3, fa_ctrl, fa_v3, syn: dict) -> Tuple[bool, List[str]]:
    reasons = []
    if dev_v3["macro_pairwise"] < dev_ctrl["macro_pairwise"]:
        reasons.append("DEV_pairwise_below_CONTROL")
    if not (dev_v3["std_sep"] > dev_ctrl["std_sep"]):
        reasons.append("DEV_std_sep_not_gt_CONTROL")
    if materially_worse(old_v3, old_ctrl):
        reasons.append("OLD_DEV_material_regression")
    if materially_worse(fa_v3, fa_ctrl):
        reasons.append("FRESH_A_material_regression")
    v2s, v3s = syn.get("V2_DY_B") or {}, syn.get("V3") or {}
    if (v3s.get("Y_sat_frac") or 0) > 0.05 and (v3s.get("Y_sat_frac") or 0) > (v2s.get("Y_sat_frac") or 0) + 0.02:
        reasons.append("synthetic_saturation_regression")
    return (len(reasons) == 0), reasons


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", choices=["diagnose", "full"], default="full")
    args = ap.parse_args()
    print("══════════ PUBLIC_LIFE V3 ══════════")
    v2h = verify_v2_hash()
    print("  V2 hash16", v2h[:16], "ok")

    print("── DEV diagnosis (no tuning) ──")
    diag = diagnose_dev()
    for model in ("CONTROL", "V2_DY_B"):
        h = diag[model]["headline"]
        print(
            f"  {model} pw={_r4(h['macro_pairwise'])} hit={h['subject_hit']} "
            f"std={_r4(h['std_sep'])} med={_r4(h['median_sep'])} "
            f"+/−={h['positive']}/{h['negative']}"
        )

    if args.phase == "diagnose":
        with open(OUT_DIAG, "w", encoding="utf-8") as f:
            json.dump({"phase": "diagnose", "dev": diag}, f, ensure_ascii=False, indent=2)
        return 0

    print("── synthetic QA ──")
    old, fa = load_z_source()
    zsrc = old + fa
    syn_packs = generate_synthetic(5000)
    syn = synthetic_qa(zsrc, syn_packs, full_annual_n=400)
    print("  synthetic n", syn["n_births"], "full_annual", syn["n_full_annual"])

    print("── score V3 on DEV + regression guards ──")
    packs = load_split("DEV")
    v3_l, v3_m, z_params = score_v3(zsrc, packs)
    v3_dev = eval_model(packs, v3_l, v3_m)
    print(
        f"  V3 DEV pw={_r4(v3_dev['headline']['macro_pairwise'])} "
        f"hit={v3_dev['headline']['subject_hit']} std={_r4(v3_dev['headline']['std_sep'])}"
    )

    old_ctrl = eval_model(old, control_layers(old, control_maps(old)), control_maps(old))
    fa_ctrl = eval_model(fa, control_layers(fa, control_maps(fa)), control_maps(fa))
    v3_old_l, v3_old_m, _ = score_v3(zsrc, old, z_params)
    v3_fa_l, v3_fa_m, _ = score_v3(zsrc, fa, z_params)
    v3_old = eval_model(old, v3_old_l, v3_old_m)
    v3_fa = eval_model(fa, v3_fa_l, v3_fa_m)
    print(
        f"  V3 OLD pw={_r4(v3_old['headline']['macro_pairwise'])} "
        f"FA pw={_r4(v3_fa['headline']['macro_pairwise'])}"
    )

    ok, reasons = gate(
        diag["CONTROL"]["headline"], v3_dev["headline"],
        old_ctrl["headline"], v3_old["headline"],
        fa_ctrl["headline"], v3_fa["headline"],
        syn,
    )
    print("  DEV_GATE", "PASS" if ok else "FAIL", reasons)

    check_payload = None
    status = "V3_REJECTED_KEEP_CONTROL"
    if ok:
        print("── CHECK once ──")
        chk = load_split("CHECK")
        print(f"  packed CHECK n={len(chk)}")
        c_m = control_maps(chk)
        c_eval = eval_model(chk, control_layers(chk, c_m), c_m)
        v2_l, v2_m, _ = _score_v2_dy_b(zsrc, chk)
        v2_eval = eval_model(chk, v2_l, v2_m)
        v3_cl, v3_cm, _ = score_v3(zsrc, chk, z_params)
        v3_eval = eval_model(chk, v3_cl, v3_cm)
        check_payload = {"CONTROL": c_eval, "V2_DY_B": v2_eval, "V3": v3_eval, "consumed_as_dev": False}
        print(
            f"  CHECK CTRL {_r4(c_eval['headline']['macro_pairwise'])} "
            f"V2 {_r4(v2_eval['headline']['macro_pairwise'])} "
            f"V3 {_r4(v3_eval['headline']['macro_pairwise'])}"
        )
        broken = (
            v3_eval["headline"]["macro_pairwise"] < 0.40
            or (v3_eval["headline"]["std_sep"] is not None and v3_eval["headline"]["std_sep"] < -0.25)
        )
        if broken:
            print("  CHECK structurally broken — no V3.1 without a clear structural (non-person) failure documented")
            status = "V3_REJECTED_KEEP_CONTROL"
        else:
            status = "V3_FROZEN_READY_FOR_FINAL"
    else:
        status = "V3_REJECTED_KEEP_CONTROL"

    payload = {
        "status": status,
        "v2_hash": v2h,
        "v3_id": V3_ID,
        "v3_changes": [
            "parent D = production engine 종합운점수 (replace flat V2 D_B)",
            "drop B_trigger and 0.65/0.35 mix",
            f"annual_dev = clip(A_G, ±{V3_ANNUAL_CLIP})",
        ],
        "dev": {
            "CONTROL": diag["CONTROL"],
            "V2_DY_B": diag["V2_DY_B"],
            "V3": v3_dev,
        },
        "regression_guards": {
            "OLD_DEV": {"CONTROL": old_ctrl, "V3": v3_old},
            "FRESH_A": {"CONTROL": fa_ctrl, "V3": v3_fa},
        },
        "synthetic": syn,
        "gate_ok": ok,
        "gate_reasons": reasons,
        "check": check_payload,
        "validation_b_used": False,
        "final_opened": False,
        "production_wired": False,
    }
    with open(OUT_DIAG, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
        f.write("\n")
    write_report(payload)
    write_spec(payload, v2h)
    print("══════════ STATUS ══════════")
    print(status)
    return 0 if status != "V3_REJECTED_KEEP_CONTROL" or not ok else 0


def write_report(p: dict) -> None:
    def hline(tag, h):
        return (
            f"| {tag} | {_r4(h['macro_pairwise'])} | {h['subject_hit']} | "
            f"{_r4(h['std_sep'])} | {_r4(h['median_sep'])} | {h['positive']} | {h['negative']} |"
        )

    lines = [
        "# V3 PUBLIC_LIFE DEV/CHECK report",
        "",
        f"**Status:** `{p['status']}`",
        "",
        "CONTROL = production `candle.close`. V2 = frozen V2_DY_B. FINAL not opened. Validation B not used.",
        "",
        "## DEV (primary)",
        "",
        "| model | macro pairwise | subject hit | std sep | median sep | + | − |",
        "|---|---:|---:|---:|---:|---:|---:|",
        hline("CONTROL", p["dev"]["CONTROL"]["headline"]),
        hline("V2_DY_B", p["dev"]["V2_DY_B"]["headline"]),
        hline("V3", p["dev"]["V3"]["headline"]),
        "",
        "### DEV structure (V2)",
        "",
        json.dumps(p["dev"]["V2_DY_B"]["structure"], ensure_ascii=False),
        "",
        "### DEV failure clusters (V2)",
        "",
        json.dumps(p["dev"]["V2_DY_B"]["clusters"], ensure_ascii=False),
        "",
        "## Regression guards (not optimization targets)",
        "",
        "| pool | model | pairwise | hit | std sep |",
        "|---|---|---:|---:|---:|",
    ]
    for pool in ("OLD_DEV", "FRESH_A"):
        for model in ("CONTROL", "V3"):
            h = p["regression_guards"][pool][model]["headline"]
            lines.append(f"| {pool} | {model} | {_r4(h['macro_pairwise'])} | {h['subject_hit']} | {_r4(h['std_sep'])} |")
    lines += [
        "",
        f"Gate: {'PASS' if p['gate_ok'] else 'FAIL'} {p['gate_reasons']}",
        "",
        "## Synthetic QA (structural only)",
        "",
        f"n_births={p['synthetic']['n_births']} full_annual={p['synthetic']['n_full_annual']}",
        "",
        f"CONTROL sat={p['synthetic']['CONTROL']['Y_sat_frac']} "
        f"cliff={p['synthetic']['CONTROL']['daewoon']}",
        "",
        "## CHECK",
        "",
    ]
    if p.get("check"):
        lines += [
            "| model | pairwise | hit | std sep | median sep |",
            "|---|---:|---:|---:|---:|",
        ]
        for model in ("CONTROL", "V2_DY_B", "V3"):
            h = p["check"][model]["headline"]
            lines.append(
                f"| {model} | {_r4(h['macro_pairwise'])} | {h['subject_hit']} | "
                f"{_r4(h['std_sep'])} | {_r4(h['median_sep'])} |"
            )
    else:
        lines.append("CHECK not opened or gate failed.")
    lines += [
        "",
        "V3 does not need to beat V2. No production wiring. No FINAL.",
        "",
    ]
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def write_spec(p: dict, v2h: str) -> None:
    spec = {
        "status": p["status"],
        "model_id": V3_ID,
        "parent": "V2_DY_B",
        "formula": {
            "D": "production engine 종합운점수 (candle.open / daewoon block)",
            "annual_dev": f"clip(A_G, ±{V3_ANNUAL_CLIP})",
            "Y": "clamp(D + annual_dev)",
            "dropped": ["V2 D_B z-formula", "B_trigger", "0.65/0.35 mix"],
        },
        "z_source": "unused for V3 D; A_G still G_CLEAN_AXIS within Daewoon block",
        "v2_sha256": v2h,
        "experiment_code": "test/experiments/v3_public_life/experiment_v3_public_life.py",
        "validation_b_used": False,
        "final_opened": False,
        "production_wired": False,
    }
    code = os.path.join(_HERE, "experiment_v3_public_life.py")
    spec["experiment_sha256"] = _sha256(code)
    with open(OUT_SPEC, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)
        f.write("\n")


if __name__ == "__main__":
    sys.exit(main())
