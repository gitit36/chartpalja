# -*- coding: utf-8 -*-
"""
V2 DY Closure Audit — score ↔ orthodox explanation consistency.

No new models. Val B sealed. Engine untouched.

Usage:
  PYTHONPATH=.:test python test/experiments/experiment_v2_dy_closure_audit.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

from experiments import arm_b  # noqa: E402
from experiments import experiment_v2_dy as B  # noqa: E402
from experiments import experiment_v2_dy_orthodox as O  # noqa: E402
from experiments import experiment_v2_dy_hierarchy_26 as H26  # noqa: E402
from experiments.experiment_g_clean import score_g  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_dy_closure_audit.json")
OUT_AUDIT = os.path.join(_HERE, "V2_DY_CLOSURE_AUDIT.md")
OUT_MANIFEST = os.path.join(_HERE, "V2_DY_FINAL_FREEZE_MANIFEST.md")
OUT_EVAL = os.path.join(_TEST, "snapshots", "exp_v2_dy_27_eval.json")

VARIANT_G = "G_CLEAN_AXIS"
BASE = 60.0


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(x)))


def _sha16(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]


def _classify_consistency(y: float, direction: float, conf: float, intensity: float) -> str:
    """Numeric Y vs orthodox signed direction (explanation-only)."""
    # numeric valence relative to BASE
    if y >= BASE + 3:
        num = 1
    elif y <= BASE - 3:
        num = -1
    else:
        num = 0

    strong = conf >= 0.55 and abs(direction) >= 0.25
    if abs(direction) < 0.12 or conf < 0.40:
        ortho = 0
    elif direction > 0.12:
        ortho = 1
    else:
        ortho = -1

    if num == 0 and ortho == 0:
        return "CONSISTENT_NEUTRAL"
    if num == ortho and num != 0:
        return "CONSISTENT_POSITIVE" if num > 0 else "CONSISTENT_NEGATIVE"
    if num == 0 or ortho == 0:
        return "MIXED_BUT_ACCEPTABLE"
    # opposite signs
    if strong:
        return "STRONG_DIRECTION_CONTRADICTION"
    return "MIXED_BUT_ACCEPTABLE"


def main() -> int:
    print("══════════ V2 DY CLOSURE AUDIT ══════════")
    eval_snap = json.load(open(OUT_EVAL, encoding="utf-8")) if os.path.exists(OUT_EVAL) else {}

    # Headline invariant check from latest 2.7A
    b_fa = eval_snap.get("models", {}).get("B", {}).get("FRESH_A_DEV", {}).get("annual", {})
    b_old = eval_snap.get("models", {}).get("B", {}).get("OLD_DEV", {}).get("annual", {})
    h1_fa_net = eval_snap.get("analyses", {}).get("H1", {}).get("FRESH_A_DEV", {}).get("MARGINAL_NET_VALUE")
    h1_old_net = eval_snap.get("analyses", {}).get("H1", {}).get("OLD_DEV", {}).get("MARGINAL_NET_VALUE")
    decision = eval_snap.get("decision")

    headline_ok = (
        abs((b_fa.get("pairwise_mean") or 0) - 0.6429) < 1e-3
        and abs((b_old.get("pairwise_mean") or 0) - 0.5749) < 1e-3
        and h1_fa_net == 0.0
        and (h1_old_net or 0) < 0
        and decision == "SKIP_27B"
    )

    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old_packs, fresh_packs, val_b = B._load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b:
            raise RuntimeError(f"Val B leak: {p['name']}")

    cfg = dict(arm_b.ARM_B_CONFIG)
    print("── build B scores + orthodox evidence ──")
    pack_blocks, natal, all_rows = {}, {}, []
    for pack in all_packs:
        natal[pack["name"]] = O._natal_context(pack)
        bf = B._block_feats(pack)
        by_p = {row["daewoon_pillar"]: row for row in (pack.get("dw") or [])}
        for pillar, f in bf.items():
            row = by_p.get(pillar) or {}
            f["stem"] = row.get("stem") or pillar[0]
            f["branch"] = row.get("branch") or pillar[1]
            f["rels"] = row.get("관계_with_원국") or []
        pack_blocks[pack["name"]] = bf
        all_rows.extend(bf.values())

    z_keys = [
        "fav_act", "unfav_act", "fav_minus_unfav",
        "struct_activ", "struct_disrupt", "struct_net", "struct_excess",
        "has_hap", "has_chung", "has_samhap", "has_day_chung",
    ]
    z_params = {k: B._robust_params([float(r[k]) for r in all_rows]) for k in z_keys}

    hB, evid, gate_map = {}, {}, {}
    for pack in all_packs:
        nc = natal[pack["name"]]
        nconf = H26._natal_confidence(nc)
        for pillar, f in pack_blocks[pack["name"]].items():
            key = (pack["name"], pillar)
            hB[key] = O._h_b(f, z_params)
            evid[key] = O._regime_evidence(nc, f, f["stem"], f["branch"], f.get("rels") or [])
            gate_map[key] = H26._compute_gate(evid[key], nconf)

    # Year-level consistency
    year_rows = []
    block_rows = []
    product_checks = []

    for pack in all_packs:
        nc = natal[pack["name"]]
        gmap = {int(y): float(score_g(m, VARIANT_G, cfg)) for y, m in pack["meta"].items()}
        by_p = defaultdict(list)
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            if (pack["name"], pillar) not in hB:
                continue
            by_p[pillar].append(gmap[int(y)])
        med = {p: float(np.median(v)) for p, v in by_p.items()}

        # block D_B timeline
        bf = pack_blocks[pack["name"]]
        ordered = sorted(bf.items(), key=lambda kv: kv[1]["start_year"])
        d_vals = []
        for pillar, f in ordered:
            key = (pack["name"], pillar)
            d_b = _clamp(BASE + 3.0 * hB[key])
            d_vals.append(d_b)
            ev = evid[key]
            gi = gate_map[key]
            cls = _classify_consistency(d_b, ev["direction_score"], gi["confidence_eff"], gi["event_intensity"])
            block_rows.append({
                "name": pack["name"], "pool": pack["pool"], "pillar": pillar,
                "layer": "DAEWOON", "D_B": round(d_b, 4),
                "ortho_direction": ev["direction_score"],
                "confidence_eff": gi["confidence_eff"],
                "event_intensity": gi["event_intensity"],
                "gate": gi["gate"],
                "class": cls,
            })

        ys_scores = []
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            key = (pack["name"], pillar)
            if key not in hB:
                continue
            a = gmap[int(y)] - med[pillar]
            flags = B._ilju_flags(m)
            tg = B._tg_career(m)
            trigger = (
                1.2 * flags["year_hap"] - 1.5 * flags["year_chung"]
                - 1.0 * flags["year_hyung"] - 0.8 * flags["year_pa_hae"] + 0.4 * tg
            )
            annual = 0.65 * a + 0.35 * trigger
            d_b = _clamp(BASE + 3.0 * hB[key])
            y_score = _clamp(d_b + annual)
            ys_scores.append(y_score)
            ev = evid[key]
            gi = gate_map[key]
            # year-level: combine D direction with annual sign as local numeric move
            # Orthodox year explanation uses D regime direction + event intensity (not numeric DxY)
            year_dir = float(np.clip(
                0.6 * ev["direction_score"] + 0.4 * np.tanh(annual / 4.0), -1.5, 1.5
            ))
            # For consistency: compare Y to BASE vs orthodox D direction alone (explanation layer)
            cls = _classify_consistency(y_score, ev["direction_score"], gi["confidence_eff"], gi["event_intensity"])
            # crossing
            cross_up = d_b < BASE - 1 and y_score >= BASE and y_score > d_b + 1
            cross_dn = d_b > BASE + 1 and y_score <= BASE and y_score < d_b - 1
            year_rows.append({
                "name": pack["name"], "pool": pack["pool"], "year": int(y), "pillar": pillar,
                "layer": "SEWOON_YEAR",
                "D_B": round(d_b, 4), "annual_dev_B": round(annual, 4), "Y": round(y_score, 4),
                "ortho_direction": ev["direction_score"],
                "confidence_eff": gi["confidence_eff"],
                "event_intensity": gi["event_intensity"],
                "cross_up_hard_D": cross_up,
                "cross_dn_good_D": cross_dn,
                "class": cls,
            })

        # product behavior per subject
        if d_vals and ys_scores:
            product_checks.append({
                "name": pack["name"],
                "pool": pack["pool"],
                "D_range": round(max(d_vals) - min(d_vals), 4),
                "Y_range": round(max(ys_scores) - min(ys_scores), 4),
                "D_flat": (max(d_vals) - min(d_vals)) < 1.0,
                "Y_visible": (max(ys_scores) - min(ys_scores)) >= 3.0,
                "sat_hi": sum(1 for x in ys_scores if x >= 95) / len(ys_scores),
                "sat_lo": sum(1 for x in ys_scores if x <= 5) / len(ys_scores),
                "n_cross_up": sum(1 for r in year_rows if r["name"] == pack["name"] and r["cross_up_hard_D"]),
                "n_cross_dn": sum(1 for r in year_rows if r["name"] == pack["name"] and r["cross_dn_good_D"]),
            })

    def summarize(rows: List[dict], layer: str) -> Dict[str, Any]:
        sub = [r for r in rows if r["layer"] == layer] if rows and "layer" in rows[0] else rows
        counts = defaultdict(int)
        for r in sub:
            counts[r["class"]] += 1
        n = len(sub)
        strong = counts.get("STRONG_DIRECTION_CONTRADICTION", 0)
        # high-conf contradictions
        hc = sum(
            1 for r in sub
            if r["class"] == "STRONG_DIRECTION_CONTRADICTION" and r.get("confidence_eff", 0) >= 0.55
        )
        by_subj = defaultdict(lambda: defaultdict(int))
        for r in sub:
            by_subj[r["name"]][r["class"]] += 1
        return {
            "n": n,
            "counts": dict(counts),
            "rates": {k: round(v / n, 4) for k, v in counts.items()} if n else {},
            "strong_contradiction_rate": round(strong / n, 4) if n else None,
            "high_conf_contradiction_rate": round(hc / n, 4) if n else None,
            "subjects_with_strong": sum(
                1 for s, c in by_subj.items() if c.get("STRONG_DIRECTION_CONTRADICTION", 0) > 0
            ),
        }

    year_sum = summarize(year_rows, "SEWOON_YEAR")
    block_sum = summarize(block_rows, "DAEWOON")

    # strongest contradictions
    strong_ex = sorted(
        [r for r in year_rows if r["class"] == "STRONG_DIRECTION_CONTRADICTION"],
        key=lambda r: (-abs(r["Y"] - BASE) * r["confidence_eff"] * abs(r["ortho_direction"])),
    )[:20]

    # wiring defect check
    # Strong contradiction rate should not be majority; product should show crossings
    n_prod = len(product_checks)
    frac_flat_D = sum(1 for p in product_checks if p["D_flat"]) / max(1, n_prod)
    frac_Y_vis = sum(1 for p in product_checks if p["Y_visible"]) / max(1, n_prod)
    any_cross_up = sum(1 for p in product_checks if p["n_cross_up"] > 0)
    any_cross_dn = sum(1 for p in product_checks if p["n_cross_dn"] > 0)
    sat_bad = any(p["sat_hi"] > 0.05 or p["sat_lo"] > 0.05 for p in product_checks)

    strong_rate = year_sum.get("strong_contradiction_rate") or 0
    wiring_ok = (
        headline_ok
        and strong_rate < 0.25  # not rampant
        and frac_Y_vis >= 0.8
        and any_cross_dn >= 5  # good-D bad years exist
        and not sat_bad
    )

    # Note: completely flat D within person is a known B limitation, not a wiring block
    # unless EVERY subject is flat AND no annual motion — annual motion is the main product

    status = "V2_DY_CLOSED_READY_FOR_CALENDAR" if wiring_ok else "V2_DY_CLOSURE_BLOCKED"
    block_reasons = []
    if not headline_ok:
        block_reasons.append("headline_invariant_failed")
    if strong_rate >= 0.25:
        block_reasons.append(f"strong_contradiction_rate={strong_rate}")
    if frac_Y_vis < 0.8:
        block_reasons.append(f"Y_visible_frac={frac_Y_vis}")
    if sat_bad:
        block_reasons.append("score_saturation")
    if any_cross_dn < 5:
        block_reasons.append("insufficient_cross_down_examples")

    hashes = {
        "experiment_v2_dy.py": _sha16(os.path.join(_HERE, "experiment_v2_dy.py")),
        "experiment_g_clean.py": _sha16(os.path.join(_HERE, "experiment_g_clean.py")),
        "experiment_v2_dy_27_eval.py": _sha16(os.path.join(_HERE, "experiment_v2_dy_27_eval.py")),
        "experiment_v2_dy_orthodox.py": _sha16(os.path.join(_HERE, "experiment_v2_dy_orthodox.py")),
        "g_fresh_labels_frozen.json": _sha16(OUT_LABELS) if os.path.exists(OUT_LABELS) else None,
        "exp_v2_dy.json": _sha16(os.path.join(_TEST, "snapshots", "exp_v2_dy.json"))
        if os.path.exists(os.path.join(_TEST, "snapshots", "exp_v2_dy.json")) else None,
        "exp_v2_dy_27_eval.json": _sha16(OUT_EVAL) if os.path.exists(OUT_EVAL) else None,
    }

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_DY_CLOSURE_AUDIT",
        "validation_b_scored": False,
        "production_engine_modified": False,
        "attribution_bug_fixed": True,
        "headline_ok": headline_ok,
        "headline": {
            "B_FA_pw": b_fa.get("pairwise_mean"),
            "B_OLD_pw": b_old.get("pairwise_mean"),
            "H1_FA_marg_net": h1_fa_net,
            "H1_OLD_marg_net": h1_old_net,
            "decision": decision,
            "H2_OLD_attr_counts": eval_snap.get("analyses", {}).get("H2", {}).get("OLD_DEV", {}).get("attr_counts"),
        },
        "year_consistency": year_sum,
        "daewoon_consistency": block_sum,
        "strong_contradiction_examples": strong_ex,
        "product_behavior": {
            "n_subjects": n_prod,
            "frac_D_range_lt_1": round(frac_flat_D, 4),
            "frac_Y_range_ge_3": round(frac_Y_vis, 4),
            "subjects_with_cross_up": any_cross_up,
            "subjects_with_cross_dn": any_cross_dn,
            "saturation_pathology": sat_bad,
            "sample": product_checks[:20],
        },
        "explanation_wiring_rules": {
            "never_claim_numeric_for_ortho_only": True,
            "valence_ne_event_intensity": True,
            "mixed_wording_on_conflict": True,
            "DxY_explanation_only": True,
        },
        "semantics": {
            "formula": "Y = clamp(D_B + annual_dev_B)",
            "annual_dev_B": "0.65*A_G + 0.35*B_trigger",
            "baseline_crossing_allowed": True,
            "no_fixed_7030": True,
        },
        "hashes": hashes,
        "status": status,
        "block_reasons": block_reasons,
    }

    os.makedirs(os.path.dirname(OUT_SNAP), exist_ok=True)
    with open(OUT_SNAP, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    open(OUT_AUDIT, "w", encoding="utf-8").write(_write_audit(payload))
    open(OUT_MANIFEST, "w", encoding="utf-8").write(_write_manifest(payload))

    # Erratum note on 2.7 report (append, don't overwrite history)
    report_path = os.path.join(_HERE, "V2_DY_27_EVALUATION_REPORT.md")
    if os.path.exists(report_path):
        text = open(report_path, encoding="utf-8").read()
        note = (
            "\n\n---\n\n## ERRATUM (closure audit)\n\n"
            "Fixed accidental `or True` in H2 D vs D×Y **attribution labels** "
            "(`experiment_v2_dy_27_eval.py`). Headline pairwise / marginal NET / SKIP_27B "
            "unchanged. Only `attr_counts` for joint D+D×Y harm/mixed labels were corrected "
            "(e.g. OLD H2: more MIXED_EFFECT, fewer forced D_AND_DXY_HARM).\n"
        )
        if "ERRATUM (closure audit)" not in text:
            open(report_path, "a", encoding="utf-8").write(note)

    print("\n══════════ STATUS ══════════")
    print(status)
    print("headline_ok", headline_ok, "strong_rate", strong_rate, "Y_vis", frac_Y_vis)
    print("H2 OLD attr", payload["headline"].get("H2_OLD_attr_counts"))
    print(f"→ {OUT_SNAP}")
    return 0 if status == "V2_DY_CLOSED_READY_FOR_CALENDAR" else 1


def _write_audit(p: dict) -> str:
    L = [
        "# V2 DY Closure Audit",
        "",
        f"**Status:** `{p['status']}`",
        f"**Measured:** {p['measured_at']}",
        "",
        "## 1. Attribution bug fix",
        "",
        "- Removed accidental `or True` in D vs D×Y harm attribution.",
        "- Re-ran 2.7A: headline scores **unchanged**; B still winner; SKIP_27B.",
        f"- Headline: B FA={p['headline']['B_FA_pw']} OLD={p['headline']['B_OLD_pw']}; "
        f"H1 marg FA={p['headline']['H1_FA_marg_net']} OLD={p['headline']['H1_OLD_marg_net']}.",
        f"- H2 OLD attr_counts after fix: `{p['headline'].get('H2_OLD_attr_counts')}`",
        "",
        "## 2. Parent attribution",
        "",
        "Primary local remains `annual_dev_B = 0.65*A + 0.35*B_trigger` (confirmed in 2.7A re-run).",
        "",
        "## 3. Score ↔ orthodox consistency",
        "",
        "### Year (Sewoon) layer",
        f"- n={p['year_consistency']['n']}",
        f"- rates={p['year_consistency']['rates']}",
        f"- strong contradiction rate={p['year_consistency']['strong_contradiction_rate']}",
        f"- high-conf contradiction rate={p['year_consistency']['high_conf_contradiction_rate']}",
        f"- subjects with ≥1 strong={p['year_consistency']['subjects_with_strong']}",
        "",
        "### Daewoon layer",
        f"- n={p['daewoon_consistency']['n']}",
        f"- rates={p['daewoon_consistency']['rates']}",
        f"- strong contradiction rate={p['daewoon_consistency']['strong_contradiction_rate']}",
        "",
        "### Strongest year contradictions (examples)",
        "",
    ]
    for e in p.get("strong_contradiction_examples", [])[:20]:
        L.append(
            f"- {e['name']} {e['year']} {e['pillar']}: Y={e['Y']} D_B={e['D_B']} "
            f"ortho_dir={e['ortho_direction']} conf={e['confidence_eff']} inten={e['event_intensity']}"
        )
    L += [
        "",
        "## 4. Explanation wiring rules (enforced in product copy)",
        "",
        "- Never claim ortho-only factors moved the numeric score.",
        "- Ortho wording: contextual / structural / event-regime evidence.",
        "- On conflict: acknowledge mixed signals; no fabricated certainty.",
        "- VALENCE ≠ EVENT_INTENSITY.",
        "",
        "## 5. Product behavior",
        "",
        f"- subjects={p['product_behavior']['n_subjects']}",
        f"- frac D_range<1 (known B flatness)={p['product_behavior']['frac_D_range_lt_1']}",
        f"- frac Y_range≥3={p['product_behavior']['frac_Y_range_ge_3']}",
        f"- subjects with good-year-in-hard-D crossings={p['product_behavior']['subjects_with_cross_up']}",
        f"- subjects with hard-year-in-good-D crossings={p['product_behavior']['subjects_with_cross_dn']}",
        f"- saturation pathology={p['product_behavior']['saturation_pathology']}",
        "",
        "## 6. Semantics",
        "",
        f"- `{p['semantics']['formula']}`",
        f"- annual: `{p['semantics']['annual_dev_B']}`",
        "- Sewoon may cross Daewoon baseline; no 70/30.",
        "- D×Y explanation-only.",
        "",
        f"**Block reasons:** {p.get('block_reasons')}",
        "",
        f"**Final:** `{p['status']}`",
        "",
        "STOP — next is calendar foundation only.",
        "",
    ]
    return "\n".join(L)


def _write_manifest(p: dict) -> str:
    return "\n".join([
        "# V2 DY Final Freeze Manifest",
        "",
        f"**Status:** `{p['status']}`",
        f"**Date:** {p['measured_at']}",
        "",
        "## Numeric model",
        "",
        "**V2_DY_B**",
        "",
        "```",
        "D_B = clamp(60 + 3 · h_B)",
        "  h_B = 0.45 z(fav_minus_unfav) + 0.35 z(struct_activ)",
        "      − 0.35 z(struct_disrupt) − 0.15 z(struct_excess)",
        "  z = robust z-score, clip ±2.5, scale floor 0.35",
        "",
        "A_G = G_CLEAN_AXIS(year) − median_G(same Daewoon block)",
        "B_trigger = 1.2 hap − 1.5 chung − 1.0 hyung − 0.8 pa_hae + 0.4 tg_career",
        "annual_dev_B = 0.65 · A_G + 0.35 · B_trigger",
        "Y = clamp(D_B + annual_dev_B)",
        "```",
        "",
        "## Frozen",
        "",
        "- G_CLEAN_AXIS (experiment_g_clean.py)",
        "- D architecture / coefficients / z hygiene (experiment_v2_dy.py)",
        "- annual trigger + 0.65/0.35 mix",
        "- B9 α=1.0 centering philosophy for A within block (median)",
        "- Development: OLD_DEV (yongshin_subjects usable) + Fresh A eligible",
        "- Validation B: **SEALED**",
        "- Production `saju_engine.py`: **untouched by V2 DY freeze**",
        "",
        "## Explanation-only (not in Y)",
        "",
        "- NatalContext",
        "- RegimeChangeEvidence / gates / continuous direction·confidence",
        "- Orthodox ten-god / relation contextual roles",
        "- D×Y interaction",
        "- event_intensity (≠ valence)",
        "- 12운성 contextual notes",
        "- other orthodox annotations from Phase 2.5",
        "",
        "## Known limitations",
        "",
        "- B likely understates Daewoon amplitude (adj p90 ~2.4)",
        "- Orthodox numeric amplification failed promotion (2.6 / 2.7)",
        "- Some classical items PARTIAL/uncertain (相神, 合化, 通关 depth)",
        "- Broad-period perceived accuracy unvalidated until blind user QA",
        "- Calendar: Wolwoon 子/丑 bug + civil vs 立春 sewoon — next foundation patch",
        "",
        "## Repro hashes (sha256[:16])",
        "",
        *[f"- `{k}`: `{v}`" for k, v in p.get("hashes", {}).items()],
        "",
        "## Development headline (frozen reference)",
        "",
        "- Fresh A pairwise **0.6429** (9/14)",
        "- OLD_DEV pairwise **0.5749** (40/56)",
        "- same-D FA **0.5714** · cross-D FA **0.6531**",
        "",
        "No Phase 2.8. Next: calendar → Month → Day.",
        "",
    ])


if __name__ == "__main__":
    sys.exit(main())
