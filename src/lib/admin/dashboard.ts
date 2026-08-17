import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  type AdminRange,
  eachKstDateKey,
  formatKstDate,
  formatKstDateTime,
  startOfKstDay,
} from './dates'
import { getGrowthMetrics } from './growth'

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

function estimateAge(birthDate: string, nowYear: number): number | null {
  const by = parseBirthYear(birthDate)
  if (by == null) return null
  const age = nowYear - by
  if (age < 0 || age > 120) return null
  return age
}

function ageBucket(birthDate: string, nowYear: number): (typeof AGE_BUCKETS)[number] | null {
  const age = estimateAge(birthDate, nowYear)
  if (age == null) return null
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

function mean(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
  }
  return sorted[mid]!
}

function runningSum(daily: number[]): number[] {
  let acc = 0
  return daily.map((n) => {
    acc += n
    return acc
  })
}

function funnelRates(step1: number, step2: number, step3: number) {
  return {
    step1,
    step2,
    step3,
    rate12: pct(step2, step1),
    rate13: pct(step3, step1),
    rate23: pct(step3, step2),
  }
}

export async function getDashboardData(range: AdminRange) {
  const since = range.start
  const until = range.endExclusive
  const inRange = { gte: since, lt: until }
  const now = new Date()
  const todayStart = startOfKstDay(now)
  const dateKeys = eachKstDateKey(since, until)
  const nowYear = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear()
  const exclude = excludeNicknames()
  const growthPromise = getGrowthMetrics(since, until, dateKeys)

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
    compositionEntries,
    juUsageRows,
    paymentMethods,
    sharedInRange,
    entryCountsInPeriod,
    // 기간 이전 누적 베이스라인 (전체 누적 차트용)
    signupsBefore,
    entriesBefore,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: inRange, role: UserRole.USER },
      select: { id: true, createdAt: true },
    }),
    prisma.sajuEntry.findMany({
      where: { createdAt: inRange },
      select: { createdAt: true, userId: true, guestId: true },
    }),
    prisma.sajuEntry.count({
      where: { createdAt: inRange, userId: null, guestId: { not: null } },
    }),
    prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: inRange },
      select: { amount: true, currency: true, paidAt: true, productCode: true, userId: true, paymentMethod: true },
    }),
    prisma.couponRedemption.count({
      where: { createdAt: inRange },
    }),
    prisma.entitlementLedger.aggregate({
      where: {
        createdAt: inRange,
        delta: { lt: 0 },
        reason: { startsWith: 'use:' },
      },
      _sum: { delta: true },
    }),
    prisma.inquiry.count({ where: { status: 'open' } }),
    prisma.sajuEntry.findMany({
      where: {
        updatedAt: inRange,
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
        user: { select: { id: true, nickname: true, email: true } },
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
      where: { createdAt: inRange },
      select: { gender: true, birthDate: true, dayElement: true, userId: true, guestId: true },
    }),
    prisma.entitlementLedger.findMany({
      where: {
        createdAt: inRange,
        delta: { lt: 0 },
        reason: { in: ['use:fortune', 'use:period', 'use:compat'] },
      },
      select: { reason: true, delta: true },
    }),
    prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: inRange, paymentMethod: { not: null } },
      select: { paymentMethod: true },
    }),
    prisma.sajuEntry.count({
      where: { createdAt: inRange, isShared: true },
    }),
    prisma.sajuEntry.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: inRange,
        user: { role: UserRole.USER },
      },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { createdAt: { lt: since }, role: UserRole.USER } }),
    prisma.sajuEntry.count({ where: { createdAt: { lt: since } } }),
  ])

  const growth = await growthPromise

  const signupIds = usersInRange.map((u) => u.id)

  // ── 코호트 퍼널: 기간 내 가입자 → (현재까지) 엔트리 보유 → (현재까지) 결제 ──
  const [cohortEntryUsers, cohortPaidUsers] = signupIds.length
    ? await Promise.all([
        prisma.sajuEntry.findMany({
          where: { userId: { in: signupIds } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.paymentOrder.findMany({
          where: { userId: { in: signupIds }, status: 'paid' },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ])
    : [[], []]

  const cohortSignup = signupIds.length
  const cohortWithEntry = cohortEntryUsers.length
  const cohortPaid = cohortPaidUsers.length

  // ── 활성 퍼널: 기간 내 사주 생성 유저 → 기간 내 결제 유저 ──
  const activeEntryUserIds = [
    ...new Set(
      entriesInRange.map((e) => e.userId).filter((id): id is string => !!id),
    ),
  ]
  const activePaidInRange = new Set(paidOrdersInRange.map((o) => o.userId))
  const activeEntryUsers = activeEntryUserIds.length
  const activePaidAmongEntry = activeEntryUserIds.filter((id) => activePaidInRange.has(id)).length
  const activePaidUsers = activePaidInRange.size

  // 기간 활성 유저의 현재 잔액 (가입 or 엔트리 or 결제)
  const activeUserIdSet = new Set<string>([
    ...signupIds,
    ...activeEntryUserIds,
    ...paidOrdersInRange.map((o) => o.userId),
  ])
  const activeUserIds = [...activeUserIdSet]
  const balances = activeUserIds.length
    ? await prisma.userBalance.findMany({
        where: { userId: { in: activeUserIds } },
        select: { userId: true, ju: true },
      })
    : []
  // balance row 없는 활성 유저는 아직 getBalance 안 탄 경우 → 기본 5주로 간주하지 않고 제외(실잔액만)
  const balanceValues = balances.map((b) => b.ju)

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

  const dailySignups = dateKeys.map((k) => signupByDay[k] ?? 0)
  const dailyEntries = dateKeys.map((k) => entryByDay[k] ?? 0)
  const dailyRevenue = dateKeys.map((k) => revenueByDay[k] ?? 0)
  const periodCumSignups = runningSum(dailySignups)
  const periodCumEntries = runningSum(dailyEntries)
  const periodCumRevenue = runningSum(dailyRevenue)
  const totalCumSignups = periodCumSignups.map((n) => n + signupsBefore)
  const totalCumEntries = periodCumEntries.map((n) => n + entriesBefore)

  const productMix: Record<string, number> = {}
  for (const o of paidOrdersInRange) {
    productMix[o.productCode] = (productMix[o.productCode] ?? 0) + 1
  }

  const genderCounts = { 남: 0, 여: 0, 기타: 0 }
  const ageCounts: Record<(typeof AGE_BUCKETS)[number], number> = {
    '~19': 0,
    '20대': 0,
    '30대': 0,
    '40대': 0,
    '50대': 0,
    '60대+': 0,
  }
  const elementCounts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0, 기타: 0 }
  let memberEntries = 0
  let guestOnlyEntries = 0
  const ages: number[] = []
  for (const e of compositionEntries) {
    genderCounts[genderLabel(e.gender)] += 1
    const bucket = ageBucket(e.birthDate, nowYear)
    if (bucket) ageCounts[bucket] += 1
    const age = estimateAge(e.birthDate, nowYear)
    if (age != null) ages.push(age)
    const el = e.dayElement?.trim() ?? ''
    if (el && el in elementCounts && el !== '기타') elementCounts[el] += 1
    else if (el) elementCounts['기타'] += 1
    if (e.userId) memberEntries += 1
    else if (e.guestId) guestOnlyEntries += 1
  }
  const compositionTotal = compositionEntries.length

  const juByReason = { fortune: 0, period: 0, compat: 0 }
  for (const row of juUsageRows) {
    const used = Math.abs(row.delta)
    if (row.reason === 'use:fortune') juByReason.fortune += used
    else if (row.reason === 'use:period') juByReason.period += used
    else if (row.reason === 'use:compat') juByReason.compat += used
  }

  const methodCounts: Record<string, number> = {}
  for (const o of paymentMethods) {
    const m = o.paymentMethod || 'unknown'
    methodCounts[m] = (methodCounts[m] ?? 0) + 1
  }

  // 기간 내 엔트리 생성 유저별 건수
  const entryCountValues: number[] = []
  const entryPerUser = { one: 0, twoThree: 0, fourPlus: 0 }
  for (const g of entryCountsInPeriod) {
    if (!g.userId) continue
    const n = g._count._all
    entryCountValues.push(n)
    if (n <= 1) entryPerUser.one += 1
    else if (n <= 3) entryPerUser.twoThree += 1
    else entryPerUser.fourPlus += 1
  }
  const usersWithEntriesInPeriod = entryCountValues.length

  let zeroBalance = 0
  let lowBalance = 0
  let midBalance = 0
  for (const ju of balanceValues) {
    if (ju <= 0) zeroBalance += 1
    else if (ju < 5) lowBalance += 1
    else midBalance += 1
  }
  const balanceTotal = balanceValues.length

  const signups = cohortSignup
  const juUsed = Math.abs(juUsedInRange._sum.delta ?? 0)
  const arpu = activePaidUsers > 0 ? Math.round(revenueKrw / activePaidUsers) : 0

  const cohort = funnelRates(cohortSignup, cohortWithEntry, cohortPaid)

  return {
    range: range.preset,
    rangeLabel: range.label,
    fromKey: range.fromKey,
    toKey: range.toKey,
    since: since.toISOString(),
    until: until.toISOString(),
    summary: {
      signups,
      entries: entriesInRange.length,
      guestEntries: guestEntriesInRange,
      paidOrders: paidOrdersInRange.length,
      revenueKrw,
      couponRedeems: couponRedeemsInRange,
      juUsed,
      openInquiries,
      payingUsers: activePaidUsers,
      cohortPayingUsers: cohortPaid,
      arpu,
      sharedEntries: sharedInRange,
      shareRate: pct(sharedInRange, compositionTotal),
      /** 코호트 기준 결제 전환율 */
      payConvertRate: cohort.rate13,
      entryConvertRate: cohort.rate12,
      zeroBalanceRate: pct(zeroBalance, balanceTotal),
      dau: growth.latest.dau,
      nau: growth.latest.nau,
      eau: growth.latest.eau,
      rau: growth.latest.rau,
      stickinessWau: growth.latest.stickinessWau,
      stickinessMau: growth.latest.stickinessMau,
      today: {
        signups: usersToday,
        entries: entriesToday,
        paidOrders: paidToday._count,
        revenueKrw: paidToday._sum.amount ?? 0,
      },
    },
    funnel: {
      cohort: {
        ...cohort,
        labels: ['신규 가입', '사주 보유', '결제'],
        description: '기간 내 가입한 유저만 추적 · 엔트리/결제는 가입 이후 현재까지',
      },
      active: {
        step1: activeEntryUsers,
        step2: activePaidAmongEntry,
        step3: activePaidUsers,
        rate12: pct(activePaidAmongEntry, activeEntryUsers),
        rate13: pct(activePaidUsers, activeEntryUsers),
        rate23: pct(activePaidAmongEntry, activePaidUsers),
        labels: ['사주 생성 유저', '그중 결제', '기간 결제 유저'],
        description: '기간 내 활동 기준 · 기존 가입자도 포함 (가입 수와 직접 비교 불가)',
      },
    },
    stats: {
      age: { avg: mean(ages), median: median(ages), n: ages.length },
      entriesPerUser: {
        avg: mean(entryCountValues),
        median: median(entryCountValues),
        n: usersWithEntriesInPeriod,
      },
      balance: {
        avg: mean(balanceValues),
        median: median(balanceValues),
        n: balanceTotal,
      },
    },
    charts: {
      dates: dateKeys,
      signups: dailySignups,
      entries: dailyEntries,
      revenue: dailyRevenue,
      signupsPeriodCum: periodCumSignups,
      entriesPeriodCum: periodCumEntries,
      revenuePeriodCum: periodCumRevenue,
      signupsTotalCum: totalCumSignups,
      entriesTotalCum: totalCumEntries,
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
        { key: '1', label: '1개', count: entryPerUser.one, pct: pct(entryPerUser.one, usersWithEntriesInPeriod) },
        { key: '2-3', label: '2~3개', count: entryPerUser.twoThree, pct: pct(entryPerUser.twoThree, usersWithEntriesInPeriod) },
        { key: '4+', label: '4개+', count: entryPerUser.fourPlus, pct: pct(entryPerUser.fourPlus, usersWithEntriesInPeriod) },
      ],
      balance: [
        { key: '0', label: '0주', count: zeroBalance, pct: pct(zeroBalance, balanceTotal) },
        { key: '1-4', label: '1~4주', count: lowBalance, pct: pct(lowBalance, balanceTotal) },
        { key: '5+', label: '5주+', count: midBalance, pct: pct(midBalance, balanceTotal) },
      ],
      compositionTotal,
    },
    growth,
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
