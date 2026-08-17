# V2 Calendar Foundation Patch

**Status:** `V2_CALENDAR_READY_FOR_MONTH`
**Measured:** 2026-08-13T02:35:12

## Policies (unchanged except calendar wiring)

| Context | Boundary |
|---|---|
| `LIVE_ACTIVE_SEWOON` | 立春 → next 立春 |
| Month (`build_wolwoon`) | solar 節 (寅…丑) |
| `HISTORICAL_EXPERIMENT_YEAR` | civil Gregorian year (frozen V2_DY_B) |
| Day | deferred Phase 4 |
| EOT / 子時 / 半時 | unchanged |

## 1. Wolwoon 子/丑 fix

- Root cause: `_term_deg(ey, 285)` resolved 小寒 in January of `ey` (before 立春),
  so 子 became inverted (大雪 → past 小寒) and 丑 spanned ~year.
- Fix: pick each MONTH_BD occurrence inside `[ipchun(ey), ipchun(ey+1))`.
- Years audited: 7/7

## 2. Live Sewoon 立春

- Boundary tests ok: True
- Helpers: `live_active_sewoon`, `live_active_wolwoon`, `live_active_daewoon`, `live_hierarchy_at`
- Historical path: `historical_experiment_sewoon_gz` / `build_yearly_timeline` untouched

## 3. D/Y regression (historical civil-year)

- FA pw: 0.6429 (expect 0.6429)
- OLD pw: 0.5749 (expect 0.5749)
- FA same-D: 0.5714 (expect 0.5714)
- FA cross-D: 0.6531 (expect 0.6531)
- headline_ok: True

## 4. Live hierarchy

- ok: True

## 5. Validation B / production D/Y

- validation_b_scored: False
- V2_DY_B architecture unchanged; only calendar helpers + wolwoon intervals

**Final:** `V2_CALENDAR_READY_FOR_MONTH`

STOP — Month is next (separate phase).
