'use client'

export function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[446px] min-h-screen bg-white shadow-sm">
        {children}
      </div>
    </div>
  )
}
