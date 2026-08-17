# -*- coding: utf-8 -*-
"""
V2 one-shot Validation B scorer — PROTOCOL v1.1 FREEZE by default.

Must NOT score Validation B unless BOTH are set:

  --execute-validation-b
  env V2_VALIDATION_B_EXECUTE=YES_IRREVERSIBLE

Default: hashes, dev self-test, freeze JSON. Never loads B for scoring.

Usage (freeze only):
  PYTHONPATH=.:test python test/experiments/validate_v2_b_one_shot.py

Future irreversible run (do not invoke now):
  V2_VALIDATION_B_EXECUTE=YES_IRREVERSIBLE \\
    PYTHONPATH=.:test python test/experiments/validate_v2_b_one_shot.py --execute-validation-b
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime
from itertools import product
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

PROTOCOL_VERSION = "V2_VAL_B_PROTOCOL_1.1"
EXECUTE_ENV = "V2_VALIDATION_B_EXECUTE"
EXECUTE_TOKEN = "YES_IRREVERSIBLE"
BOOT_N = 5000
BOOT_SEED = 20260813
PAIRWISE_PASS = 0.60
PAIRWISE_SUPPORTED = 0.57
HIT_FRAC = 0.57
BASE = 60.0
VARIANT_G = "G_CLEAN_AXIS"
EXPECT_B_TOTAL = 15
EXPECT_B_ELIGIBLE = 14
PREEXISTING_EXCLUSION_NAME = "Albert Einstein"
PREEXISTING_EXCLUSION_REASON = "engine_year_out_of_range(1879)"

OUT_PROTOCOL = os.path.join(_HERE, "V2_VALIDATION_B_PROTOCOL.md")
OUT_FREEZE = os.path.join(_HERE, "V2_VALIDATION_B_PROTOCOL_FREEZE.json")
OUT_LOCK = os.path.join(_HERE, "V2_VALIDATION_B_CONSUMPTION_LOCK.json")
OUT_RAW = os.path.join(_TEST, "snapshots", "exp_v2_validation_b_raw.json")
OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_validation_b.json")
OUT_REPORT = os.path.join(_HERE, "V2_VALIDATION_B_REPORT.md")
SCORER_PATH = os.path.join(_HERE, "validate_v2_b_one_shot.py")

PATHS = {
    "experiment_v2_dy.py": os.path.join(_HERE, "experiment_v2_dy.py"),
    "exp_v2_dy.json": os.path.join(_TEST, "snapshots", "exp_v2_dy.json"),
    "g_fresh_labels_frozen.json": os.path.join(_HERE, "g_fresh_labels_frozen.json"),
    "V2_DY_FINAL_FREEZE_MANIFEST.md": os.path.join(_HERE, "V2_DY_FINAL_FREEZE_MANIFEST.md"),
    "V2_FINAL_PRE_VALIDATION_MANIFEST.md": os.path.join(_HERE, "V2_FINAL_PRE_VALIDATION_MANIFEST.md"),
    "experiment_g_clean.py": os.path.join(_HERE, "experiment_g_clean.py"),
    "g_fresh_subjects_completed.json": os.path.join(_HERE, "g_fresh_subjects_completed.json"),
    "validate_v2_b_one_shot.py": SCORER_PATH,
}

FROZEN_MODEL_HASH16 = {
    "experiment_v2_dy.py": "d2c0199c5194dd63",
    "exp_v2_dy.json": "a45cca5a56a13bdb",
    "g_fresh_labels_frozen.json": "1b9fc0de41e6c6b3",
    "experiment_g_clean.py": "5537990671fd8bdb",
    "V2_DY_FINAL_FREEZE_MANIFEST.md": "eb86ac8dca943474",
    "V2_FINAL_PRE_VALIDATION_MANIFEST.md": "89434a33009da53f",
    "g_fresh_subjects_completed.json": "b1b593610a04f1ad",
}

EXPECT_FA_PW = 0.6429
EXPECT_OLD_PW = 0.5749
EXPECT_SAME_D = 0.5714
EXPECT_CROSS_D = 0.6531

PUBLIC_PREEXISTING_EXCLUSIONS = [
    {
        "name": PREEXISTING_EXCLUSION_NAME,
        "reason": PREEXISTING_EXCLUSION_REASON,
        "encoded_in": "g_fresh_labels_frozen.json eligible_for_primary_validation",
    }
]


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _r4(x: Optional[float]) -> Optional[float]:
    if x is None or (isinstance(x, float) and x != x):
        return None
    return round(float(x), 4)


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def pair_outcome(good_score: float, bad_score: float) -> float:
    """Primary pair convention: 1 / 0.5 / 0."""
    if good_score > bad_score:
        return 1.0
    if good_score == bad_score:
        return 0.5
    return 0.0


def pairwise_raw(good: Sequence[float], bad: Sequence[float]) -> Optional[float]:
    if not good or not bad:
        return None
    acc = 0.0
    n = 0
    for g in good:
        for b in bad:
            acc += pair_outcome(float(g), float(b))
            n += 1
    return acc / n


def hit_floor(n: int) -> int:
    if n <= 0:
        return 0
    return int(math.ceil(HIT_FRAC * n))


def assign_status(
    *,
    pairwise: Optional[float],
    n_hit: int,
    n: int,
    std_sep: Optional[float],
    median_sep: Optional[float],
    integrity_ok: bool,
) -> str:
    """Fully mechanical. Do not alter after B is opened."""
    if not integrity_ok:
        return "DATA_INTEGRITY_BLOCK"
    if pairwise is None or n <= 0 or std_sep is None or median_sep is None:
        return "DATA_INTEGRITY_BLOCK"
    floor = hit_floor(n)
    hit_ok = n_hit >= floor
    hit_rate = n_hit / n

    if pairwise >= PAIRWISE_PASS and hit_ok and std_sep > 0 and median_sep > 0:
        return "ANNUAL_PASS"
    if pairwise >= PAIRWISE_SUPPORTED and hit_ok and std_sep > 0 and median_sep >= 0:
        return "ANNUAL_SUPPORTED_WITH_UNCERTAINTY"
    if pairwise < 0.50:
        return "ANNUAL_FAIL"
    if hit_rate < 0.50 and std_sep < 0 and median_sep < 0:
        return "ANNUAL_FAIL"
    return "ANNUAL_MIXED"


def run_status_unit_tests() -> Dict[str, Any]:
    cases = [
        ("PASS", dict(pairwise=0.61, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_PASS"),
        ("PASS_EXACT_060", dict(pairwise=0.60, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_PASS"),
        ("SUPPORTED", dict(pairwise=0.58, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_SUPPORTED_WITH_UNCERTAINTY"),
        ("SUPPORTED_EXACT_057", dict(pairwise=0.57, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_SUPPORTED_WITH_UNCERTAINTY"),
        ("SUPPORTED_MEDIAN0", dict(pairwise=0.61, n_hit=8, n=14, std_sep=0.1, median_sep=0.0, integrity_ok=True), "ANNUAL_SUPPORTED_WITH_UNCERTAINTY"),
        ("PRECISION_BELOW_PASS", dict(pairwise=0.59995, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_SUPPORTED_WITH_UNCERTAINTY"),
        ("PRECISION_BELOW_SUPPORTED", dict(pairwise=0.56995, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_MIXED"),
        ("MIXED_055", dict(pairwise=0.55, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_MIXED"),
        ("FAIL_049", dict(pairwise=0.49, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=True), "ANNUAL_FAIL"),
        ("FAIL_SYSTEMATIC", dict(pairwise=0.55, n_hit=6, n=14, std_sep=-0.1, median_sep=-0.2, integrity_ok=True), "ANNUAL_FAIL"),
        ("INTEGRITY", dict(pairwise=0.61, n_hit=8, n=14, std_sep=0.1, median_sep=0.2, integrity_ok=False), "DATA_INTEGRITY_BLOCK"),
    ]
    rows = []
    ok = True
    for name, kwargs, expect in cases:
        got = assign_status(**kwargs)
        rows.append({"name": name, "expect": expect, "got": got, "ok": got == expect})
        if got != expect:
            ok = False
    return {"ok": ok, "cases": rows}


def run_precision_aggregation_test() -> Dict[str, Any]:
    """Prove aggregations use raw floats, not per-subject 4-decimal rounding."""
    rows = []
    for i in range(3):
        rows.append({
            "name": f"s{i}",
            "pairwise_raw": 2.0 / 3.0,
            "sep_raw": 1.0 / 3.0,
            "good_avg_raw": 2.0 / 3.0,
            "bad_avg_raw": 1.0 / 3.0,
            "hit": True,
        })
    prim = primary_from_subject_raws(rows, [0.0, 1.0, 2.0])
    raw = prim["macro_pairwise_raw"]
    rounded_first = float(np.mean([round(2.0 / 3.0, 4)] * 3))
    sep_raw = prim["mean_sep_raw"]
    sep_rounded_first = float(np.mean([round(1.0 / 3.0, 4)] * 3))
    ok = (
        raw == (2.0 / 3.0)
        and raw != rounded_first
        and sep_raw == (1.0 / 3.0)
        and sep_raw != sep_rounded_first
        and _r4(raw) == 0.6667
    )
    return {
        "ok": ok,
        "macro_raw_equals_two_thirds": raw == (2.0 / 3.0),
        "macro_differs_from_round_then_mean": raw != rounded_first,
        "serialized_r4": _r4(raw),
    }


def _exclusive_write(path: str, text: str) -> None:
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    fd = os.open(path, flags, 0o644)
    try:
        data = text.encode("utf-8")
        off = 0
        while off < len(data):
            off += os.write(fd, data[off:])
    finally:
        os.close(fd)


def acquire_consumption_lock(scorer_hash: str, freeze_hash: str) -> None:
    payload = {
        "protocol_version": PROTOCOL_VERSION,
        "execution_started_at": datetime.now().isoformat(timespec="seconds"),
        "scorer_sha256": scorer_hash,
        "protocol_freeze_sha256": freeze_hash,
        "model": "V2_DY_B",
        "state": "CONSUMED_STARTED",
    }
    _exclusive_write(OUT_LOCK, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def complete_consumption_lock() -> None:
    lock = json.load(open(OUT_LOCK, encoding="utf-8"))
    started = lock.get("execution_started_at")
    lock["state"] = "CONSUMED_COMPLETE"
    lock["execution_started_at"] = started
    lock["execution_completed_at"] = datetime.now().isoformat(timespec="seconds")
    tmp = OUT_LOCK + ".complete_tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lock, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, OUT_LOCK)


def collect_integrity_hashes() -> Dict[str, Any]:
    hashes = {}
    for name, path in PATHS.items():
        full = _sha256(path)
        hashes[name] = {"sha256": full, "sha256_16": full[:16], "path": path}
    return hashes


def verify_dev_headlines() -> Dict[str, Any]:
    snap = json.load(open(PATHS["exp_v2_dy.json"], encoding="utf-8"))
    b = snap["results"]["V2_DY_B"]
    fa_pw = b["FRESH_A_DEV"]["annual"]["pairwise_mean"]
    old_pw = b["OLD_DEV"]["annual"]["pairwise_mean"]
    ok = (
        fa_pw == EXPECT_FA_PW
        and old_pw == EXPECT_OLD_PW
        and snap.get("validation_b_scored") is False
    )
    return {
        "FA_pw": fa_pw,
        "OLD_pw": old_pw,
        "expect_same_D": EXPECT_SAME_D,
        "expect_cross_D": EXPECT_CROSS_D,
        "validation_b_scored_in_dev_snap": snap.get("validation_b_scored"),
        "ok": ok,
    }


def verify_split_and_eligibility_expectation() -> Dict[str, Any]:
    """Counts + Einstein-only exclusion. Does not print other B names."""
    freeze = json.load(open(PATHS["g_fresh_labels_frozen.json"], encoding="utf-8"))
    a = list(freeze.get("validation_a") or [])
    b = list(freeze.get("validation_b") or [])
    elig = set(freeze.get("eligible_for_primary_validation") or [])
    overlap = set(a) & set(b)
    excluded_b = sorted(set(b) - elig)
    n_b_eligible = len(set(b) & elig)
    einstein_in_b = PREEXISTING_EXCLUSION_NAME in b
    einstein_excluded = PREEXISTING_EXCLUSION_NAME not in elig
    ok = (
        len(a) == 15
        and len(b) == EXPECT_B_TOTAL
        and len(overlap) == 0
        and excluded_b == [PREEXISTING_EXCLUSION_NAME]
        and n_b_eligible == EXPECT_B_ELIGIBLE
        and einstein_in_b
        and einstein_excluded
        and freeze.get("dataset_sha256") == _sha256(PATHS["g_fresh_subjects_completed.json"])
    )
    return {
        "n_validation_a": len(a),
        "n_validation_b": len(b),
        "n_b_eligible": n_b_eligible,
        "excluded_b_preregistered": excluded_b,
        "split_ok": ok,
        "a_b_overlap_n": len(overlap),
        "dataset_sha_ok": freeze.get("dataset_sha256") == _sha256(PATHS["g_fresh_subjects_completed.json"]),
        "labels_frozen": freeze.get("labels_frozen"),
    }


def primary_from_subject_raws(rows: List[dict], all_year_scores: List[float]) -> Dict[str, Any]:
    """All aggregations from RAW floats. No pre-rounding."""
    pws = [r["pairwise_raw"] for r in rows if r["pairwise_raw"] is not None]
    seps = [r["sep_raw"] for r in rows]
    n = len(rows)
    n_hit = sum(1 for r in rows if r["hit"])
    macro = float(np.mean(pws)) if pws else None
    mean_sep = float(np.mean(seps)) if seps else None
    median_sep = float(np.median(seps)) if seps else None
    sd = float(np.std(all_year_scores, ddof=1)) if len(all_year_scores) > 1 else float("nan")
    std_sep = (mean_sep / sd) if (mean_sep is not None and sd == sd and sd > 1e-12) else None
    boot = None
    n_pw = len(pws)
    if pws and n_pw > 0:
        rng = np.random.default_rng(BOOT_SEED)
        pw_arr = np.asarray(pws, dtype=float)
        samples = []
        for _ in range(BOOT_N):
            idx = rng.integers(0, n_pw, size=n_pw)
            samples.append(float(np.mean(pw_arr[idx])))
        samples = np.asarray(samples)
        boot = {
            "n": BOOT_N,
            "seed": BOOT_SEED,
            "unit": "subject",
            "median_raw": float(np.median(samples)),
            "ci95_raw": [float(np.percentile(samples, 2.5)), float(np.percentile(samples, 97.5))],
            "P_pairwise_gt_0.50": float(np.mean(samples > 0.50)),
        }
    status = assign_status(
        pairwise=macro, n_hit=n_hit, n=n,
        std_sep=std_sep, median_sep=median_sep, integrity_ok=True,
    )
    return {
        "n": n,
        "n_hit": n_hit,
        "macro_pairwise_raw": macro,
        "mean_sep_raw": mean_sep,
        "median_sep_raw": median_sep,
        "std_sep_raw": std_sep,
        "bootstrap": boot,
        "status": status,
        "positive": sum(1 for r in rows if r["sep_raw"] > 0),
        "neutral": sum(1 for r in rows if r["sep_raw"] == 0),
        "negative": sum(1 for r in rows if r["sep_raw"] < 0),
    }


def subject_raw_row(name: str, gs: List[float], bs: List[float]) -> Optional[dict]:
    if not gs or not bs:
        return None
    ga = float(np.mean(gs))
    ba = float(np.mean(bs))
    return {
        "name": name,
        "pairwise_raw": pairwise_raw(gs, bs),
        "sep_raw": ga - ba,
        "good_avg_raw": ga,
        "bad_avg_raw": ba,
        "hit": ga > ba,
        "n_good": len(gs),
        "n_bad": len(bs),
    }


def same_cross_pairwise(pair_outcomes_same: List[float], pair_outcomes_cross: List[float]) -> Dict[str, Any]:
    def mean(xs):
        return None if not xs else float(np.mean(xs))
    return {
        "same_D_pairwise_raw": mean(pair_outcomes_same),
        "cross_D_pairwise_raw": mean(pair_outcomes_cross),
    }


def _score_v2_dy_b(dev_packs: List[dict], holdout_packs: List[dict]):
    from experiments import experiment_v2_dy as DY
    from experiments import arm_b
    from experiments.experiment_g_clean import score_g

    pack_blocks = {}
    for pack in dev_packs + holdout_packs:
        pack_blocks[pack["name"]] = DY._block_feats(pack)
    all_block_rows = []
    for pack in dev_packs:
        all_block_rows.extend(pack_blocks[pack["name"]].values())
    z_keys = ["fav_minus_unfav", "struct_activ", "struct_disrupt", "struct_excess"]
    z_params = {k: DY._robust_params([float(r[k]) for r in all_block_rows]) for k in z_keys}

    def zf(row, k):
        return DY._z_clip(row[k], *z_params[k])

    D_map = {}
    for pack in dev_packs + holdout_packs:
        for pillar, f in pack_blocks[pack["name"]].items():
            h_b = (
                0.45 * zf(f, "fav_minus_unfav")
                + 0.35 * zf(f, "struct_activ")
                - 0.35 * zf(f, "struct_disrupt")
                - 0.15 * zf(f, "struct_excess")
            )
            D_map[(pack["name"], pillar)] = _clamp(BASE + 3.0 * h_b)

    cfg = dict(arm_b.ARM_B_CONFIG)
    layers_list, score_maps = [], []
    for pack in holdout_packs:
        gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
        by_p = defaultdict(list)
        for y, m in pack["meta"].items():
            p = str(m.get("대운_pillar") or "_")
            if (pack["name"], p) not in D_map:
                continue
            by_p[p].append(gmap[int(y)])
        med = {p: float(np.median(vs)) for p, vs in by_p.items()}
        layers, smap = {}, {}
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
            y_disp = _clamp(d + annual_dev)
            layers[int(y)] = {
                "pillar": pillar, "D": d, "A": a, "annual_dev": annual_dev,
                "Y": y_disp, "G": gmap[int(y)], "trigger": trigger,
            }
            smap[int(y)] = y_disp
        layers_list.append(layers)
        score_maps.append(smap)
    return layers_list, score_maps, z_params


def _parent_tag(dAnn: float, dY: float, dD: float) -> str:
    ann_ok = dAnn > 1e-9
    y_ok = dY > 1e-9
    ann_tie = abs(dAnn) <= 1e-9
    if ann_ok and not y_ok:
        return "PARENT_HARM"
    if (not ann_ok) and (not ann_tie) and y_ok and (dD > 1e-9):
        return "PARENT_HELP"
    if ann_ok and y_ok:
        return "PARENT_PRESERVE"
    return "OTHER"


def _eval_pool(packs, layers_list, score_maps) -> Tuple[List[dict], List[float], List[float], List[float], Dict[str, Any]]:
    rows = []
    all_s = []
    same_out, cross_out = [], []
    same_legacy, cross_legacy = [], []
    parent_tags = []
    for pack, layers, smap in zip(packs, layers_list, score_maps):
        good = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in smap]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in smap]
        gs = [smap[int(e["year"])] for e in good]
        bs = [smap[int(e["year"])] for e in bad]
        all_s.extend(smap.values())
        row = subject_raw_row(pack["name"], gs, bs)
        if row:
            rows.append(row)
        for ge, be in product(good, bad):
            Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
            oc = pair_outcome(Lg["Y"], Lb["Y"])
            oc_legacy = 1.0 if Lg["Y"] > Lb["Y"] else 0.0
            if Lg["pillar"] == Lb["pillar"]:
                same_out.append(oc)
                same_legacy.append(oc_legacy)
            else:
                cross_out.append(oc)
                cross_legacy.append(oc_legacy)
            parent_tags.append(_parent_tag(
                Lg["annual_dev"] - Lb["annual_dev"],
                Lg["Y"] - Lb["Y"],
                Lg["D"] - Lb["D"],
            ))
    prim = primary_from_subject_raws(rows, all_s)
    sc = same_cross_pairwise(same_out, cross_out)
    sc_legacy = same_cross_pairwise(same_legacy, cross_legacy)
    n_p = len(parent_tags) or 1
    help_r = sum(1 for t in parent_tags if t == "PARENT_HELP") / n_p
    harm_r = sum(1 for t in parent_tags if t == "PARENT_HARM") / n_p
    n_ties = sum(1 for x in same_out + cross_out if x == 0.5)
    return rows, all_s, same_out, cross_out, {
        **prim,
        **sc,
        "same_D_pairwise_legacy_raw": sc_legacy["same_D_pairwise_raw"],
        "cross_D_pairwise_legacy_raw": sc_legacy["cross_D_pairwise_raw"],
        "same_cross_tie_n": n_ties,
        "B_PARENT_HELP": help_r,
        "B_PARENT_HARM": harm_r,
        "B_PARENT_NET": help_r - harm_r,
    }


def run_dev_self_test() -> Dict[str, Any]:
    """DEVELOPMENT data only. Does not load Validation B packs."""
    from experiments import experiment_v2_dy as DY
    from experiments.validate_g_fresh_a import OUT_LABELS

    status_tests = run_status_unit_tests()
    precision_test = run_precision_aggregation_test()
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old_packs, fresh_packs, val_b = DY._load_pools(freeze)
    if any(p["name"] in val_b for p in old_packs + fresh_packs):
        raise RuntimeError("Val B leaked into development packs")
    dev = old_packs + fresh_packs
    layers, maps, _zp = _score_v2_dy_b(dev, dev)
    by_pool = {"OLD_DEV": ([], [], []), "FRESH_A_DEV": ([], [], [])}
    # split layers back
    idx_old = list(range(len(old_packs)))
    idx_fa = list(range(len(old_packs), len(dev)))
    results = {}
    for pool, idx in (("OLD_DEV", idx_old), ("FRESH_A_DEV", idx_fa)):
        sub_p = [dev[i] for i in idx]
        sub_l = [layers[i] for i in idx]
        sub_m = [maps[i] for i in idx]
        _rows, _s, _same, _cross, agg = _eval_pool(sub_p, sub_l, sub_m)
        results[pool] = agg

    fa = results["FRESH_A_DEV"]
    old = results["OLD_DEV"]
    fa_pw = _r4(fa["macro_pairwise_raw"])
    old_pw = _r4(old["macro_pairwise_raw"])
    fa_same = _r4(fa["same_D_pairwise_raw"])
    fa_cross = _r4(fa["cross_D_pairwise_raw"])
    fa_same_legacy = _r4(fa["same_D_pairwise_legacy_raw"])
    fa_cross_legacy = _r4(fa["cross_D_pairwise_legacy_raw"])
    primary_ok = fa_pw == EXPECT_FA_PW and old_pw == EXPECT_OLD_PW
    # Frozen same/cross headlines used tie=0. Protocol uses 1/0.5/0.
    # Self-test must reproduce the frozen headline via the legacy convention.
    headline_same_cross_ok = (
        fa_same_legacy == EXPECT_SAME_D and fa_cross_legacy == EXPECT_CROSS_D
    )
    match = (
        primary_ok
        and headline_same_cross_ok
        and status_tests["ok"]
        and precision_test["ok"]
    )
    return {
        "ok": match,
        "status_unit_tests": status_tests,
        "precision_aggregation_test": precision_test,
        "full_precision_internal": True,
        "bootstrap_resamples_subjects": True,
        "FA_macro_pairwise_raw": fa["macro_pairwise_raw"],
        "FA_macro_pairwise_r4": fa_pw,
        "OLD_macro_pairwise_r4": old_pw,
        "FA_same_D_r4": fa_same,
        "FA_cross_D_r4": fa_cross,
        "FA_same_D_legacy_tie0_r4": fa_same_legacy,
        "FA_cross_D_legacy_tie0_r4": fa_cross_legacy,
        "same_cross_tie_n_FA": fa["same_cross_tie_n"],
        "protocol_same_cross_matches_headline": (
            fa_same == EXPECT_SAME_D and fa_cross == EXPECT_CROSS_D
        ),
        "expect": {
            "FA_pw": EXPECT_FA_PW,
            "OLD_pw": EXPECT_OLD_PW,
            "FA_same_D": EXPECT_SAME_D,
            "FA_cross_D": EXPECT_CROSS_D,
        },
    }


def protocol_payload(hashes, headlines, split, self_test) -> Dict[str, Any]:
    return {
        "protocol_version": PROTOCOL_VERSION,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "status": "V2_VALIDATION_B_PROTOCOL_V11_FROZEN",
        "validation_b_executed": False,
        "validation_b_scored": False,
        "consumption_lock_created": False,
        "model": "V2_DY_B",
        "formula": {
            "D_B": "clamp(60 + 3 * h_B)",
            "h_B": "0.45 z(fav_minus_unfav)+0.35 z(struct_activ)-0.35 z(struct_disrupt)-0.15 z(struct_excess)",
            "z": "robust z, clip ±2.5, scale_floor 0.35; fit OLD_DEV+Fresh A only",
            "annual_dev_B": "0.65*A_G + 0.35*B_trigger",
            "Y": "clamp(D_B + annual_dev_B)",
        },
        "metrics": {
            "internal": "full float precision (pairwise_raw, sep_raw, good_avg_raw, bad_avg_raw)",
            "round_only": "serialization / human-readable report",
            "pair": "good>bad=1, tie=0.5, good<bad=0",
            "macro": "unweighted mean of per-subject pairwise_raw",
            "same_cross_diagnostic": "same 1/0.5/0 convention; cannot change status",
            "same_cross_frozen_headline_note": "Phase 2.6/2.7 headlines 0.5714/0.6531 used tie=0; self-test reproduces them via legacy convention only",
        },
        "decision_rule_order": [
            "DATA_INTEGRITY_BLOCK if integrity_ok is false or missing metrics",
            "ANNUAL_PASS if macro>=0.60 and hit>=ceil(0.57*n) and std_sep>0 and median_sep>0",
            "ANNUAL_SUPPORTED_WITH_UNCERTAINTY if macro>=0.57 and hit>=ceil(0.57*n) and std_sep>0 and median_sep>=0",
            "ANNUAL_FAIL if macro<0.50",
            "ANNUAL_FAIL if hit_rate<0.50 AND std_sep<0 AND median_sep<0",
            "else ANNUAL_MIXED",
        ],
        "decision_thresholds": {
            "ANNUAL_PASS": {
                "macro_pairwise_ge": PAIRWISE_PASS,
                "subject_hit_ge": "ceil(0.57 * n)",
                "std_sep_gt": 0,
                "median_sep_gt": 0,
            },
            "ANNUAL_SUPPORTED_WITH_UNCERTAINTY": {
                "macro_pairwise_ge": PAIRWISE_SUPPORTED,
                "subject_hit_ge": "ceil(0.57 * n)",
                "std_sep_gt": 0,
                "median_sep_ge": 0,
            },
            "ANNUAL_FAIL": {
                "macro_lt": 0.50,
                "or_all_three": ["subject_hit_rate < 0.50", "std_sep < 0", "median_sep < 0"],
            },
            "ANNUAL_MIXED": "else",
        },
        "one_shot_lock": {
            "path": "test/experiments/V2_VALIDATION_B_CONSUMPTION_LOCK.json",
            "create": "exclusive O_CREAT|O_EXCL immediately BEFORE loading validation_b names/events",
            "if_exists": "REFUSE execution",
            "crash_after_create": "B is CONSUMED; no automatic retry",
            "this_run_created": False,
        },
        "immutable_outputs": {
            "exclusive_create": [
                "test/snapshots/exp_v2_validation_b_raw.json",
                "test/snapshots/exp_v2_validation_b.json",
                "test/experiments/V2_VALIDATION_B_REPORT.md",
            ],
            "if_exists": "REFUSE execution",
            "raw_before_status_narrative": True,
        },
        "eligibility_expectation": {
            "validation_b_total": EXPECT_B_TOTAL,
            "eligible_primary": EXPECT_B_ELIGIBLE,
            "preexisting_exclusion_set": PUBLIC_PREEXISTING_EXCLUSIONS,
            "unexpected_exclusion": "DATA_INTEGRITY_BLOCK",
            "eligible_must_have_good_and_bad": True,
        },
        "allowed_exclusions": PUBLIC_PREEXISTING_EXCLUSIONS,
        "prohibited_actions": [
            "score H1/H2/orthodox/G-only/legacy/Month/Day/new candidates",
            "post-hoc subject exclusion after seeing scores",
            "label/event/date edits after unseal",
            "tune weights on Validation B",
            "use B as development data",
            "claim full hierarchy validated from annual B",
            "automatic retry after CONSUMED_STARTED",
        ],
        "month_day_remain": {
            "Month": {"status": "V2_MONTH_TIMING_ONLY", "policy": "MONTH_LOW_CONFIDENCE_TIMING"},
            "Day": {"status": "V2_DAY_TIMING_ONLY", "policy": "DAY_EXPLANATION_ONLY"},
        },
        "dev_headlines_frozen": headlines,
        "split_public_metadata": split,
        "dev_self_test": self_test,
        "hashes": hashes,
        "execution": {
            "scorer": "test/experiments/validate_v2_b_one_shot.py",
            "require_flag": "--execute-validation-b",
            "require_env": f"{EXECUTE_ENV}={EXECUTE_TOKEN}",
            "preflight_scorer_hash_must_match_freeze": True,
            "order": [
                "verify hashes including scorer",
                "refuse if lock or immutable outputs exist",
                "exclusive-create consumption lock (BEFORE loading B names)",
                "verify split / Einstein-only exclusion / good+bad events",
                "load B",
                "compute V2_DY_B scores (z from OLD+FA only)",
                "exclusive-create raw snapshot",
                "primary metrics from RAW floats",
                "assign status mechanically",
                "exclusive-create result snapshot + report",
                "mark lock CONSUMED_COMPLETE",
            ],
        },
    }


def freeze_only() -> int:
    print("══════════ V2 VALIDATION B PROTOCOL v1.1 FREEZE ══════════")
    print("Validation B will NOT be scored. Consumption lock will NOT be created.")
    print("── status unit tests ──")
    st = run_status_unit_tests()
    print("  status_tests", st["ok"], [c["name"] for c in st["cases"] if not c["ok"]])
    print("── development self-test (OLD + Fresh A only) ──")
    self_test = run_dev_self_test()
    print(
        "  FA", self_test["FA_macro_pairwise_r4"],
        "OLD", self_test["OLD_macro_pairwise_r4"],
        "same_protocol", self_test["FA_same_D_r4"],
        "cross_protocol", self_test["FA_cross_D_r4"],
        "same_legacy", self_test["FA_same_D_legacy_tie0_r4"],
        "cross_legacy", self_test["FA_cross_D_legacy_tie0_r4"],
        "ok", self_test["ok"],
    )
    hashes = collect_integrity_hashes()
    headlines = verify_dev_headlines()
    split = verify_split_and_eligibility_expectation()
    block = []
    if not headlines["ok"]:
        block.append("dev_headline_mismatch")
    if not split["split_ok"]:
        block.append("eligibility_expectation_mismatch")
    if not split["dataset_sha_ok"]:
        block.append("dataset_sha_mismatch")
    if not self_test["ok"]:
        block.append("dev_self_test_mismatch")
    if not st["ok"]:
        block.append("status_unit_tests_failed")
    if os.path.exists(OUT_LOCK):
        block.append("consumption_lock_already_exists")
    for k, expect16 in FROZEN_MODEL_HASH16.items():
        if hashes[k]["sha256_16"] != expect16:
            block.append(f"model_hash_drift:{k}")
    payload = protocol_payload(hashes, headlines, split, {
        "ok": self_test["ok"],
        "FA_macro_pairwise_r4": self_test["FA_macro_pairwise_r4"],
        "OLD_macro_pairwise_r4": self_test["OLD_macro_pairwise_r4"],
        "FA_same_D_r4": self_test["FA_same_D_r4"],
        "FA_cross_D_r4": self_test["FA_cross_D_r4"],
        "FA_same_D_legacy_tie0_r4": self_test["FA_same_D_legacy_tie0_r4"],
        "FA_cross_D_legacy_tie0_r4": self_test["FA_cross_D_legacy_tie0_r4"],
        "same_cross_tie_n_FA": self_test["same_cross_tie_n_FA"],
        "protocol_same_cross_matches_headline": self_test["protocol_same_cross_matches_headline"],
        "status_unit_tests_ok": self_test["status_unit_tests"]["ok"],
        "precision_aggregation_ok": self_test["precision_aggregation_test"]["ok"],
        "full_precision_internal": True,
        "bootstrap_resamples_subjects": True,
    })
    if not self_test["precision_aggregation_test"]["ok"]:
        block.append("precision_aggregation_test_failed")
    if os.path.exists(OUT_RAW) or os.path.exists(OUT_SNAP) or os.path.exists(OUT_REPORT):
        block.append("validation_b_result_artifact_already_exists")
    if block:
        payload["status"] = "V2_VALIDATION_B_PROTOCOL_BLOCKED"
        payload["block_reasons"] = block
    with open(OUT_FREEZE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("══════════ STATUS ══════════")
    print(payload["status"])
    if block:
        print("block_reasons", block)
    print(f"→ {OUT_FREEZE}")
    return 0 if not block else 1


def execute_validation_b() -> int:
    """Irreversible. Lock before B names. Do not call from freeze run."""
    from experiments import experiment_v2_dy as DY
    from experiments.validate_g_fresh_a import (
        FRESH_JSON, OUT_BIRTH_QA, OUT_LABELS, _pack_subject, engine_recompute_birth,
    )

    if not os.path.exists(OUT_FREEZE):
        print("Protocol freeze JSON missing.")
        return 2
    freeze_prereg = json.load(open(OUT_FREEZE, encoding="utf-8"))
    if freeze_prereg.get("protocol_version") != PROTOCOL_VERSION:
        print("Protocol version mismatch.")
        return 2
    hashes_now = collect_integrity_hashes()
    integrity_issues = []
    for name, rec in freeze_prereg["hashes"].items():
        if hashes_now.get(name, {}).get("sha256") != rec["sha256"]:
            integrity_issues.append(f"hash_drift:{name}")
    if hashes_now["validate_v2_b_one_shot.py"]["sha256"] != freeze_prereg["hashes"]["validate_v2_b_one_shot.py"]["sha256"]:
        integrity_issues.append("scorer_hash_mismatch")
    if os.path.exists(OUT_LOCK):
        print("REFUSE: consumption lock already exists. B is consumed.")
        return 2
    for p in (OUT_RAW, OUT_SNAP, OUT_REPORT):
        if os.path.exists(p):
            print(f"REFUSE: immutable output exists: {p}")
            return 2
    if integrity_issues:
        print("DATA_INTEGRITY_BLOCK before lock (B not loaded):", integrity_issues)
        return 1

    freeze_hash = _sha256(OUT_FREEZE)
    scorer_hash = hashes_now["validate_v2_b_one_shot.py"]["sha256"]
    acquire_consumption_lock(scorer_hash, freeze_hash)
    # From here B is CONSUMED even if we crash.

    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    val_b_names = list(freeze["validation_b"])
    val_a_names = set(freeze["validation_a"])
    eligible = set(freeze["eligible_for_primary_validation"])
    events = freeze["eligible_events"]
    post_lock_issues = []
    if set(val_b_names) & val_a_names:
        post_lock_issues.append("a_b_overlap")
    if len(val_b_names) != EXPECT_B_TOTAL or len(val_a_names) != 15:
        post_lock_issues.append("split_not_15_15")
    excluded_b = sorted(set(val_b_names) - eligible)
    if excluded_b != [PREEXISTING_EXCLUSION_NAME]:
        post_lock_issues.append("exclusion_set_mismatch")
    eligible_b = [n for n in val_b_names if n in eligible]
    if len(eligible_b) != EXPECT_B_ELIGIBLE:
        post_lock_issues.append("eligible_count_mismatch")

    for name in eligible_b:
        ev = events.get(name) or {}
        g = [e for e in (ev.get("good") or []) if not e.get("exclude")]
        b = [e for e in (ev.get("bad") or []) if not e.get("exclude")]
        if len(g) < 1 or len(b) < 1:
            post_lock_issues.append(f"missing_good_or_bad:{name}")

    def _write_integrity_block(issues):
        raw = {
            "measured_at": datetime.now().isoformat(timespec="seconds"),
            "protocol_version": PROTOCOL_VERSION,
            "status": "DATA_INTEGRITY_BLOCK",
            "integrity_issues": issues,
            "validation_b_scored": False,
            "consumed": True,
        }
        _exclusive_write(OUT_RAW, json.dumps(raw, ensure_ascii=False, indent=2) + "\n")
        _exclusive_write(OUT_SNAP, json.dumps(raw, ensure_ascii=False, indent=2) + "\n")

    if post_lock_issues:
        _write_integrity_block(post_lock_issues)
        print("DATA_INTEGRITY_BLOCK (B consumed)", post_lock_issues)
        return 1

    old_packs, fresh_a_packs, _val_b_set = DY._load_pools(freeze)
    fresh = json.load(open(FRESH_JSON, encoding="utf-8"))
    by_subj = {s["name"]: s for s in fresh["subjects"]}
    birth_rows = json.load(open(OUT_BIRTH_QA, encoding="utf-8"))["rows"] if os.path.exists(OUT_BIRTH_QA) else [
        engine_recompute_birth(s) for s in fresh["subjects"]
    ]
    by_birth = {r["name"]: r for r in birth_rows}

    b_packs = []
    for name in eligible_b:
        s = by_subj[name]
        if s.get("split") != "validation_b":
            post_lock_issues.append(f"split_mismatch:{name}")
            continue
        pack = _pack_subject(s, by_birth[name]["engine_birth"], events[name])
        pack["pool"] = "VALIDATION_B"
        b_packs.append(pack)
    if post_lock_issues:
        _write_integrity_block(post_lock_issues)
        print("DATA_INTEGRITY_BLOCK (B consumed)", post_lock_issues)
        return 1

    layers_list, score_maps, z_params = _score_v2_dy_b(old_packs + fresh_a_packs, b_packs)

    raw_subjects = []
    for pack, layers, smap in zip(b_packs, layers_list, score_maps):
        good = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        raw_subjects.append({
            "name": pack["name"],
            "frozen_good_years": [int(e["year"]) for e in good],
            "frozen_bad_years": [int(e["year"]) for e in bad],
            "Y_by_year": {str(y): float(v) for y, v in smap.items()},
            "layers_by_year": {
                str(y): {
                    "Y": float(L["Y"]),
                    "D": float(L["D"]),
                    "annual_dev": float(L["annual_dev"]),
                    "pillar": L["pillar"],
                    "A": float(L["A"]),
                }
                for y, L in layers.items()
            },
            "exclusion_metadata": None,
        })
    raw = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "protocol_version": PROTOCOL_VERSION,
        "model": "V2_DY_B",
        "z_params": {k: [float(x) for x in v] for k, v in z_params.items()},
        "exclusions_preexisting": PUBLIC_PREEXISTING_EXCLUSIONS,
        "excluded_subjects": [
            {
                "name": PREEXISTING_EXCLUSION_NAME,
                "reason": PREEXISTING_EXCLUSION_REASON,
                "scored": False,
            }
        ],
        "n_eligible_scored": len(b_packs),
        "subjects_raw": raw_subjects,
        "validation_b_scored": True,
        "primary_status_pending": True,
    }
    _exclusive_write(OUT_RAW, json.dumps(raw, ensure_ascii=False, indent=2) + "\n")

    rows, all_s, same_out, cross_out, agg = _eval_pool(b_packs, layers_list, score_maps)
    n = agg["n"]
    n_hit = agg["n_hit"]
    status = agg["status"]
    if n != len(b_packs) or n != EXPECT_B_ELIGIBLE:
        status = "DATA_INTEGRITY_BLOCK"

    Ds = [L["D"] for layers in layers_list for L in layers.values()]
    Anns = [L["annual_dev"] for layers in layers_list for L in layers.values()]
    Ys = [L["Y"] for layers in layers_list for L in layers.values()]
    boot = agg["bootstrap"] or {}

    result = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "protocol_version": PROTOCOL_VERSION,
        "model": "V2_DY_B",
        "status": status,
        "n_eligible": n,
        "subject_hit_floor": hit_floor(n),
        "primary": {
            "macro_pairwise": _r4(agg["macro_pairwise_raw"]),
            "subject_hit": f"{n_hit}/{n}",
            "subject_hit_rate": _r4(n_hit / n if n else None),
            "std_sep": _r4(agg["std_sep_raw"]),
            "median_sep": _r4(agg["median_sep_raw"]),
            "mean_sep": _r4(agg["mean_sep_raw"]),
        },
        "bootstrap": {
            "n": BOOT_N, "seed": BOOT_SEED, "unit": "subject",
            "median": _r4(boot.get("median_raw")),
            "ci95": [_r4(boot["ci95_raw"][0]), _r4(boot["ci95_raw"][1])] if boot.get("ci95_raw") else None,
            "P_pairwise_gt_0.50": _r4(boot.get("P_pairwise_gt_0.50")),
        },
        "distribution": {
            "positive": agg["positive"],
            "neutral": agg["neutral"],
            "negative": agg["negative"],
            "best": sorted(
                [{"name": r["name"], "sep": _r4(r["sep_raw"]), "pairwise": _r4(r["pairwise_raw"])} for r in rows],
                key=lambda x: x["sep"] or -999, reverse=True,
            )[:3],
            "worst": sorted(
                [{"name": r["name"], "sep": _r4(r["sep_raw"]), "pairwise": _r4(r["pairwise_raw"])} for r in rows],
                key=lambda x: x["sep"] or 999,
            )[:3],
        },
        "diagnostics_after_status": {
            "same_D_pairwise": _r4(agg["same_D_pairwise_raw"]),
            "cross_D_pairwise": _r4(agg["cross_D_pairwise_raw"]),
            "pair_convention": "1 / 0.5 / 0",
            "B_PARENT_HELP": _r4(agg["B_PARENT_HELP"]),
            "B_PARENT_HARM": _r4(agg["B_PARENT_HARM"]),
            "B_PARENT_NET": _r4(agg["B_PARENT_NET"]),
            "parent_local": "annual_dev_B",
            "D_p50": _r4(float(np.median(Ds)) if Ds else None),
            "D_min": _r4(float(np.min(Ds)) if Ds else None),
            "D_max": _r4(float(np.max(Ds)) if Ds else None),
            "abs_annual_dev_p90": _r4(float(np.percentile(np.abs(Anns), 90)) if Anns else None),
            "Y_sat_frac": _r4(sum(1 for y in Ys if y <= 0.5 or y >= 99.5) / len(Ys) if Ys else None),
            "Y_min": _r4(float(np.min(Ys)) if Ys else None),
            "Y_max": _r4(float(np.max(Ys)) if Ys else None),
        },
        "exclusions_preexisting": PUBLIC_PREEXISTING_EXCLUSIONS,
        "subjects": [
            {
                "name": r["name"],
                "pairwise": _r4(r["pairwise_raw"]),
                "hit": 1 if r["hit"] else 0,
                "sep": _r4(r["sep_raw"]),
                "good_avg": _r4(r["good_avg_raw"]),
                "bad_avg": _r4(r["bad_avg_raw"]),
                "n_good": r["n_good"],
                "n_bad": r["n_bad"],
            }
            for r in rows
        ],
        "month_day_unchanged": freeze_prereg["month_day_remain"],
        "validation_b_scored": True,
        "used_as_development": False,
    }
    _exclusive_write(OUT_SNAP, json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    report = "\n".join([
        "# V2 Validation B Report",
        "",
        f"**Status:** `{status}`",
        f"**Protocol:** `{PROTOCOL_VERSION}`",
        f"**Model:** V2_DY_B only",
        f"**n eligible:** {n} (hit floor {hit_floor(n)})",
        "",
        "## Primary",
        "",
        f"- macro pairwise: {result['primary']['macro_pairwise']}",
        f"- subject hit: {result['primary']['subject_hit']}",
        f"- std sep: {result['primary']['std_sep']}",
        f"- median sep: {result['primary']['median_sep']}",
        f"- bootstrap median / 95% CI / P(>0.50): "
        f"{result['bootstrap']['median']} / {result['bootstrap']['ci95']} / "
        f"{result['bootstrap']['P_pairwise_gt_0.50']}",
        "",
        "## Month / Day",
        "",
        "Unchanged. Annual B does not validate Month or Day.",
        "",
        "No tuning on Validation B. B is consumed holdout.",
        "",
    ])
    _exclusive_write(OUT_REPORT, report)
    complete_consumption_lock()
    print("══════════ STATUS ══════════")
    print(status)
    print(f"→ {OUT_SNAP}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--execute-validation-b",
        action="store_true",
        help="Irreversible. Also requires env V2_VALIDATION_B_EXECUTE=YES_IRREVERSIBLE",
    )
    args = ap.parse_args()
    if args.execute_validation_b:
        if os.environ.get(EXECUTE_ENV) != EXECUTE_TOKEN:
            print(
                "Refusing to execute Validation B: set "
                f"{EXECUTE_ENV}={EXECUTE_TOKEN} in addition to --execute-validation-b"
            )
            return 2
        return execute_validation_b()
    return freeze_only()


if __name__ == "__main__":
    sys.exit(main())
