export type PaymentMethod = 'kakaopay' | 'tosspay' | 'card' | 'transfer' | 'paddle'
export type PaymentProvider = 'portone' | 'paddle' | 'mock'
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'

export interface CreateOrderRequest {
  productCode: string
  paymentMethod: PaymentMethod
}

export interface CreateOrderResponse {
  orderId: string
  amount: number
  productCode: string
  productName: string
  paymentConfig?: {
    storeId: string
    channelKey: string
  } | null
}

export interface PortOneConfirmRequest {
  orderId: string
  paymentId: string
}

export interface PaymentResult {
  success: boolean
  orderId: string
  message?: string
}

export function getProvider(method: PaymentMethod): PaymentProvider {
  if (method === 'paddle') return 'paddle'
  if (process.env.NEXT_PUBLIC_PAYMENT_MOCK === 'true') return 'mock'
  return 'portone'
}

export function getPortOneStoreId(): string {
  return process.env.PORTONE_STORE_ID
    ?? process.env.NEXT_PUBLIC_PORTONE_STORE_ID
    ?? ''
}

type Mode = 'test' | 'live'

function currentMode(): Mode {
  const v = (
    process.env.PAYMENT_MODE
    ?? process.env.NEXT_PUBLIC_PAYMENT_MODE
    ?? 'test'
  ).toLowerCase()
  return v === 'live' ? 'live' : 'test'
}

function pick(server: string | undefined, client: string | undefined): string {
  return server ?? client ?? ''
}

export function getPortOneChannelKey(method: PaymentMethod): string {
  const mode = currentMode()
  const upper = mode.toUpperCase() as 'TEST' | 'LIVE'

  switch (method) {
    case 'kakaopay':
    case 'tosspay':
      return pick(
        process.env[`PORTONE_CHANNEL_KEY_TOSSPAY_${upper}`],
        process.env[`NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSSPAY_${upper}`],
      )
    case 'card':
      return pick(
        process.env[`PORTONE_CHANNEL_KEY_CARD_${upper}`],
        process.env[`NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD_${upper}`],
      )
    case 'transfer':
      return pick(
        process.env[`PORTONE_CHANNEL_KEY_TRANSFER_${upper}`],
        process.env[`NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TRANSFER_${upper}`],
      )
    default:
      return ''
  }
}
