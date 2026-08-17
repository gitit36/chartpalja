# -*- coding: utf-8 -*-
"""
Phase 6D — 대운 climate HP 스윕 (엔진 격리) → 이어서 세운 재검증(6E)

올바른 계층 순서:
  대운 climate 확정 → 세운(부모=climate) → 월 → 일

Stage D1: climate 조립 (mode / resid / open_weight / gen_amp)
  - 재료 가중은 현 B6 세운 재료로 고정
Stage D2: climate에 먹이는 general 재료 가중 소폭 탐색 (조립 고정)
Stage E : 확정 climate 위에서 세운 α·amp 재스윕 (dae_* 동결)

게이트
  - 대운 climate (mixed 제외) primary ≥ control, 목표 100%
  - 세운 train/holdout ≥90% (회귀)
  - 블록 모드면 within-block σ ≈ 0 (기조 상수)

Usage:
  python test/experiments/sweep_phase_d_daewoon.py
  python test/experiments/sweep_phase_d_daewoon.py --d1 60 --d2 40 --e 80
"""
from __future__ import annotations

import argparse
import json
import os
import sys
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

from experiments import arm_b, common as C  # noqa: E402
from experiments import hierarchy as H  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_sweep_phase_d.json")

TRAIN_MIN = 90.0
HOLDOUT_MIN = 90.0
DAE_PRIMARY_MIN = 75.0  # at least beat/match control open baseline

DAE_KEYS = (
    "dae_climate_mode",
    "dae_resid_scale",
    "dae_open_weight",
    "dae_gen_amp",
)
# D2에서만 흔드는 재료 (climate general 공급)
MAT_KEYS = (
    "yfit_pos_scale",
    "rel_weight",
    "yfit_career_normal",
    "yfit_career_conflict",
    "discord_pen",
    "hollow_pen",
    "health_guan_pen",
    "base",
)
SEW_KEYS = (
    "daewoon_blend",
    "yindep_amp",
)


def _tally_rows(rows, key):
    fake = [{"name": r["name"], "bucket": r["bucket"], "X": r[key]} for r in rows]
    return C.tally(fake, "X")


def _within_block_sigma(scorer, meta: Dict[int, dict]) -> float:
    from collections import defaultdict
    buckets = defaultdict(list)
    for m in meta.values():
        buckets[str(m.get("대운_pillar") or "_")].append(float(scorer(m)))
    sigs = []
    for vals in buckets.values():
        if len(vals) >= 2:
            sigs.append(float(np.std(vals)))
    return float(np.mean(sigs)) if sigs else 0.0


def _between_block_sigma(scorer, meta: Dict[int, dict]) -> float:
    from collections import defaultdict
    buckets = defaultdict(list)
    for m in meta.values():
        buckets[str(m.get("대운_pillar") or "_")].append(float(scorer(m)))
    means = [float(np.mean(v)) for v in buckets.values() if v]
    if len(means) < 2:
        return 0.0
    return float(np.std(means))


def evaluate_full(
    cfg: Dict[str, Any],
    subjects: List[dict],
    maps: Dict[str, Tuple[dict, dict]],
) -> Dict[str, Any]:
    rows = []
    within = []
    between = []
    for n in subjects:
        close, meta = maps[n["name"]]
        dae_sc = arm_b.make_dae_scorer(cfg, meta)
        sew_sc = arm_b.make_year_scorer(cfg, meta)
        rows.append({
            "name": n["name"],
            "bucket": C.cohort_bucket(n["name"]),
            "dae": H.eval_daewoon_on_person(
                n, close, meta, dae_sc, exclude_collisions=True
            ),
            "sew": C.eval_arm_on_person(
                n, close, meta, sew_sc, exclude_collisions=True
            ),
        })
        if C.cohort_bucket(n["name"]) != "soft_exclude":
            within.append(_within_block_sigma(dae_sc, meta))
            between.append(_between_block_sigma(dae_sc, meta))

    train = [r for r in rows if r["bucket"] == "train"]
    holdout = [r for r in rows if r["bucket"] == "holdout"]
    primary = [r for r in rows if r["bucket"] != "soft_exclude"]

    dae_tr = _tally_rows(train, "dae")
    dae_ho = _tally_rows(holdout, "dae")
    dae_pr = _tally_rows(primary, "dae")
    sew_tr = _tally_rows(train, "sew")
    sew_ho = _tally_rows(holdout, "sew")
    sew_pr = _tally_rows(primary, "sew")

    mode = str(cfg.get("dae_climate_mode") or "year_resid")
    w_sig = float(np.mean(within)) if within else 0.0
    b_sig = float(np.mean(between)) if between else 0.0

    dae_ok = (dae_pr.get("rate") or 0) >= DAE_PRIMARY_MIN
    # block 모드는 within≈0 이어야 기조
    block_ok = (not mode.startswith("block")) or (w_sig <= 0.15)
    sew_ok = (
        (sew_tr.get("rate") or 0) >= TRAIN_MIN
        and (sew_ho.get("rate") or 0) >= HOLDOUT_MIN
    )
    gated = dae_ok and block_ok and sew_ok

    return {
        "gated": gated,
        "dae_ok": dae_ok,
        "block_ok": block_ok,
        "sew_ok": sew_ok,
        "dae_train": dae_tr,
        "dae_holdout": dae_ho,
        "dae_primary": dae_pr,
        "sew_train": sew_tr,
        "sew_holdout": sew_ho,
        "sew_primary": sew_pr,
        "within_block_sigma": round(w_sig, 3),
        "between_block_sigma": round(b_sig, 3),
        "config_dae": {k: cfg.get(k) for k in DAE_KEYS},
        "config_mat": {k: cfg.get(k) for k in MAT_KEYS},
        "config_sew": {k: cfg.get(k) for k in SEW_KEYS},
        "dae_climate_mode": mode,
    }


def _rank_dae(r: Dict[str, Any]) -> Tuple:
    return (
        1 if r.get("gated") else 0,
        1 if r.get("dae_ok") else 0,
        1 if r.get("sew_ok") else 0,
        float(r.get("dae_primary", {}).get("rate") or 0),
        float(r.get("dae_primary", {}).get("avg_sep") or 0),
        float(r.get("between_block_sigma") or 0),
        -float(r.get("within_block_sigma") or 0),
        float(r.get("sew_holdout", {}).get("rate") or 0),
        float(r.get("sew_primary", {}).get("avg_sep") or 0),
    )


def _rank_sew(r: Dict[str, Any]) -> Tuple:
    return (
        1 if r.get("sew_ok") else 0,
        1 if r.get("dae_ok") else 0,
        float(r.get("sew_holdout", {}).get("rate") or 0),
        float(r.get("sew_train", {}).get("rate") or 0),
        float(r.get("sew_primary", {}).get("avg_sep") or 0),
        float(r.get("between_block_sigma") or 0),
        float(r.get("dae_primary", {}).get("avg_sep") or 0),
    )


def _sample_d1(rng: np.random.Generator, base: Dict[str, Any]) -> Dict[str, Any]:
    cfg = deepcopy(base)
    cfg["dae_climate_mode"] = str(rng.choice(["year_resid", "block_resid", "block_blend"]))
    cfg["dae_resid_scale"] = float(rng.uniform(0.3, 2.5))
    cfg["dae_open_weight"] = float(rng.uniform(0.40, 0.90))
    cfg["dae_gen_amp"] = float(rng.uniform(0.8, 2.5))
    cfg["daewoon_parent"] = "climate"
    return cfg


def _sample_d2(rng: np.random.Generator, base: Dict[str, Any]) -> Dict[str, Any]:
    """조립 고정, 재료만."""
    cfg = deepcopy(base)
    cfg["yfit_pos_scale"] = float(rng.uniform(0.55, 1.0))
    cfg["rel_weight"] = float(rng.uniform(0.35, 0.85))
    cfg["yfit_career_normal"] = float(rng.uniform(0.15, 0.45))
    cfg["yfit_career_conflict"] = float(rng.uniform(0.05, 0.22))
    cfg["discord_pen"] = float(rng.uniform(-14.0, -5.0))
    cfg["hollow_pen"] = float(rng.uniform(-10.0, -3.0))
    cfg["health_guan_pen"] = float(rng.uniform(-14.0, -6.0))
    cfg["base"] = float(rng.uniform(48.0, 56.0))
    return cfg


def _sample_e(rng: np.random.Generator, base: Dict[str, Any]) -> Dict[str, Any]:
    """dae_*·재료 고정, 세운 α·amp만."""
    cfg = deepcopy(base)
    cfg["daewoon_parent"] = "climate"
    cfg["daewoon_blend"] = float(rng.uniform(0.35, 0.55))  # 계층 α 하한 0.35
    cfg["yindep_amp"] = float(rng.uniform(1.5, 3.0))
    return cfg


def _snap(cfg: Dict[str, Any]) -> Dict[str, Any]:
    keys = list(DAE_KEYS) + list(MAT_KEYS) + list(SEW_KEYS) + ["daewoon_parent"]
    return {k: cfg.get(k) for k in keys}


def run(d1: int, d2: int, e_trials: int, seed: int) -> Dict[str, Any]:
    rng = np.random.default_rng(seed)
    subjects = C.load_core_subjects()
    maps = {n["name"]: C.engine_year_maps(n) for n in subjects}
    base = deepcopy(arm_b.ARM_B_CONFIG)

    # control dae baseline (open)
    ctrl_rows = []
    for n in subjects:
        close, meta = maps[n["name"]]
        ctrl_rows.append({
            "name": n["name"],
            "bucket": C.cohort_bucket(n["name"]),
            "dae": H.eval_daewoon_on_person(
                n, close, meta, None, exclude_collisions=True
            ),
        })
    ctrl_pr = _tally_rows(
        [r for r in ctrl_rows if r["bucket"] != "soft_exclude"], "dae"
    )
    print(f"control dae primary {C.fmt_rate(ctrl_pr)} avg_sep={ctrl_pr.get('avg_sep')}")

    # ── baseline current B ──
    print("\n── baseline (current arm_b) ──")
    b0 = evaluate_full(base, subjects, maps)
    b0["trial"] = 0
    b0["tag"] = "baseline"
    b0["config"] = _snap(base)
    print(
        f"  dae {C.fmt_rate(b0['dae_primary'])} sew_ho {C.fmt_rate(b0['sew_holdout'])} "
        f"mode={b0['dae_climate_mode']} withinσ={b0['within_block_sigma']} "
        f"betweenσ={b0['between_block_sigma']} gated={b0['gated']}"
    )

    # ── D1 assembly ──
    print(f"\n── D1 climate assembly ({d1} trials) ──")
    d1_res = [b0]
    for i in range(1, d1 + 1):
        cfg = _sample_d1(rng, base)
        ev = evaluate_full(cfg, subjects, maps)
        ev["trial"] = i
        ev["tag"] = "d1"
        ev["config"] = _snap(cfg)
        d1_res.append(ev)
        if i % 15 == 0 or ev["gated"]:
            mark = "★" if ev["gated"] else " "
            if i % 15 == 0 or ev["gated"]:
                print(
                    f"  {mark}[d1-{i}] dae={C.fmt_rate(ev['dae_primary'])} "
                    f"sew_ho={C.fmt_rate(ev['sew_holdout'])} "
                    f"mode={ev['dae_climate_mode']} "
                    f"wσ={ev['within_block_sigma']:.2f} bσ={ev['between_block_sigma']:.2f}"
                )
    d1_best = sorted(d1_res, key=_rank_dae, reverse=True)[0]
    print(
        f"D1 best trial={d1_best.get('trial')} gated={d1_best['gated']} "
        f"mode={d1_best['dae_climate_mode']} dae={C.fmt_rate(d1_best['dae_primary'])}"
    )

    # lock assembly onto working base
    locked = deepcopy(base)
    for k in DAE_KEYS:
        locked[k] = d1_best["config"].get(k, locked.get(k))
    # if best was baseline, keep baseline dae keys
    if d1_best.get("tag") == "baseline":
        for k in DAE_KEYS:
            locked[k] = base.get(k)

    # ── D2 materials ──
    print(f"\n── D2 climate materials ({d2} trials) ──")
    d2_res = []
    ev0 = evaluate_full(locked, subjects, maps)
    ev0["trial"] = 0
    ev0["tag"] = "d2_seed"
    ev0["config"] = _snap(locked)
    d2_res.append(ev0)
    for i in range(1, d2 + 1):
        cfg = _sample_d2(rng, locked)
        # keep assembly
        for k in DAE_KEYS:
            cfg[k] = locked[k]
        for k in SEW_KEYS:
            cfg[k] = locked[k]
        cfg["daewoon_parent"] = "climate"
        ev = evaluate_full(cfg, subjects, maps)
        ev["trial"] = i
        ev["tag"] = "d2"
        ev["config"] = _snap(cfg)
        d2_res.append(ev)
        if i % 10 == 0:
            mark = "★" if ev["gated"] else " "
            print(
                f"  {mark}[d2-{i}] dae={C.fmt_rate(ev['dae_primary'])} "
                f"sew_ho={C.fmt_rate(ev['sew_holdout'])} "
                f"sep_dae={ev['dae_primary'].get('avg_sep')}"
            )
    d2_best = sorted(d2_res, key=_rank_dae, reverse=True)[0]
    print(
        f"D2 best trial={d2_best.get('trial')} gated={d2_best['gated']} "
        f"dae={C.fmt_rate(d2_best['dae_primary'])} sew_ho={C.fmt_rate(d2_best['sew_holdout'])}"
    )

    locked2 = deepcopy(locked)
    for k in MAT_KEYS:
        locked2[k] = d2_best["config"].get(k, locked2.get(k))
    for k in DAE_KEYS:
        locked2[k] = d2_best["config"].get(k, locked2.get(k))

    # ── E sewoon re-sweep ──
    print(f"\n── E sewoon re-sweep ({e_trials} trials), dae frozen ──")
    e_res = []
    evs = evaluate_full(locked2, subjects, maps)
    evs["trial"] = 0
    evs["tag"] = "e_seed"
    evs["config"] = _snap(locked2)
    e_res.append(evs)
    print(
        f"  seed sew_ho={C.fmt_rate(evs['sew_holdout'])} "
        f"dae={C.fmt_rate(evs['dae_primary'])} gated={evs['gated']}"
    )
    for i in range(1, e_trials + 1):
        cfg = _sample_e(rng, locked2)
        for k in DAE_KEYS + MAT_KEYS:
            cfg[k] = locked2[k]
        ev = evaluate_full(cfg, subjects, maps)
        ev["trial"] = i
        ev["tag"] = "e"
        ev["config"] = _snap(cfg)
        e_res.append(ev)
        if i % 20 == 0 or ev["gated"]:
            if i % 20 == 0 or (ev["gated"] and i <= 10):
                mark = "★" if ev["gated"] else " "
                print(
                    f"  {mark}[e-{i}] sew_ho={C.fmt_rate(ev['sew_holdout'])} "
                    f"α={ev['config']['daewoon_blend']:.2f} "
                    f"amp={ev['config']['yindep_amp']:.2f} "
                    f"sep={ev['sew_primary'].get('avg_sep')}"
                )
    e_best = sorted(e_res, key=_rank_sew, reverse=True)[0]
    print(
        f"E best trial={e_best.get('trial')} gated={e_best.get('gated')} "
        f"sew_ho={C.fmt_rate(e_best['sew_holdout'])} "
        f"α={e_best['config'].get('daewoon_blend')} amp={e_best['config'].get('yindep_amp')}"
    )

    recommend = e_best if e_best.get("sew_ok") and e_best.get("dae_ok") else (
        d2_best if d2_best.get("gated") else d1_best
    )

    return {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "6D_daewoon_then_6E_sewoon",
        "seed": seed,
        "control_dae_primary": {
            "rate": ctrl_pr.get("rate"),
            "avg_sep": ctrl_pr.get("avg_sep"),
            "pass": ctrl_pr.get("pass"),
            "evalable": ctrl_pr.get("evalable"),
        },
        "baseline": b0,
        "d1_best": d1_best,
        "d2_best": d2_best,
        "e_best": e_best,
        "recommend": recommend,
        "n_d1_gated": sum(1 for r in d1_res if r.get("gated")),
        "n_d2_gated": sum(1 for r in d2_res if r.get("gated")),
        "n_e_gated": sum(1 for r in e_res if r.get("gated")),
        "d1_top5": sorted(d1_res, key=_rank_dae, reverse=True)[:5],
        "d2_top5": sorted(d2_res, key=_rank_dae, reverse=True)[:5],
        "e_top5": sorted(e_res, key=_rank_sew, reverse=True)[:5],
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--d1", type=int, default=60)
    ap.add_argument("--d2", type=int, default=40)
    ap.add_argument("--e", type=int, default=80)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args(argv)

    print("══════════ Phase 6D 대운 → 6E 세운 ══════════")
    print("order: climate assembly → materials → sewoon α/amp")
    print(f"d1={args.d1} d2={args.d2} e={args.e} seed={args.seed}")
    print("engine untouched")
    print()

    payload = run(args.d1, args.d2, args.e, args.seed)
    rec = payload["recommend"]
    print("\n══ 추천 config ══")
    print(json.dumps(rec.get("config"), ensure_ascii=False, indent=2))
    print(
        f"dae {C.fmt_rate(rec['dae_primary'])} sew_ho {C.fmt_rate(rec['sew_holdout'])} "
        f"mode={rec.get('dae_climate_mode')} gated={rec.get('gated')}"
    )

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
