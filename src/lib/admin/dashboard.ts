import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  type AdminRangeKey,
  eachKstDateKey,
  formatKstDate,
  formatKstDateTime,
  rangeStart,
  startOfKstDay,
} from './dates'

function excludeNicknames(): string[] {
  const raw = process.env.ADMIN_DASHBOARD_EXCLUDE_NICKNAMES ?? '이상진'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function getDashboardData(range: AdminRangeKey) {
  const since = rangeStart(range)
  const now = new Date()
  const todayStart = startOfKstDay(now)
  const dateKeys = eachKstDateKey(since)

  const [
    usersInRange,
    entriesInRange,
    guestEntriesInRange,
    paidOrdersInRange,
    couponRedeemsInRange,
    juUsedInRange,
    openInquiries,
    recentLookups,
    usersToday,
    entriesToday,
    paidToday,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.sajuEntry.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, userId: true, guestId: true },
    }),
    prisma.sajuEntry.count({
      where: { createdAt: { gte: since }, userId: null, guestId: { not: null } },
    }),
    prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: { gte: since } },
      select: { amount: true, currency: true, paidAt: true, productCode: true },
    }),
    prisma.couponRedemption.count({
      where: { createdAt: { gte: since } },
    }),
    prisma.entitlementLedger.aggregate({
      where: {
        createdAt: { gte: since },
        delta: { lt: 0 },
        reason: { startsWith: 'use:' },
      },
      _sum: { delta: true },
    }),
    prisma.inquiry.count({ where: { status: 'open' } }),
    prisma.sajuEntry.findMany({
      where: {
        userId: { not: null },
        user: {
          nickname: { not: null },
          role: UserRole.USER,
          NOT: { nickname: { in: excludeNicknames() } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        name: true,
        birthDate: true,
        birthTime: true,
        updatedAt: true,
        createdAt: true,
        user: {
          select: { id: true, nickname: true, email: true },
        },
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.sajuEntry.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.paymentOrder.aggregate({
      where: { status: 'paid', paidAt: { gte: todayStart }, currency: 'KRW' },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const signupByDay: Record<string, number> = Object.fromEntries(dateKeys.map((k) => [k, 0]))
  for (const u of usersInRange) {
    const k = formatKstDate(u.createdAt)
    if (k in signupByDay) signupByDay[k] += 1
  }

  const entryByDay: Record<string, number> = Object.fromEntries(dateKeys.map((k) => [k, 0]))
  for (const e of entriesInRange) {
    const k = formatKstDate(e.createdAt)
    if (k in entryByDay) entryByDay[k] += 1
  }

  const revenueByDay: Record<string, number> = Object.fromEntries(dateKeys.map((k) => [k, 0]))
  let revenueKrw = 0
  for (const o of paidOrdersInRange) {
    if (o.currency === 'KRW') {
      revenueKrw += o.amount
      if (o.paidAt) {
        const k = formatKstDate(o.paidAt)
        if (k in revenueByDay) revenueByDay[k] += o.amount
      }
    }
  }

  const productMix: Record<string, number> = {}
  for (const o of paidOrdersInRange) {
    productMix[o.productCode] = (productMix[o.productCode] ?? 0) + 1
  }

  const juUsed = Math.abs(juUsedInRange._sum.delta ?? 0)

  return {
    range,
    since: since.toISOString(),
    summary: {
      signups: usersInRange.length,
      entries: entriesInRange.length,
      guestEntries: guestEntriesInRange,
      paidOrders: paidOrdersInRange.length,
      revenueKrw,
      couponRedeems: couponRedeemsInRange,
      juUsed,
      openInquiries,
      today: {
        signups: usersToday,
        entries: entriesToday,
        paidOrders: paidToday._count,
        revenueKrw: paidToday._sum.amount ?? 0,
      },
    },
    charts: {
      dates: dateKeys,
      signups: dateKeys.map((k) => signupByDay[k] ?? 0),
      entries: dateKeys.map((k) => entryByDay[k] ?? 0),
      revenue: dateKeys.map((k) => revenueByDay[k] ?? 0),
      productMix: Object.entries(productMix)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
    },
    recentLookups: recentLookups.map((row) => ({
      entryId: row.id,
      customerNickname: row.user?.nickname ?? '(없음)',
      customerEmail: row.user?.email ?? null,
      subjectName: row.name,
      birthDate: row.birthDate,
      birthTime: row.birthTime,
      updatedAt: row.updatedAt.toISOString(),
      updatedAtLabel: formatKstDateTime(row.updatedAt),
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
