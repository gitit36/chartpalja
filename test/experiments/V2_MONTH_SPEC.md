# V2 Month Spec (Phase 3)

**Status:** Experiment contract  
**Parent:** frozen `V2_DY_B`  
**Calendar:** `V2_CALENDAR_READY_FOR_MONTH`

## Hierarchy

```
Natal → Daewoon → Sewoon → Wolwoon
M = clamp(Y_parent + MonthlyDev)
```

`Y_parent` = frozen V2_DY_B year score for **LIVE active 立春 Sewoon year** of the month/event date.

| Context | Boundary |
|---|---|
| `HISTORICAL_DY_VALIDATION` | civil year (unchanged) |
| `LIVE_MONTH_PARENT_CONTEXT` | 立春 Sewoon via `live_active_sewoon` |
| Month intervals | solar 節 via `build_wolwoon` |

## Candidates (exactly two)

| ID | Name | MonthlyDev |
|---|---|---|
| M1 | `V2_MONTH_LOCAL` | natal activation + Month↔Sewoon + contextual structure/relations + intensity separate |
| M2 | `V2_MONTH_CONTEXTUAL` | M1 + small non-redundant Month↔Daewoon |

No M3. Reference = legacy `build_monthly_timeline` 종합 (reference only).

## Amplitude (predeclared, features identical)

`CONSERVATIVE` / `BALANCED` / `EXPRESSIVE` — one global scale after within-Sewoon-year median centering.

## Centering

```
MonthlyDev_m = amp * (raw_m − median(raw_12 in active Sewoon year))
```

## Timing labels

Primary: exact-dated events (`year+month+day`) mapped via `live_active_wolwoon` — no year-only inference.

Secondary: ±1 adjacent Wolwoon window.

## Hard stop

No Val B, Day, D/Y redesign, new people/labels, Ridge/ML, dense weight search.
