# Blind Pilot Engine QA

**Status:** `BLIND_PILOT_ENGINE_DATA_READY`

This n=4 exercise is `BLIND_USER_QA_PILOT`.
It is not validation, not an accuracy estimate, and not statistical evidence.

| ID | natal reference match | Daewoon reference match | first mismatch | annual years generated |
|---|---|---|---|---:|
| P01 | MATCH | MATCH | — | 60 |
| P02 | MATCH | MATCH | — | 58 |
| P03 | MATCH | MATCH | — | 30 |
| P04 | MATCH | MINOR_BOUNDARY_DIFFERENCE | 辛卯 start 2025 vs supplied 2026 (−1y); 2026 current 辛卯 vs supplied 庚寅 | 27 |

## Confirmations

- V2_DY_B hash unchanged: `experiment_v2_dy.py` `d2c0199c5194dd63` (preregistered `d2c0199c5194dd63`)
- z-params source: OLD_DEV + Fresh A only; {"fav_minus_unfav": [0.0, 1.4826], "struct_activ": [0.0, 0.35], "struct_disrupt": [0.0, 0.35], "struct_excess": [0.0, 0.35]}
- no participant life history used
- no tuning performed
- no Validation B reused (B names never packed or scored)
- no Month/Day score included in participant-facing chart
- future years excluded from retrospective chart packet (internal engine JSON only)
- participant-response fields left empty

## Notes

- Solar civil KST is the engine input. Lunar dates and supplied pillars/Daewoon are QA references only.
- Engine output was not rewritten to match supplied Daewoon year claims.
- P03/P04 supplied Daewoon lists start at 'current' and omit earlier childhood blocks; subsequence match is used.
- P04 辛卯 engine start is 2025 vs supplied 2026 (1-year boundary).
