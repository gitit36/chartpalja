# G Fresh Validation A — Layer Attribution

**Diagnostic conclusion:** `MIXED_G_AND_D_FAILURE`
**Measured at:** 2026-08-12T23:13:39

Attribution only. No model revision. Validation B not scored.

Frozen candidate unchanged: `G_CLEAN_AXIS`, α=1.0, κ=0, β=0.25, median centering, S=D+A.

## Layer metrics (same frozen labels)

| material | hit | pairwise | std_sep | raw_sep | AUC macro | AUC micro |
|---|---|---:|---:|---:|---:|---:|
| G | 9/14 (64.29%) | 0.5 | 0.1853 | 0.6194 | 0.5 | 0.5026 |
| A | 9/14 (64.29%) | 0.5357 | 0.2777 | 0.8907 | 0.5357 | 0.5191 |
| D | 5/14 (35.71%) | 0.4464 | -0.3013 | -3.4089 | 0.4464 | 0.4426 |
| S_raw | 7/14 (50.0%) | 0.4286 | -0.2153 | -2.5183 | 0.4286 | 0.486 |
| S_display | 7/14 (50.0%) | 0.4286 | -0.2153 | -2.5183 | 0.4286 | 0.486 |

### Guide reading

- G pairwise = 0.5
- A pairwise = 0.5357
- D pairwise = 0.4464
- S_display pairwise = 0.4286

## Same-Daewoon vs cross-Daewoon pairs

### ALL (n=56)

| material | wins | ties | losses | pairwise |
|---|---:|---:|---:|---:|
| G | 28 | 0 | 28 | 0.5 |
| A | 30 | 0 | 26 | 0.5357 |
| D | 21 | 8 | 27 | 0.4464 |
| S_raw | 24 | 0 | 32 | 0.4286 |
| S_display | 24 | 0 | 32 | 0.4286 |

### SAME_DAEWOON (n=7)

| material | wins | ties | losses | pairwise |
|---|---:|---:|---:|---:|
| G | 3 | 0 | 4 | 0.4286 |
| A | 3 | 0 | 4 | 0.4286 |
| D | 0 | 7 | 0 | 0.5 |
| S_raw | 3 | 0 | 4 | 0.4286 |
| S_display | 3 | 0 | 4 | 0.4286 |

### CROSS_DAEWOON (n=49)

| material | wins | ties | losses | pairwise |
|---|---:|---:|---:|---:|
| G | 25 | 0 | 24 | 0.5102 |
| A | 27 | 0 | 22 | 0.551 |
| D | 21 | 1 | 27 | 0.4388 |
| S_raw | 21 | 0 | 28 | 0.4286 |
| S_display | 21 | 0 | 28 | 0.4286 |

Identity check `S_diff == D_diff + A_diff` failures: **0**

## Failure attribution (`S_display_good ≤ S_display_bad`)

Failed pairs: **32**

Precedence: DISPLAY_FLIP → D_OVERRIDES_A → CENTERING_FLIP → BOTH_WRONG → G_DIRECTION_FAIL → OTHER

| category | count | pct | subjects |
|---|---:|---:|---|
| DISPLAY_FLIP | 0 | 0.0 | — |
| D_OVERRIDES_A | 13 | 40.62 | George Clooney, Marilyn Monroe, Martha Stewart, Meryl Streep, Michael Jordan, Robert Downey Jr., Tiger Woods, Whitney Houston |
| CENTERING_FLIP | 0 | 0.0 | — |
| BOTH_WRONG | 18 | 56.25 | Arnold Schwarzenegger, Bill Gates, Diana, Princess of Wales, George Clooney, Marilyn Monroe, Martha Stewart, Meryl Streep, Robert Downey Jr., Whitney Houston |
| G_DIRECTION_FAIL | 1 | 3.12 | Roger Federer |
| OTHER | 0 | 0.0 | — |

### Exact failed pairs by category

#### D_OVERRIDES_A

- Michael Jordan: good 1991 vs bad 1985 (same_block=False) ΔG=-0.757 ΔA=+0.946 ΔD=-11.000 ΔS=-10.054
- Michael Jordan: good 1996 vs bad 1985 (same_block=False) ΔG=+2.178 ΔA=+3.881 ΔD=-11.000 ΔS=-7.119
- Tiger Woods: good 2000 vs bad 2009 (same_block=False) ΔG=+7.765 ΔA=+6.675 ΔD=-7.000 ΔS=-0.325
- Martha Stewart: good 1999 vs bad 2003 (same_block=False) ΔG=+0.838 ΔA=+0.890 ΔD=-6.000 ΔS=-5.110
- Martha Stewart: good 1999 vs bad 2004 (same_block=False) ΔG=+5.064 ΔA=+5.116 ΔD=-6.000 ΔS=-0.884
- Robert Downey Jr.: good 2008 vs bad 1999 (same_block=False) ΔG=+3.483 ΔA=+4.379 ΔD=-19.000 ΔS=-14.621
- Robert Downey Jr.: good 2024 vs bad 1996 (same_block=False) ΔG=+0.719 ΔA=+0.318 ΔD=-7.000 ΔS=-6.682
- Robert Downey Jr.: good 2024 vs bad 1999 (same_block=False) ΔG=+5.209 ΔA=+4.808 ΔD=-7.000 ΔS=-2.192
- Marilyn Monroe: good 1953 vs bad 1962 (same_block=False) ΔG=-0.504 ΔA=+0.540 ΔD=-20.000 ΔS=-19.460
- Whitney Houston: good 1985 vs bad 2006 (same_block=False) ΔG=-0.668 ΔA=+0.161 ΔD=-24.000 ΔS=-23.839
- George Clooney: good 1994 vs bad 2018 (same_block=False) ΔG=+1.906 ΔA=+2.765 ΔD=-25.000 ΔS=-22.235
- George Clooney: good 2006 vs bad 2018 (same_block=False) ΔG=+1.819 ΔA=+2.817 ΔD=-4.000 ΔS=-1.183
- Meryl Streep: good 2012 vs bad 2001 (same_block=False) ΔG=+1.017 ΔA=+1.793 ΔD=-7.000 ΔS=-5.207

#### BOTH_WRONG

- Bill Gates: good 1986 vs bad 2000 (same_block=False) ΔG=-4.257 ΔA=-5.536 ΔD=-2.000 ΔS=-7.536
- Diana, Princess of Wales: good 1984 vs bad 1992 (same_block=True) ΔG=-1.220 ΔA=-1.220 ΔD=+0.000 ΔS=-1.220
- Arnold Schwarzenegger: good 2003 vs bad 1972 (same_block=False) ΔG=-2.546 ΔA=-2.074 ΔD=-10.000 ΔS=-12.074
- Arnold Schwarzenegger: good 2003 vs bad 2011 (same_block=False) ΔG=-6.241 ΔA=-6.000 ΔD=+0.000 ΔS=-6.000
- Arnold Schwarzenegger: good 2006 vs bad 1972 (same_block=False) ΔG=-3.955 ΔA=-3.723 ΔD=-10.000 ΔS=-13.723
- Arnold Schwarzenegger: good 2006 vs bad 2011 (same_block=True) ΔG=-7.650 ΔA=-7.650 ΔD=+0.000 ΔS=-7.650
- Martha Stewart: good 1997 vs bad 2003 (same_block=False) ΔG=-4.439 ΔA=-4.387 ΔD=-6.000 ΔS=-10.387
- Martha Stewart: good 1997 vs bad 2004 (same_block=False) ΔG=-0.214 ΔA=-0.162 ΔD=-6.000 ΔS=-6.162
- Robert Downey Jr.: good 2008 vs bad 1996 (same_block=False) ΔG=-1.007 ΔA=-0.112 ΔD=-19.000 ΔS=-19.112
- Marilyn Monroe: good 1953 vs bad 1961 (same_block=False) ΔG=-3.236 ΔA=-2.192 ΔD=-20.000 ΔS=-22.192
- Marilyn Monroe: good 1960 vs bad 1961 (same_block=True) ΔG=-1.463 ΔA=-1.463 ΔD=+0.000 ΔS=-1.463
- Whitney Houston: good 1985 vs bad 2012 (same_block=False) ΔG=-2.780 ΔA=-1.951 ΔD=-24.000 ΔS=-25.951
- Whitney Houston: good 1992 vs bad 2006 (same_block=False) ΔG=-2.176 ΔA=-1.348 ΔD=-24.000 ΔS=-25.348
- Whitney Houston: good 1992 vs bad 2012 (same_block=False) ΔG=-4.289 ΔA=-3.460 ΔD=-24.000 ΔS=-27.460
- George Clooney: good 1994 vs bad 1992 (same_block=True) ΔG=-1.001 ΔA=-1.001 ΔD=+0.000 ΔS=-1.001
- Meryl Streep: good 1980 vs bad 2001 (same_block=False) ΔG=-0.512 ΔA=-0.069 ΔD=-28.000 ΔS=-28.069
- Meryl Streep: good 1980 vs bad 2003 (same_block=False) ΔG=-3.845 ΔA=-3.401 ΔD=-28.000 ΔS=-31.401
- Meryl Streep: good 2012 vs bad 2003 (same_block=False) ΔG=-2.316 ΔA=-1.539 ΔD=-7.000 ΔS=-8.539

#### G_DIRECTION_FAIL

- Roger Federer: good 2009 vs bad 2016 (same_block=False) ΔG=-1.149 ΔA=-1.384 ΔD=+1.000 ΔS=-0.384

## Subject-level layer hits

| name | G | A | D | S | pattern | same# | cross# |
|---|:-:|:-:|:-:|:-:|---|---:|---:|
| Bill Gates | ✗ | ✗ | ✓ | ✓ | G=fail / A=fail / D=pass / S=pass | 1 | 3 |
| Britney Spears | ✓ | ✓ | ✓ | ✓ | G=pass / A=pass / D=pass / S=pass | 0 | 4 |
| Johnny Depp | ✓ | ✓ | ✓ | ✓ | G=pass / A=pass / D=pass / S=pass | 0 | 4 |
| Michael Jordan | ✓ | ✓ | ✗ | ✓ | G=pass / A=pass / D=fail / S=pass | 0 | 4 |
| Tiger Woods | ✓ | ✓ | ✗ | ✓ | G=pass / A=pass / D=fail / S=pass | 1 | 3 |
| Roger Federer | ✓ | ✓ | ✓ | ✓ | G=pass / A=pass / D=pass / S=pass | 0 | 4 |
| Diana, Princess of Wales | ✓ | ✓ | ✓ | ✓ | G=pass / A=pass / D=pass / S=pass | 1 | 3 |
| Arnold Schwarzenegger | ✗ | ✗ | ✗ | ✗ | G=fail / A=fail / D=fail / S=fail | 1 | 3 |
| Martha Stewart | ✓ | ✓ | ✗ | ✗ | G=pass / A=pass / D=fail / S=fail | 0 | 4 |
| Robert Downey Jr. | ✓ | ✓ | ✗ | ✗ | G=pass / A=pass / D=fail / S=fail | 0 | 4 |
| Marilyn Monroe | ✗ | ✗ | ✗ | ✗ | G=fail / A=fail / D=fail / S=fail | 2 | 2 |
| Whitney Houston | ✗ | ✗ | ✗ | ✗ | G=fail / A=fail / D=fail / S=fail | 0 | 4 |
| George Clooney | ✓ | ✓ | ✗ | ✗ | G=pass / A=pass / D=fail / S=fail | 1 | 3 |
| Meryl Streep | ✗ | ✗ | ✗ | ✗ | G=fail / A=fail / D=fail / S=fail | 0 | 4 |

## Failed-subject Daewoon boards

### Arnold Schwarzenegger

Good:
- 2003  block 壬寅  D=63.0  G=50.7204  A=-0.8036  S=62.1964
- 2006  block 辛丑  D=63.0  G=49.312  A=-2.4533  S=60.5467
Bad:
- 1972  block 乙巳  D=73.0  G=53.2668  A=+1.2701  S=74.2701
- 2011  block 辛丑  D=63.0  G=56.9618  A=+5.1965  S=68.1965

### Martha Stewart

Good:
- 1997  block 辛丑  D=59.0  G=48.4952  A=-2.5799  S=56.4201
- 1999  block 辛丑  D=59.0  G=53.7727  A=+2.6975  S=61.6975
Bad:
- 2003  block 壬寅  D=65.0  G=52.9343  A=+1.8074  S=66.8074
- 2004  block 壬寅  D=65.0  G=48.7089  A=-2.4181  S=62.5819

### Robert Downey Jr.

Good:
- 2008  block 乙亥  D=34.0  G=48.324  A=-1.3899  S=32.6101
- 2024  block 癸酉  D=46.0  G=50.0499  A=-0.9606  S=45.0394
Bad:
- 1996  block 丙子  D=53.0  G=49.3314  A=-1.2781  S=51.7219
- 1999  block 丙子  D=53.0  G=44.8409  A=-5.7686  S=47.2314

### Marilyn Monroe

Good:
- 1953  block 辛卯  D=39.0  G=52.0775  A=+0.2832  S=39.2832
- 1960  block 庚寅  D=59.0  G=53.8509  A=+1.0125  S=60.0125
Bad:
- 1961  block 庚寅  D=59.0  G=55.3139  A=+2.4754  S=61.4754
- 1962  block 庚寅  D=59.0  G=52.5818  A=-0.2567  S=58.7433

### Whitney Houston

Good:
- 1985  block 壬戌  D=62.0  G=51.6882  A=+0.7543  S=62.7543
- 1992  block 壬戌  D=62.0  G=50.1796  A=-0.7543  S=61.2457
Bad:
- 2006  block 甲子  D=86.0  G=52.3559  A=+0.5933  S=86.5933
- 2012  block 甲子  D=86.0  G=54.4683  A=+2.7057  S=88.7057

### George Clooney

Good:
- 1994  block 己丑  D=46.0  G=51.6703  A=-0.9425  S=45.0575
- 2006  block 戊子  D=67.0  G=51.5836  A=-0.8912  S=66.1088
Bad:
- 1992  block 己丑  D=46.0  G=52.6712  A=+0.0584  S=46.0584
- 2018  block 丁亥  D=71.0  G=49.7644  A=-3.7077  S=67.2923

### Meryl Streep

Good:
- 1980  block 癸酉  D=42.0  G=49.3785  A=-2.018  S=39.982
- 2012  block 丙子  D=63.0  G=50.9073  A=-0.1563  S=62.8437
Bad:
- 2001  block 乙亥  D=70.0  G=49.8908  A=-1.9494  S=68.0506
- 2003  block 乙亥  D=70.0  G=53.2231  A=+1.3829  S=71.3829

## Cross-block magnitude

- |ΔD| cross: {'n': 49, 'p25': 7.0, 'p50': 9.0, 'p75': 16.0, 'p90': 24.0, 'max': 28.0}
- |ΔA| cross: {'n': 49, 'p25': 1.247, 'p50': 2.1922, 'p75': 4.5733, 'p90': 6.8501, 'max': 12.2744}
- |ΔG| cross: {'n': 49, 'p25': 1.1375, 'p50': 2.3971, 'p75': 4.2887, 'p90': 6.5156, 'max': 13.4066}
- |ΔD|/|ΔA| cross: {'n': 49, 'p25': 1.3625, 'p50': 4.5476, 'p75': 11.6246, 'p90': 37.0492, 'max': 408.3776}
- failed cross median ΔD / ΔA: -10.0 / -0.0902
- failed cross median |ΔD| / |ΔA|: 10.0 / 2.1329
- failed pairs: same=4 cross=28

## Centering diagnostic

- sign(G)≠sign(A) all: 4
- same-block: 0
- cross-block: 4
- same-block G vs A ordering must match (shared median); nonzero same-block flips ⇒ implementation bug

## Raw vs display

- display flip count on labeled pairs: **0**
- saturation rate (all years): 0.0
- Conclusion: fresh S failure is **not** caused by display squash/clipping.

## Diagnostic conclusion

`MIXED_G_AND_D_FAILURE`

G=0.5 A=0.5357 D=0.4464 S=0.4286; failed_S=32: BOTH_WRONG=18 D_OVERRIDES_A=13 G_DIRECTION_FAIL=1 CENTERING_FLIP=0; display_flips=0; same_block_pairs=7 cross=49; G-side mass=19 D-side mass=13

No promotion. No model change in this run. Validation B remains sealed.

One-shot Validation A artifacts left immutable:
- `test/snapshots/exp_g_fresh_validation_a.json`
- `test/experiments/G_FRESH_VALIDATION_A_REPORT.md`