'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin', label: '대시보드', exact: true },
  { href: '/admin/coupons', label: '쿠폰' },
  { href: '/admin/campaigns', label: '캠페인' },
  { href: '/admin/inquiries', label: '문의' },
]

export function AdminShell({
  children,
  adminName,
}: {
  children: React.ReactNode
  adminName: string
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-cp-bg text-cp-text">
      <header className="sticky top-0 z-20 border-b border-cp-border bg-cp-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/admin" className="shrink-0 font-bold tracking-tight">
              차트팔자 <span className="text-cp-muted font-medium">Admin</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto show-scrollbar">
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-cp-surface text-cp-text'
                        : 'text-cp-muted hover:bg-cp-hover hover:text-cp-secondary'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs text-cp-muted">
            <span className="hidden sm:inline truncate max-w-[160px]">{adminName}</span>
            <Link href="/app/list" className="text-cp-accent hover:underline">
              앱으로
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
