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

const AGE_BUCKETS = ['~19', '20대', '30대', '40대', '50대', '60대+'] as const
const ELEMENT_ORDER = ['木', '火', '土', '金', '水'] as const
const ELEMENT_LABEL: Record<string, string> = {
  木: '목',
  火: '화',
  土: '토',
  金: '금',
  水: '수',
}

function parseBirthYear(birthDate: string): number | null {
  const m = birthDate.trim().match(/^(\d{4})/)
  if (!m) return null
  const y = parseInt(m[1]!, 10)
  if (y < 1900 || y > 2100) return null
  return y
}

function ageBucket(birthDate: string, nowYear: number): (typeof AGE_BUCKETS)[number] | null {
  const by = parseBirthYear(birthDate)
  if (by == null) return null
  const age = nowYear - by
  if (age < 0 || age > 120) return null
  if (age < 20) return '~19'
  if (age < 30) return '20대'
  if (age < 40) return '30대'
  if (age < 50) return '40대'
  if (age < 60) return '50대'
  return '60대+'
}

function genderLabel(g: string): '남' | '여' | '기타' {
  const v = g.trim().toLowerCase()
  if (v === 'male' || v === 'm' || v === '남' || v === '남자') return '남'
  if (v === 'female' || v === 'f' || v === '여' || v === '여자') return '여'
  return '기타'
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

export async function getDashboardData(range: AdminRangeKey) {
  const since = rangeStart(range)
  const now = new Date()
  const todayStart = startOfKstDay(now)
  const dateKeys = eachKstDateKey(since)
  const nowYear = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear()
  const exclude = excludeNicknames()

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
    // composition (기간 내 생성된 사주)
    compositionEntries,
    juUsageRows,
    paymentMethods,
    sharedInRange,
    payingUserIds,
    entryCountsByUser,
    balances,
    usersWithEntryInRange,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: since }, role: UserRole.USER },
      select: { id: true, createdAt: true },
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
      select: { amount: true, currency: true, paidAt: true, productCode: true, userId: true },
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
          NOT: { nickname: { in: exclude } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        name: true,
        gender: true,
        birthDate: true,
        birthTime: true,
        updatedAt: true,
        createdAt: true,
        user: {
          select: { id: true, nickname: true, email: true },
        },
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: todayStart }, role: UserRole.USER } }),
    prisma.sajuEntry.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.paymentOrder.aggregate({
      where: { status: 'paid', paidAt: { gte: todayStart }, currency: 'KRW' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.sajuEntry.findMany({
      where: { createdAt: { gte: since } },
      select: { gender: true, birthDate: true, dayElement: true, userId: true, guestId: true },
    }),
    prisma.entitlementLedger.findMany({
      where: {
        createdAt: { gte: since },
        delta: { lt: 0 },
        reason: { in: ['use:fortune', 'use:period', 'use:compat'] },
      },
      select: { reason: true, delta: true },
    }),
    prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: { gte: since }, paymentMethod: { not: null } },
      select: { paymentMethod: true },
    }),
    prisma.sajuEntry.count({
      where: { createdAt: { gte: since }, isShared: true },
    }),
    prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.sajuEntry.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        user: { role: UserRole.USER },
      },
      _count: { _all: true },
    }),
    prisma.userBalance.findMany({
      where: { user: { role: UserRole.USER } },
      select: { ju: true },
    }),
    prisma.sajuEntry.findMany({
      where: { createdAt: { gte: since }, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
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

  // ── 구성 통계 (기간 내 사주) ──
  const genderCounts = { 남: 0, 여: 0, 기타: 0 }
  const ageCounts: Record<(typeof AGE_BUCKETS)[number], number> = {
    '~19': 0,
    '20대': 0,
    '30대': 0,
    '40대': 0,
    '50대': 0,
    '60대+': 0,
  }
  const elementCounts: Record<string, number> = {
    木: 0,
    火: 0,
    土: 0,
    金: 0,
    水: 0,
    기타: 0,
  }
  let memberEntries = 0
  let guestOnlyEntries = 0
  for (const e of compositionEntries) {
    genderCounts[genderLabel(e.gender)] += 1
    const bucket = ageBucket(e.birthDate, nowYear)
    if (bucket) ageCounts[bucket] += 1
    const el = e.dayElement?.trim() ?? ''
    if (el && el in elementCounts && el !== '기타') elementCounts[el] += 1
    else if (el) elementCounts['기타'] += 1
    if (e.userId) memberEntries += 1
    else if (e.guestId) guestOnlyEntries += 1
  }
  const compositionTotal = compositionEntries.length

  // 주 사용처
  const juByReason = { fortune: 0, period: 0, compat: 0 }
  for (const row of juUsageRows) {
    const used = Math.abs(row.delta)
    if (row.reason === 'use:fortune') juByReason.fortune += used
    else if (row.reason === 'use:period') juByReason.period += used
    else if (row.reason === 'use:compat') juByReason.compat += used
  }

  // 결제수단
  const methodCounts: Record<string, number> = {}
  for (const o of paymentMethods) {
    const m = o.paymentMethod || 'unknown'
    methodCounts[m] = (methodCounts[m] ?? 0) + 1
  }

  // 유저당 사주 수 (전체 누적, USER만)
  const entryPerUser = { one: 0, twoThree: 0, fourPlus: 0 }
  for (const g of entryCountsByUser) {
    const n = g._count._all
    if (n <= 1) entryPerUser.one += 1
    else if (n <= 3) entryPerUser.twoThree += 1
    else entryPerUser.fourPlus += 1
  }
  const usersWithEntries = entryCountsByUser.length

  // 잔액 분포
  let zeroBalance = 0
  let lowBalance = 0 // 1~4
  let midBalance = 0 // 5+
  for (const b of balances) {
    if (b.ju <= 0) zeroBalance += 1
    else if (b.ju < 5) lowBalance += 1
    else midBalance += 1
  }
  const balanceTotal = balances.length

  // 퍼널 (기간 내)
  const signups = usersInRange.length
  const usersWithEntry = usersWithEntryInRange.length
  const payingUsers = payingUserIds.length
  const juUsed = Math.abs(juUsedInRange._sum.delta ?? 0)
  const arpu = payingUsers > 0 ? Math.round(revenueKrw / payingUsers) : 0

  return {
    range,
    since: since.toISOString(),
    summary: {
      signups,
      entries: entriesInRange.length,
      guestEntries: guestEntriesInRange,
      paidOrders: paidOrdersInRange.length,
      revenueKrw,
      couponRedeems: couponRedeemsInRange,
      juUsed,
      openInquiries,
      payingUsers,
      arpu,
      sharedEntries: sharedInRange,
      shareRate: pct(sharedInRange, compositionTotal),
      payConvertRate: pct(payingUsers, signups),
      entryConvertRate: pct(usersWithEntry, signups),
      zeroBalanceRate: pct(zeroBalance, balanceTotal),
      today: {
        signups: usersToday,
        entries: entriesToday,
        paidOrders: paidToday._count,
        revenueKrw: paidToday._sum.amount ?? 0,
      },
    },
    funnel: {
      signups,
      usersWithEntry,
      payingUsers,
      entryRate: pct(usersWithEntry, signups),
      payRate: pct(payingUsers, signups),
      payGivenEntry: pct(payingUsers, usersWithEntry),
    },
    charts: {
      dates: dateKeys,
      signups: dateKeys.map((k) => signupByDay[k] ?? 0),
      entries: dateKeys.map((k) => entryByDay[k] ?? 0),
      revenue: dateKeys.map((k) => revenueByDay[k] ?? 0),
      productMix: Object.entries(productMix)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      gender: [
        { key: '남', label: '남', count: genderCounts.남, pct: pct(genderCounts.남, compositionTotal) },
        { key: '여', label: '여', count: genderCounts.여, pct: pct(genderCounts.여, compositionTotal) },
        ...(genderCounts.기타 > 0
          ? [{ key: '기타', label: '기타', count: genderCounts.기타, pct: pct(genderCounts.기타, compositionTotal) }]
          : []),
      ],
      age: AGE_BUCKETS.map((key) => ({
        key,
        label: key,
        count: ageCounts[key],
        pct: pct(ageCounts[key], compositionTotal),
      })),
      dayElement: [
        ...ELEMENT_ORDER.map((key) => ({
          key,
          label: ELEMENT_LABEL[key] ?? key,
          count: elementCounts[key] ?? 0,
          pct: pct(elementCounts[key] ?? 0, compositionTotal),
        })),
        ...(elementCounts.기타 > 0
          ? [{ key: '기타', label: '기타', count: elementCounts.기타, pct: pct(elementCounts.기타, compositionTotal) }]
          : []),
      ],
      juUsage: [
        { key: 'fortune', label: '운세', count: juByReason.fortune },
        { key: 'period', label: '구간', count: juByReason.period },
        { key: 'compat', label: '궁합', count: juByReason.compat },
      ],
      paymentMethods: Object.entries(methodCounts)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      ownership: [
        { key: 'member', label: '회원', count: memberEntries, pct: pct(memberEntries, compositionTotal) },
        { key: 'guest', label: '게스트', count: guestOnlyEntries, pct: pct(guestOnlyEntries, compositionTotal) },
      ],
      entriesPerUser: [
        { key: '1', label: '1개', count: entryPerUser.one, pct: pct(entryPerUser.one, usersWithEntries) },
        { key: '2-3', label: '2~3개', count: entryPerUser.twoThree, pct: pct(entryPerUser.twoThree, usersWithEntries) },
        { key: '4+', label: '4개+', count: entryPerUser.fourPlus, pct: pct(entryPerUser.fourPlus, usersWithEntries) },
      ],
      balance: [
        { key: '0', label: '0주', count: zeroBalance, pct: pct(zeroBalance, balanceTotal) },
        { key: '1-4', label: '1~4주', count: lowBalance, pct: pct(lowBalance, balanceTotal) },
        { key: '5+', label: '5주+', count: midBalance, pct: pct(midBalance, balanceTotal) },
      ],
      compositionTotal,
    },
    recentLookups: recentLookups.map((row) => ({
      entryId: row.id,
      customerNickname: row.user?.nickname ?? '(없음)',
      customerEmail: row.user?.email ?? null,
      subjectName: row.name,
      gender: genderLabel(row.gender),
      birthDate: row.birthDate,
      birthTime: row.birthTime,
      updatedAt: row.updatedAt.toISOString(),
      updatedAtLabel: formatKstDateTime(row.updatedAt),
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
