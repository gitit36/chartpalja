# V2 Final Pre-Validation Manifest

**Status:** `V2_FULL_HIERARCHY_READY_WITH_TIMING_LIMITATIONS`
**Date:** 2026-08-13T03:05:20

## Frozen numeric stack

| Layer | ID | Status |
|---|---|---|
| D/Y | V2_DY_B | CLOSED / frozen |
| Month | M1_CONSERVATIVE / V2_MONTH_LOCAL | TIMING_ONLY |
| Day | D1_CONSERVATIVE / V2_DAY_LOCAL | TIMING_ONLY |

## Formulas

```
Y = clamp(D_B + 0.65*A_G + 0.35*B_trigger)
M = clamp(Y + amp_m * (raw_m - median_year(raw_m)))  # amp_m=1.5
Day = clamp(M + amp_d * (raw_d - median_wolwoon(raw_d)))  # amp_d=0.55
```

## Calendar

- Live Sewoon: 立春
- Wolwoon: solar 節 (`build_wolwoon`)
- Ilwoon: civil YYYY-MM-DD (`civil_sexagenary_day`, sajupy-aligned)
- Historical DY validation: civil year

## Hashes (sha256[:16])

- `experiment_v2_dy.py`: `d2c0199c5194dd63`
- `experiment_v2_month.py`: `1dbf9fa75a5711f0`
- `experiment_v2_day.py`: `40f999119437f222`
- `exp_v2_dy.json`: `a45cca5a56a13bdb`
- `exp_v2_month.json`: `7fb900582d341797`
- `exp_v2_day.json`: `44c7646524ebd991`
- `V2_DAY_EVALUABLE_FREEZE.json`: `838de9396c6116b6`
- `V2_MONTH_EVALUABLE_FREEZE.json`: `5b09221015d62ce8`

## Confirmed

- Validation B: **SEALED / unscored**
- No new labels / people / web events
- No architecture modification in this QA
- Production V2 scoring not wired

## Next

Decide ONE-SHOT Validation B protocol before unsealing.
Do not open Val B in this document.
