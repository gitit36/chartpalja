# V2 DY Final Freeze Manifest

**Status:** `V2_DY_CLOSED_READY_FOR_CALENDAR`
**Date:** 2026-08-13T02:27:13

## Numeric model

**V2_DY_B**

```
D_B = clamp(60 + 3 · h_B)
  h_B = 0.45 z(fav_minus_unfav) + 0.35 z(struct_activ)
      − 0.35 z(struct_disrupt) − 0.15 z(struct_excess)
  z = robust z-score, clip ±2.5, scale floor 0.35

A_G = G_CLEAN_AXIS(year) − median_G(same Daewoon block)
B_trigger = 1.2 hap − 1.5 chung − 1.0 hyung − 0.8 pa_hae + 0.4 tg_career
annual_dev_B = 0.65 · A_G + 0.35 · B_trigger
Y = clamp(D_B + annual_dev_B)
```

## Frozen

- G_CLEAN_AXIS (experiment_g_clean.py)
- D architecture / coefficients / z hygiene (experiment_v2_dy.py)
- annual trigger + 0.65/0.35 mix
- B9 α=1.0 centering philosophy for A within block (median)
- Development: OLD_DEV (yongshin_subjects usable) + Fresh A eligible
- Validation B: **SEALED**
- Production `saju_engine.py`: **untouched by V2 DY freeze**

## Explanation-only (not in Y)

- NatalContext
- RegimeChangeEvidence / gates / continuous direction·confidence
- Orthodox ten-god / relation contextual roles
- D×Y interaction
- event_intensity (≠ valence)
- 12운성 contextual notes
- other orthodox annotations from Phase 2.5

## Known limitations

- B likely understates Daewoon amplitude (adj p90 ~2.4)
- Orthodox numeric amplification failed promotion (2.6 / 2.7)
- Some classical items PARTIAL/uncertain (相神, 合化, 通关 depth)
- Broad-period perceived accuracy unvalidated until blind user QA
- Calendar: Wolwoon 子/丑 bug + civil vs 立春 sewoon — next foundation patch

## Repro hashes (sha256[:16])

- `experiment_v2_dy.py`: `d2c0199c5194dd63`
- `experiment_g_clean.py`: `5537990671fd8bdb`
- `experiment_v2_dy_27_eval.py`: `11fa84bf7f4f1c74`
- `experiment_v2_dy_orthodox.py`: `8db818ad59ed5109`
- `g_fresh_labels_frozen.json`: `1b9fc0de41e6c6b3`
- `exp_v2_dy.json`: `a45cca5a56a13bdb`
- `exp_v2_dy_27_eval.json`: `2c4d1a411ab49c94`

## Development headline (frozen reference)

- Fresh A pairwise **0.6429** (9/14)
- OLD_DEV pairwise **0.5749** (40/56)
- same-D FA **0.5714** · cross-D FA **0.6531**

No Phase 2.8. Next: calendar → Month → Day.


## Calendar foundation policy note (appended)

**Status:** `V2_CALENDAR_READY_FOR_MONTH`  
**Date:** 2026-08-13T02:35:12

- Live Sewoon boundary = **立春 → next 立春** (`LIVE_ACTIVE_SEWOON` / `live_active_sewoon`)
- Month boundary = **solar 節** (`build_wolwoon` fixed 子/丑)
- Historical D/Y validation remains **civil-year** (`HISTORICAL_EXPERIMENT_YEAR` / `build_yearly_timeline`) for frozen reproducibility
- Day boundary policy deferred to Phase 4
- EOT / 子時 / 半時 policies **unchanged**
- Frozen V2_DY_B formula and experiment hashes above are **not** rewritten by this patch
