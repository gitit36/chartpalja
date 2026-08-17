# V2 Engine Master Spec

**Status:** Architecture freeze for Timing Engine V2  
**Date:** 2026-08-13  
**Scope this run:** Phase 1 + Phase 2 (Daewoon + Sewoon only)  
**Validation B:** SEALED until all layers frozen  

---

## 1. Product goal

An unseen user looking back should feel that the engine captures:

- broad long-term flow (Daewoon)
- important good/bad years (Sewoon)
- meaningful monthly timing (later)
- coherent short-term daily fluctuation (later)

Not: perfect historical proof of astrology.

---

## 2. Hierarchy (frozen)

```text
NATAL
  → DAEWOON  = long-term regime
  → SEWOON   = yearly activation / event environment
  → MONTH    = timing inside the year
  → DAY      = short-term trigger
```

Layers must **not** be copies of the same `_composite_score`.

### Composition (conceptual)

```text
D_b                          # absolute regime for Daewoon block

Y_raw = D_b + AnnualDev_y + ε · Context(D, Sewoon)
Y     = display_map(Y_raw)

M_raw = Y + MonthDev_ym + …   # Phase 3
Day_raw = M + DayDev_ymd + …  # Phase 4
```

### Local centering (required)

- median AnnualDev within Daewoon block ≈ 0  
- median MonthDev within year ≈ 0  
- median DayDev within month ≈ 0  

Do **not** globally re-center the composed score to 50 after adding the parent.

### Amplitude order

```text
|ΔD|  >  |AnnualDev|  >  |MonthDev|  >  |DayDev|
```

But Daewoon must **not** dominate annual by ~4–5× (legacy failure mode).

---

## 3. Layer roles

| Layer | Answers | Emphasize | Avoid |
|-------|---------|-----------|--------|
| **Daewoon** | What long-term regime? | structural support/pressure; fav vs unfav element *in context*; stable natal↔DW relations; slow change | year-event triggers; huge adjacent jumps |
| **Sewoon** | What activates this year inside the regime? | annual ten-god; 합충형파해; natal pillar hits; DW↔SW relation; fav/unfav annual activation; categorical 12운성 context | copying Daewoon composite; ignoring current D |
| **Month** | When inside the year? | month↔year/DW/natal; theme timing | mini-Sewoon clone |
| **Day** | How charged is today? | small triggers vs month baseline | life-changing claims |

---

## 4. Prohibitions

- Do **not** preserve current engine `D = 종합운점수` as V2 parent  
- Do **not** reweight `yongshin_fit` / `unseong` / `balance` / `relations` / `structural_adj` scalars as the core of V2  
- Do **not** interpret scalar failure as “용신 is wrong”  
- Do **not** patch named subjects  
- Do **not** score Validation B until full hierarchy freeze  
- Do **not** invent Candidate 4+ without explicit user instruction  
- Max **3** architecture families per major layer  

---

## 5. Phase 2 — D/Y candidates (this run)

Exactly three experiment-only families:

| ID | Idea |
|----|------|
| **V2_DY_A** SIMPLE_CONTEXTUAL | Contextual structural D + event-oriented annual + small D×Y context |
| **V2_DY_B** STRUCTURE_TRIGGER | Minimal/structure-only D; most interactions live in annual |
| **V2_DY_C** MINIMAL_HIERARCHY | Near-flat / low-amplitude D; strongest annual trigger model |

Selection priorities:

1. Fresh A annual pairwise / hit  
2. OLD_DEV annual direction  
3. no systematic reverse  
4. D does not mass-override correct annual direction  
5. reasonable amplitude  
6. interpretability  
7. no named patches  
8. simpler if close  

Guidance bands (pairwise): >0.60 strong · 0.55–0.60 promising · 0.50–0.55 weak · ≈0.50 insufficient · <0.50 broken.

Status vocabulary for this run:

```text
V2_DY_READY_TO_FREEZE
V2_DY_BORDERLINE_BUT_FREEZE
V2_DY_NOT_USABLE
```

After READY or BORDERLINE: **STOP** — Month/Day next phase.

---

## 6. Definition of Done (full V2 — later phases)

See user brief §26. Summary: coherent D/Y/M/Day hierarchy, annual materially above chance or borderline + strong human QA, amplitude ordered, explanations consistent, unseen user retrospective feels broadly right. Perfection not required.

---

## 7. Current production map (reference)

| Layer | Production path |
|-------|-----------------|
| Natal | `compute_all` → `enrich_saju` (no 0–100 종합) |
| Daewoon | `build_daewoon_detail` → `_composite_score` + SCORE_BIAS → `종합운점수` |
| Sewoon | `build_yearly_timeline` → 0.6·D + 0.4·SW_indep + synergy |
| Month | `build_monthly_timeline` → blend with year base |
| Day | `build_daily_fortune` → blend with month |
| Exp G | `G_CLEAN_AXIS` in `experiment_g_clean.py` |
| Exp B9 | `S = squash(D + α·A)`, A = G − median_block |

Legacy shared `_composite_score` across layers is the root of role collapse + double-count risk.

---

## 8. Backlog

Unresolved research that must **not** block V2: `V2_RND_BACKLOG.md`.
