# -*- coding: utf-8 -*-
"""
CONTROL (production candle.close) vs frozen V2_DY_B.

No tuning. No Validation B Control scoring. No life-history use for the pilot.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(os.path.dirname(_HERE))
_ROOT = os.path.dirname(_TEST)
_EXP = os.path.join(_TEST, "experiments")
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _EXP)
sys.path.insert(0, _HERE)

from experiments import arm_control  # noqa: E402
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS  # noqa: E402
from experiments.validate_v2_b_one_shot import (  # noqa: E402
    FROZEN_MODEL_HASH16,
    _r4,
    _score_v2_dy_b,
    collect_integrity_hashes,
    primary_from_subject_raws,
    subject_raw_row,
)
from generate_blind_pilot_engine import (  # noqa: E402
    LIVED_THROUGH,
    SUBJECTS,
    compute_subject,
)

AB_SEED = 20260815
OUT_CMP_MD = os.path.join(_EXP, "CONTROL_V2_DEV_COMPARISON.md")
OUT_CMP_JSON = os.path.join(_EXP, "CONTROL_V2_DEV_COMPARISON.json")
OUT_MAP = os.path.join(_HERE, "BLIND_PILOT_AB_MAPPING.json")
OUT_Q = os.path.join(_HERE, "BLIND_PILOT_AB_QUESTIONS.md")
VAL_B_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_validation_b.json")


def _metrics(packs: List[dict], score_maps: List[dict]) -> Dict[str, Any]:
    rows, all_s = [], []
    for pack, smap in zip(packs, score_maps):
        good = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in smap]
        bad = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in smap]
        gs = [float(smap[int(e["year"])]) for e in good]
        bs = [float(smap[int(e["year"])]) for e in bad]
        all_s.extend(float(v) for v in smap.values())
        row = subject_raw_row(pack["name"], gs, bs)
        if row:
            rows.append(row)
    prim = primary_from_subject_raws(rows, all_s)
    prim.pop("status", None)
    prim.pop("bootstrap", None)
    return {
        "n": prim["n"],
        "macro_pairwise": prim["macro_pairwise_raw"],
        "subject_hit": f"{prim['n_hit']}/{prim['n']}",
        "subject_hit_n": prim["n_hit"],
        "std_sep": prim["std_sep_raw"],
        "median_sep": prim["median_sep_raw"],
        "mean_sep": prim["mean_sep_raw"],
        "positive": prim["positive"],
        "neutral": prim["neutral"],
        "negative": prim["negative"],
    }


def _control_maps(packs: List[dict]) -> List[dict]:
    maps = []
    for pack in packs:
        smap = {}
        for y, m in pack["meta"].items():
            smap[int(y)] = float(arm_control.year_score_from_meta(m))
        maps.append(smap)
    return maps


def _headline(m: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "n": m["n"],
        "macro_pairwise": _r4(m["macro_pairwise"]),
        "subject_hit": m["subject_hit"],
        "std_sep": _r4(m["std_sep"]),
        "median_sep": _r4(m["median_sep"]),
        "positive": m["positive"],
        "negative": m["negative"],
        "neutral": m["neutral"],
    }


def _delta(v2: Dict[str, Any], ctrl: Dict[str, Any]) -> Dict[str, Any]:
    def sub(a, b):
        if a is None or b is None:
            return None
        return float(a) - float(b)
    return {
        "macro_pairwise": sub(v2["macro_pairwise"], ctrl["macro_pairwise"]),
        "subject_hit_n": v2["subject_hit_n"] - ctrl["subject_hit_n"],
        "std_sep": sub(v2["std_sep"], ctrl["std_sep"]),
        "median_sep": sub(v2["median_sep"], ctrl["median_sep"]),
        "positive": v2["positive"] - ctrl["positive"],
        "negative": v2["negative"] - ctrl["negative"],
    }


def _assign_ab(ids: List[str]) -> Dict[str, Dict[str, str]]:
    rng = np.random.default_rng(AB_SEED)
    flags = [True, True, False, False]
    rng.shuffle(flags)
    out = {}
    for pid, ctrl_is_a in zip(ids, flags):
        if ctrl_is_a:
            out[pid] = {"A": "CONTROL", "B": "V2_DY_B"}
        else:
            out[pid] = {"A": "V2_DY_B", "B": "CONTROL"}
    return out


def _chart_md(pid: str, label: str, civil: str, natal: List[str], blocks: List[dict], years: List[dict]) -> str:
    lines = [
        f"# {pid} — Chart {label}",
        "",
        f"Birth (solar, KST): `{civil}`",
        "",
        f"Natal: {' / '.join(natal)}",
        "",
        "## Daewoon",
        "",
        "| pillar | start_year | end_year (exclusive) | age_start | age_end | block |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for b in blocks:
        if b["start_year"] > LIVED_THROUGH:
            continue
        lines.append(
            f"| {b['pillar']} | {b['start_year']} | {b['end_year']} | "
            f"{b['age_start']:.1f} | {b['age_end']:.1f} | {_r4(b['block'])} |"
        )
    lines += [
        "",
        f"## Annual scores ({years[0]['year']}–{LIVED_THROUGH})",
        "",
        "| year | age | daewoon | sewoon | block | year_score |",
        "|---:|---:|---|---|---:|---:|",
    ]
    for r in years:
        lines.append(
            f"| {r['year']} | {r['age']} | {r['daewoon']} | {r['sewoon']} | "
            f"{_r4(r['block'])} | {_r4(r['year_score'])} |"
        )
    lines.append("")
    return "\n".join(lines)


def _cover_md(pid: str, civil: str, natal: List[str]) -> str:
    return "\n".join([
        f"# {pid}",
        "",
        f"Birth (solar, KST): `{civil}`",
        "",
        f"Natal: {' / '.join(natal)}",
        "",
        "Write your own good periods, difficult periods, and turning points **before** opening either chart.",
        "",
        "Then open, in any order:",
        "",
        f"- `{pid}_chart_A.md`",
        f"- `{pid}_chart_B.md`",
        "",
        "Answer the questions in `BLIND_PILOT_AB_QUESTIONS.md`.",
        "",
        "Neither chart is labeled with a model name.",
        "",
    ])


def main() -> int:
    print("══════════ CONTROL vs V2_DY_B ══════════")
    hashes = collect_integrity_hashes()
    dy16 = hashes["experiment_v2_dy.py"]["sha256_16"]
    if dy16 != FROZEN_MODEL_HASH16["experiment_v2_dy.py"]:
        print("REFUSE: V2_DY_B source hash drifted")
        return 1

    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old_packs, fresh_packs, val_b = DY._load_pools(freeze)
    if any(p["name"] in val_b for p in old_packs + fresh_packs):
        print("REFUSE: Validation B leaked into development packs")
        return 1
    print(f"  OLD={len(old_packs)} FA={len(fresh_packs)} (B not packed)")

    dev = old_packs + fresh_packs
    layers_list, v2_maps, z_params = _score_v2_dy_b(dev, dev)
    ctrl_maps = _control_maps(dev)

    idx_old = list(range(len(old_packs)))
    idx_fa = list(range(len(old_packs), len(dev)))
    pools = {}
    for name, idx in (("OLD_DEV", idx_old), ("FRESH_A", idx_fa)):
        packs = [dev[i] for i in idx]
        v2 = _metrics(packs, [v2_maps[i] for i in idx])
        ctrl = _metrics(packs, [ctrl_maps[i] for i in idx])
        pools[name] = {
            "CONTROL": ctrl,
            "V2_DY_B": v2,
            "delta_V2_minus_CONTROL": _delta(v2, ctrl),
        }
        print(
            f"  {name} CTRL pw={_r4(ctrl['macro_pairwise'])} hit={ctrl['subject_hit']} "
            f"V2 pw={_r4(v2['macro_pairwise'])} hit={v2['subject_hit']}"
        )

    # ── 4-person pilot: both timelines, blinded A/B ──
    ids = [s["id"] for s in SUBJECTS]
    mapping = _assign_ab(ids)
    computed = [compute_subject(s) for s in SUBJECTS]
    holdout = [c["pack"] for c in computed]
    p_layers, p_v2_maps, _ = _score_v2_dy_b(dev, holdout)

    pilot_internal = {}
    for c, layers, v2map in zip(computed, p_layers, p_v2_maps):
        pid = c["spec"]["id"]
        by = c["birth_year"]
        meta = c["pack"]["meta"]
        dw = c["dw"]
        lived_years = [y for y in sorted(v2map) if by <= int(y) <= LIVED_THROUGH]

        v2_blocks, ctrl_blocks = [], []
        for blk in dw:
            pillar = blk["daewoon_pillar"]
            d_b = None
            for y in lived_years:
                if layers[int(y)]["pillar"] == pillar:
                    d_b = float(layers[int(y)]["D"])
                    break
            v2_blocks.append({
                "pillar": pillar,
                "start_year": int(blk["start_year"]),
                "end_year": int(blk["end_year"]),
                "age_start": float(blk["start_age_years"]),
                "age_end": float(blk["end_age_years"]),
                "block": d_b,
            })
            ctrl_blocks.append({
                "pillar": pillar,
                "start_year": int(blk["start_year"]),
                "end_year": int(blk["end_year"]),
                "age_start": float(blk["start_age_years"]),
                "age_end": float(blk["end_age_years"]),
                "block": float(blk["종합운점수"]),
            })

        v2_years, ctrl_years = [], []
        for y in lived_years:
            y = int(y)
            m = meta[y]
            L = layers[y]
            v2_years.append({
                "year": y, "age": y - by,
                "daewoon": L["pillar"], "sewoon": m.get("세운_pillar"),
                "block": float(L["D"]), "year_score": float(L["Y"]),
            })
            ctrl_years.append({
                "year": y, "age": y - by,
                "daewoon": m.get("대운_pillar"), "sewoon": m.get("세운_pillar"),
                "block": float((m.get("candle") or {}).get("open") or blk_open(m)),
                "year_score": float(arm_control.year_score_from_meta(m)),
            })

        model_charts = {
            "CONTROL": (ctrl_blocks, ctrl_years),
            "V2_DY_B": (v2_blocks, v2_years),
        }
        ab = mapping[pid]
        for label in ("A", "B"):
            model = ab[label]
            blocks, years = model_charts[model]
            text = _chart_md(pid, label, c["civil_kst"], c["natal"], blocks, years)
            with open(os.path.join(_HERE, f"{pid}_chart_{label}.md"), "w", encoding="utf-8") as f:
                f.write(text)
        with open(os.path.join(_HERE, f"{pid}_chart_only.md"), "w", encoding="utf-8") as f:
            f.write(_cover_md(pid, c["civil_kst"], c["natal"]))

        iq_path = os.path.join(_HERE, f"{pid}_internal_qa.json")
        iq = json.load(open(iq_path, encoding="utf-8"))
        iq["F_ab_placeholders"] = {
            "which_overall_flow": None,
            "which_good_periods": None,
            "which_difficult_periods": None,
            "which_turning_points": None,
            "fit_rating_A": None,
            "fit_rating_B": None,
            "brief_reason": None,
        }
        iq["ab_model_names_hidden_from_participant"] = True
        with open(iq_path, "w", encoding="utf-8") as f:
            json.dump(iq, f, ensure_ascii=False, indent=2)
            f.write("\n")

        expl_path = os.path.join(_HERE, f"{pid}_explanation.md")
        expl = open(expl_path, encoding="utf-8").read()
        if "Do not show during Chart A/B" not in expl:
            expl = (
                "Do not show during Chart A/B comparison. "
                "This file is V2 explanation-only and would unblind the pair.\n\n"
                + expl
            )
            with open(expl_path, "w", encoding="utf-8") as f:
                f.write(expl)

        pilot_internal[pid] = {
            "A_is": ab["A"],
            "B_is": ab["B"],
            "n_lived_years": len(lived_years),
        }
        print(f"  {pid} A/B written (models stored only in mapping)")

    map_payload = {
        "purpose": "internal unblinding only — do not show to participants",
        "seed": AB_SEED,
        "assignment": "balanced_shuffle_2_CONTROL_as_A_and_2_V2_as_A",
        "CONTROL_definition": "production engine candle.close (arm_control)",
        "V2_definition": "frozen V2_DY_B",
        "participants": mapping,
        "reveal_after_all_responses": True,
    }
    with open(OUT_MAP, "w", encoding="utf-8") as f:
        json.dump(map_payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    questions = """# Blind Chart A / Chart B questions

Ask only after the participant has already written:

- good periods
- difficult periods
- turning points

Then show Chart A and Chart B (same layout, no model names).

1. Which chart better matches your overall life flow? A / B / similar
2. Which better matches good periods? A / B / similar
3. Which better matches difficult periods? A / B / similar
4. Which better captures major turning points? A / B / similar
5. Fit rating for Chart A (1–5)
6. Fit rating for Chart B (1–5)
7. Brief reason

Do not tell the participant which chart is Control or V2.
Do not aggregate n=4 into an accuracy claim.
"""
    with open(OUT_Q, "w", encoding="utf-8") as f:
        f.write(questions)

    val_b = None
    if os.path.exists(VAL_B_SNAP):
        snap = json.load(open(VAL_B_SNAP, encoding="utf-8"))
        val_b = {
            "status": snap.get("status"),
            "n_eligible": snap.get("n_eligible"),
            "primary": snap.get("primary"),
            "control_scored": False,
            "note": "Consumed V2-only holdout. Control was not scored on Validation B.",
        }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "control_definition": "production engine yearly candle.close (arm_control.year_score_from_meta)",
        "v2_definition": "frozen V2_DY_B; z from OLD_DEV+Fresh A only",
        "not_legacy_b9": True,
        "validation_b_control_scored": False,
        "tuning_performed": False,
        "v2_hash16": dy16,
        "DEVELOPMENT_COMPARISON": {
            k: {
                "CONTROL": _headline(v["CONTROL"]),
                "V2_DY_B": _headline(v["V2_DY_B"]),
                "delta_V2_minus_CONTROL": {
                    kk: _r4(vv) if isinstance(vv, float) else vv
                    for kk, vv in v["delta_V2_minus_CONTROL"].items()
                },
            }
            for k, v in pools.items()
        },
        "NEW_BLIND_USER_PILOT": {
            "n": 4,
            "kind": "BLIND_USER_QA_PILOT",
            "not": ["VALIDATION", "ACCURACY_ESTIMATE", "STATISTICAL_EVIDENCE"],
            "charts": "anonymous Chart A / Chart B per participant",
            "mapping_path": "test/blind_qa/pilot_4/BLIND_PILOT_AB_MAPPING.json",
            "participant_ids": ids,
        },
        "CONSUMED_HOLDOUT": val_b,
        "raw_dev": {
            k: {
                "CONTROL": v["CONTROL"],
                "V2_DY_B": v["V2_DY_B"],
                "delta_V2_minus_CONTROL": v["delta_V2_minus_CONTROL"],
            }
            for k, v in pools.items()
        },
    }
    with open(OUT_CMP_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    def row(name, m):
        return (
            f"| {name} | {m['macro_pairwise']} | {m['subject_hit']} | "
            f"{m['std_sep']} | {m['median_sep']} | {m['positive']} | {m['negative']} |"
        )

    md = [
        "# CONTROL vs V2_DY_B",
        "",
        "No tuning. Control is production `candle.close`, not LEGACY_B9.",
        "",
        "---",
        "",
        "## DEVELOPMENT COMPARISON",
        "",
        "Pools: OLD_DEV (`yongshin_subjects`) and Fresh Validation A only.",
        "",
    ]
    for pool in ("OLD_DEV", "FRESH_A"):
        d = payload["DEVELOPMENT_COMPARISON"][pool]
        md += [
            f"### {pool}",
            "",
            "| model | macro pairwise | subject hit | std sep | median sep | positive | negative |",
            "|---|---:|---:|---:|---:|---:|---:|",
            row("CONTROL", d["CONTROL"]),
            row("V2_DY_B", d["V2_DY_B"]),
            (
                f"| delta (V2 − CONTROL) | {_r4(d['delta_V2_minus_CONTROL']['macro_pairwise'])} | "
                f"{d['delta_V2_minus_CONTROL']['subject_hit_n']:+d} hits | "
                f"{_r4(d['delta_V2_minus_CONTROL']['std_sep'])} | "
                f"{_r4(d['delta_V2_minus_CONTROL']['median_sep'])} | "
                f"{d['delta_V2_minus_CONTROL']['positive']:+d} | "
                f"{d['delta_V2_minus_CONTROL']['negative']:+d} |"
            ),
            "",
        ]
    md += [
        "These development numbers are not a reason to retune.",
        "",
        "---",
        "",
        "## NEW BLIND USER PILOT",
        "",
        "n=4 acquaintances. `BLIND_USER_QA_PILOT` — not validation, not an accuracy estimate.",
        "",
        "Each participant gets anonymous Chart A and Chart B (Control and V2_DY_B, randomly assigned, 2/2 balanced).",
        "Mapping is in `test/blind_qa/pilot_4/BLIND_PILOT_AB_MAPPING.json` (internal only).",
        "",
        "Do not aggregate n=4 into a model-accuracy claim.",
        "",
        "---",
        "",
        "## CONSUMED HOLDOUT",
        "",
        "Validation B is consumed and remains **V2-only**. Control was not scored on B.",
        "",
    ]
    if val_b:
        p = val_b.get("primary") or {}
        md += [
            f"V2 one-shot status: `{val_b.get('status')}` (n={val_b.get('n_eligible')}).",
            f"V2 macro pairwise {p.get('macro_pairwise')}; subject hit {p.get('subject_hit')}; "
            f"std sep {p.get('std_sep')}; median sep {p.get('median_sep')}.",
            "",
        ]
    md += [
        "---",
        "",
        f"V2 hash `experiment_v2_dy.py` `{dy16}` unchanged.",
        "",
    ]
    with open(OUT_CMP_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    print("══════════ WROTE ══════════")
    print(OUT_CMP_MD)
    print(OUT_CMP_JSON)
    print(OUT_MAP)
    return 0


def blk_open(m: dict) -> float:
    return float((m.get("candle") or {}).get("open") or 50.0)


if __name__ == "__main__":
    sys.exit(main())
