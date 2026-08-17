# D Block Label Spec (predeclared)

**Status:** DEVELOPMENT diagnostics only  
**Date:** 2026-08-12  
**Do not tune D to these targets.**  
**Validation B is sealed and must not appear in any pool.**

## Development pools

| Pool | Source | Role |
|------|--------|------|
| `OLD_DEV` | All usable `yongshin_subjects.json` subjects (all tiers; exclude placeholder `본인`) | Contaminated historical development |
| `FRESH_A_DEV` | Eligible Fresh Validation A from `g_fresh_labels_frozen.json` | Contaminated after one-shot open |
| `COMBINED_DEV` | Union of above | Development-only aggregate |

**Hard reject:** any subject with `split == validation_b`.

## Event → block assignment

1. Obtain engine `build_daewoon_detail` rows: `daewoon_pillar`, `start_year`, `end_year`, `종합운점수` (=D), `breakdown`.
2. Assign an event year `y` to the unique block with `start_year <= y < end_year`.
3. If no block matches → `unmapped_event` (report; do not invent a block).
4. Do **not** relabel events. Do **not** drop events because D disagrees.

## Block evidence gate

A block with **zero** mapped eligible events is:

```text
insufficient_event_evidence = true
```

Such blocks are **excluded** from pairwise better/worse block comparisons and from Spearman/Kendall against targets.
They remain in D distribution / amplitude audits.

## Axis tagging (transparent)

1. Prefer explicit `event["axis"]` when present (`career` / `health` / `relationship` / `legal` / `reputation` / …).
2. Else keyword heuristic on `label` (casefold):

| Tag | Keywords (non-exhaustive; see code) |
|-----|-------------------------------------|
| career | award, oscar, championship, title, election, elected, ipo, album, debut, nobel, career, 우승, 당선, 수상, 데뷔, 출마 |
| health | cancer, overdose, illness, stroke, injury, hospital, death, suicide, 암, 과다복용, 부상, 사망, 질환 |
| relationship | marriage, wedding, divorce, affair, spouse, 결혼, 이혼, 재혼, 약혼 |
| legal_reputation | lawsuit, arrest, indictment, prison, scandal, bankruptcy, impeach, 기소, 수감, 소송, 파산, 스캔들 |

Multi-tag allowed; an event can contribute to career-only and legal filters separately when tagged.

Confidence: use `event["confidence"]`. Treat `high` as high-confidence; missing → medium for OLD_DEV weight, but **high-confidence-only** target requires explicit `high`.

## Predeclared block targets

All reported side-by-side. **No selection of the best-looking target.**

### A. `simple_net`

```text
sum(good weights) − sum(bad weights)
```

### B. `normalized_balance`

```text
(good_w − bad_w) / (good_w + bad_w)   if good_w + bad_w > 0
else undefined → exclude block from this target
```

### C. `high_confidence_balance`

Same as B but only events with `confidence == "high"`.
If no high-confidence events in block → insufficient for this target.

### D. `career_only_balance`

Same as B restricted to career-tagged events.

### E. `non_career_balance`

Same as B on events that are **not** career-tagged (health / relationship / legal_reputation / untagged-noncareer). Untagged events with no keyword match are treated as **non-career** for E only if they also fail career keywords; pure untagged → contribute to A/B only, not D/E specialty filters unless tagged.

Clarification implemented in code:

- career-only: axis/heuristic == career
- non-career: axis/heuristic in {health, relationship, legal_reputation} OR (explicit non-career axis)
- untagged with no heuristic → excluded from D and E specialty targets (still in A/B)

## Within-subject block pairwise

For each subject with ≥2 evidence blocks under a target:

```text
pair win if D(better_block) > D(worse_block)
tie if D equal
```

where better/worse ordered by the target value (higher = better life-event balance).

Primary reporting: **within-subject** pairwise mean, then pool.

Do **not** treat cross-person D=70 as identical semantics without also reporting within-subject metrics.

## Amplitude diagnostics (not promotion)

Predeclared shrink λ ∈ {0, 0.25, 0.50, 0.75, 1.00}:

```text
D_shrunk = subject_median_D + λ * (D − subject_median_D)
S = squash(D_shrunk + A)   # A from frozen G_CLEAN_AXIS median centering
```

`λ=1` = current D. `λ=0` = CONSTANT_D (person median).

RANK_ONLY_D: map within-subject D ranks to fixed spread `[-2,-1,0,+1,+2]` (or standardized rank if fewer/more blocks), then `S = squash(50 + 8*rank_score + A)` diagnostic only.

**Do not promote any λ.**
