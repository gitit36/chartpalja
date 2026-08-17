# SAJU_ML_CORPUS_V2 QA

**Created:** 2026-08-15  
**Revision:** `R2_ENGINE_YEAR_RANGE_FIX`  
**Status:** `EXPANSION_CORPUS_READY_WITH_EVENT_SOURCE_QA_AND_ENGINE_RANGE_QA`

## Purpose

External new-subject expansion set for the two model candidates frozen after ML V1.4:

- `TENGOD`: 10 features
- `SHINSAL_ALL`: 43 features
- fixed Pairwise Logistic Regression, L2, `C=0.3`

This corpus must **not** be used to reopen broad feature-family search.

## R2 correction

The first V2 package contained three corpus-QA defects found **before any V2 model score was produced**:

1. John Logie Baird (1888) was outside the `sajupy` supported birth-year range.
2. John Maynard Keynes (1883) was outside the `sajupy` supported birth-year range.
3. Billy Graham overlapped the prior Public Life V1 40-subject benchmark.

They were replaced in `NEW_DEV` with previously unused Rodden-AA candidates:

- Ann Jillian (1950)
- Mark Hamill (1951)
- Steve Prefontaine (1951)

The split sizes and Career label counts therefore remain unchanged. The notebook now performs a birth-year preflight before feature extraction and uses new R2 feature-cache filenames.

## Split

| Pool | Subjects | Role |
|---|---:|---|
| NEW_DEV | 70 | External development expansion and candidate selection between the two already-frozen families |
| NEW_CONFIRM | 30 | One-shot confirmation after NEW_DEV winner freeze |

`NEW_CONFIRM` is physically separated in `SAJU_ML_CORPUS_V2_NEW_CONFIRM_SEALED.json`.

## Subject provenance

- Total subjects: **100**
- Exact birth time known: **100/100**
- Rodden rating target: **AA**
- `NEW_DEV`: 59 previously unused Public-Life candidate-pool subjects + 11 fresh V2 AA subjects
- `NEW_CONFIRM`: 30 fresh V2 AA subjects
- Overlap with `SAJU_ML_CORPUS_V1`: **0**
- Overlap with Public Life V1 DEV/CHECK/FINAL 40: **0**
- Duplicate names inside V2: **0**

## Engine compatibility

- Required runtime birth-year range: **1900–2100 inclusive**
- V2 subjects outside supported range after R2: **0**
- The notebook also checks the runtime `sajupy` calculator's `min_year` / `max_year` before feature extraction.
- Longitude-corrected birth years are checked again at runtime.

## Career labels

- Total events: **332**
- Career positive events: **200**
- Career negative events: **132**
- Subjects with both Career positive and negative: **100/100**
- Subjects with at least 2 positive + 1 negative Career years: **100/100**
- Subjects with at least 2 positive + 2 negative Career years: **32/100**
- Same-subject same-year positive/negative Career collisions: **0**
- Low-confidence ML-usable events: **0**

By pool:

| Pool | Positive | Negative | >=2 pos + >=1 neg | >=2 pos + >=2 neg |
|---|---:|---:|---:|---:|
| NEW_DEV | 140 | 76 | 70/70 | 6/70 |
| NEW_CONFIRM | 60 | 56 | 30/30 | 26/30 |

## Event-source caveat

The event layer is a **research curation set**, not a publication-grade historical database.

- Event confidence after R2: **239 high, 93 medium**
- Every event has a source reference.
- Most event references are public biography / public reporting and many are single-source.
- Several development subjects use a broad but dated career-lull/cancellation/setback label because the candidate pool originally lacked clean negative Career years.

Therefore:

1. Use NEW_DEV only to test whether the already-frozen V1.4 signal survives a much larger subject set.
2. Treat source sensitivity and subgroup sensitivity as required diagnostics.
3. Before making a scientific/public claim from NEW_CONFIRM, a second-source manual audit is recommended.
4. Do not revise labels after seeing model scores.

## Leakage guards

Forbidden from V2:

- consumed Validation B
- Public Life DEV/CHECK/FINAL 40
- all 94 `SAJU_ML_CORPUS_V1` subject names

No forbidden name remains in V2 after R2.

## Engine birth policy

All V2 subjects use `public_runtime_longitude_correction`:

1. start from civil local date/time + UTC offset + longitude
2. apply the same longitude solar-time correction used for ML V1 Public DEV
3. confirm corrected year is inside the runtime engine range
4. pass the corrected birth into `BirthInput(... use_solar_time=False)`

This avoids applying solar correction twice.

## Recommended workflow

```text
V1 discovery
  -> freeze TENGOD + SHINSAL_ALL
  -> V2 NEW_DEV (70)
  -> select at most one surviving candidate with predeclared gates
  -> write winner freeze manifest
  -> optional refit on V1 + NEW_DEV
  -> V2 NEW_CONFIRM (30) one-shot
  -> stop and report
```

Do not open Public CHECK/FINAL from this workflow.
