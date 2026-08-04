export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-cp-border bg-cp-raised px-4 py-4">
      <p className="text-xs text-cp-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-cp-dim">{hint}</p> : null}
    </div>
  )
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'muted'
  children: React.ReactNode
}) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'warn'
        ? 'bg-cp-caution/15 text-cp-caution'
        : tone === 'bad'
          ? 'bg-cp-up-muted text-cp-up'
          : 'bg-cp-surface text-cp-muted'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  )
}
