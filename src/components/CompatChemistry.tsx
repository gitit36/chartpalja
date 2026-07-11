'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { InfoTip } from '@/components/InfoTip'
import type { CompatCardData, CompatFlowPoint, CompatSpectrum } from '@/lib/compat/types'

const THIS_YEAR = new Date().getFullYear()
const SUB_MARGIN = { top: 4, right: 16, bottom: 0, left: 8 }

/** 스펙트럼 한 축 — 카드를 펼칠 때 마커가 좌→우로 미끄러진다. */
function SpectrumRow({ spectrum, index }: { spectrum: CompatSpectrum; index: number }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 60 + index * 90)
    return () => clearTimeout(t)
  }, [index])
  const pct = Math.max(5, Math.min(95, spectrum.value * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-cp-muted">{spectrum.leftLabel}</span>
        <span className="text-cp-muted font-medium">{spectrum.title}</span>
        <span className="text-cp-muted">{spectrum.rightLabel}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-cp-down/40 via-cp-borderStrong to-cp-line/40">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cp-text border-2 border-cp-accent shadow-sm transition-all duration-700 ease-out"
          style={{ left: drawn ? `${pct}%` : '0%' }}
        />
      </div>
      <div className="mt-1 text-[10px] text-cp-muted leading-tight">{spectrum.caption}</div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FlowTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="bg-cp-surface/95 backdrop-blur border border-cp-border rounded-lg px-2 py-1 shadow-sm text-[10px]">
      <span className="text-cp-muted">{entry?.payload?.y}: </span>
      <span className="font-semibold text-cp-down">{Math.round(entry?.value ?? 0)}</span>
    </div>
  )
}

interface CompatChemistryProps {
  card: CompatCardData
  flow?: CompatFlowPoint[]
}

/**
 * 관계 케미 상세 — 스펙트럼 4축 + 좋은/주의 해 + 궁합 흐름.
 * 카드를 펼칠 때만 마운트되므로 애니메이션은 펼치는 순간 한 번만 재생된다.
 */
export function CompatChemistry({ card, flow }: CompatChemistryProps) {
  const flowDomain = useMemo<[number, number]>(() => {
    if (!flow?.length) return [0, 100]
    let lo = Infinity, hi = -Infinity
    for (const p of flow) {
      if (p.s < lo) lo = p.s
      if (p.s > hi) hi = p.s
    }
    if (!isFinite(lo)) return [0, 100]
    const range = hi - lo
    const minSpan = 40
    if (range < minSpan) {
      const mid = (lo + hi) / 2
      return [mid - minSpan / 2, mid + minSpan / 2]
    }
    const pad = Math.max(18, range * 0.4)
    return [lo - pad, hi + pad]
  }, [flow])

  return (
    <div className="space-y-3.5">
      <div className="space-y-3">
        {card.spectrums.map((s, i) => (
          <SpectrumRow key={s.key} spectrum={s} index={i} />
        ))}
      </div>

      {(card.goodYears.length > 0 || card.cautionYears.length > 0) && (
        <div className="flex flex-nowrap gap-1">
          {card.goodYears.slice(0, 3).map(y => (
            <span key={`g${y}`} className="flex-1 min-w-0 text-center text-[10px] leading-none px-1 py-1 rounded-md whitespace-nowrap bg-teal-500/15 text-teal-300 border border-teal-500/30">{y} 좋음</span>
          ))}
          {card.cautionYears.slice(0, 3).map(y => (
            <span key={`c${y}`} className="flex-1 min-w-0 text-center text-[10px] leading-none px-1 py-1 rounded-md whitespace-nowrap bg-cp-caution/15 text-cp-caution border border-cp-caution/30">{y} 주의</span>
          ))}
        </div>
      )}

      {flow && flow.length > 1 && (
        <div>
          <div className="text-[10px] text-cp-muted text-right pr-1 mb-0.5">
            궁합 흐름<InfoTip align="right" text={'두 사람 사주를 오행·동기화·상생·충돌 네 가지로 합산한 관계 흐름이에요.\n선이 높을수록 관계가 순조로운 시기, 낮을수록 조율이 필요한 시기예요.'} />
          </div>
          <div className="h-[64px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flow} margin={SUB_MARGIN}>
                <XAxis dataKey="y" type="number" domain={['dataMin', 'dataMax']} hide padding={{ left: 8, right: 8 }} />
                <YAxis domain={flowDomain} hide width={0} />
                <Tooltip content={<FlowTooltip />} />
                <ReferenceLine x={THIS_YEAR} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5} />
                <Line dataKey="s" stroke="#3182F6" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
