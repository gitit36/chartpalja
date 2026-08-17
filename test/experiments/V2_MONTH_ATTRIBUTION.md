# V2 Month Attribution

**Winner:** `M1_CONSERVATIVE` · **Status:** `V2_MONTH_TIMING_ONLY`

## Feature duplication audit

| feature | class | note |
|---|---|---|
| month_yongshin_fit_net | NEW_MONTH_INFORMATION | Month-pillar yongshin fit; not G_CLEAN_AXIS year breakdown |
| month_fav_unfav_supply | RELATED_BUT_DIFFERENT_TIMESCALE | Same fav/unfav concept as D, applied to month pillar |
| month_natal_relations_contextual | NEW_MONTH_INFORMATION | Month↔natal timing; valence contextualized by fit — not fixed 합+/충− |
| month_sewoon_relations_contextual | NEW_MONTH_INFORMATION | PRIMARY short-term axis Month↔Sewoon |
| month_daewoon_relations_contextual | RELATED_BUT_DIFFERENT_TIMESCALE | M2 only; excluded when redundant with Y_parent/Sewoon flags |
| event_intensity | NEW_MONTH_INFORMATION | Explanation/diagnostic only — NOT added into MonthlyDev valence |
| G_CLEAN_AXIS | ALREADY_IN_Y | Excluded from MonthlyDev |
| B_trigger | ALREADY_IN_Y | Excluded from MonthlyDev |
| legacy_month_종합 | DUPLICATE | Reference only — not in M1/M2 |

## Trace samples (NUMERIC vs EXPLANATION)

### Donald Trump — positive — Ivana Trump와 결혼
- at: 1977-04-07T12:00:00+09:00
- Y_parent: 61.230576750000004
- month: 甲辰
- MonthlyDev → M: 0.27553125 → 61.506108000000005
- raw / center: 0.154875 / -0.02881249999999999
- valence evidence: {'fit_net': 0.3500000000000001, 'supply': 0.0, 'natal_rel': 0.35, 'sw_rel': 0.0, 'dw_rel': 0.0}
- event_intensity (explanation-only): 2.0
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지충(辰↯戌)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간합(甲己)', '천간정극(甲克己)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간합(甲己)', '천간정극(甲克己)']}
- sewoon: 
- daewoon: N/A (M1)

### Donald Trump — positive — Trump Tower 오픈
- at: 1983-11-30T12:00:00+09:00
- Y_parent: 67.7477348497066
- month: 癸亥
- MonthlyDev → M: 0.805875 → 68.5536098497066
- raw / center: 0.20775 / -0.3295
- valence evidence: {'fit_net': 1.3, 'supply': 1.0, 'natal_rel': 0.0, 'sw_rel': -0.5, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.0
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['천간정극(癸克丙)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['반합(木반합:亥未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['지지충(亥↯巳)']}
- sewoon: 지지형(자형:亥刑亥)
- daewoon: N/A (M1)

### Donald Trump — positive — The Art of the Deal 출간
- at: 1987-11-01T12:00:00+09:00
- Y_parent: 64.9161604122066
- month: 庚戌
- MonthlyDev → M: -0.1306875 → 64.7854729122066
- raw / center: -0.17937500000000003 / -0.09225000000000003
- valence evidence: {'fit_net': -0.75, 'supply': 0.0, 'natal_rel': -1.1, 'sw_rel': 0.6, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['천간충(庚↯甲)', '천간편극(庚克甲)', '반합(火반합:戌午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지파(戌×未)', '지지형(지세지형:戌刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['원진(戌↔巳)']}
- sewoon: 지지합(戌卯)
- daewoon: N/A (M1)

### Donald Trump — positive — The Apprentice 첫 방송
- at: 2004-01-08T12:00:00+09:00
- Y_parent: 61.694401750000004
- month: 乙丑
- MonthlyDev → M: -0.7751250000000001 → 60.91927675
- raw / center: -0.7928750000000001 / -0.27612500000000006
- valence evidence: {'fit_net': 0.050000000000000044, 'supply': 0.0, 'natal_rel': -1.4500000000000002, 'sw_rel': -1.1, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지형(지세지형:丑刑戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지해(丑↦午)', '원진(丑↔午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간편극(乙克己)', '지지충(丑↯未)', '지지형(지세지형:丑刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간편극(乙克己)', '반합(金반합:丑巳)']}
- sewoon: 지지충(丑↯未) 지지형(지세지형:丑刑未)
- daewoon: N/A (M1)

### Donald Trump — positive — Melania Trump와 결혼
- at: 2005-01-22T12:00:00+09:00
- Y_parent: 62.916123250000005
- month: 丁丑
- MonthlyDev → M: -0.32784375 → 62.588279500000006
- raw / center: -0.470125 / -0.2515625
- valence evidence: {'fit_net': -0.6499999999999999, 'supply': -1.0, 'natal_rel': -0.7500000000000001, 'sw_rel': 0.0, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지형(지세지형:丑刑戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지해(丑↦午)', '원진(丑↔午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지충(丑↯未)', '지지형(지세지형:丑刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['반합(金반합:丑巳)']}
- sewoon: 
- daewoon: N/A (M1)

### Donald Trump — positive — 미국 대통령 당선
- at: 2016-11-08T12:00:00+09:00
- Y_parent: 63.896362249999996
- month: 己亥
- MonthlyDev → M: 0.10706249999999999 → 64.00342475
- raw / center: -0.03487500000000002 / -0.10625000000000001
- valence evidence: {'fit_net': 0.65, 'supply': 0.0, 'natal_rel': 0.0, 'sw_rel': -0.4, 'dw_rel': 0.0}
- event_intensity (explanation-only): 2.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['천간합(己甲)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['반합(木반합:亥未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['지지충(亥↯巳)']}
- sewoon: 지지해(亥↦申)
- daewoon: N/A (M1)

### Donald Trump — positive — 제45대 대통령 취임
- at: 2017-01-20T12:00:00+09:00
- Y_parent: 63.896362249999996
- month: 辛丑
- MonthlyDev → M: 0.1948125 → 64.09117475
- raw / center: 0.02362499999999998 / -0.10625000000000001
- valence evidence: {'fit_net': -0.1499999999999999, 'supply': 0.0, 'natal_rel': -0.7500000000000001, 'sw_rel': 0.6, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丙戌)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['천간합(辛丙)', '지지형(지세지형:丑刑戌)']} {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['천간정극(辛克甲)', '지지해(丑↦午)', '원진(丑↔午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['지지충(丑↯未)', '지지형(지세지형:丑刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['반합(金반합:丑巳)']}
- sewoon: 천간합(辛丙)
- daewoon: N/A (M1)

### Donald Trump — positive — 미국 대통령 재선 당선
- at: 2024-11-05T12:00:00+09:00
- Y_parent: 63.80691396279341
- month: 甲戌
- MonthlyDev → M: -0.6450937499999998 → 63.16182021279341
- raw / center: -0.6203749999999999 / -0.19031250000000002
- valence evidence: {'fit_net': -0.44999999999999996, 'supply': 0.0, 'natal_rel': -1.1749999999999998, 'sw_rel': -0.6, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '월주(甲午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['반합(火반합:戌午)']} {'with': '일주(己未)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['천간합(甲己)', '천간정극(甲克己)', '지지파(戌×未)', '지지형(지세지형:戌刑未)']} {'with': '시주(己巳)', 'pillar_idx': 3, 'with_pillar_key': '시', 'relations': ['천간합(甲己)', '천간정극(甲克己)', '원진(戌↔巳)']}
- sewoon: 지지충(戌↯辰)
- daewoon: N/A (M1)

### Lionel Messi — negative — Copa 결승 패배·은퇴 선언
- at: 2016-06-26T12:00:00+09:00
- Y_parent: 63.4039614002934
- month: 甲午
- MonthlyDev → M: -0.7149375000000001 → 62.6890239002934
- raw / center: -0.40012500000000006 / 0.07650000000000001
- valence evidence: {'fit_net': -0.65, 'supply': 0.0, 'natal_rel': -1.1, 'sw_rel': 0.0, 'dw_rel': 0.0}
- event_intensity (explanation-only): 1.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丁卯)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지파(午×卯)']} {'with': '월주(丙午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지형(자형:午刑午)']}
- sewoon: 
- daewoon: N/A (M1)

### Lionel Messi — negative — 세금사기 유죄 판결
- at: 2016-07-06T12:00:00+09:00
- Y_parent: 63.4039614002934
- month: 甲午
- MonthlyDev → M: -0.7149375000000001 → 62.6890239002934
- raw / center: -0.40012500000000006 / 0.07650000000000001
- valence evidence: {'fit_net': -0.65, 'supply': 0.0, 'natal_rel': -1.1, 'sw_rel': 0.0, 'dw_rel': 0.0}
- event_intensity (explanation-only): 1.8
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丁卯)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['지지파(午×卯)']} {'with': '월주(丙午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지형(자형:午刑午)']}
- sewoon: 
- daewoon: N/A (M1)

### Lionel Messi — negative — Barcelona 이적 요청 공개
- at: 2020-08-25T12:00:00+09:00
- Y_parent: 63.9253665877934
- month: 甲申
- MonthlyDev → M: 1.0299375 → 64.9553040877934
- raw / center: 0.5841249999999999 / -0.10250000000000002
- valence evidence: {'fit_net': 0.95, 'supply': 1.0, 'natal_rel': 0.975, 'sw_rel': 0.0, 'dw_rel': 0.0}
- event_intensity (explanation-only): 2.0
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丁卯)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['원진(申↔卯)']} {'with': '일주(甲辰)', 'pillar_idx': 2, 'with_pillar_key': '일', 'relations': ['반합(水반합:申辰)']}
- sewoon: 천간충(甲↯庚) 반합(水반합:申子)
- daewoon: N/A (M1)

### Lionel Messi — negative — Barcelona 결별·PSG 이적
- at: 2021-08-05T12:00:00+09:00
- Y_parent: 64.3232206502934
- month: 乙未
- MonthlyDev → M: -0.7024687500000001 → 63.62075190029339
- raw / center: -0.3496250000000001 / 0.1186875
- valence evidence: {'fit_net': -0.04999999999999993, 'supply': 0.0, 'natal_rel': 0.4, 'sw_rel': -1.1, 'dw_rel': 0.0}
- event_intensity (explanation-only): 3.0
- NUMERIC_SCORE_DRIVER: ['fit_net', 'supply', 'natal_rel', 'sw_rel', 'dw_rel']
- EXPLANATION_ONLY: ['intensity', 'tg_stem', 'tg_branch', 'rel_texts']
- natal: {'with': '연주(丁卯)', 'pillar_idx': 0, 'with_pillar_key': '연', 'relations': ['반합(木반합:未卯)']} {'with': '월주(丙午)', 'pillar_idx': 1, 'with_pillar_key': '월', 'relations': ['지지합(未午)']}
- sewoon: 천간충(乙↯辛) 지지충(未↯丑) 지지형(지세지형:未刑丑)
- daewoon: N/A (M1)
