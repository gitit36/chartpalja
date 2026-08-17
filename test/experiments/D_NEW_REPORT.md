# D_NEW Material Experiment Report

**Status:** `DNEW_MATERIAL_NOT_READY`
**Measured at:** 2026-08-13T00:00:30

Validation B sealed. G/α/κ/β/centering frozen. Engine untouched.

Pools: OLD_DEV=56 FRESH_A_DEV=14

## Feature direction audit (robust-z primitive vs simple_net)

| family | class | OLD pw | FA pw | COMB pw | act |
|---|---|---:|---:|---:|---:|
| fit | THEORY_DATA_CONFLICT | 0.4345 | 0.2619 | 0.3995 | 0.9829 |
| unseong | THEORY_DATA_CONFLICT | 0.4611 | 0.3095 | 0.4304 | 0.9186 |
| relations | NEUTRAL | 0.534 | 0.4881 | 0.5247 | 1.0 |
| balance | THEORY_DATA_CONFLICT | 0.4308 | 0.3095 | 0.4062 | 0.92 |
| structural | NEUTRAL | 0.4561 | 0.5774 | 0.4807 | 0.7114 |
| trine | NEUTRAL | 0.4832 | 0.5238 | 0.4915 | 0.1214 |
| shinsal | UNSTABLE | 0.5554 | 0.3214 | 0.508 | 0.4143 |
| disease | NEUTRAL | 0.5023 | 0.4524 | 0.4921 | 0.4943 |
| haegong | NEUTRAL | 0.4838 | 0.5536 | 0.498 | 0.1571 |

D6_MINIMAL families (aggregate): `['relations']`

## SCORE_BIAS ranking check

- D_REF COMBINED: {'target': 'simple_net', 'n_subjects': 69, 'n_pairs': 365, 'wins': 168, 'ties': 11, 'losses': 186, 'pairwise_mean': 0.4499, 'pairwise_median': 0.4643, 'pairwise_p25': 0.3333, 'pairwise_p75': 0.6667, 'pairwise_pooled': 0.4753, 'spearman': -0.0697, 'kendall': -0.0479}
- H_REF_RAW COMBINED: {'target': 'simple_net', 'n_subjects': 69, 'n_pairs': 365, 'wins': 174, 'ties': 0, 'losses': 191, 'pairwise_mean': 0.4521, 'pairwise_median': 0.4667, 'pairwise_p25': 0.3333, 'pairwise_p75': 0.6667, 'pairwise_pooled': 0.4767, 'spearman': -0.0691, 'kendall': -0.0471}

## Deterministic + D7 candidates (simple_net)

| candidate | OLD pw | FA pw | COMB pw | FA n_subj |
|---|---:|---:|---:|---:|
| D_REF_score | 0.4645 | 0.3929 | 0.4499 | 14 |
| H_REF_RAW_score | 0.4641 | 0.4048 | 0.4521 | 14 |
| D1_EQUAL_ALL | 0.5097 | 0.3095 | 0.4691 | 14 |
| D2_CORE | 0.4305 | 0.4286 | 0.4301 | 14 |
| D3_NO_YFIT | 0.447 | 0.4762 | 0.4529 | 14 |
| D4_NO_UNSEONG | 0.4242 | 0.4524 | 0.4299 | 14 |
| D5_NO_RELATIONS | 0.427 | 0.3333 | 0.408 | 14 |
| D6_MINIMAL | 0.534 | 0.4881 | 0.5247 | 14 |
| D2_CORE_meanz | 0.4323 | 0.4286 | 0.4315 | 14 |
| D2_PLUS_TRINE | 0.4268 | 0.4286 | 0.4272 | 14 |
| D2_PLUS_SHINSAL | 0.5352 | 0.2381 | 0.4749 | 14 |
| D2_PLUS_DISEASE | 0.4837 | 0.4286 | 0.4725 | 14 |
| D2_PLUS_HAEGONG | 0.4284 | 0.5238 | 0.4477 | 14 |
| D7_CONSTRAINED | 0.4882 | 0.6905 | 0.5292 | 14 |

### D7 ridge LOSO

- best α_reg: 0.1
- coef mean: [0.0115, -0.1525, -0.0773, -0.131, 0.014] (features ['fit', 'unseong', 'relations', 'balance', 'structural'])
- coef std: [0.0135, 0.0125, 0.0109, 0.0093, 0.0101]
- sign stable: [False, True, True, True, False]

## Material gate

- thresholds: COMB≥0.52 FA≥0.5 OLD≥0.48
- gated: []
- selected H: `None`
- D7 numeric-gate note: {'numeric_gate': True, 'combined': 0.5292, 'fresh': 0.6905, 'old': 0.4882, 'n_subj': 69}
- permutation null (Fresh A): None

Note: D7 OOF can look strong on Fresh A while learning **negative** weights on `unseong`/`relations`/`balance` (THEORY_DATA_CONFLICT / near-chance families). That fails the cleanliness gate and is **not** freeze-eligible under the D_NEW semantic contract.

## Explicit answers

1. Useful on OLD_DEV (pw>0.55): ['shinsal']
2. Useful on Fresh A (pw>0.55): ['structural', 'haegong']
3. Harmful/unstable/conflict on audit: ['fit', 'unseong', 'balance']; classes=[('fit', 'THEORY_DATA_CONFLICT'), ('unseong', 'THEORY_DATA_CONFLICT'), ('relations', 'NEUTRAL'), ('balance', 'THEORY_DATA_CONFLICT'), ('structural', 'NEUTRAL'), ('trine', 'NEUTRAL'), ('shinsal', 'UNSTABLE'), ('disease', 'NEUTRAL'), ('haegong', 'NEUTRAL')]
4. yongshin_fit dominant role deserved? class=THEORY_DATA_CONFLICT FA=0.2619 COMB=0.3995 → likely **no** as sole driver.
5. unseong independent? FA=0.3095 COMB=0.4304 class=THEORY_DATA_CONFLICT
6. relations independent? FA=0.4881 COMB=0.5247 class=NEUTRAL
7. D2_CORE vs D_REF COMBINED: 0.4301 vs 0.4499
8. D3_NO_YFIT FA/COMB: 0.4762 / 0.4529
9. D4_NO_UNSEONG: 0.4524 / 0.4299
10. D5_NO_RELATIONS: 0.3333 / 0.408
11. Aux add-ons: ['trine: FA=0.4286 OLD=0.4268', 'shinsal: FA=0.2381 OLD=0.5352 legacy_overfit_risk', 'disease: FA=0.4286 OLD=0.4837', 'haegong: FA=0.5238 OLD=0.4284']
12. D7 OOF vs D2: FA 0.6905 vs 0.4286
13. D7 coef stability: [False, True, True, True, False]
14. Selected H: `None`
15–16. No H passed material gate.
17. Selected gamma: None
18–21. Amplitude not completed or not justified.
22. Candidate depends on named cases? **No** — selection used aggregate gates only; cases are post-hoc.
23. Ready to freeze? **no** (`DNEW_MATERIAL_NOT_READY`)
24. Unproven until Validation B: external generalization of H ranking + chosen gamma under sealed lives.

## Final status

`DNEW_MATERIAL_NOT_READY`

Do **not** score Validation B in this run.