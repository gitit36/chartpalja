/**
 * Daily-fortune batch computation (deterministic engine scores, no LLM cost).
 *
 * Spawns python_service/daily_once.py once for the whole entry list, computing
 * each entry's score for every requested date. Used by the list watchlist UI.
 */

import { runPythonScript } from './python-runner'

/** 6대 생활 도메인 운세 점수 (0~100, 높을수록 좋음) */
export type DomainScores = Partial<Record<DomainKey, number>>

export type DomainKey = '연애' | '대인' | '재물' | '학업' | '직업' | '건강'

export interface DailyChartIndicators {
  v?: number
  yongshinPower: number
  energyTotal: number
  energyDirection: number
  noblePower: number
  ohangBalance: number
  unseongCurve: number
  tengo?: {
    비겁: number
    식상: number
    재성: number
    관살: number
    인성: number
  }
  events?: {
    이직_전환: number
    연애_결혼: number
    건강_주의: number
    재물_기회: number
    학업_시험: number
    대인_갈등: number
  }
}

export interface DailyScore {
  score: number
  grade: string
  seasonTag: string
  seasonEmoji: string
  seasonDesc?: string
  domains: DomainScores
  bestDomain: string
  bestScore: number
  worstDomain: string
  worstScore: number
  chart?: DailyChartIndicators
}

/** entryId -> (date -> score) */
export type DailyBatchResult = Record<string, Record<string, DailyScore>>

export interface DailyComputeEntry {
  id: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  gender: string
  isLunar: boolean
  isLeapMonth: boolean
  /** 차트와 동일한 용신을 쓰도록 저장된 리포트에서 추출한 값 (없으면 룰베이스) */
  yongshinOverride?: {
    용신_오행: string
    희신_오행: string[]
    기신_오행: string[]
    구신_오행: string[]
  } | null
}

/**
 * Pull the yongshin override out of a stored sajuReportJson so daily scores
 * line up with whatever 용신 the chart was generated with (incl. LLM override).
 */
export function extractYongshinOverride(
  sajuReportJson: unknown,
): DailyComputeEntry['yongshinOverride'] {
  if (!sajuReportJson || typeof sajuReportJson !== 'object') return null
  const report = sajuReportJson as Record<string, unknown>
  const yong = (report['용신희신'] ?? report['용신']) as Record<string, unknown> | undefined
  if (!yong) return null
  const elem = yong['용신_오행']
  if (typeof elem !== 'string' || !elem) return null
  const asStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    용신_오행: elem,
    희신_오행: asStrArr(yong['희신_오행']),
    기신_오행: asStrArr(yong['기신_오행']),
    구신_오행: asStrArr(yong['구신_오행']),
  }
}

/**
 * Compute daily scores for a batch of entries across a set of dates.
 * Returns {} on failure (caller should degrade gracefully — scores are
 * a non-critical enhancement of the list).
 */
export function computeDailyFortunes(
  entries: DailyComputeEntry[],
  dates: string[],
): DailyBatchResult {
  if (entries.length === 0 || dates.length === 0) return {}

  const payload = {
    entries: entries.map((e) => ({
      id: e.id,
      birth_date: e.birthDate,
      birth_time: e.timeUnknown ? '12:00' : (e.birthTime || '12:00'),
      time_unknown: !!e.timeUnknown,
      gender: e.gender === 'female' ? 'female' : 'male',
      is_lunar: !!e.isLunar,
      is_leap_month: !!e.isLeapMonth,
      utc_offset: 9,
      ...(e.yongshinOverride ? { yongshin_override: e.yongshinOverride } : {}),
    })),
    dates,
  }

  try {
    const stdout = runPythonScript('daily_once.py', JSON.stringify(payload), { timeoutMs: 60000 })
    return JSON.parse(stdout) as DailyBatchResult
  } catch (err) {
    console.error('[daily-fortune] batch failed:', err instanceof Error ? err.message : err)
    return {}
  }
}
