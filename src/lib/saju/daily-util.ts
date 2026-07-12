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

const SIGNAL_LABEL: Record<DailySignalKind, string> = {
  position: '위치',
  delta: '변화',
  balance: '균형',
  action: '조언',
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

/** 6대 생활 도메인 — 행동 카피 키 */
const DOMAIN_KEYS = ['연애', '대인', '재물', '학업', '직업', '건강'] as const
type ActionDomain = (typeof DOMAIN_KEYS)[number]

function isActionDomain(s: string | null | undefined): s is ActionDomain {
  return !!s && (DOMAIN_KEYS as readonly string[]).includes(s)
}

/**
 * 도메인별 행동 카피 (강도 5단)
 * 구체적인 행동을 제안하고, 은유·추상 표현은 쓰지 않는다.
 * hardCaution <30 / softCaution 30–44 / mid 45–64 / softLean 65–79 / hardLean ≥80
 */
const DOMAIN_ACTION: Record<ActionDomain, {
  hardCaution: string
  softCaution: string
  mid: string
  softLean: string
  hardLean: string
}> = {
  연애: {
    hardCaution: '서운한 말은 오늘 꺼내지 마세요',
    softCaution: '무거운 대화는 미루고, 안부만 건네요',
    mid: '가볍게 연락하고, 반응을 살펴보세요',
    softLean: '보고 싶은 사람에게 먼저 약속을 잡아 보세요',
    hardLean: '고백·화해처럼 미뤄 둔 말을 꺼내 보세요',
  },

  대인: {
    hardCaution: '사람 많은 자리는 줄이고, 민감한 말은 아껴요',
    softCaution: '필요한 연락만 하고, 약속은 짧게 잡아요',
    mid: '가벼운 대화와 안부로 관계를 이어가요',
    softLean: '먼저 연락하고, 편한 약속을 잡아 보세요',
    hardLean: '중요한 사람을 만나거나 새 인연을 만들어 보세요',
  },

  재물: {
    hardCaution: '큰 결제·계약은 오늘 미뤄요',
    softCaution: '새 지출은 줄이고, 돈 나간 곳부터 확인해요',
    mid: '예산 안에서 필요한 만큼만 써요',
    softLean: '가격과 조건을 비교하고, 조정을 요청해 보세요',
    hardLean: '미뤄 둔 협상이나 계약 조건을 적극적으로 조율해 보세요',
  },

  학업: {
    hardCaution: '새 진도는 미루고, 핵심만 짧게 복습해요',
    softCaution: '공부를 짧게 나눠, 한 부분만 끝내요',
    mid: '정해 둔 분량을 계획대로 채워요',
    softLean: '밀린 과제나 어려운 단원까지 끝내 보세요',
    hardLean: '시험·발표·제출처럼 중요한 공부에 몰입해 보세요',
  },

  직업: {
    hardCaution: '중요한 결정은 미루고, 꼭 필요한 일만 처리해요',
    softCaution: '새 일은 줄이고, 하던 일부터 마쳐요',
    mid: '우선순위를 정해, 계획한 일을 끝내요',
    softLean: '성과가 보이는 일을 먼저 추진해 보세요',
    hardLean: '제안·발표·협상처럼 중요한 일을 직접 이끌어 보세요',
  },

  건강: {
    hardCaution: '일정을 비우고 충분히 쉬어요',
    softCaution: '무리한 약속은 줄이고, 회복 시간을 챙겨요',
    mid: '식사·수분·수면을 평소대로 챙겨요',
    softLean: '산책이나 스트레칭으로 가볍게 움직여요',
    hardLean: '미뤄 둔 운동을 하거나 야외 활동을 즐겨 보세요',
  },
}

/**
 * 강한 도메인↑ · 약한 도메인↓ 조합 (30쌍)
 * soft: 강한 영역은 활용하고, 약한 영역은 조절한다.
 * hard: 강한 영역을 우선하고, 약한 영역은 미룬다.
 */
const CONTRAST_SOFT: Record<string, string> = {
  '연애|건강': '만남은 잡아도 좋아요. 일정은 여유 있게 잡아요',
  '건강|연애': '쉬는 시간을 먼저 챙기고, 연락은 가볍게 해요',
  '연애|재물': '마음은 전해도 좋아요. 큰돈 결정은 미뤄요',
  '재물|연애': '돈 이야기는 차분히 하고, 감정적인 말은 아껴요',
  '연애|직업': '마음은 표현하되, 중요한 업무 결정은 미뤄요',
  '직업|연애': '일을 먼저 마치고, 감정 이야기는 짧게 해요',
  '연애|대인': '가까운 사람 한 명을 챙기고, 모임은 줄여요',
  '대인|연애': '사람은 만나되, 연애 이야기는 가볍게 해요',
  '연애|학업': '연락은 편하게 하고, 공부 목표는 작게 잡아요',
  '학업|연애': '공부부터 끝내고, 연락은 그다음에 해요',

  '대인|건강': '약속은 잡아도 좋아요. 중간에 쉴 시간을 넣어요',
  '건강|대인': '쉬는 시간을 먼저 챙기고, 약속은 짧게 잡아요',
  '대인|재물': '사람은 만나도 좋아요. 돈 약속은 신중하게 해요',
  '재물|대인': '협상은 해도 좋아요. 무리한 부탁은 거절해요',
  '대인|직업': '만남은 잡되, 업무는 꼭 필요한 것만 챙겨요',
  '직업|대인': '일에 집중하고, 꼭 필요한 연락만 해요',
  '대인|학업': '사람은 만나도 좋아요. 공부는 짧게라도 챙겨요',
  '학업|대인': '공부 흐름을 지키고, 연락은 짧게 해요',

  '재물|건강': '금전 결정은 진행하되, 무리한 일정은 피하세요',
  '건강|재물': '컨디션부터 챙기고, 큰 지출은 미뤄요',
  '재물|직업': '조건은 따져보되, 일을 더 늘리지는 마세요',
  '직업|재물': '일에 집중하고, 큰 지출은 한 번 더 확인해요',
  '재물|학업': '돈 흐름은 살피고, 공부 목표는 작게 잡아요',
  '학업|재물': '공부에 집중하고, 충동구매는 줄여요',

  '직업|건강': '일은 하되, 야근과 과로는 피해요',
  '건강|직업': '속도를 낮추고, 무리한 업무는 미뤄요',
  '직업|학업': '일을 먼저 마치고, 공부는 짧게 해요',
  '학업|직업': '공부에 집중하되, 업무 마감은 놓치지 마세요',

  '학업|건강': '짧게 공부하고, 쉬는 시간도 챙겨요',
  '건강|학업': '먼저 쉬고, 컨디션이 괜찮을 때 공부해요',
}

const CONTRAST_HARD: Record<string, string> = {
  '연애|건강': '보고 싶은 사람은 만나되, 일찍 마치고 쉬어요',
  '건강|연애': '오늘은 푹 쉬고, 무거운 연애 이야기는 미뤄요',
  '연애|재물': '고백이나 화해는 시도해도 좋아요. 결제·계약은 미뤄요',
  '재물|연애': '금전 결정에 집중하고, 연애 갈등은 키우지 마세요',
  '연애|직업': '미뤄 둔 마음은 표현하고, 큰 업무 결정은 미뤄요',
  '직업|연애': '중요한 업무에 집중하고, 무거운 연애 대화는 미뤄요',
  '연애|대인': '둘만의 약속에 집중하고, 여러 사람 모임은 쉬어요',
  '대인|연애': '사람들과 어울리고, 무거운 연애 대화는 미뤄요',
  '연애|학업': '보고 싶은 사람에게 연락하고, 어려운 공부는 미뤄요',
  '학업|연애': '중요한 공부에 집중하고, 연애 대화는 짧게 해요',

  '대인|건강': '중요한 만남만 잡고, 오래 머물지는 마세요',
  '건강|대인': '오늘은 푹 쉬고, 만남은 꼭 필요한 것만 잡아요',
  '대인|재물': '만남은 이어가되, 돈을 빌리거나 보증하는 일은 미뤄요',
  '재물|대인': '조건부터 따져보고, 관계 때문에 양보하지 마세요',
  '대인|직업': '중요한 사람을 만나고, 큰 업무 결정은 미뤄요',
  '직업|대인': '중요한 일을 먼저 끝내고, 불필요한 미팅은 줄여요',
  '대인|학업': '중요한 만남에 집중하고, 공부 목표는 작게 잡아요',
  '학업|대인': '중요한 공부에 집중하고, 만남은 최소로 줄여요',

  '재물|건강': '금전 기회는 챙기되, 오래 끌거나 무리하지 마세요',
  '건강|재물': '오늘은 회복에 집중하고, 큰 결제·투자는 미뤄요',
  '재물|직업': '이득이 분명한 일만 고르고, 새 업무는 늘리지 마세요',
  '직업|재물': '성과 내는 일에 집중하고, 충동구매는 미뤄요',
  '재물|학업': '금전 결정에 집중하고, 어려운 공부는 미뤄요',
  '학업|재물': '중요한 공부부터 끝내고, 큰 지출은 미뤄요',

  '직업|건강': '중요한 일만 끝내고, 오늘은 야근하지 마세요',
  '건강|직업': '오늘은 회복을 우선하고, 큰 업무는 미뤄요',
  '직업|학업': '중요한 업무에 집중하고, 공부는 필요한 만큼만 해요',
  '학업|직업': '중요한 공부부터 끝내고, 업무는 필수만 처리해요',

  '학업|건강': '핵심만 공부하고, 중간마다 꼭 쉬어요',
  '건강|학업': '오늘은 충분히 쉬고, 어려운 공부는 미뤄요',
}

const SCORE_FALLBACK = {
  veryHigh: '가장 중요한 일 하나를 오늘 끝내 보세요',
  high: '작은 목표 하나를 정해 바로 시작해 보세요',
  mid: '하던 일을 하나씩 처리해요',
  low: '새 일은 벌이지 말고, 하던 일만 정리해요',
  veryLow: '꼭 할 일만 하고, 나머지는 쉬어요',
} as const

function domainTier(score: number): 'hardCaution' | 'softCaution' | 'mid' | 'softLean' | 'hardLean' {
  if (score < 30) return 'hardCaution'
  if (score < 45) return 'softCaution'
  if (score < 65) return 'mid'
  if (score < 80) return 'softLean'
  return 'hardLean'
}

function domainActionLine(domain: string, score: number): string | null {
  if (!isActionDomain(domain)) return null
  return DOMAIN_ACTION[domain][domainTier(score)]
}

function pickAction(opts: {
  score: number
  bestDomain?: string | null
  bestScore?: number | null
  worstDomain?: string | null
  worstScore?: number | null
  standoutDomain?: string | null
  standoutScore?: number | null
}): string {
  const {
    score,
    bestDomain,
    bestScore,
    worstDomain,
    worstScore,
    standoutDomain,
    standoutScore,
  } = opts

  // 1) 강·약 대비 — 갭 ≥15일 때 (균형 칩과 동일 문턱), 갭 ≥25면 강한 톤
  if (
    bestDomain &&
    worstDomain &&
    bestDomain !== worstDomain &&
    bestScore != null &&
    worstScore != null
  ) {
    const gap = bestScore - worstScore
    if (gap >= 15) {
      const key = `${bestDomain}|${worstDomain}`
      if (gap >= 25 && CONTRAST_HARD[key]) return CONTRAST_HARD[key]!
      if (CONTRAST_SOFT[key]) return CONTRAST_SOFT[key]!
      if (CONTRAST_HARD[key]) return CONTRAST_HARD[key]!
    }
  }

  // 2) 가장 튀는 도메인 (50에서 먼 쪽)
  if (standoutDomain && standoutScore != null) {
    const line = domainActionLine(standoutDomain, standoutScore)
    if (line) return line
  }

  // 3) 총점 + 최약/최강 도메인 — 실제 점수 그대로 반영
  if (worstDomain && worstScore != null && score < 55) {
    const line = domainActionLine(worstDomain, worstScore)
    if (line) return line
  }
  if (bestDomain && bestScore != null && score >= 55) {
    const line = domainActionLine(bestDomain, bestScore)
    if (line) return line
  }

  // 4) 총점 밴드 폴백
  if (score >= 80) return SCORE_FALLBACK.veryHigh
  if (score >= 65) return SCORE_FALLBACK.high
  if (score >= 45) return SCORE_FALLBACK.mid
  if (score >= 30) return SCORE_FALLBACK.low
  return SCORE_FALLBACK.veryLow
}

function sig(kind: DailySignalKind, text: string): DailySignal {
  return { kind, label: SIGNAL_LABEL[kind], text }
}

/**
 * 대표 카드용 소식 2~3줄 (칩·점수와 중복 없는 정보만).
 * 최대 3개: 위치(또는 변화) → 균형 → 행동.
 * 리스트 히어로는 변화 칩을 제외하고 쓴다(점수 ▲▼와 중복).
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
        delta > 0 ? '어제보다 기운이 크게 올랐어요' : '어제보다 기운이 크게 내려갔어요',
      ),
    )
  } else if (Math.abs(delta) >= 3) {
    out.push(
      sig(
        'delta',
        delta > 0 ? '어제보다 기운이 조금 올랐어요' : '어제보다 기운이 조금 내려갔어요',
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
        bestScore,
        worstDomain,
        worstScore,
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
