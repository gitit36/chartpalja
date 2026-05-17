import { getPaymentMode } from '@/lib/payment/portone'
import { postSlack } from './slack'
import { sendAlertEmail } from './email'

interface OrderLike {
  id: string
  userId: string
  productCode: string
  amount: number
  paymentMethod?: string | null
  provider?: string | null
  providerTxId?: string | null
}

function modeBadge(): string {
  return getPaymentMode() === 'live' ? '🟢 LIVE' : '🧪 TEST'
}

function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000)
}

export async function notifyPaymentPaid(order: OrderLike): Promise<void> {
  const heading = `${modeBadge()} 결제 성공 💰`
  const fields = [
    { label: '주문ID', value: order.id },
    { label: '상품', value: order.productCode },
    { label: '금액', value: formatKRW(order.amount) },
    { label: '결제수단', value: order.paymentMethod ?? '-' },
    { label: '사용자', value: order.userId },
    { label: 'PortOne TxID', value: order.providerTxId ?? '-' },
  ]

  await Promise.all([
    sendAlertEmail({
      subject: `[chartpalja] 결제 성공 ${formatKRW(order.amount)}`,
      heading,
      fields,
      level: 'success',
    }),
    postSlack({
      text: heading,
      attachments: [
        {
          color: 'good',
          fields: fields.map(f => ({ title: f.label, value: f.value, short: true })),
          footer: 'chartpalja',
          ts: nowTs(),
        },
      ],
    }),
  ])
}

export async function notifyPaymentFailed(
  order: OrderLike | null,
  reason: string,
): Promise<void> {
  const heading = `${modeBadge()} 결제 실패 ❌`
  const fields = [
    { label: '주문ID', value: order?.id ?? '-' },
    { label: '상품', value: order?.productCode ?? '-' },
    { label: '금액', value: order ? formatKRW(order.amount) : '-' },
    { label: '결제수단', value: order?.paymentMethod ?? '-' },
    { label: '사용자', value: order?.userId ?? '-' },
    { label: '사유', value: reason },
  ]

  await Promise.all([
    sendAlertEmail({
      subject: `[chartpalja] 결제 실패`,
      heading,
      fields,
      level: 'danger',
    }),
    postSlack({
      text: heading,
      attachments: [
        {
          color: 'danger',
          fields: fields.map(f => ({ title: f.label, value: f.value, short: f.label !== '사유' })),
          footer: 'chartpalja',
          ts: nowTs(),
        },
      ],
    }),
  ])
}

export async function notifyPaymentCancelled(
  order: OrderLike,
  reason: string,
  isPartial = false,
): Promise<void> {
  const label = isPartial ? '부분 ' : ''
  const heading = `${modeBadge()} 결제 ${label}취소 ↩️`
  const fields = [
    { label: '주문ID', value: order.id },
    { label: '상품', value: order.productCode },
    { label: '금액', value: formatKRW(order.amount) },
    { label: '결제수단', value: order.paymentMethod ?? '-' },
    { label: '사용자', value: order.userId },
    { label: '사유', value: reason },
  ]

  await Promise.all([
    sendAlertEmail({
      subject: `[chartpalja] 결제 ${label}취소`,
      heading,
      fields,
      level: 'warning',
    }),
    postSlack({
      text: heading,
      attachments: [
        {
          color: 'warning',
          fields: fields.map(f => ({ title: f.label, value: f.value, short: f.label !== '사유' })),
          footer: 'chartpalja',
          ts: nowTs(),
        },
      ],
    }),
  ])
}

export async function notifyWebhookError(message: string, context?: unknown): Promise<void> {
  const heading = `${modeBadge()} ⚠️ 웹훅 처리 오류`
  const contextStr = context ? JSON.stringify(context, null, 2).slice(0, 2000) : undefined

  await Promise.all([
    sendAlertEmail({
      subject: `[chartpalja] 웹훅 오류`,
      heading,
      message,
      fields: contextStr ? [{ label: 'context', value: contextStr }] : [],
      level: 'danger',
    }),
    postSlack({
      text: heading,
      attachments: [
        {
          color: 'danger',
          text: message,
          fields: contextStr
            ? [{ title: 'context', value: '```' + contextStr + '```', short: false }]
            : undefined,
          footer: 'chartpalja',
          ts: nowTs(),
        },
      ],
    }),
  ])
}
