# V2 Day Report

**Status:** `V2_DAY_TIMING_ONLY`
**Winner:** `D1_CONSERVATIVE`
**Reason:** hierarchy/coherence pass but exact-date evidence insufficient for accuracy claim (sparse=True, n=163, hit=0.4785, sep=-0.0279)
**Measured:** 2026-08-13T03:02:49

## Parents

- D/Y: `V2_DY_B`
- Month: `M1_CONSERVATIVE` (V2_MONTH_TIMING_ONLY)
- `DayScore = clamp(M_parent + DailyDev)`

## Calendar

- Policy: **civil YYYY-MM-DD** (not 子時)
- Foundation OK: True
- Legacy JD +47 bug: fixed / aligned to sajupy

## Labels

- Exact-date events: 163 (pos=101, neg=62)
- Subjects: 14 · Fresh A: 0
- Sparse: True

## Candidates

| key | exact_hit | sep | subj_hit | ±1 | ±3 | med≈0 | |D|p90 | d/m | d/ann | sat |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| D1_CONSERVATIVE | 0.4785 | -0.0279 | 0.6429 | 0.865 | 1.0 | 1.0 | 0.3603 | 0.3429 | 0.0833 | 0.0 |
| D1_BALANCED | 0.4785 | -0.0457 | 0.6429 | 0.865 | 1.0 | 1.0 | 0.5895 | 0.5611 | 0.1363 | 0.0 |
| D1_EXPRESSIVE | 0.4785 | -0.0686 | 0.6429 | 0.865 | 1.0 | 1.0 | 0.8843 | 0.8416 | 0.2045 | 0.0 |
| D2_CONSERVATIVE | 0.4601 | -0.0221 | 0.5714 | 0.8712 | 1.0 | 1.0 | 0.3626 | 0.3451 | 0.0839 | 0.0 |
| D2_BALANCED | 0.4601 | -0.0362 | 0.5714 | 0.8712 | 1.0 | 1.0 | 0.5933 | 0.5647 | 0.1372 | 0.0 |
| D2_EXPRESSIVE | 0.4601 | -0.0544 | 0.5714 | 0.8712 | 1.0 | 1.0 | 0.89 | 0.8471 | 0.2058 | 0.0 |

## Behavior QA

- {'fav_day_in_hard_month': 308, 'hard_day_in_fav_month': 1093, 'fav_day_in_hard_sewoon': 316, 'hard_day_in_fav_sewoon': 1093, 'n_months': 2042}
- fav-month-in-hard-D flag remains 0 (D/Y not reopened)

## Hard stop

- Validation B sealed · D/Y/Month not redesigned · no new labels · production V2 Day not wired

**Final:** `V2_DAY_TIMING_ONLY`

## ERRATUM — Day mapping 161→163

Root cause: `DAY_ITERATION` — civil-day loop used half-open calendar dates and dropped the Wolwoon **end calendar day** even when noon still fell inside `[start, end)`.

Fixed events:
- Monica Lewinsky 2021-09-07
- 윤석열 2025-04-04

After fix: mapped **163/163**. Timing remains weak (hit≈0.48, sep&lt;0). Status unchanged: `V2_DAY_TIMING_ONLY`.

Next: FULL HIERARCHY QA.
