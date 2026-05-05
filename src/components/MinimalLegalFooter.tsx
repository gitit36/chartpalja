import Link from 'next/link'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

interface Props {
  variant?: 'light' | 'dark'
  className?: string
}

export function MinimalLegalFooter({ variant = 'light', className = '' }: Props) {
  const textBase = variant === 'dark' ? 'text-white/35' : 'text-gray-300'
  const linkColor = variant === 'dark' ? 'text-white/35 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'
  const dividerColor = variant === 'dark' ? 'text-white/15' : 'text-gray-200'
  const borderColor = variant === 'dark' ? 'border-white/10' : 'border-gray-50'

  return (
    <footer className={`w-full px-3 py-4 border-t ${borderColor} ${className}`}>
      <div className={`flex items-center justify-center gap-x-1 text-[10px] tracking-tight whitespace-nowrap ${textBase}`}>
        <span className="font-semibold text-current">{B.companyName}</span>
        <span className={dividerColor}>|</span>
        <span>고객센터 {B.phone}</span>
        <span className={dividerColor}>|</span>
        <Link href="/terms" className={linkColor}>이용약관</Link>
        <span className={dividerColor}>|</span>
        <Link href="/privacy" className={linkColor}>개인정보처리방침</Link>
        <span className={dividerColor}>|</span>
        <Link href="/refund" className={linkColor}>환불정책</Link>
        <span className={dividerColor}>|</span>
        <Link href="/business" className={linkColor}>사업자정보</Link>
      </div>
    </footer>
  )
}
