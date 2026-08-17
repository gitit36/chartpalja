'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ADMIN_RANGE_PRESETS,
  type AdminRangePreset,
} from '@/lib/admin/dates'

export function AdminRangePicker({
  preset,
  fromKey,
  toKey,
  todayKey,
}: {
  preset: AdminRangePreset
  fromKey: string
  toKey: string
  todayKey: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(preset === 'custom')
  const [from, setFrom] = useState(fromKey)
  const [to, setTo] = useState(toKey)

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1 rounded-xl border border-cp-border bg-cp-raised p-1">
        {ADMIN_RANGE_PRESETS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => router.push(`/admin?range=${r.key}`)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              preset === r.key ? 'bg-cp-surface text-cp-text' : 'text-cp-muted hover:text-cp-secondary'
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            preset === 'custom' ? 'bg-cp-surface text-cp-text' : 'text-cp-muted hover:text-cp-secondary'
          }`}
        >
          직접
        </button>
      </div>
      {open ? (
        <form
          className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-cp-border bg-cp-raised px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!from || !to) return
            router.push(`/admin?from=${from}&to=${to}`)
          }}
        >
          <label className="flex items-center gap-1.5 text-[11px] text-cp-muted">
            시작
            <input
              type="date"
              required
              max={todayKey}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-cp-border bg-cp-surface px-2 py-1 text-xs text-cp-text [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-cp-muted">
            종료
            <input
              type="date"
              required
              max={todayKey}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-cp-border bg-cp-surface px-2 py-1 text-xs text-cp-text [color-scheme:dark]"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-cp-surface px-3 py-1.5 text-xs font-medium text-cp-text hover:bg-cp-hover"
          >
            적용
          </button>
          <span className="text-[10px] text-cp-dim">최대 90일</span>
        </form>
      ) : null}
    </div>
  )
}
