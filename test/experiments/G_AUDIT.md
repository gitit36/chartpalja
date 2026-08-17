# G Material Forensic Audit

**Date:** 2026-08-12  
**Scope:** Diagnosis only. No G retune. No `saju_engine.py` edits. B9 hierarchy frozen (`α=1`, `κ=0`, `β=0.25`, `D`=engine pillar).  
**Harness:** `test/experiments/audit_g_material.py` → `test/snapshots/exp_g_audit.json`  
**Code path audited:** `arm_b.year_score_pure_from_meta` → `arm_b._axis_scores` (+ helpers).  
**B9 use of G:** `G_y` is the annual material; `A_y = G_y − median(G within daewoon block)`; `S_raw = D + α·A`.

---

## 1. Exact current G formula (expanded)

### 1.1 Entry

```text
G_y = arm_b.year_score_pure_from_meta(meta_y, ARM_B_CONFIG)
    = _axis_scores(meta_y, cfg)["general"]
```

`arm_b9.generals_by_block()` calls this for every year (materials cfg = `ARM_B_CONFIG`).

### 1.2 Meta → primitives

| Primitive | Source meta field(s) | Engine origin | Notes |
|-----------|----------------------|---------------|-------|
| `yfit_raw` | `breakdown.yongshin_fit` | `saju_engine._composite_score` | 용/희/기/구 부합 가중합 |
| `yfit` | scaled `yfit_raw` | `_scaled_yfit` | if `yfit>0`: `× yfit_pos_scale` (0.77); else unchanged |
| `rel` | `breakdown.relations` | engine | energy_direction×2 + noble_power×0.25 (engine already reduced vs shinsal double-count) |
| `struct` | `breakdown.structural_adj` | engine v6.4 | clamp [−8,8]: excess + yong activation + gishin disrupt |
| `uns` | `breakdown.unseong` | engine | 12운성 점수 (context term **not** read by G) |
| `bal` | `breakdown.balance` | engine | natal-relative balance delta |
| `tg_s`, `tg_b` | `세운_십성_천간`, `세운_십성_지지` | engine | ten-god labels |
| `ilju` | `세운_일주관계` | engine | string list (충/형/파/해/합/배우자/…) |
| `hyung` | `세운_신살_흉살` | engine | list; skip 역마/도화 for risk |
| `ctx` | `shinsal_context_adj` | engine | dict; 양인 keys for risk/friction |
| `close` | `candle.close` | engine Control | **not used inside G**; only for residual R (rejected) |

**Important:** G does **not** read Control `close` as an input. Correlation G↔close ≈ **0.24** (weak). Leakage is feature-sharing with Control’s breakdown, not copying the output.

### 1.3 Derived local signals

```text
career_tg:
  for each of (tg_s, tg_b):
    정관|편관|정재|편재|식신  → +2.2
    상관|겁재                 → −1.0
    편인|정인                 → +0.5

health_shock / conflict / rel_bond  (from ilju strings):
  충|형  → health_shock −4, conflict=True
  파|해  → health_shock −2
  극|갈등 → conflict=True
  합|배우자|인연 → rel_bond +3

yfit_c = yfit × (yfit_career_conflict=0.20 if conflict∧yfit>0
                 else yfit_career_normal=0.30)
career_pen = −6.0 if conflict else 0

has_hap = any 합|인연|배우자 in ilju
```

### 1.4 Pattern / risk family

| Signal | Gate | Formula | Magnitude |
|--------|------|---------|-----------|
| **discord** | `yfit_raw≥2.5` ∧ `rel≤−2.5` ∧ ¬hap ∧ risk_gate | constant | **−12.5** |
| **risk_gate** | severe 흉살 (≠역마·도화) ∨ 양인 ctx>0 ∨ 해 in ilju ∨ `yfit_raw≥7.5` | boolean | — |
| **hyungsal_pen** | only if discord∧¬hap | `max(−4.8, −1.6 × n_severe)` | ≤0 |
| **yangin_pen** | only if discord∧¬hap | `−4.0 × min(1, ctx/3)` per 양인 key | ≤0 |
| **risk** | discord∧¬hap | hyungsal_pen + yangin_pen | ≤0 |
| **hollow** | ¬hap∧¬conflict ∧ yfit≥5 ∧ bal≥3 ∧ rel≤2.5 | constant | **−9.9** |
| **friction** | ¬hap ∧ rel≤−3.5 ∧ 겁살 in 흉살 ∧ 양인>0 | constant | **−4.5** |
| **health_guan** | ¬hap ∧ yfit≥10 ∧ 정관 in (tg_s,tg_b) | constant | **−13.5** |
| **pattern** | — | hollow + friction + health_guan | ≤0 |

Activation rates (n=1400 subject-years, primary core):

| Family | nonzero rate |
|--------|--------------|
| career_conflict_pen | **35.9%** |
| discord | 3.1% |
| hollow | 2.9% |
| risk | 2.6% |
| friction | 1.1% |
| health_guan | **0.64%** (9 years) |
| yangin_pen | 0.14% |

### 1.5 Axis formulas (then clamp [0,100])

```text
base = 51.7

career = clamp(
  base
  + yfit_c
  + rel × 0.42
  + struct × 0.45
  + uns × 0.15
  + career_tg
  + career_pen
  + discord × 0.85
  + risk × 0.55
  + pattern × 0.80
)

health = clamp(
  base
  + yfit × 0.25
  + struct × 0.55
  + bal × 0.45
  + health_shock
  − career_tg × 0.35
  + uns × 0.10
  + discord × 0.55
  + risk × 0.70
  + pattern × 0.50
)

relationship = clamp(
  base
  + yfit × 0.30
  + rel × 0.42
  + rel_bond
  + bal × 0.25
  + uns × 0.10
  + risk × 0.35
  + pattern × 0.35
)
```

### 1.6 Final G (then clamp [0,100])

```text
G = clamp(
  0.40 × career
+ 0.35 × health
+ 0.25 × relationship
+ discord × 0.45
+ risk × 0.40
+ pattern × 0.55
)
```

**Critical structural fact:** discord / risk / pattern are added **inside each axis** *and again* on top of the weighted blend. That is intentional stacking in current code, not an accident of documentation.

Rounding: axes and G are `round(..., 1)` in `_axis_scores`.

---

## 2. Origin of the 3-axis design

### Evidence

| Source | What it says |
|--------|----------------|
| `test/proto_multiaxis.py` (Phase 1, git `ac96b4c` 2026-08-04) | “연점수 3축(career/health/relationship) + matched 평가” |
| Same file docstring for `axis_scores_from_meta` | Design intent: lower 용신 weight; raise relation/structure; career gets 관/재; health gets 충형해; relationship gets 합/배우자 |
| Keyword routers `_CAREER_KW` / `_HEALTH_KW` / `_REL_KW` | Product/celebrity-label matching (부상, 결혼, 우승, 당선, 세금…) |
| `calibrate_yongshin.py` | Event schema allows `axis: career\|health\|relationship\|general` |
| Classical 명리 texts in-repo | **No** document deriving exactly these three English product axes |
| Git history | Single dump commit; no earlier design memo for why *only* these three |

### Explicit answers

| Question | Answer |
|----------|--------|
| Why these 3? | **Product / evaluation simplification** for celebrity life-event matching (Phase 1 proto). Not a classical “삼재/삼명” derivation. |
| Was wealth intended inside career? | **Yes, by construction.** `career_tg` boosts 정재/편재; `_CAREER_KW` includes 파산/세금; comments: “관/재 십성”. There is **no separate wealth axis**. |
| Money / wealth | Folded into **career** (십성 재성 + keywords). |
| Education | Softly in career via 인성 (+0.5) and 식신; no dedicated axis. |
| Status / reputation | Mostly **career** (관살) + engine 용신/구조. |
| Family / children | Mostly **relationship** keywords (출생/아들/딸) + 합/배우자 strings. |
| Social network | **Not represented** as its own axis; fragments in `rel` / 합. |
| Theory vs heuristic? | **Hybrid:** primitives are 명리-engine-inherited; the 3-way split is a **manually chosen product heuristic** for label matching. |

**Provenance label:** *engine-inherited primitives + manually heuristic axis taxonomy* — not classical doctrine as a closed form.

---

## 3. Axis weights & coefficient provenance

### 3.1 Blend weights `0.40 / 0.35 / 0.25`

```text
G_axes = 0.40·career + 0.35·health + 0.25·relationship
```

| Question | Finding |
|----------|---------|
| Hand-selected? | **Yes** — appears first in `proto_multiaxis.py` with no derivation note |
| Prior experiment? | No snapshot shows a search that *chose* these three numbers |
| Optimized on celebrity labels? | **Not these weights.** Phase A/D HP sweeps search pens, `rel_weight`, `yfit_*`, `base`, hierarchy α — **`w_career/w_health/w_relationship` are absent from search keys** (`sweep_phase_a.py` `BASELINE_KEYS`) |
| Copied from Control? | **No.** Control is single `close`; no 3-axis blend |
| Undocumented? | **Yes** for *why* 40/35/25 specifically |

**Classification:** manually heuristic / provenance unknown for the specific triple; frozen by inheritance into `ARM_B_CONFIG`.

### 3.2 Other coefficients

| Coeff | Value | Provenance |
|-------|-------|------------|
| `base` | 51.7 | Proto used 52; Phase A searched `base∈[48,56]`; **51.7** looks like rounded sweep residue (`exp_sweep_phase_d` shows ~51.678) → **empirically tuned on train/celebrity KPI** |
| `yfit_pos_scale` | 0.77 | Phase A search space → **empirically tuned** |
| `yfit_career_normal/conflict` | 0.30 / 0.20 | Proto 0.32/0.10 → B config + Phase A search → **tuned** |
| `rel_weight` | 0.42 | Proto 0.55 → lowered; Phase A search → **tuned** |
| `struct_career/health` | 0.45 / 0.55 | Proto hardcodes; **not in Phase A keys** → heuristic / inherited |
| `career_tg` ±2.2/1.0/0.5 | hardcode | Proto; **heuristic** (Messi-style career signal comment) |
| `career_conflict_pen` | −6 | Proto; **heuristic** (Messi 2020 comment) |
| `health_shock` −4/−2 | hardcode | Proto; **heuristic** |
| `rel_bond` +3 | hardcode | Proto; **heuristic** |
| `discord_pen` | −12.5 | Phase1 gated discord; later Phase A search → **empirically tuned on celebrity failures** |
| `hollow_pen` | −9.9 | Phase2 (Hillary 2012 comment in tests) → **tuned on named failures** |
| `yangin_geopsal_pen` | −4.5 | Phase2 (Brown 2013 comment) → **tuned on named failures** |
| `health_guan_pen` | −13.5 | Phase3 (Bieber 2020 Lyme comment) → **tuned on named failure** |
| Axis extras `discord×0.45`, `pattern×0.55`, … | hardcode | B1–B3 stacking; **heuristic / failure-driven**, not grid-searched as a set |
| Intra-axis pattern coeffs (0.8/0.5/0.35 …) | hardcode | **undocumented magnitudes** |

---

## 4. Double-counting / overlap matrix

Rows = primitives; columns = career / health / relationship / G-extra / Control.

| Signal | career | health | relationship | G extra | Also in Control? |
|--------|:------:|:------:|:------------:|:-------:|:----------------:|
| yfit (scaled) | ✓ (gated) | ✓ | ✓ | | ✓ (`yongshin_fit`) |
| relations `rel` | ✓×0.42 | | ✓×0.42 | | ✓ |
| structural_adj | ✓×0.45 | ✓×0.55 | | | ✓ |
| unseong | ✓×0.15 | ✓×0.10 | ✓×0.10 | | ✓ |
| balance | | ✓×0.45 | ✓×0.25 | | ✓ |
| career_tg | ✓ | ✓ (−0.35×) | | | via 십성 (indirect) |
| conflict / career_pen | ✓ | | | | ilju strings |
| health_shock | | ✓ | | | ilju |
| rel_bond | | | ✓ | | ilju |
| discord | ✓×0.85 | ✓×0.55 | | ✓×0.45 | — |
| risk | ✓×0.55 | ✓×0.70 | ✓×0.35 | ✓×0.40 | 신살 ctx (partial) |
| pattern (hollow/friction/guan) | ✓×0.80 | ✓×0.50 | ✓×0.35 | ✓×0.55 | — |

### Strongest double-count chains

1. **Pattern stack (highest severity):** `pattern` and `discord`/`risk` enter **all three axes** and again enter **G extras** → one scandal year is penalized 4 ways (3 axes + blend).  
2. **yfit ubiquity:** positive/negative 용신 fit drives career, health, relationship simultaneously → axes are **not independent** (ρ(career,health)=0.65, ρ(career,rel)=0.64).  
3. **career_tg sign flip:** boosts career and **suppresses** health — intentional anti-inflation, but couples the two axes.  
4. **ilju multipurpose:** same string sets conflict, health_shock, rel_bond, has_hap, hollow gates.  
5. **Control feature reuse:** G rebuilds from Control breakdown fields (not close), so validation vs Control is **not** independent-feature — only independent *assembly*.

---

## 5. Empirical contribution (frozen subjects, no retune)

Corpus: 14 primary subjects × timeline years → **1400** year observations.

### 5.1 Distributions

| | mean | SD | p05 | p50 | p95 |
|--|-----:|---:|----:|----:|----:|
| career | 51.14 | 5.17 | 42.4 | 51.6 | 58.7 |
| health | 49.27 | 3.80 | 41.7 | 49.9 | 54.4 |
| relationship | 52.81 | 3.25 | 47.3 | 52.8 | 58.4 |
| G | 50.47 | 4.66 | 42.7 | 51.2 | 56.3 |
| A_y (within-block) | −0.64 | 4.59 | −8.3 | 0.0 | 5.4 |

### 5.2 Within-daewoon-block SD (p50)

| career | health | relationship | G |
|-------:|-------:|-------------:|--:|
| **4.89** | 3.60 | 3.13 | 3.68 |

### 5.3 Effective influence = weight × within-block SD(p50)

| Axis | weight | block SD p50 | **w×SD** | share of Σ(w×SD) |
|------|-------:|-------------:|---------:|-----------------:|
| career | 0.40 | 4.89 | **1.96** | **49%** |
| health | 0.35 | 3.60 | 1.26 | 32% |
| relationship | 0.25 | 3.13 | 0.78 | 20% |

**Verdict:** career **dominates annual variation** beyond its nominal 40% (correlation career↔G = **0.92**).

### 5.4 Axis correlations

| pair | ρ |
|------|--:|
| career ↔ health | 0.65 |
| career ↔ relationship | 0.64 |
| health ↔ relationship | 0.54 |
| career ↔ G | **0.92** |
| health ↔ G | 0.77 |
| relationship ↔ G | 0.68 |
| G ↔ Control close | 0.24 |

---

## 6. Ablation diagnostics (B9-A, α=1, D frozen; G only changes)

Year-label KPI (same harness as B9-A alpha diag). Baseline **current:** train hit 75% · holdout hit **60%** · holdout std_sep **0.173**.

| Ablation | train hit | hold hit | hold std_sep | Δstd | flips |
|----------|----------:|---------:|-------------:|-----:|------:|
| current | 75 | 60 | 0.173 | — | 0 |
| no_career (renorm) | 75 | 60 | 0.199 | +0.027 | 0 |
| no_health | 75 | 60 | 0.128 | −0.044 | 0 |
| no_relationship | **87.5** | 60 | 0.190 | +0.018 | 1 (Gore 0→1) |
| **no_pattern_penalties** | **50** | 60 | **0.079** | **−0.094** | **2** (Brown, Hillary 1→0) |
| no_discord | 62.5 | 60 | 0.171 | −0.002 | 1 (Brown) |
| no_hollow | 75 | 60 | 0.166 | −0.006 | 0 |
| no_friction | 75 | 60 | 0.173 | 0 | 0 |
| **no_health_guan** | 75 | **40** | 0.126 | −0.046 | **1 (Bieber holdout 1→0)** |
| no_risk | 75 | 60 | 0.173 | ~0 | 0 |

### Interpretation

- **Pattern stack is load-bearing on train** (Brown/Hillary). Removing all pattern extras collapses train hit 75→50 and crushes std_sep.  
- **`health_guan` is a holdout-specific patch** (Bieber): removing it flips the only clear holdout regression (−20pp hit). That is classic **named-example leakage**.  
- **Removing career does not hurt hit** and slightly *raises* holdout std_sep — career’s huge variance is not cleanly converting to label separation under B9-A.  
- **Removing health hurts std_sep** (−0.044) without flipping hits — health contributes ranking sharpness.  
- Friction / risk / hollow: near-zero incremental holdout effect in this corpus (rare activation).

---

## 7. Simple alternative baselines (no weight search)

| Mode | train | hold | hold std_sep | notes |
|------|------:|-----:|-------------:|-------|
| A current 40/35/25 | 75 | 60 | 0.173 | reference |
| B equal ⅓/⅓/⅓ | 75 | 60 | 0.168 | almost identical; **weights not uniquely justified** |
| C career alone | 75 | 60 | 0.103 | same hits, weaker std |
| C health alone | 75 | 60 | **0.233** | **best std_sep of single axes** |
| C relationship alone | 75 | 60 | 0.109 | weak std |
| D axes, no pattern extras | 50 | 60 | 0.079 | patterns carry train separation |
| E pattern_only | 87.5 | 60 | 0.136 | diagnostic; overfits sparse penalties |

**Takeaway:** equal weights ≈ current. Current 40/35/25 is **not empirically unique**. Health-alone has stronger standardized separation than the full blend on this holdout — another sign the blend is arbitrary relative to KPI.

---

## 8. Leakage audit

| Component | Classification | Circular-validation risk |
|-----------|----------------|--------------------------|
| Engine breakdown fields | engine-inherited | Low (shared features, not label-fit) |
| 3-axis taxonomy | manually heuristic | Medium (axes defined to match label keywords) |
| 0.40/0.35/0.25 | manually heuristic / unknown | Low for *optimization* circularity (never searched) but unjustified |
| career_tg / shocks / bonds | manually heuristic + celebrity narrative comments | Medium |
| discord / hollow / friction / health_guan | **empirically tuned on train + named celebrity failures** (Phase1–3; tests cite Brown/Hillary/Bieber) | **High** |
| Phase A pens / base / yfit scales | **empirically tuned on train/holdout celebrity year labels** | **High** |
| Holdout set | fixed names in `phase_config.HOLDOUT_NAMES` | Pattern pens were developed while iterating on these people → **quasi-holdout contamination** |
| B9 α/β | frozen separately | Out of scope; not G |

**Flag:** Current G validation for B9 is **partially circular** on pattern families. Especially `health_guan` (Bieber) and hollow/discord (Hillary/Brown). Axis blend weights themselves were not optimized on labels, but the *penalty layer* was.

---

## 9. Final verdict

### What G is actually measuring

A **re-weighted assembly of Control breakdown features** (용신 fit, relations, structure, 12운성, balance) plus **ten-god and 일주-relation heuristics**, plus a **sparse scandal/injury penalty layer**, then blended as “general life year quality” for celebrity good/bad years.

It is **not** a clean 명리 “세운 독립점수” and **not** three independent life domains.

### Why career / health / relationship exist

To support **Phase-1 matched evaluation** against celebrity event text. Product simplification + label routing — **not** a closed classical triad.

### Defensible vs arbitrary

| Defensible | Arbitrary / undocumented |
|------------|--------------------------|
| Using engine 명리 primitives | Exact 40/35/25 |
| Down-weighting raw 용신 vs Control | Intra-axis pattern multipliers (0.8/0.5/…) |
| Separating some 충형 → health, 합 → relationship | Triple-adding discord/pattern into axes **and** G |
| Sparse penalties for known failure modes | Magnitudes tuned on the same celeb set used to score B9 |

### Strongest double-count risks

1. Pattern/discord multi-injection (axes + G extras)  
2. Shared yfit across all axes (ρ≈0.6 between axes)  
3. Feature overlap with Control breakdown

### Strongest / weakest axis (for annual variation & B9-A)

- **Strongest variance driver:** career (49% effective influence; ρ→G 0.92)  
- **Strongest ranking contributor (ablation):** health (removing it drops std_sep most among axes)  
- **Weakest / least unique:** relationship (lowest w×SD; removing it can *help* train hit)

### Which patterns add real incremental value

| Pattern | Incremental value |
|---------|-------------------|
| **Full pattern stack** | Real on **train** (Brown/Hillary); necessary for current train hit |
| **health_guan** | Real but **holdout-fragile / example-specific** (Bieber) |
| discord | Small; one train flip (Brown) |
| hollow / friction / risk | Little measurable holdout value here |

### Is current G acceptable as-is for B9 shadow?

**Conditionally yes, as a frozen material snapshot** — with eyes open:

- Acceptable for **shadow/prototype** because B9 hierarchy isolation is the main claim, and G was already the B7 material.  
- **Not** acceptable to treat G as a validated, theory-clean annual score.  
- Do **not** interpret B9 celebrity year hits as proving the 40/35/25 design.

### What to test NEXT (before any weight optimization)

1. **De-stack patterns:** compute G with pattern/discord applied **once** (blend-only or axis-only), measure train/holdout — expect less overfit.  
2. **health_guan leave-one-out / family ablation on a fresh label slice** — confirm it isn’t a one-celebrity patch.  
3. **Career variance audit:** why high variance doesn’t buy separation; consider capping career_tg or conflict pens before touching blend weights.  
4. **Axis orthogonality probe:** residualize health/relationship on career; see if orthogonal components predict labels.  
5. **Only then** consider a constrained weight search — never on the same holdout used to invent Phase2/3 pens without a locked eval protocol.

---

## Appendix

- Formula reconstruction verified: `_decompose` matches `arm_b._axis_scores` within rounding.  
- Snapshot: `test/snapshots/exp_g_audit.json`  
- Scripts: `test/experiments/audit_g_material.py`  
- No optimizer run. No α/β/D/hierarchy changes. No production engine edits.
