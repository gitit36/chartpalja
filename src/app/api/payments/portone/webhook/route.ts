import { NextRequest, NextResponse } from 'next/server'
import * as PortOne from '@portone/server-sdk'
import { getPortOneWebhookSecret } from '@/lib/payment/portone'
import { syncPaymentByPaymentId } from '@/lib/payment/sync'
import { notifyWebhookError } from '@/lib/notifications'

export const runtime = 'nodejs'

// PortOne V2 Webhook 핸들러
// - 서명 검증: Standard Webhooks (PortOne.Webhook.verify)
// - 처리: 결제 상태와 무관하게 PortOne API로 단건 조회 후 DB 동기화 (위/변조 방어)
// - 응답: 검증 실패만 400, 그 외에는 200 (재시도 폭주 방지)
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const headers = Object.fromEntries(req.headers.entries())

  let webhook: PortOne.Webhook.Webhook
  try {
    webhook = await PortOne.Webhook.verify(
      getPortOneWebhookSecret(),
      rawBody,
      headers,
    )
  } catch (e) {
    if (e instanceof PortOne.Webhook.WebhookVerificationError) {
      console.error('[portone webhook] verify failed:', e.reason)
      return NextResponse.json({ error: 'invalid signature', reason: e.reason }, { status: 400 })
    }
    console.error('[portone webhook] unexpected verify error:', e)
    await notifyWebhookError(`서명 검증 중 알 수 없는 오류: ${String(e)}`)
    return NextResponse.json({ error: 'verify error' }, { status: 500 })
  }

  if (!('type' in webhook)) {
    return NextResponse.json({ ok: true, ignored: 'unknown_shape' })
  }

  const type = webhook.type as string
  if (!type.startsWith('Transaction.')) {
    return NextResponse.json({ ok: true, ignored: type })
  }

  if (!('data' in webhook) || !webhook.data || !('paymentId' in webhook.data)) {
    return NextResponse.json({ ok: true, ignored: 'no_payment_id' })
  }

  const paymentId = (webhook.data as { paymentId: string }).paymentId

  try {
    const result = await syncPaymentByPaymentId(paymentId)
    if (!result.ok) {
      console.warn('[portone webhook] sync failed:', result)
      await notifyWebhookError(
        `sync 실패: ${result.reason}`,
        { type, paymentId, detail: result.detail, orderId: result.orderId },
      )
      return NextResponse.json({ ok: true, syncFailed: result.reason })
    }
    return NextResponse.json({ ok: true, action: result.action, orderId: result.orderId })
  } catch (err) {
    console.error('[portone webhook] handler error:', err)
    await notifyWebhookError(
      `핸들러 예외: ${err instanceof Error ? err.message : String(err)}`,
      { type, paymentId },
    )
    return NextResponse.json({ error: 'handler error' }, { status: 500 })
  }
}
