'use client'

import { useState, useMemo } from 'react'
import type { SajuReportJson } from '@/types/saju-report'
import { STEM_HANGUL, STEM_ELEMENT, elementToHangul } from '@/lib/saju/hanja-hangul'

interface FortuneCategory {
  id: string
  title: string
  subtitle: string
  content: string
  accentColor: string
  icon: string
}

const DAY_STEM_TEMPERAMENT: Record<string, { trait: string; detail: string }> = {
  '甲': {
    trait: '곧고 강한 리더 기질',
    detail: '큰 나무처럼 위로 뻗어가는 성장 본능이 강합니다. 정의감이 뚜렷하고 추진력이 좋지만, 때로 고집이 강해질 수 있어요. 조직에서 자연스럽게 중심 역할을 맡게 되는 타입입니다.',
  },
  '乙': {
    trait: '유연하고 끈질긴 생존 전략가',
    detail: '풀이나 덩굴처럼 환경에 적응하며 꾸준히 뿌리를 내리는 타입입니다. 겉으로는 부드럽지만 내면의 의지가 단단해요. 사람 사이에서 조율하는 능력이 탁월합니다.',
  },
  '丙': {
    trait: '밝고 화끈한 에너지의 소유자',
    detail: '태양처럼 주변을 환하게 비추는 존재감이 있습니다. 열정적이고 낙천적이며, 사람들을 끌어당기는 카리스마가 있어요. 다만 감정 기복이나 과열 주의가 필요한 시기도 있습니다.',
  },
  '丁': {
    trait: '섬세하고 깊이 있는 통찰력',
    detail: '촛불처럼 은은하면서도 집중적인 빛을 발합니다. 직관력이 뛰어나고 감수성이 풍부해요. 예술적 재능이나 학문적 깊이를 갖추기 쉬운 기질이며, 내면을 잘 다스릴수록 빛이 납니다.',
  },
  '戊': {
    trait: '묵직한 안정감과 포용력',
    detail: '큰 산처럼 흔들리지 않는 안정감이 핵심입니다. 신뢰를 주는 성격이라 주변에서 의지하는 사람이 많아요. 변화보다 지속 가능한 성장에 강하며, 중심을 잡아주는 역할에 적합합니다.',
  },
  '己': {
    trait: '수용력 높은 실속형 전략가',
    detail: '논밭의 흙처럼 다양한 것을 품고 키워내는 능력이 있습니다. 겸손하고 실용적이며, 디테일에 강해요. 겉으로 드러나지 않지만 꾸준히 실속을 챙기는 타입입니다.',
  },
  '庚': {
    trait: '단호하고 결단력 있는 실행가',
    detail: '쇠와 칼처럼 날카롭고 단단한 기질입니다. 결단력이 빠르고 실행력이 강해요. 정의로운 면이 있으나, 너무 강하게 밀어붙이면 마찰이 생길 수 있으니 유연함을 보완하면 좋습니다.',
  },
  '辛': {
    trait: '예리한 심미안과 완벽주의',
    detail: '보석처럼 정교하고 아름다움을 추구하는 기질입니다. 분석력과 심미안이 뛰어나며, 높은 기준을 가지고 있어요. 자기 관리에 철저하고, 디테일에서 차이를 만들어내는 타입입니다.',
  },
  '壬': {
    trait: '거침없는 도전 정신과 포용력',
    detail: '큰 강이나 바다처럼 넓고 깊은 기운입니다. 지적 호기심이 왕성하고 새로운 경험을 두려워하지 않아요. 사람을 품는 포용력이 크며, 큰 그림을 그리는 데 탁월합니다.',
  },
  '癸': {
    trait: '직관과 감성의 깊은 내면 세계',
    detail: '이슬이나 안개처럼 섬세하고 영적인 감수성을 지닌 기질입니다. 감정을 잘 읽고 상황 판단이 빠르며, 조용하지만 깊은 사고력을 가지고 있어요. 창의적 분야에서 빛을 발합니다.',
  },
}

const STRENGTH_FORTUNE: Record<string, string> = {
  '신강': '에너지가 넘치는 사주입니다. 적극적으로 목표를 향해 나아가되, 주변과의 조화를 의식하면 더 큰 성과를 얻을 수 있어요.',
  '신약': '섬세한 기운을 가진 사주입니다. 혼자 무리하기보다 좋은 사람, 좋은 환경을 택하는 전략이 인생 전반의 운을 끌어올립니다.',
  '중화': '균형 잡힌 사주로 어느 분야든 일정 수준 이상의 성과를 낼 수 있습니다. 한 분야에 깊이를 더하면 두각을 나타내기 좋은 구조입니다.',
}

function buildInnateTemperament(report: SajuReportJson): FortuneCategory {
  const dayStem = report?.천간지지?.천간?.일간
  const strength = report?.신강신약
  const yongheui = report?.용신희신
  const ohang = report?.오행분포

  const temperament = dayStem ? DAY_STEM_TEMPERAMENT[dayStem] : null
  const stemHangul = dayStem ? (STEM_HANGUL[dayStem] ?? dayStem) : ''
  const stemElement = dayStem ? (STEM_ELEMENT[dayStem] ?? '') : ''
  const elemHangul = stemElement ? elementToHangul(stemElement) : ''
  const strengthLabel = strength?.판정
  const yong = yongheui?.용신
  const heuiRaw = yongheui?.희신
  const heui = Array.isArray(heuiRaw) ? heuiRaw[0] : heuiRaw

  let ohangSummary = ''
  if (ohang && typeof ohang === 'object') {
    const entries = Object.entries(ohang)
      .filter(([, v]) => typeof v === 'number')
      .sort(([, a], [, b]) => (b as number) - (a as number))
    if (entries.length > 0) {
      const top = entries[0]!
      const topName = elementToHangul(top[0])
      ohangSummary = `오행 중 ${topName}(${top[0]})의 기운이 가장 강하게 작용하고 있어, `
      if (entries.length >= 2) {
        const second = entries[1]!
        const secondName = elementToHangul(second[0])
        ohangSummary += `${secondName}(${second[0]})이 보조적으로 뒷받침합니다. `
      }
    }
  }

  const parts: string[] = []
  if (dayStem && temperament) {
    parts.push(`일간 ${dayStem}(${stemHangul}) · ${elemHangul}(${stemElement})의 기질 — ${temperament.detail}`)
  }
  if (strengthLabel) {
    const strengthText = STRENGTH_FORTUNE[strengthLabel] ?? ''
    if (strengthText) parts.push(strengthText)
  }
  if (ohangSummary) {
    parts.push(ohangSummary)
  }
  if (yong || heui) {
    const yongText = yong ? `${elementToHangul(yong)}(${yong})` : ''
    const heuiText = heui ? `${elementToHangul(heui)}(${heui})` : ''
    parts.push(`부족한 기운을 채워주는 용신은 ${yongText || '—'}, 희신은 ${heuiText || '—'}입니다. 이 오행이 강해지는 시기에 운이 상승하는 경향이 있습니다.`)
  }

  const title = temperament
    ? `"${temperament.trait}" — 당신의 타고난 설계도`
    : '당신의 사주에 새겨진 타고난 기질'

  return {
    id: 'innate-temperament',
    title,
    subtitle: '일간·오행·신강신약으로 읽는 나의 핵심 기질',
    content: parts.length > 0
      ? parts.join('\n\n')
      : '사주 데이터를 기반으로 타고난 기질을 분석합니다.',
    accentColor: 'border-l-violet-500',
    icon: '🧬',
  }
}

function buildNewYearFortune(report: SajuReportJson): FortuneCategory {
  const currentYear = new Date().getFullYear()
  const sewoon = report?.세운
  const yearData = sewoon?.연도별
  const thisYearPillar = yearData ? (yearData as Record<string, string>)[String(currentYear)] : null

  let content = `${currentYear}년은 `
  if (thisYearPillar) {
    const stemChar = thisYearPillar[0] ?? ''
    const branchChar = thisYearPillar[1] ?? ''
    const stemH = STEM_HANGUL[stemChar] ?? stemChar
    const branchH = STEM_HANGUL[branchChar] ?? branchChar
    content += `${thisYearPillar}(${stemH}${branchH})년입니다. `
  }

  const strength = report?.신강신약?.판정
  const yong = report?.용신희신?.용신

  if (strength === '신강') {
    content += '에너지가 넘치는 해로, 적극적으로 기회를 잡되 과욕은 주의하세요. '
  } else if (strength === '신약') {
    content += '신중한 접근이 유리한 해입니다. 좋은 사람과 환경을 선택하는 것이 핵심이에요. '
  } else {
    content += '균형 잡힌 흐름 속에서 자신의 페이스를 유지하면 좋은 결과로 이어질 수 있습니다. '
  }

  if (yong) {
    content += `용신인 ${elementToHangul(yong)}(${yong})의 기운이 강해지는 달에 중요한 결정을 하면 유리합니다.`
  }

  return {
    id: 'new-year',
    title: `${currentYear}년, 당신에게 열리는 새로운 문`,
    subtitle: `올해 세운의 흐름과 주요 기운 분석`,
    content,
    accentColor: 'border-l-amber-500',
    icon: '🌅',
  }
}

function buildLifetimeFortune(report: SajuReportJson): FortuneCategory {
  const daewoon = report?.대운
  const pillars = daewoon?.대운기둥10

  const parts: string[] = []
  parts.push('대운은 10년 단위로 바뀌는 인생의 큰 흐름입니다. 각 대운마다 주어지는 기운이 달라지면서 삶의 국면이 전환됩니다.')

  if (pillars && Array.isArray(pillars) && pillars.length > 0) {
    const earlyLife = pillars.slice(0, 3)
    const midLife = pillars.slice(3, 6)
    const lateLife = pillars.slice(6)

    if (earlyLife.length > 0) {
      const earlyAges = earlyLife.map(p => `${p.start_age_years ?? '?'}~${p.end_age_years ?? '?'}세`).join(', ')
      parts.push(`초년운(${earlyAges}): 기반을 다지는 시기입니다. 이 시기의 경험이 이후 인생의 패턴을 만들어 갑니다.`)
    }
    if (midLife.length > 0) {
      const midAges = midLife.map(p => `${p.start_age_years ?? '?'}~${p.end_age_years ?? '?'}세`).join(', ')
      parts.push(`중년운(${midAges}): 열매를 맺는 핵심 시기입니다. 커리어와 관계에서 가장 역동적인 변화가 일어납니다.`)
    }
    if (lateLife.length > 0) {
      const lateAges = lateLife.map(p => `${p.start_age_years ?? '?'}~${p.end_age_years ?? '?'}세`).join(', ')
      parts.push(`후년운(${lateAges}): 축적된 경험이 빛을 발하는 시기입니다. 안정과 정리, 혹은 제2의 전성기가 올 수 있습니다.`)
    }
  }

  return {
    id: 'lifetime',
    title: '10년마다 바뀌는 당신의 인생 시나리오',
    subtitle: '대운으로 보는 삶의 큰 흐름과 전환점',
    content: parts.join('\n\n'),
    accentColor: 'border-l-blue-500',
    icon: '📜',
  }
}

function buildFortuneImprovement(report: SajuReportJson): FortuneCategory {
  const yong = report?.용신희신?.용신
  const heuiRaw2 = report?.용신희신?.희신
  const heui = Array.isArray(heuiRaw2) ? heuiRaw2[0] : heuiRaw2
  const strength = report?.신강신약?.판정

  const parts: string[] = []
  parts.push('개운법은 부족한 기운을 보충하고, 과한 기운을 다스려 전체 균형을 맞추는 실천 전략입니다.')

  const ELEMENT_TIPS: Record<string, string> = {
    '木': '초록색 계열의 옷이나 소품, 동쪽 방향, 아침 산책이나 식물 가꾸기가 도움이 됩니다. 나무나 숲이 있는 환경에서 에너지를 받을 수 있어요.',
    '火': '붉은색·보라색 계열 포인트, 남쪽 방향, 밝은 조명의 공간이 유리합니다. 열정을 발휘할 수 있는 활동이나 운동이 좋아요.',
    '土': '노란색·갈색 계열, 중앙 또는 넓은 공간, 안정적인 루틴이 도움이 됩니다. 요리나 텃밭 가꾸기처럼 대지와 관련된 활동이 에너지를 줍니다.',
    '金': '흰색·은색 계열, 서쪽 방향, 정리정돈과 규칙적인 생활이 유리합니다. 음악 감상이나 금속 소재의 액세서리도 기운 보충에 좋아요.',
    '水': '검정·남색 계열, 북쪽 방향, 물 근처 환경(수영, 온천, 바다 여행)이 도움이 됩니다. 명상이나 독서로 내면을 채우는 것도 효과적입니다.',
  }

  if (yong && ELEMENT_TIPS[yong]) {
    parts.push(`용신(${elementToHangul(yong)}, ${yong})을 강화하세요: ${ELEMENT_TIPS[yong]}`)
  }
  if (heui && heui !== yong && ELEMENT_TIPS[heui]) {
    parts.push(`희신(${elementToHangul(heui)}, ${heui})도 함께 챙기면 시너지가 납니다: ${ELEMENT_TIPS[heui]}`)
  }

  if (strength === '신강') {
    parts.push('에너지가 충분하므로, 사회 활동이나 봉사를 통해 기운을 흘려보내는 것이 균형에 도움이 됩니다.')
  } else if (strength === '신약') {
    parts.push('에너지를 충전하는 것이 중요합니다. 무리하기보다 규칙적인 휴식과 보양, 지지해주는 환경을 만드세요.')
  }

  return {
    id: 'improvement',
    title: '운을 끌어당기는 나만의 실천법',
    subtitle: '용신·희신 기반 맞춤형 개운 전략',
    content: parts.join('\n\n'),
    accentColor: 'border-l-emerald-500',
    icon: '🍀',
  }
}

export function FortuneAnalysisSection({ report }: { report: SajuReportJson | null }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const categories = useMemo<FortuneCategory[]>(() => {
    if (!report) return []
    return [
      buildInnateTemperament(report),
      buildNewYearFortune(report),
      buildLifetimeFortune(report),
      buildFortuneImprovement(report),
    ]
  }, [report])

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!report || categories.length === 0) return null

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-1 text-gray-800">운세 해설</h2>
      <p className="text-xs text-gray-500 mb-4">
        사주 데이터를 기반으로 분석한 맞춤형 해설입니다. 각 항목을 눌러 확인하세요.
      </p>
      <div className="space-y-3">
        {categories.map((cat) => {
          const isOpen = openIds.has(cat.id)
          return (
            <div
              key={cat.id}
              className={`rounded-xl border border-gray-100 overflow-hidden transition-all duration-200 ${
                isOpen ? 'shadow-sm' : ''
              }`}
            >
              <button
                onClick={() => toggle(cat.id)}
                className={`w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50/50 transition-colors ${
                  isOpen ? 'bg-gray-50/70' : ''
                }`}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">
                    {cat.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.subtitle}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div className={`px-4 pb-4 border-l-4 ${cat.accentColor} ml-4 mr-4 mb-2`}>
                  {cat.content.split('\n\n').map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
