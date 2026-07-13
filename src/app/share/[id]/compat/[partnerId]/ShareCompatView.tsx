'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { CompatSummaryBar } from '@/components/CompatSummaryBar'
import { SummaryLine } from '@/components/SummaryLine'
import { buildShareCard } from '@/lib/share/share-card'
import { compatCardKey, RELATIONSHIP_LABELS } from '@/lib/compat/relationship'
import type { CompatShareSnapshot, RelationshipType } from '@/lib/compat/types'
import type { PublicShareEntry } from '@/lib/share/get-share-entry'
import type { OverlayCompatInfo } from '@/lib/compat/types'

export function ShareCompatView({
  entry,
  partner,
  relationship,
  snapshot,
}: {
  entry: PublicShareEntry
  partner: PublicShareEntry
  relationship: RelationshipType
  snapshot: CompatShareSnapshot
}) {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState<OverlayCompatInfo | null>(null)

  const myCard = useMemo(() => buildShareCard(entry.sajuReportJson, entry.birthYear), [entry])
  const partnerSamples = useMemo(() => [{
    id: partner.id,
    name: partner.name,
    gender: partner.gender,
    birthDate: `${partner.birthYear}-01-01`,
    dayElement: partner.dayElement,
  }], [partner])

  const expandKey = compatCardKey(partner.id, relationship)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const relLabel = RELATIONSHIP_LABELS[relationship]
  const shortType = snapshot.type.replace(/ 궁합$/, '')

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-30 bg-cp-raised/95 backdrop-blur border-b border-cp-border">
          <div className="px-4 pt-3 pb-2 text-center">
            <p className="text-xs text-cp-down font-semibold mb-1">{relLabel} 궁합</p>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="font-bold text-cp-text">{entry.name}</span>
              <span className="text-xs text-cp-muted">·</span>
              <span className="font-bold text-cp-text">{partner.name}</span>
            </div>
            <p className="text-[11px] text-cp-line mt-1">{shortType}</p>
          </div>
          {activeOverlay ? (
            <CompatSummaryBar
              info={activeOverlay}
              myName={entry.name}
              scrolled={scrolled}
              shareMode
              onCta={() => router.push('/app/input')}
            />
          ) : myCard ? (
            <SummaryLine
              data={{ ...myCard, score: snapshot.myScore }}
              isUp={myCard.isUp}
              scrolled={scrolled}
            />
          ) : null}
        </div>

        <div className="flex-1 pb-28">
          {entry.sajuReportJson && partner.sajuReportJson && (
            <ChartTab
              report={entry.sajuReportJson}
              birthYear={entry.birthYear}
              fortuneJson={entry.fortuneJson}
              entryId={entry.id}
              currentName={entry.name}
              currentGender={entry.gender}
              overlayEntries={partnerSamples}
              shareMode
              hideCompareUi
              compatShareOnly
              expandCompatCardKey={expandKey}
              onOverlayChange={setActiveOverlay}
              initialOverlayId={partner.id}
              sharePartner={{
                id: partner.id,
                name: partner.name,
                gender: partner.gender,
                birthYear: partner.birthYear,
                report: partner.sajuReportJson,
              }}
            />
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] px-4 py-2.5 bg-cp-raised/95 backdrop-blur-sm border-t border-cp-borderStrong">
            <button
              type="button"
              onClick={() => router.push('/app/input')}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-cp-accent text-white hover:brightness-110 transition-colors"
            >
              나도 궁합 보기 →
            </button>
          </div>
        </div>
      </div>
    </MobileContainer>
  )
}
