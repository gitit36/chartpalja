# CONTROL vs V2_DY_B

No tuning. Control is production `candle.close`, not LEGACY_B9.

---

## DEVELOPMENT COMPARISON

Pools: OLD_DEV (`yongshin_subjects`) and Fresh Validation A only.

### OLD_DEV

| model | macro pairwise | subject hit | std sep | median sep | positive | negative |
|---|---:|---:|---:|---:|---:|---:|
| CONTROL | 0.4998 | 25/56 | -0.0242 | -0.9309 | 25 | 31 |
| V2_DY_B | 0.5749 | 39/56 | 0.2213 | 0.8292 | 39 | 17 |
| delta (V2 − CONTROL) | 0.0751 | +14 hits | 0.2455 | 1.7601 | +14 | -14 |

### FRESH_A

| model | macro pairwise | subject hit | std sep | median sep | positive | negative |
|---|---:|---:|---:|---:|---:|---:|
| CONTROL | 0.5179 | 8/14 | -0.143 | 1.25 | 8 | 6 |
| V2_DY_B | 0.6429 | 9/14 | 0.3714 | 0.7297 | 9 | 5 |
| delta (V2 − CONTROL) | 0.125 | +1 hits | 0.5144 | -0.5203 | +1 | -1 |

These development numbers are not a reason to retune.

---

## NEW BLIND USER PILOT

n=4 acquaintances. `BLIND_USER_QA_PILOT` — not validation, not an accuracy estimate.

Each participant gets anonymous Chart A and Chart B (Control and V2_DY_B, randomly assigned, 2/2 balanced).
Mapping is in `test/blind_qa/pilot_4/BLIND_PILOT_AB_MAPPING.json` (internal only).

Do not aggregate n=4 into a model-accuracy claim.

---

## CONSUMED HOLDOUT

Validation B is consumed and remains **V2-only**. Control was not scored on B.

V2 one-shot status: `ANNUAL_FAIL` (n=14).
V2 macro pairwise 0.3393; subject hit 4/14; std sep -0.5605; median sep -1.1492.

---

V2 hash `experiment_v2_dy.py` `d2c0199c5194dd63` unchanged.
