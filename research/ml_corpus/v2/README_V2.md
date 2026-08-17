# SAJU ML Corpus V2 — R2

## What changed in R2

The first package failed because two NEW_DEV births were before the `sajupy` minimum year 1900. A separate QA also found one Public Life V1 benchmark overlap.

Before any V2 model score was produced, the three subjects were replaced with unused Rodden-AA candidates. `NEW_DEV` remains 70 subjects and `NEW_CONFIRM` remains 30.

The notebook now performs engine-range preflight checks and writes an R2 feature cache.

## Put files here

```text
saju/
└── research/
    ├── ml_corpus/
    │   ├── v1/
    │   └── v2/
    │       ├── SAJU_ML_CORPUS_V2.json
    │       ├── SAJU_ML_CORPUS_V2_NEW_DEV.json
    │       ├── SAJU_ML_CORPUS_V2_NEW_CONFIRM_SEALED.json
    │       ├── SAJU_ML_ENGINE_INPUTS_V2.json
    │       ├── SAJU_ML_V2_CANDIDATE_FREEZE.json
    │       ├── SAJU_ML_CORPUS_V2_MANIFEST.json
    │       ├── SAJU_ML_CORPUS_V2_QA.md
    │       └── SAJU_ML_CORPUS_V2_SUBJECT_AUDIT.csv
    └── ml/
        └── saju_ml_expansion_validation_v2.ipynb
```

## Replace the old package

Overwrite the old V2 files with R2 before rerunning.

If an old artifact exists, it is safe to leave it because R2 uses:

`research/ml/artifacts/v2/V2_NEW_DEV_feature_table_R2.csv`

instead of the old cache name.

## First run

1. Keep `RUN_CONFIRM = False`.
2. Run All.
3. Send back:
   - `research/ml/artifacts/v2/V2_DEV_candidate_results.csv`
   - `research/ml/artifacts/v2/V2_DEV_WINNER_FREEZE.json`

Do not set `RUN_CONFIRM=True` before reviewing the NEW_DEV freeze.

## Confirmation

Only after the NEW_DEV result is accepted:

1. Set `RUN_CONFIRM = True`.
2. Run All.
3. Send back:
   - `V2_CONFIRM_one_shot_results.csv`
   - `V2_CONFIRM_subject_deltas.csv`
   - `V2_CONFIRM_final_decision.json`

Public CHECK, Public FINAL and consumed Validation B are not used by this workflow.
