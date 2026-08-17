# V2 DY Hierarchy 2.6 Report

**Status:** `V2_DY_B_FINAL_NUMERIC_FREEZE`  
**Winner (numeric):** `V2_DY_B`  
**Best gated maps tried:** H1/H2 `::CONSERVATIVE` (FA tie with B overall)  
**Measured:** see `exp_v2_dy_hierarchy_26.json`

Val B sealed. Engine untouched. No Month/Day. **No Phase 2.7.**

---

## Headline

Confidence-gated Daewoon corrections **preserve** Fresh A pairwise at **0.6429** under CONSERVATIVE maps and improve distinctiveness (adj p90 **4.22** vs B **2.40**), with LOW gate mean |corr| = **0**.

They do **not** earn numeric promotion because **HIGH gate NET_PARENT_VALUE = −0.1667** on Fresh A cross pairs (n=6): the gate’s strongest class is not empirically trustworthy yet.

Per Phase 2.6 rules → **`V2_DY_B` is the permanent V2 numeric D/Y freeze.**

---

## Philosophy correction

| Old | Correct |
|-----|---------|
| D_OVERRIDE = bad | Parent change is allowed |
| Minimize override | Evaluate PARENT_HELP / HARM / NET |
| Fixed D>Y weight | Time hierarchy ≠ weight hierarchy |
| Y must stay near D | Sewoon may cross Daewoon baseline |

---

## Metrics (Fresh A / OLD)

| label | FA pw | same-D | cross-D | high-rdiff | help | harm | net | OLD pw | adj p90 | mean\|corr\| LOW/HIGH |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| V2_DY_B | **0.6429** | 0.5714 | 0.6531 | 1.0* | 0.107 | 0.018 | **+0.089** | 0.5749 | 2.40 | 0 / 0 |
| H1::CONS | **0.6429** | 0.5714 | 0.6531 | 1.0* | 0.125 | 0.036 | +0.089 | ~same | **4.22** | **0 / 2.14** |
| H2::CONS | **0.6429** | 0.5714 | 0.6531 | 1.0* | 0.125 | 0.036 | +0.089 | ~same | **4.22** | **0 / 2.14** |
| H1::BAL | 0.625 | — | — | — | — | — | +0.071 | — | 5.67 | 0 / 3.21 |
| H*::EXPR | 0.607 | — | — | — | — | — | +0.054 | — | 6.99 | 0.19 / 4.28 |

\*high-rdiff cell tiny (few pairs); treat cautiously.

Promote reject reason: **`HIGH_gate_negative_net`** for both H1 and H2 best maps.

---

## Gate calibration (FA, H1/H2 CONSERVATIVE)

| Gate | n cross pairs | HELP | HARM | NET | mean \|corr\| |
|------|---------------|------|------|-----|---------------|
| LOW | 31 | 0.097 | 0.032 | +0.065 | **0.00** |
| MEDIUM | 8 | 0.375 | 0.000 | **+0.375** | 0.56 |
| HIGH | 6 | 0.000 | 0.167 | **−0.167** | 2.14 |
| TRANS | 4 | 0.250 | 0.000 | +0.250 | 4.74 |

LOW behaves well. MEDIUM/TRANS look helpful but sparse. **HIGH fails monotonic calibration.**

Gate histogram (all blocks): LOW 467 · MEDIUM 76 · HIGH 97 · TRANS 60.

---

## Answers (1–42)

1. **Yes** — “D_OVERRIDE is bad” was wrong; parent corrections must be judged by usefulness.  
2. Natal → Daewoon regime → Sewoon inside regime → Y = D_eff + AnnualDev_B (+ gated DxY).  
3. **No** — hierarchy ≠ fixed numeric weight.  
4. **Yes** — Sewoon may cross Daewoon baseline.  
5. Daewoon = earned long-term baseline (gated influence).  
6. Sewoon = frozen B annual-local spine (A_G + B trigger).  
7. D×Y = reinforce/counter interaction (H2); did not change FA pairwise vs H1 under CONS.  
8. PARENT_HELP = local wrong → final correct with parent contribution.  
9. PARENT_HARM = local correct → final wrong.  
10. NET = HELP − HARM.  
11. B: FA 0.6429, net +0.089, same 0.571, cross 0.653.  
12. H1 CONS: FA 0.6429 (tie), same preserved, HIGH-gate net negative → reject.  
13. H2 CONS: same overall as H1 on FA; DxY not decisive.  
14. FA overall: **0.6429** (B / H1CONS / H2CONS).  
15. same-D: **0.5714** preserved.  
16. cross-D: **0.6531** (no gain).  
17. high-regime / high-rdiff: sparse; not a safe promotion signal.  
18. OLD: B 0.5749; gated CONS stays near (no material collapse on selected map).  
19. Parent net by gate: LOW +0.065 · MED +0.375 · HIGH **−0.167** · TRANS +0.250.  
20. HIGH gets larger |corr| (~2.1) but **does not earn** positive net → no.  
21. **Yes** — LOW mean |corr| = 0 on CONS/BAL.  
22–23. No ≥10 adjacent jumps under CONS (max ~8.2); support rate N/A. Independence grouping reduced fake convergence vs Phase 2.5 open amplitude.  
24. Yes — evidence groups collapse related dims.  
25. Yes — natal_context_confidence damps conf_eff.  
26. **Yes** — H2 keeps annual_dev_B; no orthodox year trigger.  
27. Gated DxY: no FA pairwise gain vs H1 CONS.  
28. same-D intact.  
29. cross-D not improved vs B.  
30–31. Crossing exists (down-from-good-D ~10% of years; up-from-hard rare). Allowed.  
32. Daewoon more meaningful under gate (adj p90 4.2) but not promoted.  
33. B still relatively flat; gated CONS partially unflattens.  
34. Not too dominant under CONS.  
35. within-Y / between-D ratio ~1.05–1.09 under H* CONS (B had ~2.0 — years dominate regimes).  
36. Improvement not shown in overall subject hits (still 9/14).  
37. **Winner: V2_DY_B.**  
38. **Yes — numeric D/Y permanently frozen to B for V2.**  
39. Orthodox RegimeChangeEvidence / gates / DxY remain **explanation / audit** tools, not score.  
40. Unproven until Val B: unseen annual generalization of B.  
41. Unproven until user QA: broad-period / decade perception (`USER_RETROSPECTIVE_QA_SPEC.md`).  
42. Before Month/Day: Wolwoon 子/丑 fix + 立春 sewoon alignment (`V2_PHASE_3_FOUNDATION_HANDOFF.md`).

---

## Final status

# `V2_DY_B_FINAL_NUMERIC_FREEZE`

Gating hypothesis tested and rejected for numeric promotion (HIGH-gate net parent negative).  
B remains final V2 Daewoon+Sewoon numeric model.

**STOP.** No Phase 2.7. No Val B. No Month/Day in this run.
