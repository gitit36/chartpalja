export type ProductType = 'ju'

export interface Product {
  code: string
  type: ProductType
  name: string
  description: string
  /** 충전되는 주(株) 수량 */
  quantity: number
  /** 원화 가격 (KRW, 정수) */
  price: number
  /** 추천 팩 배지 */
  recommended?: boolean
  /**
   * 해외카드(Eximbay) 결제 시 사용되는 USD 가격 (cents, 정수).
   * Eximbay는 KRW를 지원하지 않고 최소 결제 금액이 $1 수준이므로
   * 상품별로 별도 책정한다.
   */
  usdPriceCents?: number
}

/** 1주 = 200원 기준 해설 차감량 */
export const JU_UNIT_KRW = 200

/** 해설 종류별 주(株) 차감 */
export const READING_COST = {
  period: 1,
  fortune: 5,
  compat: 5,
} as const

export type ReadingKind = keyof typeof READING_COST

// usdPriceCents 는 단가에 맞춰 책정. Eximbay 합계 결제이므로 단일 상품이 $1 미만이어도 OK
// (선택 상품 합계가 $1 이상이면 해외카드 결제 가능).
export const PRODUCTS: Record<string, Product> = {
  ju_5:   { code: 'ju_5',   type: 'ju', name: '5주',   description: '구간 해설 5회 또는 운세 해설 1회 분량',   quantity: 5,   price: 1000,  usdPriceCents: 99 },
  ju_15:  { code: 'ju_15',  type: 'ju', name: '15주',  description: '운세·궁합·구간 해설을 넉넉히',          quantity: 15,  price: 2800,  usdPriceCents: 249, recommended: true },
  ju_40:  { code: 'ju_40',  type: 'ju', name: '40주',  description: '여러 사주·궁합까지 한 번에',            quantity: 40,  price: 6900,  usdPriceCents: 599 },
  ju_100: { code: 'ju_100', type: 'ju', name: '100주', description: '최대 할인 · 오래 쓰는 분께',            quantity: 100, price: 15900, usdPriceCents: 1299 },
} as const

export type ProductCode = keyof typeof PRODUCTS

export function getProduct(code: string): Product | null {
  return PRODUCTS[code] ?? null
}

export function formatPrice(amount: number): string {
  return amount.toLocaleString('ko-KR')
}

/** 주 팩 장당 단가 (원) */
export function juUnitPrice(product: Product): number {
  return Math.round(product.price / product.quantity)
}

/** 선택된 상품들의 USD cents 합계 (해외카드 결제 합산 검증용) */
export function sumUsdCents(products: Product[]): number {
  return products.reduce((sum, p) => sum + (p.usdPriceCents ?? 0), 0)
}

/** Eximbay 최소 결제 금액($1) 충족 여부. 선택 상품 합계 기준. */
export const OVERSEAS_MIN_CENTS = 100
export function canPayOverseasBundle(products: Product[]): boolean {
  return sumUsdCents(products) >= OVERSEAS_MIN_CENTS
}

/** USD cents → "$X.XX" 형식 문자열 */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export const JU_PRODUCTS = Object.values(PRODUCTS)
