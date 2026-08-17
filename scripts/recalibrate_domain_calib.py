# -*- coding: utf-8 -*-
"""
원국 DomainScore raw 모집단 재측정 → _DOMAIN_CALIB (μ, σ) 갱신.

사용:
  python scripts/recalibrate_domain_calib.py
  python scripts/recalibrate_domain_calib.py --n 2000 --seed 42 --apply

- use_solar_time=False 로 geocoding 없이 빠르게 샘플링
- 시드 고정으로 재현 가능
- --apply 시 saju_engine.py 의 _DOMAIN_CALIB 블록을 교체
"""
from __future__ import annotations

import argparse
import calendar
import contextlib
import io
import json
import math
import os
import random
import re
import statistics
import sys
from datetime import datetime
from typing import Dict, List, Tuple

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

import saju_engine as se  # noqa: E402

DOMAINS = ("직업", "재물", "건강", "연애", "결혼")


def _valid_ymd(y: int, m: int, d: int) -> bool:
    try:
        datetime(y, m, d)
        return True
    except ValueError:
        return False


def _sample_births(n: int, seed: int) -> List[se.BirthInput]:
    rng = random.Random(seed)
    out: List[se.BirthInput] = []
    # 격자: 연도×성별×시지 대표시 + 랜덤 보충
    years = list(range(1950, 2011, 3))  # 21개
    hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]
    genders = ("male", "female")
    for y in years:
        for g in genders:
            for h in hours:
                m = rng.randint(1, 12)
                dmax = calendar.monthrange(y, m)[1]
                d = rng.randint(1, dmax)
                out.append(
                    se.BirthInput(
                        year=y, month=m, day=d, hour=h, minute=0,
                        gender=g, calendar="solar", use_solar_time=False,
                    )
                )
    # 랜덤 보충
    while len(out) < n:
        y = rng.randint(1945, 2015)
        m = rng.randint(1, 12)
        d = rng.randint(1, calendar.monthrange(y, m)[1])
        h = rng.choice(hours + [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23])
        g = rng.choice(genders)
        if not _valid_ymd(y, m, d):
            continue
        out.append(
            se.BirthInput(
                year=y, month=m, day=d, hour=h, minute=rng.choice([0, 30]),
                gender=g, calendar="solar", use_solar_time=False,
            )
        )
    rng.shuffle(out)
    return out[:n]


def _raw_from_report(r: Dict) -> Dict[str, float]:
    geok = r["격국"]["격국"]
    vd = r["신강신약"]["판정"]
    hit_names = [h["name"] for h in r["신살길성"]["발현_신살"]]
    ten_gods = r["십성(천간)"]
    hidden = r["지장간_십성"]
    all_tg = {
        **ten_gods,
        **{f"{k}_{v['간']}": v["십성"] for k, vs in hidden.items() for v in vs},
    }
    return se._domain_raw_scores(geok, hit_names, all_tg, vd)


def measure(n: int, seed: int) -> Dict:
    births = _sample_births(n, seed)
    buckets: Dict[str, List[float]] = {d: [] for d in DOMAINS}
    calibrated: Dict[str, List[float]] = {d: [] for d in DOMAINS}
    errors = 0

    for i, inp in enumerate(births):
        try:
            with contextlib.redirect_stderr(io.StringIO()):
                r = se.enrich_saju(inp)
            raw = _raw_from_report(r)
            for d in DOMAINS:
                buckets[d].append(float(raw[d]))
            # 현재 CALIB로 정규화했을 때의 분포도 기록 (갱신 전 기준선)
            scored = r["DomainScore"]["점수"]
            for d in DOMAINS:
                calibrated[d].append(float(scored[d]))
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"[warn] sample fail {inp.year}-{inp.month}-{inp.day}: {e}", file=sys.stderr)
        if (i + 1) % 100 == 0:
            print(f"  … {i+1}/{len(births)}", flush=True)

    def stats(xs: List[float]) -> Tuple[float, float]:
        if len(xs) < 2:
            return (0.0, 1.0)
        mu = statistics.mean(xs)
        sd = statistics.pstdev(xs)  # 모집단 σ
        if sd < 0.05:
            sd = 0.05
        return (round(mu, 4), round(sd, 4))

    raw_calib = {d: stats(buckets[d]) for d in DOMAINS}
    # 새 CALIB로 가상 z-score 분포
    post: Dict[str, List[float]] = {d: [] for d in DOMAINS}
    for d in DOMAINS:
        mu, sd = raw_calib[d]
        for raw in buckets[d]:
            z = (raw - mu) / sd
            v = max(0.0, min(10.0, se._DOMAIN_TARGET_MEAN + z * se._DOMAIN_TARGET_STD))
            post[d].append(v)
    post_stats = {d: stats(post[d]) for d in DOMAINS}
    pre_stats = {d: stats(calibrated[d]) for d in DOMAINS}

    return {
        "n_requested": n,
        "n_ok": len(buckets["직업"]),
        "n_error": errors,
        "seed": seed,
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "raw_calib": {d: {"mu": raw_calib[d][0], "sd": raw_calib[d][1]} for d in DOMAINS},
        "pre_calibrated_dist": {d: {"mu": pre_stats[d][0], "sd": pre_stats[d][1]} for d in DOMAINS},
        "post_calibrated_dist": {d: {"mu": post_stats[d][0], "sd": post_stats[d][1]} for d in DOMAINS},
        "python_dict": {d: (raw_calib[d][0], raw_calib[d][1]) for d in DOMAINS},
    }


def _format_calib_block(calib: Dict[str, Tuple[float, float]], n: int, seed: int) -> str:
    lines = [
        "# 도메인 raw 합산은 \"무한합산 후 [0,10] 클램프\" 구조라 도메인별 체계적 편향이",
        "# 사람과 무관하게 고정됐다. → z-score 정규화로 중심·분산을 맞춘다.",
        f"# 캘리브 상수: scripts/recalibrate_domain_calib.py 재측정",
        f"#   n={n} seed={seed} (raw μ·σ — 클램프 전)",
    ]
    # 한 줄 요약
    summary_parts = []
    for d in DOMAINS:
        mu, sd = calib[d]
        summary_parts.append(f"{d} μ{mu:.2f}·σ{sd:.2f}")
    lines.append("#   " + "  ".join(summary_parts[:3]))
    lines.append("#   " + "  ".join(summary_parts[3:]))
    lines.append("_DOMAIN_CALIB = {")
    # 두 줄로 기존 스타일 유지
    a = ", ".join(f'"{d}": ({calib[d][0]:.2f}, {calib[d][1]:.2f})' for d in ("직업", "재물", "건강"))
    b = ", ".join(f'"{d}": ({calib[d][0]:.2f}, {calib[d][1]:.2f})' for d in ("연애", "결혼"))
    lines.append(f"    {a},")
    lines.append(f"    {b},")
    lines.append("}")
    return "\n".join(lines)


def apply_to_engine(calib: Dict[str, Tuple[float, float]], n: int, seed: int) -> None:
    path = os.path.join(ROOT, "saju_engine.py")
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    block = _format_calib_block(calib, n, seed)
    # _DOMAIN_CALIB = { ... } 블록 (+ 직전 주석) 교체
    pattern = re.compile(
        r"# 도메인 raw 합산은.*?\n_DOMAIN_CALIB = \{.*?\n\}",
        re.DOTALL,
    )
    new_src, count = pattern.subn(block, src, count=1)
    if count != 1:
        raise RuntimeError(f"_DOMAIN_CALIB block replace failed (matches={count})")
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_src)
    print(f"[apply] updated {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1500, help="sample size (default 1500)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument(
        "--out",
        default=os.path.join(ROOT, "test", "snapshots", "domain_calib_latest.json"),
    )
    ap.add_argument("--apply", action="store_true", help="rewrite saju_engine._DOMAIN_CALIB")
    args = ap.parse_args()

    print(f"Measuring domain raw stats: n={args.n} seed={args.seed}")
    result = measure(args.n, args.seed)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Wrote {args.out}")
    print("raw_calib:")
    for d in DOMAINS:
        c = result["raw_calib"][d]
        print(f"  {d}: μ={c['mu']:.4f}  σ={c['sd']:.4f}")
    print("post (with new calib) calibrated dist:")
    for d in DOMAINS:
        c = result["post_calibrated_dist"][d]
        print(f"  {d}: μ={c['mu']:.4f}  σ={c['sd']:.4f}")

    calib_tuples = {d: (result["raw_calib"][d]["mu"], result["raw_calib"][d]["sd"]) for d in DOMAINS}
    # 엔진 표기는 소수점 2자리
    calib_rounded = {d: (round(mu, 2), round(sd, 2)) for d, (mu, sd) in calib_tuples.items()}
    print("\nSuggested _DOMAIN_CALIB =")
    print(calib_rounded)

    if args.apply:
        apply_to_engine(calib_rounded, result["n_ok"], args.seed)


if __name__ == "__main__":
    main()
