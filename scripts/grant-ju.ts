/**
 * 운영자/테스트 계정 주(株) 충전 스크립트.
 *
 * 사용:
 *   npx tsx scripts/grant-ju.ts                         # 기본 대상에 절대값 설정
 *   npx tsx scripts/grant-ju.ts will36@naver.com +100   # 해당 이메일에 100주 추가
 *   npx tsx scripts/grant-ju.ts review@chartpalja.com 50 # 해당 이메일 잔액을 50주로 설정
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_TARGETS: { email: string; ju: number; reason: string }[] = [
  { email: process.env.OPERATOR_EMAIL ?? 'will36@naver.com', ju: 50, reason: 'operator_grant' },
  { email: 'review@chartpalja.com', ju: 30, reason: 'test_grant' },
]

async function setJu(userId: string, ju: number, reason: string) {
  const balance = await prisma.userBalance.findUnique({ where: { userId } })
  if (!balance) {
    await prisma.$transaction([
      prisma.userBalance.create({ data: { userId, ju } }),
      prisma.entitlementLedger.create({ data: { userId, creditType: 'ju', delta: ju, reason } }),
    ])
    return { action: 'created', ju }
  }
  const delta = ju - balance.ju
  if (delta === 0) return { action: 'unchanged', ju: balance.ju }
  await prisma.$transaction([
    prisma.userBalance.update({ where: { userId }, data: { ju } }),
    prisma.entitlementLedger.create({ data: { userId, creditType: 'ju', delta, reason } }),
  ])
  return { action: delta > 0 ? 'topped_up' : 'adjusted', ju }
}

async function addJu(userId: string, delta: number, reason: string) {
  const balance = await prisma.userBalance.findUnique({ where: { userId } })
  const current = balance?.ju ?? 0
  const next = current + delta
  if (!balance) {
    await prisma.$transaction([
      prisma.userBalance.create({ data: { userId, ju: next } }),
      prisma.entitlementLedger.create({ data: { userId, creditType: 'ju', delta, reason } }),
    ])
    return { action: 'created', ju: next }
  }
  if (delta === 0) return { action: 'unchanged', ju: current }
  await prisma.$transaction([
    prisma.userBalance.update({ where: { userId }, data: { ju: next } }),
    prisma.entitlementLedger.create({ data: { userId, creditType: 'ju', delta, reason } }),
  ])
  return { action: delta > 0 ? 'added' : 'deducted', ju: next }
}

async function grantByEmail(email: string, amount: string, reason: string) {
  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    console.warn(`[skip] user not found: ${email}`)
    return
  }
  const result = amount.startsWith('+') || amount.startsWith('-')
    ? await addJu(user.id, parseInt(amount, 10), reason)
    : await setJu(user.id, parseInt(amount, 10), reason)
  console.log(`[ok] ${email} → ${result.ju}주 (${result.action})`)
}

async function main() {
  const [emailArg, amountArg] = process.argv.slice(2)
  if (emailArg && amountArg) {
    await grantByEmail(emailArg, amountArg, 'manual_grant')
    return
  }
  for (const t of DEFAULT_TARGETS) {
    await grantByEmail(t.email, String(t.ju), t.reason)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
