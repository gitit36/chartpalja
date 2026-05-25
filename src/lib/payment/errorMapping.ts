/**
 * PG 에러 코드/메시지를 사용자 친화 문구로 매핑한다.
 *
 * - PortOne(`code`/`message`) 응답뿐 아니라 Eximbay/Toss/카카오의 원문 메시지도
 *   부분 일치(includes)로 인식한다.
 * - 매핑되지 않는 경우 원본 메시지를 그대로 반환한다(투명성).
 */

export interface MappedError {
  short: string
  hint?: string
}

const PATTERNS: Array<{ match: RegExp; out: MappedError }> = [
  {
    match: /card number is incorrect|cardholder|invalid card|9999|X000/i,
    out: { short: '카드 정보를 확인해 주세요', hint: '카드 번호/유효기간/CVC가 정확한지 확인해 주세요.' },
  },
  {
    match: /not support payment method|PC04|PC0[0-9]/i,
    out: { short: '이 결제 수단으로는 결제할 수 없어요', hint: '다른 결제 수단으로 다시 시도해 주세요.' },
  },
  {
    match: /insufficient|한도|잔액/i,
    out: { short: '카드 한도를 확인해 주세요', hint: '한도 초과/잔액 부족일 수 있어요.' },
  },
  {
    match: /declined|승인 거절|3DS|secure/i,
    out: { short: '카드사에서 결제를 거절했어요', hint: '카드사에 문의하거나 다른 카드로 시도해 주세요.' },
  },
  {
    match: /customer\.email|customer\.name|REQUIRED/i,
    out: { short: '결제에 필요한 정보가 부족해요', hint: '카카오 로그인 후 다시 시도해 주세요.' },
  },
  {
    match: /timeout|TIMEOUT/i,
    out: { short: '응답이 지연됐어요', hint: '네트워크 상태를 확인 후 다시 시도해 주세요.' },
  },
  {
    match: /payment_not_found|결제 정보를 조회/i,
    out: { short: '결제 정보를 조회할 수 없어요', hint: '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.' },
  },
  {
    match: /KCP/i,
    out: { short: '결제 수단이 일시적으로 지원되지 않아요', hint: '카카오페이/토스페이/카드 중 다른 수단을 이용해 주세요.' },
  },
  {
    match: /cancel|취소/i,
    out: { short: '결제가 취소되었어요', hint: '언제든 다시 결제할 수 있어요.' },
  },
]

const FALLBACK: MappedError = {
  short: '결제에 실패했어요',
  hint: '잠시 후 다시 시도하거나 다른 결제 수단을 이용해 주세요.',
}

export function mapPaymentError(input?: string | null): MappedError {
  if (!input) return FALLBACK
  for (const { match, out } of PATTERNS) {
    if (match.test(input)) return out
  }
  return { short: FALLBACK.short, hint: input.slice(0, 120) }
}
