# D Feature Discovery Report

**Status:** `D_BLOCK_TARGET_NEEDS_REDESIGN_FIRST`
**Measured at:** 2026-08-13T00:10:01

Diagnosis only. No D score. No Ridge. No Validation B. Engine read-only.

Reminder: failure of `enc_yongshin_fit` means the **current encoding** failed, not that 용신 is bad / 기신 is good.

Diagnostic tags: `['CURRENT_ENCODING_FAILURE', 'CONTEXT_INTERACTION_MISSING', 'DAEWOON_FEATURE_SET_INCOMPLETE', 'BLOCK_TARGET_TOO_NOISY', 'BLOCK_TARGET_DOMAIN_BIASED', 'TRANSITION_SMOOTHING_WORTH_TESTING', 'INSUFFICIENT_EVIDENCE']`

## Yongshin family (separated)

| feature | OLD conc | FA conc | COMB conc | shape |
|---|---:|---:|---:|---|
| enc_yongshin_fit | 0.4671 | 0.3 | 0.4533 | U_shaped |
| yong_fit | 0.4173 | 0.619 | 0.4314 | decreasing |
| hee_fit | 0.4966 | 0.375 | 0.4875 | U_shaped |
| gi_fit | 0.5 | 0.5926 | 0.5083 | U_shaped |
| gu_fit | 0.5634 | 0.4615 | 0.5548 | flat |
| fav_minus_unfav | 0.5027 | 0.5238 | 0.5049 | flat |
| fav_element_activation | 0.4795 | 0.4615 | 0.478 | non_monotonic |
| unfav_element_activation | 0.5 | 0.6 | 0.5098 | U_shaped |

## 12운성 categorical (COMBINED evidence means)

| state | n_blocks | n_subj | mean simple_net | sufficient |
|---|---:|---:|---:|---|
| 태 | 31 | 31 | 0.2516 | True |
| 절 | 26 | 26 | 1.2846 | True |
| 묘 | 24 | 24 | 0.65 | True |
| 양 | 23 | 23 | 0.6348 | True |
| 건록 | 22 | 22 | 0.3545 | True |
| 장생 | 21 | 21 | 0.4238 | True |
| 사 | 20 | 20 | 0.595 | True |
| 관대 | 18 | 18 | 0.8778 | False |
| 제왕 | 18 | 18 | 0.6222 | False |
| 목욕 | 18 | 18 | 0.4667 | False |
| 쇠 | 15 | 15 | 0.2467 | False |
| 병 | 15 | 15 | 1.1 | False |

Continuous unseong:
- unseong_raw_score: OLD=0.4938 FA=0.3 COMB=0.4773 shape=U_shaped
- unseong_adjusted: OLD=0.4634 FA=0.3333 COMB=0.4525 shape=U_shaped
- enc_unseong: OLD=0.4367 FA=0.3 COMB=0.4254 shape=U_shaped

## Relations flags

- has_hap: OLD=0.505 FA=0.7778 COMB=0.5273 (nCOMB=110)
- has_chung: OLD=0.4667 FA=0.5 COMB=0.4694 (nCOMB=196)
- has_hyung: OLD=0.508 FA=0.3333 COMB=0.4927 (nCOMB=205)
- has_pa: OLD=0.5676 FA=0.5882 COMB=0.5697 (nCOMB=165)
- has_hae: OLD=0.5488 FA=0.1111 COMB=0.526 (nCOMB=173)
- has_samhap: OLD=0.4821 FA=0.5882 COMB=0.4906 (nCOMB=212)
- has_day_chung: OLD=0.4514 FA=0.5714 COMB=0.462 (nCOMB=158)
- has_month_chung: OLD=0.474 FA=0.5 COMB=0.4759 (nCOMB=187)
- energy_direction: OLD=0.4953 FA=0.5 COMB=0.4957 (nCOMB=347)
- hit_day: OLD=0.4924 FA=0.5 COMB=0.4931 (nCOMB=144)
- hit_month: OLD=0.4624 FA=0.3571 COMB=0.4486 (nCOMB=107)

## Balance / structural / interactions

### balance
- balance_delta: OLD=0.4642 FA=0.3448 COMB=0.4534
- abs_balance_delta: OLD=0.4877 FA=0.4138 COMB=0.4809
- enc_balance: OLD=0.4266 FA=0.3448 COMB=0.4193
- balance_x_favdir: OLD=0.4948 FA=0.2414 COMB=0.4715

### structural
- enc_structural: OLD=0.5019 FA=0.56 COMB=0.5068
- struct_excess: OLD=0.5703 FA=0.5 COMB=0.5652
- struct_activ: OLD=0.4679 FA=1.0 COMB=0.4845
- struct_disrupt: OLD=0.5141 FA=0.5217 COMB=0.515

### interactions
- fav_element_activation: OLD=0.4795 FA=0.4615 COMB=0.478
- unfav_element_activation: OLD=0.5 FA=0.6 COMB=0.5098
- unseong_x_strength: OLD=0.5039 FA=0.4783 COMB=0.5018
- balance_x_favdir: OLD=0.4948 FA=0.2414 COMB=0.4715

## Coverage / construct validity

### OLD_DEV
- events=584 evidence_blocks=214
- career_share=0.1644 health=0.0822 rel=0.1096 legal=0.0308
- single_event_dominated_rate=0.3224
- events/block mean=2.729

### FRESH_A_DEV
- events=56 evidence_blocks=37
- career_share=0.4464 health=0.2143 rel=0.1071 legal=0.125
- single_event_dominated_rate=0.5135
- events/block mean=1.514

## Target sensitivity

- OLD_DEV: simple↔norm pair agree=0.8266 (n=271) spearman=0.7481
- FRESH_A_DEV: simple↔norm pair agree=1.0 (n=28) spearman=0.9164
- COMBINED_DEV: simple↔norm pair agree=0.8428 (n=299) spearman=0.7848

## Temporal / transition

- Combined good rel_pos: {'mean': 0.4635, 'median': 0.5, 'p25': 0.2, 'p75': 0.7}
- Combined bad rel_pos: {'mean': 0.469, 'median': 0.5, 'p25': 0.2, 'p75': 0.7}
- near-edge shares good/bad: 0.5245 / 0.5
- events within ±2y of Daewoon boundary: {'n_events_within_2y_of_boundary': 330, 'good_near': 214, 'bad_near': 116, 'share_of_all_events': 0.5156}

## Absolute vs subject-centered

- enc_yongshin_fit: raw_conc=0.4533 centered=0.4533 centered_better=False
- fav_element_activation: raw_conc=0.478 centered=0.478 centered_better=False
- unfav_element_activation: raw_conc=0.5098 centered=0.5098 centered_better=False
- unseong_raw_score: raw_conc=0.4773 centered=0.4773 centered_better=False
- energy_direction: raw_conc=0.4957 centered=0.4957 centered_better=False
- balance_delta: raw_conc=0.4534 centered=0.4534 centered_better=False
- enc_structural: raw_conc=0.5068 centered=0.5068 centered_better=False

## Candidate feature shortlist (definitions only)

### F1_favorable_element_activation
- definition: 1 if Daewoon stem/branch element ∈ {용신,희신} else 0, × (용신_fit + 희신_fit)
- theory: Daewoon supplies missing/favorable element rather than aggregated signed fit
- passes_soft: False
- limitations: depends on engine 용/희 labels; still natal-yongshin dependent
- FA conc=0.4615 OLD=0.4795 COMB=0.478

### F2_harmful_element_activation
- definition: 1 if Daewoon element ∈ 기신/구신 else 0, × (기신_fit + 구신_fit); higher = more harmful activation
- theory: Separates harmful activation from favorable; not −yongshin_fit
- passes_soft: False
- limitations: 기/구 labels engine-dependent
- FA conc=0.4 OLD=0.5 COMB=0.4902

### F3_day_branch_clash
- definition: Indicator: Daewoon relations include 충 involving day pillar
- theory: Relation type × natal target; day-palace clash ≠ generic relations scalar
- passes_soft: True
- limitations: sparse; binary; may be Sewoon-sensitive too
- FA conc=0.5714 OLD=0.4514 COMB=0.462

### F4_unseong_strength_interaction
- definition: UNSEONG_SCORE × (+1 if 신약, −1 if 신강, 0 if 중화)
- theory: 12운성 effect is regime-dependent; not universal monotonic UNSEONG_SCORE
- passes_soft: False
- limitations: coarse regime buckets; still uses ordinal score magnitudes
- FA conc=0.4783 OLD=0.5039 COMB=0.5018

### F5_trine_half_combine_activation
- definition: Indicator: 삼합/방합/반합 present between Daewoon and natal
- theory: Structural combination distinct from generic energy_direction blend
- passes_soft: True
- limitations: activation sparse; needs element-quality conditioning in next phase
- FA conc=0.5882 OLD=0.4821 COMB=0.4906

## Explicit answers

1. Current yongshin_fit failure is primarily an **encoding/aggregation** issue (enc COMB conc=0.4533); separated parts differ (yong=0.4314, gi=0.5083, fav_act=0.478).
2. 용/희/기/구 differ: see table — do **not** collapse to one signed fit.
3. favorable-element activation vs enc fit: FA 0.4615 vs 0.3.
4. 12운성 monotonicity (raw score quantiles): **U_shaped**.
5. 12운성 × 신강/신약: see `unseong_by_strength` — treat as context-dependent, not universal.
6. Relation types: compare has_hap / has_chung / has_day_chung / has_samhap flag concords.
7. Natal pillar matter: day vs month clash flags — if diverging, target-specific relations needed.
8–9. Balance: delta COMB=0.4534; abs_delta=0.4809; 'more balanced=better' is **not** assumed supported unless abs_delta shows consistent negative association with targets.
10. structural_adj parts: excess/activ/disrupt concords may oppose; do not reuse single scalar.
11. Interactions: fav/unfav activation and unseong×strength are the only predeclared probes.
12. Domain bias: FA career_share=0.4464 OLD=0.1644.
13. Sparsity: FA evidence blocks=37 events/block≈1.514.
14. Single-event dominated: FA=0.5135 OLD=0.3224.
15. Target agree simple↔norm: FA=1.0 OLD=0.8266.
16. Step-function: tags include transition assessment; near-edge shares in temporal section.
17. Absolute vs relative: within-subject pair concordance is **invariant** to subject centering (Δ unchanged). Absolute D level remains **untested** cross-sectionally → do not claim ABSOLUTE_D_LEVEL_UNSUPPORTED from pair metrics alone.
18. Strict-pass candidates: none; soft exploratory: ['F3_day_branch_clash', 'F5_trine_half_combine_activation']
19. Do **not** reuse unchanged: enc_yongshin_fit, enc_unseong, enc_balance, enc_relations, enc_structural as primary D material; also forbid −enc_* sign flips.
20. Next: **redesign block labels / construct first** (Fresh A is career-heavy and often single-event-dominated; events/block≈1.5). Feature ideas F1–F5 remain hypotheses for after construct repair — not ready to score.

## Final status

`D_BLOCK_TARGET_NEEDS_REDESIGN_FIRST`

Do **not** score Validation B. Do **not** promote D_new.