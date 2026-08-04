# -*- coding: utf-8 -*-
"""Phase 1 프로토타입 — 역전쌍·축 추론 회귀 테스트."""
from __future__ import annotations

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import calibrate_yongshin as cy  # noqa: E402
import proto_multiaxis as proto  # noqa: E402


def _messi():
    with open(cy.SUBJ_PATH) as f:
        raw = json.load(f)
    return cy.normalize(next(s for s in raw if s["name"] == "Lionel Messi"))


class TestAxisInference:
    def test_injury_is_health(self):
        assert proto.infer_axis("중족골 골절로 시즌 후반 이탈") == "health"

    def test_marriage_is_relationship(self):
        assert proto.infer_axis("Antonela Roccuzzo와 결혼") == "relationship"

    def test_ballon_is_career(self):
        assert proto.infer_axis("바르셀로나 트레블·첫 Ballon d’Or") == "career"

    def test_explicit_axis_wins(self):
        assert proto.infer_axis("뭔가", "health") == "health"


class TestMessiInversionPairs:
    """커리어 피크 해가 갈등 해보다 career 축에서 높아야 한다."""

    @pytest.fixture(scope="class")
    def maps(self):
        n = _messi()
        _close, axis_maps, _meta = proto.build_year_maps(n)
        return axis_maps

    def test_2009_vs_2020_career_gap_improves_vs_baseline(self, maps):
        """피크(2009) vs 갈등(2020): baseline 역전폭을 proto career가 크게 줄이거나 뒤집는다."""
        n = _messi()
        close, axis_maps, _ = proto.build_year_maps(n)
        base_gap = close[2009] - close[2020]          # 음수(역전)
        proto_gap = axis_maps["career"][2009] - axis_maps["career"][2020]
        assert proto_gap > base_gap + 10  # 최소 +10점 개선
        assert proto_gap > -5             # 큰 역전 잔존 금지

    def test_2009_peak_beats_2020_conflict_on_career(self, maps):
        assert maps["career"][2009] > maps["career"][2020]

    def test_2022_worldcup_beats_2013_injury_on_matched_axes(self, maps):
        assert maps["career"][2022] >= 55
        assert maps["health"][2013] <= maps["career"][2022]

    def test_2006_injury_health_below_neutral(self, maps):
        assert maps["health"][2006] < 55

    def test_proto_matched_beats_baseline(self):
        n = _messi()
        r = proto.eval_person(n, exclude_collisions=True)
        assert r["proto_matched"]["status"] == "pass"
        assert r["proto_matched"]["sep"] > r["baseline"]["sep"]
