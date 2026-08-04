import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AdminAuthError, requireAdmin } from '@/lib/admin/auth'
import { writeAdminAudit } from '@/lib/admin/audit'

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

function parseExpires(raw: unknown): Date | null | undefined {
  if (raw === null) return null
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !raw.trim()) return null
  const days = raw.trim().match(/^(\d+)d$/)
  if (days) return new Date(Date.now() + parseInt(days[1]!, 10) * 24 * 60 * 60 * 1000)
  const d = new Date(raw)
  if (isNaN(d.getTime())) throw new Error('INVALID_EXPIRES')
  return d
}

export async function GET() {
  try {
    await requireAdmin()
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } },
      },
    })
    return NextResponse.json({ coupons })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/coupons] GET', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = (await request.json().catch(() => ({}))) as {
      code?: string
      ju?: number
      maxRedemptions?: number | null
      expiresAt?: string | null
      note?: string | null
      campaignId?: string | null
      active?: boolean
    }

    const code = normalizeCode(body.code ?? '')
    if (!code) {
      return NextResponse.json({ error: '쿠폰 코드가 필요합니다.' }, { status: 400 })
    }
    const ju = Number(body.ju)
    if (!Number.isFinite(ju) || ju <= 0) {
      return NextResponse.json({ error: '지급 주 수는 양수여야 합니다.' }, { status: 400 })
    }

    let expiresAt: Date | null = null
    try {
      expiresAt = parseExpires(body.expiresAt) ?? null
    } catch {
      return NextResponse.json({ error: '만료일 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    const maxRedemptions =
      body.maxRedemptions == null || body.maxRedemptions === undefined
        ? null
        : Number(body.maxRedemptions)
    if (maxRedemptions != null && (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0)) {
      return NextResponse.json({ error: '사용 한도는 양수이거나 비워야 합니다.' }, { status: 400 })
    }

    if (body.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: body.campaignId } })
      if (!campaign) {
        return NextResponse.json({ error: '캠페인을 찾을 수 없습니다.' }, { status: 400 })
      }
    }

    const existing = await prisma.coupon.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 코드입니다.' }, { status: 409 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        ju,
        maxRedemptions,
        expiresAt,
        note: body.note?.trim() || null,
        campaignId: body.campaignId || null,
        active: body.active !== false,
      },
    })

    await writeAdminAudit({
      actorUserId: admin.id,
      action: 'coupon.create',
      targetType: 'coupon',
      targetId: coupon.id,
      after: coupon,
    })

    return NextResponse.json({ coupon })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/coupons] POST', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
