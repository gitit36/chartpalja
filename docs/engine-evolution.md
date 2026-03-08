# 차트팔자 — 사주 엔진 & 차트 파이프라인 진화 기록

> 최종 갱신: 2026-02-06  
> 현재 운영 버전: **saju_engine.py (v3.3+patch)**

---

## 목차

1. [버전 일람](#1-버전-일람)
2. [v1 — 기초 원국 엔진](#2-v1--기초-원국-엔진)
3. [v2 — 시계열 도입](#3-v2--시계열-도입)
4. [v3 — 보조지표 & 캔들 추가](#4-v3--보조지표--캔들-추가)
5. [v3.3 — 명리학 정교화 & 월운](#5-v33--명리학-정교화--월운)
6. [v3.3+patch — 현재 운영 버전](#6-v33patch--현재-운영-버전)
7. [프론트엔드 차트 파이프라인](#7-프론트엔드-차트-파이프라인)
8. [프롬프트 진화](#8-프롬프트-진화)
9. [종합운점수 공식 비교표](#9-종합운점수-공식-비교표)
10. [핵심 상수 레퍼런스](#10-핵심-상수-레퍼런스)

---

## 1. 버전 일람

| 버전 | 파일 위치 | 핵심 변경 |
|------|-----------|-----------|
| v1 | `test/saju_engine_v1.py` | 원국 계산 + 정적 점수 (DomainScore, PatternScore) |
| v2 | `test/saju_engine_v2.py` | 대운 상세 + 86년 연도별 타임라인 + `_composite_score` + `chart_data` 페이로드 |
| v3 | `test/saju_engine_v3.py` | 보조지표 7종 + 캔들 OHLC + 시즌태그 + 이벤트확률 |
| v3.3 | `test/saju_engine_v3.3.py` → `saju_engine.py` | 신강신약 5단계 + 격국 정교화 + 조후/통관/화격 + 궁성론 + 월운 |
| v3.3+patch | `saju_engine.py` (현재) | `_composite_score` 차등가중치 복원 + 종격 지장간 전체 + 화격 구현 + 캔들 OHLC 개선 |

---

## 2. v1 — 기초 원국 엔진

### 구조

17개 섹션. `sajupy` 외부 라이브러리로 원국(4주 간지) 계산을 위임하고, 그 결과에 대해 명리학적 해석을 수행.

### 핵심 로직

#### 신강신약 (`strength_score`)
```
sc = 0
월지 계절오행 == 일간오행 (득령) → +4
일간이 생하는 오행 == 월지 → +1
월지가 생하는 오행 == 일간 → +2
천간 중 일간 오행 1개당 → +2  (일간 자신 포함 — 버그)
지지 지장간에 일간 오행 포함 시 1개당 → +2  (깊이 구분 없음)
천간 중 인성 오행 1개당 → +1

판정: ≥9 신강 / ≥6 중간 / <6 신약  (3단계)
```

#### 격국 (`classify_geokguk`)
```
입력: (일간, 월지) — 2개 파라미터만
월지 본기 추출 → 일간 기준 십성 → 격국명 매핑
10종: 비겁격/식신격/상관격/편재격/정재격/편관격/정관격/편인격/정인격/잡기격
투출·종격·건록격·양인격·화격 모두 없음
```

#### 용신 (`determine_yongshin`)
```
입력: (격국명, 판정, 일간)
신강 → STRONG_TABLE[격국] → {용신, 희신, 기신}
신약 → WEAK_TABLE[격국] → {용신, 희신, 기신}
중간 → "중화(균형 유지)"
억부용신만 존재. 조후·통관 없음.
```

#### 대운
간지 블록 10개만 생성 (`{index, start_age, end_age, ganzhi}`). 상세 해석 없음.

#### 없는 것
- 연도별 타임라인 (세운 간지만, 점수 없음)
- 종합운점수 (`_composite_score`)
- 캔들 OHLC
- 보조지표 (에너지장, 귀인력, 시즌태그 등)
- 궁성론
- 월운 분석
- `chart_data` 페이로드

#### 있는 것 (정적)
- `PatternScore`: 관계(합/충/형/파/해) 가중합 → 길/중립/주의/흉 등급
- `DomainScore`: 5개 영역(직업/재물/건강/연애/결혼) 0~10 정적 점수
  - 기본값 5.0 + 십성 가중치 + 격국 보정 + 신강신약 보정 + 신살 보정
- `ohang_imbalance`: 8글자(천간+지지 본기) 정수 카운트 → 과다/부족 진단

---

## 3. v2 — 시계열 도입

### 핵심 변경: **시간축 데이터 생성**

v1은 원국에 대한 정적 분석만 제공했으나, v2에서 **대운 상세**와 **86년 연도별 타임라인**을 도입하여 생애 시계열 차트의 기반을 마련.

### 신규 함수

| 함수 | 역할 |
|------|------|
| `_check_yongshin_fit` | 대운/세운 간지가 용신/희신/기신에 해당하는지 판정 |
| `_calc_incoming_relations` | 외부 간지(대운/세운) vs 원국 4주 관계 분석 |
| `_calc_two_pillar_relations` | 세운↔대운 관계 |
| `_check_incoming_shinsal` | 외부 지지가 발현시키는 신살 (길신/흉살 분리) |
| `_impact_score` | 관계 → 충격지수 합산 |
| `_ohang_balance` | 오행 분산 기반 균형도 (0~1) |
| `_composite_score` | 0~100 종합운점수 산출 |
| `build_daewoon_detail` | 대운 10기둥 상세 빌드 |
| `build_yearly_timeline` | 86년 연도별 타임라인 빌드 |
| `build_chart_payload` | 차트 전용 페이로드 구성 |

### 변경 안된 것
- `strength_score`: v1과 동일 (3단계, 위치 가중치 없음)
- `classify_geokguk`: v1과 동일 (월지 본기만)
- `determine_yongshin`: 실제 오행 동시 반환 추가됨 (예: `"식상(食傷)/火"`)

### 종합운점수 공식 (대운 레벨)
```
base = 50
+ 용신부합 +15 / 희신부합 +8 / 기신부합 -12
+ _UNSEONG_SCORE[12운성]
+ 길신개수 × 3
- 흉살개수 × 3
+ 충격지수 × 2
+ (오행균형도 - 0.5) × 10
clamp [0, 100]
```

### 연도별 점수 공식 (세운 레벨)
```
base = 대운 종합운점수 (dw_trend)
+ 세운_용신부합 +10 / +5 / -8
+ 12운성점수 × 0.5
+ 길신개수 × 2
- 흉살개수 × 2
+ 세운vs원국 충격 × 1.5
+ 세운vs대운 충격 × 1.0
+ (균형도 - 0.5) × 6
clamp [0, 100]
```

### 보조지표 (v2)
| 지표 | 계산 |
|------|------|
| 용신력 | 대운: 용신 +0.3/희신 +0.15/기신 -0.25, 세운 동일 합산 |
| 충격지수 | `_REL_IMPACT` 가중합 (합:+0.9, 충:-1.5 등) |
| 길신카운트 | `len(대운길신 + 세운길신)` |
| 흉살카운트 | `len(대운흉살 + 세운흉살)` |
| 오행균형도 | 분산 기반 0~1 |

### DomainScore 동적화
원국 기반 정적 점수 → 대운/세운별 보정:
- 대운 보정: 용신부합 +0.8, 희신 +0.4, 기신 -0.6 + 십성·12운성 가중치
- 세운 보정: 용신부합 +0.5, 희신 +0.3, 기신 -0.4 + 십성 가중치

### 캔들 OHLC
없음 (단일 `score` 값만, 종합점수가 Close 역할)

### compute_all 변경
```python
def compute_all(inp):
    r = enrich_saju(inp)
    r["chart_data"] = build_chart_payload(r)  # ← 신규
    return r
```

---

## 4. v3 — 보조지표 & 캔들 추가

### 핵심 변경: **보조지표 체계화 + 캔들 OHLC**

v2의 단순 카운트 기반 지표를 가중치 기반으로 전환하고, 주식 차트 비유를 실체화.

### 신규 헬퍼 함수 7개

| 함수 | 역할 |
|------|------|
| `_calc_yongshin_power` | 용신부합 → [-1.0, 1.0] 스칼라 |
| `_calc_energy_field` | 관계 → `{total, positive, negative, direction, keys}` 딕셔너리 |
| `_calc_noble_power` | `_SHINSAL_WEIGHT` 차등 가중합 → 정수 (v2의 len() 대체) |
| `_calc_tengo_balance` | 비겁/식상/재성/관살/인성 5축 카운트 |
| `_calc_season_tag` | 용신력+에너지 → 확장기/안정기/전환기/인내기/격변기/평온기 |
| `_extract_rel_keys` | 관계 리스트 → `(pos, neg, keys)` 분해 |
| `_calc_event_probabilities` | 신살+관계+운성+십성 → 6개 이벤트 확률(%) |

### 종합운점수 변경 (대운 레벨)
```
v2: 길신개수×3 / 흉살개수×3 / 충격지수×2 / 균형×10
v3: noble_power×0.8 / energy.direction×2 / (균형-0.5)×6
```
- `길신개수×3` → `noble_power×0.8` (차등 가중치)
- `충격지수×2` → `energy["direction"]×2` (방향성)
- `균형×10` → `(balance-0.5)×6` (계수 축소)

### 캔들 OHLC (신규)
```
Open  = 대운 종합운점수
Close = 해당 연도 score
High  = score + len(세운길신)×3 + max(용신력, 0)×8
Low   = score - len(세운흉살)×3 - |min(에너지방향, 0)|×4
clamp: High ≤ 100, Low ≥ 0
Type  = Close ≥ Open → "양봉" | "음봉"
```

### 보조지표 확장 (v2 → v3)

| v2 | v3 | 변경 |
|----|-----|------|
| 용신력 (float) | 용신력 (float) | 계산 함수 분리 |
| 충격지수 (float) | **에너지장** (dict) | 단일값 → {total, pos, neg, direction, keys} |
| 길신카운트 (int) | **귀인력** (int) | 단순 개수 → `_SHINSAL_WEIGHT` 가중합 |
| 흉살카운트 (int) | _(귀인력에 통합)_ | 길·흉 하나의 스칼라로 |
| 오행균형도 (float) | 오행균형도 (float) | 동일 |
| _(없음)_ | **12운성곡선** (int) | `_UNSEONG_SCORE` 값 [-12~+12] |
| _(없음)_ | **십성밸런스** (dict) | 5축 카운트 |
| _(없음)_ | **시즌태그** | 6종 시즌 분류 |
| _(없음)_ | **이벤트확률** | 6개 카테고리별 % |

### 시즌태그 기준
```
용신력 ≥ 0.3 & 에너지 ≥ 2.0 → 확장기 🚀
용신력 ≥ 0.2 & 에너지 < 2.0 → 안정기 🏠
|용신력| < 0.2 & 에너지 ≥ 2.0 → 전환기 🔄
용신력 ≤ -0.2 & 에너지 < 1.5 → 인내기 ❄️
용신력 ≤ -0.1 & 에너지 ≥ 2.0 → 격변기 ⚡
나머지 → 평온기 🌿
```

### 이벤트확률 6종
이직_전환, 연애_결혼, 건강_주의, 재물_기회, 학업_시험, 대인_갈등

각 이벤트: `base 5% + 신살 매칭(5~25%) + 관계 매칭(8~20%) + 운성 매칭(8~20%) + 십성 매칭(8~18%)` → clamp [5, 95]

---

## 5. v3.3 — 명리학 정교화 & 월운

### 핵심 변경: **명리학 핵심 이론 구현 + 계층적 분석**

v3까지는 명리학의 기본 프레임만 사용했으나, v3.3에서 전통 명리학의 핵심 원리(근묘화실, 투출 우선, 종격/화격, 조후/통관용신, 궁성론)를 대폭 구현.

### 신강신약 5단계 (`strength_score`)

```
v1~v3: 3단계 (신강/중간/신약), 임계 9/6, 단순 카운팅
v3.3:  5단계, 근묘화실 가중치 + 지장간 깊이 가중치

득령 세분화:
  정득령(월지=일간오행)  → +5.0
  인성 득령             → +3.0
  식상 월령             → +1.0
  관살 월령(극)          → -1.0

천간 통기(투간): 위치별 가중치
  _POSITION_WEIGHT_STEM = {일간: 0(제외), 월간: 1.2, 시간: 1.0, 연간: 0.8}
  비겁 투간: 2.0 × w
  인성 투간: 1.5 × w

지지 통근(지장간): 위치별 × 깊이별 가중치
  _POSITION_WEIGHT_BRANCH = {일지: 1.5, 월지: 1.2, 시지: 1.0, 연지: 0.8}
  깊이: 본기 1.0, 중기 0.6, 여기 0.3
  비겁 통근: 2.0 × w × depth
  인성 통근: 1.0 × w × depth

판정:
  ≥12.0 → 극신강
  ≥8.0  → 신강
  ≥5.0  → 중화
  ≥3.0  → 신약
  <3.0  → 극신약
```

### 격국 정교화 (`classify_geokguk`)

```
v1~v3: 2파라미터(일간, 월지), 월지 본기만, 10종 격국
v3.3:  5파라미터(일간, 월지, 천간4, 지지4, 신강판정)

판별 순서:
  1) 극신약 → 종격 체크 (종재격/종살격/종아격)
     - 지장간 전체(본기1.0/중기0.6/여기0.3) 가중치 카운팅
     - 재성/관살/식상 중 ≥3.0이면 해당 종격
  2) 극신강 → 종왕격 (재성+관살+식상 합산 ≤1.5)
  3) 화격 체크 (일간 포함 천간합이 합화(化)하고, 합화오행 = 월지오행)
     → 화토격/화금격/화수격/화목격/화화격
  4) 건록격 (월지 = 일간의 록) / 양인격 (월지 = 일간의 양인)
  5) 투출 우선 (지장간 중 천간에 드러난 것 → 그 십성의 격국)
  6) 본기→중기→여기 순서 (비겁은 건너뜀)
  7) 전부 비겁이면 비겁격 (변격)

격국유형 분류: 정격(투출)/정격/종격/화격/특수격/변격
총 격국 종류: 10종 기본 + 종격4종 + 화격5종 + 건록격 + 양인격 = 21종+
```

### 용신 체계 확장 (`determine_yongshin`)

```
v1~v3: 3파라미터, 억부용신만
v3.3:  6파라미터(격국dict, 판정, 일간, 월지, 천간4, 지지4)

용신 결정 체계:
  1) 종격 전용 용신 (종재→재성, 종살→관살, 종아→식상, 종왕→비겁)
  2) 화격 전용 용신 (합화오행 = 용신, 생화오행 = 희신, 극화오행 = 기신)
  3) 억부용신 (기존 STRONG/WEAK 테이블 + 건록격·양인격 행 추가)
  4) 조후용신 (_JOHU_TABLE: 일간10 × 월지12 = 120엔트리, 적천수/궁통보감 기반)
  5) 통관용신 (관살오행 ≥3이면 통관 오행 도출)
  6) 합화 정보 (_check_hapwha: 천간합의 화/거 판정)
  7) 형충 해소 (_check_clash_resolution: 삼합이 충을 풀어주는지)

최종 출력:
  - 억부·조후·통관 3체계 종합
  - 판정확신도: "높음(억부+조후 일치)" / "보통(억부·조후 불일치)" / "중"
```

### 오행분포 변경 (`ohang_imbalance`)
```
v1~v3: 천간4 + 지지4 = 8글자 정수 카운트
v3.3:  천간 각 1.0 + 지지 지장간(본기1.0/중기0.5/여기0.3) 가중합 → float
```

### 궁성론 (완전 신규)
```
4궁: 연주(조상궁·사회궁), 월주(부모궁·직업궁), 일주(배우자궁·자아궁), 시주(자녀궁·말년궁)
각 궁성에 대해: 십성, 12운성, 공망 여부, 양인 여부, 도화 여부, 역마 여부 분석
특이사항 자동 생성: 공망→虛, 死/墓/絶→약함, 帝旺/臨官/長生→강함, 양인→과격, 도화→매력, 역마→이동
```

### 월운 (완전 신규)
```
2레벨 구조:
  1) 간이 월운 (_build_monthly_fortune): 세운 타임라인 내 12개월 요약
  2) 상세 월운 (build_monthly_timeline): 세운과 동일 구조로 12개월 상세 분석

월운 점수 공식 (세운보다 감쇄):
  base = 세운 종합점수
  + 용신 +8 / 희신 +4 / 기신 -6  (세운: +10/+5/-8, 대운: +15/+8/-12)
  + 12운성 × 0.4
  + noble × 0.4
  + energy × 1.2
  + (균형 - 0.5) × 5
```

### compute_all 변경
```python
def compute_all(inp, monthly_year=None):  # monthly_year 파라미터 추가
    if monthly_year is None:
        monthly_year = datetime.now(KST).year
    r = enrich_saju(inp)
    r["chart_data"] = build_chart_payload(r, include_monthly_year=monthly_year)
    return r
```

---

## 6. v3.3+patch — 현재 운영 버전

v3.3 반영 시 발견된 호환성 문제와 분석에서 도출된 개선점을 패치.

### 패치 내역

#### 1. `_composite_score` 차등 가중치 복원
```
v3.3 원본: gil_count × 3 / hyung_count × 3 (일괄 ±3 — 퇴보)
패치 후:   noble_power × 0.8 (차등 가중치 복원 — v3와 동일 방식)

v3.3 원본: impact × 2 (별도 _impact_score 함수)
패치 후:   energy_direction × 2 (_calc_energy_field의 direction 재활용)

v3.3 원본: (balance - 0.5) × 10 (근거 불분명)
패치 후:   (balance - 0.5) × 6 (v3 수준으로 복원, 세운 레벨과 일관성 확보)
```

#### 2. 종격 판별 지장간 전체 사용
```
v3.3 원본: branch_main_hs(b) — 본기만 카운팅
패치 후:   BRANCH_HIDDEN_STEMS 전체 순회, 깊이 가중치 [1.0, 0.6, 0.3]
종왕격 임계값: ≤1 → ≤1.5 (소수점 가중치 반영)
```

#### 3. 화격(化格) 구현
```
v3.3 원본: _check_hapwha에서 합화 정보 생성하지만 격국 판별에는 미반영
패치 후:   classify_geokguk에 화격 판별 로직 추가
           + determine_yongshin에 화격 전용 용신 로직 추가
           (합화오행 = 용신, 생화오행 = 희신, 극화오행 = 기신)
```

#### 4. 캔들 OHLC 개선
```
v3.3 원본: len(sw_gil)*3 / len(sw_hyung)*3 (일괄 ±3)
패치 후:   _calc_noble_power(sw_gil, []) * 0.6 / abs(_calc_noble_power([], sw_hyung)) * 0.6
```

#### 5. 미사용 함수 정리
`_impact_score`, `_REL_IMPACT` 제거 (기능이 `_calc_energy_field`와 중복)

---

## 7. 프론트엔드 차트 파이프라인

### 전체 데이터 흐름

```
Python saju_engine.py
  └─ build_chart_payload()  →  JSON (한국어 키, 중첩 구조)
       ↓
API Response → report.chartData : ChartPayload
       ↓
src/lib/saju/life-chart-data.ts :: buildLifeChartData()
  ├─ 대운블록 → Map<year, DaewoonBlock>
  ├─ 연도타임라인 → Map<year, YearlyDatum>
  ├─ 86년 루프: 한국어 중첩 구조 → 영문 flat ChartDatum[]
  ├─ 월운: MonthlyDatum[] → ChartDatum[] (year=month 트릭)
  ├─ 시즌밴드 / 인생단계 / 주석 생성
  └─ → LifeChartData
       ↓
src/components/ChartTab.tsx
  ├─ period 필터 (1y/5y/10y/all) → filteredData + isMonthly
  ├─ 메인: ComposedChart (score곡선 + 캔들 + 대운선 + 시즌배경)
  ├─ 보조: 6종 서브차트
  ├─ 선택: 연도/구간 → AI 해설 API 호출
  └─ 설정: 오버레이/보조지표 토글 패널
```

### 타입 계층 (`src/types/chart.ts`)

```
ChartPayload
├─ meta: ChartMeta
├─ 원국_baseline: BaselineData
├─ 궁성론: GungseongItem[]
├─ 대운기둥10: DaewoonBlock[]
│   └─ CandleData, EnergyField, SeasonTag, EventProbabilities, TengoBalance ...
├─ 연도별_타임라인: YearlyDatum[]
│   └─ CandleData, EnergyField, SeasonTag, EventProbabilities, TengoBalance ...
├─ 월운_타임라인: MonthlyTimeline
│   └─ data: MonthlyDatum[]
└─ 보조지표_범례: IndicatorLegend[]
```

### 데이터 변환 (`src/lib/saju/life-chart-data.ts`)

핵심 매핑 (한국어 중첩 → 영문 flat):
```
YearlyDatum.candle.open        → ChartDatum.open
YearlyDatum.candle.close       → ChartDatum.close
YearlyDatum.candle.high        → ChartDatum.high
YearlyDatum.candle.low         → ChartDatum.low
YearlyDatum.scores.종합        → ChartDatum.score
DaewoonBlock.종합운점수        → ChartDatum.trend
YearlyDatum.indicators.용신력   → ChartDatum.yongshinPower
YearlyDatum.indicators.에너지장.total → ChartDatum.energyTotal
YearlyDatum.indicators.에너지장.direction → ChartDatum.energyDirection
YearlyDatum.indicators.귀인력   → ChartDatum.noblePower
YearlyDatum.indicators.오행균형도 → ChartDatum.ohangBalance
YearlyDatum.indicators.12운성곡선 → ChartDatum.unseong12
YearlyDatum.indicators.십성밸런스.{비겁,식상,재성,관살,인성} → ChartDatum.tengo{비겁,...}
YearlyDatum.이벤트확률.이직_전환 → ChartDatum.eventCareer
YearlyDatum.시즌태그.tag       → ChartDatum.seasonTag
```

### 차트 렌더링 (`src/components/ChartTab.tsx`)

**메인 차트** (Recharts ComposedChart, 높이 420px):
| 요소 | dataKey | 토글 |
|------|---------|------|
| 운세 곡선 (Line, 녹색) | `score` | 항상 |
| 대운 흐름선 (Line, stepAfter, 금색) | `trend` | `mainOverlays.daewoon` |
| 캔들스틱 (Bar + CandleShape) | `close` | `mainOverlays.candle` |
| 시즌 배경색 (ReferenceArea) | `seasonBands` | `mainOverlays.season` |
| 올해/이번달 마커 | — | 항상 |

**보조차트 6종** (`auxPanels`):
| 키 | 차트 | dataKey |
|----|------|---------|
| `yongshin` | AreaChart | `yongshinPower` (용신력) |
| `energy` | BarChart | `energyTotal` (에너지장) |
| `noble` | BarChart | `noblePower` (귀인력) |
| `ohang` | LineChart | `ohangBalance` (오행균형도) |
| `tengo` | RadarChart | 5축 (십성밸런스) |
| `event` | BarChart (horizontal) | 6종 이벤트확률 |

**기간 선택**:
- `1y`: `monthlyData`가 있으면 월운 모드 (1~12월), 없으면 올해만
- `5y` / `10y` / `all`: 연도별 데이터 필터

---

## 8. 프롬프트 진화

| 버전 | 파일 | 핵심 변경 |
|------|------|-----------|
| v5.0 | `docs/prompts/fortune-prompt-v5.0.ts` | 기본 프롬프트. `report` 데이터로 원국 기본 정보 + 간략한 차트 요약 전달 |
| v6.0 | `docs/prompts/fortune-prompt-v6.0.ts` | 감성 공감 강화. "나를 정확히 이해받는 느낌" 중심 톤 전환. 비유/메타포 + 자기동일시 트리거 |
| 현재 | `src/lib/ai/fortune-prompt.ts` | v6.0 기반 + 데이터 최대화. 격국·신강약·조후·궁성론·대운흐름·올해상세 등 엔진의 거의 모든 데이터를 프롬프트 변수로 전달 |

### 현재 프롬프트에서 사용하는 엔진 데이터

`buildFortunePrompt`에서 추출하는 데이터:
- 원국 4주 간지 + 각 위치별 십성
- 격국명/격국유형/격국비고
- 신강약 판정/점수/확신도
- 용신/희신/기신 (억부+조후+통관 3체계)
- 12운성 (4주별)
- 지장간 (4주별)
- 오행분포 (가중치 포함)
- 패턴점수, 도메인점수
- 궁성론 (4궁별 특이사항)
- 대운 10블록 요약
- 올해 상세 (캔들, 모든 indicators, 관계, 이벤트확률)
- 공망, 신살 (위치 정보 포함)

`buildYearSummaryPrompt` / `buildRangeSummaryPrompt`:
- 해당 연도의 캔들 OHLC
- 모든 indicators (용신력/에너지장/귀인력/균형도/12운성/십성밸런스)
- 모든 도메인 점수
- 이벤트확률 6종
- 관계 (원국/대운)
- 신살 (길신/흉살)
- 대운전환기 여부
- 세운-일주 관계

---

## 9. 종합운점수 공식 비교표

### 대운 레벨 (`_composite_score`)

| 항목 | v2 | v3 | v3.3+patch |
|------|-----|-----|------------|
| base | 50 | 50 (파라미터화) | 50 |
| 용신부합 | +15 | +15 | +15 |
| 희신부합 | +8 | +8 | +8 |
| 기신부합 | -12 | -12 | -12 |
| 12운성 | `_UNSEONG_SCORE` | `_UNSEONG_SCORE` | `_UNSEONG_SCORE` |
| 길흉살 | `길신×3 - 흉살×3` | `noble_power × 0.8` | `noble_power × 0.8` |
| 충격/에너지 | `충격지수 × 2` | `energy.direction × 2` | `energy_direction × 2` |
| 오행균형 | `(balance-0.5) × 10` | `(balance-0.5) × 6` | `(balance-0.5) × 6` |

### 세운 레벨 (build_yearly_timeline 인라인)

| 항목 | v2 | v3 | v3.3+patch |
|------|-----|-----|------------|
| base | dw_trend | dw_trend | dw_trend |
| 용신부합 | (세운보정에 포함) | +10 | +10 |
| 희신부합 | | +5 | +5 |
| 기신부합 | | -8 | -8 |
| 12운성 | (세운보정에 포함) | `× 0.5` | `× 0.5` |
| 길흉살 | `길신×2 / 흉살×2` | `noble_power × 0.5` | `noble_power × 0.5` |
| 에너지 | `충격×1.5 + 충격_dw×1.0` | `energy.direction × 1.5` | `energy.direction × 1.5` |
| 오행균형 | `(balance-0.5) × 6` | `(balance-0.5) × 6` | `(balance-0.5) × 6` |

### 월운 레벨 (v3.3+ 신규)

| 항목 | 값 |
|------|----|
| base | 세운 종합점수 |
| 용신부합 | +8 |
| 희신부합 | +4 |
| 기신부합 | -6 |
| 12운성 | `× 0.4` |
| noble | `× 0.4` |
| energy | `× 1.2` |
| 오행균형 | `(balance-0.5) × 5` |

→ **계층적 감쇄**: 대운(15/8/-12) → 세운(10/5/-8) → 월운(8/4/-6)

---

## 10. 핵심 상수 레퍼런스

### `_UNSEONG_SCORE` (12운성 → 점수)
```
長生: +10, 沐浴: +2, 冠帶: +8, 臨官: +10, 帝旺: +12
衰: -2, 病: -6, 死: -10, 墓: -8, 絶: -12, 胎: 0, 養: +4
```

### `_SHINSAL_WEIGHT` (신살별 가중치)
```
길신:
  천을귀인: +5, 록신/장성: +4, 문창/홍란/천희/천덕/월덕/삼기: +3
  나머지 길신: +2
흉살:
  백호살: -5, 양인: -4, 고란/귀문관살/고진/과숙: -3
  도화/괴강/원진살/현침살/격각살/금신살/음양차착살/천라/지망/망신/겁살/함지살: -2
  역마: -1
```

### `_REL_WEIGHT` (관계 가중치)
```
합: +0.9, 반합: +0.5
충: -1.5, 파: -1.2, 형: -1.0, 해: -0.7, 극: -0.6
```

### 위치 가중치 (v3.3+)
```
천간: 일간=0(제외), 월간=1.2, 시간=1.0, 연간=0.8
지지: 일지=1.5, 월지=1.2, 시지=1.0, 연지=0.8
지장간 깊이: 본기=1.0, 중기=0.6, 여기=0.3
```

### `_JOHU_TABLE` (조후용신, v3.3+)
일간(10) × 월지(12) = 120엔트리, 각 `(주용신오행, 보조용신오행)` 반환. 적천수/궁통보감 기반.

### `_STEM_COMBINE_RESULT` (천간합 합화, v3.3+)
```
甲+己 → 土, 乙+庚 → 金, 丙+辛 → 水, 丁+壬 → 木, 戊+癸 → 火
```

---

*이 문서는 `saju_engine.py`의 각 버전 파일(`test/saju_engine_v1~v3.3.py`)과 현재 운영 코드(`saju_engine.py`, `src/types/chart.ts`, `src/lib/saju/life-chart-data.ts`, `src/components/ChartTab.tsx`, `src/lib/ai/fortune-prompt.ts`)를 기반으로 작성되었습니다.*
