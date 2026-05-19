export type ProductType = 'chart' | 'period'

export interface Product {
  code: string
  type: ProductType
  name: string
  description: string
  quantity: number
  /** 원화 가격 (KRW, 정수) */
  price: number
  /**
   * 해외카드(Eximbay) 결제 시 사용되는 USD 가격 (cents, 정수).
   * 미정의 또는 100 미만이면 해외카드 결제는 차단된다.
   * Eximbay는 KRW를 지원하지 않고 최소 결제 금액이 $1 수준이므로
   * 상품별로 별도 책정한다.
   */
  usdPriceCents?: number
}

// usdPriceCents 는 단가에 맞춰 책정. Eximbay 합계 결제이므로 단일 상품이 $1 미만이어도 OK
// (선택 상품 합계가 $1 이상이면 해외카드 결제 가능).
export const PRODUCTS: Record<string, Product> = {
  chart_1:   { code: 'chart_1',   type: 'chart',  name: '운세 해설 1회',  description: '운세 해설 1회를 이용할 수 있어요',  quantity: 1,  price: 990,  usdPriceCents: 99 },
  chart_3:   { code: 'chart_3',   type: 'chart',  name: '운세 해설 3회',  description: '운세 해설 3회를 이용할 수 있어요',  quantity: 3,  price: 2900, usdPriceCents: 249 },
  chart_5:   { code: 'chart_5',   type: 'chart',  name: '운세 해설 5회',  description: '운세 해설 5회를 이용할 수 있어요',  quantity: 5,  price: 4700, usdPriceCents: 399 },
  chart_10:  { code: 'chart_10',  type: 'chart',  name: '운세 해설 10회', description: '운세 해설 10회를 이용할 수 있어요', quantity: 10, price: 9200, usdPriceCents: 799 },
  period_1:  { code: 'period_1',  type: 'period', name: '구간 해설 1회',  description: '구간 해설 1회를 이용할 수 있어요',  quantity: 1,  price: 190,  usdPriceCents: 19 },
  period_5:  { code: 'period_5',  type: 'period', name: '구간 해설 5회',  description: '구간 해설 5회를 이용할 수 있어요',  quantity: 5,  price: 900,  usdPriceCents: 79 },
  period_15: { code: 'period_15', type: 'period', name: '구간 해설 15회', description: '구간 해설 15회를 이용할 수 있어요', quantity: 15, price: 2600, usdPriceCents: 229 },
} as const

export type ProductCode = keyof typeof PRODUCTS

export function getProduct(code: string): Product | null {
  return PRODUCTS[code] ?? null
}

export function formatPrice(amount: number): string {
  return amount.toLocaleString('ko-KR')
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

export const CHART_PRODUCTS = Object.values(PRODUCTS).filter(p => p.type === 'chart')
export const PERIOD_PRODUCTS = Object.values(PRODUCTS).filter(p => p.type === 'period')

export const FREE_PERIOD_PER_CHART = 1

export function calcFreePeriodCredits(chartQuantity: number): number {
  return chartQuantity * FREE_PERIOD_PER_CHART
}
