import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AdminAuthError, requireAdmin } from '@/lib/admin/auth'
import { writeAdminAudit } from '@/lib/admin/audit'

function parseExpires(raw: unknown): Date | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  if (typeof raw !== 'string') throw new Error('INVALID_EXPIRES')
  const days = raw.trim().match(/^(\d+)d$/)
  if (days) return new Date(Date.now() + parseInt(days[1]!, 10) * 24 * 60 * 60 * 1000)
  const d = new Date(raw)
  if (isNaN(d.getTime())) throw new Error('INVALID_EXPIRES')
  return d
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      ju?: number
      maxRedemptions?: number | null
      expiresAt?: string | null
      note?: string | null
      campaignId?: string | null
      active?: boolean
    }

    const before = await prisma.coupon.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 })
    }

    const data: {
      ju?: number
      maxRedemptions?: number | null
      expiresAt?: Date | null
      note?: string | null
      campaignId?: string | null
      active?: boolean
    } = {}

    if (body.ju !== undefined) {
      const ju = Number(body.ju)
      if (!Number.isFinite(ju) || ju <= 0) {
        return NextResponse.json({ error: '지급 주 수는 양수여야 합니다.' }, { status: 400 })
      }
      data.ju = ju
    }
    if (body.maxRedemptions !== undefined) {
      if (body.maxRedemptions === null) data.maxRedemptions = null
      else {
        const max = Number(body.maxRedemptions)
        if (!Number.isFinite(max) || max <= 0) {
          return NextResponse.json({ error: '사용 한도가 올바르지 않습니다.' }, { status: 400 })
        }
        data.maxRedemptions = max
      }
    }
    if (body.expiresAt !== undefined) {
      try {
        data.expiresAt = parseExpires(body.expiresAt) ?? null
      } catch {
        return NextResponse.json({ error: '만료일 형식이 올바르지 않습니다.' }, { status: 400 })
      }
    }
    if (body.note !== undefined) data.note = body.note?.trim() || null
    if (body.campaignId !== undefined) data.campaignId = body.campaignId || null
    if (body.active !== undefined) data.active = !!body.active

    if (data.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } })
      if (!campaign) {
        return NextResponse.json({ error: '캠페인을 찾을 수 없습니다.' }, { status: 400 })
      }
    }

    const coupon = await prisma.coupon.update({ where: { id }, data })

    await writeAdminAudit({
      actorUserId: admin.id,
      action: body.active === false ? 'coupon.deactivate' : 'coupon.update',
      targetType: 'coupon',
      targetId: coupon.id,
      before,
      after: coupon,
    })

    return NextResponse.json({ coupon })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/coupons] PATCH', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        campaign: { select: { id: true, name: true } },
        redemptions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, userId: true, ju: true, createdAt: true },
        },
      },
    })
    if (!coupon) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ coupon })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
