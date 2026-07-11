/**
 * Daily-fortune date math (KST) + rule-based signals (no LLM).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** Today's date string in KST, "YYYY-MM-DD". */
export function kstToday(now: Date = new Date()): string {
  return toKstDateStr(now)
}

export function toKstDateStr(d: Date): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  return kst.toISOString().slice(0, 10)
}

/**
 * Last `days` dates ending today (KST), ascending order.
 * e.g. days=7 → [6일 전 ... 어제, 오늘].
 */
export function kstRecentDates(days: number, now: Date = new Date()): string[] {
  const todayKst = new Date(now.getTime() + KST_OFFSET_MS)
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayKst.getTime() - i * 24 * 60 * 60 * 1000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * 차트 '이번 주' — 오늘을 가운데에 둔 7일 (이전 3 + 오늘 + 이후 3).
 * X축 인덱스 1..7, 오늘 = 4.
 */
export function kstCenteredWeekDates(now: Date = new Date()): string[] {
  const today = kstToday(now)
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0)
  const out: string[] = []
  for (let i = -3; i <= 3; i++) {
    out.push(new Date(utcNoon + i * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}

/** 오늘 중심 주에서 오늘 X (=4) */
export const WEEK_TODAY_X = 4

/**
 * 캘린더 주(KST) 월요일~일요일 7일. (리스트 등 레거시)
 */
export function kstCurrentWeekDates(now: Date = new Date()): string[] {
  const today = kstToday(now)
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0)
  const dow = new Date(utcNoon).getUTCDay() // 0=일 … 6=토
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    out.push(new Date(utcNoon + (mondayOffset + i) * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}

/** @deprecated 차트 주는 오늘 중심 — WEEK_TODAY_X(4) 사용 */
export function kstWeekdayIndex(_now: Date = new Date()): number {
  return WEEK_TODAY_X
}

export type DeltaDirection = 'up' | 'down' | 'flat'

export function deltaDirection(delta: number): DeltaDirection {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

/** 토스식 "소식" 배지 종류 */
export type DailySignalKind = 'position' | 'delta' | 'balance' | 'action'

export interface DailySignal {
  kind: DailySignalKind
  /** UI 배지 라벨 */
  label: string
  text: string
}

export interface WeekScoreRange {
  min: number
  max: number
  score: number
  /** 0~1, 주간 구간 안 오늘 위치. min===max 이면 0.5 */
  pct: number
}

const DOMAIN_ACTION_CAUTION: Record<string, string> = {
  연애: '감정 소모 큰 대화는 짧게 끊어요',
  대인: '약속은 짧게, 오해는 바로 풀어요',
  재물: '큰 지출·계약은 하루 미뤄보세요',
  학업: '집중 블록을 짧게 나눠보세요',
  직업: '중요한 결정은 오전에만 정리해요',
  건강: '일정 밀도는 낮추는 게 좋아요',
}

const DOMAIN_ACTION_LEAN: Record<string, string> = {
  연애: '솔직한 한마디가 잘 통하는 날이에요',
  대인: '가벼운 만남·인사를 늘려보세요',
  재물: '제안·협상 타이밍으로 쓰기 좋아요',
  학업: '밀린 학습을 밀어붙이기 좋아요',
  직업: '성과 보이는 일에 시간을 몰아보세요',
  건강: '몸을 풀어주는 루틴을 넣어보세요',
}

const CONTRAST_ACTION: Record<string, string> = {
  '연애|건강': '사람 만나되 무리한 일정은 줄여요',
  '건강|연애': '회복 먼저, 만남은 가볍게',
  '재물|건강': '기회는 보되 몸 상태는 챙기세요',
  '건강|재물': '컨디션 회복이 우선이에요',
  '직업|건강': '성과는 내되 과로는 피하세요',
  '건강|직업': '페이스 조절이 먼저예요',
  '연애|재물': '관계는 열고, 큰돈 결정은 보류해요',
  '재물|연애': '실리는 챙기되 감정 소모는 줄여요',
  '대인|재물': '사람은 만나되 금전 약속은 신중히',
  '재물|대인': '협상은 좋지만 관계 온도는 유지해요',
  '직업|연애': '일 성과에 집중, 감정 이슈는 미뤄요',
  '연애|직업': '관계는 열어두되 업무 결정은 신중히',
  '학업|건강': '공부는 짧게, 휴식도 같이',
  '건강|학업': '컨디션 회복 후 집중해요',
}

const SIGNAL_LABEL: Record<DailySignalKind, string> = {
  position: '위치',
  delta: '변화',
  balance: '균형',
  action: '행동',
}

export type DailySignalInput = {
  score: number
  delta?: number
  bestDomain?: string | null
  bestScore?: number | null
  worstDomain?: string | null
  worstScore?: number | null
  standoutDomain?: string | null
  standoutScore?: number | null
  series?: (number | null)[]
}

function weekPeakOrLow(series: (number | null)[] | undefined): 'peak' | 'low' | null {
  if (!series?.length) return null
  const nums = series.filter((v): v is number => typeof v === 'number')
  if (nums.length < 3) return null
  const today = series[series.length - 1]
  if (typeof today !== 'number') return null
  const max = Math.max(...nums)
  const min = Math.min(...nums)
  if (today === max && nums.filter((n) => n === max).length === 1) return 'peak'
  if (today === min && nums.filter((n) => n === min).length === 1) return 'low'
  return null
}

/** 7일 시리즈 기준 오늘 점수 위치 (토스 1일 고저 바) */
export function weekScoreRange(
  score: number,
  series?: (number | null)[],
): WeekScoreRange | null {
  const nums = (series ?? []).filter((v): v is number => typeof v === 'number')
  if (nums.length < 2) return null
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min
  const pct = span <= 0 ? 0.5 : Math.max(0, Math.min(1, (score - min) / span))
  return { min, max, score, pct }
}

function pickAction(opts: {
  score: number
  bestDomain?: string | null
  worstDomain?: string | null
  standoutDomain?: string | null
  standoutScore?: number | null
}): string {
  const { score, bestDomain, worstDomain, standoutDomain, standoutScore } = opts

  if (bestDomain && worstDomain && bestDomain !== worstDomain) {
    const key = `${bestDomain}|${worstDomain}`
    if (CONTRAST_ACTION[key]) return CONTRAST_ACTION[key]!
  }

  if (standoutDomain && standoutScore != null) {
    if (standoutScore < 45) {
      return DOMAIN_ACTION_CAUTION[standoutDomain] ?? '오늘은 한 박자 쉬어가세요'
    }
    if (standoutScore >= 65) {
      return DOMAIN_ACTION_LEAN[standoutDomain] ?? '흐름 좋은 쪽에 시간을 써보세요'
    }
  }

  if (worstDomain && score < 55) {
    return DOMAIN_ACTION_CAUTION[worstDomain] ?? '무리한 일정은 줄여보세요'
  }
  if (bestDomain && score >= 55) {
    return DOMAIN_ACTION_LEAN[bestDomain] ?? '흐름 좋은 쪽에 시간을 써보세요'
  }
  return score >= 55 ? '작은 진전 하나를 목표로 해보세요' : '오늘은 회복·정리에 무게를 두세요'
}

function sig(kind: DailySignalKind, text: string): DailySignal {
  return { kind, label: SIGNAL_LABEL[kind], text }
}

/**
 * 대표 카드용 소식 2~3줄 (칩·점수와 중복 없는 정보만).
 * 최대 3개: 위치/변화 → 균형 → 행동.
 */
export function buildDailySignals(opts: DailySignalInput): DailySignal[] {
  const {
    score,
    delta = 0,
    bestDomain,
    bestScore,
    worstDomain,
    worstScore,
    standoutDomain,
    standoutScore,
    series,
  } = opts

  const out: DailySignal[] = []
  const week = weekPeakOrLow(series)

  if (week === 'peak') {
    out.push(sig('position', '이번 주 흐름 중 가장 높은 날'))
  } else if (week === 'low') {
    out.push(sig('position', '이번 주 흐름 중 가장 낮은 날'))
  } else if (Math.abs(delta) >= 8) {
    out.push(
      sig(
        'delta',
        delta > 0 ? '어제보다 기운이 확 올랐어요' : '어제보다 한 단 내려앉았어요',
      ),
    )
  } else if (Math.abs(delta) >= 3) {
    out.push(
      sig(
        'delta',
        delta > 0 ? '어제보다 조금 살아났어요' : '어제보다 조금 가라앉았어요',
      ),
    )
  }

  if (
    bestDomain &&
    worstDomain &&
    bestDomain !== worstDomain &&
    bestScore != null &&
    worstScore != null &&
    bestScore - worstScore >= 15
  ) {
    out.push(sig('balance', `${bestDomain}↑ · ${worstDomain}↓`))
  }

  out.push(
    sig(
      'action',
      pickAction({
        score,
        bestDomain,
        worstDomain,
        standoutDomain,
        standoutScore,
      }),
    ),
  )

  // 행동 포함 최대 3줄
  return out.slice(0, 3)
}

/** @deprecated 호환용 — signals를 한 문장으로 */
export function buildDailyComment(opts: DailySignalInput): string {
  return buildDailySignals(opts)
    .map((s) => s.text)
    .join('. ')
}
