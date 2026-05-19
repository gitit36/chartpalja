export type PaymentMethod = 'kakaopay' | 'tosspay' | 'card' | 'transfer' | 'overseas' | 'paddle'
export type PaymentProvider = 'portone' | 'paddle' | 'mock'
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'

export interface CreateOrderRequest {
  /** 단일 상품 결제 — 하위 호환용. productCodes 가 있으면 무시된다. */
  productCode?: string
  /** 묶음 결제용 상품 코드 배열. 1개 이상이어야 함. */
  productCodes?: string[]
  paymentMethod: PaymentMethod
}

export interface OrderItemInfo {
  code: string
  type: 'chart' | 'period'
  quantity: number
  amount: number
  currency: string
}

export interface CreateOrderResponse {
  orderId: string
  amount: number
  /** 결제 통화 (KRW 또는 USD). 해외카드는 USD, 그 외는 KRW */
  currency: string
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
      return pick(
        process.env[`PORTONE_CHANNEL_KEY_KAKAOPAY_${upper}`],
        process.env[`NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAOPAY_${upper}`],
      )
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
    case 'overseas':
      return pick(
        process.env[`PORTONE_CHANNEL_KEY_OVERSEAS_${upper}`],
        process.env[`NEXT_PUBLIC_PORTONE_CHANNEL_KEY_OVERSEAS_${upper}`],
      )
    default:
      return ''
  }
}
