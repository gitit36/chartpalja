/**
 * saju_tips.md 에서 선별·순화한 해설 참고 카드.
 * 전량 주입이 아니라 원국/대운 조건에 맞는 소수만 프롬프트에 넣는다.
 */
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, DaewoonBlock } from '@/types/chart'
import { calcManAgeOrYearDiff } from '@/lib/saju/man-age'

export type TipUseFor =
  | '성향'
  | '성격'
  | '직업'
  | '재물'
  | '관계'
  | '건강'
  | '개운'
  | '인생'

export interface SajuTipCard {
  id: string
  /** 어떤 해설 섹션에 쓰기 좋은지 힌트 */
  useFor: TipUseFor[]
  /** 프롬프트에 넣을 순화 문장 (단정·혐오·폭력 표현 배제) */
  tip: string
  priority?: number
  when: TipWhen
}

export interface TipWhen {
  always?: boolean
  dayStems?: string[]
  dayBranches?: string[]
  monthBranches?: string[]
  /** 오행 글자 木火土金水 — 분포가 상대적으로 많을 때 */
  elementStrong?: string[]
  /** 오행이 없거나 매우 약할 때 */
  elementWeak?: string[]
  /** 원국 십성에 포함 */
  hasSipseong?: string[]
  /** 원국 십성에 거의/전혀 없음 */
  missingSipseong?: string[]
  /** 신강/신약 계열 */
  strength?: Array<'신강' | '신약'>
  /** 신살 이름 부분 문자열 */
  shinsalIncludes?: string[]
  /** 현재 대운 천간 십성 */
  daewoonSipseong?: string[]
  /** 현재 대운 기신부합이 양수일 때만 (기신운 성격) */
  daewoonGishinPositive?: boolean
}

export interface TipMatchContext {
  dayStem: string
  dayBranch: string
  monthBranch: string
  ohang: Record<string, number>
  sipseong: Set<string>
  strength: '신강' | '신약' | '중화' | ''
  shinsalText: string
  daewoonStemGod: string
  daewoonGishin: number
}

const STEM_HANGUL: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  갑: '갑', 을: '을', 병: '병', 정: '정', 무: '무',
  기: '기', 경: '경', 신: '신', 임: '임', 계: '계',
}

const BRANCH_HANGUL: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
  자: '자', 축: '축', 인: '인', 묘: '묘', 진: '진', 사: '사',
  오: '오', 미: '미', 유: '유', 술: '술', 해: '해',
}

const TEN_GOD_KR: Record<string, string> = {
  比肩: '비견', 劫財: '겁재', 食神: '식신', 傷官: '상관',
  偏財: '편재', 正財: '정재', 七殺: '편관', 偏官: '편관',
  正官: '정관', 偏印: '편인', 正印: '정인',
  비견: '비견', 겁재: '겁재', 식신: '식신', 상관: '상관',
  편재: '편재', 정재: '정재', 편관: '편관', 칠살: '편관',
  정관: '정관', 편인: '편인', 정인: '정인',
}

/** 안전·유용성 기준으로 선별한 카드 (saju_tips.md 기반 순화) */
export const SAJU_TIP_CARDS: SajuTipCard[] = [
  // ── 일간 ──
  {
    id: 'stem-eul',
    useFor: ['성향', '성격', '직업'],
    priority: 2,
    when: { dayStems: ['을'] },
    tip: '을목 일간은 꾸준히 애쓰고, 타고난 사회성·감각이 돋보이는 경우가 많아요. 다만 “열심히”가 과하면 스스로를 갈아넣기 쉬우니 페이스 조절을 조언에 녹이세요.',
  },
  {
    id: 'stem-sin',
    useFor: ['성향', '성격', '관계'],
    priority: 2,
    when: { dayStems: ['신'] },
    tip: '신금 일간은 겉으로는 도도해 보여도, 의리와 통찰이 강한 편으로 읽히는 경우가 많아요. 차가운 인상 뒤에 있는 속정을 성격 섹션에서 짚어주면 좋아요.',
  },
  {
    id: 'stem-im-gye-busy',
    useFor: ['성향', '건강', '개운'],
    priority: 1,
    when: { dayStems: ['임', '계'], elementWeak: ['土'] },
    tip: '수일간에 토 기운이 약하면 바쁘게만 흘러가기 쉬워요. “나를 위한 시간”을 의식적으로 확보하라는 개운 조언을 넣으면 잘 맞습니다.',
  },

  // ── 월지 ──
  {
    id: 'month-sa',
    useFor: ['성향', '관계'],
    priority: 2,
    when: { monthBranches: ['사'] },
    tip: '월지가 사화면 어디에 가도 적응을 잘하고 사랑받는 흐름이 나오기 쉬워요. 기본 성향·관계에서 “환경 적응력”을 강점으로 언급해 보세요.',
  },
  {
    id: 'month-yu',
    useFor: ['성향', '직업', '성격'],
    priority: 2,
    when: { monthBranches: ['유'] },
    tip: '월지 유금은 본질을 빠르게 파악하는 감각이 뛰어난 편이에요. 직업·성격에서 “핵심을 꿰뚫는 눈”으로 표현하면 설득력이 생겨요.',
  },
  {
    id: 'month-ja',
    useFor: ['개운', '건강', '성향'],
    priority: 2,
    when: { monthBranches: ['자'] },
    tip: '월지 자수면 바깥일·외부 반응에 에너지를 너무 쓰기 쉬워요. 여유와 자기 루틴을 지키라는 개운 조언이 잘 맞습니다.',
  },

  // ── 일지 (성별 비특정, 부드러운 관찰) ──
  {
    id: 'day-ja',
    useFor: ['관계'],
    priority: 1,
    when: { dayBranches: ['자'] },
    tip: '일지 자수는 관계에서 “한 사람에게만”보다 여러 흐름이 동시에 생기는 느낌이 나오기 쉬워요. 단정하지 말고 “여지를 넓게 두는 편” 정도로만 쓰세요.',
  },
  {
    id: 'day-myo',
    useFor: ['관계'],
    priority: 1,
    when: { dayBranches: ['묘'] },
    tip: '일지 묘목은 한 사람과 오래 가는 관계 패턴이 나오기 쉬운 편이에요. 관계 섹션에서 안정·지속 쪽으로 읽어볼 수 있어요.',
  },
  {
    id: 'day-yu-rel',
    useFor: ['관계', '성격'],
    priority: 1,
    when: { dayBranches: ['유'] },
    tip: '일지 유금은 다양한 사람을 수용하는 폭이 넓은 편이에요. 관계에서 “취향이 넓다”기보다 “사람 스펙트럼이 넓다”로 풀어주세요.',
  },

  // ── 십성 ──
  {
    id: 'sip-pyeongwan',
    useFor: ['성향', '개운', '건강'],
    priority: 2,
    when: { hasSipseong: ['편관'] },
    tip: '편관이 보이면 “나를 먼저 챙기는 기준”이 중요해요. 취미·루틴처럼 나를 우선하는 시간이 개운에 도움이 된다고 조언해 주세요.',
  },
  {
    id: 'sip-sanggwan',
    useFor: ['성향', '성격', '관계'],
    priority: 2,
    when: { hasSipseong: ['상관'] },
    tip: '상관이 있으면 말은 날카로워 보여도 마음은 따뜻한 편으로 오해받기 쉬워요. 표현 방식과 속마음의 간극을 성격·관계에서 짚어주면 좋아요.',
  },
  {
    id: 'sip-siksin',
    useFor: ['관계', '성격'],
    priority: 1,
    when: { hasSipseong: ['식신'] },
    tip: '식신이 두드러지면 관계가 비교적 길게 가는 흐름이 나오기 쉬워요. “오래 가는 편”을 단정하지 말고 경향으로만 쓰세요.',
  },
  {
    id: 'sip-mu-inseong',
    useFor: ['개운', '성격', '관계'],
    priority: 3,
    when: { missingSipseong: ['정인', '편인'] },
    tip: '인성이 거의 없으면 의지·수용을 연습하는 게 개운에 도움이 돼요. “혼자 다 버티기”보다 기대는 법을 배우라는 톤으로.',
  },
  {
    id: 'sip-mu-siksang',
    useFor: ['개운', '성격'],
    priority: 3,
    when: { missingSipseong: ['식신', '상관'] },
    tip: '식상이 약하면 자기표현·자기보호를 연습하는 게 좋아요. 개운법에서 “마음에 있는 말을 안전한 방식으로 꺼내보기”를 제안해 보세요.',
  },
  {
    id: 'sip-mu-jaeseong',
    useFor: ['개운', '재물', '관계'],
    priority: 2,
    when: { missingSipseong: ['정재', '편재'] },
    tip: '재성이 약하면 타인의 의견·감각을 궁금해하는 연습이 도움이 돼요. 재물·관계에서 “나만의 기준만으로 닫히지 않기”를 조언으로.',
  },
  {
    id: 'sip-mu-gwanseong',
    useFor: ['개운', '직업'],
    priority: 2,
    when: { missingSipseong: ['정관', '편관'] },
    tip: '관성이 약하면 내 틀만 고집하기보다 사회적 기준·규칙을 참고하는 연습이 개운에 도움이 됩니다.',
  },
  {
    id: 'sip-mu-bigyeop',
    useFor: ['개운', '관계'],
    priority: 2,
    when: { missingSipseong: ['비견', '겁재'] },
    tip: '비겁이 약하면 나만 챙기기보다 옆 사람을 챙길 때 운이 순환하기 쉬워요. 관계·개운에서 “나눔의 균형”을 말해 주세요.',
  },
  {
    id: 'sip-pyeonin-jaeseong',
    useFor: ['성격', '개운', '재물'],
    priority: 2,
    when: { hasSipseong: ['편인'] },
    tip: '편인이 있으면 통찰은 좋지만, 재성이 과하면 정신적 스트레스가 커지기 쉬워요. “현실 감각(재성)은 적당히”를 균형 조언으로.',
  },

  // ── 신강/신약 ──
  {
    id: 'ss-singang',
    useFor: ['성격', '건강', '개운'],
    priority: 3,
    when: { strength: ['신강'] },
    tip: '신강 쪽이면 감정을 오래 품고 버티는 편이라, 묵은 기운이 쌓이기 쉬워요. 건강·개운에서 “표현·환기”를 권하는 톤이 맞습니다.',
  },
  {
    id: 'ss-sinjak',
    useFor: ['성격', '건강', '개운'],
    priority: 3,
    when: { strength: ['신약'] },
    tip: '신약 쪽이면 완벽주의로 스스로를 몰아붙이기 쉬워요. “60점짜리 실행”을 허용하라는 개운 조언이 잘 먹힙니다.',
  },

  // ── 오행 ──
  {
    id: 'oh-mok-strong',
    useFor: ['성향', '직업', '건강'],
    priority: 2,
    when: { elementStrong: ['木'] },
    tip: '목 기운이 많으면 워커홀릭·성장 지향이 강해지기 쉬워요. 직업 강점으로 쓰되, 휴식 부족 리스크도 같이 짚어 주세요.',
  },
  {
    id: 'oh-su-weak',
    useFor: ['개운', '성향', '건강'],
    priority: 3,
    when: { elementWeak: ['水'] },
    tip: '물 기운이 약하면 바쁨에 치여 “나를 위한 시간”이 비기 쉬워요. 유연성·여백을 만드는 개운(휴식, 취미, 밤 시간 루틴)을 제안하세요.',
  },
  {
    id: 'oh-geum-weak',
    useFor: ['개운', '성격'],
    priority: 2,
    when: { elementWeak: ['金'] },
    tip: '금 기운이 약하면 결단이 늦어지거나 경계를 못 긋기 쉬워요. 작은 결정부터 끊는 연습이 개운에 도움이 됩니다.',
  },
  {
    id: 'oh-hwa-strong',
    useFor: ['성향', '관계'],
    priority: 1,
    when: { elementStrong: ['火'] },
    tip: '화 기운이 왕하면 가만히 있어도 주목받기 쉬운 편이에요. 성향에서 “존재감”을 강점으로, 과열·번아웃은 주의로 균형 있게.',
  },

  // ── 신살 ──
  {
    id: 'sal-dohwa',
    useFor: ['관계', '성향'],
    priority: 2,
    when: { shinsalIncludes: ['도화'] },
    tip: '도화가 있으면 사람을 끌어당기는 매력이 강하고, 가까운 사이에서도 “자주 보고 싶은” 느낌이 생기기 쉬워요. 매력과 경계의 균형을 조언하세요.',
  },
  {
    id: 'sal-hongyeom',
    useFor: ['관계', '성향'],
    priority: 1,
    when: { shinsalIncludes: ['홍염'], elementStrong: ['水'] },
    tip: '홍염이 있고 수 기운이 받쳐주면, 조용해도 끌리는 포인트가 있는 편으로 읽히기 쉬워요. 과한 성적 단정은 금지하고 매력·분위기 정도로만.',
  },

  // ── 대운 (기신 성격일 때) ──
  {
    id: 'dw-geopjae',
    useFor: ['인생', '개운', '재물', '관계'],
    priority: 4,
    when: { daewoonSipseong: ['겁재'], daewoonGishinPositive: true },
    tip: '지금 대운이 겁재 쪽이고 부담 기운이 크면, 관계·금전에서 변수가 커지기 쉬워요. “안전 모드”(큰 거래·무리한 선택 자제, 생활 리듬 안정)를 개운 핵심으로.',
  },
  {
    id: 'dw-pyeonin',
    useFor: ['인생', '개운', '관계'],
    priority: 4,
    when: { daewoonSipseong: ['편인'], daewoonGishinPositive: true },
    tip: '편인 대운에 부담이 크면 판단이 흐려지고 회피·비현실로 기울기 쉬워요. 공부·자격·루틴처럼 “꽂혀서 쌓는 일”로 풀고, 큰 관계 결정은 신중하라는 조언이 맞습니다.',
  },
  {
    id: 'dw-pyeongwan',
    useFor: ['인생', '개운', '건강'],
    priority: 4,
    when: { daewoonSipseong: ['편관'], daewoonGishinPositive: true },
    tip: '편관 대운에 부담이 크면 예민함·피해의식이 커지기 쉬워요. 몸·마음 건강을 챙기고, 봉사·기부·돌봄처럼 마음을 유하게 하는 활동이 개운에 도움이 됩니다.',
  },

  // ── 결핍 리프레임 / 일반 개운 ──
  {
    id: 'reframe-wealth-weak',
    useFor: ['재물', '개운', '관계'],
    priority: 2,
    when: { missingSipseong: ['정재', '편재'] },
    tip: '재성이 약해 “돈복이 약하다”로만 읽지 마세요. 사람·자아실현 쪽에서 채우는 구조일 수 있으니, 비교 대신 “내게 있는 복”을 쓰는 리프레임을 넣어 주세요.',
  },
  {
    id: 'gaeun-reading',
    useFor: ['개운'],
    priority: 0,
    when: { always: true },
    tip: '개운법에는 “자기이해”(독서·기록·상담 등)가 거의 모든 사주에 무난히 도움이 됩니다. 추상적 개운보다 실행 가능한 한 가지로 구체화하세요.',
  },
  {
    id: 'tone-projection',
    useFor: ['성격', '관계', '개운'],
    priority: 0,
    when: { always: true },
    tip: '관계 갈등은 상대의 투사일 수도, 나의 투사일 수도 있어요. “상대 말 전부를 내 문제로 삼지 않기 / 내가 꽂히는 지점은 내 이슈일 수 있음”을 관계·성격에 부드럽게 녹이세요.',
  },
]

function normStem(raw: string): string {
  return STEM_HANGUL[raw] ?? raw
}

function normBranch(raw: string): string {
  return BRANCH_HANGUL[raw] ?? raw
}

function normGod(raw: string): string {
  const cleaned = raw.replace(/[\(（][^)）]*[\)）]/g, '').trim()
  return TEN_GOD_KR[cleaned] ?? TEN_GOD_KR[raw] ?? cleaned
}

function collectSipseong(report: SajuReportJson): Set<string> {
  const out = new Set<string>()
  const detail = report.오행십성_상세
  if (!detail) return out
  for (const s of detail.천간 ?? []) {
    if (s.ten_god) out.add(normGod(s.ten_god))
  }
  const jiji = detail['지지(지장간포함)'] ?? detail.지지_지장간포함 ?? []
  for (const b of jiji) {
    for (const hs of b.hidden_stems ?? []) {
      if (hs.ten_god) out.add(normGod(hs.ten_god))
    }
  }
  return out
}

function strengthBucket(verdict: string | undefined): TipMatchContext['strength'] {
  if (!verdict) return ''
  if (/극왕|태강|신강/.test(verdict)) return '신강'
  if (/극약|태약|신약/.test(verdict)) return '신약'
  if (/중화|중화신/.test(verdict)) return '중화'
  return ''
}

function currentDaewoon(report: SajuReportJson, birthYear: number, birthDate?: string | null): DaewoonBlock | null {
  const age = calcManAgeOrYearDiff(birthDate, birthYear)
  const fromChart = (report.chartData as ChartPayload | undefined)?.대운기둥10
  const blocks = fromChart?.length
    ? fromChart
    : (report.대운?.대운기둥10 as DaewoonBlock[] | undefined)
  if (!blocks?.length) return null
  return blocks.find(b => (b.start_age_years ?? 0) <= age && age <= (b.end_age_years ?? 999)) ?? null
}

export function buildTipMatchContext(
  report: SajuReportJson,
  opts?: { birthYear?: number },
): TipMatchContext {
  const won = report.만세력_사주원국
  const day = won?.일주 ?? ''
  const month = won?.월주 ?? ''
  const inp = report.입력정보 ?? {}
  const rawBd = (inp as Record<string, unknown>).birth_date
  const bdStr = typeof rawBd === 'string' ? rawBd : ''
  const bdSlice = bdStr ? bdStr.slice(0, 4) : '1990'
  const birthYear = opts?.birthYear
    ?? parseInt(String((inp as Record<string, unknown>).year ?? bdSlice), 10)

  const ohangRaw = (report.오행분포 ?? {}) as Record<string, number>
  const ohang: Record<string, number> = {
    木: Number(ohangRaw['木'] ?? ohangRaw['목'] ?? 0) || 0,
    火: Number(ohangRaw['火'] ?? ohangRaw['화'] ?? 0) || 0,
    土: Number(ohangRaw['土'] ?? ohangRaw['토'] ?? 0) || 0,
    金: Number(ohangRaw['金'] ?? ohangRaw['금'] ?? 0) || 0,
    水: Number(ohangRaw['水'] ?? ohangRaw['수'] ?? 0) || 0,
  }

  const dw = currentDaewoon(report, birthYear, bdStr || null)
  const shinsal = report.신살길성
  const shinsalText = shinsal && typeof shinsal === 'object'
    ? Object.keys(shinsal).join(' ')
    : ''

  return {
    dayStem: day.length >= 1 ? normStem(day[0]!) : '',
    dayBranch: day.length >= 2 ? normBranch(day[1]!) : '',
    monthBranch: month.length >= 2 ? normBranch(month[1]!) : '',
    ohang,
    sipseong: collectSipseong(report),
    strength: strengthBucket(report.신강신약?.판정),
    shinsalText,
    daewoonStemGod: dw?.십성_천간 ? normGod(String(dw.십성_천간)) : '',
    daewoonGishin: typeof dw?.기신부합 === 'number' ? dw.기신부합 : 0,
  }
}

function isElementStrong(ohang: Record<string, number>, el: string): boolean {
  const vals = Object.values(ohang)
  const avg = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1)
  return (ohang[el] ?? 0) >= Math.max(avg * 1.25, avg + 0.8, 1.5)
}

function isElementWeak(ohang: Record<string, number>, el: string): boolean {
  return (ohang[el] ?? 0) <= 0.15
}

function cardMatches(card: SajuTipCard, ctx: TipMatchContext): boolean {
  const w = card.when
  if (w.always) return true
  if (w.dayStems?.length && !w.dayStems.includes(ctx.dayStem)) return false
  if (w.dayBranches?.length && !w.dayBranches.includes(ctx.dayBranch)) return false
  if (w.monthBranches?.length && !w.monthBranches.includes(ctx.monthBranch)) return false
  if (w.strength?.length) {
    if (ctx.strength !== '신강' && ctx.strength !== '신약') return false
    if (!w.strength.includes(ctx.strength)) return false
  }
  if (w.elementStrong?.length && !w.elementStrong.every(el => isElementStrong(ctx.ohang, el))) return false
  if (w.elementWeak?.length && !w.elementWeak.every(el => isElementWeak(ctx.ohang, el))) return false
  if (w.hasSipseong?.length && !w.hasSipseong.some(s => ctx.sipseong.has(s))) return false
  if (w.missingSipseong?.length) {
    // 그룹 전체가 비어 있을 때 (정인+편인 모두 없음 등)
    if (!w.missingSipseong.every(s => !ctx.sipseong.has(s))) return false
  }
  if (w.shinsalIncludes?.length) {
    if (!w.shinsalIncludes.some(s => ctx.shinsalText.includes(s))) return false
  }
  if (w.daewoonSipseong?.length) {
    if (!w.daewoonSipseong.includes(ctx.daewoonStemGod)) return false
  }
  if (w.daewoonGishinPositive && !(ctx.daewoonGishin > 0.3)) return false
  return true
}

/**
 * 원국·현재 대운에 맞는 팁 2~4장 선택.
 * always 카드는 최대 1장, 고우선순위(대운/결핍)를 먼저.
 */
export function selectSajuTips(
  report: SajuReportJson,
  opts?: { birthYear?: number; limit?: number },
): SajuTipCard[] {
  const limit = opts?.limit ?? 4
  const ctx = buildTipMatchContext(report, opts)
  const matched = SAJU_TIP_CARDS
    .filter(c => cardMatches(c, ctx))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  const picked: SajuTipCard[] = []
  let alwaysUsed = false
  const usedUseFor = new Set<string>()

  for (const card of matched) {
    if (picked.length >= limit) break
    if (card.when.always) {
      if (alwaysUsed) continue
      alwaysUsed = true
    }
    // 같은 useFor만 반복되지 않게 살짝 다양성
    const primary = card.useFor[0] ?? ''
    if (primary && usedUseFor.has(primary) && (card.priority ?? 0) < 3) continue
    picked.push(card)
    for (const u of card.useFor) usedUseFor.add(u)
  }

  // always 미포함이면 하나 보강
  if (picked.length < limit && !alwaysUsed) {
    const fallback = matched.find(c => c.when.always)
    if (fallback) picked.push(fallback)
  }

  return picked.slice(0, limit)
}

export function formatTipsForPrompt(tips: SajuTipCard[]): string {
  if (!tips.length) return ''
  const lines = tips.map((t, i) => {
    const tags = t.useFor.join('/')
    return `${i + 1}. [${tags}] ${t.tip}`
  })
  return lines.join('\n')
}

/** 디버그/로그용 짧은 요약 */
export function describeTipContext(ctx: TipMatchContext): string {
  const dw = ctx.daewoonStemGod
    ? `${ctx.daewoonStemGod}(기신 ${ctx.daewoonGishin.toFixed(1)})`
    : '없음'
  return `일간 ${ctx.dayStem}${ctx.dayBranch} / 월지 ${ctx.monthBranch} / ${ctx.strength || '강도미상'} / 대운십성 ${dw}`
}