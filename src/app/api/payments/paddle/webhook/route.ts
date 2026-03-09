import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPaddleSignature, parsePaddleEvent } from '@/lib/payment/paddle'
import { grantCredits } from '@/lib/payment/entitlement'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('paddle-signature') ?? ''

    if (process.env.NEXT_PUBLIC_PAYMENT_MOCK !== 'true') {
      if (!verifyPaddleSignature(rawBody, signature)) {
        console.error('Paddle webhook signature verification failed')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = parsePaddleEvent(rawBody)

    if (event.event_type !== 'transaction.completed') {
      return NextResponse.json({ received: true })
    }

    const orderId = event.data.custom_data?.orderId
    if (!orderId) {
      console.error('Paddle webhook missing orderId in custom_data')
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      console.error(`Paddle webhook: order ${orderId} not found`)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'paid') {
      return NextResponse.json({ received: true, message: 'Already processed' })
    }

    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        providerTxId: event.data.id,
        paidAt: new Date(),
        rawPayload: event as object,
      },
    })

    await grantCredits(order.userId, orderId, order.productCode)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Paddle webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
