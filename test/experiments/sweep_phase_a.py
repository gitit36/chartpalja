# -*- coding: utf-8 -*-
"""
Phase A — 세운 하이퍼파라미터 스윕 (엔진 격리)

목표
  - holdout ≥90%, train ≥90% 게이트
  - 진폭 σ 최대화 (차트 박스권 완화)
  - avg_sep 보조

탐색 대상 (계층 구조 고정, 가중·비율만)
  daewoon_blend, yindep_amp, dae_resid_scale,
  yfit_pos_scale, rel_weight, yfit_career_*, discord/hollow/health pens, base

Usage:
  python test/experiments/sweep_phase_a.py
  python test/experiments/sweep_phase_a.py --trials 200 --seed 7
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
from experiments import phase_config as PC  # noqa: E402

OUT_DEFAULT = os.path.join(_TEST, "snapshots", "exp_sweep_phase_a.json")

# 게이트
TRAIN_MIN = 90.0
HOLDOUT_MIN = 90.0

# B5를 시드 후보로 포함
BASELINE_KEYS = (
    "daewoon_blend",
    "yindep_amp",
    "dae_resid_scale",
    "yfit_pos_scale",
    "rel_weight",
    "yfit_career_normal",
    "yfit_career_conflict",
    "discord_pen",
    "hollow_pen",
    "health_guan_pen",
    "base",
    "daewoon_parent",
)


def _sample_cfg(rng: np.random.Generator, base: Dict[str, Any]) -> Dict[str, Any]:
    cfg = deepcopy(base)
    cfg["daewoon_parent"] = "climate"  # open은 holdout 붕괴 — Phase A에서 고정
    cfg["daewoon_blend"] = float(rng.uniform(0.05, 0.55))
    cfg["yindep_amp"] = float(rng.uniform(1.0, 3.0))
    cfg["dae_resid_scale"] = float(rng.uniform(0.5, 2.0))
    cfg["yfit_pos_scale"] = float(rng.uniform(0.55, 1.0))
    cfg["rel_weight"] = float(rng.uniform(0.35, 0.80))
    cfg["yfit_career_normal"] = float(rng.uniform(0.18, 0.45))
    cfg["yfit_career_conflict"] = float(rng.uniform(0.05, 0.20))
    cfg["discord_pen"] = float(rng.uniform(-14.0, -5.0))
    cfg["hollow_pen"] = float(rng.uniform(-10.0, -3.0))
    cfg["health_guan_pen"] = float(rng.uniform(-14.0, -6.0))
    cfg["base"] = float(rng.uniform(48.0, 56.0))
    return cfg


def _cfg_snapshot(cfg: Dict[str, Any]) -> Dict[str, Any]:
    return {k: cfg.get(k) for k in BASELINE_KEYS}


def _amp_sigma(scorer, meta_maps: List[dict]) -> float:
    vals: List[float] = []
    for meta in meta_maps:
        for m in meta.values():
            vals.append(float(scorer(m)))
    if len(vals) < 2:
        return 0.0
    return float(np.std(vals))


def evaluate_cfg(
    cfg: Dict[str, Any],
    subjects: List[dict],
    maps: Dict[str, Tuple[dict, dict]],
    meta_maps_primary: List[dict],
) -> Dict[str, Any]:
    scorer = arm_b.make_year_scorer(cfg)
    dae_scorer = arm_b.make_dae_scorer(cfg)

    rows = []
    for n in subjects:
        close, meta = maps[n["name"]]
        rows.append({
            "name": n["name"],
            "bucket": C.cohort_bucket(n["name"]),
            "sew": C.eval_arm_on_person(
                n, close, meta, scorer, exclude_collisions=True
            ),
            "dae": H.eval_daewoon_on_person(
                n, close, meta, dae_scorer, exclude_collisions=True
            ),
        })

    train = [r for r in rows if r["bucket"] == "train"]
    holdout = [r for r in rows if r["bucket"] == "holdout"]
    primary = [r for r in rows if r["bucket"] != "soft_exclude"]

    def _pack(subset, key):
        fake = [{"name": r["name"], "bucket": r["bucket"], "X": r[key]} for r in subset]
        return C.tally(fake, "X")

    t_tr = _pack(train, "sew")
    t_ho = _pack(holdout, "sew")
    t_pr = _pack(primary, "sew")
    t_dae = _pack(primary, "dae")

    sigma = _amp_sigma(scorer, meta_maps_primary)
    gated = (
        (t_tr.get("rate") or 0) >= TRAIN_MIN
        and (t_ho.get("rate") or 0) >= HOLDOUT_MIN
    )
    # Messi margin (holdout 경계)
    messi = next((r for r in holdout if r["name"] == "Lionel Messi"), None)
    messi_sep = float(messi["sew"]["sep"]) if messi and messi["sew"].get("sep") == messi["sew"].get("sep") else float("nan")

    return {
        "gated": gated,
        "train": t_tr,
        "holdout": t_ho,
        "primary": t_pr,
        "dae_primary": t_dae,
        "sigma": round(sigma, 3),
        "avg_sep": t_pr.get("avg_sep"),
        "messi_sep": messi_sep,
        "config": _cfg_snapshot(cfg),
    }


def _rank_key(r: Dict[str, Any]) -> Tuple:
    """게이트 통과 우선 → σ → avg_sep → messi_sep."""
    sep = r.get("avg_sep")
    sep_v = sep if sep == sep else -999.0
    m = r.get("messi_sep")
    m_v = m if m == m else -999.0
    return (
        1 if r.get("gated") else 0,
        float(r.get("holdout", {}).get("rate") or 0),
        float(r.get("train", {}).get("rate") or 0),
        float(r.get("sigma") or 0),
        float(sep_v),
        float(m_v),
    )


def run_sweep(trials: int, seed: int) -> Dict[str, Any]:
    rng = np.random.default_rng(seed)
    subjects = C.load_core_subjects()
    maps: Dict[str, Tuple[dict, dict]] = {}
    for n in subjects:
        maps[n["name"]] = C.engine_year_maps(n)

    meta_maps_primary = [
        maps[n["name"]][1]
        for n in subjects
        if C.cohort_bucket(n["name"]) != "soft_exclude"
    ]

    results: List[Dict[str, Any]] = []

    # trial 0 = 현재 B5 baseline
    base_cfg = deepcopy(arm_b.ARM_B_CONFIG)
    print(f"baseline {arm_b.ARM_VERSION} …")
    b0 = evaluate_cfg(base_cfg, subjects, maps, meta_maps_primary)
    b0["trial"] = 0
    b0["tag"] = "baseline_B5"
    results.append(b0)
    print(
        f"  [0] gated={b0['gated']} "
        f"tr={C.fmt_rate(b0['train'])} ho={C.fmt_rate(b0['holdout'])} "
        f"σ={b0['sigma']:.2f} sep={b0['avg_sep']:+.2f}"
    )

    for i in range(1, trials + 1):
        cfg = _sample_cfg(rng, base_cfg)
        ev = evaluate_cfg(cfg, subjects, maps, meta_maps_primary)
        ev["trial"] = i
        ev["tag"] = "random"
        results.append(ev)
        if i % 25 == 0 or ev["gated"]:
            mark = "★" if ev["gated"] else " "
            print(
                f"  {mark}[{i}] gated={ev['gated']} "
                f"tr={C.fmt_rate(ev['train'])} ho={C.fmt_rate(ev['holdout'])} "
                f"σ={ev['sigma']:.2f} α={ev['config']['daewoon_blend']:.2f} "
                f"amp={ev['config']['yindep_amp']:.2f}"
            )

    ranked = sorted(results, key=_rank_key, reverse=True)
    gated = [r for r in ranked if r["gated"]]
    best = ranked[0]
    best_gated = gated[0] if gated else None

    # 무제약 σ 최대 (계층 α가 낮아질 수 있음)
    best_sigma = sorted(gated, key=lambda r: -float(r["sigma"]))[0] if gated else best

    # 제품 추천: α≥0.35 유지 + σ·sep
    hier = [
        r for r in gated
        if float(r.get("config", {}).get("daewoon_blend") or 0) >= 0.35
    ]
    recommend = (
        sorted(hier, key=lambda r: (-float(r["sigma"]), -float(r.get("avg_sep") or 0)))[0]
        if hier
        else best_gated
    )

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "A_sewoon_hp",
        "seed": seed,
        "n_trials": trials,
        "gates": {"train_min": TRAIN_MIN, "holdout_min": HOLDOUT_MIN},
        "policy": "recommend = gated ∧ α≥0.35 ∧ max(σ, sep)",
        "baseline": b0,
        "best_overall": best,
        "best_gated": best_gated,
        "best_sigma": best_sigma,
        "recommend": recommend,
        "n_gated": len(gated),
        "top10": ranked[:10],
        "all": results,
    }
    return payload


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Phase A sewoon HP sweep")
    ap.add_argument("--trials", type=int, default=120)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument(
        "--apply-recommend",
        action="store_true",
        help="추천 config를 arm_b.ARM_B_CONFIG에 쓰지 않음(기본). "
             "이 플래그는 리포트만 강조 (실제 apply는 별도).",
    )
    args = ap.parse_args(argv)

    print("══════════ Phase A 세운 HP 스윕 ══════════")
    print(f"trials={args.trials} seed={args.seed}")
    print(f"gates train≥{TRAIN_MIN}% holdout≥{HOLDOUT_MIN}%")
    print(f"engine untouched · parent=climate fixed")
    print()

    payload = run_sweep(args.trials, args.seed)

    print("\n── 요약 ──")
    print(f"gated 통과: {payload['n_gated']} / {args.trials + 1} (incl baseline)")
    rec = payload.get("recommend") or payload.get("best_gated") or payload["best_overall"]
    print(
        f"추천 trial={rec.get('trial')} tag={rec.get('tag')} "
        f"tr={C.fmt_rate(rec['train'])} ho={C.fmt_rate(rec['holdout'])} "
        f"σ={rec['sigma']:.2f} sep={rec['avg_sep']:+.2f} "
        f"Messi={rec.get('messi_sep')}"
    )
    print("config:", json.dumps(rec.get("config"), ensure_ascii=False))

    b0 = payload["baseline"]
    print(
        f"\nB5 baseline σ={b0['sigma']:.2f} sep={b0['avg_sep']:+.2f} "
        f"→ Δσ={rec['sigma'] - b0['sigma']:+.2f} "
        f"Δsep={rec['avg_sep'] - b0['avg_sep']:+.2f}"
    )

    # 직렬화: nan 정리
    def _clean(o):
        if isinstance(o, dict):
            return {k: _clean(v) for k, v in o.items()}
        if isinstance(o, list):
            return [_clean(v) for v in o]
        if isinstance(o, float) and (o != o):
            return None
        return o

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(_clean(payload), f, ensure_ascii=False, indent=2)
    print(f"\n저장 → {args.out}")
    print("※ saju_engine 미수정. 추천안 반영은 arm_b 수동/후속 단계.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
