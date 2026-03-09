import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    const user = await requireUser()
    const orders = await prisma.paymentOrder.findMany({
      where: { userId: user.id, status: 'paid' },
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        productCode: true,
        productType: true,
        quantity: true,
        amount: true,
        status: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
      },
      take: 50,
    })
    return NextResponse.json({ orders })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
