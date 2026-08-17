# V2 DY Hierarchy 2.6 Spec — Confidence-Gated Daewoon → Sewoon

**Status:** PREDECLARED before scoring  
**Date:** 2026-08-13  
**Phase:** 2.6 — final D/Y numeric experiment for V2  
**Val B:** SEALED · **Engine:** untouched · **No Month/Day · No H3 · No G redesign**

---

## 0. Philosophy erratum (vs earlier phases)

| Old framing | Correct framing |
|-------------|-----------------|
| “D_OVERRIDE is bad” | Parent changing annual order is **allowed** |
| “Minimize override” | Evaluate **PARENT_HELP / PARENT_HARM / NET_PARENT_VALUE** |
| “D must not dominate Y” | Time hierarchy ≠ fixed weight hierarchy |
| “Y must stay near D” | Sewoon **may cross** Daewoon baseline |

Parent influence must be **conditional, earned, and useful**.

---

## 1. Frozen references

**Numeric annual spine (immutable):** `V2_DY_B`

```
D_B = clamp(60 + 3 · h_B)   # z-clipped structure-only
A_G = G_CLEAN_AXIS − median_G(block)
annual_dev_B = 0.65 · A_G + 0.35 · B_trigger
Y_B = clamp(D_B + annual_dev_B)
```

**Orthodox structure (reuse, no redesign):** Phase 2.5  
`NatalContext`, `RegimeChangeEvidence`, direction/strength/confidence, D×Y family, event_intensity.

**Do NOT** restore orthodox contextual year trigger as annual valence.

---

## 2. Hierarchy (not fixed weights)

```
Y_final = D_effective + AnnualDev_B + optional_DxY
```

No 70/30. No forced Y≥D or Y≤D. Crossing baseline is allowed and desired when Sewoon is strong.

---

## 3. Direction vs strength (hard rule)

- `D_DIRECTION` ∈ [−1,1] — favorable / unfavorable / mixed  
- `D_STRENGTH` / gate — how much regime alters natal structure  
- High strength + near-zero direction → **event intensity**, **restrained signed ΔD**

---

## 4. Evidence family independence (logic fix, not new features)

Independent groups (count ≤1 contribution each toward convergence):

| Group | Dims (from Phase 2.5) |
|-------|------------------------|
| ELEMENTAL_USEFULNESS | elemental_environment_shift, yong_xiang_support_shift |
| STRUCTURAL_STATE | structural_activation_shift, geju_state_change |
| ROOTING_MANIFESTATION | rooting_exposure_change, stem_branch_convergence |
| RELATION_STRUCTURE | major_relation_change |
| KEY_PILLAR | key_pillar_change |
| SEASONAL_TIAOHOU | tiaohou_change |
| SPECIAL_STRUCTURE | special_structure_change |

Related dims in one group do **not** stack as independent votes.

---

## 5. NatalContext confidence

```
natal_context_confidence ∈ [0.45, 1.0]
```

Penalties (multiplicative damp):

- xiangshen_uncertain: −0.10  
- special_structure uncertain / missing clarity: −0.08  
- tiaohou unavailable: −0.05  
- strength_regime empty: −0.07  

Combined:

```
regime_confidence_eff = regime_confidence × natal_context_confidence
```

High amplitude requires both.

---

## 6. DaewoonInfluenceGate (predeclared)

Inputs: independent agreeing groups, |direction|, contradiction, regime_confidence_eff.

| Gate | Rule (all must hold) |
|------|----------------------|
| **LOW** | n_indep_agree ≤ 1 OR \|dir\| < 0.15 OR contrad ≥ 2 OR conf_eff < 0.45 |
| **MEDIUM** | not LOW; n_indep_agree = 2; \|dir\| ≥ 0.15; contrad ≤ 1 |
| **HIGH** | n_indep_agree ≥ 3; \|dir\| ≥ 0.25; contrad = 0; conf_eff ≥ 0.55 |
| **TRANSFORMATIVE** | n_indep_agree ≥ 4; \|dir\| ≥ 0.40; contrad = 0; conf_eff ≥ 0.70 — **rare** |

If strength would be HIGH/TRANS but \|dir\| < 0.20 → force **GATE_MEDIUM** max for **signed** correction; store high `event_intensity`.

---

## 7. Gated amplitude maps (exactly 3; frozen)

Signed correction magnitude when \|direction_unit\|=1 (points added to D_B):

| Map | LOW | MEDIUM | HIGH | TRANSFORM |
|-----|-----|--------|------|-----------|
| **CONSERVATIVE** | 0 | 2 | 6 | 10 |
| **BALANCED** | 0 | 3 | 9 | 14 |
| **EXPRESSIVE** | 1 | 4 | 12 | 18 |

```
direction_unit = tanh(0.7·tanh(h_B) + 0.3·direction_score)   # H uses B+ortho blend
correction = direction_unit × map[gate] × (0.70 + 0.30·conf_eff)
D_effective = clamp(D_B + correction)
```

LOW gate → near-zero correction (CONSERVATIVE/BALANCED: exactly 0 scale).

---

## 8. Candidates (exactly 2 + reference)

### REFERENCE — `V2_DY_B`

Unchanged.

### H1 — `V2_DY_GATE_D_ONLY`

```
Y = clamp(D_effective + annual_dev_B)
```

No D×Y.

### H2 — `V2_DY_GATE_D_PLUS_DY`

```
dy_signed = clip(κ(gate) · reinforce_score, ±c(gate))
  # κ,c: LOW (0,0) · MED (0.6,1.5) · HIGH (1.0,2.5) · TRANS (1.2,3.0)
  # zero if D×Y valence ambiguous or gate LOW
Y = clamp(D_effective + annual_dev_B + dy_signed)
```

Uses Phase 2.5 D×Y **reinforce / pillar relation** only — not orthodox year trigger.

---

## 9. Metrics terminology

| Name | Definition |
|------|------------|
| **PARENT_HARM** | Annual-local (A) ranking correct; final Y ranking wrong |
| **PARENT_HELP** | Annual-local wrong; final Y correct **and** D contributed (ΔD same sign as win) |
| **NET_PARENT_VALUE** | HELP − HARM rates |

Parent correction matrix (cross-D): LOCAL_CORRECT_PARENT_PRESERVES / HARMS / HELPS / STILL_WRONG / TIE_RESOLVES / STRENGTHENS.

---

## 10. Pair regime difference

For cross-D pairs:

```
pair_regime_diff =
  |D_dir_i − D_dir_j| × 0.5
+ |gate_rank_i − gate_rank_j| / 3 × 0.5
```

Classes: LOW (<0.25) · MEDIUM · HIGH (≥0.55) · TRANSFORM if either gate TRANS and |Δdir|≥0.35.

---

## 11. Selection / tolerances (predeclared)

Priority: FA overall → FA cross-D → FA high-regime cross → FA same-D → OLD → net parent → gate calibration → distinctiveness → simplicity.

**Engineering tie band:** |Δ FA pairwise vs B| ≤ **0.015**.

**STRONG promote:** overall ≥ B−0.015 AND (cross-D or high-regime improved) AND same-D ≥ B−0.02 AND HIGH-gate NET_PARENT ≥ 0 AND LOW-gate |mean correction| small.

**Reject numeric gate if:** HIGH-gate net parent < 0 · same-D materially down · FA overall < B−0.015 · LOW gate gets large corrections · jump validity still poor · crossing disappears.

---

## 12. Status vocabulary

- `V2_DY_HIERARCHY_26_READY_TO_FREEZE`  
- `V2_DY_B_FINAL_NUMERIC_FREEZE`  
- `V2_DY_HIERARCHY_26_EXPLANATION_ONLY`  
- `V2_DY_HIERARCHY_26_NOT_COHERENT`

No Phase 2.7 after this.
