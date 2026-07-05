import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { SIGNUP_BONUS_JU } from '@/lib/payment/entitlement'

/** 코드 정규화: 공백 제거 + 대문자. */
function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요.', code: 'AUTH' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { code?: string }
    const code = normalizeCode(body.code ?? '')
    if (!code) {
      return NextResponse.json({ error: '쿠폰 코드를 입력해 주세요.' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({ where: { code } })
    if (!coupon || !coupon.active) {
      return NextResponse.json({ error: '존재하지 않는 쿠폰이에요.' }, { status: 404 })
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: '만료된 쿠폰이에요.' }, { status: 410 })
    }
    if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
      return NextResponse.json({ error: '모두 소진된 쿠폰이에요.' }, { status: 409 })
    }

    // 이미 사용했는지 선제 확인 (친절한 메시지용). 최종 방어는 트랜잭션의 unique.
    const already = await prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId: user.id } },
    })
    if (already) {
      return NextResponse.json({ error: '이미 사용한 쿠폰이에요.' }, { status: 409 })
    }

    const balance = await prisma.$transaction(async (tx) => {
      // 1인 1회: unique 위반 시 P2002 → 이미 사용.
      await tx.couponRedemption.create({
        data: { couponId: coupon.id, userId: user.id, ju: coupon.ju },
      })

      // 전체 한도 방어: 조건부 증가(레이스 안전). 무제한이면 조건 없이 증가.
      if (coupon.maxRedemptions != null) {
        const updated = await tx.coupon.updateMany({
          where: { id: coupon.id, redeemedCount: { lt: coupon.maxRedemptions } },
          data: { redeemedCount: { increment: 1 } },
        })
        if (updated.count === 0) {
          throw new CouponSoldOutError()
        }
      } else {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { redeemedCount: { increment: 1 } },
        })
      }

      const existing = await tx.userBalance.findUnique({ where: { userId: user.id } })
      const nextJu = existing
        ? (await tx.userBalance.update({
            where: { userId: user.id },
            data: { ju: { increment: coupon.ju } },
          })).ju
        : (await tx.userBalance.create({
            data: { userId: user.id, ju: SIGNUP_BONUS_JU + coupon.ju },
          })).ju

      await tx.entitlementLedger.create({
        data: { userId: user.id, creditType: 'ju', delta: coupon.ju, reason: `coupon:${code}` },
      })

      return nextJu
    })

    return NextResponse.json({ ok: true, addedJu: coupon.ju, balance })
  } catch (err) {
    if (err instanceof CouponSoldOutError) {
      return NextResponse.json({ error: '모두 소진된 쿠폰이에요.' }, { status: 409 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: '이미 사용한 쿠폰이에요.' }, { status: 409 })
    }
    console.error('[coupon] redeem failed:', err)
    return NextResponse.json({ error: '쿠폰 등록 중 오류가 발생했어요.' }, { status: 500 })
  }
}

class CouponSoldOutError extends Error {}
