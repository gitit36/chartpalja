# V2 DY Orthodox Report (Phase 2.5)

**Status:** `V2_DY_ORTHODOX_EXPLANATION_ONLY`  
**Measured:** see `exp_v2_dy_orthodox.json`  
**Numeric backbone (frozen for scoring):** `V2_DY_B`  
**Orthodox interpretation layer:** `V2_DY_ORTHO_SYSTEM::CONSERVATIVE`  
**O1 best amp:** `BALANCED` · **O2 best amp:** `CONSERVATIVE`

Validation B sealed. Production engine untouched. Month/Day not built. No O3.

---

## Headline

Orthodox O1/O2 restore traditional Natal→D→Y structure and make Daewoon **more distinctive** (adj p90 ~7.5–10.7 vs B’s ~2.4), with some large jumps partially evidence-backed.

They do **not** safely beat V2_DY_B on Fresh A annual pairwise (0.57–0.59 vs **0.6429**). Per freeze rules: keep **B numeric**, ship orthodox as **explanation / regime-evidence layer**.

---

## Q1–3. Calendar / foundation

1. **Consistent for D/Y?** Yes under production-compatible packing. Not `FOUNDATION_ISSUE`.
2. **Other-service disagreements:** civil-year sewoon vs 立春; lon-only solar (no EOT); 半時; 조/야자시 defaults.
3. **School-dependent:** 立春 year, 節-only 起運, 半時, 早/夜子時, EOT. Month 子/丑 bug → Phase 3.

See `V2_CALENDAR_PILLAR_AUDIT.md`.

---

## Q4. What V2_DY_B was missing

Sparse D (4 structure features), no adaptive strength, no D×Y, fixed-sign year triggers, no NatalContext chain, no event≠valence, no 伏吟/反吟/并临, weak 月令/rooting/调候/geju handling in the score path.

---

## Q5–19. How orthodox represents classical structure

| # | Topic | Answer |
|---|-------|--------|
| 5 | NatalContext | From `enrich_saju` / pack `r`: day master, 月支, strength, fav/unfav, geju/special, johu, stems/branches, ohang. No new natal calculator. |
| 6 | 月令 | Efficacy modulator on luck elements (same/generate/control), not a fixed bonus. |
| 7 | 调候 | PARTIAL — usable when `조후용신` element known; else inactive. |
| 8 | 用/喜/忌/相 | Structural activation via fav/unfav + activ/disrupt; **相神 uncertain** (missing in engine). |
| 9 | Hidden/root/透 | Yes — stem rooted in branch hidden stems; fav/unfav hidden exposure. |
| 10 | Ten gods | Contextual by strength regime (weak/strong); not universal 재관+/상겁−. |
| 11 | Domain ≠ valence | `domain_activation` (career/wealth/…) stored separate from directional_effect. |
| 12 | 합충형파해 | Classified vs useful/harmful target pillars; competing 합+충 damped → AMBIGUOUS. |
| 13 | 合化 | Conditional — not assumed; transform only if engine evidence (PARTIAL). |
| 14 | 通关 | PARTIAL — natal tongguan exists; luck mediation light. |
| 15 | 格局 change | PARTIAL — special follow/transform branch; ordinary geju soft. |
| 16 | 从/化 | Separate branch; uncertain → low confidence / mixed. |
| 17 | 墓库 | Not “open treasury = good”; no simplistic warehouse score. |
| 18 | 12운성 | Small contextual vitality only if strength resolves; else interpret. |
| 19 | 空亡/神煞 | 공망 secondary damp; **신살 numeric = 0**. |

---

## Q20–26. D direction / strength / amplitude

| # | Topic | V2_DY_B | O2 CONSERVATIVE (ortho) |
|---|-------|---------|-------------------------|
| 20 | D_DIRECTION | tanh(h_B) implicit | evidence `direction_score` blended with h_B |
| 21 | D_STRENGTH | flat γ=3 | LOW/MED/HIGH/TRANS → amp map |
| 22 | Large justified ΔD? | Almost never | Yes possible (max ~11 FA) |
| 23 | adj ΔD p50/p90/max (FA) | 0.67 / 2.40 / 4.13 | **1.30 / 7.54 / 11.15** |
| 24 | >10 / >20 / >30 | 0 / 0 / 0 | FA: 5 / 0 / 0; p(high\|large)=0.40 |
| 25 | Too flat? | Yes (product concern) | Improved distinctiveness |
| 26 | Too volatile? | No | No >20 jumps; O1 BALANCED more volatile (p90~10.7) |

**B understates regime change.** Orthodox allows MEDIUM–HIGH moves when families converge; TRANS map exists but did not produce >20 jumps under CONSERVATIVE.

Jump validity is only partial (40–56% of >10 jumps are HIGH/TRANS) — remaining weakness.

---

## Q27–32. Parent value & stratified annual

### Fresh A

| Metric | B | O1 BAL | O2 CONS |
|--------|---:|---:|---:|
| pairwise | **0.6429** | 0.5714 | 0.5893 |
| hit | 9/14 | 8/14 | 8/14 |
| D_OVERRIDE | **0.0179** | 0.0714 | 0.0714 |
| D_RESCUE | 0.1071 | 0.1071 | 0.1071 |
| NET_PARENT | **0.0893** | 0.0357 | 0.0357 |
| same-D pw | 0.5714 | 0.4286 | 0.4286 |
| cross-D pw | **0.6531** | 0.5918 | 0.6122 |
| high-regime cross | 0.70 | **0.80** | **0.80** |

### OLD_DEV

| Metric | B | O1 | O2 |
|--------|---:|---:|---:|
| pairwise | **0.5749** | 0.5632 | 0.5677 |
| hit | 40/56 | 38/56 | 38/56 |
| NET_PARENT | −0.0083 | −0.022 | −0.013 |

27–28: Orthodoxy **rescues at similar rate** but **overrides more** → net parent worse than B on FA.  
29: B net **+0.089** vs ortho **+0.036**.  
30–31: B stronger on same-D and overall cross-D.  
32: High-regime cross **0.80** for ortho (promising) but sparse / not enough to offset overall FA drop.

---

## Q33–36. Sewoon / double-count

33. **D×Y:** reinforce via year vs D elemental sign + pillar relations; soft-clipped.  
34. **Event intensity ≠ valence:** yes (intensity from clashes/repetition; valence from contextual roles).  
35. **伏吟/反吟/并临:** yes (natal↔Y, natal↔D, D=Y, stem+branch clash pair).  
36. **Double-count:** G kept once; fixed-sign ilju removed in O*; contextual relations RELATED_BUT_DIFFERENT_TIMESCALE vs G. See attribution matrix. Residual risk PARTIAL.

Ablation (O2 FA): `no_contextual_trigger` → pw **0.6071** (helps); `no_dy` → **0.5536** (hurts); `g_only` → 0.5893. Contextual trigger currently noisy; D×Y helpful but not enough to beat B.

---

## Q37–40. Reference vs O1/O2 / winner

37. **O1 vs B:** richer D, worse FA (−0.07), higher override.  
38. **O2 vs B:** best orthodox FA (0.5893), still −0.05 vs B; better high-regime cross.  
39. **Wins numeric:** **V2_DY_B**. **Wins structure/explanation:** O2 CONSERVATIVE.  
40. **Gain distributed?** High-regime subset yes; overall subject hit not (8/14 vs 9/14).

---

## Q41–46. Product decisions

41. Traditional completeness **materially improves explanation** (RegimeChangeEvidence, roles, intensity).  
42. New context → **interpretation-only for V2 numeric**; do not replace B score yet.  
43. School-dependent remains: calendar items above; 合化 schools; 삼회 labeling.  
44. Backlog: 相神, deeper 通关/合化, jump-validity ≥80%, quieter contextual triggers, Month 子丑 fix, G redesign (not this phase).  
45. **Permanent D/Y numeric freeze = V2_DY_B.** Orthodox layer frozen as explanation schema, not score.  
46. **Month/Day contract:** yes — proceed next with B numeric + optional orthodox annotations.

---

## Metrics table (primary)

| label | FA pw | FA hit | OLD pw | OLD hit | FA ov | FA rescue | FA net | adj p50 | adj p90 | adj max |
|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|
| V2_DY_B | 0.6429 | 9/14 | 0.5749 | 40/56 | 0.0179 | 0.1071 | 0.0893 | 0.67 | 2.40 | 4.13 |
| O1::BALANCED | 0.5714 | 8/14 | 0.5632 | 38/56 | 0.0714 | 0.1071 | 0.0357 | 1.99 | 10.74 | 16.17 |
| O2::CONSERVATIVE | 0.5893 | 8/14 | 0.5677 | 38/56 | 0.0714 | 0.1071 | 0.0357 | 1.30 | 7.54 | 11.15 |

---

## Classical checklist (D/Y)

See `classical_checklist` in snapshot — summary: CORE items mostly YES/PARTIAL; 相神 NO; 神煞 excluded from numeric; no blind fixed signs.

---

## Final status

# `V2_DY_ORTHODOX_EXPLANATION_ONLY`

Keep `V2_DY_B` as numeric D/Y.  
Keep `V2_DY_ORTHO_SYSTEM` (CONSERVATIVE amp) as structured explanation / regime evidence.  
Known limitation: B understates Daewoon amplitude.

**STOP.** Do not build Month/Day. Do not open Validation B. Do not invent O3.
