import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AdminAuthError, requireAdmin } from '@/lib/admin/auth'
import { writeAdminAudit } from '@/lib/admin/audit'

const STATUSES = new Set(['draft', 'active', 'ended'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
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

    const before = await prisma.campaign.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ error: '캠페인을 찾을 수 없습니다.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: '이름이 비어 있습니다.' }, { status: 400 })
      data.name = name
    }
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) {
        return NextResponse.json({ error: '상태 값이 올바르지 않습니다.' }, { status: 400 })
      }
      data.status = body.status
    }
    if (body.channel !== undefined) data.channel = body.channel?.trim() || null
    if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null
    if (body.goal !== undefined) data.goal = body.goal?.trim() || null
    if (body.note !== undefined) data.note = body.note?.trim() || null
    if (body.utmSource !== undefined) data.utmSource = body.utmSource?.trim() || null
    if (body.utmMedium !== undefined) data.utmMedium = body.utmMedium?.trim() || null
    if (body.utmContent !== undefined) data.utmContent = body.utmContent?.trim() || null
    if (body.landingUrl !== undefined) data.landingUrl = body.landingUrl?.trim() || null

    const campaign = await prisma.campaign.update({ where: { id }, data })

    await writeAdminAudit({
      actorUserId: admin.id,
      action: 'campaign.update',
      targetType: 'campaign',
      targetId: campaign.id,
      before,
      after: campaign,
    })

    return NextResponse.json({ campaign })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/campaigns] PATCH', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
