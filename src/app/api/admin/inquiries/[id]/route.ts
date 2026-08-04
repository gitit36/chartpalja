import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AdminAuthError, requireAdmin } from '@/lib/admin/auth'
import { writeAdminAudit } from '@/lib/admin/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      status?: string
      adminNote?: string | null
    }

    const before = await prisma.inquiry.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
    }

    const data: {
      status?: string
      adminNote?: string | null
      resolvedAt?: Date | null
    } = {}

    if (body.status !== undefined) {
      if (body.status !== 'open' && body.status !== 'resolved') {
        return NextResponse.json({ error: '상태 값이 올바르지 않습니다.' }, { status: 400 })
      }
      data.status = body.status
      data.resolvedAt = body.status === 'resolved' ? new Date() : null
    }
    if (body.adminNote !== undefined) {
      data.adminNote = body.adminNote?.trim() || null
    }

    const inquiry = await prisma.inquiry.update({ where: { id }, data })

    await writeAdminAudit({
      actorUserId: admin.id,
      action: data.status === 'resolved' ? 'inquiry.resolve' : 'inquiry.update',
      targetType: 'inquiry',
      targetId: inquiry.id,
      before,
      after: inquiry,
    })

    return NextResponse.json({ inquiry })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/inquiries] PATCH', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
