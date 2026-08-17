# SAJU ML NEW_DEV_2 QA

## Status

`FROZEN_UNTOUCHED_EXTERNAL_REPLICATION_CORPUS_R2`

This corpus was constructed before NEW_DEV_2 model scoring.

## Structural QA

- Subjects: **100**
- Career events: **200**
- Career positive: **100**
- Career negative: **100**
- Pair-evaluable subjects: **100 / 100**
- Known birth time: **100 / 100**
- Birth year in 1900-2100: **100 / 100**
- Duplicate names inside NEW_DEV_2: **0**
- Name overlap against retained prior-pool inventory: **0**

## Why exactly 1 positive + 1 negative per person?

Forcing 2+2 increased subjective labeling, especially in arts and entertainment.
The external replication set therefore uses the strongest one positive and
one negative Career year per person. Every subject contributes exactly one pair.

## Birth provenance

VedAstro public 15K famous-person research dataset, selected records marked Rodden AA.

Dataset:
`https://huggingface.co/datasets/vedastro-org/15000-Famous-People-Birth-Date-Location`

Raw source:
`https://huggingface.co/datasets/vedastro-org/15000-Famous-People-Birth-Date-Location/raw/main/PersonList-15k.csv`

## Event provenance

Career events were manually curated from public biography material without
viewing any saju/model output.

Current status: **single-source research curation**.

Every event has:

`"needs_secondary_verification": true`

A second-source event audit is recommended before publication-grade claims
or promotion to a permanent gold-standard benchmark.

## Event confidence

- High: 163
- Medium: 37
- Low: 0

No low-confidence event is included.

## Occupation mix

```json
{
  "arts_entertainment": 37,
  "sports": 50,
  "sports_politics": 1,
  "fashion": 1,
  "politics": 8,
  "journalism": 1,
  "intelligence": 1,
  "medicine": 1
}
```

## Holdout integrity

Excluded:
- Validation B
- Public Life CHECK
- Public Life FINAL
- V2 NEW_CONFIRM

## Frozen evaluation rule

Required:
- winner = `TENGOD_FIXED`
- 10 frozen Ten-God features
- Pairwise Logistic Regression
- L2
- C = 0.3

The notebook may refit this exact frozen architecture on the fixed 93-subject
discovery pool only to reconstruct coefficients/scaler. It may not select
features or tune hyperparameters.

## Hashes

- corpus: `64227e9a48a3dcd2daf16741ac94989f6eda94cda5eb4d0675c37869e3175707`
- engine inputs: `d8c95d685dc1f52db117074b2e140047aa7d8d44bbeb1e89adca4d7aa3243957`


## R2 collision fix

Initial V1 had Denton Cooley with both Career labels in 1969, so the label-collapse rule removed that subject. R2 replaces him before NEW_DEV_2 scoring with Jimmy Johnson: positive 1993, negative 1994.

Mandatory invariant: every NEW_DEV_2 subject must have two distinct Career event years.

Post-fix pair-evaluable subjects: **100 / 100**

Updated corpus SHA256: `75c6c9d0dae2217f9a7ad7202c44328992d8658aab2cf42f3af987ab6c703bf9`
Updated engine-input SHA256: `ce97d82480cc30fa63fbda13d776409a863e827ba3b0d7f56199d2e26403b585`
