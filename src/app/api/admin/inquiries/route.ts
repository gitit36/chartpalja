import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AdminAuthError, requireAdmin } from '@/lib/admin/auth'
import { writeAdminAudit } from '@/lib/admin/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const status = request.nextUrl.searchParams.get('status')
    const where = status === 'open' || status === 'resolved' ? { status } : {}
    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ inquiries })
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
