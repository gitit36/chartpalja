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
    <div className="rounded-xl border border-cp-border/80 bg-cp-surface/40 px-3.5 py-3">
      <p className="text-[11px] text-cp-muted leading-none">{label}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight tabular-nums text-cp-text">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-cp-dim leading-snug">{hint}</p> : null}
    </div>
  )
}

export function MetricGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-cp-border bg-cp-raised p-4">
      <p className="text-[11px] font-semibold tracking-wide text-cp-dim uppercase mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>
    </section>
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

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-cp-border bg-cp-bg/60 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-cp-surface text-cp-text'
              : 'text-cp-muted hover:text-cp-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
