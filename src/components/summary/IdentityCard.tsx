'use client'

import type { SajuReportJson } from '@/types/saju-report'
import { STEM_HANGUL, STEM_ELEMENT, elementToHangul } from '@/lib/saju/hanja-hangul'

const STRENGTH_INSIGHT: Record<string, string> = {
  '신강': '에너지가 풍부한 편입니다. 적극적으로 도전하고, 때로는 여유를 갖는 것도 좋아요.',
  '신약': '섬세하고 수용력이 좋습니다. 협력과 팀워크, 자기 관리가 강점을 살려 줍니다.',
  '중화': '균형 잡힌 기질입니다. 상황에 맞게 유연하게 대처하는 데 유리해요.',
}

export function IdentityCard({ report }: { report: SajuReportJson | null }) {
  const ganji = report?.천간지지
  const strength = report?.신강신약
  const yongheui = report?.용신희신

  const dayStem = ganji?.천간?.일간
  const label = strength?.판정
  const score = strength?.score
  const yong = yongheui?.용신
  const heui = yongheui?.희신

  if (!dayStem && !label && !yong && !heui) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">핵심 정체성</h2>
        <p className="text-sm text-gray-500">(추가 계산 예정)</p>
      </section>
    )
  }

  const dayStemHangul = dayStem ? STEM_HANGUL[dayStem] ?? dayStem : ''
  const dayElement = dayStem ? (STEM_ELEMENT[dayStem] ?? '土') : ''
  const dayElemHangul = elementToHangul(dayElement)
  const strengthInsight = label ? STRENGTH_INSIGHT[label] ?? '' : ''

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-1 text-gray-800">핵심 정체성</h2>
      <p className="text-xs text-gray-500 mb-4">
        사주의 중심인 일간과 기운의 강약, 추천하는 오행(용신·희신)입니다.
      </p>
      <div className="space-y-4">
        {dayStem != null && (
          <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">일간 (나의 기둥)</div>
            <p className="text-lg font-bold text-gray-800">
              {dayStem} <span className="text-gray-500 font-normal">({dayStemHangul})</span>
              {dayElement && (
                <span className="ml-2 text-sm font-medium text-gray-600">
                  · {dayElemHangul} ({dayElement})
                </span>
              )}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              일간은 사주에서 ‘나’를 나타내는 기준입니다. 성향과 대인관계 해석의 중심이 됩니다.
            </p>
          </div>
        )}
        {(label != null || score != null) && (
          <div className="rounded-xl p-4 bg-amber-50/50 border border-amber-100">
            <div className="text-xs text-gray-500 mb-1">신강·신약</div>
            <p className="text-base font-semibold text-gray-800">
              {label ?? '—'}
              {score != null && <span className="text-gray-500 font-normal ml-1">(점수 {score})</span>}
            </p>
            {strengthInsight && (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{strengthInsight}</p>
            )}
          </div>
        )}
        {(yong != null || heui != null) && (
          <div className="rounded-xl p-4 bg-emerald-50/50 border border-emerald-100">
            <div className="text-xs text-gray-500 mb-1">용신 · 희신</div>
            <p className="text-sm text-gray-800">
              <span className="font-semibold">용신</span> {yong ?? '—'}
              <span className="text-gray-400 mx-2">/</span>
              <span className="font-semibold">희신</span> {heui ?? '—'}
            </p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              용신은 보완하면 좋은 오행, 희신은 도움이 되는 오행입니다. 생활·직업·관계에서 참고해 보세요.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
