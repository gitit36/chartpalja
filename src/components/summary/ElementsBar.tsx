'use client'

import type { SajuReportJson } from '@/types/saju-report'
import { ELEMENT_BG, elementToHangul } from '@/lib/saju/hanja-hangul'

const ORDER = ['木', '火', '土', '金', '水'] as const

const ELEMENT_INSIGHT: Record<string, { short: string; tip: string }> = {
  '木': { short: '성장·인자함', tip: '목이 많으면 유연한 사고와 포용력이 강점입니다. 때로는 결단을 앞당겨 보세요.' },
  '火': { short: '열정·빛', tip: '화가 많으면 표현력과 리더십이 돋보입니다. 과열을 막기 위해 휴식도 챙기세요.' },
  '土': { short: '안정·신뢰', tip: '토가 많으면 차분함과 신뢰가 무기입니다. 새로운 시도를 두려워하지 마세요.' },
  '金': { short: '결단·정의', tip: '금이 많으면 원칙과 추진력이 뛰어납니다. 유연한 소통이 보완점이 될 수 있어요.' },
  '水': { short: '지혜·적응', tip: '수가 많으면 직관과 학습 능력이 좋습니다. 한 가지에 깊이 몰입해 보세요.' },
}

export function ElementsBar({ report }: { report: SajuReportJson | null }) {
  const counts = report?.오행분포
  if (!counts || typeof counts !== 'object') {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">오행 분포</h2>
        <p className="text-sm text-gray-500">(추가 계산 예정)</p>
      </section>
    )
  }

  const values = ORDER.map((k) => (counts[k] ?? 0) as number)
  const max = Math.max(...values, 1)
  const total = values.reduce((a, b) => a + b, 0)
  const dominantIdx = values.indexOf(Math.max(...values))
  const dominantKey = ORDER[dominantIdx]!
  const insight = ELEMENT_INSIGHT[dominantKey]
  const labelHangul = elementToHangul(dominantKey)

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-1 text-gray-800">오행 분포</h2>
      <p className="text-xs text-gray-500 mb-4">
        사주에 담긴 다섯 기운의 비율입니다. 기질과 성향에 영향을 줍니다.
      </p>
      <div className="space-y-3">
        {ORDER.map((key, i) => {
          const v = values[i]!
          const pct = max > 0 ? Math.round((v / max) * 100) : 0
          const share = total > 0 ? Math.round((v / total) * 100) : 0
          const bg = ELEMENT_BG[key] ?? 'bg-gray-100 border-2 border-gray-400 text-gray-800'
          const isDominant = i === dominantIdx
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-8 shrink-0">
                {elementToHangul(key)}{isDominant ? ' ★' : ''}
              </span>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-all ${isDominant ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    background: key === '木' ? 'linear-gradient(90deg,#dcfce7,#86efac)' :
                      key === '火' ? 'linear-gradient(90deg,#fee2e2,#fca5a5)' :
                      key === '土' ? 'linear-gradient(90deg,#fef3c7,#fcd34d)' :
                      key === '金' ? 'linear-gradient(90deg,#e5e7eb,#9ca3af)' :
                      'linear-gradient(90deg,#dbeafe,#93c5fd)',
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">{v} · {share}%</span>
            </div>
          )
        })}
      </div>
      {insight && (
        <div
          className={`mt-4 rounded-xl p-4 bg-gray-50 border-l-4 ${
            dominantKey === '木' ? 'border-l-green-500' :
            dominantKey === '火' ? 'border-l-red-500' :
            dominantKey === '土' ? 'border-l-amber-500' :
            dominantKey === '金' ? 'border-l-gray-500' : 'border-l-blue-500'
          }`}
        >
          <p className="text-sm font-medium text-gray-800 mb-0.5">
            가장 많은 오행: <span className="font-semibold">{labelHangul}</span> ({insight.short})
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">{insight.tip}</p>
        </div>
      )}
    </section>
  )
}
