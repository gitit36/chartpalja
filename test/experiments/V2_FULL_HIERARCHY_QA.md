# V2 Full Hierarchy QA

**Status:** `V2_FULL_HIERARCHY_READY_WITH_TIMING_LIMITATIONS`
**Measured:** 2026-08-13T03:05:20

## 1. Composition

```
Y = clamp(D_B + AnnualDev_B)
M = clamp(Y + MonthlyDev)      # M1_CONSERVATIVE
Day = clamp(M + DailyDev)     # D1_CONSERVATIVE
```

Child layers do not replace parents; only add centered local deviations.

## 2. Calendar chain

- ok: True · probes: 96
- failures: 0
- Live Sewoon=立春 · Wolwoon=節 · Ilwoon=civil YYYY-MM-DD · historical DY=civil year

## 3. Boundary-date ambiguity (noon vs 節)

- unambiguous: 159
- BOUNDARY_DATE_AMBIGUOUS: 4
- Noon does **not** claim true historical event month on 節 dates.

## 4. Day mapping 163→161→fix

- Before: mapped 161; root cause **DAY_ITERATION** (end calendar day dropped).
- After fix: mapped 163/163
- Fixed: True
- Events: Monica Lewinsky 2021-09-07; 윤석열 2025-04-04

## 5–6. Amplitude & centering

- Annual |dev| p90: 4.1612
- Month |dev| p90: 1.0024
- Day |dev| p90: 0.3491
- ratios: {'day_over_month_p90': 0.3483, 'month_over_annual_p90': 0.2409, 'day_over_annual_p90': 0.0839}
- order Day<Month<Annual: True
- month median violations: 0
- day median violations: 0

## 7. Boundary jumps

- daewoon: p50=0.9106 p90=2.625 p95=3.5356 max=4.4461
- sewoon_lichun: p50=2.1865 p90=5.5608 p95=7.3867 max=11.5233
- wolwoon: p50=0.5254 p90=1.308 p95=1.5629 max=2.5673
- civil_day: p50=0.1963 p90=0.5027 p95=0.6068 max=9.0803

## 8–9. Crossings & reachability

- counts: {"A_fav_year_hard_D": 0, "B_hard_year_fav_D": 89, "C_fav_month_hard_Y": 105, "D_hard_month_fav_Y": 455, "E_fav_month_hard_D": 0, "F_hard_month_fav_D": 69, "G_fav_day_hard_M": 1242, "H_hard_day_fav_M": 5091, "I_fav_day_hard_Y": 1245, "J_hard_day_fav_Y": 5161}
- D range: {'min': 59.0894, 'max': 65.25, 'p10': 60.4629, 'p50': 61.9073, 'p90': 63.75}
- fav-month-in-hard-D: **STRUCTURALLY_IMPOSSIBLE**
  — D_B never < 59.0 in development sample (min D=59.089); hard-D threshold unreachable — not a Month/Day bug

## 10. UX shape flags

- [high] flat_daewoon: D_B IQR-like span p90-p10=3.29; known understated amplitude
- [high] overconfident_day_claims: Day exact-hit ~0.47 with negative sep — product must not claim daily accuracy
- [high] child_as_independent_fortune: Users may read M/Day as standalone life scores; UI must show parent context

## 11–13. Explanation / intensity / duplication

- See `V2_FULL_FEATURE_LINEAGE.md`
- VALENCE ≠ EVENT_INTENSITY enforced in Month/Day construction (intensity explanation-only)
- Orthodox-only factors must not be claimed as numeric movers

## 14. Timing evidence (separate claims)

- Annual: FA pw 0.6429 / OLD 0.5749 (development)
- Month diagnostic: hit=0.5828 sep=0.1792 · TIMING_ONLY
- Day diagnostic: hit=0.4785 sep=-0.0279 · TIMING_ONLY

**Do not** merge into one full-hierarchy accuracy number.

## 15–17. Product policy

- Month: `MONTH_LOW_CONFIDENCE_TIMING`
- Day: `DAY_EXPLANATION_ONLY`
- See `V2_PRODUCT_SCORING_POLICY.md`

**Final:** `V2_FULL_HIERARCHY_READY_WITH_TIMING_LIMITATIONS`

STOP — next is ONE-SHOT Validation B protocol decision (not unsealed here).
