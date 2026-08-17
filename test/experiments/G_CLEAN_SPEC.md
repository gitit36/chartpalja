# G-CLEAN Experiment Spec

**Phase:** G-CLEAN-1 / G-CLEAN-2 / G-CLEAN-3  
**Date:** 2026-08-12  
**Status:** diagnosis only — no weight search, no optimizer, no engine edit, no B9 hierarchy change

## Frozen (do not touch)

```text
alpha = 1.0
kappa = 0
beta  = 0.25
D     = engine daewoon 종합운점수
centering = median
S_raw = D + A
M_raw = S_raw + β·Q
interaction = off
synergy = off
```

`saju_engine.py` untouched. Hierarchy evaluation always uses B9-A with the above.

## Contamination rule

Every name in `test/yongshin_subjects.json` is **DEVELOPMENT / CONTAMINATED**.  
No person in that file is fresh validation — including prior “holdout”, unused, or candidate tiers.

Development metrics in this phase are for architecture comparison only, **not** final generalization claims.

## Goals

1. De-stack multi-path pattern injection (CLEAN-1).  
2. Isolate pattern / heuristic families (CLEAN-2).  
3. Test whether career/health/relationship is necessary as a **model-generating** layer vs explanation layer (CLEAN-3).  
4. Explain career dominance without retuning.  
5. Measure axis orthogonality via residualization (diagnostic only).  
6. Prepare a protocol for a genuinely unseen validation corpus (`G_FRESH_VALIDATION_SPEC.md`).

Prefer: simpler structure, single-use signals, less named-patch dependence.  
A small development KPI loss is acceptable if double-counting / leakage is reduced.

---

## G variants (CLEAN-1)

All use the same primitives / thresholds / axis coefficients as `arm_b._axis_scores` unless noted.

### G_REF

Exact current G (reference only):

```text
career, health, relationship  # with current in-axis discord/risk/pattern
G = 0.40·C + 0.35·H + 0.25·R
  + discord·0.45 + risk·0.40 + pattern·0.55
```

### G_CLEAN_AXIS

Patterns remain **inside axes** exactly as today.  
Remove **final** repeated extras:

```text
G = 0.40·C + 0.35·H + 0.25·R
# no discord/risk/pattern after blend
```

Tests whether final G-level stack is redundant double-counting.

### G_CLEAN_FINAL

**Choice (documented, not tuned):** axes built from non-pattern domain signals only; each pattern family applied **once** at G using **existing final-G coefficients only** (option 1 from the brief — do not invent new coeffs).

Axes exclude: `discord`, `risk`, aggregate `pattern` (= hollow+friction+health_guan).

Axes **keep** domain heuristics: `career_tg`, `career_conflict_pen`, `health_shock`, `rel_bond`, yfit/rel/struct/uns/bal.

```text
C₀, H₀, R₀  = axes without discord/risk/pattern
G = 0.40·C₀ + 0.35·H₀ + 0.25·R₀
  + discord·0.45 + risk·0.40 + pattern·0.55
```

Architecture under test:

```text
primitives → domain axes → weighted blend → pattern correction ONCE → G
```

**Note:** Relative to G_REF, total pattern dosage falls (no longer also multiplied inside axes). That is the point of the architecture test, not a hidden retune.

---

## Family isolation (CLEAN-2)

On `G_CLEAN_AXIS` and `G_CLEAN_FINAL`, ablate one family at a time (set contribution to 0; no renorm of other coeffs except as required by zeroing that term).

| Family | Class |
|--------|--------|
| discord | sparse pattern |
| risk | sparse pattern (gated on discord) |
| hollow | sparse pattern |
| friction | sparse pattern / named (Brown) |
| health_guan | sparse pattern / named (Bieber) |
| career_conflict_pen | axis heuristic / narrative |
| health_shock | axis heuristic |
| rel_bond | axis heuristic |
| career_tg | axis heuristic |

Report: activation rate, mean contribution when active, train/hold predictive KPIs, flips vs parent architecture, affected subjects.

---

## Architectures (CLEAN-3)

### A — domain-mediated (candidate clean)

Primary candidate = winner of CLEAN-1 among `{G_CLEAN_AXIS, G_CLEAN_FINAL}` by simplicity + development ranking quality (not max hit).  
Fallback = G_CLEAN_AXIS if tied.

### B — primitive-direct diagnostic

`DIRECT_EQUAL_FAMILY`:

1. Families (raw): `yfit_scaled`, `relations`, `structural_adj`, `unseong`, `balance`, `career_tg`, `health_shock`, `rel_bond`.  
2. Z-score each family using **development corpus** mean/SD (scale only; not label-fit).  
3. `G = clamp(50 + 4.0 · mean(z_families))` — fixed display scale constant chosen only so G SD is order-comparable to G_REF (~4–5); **not** optimized on hits.  
4. Optional companion `DIRECT_EQUAL_PLUS_PATTERN_ONCE` adds `discord·0.45 + risk·0.40 + pattern·0.55` once after the equal-family core.

No career/health/relationship routing.

---

## Career dominance & orthogonality

See harness sections in `experiment_g_clean.py`:

- Decompose career additive terms → within-block SD, variance share, corr with `A_y`, crude label-direction corr.  
- Residualize `health` / `relationship` on career (linear OLS diagnostic only); score residual predictive association.

---

## Evaluation

Always: custom `G` → B9-A `A_y = G − block median(G)` → `S = squash(D + A)`.

Prioritize within-block ranking / pairwise / std_sep / subject consistency over absolute G level.

Report development train/hold **separately**; never pool with future fresh validation.

---

## Outputs

| Path | Role |
|------|------|
| `test/experiments/G_CLEAN_SPEC.md` | this file |
| `test/experiments/experiment_g_clean.py` | harness |
| `test/snapshots/exp_g_clean.json` | results |
| `test/experiments/G_FRESH_VALIDATION_SPEC.md` | unseen corpus protocol |

## Non-goals

- Weight optimization  
- Fresh-set scoring before labels frozen  
- Patching rules for Messi/Brown/Hillary/Bieber/Gore/Jackson/etc.  
- Production promote  

---

## Results snapshot (development only, 2026-08-12)

Harness: `experiment_g_clean.py` → `exp_g_clean.json`  
Corpus: 14 primary subjects from contaminated `yongshin_subjects.json` (not fresh).

| Variant | train hit | hold hit | hold std_sep | hold pairwise | flips vs G_REF |
|---------|----------:|---------:|-------------:|--------------:|---------------:|
| G_REF | 75 | 60 | 0.173 | 0.597 | 0 |
| **G_CLEAN_AXIS** | 75 | 60 | 0.152 | 0.583 | 0 |
| G_CLEAN_FINAL | 75 | 60 | 0.151 | 0.583 | 0 |
| DIRECT_EQUAL_FAMILY | 75 | 60 | 0.076 | 0.556 | 0 |
| DIRECT_EQUAL_PLUS_PATTERN_ONCE | 75 | 60 | 0.101 | 0.594 | 0 |

`G_REF` matches `arm_b.year_score_pure_from_meta` within rounding (max\|Δ\|≤0.05).

### Career dominance (G_REF career additives)

Largest approx variance share: **career_conflict_pen ~32%**, rel term ~16%, career_tg ~14%, discord-in-axis ~13%, yfit_c ~11%, pattern-in-axis ~10%.  
Label-direction correlations are weak/near-zero for yfit_c / career_tg / conflict_pen; sparse discord/pattern show higher corr but rare activation.

### Orthogonality

ρ(C,H)=0.65, ρ(C,R)=0.64, ρ(H,R)=0.54.  
OLS residuals: health⊥career corr_label≈0.04; relationship⊥(C,H) corr_label≈0.05 — little unique labeled signal after career.

---

## Final answers

1. **De-stack hurt/improve?** Slight hold std_sep drop (~0.02) vs G_REF; **no subject hit flips**. Structurally preferred.  
2. **Axis-only vs final-only?** **G_CLEAN_AXIS ≈ G_CLEAN_FINAL** on KPI; prefer **axis-only patterns + no final restack** (simpler, removes proven double path).  
3. **Incremental families (on G_CLEAN_AXIS)?** health_shock & career_conflict_pen move std_sep; discord moves **train** hit (Brown); health_guan moves **hold** (Bieber). risk/hollow/friction ≈ flat.  
4. **Named patches?** health_guan (Bieber), hollow (Hillary narrative), friction (Brown narrative).  
5. **Career unique?** Dominates variance largely via **conflict_pen / career_tg / yfit**, not clean label corr — unique *predictive* value unclear.  
6. **Health unique beyond career?** Residual label corr ≈ **0.04** — weak.  
7. **Relationship unique?** Residual label corr ≈ **0.05** — weak.  
8. **Axes as model-generators?** Empirically weak as independent generators; more defensible as **explanation domains** projected from a cleaner general signal. Still keep G_CLEAN_AXIS as interim candidate (domain-mediated but de-stacked) until fresh data says otherwise.  
9. **Primitive-direct?** Structurally cleaner; development hold std_sep **much weaker** (0.076) — interesting diagnostic, **not** yet the fresh-validation candidate.  
10. **Fresh-validation candidate:** **`G_CLEAN_AXIS`**.  
11. **Reject permanently (for candidate path):** G_REF final extras restack; using JSON “holdout” as clean final proof.  
12. **Do not change before fresh:** B9 hierarchy freeze; no new pattern coeffs; no celeb patches; freeze fresh labels before scoring.  
13. **Fresh subjects absent?** None scored this phase; protocol requires programmatic exclusion of all 58 JSON names (`G_FRESH_VALIDATION_SPEC.md` + empty `g_fresh_subjects.json`).

### Selection principles applied

- Prefer simpler when tied → G_CLEAN_AXIS over G_REF / G_CLEAN_FINAL.  
- Do not reward train-only discord/Brown patch dependence.  
- Do not promote DIRECT yet despite elegance (large ranking amplitude loss on contaminated set).  
- No weight search. No fresh scoring.  
