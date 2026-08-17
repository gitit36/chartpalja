# V2 DY Orthodox Attribution

**Status:** `V2_DY_ORTHODOX_EXPLANATION_ONLY`  
**Numeric:** `V2_DY_B`  
**Orthodox layer:** `V2_DY_ORTHO_SYSTEM::CONSERVATIVE`

---

## Why numeric Orthodox lost

1. Fresh A pairwise fell 0.6429 → 0.5893 (O2) / 0.5714 (O1).  
2. D_OVERRIDE rose 0.018 → 0.071 while rescue stayed ~0.107 → net parent fell.  
3. Same-Daewoon pairwise collapsed 0.57 → 0.43 (contextual annual noise).  
4. Ablation: removing contextual trigger **raises** FA pw to 0.607 — current contextual year valence is under-calibrated.  
5. High-regime cross pairs look good (0.80) but too few to dominate the aggregate.

---

## Double-count matrix

| family | Natal | D_CORE | D_ORTHO | G | Trigger | D×Y |
|---|---|---|---|---|---|---|
| fav_unfav_element | NONE | CORE | RELATED_BUT_DIFFERENT_TIMESCALE | RELATED_BUT_DIFFERENT_TIMESCALE | NONE | NONE |
| struct_activ_disrupt | NONE | CORE | RELATED_BUT_DIFFERENT_TIMESCALE | RELATED_BUT_DIFFERENT_TIMESCALE | NONE | NONE |
| G_CLEAN_AXIS | NONE | NONE | NONE | CORE | NONE | NONE |
| fixed_sign_ilju | NONE | NONE | NONE | NONE | DUPLICATE_IN_REF_ONLY | NONE |
| contextual_relations | NONE | NONE | CORE | RELATED_BUT_DIFFERENT_TIMESCALE | CORE | RELATED_BUT_DIFFERENT_TIMESCALE |
| DxY | NONE | NONE | NONE | NONE | NONE | CORE |
| shinsal | NONE | NONE | NONE | NONE | NONE | NONE |

No DUPLICATE family left active twice in the same orthodox layer. Residual RELATED overlap with G is accepted at different timescales.

---

## Ablations (Fresh A on O2 CONSERVATIVE)

| ablation | hit | pairwise |
|---|---|---:|
| full O2 | 8/14 | 0.5893 |
| no_dy_context | 9/14 | 0.5536 |
| no_contextual_trigger | 9/14 | **0.6071** |
| g_only_annual | 9/14 | 0.5893 |

Interpretation: D×Y helps ranking stability; contextual trigger currently harms; G remains the annual spine.

---

## Regime evidence distribution

Across development daewoon blocks: LOW 222 · MEDIUM 254 · HIGH 102 · TRANSFORMATIVE 122  
(Evidence classes exist even under B; B ignores strength for amplitude.)

---

## Case review — large jumps (≥10) under ortho

Examples (not patches):

- **Johnny Depp** 乙卯: Δ≈−11, strength MEDIUM, reasons include major_relation_change + key_pillar_change.
- Additional subjects with ≥10 jumps listed in `exp_v2_dy_orthodox.json` → `case_review`.

Jump validity FA: p(HIGH|Δ≥10) ≈ 0.40 (O2) / 0.56 (O1) — **not yet gate-passing**. Large jumps need stronger multi-family convergence before numeric adoption.

---

## Failure taxonomy (aggregate)

| Class | Notes |
|-------|-------|
| SEWOON_TRIGGER_FAIL | Contextual valence underperforms fixed-sign-free G spine |
| DAEWOON_STRENGTH_FAIL | Adaptive amp increases override without matching rescue |
| RELATION_RESOLUTION_FAIL | Ambiguous 합/충 still leak intensity |
| SPECIAL_STRUCTURE_UNCERTAIN | 从/化 branch soft |
| LABEL_AMBIGUITY | Celebrity year labels |
| NATAL_CONTEXT_UNCERTAIN | 相神 missing |

No named subject fixes.

---

## Product wiring recommendation

```
score_Y = V2_DY_B(Y)
explain  = RegimeChangeEvidence + contextual roles + event_intensity
           from V2_DY_ORTHO_SYSTEM (CONSERVATIVE mapping for display of regime class only)
```

Do not feed orthodox ΔD into the 0–100 total until a future V2.1 bounded correction (max one) after Month/Day — and only if Val B policy allows.
