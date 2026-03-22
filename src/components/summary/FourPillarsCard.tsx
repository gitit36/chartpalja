'use client'

import type { SajuReportJson } from '@/types/saju-report'
import {
  ELEMENT_BG,
  STEM_HANGUL,
  BRANCH_HANGUL,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  elementToHangul,
} from '@/lib/saju/hanja-hangul'

/** 열 순서: 시주, 일주, 월주, 년주 (스크린샷과 동일) → 데이터 인덱스: 3,2,1,0 */
const DISPLAY_ORDER: ReadonlyArray<{ label: string; lifeStage: string; index: number; isDay?: boolean }> = [
  { label: '시주', lifeStage: '말년운', index: 3 },
  { label: '일주', lifeStage: '장년운', index: 2, isDay: true },
  { label: '월주', lifeStage: '청년운', index: 1 },
  { label: '년주', lifeStage: '초년운', index: 0 },
]

const GAN_KEYS = ['연간', '월간', '일간', '시간'] as const
const JI_KEYS = ['연지', '월지', '일지', '시지'] as const

function StemBox({ hanja, isMe }: { hanja: string; isMe?: boolean }) {
  const element = STEM_ELEMENT[hanja] ?? '土'
  const hangul = STEM_HANGUL[hanja] ?? hanja
  const elemHangul = elementToHangul(element)
  const bg = ELEMENT_BG[element] ?? 'bg-gray-100 border-2 border-gray-400 text-gray-800'
  return (
    <div className={`relative rounded-xl px-2 py-2.5 text-center min-w-[3rem] ${bg}`}>
      {isMe && (
        <span className="absolute -top-1 -right-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          나
        </span>
      )}
      <div className="text-xl font-bold leading-tight">{hanja}</div>
      <div className="text-xs mt-0.5 font-medium opacity-90">{hangul} ({elemHangul})</div>
    </div>
  )
}

function BranchBox({ hanja }: { hanja: string }) {
  const element = BRANCH_ELEMENT[hanja] ?? '土'
  const hangul = BRANCH_HANGUL[hanja] ?? hanja
  const elemHangul = elementToHangul(element)
  const bg = ELEMENT_BG[element] ?? 'bg-gray-100 border-2 border-gray-400 text-gray-800'
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center min-w-[3rem] ${bg}`}>
      <div className="text-xl font-bold leading-tight">{hanja}</div>
      <div className="text-xs mt-0.5 font-medium opacity-90">{hangul} ({elemHangul})</div>
    </div>
  )
}

type JiMetaItem = { branch?: string; hidden_stems?: Array<{ stem?: string; ten_god?: string }>; '12운성'?: string }

export function FourPillarsCard({ report }: { report: SajuReportJson | null }) {
  const pillars = report?.만세력_사주원국
  const ganji = report?.천간지지
  const sipsung = report?.오행십성_상세
  const gongmangRaw = report?.공망
  const gongmangDayJiji = gongmangRaw?.공망지지
  const gongmangYearJiji = gongmangRaw?.년주_공망지지

  if (!pillars || !ganji) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">사주원국</h2>
        <p className="text-sm text-gray-500">(추가 계산 예정)</p>
      </section>
    )
  }

  const stems = GAN_KEYS.map((k) => ganji.천간?.[k] ?? '—')
  const branches = JI_KEYS.map((k) => ganji.지지?.[k] ?? '—')
  const ganMeta = sipsung?.천간 && Array.isArray(sipsung.천간)
    ? (sipsung.천간 as Array<{ stem?: string; ten_god?: string }>)
    : []
  const tenGodsTop = ganMeta.length === 4 ? ganMeta.map((x) => x.ten_god ?? '—') : ['—', '—', '—', '—']
  const jiMetaRaw = sipsung && (sipsung['지지(지장간포함)'] ?? (sipsung as Record<string, unknown>)['지지_지장간포함'])
  const jiMeta: JiMetaItem[] = Array.isArray(jiMetaRaw) ? jiMetaRaw as JiMetaItem[] : []

  const dayGmSet = new Set(Array.isArray(gongmangDayJiji) ? gongmangDayJiji : [])
  const yearGmSet = new Set(Array.isArray(gongmangYearJiji) ? gongmangYearJiji : [])
  const pillarLabels = ['년', '월', '일', '시']

  type GmTag = { pillar: string; branch: string; source: '일주' | '년주' }
  const gmTags: GmTag[] = []
  for (let i = 0; i < 4; i++) {
    const br = branches[i]
    if (i !== 2 && dayGmSet.has(br)) {
      gmTags.push({ pillar: pillarLabels[i], branch: br, source: '일주' })
    }
    if (i !== 0 && yearGmSet.has(br)) {
      gmTags.push({ pillar: pillarLabels[i], branch: br, source: '년주' })
    }
  }
  const allGmBranches = new Set([...dayGmSet, ...yearGmSet])

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">사주원국</h2>
      <div className="grid grid-cols-4 gap-3">
        {DISPLAY_ORDER.map(({ label, lifeStage, index, isDay }) => {
          const stem = stems[index]
          const branch = branches[index]
          const topSipsung = tenGodsTop[index]
          const ji = jiMeta[index]
          const hiddenStems = ji?.hidden_stems ?? []
          const unseong = ji?.['12운성'] || '—'
          const isGongmang = allGmBranches.has(branch) && !isDay

          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="text-sm font-bold text-gray-800">{label}{isDay ? ' (나)' : ''}</div>
              <div className="text-[10px] text-gray-500">{lifeStage}</div>
              <div className="text-xs text-gray-600 font-medium">{topSipsung === '—' ? '일원' : topSipsung}</div>
              {stem !== '—' ? <StemBox hanja={stem} isMe={isDay} /> : <div className="min-h-[3.5rem]" />}
              {branch !== '—' ? <BranchBox hanja={branch} /> : <div className="min-h-[3.5rem]" />}
              <div className="text-xs font-bold text-gray-700 mt-0.5">{topSipsung}</div>
              <div className="text-[10px] text-gray-500">{unseong}</div>
              {isGongmang && (
                <div className="text-[10px] text-red-400 font-medium">공망</div>
              )}
              {hiddenStems.length > 0 && (
                <div className="mt-1 space-y-0.5 text-[10px] text-gray-600 text-center">
                  {hiddenStems.slice(0, 3).map((hs, i) => (
                    <div key={i}>
                      {hs.stem ?? ''} {hs.ten_god ?? ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {gmTags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-center text-xs text-gray-500 space-y-0.5">
          {gmTags.map((t, i) => (
            <div key={i}>
              [{t.source}] 공망: {t.pillar}지={t.branch}({BRANCH_HANGUL[t.branch] ?? t.branch})
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
