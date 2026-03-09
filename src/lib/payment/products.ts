export type ProductType = 'chart' | 'period'

export interface Product {
  code: string
  type: ProductType
  name: string
  description: string
  quantity: number
  price: number
}

export const PRODUCTS: Record<string, Product> = {
  chart_1:   { code: 'chart_1',   type: 'chart',  name: '운세 해설 1회',  description: '운세 해설 1회를 이용할 수 있어요',  quantity: 1,  price: 990 },
  chart_3:   { code: 'chart_3',   type: 'chart',  name: '운세 해설 3회',  description: '운세 해설 3회를 이용할 수 있어요',  quantity: 3,  price: 2900 },
  chart_5:   { code: 'chart_5',   type: 'chart',  name: '운세 해설 5회',  description: '운세 해설 5회를 이용할 수 있어요',  quantity: 5,  price: 4700 },
  chart_10:  { code: 'chart_10',  type: 'chart',  name: '운세 해설 10회', description: '운세 해설 10회를 이용할 수 있어요', quantity: 10, price: 9200 },
  period_1:  { code: 'period_1',  type: 'period', name: '기간 해설 1회',  description: '기간 해설 1회를 이용할 수 있어요',  quantity: 1,  price: 190 },
  period_5:  { code: 'period_5',  type: 'period', name: '기간 해설 5회',  description: '기간 해설 5회를 이용할 수 있어요',  quantity: 5,  price: 900 },
  period_15: { code: 'period_15', type: 'period', name: '기간 해설 15회', description: '기간 해설 15회를 이용할 수 있어요', quantity: 15, price: 2600 },
} as const

export type ProductCode = keyof typeof PRODUCTS

export function getProduct(code: string): Product | null {
  return PRODUCTS[code] ?? null
}

export function formatPrice(amount: number): string {
  return amount.toLocaleString('ko-KR')
}

export const CHART_PRODUCTS = Object.values(PRODUCTS).filter(p => p.type === 'chart')
export const PERIOD_PRODUCTS = Object.values(PRODUCTS).filter(p => p.type === 'period')

export const FREE_PERIOD_PER_CHART = 3

export function calcFreePeriodCredits(chartQuantity: number): number {
  return chartQuantity * FREE_PERIOD_PER_CHART
}
