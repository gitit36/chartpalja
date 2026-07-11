'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { CompatSummaryBar } from '@/components/CompatSummaryBar'
import { SummaryLine } from '@/components/SummaryLine'
import { buildShareCard } from '@/lib/share/share-card'
import { RELATIONSHIP_LABELS } from '@/lib/compat/relationship'
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const relLabel = RELATIONSHIP_LABELS[relationship]
  const shortType = snapshot.type.replace(/ 궁합$/, '')

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col bg-cp-bg">
        <div className="sticky top-0 z-30 bg-cp-bg border-b border-cp-border">
          <div className="px-4 pt-3 pb-2 text-center">
            <p className="text-xs text-rose-500 font-semibold mb-1">{relLabel} 궁합</p>
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

        <div className="flex-1 pb-8">
          <ChartTab
            report={entry.sajuReportJson}
            birthYear={entry.birthYear}
            fortuneJson={entry.fortuneJson}
            entryId={entry.id}
            currentName={entry.name}
            currentGender={entry.gender}
            overlayEntries={partnerSamples}
            shareMode
            onShareCta={() => router.push('/app/input')}
            onOverlayChange={setActiveOverlay}
            initialOverlayId={partner.id}
            sharePartner={{
              id: partner.id,
              name: partner.name,
              gender: partner.gender,
              birthYear: partner.birthYear,
              report: partner.sajuReportJson!,
            }}
          />
        </div>

        <div className="px-4 pb-6">
          <button
            type="button"
            onClick={() => router.push('/app/input')}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-cp-accent shadow-lg"
          >
            나도 궁합 보기 →
          </button>
        </div>
      </div>
    </MobileContainer>
  )
}
