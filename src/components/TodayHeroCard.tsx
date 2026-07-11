'use client'

import Link from 'next/link'
import type { DailySignal, WeekScoreRange } from '@/lib/saju/daily-util'
import { Sparkline } from '@/components/Sparkline'

function deltaText(delta: number): string {
  if (delta > 0) return `▲${delta}`
  if (delta < 0) return `▼${Math.abs(delta)}`
  return '–'
}

/** 카드(surface) 위 배지 — 검정 칩 금지, 틴트만 */
const BADGE_CLS: Record<DailySignal['kind'], string> = {
  position: 'bg-cp-line/20 text-cp-line',
  delta: 'bg-cp-down/20 text-cp-down',
  balance: 'bg-cp-caution/25 text-cp-caution',
  action: 'bg-cp-accent/20 text-cp-accent',
}

/** 토스 시세 고저 바 — 이번 주 최저~최고 사이 오늘 위치 */
export function WeekRangeBar({ range }: { range: WeekScoreRange }) {
  const left = `${range.pct * 100}%`
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium tracking-wide text-cp-dim">이번 주</span>
        <span className="text-[10px] tabular-nums text-cp-dim">
          {range.min}–{range.max}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-cp-hover">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cp-line/35"
          style={{ width: left }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cp-line shadow-[0_0_0_3px_rgba(240,68,82,0.28)]"
          style={{ left }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-cp-dim">낮음</span>
        <span className="text-[9px] text-cp-dim">높음</span>
      </div>
    </div>
  )
}

export interface TodayHeroCardProps {
  href: string
  name: string
  dateLabel: string
  score: number
  delta: number
  direction: 'up' | 'down' | 'flat'
  /** 일운 6도메인 점수 (직업·재물·연애·대인·학업·건강) */
  domains: Record<string, number> | null
  signals: DailySignal[]
  weekRange: WeekScoreRange | null
  series?: (number | null)[]
}

const DOMAIN_ORDER = ['직업', '재물', '연애', '대인', '학업', '건강'] as const

function domainTone(score: number): string {
  if (score >= 70) return 'text-cp-line bg-cp-line/15'
  if (score <= 35) return 'text-cp-caution bg-cp-caution/20'
  return 'text-cp-secondary bg-cp-hover'
}

/**
 * 리스트 대표 히어로 — 점수·주간 위치·소식 줄 (토스 10초 요약 문법).
 */
export function TodayHeroCard({
  href,
  name,
  dateLabel,
  score,
  delta,
  direction,
  domains,
  signals,
  weekRange,
  series,
}: TodayHeroCardProps) {
  const hasSpark = !!series?.some((v) => v != null)
  const domainRows: { key: string; score: number }[] = []
  for (const key of DOMAIN_ORDER) {
    const v = domains?.[key]
    if (typeof v === 'number') domainRows.push({ key, score: Math.round(v) })
  }

  return (
    <Link
      href={href}
      prefetch={true}
      className="block mb-4 rounded-2xl overflow-hidden bg-cp-surface border border-cp-border text-cp-text active:scale-[0.99] transition-transform"
    >
      <div className="p-4 pb-3.5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="text-[13px] font-semibold text-cp-secondary tracking-tight">
            {name}님 오늘의 운세
          </span>
          <span className="text-[11px] tabular-nums text-cp-dim shrink-0 pt-0.5">{dateLabel}</span>
        </div>

        <div className="flex items-end justify-between gap-3 mb-3.5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-cp-text">
                {score}
                <span className="text-base font-bold ml-0.5 text-cp-muted">점</span>
              </span>
              <span className="text-[12px] text-cp-muted truncate">
                {delta === 0 ? (
                  <>어제와 비슷</>
                ) : (
                  <>
                    어제보다{' '}
                    <span
                      className={`font-bold ${
                        direction === 'down' ? 'text-cp-down' : 'text-cp-up'
                      }`}
                    >
                      {deltaText(delta)}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
          {hasSpark ? (
            <div className="shrink-0 -mb-0.5">
              <Sparkline data={series!} trend={direction} color="#F04452" width={112} height={44} />
            </div>
          ) : null}
        </div>

        {weekRange && (
          <div className="mb-3.5 px-0.5">
            <WeekRangeBar range={weekRange} />
          </div>
        )}

        {domainRows.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {domainRows.map((d) => (
              <span
                key={d.key}
                className={`inline-flex items-baseline gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${domainTone(d.score)}`}
              >
                <span className="opacity-90 font-medium">{d.key}</span>
                <span className="font-bold">{d.score}</span>
              </span>
            ))}
          </div>
        )}

        {signals.length > 0 && (
          <ul className="rounded-xl bg-cp-hover/80 border border-cp-borderStrong/40 divide-y divide-cp-border overflow-hidden">
            {signals.map((s) => (
              <li key={`${s.kind}-${s.text}`} className="flex items-start gap-2 px-2.5 py-2">
                <span
                  className={`shrink-0 mt-0.5 px-1.5 py-px rounded text-[9px] font-bold tracking-wide ${BADGE_CLS[s.kind]}`}
                >
                  {s.label}
                </span>
                <span className="text-[12px] leading-snug text-cp-secondary font-medium">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-cp-raised border-t border-cp-borderStrong">
        <span className="text-[11px] font-medium text-cp-secondary">오늘의 운세, 차트에서 확인하기</span>
        <span className="text-cp-accent text-sm leading-none font-semibold" aria-hidden>
          →
        </span>
      </div>
    </Link>
  )
}

export function TodayHeroCardSkeleton({ name }: { name: string }) {
  return (
    <div className="mb-4 rounded-2xl p-4 min-h-[168px] bg-cp-surface border border-cp-border text-cp-text">
      <span className="text-[13px] font-semibold text-cp-secondary">{name}님 오늘의 운세</span>
      <div className="flex-1 flex items-center justify-center py-10">
        <span
          role="status"
          aria-label="불러오는 중"
          className="inline-block animate-spin rounded-full border-2 border-cp-line border-t-transparent"
          style={{ width: 30, height: 30 }}
        />
      </div>
    </div>
  )
}
