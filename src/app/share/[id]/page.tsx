import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicShareEntry, getShareSamples } from '@/lib/share/get-share-entry'
import { buildShareCard } from '@/lib/share/share-card'
import { getUserFromSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { ShareCardView } from './ShareCardView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const entry = await getPublicShareEntry(id)
  if (!entry) {
    return {
      title: '차트팔자 — 내 인생의 리듬',
      description: '100년의 흐름을 하나의 차트로.',
      robots: { index: false, follow: false },
    }
  }
  const card = buildShareCard(entry.sajuReportJson, entry.birthYear)
  const title = `${entry.name}님의 인생 차트 — 차트팔자`
  const description = card
    ? `올해 운세 ${card.score}점 · ${card.label}. 100년의 흐름을 하나의 차트로 확인해보세요.`
    : '100년의 흐름을 하나의 차트로 확인해보세요.'
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const entry = await getPublicShareEntry(id)

  // 비공개 / 없는 카드 — 부드럽게 안내하고 self-CTA 로 전환 유도
  if (!entry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white px-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">비공개 차트예요</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          이 인생 차트는 공유가 해제되었거나 존재하지 않아요.
          <br />
          대신, 내 사주로 100년 인생 차트를 만들어볼까요?
        </p>
        <Link
          href="/app/input"
          className="px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg hover:shadow-xl transition-all"
        >
          내 차트 만들기 →
        </Link>
      </div>
    )
  }

  // 소유자 여부 — 본인이 본인 공유 링크를 열었을 때 관리 배너를 보여주기 위함
  let isOwner = false
  const user = await getUserFromSession().catch(() => null)
  if (user) {
    const owned = await prisma.sajuEntry
      .findUnique({ where: { id }, select: { userId: true } })
      .catch(() => null)
    isOwner = owned?.userId === user.id
  }

  // 비교용 공개 예시 인물(자기 자신은 제외)
  const samples = await getShareSamples(entry.id)

  return <ShareCardView entry={entry} isOwner={isOwner} samples={samples} />
}
