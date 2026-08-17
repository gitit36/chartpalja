# SAJU_ML_CORPUS_V1 QA

- SHA256: `4d3de2a50de488580b4f19e411a05d3e331ab0223f57da1a2941dbfefb03df19`
- Subjects: **94**
- OLD_DEV / Fresh A / Public DEV: **56 / 14 / 24**
- Total source events: **736**
- ML-usable mapped events: **497**
- Unmapped events retained as all-target `unknown`: **239**
- Birth time known / unknown: **67 / 27**
- Validation B: **not included**
- Public CHECK: **not included**
- Public FINAL: **not included**

## Domain coverage

| Target | + events | - events | + subjects | - subjects | subjects with both | ranking pairs |
|---|---:|---:|---:|---:|---:|---:|
| Career | 253 | 62 | 87 | 37 | 36 | 248 |
| Wealth | 2 | 5 | 2 | 5 | 1 | 1 |
| Health | 4 | 81 | 4 | 56 | 1 | 1 |
| Love | 42 | 33 | 30 | 23 | 15 | 48 |
| Family | 24 | 15 | 15 | 14 | 2 | 2 |

## Interpretation

- This is a **prototype research corpus**, not a new validation set.
- Career has enough signal density for the first ML baseline.
- Love has some within-person positive/negative pairs.
- Wealth, Health, and Family are intentionally sparse rather than filled with inferred labels.
- A missing/irrelevant domain is `unknown`; it is never treated as a negative example.
- For the first notebook, start with Career, then only train another domain if `subjects_with_both` and ranking-pair counts are adequate.
- Birth-time-missing subjects should be handled with an explicit missing-time policy or excluded in a strict four-pillar feature experiment.
