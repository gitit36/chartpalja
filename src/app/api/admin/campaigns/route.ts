import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AdminAuthError, requireAdmin } from '@/lib/admin/auth'
import { writeAdminAudit } from '@/lib/admin/audit'

const STATUSES = new Set(['draft', 'active', 'ended'])

export async function GET() {
  try {
    await requireAdmin()
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        coupons: {
          select: {
            id: true,
            code: true,
            ju: true,
            active: true,
            redeemedCount: true,
            maxRedemptions: true,
          },
        },
      },
    })
    return NextResponse.json({ campaigns })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      status?: string
      channel?: string | null
      startsAt?: string | null
      endsAt?: string | null
      goal?: string | null
      note?: string | null
      utmSource?: string | null
      utmMedium?: string | null
      utmContent?: string | null
      landingUrl?: string | null
    }

    const name = (body.name ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: '캠페인 이름이 필요합니다.' }, { status: 400 })
    }
    const status = body.status && STATUSES.has(body.status) ? body.status : 'draft'

    const campaign = await prisma.campaign.create({
      data: {
        name,
        status,
        channel: body.channel?.trim() || null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        goal: body.goal?.trim() || null,
        note: body.note?.trim() || null,
        utmSource: body.utmSource?.trim() || null,
        utmMedium: body.utmMedium?.trim() || null,
        utmContent: body.utmContent?.trim() || null,
        landingUrl: body.landingUrl?.trim() || null,
      },
    })

    await writeAdminAudit({
      actorUserId: admin.id,
      action: 'campaign.create',
      targetType: 'campaign',
      targetId: campaign.id,
      after: campaign,
    })

    return NextResponse.json({ campaign })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/campaigns] POST', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
