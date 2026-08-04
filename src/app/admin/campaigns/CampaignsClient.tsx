'use client'

import { useCallback, useState } from 'react'
import { StatusBadge } from '@/components/admin/AdminUi'

type CouponBrief = {
  id: string
  code: string
  ju: number
  active: boolean
  redeemedCount: number
  maxRedemptions: number | null
}

type CampaignRow = {
  id: string
  name: string
  status: string
  channel: string | null
  startsAt: string | null
  endsAt: string | null
  goal: string | null
  note: string | null
  utmSource: string | null
  utmMedium: string | null
  utmContent: string | null
  landingUrl: string | null
  createdAt: string
  coupons: CouponBrief[]
}

const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  active: '진행',
  ended: '종료',
}

export function CampaignsClient({ initial }: { initial: CampaignRow[] }) {
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    channel: 'Instagram',
    status: 'draft',
    goal: '',
    note: '',
    utmSource: '',
    landingUrl: '',
  })

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/campaigns')
    const data = await res.json()
    if (res.ok) {
      setRows(
        data.campaigns.map((c: CampaignRow & { startsAt: string | null; endsAt: string | null; createdAt: string }) => ({
          ...c,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          createdAt: c.createdAt,
        })),
      )
    }
  }, [])

  const create = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          channel: form.channel || null,
          status: form.status,
          goal: form.goal || null,
          note: form.note || null,
          utmSource: form.utmSource || null,
          landingUrl: form.landingUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '생성 실패')
        return
      }
      setForm({
        name: '',
        channel: 'Instagram',
        status: 'draft',
        goal: '',
        note: '',
        utmSource: '',
        landingUrl: '',
      })
      await refresh()
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusy(false)
    }
  }, [form, refresh])

  const setStatus = useCallback(
    async (id: string, status: string) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/campaigns/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '변경 실패')
          return
        }
        await refresh()
      } catch {
        setError('네트워크 오류')
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">캠페인</h1>
        <p className="mt-1 text-sm text-cp-muted">채널·UTM·쿠폰을 묶는 상위 단위 (퍼널 분석은 이후 단계)</p>
      </div>

      <section className="rounded-2xl border border-cp-border bg-cp-raised p-4 space-y-3">
        <p className="text-sm font-semibold">새 캠페인</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-cp-muted block">
            이름
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="인스타 8월 런칭"
            />
          </label>
          <label className="text-xs text-cp-muted block">
            채널
            <select
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            >
              {['Instagram', 'Threads', 'Kakao', 'Offline', 'Partner', 'Other'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-cp-muted block">
            상태
            <select
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="draft">초안</option>
              <option value="active">진행</option>
              <option value="ended">종료</option>
            </select>
          </label>
          <label className="text-xs text-cp-muted block">
            목표
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
            />
          </label>
          <label className="text-xs text-cp-muted block">
            UTM source
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.utmSource}
              onChange={(e) => setForm((f) => ({ ...f, utmSource: e.target.value }))}
              placeholder="instagram"
            />
          </label>
          <label className="text-xs text-cp-muted block">
            랜딩 URL
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.landingUrl}
              onChange={(e) => setForm((f) => ({ ...f, landingUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label className="text-xs text-cp-muted block sm:col-span-2 lg:col-span-3">
            메모
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>
        </div>
        {error ? <p className="text-sm text-cp-up">{error}</p> : null}
        <button
          type="button"
          disabled={busy || !form.name.trim()}
          onClick={create}
          className="rounded-xl bg-cp-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          캠페인 생성
        </button>
      </section>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-cp-muted py-8 text-center">아직 캠페인이 없습니다.</p>
        ) : (
          rows.map((c) => {
            const redeemed = c.coupons.reduce((sum, x) => sum + x.redeemedCount, 0)
            return (
              <article key={c.id} className="rounded-2xl border border-cp-border bg-cp-raised p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{c.name}</h2>
                      <StatusBadge
                        tone={c.status === 'active' ? 'ok' : c.status === 'ended' ? 'muted' : 'warn'}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-cp-muted">
                      {[c.channel, c.utmSource ? `utm:${c.utmSource}` : null, c.goal]
                        .filter(Boolean)
                        .join(' · ') || '세부 정보 없음'}
                    </p>
                    {c.note ? <p className="mt-1 text-xs text-cp-dim">{c.note}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {(['draft', 'active', 'ended'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={busy || c.status === st}
                        onClick={() => setStatus(c.id, st)}
                        className="rounded-lg border border-cp-border px-2.5 py-1 text-[11px] text-cp-secondary disabled:opacity-30 hover:bg-cp-hover"
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-cp-surface px-2.5 py-1 text-[11px] text-cp-muted">
                    연결 쿠폰 {c.coupons.length} · 사용 {redeemed}건
                  </span>
                  {c.coupons.map((cp) => (
                    <span
                      key={cp.id}
                      className="rounded-lg border border-cp-border px-2.5 py-1 text-[11px] font-mono text-cp-secondary"
                    >
                      {cp.code} ({cp.redeemedCount}
                      {cp.maxRedemptions != null ? `/${cp.maxRedemptions}` : ''})
                    </span>
                  ))}
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
