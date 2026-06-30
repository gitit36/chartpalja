export const COMPAT_TYPES = [
  '서로 채워주는 궁합',
  '달라서 끌리는 궁합',
  '끌리지만 부딪히는 궁합',
  '천천히 맞아가는 궁합',
  '오래 볼수록 좋은 궁합',
  '타이밍이 중요한 궁합',
] as const

export type CompatType = (typeof COMPAT_TYPES)[number]

export type RelationshipType = 'romance' | 'friend' | 'business'

export interface CompatReportEntry {
  partnerId: string
  partnerName: string
  partnerGender: string
  relationship: RelationshipType
  type: CompatType
  text: string
  createdAt: string
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
