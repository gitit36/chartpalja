/**
 * Daily-fortune date math (KST) + rule-based one-liner copy.
 * No LLM: everything here is deterministic from the engine score.
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
 * e.g. days=7 → [6일 전 ... 어제, 오늘]. 어제 포함이라 전일 대비 등락도 계산 가능.
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

export type DeltaDirection = 'up' | 'down' | 'flat'

export function deltaDirection(delta: number): DeltaDirection {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

/** 도메인 → "좋은 운" 주제 (조사 포함). 예: 대인 → "사람과의 관계운은" */
const DOMAIN_GOOD_TOPIC: Record<string, string> = {
  연애: '연애운은',
  대인: '사람과의 관계운은',
  재물: '재물운은',
  학업: '학업·시험운은',
  직업: '직업운은',
  건강: '컨디션은',
}

/** 도메인 → "주의 운" 한 마디 (완결 절). 예: 건강 → "컨디션은 조금 흔들릴 수 있어요" */
const DOMAIN_CAUTION: Record<string, string> = {
  연애: '연애운은 살짝 엇갈릴 수 있어요',
  대인: '사람 관계는 조금 삐걱일 수 있어요',
  재물: '금전은 신중하게 보는 게 좋아요',
  학업: '집중력은 조금 흐트러질 수 있어요',
  직업: '직장 일은 성급한 결정을 피하는 게 좋아요',
  건강: '컨디션은 조금 흔들릴 수 있어요',
}

/**
 * 대표 차트용 한 줄 코멘트 (규칙 기반, LLM 비용 0).
 * "좋은 운(최고 도메인)은 좋지만, 주의 운(최저 도메인)은 …" + 점수별 조언 한 줄.
 */
export function buildDailyComment(opts: {
  score: number
  bestDomain?: string | null
  worstDomain?: string | null
}): string {
  const { score, bestDomain, worstDomain } = opts

  let advice: string
  if (score >= 75) advice = '오늘은 자신감 있게 움직여도 좋아요.'
  else if (score >= 55) advice = '오늘은 기회를 적극적으로 살려보세요.'
  else if (score >= 45) advice = '오늘은 무리하지 않는 선택이 좋아요.'
  else advice = '오늘은 한 박자 쉬어가는 게 좋아요.'

  const goodTopic = bestDomain ? DOMAIN_GOOD_TOPIC[bestDomain] : undefined
  const caution = worstDomain ? DOMAIN_CAUTION[worstDomain] : undefined

  if (goodTopic && caution && bestDomain !== worstDomain) {
    return `${goodTopic} 좋지만, ${caution}. ${advice}`
  }

  // best/worst 가 같거나 정보 부족 시 점수 기반 코멘트로 폴백
  let base: string
  if (score >= 75) base = '전반적으로 기운이 활짝 열리는 날이에요.'
  else if (score >= 55) base = '무난하게 흘러가는 하루예요.'
  else if (score >= 45) base = '조금은 조심스러운 하루예요.'
  else base = '한 박자 쉬어가면 좋은 날이에요.'
  return `${base} ${advice}`
}
