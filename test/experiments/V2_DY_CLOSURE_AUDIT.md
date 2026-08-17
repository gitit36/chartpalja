# V2 DY Closure Audit

**Status:** `V2_DY_CLOSED_READY_FOR_CALENDAR`
**Measured:** 2026-08-13T02:27:13

## 1. Attribution bug fix

- Removed accidental `or True` in D vs D×Y harm attribution.
- Re-ran 2.7A: headline scores **unchanged**; B still winner; SKIP_27B.
- Headline: B FA=0.6429 OLD=0.5749; H1 marg FA=0.0 OLD=-0.0165.
- H2 OLD attr_counts after fix: `{'UNCHANGED': 1331, 'D_ONLY_HARM': 30, 'D_AND_DXY_HELP': 30, 'D_ONLY_HELP': 13, 'D_AND_DXY_HARM': 30, 'MIXED_EFFECT': 16, 'DXY_ONLY_HELP': 2, 'DXY_ONLY_HARM': 2}`

## 2. Parent attribution

Primary local remains `annual_dev_B = 0.65*A + 0.35*B_trigger` (confirmed in 2.7A re-run).

## 3. Score ↔ orthodox consistency

### Year (Sewoon) layer
- n=7000
- rates={'MIXED_BUT_ACCEPTABLE': 0.5453, 'CONSISTENT_POSITIVE': 0.1554, 'CONSISTENT_NEUTRAL': 0.2764, 'STRONG_DIRECTION_CONTRADICTION': 0.0146, 'CONSISTENT_NEGATIVE': 0.0083}
- strong contradiction rate=0.0146
- high-conf contradiction rate=0.0146
- subjects with ≥1 strong=44

### Daewoon layer
- n=700
- rates={'CONSISTENT_POSITIVE': 0.1329, 'CONSISTENT_NEUTRAL': 0.3471, 'MIXED_BUT_ACCEPTABLE': 0.52}
- strong contradiction rate=0.0

### Strongest year contradictions (examples)

- 윤석열 2054 丁酉: Y=50.6601 D_B=60.9106 ortho_dir=0.3946 conf=0.765 inten=2.6175
- Michael Jackson 1979 壬戌: Y=51.6718 D_B=60.9106 ortho_dir=0.4254 conf=0.765 inten=1.5975
- 신해철 2032 癸亥: Y=51.5794 D_B=60.9106 ortho_dir=0.4165 conf=0.765 inten=1.6975
- 정몽헌 1969 癸亥: Y=52.1566 D_B=60.9106 ortho_dir=0.4429 conf=0.765 inten=1.63
- Hillary Clinton 2037 己未: Y=53.8884 D_B=60.9106 ortho_dir=0.5175 conf=0.765 inten=1.6075
- Roger Federer 2007 癸巳: Y=53.7527 D_B=62.4106 ortho_dir=0.4666 conf=0.765 inten=2.425
- 정주영 1974 辛巳: Y=53.1195 D_B=60.9106 ortho_dir=0.4235 conf=0.765 inten=2.7425
- Marilyn Monroe 1927 壬辰: Y=54.3884 D_B=60.9106 ortho_dir=0.4669 conf=0.765 inten=1.64
- Hillary Clinton 2040 己未: Y=54.9443 D_B=60.9106 ortho_dir=0.5175 conf=0.765 inten=1.6075
- 김희민 2018 丁丑: Y=55.1064 D_B=62.1706 ortho_dir=0.5093 conf=0.765 inten=2.2025
- Hillary Clinton 1962 壬子: Y=53.1301 D_B=60.9106 ortho_dir=0.3626 conf=0.765 inten=1.3525
- 정몽구 2021 癸亥: Y=55.3396 D_B=60.9106 ortho_dir=0.5822 conf=0.693 inten=1.525
- Hillary Clinton 2022 戊午: Y=55.8448 D_B=63.5356 ortho_dir=0.5558 conf=0.765 inten=1.68
- 문재인 1971 乙卯: Y=54.1077 D_B=60.9106 ortho_dir=0.3812 conf=0.765 inten=2.3625
- Diana Ross 2041 丁巳: Y=63.7744 D_B=59.0894 ortho_dir=-0.6557 conf=0.693 inten=2.3175
- Hillary Clinton 1977 癸丑: Y=54.5565 D_B=60.9106 ortho_dir=0.4031 conf=0.765 inten=3.2125
- Michael Jackson 1980 壬戌: Y=54.8647 D_B=60.9106 ortho_dir=0.4254 conf=0.765 inten=1.5975
- John Ritter 2034 己巳: Y=54.9299 D_B=60.9106 ortho_dir=0.4733 conf=0.693 inten=0.805
- Marilyn Monroe 1939 壬辰: Y=55.3527 D_B=60.9106 ortho_dir=0.4669 conf=0.765 inten=1.64
- 정주영 1984 庚辰: Y=56.0446 D_B=63.5356 ortho_dir=0.5377 conf=0.765 inten=1.595

## 4. Explanation wiring rules (enforced in product copy)

- Never claim ortho-only factors moved the numeric score.
- Ortho wording: contextual / structural / event-regime evidence.
- On conflict: acknowledge mixed signals; no fabricated certainty.
- VALENCE ≠ EVENT_INTENSITY.

## 5. Product behavior

- subjects=70
- frac D_range<1 (known B flatness)=0.0143
- frac Y_range≥3=1.0
- subjects with good-year-in-hard-D crossings=0
- subjects with hard-year-in-good-D crossings=70
- saturation pathology=False

## 6. Semantics

- `Y = clamp(D_B + annual_dev_B)`
- annual: `0.65*A_G + 0.35*B_trigger`
- Sewoon may cross Daewoon baseline; no 70/30.
- D×Y explanation-only.

**Block reasons:** []

**Final:** `V2_DY_CLOSED_READY_FOR_CALENDAR`

STOP — next is calendar foundation only.
