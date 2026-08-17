# G Fresh Validation A Report

**Decision:** `REQUIRES_MODEL_REVISION`
**Measured at:** 2026-08-12T23:01:09

## Dataset

- SHA OK: True
- Fresh n: 30 (overlap=[])
- Split A/B: 15/15
- Birth grades: {'A': 9, 'AA': 19, 'B': 2}
- Ineligible (pre-score): [{'name': 'Winston Churchill', 'split': 'validation_a', 'source_quality': 'Rodden_A', 'grade': 'A', 'eligible_for_primary_validation': False, 'exclusion_reasons': ['engine_year_out_of_range(1874)']}, {'name': 'Albert Einstein', 'split': 'validation_b', 'source_quality': 'Rodden_AA', 'grade': 'AA', 'eligible_for_primary_validation': False, 'exclusion_reasons': ['engine_year_out_of_range(1879)']}]
- Val A attempted: 15
- Val A eligible scored: 14
- Good/bad label counts (eligible events): 28/28

## Birth QA note

Engine solar correction = longitude×4min only (no equation of time). Dataset precompute includes EOT → large delta_vs_supplied is expected; scoring uses engine_recomputed clock. Lon-only consistency gate: |Δ|≤1.0 min.

- max|Δ vs supplied|: 17.0 min (EOT expected)
- max|Δ vs lon-only|: 0.933 min (gate ≤1.0)

## Primary results (`G_CLEAN_AXIS`)

- subject hit: **7/14** (50.0%)
- pairwise mean: **0.4286**
- standardized separation: **-0.2185**

## Secondary

- AUC macro: 0.4286
- AUC micro: 0.4847
- raw sep mean/median: -2.5546 / -0.2975
- subject sep median/p25/p75/worst: {'median': -0.2975, 'p25': -10.2272, 'p75': 6.153, 'worst': -25.7669}

## Structural

- {'G_dist': {'mean': 50.8279, 'sd': 3.3426, 'p05': 44.8938, 'p50': 51.2075, 'p95': 55.6007}, 'A_within_block_sd_p50': 3.0662, 'sat_rate': 0.0, 'n_year_scores': 1400}

## Per-subject

| name | n_g | n_b | good_avg | bad_avg | sep | hit | pairwise |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bill Gates | 2 | 2 | 60.9355 | 58.5532 | 2.3823 | 1 | 0.75 |
| Britney Spears | 2 | 2 | 66.0874 | 53.9939 | 12.0936 | 1 | 1.0 |
| Johnny Depp | 2 | 2 | 62.1523 | 51.793 | 10.3593 | 1 | 1.0 |
| Michael Jordan | 2 | 2 | 70.7144 | 69.5095 | 1.2049 | 1 | 0.5 |
| Tiger Woods | 2 | 2 | 62.8146 | 55.6531 | 7.1615 | 1 | 0.75 |
| Roger Federer | 2 | 2 | 83.2161 | 80.0888 | 3.1273 | 1 | 0.75 |
| Diana, Princess of Wales | 2 | 2 | 57.5405 | 47.6281 | 9.9125 | 1 | 0.75 |
| Arnold Schwarzenegger | 2 | 2 | 61.3716 | 70.8959 | -9.5243 | 0 | 0.0 |
| Martha Stewart | 2 | 2 | 59.1977 | 64.6946 | -5.497 | 0 | 0.0 |
| Robert Downey Jr. | 2 | 2 | 38.8247 | 49.4766 | -10.6519 | 0 | 0.0 |
| Marilyn Monroe | 2 | 2 | 49.6479 | 60.1094 | -10.4615 | 0 | 0.25 |
| Whitney Houston | 2 | 2 | 62.0 | 87.7669 | -25.7669 | 0 | 0.0 |
| George Clooney | 2 | 2 | 55.5832 | 57.3832 | -1.8 | 0 | 0.25 |
| Meryl Streep | 2 | 2 | 51.4128 | 69.7168 | -18.3039 | 0 | 0.0 |

## Failures (hit=0)

- Arnold Schwarzenegger: sep=-9.5243 pair=0.0
- Martha Stewart: sep=-5.497 pair=0.0
- Robert Downey Jr.: sep=-10.6519 pair=0.0
- Marilyn Monroe: sep=-10.4615 pair=0.25
- Whitney Houston: sep=-25.7669 pair=0.0
- George Clooney: sep=-1.8 pair=0.25
- Meryl Streep: sep=-18.3039 pair=0.0

## G_REF read-only reference (not used for decision)

- hit 7/14 (50.0%), pairwise 0.4464, std_sep -0.175

## Development comparison (contaminated — not pooled)

Dev G_CLEAN_AXIS reference: hold std_sep≈0.152, pairwise≈0.583, hit=60%. Fresh A is judged on directionality / distribution / structure, not exact reproduction.

## Decision rationale

hit=7/14 pairwise=0.4286 std_sep=-0.2185 sat=0.0 eligible_scored=14/15 (ineligible pre-score: [{'name': 'Winston Churchill', 'split': 'validation_a', 'source_quality': 'Rodden_A', 'grade': 'A', 'eligible_for_primary_validation': False, 'exclusion_reasons': ['engine_year_out_of_range(1874)']}, {'name': 'Albert Einstein', 'split': 'validation_b', 'source_quality': 'Rodden_AA', 'grade': 'AA', 'eligible_for_primary_validation': False, 'exclusion_reasons': ['engine_year_out_of_range(1879)']}]) Validation B not scored. Failed predeclared floors or concentration check; do not open B; revise model offline.

Do **not** open Validation B. A is now development evidence.

## Hard prohibitions respected

- no engine edit, no α/κ/β/D change, no weight opt, no B scoring, no label edits after freeze