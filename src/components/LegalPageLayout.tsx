import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { BackButton } from '@/components/BackButton'
import { LegalSiblingNav } from '@/components/legal/LegalProse'

interface Props {
  title: string
  effectiveDate?: string
  /** 현재 페이지 경로 — 상단 형제 탭 하이라이트 */
  currentPath?: string
  children: React.ReactNode
}

export function LegalPageLayout({ title, effectiveDate, currentPath, children }: Props) {
  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col bg-cp-raised">
        <header className="sticky top-0 z-30 bg-cp-raised/95 backdrop-blur-md border-b border-cp-border">
          <div className="flex items-center px-4 py-3 gap-1">
            <BackButton className="hover:bg-cp-surface" />
            <h1 className="text-lg font-bold text-cp-text tracking-tight">{title}</h1>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-10">
          {currentPath && <LegalSiblingNav current={currentPath} />}

          {effectiveDate && (
            <p className="text-[11px] text-cp-dim mb-4 tabular-nums">
              시행일 {effectiveDate}
            </p>
          )}

          <div className="legal-content space-y-1">{children}</div>
        </main>

        <MinimalLegalFooter />
      </div>
    </MobileContainer>
  )
}
