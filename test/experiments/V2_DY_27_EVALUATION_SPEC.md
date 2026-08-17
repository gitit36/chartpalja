# V2 DY Phase 2.7A — Evaluation Correction Spec

**Status:** PREDECLARED before scoring  
**Date:** 2026-08-13  
**Scope:** Correct attribution for B / H1::CONS / H2::CONS — **no formula changes**  
**Val B:** SEALED · No Month/Day · No engine edits · No Phase 2.8

---

## 0. Erratum (Phase 2.6)

Phase 2.6 used **A** (`G − median_G`) as primary annual-local for PARENT_HELP/HARM.

Frozen B annual-local is:

```
annual_dev_B = 0.65 · A_G + 0.35 · B_trigger
```

**Architecture metrics from 2.6 remain valid** (final pairwise, hit, same/cross-D, OLD, D amplitude).  
Only **parent-attribution interpretation** is corrected here.

Max-gate pair stratification is replaced by **pair-level regime contrast**.

---

## 1. Models (frozen formulas)

| ID | Formula |
|----|---------|
| **B** | `Y = D_B + annual_dev_B` |
| **H1** | `Y = D_B + gate_corr_CONS + annual_dev_B` |
| **H2** | `Y = D_B + gate_corr_CONS + annual_dev_B + dy_CONS` |

No redesign. CONSERVATIVE gate amp / DY bounds as in Phase 2.6.

---

## 2. Local annual definitions

| Name | Formula | Role |
|------|---------|------|
| **FULL_B_ANNUAL_LOCAL** | `annual_dev_B` | **PRIMARY** for parent & decisions |
| **A_ONLY_LOCAL** | `A_G` | Secondary diagnostic / erratum compare |

---

## 3. Primary metric: MARGINAL value vs B

For each labeled good/bad pair:

| Tag | Meaning |
|-----|---------|
| B_CORRECT_CANDIDATE_CORRECT | both right |
| B_CORRECT_CANDIDATE_WRONG | **MARGINAL_HARM** |
| B_WRONG_CANDIDATE_CORRECT | **MARGINAL_HELP** |
| B_WRONG_CANDIDATE_WRONG | both wrong |
| B_TIE_CANDIDATE_RESOLVES | local B tie, candidate resolves |

```
MARGINAL_HELP_RATE = P(B wrong → cand correct)
MARGINAL_HARM_RATE = P(B correct → cand wrong)
MARGINAL_NET_VALUE = HELP − HARM
```

---

## 4. B’s own parent value (corrected)

Compare `sign(Δ annual_dev_B)` vs `sign(Δ Y_B)` on pairs:

B_PARENT_HELP / HARM / NET using FULL_B_ANNUAL_LOCAL.

Also report A-only matrix for erratum count of classification flips.

---

## 5. H2 D vs D×Y attribution

Store `delta_D_gate`, `delta_DxY`, `delta_total`.  
Classify changed pairs: D_ONLY_HELP/HARM, DXY_ONLY_*, D_AND_DXY_*, MIXED, UNCHANGED.

---

## 6. Pair regime contrast (predeclared, not tuned)

Per year: `dir`, `conf_eff`, `corr` (H1 corr; 0 for B), active independent group signed orientation.

```
PAIR_REGIME_CONTRAST =
  0.40 · min(1, |dir_g − dir_b| / 1.0)
+ 0.30 · min(1, |corr_g − corr_b| / 8.0)
+ 0.20 · min(1, |conf_g − conf_b| / 0.5)
+ 0.10 · group_orientation_contrast   # ∈[0,1]
```

Bands (exactly 3):

| Band | Range |
|------|-------|
| LOW | < 0.25 |
| MID | 0.25–0.55 |
| HIGH | ≥ 0.55 |

---

## 7. Uncertainty

- Bootstrap: **5000** subject resamples (not pairs)  
- Report median, 95% CI, P(net>0) for MARGINAL_NET overall + HIGH-contrast  
- Subject concentration: n subjects improve / worsen / tie  
- LOSO: leave-one-subject-out pairwise delta vs B

---

## 8. 2.7B gate (ALL required to proceed)

Proceed to continuous candidate **only if**:

A. H1 or H2 MARGINAL_NET FA ≥ 0 (point) **or** bootstrap P(net>0) ≥ 0.60 with median ≥ 0  
B. Improvements not from a single subject  
C. OLD MARGINAL_NET ≥ −0.02 (no strong opposite)  
D. HIGH pair-contrast band shows directional tendency (net ≥ 0 or better than LOW)  
E. FULL_B vs A_ONLY attribution differs on ≥ 5% of pairs (erratum meaningful) **OR** marginal story changes vs 2.6 conclusion

If fail → **do not run 2.7B** → `V2_DY_B_FINAL_FINAL_FREEZE`.

---

## 9. If 2.7B runs (preview; full spec separate)

One candidate only: `V2_DY_CONTINUOUS_REGIME`  
`Y = D_B + γ·tanh(k·signal) + annual_dev_B`  
No D×Y numeric. Same-D must equal B exactly.

---

## 10. Status vocabulary

- `V2_DY_27_CONTINUOUS_READY_TO_FREEZE`  
- `V2_DY_B_FINAL_FINAL_FREEZE`  
- `V2_DY_27_EVALUATION_ONLY`  
- `V2_DY_27_NOT_COHERENT`
