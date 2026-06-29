'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { InfoTab } from '@/components/InfoTab'
import { BottomSheet } from '@/components/BottomSheet'
import { SajuCharacterAvatar, normalizeElement } from '@/components/SajuCharacterAvatar'
import { buildShareCard, buildSparkPath } from '@/lib/share/share-card'
import type { PublicShareEntry } from '@/lib/share/get-share-entry'

type TabKey = 'chart' | 'info'

export function ShareCardView({ entry, isOwner }: { entry: PublicShareEntry; isOwner: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('chart')
  const [ctaSheet, setCtaSheet] = useState(false)

  const report = entry.sajuReportJson
  const card = useMemo(() => buildShareCard(report, entry.birthYear), [report, entry.birthYear])
  const age = new Date().getFullYear() - entry.birthYear

  const spark = useMemo(() => {
    if (!card) return null
    return buildSparkPath(card.sparkData, 88, 26, 2)
  }, [card])

  const goMakeMine = () => router.push('/app/input')
  const onShareCta = () => setCtaSheet(true)

  const isUp = card ? card.isUp : true
  const strokeColor = isUp ? '#d63031' : '#2d6cdf'
  const fillColor = isUp ? 'rgba(214,48,49,0.10)' : 'rgba(45,108,223,0.10)'
  const currentDot =
    spark && card && card.currentIdx >= 0 && card.currentIdx < spark.points.length
      ? spark.points[card.currentIdx]
      : null

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col bg-white">
        {/* 상단 공유 출처 배너 */}
        <div className="px-4 pt-3">
          <div className="rounded-xl bg-purple-50 border border-purple-100 px-3.5 py-2.5 flex items-center gap-2.5">
            <span className="text-base leading-none" aria-hidden>🔗</span>
            <p className="text-[12px] text-purple-700/90 leading-snug flex-1">
              {isOwner ? '내가 공유 중인 인생 차트예요' : `${entry.name}님이 공유한 인생 차트예요`}
            </p>
          </div>
        </div>

        {/* 차트 카드 헤더 */}
        <div className="px-4 pt-4 pb-2">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <SajuCharacterAvatar
                gender={entry.gender === 'female' ? 'female' : 'male'}
                element={normalizeElement(entry.dayElement ?? undefined)}
                personId={entry.id}
                size={44}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px] leading-tight">{entry.name}</div>
                <div className="text-[11px] text-white/60 mt-0.5">
                  만 {age}세 · {entry.gender === 'female' ? '여성' : '남성'}
                </div>
              </div>
              <div className="text-[10px] font-semibold text-white/50 tracking-wider">차트팔자</div>
            </div>

            {card && (
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-white/60">올해 운세 점수</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-4xl font-bold leading-none">{card.score}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isUp ? '#ff9d9d' : '#a8c4ff' }}
                    >
                      {isUp ? '▲' : '▼'}{Math.abs(card.delta)} ({isUp ? '+' : ''}{card.deltaPercent}%)
                    </span>
                  </div>
                </div>
                {spark && (
                  <svg width="88" height="26" viewBox="0 0 88 26" className="flex-shrink-0">
                    <path d={spark.area} fill={fillColor} />
                    <path
                      d={spark.line}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {currentDot && (
                      <circle cx={currentDot.x} cy={currentDot.y} r="2.5" fill={strokeColor} stroke="white" strokeWidth="1" />
                    )}
                  </svg>
                )}
              </div>
            )}
            {card && (
              <div className="mt-3 text-[13px] font-semibold leading-snug">
                {card.label} {card.emoji}
              </div>
            )}
            {card && (
              <div className="text-[11px] text-white/60 mt-0.5 leading-snug">{card.desc}</div>
            )}
          </div>
        </div>

        {/* 탭 */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
          <div className="flex">
            {([['chart', '총운 차트'], ['info', '사주 정보']] as [TabKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                  tab === k ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
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
              overlayEntries={[]}
              isLocked={false}
              shareMode
              onShareCta={onShareCta}
            />
          </div>
          <div className={tab === 'info' ? '' : 'hidden'}>
            <InfoTab report={report} isLocked={false} />
          </div>
        </div>

        {/* 하단 고정 self-CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] px-4 py-3 bg-white/95 backdrop-blur-sm border-t border-gray-100">
            {isOwner ? (
              <button
                onClick={() => router.push(`/app/saju/${entry.id}`)}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
              >
                내 사주 페이지에서 관리하기 →
              </button>
            ) : (
              <>
                <button
                  onClick={goMakeMine}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
                >
                  나도 내 인생 차트 만들기 →
                </button>
                <p className="text-center text-[11px] text-gray-400 mt-2">
                  내 사주는 몇 점일까? · 30초면 끝나요
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 잠긴 기능(구간·운세 생성) 탭 시 self-CTA 시트 */}
      {ctaSheet && (
        <BottomSheet onClose={() => setCtaSheet(false)}>
          <div className="text-center px-2 pb-1">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="font-bold text-gray-900 text-base mb-1.5">내 차트를 만들면 열려요</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              연도·구간별 상세 해설은 내 사주로 차트를 만든 뒤
              <br />
              이용권으로 볼 수 있어요.
            </p>
            <button
              onClick={goMakeMine}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
            >
              내 차트 만들기 →
            </button>
            <button
              onClick={() => setCtaSheet(false)}
              className="w-full py-3 mt-2 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              그냥 둘러볼래요
            </button>
          </div>
        </BottomSheet>
      )}
    </MobileContainer>
  )
}
