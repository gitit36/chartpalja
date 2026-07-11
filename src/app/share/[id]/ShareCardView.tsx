'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { InfoTab } from '@/components/InfoTab'
import { BottomSheet } from '@/components/BottomSheet'
import { SummaryLine } from '@/components/SummaryLine'
import { CompatSummaryBar } from '@/components/CompatSummaryBar'
import type { OverlayCompatInfo } from '@/lib/compat/types'
import { buildShareCard } from '@/lib/share/share-card'
import type { PublicShareEntry, ShareSample } from '@/lib/share/get-share-entry'

type TabKey = 'chart' | 'info'

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
  const card = useMemo(() => buildShareCard(report, entry.birthYear), [report, entry.birthYear])

  // 개인 사주 상세와 동일하게: 스크롤하면 요약 바가 시세 헤더 형태로 접힌다.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goMakeMine = () => router.push('/app/input')
  const onShareCta = () => setCtaSheet(true)

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col bg-cp-bg">
        {/* 헤더 + 탭 (app/saju 와 동일한 형태 — 이름·성별·생년만) */}
        <div className="sticky top-0 z-30 bg-cp-bg border-b border-cp-border">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-bold text-cp-text">{entry.name}</span>
              <span className="text-xs text-cp-muted">&middot;</span>
              <span className="text-sm text-cp-muted">{entry.gender === 'female' ? '여성' : '남성'}</span>
              <span className="text-xs text-cp-muted">&middot;</span>
              <span className="text-sm text-cp-muted">{entry.birthYear}년생</span>
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
          ) : tab === 'chart' && card ? (
            <SummaryLine data={card} isUp={card.isUp} scrolled={scrolled} />
          ) : null}
        </div>

        {/* 사주 정보 탭: 요약 바는 스크롤되도록 sticky 밖에 둔다 */}
        {tab === 'info' && card && (
          <SummaryLine data={card} isUp={card.isUp} scrolled={false} />
        )}

        {/* 공유 출처 안내 (슬림) */}
        <div className="px-4 pt-2">
          <div className="rounded-xl bg-cp-surface border border-cp-border px-3.5 py-2 flex items-center gap-2.5">
            <span className="text-base leading-none" aria-hidden>🔗</span>
            <p className="text-[12px] text-cp-line/90 leading-snug flex-1">
              {isOwner ? '내가 공유 중인 인생 차트예요' : `${entry.name}님이 공유한 인생 차트예요`}
            </p>
          </div>
        </div>

        {/* 본문 — 전체 공개 (블러 없음) */}
        <div className="flex-1 pb-28">
          <div className={tab === 'chart' ? '' : 'hidden'}>
            <ChartTab
              report={report}
              birthYear={entry.birthYear}
              fortuneJson={entry.fortuneJson}
              currentName={entry.name}
              currentGender={entry.gender}
              overlayEntries={samples}
              isLocked={false}
              shareMode
              onShareCta={onShareCta}
              onOverlayChange={setActiveOverlay}
            />
          </div>
          <div className={tab === 'info' ? '' : 'hidden'}>
            <InfoTab report={report} isLocked={false} />
          </div>
        </div>

        {/* 하단 고정 self-CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] px-4 py-3 bg-cp-surface/95 backdrop-blur-sm border-t border-cp-border">
            {isOwner ? (
              <button
                onClick={() => router.push(`/app/saju/${entry.id}`)}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-cp-accent shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
              >
                내 사주 페이지에서 관리하기 →
              </button>
            ) : (
              <>
                <button
                  onClick={goMakeMine}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-cp-accent shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
                >
                  나도 내 인생 차트 만들기 →
                </button>
                <p className="text-center text-[11px] text-cp-muted mt-2">내 사주팔자는 몇 점일까? · 30초면 끝나요</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 잠긴 기능(구간·운세 생성) 탭 시 self-CTA 시트 */}
      {ctaSheet && (
        <BottomSheet
          onClose={() => setCtaSheet(false)}
          footer={(
            <button
              onClick={() => setCtaSheet(false)}
              className="w-full py-3 rounded-xl text-sm font-medium text-cp-muted hover:text-cp-muted transition-colors"
            >
              그냥 둘러볼래요
            </button>
          )}
        >
          <div className="text-center px-2 pb-2">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="font-bold text-cp-text text-base mb-1.5">내 차트를 만들면 열려요</h3>
            <p className="text-sm text-cp-muted leading-relaxed mb-5">
              연도·구간별 상세 해설은 내 사주로 차트를 만든 뒤
              <br />
              이용권으로 볼 수 있어요.
            </p>
            <button
              onClick={goMakeMine}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-cp-accent shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
            >
              내 차트 만들기 →
            </button>
          </div>
        </BottomSheet>
      )}
    </MobileContainer>
  )
}
