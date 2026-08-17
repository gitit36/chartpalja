# D Material Forensic Audit

**Verdict:** `D_MIXED_RANKING_AND_AMPLITUDE_PROBLEM`
**Measured at:** 2026-08-12T23:28:08

Diagnosis only. No D_new. No G revise. No α change. Validation B sealed.

Pools: OLD_DEV (yongshin primary) + FRESH_A_DEV (eligible Fresh A). Both DEVELOPMENT / contaminated.

## 1. Current D computation graph

```text
birth chart (원국)
  → 대운 블록 ganzi (stem, branch) + start/end years
  → primitives:
       yongshin fit (_check_yongshin_fit)
       12운성 (twelve_unseong) + verdict mult + 신강 excess pen
       십성 context (_unseong_tengo_adj)
       relations → energy_direction (_calc_energy_field) + noble_power×0.25
       삼합/방합 (_trine_energy_adj)
       공망 factors (_gongmang_factors) × yfit/unseong/rel/trine
       balance delta vs natal (_ohang_balance) ×20 clamp[-6,6]
       신살 contextual (_contextual_shinsal_adj)
       disease resolution (_disease_resolution_score)
       해공 (_haegong_check)
       structural_adj v6.4: excess + yong activation + gishin disrupt clamp[-8,8]
  → _composite_score(base=50, …)
  → sc = base + Σ components
  → _uplift_composite(sc) = clamp(round(sc + SCORE_BIAS), 0..100)
  → D = build_daewoon_detail(...)[i]["종합운점수"]
```

Source: `saju_engine.build_daewoon_detail` → `_composite_score` → `_uplift_composite`.

Default `SCORE_BIAS = 10` (env override). Shared with Sewoon/월 path that also call `_composite_score`.

### Component formulas (engine)

| Component | Formula (summary) | Clamp | Annual info? |
|---|---|---|---|
| base | 50 | — | no |
| yongshin_fit | 10·yf + 5·hf − 10·gf − 5·uf (−2·min(yf,gf) if both>0); 공망 on branch | unbounded before sum | no (Daewoon pillar only) |
| unseong | 0.8·UNSEONG_SCORE·mult·gm + 신강 excess | via mult tables | no |
| unseong_context | ten-god adj × gm | — | no |
| relations | energy_direction×2×gm + noble_power×0.25 | — | no |
| trine | (pos−neg)×gm | — | no |
| balance | clamp((bal−natal)×20, −6..6); sign flip for 종/화/외격 | [-6,6] | no |
| shinsal | contextual adj | — | no |
| disease_resolution | disease cure/worsen by pillar | — | no |
| haegong | natal 공망 activation bonus | — | no |
| structural_adj | excess+activ+disrupt | [-8,8] | no |
| SCORE_BIAS | +10 then int round clamp 0..100 | [0,100] | no |

**Daewoon-specificity:** D uses only the Daewoon pillar vs natal. It does **not** read Sewoon year stems, Control close, or annual timeline outputs. Temporal granularity is 10-year pillar structure.

**Shared path with Sewoon:** `_composite_score` is also used for yearly/monthly scores; coefficients are the same family. That is formula reuse, not Control leakage into D.

## 2. Provenance audit

| Rule / coefficient | Provenance | Notes |
|---|---|---|
| base=50 | engine inherited | neutral midscale |
| yfit 10/5/−10/−−5 | empirically tuned / engine inherited | comment v6.3: amplitude reduced so relations/unseong/balance survive; earlier dominance reduced in commit `b4d9522` |
| UNSEONG_SCORE table | classical/theory-derived + heuristic scale | 장생/제왕… magnitudes product-scaled |
| UNSEONG_VERDICT_MULT / SINGANG_EXCESS | manually heuristic + theory-inspired | v6.2 comments; 신강 damping |
| relations energy×2 + noble×0.25 | manually heuristic | noble reduced to avoid shinsal double-count |
| balance ×20 clamp6 | manually heuristic | v6.3 enlarged vs earlier |
| structural_adj ±8 | engine inherited v6.4 | heuristic structural corrections |
| SCORE_BIAS=+10 | empirically tuned product feel | comment: 체감 "너무 짜다" 완화; env `SCORE_BIAS` |
| gongmang / haegong / trine | theory-derived structure + heuristic weights | v5→v6.1/6.2 |
| disease_resolution | heuristic on 병인진단 | depends on yongshin disease model |
| Celebrity named patches inside D | **not found** | No Messi/Brown/Hillary/Bieber/Gore/Jackson branches in `build_daewoon_detail` / `_composite_score` |

Where comments do not prove a classical source → **provenance unknown** beyond engine inheritance.

## 3. Double-count / temporal leakage vs G

G (`G_CLEAN_AXIS` / arm_b) reads **Sewoon-year** `meta.breakdown` fields that come from the **same `_composite_score` family** applied to yearly pillars, plus annual-only pattern/ten-god/ilju features.

| Signal | In D? | In G? | Issue |
|---|---|---|---|
| yongshin_fit | yes (Daewoon pillar) | yes (Sewoon-year breakdown) | same *family*, different pillar; hierarchical double-theme risk |
| relations / energy | yes | yes | same |
| structural_adj | yes | yes | same |
| unseong | yes | yes (G reads unseong; not unseong_context) | same |
| balance | yes | yes | same |
| trine / shinsal / disease / haegong | yes in D | mostly via year breakdown / patterns | partial |
| career_tg / ilju shocks / discord / hollow / friction / health_guan | **no** | **yes** | annual-only in G |
| Control candle.close | **no** | **no** (G) | no Control→D leak |
| Sewoon year stem/branch | **no** | yes | D is Daewoon-specific here |

Conclusion: D is temporally Daewoon-specific, but **semantically overlaps** G’s annual primitives (fit/rel/struct/uns/bal). S=D+A therefore mixes correlated themes at two timescales.

## 4. Development pools

- OLD_DEV n=56
- FRESH_A_DEV n=14
- Validation B sealed (n=15); not scored.
- Unmapped events: 0

## 5. Block-level D ranking (predeclared targets)

### OLD_DEV

blocks=560 with_events=214 insufficient=346 subjects=56

| target | within-subj pairwise | pooled pairwise | spearman | kendall | n_pairs | n_subj |
|---|---:|---:|---:|---:|---:|---:|
| simple_net | 0.4645 | 0.4806 | -0.0887 | -0.0607 | 335 | 55 |
| normalized_balance | 0.5009 | 0.4945 | 0.0152 | 0.008 | 275 | 55 |
| high_confidence_balance | 0.496 | 0.4821 | -0.0038 | -0.0024 | 195 | 48 |
| career_only_balance | 0.0 | 0.0 | -0.2328 | -0.1933 | 2 | 1 |
| non_career_balance | 0.478 | 0.5 | 0.0605 | 0.0474 | 49 | 27 |

### FRESH_A_DEV

blocks=140 with_events=37 insufficient=103 subjects=14

| target | within-subj pairwise | pooled pairwise | spearman | kendall | n_pairs | n_subj |
|---|---:|---:|---:|---:|---:|---:|
| simple_net | 0.3929 | 0.4167 | -0.0836 | -0.0717 | 30 | 14 |
| normalized_balance | 0.4286 | 0.4464 | -0.1651 | -0.1312 | 28 | 14 |
| high_confidence_balance | 0.4286 | 0.4259 | -0.2028 | -0.1622 | 27 | 14 |
| career_only_balance | None | None | None | None | 0 | 0 |
| non_career_balance | None | None | None | None | 0 | 0 |

### COMBINED_DEV

blocks=700 with_events=251 insufficient=449 subjects=70

| target | within-subj pairwise | pooled pairwise | spearman | kendall | n_pairs | n_subj |
|---|---:|---:|---:|---:|---:|---:|
| simple_net | 0.4499 | 0.4753 | -0.0699 | -0.048 | 365 | 69 |
| normalized_balance | 0.4862 | 0.4901 | -0.0043 | -0.0045 | 303 | 69 |
| high_confidence_balance | 0.4808 | 0.4752 | -0.0313 | -0.0224 | 222 | 62 |
| career_only_balance | 0.0 | 0.0 | -0.2112 | -0.1753 | 2 | 1 |
| non_career_balance | 0.478 | 0.5 | 0.1076 | 0.0843 | 49 | 27 |

## 6. D amplitude vs A

### OLD_DEV

- D dist: {'n': 560, 'min': 27.0, 'p01': 30.77, 'p05': 42.95, 'p25': 56.0, 'p50': 64.0, 'p75': 72.0, 'p95': 83.0, 'p99': 88.0, 'max': 92.0, 'sd': 12.2868, 'mean': 63.4589}
- within-subject D range: {'n': 56, 'min': 16.0, 'p01': 17.65, 'p05': 21.75, 'p25': 27.75, 'p50': 36.5, 'p75': 42.0, 'p95': 58.25, 'p99': 60.35, 'max': 62.0, 'sd': 10.8064, 'mean': 36.3571}
- within-subject D SD: {'n': 56, 'min': 5.7552, 'p01': 6.0785, 'p05': 7.3552, 'p25': 8.7796, 'p50': 11.1818, 'p75': 13.368, 'p95': 17.112, 'p99': 18.9533, 'max': 19.968, 'sd': 3.2868, 'mean': 11.5515}
- adjacent-block jump: {'n': 504, 'min': 0.0, 'p01': 0.0, 'p05': 1.0, 'p25': 4.0, 'p50': 9.0, 'p75': 15.0, 'p95': 23.0, 'p99': 32.94, 'max': 38.0, 'sd': 7.431, 'mean': 10.1429, 'p90': 21.0}
- within-block SD(A): {'n': 553, 'min': 1.0051, 'p01': 1.717, 'p05': 2.1412, 'p25': 2.7486, 'p50': 3.3327, 'p75': 3.8538, 'p95': 5.1263, 'p99': 5.9329, 'max': 7.6371, 'sd': 0.9004, 'mean': 3.3882}
- labeled |ΔA|: {'n': 1454, 'min': 0.0, 'p01': 0.0, 'p05': 0.1737, 'p25': 1.2751, 'p50': 3.0467, 'p75': 5.4376, 'p95': 9.6813, 'p99': 12.5716, 'max': 19.3832, 'sd': 3.0321, 'mean': 3.7107}
- labeled cross |ΔD|: {'n': 1027, 'min': 0.0, 'p01': 0.0, 'p05': 1.0, 'p25': 6.0, 'p50': 11.0, 'p75': 17.0, 'p95': 24.0, 'p99': 35.0, 'max': 44.0, 'sd': 7.8935, 'mean': 11.9971}
- labeled cross |ΔD|/|ΔA|: {'n': 1027, 'min': 0.0, 'p01': 0.0, 'p05': 0.2556, 'p25': 1.4815, 'p50': 3.4502, 'p75': 8.5394, 'p95': 44.507, 'p99': 152.8492, 'max': 1645.0328, 'sd': 60.9154, 'mean': 13.0163}

### FRESH_A_DEV

- D dist: {'n': 140, 'min': 34.0, 'p01': 38.39, 'p05': 46.0, 'p25': 57.0, 'p50': 65.0, 'p75': 71.0, 'p95': 82.05, 'p99': 87.22, 'max': 92.0, 'sd': 11.0931, 'mean': 63.9643}
- within-subject D range: {'n': 14, 'min': 17.0, 'p01': 17.26, 'p05': 18.3, 'p25': 25.5, 'p50': 33.0, 'p75': 40.0, 'p95': 50.75, 'p99': 53.35, 'max': 54.0, 'sd': 11.5016, 'mean': 33.8571}
- within-subject D SD: {'n': 14, 'min': 5.6372, 'p01': 5.6887, 'p05': 5.8946, 'p25': 7.9705, 'p50': 10.0776, 'p75': 12.8425, 'p95': 16.5877, 'p99': 17.7432, 'max': 18.0321, 'sd': 3.6562, 'mean': 10.5177}
- adjacent-block jump: {'n': 126, 'min': 0.0, 'p01': 0.0, 'p05': 0.25, 'p25': 3.0, 'p50': 7.0, 'p75': 15.75, 'p95': 24.0, 'p99': 29.75, 'max': 31.0, 'sd': 8.1043, 'mean': 9.746, 'p90': 21.5}
- within-block SD(A): {'n': 137, 'min': 1.0312, 'p01': 1.2822, 'p05': 1.7116, 'p25': 2.4171, 'p50': 3.0662, 'p75': 3.8436, 'p95': 4.9965, 'p99': 5.3914, 'max': 5.4788, 'sd': 0.9718, 'mean': 3.1673}
- labeled |ΔA|: {'n': 56, 'min': 0.0686, 'p01': 0.0924, 'p05': 0.1554, 'p25': 1.2402, 'p50': 2.0546, 'p75': 4.632, 'p95': 9.4058, 'p99': 13.3427, 'max': 14.6483, 'sd': 3.1794, 'mean': 3.2874}
- labeled cross |ΔD|: {'n': 49, 'min': 0.0, 'p01': 0.48, 'p05': 1.0, 'p25': 7.0, 'p50': 9.0, 'p75': 16.0, 'p95': 24.6, 'p99': 28.0, 'max': 28.0, 'sd': 7.7716, 'mean': 11.3469}
- labeled cross |ΔD|/|ΔA|: {'n': 49, 'min': 0.0, 'p01': 0.0391, 'p05': 0.2509, 'p25': 1.1922, 'p50': 4.5476, 'p75': 11.6246, 'p95': 109.6401, 'p99': 293.9058, 'max': 408.3791, 'sd': 64.8017, 'mean': 23.0126}

### COMBINED_DEV

- D dist: {'n': 700, 'min': 27.0, 'p01': 32.99, 'p05': 43.95, 'p25': 56.0, 'p50': 64.0, 'p75': 72.0, 'p95': 83.0, 'p99': 88.0, 'max': 92.0, 'sd': 12.0515, 'mean': 63.56}
- within-subject D range: {'n': 70, 'min': 16.0, 'p01': 16.69, 'p05': 19.9, 'p25': 27.0, 'p50': 36.0, 'p75': 41.75, 'p95': 56.2, 'p99': 59.93, 'max': 62.0, 'sd': 10.9098, 'mean': 35.8571}
- within-subject D SD: {'n': 70, 'min': 5.6372, 'p01': 5.7186, 'p05': 6.6879, 'p25': 8.5236, 'p50': 11.0298, 'p75': 13.3863, 'p95': 17.3678, 'p99': 18.695, 'max': 19.968, 'sd': 3.362, 'mean': 11.3447}
- adjacent-block jump: {'n': 630, 'min': 0.0, 'p01': 0.0, 'p05': 1.0, 'p25': 4.0, 'p50': 9.0, 'p75': 15.0, 'p95': 24.0, 'p99': 31.0, 'max': 38.0, 'sd': 7.5654, 'mean': 10.0635, 'p90': 21.0}
- within-block SD(A): {'n': 690, 'min': 1.0051, 'p01': 1.6194, 'p05': 2.0194, 'p25': 2.7122, 'p50': 3.295, 'p75': 3.853, 'p95': 5.1274, 'p99': 5.8546, 'max': 7.6371, 'sd': 0.9185, 'mean': 3.3444}
- labeled |ΔA|: {'n': 1510, 'min': 0.0, 'p01': 0.0, 'p05': 0.1713, 'p25': 1.2706, 'p50': 2.9796, 'p75': 5.416, 'p95': 9.7031, 'p99': 12.5728, 'max': 19.3832, 'sd': 3.0377, 'mean': 3.695}
- labeled cross |ΔD|: {'n': 1076, 'min': 0.0, 'p01': 0.0, 'p05': 1.0, 'p25': 6.0, 'p50': 11.0, 'p75': 17.0, 'p95': 24.25, 'p99': 35.0, 'max': 44.0, 'sd': 7.8856, 'mean': 11.9675}
- labeled cross |ΔD|/|ΔA|: {'n': 1076, 'min': 0.0, 'p01': 0.0, 'p05': 0.2534, 'p25': 1.4542, 'p50': 3.4877, 'p75': 8.7598, 'p95': 45.4042, 'p99': 172.3662, 'max': 1645.0328, 'sd': 61.1016, 'mean': 13.4715}

## 7. Feature contribution (COMBINED_DEV)

| component | mean | pop_sd | within_sd_p50 | var_share | corr_D | corr_simple_net | sign_cons | act |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| yongshin_fit | -0.775 | 6.1397 | 6.0056 | 0.3865 | 0.7791 | -0.0436 | 0.4533 | 0.9829 |
| relations | 2.51 | 4.9251 | 3.9072 | 0.2487 | 0.4686 | -0.0468 | 0.4972 | 1.0 |
| unseong | 0.5665 | 4.716 | 5.7497 | 0.228 | 0.4107 | -0.1019 | 0.4254 | 0.9186 |
| disease_resolution | 0.6069 | 2.0149 | 1.9301 | 0.0416 | 0.501 | 0.0144 | 0.5122 | 0.4943 |
| balance | 0.4931 | 1.7919 | 1.6686 | 0.0329 | 0.4198 | -0.1246 | 0.4188 | 0.9214 |
| structural_adj | -0.1381 | 1.6751 | 1.5335 | 0.0288 | 0.5396 | -0.0123 | 0.5068 | 0.7114 |
| shinsal | 0.1871 | 1.265 | 1.0593 | 0.0164 | 0.0825 | 0.0091 | 0.4917 | 0.4143 |
| trine | 0.0539 | 0.8427 | 0.7906 | 0.0073 | 0.1693 | -0.0263 | 0.5213 | 0.1214 |
| unseong_context | -0.15 | 0.7953 | 0.6583 | 0.0065 | 0.0816 | -0.1218 | 0.4775 | 0.1971 |
| haegong | 0.1934 | 0.5633 | 0.3375 | 0.0033 | 0.0521 | 0.0151 | 0.5094 | 0.1571 |
| base | 50.0 | 0.0 | 0.0 | 0.0 | None | None | None | 1.0 |

Fresh-A-only feature table is in `exp_d_audit.json` → `feature_contribution.FRESH_A_DEV`.

## 8. Shrink / rank diagnostics (annual S on DEVELOPMENT — not promotion)

### OLD_DEV

| λ | hit | pairwise | raw_sep |
|---:|---|---:|---:|
| 0.0 | 41/56 (73.21%) | 0.5806 | 0.9049 |
| 0.25 | 36/56 (64.29%) | 0.5558 | 0.721 |
| 0.5 | 33/56 (58.93%) | 0.5425 | 0.5371 |
| 0.75 | 34/56 (60.71%) | 0.5379 | 0.3532 |
| 1.0 | 34/56 (60.71%) | 0.5318 | 0.1693 |
| RANK_ONLY | 29/56 (51.79%) | 0.5301 | 0.4138 |

### FRESH_A_DEV

| λ | hit | pairwise | raw_sep |
|---:|---|---:|---:|
| 0.0 | 9/14 (64.29%) | 0.5357 | 0.8907 |
| 0.25 | 7/14 (50.0%) | 0.5 | 0.029 |
| 0.5 | 6/14 (42.86%) | 0.4643 | -0.8326 |
| 0.75 | 7/14 (50.0%) | 0.4464 | -1.6942 |
| 1.0 | 7/14 (50.0%) | 0.4286 | -2.5559 |
| RANK_ONLY | 7/14 (50.0%) | 0.4464 | -0.3039 |

## 9. Fresh A case boards (forensic, no patches)

### Robert Downey Jr.

- **丙子** 1994-2004 D=53.0 net=-2.0
  - good: []
  - bad: [{'year': 1996, 'label': '약물 및 무기 관련 체포와 재활/구금 시작', 'weight': 1.0, 'confidence': 'high', 'tags': ['health', 'legal_reputation']}, {'year': 1999, 'label': '보호관찰 위반으로 실형 선고 및 수감', 'weight': 1.0, 'confidence': 'high', 'tags': ['legal_reputation']}]
  - top+: [('disease_resolution', 2.7), ('haegong', 0.5), ('unseong', 0.0)]
  - top−: [('yongshin_fit', -7.2), ('relations', -1.62), ('structural_adj', -1.25)]
- **乙亥** 2004-2014 D=34.0 net=1.0
  - good: [{'year': 2008, 'label': 'Iron Man 성공으로 메이저 스타로 완전한 커리어 복귀', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('relations', 3.73), ('trine', 0.0), ('shinsal', 0.0)]
  - top−: [('yongshin_fit', -13.5), ('unseong', -8.0), ('structural_adj', -3.65)]
- **癸酉** 2024-2034 D=46.0 net=1.0
  - good: [{'year': 2024, 'label': 'Oppenheimer로 아카데미 남우조연상 수상', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('relations', 7.88), ('haegong', 1.0), ('unseong_context', 0.0)]
  - top−: [('yongshin_fit', -8.5), ('unseong', -8.0), ('balance', -3.4)]

### Whitney Houston

- **壬戌** 1983-1993 D=62.0 net=2.0
  - good: [{'year': 1985, 'label': '데뷔 앨범 Whitney Houston의 대규모 상업적 성공', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}, {'year': 1992, 'label': 'The Bodyguard 및 사운드트랙의 세계적 성공', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('unseong', 3.2), ('disease_resolution', 2.88), ('balance', 0.2)]
  - top−: [('yongshin_fit', -2.7), ('structural_adj', -1.25), ('relations', -0.26)]
- **甲子** 2003-2013 D=86.0 net=-1.8
  - good: []
  - bad: [{'year': 2006, 'label': 'Bobby Brown과의 결혼관계 파탄 및 이혼 절차', 'weight': 0.8, 'confidence': 'high', 'tags': ['relationship']}, {'year': 2012, 'label': '약물 관련 익사 사고로 사망', 'weight': 1.0, 'confidence': 'high', 'tags': ['health']}]
  - top+: [('yongshin_fit', 11.75), ('relations', 4.93), ('disease_resolution', 4.8)]
  - top−: [('unseong_context', 0.0), ('trine', 0.0), ('haegong', 0.0)]

### George Clooney

- **己丑** 1991-2001 D=46.0 net=0.3
  - good: [{'year': 1994, 'label': 'ER 출연으로 대중적 스타덤 진입', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: [{'year': 1992, 'label': 'Talia Balsam과 이혼', 'weight': 0.7, 'confidence': 'high', 'tags': ['relationship']}]
  - top+: [('relations', 4.24), ('unseong_context', 0.0), ('trine', 0.0)]
  - top−: [('yongshin_fit', -7.5), ('disease_resolution', -3.6), ('unseong', -3.52)]
- **戊子** 2001-2011 D=67.0 net=1.0
  - good: [{'year': 2006, 'label': 'Syriana로 아카데미 남우조연상 수상', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('relations', 8.77), ('trine', 2.5), ('yongshin_fit', 1.5)]
  - top−: [('unseong', -3.6), ('disease_resolution', -1.2), ('structural_adj', -0.34)]
- **丁亥** 2011-2021 D=71.0 net=-0.8
  - good: []
  - bad: [{'year': 2018, 'label': '이탈리아에서 오토바이 충돌 사고로 부상', 'weight': 0.8, 'confidence': 'high', 'tags': ['health']}]
  - top+: [('relations', 4.83), ('yongshin_fit', 4.15), ('balance', 1.8)]
  - top−: [('unseong', 0.0), ('unseong_context', 0.0), ('trine', 0.0)]

### Meryl Streep

- **癸酉** 1974-1984 D=42.0 net=1.0
  - good: [{'year': 1980, 'label': 'Kramer vs. Kramer로 아카데미 여우조연상 수상', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('balance', 3.0), ('unseong_context', 0.0), ('trine', 0.0)]
  - top−: [('yongshin_fit', -12.7), ('unseong', -4.56), ('relations', -2.57)]
- **乙亥** 1994-2004 D=70.0 net=-1.6
  - good: []
  - bad: [{'year': 2001, 'label': '모친 Mary Wilkinson Streep 사망', 'weight': 0.8, 'confidence': 'high', 'tags': ['health']}, {'year': 2003, 'label': '부친 Harry William Streep Jr. 사망', 'weight': 0.8, 'confidence': 'high', 'tags': ['health']}]
  - top+: [('unseong', 9.6), ('shinsal', 6.0), ('relations', 2.33)]
  - top−: [('yongshin_fit', -7.0), ('unseong_context', -1.5), ('structural_adj', -1.0)]
- **丙子** 2004-2014 D=63.0 net=1.0
  - good: [{'year': 2012, 'label': 'The Iron Lady로 세 번째 아카데미 연기상 수상', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('unseong', 8.0), ('relations', 2.82), ('shinsal', 1.0)]
  - top−: [('yongshin_fit', -8.25), ('structural_adj', -0.5), ('unseong_context', 0.0)]

### Martha Stewart

- **辛丑** 1992-2002 D=59.0 net=1.9
  - good: [{'year': 1997, 'label': 'Martha Stewart Living Omnimedia 설립으로 미디어 사업 통합', 'weight': 0.9, 'confidence': 'high', 'tags': ['career']}, {'year': 1999, 'label': 'Martha Stewart Living Omnimedia IPO로 큰 기업가치 형성', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('unseong', 6.4), ('structural_adj', 3.0), ('balance', 2.0)]
  - top−: [('relations', -8.0), ('yongshin_fit', -4.5), ('unseong_context', 0.0)]
- **壬寅** 2002-2012 D=65.0 net=-2.0
  - good: []
  - bad: [{'year': 2003, 'label': '증권거래 관련 혐의로 기소되고 회사 경영직에서 물러남', 'weight': 1.0, 'confidence': 'high', 'tags': ['legal_reputation']}, {'year': 2004, 'label': '허위진술 등 혐의 유죄평결과 징역형 선고', 'weight': 1.0, 'confidence': 'high', 'tags': ['legal_reputation']}]
  - top+: [('shinsal', 2.0), ('unseong', 1.6), ('balance', 1.6)]
  - top−: [('structural_adj', -1.0), ('yongshin_fit', -0.4), ('unseong_context', 0.0)]

### Arnold Schwarzenegger

- **乙巳** 1964-1974 D=73.0 net=-0.8
  - good: []
  - bad: [{'year': 1972, 'label': '부친 Gustav Schwarzenegger 사망', 'weight': 0.8, 'confidence': 'high', 'tags': ['health']}]
  - top+: [('unseong', 8.0), ('relations', 6.45), ('balance', 1.6)]
  - top−: [('disease_resolution', -2.07), ('structural_adj', -1.2), ('yongshin_fit', -0.25)]
- **壬寅** 1994-2004 D=63.0 net=1.0
  - good: [{'year': 2003, 'label': 'California 주지사 선거 당선', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('relations', 8.05), ('disease_resolution', 2.07), ('balance', 1.2)]
  - top−: [('unseong', -8.0), ('yongshin_fit', -0.7), ('unseong_context', 0.0)]
- **辛丑** 2004-2014 D=63.0 net=0.0
  - good: [{'year': 2006, 'label': 'California 주지사 재선', 'weight': 1.0, 'confidence': 'high', 'tags': []}]
  - bad: [{'year': 2011, 'label': '가정부와의 혼외자 존재 공개와 Maria Shriver와의 별거', 'weight': 1.0, 'confidence': 'high', 'tags': []}]
  - top+: [('relations', 7.12), ('balance', 2.6), ('haegong', 0.5)]
  - top−: [('unseong', -6.4), ('structural_adj', -1.25), ('unseong_context', 0.0)]

### Marilyn Monroe

- **辛卯** 1944-1954 D=39.0 net=1.0
  - good: [{'year': 1953, 'label': 'Niagara, Gentlemen Prefer Blondes 등으로 정상급 할리우드 스타로 부상', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: []
  - top+: [('unseong_context', 0.0), ('trine', 0.0), ('shinsal', 0.0)]
  - top−: [('yongshin_fit', -8.25), ('unseong', -8.0), ('relations', -2.44)]
- **庚寅** 1954-1964 D=59.0 net=-1.0
  - good: [{'year': 1960, 'label': 'Some Like It Hot로 골든글로브 여우주연상 수상', 'weight': 1.0, 'confidence': 'high', 'tags': ['career']}]
  - bad: [{'year': 1961, 'label': 'Arthur Miller와 이혼 및 정신건강 위기로 병원 치료', 'weight': 1.0, 'confidence': 'high', 'tags': ['relationship']}, {'year': 1962, 'label': '약물 과다복용으로 사망', 'weight': 1.0, 'confidence': 'high', 'tags': ['health']}]
  - top+: [('relations', 5.25), ('unseong', 0.0), ('unseong_context', 0.0)]
  - top−: [('yongshin_fit', -4.65), ('structural_adj', -1.25), ('balance', -0.2)]

## 10. Ranking vs amplitude

- Case tag: `CASE_C`
- OLD_DEV block pairwise (simple_net): 0.4645
- FRESH_A_DEV block pairwise (simple_net): 0.3929
- FRESH_A S pairwise by λ: {'0.0': 0.5357, '0.25': 0.5, '0.5': 0.4643, '0.75': 0.4464, '1.0': 0.4286}
- Shrink helps on Fresh A annual S?: True
- Legacy note: ranking weak on both pools

## 11. Explicit answers

1. **What does D measure?** A Daewoon-pillar `_composite_score` of natal-relative 용신 fit, 12운성, relations/trine, balance delta, 신살/병인/해공, and v6.4 structural adj, then +SCORE_BIAS(=10) and clamp to 0–100. It is an engine “종합운” climate for a 10-year pillar, not a life-event calibrated quality index.
2. **Truly Daewoon-specific?** Temporally yes (pillar vs natal only; no Sewoon year inputs, no Control close). Semantically it shares the same composite family as annual scores.
3. **Dominant primitives?** Variance share on COMBINED_DEV: `yongshin_fit` ≈39%, `relations` ≈25%, `unseong` ≈23%; then `disease_resolution`, `balance`, `structural_adj`. `yongshin_fit` corr(D)≈0.78 but sign-consistency vs block `simple_net` ≈0.45 (near chance).
4. **Weak/unknown provenance?** Numeric scales (10/5/−10/−5, balance×20, SCORE_BIAS=10, structural ±8) are heuristic/product-tuned. Classical themes exist for 운성/합충/용신, but coefficient provenance is mostly unknown beyond engine inheritance. No named-celeb patches found inside D.
5. **Annual-like signals in D?** No Sewoon stem enters D. The risk is thematic overlap with G, not calendar leakage.
6. **Double-count with G?** Yes at theme level (fit/rel/struct/uns/bal). Not literal reuse of the same year-breakdown row. Annual-only G patterns (discord/hollow/ilju/career_tg) are not in D.
7. **OLD_DEV block ranking useful?** No. Within-subject pairwise on `simple_net` = **0.4645** (n_pairs=335); spearman ≈ −0.09. Below chance.
8. **FRESH_A_DEV block ranking useful?** No. Pairwise = **0.3929** (n_pairs=30); spearman ≈ −0.08. Worse than OLD_DEV → not a legacy-only artifact.
9. **Ranking vs amplitude?** **Both.** Ranking is wrong/weak; amplitude is also too large (`|ΔD|/|ΔA|` p50 ≈ 3.5 OLD / **4.55** Fresh A; adjacent-block jump p50≈7–9, p90≈21).
10. **D vs A variation?** D SD ≈11–12 points across blocks; labeled cross-block |ΔD| routinely several× |ΔA|. Shrink λ→0 lifts Fresh A annual S pairwise 0.429 → **0.536**.
11. **Largest incorrect block diffs?** Driven mainly by `yongshin_fit` + `unseong` + `relations` (e.g. Streep 癸酉 D=42 vs 乙亥 D=70; Whitney peak-career D=62 vs crisis D=86; RDJ recovery D=34 vs addiction D=53). Same generic components — not subject-specific patches.
12. **Does shrink improve S?** Yes on DEVELOPMENT diagnostics (Fresh A and OLD_DEV monotonic improvement as λ↓). This does **not** promote any λ; it shows amplitude harm given frozen A.
13. **Defensible absolute parent?** Not as currently constructed. Wrong block ordering + excessive scale make D a harmful absolute parent for S=D+A.
14. **Next phase:** **both** — D material redesign **and** amplitude policy. Do not “fix” by raising α. Do not revise G in the D_new design phase until D role is redefined.
15. **Must stay frozen before D_new:** α=1.0, κ=0, β=0.25, median centering, `G_CLEAN_AXIS` formula, `saju_engine.py` untouched until explicit promote, Validation B sealed, no subject patches, no year-label tuning of D.

## 12. Final verdict

`D_MIXED_RANKING_AND_AMPLITUDE_PROBLEM`

No D_new in this run. Validation B remains sealed.