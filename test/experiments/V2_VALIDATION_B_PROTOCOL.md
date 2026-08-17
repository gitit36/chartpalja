# V2 One-Shot Validation B Protocol

**Status:** `V2_VALIDATION_B_PROTOCOL_V11_FROZEN`  
**Protocol version:** `V2_VAL_B_PROTOCOL_1.1`  
**Upgrade from:** `V2_VAL_B_PROTOCOL_1.0` — execution-integrity fixes only.  
**This document preregisters the irreversible holdout run. It does not execute it.**

Validation B tests **unseen annual D/Y generalization only**.

It does **not** validate Month or Day.

Annual model/formula and PASS/SUPPORTED thresholds are unchanged from v1.0.

---

## Integrity (pre-unseal)

Frozen D/Y development headlines (from `exp_v2_dy.json` / freeze manifests — **not** recomputed on B):

| Metric | Value |
|---|---|
| Fresh A pairwise | **0.6429** |
| OLD_DEV pairwise | **0.5749** |
| Fresh A same-D (legacy headline, tie=0) | **0.5714** |
| Fresh A cross-D (legacy headline, tie=0) | **0.6531** |

Public split metadata only:

- Fresh split **15 A / 15 B**
- Eligible primary B = **14**
- Preexisting exclusion set exactly: **Albert Einstein** — `engine_year_out_of_range(1879)`

No other B-specific content is inspected in the protocol-freeze run.

Hashes, including the scorer itself: see `V2_VALIDATION_B_PROTOCOL_FREEZE.json`.

---

## Model (exactly one)

**V2_DY_B**

```
D_B = clamp(60 + 3 · h_B)
h_B = 0.45 z(fav_minus_unfav) + 0.35 z(struct_activ)
    − 0.35 z(struct_disrupt) − 0.15 z(struct_excess)
z = robust z-score, clip ±2.5, scale floor 0.35
    (parameters fit on OLD_DEV + Fresh A only — never on B)

A_G = G_CLEAN_AXIS(year) − median_G(same Daewoon block)
B_trigger = 1.2 hap − 1.5 chung − 1.0 hyung − 0.8 pa_hae + 0.4 tg_career
annual_dev_B = 0.65 · A_G + 0.35 · B_trigger
Y = clamp(D_B + annual_dev_B)
```

Do **not** score H1/H2, orthodox numeric candidates, G-only, legacy engine, Month, Day, or any new candidate.

---

## Primary metric (full precision)

**SUBJECT-MACRO PAIRWISE ACCURACY**

For each eligible B subject, every frozen GOOD year vs every frozen BAD year:

- `good_score > bad_score` → 1
- tie → 0.5
- `good_score < bad_score` → 0

Internal values stay raw floats:

- `pairwise_raw`
- `sep_raw`
- `good_avg_raw`
- `bad_avg_raw`

Macro pairwise, subject hit, mean/median/standardized separation, and the subject-cluster bootstrap are computed from those raw values only.

Do **not** round per-subject pairwise and then macro-average.  
Do **not** round subject separation and then take median/std.

Round only when serializing the human-readable report/output.

Subject pairwise = mean of that subject's pairs.  
**Macro-average subjects equally** (do not weight by pair count).

---

## Guardrails (also reported)

A. Subject hit: `mean(GOOD) > mean(BAD)`  
B. Standardized separation: `mean(subject seps) / sd(all year scores)` (same as prior D/Y `_annual_metrics`)  
C. Subject median separation  
D. Distribution: positive / neutral / negative subjects; best / worst  
E. Subject-cluster bootstrap: **5,000** replicates, resample **subjects** (not pairs); seed **20260813**

Report bootstrap median, 95% interval, `P(pairwise > 0.50)`.  
Significance is **not** the sole pass criterion.

---

## Decision rules (fully mechanical)

Evaluate in this exact order. Do not alter after B is opened.

Let `n` = number of eligible scored B subjects.  
Subject-hit floor = `ceil(0.57 * n)` (for n=14 this is **8**).

1. **DATA_INTEGRITY_BLOCK** if integrity fails or required metrics are missing.
2. **ANNUAL_PASS** if all of:
   - macro pairwise ≥ 0.60
   - subject hit ≥ `ceil(0.57 * n)`
   - standardized separation > 0
   - median subject separation > 0
3. **ANNUAL_SUPPORTED_WITH_UNCERTAINTY** if all of:
   - macro pairwise ≥ 0.57
   - subject hit ≥ `ceil(0.57 * n)`
   - standardized separation > 0
   - median subject separation ≥ 0
4. **ANNUAL_FAIL** if:
   - macro pairwise < 0.50  
   **OR** all three:
   - subject_hit_rate < 0.50
   - standardized separation < 0
   - median separation < 0
5. else **ANNUAL_MIXED**

No non-operational wording. “Strong systematic negative” is exactly the three-way FAIL clause above.

---

## One-shot consumption lock

Path: `test/experiments/V2_VALIDATION_B_CONSUMPTION_LOCK.json`

On irreversible execution, **before** loading Validation B names/events:

- atomically exclusive-create the lock (`O_CREAT|O_EXCL`)
- if the lock already exists: **REFUSE**
- record: protocol version, `execution_started_at`, scorer hash, protocol freeze hash, model, `state = CONSUMED_STARTED`

If execution crashes after lock creation, Validation B is still **CONSUMED**.  
No automatic retry. Recovery is manual/forensic from already-written artifacts, not a second holdout experiment.

This protocol-freeze run does **not** create the lock.

After successful completion, update the same lock to `state = CONSUMED_COMPLETE` without erasing `execution_started_at`.

---

## Immutable outputs

Exclusive-create only (refuse if present):

- `test/snapshots/exp_v2_validation_b_raw.json`
- `test/snapshots/exp_v2_validation_b.json`
- `test/experiments/V2_VALIDATION_B_REPORT.md`

Raw snapshot is written **before** status narrative.

Raw snapshot is self-contained per eligible subject:

- subject identifier
- frozen good years
- frozen bad years
- scored Y by year
- D
- annual_dev
- pillar
- exclusion metadata

This allows later independent recomputation of primary metrics without editing/reopening labels.

---

## Eligibility integrity (after unseal, before scoring)

Preregistered expectation:

- Validation B total = 15
- eligible primary = 14
- preexisting exclusion set exactly: Albert Einstein / `engine_year_out_of_range(1879)`

Unexpected extra or missing exclusions → **DATA_INTEGRITY_BLOCK**.  
Do not silently accept an arbitrary “not in `eligible_for_primary_validation`”.

Every eligible B subject must have at least one frozen GOOD event and one frozen BAD event.  
Failure → **DATA_INTEGRITY_BLOCK**. B is still consumed once opened.

---

## Secondary diagnostics (after status is written)

Cannot change primary status.

Same-D / cross-D pairwise use the **same** pair convention as primary: 1 / 0.5 / 0.  
Do not count ties as 0.

Note: the frozen development headlines 0.5714 / 0.6531 were computed in Phase 2.6/2.7 with tie=0. The v1.1 self-test reproduces those headlines via that legacy convention, and uses 1/0.5/0 for the Validation B diagnostic.

Also report:

- B_PARENT_HELP / HARM / NET using **`annual_dev_B`**, not A-only  
  (Phase 2.7 definition: HELP = annual local wrong but Y correct via D; HARM = annual local correct but Y wrong)
- D distribution, AnnualDev distribution, saturation, score range

---

## Exclusions

Only exclusions **already encoded** in frozen `eligible_for_primary_validation`.

Public preexisting B exclusion:

- Albert Einstein — `engine_year_out_of_range(1879)`

No post-hoc exclusions after seeing scores. No label/event/date edits.

---

## Blind execution order (future run)

`validate_v2_b_one_shot.py --execute-validation-b`  
requires `V2_VALIDATION_B_EXECUTE=YES_IRREVERSIBLE`

1. verify hashes, including the scorer SHA256 vs this freeze  
2. refuse if lock or immutable outputs already exist  
3. exclusive-create consumption lock (**before** loading B names)  
4. verify split / Einstein-only exclusion / good+bad events  
5. load B  
6. compute all V2_DY_B scores (z from OLD+FA only)  
7. exclusive-create immutable raw snapshot  
8. primary metrics from RAW floats  
9. assign status mechanically  
10. exclusive-create result snapshot + report  
11. mark lock `CONSUMED_COMPLETE`

Do not print individual B results between steps 5 and 9.

---

## Month / Day (unchanged regardless of B)

| Layer | Status | Product policy |
|---|---|---|
| Month | `V2_MONTH_TIMING_ONLY` | `MONTH_LOW_CONFIDENCE_TIMING` |
| Day | `V2_DAY_TIMING_ONLY` | `DAY_EXPLANATION_ONLY` |

Strongest allowed claim after **ANNUAL_PASS**:

> V2 annual Daewoon/Sewoon scoring passed the predeclared unseen Validation B criteria.

Never: “full hierarchy validated.”

---

## After B is scored

- **No tuning on B.**
- PASS → freeze annual V2; next = blind real-user retrospective QA.
- SUPPORTED_WITH_UNCERTAINTY → keep V2 frozen; user QA as next independent evidence.
- MIXED or FAIL → do not repair using B labels; freeze B as consumed holdout; diagnose on user QA / a new future dataset.

Validation B can never become V2 development data.

---

## Hard stop (this run)

Scorer exists but **must not execute** Validation B here.  
Consumption lock must **not** be created here.
