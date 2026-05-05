import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { BackButton } from '@/components/BackButton'

interface Props {
  title: string
  effectiveDate?: string
  children: React.ReactNode
}

export function LegalPageLayout({ title, effectiveDate, children }: Props) {
  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <BackButton />
          <h1 className="text-base font-bold text-gray-900">{title}</h1>
        </header>

        <main className="flex-1 px-5 pt-5 pb-10">
          {effectiveDate && (
            <p className="text-xs text-gray-400 mb-5">시행일자: {effectiveDate}</p>
          )}
          <div className="legal-content text-sm text-gray-700 leading-relaxed space-y-4">
            {children}
          </div>
        </main>

        <MinimalLegalFooter />
      </div>
    </MobileContainer>
  )
}
