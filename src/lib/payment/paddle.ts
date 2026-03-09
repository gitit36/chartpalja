import crypto from 'crypto'

interface PaddleWebhookEvent {
  event_type: string
  data: {
    id: string
    status: string
    custom_data?: Record<string, string>
    details?: { totals?: { total?: string } }
  }
}

export function verifyPaddleSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret) throw new Error('PADDLE_WEBHOOK_SECRET is not set')

  // Paddle sends: ts=TIMESTAMP;h1=HASH
  const parts = signature.split(';')
  const ts = parts.find(p => p.startsWith('ts='))?.slice(3) ?? ''
  const h1 = parts.find(p => p.startsWith('h1='))?.slice(3) ?? ''

  if (!ts || !h1) return false

  const payload = `${ts}:${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(h1), Buffer.from(expected))
}

export function parsePaddleEvent(body: string): PaddleWebhookEvent {
  return JSON.parse(body)
}
