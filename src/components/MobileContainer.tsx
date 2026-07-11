'use client'

export function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cp-bg">
      <div className="mx-auto max-w-[446px] min-h-screen bg-cp-raised" style={{ overflowX: 'clip' }}>
        {children}
      </div>
    </div>
  )
}
