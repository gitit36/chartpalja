# -*- coding: utf-8 -*-
"""
B9 hierarchy scaffold (engine untouched).

B9-A: S_raw = D + α·A, S = squash(S_raw)
  D_b frozen = engine build_daewoon_detail 종합운점수
  A_y = G_y - median(G within block)

B9-B hooks (κ·R) exist but must not be run until A passes structure KPI.
See B9_SPEC.md.
"""
from __future__ import annotations

from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from experiments import arm_b
from experiments import common as C

ARM_ID = "B9_hierarchy"
ARM_LABEL = "실험군B9 · additive hierarchy"
ARM_VERSION = "B9A_alpha_1"

# Frozen B9-A α=1.0; B9-B residual R rejected (see exp_b9b_kappa_sweep.json)
ARM_B9_CONFIG: Dict[str, Any] = {
    "alpha": 1.0,
    "kappa": 0.0,              # B9-A: always 0
    "d_source": "engine_pillar",  # frozen for first A
    "centering": "median",     # mean = experiment only
    "arm": "A",                # A | B (B adds κR)
}


def squash(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return C.clamp(float(x), lo, hi)


def _center(vals: Sequence[float], how: str = "median") -> float:
    if not vals:
        return 50.0
    if how == "mean":
        return float(sum(vals) / len(vals))
    return float(median(vals))


def d_map_from_daewoon_detail(
    dw_rows: Sequence[dict],
    *,
    allow_open_fallback: bool = False,
    meta_by_year: Optional[Dict[int, dict]] = None,
) -> Dict[str, float]:
    """
    First B9-A: D_b = 종합운점수 per daewoon_pillar.
    median(open) only if allow_open_fallback and pillar score missing.
    """
    out: Dict[str, float] = {}
    for row in dw_rows:
        p = str(row.get("daewoon_pillar") or "")
        if not p:
            continue
        if row.get("종합운점수") is not None:
            out[p] = float(row["종합운점수"])
    if allow_open_fallback and meta_by_year is not None:
        buckets: Dict[str, List[float]] = {}
        for y, m in meta_by_year.items():
            p = str(m.get("대운_pillar") or "")
            if not p or p in out:
                continue
            op = float(((m.get("candle") or {}).get("open")) or 50.0)
            buckets.setdefault(p, []).append(op)
        for p, opens in buckets.items():
            out[p] = float(median(opens))
    return out


def generals_by_block(
    meta_by_year: Dict[int, dict],
    *,
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, List[Tuple[int, float]]]:
    """pillar -> [(year, G_y), ...]"""
    buckets: Dict[str, List[Tuple[int, float]]] = {}
    for y, m in sorted(meta_by_year.items()):
        p = str(m.get("대운_pillar") or "_")
        g = float(arm_b.year_score_pure_from_meta(m, cfg or arm_b.ARM_B_CONFIG))
        buckets.setdefault(p, []).append((int(y), g))
    return buckets


def block_centers(
    buckets: Dict[str, List[Tuple[int, float]]],
    *,
    centering: str = "median",
) -> Dict[str, float]:
    return {
        p: _center([g for _, g in ys], centering)
        for p, ys in buckets.items()
    }


def residual_R(
    meta_by_year: Dict[int, dict],
    buckets: Dict[str, List[Tuple[int, float]]],
    *,
    centering: str = "median",
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[int, float]:
    """R_y = (G-close) - median_block(G-close). Experimental only."""
    raw: Dict[str, List[Tuple[int, float]]] = {}
    for p, pairs in buckets.items():
        for y, g in pairs:
            close = float(((meta_by_year[y].get("candle") or {}).get("close")) or g)
            raw.setdefault(p, []).append((y, g - close))
    centers = {p: _center([v for _, v in vs], centering) for p, vs in raw.items()}
    out: Dict[int, float] = {}
    for p, vs in raw.items():
        c = centers[p]
        for y, v in vs:
            out[int(y)] = float(v - c)
    return out


def sewoon_series_for_person(
    meta_by_year: Dict[int, dict],
    d_by_pillar: Dict[str, float],
    *,
    b9_cfg: Optional[Dict[str, Any]] = None,
    materials_cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Returns parallel arrays / maps for structural KPI.
    arm A: kappa forced 0; arm B: uses kappa from cfg.
    """
    cfg = dict(ARM_B9_CONFIG)
    if b9_cfg:
        cfg.update(b9_cfg)
    mat = materials_cfg or arm_b.ARM_B_CONFIG
    centering = str(cfg.get("centering") or "median")
    alpha = float(cfg.get("alpha") or 1.0)
    arm = str(cfg.get("arm") or "A").upper()
    kappa = float(cfg.get("kappa") or 0.0) if arm == "B" else 0.0

    buckets = generals_by_block(meta_by_year, cfg=mat)
    centers = block_centers(buckets, centering=centering)
    r_map = residual_R(meta_by_year, buckets, centering=centering, cfg=mat) if kappa else {}

    years: List[int] = []
    D: List[float] = []
    G: List[float] = []
    A: List[float] = []
    S_raw: List[float] = []
    S: List[float] = []
    pillars: List[str] = []
    missing_d = 0

    for p, pairs in buckets.items():
        if p not in d_by_pillar:
            # strict A: prefer skip years without D rather than silent open median
            missing_d += len(pairs)
            continue
        d_b = float(d_by_pillar[p])
        c_b = float(centers[p])
        for y, g in pairs:
            a_y = float(g - c_b)
            raw = d_b + alpha * a_y
            if kappa:
                raw = raw + kappa * float(r_map.get(y, 0.0))
            years.append(int(y))
            pillars.append(p)
            D.append(d_b)
            G.append(float(g))
            A.append(a_y)
            S_raw.append(float(raw))
            S.append(float(squash(raw)))

    # sort by year
    order = sorted(range(len(years)), key=lambda i: years[i])
    def _take(xs):
        return [xs[i] for i in order]

    return {
        "years": _take(years),
        "pillars": _take(pillars),
        "D": _take(D),
        "G": _take(G),
        "A": _take(A),
        "S_raw": _take(S_raw),
        "S": _take(S),
        "d_by_pillar": dict(d_by_pillar),
        "block_center_G": centers,
        "cfg": {
            "alpha": alpha,
            "kappa": kappa,
            "arm": arm,
            "centering": centering,
            "d_source": cfg.get("d_source"),
            "version": ARM_VERSION,
        },
        "missing_d_years": missing_d,
    }


def year_score_map(series: Dict[str, Any], *, display: bool = True) -> Dict[int, float]:
    key = "S" if display else "S_raw"
    return {int(y): float(v) for y, v in zip(series["years"], series[key])}
