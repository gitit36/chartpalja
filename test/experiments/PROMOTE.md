# 실험군 B → 운영 엔진 이식 체크리스트

**엔진 미반영.** 계층 순서 준수:

1. 대운 climate (6D)  
2. 세운 (6E, 부모=climate)  
3. 월·일 (6B2/6C2 라벨 분리도)

현재 잠금:

| 층 | 버전 | 혼합 | 게이트 |
|----|------|------|--------|
| 대운 | B7 | year_resid scale=2.10 | climate excl-mixed 4/4 |
| 세운 | B7 | climate×0.38 + 독립×0.62 | holdout 100% |
| 월 | B8_month_sep | 세운×0.715 + 월×0.285 amp=1.71 | train 78% / hold 100% |
| 일 | B8_day_sep | 월×0.58 + 일×0.42 amp=1.91 | train 78% / hold 80% |

**B9 (shadow candidate — engine 미반영):** `α=1 κ=0 β=0.25` median; `S_raw=D+A`, `M_raw=S_raw+βQ`.  
Robustness: `exp_b9_robustness.json` → `shadow_prototype_candidate`. B7 year KPI는 year_resid 누수로 직접 비교 금지; 월 라벨은 B8이 공정 레퍼런스.

라벨: `month_day_labels.json` (core 14명, 공개 사건 월·일)

## 하지 말 것

- `saju_engine` 실험 중 수정
- **대운 없이 세운만 HP** (6A 실수)
- soft-exclude로 90% 분식
- 월·일 라벨 없이 분리도 90% 주장

## 이식 전

- [x] `exp_sweep_phase_bc.json` 분리도 스윕 고정
- [ ] `exp_arms_compare.json` 재측정 (선택)
- [ ] 별도 PR
