# V4 Target Expansion Report

## Decision

**V4_TARGET_MODEL_READY**

No new subjects were required. The expansion reuses the audited 169-subject modern clean base and adds source-backed rebound observations to neutralize the previous lifecycle ordering bias.

## Final target set

- Previous source-verified same-axis pairs: **49**
- New negative→positive rebound pairs: **51**
- Final pair rows: **100**
- Unique subjects represented: **69**
- Axes: **{'COMPETITIVE': 43, 'PROJECT': 40, 'STATUS': 13, 'RECOGNITION': 4}**

## Chronology

- Pair-row positive-earlier share: **0.410**
- Subject-macro positive-earlier share: **0.453**
- Pair-row Age-only pairwise: **0.410**
- Subject-macro Age-only pairwise: **0.453**

The target now passes the predeclared 40–60% chronology window at both pair and subject-macro levels.

## Important constraints

1. This is a **development target**, not a holdout.
2. Multiple pairs from the same subject exist; future training must use `subject_equal_pair_weight`.
3. Future evaluation must be **subject-macro**, never raw pair-micro.
4. Age-only and Calendar-year-only remain mandatory baselines.
5. The next feature tournament must test incremental value beyond lifecycle, not merely performance above 0.5.
6. V2 `NEW_CONFIRM` remains sealed.

## Axis distribution

COMPETITIVE    43
PROJECT        40
STATUS         13
RECOGNITION     4
