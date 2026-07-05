/**
 * 쿠폰 생성/수정 스크립트 (upsert).
 *
 * 사용:
 *   npx tsx scripts/create-coupon.ts EARLY15 --ju 15 --expires 14d --max 100
 *   npx tsx scripts/create-coupon.ts VIP50 --ju 50 --expires 2026-08-01 --note "핵심 지인"
 *   npx tsx scripts/create-coupon.ts EARLY15 --off        # 비활성화
 *
 * 옵션:
 *   --ju N        지급 주(株) 수 (필수, 신규 생성 시)
 *   --max N       전체 사용 한도 (미지정 = 무제한)
 *   --expires X   만료: "14d"(14일 후) 또는 "2026-08-01"(해당일 00:00 KST)
 *   --note "..."  캠페인 메모
 *   --off         active=false 로 비활성화
 *   --reset       사용 기록 삭제 + redeemedCount 0 (배포 전 초기화)
 *
 * 참고: 지정하지 않은 옵션은 기존 값을 그대로 유지합니다.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function parseExpires(raw?: string): Date | null {
  if (!raw) return null
  const days = raw.match(/^(\d+)d$/)
  if (days) return new Date(Date.now() + parseInt(days[1]!, 10) * 24 * 60 * 60 * 1000)
  const d = new Date(raw)
  if (isNaN(d.getTime())) throw new Error(`잘못된 --expires 값: ${raw}`)
  return d
}

async function main() {
  const code = process.argv[2]?.trim().toUpperCase()
  if (!code || code.startsWith('--')) {
    console.error('사용: npx tsx scripts/create-coupon.ts <CODE> --ju <N> [--max N] [--expires 14d] [--note "..."]')
    process.exit(1)
  }

  const juArg = getFlag('ju')
  const maxArg = getFlag('max')
  const expiresArg = getFlag('expires')
  const note = getFlag('note')
  const off = hasFlag('off')
  const reset = hasFlag('reset')

  const existing = await prisma.coupon.findUnique({ where: { code } })

  if (off) {
    if (!existing) { console.warn(`[skip] 쿠폰 없음: ${code}`); return }
    await prisma.coupon.update({ where: { code }, data: { active: false } })
    console.log(`[ok] ${code} 비활성화됨`)
    return
  }

  // 배포 전 초기화: 사용기록 삭제 + 카운터 0.
  if (reset && existing) {
    const del = await prisma.couponRedemption.deleteMany({ where: { couponId: existing.id } })
    await prisma.coupon.update({ where: { id: existing.id }, data: { redeemedCount: 0 } })
    console.log(`[reset] ${code}: 사용기록 ${del.count}건 삭제, redeemedCount=0`)
  }

  const ju = juArg != null ? parseInt(juArg, 10) : existing?.ju
  if (ju == null || isNaN(ju) || ju <= 0) {
    console.error('신규 생성 시 --ju <양수> 필요')
    process.exit(1)
  }

  // 지정한 필드만 갱신 (미지정 옵션은 기존 값 유지).
  const updateData: {
    ju: number
    active: boolean
    maxRedemptions?: number | null
    expiresAt?: Date | null
    note?: string
  } = { ju, active: true }
  if (maxArg != null) updateData.maxRedemptions = parseInt(maxArg, 10)
  if (expiresArg != null) updateData.expiresAt = parseExpires(expiresArg)
  if (note != null) updateData.note = note

  const coupon = await prisma.coupon.upsert({
    where: { code },
    create: {
      code,
      ju,
      maxRedemptions: maxArg != null ? parseInt(maxArg, 10) : null,
      expiresAt: parseExpires(expiresArg),
      note,
      active: true,
    },
    update: updateData,
  })

  console.log('[ok] 쿠폰 저장됨:', {
    code: coupon.code,
    ju: coupon.ju,
    maxRedemptions: coupon.maxRedemptions ?? '무제한',
    redeemedCount: coupon.redeemedCount,
    expiresAt: coupon.expiresAt?.toISOString() ?? '무기한',
    active: coupon.active,
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
