import Link from 'next/link'

export function LegalH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] font-bold text-cp-text tracking-tight mb-1">
      {children}
    </h2>
  )
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-cp-secondary leading-[1.7]">{children}</p>
}

export function LegalLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-cp-muted leading-[1.7] mb-2 rounded-xl bg-cp-surface/60 border border-cp-border px-3.5 py-3">
      {children}
    </p>
  )
}

export function LegalUl({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-cp-secondary leading-[1.7] marker:text-cp-dim">
      {children}
    </ul>
  )
}

export function LegalOl({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal pl-5 space-y-1.5 text-[13px] text-cp-secondary leading-[1.7] marker:text-cp-dim">
      {children}
    </ol>
  )
}

export function LegalTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-cp-border bg-cp-surface/40">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="border-b border-cp-border bg-cp-input/80">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-semibold text-cp-muted whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-cp-border last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-cp-secondary align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LegalSection({ children }: { children: React.ReactNode }) {
  return <section className="space-y-2.5 mt-7 first:mt-0">{children}</section>
}

const LEGAL_NAV = [
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보' },
  { href: '/refund', label: '환불정책' },
  { href: '/business', label: '사업자정보' },
] as const

export function LegalSiblingNav({ current }: { current?: string }) {
  return (
    <nav className="flex flex-wrap gap-1.5 mb-5" aria-label="약관·정책 바로가기">
      {LEGAL_NAV.map((item) => {
        const active = current === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              active
                ? 'bg-cp-accent/15 text-cp-accent border border-cp-accent/40'
                : 'bg-cp-input text-cp-muted border border-cp-border hover:text-cp-secondary hover:bg-cp-hover'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
