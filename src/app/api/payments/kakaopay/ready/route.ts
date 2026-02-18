import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'

const PREMIUM_PRICE = 9900 // KRW

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { sessionId, itemCode } = body

    if (!sessionId || !itemCode) {
      return NextResponse.json(
        { error: 'Missing sessionId or itemCode' },
        { status: 400 }
      )
    }

    // Load session
    const session = await prisma.analysisSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Attach session to user if not already attached
    if (!session.userId) {
      await prisma.analysisSession.update({
        where: { id: sessionId },
        data: { userId: user.id },
      })
    } else if (session.userId !== user.id) {
      return NextResponse.json(
        { error: 'Session does not belong to user' },
        { status: 403 }
      )
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        sessionId,
        provider: 'KAKAOPAY',
        itemCode,
        amount: PREMIUM_PRICE,
        currency: 'KRW',
        status: 'READY',
      },
    })

    // Call KakaoPay ready API
    const cid = process.env.KAKAOPAY_CID
    const adminKey = process.env.KAKAOPAY_ADMIN_KEY
    const approvalUrl = process.env.KAKAOPAY_APPROVAL_URL
    const cancelUrl = process.env.KAKAOPAY_CANCEL_URL
    const failUrl = process.env.KAKAOPAY_FAIL_URL

    if (!cid || !adminKey || !approvalUrl || !cancelUrl || !failUrl) {
      return NextResponse.json(
        { error: 'KakaoPay not configured' },
        { status: 500 }
      )
    }

    const readyResponse = await fetch('https://kapi.kakao.com/v1/payment/ready', {
      method: 'POST',
      headers: {
        'Authorization': `KakaoAK ${adminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        cid,
        partner_order_id: order.id,
        partner_user_id: user.id,
        item_name: '프리미엄 사주 분석',
        quantity: '1',
        total_amount: String(PREMIUM_PRICE),
        tax_free_amount: '0',
        approval_url: `${approvalUrl}?orderId=${order.id}`,
        cancel_url: cancelUrl,
        fail_url: failUrl,
      }),
    })

    if (!readyResponse.ok) {
      const errorText = await readyResponse.text()
      console.error('KakaoPay ready error:', errorText)
      return NextResponse.json(
        { error: 'KakaoPay ready failed' },
        { status: 500 }
      )
    }

    const readyData = await readyResponse.json()
    const tid = readyData.tid
    const redirectUrl = readyData.next_redirect_pc_url || readyData.next_redirect_mobile_url

    // Update order with tid
    await prisma.order.update({
      where: { id: order.id },
      data: { tid },
    })

    return NextResponse.json({
      orderId: order.id,
      redirectUrl,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Payment ready error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    )
  }
}
