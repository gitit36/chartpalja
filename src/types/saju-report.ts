import type { ChartPayload } from './chart'

export interface SajuReportJson {
  만세력_사주원국?: {
    연주?: string
    월주?: string
    일주?: string
    시주?: string
  }
  천간지지?: {
    천간?: { 연간?: string; 월간?: string; 일간?: string; 시간?: string }
    지지?: { 연지?: string; 월지?: string; 일지?: string; 시지?: string }
  }
  오행분포?: Record<string, number>
  신강신약?: {
    score?: number
    판정?: string
    [key: string]: unknown
  }
  용신희신?: {
    용신?: string
    용신_오행?: string
    희신?: string | string[]
    기신?: string | string[]
    [key: string]: unknown
  }
  신살길성?: Record<string, unknown>
  공망?: { 공망지지?: [string, string]; [key: string]: unknown }
  오행십성_상세?: {
    천간?: Array<{ stem?: string; element?: string; ten_god?: string }>
    '지지(지장간포함)'?: Array<{
      branch?: string
      hidden_stems?: Array<{ stem?: string; ten_god?: string }>
      '12운성'?: string
      납음?: string
    }>
    지지_지장간포함?: Array<{
      branch?: string
      hidden_stems?: Array<{ stem?: string; ten_god?: string }>
      '12운성'?: string
      납음?: string
    }>
    [key: string]: unknown
  }
  격국?: Record<string, unknown> | string
  사주관계?: Record<string, unknown>
  패턴점수?: number | Record<string, unknown>
  DomainScore?: Record<string, number>
  대운?: {
    대운기둥10?: Array<{
      order?: number
      daewoon_pillar?: string
      start_age_years?: number
      end_age_years?: number
    }>
    [key: string]: unknown
  }
  세운?: {
    연도별?: Record<string, string>
    [key: string]: unknown
  }
  월운?: Record<string, unknown>
  입력정보?: Record<string, unknown>
  chartData?: ChartPayload
  [key: string]: unknown
}
