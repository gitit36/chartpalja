export type PaymentMethod = 'kakaopay' | 'tosspay' | 'card' | 'paddle'
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

export function getPortOneChannelKey(method: PaymentMethod): string {
  switch (method) {
    case 'kakaopay':
      return process.env.PORTONE_CHANNEL_KEY_KAKAOPAY
        ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAOPAY
        ?? ''
    case 'tosspay':
      return process.env.PORTONE_CHANNEL_KEY_TOSSPAY
        ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSSPAY
        ?? ''
    case 'card':
      return process.env.PORTONE_CHANNEL_KEY_CARD
        ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD
        ?? ''
    default:
      return ''
  }
}
