'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { InfoTab } from '@/components/InfoTab'
import { SummaryLine } from '@/components/SummaryLine'
import { CompatSummaryBar } from '@/components/CompatSummaryBar'
import { buildShareCard } from '@/lib/share/share-card'
import type { OverlayCompatInfo } from '@/lib/compat/types'
import type { PublicShareEntry } from '@/lib/share/get-share-entry'

type TabKey = 'chart' | 'info'

export function ShareCardView({
  entry,
  isOwner,
}: {
  entry: PublicShareEntry
  isOwner: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('chart')
  const [scrolled, setScrolled] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState<OverlayCompatInfo | null>(null)

  const report = entry.sajuReportJson
  const myCard = useMemo(
    () => (report ? buildShareCard(report, entry.birthYear) : null),
    [report, entry.birthYear],
  )

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goMakeMine = () => router.push('/app/input')

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-30 bg-cp-raised/95 backdrop-blur border-b border-cp-border">
          <div className="px-4 pt-3 pb-2 flex items-center">
            <div className="flex-1 text-center min-w-0">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="font-bold text-cp-text">{entry.name}</span>
                <span className="text-xs text-cp-muted">&middot;</span>
                <span className="text-sm text-cp-muted">{entry.gender === 'female' ? '여성' : '남성'}</span>
                <span className="text-xs text-cp-muted">&middot;</span>
                <span className="text-sm text-cp-muted">{entry.birthYear}년생</span>
              </div>
              <p className="text-xs text-cp-muted">
                {isOwner ? '내가 공유 중인 인생 차트' : `${entry.name}님이 공유한 인생 차트`}
              </p>
            </div>
          </div>
          <div className="flex border-t border-cp-border">
            {([['chart', '총운 차트'], ['info', '사주 정보']] as [TabKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                  tab === k ? 'text-cp-line border-b-2 border-cp-line' : 'text-cp-muted hover:text-cp-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'chart' && activeOverlay ? (
            <CompatSummaryBar
              info={activeOverlay}
              myName={entry.name}
              scrolled={scrolled}
              shareMode
              onCta={goMakeMine}
            />
          ) : tab === 'chart' && myCard ? (
            <SummaryLine data={myCard} isUp={myCard.isUp} scrolled={scrolled} />
          ) : null}
        </div>

        <div className="flex-1 pb-28">
          <div className={tab === 'chart' ? '' : 'hidden'}>
            {report && (
              <ChartTab
                report={report}
                birthYear={entry.birthYear}
                fortuneJson={entry.fortuneJson}
                entryId={entry.id}
                currentName={entry.name}
                currentGender={entry.gender}
                shareMode
                hideCompareUi
                onOverlayChange={setActiveOverlay}
              />
            )}
          </div>
          <div className={tab === 'info' ? '' : 'hidden'}>
            <InfoTab report={report} />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] flex gap-2 px-4 py-2.5 bg-cp-raised/95 backdrop-blur-sm border-t border-cp-borderStrong">
            {isOwner ? (
              <button
                onClick={() => router.push(`/app/saju/${entry.id}`)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-cp-accent text-white hover:brightness-110 transition-colors"
              >
                내 사주 페이지에서 관리하기
              </button>
            ) : (
              <button
                onClick={goMakeMine}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-cp-accent text-white hover:brightness-110 transition-colors"
              >
                나도 내 인생 차트 만들기
              </button>
            )}
          </div>
        </div>
      </div>
    </MobileContainer>
  )
}
