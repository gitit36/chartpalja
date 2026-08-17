# -*- coding: utf-8 -*-
"""
V2 Calendar Foundation Patch — tests + D/Y regression gate.

Fixes/verifies:
  - build_wolwoon 子/丑 solar-節 intervals
  - LIVE_ACTIVE_SEWOON = 立春→立春
  - HISTORICAL_EXPERIMENT_YEAR civil-year path unchanged for frozen V2_DY_B

No Month/Day build. No Validation B. No D/Y redesign.

Usage:
  PYTHONPATH=.:test python test/experiments/test_v2_calendar_foundation.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEST = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_TEST)
sys.path.insert(0, _ROOT)
sys.path.insert(0, _TEST)
sys.path.insert(0, _HERE)

import saju_engine as se  # noqa: E402
from experiments import experiment_v2_dy as DY  # noqa: E402
from experiments.validate_g_fresh_a import OUT_LABELS, _pairwise  # noqa: E402

OUT_SNAP = os.path.join(_TEST, "snapshots", "exp_v2_calendar_foundation.json")
OUT_MD = os.path.join(_HERE, "V2_CALENDAR_FOUNDATION_PATCH.md")
OUT_HANDOFF = os.path.join(_HERE, "V2_PHASE_3_MONTH_HANDOFF.md")
MANIFEST = os.path.join(_HERE, "V2_DY_FINAL_FREEZE_MANIFEST.md")

# Frozen V2_DY_B historical headlines (must not move)
EXPECT_FA_PW = 0.6429
EXPECT_OLD_PW = 0.5749
EXPECT_SAME_D = 0.5714
EXPECT_CROSS_D = 0.6531

YEARS = (1984, 1997, 2017, 2023, 2024, 2025, 2026)


def _parse(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


def audit_wolwoon_year(ey: int) -> Dict[str, Any]:
    now = datetime(ey, 6, 15, 12, 0, tzinfo=se.KST)
    months = se.build_wolwoon(now)
    assert len(months) == 12
    branches = [m["branch"] for m in months]
    assert branches == list("寅卯辰巳午未申酉戌亥子丑"), branches

    starts = [_parse(m["start"]) for m in months]
    ends = [_parse(m["end"]) for m in months]
    issues = []

    if starts[0] != se.ipchun(ey):
        issues.append("start_not_ipchun")
    if ends[-1] != se.ipchun(ey + 1):
        issues.append("end_not_next_ipchun")

    for i, m in enumerate(months):
        s, e = starts[i], ends[i]
        days = (e - s).total_seconds() / 86400.0
        if e <= s:
            issues.append(f"inverted_{m['branch']}")
        if days > 40 or days < 25:
            issues.append(f"span_{m['branch']}_{days:.1f}d")
        if i < 11 and ends[i] != starts[i + 1]:
            issues.append(f"gap_or_overlap_at_{i}")

    # Named windows
    zi, chou = months[10], months[11]
    dxue, xiaohan, ip_next = starts[10], starts[11], ends[11]
    assert zi["branch"] == "子" and chou["branch"] == "丑"
    # 大雪 → 小寒 (子); 小寒 → 立春 (丑); 立春 → 驚蟄 (寅)
    if not (dxue < xiaohan < ip_next):
        issues.append("zi_chou_order")
    if (xiaohan - dxue).days > 40 or (ip_next - xiaohan).days > 40:
        issues.append("zi_chou_year_span")

    # Immediate before/after 節 switches
    probes = [
        (starts[10], "亥", "子"),   # 大雪
        (starts[11], "子", "丑"),   # 小寒
        (starts[0], "丑", "寅"),    # 立春 of ey — before is prior year's 丑
    ]
    switch_ok = True
    for boundary, before_br, after_br in probes:
        # For 立春 ey, "before" belongs to previous saju year's 丑
        if before_br == "丑" and after_br == "寅":
            b = se.live_active_wolwoon(boundary - timedelta(hours=1))
            a = se.live_active_wolwoon(boundary + timedelta(hours=1))
        else:
            b = se.live_active_wolwoon(boundary - timedelta(hours=1))
            a = se.live_active_wolwoon(boundary + timedelta(hours=1))
        if b["branch"] != before_br or a["branch"] != after_br:
            switch_ok = False
            issues.append(
                f"switch_{boundary.date()}_got_{b['branch']}→{a['branch']}_want_{before_br}→{after_br}"
            )

    return {
        "ey": ey,
        "n_months": len(months),
        "issues": issues,
        "zi_start": zi["start"],
        "zi_end": zi["end"],
        "chou_start": chou["start"],
        "chou_end": chou["end"],
        "zi_days": round((ends[10] - starts[10]).total_seconds() / 86400, 2),
        "chou_days": round((ends[11] - starts[11]).total_seconds() / 86400, 2),
        "switch_ok": switch_ok,
        "ok": not issues,
    }


def audit_live_sewoon(years: Tuple[int, ...] = YEARS) -> Dict[str, Any]:
    rows = []
    ok = True
    for y in years:
        ip = se.ipchun(y)
        cases = [
            ("before", ip - timedelta(hours=6), y - 1),
            ("exact_after", ip + timedelta(seconds=1), y),
            ("after", ip + timedelta(hours=6), y),
        ]
        for label, t, expect_ey in cases:
            sw = se.live_active_sewoon(t)
            hist_gz = se.historical_experiment_sewoon_gz(t.year)
            row = {
                "label": label,
                "civil_y": t.year,
                "t": t.isoformat(),
                "live_ey": sw["year"],
                "live_gz": sw["ganzhi"],
                "expect_ey": expect_ey,
                "hist_civil_gz": hist_gz,
                "policy": sw["boundary_policy"],
                "match": sw["year"] == expect_ey,
            }
            # Near Jan 1 before 立春: live ey ≠ civil year
            if t.month == 1 or (t.month == 2 and t < ip):
                row["civil_vs_live_diverges"] = sw["year"] != t.year
            rows.append(row)
            if not row["match"]:
                ok = False
        # build_sewoon windows are 立春→立春
        for ent in se.build_sewoon(ip + timedelta(days=10), n=3):
            if _parse(ent["start"]) != se.ipchun(ent["year"]):
                ok = False
            if _parse(ent["end"]) != se.ipchun(ent["year"] + 1):
                ok = False
    return {"ok": ok, "rows": rows}


def audit_live_hierarchy() -> Dict[str, Any]:
    """Representative dates around 立春 / 大雪 / 小寒 / NY."""
    inp = se.BirthInput(
        year=1980, month=5, day=15, hour=12, minute=0, gender="male",
    )
    r = se.enrich_saju(inp)
    dw = se.build_daewoon_detail(r)
    cases = []
    ok = True
    for y in (2023, 2024, 2025):
        ip = se.ipchun(y)
        ww = se.build_wolwoon(datetime(y, 6, 15, tzinfo=se.KST))
        dxue = _parse(ww[10]["start"])
        xh = _parse(ww[11]["start"])
        probes = [
            ("ny_jan1", datetime(y, 1, 1, 12, tzinfo=se.KST)),
            ("before_ipchun", ip - timedelta(hours=3)),
            ("after_ipchun", ip + timedelta(hours=3)),
            ("before_daxue", dxue - timedelta(hours=3)),
            ("after_daxue", dxue + timedelta(hours=3)),
            ("before_xiaohan", xh - timedelta(hours=3)),
            ("after_xiaohan", xh + timedelta(hours=3)),
            ("year_end", datetime(y, 12, 31, 12, tzinfo=se.KST)),
        ]
        for name, t in probes:
            h = se.live_hierarchy_at(t, r=r, dw_detail=dw)
            sw, wol = h["sewoon"], h["wolwoon"]
            # Month must sit inside live sewoon window
            ms, me = _parse(wol["start"]), _parse(wol["end"])
            ss, se_end = _parse(sw["start"]), _parse(sw["end"])
            month_in_sewoon = ss <= ms and me <= se_end
            in_month = ms <= t < me
            # Live sewoon year == _year_gz
            ey_ok = sw["year"] == se.live_active_sewoon_year(t)
            # Civil NY before 立春 must not use civil year as live sewoon
            civil_mismatch_ok = True
            if name in ("ny_jan1", "before_ipchun") and t < se.ipchun(t.year):
                civil_mismatch_ok = sw["year"] == t.year - 1
            row = {
                "name": name,
                "t": t.isoformat(),
                "sewoon_year": sw["year"],
                "sewoon_gz": sw["ganzhi"],
                "wolwoon_branch": wol["branch"],
                "daewoon": (h["daewoon"] or {}).get("daewoon_pillar")
                or (h["daewoon"] or {}).get("ganzhi"),
                "month_in_sewoon": month_in_sewoon,
                "in_month": in_month,
                "ey_ok": ey_ok,
                "civil_mismatch_ok": civil_mismatch_ok,
            }
            row["ok"] = all(
                [
                    month_in_sewoon,
                    in_month,
                    ey_ok,
                    civil_mismatch_ok,
                ]
            )
            if not row["ok"]:
                ok = False
            cases.append(row)
    return {"ok": ok, "cases": cases}


def _score_v2_dy_b() -> Dict[str, Any]:
    """Recompute frozen V2_DY_B historical headlines (civil-year meta path)."""
    freeze = json.load(open(OUT_LABELS, encoding="utf-8"))
    old_packs, fresh_packs, val_b = DY._load_pools(freeze)
    all_packs = old_packs + fresh_packs
    for p in all_packs:
        if p["name"] in val_b:
            raise RuntimeError(f"Val B leak: {p['name']}")

    all_block_rows = []
    pack_blocks = {}
    for pack in all_packs:
        bf = DY._block_feats(pack)
        pack_blocks[pack["name"]] = bf
        all_block_rows.extend(bf.values())

    z_keys = [
        "fav_act", "unfav_act", "fav_minus_unfav",
        "struct_activ", "struct_disrupt", "struct_net", "struct_excess",
        "has_hap", "has_chung", "has_samhap", "has_day_chung",
    ]
    z_params = {k: DY._robust_params([float(r[k]) for r in all_block_rows]) for k in z_keys}

    def zf(row, k):
        return DY._z_clip(row[k], *z_params[k])

    D_map = {}
    for pack in all_packs:
        for pillar, f in pack_blocks[pack["name"]].items():
            h_b = (
                0.45 * zf(f, "fav_minus_unfav")
                + 0.35 * zf(f, "struct_activ")
                - 0.35 * zf(f, "struct_disrupt")
                - 0.15 * zf(f, "struct_excess")
            )
            D_map[(pack["name"], pillar)] = DY._clamp(DY.BASE + 3.0 * h_b)

    cfg = dict(__import__("experiments.arm_b", fromlist=["arm_b"]).ARM_B_CONFIG)
    from experiments.experiment_g_clean import score_g

    layers_by_pack = []
    score_maps = []
    for pack in all_packs:
        gmap = {int(y): float(score_g(m, DY.VARIANT_G, cfg)) for y, m in pack["meta"].items()}
        by_p = defaultdict(list)
        for y, m in pack["meta"].items():
            p = str(m.get("대운_pillar") or "_")
            if (pack["name"], p) not in D_map:
                continue
            by_p[p].append(gmap[int(y)])
        med = {p: float(np.median(vs)) for p, vs in by_p.items()}
        layers, smap = {}, {}
        for y, m in pack["meta"].items():
            pillar = str(m.get("대운_pillar") or "_")
            if (pack["name"], pillar) not in D_map:
                continue
            a = gmap[int(y)] - med[pillar]
            d = float(D_map[(pack["name"], pillar)])
            flags = DY._ilju_flags(m)
            tg = DY._tg_career(m)
            trigger = (
                1.2 * flags["year_hap"]
                - 1.5 * flags["year_chung"]
                - 1.0 * flags["year_hyung"]
                - 0.8 * flags["year_pa_hae"]
                + 0.4 * tg
            )
            annual_dev = 0.65 * a + 0.35 * trigger
            y_disp = DY._clamp(d + annual_dev)
            layers[int(y)] = {"pillar": pillar, "D": d, "Y": y_disp, "A": a}
            smap[int(y)] = y_disp
        layers_by_pack.append(layers)
        score_maps.append(smap)

    out = {}
    for pool_name, packs in (("OLD_DEV", old_packs), ("FRESH_A_DEV", fresh_packs)):
        idx = [i for i, p in enumerate(all_packs) if p["pool"] == pool_name]
        ann = DY._annual_metrics([all_packs[i] for i in idx], [score_maps[i] for i in idx])
        # same/cross D pairwise on FA
        same_pairs, cross_pairs = [], []
        for i in idx:
            pack, layers = all_packs[i], layers_by_pack[i]
            goods = [e for e in pack["n"]["good"] if not e.get("exclude") and int(e["year"]) in layers]
            bads = [e for e in pack["n"]["bad"] if not e.get("exclude") and int(e["year"]) in layers]
            for ge in goods:
                for be in bads:
                    Lg, Lb = layers[int(ge["year"])], layers[int(be["year"])]
                    correct = Lg["Y"] > Lb["Y"]
                    same = Lg["pillar"] == Lb["pillar"]
                    if same:
                        same_pairs.append(1.0 if correct else 0.0)
                    else:
                        cross_pairs.append(1.0 if correct else 0.0)
        out[pool_name] = {
            "pairwise_mean": ann["pairwise_mean"],
            "hit": ann["hit"],
            "same_D_pairwise": None if not same_pairs else round(float(np.mean(same_pairs)), 4),
            "cross_D_pairwise": None if not cross_pairs else round(float(np.mean(cross_pairs)), 4),
        }
    return out


def _append_manifest_note(status: str) -> None:
    note = f"""

## Calendar foundation policy note (appended)

**Status:** `{status}`  
**Date:** {datetime.now().isoformat(timespec="seconds")}

- Live Sewoon boundary = **立春 → next 立春** (`LIVE_ACTIVE_SEWOON` / `live_active_sewoon`)
- Month boundary = **solar 節** (`build_wolwoon` fixed 子/丑)
- Historical D/Y validation remains **civil-year** (`HISTORICAL_EXPERIMENT_YEAR` / `build_yearly_timeline`) for frozen reproducibility
- Day boundary policy deferred to Phase 4
- EOT / 子時 / 半時 policies **unchanged**
- Frozen V2_DY_B formula and experiment hashes above are **not** rewritten by this patch
"""
    text = open(MANIFEST, encoding="utf-8").read()
    if "Calendar foundation policy note" in text:
        # replace previous note block from heading to EOF-ish: keep formula section; append once
        head = text.split("## Calendar foundation policy note")[0].rstrip()
        open(MANIFEST, "w", encoding="utf-8").write(head + note)
    else:
        open(MANIFEST, "a", encoding="utf-8").write(note)


def _write_docs(payload: Dict[str, Any]) -> None:
    st = payload["status"]
    L = [
        "# V2 Calendar Foundation Patch",
        "",
        f"**Status:** `{st}`",
        f"**Measured:** {payload['measured_at']}",
        "",
        "## Policies (unchanged except calendar wiring)",
        "",
        "| Context | Boundary |",
        "|---|---|",
        "| `LIVE_ACTIVE_SEWOON` | 立春 → next 立春 |",
        "| Month (`build_wolwoon`) | solar 節 (寅…丑) |",
        "| `HISTORICAL_EXPERIMENT_YEAR` | civil Gregorian year (frozen V2_DY_B) |",
        "| Day | deferred Phase 4 |",
        "| EOT / 子時 / 半時 | unchanged |",
        "",
        "## 1. Wolwoon 子/丑 fix",
        "",
        "- Root cause: `_term_deg(ey, 285)` resolved 小寒 in January of `ey` (before 立春),",
        "  so 子 became inverted (大雪 → past 小寒) and 丑 spanned ~year.",
        "- Fix: pick each MONTH_BD occurrence inside `[ipchun(ey), ipchun(ey+1))`.",
        f"- Years audited: {payload['wolwoon']['years_ok']}/{payload['wolwoon']['years_n']}",
        "",
        "## 2. Live Sewoon 立春",
        "",
        f"- Boundary tests ok: {payload['live_sewoon']['ok']}",
        "- Helpers: `live_active_sewoon`, `live_active_wolwoon`, `live_active_daewoon`, `live_hierarchy_at`",
        "- Historical path: `historical_experiment_sewoon_gz` / `build_yearly_timeline` untouched",
        "",
        "## 3. D/Y regression (historical civil-year)",
        "",
        f"- FA pw: {payload['dy_regression']['FRESH_A_DEV']['pairwise_mean']} (expect {EXPECT_FA_PW})",
        f"- OLD pw: {payload['dy_regression']['OLD_DEV']['pairwise_mean']} (expect {EXPECT_OLD_PW})",
        f"- FA same-D: {payload['dy_regression']['FRESH_A_DEV']['same_D_pairwise']} (expect {EXPECT_SAME_D})",
        f"- FA cross-D: {payload['dy_regression']['FRESH_A_DEV']['cross_D_pairwise']} (expect {EXPECT_CROSS_D})",
        f"- headline_ok: {payload['dy_regression']['headline_ok']}",
        "",
        "## 4. Live hierarchy",
        "",
        f"- ok: {payload['live_hierarchy']['ok']}",
        "",
        "## 5. Validation B / production D/Y",
        "",
        f"- validation_b_scored: {payload['validation_b_scored']}",
        "- V2_DY_B architecture unchanged; only calendar helpers + wolwoon intervals",
        "",
        f"**Final:** `{st}`",
        "",
        "STOP — Month is next (separate phase).",
        "",
    ]
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(L))

    H = [
        "# V2 Phase 3 Month Handoff",
        "",
        f"**Prerequisite:** `{st}`",
        "",
        "## Use these APIs",
        "",
        "| Need | API |",
        "|---|---|",
        "| Month boundaries | `saju_engine.build_wolwoon(now)` / `live_active_wolwoon(now)` |",
        "| Active Daewoon (live) | `live_active_daewoon(dw_detail, now)` |",
        "| Active Sewoon (live) | `live_active_sewoon(now)` — 立春 |",
        "| Full live chain | `live_hierarchy_at(now, r=…, dw_detail=…)` |",
        "| NatalContext | `enrich_saju` → 원국 / 용신 / 격국 / 신강신약 |",
        "| Frozen year score | V2_DY_B: `Y = clamp(D_B + 0.65*A_G + 0.35*B_trigger)` via experiment path |",
        "| Historical year labels | `HISTORICAL_EXPERIMENT_YEAR` civil year — do not rewrite |",
        "| Orthodox explanation | Phase 2.5 `V2_DY_ORTHO_*` / RegimeChangeEvidence — explanation-only |",
        "",
        "## Full Hierarchy QA flag (later)",
        "",
        "- Closure audit reported `good-year-in-hard-D crossing = 0`.",
        "- Do **not** modify D/Y now; re-check symmetrically after Month/Day and in blind user QA.",
        "",
        "Do not open Validation B. Do not redesign D/Y.",
        "",
    ]
    open(OUT_HANDOFF, "w", encoding="utf-8").write("\n".join(H))


def main() -> int:
    print("══════════ V2 CALENDAR FOUNDATION ══════════")
    wol_rows = [audit_wolwoon_year(y) for y in YEARS]
    wol_ok = all(r["ok"] for r in wol_rows)
    print(f"  wolwoon years ok={sum(r['ok'] for r in wol_rows)}/{len(wol_rows)}")

    print("── live sewoon ──")
    live_sw = audit_live_sewoon()
    print(f"  live_sewoon ok={live_sw['ok']}")

    print("── live hierarchy ──")
    live_h = audit_live_hierarchy()
    print(f"  live_hierarchy ok={live_h['ok']}")

    print("── V2_DY_B historical regression ──")
    dy = _score_v2_dy_b()
    fa, old = dy["FRESH_A_DEV"], dy["OLD_DEV"]
    headline_ok = (
        fa["pairwise_mean"] == EXPECT_FA_PW
        and old["pairwise_mean"] == EXPECT_OLD_PW
        and fa["same_D_pairwise"] == EXPECT_SAME_D
        and fa["cross_D_pairwise"] == EXPECT_CROSS_D
    )
    dy["headline_ok"] = headline_ok
    print(
        f"  FA={fa['pairwise_mean']} OLD={old['pairwise_mean']} "
        f"same={fa['same_D_pairwise']} cross={fa['cross_D_pairwise']} ok={headline_ok}"
    )

    block_reasons = []
    if not wol_ok:
        block_reasons.append("wolwoon_intervals")
    if not live_sw["ok"]:
        block_reasons.append("live_sewoon_lichun")
    if not live_h["ok"]:
        block_reasons.append("live_hierarchy")
    if not headline_ok:
        block_reasons.append("dy_headline_changed")

    status = (
        "V2_CALENDAR_READY_FOR_MONTH"
        if not block_reasons
        else "V2_CALENDAR_PATCH_BLOCKED"
    )

    payload = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "phase": "V2_CALENDAR_FOUNDATION",
        "validation_b_scored": False,
        "production_dy_architecture_changed": False,
        "wolwoon": {
            "years_n": len(wol_rows),
            "years_ok": sum(1 for r in wol_rows if r["ok"]),
            "rows": wol_rows,
            "ok": wol_ok,
        },
        "live_sewoon": live_sw,
        "live_hierarchy": {"ok": live_h["ok"], "n_cases": len(live_h["cases"]), "failures": [c for c in live_h["cases"] if not c["ok"]]},
        "dy_regression": dy,
        "policies": {
            "LIVE_ACTIVE_SEWOON": "立春→立春",
            "HISTORICAL_EXPERIMENT_YEAR": "civil Gregorian year",
            "month": "solar 節",
            "day": "DEFERRED_PHASE_4",
            "eot_zi_bansi": "unchanged",
        },
        "block_reasons": block_reasons,
        "status": status,
        "hierarchy_qa_flag": {
            "good_year_in_hard_D_crossing_was_0": True,
            "action": "re-check after Month/Day + blind user QA; do not modify D/Y now",
        },
    }

    open(OUT_SNAP, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    )
    _write_docs(payload)
    _append_manifest_note(status)

    print("══════════ STATUS ══════════")
    print(status)
    if block_reasons:
        print("block_reasons", block_reasons)
    print(f"→ {OUT_SNAP}")
    return 0 if not block_reasons else 1


if __name__ == "__main__":
    sys.exit(main())
