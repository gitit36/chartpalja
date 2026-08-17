# V3 PUBLIC_LIFE DEV/CHECK report

**Status:** `V3_REJECTED_KEEP_CONTROL`

CONTROL = production annual `candle.close`.  
V2 = frozen V2_DY_B (`experiment_v2_dy.py` hash16 `d2c0199c5194dd63`).  
V3 = one challenger, `V3_ENGINE_D_CLIPPED_G` (experiment code only).

FINAL not opened. Validation B not used. Production not wired. CHECK not opened (DEV gate failed). No V3.1. No V4.

## 1. Verify

`validate_public_life_v1_stage1.py` → `PUBLIC_LIFE_V1_STAGE1_OK`.  
DEV n=24. CHECK n=8 (file present; scores never computed).

## 2. DEV diagnosis (no tuning)

PUBLIC_LIFE DEV only. z-source for V2 = OLD_DEV + Fresh A.

| model | macro pairwise | subject hit | std sep | median sep | + | − |
|---|---:|---:|---:|---:|---:|---:|
| CONTROL | 0.5208 | 13/24 | 0.0503 | 0.75 | 13 | 11 |
| V2_DY_B | 0.5104 | 10/24 | −0.0536 | −0.0841 | 10 | 14 |

| model | same-D pw | cross-D pw | parent help | parent harm | parent net |
|---|---:|---:|---:|---:|---:|
| CONTROL | 0.3611 | 0.5577 | 0.2604 | 0.1771 | 0.0833 |
| V2_DY_B | 0.5000 | 0.5128 | 0.0938 | 0.0208 | 0.0729 |

| structure | CONTROL | V2_DY_B |
|---|---:|---:|
| D range | 24–94 | 59.1–65.5 |
| adj D jump p50 / p90 | 9.0 / 20.0 | 0.80 / 2.88 |
| \|annual_dev\| p50 / p90 | 4.0 / 11.0 | 1.49 / 3.99 |
| Y sat frac | 0 | 0 |
| yoy \|Δ\| p90 / p99 | 9.0 / 17.0 | 5.50 / 9.29 |
| annual dominates D | 0.203 | 0.479 |

Failure clusters (IDs only):

- CONTROL miss 11/24. Same-D error 0.611 (18 pairs). Cross-D error 0.423 (78 pairs). Examples: `PLV1_001`, `PLV1_006`, `PLV1_011`.
- V2 miss 14/24. Same-D error 0.500. Cross-D error 0.487. Examples: `PLV1_001`, `PLV1_005`, `PLV1_007`.

Diagnosis (not a tune): Control same-D is the weak axis; Control D has real range but Daewoon cliffs. V2 D is nearly flat, so annual often dominates the parent.

## 3. Synthetic property QA (structural only)

n=5000 supported births (seed 20260815). Full 40-year annual on first 400. No labels.

| check | CONTROL | V2_DY_B | V3 (post-hoc) |
|---|---:|---:|---:|
| Y saturation | 0 | 0 | 0.0008 |
| D cliff frac (jump ≥20) | 0.6318 (n=5000) | 0 (n=400) | 0.335 (n=400) |
| D flat frac (range <1) | 0 | 0.1825 | 0 |
| annual dominates D | — | 0.443 | 0.121 |
| yoy \|Δ\| p90 / p99 | — | 5.37 / 9.69 | 6.65 / 20.00 |
| D range | engine 종합운 | 59.1–65.9 | 22–100 |

Day-master / strength bias (CONTROL means, no collapse):

- D by day stem: 62.0–63.7
- Y by day stem: 61.3–65.0
- D by strength: 61.0–64.6
- Y by strength: extreme buckets ~60.6; mid buckets ~63.8–64.1

No calendar/pack failures among the 5000 accepted births. Synthetic QA is not an accuracy score.

## 4. One V3 (exactly 3 structural changes)

Chosen from DEV + synthetic diagnosis. No coefficient search. No named-person patches.

1. Parent D = production engine `종합운점수` (replace flat V2 `D_B`).
2. Drop `B_trigger` and the 0.65/0.35 mix.
3. `annual_dev = clip(A_G, ±4.0)` so the year cannot dominate the parent. Clip taken from V2 `|annual_dev|` p90 on DEV, not swept.

`Y = clamp(D_engine + clip(A_G, ±4))`

Code: `test/experiments/v3_public_life/experiment_v3_public_life.py`  
SHA256 `7669e4fca4c28647af55538e85b9bdbd7ccfdde2f6832399965251f803f4b30e`

## 5. DEV gate

| model | macro pairwise | subject hit | std sep | median sep | + | − |
|---|---:|---:|---:|---:|---:|---:|
| CONTROL | 0.5208 | 13/24 | 0.0503 | 0.75 | 13 | 11 |
| V2_DY_B | 0.5104 | 10/24 | −0.0536 | −0.0841 | 10 | 14 |
| V3 | 0.5312 | 13/24 | 0.0392 | 2.3172 | 13 | 11 |

V3 same-D pw 0.3611 (identical to Control). Cross-D 0.5705. Parent net 0.1563. Annual-dominates-D 0.1075. Miss examples same as Control: `PLV1_001`, `PLV1_006`, `PLV1_011`.

Regression guards (not optimization targets):

| pool | model | pairwise | hit | std sep | median sep |
|---|---|---:|---:|---:|---:|
| OLD_DEV n=56 | CONTROL | 0.5006 | 25/56 | −0.0237 | −0.9309 |
| OLD_DEV n=56 | V3 | 0.5327 | 32/56 | 0.0025 | 0.6064 |
| FRESH_A n=14 | CONTROL | 0.5179 | 8/14 | −0.1389 | 1.25 |
| FRESH_A n=14 | V3 | 0.4107 | 7/14 | −0.2526 | 0.0669 |

Gate rules and outcomes:

- DEV pairwise ≥ Control: **pass** (0.5312 ≥ 0.5208)
- DEV std sep > Control: **fail** (0.0392 < 0.0503)
- Not materially worse on OLD_DEV: **pass** (pw +0.032, sep +0.026)
- Not materially worse on Fresh A: **fail** (pw −0.107, sep −0.114; material = pw drop >0.03 or sep drop >0.05)
- No material synthetic saturation regression: **pass** (0.0008)
- Complexity: simpler than V2 (dropped trigger + mix). Inherits Control D cliffs (synthetic cliff 0.335 vs V2 0.000). Not a gate fail by itself.

**DEV_GATE FAIL** `['DEV_std_sep_not_gt_CONTROL', 'FRESH_A_material_regression']`

V3 does not need to beat V2. It failed the Control gates. Stop.

## 6. CHECK

Not opened. Gate failed, so CHECK remains unused.

## 7. Freeze

| artifact | path |
|---|---|
| diagnostics | `test/experiments/v3_public_life/V3_DIAGNOSTICS.json` |
| this report | `test/experiments/v3_public_life/V3_DEV_CHECK_REPORT.md` |
| spec | `test/experiments/v3_public_life/V3_FROZEN_SPEC.json` |
| experiment | `test/experiments/v3_public_life/experiment_v3_public_life.py` |

Rejected challenger is recorded for audit. Production stays CONTROL (`candle.close`).

`V3_REJECTED_KEEP_CONTROL`
