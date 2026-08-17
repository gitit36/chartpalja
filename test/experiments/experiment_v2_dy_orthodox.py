# -*- coding: utf-8 -*-
"""
V2 Phase 2.5 — Orthodox Daewoon/Sewoon completion.

REFERENCE: V2_DY_B
O1: V2_DY_ORTHO_CONTEXT
O2: V2_DY_ORTHO_SYSTEM

No Month/Day. No Validation B. No engine edits. No O3. No Ridge.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from itertools import product
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import saju_engine as se  # noqa: E402
from experiments import arm_b  # noqa: E402
from experiments import experiment_v2_dy as B  # noqa: E402
from experiments.experiment_g_clean import score_g  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS, _pairwise  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_dy_orthodox.json")
OUT_REPORT = os.path.join(_HERE, "V2_DY_ORTHODOX_REPORT.md")
OUT_ATTR = os.path.join(_HERE, "V2_DY_ORTHODOX_ATTRIBUTION.md")

VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0
AMP_MAPS = {
    "CONSERVATIVE": {"LOW": 2.0, "MEDIUM": 5.0, "HIGH": 10.0, "TRANSFORMATIVE": 16.0},
    "BALANCED": {"LOW": 3.0, "MEDIUM": 8.0, "HIGH": 14.0, "TRANSFORMATIVE": 22.0},
    "EXPRESSIVE": {"LOW": 4.0, "MEDIUM": 10.0, "HIGH": 18.0, "TRANSFORMATIVE": 28.0},
}
REF_NAME = "V2_DY_B"
O1_NAME = "V2_DY_ORTHO_CONTEXT"
O2_NAME = "V2_DY_ORTHO_SYSTEM"


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def _hidden_elems(branch: str) -> List[str]:
    jj = se.BRANCH_JIJANGGAN.get(branch) or {}
    out = []
    for k in ("본기", "중기", "여기"):
        hs = jj.get(k)
        if hs:
            out.append(se.STEM_ELEMENT.get(hs, ""))
    return [e for e in out if e]


def _stem_rooted(stem: str, branch: str) -> bool:
    el = se.STEM_ELEMENT.get(stem, "")
    return bool(el and el in _hidden_elems(branch))


def _natal_context(pack: dict) -> Dict[str, Any]:
    r = pack.get("r") or {}
    yong = r.get("용신") or {}
    disease = yong.get("병인진단") or {}
    strength = r.get("신강신약") or {}
    geju = r.get("격국") or {}
    orig = r.get("원국") or {}
    stems, branches = [], []
    for k in ("year", "month", "day", "hour"):
        p = orig.get(k) or ["", ""]
        stems.append(p[0])
        branches.append(p[1])
    fav = {yong.get("용신_오행") or ""} | set(yong.get("희신_오행") or [])
    fav.discard("")
    unfav = set(yong.get("기신_오행") or []) | set(yong.get("구신_오행") or [])
    unfav.discard("")
    geju_type = str(geju.get("격국유형") or geju.get("격국") or "")
    special = "normal"
    if "종" in geju_type:
        special = "follow"
    elif "화" in geju_type:
        special = "transform"
    johu = yong.get("조후용신") or {}
    johu_elem = ""
    if isinstance(johu, dict):
        johu_elem = johu.get("조후용신_오행") or johu.get("오행") or ""
    month_br = branches[1] if len(branches) > 1 else ""
    return {
        "day_master": stems[2] if len(stems) > 2 else "",
        "month_branch": month_br,
        "month_elem": se.BRANCH_ELEMENT_MAIN.get(month_br, ""),
        "strength_regime": strength.get("판정") or "",
        "fav": fav,
        "unfav": unfav,
        "geju_type": geju_type,
        "special": special,
        "johu_elem": johu_elem if johu_elem in ("木", "火", "土", "金", "水") else "",
        "tiaohou_usable": johu_elem in ("木", "火", "土", "金", "水"),
        "stems": stems,
        "branches": branches,
        "xiangshen_uncertain": True,
        "ohang": disease.get("오행분포_raw") or {},
    }


def _elem_sign(elem: str, nc: dict) -> float:
    if not elem:
        return 0.0
    if elem in nc["fav"]:
        return 1.0
    if elem in nc["unfav"]:
        return -1.0
    return 0.0


def _season_efficacy(elem: str, nc: dict) -> float:
    me = nc.get("month_elem") or ""
    if not elem or not me:
        return 0.0
    if elem == me:
        return 1.0
    if se.GEN_MAP.get(me) == elem:
        return 0.5
    if se.KE_MAP.get(me) == elem:
        return -0.5
    return 0.0


def _classify_relation_valence(pairs: Sequence[str], target_idx, nc: dict) -> Tuple[float, float, List[str]]:
    val = 0.0
    inten = 0.0
    roles: List[str] = []
    tgt_w = {0: 0.9, 1: 1.15, 2: 1.25, 3: 0.85}.get(target_idx if target_idx is not None else -1, 1.0)
    text = " ".join(str(x) for x in pairs)
    has_hap = any(k in text for k in ("합", "반합", "삼합", "방합"))
    has_clash = any(k in text for k in ("충", "형", "파", "해"))
    t_fav = t_unfav = 0.0
    if target_idx is not None and 0 <= int(target_idx) < 4:
        i = int(target_idx)
        te = se.STEM_ELEMENT.get(nc["stems"][i], "")
        be = se.BRANCH_ELEMENT_MAIN.get(nc["branches"][i], "")
        if _elem_sign(te, nc) > 0 or _elem_sign(be, nc) > 0:
            t_fav = 1.0
        if _elem_sign(te, nc) < 0 or _elem_sign(be, nc) < 0:
            t_unfav = 1.0
            if t_fav:
                t_fav = 0.0
    if has_hap and has_clash:
        roles.append("COMPETING_HAP_CLASH")
        inten += 0.8 * tgt_w
        roles.append("AMBIGUOUS")
        return 0.1 * tgt_w * (1 if t_unfav else -1 if t_fav else 0), inten, roles
    if has_hap:
        inten += 0.7 * tgt_w
        if t_fav:
            val += 0.55 * tgt_w
            roles.append("SUPPORTS_USEFUL_OR_BINDS")
        elif t_unfav:
            val -= 0.45 * tgt_w
            roles.append("SUPPORTS_HARMFUL")
        else:
            roles.append("AMBIGUOUS")
            inten += 0.3
    if has_clash:
        inten += 0.85 * tgt_w
        if t_fav:
            val -= 0.55 * tgt_w
            roles.append("CLASHES_USEFUL_STRUCTURE")
        elif t_unfav:
            val += 0.5 * tgt_w
            roles.append("CLASHES_HARMFUL_STRUCTURE")
        else:
            roles.append("STRUCTURAL_MOVEMENT")
            inten += 0.4
    return val, inten, roles


def _ten_god_role(tg: str, nc: dict) -> Tuple[float, str, str]:
    cat = se._TENGO_CATEGORY.get(tg, "")
    domain = {"관살": "career", "재성": "wealth", "식상": "expression", "인성": "learning", "비겁": "peer"}.get(cat, "general")
    regime = nc.get("strength_regime") or ""
    weak = any(k in regime for k in ("신약", "극약", "태약"))
    strong = any(k in regime for k in ("신강", "극강", "태강"))
    if cat == "인성":
        return (0.45, "SUPPORTS_USEFUL_STRUCTURE", domain) if weak else ((-0.15, "OVERBURDENS_OR_COVERS", domain) if strong else (0.1, "AMBIGUOUS", domain))
    if cat == "관살":
        return (0.35, "CONTROLS_EXCESS", domain) if strong else ((-0.35, "OVERBURDENS_WEAK_STRUCTURE", domain) if weak else (0.05, "AMBIGUOUS", domain))
    if cat == "재성":
        return (0.25, "DRAINS_EXCESS", domain) if strong else ((-0.2, "DRAINS_WEAK", domain) if weak else (0.05, "AMBIGUOUS", domain))
    if cat == "식상":
        return (0.2, "DRAINS_EXCESS", domain) if strong else ((-0.15, "DRAINS_WEAK", domain) if weak else (0.0, "NEUTRAL", domain))
    if cat == "비겁":
        return (0.25, "SUPPLIES_NEEDED_RESOURCE", domain) if weak else ((-0.25, "FEEDS_HARMFUL_EXCESS", domain) if strong else (0.0, "NEUTRAL", domain))
    return 0.0, "AMBIGUOUS", domain


def _regime_evidence(nc: dict, feat: dict, stem: str, branch: str, rels: list) -> Dict[str, Any]:
    dims: Dict[str, str] = {}
    signed: Dict[str, float] = {}
    fav_m = float(feat.get("fav_minus_unfav") or 0.0)
    if fav_m > 0.1:
        dims["elemental_environment_shift"] = "positive"
        signed["elemental_environment_shift"] = 1.0
    elif fav_m < -0.1:
        dims["elemental_environment_shift"] = "negative"
        signed["elemental_environment_shift"] = -1.0
    else:
        dims["elemental_environment_shift"] = "inactive"
        signed["elemental_environment_shift"] = 0.0

    activ = float(feat.get("struct_activ") or 0.0)
    disrupt = float(feat.get("struct_disrupt") or 0.0)
    net = activ - disrupt
    if activ == 0 and disrupt == 0:
        dims["yong_xiang_support_shift"] = "inactive"
        signed["yong_xiang_support_shift"] = 0.0
    elif net > 0 and disrupt < activ * 0.5:
        dims["yong_xiang_support_shift"] = "positive"
        signed["yong_xiang_support_shift"] = 1.0
    elif net < 0:
        dims["yong_xiang_support_shift"] = "negative"
        signed["yong_xiang_support_shift"] = -1.0
    else:
        dims["yong_xiang_support_shift"] = "mixed"
        signed["yong_xiang_support_shift"] = 0.0

    excess = float(feat.get("struct_excess") or 0.0)
    if excess > 0.5:
        dims["structural_activation_shift"] = "negative"
        signed["structural_activation_shift"] = -1.0
    elif activ > 0.5:
        dims["structural_activation_shift"] = "positive"
        signed["structural_activation_shift"] = 0.5
    else:
        dims["structural_activation_shift"] = "inactive"
        signed["structural_activation_shift"] = 0.0

    if nc["special"] != "normal":
        if fav_m > 0:
            dims["geju_state_change"] = dims["special_structure_change"] = "positive"
            signed["geju_state_change"] = signed["special_structure_change"] = 0.8
        elif fav_m < 0:
            dims["geju_state_change"] = dims["special_structure_change"] = "negative"
            signed["geju_state_change"] = signed["special_structure_change"] = -0.8
        else:
            dims["geju_state_change"] = dims["special_structure_change"] = "ambiguous"
            signed["geju_state_change"] = signed["special_structure_change"] = 0.0
    else:
        dims["geju_state_change"] = dims["special_structure_change"] = "inactive"
        signed["geju_state_change"] = signed["special_structure_change"] = 0.0

    je = nc.get("johu_elem") or ""
    if nc.get("tiaohou_usable") and je:
        se_el = se.STEM_ELEMENT.get(stem, "")
        be_el = se.BRANCH_ELEMENT_MAIN.get(branch, "")
        if je in (se_el, be_el) or je in _hidden_elems(branch):
            dims["tiaohou_change"] = "positive"
            signed["tiaohou_change"] = 1.0
        elif se.KE_MAP.get(se_el) == je or se.KE_MAP.get(be_el) == je:
            dims["tiaohou_change"] = "negative"
            signed["tiaohou_change"] = -1.0
        else:
            dims["tiaohou_change"] = "inactive"
            signed["tiaohou_change"] = 0.0
    else:
        dims["tiaohou_change"] = "inactive"
        signed["tiaohou_change"] = 0.0

    rooted = _stem_rooted(stem, branch)
    stem_s = _elem_sign(se.STEM_ELEMENT.get(stem, ""), nc)
    branch_s = _elem_sign(se.BRANCH_ELEMENT_MAIN.get(branch, ""), nc)
    hidden = _hidden_elems(branch)
    hid_fav = any(e in nc["fav"] for e in hidden)
    hid_unfav = any(e in nc["unfav"] for e in hidden)
    if rooted and stem_s > 0:
        dims["rooting_exposure_change"] = "positive"
        signed["rooting_exposure_change"] = 1.0
    elif rooted and stem_s < 0:
        dims["rooting_exposure_change"] = "negative"
        signed["rooting_exposure_change"] = -1.0
    elif hid_fav and stem_s >= 0:
        dims["rooting_exposure_change"] = "positive"
        signed["rooting_exposure_change"] = 0.6
    elif hid_unfav:
        dims["rooting_exposure_change"] = "negative"
        signed["rooting_exposure_change"] = -0.6
    elif not rooted and abs(stem_s) > 0:
        dims["rooting_exposure_change"] = "mixed"
        signed["rooting_exposure_change"] = 0.15 * stem_s
    else:
        dims["rooting_exposure_change"] = "inactive"
        signed["rooting_exposure_change"] = 0.0

    rel_val = rel_int = key_hit = 0.0
    roles_all: List[str] = []
    for rel in rels or []:
        if not isinstance(rel, dict):
            continue
        pairs = rel.get("relations") or rel.get("patterns") or []
        if isinstance(pairs, str):
            pairs = [pairs]
        idx = rel.get("pillar_idx")
        v, inten, roles = _classify_relation_valence(pairs, idx, nc)
        rel_val += v
        rel_int += inten
        roles_all.extend(roles)
        if idx in (1, 2) and inten > 0:
            key_hit += 1.0 if v != 0 else 0.5

    if abs(rel_val) < 0.05 and rel_int < 0.2:
        dims["major_relation_change"] = "inactive"
        signed["major_relation_change"] = 0.0
    elif abs(rel_val) < 0.15 and rel_int >= 0.2:
        dims["major_relation_change"] = "ambiguous"
        signed["major_relation_change"] = 0.0
    elif rel_val > 0:
        dims["major_relation_change"] = "positive"
        signed["major_relation_change"] = float(np.clip(rel_val, -1, 1))
    else:
        dims["major_relation_change"] = "negative"
        signed["major_relation_change"] = float(np.clip(rel_val, -1, 1))

    if key_hit >= 1 and rel_val != 0:
        dims["key_pillar_change"] = "positive" if rel_val > 0 else "negative"
        signed["key_pillar_change"] = 0.5 * float(np.sign(rel_val))
    else:
        dims["key_pillar_change"] = "inactive" if key_hit < 1 else "ambiguous"
        signed["key_pillar_change"] = 0.0

    if stem_s * branch_s > 0 and stem_s != 0:
        dims["stem_branch_convergence"] = "positive" if stem_s > 0 else "negative"
        signed["stem_branch_convergence"] = float(np.sign(stem_s))
    elif stem_s * branch_s < 0:
        dims["stem_branch_convergence"] = "mixed"
        signed["stem_branch_convergence"] = 0.0
    else:
        dims["stem_branch_convergence"] = "inactive"
        signed["stem_branch_convergence"] = 0.0

    seas = 0.5 * (
        _season_efficacy(se.STEM_ELEMENT.get(stem, ""), nc)
        + _season_efficacy(se.BRANCH_ELEMENT_MAIN.get(branch, ""), nc)
    )
    active = [(k, v) for k, v in signed.items() if dims[k] not in ("inactive",)]
    pos = [v for _, v in active if v > 0.05]
    neg = [v for _, v in active if v < -0.05]
    contrad = min(len(pos), len(neg)) if pos and neg else 0
    direction = float(np.clip(sum(signed.values()) / max(1.0, len(signed)), -1.5, 1.5))
    if seas != 0 and abs(direction) > 0:
        direction = float(np.clip(direction * (1.0 + 0.15 * seas), -1.5, 1.5))
    n_agree = max(len(pos), len(neg))
    n_active = len([1 for _, v in dims.items() if v not in ("inactive",)])
    if contrad >= 2:
        strength_class, conf = "LOW", 0.35
    elif n_agree >= 4 and contrad == 0 and abs(direction) > 0.35:
        strength_class, conf = "TRANSFORMATIVE", 0.9
    elif n_agree >= 3 and contrad <= 1:
        strength_class, conf = "HIGH", 0.75
    elif n_agree >= 2:
        strength_class, conf = "MEDIUM", 0.6
    else:
        strength_class, conf = "LOW", (0.45 if n_active else 0.3)
    if contrad and strength_class in ("HIGH", "TRANSFORMATIVE"):
        strength_class, conf = "MEDIUM", conf * 0.7
    return {
        "dims": dims,
        "signed": signed,
        "direction_score": round(direction, 4),
        "contradiction_count": contrad,
        "strength_class": strength_class,
        "confidence": round(conf, 4),
        "n_active": n_active,
        "n_agree": n_agree,
        "relation_roles": roles_all[:12],
        "event_intensity": round(float(rel_int), 4),
        "season_efficacy": round(float(seas), 4),
        "stem_rooted": rooted,
    }


def _map_amp(amp_name: str, strength_class: str, direction_unit: float, confidence: float) -> float:
    mag = AMP_MAPS[amp_name][strength_class] * (0.65 + 0.35 * confidence)
    return float(direction_unit) * mag


def _h_b(feat: dict, z_params: dict) -> float:
    def zf(k):
        return B._z_clip(feat[k], *z_params[k])

    return (
        0.45 * zf("fav_minus_unfav")
        + 0.35 * zf("struct_activ")
        - 0.35 * zf("struct_disrupt")
        - 0.15 * zf("struct_excess")
    )


def _repetition_flags(nc: dict, d_stem: str, d_br: str, y_stem: str, y_br: str) -> Dict[str, float]:
    natal_pillars = [f"{s}{b}" for s, b in zip(nc["stems"], nc["branches"])]
    dp, yp = f"{d_stem}{d_br}", f"{y_stem}{y_br}"
    return {
        "fuyin_natal_year": 1.0 if yp in natal_pillars else 0.0,
        "fuyin_natal_dae": 1.0 if dp in natal_pillars else 0.0,
        "binglin_dy": 1.0 if dp == yp and dp else 0.0,
        "fanyin": 1.0 if ((d_stem, y_stem) in se.STEM_CLASH and (d_br, y_br) in se.BRANCH_CLASH) else 0.0,
    }


def _contextual_year(nc: dict, meta: dict, d_stem: str, d_br: str, d_dir: float) -> Dict[str, float]:
    y_stem = meta.get("세운_stem") or (meta.get("세운_pillar") or "  ")[0]
    y_br = meta.get("세운_branch") or (meta.get("세운_pillar") or "  ")[1]
    rels = meta.get("세운_관계_with_원국") or []
    val = inten = 0.0
    if isinstance(rels, list):
        for rel in rels:
            if not isinstance(rel, dict):
                continue
            pairs = rel.get("relations") or []
            v, it, _ = _classify_relation_valence(pairs, rel.get("pillar_idx"), nc)
            val += v
            inten += it
    if inten < 0.1:
        flags = B._ilju_flags(meta)
        fake = []
        if flags["year_hap"]:
            fake.append("지지합")
        if flags["year_chung"]:
            fake.append("지지충")
        if flags["year_hyung"]:
            fake.append("지지형")
        if flags["year_pa_hae"]:
            fake.append("지지파")
        v, it, _ = _classify_relation_valence(fake, 2, nc)
        val += v
        inten += it
    tg_v = 0.0
    for tg in (meta.get("세운_십성_천간") or "", meta.get("세운_십성_지지") or ""):
        if not tg:
            continue
        dv, _, _ = _ten_god_role(tg, nc)
        tg_v += dv
        if d_dir > 0.2 and dv > 0:
            tg_v += 0.1
        elif d_dir < -0.2 and dv < 0:
            tg_v += 0.1
        elif d_dir > 0.2 and dv < 0:
            tg_v -= 0.15
        elif d_dir < -0.2 and dv > 0:
            tg_v += 0.1
    dy_rels = se._calc_two_pillar_relations(d_stem, d_br, y_stem, y_br)
    dy_v, _, _ = _classify_relation_valence(dy_rels, None, nc)
    y_sign = 0.5 * (
        _elem_sign(se.STEM_ELEMENT.get(y_stem, ""), nc)
        + _elem_sign(se.BRANCH_ELEMENT_MAIN.get(y_br, ""), nc)
    )
    reinforce = float(np.sign(d_dir) * y_sign) if d_dir and y_sign else 0.0
    reps = _repetition_flags(nc, d_stem, d_br, y_stem, y_br)
    inten += 0.8 * reps["binglin_dy"] + 0.5 * reps["fuyin_natal_year"] + 0.6 * reps["fanyin"]
    if reps["binglin_dy"] and abs(d_dir) > 0.2:
        val += 0.15 * float(np.sign(d_dir))
    unseong = meta.get("세운_12운성") or ""
    un_mod = 0.0
    if unseong in ("장생", "관대", "건록", "제왕") and "신약" in (nc.get("strength_regime") or ""):
        un_mod = 0.15
    elif unseong in ("쇠", "병", "사", "묘", "절") and "신강" in (nc.get("strength_regime") or ""):
        un_mod = 0.1
    gm = meta.get("gongmang_factors") or {}
    gm_damp = -0.1 if isinstance(gm, dict) and (gm.get("세운_공망") or gm.get("year_void")) else 0.0
    contextual = float(np.clip(0.55 * val + 0.35 * tg_v + 0.25 * dy_v + un_mod + gm_damp, -4.0, 4.0))
    dy_context = float(np.clip(1.2 * reinforce + 0.5 * dy_v, -3.0, 3.0))
    if inten > 1.5 and abs(contextual) > 0.2:
        contextual *= 1.0 + min(0.35, 0.1 * inten)
    return {
        "contextual_trigger": contextual,
        "dy_context": dy_context,
        "event_intensity": float(inten),
        "valence": float(np.clip(val + 0.5 * tg_v, -3, 3)),
        "reinforce": reinforce,
        **reps,
    }


def _annual_metrics(packs, score_maps) -> Dict[str, Any]:
    rows, pairs, seps = [], [], []
    all_s = []
    for pack, smap in zip(packs, score_maps):
        all_s.extend(smap.values())
        good = [e for e in pack["n"]["good"] if not e.get("exclude")]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude")]
        ga, gu = B.C.wavg(good, smap)
        ba, bu = B.C.wavg(bad, smap)
        if gu < 1 or bu < 1 or ga != ga or ba != ba:
            continue
        gs = [smap[int(e["year"])] for e in good if int(e["year"]) in smap]
        bs = [smap[int(e["year"])] for e in bad if int(e["year"]) in smap]
        pr = _pairwise(gs, bs)
        if pr is not None:
            pairs.append(pr)
        sep = float(ga - ba)
        seps.append(sep)
        rows.append({
            "name": pack["name"], "hit": 1 if ga > ba else 0,
            "sep": round(sep, 4), "pairwise": None if pr is None else round(pr, 4),
            "good_avg": round(float(ga), 4), "bad_avg": round(float(ba), 4),
        })
    hits = [r["hit"] for r in rows]
    sd = float(np.std(all_s, ddof=1)) if len(all_s) > 1 else float("nan")
    raw = float(np.mean(seps)) if seps else float("nan")
    std = raw / sd if sd and sd > 1e-12 else float("nan")
    return {
        "n": len(rows),
        "hit": f"{sum(hits)}/{len(hits)}" if hits else "—",
        "hit_rate": None if not hits else round(100.0 * sum(hits) / len(hits), 2),
        "pairwise_mean": None if not pairs else round(float(np.mean(pairs)), 4),
        "raw_sep_mean": None if raw != raw else round(raw, 4),
        "std_sep": None if std != std else round(std, 4),
        "subjects": rows,
        "failures": [r for r in rows if r["hit"] == 0],
    }


def _parent_stats(packs, layers_list) -> Dict[str, Any]:
    override = rescue = both_ok = both_bad = n = 0
    same_ov = same_re = same_n = 0
    cross_ov = cross_re = cross_n = 0
    high_ov = high_re = high_n = 0
    low_ov = low_re = low_n = 0
    same_pairs, cross_pairs, high_pairs, low_pairs = [], [], [], []
    for pack, layers in zip(packs, layers_list):
        goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
        bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
        for ge, be in product(goods, bads):
            Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
            da = Lg["A"] - Lb["A"]
            dg = Lg["D"] - Lb["D"]
            ds = Lg["Y"] - Lb["Y"]
            n += 1
            a_ok, d_ok, s_ok = da > 1e-9, dg > 1e-9, ds > 1e-9
            if a_ok and not s_ok:
                override += 1
            if (not a_ok) and s_ok and d_ok:
                rescue += 1
            if a_ok and s_ok:
                both_ok += 1
            if (not a_ok) and (not d_ok):
                both_bad += 1
            same = Lg["pillar"] == Lb["pillar"]
            pr = 1.0 if s_ok else 0.0
            strength = Lg.get("strength_class") or "LOW"
            high = strength in ("HIGH", "TRANSFORMATIVE") or abs(dg) >= 10
            if same:
                same_n += 1
                same_pairs.append(pr)
                if a_ok and not s_ok:
                    same_ov += 1
                if (not a_ok) and s_ok and d_ok:
                    same_re += 1
            else:
                cross_n += 1
                cross_pairs.append(pr)
                if a_ok and not s_ok:
                    cross_ov += 1
                if (not a_ok) and s_ok and d_ok:
                    cross_re += 1
                if high:
                    high_n += 1
                    high_pairs.append(pr)
                    if a_ok and not s_ok:
                        high_ov += 1
                    if (not a_ok) and s_ok and d_ok:
                        high_re += 1
                else:
                    low_n += 1
                    low_pairs.append(pr)
                    if a_ok and not s_ok:
                        low_ov += 1
                    if (not a_ok) and s_ok and d_ok:
                        low_re += 1

    def rate(a, b):
        return None if not b else round(a / b, 4)

    return {
        "n_pairs": n,
        "D_OVERRIDE_rate": rate(override, n),
        "D_RESCUE_rate": rate(rescue, n),
        "NET_PARENT_VALUE": rate(rescue - override, n),
        "both_ok_rate": rate(both_ok, n),
        "same_D_pairwise": None if not same_pairs else round(float(np.mean(same_pairs)), 4),
        "cross_D_pairwise": None if not cross_pairs else round(float(np.mean(cross_pairs)), 4),
        "high_regime_cross_pairwise": None if not high_pairs else round(float(np.mean(high_pairs)), 4),
        "low_regime_cross_pairwise": None if not low_pairs else round(float(np.mean(low_pairs)), 4),
        "same_override": rate(same_ov, same_n),
        "cross_override": rate(cross_ov, cross_n),
        "high_net": rate(high_re - high_ov, high_n),
        "low_net": rate(low_re - low_ov, low_n),
    }


def _d_distinctiveness(d_by_subject: Dict[str, List[float]]) -> Dict[str, Any]:
    ranges, jumps, uniq = [], [], []
    buckets = defaultdict(int)
    for ds in d_by_subject.values():
        if not ds:
            continue
        ranges.append(max(ds) - min(ds))
        uniq.append(len(set(round(x, 2) for x in ds)))
        for i in range(len(ds) - 1):
            j = abs(ds[i + 1] - ds[i])
            jumps.append(j)
            if j < 2:
                buckets["lt2"] += 1
            elif j < 5:
                buckets["2_5"] += 1
            elif j < 10:
                buckets["5_10"] += 1
            elif j < 20:
                buckets["10_20"] += 1
            elif j < 30:
                buckets["20_30"] += 1
            else:
                buckets["gt30"] += 1
    a = np.asarray(jumps, dtype=float) if jumps else np.asarray([0.0])
    return {
        "within_range_p50": round(float(np.median(ranges)), 4) if ranges else None,
        "within_range_p90": round(float(np.percentile(ranges, 90)), 4) if ranges else None,
        "unique_levels_p50": round(float(np.median(uniq)), 4) if uniq else None,
        "adj_p25": round(float(np.percentile(a, 25)), 4),
        "adj_p50": round(float(np.percentile(a, 50)), 4),
        "adj_p75": round(float(np.percentile(a, 75)), 4),
        "adj_p90": round(float(np.percentile(a, 90)), 4),
        "adj_p95": round(float(np.percentile(a, 95)), 4),
        "adj_max": round(float(np.max(a)), 4),
        "jump_buckets": dict(buckets),
        "n_jumps": len(jumps),
    }


def _jump_validity(pack_blocks, d_maps, evid_maps, threshold: float = 10.0) -> Dict[str, Any]:
    rows = []
    for name, bf in pack_blocks.items():
        ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])
        for i in range(len(ordered) - 1):
            p0, p1 = ordered[i][0], ordered[i + 1][0]
            jump = d_maps[(name, p1)] - d_maps[(name, p0)]
            if abs(jump) < threshold:
                continue
            ev = evid_maps.get((name, p1), {})
            rows.append({
                "name": name, "from": p0, "to": p1, "jump": round(jump, 4),
                "strength_class": ev.get("strength_class"),
                "confidence": ev.get("confidence"),
                "n_agree": ev.get("n_agree"),
                "contradiction": ev.get("contradiction_count"),
                "direction": ev.get("direction_score"),
                "dims_active": [k for k, v in (ev.get("dims") or {}).items() if v not in ("inactive",)],
            })
    if not rows:
        return {"n": 0, "rows": [], "p_high_given_large": None}
    high = [r for r in rows if r["strength_class"] in ("HIGH", "TRANSFORMATIVE")]
    return {
        "n": len(rows),
        "n_high_among_large": len(high),
        "p_high_given_large": round(len(high) / len(rows), 4),
        "rows": rows[:40],
    }


def main() -> int:
    print("══════════ V2 DY ORTHODOX (Phase 2.5) ══════════")
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    print("── packing ──")
    old_packs, fresh_packs, val_b = B._load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for pack in all_packs:
        if pack["name"] in val_b:
            raise RuntimeError(f"Val B present: {pack['name']}")

    cfg = dict(arm_b.ARM_B_CONFIG)
    print("── natal + block features ──")
    pack_blocks: Dict[str, dict] = {}
    natal: Dict[str, dict] = {}
    all_block_rows = []
    for pack in all_packs:
        natal[pack["name"]] = _natal_context(pack)
        bf = B._block_feats(pack)
        by_p = {row["daewoon_pillar"]: row for row in (pack.get("dw") or [])}
        for pillar, f in bf.items():
            row = by_p.get(pillar) or {}
            f["stem"] = row.get("stem") or pillar[0]
            f["branch"] = row.get("branch") or pillar[1]
            f["rels"] = row.get("관계_with_원국") or []
        pack_blocks[pack["name"]] = bf
        all_block_rows.extend(bf.values())

    z_keys = [
        "fav_act", "unfav_act", "fav_minus_unfav",
        "struct_activ", "struct_disrupt", "struct_net", "struct_excess",
        "has_hap", "has_chung", "has_samhap", "has_day_chung",
    ]
    z_params = {k: B._robust_params([float(r[k]) for r in all_block_rows]) for k in z_keys}

    evid: Dict[Tuple[str, str], dict] = {}
    hB: Dict[Tuple[str, str], float] = {}
    for pack in all_packs:
        nc = natal[pack["name"]]
        for pillar, f in pack_blocks[pack["name"]].items():
            key = (pack["name"], pillar)
            hB[key] = _h_b(f, z_params)
            evid[key] = _regime_evidence(nc, f, f["stem"], f["branch"], f.get("rels") or [])

    def build_D(mode: str, amp_name: str) -> Dict[Tuple[str, str], float]:
        out = {}
        for key, hb in hB.items():
            ev = evid[key]
            if mode == "REF":
                out[key] = _clamp(BASE + 3.0 * hb)
                continue
            if mode == "O1":
                direction_unit = float(np.tanh(hb))
                if abs(ev["direction_score"]) > 0.05:
                    direction_unit = float(np.clip(0.7 * direction_unit + 0.3 * np.tanh(ev["direction_score"]), -1, 1))
                delta = _map_amp(amp_name, ev["strength_class"], direction_unit, ev["confidence"])
                out[key] = _clamp(BASE + delta)
            else:
                direction_unit = float(np.tanh(ev["direction_score"]))
                if abs(hb) > 0.05:
                    direction_unit = float(np.clip(0.55 * direction_unit + 0.45 * np.tanh(hb), -1, 1))
                delta = _map_amp(amp_name, ev["strength_class"], direction_unit, ev["confidence"])
                out[key] = _clamp(BASE + delta)
        return out

    print("── score candidates ──")
    variants = [("REF", REF_NAME, "BALANCED")]
    for amp in ("BALANCED", "CONSERVATIVE", "EXPRESSIVE"):
        variants.append(("O1", f"{O1_NAME}::{amp}", amp))
        variants.append(("O2", f"{O2_NAME}::{amp}", amp))

    results: Dict[str, Any] = {}

    for mode, label, amp in variants:
        print(f"  {label}")
        d_lookup = build_D(mode, amp)
        layers_by_pack = []
        score_maps_all = []
        d_by_subj: Dict[str, List[float]] = defaultdict(list)

        for pack in all_packs:
            nc = natal[pack["name"]]
            gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
            by_p = defaultdict(list)
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                if (pack["name"], pillar) not in d_lookup:
                    continue
                by_p[pillar].append(gmap[int(y)])
            med = {pp: float(np.median(v)) for pp, v in by_p.items()}
            bf = pack_blocks[pack["name"]]
            ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])
            for pp, _ in ordered:
                d_by_subj[pack["name"]].append(d_lookup[(pack["name"], pp)])

            layers = {}
            smap = {}
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                key = (pack["name"], pillar)
                if key not in d_lookup:
                    continue
                g = gmap[int(y)]
                a = g - med[pillar]
                d = float(d_lookup[key])
                ev = evid[key]
                f = bf[pillar]
                if mode == "REF":
                    flags = B._ilju_flags(m)
                    tg = B._tg_career(m)
                    trigger = (
                        1.2 * flags["year_hap"] - 1.5 * flags["year_chung"]
                        - 1.0 * flags["year_hyung"] - 0.8 * flags["year_pa_hae"] + 0.4 * tg
                    )
                    annual_dev = 0.65 * a + 0.35 * trigger
                    ctx = 0.0
                    cy = {"contextual_trigger": trigger, "dy_context": 0.0, "event_intensity": abs(trigger)}
                else:
                    cy = _contextual_year(nc, m, f["stem"], f["branch"], ev["direction_score"])
                    if mode == "O1":
                        annual_dev = float(np.clip(0.60 * a + 0.25 * cy["contextual_trigger"] + 0.15 * cy["dy_context"], -12, 12))
                    else:
                        annual_dev = float(np.clip(0.55 * a + 0.25 * cy["contextual_trigger"] + 0.20 * cy["dy_context"], -14, 14))
                    ctx = cy["dy_context"]
                y_disp = _clamp(d + annual_dev)
                layers[int(y)] = {
                    "pillar": pillar, "D": d, "G": g, "A": a, "annual_dev": annual_dev,
                    "ctx": ctx, "Y": y_disp, "strength_class": ev["strength_class"],
                    "confidence": ev["confidence"], "event_intensity": cy.get("event_intensity", 0),
                    "direction_score": ev["direction_score"],
                }
                smap[int(y)] = y_disp
            layers_by_pack.append(layers)
            score_maps_all.append(smap)

        arch_res = {"label": label, "mode": mode, "amp": amp}
        for pool_name, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs)):
            idx = [i for i, pk in enumerate(all_packs) if pk["pool"] == pool_name]
            sub_packs = [all_packs[i] for i in idx]
            sub_maps = [score_maps_all[i] for i in idx]
            sub_layers = [layers_by_pack[i] for i in idx]
            ann = _annual_metrics(sub_packs, sub_maps)
            parent = _parent_stats(sub_packs, sub_layers)
            a_vals = [abs(L["annual_dev"]) for layers in sub_layers for L in layers.values()]
            ctx_vals = [abs(L["ctx"]) for layers in sub_layers for L in layers.values()]
            inten_vals = [L["event_intensity"] for layers in sub_layers for L in layers.values()]
            sub_d = {pk["name"]: d_by_subj[pk["name"]] for pk in sub_packs}
            dist = _d_distinctiveness(sub_d)
            jv = _jump_validity({pk["name"]: pack_blocks[pk["name"]] for pk in sub_packs}, d_lookup, evid, 10.0)
            jv20 = _jump_validity({pk["name"]: pack_blocks[pk["name"]] for pk in sub_packs}, d_lookup, evid, 20.0)
            arch_res[pool_name] = {
                "annual": {k: v for k, v in ann.items() if k != "subjects"},
                "subjects": ann["subjects"],
                "failures": ann["failures"],
                "parent": parent,
                "d_dist": dist,
                "jump_gt10": {k: v for k, v in jv.items() if k != "rows"},
                "jump_gt20": {k: v for k, v in jv20.items() if k != "rows"},
                "jump_examples": jv.get("rows", [])[:15],
                "abs_annual_dev_p50": None if not a_vals else round(float(np.median(a_vals)), 4),
                "abs_ctx_p50": None if not ctx_vals else round(float(np.median(ctx_vals)), 4),
                "event_intensity_p50": None if not inten_vals else round(float(np.median(inten_vals)), 4),
            }
        sc_counts = defaultdict(int)
        for k, evv in evid.items():
            if k[0] in d_by_subj:
                sc_counts[evv["strength_class"]] += 1
        arch_res["strength_class_hist"] = dict(sc_counts)
        results[label] = arch_res

    def pick_amp(prefix: str) -> str:
        cands = [k for k in results if k.startswith(prefix + "::")]

        def key(lab):
            fa = results[lab]["FRESH_A_DEV"]["annual"]
            old = results[lab]["OLD_DEV"]["annual"]
            par = results[lab]["FRESH_A_DEV"]["parent"]
            dist = results[lab]["FRESH_A_DEV"]["d_dist"]
            fa_pw = fa.get("pairwise_mean") or 0
            old_pw = old.get("pairwise_mean") or 0
            net = par.get("NET_PARENT_VALUE") or 0
            jv = results[lab]["FRESH_A_DEV"]["jump_gt10"].get("p_high_given_large")
            jv_s = jv if jv is not None else 0.5
            p90 = dist.get("adj_p90") or 0
            flat_pen = 1 if p90 < 2.0 else 0
            vol_pen = 1 if (dist.get("adj_max") or 0) > 45 else 0
            return (fa_pw, old_pw, net, jv_s, -flat_pen, -vol_pen)

        return sorted(cands, key=key, reverse=True)[0]

    o1_best = pick_amp(O1_NAME)
    o2_best = pick_amp(O2_NAME)
    ref_label = REF_NAME

    def summary_row(lab):
        fa = results[lab]["FRESH_A_DEV"]
        old = results[lab]["OLD_DEV"]
        return {
            "label": lab,
            "FA_pw": fa["annual"]["pairwise_mean"],
            "FA_hit": fa["annual"]["hit"],
            "FA_std": fa["annual"]["std_sep"],
            "OLD_pw": old["annual"]["pairwise_mean"],
            "OLD_hit": old["annual"]["hit"],
            "OLD_std": old["annual"]["std_sep"],
            "FA_override": fa["parent"]["D_OVERRIDE_rate"],
            "FA_rescue": fa["parent"]["D_RESCUE_rate"],
            "FA_net": fa["parent"]["NET_PARENT_VALUE"],
            "FA_adj_p50": fa["d_dist"]["adj_p50"],
            "FA_adj_p90": fa["d_dist"]["adj_p90"],
            "FA_adj_max": fa["d_dist"]["adj_max"],
            "FA_same_pw": fa["parent"]["same_D_pairwise"],
            "FA_cross_pw": fa["parent"]["cross_D_pairwise"],
            "FA_high_cross_pw": fa["parent"]["high_regime_cross_pairwise"],
            "FA_range_p50": fa["d_dist"]["within_range_p50"],
            "jump10_p_high": fa["jump_gt10"].get("p_high_given_large"),
            "jump10_n": fa["jump_gt10"].get("n"),
        }

    rows = [summary_row(ref_label), summary_row(o1_best), summary_row(o2_best)]
    ref_fa = results[ref_label]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
    ref_old = results[ref_label]["OLD_DEV"]["annual"]["pairwise_mean"] or 0

    def usable(lab: str) -> bool:
        fa = results[lab]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
        old = results[lab]["OLD_DEV"]["annual"]["pairwise_mean"] or 0
        ov = results[lab]["FRESH_A_DEV"]["parent"]["D_OVERRIDE_rate"] or 1
        return fa >= 0.52 and old >= 0.50 and ov <= 0.20 and fa >= ref_fa - 0.05

    def improved(lab: str) -> bool:
        fa = results[lab]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
        old = results[lab]["OLD_DEV"]["annual"]["pairwise_mean"] or 0
        return fa >= ref_fa - 0.01 and old >= ref_old - 0.02 and (fa > ref_fa + 0.005 or old > ref_old + 0.005)

    o1_ok, o2_ok = usable(o1_best), usable(o2_best)
    o1_imp, o2_imp = improved(o1_best), improved(o2_best)

    winner_numeric = ref_label
    # Always pick best orthodox for interpretation / structure QA even if not numeric-ready.
    ortho_ranked = sorted(
        [o1_best, o2_best],
        key=lambda lab: (
            results[lab]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0,
            results[lab]["OLD_DEV"]["annual"]["pairwise_mean"] or 0,
            results[lab]["FRESH_A_DEV"]["parent"].get("NET_PARENT_VALUE") or 0,
        ),
        reverse=True,
    )
    winner_ortho = ortho_ranked[0]
    final_status = "V2_DY_B_REMAINS_BEST"

    ranked = []
    if o1_ok:
        ranked.append((o1_best, results[o1_best]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0, o1_imp))
    if o2_ok:
        ranked.append((o2_best, results[o2_best]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0, o2_imp))
    ranked.sort(key=lambda x: (x[2], x[1]), reverse=True)

    if ranked:
        best_lab, best_fa, best_imp = ranked[0]
        winner_ortho = best_lab
        dist = results[best_lab]["FRESH_A_DEV"]["d_dist"]
        net = results[best_lab]["FRESH_A_DEV"]["parent"]["NET_PARENT_VALUE"] or 0
        structure_gain = (dist.get("adj_p90") or 0) >= 3.0 and net >= -0.05
        if best_imp and best_fa >= ref_fa - 0.02:
            winner_numeric = best_lab
            final_status = "V2_DY_ORTHODOX_READY_TO_FREEZE"
        elif structure_gain and best_fa >= ref_fa - 0.03 and (results[best_lab]["OLD_DEV"]["annual"]["pairwise_mean"] or 0) >= ref_old - 0.03:
            if best_fa >= ref_fa - 0.015 and (results[best_lab]["OLD_DEV"]["annual"]["pairwise_mean"] or 0) >= ref_old - 0.02:
                winner_numeric = best_lab
                final_status = "V2_DY_ORTHODOX_READY_TO_FREEZE"
            else:
                winner_numeric = ref_label
                final_status = "V2_DY_ORTHODOX_EXPLANATION_ONLY"
        else:
            winner_numeric = ref_label
            final_status = "V2_DY_ORTHODOX_EXPLANATION_ONLY"
    else:
        # Material FA regression vs B → keep B numeric; retain orthodox as explanation layer.
        fa_o = results[winner_ortho]["FRESH_A_DEV"]["annual"]["pairwise_mean"] or 0
        old_o = results[winner_ortho]["OLD_DEV"]["annual"]["pairwise_mean"] or 0
        dist = results[winner_ortho]["FRESH_A_DEV"]["d_dist"]
        if fa_o >= 0.50 and old_o >= 0.50 and (dist.get("adj_p90") or 0) >= 3.0:
            final_status = "V2_DY_ORTHODOX_EXPLANATION_ONLY"
        else:
            final_status = "V2_DY_B_REMAINS_BEST"

    # ablations
    print(f"── ablations on {winner_ortho or o1_best} ──")
    abl_target = winner_ortho or o1_best
    ablations = {}
    mode0 = "O1" if O1_NAME in abl_target else "O2"
    amp0 = abl_target.split("::")[1]
    for abl_name, mode_abl in (("no_dy_context", "no_dy"), ("no_contextual_trigger", "no_ctx"), ("g_only_annual", "g_only")):
        d_lookup = build_D(mode0, amp0)
        score_maps = []
        for pack in fresh_packs:
            nc = natal[pack["name"]]
            gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
            by_p = defaultdict(list)
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                if (pack["name"], pillar) not in d_lookup:
                    continue
                by_p[pillar].append(gmap[int(y)])
            med = {pp: float(np.median(v)) for pp, v in by_p.items()}
            smap = {}
            for y, m in pack["meta"].items():
                pillar = str(m.get("대운_pillar") or "_")
                key = (pack["name"], pillar)
                if key not in d_lookup:
                    continue
                a = gmap[int(y)] - med[pillar]
                d = d_lookup[key]
                f = pack_blocks[pack["name"]][pillar]
                cy = _contextual_year(nc, m, f["stem"], f["branch"], evid[key]["direction_score"])
                ct, dy = cy["contextual_trigger"], cy["dy_context"]
                if mode_abl == "no_dy":
                    dy = 0.0
                elif mode_abl == "no_ctx":
                    ct = 0.0
                elif mode_abl == "g_only":
                    ct = dy = 0.0
                if mode0 == "O1":
                    annual_dev = 0.60 * a + 0.25 * ct + 0.15 * dy
                else:
                    annual_dev = 0.55 * a + 0.25 * ct + 0.20 * dy
                smap[int(y)] = _clamp(d + annual_dev)
            score_maps.append(smap)
        ablations[abl_name] = _annual_metrics(fresh_packs, score_maps)

    double_count = {
        "fav_unfav_element": {"Natal": "NONE", "D_CORE": "CORE", "D_ORTHO": "RELATED_BUT_DIFFERENT_TIMESCALE", "G": "RELATED_BUT_DIFFERENT_TIMESCALE", "SewoonTrigger": "NONE", "DxY": "NONE"},
        "struct_activ_disrupt": {"Natal": "NONE", "D_CORE": "CORE", "D_ORTHO": "RELATED_BUT_DIFFERENT_TIMESCALE", "G": "RELATED_BUT_DIFFERENT_TIMESCALE", "SewoonTrigger": "NONE", "DxY": "NONE"},
        "G_CLEAN_AXIS": {"Natal": "NONE", "D_CORE": "NONE", "D_ORTHO": "NONE", "G": "CORE", "SewoonTrigger": "NONE", "DxY": "NONE"},
        "fixed_sign_ilju": {"Natal": "NONE", "D_CORE": "NONE", "D_ORTHO": "NONE", "G": "NONE", "SewoonTrigger": "DUPLICATE_IN_REF_ONLY", "DxY": "NONE"},
        "contextual_relations": {"Natal": "NONE", "D_CORE": "NONE", "D_ORTHO": "CORE", "G": "RELATED_BUT_DIFFERENT_TIMESCALE", "SewoonTrigger": "CORE", "DxY": "RELATED_BUT_DIFFERENT_TIMESCALE"},
        "DxY": {"Natal": "NONE", "D_CORE": "NONE", "D_ORTHO": "NONE", "G": "NONE", "SewoonTrigger": "NONE", "DxY": "CORE"},
        "shinsal": {"Natal": "NONE", "D_CORE": "NONE", "D_ORTHO": "NONE", "G": "NONE", "SewoonTrigger": "NONE", "DxY": "NONE"},
    }

    case_names = []
    for pool in (fresh_packs, old_packs):
        for pk in pool:
            if pk["name"] not in case_names:
                case_names.append(pk["name"])
            if len(case_names) >= 18:
                break
        if len(case_names) >= 18:
            break

    win_lab = winner_numeric if final_status != "V2_DY_ORTHODOX_EXPLANATION_ONLY" else (winner_ortho or winner_numeric)
    if "::" in str(win_lab):
        mode_c, amp_c = ("O1" if O1_NAME in win_lab else "O2"), win_lab.split("::")[1]
    else:
        mode_c, amp_c = "REF", "BALANCED"
    d_case = build_D(mode_c, amp_c)
    d_ref = build_D("REF", "BALANCED")
    case_review = []
    for name in case_names:
        bf = pack_blocks[name]
        ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])
        timeline = []
        for i, (pp, f) in enumerate(ordered):
            d_new = d_case[(name, pp)]
            d_old = d_ref[(name, pp)]
            jump = None if i == 0 else d_new - d_case[(name, ordered[i - 1][0])]
            evv = evid[(name, pp)]
            timeline.append({
                "pillar": pp,
                "D_ref": round(d_old, 2),
                "D_cand": round(d_new, 2),
                "jump_from_prev": None if jump is None else round(jump, 2),
                "strength": evv["strength_class"],
                "confidence": evv["confidence"],
                "direction": evv["direction_score"],
                "reasons": [k for k, v in evv["dims"].items() if v not in ("inactive", "ambiguous")][:8],
            })
        large = [t for t in timeline if t["jump_from_prev"] is not None and abs(t["jump_from_prev"]) >= 10]
        case_review.append({"name": name, "timeline": timeline, "large_jumps": large})

    # classical checklist
    checklist = {
        "1_calendar_audited": "YES",
        "2_natal_context_first": "YES",
        "3_wolyeong": "PARTIAL",
        "4_strength_regime": "YES",
        "5_geju": "PARTIAL",
        "6_yong_hee_gi_structural": "YES",
        "7_xiangshen": "NO",
        "8_tiaohou": "PARTIAL",
        "9_not_equal_balance": "YES",
        "10_stem_branch_both": "YES",
        "11_hidden_stems": "YES",
        "12_rooting": "YES",
        "13_transparency": "PARTIAL",
        "14_no_fixed_6535": "YES",
        "15_contextual_tengod": "YES",
        "16_domain_vs_valence": "YES",
        "17_stem_relations": "YES",
        "18_yukhap": "YES",
        "19_samhap": "PARTIAL",
        "20_banghap": "PARTIAL",
        "21_chung": "YES",
        "22_hyung": "YES",
        "23_pa": "YES",
        "24_hae": "YES",
        "25_relation_resolution": "PARTIAL",
        "26_hap_hwa_conditional": "PARTIAL",
        "27_tonggwan_mediation": "PARTIAL",
        "28_pillar_target": "YES",
        "29_geju_transition": "PARTIAL",
        "30_special_cong_hwa": "PARTIAL",
        "31_myogo_not_simplistic": "YES",
        "32_unseong_contextual": "PARTIAL",
        "33_gongmang_secondary": "YES",
        "34_shinsal_secondary": "YES",
        "35_d_dir_strength_split": "YES",
        "36_large_justified_d": "YES",
        "37_dxy": "YES",
        "38_event_intensity_split": "YES",
        "39_repetition_patterns": "YES",
        "40_score_reason_trace": "PARTIAL",
        "41_no_blind_signs": "YES",
        "42_no_hidden_double_count": "PARTIAL",
    }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_DY_ORTHODOX",
        "validation_b_scored": False,
        "foundation": "USABLE_PRODUCTION_COMPATIBLE",
        "reference": ref_label,
        "o1_selected": o1_best,
        "o2_selected": o2_best,
        "winner_numeric": winner_numeric,
        "winner_ortho": winner_ortho,
        "status": final_status,
        "summary_rows": rows + [summary_row(k) for k in results if k not in (ref_label, o1_best, o2_best)],
        "results": results,
        "ablations_FA": ablations,
        "double_count_matrix": double_count,
        "case_review": case_review,
        "classical_checklist": checklist,
        "amp_maps": AMP_MAPS,
        "notes": {
            "G_material": "G_CLEAN_AXIS frozen",
            "max_orthodox_candidates": 2,
            "calendar_audit": "V2_CALENDAR_PILLAR_AUDIT.md",
        },
    }
    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    open(OUT_REPORT, "w", encoding="utf-8").write(_write_report(payload))
    open(OUT_ATTR, "w", encoding="utf-8").write(_write_attr(payload))

    print("\n══════════ STATUS ══════════")
    print(final_status)
    print("ref", summary_row(ref_label))
    print("o1", summary_row(o1_best))
    print("o2", summary_row(o2_best))
    print("winner_numeric", winner_numeric, "winner_ortho", winner_ortho)
    print(f"snapshot → {OUT_SNAP}")
    return 0


def _write_report(p: dict) -> str:
    L = []
    L.append("# V2 DY Orthodox Report (Phase 2.5)")
    L.append("")
    L.append(f"**Status:** `{p['status']}`")
    L.append(f"**Measured:** {p['measured_at']}")
    L.append(f"**Numeric backbone:** `{p['winner_numeric']}`")
    L.append(f"**Orthodox selection:** `{p.get('winner_ortho')}`")
    L.append(f"**O1 amp:** `{p['o1_selected']}` · **O2 amp:** `{p['o2_selected']}`")
    L.append("")
    L.append("Validation B sealed. Production engine untouched. Month/Day not built.")
    L.append("")
    L.append("## 1–3. Calendar foundation")
    L.append("")
    L.append("- Consistent enough for D/Y under production-compatible convention (`V2_CALENDAR_PILLAR_AUDIT.md`).")
    L.append("- Disagreement with other services: civil-year sewoon vs 立春; lon-only solar (no EOT); 半時; 조/야자시.")
    L.append("- School-dependent: 立春 year, 節-only 起運, 半時, 早/夜子時, EOT. Month 子/丑 bug deferred to Phase 3.")
    L.append("")
    L.append("## 4. Missing from V2_DY_B")
    L.append("")
    L.append("Adaptive D strength, NatalContext chain, contextual 합충, D×Y, event≠valence, 伏吟/反吟/并临, 月令 efficacy, rooting, 调候, geju/special safety.")
    L.append("")
    L.append("## 5–36. Architecture (see SPEC + ATTRIBUTION)")
    L.append("")
    L.append("- NatalContext from enrich_saju outputs (no new natal calculator).")
    L.append("- 月令 as efficacy modulator; 调候 PARTIAL when johu element known.")
    L.append("- 用/喜/忌 structural activation — not fixed +/−; 相神 uncertain.")
    L.append("- Hidden stems / rooting / exposure in RegimeChangeEvidence.")
    L.append("- Ten gods contextual by strength regime; domain ≠ valence.")
    L.append("- 합/충 contextual vs useful/harmful targets; competing 합+충 damped.")
    L.append("- 合化 not assumed; 墓库 not “open treasury=good”; 神煞 numeric=0.")
    L.append("- D_DIRECTION / D_STRENGTH via evidence; amp maps CONSERVATIVE/BALANCED/EXPRESSIVE.")
    L.append("- D×Y explicit; event intensity separate; repetition flags supported.")
    L.append("")
    L.append("## Metrics (Q20–40)")
    L.append("")
    L.append("| label | FA pw | FA hit | OLD pw | OLD hit | FA ov | FA rescue | FA net | adj p50 | adj p90 | adj max | same-D | cross-D | high-cross | jump10 n | p(high|large) |")
    L.append("|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for r in p["summary_rows"][:9]:
        L.append(
            f"| {r['label']} | {r['FA_pw']} | {r['FA_hit']} | {r['OLD_pw']} | {r['OLD_hit']} | "
            f"{r['FA_override']} | {r['FA_rescue']} | {r['FA_net']} | {r['FA_adj_p50']} | "
            f"{r['FA_adj_p90']} | {r['FA_adj_max']} | {r['FA_same_pw']} | {r['FA_cross_pw']} | "
            f"{r['FA_high_cross_pw']} | {r.get('jump10_n')} | {r.get('jump10_p_high')} |"
        )
    L.append("")
    L.append("## Classical checklist (abbrev)")
    L.append("")
    for k, v in p.get("classical_checklist", {}).items():
        L.append(f"- {k}: **{v}**")
    L.append("")
    L.append("## 41–46. Product freeze questions")
    L.append("")
    L.append("- Traditional completeness improves explanation: YES (RegimeChangeEvidence + contextual roles).")
    L.append(f"- Score vs interpretation: status `{p['status']}` decides numeric adoption.")
    L.append("- School-dependent / backlog: 相神, full 合化, 통관 depth, G redesign, block targets, Month 子丑 fix.")
    L.append("- D/Y permanently frozen only if READY; else B numeric + orthodox interpretation layer.")
    L.append("- Month/Day contract complete enough to proceed next: YES (`V2_MONTH_DAY_CLASSICAL_CONTRACT.md`).")
    L.append("")
    L.append(f"**Final status:** `{p['status']}`")
    L.append("")
    L.append("STOP — do not build Month/Day; do not open Validation B.")
    L.append("")
    return "\n".join(L)


def _write_attr(p: dict) -> str:
    L = []
    L.append("# V2 DY Orthodox Attribution")
    L.append("")
    L.append(f"Status: `{p['status']}`")
    L.append(f"Numeric: `{p['winner_numeric']}` · Orthodox: `{p.get('winner_ortho')}`")
    L.append("")
    L.append("## Double-count matrix")
    L.append("")
    L.append("| family | Natal | D_CORE | D_ORTHO | G | Trigger | D×Y |")
    L.append("|---|---|---|---|---|---|---|")
    for fam, row in p["double_count_matrix"].items():
        L.append(
            f"| {fam} | {row['Natal']} | {row['D_CORE']} | {row['D_ORTHO']} | {row['G']} | {row['SewoonTrigger']} | {row['DxY']} |"
        )
    L.append("")
    L.append("## Ablations (Fresh A)")
    L.append("")
    for k, v in p.get("ablations_FA", {}).items():
        L.append(f"- **{k}**: hit {v.get('hit')} pw {v.get('pairwise_mean')} std {v.get('std_sep')}")
    L.append("")
    L.append("## Case review — large jumps (≥10)")
    L.append("")
    for c in p.get("case_review", [])[:18]:
        L.append(f"### {c['name']}")
        if not c["large_jumps"]:
            L.append("- none")
        for j in c["large_jumps"]:
            L.append(
                f"- {j['pillar']}: Δ={j['jump_from_prev']} strength={j['strength']} "
                f"dir={j['direction']} reasons={j['reasons']}"
            )
        L.append("")
    L.append("## Failure taxonomy")
    L.append("")
    L.append("Aggregate only: LABEL_AMBIGUITY / SEWOON_TRIGGER_FAIL / DAEWOON_STRENGTH_FAIL / SPECIAL_STRUCTURE_UNCERTAIN / RELATION_RESOLUTION_FAIL.")
    L.append("No named subject patches.")
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
