# G Fresh Validation A — Run Contract

**Write-before-score.** Frozen before any Validation A G/B9 outputs are computed.

## Candidate (immutable this run)

```text
G = G_CLEAN_AXIS
alpha = 1.0
kappa = 0
beta = 0.25
D = engine daewoon 종합운점수
centering = median
S_raw = D + A
A_y = G_y − median(G within daewoon block)
M_raw unused for year-label KPI
no interaction / no synergy
```

No weight search. No new patterns. No production engine edits.

## Dataset gates (must pass before score)

1. SHA-256 of `g_fresh_subjects_completed.json` matches `test/g_fresh_subjects_completed.sha256`  
2. n_fresh = 30; overlap with `yongshin_subjects.json` = 0  
3. Validation A = 15, Validation B = 15; split not rebalanced after scores  
4. Birth QA recorded; **engine-recomputed** local true-solar (sajupy longitude×4min, local standard offset) used for scoring input  
5. Labels frozen in `g_fresh_labels_frozen.json` with `labels_frozen=true`

## Scope

```text
Score: Validation A only
Reject / do not load: split == validation_b
```

`G_REF` may be computed on A as **read-only reference**. It must not change the candidate or trigger architecture search.

## Primary metrics

```text
subject-level hit rate   (good_wavg > bad_wavg)
pairwise good > bad      (mean within-subject)
standardized separation  (mean subject sep / pooled SD of S)
```

## Secondary metrics

```text
AUC macro, AUC micro
raw separation (mean / median)
per-subject separation
worst-subject list
```

## Structural diagnostics

```text
G mean/SD/percentiles
A_y within-block SD
saturation P(S≤2 ∨ S≥98)
pattern activation (discord/hollow/friction/health_guan) on A years
```

## Semantic target

Within the same daewoon block, known better years should rank above known worse years. Absolute G calibration is secondary.

## Predeclared failure indicators (not tuned after seeing results)

Any of the following → cannot claim `PASS_TO_VALIDATION_B` without revision discussion:

```text
pairwise_mean <= 0.50
standardized_separation <= 0
major structural/saturation failure (e.g. sat_rate >= 2% on display S)
performance supported almost entirely by ≤2 subjects
  (e.g. removing top-2 seps flips overall hit below chance or pairwise→≤0.50)
```

Directionally positive = above these floors with distributed subject support.

## Decision statuses (exactly one)

| Status | Meaning |
|--------|---------|
| `PASS_TO_VALIDATION_B` | QA clean; primary metrics directionally positive; no structural failure; not tiny-outlier driven; **no model change proposed**. Stop — do **not** score B in this run. |
| `REQUIRES_MODEL_REVISION` | Candidate fails A. Do not open B. A becomes development evidence. |
| `DATASET_QA_FAILURE` | Birth/source/label integrity failed before scoring. No candidate scoring. |

## Hard prohibitions

No: engine edits, α/κ/β/D changes, weight opt, new/removed penalties for a miss, named-subject patches, post-score relabel, scoring B, pooling with development JSON, picking best architecture after A.
