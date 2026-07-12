import Link from 'next/link'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

interface Props {
  /** app: 다크 앱 셸(기본) / dark: 마케팅 다크 오버레이 */
  variant?: 'app' | 'dark' | 'light'
  className?: string
}

export function MinimalLegalFooter({ variant = 'app', className = '' }: Props) {
  const isOverlay = variant === 'dark'
  const textBase = isOverlay ? 'text-white/35' : 'text-cp-dim'
  const linkColor = isOverlay ? 'text-white/35 hover:text-white/60' : 'text-cp-dim hover:text-cp-muted'
  const dividerColor = isOverlay ? 'text-white/15' : 'text-cp-border'
  const borderColor = isOverlay ? 'border-white/10' : 'border-cp-border'

  return (
    <footer className={`w-full px-3 py-4 border-t ${borderColor} ${className} text-center`}>
      <div className={`inline-block text-left text-[10px] tracking-tight leading-relaxed ${textBase}`}>
        <span className="font-semibold text-current">{B.companyName}</span>
        <span className={dividerColor}> | </span>
        <span>고객센터 {B.phone}</span>
        <span className={dividerColor}> | </span>
        <Link href="/terms" className={linkColor}>이용약관</Link>
        <span className={dividerColor}> | </span>
        <Link href="/privacy" className={linkColor}>개인정보처리방침</Link>
        <span className={dividerColor}> | </span>
        <Link href="/refund" className={linkColor}>환불정책</Link>
        <span className={dividerColor}> | </span>
        <Link href="/business" className={linkColor}>사업자정보</Link>
        <span className={dividerColor}> | </span>
        <span>{B.address}</span>
      </div>
    </footer>
  )
}
