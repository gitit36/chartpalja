'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { InfoTab } from '@/components/InfoTab'
import { BottomSheet } from '@/components/BottomSheet'
import { SummaryLine, type SummaryLineData } from '@/components/SummaryLine'
import { LockedPreview } from '@/components/LockedPreview'
import { CompatSummaryBar } from '@/components/CompatSummaryBar'
import type { OverlayCompatInfo } from '@/lib/compat/types'
import type { PublicShareEntry, ShareSample } from '@/lib/share/get-share-entry'

type TabKey = 'chart' | 'info'

const LOCKED_SUMMARY_PLACEHOLDER: SummaryLineData = {
  score: 72,
  delta: 3.2,
  deltaPercent: 4.6,
  label: '확장기',
  desc: '흐름이 열리는 시기예요',
  emoji: '',
  sparkData: [52, 55, 58, 56, 61, 66, 64, 70, 73, 69, 67, 72],
  currentIdx: 11,
}

export function ShareCardView({
  entry,
  isOwner,
  samples,
}: {
  entry: PublicShareEntry
  isOwner: boolean
  samples: ShareSample[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('chart')
  const [ctaSheet, setCtaSheet] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState<OverlayCompatInfo | null>(null)

  const report = entry.sajuReportJson

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goMakeMine = () => router.push('/app/input')
  const onShareCta = () => setCtaSheet(true)
  const lockBadge = '내 차트를 만들면 풀려요'
  const lockCta = '만들기 →'

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
              onCta={onShareCta}
            />
          ) : tab === 'chart' ? (
            <LockedPreview
              onUnlock={onShareCta}
              badgeText={lockBadge}
              ctaText={lockCta}
              ariaLabel={`올해 요약 — ${lockBadge}`}
              className="rounded-none"
            >
              <SummaryLine data={LOCKED_SUMMARY_PLACEHOLDER} isUp scrolled={scrolled} />
            </LockedPreview>
          ) : null}
        </div>

        {tab === 'info' && (
          <LockedPreview
            onUnlock={onShareCta}
            badgeText={lockBadge}
            ctaText={lockCta}
            showBadge={false}
            className="rounded-none"
          >
            <SummaryLine data={LOCKED_SUMMARY_PLACEHOLDER} isUp scrolled={false} />
          </LockedPreview>
        )}

        <div className="flex-1 pb-28">
          <div className={tab === 'chart' ? '' : 'hidden'}>
            <ChartTab
              report={report}
              birthYear={entry.birthYear}
              fortuneJson={entry.fortuneJson}
              currentName={entry.name}
              currentGender={entry.gender}
              overlayEntries={samples}
              isLocked
              shareMode
              onLockedClick={onShareCta}
              onShareCta={onShareCta}
              onOverlayChange={setActiveOverlay}
            />
          </div>
          <div className={tab === 'info' ? '' : 'hidden'}>
            <InfoTab
              report={report}
              isLocked
              onLockedClick={onShareCta}
              lockBadgeText={lockBadge}
              lockCtaText={lockCta}
            />
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

      {ctaSheet && (
        <BottomSheet
          onClose={() => setCtaSheet(false)}
          header={(
            <div className="pb-3 text-center">
              <h3 className="font-bold text-cp-text text-lg leading-tight">내 차트를 만들면 열려요</h3>
              <p className="text-xs text-cp-muted mt-1.5 leading-relaxed">
                지표·상세 해석·구간 해설은 내 사주로 차트를 만든 뒤 볼 수 있어요
              </p>
            </div>
          )}
          footer={(
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCtaSheet(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-cp-secondary border border-cp-borderStrong bg-cp-input hover:bg-cp-hover active:brightness-95 transition-colors"
              >
                둘러보기
              </button>
              <button
                type="button"
                onClick={goMakeMine}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-cp-accent hover:brightness-110 active:brightness-95 transition-colors"
              >
                차트 만들기
              </button>
            </div>
          )}
        >
          <ul className="text-sm text-cp-muted space-y-2.5 pb-2 px-1">
            <li className="flex items-start gap-2.5">
              <span className="text-cp-accent font-bold shrink-0">·</span>
              <span>대운·시즌·도메인 등 전체 지표</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-cp-accent font-bold shrink-0">·</span>
              <span>이번 주·올해 흐름과 점수 요인</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-cp-accent font-bold shrink-0">·</span>
              <span>용신·신살·운세 해설</span>
            </li>
          </ul>
        </BottomSheet>
      )}
    </MobileContainer>
  )
}
