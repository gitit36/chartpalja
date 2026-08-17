# V4 Unified DEV Wave 2 — Event/Source Collection

## Frozen input
- Wave 2 roster: 44 subjects
- Axes: COMPETITIVE 3 / PROJECT 8 / STATUS 33
- Membership was frozen before event collection and astrology scoring.
- No Wave 2 member was replaced.

## Collection result
- Pairable: 28
  - COMPETITIVE: 3
  - PROJECT: 6
  - STATUS: 19
- UNPAIRABLE_THIS_WAVE: 16
- Same-year pairs: 0
- Astrology scored: false

## Conservative taxonomy choices
- Routine term completion, retirement, resignation, or ordinary government turnover is not automatically negative.
- Legal/reputation-driven disruption is not mixed into core STATUS by default (e.g. Spiro Agnew).
- PROJECT requires a source-supported discrete project success/failure; actor reception alone was not enough to force Jessica Lange into a pair.
- Ambiguous cases remain unpairable rather than being used to hit target counts.

## Selection
For each pairable subject, the selected pair is the minimum absolute year-gap pair among the source-verified candidates retained in this bounded sweep.

## Next
Run `10_saju_ml_v4_unified_dev_wave2_freeze_and_combined_qa.ipynb`.
The notebook reconstitutes Wave 2 pairs from the event table, validates all 44 frozen memberships, then combines them with frozen Wave 1 pairs. Astrology feature generation remains blocked until a separate combined-corpus feature-generation gate is created.
