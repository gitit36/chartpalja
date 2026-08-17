# D Feature Discovery Spec

**Status:** Diagnosis only — no D score, no coefficients, no amplitude  
**Date:** 2026-08-13  
**Validation B:** SEALED  

## Goal

Determine **why** current Daewoon numeric encodings fail, and define a short new feature vocabulary **before** another scoring experiment.

Distinguish:

| Code | Meaning |
|------|---------|
| A | concept useful; **encoding** wrong |
| B | concept useful; **sign depends on natal context** |
| C | concept useful; only via **interactions** |
| D | explanatory but not absolute good/bad score |
| E | more appropriate for **Sewoon** than Daewoon |
| F | block target too sparse/noisy to judge |
| G | genuinely weak Daewoon signal |

## Critical distinction

```text
"fit pairwise < 0.5"
  ≠  "용신은 bad / 기신은 good"
  =  "CURRENT ENGINE ENCODING of fit failed"
```

`yongshin_fit` is already a heuristic aggregation. Audit **raw parts**, not only the scalar.

## Data

| Pool | Role |
|------|------|
| OLD_DEV | usable yongshin subjects (excl. `본인`) — DEVELOPMENT |
| FRESH_A_DEV | eligible opened Validation A — DEVELOPMENT |
| COMBINED_DEV | union |

Hard-fail if Validation B enters any step.

## Predeclared rules

- **Min cell size:** `n_blocks ≥ 20` COMBINED **and** `n_subjects ≥ 10` for conditional cells; else `INSUFFICIENT`
- **Primary unit:** within-subject block pairs (feature Δ vs target Δ)
- **Targets (unchanged):** `simple_net`, `normalized_balance`, `high_confidence_balance`
- **No** Ridge / coefficient search / sign inversion features / named patches
- **No** new block labels tuned to model performance

## Interactions allowed (small, theory-implied only)

1. favorable_element_activation  
2. unfavorable_element_activation  
3. unseong × strength_regime (신강/신약 bucket)  
4. relation_type × natal_pillar_hit  
5. balance_delta × favorable_element_direction  

## Readiness vocabulary

Exactly one of:

```text
D_FEATURES_READY_FOR_NEW_EXPERIMENT
D_FEATURE_DISCOVERY_INCONCLUSIVE
D_BLOCK_TARGET_NEEDS_REDESIGN_FIRST
```

`D_FEATURES_READY…` requires ≥2–3 semantically defensible new feature definitions with positive Fresh A direction, non-harmful OLD, adequate coverage, not target-quirk dependent, not mere sign-inversion of old scalars.
