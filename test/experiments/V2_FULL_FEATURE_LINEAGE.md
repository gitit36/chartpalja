# V2 Full Feature Lineage

| feature | source layer | class | note |
|---|---|---|---|
| D fav_minus_unfav / struct_* | Daewoon | UNIQUE | V2_DY_B D only |
| G_CLEAN_AXIS / A_G | Sewoon annual | UNIQUE@year | not in Month/Day numeric |
| B_trigger ilju/ten-god | Sewoon annual | UNIQUE@year | not reused in MonthlyDev/DailyDev |
| Month yongshin fit / supply | Wolwoon | RELATED_DIFFERENT_TIMESCALE | month pillar ≠ D/Y |
| Month↔Sewoon / Month↔natal | Wolwoon | UNIQUE@month | primary month timing |
| Month↔Daewoon (M2 only) | Wolwoon | RELATED — unused in winner | M1 winner excludes |
| Day↔Wolwoon | Ilwoon | UNIQUE@day | primary day timing |
| Day yongshin / Day↔natal | Ilwoon | RELATED_DIFFERENT_TIMESCALE | day pillar |
| Day↔Sewoon (D2) | Ilwoon | RELATED — unused in winner | D1 winner excludes |
| Day↔Daewoon | — | DUPLICATE blocked | excluded |
| event_intensity | all | EXPLANATION_ONLY | never numeric valence |
| legacy engine 종합 blends | ref | DUPLICATE | reference only |

## NUMERIC_SCORE_DRIVER vs EXPLANATION_ONLY

- Drivers: layer-local fit/supply/contextual relations entering MonthlyDev/DailyDev/AnnualDev
- Explanation-only: intensity, orthodox annotations, RegimeChangeEvidence, ten-god labels as copy
- Product must not say explanation-only factors moved the numeric score
