# V2 Day Attribution

**Winner:** `D1_CONSERVATIVE` · **Status:** `V2_DAY_TIMING_ONLY`

## Feature duplication audit

| feature | class | note |
|---|---|---|
| day_month_relations_contextual | NEW_DAY_INFORMATION | PRIMARY Day↔Wolwoon timing |
| day_yongshin_fit_net | RELATED_BUT_DIFFERENT_TIMESCALE | Day pillar fit; not Month M1 month_yongshin_fit |
| day_fav_unfav_supply | RELATED_BUT_DIFFERENT_TIMESCALE | Day-pillar element supply |
| day_natal_relations_contextual | NEW_DAY_INFORMATION | Day↔natal; Month↔natal already in M — different pillar/timescale |
| day_sewoon_relations_contextual | RELATED_BUT_DIFFERENT_TIMESCALE | D2 only when nonredundant vs Day↔Month |
| day_daewoon_relations | DUPLICATE | Excluded from DailyDev (not proven independent) |
| event_intensity | NEW_DAY_INFORMATION | Explanation-only — not in DailyDev valence |
| M1 month features / G / B_trigger / D struct | ALREADY_IN_MONTH/YEAR | Excluded from DailyDev |
| legacy build_daily_fortune 종합 | DUPLICATE | Reference only |

## Trace samples

### Donald Trump — positive — Ivana Trump와 결혼
- date: 1977-04-07 · day: 甲午 · M_parent: 61.506108000000005
- DailyDev → DayScore: 0.05898750000000001 → 61.565095500000005
- raw / median: -0.06600000000000003 / -0.17325000000000004
- valence: {'fit_net': -0.65, 'supply': 1.0, 'month_rel': 0.0, 'natal_rel': -0.37500000000000006, 'sw_rel': 0.0}
- intensity (explanation-only): 1.5
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 
- Day↔Natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['반합(火반합:午戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지형(자형:午刑午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간합(甲己)', '천간정극(甲克己)', '지지합(午未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간합(甲己)', '천간정극(甲克己)']}
- Day↔Sewoon: N/A (D1)

### Donald Trump — positive — Trump Tower 오픈
- date: 1983-11-30 · day: 壬戌 · M_parent: 68.5536098497066
- DailyDev → DayScore: -0.06105 → 68.49255984970661
- raw / median: -0.32425 / -0.21325
- valence: {'fit_net': -0.44999999999999996, 'supply': 0.0, 'month_rel': 0.0, 'natal_rel': -1.0, 'sw_rel': 0.0}
- intensity (explanation-only): 3.8
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 
- Day↔Natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['천간충(壬↯丙)', '천간편극(壬克丙)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['반합(火반합:戌午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지파(戌×未)', '지지형(지세지형:戌刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['원진(戌↔巳)']}
- Day↔Sewoon: N/A (D1)

### Donald Trump — positive — The Art of the Deal 출간
- date: 1987-11-01 · day: 甲寅 · M_parent: 64.7854729122066
- DailyDev → DayScore: 0.16383125 → 64.9493041622066
- raw / median: 0.1115 / -0.186375
- valence: {'fit_net': 0.35, 'supply': 1.0, 'month_rel': 0.0, 'natal_rel': -0.325, 'sw_rel': 0.0}
- intensity (explanation-only): 3.8
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 천간충(甲↯庚) 반합(火반합:寅戌)
- Day↔Natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['반합(火반합:寅戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['반합(火반합:寅午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간합(甲己)', '천간정극(甲克己)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간합(甲己)', '천간정극(甲克己)', '지지해(寅↦巳)', '지지형(무은지형:寅刑巳)']}
- Day↔Sewoon: N/A (D1)

### Donald Trump — positive — The Apprentice 첫 방송
- date: 2004-01-08 · day: 丙戌 · M_parent: 60.91927675
- DailyDev → DayScore: -0.42411875000000004 → 60.495158
- raw / median: -0.8410000000000001 / -0.069875
- valence: {'fit_net': -1.1500000000000001, 'supply': -1.0, 'month_rel': -0.55, 'natal_rel': -1.0750000000000002, 'sw_rel': 0.0}
- intensity (explanation-only): 2.3
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 지지형(지세지형:戌刑丑)
- Day↔Natal: {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['반합(火반합:戌午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지파(戌×未)', '지지형(지세지형:戌刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['원진(戌↔巳)']}
- Day↔Sewoon: N/A (D1)

### Donald Trump — positive — Melania Trump와 결혼
- date: 2005-01-22 · day: 丙午 · M_parent: 62.588279500000006
- DailyDev → DayScore: -0.2893000000000001 → 62.29897950000001
- raw / median: -0.5920000000000001 / -0.06599999999999998
- valence: {'fit_net': -1.3, 'supply': 0.0, 'month_rel': -0.45, 'natal_rel': -0.7000000000000001, 'sw_rel': 0.0}
- intensity (explanation-only): 2.3
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 지지해(午↦丑) 원진(午↔丑)
- Day↔Natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['반합(火반합:午戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지형(자형:午刑午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지합(午未)']}
- Day↔Sewoon: N/A (D1)

### Donald Trump — positive — 미국 대통령 당선
- date: 2016-11-08 · day: 甲午 · M_parent: 64.00342475
- DailyDev → DayScore: 0.35303125 → 64.356456
- raw / median: 0.384 / -0.257875
- valence: {'fit_net': -0.65, 'supply': 1.0, 'month_rel': 1.0, 'natal_rel': -0.37500000000000006, 'sw_rel': 0.0}
- intensity (explanation-only): 1.5
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 천간합(甲己) 천간정극(甲克己)
- Day↔Natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['반합(火반합:午戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지형(자형:午刑午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간합(甲己)', '천간정극(甲克己)', '지지합(午未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간합(甲己)', '천간정극(甲克己)']}
- Day↔Sewoon: N/A (D1)

### Lionel Messi — negative — 세금사기 유죄 판결
- date: 2016-07-06 · day: 己丑 · M_parent: 62.6890239002934
- DailyDev → DayScore: -0.23168750000000002 → 62.4573364002934
- raw / median: -0.494 / -0.07274999999999998
- valence: {'fit_net': -0.35, 'supply': -1.0, 'month_rel': -0.35, 'natal_rel': -0.575, 'sw_rel': 0.0}
- intensity (explanation-only): 2.1
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 천간합(己甲) 지지해(丑↦午) 원진(丑↔午)
- Day↔Natal: {'with': '월주(丙午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지해(丑↦午)', '원진(丑↔午)']} {'with': '일주(甲辰)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간합(己甲)', '지지파(丑×辰)']} {'with': '시주(癸酉)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간편극(己克癸)', '반합(金반합:丑酉)']}
- Day↔Sewoon: N/A (D1)

### Lionel Messi — negative — Barcelona 이적 요청 공개
- date: 2020-08-25 · day: 庚子 · M_parent: 64.9553040877934
- DailyDev → DayScore: 0.06985000000000001 → 65.0251540877934
- raw / median: 0.10775000000000001 / -0.019250000000000003
- valence: {'fit_net': 1.35, 'supply': 1.0, 'month_rel': 0.0, 'natal_rel': -1.0, 'sw_rel': 0.0}
- intensity (explanation-only): 3.8
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 천간충(庚↯甲) 천간편극(庚克甲) 반합(水반합:子申)
- Day↔Natal: {'with': '연주(丁卯)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지형(무례지형:子刑卯)']} {'with': '월주(丙午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지충(子↯午)']} {'with': '일주(甲辰)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간충(庚↯甲)', '천간편극(庚克甲)', '반합(水반합:子辰)']} {'with': '시주(癸酉)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['지지파(子×酉)']}
- Day↔Sewoon: N/A (D1)

### Lionel Messi — negative — Barcelona 결별·PSG 이적
- date: 2021-08-05 · day: 乙酉 · M_parent: 63.62075190029339
- DailyDev → DayScore: 0.16176875 → 63.78252065029339
- raw / median: 0.16249999999999998 / -0.131625
- valence: {'fit_net': 1.0, 'supply': 1.0, 'month_rel': 0.0, 'natal_rel': -0.55, 'sw_rel': 0.0}
- intensity (explanation-only): 3.0
- NUMERIC: ['month_rel', 'fit_net', 'supply', 'natal_rel', 'sw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- Day↔Month: 
- Day↔Natal: {'with': '연주(丁卯)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지충(酉↯卯)']} {'with': '일주(甲辰)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지합(酉辰)']} {'with': '시주(癸酉)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['지지형(자형:酉刑酉)']}
- Day↔Sewoon: N/A (D1)
