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

/** 6대 생활 도메인 — 행동 카피 키 */
const DOMAIN_KEYS = ['연애', '대인', '재물', '학업', '직업', '건강'] as const
type ActionDomain = (typeof DOMAIN_KEYS)[number]

function isActionDomain(s: string | null | undefined): s is ActionDomain {
  return !!s && (DOMAIN_KEYS as readonly string[]).includes(s)
}

/**
 * 도메인별 행동 카피 (강도 4단).
 * hardCaution <30 / softCaution 30–44 / softLean 65–79 / hardLean ≥80
 */
const DOMAIN_ACTION: Record<ActionDomain, {
  hardCaution: string
  softCaution: string
  softLean: string
  hardLean: string
}> = {
  연애: {
    hardCaution: '감정 소모 큰 대화·결정은 오늘은 미뤄요',
    softCaution: '중요한 연애 대화는 짧게, 온도만 유지해요',
    softLean: '솔직한 한마디가 잘 통하는 날이에요',
    hardLean: '마음을 전하기 좋은 타이밍이에요',
  },
  대인: {
    hardCaution: '오해 나기 쉬운 날, 약속은 짧게 끊어요',
    softCaution: '말실수 조심하고, 오해는 바로 풀어요',
    softLean: '가벼운 만남·인사를 늘려보세요',
    hardLean: '인맥을 넓히기 좋은 날, 먼저 연락해 보세요',
  },
  재물: {
    hardCaution: '큰 지출·계약·투자 결정은 하루 미뤄요',
    softCaution: '충동 구매만 막고, 가계는 점검만 해요',
    softLean: '제안·협상 타이밍으로 쓰기 좋아요',
    hardLean: '실익 있는 제안이 오면 적극적으로 받아보세요',
  },
  학업: {
    hardCaution: '장시간 몰입은 피하고, 짧은 블록만 해요',
    softCaution: '집중 블록을 짧게 나눠보세요',
    softLean: '밀린 학습·정리를 밀어붙이기 좋아요',
    hardLean: '깊게 파고들기 좋은 날, 핵심 과제에 몰아요',
  },
  직업: {
    hardCaution: '중요 결정은 보류하고, 정리·백업만 해요',
    softCaution: '큰 결정은 오전에만, 오후는 실행에 남겨요',
    softLean: '성과 보이는 일에 시간을 몰아보세요',
    hardLean: '결과 내기 좋은 날, 눈에 보이는 성과를 노려요',
  },
  건강: {
    hardCaution: '일정 밀도를 확 낮추고 회복에 무게를 둬요',
    softCaution: '무리한 일정은 줄이고 휴식 슬롯을 넣어요',
    softLean: '몸을 풀어주는 루틴을 넣어보세요',
    hardLean: '컨디션 살리기 좋아요, 운동·수면을 챙겨요',
  },
}

/**
 * 강한 도메인↑ · 약한 도메인↓ 조합 (30쌍).
 * 갭이 클수록(≥25) hard, 그 외 soft 톤을 고른다.
 */
const CONTRAST_SOFT: Record<string, string> = {
  '연애|건강': '관계는 열되, 무리한 일정은 줄여요',
  '건강|연애': '회복을 먼저, 만남은 가볍게',
  '연애|재물': '마음은 열되, 큰돈 결정은 보류해요',
  '재물|연애': '실리는 챙기되 감정 소모는 줄여요',
  '연애|직업': '관계는 열어두되 업무 결정은 신중히',
  '직업|연애': '일 성과에 집중, 감정 이슈는 미뤄요',
  '연애|대인': '가까운 사이는 챙기고, 넓은 인맥은 과하게 안 벌려요',
  '대인|연애': '사람 만나되, 깊은 감정 대화는 짧게',
  '연애|학업': '마음은 열어두되, 공부·집중 시간은 지켜요',
  '학업|연애': '학습에 몰되, 관계 온도는 유지해요',

  '대인|건강': '약속은 짧게, 몸 상태는 꼭 챙기세요',
  '건강|대인': '회복 우선 — 만남은 필수만',
  '대인|재물': '사람은 만나되 금전 약속은 신중히',
  '재물|대인': '협상은 좋지만 관계 온도는 유지해요',
  '대인|직업': '네트워킹은 가볍게, 본업 마감은 지켜요',
  '직업|대인': '업무에 집중하되, 필요한 연락은 끊지 말아요',
  '대인|학업': '만남은 짧게, 집중 시간은 확보해요',
  '학업|대인': '공부 페이스를 지키며 인사는 가볍게',

  '재물|건강': '기회는 보되 몸 상태는 챙기세요',
  '건강|재물': '컨디션 회복이 우선이에요',
  '재물|직업': '실익은 챙기되, 무리한 업무 확장은 조심해요',
  '직업|재물': '성과에 집중하되, 큰 지출은 한번 더 봐요',
  '재물|학업': '돈 흐름은 보되, 학습 루틴은 깨지 말아요',
  '학업|재물': '공부에 몰되, 충동 지출만 막아요',

  '직업|건강': '성과는 내되 과로는 피하세요',
  '건강|직업': '페이스 조절이 먼저예요',
  '직업|학업': '실무 성과를 우선, 공부는 짧게만',
  '학업|직업': '학습에 몰되, 업무 데드라인은 놓치지 말아요',

  '학업|건강': '공부는 짧게, 휴식도 같이',
  '건강|학업': '컨디션 회복 후 집중해요',
}

const CONTRAST_HARD: Record<string, string> = {
  '연애|건강': '사람을 만나더라도 오늘은 무리하지 마세요',
  '건강|연애': '몸부터 살리고, 깊은 대화는 내일로',
  '연애|재물': '마음은 열되 큰 돈·약정은 절대 서두르지 말아요',
  '재물|연애': '돈 이야기는 해도, 감정 싸움은 피하세요',
  '연애|직업': '관계에 시간을 쓰되, 중요한 업무 결정은 보류해요',
  '직업|연애': '일 마감에 몰고, 감정 이슈는 퇴근 후로',
  '연애|대인': '가까운 한 명만 챙기고, 모임은 줄여요',
  '대인|연애': '사람 많은 자리는 OK, 둘만의 무거운 대화는 NO',
  '연애|학업': '만남보다 집중이 필요한 날 — 시간은 짧게만',
  '학업|연애': '핵심 공부부터 끝내고, 연락은 그다음에',

  '대인|건강': '약속은 최소화하고 컨디션을 지켜요',
  '건강|대인': '오늘은 사람보다 회복이 우선이에요',
  '대인|재물': '만남은 OK, 금전 약속·보증은 거절하세요',
  '재물|대인': '협상은 하되 관계 비용을 치르지 말아요',
  '대인|직업': '네트워킹보다 마감·산출물을 먼저',
  '직업|대인': '업무에 몰입하고, 불필요한 미팅은 줄여요',
  '대인|학업': '약속 줄이고 집중 블록을 지키세요',
  '학업|대인': '공부 모드 ON — 만남은 짧게만',

  '재물|건강': '기회보다 컨디션 — 몸 상하면 기회도 날아가요',
  '건강|재물': '지출·투자는 멈추고 회복에 집중하세요',
  '재물|직업': '돈 되는 일만 고르고, 과로는 거절해요',
  '직업|재물': '성과 내기 좋은 날 — 충동 지출만 막아요',
  '재물|학업': '실익은 챙기되 학습 루틴은 유지해요',
  '학업|재물': '공부 페이스를 지키고 큰 지출은 미뤄요',

  '직업|건강': '결과는 내되, 오늘은 야근·과로는 금지예요',
  '건강|직업': '무리한 업무는 미루고 페이스를 낮추세요',
  '직업|학업': '실무 산출물에 올인, 공부는 최소만',
  '학업|직업': '학습 깊게, 업무는 필수만 처리해요',

  '학업|건강': '짧게 공부하고 꼭 쉬세요',
  '건강|학업': '오늘은 공부보다 회복이 먼저예요',
}

const SCORE_FALLBACK = {
  veryHigh: '흐름이 좋아요 — 중요한 한 가지를 밀어붙여 보세요',
  high: '작은 진전 하나를 목표로 해보세요',
  mid: '오늘은 정리·점검을 해두면 내일 편해져요',
  low: '오늘은 회복·정리에 무게를 두세요',
  veryLow: '무리하지 말고, 필수만 하고 쉬어가세요',
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
  const tier = domainTier(score)
  if (tier === 'mid') return null
  return DOMAIN_ACTION[domain][tier]
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

  // 2) 가장 튀는 도메인 (50에서 먼 쪽) — 중간대(45–64)는 스킵
  if (standoutDomain && standoutScore != null) {
    const line = domainActionLine(standoutDomain, standoutScore)
    if (line) return line
  }

  // 3) 총점 + 최약/최강 도메인
  if (worstDomain && worstScore != null && score < 55) {
    const line = domainActionLine(worstDomain, Math.min(worstScore, 44))
    if (line) return line
    return DOMAIN_ACTION.건강.softCaution
  }
  if (bestDomain && bestScore != null && score >= 55) {
    const line = domainActionLine(bestDomain, Math.max(bestScore, 65))
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
