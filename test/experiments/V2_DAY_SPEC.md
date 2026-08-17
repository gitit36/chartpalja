# V2 Day Spec (Phase 4)

**Parent Month:** `M1_CONSERVATIVE` / `V2_MONTH_LOCAL` (TIMING_ONLY)  
**Parent D/Y:** frozen `V2_DY_B`

## Hierarchy

```
DayScore = clamp(M_parent + DailyDev)
```

`M_parent` = M1_CONSERVATIVE for active Wolwoon (solar 節).  
`Y_parent` inherited inside M; not recomputed in Day.

## Day calendar policy

**A. Civil midnight / civil `YYYY-MM-DD`** — production 일운 convention.  
Not 子時 rollover. Neutral lookup time = **12:00 KST** (cannot change day pillar).

Sexagenary day via `civil_sexagenary_day` (aligned to sajupy/enrich).

## Candidates (exactly two)

| ID | Name | DailyDev |
|---|---|---|
| D1 | `V2_DAY_LOCAL` | Day↔Wolwoon primary + Day↔natal + structure/relations; intensity separate |
| D2 | `V2_DAY_CONTEXTUAL` | D1 + small nonredundant Day↔Sewoon |

No Day↔Daewoon numeric. No D3.

## Amplitude

`CONSERVATIVE` / `BALANCED` / `EXPRESSIVE` — global scale after within-Wolwoon median centering.

Target: |DailyDev| ≪ |MonthlyDev| ≪ |AnnualDev| in distribution.

## Labels

Reuse frozen exact-date subset only (`V2_MONTH_EVALUABLE_FREEZE` / Day freeze copy). No new events.
