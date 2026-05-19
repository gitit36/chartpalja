import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

interface EmailField {
  label: string
  value: string
}

export interface EmailPayload {
  subject: string
  heading: string
  fields?: EmailField[]
  message?: string
  level?: 'info' | 'success' | 'warning' | 'danger'
}

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !port || !user || !pass) return null

  const secure = (process.env.SMTP_SECURE ?? 'true') === 'true'
  const debug = process.env.SMTP_DEBUG === 'true'

  // `family` 는 SMTPTransport.Options 타입에 명시되어 있지 않지만 nodemailer 내부의
  // net.connect 로 그대로 전달되어 동작한다. (Railway 등 IPv6 outbound 차단 환경 회피용)
  const options = {
    host,
    port: Number(port),
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    tls: { servername: host, rejectUnauthorized: true },
    family: 4,
    logger: debug,
    debug,
  } as SMTPTransport.Options & { family?: number }
  _transporter = nodemailer.createTransport(options)
  return _transporter
}

function colorForLevel(level: EmailPayload['level']): string {
  switch (level) {
    case 'success': return '#16a34a'
    case 'warning': return '#d97706'
    case 'danger':  return '#dc2626'
    default:        return '#4f46e5'
  }
}

function renderHtml(payload: EmailPayload): string {
  const color = colorForLevel(payload.level)
  const rows = (payload.fields ?? [])
    .map(
      f => `
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;color:#6b7280;font-size:12px;width:120px;border-bottom:1px solid #f3f4f6;">${escapeHtml(f.label)}</td>
          <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${escapeHtml(f.value)}</td>
        </tr>`,
    )
    .join('')

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f3f4f6;padding:24px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="padding:18px 20px;background:${color};color:#fff;font-size:15px;font-weight:700;">
        ${escapeHtml(payload.heading)}
      </div>
      ${payload.message ? `<div style="padding:14px 20px;color:#374151;font-size:13px;line-height:1.5;background:#fffbeb;border-bottom:1px solid #fde68a;">${escapeHtml(payload.message)}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="padding:14px 20px;color:#9ca3af;font-size:11px;border-top:1px solid #f3f4f6;">
        chartpalja 결제 시스템 알림 · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
      </div>
    </div>
  </div>`
}

function renderText(payload: EmailPayload): string {
  const lines: string[] = [payload.heading, '']
  if (payload.message) {
    lines.push(payload.message, '')
  }
  for (const f of payload.fields ?? []) {
    lines.push(`${f.label}: ${f.value}`)
  }
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendAlertEmail(payload: EmailPayload): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) return

  const to = process.env.ALERT_EMAIL_TO
  if (!to) return

  const from = process.env.SMTP_FROM
    ?? (process.env.SMTP_USER ? `chartpalja <${process.env.SMTP_USER}>` : undefined)
  if (!from) return

  try {
    await transporter.sendMail({
      from,
      to,
      subject: payload.subject,
      text: renderText(payload),
      html: renderHtml(payload),
    })
  } catch (err) {
    const e = err as { code?: string; command?: string; message?: string }
    console.error('[email] sendMail failed:', {
      code: e?.code,
      command: e?.command,
      message: e?.message,
      hint:
        e?.code === 'ETIMEDOUT' || e?.code === 'ESOCKET'
          ? 'SMTP outbound 연결 실패. SMTP_PORT=587, SMTP_SECURE=false 로 전환하거나, Railway가 외부 SMTP 를 차단하면 Resend 등 HTTP API 이메일로 전환 고려.'
          : undefined,
    })
  }
}
