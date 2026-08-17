# V2 Month / Day Classical Contract

**Date:** 2026-08-13  
**Status:** Contract only — **do not implement Month/Day in Phase 2.5**

Daily fortune is less standardized as a long-horizon Ziping scoring layer than Daewoon/Sewoon. Product logic must stay conservative and hierarchical.

---

## Month (Phase 3)

Must audit/use:

1. Solar-term month boundary (fix `build_wolwoon` 子/丑 bug first — see calendar audit H)
2. Month stem + branch
3. Hidden stems where relevant
4. NatalContext (frozen from D/Y)
5. Current DaewoonContext
6. Current SewoonContext
7. Month ↔ natal relations (target pillars)
8. Month ↔ Daewoon
9. Month ↔ Sewoon (primary timing axis)
10. Ten-god **domain** activation
11. Contextual **valence** (no fixed 합+/충−)
12. Event intensity ≠ valence
13. Local centering: median MonthDev within year ≈ 0
14. Amplitude < annual deviation
15. Not an independent mini-life-score

Composition concept:

```
M_raw = Y + MonthlyDeviation_ym + small annual-theme timing modifier
```

---

## Day (Phase 4)

Must audit/use:

1. Correct sexagenary day
2. Timezone / day-boundary policy (civil midnight vs 子時 — document choice)
3. Day stem + branch
4. NatalContext
5. Active D + Y + M context
6. Day ↔ natal day/month pillars
7. Day ↔ month (primary)
8. Day ↔ Sewoon
9. Day ↔ Daewoon only if non-redundant
10. Local relation triggers
11. Repetition / resonance
12. Event intensity
13. Smallest local amplitude; most days near monthly baseline
14. No deterministic catastrophe claims

Composition concept:

```
Day_raw = M + DailyDeviation_ymd
```

---

## Shared prohibitions

- No reopening D/Y feature discovery during Month/Day
- No Validation B until all layers frozen
- No shinsal numeric core
- No universal ten-god valence tables
- Max 3 architecture candidates per layer
