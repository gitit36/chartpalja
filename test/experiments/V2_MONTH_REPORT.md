# V2 Month Report

**Status:** `V2_MONTH_TIMING_ONLY`
**Winner:** `M1_CONSERVATIVE`
**Reason:** hierarchy/coherence pass but exact-date data insufficient for accuracy claim (sparse=True, n=163, hit=0.5828, sep=0.1792)
**Measured:** 2026-08-13T02:47:43

## Parent

- Numeric D/Y frozen: `V2_DY_B`
- `M = clamp(Y_parent + MonthlyDev)`
- `Y_parent` from LIVE 立春 Sewoon year (not rewriting historical civil-year DY metrics)

## Date precision

- Evaluable exact-dated events: 163
- Subjects: 14
- Fresh A exact-dated: 0
- Sparse: True

## Candidates

| key | exact_hit | sep | subj_hit | window±1 | med≈0 | |M|p90 | m/ann p90 | sat |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| M1_CONSERVATIVE | 0.5828 | 0.1792 | 0.5714 | 0.8834 | 1.0 | 1.0012 | 0.24 | 0.0 |
| M1_BALANCED | 0.5828 | 0.2987 | 0.5714 | 0.8834 | 1.0 | 1.6687 | 0.3999 | 0.0 |
| M1_EXPRESSIVE | 0.5828 | 0.478 | 0.5714 | 0.8834 | 1.0 | 2.67 | 0.6399 | 0.0 |
| M2_CONSERVATIVE | 0.5706 | 0.1907 | 0.5714 | 0.8773 | 1.0 | 1.0017 | 0.2401 | 0.0 |
| M2_BALANCED | 0.5706 | 0.3178 | 0.5714 | 0.8773 | 1.0 | 1.6695 | 0.4001 | 0.0 |
| M2_EXPRESSIVE | 0.5706 | 0.5085 | 0.5714 | 0.8773 | 1.0 | 2.6712 | 0.6402 | 0.0 |

## Selection policy

- Prefer timing evidence when credible; else conservative structural TIMING_ONLY.
- Do not choose merely for larger swings.
- No dense weight search; amplitudes predeclared.

## Hierarchy QA (Month observation; D/Y untouched)

- {"years_with_fav_month_in_hard_D": 0, "years_with_hard_month_in_fav_D": 515, "years_with_fav_month_in_hard_Y": 118, "years_with_hard_month_in_fav_Y": 493, "n_years": 819, "note": "D/Y crossing asymmetry from closure audit NOT modified; Month-only observation"}

## Hard stop

- Validation B sealed
- Day not built
- D/Y not redesigned
- Production scoring untouched

**Final:** `V2_MONTH_TIMING_ONLY`
