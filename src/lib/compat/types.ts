export const COMPAT_TYPES = [
  '서로 채워주는 궁합',
  '달라서 끌리는 궁합',
  '끌리지만 부딪히는 궁합',
  '천천히 맞아가는 궁합',
  '오래 볼수록 좋은 궁합',
  '타이밍이 중요한 궁합',
] as const

export type CompatType = (typeof COMPAT_TYPES)[number]

export type RelationshipType = 'romance' | 'friend' | 'business' | 'family'

/** 궁합 흐름 미니차트용 압축 시계열 (y=연도, s=관계점수) */
export interface CompatFlowPoint {
  y: number
  s: number
}

export interface CompatReportEntry {
  partnerId: string
  partnerName: string
  partnerGender: string
  relationship: RelationshipType
  type: CompatType
  text: string
  createdAt: string
  /** 생성 시점에 서버에서 저장한 관계 케미 스냅샷 (추가 fetch 없이 렌더) */
  card?: CompatCardData
  /** 관계 흐름 압축 시계열 스냅샷 */
  flow?: CompatFlowPoint[]
}

export interface CompatGenerationState {
  partnerId: string
  partnerName: string
  relationship: RelationshipType
  type: CompatType
}

export interface OverlayCompatInfo {
  overlayId: string
  overlayName: string
  overlayGender: string
  myScore: number
  partnerScore: number
  type: CompatType
  /** 이미 생성된 관계 타입 목록 */
  generatedRelationships: RelationshipType[]
  /** 올해 궁합 흐름 도트 (1~5) */
  compatDots?: number
  /** 두 사람의 전반적인 관계 점수 (0~100) */
  overallScore?: number
}

export interface CompatShareSnapshot {
  enabled: boolean
  sharedAt: string
  myScore: number
  partnerScore: number
  type: CompatType
  relationship: RelationshipType
  partnerName: string
}

export type CompatEventKind = 'good' | 'caution' | 'closer' | 'drift' | 'synergy' | 'support'

export interface RelationshipYearPoint {
  year: number
  score: number
  dots: 1 | 2 | 3 | 4 | 5
  components: { sync: number; ohang: number; support: number; clash: number }
  events: CompatEventKind[]
  scoreA: number
  scoreB: number
}

export interface CompatEventBand {
  startYear: number
  endYear: number
  kind: 'good' | 'caution'
}

/** 연도별 관계 수준 3단계 (하단 리듬 바 / 툴팁용) */
export type YearCompatLevel = 'good' | 'normal' | 'caution'

/** 관계 케미 카드 스펙트럼 축 (0=왼쪽 라벨, 1=오른쪽 라벨) */
export interface CompatSpectrum {
  key: 'energy' | 'rhythm' | 'lean' | 'temp'
  title: string
  leftLabel: string
  rightLabel: string
  caption: string
  /** 0~1 위치값 (오른쪽 라벨에 가까울수록 1) */
  value: number
}

/** 4축 조합으로 부여되는 한 단어 캐릭터(아키타입) */
export interface CompatArchetype {
  category: string
  label: string
}

/** 관계 케미 카드 — 관계 유형과 무관한 결정론적 코어 값 */
export interface CompatCardData {
  overallScore: number
  archetype: CompatArchetype
  spectrums: CompatSpectrum[]
  goodYears: number[]
  cautionYears: number[]
}
