import { prisma } from '@/lib/db/prisma'
import { InquiriesClient } from './InquiriesClient'

export const dynamic = 'force-dynamic'

export default async function AdminInquiriesPage() {
  const inquiries = await prisma.inquiry.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const serialized = inquiries.map((i) => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
  }))

  return <InquiriesClient initial={serialized} />
}
