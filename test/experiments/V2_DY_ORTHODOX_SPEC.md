# V2 DY Orthodox Spec (Phase 2.5)

**Status:** PREDECLARED before scoring — freeze semantic rules  
**Date:** 2026-08-13  
**Reference:** `V2_DY_B` (STRUCTURE_TRIGGER) numeric backbone  
**Candidates:** O1 `V2_DY_ORTHO_CONTEXT` · O2 `V2_DY_ORTHO_SYSTEM`  
**No O3. No Ridge. No Val B. No engine edits. No Month/Day.**

---

## 1. Purpose

Preserve V2_DY_B’s predictive improvement (low D_OVERRIDE, FA pairwise ~0.64) while restoring missing Natal → Daewoon → Sewoon traditional structure.

Rich observation → selective numeric contribution.

---

## 2. Candidates

### REFERENCE — V2_DY_B

Exact frozen formulas from `experiment_v2_dy.py`:

```
h_B = 0.45 z(fav_minus_unfav) + 0.35 z(struct_activ)
    − 0.35 z(struct_disrupt) − 0.15 z(struct_excess)
D   = clamp(60 + 3 · h_B)   # z_clip±2.5, scale_floor=0.35

A   = G_CLEAN_AXIS − median_G(block)
trigger = 1.2 hap − 1.5 chung − 1.0 hyung − 0.8 pa_hae + 0.4 tg_career
annual_dev = 0.65 A + 0.35 trigger
Y = clamp(D + annual_dev)   # ctx = 0
```

### O1 — V2_DY_ORTHO_CONTEXT

- Keep **D_CORE_B direction signal** `h_B` as primary directional backbone.
- Multiply by **adaptive regime strength** from `RegimeChangeEvidence` (not label-trained).
- Replace fixed-sign year triggers with **contextual valence**.
- Add **small explicit D×Y** context.
- Separate **event_intensity** from valence.

```
D_dir_unit = tanh(h_B)                         # ∈ (−1,1)
strength   = f(RegimeChangeEvidence)           # ∈ [0.25, 1.75] approx
D          = clamp(BASE + γ · D_dir_unit · strength · SCALE)

annual_dev = 0.60 A_G + 0.25 contextual_trigger + 0.15 dy_context
Y          = clamp(D + annual_dev)
```

### O2 — V2_DY_ORTHO_SYSTEM

Fuller structure-informed system:

```
D_DIRECTION = sign/mag from multi-family evidence (not only h_B)
D_STRENGTH  = convergence index with contradiction penalty
D           = BASE + map(amp_family, D_DIRECTION × D_STRENGTH)

Sewoon:
  A_G centered (non-duplicated role vs new families)
  + contextual natal triggers
  + contextual D×Y
  + event_intensity (no automatic valence)

Y = D + annual_dev
```

---

## 3. NatalContext (reusable, no new natal calculator)

Built from `enrich_saju` / pack `r`:

| Field | Source |
|-------|--------|
| day_master | 원국 day stem |
| season / month branch | 원국 month |
| strength_regime | 신강신약.판정 |
| five_element_distribution | 병인진단.오행분포_raw / ohang |
| excess / deficiency | 과다/부족 |
| yong / hee / gi / gu | 용신 dict |
| geju | 격국 |
| special_structure | 종격/화격 type or normal |
| tiaohou_needs | 조후용신 |
| structural_disease | 병인진단 |
| natal stems/branches/hidden | pillars + jijanggan |
| internal relations | calc_relations summary |

Missing 相神 → `xiangshen_uncertain`; no invented theory.

---

## 4. RegimeChangeEvidence (transparent, not trained)

Independent dimensions (each: `+` / `−` / `mixed` / `inactive` / `ambiguous`):

1. `elemental_environment_shift` — fav vs unfav supply  
2. `yong_xiang_support_shift` — activation vs disruption (+ gu)  
3. `structural_activation_shift` — excess reinforcement / disease resolution proxy  
4. `geju_state_change` — special vs ordinary; type-aware branch  
5. `tiaohou_change` — johu element present/opposed when johu known  
6. `rooting_exposure_change` — stem rooted in own branch / exposes useful hidden  
7. `major_relation_change` — contextual 합/충 vs useful-harmful targets  
8. `key_pillar_change` — hits on 月支 / 日支  
9. `stem_branch_convergence` — stem & branch same directional sign  
10. `special_structure_change` — cong/hwa support vs ordinary rules  

Derive:

- `direction_score` ∈ [−1, 1] (agreeing families)  
- `contradiction_count`  
- `strength_class` ∈ {LOW, MEDIUM, HIGH, TRANSFORMATIVE}  
- `confidence` ∈ [0, 1]

**Contradiction rule:** opposing high-weight families → MIXED_REGIME → lower strength.

**Large jump gate:** |ΔD| > 10 requires ≥ MEDIUM with ≥ 2 independent agreeing families; |ΔD| > 20 requires HIGH/TRANS with ≥ 3 families and low contradiction. Failures flagged in jump-validity QA (not silent).

---

## 5. Amplitude mappings (max 3 per semantic candidate)

Predeclared only — not a pairwise maximizer:

| Family | LOW | MEDIUM | HIGH | TRANS |
|--------|-----|--------|------|-------|
| CONSERVATIVE | 2 | 5 | 10 | 16 |
| BALANCED | 3 | 8 | 14 | 22 |
| EXPRESSIVE | 4 | 10 | 18 | 28 |

O1 default try order: BALANCED → CONSERVATIVE → EXPRESSIVE (pick by stability + jump validity + net parent value, not FA max alone).  
O2 same three mappings.

`D = BASE + direction_unit × mapped_strength` (clamped 0–100).

**No** adjacent p90≤6 or hard context cap=2.

---

## 6. Contextual relation / ten-god rules

### Relations

Raw patterns → classify vs NatalContext useful/harmful mechanisms and pillar targets:

| Pattern | Possible roles |
|---------|----------------|
| 合 / 삼합 / 방합 | SUPPORTS_USEFUL · BINDS_USEFUL · SUPPORTS_HARMFUL · TRANSFORMS_* · AMBIGUOUS |
| 冲/刑/破/害 | CLASHES_USEFUL · CLASHES_HARMFUL · RELEASES_BINDING · STRUCTURAL_MOVEMENT · AMBIGUOUS |

**合化:** only `TRANSFORMS_CONFIRMED` when engine/合化정보 supports; else NOT_CONFIRMED → no transform valence.

**Resolution:** if both 합 and 충 on same branch pair, prefer resolved note (合解冲 / 冲解合 heuristics from presence); do not sum both full bonuses.

### Ten gods

No universal 재관+, 상겁−.

Roles: SUPPORTS_USEFUL_STRUCTURE · SUPPLIES_NEEDED · DRAINS_EXCESS · FEEDS_HARMFUL · OVERBURDENS_WEAK · AMBIGUOUS · NEUTRAL.

Store separately:

- `domain_activation` (career/wealth/output/resource/peer/…)  
- `directional_effect` (−1..+1 or ambiguous)

Sewoon additionally: REINFORCE / TRIGGER / COUNTER / RESOLVE_PRESSURE / AMPLIFY_PRESSURE / ACTIVATE_NEW_DOMAIN vs current D.

### 12운성 / 공망 / 신살

- 12운성: small contextual vitality modifier only if strength regime resolves direction; else interpret-only  
- 공망: secondary damp on activation (≤ small)  
- 신살: **explanation only** — zero numeric core  

### 묘고

No “冲墓 = open treasury = good.” Treat as relation/운성 context only.

---

## 7. D×Y interaction

`DaewoonSewoonContext`:

- Year stem/branch vs D stem/branch elemental & relation  
- Year ten-god vs D regime direction  
- Reinforce / counter / neutral  

`dy_context = clip(κ · reinforce_score, ±c)` with κ small (O1: c≈2.5; O2: c≈4).

---

## 8. Event intensity ≠ valence

Intensity sources (no automatic sign):

- Strong clash / multi-relation convergence  
- 伏吟 / 反吟 / 岁运并临 (same pillar D↔Y, natal↔Y, natal↔D)  
- Multiple agreeing triggers  

Intensity may scale |contribution| of an already-resolved valence, or stay explanation-only if valence AMBIGUOUS.

---

## 9. Duplicate prevention vs G_CLEAN_AXIS

| Family | Natal | D_CORE_B | D_ORTHO | G | Y trigger | D×Y |
|--------|-------|----------|---------|---|-----------|-----|
| fav/unfav element | — | CORE | RELATED | RELATED | — | — |
| struct activ/disrupt | — | CORE | RELATED | RELATED | — | — |
| G_CLEAN_AXIS composite | — | — | — | CORE | OVERLAP if restacked | — |
| ilju 합충 fixed sign | — | — | — | — | DUPLICATE if also contextual | — |
| contextual relations | — | — | CORE | RELATED timescale | CORE | RELATED |
| D×Y | — | — | — | — | — | CORE |
| 신살 | — | — | EXCL | EXCL | EXCL | EXCL |

Rule: O1/O2 **do not** add another G-like composite. A_G remains the annual material reference once. Contextual trigger replaces B’s fixed-sign trigger (not stacked on top of it at full weight).

---

## 10. Metrics & acceptance

Report OLD_DEV + FRESH_A_DEV: hit, pairwise, raw/std sep; same-D vs cross-D; high vs low regime-diff cross-D.

D: OVERRIDE, RESCUE, NET_PARENT_VALUE; jump distribution; jump validity; flatness.

**Win:**

- **Strong:** metrics improve + structure + distinctiveness  
- **Acceptable:** metrics ≈ tie + orthodox logic + explainable jumps + D not harmful  
- **Reject numeric:** structure richer but metrics materially worsen → keep B numeric + ORTHODOX_CONTEXT_INTERPRETATION  

Reference anchors: FA pw 0.6429 · OLD 0.5749.

---

## 11. Ablations (selected winner only, descriptive)

Disable one at a time: 月令 efficacy, rooting, 调候, contextual ten-god, natal relations, relation-resolution, geju, D×Y, event intensity, 12운성, 공망.

No recursive retune from ablations.

---

## 12. Status vocabulary (exactly one)

- `V2_DY_ORTHODOX_READY_TO_FREEZE`  
- `V2_DY_ORTHODOX_EXPLANATION_ONLY`  
- `V2_DY_B_REMAINS_BEST`  
- `V2_DY_ORTHODOX_FOUNDATION_ISSUE`
