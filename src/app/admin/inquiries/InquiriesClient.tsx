'use client'

import { useCallback, useMemo, useState } from 'react'
import { StatusBadge } from '@/components/admin/AdminUi'

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반',
  payment: '결제/환불',
  bug: '오류',
  account: '계정',
  etc: '기타',
}

type InquiryRow = {
  id: string
  userId: string | null
  guestId: string | null
  email: string | null
  category: string
  message: string
  page: string | null
  status: string
  adminNote: string | null
  resolvedAt: string | null
  createdAt: string
}

export function InquiriesClient({ initial }: { initial: InquiryRow[] }) {
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (status: typeof filter) => {
    const q = status === 'all' ? '' : `?status=${status}`
    const res = await fetch(`/api/admin/inquiries${q}`)
    const data = await res.json()
    if (res.ok) {
      setRows(
        data.inquiries.map((i: InquiryRow) => ({
          ...i,
          createdAt: typeof i.createdAt === 'string' ? i.createdAt : new Date(i.createdAt).toISOString(),
          resolvedAt: i.resolvedAt
            ? typeof i.resolvedAt === 'string'
              ? i.resolvedAt
              : new Date(i.resolvedAt).toISOString()
            : null,
        })),
      )
    }
  }, [])

  const changeFilter = useCallback(
    async (next: typeof filter) => {
      setFilter(next)
      await refresh(next)
    },
    [refresh],
  )

  const update = useCallback(
    async (id: string, patch: { status?: string; adminNote?: string | null }) => {
      setBusyId(id)
      setError(null)
      try {
        const res = await fetch(`/api/admin/inquiries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '변경 실패')
          return
        }
        await refresh(filter)
      } catch {
        setError('네트워크 오류')
      } finally {
        setBusyId(null)
      }
    },
    [filter, refresh],
  )

  const visible = useMemo(() => rows, [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">문의</h1>
          <p className="mt-1 text-sm text-cp-muted">상태 변경 · 내부 메모</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-cp-border bg-cp-raised p-1">
          {([
            ['open', '미처리'],
            ['resolved', '완료'],
            ['all', '전체'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => changeFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                filter === key ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-cp-up">{error}</p> : null}

      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-cp-muted">문의가 없습니다.</p>
        ) : (
          visible.map((row) => (
            <article key={row.id} className="rounded-2xl border border-cp-border bg-cp-raised p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={row.status === 'open' ? 'warn' : 'ok'}>
                  {row.status === 'open' ? '미처리' : '완료'}
                </StatusBadge>
                <span className="text-xs text-cp-muted">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </span>
                <span className="text-xs text-cp-dim">
                  {new Date(row.createdAt).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-cp-secondary">
                {row.message}
              </p>
              <p className="mt-2 text-[11px] text-cp-dim">
                {[
                  row.email ? `회신 ${row.email}` : null,
                  row.userId ? `user:${row.userId.slice(0, 8)}` : row.guestId ? `guest` : '익명',
                  row.page,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="flex-1 rounded-xl border border-cp-border bg-cp-input px-3 py-2 text-sm"
                  placeholder="내부 메모"
                  value={notes[row.id] ?? row.adminNote ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() =>
                      update(row.id, {
                        adminNote: notes[row.id] ?? row.adminNote ?? null,
                      })
                    }
                    className="rounded-xl border border-cp-border px-3 py-2 text-xs text-cp-secondary hover:bg-cp-hover disabled:opacity-40"
                  >
                    메모 저장
                  </button>
                  {row.status === 'open' ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() =>
                        update(row.id, {
                          status: 'resolved',
                          adminNote: notes[row.id] ?? row.adminNote ?? null,
                        })
                      }
                      className="rounded-xl bg-cp-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      처리 완료
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => update(row.id, { status: 'open' })}
                      className="rounded-xl border border-cp-border px-3 py-2 text-xs text-cp-secondary hover:bg-cp-hover disabled:opacity-40"
                    >
                      다시 열기
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
