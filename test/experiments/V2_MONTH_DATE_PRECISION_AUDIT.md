# V2 Month Date Precision Audit

**Frozen before scoring:** `/Users/sangjinlee/Desktop/projects/saju/test/experiments/V2_MONTH_EVALUABLE_FREEZE.json`
**Measured:** 2026-08-13T02:46:29

## Policy

- Primary Month validation: **EXACT_DATE** only (`year+month+day`).
- Map via `live_active_wolwoon` / solar 節 — no civil-month guessing.
- Year-only life_events: **excluded** (cannot assign Wolwoon without guessing).
- No new people / web labels / post-hoc reinterpretation.

## Year-only life_events (excluded)

- OLD_DEV: n=584 (pos=380, neg=204)
- Fresh A: n=56 (pos=28, neg=28)

## Existing month_day_labels

- EXACT_DATE rows (pre-filter): 163
- MONTH_KNOWN_NO_DAY: 0

## Frozen month-evaluable development subset

- n events: **163**
- n positive: **101**
- n negative: **62**
- n subjects: **14**
- OLD_DEV: {'n_events': 163, 'n_pos': 101, 'n_neg': 62, 'n_subjects': 14}
- Fresh A: {'n_events': 0, 'n_pos': 0, 'n_neg': 0, 'n_subjects': 0}

**Primary data sparse:** True
- FRESH_A_DEV has zero exact-dated month events
- only 14 subjects with month-evaluable events

Do **not** manufacture a Month accuracy claim if sparse.
