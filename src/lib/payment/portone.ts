const PORTONE_API_BASE = 'https://api.portone.io'

interface PortOnePayment {
  id: string
  status: string
  amount: { total: number }
  method?: { type: string }
  customData?: string
}

export async function verifyPayment(paymentId: string): Promise<PortOnePayment> {
  const secret = process.env.PORTONE_V2_API_SECRET
  if (!secret) throw new Error('PORTONE_V2_API_SECRET is not set')

  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PortOne API error ${res.status}: ${body}`)
  }

  return res.json()
}
