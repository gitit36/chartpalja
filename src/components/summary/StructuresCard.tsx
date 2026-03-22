'use client'

import type { SajuReportJson } from '@/types/saju-report'
import { STEM_HANGUL, BRANCH_HANGUL } from '@/lib/saju/hanja-hangul'

function hanjaWithHangul(hanja: string, isStem: boolean): string {
  const h = isStem ? STEM_HANGUL[hanja] : BRANCH_HANGUL[hanja]
  return h ? `${hanja}(${h})` : hanja
}

/** 신살·길성 이름 → 한 줄 인사이트 */
const SHINSAL_INSIGHT: Record<string, string> = {
  '천을귀인': '귀인운이 있어 어려울 때 도움을 받기 쉽습니다.',
  '문창귀인': '학업·문장·창작에 유리한 기운입니다.',
  '역마': '변동·이동·새로운 시작과 맞닿아 있습니다.',
  '화개': '예술·감수성·표현력과 연관됩니다.',
  '금여록': '재물·직업·안정과 관련된 길성입니다.',
  '양인': '리더십과 추진력이 강해질 수 있는 시기입니다.',
  '도화': '인연·매력·사회성이 돋보일 수 있습니다.',
  '홍염': '열정과 명예를 추구하는 기운입니다.',
  '편인': '학문·내면 성장과 깊은 사고와 연결됩니다.',
  '편관': '책임감과 규율, 목표 지향적 성향과 맞닿아 있습니다.',
  '정재': '꼼꼼한 재물 관리와 신뢰와 관련됩니다.',
  '편재': '재능과 기회를 활용하는 데 유리할 수 있습니다.',
}

function getShinsalInsight(name: string): string {
  return SHINSAL_INSIGHT[name] ?? '사주 해석에서 특별한 의미를 갖는 기운입니다.'
}

export function StructuresCard({ report }: { report: SajuReportJson | null }) {
  const gongmang = report?.공망
  const shinsal = report?.신살길성
  const ganji = report?.천간지지

  const dayGmJi = gongmang?.공망지지 && Array.isArray(gongmang.공망지지) ? gongmang.공망지지 as string[] : []
  const yearGmJi = gongmang?.년주_공망지지 && Array.isArray(gongmang.년주_공망지지) ? gongmang.년주_공망지지 as string[] : []
  const allGmJi = [...new Set([...dayGmJi, ...yearGmJi])]
  const dayGmSet = new Set(dayGmJi)
  const yearGmSet = new Set(yearGmJi)
  const branches = ganji?.지지 ? [ganji.지지.연지, ganji.지지.월지, ganji.지지.일지, ganji.지지.시지] : []
  const pillarLabels = ['년지', '월지', '일지', '시지']
  const gongmangHits: string[] = []
  for (let i = 0; i < branches.length; i++) {
    const br = branches[i]
    if (!br) continue
    if (i !== 2 && dayGmSet.has(br)) gongmangHits.push(`[일주]${pillarLabels[i]}(${br})`)
    if (i !== 0 && yearGmSet.has(br)) gongmangHits.push(`[년주]${pillarLabels[i]}(${br})`)
  }
  const hasShinsal = shinsal && typeof shinsal === 'object' && Object.keys(shinsal).filter((k) => k !== 'rule_notes').length > 0
  const stemChars = new Set(Object.keys(STEM_HANGUL))
  const branchChars = new Set(Object.keys(BRANCH_HANGUL))

  const hasContent = allGmJi.length > 0 || hasShinsal

  if (!hasContent) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">신살·길성</h2>
        <p className="text-sm text-gray-500">(추가 계산 예정)</p>
      </section>
    )
  }

  const shinsalEntries = hasShinsal && typeof shinsal === 'object'
    ? Object.entries(shinsal).filter(([k]) => k !== 'rule_notes')
    : []

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-1 text-gray-800">신살·길성</h2>
      <p className="text-xs text-gray-500 mb-4">
        사주에 깃든 특별한 기운입니다. 길성은 도움이 되는 쪽, 신살은 주의·보완을 참고할 수 있습니다.
      </p>

      {allGmJi.length > 0 && (
        <div className="mb-4 rounded-xl p-4 bg-slate-50 border border-slate-100">
          <div className="text-xs font-medium text-gray-500 mb-2">공망</div>
          <p className="text-xs text-gray-600 mb-2">
            해당 지지의 힘이 상대적으로 비어 있다고 보는 관점입니다. 다른 기둥이나 대운으로 보완될 수 있어요.
          </p>
          <div className="flex flex-wrap gap-2">
            {allGmJi.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-sm text-gray-800"
              >
                {c}
                <span className="ml-1 text-gray-500">({BRANCH_HANGUL[c] ?? c})</span>
              </span>
            ))}
          </div>
          {gongmangHits.length > 0 && (
            <p className="mt-2 text-[11px] text-gray-500">
              적용: {gongmangHits.join(', ')}
            </p>
          )}
        </div>
      )}

      {shinsalEntries.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-500">신살·길성 (한자+한글)</div>
          <ul className="space-y-3">
            {shinsalEntries.map(([name, value]) => {
              const arr = Array.isArray(value) ? value as string[] : []
              if (arr.length === 0) return null
              const labels = arr.map((c) => {
                const isStem = stemChars.has(c)
                const isBranch = branchChars.has(c)
                return hanjaWithHangul(c, isStem && !isBranch)
              })
              const insight = getShinsalInsight(name)
              return (
                <li key={name} className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                  <p className="font-semibold text-gray-800 mb-1">{name}</p>
                  <p className="text-sm text-gray-600 mb-2">{labels.join(', ')}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{insight}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
