import type { PaymentMethod } from './types'

/** 사용자에게 노출되는 결제수단 (paddle 제외) */
export type UiPaymentMethod = Exclude<PaymentMethod, 'paddle'>

export interface PaymentMethodMeta {
  key: UiPaymentMethod
  label: string
  icon: string
  desc: string
}

/** 결제수단 메타데이터(노출 순서 = 배열 순서) — 라벨/아이콘의 단일 소스 */
export const PAYMENT_METHOD_META: PaymentMethodMeta[] = [
  { key: 'kakaopay', label: '카카오페이', icon: '💛', desc: '카카오페이로 간편결제' },
  { key: 'tosspay',  label: '토스페이',   icon: '💙', desc: '토스페이로 간편결제' },
  { key: 'card',     label: '국내카드',   icon: '💳', desc: '신용/체크카드 결제' },
  { key: 'transfer', label: '계좌이체',   icon: '🏦', desc: '실시간 계좌이체' },
  { key: 'overseas', label: '해외카드',   icon: '🌍', desc: 'Visa/Master/AMEX (USD)' },
]

/** 비활성(준비 중) 결제수단에 표시할 안내 문구 */
export const PAYMENT_INACTIVE_NOTE = '준비 중'

/**
 * 라이브(실결제) 모드에서 실제 활성화된 결제수단.
 * 신규 PG 심사 통과 시 이 배열에 키를 추가하거나,
 * 코드 수정 없이 NEXT_PUBLIC_ACTIVE_PAYMENT_METHODS(쉼표 구분)로 덮어쓸 수 있다.
 * (예: NEXT_PUBLIC_ACTIVE_PAYMENT_METHODS="kakaopay,card,transfer")
 */
const LIVE_ACTIVE_METHODS: UiPaymentMethod[] = ['kakaopay']

const ALL_KEYS: UiPaymentMethod[] = PAYMENT_METHOD_META.map((m) => m.key)

/** 테스트/Mock 모드 여부 — 이 경우 모든 수단을 활성화(심사·QA용) */
function isTestLikeMode(): boolean {
  if (process.env.NEXT_PUBLIC_PAYMENT_MOCK === 'true') return true
  const mode = (
    process.env.NEXT_PUBLIC_PAYMENT_MODE
    ?? process.env.PAYMENT_MODE
    ?? 'test'
  ).toLowerCase()
  return mode !== 'live'
}

function liveAllowlist(): UiPaymentMethod[] {
  const raw = process.env.NEXT_PUBLIC_ACTIVE_PAYMENT_METHODS
  if (raw && raw.trim()) {
    const requested = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const valid = requested.filter((k): k is UiPaymentMethod => (ALL_KEYS as string[]).includes(k))
    if (valid.length > 0) return valid
  }
  return LIVE_ACTIVE_METHODS
}

/** 현재 실제 활성화된 결제수단 키 목록 (테스트=전체, 라이브=allowlist) */
export function getActiveMethodKeys(): UiPaymentMethod[] {
  return isTestLikeMode() ? [...ALL_KEYS] : liveAllowlist()
}

export function isMethodActive(key: UiPaymentMethod): boolean {
  return getActiveMethodKeys().includes(key)
}

/** 활성 결제수단의 한글 라벨 목록 (약관/안내 문구용, 노출 순서 유지) */
export function getActiveMethodLabels(): string[] {
  const active = new Set(getActiveMethodKeys())
  return PAYMENT_METHOD_META.filter((m) => active.has(m.key)).map((m) => m.label)
}
