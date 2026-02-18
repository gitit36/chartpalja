/**
 * chart_data 페이로드 타입 (Python saju_engine.py → 프론트엔드)
 * saju_engine.py build_chart_payload() 출력 구조와 1:1 대응
 */

// ─── 최상위 페이로드 ───
export interface ChartPayload {
  meta: ChartMeta
  원국_baseline: BaselineData
  대운기둥10: DaewoonBlock[]
  연도별_타임라인: YearlyDatum[]
  보조지표_범례: Record<string, IndicatorLegend>
}

// ─── meta ───
export interface ChartMeta {
  birthYear: number
  gender: string
  dayStem: string
  dayElement: string
  strength: string
  geokguk: string
  yongshin: { label: string; element: string }
  heeshin: Array<{ label: string; element: string }>
  gishin: Array<{ label: string; element: string }>
}

// ─── 원국 baseline ───
export interface BaselineData {
  오행분포: Record<string, number>
  patternScore: number
  domainScore: Record<string, number>
}

// ─── 캔들 데이터 ───
export interface CandleData {
  open: number
  close: number
  high: number
  low: number
  type: '양봉' | '음봉'
}

// ─── 에너지장 ───
export interface EnergyField {
  total: number
  positive: number
  negative: number
  direction: number
  keys: string[]
}

// ─── 시즌태그 ───
export interface SeasonTag {
  tag: '확장기' | '안정기' | '전환기' | '인내기' | '격변기' | '평온기'
  emoji: string
  desc: string
}

// ─── 이벤트확률 ───
export interface EventProbabilities {
  이직_전환: number
  연애_결혼: number
  건강_주의: number
  재물_기회: number
  학업_시험: number
  대인_갈등: number
}

// ─── 십성밸런스 ───
export interface TengoBalance {
  비겁: number
  식상: number
  재성: number
  관살: number
  인성: number
}

// ─── 대운 블록 (10개) ───
export interface DaewoonBlock {
  order: number
  daewoon_pillar: string
  stem: string
  branch: string
  stemElement: string
  branchElement: string
  start_age_years: number
  end_age_years: number
  start_year: number
  end_year: number
  십성_천간: string
  십성_지지: string
  '12운성': string
  납음: string
  용신부합: boolean
  희신부합: boolean
  기신부합: boolean
  오행변화: Record<string, number>
  관계_with_원국: RelationGroup[]
  신살_길신: string[]
  신살_흉살: string[]
  indicators: {
    용신력: number
    에너지장: EnergyField
    귀인력: number
    오행균형도: number
    '12운성점수': number
  }
  십성밸런스: TengoBalance
  domainScore: Record<string, number>
  종합운점수: number
  등급: string
  시즌태그: SeasonTag
  이벤트확률: EventProbabilities
}

// ─── 연도별 데이터 (86년) ───
export interface YearlyDatum {
  year: number
  age: number
  대운_pillar: string
  세운_pillar: string
  세운_stem: string
  세운_branch: string
  세운_stemElement: string
  세운_branchElement: string
  세운_십성_천간: string
  세운_십성_지지: string
  세운_12운성: string
  세운_용신부합: boolean
  세운_희신부합: boolean
  세운_기신부합: boolean
  세운_관계_with_원국: RelationGroup[]
  세운_관계_with_대운: string[]
  세운_신살_길신: string[]
  세운_신살_흉살: string[]
  candle: CandleData
  scores: {
    종합: number
    직업: number
    재물: number
    건강: number
    연애: number
    결혼: number
  }
  indicators: {
    용신력: number
    에너지장: EnergyField
    귀인력: number
    오행균형도: number
    '12운성곡선': number
    십성밸런스: TengoBalance
  }
  시즌태그: SeasonTag
  이벤트확률: EventProbabilities
}

// ─── 공통 하위 타입 ───
export interface RelationGroup {
  with: string
  relations: string[]
}

export interface IndicatorLegend {
  desc: string
  range: [number, number] | string
  analogy: string
}
