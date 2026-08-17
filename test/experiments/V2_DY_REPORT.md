# V2 Daewoon + Sewoon Report

**Status:** `V2_DY_READY_TO_FREEZE`
**Selected:** `V2_DY_B`
**Measured at:** 2026-08-13T00:33:38

Phase 1+2 only. Month/Day not implemented. Validation B sealed. Engine untouched.

## 1. What was wrong with the old temporal architecture?

- Daewoon and Sewoon shared `_composite_score` (same DNA + SCORE_BIAS).
- Production year ≈ 0.6·D + 0.4·SW; B9 then did S=D+A with A from related breakdown → D amplitude (~4–5× A) mass-overrode annual direction.
- Encoded scalars (yongshin_fit, unseong, …) failed as block material; failure is encoding, not a license to invert theory.

## 2. How V2 separates Daewoon vs Sewoon

- **D:** contextual / structural regime from separated fav·unfav activation + structural subparts (+ limited relation flags in A only).
- **Y:** parent D + centered `G_CLEAN_AXIS` annual deviation + explicit year triggers (합/충/형/파해, ten-god nudge) + optional small D×Y context (A only).
- Engine `종합운점수` is **not** the V2 D input.
- Amplitude hygiene: robust-z floor + winsorize ±2.5 (calibration inside the 3 families).

## 3. Three tested architectures

### V2_DY_A
- D families: ['fav_act', 'unfav_act', 'struct_net', 'has_samhap', 'has_day_chung', 'has_hap'] (γ≈5.0)
- Y families: ['G_CLEAN_AXIS centered A', 'ilju trigger', 'ten-god career nudge', 'D×Y context']
- amp calibration: z_clip=±2.5, scale_floor=0.35

### V2_DY_B
- D families: ['fav_minus_unfav', 'struct_activ', 'struct_disrupt', 'struct_excess'] (γ≈3.0)
- Y families: ['G_CLEAN_AXIS A (0.65)', 'ilju/ten-god trigger (0.35)']
- amp calibration: z_clip=±2.5, scale_floor=0.35, gamma 4→3

### V2_DY_C
- D families: ['fav_minus_unfav', 'struct_net'] (γ≈2.0)
- Y families: ['G_CLEAN_AXIS A', 'small trigger']
- amp calibration: z_clip=±2.5, scale_floor=0.35

## 4. Which one wins?

**Winner:** `V2_DY_B`
**Ranking:** ['V2_DY_B', 'V2_DY_A', 'V2_DY_C']

## 5–6. OLD_DEV and Fresh A annual metrics

| arch | OLD hit | OLD pw | OLD std | FA hit | FA pw | FA std | FA override | cross |ΔD|/|ΔA| p50 | adj|ΔD| p50 | adj|ΔD| p90 |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| LEGACY_B9 | 34/56 | 0.5318 | 0.0134 | 7/14 | 0.4286 | -0.2186 | 0.2321 | 4.5476 | 7.0 | 21.5 |
| V2_DY_A | 35/56 | 0.5661 | 0.1929 | 9/14 | 0.6071 | 0.2872 | 0.0357 | 0.6984 | 2.1306 | 5.4097 |
| V2_DY_B | 40/56 | 0.5749 | 0.2334 | 9/14 | 0.6429 | 0.38 | 0.0179 | 0.4418 | 0.6664 | 2.3978 |
| V2_DY_C | 41/56 | 0.5802 | 0.2651 | 9/14 | 0.5714 | 0.3463 | 0.0179 | 0.1441 | 0.349 | 1.8966 |

### Fresh A subjects (winner)

| name | hit | sep | pairwise |
|---|:-:|---:|---:|
| Bill Gates | 0 | -2.6101 | 0.5 |
| Britney Spears | 0 | -0.0401 | 0.5 |
| Johnny Depp | 1 | 3.5704 | 1.0 |
| Michael Jordan | 1 | 2.5799 | 1.0 |
| Tiger Woods | 1 | 7.3208 | 1.0 |
| Roger Federer | 1 | 2.9703 | 1.0 |
| Diana, Princess of Wales | 1 | 0.3142 | 0.5 |
| Arnold Schwarzenegger | 0 | -3.7908 | 0.0 |
| Martha Stewart | 1 | 1.068 | 0.75 |
| Robert Downey Jr. | 1 | 0.9221 | 0.5 |
| Marilyn Monroe | 0 | -0.16 | 0.5 |
| Whitney Houston | 1 | 0.4687 | 0.75 |
| George Clooney | 1 | 1.4672 | 0.75 |
| Meryl Streep | 0 | -0.7348 | 0.25 |

## 7–10. Does D override A? Amplitude? Extreme jumps?

- **7. Override:** FA D_OVERRIDE_rate=0.0179 (legacy 0.2321); OLD=0.0536
- **8. Typical D amplitude:** adj|ΔD| p50/p90 = 0.6664/2.3978 (FA); OLD 0.9106/2.8179
- **9. Typical annual |dev|:** p50/p90 = 1.35/3.6623
- **10. Extreme jumps:** soft gate adj_p90 ≤ 18.0; winner FA adj_p90=2.3978 (legacy 21.5)
- Cross-daewoon |ΔD|/|ΔA| p50 (FA)=0.4418 (legacy 4.5476)

## 11–12. Feature dominance / double-count

- Winner D families: ['fav_minus_unfav', 'struct_activ', 'struct_disrupt', 'struct_excess']
- Winner Y families: ['G_CLEAN_AXIS A (0.65)', 'ilju/ten-god trigger (0.35)']
- D uses separated activation/structure (not enc_* scalars).
- Y still uses `G_CLEAN_AXIS` (known thematic overlap with classical families) + explicit ilju/ten-god triggers.
- Residual double-theme risk: 용신/관계 concepts appear in G and lightly in D fav/unfav — accepted at different timescales; no final-G pattern restack.

## 13–14. Weaknesses / backlog

- Annual signal still modest on OLD_DEV; FA n=14 is small.
- Block-target construct imperfect (backlog) — not reopened.
- G_CLEAN_AXIS not redesigned this phase.
- Sparse D features can still produce plateaus (adj p50 near 0) even after z-clip.
- Month/Day not built yet.
- See `V2_RND_BACKLOG.md`.

## 15. Freeze readiness — proceed to Month/Day?

**`V2_DY_READY_TO_FREEZE`**

Yes — D/Y frozen enough to proceed to Month/Day in the **next** explicit phase.
Do **not** invent more DY candidates. Do **not** open Validation B.
