# B9 Spec — Absolute Level vs Temporal Variation

**Status:** locked design + scaffold/harness allowed; production engine untouched  
**Date:** 2026-08-12 (patched: pop drift = mean raw; M_raw parent = S_raw; A freezes D=`종합운점수`)  
**Engine:** untouched until explicit promote  
**Supersedes for promote candidacy:** B7 daewoon (`year_resid` climate) — keep as **reference only**

---

## 0. Locked principle (do not alter)

> B9 separates absolute level from temporal variation. Daewoon owns the absolute level; Sewoon expresses centered within-Daewoon annual deviation; Month expresses centered within-year monthly deviation. Predictive performance may tune amplitude, but may not violate this hierarchy. Control-derived residuals are experimental corrections only and cannot define a parent layer.

### Intended assumptions

- Absolute life-quality **level** is owned only by the **parent** layer.
- Sewoon and month encode **relative temporal variation**, not independent absolute life-quality.
- Therefore, inside a bad daewoon block, a year with `general` above the block median may still receive a **positive annual shock**. That is intended, not a bug.
- If hierarchy / structural KPI thresholds are violated, **do not promote** even if predictive KPI (celebrity hit rate / separation) improves.

### Anti-patterns (explicitly forbidden)

- Defining “대운” with same-year sewoon materials (`open + scale·(general−close)` as climate parent).
- Letting Control `close` define a parent layer.
- Promoting a model that fails raw drift / daewoon constancy / saturation gates.
- Shipping Control-sewoon + additive-month as a production arm (debug ablation only).

---

## 1. Layer definitions

| Layer | Owns | Does **not** own |
|-------|------|------------------|
| **Daewoon** `D_b` | Absolute level for a ~10y block; **one fixed score** | Year-to-year shocks |
| **Sewoon** `S` | Centered within-block annual deviation around `D_b` | Replacing daewoon level |
| **Month** `M` | Centered within-year monthly deviation around `S_y` | Replacing sewoon level |

Centering baseline = **median**. Mean centering is an experiment switch only, never the default.

Squash / display mapping happens **after** raw hierarchy assembly. Structural rejection uses **raw** drifts first.

---

## 2. Baseline formulas

### 2.1 Daewoon (absolute, block-constant)

```text
D_b = one fixed absolute score per daewoon block
```

**First B9-A scaffold: freeze**

```text
D_b = build_daewoon_detail()[i]["종합운점수"]   # matched by daewoon_pillar
```

- **B-specific pillar score** = later **D-source experiment** only (not part of first A comparison).
- **`median(open within block)`** = **fallback only** if pillar `종합운점수` missing; not in the first A arm comparison matrix.

**Invariant:** `SD(D within block) == 0` (same `D_b` for every year in the block).

### 2.2 Sewoon materials

```text
G_y  = year_score_pure_from_meta(meta_y)   # B general, no daewoon blend / no yindep_amp
C_b  = median(G_y within block)
A_y  = G_y - C_b                           # annual shock (block-centered)
```

### 2.3 Sewoon baseline (B9-A)

```text
S_raw_y = D_b + α * A_y
S_y     = squash(S_raw_y)                  # display only
```

Property: `A_y = 0 ⇒ S_raw_y = D_b` (“ordinary year = daewoon climate”).

**Initial baseline purity:** no interaction term. Keep B9-A as:

```text
D  →  D + αA  →  (month path)
```

### 2.4 Control residual — **permanently rejected**

B9-B κ sweep (`exp_b9b_kappa_sweep.json`) found **no clear holdout incremental value**.

```text
Frozen promote path:
  alpha = 1.0
  kappa = 0
  S_raw = D + A
```

- **`R` / `κ` removed from promote candidacy.**
- **B9-D is not a production candidate** (only differed from C by rejected `R`). Do not run B9-D for promote.
- Residual formula remains documented for historical/debug ablation only.

### 2.5 Month (B9-C only for promote)

Do **not** call the recovered signal “month independent score”. Name it:

```text
E_ym = estimated_month_resid
```

Recovery (implementation detail for scaffold; naming is mandatory):

```text
# From Control month final + Control sewoon parent (engine blend weights for recovery only)
E_ym = recover_indep(control_month, control_sewoon, pw, cw)
# → estimated residual, not ground-truth indep (clamp/synergy/nonlinear already applied)
```

Then (latent hierarchy — **raw parent = `S_raw`**, not display `S`):

```text
C_y     = median(E_ym within year)
Q_ym    = E_ym - C_y
M_raw   = S_raw_y + β * Q_ym
M       = squash(M_raw)
```

**Frozen B9-C (after material diag + β sweep):**

```text
beta = 0.25
ARM_VERSION = B9C_beta_0.25
snapshots: exp_b9c_month_material.json, exp_b9c_beta_sweep.json
```

Selection used structural gates first (incl. median month/year variation ratio < 1), then holdout hit / pairwise / std_sep — **not raw_sep alone**. B8 remains reference only.

### 2.6 Permanent hierarchy freeze (robustness lock)

Do **not** retune during robustness / shadow validation:

```text
alpha = 1.0
kappa = 0
beta  = 0.25
centering = median
D = engine daewoon 종합운점수
interaction = off
synergy = off
S_raw = D + A
M_raw = S_raw + β·Q
```

Harness: `validate_b9_robustness.py` → `exp_b9_robustness.json`.

Display diagnostic (squash path only; not the latent parent):

```text
compare mean/median(M - S) separately
```

No synergy / interaction in first additive month baseline.

---

## 3. Experiment arms

| Arm | Sewoon | Month | Role |
|-----|--------|-------|------|
| **B7 / B8** | Current (`year_resid` climate blend + amp) | Current B8 remap | **Reference only** |
| **B9-A** | `D + αA` (α=**1.0** frozen) | Current B8 / engine-like month path | **Promote baseline sewoon** |
| **B9-B** | `D + αA + κR` | Same as A | **Rejected permanently** |
| **B9-C** | Same as A | `S_raw + βQ` | **Active** month arm |
| **B9-D** | B + C | C | **Not a production candidate** (R rejected) |

**Not a production arm:** Control sewoon + additive month. Use only in Brown/Gore-style **debug ablations**.

### Execution order (locked)

1. Spec (this doc)  
2. Data-field map + scaffold locations (below) — **no prod edits**  
3. B9 arm scaffold (new files / versions under `test/experiments/`)  
4. Raw/display structural KPI harness  
5. **Run B9-A only** until structural gates pass  
6. Only then run B / C / D  
7. Keep B7 daewoon as reference; **exclude from promote candidates**

---

## 4. KPIs

### 4.1 Predictive (tune amplitudes inside hierarchy)

- Sewoon: train / holdout good−bad separation & pass rate (existing `common.pack_sep` / cohort split).
- Daewoon: **block / decade** separation only (not year-varying climate).
- Month: `month_day_labels.json` separation (existing Phase 6B2 labels), after C is enabled.

Predictive wins **cannot** override structural rejects.

### 4.2 Structural — raw vs display (mandatory split)

**Daewoon**

```text
SD(D within block) == 0
```

**Sewoon — per-block invariant (median centering check)**

```text
|median(S_raw - D within block)| <= 1
```

Under median centering of `A_y`, this is expected ≈0; keep as **invariant**, not as the population gate.

**Sewoon — population systematic drift (rejection; MEAN raw)**

```text
block_mean_drift = mean(S_raw - D within block)
population_annual_drift = aggregate(block_mean_drift across blocks/subjects)
|population_annual_drift| <= 2 points
```

Do **not** define population drift as mean-of-block-medians (tautologically ~0 under median centering).

**Sewoon display (diagnostic only)**

```text
mean(S - D)
median(S - D)
```

**Month — per-year invariant**

```text
|median(M_raw - S_raw within year)| <= 1
```

**Month — population systematic drift (rejection; MEAN raw)**

```text
year_mean_drift = mean(M_raw - S_raw within year)   # parent_raw = S_raw
population_month_drift = aggregate(year_mean_drift across years/subjects)
|population_month_drift| <= 2 points
```

**Month/year variation guard (B9-C)**

```text
annual_variation_b   = SD(S_raw - D within daewoon block)
monthly_variation_y  = SD(M_raw - S_raw within year)
month_to_year_variation_ratio = monthly_variation / annual_variation
```

Population median of monthly_variation should not exceed population median of annual_variation  
(initial conceptual guard: **median ratio < 1**). Month remains the lower-amplitude child.
**Interpretation**

| Observation | Diagnosis |
|-------------|-----------|
| Per-block/year median invariant fails | Hierarchy / assembly bug |
| Population **mean** raw drift fails | Systematic level leakage / bias |
| Raw OK, display drifts | Squash / calibration / edge saturation |
| Predictive OK, structural fail | **No promote** |

### 4.3 Saturation

```text
P(score <= 2 or score >= 98)
```

**Measured baseline (2026-08-12, primary core n=14, engine `candle.close` all years in timeline):**

| Metric | Value |
|--------|-------|
| n scores | 1400 |
| `P(≤2 ∨ ≥98)` | **0.00%** |
| min / max | 30.0 / 92.0 |
| p01 / p99 | 40.0 / 85.0 |
| `P(≤5 ∨ ≥95)` | 0.00% |

**Locked rejection threshold (SPEC number):**

```text
P(score <= 2 or score >= 98) < 0.02   # 2%
```

Rationale: engine Control sits far from walls; B amps may push extremes. Soft warn at 1%; hard reject at **2%**. Revisit only with recorded distribution note if B9-A display saturates under honest amplitude needed for predictive gates.

Apply saturation check to **display** scores (`S`, `M`, and reference arms). Raw may exceed `[0,100]` before squash — that is allowed; harness should track raw out-of-range rate separately as diagnostic (not the same gate).

---

## 5. Decision rules

1. Raw drift fail → fix structure; do not tune α/β to paper over.  
2. Display-only drift → adjust squash / amp / calibration.  
3. Structural threshold fail → **promote forbidden**.  
4. `B9-B`: **rejected** — do not reintroduce `R` into promote path.  
5. `B9-C` after A freeze; **do not run B9-D** for promote.  
6. B7/B8 remain reference only.

---

## 6. Mapping to current codebase (reuse / locations)

**No production (`saju_engine.py`) edits in B9 scaffold phase.**

### 6.1 Reuse

| Need | Source |
|------|--------|
| Subjects / cohorts | `common.load_core_subjects`, `phase_config` soft_exclude / holdout |
| Year meta + Control close | `common.engine_year_maps` → `meta[y]`, `candle.close` |
| Control open (fallback D) | `meta[y]["candle"]["open"]` |
| Daewoon pillar id | `meta[y]["대운_pillar"]` |
| Engine pillar absolute score | `saju_engine.build_daewoon_detail(r)` → `daewoon_pillar`, `종합운점수`, `start_year`/`end_year` |
| B `G_y` (general) | `arm_b.year_score_pure_from_meta(meta)` / `_axis_scores` materials |
| Month Control series | `saju_engine.build_monthly_timeline` → `scores["종합"]`, parent open |
| Month resid recovery helper | `lower_hierarchy.recover_indep`, `blend_weights` (weights for **recovery identity only**, not B9 month blend) |
| Month labels | `md_labels.py` + `month_day_labels.json` |
| Sep / tally | `common.pack_sep`, `prepare_events`, `tally` |
| Reference arms | `arm_b` B7, `arm_b_month` B8, `arm_control`, `arm_a_proto` |

### 6.2 New (scaffold phase — not written yet)

Suggested (names indicative):

| Artifact | Role |
|----------|------|
| `test/experiments/B9_SPEC.md` | This document |
| `test/experiments/arm_b9.py` (or `b9_hierarchy.py`) | `D_b`, `A_y`, `S_raw`/`S`, optional `R`, arm A/B |
| `test/experiments/arm_b9_month.py` | `E_ym`, `Q_ym`, `M_raw`/`M` for C/D |
| `test/experiments/b9_structure_kpi.py` | Raw/display drift, SD(D), saturation |
| `test/experiments/compare_b9_arms.py` / sweep | A→B→C→D order enforcement |
| Snapshots under `test/snapshots/exp_b9_*.json` | Frozen metrics |

### 6.3 Raw vs display (naming contract)

| Symbol | Kind | Notes |
|--------|------|-------|
| `D_b` | Absolute level | Already on display scale ideally; still treat as level constant |
| `G_y`, `A_y`, `R_y`, `E_ym`, `Q_ym` | Materials / shocks | Not final chart scores |
| `S_raw_y`, `M_raw_ym` | **Raw** hierarchy outputs | Structural reject: sewoon vs `D`; month vs **`S_raw`** |
| `S_y`, `M_ym` | **Display** | After `squash`; `M−S` is squash diagnostic only |
| Engine `candle.close` / month `종합` | Control display | Reference |

### 6.4 Where squash / clamp occurs today vs B9

**Today (B7/B8 / engine) — do not use as B9 hierarchy grammar:**

| Location | What |
|----------|------|
| `arm_b._clamp` in `_axis_scores` | Per-axis and `general` already clamped to `[0,100]` when building `G_y` |
| `arm_b._amplified_indep` | Clamp after `yindep_amp` |
| `arm_b.daewoon_score_from_meta` | Clamp climate |
| `arm_b.year_score_from_meta` | Clamp final sewoon blend |
| `lower_hierarchy.clamp` in `remap_child` / `amplify_around` | Month/day remap |
| `saju_engine._composite_score` + candle int rounding | Engine display path |

**B9 target:**

| Stage | Squash? |
|-------|---------|
| Build `G_y` | Inherit existing axis clamps inside `_axis_scores` for now (known limitation; optional future: latent unclamped general) |
| `S_raw = D + αA` | **No** clamp on the sum before KPI raw checks |
| `S = squash(S_raw)` | **Yes** — single display gate to `[0,100]` |
| `M_raw = S_raw + βQ` | **No** clamp before month raw KPI; parent is **`S_raw`**, not display `S` |
| `M = squash(M_raw)` | **Yes**; compare `M−S` as squash diagnostic only |

Document limitation: if `G_y` is already hard-clamped inside `_axis_scores`, annual shocks are slightly distorted. B9-A still proceeds; a later phase may expose unclamped latent general without changing hierarchy grammar.

### 6.5 Engine fields cheat-sheet

```text
Year meta (from cy._year_scores / timeline):
  meta[y]["대운_pillar"]
  meta[y]["candle"]["open"]    # ≈ engine daewoon parent for that year
  meta[y]["candle"]["close"]   # Control sewoon
  (+ yfit / relation / … for G_y)

Daewoon detail row:
  daewoon_pillar, 종합운점수, start_year, end_year, start_age_years, end_age_years

Month row:
  scores["종합"], candle["open"] (sewoon parent for that year)
```

---

## 7. B7 parameters unused / removed for B9-A promote path

B9-A **must not** use the following as hierarchy parents or blend knobs (they remain on disk for B7 reference):

| Param / mechanism | B7 role | B9-A |
|-------------------|---------|------|
| `dae_climate_mode=year_resid` | “대운 climate” | **Forbidden** as daewoon definition |
| `dae_resid_scale` (2.10) | Scale on `(general−close)` into climate | Unused for A; only related to experimental `R` scaling via **`κ`**, not this param |
| `daewoon_blend` (0.38) | Convex weight on climate parent | **Unused** — replaced by additive `D + αA` |
| `daewoon_parent=climate` | Parent selector | Unused |
| `yindep_amp` (2.93) | Amplify general around base before blend | **Unused** in A (shock amp is **`α`** on centered `A_y`) |
| `dae_open_weight`, `dae_gen_amp` | `block_blend` path | Unused |
| `block_resid` / `block_blend` modes | Alt climate | Not B9-A daewoon; D is pillar/median(open) |
| Convex `(1−α)·indep + α·parent` | Sewoon mix | Replaced by additive |

**Still reused as materials (not hierarchy):** `_axis_scores` / pattern pens / domain weights that produce `G_y` (`w_career`, discord, hollow, health_guan, …). Tuning those is orthogonal and must not reintroduce year_resid into `D_b`.

**Month B8 params** (`parent_w=0.715`, `child_amp=1.71`, …): remain for B9-A/B **month reference path**; unused by B9-C/D additive month (replaced by **`β`** on `Q_ym`).

---

## 8. Unresolved hyperparameters (explicitly not locked)

| Symbol | Meaning | Status |
|--------|---------|--------|
| **`α`** | Annual shock amplitude on `A_y` | **Frozen = 1.0** (`B9A_alpha_1`; diag superseded provisional 1.25 — see `exp_b9a_alpha_diag.json`) |
| **`β`** | Monthly shock amplitude on `Q_ym` | **Frozen = 0.25** (`B9C_beta_0.25`; `exp_b9c_beta_sweep.json`) |
| **`κ`** | Residual correction on `R_y` | **Rejected** after B9-B sweep (`exp_b9b_kappa_sweep.json`); keep κ=0 / B9-A |
| **Saturation threshold** | `P(≤2∨≥98) < 0.02` | **Set in §4.3**; may be revised only with new distribution note |
| **`D_b` source** | First A scaffold = engine `종합운점수` only; B-pillar / median(open) later | Frozen for A |
| Mean vs median centering | Median = baseline; mean = option | Not default |
| Interaction / synergy | — | **Off** for first A/C baselines |
| Squash function shape | Default hard clamp `[0,100]`; soft logistic optional later | Default = hard clamp |
| Latent unclamped `G_y` | Optional future | Not required for A scaffold |

---

## 9. Philosophical note (for reviewers / later confusion)

> Annual and monthly components encode relative temporal variation, not independent absolute life-quality levels. Absolute level is inherited from the parent layer.

Example: block generals `30,31,33,35,…` with `D_b=35` → years above block median get **positive** `A_y` even if absolute general is “low”. The bad era is expressed by **`D_b`**, not by forcing every year negative.

---

## 10. Out of scope (this SPEC)

- Editing `saju_engine.py` / API / chart UI  
- Promoting B9 to production  
- Day layer B9 (same grammar later: day = month + within-month deviation)  
- Optuna / large HP search before A structural pass  

---

## 11. Next agent step (after this file)

1. Implement scaffold + structure harness only.  
2. Freeze B9-A smoke snapshot.  
3. Do **not** run B/C/D until A passes §4.2 / §4.3.

---

*End of B9_SPEC.md*
