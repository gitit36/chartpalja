import * as PortOne from '@portone/server-sdk'

export type PaymentMode = 'test' | 'live'

export function getPaymentMode(): PaymentMode {
  const v = (process.env.PAYMENT_MODE ?? 'test').toLowerCase()
  return v === 'live' ? 'live' : 'test'
}

export function getPortOneApiSecret(mode: PaymentMode = getPaymentMode()): string {
  const secret = mode === 'live'
    ? process.env.PORTONE_V2_API_SECRET_LIVE
    : process.env.PORTONE_V2_API_SECRET_TEST
  if (!secret) throw new Error(`PORTONE_V2_API_SECRET_${mode.toUpperCase()} is not set`)
  return secret
}

export function getPortOneWebhookSecret(mode: PaymentMode = getPaymentMode()): string {
  const secret = mode === 'live'
    ? process.env.PORTONE_V2_WEBHOOK_SECRET_LIVE
    : process.env.PORTONE_V2_WEBHOOK_SECRET_TEST
  if (!secret) throw new Error(`PORTONE_V2_WEBHOOK_SECRET_${mode.toUpperCase()} is not set`)
  return secret
}

let _client: ReturnType<typeof PortOne.PortOneClient> | null = null
let _clientMode: PaymentMode | null = null

export function getPortOneClient(mode: PaymentMode = getPaymentMode()) {
  if (!_client || _clientMode !== mode) {
    _client = PortOne.PortOneClient({ secret: getPortOneApiSecret(mode) })
    _clientMode = mode
  }
  return _client
}

export async function getPayment(paymentId: string) {
  const client = getPortOneClient()
  try {
    return await client.payment.getPayment({ paymentId })
  } catch (e) {
    if (e instanceof PortOne.PortOneError) {
      console.error('[portone.getPayment] PortOneError:', {
        paymentId,
        mode: getPaymentMode(),
        name: e.name,
        message: e.message,
      })
      return null
    }
    console.error('[portone.getPayment] unknown error:', { paymentId, error: e })
    throw e
  }
}

export async function cancelPayment(params: {
  paymentId: string
  reason: string
  amount?: number
  currentCancellableAmount?: number
}) {
  const client = getPortOneClient()
  return client.payment.cancelPayment({
    paymentId: params.paymentId,
    reason: params.reason,
    ...(params.amount !== undefined ? { amount: params.amount } : {}),
    ...(params.currentCancellableAmount !== undefined
      ? { currentCancellableAmount: params.currentCancellableAmount }
      : {}),
  })
}
