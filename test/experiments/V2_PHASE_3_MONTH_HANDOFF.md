# V2 Phase 3 Month Handoff

**Prerequisite:** `V2_CALENDAR_READY_FOR_MONTH`

## Use these APIs

| Need | API |
|---|---|
| Month boundaries | `saju_engine.build_wolwoon(now)` / `live_active_wolwoon(now)` |
| Active Daewoon (live) | `live_active_daewoon(dw_detail, now)` |
| Active Sewoon (live) | `live_active_sewoon(now)` — 立春 |
| Full live chain | `live_hierarchy_at(now, r=…, dw_detail=…)` |
| NatalContext | `enrich_saju` → 원국 / 용신 / 격국 / 신강신약 |
| Frozen year score | V2_DY_B: `Y = clamp(D_B + 0.65*A_G + 0.35*B_trigger)` via experiment path |
| Historical year labels | `HISTORICAL_EXPERIMENT_YEAR` civil year — do not rewrite |
| Orthodox explanation | Phase 2.5 `V2_DY_ORTHO_*` / RegimeChangeEvidence — explanation-only |

## Full Hierarchy QA flag (later)

- Closure audit reported `good-year-in-hard-D crossing = 0`.
- Do **not** modify D/Y now; re-check symmetrically after Month/Day and in blind user QA.

Do not open Validation B. Do not redesign D/Y.
