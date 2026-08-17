# V4 Career Taxonomy + Source Review — 414 Events
Status: `REVIEW_COMPLETE_WITH_CONSERVATIVE_SOURCE_GATE`
All 414 rows received a final taxonomy decision. Independent secondary-source verification was concentrated on rows capable of forming a same-subject, same-axis opposite-polarity pair; non-pairable rows were not force-searched merely to make the table look complete.
## Summary
- **rows_reviewed:** `414`
- **taxonomy_decision_counts:** `{'CONFIRMED': 320, 'CONFIRMED_NONPAIRABLE': 45, 'REJECT_BINARY_TRANSITION': 31, 'REJECT_BINARY_AMBIGUOUS': 17, 'SOURCE_CONTRADICTED': 1}`
- **final_axis_counts:** `{'PROJECT': 99, 'COMPETITIVE': 78, 'RECOGNITION': 77, 'MILESTONE_OTHER': 45, 'STATUS': 37, 'TRANSITION': 31, 'DISRUPTION_HEALTH': 25, 'UNRESOLVED': 17, 'DISRUPTION_LEGAL_REPUTATION': 5}`
- **final_polarity_counts:** `{'positive': 239, 'negative': 126, 'unassigned': 48, 'invalid': 1}`
- **secondary_source_status_counts:** `{'NOT_CONFIRMED_THIS_PASS': 298, 'CONFIRMED': 110, 'PARTIAL': 5, 'CONTRADICTED': 1}`
- **final_review_status_counts:** `{'TAXONOMY_CONFIRMED_SECONDARY_UNCONFIRMED': 208, 'MODEL_ELIGIBLE_SOURCE_CONFIRMED': 95, 'CONFIRMED_TAXONOMY_NONPAIRABLE': 45, 'REJECT_TRANSITION_NONBINARY': 31, 'REJECT_TAXONOMY_AMBIGUOUS': 17, 'CONFIRMED_BUT_NO_CONFIRMED_OPPOSITE_PAIR': 12, 'TAXONOMY_CONFIRMED_SOURCE_PARTIAL': 5, 'REJECT_SOURCE_CONTRADICTED': 1}`
- **model_eligible_events:** `95`
- **model_ready_pairs:** `49`
- **model_ready_subjects:** `46`
- **model_ready_axis_counts:** `{'PROJECT': 20, 'COMPETITIVE': 18, 'STATUS': 7, 'RECOGNITION': 4}`

## Hard source correction
- **Al Unser 1993:** remove. Corpus says he failed to qualify for the Indianapolis 500, while official Indianapolis Motor Speedway records show he qualified, started 23rd and finished 12th.

## Model-use rule
Source/taxonomy review yields 49 same-subject, same-axis pairs whose two sides are independently confirmed. However, these are **not model-ready**: positive events occur earlier in 83.7% of the 49 pairs. They are stored as `V4_SOURCE_VERIFIED_PAIR_CANDIDATES.csv`, with `chronology_gate_passed=false` and `model_ready=false`.

## Still not a final gold holdout
This is development curation. NEW_DEV_2 was already consumed; these rows may be used for V4 development only, never re-described as fresh validation.

## Chronology gate

- Source-verified pair candidates: **49 pairs / 46 subjects**
- Positive event earlier than negative: **83.7%**
- Median absolute year gap: **5 years**
- Even restricting to gap <= 3 years leaves only **16 pairs** and earlier-positive share **68.8%**.

**Decision:** `FAIL_LIFECYCLE_CONFOUNDING_REMAINS`. Do not start the V4 feature/model tournament from these pairs yet.
