# V2 DY Regime Gate Audit (Phase 2.6)

**Status:** `V2_DY_B_FINAL_NUMERIC_FREEZE`

---

## Predeclared gate (unchanged after scoring)

See `V2_DY_HIERARCHY_26_SPEC.md` §§4–7.

- Independent evidence **groups** (not raw dim counts)  
- `natal_context_confidence` damp  
- HIGH strength + weak |direction| → restrain signed correction; keep event intensity  

### Amplitude maps

| Map | LOW | MED | HIGH | TRANS |
|-----|-----|-----|------|-------|
| CONSERVATIVE | 0 | 2 | 6 | 10 |
| BALANCED | 0 | 3 | 9 | 14 |
| EXPRESSIVE | 1 | 4 | 12 | 18 |

---

## Block gate histogram

| Gate | n blocks |
|------|----------|
| LOW | 467 |
| MEDIUM | 76 |
| HIGH | 97 |
| TRANSFORMATIVE | 60 |

TRANS not rare enough ideally (60/700 ≈ 8.6%) — possible residual over-trigger, but CONSERVATIVE amp still capped.

---

## Calibration vs ideal

Ideal monotonic pattern:

LOW → tiny corr, little parent effect  
MED → moderate, ≥neutral net  
HIGH → larger corr, **clearly positive** net  

Observed (FA, H* CONSERVATIVE):

| Gate | mean \|corr\| | NET parent |
|------|---------------|------------|
| LOW | 0.00 | +0.065 ✓ |
| MEDIUM | 0.56 | +0.375 ✓ |
| HIGH | 2.14 | **−0.167 ✗** |
| TRANS | 4.74 | +0.250 ✓ (n=4) |

**HIGH breaks calibration** → hard reject for numeric gated D.

---

## Jump validity

Under CONSERVATIVE gated D: **no adjacent |ΔD| ≥ 10** (max ≈ 8.2).  
Large-jump support metric not applicable; amplitude stayed earned-but-bounded.

BALANCED/EXPRESSIVE increase adj p90 but worsen FA pairwise and keep HIGH-gate net issue.

---

## Independence / confidence fixes vs Phase 2.5

| Issue in 2.5 | 2.6 treatment |
|--------------|---------------|
| Related dims counted as independent | Grouped into 7 families |
| High intensity ≠ high valence | restrain_signed when \|dir\| low |
| Natal uncertainty ignored | natal_context_confidence damp |
| Universal larger γ | gate-dependent maps only |

These improved **process coherence** but did not produce a promotable HIGH-gate net.

---

## Decision

Gate machinery is useful for **explanation / audit**.  
It is **not** ready as a numeric parent amplifier for V2.

Numeric D/Y = **V2_DY_B** permanently for V2.
