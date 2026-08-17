# V2 Day Calendar Audit

**Measured:** 2026-08-13T03:01:38
**Foundation OK:** True

## Policy choice (not score-optimized)

| Option | Decision |
|---|---|
| A. Civil midnight / `YYYY-MM-DD` | **SELECTED** (production 일운) |
| B. 子時-based rollover | Not used for 일운 (birth `early_zi_time` only) |

- Neutral evaluation time for date-only events: **12:00 KST**
- Helper: `saju_engine.civil_sexagenary_day`

## Legacy bug

- Prior `build_daily_fortune` JD epoch was systematically **+47** vs sajupy/enrich natal day.
- Fixed by aligning `civil_sexagenary_day` to sajupy while keeping civil-date policy.

## Sajupy alignment

| date | sajupy | engine | ok |
|---|---|---|---|
| 1983-01-27 | 乙卯 | 乙卯 | True |
| 1984-02-02 | 丙寅 | 丙寅 | True |
| 1990-05-15 | 庚辰 | 庚辰 | True |
| 2000-01-01 | 戊午 | 戊午 | True |
| 2017-02-03 | 辛酉 | 辛酉 | True |
| 2017-02-04 | 壬戌 | 壬戌 | True |
| 2024-02-03 | 丁酉 | 丁酉 | True |
| 2024-02-04 | 戊戌 | 戊戌 | True |
| 2024-02-10 | 甲辰 | 甲辰 | True |

## Consecutive sequence (90d): True

## Issues: none

## Boundary probes (立春 / month)

- {'label': '2024_before_ipchun', 'civil': '2024-02-04', 'day_pillar': '戊戌', 'sewoon_year': 2023, 'wolwoon': '丑'}
- {'label': '2024_after_ipchun', 'civil': '2024-02-04', 'day_pillar': '戊戌', 'sewoon_year': 2023, 'wolwoon': '丑'}
- {'label': '2025_before_ipchun', 'civil': '2025-02-03', 'day_pillar': '癸卯', 'sewoon_year': 2024, 'wolwoon': '丑'}
- {'label': '2025_after_ipchun', 'civil': '2025-02-04', 'day_pillar': '甲辰', 'sewoon_year': 2025, 'wolwoon': '寅'}
- {'label': 'month寅_start+1h', 'civil': '2024-02-04', 'day_pillar': '戊戌', 'wolwoon': '丑'}
- {'label': 'month寅_end-1h', 'civil': '2024-03-05', 'day_pillar': '戊辰', 'wolwoon': '卯'}
- {'label': 'month子_start+1h', 'civil': '2024-12-07', 'day_pillar': '乙巳', 'wolwoon': '子'}
- {'label': 'month子_end-1h', 'civil': '2025-01-05', 'day_pillar': '甲戌', 'wolwoon': '丑'}
- {'label': 'month丑_start+1h', 'civil': '2025-01-05', 'day_pillar': '甲戌', 'wolwoon': '丑'}
- {'label': 'month丑_end-1h', 'civil': '2025-02-03', 'day_pillar': '癸卯', 'wolwoon': '丑'}
