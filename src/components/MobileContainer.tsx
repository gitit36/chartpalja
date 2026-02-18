import React from 'react'

export function MobileContainer({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`mx-auto px-4 py-6 ${wide ? 'max-w-[1200px]' : 'max-w-[520px]'}`}>
        {children}
      </div>
      <footer className={`mx-auto px-4 pb-6 text-xs text-gray-500 text-center ${wide ? 'max-w-[1200px]' : 'max-w-[520px]'}`}>
        본 서비스는 참고용 분석 도구이며, 의료·법률·투자 자문이 아닙니다.
      </footer>
    </div>
  )
}
