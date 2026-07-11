import type { Metadata } from 'next'
import Link from 'next/link'
import { getCompatShareContext } from '@/lib/share/get-compat-share-context'
import { RELATIONSHIP_LABELS } from '@/lib/compat/relationship'
import { ShareCompatView } from './ShareCompatView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; partnerId: string }>
  searchParams: Promise<{ rel?: string }>
}): Promise<Metadata> {
  const { id, partnerId } = await params
  const { rel } = await searchParams
  const ctx = await getCompatShareContext(id, partnerId, rel ?? null)
  if (!ctx) {
    return {
      title: '차트팔자 — 궁합 차트',
      description: '비공개 궁합 차트입니다.',
      robots: { index: false, follow: false },
    }
  }
  const relLabel = RELATIONSHIP_LABELS[ctx.relationship]
  const title = `${ctx.entry.name} × ${ctx.partner.name} ${relLabel} 궁합 — 차트팔자`
  const description = `올해 ${ctx.snapshot.myScore} vs ${ctx.snapshot.partnerScore} · ${ctx.snapshot.type}`
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ShareCompatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; partnerId: string }>
  searchParams: Promise<{ rel?: string }>
}) {
  const { id, partnerId } = await params
  const { rel } = await searchParams
  const ctx = await getCompatShareContext(id, partnerId, rel ?? null)

  if (!ctx) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-white px-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-cp-text mb-2">비공개 궁합이에요</h1>
        <p className="text-sm text-cp-muted mb-8 leading-relaxed">
          이 궁합 차트는 공유가 해제되었거나 존재하지 않아요.
        </p>
        <Link
          href="/app/input"
          className="px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-cp-accent shadow-lg"
        >
          내 차트 만들기 →
        </Link>
      </div>
    )
  }

  return (
    <ShareCompatView
      entry={ctx.entry}
      partner={ctx.partner}
      relationship={ctx.relationship}
      snapshot={ctx.snapshot}
    />
  )
}
