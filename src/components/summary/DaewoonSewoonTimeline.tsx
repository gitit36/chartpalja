'use client'

import type { SajuReportJson } from '@/types/saju-report'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'

export function DaewoonSewoonTimeline({ report }: { report: SajuReportJson | null }) {
  const daewoon = report?.대운?.대운기둥10
  const sewoon = report?.세운?.연도별

  const nowYear = new Date().getFullYear()
  const sewoonYears = sewoon
    ? Object.keys(sewoon)
        .map(Number)
        .filter((y) => y >= nowYear - 5 && y <= nowYear + 5)
        .sort((a, b) => a - b)
    : []

  const hasDaewoon = Array.isArray(daewoon) && daewoon.length > 0
  const hasSewoon = sewoonYears.length > 0

  if (!hasDaewoon && !hasSewoon) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">대운 · 세운</h2>
        <p className="text-sm text-gray-500">(추가 계산 예정)</p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-1 text-gray-800">대운 · 세운</h2>
      <p className="text-xs text-gray-500 mb-4">
        대운은 약 10년 단위의 흐름, 세운은 연도별 기운입니다. 한자 옆에 한글 읽기를 함께 표기했습니다.
      </p>
      <div className="space-y-5">
        {hasDaewoon && (
          <div className="rounded-xl p-4 bg-violet-50/50 border border-violet-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">대운 (10년 단위)</h3>
            <p className="text-xs text-gray-600 mb-3">
              인생의 큰 흐름을 보는 기준입니다. 나이에 따라 해당 대운의 기운이 영향을 줍니다.
            </p>
            <ul className="space-y-2 text-sm">
              {(daewoon as Array<{ order?: number; daewoon_pillar?: string; start_age_years?: number; end_age_years?: number }>).map((row, i) => {
                const start = row.start_age_years != null ? Math.round(row.start_age_years) : null
                const end = row.end_age_years != null ? Math.round(row.end_age_years) : null
                const pillar = row.daewoon_pillar ?? ''
                const hangul = pillar ? pillarToHangul(pillar) : ''
                return (
                  <li key={i} className="flex justify-between items-center py-1.5 border-b border-violet-100 last:border-0">
                    <span className="font-medium text-gray-800">
                      {pillar}
                      {hangul && <span className="text-gray-500 font-normal ml-1">({hangul})</span>}
                    </span>
                    {start != null && end != null && (
                      <span className="text-gray-500 text-xs shrink-0 ml-2">
                        {start}~{end}세
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {hasSewoon && (
          <div className="rounded-xl p-4 bg-sky-50/50 border border-sky-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">세운 (연도별, 현재 ±5년)</h3>
            <p className="text-xs text-gray-600 mb-3">
              매년 바뀌는 기운입니다. 대운과 함께 참고하면 해당 연도의 흐름을 읽기 좋습니다.
            </p>
            <ul className="space-y-2 text-sm">
              {sewoonYears.map((y) => {
                const pillar = sewoon![String(y)] ?? '—'
                const hangul = typeof pillar === 'string' && pillar.length >= 2 ? pillarToHangul(pillar) : ''
                return (
                  <li key={y} className="flex justify-between items-center py-1.5 border-b border-sky-100 last:border-0">
                    <span className="text-gray-600">{y}년</span>
                    <span className="font-medium text-gray-800">
                      {pillar}
                      {hangul && pillar !== '—' && <span className="text-gray-500 font-normal ml-1">({hangul})</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
