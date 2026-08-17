# -*- coding: utf-8 -*-
"""
실험군 B (EXP-B) — 개선 composite 후보 (완전 격리)

═══════════════════════════════════════════════════════════════
CRITICAL
  - 이 파일만 수정해서 B를 개발한다.
  - saju_engine.py / 운영 API / 차트 경로를 import해서 점수를 덮어쓰지 말 것.
  - 엔진 반영은 compare_arms 결과가 B 우세일 때, 별도 PR로만 이식한다.
═══════════════════════════════════════════════════════════════

버전 이력
  B0_scaffold      : proto general과 동등 출발점
  B1_gated_discord : Phase1 — (yfit↑·rel↓) + (양인ctx|흉살) + 합 없음
  B2_pattern       : Phase2 — hollow-boom + 해/극고yfit gate + 양인·겁살 마찰
  B3_health_hier   : Phase3 — 정관+극고yfit 건강악재 + 대운 블록 KPI
  B4_hier_blend    : Phase4 — 세운에 대운 open 10% 혼합(세운 100% 유지) + 대운 climate 스코어
  B5_hier_amp      : Phase5 — 계층 부모=B climate(α=0.40) + 세운독립 진폭(yindep_amp)
                     ※ 엔진 open×0.55~0.60은 holdout 붕괴; climate 부모로 α 복원
  B6_hp_hier       : Phase6A — Phase A HP 스윕(α≥0.35 제약) trial40 반올림
  B7_dae_first     : Phase6D→6E — 대운 climate 선확정 후 세운 α 재스윕
                     mode=year_resid scale=2.10 α=0.38; block_*는 climate KPI 열세
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

ARM_ID = "B_composite_v2"
ARM_LABEL = "실험군B · composite v2 (격리)"
ARM_VERSION = "B7_dae_first"

ARM_B_CONFIG: Dict[str, Any] = {
    "w_career": 0.40,
    "w_health": 0.35,
    "w_relationship": 0.25,
    "yfit_career_normal": 0.30,
    "yfit_career_conflict": 0.20,
    "career_conflict_pen": -6.0,
    "yfit_health": 0.25,
    "yfit_rel": 0.30,
    "rel_weight": 0.42,
    "struct_career": 0.45,
    "struct_health": 0.55,
    "base": 51.7,
    # Phase1
    "yfit_pos_scale": 0.77,
    "discord_yfit_min": 2.5,
    "discord_rel_max": -2.5,
    "discord_pen": -12.5,
    "require_risk_gate": True,
    "yangin_risk_pen": -4.0,
    "hyungsal_pen": -1.6,
    "hyungsal_cap": -4.8,
    "hyungsal_skip": ("역마", "도화"),
    # Phase2
    "gate_hae": True,
    "gate_extreme_yfit": 7.5,
    "hollow_yfit_min": 5.0,
    "hollow_bal_min": 3.0,
    "hollow_rel_max": 2.5,
    "hollow_pen": -9.9,
    "yangin_geopsal_rel_max": -3.5,
    "yangin_geopsal_pen": -4.5,
    # Phase3
    "health_guan_yfit_min": 10.0,
    "health_guan_pen": -13.5,
    # Phase 6D/6E — 대운 선확정 → 세운
    "daewoon_blend": 0.38,
    "daewoon_parent": "climate",
    "yindep_amp": 2.93,
    "dae_resid_scale": 2.10,
    "dae_climate_mode": "year_resid",
    "dae_open_weight": 0.67,
    "dae_gen_amp": 2.47,
}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _scaled_yfit(yfit: float, cfg: Dict[str, Any]) -> float:
    if yfit > 0:
        return yfit * float(cfg.get("yfit_pos_scale", 1.0))
    return yfit


def _severe_hyung(meta: dict, cfg: Dict[str, Any]) -> List[str]:
    hyung = meta.get("세운_신살_흉살") or []
    if not isinstance(hyung, list):
        return []
    skip = tuple(cfg.get("hyungsal_skip") or ())
    return [h for h in hyung if not any(s in str(h) for s in skip)]


def _hyungsal_pen(meta: dict, cfg: Dict[str, Any]) -> float:
    severe = _severe_hyung(meta, cfg)
    if not severe:
        return 0.0
    return max(float(cfg["hyungsal_cap"]), float(cfg["hyungsal_pen"]) * len(severe))


def _yangin_pen(meta: dict, cfg: Dict[str, Any]) -> float:
    ctx = meta.get("shinsal_context_adj") or {}
    if not isinstance(ctx, dict):
        return 0.0
    pen = 0.0
    for k, v in ctx.items():
        if "양인" not in str(k):
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if fv > 0:
            pen += float(cfg["yangin_risk_pen"]) * min(1.0, fv / 3.0)
    return pen


def _has_hae(ilju: List) -> bool:
    return any("해" in str(s) for s in ilju)


def _has_positive_yangin(meta: dict) -> bool:
    ctx = meta.get("shinsal_context_adj") or {}
    if not isinstance(ctx, dict):
        return False
    for k, v in ctx.items():
        if "양인" not in str(k):
            continue
        try:
            if float(v) > 0:
                return True
        except (TypeError, ValueError):
            continue
    return False


def _risk_gate(meta: dict, cfg: Dict[str, Any], yfit_raw: float, ilju: List) -> bool:
    if _severe_hyung(meta, cfg):
        return True
    if _has_positive_yangin(meta):
        return True
    if cfg.get("gate_hae") and _has_hae(ilju):
        return True
    ext = float(cfg.get("gate_extreme_yfit") or 0)
    if ext > 0 and yfit_raw >= ext:
        return True
    return False


def _hollow_boom(
    yfit_raw: float,
    bal: float,
    rel: float,
    conflict: bool,
    has_hap: bool,
    cfg: Dict[str, Any],
) -> float:
    """정치·스캔들형: 기운·균형은 높은데 관계는 약하고 충형 없음."""
    if has_hap or conflict:
        return 0.0
    if yfit_raw < float(cfg["hollow_yfit_min"]):
        return 0.0
    if bal < float(cfg["hollow_bal_min"]):
        return 0.0
    if rel > float(cfg["hollow_rel_max"]):
        return 0.0
    return float(cfg["hollow_pen"])


def _health_guan_crisis(
    yfit_raw: float,
    tg_s: str,
    tg_b: str,
    has_hap: bool,
    cfg: Dict[str, Any],
) -> float:
    """정관 + 극고 yfit — 관살 압박/건강 위기 해 (Bieber 2020 라임병).

    편관은 제외: Obama 2011(빈라덴, 편관) 등 성공 고에너지 해를 보호.
    """
    if has_hap:
        return 0.0
    if yfit_raw < float(cfg["health_guan_yfit_min"]):
        return 0.0
    if "정관" not in (tg_s, tg_b):
        return 0.0
    return float(cfg["health_guan_pen"])


def _yangin_geopsal_friction(meta: dict, rel: float, has_hap: bool, cfg: Dict[str, Any]) -> float:
    """양인 맥락 + 겁살 흉살 + 관계 급락 — 폭력·법적 악재 (Brown 2013)."""
    if has_hap:
        return 0.0
    if rel > float(cfg["yangin_geopsal_rel_max"]):
        return 0.0
    hyung = meta.get("세운_신살_흉살") or []
    if not isinstance(hyung, list) or not any("겁살" in str(h) for h in hyung):
        return 0.0
    if not _has_positive_yangin(meta):
        return 0.0
    return float(cfg["yangin_geopsal_pen"])


def _axis_scores(meta: dict, cfg: Dict[str, Any]) -> Dict[str, float]:
    bd = (meta or {}).get("breakdown") or {}
    yfit_raw = float(bd.get("yongshin_fit") or 0.0)
    yfit = _scaled_yfit(yfit_raw, cfg)
    rel = float(bd.get("relations") or 0.0)
    struct = float(bd.get("structural_adj") or 0.0)
    uns = float(bd.get("unseong") or 0.0)
    bal = float(bd.get("balance") or 0.0)

    tg_s = meta.get("세운_십성_천간") or ""
    tg_b = meta.get("세운_십성_지지") or ""
    ilju = meta.get("세운_일주관계") or []
    if not isinstance(ilju, list):
        ilju = []

    career_tg = 0.0
    for tg in (tg_s, tg_b):
        if tg in ("정관", "편관", "정재", "편재", "식신"):
            career_tg += 2.2
        elif tg in ("상관", "겁재"):
            career_tg -= 1.0
        elif tg in ("편인", "정인"):
            career_tg += 0.5

    health_shock = 0.0
    rel_bond = 0.0
    conflict = False
    for s in ilju:
        t = str(s)
        if "충" in t or "형" in t:
            health_shock -= 4.0
            conflict = True
        elif "파" in t or "해" in t:
            health_shock -= 2.0
        if "극" in t or "갈등" in t:
            conflict = True
        if "합" in t or "배우자" in t or "인연" in t:
            rel_bond += 3.0

    yfit_c = yfit * (
        cfg["yfit_career_conflict"] if (conflict and yfit > 0) else cfg["yfit_career_normal"]
    )
    career_pen = cfg["career_conflict_pen"] if conflict else 0.0

    has_hap = any(("합" in str(s) or "인연" in str(s) or "배우자" in str(s)) for s in ilju)
    discord = 0.0
    if (
        yfit_raw >= float(cfg["discord_yfit_min"])
        and rel <= float(cfg["discord_rel_max"])
        and not has_hap
    ):
        if (not cfg.get("require_risk_gate")) or _risk_gate(
            meta or {}, cfg, yfit_raw, ilju
        ):
            discord = float(cfg["discord_pen"])

    risk = 0.0
    if discord and not has_hap:
        risk = _hyungsal_pen(meta or {}, cfg) + _yangin_pen(meta or {}, cfg)

    hollow = _hollow_boom(yfit_raw, bal, rel, conflict, has_hap, cfg)
    friction = _yangin_geopsal_friction(meta or {}, rel, has_hap, cfg)
    health_x = _health_guan_crisis(yfit_raw, tg_s, tg_b, has_hap, cfg)
    pattern = hollow + friction + health_x
    base = float(cfg["base"])

    career = _clamp(
        base
        + yfit_c
        + rel * cfg["rel_weight"]
        + struct * cfg["struct_career"]
        + uns * 0.15
        + career_tg
        + career_pen
        + discord * 0.85
        + risk * 0.55
        + pattern * 0.8
    )
    health = _clamp(
        base
        + yfit * cfg["yfit_health"]
        + struct * cfg["struct_health"]
        + bal * 0.45
        + health_shock
        - career_tg * 0.35
        + uns * 0.1
        + discord * 0.55
        + risk * 0.7
        + pattern * 0.5
    )
    relationship = _clamp(
        base
        + yfit * cfg["yfit_rel"]
        + rel * cfg["rel_weight"]
        + rel_bond
        + bal * 0.25
        + uns * 0.1
        + risk * 0.35
        + pattern * 0.35
    )
    general = _clamp(
        cfg["w_career"] * career
        + cfg["w_health"] * health
        + cfg["w_relationship"] * relationship
        + discord * 0.45
        + risk * 0.4
        + pattern * 0.55
    )
    return {
        "career": round(career, 1),
        "health": round(health, 1),
        "relationship": round(relationship, 1),
        "general": round(general, 1),
    }


def year_score_pure_from_meta(meta: dict, cfg: Optional[Dict[str, Any]] = None) -> float:
    """대운 혼합·진폭 확대 없이 general만 (잔차 계산·진단용)."""
    return float(_axis_scores(meta, cfg or ARM_B_CONFIG)["general"])


def _amplified_indep(general: float, cfg: Dict[str, Any]) -> float:
    """세운독립 점수를 base 중심으로 확대 (차트 진폭)."""
    base = float(cfg.get("base", 52.0))
    amp = float(cfg.get("yindep_amp") or 1.0)
    return _clamp(base + amp * (general - base))


def daewoon_score_from_meta(meta: dict, cfg: Optional[Dict[str, Any]] = None) -> float:
    """
    대운 climate 점수 (연도 meta 1건).

    모드 (`dae_climate_mode`):
      - year_resid  : open + scale*(general−close)  (연도마다 흔들림)
      - block_resid : 동일 대운 블록 통계 필요 → make_dae_scorer(meta_map) 사용
      - block_blend : 동일

    block_* 모드는 단일 meta만으로는 블록 평균을 못 구하므로,
    year_resid로 폴백하거나 make_dae_scorer가 넘긴 _block_stats를 쓴다.
    """
    cfg = cfg or ARM_B_CONFIG
    candle = (meta or {}).get("candle") or {}
    open_v = float(candle.get("open") or 50.0)
    close_v = float(candle.get("close") or open_v)
    general = year_score_pure_from_meta(meta, cfg)
    scale = float(cfg.get("dae_resid_scale", 0.35))
    mode = str(cfg.get("dae_climate_mode") or "year_resid")

    block = (meta or {}).get("_block_stats")
    if mode in ("block_resid", "block_blend") and isinstance(block, dict):
        b_open = float(block.get("open", open_v))
        b_gen = float(block.get("general", general))
        b_close = float(block.get("close", close_v))
        if mode == "block_resid":
            return round(_clamp(b_open + scale * (b_gen - b_close)), 1)
        # block_blend: open×λ + amp(general)×(1−λ)
        lam = float(cfg.get("dae_open_weight", 0.70))
        gen_a = _amplified_indep(b_gen, {
            "base": float(cfg.get("base", 52.0)),
            "yindep_amp": float(cfg.get("dae_gen_amp", 1.0)),
        })
        return round(_clamp(lam * b_open + (1.0 - lam) * gen_a), 1)

    # year_resid (default) / block 통계 없을 때
    return round(_clamp(open_v + scale * (general - close_v)), 1)


def _build_block_stats(
    meta_by_year: Dict[int, dict],
    cfg: Dict[str, Any],
) -> Dict[str, Dict[str, float]]:
    """대운_pillar → {open, close, general} 중앙값."""
    from statistics import median

    buckets: Dict[str, List[dict]] = {}
    for m in meta_by_year.values():
        p = str(m.get("대운_pillar") or "_")
        buckets.setdefault(p, []).append(m)
    out: Dict[str, Dict[str, float]] = {}
    for p, ms in buckets.items():
        opens, closes, gens = [], [], []
        for m in ms:
            c = (m.get("candle") or {})
            opens.append(float(c.get("open") or 50.0))
            closes.append(float(c.get("close") or opens[-1]))
            gens.append(year_score_pure_from_meta(m, cfg))
        out[p] = {
            "open": float(median(opens)),
            "close": float(median(closes)),
            "general": float(median(gens)),
        }
    return out


def make_dae_scorer(cfg: Dict[str, Any], meta_by_year: Optional[Dict[int, dict]] = None):
    """
    대운 스코어러.
    meta_by_year가 있으면 block_* 모드용 통계를 meta에 주입해 블록-상수 climate를 만든다.
    """
    frozen = dict(cfg)
    need_block = str(frozen.get("dae_climate_mode") or "year_resid").startswith("block")
    block_stats = (
        _build_block_stats(meta_by_year, frozen)
        if (meta_by_year is not None and need_block)
        else None
    )

    def _scorer(meta: dict) -> float:
        m = meta
        if block_stats is not None:
            p = str(meta.get("대운_pillar") or "_")
            st = block_stats.get(p)
            if st is not None:
                m = dict(meta)
                m["_block_stats"] = st
        return daewoon_score_from_meta(m, frozen)

    return _scorer


def _daewoon_parent_score(
    meta: dict,
    cfg: Dict[str, Any],
    fallback: float,
    block_stats: Optional[Dict[str, Dict[str, float]]] = None,
) -> float:
    parent = str(cfg.get("daewoon_parent") or "open")
    if parent == "climate":
        m = meta
        if block_stats is not None:
            p = str(meta.get("대운_pillar") or "_")
            st = block_stats.get(p)
            if st is not None:
                m = dict(meta)
                m["_block_stats"] = st
        return float(daewoon_score_from_meta(m, cfg))
    candle = (meta or {}).get("candle") or {}
    return float(candle.get("open") or fallback)


def year_score_from_meta(
    meta: dict,
    cfg: Optional[Dict[str, Any]] = None,
    block_stats: Optional[Dict[str, Dict[str, float]]] = None,
) -> float:
    """세운 composite = climate부모⊗증폭독립."""
    cfg = cfg or ARM_B_CONFIG
    general = year_score_pure_from_meta(meta, cfg)
    indep = _amplified_indep(general, cfg)
    blend = float(cfg.get("daewoon_blend") or 0.0)
    if blend <= 0:
        return round(indep, 1)
    dw = _daewoon_parent_score(meta, cfg, indep, block_stats=block_stats)
    return round(_clamp((1.0 - blend) * indep + blend * dw), 1)


def make_year_scorer(
    cfg: Dict[str, Any],
    meta_by_year: Optional[Dict[int, dict]] = None,
):
    """스윕용 세운 스코어러. block climate 부모면 meta_map으로 블록 통계 고정."""
    frozen = dict(cfg)
    need_block = (
        str(frozen.get("daewoon_parent") or "") == "climate"
        and str(frozen.get("dae_climate_mode") or "year_resid").startswith("block")
    )
    block_stats = (
        _build_block_stats(meta_by_year, frozen)
        if (meta_by_year is not None and need_block)
        else None
    )

    def _scorer(meta: dict) -> float:
        return year_score_from_meta(meta, frozen, block_stats=block_stats)

    return _scorer
