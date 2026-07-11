import Link from 'next/link'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

interface Props {
  variant?: 'light' | 'dark'
  className?: string
}

export function LegalFooter({ variant = 'light', className = '' }: Props) {
  const textBase = variant === 'dark' ? 'text-white/35' : 'text-cp-muted'
  const linkColor = variant === 'dark' ? 'text-white/35 hover:text-white/60' : 'text-cp-muted hover:text-cp-muted'
  const dividerColor = variant === 'dark' ? 'text-white/15' : 'text-cp-border'
  const borderColor = variant === 'dark' ? 'border-white/10' : 'border-cp-border'

  return (
    <footer className={`w-full px-3 py-4 border-t ${borderColor} ${className} text-center`}>
      <div className="inline-block text-left">
        <div className={`flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[9px] tracking-tight whitespace-nowrap ${textBase}`}>
          <span className="font-semibold text-current">{B.companyName}</span>
          <span className={dividerColor}>|</span>
          <span>대표 {B.ceoName}</span>
          <span className={dividerColor}>|</span>
          <span>사업자등록 {B.businessNumber}</span>
          <span className={dividerColor}>|</span>
          <span>고객센터 {B.phone}</span>
          <span className={dividerColor}>|</span>
          <Link href="/business" className={linkColor}>사업자정보</Link>
        </div>
        <div className={`mt-0.5 text-[9px] tracking-tight ${textBase}`}>{B.address}</div>
      </div>
    </footer>
  )
}
