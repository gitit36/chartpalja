'use client'

import { useCallback, useMemo, useState } from 'react'
import { StatusBadge } from '@/components/admin/AdminUi'

type CampaignOpt = { id: string; name: string }

type CouponRow = {
  id: string
  code: string
  ju: number
  maxRedemptions: number | null
  redeemedCount: number
  expiresAt: string | null
  active: boolean
  note: string | null
  campaignId: string | null
  campaign: CampaignOpt | null
  createdAt: string
  _count: { redemptions: number }
}

function couponTone(c: CouponRow): 'ok' | 'warn' | 'bad' | 'muted' {
  if (!c.active) return 'muted'
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return 'bad'
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) return 'warn'
  return 'ok'
}

function couponStatusLabel(c: CouponRow): string {
  if (!c.active) return '비활성'
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return '만료'
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) return '소진'
  return '사용가능'
}

export function CouponsClient({
  initialCoupons,
  campaigns,
}: {
  initialCoupons: CouponRow[]
  campaigns: CampaignOpt[]
}) {
  const [coupons, setCoupons] = useState(initialCoupons)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '',
    ju: '15',
    maxRedemptions: '',
    expiresAt: '',
    note: '',
    campaignId: '',
  })

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/coupons')
    const data = await res.json()
    if (res.ok) setCoupons(data.coupons)
  }, [])

  const create = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          ju: Number(form.ju),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          expiresAt: form.expiresAt || null,
          note: form.note || null,
          campaignId: form.campaignId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '생성 실패')
        return
      }
      setForm({ code: '', ju: '15', maxRedemptions: '', expiresAt: '', note: '', campaignId: '' })
      await refresh()
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusy(false)
    }
  }, [form, refresh])

  const toggleActive = useCallback(
    async (c: CouponRow) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/coupons/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !c.active }),
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

  const copy = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* ignore */
    }
  }, [])

  const sorted = useMemo(
    () => [...coupons].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [coupons],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">쿠폰</h1>
        <p className="mt-1 text-sm text-cp-muted">생성 · 활성/비활성 · 캠페인 연결 (삭제/초기화 없음)</p>
      </div>

      <section className="rounded-2xl border border-cp-border bg-cp-raised p-4 space-y-3">
        <p className="text-sm font-semibold">새 쿠폰</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-cp-muted block">
            코드
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm text-cp-text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="EARLY15"
            />
          </label>
          <label className="text-xs text-cp-muted block">
            지급 주
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm text-cp-text"
              value={form.ju}
              onChange={(e) => setForm((f) => ({ ...f, ju: e.target.value }))}
            />
          </label>
          <label className="text-xs text-cp-muted block">
            전체 한도 (비우면 무제한)
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm text-cp-text"
              value={form.maxRedemptions}
              onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
            />
          </label>
          <label className="text-xs text-cp-muted block">
            만료 (YYYY-MM-DD 또는 14d)
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm text-cp-text"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              placeholder="14d"
            />
          </label>
          <label className="text-xs text-cp-muted block">
            캠페인
            <select
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm text-cp-text"
              value={form.campaignId}
              onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}
            >
              <option value="">없음</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-cp-muted block">
            메모
            <input
              className="mt-1 w-full rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm text-cp-text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>
        </div>
        {error ? <p className="text-sm text-cp-up">{error}</p> : null}
        <button
          type="button"
          disabled={busy || !form.code.trim()}
          onClick={create}
          className="rounded-xl bg-cp-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? '처리 중…' : '쿠폰 생성'}
        </button>
      </section>

      <section className="rounded-2xl border border-cp-border bg-cp-raised overflow-hidden">
        <div className="overflow-x-auto show-scrollbar">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-cp-surface/60 text-xs text-cp-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">코드</th>
                <th className="px-4 py-2.5 font-medium">주</th>
                <th className="px-4 py-2.5 font-medium">사용</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
                <th className="px-4 py-2.5 font-medium">만료</th>
                <th className="px-4 py-2.5 font-medium">캠페인</th>
                <th className="px-4 py-2.5 font-medium">메모</th>
                <th className="px-4 py-2.5 font-medium">동작</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-t border-cp-border/80">
                  <td className="px-4 py-2.5 font-mono font-semibold">
                    <button type="button" onClick={() => copy(c.code)} className="hover:text-cp-accent" title="복사">
                      {c.code}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{c.ju}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {c.redeemedCount}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ' / ∞'}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge tone={couponTone(c)}>{couponStatusLabel(c)}</StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-cp-muted">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleString('ko-KR') : '무기한'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-cp-secondary">{c.campaign?.name ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-cp-muted max-w-[180px] truncate">{c.note ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleActive(c)}
                      className="text-xs text-cp-accent hover:underline disabled:opacity-40"
                    >
                      {c.active ? '비활성화' : '활성화'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
