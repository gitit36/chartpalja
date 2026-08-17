# V2 Product Scoring Policy

**Hierarchy status:** `V2_FULL_HIERARCHY_READY_WITH_TIMING_LIMITATIONS`

## Month

**Recommendation:** `MONTH_LOW_CONFIDENCE_TIMING`

Month hierarchy is coherent with modest OLD exact-date diagnostic (hit≈0.5828) but Fresh A=0 and TIMING_ONLY — show numeric with low-confidence framing, not as validated prediction.

## Day

**Recommendation:** `DAY_EXPLANATION_ONLY`

Day hierarchy coherent but exact-day diagnostic is weak/negative (hit≈0.4785, sep=-0.0279). Prefer explanation/context over numeric Day prominence to avoid misleading daily claims.

## User-risk mitigations (no score tuning)

### Overconfident Day claims
- Mitigation: Default Day to explanation-only or clearly labeled low-confidence; no '오늘 대박/망함' from score alone

### Month/Day read as independent fortune
- Mitigation: UI always anchors to Y/M parents; copy: '연간 흐름 안의 단기 리듬'

### Score vs orthodox contradiction
- Mitigation: Mixed-language templates; never attribute ortho-only factors to numeric moves

### 節 boundary date ambiguity
- Mitigation: Avoid overprecise month claims on 節 calendar dates; optional range wording

### Overly flat Daewoon
- Mitigation: Set expectation that D is regime baseline; annual/month carry visible movement

### Mechanical daily oscillation
- Mitigation: If Day numeric shown, damp visual prominence; emphasize month baseline

## Display rules

1. Always show parent context with child scores (Y under M, M under Day).
2. Never present Month/Day as independent life scores.
3. On numeric/orthodox conflict: mixed language, no fabricated certainty.
4. VALENCE ≠ EVENT_INTENSITY in copy.
5. Boundary-date events: avoid overprecise month claims.
