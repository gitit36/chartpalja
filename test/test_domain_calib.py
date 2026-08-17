# -*- coding: utf-8 -*-
"""_DOMAIN_CALIB 모집단 재측정 결과 정합 검증."""
from __future__ import annotations

import calendar
import contextlib
import io
import json
import os
import random
import statistics
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se

SNAP = os.path.join(os.path.dirname(__file__), "snapshots", "domain_calib_latest.json")
DOMAINS = ("직업", "재물", "건강", "연애", "결혼")


def _mini_sample(n: int = 120, seed: int = 42):
    rng = random.Random(seed)
    years = list(range(1950, 2011, 6))
    hours = [0, 4, 8, 12, 16, 20]
    out = []
    for y in years:
        for g in ("male", "female"):
            for h in hours:
                m = rng.randint(1, 12)
                d = rng.randint(1, calendar.monthrange(y, m)[1])
                out.append(
                    se.BirthInput(
                        year=y, month=m, day=d, hour=h, minute=0,
                        gender=g, calendar="solar", use_solar_time=False,
                    )
                )
    rng.shuffle(out)
    return out[:n]


class TestDomainCalibConstants:
    def test_engine_matches_latest_snapshot(self):
        assert os.path.isfile(SNAP), "run scripts/recalibrate_domain_calib.py first"
        with open(SNAP, encoding="utf-8") as f:
            data = json.load(f)
        for d in DOMAINS:
            mu_s, sd_s = data["raw_calib"][d]["mu"], data["raw_calib"][d]["sd"]
            mu_e, sd_e = se._DOMAIN_CALIB[d]
            assert abs(mu_e - round(mu_s, 2)) < 0.011, f"{d} mu {mu_e} vs {mu_s}"
            assert abs(sd_e - round(sd_s, 2)) < 0.011, f"{d} sd {sd_e} vs {sd_s}"

    def test_snapshot_post_dist_near_target(self):
        with open(SNAP, encoding="utf-8") as f:
            data = json.load(f)
        for d in DOMAINS:
            mu = data["post_calibrated_dist"][d]["mu"]
            sd = data["post_calibrated_dist"][d]["sd"]
            assert abs(mu - se._DOMAIN_TARGET_MEAN) < 0.05, f"{d} post μ={mu}"
            assert abs(sd - se._DOMAIN_TARGET_STD) < 0.05, f"{d} post σ={sd}"

    def test_live_sample_centered(self):
        """소수 샘플로 현재 CALIB 적용 후 원국 도메인이 중심 근처인지 확인."""
        births = _mini_sample(120, seed=42)
        vals = {d: [] for d in DOMAINS}
        for inp in births:
            with contextlib.redirect_stderr(io.StringIO()):
                r = se.enrich_saju(inp)
            sc = r["DomainScore"]["점수"]
            for d in DOMAINS:
                vals[d].append(float(sc[d]))
        for d in DOMAINS:
            mu = statistics.mean(vals[d])
            sd = statistics.pstdev(vals[d])
            assert 4.2 <= mu <= 5.8, f"{d} live μ={mu:.2f}"
            assert 1.0 <= sd <= 2.4, f"{d} live σ={sd:.2f}"
