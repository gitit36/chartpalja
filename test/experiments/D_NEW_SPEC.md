# D_NEW Material Spec

**Status:** Experiment-only (pre-results contract)  
**Date:** 2026-08-12  
**Validation B:** SEALED  

## Semantic contract

`D_new` means:

> The absolute long-term quality baseline of one Daewoon block.

It must:

- depend only on **natal chart + Daewoon pillar**
- contain **no Sewoon / year output**
- rank relatively better long-term periods above worse periods **within the same person**
- move more slowly / less violently than current engine `D_REF`
- remain meaningfully larger-scale than month noise
- **not** automatically overwhelm annual `A` whenever D ordering is slightly wrong

`D_new` is **not** an annual-event predictor.

| Layer | Role |
|-------|------|
| Primary | block-level ordering vs predeclared block targets |
| Secondary | annual `S = D_new + A` composition diagnostic only |

## Frozen hierarchy (unchanged)

```text
G = G_CLEAN_AXIS
A_y = G_y − median(G within Daewoon block)
α = 1.0
κ = 0
β = 0.25
centering = median
S_raw = D + A
```

No `saju_engine.py` edits. No G revision. No α compensation.

## Data pools (DEVELOPMENT only)

| Pool | Source |
|------|--------|
| OLD_DEV | all usable `yongshin_subjects.json` (exclude placeholder `본인`) |
| FRESH_A_DEV | eligible opened Validation A |
| COMBINED_DEV | union |

Hard-fail if any Validation B subject enters any step.

Neither OLD_DEV nor Fresh A is external validation.

## Block targets

Reuse unchanged: `D_BLOCK_LABEL_SPEC.md`

- Primary: `simple_net`
- Robustness (read-only): `normalized_balance`, `high_confidence_balance`
- Zero-evidence blocks: `insufficient_event_evidence` (excluded from pairwise)

Do not redefine labels after seeing candidates.

## Normalization (predeclared)

For candidate `H` materials:

- **Primary:** robust z-score per primitive across DEVELOPMENT blocks  
  `z = (x − median) / (1.4826 · MAD)` with MAD floor `1e-6`
- **Sensitivity:** ordinary global z-score `(x − mean) / sd`

No label-based normalization. No subject identity features.

## Deterministic candidates (before supervised)

| ID | Definition |
|----|------------|
| D_REF | current engine `종합운점수` |
| H_REF_RAW | sum of breakdown components (= pre-`SCORE_BIAS` composite) |
| D1_EQUAL_ALL | equal mean of robust-z families: fit, unseong(+context), relations, balance, structural, auxiliary |
| D2_CORE | equal mean of: fit, unseong(+context), relations, balance, structural |
| D3_NO_YFIT | D2 without fit |
| D4_NO_UNSEONG | D2 without unseong/context |
| D5_NO_RELATIONS | D2 without relations |
| D6_MINIMAL | smallest supportive subset from direction audit (aggregate only) |
| Aux add-ons | after D2: add trine / shinsal / disease / haegong **one at a time** |
| D7_CONSTRAINED | ridge on family scores; LOSO / subject-grouped CV; α_reg ∈ {0.1, 1, 10} |

## Material gate (before amplitude)

At least one `H` candidate must show:

- COMBINED within-subject pairwise **clearly > 0.50**
- FRESH_A_DEV pairwise **> 0.50**
- OLD_DEV not materially below chance (≈ ≥ 0.48)
- directionally consistent on robustness targets
- grouped CV positive (for D7) / not carried by 1–2 subjects

If none pass → `DNEW_MATERIAL_NOT_READY` (stop; no gamma).

## Amplitude (only after H_DNEW frozen)

```text
D_new = BASE + gamma · H_z
BASE = 60   # fixed; not label-tuned
gamma ∈ {3, 5, 7, 9}
```

α stays 1.0. Prefer structural amplitude + override reduction over headline annual hit.

## Controls

- `CONSTANT_D`: subject-median D baseline + A (no Daewoon ordering)
- Optional within-subject permutation null for selected H

## Status vocabulary

Exactly one of:

```text
DNEW_CANDIDATE_READY_TO_FREEZE
DNEW_MATERIAL_NOT_READY
DNEW_AMPLITUDE_NOT_READY
DNEW_BOTH_NOT_READY
```

If ready-to-freeze: **do not** score Validation B in this run.
