# 실험 암 (Control / Exp-A / Exp-B) — 운영 엔진과 분리

## 계층 튜닝 순서 (필수)

```text
대운 climate (6D) → 세운 (6E) → 월 분리도 (6B2) → 일 분리도 (6C2)
```

세운만 먼저 튜닝하지 말 것 (6A는 이 실수로 superseded).

| Phase | 스크립트 | 산출 |
|-------|----------|------|
| 6D→6E | `sweep_phase_d_daewoon.py` | `B7_dae_first` |
| 6A (구) | `sweep_phase_a.py` | superseded |
| 6B2/6C2 | `sweep_phase_bc.py` + labels | B8 reference |
| **B9** | `B9_SPEC.md` → `b9_structure_kpi.py` | **A only** until structure gates |

```bash
python test/experiments/b9_structure_kpi.py --alpha 1.0
python -m pytest test/experiments/test_b9_scaffold.py -q
```

B/C/D blocked until A structural pass (see SPEC).

## 현재 잠금

- 대운: `year_resid`, `dae_resid_scale=2.10`
- 세운: climate×0.38 + 증폭독립×0.62
- 월: β=0.715 amp=1.71 — train 78% / holdout 100%
- 일: γ=0.58 amp=1.91 — train 78% / holdout 80%

```bash
python test/experiments/sweep_phase_d_daewoon.py
python test/experiments/compare_arms.py
python test/experiments/sweep_phase_bc.py   # 월·일 라벨 분리도
python -m pytest test/experiments/test_exp_isolation.py -q
```

엔진 이식: [`PROMOTE.md`](PROMOTE.md) — 요청 전까지 미반영.
