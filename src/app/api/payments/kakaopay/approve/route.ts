import { NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const pgToken = searchParams.get('pg_token')

    if (!orderId || !pgToken) {
      redirect('/app/payment/fail?error=missing_params')
    }

    // Load order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { session: true },
    })

    if (!order) {
      redirect('/app/payment/fail?error=order_not_found')
    }

    if (order.userId !== user.id) {
      redirect('/app/payment/fail?error=unauthorized')
    }

    if (order.status !== 'READY') {
      redirect(`/app/session/${order.sessionId}/summary?error=order_not_ready`)
    }

    // Call KakaoPay approve API
    const adminKey = process.env.KAKAOPAY_ADMIN_KEY
    const cid = process.env.KAKAOPAY_CID

    if (!adminKey || !cid) {
      redirect('/app/payment/fail?error=config_error')
    }

    const approveResponse = await fetch('https://kapi.kakao.com/v1/payment/approve', {
      method: 'POST',
      headers: {
        'Authorization': `KakaoAK ${adminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        cid,
        tid: order.tid!,
        partner_order_id: order.id,
        partner_user_id: user.id,
        pg_token: pgToken,
      }),
    })

    if (!approveResponse.ok) {
      const errorText = await approveResponse.text()
      console.error('KakaoPay approve error:', errorText)
      
      // Mark order as failed
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      })
      
      redirect('/app/payment/fail?error=approve_failed')
    }

    // Mark order as approved
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })

    // Mark session as paid unlocked
    await prisma.analysisSession.update({
      where: { id: order.sessionId },
      data: { status: 'PAID_UNLOCKED' },
    })

    redirect(`/app/session/${order.sessionId}/chart?paid=1`)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/app/input?error=login_required')
    }
    console.error('Payment approve error:', error)
    redirect('/app/payment/fail?error=unknown')
  }
}
