interface SlackField {
  title: string
  value: string
  short?: boolean
}

interface SlackAttachment {
  color?: 'good' | 'warning' | 'danger' | string
  title?: string
  text?: string
  fields?: SlackField[]
  footer?: string
  ts?: number
}

export interface SlackPayload {
  text: string
  attachments?: SlackAttachment[]
}

export async function postSlack(payload: SlackPayload): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('[slack] webhook failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[slack] webhook error:', err)
  }
}
