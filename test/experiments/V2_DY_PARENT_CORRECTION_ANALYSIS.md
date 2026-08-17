# V2 DY Parent Correction Analysis (Phase 2.6)

**Status:** `V2_DY_B_FINAL_NUMERIC_FREEZE`  
**Erratum:** Parent changing annual order is **allowed**. Use PARENT_HELP / PARENT_HARM / NET_PARENT_VALUE.

---

## Definitions

- **PARENT_HARM:** annual-local (A) ranking correct; final Y ranking wrong.  
- **PARENT_HELP:** annual-local wrong; final Y correct with parent (D) contribution.  
- **NET_PARENT_VALUE:** HELP − HARM.

Matrix tags: LOCAL_CORRECT_PARENT_PRESERVES / STRENGTHENS / HARMS · LOCAL_WRONG_PARENT_HELPS / STILL_WRONG · LOCAL_TIE_PARENT_RESOLVES.

---

## Fresh A summary

| Model | HELP | HARM | NET | same-D | cross-D |
|-------|------|------|-----|--------|---------|
| V2_DY_B | 0.107 | 0.018 | **+0.089** | 0.571 | 0.653 |
| H1::CONS | 0.125 | 0.036 | +0.089 | 0.571 | 0.653 |
| H2::CONS | 0.125 | 0.036 | +0.089 | 0.571 | 0.653 |

Gating increases both HELP and HARM slightly; net flat vs B on CONSERVATIVE.

---

## By-gate (H1/H2 CONSERVATIVE, FA cross pairs)

| Gate | n | HELP | HARM | NET |
|------|---|------|------|-----|
| LOW | 31 | 0.097 | 0.032 | +0.065 |
| MEDIUM | 8 | 0.375 | 0.000 | +0.375 |
| HIGH | 6 | 0.000 | 0.167 | **−0.167** |
| TRANSFORMATIVE | 4 | 0.250 | 0.000 | +0.250 |

**Failure:** HIGH gate does not earn its larger corrections on this development slice.

---

## Cross by pair-regime-difference (H* CONS)

| rdiff class | pairwise |
|-------------|----------|
| LOW | 0.676 |
| MEDIUM | 0.333 |
| HIGH | 1.000 (tiny n) |

Medium rdiff underperforms — another sign adaptive contrast is not cleanly calibrated.

---

## Conflict cases (strong D direction vs opposing A)

See `exp_v2_dy_hierarchy_26.json` → `conflict_cases` for year-level chains:

`D_B → gate/direction/corr → A / annual_dev_B → dy → Y`

No named patches.

---

## Conclusion

Parent influence under B is already **net-positive**.  
Gated HIGH influence is **not** yet beneficial enough to replace B’s flat D.
