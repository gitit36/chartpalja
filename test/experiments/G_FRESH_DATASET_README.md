# G Fresh Validation Dataset Handoff

## Freeze

- Candidate: `G_CLEAN_AXIS`
- Subjects: **30** completely new names
- Split: **15 Validation A / 15 Validation B**
- Existing `yongshin_subjects.json` overlap: **0 / 58**
- Labels frozen: **true**
- Model scoring performed during collection: **no**
- Birth-source quality: **AA=19, A=9, B=2**
- File SHA-256: `b1b593610a04f1adc2a6b1349a011e452cbfebfe15d0df287597b45aea52f0ba`

## Birth-time rule

Do **not** convert foreign births to Korean time. The source-reported local civil time is retained in `original_birth`.

The `birth` field is a precomputed `LOCAL_TRUE_SOLAR` time using:

```text
local civil time
+ DST/war -> standard-time correction
+ 4 minutes * (birth longitude - standard meridian)
+ equation of time
```

Before any G/B9 scoring, Cursor should recompute all 30 cases with the engine's existing conversion helper and assert a difference of at most **1 minute**. This protects against small convention differences.

## Why this set is not Korea-only

This validation set prioritizes **birth-time provenance** over nationality. Public Korean birth times are often not backed by birth records, whereas Astro-Databank provides source provenance and Rodden ratings for many international figures. The existing development corpus is already Korea-heavy. A separate Korean-only external-validity set can be added later when reliable birth-hour sources are available.

## Scoring protocol

1. Do not edit labels after opening candidate scores.
2. Score Validation A once with frozen `G_CLEAN_AXIS`.
3. If any rule/coefficient changes because of A, move A to development.
4. Keep Validation B untouched for final confirmation.
5. Never pool this fresh set with the contaminated 58-name development set for headline accuracy.

## Files

- `g_fresh_subjects_completed.json`: frozen dataset
- `g_fresh_subjects_completed.sha256`: freeze checksum
